// Only fictional data. Models a Cloudflare interleaved SQL dump, no API access.
import{DatabaseSync}from'node:sqlite';import{cleanInstall25}from'../../scripts/build-astra25-clean.mjs';
export function exportFixture251({active=false,mutate=()=>{}}={}){
 const db=new DatabaseSync(':memory:');try{
  db.exec(cleanInstall25().sql);
  db.exec("INSERT INTO astra_users(telegram_id,balance)VALUES(17,0);UPDATE astra_users SET balance=4 WHERE telegram_id=17;INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)VALUES('SYNTHETIC_LOCAL_ONLY',17,4,'synthetic')");
  if(active)db.exec('UPDATE astra_tarot25_runtime29 SET enabled=1;UPDATE astra_tarot30_policy SET write_enabled=1;UPDATE astra_tarot31_policy SET enabled=1');
  mutate(db);
  const objects=db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*'ORDER BY name").all();
  const quote=s=>"'"+s.replaceAll("'","''")+"'",literal=v=>v===null?'NULL':typeof v==='string'?quote(v):v instanceof Uint8Array?"X'"+Buffer.from(v).toString('hex')+"'":String(v);
  let sql='PRAGMA defer_foreign_keys=TRUE;\n';
  for(const o of objects.filter(x=>x.type==='table')){sql+=o.sql+';\n';for(const row of db.prepare('SELECT * FROM "'+o.name+'"').all())sql+='INSERT INTO "'+o.name+'" VALUES('+Object.values(row).map(literal).join(',')+');\n';}
  for(const o of objects.filter(x=>x.type!=='table'))sql+=o.sql+';\n';return sql;
 }finally{db.close();}
}
export function mutateFixtureData251(db,table,statement){
 // SQL superuser corruption in a synthetic fixture only; restore the exact DDL
 // afterwards so a failing DATA check cannot be mistaken for a schema failure.
 const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'AND tbl_name=?").all(table);
 for(const t of triggers)db.exec('DROP TRIGGER "'+t.name+'"');
 try{db.exec(statement);}finally{for(const t of triggers)db.exec(t.sql);}
}
