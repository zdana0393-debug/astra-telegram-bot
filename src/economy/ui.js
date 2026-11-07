// Same lexical integration pattern as forecast/ui.js; no external runtime calls.
function activitySummaryText(a){
  return `Активных дат с начала учёта: ${a.total}\nТекущая серия: ${a.streak} дн.\n`+
    (a.first_day?`Первая учтённая дата: ${a.first_day}\n`:'Учёт начнётся с первого обращения после выбора знака.\n')+
    `Дата: ${dayMSK()} · Europe/Moscow\n\nЭтапы текущей серии: `+
    [3,7,30].map(n=>`${n} дн. — ${a.streak>=n?'достигнут':'впереди'}`).join('; ')+
    '.\nЭто этапы наблюдения без денежных наград. Пропуск дня прерывает серию, сохраняя всю накопленную пыль. Даты до установки трекера не восстанавливаются.';
}
async function economyDust(env,id,u){
  return screen(env,id,'✨ Звёздная пыль',`Баланс: ${u.balance} ✨\n\nНачальный баланс: 2 ✨. Бонус дня: +1 ✨ вручную.\nПриглашённый участник: +5 ✨ после первого выбора знака.\nПодтверждённая подписка на канал: +5 ✨ один раз.\nТри карты: 3 ✨. Расширенный прогноз: 4 ✨ на московскую дату; повтор бесплатно.\n\nОсновной прогноз с числом дня и карта дня бесплатны. Серии посещений не начисляют и не списывают пыль.`,[
    [button('История операций','dust:history'),button('Активные дни','dust:activity')],
    [button('Бонус дня','gift'),button('Пригласить участника','invite')],[button('Подписка на канал','channel')],
    [button('Магазин — в разработке','dust:shop')]]);
}
async function economyDossier(env,id,u){
  const a=await readActivity(env,id,dayMSK());
  return screen(env,id,'Экономическое досье',`Баланс: ${u.balance} ✨\n\n${activitySummaryText(a)}`,[
    [button('История операций','dossier:history')],[button('Звёздная пыль','dust')]],'dossier');
}
async function activityScreen(env,id,parent){
  const a=await readActivity(env,id,dayMSK());
  return screen(env,id,'Активные дни',activitySummaryText(a),[[button('История операций',`${parent}:history`)]],parent);
}
async function ledgerScreen(env,id,u,parent,cursor=null){
  const page=await readHistoryPage(env,id,cursor);
  if(page.expired)return screen(env,id,'История операций','Курсор недоступен или устарел. Откройте историю заново.',[[button('Открыть историю',`${parent}:history`)]],parent);
  const short=parent==='dossier'?'p':'d',rows=[];
  const paging=[];
  if(page.newer)paging.push(button('‹ Новее',`history:${short}:${page.newer}`));
  if(page.older)paging.push(button('Старее ›',`history:${short}:${page.older}`));
  if(paging.length)rows.push(paging);
  rows.push([button('Обновить историю',`${parent}:history`)]);
  const body=`История звёздной пыли\nТекущий баланс: ${u.balance} ✨\nВремя записей: Europe/Moscow (UTC+3)\n\n`+
    (page.rows.length?page.rows.map(historyRecordText).join('\n\n'):'Операций пока нет.')+
    '\n\nПросмотр зафиксирован при открытии истории. Новые операции доступны по кнопке обновления. Исторический снимок — сохранённый старый баланс, не новая награда. Знак минус обозначает расход пыли, не платёж Telegram Stars.';
  for(const chunk of economyChunks(body))await send(shellEnv(env,parent),id,chunk,{reply_markup:{inline_keyboard:rows}});
}
async function economyRoute(env,id,u,page){
  if(page==='dust')return economyDust(env,id,u);
  if(page==='dossier:economy')return economyDossier(env,id,u);
  if(page==='dust:activity'||page==='dossier:activity')return activityScreen(env,id,page.split(':')[0]);
  if(page==='dust:history'||page==='dossier:history')return ledgerScreen(env,id,u,page.split(':')[0]);
  const cursor=/^history:([dp]):(.+)$/.exec(page);
  if(cursor)return ledgerScreen(env,id,u,cursor[1]==='p'?'dossier':'dust',cursor[2]);
}
function economyEvent(update){
  const q=update.callback_query,m=update.message,event=q?.message||m,from=q?.from||m?.from;
  if(!event||event.chat?.type!=='private'||!from||from.is_bot||!Number.isSafeInteger(from.id)||from.id<=0||event.chat.id!==from.id)return null;
  if(q){
    const data=String(q.data||'');
    const pages=new Set(['home','about','manifest','trust','trust:forecast','trust:tarot','trust:dust','trust:future','team','faq','rules','privacy','self','dossier','dust','dust:shop','gift','invite','channel','notifications','notifications:toggle','tarot','buy','tarot:last','forecast','forecast:read','forecast:future','forecast:extended','forecast:repeat','dust:history','dossier:history','dust:activity','dossier:activity','dossier:economy']);
    const page=data.startsWith('shell:')?data.slice(6):null;
    const faq=/^faq:([0-9]{1,2})(?::more)?$/.exec(page||'');
    const validSign=data.startsWith('sign:')&&Boolean(zodiacName(data.slice(5)));
    const recognized=validSign||['tarot:day','tarot:three','channel:check'].includes(data)||pages.has(page)||Boolean(faq&&FAQ[Number(faq[1])])||/^pay:[1-9][0-9]{0,15}$/.test(page||'')||/^forecast:pay:\d{4}-\d{2}-\d{2}$/.test(page||'')||(/^history:[dp]:/.test(page||'')&&decodeHistoryCursor(page.slice(10))!==null);
    return recognized?{id:from.id,source:'callback',signSelection:validSign}:null;
  }
  const text=String(m.text||'').trim();
  const commands=['/help','/privacy','/stop','⚙️ Помощь','Главное меню','Назад','🔮 Гороскоп','🃏 Таро','🎁 Бонус дня','✨ Баланс','👥 Пригласить друга','🌟 Канал','🔔 Рассылка'];
  return (/^\/start(?:\s|$)/.test(text)||text.toLowerCase()==='gpt6'||MAIN_SECTIONS.some(([label])=>label===text)||commands.includes(text))?{id:from.id,source:'message',signSelection:false}:null;
}
async function economyFirstDelivery(env,updateId){
  try{return !await env.DB.prepare('SELECT update_id FROM astra_update_jobs WHERE update_id=?').bind(updateId).first();}
  catch{console.error('Activity delivery check unavailable');return false;}
}
async function safeEconomyActivity(env,event,acceptedAt){
  try{return await recordActivity(env,event.id,activityDay(new Date(acceptedAt)),event.source);}
  catch{console.error('Activity tracking unavailable');return false;}
}
