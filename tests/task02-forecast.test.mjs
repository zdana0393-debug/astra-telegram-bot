import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import c from '../data/forecast/catalog.v1.json' with {type:'json'};import e from '../data/forecast/editorial.compact.v1.json' with {type:'json'};
import {createForecastGenerator,legacyHash,validateSelection,SECTIONS} from '../src/forecast/engine.mjs';
import {createCompactForecastGenerator,validateCompactCatalog,validateEditorialDocument,formatFreeForecast,sourceFingerprint,COMPACT_ENGINE_VERSION} from '../src/forecast/editorial/compact.mjs';
import {generateForecastForEnv} from '../src/forecast/editorial/configured.mjs';
import {getForecastDaily,purchaseForecast} from '../src/forecast/service.mjs';
import {taskFixture,withClock,click,last} from './task01-helpers.mjs';
const old=createForecastGenerator(c),generate=createCompactForecastGenerator(c,e),all=[...c.units,...c.sign_lenses,...c.modality_lenses],source=validateCompactCatalog(c,e);
const check=(name,fn)=>test(name,async()=>{const f=taskFixture({legacyUsers:[{id:1,balance:100}]});try{await fn(f);assert.equal(f.reconcile(),0);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);}finally{f.close();}});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const selectionKeys=['theme','units','sign_lenses','modality_lenses','directives','rune','symbol','advice'];
test('compact source coverage pins all 192 theme, 216 sign, 54 modality and nine number meanings',()=>{
 assert.equal(Object.keys(e.entries).length,471);for(const row of [...all,...c.numbers]){assert.equal(e.entries[row.id].source_fingerprint,sourceFingerprint(row));assert.ok(e.entries[row.id].text.length>10);}
 assert.equal(Object.keys(e.extended_themes).length,8);assert.equal(Object.keys(e.extended_profiles).length,12);assert.equal(Object.keys(e.extended_runes).length,24);
});
test('all twelve signs across 366 dates retain exact rotation, axes, reference selections and original number',()=>{
 const seen=new Set(),lengths=[];for(let i=0;i<366;i++)for(const s of c.signs){const day=new Date(Date.UTC(2028,0,1+i)).toISOString().slice(0,10),a=old(s.sign_id,day),b=generate(s.sign_id,day);
  for(const k of selectionKeys)assert.deepEqual(b.trace[k],a.trace[k],s.sign_id+' '+day+' '+k);assert.equal(b.number,legacyHash(s.sign_id+day)%9+1);assert.equal(b.number,a.number);assert.equal(b.number_algorithm_version,a.number_algorithm_version);assert.equal(b.engine_version,COMPACT_ENGINE_VERSION);assert.equal(b.content_version,e.content_version);
  const selected=[...b.trace.units,...b.trace.sign_lenses,...b.trace.modality_lenses];selected.forEach(id=>seen.add(id));validateSelection(selected.map(id=>source.get(id)),s,c.themes.find(t=>t.id===b.trace.theme),b.trace.directives);
  validateEditorialDocument(b.document,source,s,c.themes.find(t=>t.id===b.trace.theme),b.trace.directives,selected);for(const row of b.document.sections)assert.ok(row.sources.every(id=>selected.includes(id)));
  assert.equal(b.document.sections.length,6);assert.ok(b.words>=70&&b.words<=160);assert.ok(b.free_text.length<=4096&&b.extended_text.length<=4096);assert.equal(b.free_text,formatFreeForecast(b.document));assert.equal(b.free_text.split('🔢 Число дня:').length,2);assert.equal(new Set(b.document.sections.map(row=>row.text)).size,6);
  assert.doesNotMatch(b.free_text,/Earth|Europe\/Moscow|транзит|ретроград|сегодня полнолуние|сегодня новолуние|98%/i);lengths.push(b.words);
 }
 assert.equal(seen.size,all.length);const mean=lengths.reduce((a,b)=>a+b,0)/lengths.length;assert.ok(mean>=90&&mean<=145);
});
test('12 signs on one date have twelve distinct paragraphs per section below the heading',()=>{
 for(const section of SECTIONS){const rows=c.signs.map(s=>generate(s.sign_id,'2026-11-08').document.sections.find(x=>x.section===section).text);assert.equal(new Set(rows).size,12,section);}
});
test('twelve exact repeats per sign survive other calls and fresh instances, independent of presentation version seed',()=>{
 const again=createCompactForecastGenerator(c,e);for(const s of c.signs){const themes=[];for(let i=0;i<12;i++){const day=new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10),first=generate(s.sign_id,day);generate('pisces','2028-02-29');assert.deepEqual(generate(s.sign_id,day),first);assert.deepEqual(again(s.sign_id,day),first);themes.push(first.trace.theme);}assert.equal(new Set(themes.slice(0,8)).size,8);}
});
for(const mutate of [x=>delete x.entries['virgo.action.lens.1'],x=>x.entries['virgo.action.lens.1'].text='',x=>x.entries['virgo.action.lens.1'].directives.timing='observe',x=>x.entries['virgo.action.lens.1'].source_fingerprint++,x=>x.entries['virgo.action.lens.1'].semantic_key='unrelated',x=>x.source_catalog_version='wrong',x=>x.selection_engine_version='forecast-2',x=>x.extended_runes['rune:6'].source='rune:7',x=>delete x.extended_themes.revision])test('invalid source, meaning or metadata fails closed: '+mutate.toString(),()=>{const edited=structuredClone(e);mutate(edited);assert.throws(()=>createCompactForecastGenerator(c,edited));});
for(const [id,text] of [['virgo.action.lens.2','Действуйте немедленно, не оставляя места наблюдению.'],['gemini.relations.lens.3','Начните разговор и потребуйте ответа.'],['aries.theme.lens.1','Сегодня Марс образует точный аспект.']])test('semantic guard rejects explicit contradicted instruction: '+id,()=>{const edited=structuredClone(e);edited.entries[id].text=text;assert.throws(()=>createCompactForecastGenerator(c,edited),/contradiction|astronomical/);});
test('unselected, wrong-section and contradictory source injection never becomes an attractive fallback',()=>{
 const f=generate('virgo','2026-11-08'),sign=c.signs.find(s=>s.sign_id==='virgo'),theme=c.themes.find(t=>t.id===f.trace.theme);const doc=structuredClone(f.document);doc.sections[0].sources[0]='initiative.finance.fire.1';assert.throws(()=>validateEditorialDocument(doc,source,sign,theme,f.trace.directives,[...f.trace.units,...f.trace.sign_lenses,...f.trace.modality_lenses]),/Unattributed/);
 const bad=structuredClone(c);bad.units[0].body='Changed meaning, same identity';assert.throws(()=>createCompactForecastGenerator(bad,e),/drift/);
 const fake=()=>({...old('virgo','2026-11-08'),engine_version:'unreviewed'});assert.throws(()=>createCompactForecastGenerator(c,e,{generate:fake})('virgo','2026-11-08'),/Unexpected/);
});
test('extended sources keep the selected rune, traditional uncertainty, symbol palette, number and exact Fat One advice',()=>{
 for(const s of c.signs)for(let i=0;i<90;i++){const day=new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10),f=generate(s.sign_id,day),r=c.runes.find(r=>r.id===f.trace.rune),symbol=c.symbols.find(x=>x.id===f.trace.symbol),advice=c.advice.find(x=>x.id===f.trace.advice),n=c.numbers.find(n=>n.value===f.number);
  assert.ok(f.extended_text.includes(r.historical)&&f.extended_text.includes(r.glyph)&&f.extended_text.includes(r.name));assert.ok(f.extended_text.includes('Современное символическое чтение:'));assert.ok(f.extended_text.includes(symbol.color));assert.ok(f.extended_text.includes(n.extended));assert.ok(f.extended_text.endsWith(advice.body));assert.ok(f.extended_text.includes('Развилка')&&f.extended_text.includes('Как применить'));
  assert.ok(!f.extended_text.includes(f.document.sections[0].text));
 }
});
test('future optional editorial date is disabled by default and exact at the configured boundary',()=>{
 const env={ASTRA_FORECAST_COMPACT_START_DAY:'2026-11-10'};assert.equal(generateForecastForEnv({},'virgo','2026-11-10').free_text,old('virgo','2026-11-10').free_text);assert.equal(generateForecastForEnv(env,'virgo','2026-11-09').free_text,old('virgo','2026-11-09').free_text);assert.equal(generateForecastForEnv(env,'virgo','2026-11-10').free_text,generate('virgo','2026-11-10').free_text);assert.throws(()=>generateForecastForEnv({ASTRA_FORECAST_COMPACT_START_DAY:'2026-02-29'},'virgo','2026-11-10'),/Invalid compact/);
});
check('existing free/extended cache and paid snapshot remain byte-identical across editorial cutover',async f=>{
 await withClock('2026-11-10T09:00:00Z',async()=>{await getForecastDaily(f.env,'aries','2026-11-10');await purchaseForecast(f.env,1,'aries','2026-11-10');const daily=f.query('SELECT * FROM astra_forecast_daily'),paid=f.query('SELECT * FROM astra_forecast_unlocks'),ledger=f.db.prepare('SELECT * FROM astra_wallet_ledger').all();f.env.ASTRA_FORECAST_COMPACT_START_DAY='2026-11-10';await click(f,'forecast:read');assert.equal(last(f).text,daily.free_text);await click(f,'forecast:pay:2026-11-10');assert.equal(last(f).text,paid.result_text);assert.deepEqual(f.query('SELECT * FROM astra_forecast_daily'),daily);assert.deepEqual(f.query('SELECT * FROM astra_forecast_unlocks'),paid);assert.deepEqual(f.db.prepare('SELECT * FROM astra_wallet_ledger').all(),ledger);});
});
check('manual read caches compact once; one four-dust purchase and all replays use that saved version',async f=>{
 await withClock('2026-11-10T09:00:00Z',async()=>{f.env.ASTRA_FORECAST_COMPACT_START_DAY='2026-11-10';await click(f,'forecast:read');assert.equal(last(f).text,generate('aries','2026-11-10').free_text);const before=f.balance(1);await Promise.all(Array.from({length:20},()=>click(f,'forecast:pay:2026-11-10')));assert.equal(f.balance(1),before-4);assert.equal(f.query('SELECT count(*) n FROM astra_forecast_unlocks').n,1);assert.equal(f.query('SELECT count(*) n FROM astra_wallet_ledger WHERE reason=?','forecast:extended').n,1);assert.equal(last(f).text,generate('aries','2026-11-10').extended_text);const paid=f.query('SELECT * FROM astra_forecast_unlocks');delete f.env.ASTRA_FORECAST_COMPACT_START_DAY;await click(f,'forecast:repeat');assert.equal(last(f).text,paid.result_text);assert.equal(f.balance(1),before-4);});
});
check('invalid cutover cannot overwrite cached text and cannot insert uncached guesses or debit',async f=>{
 await withClock('2026-11-10T09:00:00Z',async()=>{const saved=await getForecastDaily(f.env,'aries','2026-11-10');f.env.ASTRA_FORECAST_COMPACT_START_DAY='bad';await click(f,'forecast:read');assert.equal(last(f).text,saved.free_text);});await withClock('2026-11-11T09:00:00Z',async()=>{const before=f.balance(1);assert.equal((await click(f,'forecast:read')).status,500);assert.equal(f.query('SELECT count(*) n FROM astra_forecast_daily').n,1);assert.equal(f.balance(1),before);});
});
check('old paid content for another selected sign still reopens for free without reinterpretation',async f=>{
 await withClock('2026-11-10T09:00:00Z',async()=>{await purchaseForecast(f.env,1,'virgo','2026-11-10');const paid=f.query('SELECT * FROM astra_forecast_unlocks'),before=f.balance(1);f.env.ASTRA_FORECAST_COMPACT_START_DAY='2026-11-10';await click(f,'forecast:pay:2026-11-10');assert.equal(last(f).text,paid.result_text);assert.equal(f.balance(1),before);});
});
test('final single-file generator agrees exactly with source and only changes the explicit presentation integration',()=>{
 const code=fs.readFileSync(new URL('../release/ASTRA_2_4_WORKER.js',import.meta.url),'utf8');const bundled=vm.runInNewContext(code.replace('export default {','globalThis.worker = {')+'\n;({generateForecastForEnv});',{structuredClone});
 for(const s of c.signs)for(const day of ['2026-11-08','2026-11-09','2026-11-10','2028-02-29']){const result=bundled.generateForecastForEnv({ASTRA_FORECAST_COMPACT_START_DAY:'2026-11-01'},s.sign_id,day),expected=generate(s.sign_id,day);for(const key of ['free_text','extended_text','number','source_tags','engine_version','content_version'])assert.equal(result[key],expected[key]);}
 const restored=code.replace("'ASTRA-2.4-task02'","'ASTRA-2.4-task01'").replace(/\n\/\/ TASK02: same symbolic selection, independently versioned editorial presentation\.[\s\S]*?\nconst astraWorker = \{/,'const astraWorker = {').replace("  const f=generate===generateForecast?generateForecastForEnv(env,sign,day,'ru'):generate(sign,day,'ru');","  const f=generate(sign,day,'ru');");assert.equal(sha(restored),'3e415a7d94dfb15977dfff55ff070f244665e4595e4c97ebe98a09e974a91e46');
});
check('manual and unchanged scheduled consumer share one cached presentation without granting activity',async f=>{
 await withClock('2026-11-10T06:00:00Z',async()=>{f.env.ASTRA_FORECAST_COMPACT_START_DAY='2026-11-10';await click(f,'forecast:read');const text=last(f).text,before=f.balance(1);await f.bot.scheduled({},f.env);assert.equal(last(f).text,text);assert.equal(f.balance(1),before);assert.equal(f.query('SELECT count(*) n FROM astra_bonus_days26').n,0);assert.equal(f.query('SELECT count(*) n FROM astra_forecast_daily').n,1);});
});
test('curated meaning fusions remove echoes without selecting another block or losing either source',()=>{
 assert.equal(Object.keys(e.fusions).length,16);const used=new Set();for(let i=0;i<90;i++)for(const s of c.signs){const f=generate(s.sign_id,new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10));for(const row of f.document.sections)if(row.fusion){used.add(row.fusion);assert.ok(row.text.startsWith(e.fusions[row.fusion].text));assert.deepEqual(row.sources.slice(0,2),e.fusions[row.fusion].sources);}}assert.equal(used.size,16);
 const bad=structuredClone(e);Object.values(bad.fusions)[0].source_fingerprints[0]++;assert.throws(()=>createCompactForecastGenerator(c,bad),/fusion/);
});
check('all twelve sign samples are delivered by the actual Worker and match source for free and paid texts',async f=>{
 await withClock('2026-11-10T09:00:00Z',async()=>{f.env.ASTRA_FORECAST_COMPACT_START_DAY='2026-11-10';for(const sign of c.signs){f.db.prepare('UPDATE astra_users SET zodiac=? WHERE telegram_id=1').run(sign.sign_id);await click(f,'forecast:read');assert.equal(last(f).text,generate(sign.sign_id,'2026-11-10').free_text);}
 // Each sign has its own cache; a separate synthetic owner buys each version of this same day.
 for(let i=0;i<c.signs.length;i++){const sign=c.signs[i],id=i+10;f.db.prepare('INSERT INTO astra_users(telegram_id,zodiac) VALUES(?,?)').run(id,sign.sign_id);f.db.prepare("INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES(?,?,4,'test:review-funds')").run('review:'+id,id);f.db.prepare('UPDATE astra_users SET balance=4 WHERE telegram_id=?').run(id);await click(f,'forecast:pay:2026-11-10',id);assert.equal(last(f).text,generate(sign.sign_id,'2026-11-10').extended_text);assert.equal(f.balance(id),0);}
 });
});
test('a compatible yet unselected lens cannot supply a practical instruction',()=>{
 const f=generate('virgo','2026-11-08'),sign=c.signs.find(s=>s.sign_id==='virgo'),theme=c.themes.find(t=>t.id===f.trace.theme),doc=structuredClone(f.document),selected=[...f.trace.units,...f.trace.sign_lenses,...f.trace.modality_lenses];assert.ok(!selected.includes('virgo.action.lens.2'));doc.sections[5].sources[1]='virgo.action.lens.2';assert.throws(()=>validateEditorialDocument(doc,source,sign,theme,f.trace.directives,selected),/Unattributed/);
});
