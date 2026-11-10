import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=fs.readFileSync(path.join(root,'release/ASTRA_2_4_WORKER.js'),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
if(sha(base)!=='5f34b44948e4bb6be643d586e712554d41f9b9bf7f2ee7175c4bf5e6d77786f4')throw Error('Frozen Worker 2.4 changed');
const modules=new Map();
function resolve(from,request){const id=path.posix.normalize(path.posix.join(path.posix.dirname(from),request));if(!id.startsWith('src/tarot25/')&&!id.startsWith('data/tarot25-'))throw Error('Unexpected module '+id);return id;}
async function bundle(id){
 if(modules.has(id))return;modules.set(id,'');let code=fs.readFileSync(path.join(root,id),'utf8');
 if(id.endsWith('.json')){modules.set(id,'module.exports='+code.trim()+';');return;}
 const dependencies=[];
 code=code.replace(/import\s+(\{[^}]+\}|[A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"](?:\s+with\s*\{type:['"]json['"]\})?;/g,(_,what,request)=>{
  const target=resolve(id,request);dependencies.push(target);return 'const '+(what.startsWith('{')?what.replace(/\bas\b/g,':'):what)+'=require('+JSON.stringify(target)+');';
 });
 code=code.replace(/export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_,names,request)=>{const target=resolve(id,request);dependencies.push(target);return 'const {'+names.replace(/\bas\b/g,':')+'}=require('+JSON.stringify(target)+');';});
 code=code.replace(/import\(['"]([^'"]+)['"]\)/g,(_,request)=>{const target=resolve(id,request);dependencies.push(target);return 'Promise.resolve(require('+JSON.stringify(target)+'))';});
 const exports=Object.keys(await import(pathToFileURL(path.join(root,id))));
 code=code.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g,'').replace(/export\s*\{[^}]+\};?/g,'');
 code+='\nObject.assign(module.exports,{'+exports.join(',')+'});';modules.set(id,code);
 for(const d of dependencies)await bundle(d);
}
await bundle('src/tarot25/ui.mjs');await bundle('src/tarot25/runtime25.mjs');
const loader=`\n// TASK03 modules: factory-scoped; generation/catalog initialized only when used.\nconst t25Modules=(()=>{const factories={${[...modules].sort(([a],[b])=>a.localeCompare(b,'en')).map(([id,code])=>JSON.stringify(id)+':(module,require)=>{\n'+code+'\n}').join(',\n')}};const cache=Object.create(null);return {require(id){if(!cache[id]){const module={exports:{}};cache[id]=module;factories[id](module,this.require.bind(this));}return cache[id].exports;}};})();\nconst t25Scope=t25Modules.require('src/tarot25/runtime25.mjs').scope25;\nasync function home25(env,id){const u=await getUser(env,id);if(!u?.zodiac)return send(env,id,'Профиль изменился. Откройте /start, чтобы продолжить.');return send(env,id,'Астра\\n'+zodiacName(u.zodiac)+' · '+u.balance+' ✨\\n\\nВыберите, к чему обратиться сегодня.',{reply_markup:keyboard});}
const t25Ui=t25Modules.require('src/tarot25/ui.mjs').createTarotUi({home:home25,dayCard,threeCards});\nasync function shellPage(env,id,page,q=null,updateId=null){if(page==='tarot')return t25Ui.menu(env,id);return pre25_shellPage(env,id,page,q,updateId);}\nasync function callback(env,q,updateId){if(String(q.data||'').startsWith('t25:'))return t25Ui.callback(env,q,updateId);return pre25_callback(env,q,updateId);}\nasync function health(env){const response=await pre25_health(env),state=await response.json(),s=await t25Modules.require('src/tarot25/purchases29.mjs').schema29(env);state.tarot25_schema_ready=s.ready;state.tarot25_sales_enabled=Boolean(s.ready&&s.enabled===1&&POLICY_TRUE(env.ASTRA_TAROT25_ENABLED));state.tarot25_manual_ready=s.ready;state.public_ready=false;state.ready=false;state.release_scope='TASK03_LOCAL_CANDIDATE';return Response.json(state,{status:503,headers:{'Cache-Control':'no-store'}});}\n`;
let out=base;
function replaceOnce(a,b){if(out.split(a).length!==2)throw Error('Patch anchor not unique '+a);out=out.replace(a,b);}
replaceOnce("const VERSION = 'ASTRA-2.4-task06-rc';","const VERSION = 'ASTRA-2.5-task03-candidate';");
replaceOnce('async function callback(env,q,updateId) {','async function pre25_callback(env,q,updateId) {');
replaceOnce('async function shellPage(env,id,page,q=null,updateId=null){','async function pre25_shellPage(env,id,page,q=null,updateId=null){');
replaceOnce('async function health(env){\n const response=await pre28_health','async function pre25_health(env){\n const response=await pre28_health');
// Negative IDs are reserved solely for live-profile manual-read leases, never Telegram updates.
const validation=out.match(/if\s*\(!Number\.isSafeInteger\(update\.update_id\)\)/g)||[];
if(validation.length!==2)throw Error('Update validation anchors changed');
out=out.replace(/if\s*\(!Number\.isSafeInteger\(update\.update_id\)\)/g,'if(!Number.isSafeInteger(update.update_id)||update.update_id<0)');
replaceOnce('const astraWorker = {',loader+'\nconst astraWorker = {');
replaceOnce('astraWorker.fetch(request,task01Env(scoped))','astraWorker.fetch(request,t25Scope(task01Env(scoped)))');
const target='release/ASTRA_2_5_TASK03_CANDIDATE.js';fs.writeFileSync(path.join(root,target),out);
console.log(JSON.stringify({file:target,sha256:sha(out),bytes:Buffer.byteLength(out),gzip_bytes:gzipSync(out,{level:9}).length,frozen_24_sha256:sha(base),modules:modules.size}));
