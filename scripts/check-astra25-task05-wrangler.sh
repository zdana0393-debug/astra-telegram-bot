#!/bin/sh
# Offline bundle only. No optional deploy mode and no account/secret inputs.
set -eu
cd -- "$(dirname -- "$0")/.."
test "$#" -eq 2
TASK05_TOOL_ROOT=$1
TASK05_DRY_OUT=$2
case "$TASK05_TOOL_ROOT" in /*) ;; *) exit 2;; esac
case "$TASK05_DRY_OUT" in /tmp/astra25-task05-dryrun-*) ;; *) exit 2;; esac
test ! -e "$TASK05_DRY_OUT"
for TASK05_CREDENTIAL in CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY CLOUDFLARE_ACCOUNT_ID CF_API_TOKEN CF_API_KEY CF_EMAIL; do
 if env | cut -d= -f1 | rg -q "^${TASK05_CREDENTIAL}$"; then
  echo 'STOP: dry-run must use an environment without Cloudflare credential bindings.' >&2
  exit 2
 fi
done
node --experimental-sqlite --input-type=module - "$TASK05_TOOL_ROOT" <<'JS'
import fs from 'node:fs';import {loadPlan05} from './scripts/lib/astra25-plan05.mjs';
const p=JSON.parse(fs.readFileSync(process.argv[2]+'/node_modules/wrangler/package.json','utf8'));
if(p.version!=='4.45.0')throw Error('Pinned Wrangler 4.45.0 required');loadPlan05();
JS
mkdir -m 700 "$TASK05_DRY_OUT"
WRANGLER_SEND_METRICS=false CI=true XDG_CONFIG_HOME="$TASK05_DRY_OUT/config" WRANGLER_LOG_PATH="$TASK05_DRY_OUT/wrangler.log" \
 node "$TASK05_TOOL_ROOT/node_modules/wrangler/bin/wrangler.js" deploy --dry-run \
 --config tools/astra25-wrangler-offline/wrangler-task05.jsonc --outdir "$TASK05_DRY_OUT/bundle"
