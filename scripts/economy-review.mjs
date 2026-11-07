// Synthetic fixture only. No external network, secrets, D1 or live Telegram.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fixture} from '../tests/helpers.mjs';
import {recordActivity,readActivity,activityDay} from '../src/economy/activity.mjs';
import {readHistoryPage,historyRecordText} from '../src/economy/history.mjs';
const f=fixture({economy:true,legacyUsers:[{id:1,balance:137}]});
const click=async(page,id=1)=>{const q=f.click(id);q.callback_query.data='shell:'+page;assert.equal((await f.hook(q)).status,200);};
const sends=()=>f.out.filter(r=>r.method==='sendMessage');
try{
  const stats=[];const prepare=f.env.DB.prepare;
  f.env.DB.prepare=sql=>{const h=prepare(sql);for(const method of ['first','all','run']){const old=h[method];h[method]=async function(){const result=await old.call(this);stats.push({sql,method,changes:result?.meta?.changes||0});return result;};}return h;};
  const step=async fn=>{stats.length=0;const start=performance.now(),result=await fn();return{result,ms:performance.now()-start,statements:stats.length,writes:stats.filter(s=>s.method==='run').length,changes:stats.reduce((n,s)=>n+s.changes,0)};};
  const first=await step(()=>recordActivity(f.env,1,activityDay(),'message')),repeat=await step(()=>recordActivity(f.env,1,activityDay(),'callback'));
  const sourceFiles=['ASTRA_2_3B_WORKER.js','ASTRA_2_4A_WORKER.js'];
  const timing=a=>{a.sort((x,y)=>x-y);return{samples:a.length,median_ms:Number(a[Math.floor(a.length/2)].toFixed(3)),p95_ms:Number(a[Math.floor(a.length*.95)].toFixed(3)),max_ms:Number(a.at(-1).toFixed(3))};};
  const cold={};
  for(const name of sourceFiles){const code=fs.readFileSync(new URL('../release/'+name,import.meta.url),'utf8').replace('export default {','globalThis.worker = {');const samples=[];
    for(let i=0;i<20;i++){const start=performance.now();vm.runInNewContext(code,{structuredClone});samples.push(performance.now()-start);}cold[name]=timing(samples);}
  await f.hook(f.message(1,'🎁 Бонус дня'));await click('channel');const member=f.click(1);member.callback_query.data='channel:check';await f.hook(member);
  await f.hook(f.message(1,'gpt6'));await f.hook(f.click(1));await click('forecast:pay:'+activityDay());
  for(let i=0;i<18;i++){const owner=101+i;await f.hook(f.message(owner,'/start ref_1'));const select=f.click(owner);select.callback_query.data='sign:virgo';assert.equal((await f.hook(select)).status,200);}
  assert.equal(f.reconcile(),0);const rowsBefore=f.db.prepare('SELECT * FROM astra_wallet_ledger WHERE telegram_id=1').all(),balance=f.balance(1);
  let examples='# Astra 2.4A: примеры пользовательских экранов\n\n7 ноября 2026. Синтетические профили и fake Telegram API, не настоящие пользователи. Это прямые ответы собранного Worker без ручного редактирования экранов. Исторический баланс 137 добавлен как старый профиль **до** применения 0021; opening создан настоящей локальной миграцией. Затем штатно проведены дневной/канальный/GPT6 бонусы, Таро, расширенный прогноз и 18 реферальных начислений. UTC created_at задаётся SQLite; даты старой истории не выдумываются.\n\n';
  for(const [title,page] of [['Звёздная пыль','dust'],['Экономическое досье','dossier:economy']]){await click(page);examples+=`## ${title}\n\n\`\`\`text\n${sends().at(-1).body.text}\n\`\`\`\n\n`;}
  let next='dust:history',pageNumber=0,displayed=0;
  while(next){await click(next);const body=sends().at(-1).body;pageNumber++;displayed+=(body.text.match(/\d\d\.\d\d\.\d{4}, /g)||[]).length;
    examples+=`## История · страница ${pageNumber}\n\n\`\`\`text\n${body.text}\n\`\`\`\n\nКнопки: ${body.reply_markup.inline_keyboard.flat().map(b=>b.text).join(' · ')}.\n\n`;
    next=body.reply_markup.inline_keyboard.flat().find(b=>b.text==='Старее ›')?.callback_data.slice(6)||null;assert.ok(pageNumber<10);
  }
  assert.equal(displayed,rowsBefore.length);assert.ok(displayed>=20);assert.equal(balance,f.balance(1));assert.deepEqual(f.db.prepare('SELECT * FROM astra_wallet_ledger WHERE telegram_id=1').all(),rowsBefore);
  // Separate registered profile illustrates registration, rather than relabelling opening.
  await click('dust:history',101);examples+=`## Отдельный новый профиль: регистрация\n\n\`\`\`text\n${sends().at(-1).body.text}\n\`\`\`\n\nИсторический opening и начальная registration показаны разными причинами.\n`;
  fs.writeFileSync(new URL('../docs/ASTRA_2_4A_HISTORY_EXAMPLES.md',import.meta.url),examples);
  const history=await step(()=>readHistoryPage(f.env,1)),older=await step(()=>readHistoryPage(f.env,1,history.result.older)),activity=await step(()=>readActivity(f.env,1));
  const warm=[];for(let i=0;i<100;i++){const start=performance.now(),page=await readHistoryPage(f.env,1);page.rows.map(historyRecordText);warm.push(performance.now()-start);}
  const plan=f.db.prepare(`EXPLAIN QUERY PLAN SELECT rowid,created_at,delta,reason FROM astra_wallet_ledger WHERE telegram_id=? AND rowid<=? AND (created_at,idempotency_key)<(?,?) ORDER BY created_at DESC,idempotency_key DESC LIMIT 13`).all(1,999999,'2030-01-01 00:00:00','test').map(r=>r.detail);
  const withoutResult=s=>({statements:s.statements,write_statements:s.writes,changed_table_rows:s.changes,local_ms:Number(s.ms.toFixed(3))});
  const metrics={runtime:process.version,single_file_bytes:Object.fromEntries(sourceFiles.map(name=>[name,fs.statSync(new URL('../release/'+name,import.meta.url)).size])),local_cold_parse_and_context:cold,
    local_warm_history_query_and_render:timing(warm),activity_first_day:withoutResult(first),activity_repeat_day:withoutResult(repeat),history_first_page:withoutResult(history),history_older_page:withoutResult(older),activity_summary:withoutResult(activity),history_query_plan:plan,
    examples:{owner_ledger_rows:rowsBefore.length,pages:pageNumber,rows_rendered:displayed,final_balance:balance,ledger_mismatches:f.reconcile()},
    caveat:'Node wall-clock and SQLite query plans only. Statement counts/changes are not D1 rows_read/rows_written. Cold VM parsing is not Cloudflare isolate CPU; no real D1/Telegram/1102 measurement.'};
  fs.writeFileSync(new URL('../docs/ASTRA_2_4A_METRICS.json',import.meta.url),JSON.stringify(metrics,null,2)+'\n');
  console.log(JSON.stringify(metrics));
}finally{f.close();}
