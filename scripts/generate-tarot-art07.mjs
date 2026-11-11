import fs from'node:fs';import{CARDS,DECK_VERSION}from'../src/tarot25/catalog.mjs';
const manifest={manifest_version:'astra-art-manifest-v1',deck_version:DECK_VERSION,art_version:'astra-author-art-pending-v1',text_versions:['rws78-interpretation-v1','rws78-interpretation-v2'],status:'NO_AUTHOR_ASSETS_ATTACHED',private_originals_in_git:false,cards:CARDS.map(c=>({card_id:c.id,name_ru:c.name_ru,asset_id:c.asset_id,original:null,sha256:null,upright_rotation:0,reversed_rotation:180,telegram_upright:null,telegram_reversed:null}))};fs.writeFileSync('data/tarot25-art-manifest07.json',JSON.stringify(manifest,null,2)+'\n');

fs.writeFileSync('data/tarot25-art-contract07.json',JSON.stringify(CARDS.map(c=>({card_id:c.id,name_ru:c.name_ru})),null,2)+'\n');
