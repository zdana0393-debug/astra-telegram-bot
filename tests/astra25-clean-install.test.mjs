import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {cleanInstall25} from '../scripts/build-astra25-clean.mjs';
import {loadPlan07,objects25,schemaDigest25} from '../scripts/lib/astra25-plan07.mjs';
import {schema31} from '../src/tarot25/purchases31.mjs';
import {adapter25} from '../scripts/lib/astra25-synthetic.mjs';
const build=cleanInstall25();
function fresh(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(build.sql);return db;}
test('clean SQL reproduces all286 final objects byte-for-byte without historical installs',()=>{
 const db=fresh();try{assert.equal(objects25(db).length,286);assert.equal(schemaDigest25(objects25(db)),loadPlan07().stages.at(-1).ddl_sha256);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
});
test('clean installation has no users, events, money, purchases or private media',()=>{
 const db=fresh();try{for(const table of objects25(db).filter(x=>x.type==='table')){const rows=db.prepare('SELECT count(*) AS n FROM "'+table.name+'"').get().n;if(!build.seedTables.some(x=>x.name===table.name))assert.equal(rows,0,table.name);}
 assert.equal(db.prepare('SELECT count(*) AS n FROM astra_users').get().n,0);assert.ok(!/file_id|bot\d+:/i.test(build.sql.replaceAll('file_id, token','')));
 }finally{db.close();}
});
test('final strict Tarot31 adapter accepts schema; all dangerous gates OFF',async()=>{
 const db=fresh();try{const s=await schema31({DB:adapter25(db)});assert.equal(s.ready,true);for(const flag of ['enabled','independent_enabled','questions_enabled','write_enabled','cleanup_enabled','independent_cleanup'])assert.equal(s[flag],0,flag);
 assert.equal(db.prepare('SELECT delivery_quarantined FROM astra_consent_runtime28').get().delivery_quarantined,1);assert.equal(db.prepare('SELECT stars_enabled FROM astra_policy').get().stars_enabled,0);assert.equal(db.prepare('SELECT enabled FROM astra_patch26').get().enabled,0);
 }finally{db.close();}
});
test('already installed or foreign nonempty schema is refused without touching its rows',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE unrelated(value TEXT);INSERT INTO unrelated VALUES(\'KEEP\')');const before=objects25(db);assert.throws(()=>db.exec(build.sql),/malformed JSON/);assert.deepEqual(objects25(db),before);assert.equal(db.prepare('SELECT value FROM unrelated').get().value,'KEEP');assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='astra_users'").get().n,0);}finally{db.close();}
 const installed=fresh();try{const before=objects25(installed);assert.throws(()=>installed.exec(build.sql),/malformed JSON/);assert.deepEqual(objects25(installed),before);assert.equal(installed.prepare('SELECT count(*) AS n FROM astra_users').get().n,0);}finally{installed.close();}
});
test('Cloudflare system KV table can coexist; untouched and excluded only by exact name',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE _cf_KV(k TEXT PRIMARY KEY,v BLOB);INSERT INTO _cf_KV VALUES(\'synthetic\',X\'0102\')');db.exec(build.sql);assert.equal(db.prepare('SELECT hex(v) AS v FROM _cf_KV').get().v,'0102');assert.equal(objects25(db).filter(x=>x.name!=='_cf_KV').length,286);}finally{db.close();}
});
test('similar-to-system foreign table names are not exempt from empty-database guard',()=>{
 for(const name of ['sqliteX_custom','_cf_other']){const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE "'+name+'"(v TEXT)');assert.throws(()=>db.exec(build.sql),/malformed JSON/);}finally{db.close();}}
});
test('generated artifact reproducible, no transaction or unhex import dependency',()=>{
 assert.equal(cleanInstall25().sql,build.sql);assert.equal(fs.readFileSync('release/ASTRA_2_5_CLEAN_SCHEMA.sql','utf8'),build.sql);assert.ok(build.max_statement_bytes<50000);assert.ok(!/unhex\(/i.test(build.sql));
});
test('post-install SQL checks execute in query-only mode',()=>{
 const db=fresh();try{db.exec('PRAGMA query_only=ON');db.exec(fs.readFileSync('release/ASTRA_2_5_CLEAN_CHECK.sql','utf8'));}finally{db.close();}
});
