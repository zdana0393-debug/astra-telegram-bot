import {workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {recordActivity} from '../src/economy/activity.mjs';
const db=new DatabaseSync(workerData.file);db.exec('PRAGMA busy_timeout=10000');
const env={DB:{prepare(sql){const statement=db.prepare(sql);let args=[];return{bind(...values){args=values;return this;},async first(){return statement.get(...args)??null;},async run(){return{meta:{changes:Number(statement.run(...args).changes)}};}};}}};
try{if(!await recordActivity(env,1,'2027-01-01','callback'))throw Error('Missing registered owner');}finally{db.close();}
