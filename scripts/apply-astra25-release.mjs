// Pure local patch over an existing PRIVATE art Worker. No registry extraction,
// no network, no installation, no changes to historical candidates or migrations.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
const ROOT25=fileURLToPath(new URL('../',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function releasePlan(){const p=JSON.parse(fs.readFileSync(ROOT25+'data/astra25-upgrade-plan-task07.json','utf8')),{plan_sha256,...body}=p;
 if(p.version!=='astra25-local-upgrade-v3'||sha(canonical(body))!==plan_sha256||sha(fs.readFileSync(ROOT25+p.candidate.path))!==p.candidate.sha256||!p.sources.every(s=>sha(fs.readFileSync(ROOT25+s.path))===s.sha256)||p.stages.at(-1).stage!=='0031')throw Error('RELEASE25_PLAN_MISMATCH');return p;}
export function assembleRelease25(privateWorker){
 const plan=releasePlan();let body=privateWorker;
 const once=(a,b)=>{if(body.split(a).length!==2)throw Error('RELEASE25_SOURCE_MISMATCH');body=body.replace(a,b);};
 // Recognize the reviewed private assembler, not arbitrary uploaded JavaScript.
 if(!body.includes('const privateTarotArtRegistry=')||!body.includes("state.release_scope='PRIVATE_ART_LOCAL_CANDIDATE'"))throw Error('PRIVATE_ART_WORKER_REQUIRED');
 once("const VERSION = 'ASTRA-2.5-private-art-local';","const VERSION = 'ASTRA-2.5-clean-release';");
 once('return {sendArt,sendPurchasedArt};','return {sendArt,sendPurchasedArt,validateTelegramArt};');
 const source=fs.readFileSync(ROOT25+'src/release25/readiness.mjs','utf8').replace('export async function releaseHealth25','async function releaseHealth25');
 const expected=plan.stages.at(-1).objects.map(({name,type,sql})=>({name,type,sql}));
 if(Buffer.byteLength(JSON.stringify({params:[JSON.stringify(expected)]}))>900000)throw Error('RELEASE25_SCHEMA_PAYLOAD_BUDGET');
 const old="async function health(env){const response=await pre25_health(env),state=await response.json(),s=await t25Modules.require('src/tarot25/purchases31.mjs').schema31(env);state.tarot25_schema_ready=s.ready;state.tarot25_sales_enabled=Boolean(s.ready&&s.enabled===1&&POLICY_TRUE(env.ASTRA_TAROT25_ENABLED)&&s.write_enabled===1&&POLICY_TRUE(env.ASTRA_TAROT25_STORAGE_TEST_MODE)&&s.independent_enabled===1&&POLICY_TRUE(env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE));state.tarot25_manual_ready=s.ready;state.public_ready=false;state.ready=false;state.release_scope='PRIVATE_ART_LOCAL_CANDIDATE';return Response.json(state,{status:503,headers:{'Cache-Control':'no-store'}});}";
 once(old,source+"\nasync function health(env){const response=await pre25_health(env),base=await response.json(),tarot=await t25Modules.require('src/tarot25/purchases31.mjs').schema31(env);return releaseHealth25(env,{base,tarot,registry:privateTarotArtRegistry,validateArt:privateTarotArt.validateTelegramArt,forecastActive:engineActive(env,dayMSK()),expectedCount:"+expected.length+",expectedJSON:"+JSON.stringify(JSON.stringify(expected))+"});}");
 if(gzipSync(body).length>3*1024*1024)throw Error('RELEASE25_WORKER_SIZE_BUDGET');
 return body;
}
