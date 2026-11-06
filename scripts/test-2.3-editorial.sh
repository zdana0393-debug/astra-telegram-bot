#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
sh scripts/test-2.2.sh
ASTRA_TEST_RELEASE=2.3-editorial node --experimental-sqlite tests/legacy-candidate.mjs
ASTRA_TEST_RELEASE=2.3-editorial node --experimental-sqlite tests/hardening.test.mjs
ASTRA_TEST_RELEASE=2.3-editorial node --experimental-sqlite tests/shell.test.mjs
node --experimental-sqlite tests/editorial.test.mjs
node --check release/ASTRA_2_3_EDITORIAL_WORKER.js
