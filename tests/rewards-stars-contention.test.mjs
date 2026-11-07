import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {receiveStarPayment} from '../src/payments/service.mjs';
import {capturePolicyEvent,settlePolicyEvents,readPolicy} from '../src/rewards/policy.mjs';
import {getForecastDaily} from '../src/forecast/service.mjs';
const migrations=['src/02_SCHEMA.sql','migrations/0021_wallet.sql','migrations/0022_shell.sql','migrations/0023_forecast.sql','migrations/0024_activity_history.sql','migrations/0025_rewards_stars.sql'];
function adapter(db){return {prepare(sql){const st=db.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){return st.get(...args)??null;},async all(){return {results:st.all(...args)};},async run(){return {meta:{changes:Number(st.run(...args).changes)}};}};}};}
for(const kind of ['register','daily','channel','referral','receipt','refund','purchase','mixed'])test(`independent SQLite connections: ${kind==='mixed'?40:20} concurrent ${kind} clients, no JS mutex`,async()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'astra-stars-')),file=join(dir,'race.sqlite'),db=new DatabaseSync(file);
 const env={DB:adapter(db),ASTRA_TELEGRAM_TEST_MODE:'true',ASTRA_ECONOMY_V2_ENABLED:'true'};
 const p={currency:'XTR',total_amount:10,invoice_payload:'a24:FAKE-RACE-ORDER',telegram_payment_charge_id:'FAKE-CONCURRENT-CHARGE'};
 try{
  for(const path of migrations)db.exec(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
  db.exec('PRAGMA journal_mode=WAL');db.exec("INSERT INTO astra_users(telegram_id,zodiac,balance) VALUES(1,'aries',2)");
  if(['register','daily','channel','referral'].includes(kind))db.exec("UPDATE astra_policy SET enabled=1,activated=1,start_day='2026-01-01'");
  db.exec("UPDATE astra_policy SET payment_scope='test',support='mailto:support@example.test',terms_version='test-v1',retention_days=365,verified_bot_id=424242");
  if(kind==='referral'){
   db.exec("INSERT INTO astra_users(telegram_id,zodiac,referrer_id) VALUES(2,'aries',1)");
   await capturePolicyEvent(env,{id:2,source:'message',signSelection:false},900,'2026-11-07',await readPolicy(env));await settlePolicyEvents(env,2);
  }
  if(['receipt','refund','purchase','mixed'].includes(kind)){
   db.exec("INSERT INTO astra_payment_orders(order_id,payload,owner_id,payer_id,request_key,package,xtr,dust,price_version,scope,terms_version,retention_days) VALUES('FAKE-ORDER','a24:FAKE-RACE-ORDER',1,1,'FAKE-request',10,10,100,'stars-pack-v1','test','test-v1',365)");
   if(kind!=='receipt'){await receiveStarPayment(env,1,p);for(let i=0;i<25;i++)db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES(?,1,'tarot',-3,'owned text')").run('spent:'+i);await getForecastDaily(env,'aries','2026-11-08');}
  }
  const jobs=kind==='mixed'?[...Array(20).fill('refund'),...Array(20).fill('purchase')]:Array(20).fill(kind);
  await Promise.all(jobs.map((operation,index)=>new Promise((resolve,reject)=>{const w=new Worker(new URL('./rewards-stars-worker.mjs',import.meta.url),{workerData:{file,kind:operation,index,proof:p}});w.on('error',reject);w.on('exit',code=>code===0?resolve():reject(Error('Worker failed '+code)));})));
  const q=(sql,...a)=>db.prepare(sql).get(...a),balance=q('SELECT balance FROM astra_users WHERE telegram_id=1').balance;
  if(kind==='register'){assert.equal(q('SELECT balance FROM astra_users WHERE telegram_id=3').balance,12);assert.equal(q("SELECT count(*) n FROM astra_reward_claims WHERE kind='initial'").n,1);}
  if(kind==='daily'){assert.equal(balance,5);assert.equal(q('SELECT count(*) n FROM astra_policy_days').n,1);}
  if(kind==='channel'){assert.equal(balance,10);assert.equal(q("SELECT count(*) n FROM astra_reward_claims WHERE kind='channel'").n,1);}
  if(kind==='referral'){assert.equal(balance,16);assert.equal(q('SELECT balance FROM astra_users WHERE telegram_id=2').balance,22);assert.equal(q('SELECT count(*) n FROM astra_referral_payouts').n,1);}
  if(kind==='receipt'){assert.equal(balance,102);assert.equal(q('SELECT count(*) n FROM astra_payment_receipts').n,1);}
  if(kind==='refund'){assert.equal(balance,0);assert.equal(q('SELECT debt FROM astra_refund_accounts WHERE payer_id=1').debt,73);assert.equal(q('SELECT count(*) n FROM astra_refund_settlements').n,1);}
  if(kind==='purchase'){assert.equal(balance,23);assert.equal(q('SELECT count(*) n FROM astra_forecast_unlocks').n,1);}
  if(kind==='mixed'){const paid=q('SELECT count(*) n FROM astra_forecast_unlocks').n;assert.ok(paid===0||paid===1);assert.equal(balance,0);assert.equal(q('SELECT debt FROM astra_refund_accounts WHERE payer_id=1').debt,73+4*paid);}
  assert.equal(q('SELECT count(*) n FROM astra_users u WHERE balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)').n,0);
  assert.equal(q('SELECT count(*) n FROM astra_users WHERE balance<0').n,0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
