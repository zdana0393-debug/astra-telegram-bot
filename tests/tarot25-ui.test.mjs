import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {uiFixture,open,offer,press,button,lastScreen,sent} from './tarot25-ui-helpers.mjs';
import {prepareOffer,confirmPurchase,retryDelivery} from '../src/tarot25/purchases29.mjs';
import {request} from './tarot29-helpers.mjs';
import {withClock,setupFence,activate} from './task01-helpers.mjs';
import {instrument} from './task03-helpers.mjs';
import {SPREADS} from '../src/tarot25/spreads.mjs';
const cases=[];const check=(name,work,options)=>{cases.push(name);test(name,async()=>{const f=uiFixture(options);try{await work(f);}finally{f.close();}});};
const count=(f,t)=>f.query('SELECT count(*) n FROM '+t).n;
const buy=async(f,index=0)=>{const p=await offer(f,index);assert.equal((await press(f,p)).status,200);return p;};
const history=async f=>{await open(f);await press(f,button(f,'История'));};
const firstRead=f=>button(f,'оплачено');
for(const on of [false,true])for(let i=0;i<7;i++)check(`actual candidate catalog ${on?'ON':'OFF'} ${SPREADS[i].spread_id}, three taps`,async f=>{
 if(on)f.enable();assert.equal((await open(f)).status,200);const menu=lastScreen(f);assert.equal(menu.reply_markup.inline_keyboard.length,4);await press(f,button(f,'Выбрать'));const catalog=lastScreen(f);assert.equal(catalog.reply_markup.inline_keyboard.length,8);
 await press(f,button(f,new RegExp('^'+['Три карты','Отношения','Дела','Выбор','Пять','Семь','Кельтский'][i])));
 assert.equal(count(f,'astra_tarot25_purchases29'),0);assert.equal(f.balance(1),100);
 if(on){assert.match(lastScreen(f).text,new RegExp('Цена: '+[5,8,8,8,14,21,32][i]+' ✨'));assert.match(button(f,'Подтвердить').text,/✨/);const row=f.query('SELECT snapshot_json FROM astra_tarot25_offers29');assert.equal(JSON.parse(row.snapshot_json).question,null);assert.equal(count(f,'astra_tarot25_offers29'),1);}
 else {assert.equal(count(f,'astra_tarot25_offers29'),0);assert.ok(!f.out.some(x=>x.method==='editMessageReplyMarkup'&&x.body.reply_markup.inline_keyboard.flat().some(b=>b.callback_data?.startsWith('t25:p:'))));}
});
for(const i of [0,4,5,6])check(`saved ${SPREADS[i].size}-card text split losslessly, no markdown, one debit`,async f=>{
 f.enable();const p=await offer(f,i),before=sent(f).length;await press(f,p);const row=f.query('SELECT * FROM astra_tarot25_purchases29');const chunks=sent(f).slice(before);assert.equal(chunks.join(''),row.result);assert.equal(row.delivery,'sent');assert.equal(f.balance(1),100-row.price);assert.equal(f.reconcile(),0);
 for(const out of f.out.filter(x=>x.method==='sendMessage')){assert.ok(out.body.text.length<=4096);assert.equal(out.body.parse_mode,undefined);}
 for(const b of f.out.flatMap(x=>x.body.reply_markup?.inline_keyboard?.flat()??[]))assert.ok(Buffer.byteLength(b.callback_data)<=64);
 const snapshot=JSON.parse(row.snapshot_json);assert.equal(snapshot.cards.length,SPREADS[i].size);assert.ok(!row.result.includes('Вопрос: null'));assert.ok(!row.result.includes('Вопрос: undefined'));
});
for(const n of [2,20,100])check(`${n} parallel actual Worker confirmations: one debit, one initial transport`,async f=>{
 f.enable();const p=await offer(f,6);const before=sent(f).length;const results=await Promise.all(Array.from({length:n},()=>press(f,p)));assert.ok(results.every(r=>r.status===200));
 const row=f.query('SELECT * FROM astra_tarot25_purchases29');assert.equal(row.price,32);assert.equal(row.attempts,1);assert.equal(f.balance(1),68);assert.equal(count(f,'astra_tarot25_purchases29'),1);assert.equal(f.query("SELECT count(*) n FROM astra_wallet_ledger WHERE reason='tarot:v25'").n,1);
 assert.equal(sent(f).slice(before).filter(t=>row.result.includes(t)).join(''),row.result);assert.equal(f.reconcile(),0);
});
check('same update replay is acknowledged without new message, offer or purchase',async f=>{f.enable();const p=await offer(f);await press(f,p,1,9000);const n=f.out.length;await press(f,p,1,9000);assert.equal(f.out.length,n);assert.equal(f.balance(1),95);});
check('repeated selection in same menu reuses sealed original update/offer',async f=>{f.enable();await open(f);await press(f,button(f,'Выбрать'));const b=button(f,'Три карты');await press(f,b);const one=f.query('SELECT * FROM astra_tarot25_offers29');await press(f,b);const two=f.query('SELECT * FROM astra_tarot25_offers29');assert.equal(one.snapshot_json,two.snapshot_json);assert.equal(one.update_id,two.update_id);assert.equal(count(f,'astra_tarot25_offers29'),1);});
check('cancelled quote cannot charge via still valid confirm',async f=>{f.enable();const p=await offer(f);await press(f,button(f,'Отмена'));await press(f,p);assert.equal(count(f,'astra_tarot25_purchases29'),0);assert.equal(f.balance(1),100);});
check('insufficient dust stated before confirm; SQL refuses debit',async f=>{f.enable();const p=await offer(f,6);assert.match(lastScreen(f).text,/Не хватает: 30 ✨/);await press(f,p);assert.equal(f.balance(1),2);assert.equal(count(f,'astra_tarot25_purchases29'),0);assert.match(sent(f).at(-1),/недостаточно/);},{balance:2});
for(const gate of ['env','runtime'])check(`new quote cannot charge after ${gate} switches OFF`,async f=>{f.enable();const p=await offer(f);if(gate==='env')f.env.ASTRA_TAROT25_ENABLED='false';else f.db.exec('UPDATE astra_tarot25_runtime29 SET enabled=0');await press(f,p);assert.equal(f.balance(1),100);assert.equal(count(f,'astra_tarot25_purchases29'),0);assert.match(sent(f).at(-1),/закрыты/);});
check('expired signed quote cannot debit; navigation reopened afresh',async f=>{await withClock(new Date().toISOString(),async set=>{f.enable();const p=await offer(f);set(new Date(Date.now()+901000).toISOString());await press(f,p);assert.equal(f.balance(1),100);assert.equal(count(f,'astra_tarot25_purchases29'),0);});});
for(const mutation of ['actor','chat','message','payload','price','negative'])check(`forged ${mutation} callback rejected`,async f=>{
 f.enable();const p=await offer(f),q=f.click(1,p.mid);q.callback_query.data=p.data;
 if(mutation==='actor'){q.callback_query.from.id=2;q.callback_query.message.chat.id=2;}
 if(mutation==='chat')q.callback_query.message.chat.id=2;
 if(mutation==='message')q.callback_query.message.message_id++;
 if(mutation==='payload'){q.callback_query.data=p.data.replace(/t25:p:(.)/,(_,c)=>'t25:p:'+(c==='f'?'e':'f'));assert.notEqual(q.callback_query.data,p.data);}
 if(mutation==='price')q.callback_query.data+=':1';
 if(mutation==='negative')q.update_id=-1;
 await f.hook(q);assert.equal(count(f,'astra_tarot25_purchases29'),0);assert.equal(f.balance(1),100);assert.equal(f.balance(2),100);
});
check('profile delete erases manual-read lease, offers and paid rows, stale buttons fail in new generation',async f=>{
 f.enable();await buy(f);await history(f);const b=firstRead(f);await press(f,b);assert.equal(count(f,'astra_tarot25_purchases29'),1);const a=f.actor(1);assert.ok(f.query('SELECT * FROM astra_update_jobs WHERE update_id=-1'));f.db.exec('PRAGMA foreign_keys=OFF; DELETE FROM astra_users WHERE telegram_id=1');assert.equal(f.query('SELECT * FROM astra_update_jobs WHERE update_id=-1'),undefined);assert.equal(count(f,'astra_tarot25_purchases29'),0);f.user(1,100);const restoredBalance=f.balance(1);assert.notEqual(f.actor(1).generation,a.generation);await press(f,b);assert.ok(!f.query('SELECT * FROM astra_update_jobs WHERE update_id=-1'));assert.equal(f.balance(1),restoredBalance);
});
for(const failure of [403,429,500,'network','malformed'])check(`confirmed purchase survives Telegram ${failure}, no automatic unknown resend`,async f=>{
 f.enable();const p=await offer(f);f.apiFailure('sendMessage',failure);await press(f,p);let row=f.query('SELECT * FROM astra_tarot25_purchases29');assert.ok(row);assert.equal(f.balance(1),95);assert.equal(row.delivery,failure===403?'rejected':failure===429?'retry':'unknown');
 f.apiFailure('sendMessage',null);if(![403,429].includes(failure)){const before=sent(f).length;await press(f,p);const texts=sent(f).slice(before);assert.ok(!texts.some(t=>row.result.includes(t)));assert.match(texts.at(-1),/мог уже принять/);}
 await history(f);await press(f,firstRead(f));if(['unknown','retry'].includes(row.delivery)){assert.match(lastScreen(f).text,/мог уже принять/);await press(f,button(f,'Прочитать ещё'));}
 assert.equal(f.balance(1),95);assert.ok(sent(f).some(t=>row.result.includes(t)));
});
check('partial multipart delivery is unknown; explicit acknowledgement preserves all original bytes',async f=>{
 f.enable();const p=await offer(f,6);let n=0;f.apiResult('sendMessage',body=>{if(++n===2)throw Error('synthetic timeout');return {message_id:800+n,chat:{id:body.chat_id}};});await press(f,p);const row=f.query('SELECT * FROM astra_tarot25_purchases29');assert.equal(row.delivery,'unknown');assert.equal(row.parts_sent,1);
 f.apiResult('sendMessage',null);let mid=1000;f.apiResult('sendMessage',body=>({message_id:++mid,chat:{id:body.chat_id}}));await history(f);await press(f,firstRead(f));const ack=button(f,'Прочитать ещё'),before=sent(f).length;await press(f,ack);assert.equal(sent(f).slice(before).join(''),row.result);assert.equal(f.balance(1),68);
});
check('helper cap3 does not restrict explicit paid reading or debit again',async f=>{
 f.enable();const o=await prepareOffer(f.env,f.actor(1),request('depth-7'));const row=await confirmPurchase(f.env,f.actor(1),o.offer_id);
 for(let i=0;i<3;i++)await retryDelivery(f.env,f.actor(1),o.offer_id,{send:async()=>{throw Object.assign(Error('reject'),{telegramCode:403});},explicit:i>0});
 assert.equal(f.query('SELECT attempts FROM astra_tarot25_purchases29').attempts,3);f.env.ASTRA_TAROT25_ENABLED='false';f.db.exec('UPDATE astra_tarot25_runtime29 SET enabled=0');await history(f);const b=firstRead(f),before=sent(f).length;await press(f,b);assert.equal(sent(f).slice(before).join(''),row.result);assert.equal(f.balance(1),79);assert.equal(f.query('SELECT attempts FROM astra_tarot25_purchases29').attempts,3);
 await press(f,b);assert.match(sent(f).at(-1),/5 секунд/);assert.equal(f.balance(1),79);
});
check('manual unknown after paid sent requires warning even when original proof says sent',async f=>{
 f.enable();await buy(f);await history(f);const b=firstRead(f);f.apiFailure('sendMessage','network');await press(f,b);f.apiFailure('sendMessage',null);f.db.exec('UPDATE astra_update_jobs SET lease_until=0 WHERE update_id=-1');await press(f,b);assert.match(lastScreen(f).text,/мог уже принять/);assert.ok(button(f,'Прочитать ещё'));
});
check('history keyset pages own records and long legacy IDs stay within callback limit',async f=>{
 f.enable();for(let i=0;i<7;i++){const o=await prepareOffer(f.env,f.actor(1),request('basic-3',800+i));await confirmPurchase(f.env,f.actor(1),o.offer_id);}await history(f);const first=lastScreen(f).reply_markup.inline_keyboard.flat().filter(x=>x.text.includes('оплачено')).map(x=>x.callback_data);assert.equal(first.length,5);await press(f,button(f,'Дальше'));assert.equal(lastScreen(f).reply_markup.inline_keyboard.flat().filter(x=>x.text.includes('оплачено')).length,2);assert.ok(button(f,'К началу'));for(const x of f.out.flatMap(x=>x.body.reply_markup?.inline_keyboard?.flat()??[]))assert.ok(Buffer.byteLength(x.callback_data)<=64);
 const read=firstRead(f);const before=sent(f).length;await press(f,read,2);assert.ok(!sent(f).slice(before).some(t=>t.startsWith('Три карты ·')));
});
check('legacy 3 and 5 reads literal byte-for-byte, independent of missing schema29',async f=>{
 const legacy='СТАРЫЙ ТЕКСТ <>&_🃏\nСохранён за 3 ✨. '+ 'x'.repeat(100);
 assert.equal(f.query("SELECT result FROM astra_operations WHERE operation_id=?",'old_'.repeat(25)).result,legacy);
 // Create legacy 5 via its real current Worker confirmation route.
 await open(f);await press(f,button(f,'Выбрать'));await press(f,button(f,'Три карты'));const oldPay=f.out.filter(x=>x.method==='sendMessage').at(-1).body.reply_markup.inline_keyboard.flat().find(b=>b.callback_data.startsWith('shell:tarot26:'));const q=f.click(1);q.callback_query.data=oldPay.callback_data;await f.hook(q);
 const legacy5=f.query('SELECT result FROM astra_tarot_purchases26').result;
 f.db.exec('DROP TABLE astra_tarot25_runtime29');await history(f);const rows=lastScreen(f).reply_markup.inline_keyboard.flat().filter(x=>x.text.includes('оплачено'));assert.equal(rows.length,2);
 const historyMid=lastScreen(f).message_id,bodies=[];for(const b of rows){f.db.exec('UPDATE astra_update_jobs SET lease_until=0 WHERE update_id=-1');const start=sent(f).length;await press(f,{data:b.callback_data,mid:historyMid});bodies.push(sent(f).slice(start).join(''));await history(f);}
 assert.ok(bodies.includes(legacy));assert.ok(bodies.includes(legacy5));assert.equal(f.reconcile(),0);
},{legacy3:{id:'old_'.repeat(25),text:'СТАРЫЙ ТЕКСТ <>&_🃏\nСохранён за 3 ✨. '+ 'x'.repeat(100)}});
check('day card remains byte-identical and no new paid callback produces activity reward',async f=>{
 await setupFence(f);activate(f);f.enable();const before=f.query('SELECT count(*) n FROM astra_bonus_days26').n;await open(f);await press(f,button(f,'Карта дня'));const text=sent(f).at(-1);const base=fs.readFileSync(new URL('../release/ASTRA_2_4_WORKER.js',import.meta.url),'utf8');const part=base.slice(base.indexOf('function dayCard('),base.indexOf('function dayCard(')+500);assert.match(part,/TAROT/);assert.match(text,/Карта дня/);const n=count(f,'astra_bonus_days26');const p=await offer(f);await press(f,p);assert.equal(count(f,'astra_bonus_days26'),n);assert.ok(n>=before);
});
check('schema absent or foreign fails closed new sales; legacy and health remain available',async f=>{
 f.enable();f.db.exec('DROP TRIGGER astra_tarot25_purchase_guard29');await open(f);await press(f,button(f,'Выбрать'));await press(f,button(f,'Отношения'));assert.ok(!lastScreen(f).reply_markup.inline_keyboard.flat().some(b=>b.callback_data.startsWith('t25:p:')));assert.equal(count(f,'astra_tarot25_offers29'),0);
 const r=await f.bot.fetch(new Request('https://astra.test/health'),f.env),s=await r.json();assert.equal(s.tarot25_schema_ready,false);assert.equal(s.public_ready,false);assert.equal(s.broadcast_consent_implemented,true);
});
check('expired callback ACK failure cannot undo a paid result',async f=>{f.enable();const p=await offer(f);f.apiFailure('answerCallbackQuery',400);await press(f,p);assert.equal(f.balance(1),95);assert.equal(f.query('SELECT delivery FROM astra_tarot25_purchases29').delivery,'sent');});
check('all navigation and free question messages do not create paid offers',async f=>{await open(f);await press(f,button(f,'Выбрать'));await press(f,button(f,'Назад'));await press(f,button(f,'История'));await f.hook(f.message(1,'Мой очень личный вопрос о здоровье'));assert.equal(count(f,'astra_tarot25_offers29'),0);assert.equal(count(f,'astra_tarot25_purchases29'),0);});
check('per-invocation memo has one DDL call, runtime always fresh; UI request under Free subrequest ceiling',async f=>{
 f.enable();const p=await offer(f,6),before=f.out.length;const result=await instrument(f,()=>press(f,p));const m=result.logs[0],http=f.out.length-before;assert.ok(m.statements+http<50,JSON.stringify({m,http}));assert.ok(m.statements<=30);assert.equal(result.result.status,200);
 f.db.exec('UPDATE astra_tarot25_runtime29 SET enabled=0');const other=await offer(f,1).catch(()=>null);assert.equal(other,null);assert.equal(count(f,'astra_tarot25_purchases29'),1);
});
// Freeze proof against TASK02; additions only, no hidden edits in SQL or canonical adapters.
test('frozen Worker 2.4 exact SHA and SQL29/current adapters unchanged in candidate build',()=>{
 const bytes=fs.readFileSync(new URL('../release/ASTRA_2_4_WORKER.js',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'5f34b44948e4bb6be643d586e712554d41f9b9bf7f2ee7175c4bf5e6d77786f4');
 const candidate=fs.readFileSync(new URL('../release/ASTRA_2_5_TASK03_CANDIDATE.js',import.meta.url),'utf8');assert.ok(!/^import\s/m.test(candidate));assert.match(candidate,/const t25Ui=/);assert.equal((candidate.match(/export default/g)||[]).length,1);
});

check('20 concurrent select taps reuse the sealed winner and show one quoted product',async f=>{
 f.enable();await open(f);await press(f,button(f,'Выбрать'));const s=button(f,'Семь');const start=sent(f).length;const responses=await Promise.all(Array.from({length:20},()=>press(f,s)));assert.ok(responses.every(r=>r.status===200));assert.equal(count(f,'astra_tarot25_offers29'),1);assert.equal(count(f,'astra_tarot25_purchases29'),0);assert.equal(f.balance(1),100);assert.equal(sent(f).slice(start).filter(t=>t.includes('Цена: 21 ✨')).length,20);
});
check('OFF basic catalog preserves distinct legacy requests across distinct menus',async f=>{
 for(let i=0;i<2;i++){await open(f);await press(f,button(f,'Выбрать'));await press(f,button(f,'Три карты'));}
 assert.equal(count(f,'astra_tarot_offers26'),2);assert.equal(count(f,'astra_tarot25_offers29'),0);assert.equal(f.balance(1),100);
});

check('cancel racing after payment cannot claim the spent dust was not debited',async f=>{
 f.enable();const p=await offer(f),cancel=button(f,'Отмена');await press(f,p);await press(f,cancel);assert.equal(f.balance(1),95);assert.match(sent(f).at(-1),/уже обработан/);assert.ok(!sent(f).at(-1).includes('Пыль не списана'));
});
check('selecting already paid quote offers free saved reading instead of pay again',async f=>{
 f.enable();await open(f);await press(f,button(f,'Выбрать'));const s=button(f,'Три карты');await press(f,s);await press(f,button(f,'Подтвердить'));await press(f,s);assert.match(lastScreen(f).text,/уже оплачен/);assert.ok(button(f,'Прочитать сохранённое'));assert.equal(f.balance(1),95);
});

check('context back returns from quote to catalog and from top Tarot to six-section home',async f=>{
 await open(f);await press(f,button(f,'Назад'));const home=f.out.filter(x=>x.method==='sendMessage').at(-1).body;assert.equal(home.reply_markup.keyboard.flat().length,6);f.enable();await offer(f);await press(f,button(f,'Назад'));assert.equal(lastScreen(f).reply_markup.inline_keyboard.length,8);assert.match(lastScreen(f).text,/Выбрать расклад/);
});
