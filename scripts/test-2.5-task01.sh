#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK25_BACKUP=$(mktemp -d)
# The unmodified historical runner regenerates old metrics and releases.
# Preserve those artifacts so TASK01 produces no unrelated tracked changes.
cp -a docs data release "$TASK25_BACKUP/"
restore25(){
 cp -a "$TASK25_BACKUP/docs/." docs/
 cp -a "$TASK25_BACKUP/data/." data/
 cp -a "$TASK25_BACKUP/release/." release/
 rm -rf "$TASK25_BACKUP"
}
trap restore25 EXIT
sh scripts/test-2.4-task06.sh
restore25
trap - EXIT
node tests/tarot25.test.mjs
node scripts/review-tarot25.mjs
node --check src/tarot25/catalog.mjs
node --check src/tarot25/spreads.mjs
node --check src/tarot25/combinations.mjs
node --check src/tarot25/engine.mjs
git diff --check
