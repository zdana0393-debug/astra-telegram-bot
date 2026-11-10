-- LOCAL proposal only. Writers paused; complete 0024..0028 required. No backfill/debit.
CREATE TABLE IF NOT EXISTS astra_tarot25_runtime29 (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL DEFAULT 'tarot25-policy-v1' CHECK(version='tarot25-policy-v1'),
 migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1)),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 price_version TEXT NOT NULL DEFAULT 'tarot25-prices-proposal-v1',revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
);
INSERT OR IGNORE INTO astra_tarot25_runtime29(singleton) VALUES(1);
CREATE TABLE IF NOT EXISTS astra_tarot25_prices29 (
 price_version TEXT NOT NULL,spread_id TEXT NOT NULL,size INTEGER NOT NULL CHECK(size IN(3,5,7,10)),price INTEGER NOT NULL CHECK(price IN(5,8,14,21,32)),
 theme TEXT NOT NULL,positions_json TEXT NOT NULL CHECK(json_valid(positions_json)),PRIMARY KEY(price_version,spread_id)
);
INSERT OR IGNORE INTO astra_tarot25_prices29 VALUES('tarot25-prices-proposal-v1','basic-3',3,5,'general','["situation","obstacle","advice"]');
INSERT OR IGNORE INTO astra_tarot25_prices29 VALUES('tarot25-prices-proposal-v1','relations-3',3,8,'relations','["self","between","care"]');
INSERT OR IGNORE INTO astra_tarot25_prices29 VALUES('tarot25-prices-proposal-v1','work-3',3,8,'work','["task","means","practice"]');
INSERT OR IGNORE INTO astra_tarot25_prices29 VALUES('tarot25-prices-proposal-v1','choice-3',3,8,'choice','["criterion","tension","test"]');
INSERT OR IGNORE INTO astra_tarot25_prices29 VALUES('tarot25-prices-proposal-v1','depth-5',5,14,'general','["resource","barrier","tendency","step","integration"]');
INSERT OR IGNORE INTO astra_tarot25_prices29 VALUES('tarot25-prices-proposal-v1','depth-7',7,21,'general','["core","roots","inner","outer","obstacle","support","direction"]');
INSERT OR IGNORE INTO astra_tarot25_prices29 VALUES('tarot25-prices-proposal-v1','celtic-10',10,32,'general','["present","crossing","foundation","past","crown","near","self","environment","hopes","outcome"]');

CREATE TABLE IF NOT EXISTS astra_tarot25_offers29 (
 offer_id TEXT PRIMARY KEY NOT NULL CHECK(length(offer_id)=32 AND offer_id NOT GLOB '*[^a-f0-9]*'),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL,request_key TEXT NOT NULL CHECK(length(request_key) BETWEEN 1 AND 128),update_id INTEGER NOT NULL CHECK(update_id>=0),
 spread_id TEXT NOT NULL,theme TEXT NOT NULL CHECK(theme IN('general','relations','work','choice','resources','self')),size INTEGER NOT NULL,
 price INTEGER NOT NULL,price_version TEXT NOT NULL,policy_revision INTEGER NOT NULL,
 deck_version TEXT NOT NULL,engine_version TEXT NOT NULL,spread_version TEXT NOT NULL,snapshot_version TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND length(CAST(snapshot_json AS BLOB))<=900000),result TEXT NOT NULL CHECK(length(result) BETWEEN 1 AND 60000),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','cancelled')),created_at INTEGER NOT NULL DEFAULT(unixepoch()),expires_at INTEGER NOT NULL,
 UNIQUE(telegram_id,generation,request_key),UNIQUE(telegram_id,generation,update_id),CHECK(expires_at=created_at+900),
 FOREIGN KEY(price_version,spread_id) REFERENCES astra_tarot25_prices29(price_version,spread_id)
);
CREATE INDEX IF NOT EXISTS idx_tarot25_offers29_owner ON astra_tarot25_offers29(telegram_id,generation,created_at,offer_id);
CREATE TABLE IF NOT EXISTS astra_tarot25_purchases29 (
 offer_id TEXT PRIMARY KEY NOT NULL REFERENCES astra_tarot25_offers29(offer_id),telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 generation TEXT NOT NULL,price INTEGER NOT NULL,price_version TEXT NOT NULL,spread_id TEXT NOT NULL,theme TEXT NOT NULL,size INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),result TEXT NOT NULL,deck_version TEXT NOT NULL,engine_version TEXT NOT NULL,spread_version TEXT NOT NULL,snapshot_version TEXT NOT NULL,
 delivery TEXT NOT NULL DEFAULT 'pending' CHECK(delivery IN('pending','sending','sent','retry','unknown','rejected','cancelled')),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,not_before INTEGER NOT NULL DEFAULT 0,parts_sent INTEGER NOT NULL DEFAULT 0 CHECK(parts_sent BETWEEN 0 AND 30),last_code INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tarot25_purchases29_owner ON astra_tarot25_purchases29(telegram_id,generation,created_at DESC,offer_id DESC);
