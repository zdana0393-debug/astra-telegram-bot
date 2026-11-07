import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture,migration24} from './helpers.mjs';
import {readHistoryPage,encodeHistoryCursor,decodeHistoryCursor,historyRecordText,formatLedgerTime,economyChunks} from '../src/economy/history.mjs';
import {recordActivity,readActivity,activityDay,previousActivityDay} from '../src/economy/activity.mjs';
const check=(name,fn)=>test(name,async()=>{const f=fixture({economy:true});try{await fn(f);}finally{f.close();}});
const count=(f,t)=>f.query(`SELECT count(*) n FROM ${t}`).n;
const ledger=f=>f.db.prepare('SELECT * FROM astra_wallet_ledger ORDER BY idempotency_key').all();
const click=(f,page,id=1)=>{const q=f.click(id);q.callback_query.data='shell:'+page;return f.hook(q);};
const text=f=>f.out.filter(x=>x.method==='sendMessage').at(-1)?.body.text;
const request=u=>new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'FAKE_HEADER'},body:JSON.stringify(u)});
async function clock(initial,fn){const Original=Date;let time=initial;class Fixed extends Original{constructor(...args){super(...(args.length?args:[time]));}static now(){return new Original(time).getTime();}}globalThis.Date=Fixed;try{return await fn(value=>time=value);}finally{globalThis.Date=Original;}}
// Synthetic ledger fixtures only. No production code directly adjusts balances.
function seed(f,owner,n,prefix='PRIVATE_KEY'){
  const reasons=['opening','registration','daily','referral','channel','tarot','easter:gpt6','forecast:extended','UNRECOGNIZED_PRIVATE_REASON'];let sum=0;
  for(let i=0;i<n;i++){
    const delta=[0,2,1,5,5,-3,5,-4,1][i%9];sum+=delta;
    f.db.prepare('INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason,created_at) VALUES(?,?,?,?,?)')
      .run(prefix+':'+String(i).padStart(4,'0'),owner,delta,reasons[i%9],'2026-11-'+String(1+i%5).padStart(2,'0')+' 12:30:00');
  }
  f.db.prepare('UPDATE astra_users SET balance=balance+? WHERE telegram_id=?').run(sum,owner);assert.equal(f.reconcile(),0);
}
async function allPages(f,owner,first=null){ // caller may pass a frozen first page
  let p=first||await readHistoryPage(f.env,owner),ids=[],pages=[];
  while(true){pages.push(p);ids.push(...p.rows.map(r=>r.history_row));if(!p.older)break;p=await readHistoryPage(f.env,owner,p.older);assert.ok(pages.length<100);}
  return {ids,pages};
}
test('history cursor is bounded, canonical and rejects injection/unsafe integers',()=>{
  for(const d of ['o','n'])for(const n of [1,9007199254740991]){const c=encodeHistoryCursor(d,n,1);assert.deepEqual(decodeHistoryCursor(c),{direction:d,snapshot:n,anchor:1});assert.ok(Buffer.byteLength('shell:history:p:'+c)<=64);}
  for(const value of ['o:0:1','o:1:2','o:01:1','o:zzzzzzzzzzz:1','n:1:-1','x:1:1',"o:1:1' OR 1=1--",'o:1:1:extra',null,'o:1:A'])assert.equal(decodeHistoryCursor(value),null);
  assert.throws(()=>encodeHistoryCursor('o',Infinity,1));
});
check('500 mixed ledger rows paginate completely in stable chronological order with ties',async f=>{
  f.user(1,1000);f.user(2,50);seed(f,1,500);seed(f,2,21,'FOREIGN_PRIVATE');
  const expected=f.db.prepare('SELECT rowid AS r FROM astra_wallet_ledger WHERE telegram_id=1 ORDER BY created_at DESC,idempotency_key DESC').all().map(r=>r.r);
  const {ids,pages}=await allPages(f,1);assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,501);assert.ok(pages.every(p=>p.rows.length<=12));assert.equal(pages.length,42);
  assert.equal(f.reconcile(),0);assert.ok(pages.every(p=>p.rows.every(r=>!Object.hasOwn(r,'idempotency_key')&&!Object.hasOwn(r,'telegram_id'))));
});
check('newer returns the exact preceding page and boundaries do not loop',async f=>{
  f.user(1,1000);seed(f,1,100);const one=await readHistoryPage(f.env,1),two=await readHistoryPage(f.env,1,one.older),back=await readHistoryPage(f.env,1,two.newer);
  assert.deepEqual(back.rows,one.rows);assert.equal(back.newer,null);
  const {pages}=await allPages(f,1,one);assert.equal(pages.at(-1).older,null);assert.ok(pages.at(-1).newer);
});
check('new inserts including backdated/tied records neither shift nor contaminate a frozen traversal',async f=>{
  f.user(1,1000);seed(f,1,120);const original=await allPages(f,1),first=original.pages[0];
  for(const [key,date] of [['Z_new','2099-01-01 00:00:00'],['A_backdated','2000-01-01 00:00:00'],['Tied_new','2026-11-03 12:30:00']])f.db.prepare('INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason,created_at) VALUES(?,1,0,\'test\',?)').run(key,date);
  assert.deepEqual((await allPages(f,1,first)).ids,original.ids);
  const second=await readHistoryPage(f.env,1,first.older);assert.deepEqual((await readHistoryPage(f.env,1,second.newer)).rows,first.rows);
  assert.equal((await allPages(f,1)).ids.length,124);assert.equal(f.reconcile(),0);
});
check('cursors are owner-scoped and invalid cursors cannot expose keys, reasons or IDs',async f=>{
  f.user(1,1000);f.user(2,1000);seed(f,1,50);seed(f,2,50,'OTHER_OWNER_SECRET');
  const page=await readHistoryPage(f.env,1);assert.equal((await readHistoryPage(f.env,2,page.older)).expired,true);
  assert.equal((await readHistoryPage(f.env,1,"o:1:1' UNION SELECT")).expired,true);
  await click(f,'history:d:'+page.older,2);assert.match(text(f),/Курсор недоступен/);assert.doesNotMatch(text(f),/PRIVATE|OTHER_OWNER|telegram|idempotency/i);
});
check('empty history is readable; unknown reasons and opening are truthful and neutral',async f=>{
  f.user(1,0);f.db.exec('DELETE FROM astra_wallet_ledger WHERE telegram_id=1');await click(f,'dust:history');assert.match(text(f),/Операций пока нет/);assert.equal(f.reconcile(),0);
  const opening=historyRecordText({created_at:'2026-12-31 21:01:02',delta:137,reason:'opening'});assert.match(opening,/Исторический снимок баланса · \+137/);assert.doesNotMatch(opening,/бонус|наград/iu);assert.match(opening,/01\.01\.2027, 00:01:02/);
  assert.match(historyRecordText({created_at:'2026-01-01 00:00:00',delta:-4,reason:'forecast:extended'}),/Расширенный прогноз · −4/);
  assert.doesNotMatch(historyRecordText({created_at:'bad',delta:0,reason:'PRIVATE_999_secret'}),/PRIVATE|999|secret/);assert.match(formatLedgerTime('bad'),/UTC/);
});
check('history tuple query uses the compound index without OFFSET or sorting the full history',async f=>{
  f.user(1,1000);seed(f,1,500);
  const plan=f.db.prepare(`EXPLAIN QUERY PLAN SELECT rowid,created_at,delta,reason FROM astra_wallet_ledger
    WHERE telegram_id=? AND rowid<=? AND (created_at,idempotency_key)<(?,?) ORDER BY created_at DESC,idempotency_key DESC LIMIT 13`).all(1,99999,'2026-11-03 12:30:00','PRIVATE_KEY:0200').map(r=>r.detail).join('\n');
  assert.match(plan,/idx_astra_ledger_history/);assert.doesNotMatch(plan,/TEMP B-TREE/);
  const source=fs.readFileSync(new URL('../src/economy/history.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/\bOFFSET\b/);
});
test('UTF-16 chunks preserve long content and surrogate pairs without parse mode',()=>{
  const content=('Финансовая запись 🪐\n').repeat(900),parts=economyChunks(content);assert.ok(parts.length>1);assert.equal(parts.join(''),content);assert.ok(parts.every(p=>p.length<=3800&&!/[\uD800-\uDBFF]$/.test(p)));
});
check('history, activity and dossier have bounded navigation and no monetary effects',async f=>{
  f.user(1,1000);seed(f,1,30);const before=ledger(f);
  for(const page of ['dust','dossier','dossier:economy','dust:activity','dossier:activity','dust:history','dossier:history','dust:shop']){
    assert.equal((await click(f,page)).status,200);const body=f.out.at(-1).body;assert.ok(body.text.length<=4096);assert.equal(body.parse_mode,undefined);
    const buttons=body.reply_markup.inline_keyboard.flat();assert.ok(buttons.some(b=>b.callback_data==='shell:home'));assert.ok(buttons.some(b=>b.text==='‹ Назад'));
    for(const b of buttons)assert.ok(Buffer.byteLength(b.callback_data)<=64);
  }
  assert.deepEqual(ledger(f),before);assert.equal(count(f,'astra_activity_days'),1);assert.equal(f.reconcile(),0);
});
test('0024 preserves old balances/ledger/schema and re-runs without backfill or rewards',async()=>{
  const f=fixture({economy:false,forecast:true,legacyUsers:[{id:1,balance:137},{id:2,balance:0}]});
  try{const before=ledger(f),oldSchema=f.db.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
    f.db.exec(migration24);f.db.exec(migration24);assert.deepEqual(ledger(f),before);assert.equal(f.balance(1),137);assert.equal(f.balance(2),0);assert.equal(count(f,'astra_activity_days'),0);
    for(const row of oldSchema)assert.equal(f.db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(row.name).sql,row.sql);
    const steps=fs.readdirSync(new URL('../migrations/0024_steps/',import.meta.url)).sort();assert.equal(steps.length,4);assert.equal(steps.map(n=>fs.readFileSync(new URL('../migrations/0024_steps/'+n,import.meta.url),'utf8')).join(''),migration24);assert.equal(f.reconcile(),0);
  }finally{f.close();}
});
check('activity guard rejects invalid dates, unregistered users and unsupported sources with FK OFF',async f=>{
  f.db.exec('PRAGMA foreign_keys=OFF');f.user(1);f.db.prepare('INSERT INTO astra_users(telegram_id,balance) VALUES(2,2)').run();
  const insert=f.db.prepare('INSERT INTO astra_activity_days(telegram_id,day,source) VALUES(?,?,?)');
  insert.run(999,'2026-11-07','message');insert.run(2,'2026-11-07','message');assert.equal(count(f,'astra_activity_days'),0);
  for(const day of ['2026-02-29','2024-02-30','2026-11-7','2026-00-01','x'])assert.throws(()=>insert.run(1,day,'message'));
  assert.throws(()=>insert.run(1,'2026-11-07','cron'));await recordActivity(f.env,1,'2024-02-29','callback');assert.equal(count(f,'astra_activity_days'),1);assert.equal(f.reconcile(),0);
});
check('each partial 0024 fails health/webhook/Cron closed; the complete schema recovers',async f=>{
  f.user(1,10);const health=()=>f.bot.fetch(new Request('https://astra.test/health'),f.env);assert.equal((await health()).status,200);
  for(const [kind,name] of [['TRIGGER','astra_activity_guard'],['TRIGGER','astra_activity_erase'],['INDEX','idx_astra_ledger_history'],['TABLE','astra_activity_days']]){
    f.db.exec(`DROP ${kind} ${name}`);assert.equal((await health()).status,503);assert.equal((await click(f,'dust')).status,503);const sends=f.out.length;await f.bot.scheduled({},f.env);assert.equal(f.out.length,sends);f.db.exec(migration24);
  }
  assert.equal((await health()).status,200);assert.equal(f.balance(1),10);assert.equal(f.reconcile(),0);
});
test('Moscow midnight and leap/year boundaries use actual calendar dates',()=>{
  assert.equal(activityDay(new Date('2026-12-31T20:59:59Z')),'2026-12-31');assert.equal(activityDay(new Date('2026-12-31T21:00:00Z')),'2027-01-01');
  assert.equal(previousActivityDay('2024-03-01'),'2024-02-29');assert.equal(previousActivityDay('2027-01-01'),'2026-12-31');assert.throws(()=>previousActivityDay('2026-02-29'));
});
check('90-day streak crosses leap day, resets after a missed date and resumes without changing dust',async f=>{
  f.user(1,137);const before=ledger(f);
  for(let i=0;i<90;i++){const day=new Date(Date.UTC(2028,0,i+1)).toISOString().slice(0,10);await recordActivity(f.env,1,day,'message');const a=await readActivity(f.env,1,day);assert.equal(a.total,i+1);assert.equal(a.streak,i+1);}
  assert.equal((await readActivity(f.env,1,'2028-03-31')).streak,90);assert.equal((await readActivity(f.env,1,'2028-04-01')).streak,0);
  await recordActivity(f.env,1,'2028-04-01','callback');assert.equal((await readActivity(f.env,1,'2028-04-01')).streak,1);await recordActivity(f.env,1,'2028-04-02','message');assert.equal((await readActivity(f.env,1,'2028-04-02')).streak,2);
  assert.equal((await readActivity(f.env,1,'2028-04-02')).total,92);assert.deepEqual(ledger(f),before);assert.equal(f.balance(1),137);
});
check('90 real webhook visit days create 90 dates and no new ledger entries',async f=>{
  f.user(1,10);await clock('2026-12-01T09:00:00Z',async set=>{for(let i=0;i<90;i++){set(new Date(Date.UTC(2026,11,i+1,9)).toISOString());assert.equal((await f.hook(f.message(1,'/start'))).status,200);}});
  const a=await readActivity(f.env,1,'2027-02-28');assert.equal(a.total,90);assert.equal(a.streak,90);assert.equal(count(f,'astra_wallet_ledger'),1);assert.equal(f.balance(1),10);
});
check('unknown text/buttons, groups, automatic messages, health and Cron do not create activity',async f=>{
  f.user(1,10);await clock('2026-11-07T06:10:00Z',async()=>{
    await f.hook(f.message(1,'Реклама'));const group=f.message(1,'/start');group.message.chat.type='group';await f.hook(group);
    const empty=f.message(1,'');empty.message.successful_payment={currency:'XTR',total_amount:10};await f.hook(empty);
    await click(f,'unknown');await click(f,'faq:99:more');await f.bot.fetch(new Request('https://astra.test/health'),f.env);await f.bot.scheduled({},f.env);
  });assert.equal(count(f,'astra_activity_days'),0);assert.equal(f.balance(1),10);assert.equal(count(f,'astra_forecast_unlocks'),0);
});
check('registration without sign is not active; first valid sign counts even if Telegram delivery fails',async f=>{
  await f.hook(f.message(1,'/start'));assert.equal(count(f,'astra_activity_days'),0);assert.equal(f.balance(1),2);
  f.fail('network');const q=f.click(1);q.callback_query.data='sign:aries';assert.equal((await f.hook(q)).status,500);assert.equal(count(f,'astra_activity_days'),1);assert.equal(f.query('SELECT source FROM astra_activity_days').source,'callback');f.fail(null);
  assert.equal((await f.hook(q)).status,200);assert.equal(count(f,'astra_activity_days'),1);assert.equal(f.balance(1),2);assert.equal(f.reconcile(),0);
});
check('successful and failed update retries across midnight never create a second date',async f=>{
  f.user(1,10);await clock('2026-12-31T20:59:59Z',async set=>{
    const successful=f.message(1,'/start');await f.hook(successful);f.fail('network');const failed=f.message(1,'/start');assert.equal((await f.hook(failed)).status,500);
    set('2026-12-31T21:00:01Z');f.fail(null);await f.hook(successful);await f.hook(failed);assert.equal(count(f,'astra_activity_days'),1);
    assert.equal(f.query('SELECT day FROM astra_activity_days').day,'2026-12-31');await f.hook(f.message(1,'/start'));assert.equal(count(f,'astra_activity_days'),2);
    assert.equal((await readActivity(f.env,1,'2027-01-01')).streak,2);
  });
});
check('a pending pre-2.4 update is never retroactively treated as a new active day',async f=>{
  f.user(1,10);const update=f.message(1,'/start');f.db.prepare("INSERT INTO astra_update_jobs(update_id,telegram_id,lease,lease_until,received_at) VALUES(?,1,'old',0,'2026-01-01 00:00:00')").run(update.update_id);
  assert.equal((await f.hook(update)).status,200);assert.equal(count(f,'astra_activity_days'),0);assert.equal(f.balance(1),10);
});
check('20 concurrent distinct callbacks insert one active date without an award',async f=>{
  f.user(1,10);const before=ledger(f);const responses=await Promise.all(Array.from({length:20},()=>click(f,'dust')));assert.ok(responses.every(r=>r.status===200));assert.equal(count(f,'astra_activity_days'),1);assert.deepEqual(ledger(f),before);assert.equal(f.reconcile(),0);
});
check('sequential same-day actions attempt one INSERT and perform no activity UPDATE',async f=>{
  f.user(1,10);const prepare=f.env.DB.prepare,sqls=[];f.env.DB.prepare=sql=>{sqls.push(sql);return prepare(sql);};
  for(let i=0;i<20;i++)await click(f,'dust');assert.equal(sqls.filter(s=>s.startsWith('INSERT OR IGNORE INTO astra_activity_days')).length,1);assert.ok(!sqls.some(s=>/^UPDATE astra_activity/i.test(s)));assert.equal(count(f,'astra_activity_days'),1);
});
check('activity storage failure cannot block a paid forecast or introduce a financial retry',async f=>{
  f.user(1,10);f.db.exec("CREATE TRIGGER activity_fault BEFORE INSERT ON astra_activity_days BEGIN SELECT RAISE(ABORT,'synthetic'); END");
  assert.equal((await click(f,'forecast:pay:'+activityDay())).status,200);assert.equal(f.balance(1),6);assert.equal(count(f,'astra_forecast_unlocks'),1);assert.equal(count(f,'astra_activity_days'),0);assert.equal(f.reconcile(),0);
  f.db.exec('DROP TRIGGER activity_fault');await click(f,'forecast:repeat');assert.equal(f.balance(1),6);assert.equal(count(f,'astra_activity_days'),1);assert.equal(count(f,'astra_forecast_unlocks'),1);
});
for(const fk of ['ON','OFF'])check(`delete with FK ${fk} erases only the owner, including through rollback Worker 2.3B`,async f=>{
  f.db.exec('PRAGMA foreign_keys='+fk);f.user(1,10);f.user(2,10);await click(f,'dust',1);await click(f,'dust',2);
  const old=(await import('../release/ASTRA_2_3B_WORKER.js')).default;assert.equal((await old.fetch(new Request('https://astra.test/health'),f.env)).status,200);
  assert.equal((await old.fetch(request(f.message(1,'/delete')),f.env)).status,200);assert.equal(count(f,'astra_activity_days'),1);assert.equal(f.query('SELECT telegram_id FROM astra_activity_days').telegram_id,2);assert.equal(f.balance(2),10);assert.equal(f.balance(1),undefined);
  assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(f.reconcile(),0);
  await f.hook(f.message(1,'/start'));assert.equal(f.balance(1),2);assert.equal(f.query('SELECT count(*) n FROM astra_activity_days WHERE telegram_id=1').n,0);
});
test('the build retains all monetary functions and forecast functions byte for byte',()=>{
  const load=name=>vm.runInNewContext(fs.readFileSync(new URL('../release/'+name,import.meta.url),'utf8').replace('export default {','globalThis.worker = {')+'\n;[createUser,welcome,setZodiac,bonus,threeCards,channelCheck,secretArchive,createForecastGenerator,getForecastDaily,purchaseForecast,broadcast].map(f=>f.toString());',{structuredClone});
  const base=load('ASTRA_2_3B_WORKER.js'),now=load('ASTRA_2_4A_WORKER.js');assert.equal(JSON.stringify(now),JSON.stringify(base));
});
check('privacy names actual active-date data, and Stars actions remain absent',async f=>{
  f.user(1,10);await f.hook(f.message(1,'/privacy'));assert.match(text(f),/активные московские даты/);await click(f,'dust:shop');assert.match(text(f),/не подключена/);
  const update={update_id:99000,pre_checkout_query:{id:'FAKE',from:{id:1},currency:'XTR',total_amount:10,invoice_payload:'FAKE'}};await f.hook(update);
  assert.ok(!f.out.some(r=>['sendInvoice','answerPreCheckoutQuery','refundStarPayment'].includes(r.method)));assert.equal(f.balance(1),10);assert.equal(count(f,'astra_wallet_ledger'),1);
});
test('20 independent SQLite connections create one activity row without changing balances or ledger',async()=>{
  const {DatabaseSync}=await import('node:sqlite'),{mkdtempSync,rmSync}=await import('node:fs'),{join}=await import('node:path'),{tmpdir}=await import('node:os'),{Worker}=await import('node:worker_threads');
  const dir=mkdtempSync(join(tmpdir(),'astra-activity-')),file=join(dir,'race.sqlite'),db=new DatabaseSync(file);
  try{
    for(const path of ['src/02_SCHEMA.sql','migrations/0021_wallet.sql','migrations/0022_shell.sql','migrations/0023_forecast.sql','migrations/0024_activity_history.sql'])db.exec(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
    db.exec("INSERT INTO astra_users(telegram_id,zodiac,balance) VALUES(1,'aries',137)");
    await Promise.all(Array.from({length:20},()=>new Promise((resolve,reject)=>{const worker=new Worker(new URL('./activity-contention-worker.mjs',import.meta.url),{workerData:{file}});worker.on('error',reject);worker.on('exit',code=>code===0?resolve():reject(Error('Activity worker exit '+code)));})));
    assert.equal(db.prepare('SELECT count(*) n FROM astra_activity_days').get().n,1);assert.equal(db.prepare('SELECT balance FROM astra_users').get().balance,137);
    assert.equal(db.prepare('SELECT count(*) n FROM astra_wallet_ledger').get().n,1);assert.equal(db.prepare('SELECT sum(delta) n FROM astra_wallet_ledger').get().n,137);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
check('0024 read-only integrity checks report zero violations before/after deletion',async f=>{
  f.user(1,10);await click(f,'dust');const sql=fs.readFileSync(new URL('../scripts/check_integrity_2_4a.sql',import.meta.url),'utf8');
  const verify=()=>{for(const statement of sql.match(/SELECT[\s\S]*?;/g)||[]){for(const row of f.db.prepare(statement).all())for(const [key,value] of Object.entries(row))if(key.endsWith('_violations')||key.endsWith('_mismatches')||key.startsWith('orphan_'))assert.equal(value,0,key);}assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);};
  verify();await f.hook(f.message(1,'/delete'));verify();
});
check('activity milestones 3/7/30 are observational and do not advertise proposed rewards',async f=>{
  f.user(1,10);await clock('2026-11-07T10:00:00Z',async()=>{
    for(let i=0;i<30;i++)await recordActivity(f.env,1,new Date(Date.UTC(2026,9,9+i)).toISOString().slice(0,10),'message');
    await click(f,'dossier:economy');assert.match(text(f),/Текущая серия: 30 дн/);assert.match(text(f),/3 дн. — достигнут; 7 дн. — достигнут; 30 дн. — достигнут/);assert.match(text(f),/без денежных наград/);
    assert.doesNotMatch(text(f),/\+12|\+14|\+8|\+3/);
  });assert.equal(f.balance(1),10);assert.equal(count(f,'astra_wallet_ledger'),1);
});
test('existing 2.3B paid forecasts and Tarot survive 0024 and reopening through the new Worker',async()=>{
  const f=fixture({economy:false,forecast:true});
  try{
    f.user(1,20);await click(f,'forecast:pay:'+activityDay());await f.hook(f.click(1));
    const forecasts=f.db.prepare('SELECT * FROM astra_forecast_daily').all(),paid=f.db.prepare('SELECT * FROM astra_forecast_unlocks').all();
    const tarot=f.query("SELECT result FROM astra_operations WHERE reason='tarot'").result,before=ledger(f);
    assert.equal(f.balance(1),13);f.db.exec(migration24);
    const candidate=(await import('../release/ASTRA_2_4A_WORKER.js')).default;
    for(const page of ['dust:history','dossier:economy','forecast:repeat','tarot:last']){
      const q=f.click(1);q.callback_query.data='shell:'+page;assert.equal((await candidate.fetch(request(q),f.env)).status,200);
      if(page==='forecast:repeat')assert.equal(text(f),paid[0].result_text);if(page==='tarot:last')assert.equal(text(f),tarot);
    }
    assert.deepEqual(f.db.prepare('SELECT * FROM astra_forecast_daily').all(),forecasts);assert.deepEqual(f.db.prepare('SELECT * FROM astra_forecast_unlocks').all(),paid);assert.deepEqual(ledger(f),before);assert.equal(f.reconcile(),0);
  }finally{f.close();}
});
check('failure of the added delivery-check SELECT skips statistics without blocking paid material',async f=>{
  f.user(1,10);const prepare=f.env.DB.prepare;f.env.DB.prepare=sql=>{
    if(sql==='SELECT update_id FROM astra_update_jobs WHERE update_id=?')throw Error('Synthetic activity lookup failure');
    return prepare(sql);
  };
  assert.equal((await click(f,'forecast:pay:'+activityDay())).status,200);assert.equal(f.balance(1),6);assert.equal(count(f,'astra_forecast_unlocks'),1);assert.equal(count(f,'astra_activity_days'),0);assert.equal(f.reconcile(),0);
});
