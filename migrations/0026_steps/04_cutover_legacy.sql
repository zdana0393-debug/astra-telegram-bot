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
