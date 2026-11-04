/**
 * ASTRA 2.0 — Telegram-бот для Cloudflare Workers Free + D1.
 * Никаких npm-библиотек, серверов или платного AI API.
 *
 * D1 binding: DB -> astra-live-v2
 * Secrets: ASTRA_BOT_TOKEN, ASTRA_WEBHOOK_SECRET, ASTRA_ADMIN_KEY
 * Optional text variable: CHANNEL_USERNAME (например, @examplechannel)
 * Cron UTC: * 6-7 * * * (09:00–10:59 по Москве; 8 адресатов в минуту)
 *
 * ВАЖНО: запустить SQL из 02_SCHEMA.sql В НОВОЙ базе до подключения webhook.
 */
const VERSION = 'ASTRA-2.0.0';
const BOT_USERNAME = 'LaDa_Iskra_Opel_Astrabot';
const ZODIAC = [
  ['aries','♈ Овен'], ['taurus','♉ Телец'], ['gemini','♊ Близнецы'],
  ['cancer','♋ Рак'], ['leo','♌ Лев'], ['virgo','♍ Дева'],
  ['libra','♎ Весы'], ['scorpio','♏ Скорпион'], ['sagittarius','♐ Стрелец'],
  ['capricorn','♑ Козерог'], ['aquarius','♒ Водолей'], ['pisces','♓ Рыбы'],
];

// В первой версии — 22 старших аркана; во второй добавим полную колоду и иллюстрации.
const TAROT = [
  ['Шут','Новый путь, любопытство и смелость.','Не торопись: сначала оцени последствия.'],
  ['Маг','У тебя есть ресурсы, чтобы воплотить задуманное.','Не распыляй внимание и силы.'],
  ['Верховная Жрица','Прислушайся к интуиции и внутреннему голосу.','Не всё очевидно; проверь догадки.'],
  ['Императрица','Забота и творчество помогут делу вырасти.','Позаботься не только о других, но и о себе.'],
  ['Император','Структура и ответственность принесут ясность.','Слишком жёсткие правила могут помешать.'],
  ['Иерофант','Полезны знания, традиции и совет наставника.','Не принимай привычные правила без вопросов.'],
  ['Влюблённые','Делай выбор, не изменяя собственным ценностям.','Противоречия требуют честного разговора.'],
  ['Колесница','Направь энергию на конкретную цель.','Сбавь скорость, если теряешь контроль.'],
  ['Сила','Спокойная уверенность сильнее давления.','Восстанови силы и не заглушай чувства.'],
  ['Отшельник','Уединение поможет услышать себя.','Не превращай полезную паузу в изоляцию.'],
  ['Колесо Фортуны','Перемены открывают неожиданную возможность.','Не полагайся исключительно на удачу.'],
  ['Справедливость','Факты и честность помогут принять решение.','Пересмотри ситуацию без поспешного осуждения.'],
  ['Повешенный','Попробуй посмотреть на проблему иначе.','Не затягивай решение бесконечным ожиданием.'],
  ['Смерть','Пора оставить прошлый этап позади.','Перемены могут быть постепенными, не сопротивляйся им вслепую.'],
  ['Умеренность','Равновесие и маленькие шаги приведут к цели.','Крайности мешают восстановить баланс.'],
  ['Дьявол','Заметь привычку, которая тебя ограничивает.','Не отдавай решение страху или соблазну.'],
  ['Башня','Неожиданная правда поможет перестроить планы.','Восстанови устойчивость после резких перемен.'],
  ['Звезда','Надежда и вдохновение возвращаются.','Поддержи мечту конкретными действиями.'],
  ['Луна','Тревогу стоит проверить фактами.','Не путай предчувствие с доказательством.'],
  ['Солнце','Открытость и радость объединяют людей.','Оптимизм хорош, но детали тоже важны.'],
  ['Суд','Настало время подвести итоги и выбрать новое.','Отпусти избыточную самокритику.'],
  ['Мир','Цикл завершается: отметь свой прогресс.','Заверши мелочи перед новым этапом.'],
];
const PHRASES = {
  general: [
    'День благоприятен для небольших, но уверенных шагов.',
    'Неожиданная мысль может подсказать новый путь.',
    'Сегодня особенно полезно обращать внимание на детали.',
    'Сначала заверши важное, а потом начинай новое.',
    'Удачный день для восстановления внутреннего равновесия.',
    'Привычная задача потребует нестандартного решения.',
    'Сохраняй гибкость, если планы немного изменятся.',
    'Твоё терпение может дать заметный результат.',
    'Инициатива поможет сдвинуть дело с места.',
    'Небольшой успех задаст тон всему дню.',
    'Лучше сосредоточиться на том, что действительно зависит от тебя.',
    'День может оказаться насыщен интересными разговорами.',
    'Прислушайся к идее, которую давно откладывал.',
    'Спешка сегодня менее полезна, чем внимательность.',
    'Хороший момент переоценить свои приоритеты.',
    'Постарайся оставить немного пространства для спонтанности.',
  ],
  love: [
    'Тёплый разговор важнее громких обещаний.',
    'Не строй догадки — лучше спроси напрямую.',
    'Подари внимание тому, кто рядом.',
    'Искренность поможет избежать недоразумений.',
    'Небольшой добрый жест запомнится надолго.',
    'Уважай личные границы — свои и чужие.',
    'Лёгкость и юмор помогут снять напряжение.',
    'Сегодня стоит проявить благодарность.',
    'Не торопи события и уважай чужой темп.',
    'Время хорошо подходит для примирения.',
    'Слушай внимательно, не перебивая.',
    'Забота о себе поможет заботиться о близких.',
  ],
  work: [
    'Раздели большое дело на несколько коротких задач.',
    'Продуктивность сегодня начинается с ясного списка.',
    'Не бойся просить помощи в сложном вопросе.',
    'Проверь мелочи перед важным решением.',
    'Хорошее время навести порядок в планах.',
    'Один точный вопрос сэкономит много времени.',
    'Сначала реши самое важное, затем второстепенное.',
    'Короткая пауза поможет найти решение.',
    'Заметный результат принесёт последовательность.',
    'Твоя идея заслуживает спокойного обсуждения.',
    'Попробуй более простой подход к привычной задаче.',
    'Лучше закончить одну задачу, чем начать пять.',
  ],
  advice: [
    'Сделай небольшую прогулку.',
    'Запиши хорошую идею, пока не забыл.',
    'Не сравнивай свою скорость с чужой.',
    'Оставь время для отдыха.',
    'Отметь три удачных момента дня.',
    'Прежде чем соглашаться, оцени свои силы.',
    'Отложи ненужный спор.',
    'Найди время для маленькой радости.',
    'Вспомни, ради чего начал.',
    'Напиши человеку, которого давно не слышал.',
    'Сосредоточься на одном конкретном действии.',
    'Сохрани силы на то, что действительно важно.',
  ],
};

function dayMSK() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
}
function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function choice(arr, seed) { return arr[hash(seed) % arr.length]; }
function zodiacName(id) { return ZODIAC.find(([z]) => z === id)?.[1] || null; }
function forecast(sign, day = dayMSK()) {
  const label = zodiacName(sign);
  if (!label) return 'Сначала выбери знак зодиака через /start.';
  const p = (section) => choice(PHRASES[section], `${sign}|${day}|${section}`);
  const luckyNumber = hash(sign + day) % 9 + 1;
  return `🌙 ГОРОСКОП НА ${day}\n${label}\n\n` +
    `✨ Главное: ${p('general')}\n\n` +
    `💕 Отношения: ${p('love')}\n\n` +
    `📚 Дела: ${p('work')}\n\n` +
    `🍀 Совет дня: ${p('advice')}\n\n` +
    `🔢 Число дня: ${luckyNumber}\n\n` +
    'Это развлекательный прогноз, а не руководство для важных решений.';
}
function tarotLine(index, reversed) {
  const [name, straight, back] = TAROT[index];
  return `🃏 ${name}${reversed ? ' (перевёрнутая)' : ''}\n${reversed ? back : straight}`;
}
function dayCard(id, day = dayMSK()) {
  const i = hash(`card|${id}|${day}`) % TAROT.length;
  const reversed = (hash(`flip|${id}|${day}`) % 2) === 1;
  return `🔮 КАРТА ДНЯ\n\n${tarotLine(i, reversed)}\n\nЗавтра откроется новая карта. Трактовка символическая.`;
}
function threeCardSpread() {
  const selected = new Set();
  const slots = ['1. Текущая ситуация', '2. Что мешает', '3. Что поможет'];
  const parts = [];
  while (parts.length < 3) {
    const rand = new Uint32Array(2);
    crypto.getRandomValues(rand);
    const i = rand[0] % TAROT.length;
    if (selected.has(i)) continue;
    selected.add(i);
    parts.push(`${slots[parts.length]}\n${tarotLine(i, (rand[1] % 2) === 1)}`);
  }
  return `🔮 РАСКЛАД НА 3 КАРТЫ\n\n${parts.join('\n\n')}\n\nЭтот расклад — развлечение и повод для размышления.`;
}
const keyboard = {
  keyboard: [
    [{text:'🔮 Гороскоп'},{text:'🃏 Таро'}],
    [{text:'🎁 Бонус дня'},{text:'✨ Баланс'}],
    [{text:'👥 Пригласить друга'},{text:'🌟 Канал'}],
    [{text:'🔔 Рассылка'},{text:'⚙️ Помощь'}],
  ], resize_keyboard:true, is_persistent:true,
};
const signKeyboard = {inline_keyboard:Array.from({length:6},(_,j)=>
  ZODIAC.slice(j*2,j*2+2).map(([id,name])=>({text:name, callback_data:`sign:${id}`})))};
const tarotKeyboard = {inline_keyboard:[
  [{text:'🃏 Карта дня — бесплатно', callback_data:'tarot:day'}],
  [{text:'🔮 3 карты — 3 ✨', callback_data:'tarot:three'}],
]};

async function tg(env, method, args) {
  const response = await fetch(`https://api.telegram.org/bot${env.ASTRA_BOT_TOKEN}/${method}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(args),
  });
  const data = await response.json();
  if (!data.ok) {
    const error = new Error(`Telegram ${method}: ${data.description || response.status}`);
    error.telegramCode = data.error_code || response.status;
    throw error;
  }
  return data.result;
}
const send = (env, id, text, opts={}) => tg(env, 'sendMessage', {chat_id:id, text, ...opts});
const getUser = (env, id) => env.DB.prepare('SELECT * FROM astra_users WHERE telegram_id=?').bind(id).first();

async function createUser(env, id, referral='') {
  let u = await getUser(env, id);
  if (u) return u;
  let friend = null;
  if (/^ref_[0-9]{1,17}$/.test(referral)) {
    const candidate = Number(referral.slice(4));
    if (Number.isSafeInteger(candidate) && candidate !== id) {
      const inviter = await getUser(env, candidate);
      if (inviter?.zodiac) friend = candidate;
    }
  }
  await env.DB.prepare('INSERT OR IGNORE INTO astra_users(telegram_id, referrer_id) VALUES(?,?)')
    .bind(id, friend).run();
  return getUser(env, id);
}
async function welcome(env,id,ref='') {
  const u = await createUser(env,id,ref);
  if (u.zodiac) return send(env,id,`🌙 С возвращением в Астру!\n${zodiacName(u.zodiac)}\nБаланс: ${u.balance} ✨`,{reply_markup:keyboard});
  return send(env,id,'🌙 Привет! Я Астра — бот с гороскопом и картами Таро.\n\nВыбери знак зодиака. На старте тебе подарено 2 ✨.\n\nПрогнозы — развлекательные.',{reply_markup:signKeyboard});
}
async function setZodiac(env,id,sign) {
  if (!zodiacName(sign)) return;
  const old = await getUser(env,id);
  if (!old) return welcome(env,id);
  const changed = await env.DB.prepare('UPDATE astra_users SET zodiac=?, referral_rewarded=1 WHERE telegram_id=? AND zodiac IS NULL')
    .bind(sign,id).run();
  if (changed.meta.changes && old.referrer_id && !old.referral_rewarded) {
    await env.DB.prepare('UPDATE astra_users SET balance=balance+5 WHERE telegram_id=?')
      .bind(old.referrer_id).run();
    try { await send(env,old.referrer_id,'🎉 Твой друг присоединился! Начислено +5 ✨.'); }
    catch(e){console.log('Referral notice failed:',e.message);}
  }
  const u = await getUser(env,id);
  await send(env,id,`✅ Твой знак: ${zodiacName(u.zodiac)}\nБаланс: ${u.balance} ✨\n\nВыбирай функции в меню.`,{reply_markup:keyboard});
  await send(env,id,forecast(u.zodiac));
}
async function bonus(env,id) {
  const day=dayMSK();
  const r=await env.DB.prepare('UPDATE astra_users SET balance=balance+1, last_gift_day=? WHERE telegram_id=? AND (last_gift_day IS NULL OR last_gift_day<>?)').bind(day,id,day).run();
  const u=await getUser(env,id);
  return send(env,id,r.meta.changes ? `🎁 Начислено +1 ✨! Теперь баланс: ${u.balance} ✨.` : `🎁 Сегодня бонус уже получен. Баланс: ${u.balance} ✨.`);
}
async function threeCards(env,id) {
  const r=await env.DB.prepare('UPDATE astra_users SET balance=balance-3 WHERE telegram_id=? AND balance>=3').bind(id).run();
  if (!r.meta.changes) return send(env,id,'Недостаточно ✨. Нужно 3. Забери бонус дня или пригласи друга.');
  try { return await send(env,id,threeCardSpread()); }
  catch(e) {
    // Если Telegram отклонил сообщение, восстановим списанные баллы.
    await env.DB.prepare('UPDATE astra_users SET balance=balance+3 WHERE telegram_id=?').bind(id).run();
    throw e;
  }
}
async function invite(env,id) {
  const url=`https://t.me/${BOT_USERNAME}?start=ref_${id}`;
  return send(env,id,`👥 Приглашай друзей!\n\nКогда новый пользователь перейдёт по ссылке и впервые выберет знак, получишь +5 ✨.\n\n${url}`);
}
function channelName(env) {
  const s=String(env.CHANNEL_USERNAME||'').trim();
  return /^@[A-Za-z0-9_]{5,32}$/.test(s) ? s : null;
}
async function channelMenu(env,id) {
  const c=channelName(env);
  if (!c) return send(env,id,'🌟 Бонус за канал будет доступен, когда владелец подключит публичный Telegram-канал.');
  return send(env,id,`🌟 Подпишись на ${c} и нажми «Проверить». За первую подтверждённую подписку — +5 ✨.`,{
    reply_markup:{inline_keyboard:[
      [{text:'📢 Открыть канал',url:`https://t.me/${c.slice(1)}`}],
      [{text:'✅ Проверить',callback_data:'channel:check'}],
    ]},
  });
}
async function channelCheck(env,id) {
  const c=channelName(env);
  if (!c) return channelMenu(env,id);
  const u=await getUser(env,id);
  if (u.channel_rewarded) return send(env,id,'🌟 Бонус за канал уже был получен.');
  let member;
  try { member=await tg(env,'getChatMember',{chat_id:c,user_id:id}); }
  catch(e){console.error('getChatMember:',e.message);return send(env,id,'Не удалось проверить подписку. Проверь, что бот — администратор канала.');}
  const ok=['member','administrator','creator'].includes(member.status) || (member.status==='restricted'&&member.is_member===true);
  if (!ok) return send(env,id,'Пока не вижу подписки. Подпишись на канал и проверь снова.');
  const r=await env.DB.prepare('UPDATE astra_users SET balance=balance+5, channel_rewarded=1 WHERE telegram_id=? AND channel_rewarded=0').bind(id).run();
  return send(env,id,r.meta.changes?'🎉 Подписка подтверждена! +5 ✨.':'Награда уже была выдана.');
}
async function help(env,id) {
  return send(env,id,'🌙 АСТРА — ПОМОЩЬ\n\n🔮 Гороскоп: бесплатно каждый день.\n🃏 Карта дня: бесплатно; 3 карты: 3 ✨.\n🎁 Бонус дня: +1 ✨ раз в день.\n👥 Друг: +5 ✨ за нового участника после выбора знака.\n🌟 Канал: +5 ✨ за первую подтверждённую подписку (после подключения канала).\n🔔 Рассылка: включить/выключить.\n\n/start — начало\n/stop — отключить рассылку\n/privacy — о данных\n/delete — удалить данные\n\nВсе прогнозы и карты — развлечения, не профессиональные советы.');
}
async function incoming(env,m) {
  if (m.chat?.type!=='private' || !m.from) return;
  const id=m.from.id;
  const text=String(m.text||'').trim();
  if (/^\/start(?:\s|$)/.test(text)) return welcome(env,id,text.split(/\s+/)[1]||'');
  if (text==='/privacy') return send(env,id,'🔐 Астра хранит только Telegram ID, знак зодиака, баланс и даты бонусов/рассылок, а также идентификатор пригласившего, если он был. Телефон и дату рождения не собираем. Для удаления своих данных: /delete. Владелец бота отвечает за соблюдение правил конфиденциальности.');
  if (text==='/delete') {
    await env.DB.prepare('DELETE FROM astra_users WHERE telegram_id=?').bind(id).run();
    return send(env,id,'🗑 Данные пользователя удалены. Для нового начала отправь /start.',{reply_markup:{remove_keyboard:true}});
  }
  if (text==='/help'||text==='⚙️ Помощь') return help(env,id);
  if (text==='/stop') {
    await env.DB.prepare('UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=?').bind(id).run();
    return send(env,id,'🔕 Утренняя рассылка выключена. Включить можно кнопкой «🔔 Рассылка».');
  }
  const u=await getUser(env,id);
  if (!u?.zodiac) return welcome(env,id);
  if (text==='🔮 Гороскоп') return send(env,id,forecast(u.zodiac));
  if (text==='🃏 Таро') return send(env,id,'🔮 Выбери расклад:',{reply_markup:tarotKeyboard});
  if (text==='🎁 Бонус дня') return bonus(env,id);
  if (text==='✨ Баланс') return send(env,id,`✨ Твой баланс: ${u.balance} звёздной пыли.\n\nРасклад из 3 карт стоит 3 ✨.`);
  if (text==='👥 Пригласить друга') return invite(env,id);
  if (text==='🌟 Канал') return channelMenu(env,id);
  if (text==='🔔 Рассылка') {
    const next=u.notifications_enabled?0:1;
    await env.DB.prepare('UPDATE astra_users SET notifications_enabled=? WHERE telegram_id=?').bind(next,id).run();
    return send(env,id,next?'🔔 Рассылка включена. Утром по Москве придёт гороскоп.':'🔕 Рассылка выключена. Гороскоп по кнопке остаётся доступен.');
  }
  return send(env,id,'Выбери раздел с помощью кнопок меню.',{reply_markup:keyboard});
}
async function callback(env,q) {
  if (q.message?.chat?.type!=='private' || !q.from) return;
  const id=q.from.id;
  await tg(env,'answerCallbackQuery',{callback_query_id:q.id});
  const data=String(q.data||'');
  if (data.startsWith('sign:')) return setZodiac(env,id,data.slice(5));
  const u=await getUser(env,id);
  if (!u?.zodiac) return welcome(env,id);
  if (data==='tarot:day') return send(env,id,dayCard(id));
  if (data==='tarot:three') return threeCards(env,id);
  if (data==='channel:check') return channelCheck(env,id);
}

// Дубликаты Telegram update_id не выполняем повторно (особенно платные расклады).
async function dispatch(env, update) {
  if (!Number.isSafeInteger(update.update_id)) throw new Error('Invalid Telegram update_id');
  const claimed=await env.DB.prepare('INSERT OR IGNORE INTO astra_processed_updates(update_id) VALUES(?)')
    .bind(update.update_id).run();
  if (!claimed.meta.changes) return;
  try {
    if (update.message) await incoming(env,update.message);
    else if (update.callback_query) await callback(env,update.callback_query);
  } catch(error) {
    // Позволяем Telegram повторить временно неудачную обработку.
    await env.DB.prepare('DELETE FROM astra_processed_updates WHERE update_id=?').bind(update.update_id).run();
    throw error;
  }
}

async function health(env) {
  const state={
    version:VERSION,
    db_binding:env.DB?'FOUND':'MISSING',
    db_query:'NOT_TESTED', users_table:'NOT_TESTED',
    secrets_ready:Boolean(env.ASTRA_BOT_TOKEN && env.ASTRA_WEBHOOK_SECRET && env.ASTRA_ADMIN_KEY),
  };
  if (env.DB) {
    try {
      state.db_query=(await env.DB.prepare('SELECT 1 AS ok').first())?.ok===1?'OK':'FAILED';
      state.users_table=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='astra_users'").first())?.name==='astra_users'?'FOUND':'MISSING';
    } catch(e){state.db_query='ERROR'; console.error('DB health error',e);}
  }
  state.ready=state.db_query==='OK' && state.users_table==='FOUND' && state.secrets_ready;
  return new Response(JSON.stringify(state,null,2),{
    status:state.ready?200:503,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},
  });
}

async function activate(request,env) {
  const u=new URL(request.url);
  if (!env.ASTRA_ADMIN_KEY || u.searchParams.get('key')!==env.ASTRA_ADMIN_KEY) return new Response('Access denied',{status:403});
  if (!env.DB || !env.ASTRA_BOT_TOKEN || !env.ASTRA_WEBHOOK_SECRET) return new Response('Missing D1 binding or secrets; open /health',{status:503});
  const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='astra_users'").first();
  if (!table) return new Response('D1 schema missing: run 02_SCHEMA.sql in astra-live-v2',{status:503});
  try {
    const me=await tg(env,'getMe',{});
    if (String(me.username||'').toLowerCase()!==BOT_USERNAME.toLowerCase()) {
      return new Response('BOT TOKEN belongs to another bot. Verify ASTRA_BOT_TOKEN.',{status:409});
    }
    await tg(env,'setWebhook',{
      url:`${u.origin}/telegram-webhook`,
      secret_token:env.ASTRA_WEBHOOK_SECRET,
      allowed_updates:['message','callback_query'],
      drop_pending_updates:true,
    });
    try { await tg(env,'setMyCommands',{commands:[
      {command:'start',description:'Запустить Астру'},
      {command:'help',description:'Помощь и функции'},
      {command:'stop',description:'Выключить рассылку'},
      {command:'privacy',description:'Данные и конфиденциальность'},
      {command:'delete',description:'Удалить мои данные'},
    ]}); } catch(e){console.error('setMyCommands issue',e.message);}
    return new Response(`WEBHOOK_OK\nBot: @${BOT_USERNAME}\nWorker: ${VERSION}\nD1: OK\nNow open Telegram and send /start.`,{
      headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},
    });
  } catch(e) {
    console.error('Activation failed:',e.message);
    return new Response(`Activation failed: ${e.message}`,{status:502});
  }
}

async function broadcast(env) {
  const now=new Date();
  // Даже при случайном расписании не шлём прогнозы вне утреннего окна UTC.
  if (now.getUTCHours()<6 || now.getUTCHours()>7) return;
  const day=dayMSK();
  const batch=await env.DB.prepare(`
    SELECT telegram_id, zodiac FROM astra_users
    WHERE notifications_enabled=1 AND zodiac IS NOT NULL
      AND (last_broadcast_day IS NULL OR last_broadcast_day<>?)
    ORDER BY telegram_id LIMIT 8
  `).bind(day).all();
  for (const user of batch.results||[]) {
    // Помечаем до отправки, предотвращая параллельную повторную рассылку.
    const claim=await env.DB.prepare(`UPDATE astra_users SET last_broadcast_day=?
      WHERE telegram_id=? AND (last_broadcast_day IS NULL OR last_broadcast_day<>?)`)
      .bind(day,user.telegram_id,day).run();
    if (!claim.meta.changes) continue;
    try { await send(env,user.telegram_id,forecast(user.zodiac,day)); }
    catch(e) {
      console.error('Broadcast send failed:',user.telegram_id,e.message);
      if (e.telegramCode===403 || e.telegramCode===400) {
        await env.DB.prepare('UPDATE astra_users SET notifications_enabled=0 WHERE telegram_id=?')
          .bind(user.telegram_id).run();
      } else {
        await env.DB.prepare('UPDATE astra_users SET last_broadcast_day=NULL WHERE telegram_id=? AND last_broadcast_day=?')
          .bind(user.telegram_id,day).run();
      }
    }
  }
  if (now.getUTCHours()===6 && now.getUTCMinutes()===0) {
    await env.DB.prepare("DELETE FROM astra_processed_updates WHERE received_at < datetime('now','-14 days')").run();
  }
}

export default {
  async fetch(request,env) {
    const u=new URL(request.url);
    if (request.method==='GET' && u.pathname==='/')
      return new Response(`Астра ${VERSION} 🌙\nДиагностика: /health`,{
        headers:{'Content-Type':'text/plain; charset=utf-8'},
      });
    if (request.method==='GET' && u.pathname==='/health') return health(env);
    if (request.method==='GET' && u.pathname==='/activate') return activate(request,env);
    if (request.method==='POST' && u.pathname==='/telegram-webhook') {
      if (!env.ASTRA_WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.ASTRA_WEBHOOK_SECRET)
        return new Response('Forbidden',{status:403});
      if (!env.DB) return new Response('D1 unbound',{status:503});
      try { await dispatch(env,await request.json()); return new Response('OK'); }
      catch(e){console.error('Webhook processing failed:',e);return new Response('Temporary failure',{status:500});}
    }
    return new Response('Not found',{status:404});
  },
  async scheduled(_event,env) {
    if (!env.DB || !env.ASTRA_BOT_TOKEN) { console.error('Cron: DB or token missing'); return; }
    await broadcast(env);
  },
};
