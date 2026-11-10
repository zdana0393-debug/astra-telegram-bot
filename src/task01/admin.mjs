async function paymentsAdmin(request,env){
 const url=new URL(request.url);if(url.pathname!=='/internal/economy/policy'&&url.pathname!=='/internal/economy/fence')return pre26_paymentsAdmin(request,env);
 if(request.method!=='POST'||!env.ASTRA_ADMIN_KEY||request.headers.get('Authorization')!=='Bearer '+env.ASTRA_ADMIN_KEY)return new Response('Forbidden',{status:403});
 const b=await request.json();
 if(url.pathname==='/internal/economy/fence'){
  if(b.action==='configure_key')return Response.json(await configureFence26(env));
  if(b.action==='approve_notice')return Response.json(await approveFenceNotice26(env,b.version,b.acknowledgement));
  if(b.action==='purge')return Response.json(await purgeFences26(env));
  if(b.action==='bootstrap'){
   const ctx=await fenceContext26(env);if(!ctx.ok)throw Error('Fence configuration unavailable');
   const row=await env.DB.prepare('SELECT telegram_id FROM astra_bonus_profiles26 WHERE seeded=0 ORDER BY telegram_id LIMIT 1').first();if(row)await syncBonusOwner26(env,row.telegram_id,ctx);
   return Response.json({processed_profile:Boolean(row),remaining:(await env.DB.prepare('SELECT count(*) n FROM astra_bonus_profiles26 WHERE seeded=0').first()).n});
  }
  if(b.action==='status'){const ctx=await fenceContext26(env);return Response.json({keys_ready:ctx.keys_ready,notice_ready:Boolean(ctx.notice_ready),blocker:ctx.blocker,bootstrap_pending:(await env.DB.prepare('SELECT count(*) n FROM astra_bonus_profiles26 WHERE seeded=0').first()).n},{headers:{'Cache-Control':'no-store'}});}
 }
 if(b.action==='arm'){const p=await armPolicy(env,b.start_day);return Response.json({start_day:p.start_day,enabled:Boolean(p.enabled)});}
 if(b.action==='stop'||b.action==='resume'){
  if(b.action==='resume'){if(!(await fenceContext26(env)).ok||!true26(env.ASTRA_ECONOMY_V2_ENABLED)||!(await readPolicy(env)).start_day)throw Error('Approved key,notice,date and runtime flag required');}
  await env.DB.prepare('UPDATE astra_patch26 SET enabled=? WHERE singleton=1').bind(b.action==='resume'?1:0).run();invalidate26(env);return Response.json({ok:true});
 }return new Response('Not found',{status:404});
}
