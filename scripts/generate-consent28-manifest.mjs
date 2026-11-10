// LOCAL development helper; does not connect to D1. Maintains the new 0028 only.
import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE astra_users(telegram_id INTEGER PRIMARY KEY,notifications_enabled INTEGER);CREATE TABLE astra_broadcast_outbox03(telegram_id INTEGER,day TEXT,state TEXT,generation TEXT,last_reason TEXT,PRIMARY KEY(telegram_id,day));CREATE TABLE astra_broadcast_runtime03(singleton INTEGER,migration_done INTEGER);');
const dir='migrations/0028_steps/',initial=['01_registry.sql','02_consent_guards.sql','03_delivery_guards.sql'].map(p=>fs.readFileSync(dir+p,'utf8')).join('');db.exec(initial);
const list=()=>db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND (name LIKE 'astra_%28' OR name LIKE 'idx_consent28_%') ORDER BY name").all();
const values=list().map(x=>'('+[x.name,x.type,x.sql].map(v=>"'"+v.replaceAll("'","''")+"'").join(',')+')').join(',');
const completion=`CREATE TRIGGER IF NOT EXISTS astra_consent_complete28 BEFORE UPDATE OF migration_done ON astra_consent_runtime28 WHEN NEW.migration_done=1 BEGIN
 SELECT CASE WHEN (WITH expected(name,type,sql) AS (VALUES ${values}) SELECT count(*) FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR a.sql IS NOT e.sql)>0 THEN RAISE(ABORT,'Consent schema definition mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_broadcast_runtime03 WHERE singleton=1 AND migration_done=1) THEN RAISE(ABORT,'0027 incomplete') END;
END;
UPDATE astra_consent_runtime28 SET migration_done=1 WHERE singleton=1 AND version='consent28-v1'
 AND EXISTS(SELECT 1 FROM astra_broadcast_runtime03 WHERE singleton=1 AND migration_done=1);
SELECT singleton,version,migration_done,delivery_quarantined FROM astra_consent_runtime28;
PRAGMA foreign_key_check;
`;
fs.writeFileSync(dir+'04_complete.sql',completion);db.exec(completion);const manifest=list();fs.writeFileSync('data/consent28-schema.json',JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync('migrations/0028_notification_consent.sql',initial+completion);
const all=manifest.map(x=>'('+[x.name,x.type,x.sql].map(v=>"'"+v.replaceAll("'","''")+"'").join(',')+')').join(',');
fs.writeFileSync('scripts/check_integrity_consent28.sql',`-- Read-only after 0028, aggregate output only.
WITH expected(name,type,sql) AS (VALUES ${all}) SELECT count(*) AS mismatched_definition FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR a.sql IS NOT e.sql;
SELECT count(*) AS violations FROM astra_notification_consent28 c LEFT JOIN astra_users u USING(telegram_id) LEFT JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id IS NULL OR c.generation IS NOT p.generation OR (c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND u.notifications_enabled<>1);
SELECT count(*) AS violations FROM astra_delivery_consent28 d LEFT JOIN astra_broadcast_outbox03 q ON q.telegram_id=d.telegram_id AND q.day=d.day WHERE q.telegram_id IS NULL OR q.generation<>d.generation;
SELECT version,migration_done,delivery_quarantined FROM astra_consent_runtime28 WHERE singleton=1;
PRAGMA foreign_key_check;
`);db.close();console.log('Generated 0028 DDL manifest: '+manifest.length+' objects (including indexes).');
