#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
TASK06_ROOT=$(pwd)
TASK06_QA_DIR=$(mktemp -d /tmp/astra25-task06-qa-XXXXXX)
TASK06_HISTORY_DIR=$(mktemp -d /tmp/astra25-task06-history-XXXXXX)
trap 'rm -rf "$TASK06_HISTORY_DIR"; printf "Local QA logs retained at %s\n" "$TASK06_QA_DIR"' EXIT
# Pin reviewed historical source; do not let old suites rename current0028.
git archive d7aeb27379df723644c56571850f0aa3c39a183f | tar -x -C "$TASK06_HISTORY_DIR"
GIT_DIR="$TASK06_ROOT/.git" GIT_WORK_TREE="$TASK06_HISTORY_DIR" sh "$TASK06_HISTORY_DIR/scripts/test-2.5-task05.sh" > "$TASK06_QA_DIR/history.log" 2>&1
sh scripts/test-astra25-task06-current.sh > "$TASK06_QA_DIR/current.log" 2>&1
node --experimental-sqlite scripts/rehearse-astra25-task06-local.mjs --local-only > "$TASK06_QA_DIR/rehearsal.log" 2>&1
sh scripts/audit-tarot30-local.sh --local-only > "$TASK06_QA_DIR/storage.log" 2>&1
node --experimental-sqlite scripts/audit-astra25-task06-runtime.mjs --local-only > "$TASK06_QA_DIR/runtime.log" 2>&1
node --experimental-sqlite scripts/verify-astra25-task06.mjs --local-only "$TASK06_QA_DIR/history.log" "$TASK06_QA_DIR/current.log"
git diff --exit-code --no-renames --diff-filter=MD d7aeb27379df723644c56571850f0aa3c39a183f --
git diff --check
