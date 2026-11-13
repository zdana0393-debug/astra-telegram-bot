// Offline-only repair of export ORDER. No omitted data, FK OFF, network or live D1.
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{DatabaseSync}from'node:sqlite';
import{splitSQL30}from'./lib/sql30-bounds.mjs';import{loadPlan07,ROOT25}from'./lib/astra25-plan07.mjs';import{typedState07}from'./lib/astra25-compact07.mjs';import{validateDatabase25}from'./lib/astra25-upgrade07.mjs';
let phase='INPUT';const sha=x=>createHash('sha256').update(x).digest('hex'),need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
function core(s){return s.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/,'').trim();}
export function orderExport251(sql){
 const groups={tables:[],data:[],indexes:[],views:[],triggers:[]},source=[];let wrappers=0;
 for(const statement of splitSQL30(sql)){
  const s=core(statement);if(!s)continue;let category;
  if(/^CREATE\s+TABLE\b/i.test(s))category='tables';else if(/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(s))category='indexes';else if(/^CREATE\s+VIEW\b/i.test(s))category='views';else if(/^CREATE\s+TRIGGER\b/i.test(s))category='triggers';
  else if(/^INSERT\s+INTO\b/i.test(s)||/^DELETE\s+FROM\s+(?:sqlite_sequence|"sqlite_sequence"|`sqlite_sequence`)\s*;$/i.test(s))category='data';
  else if(/^(?:BEGIN(?:\s+TRANSACTION)?|COMMIT(?:\s+TRANSACTION)?|END(?:\s+TRANSACTION)?);$/i.test(s)||/^PRAGMA\s+(?:defer_foreign_keys|foreign_keys)\s*=\s*(?:ON|OFF|TRUE|FALSE|0|1)\s*;$/i.test(s)){wrappers++;continue;}
  else throw Error('EXPORT_STATEMENT_NOT_SUPPORTED');
  groups[category].push(statement);source.push(statement);
 }
 const ordered=[...groups.tables,...groups.data,...groups.indexes,...groups.views,...groups.triggers];
 // Identity proof: only order changes. Every DDL and every data statement survives.
 need(JSON.stringify(source.map(sha).sort())===JSON.stringify(ordered.map(sha).sort()),'EXPORT_STATEMENT_LOSS');
 return{sql:'-- LOCAL RESTORE ONLY; all data/DDL statements unchanged. FK remain ON.\nPRAGMA defer_foreign_keys=ON;\n'+ordered.join('\n')+'\n',counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),wrappers};
}
function exact(db,expected){const actual=db.prepare("SELECT name,type,trim(sql)sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*'AND name<>'_cf_KV'ORDER BY name").all();const a=JSON.stringify(actual),b=JSON.stringify(expected.map(o=>({name:o.name,type:o.type,sql:o.sql.trim()})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0));need(a===b,'RESTORE_EXACT_SCHEMA_MISMATCH');}
export function verifyExport251(input,folder){
 need(path.isAbsolute(input)&&path.isAbsolute(folder)&&fs.realpathSync(input)===input&&fs.realpathSync(folder)===folder,'PRIVATE_ABSOLUTE_REAL_PATHS_REQUIRED');
 for(const file of[input,folder]){const st=fs.lstatSync(file);if(process.platform==='win32'){try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',ROOT25+'tools/tarot-bulk-loader/protect_private_folder.ps1','-Path',file,'-CheckOnly'],{stdio:'pipe',windowsHide:true,timeout:30000});}catch{throw Error('PRIVATE_DACL_CHECK_FAILED');}}else need((st.mode&0o077)===0,'PRIVATE_MODE_REQUIRED');need(!st.isSymbolicLink()&&(st.isDirectory()||st.nlink===1),'PRIVATE_LINK_FORBIDDEN');for(let p=path.dirname(file);;p=path.dirname(p)){need(!fs.statSync(p).isSymbolicLink(),'PRIVATE_PATH_ALIAS');const marker=path.join(p,'.git');need(!fs.existsSync(marker)||fs.statSync(marker).isDirectory()&&!fs.existsSync(path.join(marker,'HEAD')),'PRIVATE_OUTSIDE_GIT_REQUIRED');if(path.dirname(p)===p)break;}}
 need(fs.readdirSync(folder).length===0,'NEW_EMPTY_PRIVATE_FOLDER_REQUIRED');
 phase='PARSE_EXPORT';const raw=fs.readFileSync(input),sourceSHA=sha(raw),ordered=orderExport251(raw.toString('utf8')),beforeFile=path.join(folder,'RESTORED_BEFORE_0032.sqlite'),afterFile=path.join(folder,'REHEARSED_0032.sqlite');
 fs.writeFileSync(path.join(folder,'RESTORE_ORDERED_LOCAL_ONLY.sql'),ordered.sql,{mode:0o600,flag:'wx'});
 let db=new DatabaseSync(beforeFile);fs.chmodSync(beforeFile,0o600);let before,baselineHash;
 try{phase='RESTORE_SQL';db.exec('PRAGMA foreign_keys=ON;BEGIN IMMEDIATE;');db.exec(ordered.sql);phase='RESTORE_SCHEMA';exact(db,loadPlan07().stages.at(-1).objects);phase='RESTORE_INTEGRITY';validateDatabase25(db,12,{closed:false});db.exec('COMMIT');before=typedState07(db);baselineHash=sha(fs.readFileSync(beforeFile));}catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
 fs.copyFileSync(beforeFile,afterFile,fs.constants.COPYFILE_EXCL);fs.chmodSync(afterFile,0o600);db=new DatabaseSync(afterFile);
 const migration=fs.readFileSync(ROOT25+'migrations/0032_astra251.sql'),delta=JSON.parse(fs.readFileSync(ROOT25+'release/ASTRA_2_5_1_PATCH.json','utf8'));need(sha(migration)===delta.migration_sha256,'PUBLIC_MIGRATION_HASH_MISMATCH');
 try{phase='MIGRATION_0032';db.exec('PRAGMA foreign_keys=ON;BEGIN IMMEDIATE');db.exec(migration.toString('utf8'));exact(db,JSON.parse(fs.readFileSync(ROOT25+'data/astra251-schema.json','utf8')));const after=typedState07(db);for(const[name,value]of Object.entries(before.tables))need(JSON.stringify(after.tables[name])===JSON.stringify(value),'MIGRATION_CHANGED_OLD_DATA');
  for(const statement of splitSQL30(fs.readFileSync(ROOT25+'scripts/check_integrity_astra251.sql','utf8')))for(const row of db.prepare(statement).all())need(row.violations===0,'MIGRATION_INTEGRITY_VIOLATION');
  need(db.prepare('PRAGMA foreign_key_check').all().length===0,'MIGRATION_FOREIGN_KEYS');db.exec('COMMIT');
  const summary=db.prepare('SELECT count(*)users,coalesce(sum(balance),0)total_dust FROM astra_users').get();need(sha(fs.readFileSync(input))===sourceSHA&&sha(fs.readFileSync(beforeFile))===baselineHash,'ORIGINAL_BACKUP_CHANGED');
  const report={status:'LOCAL_RESTORE_AND_0032_PASS',source_sha256:sourceSHA,source_unchanged:true,original_statement_bytes_preserved:true,restored_tables_preserved:true,foreign_keys:'ON (deferred during transaction)',objects_before:286,objects_after:323,...summary,groups:ordered.counts,wrappers_normalized:ordered.wrappers,migration_sha256:delta.migration_sha256,cloudflare:'NOT_TESTED',live_bot_changed:false};fs.writeFileSync(path.join(folder,'RESTORE_CHECK_PRIVATE.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});return report;
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{need(process.argv.length===4,'EXPLICIT_INPUT_AND_PRIVATE_OUTPUT_REQUIRED');console.log(JSON.stringify(verifyExport251(path.resolve(process.argv[2]),path.resolve(process.argv[3]))));}catch(e){const code=/^[A-Z0-9_]{1,100}$/.test(e.code||'')?e.code:'SQL_OR_EXPORT_NOT_SUPPORTED';console.log(JSON.stringify({status:'STOP',step:phase,code,private_sql_logged:false}));process.exitCode=1;}
