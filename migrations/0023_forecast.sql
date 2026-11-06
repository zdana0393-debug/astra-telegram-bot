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
CREATE TRIGGER IF NOT EXISTS astra_forecast_guard BEFORE INSERT ON astra_forecast_unlocks BEGIN
 SELECT CASE WHEN NEW.price<>4 OR date(NEW.day,'+0 days') IS NULL OR date(NEW.day,'+0 days')<>NEW.day
   OR NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND balance>=4)
   THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_forecast_daily WHERE sign=NEW.sign AND day=NEW.day AND locale=NEW.locale)
   THEN RAISE(ABORT,'Forecast snapshot missing') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_forecast_post AFTER INSERT ON astra_forecast_unlocks BEGIN
 UPDATE astra_users SET balance=balance-4 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,operation_id,telegram_id,delta,reason)
  VALUES('forecast:extended:'||NEW.telegram_id||':'||NEW.day,NULL,NEW.telegram_id,-4,'forecast:extended');
END;
-- Keep both existing astra_erase and astra_shell_erase unchanged.
CREATE TRIGGER IF NOT EXISTS astra_forecast_erase AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_forecast_unlocks WHERE telegram_id=OLD.telegram_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_forecast_daily_immutable BEFORE UPDATE ON astra_forecast_daily BEGIN
 SELECT RAISE(ABORT,'Forecast cache is immutable');
END;
CREATE TRIGGER IF NOT EXISTS astra_forecast_unlock_immutable BEFORE UPDATE ON astra_forecast_unlocks BEGIN
 SELECT RAISE(ABORT,'Paid forecast is immutable');
END;
