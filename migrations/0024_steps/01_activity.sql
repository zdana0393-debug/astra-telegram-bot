-- Additive, no backfill and no monetary changes. Full 0021/0022/0023 required.
CREATE TABLE IF NOT EXISTS astra_activity_days (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 source TEXT NOT NULL CHECK(source IN ('message','callback')),
 PRIMARY KEY(telegram_id,day)
);
