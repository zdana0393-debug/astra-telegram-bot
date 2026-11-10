import {workerData as w} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {bonusCommand26,syncBonusOwner26,task01Env} from '../src/task01/bonus.mjs';
import {receiveStarPayment,receiveStarRefund} from '../src/task01/payments.mjs';
const db=new DatabaseSync(w.file);db.exec('PRAGMA busy_timeout=30000');db.exec('PRAGMA foreign_keys=ON');
const DB={async batch(statements){db.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s._runSync());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},prepare(sql){const st=db.prepare(sql);let a=[];return{bind(...v){a=v;return this;},async first(){return st.get(...a)??null;},async all(){return{results:st.all(...a)};},async run(){return this._runSync();},_runSync(){return{meta:{changes:Number(st.run(...a).changes)}};}};}};
const env=task01Env({...w.env,DB});
try{
 if(w.kind==='initial'){db.prepare("INSERT OR IGNORE INTO astra_users(telegram_id,zodiac) VALUES(3,'aries')").run();await bonusCommand26(env,3,'initial');}
 else if(w.kind==='channel'||w.kind==='referral')await bonusCommand26(env,2,w.kind,{channel:'@examplechannel'});
 else if(w.kind==='daily'){
  await syncBonusOwner26(env,1);db.prepare("INSERT OR IGNORE INTO astra_policy_events(update_id,telegram_id,day,source,legacy,processed) VALUES(?,1,'2026-11-09','callback',0,0)").run(1000+w.index);
  db.prepare("INSERT OR IGNORE INTO astra_bonus_days26(telegram_id,day,streak,event_id,awarded_at) VALUES(1,'2026-11-09',1,?,?)").run(1000+w.index,Math.floor(Date.now()/1000));
 }else if(w.kind==='receipt')await receiveStarPayment(env,1,w.proof);
 else if(w.kind==='refund')await receiveStarRefund(env,1,w.proof);
 else if(w.kind==='purchase')db.prepare("INSERT OR IGNORE INTO astra_tarot_purchases26(offer_id,telegram_id,price,result) VALUES('race-offer',1,5,'ONE IMMUTABLE PAID RESULT')").run();
 else throw Error('Unknown case '+w.kind);
}finally{db.close();}
