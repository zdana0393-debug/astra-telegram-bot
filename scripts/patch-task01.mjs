import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const plain=s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
export function patchTask01(source,manifest){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('TASK01 anchor mismatch: '+a.slice(0,100));source=source.replace(a,b);};
 const functions=['readPolicy','policyClock','armPolicy','capturePolicyEvent','settlePolicyEvents','policySummary','policyBefore','policyAfter','createUser','setZodiac','secretArchive','policyWelcome','bonus','invite','channelMenu','channelCheck','threeCards','shellPage','policyFaq','paymentCommand','paymentsAdmin','createStarOrder','sendStarInvoice','reservePrecheckout','answerStarPrecheckout','receiveStarPayment','receiveStarRefund','requestStarRefund','reconcileStarPage','readStarHistory','savePaymentAnomaly'];
 for(const f of functions)replace('async function '+f+'(', 'async function pre26_'+f+'(');
 replace('const readPaymentOrder=', 'const pre26_readPaymentOrder=');
 replace('function validStarProof(', 'function pre26_validStarProof(');
 replace("'ASTRA-2.4-candidate'","'ASTRA-2.4-task01'");
 replace('const STAR_PACKAGES=Object.freeze({10:{xtr:10,dust:100},25:{xtr:25,dust:270},50:{xtr:50,dust:570}});','const STAR_PACKAGES=Object.freeze({10:{xtr:10,dust:40},25:{xtr:25,dust:110},50:{xtr:50,dust:240}});');
 const sql=read('migrations/0026_economy_fence.sql'),created=[...sql.matchAll(/CREATE (?:TABLE|INDEX|TRIGGER|VIEW) IF NOT EXISTS ([a-z_0-9]+)/g)].map(m=>m[1]),dropped=[...sql.matchAll(/DROP TRIGGER IF EXISTS ([a-z_0-9]+)/g)].map(m=>m[1]);
 manifest=[...new Set([...manifest.filter(n=>!dropped.includes(n)||created.includes(n)),...created])];
 const start=source.indexOf('async function schemaReady(env)'),end=source.indexOf('\nasync function health',start);
 source=source.slice(0,start)+`async function schemaReady(env){if(!env.DB||!activationReady(env))return false;try{const r=await env.DB.prepare("SELECT count(*) n,(SELECT migration_done FROM astra_patch26 WHERE singleton=1) complete,(SELECT migration_done FROM astra_policy WHERE singleton=1) old_complete FROM sqlite_master WHERE name IN (${manifest.map(n=>"'"+n+"'").join(',')})").first();return r?.n===${manifest.length}&&r.complete===1&&r.old_complete===1;}catch{return false;}}\n`+source.slice(end);
 replace('  state.ready=state.schema_ready && state.policy_ready &&',`  try{const fence=await fenceContext26(env);state.bonus_fence_ready=fence.ok;state.bonus_fence_blocker=fence.blocker;state.bonus_fence_expired_pending=Boolean(fence.expired_pending);state.bonus_notice_ready=Boolean(fence.notice_ready);}catch{state.bonus_fence_ready=false;state.bonus_fence_blocker='BONUS_FENCE_SCHEMA_MISSING';}
  state.free_content_ready=state.schema_ready&&state.db_query==='OK';
  state.ready=state.bonus_fence_ready && state.schema_ready && state.policy_ready &&`);
 replace("u.pathname==='/internal/economy/policy'", "(u.pathname==='/internal/economy/policy'||u.pathname==='/internal/economy/fence')");
 replace("  if (text==='/delete') {", "  if (text==='/delete') {\n    await syncBonusOwner26(env,id);");
 replace('Профиль, обычный журнал, активность и материалы удалены. Оплаченные доказательства и незавершённые долги сохраняются по /privacy и /terms для поддержки/возвратов. Для новой регистрации используйте /start.', 'Профиль, обычный журнал, активность и материалы удалены. Минимальные HMAC-права на бонусы сохраняются до 30 дней после начисления; это персональные псевдонимизированные данные. Платёжные доказательства и долг сохраняются отдельно по /privacy и /terms. Для новой регистрации используйте /start.');
 replace("const recognized=/^stars:", "const recognized=/^tarot26:[a-f0-9]{32}$/.test(page||'')||/^stars:(?:buy26:(?:10|25|50)|accept26:(?:10|25|50):[a-f0-9]{12})$/.test(page||'')||/^stars:");
 // The general UI/editorial phase is not performed: only monetary values and required notice change.
 source=source.replaceAll('Три карты — 3 ✨','Три карты — 5 ✨').replaceAll('расклад на три карты — 3 ✨','расклад на три карты — 5 ✨').replaceAll('Таро: 3 ✨','Таро: 5 ✨');
 source=source.replaceAll('Новый профиль: 12 ✨ один раз. Первый активный вход: +3 ✨ автоматически.','Новый профиль: 5 ✨ один раз. Первый активный вход: +2 ✨ автоматически.').replaceAll('Первые 3 дня подряд: +3; каждые 7 подряд: +5; 30 разных активных дат: +12 один раз.','Первые 3 дня подряд: +3; каждые 7 подряд: +4; 30 разных активных дат: +6 один раз.').replaceAll('Новые рефералы: +14/+4 после двух дат. Новый канал: +8 один раз; старые +5 закрывают право.','Новые рефералы: +10/+3 после выбора знака. Новый канал: +15 самому, +5 исходному пригласившему; старые +5 закрывают право.').replaceAll('+3 за первый вход; первые 3 подряд +3 один раз; каждые 7 подряд +5; 30 разных дат +12 один раз.','+2 за первый вход; первые 3 подряд +3 один раз; каждые 7 подряд +4; 30 разных дат +6 один раз.').replaceAll('+3 за дату, +3 за первые 3 подряд, +5 за каждый 7-дневный цикл и +12 за 30 разных дат.','+2 за дату, +3 за первые 3 подряд, +4 за каждый 7-дневный цикл и +6 за 30 разных дат.');
 // Preserve the common admin API; route reads/updates/purge across immutable order versions.
 const adminStart=source.indexOf('async function purgePaymentData('),adminEnd=source.indexOf('// Integration in the single Worker scope',adminStart);
 const adminBody=source.slice(adminStart,adminEnd).replaceAll('astra_payment_orders','astra_all_orders26').replaceAll('astra_payment_receipts','astra_all_receipts26');
 source=source.slice(0,adminStart)+adminBody+source.slice(adminEnd);
 // Require fresh v2-price consent rather than interpreting an old package button as the new package.
 source=source.replaceAll('`stars:buy:${key}`','`stars:buy26:${key}`').replace('const buy=/^stars:buy:(10|25|50)$/.exec(page);','const buy=/^stars:buy26:(10|25|50)$/.exec(page);').replaceAll('`stars:accept:${buy[1]}:${token}`','`stars:accept26:${buy[1]}:${token}`').replace('const consent=/^stars:accept:(10|25|50):([a-f0-9]{12})$/.exec(page);','const consent=/^stars:accept26:(10|25|50):([a-f0-9]{12})$/.exec(page);').replace('const key=`${q.message.message_id}:${consent[1]}:${consent[2]}`;','const key=`stars-pack-v2:${q.message.message_id}:${consent[1]}:${consent[2]}`;');
 const modules=['src/task01/bonus.mjs','src/task01/payments.mjs','src/task01/ui.mjs','src/task01/admin.mjs'];
 const labels={'tarot:v2':'Новый расклад на три карты (5 ✨)','initial':'Новый профиль','legacy_initial':'Начальный баланс прежних правил','daily':'Активный день','legacy_daily':'Ручной бонус прежних правил','first3':'Первые три дня подряд','weekly':'Семидневный цикл','thirty':'Тридцать разных дат','gpt6':'Секретный архив','channel':'Подтверждённая подписка','legacy_channel':'Подписка прежних правил','referrer':'Приглашённый завершил регистрацию','legacy_referrer':'Старый реферальный договор','invitee':'Награда приглашённому','inviter_channel':'Подписка приглашённого на канал'};
 const reasons=Object.fromEntries(Object.entries(labels).map(([k,v])=>[k==='tarot:v2'?k:'reward:v3:'+k,v]));
 const extra='\n// TASK01 only: economic version and transparent finite bonus rights.\n'+modules.map(p=>plain(read(p))).join('\n')+'\nObject.assign(HISTORY_LABELS,'+JSON.stringify(reasons)+');\n';
 replace('const astraWorker = {',extra+'\nconst astraWorker = {');
 replace("scoped=>astraWorker.fetch(request,scoped)","scoped=>astraWorker.fetch(request,task01Env(scoped))");
 replace("scoped=>astraWorker.scheduled(event,scoped)","async scoped=>{try{if(scoped.DB)await purgeFences26(scoped);}catch{console.error('Bonus fence cleanup unavailable');}return astraWorker.scheduled(event,task01Env(scoped));}");
 return{source,manifest};
}
