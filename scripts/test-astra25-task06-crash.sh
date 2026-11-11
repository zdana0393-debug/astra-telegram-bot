#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
for TASK06_PHASE in after_sql committed_before_journal; do
 TASK06_CRASH_DIR=$(mktemp -d /tmp/astra25-task06-crash-XXXXXX)
 trap 'rm -rf "$TASK06_CRASH_DIR"' EXIT
 node --experimental-sqlite tests/task06/crash06-process.mjs setup "$TASK06_CRASH_DIR"
 if node --experimental-sqlite tests/task06/crash06-process.mjs crash "$TASK06_CRASH_DIR" "$TASK06_PHASE"; then
  exit 1
 else
  TASK06_CRASH_CODE=$?
  test "$TASK06_CRASH_CODE" -eq 137
 fi
 node --experimental-sqlite tests/task06/crash06-process.mjs resume "$TASK06_CRASH_DIR" "$TASK06_PHASE"
 rm -rf "$TASK06_CRASH_DIR"
 trap - EXIT
done
