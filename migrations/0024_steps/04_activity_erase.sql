-- Complements previous cleanup; also runs with the old 2.3B Worker.
CREATE TRIGGER IF NOT EXISTS astra_activity_erase AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_activity_days WHERE telegram_id=OLD.telegram_id;
END;
