import bot from '../../release/ASTRA_2_5_TASK05_CANDIDATE.js';
import {scenario25,wallet25,fakeBot25,generation25,metadata,readState25,quote25,press25,pick25,screen25,sent25,openTarot25,actor25,enable25,seedHistorical25,stage25} from '../task04/upgrade-helpers.mjs';
import {upgradeLocal25} from '../../scripts/lib/astra25-upgrade05.mjs';
export function scenario05(){const c=scenario25();return {...c,migrate:extra=>upgradeLocal25({...c.options,...extra}),async ready(){await upgradeLocal25(c.options);const db=c.open(),fake=fakeBot25(db,{bot});return {db,fake};}};}
export function patchHTTP05(fake,handler){const previous=globalThis.fetch;globalThis.fetch=(url,options)=>{const method=String(url).split('/').at(-1);return handler({method,body:JSON.parse(options.body),url,options,previous});};return ()=>globalThis.fetch=previous;}
export async function measure05(fake,work){const logs=[],old=console.log,before=fake.calls.length;fake.env.ASTRA_D1_DIAGNOSTICS='true';console.log=s=>{if(typeof s==='string'&&s.startsWith('{'))logs.push(JSON.parse(s));};try{const response=await work();const m=logs.find(x=>x.event==='astra_d1_invocation');return {status:response.status,sql:m.statements,http:fake.calls.length-before,total:m.statements+fake.calls.length-before};}finally{console.log=old;}}
export {bot,wallet25,generation25,metadata,readState25,quote25,press25,pick25,screen25,sent25,openTarot25,actor25,enable25,seedHistorical25,stage25};

export {scenario05 as scenario25};
export function fakeBot25New(db,options={}){return fakeBot25(db,{bot,...options});}
