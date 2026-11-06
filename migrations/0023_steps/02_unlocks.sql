CREATE TABLE IF NOT EXISTS astra_forecast_unlocks (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day),
 sign TEXT NOT NULL,
 locale TEXT NOT NULL CHECK(locale='ru'),
 price INTEGER NOT NULL CHECK(price=4),
 result_text TEXT NOT NULL CHECK(length(trim(result_text))>0),
 engine_version TEXT NOT NULL CHECK(length(engine_version)>0),
 content_version TEXT NOT NULL CHECK(length(content_version)>0),
 number_algorithm_version TEXT NOT NULL CHECK(number_algorithm_version='legacy-hash-v1'),
 source_tags TEXT NOT NULL CHECK(json_valid(source_tags)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(telegram_id,day),
 FOREIGN KEY(sign,day,locale) REFERENCES astra_forecast_daily(sign,day,locale)
);
CREATE INDEX IF NOT EXISTS idx_forecast_unlocks_day ON astra_forecast_unlocks(day);
