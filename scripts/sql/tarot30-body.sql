-- Development policy; both write admission and cleanup start OFF.
CREATE TABLE IF NOT EXISTS astra_tarot30_policy(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL DEFAULT 'tarot30-local-proposal-v1' CHECK(version='tarot30-local-proposal-v1'),
 migration_done INTEGER NOT NULL DEFAULT 0 CHECK(migration_done IN(0,1)),write_enabled INTEGER NOT NULL DEFAULT 0 CHECK(write_enabled IN(0,1)),cleanup_enabled INTEGER NOT NULL DEFAULT 0 CHECK(cleanup_enabled IN(0,1)),
 retention_seconds INTEGER NOT NULL DEFAULT 86400 CHECK(typeof(retention_seconds)='integer' AND retention_seconds BETWEEN 3600 AND 2592000),daily_limit INTEGER NOT NULL DEFAULT 3 CHECK(typeof(daily_limit)='integer' AND daily_limit BETWEEN 1 AND 10000),
 batch_limit INTEGER NOT NULL DEFAULT 20 CHECK(typeof(batch_limit)='integer' AND batch_limit BETWEEN 1 AND 20),soft_cap_bytes INTEGER NOT NULL DEFAULT 350000000 CHECK(typeof(soft_cap_bytes)='integer' AND soft_cap_bytes BETWEEN 1048576 AND 450000000),revision INTEGER NOT NULL DEFAULT 0 CHECK(typeof(revision)='integer' AND revision>=0)
);
INSERT OR IGNORE INTO astra_tarot30_policy(singleton)VALUES(1);
CREATE TRIGGER IF NOT EXISTS astra_tarot30_policy_insert BEFORE INSERT ON astra_tarot30_policy WHEN EXISTS(SELECT 1 FROM astra_tarot30_policy WHERE singleton=NEW.singleton) BEGIN SELECT RAISE(IGNORE);END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_policy_delete BEFORE DELETE ON astra_tarot30_policy BEGIN SELECT RAISE(ABORT,'Retention policy required');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_policy_update BEFORE UPDATE ON astra_tarot30_policy BEGIN
 SELECT CASE WHEN NEW.singleton<>OLD.singleton OR NEW.version<>OLD.version OR (OLD.migration_done=1 AND NEW.migration_done<>1) OR NEW.revision<OLD.revision OR ((NEW.write_enabled=1 OR NEW.cleanup_enabled=1) AND NEW.migration_done<>1) THEN RAISE(ABORT,'Invalid retention policy transition') END;
 SELECT CASE WHEN (NEW.retention_seconds<>OLD.retention_seconds OR NEW.daily_limit<>OLD.daily_limit OR NEW.batch_limit<>OLD.batch_limit OR NEW.soft_cap_bytes<>OLD.soft_cap_bytes) AND (OLD.write_enabled=1 OR OLD.cleanup_enabled=1 OR NEW.write_enabled=1 OR NEW.cleanup_enabled=1 OR NEW.revision<>OLD.revision+1) THEN RAISE(ABORT,'Close storage gates and revise policy before changes') END;
END;
CREATE TABLE IF NOT EXISTS astra_tarot30_days(day TEXT PRIMARY KEY NOT NULL CHECK(length(day)=10 AND date(day,'+0 days') IS day),key_fingerprint TEXT NOT NULL CHECK(length(key_fingerprint)=64 AND key_fingerprint NOT GLOB '*[^a-f0-9]*'));
CREATE TABLE IF NOT EXISTS astra_tarot30_bindings(telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL,day TEXT NOT NULL REFERENCES astra_tarot30_days(day),subject TEXT NOT NULL CHECK(length(subject)=64 AND subject NOT GLOB '*[^a-f0-9]*'),PRIMARY KEY(telegram_id,generation,day));
CREATE TABLE IF NOT EXISTS astra_tarot30_quota(day TEXT NOT NULL,subject TEXT NOT NULL,used INTEGER NOT NULL CHECK(typeof(used)='integer' AND used>=0),PRIMARY KEY(day,subject));
CREATE TABLE IF NOT EXISTS astra_tarot30_requests(telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,generation TEXT NOT NULL,request_key TEXT NOT NULL CHECK(length(request_key) BETWEEN 1 AND 128),update_id INTEGER NOT NULL CHECK(update_id>=0),offer_id TEXT NOT NULL,spread_id TEXT NOT NULL,theme TEXT NOT NULL,created_at INTEGER NOT NULL,original INTEGER NOT NULL CHECK(original IN(0,1)),PRIMARY KEY(telegram_id,generation,request_key),UNIQUE(telegram_id,generation,update_id));
CREATE INDEX IF NOT EXISTS idx_tarot30_requests_day ON astra_tarot30_requests(telegram_id,generation,created_at,original);
CREATE INDEX IF NOT EXISTS idx_tarot30_requests_offer ON astra_tarot30_requests(offer_id);
CREATE INDEX IF NOT EXISTS idx_tarot30_cleanup ON astra_tarot25_offers29(expires_at,offer_id);
CREATE INDEX IF NOT EXISTS idx_tarot30_reuse ON astra_tarot25_offers29(telegram_id,generation,spread_id,theme,status,expires_at);
-- Existing sealed offers gain only compact request receipts. Their payload stays exact.
INSERT OR IGNORE INTO astra_tarot30_requests SELECT telegram_id,generation,request_key,update_id,offer_id,spread_id,theme,created_at,1 FROM astra_tarot25_offers29;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_day_insert BEFORE INSERT ON astra_tarot30_days BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_days WHERE day=NEW.day AND key_fingerprint<>NEW.key_fingerprint) THEN RAISE(ABORT,'DRAFT_KEY_CHANGED_TODAY') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_days WHERE day=NEW.day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.day<>date(unixepoch(),'unixepoch','+3 hours') THEN RAISE(ABORT,'DRAFT_CLOCK_MISMATCH') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_day_update BEFORE UPDATE ON astra_tarot30_days BEGIN SELECT RAISE(ABORT,'Draft day key immutable');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_day_delete BEFORE DELETE ON astra_tarot30_days BEGIN SELECT RAISE(ABORT,'Draft day proof immutable');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_binding_guard BEFORE INSERT ON astra_tarot30_bindings BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_bindings WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND day=NEW.day AND subject<>NEW.subject) THEN RAISE(ABORT,'DRAFT_SUBJECT_MISMATCH') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_bindings WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND day=NEW.day) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.day<>date(unixepoch(),'unixepoch','+3 hours') OR NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_tarot30_policy r ON r.singleton=1 WHERE u.telegram_id=NEW.telegram_id AND p.generation=NEW.generation AND r.migration_done=1 AND r.write_enabled=1) THEN RAISE(ABORT,'DRAFT_BINDING_AUTHORITY') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_binding_seed AFTER INSERT ON astra_tarot30_bindings BEGIN
 INSERT INTO astra_tarot30_quota(day,subject,used)SELECT NEW.day,NEW.subject,max(coalesce((SELECT used FROM astra_tarot30_quota WHERE day=NEW.day AND subject=NEW.subject),0),count(*)) FROM astra_tarot30_requests WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND original=1 AND created_at>=unixepoch(NEW.day||'T00:00:00')-10800 AND created_at<unixepoch(NEW.day||'T00:00:00')+75600 ON CONFLICT(day,subject)DO UPDATE SET used=max(used,excluded.used);
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_binding_update BEFORE UPDATE ON astra_tarot30_bindings BEGIN SELECT RAISE(ABORT,'Draft binding immutable');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_binding_delete BEFORE DELETE ON astra_tarot30_bindings WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,'Erase draft binding with profile');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_quota_insert BEFORE INSERT ON astra_tarot30_quota BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_quota WHERE day=NEW.day AND subject=NEW.subject AND used>NEW.used) THEN RAISE(ABORT,'Draft quota cannot reset') END;
 SELECT CASE WHEN NEW.day<>date(unixepoch(),'unixepoch','+3 hours') OR NOT EXISTS(SELECT 1 FROM astra_tarot30_bindings b JOIN astra_users u USING(telegram_id) JOIN astra_user_policy p USING(telegram_id) WHERE b.day=NEW.day AND b.subject=NEW.subject AND p.generation=b.generation) THEN RAISE(ABORT,'DRAFT_QUOTA_AUTHORITY') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_quota_update BEFORE UPDATE ON astra_tarot30_quota BEGIN
 SELECT CASE WHEN NEW.day<>OLD.day OR NEW.subject<>OLD.subject OR NEW.used<OLD.used OR NEW.day<>date(unixepoch(),'unixepoch','+3 hours') THEN RAISE(ABORT,'Draft quota cannot reset') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_request_guard BEFORE INSERT ON astra_tarot30_requests WHEN(SELECT migration_done FROM astra_tarot30_policy)=1 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_requests WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND(request_key=NEW.request_key OR update_id=NEW.update_id)) THEN CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_requests WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND request_key=NEW.request_key AND update_id=NEW.update_id AND offer_id=NEW.offer_id AND spread_id=NEW.spread_id AND theme=NEW.theme) THEN RAISE(IGNORE) ELSE RAISE(ABORT,'DRAFT_REQUEST_SEEN') END END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id WHERE o.offer_id=NEW.offer_id AND o.telegram_id=NEW.telegram_id AND o.generation=NEW.generation AND p.generation=o.generation AND o.spread_id=NEW.spread_id AND o.theme=NEW.theme AND o.status='open' AND o.expires_at>unixepoch() AND o.policy_revision=(SELECT revision FROM astra_tarot25_runtime29 WHERE singleton=1) AND o.price_version=(SELECT price_version FROM astra_tarot25_runtime29 WHERE singleton=1) AND NEW.created_at=unixepoch() AND EXISTS(SELECT 1 FROM astra_tarot30_policy WHERE migration_done=1 AND write_enabled=1) AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=o.offer_id)) THEN RAISE(ABORT,'DRAFT_REQUEST_AUTHORITY') END;
 SELECT CASE WHEN NEW.original=1 AND NOT EXISTS(SELECT 1 FROM astra_tarot25_offers29 WHERE offer_id=NEW.offer_id AND request_key=NEW.request_key AND update_id=NEW.update_id) THEN RAISE(ABORT,'DRAFT_REQUEST_ORIGINAL') END;
 SELECT CASE WHEN (SELECT page_count FROM pragma_page_count)*(SELECT page_size FROM pragma_page_size)+8192>(SELECT soft_cap_bytes FROM astra_tarot30_policy) THEN RAISE(ABORT,'DRAFT_STORAGE_SOFT_CAP') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_request_update BEFORE UPDATE ON astra_tarot30_requests BEGIN SELECT RAISE(ABORT,'Draft request proof immutable');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_request_delete BEFORE DELETE ON astra_tarot30_requests WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN SELECT RAISE(ABORT,'Erase draft request proofs with profile');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_offer_admission BEFORE INSERT ON astra_tarot25_offers29 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_offers29 WHERE offer_id=NEW.offer_id OR(telegram_id=NEW.telegram_id AND generation=NEW.generation AND(request_key=NEW.request_key OR update_id=NEW.update_id))) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_tarot30_policy WHERE singleton=1 AND migration_done=1 AND write_enabled=1) THEN RAISE(ABORT,'DRAFT_STORAGE_DISABLED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_requests WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND(request_key=NEW.request_key OR update_id=NEW.update_id)) THEN RAISE(ABORT,'DRAFT_REQUEST_SEEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_offers29 o WHERE o.telegram_id=NEW.telegram_id AND o.generation=NEW.generation AND o.spread_id=NEW.spread_id AND o.theme=NEW.theme AND o.policy_revision=NEW.policy_revision AND o.price_version=NEW.price_version AND o.status='open' AND o.expires_at>unixepoch() AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=o.offer_id)) THEN RAISE(ABORT,'DRAFT_REUSE_WINNER') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_tarot30_bindings b JOIN astra_tarot30_quota q ON q.day=b.day AND q.subject=b.subject JOIN astra_users u USING(telegram_id) JOIN astra_user_policy p USING(telegram_id) WHERE b.telegram_id=NEW.telegram_id AND b.generation=NEW.generation AND p.generation=b.generation AND b.day=date(unixepoch(),'unixepoch','+3 hours') AND q.used<(SELECT daily_limit FROM astra_tarot30_policy)) THEN RAISE(ABORT,'DRAFT_DAILY_LIMIT') END;
 SELECT CASE WHEN json_type(NEW.snapshot_json,'$.question') IS NOT 'null' OR json_type(NEW.snapshot_json,'$.question_consent') IS NOT 'false' THEN RAISE(ABORT,'DRAFT_QUESTIONS_DISABLED') END;
 SELECT CASE WHEN (SELECT page_count FROM pragma_page_count)*(SELECT page_size FROM pragma_page_size)+2*(length(CAST(NEW.snapshot_json AS BLOB))+length(CAST(NEW.result AS BLOB)))+65536>(SELECT soft_cap_bytes FROM astra_tarot30_policy) THEN RAISE(ABORT,'DRAFT_STORAGE_SOFT_CAP') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_offer_post AFTER INSERT ON astra_tarot25_offers29 BEGIN
 UPDATE astra_tarot30_quota SET used=used+1 WHERE day=date(unixepoch(),'unixepoch','+3 hours') AND subject=(SELECT subject FROM astra_tarot30_bindings WHERE telegram_id=NEW.telegram_id AND generation=NEW.generation AND day=date(unixepoch(),'unixepoch','+3 hours'));
 INSERT INTO astra_tarot30_requests VALUES(NEW.telegram_id,NEW.generation,NEW.request_key,NEW.update_id,NEW.offer_id,NEW.spread_id,NEW.theme,NEW.created_at,1);
END;
CREATE TABLE IF NOT EXISTS astra_tarot30_cleanup_runs(token TEXT PRIMARY KEY NOT NULL CHECK(length(token)=32 AND token NOT GLOB '*[^a-f0-9]*'),revision INTEGER NOT NULL,retention_seconds INTEGER NOT NULL,batch_limit INTEGER NOT NULL CHECK(typeof(batch_limit)='integer' AND batch_limit BETWEEN 1 AND 20),started_at INTEGER NOT NULL DEFAULT(unixepoch()),finished_at INTEGER NOT NULL DEFAULT 0,deleted_count INTEGER NOT NULL DEFAULT 0 CHECK(typeof(deleted_count)='integer' AND deleted_count BETWEEN 0 AND 20),payload_bytes INTEGER NOT NULL DEFAULT 0 CHECK(typeof(payload_bytes)='integer' AND payload_bytes>=0),quota_deleted INTEGER NOT NULL DEFAULT 0 CHECK(typeof(quota_deleted)='integer' AND quota_deleted BETWEEN 0 AND 20));
CREATE TABLE IF NOT EXISTS astra_tarot30_cleanup_claims(offer_id TEXT PRIMARY KEY NOT NULL,token TEXT NOT NULL REFERENCES astra_tarot30_cleanup_runs(token),telegram_id INTEGER NOT NULL,generation TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS astra_tarot30_cleanup_claim BEFORE INSERT ON astra_tarot30_cleanup_claims BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_tarot30_cleanup_runs r JOIN astra_tarot30_policy s ON s.singleton=1 JOIN astra_tarot25_offers29 o ON o.offer_id=NEW.offer_id JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id WHERE r.token=NEW.token AND r.finished_at=0 AND r.started_at=unixepoch() AND r.revision=s.revision AND s.cleanup_enabled=1 AND o.telegram_id=NEW.telegram_id AND o.generation=NEW.generation AND p.generation=o.generation AND o.created_at=NEW.created_at AND o.expires_at=NEW.expires_at AND o.status=NEW.status AND o.expires_at+s.retention_seconds<=unixepoch() AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=o.offer_id) AND NOT EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key='tarot25:'||o.offer_id) AND(SELECT count(*) FROM astra_tarot30_cleanup_claims WHERE token=r.token)<r.batch_limit) THEN RAISE(ABORT,'DRAFT_CLEANUP_CLAIM_REFUSED') END;
END;
DROP TRIGGER IF EXISTS astra_tarot25_offer_delete29;
CREATE TRIGGER astra_tarot25_offer_delete29 BEFORE DELETE ON astra_tarot25_offers29 WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=OLD.offer_id) OR EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key='tarot25:'||OLD.offer_id) OR NOT EXISTS(SELECT 1 FROM astra_tarot30_cleanup_claims c JOIN astra_tarot30_cleanup_runs r ON r.token=c.token JOIN astra_tarot30_policy s ON s.singleton=1 JOIN astra_user_policy p ON p.telegram_id=OLD.telegram_id WHERE c.offer_id=OLD.offer_id AND c.telegram_id=OLD.telegram_id AND c.generation=OLD.generation AND p.generation=OLD.generation AND c.created_at=OLD.created_at AND c.expires_at=OLD.expires_at AND c.status=OLD.status AND OLD.expires_at+s.retention_seconds<=unixepoch() AND s.cleanup_enabled=1 AND r.finished_at=0 AND r.started_at=unixepoch() AND r.revision=s.revision) THEN RAISE(ABORT,'DRAFT_DELETE_REQUIRES_CLEANUP_UNPAID_PROOF') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_offer_erased AFTER DELETE ON astra_tarot25_offers29 WHEN EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=OLD.telegram_id) BEGIN
 UPDATE astra_tarot30_cleanup_runs SET deleted_count=deleted_count+1,payload_bytes=payload_bytes+length(CAST(OLD.snapshot_json AS BLOB))+length(CAST(OLD.result AS BLOB)) WHERE token=(SELECT token FROM astra_tarot30_cleanup_claims WHERE offer_id=OLD.offer_id);
 DELETE FROM astra_tarot30_cleanup_claims WHERE offer_id=OLD.offer_id;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_claim_update BEFORE UPDATE ON astra_tarot30_cleanup_claims BEGIN SELECT RAISE(ABORT,'Cleanup claim immutable');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_claim_delete BEFORE DELETE ON astra_tarot30_cleanup_claims WHEN EXISTS(SELECT 1 FROM astra_tarot25_offers29 WHERE offer_id=OLD.offer_id) BEGIN SELECT RAISE(ABORT,'Cleanup claim requires atomic erase');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_run_insert BEFORE INSERT ON astra_tarot30_cleanup_runs BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_cleanup_runs WHERE token=NEW.token AND(revision<>NEW.revision OR retention_seconds<>NEW.retention_seconds OR batch_limit<>NEW.batch_limit)) THEN RAISE(ABORT,'DRAFT_CLEANUP_TOKEN_MISMATCH') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM astra_tarot30_cleanup_runs WHERE token=NEW.token) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.finished_at<>0 OR NEW.deleted_count<>0 OR NEW.payload_bytes<>0 OR NEW.quota_deleted<>0 OR NEW.started_at<>unixepoch() OR NOT EXISTS(SELECT 1 FROM astra_tarot30_policy WHERE singleton=1 AND migration_done=1 AND cleanup_enabled=1 AND revision=NEW.revision AND retention_seconds=NEW.retention_seconds AND NEW.batch_limit<=batch_limit) THEN RAISE(ABORT,'DRAFT_CLEANUP_DISABLED_OR_MISMATCH') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_run_update BEFORE UPDATE ON astra_tarot30_cleanup_runs BEGIN
 SELECT CASE WHEN OLD.finished_at<>0 OR NEW.token<>OLD.token OR NEW.revision<>OLD.revision OR NEW.retention_seconds<>OLD.retention_seconds OR NEW.batch_limit<>OLD.batch_limit OR NEW.started_at<>OLD.started_at OR NEW.deleted_count<OLD.deleted_count OR NEW.payload_bytes<OLD.payload_bytes OR NEW.quota_deleted<OLD.quota_deleted OR NEW.deleted_count+NEW.quota_deleted>NEW.batch_limit OR(NEW.finished_at<>0 AND NEW.finished_at<>unixepoch()) THEN RAISE(ABORT,'Cleanup run immutable or invalid') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_run_delete BEFORE DELETE ON astra_tarot30_cleanup_runs BEGIN SELECT RAISE(ABORT,'Cleanup aggregate proof immutable');END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_quota_delete BEFORE DELETE ON astra_tarot30_quota BEGIN
 SELECT CASE WHEN OLD.day>=date(unixepoch(),'unixepoch','+3 hours') OR NOT EXISTS(SELECT 1 FROM astra_tarot30_cleanup_runs r JOIN astra_tarot30_policy s ON s.singleton=1 WHERE r.finished_at=0 AND r.started_at=unixepoch() AND r.revision=s.revision AND s.cleanup_enabled=1 AND r.deleted_count+r.quota_deleted<r.batch_limit) THEN RAISE(ABORT,'Draft quota cleanup not authorized') END;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_quota_erased AFTER DELETE ON astra_tarot30_quota BEGIN
 UPDATE astra_tarot30_cleanup_runs SET quota_deleted=quota_deleted+1 WHERE finished_at=0 AND started_at=unixepoch();
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_run_execute AFTER INSERT ON astra_tarot30_cleanup_runs BEGIN
 INSERT INTO astra_tarot30_cleanup_claims SELECT o.offer_id,NEW.token,o.telegram_id,o.generation,o.created_at,o.expires_at,o.status FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id AND p.generation=o.generation WHERE o.expires_at<=unixepoch()-NEW.retention_seconds AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=o.offer_id) AND NOT EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key='tarot25:'||o.offer_id) ORDER BY o.expires_at,o.offer_id LIMIT NEW.batch_limit;
 DELETE FROM astra_tarot25_offers29 WHERE offer_id IN(SELECT offer_id FROM astra_tarot30_cleanup_claims WHERE token=NEW.token);
 DELETE FROM astra_tarot30_quota WHERE(day,subject)IN(SELECT day,subject FROM astra_tarot30_quota WHERE day<date(unixepoch(),'unixepoch','+3 hours') ORDER BY day,subject LIMIT(SELECT batch_limit-deleted_count FROM astra_tarot30_cleanup_runs WHERE token=NEW.token));
 UPDATE astra_tarot30_cleanup_runs SET finished_at=unixepoch() WHERE token=NEW.token;
END;
CREATE TRIGGER IF NOT EXISTS astra_tarot30_erase AFTER DELETE ON astra_users BEGIN
 DELETE FROM astra_tarot30_requests WHERE telegram_id=OLD.telegram_id;
 DELETE FROM astra_tarot30_bindings WHERE telegram_id=OLD.telegram_id;
END;
