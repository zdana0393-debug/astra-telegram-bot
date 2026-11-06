-- STAGING astra-staging-21 only, after full 0022. No user identifiers in this cache.
CREATE TABLE IF NOT EXISTS astra_forecast_daily (
 sign TEXT NOT NULL CHECK(sign IN ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')),
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day),
 locale TEXT NOT NULL CHECK(locale='ru'),
 free_text TEXT NOT NULL CHECK(length(trim(free_text))>0),
 extended_text TEXT NOT NULL CHECK(length(trim(extended_text))>0),
 number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 9),
 engine_version TEXT NOT NULL CHECK(length(engine_version)>0),
 content_version TEXT NOT NULL CHECK(length(content_version)>0),
 number_algorithm_version TEXT NOT NULL CHECK(number_algorithm_version='legacy-hash-v1'),
 source_tags TEXT NOT NULL CHECK(json_valid(source_tags)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(sign,day,locale)
);
CREATE INDEX IF NOT EXISTS idx_forecast_daily_day ON astra_forecast_daily(day);
