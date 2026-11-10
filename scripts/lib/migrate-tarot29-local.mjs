// Deterministic whole-file LOCAL runner. No network, Wrangler, credentials, or remote mode.
import fs from 'node:fs';import {createHash} from 'node:crypto';
import prices29 from '../../data/tarot25-prices29.json' with {type:'json'};
import base from '../../data/tarot25-base-schema29.json' with {type:'json'};
import manifest from '../../data/tarot25-schema29.json' with {type:'json'};
const dir=new URL('../../migrations/0029_steps/',import.meta.url);
const files=['01_tables.sql','02_offer_guards.sql','03_payment.sql','04_complete.sql'];
export function preflightLocal29(db){
 const actual=db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
 const matches=x=>actual.some(a=>a.name===x.name&&a.type===x.type&&a.sql===x.sql);
 if(!base.every(matches))throw Error('BASE_SCHEMA_DRIFT_OR_PARTIAL');
 if(actual.filter(x=>x.name.includes('tarot25_')).some(x=>!manifest.some(m=>m.name===x.name&&m.type===x.type&&m.sql===x.sql)))throw Error('TAROT29_FOREIGN_PARTIAL_SCHEMA');
 if(actual.some(x=>x.name==='astra_tarot25_prices29')){const rows=db.prepare('SELECT * FROM astra_tarot25_prices29').all();if(rows.some(t=>!prices29.some(p=>Object.keys(p).every(k=>p[k]===t[k]))))throw Error('TAROT_PRICE_DATA_DRIFT');}
 if(db.prepare(`SELECT count(*) n FROM astra_users u WHERE u.balance<0 OR u.balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)`).get().n)throw Error('WALLET_PREFLIGHT_FAILED');
 if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('FK_PREFLIGHT_FAILED');
 const flags=db.prepare('SELECT migration_done FROM astra_patch26').get(),consent=db.prepare('SELECT migration_done FROM astra_consent_runtime28').get();if(flags?.migration_done!==1||consent?.migration_done!==1)throw Error('BASE_MIGRATION_INCOMPLETE');
 if(actual.some(x=>x.name==='astra_tarot25_runtime29')&&db.prepare('SELECT enabled FROM astra_tarot25_runtime29').get()?.enabled!==0)throw Error('CATALOGUE_MUST_BE_OFF');
 return true;
}
export function applyLocal29(db,{beforeFile=()=>{}}={}){
 preflightLocal29(db);const evidence=[];
 for(const file of files){const sql=fs.readFileSync(new URL(file,dir),'utf8');beforeFile(file);db.exec('BEGIN IMMEDIATE');try{db.exec(sql);preflightLocal29(db);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}evidence.push({file,sha256:createHash('sha256').update(sql).digest('hex')});}
 const actual=db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL").all();if(!manifest.every(m=>actual.some(a=>a.name===m.name&&a.type===m.type&&a.sql===m.sql)))throw Error('TAROT29_SCHEMA_INCOMPLETE');
 return{local_only:true,files:evidence,base_objects:base.length,new_objects:manifest.length};
}
// Used for static read-only audit files only; handles quoted DDL/embedded semicolons.
export function readOnlyStatements(sql){const out=[];let start=0,quote=null,line=false,block=false;for(let i=0;i<sql.length;i++){const a=sql[i],b=sql[i+1];if(line){if(a==='\n')line=false;continue;}if(block){if(a==='*'&&b==='/'){block=false;i++;}continue;}if(quote){if(a===quote){if(b===quote)i++;else quote=null;}continue;}if(a==='-'&&b==='-'){line=true;i++;continue;}if(a==='/'&&b==='*'){block=true;i++;continue;}if(a==="'"||a==='"'){quote=a;continue;}if(a===';'){const s=sql.slice(start,i).trim();if(s)out.push(s);start=i+1;}}if(quote||block)throw Error('UNTERMINATED_AUDIT');const end=sql.slice(start).trim();if(end)out.push(end);for(const s of out){const body=s.replace(/^--.*$/gm,'').trim();if(!/^(SELECT|WITH|PRAGMA foreign_key_check)\b/i.test(body))throw Error('AUDIT_NOT_READ_ONLY');}return out;}
