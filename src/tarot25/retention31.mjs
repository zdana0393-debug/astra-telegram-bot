import {schema31} from './purchases31.mjs';import {testMode30} from './storage30.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
async function preview30(env,{limit=20}={}){
 const s=await schema31(env);need(s.ready,'SCHEMA_NOT_READY');need(Number.isInteger(limit)&&limit>=1&&limit<=20,'INVALID_CLEANUP_LIMIT');
 const row=await env.DB.prepare(`WITH eligible AS(SELECT o.expires_at,o.offer_id,length(CAST(o.snapshot_json AS BLOB))+length(CAST(o.result AS BLOB)) bytes FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id AND p.generation=o.generation WHERE o.expires_at<=unixepoch()-? AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=o.offer_id) AND NOT EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key='tarot25:'||o.offer_id) ORDER BY o.expires_at,o.offer_id),batch AS(SELECT bytes FROM eligible LIMIT ?) SELECT count(*) candidates,coalesce(sum(bytes),0) payload_bytes,(SELECT count(*) FROM batch) batch_candidates,(SELECT coalesce(sum(bytes),0) FROM batch) batch_payload_bytes FROM eligible`).bind(s.retention_seconds,Math.min(limit,s.batch_limit)).first();
 return {read_only:true,limit:Math.min(limit,s.batch_limit),...row,estimated_logical_payload_reclaim_bytes:row.payload_bytes,physical_bytes_reclaimed:null,cloudflare_bytes_measured:false};
}
async function cleanup30(env,{token,limit=20}={}){
 need(testMode30(env),'RETENTION_TEST_MODE_REQUIRED');need(typeof token==='string'&&/^[a-f0-9]{32}$/.test(token),'INVALID_CLEANUP_TOKEN');need(Number.isInteger(limit)&&limit>=1&&limit<=20,'INVALID_CLEANUP_LIMIT');
 const s=await schema31(env);need(s.ready,'SCHEMA_NOT_READY');
 const prior=await env.DB.prepare('SELECT * FROM astra_tarot30_cleanup_runs WHERE token=?').bind(token).first();
 if(prior){need(prior.batch_limit===limit,'CLEANUP_TOKEN_MISMATCH');return {...prior,replayed:true};}
 need(s.cleanup_enabled===1,'RETENTION_DISABLED');need(limit<=s.batch_limit,'INVALID_CLEANUP_LIMIT');
 // Single INSERT executes a bounded SQL procedure atomically. No JS row loop or Telegram calls.
 await env.DB.prepare('INSERT INTO astra_tarot30_cleanup_runs(token,revision,retention_seconds,batch_limit)VALUES(?,?,?,?)').bind(token,s.storage_revision,s.retention_seconds,limit).run();
 const r=await env.DB.prepare('SELECT * FROM astra_tarot30_cleanup_runs WHERE token=?').bind(token).first();need(r?.finished_at>0,'CLEANUP_RESULT_UNCONFIRMED');return {...r,replayed:false};
}

export async function preview31(env,{limit=20}={}){const old=await preview30(env,{limit}),s=await schema31(env);const extra=await env.DB.prepare(`SELECT count(*) AS compact_eligible FROM astra_tarot31_intents i WHERE i.state<>'paid' AND i.expires_at+?<=unixepoch() AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=i.offer_id)`).bind(s.retention_seconds).first();return{...old,...extra,total_limit:limit,physical_bytes_reclaimed:null};}
export async function cleanup31(env,{token,limit=20}={}){
 need(testMode30(env)&&(env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE===true||env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE==='true'),'RETENTION_TEST_MODE_REQUIRED');
 need(typeof token==='string'&&/^[a-f0-9]{32}$/.test(token)&&Number.isInteger(limit)&&limit>=1&&limit<=20,'INVALID_CLEANUP_REQUEST');
 const s=await schema31(env);need(s.ready,'SCHEMA_NOT_READY');
 const prior=await env.DB.prepare('SELECT * FROM astra_tarot30_cleanup_runs WHERE token=?').bind(token).first();
 if(prior){need(prior.batch_limit===limit,'CLEANUP_TOKEN_MISMATCH');const remaining=limit-prior.deleted_count-prior.quota_deleted;
  if(remaining===0)return{token,deleted:limit,total_limit:limit,replayed:true};
  const done=await env.DB.prepare('SELECT * FROM astra_tarot31_gc WHERE token=?').bind(token).first();
  if(done){need(done.limit_rows===remaining&&done.finished_at>0,'GC_RESULT_UNCONFIRMED');return{token,deleted:prior.deleted_count+prior.quota_deleted+done.deleted,total_limit:limit,replayed:true};}
  need(prior.retention_seconds===s.retention_seconds&&prior.revision===s.storage_revision,'CLEANUP_POLICY_CHANGED_BETWEEN_PHASES');
 }
 // Both cleanup gates are checked BEFORE phase1 may delete anything.
 need(s.cleanup_enabled===1&&s.independent_cleanup===1,'RETENTION_DISABLED');
 const old=await cleanup30(env,{token,limit}),remaining=limit-old.deleted_count-old.quota_deleted;
 if(remaining===0)return{token,deleted:old.deleted_count+old.quota_deleted,total_limit:limit,replayed:old.replayed};
 await env.DB.prepare('INSERT INTO astra_tarot31_gc(token,limit_rows,revision,retention_seconds)VALUES(?,?,?,?)').bind(token,remaining,s.intent_revision,s.retention_seconds).run();
 const r=await env.DB.prepare('SELECT * FROM astra_tarot31_gc WHERE token=?').bind(token).first();need(r&&r.limit_rows===remaining&&r.finished_at>0,'GC_RESULT_UNCONFIRMED');
 return{token,deleted:old.deleted_count+old.quota_deleted+r.deleted,total_limit:limit,replayed:old.replayed};
}
