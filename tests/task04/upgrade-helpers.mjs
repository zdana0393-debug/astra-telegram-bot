import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {createSynthetic20,fakeBot25} from '../../scripts/lib/astra25-synthetic.mjs';import {upgradeLocal25,readState25} from '../../scripts/lib/astra25-upgrade.mjs';import {ROOT25,SQL25} from '../../scripts/lib/astra25-upgrade-plan.mjs';
export const templateDir=fs.mkdtempSync('/tmp/astra25-task04-template-'),template=templateDir+'/origin.sqlite',metadata=await createSynthetic20(template);process.on('exit',()=>fs.rmSync(templateDir,{recursive:true,force:true}));
export function scenario25(){const dir=fs.mkdtempSync('/tmp/astra25-task04-test-'),source=dir+'/origin.sqlite',output=dir+'/target.sqlite';fs.copyFileSync(template,source);const options={local_only:true,writers_paused:true,source,output};return {dir,source,output,options,async migrate(extra={}){return upgradeLocal25({...options,...extra});},open(file=output){return new DatabaseSync(file);},close(){fs.rmSync(dir,{recursive:true,force:true});}};}
export function stage25(file,index){const db=new DatabaseSync(file);try{db.exec('PRAGMA foreign_keys=ON');for(let i=0;i<index;i++){db.exec('BEGIN IMMEDIATE');try{db.exec(fs.readFileSync(ROOT25+SQL25[i],'utf8'));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}}finally{db.close();}}
export const wallet25=db=>db.prepare('SELECT telegram_id,balance FROM astra_users ORDER BY telegram_id').all();
export const generation25=(db,id=1)=>db.prepare('SELECT generation FROM astra_user_policy WHERE telegram_id=?').get(id).generation;
export function actor25(db,id=1){return {telegram_id:id,generation:generation25(db,id)};}
export function enable25(db,fake){fake.env.ASTRA_TAROT25_ENABLED='true';db.exec('UPDATE astra_tarot25_runtime29 SET enabled=1');}
export async function openTarot25(fake,id=1){return fake.hook(fake.click(id,'shell:tarot'));}
export function screen25(fake){for(let i=fake.calls.length-1;i>=0;i--){const x=fake.calls[i];if(x.method==='editMessageReplyMarkup')return {...x.body,text:fake.calls.slice(0,i).filter(c=>c.method==='sendMessage').at(-1)?.body.text};}throw Error('No signed screen');}
export function pick25(fake,label){const s=screen25(fake),b=s.reply_markup.inline_keyboard.flat().find(b=>b.text.includes(label));if(!b)throw Error('No button '+label);return {data:b.callback_data,mid:s.message_id};}
export const press25=(fake,b,id=1,uid)=>fake.hook(fake.click(id,b.data,b.mid,uid));
export async function quote25(fake,label='Три карты',id=12){await openTarot25(fake,id);await press25(fake,pick25(fake,'Выбрать'),id);await press25(fake,pick25(fake,label),id);return pick25(fake,'Подтвердить');}
export const sent25=fake=>fake.calls.filter(x=>x.method==='sendMessage').map(x=>x.body.text);
export {fakeBot25,readState25};
export {seedHistorical25} from '../../scripts/lib/astra25-synthetic.mjs';
