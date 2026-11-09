// STOP-SHIP: no approved durable consent registry exists. This has no runtime bypass.
const BROADCAST_BLOCKER05='CONSENT_REGISTRY_NOT_APPROVED';
async function runBroadcast03(env={}){
 const stats={event:'astra_broadcast05',reason:BROADCAST_BLOCKER05,claimed:0,sent:0,http:0,d1_calls:0,statements:0};let locked=false;const token=crypto.randomUUID(),now=epoch03(),day=activityDay();
 try{
  // Preserve bounded non-delivery maintenance; no candidate query, cache generation or send.
  if(!env.DB||!morning03())return stats;
  stats.d1_calls++;stats.statements++;if(!broadcastSchemaReady03(await broadcastSchema03(env))){stats.maintenance='schema_unavailable';return stats;}
  stats.d1_calls++;stats.statements++;locked=Boolean(await env.DB.prepare('UPDATE astra_broadcast_runtime03 SET lease=?,lease_until=? WHERE singleton=1 AND migration_done=1 AND lease_until<=? RETURNING singleton').bind(token,now+90,now).first());
  if(!locked){stats.maintenance='busy';return stats;}
  stats.d1_calls++;stats.statements+=4;await env.DB.batch([
   env.DB.prepare(`DELETE FROM astra_broadcast_jobs WHERE rowid IN(SELECT rowid FROM astra_broadcast_jobs WHERE day<date(?,'-14 days') ORDER BY day LIMIT 100)`).bind(day),
   env.DB.prepare(`UPDATE astra_broadcast_outbox03 SET state=CASE WHEN state='sending' THEN 'unknown' ELSE 'expired' END,last_reason=CASE WHEN state='sending' THEN 'interrupted_delivery' ELSE 'day_expired' END,updated_at=CURRENT_TIMESTAMP WHERE rowid IN(SELECT rowid FROM astra_broadcast_outbox03 WHERE(state='sending' AND last_try_at<?) OR(state='retry' AND day<?) LIMIT 100)`).bind(now-90,day),
   env.DB.prepare("DELETE FROM astra_processed_updates WHERE rowid IN(SELECT rowid FROM astra_processed_updates WHERE received_at<datetime('now','-14 days') LIMIT 100)"),
   env.DB.prepare("DELETE FROM astra_update_jobs WHERE rowid IN(SELECT rowid FROM astra_update_jobs WHERE received_at<datetime('now','-14 days') AND status='done' LIMIT 100)")
  ]);stats.maintenance='bounded_cleanup';return stats;
 }catch{stats.maintenance='storage_unavailable';return stats;}
 finally{if(locked)try{stats.d1_calls++;stats.statements++;await env.DB.prepare('UPDATE astra_broadcast_runtime03 SET lease=NULL,lease_until=0 WHERE singleton=1 AND lease=?').bind(token).run();}catch{stats.maintenance='release_unavailable';}console.log(JSON.stringify(stats));}
}
async function broadcast(env){return runBroadcast03(env);}
async function broadcastSend03(){throw Error(BROADCAST_BLOCKER05);}
async function health(env){
 const response=await pre05_health(env),state=await response.json();let config=true;try{compactStartDay(env);}catch{config=false;}
 state.manual_content_ready=Boolean(state.free_content_ready&&state.secrets_ready&&state.policy_ready&&config);
 state.broadcast_prerequisite_blocker=state.broadcast_blocker;state.broadcast_ready=false;state.broadcast_blocker=BROADCAST_BLOCKER05;
 state.broadcast_consent_implemented=false;state.broadcast_delivery_allowed=false;state.public_ready=false;
 state.release_scope='STAGING_MANUAL_ONLY';state.ready=false;
 return Response.json(state,{status:503,headers:{'Cache-Control':'no-store'}});
}
