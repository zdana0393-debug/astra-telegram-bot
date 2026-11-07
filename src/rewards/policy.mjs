import {validDay} from '../forecast/engine.mjs';
import {activityDay,recordActivity} from '../economy/activity.mjs';
export const POLICY_VERSION='policy-v2';
export const POLICY_TRUE=value=>value===true||value==='true';
export async function readPolicy(env){return env.DB.prepare('SELECT * FROM astra_policy WHERE singleton=1').first();}
export async function policyClock(env,day=activityDay()){
  if(!validDay(day))throw Error('Invalid policy day');
  let p=await readPolicy(env);if(!p)throw Error('Policy missing');
  if(env.ASTRA_ECONOMY_V2_START_DAY&&env.ASTRA_ECONOMY_V2_START_DAY!==p.start_day)throw Error('Policy date mismatch');
  if(p.enabled&&p.start_day&&day>=p.start_day&&!POLICY_TRUE(env.ASTRA_ECONOMY_V2_ENABLED))throw Error('Policy runtime stop: disable D1 awards or restore the approved flag');
  if(!p.activated&&p.start_day&&day>=p.start_day){
    await env.DB.prepare('UPDATE astra_policy SET activated=1 WHERE singleton=1 AND activated=0 AND start_day<=?').bind(day).run();p=await readPolicy(env);
  }return p;
}
export async function armPolicy(env,startDay,today=activityDay()){
  if(!validDay(startDay)||startDay<=today)throw Error('Choose a future Moscow day');
  const p=await readPolicy(env);if(p.start_day&&p.start_day!==startDay)throw Error('Policy cutover already fixed');
  await env.DB.prepare('UPDATE astra_policy SET start_day=?,enabled=1 WHERE singleton=1 AND activated=0').bind(startDay).run();return readPolicy(env);
}
export async function capturePolicyEvent(env,event,updateId,day,p,returnRow=true){
  if(!event||!Number.isSafeInteger(updateId)||!validDay(day))return null;
  const enabled=p.activated&&p.enabled&&POLICY_TRUE(env.ASTRA_ECONOMY_V2_ENABLED);
  const legacy=enabled?0:1;
  // A selected profile or a genuine first-sign click; never service traffic.
  await env.DB.prepare(`INSERT INTO astra_policy_events(update_id,telegram_id,day,source,legacy,processed)
    SELECT ?,u.telegram_id,?,?,?,? FROM astra_users u WHERE u.telegram_id=? AND (u.zodiac IS NOT NULL OR ?=1) AND NOT EXISTS(SELECT 1 FROM astra_policy_days d WHERE d.telegram_id=u.telegram_id AND d.day=?)
    ON CONFLICT(update_id) DO NOTHING`).bind(updateId,day,event.source,legacy,legacy,event.id,event.signSelection?1:0,day).run();
  if(!returnRow)return;
  return env.DB.prepare('SELECT * FROM astra_policy_events WHERE update_id=? AND telegram_id=?').bind(updateId,event.id).first();
}
export async function settlePolicyEvents(env,owner){
  const p=await readPolicy(env);if(!p?.activated||!p.enabled||!POLICY_TRUE(env.ASTRA_ECONOMY_V2_ENABLED))return;
  await env.DB.prepare(`INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference) SELECT 'reward:'||generation||':initial:once',telegram_id,generation,'initial',registered_day,12,'once' FROM astra_user_policy WHERE telegram_id=? AND mode='v2' AND NOT EXISTS(SELECT 1 FROM astra_reward_claims WHERE telegram_id=? AND kind='initial') ON CONFLICT(claim_id) DO NOTHING`).bind(owner,owner).run();
  const rows=await env.DB.prepare(`SELECT e.* FROM astra_policy_events e JOIN astra_users u ON u.telegram_id=e.telegram_id
    WHERE e.telegram_id=? AND e.legacy=0 AND e.processed=0 AND u.zodiac IS NOT NULL AND e.update_id IN (SELECT min(update_id) FROM astra_policy_events WHERE telegram_id=? AND legacy=0 AND processed=0 GROUP BY day) ORDER BY e.day,e.update_id LIMIT 5`).bind(owner,owner).all();
  for(const e of rows.results){
    await recordActivity(env,owner,e.day,e.source);
    await env.DB.prepare(`INSERT INTO astra_policy_days(telegram_id,day,streak,event_id)
      SELECT ?,?,coalesce((SELECT streak FROM astra_policy_days WHERE telegram_id=? AND day=date(?,'-1 day')),0)+1,?
      ON CONFLICT(telegram_id,day) DO NOTHING`).bind(owner,e.day,owner,e.day,e.update_id).run();
    const day=await env.DB.prepare('SELECT day FROM astra_policy_days WHERE telegram_id=? AND day=?').bind(owner,e.day).first();
    if(!day)throw Error('Policy visit was not committed');
    await env.DB.prepare('UPDATE astra_policy_events SET processed=1 WHERE day=? AND telegram_id=? AND legacy=0').bind(e.day,owner).run();
  }
  if(await env.DB.prepare('SELECT e.update_id FROM astra_policy_events e JOIN astra_users u ON u.telegram_id=e.telegram_id WHERE e.telegram_id=? AND e.legacy=0 AND e.processed=0 AND u.zodiac IS NOT NULL LIMIT 1').bind(owner).first())throw Error('Reward backlog: retry after the committed batch');
}
export async function policyClaim(env,owner,kind,day,amount,reference='once'){
  await env.DB.prepare(`INSERT INTO astra_reward_claims(claim_id,telegram_id,generation,kind,day,amount,reference)
    SELECT 'reward:'||generation||':'||?||':'||?,telegram_id,generation,?,?,?,? FROM astra_user_policy WHERE telegram_id=?
    ON CONFLICT(claim_id) DO NOTHING`).bind(kind,reference,kind,day,amount,reference,owner).run();
}
export async function policySummary(env,owner,today=activityDay()){
  const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  const row=await env.DB.prepare(`SELECT (SELECT count(*) FROM astra_policy_days WHERE telegram_id=?) AS total,
    coalesce((SELECT streak FROM astra_policy_days WHERE telegram_id=? AND day IN (?,?) ORDER BY day DESC LIMIT 1),0) AS streak,
    coalesce((SELECT debt FROM astra_refund_accounts WHERE payer_id=?),0) AS debt,
    (SELECT group_concat(kind) FROM astra_reward_claims WHERE telegram_id=? AND kind IN ('first3','thirty')) AS milestones`).bind(owner,owner,today,yesterday,owner,owner).first();
  return row;
}
