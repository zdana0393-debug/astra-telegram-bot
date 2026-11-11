import names from '../../data/tarot25-art-contract07.json' with {type:'json'};
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../',import.meta.url)),media=new Map();
let cards=names,artVersion='SYNTHETIC-TEST-NO-PORTRAITS',sourceHash='0'.repeat(64);
export const privateAssetsLoaded=Boolean(process.env.ASTRA_PRIVATE_TAROT_MANIFEST);
if(privateAssetsLoaded){
  const file=process.env.ASTRA_PRIVATE_TAROT_MANIFEST;
  if(!path.isAbsolute(file)||fs.realpathSync(file)!==file||file.startsWith(repo))throw Error('TEST_REQUIRES_PRIVATE_MANIFEST_OUTSIDE_GIT');
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  if(manifest.manifest_version!=='astra-art-manifest-v1'||manifest.deck_version!=='rws78-v1'||manifest.cards?.length!==78||manifest.input_kind!=='telegram_jpeg')throw Error('TEST_PRIVATE_MANIFEST_MISMATCH');
  const ids=new Set(manifest.cards.map(c=>c.card_id));
  if(ids.size!==78||!names.every(c=>ids.has(c.card_id)))throw Error('TEST_PRIVATE_CARD_IDS');
  cards=manifest.cards;artVersion=manifest.art_version;sourceHash=manifest.source_manifest_sha256;
  for(const c of cards)for(const orientation of ['upright','reversed']){
    const name=c.card_id+'-'+orientation+'.jpg';if(c['telegram_'+orientation]!==name)throw Error('TEST_PRIVATE_FILENAME');
    const target=path.join(path.dirname(file),'derivatives',name);
    if(fs.realpathSync(target)!==target)throw Error('TEST_PRIVATE_LINK');
    const hash=c['sha256_'+orientation];if(!/^[a-f0-9]{64}$/.test(hash))throw Error('TEST_PRIVATE_HASH');
    media.set('SYNTHETIC_'+orientation.toUpperCase()+'_'+c.card_id,{path:target,sha256:hash});
  }
}
// These IDs remain fictional even with the author's REAL private JPEG bytes.
// Every mock send resolves the ID to that private file and verifies its bytes locally.
export function verifyPrivateMockMedia(fileId){
  if(!privateAssetsLoaded)return;
  const entry=media.get(fileId);
  if(!entry||createHash('sha256').update(fs.readFileSync(entry.path)).digest('hex')!==entry.sha256)throw Error('TEST_PRIVATE_MEDIA_BYTES');
}
export const registry = {version:'astra-telegram-art-v1',deck_version:'rws78-v1',art_version:artVersion,
  bot_id:901,realm:'test',source_manifest_sha256:sourceHash,cards:cards.map(c=>({card_id:c.card_id,
    upright:{file_id:'SYNTHETIC_UPRIGHT_'+c.card_id},reversed:{file_id:'SYNTHETIC_REVERSED_'+c.card_id}}))};
