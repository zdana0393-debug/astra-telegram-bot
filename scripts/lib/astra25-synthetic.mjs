// Synthetic-only origin fixture uses the ACTUAL original 2.0 Worker and schema.
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import original20 from '../../src/01_ASTRA_V2.js';
import candidate25 from '../../release/ASTRA_2_5_TASK03_CANDIDATE.js';
import {ROOT25,SQL25,sha25,canonical25,stop25} from './astra25-upgrade-plan.mjs';
import {localPath25,readState25} from './astra25-upgrade.mjs';
export const SYNTHETIC_HEADER25='TASK04_FAKE_WEBHOOK_HEADER';
export function adapter25(db){
 return {async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s._sync());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},prepare(sql){const st=db.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){await Promise.resolve();return st.get(...args)??null;},async all(){await Promise.resolve();return {results:st.all(...args)};},async run(){await Promise.resolve();return {meta:{changes:Number(st.run(...args).changes)}};},_sync(){return {meta:{changes:Number(st.run(...args).changes)}};}};}};
}
export function fakeBot25(db,{bot=candidate25}={}){
 const DB=adapter25(db),calls=[],env={DB,ASTRA_BOT_TOKEN:'TASK04_SYNTHETIC_ONLY',ASTRA_WEBHOOK_SECRET:SYNTHETIC_HEADER25,ASTRA_ADMIN_KEY:'TASK04_FAKE_ADMIN',CHANNEL_USERNAME:'@synthetic_channel',ASTRA_FORECAST_START_DAY:'2026-01-01'};let seq=bot===original20?1000:1000000,mid=100,fail=null;
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{if(!String(url).startsWith('https://api.telegram.org/botTASK04_SYNTHETIC_ONLY/'))throw Error('NETWORK_FORBIDDEN_IN_TASK04');const method=String(url).split('/').at(-1),body=JSON.parse(options.body);if(!['sendMessage','answerCallbackQuery','editMessageReplyMarkup','getChatMember','getMe'].includes(method))throw Error('API_METHOD_FORBIDDEN_IN_TASK04');calls.push({method,body});if(method==='sendMessage'&&fail){if(fail==='network')throw Error('Synthetic network failure');return Response.json({ok:false,error_code:fail,parameters:{retry_after:1}},{status:fail});}return Response.json({ok:true,result:method==='sendMessage'?{message_id:++mid,chat:{id:body.chat_id,type:'private'}}:method==='getChatMember'?{status:'member'}:method==='getMe'?{id:424242,username:'Synthetic_Task04_Bot'}:true});};
 const hook=update=>bot.fetch(new Request('https://synthetic.invalid/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':SYNTHETIC_HEADER25},body:JSON.stringify(update)}),env);
 const message=(id,text,uid=++seq)=>({update_id:uid,message:{from:{id,is_bot:false},chat:{id,type:'private'},text}});
 const click=(id,data,mid=1,uid=++seq)=>({update_id:uid,callback_query:{id:'task04-'+uid,from:{id,is_bot:false},message:{message_id:mid,chat:{id,type:'private'}},data}});
 return {DB,env,calls,bot,hook,message,click,fail:v=>fail=v,close(){globalThis.fetch=previous;}};
}
export async function createSynthetic20(file){
 localPath25(file,{exists:false});if(fs.existsSync(file))stop25('SYNTHETIC_OUTPUT_EXISTS');const db=new DatabaseSync(file),fixture=fakeBot25(db,{bot:original20});
 try{
  db.exec(fs.readFileSync(ROOT25+'src/02_SCHEMA.sql','utf8'));
  // These first profiles exercise real /start → sign/referral → bonus → settings.
  for(const u of [fixture.message(1,'/start'),fixture.click(1,'sign:aries'),fixture.message(2,'/start ref_1'),fixture.click(2,'sign:taurus'),fixture.message(1,'🎁 Бонус дня'),fixture.message(3,'/start'),fixture.message(4,'/start ref_1'),fixture.message(2,'🔔 Рассылка'),fixture.message(1,'/stop')]){const r=await fixture.hook(u);if(r.status!==200)stop25('SYNTHETIC20_FLOW_FAILED');}
  const signs=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
  for(let id=5;id<=20;id++)db.prepare('INSERT INTO astra_users(telegram_id,zodiac,balance,referrer_id,referral_rewarded,channel_rewarded,notifications_enabled,last_gift_day,last_broadcast_day,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,id===8?null:signs[(id-5)%12],[0,2,5,100][(id-5)%4],id===9?1:null,id===9?1:0,id%3===0?1:0,id%4===0?0:1,id%2===0?'2026-10-31':null,id%3===0?'2026-10-30':null,id%2===0?'2020-02-29 20:59:00':'2026-10-25 21:01:00');
  // An actual v2 paid reading is delivered, but v2 has NO result/ledger table.
  const before=fixture.calls.length;await fixture.hook(fixture.click(7,'tarot:three'));const legacy20Text=fixture.calls.slice(before).find(x=>x.method==='sendMessage')?.body.text;
  await fixture.hook(fixture.click(10,'channel:check'));await fixture.hook(fixture.message(11,'🔔 Рассылка'));
  db.exec("UPDATE astra_users SET created_at='2026-11-09 20:59:00' WHERE telegram_id<=4;UPDATE astra_users SET last_gift_day='2026-11-10' WHERE telegram_id=1;UPDATE astra_processed_updates SET received_at='2026-11-10 06:00:00'");
  db.prepare("INSERT INTO astra_processed_updates(update_id,received_at) VALUES(900000,'2020-01-01 00:00:00')").run();
  const pending_updates=[fixture.message(12,'✨ Баланс',990001),fixture.click(13,'tarot:day',900,990002)];
  const state=readState25(db),users=db.prepare('SELECT * FROM astra_users ORDER BY telegram_id').all();
  return {synthetic:true,origin_version:'ASTRA-2.0.0',schema_path:'src/02_SCHEMA.sql',users:users.length,balance_total:users.reduce((n,u)=>n+u.balance,0),state,per_user:users.map(u=>({fixture_label:'fictional-profile-'+u.telegram_id,sha256:sha25(canonical25(u)),balance:u.balance})),pending_updates,legacy20_delivered_not_stored:{present:Boolean(legacy20Text),text_sha256:sha25(legacy20Text||''),stored_material_count:0},fake_api_calls:fixture.calls.length};
 }finally{fixture.close();db.close();fs.chmodSync(file,0o600);}
}

// Material may be introduced ONLY after the corresponding historical schema exists.
export async function seedHistorical25(file,{through=6}={}){
 const {purchaseForecast}=await import('../../src/forecast/service.mjs');const {chargeHash}=await import('../../src/payments/transport.mjs');
 const db=new DatabaseSync(file),env={DB:adapter25(db)},evidence=[];try{db.exec('PRAGMA foreign_keys=ON');for(let index=1;index<=through;index++){
  db.exec(fs.readFileSync(ROOT25+SQL25[index-1],'utf8'));
  if(index===1){const text='Исторический расклад3 ✨\n🃏 e\u0301 👩‍🔬 <>&_\nИменно сохранённый текст.';db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result,delivery)VALUES('task04-legacy3',12,'tarot',-3,?,'sent')").run(text);evidence.push({introduced_after:'0021',kind:'tarot3',text});}
  if(index===2){db.exec("INSERT INTO astra_shell_rewards(telegram_id,code)VALUES(12,'gpt6')");evidence.push({introduced_after:'0022',kind:'gpt6',amount:5});}
  if(index===3){const row=await purchaseForecast(env,12,'scorpio','2026-11-09');evidence.push({introduced_after:'0023',kind:'forecast4',text:row.result_text});}
  if(index===5){db.exec("INSERT INTO astra_payment_orders(order_id,payload,owner_id,payer_id,request_key,package,xtr,dust,price_version,scope,terms_version,retention_days)VALUES('task04-old-stars','a24:task04-old-stars',12,12,'task04-old-stars',10,10,100,'stars-pack-v1','test','LOCAL_SYNTHETIC',365)");db.prepare("INSERT INTO astra_payment_receipts(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust)VALUES('TASK04_FAKE_OLD_CHARGE',?,'task04-old-stars',12,'XTR',10,100,'paid',100)").run(await chargeHash('TASK04_FAKE_OLD_CHARGE'));evidence.push({introduced_after:'0025',kind:'old_stars_proof',dust:100});}
  if(index===6){const text='Исторический расклад5 ✨\nТекст и порядок Старших арканов остаются прежними. 🜁';db.prepare("INSERT INTO astra_tarot_offers26(offer_id,telegram_id,generation,request_key)VALUES('task04-legacy5',12,?,'task04-legacy5')").run(db.prepare('SELECT generation FROM astra_user_policy WHERE telegram_id=12').get().generation);db.prepare("INSERT INTO astra_tarot_purchases26(offer_id,telegram_id,price,result,delivery)VALUES('task04-legacy5',12,5,?,'sent')").run(text);evidence.push({introduced_after:'0026',kind:'tarot5',text});}
 }
 return evidence;
 }finally{db.close();}
}
