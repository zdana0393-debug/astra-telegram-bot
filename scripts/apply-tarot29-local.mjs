import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';import {applyLocal29} from './lib/migrate-tarot29-local.mjs';
const args=process.argv.slice(2);if(args.length!==3||args[0]!=='--local-only'||args[1]!=='--database'||!args[2]||/^(https?:|remote:)/i.test(args[2]))throw Error('Usage: node --experimental-sqlite scripts/apply-tarot29-local.mjs --local-only --database <LOCAL_COPY.sqlite>');
if(!fs.existsSync(args[2])||!fs.statSync(args[2]).isFile())throw Error('Existing LOCAL database copy required');
const db=new DatabaseSync(args[2]);try{console.log(JSON.stringify(applyLocal29(db)));}finally{db.close();}
