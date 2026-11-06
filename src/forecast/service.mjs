import {validDay} from './engine.mjs';
import {generateForecast} from './configured.mjs';
export function activationReady(env){return validDay(env.ASTRA_FORECAST_START_DAY);}
export function engineActive(env,day){return activationReady(env)&&day>=env.ASTRA_FORECAST_START_DAY;}
export async function getForecastDaily(env,sign,day,generate=generateForecast) {
  if(!validDay(day))throw Error('Invalid forecast day');
  const read=()=>env.DB.prepare('SELECT * FROM astra_forecast_daily WHERE sign=? AND day=? AND locale=\'ru\'').bind(sign,day).first();
  const old=await read();if(old)return old;
  const f=generate(sign,day,'ru');
  if(!f.free_text?.trim()||!f.extended_text?.trim()||f.sign!==sign||f.day!==day||f.locale!=='ru')throw Error('Incomplete forecast payload');
  await env.DB.prepare(`INSERT INTO astra_forecast_daily(sign,day,locale,free_text,extended_text,number,engine_version,content_version,number_algorithm_version,source_tags)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sign,day,locale) DO NOTHING`)
    .bind(sign,day,'ru',f.free_text,f.extended_text,f.number,f.engine_version,f.content_version,f.number_algorithm_version,f.source_tags).run();
  const saved=await read();if(!saved)throw Error('Forecast cache unavailable');return saved;
}
export const getForecastUnlock=(env,id,day)=>env.DB.prepare('SELECT * FROM astra_forecast_unlocks WHERE telegram_id=? AND day=?').bind(id,day).first();
export async function purchaseForecast(env,id,sign,day,generate=generateForecast) {
  const old=await getForecastUnlock(env,id,day);if(old)return old;
  const daily=await getForecastDaily(env,sign,day,generate);
  await env.DB.prepare(`INSERT INTO astra_forecast_unlocks(telegram_id,day,sign,locale,price,result_text,engine_version,content_version,number_algorithm_version,source_tags)
    VALUES(?,?,?,'ru',4,?,?,?,?,?) ON CONFLICT(telegram_id,day) DO NOTHING`)
    .bind(id,day,daily.sign,daily.extended_text,daily.engine_version,daily.content_version,daily.number_algorithm_version,daily.source_tags).run();
  return getForecastUnlock(env,id,day);
}
export function forecastChunks(text,limit=3800) {
  if(typeof text!=='string'||!text.trim()||limit<2)throw Error('Empty forecast text');
  const chunks=[];let rest=text;
  while(rest.length>limit){
    let cut=rest.lastIndexOf('\n',limit);if(cut<limit/2)cut=limit;
    if(cut===limit&&/[\uD800-\uDBFF]/.test(rest[cut-1]))cut--;
    chunks.push(rest.slice(0,cut));rest=rest.slice(cut);
  }
  if(rest)chunks.push(rest);return chunks;
}
