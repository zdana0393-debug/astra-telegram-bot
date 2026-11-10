const deliveryPause28=(env,schema)=>schema.quarantined||!POLICY_TRUE(env.ASTRA_DAILY_DELIVERY_ENABLED)?'\n\nАвтоматическая доставка пока приостановлена до отдельной проверки владельцем.':'';
async function consentScreen28(env,id){
 const schema=await schemaConsent28(env);
 if(!schema.ready)return screen(env,id,'Утренний прогноз','Настройка подписки пока недоступна. Полный бесплатный прогноз можно открыть вручную.',[],'dossier');
 const active=await env.DB.prepare(`SELECT 1 FROM astra_notification_consent28 c JOIN astra_users u USING(telegram_id) JOIN astra_user_policy p USING(telegram_id) WHERE c.telegram_id=? AND c.generation=p.generation AND u.notifications_enabled=1 AND c.consent_version='daily-forecast-v1' AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL`).bind(id).first();
 if(active)return screen(env,id,'Утренний прогноз','Подписка подтверждена. Полный бесплатный прогноз с числом дня — один раз в сутки, обычно с 09:00 до 11:00 по Москве. Отключить можно здесь или командой /stop.'+deliveryPause28(env,schema),[[button('Отключить уведомления','consent28:stop')]],'dossier');
 const pending=await pendingConsent28(env,id);
 const message=await screen(env,id,'Утренний прогноз',CONSENT_TEXT28+deliveryPause28(env,schema),[[button('Подтвердить подписку','consent28:grant:'+pending.nonce),button('Отмена','consent28:cancel:'+pending.nonce)]],'dossier');
 if(!Number.isSafeInteger(message?.message_id)||message.message_id<=0)throw Error('Consent message not confirmed');
 await env.DB.prepare(`UPDATE astra_notification_consent28 SET pending_message_id=? WHERE telegram_id=? AND generation=? AND revision=? AND pending_hash=? AND pending_expires_at>unixepoch() AND pending_message_id IS NULL`).bind(message.message_id,id,pending.generation,pending.revision,pending.hash).run();
 return message;
}
async function shellPage(env,id,page,q=null,updateId=null){
 if(page==='notifications'||page.startsWith('notifications:')||page.startsWith('consent28:')){
  if(q&&(!Number.isSafeInteger(id)||id<=0||q.from?.is_bot||q.from?.id!==id||q.message?.chat?.id!==id||q.message?.chat?.type!=='private'))return;
  if(page==='notifications:disable'||page==='consent28:stop'){
   await revokeConsent28(env,id);return screen(env,id,'Утренний прогноз','Подписка отозвана. Новых утренних сообщений не будет; начатую отправку отозвать невозможно. Полный прогноз доступен вручную.',[[button('Настройка уведомлений','notifications')]],'dossier');
  }
  const match=/^consent28:(grant|cancel):([a-f0-9]{32})$/.exec(page);
  if(match){
   const schema=await schemaConsent28(env);if(!q||!schema.ready)return screen(env,id,'Утренний прогноз','Подтверждение недоступно. Откройте настройку заново.',[],'dossier');
   if(match[1]==='cancel'){
    const cancelled=await env.DB.prepare(`UPDATE astra_notification_consent28 SET ${clearPending28} WHERE telegram_id=? AND pending_hash=? AND pending_message_id=? RETURNING revision`).bind(id,await nonceHash28(match[2]),q.message.message_id).first();
    return screen(env,id,'Утренний прогноз',cancelled?'Подписка не оформлена. Полный прогноз доступен вручную.':'Эта кнопка больше не действует. Текущий выбор не изменён.',[],'dossier');
   }
   const ok=await confirmConsent28(env,id,match[2],q.message.message_id,updateId);
   return screen(env,id,'Утренний прогноз',ok?'Подписка подтверждена. Отозвать согласие можно в любой момент здесь или командой /stop.'+deliveryPause28(env,schema):'Эта кнопка больше не действует. Для подписки откройте настройку и подтвердите условия заново.',[[button('Настройка уведомлений','notifications')]],'dossier');
  }
  // Every legacy toggle/enable/confirm can only display a NEW notice, never grant.
  return consentScreen28(env,id);
 }
 return pre28_shellPage(env,id,page,q,updateId);
}
async function incoming(env,m,updateId){
 if(m.chat?.type==='private'&&m.from?.id===m.chat.id&&!m.from?.is_bot){
  const text=String(m.text||'').trim();
  if(text==='/stop'){await revokeConsent28(env,m.from.id);return send(env,m.from.id,'Подписка отозвана. Утренние уведомления выключены. Полный прогноз доступен вручную.');}
  if(text==='🔔 Рассылка')return consentScreen28(env,m.from.id);
 }
 return pre28_incoming(env,m,updateId);
}
async function health(env){
 const response=await pre28_health(env),state=await response.json(),schema=await schemaConsent28(env);
 state.broadcast_consent_implemented=true;state.consent_schema_ready=schema.ready;state.consent_gate_ready=schema.ready;
 state.broadcast_delivery_allowed=Boolean(schema.ready&&!schema.quarantined&&POLICY_TRUE(env.ASTRA_DAILY_DELIVERY_ENABLED)&&state.broadcast_schema_ready&&state.manual_content_ready);
 state.broadcast_blocker=!schema.ready?schema.reason:schema.quarantined?'delivery_quarantined':!POLICY_TRUE(env.ASTRA_DAILY_DELIVERY_ENABLED)?'delivery_disabled':state.broadcast_prerequisite_blocker;
 state.broadcast_ready=state.broadcast_delivery_allowed;state.public_ready=false;state.ready=false;state.release_scope='STAGING_REVIEW_ONLY';
 return Response.json(state,{status:503,headers:{'Cache-Control':'no-store'}});
}
async function broadcast(env){return runBroadcast28(env);}
