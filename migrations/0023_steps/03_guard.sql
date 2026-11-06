CREATE TRIGGER IF NOT EXISTS astra_forecast_guard BEFORE INSERT ON astra_forecast_unlocks BEGIN
 SELECT CASE WHEN NEW.price<>4 OR date(NEW.day,'+0 days') IS NULL OR date(NEW.day,'+0 days')<>NEW.day
   OR NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND balance>=4)
   THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_forecast_daily WHERE sign=NEW.sign AND day=NEW.day AND locale=NEW.locale)
   THEN RAISE(ABORT,'Forecast snapshot missing') END;
END;
