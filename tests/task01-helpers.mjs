import fs from 'node:fs';
import {fixture} from './helpers.mjs';
import {configureFence26,approveFenceNotice26,task01Env} from '../src/task01/bonus.mjs';
export const migration26=fs.readFileSync(new URL('../migrations/0026_economy_fence.sql',import.meta.url),'utf8');
export const SYNTHETIC_FENCE_KEY='TASK01_SYNTHETIC_HMAC_KEY_NOT_A_SECRET_1234567890';
export function taskFixture(options={}){const f=fixture({full:true,...options});f.db.exec(migration26);return f;}
export async function setupFence(f){Object.assign(f.env,{ASTRA_BONUS_FENCE_KEY:SYNTHETIC_FENCE_KEY,ASTRA_BONUS_FENCE_KEY_ID:'v1',ASTRA_BONUS_FENCE_NOTICE_ACK:'APPROVED_BONUS_FENCE_30_DAYS'});await configureFence26(f.env);await approveFenceNotice26(f.env,'bonus-fence-30d-v1','APPROVED_BONUS_FENCE_30_DAYS');}
export function activate(f,day='2026-11-09'){f.env.ASTRA_ECONOMY_V2_ENABLED='true';f.db.prepare('UPDATE astra_patch26 SET start_day=?,activated=1,enabled=1 WHERE singleton=1').run(day);}
export function members(f,status='member'){f.apiResult('getChatMember',body=>body.user_id===424242?{status:'administrator'}:typeof status==='function'?status(body):{status});}
export const click=(f,page,id=1,mid=1)=>{const q=f.click(id,mid);q.callback_query.data='shell:'+page;return f.hook(q);};
export const sign=(f,id=1)=>{const q=f.click(id);q.callback_query.data='sign:aries';return f.hook(q);};
export const last=f=>f.out.filter(r=>r.method==='sendMessage').at(-1)?.body;
export const count=(f,t)=>f.query('SELECT count(*) n FROM '+t).n;
export async function withClock(iso,work){const Real=Date;let current=iso;class Fixed extends Real{constructor(...args){super(...(args.length?args:[current]));}static now(){return new Real(current).getTime();}}globalThis.Date=Fixed;try{return await work(value=>current=value);}finally{globalThis.Date=Real;}}
export function starSetup(f){Object.assign(f.env,{ASTRA_TELEGRAM_TEST_MODE:'true',ASTRA_PAYMENT_ENVIRONMENT_ACK:'DEDICATED_TELEGRAM_TEST_ENVIRONMENT_CONFIRMED',ASTRA_PAYMENT_POLICY_ACCEPTED:'APPROVED_SUPPORT_TERMS_RETENTION',STARS_SHOP_ENABLED:'true'});f.db.exec("UPDATE astra_policy SET stars_enabled=1,payment_scope='test',support='mailto:support@example.test',terms_version='test-v1',retention_days=365,verified_bot_id=424242");}
export const starProof=(o,id=crypto.randomUUID())=>({currency:'XTR',total_amount:o.xtr,invoice_payload:o.payload,telegram_payment_charge_id:'FAKE_TASK01_'+id});
