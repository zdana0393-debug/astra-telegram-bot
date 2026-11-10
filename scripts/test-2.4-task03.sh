#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK03_ARTIFACTS=$(mktemp -d)
cp docs/ASTRA_2_4_TASK_02B_METRICS.json "$TASK03_ARTIFACTS/metrics"
cp docs/ASTRA_2_4_TASK_02B_SAMPLES.md "$TASK03_ARTIFACTS/samples"
trap 'cp "$TASK03_ARTIFACTS/metrics" docs/ASTRA_2_4_TASK_02B_METRICS.json; cp "$TASK03_ARTIFACTS/samples" docs/ASTRA_2_4_TASK_02B_SAMPLES.md; rm -rf "$TASK03_ARTIFACTS"; node scripts/build-2.4.mjs' EXIT
# Unchanged historical contracts, including the old Cron/defaults/CTA, on their accepted builds.
ASTRA_BUILD_TASK02B=1 sh scripts/test-2.4-task02b.sh
unset ASTRA_BUILD_TASK02B ASTRA_BUILD_BASELINE ASTRA_BUILD_TASK01
node scripts/build-2.4.mjs
# Re-run current monetary/recovery/editorial contracts on the final deliverable (90 checks).
node --experimental-sqlite tests/task01-economy.test.mjs
node --experimental-sqlite tests/task01-contention.test.mjs
node --experimental-sqlite tests/task01-recovery.test.mjs
node --experimental-sqlite tests/task02b-editorial.test.mjs
# New final-Worker queue tests, separate-connection contention, and protected-source proof (52).
node --experimental-sqlite tests/task03-broadcast.test.mjs
node --experimental-sqlite tests/task03-contention.test.mjs
node --experimental-sqlite tests/task03-source-proof.test.mjs
node --experimental-sqlite scripts/review-task03.mjs
node --check release/ASTRA_2_4_WORKER.js
git diff --check
