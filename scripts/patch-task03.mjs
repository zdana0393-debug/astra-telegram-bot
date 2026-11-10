import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),plain=s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
export function patchTask03(source){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('TASK03 anchor mismatch: '+a.slice(0,100));source=source.replace(a,b);};
 replace("'ASTRA-2.4-task02'","'ASTRA-2.4-task03'");for(const name of ['broadcast','sendForecastText','sendFreeForecast','health'])replace('async function '+name+'(', 'async function pre03_'+name+'(');
 replace("INSERT OR IGNORE INTO astra_users(telegram_id,referrer_id,created_at) VALUES(?,?,?)","INSERT OR IGNORE INTO astra_users(telegram_id,referrer_id,created_at,notifications_enabled) VALUES(?,?,?,0)");
 replace("  if(page==='forecast:read') return sendFreeForecast(env,id,u.zodiac);", "  if(page==='forecast:read') return sendFreeForecast(env,id,u.zodiac);\n  const datedForecast03=/^forecast:(offer|owned):(\\d{4}-\\d{2}-\\d{2})$/.exec(page);\n  if(datedForecast03)return forecastExtended(env,id,u,datedForecast03[1]==='owned'?'repeat':'confirm',datedForecast03[2]);");
 replace('const recognized=',"const recognized=/^forecast:(?:offer|owned):\\d{4}-\\d{2}-\\d{2}$/.test(page||'')||");
 const extra='\n// TASK03 broadcast delivery only. No symbolic or monetary rules changed.\n'+['src/broadcast/queue.mjs','src/broadcast/ui.js'].map(p=>plain(read(p))).join('\n')+'\n';
 replace('const astraWorker = {',extra+'const astraWorker = {');return source;
}
