import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {assembleArtCandidate} from '../scripts/build-tarot-art-private.mjs';
import {assembleRelease25} from '../scripts/apply-astra25-release.mjs';
import {cleanInstall25} from '../scripts/build-astra25-clean.mjs';
import {fakeBot25} from '../scripts/lib/astra25-synthetic.mjs';
import {configureFence26,approveFenceNotice26} from '../src/task01/bonus.mjs';
import {registry} from './fixtures/art-private-registry.mjs';
import {openTarot25,pick25,press25,sent25} from './task04/upgrade-helpers.mjs';
const dir=fs.mkdtempSync('/tmp/astra25-clean-worker-'),worker=path.join(dir,'worker.mjs');
fs.writeFileSync(worker,assembleRelease25(assembleArtCandidate(registry)),{mode:0o600});
process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));
const {default:bot}=await import(pathToFileURL(worker));
const clean=cleanInstall25();
async function setup({enabled=true}={}){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(clean.sql);
 const fake=fakeBot25(db,{bot});Object.assign(fake.env,{ASTRA_BOT_TOKEN:'901:OFFLINE_NOT_REAL',ASTRA_TELEGRAM_TEST_MODE:'true',ASTRA_TAROT_ART_ENABLED:'true',ASTRA_FORECAST_COMPACT_START_DAY:'2026-01-01',ASTRA_BONUS_FENCE_KEY:'CLEAN_INSTALL_SYNTHETIC_HMAC_KEY_0123456789',ASTRA_BONUS_FENCE_NOTICE_ACK:'APPROVED_BONUS_FENCE_30_DAYS'});
 const prior=globalThis.fetch;let mid=50000;
 globalThis.fetch=async(url,options)=>{
  assert.ok(String(url).startsWith('https://api.telegram.org/bot901:OFFLINE_NOT_REAL/'),'ALL NETWORK MUST BE MOCKED');
  const method=String(url).split('/').at(-1),body=JSON.parse(options.body);
  if(['sendPhoto','sendMediaGroup'].includes(method)){
   fake.calls.push({method,body});const messages=Array.from({length:method==='sendPhoto'?1:body.media.length},()=>({message_id:++mid,chat:{id:body.chat_id,type:'private'},photo:[{file_id:'SYNTHETIC_ACK_ONLY'}]}));
   return Response.json({ok:true,result:method==='sendPhoto'?messages[0]:messages});
  }
  return prior(String(url).replace('bot901:OFFLINE_NOT_REAL/test/','botTASK04_SYNTHETIC_ONLY/').replace('bot901:OFFLINE_NOT_REAL/','botTASK04_SYNTHETIC_ONLY/'),options);
 };
 await configureFence26(fake.env);await approveFenceNotice26(fake.env,'bonus-fence-30d-v1','APPROVED_BONUS_FENCE_30_DAYS');
 if(enabled){db.exec('UPDATE astra_tarot25_runtime29 SET enabled=1;UPDATE astra_tarot30_policy SET write_enabled=1;UPDATE astra_tarot31_policy SET enabled=1');Object.assign(fake.env,{ASTRA_TAROT25_ENABLED:'true',ASTRA_TAROT25_STORAGE_TEST_MODE:'true',ASTRA_TAROT25_INDEPENDENT_TEST_MODE:'true'});}
 return{db,fake,close(){fake.close();db.close();}};
}
async function health(c){const r=await bot.fetch(new Request('https://synthetic.invalid/health'),c.fake.env);return{status:r.status,state:await r.json()};}
test('complete operational checks produce200 without fake public bypass',async()=>{
 const c=await setup();try{const h=await health(c);assert.equal(h.status,200,JSON.stringify(h.state.blockers));assert.equal(h.state.full_schema_ready,true);assert.equal(h.state.art_registry_ready,true);assert.equal(h.state.ready,true);assert.deepEqual(h.state.blockers,[]);assert.equal(h.state.readiness_scope,'operational_checks_only');}finally{c.close();}
});
for(const [label,change,blocker] of [
 ['art disabled',c=>c.fake.env.ASTRA_TAROT_ART_ENABLED='false','ART_DISABLED'],
 ['missing HMAC',c=>delete c.fake.env.ASTRA_BONUS_FENCE_KEY,'BONUS_FENCE_KEY_MISSING'],
 ['wrong bot',c=>c.fake.env.ASTRA_BOT_TOKEN='902:OFFLINE_NOT_REAL','ART_BOT_OR_REGISTRY_MISMATCH'],
 ['tampered financial guard',c=>c.db.exec('DROP TRIGGER astra_forecast_guard;CREATE TRIGGER astra_forecast_guard BEFORE INSERT ON astra_forecast_unlocks BEGIN SELECT 1; END'),'FINAL_SCHEMA_MISMATCH'],
 ['partial D1 failure',c=>{const raw=c.fake.env.DB;c.fake.env.DB={...raw,prepare(sql){if(sql.includes('matching_count'))throw Error('SYNTHETIC_D1_FAILURE');return raw.prepare(sql);}};},'FINAL_SCHEMA_CHECK_UNAVAILABLE'],
 ['Stars on',c=>c.fake.env.STARS_SHOP_ENABLED='true','STARS_MUST_REMAIN_OFF'],
 ['forecast date missing',c=>delete c.fake.env.ASTRA_FORECAST_START_DAY,'FORECAST_NOT_ACTIVE'],
 ['broadcast on',c=>c.fake.env.ASTRA_DAILY_DELIVERY_ENABLED='true','BROADCAST_MUST_REMAIN_OFF']
])test('health503 has real blocker: '+label,async()=>{const c=await setup();try{change(c);const h=await health(c);assert.equal(h.status,503);assert.equal(h.state.public_ready,false);assert.ok(h.state.blockers.includes(blocker),JSON.stringify(h.state.blockers));}finally{c.close();}});
test('closed Tarot gate stays503 and requires explicit activation',async()=>{const c=await setup({enabled:false});try{const h=await health(c);assert.equal(h.status,503);assert.ok(h.state.blockers.includes('TAROT_SALES_DISABLED'));}finally{c.close();}});
test('fresh registration, compact forecast, card art, genuine reward, sole debit, free history',async()=>{
 const c=await setup();try{
  assert.equal((await c.fake.hook(c.fake.message(12,'/start'))).status,200);
  assert.equal((await c.fake.hook(c.fake.click(12,'sign:aries'))).status,200);
  let u=c.db.prepare('SELECT * FROM astra_users WHERE telegram_id=12').get();assert.equal(u.notifications_enabled,0);assert.equal(u.balance,2);
  await c.fake.hook(c.fake.click(12,'shell:forecast'));assert.ok(c.db.prepare('SELECT count(*) AS n FROM astra_forecast_daily').get().n>0);
  await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'Карта дня'),12);assert.ok(c.fake.calls.some(x=>x.method==='sendPhoto'));assert.equal(c.db.prepare('SELECT balance FROM astra_users WHERE telegram_id=12').get().balance,2);
  await c.fake.hook(c.fake.message(12,'gpt6'));assert.equal(c.db.prepare('SELECT balance FROM astra_users WHERE telegram_id=12').get().balance,7);
  await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'Новый вопрос'),12);await press25(c.fake,pick25(c.fake,'Общий вопрос'),12);await press25(c.fake,pick25(c.fake,'Три карты'),12);
  const pay=pick25(c.fake,'Подтвердить');await press25(c.fake,pay,12);await press25(c.fake,pay,12);
  assert.equal(c.db.prepare('SELECT balance FROM astra_users WHERE telegram_id=12').get().balance,2);assert.equal(c.db.prepare("SELECT count(*) AS n FROM astra_wallet_ledger WHERE reason='tarot:v25'").get().n,1);
  const paid=c.db.prepare('SELECT * FROM astra_tarot25_purchases29').get();assert.ok(paid?.result);assert.ok(c.fake.calls.some(x=>x.method==='sendMediaGroup'));
  await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'История'),12);await press25(c.fake,pick25(c.fake,'Читать'),12);
  assert.equal(c.db.prepare('SELECT balance FROM astra_users WHERE telegram_id=12').get().balance,2);assert.equal(c.db.prepare('SELECT result FROM astra_tarot25_purchases29').get().result,paid.result);assert.ok(sent25(c.fake).join('\n').includes(paid.result.slice(0,40)));
 }finally{c.close();}
});
