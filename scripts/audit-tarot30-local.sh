#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
test "$#" -eq 1
test "$1" = --local-only
TASK06_STORAGE_DIR=$(mktemp -d /tmp/astra25-task06-storage-XXXXXX)
trap 'rm -rf "$TASK06_STORAGE_DIR"' EXIT
node --experimental-sqlite scripts/audit-tarot30-local.mjs baseline --local-only "$TASK06_STORAGE_DIR"
# Prove the filled migration does not need an unbounded V8 heap.
node --max-old-space-size=256 --experimental-sqlite scripts/astra25-upgrade-task06-local.mjs --local-only --source "$TASK06_STORAGE_DIR/baseline29.sqlite" --output "$TASK06_STORAGE_DIR/target30.sqlite" --writers-paused > "$TASK06_STORAGE_DIR/upgrade30.json"
node --experimental-sqlite scripts/audit-tarot30-local.mjs cleanup --local-only "$TASK06_STORAGE_DIR"
node --experimental-sqlite scripts/audit-tarot30-local.mjs rate --local-only "$TASK06_STORAGE_DIR"
node --experimental-sqlite scripts/audit-tarot30-local.mjs lifecycle --local-only "$TASK06_STORAGE_DIR"
node --experimental-sqlite scripts/audit-tarot30-local.mjs summary --local-only "$TASK06_STORAGE_DIR"
