CREATE TRIGGER IF NOT EXISTS astra_forecast_unlock_immutable BEFORE UPDATE ON astra_forecast_unlocks BEGIN
 SELECT RAISE(ABORT,'Paid forecast is immutable');
END;
