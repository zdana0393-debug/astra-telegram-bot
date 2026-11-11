import names from '../../data/tarot25-art-contract07.json' with {type:'json'};
export const registry = {version:'astra-telegram-art-v1',deck_version:'rws78-v1',art_version:'SYNTHETIC-TEST-NO-PORTRAITS',
  bot_id:901,realm:'test',source_manifest_sha256:'0'.repeat(64),cards:names.map(c=>({card_id:c.card_id,
    upright:{file_id:'SYNTHETIC_UPRIGHT_'+c.card_id},reversed:{file_id:'SYNTHETIC_REVERSED_'+c.card_id}}))};
