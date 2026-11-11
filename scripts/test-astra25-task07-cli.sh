#!/bin/sh
set -eu
umask 077
cd -- "$(dirname -- "$0")/.."
TASK07_CLI_DIR=$(mktemp -d /tmp/astra25-task07-cli-XXXXXX)
trap 'rm -rf "$TASK07_CLI_DIR"' EXIT
node --experimental-sqlite scripts/create-astra20-synthetic.mjs --local-only --output "$TASK07_CLI_DIR/origin.sqlite" > "$TASK07_CLI_DIR/create.json"
node --experimental-sqlite scripts/astra25-prepare07-local.mjs --local-only --source "$TASK07_CLI_DIR/origin.sqlite" --output "$TASK07_CLI_DIR/target.sqlite" --preflight > "$TASK07_CLI_DIR/preflight.json"
test ! -e "$TASK07_CLI_DIR/target.sqlite"
node --experimental-sqlite scripts/astra25-prepare07-local.mjs --local-only --writers-paused --source "$TASK07_CLI_DIR/origin.sqlite" --output "$TASK07_CLI_DIR/target.sqlite" --compact-output "$TASK07_CLI_DIR/compact.sqlite" --sql-output "$TASK07_CLI_DIR/package.sql" > "$TASK07_CLI_DIR/prepare.json"
TASK07_BEFORE=$(sha256sum "$TASK07_CLI_DIR/target.sqlite")
node --experimental-sqlite scripts/astra25-prepare07-local.mjs --local-only --writers-paused --resume --source "$TASK07_CLI_DIR/origin.sqlite" --output "$TASK07_CLI_DIR/target.sqlite" > "$TASK07_CLI_DIR/repeat.json"
test "$TASK07_BEFORE" = "$(sha256sum "$TASK07_CLI_DIR/target.sqlite")"
node --experimental-sqlite --input-type=module - "$TASK07_CLI_DIR" <<'JS'
import fs from'node:fs';import assert from'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{typedState07}from'./scripts/lib/astra25-compact07.mjs';import{createSynthetic20}from'./scripts/lib/astra25-synthetic.mjs';import{PATHS07}from'./scripts/lib/astra25-plan07.mjs';
const dir=process.argv[2],read=n=>JSON.parse(fs.readFileSync(dir+'/'+n+'.json'));assert.equal(read('preflight').status,'READY_FOR_LOCAL_REHEARSAL_ONLY');assert.equal(read('prepare').upgrade.target_stage,'0031');assert.equal(read('prepare').upgrade.backup.verified,true);assert.equal(read('repeat').upgrade.already_complete,true);
const db=new DatabaseSync(dir+'/sql-restored.sqlite');db.exec('PRAGMA foreign_keys=ON;BEGIN IMMEDIATE');db.exec(fs.readFileSync(dir+'/package.sql','utf8'));db.exec('COMMIT');const source=new DatabaseSync(dir+'/compact.sqlite',{readOnly:true});assert.equal(typedState07(db).sha256,typedState07(source).sha256);assert.equal(db.prepare('SELECT sum(balance)s FROM astra_users').get().s,444);db.close();source.close();
await createSynthetic20(dir+'/nul-origin.sqlite');const n=new DatabaseSync(dir+'/nul-origin.sqlite');n.exec(fs.readFileSync(PATHS07[1],'utf8'));n.prepare("INSERT INTO astra_operations(operation_id,telegram_id,reason,delta,result,delivery)VALUES('task07-nul',12,'tarot',-3,?,'sent')").run('Сохранено\u0000после NUL · e\u0301 🃏');fs.writeFileSync(dir+'/nul-expected.json',JSON.stringify(n.prepare("SELECT hex(CAST(result AS BLOB))h FROM astra_operations WHERE operation_id='task07-nul'").get()));n.close();
JS
node --experimental-sqlite scripts/astra25-prepare07-local.mjs --local-only --writers-paused --source "$TASK07_CLI_DIR/nul-origin.sqlite" --output "$TASK07_CLI_DIR/nul-target.sqlite" --compact-output "$TASK07_CLI_DIR/nul-compact.sqlite" --sql-output "$TASK07_CLI_DIR/nul-package.sql" > "$TASK07_CLI_DIR/nul-prepare.json"
node --experimental-sqlite --input-type=module - "$TASK07_CLI_DIR" <<'JS'
import fs from'node:fs';import assert from'node:assert/strict';import{DatabaseSync}from'node:sqlite';
const dir=process.argv[2],expected=JSON.parse(fs.readFileSync(dir+'/nul-expected.json')),db=new DatabaseSync(dir+'/nul-sql-restored.sqlite');db.exec('PRAGMA foreign_keys=ON;BEGIN IMMEDIATE');db.exec(fs.readFileSync(dir+'/nul-package.sql','utf8'));db.exec('COMMIT');assert.deepEqual({...db.prepare("SELECT hex(CAST(result AS BLOB))h FROM astra_operations WHERE operation_id='task07-nul'").get()},expected);assert.equal(db.prepare('SELECT sum(balance)s FROM astra_users').get().s,441);db.close();const r={local_only:true,actual_cli_cases:4,cli_preflight_no_write:true,cli_full_20_to_31_and_compact:true,cli_repeat_read_only:true,backup_restore_verified:true,actual_emitted_sql_replayed:true,sql_replay_cases:2,typed_rowid_sequence_match:true,nul_unicode_paid_bytes_exact:true,nul_fixture_total_balance:441,cloud_import_proven:false};fs.writeFileSync('data/astra25-task07-cli.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));
JS
