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
