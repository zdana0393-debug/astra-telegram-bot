#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
test "$#" -eq 1
case "$1" in 222bc0828501d05fd21df20b41d2b053e404f69c|22f2cdded11fcde13e4582f5fb2942f5862b2125) ;; *) exit 2;; esac
TASK05_TEST_BASE=$(mktemp /tmp/astra25-task05-frozen-XXXXXX)
trap 'rm -f "$TASK05_TEST_BASE"' EXIT
git show "$1:tests/tarot25-ui.test.mjs" > "$TASK05_TEST_BASE"
node scripts/check-astra25-task05-frozen.mjs "$TASK05_TEST_BASE"
git diff --exit-code --no-renames --diff-filter=MD "$1" -- . ':!tests/tarot25-ui.test.mjs'
