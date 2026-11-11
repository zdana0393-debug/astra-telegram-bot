import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {ROOT25,SQL25,ORIGIN25,sha25,canonical25,objects25,schemaDigest25,stop25} from './astra25-upgrade-plan.mjs';
export {ROOT25,sha25,canonical25,objects25,schemaDigest25,stop25};
export const COMPAT05='astra25-before-0025-referrers.v1';
export const PATHS07=[ORIGIN25,...SQL25.slice(0,4),'migrations/compat/'+COMPAT05+'.sql',...SQL25.slice(4),'migrations/0030_tarot_retention.sql','migrations/0031_tarot_intents.sql'];
export const STAGES07=['2.0','0021','0022','0023','0024',COMPAT05,'0025','0026','0027','0028','0029','0030','0031'];
export const CANDIDATE07='release/ASTRA_2_5_TASK07_CANDIDATE.js';
export const PLAN07=ROOT25+'data/astra25-upgrade-plan-task07.json';
export function generatePlan07(){const db=new DatabaseSync(':memory:'),sources=[],stages=[];try{db.exec('PRAGMA foreign_keys=ON');for(const [i,path]of PATHS07.entries()){
 const sql=fs.readFileSync(ROOT25+path,'utf8');sources.push({path,sha256:sha25(sql),bytes:Buffer.byteLength(sql),id:STAGES07[i]});db.exec('BEGIN IMMEDIATE');try{db.exec(sql);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 const objects=objects25(db);stages.push({stage:STAGES07[i],source:path,object_count:objects.length,objects,ddl_sha256:schemaDigest25(objects),user_version:0});
 }const body={version:'astra25-local-upgrade-v3',local_only:true,sources,stages,candidate:{path:CANDIDATE07,sha256:sha25(fs.readFileSync(ROOT25+CANDIDATE07))},compatibility:{id:COMPAT05,before:'0025',change:'Only dangling astra_users.referrer_id becomes NULL; all other fields and money immutable',public_ids:false}};return {...body,plan_sha256:sha25(canonical25(body))};}finally{db.close();}}
export function verifyPlan07(p,reader=rel=>fs.readFileSync(ROOT25+rel)){const {plan_sha256,...body}=p;if(p.version!=='astra25-local-upgrade-v3'||p.local_only!==true||sha25(canonical25(body))!==plan_sha256)stop25('PLAN07_HASH');
 if(p.sources.length!==PATHS07.length||p.stages.length!==PATHS07.length)stop25('PLAN07_ORDER');for(let i=0;i<PATHS07.length;i++){const s=p.sources[i],d=p.stages[i];if(s.path!==PATHS07[i]||s.id!==STAGES07[i]||d.stage!==STAGES07[i]||d.source!==s.path||d.user_version!==0||d.object_count!==d.objects.length||!s.sha256||sha25(reader(s.path))!==s.sha256||schemaDigest25(d.objects)!==d.ddl_sha256)stop25('PLAN07_SOURCE_OR_ORDER');}
 if(p.candidate.path!==CANDIDATE07||sha25(reader(CANDIDATE07))!==p.candidate.sha256)stop25('CANDIDATE07_CHANGED');return p;}

export function loadPlan07(){return verifyPlan07(JSON.parse(fs.readFileSync(PLAN07,'utf8')));}
