// Only disposable synthetic SQLite. Generates actual sealed offers through TASK02.
import fs from 'node:fs';import {performance} from 'node:perf_hooks';
import {DatabaseSync} from 'node:sqlite';
import {createSynthetic20,adapter25} from './lib/astra25-synthetic.mjs';
import {upgradeLocal25} from './lib/astra25-upgrade05.mjs';
import {prepareOffer,confirmPurchase} from '../src/tarot25/purchases29.mjs';
import {storageSnapshot25,draftRetentionPreview25} from './lib/astra25-cost.mjs';
if(process.argv.length!==3||process.argv[2]!=='--local-only')throw Error('Only --local-only synthetic audit allowed');
const dir=fs.mkdtempSync('/tmp/astra25-task05-storage-'),source=dir+'/source.sqlite',output=dir+'/target.sqlite';let db;
try{
 await createSynthetic20(source);await upgradeLocal25({local_only:true,writers_paused:true,source,output});db=new DatabaseSync(output);db.exec('PRAGMA foreign_keys=ON;UPDATE astra_tarot25_runtime29 SET enabled=1');
 const env={DB:adapter25(db),ASTRA_TAROT25_ENABLED:'true'},actor={telegram_id:12,generation:db.prepare('SELECT generation FROM astra_user_policy WHERE telegram_id=12').get().generation};
 let clock=Math.floor(Date.now()/1000);db.function('unixepoch',()=>clock);const initial=storageSnapshot25(db),samples=[],start=performance.now();let first;
 for(let i=1;i<=10000;i++){
  const offer=await prepareOffer(env,actor,{spread_id:'celtic-10',request_key:'task05-storage-'+i,update_id:10000000+i});first??=offer;
  if([100,1000,10000].includes(i)){const s=storageSnapshot25(db);samples.push({offers:i,...s,actual_file_bytes:fs.statSync(output).size,elapsed_wall_ms:Math.round(performance.now()-start)});}
  if(i%500===0)console.log(JSON.stringify({task05_storage_progress:i}));
 }
 const ttl=900,beforeExpiry=storageSnapshot25(db);clock+=8*86400;const afterExpiry=storageSnapshot25(db),preview=draftRetentionPreview25(db,{proposed_retention_days:7,as_of:clock,limit:100});
 let expiredPurchaseRefused=false,protectedDeleteRefused=false;try{await confirmPurchase(env,actor,first.offer_id);}catch{expiredPurchaseRefused=true;}try{db.prepare('DELETE FROM astra_tarot25_offers29 WHERE offer_id=?').run(first.offer_id);}catch(e){protectedDeleteRefused=/Erase Tarot offers with profile/.test(e.message);}
 if(!expiredPurchaseRefused||!protectedDeleteRefused||JSON.stringify(beforeExpiry)!==JSON.stringify(afterExpiry))throw Error('RETENTION_AUDIT_FAILED');
 db.exec('UPDATE astra_tarot25_runtime29 SET enabled=0');const report={scope:'TASK05_LOCAL_SYNTHETIC_SQLITE_ONLY',generated_at:new Date().toISOString(),spread:'celtic-10',actual_generated_offers:10000,all_unpaid:true,question_collected:false,initial,samples,ttl_seconds:ttl,elapsed_simulated_days:8,after_expiry_unchanged:true,expired_purchase_refused:expiredPurchaseRefused,live_profile_delete_guard_refused:protectedDeleteRefused,read_only_retention_preview:preview,automatic_cleanup:false,owner_retention_approved:false,cloudflare_storage_measured:false,cloudflare_cpu_measured:false,sqlite_size_limit_comparison:{reference_bytes:500*1024*1024,exceeded_locally:samples.at(-1).sqlite_allocated_bytes>500*1024*1024},runtime_enabled_at_finish:false};fs.writeFileSync('data/astra25-task05-storage.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({task05_storage_complete:true,samples}));
}finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
