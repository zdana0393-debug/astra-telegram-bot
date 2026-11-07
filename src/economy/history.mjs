import {forecastChunks} from '../forecast/service.mjs';
export const HISTORY_PAGE_SIZE=12;
const HISTORY_LABELS={opening:'Исторический снимок баланса',registration:'Начальный баланс при регистрации',daily:'Бонус дня',referral:'Реферальное начисление',channel:'Подтверждённая подписка на канал',tarot:'Расклад на три карты','easter:gpt6':'Секретный архив','forecast:extended':'Расширенный прогноз'};
export function encodeHistoryCursor(direction,snapshot,anchor){
  if(!['o','n'].includes(direction)||![snapshot,anchor].every(n=>Number.isSafeInteger(n)&&n>0)||anchor>snapshot)throw Error('Invalid history cursor');
  return `${direction}:${snapshot.toString(36)}:${anchor.toString(36)}`;
}
export function decodeHistoryCursor(value){
  if(typeof value!=='string')return null;
  const m=/^([on]):([1-9a-z][0-9a-z]{0,10}):([1-9a-z][0-9a-z]{0,10})$/.exec(value);
  if(!m)return null;
  const snapshot=parseInt(m[2],36),anchor=parseInt(m[3],36);
  if(![snapshot,anchor].every(n=>Number.isSafeInteger(n)&&n>0)||anchor>snapshot)return null;
  if(encodeHistoryCursor(m[1],snapshot,anchor)!==value)return null;
  return {direction:m[1],snapshot,anchor};
}
export async function readHistoryPage(env,owner,cursor=null){
  if(!Number.isSafeInteger(owner)||owner<=0)throw Error('Invalid owner');
  let snapshot,boundary=null,direction='o';
  if(cursor!==null){
    const parsed=decodeHistoryCursor(cursor);if(!parsed)return {expired:true};
    ({snapshot,direction}=parsed);
    const marks=await env.DB.prepare(`SELECT rowid AS history_row,created_at,idempotency_key FROM astra_wallet_ledger
      WHERE telegram_id=? AND rowid IN (?,?)`).bind(owner,snapshot,parsed.anchor).all();
    if(!marks.results.some(r=>r.history_row===snapshot))return {expired:true};
    boundary=marks.results.find(r=>r.history_row===parsed.anchor);if(!boundary)return {expired:true};
  }else{
    snapshot=(await env.DB.prepare('SELECT rowid AS history_row FROM astra_wallet_ledger WHERE telegram_id=? ORDER BY rowid DESC LIMIT 1').bind(owner).first())?.history_row;
    if(!snapshot)return {rows:[],older:null,newer:null,snapshot:null};
  }
  const newer=direction==='n';
  const clause=boundary?` AND (created_at,idempotency_key) ${newer?'>':'<'} (?,?)`:'';
  const args=[owner,snapshot,...(boundary?[boundary.created_at,boundary.idempotency_key]:[])];
  const result=await env.DB.prepare(`SELECT rowid AS history_row,created_at,delta,reason FROM astra_wallet_ledger
    WHERE telegram_id=? AND rowid<=?${clause}
    ORDER BY created_at ${newer?'ASC':'DESC'},idempotency_key ${newer?'ASC':'DESC'} LIMIT 13`).bind(...args).all();
  let rows=result.results.slice(0,HISTORY_PAGE_SIZE);if(newer)rows.reverse();
  if(!rows.length)return cursor?{expired:true}:{rows:[],older:null,newer:null,snapshot};
  return {rows,snapshot,
    older:(!newer?result.results.length>HISTORY_PAGE_SIZE:Boolean(boundary))?encodeHistoryCursor('o',snapshot,rows.at(-1).history_row):null,
    newer:(newer?result.results.length>HISTORY_PAGE_SIZE:Boolean(boundary))?encodeHistoryCursor('n',snapshot,rows[0].history_row):null};
}
let ledgerTimeFormatter;
export function formatLedgerTime(value){
  // The existing ledger stores UTC CURRENT_TIMESTAMP. Never interpret it as host-local time.
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,3})?Z?$/.test(value))return 'Дата не распознана · UTC';
  const iso=value.replace(' ','T').replace(/Z$/,'')+'Z',date=new Date(iso);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value.slice(0,10))return 'Дата не распознана · UTC';
  return (ledgerTimeFormatter??=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})).format(date);
}
export function historyRecordText(row){
  if(!Number.isSafeInteger(row.delta))throw Error('Invalid ledger amount');
  return `${formatLedgerTime(row.created_at)}\n${HISTORY_LABELS[row.reason]||'Прочая операция с пылью'} · ${row.delta>0?'+':row.delta<0?'−':''}${Math.abs(row.delta)} ✨`;
}
export const economyChunks=text=>forecastChunks(text);
