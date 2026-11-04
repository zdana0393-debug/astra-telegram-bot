-- STAGING ONLY: astra-staging-21. Requires the complete 2.1 schema.
CREATE TABLE IF NOT EXISTS astra_shell_rewards (
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK(code='gpt6'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id,code)
);
CREATE TRIGGER IF NOT EXISTS astra_shell_reward_guard BEFORE INSERT ON astra_shell_rewards BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id)
    THEN RAISE(ABORT,'Reward requires a profile') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_shell_reward_post AFTER INSERT ON astra_shell_rewards BEGIN
  UPDATE astra_users SET balance=balance+5 WHERE telegram_id=NEW.telegram_id;
  INSERT INTO astra_wallet_ledger(idempotency_key,operation_id,telegram_id,delta,reason)
    VALUES('easter:'||NEW.code||':'||NEW.telegram_id,NULL,NEW.telegram_id,5,'easter:'||NEW.code);
END;
-- Complements astra_erase, without replacing it; works with foreign_keys=OFF.
CREATE TRIGGER IF NOT EXISTS astra_shell_erase AFTER DELETE ON astra_users BEGIN
  DELETE FROM astra_shell_rewards WHERE telegram_id=OLD.telegram_id;
END;
