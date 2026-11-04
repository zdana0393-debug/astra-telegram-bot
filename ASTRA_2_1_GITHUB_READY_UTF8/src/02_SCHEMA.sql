-- АСТРА 2.0. Выполнить один раз в НОВОЙ базе astra-live-v2 -> Console.
-- Имена таблиц/столбцов полностью совпадают с 01_ASTRA_V2.js.
-- Ничего не удаляет, в том числе данные старой базы astra-db.
CREATE TABLE IF NOT EXISTS astra_users (
  telegram_id INTEGER PRIMARY KEY,
  zodiac TEXT,
  balance INTEGER NOT NULL DEFAULT 2 CHECK (balance >= 0),
  referrer_id INTEGER,
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  channel_rewarded INTEGER NOT NULL DEFAULT 0,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  last_gift_day TEXT,
  last_broadcast_day TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_astra_broadcast
  ON astra_users (notifications_enabled, last_broadcast_day, telegram_id);
CREATE TABLE IF NOT EXISTS astra_processed_updates (
  update_id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Проверочные запросы (по одному в Console после выполнения схемы):
-- SELECT name FROM sqlite_master WHERE type='table';
-- SELECT telegram_id, zodiac, balance FROM astra_users LIMIT 5;
