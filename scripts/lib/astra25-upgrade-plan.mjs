// TASK04. Pinned local SQL sources; no Wrangler, D1 client, credentials or network.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
export const ROOT25=fileURLToPath(new URL('../../',import.meta.url));
export const SQL25=['0021_wallet','0022_shell','0023_forecast','0024_activity_history','0025_rewards_stars','0026_economy_fence','0027_broadcast','0028_notification_consent','0029_tarot'].map(name=>'migrations/'+name+'.sql');
export const ORIGIN25='src/02_SCHEMA.sql';
export const CANDIDATE25='release/ASTRA_2_5_TASK03_CANDIDATE.js';
export const PINNED_CANDIDATE25='d6ae0b3aed3c80bae0da2969042e3e3e6b21d71061fcbea38b329ab6d72cb15f';
export const PLAN_PATH25=ROOT25+'data/astra25-upgrade-plan.json';
export const sha25=value=>createHash('sha256').update(value).digest('hex');
export const canonical25=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function stop25(code,details={}){throw Object.assign(new Error(code),{code,details});}
export function normalizedDDL25(sql){
 // Collapse only unquoted whitespace/comments; literals and quoted identifiers are intact.
 let out='',quote=null,space=false;
 for(let i=0;i<sql.length;i++){const c=sql[i],n=sql[i+1];if(quote){out+=c;if(c===quote){if(n===quote){out+=n;i++;}else quote=null;}continue;}
  if(c==='-'&&n==='-'){while(i<sql.length&&sql[i]!=='\n')i++;space=true;continue;}
  if(c==='/'&&n==='*'){i+=2;while(i<sql.length&&!(sql[i]==='*'&&sql[i+1]==='/'))i++;i++;space=true;continue;}
  if(/\s/.test(c)){space=true;continue;}if(space&&out)out+=' ';space=false;if(c==="'"||c==='"'||c==='`')quote=c;out+=c;
 }return out.trim();
}
export function objects25(db){return db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>({...x,normalized_sql:normalizedDDL25(x.sql)}));}
export function schemaDigest25(objects){return sha25(canonical25(objects.map(({name,type,sql})=>({name,type,sql:sql.trim()}))));}
export function generatePlan25(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');const stages=[],sources=[];
 try{for(const [i,path]of [ORIGIN25,...SQL25].entries()){
   const sql=fs.readFileSync(ROOT25+path,'utf8');sources.push({path,sha256:sha25(sql),bytes:Buffer.byteLength(sql)});
   db.exec('BEGIN IMMEDIATE');try{db.exec(sql);if(db.prepare('PRAGMA foreign_key_check').all().length)stop25('PLAN_FK');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
   const objects=objects25(db),counts=Object.fromEntries(['table','index','trigger','view'].map(type=>[type,objects.filter(x=>x.type===type).length]));
   stages.push({stage:i===0?'2.0':String(20+i).padStart(4,'0'),source:path,object_count:objects.length,counts,ddl_sha256:schemaDigest25(objects),objects,user_version:db.prepare('PRAGMA user_version').get().user_version});
  }
  const candidate={path:CANDIDATE25,sha256:sha25(fs.readFileSync(ROOT25+CANDIDATE25))};if(candidate.sha256!==PINNED_CANDIDATE25)stop25('CANDIDATE_CHANGED');
  const body={version:'astra25-local-upgrade-v1',local_only:true,origin:ORIGIN25,sources,candidate,stages};return {...body,plan_sha256:sha25(canonical25(body))};
 }finally{db.close();}
}
export function verifyPlan25(plan,read=path=>fs.readFileSync(ROOT25+path)){
 if(plan?.version!=='astra25-local-upgrade-v1'||plan.local_only!==true)stop25('PLAN_VERSION');const {plan_sha256,...body}=plan;
 if(!/^[a-f0-9]{64}$/.test(plan_sha256??'')||sha25(canonical25(body))!==plan_sha256)stop25('PLAN_HASH');
 const expected=[ORIGIN25,...SQL25];if(plan.sources?.length!==expected.length||plan.stages?.length!==expected.length)stop25('PLAN_ORDER');
 for(let i=0;i<expected.length;i++){const item=plan.sources[i],stage=plan.stages[i];if(item.path!==expected[i]||stage.source!==expected[i]||stage.stage!==(i===0?'2.0':String(20+i).padStart(4,'0')))stop25('PLAN_ORDER');
  if(!/^[a-f0-9]{64}$/.test(item.sha256??'')||sha25(read(item.path))!==item.sha256)stop25('SOURCE_HASH',{path:item.path});if(schemaDigest25(stage.objects)!==stage.ddl_sha256||stage.object_count!==stage.objects.length)stop25('PLAN_DDL_HASH');
 }
 if(plan.candidate?.path!==CANDIDATE25||plan.candidate.sha256!==PINNED_CANDIDATE25||sha25(read(CANDIDATE25))!==PINNED_CANDIDATE25)stop25('CANDIDATE_CHANGED');return plan;
}
export const loadPlan25=()=>verifyPlan25(JSON.parse(fs.readFileSync(PLAN_PATH25,'utf8')));
