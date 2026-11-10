import fs from 'node:fs';import {consentFixture} from './task06-helpers.mjs';
export const migration29=fs.readFileSync(new URL('../migrations/0029_tarot.sql',import.meta.url),'utf8');
export function fixture29({balance=100,...options}={}){const f=consentFixture({legacyUsers:[{id:1,balance},{id:2,balance}],...options});f.db.exec(migration29);f.actor=id=>({telegram_id:id,generation:f.query('SELECT generation FROM astra_user_policy WHERE telegram_id=?',id).generation});f.enable=()=>{f.env.ASTRA_TAROT25_ENABLED='true';f.db.exec('UPDATE astra_tarot25_runtime29 SET enabled=1');};return f;}
export const request=(spread_id='basic-3',n=1)=>({request_key:'req:'+n,update_id:n,spread_id});
