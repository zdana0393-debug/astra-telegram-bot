import{test}from'node:test';import assert from'node:assert/strict';import{DatabaseSync}from'node:sqlite';import fs from'node:fs';import{orderExport251,verifyExport251}from'../scripts/rehearse-astra251-export.mjs';
import{exportFixture251}from'./astra251/export-fixture.mjs';
const badOrder='CREATE TABLE child(id INTEGER PRIMARY KEY,parent INTEGER REFERENCES astra_users(id));INSERT INTO child VALUES(1,7);CREATE TABLE astra_users(id INTEGER PRIMARY KEY);INSERT INTO astra_users VALUES(7);';
test('original interleaved export reproduces main.astra_users missing; table-first restore with FK ON succeeds',()=>{let db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');assert.throws(()=>db.exec(badOrder),/no such table.*astra_users/);db.close();db=new DatabaseSync(':memory:');try{db.exec('PRAGMA foreign_keys=ON;BEGIN');db.exec(orderExport251(badOrder).sql);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.exec('COMMIT');assert.equal(db.prepare('SELECT count(*)n FROM child').get().n,1);}finally{db.close();}});
test('all values including semicolons, quotes and Unicode remain unchanged; restore does not replay money triggers',()=>{const sql="CREATE TABLE t(id INTEGER PRIMARY KEY,n TEXT);CREATE TRIGGER mint AFTER INSERT ON t BEGIN UPDATE t SET n='changed'WHERE id=NEW.id;END;INSERT INTO t VALUES(1,'Прежний; ''текст'' 🌑');";const db=new DatabaseSync(':memory:');try{db.exec('BEGIN');db.exec(orderExport251(sql).sql);db.exec('COMMIT');assert.equal(db.prepare('SELECT n FROM t').get().n,"Прежний; 'текст' 🌑");}finally{db.close();}});
test('deferred FK never permits dangling references',()=>{const db=new DatabaseSync(':memory:');try{db.exec('PRAGMA foreign_keys=ON;BEGIN');db.exec(orderExport251(badOrder.replace('INSERT INTO astra_users VALUES(7);','')).sql);assert.throws(()=>db.exec('COMMIT'),/FOREIGN KEY/);}finally{db.close();}});
for(const statement of["ATTACH DATABASE 'private.db'AS p;",'DROP TABLE t;','UPDATE astra_users SET balance=100;','SELECT load_extension(\'x\');'])test('unknown dump command rejected: '+statement.split(' ')[0],()=>assert.throws(()=>orderExport251(statement),/NOT_SUPPORTED/));
for(const active of[false,true])test('full286 restore+0032 preserves source, balances and catalogue active='+active,()=>{
 const dir=fs.mkdtempSync('/tmp/astra251-restore-fixture-'),input=dir+'/backup.sql',output=dir+'/result';fs.mkdirSync(output,{mode:0o700});
 try{
  fs.writeFileSync(input,exportFixture251({active}),{mode:0o600});const before=fs.readFileSync(input),r=verifyExport251(input,output);
  assert.equal(r.status,'LOCAL_RESTORE_AND_0032_PASS');assert.equal(r.objects_after,323);assert.equal(r.users,1);assert.equal(r.total_dust,4);assert.deepEqual(fs.readFileSync(input),before);
  const after=new DatabaseSync(output+'/REHEARSED_0032.sqlite',{readOnly:true});try{assert.equal(after.prepare('SELECT enabled FROM astra_tarot25_runtime29').get().enabled,active?1:0);}finally{after.close();}
  assert.throws(()=>verifyExport251(input,output),/NEW_EMPTY/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
