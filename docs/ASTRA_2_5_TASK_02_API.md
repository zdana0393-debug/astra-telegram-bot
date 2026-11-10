# TASK02 — отдельный D1 adapter, без Telegram UX

`src/tarot25/purchases29.mjs` — серверный модуль. `env.DB` соответствует prepare/bind/first/all/run D1; `actor={telegram_id,generation}` берётся **только из доверенного authenticated слоя**, никогда из callback payload. Само знание ID или JSON не аутентифицирует человека. Новый Worker здесь не создаётся.

```js
const quote=await prepareOffer(env, actor, {
  spread_id:'depth-5', request_key:'menu:stable-key', update_id:123
});
// quote содержит цену/версии/TTL, но НЕ неоплаченный draw/result.
const paid=await confirmPurchase(env, actor, quote.offer_id);
const same=await loadOwned(env, actor, quote.offer_id); // без повторной платы
const page=await history(env, actor, {limit:10,cursor:null});
```

Первое prepare фиксирует пару stable request_key + исходный update_id. Повтор должен предъявлять ту же пару и ту же тему/вопрос; изменённые параметры отклоняются. Новый заказ требует нового ключа. Поля price, owner, snapshot от клиента запрещены. Внутренний INSERT берёт цену и структуру из канонической SQL-версии, snapshot готовится до любого debit. Конкурирующие prepare могут вычислить проигравший кандидат, но сохраняют и возвращают один sealed offer. Confirm никогда не вызывает генератор.

`loadOwned` поддерживает raw32hex/new:ID, legacy3:operationID, legacy5:offerID; legacy возвращает literal result без нового JSON/интерпретации. `history` объединяет три источника; keyset cursor(created_at,history_key) проверяется на принадлежность текущему owner/generation. Предел20 строк, без offset; limit ограничивает ответ, а не гарантирует малый rows_read на большой истории — это измеряется отдельно.

`cancelOffer` отменяет неоплаченное предложение. После истечения900 секунд/отзыва/смены generation или policy revision confirm не списывает. Оплаченный snapshot доступен при OFF продаж. Reader v1 (`reader-v1.mjs` + замороженный JSON-contract) не импортирует текущие catalog/spreads/engine; текстовый splitter также вынесен отдельно. Проверка replay не утверждает, что snapshot подписан или сам доказывает оплату: право чтения берётся из SQL purchase JOIN живого профиля.

## Контракт доставки

`retryDelivery(env,actor,offer_id,{send,explicit:false,ack_unknown:false,timeout_ms:3000})` работает только с **инъецированным** транспортом; реализация Bot API отсутствует. `send({text,part_index,total,signal})` должен вернуть/resolve **true или {accepted:true}** только после достоверного подтверждения транспортом. false/undefined/ошибка/timeout — не подтверждение. Реальный разбор Telegram response/sendMessage — TASK03.

Одновременно идёт одна отправка по lease. Автоматический claim разрешён только pending/retry, причём повторная проверка находится в самом SQL UPDATE: старое JS-чтение pending не позволяет захватить уже sent/unknown. Между частями — свежий SQL JOIN owner/generation/lease. HTTP после начатого запроса нельзя отменить общей транзакцией с D1.

429 без принятых частей — bounded retry не раньше полного retry_after; после части — unknown. Сеть/timeout/5xx — unknown; определённые4xx — rejected. Timeout передаёт AbortSignal, но неизвестный результат нельзя объявить «точно не отправлено». Истёкший sending становится unknown, а не автоматическим retry. Unknown требует explicit=true и ack_unknown=true; будущий UI должен объяснять риск повторного сообщения.

Всего не более3transport claims на покупку, включая явные helper-повторы. Это ограничение helper, не срок права на материал: loadOwned остаётся доступным. Полноценный пользовательский repeated-read UX после лимита и безопасное отображение длинных материалов проектируются в TASK03 без нового debit, с отдельным rate/idempotency решением. Никакого слепого фонового «ремонта» unknown в TASK02 нет.

Запись accepted/sent может сама отказать после внешнего успеха: сохранённый sending затем классифицируется unknown, деньги повторно не списываются. Гарантия exactly-once относится к SQL-покупке, а не к межсистемной Telegram-доставке. /delete удаляет новую обычную историю; право нового generation на старое содержимое не восстанавливается. Уже выданный read/начатый HTTP отозвать невозможно.

Вопрос принимается только при явном question_consent=true, по прежнему лимиту500UTF-16 и plain text. API boolean — не готовый пользовательский consent-flow и не новое правовое основание. Реальный сбор/хранение вопроса до TASK03 и отдельного решения запрещён. Остальные условия — INSTALL_PROPOSAL и FINANCIAL_AUDIT.
