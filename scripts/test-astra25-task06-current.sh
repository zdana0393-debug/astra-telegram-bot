#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
node --experimental-sqlite scripts/generate-tarot30.mjs
node --experimental-sqlite scripts/generate-audit30.mjs
node scripts/build-2.5-task06.mjs
TASK06_WORKER_HASH=$(sha256sum release/ASTRA_2_5_TASK06_CANDIDATE.js)
TASK06_PLAN_HASH=$(sha256sum data/astra25-upgrade-plan-task06.json)
node scripts/build-2.5-task06.mjs
node --experimental-sqlite scripts/generate-astra25-plan06.mjs
test "$TASK06_WORKER_HASH" = "$(sha256sum release/ASTRA_2_5_TASK06_CANDIDATE.js)"
test "$TASK06_PLAN_HASH" = "$(sha256sum data/astra25-upgrade-plan-task06.json)"
for suite in astra25-task06-upgrade astra25-task06-recovery astra25-task06-compat astra25-task06-business astra25-task06-ui astra25-task06-concurrency tarot30 tarot30-safety tarot30-concurrency tarot30-worker tarot30-migration; do
 node --experimental-sqlite "tests/$suite.test.mjs"
done
sh scripts/test-astra25-task06-crash.sh
sh scripts/test-tarot30-cleanup-crash.sh
sh scripts/test-astra25-task06-cli.sh
if test -n "${ASTRA25_TASK06_WRANGLER_BUNDLE-}"; then node --experimental-sqlite tests/astra25-task06-wrangler.test.mjs; else echo 'TASK06 offline bundle acceptance NOT RUN; explicit bundle required.'; fi
for file in src/tarot25/*30.mjs src/tarot25/ui06.mjs scripts/*task06*.mjs scripts/*tarot30*.mjs scripts/lib/*06.mjs scripts/lib/tarot30-synthetic.mjs tests/task06/*.mjs; do node --check "$file"; done
git diff --exit-code --no-renames --diff-filter=MD d7aeb27379df723644c56571850f0aa3c39a183f --
git diff --check
