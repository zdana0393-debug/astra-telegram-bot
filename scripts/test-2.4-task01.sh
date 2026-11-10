#!/bin/sh
set -eu
unset ASTRA_BUILD_BASELINE
cd -- "$(dirname -- "$0")/.."
# Previous monetary versions retain their original expectations. Restore the deliverable even on failure.
trap 'node scripts/build-2.4.mjs' EXIT
ASTRA_BUILD_BASELINE=1 sh scripts/test-2.4.sh
node scripts/build-2.4.mjs
node --experimental-sqlite tests/task01-economy.test.mjs
node --experimental-sqlite tests/task01-contention.test.mjs
node --experimental-sqlite tests/task01-recovery.test.mjs
node --experimental-sqlite scripts/review-task01.mjs
node --check release/ASTRA_2_4_WORKER.js
git diff --check
