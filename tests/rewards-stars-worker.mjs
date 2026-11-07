import {workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {capturePolicyEvent,settlePolicyEvents,readPolicy,policyClaim} from '../src/rewards/policy.mjs';
import {receiveStarPayment,receiveStarRefund} from '../src/payments/service.mjs';
import {purchaseForecast} from '../src/forecast/service.mjs';
const db=new DatabaseSync(workerData.file);db.exec('PRAGMA busy_timeout=15000');
const env={ASTRA_TELEGRAM_TEST_MODE:'true',ASTRA_ECONOMY_V2_ENABLED:'true',DB:{prepare(sql){const st=db.prepare(sql);let args=[];return{bind(...a){args=a;return this;},async first(){await Promise.resolve();return st.get(...args)??null;},async all(){await Promise.resolve();return {results:st.all(...args)};},async run(){await Promise.resolve();return {meta:{changes:Number(st.run(...args).changes)}};}};}}};
try{
 const w=workerData;
 if(w.kind==='register')db.prepare("INSERT OR IGNORE INTO astra_users(telegram_id,zodiac) VALUES(3,NULL)").run();
 else if(w.kind==='channel')await policyClaim(env,1,'channel','2026-11-08',8);
 else if(w.kind==='daily'||w.kind==='referral'){
  const owner=w.kind==='referral'?2:1;await capturePolicyEvent(env,{id:owner,source:'callback',signSelection:false},1000+w.index,'2026-11-08',await readPolicy(env));await settlePolicyEvents(env,owner);
 }else if(w.kind==='receipt')await receiveStarPayment(env,1,w.proof);
 else if(w.kind==='refund')await receiveStarRefund(env,1,w.proof);
 else if(w.kind==='purchase')await purchaseForecast(env,1,'aries','2026-11-08');
 else throw Error('Unknown concurrency case');
}finally{db.close();}
