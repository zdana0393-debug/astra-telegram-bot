// Local synthetic review only. fixture intercepts every HTTP request.
import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';import {createHash} from 'node:crypto';import {performance} from 'node:perf_hooks';
import {taskFixture,setupFence,activate,sign,click,last,members} from '../tests/task01-helpers.mjs';
const root=new URL('../',import.meta.url),write=(p,s)=>fs.writeFileSync(new URL(p,root),s),hash=s=>createHash('sha256').update(s).digest('hex');
const unchanged=JSON.parse(fs.readFileSync(new URL('data/task01-protected-hashes.json',root))).files;
for(const row of unchanged)assert.equal(hash(fs.readFileSync(new URL(row.path,root))),row.sha256,row.path);
const f=taskFixture(),records=[];let log=console.log;
try{
 await setupFence(f);activate(f);members(f);f.env.ASTRA_D1_DIAGNOSTICS='true';let pending=[];
 console.log=value=>{if(typeof value==='string'&&value.startsWith('{'))pending.push(JSON.parse(value));};
 const measure=async(name,work)=>{pending=[];assert.equal((await work()).status,200);assert.equal(pending.length,1);const r=pending[0];assert.ok(r.d1_calls<=50,name+':'+r.d1_calls);records.push({scenario:name,...r});};
 await measure('new start',()=>f.hook(f.message(1,'/start')));await measure('first sign',()=>sign(f,1));await measure('repeat visit',()=>f.hook(f.message(1,'/start')));
 await measure('invitee start',()=>f.hook(f.message(2,'/start ref_1')));await measure('invitee first sign',()=>sign(f,2));
 await measure('channel referral',()=>{const q=f.click(2);q.callback_query.data='channel:check';return f.hook(q);});await measure('GPT6',()=>f.hook(f.message(2,'gpt6')));
 await measure('history',()=>click(f,'dust:history',2));await measure('Tarot price confirmation',()=>click(f,'buy',2));const token=last(f).reply_markup.inline_keyboard.flat().find(b=>b.text==='Подтвердить — 5 ✨').callback_data.slice(6);await measure('Tarot five debit',()=>click(f,token,2));await measure('Tarot paid read',()=>click(f,token,2));
 await measure('delete',()=>f.hook(f.message(2,'/delete')));await measure('repeat start fenced',()=>f.hook(f.message(2,'/start ref_1')));await measure('repeat sign fenced',()=>sign(f,2));assert.equal(f.balance(2),0);assert.equal(f.reconcile(),0);
 console.log=log;f.env.ASTRA_D1_DIAGNOSTICS='false';
 let examples='# TASK 01 — полученные от локального Worker финансовые экраны\n\n9 ноября 2026. Синтетические профили, fake Telegram, локальный SQLite. Флаги включались только в fixtures. Не редактура интерфейса следующего этапа.\n\n';
 for(const [title,page,id] of [['Подтверждение новой цены','buy',1],['Финансовая история','dust:history',1],['Новые награды','dust',1],['Магазин OFF','dust:shop',1]]){await click(f,page,id);examples+=`## ${title}\n\n\`\`\`text\n${last(f).text}\n\`\`\`\n\n`;}
 await f.hook(f.message(1,'/privacy'));examples+='## Уведомление об исключении после удаления\n\n```text\n'+last(f).text+'\n```\n';write('docs/ASTRA_2_4_TASK_01_SCREENS.md',examples);
}finally{console.log=log;f.close();}
const code=fs.readFileSync(new URL('release/ASTRA_2_4_WORKER.js',root),'utf8'),samples=[];for(let i=0;i<20;i++){const start=performance.now();vm.runInNewContext(code.replace('export default {','globalThis.worker={'),{structuredClone});samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
const economics=[1,7,30,90,365].map(days=>{const dust=5+2*days+(days>=3?3:0)+4*Math.floor(days/7)+(days>=30?6:0);return{days,dust,tarot5_without_other_spending:Math.floor(dust/5),extended4_without_other_spending:Math.floor(dust/4)};});assert.deepEqual(economics.map(r=>r.dust),[7,26,90,242,952]);
write('docs/ASTRA_2_4_TASK_01_METRICS.json',JSON.stringify({date_msk:'2026-11-09',runtime:process.version,worker_bytes:Buffer.byteLength(code),worker_sha256:hash(code),schema_objects:JSON.parse(fs.readFileSync(new URL('data/payment-schema-manifest.json',root))).length,approved_economics:economics,invocations:records,cold_local_vm:{samples:20,median_ms:samples[10],p95_ms:samples[19]},unchanged,limitation:'Local Node wall time and adapter call counts, NOT Cloudflare CPU, NOT D1 rows_read/rows_written. Real 10ms/50 D1 calls/500MB gates remain unmeasured. Batch = one API call, each internal statement still counted separately; first() omits production metadata.'},null,2)+'\n');
console.log('TASK01 direct Worker screens, immutable source hashes, economics and local invocation metrics generated; no external calls.');
