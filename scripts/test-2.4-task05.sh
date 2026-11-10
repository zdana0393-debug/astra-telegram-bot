#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
unset ASTRA_TEST_TASK05
TASK05_ARTIFACTS=$(mktemp -d)
for suffix in METRICS.json SAMPLES.md MOBILE_PREVIEW.html; do cp "docs/ASTRA_2_4_TASK_04_$suffix" "$TASK05_ARTIFACTS/$suffix"; done
trap 'for suffix in METRICS.json SAMPLES.md MOBILE_PREVIEW.html; do cp "$TASK05_ARTIFACTS/$suffix" "docs/ASTRA_2_4_TASK_04_$suffix"; done; rm -rf "$TASK05_ARTIFACTS"; node scripts/build-2.4.mjs' EXIT
# Prior 985 checks, including the delivery queue (8/20/100,403/429/unknown), before the new STOP-SHIP gate.
ASTRA_BUILD_TASK04=1 sh scripts/test-2.4-task04.sh
unset ASTRA_BUILD_TASK04 ASTRA_BUILD_TASK03 ASTRA_BUILD_TASK02B ASTRA_BUILD_TASK01 ASTRA_BUILD_BASELINE
node scripts/build-2.4.mjs
ASTRA_TEST_AUDIT_DIR=$(mktemp -d)
export ASTRA_TEST_AUDIT_DIR
export ASTRA_TEST_TASK05=1
for file in task01-economy task01-contention task01-recovery task02b-editorial task04-ui task05-privacy task05-stopship task05-worker-corpus task05-migrations task05-source-proof task05-backup-projection; do
 node --experimental-sqlite --import ./tests/task05-track-worker.mjs "tests/$file.test.mjs"
done
ASTRA_REVIEW_PREFIX=ASTRA_2_4_TASK_05 node --experimental-sqlite scripts/review-task04.mjs
node --experimental-sqlite scripts/review-task05.mjs
rm -rf "$ASTRA_TEST_AUDIT_DIR"
node --check release/ASTRA_2_4_WORKER.js
node --check release/ASTRA_2_4_MAINTENANCE.js
git diff --check
