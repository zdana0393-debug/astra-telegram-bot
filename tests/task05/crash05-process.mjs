// Only a throwaway synthetic directory passed by test-astra25-crash.sh.
import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {createSynthetic20} from '../../scripts/lib/astra25-synthetic.mjs';import {upgradeLocal25,identifyStage25,validateDatabase25} from '../../scripts/lib/astra25-upgrade05.mjs';
const [mode,dir,phase]=process.argv.slice(2);if(!/^\/tmp\/astra25-task05-crash-[-A-Za-z0-9]+$/.test(dir||''))throw Error('Only new synthetic /tmp crash fixtures permitted');
const source=dir+'/origin.sqlite',output=dir+'/target.sqlite',options={local_only:true,writers_paused:true,source,output};
if(mode==='setup'){await createSynthetic20(source);const d=new DatabaseSync(source);d.exec('DELETE FROM astra_users WHERE telegram_id=1');d.close();}
else if(mode==='crash'){await upgradeLocal25({...options,fault(p,s){if(p===phase&&s==='astra25-before-0025-referrers.v1')process.kill(process.pid,'SIGKILL');}});throw Error('Crash injection not reached');}
else if(mode==='resume'){const r=await upgradeLocal25({...options,resume:true});assert.equal(r.target_stage,'0029');assert.equal(r.source_preserved,true);const db=new DatabaseSync(output);try{assert.equal(identifyStage25(db),10);validateDatabase25(db,10);assert.equal(db.prepare('SELECT sum(balance) total FROM astra_users').get().total,436);}finally{db.close();}console.log(JSON.stringify({task05_actual_sigkill_case:phase,passed:true,source_preserved:true}));}
else throw Error('Unknown crash-test mode');
