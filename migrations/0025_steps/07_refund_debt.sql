CREATE TRIGGER IF NOT EXISTS astra_refund_notice_guard BEFORE INSERT ON astra_external_refunds BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash AND refunded=1) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_receipts r WHERE r.charge_hash=NEW.charge_hash AND (r.charge_id<>NEW.charge_id OR r.payer_id<>NEW.payer_id OR r.currency<>NEW.currency OR r.xtr<>NEW.xtr OR r.order_id<>NEW.order_id)) THEN RAISE(ABORT,'Refund proof mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_payment_receipts WHERE charge_hash=NEW.charge_hash) AND NOT EXISTS(SELECT 1 FROM astra_payment_orders WHERE order_id=NEW.order_id AND payer_id=NEW.payer_id AND xtr=NEW.xtr) AND NOT EXISTS(SELECT 1 FROM astra_payment_anomalies WHERE charge_hash=NEW.charge_hash AND payer_id=NEW.payer_id AND currency=NEW.currency AND xtr=NEW.xtr) AND NOT EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash AND xtr=NEW.xtr AND scope=(SELECT payment_scope FROM astra_policy WHERE singleton=1)) THEN RAISE(ABORT,'Refund needs known proof') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_refund_notice_post AFTER INSERT ON astra_external_refunds BEGIN
 INSERT OR IGNORE INTO astra_payment_receipts(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind)
 SELECT NEW.charge_id,NEW.charge_hash,o.order_id,NEW.payer_id,NEW.currency,NEW.xtr,o.dust,'refunded' FROM astra_payment_orders o WHERE o.order_id=NEW.order_id AND NOT EXISTS(SELECT 1 FROM astra_payment_receipts WHERE order_id=o.order_id);
 INSERT INTO astra_refund_settlements(charge_hash,payer_id,reversed_dust,removed,debt_added)
 SELECT NEW.charge_hash,NEW.payer_id,coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0),min(coalesce(u.balance,0),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)-min(coalesce(u.balance,0),coalesce(r.credited_dust,CASE WHEN t.refunded=0 THEN t.credited_dust ELSE 0 END,0)) FROM (SELECT 1) d LEFT JOIN astra_payment_receipts r ON r.charge_hash=NEW.charge_hash LEFT JOIN astra_users u ON u.telegram_id=NEW.payer_id LEFT JOIN astra_payment_tombstones t ON t.charge_hash=NEW.charge_hash;
 INSERT OR IGNORE INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,0,0,scope,1 FROM astra_payment_anomalies WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_payment_tombstones SET refunded=1 WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_payment_orders SET status='refunded',updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id AND EXISTS(SELECT 1 FROM astra_payment_receipts WHERE order_id=NEW.order_id AND charge_hash=NEW.charge_hash);
 UPDATE astra_refund_requests SET status='refunded',lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE charge_hash=NEW.charge_hash;
 UPDATE astra_payment_anomalies SET status='refunded' WHERE charge_hash=NEW.charge_hash;
END;
CREATE TRIGGER IF NOT EXISTS astra_refund_settlement_post AFTER INSERT ON astra_refund_settlements BEGIN
 UPDATE astra_users SET balance=balance-NEW.removed WHERE telegram_id=NEW.payer_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) SELECT 'refund:'||NEW.charge_hash,NEW.payer_id,-NEW.removed,'refund:cash' WHERE EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.payer_id);
 INSERT INTO astra_refund_accounts(payer_id,debt) VALUES(NEW.payer_id,NEW.debt_added) ON CONFLICT(payer_id) DO UPDATE SET debt=debt+excluded.debt,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS astra_positive_debt AFTER INSERT ON astra_wallet_ledger WHEN NEW.delta>0 AND EXISTS(SELECT 1 FROM astra_refund_accounts WHERE payer_id=NEW.telegram_id AND debt>0) BEGIN
 INSERT INTO astra_debt_repayments(credit_key,ledger_key,generation,payer_id,amount) SELECT p.generation||':'||NEW.idempotency_key,NEW.idempotency_key,p.generation,NEW.telegram_id,min(NEW.delta,a.debt) FROM astra_refund_accounts a JOIN astra_user_policy p ON p.telegram_id=a.payer_id WHERE a.payer_id=NEW.telegram_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_debt_repayment_guard BEFORE INSERT ON astra_debt_repayments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l JOIN astra_refund_accounts a ON a.payer_id=l.telegram_id JOIN astra_users u ON u.telegram_id=l.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id WHERE p.generation=NEW.generation AND NEW.credit_key=NEW.generation||':'||NEW.ledger_key AND l.idempotency_key=NEW.ledger_key AND l.telegram_id=NEW.payer_id AND NEW.amount=min(l.delta,a.debt) AND l.delta>0 AND u.balance>=NEW.amount) THEN RAISE(ABORT,'Invalid debt repayment') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_debt_repayment_post AFTER INSERT ON astra_debt_repayments BEGIN
 UPDATE astra_users SET balance=balance-NEW.amount WHERE telegram_id=NEW.payer_id;
 UPDATE astra_refund_accounts SET debt=debt-NEW.amount,updated_at=CURRENT_TIMESTAMP WHERE payer_id=NEW.payer_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES('debt:'||NEW.credit_key,NEW.payer_id,-NEW.amount,'refund:repayment');
END;
CREATE TRIGGER IF NOT EXISTS astra_refund_notice_immutable BEFORE UPDATE ON astra_external_refunds BEGIN SELECT RAISE(ABORT,'Refund notice immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_refund_settlement_immutable BEFORE UPDATE ON astra_refund_settlements BEGIN SELECT RAISE(ABORT,'Refund settlement immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_debt_repayment_immutable BEFORE UPDATE ON astra_debt_repayments BEGIN SELECT RAISE(ABORT,'Debt repayment immutable'); END;
