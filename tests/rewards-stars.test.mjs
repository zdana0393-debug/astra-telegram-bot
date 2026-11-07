import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {fixture,migration25} from './helpers.mjs';
import {activityDay} from '../src/economy/activity.mjs';
import {armPolicy,capturePolicyEvent,settlePolicyEvents,readPolicy} from '../src/rewards/policy.mjs';
import {createStarOrder,sendStarInvoice,reservePrecheckout,answerStarPrecheckout,receiveStarPayment,receiveStarRefund,requestStarRefund,reconcileStarPage} from '../src/payments/service.mjs';
import {chargeHash} from '../src/payments/transport.mjs';
import {configurePayments,purgePaymentData} from '../src/payments/admin.mjs';
const check=(name,fn)=>test(name,async()=>{const f=fixture({full:true});try{await fn(f);}finally{f.close();}});
const click=(f,page,id=1)=>{const q=f.click(id);q.callback_query.data='shell:'+page;return f.hook(q);};
const count=(f,t)=>f.query(`SELECT count(*) n FROM ${t}`).n;
const debt=(f,id=1)=>f.query('SELECT debt FROM astra_refund_accounts WHERE payer_id=?',id)?.debt||0;
const last=f=>f.out.filter(r=>r.method==='sendMessage').at(-1)?.body;
const activate=f=>{f.env.ASTRA_ECONOMY_V2_ENABLED='true';f.db.exec("UPDATE astra_policy SET enabled=1,activated=1,start_day='2026-01-01'");};
async function clock(time,fn){const Original=Date;let current=time;class Fixed extends Original{constructor(...a){super(...(a.length?a:[current]));}static now(){return new Original(current).getTime();}}globalThis.Date=Fixed;try{return await fn(t=>current=t);}finally{globalThis.Date=Original;}}
function payments(f){Object.assign(f.env,{ASTRA_TELEGRAM_TEST_MODE:'true',ASTRA_PAYMENT_ENVIRONMENT_ACK:'DEDICATED_TELEGRAM_TEST_ENVIRONMENT_CONFIRMED',ASTRA_PAYMENT_POLICY_ACCEPTED:'APPROVED_SUPPORT_TERMS_RETENTION',STARS_SHOP_ENABLED:'true'});f.db.exec("UPDATE astra_policy SET stars_enabled=1,payment_scope='test',support='mailto:support@example.test',terms_version='test-terms-v1',retention_days=365,verified_bot_id=424242");}
async function order(f,owner=1,pack=10,key=crypto.randomUUID()){return createStarOrder(f.env,owner,pack,key,'test-terms-v1');}
const proof=(o,id='FAKE_CHARGE_'+crypto.randomUUID())=>({currency:'XTR',total_amount:o.xtr,invoice_payload:o.payload,telegram_payment_charge_id:id});
async function sign(f,id=1){const q=f.click(id);q.callback_query.data='sign:aries';return f.hook(q);}
function integrity(f){assert.equal(f.reconcile(),0);assert.equal(f.query('SELECT count(*) n FROM astra_users WHERE balance<0').n,0);for(const a of f.db.prepare('SELECT * FROM astra_refund_accounts').all()){
 const added=f.query('SELECT coalesce(sum(debt_added),0) n FROM astra_refund_settlements WHERE payer_id=?',a.payer_id).n,repaid=f.query('SELECT coalesce(sum(amount),0) n FROM astra_debt_repayments WHERE payer_id=?',a.payer_id).n;assert.equal(a.debt,added-repaid);
}}
check('default flags retain legacy prices and no UI route emits an invoice',async f=>{
 f.user(1,20);for(const page of ['dust','dust:shop','stars:buy:10','stars:accept:10:000000000000','stars:terms','stars:support'])assert.equal((await click(f,page)).status,200);
 assert.ok(!f.out.some(r=>r.method==='sendInvoice'));assert.equal(f.balance(1),20);await f.hook(f.message(1,'🎁 Бонус дня'));assert.equal(f.balance(1),21);assert.equal((await readPolicy(f.env)).activated,0);integrity(f);
});
check('0025 preserves old financial rows, repeats exactly, and fences older JS',async f=>{
 f.user(1,137);const before=f.db.prepare('SELECT * FROM astra_wallet_ledger').all();f.db.exec(migration25);assert.deepEqual(f.db.prepare('SELECT * FROM astra_wallet_ledger').all(),before);assert.equal(f.balance(1),137);
 const files=fs.readdirSync(new URL('../migrations/0025_steps/',import.meta.url)).sort();assert.equal(files.map(n=>fs.readFileSync(new URL('../migrations/0025_steps/'+n,import.meta.url),'utf8')).join(''),migration25);
 for(const release of ['ASTRA_2_3B_WORKER.js','ASTRA_2_4A_WORKER.js']){const old=(await import('../release/'+release)).default;assert.equal((await old.fetch(new Request('https://astra.test/health'),f.env)).status,503);}integrity(f);
});
check('full/partial schema, reintroduced old trigger and policy flag mismatch are visible',async f=>{
 const health=()=>f.bot.fetch(new Request('https://astra.test/health'),f.env);assert.equal((await health()).status,200);
 for(const [kind,name] of [['TRIGGER','astra_referral_policy'],['TRIGGER','astra_positive_debt'],['TABLE','astra_payment_audit'],['INDEX','idx_policy_events_owner']]){f.db.exec(`DROP ${kind} ${name}`);assert.equal((await health()).status,503);assert.equal((await f.hook(f.message(1,'/start'))).status,503);f.db.exec(migration25);}
 f.db.exec('CREATE TRIGGER astra_referral AFTER UPDATE OF zodiac ON astra_users BEGIN SELECT 1; END');assert.equal((await health()).status,503);f.db.exec(migration25);assert.equal((await health()).status,200);
});
check('future cutover is immutable and gives +12 only to new v2 profiles',async f=>{
 await clock('2026-12-31T20:59:59Z',async set=>{
  f.env.ASTRA_ECONOMY_V2_ENABLED='true';await armPolicy(f.env,'2027-01-01','2026-12-31');await f.hook(f.message(1,'/start'));assert.equal(f.balance(1),2);set('2026-12-31T21:00:00Z');await f.hook(f.message(2,'/start'));assert.equal(f.balance(2),12);
  await f.hook(f.message(2,'/start'));assert.equal(f.balance(2),12);assert.equal(f.balance(1),2);assert.throws(()=>f.db.exec("UPDATE astra_policy SET start_day='2027-01-02'"),/immutable/);integrity(f);
 });
});
check('old callbacks cannot pay legacy daily/channel after activation, including during stop',async f=>{
 f.user(1,20);activate(f);for(const reason of ['daily','channel'])f.db.prepare('INSERT OR IGNORE INTO astra_operations(operation_id,telegram_id,reason,delta,day) VALUES(?,1,?,?,?)').run('OLD_'+reason,reason,reason==='daily'?1:5,'2026-01-01');assert.equal(f.balance(1),20);
 f.db.exec('UPDATE astra_policy SET enabled=0');await f.hook(f.message(1,'🎁 Бонус дня'));assert.equal(f.balance(1),20);assert.equal(count(f,'astra_reward_claims'),0);integrity(f);
});
check('7/30/90-day automatic awards match exact policy and no repeat earns twice',async f=>{
 f.user(1,2);activate(f);await clock('2026-01-01T09:00:00Z',async set=>{for(let i=0;i<90;i++){
  set(new Date(Date.UTC(2026,0,i+1,9)).toISOString());const u=f.message(1,'/start');assert.equal((await f.hook(u)).status,200);await f.hook(u);await f.hook(f.message(1,'/start'));
  const n=i+1,expected=2+n*3+(n>=3?3:0)+Math.floor(n/7)*5+(n>=30?12:0);assert.equal(f.balance(1),expected,'day '+n);integrity(f);
 }});assert.equal(count(f,'astra_policy_days'),90);assert.equal(f.balance(1),347);assert.equal(f.query("SELECT count(*) n FROM astra_reward_claims WHERE kind='weekly'").n,12);
});
check('a missed date resets weekly cadence while thirty distinct dates still earns once',async f=>{
 f.user(1,2);activate(f);await clock('2028-02-01T09:00:00Z',async set=>{for(let i=0;i<30;i++){set(new Date(Date.UTC(2028,1,1+i*2,9)).toISOString());await f.hook(f.message(1,'/start'));}});
 assert.equal(f.balance(1),104);assert.equal(f.query("SELECT count(*) n FROM astra_reward_claims WHERE kind IN ('first3','weekly')").n,0);assert.equal(f.query("SELECT count(*) n FROM astra_reward_claims WHERE kind='thirty'").n,1);integrity(f);
});
check('existing activity row at cutover does not suppress a policy-day grant',async f=>{
 f.user(1,2);await f.hook(f.message(1,'/start'));assert.equal(count(f,'astra_activity_days'),1);activate(f);await f.hook(f.message(1,'/start'));assert.equal(count(f,'astra_activity_days'),1);assert.equal(f.balance(1),5);integrity(f);
});
check('failed Telegram update retried after midnight settles only its original date',async f=>{
 f.user(1,2);activate(f);await clock('2026-12-31T20:59:59Z',async set=>{f.fail('network');const u=f.message(1,'/start');assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),5);set('2026-12-31T21:00:01Z');f.fail(null);await f.hook(u);assert.equal(f.balance(1),5);assert.equal(count(f,'astra_policy_days'),1);assert.equal(f.query('SELECT day FROM astra_policy_days').day,'2026-12-31');});integrity(f);
});
check('referral legacy pending keeps +5; new two-day contract pays +14/+4 once',async f=>{
 f.user(1,2);await f.hook(f.message(2,'/start ref_1'));activate(f);await sign(f,2);assert.equal(f.balance(1),7);assert.equal(f.query('SELECT mode FROM astra_referral_contracts WHERE invitee=2').mode,'legacy');
 await clock('2026-11-07T09:00:00Z',async set=>{await f.hook(f.message(3,'/start ref_1'));await sign(f,3);assert.equal(f.balance(3),15);assert.equal(f.balance(1),7);set('2026-11-07T21:00:00Z');await f.hook(f.message(3,'/start'));assert.equal(f.balance(3),22);assert.equal(f.balance(1),21);await f.hook(f.message(3,'/start'));assert.equal(f.balance(1),21);});assert.equal(f.query('SELECT status FROM astra_referral_contracts WHERE invitee=3').status,'paid');integrity(f);
});
check('an already paid legacy referral never receives the new amounts',async f=>{
 f.user(1,2);await f.hook(f.message(2,'/start ref_1'));await sign(f,2);assert.equal(f.balance(1),7);activate(f);await f.hook(f.message(2,'/start'));assert.equal(f.balance(1),7);assert.equal(count(f,'astra_referral_payouts'),0);integrity(f);
});
for(const fk of ['ON','OFF'])check(`deleted referrer cancels pending v2 contract with FK ${fk}`,async f=>{
 f.db.exec('PRAGMA foreign_keys='+fk);f.user(1,2);activate(f);await clock('2026-11-07T09:00:00Z',async set=>{await f.hook(f.message(2,'/start ref_1'));await sign(f,2);await f.hook(f.message(1,'/delete'));set('2026-11-08T09:00:00Z');await f.hook(f.message(2,'/start'));assert.equal(f.balance(2),18);assert.equal(f.query('SELECT status FROM astra_referral_contracts WHERE invitee=2').status,'cancelled');});integrity(f);
});
check('channel +8 is unique; old +5 closes eligibility; GPT6 and prices stay unchanged',async f=>{
 f.user(1,20);await click(f,'channel');const q=f.click(1);q.callback_query.data='channel:check';await f.hook(q);assert.equal(f.balance(1),25);activate(f);await f.hook({...f.click(1),callback_query:{...f.click(1).callback_query,data:'channel:check'}});assert.equal(f.balance(1),28); // only daily +3
 f.user(2,2);const r=f.click(2);r.callback_query.data='channel:check';await f.hook(r);assert.equal(f.balance(2),23); // initial 12 + day 3 + channel 8
 await f.hook(f.message(2,'gpt6'));assert.equal(f.balance(2),28);await f.hook(f.message(2,'gpt6'));assert.equal(f.balance(2),28);await f.hook(f.click(2));assert.equal(f.balance(2),25);await click(f,'forecast:pay:'+activityDay(),2);assert.equal(f.balance(2),21);await click(f,'forecast:repeat',2);assert.equal(f.balance(2),21);integrity(f);
});
check('policy claim SQL fault rolls back the day and all financial effects, retry recovers',async f=>{
 f.user(1,2);activate(f);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason LIKE 'reward:%' BEGIN SELECT RAISE(ABORT,'fault'); END");const u=f.message(1,'/start');assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),2);assert.equal(count(f,'astra_policy_days'),0);f.db.exec('DROP TRIGGER fault');assert.equal((await f.hook(u)).status,200);assert.equal(f.balance(1),5);integrity(f);
});
check('fake claims, invalid dates and backwards policy days are rejected by SQL',async f=>{
 f.user(1,2);activate(f);await f.hook(f.message(1,'/start'));const g=f.query('SELECT generation FROM astra_user_policy WHERE telegram_id=1').generation;
 assert.throws(()=>f.db.prepare("INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference) VALUES('fake',1,?,'weekly',?,5,?)").run(g,activityDay(),activityDay()));
 assert.throws(()=>f.db.prepare("INSERT INTO astra_policy_events(update_id,telegram_id,day,source,legacy) VALUES(9,1,'2026-02-30','message',0)").run());integrity(f);
});
check('Stars requires every approval, correct scope, bot ID and Terms; OFF has no backdoor',async f=>{
 f.user(1,0);payments(f);for(const key of ['STARS_SHOP_ENABLED','ASTRA_PAYMENT_ENVIRONMENT_ACK','ASTRA_PAYMENT_POLICY_ACCEPTED']){const old=f.env[key];delete f.env[key];await assert.rejects(order(f));f.env[key]=old;}
 f.apiResult('getMe',{id:777});await assert.rejects(order(f),/Wrong bot/);f.apiResult('getMe',null);f.env.ASTRA_TELEGRAM_TEST_MODE='false';await assert.rejects(order(f));assert.ok(!f.out.some(r=>r.method==='sendInvoice'));integrity(f);
});
check('order snapshots, consent and invoice lease prevent repeated invoice calls',async f=>{
 f.user(1,0);payments(f);const a=await order(f,1,10,'same-key'),b=await order(f,1,10,'same-key');assert.equal(a.order_id,b.order_id);assert.ok(new TextEncoder().encode(a.payload).length<=128);
 await Promise.all(Array.from({length:20},()=>sendStarInvoice(f.env,a)));assert.equal(f.out.filter(r=>r.method==='sendInvoice').length,1);const invoice=f.out.find(r=>r.method==='sendInvoice').body;assert.equal(invoice.currency,'XTR');assert.equal(invoice.prices.length,1);assert.equal(invoice.prices[0].amount,10);assert.equal(f.balance(1),0);
 assert.throws(()=>f.db.exec("UPDATE astra_payment_orders SET dust=999"),/immutable/);
});
for(const error of [400,403,429,500,'network','malformed'])check(`invoice ${error} never credits and is never automatically resent`,async f=>{
 f.user(1,0);payments(f);const o=await order(f);f.apiFailure('sendInvoice',error);await assert.rejects(sendStarInvoice(f.env,o));f.apiFailure('sendInvoice',null);await sendStarInvoice(f.env,o);assert.equal(f.out.filter(r=>r.method==='sendInvoice').length,1);assert.equal(f.balance(1),0);assert.equal(count(f,'astra_payment_receipts'),0);integrity(f);
});
check('precheckout validates exact snapshot and reserves one query; no credit before success',async f=>{
 f.user(1,0);payments(f);const o=await order(f),q={id:'FAKE_PRE',from:{id:1},invoice_payload:o.payload,currency:'XTR',total_amount:10};
 for(const diff of [{from:{id:2}},{currency:'USD'},{total_amount:9},{invoice_payload:'forged'}])assert.equal(await reservePrecheckout(f.env,{...q,...diff}),false);
 const start=performance.now();assert.equal(await answerStarPrecheckout(f.env,q),true);assert.ok(performance.now()-start<1000);assert.equal(await reservePrecheckout(f.env,{...q,id:'SECOND_PRE'}),false);assert.equal(f.balance(1),0);assert.equal(count(f,'astra_payment_receipts'),0);
});
check('slow precheckout validation answers within budget and refuses the payment',async f=>{
 f.user(1,0);payments(f);const o=await order(f),prepare=f.env.DB.prepare;f.env.DB.prepare=sql=>{const h=prepare(sql);if(sql==='SELECT * FROM astra_policy WHERE singleton=1')h.first=()=>new Promise(resolve=>setTimeout(()=>resolve({payment_scope:'test',verified_bot_id:424242,support:'mailto:support@example.test',terms_version:'test',retention_days:365,stars_enabled:1}),7000));return h;};
 const start=performance.now();assert.equal(await answerStarPrecheckout(f.env,{id:'SLOW',from:{id:1},invoice_payload:o.payload,currency:'XTR',total_amount:10}),false);assert.ok(performance.now()-start<9500);assert.equal(f.balance(1),0);
});
check('successful payment is the only credit; duplicate updates/disabled shop retain one proof',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);f.env.STARS_SHOP_ENABLED='false';f.db.exec('UPDATE astra_policy SET stars_enabled=0');
 await Promise.all(Array.from({length:20},()=>receiveStarPayment(f.env,1,p)));assert.equal(f.balance(1),100);assert.equal(count(f,'astra_payment_receipts'),1);assert.equal(f.query("SELECT count(*) n FROM astra_wallet_ledger WHERE reason='payment:stars'").n,1);integrity(f);
});
check('forged owner/currency/amount and reused charge across orders never create extra credit',async f=>{
 f.user(1,0);f.user(2,0);payments(f);const o=await order(f),p=proof(o);for(const [owner,patch] of [[2,{}],[1,{total_amount:11}],[1,{currency:'USD'}]]){if(patch.currency)await assert.rejects(receiveStarPayment(f.env,owner,{...p,...patch}));else assert.equal((await receiveStarPayment(f.env,owner,{...p,...patch})).status,'needs_review');}
 assert.equal(f.balance(1),0);await receiveStarPayment(f.env,1,p);const second=await order(f,2);assert.equal((await receiveStarPayment(f.env,2,{...proof(second),telegram_payment_charge_id:p.telegram_payment_charge_id})).status,'needs_review');assert.equal(f.balance(1),100);assert.equal(f.balance(2),0);integrity(f);
});
check('a second actual charge for one order is durable needs_review and can be refunded without a debit',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);const extra=proof(o);assert.equal((await receiveStarPayment(f.env,1,extra)).status,'needs_review');assert.equal(f.balance(1),100);
 const refund=await requestStarRefund(f.env,extra.telegram_payment_charge_id);assert.equal(refund.status,'refunded');assert.equal(f.balance(1),100);assert.equal(debt(f),0);integrity(f);
});
check('ledger failure rolls back proof/tombstone/credit and retry posts once',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='payment:stars' BEGIN SELECT RAISE(ABORT,'fault'); END");await assert.rejects(receiveStarPayment(f.env,1,p));assert.equal(count(f,'astra_payment_receipts'),0);assert.equal(count(f,'astra_payment_tombstones'),0);assert.equal(f.balance(1),0);f.db.exec('DROP TRIGGER fault');await receiveStarPayment(f.env,1,p);assert.equal(f.balance(1),100);integrity(f);
});
for(const error of [400,403,429,500,'network','malformed'])check(`receipt sendMessage ${error} cannot repeat a credit or count activity`,async f=>{
 f.user(1,0);payments(f);const o=await order(f),u=f.message(1,'');u.message.successful_payment=proof(o);f.fail(error);assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),100);f.fail(null);assert.equal((await f.hook(u)).status,200);assert.equal(f.balance(1),100);assert.equal(count(f,'astra_activity_days'),0);assert.equal(count(f,'astra_policy_days'),0);integrity(f);
});
check('refund after spending creates exact debt, future credits repay it, old texts remain',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);
 for(let i=0;i<25;i++)f.db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES(?,1,'tarot',-3,'saved reading')").run('spent:'+i);
 assert.equal(f.balance(1),25);const r=await receiveStarRefund(f.env,1,p);assert.equal(r.removed,25);assert.equal(r.debt_added,75);assert.equal(f.balance(1),0);assert.equal(debt(f),75);await receiveStarRefund(f.env,1,p);assert.equal(debt(f),75);
 await f.hook(f.message(1,'gpt6'));assert.equal(debt(f),70);assert.equal(f.balance(1),0);const o2=await order(f,1,25);await receiveStarPayment(f.env,1,proof(o2));assert.equal(debt(f),0);assert.equal(f.balance(1),200);assert.equal(f.query("SELECT count(*) n FROM astra_operations WHERE result='saved reading'").n,25);integrity(f);
});
check('refund-before-success cannot create a ghost credit or debt',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarRefund(f.env,1,p);await receiveStarPayment(f.env,1,p);assert.equal(f.balance(1),0);assert.equal(debt(f),0);assert.equal(f.query('SELECT credited_dust FROM astra_payment_receipts').credited_dust,0);integrity(f);
});
check('20 refund requests obtain one SQL lease and one external API call',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);await Promise.all(Array.from({length:20},()=>requestStarRefund(f.env,p.telegram_payment_charge_id)));assert.equal(f.out.filter(r=>r.method==='refundStarPayment').length,1);assert.equal(f.balance(1),0);assert.equal(count(f,'astra_refund_settlements'),1);integrity(f);
});
for(const error of [400,403,500,'network','malformed'])check(`refund ${error} enters needs_review without a blind second refund`,async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.apiFailure('refundStarPayment',error);assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'needs_review');f.apiFailure('refundStarPayment',null);await requestStarRefund(f.env,p.telegram_payment_charge_id);assert.equal(f.out.filter(r=>r.method==='refundStarPayment').length,1);assert.equal(f.balance(1),100);await receiveStarRefund(f.env,1,p);assert.equal(f.balance(1),0);integrity(f);
});
check('refund external success plus D1 failure recovers by proof, without another API call',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_external_refunds BEGIN SELECT RAISE(ABORT,'fault'); END");assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'needs_review');assert.equal(f.balance(1),100);f.db.exec('DROP TRIGGER fault');await receiveStarRefund(f.env,1,p);await requestStarRefund(f.env,p.telegram_payment_charge_id);assert.equal(f.out.filter(r=>r.method==='refundStarPayment').length,1);assert.equal(f.balance(1),0);integrity(f);
});
check('reconciliation recovers a missed successful payment and later a refund from matching transactions',async f=>{
 f.user(1,0);payments(f);const o=await order(f),id='FAKE_RECONCILE';f.setStarTransactions([{id,amount:10,source:{type:'user',transaction_type:'invoice_payment',user:{id:1},invoice_payload:o.payload}}]);await reconcileStarPage(f.env);assert.equal(f.balance(1),100);await reconcileStarPage(f.env);assert.equal(f.balance(1),100);
 f.setStarTransactions([{id,amount:10,receiver:{type:'user',transaction_type:'invoice_payment',user:{id:1},invoice_payload:o.payload}}]);await reconcileStarPage(f.env);assert.equal(f.balance(1),0);integrity(f);
});
for(const fk of ['ON','OFF'])check(`delete with FK ${fk} retains disclosed payment proof/debt, rejoin does not erase debt`,async f=>{
 f.db.exec('PRAGMA foreign_keys='+fk);f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);for(let i=0;i<10;i++)f.db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES(?,1,'tarot',-3,'owned')").run('spent:'+i);await receiveStarRefund(f.env,1,p);assert.equal(debt(f),30);
 await f.hook(f.message(1,'/delete'));assert.equal(f.balance(1),undefined);assert.equal(count(f,'astra_payment_receipts'),1);assert.equal(f.query('SELECT owner_id FROM astra_payment_orders').owner_id,null);assert.equal(debt(f),30);await f.hook(f.message(1,'/start'));assert.equal(f.balance(1),0);assert.equal(debt(f),28);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);integrity(f);
});
check('payment arriving after profile deletion stays in suspense; refund has no negative dust',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await f.hook(f.message(1,'/delete'));const r=await receiveStarPayment(f.env,1,p);assert.equal(r.status,'needs_review');assert.equal(f.balance(1),undefined);assert.equal(count(f,'astra_payment_receipts'),0); // unpaid order removed; anomaly is retained
 assert.equal(count(f,'astra_payment_anomalies'),1);assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'refunded');assert.equal(debt(f),0);integrity(f);
});
check('retention dry-run is non-destructive; purge leaves only minimal anti-replay proof',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.db.exec("UPDATE astra_payment_orders SET updated_at='2020-01-01 00:00:00'");assert.equal((await purgePaymentData(f.env,true)).eligible,1);assert.equal(count(f,'astra_payment_receipts'),1);
 await purgePaymentData(f.env,false);assert.equal(count(f,'astra_payment_receipts'),0);assert.equal(count(f,'astra_payment_orders'),0);assert.equal(count(f,'astra_payment_tombstones'),1);assert.equal((await receiveStarPayment(f.env,1,p)).status,'archived');assert.equal(f.balance(1),100);
 await receiveStarRefund(f.env,1,p);assert.equal(f.balance(1),0);await receiveStarRefund(f.env,1,p);assert.equal(f.balance(1),0);integrity(f);
});
check('admin routes require header auth and configuration cannot silently enable shop',async f=>{
 const route=(path,body,auth)=>f.bot.fetch(new Request('https://astra.test'+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer FAKE_ADMIN'}:{})},body:JSON.stringify(body)}),f.env);
 assert.equal((await route('/internal/economy/policy',{action:'stop'},false)).status,403);Object.assign(f.env,{ASTRA_TELEGRAM_TEST_MODE:'true',ASTRA_PAYMENT_ENVIRONMENT_ACK:'DEDICATED_TELEGRAM_TEST_ENVIRONMENT_CONFIRMED'});
 assert.equal((await route('/internal/payments/configure',{support:'mailto:support@example.test',terms_version:'test-terms-v1',retention_days:365,bot_id:424242},true)).status,200);assert.equal((await readPolicy(f.env)).stars_enabled,0);assert.equal(count(f,'astra_payment_audit'),1);
});
check('stop across a scheduled cutover never reopens old awards; deferred new-profile initial is recovered once',async f=>{
 await clock('2026-12-31T20:59:59Z',async set=>{
  f.env.ASTRA_ECONOMY_V2_ENABLED='true';await armPolicy(f.env,'2027-01-01','2026-12-31');f.db.exec('UPDATE astra_policy SET enabled=0');set('2026-12-31T21:00:00Z');await f.hook(f.message(1,'/start'));assert.equal(f.balance(1),0);assert.equal((await readPolicy(f.env)).activated,1);
  await f.hook(f.message(1,'🎁 Бонус дня'));assert.equal(f.balance(1),0);f.db.exec('UPDATE astra_policy SET enabled=1');await f.hook(f.message(1,'/start'));assert.equal(f.balance(1),12);await f.hook(f.message(1,'/start'));assert.equal(f.balance(1),12);integrity(f);
 });
});
check('forwarded-invoice payer is not credited or shown another order, but can receive a zero-dust refund',async f=>{
 f.user(1,0);f.user(2,0);payments(f);const o=await order(f),p=proof(o);const u=f.message(2,'');u.message.successful_payment=p;assert.equal((await f.hook(u)).status,200);assert.doesNotMatch(last(f).text,new RegExp(o.order_id));assert.equal(f.balance(1),0);assert.equal(f.balance(2),0);
 assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'refunded');assert.equal(debt(f,2),0);integrity(f);
});
check('query/order identity, bot pinning, real private proof and disabled stale consent fail closed',async f=>{
 f.user(1,0);payments(f);const o=await order(f,1,10,'conflict-key');await assert.rejects(order(f,1,25,'conflict-key'),/snapshot conflict/);assert.throws(()=>f.db.exec('UPDATE astra_policy SET verified_bot_id=9'),/immutable/);
 const p=proof(o),u=f.message(1,'');u.message.chat.type='group';u.message.successful_payment=p;assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),0);
 const token=(await chargeHash('test-terms-v1')).slice(0,12);f.env.STARS_SHOP_ENABLED='false';await click(f,'stars:accept:10:'+token);assert.ok(!f.out.some(r=>r.method==='sendInvoice'));integrity(f);
});
check('refund 429 respects Retry-After and does not repeat before the deadline',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.apiFailure('refundStarPayment',429);assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'requested');f.apiFailure('refundStarPayment',null);await requestStarRefund(f.env,p.telegram_payment_charge_id);assert.equal(f.out.filter(r=>r.method==='refundStarPayment').length,1);assert.equal(f.balance(1),100);integrity(f);
});
check('refunded_payment service message is idempotent and never awards activity',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);const u=f.message(1,'');u.message.refunded_payment=p;assert.equal((await f.hook(u)).status,200);assert.equal((await f.hook(u)).status,200);assert.equal(f.balance(1),0);assert.equal(count(f,'astra_activity_days'),0);assert.equal(count(f,'astra_policy_days'),0);integrity(f);
});
check('an expired API lease is reconciled rather than sent again, including explicit missed transaction recovery',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);const hash=await chargeHash(p.telegram_payment_charge_id);f.db.prepare("INSERT INTO astra_refund_requests(charge_hash,status,lease_until) VALUES(?,'in_progress',0)").run(hash);
 assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'in_progress');assert.equal(f.out.filter(r=>r.method==='refundStarPayment').length,0);
 f.setStarTransactions([{id:p.telegram_payment_charge_id,amount:10,receiver:{type:'user',transaction_type:'invoice_payment',user:{id:1},invoice_payload:o.payload}}]);await reconcileStarPage(f.env);assert.equal(f.balance(1),0);assert.equal(f.query('SELECT status FROM astra_refund_requests').status,'refunded');integrity(f);
});
check('immutable receipts and settlements reject financial rewrites',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);assert.throws(()=>f.db.exec("UPDATE astra_payment_receipts SET credited_dust=0"),/immutable/);await receiveStarRefund(f.env,1,p);assert.throws(()=>f.db.exec('UPDATE astra_refund_settlements SET removed=0'),/immutable/);integrity(f);
});
check('multiple paid/refunded orders purge without orphan repayments; a later archived refund still creates exact debt',async f=>{
 f.user(1,0);payments(f);const a=await order(f),b=await order(f,1,25),pa=proof(a),pb=proof(b);await receiveStarPayment(f.env,1,pa);await receiveStarPayment(f.env,1,pb);
 for(let i=0;i<115;i++)f.db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES(?,1,'tarot',-3,'retained interpretation')").run('spent:'+i);
 await receiveStarRefund(f.env,1,pa);assert.equal(debt(f),75);const c=await order(f);await receiveStarPayment(f.env,1,proof(c));assert.equal(f.balance(1),25);assert.equal(debt(f),0);integrity(f);
 f.db.exec("UPDATE astra_payment_orders SET updated_at='2020-01-01 00:00:00';UPDATE astra_refund_accounts SET updated_at='2020-01-01 00:00:00'");await purgePaymentData(f.env,false);assert.equal(count(f,'astra_payment_orders'),0);assert.equal(count(f,'astra_debt_repayments'),0);assert.equal(count(f,'astra_refund_accounts'),0);assert.equal(f.balance(1),25);
 await receiveStarRefund(f.env,1,pb);assert.equal(f.balance(1),0);assert.equal(debt(f),245);assert.equal(f.query("SELECT count(*) n FROM astra_operations WHERE result='retained interpretation'").n,115);integrity(f);
});
check('archived transaction recovery can verify an operator refund without recrediting the old payment',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.db.exec("UPDATE astra_payment_orders SET updated_at='2020-01-01 00:00:00'");await purgePaymentData(f.env,false);
 f.setStarTransactions([{id:p.telegram_payment_charge_id,amount:10,source:{type:'user',transaction_type:'invoice_payment',user:{id:1},invoice_payload:o.payload}}]);await reconcileStarPage(f.env,0,true);assert.equal(f.balance(1),100);assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'refunded');assert.equal(f.balance(1),0);integrity(f);
});
check('fractional or negative-direction invoice transactions are durable review cases, never rounded into credit',async f=>{
 f.user(1,0);payments(f);const o=await order(f);f.setStarTransactions([{id:'FAKE_NANOSTAR',amount:10,nanostar_amount:1,source:{type:'user',transaction_type:'invoice_payment',user:{id:1},invoice_payload:o.payload}},{id:'FAKE_NEGATIVE',amount:-10,source:{type:'user',transaction_type:'invoice_payment',user:{id:1},invoice_payload:o.payload}}]);const r=await reconcileStarPage(f.env);assert.equal(r.needs_review,2);assert.equal(f.balance(1),0);assert.equal(count(f,'astra_payment_anomalies'),2);await assert.rejects(requestStarRefund(f.env,'FAKE_NANOSTAR'));integrity(f);
});
check('invoice history is complete, owned, bounded and frozen across new orders',async f=>{
 f.user(1,0);f.user(2,0);payments(f);for(let i=0;i<25;i++)await order(f,1,10,'history:'+i);const other=await order(f,2);
 await click(f,'stars:history');const body=last(f);assert.ok(body.text.length<4096);const next=body.reply_markup.inline_keyboard.flat().find(b=>b.text==='Старее ›').callback_data;assert.ok(Buffer.byteLength(next)<=64);await click(f,next.slice(6));assert.doesNotMatch(last(f).text,new RegExp(other.order_id));
 await click(f,next.slice(6),2);assert.match(last(f).text,/Курсор устарел/);integrity(f);
});
check('policy runtime stop is reported by health and Stars remains closed after configuration',async f=>{
 activate(f);f.env.ASTRA_ECONOMY_V2_ENABLED='false';assert.equal((await f.bot.fetch(new Request('https://astra.test/health'),f.env)).status,503);
});
check('a failed invitee ledger rolls back both referral rewards and the second policy day',async f=>{
 f.user(1,2);activate(f);await clock('2026-11-07T09:00:00Z',async set=>{
  await f.hook(f.message(2,'/start ref_1'));await sign(f,2);const before=f.balance(2);set('2026-11-08T09:00:00Z');
  f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='reward:v2:invitee' BEGIN SELECT RAISE(ABORT,'fault'); END");const u=f.message(2,'/start');assert.equal((await f.hook(u)).status,500);assert.equal(f.balance(1),2);assert.equal(f.balance(2),before);assert.equal(count(f,'astra_referral_payouts'),0);assert.equal(count(f,'astra_policy_days'),1);
  f.db.exec('DROP TRIGGER fault');await f.hook(u);assert.equal(f.balance(1),16);assert.equal(f.balance(2),before+7);assert.equal(count(f,'astra_referral_payouts'),1);integrity(f);
 });
});
check('a refund ledger fault rolls back settlement/debt and recovers without a second API refund',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='refund:cash' BEGIN SELECT RAISE(ABORT,'fault'); END");
 assert.equal((await requestStarRefund(f.env,p.telegram_payment_charge_id)).status,'needs_review');assert.equal(f.balance(1),100);assert.equal(count(f,'astra_refund_settlements'),0);assert.equal(count(f,'astra_external_refunds'),0);assert.equal(debt(f),0);
 f.db.exec('DROP TRIGGER fault');await receiveStarRefund(f.env,1,p);await requestStarRefund(f.env,p.telegram_payment_charge_id);assert.equal(f.out.filter(r=>r.method==='refundStarPayment').length,1);assert.equal(f.balance(1),0);integrity(f);
});
check('repayment ledger failure rolls back the new paid receipt and retries exact debt clearance',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.db.exec("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES('spent',1,'tarot',-3,'kept')");await receiveStarRefund(f.env,1,p);assert.equal(debt(f),3);
 const o2=await order(f),p2=proof(o2);f.db.exec("CREATE TRIGGER fault BEFORE INSERT ON astra_wallet_ledger WHEN NEW.reason='refund:repayment' BEGIN SELECT RAISE(ABORT,'fault'); END");await assert.rejects(receiveStarPayment(f.env,1,p2));assert.equal(f.balance(1),0);assert.equal(debt(f),3);assert.equal(count(f,'astra_payment_receipts'),1);
 f.db.exec('DROP TRIGGER fault');await receiveStarPayment(f.env,1,p2);assert.equal(f.balance(1),97);assert.equal(debt(f),0);integrity(f);
});
check('invoice expiry refuses a stale precheckout, while a confirmed late payment remains accountable',async f=>{
 f.user(1,0);payments(f);await clock('2027-01-01T09:00:00Z',async set=>{const o=await order(f);set('2027-01-02T09:00:01Z');assert.equal(await reservePrecheckout(f.env,{id:'EXPIRED',from:{id:1},invoice_payload:o.payload,currency:'XTR',total_amount:10}),false);await receiveStarPayment(f.env,1,proof(o));assert.equal(f.balance(1),100);});integrity(f);
});
check('financial FAQ, privacy callback and rules stay truthful after cutover and default-off Stars',async f=>{
 f.user(1,2);activate(f);await click(f,'faq:4:more');assert.match(last(f).text,/12 ✨/);assert.match(last(f).text,/выключен/);assert.doesNotMatch(last(f).text,/Начальный баланс: 2/);await click(f,'trust:dust');assert.match(last(f).text,/долг/);
 await click(f,'faq:5:more');assert.match(last(f).text,/автоматически/);await click(f,'faq:10:more');assert.match(last(f).text,/отключён/);await click(f,'privacy');assert.match(last(f).text,/долг/i);await click(f,'rules');assert.match(last(f).text,/сохраняются/);integrity(f);
});
check('published read-only integrity queries verify a paid, spent, refunded and repaid profile',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);f.db.exec("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES('spent',1,'tarot',-3,'kept')");await receiveStarRefund(f.env,1,p);await f.hook(f.message(1,'gpt6'));
 const sql=fs.readFileSync(new URL('../scripts/check_integrity_2_4.sql',import.meta.url),'utf8');for(const row of f.db.prepare(sql.split('PRAGMA')[0]).all())assert.equal(row.violations,0,row.check_name);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);integrity(f);
});
check('reconciliation bounds each HTTP batch to five transactions before advancing offset',async f=>{
 f.user(1,0);payments(f);const o=await order(f);f.setStarTransactions(Array.from({length:20},(_,i)=>({id:'FAKE_BOUNDED_'+i,amount:10,source:{type:'user',transaction_type:'invoice_payment',user:{id:1},invoice_payload:o.payload}})));
 const r=await reconcileStarPage(f.env,10);assert.equal(r.scanned,5);assert.equal(r.next_offset,15);assert.equal(f.out.find(x=>x.method==='getStarTransactions').body.limit,5);assert.equal(count(f,'astra_payment_receipts'),1);assert.equal(count(f,'astra_payment_anomalies'),4);assert.equal(f.balance(1),100);integrity(f);
});
check('repeated profile deletion cannot collide repayment keys or bypass debt with reused opening/GPT6 ledger keys',async f=>{
 f.user(1,0);payments(f);const o=await order(f),p=proof(o);await receiveStarPayment(f.env,1,p);for(let i=0;i<30;i++)f.db.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES(?,1,'tarot',-3,'kept')").run('spent:'+i);await receiveStarRefund(f.env,1,p);assert.equal(debt(f),90);
 for(let i=0;i<3;i++){await f.hook(f.message(1,'/delete'));assert.equal((await f.hook(f.message(1,'/start'))).status,200);assert.equal(f.balance(1),0);assert.equal((await f.hook(f.message(1,'gpt6'))).status,200);assert.equal(f.balance(1),0);assert.equal(debt(f),90-7*(i+1));integrity(f);}
 assert.equal(count(f,'astra_debt_repayments'),6);assert.equal(f.query("SELECT count(DISTINCT generation) n FROM astra_debt_repayments").n,3);
});
check('reward backlog commits at most five original dates per attempt and resumes without duplicate milestones',async f=>{
 f.user(1,2);activate(f);const p=await readPolicy(f.env);for(let i=0;i<6;i++)await capturePolicyEvent(f.env,{id:1,source:'message',signSelection:false},9000+i,'2026-11-'+String(1+i).padStart(2,'0'),p);
 await assert.rejects(settlePolicyEvents(f.env,1),/backlog/);assert.equal(count(f,'astra_policy_days'),5);assert.equal(f.balance(1),20);await settlePolicyEvents(f.env,1);assert.equal(count(f,'astra_policy_days'),6);assert.equal(f.balance(1),23);await settlePolicyEvents(f.env,1);assert.equal(f.balance(1),23);integrity(f);
});
