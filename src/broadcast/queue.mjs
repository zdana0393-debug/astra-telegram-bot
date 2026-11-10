import {activityDay} from '../economy/activity.mjs';
import {getForecastDaily,forecastChunks} from '../forecast/service.mjs';
import {generateForecastForEnv} from '../forecast/editorial/configured.mjs';
export const BROADCAST_SCHEMA03=['astra_broadcast_runtime03','astra_broadcast_outbox03','idx_broadcast_outbox03_due','idx_broadcast_jobs_day03','astra_broadcast_guard03','astra_broadcast_legacy_guard03','astra_broadcast_marker03','astra_broadcast_update_guard03','astra_broadcast_sync03','astra_broadcast_purge03','astra_broadcast_erase03'];
export const BROADCAST_MAX03=8,BROADCAST_ATTEMPTS03=3,BROADCAST_LEASE03=90;
const epoch03=()=>Math.floor(Date.now()/1000);
export function morning03(now=new Date()){return now.getUTCHours()>=6&&now.getUTCHours()<8;}
export async function broadcastSchema03(env){
 if(!env.DB)return null;try{return await env.DB.prepare(`SELECT count(*) n,(SELECT migration_done FROM astra_broadcast_runtime03 WHERE singleton=1) complete,(SELECT cooldown_until FROM astra_broadcast_runtime03 WHERE singleton=1) cooldown_until FROM sqlite_master WHERE name IN (${BROADCAST_SCHEMA03.map(n=>"'"+n+"'").join(',')})`).first();}catch{return null;}
}
export const broadcastSchemaReady03=row=>row?.n===BROADCAST_SCHEMA03.length&&row.complete===1;
// Reserve two outside D1 operations: the unchanged fence purge and base schema check.
function budget03(env,stats){
 const consume=n=>{if(stats.statements+stats.http+n>48)throw Error('BROADCAST_BUDGET');stats.statements+=n;stats.d1_calls++;};
 const raw=new WeakMap(),wrap=s=>{const w={bind(...args){return wrap(s.bind(...args));}};raw.set(w,s);for(const m of ['first','all','run'])w[m]=async(...args)=>{consume(1);return s[m](...args);};return w;};
 return{...env,DB:{prepare(sql){return wrap(env.DB.prepare(sql));},async batch(ss){consume(ss.length);return env.DB.batch(ss.map(s=>raw.get(s)||s));}}};
}
export async function broadcastSend03(env,id,text,rows){
 const test=env.ASTRA_TELEGRAM_TEST_MODE===true||env.ASTRA_TELEGRAM_TEST_MODE==='true';let response,body;
 try{response=await fetch(`https://api.telegram.org/bot${env.ASTRA_BOT_TOKEN}/${test?'test/':''}sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:id,text,...(rows.length?{reply_markup:{inline_keyboard:rows}}:{})}),signal:AbortSignal.timeout(3500)});body=await response.json();}catch{throw Error('Broadcast outcome unknown');}
 if(response.ok&&body?.ok===true&&body.result!=null)return body.result;
 if(body?.ok===false&&Number.isInteger(body.error_code)){const e=Error('Broadcast rejected');e.telegramCode=body.error_code;e.retryAfter=body.parameters?.retry_after;throw e;}
 throw Error('Broadcast outcome unknown');
}
export function forecastCta03(day,owned){return[[{text:owned?'Открыть купленное':'Подробнее — 4 ✨',callback_data:'shell:forecast:'+(owned?'owned:':'offer:')+day}]];}
async function finish03(env,user,day,token,state,parts,reason,code=null,next=0){
 return env.DB.prepare(`UPDATE astra_broadcast_outbox03 SET state=?,parts_sent=?,last_reason=?,last_code=?,not_before=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND day=? AND token=? AND state='sending'`).bind(state,parts,reason,code,next,user.telegram_id,day,token).run();
}
export async function runBroadcast03(original,{load=(env,sign,day)=>getForecastDaily(env,sign,day,(s,d,l)=>generateForecastForEnv(env,s,d,l)),sendMessage=broadcastSend03}={}){
 const stats={event:'astra_broadcast03',reason:null,candidates:0,claimed:0,sent:0,retry:0,blocked:0,unknown:0,failed:0,cancelled:0,skipped:0,d1_calls:0,statements:0,http:0};
 const env=budget03(original,stats),run=crypto.randomUUID();let locked=false;
 const canWork=n=>stats.statements+stats.http+n+1<=48; // include release statement
 try{
  if(!env.ASTRA_BOT_TOKEN){stats.reason='token_missing';return stats;}if(!morning03()){stats.reason='outside_window';return stats;}
  if(!broadcastSchemaReady03(await broadcastSchema03(env))){stats.reason='broadcast_schema_unavailable';return stats;}
  const day=activityDay(),now=epoch03();
  const lock=await env.DB.prepare(`UPDATE astra_broadcast_runtime03 SET lease=?,lease_until=? WHERE singleton=1 AND migration_done=1 AND lease_until<=? AND cooldown_until<=? RETURNING singleton`).bind(run,now+BROADCAST_LEASE03,now,now).first();
  if(!lock){stats.reason='busy_or_cooldown';return stats;}locked=true;
  await env.DB.batch([
   env.DB.prepare(`DELETE FROM astra_broadcast_jobs WHERE rowid IN(SELECT rowid FROM astra_broadcast_jobs WHERE day<date(?,'-14 days') ORDER BY day LIMIT 100)`).bind(day),
   env.DB.prepare(`UPDATE astra_broadcast_outbox03 SET state=CASE WHEN state='sending' THEN 'unknown' ELSE 'expired' END,last_reason=CASE WHEN state='sending' THEN 'interrupted_delivery' ELSE 'day_expired' END,updated_at=CURRENT_TIMESTAMP WHERE rowid IN(SELECT rowid FROM astra_broadcast_outbox03 WHERE(state='sending' AND last_try_at<?) OR(state='retry' AND day<?) LIMIT 100)`).bind(now-BROADCAST_LEASE03,day),
   env.DB.prepare("DELETE FROM astra_processed_updates WHERE rowid IN(SELECT rowid FROM astra_processed_updates WHERE received_at<datetime('now','-14 days') LIMIT 100)"),
   env.DB.prepare("DELETE FROM astra_update_jobs WHERE rowid IN(SELECT rowid FROM astra_update_jobs WHERE received_at<datetime('now','-14 days') AND status='done' LIMIT 100)")
  ]);
  const batch=await env.DB.prepare(`SELECT u.telegram_id,u.zodiac,p.generation,f.free_text FROM astra_users u JOIN astra_user_policy p USING(telegram_id)
   LEFT JOIN astra_broadcast_outbox03 q ON q.telegram_id=u.telegram_id AND q.day=?
   LEFT JOIN astra_broadcast_jobs b ON b.telegram_id=u.telegram_id AND b.day=?
   LEFT JOIN astra_forecast_daily f ON f.sign=u.zodiac AND f.day=? AND f.locale='ru'
   WHERE u.notifications_enabled=1 AND u.zodiac IN('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces') AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<>?)
   AND((q.telegram_id IS NULL AND b.telegram_id IS NULL) OR(q.state='retry' AND q.attempts<3 AND q.not_before<=? AND q.generation=p.generation AND q.sign=u.zodiac))
   ORDER BY CASE WHEN q.telegram_id IS NULL THEN 0 ELSE 1 END,u.telegram_id LIMIT 8`).bind(day,day,day,day,now).all();
  stats.candidates=batch.results.length;
  for(const user of batch.results){
   if(!canWork(user.free_text?3:4)){stats.reason='budget_yield';break;}
   let text=user.free_text;if(!text){try{text=(await load(env,user.zodiac,day)).free_text;}catch{stats.reason='forecast_unavailable';break;}}
   let chunks;try{chunks=forecastChunks(text);if(chunks.length>2)throw Error('Too many chunks');}catch{chunks=[];}
   if(!canWork(2*chunks.length+2)){stats.reason='budget_yield';break;}if(!morning03()||activityDay()!==day){stats.reason='window_ended';break;}
   const token=crypto.randomUUID(),stamp=epoch03();
   const claim=await env.DB.prepare(`INSERT INTO astra_broadcast_outbox03(telegram_id,day,generation,sign,state,attempts,token,last_try_at)
    SELECT u.telegram_id,?,p.generation,u.zodiac,'sending',1,?,? FROM astra_users u JOIN astra_user_policy p USING(telegram_id)
    WHERE u.telegram_id=? AND p.generation=? AND u.zodiac=? AND u.notifications_enabled=1 AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<>?)
    AND EXISTS(SELECT 1 FROM astra_broadcast_runtime03 WHERE singleton=1 AND lease=? AND lease_until>? AND cooldown_until<=?)
    ON CONFLICT(telegram_id,day) DO UPDATE SET state='sending',attempts=astra_broadcast_outbox03.attempts+1,token=excluded.token,last_try_at=excluded.last_try_at,updated_at=CURRENT_TIMESTAMP
    WHERE astra_broadcast_outbox03.state='retry' AND astra_broadcast_outbox03.attempts<3 AND astra_broadcast_outbox03.not_before<=? AND astra_broadcast_outbox03.generation=excluded.generation AND astra_broadcast_outbox03.sign=excluded.sign
    RETURNING attempts,EXISTS(SELECT 1 FROM astra_forecast_unlocks f WHERE f.telegram_id=astra_broadcast_outbox03.telegram_id AND f.day=astra_broadcast_outbox03.day) AS owned`).bind(day,token,stamp,user.telegram_id,user.generation,user.zodiac,day,run,stamp,stamp,stamp).first();
   if(!claim){stats.skipped++;continue;}stats.claimed++;if(!morning03()||activityDay()!==day){await finish03(env,user,day,token,'expired',0,'window_ended_before_send');stats.reason='window_ended';break;}if(!chunks.length){await finish03(env,user,day,token,'failed',0,'cached_content_invalid');stats.failed++;continue;}let parts=0;
   try{
    for(let i=0;i<chunks.length;i++){
     if(i>0){const still=await env.DB.prepare(`SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_broadcast_runtime03 r ON r.singleton=1 WHERE u.telegram_id=? AND u.notifications_enabled=1 AND u.zodiac=? AND p.generation=? AND r.lease=? AND r.lease_until>? AND r.cooldown_until<=?`).bind(user.telegram_id,user.zodiac,user.generation,run,epoch03(),epoch03()).first();if(!still||!morning03()||activityDay()!==day){await finish03(env,user,day,token,'cancelled',parts,'stopped_between_chunks');stats.cancelled++;break;}}
     stats.http++;await sendMessage(env,user.telegram_id,chunks[i],i===chunks.length-1?forecastCta03(day,Boolean(claim.owned)):[]);parts++;
    }
    if(parts===chunks.length){await finish03(env,user,day,token,'sent',parts,'accepted_by_telegram');stats.sent++;}
   }catch(error){
    const code=error.telegramCode;
    if(code===429){const wait=Number.isSafeInteger(error.retryAfter)&&error.retryAfter>0?error.retryAfter:60,next=epoch03()+wait,state=parts?'unknown':claim.attempts<3?'retry':'failed';
     await env.DB.prepare('UPDATE astra_broadcast_runtime03 SET cooldown_until=max(cooldown_until,?) WHERE singleton=1').bind(next).run();
     await finish03(env,user,day,token,state,parts,parts?'partial_rate_limit':state==='retry'?'telegram_429':'retry_exhausted',429,next);stats[state==='retry'?'retry':state==='unknown'?'unknown':'failed']++;stats.reason='telegram_cooldown';break;
    }
    const state=code===403?'blocked':parts?'unknown':Number.isInteger(code)&&code>=400&&code<500?'failed':'unknown';
    await finish03(env,user,day,token,state,parts,code?'telegram_'+code:'network_or_unconfirmed',code||null);stats[state]++;
   }
  }
  stats.reason??=stats.candidates?'batch_complete':'no_due_recipients';return stats;
 }catch{stats.reason='storage_or_budget_failure';return stats;}
 finally{if(locked)try{await env.DB.prepare('UPDATE astra_broadcast_runtime03 SET lease=NULL,lease_until=0 WHERE singleton=1 AND lease=?').bind(run).run();}catch{stats.reason='storage_finalize_unavailable';}console.log(JSON.stringify(stats));}
}
