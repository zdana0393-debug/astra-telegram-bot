import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {DatabaseSync} from 'node:sqlite';import {Worker} from 'node:worker_threads';import {uiFixture,offer} from './tarot25-ui-helpers.mjs';
for(const callbacks of [2,20,100])test(`actual candidate ${callbacks} confirmations / ${Math.min(callbacks,20)} WAL connections, one initial send`,async()=>{
 const f=uiFixture(),dir=fs.mkdtempSync(join(tmpdir(),'t25-ui-')),file=join(dir,'state.sqlite');let db;
 try{f.enable();const button=await offer(f,6);f.db.exec('CREATE TABLE local_ui25_delivery(body TEXT)');f.db.exec("VACUUM INTO '"+file+"'");db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL;PRAGMA busy_timeout=30000');
  const threads=Math.min(callbacks,20),barrier=new SharedArrayBuffer(8),view=new Int32Array(barrier);
  const tasks=Array.from({length:threads},(_,offset)=>new Promise((resolve,reject)=>{let result;const w=new Worker(new URL('./tarot25-ui-worker.mjs',import.meta.url),{workerData:{file,button,offset,calls:callbacks/threads,barrier}});w.on('message',r=>result=r);w.on('error',reject);w.on('exit',c=>c?reject(Error('UI WAL worker '+c)):resolve(result));}));
  const deadline=Date.now()+25000;try{while(Atomics.load(view,0)<threads){assert.ok(Date.now()<deadline,'All Worker invocations reached pre-purchase INSERT');await new Promise(r=>setTimeout(r,10));}}finally{Atomics.store(view,1,1);Atomics.notify(view,1);}
  const results=(await Promise.all(tasks)).flat();assert.equal(results.length,callbacks);assert.ok(results.every(c=>c===200),JSON.stringify(results));
  const paid=db.prepare('SELECT * FROM astra_tarot25_purchases29').get();assert.equal(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=1').get().balance,68);assert.equal(paid.attempts,1);assert.equal(paid.delivery,'sent');assert.equal(db.prepare('SELECT count(*) n FROM astra_tarot25_purchases29').get().n,1);assert.equal(db.prepare("SELECT count(*) n FROM astra_wallet_ledger WHERE reason='tarot:v25'").get().n,1);
  const delivered=db.prepare('SELECT body FROM local_ui25_delivery ORDER BY rowid').all().filter(x=>paid.result.includes(x.body));assert.equal(delivered.map(x=>x.body).join(''),paid.result);
 }finally{db?.close();f.close();fs.rmSync(dir,{recursive:true,force:true});}
});
