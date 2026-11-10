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
