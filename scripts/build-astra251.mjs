// Deterministic PUBLIC delta. Private Worker/registry never enter this repository.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL}from'node:url';import{createHash}from'node:crypto';import{gzipSync}from'node:zlib';
import{assembleArtCandidate}from'./build-tarot-art-private.mjs';import{assembleRelease25}from'./apply-astra25-release.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const PARENT_SHA251='3ee56aefdebb7dc4b3cacfc74b2da24e002e6f150f7b45167c1f472719303561';
export function registryLiteral251(code){const start='const privateTarotArtRegistry=',end=';\nconst privateTarotArt=';if(code.split(start).length!==2)throw Error('PRIVATE_REGISTRY_ANCHOR');const a=code.indexOf(start)+start.length,b=code.indexOf(end,a);if(b<0)throw Error('PRIVATE_REGISTRY_ANCHOR');return{a,b,text:code.slice(a,b)};}
export function normalized251(code){const r=registryLiteral251(code);return code.slice(0,r.a)+'__PRIVATE_REGISTRY_UNCHANGED__'+code.slice(r.b);}
export function publicParent251(){const names=JSON.parse(fs.readFileSync(root+'data/tarot25-art-contract07.json','utf8'));const registry={version:'astra-telegram-art-v1',deck_version:'rws78-v1',art_version:'PUBLIC_TEMPLATE',source_manifest_sha256:'0'.repeat(64),bot_id:901,realm:'test',cards:names.map(c=>({card_id:c.card_id,upright:{file_id:'PUBLIC_TEMPLATE_UPRIGHT_'+c.card_id},reversed:{file_id:'PUBLIC_TEMPLATE_REVERSED_'+c.card_id}}))};return assembleRelease25(assembleArtCandidate(registry));}
async function compile(id,resolve){let code=fs.readFileSync(root+id,'utf8');if(id.endsWith('.json'))return{code:'module.exports='+code.trim()+';',deps:[]};const deps=[];
 code=code.replace(/import\s+(\{[^}]+\}|[A-Za-z_$][\w$]*)\s*from\s*['"]([^'"]+)['"](?:\s+with\s*\{type:['"]json['"]\})?;/g,(_,what,req)=>{const target=path.posix.normalize(path.posix.join(path.posix.dirname(id),req));resolve(target);deps.push(target);return'const '+(what.startsWith('{')?what.replace(/\bas\b/g,':'):what)+'=require('+JSON.stringify(target)+');';});
 code=code.replace(/import\(['"]([^'"]+)['"]\)/g,(_,req)=>{const target=path.posix.normalize(path.posix.join(path.posix.dirname(id),req));resolve(target);deps.push(target);return'Promise.resolve(require('+JSON.stringify(target)+'))';});
 const names=Object.keys(await import(pathToFileURL(root+id)));code=code.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g,'').replace(/export\s*\{[^}]+\};?/g,'');
 return{code:code+'\nObject.assign(module.exports,{'+names.join(',')+'});',deps};
}
function factory(code,id){const head=JSON.stringify(id)+':(module,require)=>{\n',a=code.indexOf(head);if(a<0||code.split(head).length!==2)throw Error('MODULE_ANCHOR');const tail=code.indexOf('\nObject.assign(module.exports,{',a),end=code.indexOf('\n}',tail)+2;if(tail<0||end<2)throw Error('MODULE_ANCHOR');return code.slice(a,end);}
export async function build251(){
 let parent=publicParent251(),body=parent;const replacements=[];
 function once(before,after){if(body.split(before).length!==2)throw Error('PATCH_ANCHOR_NOT_UNIQUE');replacements.push({before,after});body=body.replace(before,after);}
 once("const VERSION = 'ASTRA-2.5-clean-release';","const VERSION = 'ASTRA-2.5.1-stars-admin';");
 for(const id of ['src/tarot25/purchases31.mjs','src/tarot25/ui07.mjs']){const old=factory(body,id),compiled=await compile(id,target=>{if(!body.includes(JSON.stringify(target)+':(module,require)=>{'))throw Error('MISSING_PARENT_MODULE');});once(old,JSON.stringify(id)+':(module,require)=>{\n'+compiled.code+'\n}');}
 const modules=new Map();async function bundle(id){if(modules.has(id))return;modules.set(id,'');const c=await compile(id,t=>{if(!t.startsWith('src/astra251/')&&t!=='data/astra251-schema.json')throw Error('UNEXPECTED_251_MODULE');});modules.set(id,c.code);for(const dep of c.deps)await bundle(dep);}
 await bundle('src/astra251/runtime.mjs');
 const loader='\nconst astra251=(()=>{const factories={'+[...modules].sort(([a],[b])=>a.localeCompare(b,'en')).map(([id,c])=>JSON.stringify(id)+':(module,require)=>{\n'+c+'\n}').join(',\n')+'};const cache=Object.create(null);function require(id){if(!cache[id]){const module={exports:{}};cache[id]=module;factories[id](module,require);}return cache[id].exports;}return require("src/astra251/runtime.mjs");})();\n';
 once('const astraWorker = {',loader+'\nconst astraWorker = {');
 once('Астра хранит Telegram ID, знак, настройки, баланс, историю пыли, активные дни, приглашения и сохранённые материалы.','Астра хранит Telegram ID, знак, настройки, баланс, историю пыли, активные дни, приглашения и сохранённые материалы. Административные начисления также записываются в финансовый журнал. После /delete в их защитных квитанциях удаляются ID участников, но остаются сумма, время, случайное поколение профиля, номер события и криптографический отпечаток запроса без ограничения срока: это предотвращает повторное начисление. Административные права при удалении профиля отзываются.');
 once('async function paymentEnvironment(env,{shop=false,probe=false}={}){',"async function paymentEnvironment(env,{shop=false,probe=false}={}){if(shop&&!await astra251.paymentsReady(env))throw Error('STARS251_POLICY_OR_SCHEMA_NOT_APPROVED');");
 once('async function incoming(env,m,updateId){','async function incoming(env,m,updateId){if(await astra251.message(env,m,updateId,{send}))return;');
 once('await dispatch(env,update);return new Response(\'OK\');','await dispatch(astra251.authenticated(env),update);return new Response(\'OK\');');
 once('astraWorker.fetch(request,t25Scope(task01Env(scoped)))','astraWorker.fetch(request,astra251.scope(t25Scope(task01Env(scoped))))');
 const oldSource=fs.readFileSync(root+'src/release25/readiness.mjs','utf8').replace('export async function releaseHealth25','async function releaseHealth25');once(oldSource,'');
 const marker='async function health(env){const response=await pre25_health(env),base=await response.json(),tarot=';const a=body.indexOf(marker),b=body.indexOf('\n',a);if(a<0||b<0)throw Error('HEALTH_ANCHOR');
 once(body.slice(a,b),"async function health(env){const response=await pre25_health(env),base=await response.json(),tarot=await t25Modules.require('src/tarot25/purchases31.mjs').schema31(env);return astra251.health(env,{base,tarot,registry:privateTarotArtRegistry,validateArt:privateTarotArt.validateTelegramArt,forecastActive:engineActive(env,dayMSK())});}");
 if(registryLiteral251(parent).text!==registryLiteral251(body).text)throw Error('PRIVATE_REGISTRY_CHANGED');
 if(gzipSync(body).length>3*1024*1024)throw Error('WORKER_SIZE_BUDGET');
 const data={version:'astra251-public-delta-v1',parent_sha256:PARENT_SHA251,normalized_parent_sha256:sha(normalized251(parent)),normalized_output_sha256:sha(normalized251(body)),migration_sha256:sha(fs.readFileSync(root+'migrations/0032_astra251.sql')),replacements};
 return{...data,package_sha256:sha(canonical(data))};
}
export function apply251(code,delta){if(sha(normalized251(code))!==delta.normalized_parent_sha256)throw Error('PRIVATE_PARENT_TEMPLATE_MISMATCH');const original=registryLiteral251(code).text;for(const r of delta.replacements){if(code.split(r.before).length!==2)throw Error('PRIVATE_PATCH_ANCHOR_MISMATCH');code=code.replace(r.before,r.after);}if(registryLiteral251(code).text!==original||sha(normalized251(code))!==delta.normalized_output_sha256)throw Error('PRIVATE_OUTPUT_MISMATCH');return code;}
if(process.argv[1]===fileURLToPath(import.meta.url)){const d=await build251();fs.writeFileSync(root+'release/ASTRA_2_5_1_PATCH.json',JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({package_sha256:d.package_sha256,replacements:d.replacements.length,private_assets:false,network:false}));}
