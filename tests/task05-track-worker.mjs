// Test-only accounting; never bundled. Count actual calls to the final module export per node:test.
import {beforeEach,afterEach} from 'node:test';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import worker from '../release/ASTRA_2_4_WORKER.js';
const directory=process.env.ASTRA_TEST_AUDIT_DIR;if(!directory)throw Error('Set a local ASTRA_TEST_AUDIT_DIR');fs.mkdirSync(directory,{recursive:true});let current=null;
const sha=createHash('sha256').update(fs.readFileSync(new URL('../release/ASTRA_2_4_WORKER.js',import.meta.url))).digest('hex');
for(const method of ['fetch','scheduled']){const original=worker[method];worker[method]=function(...args){if(current)current[method]++;return original.apply(this,args);};}
beforeEach(t=>{current={file:path.basename(process.argv[1]),test:t.name,worker_sha256:sha,fetch:0,scheduled:0};});
afterEach(()=>{if(current)fs.appendFileSync(path.join(directory,path.basename(process.argv[1])+'.jsonl'),JSON.stringify(current)+'\n');current=null;});
