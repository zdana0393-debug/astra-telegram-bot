#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK04_BACKUP=$(mktemp -d)
cp -a docs data release "$TASK04_BACKUP/"
restore04(){
 cp -a "$TASK04_BACKUP/docs/." docs/
 cp -a "$TASK04_BACKUP/data/." data/
 cp -a "$TASK04_BACKUP/release/." release/
 rm -rf "$TASK04_BACKUP"
}
trap restore04 EXIT
sh scripts/test-2.5-task03.sh
restore04
trap - EXIT
TASK04_PLAN_HASH=$(sha256sum data/astra25-upgrade-plan.json)
node --experimental-sqlite scripts/generate-astra25-upgrade-plan.mjs
test "$TASK04_PLAN_HASH" = "$(sha256sum data/astra25-upgrade-plan.json)"
for suite in astra25-upgrade astra25-recovery astra25-business astra25-cost astra25-concurrency; do
 node --experimental-sqlite "tests/$suite.test.mjs"
done
sh scripts/test-astra25-crash.sh
sh scripts/test-astra25-cli.sh
if test -n "${ASTRA25_WRANGLER_BUNDLE-}"; then
 node --experimental-sqlite tests/astra25-wrangler.test.mjs
else
 echo 'TASK04 Wrangler-bundle integration untested: supply ASTRA25_WRANGLER_BUNDLE from the pinned offline dry-run.'
fi
node --experimental-sqlite scripts/rehearse-astra25-local.mjs --local-only
for file in scripts/lib/astra25-*.mjs scripts/astra25-upgrade-local.mjs scripts/create-astra20-synthetic.mjs scripts/rehearse-astra25-local.mjs; do node --check "$file"; done
# Frozen TASK03 and every prior source, migration, reader, price and test stay intact.
git diff --exit-code --no-renames --diff-filter=MD 222bc0828501d05fd21df20b41d2b053e404f69c --
git diff --check
