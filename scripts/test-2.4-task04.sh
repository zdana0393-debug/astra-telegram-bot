#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK04_ARTIFACTS=$(mktemp -d)
cp docs/ASTRA_2_4_TASK_03_METRICS.json "$TASK04_ARTIFACTS/metrics"
cp docs/ASTRA_2_4_TASK_03_SAMPLES.md "$TASK04_ARTIFACTS/samples"
trap 'cp "$TASK04_ARTIFACTS/metrics" docs/ASTRA_2_4_TASK_03_METRICS.json; cp "$TASK04_ARTIFACTS/samples" docs/ASTRA_2_4_TASK_03_SAMPLES.md; rm -rf "$TASK04_ARTIFACTS"; node scripts/build-2.4.mjs' EXIT
# Preserve the historical contracts and reversible proofs on their accepted builds.
ASTRA_BUILD_TASK03=1 sh scripts/test-2.4-task03.sh
unset ASTRA_BUILD_TASK03 ASTRA_BUILD_TASK02B ASTRA_BUILD_BASELINE ASTRA_BUILD_TASK01
node scripts/build-2.4.mjs
# Existing monetary/recovery/editorial/Cron scenarios also run on the final UI candidate.
node --experimental-sqlite tests/task01-economy.test.mjs
node --experimental-sqlite tests/task01-contention.test.mjs
node --experimental-sqlite tests/task01-recovery.test.mjs
node --experimental-sqlite tests/task02b-editorial.test.mjs
node --experimental-sqlite tests/task03-broadcast.test.mjs
node --experimental-sqlite tests/task03-contention.test.mjs
node --experimental-sqlite tests/task04-ui.test.mjs
node --experimental-sqlite tests/task04-source-proof.test.mjs
node --experimental-sqlite scripts/review-task04.mjs
node --check release/ASTRA_2_4_WORKER.js
git diff --check
