#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
node scripts/build-2.4a.mjs
sh scripts/test-2.3b.sh
ASTRA_TEST_RELEASE=2.4a node --experimental-sqlite tests/legacy-candidate.mjs
ASTRA_TEST_RELEASE=2.4a node --experimental-sqlite tests/hardening.test.mjs
ASTRA_TEST_RELEASE=2.4a node --experimental-sqlite tests/shell.test.mjs
ASTRA_TEST_RELEASE=2.4a node --experimental-sqlite tests/forecast-engine.test.mjs
node --experimental-sqlite tests/economy.test.mjs
node --experimental-sqlite scripts/economy-review.mjs
node --check release/ASTRA_2_4A_WORKER.js
