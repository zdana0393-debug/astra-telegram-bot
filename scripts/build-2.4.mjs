import {patchTask03} from './patch-task03.mjs';
import {patchTask02} from './patch-task02.mjs';
import {patchTask01} from './patch-task01.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './build-2.4a.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const plain=s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
let source=read('release/ASTRA_2_4A_WORKER.js');
function replace(old,next){if(source.split(old).length!==2)throw Error('2.4 anchor mismatch: '+old.slice(0,100));source=source.replace(old,next);}
replace("'ASTRA-2.4A-candidate'","'ASTRA-2.4-candidate'");
replace('ASTRA 2.4A economy candidate','ASTRA 2.4 rewards and Stars candidate');
replace('docs/ASTRA_2_4A_STAGING_GUIDE.md','docs/ASTRA_2_4_STAGING_GUIDE.md');
for(const [name,next] of [['welcome','legacyWelcome'],['bonus','legacyBonus'],['invite','legacyInvite'],['channelMenu','legacyChannelMenu'],['channelCheck','legacyChannelCheck'],['economyDust','legacyEconomyDust'],['economyDossier','legacyEconomyDossier'],['activityScreen','legacyActivityScreen']])replace('async function '+name+'(', 'async function '+next+'(');
replace('async function legacyWelcome(', 'async function welcome(env,id,ref=\'\'){return policyWelcome(env,id,ref);}\nasync function legacyWelcome(');
replace("INSERT OR IGNORE INTO astra_users(telegram_id, referrer_id) VALUES(?,?)", "INSERT OR IGNORE INTO astra_users(telegram_id, referrer_id,created_at) VALUES(?,?,?)");
replace('.bind(id, friend).run();',".bind(id, friend,new Date().toISOString().slice(0,19).replace('T',' ')).run();");
replace('changed.meta.changes && old.referrer_id && !old.referral_rewarded','changed.meta.changes && old.referrer_id && !old.referral_rewarded && !(await env.DB.prepare("SELECT invitee FROM astra_referral_contracts WHERE invitee=? AND mode=\'v2\'").bind(id).first())');
const marker='  const u=await getUser(env,id);\n  await send(env,id,`Солнечный знак:';
replace(marker,'  await settlePolicyEvents(env,id);\n'+marker);
replace("  const uid=update.update_id;", "  const uid=update.update_id;\n  if(await paymentUpdate(env,update))return;");
replace("  const id=update.message?.from?.id ?? update.callback_query?.from?.id ?? null;", "  const policyEvent=await policyBefore(env,update);\n  const id=update.message?.from?.id ?? update.callback_query?.from?.id ?? null;");
replace('const newActivityDelivery=activityEvent?await economyFirstDelivery(env,uid):false;', 'const newActivityDelivery=activityEvent&&!policyEvent?.policyActive?await economyFirstDelivery(env,uid):false;');
replace('const freshActivity=activityEvent&&newActivityDelivery;', 'const freshActivity=activityEvent&&newActivityDelivery&&!policyEvent?.policyActive;');
replace('if(freshActivity&&!activityRecorded&&activityEvent.signSelection)await safeEconomyActivity(env,activityEvent,now);','if(freshActivity&&!activityRecorded&&activityEvent.signSelection)await safeEconomyActivity(env,activityEvent,now);\n      await policyAfter(env,policyEvent);');
replace("  const trust={", "  const currentFAQ=(page==='faq'||/^faq:/.test(page)||page==='trust:dust')?await policyFaq(env):FAQ;\n  if(page==='trust:dust')return screen(env,id,'Методология и учёт пыли',currentFAQ[4][2],[[button('История операций','dust:history'),button('Условия','stars:terms')]],'trust');\n  const trust={");
replace("FAQ.map((f,i)=>`${i+1}. ${f[0]}\\n${f[1]}`).join('\\n\\n'),FAQ.map", "currentFAQ.map((f,i)=>`${i+1}. ${f[0]}\\n${f[1]}`).join('\\n\\n'),currentFAQ.map");
replace("item=FAQ[n];", "item=currentFAQ[n];");
replace('/delete — удаление профиля, журнала, раскладов, расширенных прогнозов, активных дат, отметки награды и связей с ID.', '/delete удаляет обычные данные профиля. Оплаченные доказательства и незавершённые долги сохраняются по /privacy и /terms для поддержки и возвратов.');
replace("  if(page==='home') return home(env,id);", "  if(page==='home') return home(env,id);\n  if(page==='dust:shop'||page.startsWith('stars:'))return starsRoute(env,id,page,q);");
replace("async function incoming(env,m,updateId) {", "async function incoming(env,m,updateId) {\n  if(m.chat?.type==='private'&&m.from&&await paymentCommand(env,m))return;");
replace('Профиль и связанные записи удалены. Для новой регистрации используйте /start.', 'Профиль, обычный журнал, активность и материалы удалены. Оплаченные доказательства и незавершённые долги сохраняются по /privacy и /terms для поддержки/возвратов. Для новой регистрации используйте /start.');
replace("const recognized=validSign||", "const recognized=/^stars:(?:terms|support|history(?::[on]:[0-9a-z]+:[0-9a-z]+)?|buy:(?:10|25|50)|accept:(?:10|25|50):[a-f0-9]{12})$/.test(page||'')||validSign||");
replace('https://api.telegram.org/bot${env.ASTRA_BOT_TOKEN}/${method}',"https://api.telegram.org/bot${env.ASTRA_BOT_TOKEN}/${POLICY_TRUE(env.ASTRA_TELEGRAM_TEST_MODE)?'test/':''}${method}");
const schemaStart=source.indexOf('async function schemaReady(env)'),schemaEnd=source.indexOf('\nasync function health',schemaStart);
const previous=source.slice(schemaStart,schemaEnd);
const names=[...previous.matchAll(/'([a-z][a-z_0-9]+)'/g)].map(m=>m[1]).filter(n=>n.startsWith('astra_')||n.startsWith('idx_')).map(n=>n==='astra_referral'?'astra_referral_policy':n);
for(const m of read('migrations/0025_rewards_stars.sql').matchAll(/CREATE (?:TABLE|INDEX|TRIGGER) IF NOT EXISTS ([a-z_0-9]+)/g))names.push(m[1]);
let manifest=[...new Set(names)];
source=source.slice(0,schemaStart)+`async function schemaReady(env){
  if(!env.DB||!activationReady(env))return false;
  try{const r=await env.DB.prepare("SELECT count(*) AS n,(SELECT migration_done FROM astra_policy WHERE singleton=1) AS migration_done,(SELECT count(*) FROM sqlite_master WHERE type='trigger' AND name='astra_referral') AS old_referral FROM sqlite_master WHERE name IN (${manifest.map(n=>"'"+n+"'").join(',')})").first();
    return r?.n===${manifest.length}&&r.migration_done===1&&r.old_referral===0;
  }catch{return false;}
}
`+source.slice(schemaEnd);
replace('  state.schema_ready=await schemaReady(env);', `  state.schema_ready=await schemaReady(env);
  try{const p=await readPolicy(env);state.policy_state=p.activated?(p.enabled?'active':'paused'):(p.start_day?'scheduled':'legacy');
    state.policy_ready=(!env.ASTRA_ECONOMY_V2_START_DAY||env.ASTRA_ECONOMY_V2_START_DAY===p.start_day)&&!(p.enabled&&p.start_day&&dayMSK()>=p.start_day&&!POLICY_TRUE(env.ASTRA_ECONOMY_V2_ENABLED));
    state.stars_flag=POLICY_TRUE(env.STARS_SHOP_ENABLED);state.stars_configured=Boolean(p.payment_scope&&p.terms_version&&p.support&&p.retention_days);
  }catch{state.policy_ready=false;}`);
replace('state.ready=state.schema_ready &&', 'state.ready=state.schema_ready && state.policy_ready &&');
replace('    const u=new URL(request.url);',`    const u=new URL(request.url);
    if(u.pathname.startsWith('/internal/payments/')||u.pathname==='/internal/economy/policy'){
      try{if(!env.ASTRA_ADMIN_KEY||request.headers.get('Authorization')!=='Bearer '+env.ASTRA_ADMIN_KEY)return new Response('Forbidden',{status:403});if(!await schemaReady(env))return new Response('D1 schema unavailable',{status:503});return await paymentsAdmin(request,env);}catch{return new Response('Administrative operation unavailable; reconcile before retry',{status:503});}
    }`);
// RETURNING removes a redundant read after a cache insert; a conflict still reads the canonical row.
const oldCache=`  await env.DB.prepare(\`INSERT INTO astra_forecast_daily(sign,day,locale,free_text,extended_text,number,engine_version,content_version,number_algorithm_version,source_tags)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sign,day,locale) DO NOTHING\`)
    .bind(sign,day,'ru',f.free_text,f.extended_text,f.number,f.engine_version,f.content_version,f.number_algorithm_version,f.source_tags).run();
  const saved=await read();`;
replace(oldCache,oldCache.replace('  await env.DB.prepare(', '  const inserted=await env.DB.prepare(').replace(' DO NOTHING`',' DO NOTHING RETURNING *`').replace('.source_tags).run();','.source_tags).first();').replace('const saved=await read();','const saved=inserted||await read();'));
// Keep the eight recipients and delivery states; D1.batch counts as one invocation query.
replace(`      await env.DB.prepare("UPDATE astra_broadcast_jobs SET delivery='sent' WHERE telegram_id=? AND day=?")
        .bind(user.telegram_id,day).run();
      await env.DB.prepare('UPDATE astra_users SET last_broadcast_day=? WHERE telegram_id=?')
        .bind(day,user.telegram_id).run();`, `      await env.DB.batch([
        env.DB.prepare("UPDATE astra_broadcast_jobs SET delivery='sent' WHERE telegram_id=? AND day=?").bind(user.telegram_id,day),
        env.DB.prepare('UPDATE astra_users SET last_broadcast_day=? WHERE telegram_id=?').bind(day,user.telegram_id)
      ]);`);
replace(`    await env.DB.prepare("DELETE FROM astra_processed_updates WHERE received_at < datetime('now','-14 days')").run();
    await env.DB.prepare("DELETE FROM astra_update_jobs WHERE received_at < datetime('now','-14 days') AND status='done'").run();
    await env.DB.prepare("DELETE FROM astra_broadcast_jobs WHERE day < date('now','-14 days')").run();`, `    await env.DB.batch([
      env.DB.prepare("DELETE FROM astra_processed_updates WHERE received_at < datetime('now','-14 days')"),
      env.DB.prepare("DELETE FROM astra_update_jobs WHERE received_at < datetime('now','-14 days') AND status='done'"),
      env.DB.prepare("DELETE FROM astra_broadcast_jobs WHERE day < date('now','-14 days')")
    ]);`);
replace(`      await env.DB.prepare("UPDATE astra_broadcast_jobs SET delivery=? WHERE telegram_id=? AND day=?")
        .bind(e.telegramCode ? 'rejected' : 'unknown',user.telegram_id,day).run();
      if (e.telegramCode===403) {
        await env.DB.prepare('UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=?')
          .bind(user.telegram_id).run();
      }`, `      const failed=[env.DB.prepare("UPDATE astra_broadcast_jobs SET delivery=? WHERE telegram_id=? AND day=?")
        .bind(e.telegramCode ? 'rejected' : 'unknown',user.telegram_id,day)];
      if(e.telegramCode===403)failed.push(env.DB.prepare('UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=?').bind(user.telegram_id));
      await env.DB.batch(failed);`);
// Pre-checkout's deadline includes schema readiness, not just order validation.
replace('  async fetch(request,env) {', '  async fetch(request,env) {\n    const receivedAt=performance.now();');
replace(`      if (!await schemaReady(env)) return new Response('D1 schema unavailable',{status:503});
      try { await dispatch(env,await request.json()); return new Response('OK'); }
      catch(e){console.error('Webhook processing failed');return new Response('Temporary failure',{status:500});}`,
`      try {
        const update=await request.json();
        if(update?.pre_checkout_query){
          if(!Number.isSafeInteger(update.update_id))throw Error('Invalid update');
          await answerStarPrecheckout(env,update.pre_checkout_query,{ready:()=>schemaReady(env),startedAt:receivedAt});
          return new Response('OK');
        }
        if(!await schemaReady(env))return new Response('D1 schema unavailable',{status:503});
        await dispatch(env,update);return new Response('OK');
      }catch(e){console.error('Webhook processing failed');return new Response('Temporary failure',{status:500});}`);
const modules=['src/runtime/diagnostics.mjs','src/rewards/policy.mjs','src/payments/transport.mjs','src/payments/service.mjs','src/payments/admin.mjs','src/rewards/ui.js','src/payments/ui.js'];
const labels={initial:'Новый профиль policy-v2',daily:'Активный день',first3:'Первые три дня подряд',weekly:'Семидневный цикл',thirty:'Тридцать разных дат',channel:'Новая подтверждённая подписка',referrer:'Реферальная награда за две даты',invitee:'Награда приглашённому за две даты'};
const extra={...Object.fromEntries(Object.entries(labels).map(([k,v])=>['reward:v2:'+k,v])),'payment:stars':'Пакет пыли за Stars','refund:cash':'Возврат пакета: уменьшение пыли','refund:repayment':'Погашение долга по возврату'};
const bundle='// Generated unified Astra 2.4. Rewards and Stars OFF until approved.\n'+modules.map(p=>plain(read(p))).join('\n')+'\nObject.assign(HISTORY_LABELS,'+JSON.stringify(extra)+');\n';
replace('export default {',bundle+'\nconst astraWorker = {');
source+=`\nexport default {\n  fetch(request,env){return measureInvocation(env,'http',scoped=>astraWorker.fetch(request,scoped));},\n  scheduled(event,env){return measureInvocation(env,'cron',scoped=>astraWorker.scheduled(event,scoped));}\n};\n`;
if(process.env.ASTRA_BUILD_BASELINE!=='1')({source,manifest}=patchTask01(source,manifest));
if(process.env.ASTRA_BUILD_BASELINE!=='1'&&process.env.ASTRA_BUILD_TASK01!=='1')source=patchTask02(source);
if(process.env.ASTRA_BUILD_BASELINE!=='1'&&process.env.ASTRA_BUILD_TASK01!=='1'&&process.env.ASTRA_BUILD_TASK02B!=='1')source=patchTask03(source);
fs.writeFileSync(path.join(root,'release/ASTRA_2_4_WORKER.js'),source);
fs.writeFileSync(path.join(root,'data/payment-schema-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built release/ASTRA_2_4_WORKER.js (${Buffer.byteLength(source)} bytes); schema ${manifest.length}`);
