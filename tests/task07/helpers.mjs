import fs from'node:fs';import {DatabaseSync}from'node:sqlite';
import bot from'../../release/ASTRA_2_5_TASK07_CANDIDATE.js';
import {scenario25,fakeBot25,actor25,generation25,wallet25,pick25,press25,screen25,sent25,openTarot25}from'../task04/upgrade-helpers.mjs';
import {upgradeLocal25}from'../../scripts/lib/astra25-upgrade07.mjs';
export function scenario07(){const c=scenario25();return{...c,migrate:extra=>upgradeLocal25({...c.options,...extra}),async ready(){await upgradeLocal25(c.options);const db=c.open(),fake=fakeBot25(db,{bot});return{db,fake};}};}
export function fakeBot07(db,opts={}){return fakeBot25(db,{bot,...opts});}
export function enable25(db,fake){enable07({db,fake});}
export async function quote25(fake,label='Три карты',id=12){await openTarot25(fake,id);await press25(fake,pick25(fake,'Новый вопрос'),id);const theme=label==='Отношения'?'Отношения':label==='Дела и обучение'?'Работа и карьера':label==='Выбор'?'Выбор и жизненная':'Общий вопрос';await press25(fake,pick25(fake,theme),id);await press25(fake,pick25(fake,label),id);return pick25(fake,'Подтвердить');}
export async function setup07(){const c=scenario25();await upgradeLocal25(c.options);const db=c.open();db.exec('PRAGMA foreign_keys=ON');const fake=fakeBot25(db,{bot});return{...c,db,fake,close(){fake.close();db.close();c.close();}};}
export function enable07(c,{questions=false}={}){c.db.exec('UPDATE astra_tarot25_runtime29 SET enabled=1;UPDATE astra_tarot30_policy SET write_enabled=1;UPDATE astra_tarot31_policy SET enabled=1'+(questions?',questions_enabled=1':''));Object.assign(c.fake.env,{ASTRA_TAROT25_ENABLED:'true',ASTRA_TAROT25_STORAGE_TEST_MODE:'true',ASTRA_TAROT25_INDEPENDENT_TEST_MODE:'true',...(questions?{ASTRA_TAROT25_QUESTIONS_TEST_MODE:'true'}:{})});}
export {bot,actor25,generation25,wallet25,pick25,press25,screen25,sent25,openTarot25,DatabaseSync};

export{scenario07 as scenario25,fakeBot07 as fakeBot25New};
export{metadata,seedHistorical25,stage25}from'../task04/upgrade-helpers.mjs';
export{readState25}from'../../scripts/lib/astra25-upgrade07.mjs';
