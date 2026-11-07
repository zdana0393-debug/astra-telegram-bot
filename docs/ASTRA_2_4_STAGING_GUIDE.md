# Astra 2.4: единая установка 2.4A + 2.4B через Cloudflare Dashboard

7 ноября 2026, Europe/Moscow. **План будущих ручных действий владельца после ревью, не команда к выполнению сейчас.** Codex ничего не устанавливал. Отдельно 2.4A не устанавливаем. Рабочая Astra 2.0, production и main этой разработкой не меняются.

Итог: один `release/ASTRA_2_4_WORKER.js`, сначала 0024 (если её ещё нет), затем все девять шагов 0025, затем единый Worker с обоими новыми флагами OFF. Владелец сообщил о работающей staging 2.3B/ready=true; это не удалённая проверка Codex.

## 1. Сначала подготовить возможность восстановления

1. Открыть Cloudflare Dashboard → Workers & Pages и D1. В отдельных вкладках проверить имена: **тестовый Worker** и **astra-staging-21**. Не выбирать astra-live-v2/основного бота.
2. Записать текущую версию JS, D1 binding (`DB`), имена переменных, текущий `ASTRA_FORECAST_START_DAY`, настройки Cron и webhook/allowed_updates. Не копировать секретные значения в чат, документы или screenshots. Существующий forecast start не менять.
3. Создать backup/Time Travel bookmark/экспорт в соответствии с доступными средствами аккаунта. Открыть восстановленную копию в **отдельной** базе, проверить количество профилей, суммы и оплаченные материалы. Одного наличия кнопки backup недостаточно.
4. Сохранить исходные агрегаты и полный защищённый экспорт ledger. Владелец должен знать, сколько legacy-pending договоров существует до 0025, какие балансы и оплаченные snapshot сохраняются. Не публиковать персональные списки.
5. Заранее подготовить maintenance Worker, который даёт webhook retriable 503, не подтверждает оплату/не пишет в D1, а scheduled handler не делает рассылку/записи. Это временная ручная установка только после разрешения владельца. **Не менять webhook/Cron в рамках данной задачи.** Все другие старые writer-процессы к этой базе тоже должны быть остановлены; дождаться завершения уже идущих вызовов. Telegram retries ограничены во времени: запланировать короткое окно и сверку пропущенных update/платежей.

В D1 → нужная база → Console выполнить только read-only проверки перед миграцией:

```sql
SELECT count(*) AS users,coalesce(sum(balance),0) AS balance_sum FROM astra_users;
SELECT count(*) AS ledger_rows,coalesce(sum(delta),0) AS ledger_sum FROM astra_wallet_ledger;
SELECT count(*) AS tarot FROM astra_operations WHERE reason='tarot';
SELECT count(*) AS paid_forecast FROM astra_forecast_unlocks;
SELECT count(*) AS cache_rows FROM astra_forecast_cache;
SELECT count(*) AS legacy_pending FROM astra_users
 WHERE referrer_id IS NOT NULL AND referral_rewarded=0 AND zodiac IS NULL;
SELECT count(*) AS self_reference FROM astra_users WHERE referrer_id=telegram_id;
SELECT count(*) AS missing_referrer FROM astra_users u WHERE referrer_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM astra_users r WHERE r.telegram_id=u.referrer_id);
SELECT count(*) AS inconsistent_referral FROM astra_users
 WHERE referrer_id IS NOT NULL AND referral_rewarded=0 AND zodiac IS NOT NULL;
SELECT count(*) AS bad_wallet FROM astra_users u WHERE balance<>
 (SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id);
PRAGMA foreign_key_check;
```

`self_reference`, `missing_referrer`, `inconsistent_referral`, `bad_wallet` должны быть 0; foreign_key_check — пустой. Если нет — остановиться для разбора старых данных, **не исправлять деньги/флаги автоматическим UPDATE**. Нестандартные/пустые created_at также разобрать заранее: миграция сохраняет исторические даты, не угадывает их.

## 2. Миграции при полной паузе записей

Не нажимать Deploy старого 2.4A, не применять заново 0021. В Console копировать **полный текст файлов** ниже по порядку. Один файл может содержать несколько законченных SQL statements. Если Console не принимает пакет, выполнять законченные statements последовательно, сохраняя порядок; **никогда не делить `CREATE TRIGGER ... BEGIN ... END;` по внутренним точкам с запятой**. При ошибке не продолжать и не возобновлять writers. Сверить схему/backup, завершить отсутствующий шаг, затем повторить контроль. Локальная идемпотентность не означает транзакционность нескольких нажатий Console.

Если установлена только 2.3B, как сообщил владелец:

| Порядок | Файл | Что добавляется |
|---:|---|---|
| 1 | `migrations/0024_steps/01_activity.sql` | Таблица активных дат |
| 2 | `migrations/0024_steps/02_history_index.sql` | Индекс журнала |
| 3 | `migrations/0024_steps/03_activity_guard.sql` | Защита активности |
| 4 | `migrations/0024_steps/04_activity_erase.sql` | Удаление связанной активности |
| 5 | `migrations/0025_steps/01_policy.sql` | Политика OFF, поколения профилей, события, claims/контракты |
| 6 | `migrations/0025_steps/02_legacy_snapshot.sql` | Снимок старых профилей/договоров/jobs, без денег и backfill |
| 7 | `migrations/0025_steps/03_rewards.sql` | Атомарные новые награды/двусторонние рефералы |
| 8 | `migrations/0025_steps/04_legacy_cutover.sql` | Замена старого реферального триггера и SQL guards |
| 9 | `migrations/0025_steps/05_payment_tables.sql` | Заказы, доказательства, возвраты и долги |
| 10 | `migrations/0025_steps/06_payment_credit.sql` | Однократный credit и ledger |
| 11 | `migrations/0025_steps/07_refund_debt.sql` | Компенсация и погашение долга |
| 12 | `migrations/0025_steps/08_cleanup_fence.sql` | Необратимость cutover и корректное удаление |
| 13 | `migrations/0025_steps/09_audit_retention.sql` | Audit и согласованная очистка архивов |

Если 0024 уже полная — проверить её объекты и начать с шага 5. `0024_activity_history.sql` и `0025_rewards_stars.sql` — объединённые варианты соответствующих шагов; **не требуется выполнять оба варианта**. Конкатенация девяти файлов 0025 проверяется тестом.

Важно: старый `astra_referral` удаляется и заменяется **astra_referral_policy**. До cutover он выдаёт legacy +5, после сохраняет только старые незавершённые договоры. Прежний CHECK astra_operations не расширяется; новые суммы идут через новые claims и ledger. Во время DROP/CREATE не должно быть ни одного writer. Уже установленный старый JS после этой замены намеренно получает schemaReady=false: нужен общий Worker 2.4 или maintenance.

## 3. Проверка SQL до возобновления бота

Повторить исходные counts/sums: балансы, ledger, Таро, cache и платные снимки должны совпадать с исходными; новые claims/платежи должны быть пустыми. Выполнить весь `scripts/check_integrity_2_4.sql`: **14 нулевых violations**, foreign_key_check пустой. Нельзя принимать «сумма по всем пользователям совпала» вместо сверки индивидуальных кошельков/экспорта.

```sql
SELECT version,enabled,start_day,activated,migration_done,stars_enabled,payment_scope,
       terms_version,retention_days FROM astra_policy WHERE singleton=1;
SELECT mode,status,count(*) AS contracts FROM astra_referral_contracts GROUP BY mode,status;
SELECT count(*) AS new_claims FROM astra_reward_claims;
SELECT count(*) AS new_orders FROM astra_payment_orders;
SELECT name FROM sqlite_master WHERE type='trigger'
 AND name IN ('astra_referral','astra_referral_policy');
```

Ожидание свежей установки: enabled=0/start_day=NULL/activated=0/migration_done=1/stars_enabled=0/payment_scope=NULL/retention_days=0; claims/orders=0; только astra_referral_policy. Количество legacy pending соответствует исходным договорам. Сверить все имена из `data/payment-schema-manifest.json` (77 обязательных объектов с прежними); частичная схема даёт 503. Повтор SQL локально проверен, но после будущей активации **не запускать старые миграции/снимок для «сброса»**.

## 4. Один Worker и обычный smoke без новой экономики

1. Тестовый Worker → Edit code. Вставить полностью **release/ASTRA_2_4_WORKER.js** как ES module, сохранить вручную после разрешения владельца. Никаких npm, AI-ключей или дополнительных файлов в Dashboard не требуется.
2. Проверить binding `DB` на astra-staging-21 и существующие секреты по именам. Их значения не нужны Codex. Не менять webhook, Cron и forecast start.
3. Settings → Variables and Secrets: обычные новые text flags **ASTRA_ECONOMY_V2_ENABLED=false**, **STARS_SHOP_ENABLED=false**, **ASTRA_TELEGRAM_TEST_MODE=false** для обычного staging-бота. Не задавать approval ACK для реальных Stars. `ASTRA_ECONOMY_V2_START_DAY` пока не задавать: при наличии обязана совпадать с D1. Не путать boolean true и произвольные «1/yes»: включение принимает только true/`"true"`.
4. `/health`: `ready=true`, полная схема, policy_state=legacy, policy_ready=true, stars_flag=false. Никаких токенов/ID в публичном health.
5. Синтетические отдельные профили staging: /start, знак, бесплатный прогноз/число дня, Таро −3 и повтор, extended −4 и повтор, GPT6 +5 один раз, старые бонусы +1/канал+5/реферал+5, /stop, досье/история/активность. Не искажать настоящие профили тестовыми договорами.
6. Проверить /terms, /paysupport, /payments, /privacy, callback «Правила». Магазин и старые кнопки покупки не отправляют sendInvoice. Cron/service updates не создают активные дни. /delete на отдельном профиле удаляет обычные данные.
7. Снова integrity и журнал. До ручного включения новые правила не действуют; установка сама не создаёт +12/+3.

## 5. Отдельная приёмка новых бонусов на staging

Действия ниже требуют следующего отдельного решения владельца, сейчас не выполняются. Прежде принять риск сброса бонусов после /delete из ECONOMY_SIMULATION и утвердить сами ставки.

D1 — источник даты и состояния; env — дополнительный разрешающий флаг. Переход только на **будущую** московскую дату. Подготовить согласованный env `ASTRA_ECONOMY_V2_ENABLED=true` в одобренном staging, затем административный POST `/internal/economy/policy` с `{"action":"arm","start_day":"YYYY-MM-DD"}`. Использовать реальную следующую дату, не исторический пример из тестов. При необходимости optional env START_DAY установить точно такой же. В arm встроен запрет прошедшей даты и изменения уже принятой даты. До наступления даты старые ставки; после — новые, без backfill старых посещений/балансов.

Для административных POST из браузера можно использовать DevTools в доверенном окне **этого же Worker origin**. Ключ вводится только локально, в чат не отправляется. Пример формы запроса (ниже не активирующий вызов):

```js
async function astraAdmin(path, body) {
  const key = prompt('Существующий ASTRA_ADMIN_KEY, только локально');
  const r = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type':'application/json','Authorization':'Bearer '+key},
    body: JSON.stringify(body), cache: 'no-store'
  });
  console.log(r.status, await r.json());
}
// Сначала используйте read-only status из PAYMENT_RUNBOOK.
// Не сохраняйте ключ в localStorage, URL или публикуемых журналах.
```

Наблюдать переход московской полуночи на отдельных staging-профилях. Проверить старый баланс без +12; новый профиль12; первый вход+3; первые3подряд+3; 7/14/21+5;30разных+12, включая пропуски; legacy-pending+5 и новый договор14/4 только после двух дат; канал8 без доплаты за прежние5; callback старого+1 не платит; повторы update не меняют дату и сумму. Не подделывать production-даты для ускорения теста. Симулятор 90 дней работает только локально; staging-приёмка должна проверить собственный clock/D1.

Остановка: POST `{"action":"stop"}` в policy route, затем env false. activated и дата остаются, **legacy +1/+5 не возвращаются**; материалы и расходы продолжают работать. При необходимости возобновления — сначала согласованный env true, затем `resume`. Если просто выключить env при D1 enabled после даты, health/webhook дают 503, это намеренный fail-closed, не безопасный способ продолжить старые выплаты.

## 6. Stars — отдельно, только dedicated Telegram test environment

Не включать ASTRA_TELEGRAM_TEST_MODE на обычном staging: все Bot API запросы этого Worker перейдут на `/test/`. Создать отдельные бот/аккаунты в официальной тестовой среде и отдельную D1; не использовать основного бота или astra-staging-21 совместно с другим scope. Подготовка webhook/allowed_updates для этого бота — отдельное будущее разрешение владельца, не действие Codex. Проверить фактическую доставку pre_checkout и successful/refunded_payment при текущем перечне allowed_updates; не менять его автоматически.

После проверки официальных документов и разрешения:

| Параметр | Только dedicated test environment |
|---|---|
| ASTRA_TELEGRAM_TEST_MODE | true |
| ASTRA_PAYMENT_ENVIRONMENT_ACK | DEDICATED_TELEGRAM_TEST_ENVIRONMENT_CONFIRMED |
| ASTRA_PAYMENT_POLICY_ACCEPTED | APPROVED_SUPPORT_TERMS_RETENTION, только после утверждения |
| STARS_SHOP_ENABLED | false до завершения конфигурации |

POST `/internal/payments/configure` с реальными **для этого тестового бота** `bot_id`, согласованными `support`, `terms_version`, `retention_days`. Конфигуратор проверяет getMe/ID и записывает scope=test, **оставляя магазин OFF**. ID/scope закреплены; не переиспользовать эту базу для другого бота или production. Затем после отдельного согласия env STARS_SHOP_ENABLED=true и POST `/internal/payments/shop` `{"enabled":true}`. Оба разрешения обязательны.

По PAYMENT_RUNBOOK провести только test-XTR: цена и согласие → один счёт → pre_checkout≤10s → success → одна пыль/ledger; повторы/неверные owner/amount; отказ API; расходование → refund → долг → погашение; падение D1 до/после внешнего API, повтор/refunded notice/сверка, удаление/возврат после удаления и архивирования. Записать обезличенные результаты. Выключить магазин в D1 (`enabled:false`) и env после тестов. Подтверждённые старые success/refund обрабатываются и при выключенном магазине: закрытие продаж не отменяет обязательства.

## 7. Реальные квоты и приёмка платформы

Локальные показатели — `docs/ASTRA_2_4_METRICS.json`. Node wall-clock не равен Workers CPU, statement count не равен D1 rows_read/rows_written. Сверка ограничена 5 транзакциями на вызов, наградный backlog — 5 датами, чтобы не обрабатывать неограниченную работу в одном HTTP.

В Dashboard Observability/Workers logs и D1 metrics снять: обычный cold/warm /start, первое/повторное посещение, free/extended/Tarot, history paging, pre_checkout/success/refund/reconcile и Cron. Сохранять только обезличенные метрики, без токенов/charge ID. Для каждого сценария записать число вызовов, CPU p50/p95/max, ошибки 1102/лимитов, D1 rows_read/rows_written и storage до/после; учитывать записи индексов и SQL-триггеров. Проверить пиковую параллельность/таймауты, не только один запрос.

Workers Free: проверить актуальный лимит 10 ms CPU для HTTP/Cron и остальные лимиты аккаунта. D1 Free по данному ТЗ: 5M reads/day,100K writes/day,5GB; с 01.09.2026 превышение дневных квот прекращает запросы до сброса. Перед внедрением сверить текущую документацию/тариф. Реальная D1 может иметь ограничения числа statements, CPU и размера транзакции, не проявляющиеся в SQLite. Если лимиты превышены — не открывать публичный релиз/Stars до оптимизации или согласованного тарифа.

| Проверка | Фактический результат владельца | Решение |
|---|---|---|
| Backup/restore, legacy pending, индивидуальный ledger | Не выполнено Codex | Блокирует установку |
| Реальная D1, 13 Console шагов, full schema/конкуренция | Не выполнено Codex | Блокирует принятие staging |
| Cold/warm CPU, D1 rows_*, 1102 и quota budget | Не выполнено Codex | Блокирует публичный запуск |
| Dedicated test buy/refund/recovery/10s/API schema | Не выполнено Codex | Блокирует Stars |
| Terms/support/retention/ставки и риск /delete | Не утверждено | Блокирует соответствующую активацию |

## 8. Production: только после следующего отдельного разрешения

1. Завершить review/Draft PR и все staging gates, утвердить ставки, риск злоупотреблений, Terms/поддержку/хранение. Merge/deploy не автоматические.
2. Backup **production astra-live-v2**, restore rehearsal, maintenance окно, исходные wallet/referral/purchases/cache метрики. Если production ещё 2.0 — не считать, что 0021–0023 уже установлены: по их исходным инструкциям и фактической схеме определить только недостающие миграции, включая bootstrap legacy opening и защиту сохранённых покупок. Не запускать SQL по номеру вслепую.
3. Порядок недостающих 0021→0022→0023→0024→0025 с паузой writers; сверить после каждой стадии. После 0025 старые0021/JS не возвращать. Старые данные не пересчитывать.
4. Установить один JS2.4, production DB binding, прежние рабочие настройки/секреты, **новые flags OFF**, ASTRA_TELEGRAM_TEST_MODE=false. Для предшествующей2.0 отдельно пройти существующие требования2.1–2.3B/forecast start, не теряя пользователей и купленные материалы. Не менять рабочие webhook/Cron без отдельной обоснованной авторизации.
5. Full integrity, обычный smoke/health, реальные CPU/D1. Дата policy-v2 следующая московская только после принятия. Бонусы и магазин включаются независимо.
6. **Не копировать тестовую базу в production.** Для commerce production своя конфигурация/payment_scope=production и expected bot ID, реальный support, принятые Terms/retention, отдельный `ASTRA_STARS_LIVE_APPROVED=YES_I_AUTHORIZE_REAL_STARS`, POLICY_ACCEPTED и оба shop gates только после решения владельца. Наличие строки ACK в инструкции не является разрешением реальной оплаты. Dedicated test credentials не переносить.
7. Поддерживать сверку, alerts/квоты, долговечные доказательства и помощь с возвратами; закрытие магазина не отключает входящие proofs. Не восстанавливать старый backup поверх новых подтверждённых оплат.

## 9. Остановка и откат

До 0025 можно отложить релиз без изменений данных. После начала замены триггеров — maintenance до завершения/разбора; после 0025 возврат 2.3B/2.4A JS **запрещён**: старый schemaReady преднамеренно503. Остановка новых наград — D1 policy stop, остановка продаж — D1 shop false + env false. При доступной полной схеме общий Worker продолжает расходы/материалы и обработку завершённых платежей. При повреждённой схеме — maintenance503, backup, сверка внешних событий, затем исправленная совместимая версия2.4. Не удалять claims/платежи/долги для обнуления ошибки. Наличие миграции без деплоя — не основание возобновлять старого writer.
