import {receiveStarRefund} from '../src/task01/payments.mjs';
import {workerData as w,parentPort} from 'node:worker_threads';import {DatabaseSync} from 'node:sqlite';import {prepareOffer,confirmPurchase,retryDelivery,cancelOffer} from '../src/tarot25/purchases29.mjs';
const db=new DatabaseSync(w.file);db.exec('PRAGMA foreign_keys='+ (w.fk||'ON'));db.exec('PRAGMA busy_timeout=30000');
let barrierPassed=false;
const DB={async batch(ss){db.exec('BEGIN IMMEDIATE');try{const r=ss.map(s=>s._runSync());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},prepare(sql){const st=db.prepare(sql);let args=[];return{bind(...a){args=a;return this;},async first(){return st.get(...args)??null;},async all(){return{results:st.all(...args)};},async run(){if(w.barrier&&!barrierPassed&&sql.startsWith('INSERT INTO astra_tarot25_purchases29')){barrierPassed=true;const view=new Int32Array(w.barrier);Atomics.add(view,0,1);if(Atomics.load(view,1)===0&&Atomics.wait(view,1,0,30000)==='timed-out')throw Error('SQL write barrier timed out');}return this._runSync();},_runSync(){return{meta:{changes:Number(st.run(...args).changes)}};}};}};
globalThis.fetch=()=>{throw Error('No network allowed');};
const env={DB,ASTRA_TAROT25_ENABLED:'true',ASTRA_TELEGRAM_TEST_MODE:'true'},actor={telegram_id:1,generation:w.generation};
try{const results=await Promise.all(Array.from({length:w.calls||1},async(_,i)=>{try{
 if(w.action==='prepare'){const o=await prepareOffer(env,actor,{spread_id:'depth-7',request_key:'same-prepare',update_id:9000});return{ok:true,id:o.offer_id};}
 if(w.action==='refund'){await receiveStarRefund(env,1,w.proof);return{ok:true};}
 if(w.action==='delete'){db.exec('DELETE FROM astra_users WHERE telegram_id=1');return{ok:true};}
 const id=w.offers[(w.offset+i)%w.offers.length];
 if(w.action==='cancel'){await cancelOffer(env,actor,id);return{ok:true};}
 if(w.action==='deliver'){const result=await retryDelivery(env,actor,id,{send:async({text})=>{db.prepare('INSERT INTO local_delivery29(offer_id,part) VALUES(?,?)').run(id,text);if(w.unknown)throw Error('Synthetic acceptance unknown');return true;}});return{ok:true,state:result.state};}
 const paid=await confirmPurchase(env,actor,id);return{ok:true,id:paid.offer_id,price:paid.price};
 }catch(e){return{ok:false,code:e.code||e.message};}}));parentPort.postMessage(results);}finally{db.close();}
