CREATE TRIGGER IF NOT EXISTS astra_policy_date_guard BEFORE UPDATE ON astra_policy WHEN (OLD.start_day IS NOT NULL AND (NEW.start_day IS NULL OR NEW.start_day<>OLD.start_day)) OR (OLD.activated=1 AND NEW.activated<>1) OR (OLD.verified_bot_id IS NOT NULL AND (NEW.verified_bot_id IS NULL OR NEW.verified_bot_id<>OLD.verified_bot_id)) OR NEW.version<>OLD.version OR (OLD.payment_scope IS NOT NULL AND (NEW.payment_scope IS NULL OR NEW.payment_scope<>OLD.payment_scope)) BEGIN SELECT RAISE(ABORT,'Policy cutover/scope immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_policy_erase AFTER DELETE ON astra_users BEGIN
 UPDATE astra_referral_contracts SET referrer=NULL,status=CASE WHEN status IN ('pending','eligible') THEN 'cancelled' ELSE status END WHERE referrer=OLD.telegram_id;
 DELETE FROM astra_referral_payouts WHERE invitee=OLD.telegram_id;
 DELETE FROM astra_referral_contracts WHERE invitee=OLD.telegram_id;
 DELETE FROM astra_reward_claims WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_policy_days WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_policy_events WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_user_policy WHERE telegram_id=OLD.telegram_id;
 UPDATE astra_payment_orders SET owner_id=NULL WHERE payer_id=OLD.telegram_id;
 DELETE FROM astra_payment_orders WHERE payer_id=OLD.telegram_id AND NOT EXISTS(SELECT 1 FROM astra_payment_receipts r WHERE r.order_id=astra_payment_orders.order_id);
END;
CREATE TRIGGER IF NOT EXISTS astra_referrer_erasing BEFORE DELETE ON astra_users BEGIN
 UPDATE astra_referral_contracts SET referrer=NULL,status=CASE WHEN status IN ('pending','eligible') THEN 'cancelled' ELSE status END WHERE referrer=OLD.telegram_id;
END;
