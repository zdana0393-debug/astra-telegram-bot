#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK02B_ARTIFACTS=$(mktemp -d)
cp docs/ASTRA_2_4_TASK_02_SAMPLES.md "$TASK02B_ARTIFACTS/samples"
cp docs/ASTRA_2_4_TASK_02_METRICS.json "$TASK02B_ARTIFACTS/metrics"
trap 'cp "$TASK02B_ARTIFACTS/samples" docs/ASTRA_2_4_TASK_02_SAMPLES.md; cp "$TASK02B_ARTIFACTS/metrics" docs/ASTRA_2_4_TASK_02_METRICS.json; rm -rf "$TASK02B_ARTIFACTS"; node scripts/build-2.4.mjs' EXIT
sh scripts/test-2.4-task02.sh
node --experimental-sqlite tests/task02b-editorial.test.mjs
node scripts/review-task02b.mjs
node --check release/ASTRA_2_4_WORKER.js
git diff --check
