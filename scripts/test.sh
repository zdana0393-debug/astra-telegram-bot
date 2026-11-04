#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
node --version
node --experimental-sqlite src/03_LOCAL_TEST.mjs
node --experimental-sqlite tests/legacy-candidate.mjs
# node:test automatically runs and reports tests when imported. A single process
# is necessary because these tests replace global fetch and Date with local mocks.
node --experimental-sqlite tests/hardening.test.mjs
