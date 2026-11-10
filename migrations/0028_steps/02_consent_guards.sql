CREATE TRIGGER IF NOT EXISTS astra_consent_insert28 BEFORE INSERT ON astra_notification_consent28 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation) THEN RAISE(ABORT,'Consent profile missing') END;
 SELECT CASE WHEN NEW.revision<>0 OR NEW.consent_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN RAISE(ABORT,'Consent starts pending') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_consent_update28 BEFORE UPDATE ON astra_notification_consent28 BEGIN
 SELECT CASE WHEN NEW.telegram_id<>OLD.telegram_id OR NEW.generation<>OLD.generation THEN RAISE(ABORT,'Consent identity immutable') END;
 SELECT CASE WHEN NOT coalesce((
 (NEW.consent_version IS OLD.consent_version AND NEW.consent_at IS OLD.consent_at AND NEW.source IS OLD.source AND NEW.grant_update_id IS OLD.grant_update_id AND NEW.grant_message_id IS OLD.grant_message_id AND NEW.revoked_at IS OLD.revoked_at AND NEW.revision IS OLD.revision) OR
 (NEW.revision=OLD.revision+1 AND NEW.pending_hash IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.consent_version IS OLD.consent_version AND NEW.consent_at IS OLD.consent_at AND NEW.source IS OLD.source AND NEW.grant_update_id IS OLD.grant_update_id AND NEW.grant_message_id IS OLD.grant_message_id) OR
 (NEW.revision=OLD.revision+1 AND NEW.pending_hash IS NULL AND NEW.revoked_at IS NULL AND NEW.consent_version='daily-forecast-v1' AND NEW.source='explicit_private_button' AND NEW.consent_at=unixepoch()
 AND OLD.pending_hash IS NOT NULL AND OLD.pending_revision=OLD.revision AND OLD.pending_version=NEW.consent_version AND OLD.pending_expires_at>unixepoch() AND OLD.pending_message_id=NEW.grant_message_id
 AND EXISTS(SELECT 1 FROM astra_update_jobs j WHERE j.update_id=NEW.grant_update_id AND j.telegram_id=NEW.telegram_id AND j.status='working')
 AND EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation))
 ),0) THEN RAISE(ABORT,'Invalid consent transition') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_consent_sync28 AFTER UPDATE ON astra_notification_consent28 WHEN NEW.revision<>OLD.revision BEGIN
 UPDATE astra_users SET notifications_enabled=CASE WHEN NEW.consent_at IS NOT NULL AND NEW.revoked_at IS NULL THEN 1 ELSE 0 END WHERE telegram_id=NEW.telegram_id AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation);
 UPDATE astra_broadcast_outbox03 SET state='cancelled',last_reason='consent_revision_changed' WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND state IN('sending','retry');
END;
CREATE TRIGGER IF NOT EXISTS astra_consent_off28 AFTER UPDATE OF notifications_enabled ON astra_users WHEN NEW.notifications_enabled=0 BEGIN
 UPDATE astra_notification_consent28 SET revision=revision+1,revoked_at=coalesce(revoked_at,unixepoch()),pending_hash=NULL, pending_revision=NULL, pending_version=NULL, pending_created_at=NULL, pending_expires_at=NULL, pending_message_id=NULL
 WHERE telegram_id=NEW.telegram_id AND ((consent_at IS NOT NULL AND revoked_at IS NULL) OR pending_hash IS NOT NULL);
END;
CREATE TRIGGER IF NOT EXISTS astra_consent_erase28 BEFORE DELETE ON astra_users BEGIN
 DELETE FROM astra_delivery_consent28 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_notification_consent28 WHERE telegram_id=OLD.telegram_id;
END;
