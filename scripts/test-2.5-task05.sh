#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK05_BACKUP=$(mktemp -d)
cp -a docs data release "$TASK05_BACKUP/"
restore05(){
 cp -a "$TASK05_BACKUP/docs/." docs/
 cp -a "$TASK05_BACKUP/data/." data/
 cp -a "$TASK05_BACKUP/release/." release/
 rm -rf "$TASK05_BACKUP"
}
trap restore05 EXIT
sh scripts/test-astra25-task05-history.sh
restore05
trap - EXIT
printf 'TASK05_NEW_ACCEPTANCE_BEGIN\n'
node scripts/build-2.5-task05.mjs
TASK05_WORKER_HASH=$(sha256sum release/ASTRA_2_5_TASK05_CANDIDATE.js)
TASK05_PLAN_HASH=$(sha256sum data/astra25-upgrade-plan-task05.json)
node scripts/build-2.5-task05.mjs
node --experimental-sqlite scripts/generate-astra25-plan05.mjs
test "$TASK05_WORKER_HASH" = "$(sha256sum release/ASTRA_2_5_TASK05_CANDIDATE.js)"
test "$TASK05_PLAN_HASH" = "$(sha256sum data/astra25-upgrade-plan-task05.json)"
node --check release/ASTRA_2_5_TASK05_CANDIDATE.js
for suite in upgrade compat recovery business ui concurrency; do
 node --experimental-sqlite "tests/astra25-task05-$suite.test.mjs"
done
sh scripts/test-astra25-task05-crash.sh
sh scripts/test-astra25-task05-cli.sh
if test -n "${ASTRA25_TASK05_WRANGLER_BUNDLE-}"; then
 node --experimental-sqlite tests/astra25-task05-wrangler.test.mjs
else
 echo 'TASK05 Wrangler-bundle acceptance NOT RUN: explicit pinned local dry-run bundle needed.'
fi
node --experimental-sqlite scripts/rehearse-astra25-task05-local.mjs --local-only
# 100/1000/10000 actual sealed offers. Never invokes cleanup.
node --experimental-sqlite scripts/audit-astra25-task05-storage.mjs --local-only
node --experimental-sqlite scripts/audit-astra25-task05-runtime.mjs --local-only
for file in scripts/*task05*.mjs scripts/lib/astra25-*05.mjs src/tarot25/*05.mjs tests/task05/*.mjs; do node --check "$file"; done
sh scripts/check-astra25-task05-frozen.sh 22f2cdded11fcde13e4582f5fb2942f5862b2125
git diff --check
