// D1 adapter only. No Telegram client, Stars handler, Worker routes, or automatic activation.
import {loadLegacy29,parseReadingKey,allHistory29} from './legacy29.mjs';
import prices29 from '../../data/tarot25-prices29.json' with {type:'json'};
import expected30 from '../../data/tarot25-schema31.json' with {type:'json'};
import {testMode30} from './storage30.mjs';
import {readingFromIntent} from './engine-v2.mjs';
import {parseSnapshot,renderSnapshot,serializeSnapshot} from './reader-v2.mjs';
export const PRICE_VERSION29='tarot25-prices-proposal-v1';
const FLAG29=env=>env.ASTRA_TAROT25_ENABLED===true||env.ASTRA_TAROT25_ENABLED==='true';
const error=(code)=>Object.assign(new Error(code),{code});
const need=(ok,code)=>{if(!ok)throw error(code);};
const idOK=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
function context(actor){need(actor&&Number.isSafeInteger(actor.telegram_id)&&actor.telegram_id>0&&typeof actor.generation==='string'&&actor.generation.length>0,'INVALID_ACTOR');return actor;}
const EXPECTED29=expected30;
const SCHEMA_QUERY29='SELECT name,type,sql FROM sqlite_master WHERE name IN('+EXPECTED29.map(x=>"'"+x.name+"'").join(',')+')';
export async function schema31(env){
 try{const r=await env.DB.prepare(SCHEMA_QUERY29).all(),actual=new Map(r.results.map(x=>[x.name,x]));
  if(r.results.length!==EXPECTED29.length||!EXPECTED29.every(x=>{const y=actual.get(x.name);return y&&y.type===x.type&&y.sql?.trim()===x.sql.trim();}))return{ready:false};
  const state=await env.DB.prepare(`SELECT n.enabled AS independent_enabled,n.questions_enabled,n.cleanup_enabled AS independent_cleanup,n.revision AS intent_revision,n.migration_done AS independent_done,n.max_open,n.burst_limit,r.*,s.version AS storage_version,s.migration_done AS storage_done,s.write_enabled,s.cleanup_enabled,s.daily_limit,s.retention_seconds,s.batch_limit,s.soft_cap_bytes,s.revision AS storage_revision,date(unixepoch(),'unixepoch','+3 hours') AS db_day,(SELECT json_group_array(json_object('price_version',price_version,'spread_id',spread_id,'size',size,'price',price,'theme',theme,'positions_json',positions_json)) FROM astra_tarot25_prices29) AS tariff_json FROM astra_tarot25_runtime29 r JOIN astra_tarot30_policy s ON s.singleton=r.singleton JOIN astra_tarot31_policy n ON n.singleton=1 WHERE r.singleton=1`).first();
  const rows=JSON.parse(state?.tariff_json??'[]'),valid=rows.length===prices29.length&&prices29.every(p=>rows.some(t=>Object.keys(p).every(k=>t[k]===p[k])));
  return{...state,ready:valid&&state?.version==='tarot25-policy-v1'&&state.migration_done===1&&state.storage_version==='tarot30-local-proposal-v1'&&state.storage_done===1&&state.independent_done===1};
 }catch{return{ready:false};}
}
async function ready(env){const r=await schema31(env);need(r.ready,'SCHEMA_NOT_READY');return r;}
function sales(env,state){need(FLAG29(env)&&state.enabled===1&&state.price_version===PRICE_VERSION29&&testMode30(env)&&state.write_enabled===1&&state.independent_enabled===1&&(env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE===true||env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE==='true'),'CATALOG_DISABLED');}
async function profile(env,a){const p=await env.DB.prepare('SELECT p.generation FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=? AND p.generation=?').bind(a.telegram_id,a.generation).first();need(p,'PROFILE_CHANGED');}
const ownSQL=`SELECT p.* FROM astra_tarot25_purchases29 p JOIN astra_users u ON u.telegram_id=p.telegram_id JOIN astra_user_policy g ON g.telegram_id=u.telegram_id AND g.generation=p.generation WHERE p.offer_id=? AND p.telegram_id=? AND p.generation=?`;
async function owned(env,a,id){return env.DB.prepare(ownSQL).bind(id,a.telegram_id,a.generation).first();}
function material(row){if(!row)return null;const snapshot=parseSnapshot(row.snapshot_json);need(row.result===renderSnapshot(snapshot)&&row.deck_version===snapshot.deck_version&&row.engine_version===snapshot.engine_version&&row.spread_version===snapshot.spread_version&&row.snapshot_version===snapshot.snapshot_version&&row.spread_id===snapshot.spread_id&&row.theme===snapshot.theme&&row.size===snapshot.cards.length,'STORED_RESULT_CORRUPT');return{...row,snapshot};}
export async function loadOwned(env,actor,key){const a=context(actor),p=parseReadingKey(key);need(p&&(p.kind!=='new'||idOK(p.id)),'INVALID_OFFER');await ready(env);return p.kind==='new'?material(await owned(env,a,p.id)):loadLegacy29(env,a,key);}
const receiptSQL31=`SELECT r.*,i.offer_id AS live_id,i.price,i.price_version,i.created_at,i.expires_at,i.state,i.policy_revision,i.intent_revision FROM astra_tarot31_receipts r LEFT JOIN astra_tarot31_intents i ON i.offer_id=r.offer_id WHERE r.telegram_id=? AND r.generation=? AND(r.request_key=? OR r.update_id=?)`;
const intentSQL=`SELECT i.*,q.text AS question,q.consented_at,q.consent_update,q.consent_message,q.policy_version AS question_policy FROM astra_tarot31_intents i LEFT JOIN astra_tarot31_questions q USING(offer_id) JOIN astra_users u ON u.telegram_id=i.telegram_id JOIN astra_user_policy g ON g.telegram_id=u.telegram_id AND g.generation=i.generation WHERE i.offer_id=? AND i.telegram_id=? AND i.generation=?`;
function dto(row){return {offer_id:row.offer_id,spread_id:row.spread_id,theme:row.theme,price:row.price,price_version:row.price_version,created_at:row.created_at,expires_at:row.expires_at,status:row.state};}
export async function getIntent(env,actor,id){const a=context(actor);need(idOK(id),'INVALID_OFFER');await ready(env);const row=await env.DB.prepare(intentSQL).bind(id,a.telegram_id,a.generation).first();need(row,'NOT_OWNED');return{...dto(row),question:row.question,question_consented:row.consented_at!==null};}
export async function currentIntent(env,actor){const a=context(actor);await ready(env);return env.DB.prepare(`SELECT offer_id,spread_id,theme,price,expires_at,state AS status FROM astra_tarot31_intents WHERE telegram_id=? AND generation=? AND state IN('quoted','sealing','sealed') AND expires_at>unixepoch() ORDER BY created_at DESC,offer_id DESC LIMIT 1`).bind(a.telegram_id,a.generation).first();}
export async function prepareOffer(env,actor,options={}){
 const a=context(actor),state=await ready(env);sales(env,state);await profile(env,a);
 need(Object.keys(options).every(k=>['request_key','update_id','spread_id','theme','intent_id'].includes(k)),'UNTRUSTED_OFFER_FIELDS');
 const {request_key,update_id,spread_id,theme=prices29.find(t=>t.spread_id===options.spread_id)?.theme??'general',intent_id=crypto.randomUUID().replaceAll('-','')}=options;
 need(idOK(intent_id)&&typeof request_key==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(request_key)&&Number.isSafeInteger(update_id)&&update_id>=0,'INVALID_REQUEST');
 const same=row=>{need(row.request_key===request_key&&row.update_id===update_id&&row.spread_id===spread_id&&row.theme===theme,'REQUEST_MISMATCH');need(row.live_id,'OFFER_PURGED');return dto(row);};
 let r=await env.DB.prepare(receiptSQL31).bind(a.telegram_id,a.generation,request_key,update_id).first();if(r)return same(r);
 const t=await env.DB.prepare('SELECT * FROM astra_tarot25_prices29 WHERE spread_id=? AND price_version=?').bind(spread_id,state.price_version).first();need(t&&(t.theme==='general'||t.theme===theme),'UNKNOWN_SPREAD');
 const seed=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 try{await env.DB.prepare(`INSERT INTO astra_tarot31_intents(offer_id,telegram_id,generation,request_key,update_id,spread_id,theme,price,price_version,policy_revision,intent_revision,seed,expires_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,unixepoch()+900)`).bind(intent_id,a.telegram_id,a.generation,request_key,update_id,spread_id,theme,t.price,t.price_version,state.revision,state.intent_revision,seed).run();}
 catch(e){r=await env.DB.prepare(receiptSQL31).bind(a.telegram_id,a.generation,request_key,update_id).first();if(r)return same(r);throw e;}
 r=await env.DB.prepare(receiptSQL31).bind(a.telegram_id,a.generation,request_key,update_id).first();need(r,'OFFER_RESULT_UNCONFIRMED');return same(r);
}
export async function consentQuestion(env,actor,id,{update_id,message_id}={}){
 const a=context(actor),s=await ready(env);sales(env,s);need((env.ASTRA_TAROT25_QUESTIONS_TEST_MODE===true||env.ASTRA_TAROT25_QUESTIONS_TEST_MODE==='true')&&s.questions_enabled===1,'QUESTION_COLLECTION_DISABLED');
 need(idOK(id)&&Number.isSafeInteger(update_id)&&update_id>=0&&Number.isSafeInteger(message_id)&&message_id>0,'INVALID_CONSENT');
 const i=await env.DB.prepare(intentSQL).bind(id,a.telegram_id,a.generation).first();need(i,'NOT_OWNED');
 need(i.state==='quoted','STALE_CONSENT');if(i.consented_at!==null)return {accepted:true,already:true};
 await env.DB.prepare(`INSERT INTO astra_tarot31_questions(offer_id,policy_version,consent_update,consent_message)SELECT ?,'tarot-question-consent-v1',?,? WHERE EXISTS(SELECT 1 FROM astra_tarot31_intents WHERE offer_id=? AND telegram_id=? AND generation=?)ON CONFLICT DO NOTHING`).bind(id,update_id,message_id,id,a.telegram_id,a.generation).run();return{accepted:true};
}
export function sanitizeQuestion(text){
 need(typeof text==='string'&&text.length<=2000&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text),'INVALID_QUESTION');
 const s=text.normalize('NFC').replace(/[\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/g,' ').replace(/\s+/gu,' ').trim();need(s.length>0&&[...s].length<=500&&s.length<=500,'INVALID_QUESTION');
 need(!/@|https?:|\+?\d[\d\s()-]{7,}|(?:телефон|адрес|диагноз|беременност|умр[её]т|заболевани|инвестиционн[а-я]* доходност)/iu.test(s),'QUESTION_SENSITIVE');return s;
}
// Only an explicitly consented pending question consumes a message. Commands always bypass capture.
export async function captureQuestion(env,actor,text,update_id){
 if(typeof text!=='string'||text.trimStart().startsWith('/')||!Number.isSafeInteger(update_id)||update_id<0)return null;
 const a=context(actor),s=await ready(env);if(!FLAG29(env)||!testMode30(env)||s.enabled!==1||s.write_enabled!==1||!(env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE===true||env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE==='true')||s.independent_enabled!==1||s.questions_enabled!==1||!(env.ASTRA_TAROT25_QUESTIONS_TEST_MODE===true||env.ASTRA_TAROT25_QUESTIONS_TEST_MODE==='true'))return null;
 const i=await env.DB.prepare(`SELECT i.offer_id,q.consent_update FROM astra_tarot31_intents i JOIN astra_tarot31_questions q USING(offer_id) JOIN astra_user_policy g USING(telegram_id) WHERE i.telegram_id=? AND i.generation=? AND g.generation=i.generation AND i.state='quoted' AND i.expires_at>unixepoch() AND q.text IS NULL ORDER BY i.created_at DESC LIMIT 1`).bind(a.telegram_id,a.generation).first();if(!i)return null;
 const value=sanitizeQuestion(text);need(update_id>i.consent_update,'STALE_QUESTION_UPDATE');
 await env.DB.prepare(`UPDATE astra_tarot31_questions SET text=?,text_update=? WHERE offer_id=? AND text IS NULL`).bind(value,update_id,i.offer_id).run();return {offer_id:i.offer_id};
}
export async function confirmPurchase(env,actor,offer_id){
 const a=context(actor);need(idOK(offer_id),'INVALID_OFFER');const state=await ready(env);const paid=await owned(env,a,offer_id);if(paid)return material(paid);sales(env,state);await profile(env,a);
 let i=await env.DB.prepare(intentSQL).bind(offer_id,a.telegram_id,a.generation).first();
 // Sealed historical V1 orders may still be paid under their original price/TTL.
 if(i){
  need(i.policy_revision===state.revision&&i.intent_revision===state.intent_revision&&i.price_version===state.price_version,'OFFER_POLICY_CHANGED');
  if(i.state!=='sealed'){
   const lease=crypto.randomUUID();const claim=await env.DB.prepare(`UPDATE astra_tarot31_intents SET state='sealing',lease=?,lease_until=unixepoch()+30 WHERE offer_id=? AND telegram_id=? AND generation=? AND(state='quoted' OR(state='sealing' AND lease_until<=unixepoch()))RETURNING offer_id`).bind(lease,offer_id,a.telegram_id,a.generation).first();
   if(!claim){const winner=await owned(env,a,offer_id);if(winner)return material(winner);throw error('INTENT_BUSY_OR_EXPIRED');}
   i=await env.DB.prepare(intentSQL).bind(offer_id,a.telegram_id,a.generation).first();need(i?.lease===lease,'INTENT_LEASE_LOST');
   const snapshot=await readingFromIntent(i);if(i.question!==null)snapshot.question_proof={policy_version:i.question_policy,consented_at:i.consented_at,consent_update:i.consent_update,consent_message:i.consent_message};const json=serializeSnapshot(snapshot);
   await env.DB.prepare(`INSERT INTO astra_tarot25_offers29(offer_id,telegram_id,generation,request_key,update_id,spread_id,theme,size,price,price_version,policy_revision,deck_version,engine_version,spread_version,snapshot_version,snapshot_json,result,expires_at)SELECT i.offer_id,i.telegram_id,i.generation,i.request_key,i.update_id,i.spread_id,i.theme,t.size,i.price,i.price_version,i.policy_revision,?,?,?,?,?,?,unixepoch()+900 FROM astra_tarot31_intents i JOIN astra_tarot25_prices29 t ON t.spread_id=i.spread_id AND t.price_version=i.price_version WHERE i.offer_id=? AND i.telegram_id=? AND i.generation=? AND i.state='sealing' AND i.lease=? AND i.lease_until>unixepoch() ON CONFLICT DO NOTHING`).bind(snapshot.deck_version,snapshot.engine_version,snapshot.spread_version,snapshot.snapshot_version,json,snapshot.text,offer_id,a.telegram_id,a.generation,lease).run();
  }
 }
 await env.DB.prepare(`INSERT INTO astra_tarot25_purchases29(offer_id,telegram_id,generation,price,price_version,spread_id,theme,size,snapshot_json,result,deck_version,engine_version,spread_version,snapshot_version) SELECT o.offer_id,o.telegram_id,o.generation,o.price,o.price_version,o.spread_id,o.theme,o.size,o.snapshot_json,o.result,o.deck_version,o.engine_version,o.spread_version,o.snapshot_version FROM astra_tarot25_offers29 o JOIN astra_users u ON u.telegram_id=o.telegram_id JOIN astra_user_policy g ON g.telegram_id=u.telegram_id WHERE o.offer_id=? AND o.telegram_id=? AND o.generation=? AND g.generation=o.generation ON CONFLICT(offer_id)DO NOTHING`).bind(offer_id,a.telegram_id,a.generation).run();
 const result=await owned(env,a,offer_id);need(result,'PURCHASE_RESULT_UNCONFIRMED');return material(result);
}
export async function cancelOffer(env,actor,offer_id){const a=context(actor);need(idOK(offer_id),'INVALID_OFFER');await ready(env);const r=await env.DB.batch([env.DB.prepare(`UPDATE astra_tarot31_intents SET state='cancelled',lease=NULL,lease_until=0 WHERE offer_id=? AND telegram_id=? AND generation=? AND state IN('quoted','sealed') AND EXISTS(SELECT 1 FROM astra_user_policy WHERE telegram_id=? AND generation=?)`).bind(offer_id,a.telegram_id,a.generation,a.telegram_id,a.generation),env.DB.prepare(`UPDATE astra_tarot25_offers29 SET status='cancelled' WHERE offer_id=? AND telegram_id=? AND generation=? AND status='open' AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 WHERE offer_id=?) AND EXISTS(SELECT 1 FROM astra_user_policy WHERE telegram_id=? AND generation=?)`).bind(offer_id,a.telegram_id,a.generation,offer_id,a.telegram_id,a.generation),env.DB.prepare(`DELETE FROM astra_tarot31_questions WHERE offer_id=? AND EXISTS(SELECT 1 FROM astra_tarot31_intents WHERE offer_id=? AND telegram_id=? AND generation=? AND state='cancelled')`).bind(offer_id,offer_id,a.telegram_id,a.generation)]);return{meta:{changes:r.reduce((n,x)=>n+(x.meta?.changes??0),0)}};}
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
