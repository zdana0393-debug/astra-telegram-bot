import {schema29,prepareOffer,confirmPurchase,loadOwned,history,retryDelivery,cancelOffer} from './purchases29.mjs';
import {loadLegacy29} from './legacy29.mjs';
import {SPREADS} from './spreads.mjs';
import {splitTelegram} from './text29.mjs';
import {telegram25} from './runtime05.mjs';
const now=()=>Math.floor(Date.now()/1000),truth=v=>v===true||v==='true';
const cardCount=n=>`${n} ${n===1?'карта':n===3?'карты':'карт'}`;
const BACK=[['Назад','m','0'],['Главное меню','h','0']];
const FAIL='Не удалось проверить действие. Откройте раздел Таро заново. Покупку повторять не нужно: сохранённые расклады находятся в истории.';
const UNKNOWN='Telegram мог уже принять сообщение. Повторное чтение может прислать его ещё раз. Пыль повторно не списывается.';
const READ_NOTICE='Нажатие записи отправляет сохранённый текст новым сообщением. Если прежнюю отправку Telegram не подтвердил, возможен дубль. Пыль повторно не списывается.';
const enc=new TextEncoder();
const eq=(a,b)=>{let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0;};
const actorSQL='SELECT u.balance,p.generation,u.telegram_id FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=?';
function err(code){return Object.assign(new Error(code),{code});}
async function actor(env,id){const a=await env.DB.prepare(actorSQL).bind(id).first();if(!a)throw err('PROFILE_CHANGED');return a;}
async function mac(env,a,mid,action,payload,expires,key=''){
 if(!env.ASTRA_WEBHOOK_SECRET)throw err('SIGNING_UNAVAILABLE');
 const secret=await crypto.subtle.importKey('raw',enc.encode(env.ASTRA_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',secret,enc.encode(JSON.stringify(['astra:tarot25:ui:v1',a.telegram_id,a.generation,mid,action,payload,expires,key])))).slice(0,12);
 return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function token(env,a,mid,action,payload,expires,key=''){
 const t=`t25:${action}:${payload}.${expires.toString(36)}.${await mac(env,a,mid,action,payload,expires,key)}`;
 if(enc.encode(t).length>64)throw err('BUTTON_TOO_LONG');return t;
}
async function navigation(env,a,mid,rows,expires=now()+900){
 const keyboard=[];for(const row of rows){const cells=[];for(const [text,action,payload,key='',expiry=expires] of row)cells.push({text,callback_data:await token(env,a,mid,action,payload,Math.min(expires,expiry),key)});keyboard.push(cells);}return {inline_keyboard:keyboard};
}
async function bind(env,a,message,rows,expires){
 if(!message)return false;
 try{await telegram25(env,'editMessageReplyMarkup',{chat_id:a.telegram_id,message_id:message.message_id,reply_markup:await navigation(env,a,message.message_id,rows,expires)});return true;}
 catch{console.error('Tarot navigation unavailable');return false;} // Body ACK remains valid; no new screen cascade.
}
async function screen(env,a,text,rows=[],expires=now()+900,parent='m'){
 let m;try{m=await telegram25(env,'sendMessage',{chat_id:a.telegram_id,text,reply_markup:{inline_keyboard:[]}});}catch(e){e.ui_reply_attempted=true;throw e;}
 await bind(env,a,m,[...rows,[['Назад',parent,'0'],['Главное меню','h','0']]],expires);return m;
}
async function handleRow(env,a,payload){
 const m=/^([n35])([0-9a-z]{1,11})(?:_([0-9a-z]{1,2}))?$/.exec(payload);if(!m)throw err('INVALID_CURSOR');
 const rid=parseInt(m[2],36);if(!Number.isSafeInteger(rid)||rid<=0)throw err('INVALID_CURSOR');
 const [table,id,extra]=m[1]==='n'?['astra_tarot25_purchases29','offer_id',' AND t.generation=g.generation']:m[1]==='5'?['astra_tarot_purchases26','offer_id',' AND EXISTS(SELECT 1 FROM astra_tarot_offers26 f WHERE f.offer_id=t.offer_id AND f.generation=g.generation)']:['astra_operations','operation_id'," AND t.reason='tarot' AND t.delta=-3"];
 const row=await env.DB.prepare(`SELECT t.${id} AS id,${m[1]==='n'?'t.created_at':'unixepoch(t.created_at)'} AS created_at FROM ${table} t JOIN astra_users u USING(telegram_id) JOIN astra_user_policy g USING(telegram_id) WHERE t.rowid=? AND t.telegram_id=? AND g.generation=?${extra}`).bind(rid,a.telegram_id,a.generation).first();
 if(!row)throw err('NOT_OWNED');return {history_key:(m[1]==='n'?'new:':m[1]==='5'?'legacy5:':'legacy3:')+row.id,created_at:row.created_at,offset:m[3]?parseInt(m[3],36):0};
}
async function shortHandle(env,a,key){
 const [kind,...tail]=key.split(':'),id=tail.join(':'),prefix=kind==='new'?'n':kind==='legacy5'?'5':'3',table=prefix==='n'?'astra_tarot25_purchases29':prefix==='5'?'astra_tarot_purchases26':'astra_operations',col=prefix==='3'?'operation_id':'offer_id';
 const row=await env.DB.prepare(`SELECT rowid AS rid FROM ${table} WHERE ${col}=? AND telegram_id=?`).bind(id,a.telegram_id).first();if(!row)throw err('NOT_OWNED');return prefix+row.rid.toString(36);
}
async function paid(env,a,key){
 const s=await schema29(env);if(s.ready)return loadOwned(env,a,key);
 if(!key.startsWith('legacy'))throw err('SCHEMA_NOT_READY');return loadLegacy29(env,a,key);
}
// Reserved negative update ID = -owner. Real Telegram updates are non-negative.
// One technical row per live profile, erased by astra_erase; never an identity tombstone.
async function readState(env,a){return env.DB.prepare("SELECT lease,lease_until FROM astra_update_jobs WHERE update_id=? AND telegram_id=? AND status='done' AND lease LIKE 't25r|%'").bind(-a.telegram_id,a.telegram_id).first();}
async function manualRead(env,a,key,ack,offset=0){
 const material=await paid(env,a,key);if(!material)throw err('NOT_OWNED');
 const chunks=splitTelegram(material.result);if(!Number.isInteger(offset)||offset<0||offset>=chunks.length)throw err('INVALID_CURSOR');
 const state=await readState(env,a),time=Date.now(),phase=state?.lease.split('|')[2];
 if(state?.lease_until>time||material.delivery==='sending'&&material.lease_until>now())throw err('READ_COOLDOWN');
 if(((['unknown','sending','retry'].includes(material.delivery)&&!(offset>0&&phase==='sent'))||['unknown','sending'].includes(phase))&&!ack)return screen(env,a,UNKNOWN,[[['Прочитать ещё раз','a',(await shortHandle(env,a,key))+(offset?'_'+offset.toString(36):''),key]]]);
 const lease=`t25r|${a.generation}|sending|${crypto.randomUUID()}`;
 const claim=await env.DB.prepare(`INSERT INTO astra_update_jobs(update_id,telegram_id,status,lease,lease_until)
 SELECT ?,u.telegram_id,'done',?,? FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.telegram_id=? AND p.generation=?
 ON CONFLICT(update_id) DO UPDATE SET lease=excluded.lease,lease_until=excluded.lease_until,received_at=CURRENT_TIMESTAMP
 WHERE astra_update_jobs.telegram_id=excluded.telegram_id AND astra_update_jobs.status='done' AND astra_update_jobs.lease LIKE 't25r|%' AND astra_update_jobs.lease_until<=? RETURNING update_id`).bind(-a.telegram_id,lease,time+30000,a.telegram_id,a.generation,time).first();
 if(!claim)throw err('READ_COOLDOWN');
 let outcome='sent',last=null;
 try{for(const text of chunks.slice(offset,offset+3)){
   // A literal owned read per part also rejects deletion/replacement of a paid row.
   const record=await existsPaid(env,a,key);if(!record)throw err('NOT_OWNED');
   last=await telegram25(env,'sendMessage',{chat_id:a.telegram_id,text},undefined,true);
  }}catch{outcome='unknown';}
 await env.DB.prepare("UPDATE astra_update_jobs SET lease=?,lease_until=? WHERE update_id=? AND telegram_id=? AND lease=?").bind(`t25r|${a.generation}|${outcome}|${crypto.randomUUID()}`,Date.now()+5000,-a.telegram_id,a.telegram_id,lease).run();
 if(outcome==='unknown')return screen(env,a,UNKNOWN,[[['Проверить историю','i','0']]]);
 const rows=[];if(offset+3<chunks.length)rows.push([['Продолжить чтение · через 5 с','v',(await shortHandle(env,a,key))+'_'+(offset+3).toString(36),key]]);
 rows.push([['История','i','0']],[...BACK.map(b=>[...b])]);await bind(env,a,last,rows);return last;
}
async function existsPaid(env,a,key){
 const kind=key.split(':')[0],id=key.slice(kind.length+1),table=kind==='new'?'astra_tarot25_purchases29':kind==='legacy5'?'astra_tarot_purchases26':'astra_operations',col=kind==='legacy3'?'operation_id':'offer_id';
 return env.DB.prepare(`SELECT 1 FROM ${table} t JOIN astra_users u USING(telegram_id) JOIN astra_user_policy g USING(telegram_id) WHERE t.${col}=? AND t.telegram_id=? AND g.generation=?${kind==='new'?' AND t.generation=g.generation':kind==='legacy3'?" AND t.reason='tarot' AND t.delta=-3":" AND EXISTS(SELECT 1 FROM astra_tarot_offers26 o WHERE o.offer_id=t.offer_id AND o.generation=g.generation)"}`).bind(id,a.telegram_id,a.generation).first();
}
const friendly=e=>({STALE_BUTTON:'Эта кнопка устарела. Откройте Таро заново; оплаченные расклады остаются в истории.',INVALID_BUTTON:'Эта кнопка недоступна. Откройте Таро из главного меню.',NOT_OWNED:'Этот расклад недоступен в текущем профиле. Откройте свою историю.',CATALOG_DISABLED:'Новые расклады пока закрыты. Карта дня и прежние покупки доступны.',PROFILE_CHANGED:'Профиль изменился. Откройте Таро из главного меню.',READ_COOLDOWN:'Между чтениями нужна небольшая пауза: 5 секунд. Если отправка ещё идёт — дождитесь её завершения, до 60 секунд.',SCHEMA_NOT_READY:'Новый раздел временно недоступен. Прежние расклады остаются в истории.',UNKNOWN_REQUIRES_EXPLICIT_READ:UNKNOWN,DELIVERY_BUSY_OR_COOLDOWN:'Отправка уже выполняется или Telegram просит подождать. Откройте историю позже.',DELIVERY_LIMIT:'Покупка сохранена. Её можно бесплатно прочитать через историю.',EXPLICIT_READ_REQUIRED:'Покупка сохранена. Для повторного чтения откройте историю.'}[e.code]||(/fund|balance/i.test(e.message)?'Для этого расклада пока недостаточно пыли. Списание не выполнено.':/expired/i.test(e.message)?'Время подтверждения истекло. Выберите расклад заново.':/cancel/i.test(e.message)?'Этот заказ отменён. Выберите расклад заново.':FAIL));
export function createTarotUi(host){
 async function menu(env,id){const a=await actor(env,id);return screen(env,a,'Таро\n\nКарта дня — короткий ориентир. Расклад — подробное символическое чтение, которое можно сохранить и перечитать.',[[['Карта дня','d','0']],[['Выбрать расклад','c','0']],[['История','i','0']]],now()+900,'h');}
 async function catalog(env,a){const s=await schema29(env),on=s.ready&&s.enabled===1&&truth(env.ASTRA_TAROT25_ENABLED),tariffs=s.ready?JSON.parse(s.tariff_json):[];
  return screen(env,a,'Выбрать расклад\n\n'+(on?'Колода Rider–Waite–Smith · 78 карт. Цена указана до подтверждения.':'Новые расклады пока закрыты; их цены — проектные. Прежний расклад на 22 Старших арканах доступен за 5 ✨.'),SPREADS.map((p,i)=>[[`${p.name} · ${cardCount(p.size)} · ${!on&&i===0?'5':tariffs.find(t=>t.spread_id===p.spread_id)?.price??'—'} ✨${!on&&i!==0?' · закрыт':''}`,'s',String(i)]]));
 }
 async function select(env,a,index,q,updateId){
  const p=SPREADS[Number(index)];if(!p||String(Number(index))!==index)throw err('INVALID_SPREAD');
  const state=await schema29(env),on=state.ready&&state.enabled===1&&truth(env.ASTRA_TAROT25_ENABLED);
  if(!on){if(index==='0')return host.threeCards(env,a.telegram_id,String(q.message.message_id||updateId||''));return screen(env,a,p.name+'\n\n'+p.description+'\n\nПозиции: '+p.positions.map(x=>x.name).join(' · ')+'.\n\nНовые покупки пока закрыты.',[],undefined,'c');}
  const request_key=`t25-ui:${q.message.message_id}:${index}`;
  const previous=await env.DB.prepare('SELECT update_id FROM astra_tarot25_offers29 WHERE telegram_id=? AND generation=? AND request_key=?').bind(a.telegram_id,a.generation,request_key).first();
  let offer;
  try{offer=await prepareOffer(env,a,{request_key,update_id:previous?.update_id??updateId,spread_id:p.spread_id});}
  catch(e){
   // Concurrent taps may both start before the first sealed offer becomes visible.
   // Retry only that strict request/update mismatch, using the winner's durable ID.
   if(e.code!=='REQUEST_MISMATCH'||previous)throw e;
   const winner=await env.DB.prepare('SELECT update_id FROM astra_tarot25_offers29 WHERE telegram_id=? AND generation=? AND request_key=?').bind(a.telegram_id,a.generation,request_key).first();
   if(!winner)throw e;offer=await prepareOffer(env,a,{request_key,update_id:winner.update_id,spread_id:p.spread_id});
  }
  const existing=await loadOwned(env,a,offer.offer_id);
  if(existing){const key='new:'+offer.offer_id;return screen(env,a,'Этот расклад уже оплачен. Его можно открыть без нового списания.\n\n'+READ_NOTICE,[[['Прочитать сохранённое','r',await shortHandle(env,a,key),key]]]);}
  if(offer.status!=='open'||offer.expires_at<=now())throw err(offer.status==='cancelled'?'CANCELLED_OFFER':'EXPIRED_OFFER');
  const balance=await actor(env,a.telegram_id);const short=Math.max(0,offer.price-balance.balance);
  const rows=offer.status==='open'&&offer.expires_at>now()?[[['Подтвердить — '+offer.price+' ✨','p',offer.offer_id,'',offer.expires_at]],[['Отмена','x',offer.offer_id,'',offer.expires_at]]]:[[['История','i','0']]];
  return screen(env,a,`${p.name} · ${cardCount(p.size)}\n\n${p.description}\nПозиции: ${p.positions.map(x=>x.name).join(' · ')}.\n\nЦена: ${offer.price} ✨\nБаланс: ${balance.balance} ✨${short?'\nНе хватает: '+short+' ✨':''}\n\nПыль списывается только после подтверждения. Личный вопрос здесь не собирается.`,rows,Math.min(now()+900,offer.expires_at),'c');
 }
 async function list(env,a,cursor=null){
  const s=await schema29(env);let page;
  if(s.ready)page=await history(env,a,{cursor,limit:5});else{
   const old=`WITH legacy AS (SELECT 'legacy3:'||t.operation_id history_key,t.telegram_id,unixepoch(t.created_at) created_at,3 price FROM astra_operations t WHERE t.reason='tarot' AND t.delta=-3 UNION ALL SELECT 'legacy5:'||t.offer_id,t.telegram_id,unixepoch(t.created_at),5 FROM astra_tarot_purchases26 t JOIN astra_tarot_offers26 o USING(offer_id) WHERE o.generation=?) SELECT * FROM legacy WHERE telegram_id=?${cursor?' AND(created_at<? OR(created_at=? AND history_key<?))':''} ORDER BY created_at DESC,history_key DESC LIMIT 6`;
   const r=await env.DB.prepare(old).bind(a.generation,a.telegram_id,...(cursor?[cursor.created_at,cursor.created_at,cursor.history_key]:[])).all();page={rows:r.results.slice(0,5),next:r.results.length>5?r.results[4]:null};
  }
  const rows=[];for(const r of page.rows){const h=await shortHandle(env,a,r.history_key);rows.push([[`Читать · ${new Date(r.created_at*1000).toISOString().slice(0,10)} · ${cardCount(r.size??3)} · оплачено ${r.price} ✨`,'r',h,r.history_key]]);}
  if(page.next)rows.push([['Дальше','i',await shortHandle(env,a,page.next.history_key),page.next.history_key]]);
  if(cursor)rows.push([['К началу истории','i','0']]);
  return screen(env,a,'История Таро\n\n'+(rows.length?'Ранее оплаченные расклады открываются бесплатно. Повторное чтение — не чаще одного раза в 5 секунд.\n\n'+READ_NOTICE:'Сохранённых раскладов пока нет.'),rows);
 }
 async function purchase(env,a,id){
  await confirmPurchase(env,a,id);let last=null;
  {
   const result=await retryDelivery(env,a,id,{send:async({text,signal})=>{last=await telegram25(env,'sendMessage',{chat_id:a.telegram_id,text},signal,true);return {accepted:true};}});
   if(result.state==='sent'&&result.http>0){await bind(env,a,last,[[['История','i','0']],[...BACK.map(b=>[...b])]]);return;}
   return screen(env,a,result.state==='sent'?'Покупка уже сохранена. Откройте её в истории без повторной оплаты.':result.state==='unknown'?UNKNOWN:'Покупка сохранена. Отправка не подтверждена; прочитать её можно через историю.',[[['История','i','0']]]);
  }
 }
 async function callback(env,q,uid){
  try{await telegram25(env,'answerCallbackQuery',{callback_query_id:q.id});}catch{/* Spinner ACK is independent of purchase. */}
  const id=q.from?.id;if(q.from?.is_bot||!Number.isSafeInteger(id)||id<=0||q.message?.chat?.type!=='private'||q.message.chat.id!==id||!Number.isSafeInteger(q.message.message_id)||q.message.message_id<=0)return;
  let a;try{
   a=await actor(env,id);const m=/^t25:([a-z]):([a-z0-9_]+)\.([0-9a-z]+)\.([A-Za-z0-9_-]{16})$/.exec(q.data||'');if(!m||enc.encode(q.data).length>64)throw err('INVALID_BUTTON');
   const [,action,payload,exp,sig]=m,expires=parseInt(exp,36);if(!Number.isSafeInteger(expires)||expires<=now()||expires>now()+901)throw err('STALE_BUTTON');
   const record=['r','a','v'].includes(action)||action==='i'&&payload!=='0'?await handleRow(env,a,payload):null;
   if(!eq(sig,await mac(env,a,q.message.message_id,action,payload,expires,record?.history_key??'')))throw err('INVALID_BUTTON');
   switch(action){
    case 'm':return await menu(env,id);case 'h':return await host.home(env,id);case 'c':return await catalog(env,a);
    case 'd':return await screen(env,a,host.dayCard(id),[[['История','i','0']]]);
    case 's':return await select(env,a,payload,q,uid);
    case 'p':if(!/^[a-f0-9]{32}$/.test(payload))throw err('INVALID_OFFER');return await purchase(env,a,payload);
    case 'x':{const cancelled=await cancelOffer(env,a,payload);return await screen(env,a,cancelled.meta.changes>0?'Заказ отменён. Пыль не списана.':'Заказ уже обработан. Если он был оплачен, расклад доступен в истории без повторного списания.',[[['История','i','0']]]);}
    case 'i':return await list(env,a,record);case 'r':case 'a':case 'v':return await manualRead(env,a,record.history_key,action==='a',record.offset);
    default:throw err('INVALID_BUTTON');
   }
  }catch(e){console.error('Tarot UI action unavailable');if(e.no_ui_retry||e.ui_reply_attempted)throw err('UI_REPLY_UNCONFIRMED');try{if(a)return await screen(env,a,friendly(e),[[['История','i','0']]]);return await telegram25(env,'sendMessage',{chat_id:id,text:'Профиль не найден. Откройте /start, чтобы продолжить.'});}catch{throw err('UI_REPLY_UNCONFIRMED');}}
 }
 return {menu,callback};
}
