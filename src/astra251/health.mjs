import {schema251,meter251} from './schema.mjs';
import {ownerStatus251} from './owner.mjs';
const yes=v=>v===true||v==='true';
export async function commerceStatus251(env){
 try{const p=await env.DB.prepare('SELECT stars_enabled,payment_scope,support,terms_version,retention_days,verified_bot_id FROM astra_policy WHERE singleton=1').first();
  const scope=yes(env.ASTRA_TELEGRAM_TEST_MODE)?'test':'production',worker=yes(env.STARS_SHOP_ENABLED),db=p?.stars_enabled===1;
  const configured=Boolean(p&&p.payment_scope===scope&&p.support==='https://t.me/BAL1k_67'&&p.terms_version==='astra-stars-2026-11-v1'&&p.retention_days===365&&p.verified_bot_id===Number(String(env.ASTRA_BOT_TOKEN||'').split(':')[0]));
  const approved=env.ASTRA_PAYMENT_POLICY_ACCEPTED==='APPROVED_SUPPORT_TERMS_RETENTION'&&(scope==='test'?env.ASTRA_PAYMENT_ENVIRONMENT_ACK==='DEDICATED_TELEGRAM_TEST_ENVIRONMENT_CONFIRMED':env.ASTRA_STARS_LIVE_APPROVED==='YES_I_AUTHORIZE_REAL_STARS');
  return{configured,worker_enabled:worker,database_enabled:db,live_ready:Boolean(worker&&db&&configured&&approved),safe:Boolean(worker===db&&(!worker||configured&&approved))};
 }catch{return{configured:false,worker_enabled:yes(env.STARS_SHOP_ENABLED),database_enabled:false,live_ready:false,safe:!yes(env.STARS_SHOP_ENABLED)};}
}
export async function health251(env,{base,tarot,registry,validateArt,forecastActive}){
 const state={...base,release_scope:'ASTRA_2_5_1'},blockers=[],require=(ok,code)=>{if(!ok)blockers.push(code);};
 state.full_schema_ready=await schema251(env);require(state.full_schema_ready,'FINAL_SCHEMA_MISMATCH');
 require(base.db_query==='OK','D1_UNAVAILABLE');require(base.secrets_ready,'BOT_SECRETS_MISSING');require(base.policy_ready,'POLICY_NOT_READY');require(base.bonus_fence_ready,base.bonus_fence_blocker||'BONUS_FENCE_NOT_READY');require(base.manual_content_ready,'MANUAL_CONTENT_NOT_READY');require(base.consent_schema_ready,'CONSENT_SCHEMA_NOT_READY');require(forecastActive,'FORECAST_NOT_ACTIVE');
 state.tarot25_schema_ready=tarot.ready===true;state.tarot25_sales_enabled=Boolean(tarot.ready&&tarot.enabled===1&&tarot.write_enabled===1&&tarot.independent_enabled===1&&yes(env.ASTRA_TAROT25_ENABLED)&&yes(env.ASTRA_TAROT25_STORAGE_TEST_MODE)&&yes(env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE));require(state.tarot25_sales_enabled,'TAROT_SALES_DISABLED');
 try{validateArt(registry);state.art_registry_ready=registry.bot_id===Number(String(env.ASTRA_BOT_TOKEN||'').split(':')[0])&&registry.realm===(yes(env.ASTRA_TELEGRAM_TEST_MODE)?'test':'production');}catch{state.art_registry_ready=false;}
 state.art_enabled=yes(env.ASTRA_TAROT_ART_ENABLED);require(state.art_registry_ready,'ART_BOT_OR_REGISTRY_MISMATCH');require(state.art_enabled,'ART_DISABLED');
 try{const m=await meter251(env);state.storage_budget_ready=Math.max(m.size,m.logical+m.overhead)+65536<=tarot.soft_cap_bytes;}catch{state.storage_budget_ready=false;}require(state.storage_budget_ready,'DRAFT_STORAGE_META_OR_CAP_UNAVAILABLE');
 const owner=await ownerStatus251(env);state.admin_schema_ready=state.full_schema_ready;state.admin_ready=owner.ready;state.owner_enrollment_required=!owner.ready;
 if(owner.configured)require(owner.ready,'OWNER_BINDING_UNVERIFIED');
 const shop=await commerceStatus251(env);state.stars_configured=shop.configured;state.stars_ready=shop.live_ready;state.stars_shop_enabled=shop.worker_enabled&&shop.database_enabled;state.stars_configuration_ready=shop.safe;
 require(shop.safe,'STARS_GATES_OR_APPROVAL_MISMATCH');
 require(!yes(env.ASTRA_DAILY_DELIVERY_ENABLED)&&base.broadcast_delivery_allowed===false,'BROADCAST_MUST_REMAIN_OFF');require(!yes(env.ASTRA_TAROT25_QUESTIONS_TEST_MODE)&&tarot.questions_enabled===0,'QUESTIONS_MUST_REMAIN_OFF');
 state.blockers=[...new Set(blockers)];state.ready=state.blockers.length===0;state.public_ready=state.ready;state.readiness_scope='operational_checks_only';state.platform_metrics='NOT_ATTESTED_BY_HEALTH';
 return Response.json(state,{status:state.ready?200:503,headers:{'Cache-Control':'no-store'}});
}

export async function paymentsReady251(env){return await schema251(env)&&(await commerceStatus251(env)).live_ready;}
