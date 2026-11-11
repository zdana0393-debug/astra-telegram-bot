// LOCAL ONLY verified logical restore. Never opens a service or overwrites an existing target.
import fs from'node:fs';import path from'node:path';import{DatabaseSync}from'node:sqlite';
import{localPath25,readState25,identifyStage25,validateDatabase25}from'./astra25-upgrade07.mjs';import{sha25,canonical25,objects25,loadPlan07,ROOT25}from'./astra25-plan07.mjs';
const id=s=>'"'+s.replaceAll('"','""')+'"',q=s=>"'"+s.replaceAll("'","''")+"'";
export function typedState07(db){const tables={};for(const o of objects25(db).filter(x=>x.type==='table')){
 const cols=db.prepare('PRAGMA table_info('+id(o.name)+')').all().map(x=>x.name),hashes=[];const expressions=cols.map((c,i)=>`typeof(${id(c)}) AS t${i},CASE WHEN typeof(${id(c)}) IN('text','blob')THEN hex(CAST(${id(c)} AS BLOB)) WHEN typeof(${id(c)})='real' THEN printf('%!.17g',${id(c)}) ELSE quote(${id(c)}) END AS v${i}`).join(',');
 const st=db.prepare(`SELECT rowid AS rid,${expressions} FROM ${id(o.name)}`);st.setReadBigInts(true);for(const row of st.iterate())hashes.push(sha25(JSON.stringify([String(row.rid),...cols.map((_,i)=>[row['t'+i],row['v'+i]])])));hashes.sort();tables[o.name]={rows:hashes.length,sha256:sha25(hashes.join('\n'))};
 }if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get())tables.sqlite_sequence=db.prepare('SELECT name,CAST(seq AS TEXT) AS seq FROM sqlite_sequence ORDER BY name').all();return{tables,sha256:sha25(canonical25(tables))};}
export async function compactCopy07({local_only,source,output,sql_output=null,writers_paused,fault=()=>{}}){
 if(local_only!==true||writers_paused!==true)throw Error('LOCAL_ONLY_PAUSED_REQUIRED');localPath25(source);localPath25(output,{exists:false});if(source===output||fs.existsSync(output))throw Error('NEW_TARGET_REQUIRED');
 if([output,sql_output].filter(Boolean).some(p=>p===ROOT25.slice(0,-1)||p.startsWith(ROOT25)))throw Error('PRIVATE_OUTPUT_OUTSIDE_REPOSITORY_REQUIRED');
 if(sql_output!==null&&(!path.isAbsolute(sql_output)||fs.existsSync(sql_output)||path.resolve(sql_output)!==sql_output||fs.realpathSync(path.dirname(sql_output))!==path.dirname(sql_output)||sql_output===source||sql_output===output))throw Error('NEW_PRIVATE_SQL_OUTPUT_REQUIRED');
 let input=null,db=null,fd=null,committed=false,count=0,max=0;
 try{
  input=new DatabaseSync(source,{readOnly:true});const sourceVersion=input.prepare('PRAGMA data_version').get().data_version;input.exec('BEGIN');const stage=identifyStage25(input,loadPlan07());validateDatabase25(input,stage);const before=typedState07(input),state=readState25(input),sourceSHA=sha25(fs.readFileSync(source)),ddl=objects25(input);
  if(sql_output)fd=fs.openSync(sql_output,'wx',0o600);db=new DatabaseSync(output);fs.chmodSync(output,0o600);db.exec('PRAGMA foreign_keys=ON;BEGIN IMMEDIATE;PRAGMA defer_foreign_keys=ON');if(fd!==null)fs.writeSync(fd,'PRAGMA defer_foreign_keys=ON;\n');
  const execute=sql=>{const bytes=Buffer.byteLength(sql);if(bytes>50000)throw Error('IMPORT_SQL_STATEMENT_BUDGET');max=Math.max(max,bytes);count++;if(fd!==null)fs.writeSync(fd,sql+';\n');db.exec(sql);fault('statement',count);};
  for(const o of ddl.filter(x=>x.type==='table'))execute(o.sql);
  execute('CREATE TABLE __astra_import_chunks07(cell TEXT NOT NULL,part INTEGER NOT NULL,h TEXT NOT NULL,PRIMARY KEY(cell,part))');
  let serial=0;for(const o of ddl.filter(x=>x.type==='table')){
   const cols=input.prepare('PRAGMA table_info('+id(o.name)+')').all().map(x=>x.name),expressions=cols.map((c,i)=>`typeof(${id(c)}) AS t${i},CASE WHEN typeof(${id(c)}) IN('text','blob')THEN hex(CAST(${id(c)} AS BLOB)) WHEN typeof(${id(c)})='real' THEN printf('%!.17g',${id(c)}) ELSE quote(${id(c)}) END AS v${i}`).join(','),st=input.prepare(`SELECT rowid AS rid,${expressions} FROM ${id(o.name)} ORDER BY rowid`);st.setReadBigInts(true);
   for(const row of st.iterate()){
    const values=cols.map((c,i)=>{const type=row['t'+i],v=row['v'+i];if(!['text','blob'].includes(type))return v;let expr;if(v.length<=12000)expr="X'"+v+"'";else{const cell='c'+serial++;for(let n=0;n<v.length;n+=12000)execute(`INSERT INTO __astra_import_chunks07 VALUES(${q(cell)},${n/12000},${q(v.slice(n,n+12000))})`);expr=`unhex((SELECT group_concat(h,'') FROM(SELECT h FROM __astra_import_chunks07 WHERE cell=${q(cell)} ORDER BY part)))`;}return type==='text'?`CAST(${expr} AS TEXT)`:expr;});
    execute(`INSERT INTO ${id(o.name)}(rowid,${cols.map(id).join(',')})VALUES(${row.rid},${values.join(',')})`);execute('DELETE FROM __astra_import_chunks07');
   }
  }
  if(input.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get()){execute('DELETE FROM sqlite_sequence');for(const r of input.prepare('SELECT name,CAST(seq AS TEXT)seq FROM sqlite_sequence').all())execute(`INSERT INTO sqlite_sequence VALUES(${q(r.name)},${r.seq})`);}
  execute('DROP TABLE __astra_import_chunks07');for(const o of ddl.filter(x=>x.type!=='table'))execute(o.sql);
  if(typedState07(db).sha256!==before.sha256||readState25(db).sha256!==state.sha256)throw Error('LOGICAL_RESTORE_FINGERPRINT_MISMATCH');validateDatabase25(db,stage);fault('before_commit',count);input.exec('ROLLBACK');if(input.prepare('PRAGMA data_version').get().data_version!==sourceVersion||typedState07(input).sha256!==before.sha256||sha25(fs.readFileSync(source))!==sourceSHA||input.prepare('PRAGMA data_version').get().data_version!==sourceVersion)throw Error('SOURCE_CHANGED_DURING_COPY');db.exec('COMMIT');committed=true;fault('after_commit',count);
  if(sha25(fs.readFileSync(source))!==sourceSHA)throw Error('SOURCE_CHANGED_DURING_COPY');
  return{local_only:true,source_stage:loadPlan07().stages[stage].stage,source_preserved:true,typed_bytes_preserved:true,rowid_sequence_preserved:true,foreign_keys:'ON, deferred until COMMIT',triggers_created_after_data:true,statements:count,max_statement_bytes:max,source_bytes:fs.statSync(source).size,output_bytes:fs.statSync(output).size,typed_sha256:before.sha256,state_sha256:state.sha256,cloud_import_proven:false,uses_unhex:true};
 }catch(e){if(db&&!committed)try{db.exec('ROLLBACK');}catch{}throw e;}finally{if(fd!==null)fs.closeSync(fd);db?.close();input?.close();}
}
