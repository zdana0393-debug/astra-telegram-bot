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
const manifest=[...new Set(names)];
source=source.slice(0,schemaStart)+`async function schemaReady(env){
  if(!env.DB||!activationReady(env))return false;
  try{const r=await env.DB.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name IN (${manifest.map(n=>"'"+n+"'").join(',')})").first();
    const p=await readPolicy(env),old=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='astra_referral'").first();
    return r?.n===${manifest.length}&&p?.migration_done===1&&!old;
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
const modules=['src/rewards/policy.mjs','src/payments/transport.mjs','src/payments/service.mjs','src/payments/admin.mjs','src/rewards/ui.js','src/payments/ui.js'];
const labels={initial:'Новый профиль policy-v2',daily:'Активный день',first3:'Первые три дня подряд',weekly:'Семидневный цикл',thirty:'Тридцать разных дат',channel:'Новая подтверждённая подписка',referrer:'Реферальная награда за две даты',invitee:'Награда приглашённому за две даты'};
const extra={...Object.fromEntries(Object.entries(labels).map(([k,v])=>['reward:v2:'+k,v])),'payment:stars':'Пакет пыли за Stars','refund:cash':'Возврат пакета: уменьшение пыли','refund:repayment':'Погашение долга по возврату'};
const bundle='// Generated unified Astra 2.4. Rewards and Stars OFF until approved.\n'+modules.map(p=>plain(read(p))).join('\n')+'\nObject.assign(HISTORY_LABELS,'+JSON.stringify(extra)+');\n';
replace('export default {',bundle+'\nexport default {');
fs.writeFileSync(path.join(root,'release/ASTRA_2_4_WORKER.js'),source);
fs.writeFileSync(path.join(root,'data/payment-schema-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built release/ASTRA_2_4_WORKER.js (${Buffer.byteLength(source)} bytes); schema ${manifest.length}`);
