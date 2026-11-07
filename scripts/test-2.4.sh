#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
node scripts/build-2.4.mjs
sh scripts/test-2.4a.sh
ASTRA_TEST_RELEASE=2.4 node --experimental-sqlite tests/legacy-candidate.mjs
ASTRA_TEST_RELEASE=2.4 node --experimental-sqlite tests/hardening.test.mjs
ASTRA_TEST_RELEASE=2.4 node --experimental-sqlite tests/shell.test.mjs
ASTRA_TEST_RELEASE=2.4 node --experimental-sqlite tests/forecast-engine.test.mjs
node --experimental-sqlite tests/rewards-stars.test.mjs
node --experimental-sqlite tests/rewards-stars-contention.test.mjs
node --experimental-sqlite scripts/review-2.4.mjs
node --check release/ASTRA_2_4_WORKER.js
git diff --check
