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
