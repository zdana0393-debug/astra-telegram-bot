import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import catalog from '../data/forecast/catalog.v1.json' with {type:'json'};
import {createForecastGenerator,validateSelection,validDay,legacyHash,russianWords} from '../src/forecast/engine.mjs';
import {getForecastDaily,purchaseForecast,forecastChunks} from '../src/forecast/service.mjs';
import {fixture,migration23} from './helpers.mjs';
const generate=createForecastGenerator(catalog),day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date());
const check=(name,fn)=>test(name,async()=>{const f=fixture({forecast:true});try{await fn(f);}finally{f.close();}});
async function click(f,data,id=1,mid=90){const q=f.click(id,mid);q.callback_query.data='shell:'+data;return f.hook(q);}
const pay=(f,id=1,d=day())=>click(f,'forecast:pay:'+d,id);
const count=(f,t)=>f.query(`SELECT count(*) n FROM ${t}`).n;
test('reference corpus has correct traditional rulers, versions and 24 nonblank runes',()=>{
  assert.equal(catalog.units.length,192);assert.equal(catalog.signs.length,12);assert.equal(catalog.numbers.length,9);assert.equal(catalog.runes.length,24);
  for(const [id,ruler,modern] of [['scorpio','Марс','Плутон'],['aquarius','Сатурн','Уран'],['pisces','Юпитер','Нептун']]){
    const s=catalog.signs.find(s=>s.sign_id===id);assert.equal(s.ruler,ruler);assert.ok(s.modern_association.includes(modern));assert.match(s.modern_association,/современн/);
  }
  assert.ok(catalog.runes.every(r=>r.glyph&&r.historical&&r.question));assert.equal(new Set(catalog.runes.map(r=>r.name)).size,24);
});
test('missing catalog sections, empty paid content and conflicting tags fail instead of making a placeholder',()=>{
  for(const change of [c=>c.units=[],c=>c.units[0].body='',c=>c.numbers.pop(),c=>c.themes[0].extended='',c=>c.runes[0].historical='',c=>c.symbols[0].color='',c=>c.signs[0].label='',c=>c.sign_lenses.pop(),c=>c.modality_lenses.pop(),c=>c.sign_lenses[0].directives={timing:'fake'}]){
    const c=structuredClone(catalog);change(c);assert.throws(()=>createForecastGenerator(c));
  }
  const sign=catalog.signs[0],theme=catalog.themes[0],rows=catalog.units.filter(u=>u.theme===theme.id&&u.element===sign.element_id);
  assert.equal(rows.length,6);validateSelection(rows,sign,theme);
  const bad=structuredClone(rows);bad[0].incompatible_with.push(bad[1].id);assert.throws(()=>validateSelection(bad,sign,theme),/Conflicting/);
  const wrong=structuredClone(rows);wrong[0].conditions.push('exact-transit');assert.throws(()=>validateSelection(wrong,sign,theme),/Incompatible/);
});
test('calendar validity, legacy number and generator repeatability include leap boundaries',()=>{
  for(const s of catalog.signs){const themes=Array.from({length:8},(_,i)=>generate(s.sign_id,'2026-11-'+String(i+1).padStart(2,'0')).trace.theme);assert.equal(new Set(themes).size,8);}
  for(const bad of ['2026-02-29','2024-02-30','2026-13-01','no-date'])assert.equal(validDay(bad),false);
  for(const d of ['2024-02-29','2026-12-31','2027-01-01'])for(const sign of catalog.signs){
    const f=generate(sign.sign_id,d);assert.equal(f.free_text,generate(sign.sign_id,d).free_text);assert.equal(f.number,legacyHash(sign.sign_id+d)%9+1);
    assert.equal(f.number_algorithm_version,'legacy-hash-v1');assert.ok(f.words>=160&&f.words<=260);assert.equal(f.words,russianWords(f.free_text));
    assert.ok(f.free_text.includes('Europe/Moscow'));assert.ok(f.extended_text.includes('Руна дня'));assert.ok(!f.extended_text.includes('фаза Луны'));
  }
});
check('one shared immutable daily row serves multiple users without regenerating archived versions',async f=>{
  f.user(1);f.user(2);const today=day(),first=await getForecastDaily(f.env,'aries',today);
  const noGeneration=()=>{throw Error('new version must not regenerate existing row');};
  assert.equal((await getForecastDaily(f.env,'aries',today,noGeneration)).free_text,first.free_text);
  assert.equal(count(f,'astra_forecast_daily'),1);assert.equal(f.reconcile(),0);
  assert.throws(()=>f.db.prepare("UPDATE astra_forecast_daily SET free_text='replacement'").run(),/immutable/);
  const newVersion=createForecastGenerator(catalog,{engineVersion:'forecast-2.0.0'});
  assert.equal((await getForecastDaily(f.env,'aries',today,newVersion)).engine_version,first.engine_version);
});
check('confirmation, cancellation, repeat without purchase and zero-balance free access never debit',async f=>{
  f.user(1,0);for(const route of ['forecast','forecast:extended','forecast:read','forecast:repeat','forecast'])assert.equal((await click(f,route)).status,200);
  assert.equal(f.balance(1),0);assert.equal(count(f,'astra_forecast_unlocks'),0);assert.equal(count(f,'astra_forecast_daily'),1);
  assert.equal((await pay(f)).status,200);assert.equal(f.balance(1),0);assert.equal(count(f,'astra_forecast_unlocks'),0);assert.equal(f.reconcile(),0);
});
check('20 concurrent different updates buy exactly one snapshot and one -4 ledger entry',async f=>{
  f.user(1,20);const res=await Promise.all(Array.from({length:20},(_,i)=>click(f,'forecast:pay:'+day(),1,100+i)));
  assert.ok(res.every(r=>r.status===200));assert.equal(f.balance(1),16);assert.equal(count(f,'astra_forecast_unlocks'),1);
  assert.equal(f.query("SELECT count(*) n FROM astra_wallet_ledger WHERE reason='forecast:extended' AND delta=-4 AND operation_id IS NULL").n,1);assert.equal(f.reconcile(),0);
  assert.equal(count(f,'astra_operations'),0);assert.equal(count(f,'astra_forecast_daily'),1);
});
check('two confirmation messages and repeated callbacks retain one date purchase',async f=>{
  f.user(1,10);await click(f,'forecast:extended',1,1);await click(f,'forecast:future',1,2);assert.equal(f.balance(1),10);
  const confirmation=f.out.filter(x=>x.method==='sendMessage').at(-1).body;
  assert.ok(confirmation.reply_markup.inline_keyboard.flat().some(b=>b.callback_data==='shell:forecast:pay:'+day()));
  const q=f.click(1,3);q.callback_query.data='shell:forecast:pay:'+day();await f.hook(q);await f.hook(q);await click(f,'forecast:pay:'+day(),1,4);
  assert.equal(f.balance(1),6);assert.equal(count(f,'astra_forecast_unlocks'),1);assert.equal(f.reconcile(),0);
});
check('ledger failure rolls back unlock and balance; retry creates a single valid purchase',async f=>{
  f.user(1,8);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='forecast:extended' BEGIN SELECT RAISE(ABORT,'fault'); END");
  const q=f.click(1);q.callback_query.data='shell:forecast:pay:'+day();assert.equal((await f.hook(q)).status,500);
  assert.equal(f.balance(1),8);assert.equal(count(f,'astra_forecast_unlocks'),0);assert.equal(f.reconcile(),0);
  f.db.exec('DROP TRIGGER fault');assert.equal((await f.hook(q)).status,200);assert.equal(f.balance(1),4);assert.equal(count(f,'astra_forecast_unlocks'),1);assert.equal(f.reconcile(),0);
});
for(const error of [400,403,429,500,'network','malformed'])check(`paid forecast survives Telegram ${error} and returns the same text without new debit`,async f=>{
  f.user(1,8);f.fail(error);const q=f.click(1);q.callback_query.data='shell:forecast:pay:'+day();assert.equal((await f.hook(q)).status,500);
  const saved=f.query('SELECT * FROM astra_forecast_unlocks');assert.ok(saved.result_text.includes('Совет Жирного'));assert.equal(f.balance(1),4);
  f.fail(null);assert.equal((await f.hook(q)).status,200);assert.equal(f.out.at(-1).body.text,saved.result_text);await click(f,'forecast:repeat');
  assert.equal(f.out.at(-1).body.text,saved.result_text);assert.equal(f.balance(1),4);assert.equal(f.reconcile(),0);
});
check('new sign and new generator version cannot replace an owned same-day result',async f=>{
  f.user(1,12);const first=await purchaseForecast(f.env,1,'aries',day());f.db.exec("UPDATE astra_users SET zodiac='pisces' WHERE telegram_id=1");
  const newer=createForecastGenerator(catalog,{engineVersion:'future-version'});const second=await purchaseForecast(f.env,1,'pisces',day(),newer);
  assert.equal(first.result_text,second.result_text);assert.equal(second.sign,'aries');assert.equal(second.engine_version,first.engine_version);assert.equal(f.balance(1),8);
  assert.throws(()=>f.db.prepare("UPDATE astra_forecast_unlocks SET result_text='new'").run(),/immutable/);await click(f,'forecast:repeat');assert.equal(f.out.at(-1).body.text,first.result_text);
});
check('invalid catalog/payload or D1 failure cannot create a paid empty response',async f=>{
  f.user(1,8);await assert.rejects(purchaseForecast(f.env,1,'aries',day(),()=>({free_text:'',extended_text:''})));
  assert.equal(f.balance(1),8);assert.equal(count(f,'astra_forecast_unlocks'),0);
  const prepare=f.env.DB.prepare;f.env.DB.prepare=sql=>{if(sql.startsWith('SELECT * FROM astra_forecast_daily'))throw Error('injected D1 error');return prepare(sql);};
  assert.equal((await pay(f)).status,500);assert.equal(f.balance(1),8);assert.equal(count(f,'astra_forecast_unlocks'),0);assert.equal(f.reconcile(),0);
});
for(const fk of ['ON','OFF'])check(`profile deletion cleans its forecast archive with FK ${fk}, retaining others and anonymous cache`,async f=>{
  f.db.exec('PRAGMA foreign_keys='+fk);f.user(1,10);f.user(2,10);await pay(f,1);await pay(f,2);await f.hook(f.message(1,'gpt6'));
  assert.equal((await f.hook(f.message(1,'/delete'))).status,200);assert.equal(f.balance(1),undefined);assert.equal(f.balance(2),6);
  assert.equal(f.query('SELECT count(*) n FROM astra_forecast_unlocks WHERE telegram_id=1').n,0);assert.equal(f.query('SELECT count(*) n FROM astra_forecast_unlocks WHERE telegram_id=2').n,1);
  assert.equal(f.query('SELECT count(*) n FROM astra_shell_rewards WHERE telegram_id=1').n,0);assert.equal(f.query('SELECT count(*) n FROM astra_wallet_ledger WHERE telegram_id=1').n,0);
  assert.equal(count(f,'astra_forecast_daily'),1);assert.equal(f.reconcile(),0);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
check('migration is repeatable and split files exactly equal the combined script',async f=>{
  const files=fs.readdirSync(new URL('../migrations/0023_steps/',import.meta.url)).sort();
  assert.equal(files.map(n=>fs.readFileSync(new URL('../migrations/0023_steps/'+n,import.meta.url),'utf8')).join(''),migration23);
  f.user(1,12);f.db.exec(migration23);await pay(f);const entries=count(f,'astra_wallet_ledger');f.db.exec(migration23);await pay(f);
  assert.equal(f.balance(1),8);assert.equal(count(f,'astra_wallet_ledger'),entries);assert.equal(f.reconcile(),0);
  assert.throws(()=>f.db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES('bad',1,'forecast:extended',-4,'bad')").run(),/CHECK/);
});
check('partial migration and missing activation setting fail health/webhook/Cron closed',async f=>{
  f.user(1,8);const health=()=>f.bot.fetch(new Request('https://astra.test/health'),f.env);
  delete f.env.ASTRA_FORECAST_START_DAY;assert.equal((await health()).status,503);assert.equal((await pay(f)).status,503);f.env.ASTRA_FORECAST_START_DAY='2026-01-01';
  for(const name of ['astra_forecast_post','astra_forecast_daily_immutable']){
    f.db.exec('DROP TRIGGER '+name);assert.equal((await health()).status,503);assert.equal((await pay(f)).status,503);await f.bot.scheduled({},f.env);assert.equal(f.balance(1),8);f.db.exec(migration23);
  }assert.equal((await health()).status,200);assert.equal(count(f,'astra_forecast_unlocks'),0);
});
check('midnight cutover, stale confirmation, new-day purchase and year boundary use Moscow dates',async f=>{
  f.user(1,12);const Original=Date;let time='2026-12-31T20:59:59Z';
  class Fixed extends Original{constructor(...a){super(...(a.length?a:[time]));}static now(){return new Original(time).getTime();}}
  globalThis.Date=Fixed;
  try{f.env.ASTRA_FORECAST_START_DAY='2027-01-01';await click(f,'forecast:read');assert.match(f.out.at(-1).body.text,/Прогноз по солнечному знаку/);assert.equal(count(f,'astra_forecast_daily'),0);
    await click(f,'forecast:extended');assert.equal(f.balance(1),12);assert.equal(count(f,'astra_forecast_unlocks'),0);
    time='2026-12-31T21:00:00Z';await click(f,'forecast:read');assert.ok(f.out.at(-1).body.text.includes('2027-01-01'));assert.equal(count(f,'astra_forecast_daily'),1);
    await pay(f,1,'2026-12-31');assert.equal(f.balance(1),12);await pay(f,1,'2027-01-01');assert.equal(f.balance(1),8);
    time='2027-01-01T21:00:00Z';await pay(f);assert.equal(f.balance(1),4);assert.equal(count(f,'astra_forecast_unlocks'),2);assert.equal(f.reconcile(),0);
  }finally{globalThis.Date=Original;}
});
check('all free entry points and Cron share the same large cached text and never buy extended',async f=>{
  f.user(1,0);const Original=Date;class Fixed extends Original{constructor(...a){super(...(a.length?a:['2026-11-06T06:10:00Z']));}static now(){return new Original('2026-11-06T06:10:00Z').getTime();}}
  globalThis.Date=Fixed;
  try{await f.hook(f.message(1,'🔮 Гороскоп'));const saved=f.out.at(-1).body.text;await click(f,'forecast:read');assert.equal(f.out.at(-1).body.text,saved);
    await f.bot.scheduled({},f.env);assert.equal(f.out.at(-1).body.text,saved);await f.bot.scheduled({},f.env);
    for(const sign of catalog.signs)await getForecastDaily(f.env,sign.sign_id,day());assert.equal(count(f,'astra_forecast_daily'),12);
    await f.hook(f.message(22,'/start'));const q=f.click(22);q.callback_query.data='sign:aries';await f.hook(q);assert.equal(f.out.at(-1).body.text,saved);assert.equal(count(f,'astra_forecast_daily'),12);
    assert.equal(count(f,'astra_forecast_unlocks'),0);assert.equal(f.balance(1),0);assert.equal(f.reconcile(),0);
  }finally{globalThis.Date=Original;}
});
test('Telegram chunking preserves a long archived text and UTF-16 surrogate pairs exactly',()=>{
  const text=('Длинный архивный текст 🪐\n').repeat(500);const parts=forecastChunks(text);assert.ok(parts.length>1);assert.equal(parts.join(''),text);
  for(const p of parts){assert.ok(p.length<=3800);assert.ok(!/[\uD800-\uDBFF]$/.test(p));}assert.throws(()=>forecastChunks(''));
});
check('long paid archive is sent in bounded chunks without a second purchase',async f=>{
  f.user(1,8);await pay(f);const saved=f.query('SELECT * FROM astra_forecast_unlocks');
  // A historical record can predate the current size policy. Insert a second day as a synthetic archive.
  const text='Архивный результат. '.repeat(500),oldDay='2026-01-02';await getForecastDaily(f.env,'aries',oldDay);
  f.db.prepare(`INSERT INTO astra_forecast_unlocks(telegram_id,day,sign,locale,price,result_text,engine_version,content_version,number_algorithm_version,source_tags)
    VALUES(1,?,'aries','ru',4,?,'historic','historic','legacy-hash-v1','{}')`).run(oldDay,text);
  const before=f.balance(1),n=f.out.length;await pay(f,1,oldDay);const sends=f.out.slice(n).filter(x=>x.method==='sendMessage');assert.ok(sends.length>1);assert.equal(sends.map(s=>s.body.text).join(''),text);assert.equal(f.balance(1),before);assert.equal(saved.price,4);
});
check('invalid price, malformed date and missing owner cannot post even with FK OFF',async f=>{
  f.db.exec('PRAGMA foreign_keys=OFF');f.user(1,8);const d=await getForecastDaily(f.env,'aries',day());
  const insert=f.db.prepare(`INSERT INTO astra_forecast_unlocks(telegram_id,day,sign,locale,price,result_text,engine_version,content_version,number_algorithm_version,source_tags)
    VALUES(?,?,'aries','ru',?,?,'x','x','legacy-hash-v1','{}') ON CONFLICT(telegram_id,day) DO NOTHING`);
  for(const [id,date,price] of [[1,day(),3],[1,'2026-02-30',4],[999,day(),4]])insert.run(id,date,price,d.extended_text);
  assert.equal(f.balance(1),8);assert.equal(count(f,'astra_forecast_unlocks'),0);assert.equal(f.reconcile(),0);
});
test('20 independent SQLite connections purchase one daily result without a JS mutex',async()=>{
  const {DatabaseSync}=await import('node:sqlite'),{mkdtempSync,rmSync}=await import('node:fs'),{join}=await import('node:path'),{tmpdir}=await import('node:os'),{Worker}=await import('node:worker_threads');
  const dir=mkdtempSync(join(tmpdir(),'astra-forecast-')),file=join(dir,'race.sqlite'),db=new DatabaseSync(file),date='2026-11-06';
  try{db.exec(fs.readFileSync(new URL('../src/02_SCHEMA.sql',import.meta.url),'utf8'));db.exec(fs.readFileSync(new URL('../migrations/0021_wallet.sql',import.meta.url),'utf8'));db.exec(fs.readFileSync(new URL('../migrations/0022_shell.sql',import.meta.url),'utf8'));db.exec(migration23);db.exec("INSERT INTO astra_users(telegram_id,zodiac,balance) VALUES(1,'aries',20)");
    const f=generate('aries',date);db.prepare(`INSERT INTO astra_forecast_daily(sign,day,locale,free_text,extended_text,number,engine_version,content_version,number_algorithm_version,source_tags) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .run(f.sign,f.day,f.locale,f.free_text,f.extended_text,f.number,f.engine_version,f.content_version,f.number_algorithm_version,f.source_tags);
    await Promise.all(Array.from({length:20},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL('./forecast-contention-worker.mjs',import.meta.url),{workerData:{file,day:date}});w.on('error',reject);w.on('exit',code=>code===0?resolve():reject(Error('Worker exit '+code)));})));
    assert.equal(db.prepare('SELECT balance FROM astra_users').get().balance,16);assert.equal(db.prepare('SELECT count(*) n FROM astra_forecast_unlocks').get().n,1);
    assert.equal(db.prepare("SELECT count(*) n FROM astra_wallet_ledger WHERE reason='forecast:extended'").get().n,1);assert.equal(db.prepare('SELECT sum(delta) n FROM astra_wallet_ledger').get().n,16);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
check('rollback Worker 2.3A can retain posted forecasts and delete its owner safely',async f=>{
  const old=(await import('../release/ASTRA_2_3_EDITORIAL_WORKER.js')).default;
  f.user(1,10);await pay(f);assert.equal(f.balance(1),6);assert.equal((await old.fetch(new Request('https://astra.test/health'),f.env)).status,200);
  const update=f.message(1,'/delete');const req=new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'FAKE_HEADER'},body:JSON.stringify(update)});
  f.db.exec('PRAGMA foreign_keys=OFF');assert.equal((await old.fetch(req,f.env)).status,200);assert.equal(count(f,'astra_forecast_unlocks'),0);assert.equal(count(f,'astra_forecast_daily'),1);assert.equal(count(f,'astra_wallet_ledger'),0);
});
check('prepared read-only integrity script reports zero mismatches before and after deletion',async f=>{
  f.user(1,8);await pay(f);const sql=fs.readFileSync(new URL('../scripts/check_integrity_2_3b.sql',import.meta.url),'utf8');
  const checks=['balance_mismatches','unlocks_without_posting','postings_without_unlock','orphan_unlocks','snapshot_mismatches'];
  const verify=()=>{
    for(const statement of sql.match(/SELECT[\s\S]*?;/g)||[]){const rows=f.db.prepare(statement).all();for(const row of rows)for(const name of checks)if(name in row)assert.equal(row[name],0,name);}
    assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
  };
  verify();await f.hook(f.message(1,'/delete'));verify();
});
