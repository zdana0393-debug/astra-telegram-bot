import {fileURLToPath} from 'node:url';
import {inspectUpgrade25,upgradeLocal25} from './lib/astra25-upgrade.mjs';
import {stop25} from './lib/astra25-upgrade-plan.mjs';
export function parseUpgradeArgs25(args){
 const o={},flags={'--local-only':'local_only','--writers-paused':'writers_paused','--plan':'plan','--resume':'resume'},values={'--source':'source','--output':'output','--worker-version':'worker_version'};
 for(let i=0;i<args.length;i++){const arg=args[i],key=flags[arg]||values[arg];if(!key||key in o)stop25('INVALID_OR_DUPLICATE_OPTION');if(flags[arg])o[key]=true;else{const value=args[++i];if(!value||value.startsWith('--'))stop25('OPTION_VALUE_REQUIRED');o[key]=value;}}
 if(!o.local_only||!o.source||!o.plan&&(!o.output||!o.writers_paused)||o.plan&&o.resume)stop25('USAGE_LOCAL_ONLY_SOURCE_OUTPUT_PAUSED');return o;
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{const o=parseUpgradeArgs25(process.argv.slice(2));console.log(JSON.stringify(o.plan?inspectUpgrade25(o):await upgradeLocal25(o),null,2));}catch(e){console.error(JSON.stringify({ok:false,code:e.code||'LOCAL_UPGRADE_STOP',details:e.details||{},remote_permitted:false}));process.exitCode=1;}
