import {validDay} from '../forecast/engine.mjs';
const ACTIVITY_SIGNS=new Set(['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']);
let activityDateFormatter;
export function activityDay(now=new Date()){
  return (activityDateFormatter??=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'})).format(now);
}
export function previousActivityDay(day){
  if(!validDay(day))throw Error('Invalid activity day');
  const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);
}
export async function recordActivity(env,owner,day,source){
  if(!Number.isSafeInteger(owner)||owner<=0||!validDay(day)||!['message','callback'].includes(source))throw Error('Invalid activity');
  const row=await env.DB.prepare(`SELECT u.zodiac,a.day FROM astra_users u LEFT JOIN astra_activity_days a
    ON a.telegram_id=u.telegram_id AND a.day=? WHERE u.telegram_id=?`).bind(day,owner).first();
  if(!row||!ACTIVITY_SIGNS.has(row.zodiac))return false;
  if(!row.day)await env.DB.prepare('INSERT OR IGNORE INTO astra_activity_days(telegram_id,day,source) VALUES(?,?,?)').bind(owner,day,source).run();
  return true;
}
export async function readActivity(env,owner,today=activityDay()){
  if(!Number.isSafeInteger(owner)||owner<=0||!validDay(today))throw Error('Invalid activity query');
  const yesterday=previousActivityDay(today);
  const row=await env.DB.prepare(`WITH RECURSIVE
    latest(day) AS (SELECT max(day) FROM astra_activity_days WHERE telegram_id=? AND day<=?),
    chain(day) AS (
      SELECT day FROM latest WHERE day IN (?,?)
      UNION ALL SELECT a.day FROM astra_activity_days a JOIN chain c ON a.telegram_id=? AND a.day=date(c.day,'-1 day')
    )
    SELECT (SELECT count(*) FROM astra_activity_days WHERE telegram_id=? AND day<=?) AS total,
      (SELECT min(day) FROM astra_activity_days WHERE telegram_id=? AND day<=?) AS first_day,
      (SELECT day FROM latest) AS last_day,(SELECT count(*) FROM chain) AS streak`).bind(owner,today,today,yesterday,owner,owner,today,owner,today).first();
  return {total:row.total,streak:row.streak,first_day:row.first_day,last_day:row.last_day,today_recorded:row.last_day===today};
}
