// Historical reads only. Never converts legacy text into the RWS78 generator.
export function parseReadingKey(key){if(typeof key!=='string')return null;if(/^[a-f0-9]{32}$/.test(key))return{kind:'new',id:key};const m=/^(new|legacy3|legacy5):([A-Za-z0-9:_-]{1,128})$/.exec(key);return m?{kind:m[1],id:m[2]}:null;}
export const allHistory29=`WITH all_paid AS (
 SELECT 'new:'||p.offer_id AS history_key,p.offer_id,p.telegram_id,p.generation,p.price,p.price_version,p.spread_id,p.theme,p.size,p.delivery,p.created_at FROM astra_tarot25_purchases29 p
 UNION ALL SELECT 'legacy5:'||p.offer_id,p.offer_id,p.telegram_id,o.generation,5,'legacy-5','legacy-22-card-3','general',3,p.delivery,unixepoch(p.created_at) FROM astra_tarot_purchases26 p JOIN astra_tarot_offers26 o USING(offer_id)
 UNION ALL SELECT 'legacy3:'||o.operation_id,o.operation_id,o.telegram_id,g.generation,3,'legacy-3','legacy-22-card-3','general',3,o.delivery,unixepoch(o.created_at) FROM astra_operations o JOIN astra_user_policy g USING(telegram_id) WHERE o.reason='tarot' AND o.delta=-3
)`;
export async function loadLegacy29(env,actor,key){
 const p=parseReadingKey(key);if(!p||p.kind==='new')return null;
 const source=p.kind==='legacy3'?`SELECT 'legacy3:'||o.operation_id AS history_key,o.result,3 AS price,o.delivery,o.created_at FROM astra_operations o JOIN astra_users u USING(telegram_id) JOIN astra_user_policy g USING(telegram_id) WHERE o.operation_id=? AND o.telegram_id=? AND g.generation=? AND o.reason='tarot' AND o.delta=-3`:
 `SELECT 'legacy5:'||o.offer_id AS history_key,o.result,5 AS price,o.delivery,o.created_at FROM astra_tarot_purchases26 o JOIN astra_users u USING(telegram_id) JOIN astra_user_policy g USING(telegram_id) JOIN astra_tarot_offers26 f ON f.offer_id=o.offer_id AND f.generation=g.generation WHERE o.offer_id=? AND o.telegram_id=? AND g.generation=?`;
 const row=await env.DB.prepare(source).bind(p.id,actor.telegram_id,actor.generation).first();return row?{...row,kind:p.kind}:null;
}
