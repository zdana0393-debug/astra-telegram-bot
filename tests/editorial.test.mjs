import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture} from './helpers.mjs';
const oldSource=fs.readFileSync(new URL('../release/ASTRA_2_2_WORKER.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../release/ASTRA_2_3_EDITORIAL_WORKER.js',import.meta.url),'utf8');
function corpus(text) {
  let i=0;
  return vm.runInNewContext(text.replace('export default {','globalThis.worker = {')+'\n;({ZODIAC,TAROT,PHRASES,FAQ,forecast,dayCard,threeCardSpread,hash});',{
    Intl,Date,crypto:{getRandomValues(a){a[0]=i++;a[1]=i%2;return a;}},
  });
}
const old=corpus(oldSource),copy=corpus(source);
const check=(name,fn)=>test(name,async()=>{const f=fixture({editorial:true});try{await fn(f);}finally{f.close();}});
const page=async(f,data,mid=90)=>{const q=f.click(1,mid);q.callback_query.data='shell:'+data;assert.equal((await f.hook(q)).status,200);return f.out.filter(x=>x.method==='sendMessage').at(-1).body;};
const joinFaq=n=>copy.FAQ[n].join('\n');
check('ordinary screens no longer explain fiction or use childish bureaucracy',async f=>{
  f.user(1);for(const name of ['home','about','manifest','team','forecast','self','dossier','dust','tarot','notifications','forecast:future','dust:shop']){
    const body=await page(f,name);assert.doesNotMatch(body.text,/художественн|вымышленн|персонажи легенды|авторский мир|космическое бюро|ваше дело|небесн|волшебств|хранительниц/iu,name);
    assert.doesNotMatch(body.text,/оккультн|введите\s+gpt6|код\s+gpt6/iu,name);assert.equal(body.parse_mode,undefined);assert.ok(body.text.length<=4096,name);
    assert.doesNotMatch(body.text,/─{3,}/u,name);
  }assert.equal(f.balance(1),20);
});
check('team retains GPT6, professional disciplines and an engineer after the four key lines',async f=>{
  f.user(1);const body=await page(f,'team');const lines=body.text.split('\n').filter(s=>/^(Gideon|Percival|Thalia|6th|Elias|M\.)/.test(s));
  assert.equal(lines.slice(0,4).map(s=>s[0]).join(''),'GPT6');assert.match(lines[0],/астрологических соответствий/);
  assert.match(lines[1],/планетарным циклам/);assert.match(lines[2],/таролог.*Старшим арканам/);
  assert.match(lines[3],/нумерологической классификации/);assert.match(lines[4],/^Elias Voss — инженер программной архитектуры и информационных систем/);
  assert.match(lines[5],/^M\. Ejaculatum — анонимный консультант по астрологии, нумерологии и сравнительной эзотерике\.$/);
  assert.doesNotMatch(body.text,/псевдоним|вымышленн|GPT6|лиценз|сертифиц/iu);
});
test('FAQ combines actual computing terms with astrological and tarot contexts',()=>{
  const forecast=joinFaq(0),mechanism=joinFaq(1),wallet=joinFaq(4);
  for(const word of ['тропическ','стихии','модальности','управител','эфемерид','транзит'])assert.match(forecast,new RegExp(word,'iu'));
  for(const word of ['Cloudflare Workers','webhook Telegram','D1','идемпотентность','атомарные операции SQL','триггеры'])assert.ok(mechanism.toLowerCase().includes(word.toLowerCase()),word);
  for(const word of ['22 Старших арканов','три разные','прямое или перевёрнутое','позиции','без новой платы'])assert.ok(mechanism.toLowerCase().includes(word.toLowerCase()),word);
  assert.match(wallet,/журнал/iu);assert.match(wallet,/атомарно/iu);assert.match(wallet,/ключи идемпотентности/iu);
});
test('number method is hash of sign/date and explicitly not digital-root or birth calculation',()=>{
  const text=joinFaq(0);assert.ok(text.includes('hash(sign + day) % 9 + 1'));
  assert.match(text,/не цифровой корень даты и не число жизненного пути/iu);assert.match(text,/символический индекс от 1 до 9/iu);
  assert.match(text,/не астрономическая величина/iu);
});
test('FAQ boundaries distinguish absent calculations from traditional vocabulary',()=>{
  assert.match(joinFaq(0),/Расчёт эфемерид, реальных транзитов и натальных аспектов.*не выполняется/iu);
  assert.match(joinFaq(9),/не рассчитывает положения планет, Асцендент, дома, транзиты или фазу Луны/iu);
  assert.match(joinFaq(2),/Младшие арканы.*не входят/iu);assert.match(joinFaq(2),/не ко всем историческим школам/iu);
  assert.match(joinFaq(7),/эти услуги не предоставляются/iu);assert.match(joinFaq(10),/не принимает Stars/iu);
});
check('FAQ index and short answer describe collaboration without disclosing authorship',async f=>{
  f.user(1,2);
  const index=await page(f,'faq');
  assert.ok(index.text.includes(copy.FAQ[8][0]));assert.ok(index.text.includes(copy.FAQ[8][1]));
  const link=index.reply_markup.inline_keyboard.flat().find(b=>b.callback_data==='shell:faq:8:more');
  assert.equal(link.text,copy.FAQ[8][0]);
  const short=await page(f,'faq:8');
  for(const body of [index,short]) {
    assert.match(body.text,/редакци/iu);assert.match(body.text,/инженерн/iu);
    assert.doesNotMatch(body.text,/один создатель|одним человеком|помощ(?:ь|ью) ИИ|псевдоним|вымышленн|реальн.{0,20}штат/iu);
  }
  assert.match(short.text,/обработку запросов, хранение результатов и согласованность учёта/iu);
  assert.equal(f.balance(1),2);assert.equal(f.reconcile(),0);
});
check('detailed authorship answer stays honest about the real creator and editorial roles',async f=>{
  f.user(1,2);const detailed=await page(f,'faq:8:more');
  assert.ok(detailed.text.endsWith(copy.FAQ[8][2]));
  assert.match(copy.FAQ[8][2],/один создатель.*помощью ИИ/iu);
  assert.match(detailed.text,/Elias Voss.*инженерную роль/iu);
  assert.match(detailed.text,/Имена на странице команды не являются биографиями независимого штата или свидетельством внешней аккредитации/iu);
  assert.equal(f.balance(1),2);assert.equal(f.reconcile(),0);
});
test('external delivery caveat is retained in relevant technical answers',()=>{
  assert.match(joinFaq(1),/Telegram может повторить сообщение/iu);assert.match(joinFaq(1),/не означают гарантии однократной внешней доставки/iu);
  assert.match(joinFaq(10),/не гарантия.*Telegram.*только один раз/iu);
  assert.doesNotMatch(copy.FAQ.map(f=>f.join('\n')).join('\n'),/гарантируем.{0,50}(?:точность|безотказность)|доставка строго один раз/iu);
});
test('SQL statements, legacy callback payloads and purchase identifiers are byte-for-byte unchanged',()=>{
  const sql=text=>Array.from(text.matchAll(/\bprepare\(((?:`[^`]*`)|(?:"(?:\\.|[^"\\])*?")|(?:'(?:\\.|[^'\\])*?'))\)/g),m=>m[1]);
  assert.ok(sql(source).length>=20);assert.deepEqual(sql(source),sql(oldSource));
  const direct=text=>Array.from(text.matchAll(/callback_data:\s*(['`])([^\n]*?)\1/g),m=>m[2]);assert.deepEqual(direct(source),direct(oldSource));
  const routes=text=>Array.from(text.matchAll(/button\((?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*,\s*(['`])([^\n]*?)\1\)/g),m=>m[2]);
  assert.equal(routes(oldSource).length,28);assert.deepEqual(routes(source),routes(oldSource));
  for(const formula of ['hash(sign + day) % 9 + 1','now+60000','now+30000',"const requestKey=`tarot:${id}:${key}`",'schema?.n===16'])assert.ok(source.includes(formula),formula);
});
test('free day number is identical to 2.2 for every sign across representative dates',()=>{
  for(const [sign] of copy.ZODIAC)for(const date of ['2026-01-01','2026-11-06','2026-12-31','2027-01-01']){
    const current=copy.forecast(sign,date),prior=old.forecast(sign,date);
    assert.equal(current.match(/🔢 Число дня: ([1-9])/)[1],prior.match(/🔢 Число дня: ([1-9])/)[1]);
    for(const field of ['Тема дня:','Отношения:','Работа и дела:','Рекомендация:'])assert.ok(current.includes(field));
    assert.ok(current.length<4096);assert.equal(current,copy.forecast(sign,date));
  }
});
test('22 card identities, stable daily card and three-card random choices survive copy editing',()=>{
  assert.deepEqual(Array.from(copy.TAROT,c=>c[0]),Array.from(old.TAROT,c=>c[0]));assert.equal(copy.TAROT.length,22);
  for(const id of [1,2,101,102])for(const day of ['2026-11-06','2026-11-07']){
    const current=copy.dayCard(id,day),prior=old.dayCard(id,day);const name=copy.TAROT.find(c=>prior.includes(c[0]))[0];
    assert.ok(current.includes(name));assert.equal(current.includes('(перевёрнутая)'),prior.includes('(перевёрнутая)'));assert.equal(current,copy.dayCard(id,day));
  }
  const originalSpread=old.threeCardSpread(),editedSpread=copy.threeCardSpread();
  const names=text=>Array.from(copy.TAROT,c=>c[0]).filter(n=>text.includes(n));assert.deepEqual(names(editedSpread),names(originalSpread));assert.equal(names(editedSpread).length,3);
  for(const c of copy.TAROT)for(const meaning of c.slice(1)){assert.ok(meaning.length>35);assert.doesNotMatch(meaning,/обречён|смерть человека|неизбежн.*болезн|лечит|изменяет вам/iu);}
});
check('all short and detailed FAQ pages stay navigable, readable and noncharging',async f=>{
  f.user(1,2);const index=await page(f,'faq');assert.ok(index.text.length<4096);
  for(let i=0;i<copy.FAQ.length;i++)for(const suffix of ['',':more']){
    const body=await page(f,`faq:${i}${suffix}`);assert.ok(body.text.length<4096);assert.ok(body.reply_markup.inline_keyboard.flat().some(b=>b.callback_data==='shell:home'));
    for(const b of body.reply_markup.inline_keyboard.flat())assert.ok(Buffer.byteLength(b.callback_data)<=64);
  }assert.equal(f.balance(1),2);assert.equal(f.reconcile(),0);
});
check('already saved 2.2 result is returned verbatim and not rewritten or billed',async f=>{
  f.user(1,6);const saved='Сохранённый текст Astra 2.2: три аркана, прежние трактовки.';
  f.db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result,delivery) VALUES('tarot:1:80',1,'tarot',-3,?,'unknown')").run(saved);
  assert.equal(f.balance(1),3);const body=await page(f,'tarot:last');assert.equal(body.text,saved);
  const q=f.click(1,80);await f.hook(q);assert.equal(f.out.at(-1).body.text,saved);assert.equal(f.balance(1),3);assert.equal(f.reconcile(),0);
});
check('private commands and responses disclose actual data without revealing the secret code',async f=>{
  f.user(1,2);for(const command of ['/start','/help','/privacy','/stop']){
    assert.equal((await f.hook(f.message(1,command))).status,200);const text=f.out.at(-1).body.text;
    assert.ok(text.length<=4096);assert.doesNotMatch(text,/gpt6|вымышленн|художественн|архив открыл дело/iu);
    if(command==='/privacy'){assert.match(text,/D1/);assert.match(text,/Номера обработанных обновлений без Telegram ID/iu);assert.match(text,/резервные копии не удаляются/iu);}
  }
});
check('new reward wording is discreet and still posts +5 exactly once',async f=>{
  f.user(1,2);await f.hook(f.message(1,'gpt6'));const first=f.out.at(-1).body.text;assert.match(first,/Начислено: \+5 ✨/u);
  assert.doesNotMatch(first,/художественн|легенд|квест|архив открыл дело/iu);await f.hook(f.message(1,' GPT6 '));assert.equal(f.balance(1),7);assert.equal(f.reconcile(),0);
});
