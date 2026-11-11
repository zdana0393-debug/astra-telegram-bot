// Day-scoped storage admission, separate domain from bonus HMAC. No new secret.
const enc=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('');
export const testMode30=env=>env.ASTRA_TAROT25_STORAGE_TEST_MODE===true||env.ASTRA_TAROT25_STORAGE_TEST_MODE==='true';
export async function bindQuota30(env,a,day,policy){
 if(!testMode30(env)||!env.ASTRA_WEBHOOK_SECRET)throw Object.assign(Error('DRAFT_STORAGE_DISABLED'),{code:'DRAFT_STORAGE_DISABLED'});
 const existing=await env.DB.prepare("SELECT q.used,b.subject,d.key_fingerprint,(SELECT page_count FROM pragma_page_count)*(SELECT page_size FROM pragma_page_size) allocated FROM astra_tarot30_bindings b JOIN astra_tarot30_quota q ON q.day=b.day AND q.subject=b.subject JOIN astra_tarot30_days d ON d.day=b.day WHERE b.telegram_id=? AND b.generation=? AND b.day=?").bind(a.telegram_id,a.generation,day).first();
 if(existing?.used>=policy.daily_limit)throw Object.assign(Error('DRAFT_DAILY_LIMIT'),{code:'DRAFT_DAILY_LIMIT'});
 const secret=enc.encode(env.ASTRA_WEBHOOK_SECRET),key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const subject=hex(await crypto.subtle.sign('HMAC',key,enc.encode(JSON.stringify(['astra:tarot:unpaid-quota:v1',a.telegram_id,day])))),fingerprint=hex(await crypto.subtle.digest('SHA-256',enc.encode('astra:tarot:quota-key:v1:'+env.ASTRA_WEBHOOK_SECRET)));
 if(existing){if(existing.subject!==subject||existing.key_fingerprint!==fingerprint)throw Object.assign(Error('DRAFT_KEY_CHANGED_TODAY'),{code:'DRAFT_KEY_CHANGED_TODAY'});if(existing.allocated+65536>=policy.soft_cap_bytes)throw Object.assign(Error('DRAFT_STORAGE_SOFT_CAP'),{code:'DRAFT_STORAGE_SOFT_CAP'});return subject;}
 // One SQL transaction, otherwise midnight/partial D1 must fail closed before snapshot insertion.
 await env.DB.batch([
  env.DB.prepare('INSERT INTO astra_tarot30_days(day,key_fingerprint)VALUES(?,?)').bind(day,fingerprint),
  env.DB.prepare('INSERT INTO astra_tarot30_bindings(telegram_id,generation,day,subject)VALUES(?,?,?,?)').bind(a.telegram_id,a.generation,day,subject)
 ]);
 const usage=await env.DB.prepare('SELECT used,(SELECT page_count FROM pragma_page_count)*(SELECT page_size FROM pragma_page_size) allocated FROM astra_tarot30_quota WHERE day=? AND subject=?').bind(day,subject).first();
 if(!usage)throw Object.assign(Error('DRAFT_QUOTA_UNCONFIRMED'),{code:'DRAFT_QUOTA_UNCONFIRMED'});
 if(usage.used>=policy.daily_limit)throw Object.assign(Error('DRAFT_DAILY_LIMIT'),{code:'DRAFT_DAILY_LIMIT'});
 if(usage.allocated+65536>=policy.soft_cap_bytes)throw Object.assign(Error('DRAFT_STORAGE_SOFT_CAP'),{code:'DRAFT_STORAGE_SOFT_CAP'});
 return subject;
}
export function storageError30(e){const m=String(e?.message||'');for(const code of ['DRAFT_STORAGE_SOFT_CAP','DRAFT_DAILY_LIMIT','DRAFT_STORAGE_DISABLED','DRAFT_REQUEST_SEEN','DRAFT_KEY_CHANGED_TODAY','DRAFT_CLOCK_MISMATCH','DRAFT_SUBJECT_MISMATCH'])if(m.includes(code))return Object.assign(Error(code),{code});return e;}
