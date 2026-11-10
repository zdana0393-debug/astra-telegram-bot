#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
for TASK04_PHASE in after_sql committed_before_journal; do
 TASK04_CRASH_DIR=$(mktemp -d /tmp/astra25-task04-crash-XXXXXX)
 trap 'rm -rf "$TASK04_CRASH_DIR"' EXIT
 node --experimental-sqlite tests/task04/crash25-process.mjs setup "$TASK04_CRASH_DIR"
 if node --experimental-sqlite tests/task04/crash25-process.mjs crash "$TASK04_CRASH_DIR" "$TASK04_PHASE"; then
  exit 1
 else
  TASK04_CRASH_CODE=$?
  test "$TASK04_CRASH_CODE" -eq 137
 fi
 node --experimental-sqlite tests/task04/crash25-process.mjs resume "$TASK04_CRASH_DIR" "$TASK04_PHASE"
 rm -rf "$TASK04_CRASH_DIR"
 trap - EXIT
done
