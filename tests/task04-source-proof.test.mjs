import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
test('all accepted engine/financial/HMAC/Cron sources, SQL0021–27 and owner TASK05 clarifications remain byte-identical',()=>{const proof=JSON.parse(fs.readFileSync('data/task04-protected-hashes.json'));assert.ok(Object.keys(proof.files).length>60);for(const [p,h]of Object.entries(proof.files))assert.equal(sha(fs.readFileSync(p)),h,p);});
test('removing declared UI adapters reverses the final Worker exactly to accepted TASK03 SHA',()=>{
 let worker=fs.readFileSync('release/ASTRA_2_4_WORKER.js','utf8');const proof=JSON.parse(fs.readFileSync('data/task04-patch-proof.json'));assert.equal(proof.base_worker_sha256,'766e17438d423303445dfd64664ec1cc3a8cb72177053c97ac67735f5e69ecd1');
 const start=worker.indexOf('\n// TASK04 presentation adapters.'),end=worker.indexOf('const astraWorker = {',start);assert.ok(start>0&&end>start);worker=worker.slice(0,start)+worker.slice(end);
 for(const {from,to}of proof.changes.toReversed()){assert.equal(worker.split(to).length,2,to.slice(0,100));worker=worker.replace(to,from);}assert.equal(sha(worker),proof.base_worker_sha256);
});
