import expected from '../../data/astra251-schema.json' with {type:'json'};
export const CHECK251=Symbol.for('astra251.schema-check');
export const STORAGE251=Symbol.for('astra251.storage-admission');
export const CONTEXT251=Symbol('astra251.invocation');
export const AUTH251=Symbol('astra251.authenticated-webhook');
const expectedJSON=JSON.stringify(expected);
export const DDL_QUERY251=`/* ASTRA251_SCHEMA */ WITH expected AS MATERIALIZED(SELECT json_extract(value,'$.name') name,json_extract(value,'$.type') type,trim(json_extract(value,'$.sql')) definition FROM json_each(?)),actual AS MATERIALIZED(SELECT name,type,trim(sql) definition FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name<>'_cf_KV') SELECT(SELECT count(*) FROM actual)actual_count,(SELECT count(*) FROM expected e JOIN actual a ON a.name=e.name AND a.type=e.type AND a.definition=e.definition)matching_count,(SELECT version FROM astra_storage251 WHERE singleton=1)storage_version,(SELECT used_bytes FROM astra_storage251 WHERE singleton=1)used_bytes,(SELECT overhead_bytes FROM astra_storage251 WHERE singleton=1)overhead_bytes,(SELECT version FROM astra_owner251 WHERE singleton=1)owner_version`;
function capture(env,r){const row=r.results?.[0],size=r.meta?.size_after;if(Number.isSafeInteger(size)&&size>0&&Number.isSafeInteger(row?.used_bytes)&&row.used_bytes>=0&&Number.isSafeInteger(row.overhead_bytes)&&row.overhead_bytes>=0)env[CONTEXT251].meter={size,logical:row.used_bytes,overhead:row.overhead_bytes,at:Date.now()};}
export async function schema251(env){
 const c=env[CONTEXT251];if(c?.schema)return c.schema;
 const read=async()=>{try{const r=await env.DB.prepare(DDL_QUERY251).bind(expectedJSON).all();if(c)capture(env,r);const s=r.results?.[0];return Boolean(s?.actual_count===expected.length&&s.matching_count===expected.length&&s.storage_version==='storage251-v1'&&s.owner_version==='owner251-v1');}catch{return false;}};
 const promise=read();if(c)c.schema=promise;return promise;
}
export async function meter251(env){
 const c=env[CONTEXT251];if(!c)throw Object.assign(Error('DRAFT_STORAGE_CONTEXT_MISSING'),{code:'DRAFT_STORAGE_CONTEXT_MISSING'});
 if(!c.meter||Date.now()-c.meter.at>1000){c.meter=null;const r=await env.DB.prepare('SELECT used_bytes,overhead_bytes FROM astra_storage251 WHERE singleton=1').all();capture(env,r);}
 if(!c.meter)throw Object.assign(Error('DRAFT_STORAGE_META_MISSING'),{code:'DRAFT_STORAGE_META_MISSING'});
 return c.meter;
}
export async function admit251(env,reserve,cap){
 if(!Number.isSafeInteger(reserve)||reserve<0||!Number.isSafeInteger(cap)||cap<65536)throw Object.assign(Error('DRAFT_STORAGE_POLICY_INVALID'),{code:'DRAFT_STORAGE_POLICY_INVALID'});
 const m=await meter251(env);if(Math.max(m.size,m.logical+m.overhead)+reserve>cap)throw Object.assign(Error('DRAFT_STORAGE_SOFT_CAP'),{code:'DRAFT_STORAGE_SOFT_CAP'});
 // High-water physical overhead prevents concurrent payload writes spending the
 // same observed headroom. DELETE never pretends that physical space was reclaimed.
 const result=await env.DB.prepare('UPDATE astra_storage251 SET overhead_bytes=max(overhead_bytes,?),measured_at=unixepoch()WHERE singleton=1').bind(Math.max(0,m.size-m.logical)).run();
 if(result.meta?.changes!==1)throw Object.assign(Error('DRAFT_STORAGE_COUNTER_MISSING'),{code:'DRAFT_STORAGE_COUNTER_MISSING'});
}
export function scope251(env){const s={...env,[CONTEXT251]:{schema:null,meter:null}};s[CHECK251]=()=>schema251(s);s[STORAGE251]=(reserve,cap)=>admit251(s,reserve,cap);return s;}
export const authenticated251=env=>({...env,[AUTH251]:true});
