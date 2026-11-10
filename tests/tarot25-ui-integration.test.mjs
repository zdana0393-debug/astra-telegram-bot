import {test} from 'node:test';import assert from 'node:assert/strict';
import oldBot from '../release/ASTRA_2_4_WORKER.js';
import {uiFixture,open,offer,press,button,lastScreen,sent} from './tarot25-ui-helpers.mjs';
import {withClock,setupFence,activate} from './task01-helpers.mjs';
import {optin,enableDelivery,cron,instrument} from './task06-helpers.mjs';
const check=(name,work)=>test(name,async()=>{const f=uiFixture();try{await work(f);}finally{f.close();}});
const hookOld=(f,update)=>oldBot.fetch(new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':f.env.ASTRA_WEBHOOK_SECRET},body:JSON.stringify(update)}),f.env);
const shell=async(f,page)=>{const q=f.click(1);q.callback_query.data='shell:'+page;return f.hook(q);};
check('actual candidate and frozen 2.4 free day card byte identity on same Moscow day',async f=>{await withClock('2026-11-10T22:30:00Z',async()=>{const q=f.click(1);q.callback_query.data='tarot:day';await hookOld(f,q);const old=sent(f).at(-1);await open(f);await press(f,button(f,'Карта дня'));assert.equal(sent(f).at(-1),old);assert.match(old,/2026-11-11/);});});
for(const label of ['🔮 Гороскоп','✨ Баланс','🎁 Бонус дня','👥 Пригласить друга','🌟 Канал','🌙 Прогноз дня','🪞 Познай себя','🗂 Досье','✨ Звёздная пыль','🏛 Об Астре'])check('unchanged actual menu '+label,async f=>{const q=f.message(1,label);await hookOld(f,q);const before=f.out.filter(x=>x.method==='sendMessage').map(x=>x.body.text);f.out.length=0;await f.hook(f.message(1,label));const after=sent(f);assert.deepEqual(after,before);});
check('existing forecast 4 bought once, same saved extended body on candidate and old Worker',async f=>{
 await withClock('2026-11-10T06:00:00Z',async()=>{await shell(f,'forecast:extended');const b=f.out.filter(x=>x.method==='sendMessage').at(-1).body.reply_markup.inline_keyboard.flat().find(x=>x.callback_data.startsWith('shell:forecast:pay:'));assert.ok(b);const q=f.click(1);q.callback_query.data=b.callback_data;await f.hook(q);assert.equal(f.balance(1),96);const saved=f.query('SELECT * FROM astra_forecast_unlocks');await shell(f,'forecast:owned:2026-11-10');const a=sent(f).at(-1);const r=f.click(1);r.callback_query.data='shell:forecast:owned:2026-11-10';await hookOld(f,r);assert.equal(sent(f).at(-1),a);assert.deepEqual(f.query('SELECT * FROM astra_forecast_unlocks'),saved);assert.equal(f.balance(1),96);});
});
for(const n of [8,20,100])check(`actual candidate inherited consent28/Cron ${n} mixed subscribers`,async f=>{
 for(let i=3;i<=n;i++)f.user(i,0);let expected=0;for(let i=1;i<=n;i++){if(i%4===0){await optin(f,i);expected++;}if(i%4===2){await optin(f,i);await f.hook(f.message(i,'/stop'));}}
 enableDelivery(f);f.out.length=0;await withClock('2026-11-10T06:00:00Z',async()=>{for(let j=0;j<40&&sent(f).length<expected;j++)await cron(f);});assert.equal(sent(f).length,expected);assert.ok(f.out.filter(x=>x.method==='sendMessage').every(x=>x.body.chat_id%4===0));assert.equal(f.reconcile(),0);
});
check('actual /delete then restart cannot revive signed paid buttons; HMAC30 notice preserved',async f=>{
 await setupFence(f);activate(f);f.enable();const p=await offer(f);await press(f,p);await f.hook(f.message(1,'/delete'));assert.equal(f.query('SELECT * FROM astra_users WHERE telegram_id=1'),undefined);await f.hook(f.message(1,'/start'));const initial=f.balance(1);await press(f,p);assert.equal(f.balance(1),initial);assert.equal(f.query('SELECT count(*) n FROM astra_tarot25_purchases29').n,0);
});
check('partial D1 failure after paid INSERT: preserved purchase, retry proves one debit',async f=>{
 f.enable();const p=await offer(f),DB=f.env.DB;let committed=false,failed=false;
 f.env.DB={...DB,prepare(sql){const st=DB.prepare(sql);if(sql.startsWith('INSERT INTO astra_tarot25_purchases29(')){const run=st.run.bind(st);st.run=async()=>{const r=await run();committed=true;return r;};}if(sql.startsWith('SELECT p.* FROM astra_tarot25_purchases29')){const first=st.first.bind(st);st.first=async()=>{if(committed&&!failed){failed=true;throw Error('Synthetic post-commit D1 outage');}return first();};}return st;}};
 assert.equal((await press(f,p)).status,200);assert.equal(f.balance(1),95);assert.equal(f.query('SELECT delivery FROM astra_tarot25_purchases29').delivery,'pending');assert.match(sent(f).at(-1),/Покупку повторять не нужно/);f.env.DB=DB;await press(f,p);assert.equal(f.balance(1),95);assert.equal(f.query('SELECT delivery FROM astra_tarot25_purchases29').delivery,'sent');assert.equal(f.reconcile(),0);
});
check('failed delivery finalization leaves uncertain lease; retry never silently resends',async f=>{
 f.enable();const p=await offer(f),DB=f.env.DB;let failed=false;f.env.DB={...DB,prepare(sql){const st=DB.prepare(sql);if(sql.startsWith('UPDATE astra_tarot25_purchases29 SET delivery=?')){const run=st.run.bind(st);st.run=async()=>{if(!failed){failed=true;throw Error('Synthetic finalize outage');}return run();};}return st;}};
 await press(f,p);assert.equal(f.balance(1),95);assert.equal(f.query('SELECT delivery FROM astra_tarot25_purchases29').delivery,'sending');f.env.DB=DB;const before=sent(f).length;await press(f,p);assert.ok(!sent(f).slice(before).some(t=>t.startsWith('Три карты ·')));assert.equal(f.balance(1),95);
});
check('delete during first multipart ACK stops further pieces without charge to new generation',async f=>{
 f.enable();const p=await offer(f,6);let n=0;f.apiResult('sendMessage',body=>{if(++n===1)f.db.exec('DELETE FROM astra_users WHERE telegram_id=1');return {message_id:800+n,chat:{id:body.chat_id}};});await press(f,p);assert.equal(f.query('SELECT * FROM astra_users WHERE telegram_id=1'),undefined);assert.equal(f.query('SELECT count(*) n FROM astra_tarot25_purchases29').n,0);assert.equal(n,2); // one result part plus truthful status; no second result part
});
check('existing long frozen result pages fit Free budget and concatenate exactly',async f=>{
 f.enable();const DB=f.env.DB,long=('Архивный проверочный текст 🃏 <>&_\n').repeat(1700).slice(0,58000);let injected=false;
 f.env.DB={...DB,prepare(sql){const st=DB.prepare(sql);if(sql.startsWith('INSERT INTO astra_tarot25_offers29(')){const bind=st.bind.bind(st);st.bind=(...args)=>{const s=JSON.parse(args[13]);s.text=long;s.interpretation.text=long;args[13]=JSON.stringify(s);args[14]=long;injected=true;bind(...args);return st;};}return st;}};
 const p=await offer(f);assert.ok(injected);let base=f.out.length;const initial=await instrument(f,()=>press(f,p));let metrics=initial.logs[0];const budgets=[{scenario:'long_initial',sql:metrics.statements,http:f.out.length-base,total:metrics.statements+f.out.length-base}];assert.ok(metrics.statements+(f.out.length-base)<=50,JSON.stringify({metrics,http:f.out.length-base}));assert.equal(f.query('SELECT delivery FROM astra_tarot25_purchases29').delivery,'unknown');f.env.DB=DB;
 await open(f);await press(f,button(f,'История'));await press(f,button(f,'оплачено'));let read=button(f,'Прочитать ещё'),parts=[];
 for(let page=0;page<10;page++){f.db.exec('UPDATE astra_update_jobs SET lease_until=0 WHERE update_id=-1');base=f.out.length;const before=sent(f).length,r=await instrument(f,()=>press(f,read));metrics=r.logs[0];parts.push(...sent(f).slice(before));budgets.push({scenario:'manual_page_'+page,sql:metrics.statements,http:f.out.length-base,total:metrics.statements+f.out.length-base});assert.ok(metrics.statements+(f.out.length-base)<=50);const next=lastScreen(f).reply_markup.inline_keyboard.flat().find(x=>x.text.startsWith('Продолжить'));if(!next)break;read={data:next.callback_data,mid:lastScreen(f).message_id};}
 assert.equal(parts.join(''),long);assert.equal(f.balance(1),95);console.log(JSON.stringify({task03_long_budget:budgets}));
});
check('runtime and ownership are not memoized; only exact DDL read is once per invocation',async f=>{
 f.enable();const p=await offer(f),DB=f.env.DB;let ddl=0,runtime=0,switched=false;
 f.env.DB={...DB,prepare(sql){const st=DB.prepare(sql);if(sql.startsWith('SELECT name,type,sql FROM sqlite_master WHERE name IN(')){const all=st.all.bind(st);st.all=async()=>{ddl++;return all();};}if(sql.startsWith('SELECT r.*,(SELECT json_group_array')){const first=st.first.bind(st);st.first=async()=>{runtime++;const value=await first();if(!switched){switched=true;f.db.exec('UPDATE astra_tarot25_runtime29 SET enabled=0');}return value;};}return st;}};
 await press(f,p);assert.equal(ddl,1);assert.equal(f.balance(1),100);assert.equal(f.query('SELECT count(*) n FROM astra_tarot25_purchases29').n,0);assert.ok(runtime>=1);
});
check('invalid positive Telegram success result becomes unknown, never fake sent',async f=>{
 f.enable();const p=await offer(f);f.apiResult('sendMessage',true);await press(f,p);assert.equal(f.query('SELECT delivery FROM astra_tarot25_purchases29').delivery,'unknown');assert.equal(f.balance(1),95);
});
check('transport timeout is unknown within bounded time and retry cannot silently resend',async f=>{
 f.enable();const p=await offer(f),fake=globalThis.fetch;let blocked=false;globalThis.fetch=(url,options)=>{if(!blocked&&String(url).endsWith('/sendMessage')){blocked=true;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('Synthetic socket timeout')),{once:true}));}return fake(url,options);};
 try{const start=performance.now();await press(f,p);assert.ok(performance.now()-start<4500);assert.equal(f.query('SELECT delivery FROM astra_tarot25_purchases29').delivery,'unknown');assert.equal(f.balance(1),95);const before=sent(f).length;await press(f,p);assert.ok(!sent(f).slice(before).some(t=>t.startsWith('Три карты ·')));}finally{globalThis.fetch=fake;}
});

check('delete between callback actor check and home navigation never recreates a profile',async f=>{
 await open(f);const back=button(f,'Главное меню'),DB=f.env.DB;let erased=false;f.env.DB={...DB,prepare(sql){const st=DB.prepare(sql);if(sql.startsWith('SELECT u.balance,p.generation,u.telegram_id')){const first=st.first.bind(st);st.first=async()=>{const a=await first();if(!erased){erased=true;f.db.exec('DELETE FROM astra_users WHERE telegram_id=1');}return a;};}return st;}};
 await press(f,back);assert.equal(f.query('SELECT * FROM astra_users WHERE telegram_id=1'),undefined);assert.ok(!f.query('SELECT * FROM astra_user_policy WHERE telegram_id=1'));
});
