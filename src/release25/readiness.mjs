// Operational readiness, not a substitute for measured Cloudflare CPU/D1 acceptance.
const yes=v=>v===true||v==='true';
export async function releaseHealth25(env,{base,tarot,registry,validateArt,expectedJSON,expectedCount,forecastActive}){
 const state={...base,release_scope:'ASTRA25_CLEAN_RELEASE'},blockers=[];
 const require=(ok,code)=>{if(!ok)blockers.push(code);};
 let schema=false,checked=false;
 try{
  // Compare exact DDL inside D1; do not send all~700KB of schema back to Workers.
  // One bound JSON parameter, a small SQL statement, two integer results.
  const r=await env.DB.prepare(`WITH expected AS MATERIALIZED(SELECT json_extract(value,'$.name') AS name,json_extract(value,'$.type') AS type,trim(json_extract(value,'$.sql')) AS definition FROM json_each(?)),actual AS MATERIALIZED(SELECT name,type,trim(sql) AS definition FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name<>'_cf_KV') SELECT (SELECT count(*) FROM actual) AS actual_count,(SELECT count(*) FROM expected e JOIN actual a ON a.name=e.name AND a.type=e.type AND a.definition=e.definition) AS matching_count`).bind(expectedJSON).first();
  schema=r?.actual_count===expectedCount&&r.matching_count===expectedCount;checked=true;
 }catch{}
 state.full_schema_ready=schema;state.full_schema_status=checked?(schema?'verified':'mismatch'):'unavailable';
 require(schema,checked?'FINAL_SCHEMA_MISMATCH':'FINAL_SCHEMA_CHECK_UNAVAILABLE');
 require(base.db_query==='OK','D1_UNAVAILABLE');
 require(base.secrets_ready,'BOT_SECRETS_MISSING');
 require(base.policy_ready,'POLICY_NOT_READY');
 require(base.bonus_fence_ready,base.bonus_fence_blocker||'BONUS_FENCE_NOT_READY');
 require(base.manual_content_ready,'MANUAL_CONTENT_NOT_READY');
 require(forecastActive===true,'FORECAST_NOT_ACTIVE');
 require(base.consent_schema_ready,'CONSENT_SCHEMA_NOT_READY');
 state.tarot25_schema_ready=tarot.ready===true;
 state.tarot25_sales_enabled=Boolean(tarot.ready&&tarot.enabled===1&&tarot.write_enabled===1&&tarot.independent_enabled===1&&yes(env.ASTRA_TAROT25_ENABLED)&&yes(env.ASTRA_TAROT25_STORAGE_TEST_MODE)&&yes(env.ASTRA_TAROT25_INDEPENDENT_TEST_MODE));
 require(state.tarot25_schema_ready,'TAROT_SCHEMA_NOT_READY');
 require(state.tarot25_sales_enabled,'TAROT_SALES_DISABLED');
 let art=false;
 try{validateArt(registry);art=registry.bot_id===Number(String(env.ASTRA_BOT_TOKEN||'').split(':')[0])&&registry.realm===(yes(env.ASTRA_TELEGRAM_TEST_MODE)?'test':'production');}catch{}
 state.art_registry_ready=art;state.art_enabled=yes(env.ASTRA_TAROT_ART_ENABLED);
 require(art,'ART_BOT_OR_REGISTRY_MISMATCH');require(state.art_enabled,'ART_DISABLED');
 // No new Stars, public question capture or automatic deliveries in this release.
 require(!yes(env.STARS_SHOP_ENABLED),'STARS_MUST_REMAIN_OFF');
 require(!yes(env.ASTRA_DAILY_DELIVERY_ENABLED),'BROADCAST_MUST_REMAIN_OFF');
 require(!yes(env.ASTRA_TAROT25_QUESTIONS_TEST_MODE)&&tarot.questions_enabled===0,'QUESTIONS_MUST_REMAIN_OFF');
 require(base.broadcast_delivery_allowed===false,'BROADCAST_NOT_QUARANTINED');
 state.blockers=[...new Set(blockers)];state.ready=state.blockers.length===0;
 state.public_ready=state.ready;state.readiness_scope='operational_checks_only';
 state.platform_metrics='NOT_ATTESTED_BY_HEALTH';
 return Response.json(state,{status:state.ready?200:503,headers:{'Cache-Control':'no-store'}});
}
