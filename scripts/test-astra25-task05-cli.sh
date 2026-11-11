#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK05_CLI_DIR=$(mktemp -d /tmp/astra25-task05-cli-XXXXXX)
trap 'rm -rf "$TASK05_CLI_DIR"' EXIT
node --experimental-sqlite scripts/create-astra20-synthetic.mjs --local-only --output "$TASK05_CLI_DIR/origin.sqlite"
node --experimental-sqlite scripts/astra25-upgrade-task05-local.mjs --local-only --source "$TASK05_CLI_DIR/origin.sqlite" --output "$TASK05_CLI_DIR/target.sqlite" --plan > "$TASK05_CLI_DIR/plan.json"
test ! -e "$TASK05_CLI_DIR/target.sqlite"
node --experimental-sqlite scripts/astra25-upgrade-task05-local.mjs --local-only --source "$TASK05_CLI_DIR/origin.sqlite" --output "$TASK05_CLI_DIR/target.sqlite" --writers-paused > "$TASK05_CLI_DIR/upgrade.json"
node --experimental-sqlite scripts/astra25-upgrade-task05-local.mjs --local-only --source "$TASK05_CLI_DIR/origin.sqlite" --output "$TASK05_CLI_DIR/target.sqlite" --writers-paused --resume > "$TASK05_CLI_DIR/repeat.json"
node --input-type=module - "$TASK05_CLI_DIR" <<'JS'
import fs from 'node:fs';import assert from 'node:assert/strict';
const dir=process.argv[2],read=name=>JSON.parse(fs.readFileSync(dir+'/'+name+'.json','utf8'));
assert.equal(read('plan').read_only,true);assert.equal(read('plan').steps.length,10);assert.equal(read('upgrade').backup.verified,true);assert.equal(read('upgrade').source_preserved,true);assert.equal(read('upgrade').target_stage,'0029');assert.equal(read('repeat').changed,false);assert.equal(read('repeat').already_complete,true);
console.log(JSON.stringify({task05_cli_cases:3,passed:true,synthetic_only:true}));
JS
