import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import bot from '../release/ASTRA_2_1_WORKER.js';
export const schema=fs.readFileSync(new URL('../src/02_SCHEMA.sql',import.meta.url),'utf8');
export const migration=fs.readFileSync(new URL('../migrations/0021_wallet.sql',import.meta.url),'utf8');
export function fixture() {
  const db=new DatabaseSync(':memory:'); db.exec(schema); db.exec(migration);
  const DB={prepare(sql) {
    const st=db.prepare(sql); let args=[];
    return {bind(...a){args=a;return this;},async first(){await Promise.resolve();return st.get(...args)??null;},
      async all(){await Promise.resolve();return {results:st.all(...args)};},
      async run(){await Promise.resolve();return {meta:{changes:Number(st.run(...args).changes)}};}};
  }};
  const env={DB,ASTRA_BOT_TOKEN:'FAKE',ASTRA_WEBHOOK_SECRET:'FAKE_HEADER',ASTRA_ADMIN_KEY:'FAKE_ADMIN',CHANNEL_USERNAME:'@examplechannel'};
  let seq=1000; const out=[]; let fail=null;
  const old=globalThis.fetch;
  globalThis.fetch=async (url,opts)=>{
    if (!String(url).startsWith('https://api.telegram.org/botFAKE/')) throw Error('Unexpected network destination');
    const method=String(url).split('/').at(-1),body=JSON.parse(opts.body); out.push({method,body});
    await Promise.resolve();
    if (method==='sendMessage' && fail) {
      if (fail==='network') throw Error('Simulated network failure');
      if (fail==='malformed') return new Response('broken');
      return Response.json({ok:false,error_code:fail,description:'Fake rejection'},{status:fail});
    }
    return Response.json({ok:true,result:method==='getChatMember'?{status:'member'}:true});
  };
  const user=(id,balance=20)=>db.prepare("INSERT INTO astra_users(telegram_id,zodiac,balance) VALUES(?,'aries',?)").run(id,balance);
  const hook=async update=>bot.fetch(new Request('https://astra.test/telegram-webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'FAKE_HEADER'},body:JSON.stringify(update)}),env);
  const message=(id,text,uid=++seq)=>({update_id:uid,message:{from:{id},chat:{id,type:'private'},text}});
  const click=(id,mid=1,uid=++seq,cid='q'+uid)=>({update_id:uid,callback_query:{id:cid,from:{id},message:{message_id:mid,chat:{id,type:'private'}},data:'tarot:three'}});
  const query=(sql,...args)=>db.prepare(sql).get(...args);
  const balance=id=>query('SELECT balance FROM astra_users WHERE telegram_id=?',id)?.balance;
  const reconcile=()=>query(`SELECT count(*) AS n FROM astra_users u WHERE balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger WHERE telegram_id=u.telegram_id)`).n;
  return {db,env,bot,out,user,hook,message,click,query,balance,reconcile,fail(v){fail=v;},close(){globalThis.fetch=old;db.close();}};
}
