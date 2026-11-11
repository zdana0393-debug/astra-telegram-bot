#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")/.."
test -n "${ASTRA25_TASK07_WRANGLER_BUNDLE-}"
TASK07_LOG_DIR=${ASTRA_TASK07_LOG_DIR:-$(mktemp -d /tmp/astra25-task07-current-XXXXXX)}
mkdir -p "$TASK07_LOG_DIR/audit"
node --experimental-sqlite scripts/generate-tarot31.mjs
node --experimental-sqlite scripts/generate-audit31.mjs
node scripts/build-2.5-task07.mjs
node --experimental-sqlite scripts/generate-astra25-plan07.mjs
for suite in tarot31 tarot31-safety tarot31-upgrade tarot31-editorial tarot31-concurrency tarot31-worker tarot31-budget tarot31-crash tarot31-art-python astra25-task07-business astra25-task07-compat tarot31-wrangler; do
 ASTRA_TASK07_AUDIT_DIR="$TASK07_LOG_DIR/audit" node --experimental-sqlite --import ./tests/task07/track-worker.mjs "tests/$suite.test.mjs" > "$TASK07_LOG_DIR/$suite.log" 2>&1
done
node scripts/review-tarot31.mjs > "$TASK07_LOG_DIR/editorial.log"
ASTRA25_TASK07_WRANGLER_BUNDLE="$ASTRA25_TASK07_WRANGLER_BUNDLE" node --experimental-sqlite scripts/audit-astra25-task07-runtime.mjs --local-only > "$TASK07_LOG_DIR/runtime.log"
git diff --check
printf 'TASK07 current logs: %s\n' "$TASK07_LOG_DIR"
