import {workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {purchaseForecast} from '../src/forecast/service.mjs';
const db=new DatabaseSync(workerData.file);db.exec('PRAGMA busy_timeout=10000');
const env={DB:{prepare(sql){const stmt=db.prepare(sql);let args=[];return{bind(...a){args=a;return this;},async first(){return stmt.get(...args)??null;},async run(){return{meta:{changes:Number(stmt.run(...args).changes)}};}};}}};
try{const row=await purchaseForecast(env,1,'aries',workerData.day);if(!row)throw Error('Purchase was not recoverable');}finally{db.close();}
