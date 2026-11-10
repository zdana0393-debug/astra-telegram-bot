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
CREATE TRIGGER IF NOT EXISTS astra_bonus_award_guard26 BEFORE INSERT ON astra_bonus_awards26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1 AND notice_approved=1 AND active_key_id=NEW.key_id AND unsafe_until<=NEW.awarded_at)
 OR NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 r JOIN astra_users u USING(telegram_id) WHERE r.telegram_id=NEW.telegram_id AND r.generation=NEW.generation AND r.seeded=1)
 OR NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 s WHERE s.generation=NEW.subject_generation AND s.seeded=1)
 THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_bonus_keys26 k WHERE (k.key_id=NEW.key_id OR EXISTS(SELECT 1 FROM astra_bonus_fences26 f WHERE f.key_id=k.key_id AND f.expires_at>NEW.awarded_at)) AND NOT EXISTS(SELECT 1 FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) WHERE s.generation=NEW.subject_generation AND a.key_id=k.key_id)) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN('initial','daily','first3','weekly','thirty','channel','referrer','invitee','inviter_channel') AND NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1 AND enabled=1 AND activated=1 AND NEW.day>=start_day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind NOT IN('daily','first3','weekly','thirty') AND NOT EXISTS(SELECT 1 FROM astra_bonus_commands26 c JOIN astra_bonus_profiles26 s ON s.telegram_id=c.telegram_id WHERE s.generation=NEW.subject_generation AND ((NEW.kind IN('initial','legacy_initial') AND c.kind='initial') OR (NEW.kind='gpt6' AND c.kind='gpt6') OR (NEW.kind IN('channel','legacy_channel') AND c.kind='channel' AND c.verified_channel IS NOT NULL) OR (NEW.kind='legacy_daily' AND c.kind='legacy_daily') OR (NEW.kind IN('referrer','legacy_referrer','invitee') AND c.kind='referral') OR (NEW.kind='inviter_channel' AND c.kind IN('referral','channel')))) THEN RAISE(ABORT,'Award requires command envelope') END;
 SELECT CASE WHEN NEW.award_id<>'grant26:'||NEW.generation||':'||NEW.kind||':'||NEW.reference THEN RAISE(ABORT,'Invalid award key') END;
 SELECT CASE WHEN (NEW.kind IN('referrer','legacy_referrer','invitee','inviter_channel') AND NEW.subject_generation<>NEW.reference) OR (NEW.kind NOT IN('referrer','legacy_referrer','invitee','inviter_channel') AND NEW.subject_generation<>NEW.generation) OR (NEW.kind IN('daily','legacy_daily','weekly') AND NEW.reference<>NEW.day) OR (NEW.kind NOT IN('referrer','legacy_referrer','invitee','inviter_channel','daily','legacy_daily','weekly') AND NEW.reference<>'once') THEN RAISE(ABORT,'Invalid award subject/reference') END;
 SELECT CASE WHEN NEW.kind IN('initial','legacy_initial') AND NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 WHERE generation=NEW.generation AND mode=CASE NEW.kind WHEN 'initial' THEN 'new' ELSE 'legacy' END) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='gpt6' AND EXISTS(SELECT 1 FROM astra_shell_rewards WHERE telegram_id=NEW.telegram_id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN('channel','legacy_channel') AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND zodiac IS NOT NULL AND channel_rewarded=0) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN('legacy_daily','legacy_channel') AND EXISTS(SELECT 1 FROM astra_patch26 WHERE activated=1 OR (start_day IS NOT NULL AND NEW.day>=start_day)) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='legacy_daily' AND EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND last_gift_day=NEW.day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN('daily','first3','weekly','thirty') AND NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day) THEN RAISE(ABORT,'Award requires a policy day') END;
 SELECT CASE WHEN NEW.kind='first3' AND (NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak>=3) OR EXISTS(SELECT 1 FROM astra_reward_claims WHERE telegram_id=NEW.telegram_id AND kind='first3')) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='weekly' AND NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak%7=0) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='thirty' AND ((SELECT count(*) FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id)<30 OR EXISTS(SELECT 1 FROM astra_reward_claims WHERE telegram_id=NEW.telegram_id AND kind='thirty')) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN('referrer','legacy_referrer','invitee') AND NOT EXISTS(SELECT 1 FROM astra_bonus_referrals26 c JOIN astra_users i ON i.telegram_id=c.invitee WHERE c.invitee_generation=NEW.reference AND c.status='pending' AND i.zodiac IS NOT NULL AND ((NEW.kind IN('referrer','legacy_referrer') AND c.inviter=NEW.telegram_id AND c.inviter_generation=NEW.generation) OR (NEW.kind='invitee' AND c.invitee=NEW.telegram_id AND c.mode='new'))) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='inviter_channel' AND NOT EXISTS(SELECT 1 FROM astra_bonus_referrals26 c JOIN astra_bonus_awards26 a ON a.generation=c.invitee_generation AND a.kind='channel' AND a.amount=15 WHERE c.invitee_generation=NEW.reference AND c.status='paid' AND c.inviter=NEW.telegram_id AND c.inviter_generation=NEW.generation) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) JOIN astra_bonus_fences26 f ON f.key_id=a.key_id AND f.subject_hash=CASE WHEN CASE NEW.kind WHEN 'legacy_initial' THEN 'initial' WHEN 'legacy_daily' THEN 'daily' WHEN 'legacy_channel' THEN 'channel' WHEN 'legacy_referrer' THEN 'inviter_referral' WHEN 'referrer' THEN 'inviter_referral' WHEN 'invitee' THEN 'invitee_welcome' ELSE NEW.kind END IN('inviter_referral','invitee_welcome','inviter_channel') THEN a.invitee_hash ELSE a.owner_hash END WHERE s.generation=NEW.subject_generation AND f.purpose=CASE NEW.kind WHEN 'legacy_initial' THEN 'initial' WHEN 'legacy_daily' THEN 'daily' WHEN 'legacy_channel' THEN 'channel' WHEN 'legacy_referrer' THEN 'inviter_referral' WHEN 'referrer' THEN 'inviter_referral' WHEN 'invitee' THEN 'invitee_welcome' ELSE NEW.kind END AND f.reference=CASE WHEN NEW.kind IN('daily','legacy_daily','weekly') THEN NEW.day ELSE 'once' END AND f.expires_at>NEW.awarded_at) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_award_post26 AFTER INSERT ON astra_bonus_awards26 BEGIN
 DELETE FROM astra_bonus_fences26 WHERE key_id=NEW.key_id AND purpose=CASE NEW.kind WHEN 'legacy_initial' THEN 'initial' WHEN 'legacy_daily' THEN 'daily' WHEN 'legacy_channel' THEN 'channel' WHEN 'legacy_referrer' THEN 'inviter_referral' WHEN 'referrer' THEN 'inviter_referral' WHEN 'invitee' THEN 'invitee_welcome' ELSE NEW.kind END AND reference=CASE WHEN NEW.kind IN('daily','legacy_daily','weekly') THEN NEW.day ELSE 'once' END AND expires_at<=NEW.awarded_at AND subject_hash IN(SELECT CASE WHEN CASE NEW.kind WHEN 'legacy_initial' THEN 'initial' WHEN 'legacy_daily' THEN 'daily' WHEN 'legacy_channel' THEN 'channel' WHEN 'legacy_referrer' THEN 'inviter_referral' WHEN 'referrer' THEN 'inviter_referral' WHEN 'invitee' THEN 'invitee_welcome' ELSE NEW.kind END IN('inviter_referral','invitee_welcome','inviter_channel') THEN a.invitee_hash ELSE a.owner_hash END FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) WHERE s.generation=NEW.subject_generation AND a.key_id=NEW.key_id);
 INSERT INTO astra_bonus_fences26(key_id,subject_hash,purpose,reference,awarded_at,expires_at)
 SELECT NEW.key_id,CASE WHEN CASE NEW.kind WHEN 'legacy_initial' THEN 'initial' WHEN 'legacy_daily' THEN 'daily' WHEN 'legacy_channel' THEN 'channel' WHEN 'legacy_referrer' THEN 'inviter_referral' WHEN 'referrer' THEN 'inviter_referral' WHEN 'invitee' THEN 'invitee_welcome' ELSE NEW.kind END IN('inviter_referral','invitee_welcome','inviter_channel') THEN a.invitee_hash ELSE a.owner_hash END,CASE NEW.kind WHEN 'legacy_initial' THEN 'initial' WHEN 'legacy_daily' THEN 'daily' WHEN 'legacy_channel' THEN 'channel' WHEN 'legacy_referrer' THEN 'inviter_referral' WHEN 'referrer' THEN 'inviter_referral' WHEN 'invitee' THEN 'invitee_welcome' ELSE NEW.kind END,CASE WHEN NEW.kind IN('daily','legacy_daily','weekly') THEN NEW.day ELSE 'once' END,NEW.awarded_at,NEW.awarded_at+2592000 FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) WHERE s.generation=NEW.subject_generation AND a.key_id=NEW.key_id;
 SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'Award fence not committed') END;
 UPDATE astra_users SET balance=balance+NEW.amount,channel_rewarded=CASE WHEN NEW.kind IN('channel','legacy_channel') THEN 1 ELSE channel_rewarded END,last_gift_day=CASE WHEN NEW.kind='legacy_daily' THEN NEW.day ELSE last_gift_day END WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(NEW.award_id,NEW.telegram_id,NEW.amount,'reward:v3:'||NEW.kind);
 INSERT OR IGNORE INTO astra_shell_rewards(telegram_id,code) SELECT NEW.telegram_id,'gpt6' WHERE NEW.kind='gpt6';
END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_award_immutable26 BEFORE UPDATE ON astra_bonus_awards26 BEGIN SELECT RAISE(ABORT,'Award immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_day_guard26 BEFORE INSERT ON astra_bonus_days26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE enabled=1 AND activated=1 AND notice_approved=1 AND NEW.day>=start_day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_policy_events e JOIN astra_users u ON u.telegram_id=e.telegram_id WHERE e.update_id=NEW.event_id AND e.telegram_id=NEW.telegram_id AND e.day=NEW.day AND e.legacy=0 AND u.zodiac IS NOT NULL) THEN RAISE(ABORT,'Durable private event required') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day>NEW.day) AND NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day) THEN RAISE(ABORT,'Out-of-order day') END;
 SELECT CASE WHEN NEW.streak<>coalesce((SELECT streak FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=date(NEW.day,'-1 day')),0)+1 THEN RAISE(ABORT,'Invalid streak') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_day_post26 AFTER INSERT ON astra_bonus_days26 BEGIN
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':daily:'||NEW.day,r.telegram_id,r.generation,r.generation,'daily',NEW.day,2,p.active_key_id,NEW.day,NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (1);
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':first3:'||'once',r.telegram_id,r.generation,r.generation,'first3',NEW.day,3,p.active_key_id,'once',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.streak>=3);
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':weekly:'||NEW.day,r.telegram_id,r.generation,r.generation,'weekly',NEW.day,4,p.active_key_id,NEW.day,NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.streak%7=0);
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':thirty:'||'once',r.telegram_id,r.generation,r.generation,'thirty',NEW.day,6,p.active_key_id,'once',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND ((SELECT count(*) FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id)>=30);
END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_day_immutable26 BEFORE UPDATE ON astra_bonus_days26 BEGIN SELECT RAISE(ABORT,'Day immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_command_guard26 BEFORE INSERT ON astra_bonus_commands26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE notice_approved=1 AND active_key_id IS NOT NULL AND unsafe_until<=NEW.awarded_at) OR NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 WHERE telegram_id=NEW.telegram_id AND seeded=1) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='channel' AND (NEW.verified_channel IS NULL OR length(NEW.verified_channel)<6) THEN RAISE(ABORT,'Verified membership required') END;
 -- Both referral credits must be eligible before either is posted. One existing right blocks the whole new pair.
 SELECT CASE WHEN NEW.kind='referral' AND (NOT EXISTS(SELECT 1 FROM astra_bonus_referrals26 c JOIN astra_bonus_profiles26 p ON p.telegram_id=c.inviter AND p.generation=c.inviter_generation JOIN astra_users u ON u.telegram_id=c.invitee WHERE c.invitee=NEW.telegram_id AND c.status='pending' AND p.seeded=1 AND u.zodiac IS NOT NULL)
 OR EXISTS(SELECT 1 FROM astra_bonus_aliases26 a JOIN astra_bonus_fences26 f ON f.key_id=a.key_id AND f.subject_hash=a.invitee_hash WHERE a.telegram_id=NEW.telegram_id AND f.purpose IN('inviter_referral','invitee_welcome') AND f.reference='once' AND f.expires_at>NEW.awarded_at)) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_command_post26 AFTER INSERT ON astra_bonus_commands26 BEGIN
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':initial:'||'once',r.telegram_id,r.generation,r.generation,'initial',NEW.day,5,p.active_key_id,'once',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind='initial' AND r.mode='new');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':legacy_initial:'||'once',r.telegram_id,r.generation,r.generation,'legacy_initial',NEW.day,2,p.active_key_id,'once',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind='initial' AND r.mode='legacy');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':gpt6:'||'once',r.telegram_id,r.generation,r.generation,'gpt6',NEW.day,5,p.active_key_id,'once',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind='gpt6');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':legacy_daily:'||NEW.day,r.telegram_id,r.generation,r.generation,'legacy_daily',NEW.day,1,p.active_key_id,NEW.day,NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind='legacy_daily');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':channel:'||'once',r.telegram_id,r.generation,r.generation,'channel',NEW.day,15,p.active_key_id,'once',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind='channel');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':legacy_channel:'||'once',r.telegram_id,r.generation,r.generation,'legacy_channel',NEW.day,5,p.active_key_id,'once',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind='channel');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':referrer:'||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),'referrer',NEW.day,10,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=(SELECT inviter FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND (NEW.kind='referral' AND (SELECT mode FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id)='new');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':legacy_referrer:'||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),'legacy_referrer',NEW.day,5,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=(SELECT inviter FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND (NEW.kind='referral' AND (SELECT mode FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id)='legacy');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':invitee:'||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),'invitee',NEW.day,3,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind='referral' AND (SELECT mode FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id)='new');

 SELECT CASE WHEN NEW.kind='referral' AND EXISTS(SELECT 1 FROM astra_bonus_referrals26 c WHERE c.invitee=NEW.telegram_id AND c.mode='new') AND ((SELECT count(*) FROM astra_bonus_awards26 a WHERE a.reference=(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND a.kind IN('referrer','invitee')) NOT IN(0,2)) THEN RAISE(ABORT,'Referral pair incomplete') END;
 UPDATE astra_bonus_referrals26 SET status='paid',confirmed_day=NEW.day WHERE invitee=NEW.telegram_id AND NEW.kind='referral' AND EXISTS(SELECT 1 FROM astra_bonus_awards26 a WHERE a.reference=invitee_generation AND a.kind IN('referrer','legacy_referrer'));
 UPDATE astra_users SET referral_rewarded=1 WHERE telegram_id=NEW.telegram_id AND EXISTS(SELECT 1 FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id AND status='paid');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT 'grant26:'||r.generation||':inviter_channel:'||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),'inviter_channel',NEW.day,5,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=(SELECT inviter FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND (NEW.kind IN('channel','referral'));
 DELETE FROM astra_bonus_commands26 WHERE command_id=NEW.command_id;
END;
DROP TRIGGER IF EXISTS astra_register;
DROP TRIGGER IF EXISTS astra_reward_post;
DROP TRIGGER IF EXISTS astra_policy_day_post;
DROP TRIGGER IF EXISTS astra_policy_day_guard;
DROP TRIGGER IF EXISTS astra_referral_policy;
DROP TRIGGER IF EXISTS astra_shell_reward_post;
DROP TRIGGER IF EXISTS astra_operation_guard;
CREATE TRIGGER IF NOT EXISTS astra_old_reward_disabled26 BEFORE INSERT ON astra_reward_claims BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS astra_old_day_disabled26 BEFORE INSERT ON astra_policy_days BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS astra_old_shell_disabled26 BEFORE INSERT ON astra_shell_rewards
 WHEN NOT EXISTS(SELECT 1 FROM astra_bonus_awards26 WHERE telegram_id=NEW.telegram_id AND kind='gpt6') BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS astra_operation_guard26 BEFORE INSERT ON astra_operations BEGIN
 SELECT CASE WHEN NEW.reason<>'tarot' THEN RAISE(IGNORE) END;
 -- New -3 requests are obsolete. Fulfilment may only read a previously paid operation.
 SELECT RAISE(IGNORE);
END;
CREATE TRIGGER IF NOT EXISTS astra_register26 AFTER INSERT ON astra_users BEGIN
 INSERT INTO astra_user_policy(telegram_id,generation,mode,registered_day) VALUES(NEW.telegram_id,lower(hex(randomblob(16))),'legacy',date(NEW.created_at,'+3 hours'));
 UPDATE astra_users SET balance=0 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_bonus_profiles26(telegram_id,generation,mode,registered_day,seeded)
 SELECT telegram_id,generation,CASE WHEN EXISTS(SELECT 1 FROM astra_patch26 WHERE activated=1 OR(start_day IS NOT NULL AND date(NEW.created_at,'+3 hours')>=start_day)) THEN 'new' ELSE 'legacy' END,registered_day,1 FROM astra_user_policy WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES('opening:'||NEW.telegram_id,NEW.telegram_id,0,'registration');
 INSERT INTO astra_bonus_referrals26(invitee,inviter,inviter_generation,invitee_generation,mode,status,created_day)
 SELECT NEW.telegram_id,NEW.referrer_id,i.generation,n.generation,CASE n.mode WHEN 'new' THEN 'new' ELSE 'legacy' END,'pending',n.registered_day FROM astra_bonus_profiles26 n JOIN astra_bonus_profiles26 i ON i.telegram_id=NEW.referrer_id WHERE n.telegram_id=NEW.telegram_id AND NEW.referrer_id<>NEW.telegram_id;
END;
-- Snapshot only, never grant money or invent a date. opening is not evidence of a registration award.
INSERT OR IGNORE INTO astra_bonus_profiles26(telegram_id,generation,mode,registered_day,seeded)
 SELECT p.telegram_id,p.generation,'existing',p.registered_day,CASE WHEN EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.telegram_id=p.telegram_id AND l.delta>0 AND l.reason<>'opening' AND unixepoch(l.created_at)>unixepoch()-2592000) THEN 0 ELSE 1 END FROM astra_user_policy p;
INSERT OR IGNORE INTO astra_bonus_referrals26(invitee,inviter,inviter_generation,invitee_generation,mode,status,created_day,confirmed_day)
 SELECT c.invitee,c.referrer,i.generation,n.generation,'legacy',CASE WHEN c.status='paid' THEN 'paid' WHEN c.status='cancelled' OR c.referrer IS NULL THEN 'cancelled' ELSE 'pending' END,c.created_day,c.paid_day FROM astra_referral_contracts c JOIN astra_bonus_profiles26 n ON n.telegram_id=c.invitee LEFT JOIN astra_bonus_profiles26 i ON i.telegram_id=c.referrer WHERE c.mode='legacy';
CREATE TRIGGER IF NOT EXISTS astra_patch_policy_guard26 BEFORE UPDATE ON astra_patch26 WHEN (OLD.start_day IS NOT NULL AND (NEW.start_day IS NULL OR NEW.start_day<>OLD.start_day)) OR(OLD.activated=1 AND NEW.activated<>1) OR NEW.version<>OLD.version BEGIN SELECT RAISE(ABORT,'Patch policy immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_referrer_erasing26 BEFORE DELETE ON astra_users BEGIN
 UPDATE astra_bonus_referrals26 SET inviter=NULL,status=CASE WHEN status='pending' THEN 'cancelled' ELSE status END WHERE inviter=OLD.telegram_id;
 -- Never retain an un-HMACed deleted ID if observable old rights could not be seeded.
 UPDATE astra_patch26 SET unsafe_until=max(unsafe_until,unixepoch()+2592000) WHERE singleton=1 AND EXISTS(SELECT 1 FROM astra_bonus_profiles26 WHERE telegram_id=OLD.telegram_id AND seeded=0) AND EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE telegram_id=OLD.telegram_id AND delta>0 AND reason<>'opening' AND unixepoch(created_at)>unixepoch()-2592000);
END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_erase26 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_bonus_commands26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_days26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_aliases26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_awards26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_referrals26 WHERE invitee=OLD.telegram_id;
 DELETE FROM astra_bonus_profiles26 WHERE telegram_id=OLD.telegram_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_bonus_referral_immutable26 BEFORE UPDATE ON astra_bonus_referrals26 WHEN NEW.invitee<>OLD.invitee OR NEW.invitee_generation<>OLD.invitee_generation OR NEW.inviter_generation IS NOT OLD.inviter_generation OR NEW.mode<>OLD.mode OR NEW.created_day<>OLD.created_day OR(NEW.inviter IS NOT OLD.inviter AND NEW.inviter IS NOT NULL) OR(OLD.status IN('paid','cancelled') AND NEW.status<>OLD.status) BEGIN SELECT RAISE(ABORT,'Original referral contract immutable'); END;
CREATE TABLE IF NOT EXISTS astra_tarot_offers26 (
 offer_id TEXT PRIMARY KEY,telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL,request_key TEXT NOT NULL,
 price INTEGER NOT NULL DEFAULT 5 CHECK(price=5),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(telegram_id,generation,request_key)
);
CREATE TABLE IF NOT EXISTS astra_tarot_purchases26 (
 offer_id TEXT PRIMARY KEY REFERENCES astra_tarot_offers26(offer_id),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 price INTEGER NOT NULL CHECK(price=5),result TEXT NOT NULL CHECK(length(trim(result))>0),delivery TEXT NOT NULL DEFAULT 'pending' CHECK(delivery IN('pending','sending','sent','retry','unknown','rejected')),
 lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tarot_purchases26_owner ON astra_tarot_purchases26(telegram_id,created_at,offer_id);
CREATE TRIGGER IF NOT EXISTS astra_tarot_guard26 BEFORE INSERT ON astra_tarot_purchases26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_tarot_offers26 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id WHERE o.offer_id=NEW.offer_id AND o.telegram_id=NEW.telegram_id AND o.generation=p.generation AND o.price=NEW.price AND u.balance>=NEW.price) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot_post26 AFTER INSERT ON astra_tarot_purchases26 BEGIN
 UPDATE astra_users SET balance=balance-5 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES('tarot26:'||NEW.offer_id,NEW.telegram_id,-5,'tarot:v2');
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot_immutable26 BEFORE UPDATE ON astra_tarot_purchases26 WHEN NEW.offer_id<>OLD.offer_id OR NEW.telegram_id<>OLD.telegram_id OR NEW.price<>OLD.price OR NEW.result<>OLD.result OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Paid Tarot immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_tarot_erase26 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_tarot_purchases26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_tarot_offers26 WHERE telegram_id=OLD.telegram_id;
END;
CREATE TABLE IF NOT EXISTS astra_payment_orders26 (
 order_id TEXT PRIMARY KEY, payload TEXT NOT NULL UNIQUE CHECK(length(CAST(payload AS BLOB))<=128),
 owner_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL, payer_id INTEGER NOT NULL,
 request_key TEXT NOT NULL, package INTEGER NOT NULL, xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 price_version TEXT NOT NULL CHECK(price_version='stars-pack-v2'), scope TEXT NOT NULL CHECK(scope IN ('test','production')),
 terms_version TEXT NOT NULL, retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 180 AND 3650),
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','invoiced','confirmed','credited','refund_requested','refund_in_progress','refunded','needs_review')),
 delivery TEXT NOT NULL DEFAULT 'pending' CHECK(delivery IN ('pending','sending','sent','unknown','failed')),
 invoice_lease TEXT, precheckout_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(payer_id,request_key), CHECK((package=10 AND xtr=10 AND dust=40) OR (package=25 AND xtr=25 AND dust=110) OR (package=50 AND xtr=50 AND dust=240))
);
CREATE INDEX IF NOT EXISTS idx_payment_orders26_owner ON astra_payment_orders26(payer_id,created_at DESC,order_id DESC);
CREATE TABLE IF NOT EXISTS astra_payment_receipts26 (
 charge_id TEXT PRIMARY KEY, charge_hash TEXT NOT NULL UNIQUE CHECK(length(charge_hash)=64), order_id TEXT NOT NULL UNIQUE REFERENCES astra_payment_orders26(order_id),
 payer_id INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency='XTR'), xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('paid','refunded')), credited_dust INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS astra_payment_order_index26 (seq INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL UNIQUE);
INSERT OR IGNORE INTO astra_payment_order_index26(order_id) SELECT order_id FROM astra_payment_orders ORDER BY rowid;
CREATE VIEW IF NOT EXISTS astra_all_orders26 AS SELECT o.*,i.seq AS rowid FROM astra_payment_orders o JOIN astra_payment_order_index26 i USING(order_id) UNION ALL SELECT o.*,i.seq AS rowid FROM astra_payment_orders26 o JOIN astra_payment_order_index26 i USING(order_id);
CREATE VIEW IF NOT EXISTS astra_all_receipts26 AS SELECT * FROM astra_payment_receipts UNION ALL SELECT * FROM astra_payment_receipts26;
CREATE TRIGGER IF NOT EXISTS astra_orders_index_old26 AFTER INSERT ON astra_payment_orders BEGIN INSERT INTO astra_payment_order_index26(order_id) VALUES(NEW.order_id); END;
CREATE TRIGGER IF NOT EXISTS astra_orders_index_new26 AFTER INSERT ON astra_payment_orders26 BEGIN INSERT INTO astra_payment_order_index26(order_id) VALUES(NEW.order_id); END;
CREATE TRIGGER IF NOT EXISTS astra_orders_unindex_old26 AFTER DELETE ON astra_payment_orders BEGIN DELETE FROM astra_payment_order_index26 WHERE order_id=OLD.order_id; END;
CREATE TRIGGER IF NOT EXISTS astra_orders_unindex_new26 AFTER DELETE ON astra_payment_orders26 BEGIN DELETE FROM astra_payment_order_index26 WHERE order_id=OLD.order_id; END;
CREATE TRIGGER IF NOT EXISTS astra_orders_insert26 INSTEAD OF INSERT ON astra_all_orders26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id OR payload=NEW.payload OR (payer_id=NEW.payer_id AND request_key=NEW.request_key)) THEN RAISE(IGNORE) END;
 INSERT INTO astra_payment_orders26(order_id,payload,owner_id,payer_id,request_key,package,xtr,dust,price_version,scope,terms_version,retention_days,status,delivery,invoice_lease,precheckout_id,created_at,updated_at) VALUES(NEW.order_id,NEW.payload,NEW.owner_id,NEW.payer_id,NEW.request_key,NEW.package,NEW.xtr,NEW.dust,NEW.price_version,NEW.scope,NEW.terms_version,NEW.retention_days,coalesce(NEW.status,'created'),coalesce(NEW.delivery,'pending'),NEW.invoice_lease,NEW.precheckout_id,coalesce(NEW.created_at,CURRENT_TIMESTAMP),coalesce(NEW.updated_at,CURRENT_TIMESTAMP));
END;
CREATE TRIGGER IF NOT EXISTS astra_orders_update26 INSTEAD OF UPDATE ON astra_all_orders26 BEGIN
 UPDATE astra_payment_orders SET order_id=NEW.order_id,payload=NEW.payload,owner_id=NEW.owner_id,payer_id=NEW.payer_id,request_key=NEW.request_key,package=NEW.package,xtr=NEW.xtr,dust=NEW.dust,price_version=NEW.price_version,scope=NEW.scope,terms_version=NEW.terms_version,retention_days=NEW.retention_days,status=NEW.status,delivery=NEW.delivery,invoice_lease=NEW.invoice_lease,precheckout_id=NEW.precheckout_id,created_at=NEW.created_at,updated_at=NEW.updated_at WHERE order_id=OLD.order_id;
 UPDATE astra_payment_orders26 SET order_id=NEW.order_id,payload=NEW.payload,owner_id=NEW.owner_id,payer_id=NEW.payer_id,request_key=NEW.request_key,package=NEW.package,xtr=NEW.xtr,dust=NEW.dust,price_version=NEW.price_version,scope=NEW.scope,terms_version=NEW.terms_version,retention_days=NEW.retention_days,status=NEW.status,delivery=NEW.delivery,invoice_lease=NEW.invoice_lease,precheckout_id=NEW.precheckout_id,created_at=NEW.created_at,updated_at=NEW.updated_at WHERE order_id=OLD.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_orders_delete26 INSTEAD OF DELETE ON astra_all_orders26 BEGIN
 DELETE FROM astra_payment_orders WHERE order_id=OLD.order_id;
 DELETE FROM astra_payment_orders26 WHERE order_id=OLD.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_receipts_insert26 INSTEAD OF INSERT ON astra_all_receipts26 BEGIN
 INSERT OR IGNORE INTO astra_payment_receipts(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust,created_at) SELECT NEW.charge_id,NEW.charge_hash,NEW.order_id,NEW.payer_id,NEW.currency,NEW.xtr,NEW.dust,NEW.kind,coalesce(NEW.credited_dust,0),coalesce(NEW.created_at,CURRENT_TIMESTAMP) WHERE EXISTS(SELECT 1 FROM astra_payment_orders WHERE order_id=NEW.order_id);
 INSERT OR IGNORE INTO astra_payment_receipts26(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust,created_at) SELECT NEW.charge_id,NEW.charge_hash,NEW.order_id,NEW.payer_id,NEW.currency,NEW.xtr,NEW.dust,NEW.kind,coalesce(NEW.credited_dust,0),coalesce(NEW.created_at,CURRENT_TIMESTAMP) WHERE EXISTS(SELECT 1 FROM astra_payment_orders26 WHERE order_id=NEW.order_id);
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_guard26 BEFORE INSERT ON astra_payment_receipts26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.credited_dust<>CASE WHEN NEW.kind='paid' AND NOT EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) AND EXISTS(SELECT 1 FROM astra_all_orders26 o JOIN astra_users u ON u.telegram_id=o.owner_id WHERE o.order_id=NEW.order_id AND o.owner_id=NEW.payer_id) THEN NEW.dust ELSE 0 END OR NOT EXISTS(SELECT 1 FROM astra_all_orders26 o WHERE o.order_id=NEW.order_id AND o.payer_id=NEW.payer_id AND o.xtr=NEW.xtr AND o.dust=NEW.dust AND NEW.currency='XTR') THEN RAISE(ABORT,'Payment snapshot mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_post26 AFTER INSERT ON astra_payment_receipts26 BEGIN
 INSERT INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,NEW.dust,NEW.credited_dust,scope,CASE WHEN NEW.kind='refunded' THEN 1 ELSE 0 END FROM astra_all_orders26 WHERE order_id=NEW.order_id;
 UPDATE astra_users SET balance=balance+(SELECT credited_dust FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash) WHERE telegram_id=NEW.payer_id AND EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id AND owner_id=NEW.payer_id);
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
 SELECT 'stars:'||NEW.charge_hash,NEW.payer_id,credited_dust,'payment:stars' FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash AND credited_dust>0;
 UPDATE astra_all_orders26 SET status=CASE WHEN NEW.kind='refunded' OR EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) THEN 'refunded' WHEN (SELECT credited_dust FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash)>0 THEN 'credited' ELSE 'needs_review' END,updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_immutable26 BEFORE UPDATE ON astra_payment_receipts26 BEGIN SELECT RAISE(ABORT,'Payment proof immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_payment_order_snapshot26 BEFORE UPDATE ON astra_payment_orders26 WHEN NEW.order_id<>OLD.order_id OR NEW.payload<>OLD.payload OR NEW.payer_id<>OLD.payer_id OR NEW.package<>OLD.package OR NEW.xtr<>OLD.xtr OR NEW.dust<>OLD.dust OR NEW.scope<>OLD.scope OR NEW.terms_version<>OLD.terms_version OR NEW.retention_days<>OLD.retention_days OR NEW.request_key<>OLD.request_key OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Order price snapshot immutable'); END;
DROP TRIGGER IF EXISTS astra_refund_notice_guard;
DROP TRIGGER IF EXISTS astra_refund_notice_post;
CREATE TRIGGER IF NOT EXISTS astra_refund_notice_guard BEFORE INSERT ON astra_external_refunds BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash AND refunded=1) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_all_receipts26 r WHERE r.charge_hash=NEW.charge_hash AND (r.charge_id<>NEW.charge_id OR r.payer_id<>NEW.payer_id OR r.currency<>NEW.currency OR r.xtr<>NEW.xtr OR r.order_id<>NEW.order_id)) THEN RAISE(ABORT,'Refund proof mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash) AND NOT EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id AND payer_id=NEW.payer_id AND xtr=NEW.xtr) AND NOT EXISTS(SELECT 1 FROM astra_payment_anomalies WHERE charge_hash=NEW.charge_hash AND payer_id=NEW.payer_id AND currency=NEW.currency AND xtr=NEW.xtr) AND NOT EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash AND xtr=NEW.xtr AND scope=(SELECT payment_scope FROM astra_policy WHERE singleton=1)) THEN RAISE(ABORT,'Refund needs known proof') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_refund_notice_post AFTER INSERT ON astra_external_refunds BEGIN
 INSERT OR IGNORE INTO astra_all_receipts26(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind)
 SELECT NEW.charge_id,NEW.charge_hash,o.order_id,NEW.payer_id,NEW.currency,NEW.xtr,o.dust,'refunded' FROM astra_all_orders26 o WHERE o.order_id=NEW.order_id AND NOT EXISTS(SELECT 1 FROM astra_all_receipts26 WHERE order_id=o.order_id);
 INSERT INTO astra_refund_settlements(charge_hash,payer_id,reversed_dust,removed,debt_added)
 SELECT NEW.charge_hash,NEW.payer_id,coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0),min(coalesce(u.balance,0),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)-min(coalesce(u.balance,0),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)) FROM (SELECT 1) d LEFT JOIN astra_all_receipts26 r ON r.charge_hash=NEW.charge_hash LEFT JOIN astra_users u ON u.telegram_id=NEW.payer_id LEFT JOIN astra_payment_tombstones t ON t.charge_hash=NEW.charge_hash;
 INSERT OR IGNORE INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,0,0,scope,1 FROM astra_payment_anomalies WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_payment_tombstones SET refunded=1 WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_all_orders26 SET status='refunded',updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id AND EXISTS(SELECT 1 FROM astra_all_receipts26 WHERE order_id=NEW.order_id AND charge_hash=NEW.charge_hash);
 UPDATE astra_refund_requests SET status='refunded',lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_payment_anomalies SET status='refunded' WHERE charge_hash=NEW.charge_hash;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_purge26 BEFORE DELETE ON astra_payment_orders26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_refund_accounts WHERE payer_id=OLD.payer_id AND debt>0) AND EXISTS(SELECT 1 FROM astra_payment_receipts26 WHERE order_id=OLD.order_id) THEN RAISE(ABORT,'Unresolved debt blocks payment erasure') END;
 DELETE FROM astra_refund_requests WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_refund_settlements WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_external_refunds WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_anomalies WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_receipts26 WHERE order_id=OLD.order_id;
END;
DROP TRIGGER IF EXISTS astra_payment_purge_closed;
CREATE TRIGGER IF NOT EXISTS astra_payment_purge_closed AFTER DELETE ON astra_payment_orders
 WHEN NOT EXISTS(SELECT 1 FROM astra_all_orders26 WHERE payer_id=OLD.payer_id)
 AND EXISTS(SELECT 1 FROM astra_refund_accounts a WHERE a.payer_id=OLD.payer_id AND a.debt=0 AND a.updated_at<datetime('now','-'||(SELECT retention_days FROM astra_policy WHERE singleton=1)||' days')) BEGIN
 DELETE FROM astra_refund_accounts WHERE payer_id=OLD.payer_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_purge_closed26 AFTER DELETE ON astra_payment_orders26
 WHEN NOT EXISTS(SELECT 1 FROM astra_all_orders26 WHERE payer_id=OLD.payer_id)
 AND EXISTS(SELECT 1 FROM astra_refund_accounts a WHERE a.payer_id=OLD.payer_id AND a.debt=0 AND a.updated_at<datetime('now','-'||(SELECT retention_days FROM astra_policy WHERE singleton=1)||' days')) BEGIN
 DELETE FROM astra_refund_accounts WHERE payer_id=OLD.payer_id;
END;
DROP TRIGGER IF EXISTS astra_refund_account_erasing;
CREATE TRIGGER IF NOT EXISTS astra_refund_account_erasing BEFORE DELETE ON astra_refund_accounts BEGIN
 SELECT CASE WHEN OLD.debt<>0 OR EXISTS(SELECT 1 FROM astra_all_orders26 WHERE payer_id=OLD.payer_id) OR OLD.updated_at>=datetime('now','-'||(SELECT retention_days FROM astra_policy WHERE singleton=1)||' days') THEN RAISE(ABORT,'Refund account still required') END;
 DELETE FROM astra_refund_requests WHERE charge_hash IN (SELECT charge_hash FROM astra_external_refunds WHERE payer_id=OLD.payer_id);
 DELETE FROM astra_refund_settlements WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_external_refunds WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_payment_anomalies WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_debt_repayments WHERE payer_id=OLD.payer_id;
END;

CREATE TRIGGER IF NOT EXISTS astra_payment_erase26 AFTER DELETE ON astra_users BEGIN
 UPDATE astra_payment_orders26 SET owner_id=NULL WHERE payer_id=OLD.telegram_id;
 DELETE FROM astra_payment_orders26 WHERE payer_id=OLD.telegram_id AND NOT EXISTS(SELECT 1 FROM astra_payment_receipts26 r WHERE r.order_id=astra_payment_orders26.order_id);
END;
UPDATE astra_patch26 SET migration_done=1 WHERE singleton=1;
