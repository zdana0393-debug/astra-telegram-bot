// Invocation-local DDL memo only. Policy, prices, ownership and leases always reach D1.
const OPS25=Symbol('tarot25-invocation-operations');
export function scope25(env){
 const memo=new Map(),raw=new WeakMap(),DB=env.DB,ops={count:0};if(!DB)return {...env,[OPS25]:ops};
 function statement(st,sql){const wrapped={bind(...args){return statement(st.bind(...args),sql);}};raw.set(wrapped,st);
  for(const method of ['first','all','run','raw'])if(typeof st[method]==='function')wrapped[method]=(...args)=>{
   const cached=method==='all'&&sql.startsWith('SELECT name,type,sql FROM sqlite_master WHERE name IN(')&&sql.includes("'astra_tarot25_runtime29'");
   if(cached&&memo.has(sql))return memo.get(sql);ops.count++;const result=st[method](...args);if(cached)memo.set(sql,result);return result;
  };return wrapped;
 }
 return {...env,[OPS25]:ops,DB:{prepare(sql){return statement(DB.prepare(sql),sql);},batch(statements){ops.count+=statements.length;return DB.batch(statements.map(st=>raw.get(st)||st));}}};
}
export async function telegram25(env,method,body,signal,material=false){
 // Reserve completion SQL and a plain status reply before the 50-operation ceiling.
 const ops=env[OPS25];if(ops&&ops.count>=(material?42:45))throw Object.assign(Error('UI_OPERATION_BUDGET'),{code:'UI_OPERATION_BUDGET',no_ui_retry:true});if(ops)ops.count++;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3000);
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 try{
  if(signal?.aborted)controller.abort();
  const res=await fetch(`https://api.telegram.org/bot${env.ASTRA_BOT_TOKEN}/${env.ASTRA_TELEGRAM_TEST_MODE===true||env.ASTRA_TELEGRAM_TEST_MODE==='true'?'test/':''}${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
  const data=await res.json();if(!res.ok||data.ok!==true){const e=new Error('TELEGRAM_UNCONFIRMED');e.telegramCode=Number(data.error_code)||res.status;e.retryAfter=data.parameters?.retry_after;throw e;}
  if(method==='sendMessage'&&(!Number.isSafeInteger(data.result?.message_id)||data.result.message_id<=0))throw Error('TELEGRAM_UNCONFIRMED');
  return data.result;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
