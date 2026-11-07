-- Writer pause required. Full 0024 before 0025. Defaults OFF; no financial backfill.
CREATE TABLE IF NOT EXISTS astra_policy (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL DEFAULT 'policy-v2' CHECK(version='policy-v2'),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), start_day TEXT,
 activated INTEGER NOT NULL DEFAULT 0 CHECK(activated IN (0,1)), migration_done INTEGER NOT NULL DEFAULT 0,
 stars_enabled INTEGER NOT NULL DEFAULT 0 CHECK(stars_enabled IN (0,1)), payment_scope TEXT CHECK(payment_scope IN ('test','production')),
 support TEXT, terms_version TEXT, retention_days INTEGER NOT NULL DEFAULT 0, verified_bot_id INTEGER,
 CHECK(start_day IS NULL OR (length(start_day)=10 AND date(start_day,'+0 days') IS NOT NULL AND date(start_day,'+0 days')=start_day)),
 CHECK(activated=0 OR start_day IS NOT NULL)
);
INSERT OR IGNORE INTO astra_policy(singleton) VALUES(1);
CREATE TABLE IF NOT EXISTS astra_user_policy (
 telegram_id INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL UNIQUE, mode TEXT NOT NULL CHECK(mode IN ('legacy','v2')), registered_day TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS astra_referral_contracts (
 invitee INTEGER PRIMARY KEY REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 referrer INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,
 generation TEXT NOT NULL UNIQUE, mode TEXT NOT NULL CHECK(mode IN ('legacy','v2')),
 status TEXT NOT NULL CHECK(status IN ('pending','eligible','paid','cancelled')), created_day TEXT NOT NULL, paid_day TEXT, CHECK(referrer IS NULL OR referrer<>invitee)
);
CREATE TABLE IF NOT EXISTS astra_policy_events (
 update_id INTEGER PRIMARY KEY, telegram_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT, source TEXT NOT NULL CHECK(source IN ('message','callback','legacy')),
 legacy INTEGER NOT NULL CHECK(legacy IN (0,1)), processed INTEGER NOT NULL DEFAULT 0 CHECK(processed IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(legacy=1 OR (telegram_id IS NOT NULL AND length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day))
);
CREATE INDEX IF NOT EXISTS idx_policy_events_owner ON astra_policy_events(telegram_id,processed,day,update_id);
CREATE TABLE IF NOT EXISTS astra_policy_days (
 telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day), streak INTEGER NOT NULL CHECK(streak>0),
 event_id INTEGER NOT NULL REFERENCES astra_policy_events(update_id), PRIMARY KEY(telegram_id,day)
);
CREATE TABLE IF NOT EXISTS astra_reward_claims (
 claim_id TEXT PRIMARY KEY, telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL, policy_version TEXT NOT NULL DEFAULT 'policy-v2' CHECK(policy_version='policy-v2'),
 kind TEXT NOT NULL CHECK(kind IN ('initial','daily','first3','weekly','thirty','channel','referrer','invitee')),
 day TEXT NOT NULL CHECK(length(day)=10 AND date(day,'+0 days') IS NOT NULL AND date(day,'+0 days')=day), amount INTEGER NOT NULL,
 reference TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(telegram_id,generation,kind,reference),
 CHECK((kind IN ('initial','thirty') AND amount=12) OR (kind IN ('daily','first3') AND amount=3) OR (kind='weekly' AND amount=5) OR (kind='channel' AND amount=8) OR (kind='referrer' AND amount=14) OR (kind='invitee' AND amount=4))
);
CREATE INDEX IF NOT EXISTS idx_reward_claims_owner ON astra_reward_claims(telegram_id,kind,day);
CREATE TABLE IF NOT EXISTS astra_referral_payouts (
 invitee INTEGER PRIMARY KEY REFERENCES astra_referral_contracts(invitee) ON DELETE CASCADE,
 day TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Captured once while writers are paused. No reward/active day is reconstructed.
INSERT OR IGNORE INTO astra_user_policy(telegram_id,generation,mode,registered_day)
 SELECT telegram_id,lower(hex(randomblob(16))),'legacy',date(created_at,'+3 hours') FROM astra_users;
INSERT OR IGNORE INTO astra_referral_contracts(invitee,referrer,generation,mode,status,created_day)
 SELECT u.telegram_id,u.referrer_id,p.generation,'legacy',CASE WHEN u.referral_rewarded=1 THEN 'paid' WHEN u.referrer_id IS NULL THEN 'cancelled' ELSE 'pending' END,p.registered_day
 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.referrer_id IS NOT NULL;
INSERT OR IGNORE INTO astra_policy_events(update_id,telegram_id,day,source,legacy,processed)
 SELECT j.update_id,CASE WHEN EXISTS(SELECT 1 FROM astra_users u WHERE u.telegram_id=j.telegram_id) THEN j.telegram_id END,
 date(j.received_at,'+3 hours'),'legacy',1,1 FROM astra_update_jobs j WHERE (SELECT migration_done FROM astra_policy WHERE singleton=1)=0;
UPDATE astra_policy SET migration_done=1 WHERE singleton=1 AND migration_done=0;
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
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_guard BEFORE INSERT ON astra_payment_receipts BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_payment_tombstones WHERE charge_hash=NEW.charge_hash) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.credited_dust<>CASE WHEN NEW.kind='paid' AND NOT EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) AND EXISTS(SELECT 1 FROM astra_payment_orders o JOIN astra_users u ON u.telegram_id=o.owner_id WHERE o.order_id=NEW.order_id AND o.owner_id=NEW.payer_id) THEN NEW.dust ELSE 0 END OR NOT EXISTS(SELECT 1 FROM astra_payment_orders o WHERE o.order_id=NEW.order_id AND o.payer_id=NEW.payer_id AND o.xtr=NEW.xtr AND o.dust=NEW.dust AND NEW.currency='XTR') THEN RAISE(ABORT,'Payment snapshot mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_post AFTER INSERT ON astra_payment_receipts BEGIN
 INSERT INTO astra_payment_tombstones(charge_hash,xtr,dust,credited_dust,scope,refunded) SELECT NEW.charge_hash,NEW.xtr,NEW.dust,NEW.credited_dust,scope,CASE WHEN NEW.kind='refunded' THEN 1 ELSE 0 END FROM astra_payment_orders WHERE order_id=NEW.order_id;
 UPDATE astra_users SET balance=balance+(SELECT credited_dust FROM astra_payment_receipts WHERE charge_hash=NEW.charge_hash) WHERE telegram_id=NEW.payer_id AND EXISTS(SELECT 1 FROM astra_payment_orders WHERE order_id=NEW.order_id AND owner_id=NEW.payer_id);
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
 SELECT 'stars:'||NEW.charge_hash,NEW.payer_id,credited_dust,'payment:stars' FROM astra_payment_receipts WHERE charge_hash=NEW.charge_hash AND credited_dust>0;
 UPDATE astra_payment_orders SET status=CASE WHEN NEW.kind='refunded' OR EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=NEW.charge_hash) THEN 'refunded' WHEN (SELECT credited_dust FROM astra_payment_receipts WHERE charge_hash=NEW.charge_hash)>0 THEN 'credited' ELSE 'needs_review' END,updated_at=CURRENT_TIMESTAMP WHERE order_id=NEW.order_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_payment_receipt_immutable BEFORE UPDATE ON astra_payment_receipts BEGIN SELECT RAISE(ABORT,'Payment proof immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_payment_order_snapshot BEFORE UPDATE ON astra_payment_orders WHEN NEW.order_id<>OLD.order_id OR NEW.payload<>OLD.payload OR NEW.payer_id<>OLD.payer_id OR NEW.package<>OLD.package OR NEW.xtr<>OLD.xtr OR NEW.dust<>OLD.dust OR NEW.scope<>OLD.scope OR NEW.terms_version<>OLD.terms_version OR NEW.retention_days<>OLD.retention_days OR NEW.request_key<>OLD.request_key OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Order price snapshot immutable'); END;
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
