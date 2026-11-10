CREATE TRIGGER IF NOT EXISTS astra_broadcast_purge03 BEFORE DELETE ON astra_broadcast_jobs BEGIN
 DELETE FROM astra_broadcast_outbox03 WHERE telegram_id=OLD.telegram_id AND day=OLD.day;
END;
CREATE TRIGGER IF NOT EXISTS astra_broadcast_erase03 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_broadcast_outbox03 WHERE telegram_id=OLD.telegram_id;
END;
UPDATE astra_broadcast_runtime03 SET migration_done=1 WHERE singleton=1;
