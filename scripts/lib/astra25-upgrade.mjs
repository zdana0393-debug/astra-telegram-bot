// Local copy-to-copy upgrade rehearsal. Never writes the source or calls a service.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {ROOT25,SQL25,loadPlan25,verifyPlan25,objects25,schemaDigest25,sha25,canonical25,stop25} from './astra25-upgrade-plan.mjs';
import {readOnlyStatements} from './migrate-tarot29-local.mjs';
const ident=value=>'"'+value.replaceAll('"','""')+'"';
const fileSHA=p=>sha25(fs.readFileSync(p));
export function localPath25(p,{exists=true}={}){
 if(typeof p!=='string'||!path.isAbsolute(p)||/[\0:]/.test(p)||!/[.](?:sqlite|sqlite3|db)$/.test(p))stop25('EXPLICIT_ABSOLUTE_LOCAL_SQLITE_REQUIRED');
 if(path.resolve(p)!==p||fs.realpathSync(path.dirname(p))!==path.dirname(p))stop25('PATH_ALIAS_NOT_ALLOWED');
 if(fs.existsSync(p)){const st=fs.lstatSync(p);if(st.isSymbolicLink()||!st.isFile()||st.nlink!==1)stop25('SYMLINK_OR_HARDLINK_NOT_ALLOWED');}
 else if(exists)stop25('SOURCE_NOT_FOUND');return p;
}
export function readState25(db){
 const objects=objects25(db),tables={};for(const {name}of objects.filter(x=>x.type==='table')){
  const rows=db.prepare('SELECT rowid AS __task04_rowid__,* FROM '+ident(name)).all().map(row=>canonical25(row)).sort();tables[name]={rows:rows.length,sha256:sha25(rows.join('\n'))};
 }
 if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get()){const rows=db.prepare('SELECT name,seq FROM sqlite_sequence ORDER BY name').all();tables.sqlite_sequence={rows:rows.length,sha256:sha25(canonical25(rows))};}
 const state={ddl_sha256:schemaDigest25(objects),tables,user_version:db.prepare('PRAGMA user_version').get().user_version};return {...state,sha256:sha25(canonical25(state))};
}
export function identifyStage25(db,plan=loadPlan25()){
 const actual=objects25(db),hash=schemaDigest25(actual),index=plan.stages.findIndex(s=>s.ddl_sha256===hash);
 if(index<0){const names=new Map(actual.map(o=>[o.name,o]));const nearest=plan.stages.map(s=>({stage:s.stage,matches:s.objects.filter(o=>names.get(o.name)?.sql.trim()===o.sql.trim()).length})).sort((a,b)=>b.matches-a.matches)[0];stop25('SCHEMA_PARTIAL_OR_FOREIGN',{objects:actual.length,nearest_stage:nearest.stage});}
 if(db.prepare('PRAGMA user_version').get().user_version!==plan.stages[index].user_version)stop25('USER_VERSION_DRIFT');return index;
}
function zero(db,sql,code){if(db.prepare(sql).get().n!==0)stop25(code);}
export function validateDatabase25(db,index,{closed=true}={}){
 const integrity=db.prepare('PRAGMA integrity_check').all();if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')stop25('SQLITE_INTEGRITY');if(db.prepare('PRAGMA foreign_key_check').all().length)stop25('FOREIGN_KEY_VIOLATIONS');
 zero(db,"SELECT count(*) n FROM astra_users WHERE typeof(telegram_id)<>'integer' OR telegram_id<=0 OR telegram_id>9007199254740991 OR typeof(balance)<>'integer' OR balance<0 OR balance>9007199254740991",'INVALID_FINANCIAL_VALUES');
 const dangling=db.prepare('SELECT count(*) n FROM astra_users u WHERE u.referrer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM astra_users r WHERE r.telegram_id=u.referrer_id)').get().n;
 if(dangling)stop25('LEGACY_DANGLING_REFERRER_REQUIRES_REVIEW',{count:dangling,blocked_migration:'0025'});
 zero(db,'SELECT count(*) n FROM astra_users WHERE referrer_id=telegram_id','SELF_REFERRER_REQUIRES_REVIEW');
 zero(db,"SELECT count(*) n FROM astra_users WHERE date(created_at,'+3 hours') IS NULL",'LEGACY_DATE_REQUIRES_REVIEW');
 if(index>=1){zero(db,'SELECT count(*) n FROM astra_users u WHERE balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)','WALLET_MISMATCH');
  zero(db,"SELECT count(*) n FROM astra_operations o WHERE NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key=o.operation_id AND l.operation_id=o.operation_id AND l.telegram_id=o.telegram_id AND l.delta=o.delta AND l.reason=o.reason)",'OPERATION_LEDGER_MISMATCH');}
 if(index>=5){const p=db.prepare('SELECT * FROM astra_policy WHERE singleton=1').get();if(p?.migration_done!==1)stop25('POLICY25_INCOMPLETE');if(closed&&(p.enabled||p.activated||p.stars_enabled||p.start_day!==null))stop25('FINANCIAL_FLAGS_MUST_BE_OFF');
  zero(db,'SELECT count(*) n FROM astra_users u WHERE NOT EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=u.telegram_id)','PROFILE_POLICY_MISSING');}
 if(index>=6){const p=db.prepare('SELECT * FROM astra_patch26 WHERE singleton=1').get();if(p?.migration_done!==1)stop25('PATCH26_INCOMPLETE');if(closed&&(p.enabled||p.activated||p.start_day!==null))stop25('ECONOMY26_MUST_BE_OFF');
  zero(db,"SELECT count(*) n FROM astra_tarot_purchases26 p WHERE NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='tarot26:'||p.offer_id AND l.telegram_id=p.telegram_id AND l.delta=-5 AND l.reason='tarot:v2')",'LEGACY5_LEDGER_MISMATCH');}
 if(index>=7&&db.prepare('SELECT migration_done FROM astra_broadcast_runtime03 WHERE singleton=1').get()?.migration_done!==1)stop25('BROADCAST27_INCOMPLETE');
 if(index>=8){const p=db.prepare('SELECT * FROM astra_consent_runtime28 WHERE singleton=1').get();if(p?.migration_done!==1)stop25('CONSENT28_INCOMPLETE');if(closed&&p.delivery_quarantined!==1)stop25('DELIVERY_MUST_BE_QUARANTINED');}
 if(index>=9){for(const sql of readOnlyStatements(fs.readFileSync(ROOT25+'scripts/check_integrity_tarot25_29.sql','utf8')))for(const row of db.prepare(sql).all())if('violations'in row&&row.violations!==0)stop25('TAROT29_AUDIT_FAILED');}
 return {integrity:true,foreign_keys:true,wallet:index>=1,closed};
}
export function preserve25(db,original,index){
 const state=readState25(db);for(const [name,table]of Object.entries(original.tables))if(canonical25(state.tables[name])!==canonical25(table))stop25('SOURCE_TABLE_DATA_CHANGED',{table:name});
 if(!original.tables.astra_wallet_ledger&&index>=1){zero(db,"SELECT count(*) n FROM astra_users u WHERE NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='opening:'||u.telegram_id AND l.telegram_id=u.telegram_id AND l.delta=u.balance AND l.reason='opening')",'OPENING_BALANCE_CHANGED');zero(db,"SELECT count(*) n FROM astra_wallet_ledger WHERE reason<>'opening'",'UNEXPECTED_MIGRATION_REWARD');}
 return state;
}
function options25(o){if(o.local_only!==true)stop25('LOCAL_ONLY_REQUIRED');localPath25(o.source);if(o.output)localPath25(o.output,{exists:false});if(o.worker_version&&o.worker_version!=='2.5')stop25('DOWNGRADE_OR_OLD_WRITER_FORBIDDEN');if(o.output===o.source)stop25('INPUT_OUTPUT_MUST_DIFFER');}
export function inspectUpgrade25(options){
 options25(options);const plan=loadPlan25(),db=new DatabaseSync(options.source,{readOnly:true});try{const index=identifyStage25(db,plan);validateDatabase25(db,index);return {local_only:true,read_only:true,input:options.source,output:options.output??null,source_stage:plan.stages[index].stage,plan_sha256:plan.plan_sha256,snapshot:readState25(db),steps:plan.sources.slice(index+1),candidate:plan.candidate};}finally{db.close();}
}
function writeJSON(file,value){const tmp=file+'.'+randomUUID()+'.tmp';let fd;try{fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);fs.closeSync(fd);fd=null;fs.renameSync(tmp,file);const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}finally{if(fd!==null&&fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function acquire25(dir,output,resume){
 const lock=dir+'/lock.json',nonce=randomUUID();if(fs.existsSync(lock)){let old;try{old=JSON.parse(fs.readFileSync(lock,'utf8'));}catch{stop25('LOCK_UNVERIFIABLE');}
  if(!resume||old.kind!=='astra25-local-lock-v1'||old.output!==output||!Number.isInteger(old.pid))stop25('LOCK_HELD');
  let alive=true;try{process.kill(old.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)stop25('LOCK_HELD');fs.unlinkSync(lock);
 }
 const fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({kind:'astra25-local-lock-v1',output,pid:process.pid,nonce}));fs.closeSync(fd);
 return ()=>{try{if(JSON.parse(fs.readFileSync(lock,'utf8')).nonce===nonce)fs.unlinkSync(lock);}catch{}};
}
async function verifiedBackup25(db,sourceState,dir){
 const backupPath=dir+'/baseline-backup.sqlite',restorePath=dir+'/restore-proof.sqlite';if(fs.existsSync(backupPath)||fs.existsSync(restorePath))stop25('BACKUP_ALREADY_EXISTS');
 await backup(db,backupPath);fs.chmodSync(backupPath,0o600);const copy=new DatabaseSync(backupPath,{readOnly:true});try{if(readState25(copy).sha256!==sourceState.sha256||Object.values(copy.prepare('PRAGMA integrity_check').get())[0]!=='ok'||copy.prepare('PRAGMA foreign_key_check').all().length)stop25('BACKUP_VERIFICATION_FAILED');}finally{copy.close();}
 fs.copyFileSync(backupPath,restorePath,fs.constants.COPYFILE_EXCL);fs.chmodSync(restorePath,0o600);const restored=new DatabaseSync(restorePath,{readOnly:true});try{if(fileSHA(restorePath)!==fileSHA(backupPath)||readState25(restored).sha256!==sourceState.sha256)stop25('RESTORE_VERIFICATION_FAILED');}finally{restored.close();}
 return {verified:true,backup_path:backupPath,restore_path:restorePath,file_sha256:fileSHA(backupPath),snapshot_sha256:sourceState.sha256};
}
function checkBackup25(journal,dir){
 const b=journal.backup;if(!b?.verified||b.backup_path!==dir+'/baseline-backup.sqlite'||b.restore_path!==dir+'/restore-proof.sqlite')stop25('VERIFIED_BACKUP_REQUIRED');
 for(const p of [b.backup_path,b.restore_path]){localPath25(p);if(fileSHA(p)!==b.file_sha256)stop25('BACKUP_HASH_CHANGED');const db=new DatabaseSync(p,{readOnly:true});try{if(readState25(db).sha256!==journal.original.sha256||Object.values(db.prepare('PRAGMA integrity_check').get())[0]!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)stop25('RESTORE_VERIFICATION_FAILED');}finally{db.close();}}
}
export async function upgradeLocal25(options){
 options25(options);if(!options.output)stop25('OUTPUT_REQUIRED');if(options.writers_paused!==true)stop25('WRITERS_PAUSED_ACK_REQUIRED');const plan=loadPlan25(),dir=options.output+'.task04',journalPath=dir+'/journal.json';
 if(!options.resume){if(fs.existsSync(options.output))stop25('OUTPUT_EXISTS');if(fs.existsSync(dir))stop25('EVIDENCE_DIRECTORY_EXISTS');fs.mkdirSync(dir,{mode:0o700});}else if(!fs.existsSync(dir)||fs.lstatSync(dir).isSymbolicLink())stop25('RESUME_EVIDENCE_MISSING');
 const release=acquire25(dir,options.output,options.resume);let source,db,journal;
 const fault=(phase,step)=>options.fault?.(phase,step);
 try{
  source=new DatabaseSync(options.source,{readOnly:true});const sourceIndex=identifyStage25(source,plan);validateDatabase25(source,sourceIndex);const original=readState25(source),dataVersion=source.prepare('PRAGMA data_version').get().data_version;
  const sourceStable=()=>{if(journal?.backup&&[journal.backup.backup_path,journal.backup.restore_path].some(p=>!fs.existsSync(p)||fileSHA(p)!==journal.backup.file_sha256))stop25('BACKUP_HASH_CHANGED');if(source.prepare('PRAGMA data_version').get().data_version!==dataVersion||readState25(source).sha256!==original.sha256)stop25('SOURCE_WRITER_ACTIVITY');};
  if(options.resume){journal=JSON.parse(fs.readFileSync(journalPath,'utf8'));if(journal.version!=='astra25-journal-v1'||journal.source!==options.source||journal.output!==options.output||journal.plan_sha256!==plan.plan_sha256||journal.original.sha256!==original.sha256)stop25('RESUME_SOURCE_OR_PLAN_CHANGED');checkBackup25(journal,dir);if(!fs.existsSync(options.output))stop25('RESUME_OUTPUT_MISSING');}
  else{
   source.exec('BEGIN');let evidence;try{evidence=await verifiedBackup25(source,original,dir);}finally{source.exec('ROLLBACK');}sourceStable();fault('backup_verified',plan.stages[sourceIndex].stage);
   fs.copyFileSync(evidence.restore_path,options.output,fs.constants.COPYFILE_EXCL);fs.chmodSync(options.output,0o600);
   journal={version:'astra25-journal-v1',source:options.source,output:options.output,plan_sha256:plan.plan_sha256,source_index:sourceIndex,original,backup:evidence,completed:[],pending:null,last:original,complete:false};writeJSON(journalPath,journal);
  }
  checkBackup25(journal,dir);db=new DatabaseSync(options.output);db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=1000');
  if(journal.pending){const actual=readState25(db),p=journal.pending;if(actual.sha256===p.before.sha256){journal.pending=null;writeJSON(journalPath,journal);}else if(p.after&&actual.sha256===p.after.sha256){const n=identifyStage25(db,plan);if(n!==p.index)stop25('RESUME_STAGE_MISMATCH');validateDatabase25(db,n);preserve25(db,original,n);journal.completed.push(p.index);journal.last=p.after;journal.pending=null;writeJSON(journalPath,journal);}else stop25('RESUME_AMBIGUOUS_OR_EXTERNAL_WRITES');}
  let index=identifyStage25(db,plan);validateDatabase25(db,index);const current=readState25(db);
  if(journal.complete){if(index!==9)stop25('COMPLETED_SCHEMA_CHANGED');sourceStable();return {local_only:true,already_complete:true,changed:false,source_stage:plan.stages[sourceIndex].stage,target_stage:'0029',business_changed_since_migration:current.sha256!==journal.last.sha256,state:current,backup:journal.backup};}
  if(current.sha256!==journal.last.sha256||index!==(journal.completed.at(-1)??journal.source_index))stop25('TARGET_WRITER_ACTIVITY');preserve25(db,original,index);
  while(index<9){sourceStable();const next=index+1,step=plan.stages[next],before=readState25(db);if(before.sha256!==journal.last.sha256)stop25('TARGET_WRITER_ACTIVITY');journal.pending={index:next,before,after:null};writeJSON(journalPath,journal);fault('before_begin',step.stage);sourceStable();
   db.exec('BEGIN IMMEDIATE');try{
    if(readState25(db).sha256!==before.sha256)stop25('TARGET_WRITER_ACTIVITY');
    db.exec(fs.readFileSync(ROOT25+step.source,'utf8'));fault('after_sql',step.stage);
    if(identifyStage25(db,plan)!==next)stop25('MIGRATION_STAGE_MISMATCH');validateDatabase25(db,next);const after=preserve25(db,original,next);journal.pending.after=after;writeJSON(journalPath,journal);fault('prepared_before_commit',step.stage);sourceStable();
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
   fault('committed_before_journal',step.stage);journal.completed.push(next);journal.last=journal.pending.after;journal.pending=null;writeJSON(journalPath,journal);index=next;fault('journalled',step.stage);
  }
  sourceStable();journal.complete=true;writeJSON(journalPath,journal);return {local_only:true,already_complete:false,changed:journal.completed.length>0,source_stage:plan.stages[sourceIndex].stage,target_stage:'0029',steps:journal.completed.map(i=>plan.sources[i]),state:readState25(db),backup:journal.backup,source_preserved:true};
 }finally{db?.close();source?.close();release();}
}
