CREATE TRIGGER IF NOT EXISTS astra_forecast_daily_immutable BEFORE UPDATE ON astra_forecast_daily BEGIN
 SELECT RAISE(ABORT,'Forecast cache is immutable');
END;
