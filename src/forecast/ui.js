// App integration: built in the same lexical scope as the preserved 2.3A Worker.
async function sendForecastText(env,id,text,rows=[]) {
  for(const chunk of forecastChunks(text))await send(shellEnv(env,'forecast'),id,chunk,{reply_markup:{inline_keyboard:rows}});
}
async function sendFreeForecast(env,id,sign,day=dayMSK()) {
  if(!engineActive(env,day))return send(shellEnv(env,'forecast'),id,legacyForecast(sign,day));
  const f=await getForecastDaily(env,sign,day);
  return sendForecastText(env,id,f.free_text,[[button('Расширенный — 4 ✨','forecast:extended')]]);
}
async function forecastMenu(env,id) {
  return screen(env,id,'🌙 Прогноз дня','Общий прогноз по выбранному знаку: тема, отношения, дела, ресурсы, эмоциональный ритм, число дня и практический итог. Дата определяется по Europe/Moscow.',[
    [button('Открыть бесплатно','forecast:read')],[button('Расширенный — 4 ✨','forecast:extended')],
    [button('Повторить расширенный','forecast:repeat')],[button('🃏 Таро','tarot')]]);
}
async function forecastExtended(env,id,user,mode,requestedDay=null) {
  const today=dayMSK(),day=requestedDay||today;
  if(!validDay(day))return screen(env,id,'Предложение недоступно','Дата предложения некорректна. Откройте раздел заново.',[],'forecast');
  const saved=await getForecastUnlock(env,id,day);
  if(saved)return sendForecastText(env,id,saved.result_text);
  if(mode==='repeat')return screen(env,id,'Сохранённый прогноз','На текущую дату расширенный прогноз не приобретён. Бесплатная часть доступна независимо от баланса.',[],'forecast');
  if(day!==today)return screen(env,id,'Предложение завершено','Московская дата изменилась. Это подтверждение не создаёт покупки за прошлый или будущий день; откройте новое предложение.',[],'forecast');
  if(!engineActive(env,day))return screen(env,id,'Переход на новый движок',`Новый прогноз включается с ${env.ASTRA_FORECAST_START_DAY} по Москве. До этой даты доступна прежняя бесплатная редакция; расширенный пока не продаётся.`,[],'forecast');
  if(mode==='confirm')return screen(env,id,'Расширенный прогноз — 4 ✨','В пакет входят разбор доминанты и развилки выбора, символ и цвет, дополнение к бесплатному числу, руна Старшего футарка и Совет Жирного. Одна покупка на московскую дату; повторное чтение бесплатно. Отмена ничего не списывает.',[[button('Подтвердить — 4 ✨',`forecast:pay:${day}`)]],'forecast');
  const row=await purchaseForecast(env,id,user.zodiac,day);
  if(!row)return screen(env,id,'Недостаточно пыли','Для нового дневного пакета требуется 4 ✨. Бесплатный прогноз остаётся доступен; баланс не изменён.',[],'forecast');
  return sendForecastText(env,id,row.result_text);
}
