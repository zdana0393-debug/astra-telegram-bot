#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK06_HISTORY=$(mktemp -d)
mkdir "$TASK06_HISTORY/docs"
cp docs/ASTRA_2_4_TASK_05_* "$TASK06_HISTORY/docs/"
# TASK05 asserts that its historical candidate predates 0028; run it unchanged.
# Temporarily retain NEW uncommitted SQL files outside migrations, then restore on every exit.
mv migrations/0028_notification_consent.sql "$TASK06_HISTORY/"
mv migrations/0028_steps "$TASK06_HISTORY/"
restore06(){
 cp "$TASK06_HISTORY/0028_notification_consent.sql" migrations/
 cp -R "$TASK06_HISTORY/0028_steps" migrations/
 cp "$TASK06_HISTORY/docs/"* docs/
 rm -rf "$TASK06_HISTORY"
 node scripts/build-2.4.mjs
}
trap restore06 EXIT
ASTRA_BUILD_TASK05=1 sh scripts/test-2.4-task05.sh
restore06
trap - EXIT
ASTRA_TEST_AUDIT_DIR=$(mktemp -d)
export ASTRA_TEST_AUDIT_DIR
for file in task01-economy task01-contention task01-recovery task02b-editorial task05-privacy task05-worker-corpus task05-migrations task05-backup-projection task06-consent task06-faults task06-integration task06-schema task06-contention; do
 node --experimental-sqlite --import ./tests/task05-track-worker.mjs "tests/$file.test.mjs"
done
node --experimental-sqlite scripts/review-task06.mjs
rm -rf "$ASTRA_TEST_AUDIT_DIR"
node --check release/ASTRA_2_4_WORKER.js
git diff --check
