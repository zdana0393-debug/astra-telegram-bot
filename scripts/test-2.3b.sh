#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
node scripts/build-2.3b.mjs
sh scripts/test-2.3-editorial.sh
ASTRA_TEST_RELEASE=2.3b node --experimental-sqlite tests/legacy-candidate.mjs
ASTRA_TEST_RELEASE=2.3b node --experimental-sqlite tests/hardening.test.mjs
ASTRA_TEST_RELEASE=2.3b node --experimental-sqlite tests/shell.test.mjs
node --experimental-sqlite tests/forecast-engine.test.mjs
node scripts/audit-forecast.mjs
node --check release/ASTRA_2_3B_WORKER.js
