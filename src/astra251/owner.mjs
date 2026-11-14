import {AUTH251,schema251} from './schema.mjs';
const enc=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
const fail=code=>Object.assign(Error(code),{code});
const idOK=n=>Number.isSafeInteger(n)&&n>0&&n<2**52;
const equal=(a,b)=>{a=String(a??'');b=String(b??'');let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0;};
export async function mac251(env,data){if(typeof env.ASTRA_BONUS_FENCE_KEY!=='string'||enc.encode(env.ASTRA_BONUS_FENCE_KEY).length<32)throw fail('OWNER_PROOF_KEY_MISSING');const k=await crypto.subtle.importKey('raw',enc.encode(env.ASTRA_BONUS_FENCE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(JSON.stringify(data))));}
export const ownerPayload251=c=>['astra251-owner-v1',c.bot_id,c.owner_id,c.owner_generation,c.build_sha256,c.parent_sha256,c.challenge_hash,c.claim_update,c.claim_message,c.claimed_at];
function scopeOK(env,c){return Boolean(c&&idOK(c.bot_id)&&c.bot_id===Number(String(env.ASTRA_BOT_TOKEN||'').split(':')[0])&&/^[a-f0-9]{64}$/.test(env.ASTRA_ADMIN_BUILD_SHA256||'')&&c.build_sha256===env.ASTRA_ADMIN_BUILD_SHA256);}
async function config(env){return env.DB.prepare('SELECT c.*,g.generation AS current_generation,unixepoch() AS db_now FROM astra_owner251 c LEFT JOIN astra_user_policy g ON g.telegram_id=c.owner_id WHERE singleton=1').first();}
export async function ownerStatus251(env){
 try{const c=await config(env),configured=env.ASTRA_OWNER_TELEGRAM_ID!==undefined&&env.ASTRA_OWNER_TELEGRAM_ID!=='';
  const attested=Boolean(c?.state==='enrolled'&&idOK(c.owner_id)&&c.owner_generation===c.current_generation&&scopeOK(env,c)&&equal(c.proof_mac,await mac251(env,ownerPayload251(c))));
  const ready=attested&&String(c.owner_id)===String(env.ASTRA_OWNER_TELEGRAM_ID);
  return{ready,attested,configured,state:c?.state??'missing',config:c};
 }catch{return{ready:false,attested:false,configured:Boolean(env.ASTRA_OWNER_TELEGRAM_ID),state:'unavailable'};}
}
function privateMessage(m){return m?.chat?.type==='private'&&idOK(m.from?.id)&&m.chat.id===m.from.id&&m.from.is_bot===false&&!m.sender_chat&&!m.via_bot&&!m.forward_origin&&!m.forward_date&&!m.forward_from&&!m.forward_from_chat&&!m.is_automatic_forward&&Number.isSafeInteger(m.message_id)&&m.message_id>0&&Number.isSafeInteger(m.date)&&m.date>0;}
function proofText(c){const bytes=enc.encode(JSON.stringify(ownerPayload251(c)));const p=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');return p+'.'+c.proof_mac;}
async function proofReply(env,id,c,send){await send(env,id,'Аккаунт подтверждён через личный чат с ботом. Административные начисления пока выключены.\n\nСкопируйте эту строку только в локальную программу подтверждения владельца:\n'+proofText(c)+'\n\nЭто приватное подтверждение: не публикуйте его в GitHub или общем чате.');}
export async function adminMessage251(env,m,uid,{send:transport}){
 const send=async(...args)=>{try{return await transport(...args);}catch{throw fail('ADMIN_REPLY_UNKNOWN');}};
 const text=typeof m?.text==='string'?m.text.trim():'';
 if(!/^\/(?:myid|admin|grant|owner_claim|owner_proof)(?:\s|$)/u.test(text))return false;
 if(env[AUTH251]!==true||!env.ASTRA_WEBHOOK_SECRET||!privateMessage(m)||!Number.isSafeInteger(uid)||uid<0)return true;
 const id=m.from.id;
 if(text==='/myid'){await send(env,id,'Ваш Telegram ID: '+id);return true;}
 try{
  if(!await schema251(env))throw fail('ADMIN_SCHEMA_NOT_READY');
  if(text.startsWith('/owner_claim ')){
   const token=text.slice(13);if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw fail('OWNER_CHALLENGE_INVALID');
   let c=await config(env);if(!scopeOK(env,c))throw fail('OWNER_BUILD_MISMATCH');
   if(c.state==='enrolled'){
    if(c.owner_id!==id||c.owner_generation!==c.current_generation||!equal(c.proof_mac,await mac251(env,ownerPayload251(c))))throw fail('OWNER_ALREADY_ENROLLED');
    await proofReply(env,id,c,send);return true;
   }
   const hash=hex(await crypto.subtle.digest('SHA-256',enc.encode(token)));
   if(c.state!=='pending'||!equal(hash,c.challenge_hash)||c.expires_at<=c.db_now||m.date<c.db_now-300||m.date>c.db_now+30)throw fail('OWNER_CHALLENGE_INVALID');
   const p=await env.DB.prepare('SELECT p.generation FROM astra_users u JOIN astra_user_policy p USING(telegram_id)WHERE u.telegram_id=? AND u.zodiac IS NOT NULL').bind(id).first();if(!p)throw fail('OWNER_PROFILE_REQUIRED');
   const proposed={...c,owner_id:id,owner_generation:p.generation,claim_update:uid,claim_message:m.message_id,claimed_at:c.db_now};proposed.proof_mac=await mac251(env,ownerPayload251(proposed));
   await env.DB.prepare("UPDATE astra_owner251 SET state='enrolled',owner_id=?,owner_generation=?,claim_update=?,claim_message=?,claimed_at=?,proof_mac=? WHERE singleton=1 AND state='pending' AND challenge_hash=? AND expires_at>unixepoch() AND owner_id IS NULL").bind(id,p.generation,uid,m.message_id,c.db_now,proposed.proof_mac,hash).run();
   c=await config(env);if(c.owner_id!==id||c.owner_generation!==p.generation||!equal(c.proof_mac,await mac251(env,ownerPayload251(c))))throw fail('OWNER_CLAIM_UNCONFIRMED');await proofReply(env,id,c,send);return true;
  }
  const owner=await ownerStatus251(env);
  if(text==='/owner_proof'&&owner.attested&&owner.config.owner_id===id){await proofReply(env,id,owner.config,send);return true;}
  if(!owner.ready||owner.config.owner_id!==id)throw fail('ADMIN_NOT_AUTHORIZED');
  if(text==='/admin'){await send(env,id,'Астра · Управление\n\n/grant ID СУММА — начислить 1–1000 ✨ зарегистрированному пользователю или себе.\n/myid — ваш Telegram ID.\n\nНачисления записываются в журнал. Долг по возвратам погашается первым. Настоящие Telegram Stars эта команда не создаёт.');return true;}
  const match=/^\/grant ([1-9][0-9]{0,15}) ([1-9][0-9]{0,3})$/.exec(text);if(!match)throw fail('ADMIN_COMMAND_FORMAT');
  const target=Number(match[1]),amount=Number(match[2]);if(!idOK(target)||!Number.isInteger(amount)||amount>1000)throw fail('ADMIN_COMMAND_FORMAT');
  const old=await env.DB.prepare('SELECT * FROM astra_admin_grants25 WHERE update_id=?').bind(uid).first();
  const targetRow=old?{generation:old.target_generation}:await env.DB.prepare('SELECT g.generation FROM astra_users u JOIN astra_user_policy g USING(telegram_id)WHERE u.telegram_id=? AND u.zodiac IS NOT NULL').bind(target).first();
  if(!targetRow)throw fail('ADMIN_TARGET_NOT_REGISTERED');
  const requestMac=await mac251(env,['astra251-grant-v1',uid,id,owner.config.owner_generation,target,targetRow.generation,amount,m.message_id,m.date,owner.config.build_sha256]);
  if(old){if(!equal(old.request_mac,requestMac))throw fail('ADMIN_REPLAY_CONFLICT');await send(env,id,'Эта операция уже учтена. Повторного начисления нет.');return true;}
  await env.DB.prepare('INSERT INTO astra_admin_grants25(update_id,operator_id,operator_generation,target_id,target_generation,amount,message_id,message_date,request_mac)VALUES(?,?,?,?,?,?,?,?,?)ON CONFLICT(update_id)DO NOTHING').bind(uid,id,owner.config.owner_generation,target,targetRow.generation,amount,m.message_id,m.date,requestMac).run();
  const r=await env.DB.prepare('SELECT request_mac FROM astra_admin_grants25 WHERE update_id=?').bind(uid).first();if(!equal(r?.request_mac,requestMac))throw fail('ADMIN_CREDIT_UNCONFIRMED');
  const wallet=await env.DB.prepare('SELECT balance FROM astra_users WHERE telegram_id=?').bind(target).first();
  if(!Number.isSafeInteger(wallet?.balance)||wallet.balance<0)throw fail('ADMIN_WALLET_UNCONFIRMED');
  const debt=await env.DB.prepare('SELECT coalesce(sum(amount),0) AS amount FROM astra_debt_repayments WHERE ledger_key=?').bind('admin:grant:'+uid).first();
  await send(env,id,'Учтено '+amount+' ✨. В счёт долга: '+(debt?.amount??0)+' ✨.\nДоступный баланс: '+wallet.balance+' ✨.');return true;
 }catch(e){
  if(e?.code==='ADMIN_REPLY_UNKNOWN')throw e;
  // No raw SQL, identities, tokens or proof material in logs or diagnostics.
  const allowed=['ADMIN_SCHEMA_NOT_READY','OWNER_BUILD_MISMATCH','OWNER_ALREADY_ENROLLED','OWNER_CHALLENGE_INVALID','OWNER_PROFILE_REQUIRED','OWNER_CLAIM_UNCONFIRMED','OWNER_PROOF_KEY_MISSING','ADMIN_NOT_AUTHORIZED','ADMIN_COMMAND_FORMAT','ADMIN_TARGET_NOT_REGISTERED','ADMIN_REPLAY_CONFLICT','ADMIN_CREDIT_UNCONFIRMED','ADMIN_WALLET_UNCONFIRMED'];
  const code=allowed.includes(e?.code)?e.code:'ADMIN_OPERATION_UNCONFIRMED';
  await send(env,id,code==='ADMIN_NOT_AUTHORIZED'?'Команда недоступна.':code==='ADMIN_COMMAND_FORMAT'?'Формат: /grant ID СУММА. Допустимо 1–1000 ✨.':'Действие не выполнено или требует проверки. Код: '+code+'. Если начисление уже записано, повторный запрос не начислит его снова.');return true;
 }
}
