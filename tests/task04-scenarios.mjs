import fs from 'node:fs';
import {getForecastDaily,purchaseForecast} from '../src/forecast/service.mjs';
import {generateForecastForEnv} from '../src/forecast/editorial/configured.mjs';
import {broadcastFixture,click,last,withClock,instrument} from './task03-helpers.mjs';
import {setupFence,activate,starSetup,members,starProof} from './task01-helpers.mjs';
import {createStarOrder,receiveStarPayment,receiveStarRefund} from '../src/task01/payments.mjs';
export const uiCases04=[
 ['registration',null,{newUser:true}],['home','home'],['forecast','forecast'],['tarot','tarot'],['self','self'],['dossier','dossier'],['dust','dust'],['about','about'],
 ['free','forecast:read'],['paid-tarot','tarot:last',{prepaid:true}],['forecast-owned','forecast',{forecastOwned:true}],['forecast-confirm','forecast:extended'],['tarot-confirm','buy'],['insufficient-tarot','!tarot-no-money',{balance:0}],['insufficient-forecast','forecast:pay:2026-11-10',{balance:0}],
 ['invite-active','invite',{active:true}],['channel-active','channel',{active:true}],['bonus-active','gift',{active:true}],['dust-active','dust',{active:true}],['dust-paused','dust',{active:true,paused:true}],['invite-legacy','invite'],['channel-legacy','channel'],['bonus-legacy','gift'],
 ['notifications-off','notifications'],['notifications-old-on','notifications',{on:true}],['privacy','/privacy'],['delete','/delete'],['help','/help'],['terms-unconfigured','/terms'],['support-unconfigured','/paysupport'],['shop-off','dust:shop'],
 ['shop-test-only','dust:shop',{shop:true}],['stars-consent','stars:buy26:10',{shop:true}],['stars-consent-25','stars:buy26:25',{shop:true}],['stars-consent-50','stars:buy26:50',{shop:true}],['terms-configured','/terms',{shop:true}],['support-configured','/paysupport',{shop:true}],['payment-history','/payments',{shop:true,order:true}],['payment-received','!payment',{shop:true,order:true}],
 ['history','dust:history'],['activity','dust:activity',{active:true}],['economy-dossier','dossier:economy',{active:true}],['faq','faq'],['faq-authorship','faq:8:more'],['rules','rules'],['debt','dust',{shop:true,debt:true}]
];
export async function captureCase04([name,route,opts={}]){
 const f=broadcastFixture({legacyUsers:opts.newUser?[]:[{id:1,balance:opts.balance??20}]});try{
 await setupFence(f);if(opts.active)activate(f,'2026-11-10');if(opts.paused)f.env.ASTRA_ECONOMY_V2_ENABLED='false';if(!opts.newUser)f.db.exec('UPDATE astra_users SET notifications_enabled='+(opts.on?1:0));f.env.ASTRA_FORECAST_COMPACT_START_DAY='2026-11-10';members(f);
 if(opts.shop)starSetup(f);let order,proof;if(opts.order||opts.debt){order=await createStarOrder(f.env,1,10,'sample-order','test-v1');proof=starProof(order,'SAMPLE04');}
 if(opts.debt){await receiveStarPayment(f.env,1,proof);f.db.exec("UPDATE astra_users SET balance=0;INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason) VALUES('sample-spent',1,-60,'test:spent')");await receiveStarRefund(f.env,1,proof);}
 const measured=await instrument(f,()=>withClock('2026-11-10T06:00:00Z',async()=>{
  if(opts.prepaid){const text=JSON.parse(fs.readFileSync(new URL('./fixtures/task04-paid-tarot.json',import.meta.url),'utf8')).result;f.db.exec("INSERT INTO astra_tarot_offers26(offer_id,telegram_id,generation,request_key) SELECT 'ffffffffffffffffffffffffffffffff',telegram_id,generation,'sample-prepaid' FROM astra_user_policy WHERE telegram_id=1");f.db.prepare("INSERT INTO astra_tarot_purchases26(offer_id,telegram_id,price,result,delivery) VALUES('ffffffffffffffffffffffffffffffff',1,5,?,'sent')").run(text);}
  if(opts.forecastOwned){await getForecastDaily(f.env,'aries','2026-11-10',(sign,day)=>generateForecastForEnv(f.env,sign,day));await purchaseForecast(f.env,1,'aries','2026-11-10');}
  if(opts.newUser)await f.hook(f.message(1,'/start'));
  else if(route==='!tarot-no-money'){await click(f,'buy');const token=last(f).reply_markup.inline_keyboard.flat().find(b=>b.callback_data.startsWith('shell:tarot26:')).callback_data.slice(6);await click(f,token);}
  else if(route==='!payment')await f.hook({update_id:900001,message:{chat:{id:1,type:'private'},from:{id:1},successful_payment:proof}});
  else if(route.startsWith('/'))await f.hook(f.message(1,route));else await click(f,route);
 }));
 if(f.reconcile()!==0)throw Error('Unbalanced sample '+name);const body=last(f);if(!body)throw Error('No screen '+name);return{name,body:JSON.parse(JSON.stringify(body)),balance:f.balance(1)??null,costs:measured.logs.filter(x=>x.event==='astra_d1_invocation'),effects:{balance:f.balance(1)??null,notifications:f.query('SELECT notifications_enabled FROM astra_users WHERE telegram_id=1')?.notifications_enabled??null,orders:f.query('SELECT count(*) n FROM astra_all_orders26').n,receipts:f.query('SELECT count(*) n FROM astra_all_receipts26').n,tarot:f.query('SELECT count(*) n FROM astra_tarot_purchases26').n,forecast:f.query('SELECT count(*) n FROM astra_forecast_unlocks').n,ledger:f.db.prepare('SELECT delta,reason FROM astra_wallet_ledger ORDER BY rowid').all()}};
 }finally{f.close();}
}
