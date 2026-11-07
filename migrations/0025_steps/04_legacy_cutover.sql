-- Replacements during writer pause. Absence of astra_referral fences old Worker schemaReady.
DROP TRIGGER IF EXISTS astra_referral;
DROP TRIGGER IF EXISTS astra_register;
DROP TRIGGER IF EXISTS astra_operation_guard;
CREATE TRIGGER IF NOT EXISTS astra_register AFTER INSERT ON astra_users BEGIN
 INSERT INTO astra_user_policy(telegram_id,generation,mode,registered_day) VALUES(NEW.telegram_id,lower(hex(randomblob(16))),CASE WHEN EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND (activated=1 OR (start_day IS NOT NULL AND date(NEW.created_at,'+3 hours')>=start_day))) THEN 'v2' ELSE 'legacy' END,date(NEW.created_at,'+3 hours'));
 UPDATE astra_users SET balance=CASE WHEN EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND (activated=1 OR (start_day IS NOT NULL AND date(NEW.created_at,'+3 hours')>=start_day))) THEN 0 ELSE NEW.balance END WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES('opening:'||NEW.telegram_id,NEW.telegram_id,CASE WHEN EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND (activated=1 OR (start_day IS NOT NULL AND date(NEW.created_at,'+3 hours')>=start_day))) THEN 0 ELSE NEW.balance END,'registration');

 INSERT INTO astra_referral_contracts(invitee,referrer,generation,mode,status,created_day)
 SELECT NEW.telegram_id,NEW.referrer_id,generation,mode,'pending',registered_day FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND NEW.referrer_id IS NOT NULL AND NEW.referrer_id<>NEW.telegram_id;
 INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
 SELECT 'reward:'||generation||':initial:once',telegram_id,generation,'initial',registered_day,12,'once' FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND mode='v2';
END;
CREATE TRIGGER IF NOT EXISTS astra_operation_guard BEFORE INSERT ON astra_operations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id AND balance+NEW.delta>=0
 AND (NEW.reason<>'daily' OR last_gift_day IS NULL OR last_gift_day<>NEW.day) AND (NEW.reason<>'channel' OR channel_rewarded=0)) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND (activated=1 OR (start_day IS NOT NULL AND date('now','+3 hours')>=start_day))) AND NEW.reason IN ('daily','channel') THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND (activated=1 OR (start_day IS NOT NULL AND date('now','+3 hours')>=start_day))) AND NEW.reason='referral' AND NOT EXISTS(SELECT 1 FROM astra_referral_contracts WHERE invitee=NEW.source_id AND referrer=NEW.telegram_id AND mode='legacy' AND status='pending') THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_referral_policy AFTER UPDATE OF zodiac ON astra_users WHEN OLD.zodiac IS NULL AND NEW.zodiac IS NOT NULL AND OLD.referral_rewarded=0 BEGIN
 INSERT OR IGNORE INTO astra_operations(operation_id,telegram_id,source_id,reason,delta)
 SELECT 'legacyref:'||c.generation,c.referrer,c.invitee,'referral',5 FROM astra_referral_contracts c JOIN astra_users u ON u.telegram_id=c.referrer WHERE c.invitee=NEW.telegram_id AND c.mode='legacy' AND c.status='pending';
 UPDATE astra_referral_contracts SET status=CASE WHEN referrer IS NULL THEN 'cancelled' ELSE 'paid' END,paid_day=date('now','+3 hours') WHERE invitee=NEW.telegram_id AND mode='legacy' AND status='pending';
 UPDATE astra_users SET referral_rewarded=1 WHERE telegram_id=NEW.telegram_id AND EXISTS(SELECT 1 FROM astra_user_policy WHERE telegram_id=NEW.telegram_id AND mode='legacy');
END;
