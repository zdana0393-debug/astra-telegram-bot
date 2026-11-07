CREATE TRIGGER IF NOT EXISTS astra_reward_guard BEFORE INSERT ON astra_reward_claims BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND enabled=1 AND activated=1 AND NEW.day>=start_day)
 OR NOT EXISTS(SELECT 1 FROM astra_user_policy p JOIN astra_users u USING(telegram_id) WHERE p.telegram_id=NEW.telegram_id AND p.generation=NEW.generation)
 THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='initial' AND NOT EXISTS(SELECT 1 FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND mode='v2') THEN RAISE(ABORT,'Initial reward requires a new policy profile') END;
 SELECT CASE WHEN NEW.kind IN ('daily','first3','weekly','thirty') AND NOT EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=NEW.day) THEN RAISE(ABORT,'Reward requires a policy day') END;
 SELECT CASE WHEN NEW.kind='first3' AND NOT EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak>=3) THEN RAISE(ABORT,'Three-day condition missing') END;
 SELECT CASE WHEN NEW.kind='weekly' AND NOT EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=NEW.day AND streak%7=0) THEN RAISE(ABORT,'Weekly condition missing') END;
 SELECT CASE WHEN NEW.kind='thirty' AND (SELECT count(*) FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day<=NEW.day)<30 THEN RAISE(ABORT,'Thirty distinct dates required') END;
 SELECT CASE WHEN NEW.kind='channel' AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND channel_rewarded=0) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind IN ('referrer','invitee') AND NOT EXISTS(SELECT 1 FROM astra_referral_payouts p JOIN astra_referral_contracts c ON c.invitee=p.invitee WHERE c.generation=NEW.reference AND c.mode='v2' AND c.status IN ('pending','eligible') AND ((NEW.kind='referrer' AND c.referrer=NEW.telegram_id) OR (NEW.kind='invitee' AND c.invitee=NEW.telegram_id))) THEN RAISE(ABORT,'Referral payout missing') END;
 SELECT CASE WHEN NEW.claim_id<>'reward:'||NEW.generation||':'||NEW.kind||':'||NEW.reference OR NEW.reference IS NULL OR (NEW.kind IN ('daily','weekly') AND NEW.reference<>NEW.day) OR (NEW.kind IN ('initial','first3','thirty','channel') AND NEW.reference<>'once') THEN RAISE(ABORT,'Noncanonical reward key') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_reward_post AFTER INSERT ON astra_reward_claims BEGIN
 UPDATE astra_users SET balance=balance+NEW.amount, channel_rewarded=CASE WHEN NEW.kind='channel' THEN 1 ELSE channel_rewarded END WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(NEW.claim_id,NEW.telegram_id,NEW.amount,'reward:v2:'||NEW.kind);
END;
CREATE TRIGGER IF NOT EXISTS astra_policy_day_guard BEFORE INSERT ON astra_policy_days BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND enabled=1 AND activated=1 AND NEW.day>=start_day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_policy_events e JOIN astra_users u ON u.telegram_id=e.telegram_id WHERE e.update_id=NEW.event_id AND e.telegram_id=NEW.telegram_id AND e.day=NEW.day AND e.legacy=0 AND u.zodiac IS NOT NULL)
 THEN RAISE(ABORT,'Policy visit requires a durable private event') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day>NEW.day) AND NOT EXISTS(SELECT 1 FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=NEW.day) THEN RAISE(ABORT,'Out-of-order policy day requires review') END;
 SELECT CASE WHEN NEW.streak<>coalesce((SELECT streak FROM astra_policy_days WHERE telegram_id=NEW.telegram_id AND day=date(NEW.day,'-1 day')),0)+1 THEN RAISE(ABORT,'Invalid policy streak') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_policy_day_post AFTER INSERT ON astra_policy_days BEGIN
 INSERT OR IGNORE INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT 'reward:'||generation||':daily:'||NEW.day,NEW.telegram_id,generation,'daily',NEW.day,3,NEW.day FROM astra_user_policy WHERE telegram_id=NEW.telegram_id;
 INSERT OR IGNORE INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT 'reward:'||generation||':first3:once',NEW.telegram_id,generation,'first3',NEW.day,3,'once' FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND NEW.streak>=3;
 INSERT OR IGNORE INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT 'reward:'||generation||':weekly:'||NEW.day,NEW.telegram_id,generation,'weekly',NEW.day,5,NEW.day FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND NEW.streak%7=0;
 INSERT OR IGNORE INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT 'reward:'||generation||':thirty:once',NEW.telegram_id,generation,'thirty',NEW.day,12,'once' FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND (SELECT count(*) FROM astra_policy_days WHERE telegram_id=NEW.telegram_id)>=30;
 UPDATE astra_referral_contracts SET status='eligible' WHERE invitee=NEW.telegram_id AND mode='v2' AND status='pending' AND (SELECT count(*) FROM astra_policy_days WHERE telegram_id=NEW.telegram_id)>=2;
 INSERT OR IGNORE INTO astra_referral_payouts(invitee,day) SELECT invitee,NEW.day FROM astra_referral_contracts WHERE invitee=NEW.telegram_id AND mode='v2' AND status='eligible';
END;
CREATE TRIGGER IF NOT EXISTS astra_referral_payout_guard BEFORE INSERT ON astra_referral_payouts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_referral_contracts c JOIN astra_users u ON u.telegram_id=c.referrer JOIN astra_users i ON i.telegram_id=c.invitee WHERE c.invitee=NEW.invitee AND c.mode='v2' AND c.status='eligible' AND i.zodiac IS NOT NULL AND (SELECT count(*) FROM astra_policy_days WHERE telegram_id=c.invitee)>=2)
 THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_referral_payout_post AFTER INSERT ON astra_referral_payouts BEGIN
 INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT 'reward:'||p.generation||':referrer:'||c.generation,c.referrer,p.generation,'referrer',NEW.day,14,c.generation FROM astra_referral_contracts c JOIN astra_user_policy p ON p.telegram_id=c.referrer WHERE c.invitee=NEW.invitee;
 INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT 'reward:'||generation||':invitee:'||generation,invitee,generation,'invitee',NEW.day,4,generation FROM astra_referral_contracts WHERE invitee=NEW.invitee;
 UPDATE astra_referral_contracts SET status='paid',paid_day=NEW.day WHERE invitee=NEW.invitee;
 UPDATE astra_users SET referral_rewarded=1 WHERE telegram_id=NEW.invitee;
END;
CREATE TRIGGER IF NOT EXISTS astra_reward_immutable BEFORE UPDATE ON astra_reward_claims BEGIN SELECT RAISE(ABORT,'Reward claim immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_policy_day_immutable BEFORE UPDATE ON astra_policy_days BEGIN SELECT RAISE(ABORT,'Policy day immutable'); END;
