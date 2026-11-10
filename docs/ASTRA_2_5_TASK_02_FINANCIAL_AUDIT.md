# TASK02 — карта существующих финансовых путей и решение 0029

10 ноября 2026. Аудит выполнен по исходникам/SQL и финальному Worker 2.4; работающий бот и облачная база не исследовались. Истина — фактические CHECK и триггеры, а не старые предложенные тарифы спецификации3.0.

| Путь | Фактическая запись / SQL-граница | Идемпотентность / чтение |
|---|---|---|
| v2.1 / старый Таро3 | astra_operations: reason IN daily/channel/referral/tarot; tarot только delta=-3 и result NOT NULL. astra_operation_guard/post проверяет остаток, меняет баланс и пишет ledger одной вставкой | operation_id PK, ledger.idempotency_key PK/operation_id UNIQUE; astra_tarot_requests связывает меню с операцией. Literal result не перетасовывается |
| Журнал /2.4A | astra_wallet_ledger.delta/telegram_id/reason, operation_id nullable. Новое CHECK astra_operations не расширяется | balance=SUM(delta), balance>=0. history index по owner/date/key; пагинация не даёт право на чужую строку |
| 0026 / Таро5 | astra_tarot_offers26(price DEFAULT5 CHECK=5, generation, request_key); purchases26(price CHECK=5,result). guard проверяет текущий generation и balance>=5; post делает balance-5 и ledger reason tarot:v2 | UNIQUE(owner,generation,request_key), purchase PK offer_id, immutable paid fields. payTarot26 повторно читает сохранённый результат и отдельно захватывает delivery lease |
| Forecast4 | astra_forecast_daily immutable; unlocks PK(user,MSKday), price4. guard/post атомарно создаёт snapshot, balance-4 и ledger | operation_id=NULL, reason forecast:extended. Смена текущего текста не меняет paid snapshot |
| Update jobs | astra_processed_updates/update_jobs: claim working/done, lease, stable per-update target | Повторы Telegram не повторяют бизнес-операцию. Это транспортная защита; новая покупка всё равно имеет собственный SQL PK |
| Награды /HMAC26 | astra_bonus_commands/awards/fences, generation и HMAC-domain права; SQL award+ledger атомарны | Старые номиналы/новый cutover, 30 дней, удаления/погашение долга — прежние. Новый Таро не создаёт наград и не использует HMAC как платежный ключ |
| Stars | orders/receipts/tombstones + версии26 и views astra_all_orders26/all_receipts26; credited_dust, immutable charge proof | Один charge/order, ledger stars:hash. Invoice/pre_checkout сами пыль не начисляют; повторные/поздние proofs обрабатываются старым кодом |
| Refund/debt | external_refunds→settlements; доступная пыль снимается, недостаток становится debt; positive ledger кредит погашает debt | notice/settlement/repayment immutable. Новая отрицательная запись tarot:v25 не включает positive-debt trigger; возврат и покупка сериализуются SQL |
| consent28 /Cron | Отдельные proof/revision/nonce, outbox/lease/cooldown; три SQL gate. Финансовых начислений от Cron нет | Доставка OFF/quarantine; новое Таро не является согласием на рассылку и не меняет её очередь |

`src/task01/ui.mjs` и сгенерированный Worker подтверждают два отдельных старых read-пути: операции3 и purchases26 за5, включая recovered undelivered. Изменять старые CHECK или routing ради многоформатного Таро нельзя. `src/economy/history.mjs`, rewards/policy, task01/payments, payments/service и SQL0023/25/26 сверены для ledger/recovery/удаления.

## Решение

0029 добавляет отдельные runtime/prices/offers/purchases и триггеры, не ALTER/DROP прежних объектов. Старый astra_operations не используется для новых дебетов; ledger.operation_id=NULL, reason='tarot:v25', key='tarot25:'+offer_id. Цена берётся из замороженной серверной версии тарифов и копируется в offer, затем purchase; callback не передаёт цену.

Сначала создаётся серверный sealed draft с полностью готовыми draw/text/versions. Клиентскому слою prepareOffer возвращает только quote DTO, без неоплаченного текста. При нескольких одновременных prepare могут вычислиться проигравшие кандидаты, но UNIQUE сохраняет только одного победителя до списания. Победивший snapshot не заменяется. Confirm не вызывает карточный RNG ни до, ни после commit: INSERT SELECT копирует сохранённое, trigger в той же транзакции меняет баланс и ledger. Потерянный ACK после commit исправляется чтением существующей paid-строки, а не новым списанием.

Время предложения15 минут; его request_key/update_id/generation, версия и ревизия политики неизменны. Повтор одного prepare должен передавать тот же stable request_key и исходный update_id; другой запрос требует нового ключа. Отключение или смена тарифной политики увеличивает revision: старый неоплаченный quote не оживает после повторного включения. Политика бонусов2.4 не переоценивает sealed цену; решение о покупке всегда проверяет свежий остаток SQL.

Реестр тарифов содержит только локальную предварительную схему5/8/14/21/32. Env ASTRA_TAROT25_ENABLED и SQL enabled по умолчанию OFF. Оба нужны для новой продажи. Оплаченные чтения и повторное подтверждение существующей покупки доступны при OFF, при доказанном owner/current generation. Изменять неподтверждённые цены для реального выпуска можно только после решения владельца и новой версии политики.

Legacy3/5 не backfill-ятся: отдельный reader отдаёт literal result из исходной таблицы, history объединяет три источника с namespace ключами. Старый legacy3 не содержит исторического generation: право опирается на живой owner и проверенную старую схему удаления. В нормальной полной схеме /delete стирает эти строки; восстановление чужих/старых orphan из повреждённого backup не считается допустимой миграцией.

## Границы доказательства

Триггеры защищают от прикладных INSERT/UPDATE/DELETE/OR REPLACE, конфликтов и гонок. Администратор с правом DROP/PRAGMA writable_schema может изменить любую бухгалтерию; это не модель пользовательского callback. Adapter сверяет фактические DDL всей базы и цены, runner отдельно закрывает partial/foreign schema. Структурно верный snapshot не является криптографическим доказательством генерации/оплаты; генератор и authenticated actor передаются доверенным серверным слоем, права на paid-чтение проверяет D1 JOIN.

Новая схема сохраняет paid/draft/question до удаления профиля, без скрытого реестра ID после /delete. 15 минут — срок пригодности quote, а не обещание физического стирания вопроса через15 минут. Реальные согласие/retention/backup для вопроса нужно утвердить до активации; отдельный API boolean не заменяет будущий добровольный UI. Старые необходимые платёжные records/debt сохраняются по существующей политике, которую этот модуль не переписывает.
