// Synthetic profiles/identities/media only. Every outbound request is intercepted.
import fs from'node:fs';import path from'node:path';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
import{DatabaseSync,constants}from'node:sqlite';
import{build251,apply251,publicParent251,PARENT_SHA251}from'../../scripts/build-astra251.mjs';
import{cleanInstall25}from'../../scripts/build-astra25-clean.mjs';
import{fakeBot25}from'../../scripts/lib/astra25-synthetic.mjs';
import{configureFence26,approveFenceNotice26}from'../../src/task01/bonus.mjs';
export{openTarot25,pick25,press25,screen25,sent25}from'../task04/upgrade-helpers.mjs';
const dir=fs.mkdtempSync('/tmp/astra251-tests-'),file=path.join(dir,'worker.mjs');
export const delta=await build251(),parent=publicParent251(),code=apply251(parent,delta),workerSHA=createHash('sha256').update(code).digest('hex');
fs.writeFileSync(file,code,{mode:0o600});const bundle=process.env.ASTRA251_OFFLINE_BUNDLE;if(bundle&&!bundle.startsWith('/tmp/astra251-offline-'))throw Error('EXPLICIT_SYNTHETIC_OFFLINE_BUNDLE_REQUIRED');const{default:bot}=await import(pathToFileURL(bundle||file));export{bot};
process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));
export async function setup251({enrolled=false,denyPragma=true}={}){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(cleanInstall25().sql);db.exec(fs.readFileSync('migrations/0032_astra251.sql','utf8'));
 const fake=fakeBot25(db,{bot}),raw=fake.env.DB;let size=2000000,missingMeta=false;const trace=[];
 function statement(sql,args=[]){const st=raw.prepare(sql);if(args.length)st.bind(...args);const run=async(method,...a)=>{trace.push(sql);try{return await st[method](...a);}catch(e){trace.push({error:e.message,sql});throw e;}};return{bind(...values){return statement(sql,values);},first:(...a)=>run('first',...a),run:(...a)=>run('run',...a),_sync:()=>{trace.push(sql);return st._sync();},async all(){const r=await run('all');return{...r,...(missingMeta?{}:{meta:{size_after:size}})};}};}
 fake.env.DB={prepare:sql=>statement(sql),batch:statements=>raw.batch(statements)};
 Object.assign(fake.env,{ASTRA_BOT_TOKEN:'901:OFFLINE_NOT_REAL',ASTRA_TELEGRAM_TEST_MODE:'true',ASTRA_TAROT_ART_ENABLED:'true',ASTRA_FORECAST_COMPACT_START_DAY:'2026-01-01',ASTRA_BONUS_FENCE_KEY:'ASTRA251_SYNTHETIC_KEY_NOT_REAL_0123456789',ASTRA_BONUS_FENCE_NOTICE_ACK:'APPROVED_BONUS_FENCE_30_DAYS',ASTRA_TAROT25_ENABLED:'true',ASTRA_TAROT25_STORAGE_TEST_MODE:'true',ASTRA_TAROT25_INDEPENDENT_TEST_MODE:'true',ASTRA_ADMIN_BUILD_SHA256:workerSHA});
 const prior=globalThis.fetch;let fault=null,mid=50000,transactions=[];
 globalThis.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.telegram.org/bot901:OFFLINE_NOT_REAL/'))throw Error('REAL_NETWORK_FORBIDDEN');const method=String(url).split('/').at(-1),body=JSON.parse(options.body);
  if(fault?.method===method){fake.calls.push({method,body});if(fault.code==='network')throw Error('SYNTHETIC_NETWORK');return Response.json({ok:false,error_code:fault.code,parameters:{retry_after:1}},{status:fault.code});}
  if(['sendPhoto','sendMediaGroup','sendInvoice','answerPreCheckoutQuery','refundStarPayment','getStarTransactions','getMe'].includes(method)){
   fake.calls.push({method,body});let result;
   if(method==='getMe')result={id:901,is_bot:true,username:'SYNTHETIC_ASTRA_BOT'};
   else if(method==='getStarTransactions')result={transactions};
   else if(['answerPreCheckoutQuery','refundStarPayment'].includes(method))result=true;
   else if(method==='sendInvoice')result={message_id:++mid,chat:{id:body.chat_id,type:'private'}};
   else{const messages=Array.from({length:method==='sendPhoto'?1:body.media.length},()=>({message_id:++mid,chat:{id:body.chat_id,type:'private'},photo:[{file_id:'SYNTHETIC_ACK_PHOTO'}]}));result=method==='sendPhoto'?messages[0]:messages;}
   return Response.json({ok:true,result});
  }
  return prior(String(url).replace('bot901:OFFLINE_NOT_REAL/test/','botTASK04_SYNTHETIC_ONLY/').replace('bot901:OFFLINE_NOT_REAL/','botTASK04_SYNTHETIC_ONLY/'),options);
 };
 await configureFence26(fake.env);await approveFenceNotice26(fake.env,'bonus-fence-30d-v1','APPROVED_BONUS_FENCE_30_DAYS');
 db.exec('UPDATE astra_tarot25_runtime29 SET enabled=1;UPDATE astra_tarot30_policy SET write_enabled=1;UPDATE astra_tarot31_policy SET enabled=1');
 let denied=0;if(denyPragma)db.setAuthorizer((action,name)=>{if(action===constants.SQLITE_PRAGMA&&['page_count','page_size'].includes(name)){denied++;return constants.SQLITE_DENY;}return constants.SQLITE_OK;});
 let messageId=2000;const message=(id,text,uid)=>{const u=fake.message(id,text,uid);Object.assign(u.message,{message_id:++messageId,date:Math.floor(Date.now()/1000)});return u;};
 for(const id of[12,13]){await fake.hook(message(id,'/start'));await fake.hook(fake.click(id,'sign:aries'));}
 const token=Buffer.alloc(32,7).toString('base64url');
 if(token.length!==43)throw Error('FIXTURE_CHALLENGE_LENGTH');
 const hash=createHash('sha256').update(token).digest('hex');
 db.prepare("UPDATE astra_owner251 SET state='pending',bot_id=901,build_sha256=?,parent_sha256=?,challenge_hash=?,expires_at=unixepoch()+900 WHERE singleton=1").run(workerSHA,PARENT_SHA251,hash);
 const c={db,fake,token,message,trace,denied:()=>denied,setSize:n=>size=n,setMissingMeta:v=>missingMeta=v,setFault:(method,code)=>fault=method?{method,code}:null,setTransactions:v=>transactions=v,
  async health(){const r=await bot.fetch(new Request('https://synthetic.invalid/health'),fake.env);return{status:r.status,state:await r.json()};},
  async enroll(id=12){const u=message(id,'/owner_claim '+token);await fake.hook(u);const row=db.prepare('SELECT * FROM astra_owner251').get();if(row.owner_id!==id)throw Error('FIXTURE_ENROLL_FAILED');fake.env.ASTRA_OWNER_TELEGRAM_ID=String(id);return u;},
  close(){fake.close();db.close();}};
 if(enrolled)await c.enroll();return c;
}
export const wallet=c=>c.db.prepare('SELECT telegram_id,balance FROM astra_users ORDER BY telegram_id').all();
export const grantRows=c=>c.db.prepare('SELECT count(*) AS n FROM astra_admin_grants25').get().n;
export const quote251=async(c,theme='Общий вопрос',format='Три карты')=>{const{openTarot25,pick25,press25}=await import('../task04/upgrade-helpers.mjs');await openTarot25(c.fake,12);await press25(c.fake,pick25(c.fake,'Новый вопрос'),12);await press25(c.fake,pick25(c.fake,theme),12);await press25(c.fake,pick25(c.fake,format),12);return pick25(c.fake,'Подтвердить');};
