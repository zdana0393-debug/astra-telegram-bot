import {POLICY_TRUE,readPolicy} from '../rewards/policy.mjs';
export const STAR_PACKAGES=Object.freeze({10:{xtr:10,dust:100},25:{xtr:25,dust:270},50:{xtr:50,dust:570}});
export const paymentScope=env=>POLICY_TRUE(env.ASTRA_TELEGRAM_TEST_MODE)?'test':'production';
export async function chargeHash(charge){
  if(typeof charge!=='string'||charge.length<1||charge.length>512)throw Error('Invalid charge ID');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(charge)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function supportValid(value){return typeof value==='string'&&(/^(?:https:\/\/t\.me\/[A-Za-z0-9_]{5,32}|mailto:[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.test(value));}
export async function paymentEnvironment(env,{shop=false,probe=false}={}){
  const p=await readPolicy(env),scope=paymentScope(env);
  if(!p||p.payment_scope!==scope||!p.verified_bot_id||!supportValid(p.support)||!p.terms_version||p.retention_days<180)throw Error('Payment policy/environment not approved');
  if(scope==='test'){
    if(env.ASTRA_PAYMENT_ENVIRONMENT_ACK!=='DEDICATED_TELEGRAM_TEST_ENVIRONMENT_CONFIRMED')throw Error('Dedicated Telegram test environment required');
  }else if(env.ASTRA_STARS_LIVE_APPROVED!=='YES_I_AUTHORIZE_REAL_STARS')throw Error('Real Stars not approved');
  if(env.ASTRA_PAYMENT_POLICY_ACCEPTED!=='APPROVED_SUPPORT_TERMS_RETENTION')throw Error('Support/Terms/retention approval missing');
  if(shop&&(!POLICY_TRUE(env.STARS_SHOP_ENABLED)||!p.stars_enabled))throw Error('Stars shop disabled');
  if(probe){const me=await starsApi(env,'getMe',{},3500);if(me.id!==p.verified_bot_id)throw Error('Wrong bot/environment');}
  return p;
}
export async function starsApi(env,method,args,timeout=4000){
  if(!env.ASTRA_BOT_TOKEN)throw Error('Token missing');
  const endpoint=`https://api.telegram.org/bot${env.ASTRA_BOT_TOKEN}/${paymentScope(env)==='test'?'test/':''}${method}`;
  let response;
  try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(timeout)});}catch{throw Error('Telegram outcome unknown');}
  let body;try{body=await response.json();}catch{throw Error('Telegram outcome unknown');}
  if(!response.ok||body?.ok!==true){const e=Error('Telegram rejected request');e.telegramCode=body?.error_code||response.status;e.retryAfter=body?.parameters?.retry_after;throw e;}
  return body.result;
}
