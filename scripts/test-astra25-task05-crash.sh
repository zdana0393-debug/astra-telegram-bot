#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
for TASK05_PHASE in after_sql committed_before_journal; do
 TASK05_CRASH_DIR=$(mktemp -d /tmp/astra25-task05-crash-XXXXXX)
 trap 'rm -rf "$TASK05_CRASH_DIR"' EXIT
 node --experimental-sqlite tests/task05/crash05-process.mjs setup "$TASK05_CRASH_DIR"
 if node --experimental-sqlite tests/task05/crash05-process.mjs crash "$TASK05_CRASH_DIR" "$TASK05_PHASE"; then
  exit 1
 else
  TASK05_CRASH_CODE=$?
  test "$TASK05_CRASH_CODE" -eq 137
 fi
 node --experimental-sqlite tests/task05/crash05-process.mjs resume "$TASK05_CRASH_DIR" "$TASK05_PHASE"
 rm -rf "$TASK05_CRASH_DIR"
 trap - EXIT
done
