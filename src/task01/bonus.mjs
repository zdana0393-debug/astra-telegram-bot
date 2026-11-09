import {validDay} from '../forecast/engine.mjs';
import {activityDay,recordActivity} from '../economy/activity.mjs';
const TASK26_CONTEXT=Symbol('astra-task01');
export const BONUS_NOTICE26='bonus-fence-30d-v1';
export const bonusNow26=()=>Math.floor(Date.now()/1000);
export const task01Env=env=>({...env,[TASK26_CONTEXT]:{synced:new Set()}});
const true26=value=>value===true||value==='true';
export async function readPolicy(env){return env.DB.prepare(`SELECT p.singleton,p.version,p.enabled,p.start_day,p.activated,p.migration_done,p.notice_approved,p.active_key_id,p.unsafe_until,
 b.stars_enabled,b.payment_scope,b.support,b.terms_version,b.retention_days,b.verified_bot_id FROM astra_patch26 p JOIN astra_policy b USING(singleton) WHERE p.singleton=1`).first();}
export async function hmac26(key,domain,id){
 if(!['owner','invitee','check','pair'].includes(domain))throw Error('Invalid HMAC domain');
 const imported=typeof key==='string'?await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']):key;
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',imported,new TextEncoder().encode('astra:bonus-fence:v1:'+domain+':'+id)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function secrets26(env){
 const id=env.ASTRA_BONUS_FENCE_KEY_ID||'v1',secret=env.ASTRA_BONUS_FENCE_KEY;
 if(typeof secret!=='string'||new TextEncoder().encode(secret).length<32)throw Error('BONUS_FENCE_KEY_MISSING');
 if(!/^[-a-zA-Z0-9_]{1,32}$/.test(id))throw Error('BONUS_FENCE_KEY_ID_INVALID');
 let previous={};try{previous=env.ASTRA_BONUS_FENCE_PREVIOUS_KEYS?JSON.parse(env.ASTRA_BONUS_FENCE_PREVIOUS_KEYS):{};}catch{throw Error('BONUS_FENCE_KEY_RING_INVALID');}
 if(!previous||Array.isArray(previous)||typeof previous!=='object'||Object.keys(previous).length>3)throw Error('BONUS_FENCE_KEY_RING_INVALID');
 const values={...previous,[id]:secret},ring=[];for(const [keyId,value] of Object.entries(values)){
  if(!/^[-a-zA-Z0-9_]{1,32}$/.test(keyId)||typeof value!=='string'||new TextEncoder().encode(value).length<32||value.length>512)throw Error('BONUS_FENCE_KEY_RING_INVALID');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),{name:'HMAC',hash:'SHA-256'},false,['sign']);ring.push({id:keyId,key,check:await hmac26(key,'check','configuration')});
 }return{id,ring};
}
export async function fenceContext26(env){
 const scoped=env[TASK26_CONTEXT];if(scoped?.promise)return scoped.promise;
 const load=async()=>{const config=await readPolicy(env),now=bonusNow26();let parsed;try{parsed=await secrets26(env);}catch(e){return{ok:false,keys_ready:false,blocker:e.message,config,now};}
 const rows=await env.DB.prepare(`SELECT k.*,EXISTS(SELECT 1 FROM astra_bonus_fences26 f WHERE f.key_id=k.key_id AND f.expires_at>?) AS live,EXISTS(SELECT 1 FROM astra_bonus_fences26 expired WHERE expired.expires_at<=?) AS expired_pending FROM astra_bonus_keys26 k`).bind(now,now).all();
 for(const row of rows.results){const key=parsed.ring.find(k=>k.id===row.key_id);if((row.live||row.key_id===config.active_key_id)&&!key)return{...parsed,config,now,ok:false,keys_ready:false,blocker:'BONUS_FENCE_PREVIOUS_KEYS_REQUIRED'};if(key&&key.check!==row.check_hmac)return{...parsed,config,now,ok:false,keys_ready:false,blocker:'BONUS_FENCE_KEY_CHANGED'};}
 if(parsed.ring.some(k=>k.id!==parsed.id&&!rows.results.some(r=>r.key_id===k.id)))return{...parsed,config,now,ok:false,keys_ready:false,blocker:'BONUS_FENCE_KEY_RING_INVALID'};
 const registered=rows.results.some(r=>r.key_id===parsed.id&&r.check_hmac===parsed.ring.find(k=>k.id===parsed.id).check)&&config.active_key_id===parsed.id;
 const expired=rows.results.some(r=>r.expired_pending);
 const notice=config.notice_approved===1&&env.ASTRA_BONUS_FENCE_NOTICE_ACK==='APPROVED_BONUS_FENCE_30_DAYS';
 return{...parsed,config,now,keys_ready:registered,notice_ready:notice,expired_pending:expired,ok:registered&&notice&&!expired&&config.unsafe_until<=now,blocker:!registered?'BONUS_FENCE_KEY_NOT_CONFIGURED':!notice?'BONUS_FENCE_NOTICE_NOT_APPROVED':expired?'BONUS_FENCE_PURGE_PENDING':config.unsafe_until>now?'BONUS_FENCE_SEED_QUARANTINE':null};};
 const result=load();if(scoped)scoped.promise=result;return result;
}
function invalidate26(env){if(env[TASK26_CONTEXT]){env[TASK26_CONTEXT].promise=null;env[TASK26_CONTEXT].synced.clear();}}
export async function configureFence26(env){
 const parsed=await secrets26(env),now=bonusNow26(),rows=await env.DB.prepare('SELECT k.*,EXISTS(SELECT 1 FROM astra_bonus_fences26 f WHERE f.key_id=k.key_id AND f.expires_at>?) live FROM astra_bonus_keys26 k').bind(now).all();
 for(const r of rows.results){const candidate=parsed.ring.find(k=>k.id===r.key_id);if(r.live&&!candidate)throw Error('Active TTL key must remain in previous-key ring');if(candidate&&candidate.check!==r.check_hmac)throw Error('Existing key ID cannot change secret');}
 const current=parsed.ring.find(k=>k.id===parsed.id);await env.DB.batch([
  env.DB.prepare('INSERT INTO astra_bonus_keys26(key_id,check_hmac,added_at) VALUES(?,?,?) ON CONFLICT(key_id) DO NOTHING').bind(parsed.id,current.check,now),
  env.DB.prepare('UPDATE astra_patch26 SET active_key_id=? WHERE singleton=1').bind(parsed.id)
 ]);invalidate26(env);return{configured:true,key_id:parsed.id,live_previous_keys:rows.results.filter(r=>r.live&&r.key_id!==parsed.id).length};
}
export async function approveFenceNotice26(env,version,ack){
 if(version!==BONUS_NOTICE26||ack!=='APPROVED_BONUS_FENCE_30_DAYS'||env.ASTRA_BONUS_FENCE_NOTICE_ACK!==ack)throw Error('Approve the exact privacy notice and lawful basis first');
 await env.DB.prepare('UPDATE astra_patch26 SET notice_approved=1 WHERE singleton=1').run();invalidate26(env);return{notice_approved:true,version};
}
export async function purgeFences26(env){
 const r=await env.DB.prepare('DELETE FROM astra_bonus_fences26 WHERE rowid IN(SELECT rowid FROM astra_bonus_fences26 WHERE expires_at<=? ORDER BY expires_at LIMIT 200)').bind(bonusNow26()).run();invalidate26(env);return{deleted:r.meta.changes,limit:200};
}
function observable26(row,owner){
 const reason=row.reason;let purpose=null,domain='owner',id=owner,reference='once';
 if(reason==='registration'&&row.delta===2)purpose='initial';
 else if(reason==='easter:gpt6')purpose='gpt6';
 else if(reason==='channel'||reason==='reward:v2:channel')purpose='channel';
 else if(reason==='referral'||reason==='reward:v2:referrer'){if(!row.source_id)return null;purpose='inviter_referral';domain='invitee';id=row.source_id;}
 else if(reason==='reward:v2:invitee'){purpose='invitee_welcome';domain='invitee';}
 else if(['daily','reward:v2:daily','reward:v2:weekly'].includes(reason)){if(!validDay(row.day))return null;purpose=reason.endsWith('weekly')?'weekly':'daily';reference=row.day;}
 else if(reason==='reward:v2:initial')purpose='initial';
 else if(reason==='reward:v2:first3')purpose='first3';else if(reason==='reward:v2:thirty')purpose='thirty';
 return purpose?{purpose,domain,id,reference}:null;
}
export async function syncBonusOwner26(env,owner,context=null){
 if(!Number.isSafeInteger(owner)||owner<=0)throw Error('Invalid bonus owner');const ctx=context||await fenceContext26(env);if(!ctx.ok)return false;
 const scoped=env[TASK26_CONTEXT];if(scoped?.synced.has(owner))return true;
 const profile=await env.DB.prepare('SELECT * FROM astra_bonus_profiles26 WHERE telegram_id=?').bind(owner).first();if(!profile)return false;
 const writes=[];for(const k of ctx.ring){writes.push(env.DB.prepare(`INSERT INTO astra_bonus_aliases26(telegram_id,key_id,owner_hash,invitee_hash) VALUES(?,?,?,?) ON CONFLICT(telegram_id,key_id) DO UPDATE SET owner_hash=excluded.owner_hash,invitee_hash=excluded.invitee_hash`).bind(owner,k.id,await hmac26(k.key,'owner',owner),await hmac26(k.key,'invitee',owner)));}
 let complete=Boolean(profile.seeded);
 if(!complete){
  const rows=await env.DB.prepare(`SELECT l.rowid AS cursor,l.reason,l.delta,unixepoch(l.created_at) AS awarded_at,coalesce(o.day,c.day) AS day,coalesce(o.source_id,r.invitee) AS source_id FROM astra_wallet_ledger l LEFT JOIN astra_operations o ON o.operation_id=l.operation_id LEFT JOIN astra_reward_claims c ON c.claim_id=l.idempotency_key LEFT JOIN astra_referral_contracts r ON r.generation=c.reference WHERE l.telegram_id=? AND l.rowid>? AND l.delta>0 AND l.reason<>'opening' AND l.reason NOT LIKE 'reward:v3:%' AND unixepoch(l.created_at)>? AND unixepoch(l.created_at)<=? ORDER BY l.rowid LIMIT 6`).bind(owner,profile.seed_cursor,ctx.now-2592000,ctx.now).all();
  const batch=rows.results.slice(0,5);for(const row of batch){const right=observable26(row,owner);if(!right)continue;for(const k of ctx.ring)writes.push(env.DB.prepare(`INSERT INTO astra_bonus_fences26(key_id,subject_hash,purpose,reference,awarded_at,expires_at) VALUES(?,?,?,?,?,?) ON CONFLICT(key_id,subject_hash,purpose,reference) DO UPDATE SET awarded_at=excluded.awarded_at,expires_at=excluded.expires_at WHERE excluded.awarded_at>astra_bonus_fences26.awarded_at`).bind(k.id,await hmac26(k.key,right.domain,right.id),right.purpose,right.reference,row.awarded_at,row.awarded_at+2592000));}
  complete=rows.results.length<=5;writes.push(env.DB.prepare('UPDATE astra_bonus_profiles26 SET seed_cursor=?,seeded=? WHERE telegram_id=?').bind(batch.at(-1)?.cursor||profile.seed_cursor,complete?1:0,owner));
 }
 await env.DB.batch(writes);if(complete)scoped?.synced.add(owner);return complete;
}
export async function bonusCommand26(env,owner,kind,{day=activityDay(),channel=null}={}){
 const ctx=await fenceContext26(env);if(!ctx.ok||!await syncBonusOwner26(env,owner,ctx))return false;
 const p=ctx.config;if(kind==='initial'&&p.activated&&!true26(env.ASTRA_ECONOMY_V2_ENABLED))return false;if(['referral','channel'].includes(kind)&&p.activated&&(!p.enabled||!true26(env.ASTRA_ECONOMY_V2_ENABLED)))return false;
 let c=null;if(['referral','channel'].includes(kind)){c=await env.DB.prepare('SELECT inviter FROM astra_bonus_referrals26 WHERE invitee=?').bind(owner).first();if(kind==='referral'&&!c?.inviter)return false;if(c?.inviter&&!await syncBonusOwner26(env,c.inviter,ctx))return false;}
 await env.DB.prepare('INSERT INTO astra_bonus_commands26(command_id,telegram_id,kind,day,awarded_at,verified_channel) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,kind,day,bonusNow26(),channel).run();return true;
}
export async function policyClock(env,day=activityDay()){
 if(!validDay(day))throw Error('Invalid day');let p=await readPolicy(env);
 if(env.ASTRA_ECONOMY_V2_START_DAY&&env.ASTRA_ECONOMY_V2_START_DAY!==p.start_day)throw Error('Policy date mismatch');
 if(!p.activated&&p.start_day&&day>=p.start_day){await env.DB.prepare('UPDATE astra_patch26 SET activated=1 WHERE singleton=1 AND start_day<=?').bind(day).run();invalidate26(env);p=await readPolicy(env);}return p;
}
export async function armPolicy(env,startDay,today=activityDay()){
 if(!validDay(startDay)||startDay<=today)throw Error('Choose a future Moscow date');const ctx=await fenceContext26(env);if(!ctx.ok||!true26(env.ASTRA_ECONOMY_V2_ENABLED))throw Error('Bonus key,notice and runtime approval required');
 if(await env.DB.prepare('SELECT telegram_id FROM astra_bonus_profiles26 WHERE seeded=0 LIMIT 1').first())throw Error('Finish observed-right bootstrap before arming');
 const p=await readPolicy(env);if(p.start_day&&p.start_day!==startDay)throw Error('Policy date fixed');await env.DB.prepare('UPDATE astra_patch26 SET start_day=?,enabled=1 WHERE singleton=1 AND activated=0').bind(startDay).run();invalidate26(env);return readPolicy(env);
}
export async function capturePolicyEvent(env,event,updateId,day,p,returnRow=true){
 if(!event||!Number.isSafeInteger(updateId)||!validDay(day))return null;
 await env.DB.prepare(`INSERT INTO astra_policy_events(update_id,telegram_id,day,source,legacy,processed) SELECT ?,u.telegram_id,?,?,0,0 FROM astra_users u WHERE u.telegram_id=? AND(u.zodiac IS NOT NULL OR ?=1) AND NOT EXISTS(SELECT 1 FROM astra_bonus_days26 d WHERE d.telegram_id=u.telegram_id AND d.day=?) ON CONFLICT(update_id) DO NOTHING`).bind(updateId,day,event.source,event.id,event.signSelection?1:0,day).run();
 if(returnRow)return env.DB.prepare('SELECT * FROM astra_policy_events WHERE update_id=? AND telegram_id=?').bind(updateId,event.id).first();
}
export async function settlePolicyEvents(env,owner){
 const ctx=await fenceContext26(env);if(!ctx.ok||!await syncBonusOwner26(env,owner,ctx))return;
 await bonusCommand26(env,owner,'initial');await bonusCommand26(env,owner,'referral');const p=await readPolicy(env);if(!p.activated||!p.enabled||!true26(env.ASTRA_ECONOMY_V2_ENABLED))return;
 const rows=await env.DB.prepare(`SELECT e.* FROM astra_policy_events e JOIN astra_users u ON u.telegram_id=e.telegram_id WHERE e.telegram_id=? AND e.legacy=0 AND e.processed=0 AND u.zodiac IS NOT NULL AND e.update_id IN(SELECT min(update_id) FROM astra_policy_events WHERE telegram_id=? AND legacy=0 AND processed=0 GROUP BY day) ORDER BY e.day,e.update_id LIMIT 3`).bind(owner,owner).all();
 for(const e of rows.results){await recordActivity(env,owner,e.day,e.source);await env.DB.prepare(`INSERT INTO astra_bonus_days26(telegram_id,day,streak,event_id,awarded_at) SELECT ?,?,coalesce((SELECT streak FROM astra_bonus_days26 WHERE telegram_id=? AND day=date(?,'-1 day')),0)+1,?,? ON CONFLICT(telegram_id,day) DO NOTHING`).bind(owner,e.day,owner,e.day,e.update_id,bonusNow26()).run();if(!await env.DB.prepare('SELECT day FROM astra_bonus_days26 WHERE telegram_id=? AND day=?').bind(owner,e.day).first())throw Error('Bonus day not committed');await env.DB.prepare('UPDATE astra_policy_events SET processed=1 WHERE telegram_id=? AND day=? AND legacy=0').bind(owner,e.day).run();}
 if(await env.DB.prepare('SELECT e.update_id FROM astra_policy_events e JOIN astra_users u ON u.telegram_id=e.telegram_id WHERE e.telegram_id=? AND e.legacy=0 AND e.processed=0 AND u.zodiac IS NOT NULL LIMIT 1').bind(owner).first())throw Error('Bonus backlog; retry committed batch');
}
export async function policySummary(env,owner,today=activityDay()){
 const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);return env.DB.prepare(`SELECT(SELECT count(*) FROM astra_bonus_days26 WHERE telegram_id=?) total,coalesce((SELECT streak FROM astra_bonus_days26 WHERE telegram_id=? AND day IN(?,?) ORDER BY day DESC LIMIT 1),0) streak,coalesce((SELECT debt FROM astra_refund_accounts WHERE payer_id=?),0) debt`).bind(owner,owner,today,yesterday,owner).first();
}
export async function policyBefore(env,update){
 try{await purgeFences26(env);}catch{console.error('Bonus fence cleanup unavailable');}
 const event=economyEvent(update),p=await policyClock(env),ctx=await fenceContext26(env),active=Boolean(p.activated&&p.enabled&&true26(env.ASTRA_ECONOMY_V2_ENABLED)&&ctx.ok);
 if(event&&ctx.ok&&await syncBonusOwner26(env,event.id,ctx)){if(active){const previous=await env.DB.prepare('SELECT update_id FROM astra_policy_events WHERE update_id=? UNION ALL SELECT update_id FROM astra_update_jobs WHERE update_id=? LIMIT 1').bind(update.update_id,update.update_id).first();if(!previous)await capturePolicyEvent(env,event,update.update_id,activityDay(),p,false);}await settlePolicyEvents(env,event.id);}
 return event?{...event,policyActive:active}:null;
}
export async function policyAfter(env,event){if(event?.signSelection&&!env[TASK26_CONTEXT]?.signSettled?.has(event.id))await settlePolicyEvents(env,event.id);}
