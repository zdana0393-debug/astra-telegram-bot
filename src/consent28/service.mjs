import manifest28 from '../../data/consent28-schema.json' with {type:'json'};
export const CONSENT_VERSION28='daily-forecast-v1';
export const CONSENT_TEXT28='Если подтвердите подписку, Астра будет присылать вам в личные сообщения полный бесплатный гороскоп с числом дня один раз в сутки, обычно с 09:00 до 11:00 по московскому времени. Это добровольно. Отключить сообщения можно в «Досье → Уведомления» или командой /stop. Согласие можно отозвать в любое время.';
const normalize28=s=>s.replace(/IF NOT EXISTS /gi,'').replace(/\s+/g,' ').trim().replace(/;$/,'');
export async function schemaConsent28(env){
 try{
  const rows=await env.DB.prepare("SELECT name,type,sql FROM sqlite_master WHERE name IN("+manifest28.map(x=>"'"+x.name+"'").join(',')+")").all();
  const valid=rows.results.length===manifest28.length&&manifest28.every(x=>rows.results.some(y=>x.name===y.name&&x.type===y.type&&normalize28(x.sql)===normalize28(y.sql)));
  if(!valid)return {ready:false,table:rows.results.some(x=>x.name==='astra_notification_consent28'),reason:'consent_gate_not_ready'};
  const m=await env.DB.prepare('SELECT * FROM astra_consent_runtime28 WHERE singleton=1').first();
  const ready=m?.version==='consent28-v1'&&m.migration_done===1;
  return {ready,quarantined:m?.delivery_quarantined!==0,table:true,reason:ready?null:'schema_not_ready'};
 }catch{return{ready:false,reason:'schema_not_ready'};}
}
export const clearPending28='pending_hash=NULL,pending_revision=NULL,pending_version=NULL,pending_created_at=NULL,pending_expires_at=NULL,pending_message_id=NULL';
export async function nonceHash28(nonce){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function revokeConsent28(env,id){
 const schema=await schemaConsent28(env);
 if(!schema.ready){
  // Pre-0028 manual mode. A partial/foreign registry must never produce a false acknowledgement.
  if(schema.table||schema.reason==='schema_not_ready')throw Error('Consent storage unavailable');
  return env.DB.prepare('UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=?').bind(id).run();
 }
 await env.DB.batch([
  env.DB.prepare(`UPDATE astra_notification_consent28 SET revision=revision+1,revoked_at=coalesce(revoked_at,unixepoch()),${clearPending28} WHERE telegram_id=? AND ((consent_at IS NOT NULL AND revoked_at IS NULL) OR pending_hash IS NOT NULL)`).bind(id),
  env.DB.prepare('UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=?').bind(id)
 ]);
}
export async function pendingConsent28(env,id){
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join(''),hash=await nonceHash28(nonce);
 const row=await env.DB.prepare(`INSERT INTO astra_notification_consent28(telegram_id,generation,pending_hash,pending_revision,pending_version,pending_created_at,pending_expires_at)
 SELECT u.telegram_id,p.generation,?,0,'daily-forecast-v1',unixepoch(),unixepoch()+900 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=?
 ON CONFLICT(telegram_id) DO UPDATE SET pending_hash=excluded.pending_hash,pending_revision=astra_notification_consent28.revision,pending_version=excluded.pending_version,pending_created_at=excluded.pending_created_at,pending_expires_at=excluded.pending_expires_at,pending_message_id=NULL
 WHERE astra_notification_consent28.generation=excluded.generation RETURNING generation,revision`).bind(hash,id).first();
 if(!row)throw Error('Profile missing');return{nonce,hash,...row};
}
export async function confirmConsent28(env,id,nonce,messageId,updateId){
 if(!/^[a-f0-9]{32}$/.test(nonce)||!Number.isSafeInteger(messageId)||messageId<=0||!Number.isSafeInteger(updateId))return false;
 const hash=await nonceHash28(nonce);
 return Boolean(await env.DB.prepare(`UPDATE astra_notification_consent28 SET revision=revision+1,consent_version='daily-forecast-v1',consent_at=unixepoch(),source='explicit_private_button',grant_update_id=?,grant_message_id=?,revoked_at=NULL,${clearPending28}
 WHERE telegram_id=? AND pending_hash=? AND pending_message_id=? AND pending_revision=revision AND pending_version='daily-forecast-v1' AND pending_expires_at>unixepoch()
 AND EXISTS(SELECT 1 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=astra_notification_consent28.telegram_id AND p.generation=astra_notification_consent28.generation)
 RETURNING revision`).bind(updateId,messageId,id,hash,messageId).first());
}
