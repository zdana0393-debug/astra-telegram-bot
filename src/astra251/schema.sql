-- Versioned additions only. No historic money, profiles or snapshots are rewritten.
CREATE TABLE astra_storage251(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL CHECK(version='storage251-v1'),used_bytes INTEGER NOT NULL CHECK(typeof(used_bytes)='integer' AND used_bytes>=0),overhead_bytes INTEGER NOT NULL DEFAULT 0 CHECK(typeof(overhead_bytes)='integer' AND overhead_bytes>=0),measured_at INTEGER NOT NULL DEFAULT 0 CHECK(typeof(measured_at)='integer' AND measured_at>=0));
CREATE TRIGGER storage251_required BEFORE DELETE ON astra_storage251 BEGIN SELECT RAISE(ABORT,'DRAFT_STORAGE_COUNTER_REQUIRED');END;
CREATE TRIGGER storage251_identity BEFORE UPDATE ON astra_storage251 WHEN NEW.singleton IS NOT OLD.singleton OR NEW.version IS NOT OLD.version BEGIN SELECT RAISE(ABORT,'DRAFT_STORAGE_COUNTER_IMMUTABLE');END;

CREATE TABLE astra_owner251(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL DEFAULT 'owner251-v1' CHECK(version='owner251-v1'),
 state TEXT NOT NULL DEFAULT 'unconfigured' CHECK(state IN('unconfigured','pending','enrolled','revoked')),
 bot_id INTEGER,build_sha256 TEXT,parent_sha256 TEXT,challenge_hash TEXT,expires_at INTEGER,
 owner_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,owner_generation TEXT,
 claim_update INTEGER,claim_message INTEGER,claimed_at INTEGER,proof_mac TEXT,
 CHECK(owner_id IS NULL OR(typeof(owner_id)='integer' AND owner_id>0)),
 CHECK(build_sha256 IS NULL OR(length(build_sha256)=64 AND build_sha256 NOT GLOB '*[^a-f0-9]*')),
 CHECK(parent_sha256 IS NULL OR(length(parent_sha256)=64 AND parent_sha256 NOT GLOB '*[^a-f0-9]*')),
 CHECK(challenge_hash IS NULL OR(length(challenge_hash)=64 AND challenge_hash NOT GLOB '*[^a-f0-9]*')),
 CHECK(proof_mac IS NULL OR(length(proof_mac)=64 AND proof_mac NOT GLOB '*[^a-f0-9]*')),
 CHECK(coalesce((state='unconfigured' AND bot_id IS NULL AND build_sha256 IS NULL AND parent_sha256 IS NULL AND challenge_hash IS NULL AND expires_at IS NULL AND owner_id IS NULL AND owner_generation IS NULL AND claim_update IS NULL AND claim_message IS NULL AND claimed_at IS NULL AND proof_mac IS NULL)
 OR(state IN('pending','enrolled','revoked') AND typeof(bot_id)='integer' AND bot_id>0 AND bot_id<4503599627370496 AND build_sha256 IS NOT NULL AND parent_sha256 IS NOT NULL AND challenge_hash IS NOT NULL AND typeof(expires_at)='integer' AND expires_at>0 AND(
 (state IN('pending','revoked') AND owner_id IS NULL AND owner_generation IS NULL AND claim_update IS NULL AND claim_message IS NULL AND claimed_at IS NULL AND proof_mac IS NULL)
 OR(state='enrolled' AND owner_generation IS NOT NULL AND length(owner_generation)BETWEEN 1 AND 128 AND typeof(claim_update)='integer' AND claim_update>=0 AND typeof(claim_message)='integer' AND claim_message>0 AND typeof(claimed_at)='integer' AND claimed_at>0 AND proof_mac IS NOT NULL)
 )),0))
);
INSERT INTO astra_owner251(singleton)VALUES(1);
CREATE TRIGGER astra_owner_insert251 BEFORE INSERT ON astra_owner251 WHEN EXISTS(SELECT 1 FROM astra_owner251) BEGIN SELECT RAISE(ABORT,'OWNER_CONFIGURATION_EXISTS');END;
CREATE TRIGGER astra_owner_delete251 BEFORE DELETE ON astra_owner251 BEGIN SELECT RAISE(ABORT,'OWNER_CONFIGURATION_REQUIRED');END;
CREATE TRIGGER astra_owner_guard251 BEFORE UPDATE ON astra_owner251 BEGIN
 SELECT CASE WHEN NEW.singleton<>OLD.singleton OR NEW.version<>OLD.version THEN RAISE(ABORT,'OWNER_CONFIGURATION_IMMUTABLE')END;
 SELECT CASE WHEN NOT coalesce((
  OLD.state IN('unconfigured','revoked','pending') AND OLD.owner_id IS NULL AND NEW.state='pending' AND NEW.owner_id IS NULL AND NEW.owner_generation IS NULL AND NEW.claim_update IS NULL AND NEW.claim_message IS NULL AND NEW.claimed_at IS NULL AND NEW.proof_mac IS NULL AND NEW.bot_id>0 AND length(NEW.build_sha256)=64 AND length(NEW.parent_sha256)=64 AND length(NEW.challenge_hash)=64 AND NEW.challenge_hash IS NOT OLD.challenge_hash AND NEW.expires_at=unixepoch()+900
  OR OLD.state='pending' AND OLD.owner_id IS NULL AND OLD.expires_at>unixepoch() AND NEW.state='enrolled' AND NEW.bot_id=OLD.bot_id AND NEW.build_sha256=OLD.build_sha256 AND NEW.parent_sha256=OLD.parent_sha256 AND NEW.challenge_hash=OLD.challenge_hash AND NEW.expires_at=OLD.expires_at AND NEW.claimed_at BETWEEN unixepoch()-5 AND unixepoch() AND NEW.claim_update>=0 AND NEW.claim_message>0 AND length(NEW.proof_mac)=64 AND EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id)WHERE u.telegram_id=NEW.owner_id AND p.generation=NEW.owner_generation AND u.zodiac IS NOT NULL)
  OR OLD.state='enrolled' AND NEW.state='enrolled' AND OLD.owner_id IS NOT NULL AND NEW.owner_id IS NULL AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.owner_id) AND NEW.owner_generation IS OLD.owner_generation AND NEW.bot_id IS OLD.bot_id AND NEW.build_sha256 IS OLD.build_sha256 AND NEW.parent_sha256 IS OLD.parent_sha256 AND NEW.challenge_hash IS OLD.challenge_hash AND NEW.expires_at IS OLD.expires_at AND NEW.claim_update IS OLD.claim_update AND NEW.claim_message IS OLD.claim_message AND NEW.claimed_at IS OLD.claimed_at AND NEW.proof_mac IS OLD.proof_mac
  OR OLD.state='enrolled' AND NEW.state='revoked' AND NEW.owner_id IS NULL AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.owner_id) AND NEW.owner_generation IS NULL AND NEW.claim_update IS NULL AND NEW.claim_message IS NULL AND NEW.claimed_at IS NULL AND NEW.proof_mac IS NULL AND NEW.bot_id IS OLD.bot_id AND NEW.build_sha256 IS OLD.build_sha256 AND NEW.parent_sha256 IS OLD.parent_sha256 AND NEW.challenge_hash IS OLD.challenge_hash AND NEW.expires_at IS OLD.expires_at
 ),0)THEN RAISE(ABORT,'OWNER_TRANSITION_FORBIDDEN')END;
END;
CREATE TRIGGER astra_owner_null251 AFTER UPDATE OF owner_id ON astra_owner251 WHEN OLD.owner_id IS NOT NULL AND NEW.owner_id IS NULL BEGIN
 UPDATE astra_owner251 SET state='revoked',owner_generation=NULL,claim_update=NULL,claim_message=NULL,claimed_at=NULL,proof_mac=NULL WHERE singleton=1;
END;

CREATE TABLE astra_admin_grants25(
 update_id INTEGER PRIMARY KEY CHECK(typeof(update_id)='integer' AND update_id>=0),
 operator_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,operator_generation TEXT NOT NULL,
 target_id INTEGER REFERENCES astra_users(telegram_id) ON DELETE SET NULL,target_generation TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 1000),
 message_id INTEGER NOT NULL CHECK(message_id>0),message_date INTEGER NOT NULL CHECK(message_date>0),
 request_mac TEXT NOT NULL CHECK(length(request_mac)=64 AND request_mac NOT GLOB '*[^a-f0-9]*'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER astra_admin_grant_guard251 BEFORE INSERT ON astra_admin_grants25 BEGIN
 SELECT CASE WHEN NEW.operator_id IS NULL OR NEW.target_id IS NULL OR NEW.created_at<>CURRENT_TIMESTAMP OR NOT EXISTS(SELECT 1 FROM astra_owner251 c JOIN astra_users u ON u.telegram_id=c.owner_id JOIN astra_user_policy g ON g.telegram_id=u.telegram_id WHERE c.singleton=1 AND c.state='enrolled' AND c.owner_id=NEW.operator_id AND c.owner_generation=NEW.operator_generation AND g.generation=c.owner_generation AND NEW.message_date>=c.claimed_at AND NEW.message_date<=unixepoch()+30)
 THEN RAISE(ABORT,'ADMIN_OWNER_AUTHORITY')END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy g USING(telegram_id)WHERE u.telegram_id=NEW.target_id AND g.generation=NEW.target_generation AND u.zodiac IS NOT NULL)THEN RAISE(ABORT,'ADMIN_TARGET_NOT_REGISTERED')END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.target_id AND typeof(balance)='integer' AND balance>=0 AND balance<=9007199254740991-NEW.amount)THEN RAISE(ABORT,'ADMIN_BALANCE_RANGE')END;
END;
CREATE TRIGGER astra_admin_grants_post25 AFTER INSERT ON astra_admin_grants25 BEGIN
 UPDATE astra_users SET balance=balance+NEW.amount WHERE telegram_id=NEW.target_id AND EXISTS(SELECT 1 FROM astra_user_policy WHERE telegram_id=NEW.target_id AND generation=NEW.target_generation);
 SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'ADMIN_WALLET_UNCONFIRMED')END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.target_id AND typeof(balance)='integer' AND balance<=9007199254740991)THEN RAISE(ABORT,'ADMIN_BALANCE_RANGE')END;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)VALUES('admin:grant:'||NEW.update_id,NEW.target_id,NEW.amount,'admin:grant');
END;
CREATE TRIGGER astra_admin_grant_immutable251 BEFORE UPDATE ON astra_admin_grants25 BEGIN
 SELECT CASE WHEN NEW.update_id IS NOT OLD.update_id OR NEW.operator_generation IS NOT OLD.operator_generation OR NEW.target_generation IS NOT OLD.target_generation OR NEW.amount IS NOT OLD.amount OR NEW.message_id IS NOT OLD.message_id OR NEW.message_date IS NOT OLD.message_date OR NEW.request_mac IS NOT OLD.request_mac OR NEW.created_at IS NOT OLD.created_at OR NOT(NEW.operator_id IS OLD.operator_id OR(OLD.operator_id IS NOT NULL AND NEW.operator_id IS NULL AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.operator_id))) OR NOT(NEW.target_id IS OLD.target_id OR(OLD.target_id IS NOT NULL AND NEW.target_id IS NULL AND NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.target_id)))THEN RAISE(ABORT,'ADMIN_RECEIPT_IMMUTABLE')END;
END;
CREATE TRIGGER astra_admin_grant_delete251 BEFORE DELETE ON astra_admin_grants25 BEGIN SELECT RAISE(ABORT,'ADMIN_REPLAY_RECEIPT_REQUIRED');END;
CREATE TRIGGER astra_admin_erase251 AFTER DELETE ON astra_users BEGIN
 UPDATE astra_admin_grants25 SET target_id=NULL WHERE target_id=OLD.telegram_id;
 UPDATE astra_admin_grants25 SET operator_id=NULL WHERE operator_id=OLD.telegram_id;
 UPDATE astra_owner251 SET owner_id=NULL WHERE owner_id=OLD.telegram_id;
END;
