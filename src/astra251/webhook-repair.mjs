// Owner-only operational repair. No public HTTP route, invoices or SQL writes.
import {AUTH251,schema251} from './schema.mjs';
import {ownerStatus251} from './owner.mjs';
const URL251='https://opel-astra-bot.zdana0393.workers.dev/telegram-webhook';
const fail=code=>Object.assign(Error(code),{code});
const yes=x=>x===true||x==='true';
function personal(m){return m?.chat?.type==='private'&&Number.isSafeInteger(m.from?.id)&&m.from.id>0&&m.chat.id===m.from.id&&m.from.is_bot===false&&!m.sender_chat&&!m.via_bot&&!m.forward_origin&&!m.forward_date&&!m.forward_from&&!m.forward_from_chat&&!m.is_automatic_forward&&Number.isSafeInteger(m.message_id)&&m.message_id>0&&Number.isSafeInteger(m.date);}
async function api(env,method,body={}){
 try{
  const r=await fetch('https://api.telegram.org/bot'+env.ASTRA_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(2500)});
  const j=await r.json();if(!r.ok||j?.ok!==true)throw fail('WEBHOOK_API_UNCONFIRMED');return j.result;
 }catch{throw fail('WEBHOOK_API_UNCONFIRMED');}
}
function info(i){
 if(i?.url!==URL251||i.has_custom_certificate!==false||!Number.isInteger(i.max_connections)||i.max_connections<1||i.max_connections>100)throw fail('WEBHOOK_CONFIGURATION_UNEXPECTED');
 if(i.allowed_updates!==undefined&&(!Array.isArray(i.allowed_updates)||i.allowed_updates.some(x=>typeof x!=='string')))throw fail('WEBHOOK_CONFIGURATION_UNEXPECTED');
 const types=i.allowed_updates??[];
 return{types,ready:types.length===0||types.includes('pre_checkout_query')};
}
async function authority(env,id){
 const o=await ownerStatus251(env);if(!o.ready||o.config.owner_id!==id)throw fail('WEBHOOK_OWNER_REQUIRED');return o;
}
export async function webhookMessage251(env,m,uid,{send}){
 const text=typeof m?.text==='string'?m.text.trim():'';
 if(!['/stars_webhook_check','/stars_webhook_enable'].includes(text))return false;
 if(env[AUTH251]!==true||!personal(m)||!Number.isSafeInteger(uid)||uid<0)return true;
 const reply=t=>send(env,m.from.id,t);
 try{
  if(!await schema251(env))throw fail('WEBHOOK_SCHEMA_NOT_READY');
  const o=await authority(env,m.from.id);
  if(m.date<o.config.db_now-300||m.date>o.config.db_now+30||m.date<o.config.claimed_at)throw fail('WEBHOOK_MESSAGE_EXPIRED');
  if(yes(env.ASTRA_TELEGRAM_TEST_MODE)||!/^[-A-Za-z0-9_]{1,256}$/.test(env.ASTRA_WEBHOOK_SECRET??''))throw fail('WEBHOOK_ENVIRONMENT_UNEXPECTED');
  const me=await api(env,'getMe');if(me?.id!==o.config.bot_id||me.is_bot!==true)throw fail('WEBHOOK_BOT_MISMATCH');
  const before=await api(env,'getWebhookInfo'),state=info(before);
  if(state.ready){await reply('Платёжные события Telegram уже разрешены. Адрес webhook проверен. Откройте магазин заново и создайте новый счёт; старый просроченный счёт не используйте.');return true;}
  if(text==='/stars_webhook_check'){await reply('Причина таймаута подтверждена: Telegram не передаёт pre_checkout_query. Для исправления отправьте /stars_webhook_enable. Секрет и адрес webhook сохранятся, ожидающие обновления не удаляются.');return true;}
  if(!state.types.includes('message')||!state.types.includes('callback_query'))throw fail('WEBHOOK_CONFIGURATION_UNEXPECTED');
  const latest=await authority(env,m.from.id);if(latest.config.owner_generation!==o.config.owner_generation)throw fail('WEBHOOK_OWNER_REQUIRED');
  let ack=false;
  try{ack=await api(env,'setWebhook',{url:URL251,secret_token:env.ASTRA_WEBHOOK_SECRET,max_connections:before.max_connections,allowed_updates:[...new Set([...state.types,'pre_checkout_query'])],drop_pending_updates:false})===true;}catch{}
  // A timeout can follow a successful mutation. Read back once; never auto-repeat it.
  const after=await api(env,'getWebhookInfo'),confirmed=info(after);
  if(!confirmed.ready||after.max_connections!==before.max_connections||state.types.some(x=>!confirmed.types.includes(x)))throw fail(ack?'WEBHOOK_READBACK_MISMATCH':'WEBHOOK_CHANGE_UNCONFIRMED');
  await reply('Платёжное событие pre_checkout_query подключено. Telegram подтвердил настройки. Адрес, существующий защитный секрет и число соединений сохранены; очередь не очищалась. Откройте магазин заново и создайте новый счёт.');
 }catch(e){
  const codes=['WEBHOOK_SCHEMA_NOT_READY','WEBHOOK_OWNER_REQUIRED','WEBHOOK_MESSAGE_EXPIRED','WEBHOOK_ENVIRONMENT_UNEXPECTED','WEBHOOK_BOT_MISMATCH','WEBHOOK_CONFIGURATION_UNEXPECTED','WEBHOOK_API_UNCONFIRMED','WEBHOOK_READBACK_MISMATCH','WEBHOOK_CHANGE_UNCONFIRMED'];
  if(!codes.includes(e?.code))throw e; // Let existing delivery recovery handle reply failures.
  await reply('Настройка требует проверки. Код: '+e.code+'. Сначала используйте /stars_webhook_check; автоматического повторного изменения нет.');
 }
 return true;
}
