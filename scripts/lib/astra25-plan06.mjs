import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {ROOT25,SQL25,ORIGIN25,sha25,canonical25,objects25,schemaDigest25,stop25} from './astra25-upgrade-plan.mjs';
export {ROOT25,sha25,canonical25,objects25,schemaDigest25,stop25};
export const COMPAT05='astra25-before-0025-referrers.v1';
export const PATHS06=[ORIGIN25,...SQL25.slice(0,4),'migrations/compat/'+COMPAT05+'.sql',...SQL25.slice(4),'migrations/0030_tarot_retention.sql'];
export const STAGES06=['2.0','0021','0022','0023','0024',COMPAT05,'0025','0026','0027','0028','0029','0030'];
export const CANDIDATE06='release/ASTRA_2_5_TASK06_CANDIDATE.js';
export const PLAN06=ROOT25+'data/astra25-upgrade-plan-task06.json';
export function generatePlan06(){const db=new DatabaseSync(':memory:'),sources=[],stages=[];try{db.exec('PRAGMA foreign_keys=ON');for(const [i,path]of PATHS06.entries()){
 const sql=fs.readFileSync(ROOT25+path,'utf8');sources.push({path,sha256:sha25(sql),bytes:Buffer.byteLength(sql),id:STAGES06[i]});db.exec('BEGIN IMMEDIATE');try{db.exec(sql);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 const objects=objects25(db);stages.push({stage:STAGES06[i],source:path,object_count:objects.length,objects,ddl_sha256:schemaDigest25(objects),user_version:0});
 }const body={version:'astra25-local-upgrade-v3',local_only:true,sources,stages,candidate:{path:CANDIDATE06,sha256:sha25(fs.readFileSync(ROOT25+CANDIDATE06))},compatibility:{id:COMPAT05,before:'0025',change:'Only dangling astra_users.referrer_id becomes NULL; all other fields and money immutable',public_ids:false}};return {...body,plan_sha256:sha25(canonical25(body))};}finally{db.close();}}
export function verifyPlan06(p,reader=rel=>fs.readFileSync(ROOT25+rel)){const {plan_sha256,...body}=p;if(p.version!=='astra25-local-upgrade-v3'||p.local_only!==true||sha25(canonical25(body))!==plan_sha256)stop25('PLAN06_HASH');
 if(p.sources.length!==PATHS06.length||p.stages.length!==PATHS06.length)stop25('PLAN06_ORDER');for(let i=0;i<PATHS06.length;i++){const s=p.sources[i],d=p.stages[i];if(s.path!==PATHS06[i]||s.id!==STAGES06[i]||d.stage!==STAGES06[i]||d.source!==s.path||d.user_version!==0||d.object_count!==d.objects.length||!s.sha256||sha25(reader(s.path))!==s.sha256||schemaDigest25(d.objects)!==d.ddl_sha256)stop25('PLAN06_SOURCE_OR_ORDER');}
 if(p.candidate.path!==CANDIDATE06||sha25(reader(CANDIDATE06))!==p.candidate.sha256)stop25('CANDIDATE06_CHANGED');return p;}

export function loadPlan06(){return verifyPlan06(JSON.parse(fs.readFileSync(PLAN06,'utf8')));}
