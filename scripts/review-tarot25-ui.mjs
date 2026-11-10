import fs from 'node:fs';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {uiFixture,open,button,press,offer,lastScreen,sent} from '../tests/tarot25-ui-helpers.mjs';
import {instrument} from '../tests/task06-helpers.mjs';
const screens=[],costs=[],f=uiFixture(),snapshots=[];
const capture=label=>{const s=lastScreen(f);screens.push({label,text:s.text,rows:s.reply_markup.inline_keyboard.map(r=>r.map(x=>x.text))});};
async function measure(label,work){const before=f.out.length,r=await instrument(f,work),d=r.logs.find(x=>x.event==='astra_d1_invocation');costs.push({label,sql:d.statements,d1_calls:d.d1_calls,http:f.out.length-before,operations:d.statements+f.out.length-before,wall_ms:d.wall_ms,rows_complete:d.rows_complete});return r.result;}
try{
 await measure('Меню OFF',()=>open(f));capture('Таро · OFF');await measure('Каталог OFF',()=>press(f,button(f,'Выбрать')));capture('Каталог · OFF');
 await measure('Категория OFF',()=>press(f,button(f,'Отношения')));capture('Отношения · закрыто');
 f.enable();await measure('Меню ON',()=>open(f));await measure('Каталог ON',()=>press(f,button(f,'Выбрать')));capture('Каталог · только локальное ON');await measure('Quote 10',()=>press(f,button(f,'Кельтский')));capture('Подтверждение · 10 карт');
 const confirm=button(f,'Подтвердить');const before=sent(f).length;await measure('Confirm 10 cold + delivery',()=>press(f,confirm));const reading=sent(f).slice(before).join('');screens.push({label:'Реальное чтение · 10 карт',text:reading,rows:lastScreen(f).reply_markup.inline_keyboard.map(r=>r.map(x=>x.text))});
 await measure('Duplicate confirm 10',()=>press(f,confirm));capture('Повторное подтверждение');await measure('History',()=>press(f,button(f,'История')));capture('История');await measure('Paid manual read',()=>press(f,button(f,'оплачено')));
 const p=await offer(f,1);f.apiFailure('sendMessage','network');await measure('Confirm + network failure',()=>press(f,p));f.apiFailure('sendMessage',null);await open(f);await press(f,button(f,'История'));await press(f,button(f,'оплачено 8'));capture('Неопределённый исход');
 for(const i of [4,5]){const p=await offer(f,i),before=sent(f).length;await measure('Confirm '+[3,3,3,3,5,7,10][i],()=>press(f,p));screens.push({label:'Реальное чтение · '+[3,3,3,3,5,7,10][i]+' карт',text:sent(f).slice(before).join(''),rows:lastScreen(f).reply_markup.inline_keyboard.map(r=>r.map(x=>x.text))});}
 const b=await offer(f,6);capture('Недостаточно пыли');await press(f,b);capture('Отказ без списания');
for(const row of f.db.prepare('SELECT snapshot_json,result FROM astra_tarot25_purchases29').all()){const t=performance.now();for(let i=0;i<100;i++)JSON.stringify(JSON.parse(row.snapshot_json));snapshots.push({snapshot_utf16:row.snapshot_json.length,snapshot_utf8:Buffer.byteLength(row.snapshot_json),text_utf16:row.result.length,json_parse_stringify_mean_ms:(performance.now()-t)/100});}
}finally{f.close();}
const target='release/ASTRA_2_5_TASK03_CANDIDATE.js',bytes=fs.readFileSync(target),cold=[];
cold.push(...fs.readFileSync('data/tarot25-ui-cold.ndjson','utf8').trim().split('\n').map(JSON.parse));
const metrics={scope:'local Node 24 / SQLite / fake Telegram; NOT Cloudflare CPU or D1 rows',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,gzip_bytes:gzipSync(bytes,{level:9}).length,cold_imports:cold,snapshots,costs};
fs.writeFileSync('data/tarot25-ui-metrics.json',JSON.stringify(metrics,null,2)+'\n');
fs.writeFileSync('data/tarot25-ui-screens.json',JSON.stringify(screens,null,2)+'\n');
fs.writeFileSync('docs/ASTRA_2_5_TASK_03_SCREENS.md','# TASK03 — реальные локальные экраны\n\nИсточник: итоговый Worker, SQLite0029 и fake Bot API. Все ON-сценарии только локальные. Вопросы не собирались. Это не скриншоты Telegram.\n\n'+screens.map(s=>'## '+s.label+'\n\n```text\n'+s.text+'\n```\n\n'+s.rows.map(r=>r.join(' | ')).join('\n\n')).join('\n\n')+'\n');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
fs.writeFileSync('docs/ASTRA_2_5_TASK_03_MOBILE_MOCK.html','<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TASK03 · локальный макет</title><style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#101725;color:#e5e9f2;font:16px/1.45 system-ui}h1{font-size:20px}h2{font-size:17px}article{margin:18px 0;padding:12px;background:#1d293e;border-radius:12px}pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.row{display:flex;gap:5px;margin-top:6px}button{flex:1;min-width:0;border:0;border-radius:7px;background:#344563;color:#e5e9f2;white-space:normal;overflow-wrap:anywhere;padding:10px 7px;font:14px system-ui}</style><h1>Локальный макет сообщений TASK03</h1><p>SQLite + fake Bot API. Не настоящий Telegram.</p>'+screens.map(s=>'<article><h2>'+esc(s.label)+'</h2><pre>'+esc(s.text)+'</pre>'+s.rows.map(r=>'<div class="row">'+r.map(x=>'<button>'+esc(x)+'</button>').join('')+'</div>').join('')+'</article>').join('')+'</html>');
console.log(JSON.stringify(metrics,null,2));
