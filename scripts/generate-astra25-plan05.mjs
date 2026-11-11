import fs from 'node:fs';import {generatePlan05,PLAN05} from './lib/astra25-plan05.mjs';
if(process.argv.length!==2)throw Error('No database arguments accepted');const p=generatePlan05();fs.writeFileSync(PLAN05,JSON.stringify(p,null,2)+'\n');console.log(JSON.stringify({plan:p.plan_sha256,candidate:p.candidate,stages:p.stages.map(s=>({id:s.stage,objects:s.object_count}))}));
