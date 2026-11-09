import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const proof=JSON.parse(fs.readFileSync('docs/ASTRA_2_4_TASK_03_PROTECTED_SHA256.json','utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
test('the final Worker reverses exactly to the accepted TASK02B artifact after removing only declared TASK03 adapters',()=>{
 let s=fs.readFileSync('release/ASTRA_2_4_WORKER.js','utf8');const start=s.indexOf('\n// TASK03 broadcast delivery only.'),end=s.indexOf('const astraWorker = {',start);assert.ok(start>0&&end>start);s=s.slice(0,start)+s.slice(end);
 s=s.replace("'ASTRA-2.4-task03'","'ASTRA-2.4-task02'");for(const name of ['broadcast','sendForecastText','sendFreeForecast','health'])s=s.replace('async function pre03_'+name+'(','async function '+name+'(');
 s=s.replace('INSERT OR IGNORE INTO astra_users(telegram_id,referrer_id,created_at,notifications_enabled) VALUES(?,?,?,0)','INSERT OR IGNORE INTO astra_users(telegram_id,referrer_id,created_at) VALUES(?,?,?)');
 s=s.replace("\n  const datedForecast03=/^forecast:(offer|owned):(\\d{4}-\\d{2}-\\d{2})$/.exec(page);\n  if(datedForecast03)return forecastExtended(env,id,u,datedForecast03[1]==='owned'?'repeat':'confirm',datedForecast03[2]);",'');
 s=s.replace("const recognized=/^forecast:(?:offer|owned):\\d{4}-\\d{2}-\\d{2}$/.test(page||'')||",'const recognized=');assert.equal(hash(s),proof.base_worker_sha256);
});
test('all accepted symbolic/editorial, economic, payment, HMAC sources and financial migrations remain byte-identical',()=>{
 const files=Object.entries(proof.files);assert.ok(files.length>50);for(const [p,sha] of files)assert.equal(hash(fs.readFileSync(p)),sha,p);
});
