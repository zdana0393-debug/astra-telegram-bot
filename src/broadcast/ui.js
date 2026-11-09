// Existing navigation and confirmation/read paths; no forecast text or price rewrite.
async function sendForecastText(env,id,text,rows=[]){
 const chunks=forecastChunks(text);for(let i=0;i<chunks.length;i++){
  if(i===chunks.length-1)await send(shellEnv(env,'forecast'),id,chunks[i],{reply_markup:{inline_keyboard:rows}});
  else await tg(env,'sendMessage',{chat_id:id,text:chunks[i]});
 }
}
async function sendFreeForecast(env,id,sign,day=dayMSK()){
 if(!engineActive(env,day))return send(shellEnv(env,'forecast'),id,legacyForecast(sign,day));
 const f=await getForecastDaily(env,sign,day),owned=await getForecastUnlock(env,id,day);
 return sendForecastText(env,id,f.free_text,forecastCta03(day,Boolean(owned)));
}
async function broadcast(env){
 if(!engineActive(env,dayMSK())){console.log(JSON.stringify({event:'astra_broadcast03',reason:'forecast_not_active'}));return;}
 try{compactStartDay(env);}catch{console.log(JSON.stringify({event:'astra_broadcast03',reason:'forecast_config_invalid'}));return;}
 return runBroadcast03(env);
}
async function health(env){
 const response=await pre03_health(env),state=await response.json(),schema=await broadcastSchema03(env);let config=true;try{compactStartDay(env);}catch{config=false;}
 state.broadcast_schema_ready=broadcastSchemaReady03(schema);state.broadcast_ready=state.broadcast_schema_ready&&Boolean(env.ASTRA_BOT_TOKEN)&&engineActive(env,dayMSK())&&config;
 state.broadcast_blocker=!state.broadcast_schema_ready?'broadcast_schema_unavailable':!env.ASTRA_BOT_TOKEN?'token_missing':!config?'forecast_config_invalid':!engineActive(env,dayMSK())?'forecast_not_active':null;
 state.broadcast_window_utc='06:00–07:59';state.broadcast_window_open=morning03();state.broadcast_batch_limit=8;state.broadcast_cooldown_until=schema?.cooldown_until||0;
 state.ready=state.ready&&state.broadcast_ready;return Response.json(state,{status:state.ready?200:503,headers:{'Cache-Control':'no-store'}});
}
