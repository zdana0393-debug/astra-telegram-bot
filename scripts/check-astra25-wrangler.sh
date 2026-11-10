#!/bin/sh
# Offline bundle only. No optional deploy mode and no account/secret inputs.
set -eu
cd -- "$(dirname -- "$0")/.."
test "$#" -eq 2
TASK04_TOOL_ROOT=$1
TASK04_DRY_OUT=$2
case "$TASK04_TOOL_ROOT" in /*) ;; *) exit 2;; esac
case "$TASK04_DRY_OUT" in /tmp/astra25-task04-dryrun-*) ;; *) exit 2;; esac
test ! -e "$TASK04_DRY_OUT"
for TASK04_CREDENTIAL in CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY CLOUDFLARE_ACCOUNT_ID CF_API_TOKEN CF_API_KEY CF_EMAIL; do
 if env | cut -d= -f1 | rg -q "^${TASK04_CREDENTIAL}$"; then
  echo 'STOP: dry-run must use an environment without Cloudflare credential bindings.' >&2
  exit 2
 fi
done
node --experimental-sqlite --input-type=module - "$TASK04_TOOL_ROOT" <<'JS'
import fs from 'node:fs';import {loadPlan25} from './scripts/lib/astra25-upgrade-plan.mjs';
const p=JSON.parse(fs.readFileSync(process.argv[2]+'/node_modules/wrangler/package.json','utf8'));
if(p.version!=='4.45.0')throw Error('Pinned Wrangler 4.45.0 required');loadPlan25();
JS
mkdir -m 700 "$TASK04_DRY_OUT"
WRANGLER_SEND_METRICS=false CI=true XDG_CONFIG_HOME="$TASK04_DRY_OUT/config" WRANGLER_LOG_PATH="$TASK04_DRY_OUT/wrangler.log" \
 node "$TASK04_TOOL_ROOT/node_modules/wrangler/bin/wrangler.js" deploy --dry-run \
 --config tools/astra25-wrangler-offline/wrangler.jsonc --outdir "$TASK04_DRY_OUT/bundle"
