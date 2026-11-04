import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,migration22} from './helpers.mjs';
const check=(name,fn)=>test(name,async()=>{const f=fixture({shell:true});try{await fn(f);}finally{f.close();}});
const call=async(f,data,mid=80)=>{const q=f.click(1,mid);q.callback_query.data=data;assert.equal((await f.hook(q)).status,200);return f.out.filter(x=>x.method==='sendMessage').at(-1).body;};
const buttons=body=>body.reply_markup?.inline_keyboard?.flat()||[];
check('six main buttons, two per row, stable returning profile',async f=>{
  f.user(1,8);await f.hook(f.message(1,'/start'));const body=f.out.at(-1).body;
  assert.deepEqual(body.reply_markup.keyboard.map(r=>r.map(b=>b.text)),[
    ['🌙 Прогноз дня','🃏 Таро'],['🪞 Познай себя','🗂 Досье'],['✨ Звёздная пыль','🏛 Об Астре']]);
  assert.equal(f.balance(1),8);assert.match(body.text,/Бюро символической навигации/);
});
check('all six reply labels open sections and every submenu has back/home',async f=>{
  f.user(1);for(const label of ['🌙 Прогноз дня','🃏 Таро','🪞 Познай себя','🗂 Досье','✨ Звёздная пыль','🏛 Об Астре']){
    await f.hook(f.message(1,label));const keys=buttons(f.out.at(-1).body);
    assert.ok(keys.some(b=>b.text==='‹ Назад'));assert.ok(keys.some(b=>b.callback_data==='shell:home'));
  }assert.equal(f.balance(1),20);
});
check('all navigation branches and FAQ details are reachable, bounded and free',async f=>{
  f.user(1);const queue=['shell:about','shell:forecast','shell:self','shell:dossier','shell:dust','shell:tarot'];const visited=new Set();const depths=new Map(queue.map(d=>[d,1]));depths.set('shell:home',0);
  const effects=new Set(['shell:gift','shell:invite','shell:channel','shell:notifications:toggle','shell:buy','tarot:day']);
  while(queue.length){const data=queue.shift();if(visited.has(data)||effects.has(data)||data.startsWith('shell:pay:'))continue;visited.add(data);assert.ok(depths.get(data)<=3,`Too many steps: ${data}`);
    const body=await call(f,data);assert.ok(body.text.length<=4096);for(const b of buttons(body)){
      assert.ok(Buffer.byteLength(b.callback_data||'')<=64);if(b.callback_data){if(!depths.has(b.callback_data))depths.set(b.callback_data,depths.get(data)+1);queue.push(b.callback_data);}
    }
    if(data==='shell:home')assert.equal(body.reply_markup.keyboard.length,3);
    else{assert.ok(buttons(body).some(b=>b.text==='‹ Назад'),data);assert.ok(buttons(body).some(b=>b.callback_data==='shell:home'),data);}
  }
  assert.ok(visited.size>=30);for(const n of ['shell:team','shell:rules','shell:trust:forecast','shell:trust:tarot','shell:trust:dust','shell:trust:future','shell:faq:10:more'])assert.ok(visited.has(n));
  assert.equal(f.balance(1),20);assert.equal(f.reconcile(),0);
});
check('team acrostic is natural, fictional roles do not reveal a command',async f=>{
  f.user(1);const body=await call(f,'shell:team');
  const lines=body.text.split('\n').filter(l=>/^(Gideon|Percival|Thalia|6th)/.test(l));assert.equal(lines.map(l=>l[0]).join(''),'GPT6');
  assert.match(body.text,/M\. Ejaculatum/);assert.match(body.text,/Персонажи легенды/);assert.doesNotMatch(body.text,/gpt6|введите|сертифицированный/iu);
});
check('GPT6 is case insensitive, trims whitespace and rewards once across update IDs',async f=>{
  f.user(1,2);for(const text of ['  GpT6  ','gpt6','GPT6','\tGpT6\n'])assert.equal((await f.hook(f.message(1,text))).status,200);
  assert.equal(f.balance(1),7);assert.equal(f.query('SELECT count(*) n FROM astra_shell_rewards').n,1);
  assert.equal(f.query("SELECT count(*) n FROM astra_wallet_ledger WHERE reason='easter:gpt6' AND operation_id IS NULL AND delta=5").n,1);
  assert.equal(f.query('SELECT count(*) n FROM astra_operations').n,0);assert.equal(f.reconcile(),0);
});
check('ten concurrent GPT6 updates post one reward with unchanged operations CHECK',async f=>{
  f.user(1,2);await Promise.all(Array.from({length:10},(_,i)=>f.hook(f.message(1,i%2?'GPT6':'gpt6'))));
  assert.equal(f.balance(1),7);assert.equal(f.query('SELECT count(*) n FROM astra_shell_rewards').n,1);assert.equal(f.reconcile(),0);
  assert.throws(()=>f.db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta) VALUES('bad',1,'easter:gpt6',5)").run(),/CHECK/);
});
check('reward and balance roll back completely on ledger fault and retry is safe',async f=>{
  f.user(1,2);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='easter:gpt6' BEGIN SELECT RAISE(ABORT,'fault'); END");
  const u=f.message(1,'gpt6');assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),2);assert.equal(f.query('SELECT count(*) n FROM astra_shell_rewards').n,0);assert.equal(f.reconcile(),0);
  f.db.exec('DROP TRIGGER fault');assert.equal((await f.hook(u)).status,200);assert.equal(f.balance(1),7);assert.equal(f.reconcile(),0);
});
check('Telegram failure after reward cannot grant it again on retry',async f=>{
  f.user(1,2);f.fail('network');const u=f.message(1,'gpt6');assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),7);
  f.fail(null);assert.equal((await f.hook(u)).status,200);assert.equal(f.balance(1),7);assert.equal(f.reconcile(),0);
});
for(const fk of ['ON','OFF'])check(`delete removes shell and 2.1 records with foreign_keys=${fk}; rejoin is fresh`,async f=>{
  f.db.exec('PRAGMA foreign_keys='+fk);f.user(1,6);f.user(2,6);
  f.db.exec('UPDATE astra_users SET referrer_id=1 WHERE telegram_id=2');await f.hook(f.message(1,'gpt6'));await f.hook(f.click(1));
  await f.hook(f.message(1,'/delete'));assert.equal(f.balance(1),undefined);
  for(const t of ['astra_shell_rewards','astra_wallet_ledger','astra_operations','astra_tarot_requests','astra_update_jobs','astra_broadcast_jobs'])assert.equal(f.query(`SELECT count(*) n FROM ${t} WHERE telegram_id=1`).n,0,t);
  assert.equal(f.query('SELECT referrer_id FROM astra_users WHERE telegram_id=2').referrer_id,null);
  await f.hook(f.message(1,'/start'));assert.equal(f.balance(1),2);await f.hook(f.message(1,'gpt6'));assert.equal(f.balance(1),7);assert.equal(f.reconcile(),0);
});
check('2.2 migration is repeatable before and after rewards and split files match',async f=>{
  const steps=fs.readdirSync(new URL('../migrations/0022_steps/',import.meta.url)).sort();
  assert.equal(steps.map(n=>fs.readFileSync(new URL('../migrations/0022_steps/'+n,import.meta.url),'utf8')).join(''),migration22);
  f.user(1,2);f.db.exec(migration22);await f.hook(f.message(1,'gpt6'));f.db.exec(migration22);await f.hook(f.message(1,'gpt6'));
  assert.equal(f.balance(1),7);assert.equal(f.reconcile(),0);
});
check('missing or partially applied shell schema fails closed for webhook, health and Cron',async f=>{
  f.user(1,2);f.db.exec('DROP TRIGGER astra_shell_reward_post');
  assert.equal((await f.bot.fetch(new Request('https://astra.test/health'),f.env)).status,503);
  assert.equal((await f.hook(f.message(1,'gpt6'))).status,503);const n=f.out.length;
  await f.bot.scheduled({},f.env);assert.equal(f.out.length,n);assert.equal(f.balance(1),2);
  f.db.exec('DROP TRIGGER astra_shell_reward_guard; DROP TRIGGER astra_shell_erase; DROP TABLE astra_shell_rewards');
  assert.equal((await f.hook(f.message(1,'/start'))).status,503);assert.equal(f.balance(1),2);
  f.db.exec(migration22);assert.equal((await f.bot.fetch(new Request('https://astra.test/health'),f.env)).status,200);
});
check('safe BOT_USERNAME override and invalid inputs fallback without unsafe links',async f=>{
  f.user(1);for(const [name,expected] of [['Astra_Staging_Bot','Astra_Staging_Bot'],['@bad','LaDa_Iskra_Opel_Astrabot'],['x/../bad','LaDa_Iskra_Opel_Astrabot'],['','LaDa_Iskra_Opel_Astrabot']]){
    f.env.BOT_USERNAME=name;const body=await call(f,'shell:invite');assert.ok(body.text.includes(`https://t.me/${expected}?start=ref_1`));
  }
});
check('new paid route confirms first; duplicate confirmations share a single 2.1 purchase',async f=>{
  f.user(1,6);const confirm1=await call(f,'shell:buy',90),confirm2=await call(f,'shell:buy',90);
  const data=buttons(confirm1).find(b=>b.text==='Подтвердить — 3 ✨').callback_data;
  assert.equal(data,buttons(confirm2)[0].callback_data);assert.equal(f.balance(1),6);
  await Promise.all([call(f,data,101),f.hook({...f.click(1,102),callback_query:{...f.click(1,102).callback_query,data}})]);
  assert.equal(f.balance(1),3);assert.equal(f.query("SELECT count(*) n FROM astra_operations WHERE reason='tarot'").n,1);
  const result=f.query("SELECT result FROM astra_operations WHERE reason='tarot'").result;
  const body=await call(f,'shell:tarot:last');assert.equal(body.text,result);assert.equal(f.balance(1),3);assert.equal(f.reconcile(),0);
});
check('new gift, channel and referral paths preserve +1,+5,+5 with legacy callbacks',async f=>{
  f.user(1,2);await call(f,'shell:gift');await call(f,'shell:gift');assert.equal(f.balance(1),3);
  await call(f,'shell:channel');await call(f,'channel:check');await call(f,'channel:check');assert.equal(f.balance(1),8);
  await f.hook(f.message(2,'/start ref_1'));const q=f.click(2);q.callback_query.data='sign:virgo';await f.hook(q);assert.equal(f.balance(1),13);
  const q2=f.click(2);q2.callback_query.data='sign:libra';await f.hook(q2);assert.equal(f.balance(1),13);assert.equal(f.balance(2),2);assert.equal(f.reconcile(),0);
});
check('dossier is factual and its notification action remains retry safe',async f=>{
  f.user(1,9);const body=await call(f,'shell:dossier');assert.match(body.text,/Овен/);assert.match(body.text,/Баланс: 9/);assert.match(body.text,/Рассылка: включена/);
  await call(f,'shell:notifications:toggle');const after=await call(f,'shell:dossier');assert.match(after.text,/Рассылка: выключена/);assert.equal(f.balance(1),9);
});
check('unknown and malformed callbacks, missing and expired callback answers are calm',async f=>{
  f.user(1);for(const data of ['shell:pay:-1','shell:faq:99','shell:buy','sign:invalid','shell:missing','shell:trust:__proto__','nonsense']){
    const q=f.click(1);q.callback_query.data=data;if(data==='shell:buy')delete q.callback_query.message.message_id;
    assert.equal((await f.hook(q)).status,200);assert.ok(buttons(f.out.at(-1).body).some(b=>b.callback_data==='shell:home'));
  }
  f.expireCallbacks(true);const recovered=await call(f,'tarot:day');assert.match(recovered.text,/КАРТА ДНЯ/);
  assert.equal(f.balance(1),20);assert.equal(f.reconcile(),0);
});
check('free forecast exactly matches 2.1 through new navigation, number remains free',async f=>{
  f.user(1,2);await f.hook(f.message(1,'🔮 Гороскоп'));const oldText=f.out.at(-1).body.text;
  const body=await call(f,'shell:forecast:read');assert.equal(body.text,oldText);assert.match(body.text,/🔢 Число дня: [1-9]/);assert.equal(f.balance(1),2);
});
check('user-facing shell pages disclose limitations and add no parse_mode or secret prompt',async f=>{
  f.user(1);for(const page of ['manifest','team','trust:forecast','trust:tarot','trust:dust','trust:future','rules','faq:6:more','faq:10:more','self','dust:shop']){
    const body=await call(f,'shell:'+page);assert.equal(body.parse_mode,undefined);assert.doesNotMatch(body.text,/оккультный|введите gpt6|100% точност/iu);assert.ok(body.text.length<4096);
  }assert.equal(f.balance(1),20);
});
check('rollback to 2.1 with full 2.2 schema preserves balance and erases rewards with FK OFF',async f=>{
  const old=(await import('../release/ASTRA_2_1_WORKER.js')).default;
  f.user(1,2);await f.hook(f.message(1,'gpt6'));f.db.exec('PRAGMA foreign_keys=OFF');
  assert.equal((await old.fetch(new Request('https://astra.test/health'),f.env)).status,200);
  const u=f.message(1,'🎁 Бонус дня');
  const request=u=>new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'FAKE_HEADER'},body:JSON.stringify(u)});
  assert.equal((await old.fetch(request(u),f.env)).status,200);assert.equal(f.balance(1),8);assert.equal(f.reconcile(),0);
  assert.equal((await old.fetch(request(f.message(1,'/delete')),f.env)).status,200);
  assert.equal(f.query('SELECT count(*) n FROM astra_shell_rewards').n,0);assert.equal(f.query('SELECT count(*) n FROM astra_wallet_ledger').n,0);
});
