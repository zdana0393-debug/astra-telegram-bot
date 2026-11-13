import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{DatabaseSync}from'node:sqlite';
import{readOnlyStatements}from'../scripts/lib/migrate-tarot29-local.mjs';
const sql=fs.readFileSync('scripts/production25-readonly-inventory.sql','utf8');
test('prepared production inventory executes only reads on synthetic2.0 and preserves rows',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(fs.readFileSync('src/02_SCHEMA.sql','utf8'));
  db.exec('INSERT INTO astra_users(telegram_id,balance)VALUES(1,25),(2,7);INSERT INTO astra_processed_updates(update_id)VALUES(100);');
  const before=db.prepare('SELECT * FROM astra_users ORDER BY telegram_id').all();db.exec('PRAGMA query_only=ON');
  const statements=readOnlyStatements(sql);assert.equal(statements.length,6);
  const result=statements.map(s=>db.prepare(s).all());assert.equal(result[3][0].users,2);assert.equal(result[3][0].total_balance,32);
  assert.equal(result[3][0].orphan_referrers,0);assert.equal(result.at(-1)[0].latest_update,100);
  assert.deepEqual(db.prepare('SELECT * FROM astra_users ORDER BY telegram_id').all(),before);
 }finally{db.close();}
});
test('read-only parser rejects accidental migration SQL',()=>assert.throws(()=>readOnlyStatements(sql+'\nUPDATE astra_users SET balance=0;'),/NOT_READ_ONLY/));
