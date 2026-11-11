// Local-only composition over the frozen TASK07 candidate. NEVER writes into Git.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {validateTelegramArt} from '../src/tarot25/art-delivery.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const baseSHA = '018d2eda3fc13a7a0f85fffcc6e1c866a9901bfb2e8dcce5e1bd6d184d6f8bda';
const sha = s => createHash('sha256').update(s).digest('hex');

export function assembleArtCandidate(registry) {
  validateTelegramArt(registry);
  let body = fs.readFileSync(path.join(root, 'release/ASTRA_2_5_TASK07_CANDIDATE.js'), 'utf8');
  if (sha(body) !== baseSHA) throw Error('STOP_FROZEN_TASK07_CHANGED');
  function once(before, after) {
    if (body.split(before).length !== 2) throw Error('STOP_ART_ANCHOR_CHANGED');
    body = body.replace(before, after);
  }
  let module = fs.readFileSync(path.join(root, 'src/tarot25/art-delivery.mjs'), 'utf8');
  module = module.replace("import names from '../../data/tarot25-art-contract07.json' with {type:'json'};",
    'const names=' + fs.readFileSync(path.join(root, 'data/tarot25-art-contract07.json'), 'utf8') + ';');
  module = module.replace("import {validateSnapshot} from './reader-v2.mjs';",
    "const {validateSnapshot}=t25Modules.require('src/tarot25/reader-v2.mjs');");
  module = module.replace(/export /g, '');
  const hooks = `
// Private portrait registry: not a public route, URL, D1 object or Git artifact.
const privateTarotArtRegistry=${JSON.stringify(registry)};
const privateTarotArt=(()=>{${module}\nreturn {sendArt,sendPurchasedArt};})();
const artOn=env=>env.ASTRA_TAROT_ART_ENABLED===true||env.ASTRA_TAROT_ART_ENABLED==='true';
async function paidArtHost(env,a,material){
 return privateTarotArt.sendPurchasedArt({env,registry:privateTarotArtRegistry,actor:a,material,
  send:(method,body)=>t25Modules.require('src/tarot25/runtime05.mjs').telegram25(env,method,body,undefined,true),
  verify:async()=>Boolean(await env.DB.prepare('SELECT 1 FROM astra_tarot25_purchases29 t JOIN astra_users u USING(telegram_id) JOIN astra_user_policy g USING(telegram_id) WHERE t.offer_id=? AND t.telegram_id=? AND t.generation=? AND g.generation=t.generation').bind(material.offer_id,a.telegram_id,a.generation).first())});
}
async function dayArtHost(env,a,text,day){
 if(!artOn(env))return;
 const index=hash('card|'+a.telegram_id+'|'+day)%TAROT.length,name=TAROT[index][0];
 const contract=${JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, 'data/tarot25-art-contract07.json'), 'utf8')).filter(c=>c.card_id.startsWith('major-')))};
 const found=contract.find(c=>c.name_ru===name);if(!found)return;
 return privateTarotArt.sendArt({env,registry:privateTarotArtRegistry,actor:a,
  cards:[{card_id:found.card_id,reversed:hash('flip|'+a.telegram_id+'|'+day)%2===1,position_id:'day'}],
  send:(method,body)=>t25Modules.require('src/tarot25/runtime05.mjs').telegram25(env,method,body,undefined,true),
  verify:async()=>Boolean(await env.DB.prepare('SELECT 1 FROM astra_users u JOIN astra_user_policy g USING(telegram_id) WHERE u.telegram_id=? AND g.generation=?').bind(a.telegram_id,a.generation).first())});
}
async function legacyArtDay(env,id){
 const day=dayMSK(),text=dayCard(id,day),m=await send(shellEnv(env,'tarot'),id,text);
 if(artOn(env)){const a=await env.DB.prepare('SELECT u.telegram_id,g.generation FROM astra_users u JOIN astra_user_policy g USING(telegram_id) WHERE u.telegram_id=?').bind(id).first();if(a)await dayArtHost(env,a,text,day);}return m;
}
`;
  // Paid material is already returned by the existing atomic purchase adapter.
  once('await confirmPurchase(env,a,order);const r=await retryDelivery',
    'const artMaterial=await confirmPurchase(env,a,order);const r=await retryDelivery');
  once("    return await screen(env,a,r.state==='sent'?",
    "    if(r.state==='sent'&&r.http>0&&host.paidArt)await host.paidArt(env,a,artMaterial);\n    return await screen(env,a,r.state==='sent'?");
  once('await confirmPurchase(env,a,id);let last=null;',
    'const artMaterial=await confirmPurchase(env,a,id);let last=null;');
  once("if(result.state==='sent'&&result.http>0){await bind",
    "if(result.state==='sent'&&result.http>0){if(host.paidArt)await host.paidArt(env,a,artMaterial);await bind");
  // Explicit free history read. Only first page, never every long-text continuation.
  once(" const rows=[];if(offset+3<chunks.length)",
    " if(offset===0)await paidArtHost(env,a,material);\n const rows=[];if(offset+3<chunks.length)");
  once("if(action==='d')return await screen(env,a,host.dayCard(id));",
    "if(action==='d'){const day=dayMSK(),text=host.dayCard(id,day),m=await screen(env,a,text);if(host.dayArt)await host.dayArt(env,a,text,day);return m;}");
  once("case 'd':return await screen(env,a,host.dayCard(id),[[['История','i','0']]]);",
    "case 'd':{const day=dayMSK(),text=host.dayCard(id,day),m=await screen(env,a,text,[[['История','i','0']]]);if(host.dayArt)await host.dayArt(env,a,text,day);return m;}");
  once("return send(shellEnv(env,'tarot'),id,dayCard(id));", 'return legacyArtDay(env,id);');
  once("const t25Ui=t25Modules.require('src/tarot25/ui07.mjs').createTarotUi({home:home25,dayCard,threeCards});",
    hooks + "\nconst t25Ui=t25Modules.require('src/tarot25/ui07.mjs').createTarotUi({home:home25,dayCard,threeCards,paidArt:paidArtHost,dayArt:dayArtHost});");
  // Local artifact remains gated and /health remains503/public_ready:false.
  once("const VERSION = 'ASTRA-2.5-task07-candidate';", "const VERSION = 'ASTRA-2.5-private-art-local';");
  once("state.release_scope='TASK07_LOCAL_CANDIDATE'", "state.release_scope='PRIVATE_ART_LOCAL_CANDIDATE'");
  return body;
}

export function writePrivateArtCandidate(registryFile, output) {
  for (const file of [registryFile, output]) if (!path.isAbsolute(file)) throw Error('STOP_EXPLICIT_ABSOLUTE_PRIVATE_PATHS');
  const stat = fs.statSync(registryFile);
  if (fs.realpathSync(registryFile) !== registryFile || !stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077)) throw Error('STOP_UNSAFE_REGISTRY');
  for (const file of [registryFile, output]) if (file === root.slice(0,-1) || file.startsWith(root)) throw Error('STOP_PRIVATE_ART_OUTSIDE_GIT');
  for (const file of [registryFile, output]) {
    for (let parent = path.dirname(file);; parent = path.dirname(parent)) {
      const marker = path.join(parent, '.git');
      if (fs.existsSync(marker) && (fs.statSync(marker).isFile() || fs.existsSync(path.join(marker, 'HEAD')))) throw Error('STOP_PRIVATE_ART_OUTSIDE_GIT');
      if (path.dirname(parent) === parent) break;
    }
  }
  if (fs.realpathSync(path.dirname(output)) !== path.dirname(output) || fs.existsSync(output)) throw Error('STOP_NEW_PRIVATE_OUTPUT');
  const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
  const code = assembleArtCandidate(registry);
  fs.writeFileSync(output, code, {flag: 'wx', mode: 0o600});
  return {local_only: true, deployed: false, art_default: 'OFF', bytes: Buffer.byteLength(code), sha256: sha(code)};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 5 || args[0] !== '--local-only' || args[1] !== '--registry' || args[3] !== '--output') throw Error('Use --local-only --registry /private/file --output /private/new-worker.mjs');
  console.log(JSON.stringify(writePrivateArtCandidate(args[2], args[4])));
}
