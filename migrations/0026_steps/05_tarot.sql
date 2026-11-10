CREATE TABLE IF NOT EXISTS astra_tarot_offers26 (
 offer_id TEXT PRIMARY KEY,telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL,request_key TEXT NOT NULL,
 price INTEGER NOT NULL DEFAULT 5 CHECK(price=5),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(telegram_id,generation,request_key)
);
CREATE TABLE IF NOT EXISTS astra_tarot_purchases26 (
 offer_id TEXT PRIMARY KEY REFERENCES astra_tarot_offers26(offer_id),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 price INTEGER NOT NULL CHECK(price=5),result TEXT NOT NULL CHECK(length(trim(result))>0),delivery TEXT NOT NULL DEFAULT 'pending' CHECK(delivery IN('pending','sending','sent','retry','unknown','rejected')),
 lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tarot_purchases26_owner ON astra_tarot_purchases26(telegram_id,created_at,offer_id);
CREATE TRIGGER IF NOT EXISTS astra_tarot_guard26 BEFORE INSERT ON astra_tarot_purchases26 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_tarot_offers26 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id WHERE o.offer_id=NEW.offer_id AND o.telegram_id=NEW.telegram_id AND o.generation=p.generation AND o.price=NEW.price AND u.balance>=NEW.price) THEN RAISE(IGNORE) END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot_post26 AFTER INSERT ON astra_tarot_purchases26 BEGIN
 UPDATE astra_users SET balance=balance-5 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES('tarot26:'||NEW.offer_id,NEW.telegram_id,-5,'tarot:v2');
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot_immutable26 BEFORE UPDATE ON astra_tarot_purchases26 WHEN NEW.offer_id<>OLD.offer_id OR NEW.telegram_id<>OLD.telegram_id OR NEW.price<>OLD.price OR NEW.result<>OLD.result OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Paid Tarot immutable'); END;
CREATE TRIGGER IF NOT EXISTS astra_tarot_erase26 AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_tarot_purchases26 WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_tarot_offers26 WHERE telegram_id=OLD.telegram_id;
END;
