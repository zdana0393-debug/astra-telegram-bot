-- Additive, no backfill and no monetary changes. Full 0021/0022/0023 required.
CREATE TABLE IF NOT EXISTS astra_activity_days (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 source TEXT NOT NULL CHECK(source IN ('message','callback')),
 PRIMARY KEY(telegram_id,day)
);
CREATE INDEX IF NOT EXISTS idx_astra_ledger_history
 ON astra_wallet_ledger(telegram_id,created_at DESC,idempotency_key DESC);
-- Prevent orphans/non-registered activity even with foreign_keys=OFF.
CREATE TRIGGER IF NOT EXISTS astra_activity_guard BEFORE INSERT ON astra_activity_days BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id
   AND zodiac IN ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'))
 THEN RAISE(IGNORE) END;
END;
-- Complements previous cleanup; also runs with the old 2.3B Worker.
CREATE TRIGGER IF NOT EXISTS astra_activity_erase AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_activity_days WHERE telegram_id=OLD.telegram_id;
END;
