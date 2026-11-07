# Codex — Astra 2.4A: история звёздной пыли и учёт активности

**Working branch:** astra-2.4-economy (base astra-2.3b-forecast-engine, hardening commit 2d73738). Никаких деплоев, remote SQL, webhook/cron changes, main/production modifications, реальных токенов или Stars-инвойсов.

## Обязательное чтение перед кодом

1. docs/ASTRA_2_4_ECONOMY_PLAN.md **целиком**. Это главное ТЗ по 2.4A и граница между 2.4A и 2.4B.
2. docs/ASTRA_3_0_SPEC_v0_2.md: §§ 2, 3, 10, 11, 12, 15, 16, 17, 18. Значения новых бонусов ещё **не утверждены**.
3. docs/ASTRA_2_3_EDITORIAL_STANDARD.md, включая раздел 9: стиль Астры и FAQ.
4. release/ASTRA_2_3B_WORKER.js, src/forecast, tests/forecast-engine.test.mjs, scripts/build-2.3b.mjs и весь скрипт test-2.3b.sh.
5. src/02_SCHEMA.sql, migrations/0021_wallet.sql, 0022_shell.sql, 0023_forecast.sql, 0023_steps, scripts/check_integrity_2_3b.sql, docs/ASTRA_2_3B_ARCHITECTURE.md, docs/ASTRA_2_3B_STAGING_GUIDE.md, AGENTS.md.

Внимание: владелец сообщил, что **2.3B уже установлен на тестовый Worker, но включение нового гороскопа ещё не наступило**. Реальная работоспособность после cutover пока не подтверждена. В этом задании **не обращаться к Cloudflare и Telegram**. Перед будущим ручным внедрением 2.4A попросить владельца проверить 2.3B на staging, см. план.

## Реализовать только Astra 2.4A

1. Полная история пыли из ИСТИННОГО astra_wallet_ledger: 10–15 записей, удобная пагинация по одной странице, названия причин и точные даты/суммы, старый opening как исторический snapshot, сохранённый текущий баланс. Без чужих ID, без неограниченного OFFSET и переполнения callback_data. Сохранить старые записи без переписывания.
2. Учет дней реальной активности в личном чате: одна строка на telegram_id + московскую дату, верный расчет серии и общего числа активных дат, 3/7/30 — **этапы наблюдения без нового денежного бонуса**. Игнорировать Cron, доставки гороскопов и повторы Telegram updates. Никаких выдуманных дат до установки. Пропуск обнуляет серию, но не расходует пыль.
3. Кнопки и живой интерфейс в разделах «Звёздная пыль» и «Досье», навигация Назад/Главное меню, взрослый стиль. /privacy и /delete должны реально учитывать новую таблицу.
4. Аддитивная миграция 0024: table/idx/cleanup trigger с FK OFF, индекс истории; не менять CHECK/триггеры и schema контракт 0021–0023. Новый Worker должен требовать 0024 в schemaReady и безопасно ошибаться, если применена лишь часть миграции; прежний 2.3B должен иметь возможность временного rollback JS.
5. Никаких новых денег, наград, цен, «+3 ежедневно», «+12 при старте», delayed referrals, новых easter eggs, платных карт или реальных Telegram Stars. Текущая экономика должна сохраниться байт-в-байт по результату: старт 2, день 1, реферал 5, канал 5, GPT6 5, Tarot -3, extended -4. Не приводить будущие цифры в интерфейсе как действующие.
6. Сохранить 2.3B forecast version/cache/immutable paid unlock, все старые команды, callbacks, secrets/env, webhook, Cron, TZ и шестикнопочное меню. Не разбирать release JS руками, когда уже есть сборщик: сделай поддерживаемую сборку по образцу scripts/build-2.3b.mjs, и при этом доставь готовый **release/ASTRA_2_4A_WORKER.js**, single-file ES module для Cloudflare Dashboard.

## Проверки

- Запустить всю регрессию из scripts/test-2.3b.sh, плюс новые тесты 2.4A; не заменять её более слабым smoke-тестом.
- Тест большой истории 100–500 операций, границ страниц, повторов, моментальной появления новой записи при листании, доступ только к собственным операциям, неизвестных reason и opening snapshot.
- Месячные и 90-дневные серии, московская полночь, 31.12→01.01, 29.02, пропуск и восстановление; не регистрировать автоматические рассылки и Telegram retries как активность.
- 20 конкурентных обращений одной даты дают одну activity row, без лишних начислений.
- /delete FK ON/OFF и regression rollback Worker 2.3B при новой таблице, orphan SQL=0.
- Новая миграция повторяема и разделена на отдельные Console-friendly шаги; пустой/неполный schemaReady — HTTP 503.
- Баланс=ledger на каждом этапе. Новые события активности **не изменяют баланс**; сравнить старые awards/prices/полученные snapshots.
- Оценить CPU overhead и D1 rows_read/written, а не заявлять гарантированную бесплатность без реальных замеров. Оценить дополнительную запись/день/пользователь и стоимость history queries. Проверить отсутствие потери Telegram функций из-за добавочного запроса.

## Сдать в GitHub

- release/ASTRA_2_4A_WORKER.js + модульные исходники/сборку;
- migrations/0024_activity_history.sql и migrations/0024_steps/*.sql;
- scripts/check_integrity_2_4a.sql, scripts/test-2.4a.sh;
- tests на историю, активность, миграцию и совместимость;
- docs/ASTRA_2_4A_ARCHITECTURE.md, docs/ASTRA_2_4A_HISTORY_EXAMPLES.md, docs/ASTRA_2_4A_TEST_REPORT.md, docs/ASTRA_2_4A_STAGING_GUIDE.md, docs/ASTRA_2_4A_PR.md;
- обновить README и docs/ASTRA_CURRENT_STATE.md только в этой ветке, отделяя «реализовано в GitHub» от «установлено на staging».
- Draft PR base=astra-2.3b-forecast-engine, head=astra-2.4-economy. Если GitHub API Forbidden — оставить корректную ссылку, ChatGPT создаст PR. Никакого merge.

## 2.4B — проектные выводы, не реализация

В отдельном разделе ARCHITECTURE опиши план перехода к предложенным размерам бонусов без двойного начисления; особенно старый astra_referral. Отдельно зафиксируй маршрут Stars XTR: sendInvoice→pre_checkout_query→answerPreCheckoutQuery≤10s→successful_payment→уникальный charge ID→ledger, /paysupport и возвраты через refundStarPayment с проблемой distributed compensation, тестирование **только в Telegram test environment**. Не включать интерфейс настоящих платежей в 2.4A, не отправлять счетов. На следующих этапах утвердим новые ставки и уже после этого реализуем 2.4B.

Итог Codex — по-русски, с конкретными файлами, тестами, известными ограничениями и инструкции для владельца по установке только после успешного теста 2.3B.