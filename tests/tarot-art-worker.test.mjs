import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {assembleArtCandidate, writePrivateArtCandidate} from '../scripts/build-tarot-art-private.mjs';
import {registry} from './fixtures/art-private-registry.mjs';
import {scenario07,fakeBot07,enable07,openTarot25,press25,pick25,screen25,sent25,seedHistorical25} from './task07/helpers.mjs';
import {measure05} from './task05/helpers.mjs';
import names from '../data/tarot25-art-contract07.json' with {type:'json'};
import {SPREADS} from '../src/tarot25/spreads.mjs';
const dir=fs.mkdtempSync('/tmp/astra-private-art-worker-');
process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));
const candidate=path.join(dir,'private-art.mjs');
fs.writeFileSync(candidate,assembleArtCandidate(registry),{mode:0o600});
const {default:bot}=await import(pathToFileURL(candidate));
async function context({historical=false}={}) {
  const s=scenario07();if(historical)await seedHistorical25(s.source);await s.migrate();const db=s.open(),fake=fakeBot07(db,{bot});
  const previous=globalThis.fetch;let mid=50000000, fault=null, beforeImage=null;
  fake.env.ASTRA_BOT_TOKEN='901:OFFLINE_NOT_REAL';fake.env.ASTRA_TELEGRAM_TEST_MODE='true';
  globalThis.fetch=async(url,options)=>{
    assert.ok(String(url).startsWith('https://api.telegram.org/bot901:OFFLINE_NOT_REAL/'),'ALL NETWORK MUST BE MOCKED');
    const method=String(url).split('/').at(-1),body=JSON.parse(options.body);
    if(['sendPhoto','sendMediaGroup'].includes(method)){
      fake.calls.push({method,body});if(beforeImage)await beforeImage();
      if(fault==='network')throw Error('SYNTHETIC_UNKNOWN_NETWORK');
      if(Number.isInteger(fault))return Response.json({ok:false,error_code:fault,parameters:{retry_after:12}},{status:fault});
      const messages=(method==='sendPhoto'?[body]:body.media).map(()=>({message_id:++mid,chat:{id:body.chat_id,type:'private'},photo:[{file_id:'SYNTHETIC_ACK_PHOTO'}]}));
      return Response.json({ok:true,result:fault==='unknown_ack'?true:method==='sendPhoto'?messages[0]:messages});
    }
    return previous(String(url).replace('bot901:OFFLINE_NOT_REAL/test/','botTASK04_SYNTHETIC_ONLY/').replace('bot901:OFFLINE_NOT_REAL/','botTASK04_SYNTHETIC_ONLY/'),options);
  };
  return {db,fake,setFault:value=>fault=value,beforeImage:fn=>beforeImage=fn,
    close(){fake.close();db.close();s.close();}};
}
const photos=c=>c.fake.calls.filter(x=>['sendPhoto','sendMediaGroup'].includes(x.method));
const run=(name,fn)=>test(name,async()=>{const c=await context();try{await fn(c);}finally{c.close();}});
async function quote(c,label='Три карты',theme='Общий вопрос') {
  await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'Новый вопрос'),12);
  await press25(c.fake,pick25(c.fake,theme),12);await press25(c.fake,pick25(c.fake,label),12);
  return pick25(c.fake,'Подтвердить');
}
function ledger(c){return c.db.prepare("SELECT count(*) AS n FROM astra_wallet_ledger WHERE reason='tarot:v25'").get().n;}
function balance(c){return c.db.prepare('SELECT balance FROM astra_users WHERE telegram_id=12').get().balance;}
function saved(c){return c.db.prepare('SELECT * FROM astra_tarot25_purchases29 ORDER BY rowid DESC LIMIT 1').get();}
const hashes=()=>Object.fromEntries(['release/ASTRA_2_4_WORKER.js','release/ASTRA_2_5_TASK07_CANDIDATE.js',...Array.from({length:11},(_,i)=>{const number=21+i;return fs.readdirSync('migrations').find(x=>x.startsWith(String(number).padStart(4,'0')+'_')&&x.endsWith('.sql'));}).map(x=>'migrations/'+x)].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const beforeHashes=hashes();
const measured=[];

run('images OFF preserves text delivery, balance, flags and health503',async c=>{
  enable07(c);const p=await quote(c);await press25(c.fake,p,12);
  assert.equal(photos(c).length,0);assert.equal(balance(c),95);assert.equal(ledger(c),1);
  const r=await bot.fetch(new Request('https://fake.invalid/health'),c.fake.env),h=await r.json();
  assert.equal(r.status,503);assert.equal(h.public_ready,false);
  assert.notEqual(c.fake.env.STARS_SHOP_ENABLED,'true');assert.notEqual(c.fake.env.ASTRA_DAILY_DELIVERY_ENABLED,'true');
});
for(const spread of SPREADS)run('real UI '+spread.spread_id+' reveals photos only after pay, one album, duplicate callback no new debit',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';
  const theme=spread.theme==='relations'?'Отношения':spread.theme==='work'?'Работа и карьера':spread.theme==='choice'?'Выбор и жизненная':'Общий вопрос';
  const p=await quote(c,spread.name,theme);assert.equal(photos(c).length,0);assert.equal(ledger(c),0);
  c.beforeImage(()=>{assert.equal(ledger(c),1);assert.equal(saved(c).delivery,'sent');});
  const metrics=await measure05(c.fake,()=>press25(c.fake,p,12));assert.equal(metrics.status,200);assert.ok(metrics.total<=50,JSON.stringify(metrics));
  measured.push({case:spread.spread_id,...metrics});
  const row=saved(c),snap=JSON.parse(row.snapshot_json);
  assert.equal(photos(c).length,1);assert.equal(photos(c)[0].method,'sendMediaGroup');
  assert.deepEqual(photos(c)[0].body.media.map(x=>x.media),snap.cards.map(d=>'SYNTHETIC_'+(d.reversed?'REVERSED_':'UPRIGHT_')+d.card_id));
  assert.equal(balance(c),100-spread.proposed_price);await press25(c.fake,p,12);
  assert.equal(photos(c).length,1);assert.equal(ledger(c),1);assert.equal(saved(c).snapshot_json,row.snapshot_json);
});
for(const fault of [400,403,429,500,'network','unknown_ack'])run('paid text survives photo '+fault+'; free explicit history recovers same cards',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const p=await quote(c);c.setFault(fault);
  await press25(c.fake,p,12);const row=saved(c);
  assert.equal(row.delivery,'sent');assert.equal(balance(c),95);assert.equal(photos(c).length,1);
  await press25(c.fake,p,12);assert.equal(photos(c).length,1);assert.equal(ledger(c),1);
  c.setFault(null);await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'История'),12);await press25(c.fake,pick25(c.fake,'Читать'),12);
  assert.equal(photos(c).length,2);assert.deepEqual(photos(c)[1].body.media,photos(c)[0].body.media);
  assert.equal(balance(c),95);assert.equal(ledger(c),1);assert.equal(saved(c).result,row.result);assert.equal(saved(c).snapshot_json,row.snapshot_json);
});
run('unknown TEXT delivery sends no images; repeated callback does not replay unknown material',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const p=await quote(c);c.fake.fail('network');
  await press25(c.fake,p,12);c.fake.fail(null);assert.equal(saved(c).delivery,'unknown');assert.equal(photos(c).length,0);
  await press25(c.fake,p,12);assert.equal(photos(c).length,0);assert.equal(ledger(c),1);assert.equal(balance(c),95);
});
run('wrong bot registry is text-only without exposing a file ID',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';c.fake.env.ASTRA_TELEGRAM_TEST_MODE='false';
  const p=await quote(c);await press25(c.fake,p,12);assert.equal(photos(c).length,0);assert.equal(balance(c),95);
});
run('forged or forwarded payment callbacks do not expose images',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const p=await quote(c);
  const bad=c.fake.click(12,p.data,p.mid+1);await c.fake.hook(bad);
  await c.fake.hook(c.fake.click(11,p.data,p.mid));assert.equal(photos(c).length,0);assert.equal(ledger(c),0);assert.equal(balance(c),100);
});
run('two concurrent confirmations share the existing paid row, one debit and one album',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const p=await quote(c);
  await Promise.all([press25(c.fake,p,12),press25(c.fake,p,12)]);
  assert.equal(ledger(c),1);assert.equal(balance(c),95);assert.equal(photos(c).length,1);
});
run('failed image ownership SQL preserves saved text and the sole debit',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const p=await quote(c),DB=c.fake.env.DB;
  c.fake.env.DB={...DB,prepare(sql){const st=DB.prepare(sql);if(sql.startsWith('SELECT 1 FROM astra_tarot25_purchases29 t JOIN'))st.first=async()=>{throw Error('SYNTHETIC_D1_UNAVAILABLE');};return st;}};
  await press25(c.fake,p,12);assert.equal(ledger(c),1);assert.equal(balance(c),95);assert.equal(saved(c).delivery,'sent');assert.equal(photos(c).length,0);
});
run('delete and re-register cannot replay the previous image purchase button',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const p=await quote(c);await press25(c.fake,p,12);
  await c.fake.hook(c.fake.message(12,'/delete'));await c.fake.hook(c.fake.message(12,'/start'));
  await press25(c.fake,p,12);assert.equal(photos(c).length,1);
  assert.equal(c.db.prepare('SELECT count(*)n FROM astra_tarot25_purchases29 WHERE telegram_id=12').get().n,0);
});
run('58k text retains conservative50-operation guard; no album after incomplete text',async c=>{
  enable07(c);c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const p=await quote(c,'Кельтский крест'),DB=c.fake.env.DB;
  const long=('Технический сохранённый текст 🃏\n').repeat(2500).slice(0,58000);
  c.fake.env.DB={...DB,prepare(sql){const st=DB.prepare(sql);if(sql.startsWith('INSERT INTO astra_tarot25_offers29(')){const bind=st.bind.bind(st);st.bind=(...args)=>{const s=JSON.parse(args[4]);s.text=long;s.interpretation.text=long;args[4]=JSON.stringify(s);args[5]=long;return bind(...args);};}return st;}};
  const metrics=await measure05(c.fake,()=>press25(c.fake,p,12));measured.push({case:'long58k',...metrics});
  assert.ok(metrics.total<=50,JSON.stringify(metrics));assert.equal(saved(c).result,long);assert.equal(saved(c).delivery,'unknown');assert.equal(ledger(c),1);assert.equal(photos(c).length,0);
});
test('legacy3 and legacy5 history remains exact text, never inferred from card names',async()=>{
  const c=await context({historical:true});try{
    c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const before=balance(c),texts=[c.db.prepare("SELECT result FROM astra_operations WHERE operation_id='task04-legacy3'").get().result,c.db.prepare("SELECT result FROM astra_tarot_purchases26 WHERE offer_id='task04-legacy5'").get().result];
    await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'История'),12);await press25(c.fake,pick25(c.fake,'оплачено 5'),12);
    assert.ok(sent25(c.fake).includes(texts[1]));const realNow=Date.now;Date.now=()=>realNow()+6000;
    try{await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'История'),12);await press25(c.fake,pick25(c.fake,'оплачено 3'),12);}finally{Date.now=realNow;}
    assert.ok(sent25(c.fake).includes(texts[0]));assert.equal(photos(c).length,0);assert.equal(balance(c),before);
  }finally{c.close();}
});
for(const route of ['signed','legacy'])run('free day card '+route+' keeps old date/hash/orientation with zero debit',async c=>{
  c.fake.env.ASTRA_TAROT_ART_ENABLED='true';const before=balance(c);
  if(route==='signed'){await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'Карта дня'),12);}
  else await c.fake.hook(c.fake.click(12,'tarot:day'));
  const text=sent25(c.fake).findLast(x=>x.startsWith('Карта дня ·'));
  const name=names.find(n=>text.includes('\n\n'+n.name_ru+'\n')||text.includes('\n\n'+n.name_ru+' (перевёрнутая)'));
  assert.ok(name);assert.equal(photos(c).length,1);const body=photos(c)[0].body;
  assert.equal(body.photo,'SYNTHETIC_'+(text.includes('(перевёрнутая)')?'REVERSED_':'UPRIGHT_')+name.card_id);
  assert.equal(balance(c),before);assert.equal(ledger(c),0);
});
test('private CLI refuses repo output, overwrite, symlink, and produces mode0600 outside Git',()=>{
  const json=path.join(dir,'registry.json');fs.writeFileSync(json,JSON.stringify(registry),{mode:0o600});
  assert.throws(()=>writePrivateArtCandidate(json,path.resolve('private-leak.js')),/OUTSIDE_GIT/);
  assert.throws(()=>writePrivateArtCandidate(json,candidate),/NEW_PRIVATE_OUTPUT/);
  const link=path.join(dir,'linked.json');fs.symlinkSync(json,link);assert.throws(()=>writePrivateArtCandidate(link,path.join(dir,'linked.mjs')),/UNSAFE_REGISTRY/);
  const target=path.join(dir,'new-private.mjs'),r=writePrivateArtCandidate(json,target);
  assert.equal(r.deployed,false);assert.equal(r.art_default,'OFF');assert.equal(fs.statSync(target).mode&0o777,0o600);
});
test('all frozen historical Workers and migrations remain byte-identical',()=>assert.deepEqual(hashes(),beforeHashes));
test('record actual local invocation counts without private registry or snapshots',()=>{
  assert.equal(measured.length,8);
  if(process.env.ASTRA_ART_METRICS_FILE)fs.writeFileSync(process.env.ASTRA_ART_METRICS_FILE,JSON.stringify({scope:'private art candidate + native SQLite + fake Telegram',cloudflare_measured:false,cases:measured,max_operations:Math.max(...measured.map(x=>x.total))},null,2)+'\n');
});
