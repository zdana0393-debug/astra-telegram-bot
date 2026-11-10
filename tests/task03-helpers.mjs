import fs from 'node:fs';
import {taskFixture,withClock,click,last} from './task01-helpers.mjs';
export {withClock,click,last};
export const migration27=fs.readFileSync(new URL('../migrations/0027_broadcast.sql',import.meta.url),'utf8');
export function broadcastFixture(options={}){const f=taskFixture(options);f.db.exec(migration27);return f;}
export function audience(f,n){for(let i=1;i<=n;i++){f.db.prepare("INSERT INTO astra_users(telegram_id,zodiac,notifications_enabled) VALUES(?,?,1)").run(i,['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'][(i-1)%12]);}}
export async function cron(f){return f.bot.scheduled({scheduledTime:Date.now()},f.env);}
export const sent=f=>f.out.filter(x=>x.method==='sendMessage');
export async function instrument(f,work){const logs=[],log=console.log;console.log=s=>{if(typeof s==='string'&&s.startsWith('{'))logs.push(JSON.parse(s));};const flag=f.env.ASTRA_D1_DIAGNOSTICS;f.env.ASTRA_D1_DIAGNOSTICS='true';try{return{result:await work(),logs};}finally{console.log=log;f.env.ASTRA_D1_DIAGNOSTICS=flag;}}
