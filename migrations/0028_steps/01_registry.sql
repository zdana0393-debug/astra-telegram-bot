-- No backfill. Writers must be paused; preserve all legacy flags.
CREATE TABLE IF NOT EXISTS astra_consent_runtime28 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL CHECK(version='consent28-v1'),
 migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1)),
 delivery_quarantined INTEGER NOT NULL DEFAULT 1 CHECK(delivery_quarantined IN(0,1))
);
INSERT OR IGNORE INTO astra_consent_runtime28(singleton,version) VALUES(1,'consent28-v1');
CREATE TABLE IF NOT EXISTS astra_notification_consent28 (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 consent_version TEXT, consent_at INTEGER, source TEXT, grant_update_id INTEGER, grant_message_id INTEGER, revoked_at INTEGER,
 pending_hash TEXT, pending_revision INTEGER, pending_version TEXT, pending_created_at INTEGER, pending_expires_at INTEGER, pending_message_id INTEGER,
 CHECK((consent_version IS NULL AND consent_at IS NULL AND source IS NULL AND grant_update_id IS NULL AND grant_message_id IS NULL) OR
 (consent_version IS NOT NULL AND consent_at IS NOT NULL AND source IS NOT NULL AND grant_update_id IS NOT NULL AND grant_message_id IS NOT NULL AND consent_version='daily-forecast-v1' AND consent_at>0 AND source='explicit_private_button' AND grant_update_id>=0 AND grant_message_id>0)),
 CHECK((pending_hash IS NULL AND pending_revision IS NULL AND pending_version IS NULL AND pending_created_at IS NULL AND pending_expires_at IS NULL AND pending_message_id IS NULL) OR
 (pending_hash IS NOT NULL AND pending_revision IS NOT NULL AND pending_version IS NOT NULL AND pending_created_at IS NOT NULL AND pending_expires_at IS NOT NULL AND length(pending_hash)=64 AND pending_hash NOT GLOB '*[^a-f0-9]*' AND pending_revision=revision AND pending_version='daily-forecast-v1' AND pending_created_at>0 AND pending_expires_at=pending_created_at+900 AND (pending_message_id IS NULL OR pending_message_id>0)))
);
CREATE INDEX IF NOT EXISTS idx_consent28_active ON astra_notification_consent28(telegram_id,generation,revision) WHERE consent_at IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_consent28_pending ON astra_notification_consent28(pending_expires_at) WHERE pending_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS astra_delivery_consent28 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,day TEXT NOT NULL,
 generation TEXT NOT NULL,revision INTEGER NOT NULL,consent_version TEXT NOT NULL CHECK(consent_version='daily-forecast-v1'),
 PRIMARY KEY(telegram_id,day),FOREIGN KEY(telegram_id,day) REFERENCES astra_broadcast_outbox03(telegram_id,day) ON DELETE CASCADE
);
