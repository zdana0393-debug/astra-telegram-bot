import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fixture,schema,migration} from './helpers.mjs';
const check=(name,fn)=>test(name,async()=>{const f=fixture();try{await fn(f);}finally{f.close();}});
test('migration preserves real opening balances and is repeatable',()=>{
  const db=new DatabaseSync(':memory:');try{
    db.exec(schema);db.exec("INSERT INTO astra_users(telegram_id,balance,channel_rewarded,last_gift_day) VALUES(1,0,1,'2026-11-04'),(2,137,0,NULL)");
    db.exec(migration);db.exec(migration);
    assert.deepEqual(db.prepare('SELECT balance FROM astra_users ORDER BY telegram_id').all().map(r=>r.balance),[0,137]);
    assert.equal(db.prepare('SELECT count(*) n FROM astra_wallet_ledger').get().n,2);
    assert.equal(db.prepare('SELECT sum(delta) n FROM astra_wallet_ledger').get().n,137);
  }finally{db.close();}
});
check('parallel daily bonus posts one entry, including concurrent duplicate updates',async f=>{
  f.user(1,2);const updates=Array.from({length:10},()=>f.message(1,'🎁 Бонус дня'));
  await Promise.all(updates.map(u=>f.hook(u)));assert.equal(f.balance(1),3);assert.equal(f.reconcile(),0);
  assert.equal(f.query("SELECT count(*) n FROM astra_operations WHERE reason='daily'").n,1);
});
check('parallel channel checks post once',async f=>{
  f.user(1);await Promise.all(Array.from({length:10},(_,i)=>f.hook({...f.click(1,i),callback_query:{...f.click(1,i).callback_query,data:'channel:check'}})));
  assert.equal(f.balance(1),25);assert.equal(f.reconcile(),0);
});
check('referral failure rolls back sign, flag, ledger and credit; retry succeeds',async f=>{
  f.user(1);f.db.exec('INSERT INTO astra_users(telegram_id,referrer_id) VALUES(2,1)');
  f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='referral' BEGIN SELECT RAISE(ABORT,'injected'); END");
  const q=f.click(2);q.callback_query.data='sign:virgo';assert.equal((await f.hook(q)).status,500);
  assert.equal(f.query('SELECT referral_rewarded FROM astra_users WHERE telegram_id=2').referral_rewarded,0);
  assert.equal(f.balance(1),20);assert.equal(f.query('SELECT zodiac FROM astra_users WHERE telegram_id=2').zodiac,null);
  f.db.exec('DROP TRIGGER fault');assert.equal((await f.hook(q)).status,200);assert.equal(f.balance(1),25);assert.equal(f.reconcile(),0);
});
check('parallel clicks from the same paid menu buy exactly one saved result',async f=>{
  f.user(1);await Promise.all(Array.from({length:12},()=>f.hook(f.click(1,7))));
  assert.equal(f.balance(1),17);assert.equal(f.query("SELECT count(*) n FROM astra_operations WHERE reason='tarot'").n,1);
  assert.equal(f.out.filter(x=>x.method==='sendMessage').length,1);assert.equal(f.reconcile(),0);
});
check('parallel different menus cannot overdraw',async f=>{
  f.user(1,3);await Promise.all(Array.from({length:10},(_,i)=>f.hook(f.click(1,i))));
  assert.equal(f.balance(1),0);assert.equal(f.query("SELECT count(*) n FROM astra_wallet_ledger WHERE delta=-3").n,1);assert.equal(f.reconcile(),0);
});
for(const failure of [400,403,429,500,'network','malformed']) check(`paid result survives ${failure} without refund or second debit`,async f=>{
  f.user(1,6);const update=f.click(1,1);f.fail(failure);
  assert.equal((await f.hook(update)).status,500);assert.equal(f.balance(1),3);
  const original=f.query("SELECT result,delivery FROM astra_operations WHERE reason='tarot'");
  assert.equal(original.delivery,typeof failure==='number'?(failure>=500?'retry':'rejected'):'unknown');
  f.fail(null);assert.equal((await f.hook(update)).status,200);
  assert.equal(f.out.filter(x=>x.method==='sendMessage').at(-1).body.text,original.result);
  assert.equal(f.balance(1),3);assert.equal(f.reconcile(),0);
  const n=f.out.length;await f.hook(update);assert.equal(f.out.length,n);
});
check('new callback and menu recover unresolved paid result first',async f=>{
  f.user(1,9);f.fail('network');await f.hook(f.click(1,1));
  const result=f.query("SELECT result FROM astra_operations WHERE reason='tarot'").result;
  f.fail(null);await f.hook(f.click(1,2));assert.equal(f.balance(1),6);
  assert.equal(f.out.at(-1).body.text,result);
});
check('stale update and stale delivery leases recover persisted reading',async f=>{
  f.user(1,6);f.fail('network');const update=f.click(1);await f.hook(update);
  f.db.exec("UPDATE astra_update_jobs SET lease_until=0; UPDATE astra_operations SET delivery='sending',lease_until=0");
  f.fail(null);assert.equal((await f.hook(update)).status,200);assert.equal(f.balance(1),3);
});
check('delete removes owned rows and invitee references without changing referrer balance',async f=>{
  f.user(1);f.db.exec('INSERT INTO astra_users(telegram_id,referrer_id) VALUES(2,1)');
  const q=f.click(2);q.callback_query.data='sign:aries';await f.hook(q);
  await f.hook(f.message(2,'🎁 Бонус дня'));await f.hook(f.click(2));await f.hook(f.message(2,'/delete'));
  assert.equal(f.balance(2),undefined);assert.equal(f.balance(1),25);
  for(const table of ['astra_operations','astra_wallet_ledger','astra_update_jobs','astra_broadcast_jobs','astra_tarot_requests'])
    assert.equal(f.query(`SELECT count(*) n FROM ${table} WHERE telegram_id=2`).n,0);
  assert.equal(f.query('SELECT count(*) n FROM astra_operations WHERE source_id=2').n,0);
  await f.hook(f.message(2,'/start'));assert.equal(f.balance(2),2);assert.equal(f.reconcile(),0);
});
check('referrer deletion clears remaining user reference',async f=>{
  f.user(1);f.db.exec('INSERT INTO astra_users(telegram_id,referrer_id) VALUES(2,1)');await f.hook(f.message(1,'/delete'));
  assert.equal(f.query('SELECT referrer_id FROM astra_users WHERE telegram_id=2').referrer_id,null);
});
check('same update retry after delivery failure does not toggle notifications twice',async f=>{
  f.user(1);const u=f.message(1,'🔔 Рассылка');f.fail('network');await f.hook(u);f.fail(null);await f.hook(u);
  assert.equal(f.query('SELECT notifications_enabled FROM astra_users WHERE telegram_id=1').notifications_enabled,0);
});
check('health fails without migration; internal audit requires header and returns only aggregate',async f=>{
  const r=await f.bot.fetch(new Request('https://astra.test/internal/integrity',{method:'POST'}),f.env);assert.equal(r.status,403);
  f.db.exec('UPDATE astra_users SET balance=balance');
  const audit=await f.bot.fetch(new Request('https://astra.test/internal/integrity',{method:'POST',headers:{Authorization:'Bearer FAKE_ADMIN'}}),f.env);
  assert.deepEqual(await audit.json(),{mismatches:0});
  const db=new DatabaseSync(':memory:');try{db.exec(schema);const env={...f.env,DB:{prepare(sql){return {async first(){return db.prepare(sql).get();}}}}};
    assert.equal((await f.bot.fetch(new Request('https://astra.test/health'),env)).status,503);
  }finally{db.close();}
});
check('parallel Cron and unknown delivery avoid duplicates and do not starve later users',async f=>{
  const OriginalDate=Date;class FixedDate extends OriginalDate{constructor(...a){super(...(a.length?a:['2026-11-04T06:10:00Z']));}static now(){return new OriginalDate('2026-11-04T06:10:00Z').getTime();}}
  globalThis.Date=FixedDate;
  try{for(let i=1;i<=12;i++)f.user(i);f.fail('network');
    await Promise.all([f.bot.scheduled({},f.env),f.bot.scheduled({},f.env)]);
    f.fail(null);await f.bot.scheduled({},f.env);await f.bot.scheduled({},f.env);
    assert.equal(f.out.filter(x=>x.method==='sendMessage').length,12);
    assert.equal(f.query('SELECT count(*) n FROM astra_broadcast_jobs').n,12);
    assert.equal(f.query("SELECT count(*) n FROM astra_broadcast_jobs WHERE delivery='unknown'").n,8);
  }finally{globalThis.Date=OriginalDate;}
});
check('forecast and daily card content match v2, including free lucky number',async f=>{
  const old=(await import('../src/01_ASTRA_V2.js')).default;f.user(1);
  const u=f.message(1,'🔮 Гороскоп');await old.fetch(new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'FAKE_HEADER'},body:JSON.stringify(u)}),f.env);
  const expected=f.out.at(-1).body.text;
  await f.hook(f.message(1,'🔮 Гороскоп'));
  if(['2.3-editorial','2.3b'].includes(process.env.ASTRA_TEST_RELEASE)) {
    assert.equal(f.out.at(-1).body.text.match(/🔢 Число дня: ([1-9])/)[1],expected.match(/🔢 Число дня: ([1-9])/)[1]);
  } else assert.equal(f.out.at(-1).body.text,expected);
  assert.match(expected,/🔢 Число дня: [1-9]/);
  const q=f.click(1);q.callback_query.data='tarot:day';await f.hook(q);const card=f.out.at(-1).body.text;
  const q2=f.click(1);q2.callback_query.data='tarot:day';await f.hook(q2);assert.equal(f.out.at(-1).body.text,card);assert.equal(f.balance(1),20);
});
test('independent SQLite connections serialize competing debits with no JS lock',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');const {Worker}=await import('node:worker_threads');
  const dir=mkdtempSync(join(tmpdir(),'astra-race-')),file=join(dir,'race.sqlite');
  const db=new DatabaseSync(file);
  try{db.exec(schema);db.exec(migration);db.exec("INSERT INTO astra_users(telegram_id,balance) VALUES(1,3)");
    await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./contention-worker.mjs',import.meta.url),{workerData:{file,key:'race:'+i}});
      worker.on('error',reject);worker.on('exit',code=>code===0?resolve():reject(Error('Worker exit '+code)));
    })));
    assert.equal(db.prepare('SELECT balance FROM astra_users').get().balance,0);
    assert.equal(db.prepare("SELECT count(*) n FROM astra_operations WHERE reason='tarot'").get().n,1);
    assert.equal(db.prepare('SELECT sum(delta) n FROM astra_wallet_ledger').get().n,0);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
check('foreign-key enforcement preserves delete and referral invariants',async f=>{
  f.db.exec('PRAGMA foreign_keys=ON');f.user(1);f.db.exec('INSERT INTO astra_users(telegram_id,referrer_id) VALUES(2,1)');
  const q=f.click(2);q.callback_query.data='sign:aries';await f.hook(q);
  await f.hook(f.message(2,'/delete'));assert.equal(f.reconcile(),0);assert.equal(f.balance(1),25);
  assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
check('failed ledger insertion rolls back debit and saved operation',async f=>{
  f.user(1,6);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='tarot' BEGIN SELECT RAISE(ABORT,'injected'); END");
  const u=f.click(1);assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),6);
  assert.equal(f.query('SELECT count(*) n FROM astra_operations').n,0);
  f.db.exec('DROP TRIGGER fault');assert.equal((await f.hook(u)).status,200);assert.equal(f.balance(1),3);assert.equal(f.reconcile(),0);
});
check('registration refuses to run against an unmigrated database',async f=>{
  const db=new DatabaseSync(':memory:');db.exec(schema);
  try{const env={...f.env,DB:{prepare(sql){return {async first(){return db.prepare(sql).get();}}}}};
    const response=await f.bot.fetch(new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'FAKE_HEADER'},body:JSON.stringify(f.message(5,'/start'))}),env);
    assert.equal(response.status,503);assert.equal(db.prepare('SELECT count(*) n FROM astra_users').get().n,0);
  }finally{db.close();}
});
check('repeat migration after purchases does not replace opening balance',async f=>{
  f.user(1,9);await f.hook(f.message(1,'🎁 Бонус дня'));await f.hook(f.click(1));
  const before=f.query('SELECT count(*) n FROM astra_wallet_ledger').n;f.db.exec(migration);f.db.exec(migration);
  assert.equal(f.balance(1),7);assert.equal(f.query('SELECT count(*) n FROM astra_wallet_ledger').n,before);assert.equal(f.reconcile(),0);
});
check('parallel first signs reward referrer once',async f=>{
  f.user(1);f.db.exec('INSERT INTO astra_users(telegram_id,referrer_id) VALUES(2,1)');
  await Promise.all(Array.from({length:10},()=>{const q=f.click(2);q.callback_query.data='sign:virgo';return f.hook(q);}));
  assert.equal(f.balance(1),25);assert.equal(f.query("SELECT count(*) n FROM astra_operations WHERE reason='referral'").n,1);assert.equal(f.reconcile(),0);
});
check('daily boundary remains Moscow midnight and existing rewards are preserved',async f=>{
  f.user(1,2);const OriginalDate=Date;let clock='2026-11-04T20:59:59Z';
  class FixedDate extends OriginalDate{constructor(...a){super(...(a.length?a:[clock]));}static now(){return new OriginalDate(clock).getTime();}}
  globalThis.Date=FixedDate;
  try{await f.hook(f.message(1,'🎁 Бонус дня'));assert.equal(f.balance(1),3);
    await f.hook(f.message(1,'🎁 Бонус дня'));assert.equal(f.balance(1),3);
    clock='2026-11-04T21:00:00Z';await f.hook(f.message(1,'🎁 Бонус дня'));assert.equal(f.balance(1),4);
    assert.equal(f.query('SELECT last_gift_day FROM astra_users WHERE telegram_id=1').last_gift_day,'2026-11-05');
    f.db.exec('UPDATE astra_users SET channel_rewarded=1');const q=f.click(1);q.callback_query.data='channel:check';await f.hook(q);
    assert.equal(f.balance(1),4);assert.equal(f.reconcile(),0);
  }finally{globalThis.Date=OriginalDate;}
});
check('crash after delivering an older recovery cannot charge the recovery menu on retry',async f=>{
  f.user(1,12);f.fail('network');await f.hook(f.click(1,1));f.fail(null);
  const recovery=f.click(1,2);await f.hook(recovery);assert.equal(f.balance(1),9);
  // Simulate crash after delivery committed but before dispatch completion.
  f.db.prepare('DELETE FROM astra_processed_updates WHERE update_id=?').run(recovery.update_id);
  f.db.prepare("UPDATE astra_update_jobs SET status='working',lease_until=0 WHERE update_id=?").run(recovery.update_id);
  assert.equal((await f.hook(recovery)).status,200);assert.equal(f.balance(1),9);
  assert.equal((await f.hook(f.click(1,2))).status,200);assert.equal(f.balance(1),9);
  assert.equal(f.query("SELECT count(*) n FROM astra_operations WHERE reason='tarot'").n,1);assert.equal(f.reconcile(),0);
});
