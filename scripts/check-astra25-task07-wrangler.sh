#!/bin/sh
# Offline bundle only. No optional deploy mode and no account/secret inputs.
set -eu
cd -- "$(dirname -- "$0")/.."
test "$#" -eq 2
TASK07_TOOL_ROOT=$1
TASK07_DRY_OUT=$2
case "$TASK07_TOOL_ROOT" in /*) ;; *) exit 2;; esac
case "$TASK07_DRY_OUT" in /tmp/astra25-task07-dryrun-*) ;; *) exit 2;; esac
test ! -e "$TASK07_DRY_OUT"
for TASK07_CREDENTIAL in CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY CLOUDFLARE_ACCOUNT_ID CF_API_TOKEN CF_API_KEY CF_EMAIL; do
 if env | cut -d= -f1 | rg -q "^${TASK07_CREDENTIAL}$"; then
  echo 'STOP: dry-run must use an environment without Cloudflare credential bindings.' >&2
  exit 2
 fi
done
node --experimental-sqlite --input-type=module - "$TASK07_TOOL_ROOT" <<'JS'
import fs from 'node:fs';import {loadPlan07} from './scripts/lib/astra25-plan07.mjs';
const p=JSON.parse(fs.readFileSync(process.argv[2]+'/node_modules/wrangler/package.json','utf8'));
if(p.version!=='4.45.0')throw Error('Pinned Wrangler 4.45.0 required');loadPlan07();
JS
mkdir -m 700 "$TASK07_DRY_OUT"
WRANGLER_SEND_METRICS=false CI=true XDG_CONFIG_HOME="$TASK07_DRY_OUT/config" WRANGLER_LOG_PATH="$TASK07_DRY_OUT/wrangler.log" \
 node "$TASK07_TOOL_ROOT/node_modules/wrangler/bin/wrangler.js" deploy --dry-run \
 --config tools/astra25-wrangler-offline/wrangler-task07.jsonc --outdir "$TASK07_DRY_OUT/bundle"
