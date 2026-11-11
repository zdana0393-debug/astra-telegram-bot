import {schema30} from './purchases30.mjs';import {testMode30} from './storage30.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
export async function preview30(env,{limit=20}={}){
 const s=await schema30(env);need(s.ready,'SCHEMA_NOT_READY');need(Number.isInteger(limit)&&limit>=1&&limit<=20,'INVALID_CLEANUP_LIMIT');
 const row=await env.DB.prepare(`WITH eligible AS(SELECT o.expires_at,o.offer_id,length(CAST(o.snapshot_json AS BLOB))+length(CAST(o.result AS BLOB)) bytes FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id AND p.generation=o.generation WHERE o.expires_at<=unixepoch()-? AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=o.offer_id) AND NOT EXISTS(SELECT 1 FROM astra_wallet_ledger WHERE idempotency_key='tarot25:'||o.offer_id) ORDER BY o.expires_at,o.offer_id),batch AS(SELECT bytes FROM eligible LIMIT ?) SELECT count(*) candidates,coalesce(sum(bytes),0) payload_bytes,(SELECT count(*) FROM batch) batch_candidates,(SELECT coalesce(sum(bytes),0) FROM batch) batch_payload_bytes FROM eligible`).bind(s.retention_seconds,Math.min(limit,s.batch_limit)).first();
 return {read_only:true,limit:Math.min(limit,s.batch_limit),...row,estimated_logical_payload_reclaim_bytes:row.payload_bytes,physical_bytes_reclaimed:null,cloudflare_bytes_measured:false};
}
export async function cleanup30(env,{token,limit=20}={}){
 need(testMode30(env),'RETENTION_TEST_MODE_REQUIRED');need(typeof token==='string'&&/^[a-f0-9]{32}$/.test(token),'INVALID_CLEANUP_TOKEN');need(Number.isInteger(limit)&&limit>=1&&limit<=20,'INVALID_CLEANUP_LIMIT');
 const s=await schema30(env);need(s.ready,'SCHEMA_NOT_READY');
 const prior=await env.DB.prepare('SELECT * FROM astra_tarot30_cleanup_runs WHERE token=?').bind(token).first();
 if(prior){need(prior.batch_limit===limit,'CLEANUP_TOKEN_MISMATCH');return {...prior,replayed:true};}
 need(s.cleanup_enabled===1,'RETENTION_DISABLED');need(limit<=s.batch_limit,'INVALID_CLEANUP_LIMIT');
 // Single INSERT executes a bounded SQL procedure atomically. No JS row loop or Telegram calls.
 await env.DB.prepare('INSERT INTO astra_tarot30_cleanup_runs(token,revision,retention_seconds,batch_limit)VALUES(?,?,?,?)').bind(token,s.storage_revision,s.retention_seconds,limit).run();
 const r=await env.DB.prepare('SELECT * FROM astra_tarot30_cleanup_runs WHERE token=?').bind(token).first();need(r?.finished_at>0,'CLEANUP_RESULT_UNCONFIRMED');return {...r,replayed:false};
}
