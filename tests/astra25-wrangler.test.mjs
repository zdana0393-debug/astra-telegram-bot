import {test} from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {scenario25,fakeBot25} from './task04/upgrade-helpers.mjs';
const bundle=process.env.ASTRA25_WRANGLER_BUNDLE;if(!bundle||!path.isAbsolute(bundle)||!bundle.startsWith('/tmp/astra25-task04-dryrun-'))throw Error('Explicit local pinned Wrangler --dry-run bundle required');
const worker=(await import(pathToFileURL(bundle))).default;
for(const flow of ['health','legacy_paid'])test('actual pinned Wrangler dry-run bundle: '+flow,async()=>{const c=scenario25();let db,fake;try{await c.migrate();db=c.open();fake=fakeBot25(db,{bot:worker});
 if(flow==='health'){const r=await worker.fetch(new Request('https://synthetic.invalid/health'),fake.env),s=await r.json();assert.equal(r.status,503);assert.equal(s.tarot25_schema_ready,true);assert.equal(s.tarot25_sales_enabled,false);assert.equal(s.public_ready,false);}
 else {const q=fake.click(12,'tarot:three');await fake.hook(q);const body=fake.calls.filter(x=>x.method==='sendMessage').at(-1).body,b=body.reply_markup.inline_keyboard.flat().find(b=>b.callback_data.startsWith('shell:tarot26:'));assert.ok(b);await fake.hook(fake.click(12,b.callback_data));await fake.hook(fake.click(12,b.callback_data));assert.equal(db.prepare('SELECT balance FROM astra_users WHERE telegram_id=12').get().balance,95);assert.equal(db.prepare('SELECT count(*) n FROM astra_tarot_purchases26').get().n,1);}
 }finally{fake?.close();db?.close();c.close();}});
