-- Writer pause required. Full 0024 before 0025. Defaults OFF; no financial backfill.
CREATE TABLE IF NOT EXISTS astra_policy (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL DEFAULT 'policy-v2' CHECK(version='policy-v2'),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), start_day TEXT,
 activated INTEGER NOT NULL DEFAULT 0 CHECK(activated IN (0,1)), migration_done INTEGER NOT NULL DEFAULT 0,
 stars_enabled INTEGER NOT NULL DEFAULT 0 CHECK(stars_enabled IN (0,1)), payment_scope TEXT CHECK(payment_scope IN ('test','production')),
 support TEXT, terms_version TEXT, retention_days INTEGER NOT NULL DEFAULT 0, verified_bot_id INTEGER,
 CHECK(start_day IS NULL OR (length(start_day)=10 AND date(start_day,'+0 days') IS NOT NULL AND date(start_day,'+0 days')=start_day)),
 CHECK(activated=0 OR start_day IS NOT NULL)
);
INSERT OR IGNORE INTO astra_policy(singleton) VALUES(1);
CREATE TABLE IF NOT EXISTS astra_user_policy (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL UNIQUE, mode TEXT NOT NULL CHECK(mode IN ('legacy','v2')), registered_day TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS astra_referral_contracts (
 invitee INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 referrer INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,
 generation TEXT NOT NULL UNIQUE, mode TEXT NOT NULL CHECK(mode IN ('legacy','v2')),
 status TEXT NOT NULL CHECK(status IN ('pending','eligible','paid','cancelled')), created_day TEXT NOT NULL, paid_day TEXT, CHECK(referrer IS NULL OR referrer<>invitee)
);
CREATE TABLE IF NOT EXISTS astra_policy_events (
 update_id INTEGER PRIMARY KEY, telegram_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT, source TEXT NOT NULL CHECK(source IN ('message','callback','legacy')),
 legacy INTEGER NOT NULL CHECK(legacy IN (0,1)), processed INTEGER NOT NULL DEFAULT 0 CHECK(processed IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(legacy=1 OR (telegram_id IS NOT NULL AND length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day))
);
CREATE INDEX IF NOT EXISTS idx_policy_events_owner ON astra_policy_events(telegram_id,processed,day,update_id);
CREATE TABLE IF NOT EXISTS astra_policy_days (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day), streak INTEGER NOT NULL CHECK(streak>0),
 event_id INTEGER NOT NULL REFERENCES astra_policy_events(update_id), PRIMARY KEY(telegram_id,day)
);
CREATE TABLE IF NOT EXISTS astra_reward_claims (
 claim_id TEXT PRIMARY KEY, telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL, policy_version TEXT NOT NULL DEFAULT 'policy-v2' CHECK(policy_version='policy-v2'),
 kind TEXT NOT NULL CHECK(kind IN ('initial','daily','first3','weekly','thirty','channel','referrer','invitee')),
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day), amount INTEGER NOT NULL,
 reference TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(telegram_id,generation,kind,reference),
 CHECK((kind IN ('initial','thirty') AND amount=12) OR (kind IN ('daily','first3') AND amount=3) OR (kind='weekly' AND amount=5) OR (kind='channel' AND amount=8) OR (kind='referrer' AND amount=14) OR (kind='invitee' AND amount=4))
);
CREATE INDEX IF NOT EXISTS idx_reward_claims_owner ON astra_reward_claims(telegram_id,kind,day);
CREATE TABLE IF NOT EXISTS astra_referral_payouts (
 invitee INTEGER PRIMARY KEY REFERENCES astra_referral_contracts(invitee) ON DELETE CASCADE,
 day TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
