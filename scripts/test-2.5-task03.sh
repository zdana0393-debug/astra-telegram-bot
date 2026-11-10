#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
# Historical suites regenerate their own outputs. Preserve reviewed artifacts.
TASK03_BACKUP=$(mktemp -d)
cp -a docs data release "$TASK03_BACKUP/"
restore03(){
 cp -a "$TASK03_BACKUP/docs/." docs/
 cp -a "$TASK03_BACKUP/data/." data/
 cp -a "$TASK03_BACKUP/release/." release/
 rm -rf "$TASK03_BACKUP"
}
trap restore03 EXIT
sh scripts/test-2.5-task02.sh
restore03
trap - EXIT
node scripts/build-2.5.mjs
TASK03_FIRST=$(sha256sum release/ASTRA_2_5_TASK03_CANDIDATE.js)
node scripts/build-2.5.mjs
test "$TASK03_FIRST" = "$(sha256sum release/ASTRA_2_5_TASK03_CANDIDATE.js)"
node --check release/ASTRA_2_5_TASK03_CANDIDATE.js
for file in tarot25-ui tarot25-ui-integration tarot25-ui-contention; do
 node --experimental-sqlite "tests/$file.test.mjs"
done
# Every file existing at TASK02 must be identical, including adapters, catalog,
# legacy release and all migrations. TASK03 consists solely of additions.
git diff --exit-code --no-renames --diff-filter=MD f0bde5f13ff2c4f0c386084384425b53a9ab26d2 --
git diff --check
