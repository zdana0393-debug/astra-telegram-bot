-- Additive and repeatable. Apply only with all v2 writers paused; see migration guide.
CREATE TABLE IF NOT EXISTS astra_operations (
  operation_id TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK(reason IN ('daily','channel','referral','tarot')),
  delta INTEGER NOT NULL,
  day TEXT,
  result TEXT,
  delivery TEXT NOT NULL DEFAULT 'pending' CHECK(delivery IN ('pending','sending','sent','retry','unknown','rejected')),
  lease TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((reason='daily' AND delta=1 AND day IS NOT NULL) OR
        (reason IN ('channel','referral') AND delta=5) OR
        (reason='tarot' AND delta=-3 AND result IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_astra_ops_owner ON astra_operations(telegram_id, reason, delivery);
-- Persist the menu-to-purchase binding even when this menu recovers an older order.
-- No operation FK: an insufficient-funds menu may exist before its operation.
CREATE TABLE IF NOT EXISTS astra_tarot_requests (
  request_key TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_astra_tarot_requests_owner ON astra_tarot_requests(telegram_id);
CREATE TABLE IF NOT EXISTS astra_wallet_ledger (
  idempotency_key TEXT PRIMARY KEY,
  operation_id TEXT UNIQUE REFERENCES astra_operations(operation_id) ON DELETE CASCADE,
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_astra_ledger_owner ON astra_wallet_ledger(telegram_id);
-- Snapshot current balances once, not a reconstruction of historical rewards.
INSERT OR IGNORE INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
  SELECT 'opening:'||telegram_id,telegram_id,balance,'opening' FROM astra_users;
CREATE TRIGGER IF NOT EXISTS astra_register AFTER INSERT ON astra_users BEGIN
  INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
    VALUES('opening:'||NEW.telegram_id,NEW.telegram_id,NEW.balance,'registration');
END;
-- Eligibility and posting are one SQLite statement, including all trigger effects.
CREATE TRIGGER IF NOT EXISTS astra_operation_guard BEFORE INSERT ON astra_operations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id
    AND balance+NEW.delta>=0
    AND (NEW.reason<>'daily' OR last_gift_day IS NULL OR last_gift_day<>NEW.day)
    AND (NEW.reason<>'channel' OR channel_rewarded=0)) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_operation_post AFTER INSERT ON astra_operations BEGIN
  UPDATE astra_users SET balance=balance+NEW.delta,
    last_gift_day=CASE WHEN NEW.reason='daily' THEN NEW.day ELSE last_gift_day END,
    channel_rewarded=CASE WHEN NEW.reason='channel' THEN 1 ELSE channel_rewarded END
    WHERE telegram_id=NEW.telegram_id;
  INSERT INTO astra_wallet_ledger(idempotency_key,operation_id,telegram_id,delta,reason)
    VALUES(NEW.operation_id,NEW.operation_id,NEW.telegram_id,NEW.delta,NEW.reason);
END;
CREATE TRIGGER IF NOT EXISTS astra_referral AFTER UPDATE OF zodiac ON astra_users
WHEN OLD.zodiac IS NULL AND NEW.zodiac IS NOT NULL AND OLD.referral_rewarded=0 BEGIN
  INSERT INTO astra_operations(operation_id,telegram_id,source_id,reason,delta)
    SELECT lower(hex(randomblob(16))),telegram_id,NEW.telegram_id,'referral',5
      FROM astra_users WHERE telegram_id=NEW.referrer_id;
  UPDATE astra_users SET referral_rewarded=1 WHERE telegram_id=NEW.telegram_id;
END;
CREATE TABLE IF NOT EXISTS astra_update_jobs (
  update_id INTEGER PRIMARY KEY,
  telegram_id INTEGER,
  status TEXT NOT NULL DEFAULT 'working' CHECK(status IN ('working','done')),
  lease TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  notification_target INTEGER,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_astra_jobs_owner ON astra_update_jobs(telegram_id);
CREATE TABLE IF NOT EXISTS astra_broadcast_jobs (
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  delivery TEXT NOT NULL DEFAULT 'sending',
  PRIMARY KEY(telegram_id,day)
);
-- Explicit cleanup also works with adapters where foreign_keys is disabled.
-- Referrer's earned credit remains, but no deleted invitee ID survives.
CREATE TRIGGER IF NOT EXISTS astra_erase AFTER DELETE ON astra_users BEGIN
  UPDATE astra_operations SET source_id=NULL WHERE source_id=OLD.telegram_id;
  UPDATE astra_users SET referrer_id=NULL WHERE referrer_id=OLD.telegram_id;
  DELETE FROM astra_wallet_ledger WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_tarot_requests WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_operations WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_update_jobs WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_broadcast_jobs WHERE telegram_id=OLD.telegram_id;
END;
