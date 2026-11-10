import fs from 'node:fs';import {broadcastFixture,withClock,click,last,cron,sent,instrument,audience} from './task03-helpers.mjs';
export {withClock,click,last,cron,sent,instrument,audience};
export const migration28=fs.readFileSync(new URL('../migrations/0028_notification_consent.sql',import.meta.url),'utf8');
export function consentFixture(options={}){const f=broadcastFixture(options);f.db.exec(migration28);let mid=100;f.apiResult('sendMessage',body=>({message_id:++mid,chat:{id:body.chat_id,type:'private'}}));return f;}
export const consent=f=>f.query('SELECT * FROM astra_notification_consent28 WHERE telegram_id=1');
export function enableDelivery(f){f.env.ASTRA_DAILY_DELIVERY_ENABLED='true';f.db.exec('UPDATE astra_consent_runtime28 SET delivery_quarantined=0');}
export async function openConsent(f,id=1){const r=await click(f,'notifications',id);if(r.status!==200)throw Error('Open failed '+r.status);const body=last(f);const cb=body.reply_markup.inline_keyboard.flat().find(x=>x.callback_data?.startsWith('shell:consent28:grant:'))?.callback_data;if(!cb)throw Error('Challenge missing: '+body.text);return {data:cb,mid:f.query('SELECT pending_message_id FROM astra_notification_consent28 WHERE telegram_id=?',id).pending_message_id};}
export function confirm(f,c,id=1){const q=f.click(id,c.mid);q.callback_query.data=c.data;return f.hook(q);}
export async function optin(f,id=1){return confirm(f,await openConsent(f,id),id);}
