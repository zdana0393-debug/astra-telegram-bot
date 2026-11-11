#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
for TASK06_PHASE in after_sql after_commit; do
 TASK06_CRASH_DIR=$(mktemp -d /tmp/astra25-task06-cleanupcrash-XXXXXX)
 trap 'rm -rf "$TASK06_CRASH_DIR"' EXIT
 node --experimental-sqlite tests/task06/cleanup-crash-process.mjs setup "$TASK06_CRASH_DIR"
 if node --experimental-sqlite tests/task06/cleanup-crash-process.mjs crash "$TASK06_CRASH_DIR" "$TASK06_PHASE"; then exit 1; else TASK06_CODE=$?;test "$TASK06_CODE" -eq 137;fi
 node --experimental-sqlite tests/task06/cleanup-crash-process.mjs resume "$TASK06_CRASH_DIR" "$TASK06_PHASE"
 rm -rf "$TASK06_CRASH_DIR"
 trap - EXIT
done
