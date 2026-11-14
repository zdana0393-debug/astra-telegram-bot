// Separate additive layer: the installed 2.5.1 base/owner authority is immutable.
import fs from 'node:fs';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{build251,apply251,publicParent251,normalized251,registryLiteral251}from'./build-astra251.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=s=>createHash('sha256').update(s).digest('hex');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function buildWebhook251(){
 const base=await build251();let body=apply251(publicParent251(),base);const parent=body,replacements=[];
 const once=(before,after)=>{if(body.split(before).length!==2)throw Error('WEBHOOK_PATCH_ANCHOR');replacements.push({before,after});body=body.replace(before,after);};
 let module=fs.readFileSync(root+'src/astra251/webhook-repair.mjs','utf8');
 module=module.replace("import {AUTH251,schema251} from './schema.mjs';",'const {AUTH251,schema251}=require("src/astra251/schema.mjs");').replace("import {ownerStatus251} from './owner.mjs';",'const {ownerStatus251}=require("src/astra251/owner.mjs");').replace('export async function webhookMessage251','async function webhookMessage251');
 if(/^import |^export /m.test(module))throw Error('UNEXPECTED_WEBHOOK_MODULE_DEPENDENCY');
 once('const astra251=(()=>{const factories={','const astra251=(()=>{const factories={"src/astra251/webhook-repair.mjs":(module,require)=>{\n'+module+'\nmodule.exports={webhookMessage251};\n},');
 once('const message=adminMessage251;','const {webhookMessage251}=require("src/astra251/webhook-repair.mjs");\nconst message=async(...args)=>await webhookMessage251(...args)||adminMessage251(...args);');
 once("const VERSION = 'ASTRA-2.5.1-stars-admin';","const VERSION = 'ASTRA-2.5.1-stars-admin-webhook';");
 if(registryLiteral251(body).text!==registryLiteral251(parent).text)throw Error('REGISTRY_CHANGED');
 const p={version:'astra251-webhook-patch-v1',base_package_sha256:base.package_sha256,normalized_parent_sha256:sha(normalized251(parent)),normalized_output_sha256:sha(normalized251(body)),replacements};
 return{...p,package_sha256:sha(canonical(p))};
}
export function applyWebhook251(code,p){const{package_sha256,...b}=p;if(sha(canonical(b))!==package_sha256||sha(normalized251(code))!==p.normalized_parent_sha256)throw Error('WEBHOOK_PATCH_INPUT_MISMATCH');const registry=registryLiteral251(code).text;for(const r of p.replacements){if(code.split(r.before).length!==2)throw Error('WEBHOOK_PATCH_ANCHOR');code=code.replace(r.before,r.after);}if(sha(normalized251(code))!==p.normalized_output_sha256||registryLiteral251(code).text!==registry)throw Error('WEBHOOK_PATCH_OUTPUT_MISMATCH');return code;}
if(process.argv[1]===fileURLToPath(import.meta.url)){const p=await buildWebhook251();fs.writeFileSync(root+'release/ASTRA_2_5_1_WEBHOOK_PATCH.json',JSON.stringify(p,null,2)+'\n');const template=fs.readFileSync(root+'review/astra251/webhook_patch_template.py','utf8');fs.writeFileSync(root+'review/astra251/ASTRA25_1_FIX_STARS_WEBHOOK.py',template.replace('__PUBLIC_PATCH_LITERAL__',JSON.stringify(JSON.stringify(p))));console.log(JSON.stringify({patch_sha256:p.package_sha256,private_assets:false}));}
