CREATE TABLE IF NOT EXISTS astra_payment_orders26 (
 order_id TEXT PRIMARY KEY, payload TEXT NOT NULL UNIQUE CHECK(length(CAST(payload AS BLOB))<=128),
 owner_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL, payer_id INTEGER NOT NULL,
 request_key TEXT NOT NULL, package INTEGER NOT NULL, xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 price_version TEXT NOT NULL CHECK(price_version='stars-pack-v2'), scope TEXT NOT NULL CHECK(scope IN ('test','production')),
 terms_version TEXT NOT NULL, retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 180 AND 3650),
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','invoiced','confirmed','credited','refund_requested','refund_in_progress','refunded','needs_review')),
 delivery TEXT NOT NULL DEFAULT 'pending' CHECK(delivery IN ('pending','sending','sent','unknown','failed')),
 invoice_lease TEXT, precheckout_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(payer_id,request_key), CHECK((package=10 AND xtr=10 AND dust=40) OR (package=25 AND xtr=25 AND dust=110) OR (package=50 AND xtr=50 AND dust=240))
);
CREATE INDEX IF NOT EXISTS idx_payment_orders26_owner ON astra_payment_orders26(payer_id,created_at DESC,order_id DESC);
CREATE TABLE IF NOT EXISTS astra_payment_receipts26 (
 charge_id TEXT PRIMARY KEY, charge_hash TEXT NOT NULL UNIQUE CHECK(length(charge_hash)=64), order_id TEXT NOT NULL UNIQUE REFERENCES astra_payment_orders26(order_id),
 payer_id INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency='XTR'), xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('paid','refunded')), credited_dust INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS astra_payment_order_index26 (seq INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL UNIQUE);
INSERT OR IGNORE INTO astra_payment_order_index26(order_id) SELECT order_id FROM astra_payment_orders ORDER BY rowid;
CREATE VIEW IF NOT EXISTS astra_all_orders26 AS SELECT o.*,i.seq AS rowid FROM astra_payment_orders o JOIN astra_payment_order_index26 i USING(order_id) UNION ALL SELECT o.*,i.seq AS rowid FROM astra_payment_orders26 o JOIN astra_payment_order_index26 i USING(order_id);
CREATE VIEW IF NOT EXISTS astra_all_receipts26 AS SELECT * FROM astra_payment_receipts UNION ALL SELECT * FROM astra_payment_receipts26;
CREATE TRIGGER IF NOT EXISTS astra_orders_index_old26 AFTER INSERT ON astra_payment_orders BEGIN INSERT INTO astra_payment_order_index26(order_id) VALUES(NEW.order_id); END;
CREATE TRIGGER IF NOT EXISTS astra_orders_index_new26 AFTER INSERT ON astra_payment_orders26 BEGIN INSERT INTO astra_payment_order_index26(order_id) VALUES(NEW.order_id); END;
CREATE TRIGGER IF NOT EXISTS astra_orders_unindex_old26 AFTER DELETE ON astra_payment_orders BEGIN DELETE FROM astra_payment_order_index26 WHERE order_id=OLD.order_id; END;
CREATE TRIGGER IF NOT EXISTS astra_orders_unindex_new26 AFTER DELETE ON astra_payment_orders26 BEGIN DELETE FROM astra_payment_order_index26 WHERE order_id=OLD.order_id; END;
CREATE TRIGGER IF NOT EXISTS astra_orders_insert26 INSTEAD OF INSERT ON astra_all_orders26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id OR payload=NEW.payload OR (payer_id=NEW.payer_id AND request_key=NEW.request_key)) THEN RAISE(IGNORE) END;
 INSERT INTO astra_payment_orders26(order_id,payload,owner_id,payer_id,request_key,package,xtr,dust,price_version,scope,terms_version,retention_days,status,delivery,invoice_lease,precheckout_id,created_at,updated_at) VALUES(NEW.order_id,NEW.payload,NEW.owner_id,NEW.payer_id,NEW.request_key,NEW.package,NEW.xtr,NEW.dust,NEW.price_version,NEW.scope,NEW.terms_version,NEW.retention_days,coalesce(NEW.status,'created'),coalesce(NEW.delivery,'pending'),NEW.invoice_lease,NEW.precheckout_id,coalesce(NEW.created_at,CURRENT_TIMESTAMP),coalesce(NEW.updated_at,CURRENT_TIMESTAMP));
END;
CREATE TRIGGER IF NOT EXISTS astra_orders_update26 INSTEAD OF UPDATE ON astra_all_orders26 BEGIN
 UPDATE astra_payment_orders SET order_id=NEW.order_id,payload=NEW.payload,owner_id=NEW.owner_id,payer_id=NEW.payer_id,request_key=NEW.request_key,package=NEW.package,xtr=NEW.xtr,dust=NEW.dust,price_version=NEW.price_version,scope=NEW.scope,terms_version=NEW.terms_version,retention_days=NEW.retention_days,status=NEW.status,delivery=NEW.delivery,invoice_lease=NEW.invoice_lease,precheckout_id=NEW.precheckout_id,created_at=NEW.created_at,updated_at=NEW.updated_at WHERE order_id=OLD.order_id;
 UPDATE astra_payment_orders26 SET order_id=NEW.order_id,payload=NEW.payload,owner_id=NEW.owner_id,payer_id=NEW.payer_id,request_key=NEW.request_key,package=NEW.package,xtr=NEW.xtr,dust=NEW.dust,price_version=NEW.price_version,scope=NEW.scope,terms_version=NEW.terms_version,retention_days=NEW.retention_days,status=NEW.status,delivery=NEW.delivery,invoice_lease=NEW.invoice_lease,precheckout_id=NEW.precheckout_id,created_at=NEW.created_at,updated_at=NEW.updated_at WHERE order_id=OLD.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_orders_delete26 INSTEAD OF DELETE ON astra_all_orders26 BEGIN
 DELETE FROM astra_payment_orders WHERE order_id=OLD.order_id;
 DELETE FROM astra_payment_orders26 WHERE order_id=OLD.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_receipts_insert26 INSTEAD OF INSERT ON astra_all_receipts26 BEGIN
 INSERT OR IGNORE INTO astra_payment_receipts(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust,created_at) SELECT NEW.charge_id,NEW.charge_hash,NEW.order_id,NEW.payer_id,NEW.currency,NEW.xtr,NEW.dust,NEW.kind,coalesce(NEW.credited_dust,0),coalesce(NEW.created_at,CURRENT_TIMESTAMP) WHERE EXISTS(SELECT 1 FROM astra_payment_orders WHERE order_id=NEW.order_id);
 INSERT OR IGNORE INTO astra_payment_receipts26(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust,created_at) SELECT NEW.charge_id,NEW.charge_hash,NEW.order_id,NEW.payer_id,NEW.currency,NEW.xtr,NEW.dust,NEW.kind,coalesce(NEW.credited_dust,0),coalesce(NEW.created_at,CURRENT_TIMESTAMP) WHERE EXISTS(SELECT 1 FROM astra_payment_orders26 WHERE order_id=NEW.order_id);
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_guard26 BEFORE INSERT ON astra_payment_receipts26 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.credited_dust<>CASE WHEN NEW.kind='paid' AND NOT EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) AND EXISTS(SELECT 1 FROM astra_all_orders26 o JOIN astra_users u ON u.telegram_id=o.owner_id WHERE o.order_id=NEW.order_id AND o.owner_id=NEW.payer_id) THEN NEW.dust ELSE 0 END OR NOT EXISTS(SELECT 1 FROM astra_all_orders26 o WHERE o.order_id=NEW.order_id AND o.payer_id=NEW.payer_id AND o.xtr=NEW.xtr AND o.dust=NEW.dust AND NEW.currency='XTR') THEN RAISE(ABORT,'Payment snapshot mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_post26 AFTER INSERT ON astra_payment_receipts26 BEGIN
 INSERT INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,NEW.dust,NEW.credited_dust,scope,CASE WHEN NEW.kind='refunded' THEN 1 ELSE 0 END FROM astra_all_orders26 WHERE order_id=NEW.order_id;
 UPDATE astra_users SET balance=balance+(SELECT credited_dust FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash) WHERE telegram_id=NEW.payer_id AND EXISTS(SELECT 1 FROM astra_all_orders26 WHERE order_id=NEW.order_id AND owner_id=NEW.payer_id);
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
 SELECT 'stars:'||NEW.charge_hash,NEW.payer_id,credited_dust,'payment:stars' FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash AND credited_dust>0;
 UPDATE astra_all_orders26 SET status=CASE WHEN NEW.kind='refunded' OR EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) THEN 'refunded' WHEN (SELECT credited_dust FROM astra_all_receipts26 WHERE charge_hash=NEW.charge_hash)>0 THEN 'credited' ELSE 'needs_review' END,updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_immutable26 BEFORE UPDATE ON astra_payment_receipts26 BEGIN SELECT RAISE(ABORT,'Payment proof immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_payment_order_snapshot26 BEFORE UPDATE ON astra_payment_orders26 WHEN NEW.order_id<>OLD.order_id OR NEW.payload<>OLD.payload OR NEW.payer_id<>OLD.payer_id OR NEW.package<>OLD.package OR NEW.xtr<>OLD.xtr OR NEW.dust<>OLD.dust OR NEW.scope<>OLD.scope OR NEW.terms_version<>OLD.terms_version OR NEW.retention_days<>OLD.retention_days OR NEW.request_key<>OLD.request_key OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Order price snapshot immutable'); END;
