CREATE TRIGGER IF NOT EXISTS astra_delivery_guard_insert28 BEFORE INSERT ON astra_broadcast_outbox03 WHEN NEW.state='sending' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c USING(telegram_id)
 JOIN astra_consent_runtime28 m ON m.singleton=1
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND c.generation=p.generation AND u.notifications_enabled=1
 AND c.consent_version='daily-forecast-v1' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND m.version='consent28-v1' AND m.migration_done=1 AND m.delivery_quarantined=0) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_delivery_capture_insert28 AFTER INSERT ON astra_broadcast_outbox03 WHEN NEW.state='sending' BEGIN
 INSERT INTO astra_delivery_consent28(telegram_id,day,generation,revision,consent_version) SELECT NEW.telegram_id,NEW.day,NEW.generation,c.revision,c.consent_version FROM astra_notification_consent28 c WHERE c.telegram_id=NEW.telegram_id
 ON CONFLICT(telegram_id,day) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,consent_version=excluded.consent_version;
END;
CREATE TRIGGER IF NOT EXISTS astra_delivery_guard_update28 BEFORE UPDATE ON astra_broadcast_outbox03 WHEN NEW.state='sending' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c USING(telegram_id)
 JOIN astra_consent_runtime28 m ON m.singleton=1
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND c.generation=p.generation AND u.notifications_enabled=1
 AND c.consent_version='daily-forecast-v1' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND m.version='consent28-v1' AND m.migration_done=1 AND m.delivery_quarantined=0) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_delivery_capture_update28 AFTER UPDATE ON astra_broadcast_outbox03 WHEN NEW.state='sending' BEGIN
 INSERT INTO astra_delivery_consent28(telegram_id,day,generation,revision,consent_version) SELECT NEW.telegram_id,NEW.day,NEW.generation,c.revision,c.consent_version FROM astra_notification_consent28 c WHERE c.telegram_id=NEW.telegram_id
 ON CONFLICT(telegram_id,day) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,consent_version=excluded.consent_version;
END;
CREATE TRIGGER IF NOT EXISTS astra_delivery_erase28 AFTER DELETE ON astra_broadcast_outbox03 BEGIN
 DELETE FROM astra_delivery_consent28 WHERE telegram_id=OLD.telegram_id AND day=OLD.day;
END;
