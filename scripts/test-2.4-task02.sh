#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
unset ASTRA_BUILD_BASELINE ASTRA_BUILD_TASK01
TASK02_ARTIFACTS=$(mktemp -d)
python3 scripts/task02-test-artifacts.py save "$TASK02_ARTIFACTS"
trap 'python3 scripts/task02-test-artifacts.py restore "$TASK02_ARTIFACTS"; rm -rf "$TASK02_ARTIFACTS"; node scripts/build-2.4.mjs' EXIT
sh scripts/test-2.4-task01.sh
node --experimental-sqlite tests/task02-forecast.test.mjs
node scripts/review-task02.mjs
node --check release/ASTRA_2_4_WORKER.js
git diff --check
