#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK29_BACKUP=$(mktemp -d)
cp -a docs data release "$TASK29_BACKUP/"
restore29(){
 cp -a "$TASK29_BACKUP/docs/." docs/
 cp -a "$TASK29_BACKUP/data/." data/
 cp -a "$TASK29_BACKUP/release/." release/
 rm -rf "$TASK29_BACKUP"
}
trap restore29 EXIT
sh scripts/test-2.5-task01.sh
restore29
trap - EXIT
for file in tarot29 tarot29-sql tarot29-contention; do node --experimental-sqlite "tests/$file.test.mjs"; done
node --experimental-sqlite scripts/review-tarot29.mjs
node --check src/tarot25/purchases29.mjs
node --check src/tarot25/reader-v1.mjs
node --check src/tarot25/text29.mjs
node --check src/tarot25/legacy29.mjs
git diff --check
