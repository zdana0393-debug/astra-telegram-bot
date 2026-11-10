-- Aggregate/read-only. Candidate expects new catalogue OFF. No personal data.
WITH expected(name,type,sql) AS (VALUES ('astra_activity_days','table','CREATE TABLE astra_activity_days (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND day GLOB ''[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'' AND date(day,''+0 days'') IS NOT NULL AND date(day,''+0 days'')=day),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 source TEXT NOT NULL CHECK(source IN (''message'',''callback'')),
 PRIMARY KEY(telegram_id,day)
)'),('astra_activity_erase','trigger','CREATE TRIGGER astra_activity_erase AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_activity_days WHERE telegram_id=OLD.telegram_id;
END'),('astra_activity_guard','trigger','CREATE TRIGGER astra_activity_guard BEFORE INSERT ON astra_activity_days BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id
   AND zodiac IN (''aries'',''taurus'',''gemini'',''cancer'',''leo'',''virgo'',''libra'',''scorpio'',''sagittarius'',''capricorn'',''aquarius'',''pisces''))
 THEN RAISE(IGNORE) END;
END'),('astra_all_orders26','view','CREATE VIEW astra_all_orders26 AS SELECT o.*,i.seq AS rowid FROM astra_payment_orders o JOIN astra_payment_order_index26 i USING(order_id) UNION ALL SELECT o.*,i.seq AS rowid FROM astra_payment_orders26 o JOIN astra_payment_order_index26 i USING(order_id)'),('astra_all_receipts26','view','CREATE VIEW astra_all_receipts26 AS SELECT * FROM astra_payment_receipts UNION ALL SELECT * FROM astra_payment_receipts26'),('astra_bonus_aliases26','table','CREATE TABLE astra_bonus_aliases26 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,key_id TEXT NOT NULL REFERENCES astra_bonus_keys26(key_id),
 owner_hash TEXT NOT NULL CHECK(length(owner_hash)=64),invitee_hash TEXT NOT NULL CHECK(length(invitee_hash)=64),PRIMARY KEY(telegram_id,key_id)
)'),('astra_bonus_award_guard26','trigger','CREATE TRIGGER astra_bonus_award_guard26 BEFORE INSERT ON astra_bonus_awards26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1 AND notice_approved=1 AND active_key_id=NEW.key_id AND unsafe_until<=NEW.awarded_at)
 OR NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 r JOIN astra_users u USING(telegram_id) WHERE r.telegram_id=NEW.telegram_id AND r.generation=NEW.generation AND r.seeded=1)
 OR NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 s WHERE s.generation=NEW.subject_generation AND s.seeded=1)
 THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_bonus_keys26 k WHERE (k.key_id=NEW.key_id OR EXISTS(SELECT 1 FROM astra_bonus_fences26 f WHERE f.key_id=k.key_id AND f.expires_at>NEW.awarded_at)) AND NOT EXISTS(SELECT 1 FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) WHERE s.generation=NEW.subject_generation AND a.key_id=k.key_id)) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN(''initial'',''daily'',''first3'',''weekly'',''thirty'',''channel'',''referrer'',''invitee'',''inviter_channel'') AND NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1 AND enabled=1 AND activated=1 AND NEW.day>=start_day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind NOT IN(''daily'',''first3'',''weekly'',''thirty'') AND NOT EXISTS(SELECT 1 FROM astra_bonus_commands26 c JOIN astra_bonus_profiles26 s ON s.telegram_id=c.telegram_id WHERE s.generation=NEW.subject_generation AND ((NEW.kind IN(''initial'',''legacy_initial'') AND c.kind=''initial'') OR (NEW.kind=''gpt6'' AND c.kind=''gpt6'') OR (NEW.kind IN(''channel'',''legacy_channel'') AND c.kind=''channel'' AND c.verified_channel IS NOT NULL) OR (NEW.kind=''legacy_daily'' AND c.kind=''legacy_daily'') OR (NEW.kind IN(''referrer'',''legacy_referrer'',''invitee'') AND c.kind=''referral'') OR (NEW.kind=''inviter_channel'' AND c.kind IN(''referral'',''channel'')))) THEN RAISE(ABORT,''Award requires command envelope'') END;
 SELECT CASE WHEN NEW.award_id<>''grant26:''||NEW.generation||'':''||NEW.kind||'':''||NEW.reference THEN RAISE(ABORT,''Invalid award key'') END;
 SELECT CASE WHEN (NEW.kind IN(''referrer'',''legacy_referrer'',''invitee'',''inviter_channel'') AND NEW.subject_generation<>NEW.reference) OR (NEW.kind NOT IN(''referrer'',''legacy_referrer'',''invitee'',''inviter_channel'') AND NEW.subject_generation<>NEW.generation) OR (NEW.kind IN(''daily'',''legacy_daily'',''weekly'') AND NEW.reference<>NEW.day) OR (NEW.kind NOT IN(''referrer'',''legacy_referrer'',''invitee'',''inviter_channel'',''daily'',''legacy_daily'',''weekly'') AND NEW.reference<>''once'') THEN RAISE(ABORT,''Invalid award subject/reference'') END;
 SELECT CASE WHEN NEW.kind IN(''initial'',''legacy_initial'') AND NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 WHERE generation=NEW.generation AND mode=CASE NEW.kind WHEN ''initial'' THEN ''new'' ELSE ''legacy'' END) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind=''gpt6'' AND EXISTS(SELECT 1 FROM astra_shell_rewards WHERE telegram_id=NEW.telegram_id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN(''channel'',''legacy_channel'') AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND zodiac IS NOT NULL AND channel_rewarded=0) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN(''legacy_daily'',''legacy_channel'') AND EXISTS(SELECT 1 FROM astra_patch26 WHERE activated=1 OR (start_day IS NOT NULL AND NEW.day>=start_day)) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind=''legacy_daily'' AND EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND last_gift_day=NEW.day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN(''daily'',''first3'',''weekly'',''thirty'') AND NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day) THEN RAISE(ABORT,''Award requires a policy day'') END;
 SELECT CASE WHEN NEW.kind=''first3'' AND (NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak>=3) OR EXISTS(SELECT 1 FROM astra_reward_claims WHERE telegram_id=NEW.telegram_id AND kind=''first3'')) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind=''weekly'' AND NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak%7=0) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind=''thirty'' AND ((SELECT count(*) FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id)<30 OR EXISTS(SELECT 1 FROM astra_reward_claims WHERE telegram_id=NEW.telegram_id AND kind=''thirty'')) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN(''referrer'',''legacy_referrer'',''invitee'') AND NOT EXISTS(SELECT 1 FROM astra_bonus_referrals26 c JOIN astra_users i ON i.telegram_id=c.invitee WHERE c.invitee_generation=NEW.reference AND c.status=''pending'' AND i.zodiac IS NOT NULL AND ((NEW.kind IN(''referrer'',''legacy_referrer'') AND c.inviter=NEW.telegram_id AND c.inviter_generation=NEW.generation) OR (NEW.kind=''invitee'' AND c.invitee=NEW.telegram_id AND c.mode=''new''))) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind=''inviter_channel'' AND NOT EXISTS(SELECT 1 FROM astra_bonus_referrals26 c JOIN astra_bonus_awards26 a ON a.generation=c.invitee_generation AND a.kind=''channel'' AND a.amount=15 WHERE c.invitee_generation=NEW.reference AND c.status=''paid'' AND c.inviter=NEW.telegram_id AND c.inviter_generation=NEW.generation) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) JOIN astra_bonus_fences26 f ON f.key_id=a.key_id AND f.subject_hash=CASE WHEN CASE NEW.kind WHEN ''legacy_initial'' THEN ''initial'' WHEN ''legacy_daily'' THEN ''daily'' WHEN ''legacy_channel'' THEN ''channel'' WHEN ''legacy_referrer'' THEN ''inviter_referral'' WHEN ''referrer'' THEN ''inviter_referral'' WHEN ''invitee'' THEN ''invitee_welcome'' ELSE NEW.kind END IN(''inviter_referral'',''invitee_welcome'',''inviter_channel'') THEN a.invitee_hash ELSE a.owner_hash END WHERE s.generation=NEW.subject_generation AND f.purpose=CASE NEW.kind WHEN ''legacy_initial'' THEN ''initial'' WHEN ''legacy_daily'' THEN ''daily'' WHEN ''legacy_channel'' THEN ''channel'' WHEN ''legacy_referrer'' THEN ''inviter_referral'' WHEN ''referrer'' THEN ''inviter_referral'' WHEN ''invitee'' THEN ''invitee_welcome'' ELSE NEW.kind END AND f.reference=CASE WHEN NEW.kind IN(''daily'',''legacy_daily'',''weekly'') THEN NEW.day ELSE ''once'' END AND f.expires_at>NEW.awarded_at) THEN RAISE(IGNORE) END;
END'),('astra_bonus_award_immutable26','trigger','CREATE TRIGGER astra_bonus_award_immutable26 BEFORE UPDATE ON astra_bonus_awards26 BEGIN SELECT RAISE(ABORT,''Award immutable''); END'),('astra_bonus_award_post26','trigger','CREATE TRIGGER astra_bonus_award_post26 AFTER INSERT ON astra_bonus_awards26 BEGIN
 DELETE FROM astra_bonus_fences26 WHERE key_id=NEW.key_id AND purpose=CASE NEW.kind WHEN ''legacy_initial'' THEN ''initial'' WHEN ''legacy_daily'' THEN ''daily'' WHEN ''legacy_channel'' THEN ''channel'' WHEN ''legacy_referrer'' THEN ''inviter_referral'' WHEN ''referrer'' THEN ''inviter_referral'' WHEN ''invitee'' THEN ''invitee_welcome'' ELSE NEW.kind END AND reference=CASE WHEN NEW.kind IN(''daily'',''legacy_daily'',''weekly'') THEN NEW.day ELSE ''once'' END AND expires_at<=NEW.awarded_at AND subject_hash IN(SELECT CASE WHEN CASE NEW.kind WHEN ''legacy_initial'' THEN ''initial'' WHEN ''legacy_daily'' THEN ''daily'' WHEN ''legacy_channel'' THEN ''channel'' WHEN ''legacy_referrer'' THEN ''inviter_referral'' WHEN ''referrer'' THEN ''inviter_referral'' WHEN ''invitee'' THEN ''invitee_welcome'' ELSE NEW.kind END IN(''inviter_referral'',''invitee_welcome'',''inviter_channel'') THEN a.invitee_hash ELSE a.owner_hash END FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) WHERE s.generation=NEW.subject_generation AND a.key_id=NEW.key_id);
 INSERT INTO astra_bonus_fences26(key_id,subject_hash,purpose,reference,awarded_at,expires_at)
 SELECT NEW.key_id,CASE WHEN CASE NEW.kind WHEN ''legacy_initial'' THEN ''initial'' WHEN ''legacy_daily'' THEN ''daily'' WHEN ''legacy_channel'' THEN ''channel'' WHEN ''legacy_referrer'' THEN ''inviter_referral'' WHEN ''referrer'' THEN ''inviter_referral'' WHEN ''invitee'' THEN ''invitee_welcome'' ELSE NEW.kind END IN(''inviter_referral'',''invitee_welcome'',''inviter_channel'') THEN a.invitee_hash ELSE a.owner_hash END,CASE NEW.kind WHEN ''legacy_initial'' THEN ''initial'' WHEN ''legacy_daily'' THEN ''daily'' WHEN ''legacy_channel'' THEN ''channel'' WHEN ''legacy_referrer'' THEN ''inviter_referral'' WHEN ''referrer'' THEN ''inviter_referral'' WHEN ''invitee'' THEN ''invitee_welcome'' ELSE NEW.kind END,CASE WHEN NEW.kind IN(''daily'',''legacy_daily'',''weekly'') THEN NEW.day ELSE ''once'' END,NEW.awarded_at,NEW.awarded_at+2592000 FROM astra_bonus_aliases26 a JOIN astra_bonus_profiles26 s USING(telegram_id) WHERE s.generation=NEW.subject_generation AND a.key_id=NEW.key_id;
 SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,''Award fence not committed'') END;
 UPDATE astra_users SET balance=balance+NEW.amount,channel_rewarded=CASE WHEN NEW.kind IN(''channel'',''legacy_channel'') THEN 1 ELSE channel_rewarded END,last_gift_day=CASE WHEN NEW.kind=''legacy_daily'' THEN NEW.day ELSE last_gift_day END WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(NEW.award_id,NEW.telegram_id,NEW.amount,''reward:v3:''||NEW.kind);
 INSERT OR IGNORE INTO astra_shell_rewards(telegram_id,code) SELECT NEW.telegram_id,''gpt6'' WHERE NEW.kind=''gpt6'';
END'),('astra_bonus_awards26','table','CREATE TABLE astra_bonus_awards26 (
 award_id TEXT PRIMARY KEY,telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL,
 subject_generation TEXT NOT NULL,kind TEXT NOT NULL,day TEXT NOT NULL,amount INTEGER NOT NULL,key_id TEXT NOT NULL,reference TEXT NOT NULL,awarded_at INTEGER NOT NULL,
 UNIQUE(generation,kind,reference),CHECK(length(day)=10 AND date(day,''+0 days'')=day),
 CHECK((kind IN(''initial'',''gpt6'',''legacy_channel'',''legacy_referrer'',''inviter_channel'') AND amount=5) OR (kind=''legacy_initial'' AND amount=2) OR
 (kind=''daily'' AND amount=2) OR(kind=''legacy_daily'' AND amount=1) OR(kind IN(''first3'',''invitee'') AND amount=3) OR(kind=''weekly'' AND amount=4) OR(kind=''thirty'' AND amount=6) OR(kind=''channel'' AND amount=15) OR(kind=''referrer'' AND amount=10))
)'),('astra_bonus_command_guard26','trigger','CREATE TRIGGER astra_bonus_command_guard26 BEFORE INSERT ON astra_bonus_commands26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE notice_approved=1 AND active_key_id IS NOT NULL AND unsafe_until<=NEW.awarded_at) OR NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 WHERE telegram_id=NEW.telegram_id AND seeded=1) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind=''channel'' AND (NEW.verified_channel IS NULL OR length(NEW.verified_channel)<6) THEN RAISE(ABORT,''Verified membership required'') END;
 -- Both referral credits must be eligible before either is posted. One existing right blocks the whole new pair.
 SELECT CASE WHEN NEW.kind=''referral'' AND (NOT EXISTS(SELECT 1 FROM astra_bonus_referrals26 c JOIN astra_bonus_profiles26 p ON p.telegram_id=c.inviter AND p.generation=c.inviter_generation JOIN astra_users u ON u.telegram_id=c.invitee WHERE c.invitee=NEW.telegram_id AND c.status=''pending'' AND p.seeded=1 AND u.zodiac IS NOT NULL)
 OR EXISTS(SELECT 1 FROM astra_bonus_aliases26 a JOIN astra_bonus_fences26 f ON f.key_id=a.key_id AND f.subject_hash=a.invitee_hash WHERE a.telegram_id=NEW.telegram_id AND f.purpose IN(''inviter_referral'',''invitee_welcome'') AND f.reference=''once'' AND f.expires_at>NEW.awarded_at)) THEN RAISE(IGNORE) END;
END'),('astra_bonus_command_post26','trigger','CREATE TRIGGER astra_bonus_command_post26 AFTER INSERT ON astra_bonus_commands26 BEGIN
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':initial:''||''once'',r.telegram_id,r.generation,r.generation,''initial'',NEW.day,5,p.active_key_id,''once'',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind=''initial'' AND r.mode=''new'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':legacy_initial:''||''once'',r.telegram_id,r.generation,r.generation,''legacy_initial'',NEW.day,2,p.active_key_id,''once'',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind=''initial'' AND r.mode=''legacy'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':gpt6:''||''once'',r.telegram_id,r.generation,r.generation,''gpt6'',NEW.day,5,p.active_key_id,''once'',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind=''gpt6'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':legacy_daily:''||NEW.day,r.telegram_id,r.generation,r.generation,''legacy_daily'',NEW.day,1,p.active_key_id,NEW.day,NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind=''legacy_daily'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':channel:''||''once'',r.telegram_id,r.generation,r.generation,''channel'',NEW.day,15,p.active_key_id,''once'',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind=''channel'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':legacy_channel:''||''once'',r.telegram_id,r.generation,r.generation,''legacy_channel'',NEW.day,5,p.active_key_id,''once'',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind=''channel'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':referrer:''||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),''referrer'',NEW.day,10,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=(SELECT inviter FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND (NEW.kind=''referral'' AND (SELECT mode FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id)=''new'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':legacy_referrer:''||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),''legacy_referrer'',NEW.day,5,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=(SELECT inviter FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND (NEW.kind=''referral'' AND (SELECT mode FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id)=''legacy'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':invitee:''||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),''invitee'',NEW.day,3,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.kind=''referral'' AND (SELECT mode FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id)=''new'');

 SELECT CASE WHEN NEW.kind=''referral'' AND EXISTS(SELECT 1 FROM astra_bonus_referrals26 c WHERE c.invitee=NEW.telegram_id AND c.mode=''new'') AND ((SELECT count(*) FROM astra_bonus_awards26 a WHERE a.reference=(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND a.kind IN(''referrer'',''invitee'')) NOT IN(0,2)) THEN RAISE(ABORT,''Referral pair incomplete'') END;
 UPDATE astra_bonus_referrals26 SET status=''paid'',confirmed_day=NEW.day WHERE invitee=NEW.telegram_id AND NEW.kind=''referral'' AND EXISTS(SELECT 1 FROM astra_bonus_awards26 a WHERE a.reference=invitee_generation AND a.kind IN(''referrer'',''legacy_referrer''));
 UPDATE astra_users SET referral_rewarded=1 WHERE telegram_id=NEW.telegram_id AND EXISTS(SELECT 1 FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id AND status=''paid'');
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':inviter_channel:''||(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),r.telegram_id,r.generation,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),''inviter_channel'',NEW.day,5,p.active_key_id,(SELECT invitee_generation FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id),NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=(SELECT inviter FROM astra_bonus_referrals26 WHERE invitee=NEW.telegram_id) AND (NEW.kind IN(''channel'',''referral''));
 DELETE FROM astra_bonus_commands26 WHERE command_id=NEW.command_id;
END'),('astra_bonus_commands26','table','CREATE TABLE astra_bonus_commands26 (
 command_id TEXT PRIMARY KEY,telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN(''initial'',''gpt6'',''referral'',''channel'',''legacy_daily'')),day TEXT NOT NULL,awarded_at INTEGER NOT NULL,verified_channel TEXT
)'),('astra_bonus_day_guard26','trigger','CREATE TRIGGER astra_bonus_day_guard26 BEFORE INSERT ON astra_bonus_days26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE enabled=1 AND activated=1 AND notice_approved=1 AND NEW.day>=start_day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_policy_events e JOIN astra_users u ON u.telegram_id=e.telegram_id WHERE e.update_id=NEW.event_id AND e.telegram_id=NEW.telegram_id AND e.day=NEW.day AND e.legacy=0 AND u.zodiac IS NOT NULL) THEN RAISE(ABORT,''Durable private event required'') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day>NEW.day) AND NOT EXISTS(SELECT 1 FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=NEW.day) THEN RAISE(ABORT,''Out-of-order day'') END;
 SELECT CASE WHEN NEW.streak<>coalesce((SELECT streak FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id AND day=date(NEW.day,''-1 day'')),0)+1 THEN RAISE(ABORT,''Invalid streak'') END;
END'),('astra_bonus_day_immutable26','trigger','CREATE TRIGGER astra_bonus_day_immutable26 BEFORE UPDATE ON astra_bonus_days26 BEGIN SELECT RAISE(ABORT,''Day immutable''); END'),('astra_bonus_day_post26','trigger','CREATE TRIGGER astra_bonus_day_post26 AFTER INSERT ON astra_bonus_days26 BEGIN
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':daily:''||NEW.day,r.telegram_id,r.generation,r.generation,''daily'',NEW.day,2,p.active_key_id,NEW.day,NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (1);
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':first3:''||''once'',r.telegram_id,r.generation,r.generation,''first3'',NEW.day,3,p.active_key_id,''once'',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.streak>=3);
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':weekly:''||NEW.day,r.telegram_id,r.generation,r.generation,''weekly'',NEW.day,4,p.active_key_id,NEW.day,NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND (NEW.streak%7=0);
INSERT OR IGNORE INTO astra_bonus_awards26(award_id,telegram_id,generation,subject_generation,kind,day,amount,key_id,reference,awarded_at)
 SELECT ''grant26:''||r.generation||'':thirty:''||''once'',r.telegram_id,r.generation,r.generation,''thirty'',NEW.day,6,p.active_key_id,''once'',NEW.awarded_at
 FROM astra_bonus_profiles26 r JOIN astra_patch26 p ON p.singleton=1 WHERE r.telegram_id=NEW.telegram_id AND ((SELECT count(*) FROM astra_bonus_days26 WHERE telegram_id=NEW.telegram_id)>=30);
END'),('astra_bonus_days26','table','CREATE TABLE astra_bonus_days26 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,day TEXT NOT NULL,streak INTEGER NOT NULL CHECK(streak>0),
 event_id INTEGER NOT NULL REFERENCES astra_policy_events(update_id),awarded_at INTEGER NOT NULL,PRIMARY KEY(telegram_id,day),CHECK(length(day)=10 AND date(day,''+0 days'')=day)
)'),('astra_bonus_erase26','trigger','CREATE TRIGGER astra_bonus_erase26 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_bonus_commands26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_days26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_aliases26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_awards26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_bonus_referrals26 WHERE invitee=OLD.telegram_id;
 DELETE FROM astra_bonus_profiles26 WHERE telegram_id=OLD.telegram_id;
END'),('astra_bonus_fences26','table','CREATE TABLE astra_bonus_fences26 (
 key_id TEXT NOT NULL REFERENCES astra_bonus_keys26(key_id),subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
 purpose TEXT NOT NULL CHECK(purpose IN(''initial'',''daily'',''first3'',''weekly'',''thirty'',''gpt6'',''channel'',''invitee_welcome'',''inviter_referral'',''inviter_channel'')),
 reference TEXT NOT NULL,awarded_at INTEGER NOT NULL,expires_at INTEGER NOT NULL CHECK(expires_at=awarded_at+2592000),
 PRIMARY KEY(key_id,subject_hash,purpose,reference)
)'),('astra_bonus_keys26','table','CREATE TABLE astra_bonus_keys26 (key_id TEXT PRIMARY KEY,check_hmac TEXT NOT NULL CHECK(length(check_hmac)=64),added_at INTEGER NOT NULL)'),('astra_bonus_profiles26','table','CREATE TABLE astra_bonus_profiles26 (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL UNIQUE,
 mode TEXT NOT NULL CHECK(mode IN(''existing'',''legacy'',''new'')),registered_day TEXT NOT NULL,seeded INTEGER NOT NULL DEFAULT 0 CHECK(seeded IN(0,1)),seed_cursor INTEGER NOT NULL DEFAULT 0
)'),('astra_bonus_referral_immutable26','trigger','CREATE TRIGGER astra_bonus_referral_immutable26 BEFORE UPDATE ON astra_bonus_referrals26 WHEN NEW.invitee<>OLD.invitee OR NEW.invitee_generation<>OLD.invitee_generation OR NEW.inviter_generation IS NOT OLD.inviter_generation OR NEW.mode<>OLD.mode OR NEW.created_day<>OLD.created_day OR(NEW.inviter IS NOT OLD.inviter AND NEW.inviter IS NOT NULL) OR(OLD.status IN(''paid'',''cancelled'') AND NEW.status<>OLD.status) BEGIN SELECT RAISE(ABORT,''Original referral contract immutable''); END'),('astra_bonus_referrals26','table','CREATE TABLE astra_bonus_referrals26 (
 invitee INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,inviter INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,
 inviter_generation TEXT,invitee_generation TEXT NOT NULL UNIQUE,mode TEXT NOT NULL CHECK(mode IN(''legacy'',''new'')),
 status TEXT NOT NULL CHECK(status IN(''pending'',''paid'',''cancelled'')),created_day TEXT NOT NULL,confirmed_day TEXT,CHECK(inviter IS NULL OR inviter<>invitee)
)'),('astra_bonus_referrer_erasing26','trigger','CREATE TRIGGER astra_bonus_referrer_erasing26 BEFORE DELETE ON astra_users BEGIN
 UPDATE astra_bonus_referrals26 SET inviter=NULL,status=CASE WHEN status=''pending'' THEN ''cancelled'' ELSE status END WHERE inviter=OLD.telegram_id;
 -- Never retain an un-HMACed deleted ID if observable old rights could not be seeded.
 UPDATE astra_patch26 SET unsafe_until=max(unsafe_until,unixepoch()+2592000) WHERE singleton=1 AND EXISTS(SELECT 1 FROM astra_bonus_profiles26 WHERE telegram_id=OLD.telegram_id AND seeded=0) AND EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE telegram_id=OLD.telegram_id AND delta>0 AND reason<>''opening'' AND unixepoch(created_at)>unixepoch()-2592000);
END'),('astra_broadcast_erase03','trigger','CREATE TRIGGER astra_broadcast_erase03 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_broadcast_outbox03 WHERE telegram_id=OLD.telegram_id;
END'),('astra_broadcast_guard03','trigger','CREATE TRIGGER astra_broadcast_guard03 BEFORE INSERT ON astra_broadcast_outbox03 BEGIN
 SELECT CASE WHEN NEW.state<>''sending'' OR NEW.attempts<>1 THEN RAISE(ABORT,''New broadcast starts with one sending attempt'') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_broadcast_jobs b WHERE b.telegram_id=NEW.telegram_id AND b.day=NEW.day)
  AND NOT EXISTS(SELECT 1 FROM astra_broadcast_outbox03 q WHERE q.telegram_id=NEW.telegram_id AND q.day=NEW.day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND u.zodiac=NEW.sign AND u.notifications_enabled=1 AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<>NEW.day)) THEN RAISE(IGNORE) END;
END'),('astra_broadcast_jobs','table','CREATE TABLE astra_broadcast_jobs (
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  delivery TEXT NOT NULL DEFAULT ''sending'',
  PRIMARY KEY(telegram_id,day)
)'),('astra_broadcast_legacy_guard03','trigger','CREATE TRIGGER astra_broadcast_legacy_guard03 BEFORE INSERT ON astra_broadcast_jobs
 WHEN NOT EXISTS(SELECT 1 FROM astra_broadcast_outbox03 q WHERE q.telegram_id=NEW.telegram_id AND q.day=NEW.day AND q.state=''sending'')
 BEGIN SELECT RAISE(IGNORE); END'),('astra_broadcast_marker03','trigger','CREATE TRIGGER astra_broadcast_marker03 AFTER INSERT ON astra_broadcast_outbox03 BEGIN
 INSERT INTO astra_broadcast_jobs(telegram_id,day,delivery) VALUES(NEW.telegram_id,NEW.day,''sending'');
END'),('astra_broadcast_outbox03','table','CREATE TABLE astra_broadcast_outbox03 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,day TEXT NOT NULL,
 generation TEXT NOT NULL,sign TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN(''sending'',''sent'',''retry'',''blocked'',''failed'',''unknown'',''cancelled'',''expired'')),
 attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 3),token TEXT NOT NULL,
 not_before INTEGER NOT NULL DEFAULT 0,last_try_at INTEGER NOT NULL,parts_sent INTEGER NOT NULL DEFAULT 0 CHECK(parts_sent BETWEEN 0 AND 2),
 last_code INTEGER,last_reason TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(telegram_id,day),
 CHECK(length(day)=10 AND date(day,''+0 days'')=day)
)'),('astra_broadcast_purge03','trigger','CREATE TRIGGER astra_broadcast_purge03 BEFORE DELETE ON astra_broadcast_jobs BEGIN
 DELETE FROM astra_broadcast_outbox03 WHERE telegram_id=OLD.telegram_id AND day=OLD.day;
END'),('astra_broadcast_runtime03','table','CREATE TABLE astra_broadcast_runtime03 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
 cooldown_until INTEGER NOT NULL DEFAULT 0,migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1))
)'),('astra_broadcast_sync03','trigger','CREATE TRIGGER astra_broadcast_sync03 AFTER UPDATE ON astra_broadcast_outbox03 BEGIN
 UPDATE astra_broadcast_jobs SET delivery=CASE WHEN NEW.state IN(''blocked'',''failed'') THEN ''rejected'' ELSE NEW.state END WHERE telegram_id=NEW.telegram_id AND day=NEW.day;
 UPDATE astra_users SET last_broadcast_day=NEW.day WHERE telegram_id=NEW.telegram_id AND NEW.state=''sent'' AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation);
 UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=NEW.telegram_id AND NEW.state=''blocked'' AND NEW.last_code=403 AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation);
END'),('astra_broadcast_update_guard03','trigger','CREATE TRIGGER astra_broadcast_update_guard03 BEFORE UPDATE ON astra_broadcast_outbox03 BEGIN
 SELECT CASE WHEN NEW.telegram_id<>OLD.telegram_id OR NEW.day<>OLD.day OR NEW.generation<>OLD.generation OR NEW.sign<>OLD.sign THEN RAISE(ABORT,''Broadcast identity immutable'') END;
 SELECT CASE WHEN NEW.state=''sending'' AND (OLD.state<>''retry'' OR NEW.attempts<>OLD.attempts+1 OR NEW.token=OLD.token) THEN RAISE(ABORT,''Only due retry can restart'') END;
 SELECT CASE WHEN NEW.state<>''sending'' AND(OLD.state NOT IN(''sending'',''retry'') OR NEW.attempts<>OLD.attempts OR NEW.token<>OLD.token) THEN RAISE(ABORT,''Broadcast terminal state immutable'') END;
END'),('astra_consent_complete28','trigger','CREATE TRIGGER astra_consent_complete28 BEFORE UPDATE OF migration_done ON astra_consent_runtime28 WHEN NEW.migration_done=1 BEGIN
 SELECT CASE WHEN (WITH expected(name,type,sql) AS (VALUES (''astra_consent_erase28'',''trigger'',''CREATE TRIGGER astra_consent_erase28 BEFORE DELETE ON astra_users BEGIN
 DELETE FROM astra_delivery_consent28 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_notification_consent28 WHERE telegram_id=OLD.telegram_id;
END''),(''astra_consent_insert28'',''trigger'',''CREATE TRIGGER astra_consent_insert28 BEFORE INSERT ON astra_notification_consent28 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation) THEN RAISE(ABORT,''''Consent profile missing'''') END;
 SELECT CASE WHEN NEW.revision<>0 OR NEW.consent_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN RAISE(ABORT,''''Consent starts pending'''') END;
END''),(''astra_consent_off28'',''trigger'',''CREATE TRIGGER astra_consent_off28 AFTER UPDATE OF notifications_enabled ON astra_users WHEN NEW.notifications_enabled=0 BEGIN
 UPDATE astra_notification_consent28 SET revision=revision+1,revoked_at=coalesce(revoked_at,unixepoch()),pending_hash=NULL, pending_revision=NULL, pending_version=NULL, pending_created_at=NULL, pending_expires_at=NULL, pending_message_id=NULL
 WHERE telegram_id=NEW.telegram_id AND ((consent_at IS NOT NULL AND revoked_at IS NULL) OR pending_hash IS NOT NULL);
END''),(''astra_consent_runtime28'',''table'',''CREATE TABLE astra_consent_runtime28 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL CHECK(version=''''consent28-v1''''),
 migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1)),
 delivery_quarantined INTEGER NOT NULL DEFAULT 1 CHECK(delivery_quarantined IN(0,1))
)''),(''astra_consent_sync28'',''trigger'',''CREATE TRIGGER astra_consent_sync28 AFTER UPDATE ON astra_notification_consent28 WHEN NEW.revision<>OLD.revision BEGIN
 UPDATE astra_users SET notifications_enabled=CASE WHEN NEW.consent_at IS NOT NULL AND NEW.revoked_at IS NULL THEN 1 ELSE 0 END WHERE telegram_id=NEW.telegram_id AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation);
 UPDATE astra_broadcast_outbox03 SET state=''''cancelled'''',last_reason=''''consent_revision_changed'''' WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND state IN(''''sending'''',''''retry'''');
END''),(''astra_consent_update28'',''trigger'',''CREATE TRIGGER astra_consent_update28 BEFORE UPDATE ON astra_notification_consent28 BEGIN
 SELECT CASE WHEN NEW.telegram_id<>OLD.telegram_id OR NEW.generation<>OLD.generation THEN RAISE(ABORT,''''Consent identity immutable'''') END;
 SELECT CASE WHEN NOT coalesce((
 (NEW.consent_version IS OLD.consent_version AND NEW.consent_at IS OLD.consent_at AND NEW.source IS OLD.source AND NEW.grant_update_id IS OLD.grant_update_id AND NEW.grant_message_id IS OLD.grant_message_id AND NEW.revoked_at IS OLD.revoked_at AND NEW.revision IS OLD.revision) OR
 (NEW.revision=OLD.revision+1 AND NEW.pending_hash IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.consent_version IS OLD.consent_version AND NEW.consent_at IS OLD.consent_at AND NEW.source IS OLD.source AND NEW.grant_update_id IS OLD.grant_update_id AND NEW.grant_message_id IS OLD.grant_message_id) OR
 (NEW.revision=OLD.revision+1 AND NEW.pending_hash IS NULL AND NEW.revoked_at IS NULL AND NEW.consent_version=''''daily-forecast-v1'''' AND NEW.source=''''explicit_private_button'''' AND NEW.consent_at=unixepoch()
 AND OLD.pending_hash IS NOT NULL AND OLD.pending_revision=OLD.revision AND OLD.pending_version=NEW.consent_version AND OLD.pending_expires_at>unixepoch() AND OLD.pending_message_id=NEW.grant_message_id
 AND EXISTS(SELECT 1 FROM astra_update_jobs j WHERE j.update_id=NEW.grant_update_id AND j.telegram_id=NEW.telegram_id AND j.status=''''working'''')
 AND EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation))
 ),0) THEN RAISE(ABORT,''''Invalid consent transition'''') END;
END''),(''astra_delivery_capture_insert28'',''trigger'',''CREATE TRIGGER astra_delivery_capture_insert28 AFTER INSERT ON astra_broadcast_outbox03 WHEN NEW.state=''''sending'''' BEGIN
 INSERT INTO astra_delivery_consent28(telegram_id,day,generation,revision,consent_version) SELECT NEW.telegram_id,NEW.day,NEW.generation,c.revision,c.consent_version FROM astra_notification_consent28 c WHERE c.telegram_id=NEW.telegram_id
 ON CONFLICT(telegram_id,day) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,consent_version=excluded.consent_version;
END''),(''astra_delivery_capture_update28'',''trigger'',''CREATE TRIGGER astra_delivery_capture_update28 AFTER UPDATE ON astra_broadcast_outbox03 WHEN NEW.state=''''sending'''' BEGIN
 INSERT INTO astra_delivery_consent28(telegram_id,day,generation,revision,consent_version) SELECT NEW.telegram_id,NEW.day,NEW.generation,c.revision,c.consent_version FROM astra_notification_consent28 c WHERE c.telegram_id=NEW.telegram_id
 ON CONFLICT(telegram_id,day) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,consent_version=excluded.consent_version;
END''),(''astra_delivery_consent28'',''table'',''CREATE TABLE astra_delivery_consent28 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,day TEXT NOT NULL,
 generation TEXT NOT NULL,revision INTEGER NOT NULL,consent_version TEXT NOT NULL CHECK(consent_version=''''daily-forecast-v1''''),
 PRIMARY KEY(telegram_id,day),FOREIGN KEY(telegram_id,day) REFERENCES astra_broadcast_outbox03(telegram_id,day) ON DELETE CASCADE
)''),(''astra_delivery_erase28'',''trigger'',''CREATE TRIGGER astra_delivery_erase28 AFTER DELETE ON astra_broadcast_outbox03 BEGIN
 DELETE FROM astra_delivery_consent28 WHERE telegram_id=OLD.telegram_id AND day=OLD.day;
END''),(''astra_delivery_guard_insert28'',''trigger'',''CREATE TRIGGER astra_delivery_guard_insert28 BEFORE INSERT ON astra_broadcast_outbox03 WHEN NEW.state=''''sending'''' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c USING(telegram_id)
 JOIN astra_consent_runtime28 m ON m.singleton=1
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND c.generation=p.generation AND u.notifications_enabled=1
 AND c.consent_version=''''daily-forecast-v1'''' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND m.version=''''consent28-v1'''' AND m.migration_done=1 AND m.delivery_quarantined=0) THEN RAISE(IGNORE) END;
END''),(''astra_delivery_guard_update28'',''trigger'',''CREATE TRIGGER astra_delivery_guard_update28 BEFORE UPDATE ON astra_broadcast_outbox03 WHEN NEW.state=''''sending'''' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c USING(telegram_id)
 JOIN astra_consent_runtime28 m ON m.singleton=1
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND c.generation=p.generation AND u.notifications_enabled=1
 AND c.consent_version=''''daily-forecast-v1'''' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND m.version=''''consent28-v1'''' AND m.migration_done=1 AND m.delivery_quarantined=0) THEN RAISE(IGNORE) END;
END''),(''astra_notification_consent28'',''table'',''CREATE TABLE astra_notification_consent28 (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 consent_version TEXT, consent_at INTEGER, source TEXT, grant_update_id INTEGER, grant_message_id INTEGER, revoked_at INTEGER,
 pending_hash TEXT, pending_revision INTEGER, pending_version TEXT, pending_created_at INTEGER, pending_expires_at INTEGER, pending_message_id INTEGER,
 CHECK((consent_version IS NULL AND consent_at IS NULL AND source IS NULL AND grant_update_id IS NULL AND grant_message_id IS NULL) OR
 (consent_version IS NOT NULL AND consent_at IS NOT NULL AND source IS NOT NULL AND grant_update_id IS NOT NULL AND grant_message_id IS NOT NULL AND consent_version=''''daily-forecast-v1'''' AND consent_at>0 AND source=''''explicit_private_button'''' AND grant_update_id>=0 AND grant_message_id>0)),
 CHECK((pending_hash IS NULL AND pending_revision IS NULL AND pending_version IS NULL AND pending_created_at IS NULL AND pending_expires_at IS NULL AND pending_message_id IS NULL) OR
 (pending_hash IS NOT NULL AND pending_revision IS NOT NULL AND pending_version IS NOT NULL AND pending_created_at IS NOT NULL AND pending_expires_at IS NOT NULL AND length(pending_hash)=64 AND pending_hash NOT GLOB ''''*[^a-f0-9]*'''' AND pending_revision=revision AND pending_version=''''daily-forecast-v1'''' AND pending_created_at>0 AND pending_expires_at=pending_created_at+900 AND (pending_message_id IS NULL OR pending_message_id>0)))
)''),(''idx_consent28_active'',''index'',''CREATE INDEX idx_consent28_active ON astra_notification_consent28(telegram_id,generation,revision) WHERE consent_at IS NOT NULL AND revoked_at IS NULL''),(''idx_consent28_pending'',''index'',''CREATE INDEX idx_consent28_pending ON astra_notification_consent28(pending_expires_at) WHERE pending_hash IS NOT NULL'')) SELECT count(*) FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR a.sql IS NOT e.sql)>0 THEN RAISE(ABORT,''Consent schema definition mismatch'') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_broadcast_runtime03 WHERE singleton=1 AND migration_done=1) THEN RAISE(ABORT,''0027 incomplete'') END;
END'),('astra_consent_erase28','trigger','CREATE TRIGGER astra_consent_erase28 BEFORE DELETE ON astra_users BEGIN
 DELETE FROM astra_delivery_consent28 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_notification_consent28 WHERE telegram_id=OLD.telegram_id;
END'),('astra_consent_insert28','trigger','CREATE TRIGGER astra_consent_insert28 BEFORE INSERT ON astra_notification_consent28 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation) THEN RAISE(ABORT,''Consent profile missing'') END;
 SELECT CASE WHEN NEW.revision<>0 OR NEW.consent_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN RAISE(ABORT,''Consent starts pending'') END;
END'),('astra_consent_off28','trigger','CREATE TRIGGER astra_consent_off28 AFTER UPDATE OF notifications_enabled ON astra_users WHEN NEW.notifications_enabled=0 BEGIN
 UPDATE astra_notification_consent28 SET revision=revision+1,revoked_at=coalesce(revoked_at,unixepoch()),pending_hash=NULL, pending_revision=NULL, pending_version=NULL, pending_created_at=NULL, pending_expires_at=NULL, pending_message_id=NULL
 WHERE telegram_id=NEW.telegram_id AND ((consent_at IS NOT NULL AND revoked_at IS NULL) OR pending_hash IS NOT NULL);
END'),('astra_consent_runtime28','table','CREATE TABLE astra_consent_runtime28 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL CHECK(version=''consent28-v1''),
 migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1)),
 delivery_quarantined INTEGER NOT NULL DEFAULT 1 CHECK(delivery_quarantined IN(0,1))
)'),('astra_consent_sync28','trigger','CREATE TRIGGER astra_consent_sync28 AFTER UPDATE ON astra_notification_consent28 WHEN NEW.revision<>OLD.revision BEGIN
 UPDATE astra_users SET notifications_enabled=CASE WHEN NEW.consent_at IS NOT NULL AND NEW.revoked_at IS NULL THEN 1 ELSE 0 END WHERE telegram_id=NEW.telegram_id AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation);
 UPDATE astra_broadcast_outbox03 SET state=''cancelled'',last_reason=''consent_revision_changed'' WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND state IN(''sending'',''retry'');
END'),('astra_consent_update28','trigger','CREATE TRIGGER astra_consent_update28 BEFORE UPDATE ON astra_notification_consent28 BEGIN
 SELECT CASE WHEN NEW.telegram_id<>OLD.telegram_id OR NEW.generation<>OLD.generation THEN RAISE(ABORT,''Consent identity immutable'') END;
 SELECT CASE WHEN NOT coalesce((
 (NEW.consent_version IS OLD.consent_version AND NEW.consent_at IS OLD.consent_at AND NEW.source IS OLD.source AND NEW.grant_update_id IS OLD.grant_update_id AND NEW.grant_message_id IS OLD.grant_message_id AND NEW.revoked_at IS OLD.revoked_at AND NEW.revision IS OLD.revision) OR
 (NEW.revision=OLD.revision+1 AND NEW.pending_hash IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.consent_version IS OLD.consent_version AND NEW.consent_at IS OLD.consent_at AND NEW.source IS OLD.source AND NEW.grant_update_id IS OLD.grant_update_id AND NEW.grant_message_id IS OLD.grant_message_id) OR
 (NEW.revision=OLD.revision+1 AND NEW.pending_hash IS NULL AND NEW.revoked_at IS NULL AND NEW.consent_version=''daily-forecast-v1'' AND NEW.source=''explicit_private_button'' AND NEW.consent_at=unixepoch()
 AND OLD.pending_hash IS NOT NULL AND OLD.pending_revision=OLD.revision AND OLD.pending_version=NEW.consent_version AND OLD.pending_expires_at>unixepoch() AND OLD.pending_message_id=NEW.grant_message_id
 AND EXISTS(SELECT 1 FROM astra_update_jobs j WHERE j.update_id=NEW.grant_update_id AND j.telegram_id=NEW.telegram_id AND j.status=''working'')
 AND EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation))
 ),0) THEN RAISE(ABORT,''Invalid consent transition'') END;
END'),('astra_debt_repayment_guard','trigger','CREATE TRIGGER astra_debt_repayment_guard BEFORE INSERT ON astra_debt_repayments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l JOIN astra_refund_accounts a ON a.payer_id=l.telegram_id JOIN astra_users u ON u.telegram_id=l.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id WHERE p.generation=NEW.generation AND NEW.credit_key=NEW.generation||'':''||NEW.ledger_key AND l.idempotency_key=NEW.ledger_key AND l.telegram_id=NEW.payer_id AND NEW.amount=min(l.delta,a.debt) AND l.delta>0 AND u.balance>=NEW.amount) THEN RAISE(ABORT,''Invalid debt repayment'') END;
END'),('astra_debt_repayment_immutable','trigger','CREATE TRIGGER astra_debt_repayment_immutable BEFORE UPDATE ON astra_debt_repayments BEGIN SELECT RAISE(ABORT,''Debt repayment immutable''); END'),('astra_debt_repayment_post','trigger','CREATE TRIGGER astra_debt_repayment_post AFTER INSERT ON astra_debt_repayments BEGIN
 UPDATE astra_users SET balance=balance-NEW.amount WHERE telegram_id=NEW.payer_id;
 UPDATE astra_refund_accounts SET debt=debt-NEW.amount,updated_at=CURRENT_TIMESTAMP WHERE payer_id=NEW.payer_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(''debt:''||NEW.credit_key,NEW.payer_id,-NEW.amount,''refund:repayment'');
END'),('astra_debt_repayments','table','CREATE TABLE astra_debt_repayments (
 credit_key TEXT PRIMARY KEY, ledger_key TEXT NOT NULL, generation TEXT NOT NULL, payer_id INTEGER NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_delivery_capture_insert28','trigger','CREATE TRIGGER astra_delivery_capture_insert28 AFTER INSERT ON astra_broadcast_outbox03 WHEN NEW.state=''sending'' BEGIN
 INSERT INTO astra_delivery_consent28(telegram_id,day,generation,revision,consent_version) SELECT NEW.telegram_id,NEW.day,NEW.generation,c.revision,c.consent_version FROM astra_notification_consent28 c WHERE c.telegram_id=NEW.telegram_id
 ON CONFLICT(telegram_id,day) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,consent_version=excluded.consent_version;
END'),('astra_delivery_capture_update28','trigger','CREATE TRIGGER astra_delivery_capture_update28 AFTER UPDATE ON astra_broadcast_outbox03 WHEN NEW.state=''sending'' BEGIN
 INSERT INTO astra_delivery_consent28(telegram_id,day,generation,revision,consent_version) SELECT NEW.telegram_id,NEW.day,NEW.generation,c.revision,c.consent_version FROM astra_notification_consent28 c WHERE c.telegram_id=NEW.telegram_id
 ON CONFLICT(telegram_id,day) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,consent_version=excluded.consent_version;
END'),('astra_delivery_consent28','table','CREATE TABLE astra_delivery_consent28 (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,day TEXT NOT NULL,
 generation TEXT NOT NULL,revision INTEGER NOT NULL,consent_version TEXT NOT NULL CHECK(consent_version=''daily-forecast-v1''),
 PRIMARY KEY(telegram_id,day),FOREIGN KEY(telegram_id,day) REFERENCES astra_broadcast_outbox03(telegram_id,day) ON DELETE CASCADE
)'),('astra_delivery_erase28','trigger','CREATE TRIGGER astra_delivery_erase28 AFTER DELETE ON astra_broadcast_outbox03 BEGIN
 DELETE FROM astra_delivery_consent28 WHERE telegram_id=OLD.telegram_id AND day=OLD.day;
END'),('astra_delivery_guard_insert28','trigger','CREATE TRIGGER astra_delivery_guard_insert28 BEFORE INSERT ON astra_broadcast_outbox03 WHEN NEW.state=''sending'' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c USING(telegram_id)
 JOIN astra_consent_runtime28 m ON m.singleton=1
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND c.generation=p.generation AND u.notifications_enabled=1
 AND c.consent_version=''daily-forecast-v1'' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND m.version=''consent28-v1'' AND m.migration_done=1 AND m.delivery_quarantined=0) THEN RAISE(IGNORE) END;
END'),('astra_delivery_guard_update28','trigger','CREATE TRIGGER astra_delivery_guard_update28 BEFORE UPDATE ON astra_broadcast_outbox03 WHEN NEW.state=''sending'' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c USING(telegram_id)
 JOIN astra_consent_runtime28 m ON m.singleton=1
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND c.generation=p.generation AND u.notifications_enabled=1
 AND c.consent_version=''daily-forecast-v1'' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND m.version=''consent28-v1'' AND m.migration_done=1 AND m.delivery_quarantined=0) THEN RAISE(IGNORE) END;
END'),('astra_erase','trigger','CREATE TRIGGER astra_erase AFTER DELETE ON astra_users BEGIN
  UPDATE astra_operations SET source_id=NULL WHERE source_id=OLD.telegram_id;
  UPDATE astra_users SET referrer_id=NULL WHERE referrer_id=OLD.telegram_id;
  DELETE FROM astra_wallet_ledger WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_tarot_requests WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_operations WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_update_jobs WHERE telegram_id=OLD.telegram_id;
  DELETE FROM astra_broadcast_jobs WHERE telegram_id=OLD.telegram_id;
END'),('astra_external_refunds','table','CREATE TABLE astra_external_refunds (
 charge_hash TEXT PRIMARY KEY, charge_id TEXT NOT NULL, order_id TEXT, payer_id INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency=''XTR''), xtr INTEGER NOT NULL,
 source TEXT NOT NULL CHECK(source IN (''api'',''message'',''reconcile'')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_forecast_daily','table','CREATE TABLE astra_forecast_daily (
 sign TEXT NOT NULL CHECK(sign IN (''aries'',''taurus'',''gemini'',''cancer'',''leo'',''virgo'',''libra'',''scorpio'',''sagittarius'',''capricorn'',''aquarius'',''pisces'')),
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,''+0 days'') IS NOT NULL AND date(day,''+0 days'')=day),
 locale TEXT NOT NULL CHECK(locale=''ru''),
 free_text TEXT NOT NULL CHECK(length(trim(free_text))>0),
 extended_text TEXT NOT NULL CHECK(length(trim(extended_text))>0),
 number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 9),
 engine_version TEXT NOT NULL CHECK(length(engine_version)>0),
 content_version TEXT NOT NULL CHECK(length(content_version)>0),
 number_algorithm_version TEXT NOT NULL CHECK(number_algorithm_version=''legacy-hash-v1''),
 source_tags TEXT NOT NULL CHECK(json_valid(source_tags)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(sign,day,locale)
)'),('astra_forecast_daily_immutable','trigger','CREATE TRIGGER astra_forecast_daily_immutable BEFORE UPDATE ON astra_forecast_daily BEGIN
 SELECT RAISE(ABORT,''Forecast cache is immutable'');
END'),('astra_forecast_erase','trigger','CREATE TRIGGER astra_forecast_erase AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_forecast_unlocks WHERE telegram_id=OLD.telegram_id;
END'),('astra_forecast_guard','trigger','CREATE TRIGGER astra_forecast_guard BEFORE INSERT ON astra_forecast_unlocks BEGIN
 SELECT CASE WHEN NEW.price<>4 OR date(NEW.day,''+0 days'') IS NULL OR date(NEW.day,''+0 days'')<>NEW.day
   OR NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND balance>=4)
   THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_forecast_daily WHERE sign=NEW.sign AND day=NEW.day AND locale=NEW.locale)
   THEN RAISE(ABORT,''Forecast snapshot missing'') END;
END'),('astra_forecast_post','trigger','CREATE TRIGGER astra_forecast_post AFTER INSERT ON astra_forecast_unlocks BEGIN
 UPDATE astra_users SET balance=balance-4 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,operation_id,telegram_id,delta,reason)
  VALUES(''forecast:extended:''||NEW.telegram_id||'':''||NEW.day,NULL,NEW.telegram_id,-4,''forecast:extended'');
END'),('astra_forecast_unlock_immutable','trigger','CREATE TRIGGER astra_forecast_unlock_immutable BEFORE UPDATE ON astra_forecast_unlocks BEGIN
 SELECT RAISE(ABORT,''Paid forecast is immutable'');
END'),('astra_forecast_unlocks','table','CREATE TABLE astra_forecast_unlocks (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,''+0 days'') IS NOT NULL AND date(day,''+0 days'')=day),
 sign TEXT NOT NULL,
 locale TEXT NOT NULL CHECK(locale=''ru''),
 price INTEGER NOT NULL CHECK(price=4),
 result_text TEXT NOT NULL CHECK(length(trim(result_text))>0),
 engine_version TEXT NOT NULL CHECK(length(engine_version)>0),
 content_version TEXT NOT NULL CHECK(length(content_version)>0),
 number_algorithm_version TEXT NOT NULL CHECK(number_algorithm_version=''legacy-hash-v1''),
 source_tags TEXT NOT NULL CHECK(json_valid(source_tags)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(telegram_id,day),
 FOREIGN KEY(sign,day,locale) REFERENCES astra_forecast_daily(sign,day,locale)
)'),('astra_notification_consent28','table','CREATE TABLE astra_notification_consent28 (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 consent_version TEXT, consent_at INTEGER, source TEXT, grant_update_id INTEGER, grant_message_id INTEGER, revoked_at INTEGER,
 pending_hash TEXT, pending_revision INTEGER, pending_version TEXT, pending_created_at INTEGER, pending_expires_at INTEGER, pending_message_id INTEGER,
 CHECK((consent_version IS NULL AND consent_at IS NULL AND source IS NULL AND grant_update_id IS NULL AND grant_message_id IS NULL) OR
 (consent_version IS NOT NULL AND consent_at IS NOT NULL AND source IS NOT NULL AND grant_update_id IS NOT NULL AND grant_message_id IS NOT NULL AND consent_version=''daily-forecast-v1'' AND consent_at>0 AND source=''explicit_private_button'' AND grant_update_id>=0 AND grant_message_id>0)),
 CHECK((pending_hash IS NULL AND pending_revision IS NULL AND pending_version IS NULL AND pending_created_at IS NULL AND pending_expires_at IS NULL AND pending_message_id IS NULL) OR
 (pending_hash IS NOT NULL AND pending_revision IS NOT NULL AND pending_version IS NOT NULL AND pending_created_at IS NOT NULL AND pending_expires_at IS NOT NULL AND length(pending_hash)=64 AND pending_hash NOT GLOB ''*[^a-f0-9]*'' AND pending_revision=revision AND pending_version=''daily-forecast-v1'' AND pending_created_at>0 AND pending_expires_at=pending_created_at+900 AND (pending_message_id IS NULL OR pending_message_id>0)))
)'),('astra_old_day_disabled26','trigger','CREATE TRIGGER astra_old_day_disabled26 BEFORE INSERT ON astra_policy_days BEGIN SELECT RAISE(IGNORE); END'),('astra_old_reward_disabled26','trigger','CREATE TRIGGER astra_old_reward_disabled26 BEFORE INSERT ON astra_reward_claims BEGIN SELECT RAISE(IGNORE); END'),('astra_old_shell_disabled26','trigger','CREATE TRIGGER astra_old_shell_disabled26 BEFORE INSERT ON astra_shell_rewards
 WHEN NOT EXISTS(SELECT 1 FROM astra_bonus_awards26 WHERE telegram_id=NEW.telegram_id AND kind=''gpt6'') BEGIN SELECT RAISE(IGNORE); END'),('astra_operation_guard26','trigger','CREATE TRIGGER astra_operation_guard26 BEFORE INSERT ON astra_operations BEGIN
 SELECT CASE WHEN NEW.reason<>''tarot'' THEN RAISE(IGNORE) END;
 -- New -3 requests are obsolete. Fulfilment may only read a previously paid operation.
 SELECT RAISE(IGNORE);
END'),('astra_operation_post','trigger','CREATE TRIGGER astra_operation_post AFTER INSERT ON astra_operations BEGIN
  UPDATE astra_users SET balance=balance+NEW.delta,
    last_gift_day=CASE WHEN NEW.reason=''daily'' THEN NEW.day ELSE last_gift_day END,
    channel_rewarded=CASE WHEN NEW.reason=''channel'' THEN 1 ELSE channel_rewarded END
    WHERE telegram_id=NEW.telegram_id;
  INSERT INTO astra_wallet_ledger(idempotency_key,operation_id,telegram_id,delta,reason)
    VALUES(NEW.operation_id,NEW.operation_id,NEW.telegram_id,NEW.delta,NEW.reason);
END'),('astra_operations','table','CREATE TABLE astra_operations (
  operation_id TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK(reason IN (''daily'',''channel'',''referral'',''tarot'')),
  delta INTEGER NOT NULL,
  day TEXT,
  result TEXT,
  delivery TEXT NOT NULL DEFAULT ''pending'' CHECK(delivery IN (''pending'',''sending'',''sent'',''retry'',''unknown'',''rejected'')),
  lease TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((reason=''daily'' AND delta=1 AND day IS NOT NULL) OR
        (reason IN (''channel'',''referral'') AND delta=5) OR
        (reason=''tarot'' AND delta=-3 AND result IS NOT NULL))
)'),('astra_orders_delete26','trigger','CREATE TRIGGER astra_orders_delete26 INSTEAD OF DELETE ON astra_all_orders26 BEGIN
 DELETE FROM astra_payment_orders WHERE order_id=OLD.order_id;
 DELETE FROM astra_payment_orders26 WHERE order_id=OLD.order_id;
END'),('astra_orders_index_new26','trigger','CREATE TRIGGER astra_orders_index_new26 AFTER INSERT ON astra_payment_orders26 BEGIN INSERT INTO astra_payment_order_index26(order_id) VALUES(NEW.order_id); END'),('astra_orders_index_old26','trigger','CREATE TRIGGER astra_orders_index_old26 AFTER INSERT ON astra_payment_orders BEGIN INSERT INTO astra_payment_order_index26(order_id) VALUES(NEW.order_id); END'),('astra_orders_insert26','trigger','CREATE TRIGGER astra_orders_insert26 INSTEAD OF INSERT ON astra_all_orders26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id OR payload=NEW.payload OR (payer_id=NEW.payer_id AND request_key=NEW.request_key)) THEN RAISE(IGNORE) END;
 INSERT INTO astra_payment_orders26(order_id,payload,owner_id,payer_id,request_key,package,xtr,dust,price_version,scope,terms_version,retention_days,status,delivery,invoice_lease,precheckout_id,created_at,updated_at) VALUES(NEW.order_id,NEW.payload,NEW.owner_id,NEW.payer_id,NEW.request_key,NEW.package,NEW.xtr,NEW.dust,NEW.price_version,NEW.scope,NEW.terms_version,NEW.retention_days,coalesce(NEW.status,''created''),coalesce(NEW.delivery,''pending''),NEW.invoice_lease,NEW.precheckout_id,coalesce(NEW.created_at,CURRENT_TIMESTAMP),coalesce(NEW.updated_at,CURRENT_TIMESTAMP));
END'),('astra_orders_unindex_new26','trigger','CREATE TRIGGER astra_orders_unindex_new26 AFTER DELETE ON astra_payment_orders26 BEGIN DELETE FROM astra_payment_order_index26 WHERE order_id=OLD.order_id; END'),('astra_orders_unindex_old26','trigger','CREATE TRIGGER astra_orders_unindex_old26 AFTER DELETE ON astra_payment_orders BEGIN DELETE FROM astra_payment_order_index26 WHERE order_id=OLD.order_id; END'),('astra_orders_update26','trigger','CREATE TRIGGER astra_orders_update26 INSTEAD OF UPDATE ON astra_all_orders26 BEGIN
 UPDATE astra_payment_orders SET order_id=NEW.order_id,payload=NEW.payload,owner_id=NEW.owner_id,payer_id=NEW.payer_id,request_key=NEW.request_key,package=NEW.package,xtr=NEW.xtr,dust=NEW.dust,price_version=NEW.price_version,scope=NEW.scope,terms_version=NEW.terms_version,retention_days=NEW.retention_days,status=NEW.status,delivery=NEW.delivery,invoice_lease=NEW.invoice_lease,precheckout_id=NEW.precheckout_id,created_at=NEW.created_at,updated_at=NEW.updated_at WHERE order_id=OLD.order_id;
 UPDATE astra_payment_orders26 SET order_id=NEW.order_id,payload=NEW.payload,owner_id=NEW.owner_id,payer_id=NEW.payer_id,request_key=NEW.request_key,package=NEW.package,xtr=NEW.xtr,dust=NEW.dust,price_version=NEW.price_version,scope=NEW.scope,terms_version=NEW.terms_version,retention_days=NEW.retention_days,status=NEW.status,delivery=NEW.delivery,invoice_lease=NEW.invoice_lease,precheckout_id=NEW.precheckout_id,created_at=NEW.created_at,updated_at=NEW.updated_at WHERE order_id=OLD.order_id;
END'),('astra_patch26','table','CREATE TABLE astra_patch26 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL DEFAULT ''policy-v3'' CHECK(version=''policy-v3''),
 source_policy_idle INTEGER NOT NULL CHECK(source_policy_idle=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 start_day TEXT,activated INTEGER NOT NULL DEFAULT 0 CHECK(activated IN(0,1)),notice_approved INTEGER NOT NULL DEFAULT 0 CHECK(notice_approved IN(0,1)),
 active_key_id TEXT, unsafe_until INTEGER NOT NULL DEFAULT 0,installed_at INTEGER NOT NULL DEFAULT(unixepoch()),migration_done INTEGER NOT NULL DEFAULT 0,
 CHECK(start_day IS NULL OR (length(start_day)=10 AND date(start_day,''+0 days'')=start_day)),
 CHECK(activated=0 OR start_day IS NOT NULL),CHECK(enabled=0 OR (notice_approved=1 AND active_key_id IS NOT NULL))
)'),('astra_patch_policy_guard26','trigger','CREATE TRIGGER astra_patch_policy_guard26 BEFORE UPDATE ON astra_patch26 WHEN (OLD.start_day IS NOT NULL AND (NEW.start_day IS NULL OR NEW.start_day<>OLD.start_day)) OR(OLD.activated=1 AND NEW.activated<>1) OR NEW.version<>OLD.version BEGIN SELECT RAISE(ABORT,''Patch policy immutable''); END'),('astra_payment_anomalies','table','CREATE TABLE astra_payment_anomalies (
 charge_hash TEXT PRIMARY KEY, charge_id TEXT NOT NULL, payer_id INTEGER NOT NULL, payload TEXT NOT NULL, currency TEXT NOT NULL, xtr INTEGER NOT NULL,
 scope TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT ''needs_review'', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_payment_audit','table','CREATE TABLE astra_payment_audit (
 audit_id TEXT PRIMARY KEY,kind TEXT NOT NULL,charge_hash TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_payment_erase26','trigger','CREATE TRIGGER astra_payment_erase26 AFTER DELETE ON astra_users BEGIN
 UPDATE astra_payment_orders26 SET owner_id=NULL WHERE payer_id=OLD.telegram_id;
 DELETE FROM astra_payment_orders26 WHERE payer_id=OLD.telegram_id AND NOT EXISTS(SELECT 1 FROM astra_payment_receipts26 r WHERE r.order_id=astra_payment_orders26.order_id);
END'),('astra_payment_order_index26','table','CREATE TABLE astra_payment_order_index26 (seq INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL UNIQUE)'),('astra_payment_order_snapshot','trigger','CREATE TRIGGER astra_payment_order_snapshot BEFORE UPDATE ON astra_payment_orders WHEN NEW.order_id<>OLD.order_id OR NEW.payload<>OLD.payload OR NEW.payer_id<>OLD.payer_id OR NEW.package<>OLD.package OR NEW.xtr<>OLD.xtr OR NEW.dust<>OLD.dust OR NEW.scope<>OLD.scope OR NEW.terms_version<>OLD.terms_version OR NEW.retention_days<>OLD.retention_days OR NEW.request_key<>OLD.request_key OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,''Order price snapshot immutable''); END'),('astra_payment_order_snapshot26','trigger','CREATE TRIGGER astra_payment_order_snapshot26 BEFORE UPDATE ON astra_payment_orders26 WHEN NEW.order_id<>OLD.order_id OR NEW.payload<>OLD.payload OR NEW.payer_id<>OLD.payer_id OR NEW.package<>OLD.package OR NEW.xtr<>OLD.xtr OR NEW.dust<>OLD.dust OR NEW.scope<>OLD.scope OR NEW.terms_version<>OLD.terms_version OR NEW.retention_days<>OLD.retention_days OR NEW.request_key<>OLD.request_key OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,''Order price snapshot immutable''); END'),('astra_payment_orders','table','CREATE TABLE astra_payment_orders (
 order_id TEXT PRIMARY KEY, payload TEXT NOT NULL UNIQUE CHECK(length(CAST(payload AS BLOB))<=128),
 owner_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL, payer_id INTEGER NOT NULL,
 request_key TEXT NOT NULL, package INTEGER NOT NULL, xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 price_version TEXT NOT NULL CHECK(price_version=''stars-pack-v1''), scope TEXT NOT NULL CHECK(scope IN (''test'',''production'')),
 terms_version TEXT NOT NULL, retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 180 AND 3650),
 status TEXT NOT NULL DEFAULT ''created'' CHECK(status IN (''created'',''invoiced'',''confirmed'',''credited'',''refund_requested'',''refund_in_progress'',''refunded'',''needs_review'')),
 delivery TEXT NOT NULL DEFAULT ''pending'' CHECK(delivery IN (''pending'',''sending'',''sent'',''unknown'',''failed'')),
 invoice_lease TEXT, precheckout_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(payer_id,request_key), CHECK((package=10 AND xtr=10 AND dust=100) OR (package=25 AND xtr=25 AND dust=270) OR (package=50 AND xtr=50 AND dust=570))
)'),('astra_payment_orders26','table','CREATE TABLE astra_payment_orders26 (
 order_id TEXT PRIMARY KEY, payload TEXT NOT NULL UNIQUE CHECK(length(CAST(payload AS BLOB))<=128),
 owner_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL, payer_id INTEGER NOT NULL,
 request_key TEXT NOT NULL, package INTEGER NOT NULL, xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 price_version TEXT NOT NULL CHECK(price_version=''stars-pack-v2''), scope TEXT NOT NULL CHECK(scope IN (''test'',''production'')),
 terms_version TEXT NOT NULL, retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 180 AND 3650),
 status TEXT NOT NULL DEFAULT ''created'' CHECK(status IN (''created'',''invoiced'',''confirmed'',''credited'',''refund_requested'',''refund_in_progress'',''refunded'',''needs_review'')),
 delivery TEXT NOT NULL DEFAULT ''pending'' CHECK(delivery IN (''pending'',''sending'',''sent'',''unknown'',''failed'')),
 invoice_lease TEXT, precheckout_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(payer_id,request_key), CHECK((package=10 AND xtr=10 AND dust=40) OR (package=25 AND xtr=25 AND dust=110) OR (package=50 AND xtr=50 AND dust=240))
)'),('astra_payment_purge','trigger','CREATE TRIGGER astra_payment_purge BEFORE DELETE ON astra_payment_orders BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_refund_accounts WHERE payer_id=OLD.payer_id AND debt>0) AND EXISTS(SELECT 1 FROM astra_payment_receipts WHERE order_id=OLD.order_id) THEN RAISE(ABORT,''Unresolved debt blocks payment erasure'') END;
 DELETE FROM astra_refund_requests WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_refund_settlements WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_external_refunds WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_anomalies WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_receipts WHERE order_id=OLD.order_id;
END'),('astra_payment_purge26','trigger','CREATE TRIGGER astra_payment_purge26 BEFORE DELETE ON astra_payment_orders26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_refund_accounts WHERE payer_id=OLD.payer_id AND debt>0) AND EXISTS(SELECT 1 FROM astra_payment_receipts26 WHERE order_id=OLD.order_id) THEN RAISE(ABORT,''Unresolved debt blocks payment erasure'') END;
 DELETE FROM astra_refund_requests WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_refund_settlements WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_external_refunds WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_anomalies WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts26 WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_receipts26 WHERE order_id=OLD.order_id;
END'),('astra_payment_purge_closed','trigger','CREATE TRIGGER astra_payment_purge_closed AFTER DELETE ON astra_payment_orders
 WHEN NOT EXISTS(SELECT 1 FROM astra_all_orders26 WHERE payer_id=OLD.payer_id)
 AND EXISTS(SELECT 1 FROM astra_refund_accounts a WHERE a.payer_id=OLD.payer_id AND a.debt=0 AND a.updated_at<datetime(''now'',''-''||(SELECT retention_days FROM astra_policy WHERE singleton=1)||'' days'')) BEGIN
 DELETE FROM astra_refund_accounts WHERE payer_id=OLD.payer_id;
END'),('astra_payment_purge_closed26','trigger','CREATE TRIGGER astra_payment_purge_closed26 AFTER DELETE ON astra_payment_orders26
 WHEN NOT EXISTS(SELECT 1 FROM astra_all_orders26 WHERE payer_id=OLD.payer_id)
 AND EXISTS(SELECT 1 FROM astra_refund_accounts a WHERE a.payer_id=OLD.payer_id AND a.debt=0 AND a.updated_at<datetime(''now'',''-''||(SELECT retention_days FROM astra_policy WHERE singleton=1)||'' days'')) BEGIN
 DELETE FROM astra_refund_accounts WHERE payer_id=OLD.payer_id;
END'),('astra_payment_receipt_guard','trigger','CREATE TRIGGER astra_payment_receipt_guard BEFORE INSERT ON astra_payment_receipts BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.credited_dust<>CASE WHEN NEW.kind=''paid'' AND NOT EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) AND EXISTS(SELECT 1 FROM astra_payment_orders o JOIN astra_users u ON u.telegram_id=o.owner_id WHERE o.order_id=NEW.order_id AND o.owner_id=NEW.payer_id) THEN NEW.dust ELSE 0 END OR NOT EXISTS(SELECT 1 FROM astra_payment_orders o WHERE o.order_id=NEW.order_id AND o.payer_id=NEW.payer_id AND o.xtr=NEW.xtr AND o.dust=NEW.dust AND NEW.currency=''XTR'') THEN RAISE(ABORT,''Payment snapshot mismatch'') END;
END'),('astra_payment_receipt_guard26','trigger','CREATE TRIGGER astra_payment_receipt_guard26 BEFORE INSERT ON astra_payment_receipts26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.credited_dust<>CASE WHEN NEW.kind=''paid'' AND NOT EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) AND EXISTS(SELECT 1 FROM astra_all_orders26 o JOIN astra_users u ON u.telegram_id=o.owner_id WHERE o.order_id=NEW.order_id AND o.owner_id=NEW.payer_id) THEN NEW.dust ELSE 0 END OR NOT EXISTS(SELECT 1 FROM astra_all_orders26 o WHERE o.order_id=NEW.order_id AND o.payer_id=NEW.payer_id AND o.xtr=NEW.xtr AND o.dust=NEW.dust AND NEW.currency=''XTR'') THEN RAISE(ABORT,''Payment snapshot mismatch'') END;
END'),('astra_payment_receipt_immutable','trigger','CREATE TRIGGER astra_payment_receipt_immutable BEFORE UPDATE ON astra_payment_receipts BEGIN SELECT RAISE(ABORT,''Payment proof immutable''); END'),('astra_payment_receipt_immutable26','trigger','CREATE TRIGGER astra_payment_receipt_immutable26 BEFORE UPDATE ON astra_payment_receipts26 BEGIN SELECT RAISE(ABORT,''Payment proof immutable''); END'),('astra_payment_receipt_post','trigger','CREATE TRIGGER astra_payment_receipt_post AFTER INSERT ON astra_payment_receipts BEGIN
 INSERT INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,NEW.dust,NEW.credited_dust,scope,CASE WHEN NEW.kind=''refunded'' THEN 1 ELSE 0 END FROM astra_payment_orders WHERE order_id=NEW.order_id;
 UPDATE astra_users SET balance=balance+(SELECT credited_dust FROM astra_payment_receipts WHERE charge_hash=NEW.charge_hash) WHERE telegram_id=NEW.payer_id AND EXISTS(SELECT 1 FROM astra_payment_orders WHERE order_id=NEW.order_id AND owner_id=NEW.payer_id);
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
 SELECT ''stars:''||NEW.charge_hash,NEW.payer_id,credited_dust,''payment:stars'' FROM astra_payment_receipts WHERE charge_hash=NEW.charge_hash AND credited_dust>0;
 UPDATE astra_payment_orders SET status=CASE WHEN NEW.kind=''refunded'' OR EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) THEN ''refunded'' WHEN (SELECT credited_dust FROM astra_payment_receipts WHERE charge_hash=NEW.charge_hash)>0 THEN ''credited'' ELSE ''needs_review'' END,updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id;
END'),('astra_payment_receipt_post26','trigger','CREATE TRIGGER astra_payment_receipt_post26 AFTER INSERT ON astra_payment_receipts26 BEGIN
 INSERT INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,NEW.dust,NEW.credited_dust,scope,CASE WHEN NEW.kind=''refunded'' THEN 1 ELSE 0 END FROM astra_all_orders26 WHERE order_id=NEW.order_id;
 UPDATE astra_users SET balance=balance+(SELECT credited_dust FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash) WHERE telegram_id=NEW.payer_id AND EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id AND owner_id=NEW.payer_id);
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
 SELECT ''stars:''||NEW.charge_hash,NEW.payer_id,credited_dust,''payment:stars'' FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash AND credited_dust>0;
 UPDATE astra_all_orders26 SET status=CASE WHEN NEW.kind=''refunded'' OR EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) THEN ''refunded'' WHEN (SELECT credited_dust FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash)>0 THEN ''credited'' ELSE ''needs_review'' END,updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id;
END'),('astra_payment_receipts','table','CREATE TABLE astra_payment_receipts (
 charge_id TEXT PRIMARY KEY, charge_hash TEXT NOT NULL UNIQUE CHECK(length(charge_hash)=64), order_id TEXT NOT NULL UNIQUE REFERENCES astra_payment_orders(order_id),
 payer_id INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency=''XTR''), xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN (''paid'',''refunded'')), credited_dust INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_payment_receipts26','table','CREATE TABLE astra_payment_receipts26 (
 charge_id TEXT PRIMARY KEY, charge_hash TEXT NOT NULL UNIQUE CHECK(length(charge_hash)=64), order_id TEXT NOT NULL UNIQUE REFERENCES astra_payment_orders26(order_id),
 payer_id INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency=''XTR''), xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN (''paid'',''refunded'')), credited_dust INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_payment_tombstones','table','CREATE TABLE astra_payment_tombstones (charge_hash TEXT PRIMARY KEY CHECK(length(charge_hash)=64), xtr INTEGER NOT NULL CHECK(xtr>0), dust INTEGER NOT NULL CHECK(dust>=0), credited_dust INTEGER NOT NULL CHECK(credited_dust>=0 AND credited_dust<=dust), scope TEXT NOT NULL CHECK(scope IN (''test'',''production'')), refunded INTEGER NOT NULL DEFAULT 0 CHECK(refunded IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'),('astra_policy','table','CREATE TABLE astra_policy (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL DEFAULT ''policy-v2'' CHECK(version=''policy-v2''),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), start_day TEXT,
 activated INTEGER NOT NULL DEFAULT 0 CHECK(activated IN (0,1)), migration_done INTEGER NOT NULL DEFAULT 0,
 stars_enabled INTEGER NOT NULL DEFAULT 0 CHECK(stars_enabled IN (0,1)), payment_scope TEXT CHECK(payment_scope IN (''test'',''production'')),
 support TEXT, terms_version TEXT, retention_days INTEGER NOT NULL DEFAULT 0, verified_bot_id INTEGER,
 CHECK(start_day IS NULL OR (length(start_day)=10 AND date(start_day,''+0 days'') IS NOT NULL AND date(start_day,''+0 days'')=start_day)),
 CHECK(activated=0 OR start_day IS NOT NULL)
)'),('astra_policy_date_guard','trigger','CREATE TRIGGER astra_policy_date_guard BEFORE UPDATE ON astra_policy WHEN (OLD.start_day IS NOT NULL AND (NEW.start_day IS NULL OR NEW.start_day<>OLD.start_day)) OR (OLD.activated=1 AND NEW.activated<>1) OR (OLD.verified_bot_id IS NOT NULL AND (NEW.verified_bot_id IS NULL OR NEW.verified_bot_id<>OLD.verified_bot_id)) OR NEW.version<>OLD.version OR (OLD.payment_scope IS NOT NULL AND (NEW.payment_scope IS NULL OR NEW.payment_scope<>OLD.payment_scope)) BEGIN SELECT RAISE(ABORT,''Policy cutover/scope immutable''); END'),('astra_policy_day_immutable','trigger','CREATE TRIGGER astra_policy_day_immutable BEFORE UPDATE ON astra_policy_days BEGIN SELECT RAISE(ABORT,''Policy day immutable''); END'),('astra_policy_days','table','CREATE TABLE astra_policy_days (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,''+0 days'') IS NOT NULL AND date(day,''+0 days'')=day), streak INTEGER NOT NULL CHECK(streak>0),
 event_id INTEGER NOT NULL REFERENCES astra_policy_events(update_id), PRIMARY KEY(telegram_id,day)
)'),('astra_policy_erase','trigger','CREATE TRIGGER astra_policy_erase AFTER DELETE ON astra_users BEGIN
 UPDATE astra_referral_contracts SET referrer=NULL,status=CASE WHEN status IN (''pending'',''eligible'') THEN ''cancelled'' ELSE status END WHERE referrer=OLD.telegram_id;
 DELETE FROM astra_referral_payouts WHERE invitee=OLD.telegram_id;
 DELETE FROM astra_referral_contracts WHERE invitee=OLD.telegram_id;
 DELETE FROM astra_reward_claims WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_policy_days WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_policy_events WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_user_policy WHERE telegram_id=OLD.telegram_id;
 UPDATE astra_payment_orders SET owner_id=NULL WHERE payer_id=OLD.telegram_id;
 DELETE FROM astra_payment_orders WHERE payer_id=OLD.telegram_id AND NOT EXISTS(SELECT 1 FROM astra_payment_receipts r WHERE r.order_id=astra_payment_orders.order_id);
END'),('astra_policy_events','table','CREATE TABLE astra_policy_events (
 update_id INTEGER PRIMARY KEY, telegram_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT, source TEXT NOT NULL CHECK(source IN (''message'',''callback'',''legacy'')),
 legacy INTEGER NOT NULL CHECK(legacy IN (0,1)), processed INTEGER NOT NULL DEFAULT 0 CHECK(processed IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(legacy=1 OR (telegram_id IS NOT NULL AND length(day)=10 AND date(day,''+0 days'') IS NOT NULL AND date(day,''+0 days'')=day))
)'),('astra_positive_debt','trigger','CREATE TRIGGER astra_positive_debt AFTER INSERT ON astra_wallet_ledger WHEN NEW.delta>0 AND EXISTS(SELECT 1 FROM astra_refund_accounts WHERE payer_id=NEW.telegram_id AND debt>0) BEGIN
 INSERT INTO astra_debt_repayments(credit_key,ledger_key,generation,payer_id,amount) SELECT p.generation||'':''||NEW.idempotency_key,NEW.idempotency_key,p.generation,NEW.telegram_id,min(NEW.delta,a.debt) FROM astra_refund_accounts a JOIN astra_user_policy p ON p.telegram_id=a.payer_id WHERE a.payer_id=NEW.telegram_id;
END'),('astra_processed_updates','table','CREATE TABLE astra_processed_updates (
  update_id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_receipts_insert26','trigger','CREATE TRIGGER astra_receipts_insert26 INSTEAD OF INSERT ON astra_all_receipts26 BEGIN
 INSERT OR IGNORE INTO astra_payment_receipts(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust,created_at) SELECT NEW.charge_id,NEW.charge_hash,NEW.order_id,NEW.payer_id,NEW.currency,NEW.xtr,NEW.dust,NEW.kind,coalesce(NEW.credited_dust,0),coalesce(NEW.created_at,CURRENT_TIMESTAMP) WHERE EXISTS(SELECT 1 FROM astra_payment_orders WHERE order_id=NEW.order_id);
 INSERT OR IGNORE INTO astra_payment_receipts26(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust,created_at) SELECT NEW.charge_id,NEW.charge_hash,NEW.order_id,NEW.payer_id,NEW.currency,NEW.xtr,NEW.dust,NEW.kind,coalesce(NEW.credited_dust,0),coalesce(NEW.created_at,CURRENT_TIMESTAMP) WHERE EXISTS(SELECT 1 FROM astra_payment_orders26 WHERE order_id=NEW.order_id);
END'),('astra_referral_contracts','table','CREATE TABLE astra_referral_contracts (
 invitee INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 referrer INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,
 generation TEXT NOT NULL UNIQUE, mode TEXT NOT NULL CHECK(mode IN (''legacy'',''v2'')),
 status TEXT NOT NULL CHECK(status IN (''pending'',''eligible'',''paid'',''cancelled'')), created_day TEXT NOT NULL, paid_day TEXT, CHECK(referrer IS NULL OR referrer<>invitee)
)'),('astra_referral_payout_guard','trigger','CREATE TRIGGER astra_referral_payout_guard BEFORE INSERT ON astra_referral_payouts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_referral_contracts c JOIN astra_users u ON u.telegram_id=c.referrer JOIN astra_users i ON i.telegram_id=c.invitee WHERE c.invitee=NEW.invitee AND c.mode=''v2'' AND c.status=''eligible'' AND i.zodiac IS NOT NULL AND (SELECT count(*) FROM astra_policy_days WHERE telegram_id=c.invitee)>=2)
 THEN RAISE(IGNORE) END;
END'),('astra_referral_payout_post','trigger','CREATE TRIGGER astra_referral_payout_post AFTER INSERT ON astra_referral_payouts BEGIN
 INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT ''reward:''||p.generation||'':referrer:''||c.generation,c.referrer,p.generation,''referrer'',NEW.day,14,c.generation FROM astra_referral_contracts c JOIN astra_user_policy p ON p.telegram_id=c.referrer WHERE c.invitee=NEW.invitee;
 INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT ''reward:''||generation||'':invitee:''||generation,invitee,generation,''invitee'',NEW.day,4,generation FROM astra_referral_contracts WHERE invitee=NEW.invitee;
 UPDATE astra_referral_contracts SET status=''paid'',paid_day=NEW.day WHERE invitee=NEW.invitee;
 UPDATE astra_users SET referral_rewarded=1 WHERE telegram_id=NEW.invitee;
END'),('astra_referral_payouts','table','CREATE TABLE astra_referral_payouts (
 invitee INTEGER PRIMARY KEY REFERENCES astra_referral_contracts(invitee) ON DELETE CASCADE,
 day TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_referrer_erasing','trigger','CREATE TRIGGER astra_referrer_erasing BEFORE DELETE ON astra_users BEGIN
 UPDATE astra_referral_contracts SET referrer=NULL,status=CASE WHEN status IN (''pending'',''eligible'') THEN ''cancelled'' ELSE status END WHERE referrer=OLD.telegram_id;
END'),('astra_refund_account_erasing','trigger','CREATE TRIGGER astra_refund_account_erasing BEFORE DELETE ON astra_refund_accounts BEGIN
 SELECT CASE WHEN OLD.debt<>0 OR EXISTS(SELECT 1 FROM astra_all_orders26 WHERE payer_id=OLD.payer_id) OR OLD.updated_at>=datetime(''now'',''-''||(SELECT retention_days FROM astra_policy WHERE singleton=1)||'' days'') THEN RAISE(ABORT,''Refund account still required'') END;
 DELETE FROM astra_refund_requests WHERE charge_hash IN (SELECT charge_hash FROM astra_external_refunds WHERE payer_id=OLD.payer_id);
 DELETE FROM astra_refund_settlements WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_external_refunds WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_payment_anomalies WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_debt_repayments WHERE payer_id=OLD.payer_id;
END'),('astra_refund_accounts','table','CREATE TABLE astra_refund_accounts (payer_id INTEGER PRIMARY KEY, debt INTEGER NOT NULL DEFAULT 0 CHECK(debt>=0), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'),('astra_refund_notice_guard','trigger','CREATE TRIGGER astra_refund_notice_guard BEFORE INSERT ON astra_external_refunds BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash AND refunded=1) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_all_receipts26 r WHERE r.charge_hash=NEW.charge_hash AND (r.charge_id<>NEW.charge_id OR r.payer_id<>NEW.payer_id OR r.currency<>NEW.currency OR r.xtr<>NEW.xtr OR r.order_id<>NEW.order_id)) THEN RAISE(ABORT,''Refund proof mismatch'') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash) AND NOT EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id AND payer_id=NEW.payer_id AND xtr=NEW.xtr) AND NOT EXISTS(SELECT 1 FROM astra_payment_anomalies WHERE charge_hash=NEW.charge_hash AND payer_id=NEW.payer_id AND currency=NEW.currency AND xtr=NEW.xtr) AND NOT EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash AND xtr=NEW.xtr AND scope=(SELECT payment_scope FROM astra_policy WHERE singleton=1)) THEN RAISE(ABORT,''Refund needs known proof'') END;
END'),('astra_refund_notice_immutable','trigger','CREATE TRIGGER astra_refund_notice_immutable BEFORE UPDATE ON astra_external_refunds BEGIN SELECT RAISE(ABORT,''Refund notice immutable''); END'),('astra_refund_notice_post','trigger','CREATE TRIGGER astra_refund_notice_post AFTER INSERT ON astra_external_refunds BEGIN
 INSERT OR IGNORE INTO astra_all_receipts26(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind)
 SELECT NEW.charge_id,NEW.charge_hash,o.order_id,NEW.payer_id,NEW.currency,NEW.xtr,o.dust,''refunded'' FROM astra_all_orders26 o WHERE o.order_id=NEW.order_id AND NOT EXISTS(SELECT 1 FROM astra_all_receipts26 WHERE order_id=o.order_id);
 INSERT INTO astra_refund_settlements(charge_hash,payer_id,reversed_dust,removed,debt_added)
 SELECT NEW.charge_hash,NEW.payer_id,coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0),min(coalesce(u.balance,0),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)-min(coalesce(u.balance,0),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)) FROM (SELECT 1) d LEFT JOIN astra_all_receipts26 r ON r.charge_hash=NEW.charge_hash LEFT JOIN astra_users u ON u.telegram_id=NEW.payer_id LEFT JOIN astra_payment_tombstones t ON t.charge_hash=NEW.charge_hash;
 INSERT OR IGNORE INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,0,0,scope,1 FROM astra_payment_anomalies WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_payment_tombstones SET refunded=1 WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_all_orders26 SET status=''refunded'',updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id AND EXISTS(SELECT 1 FROM astra_all_receipts26 WHERE order_id=NEW.order_id AND charge_hash=NEW.charge_hash);
 UPDATE astra_refund_requests SET status=''refunded'',lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_payment_anomalies SET status=''refunded'' WHERE charge_hash=NEW.charge_hash;
END'),('astra_refund_request_audit','trigger','CREATE TRIGGER astra_refund_request_audit AFTER UPDATE ON astra_refund_requests BEGIN
 INSERT INTO astra_payment_audit(audit_id,kind,charge_hash) VALUES(lower(hex(randomblob(16))),''refund_state:''||OLD.status||'':''||NEW.status,NEW.charge_hash);
END'),('astra_refund_requests','table','CREATE TABLE astra_refund_requests (
 charge_hash TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT ''requested'' CHECK(status IN (''requested'',''in_progress'',''needs_review'',''refunded'')),
 lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_refund_settlement_immutable','trigger','CREATE TRIGGER astra_refund_settlement_immutable BEFORE UPDATE ON astra_refund_settlements BEGIN SELECT RAISE(ABORT,''Refund settlement immutable''); END'),('astra_refund_settlement_post','trigger','CREATE TRIGGER astra_refund_settlement_post AFTER INSERT ON astra_refund_settlements BEGIN
 UPDATE astra_users SET balance=balance-NEW.removed WHERE telegram_id=NEW.payer_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) SELECT ''refund:''||NEW.charge_hash,NEW.payer_id,-NEW.removed,''refund:cash'' WHERE EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.payer_id);
 INSERT INTO astra_refund_accounts(payer_id,debt) VALUES(NEW.payer_id,NEW.debt_added) ON CONFLICT(payer_id) DO UPDATE SET debt=debt+excluded.debt,updated_at=CURRENT_TIMESTAMP;
END'),('astra_refund_settlements','table','CREATE TABLE astra_refund_settlements (
 charge_hash TEXT PRIMARY KEY REFERENCES astra_external_refunds(charge_hash), payer_id INTEGER NOT NULL,
 reversed_dust INTEGER NOT NULL CHECK(reversed_dust>=0), removed INTEGER NOT NULL CHECK(removed>=0), debt_added INTEGER NOT NULL CHECK(debt_added>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(removed+debt_added=reversed_dust)
)'),('astra_register26','trigger','CREATE TRIGGER astra_register26 AFTER INSERT ON astra_users BEGIN
 INSERT INTO astra_user_policy(telegram_id,generation,mode,registered_day) VALUES(NEW.telegram_id,lower(hex(randomblob(16))),''legacy'',date(NEW.created_at,''+3 hours''));
 UPDATE astra_users SET balance=0 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_bonus_profiles26(telegram_id,generation,mode,registered_day,seeded)
 SELECT telegram_id,generation,CASE WHEN EXISTS(SELECT 1 FROM astra_patch26 WHERE activated=1 OR(start_day IS NOT NULL AND date(NEW.created_at,''+3 hours'')>=start_day)) THEN ''new'' ELSE ''legacy'' END,registered_day,1 FROM astra_user_policy WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(''opening:''||NEW.telegram_id,NEW.telegram_id,0,''registration'');
 INSERT INTO astra_bonus_referrals26(invitee,inviter,inviter_generation,invitee_generation,mode,status,created_day)
 SELECT NEW.telegram_id,NEW.referrer_id,i.generation,n.generation,CASE n.mode WHEN ''new'' THEN ''new'' ELSE ''legacy'' END,''pending'',n.registered_day FROM astra_bonus_profiles26 n JOIN astra_bonus_profiles26 i ON i.telegram_id=NEW.referrer_id WHERE n.telegram_id=NEW.telegram_id AND NEW.referrer_id<>NEW.telegram_id;
END'),('astra_reward_claims','table','CREATE TABLE astra_reward_claims (
 claim_id TEXT PRIMARY KEY, telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL, policy_version TEXT NOT NULL DEFAULT ''policy-v2'' CHECK(policy_version=''policy-v2''),
 kind TEXT NOT NULL CHECK(kind IN (''initial'',''daily'',''first3'',''weekly'',''thirty'',''channel'',''referrer'',''invitee'')),
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,''+0 days'') IS NOT NULL AND date(day,''+0 days'')=day), amount INTEGER NOT NULL,
 reference TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(telegram_id,generation,kind,reference),
 CHECK((kind IN (''initial'',''thirty'') AND amount=12) OR (kind IN (''daily'',''first3'') AND amount=3) OR (kind=''weekly'' AND amount=5) OR (kind=''channel'' AND amount=8) OR (kind=''referrer'' AND amount=14) OR (kind=''invitee'' AND amount=4))
)'),('astra_reward_guard','trigger','CREATE TRIGGER astra_reward_guard BEFORE INSERT ON astra_reward_claims BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND enabled=1 AND activated=1 AND NEW.day>=start_day)
 OR NOT EXISTS(SELECT 1 FROM astra_user_policy p JOIN astra_users u USING(telegram_id) WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation)
 THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind=''initial'' AND NOT EXISTS(SELECT 1 FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND mode=''v2'') THEN RAISE(ABORT,''Initial reward requires a new policy profile'') END;
 SELECT CASE WHEN NEW.kind IN (''daily'',''first3'',''weekly'',''thirty'') AND NOT EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=NEW.day) THEN RAISE(ABORT,''Reward requires a policy day'') END;
 SELECT CASE WHEN NEW.kind=''first3'' AND NOT EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak>=3) THEN RAISE(ABORT,''Three-day condition missing'') END;
 SELECT CASE WHEN NEW.kind=''weekly'' AND NOT EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak%7=0) THEN RAISE(ABORT,''Weekly condition missing'') END;
 SELECT CASE WHEN NEW.kind=''thirty'' AND (SELECT count(*) FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day<=NEW.day)<30 THEN RAISE(ABORT,''Thirty distinct dates required'') END;
 SELECT CASE WHEN NEW.kind=''channel'' AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND channel_rewarded=0) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN (''referrer'',''invitee'') AND NOT EXISTS(SELECT 1 FROM astra_referral_payouts p JOIN astra_referral_contracts c ON c.invitee=p.invitee WHERE c.generation=NEW.reference AND c.mode=''v2'' AND c.status IN (''pending'',''eligible'') AND ((NEW.kind=''referrer'' AND c.referrer=NEW.telegram_id) OR (NEW.kind=''invitee'' AND c.invitee=NEW.telegram_id))) THEN RAISE(ABORT,''Referral payout missing'') END;
 SELECT CASE WHEN NEW.claim_id<>''reward:''||NEW.generation||'':''||NEW.kind||'':''||NEW.reference OR NEW.reference IS NULL OR (NEW.kind IN (''daily'',''weekly'') AND NEW.reference<>NEW.day) OR (NEW.kind IN (''initial'',''first3'',''thirty'',''channel'') AND NEW.reference<>''once'') THEN RAISE(ABORT,''Noncanonical reward key'') END;
END'),('astra_reward_immutable','trigger','CREATE TRIGGER astra_reward_immutable BEFORE UPDATE ON astra_reward_claims BEGIN SELECT RAISE(ABORT,''Reward claim immutable''); END'),('astra_shell_erase','trigger','CREATE TRIGGER astra_shell_erase AFTER DELETE ON astra_users BEGIN
  DELETE FROM astra_shell_rewards WHERE telegram_id=OLD.telegram_id;
END'),('astra_shell_reward_guard','trigger','CREATE TRIGGER astra_shell_reward_guard BEFORE INSERT ON astra_shell_rewards BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id)
    THEN RAISE(ABORT,''Reward requires a profile'') END;
END'),('astra_shell_rewards','table','CREATE TABLE astra_shell_rewards (
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK(code=''gpt6''),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id,code)
)'),('astra_tarot_erase26','trigger','CREATE TRIGGER astra_tarot_erase26 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_tarot_purchases26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_tarot_offers26 WHERE telegram_id=OLD.telegram_id;
END'),('astra_tarot_guard26','trigger','CREATE TRIGGER astra_tarot_guard26 BEFORE INSERT ON astra_tarot_purchases26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_tarot_offers26 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id WHERE o.offer_id=NEW.offer_id AND o.telegram_id=NEW.telegram_id AND o.generation=p.generation AND o.price=NEW.price AND u.balance>=NEW.price) THEN RAISE(IGNORE) END;
END'),('astra_tarot_immutable26','trigger','CREATE TRIGGER astra_tarot_immutable26 BEFORE UPDATE ON astra_tarot_purchases26 WHEN NEW.offer_id<>OLD.offer_id OR NEW.telegram_id<>OLD.telegram_id OR NEW.price<>OLD.price OR NEW.result<>OLD.result OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,''Paid Tarot immutable''); END'),('astra_tarot_offers26','table','CREATE TABLE astra_tarot_offers26 (
 offer_id TEXT PRIMARY KEY,telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL,request_key TEXT NOT NULL,
 price INTEGER NOT NULL DEFAULT 5 CHECK(price=5),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(telegram_id,generation,request_key)
)'),('astra_tarot_post26','trigger','CREATE TRIGGER astra_tarot_post26 AFTER INSERT ON astra_tarot_purchases26 BEGIN
 UPDATE astra_users SET balance=balance-5 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(''tarot26:''||NEW.offer_id,NEW.telegram_id,-5,''tarot:v2'');
END'),('astra_tarot_purchases26','table','CREATE TABLE astra_tarot_purchases26 (
 offer_id TEXT PRIMARY KEY REFERENCES astra_tarot_offers26(offer_id),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 price INTEGER NOT NULL CHECK(price=5),result TEXT NOT NULL CHECK(length(trim(result))>0),delivery TEXT NOT NULL DEFAULT ''pending'' CHECK(delivery IN(''pending'',''sending'',''sent'',''retry'',''unknown'',''rejected'')),
 lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_tarot_requests','table','CREATE TABLE astra_tarot_requests (
  request_key TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL
)'),('astra_update_jobs','table','CREATE TABLE astra_update_jobs (
  update_id INTEGER PRIMARY KEY,
  telegram_id INTEGER,
  status TEXT NOT NULL DEFAULT ''working'' CHECK(status IN (''working'',''done'')),
  lease TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  notification_target INTEGER,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_user_policy','table','CREATE TABLE astra_user_policy (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL UNIQUE, mode TEXT NOT NULL CHECK(mode IN (''legacy'',''v2'')), registered_day TEXT NOT NULL
)'),('astra_users','table','CREATE TABLE astra_users (
  telegram_id INTEGER PRIMARY KEY,
  zodiac TEXT,
  balance INTEGER NOT NULL DEFAULT 2 CHECK (balance >= 0),
  referrer_id INTEGER,
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  channel_rewarded INTEGER NOT NULL DEFAULT 0,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  last_gift_day TEXT,
  last_broadcast_day TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('astra_wallet_ledger','table','CREATE TABLE astra_wallet_ledger (
  idempotency_key TEXT PRIMARY KEY,
  operation_id TEXT UNIQUE REFERENCES astra_operations(operation_id) ON DELETE CASCADE,
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'),('idx_astra_broadcast','index','CREATE INDEX idx_astra_broadcast
  ON astra_users (notifications_enabled, last_broadcast_day, telegram_id)'),('idx_astra_jobs_owner','index','CREATE INDEX idx_astra_jobs_owner ON astra_update_jobs(telegram_id)'),('idx_astra_ledger_history','index','CREATE INDEX idx_astra_ledger_history
 ON astra_wallet_ledger(telegram_id,created_at DESC,idempotency_key DESC)'),('idx_astra_ledger_owner','index','CREATE INDEX idx_astra_ledger_owner ON astra_wallet_ledger(telegram_id)'),('idx_astra_ops_owner','index','CREATE INDEX idx_astra_ops_owner ON astra_operations(telegram_id, reason, delivery)'),('idx_astra_tarot_requests_owner','index','CREATE INDEX idx_astra_tarot_requests_owner ON astra_tarot_requests(telegram_id)'),('idx_bonus_awards26_owner','index','CREATE INDEX idx_bonus_awards26_owner ON astra_bonus_awards26(telegram_id,kind,day)'),('idx_bonus_fences26_expiry','index','CREATE INDEX idx_bonus_fences26_expiry ON astra_bonus_fences26(expires_at)'),('idx_broadcast_jobs_day03','index','CREATE INDEX idx_broadcast_jobs_day03 ON astra_broadcast_jobs(day,telegram_id)'),('idx_broadcast_outbox03_due','index','CREATE INDEX idx_broadcast_outbox03_due ON astra_broadcast_outbox03(day,state,not_before,telegram_id)'),('idx_consent28_active','index','CREATE INDEX idx_consent28_active ON astra_notification_consent28(telegram_id,generation,revision) WHERE consent_at IS NOT NULL AND revoked_at IS NULL'),('idx_consent28_pending','index','CREATE INDEX idx_consent28_pending ON astra_notification_consent28(pending_expires_at) WHERE pending_hash IS NOT NULL'),('idx_forecast_daily_day','index','CREATE INDEX idx_forecast_daily_day ON astra_forecast_daily(day)'),('idx_forecast_unlocks_day','index','CREATE INDEX idx_forecast_unlocks_day ON astra_forecast_unlocks(day)'),('idx_payment_orders26_owner','index','CREATE INDEX idx_payment_orders26_owner ON astra_payment_orders26(payer_id,created_at DESC,order_id DESC)'),('idx_payment_orders_owner','index','CREATE INDEX idx_payment_orders_owner ON astra_payment_orders(payer_id,created_at DESC,order_id DESC)'),('idx_policy_events_owner','index','CREATE INDEX idx_policy_events_owner ON astra_policy_events(telegram_id,processed,day,update_id)'),('idx_reward_claims_owner','index','CREATE INDEX idx_reward_claims_owner ON astra_reward_claims(telegram_id,kind,day)'),('idx_tarot_purchases26_owner','index','CREATE INDEX idx_tarot_purchases26_owner ON astra_tarot_purchases26(telegram_id,created_at,offer_id)'),('astra_tarot25_complete29','trigger','CREATE TRIGGER astra_tarot25_complete29 BEFORE UPDATE OF migration_done ON astra_tarot25_runtime29 WHEN NEW.migration_done=1 BEGIN
 SELECT CASE WHEN OLD.migration_done=0 AND NEW.enabled<>0 THEN RAISE(ABORT,''Tarot migration must complete OFF'') END;
 SELECT CASE WHEN (WITH expected(name,type,sql) AS (VALUES (''astra_tarot25_erase29'',''trigger'',''CREATE TRIGGER astra_tarot25_erase29 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_tarot25_purchases29 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_tarot25_offers29 WHERE telegram_id=OLD.telegram_id;
END''),(''astra_tarot25_ledger_delete29'',''trigger'',''CREATE TRIGGER astra_tarot25_ledger_delete29 BEFORE DELETE ON astra_wallet_ledger WHEN OLD.reason=''''tarot:v25'''' AND EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,''''Erase Tarot ledger with profile'''');END''),(''astra_tarot25_ledger_guard29'',''trigger'',''CREATE TRIGGER astra_tarot25_ledger_guard29 BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason=''''tarot:v25'''' OR NEW.idempotency_key LIKE ''''tarot25:%'''' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key=NEW.idempotency_key) THEN RAISE(ABORT,''''Tarot ledger already exists'''') END;
 SELECT CASE WHEN NEW.operation_id IS NOT NULL OR NEW.reason<>''''tarot:v25'''' OR NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 p WHERE ''''tarot25:''''||p.offer_id=NEW.idempotency_key AND p.telegram_id=NEW.telegram_id AND NEW.delta=-p.price) THEN RAISE(ABORT,''''Tarot ledger requires paid snapshot'''') END;
END''),(''astra_tarot25_ledger_update29'',''trigger'',''CREATE TRIGGER astra_tarot25_ledger_update29 BEFORE UPDATE ON astra_wallet_ledger WHEN OLD.reason=''''tarot:v25'''' OR OLD.idempotency_key LIKE ''''tarot25:%'''' OR NEW.reason=''''tarot:v25'''' OR NEW.idempotency_key LIKE ''''tarot25:%'''' BEGIN SELECT RAISE(ABORT,''''Tarot ledger immutable'''');END''),(''astra_tarot25_offer_delete29'',''trigger'',''CREATE TRIGGER astra_tarot25_offer_delete29 BEFORE DELETE ON astra_tarot25_offers29 WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,''''Erase Tarot offers with profile'''');END''),(''astra_tarot25_offer_guard29'',''trigger'',''CREATE TRIGGER astra_tarot25_offer_guard29 BEFORE INSERT ON astra_tarot25_offers29 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_offers29 WHERE offer_id=NEW.offer_id OR (telegram_id=NEW.telegram_id AND generation=NEW.generation AND (request_key=NEW.request_key OR update_id=NEW.update_id))) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.status<>''''open'''' OR NEW.created_at<>unixepoch() OR NOT EXISTS(
 SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_tarot25_runtime29 r ON r.singleton=1
 JOIN astra_tarot25_prices29 t ON t.price_version=r.price_version AND t.spread_id=NEW.spread_id
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND r.migration_done=1 AND r.enabled=1 AND r.revision=NEW.policy_revision
 AND t.price=NEW.price AND t.size=NEW.size AND (t.theme=''''general'''' OR t.theme=NEW.theme) AND t.price_version=NEW.price_version) THEN RAISE(ABORT,''''Tarot offer gate/authority mismatch'''') END;
 SELECT CASE WHEN NEW.deck_version<>''''rws78-v1'''' OR NEW.engine_version<>''''tarot25-v1'''' OR NEW.spread_version<>''''tarot25-spreads-v1'''' OR NEW.snapshot_version<>''''tarot25-snapshot-v1'''' THEN RAISE(ABORT,''''Unsupported Tarot reader'''') END;
 SELECT CASE WHEN coalesce(json_extract(NEW.snapshot_json,''''$.snapshot_version''''),'''''''')<>NEW.snapshot_version OR coalesce(json_extract(NEW.snapshot_json,''''$.deck_version''''),'''''''')<>NEW.deck_version OR coalesce(json_extract(NEW.snapshot_json,''''$.engine_version''''),'''''''')<>NEW.engine_version OR coalesce(json_extract(NEW.snapshot_json,''''$.spread_version''''),'''''''')<>NEW.spread_version OR coalesce(json_extract(NEW.snapshot_json,''''$.spread_id''''),'''''''')<>NEW.spread_id OR coalesce(json_extract(NEW.snapshot_json,''''$.theme''''),'''''''')<>NEW.theme OR coalesce(json_extract(NEW.snapshot_json,''''$.text''''),'''''''')<>NEW.result THEN RAISE(ABORT,''''Tarot snapshot metadata mismatch'''') END;
 SELECT CASE WHEN json_type(NEW.snapshot_json,''''$.created_at'''') IS NOT ''''text'''' OR length(json_extract(NEW.snapshot_json,''''$.created_at''''))<>24 OR strftime(''''%Y-%m-%dT%H:%M:%fZ'''',json_extract(NEW.snapshot_json,''''$.created_at''''),''''+0 days'''') IS NOT json_extract(NEW.snapshot_json,''''$.created_at'''') THEN RAISE(ABORT,''''Invalid snapshot UTC'''') END;
 SELECT CASE WHEN coalesce(json_array_length(NEW.snapshot_json,''''$.cards''''),0)<>NEW.size OR coalesce(json_array_length(NEW.snapshot_json,''''$.interpretation.positions''''),0)<>NEW.size
 OR (SELECT count(DISTINCT json_extract(value,''''$.card_id'''')) FROM json_each(NEW.snapshot_json,''''$.cards''''))<>NEW.size THEN RAISE(ABORT,''''Invalid Tarot draw size/duplicates'''') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.snapshot_json,''''$.cards'''') d WHERE coalesce(json_extract(d.value,''''$.card_id''''),'''''''') NOT IN(''''major-00'''',''''major-01'''',''''major-02'''',''''major-03'''',''''major-04'''',''''major-05'''',''''major-06'''',''''major-07'''',''''major-08'''',''''major-09'''',''''major-10'''',''''major-11'''',''''major-12'''',''''major-13'''',''''major-14'''',''''major-15'''',''''major-16'''',''''major-17'''',''''major-18'''',''''major-19'''',''''major-20'''',''''major-21'''',''''wands-ace'''',''''wands-02'''',''''wands-03'''',''''wands-04'''',''''wands-05'''',''''wands-06'''',''''wands-07'''',''''wands-08'''',''''wands-09'''',''''wands-10'''',''''wands-page'''',''''wands-knight'''',''''wands-queen'''',''''wands-king'''',''''cups-ace'''',''''cups-02'''',''''cups-03'''',''''cups-04'''',''''cups-05'''',''''cups-06'''',''''cups-07'''',''''cups-08'''',''''cups-09'''',''''cups-10'''',''''cups-page'''',''''cups-knight'''',''''cups-queen'''',''''cups-king'''',''''swords-ace'''',''''swords-02'''',''''swords-03'''',''''swords-04'''',''''swords-05'''',''''swords-06'''',''''swords-07'''',''''swords-08'''',''''swords-09'''',''''swords-10'''',''''swords-page'''',''''swords-knight'''',''''swords-queen'''',''''swords-king'''',''''pentacles-ace'''',''''pentacles-02'''',''''pentacles-03'''',''''pentacles-04'''',''''pentacles-05'''',''''pentacles-06'''',''''pentacles-07'''',''''pentacles-08'''',''''pentacles-09'''',''''pentacles-10'''',''''pentacles-page'''',''''pentacles-knight'''',''''pentacles-queen'''',''''pentacles-king'''') OR json_type(d.value,''''$.reversed'''') NOT IN(''''true'''',''''false'''') OR json_type(d.value,''''$.reversed'''') IS NULL
 OR coalesce(json_extract(d.value,''''$.position_id''''),'''''''')<>(SELECT json_extract(positions_json,''''$[''''||d.key||'''']'''') FROM astra_tarot25_prices29 WHERE price_version=NEW.price_version AND spread_id=NEW.spread_id)
 OR coalesce(json_extract(NEW.snapshot_json,''''$.interpretation.positions[''''||d.key||''''].card_id''''),'''''''')<>json_extract(d.value,''''$.card_id'''')
 OR coalesce(json_extract(NEW.snapshot_json,''''$.interpretation.positions[''''||d.key||''''].position_id''''),'''''''')<>json_extract(d.value,''''$.position_id'''')
 OR json_extract(NEW.snapshot_json,''''$.interpretation.positions[''''||d.key||''''].reversed'''') IS NOT json_extract(d.value,''''$.reversed'''')) THEN RAISE(ABORT,''''Forged Tarot draw'''') END;
 SELECT CASE WHEN NOT coalesce((
 (json_type(NEW.snapshot_json,''''$.question'''')=''''null'''' AND json_type(NEW.snapshot_json,''''$.question_consent'''')=''''false'''') OR
 (json_type(NEW.snapshot_json,''''$.question'''')=''''text'''' AND length(trim(json_extract(NEW.snapshot_json,''''$.question''''))) BETWEEN 1 AND 500 AND json_type(NEW.snapshot_json,''''$.question_consent'''')=''''true'''')
 ),0) OR json_type(NEW.snapshot_json,''''$.question'''') IS NULL OR json_type(NEW.snapshot_json,''''$.question_consent'''') IS NULL THEN RAISE(ABORT,''''Question consent missing'''') END;
 SELECT CASE WHEN NEW.result IS NOT CASE WHEN json_type(NEW.snapshot_json,''''$.question'''')=''''null'''' THEN json_extract(NEW.snapshot_json,''''$.interpretation.text'''') ELSE ''''Вопрос: ''''||json_extract(NEW.snapshot_json,''''$.question'''')||char(10)||char(10)||json_extract(NEW.snapshot_json,''''$.interpretation.text'''') END THEN RAISE(ABORT,''''Tarot text mismatch'''') END;
END''),(''astra_tarot25_offer_update29'',''trigger'',''CREATE TRIGGER astra_tarot25_offer_update29 BEFORE UPDATE ON astra_tarot25_offers29 WHEN NEW.offer_id IS NOT OLD.offer_id OR NEW.telegram_id IS NOT OLD.telegram_id OR NEW.generation IS NOT OLD.generation OR NEW.request_key IS NOT OLD.request_key OR NEW.update_id IS NOT OLD.update_id OR NEW.spread_id IS NOT OLD.spread_id OR NEW.theme IS NOT OLD.theme OR NEW.size IS NOT OLD.size OR NEW.price IS NOT OLD.price OR NEW.price_version IS NOT OLD.price_version OR NEW.policy_revision IS NOT OLD.policy_revision OR NEW.deck_version IS NOT OLD.deck_version OR NEW.engine_version IS NOT OLD.engine_version OR NEW.spread_version IS NOT OLD.spread_version OR NEW.snapshot_version IS NOT OLD.snapshot_version OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.result IS NOT OLD.result OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR NEW.status<>''''cancelled'''' OR OLD.status<>''''open'''' BEGIN SELECT RAISE(ABORT,''''Tarot offer immutable'''');END''),(''astra_tarot25_offers29'',''table'',''CREATE TABLE astra_tarot25_offers29 (
 offer_id TEXT PRIMARY KEY NOT NULL CHECK(length(offer_id)=32 AND offer_id NOT GLOB ''''*[^a-f0-9]*''''),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL,request_key TEXT NOT NULL CHECK(length(request_key) BETWEEN 1 AND 128),update_id INTEGER NOT NULL CHECK(update_id>=0),
 spread_id TEXT NOT NULL,theme TEXT NOT NULL CHECK(theme IN(''''general'''',''''relations'''',''''work'''',''''choice'''',''''resources'''',''''self'''')),size INTEGER NOT NULL,
 price INTEGER NOT NULL,price_version TEXT NOT NULL,policy_revision INTEGER NOT NULL,
 deck_version TEXT NOT NULL,engine_version TEXT NOT NULL,spread_version TEXT NOT NULL,snapshot_version TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND length(CAST(snapshot_json AS BLOB))<=900000),result TEXT NOT NULL CHECK(length(result) BETWEEN 1 AND 60000),
 status TEXT NOT NULL DEFAULT ''''open'''' CHECK(status IN(''''open'''',''''cancelled'''')),created_at INTEGER NOT NULL DEFAULT(unixepoch()),expires_at INTEGER NOT NULL,
 UNIQUE(telegram_id,generation,request_key),UNIQUE(telegram_id,generation,update_id),CHECK(expires_at=created_at+900),
 FOREIGN KEY(price_version,spread_id) REFERENCES astra_tarot25_prices29(price_version,spread_id)
)''),(''astra_tarot25_price_delete29'',''trigger'',''CREATE TRIGGER astra_tarot25_price_delete29 BEFORE DELETE ON astra_tarot25_prices29 BEGIN SELECT RAISE(ABORT,''''Tarot price version immutable'''');END''),(''astra_tarot25_price_guard29'',''trigger'',''CREATE TRIGGER astra_tarot25_price_guard29 BEFORE INSERT ON astra_tarot25_prices29 BEGIN
 SELECT CASE WHEN NEW.price_version<>''''tarot25-prices-proposal-v1'''' OR NOT((NEW.spread_id=''''basic-3'''' AND NEW.size=3 AND NEW.price=5 AND NEW.theme=''''general'''' AND NEW.positions_json=''''["situation","obstacle","advice"]'''') OR (NEW.spread_id=''''relations-3'''' AND NEW.size=3 AND NEW.price=8 AND NEW.theme=''''relations'''' AND NEW.positions_json=''''["self","between","care"]'''') OR (NEW.spread_id=''''work-3'''' AND NEW.size=3 AND NEW.price=8 AND NEW.theme=''''work'''' AND NEW.positions_json=''''["task","means","practice"]'''') OR (NEW.spread_id=''''choice-3'''' AND NEW.size=3 AND NEW.price=8 AND NEW.theme=''''choice'''' AND NEW.positions_json=''''["criterion","tension","test"]'''') OR (NEW.spread_id=''''depth-5'''' AND NEW.size=5 AND NEW.price=14 AND NEW.theme=''''general'''' AND NEW.positions_json=''''["resource","barrier","tendency","step","integration"]'''') OR (NEW.spread_id=''''depth-7'''' AND NEW.size=7 AND NEW.price=21 AND NEW.theme=''''general'''' AND NEW.positions_json=''''["core","roots","inner","outer","obstacle","support","direction"]'''') OR (NEW.spread_id=''''celtic-10'''' AND NEW.size=10 AND NEW.price=32 AND NEW.theme=''''general'''' AND NEW.positions_json=''''["present","crossing","foundation","past","crown","near","self","environment","hopes","outcome"]'''')) THEN RAISE(ABORT,''''Unsupported Tarot price'''') END;
END''),(''astra_tarot25_price_update29'',''trigger'',''CREATE TRIGGER astra_tarot25_price_update29 BEFORE UPDATE ON astra_tarot25_prices29 BEGIN SELECT RAISE(ABORT,''''Tarot price version immutable'''');END''),(''astra_tarot25_prices29'',''table'',''CREATE TABLE astra_tarot25_prices29 (
 price_version TEXT NOT NULL,spread_id TEXT NOT NULL,size INTEGER NOT NULL CHECK(size IN(3,5,7,10)),price INTEGER NOT NULL CHECK(price IN(5,8,14,21,32)),
 theme TEXT NOT NULL,positions_json TEXT NOT NULL CHECK(json_valid(positions_json)),PRIMARY KEY(price_version,spread_id)
)''),(''astra_tarot25_purchase_delete29'',''trigger'',''CREATE TRIGGER astra_tarot25_purchase_delete29 BEFORE DELETE ON astra_tarot25_purchases29 WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,''''Erase paid Tarot with profile'''');END''),(''astra_tarot25_purchase_guard29'',''trigger'',''CREATE TRIGGER astra_tarot25_purchase_guard29 BEFORE INSERT ON astra_tarot25_purchases29 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=NEW.offer_id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key=''''tarot25:''''||NEW.offer_id) THEN RAISE(ABORT,''''Tarot debit already recorded'''') END;
 SELECT CASE WHEN NEW.delivery<>''''pending'''' OR NEW.attempts<>0 OR NEW.lease IS NOT NULL OR NEW.lease_until<>0 OR NEW.not_before<>0 OR NEW.parts_sent<>0 OR NEW.last_code IS NOT NULL OR NEW.created_at<>unixepoch() OR NOT EXISTS(
 SELECT 1 FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id JOIN astra_tarot25_runtime29 r ON r.singleton=1
 WHERE o.offer_id=NEW.offer_id AND o.telegram_id=NEW.telegram_id AND o.generation=NEW.generation AND o.price=NEW.price AND o.price_version=NEW.price_version AND o.spread_id=NEW.spread_id AND o.theme=NEW.theme AND o.size=NEW.size AND o.snapshot_json=NEW.snapshot_json AND o.result=NEW.result AND o.deck_version=NEW.deck_version AND o.engine_version=NEW.engine_version AND o.spread_version=NEW.spread_version AND o.snapshot_version=NEW.snapshot_version AND p.generation=o.generation AND u.balance>=o.price
 AND o.status=''''open'''' AND o.expires_at>unixepoch() AND r.migration_done=1 AND r.enabled=1 AND r.price_version=o.price_version AND r.revision=o.policy_revision) THEN RAISE(ABORT,''''Tarot purchase authority/funds/gate mismatch'''') END;
END''),(''astra_tarot25_purchase_post29'',''trigger'',''CREATE TRIGGER astra_tarot25_purchase_post29 AFTER INSERT ON astra_tarot25_purchases29 BEGIN
 UPDATE astra_users SET balance=balance-NEW.price WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(''''tarot25:''''||NEW.offer_id,NEW.telegram_id,-NEW.price,''''tarot:v25'''');
END''),(''astra_tarot25_purchase_update29'',''trigger'',''CREATE TRIGGER astra_tarot25_purchase_update29 BEFORE UPDATE ON astra_tarot25_purchases29 BEGIN
 SELECT CASE WHEN NEW.offer_id IS NOT OLD.offer_id OR NEW.telegram_id IS NOT OLD.telegram_id OR NEW.generation IS NOT OLD.generation OR NEW.price IS NOT OLD.price OR NEW.price_version IS NOT OLD.price_version OR NEW.spread_id IS NOT OLD.spread_id OR NEW.theme IS NOT OLD.theme OR NEW.size IS NOT OLD.size OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.result IS NOT OLD.result OR NEW.deck_version IS NOT OLD.deck_version OR NEW.engine_version IS NOT OLD.engine_version OR NEW.spread_version IS NOT OLD.spread_version OR NEW.snapshot_version IS NOT OLD.snapshot_version OR NEW.created_at IS NOT OLD.created_at THEN RAISE(ABORT,''''Paid Tarot snapshot immutable'''') END;
 SELECT CASE WHEN NOT (
 (OLD.delivery IN(''''pending'''',''''retry'''',''''unknown'''',''''sent'''',''''rejected'''') AND NEW.delivery=''''sending'''' AND NEW.attempts=OLD.attempts+1 AND NEW.lease IS NOT NULL AND NEW.lease IS NOT OLD.lease AND NEW.lease_until>unixepoch() AND OLD.not_before<=unixepoch()) OR
 (OLD.delivery=''''sending'''' AND NEW.delivery IN(''''sent'''',''''retry'''',''''unknown'''',''''rejected'''',''''cancelled'''') AND NEW.attempts=OLD.attempts AND NEW.lease IS OLD.lease AND NEW.lease_until=0) OR
 (OLD.delivery IN(''''pending'''',''''retry'''',''''unknown'''',''''rejected'''') AND NEW.delivery=''''cancelled'''' AND NEW.attempts=OLD.attempts AND NEW.lease IS OLD.lease AND NEW.lease_until=0)
 ) THEN RAISE(ABORT,''''Invalid Tarot delivery transition'''') END;
END''),(''astra_tarot25_purchases29'',''table'',''CREATE TABLE astra_tarot25_purchases29 (
 offer_id TEXT PRIMARY KEY NOT NULL REFERENCES astra_tarot25_offers29(offer_id),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL,price INTEGER NOT NULL,price_version TEXT NOT NULL,spread_id TEXT NOT NULL,theme TEXT NOT NULL,size INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),result TEXT NOT NULL,deck_version TEXT NOT NULL,engine_version TEXT NOT NULL,spread_version TEXT NOT NULL,snapshot_version TEXT NOT NULL,
 delivery TEXT NOT NULL DEFAULT ''''pending'''' CHECK(delivery IN(''''pending'''',''''sending'''',''''sent'''',''''retry'''',''''unknown'''',''''rejected'''',''''cancelled'''')),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,not_before INTEGER NOT NULL DEFAULT 0,parts_sent INTEGER NOT NULL DEFAULT 0 CHECK(parts_sent BETWEEN 0 AND 30),last_code INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch())
)''),(''astra_tarot25_runtime29'',''table'',''CREATE TABLE astra_tarot25_runtime29 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL DEFAULT ''''tarot25-policy-v1'''' CHECK(version=''''tarot25-policy-v1''''),
 migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1)),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 price_version TEXT NOT NULL DEFAULT ''''tarot25-prices-proposal-v1'''',revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
)''),(''astra_tarot25_runtime_delete29'',''trigger'',''CREATE TRIGGER astra_tarot25_runtime_delete29 BEFORE DELETE ON astra_tarot25_runtime29 BEGIN SELECT RAISE(ABORT,''''Tarot runtime required'''');END''),(''astra_tarot25_runtime_guard29'',''trigger'',''CREATE TRIGGER astra_tarot25_runtime_guard29 BEFORE UPDATE ON astra_tarot25_runtime29 BEGIN
 SELECT CASE WHEN NEW.enabled=1 AND NEW.migration_done<>1 THEN RAISE(ABORT,''''Tarot migration must finish before enable'''') END;
 SELECT CASE WHEN NEW.singleton<>OLD.singleton OR NEW.version<>OLD.version OR NEW.revision<OLD.revision OR (OLD.migration_done=1 AND NEW.migration_done<>1) THEN RAISE(ABORT,''''Invalid Tarot runtime transition'''') END;
END''),(''astra_tarot25_runtime_insert29'',''trigger'',''CREATE TRIGGER astra_tarot25_runtime_insert29 BEFORE INSERT ON astra_tarot25_runtime29 WHEN EXISTS(SELECT 1 FROM astra_tarot25_runtime29 WHERE singleton=NEW.singleton) BEGIN SELECT RAISE(IGNORE);END''),(''astra_tarot25_runtime_revision29'',''trigger'',''CREATE TRIGGER astra_tarot25_runtime_revision29 AFTER UPDATE OF enabled,price_version ON astra_tarot25_runtime29 WHEN NEW.enabled<>OLD.enabled OR NEW.price_version<>OLD.price_version BEGIN
 UPDATE astra_tarot25_runtime29 SET revision=revision+1 WHERE singleton=1;
END''),(''idx_tarot25_offers29_owner'',''index'',''CREATE INDEX idx_tarot25_offers29_owner ON astra_tarot25_offers29(telegram_id,generation,created_at,offer_id)''),(''idx_tarot25_purchases29_owner'',''index'',''CREATE INDEX idx_tarot25_purchases29_owner ON astra_tarot25_purchases29(telegram_id,generation,created_at DESC,offer_id DESC)'')) SELECT count(*) FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR a.sql IS NOT e.sql)>0 THEN RAISE(ABORT,''Tarot29 definition mismatch'') END;
 SELECT CASE WHEN (WITH expected(price_version,spread_id,size,price,theme,positions_json) AS (VALUES (''tarot25-prices-proposal-v1'',''basic-3'',3,5,''general'',''["situation","obstacle","advice"]''),(''tarot25-prices-proposal-v1'',''relations-3'',3,8,''relations'',''["self","between","care"]''),(''tarot25-prices-proposal-v1'',''work-3'',3,8,''work'',''["task","means","practice"]''),(''tarot25-prices-proposal-v1'',''choice-3'',3,8,''choice'',''["criterion","tension","test"]''),(''tarot25-prices-proposal-v1'',''depth-5'',5,14,''general'',''["resource","barrier","tendency","step","integration"]''),(''tarot25-prices-proposal-v1'',''depth-7'',7,21,''general'',''["core","roots","inner","outer","obstacle","support","direction"]''),(''tarot25-prices-proposal-v1'',''celtic-10'',10,32,''general'',''["present","crossing","foundation","past","crown","near","self","environment","hopes","outcome"]'')) SELECT count(*) FROM expected e LEFT JOIN astra_tarot25_prices29 t USING(price_version,spread_id) WHERE t.size IS NOT e.size OR t.price IS NOT e.price OR t.theme IS NOT e.theme OR t.positions_json IS NOT e.positions_json)>0 THEN RAISE(ABORT,''Tarot29 price data mismatch'') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_consent_runtime28 WHERE singleton=1 AND migration_done=1) OR NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1 AND migration_done=1) OR (SELECT count(*) FROM astra_tarot25_prices29)<>7 THEN RAISE(ABORT,''Tarot29 prerequisites incomplete'') END;
END'),('astra_tarot25_erase29','trigger','CREATE TRIGGER astra_tarot25_erase29 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_tarot25_purchases29 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_tarot25_offers29 WHERE telegram_id=OLD.telegram_id;
END'),('astra_tarot25_ledger_delete29','trigger','CREATE TRIGGER astra_tarot25_ledger_delete29 BEFORE DELETE ON astra_wallet_ledger WHEN OLD.reason=''tarot:v25'' AND EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,''Erase Tarot ledger with profile'');END'),('astra_tarot25_ledger_guard29','trigger','CREATE TRIGGER astra_tarot25_ledger_guard29 BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason=''tarot:v25'' OR NEW.idempotency_key LIKE ''tarot25:%'' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key=NEW.idempotency_key) THEN RAISE(ABORT,''Tarot ledger already exists'') END;
 SELECT CASE WHEN NEW.operation_id IS NOT NULL OR NEW.reason<>''tarot:v25'' OR NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 p WHERE ''tarot25:''||p.offer_id=NEW.idempotency_key AND p.telegram_id=NEW.telegram_id AND NEW.delta=-p.price) THEN RAISE(ABORT,''Tarot ledger requires paid snapshot'') END;
END'),('astra_tarot25_ledger_update29','trigger','CREATE TRIGGER astra_tarot25_ledger_update29 BEFORE UPDATE ON astra_wallet_ledger WHEN OLD.reason=''tarot:v25'' OR OLD.idempotency_key LIKE ''tarot25:%'' OR NEW.reason=''tarot:v25'' OR NEW.idempotency_key LIKE ''tarot25:%'' BEGIN SELECT RAISE(ABORT,''Tarot ledger immutable'');END'),('astra_tarot25_offer_delete29','trigger','CREATE TRIGGER astra_tarot25_offer_delete29 BEFORE DELETE ON astra_tarot25_offers29 WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,''Erase Tarot offers with profile'');END'),('astra_tarot25_offer_guard29','trigger','CREATE TRIGGER astra_tarot25_offer_guard29 BEFORE INSERT ON astra_tarot25_offers29 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_offers29 WHERE offer_id=NEW.offer_id OR (telegram_id=NEW.telegram_id AND generation=NEW.generation AND (request_key=NEW.request_key OR update_id=NEW.update_id))) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.status<>''open'' OR NEW.created_at<>unixepoch() OR NOT EXISTS(
 SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_tarot25_runtime29 r ON r.singleton=1
 JOIN astra_tarot25_prices29 t ON t.price_version=r.price_version AND t.spread_id=NEW.spread_id
 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND r.migration_done=1 AND r.enabled=1 AND r.revision=NEW.policy_revision
 AND t.price=NEW.price AND t.size=NEW.size AND (t.theme=''general'' OR t.theme=NEW.theme) AND t.price_version=NEW.price_version) THEN RAISE(ABORT,''Tarot offer gate/authority mismatch'') END;
 SELECT CASE WHEN NEW.deck_version<>''rws78-v1'' OR NEW.engine_version<>''tarot25-v1'' OR NEW.spread_version<>''tarot25-spreads-v1'' OR NEW.snapshot_version<>''tarot25-snapshot-v1'' THEN RAISE(ABORT,''Unsupported Tarot reader'') END;
 SELECT CASE WHEN coalesce(json_extract(NEW.snapshot_json,''$.snapshot_version''),'''')<>NEW.snapshot_version OR coalesce(json_extract(NEW.snapshot_json,''$.deck_version''),'''')<>NEW.deck_version OR coalesce(json_extract(NEW.snapshot_json,''$.engine_version''),'''')<>NEW.engine_version OR coalesce(json_extract(NEW.snapshot_json,''$.spread_version''),'''')<>NEW.spread_version OR coalesce(json_extract(NEW.snapshot_json,''$.spread_id''),'''')<>NEW.spread_id OR coalesce(json_extract(NEW.snapshot_json,''$.theme''),'''')<>NEW.theme OR coalesce(json_extract(NEW.snapshot_json,''$.text''),'''')<>NEW.result THEN RAISE(ABORT,''Tarot snapshot metadata mismatch'') END;
 SELECT CASE WHEN json_type(NEW.snapshot_json,''$.created_at'') IS NOT ''text'' OR length(json_extract(NEW.snapshot_json,''$.created_at''))<>24 OR strftime(''%Y-%m-%dT%H:%M:%fZ'',json_extract(NEW.snapshot_json,''$.created_at''),''+0 days'') IS NOT json_extract(NEW.snapshot_json,''$.created_at'') THEN RAISE(ABORT,''Invalid snapshot UTC'') END;
 SELECT CASE WHEN coalesce(json_array_length(NEW.snapshot_json,''$.cards''),0)<>NEW.size OR coalesce(json_array_length(NEW.snapshot_json,''$.interpretation.positions''),0)<>NEW.size
 OR (SELECT count(DISTINCT json_extract(value,''$.card_id'')) FROM json_each(NEW.snapshot_json,''$.cards''))<>NEW.size THEN RAISE(ABORT,''Invalid Tarot draw size/duplicates'') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.snapshot_json,''$.cards'') d WHERE coalesce(json_extract(d.value,''$.card_id''),'''') NOT IN(''major-00'',''major-01'',''major-02'',''major-03'',''major-04'',''major-05'',''major-06'',''major-07'',''major-08'',''major-09'',''major-10'',''major-11'',''major-12'',''major-13'',''major-14'',''major-15'',''major-16'',''major-17'',''major-18'',''major-19'',''major-20'',''major-21'',''wands-ace'',''wands-02'',''wands-03'',''wands-04'',''wands-05'',''wands-06'',''wands-07'',''wands-08'',''wands-09'',''wands-10'',''wands-page'',''wands-knight'',''wands-queen'',''wands-king'',''cups-ace'',''cups-02'',''cups-03'',''cups-04'',''cups-05'',''cups-06'',''cups-07'',''cups-08'',''cups-09'',''cups-10'',''cups-page'',''cups-knight'',''cups-queen'',''cups-king'',''swords-ace'',''swords-02'',''swords-03'',''swords-04'',''swords-05'',''swords-06'',''swords-07'',''swords-08'',''swords-09'',''swords-10'',''swords-page'',''swords-knight'',''swords-queen'',''swords-king'',''pentacles-ace'',''pentacles-02'',''pentacles-03'',''pentacles-04'',''pentacles-05'',''pentacles-06'',''pentacles-07'',''pentacles-08'',''pentacles-09'',''pentacles-10'',''pentacles-page'',''pentacles-knight'',''pentacles-queen'',''pentacles-king'') OR json_type(d.value,''$.reversed'') NOT IN(''true'',''false'') OR json_type(d.value,''$.reversed'') IS NULL
 OR coalesce(json_extract(d.value,''$.position_id''),'''')<>(SELECT json_extract(positions_json,''$[''||d.key||'']'') FROM astra_tarot25_prices29 WHERE price_version=NEW.price_version AND spread_id=NEW.spread_id)
 OR coalesce(json_extract(NEW.snapshot_json,''$.interpretation.positions[''||d.key||''].card_id''),'''')<>json_extract(d.value,''$.card_id'')
 OR coalesce(json_extract(NEW.snapshot_json,''$.interpretation.positions[''||d.key||''].position_id''),'''')<>json_extract(d.value,''$.position_id'')
 OR json_extract(NEW.snapshot_json,''$.interpretation.positions[''||d.key||''].reversed'') IS NOT json_extract(d.value,''$.reversed'')) THEN RAISE(ABORT,''Forged Tarot draw'') END;
 SELECT CASE WHEN NOT coalesce((
 (json_type(NEW.snapshot_json,''$.question'')=''null'' AND json_type(NEW.snapshot_json,''$.question_consent'')=''false'') OR
 (json_type(NEW.snapshot_json,''$.question'')=''text'' AND length(trim(json_extract(NEW.snapshot_json,''$.question''))) BETWEEN 1 AND 500 AND json_type(NEW.snapshot_json,''$.question_consent'')=''true'')
 ),0) OR json_type(NEW.snapshot_json,''$.question'') IS NULL OR json_type(NEW.snapshot_json,''$.question_consent'') IS NULL THEN RAISE(ABORT,''Question consent missing'') END;
 SELECT CASE WHEN NEW.result IS NOT CASE WHEN json_type(NEW.snapshot_json,''$.question'')=''null'' THEN json_extract(NEW.snapshot_json,''$.interpretation.text'') ELSE ''Вопрос: ''||json_extract(NEW.snapshot_json,''$.question'')||char(10)||char(10)||json_extract(NEW.snapshot_json,''$.interpretation.text'') END THEN RAISE(ABORT,''Tarot text mismatch'') END;
END'),('astra_tarot25_offer_update29','trigger','CREATE TRIGGER astra_tarot25_offer_update29 BEFORE UPDATE ON astra_tarot25_offers29 WHEN NEW.offer_id IS NOT OLD.offer_id OR NEW.telegram_id IS NOT OLD.telegram_id OR NEW.generation IS NOT OLD.generation OR NEW.request_key IS NOT OLD.request_key OR NEW.update_id IS NOT OLD.update_id OR NEW.spread_id IS NOT OLD.spread_id OR NEW.theme IS NOT OLD.theme OR NEW.size IS NOT OLD.size OR NEW.price IS NOT OLD.price OR NEW.price_version IS NOT OLD.price_version OR NEW.policy_revision IS NOT OLD.policy_revision OR NEW.deck_version IS NOT OLD.deck_version OR NEW.engine_version IS NOT OLD.engine_version OR NEW.spread_version IS NOT OLD.spread_version OR NEW.snapshot_version IS NOT OLD.snapshot_version OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.result IS NOT OLD.result OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR NEW.status<>''cancelled'' OR OLD.status<>''open'' BEGIN SELECT RAISE(ABORT,''Tarot offer immutable'');END'),('astra_tarot25_offers29','table','CREATE TABLE astra_tarot25_offers29 (
 offer_id TEXT PRIMARY KEY NOT NULL CHECK(length(offer_id)=32 AND offer_id NOT GLOB ''*[^a-f0-9]*''),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL,request_key TEXT NOT NULL CHECK(length(request_key) BETWEEN 1 AND 128),update_id INTEGER NOT NULL CHECK(update_id>=0),
 spread_id TEXT NOT NULL,theme TEXT NOT NULL CHECK(theme IN(''general'',''relations'',''work'',''choice'',''resources'',''self'')),size INTEGER NOT NULL,
 price INTEGER NOT NULL,price_version TEXT NOT NULL,policy_revision INTEGER NOT NULL,
 deck_version TEXT NOT NULL,engine_version TEXT NOT NULL,spread_version TEXT NOT NULL,snapshot_version TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND length(CAST(snapshot_json AS BLOB))<=900000),result TEXT NOT NULL CHECK(length(result) BETWEEN 1 AND 60000),
 status TEXT NOT NULL DEFAULT ''open'' CHECK(status IN(''open'',''cancelled'')),created_at INTEGER NOT NULL DEFAULT(unixepoch()),expires_at INTEGER NOT NULL,
 UNIQUE(telegram_id,generation,request_key),UNIQUE(telegram_id,generation,update_id),CHECK(expires_at=created_at+900),
 FOREIGN KEY(price_version,spread_id) REFERENCES astra_tarot25_prices29(price_version,spread_id)
)'),('astra_tarot25_price_delete29','trigger','CREATE TRIGGER astra_tarot25_price_delete29 BEFORE DELETE ON astra_tarot25_prices29 BEGIN SELECT RAISE(ABORT,''Tarot price version immutable'');END'),('astra_tarot25_price_guard29','trigger','CREATE TRIGGER astra_tarot25_price_guard29 BEFORE INSERT ON astra_tarot25_prices29 BEGIN
 SELECT CASE WHEN NEW.price_version<>''tarot25-prices-proposal-v1'' OR NOT((NEW.spread_id=''basic-3'' AND NEW.size=3 AND NEW.price=5 AND NEW.theme=''general'' AND NEW.positions_json=''["situation","obstacle","advice"]'') OR (NEW.spread_id=''relations-3'' AND NEW.size=3 AND NEW.price=8 AND NEW.theme=''relations'' AND NEW.positions_json=''["self","between","care"]'') OR (NEW.spread_id=''work-3'' AND NEW.size=3 AND NEW.price=8 AND NEW.theme=''work'' AND NEW.positions_json=''["task","means","practice"]'') OR (NEW.spread_id=''choice-3'' AND NEW.size=3 AND NEW.price=8 AND NEW.theme=''choice'' AND NEW.positions_json=''["criterion","tension","test"]'') OR (NEW.spread_id=''depth-5'' AND NEW.size=5 AND NEW.price=14 AND NEW.theme=''general'' AND NEW.positions_json=''["resource","barrier","tendency","step","integration"]'') OR (NEW.spread_id=''depth-7'' AND NEW.size=7 AND NEW.price=21 AND NEW.theme=''general'' AND NEW.positions_json=''["core","roots","inner","outer","obstacle","support","direction"]'') OR (NEW.spread_id=''celtic-10'' AND NEW.size=10 AND NEW.price=32 AND NEW.theme=''general'' AND NEW.positions_json=''["present","crossing","foundation","past","crown","near","self","environment","hopes","outcome"]'')) THEN RAISE(ABORT,''Unsupported Tarot price'') END;
END'),('astra_tarot25_price_update29','trigger','CREATE TRIGGER astra_tarot25_price_update29 BEFORE UPDATE ON astra_tarot25_prices29 BEGIN SELECT RAISE(ABORT,''Tarot price version immutable'');END'),('astra_tarot25_prices29','table','CREATE TABLE astra_tarot25_prices29 (
 price_version TEXT NOT NULL,spread_id TEXT NOT NULL,size INTEGER NOT NULL CHECK(size IN(3,5,7,10)),price INTEGER NOT NULL CHECK(price IN(5,8,14,21,32)),
 theme TEXT NOT NULL,positions_json TEXT NOT NULL CHECK(json_valid(positions_json)),PRIMARY KEY(price_version,spread_id)
)'),('astra_tarot25_purchase_delete29','trigger','CREATE TRIGGER astra_tarot25_purchase_delete29 BEFORE DELETE ON astra_tarot25_purchases29 WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,''Erase paid Tarot with profile'');END'),('astra_tarot25_purchase_guard29','trigger','CREATE TRIGGER astra_tarot25_purchase_guard29 BEFORE INSERT ON astra_tarot25_purchases29 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=NEW.offer_id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key=''tarot25:''||NEW.offer_id) THEN RAISE(ABORT,''Tarot debit already recorded'') END;
 SELECT CASE WHEN NEW.delivery<>''pending'' OR NEW.attempts<>0 OR NEW.lease IS NOT NULL OR NEW.lease_until<>0 OR NEW.not_before<>0 OR NEW.parts_sent<>0 OR NEW.last_code IS NOT NULL OR NEW.created_at<>unixepoch() OR NOT EXISTS(
 SELECT 1 FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id JOIN astra_tarot25_runtime29 r ON r.singleton=1
 WHERE o.offer_id=NEW.offer_id AND o.telegram_id=NEW.telegram_id AND o.generation=NEW.generation AND o.price=NEW.price AND o.price_version=NEW.price_version AND o.spread_id=NEW.spread_id AND o.theme=NEW.theme AND o.size=NEW.size AND o.snapshot_json=NEW.snapshot_json AND o.result=NEW.result AND o.deck_version=NEW.deck_version AND o.engine_version=NEW.engine_version AND o.spread_version=NEW.spread_version AND o.snapshot_version=NEW.snapshot_version AND p.generation=o.generation AND u.balance>=o.price
 AND o.status=''open'' AND o.expires_at>unixepoch() AND r.migration_done=1 AND r.enabled=1 AND r.price_version=o.price_version AND r.revision=o.policy_revision) THEN RAISE(ABORT,''Tarot purchase authority/funds/gate mismatch'') END;
END'),('astra_tarot25_purchase_post29','trigger','CREATE TRIGGER astra_tarot25_purchase_post29 AFTER INSERT ON astra_tarot25_purchases29 BEGIN
 UPDATE astra_users SET balance=balance-NEW.price WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(''tarot25:''||NEW.offer_id,NEW.telegram_id,-NEW.price,''tarot:v25'');
END'),('astra_tarot25_purchase_update29','trigger','CREATE TRIGGER astra_tarot25_purchase_update29 BEFORE UPDATE ON astra_tarot25_purchases29 BEGIN
 SELECT CASE WHEN NEW.offer_id IS NOT OLD.offer_id OR NEW.telegram_id IS NOT OLD.telegram_id OR NEW.generation IS NOT OLD.generation OR NEW.price IS NOT OLD.price OR NEW.price_version IS NOT OLD.price_version OR NEW.spread_id IS NOT OLD.spread_id OR NEW.theme IS NOT OLD.theme OR NEW.size IS NOT OLD.size OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.result IS NOT OLD.result OR NEW.deck_version IS NOT OLD.deck_version OR NEW.engine_version IS NOT OLD.engine_version OR NEW.spread_version IS NOT OLD.spread_version OR NEW.snapshot_version IS NOT OLD.snapshot_version OR NEW.created_at IS NOT OLD.created_at THEN RAISE(ABORT,''Paid Tarot snapshot immutable'') END;
 SELECT CASE WHEN NOT (
 (OLD.delivery IN(''pending'',''retry'',''unknown'',''sent'',''rejected'') AND NEW.delivery=''sending'' AND NEW.attempts=OLD.attempts+1 AND NEW.lease IS NOT NULL AND NEW.lease IS NOT OLD.lease AND NEW.lease_until>unixepoch() AND OLD.not_before<=unixepoch()) OR
 (OLD.delivery=''sending'' AND NEW.delivery IN(''sent'',''retry'',''unknown'',''rejected'',''cancelled'') AND NEW.attempts=OLD.attempts AND NEW.lease IS OLD.lease AND NEW.lease_until=0) OR
 (OLD.delivery IN(''pending'',''retry'',''unknown'',''rejected'') AND NEW.delivery=''cancelled'' AND NEW.attempts=OLD.attempts AND NEW.lease IS OLD.lease AND NEW.lease_until=0)
 ) THEN RAISE(ABORT,''Invalid Tarot delivery transition'') END;
END'),('astra_tarot25_purchases29','table','CREATE TABLE astra_tarot25_purchases29 (
 offer_id TEXT PRIMARY KEY NOT NULL REFERENCES astra_tarot25_offers29(offer_id),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL,price INTEGER NOT NULL,price_version TEXT NOT NULL,spread_id TEXT NOT NULL,theme TEXT NOT NULL,size INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),result TEXT NOT NULL,deck_version TEXT NOT NULL,engine_version TEXT NOT NULL,spread_version TEXT NOT NULL,snapshot_version TEXT NOT NULL,
 delivery TEXT NOT NULL DEFAULT ''pending'' CHECK(delivery IN(''pending'',''sending'',''sent'',''retry'',''unknown'',''rejected'',''cancelled'')),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,not_before INTEGER NOT NULL DEFAULT 0,parts_sent INTEGER NOT NULL DEFAULT 0 CHECK(parts_sent BETWEEN 0 AND 30),last_code INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch())
)'),('astra_tarot25_runtime29','table','CREATE TABLE astra_tarot25_runtime29 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL DEFAULT ''tarot25-policy-v1'' CHECK(version=''tarot25-policy-v1''),
 migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1)),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 price_version TEXT NOT NULL DEFAULT ''tarot25-prices-proposal-v1'',revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
)'),('astra_tarot25_runtime_delete29','trigger','CREATE TRIGGER astra_tarot25_runtime_delete29 BEFORE DELETE ON astra_tarot25_runtime29 BEGIN SELECT RAISE(ABORT,''Tarot runtime required'');END'),('astra_tarot25_runtime_guard29','trigger','CREATE TRIGGER astra_tarot25_runtime_guard29 BEFORE UPDATE ON astra_tarot25_runtime29 BEGIN
 SELECT CASE WHEN NEW.enabled=1 AND NEW.migration_done<>1 THEN RAISE(ABORT,''Tarot migration must finish before enable'') END;
 SELECT CASE WHEN NEW.singleton<>OLD.singleton OR NEW.version<>OLD.version OR NEW.revision<OLD.revision OR (OLD.migration_done=1 AND NEW.migration_done<>1) THEN RAISE(ABORT,''Invalid Tarot runtime transition'') END;
END'),('astra_tarot25_runtime_insert29','trigger','CREATE TRIGGER astra_tarot25_runtime_insert29 BEFORE INSERT ON astra_tarot25_runtime29 WHEN EXISTS(SELECT 1 FROM astra_tarot25_runtime29 WHERE singleton=NEW.singleton) BEGIN SELECT RAISE(IGNORE);END'),('astra_tarot25_runtime_revision29','trigger','CREATE TRIGGER astra_tarot25_runtime_revision29 AFTER UPDATE OF enabled,price_version ON astra_tarot25_runtime29 WHEN NEW.enabled<>OLD.enabled OR NEW.price_version<>OLD.price_version BEGIN
 UPDATE astra_tarot25_runtime29 SET revision=revision+1 WHERE singleton=1;
END'),('idx_tarot25_offers29_owner','index','CREATE INDEX idx_tarot25_offers29_owner ON astra_tarot25_offers29(telegram_id,generation,created_at,offer_id)'),('idx_tarot25_purchases29_owner','index','CREATE INDEX idx_tarot25_purchases29_owner ON astra_tarot25_purchases29(telegram_id,generation,created_at DESC,offer_id DESC)')) SELECT 'ddl_drift' AS check_name,count(*) AS violations FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR a.sql IS NOT e.sql;
SELECT 'tariff_data' AS check_name, (SELECT count(*) FROM astra_tarot25_prices29)<>7 OR (WITH expected(price_version,spread_id,size,price,theme,positions_json) AS (VALUES ('tarot25-prices-proposal-v1','basic-3',3,5,'general','["situation","obstacle","advice"]'),('tarot25-prices-proposal-v1','relations-3',3,8,'relations','["self","between","care"]'),('tarot25-prices-proposal-v1','work-3',3,8,'work','["task","means","practice"]'),('tarot25-prices-proposal-v1','choice-3',3,8,'choice','["criterion","tension","test"]'),('tarot25-prices-proposal-v1','depth-5',5,14,'general','["resource","barrier","tendency","step","integration"]'),('tarot25-prices-proposal-v1','depth-7',7,21,'general','["core","roots","inner","outer","obstacle","support","direction"]'),('tarot25-prices-proposal-v1','celtic-10',10,32,'general','["present","crossing","foundation","past","crown","near","self","environment","hopes","outcome"]')) SELECT count(*) FROM expected e LEFT JOIN astra_tarot25_prices29 t USING(price_version,spread_id) WHERE t.size IS NOT e.size OR t.price IS NOT e.price OR t.theme IS NOT e.theme OR t.positions_json IS NOT e.positions_json)>0 AS violations;
SELECT 'wallet' AS check_name,count(*) AS violations FROM astra_users u WHERE balance<0 OR balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)
UNION ALL SELECT 'new_ledger',count(*) FROM astra_tarot25_purchases29 p WHERE NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='tarot25:'||p.offer_id AND l.telegram_id=p.telegram_id AND l.delta=-p.price AND l.reason='tarot:v25')
UNION ALL SELECT 'orphan_ledger',count(*) FROM astra_wallet_ledger l WHERE l.reason='tarot:v25' AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 p WHERE 'tarot25:'||p.offer_id=l.idempotency_key AND p.telegram_id=l.telegram_id AND l.delta=-p.price)
UNION ALL SELECT 'owner_generation',count(*) FROM astra_tarot25_offers29 o LEFT JOIN astra_users u USING(telegram_id) LEFT JOIN astra_user_policy g USING(telegram_id) WHERE u.telegram_id IS NULL OR g.generation IS NOT o.generation
UNION ALL SELECT 'paid_snapshot',count(*) FROM astra_tarot25_purchases29 p LEFT JOIN astra_tarot25_offers29 o USING(offer_id) WHERE o.offer_id IS NULL OR p.snapshot_json IS NOT o.snapshot_json OR p.result IS NOT o.result OR p.price IS NOT o.price OR p.generation IS NOT o.generation OR p.spread_id IS NOT o.spread_id OR p.theme IS NOT o.theme OR p.size IS NOT o.size OR p.price_version IS NOT o.price_version OR p.deck_version IS NOT o.deck_version OR p.engine_version IS NOT o.engine_version OR p.spread_version IS NOT o.spread_version OR p.snapshot_version IS NOT o.snapshot_version
UNION ALL SELECT 'catalogue_not_off',count(*) FROM astra_tarot25_runtime29 WHERE enabled<>0 OR migration_done<>1;
PRAGMA foreign_key_check;
