import {workerData as w,parentPort} from 'node:worker_threads';import {DatabaseSync} from 'node:sqlite';import bot from '../release/ASTRA_2_4_WORKER.js';
const Real=Date;class Fixed extends Real{constructor(...a){super(...(a.length?a:['2026-11-10T06:00:00Z']));}static now(){return new Real('2026-11-10T06:00:00Z').getTime();}}globalThis.Date=Fixed;
const db=new DatabaseSync(w.file);db.exec('PRAGMA foreign_keys='+ (w.fk||'ON'));db.exec('PRAGMA busy_timeout=30000');
const DB={async batch(ss){db.exec('BEGIN IMMEDIATE');try{const r=ss.map(s=>s._runSync());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},prepare(sql){const st=db.prepare(sql);let a=[];return{bind(...v){a=v;return this;},async first(){return st.get(...a)??null;},async all(){return{results:st.all(...a)};},async run(){return this._runSync();},_runSync(){return{meta:{changes:Number(st.run(...a).changes)}};}};}};
const env={DB,ASTRA_BOT_TOKEN:'FAKE',ASTRA_ADMIN_KEY:'FAKE_ADMIN',ASTRA_WEBHOOK_SECRET:'FAKE_HEADER',ASTRA_FORECAST_START_DAY:'2026-01-01',ASTRA_DAILY_DELIVERY_ENABLED:'true'};
globalThis.fetch=async(url,opts)=>{if(!String(url).startsWith('https://api.telegram.org/botFAKE/'))throw Error('Unexpected network');const body=JSON.parse(opts.body),method=String(url).split('/').at(-1);if(method==='sendMessage'){
 const isForecast=Boolean(db.prepare('SELECT 1 FROM astra_forecast_daily WHERE free_text=?').get(body.text));
 db.prepare('INSERT INTO local_sends28(telegram_id,forecast) VALUES(?,?)').run(body.chat_id,isForecast?1:0);
 if(isForecast&&w.error==='network')throw Error('Synthetic accepted unknown');
 if(isForecast&&w.error===403)return Response.json({ok:false,error_code:403},{status:403});
 if(isForecast&&w.error===429)return Response.json({ok:false,error_code:429,parameters:{retry_after:1}},{status:429});
 }return Response.json({ok:true,result:{message_id:9000,chat:{id:body.chat_id,type:'private'}}});};
try{if(w.mode==='cron')await bot.scheduled({scheduledTime:Date.now()},env);else{const id=w.id||1,uid=w.uid;let update;if(w.mode==='grant')update={update_id:uid,callback_query:{id:'r'+uid,from:{id},message:{message_id:w.mid,chat:{id,type:'private'}},data:w.data}};else update={update_id:uid,message:{from:{id},chat:{id,type:'private'},text:w.mode==='delete'?'/delete':'/stop'}};const r=await bot.fetch(new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'FAKE_HEADER'},body:JSON.stringify(update)}),env);parentPort.postMessage({status:r.status});}}finally{db.close();globalThis.Date=Real;}
