CREATE TABLE IF NOT EXISTS astra_payment_orders (
 order_id TEXT PRIMARY KEY, payload TEXT NOT NULL UNIQUE CHECK(length(CAST(payload AS BLOB))<=128),
 owner_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL, payer_id INTEGER NOT NULL,
 request_key TEXT NOT NULL, package INTEGER NOT NULL, xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 price_version TEXT NOT NULL CHECK(price_version='stars-pack-v1'), scope TEXT NOT NULL CHECK(scope IN ('test','production')),
 terms_version TEXT NOT NULL, retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 180 AND 3650),
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','invoiced','confirmed','credited','refund_requested','refund_in_progress','refunded','needs_review')),
 delivery TEXT NOT NULL DEFAULT 'pending' CHECK(delivery IN ('pending','sending','sent','unknown','failed')),
 invoice_lease TEXT, precheckout_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(payer_id,request_key), CHECK((package=10 AND xtr=10 AND dust=100) OR (package=25 AND xtr=25 AND dust=270) OR (package=50 AND xtr=50 AND dust=570))
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_owner ON astra_payment_orders(payer_id,created_at DESC,order_id DESC);
CREATE TABLE IF NOT EXISTS astra_payment_tombstones (charge_hash TEXT PRIMARY KEY CHECK(length(charge_hash)=64), xtr INTEGER NOT NULL CHECK(xtr>0), dust INTEGER NOT NULL CHECK(dust>=0), credited_dust INTEGER NOT NULL CHECK(credited_dust>=0 AND credited_dust<=dust), scope TEXT NOT NULL CHECK(scope IN ('test','production')), refunded INTEGER NOT NULL DEFAULT 0 CHECK(refunded IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS astra_payment_receipts (
 charge_id TEXT PRIMARY KEY, charge_hash TEXT NOT NULL UNIQUE CHECK(length(charge_hash)=64), order_id TEXT NOT NULL UNIQUE REFERENCES astra_payment_orders(order_id),
 payer_id INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency='XTR'), xtr INTEGER NOT NULL, dust INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('paid','refunded')), credited_dust INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS astra_payment_anomalies (
 charge_hash TEXT PRIMARY KEY, charge_id TEXT NOT NULL, payer_id INTEGER NOT NULL, payload TEXT NOT NULL, currency TEXT NOT NULL, xtr INTEGER NOT NULL,
 scope TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'needs_review', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS astra_refund_requests (
 charge_hash TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','in_progress','needs_review','refunded')),
 lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS astra_external_refunds (
 charge_hash TEXT PRIMARY KEY, charge_id TEXT NOT NULL, order_id TEXT, payer_id INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency='XTR'), xtr INTEGER NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('api','message','reconcile')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS astra_refund_accounts (payer_id INTEGER PRIMARY KEY, debt INTEGER NOT NULL DEFAULT 0 CHECK(debt>=0), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS astra_refund_settlements (
 charge_hash TEXT PRIMARY KEY REFERENCES astra_external_refunds(charge_hash), payer_id INTEGER NOT NULL,
 reversed_dust INTEGER NOT NULL CHECK(reversed_dust>=0), removed INTEGER NOT NULL CHECK(removed>=0), debt_added INTEGER NOT NULL CHECK(debt_added>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(removed+debt_added=reversed_dust)
);
CREATE TABLE IF NOT EXISTS astra_debt_repayments (
 credit_key TEXT PRIMARY KEY, ledger_key TEXT NOT NULL, generation TEXT NOT NULL, payer_id INTEGER NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
