// Opt-in, invocation-local counters. No IDs, SQL, arguments, tokens or response bodies.
export async function measureInvocation(env,kind,work){
  if(env.ASTRA_D1_DIAGNOSTICS!==true&&env.ASTRA_D1_DIAGNOSTICS!=='true')return work(env);
  const start=performance.now(),raw=new WeakMap(),stats={event:'astra_d1_invocation',kind,d1_calls:0,statements:0,batches:0,failed_calls:0,meta_results:0,results_without_meta:0,rows_read_observed:0,rows_written_observed:0,db_size_after_max:null};
  const resultMeta=result=>{if(Number.isFinite(result?.meta?.size_after))stats.db_size_after_max=Math.max(stats.db_size_after_max||0,result.meta.size_after);if(result?.meta&&Number.isFinite(result.meta.rows_read)&&Number.isFinite(result.meta.rows_written)){stats.meta_results++;stats.rows_read_observed+=result.meta.rows_read;stats.rows_written_observed+=result.meta.rows_written;}else stats.results_without_meta++;};
  const statement=s=>{const wrapped={bind(...args){return statement(s.bind(...args));}};raw.set(wrapped,s);for(const method of ['first','all','run','raw'])if(typeof s[method]==='function')wrapped[method]=async(...args)=>{stats.d1_calls++;stats.statements++;try{const r=await s[method](...args);resultMeta(r);return r;}catch(e){stats.failed_calls++;throw e;}};return wrapped;};
  const db=env.DB?{prepare(sql){return statement(env.DB.prepare(sql));},async batch(statements){stats.d1_calls++;stats.batches++;stats.statements+=statements.length;try{const r=await env.DB.batch(statements.map(s=>raw.get(s)||s));for(const v of r)resultMeta(v);return r;}catch(e){stats.failed_calls++;throw e;}}}:env.DB;
  try{return await work({...env,DB:db});}finally{console.log(JSON.stringify({...stats,wall_ms:+(performance.now()-start).toFixed(3),rows_complete:stats.results_without_meta===0}));}
}
