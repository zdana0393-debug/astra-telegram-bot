// D1 adapter only. No Telegram client, Stars handler, Worker routes, or automatic activation.
import {loadLegacy29,parseReadingKey,allHistory29} from './legacy29.mjs';
import prices29 from '../../data/tarot25-prices29.json' with {type:'json'};
import expected30 from '../../data/tarot25-schema30.json' with {type:'json'};
import {bindQuota30,testMode30,storageError30} from './storage30.mjs';
import {parseSnapshot,renderSnapshot,serializeSnapshot} from './reader-v1.mjs';
export const PRICE_VERSION29='tarot25-prices-proposal-v1';
const FLAG29=env=>env.ASTRA_TAROT25_ENABLED===true||env.ASTRA_TAROT25_ENABLED==='true';
const error=(code)=>Object.assign(new Error(code),{code});
const need=(ok,code)=>{if(!ok)throw error(code);};
const idOK=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
function context(actor){need(actor&&Number.isSafeInteger(actor.telegram_id)&&actor.telegram_id>0&&typeof actor.generation==='string'&&actor.generation.length>0,'INVALID_ACTOR');return actor;}
const EXPECTED29=expected30;
const SCHEMA_QUERY29='SELECT name,type,sql FROM sqlite_master WHERE name IN('+EXPECTED29.map(x=>"'"+x.name+"'").join(',')+')';
export async function schema30(env){
 try{const r=await env.DB.prepare(SCHEMA_QUERY29).all(),actual=new Map(r.results.map(x=>[x.name,x]));
  if(r.results.length!==EXPECTED29.length||!EXPECTED29.every(x=>{const y=actual.get(x.name);return y&&y.type===x.type&&y.sql?.trim()===x.sql.trim();}))return{ready:false};
  const state=await env.DB.prepare(`SELECT r.*,s.version AS storage_version,s.migration_done AS storage_done,s.write_enabled,s.cleanup_enabled,s.daily_limit,s.retention_seconds,s.batch_limit,s.soft_cap_bytes,s.revision AS storage_revision,date(unixepoch(),'unixepoch','+3 hours') AS db_day,(SELECT json_group_array(json_object('price_version',price_version,'spread_id',spread_id,'size',size,'price',price,'theme',theme,'positions_json',positions_json)) FROM astra_tarot25_prices29) AS tariff_json FROM astra_tarot25_runtime29 r JOIN astra_tarot30_policy s ON s.singleton=r.singleton WHERE r.singleton=1`).first();
  const rows=JSON.parse(state?.tariff_json??'[]'),valid=rows.length===prices29.length&&prices29.every(p=>rows.some(t=>Object.keys(p).every(k=>t[k]===p[k])));
  return{...state,ready:valid&&state?.version==='tarot25-policy-v1'&&state.migration_done===1&&state.storage_version==='tarot30-local-proposal-v1'&&state.storage_done===1};
 }catch{return{ready:false};}
}
async function ready(env){const r=await schema30(env);need(r.ready,'SCHEMA_NOT_READY');return r;}
function sales(env,state){need(FLAG29(env)&&state.enabled===1&&state.price_version===PRICE_VERSION29&&testMode30(env)&&state.write_enabled===1,'CATALOG_DISABLED');}
async function profile(env,a){const p=await env.DB.prepare('SELECT p.generation FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=? AND p.generation=?').bind(a.telegram_id,a.generation).first();need(p,'PROFILE_CHANGED');}
const ownSQL=`SELECT p.* FROM astra_tarot25_purchases29 p JOIN astra_users u ON u.telegram_id=p.telegram_id JOIN astra_user_policy g ON g.telegram_id=u.telegram_id AND g.generation=p.generation WHERE p.offer_id=? AND p.telegram_id=? AND p.generation=?`;
async function owned(env,a,id){return env.DB.prepare(ownSQL).bind(id,a.telegram_id,a.generation).first();}
function material(row){if(!row)return null;const snapshot=parseSnapshot(row.snapshot_json);need(row.result===renderSnapshot(snapshot)&&row.deck_version===snapshot.deck_version&&row.engine_version===snapshot.engine_version&&row.spread_version===snapshot.spread_version&&row.snapshot_version===snapshot.snapshot_version&&row.spread_id===snapshot.spread_id&&row.theme===snapshot.theme&&row.size===snapshot.cards.length,'STORED_RESULT_CORRUPT');return{...row,snapshot};}
export async function loadOwned(env,actor,key){const a=context(actor),p=parseReadingKey(key);need(p&&(p.kind!=='new'||idOK(p.id)),'INVALID_OFFER');await ready(env);return p.kind==='new'?material(await owned(env,a,p.id)):loadLegacy29(env,a,key);}
const receiptSQL30=`SELECT o.*,r.request_key AS asked_key,r.update_id AS asked_update,r.spread_id AS asked_spread,r.theme AS asked_theme,r.offer_id AS recorded_offer,EXISTS(SELECT 1 FROM astra_tarot25_purchases29 paid WHERE paid.offer_id=r.offer_id) AS already_paid FROM astra_tarot30_requests r LEFT JOIN astra_tarot25_offers29 o ON o.offer_id=r.offer_id WHERE r.telegram_id=? AND r.generation=? AND(r.request_key=? OR r.update_id=?)`;
const dto30=row=>({offer_id:row.offer_id,spread_id:row.spread_id,theme:row.theme,size:row.size,price:row.price,price_version:row.price_version,created_at:row.created_at,expires_at:row.expires_at,status:row.status,deck_version:row.deck_version,engine_version:row.engine_version,spread_version:row.spread_version,snapshot_version:row.snapshot_version});
export async function prepareOffer(env,actor,options={}){
 const a=context(actor),state=await ready(env);sales(env,state);await profile(env,a);
 need(Object.keys(options).every(k=>['request_key','update_id','spread_id','theme','question','question_consent'].includes(k)),'UNTRUSTED_OFFER_FIELDS');
 const {request_key,update_id,spread_id,question,question_consent=false}=options;
 need(question===undefined&&question_consent===false,'QUESTION_COLLECTION_DISABLED');
 need(typeof request_key==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(request_key)&&Number.isSafeInteger(update_id)&&update_id>=0,'INVALID_REQUEST');
 const old=await env.DB.prepare(receiptSQL30).bind(a.telegram_id,a.generation,request_key,update_id).first();
 const tariff=await env.DB.prepare('SELECT * FROM astra_tarot25_prices29 WHERE price_version=? AND spread_id=?').bind(state.price_version,spread_id).first();need(tariff,'UNKNOWN_SPREAD');const theme=options.theme??tariff.theme;
 function same(row){need(row.asked_key===request_key&&row.asked_update===update_id&&row.asked_spread===spread_id&&row.asked_theme===theme,'REQUEST_MISMATCH');need(row.offer_id,'OFFER_PURGED');material(row);need(row.already_paid||row.policy_revision===state.revision&&row.price_version===state.price_version,'OFFER_POLICY_CHANGED');return dto30(row);}
 if(old)return same(old);
 // Reuse a valid unpaid sealed offer of this format. Every alias is remembered after purge.
 async function reuse(){return env.DB.prepare(`SELECT o.* FROM astra_tarot25_offers29 o WHERE o.telegram_id=? AND o.generation=? AND o.spread_id=? AND o.theme=? AND o.status='open' AND o.expires_at>unixepoch() AND o.policy_revision=? AND o.price_version=? AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 p WHERE p.offer_id=o.offer_id) ORDER BY o.created_at,o.offer_id LIMIT 1`).bind(a.telegram_id,a.generation,spread_id,theme,state.revision,state.price_version).first();}
 async function remember(row){await env.DB.prepare(`INSERT INTO astra_tarot30_requests SELECT ?,?,?,?,?,?,?,unixepoch(),0 WHERE EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=? AND p.generation=?) ON CONFLICT DO NOTHING`).bind(a.telegram_id,a.generation,request_key,update_id,row.offer_id,spread_id,theme,a.telegram_id,a.generation).run();const receipt=await env.DB.prepare(receiptSQL30).bind(a.telegram_id,a.generation,request_key,update_id).first();need(receipt,'OFFER_RESULT_UNCONFIRMED');return same(receipt);}
 const active=await reuse();if(active)return remember(active);
 try{await bindQuota30(env,a,state.db_day,state);}catch(e){throw storageError30(e);}
 const {createReading}=await import('./engine.mjs');const snapshot=createReading({spread_id,theme}),json=serializeSnapshot(snapshot),offer_id=crypto.randomUUID().replaceAll('-','');
 try{await env.DB.prepare(`INSERT INTO astra_tarot25_offers29(offer_id,telegram_id,generation,request_key,update_id,spread_id,theme,size,price,price_version,policy_revision,deck_version,engine_version,spread_version,snapshot_version,snapshot_json,result,expires_at)
 SELECT ?,u.telegram_id,p.generation,?,?,?,?,?,?,?,?,?,?,?,?,?,?,unixepoch()+900 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=? AND p.generation=? ON CONFLICT DO NOTHING`).bind(offer_id,request_key,update_id,spread_id,theme,tariff.size,tariff.price,tariff.price_version,state.revision,snapshot.deck_version,snapshot.engine_version,snapshot.spread_version,snapshot.snapshot_version,json,snapshot.text,a.telegram_id,a.generation).run();}
 catch(e){const winner=await env.DB.prepare(receiptSQL30).bind(a.telegram_id,a.generation,request_key,update_id).first();if(winner)return same(winner);const reused=await reuse();if(reused&&String(e.message).includes('DRAFT_REUSE_WINNER'))return remember(reused);throw storageError30(e);}
 const row=await env.DB.prepare(receiptSQL30).bind(a.telegram_id,a.generation,request_key,update_id).first();need(row,'OFFER_RESULT_UNCONFIRMED');return same(row);
}
export async function confirmPurchase(env,actor,offer_id){
 const a=context(actor);need(idOK(offer_id),'INVALID_OFFER');const state=await ready(env);const paid=await owned(env,a,offer_id);if(paid)return material(paid);sales(env,state);await profile(env,a);
 const row=await env.DB.prepare('SELECT * FROM astra_tarot25_offers29 WHERE offer_id=? AND telegram_id=? AND generation=?').bind(offer_id,a.telegram_id,a.generation).first();need(row,'NOT_OWNED');material(row);need(row.policy_revision===state.revision&&row.price_version===state.price_version,'OFFER_POLICY_CHANGED');
 // One INSERT copies the already sealed snapshot; its trigger commits debit + ledger atomically.
 await env.DB.prepare(`INSERT INTO astra_tarot25_purchases29(offer_id,telegram_id,generation,price,price_version,spread_id,theme,size,snapshot_json,result,deck_version,engine_version,spread_version,snapshot_version)
 SELECT o.offer_id,o.telegram_id,o.generation,o.price,o.price_version,o.spread_id,o.theme,o.size,o.snapshot_json,o.result,o.deck_version,o.engine_version,o.spread_version,o.snapshot_version
 FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy p ON p.telegram_id=u.telegram_id
 WHERE o.offer_id=? AND o.telegram_id=? AND o.generation=? AND p.generation=o.generation ON CONFLICT(offer_id) DO NOTHING`).bind(offer_id,a.telegram_id,a.generation).run();
 const result=await owned(env,a,offer_id);need(result,'PURCHASE_RESULT_UNCONFIRMED');return material(result);
}
export async function cancelOffer(env,actor,offer_id){const a=context(actor);need(idOK(offer_id),'INVALID_OFFER');await ready(env);return env.DB.prepare(`UPDATE astra_tarot25_offers29 SET status='cancelled' WHERE offer_id=? AND telegram_id=? AND generation=? AND status='open' AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=?) AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=astra_tarot25_offers29.telegram_id AND p.generation=astra_tarot25_offers29.generation)`).bind(offer_id,a.telegram_id,a.generation,offer_id).run();}
export async function history(env,actor,{cursor=null,limit=10}={}){
 const a=context(actor);await ready(env);await profile(env,a);need(Number.isInteger(limit)&&limit>=1&&limit<=20,'INVALID_PAGE');
 const select=allHistory29+` SELECT p.* FROM all_paid p JOIN astra_users u ON u.telegram_id=p.telegram_id JOIN astra_user_policy g ON g.telegram_id=p.telegram_id AND g.generation=p.generation WHERE p.telegram_id=? AND p.generation=?`;
 if(cursor!==null){need(cursor&&Number.isSafeInteger(cursor.created_at)&&parseReadingKey(cursor.history_key),'INVALID_CURSOR');const anchor=await env.DB.prepare(select+' AND p.history_key=? AND p.created_at=?').bind(a.telegram_id,a.generation,cursor.history_key,cursor.created_at).first();need(anchor,'CURSOR_NOT_OWNED');}
 const rows=await env.DB.prepare(select+(cursor?' AND (p.created_at<? OR (p.created_at=? AND p.history_key<?))':'')+' ORDER BY p.created_at DESC,p.history_key DESC LIMIT ?').bind(a.telegram_id,a.generation,...(cursor?[cursor.created_at,cursor.created_at,cursor.history_key]:[]),limit+1).all();
 const page=rows.results.slice(0,limit),last=page.at(-1);return{rows:page,next:rows.results.length>limit?{created_at:last.created_at,history_key:last.history_key}:null};
}
// Injected transport only. No Bot API implementation is provided by TASK02.
export async function retryDelivery(env,actor,offer_id,{send,explicit=false,ack_unknown=false,timeout_ms=3000}={}){
 const a=context(actor);need(idOK(offer_id)&&typeof send==='function','INVALID_DELIVERY');need(typeof explicit==='boolean'&&typeof ack_unknown==='boolean','INVALID_DELIVERY_MODE');need(Number.isInteger(timeout_ms)&&timeout_ms>=1&&timeout_ms<=5000,'INVALID_TIMEOUT');await ready(env);
 // Never convert a stale sending lease back into automatic retry.
 await env.DB.prepare(`UPDATE astra_tarot25_purchases29 SET delivery='unknown',lease_until=0,updated_at=unixepoch() WHERE offer_id=? AND telegram_id=? AND generation=? AND delivery='sending' AND lease_until<=unixepoch() AND EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy g USING(telegram_id) WHERE u.telegram_id=astra_tarot25_purchases29.telegram_id AND g.generation=astra_tarot25_purchases29.generation)`).bind(offer_id,a.telegram_id,a.generation).run();
 let row=await owned(env,a,offer_id);need(row,'NOT_OWNED');material(row);if(row.delivery==='sent'&&!explicit)return{state:'sent',http:0};
 if(row.delivery==='unknown')need(explicit&&ack_unknown,'UNKNOWN_REQUIRES_EXPLICIT_READ');
 if(['rejected','sent'].includes(row.delivery))need(explicit,'EXPLICIT_READ_REQUIRED');need(row.attempts<3&&row.delivery!=='cancelled','DELIVERY_LIMIT');
 const claimStates=['pending','retry',...(explicit?['sent','rejected']:[]),...(explicit&&ack_unknown?['unknown']:[])].map(s=>"'"+s+"'").join(',');
 const token=crypto.randomUUID(),claim=await env.DB.prepare(`UPDATE astra_tarot25_purchases29 SET delivery='sending',attempts=attempts+1,lease=?,lease_until=unixepoch()+60,updated_at=unixepoch() WHERE offer_id=? AND telegram_id=? AND generation=? AND delivery IN(${claimStates}) AND attempts<3 AND not_before<=unixepoch() AND EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy g USING(telegram_id) WHERE u.telegram_id=astra_tarot25_purchases29.telegram_id AND g.generation=astra_tarot25_purchases29.generation) RETURNING attempts`).bind(token,offer_id,a.telegram_id,a.generation).first();need(claim,'DELIVERY_BUSY_OR_COOLDOWN');
 const {splitTelegram}=await import('./text29.mjs');const chunks=splitTelegram(row.result);let parts=0,http=0,code=null,next=0,state='sent';
 try{for(const text of chunks){const still=await env.DB.prepare(`SELECT 1 FROM astra_tarot25_purchases29 p JOIN astra_users u ON u.telegram_id=p.telegram_id JOIN astra_user_policy g ON g.telegram_id=u.telegram_id AND g.generation=p.generation WHERE p.offer_id=? AND p.telegram_id=? AND p.generation=? AND p.delivery='sending' AND p.lease=? AND p.lease_until>unixepoch()`).bind(offer_id,a.telegram_id,a.generation,token).first();if(!still){state='cancelled';break;}
   const controller=new AbortController();let timer;try{http++;const ack=await Promise.race([Promise.resolve(send({text,part_index:parts,total:chunks.length,signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(error('TRANSPORT_UNKNOWN'));},timeout_ms);})]);need(ack===true||ack?.accepted===true,'TRANSPORT_UNCONFIRMED');parts++;}finally{clearTimeout(timer);}
  }}catch(e){code=Number.isInteger(e.telegramCode)?e.telegramCode:null;if(code===429){next=Number.isSafeInteger(e.retryAfter)&&e.retryAfter>0?e.retryAfter:60;state=parts?'unknown':claim.attempts<3?'retry':'rejected';}else state=parts?'unknown':code>=400&&code<500?'rejected':'unknown';}
 await env.DB.prepare(`UPDATE astra_tarot25_purchases29 SET delivery=?,lease_until=0,parts_sent=?,last_code=?,not_before=CASE WHEN ?=429 THEN unixepoch()+? ELSE 0 END,updated_at=unixepoch() WHERE offer_id=? AND telegram_id=? AND generation=? AND delivery='sending' AND lease=?`).bind(state,parts,code,code,next,offer_id,a.telegram_id,a.generation,token).run();
 return{state,parts,http};
}
