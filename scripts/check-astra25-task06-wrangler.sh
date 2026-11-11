#!/bin/sh
# Offline bundle only. No optional deploy mode and no account/secret inputs.
set -eu
cd -- "$(dirname -- "$0")/.."
test "$#" -eq 2
TASK06_TOOL_ROOT=$1
TASK06_DRY_OUT=$2
case "$TASK06_TOOL_ROOT" in /*) ;; *) exit 2;; esac
case "$TASK06_DRY_OUT" in /tmp/astra25-task06-dryrun-*) ;; *) exit 2;; esac
test ! -e "$TASK06_DRY_OUT"
for TASK06_CREDENTIAL in CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY CLOUDFLARE_ACCOUNT_ID CF_API_TOKEN CF_API_KEY CF_EMAIL; do
 if env | cut -d= -f1 | rg -q "^${TASK06_CREDENTIAL}$"; then
  echo 'STOP: dry-run must use an environment without Cloudflare credential bindings.' >&2
  exit 2
 fi
done
node --experimental-sqlite --input-type=module - "$TASK06_TOOL_ROOT" <<'JS'
import fs from 'node:fs';import {loadPlan06} from './scripts/lib/astra25-plan06.mjs';
const p=JSON.parse(fs.readFileSync(process.argv[2]+'/node_modules/wrangler/package.json','utf8'));
if(p.version!=='4.45.0')throw Error('Pinned Wrangler 4.45.0 required');loadPlan06();
JS
mkdir -m 700 "$TASK06_DRY_OUT"
WRANGLER_SEND_METRICS=false CI=true XDG_CONFIG_HOME="$TASK06_DRY_OUT/config" WRANGLER_LOG_PATH="$TASK06_DRY_OUT/wrangler.log" \
 node "$TASK06_TOOL_ROOT/node_modules/wrangler/bin/wrangler.js" deploy --dry-run \
 --config tools/astra25-wrangler-offline/wrangler-task06.jsonc --outdir "$TASK06_DRY_OUT/bundle"
