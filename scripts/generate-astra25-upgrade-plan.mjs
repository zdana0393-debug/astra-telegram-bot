import fs from 'node:fs';import {generatePlan25,PLAN_PATH25} from './lib/astra25-upgrade-plan.mjs';
if(process.argv.length!==2)throw Error('No database arguments accepted; generates a synthetic in-memory SQL manifest only');
const plan=generatePlan25();fs.writeFileSync(PLAN_PATH25,JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({plan_sha256:plan.plan_sha256,stages:plan.stages.map(({stage,object_count})=>({stage,object_count}))}));
