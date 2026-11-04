#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
sh scripts/test.sh
ASTRA_TEST_RELEASE=2.2 node --experimental-sqlite tests/legacy-candidate.mjs
ASTRA_TEST_RELEASE=2.2 node --experimental-sqlite tests/hardening.test.mjs
node --experimental-sqlite tests/shell.test.mjs
node --check release/ASTRA_2_2_WORKER.js
