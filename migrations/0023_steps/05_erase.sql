-- Keep both existing astra_erase and astra_shell_erase unchanged.
CREATE TRIGGER IF NOT EXISTS astra_forecast_erase AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_forecast_unlocks WHERE telegram_id=OLD.telegram_id;
END;
