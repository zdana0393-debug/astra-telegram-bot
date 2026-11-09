CREATE TRIGGER IF NOT EXISTS astra_broadcast_guard03 BEFORE INSERT ON astra_broadcast_outbox03 BEGIN
 SELECT CASE WHEN NEW.state<>'sending' OR NEW.attempts<>1 THEN RAISE(ABORT,'New broadcast starts with one sending attempt') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_broadcast_jobs b WHERE b.telegram_id=NEW.telegram_id AND b.day=NEW.day)
  AND NOT EXISTS(SELECT 1 FROM astra_broadcast_outbox03 q WHERE q.telegram_id=NEW.telegram_id AND q.day=NEW.day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND u.zodiac=NEW.sign AND u.notifications_enabled=1 AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<>NEW.day)) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_broadcast_legacy_guard03 BEFORE INSERT ON astra_broadcast_jobs
 WHEN NOT EXISTS(SELECT 1 FROM astra_broadcast_outbox03 q WHERE q.telegram_id=NEW.telegram_id AND q.day=NEW.day AND q.state='sending')
 BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS astra_broadcast_marker03 AFTER INSERT ON astra_broadcast_outbox03 BEGIN
 INSERT INTO astra_broadcast_jobs(telegram_id,day,delivery) VALUES(NEW.telegram_id,NEW.day,'sending');
END;
CREATE TRIGGER IF NOT EXISTS astra_broadcast_update_guard03 BEFORE UPDATE ON astra_broadcast_outbox03 BEGIN
 SELECT CASE WHEN NEW.telegram_id<>OLD.telegram_id OR NEW.day<>OLD.day OR NEW.generation<>OLD.generation OR NEW.sign<>OLD.sign THEN RAISE(ABORT,'Broadcast identity immutable') END;
 SELECT CASE WHEN NEW.state='sending' AND (OLD.state<>'retry' OR NEW.attempts<>OLD.attempts+1 OR NEW.token=OLD.token) THEN RAISE(ABORT,'Only due retry can restart') END;
 SELECT CASE WHEN NEW.state<>'sending' AND(OLD.state NOT IN('sending','retry') OR NEW.attempts<>OLD.attempts OR NEW.token<>OLD.token) THEN RAISE(ABORT,'Broadcast terminal state immutable') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_broadcast_sync03 AFTER UPDATE ON astra_broadcast_outbox03 BEGIN
 UPDATE astra_broadcast_jobs SET delivery=CASE WHEN NEW.state IN('blocked','failed') THEN 'rejected' ELSE NEW.state END WHERE telegram_id=NEW.telegram_id AND day=NEW.day;
 UPDATE astra_users SET last_broadcast_day=NEW.day WHERE telegram_id=NEW.telegram_id AND NEW.state='sent' AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation);
 UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=NEW.telegram_id AND NEW.state='blocked' AND NEW.last_code=403 AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation);
END;
