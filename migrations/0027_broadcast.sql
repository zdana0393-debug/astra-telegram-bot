-- TASK03 only. Maintenance writers pause; 0021..0026 remain immutable.
CREATE TABLE IF NOT EXISTS astra_broadcast_runtime03 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
 cooldown_until INTEGER NOT NULL DEFAULT 0,migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1))
);
INSERT OR IGNORE INTO astra_broadcast_runtime03(singleton) VALUES(1);
CREATE TABLE IF NOT EXISTS astra_broadcast_outbox03 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,day TEXT NOT NULL,
 generation TEXT NOT NULL,sign TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('sending','sent','retry','blocked','failed','unknown','cancelled','expired')),
 attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 3),token TEXT NOT NULL,
 not_before INTEGER NOT NULL DEFAULT 0,last_try_at INTEGER NOT NULL,parts_sent INTEGER NOT NULL DEFAULT 0 CHECK(parts_sent BETWEEN 0 AND 2),
 last_code INTEGER,last_reason TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(telegram_id,day),
 CHECK(length(day)=10 AND date(day,'+0 days')=day)
);
CREATE INDEX IF NOT EXISTS idx_broadcast_outbox03_due ON astra_broadcast_outbox03(day,state,not_before,telegram_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_day03 ON astra_broadcast_jobs(day,telegram_id);
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
CREATE TRIGGER IF NOT EXISTS astra_broadcast_purge03 BEFORE DELETE ON astra_broadcast_jobs BEGIN
 DELETE FROM astra_broadcast_outbox03 WHERE telegram_id=OLD.telegram_id AND day=OLD.day;
END;
CREATE TRIGGER IF NOT EXISTS astra_broadcast_erase03 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_broadcast_outbox03 WHERE telegram_id=OLD.telegram_id;
END;
UPDATE astra_broadcast_runtime03 SET migration_done=1 WHERE singleton=1;
