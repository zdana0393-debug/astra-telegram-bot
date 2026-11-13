// Local generation only. The owner-approved fresh-install path contains no beta data.
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {loadPlan07,ROOT25,objects25,sha25} from './lib/astra25-plan07.mjs';
const identifier=s=>'"'+s.replaceAll('"','""')+'"';
const literal=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
export function cleanInstall25(){
 const plan=loadPlan07(),db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA foreign_keys=ON');
  // Historical SQL is used ONLY in memory as a verified source of the final schema.
  // The owner installs the resulting final CREATE/seed statements once, not migrations.
  for(const source of plan.sources)db.exec(fs.readFileSync(ROOT25+source.path,'utf8'));
  const objects=objects25(db),tables=objects.filter(x=>x.type==='table');
  const statements=[
   // Read-only refusal BEFORE any DDL, including when an operator selects a wrong DB.
   "SELECT json_extract(CASE WHEN NOT EXISTS(SELECT 1 FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' AND name<>'_cf_KV') THEN '{\"ok\":1}' ELSE 'ASTRA25_NEW_EMPTY_DATABASE_REQUIRED' END,'$.ok') AS new_empty_database_required",
   ...tables.map(x=>x.sql)
  ];
  const seedTables=[];
  for(const table of tables){
   const rows=db.prepare('SELECT * FROM '+identifier(table.name)+' ORDER BY rowid').all();
   if(rows.length)seedTables.push({name:table.name,rows:rows.length});
   // These are precisely system policy rows/prices, never users or transactions.
   if(rows.length&&!['astra_broadcast_runtime03','astra_consent_runtime28','astra_patch26','astra_policy','astra_tarot25_prices29','astra_tarot25_runtime29','astra_tarot30_policy','astra_tarot31_policy'].includes(table.name))throw Error('UNEXPECTED_CLEAN_SEED');
   for(const row of rows){const cols=Object.keys(row);statements.push('INSERT INTO '+identifier(table.name)+'('+cols.map(identifier).join(',')+')VALUES('+cols.map(c=>table.name==='astra_patch26'&&c==='installed_at'?'unixepoch()':literal(row[c])).join(',')+')');}
  }
  statements.push(...objects.filter(x=>x.type!=='table').map(x=>x.sql));
  if(statements.some(s=>Buffer.byteLength(s)>50000))throw Error('CLEAN_STATEMENT_SIZE');
  const sql='-- ASTRA 2.5: NEW EMPTY D1 ONLY. Never run on astra-live-v2.\n-- Final schema + system seeds. No users, money, file_id, token, or historical import.\n-- Stars, new economy, Tarot sales, questions, cleanup and broadcasts remain OFF.\n'+statements.map(s=>s+';').join('\n')+'\n';
  return {sql,objects,seedTables,statement_count:statements.length,max_statement_bytes:Math.max(...statements.map(s=>Buffer.byteLength(s))),sha256:sha25(sql)};
 }finally{db.close();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const build=cleanInstall25();fs.writeFileSync(ROOT25+'release/ASTRA_2_5_CLEAN_SCHEMA.sql',build.sql);
 console.log(JSON.stringify({file:'release/ASTRA_2_5_CLEAN_SCHEMA.sql',sha256:build.sha256,bytes:Buffer.byteLength(build.sql),objects:build.objects.length,statements:build.statement_count,max_statement_bytes:build.max_statement_bytes,seed_tables:build.seedTables,cloud_installed:false}));
}
