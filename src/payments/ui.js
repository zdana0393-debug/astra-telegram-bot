async function paymentTerms(env,id){
  const p=await readPolicy(env);
  return screen(env,id,'Условия Stars',`Пыль — внутренний доступ к материалам, без вывода в деньги. Стоимость пакета фиксируется в заказе до счёта. Пыль начисляется только после подтверждённой оплаты Telegram.\n\nПри возврате уже выданные материалы не отзываются. Доступная пыль уменьшается на стоимость возвращённого пакета; недостаток становится явным долгом. Будущие начисления сначала погашают долг. Баланс не становится отрицательным.\n\nПоддержка: ${p.support||'владелец ещё не указал контакт; магазин недоступен'}.\nВерсия условий: ${p.terms_version||'не утверждена'}.\nОплаченные заказы, charge ID и ID плательщика нужны для возвратов/споров: ${p.retention_days||'не утверждено'} дней после закрытия всех платёжных дел и погашения долга. Неразрешённые случаи сохраняются до завершения. После удаления персональных доказательств остаётся необратимый hash charge ID с суммой пакета и признаком возврата, без ID плательщика без ограничения срока для запрета повторного начисления. /delete не стирает незавершённые платежи/долги.\n\nДо согласования условий, контакта, хранения и окружения магазин выключен.`,[[button('Поддержка','stars:support')]],'dust');
}
async function paymentSupport(env,id){
  const p=await readPolicy(env);return screen(env,id,'Поддержка платежей',p.support?`Контакт владельца: ${p.support}\n\nУкажите номер заказа из «Мои платежи», сумму XTR и проблему. Не присылайте токен бота, webhook secret, данные других людей. Возврат рассматривается по /terms; долг не скрывается. При неопределённом исходе проводится сверка Telegram, а не повторное списание.`:'Контакт поддержки владельцем ещё не установлен. Магазин не может выставлять счета. Текущие материалы и история пыли остаются доступны.',[[button('Мои платежи','stars:history'),button('Условия','stars:terms')]],'dust');
}
async function paymentHistory(env,id,cursor=null){
  const page=await readStarHistory(env,id,cursor);
  if(page.expired)return screen(env,id,'Мои платежи','Курсор устарел. Откройте историю заново.',[[button('Обновить','stars:history')]],'dust');
  const nav=[];if(page.newer)nav.push(button('‹ Новее','stars:history:'+page.newer));if(page.older)nav.push(button('Старее ›','stars:history:'+page.older));
  const rows=nav.length?[nav]:[];rows.push([button('Обновить','stars:history'),button('Поддержка','stars:support')]);
  return screen(env,id,'Мои платежи',page.rows.length?page.rows.map(o=>`${formatLedgerTime(o.created_at)}\nЗаказ ${o.order_id}\n${o.xtr} XTR → ${o.dust} ✨ · ${o.status}`).join('\n\n'):'Заказов пока нет.',rows,'dust');
}
async function starsShop(env,id){
  try{await paymentEnvironment(env,{shop:true});}catch{return screen(env,id,'Магазин Stars','Магазин выключен или ещё не принят для этого окружения. Счета не выставляются. Доступные материалы и история работают независимо от магазина.',[[button('Условия','stars:terms'),button('Поддержка','stars:support')]],'dust');}
  return screen(env,id,'Магазин Stars','Пакет — одноразовая покупка внутренней пыли. Сначала ознакомьтесь с условиями; после согласия будет выставлен счёт в XTR.',Object.entries(STAR_PACKAGES).map(([key,p])=>[button(`${p.xtr} XTR → ${p.dust} ✨`,`stars:buy:${key}`)]).concat([[button('Мои платежи','stars:history'),button('Условия','stars:terms')]]),'dust');
}
async function starsRoute(env,id,page,q){
  if(page==='stars:terms')return paymentTerms(env,id);
  if(page==='stars:support')return paymentSupport(env,id);
  if(page==='stars:history')return paymentHistory(env,id);
  if(page.startsWith('stars:history:'))return paymentHistory(env,id,page.slice(14));
  if(page==='dust:shop')return starsShop(env,id);
  let p;try{p=await paymentEnvironment(env,{shop:true});}catch{return starsShop(env,id);}
  const buy=/^stars:buy:(10|25|50)$/.exec(page);
  if(buy){const token=(await chargeHash(p.terms_version)).slice(0,12),pack=STAR_PACKAGES[buy[1]];return screen(env,id,'Подтверждение покупки',`${pack.xtr} XTR за ${pack.dust} ✨.\nПрочитайте /terms версии ${p.terms_version}. Возврат после расходования пыли может создать долг с погашением будущими начислениями. Нажатие ниже подтверждает согласие и создаёт счёт; само открытие этого экрана ничего не начисляет.`,[[button(`Принимаю условия · ${pack.xtr} XTR`,`stars:accept:${buy[1]}:${token}`)],[button('Условия','stars:terms')]],'dust');}
  const consent=/^stars:accept:(10|25|50):([a-f0-9]{12})$/.exec(page);
  if(!consent||consent[2]!== (await chargeHash(p.terms_version)).slice(0,12)||(!Number.isSafeInteger(q?.message?.message_id)||q.message.message_id<1))return screen(env,id,'Предложение устарело','Откройте магазин заново и прочитайте действующие условия.',[],'dust');
  const key=`${q.message.message_id}:${consent[1]}:${consent[2]}`;
  const order=await createStarOrder(env,id,consent[1],key,p.terms_version);
  try{await sendStarInvoice(env,order);return screen(env,id,'Заказ сохранён',`Номер: ${order.order_id}.\nПыль появится только после подтверждённой оплаты. Состояние доступно в «Мои платежи».`,[[button('Мои платежи','stars:history')]],'dust');}
  catch{return screen(env,id,'Отправка счёта не подтверждена',`Заказ ${order.order_id} сохранён. Повторная автоматическая отправка отключена; проверьте сообщения и обратитесь в поддержку. Пыль за отправку счёта не начисляется.`,[[button('Мои платежи','stars:history'),button('Поддержка','stars:support')]],'dust');}
}
async function paymentCommand(env,m){
  const id=m.from.id,text=String(m.text||'').trim();
  if(text==='/terms'){await paymentTerms(env,id);return true;}
  if(text==='/paysupport'||text==='/support'){await paymentSupport(env,id);return true;}
  if(text==='/payments'){await paymentHistory(env,id);return true;}
  if(text==='/privacy'){
    const p=await readPolicy(env);await send(env,id,`Данные профиля\n\nЗнак, баланс, Telegram ID, реферальные связи, активные даты, журнал пыли, claims и технические update ID, сохранённые Таро/прогнозы хранятся в D1. Тексты сообщений/телефон/фотографии не собираются.\n\n/delete удаляет профиль, обычный журнал, результаты, активность и наградные связи. Оплаченные заказы, ID плательщика и charge ID сохраняются для поддержки/возвратов по принятой политике (${p.retention_days||'срок ещё не утверждён'} дней после закрытия всех платёжных дел и погашения долга); незавершённые случаи — до завершения. Долг явно сохраняется и после повторной регистрации. При удалении персональных доказательств остаётся необратимый charge hash с неперсональной суммой и статусом возврата без ограничения срока для запрета повторного кредита. Магазин до принятия этой политики выключен.\n\nКонтакт: ${p.support||'владелец ещё не настроил поддержку'}. /terms и /paysupport — условия и помощь. Сообщения Telegram и backup управляются отдельно.`);return true;
  }return false;
}
async function paymentUpdate(env,update){
  if(update.pre_checkout_query){await answerStarPrecheckout(env,update.pre_checkout_query);return true;}
  const m=update.message,proof=m?.successful_payment||m?.refunded_payment;if(!proof)return false;
  if(m.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0)throw Error('Private payment proof required');
  const owner=m.chat.id;
  if(m.successful_payment&&m.from?.id!==owner)throw Error('Payment sender mismatch');
  if(m.refunded_payment){const r=await receiveStarRefund(env,owner,proof,'message');await send(shellEnv(env,'dust'),owner,`Возврат Telegram учтён. Списано доступной пыли: ${r.removed} ✨; добавлен долг: ${r.debt_added} ✨. Материалы не отозваны. Подробности: /paysupport.`);}
  else{const r=await receiveStarPayment(env,owner,proof),rawOrder=await readPaymentOrder(env,proof.invoice_payload),o=rawOrder?.payer_id===owner?rawOrder:null,u=await getUser(env,owner);await send(shellEnv(env,'dust'),owner,`Платёж ${r.status==='needs_review'?'ожидает проверки поддержки':'сохранён'}${o?` · заказ ${o.order_id}`:''}.\nСостояние: ${o?.status||r.status}. Номер обращения: ${r.hash.slice(0,16)}.\n${u?`Доступный баланс: ${u.balance} ✨.`:'Профиль отсутствует; платёж не создаёт его автоматически.'}\nПовтор не начисляет пыль заново. /payments · /paysupport`);}
  return true;
}
