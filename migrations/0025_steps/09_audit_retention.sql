CREATE TABLE IF NOT EXISTS astra_payment_audit (
 audit_id TEXT PRIMARY KEY,kind TEXT NOT NULL,charge_hash TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS astra_refund_request_audit AFTER UPDATE ON astra_refund_requests BEGIN
 INSERT INTO astra_payment_audit(audit_id,kind,charge_hash) VALUES(lower(hex(randomblob(16))),'refund_state:'||OLD.status||':'||NEW.status,NEW.charge_hash);
END;
-- Called only by authenticated retention procedure. Keep hash tombstones forever.
CREATE TRIGGER IF NOT EXISTS astra_payment_purge BEFORE DELETE ON astra_payment_orders BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_refund_accounts WHERE payer_id=OLD.payer_id AND debt>0) AND EXISTS(SELECT 1 FROM astra_payment_receipts WHERE order_id=OLD.order_id) THEN RAISE(ABORT,'Unresolved debt blocks payment erasure') END;
 DELETE FROM astra_refund_requests WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_refund_settlements WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_external_refunds WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_anomalies WHERE charge_hash IN (SELECT charge_hash FROM astra_payment_receipts WHERE order_id=OLD.order_id);
 DELETE FROM astra_payment_receipts WHERE order_id=OLD.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_purge_closed AFTER DELETE ON astra_payment_orders
 WHEN NOT EXISTS(SELECT 1 FROM astra_payment_orders WHERE payer_id=OLD.payer_id)
 AND EXISTS(SELECT 1 FROM astra_refund_accounts a WHERE a.payer_id=OLD.payer_id AND a.debt=0 AND a.updated_at<datetime('now','-'||(SELECT retention_days FROM astra_policy WHERE singleton=1)||' days')) BEGIN
 DELETE FROM astra_refund_accounts WHERE payer_id=OLD.payer_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_refund_account_erasing BEFORE DELETE ON astra_refund_accounts BEGIN
 SELECT CASE WHEN OLD.debt<>0 OR EXISTS(SELECT 1 FROM astra_payment_orders WHERE payer_id=OLD.payer_id) OR OLD.updated_at>=datetime('now','-'||(SELECT retention_days FROM astra_policy WHERE singleton=1)||' days') THEN RAISE(ABORT,'Refund account still required') END;
 DELETE FROM astra_refund_requests WHERE charge_hash IN (SELECT charge_hash FROM astra_external_refunds WHERE payer_id=OLD.payer_id);
 DELETE FROM astra_refund_settlements WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_external_refunds WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_payment_anomalies WHERE payer_id=OLD.payer_id;
 DELETE FROM astra_debt_repayments WHERE payer_id=OLD.payer_id;
END;
