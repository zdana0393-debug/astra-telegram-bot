import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {loadPlan07,objects25,ROOT25} from './lib/astra25-plan07.mjs';
import {cleanInstall25} from './build-astra25-clean.mjs';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
export function schema251(){
 const plan=loadPlan07(),base=plan.stages.at(-1).objects,db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(cleanInstall25().sql);
 const sqls=["SELECT json_extract(CASE WHEN (SELECT count(*) FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name<>'_cf_KV')=286 THEN '{\"ok\":1}' ELSE 'ASTRA251_BASE_SCHEMA_MISMATCH' END,'$.ok')"];
 // Read-only exact preflight, split below D1's100KB statement ceiling.
 let group=[];const guard=items=>"SELECT json_extract(CASE WHEN NOT EXISTS(WITH expected(name,type,definition)AS(VALUES "+items.map(o=>'('+[o.name,o.type,o.sql].map(quote).join(',')+')').join(',')+") SELECT 1 FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR trim(a.sql) IS NOT trim(e.definition))THEN '{\"ok\":1}' ELSE 'ASTRA251_BASE_SCHEMA_MISMATCH' END,'$.ok')";
 for(const o of base){if(group.length&&Buffer.byteLength(guard([...group,o]))>80000){sqls.push(guard(group));group=[];}group.push(o);if(Buffer.byteLength(guard(group))>80000)throw Error('SCHEMA251_PREFLIGHT_TOO_LARGE');}if(group.length)sqls.push(guard(group));
 const added=fs.readFileSync(ROOT25+'src/astra251/schema.sql','utf8');sqls.push(added.trim().replace(/;$/,''));
 const costs=[
  ['astra_tarot25_offers29','4096+length(CAST(NEW.snapshot_json AS BLOB))+length(CAST(NEW.result AS BLOB))'],
  ['astra_tarot25_purchases29','4096+length(CAST(NEW.snapshot_json AS BLOB))+length(CAST(NEW.result AS BLOB))'],
  ['astra_tarot31_intents','1024'],['astra_tarot31_questions',"512+coalesce(length(CAST(NEW.text AS BLOB)),0)"],['astra_tarot31_receipts','512'],['astra_tarot31_burst','128'],['astra_tarot30_requests','512']
 ];
 const total=costs.map(([table,cost])=>'(SELECT coalesce(sum('+cost.replaceAll('NEW.','')+'),0) FROM '+table+')').join('+');
 sqls.push("INSERT INTO astra_storage251(singleton,version,used_bytes)SELECT 1,'storage251-v1',"+total);
 for(const [table,cost]of costs){const suffix=table.replace('astra_','');
  sqls.push(`CREATE TRIGGER storage251_${suffix}_guard BEFORE INSERT ON ${table} BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_storage251 WHERE singleton=1 AND version='storage251-v1')THEN RAISE(ABORT,'DRAFT_STORAGE_COUNTER_MISSING')END;SELECT CASE WHEN (SELECT used_bytes+overhead_bytes FROM astra_storage251 WHERE singleton=1)+(${cost})+65536>(SELECT soft_cap_bytes FROM astra_tarot30_policy WHERE singleton=1)THEN RAISE(ABORT,'DRAFT_STORAGE_SOFT_CAP')END;END`);
  sqls.push(`CREATE TRIGGER storage251_${suffix}_insert AFTER INSERT ON ${table} BEGIN UPDATE astra_storage251 SET used_bytes=used_bytes+(${cost})WHERE singleton=1;END`);
  sqls.push(`CREATE TRIGGER storage251_${suffix}_delete AFTER DELETE ON ${table} BEGIN UPDATE astra_storage251 SET used_bytes=used_bytes-(${cost.replaceAll('NEW.','OLD.')})WHERE singleton=1;END`);
 }
 sqls.push("CREATE TRIGGER storage251_question_guard BEFORE UPDATE OF text ON astra_tarot31_questions BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_storage251 WHERE singleton=1 AND version='storage251-v1')THEN RAISE(ABORT,'DRAFT_STORAGE_COUNTER_MISSING')END;SELECT CASE WHEN(SELECT used_bytes+overhead_bytes FROM astra_storage251 WHERE singleton=1)+coalesce(length(CAST(NEW.text AS BLOB)),0)-coalesce(length(CAST(OLD.text AS BLOB)),0)+65536>(SELECT soft_cap_bytes FROM astra_tarot30_policy WHERE singleton=1)THEN RAISE(ABORT,'DRAFT_STORAGE_SOFT_CAP')END;END");
 sqls.push("CREATE TRIGGER storage251_question_update AFTER UPDATE OF text ON astra_tarot31_questions BEGIN UPDATE astra_storage251 SET used_bytes=used_bytes+coalesce(length(CAST(NEW.text AS BLOB)),0)-coalesce(length(CAST(OLD.text AS BLOB)),0)WHERE singleton=1;END");
 for(const name of ['astra_tarot31_intent_insert','astra_tarot30_offer_admission','astra_tarot30_request_guard']){
  const old=base.find(o=>o.name===name).sql;
  const next=old.replaceAll('(SELECT page_count FROM pragma_page_count)*(SELECT page_size FROM pragma_page_size)',"(coalesce((SELECT used_bytes+overhead_bytes FROM astra_storage251 WHERE singleton=1 AND version='storage251-v1'),9223372036854775807))");
  if(old===next)throw Error('STORAGE251_ANCHOR_MISSING');sqls.push('DROP TRIGGER '+name,next);
 }
 const sql='-- ASTRA2.5.1 upgrade32: apply ONLY after verified backup and writer freeze.\n-- No automatic Stars activation. No profile, ledger or paid snapshot rewrite.\n'+sqls.map(s=>s+';').join('\n')+'\n';
 try{db.exec(sql);const objects=objects25(db).map(({name,type,sql})=>({name,type,sql}));  return{sql,objects,costs,total};
 }finally{db.close();}
}
export function integrity251(s=schema251()){
 const checks=["SELECT 'schema251/count' check_name,abs((SELECT count(*)FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name<>'_cf_KV')-"+s.objects.length+") violations"];
 const query=items=>"SELECT 'schema251/ddl' check_name,count(*)violations FROM(WITH expected(name,type,definition)AS(VALUES "+items.map(o=>'('+[o.name,o.type,o.sql].map(quote).join(',')+')').join(',')+")SELECT 1 FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR trim(a.sql) IS NOT trim(e.definition))";
 let group=[];for(const o of s.objects){if(group.length&&Buffer.byteLength(query([...group,o]))>80000){checks.push(query(group));group=[];}group.push(o);}if(group.length)checks.push(query(group));
 checks.push("SELECT 'admin251/ledger' check_name,count(*)violations FROM astra_admin_grants25 g WHERE target_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='admin:grant:'||g.update_id AND l.telegram_id=g.target_id AND l.delta=g.amount AND l.reason='admin:grant')",
 "SELECT 'admin251/generation' check_name,count(*)violations FROM astra_admin_grants25 r WHERE target_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM astra_user_policy g WHERE g.telegram_id=r.target_id AND g.generation=r.target_generation)",
 "SELECT 'owner251/profile' check_name,count(*)violations FROM astra_owner251 c WHERE state='enrolled' AND NOT EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy g USING(telegram_id)WHERE u.telegram_id=c.owner_id AND g.generation=c.owner_generation)",
 "SELECT 'wallet/balance' check_name,count(*)violations FROM astra_users u WHERE u.balance<0 OR typeof(u.balance)<>'integer' OR u.balance>9007199254740991 OR u.balance<>(SELECT coalesce(sum(delta),0)FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)",
 "SELECT 'refund/debt' check_name,count(*)violations FROM astra_refund_accounts a WHERE a.debt<>(SELECT coalesce(sum(debt_added),0)FROM astra_refund_settlements s WHERE s.payer_id=a.payer_id)-(SELECT coalesce(sum(amount),0)FROM astra_debt_repayments r WHERE r.payer_id=a.payer_id)",
 "SELECT 'storage251/counter' check_name,count(*)violations FROM astra_storage251 WHERE used_bytes<>("+s.total+")",
 "SELECT 'storage251/singleton' check_name,abs(1-(SELECT count(*)FROM astra_storage251 WHERE singleton=1 AND version='storage251-v1'))violations");
 return '-- READ ONLY. Aggregate counts only; no tokens, Telegram IDs or file_ids.\n'+checks.map(x=>x+';').join('\n')+'\n';
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const s=schema251();fs.writeFileSync(ROOT25+'scripts/check_integrity_astra251.sql',integrity251(s));fs.writeFileSync(ROOT25+'migrations/0032_astra251.sql',s.sql);fs.writeFileSync(ROOT25+'data/astra251-schema.json',JSON.stringify(s.objects,null,2)+'\n');
 console.log(JSON.stringify({objects:s.objects.length,sql_bytes:Buffer.byteLength(s.sql),remote_sql:false}));
}
