// Вспомогательный локальный тест — пользователю запускать не нужно.
// Требуется Node.js 22+, здесь тестируем D1 через встроенный sqlite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const forecast=process.env.ASTRA_TEST_RELEASE==='2.3b';
const editorial=forecast||process.env.ASTRA_TEST_RELEASE==='2.3-editorial';
const bot=(await import(forecast?'../release/ASTRA_2_3B_WORKER.js':editorial?'../release/ASTRA_2_3_EDITORIAL_WORKER.js':process.env.ASTRA_TEST_RELEASE==='2.2'?'../release/ASTRA_2_2_WORKER.js':'../release/ASTRA_2_1_WORKER.js')).default;
import preflight from '../src/00_DIAGNOSTIC.js';
const db=new DatabaseSync(':memory:');
const ddl=fs.readFileSync(new URL('../src/02_SCHEMA.sql',import.meta.url),'utf8');
db.exec(ddl);
db.exec(fs.readFileSync(new URL('../migrations/0021_wallet.sql',import.meta.url),'utf8'));
if(['2.2','2.3-editorial','2.3b'].includes(process.env.ASTRA_TEST_RELEASE)) db.exec(fs.readFileSync(new URL('../migrations/0022_shell.sql',import.meta.url),'utf8'));
const DB={prepare(sql){
  const stmt=db.prepare(sql);
  let args=[];
  const handle={
    bind(...params){args=params;return handle;},
    async first(){return stmt.get(...args)??null;},
    async all(){return {results:stmt.all(...args)};},
    async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}};},
  };
  return handle;
}};
const env={
  DB,ASTRA_BOT_TOKEN:'TEST_NON_SECRET_TOKEN',ASTRA_WEBHOOK_SECRET:'secure-test-header',
  ASTRA_ADMIN_KEY:'secure-test-admin-key',CHANNEL_USERNAME:'@examplechannel',
};
if(forecast){db.exec(fs.readFileSync(new URL('../migrations/0023_forecast.sql',import.meta.url),'utf8'));env.ASTRA_FORECAST_START_DAY='2026-01-01';}
let changes=0; const out=[]; let subscriptionStatus='member';
const savedFetch=globalThis.fetch;
globalThis.fetch=async (url,opts)=>{
  const method=url.split('/').at(-1), body=JSON.parse(opts.body);
  out.push({method,body});
  if (method==='getMe') return new Response(JSON.stringify({ok:true,result:{username:'LaDa_Iskra_Opel_Astrabot'}}));
  if (method==='getChatMember') return new Response(JSON.stringify({ok:true,result:{status:subscriptionStatus}}));
  return new Response(JSON.stringify({ok:true,result:true}));
};
const host='https://opel-astra-bot.test';
function msgs(user){return out.filter(x=>x.method==='sendMessage'&&x.body.chat_id===user).map(x=>x.body.text)}
async function hook(update,secret=env.ASTRA_WEBHOOK_SECRET){const res=await bot.fetch(new Request(`${host}/telegram-webhook`,{
  method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify(update),
}),env);return res}
let updateId=400;
async function msg(id,text){return hook({update_id:++updateId,message:{from:{id},chat:{id,type:'private'},text}})}
async function click(id,data){return hook({update_id:++updateId,callback_query:{id:`c${updateId}`,from:{id},message:{chat:{id,type:'private'}},data}})}
async function assertCase(condition,desc){ assert.ok(condition,desc);changes++; }

let r=await preflight.fetch(new Request(`${host}/health`),env);
await assertCase((await r.json()).ready===true,'preflight healthy');
r=await preflight.fetch(new Request(`${host}/health`),{...env,DB:null});
await assertCase((await r.json()).db_binding==='MISSING','preflight missing D1');
r=await bot.fetch(new Request(`${host}/health`),env);
await assertCase((await r.json()).ready===true,'app health healthy');
r=await bot.fetch(new Request(`${host}/health`),{...env,DB:null});
await assertCase((await r.json()).db_binding==='MISSING','app health missing D1');
r=await bot.fetch(new Request(`${host}/activate?key=bad`),env);
await assertCase(r.status===410,'legacy activation removed');
r=await bot.fetch(new Request(`${host}/activate?key=${env.ASTRA_ADMIN_KEY}`),env);
await assertCase(r.status===410,'activation disabled even with admin key');
await assertCase(!out.some(x=>x.method==='setWebhook'),'no webhook mutation');
r=await hook({update_id:333},'wrong-secret');
await assertCase(r.status===403,'wrong Telegram webhook secret rejected');

r=await msg(101,'/start');await assertCase(r.status===200,'/start works');
await assertCase(msgs(101).at(-1).includes(editorial?'Выберите солнечный знак':'Выбери знак'),'first greeting works');
r=await click(101,'sign:aries');await assertCase(r.status===200,'sign selected');
await assertCase(db.prepare('SELECT zodiac,balance FROM astra_users WHERE telegram_id=101').get().zodiac==='aries','zodiac saved');
await assertCase(msgs(101).at(-1).includes(forecast?'Общий солнечный прогноз':editorial?'Прогноз по солнечному знаку':'Гороскоп'.toUpperCase()),'forecast after sign');
await msg(101,'🎁 Бонус дня');await msg(101,'🎁 Бонус дня');
await assertCase(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=101').get().balance===3,'daily bonus only once');
await msg(101,'🃏 Таро');await click(101,'tarot:day'); const before=msgs(101).at(-1);
await click(101,'tarot:day');await assertCase(msgs(101).at(-1)===before,'daily card stable');
await click(101,'tarot:three');await assertCase(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=101').get().balance===0,'3-card cost charged');
await click(101,'tarot:three');await assertCase(msgs(101).at(-1).includes('Недостаточно'),'insufficient balance handled');
await msg(101,'👥 Пригласить друга');await assertCase(msgs(101).at(-1).includes('?start=ref_101'),'referral link correct');
await msg(102,'/start ref_101');await click(102,'sign:virgo');
await assertCase(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=101').get().balance===5,'referral paid exactly once');
await click(102,'sign:libra');await assertCase(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=101').get().balance===5,'repeat sign no bonus');
await msg(102,'🌟 Канал');await click(102,'channel:check');
await assertCase(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=102').get().balance===7,'channel reward');
await click(102,'channel:check');await assertCase(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=102').get().balance===7,'channel reward once');
subscriptionStatus='left';await msg(103,'/start');await click(103,'sign:scorpio');await click(103,'channel:check');
await assertCase(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=103').get().balance===2,'non-subscriber has no reward');

// Telegram may retry duplicate update_id; verify no second send/charge.
const u={update_id:91919,callback_query:{id:'new-1',from:{id:102},message:{chat:{id:102,type:'private'}},data:'tarot:three'}};
await hook(u); const countBefore=out.length;await hook(u);
await assertCase(out.length===countBefore,'duplicate callback not processed');
await msg(103,'/stop');await assertCase(db.prepare('SELECT notifications_enabled FROM astra_users WHERE telegram_id=103').get().notifications_enabled===0,'notifications stop');
await msg(103,'🔔 Рассылка');await assertCase(db.prepare('SELECT notifications_enabled FROM astra_users WHERE telegram_id=103').get().notifications_enabled===1,'notifications resume');

// Temporarily freeze Date in the 09:00 Moscow window to test scheduled delivery.
const OriginalDate=globalThis.Date;const fixed=OriginalDate.parse('2026-11-04T06:10:00.000Z');
class FrozenDate extends OriginalDate {constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
globalThis.Date=FrozenDate;
await bot.scheduled({},env);
await assertCase(db.prepare('SELECT last_broadcast_day FROM astra_users WHERE telegram_id=101').get().last_broadcast_day==='2026-11-04','morning broadcast delivered');
const forecastHeading=forecast?'Общий солнечный прогноз':editorial?'Прогноз по солнечному знаку':'ГОРОСКОП НА';
const sent=out.filter(x=>x.method==='sendMessage'&&x.body.text?.includes(forecastHeading)).length;
await bot.scheduled({},env);
await assertCase(sent>0 && out.filter(x=>x.method==='sendMessage'&&x.body.text?.includes(forecastHeading)).length===sent,'morning broadcast not duplicate');
globalThis.Date=OriginalDate;

await msg(103,'/delete');await assertCase(db.prepare('SELECT count(*) AS count FROM astra_users WHERE telegram_id=103').get().count===0,'delete account');
r=await bot.fetch(new Request(`${host}/health`),{...env,ASTRA_BOT_TOKEN:undefined});
await assertCase((await r.json()).secrets_ready===false,'missing secret diagnosed');
globalThis.fetch=savedFetch;
console.log(`OK: ${changes} assertions; fake Telegram API calls: ${out.length}.`);
