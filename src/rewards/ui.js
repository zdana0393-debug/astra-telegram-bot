// Integration in the single Worker scope; the old A/B modules remain separate.
async function policyWelcome(env,id,ref=''){
  const p=await readPolicy(env);if(!p.activated)return legacyWelcome(env,id,ref);
  const u=await createUser(env,id,ref);
  if(u.zodiac)return send(env,id,`Астра · кабинет интерпретаций\n${zodiacName(u.zodiac)}\nБаланс: ${u.balance} ✨\n\nВыберите раздел.`,{reply_markup:keyboard});
  return send(env,id,`Астра\nАстрология · Таро · нумерологические соответствия\n\nВыберите солнечный знак. Баланс: ${u.balance} ✨. Новый профиль по policy-v2 получает 12 ✨ один раз${p.enabled?'':'; начисления сейчас приостановлены'}. Прогноз с числом дня и карта дня бесплатны.`,{reply_markup:signKeyboard});
}
async function bonus(env,id){
  const p=await readPolicy(env);if(!p.activated)return legacyBonus(env,id);
  const u=await getUser(env,id);return send(shellEnv(env,'dust'),id,`Бонус первого осмысленного входа: +3 ✨ автоматически один раз на московскую дату${p.enabled?'':'. Начисления приостановлены'}. Ручной +1 больше не действует.\nБаланс: ${u.balance} ✨. Состояние начислений доступно в истории.`);
}
async function invite(env,id){
  const p=await readPolicy(env);if(!p.activated)return legacyInvite(env,id);
  return send(shellEnv(env,'dust'),id,`Приглашение\n\nНовым участникам после запуска policy-v2: 14 ✨ пригласившему и 4 ✨ приглашённому после выбора знака и двух разных активных московских дат. Если пригласивший удалён до выплаты, договор отменяется. Старые незавершённые приглашения сохраняют исходные +5 пригласившему. Повторной выплаты за уже оплаченный договор нет.\n\nhttps://t.me/${botUsername(env)}?start=ref_${id}`);
}
async function channelMenu(env,id){
  const p=await readPolicy(env);if(!p.activated)return legacyChannelMenu(env,id);
  const c=channelName(env);if(!c)return send(shellEnv(env,'dust'),id,'Канал пока не подключён. Бесплатные функции доступны без подписки.');
  return send(shellEnv(env,'dust'),id,`Канал ${c}\n\nПервая подтверждённая подписка: +8 ✨. Ранее полученные +5 не доплачиваются.`,{reply_markup:{inline_keyboard:[[{text:'Открыть канал',url:`https://t.me/${c.slice(1)}`}],[{text:'Проверить подписку',callback_data:'channel:check'}]]}});
}
async function channelCheck(env,id){
  const p=await readPolicy(env);if(!p.activated)return legacyChannelCheck(env,id);
  if(!p.enabled||!POLICY_TRUE(env.ASTRA_ECONOMY_V2_ENABLED))return send(shellEnv(env,'dust'),id,'Новые начисления приостановлены.');
  const c=channelName(env);if(!c)return channelMenu(env,id);
  const u=await getUser(env,id);if(u.channel_rewarded)return send(shellEnv(env,'dust'),id,'Начисление за подписку уже проведено. Повторного бонуса нет.');
  let member;try{member=await tg(env,'getChatMember',{chat_id:c,user_id:id});}catch{return send(shellEnv(env,'dust'),id,'Проверка подписки недоступна. Повторите позднее.');}
  if(!['member','administrator','creator'].includes(member.status)&&!(member.status==='restricted'&&member.is_member===true))return send(shellEnv(env,'dust'),id,'Подписка не подтверждена.');
  await policyClaim(env,id,'channel',dayMSK(),8);
  return send(shellEnv(env,'dust'),id,'Подписка проверена. Результат начисления +8 ✨ и возможное погашение долга отражены в истории.');
}
async function economyDust(env,id,u){
  const p=await readPolicy(env),s=await policySummary(env,id);
  const rates=p.activated?'Новый профиль: 12 ✨ один раз. Первый активный вход: +3 ✨ автоматически.\nПервые 3 дня подряд: +3; каждые 7 подряд: +5; 30 разных активных дат: +12 один раз.\nНовые рефералы: +14/+4 после двух дат. Новый канал: +8 один раз; старые +5 закрывают право.':'Начальный баланс: 2 ✨. Ручной бонус дня: +1. Реферал после выбора знака: +5. Новый подтверждённый канал: +5.';
  return screen(env,id,'✨ Звёздная пыль',`Баланс: ${u.balance} ✨\nДолг по возвратам: ${s.debt} ✨\n\n${rates}\n${p.activated&&!p.enabled?'Начисления приостановлены.\n':''}Таро: 3 ✨. Расширенный прогноз: 4 ✨ на дату, повтор бесплатно. Прогноз с числом дня и карта дня бесплатны.\nПри долге новые начисления сначала погашают его отдельной записью журнала.`,[
    [button('История операций','dust:history'),button('Активные дни','dust:activity')],
    [button('Бонус дня','gift'),button('Пригласить участника','invite')],[button('Подписка на канал','channel')],
    [button('Магазин Stars','dust:shop'),button('Мои платежи','stars:history')],[button('Условия','stars:terms'),button('Поддержка','stars:support')]]);
}
async function economyDossier(env,id,u){
  const p=await readPolicy(env);if(!p.activated)return legacyEconomyDossier(env,id,u);
  const s=await policySummary(env,id);return screen(env,id,'Экономическое досье',`Баланс: ${u.balance} ✨\nДолг по возвратам: ${s.debt} ✨\nДат policy-v2: ${s.total}\nТекущая серия policy-v2: ${s.streak} дн.\n\n+3 за первый вход; первые 3 подряд +3 один раз; каждые 7 подряд +5; 30 разных дат +12 один раз. Все выплаты видны в истории. Пропуск не отнимает накопленную пыль. Старые даты не пересчитываются.`,[[button('История операций','dossier:history'),button('Мои платежи','stars:history')]],'dossier');
}
async function activityScreen(env,id,parent){
  const p=await readPolicy(env);if(!p.activated)return legacyActivityScreen(env,id,parent);
  const s=await policySummary(env,id);return screen(env,id,'Активные дни',`policy-v2: ${s.total} разных дат; текущая серия ${s.streak} дн.\nДаты отсчитываются с принятой политики, без восстановления прежних посещений. +3 за дату, +3 за первые 3 подряд, +5 за каждый 7-дневный цикл и +12 за 30 разных дат. Пропуск не уменьшает баланс.`,[[button('История операций',`${parent}:history`)]],parent);
}
async function policyBefore(env,update){
  const event=economyEvent(update),p=await policyClock(env);
  if(event&&p.activated&&p.enabled&&POLICY_TRUE(env.ASTRA_ECONOMY_V2_ENABLED)){
    const existing=await env.DB.prepare('SELECT update_id FROM astra_policy_events WHERE update_id=?').bind(update.update_id).first();
    const oldJob=existing?null:await env.DB.prepare('SELECT update_id FROM astra_update_jobs WHERE update_id=?').bind(update.update_id).first();
    if(!existing&&!oldJob)await capturePolicyEvent(env,event,update.update_id,activityDay(),p,false);
  }
  if(event&&p.activated)await settlePolicyEvents(env,event.id);
  return event?{...event,policyActive:Boolean(p.activated&&p.enabled&&POLICY_TRUE(env.ASTRA_ECONOMY_V2_ENABLED))}:null;
}
async function policyAfter(env,event){if(event?.signSelection)await settlePolicyEvents(env,event.id);}

async function policyFaq(env){
  const p=await readPolicy(env),items=FAQ.map(row=>[...row]);
  let shop=false;try{await paymentEnvironment(env,{shop:true});shop=true;}catch{}
  const rates=p.activated?'Новый профиль: 12 ✨ один раз; первый осмысленный вход за московскую дату: +3 автоматически. Первые три дня подряд: +3 один раз; каждый седьмой день серии: +5; 30 разных дат: +12 один раз. Новое приглашение: +14/+4 после выбора знака и двух активных дат; старый незавершённый договор: прежние +5. Канал: +8 один раз; прежние +5 исключают повтор.':'Начальный баланс: 2 ✨. Ручной бонус дня: +1. Приглашение после выбора знака: +5; первая подтверждённая подписка: +5. Новая политика ещё не вступила в силу.';
  items[4][2]=`Баланс и журнал меняются атомарно в SQL; повтор финансового ключа не создаёт второе начисление или списание. Повторная доставка Telegram возможна.\n\n${rates}${p.activated&&!p.enabled?' Новые бонусы приостановлены.':''}\n\nТри карты: 3 ✨. Расширенный пакет: 4 ✨ на человека и московскую дату; повтор сохранённого материала бесплатен. Число дня и основной прогноз бесплатны. Пыль не передаётся между профилями и не выводится в деньги.\n\n${shop?'Магазин Stars открыт по принятым условиям /terms.':'Магазин Stars выключен; счета не выставляются.'} Подтверждённая оплата, возврат и погашение долга отражаются отдельными записями. Возврат не отнимает материалы: доступная пыль уменьшается, недостаток становится явным долгом; новые начисления сначала погашают его.`;
  if(p.activated)items[5][2]=items[5][2].replace('Дневной бонус запрашивается вручную;','Бонус первого осмысленного входа начисляется автоматически;');
  items[6][2]='D1 хранит профиль, финансовый журнал, результаты, активные даты, наградные claims и технические статусы. Дата рождения, телефон и фотографии не собираются.\n\n/delete удаляет обычные данные профиля. Доказательства оплаченных заказов и незавершённые долги сохраняются для поддержки и возвратов по /privacy и /terms. Долг не исчезает при новой регистрации. После установленного хранения остаётся charge hash с суммой и признаком возврата без ID плательщика для защиты от повторного начисления. Сообщения Telegram и резервные копии управляются отдельно.';
  items[7][1]='Портрет, совместимость, натальная карта и коллекции.';
  items[7][2]=items[7][2].replace('коллекционный архив и магазин Stars также не подключены','коллекционный архив также не подключены');
  items[10][1]=shop?'Магазин открыт: 10 XTR → 100 ✨; 25 → 270; 50 → 570.':'Магазин Stars подготовлен, но отключён до решения владельца.';
  items[10][2]=`${items[10][1]} Согласие с версией /terms предшествует счёту; пыль появляется только после подтверждённой оплаты Telegram. Повтор события не создаёт вторую выплату.\n\nПри возврате расходованная часть пакета может стать долгом с погашением будущими начислениями. Уже выданные материалы сохраняются. /payments — свои заказы; /paysupport — помощь; /privacy — состав и сроки хранения доказательств. Скрытых подписок нет.`;
  return items;
}
