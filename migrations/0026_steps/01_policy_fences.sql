-- Maintenance required. 0021..0025 immutable. Refuse an already activated 0025 policy.
CREATE TABLE IF NOT EXISTS astra_patch26 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL DEFAULT 'policy-v3' CHECK(version='policy-v3'),
 source_policy_idle INTEGER NOT NULL CHECK(source_policy_idle=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 start_day TEXT,activated INTEGER NOT NULL DEFAULT 0 CHECK(activated IN(0,1)),notice_approved INTEGER NOT NULL DEFAULT 0 CHECK(notice_approved IN(0,1)),
 active_key_id TEXT, unsafe_until INTEGER NOT NULL DEFAULT 0,installed_at INTEGER NOT NULL DEFAULT(unixepoch()),migration_done INTEGER NOT NULL DEFAULT 0,
 CHECK(start_day IS NULL OR (length(start_day)=10 AND date(start_day,'+0 days')=start_day)),
 CHECK(activated=0 OR start_day IS NOT NULL),CHECK(enabled=0 OR (notice_approved=1 AND active_key_id IS NOT NULL))
);
INSERT INTO astra_patch26(singleton,source_policy_idle) SELECT 1,CASE WHEN enabled=0 AND activated=0 THEN 1 ELSE 0 END FROM astra_policy WHERE singleton=1 AND NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1);
CREATE TABLE IF NOT EXISTS astra_bonus_keys26 (key_id TEXT PRIMARY KEY,check_hmac TEXT NOT NULL CHECK(length(check_hmac)=64),added_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS astra_bonus_profiles26 (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL UNIQUE,
 mode TEXT NOT NULL CHECK(mode IN('existing','legacy','new')),registered_day TEXT NOT NULL,seeded INTEGER NOT NULL DEFAULT 0 CHECK(seeded IN(0,1)),seed_cursor INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS astra_bonus_aliases26 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,key_id TEXT NOT NULL REFERENCES astra_bonus_keys26(key_id),
 owner_hash TEXT NOT NULL CHECK(length(owner_hash)=64),invitee_hash TEXT NOT NULL CHECK(length(invitee_hash)=64),PRIMARY KEY(telegram_id,key_id)
);
-- Only pseudonymous entitlement facts survive ordinary profile deletion; no raw IDs or profile FK.
CREATE TABLE IF NOT EXISTS astra_bonus_fences26 (
 key_id TEXT NOT NULL REFERENCES astra_bonus_keys26(key_id),subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
 purpose TEXT NOT NULL CHECK(purpose IN('initial','daily','first3','weekly','thirty','gpt6','channel','invitee_welcome','inviter_referral','inviter_channel')),
 reference TEXT NOT NULL,awarded_at INTEGER NOT NULL,expires_at INTEGER NOT NULL CHECK(expires_at=awarded_at+2592000),
 PRIMARY KEY(key_id,subject_hash,purpose,reference)
);
CREATE INDEX IF NOT EXISTS idx_bonus_fences26_expiry ON astra_bonus_fences26(expires_at);
CREATE TABLE IF NOT EXISTS astra_bonus_awards26 (
 award_id TEXT PRIMARY KEY,telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL,
 subject_generation TEXT NOT NULL,kind TEXT NOT NULL,day TEXT NOT NULL,amount INTEGER NOT NULL,key_id TEXT NOT NULL,reference TEXT NOT NULL,awarded_at INTEGER NOT NULL,
 UNIQUE(generation,kind,reference),CHECK(length(day)=10 AND date(day,'+0 days')=day),
 CHECK((kind IN('initial','gpt6','legacy_channel','legacy_referrer','inviter_channel') AND amount=5) OR (kind='legacy_initial' AND amount=2) OR
 (kind='daily' AND amount=2) OR(kind='legacy_daily' AND amount=1) OR(kind IN('first3','invitee') AND amount=3) OR(kind='weekly' AND amount=4) OR(kind='thirty' AND amount=6) OR(kind='channel' AND amount=15) OR(kind='referrer' AND amount=10))
);
CREATE INDEX IF NOT EXISTS idx_bonus_awards26_owner ON astra_bonus_awards26(telegram_id,kind,day);
CREATE TABLE IF NOT EXISTS astra_bonus_days26 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,day TEXT NOT NULL,streak INTEGER NOT NULL CHECK(streak>0),
 event_id INTEGER NOT NULL REFERENCES astra_policy_events(update_id),awarded_at INTEGER NOT NULL,PRIMARY KEY(telegram_id,day),CHECK(length(day)=10 AND date(day,'+0 days')=day)
);
CREATE TABLE IF NOT EXISTS astra_bonus_referrals26 (
 invitee INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,inviter INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,
 inviter_generation TEXT,invitee_generation TEXT NOT NULL UNIQUE,mode TEXT NOT NULL CHECK(mode IN('legacy','new')),
 status TEXT NOT NULL CHECK(status IN('pending','paid','cancelled')),created_day TEXT NOT NULL,confirmed_day TEXT,CHECK(inviter IS NULL OR inviter<>invitee)
);
-- A transient SQL command envelope; AFTER effects remove it. Entitlements, not envelopes, are the deduplication authority.
CREATE TABLE IF NOT EXISTS astra_bonus_commands26 (
 command_id TEXT PRIMARY KEY,telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN('initial','gpt6','referral','channel','legacy_daily')),day TEXT NOT NULL,awarded_at INTEGER NOT NULL,verified_channel TEXT
);
