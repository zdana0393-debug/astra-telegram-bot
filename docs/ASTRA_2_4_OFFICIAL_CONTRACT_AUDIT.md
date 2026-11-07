# Astra 2.4: проверка официальных контрактов Telegram и Cloudflare

7 ноября 2026, Europe/Moscow. Прямые HTTPS-запросы к core.telegram.org и developers.cloudflare.com отклонены сетевым proxy (CONNECT403). Вместо предположения о текущем API прочитаны **публичные официальные исходники** на GitHub с закреплёнными коммитами. Никаких запросов к боту, getMe реального бота, инвойсов, Cloudflare account API или D1 не выполнялось.

Источники и SHA-256 загруженных файлов — `ASTRA_2_4_OFFICIAL_SOURCES.json`. Это проверка исходного контракта; она не доказывает, какая версия работает на конкретном Bot API endpoint, и не заменяет dedicated test environment.

## Telegram Bot API

Официальный репозиторий tdlib/telegram-bot-api, commit **e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1**:

- [Client.cpp](https://github.com/tdlib/telegram-bot-api/blob/e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1/telegram-bot-api/Client.cpp): сериализация объектов, обработчики методов, разрешённые типы updates.
- [HttpConnection.cpp](https://github.com/tdlib/telegram-bot-api/blob/e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1/telegram-bot-api/HttpConnection.cpp): разбор `/bot<TOKEN>/test/<method>` с отдельным test DC.

| Контракт | Что подтверждает официальный исходник | Кандидат и остаточная проверка |
|---|---|---|
| pre_checkout_query | JsonPreCheckoutQuery: строковый id, from, currency, total_amount, invoice_payload; process_answer_pre_checkout_query_query: pre_checkout_query_id,ok,error_message при отказе | Поля совпадают; owner/price/scope/snapshot проверяются. Бюджет 6s включает schemaReady и заказ, затем API2,5s. Внешний SLA10s задан ТЗ/публичным стандартом, сам endpoint и полную задержку проверить в dedicated test |
| successful_payment | JsonSuccessfulPaymentBot выдаёт currency,total_amount,invoice_payload,telegram_payment_charge_id; поле находится внутри message | Credit только по проверенному service proof, уникальной charge и SQL receipt; изменение update_id не повторяет кредит |
| refunded_payment | JsonRefundedPayment выдаёт те же основные идентификаторы; provider_payment_charge_id может отсутствовать; событие внутри message | Не требуем необязательный provider charge; компенсация однократна, в том числе после API/D1 сбоя и удаления |
| getStarTransactions | Метод принимает offset≥0,limit1…100. JsonStarTransaction выдаёт **положительную magnitude amount** и source для поступления либо receiver для расхода/возврата; nanostar_amount отдельно. Invoice partner: type=user,transaction_type=invoice_payment,user,необязательный invoice_payload | limit5; по receiver не требуется отрицательный amount. Отрицательные суммы и дробные invoice-суммы — needs_review, без округления/кредита. amount=0 + nanostar тоже сохраняется как неподдерживаемый случай |
| refundStarPayment | Обработчик требует user_id и telegram_payment_charge_id и возвращает Ok через callback | Один API-вызов по lease, true→notice/settlement; timeout/D1 outage→сверка. Не объявляется общей транзакцией с D1 |
| Invoice fields | get_input_message_invoice читает UTF-8payload,currency,prices,provider_token,start_parameter | XTR,одна цена,пустой provider_token по ТЗ. Добавлен непустой start_parameter=stars для пересланных сообщений; старые пересланные invoices всё равно проходят owner-check. Полную норму цифровых товаров/цен/возвратов сверить с платежной страницей до торговли |
| Dedicated test | HttpConnection распознаёт сегмент /test и is_test_dc | ASTRA_TELEGRAM_TEST_MODE меняет endpoint всех BotAPI-вызовов. Отдельные бот/аккаунты/token/base,pinned bot ID и ACK. Имя staging ничего не доказывает |
| allowed_updates | get_update_type_name включает message,callback_query,pre_checkout_query. Отсутствие нового списка сохраняет прежнюю маску; вложенные поля платежей — не отдельные update types | Нужны message + callback_query для интерфейса и pre_checkout_query для checkout. **Не добавлять successful_payment/refunded_payment как отдельные типы**. Существующий webhook/список не менялись |

Официальные страницы для будущей внешней проверки: https://core.telegram.org/bots/payments-stars , https://core.telegram.org/bots/api , https://core.telegram.org/bots/features . Загрузка исходников дала независимую опору для полей и методов, но не гарантирует коммерческую пригодность: действующие правила Stars, реальные refunds, доставка service updates, deadline, аккаунты тестовой среды и поведение Cloudflare ещё не испытаны.

Особенность source/receiver: расходы Stars бывают не только возвратами. Код рассматривает только user/invoice_payment, остальные категории не превращает в refund пыли. Для пропавшего payload использует ранее сохранённый receipt; неизвестный invoice-платёж остаётся для поддержки. Offset требует перекрывающихся страниц при новых транзакциях. Реальная сверка должна подтвердить charge id и отрицательный/положительный знак на фактическом тестовом endpoint.

## Cloudflare Workers Free / D1

Официальный репозиторий cloudflare/cloudflare-docs, commit **53ce9b502646fdc019b8184b29b9f1054939e1b6**:

- [D1 limits](https://github.com/cloudflare/cloudflare-docs/blob/53ce9b502646fdc019b8184b29b9f1054939e1b6/src/content/docs/d1/platform/limits.mdx).
- [Workers limits](https://github.com/cloudflare/cloudflare-docs/blob/53ce9b502646fdc019b8184b29b9f1054939e1b6/src/content/docs/workers/platform/limits.mdx).

Подтверждены **10ms CPU** для HTTP и Cron; **50 D1-запросов на invocation**; **500MB на одну Free-базу** и **5GB суммарно на аккаунт**. Старое указание 5GB без разграничения исправлено в текущих инструкциях. Исторические отчёты 2.4A остаются документами прежнего этапа, а не текущим нормативом.

D1-документация отдельно указывает: `db.batch()` считается одним query против лимита invocation, хотя statements/внутренние reads/writes продолжают учитываться и имеют собственные ограничения. Поэтому batch не делает записи «бесплатными» и не устраняет CPU/storage/суточные квоты. Максимум LIKE/GLOB pattern50bytes объясняет замену 64-символьного hash-LIKE на индексируемый диапазон. Time Travel Free7 дней требует своевременной самостоятельной стратегии backup; это не бессрочная история восстановления.

Локальные ограничения вызовов проверены отдельным fake cap50, без JS-мьютекса: холодный Cron8 знаков был 55D1 вызовов, стал 35. С одной прогретой записью прежний сценарий был 53. Сохраняются 8 адресатов, тексты, claim/delivery/status и окноCron. Бюджет Telegram fetch измеряется отдельно (8mocked calls), не подменяется D1 counter. Реальные CPU/1102/rows_*/500MB и ежедневный бюджет всё ещё не измерены; протокол — ASTRA_2_4_PLATFORM_BUDGET.md.
