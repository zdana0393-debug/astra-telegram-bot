CREATE TRIGGER IF NOT EXISTS astra_tarot25_purchase_guard29 BEFORE INSERT ON astra_tarot25_purchases29 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=NEW.offer_id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key='tarot25:'||NEW.offer_id) THEN RAISE(ABORT,'Tarot debit already recorded') END;
 SELECT CASE WHEN NEW.delivery<>'pending' OR NEW.attempts<>0 OR NEW.lease IS NOT NULL OR NEW.lease_until<>0 OR NEW.not_before<>0 OR NEW.parts_sent<>0 OR NEW.last_code IS NOT NULL OR NEW.created_at<>unixepoch() OR NOT EXISTS(
 SELECT 1 FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id JOIN astra_tarot25_runtime29 r ON r.singleton=1
 WHERE o.offer_id=NEW.offer_id AND o.telegram_id=NEW.telegram_id AND o.generation=NEW.generation AND o.price=NEW.price AND o.price_version=NEW.price_version AND o.spread_id=NEW.spread_id AND o.theme=NEW.theme AND o.size=NEW.size AND o.snapshot_json=NEW.snapshot_json AND o.result=NEW.result AND o.deck_version=NEW.deck_version AND o.engine_version=NEW.engine_version AND o.spread_version=NEW.spread_version AND o.snapshot_version=NEW.snapshot_version AND p.generation=o.generation AND u.balance>=o.price
 AND o.status='open' AND o.expires_at>unixepoch() AND r.migration_done=1 AND r.enabled=1 AND r.price_version=o.price_version AND r.revision=o.policy_revision) THEN RAISE(ABORT,'Tarot purchase authority/funds/gate mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot25_purchase_post29 AFTER INSERT ON astra_tarot25_purchases29 BEGIN
 UPDATE astra_users SET balance=balance-NEW.price WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES('tarot25:'||NEW.offer_id,NEW.telegram_id,-NEW.price,'tarot:v25');
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot25_ledger_guard29 BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='tarot:v25' OR NEW.idempotency_key LIKE 'tarot25:%' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key=NEW.idempotency_key) THEN RAISE(ABORT,'Tarot ledger already exists') END;
 SELECT CASE WHEN NEW.operation_id IS NOT NULL OR NEW.reason<>'tarot:v25' OR NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 p WHERE 'tarot25:'||p.offer_id=NEW.idempotency_key AND p.telegram_id=NEW.telegram_id AND NEW.delta=-p.price) THEN RAISE(ABORT,'Tarot ledger requires paid snapshot') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot25_ledger_update29 BEFORE UPDATE ON astra_wallet_ledger WHEN OLD.reason='tarot:v25' OR OLD.idempotency_key LIKE 'tarot25:%' OR NEW.reason='tarot:v25' OR NEW.idempotency_key LIKE 'tarot25:%' BEGIN SELECT RAISE(ABORT,'Tarot ledger immutable');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot25_ledger_delete29 BEFORE DELETE ON astra_wallet_ledger WHEN OLD.reason='tarot:v25' AND EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,'Erase Tarot ledger with profile');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot25_purchase_update29 BEFORE UPDATE ON astra_tarot25_purchases29 BEGIN
 SELECT CASE WHEN NEW.offer_id IS NOT OLD.offer_id OR NEW.telegram_id IS NOT OLD.telegram_id OR NEW.generation IS NOT OLD.generation OR NEW.price IS NOT OLD.price OR NEW.price_version IS NOT OLD.price_version OR NEW.spread_id IS NOT OLD.spread_id OR NEW.theme IS NOT OLD.theme OR NEW.size IS NOT OLD.size OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.result IS NOT OLD.result OR NEW.deck_version IS NOT OLD.deck_version OR NEW.engine_version IS NOT OLD.engine_version OR NEW.spread_version IS NOT OLD.spread_version OR NEW.snapshot_version IS NOT OLD.snapshot_version OR NEW.created_at IS NOT OLD.created_at THEN RAISE(ABORT,'Paid Tarot snapshot immutable') END;
 SELECT CASE WHEN NOT (
 (OLD.delivery IN('pending','retry','unknown','sent','rejected') AND NEW.delivery='sending' AND NEW.attempts=OLD.attempts+1 AND NEW.lease IS NOT NULL AND NEW.lease IS NOT OLD.lease AND NEW.lease_until>unixepoch() AND OLD.not_before<=unixepoch()) OR
 (OLD.delivery='sending' AND NEW.delivery IN('sent','retry','unknown','rejected','cancelled') AND NEW.attempts=OLD.attempts AND NEW.lease IS OLD.lease AND NEW.lease_until=0) OR
 (OLD.delivery IN('pending','retry','unknown','rejected') AND NEW.delivery='cancelled' AND NEW.attempts=OLD.attempts AND NEW.lease IS OLD.lease AND NEW.lease_until=0)
 ) THEN RAISE(ABORT,'Invalid Tarot delivery transition') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot25_purchase_delete29 BEFORE DELETE ON astra_tarot25_purchases29 WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,'Erase paid Tarot with profile');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot25_erase29 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_tarot25_purchases29 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_tarot25_offers29 WHERE telegram_id=OLD.telegram_id;
END;
