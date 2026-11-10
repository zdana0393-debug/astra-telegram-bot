// TASK06: preserves TASK03 states/transport; adds three proof gates and smaller batches.
function budget28(env,stats){
 const consume=n=>{if(stats.statements+stats.http+n>46)throw Error('BROADCAST_BUDGET');stats.statements+=n;stats.d1_calls++;};
 const raw=new WeakMap(),wrap=s=>{const w={bind(...args){return wrap(s.bind(...args));}};raw.set(w,s);for(const m of ['first','all','run'])w[m]=async(...args)=>{consume(1);return s[m](...args);};return w;};
 return{...env,DB:{prepare(sql){return wrap(env.DB.prepare(sql));},async batch(ss){consume(ss.length);return env.DB.batch(ss.map(s=>raw.get(s)||s));}}};
}
async function finish28(env,user,day,token,state,parts,reason,code=null,next=0){
 return env.DB.prepare(`UPDATE astra_broadcast_outbox03 SET state=?,parts_sent=?,last_reason=?,last_code=?,not_before=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND day=? AND token=? AND state='sending'`).bind(state,parts,reason,code,next,user.telegram_id,day,token).run();
}
export async function runBroadcast28(original,{load=(env,sign,day)=>getForecastDaily(env,sign,day,(s,d,l)=>generateForecastForEnv(env,s,d,l)),sendMessage=pre05_broadcastSend03}={}){
 const stats={event:'astra_broadcast28',reason:null,candidates:0,claimed:0,sent:0,retry:0,blocked:0,unknown:0,failed:0,cancelled:0,skipped:0,d1_calls:0,statements:0,http:0};
 const env=budget28(original,stats),run=crypto.randomUUID();let locked=false;
 const canWork=n=>stats.statements+stats.http+n+1<=46; // include release statement
 try{
  if(!env.ASTRA_BOT_TOKEN){stats.reason='token_missing';return stats;}if(!morning03()){stats.reason='outside_window';return stats;}
  if(!broadcastSchemaReady03(await broadcastSchema03(env))){stats.reason='broadcast_schema_unavailable';return stats;}
  const consent=await schemaConsent28(env);if(!consent.ready){stats.reason=consent.reason;return stats;}
  const day=activityDay(),now=epoch03();
  const lock=await env.DB.prepare(`UPDATE astra_broadcast_runtime03 SET lease=?,lease_until=? WHERE singleton=1 AND migration_done=1 AND lease_until<=? AND cooldown_until<=? RETURNING singleton`).bind(run,now+BROADCAST_LEASE03,now,now).first();
  if(!lock){stats.reason='busy_or_cooldown';return stats;}locked=true;
  await env.DB.batch([
   env.DB.prepare(`DELETE FROM astra_broadcast_jobs WHERE rowid IN(SELECT rowid FROM astra_broadcast_jobs WHERE day<date(?,'-14 days') ORDER BY day LIMIT 100)`).bind(day),
   env.DB.prepare(`UPDATE astra_broadcast_outbox03 SET state=CASE WHEN state='sending' THEN 'unknown' ELSE 'expired' END,last_reason=CASE WHEN state='sending' THEN 'interrupted_delivery' ELSE 'day_expired' END,updated_at=CURRENT_TIMESTAMP WHERE rowid IN(SELECT rowid FROM astra_broadcast_outbox03 WHERE(state='sending' AND last_try_at<?) OR(state='retry' AND day<?) LIMIT 100)`).bind(now-BROADCAST_LEASE03,day),
   env.DB.prepare("DELETE FROM astra_processed_updates WHERE rowid IN(SELECT rowid FROM astra_processed_updates WHERE received_at<datetime('now','-14 days') LIMIT 100)"),
   env.DB.prepare("DELETE FROM astra_update_jobs WHERE rowid IN(SELECT rowid FROM astra_update_jobs WHERE received_at<datetime('now','-14 days') AND status='done' LIMIT 100)")
  ]);
  await env.DB.prepare(`UPDATE astra_notification_consent28 SET ${clearPending28} WHERE telegram_id IN(SELECT telegram_id FROM astra_notification_consent28 WHERE pending_expires_at<=unixepoch() LIMIT 100)`).run();
  if(!POLICY_TRUE(env.ASTRA_DAILY_DELIVERY_ENABLED)||consent.quarantined){stats.reason='delivery_disabled';return stats;}
  const batch=await env.DB.prepare(`SELECT u.telegram_id,u.zodiac,p.generation,f.free_text FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c ON c.telegram_id=u.telegram_id AND c.generation=p.generation
   LEFT JOIN astra_broadcast_outbox03 q ON q.telegram_id=u.telegram_id AND q.day=?
   LEFT JOIN astra_broadcast_jobs b ON b.telegram_id=u.telegram_id AND b.day=?
   LEFT JOIN astra_forecast_daily f ON f.sign=u.zodiac AND f.day=? AND f.locale='ru'
   WHERE c.consent_version='daily-forecast-v1' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND u.notifications_enabled=1 AND u.zodiac IN('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces') AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<>?)
   AND((q.telegram_id IS NULL AND b.telegram_id IS NULL) OR(q.state='retry' AND q.attempts<3 AND q.not_before<=? AND q.generation=p.generation AND q.sign=u.zodiac))
   ORDER BY CASE WHEN q.telegram_id IS NULL THEN 0 ELSE 1 END,u.telegram_id LIMIT 4`).bind(day,day,day,day,now).all();
  stats.candidates=batch.results.length;
  for(const user of batch.results){
   if(!canWork(user.free_text?5:8)){stats.reason='budget_yield';break;}
   let text=user.free_text;if(!text){try{text=(await load(env,user.zodiac,day)).free_text;}catch{stats.reason='forecast_unavailable';break;}}
   let chunks;try{chunks=forecastChunks(text);if(chunks.length>2)throw Error('Too many chunks');}catch{chunks=[];}
   if(!canWork(2*chunks.length+3)){stats.reason='budget_yield';break;}if(!morning03()||activityDay()!==day){stats.reason='window_ended';break;}
   const token=crypto.randomUUID(),stamp=epoch03();
   const claim=await env.DB.prepare(`INSERT INTO astra_broadcast_outbox03(telegram_id,day,generation,sign,state,attempts,token,last_try_at)
    SELECT u.telegram_id,?,p.generation,u.zodiac,'sending',1,?,? FROM astra_users u JOIN astra_user_policy p USING(telegram_id) JOIN astra_notification_consent28 c ON c.telegram_id=u.telegram_id AND c.generation=p.generation
    WHERE c.consent_version='daily-forecast-v1' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND u.telegram_id=? AND p.generation=? AND u.zodiac=? AND u.notifications_enabled=1 AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<>?)
    AND EXISTS(SELECT 1 FROM astra_broadcast_runtime03 WHERE singleton=1 AND lease=? AND lease_until>? AND cooldown_until<=?)
    ON CONFLICT(telegram_id,day) DO UPDATE SET state='sending',attempts=astra_broadcast_outbox03.attempts+1,token=excluded.token,last_try_at=excluded.last_try_at,updated_at=CURRENT_TIMESTAMP
    WHERE astra_broadcast_outbox03.state='retry' AND astra_broadcast_outbox03.attempts<3 AND astra_broadcast_outbox03.not_before<=? AND astra_broadcast_outbox03.generation=excluded.generation AND astra_broadcast_outbox03.sign=excluded.sign
    RETURNING attempts,(SELECT revision FROM astra_notification_consent28 WHERE telegram_id=astra_broadcast_outbox03.telegram_id) AS consent_revision,EXISTS(SELECT 1 FROM astra_forecast_unlocks f WHERE f.telegram_id=astra_broadcast_outbox03.telegram_id AND f.day=astra_broadcast_outbox03.day) AS owned`).bind(day,token,stamp,user.telegram_id,user.generation,user.zodiac,day,run,stamp,stamp,stamp).first();
   if(!claim){stats.skipped++;continue;}stats.claimed++;if(!morning03()||activityDay()!==day){await finish28(env,user,day,token,'expired',0,'window_ended_before_send');stats.reason='window_ended';break;}if(!chunks.length){await finish28(env,user,day,token,'failed',0,'cached_content_invalid');stats.failed++;continue;}let parts=0;
   try{
    for(let i=0;i<chunks.length;i++){
     const still=await env.DB.prepare(`SELECT EXISTS(SELECT 1 FROM astra_forecast_unlocks f WHERE f.telegram_id=u.telegram_id AND f.day=?) AS owned
      FROM astra_users u JOIN astra_user_policy p USING(telegram_id)
      JOIN astra_notification_consent28 c ON c.telegram_id=u.telegram_id AND c.generation=p.generation
      JOIN astra_broadcast_outbox03 q ON q.telegram_id=u.telegram_id AND q.day=? AND q.token=? AND q.state='sending'
      JOIN astra_delivery_consent28 d ON d.telegram_id=q.telegram_id AND d.day=q.day AND d.generation=p.generation AND d.revision=c.revision AND d.consent_version=c.consent_version
      JOIN astra_consent_runtime28 m ON m.singleton=1 AND m.version='consent28-v1' AND m.migration_done=1 AND m.delivery_quarantined=0
      JOIN astra_broadcast_runtime03 r ON r.singleton=1
      WHERE u.telegram_id=? AND u.notifications_enabled=1 AND u.zodiac=? AND p.generation=? AND c.revision=?
      AND c.consent_version='daily-forecast-v1' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL
      AND r.lease=? AND r.lease_until>? AND r.cooldown_until<=?`).bind(day,day,token,user.telegram_id,user.zodiac,user.generation,claim.consent_revision,run,epoch03(),epoch03()).first();
     if(!still||!morning03()||activityDay()!==day){await finish28(env,user,day,token,'cancelled',parts,'consent_preflight_denied');stats.cancelled++;break;}
     stats.http++;await sendMessage(env,user.telegram_id,chunks[i],i===chunks.length-1?forecastCta03(day,Boolean(still.owned)):[]);parts++;
    }
    if(parts===chunks.length){await finish28(env,user,day,token,'sent',parts,'accepted_by_telegram');stats.sent++;}
   }catch(error){
    const code=error.telegramCode;
    if(code===429){const wait=Number.isSafeInteger(error.retryAfter)&&error.retryAfter>0?error.retryAfter:60,next=epoch03()+wait,state=parts?'unknown':claim.attempts<3?'retry':'failed';
     await env.DB.prepare('UPDATE astra_broadcast_runtime03 SET cooldown_until=max(cooldown_until,?) WHERE singleton=1').bind(next).run();
     await finish28(env,user,day,token,state,parts,parts?'partial_rate_limit':state==='retry'?'telegram_429':'retry_exhausted',429,next);stats[state==='retry'?'retry':state==='unknown'?'unknown':'failed']++;stats.reason='telegram_cooldown';break;
    }
    const state=code===403?'blocked':parts?'unknown':Number.isInteger(code)&&code>=400&&code<500?'failed':'unknown';
    await finish28(env,user,day,token,state,parts,code?'telegram_'+code:'network_or_unconfirmed',code||null);
    if(code===403)await env.DB.prepare('UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=? AND EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=astra_users.telegram_id AND p.generation=?)').bind(user.telegram_id,user.generation).run();
    stats[state]++;
   }
  }
  stats.reason??=stats.candidates?'batch_complete':'no_due_recipients';return stats;
 }catch{stats.reason='storage_or_budget_failure';return stats;}
 finally{if(locked)try{await env.DB.prepare('UPDATE astra_broadcast_runtime03 SET lease=NULL,lease_until=0 WHERE singleton=1 AND lease=?').bind(run).run();}catch{stats.reason='storage_finalize_unavailable';}console.log(JSON.stringify(stats));}
}
