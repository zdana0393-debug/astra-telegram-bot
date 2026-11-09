# Astra 2.4 RC — единая тестовая установка через Dashboard

9 ноября 2026, Москва. **Это подготовленный план владельца, а не выполненный деплой.** Он заменяет установочные указания прежних стадий там, где указаны Таро3, 77 объектов, 13 Console-файлов, пропущены 0026/0027 или ожидается общий ready=true. Не менять основной бот, production, main или секреты в рамках этой работы.

## Решение о допуске

Кандидат предназначен только для **изолированного ручного staging**, оба финансовых флага OFF, без включения новой редакции по умолчанию. В коде запрещена автоматическая доставка прогнозов до согласования долговечного opt-in. Никакой env-флаг этот запрет не снимает. **NOT SAFE TO ENABLE BROADCAST; NOT PRODUCTION-READY.** Внешние настройки работающего бота разработчик не менял: запрет действует только в этой сборке после отдельно разрешённой установки.

До первого remote-действия владелец подтверждает тестовый Worker, базу **astra-staging-21**, backup/проверенное восстановление и окно обслуживания. Если текущая база не является полной 2.3B с 0021–0023, дальнейший порядок сначала пересматривается по фактической схеме. Название базы не заменяет проверку ID/binding. Если 0024–0027 уже есть, не запускать всё повторно вслепую.

## 1. Сохранить исходное состояние и испытать восстановление

1. Dashboard → Workers & Pages → **тестовый Worker**. Сохранить текущий JS/deployment ID, binding `DB`, имена существующих параметров, действующий `ASTRA_FORECAST_START_DAY`, сведения о webhook/allowed_updates и Cron. Значения токенов, HMAC/admin keys не копировать в чат, репозиторий или публичные screenshots. Не открывать `/activate`.
2. Dashboard → Storage & databases → D1 → **astra-staging-21**. Проверить database ID и binding. Снять доступный backup/Time Travel bookmark/экспорт. **Time Travel in-place не является проверенной отдельной восстановленной копией.** Не нажимать Restore исходной базы ради репетиции.
3. Создать отдельную тестовую базу для восстановления. Штатным экспортом/импортом Cloudflare восстановить в неё копию данных и прикладной схемы; не подключать эту копию к основному боту. Интерфейс Dashboard и возможности экспорта зависят от аккаунта. Если в вашем Dashboard нельзя сделать отдельную восстановленную копию, этот пункт остаётся STOP до отдельно разрешённого владельцем штатного export/import; наличие истории Time Travel не закрывает его.
4. Если для копии нужен Wrangler, ниже приведены **шаблоны для самого владельца после отдельного разрешения**, не выполненные команды Codex. SOURCE и RESTORE должны быть проверенными именами/ID; RESTORE — только новая отдельная копия. Экспорт содержит персональные/платёжные данные, хранить вне checkout с ограниченным доступом.

```sh
npx wrangler d1 export <SOURCE_STAGING_DB> --remote --output <PRIVATE_PATH>/backup.sql
npx wrangler d1 create <NEW_RESTORE_COPY>
npx wrangler d1 execute <NEW_RESTORE_COPY> --remote --file <PRIVATE_PATH>/backup.sql
```

Не использовать эти placeholders как команду миграции основного бота. Проверить актуальные процедуры по официальным [import/export D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/) и [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/); разработчик не утверждает, что проверил ваш Dashboard.

5. Сравнить исходную базу и восстановленную копию: прикладная schema (таблицы/индексы/триггеры/views), число профилей, **каждый** баланс и сумма ledger, старые оплаченные Таро, бесплатные/платные прогнозы и их тексты/версии/источники. Если платежи уже существовали — заказы обеих версий, receipts, tombstones, возвраты, долг и погашения. Общей суммы балансов недостаточно.
6. Для строгого сравнения защищённых локальных JSON-проекций подготовлен `scripts/compare-backup05.mjs`. Формат — объект, ключи которого — имена таблиц с массивами полных строк; `schema` — прикладные строки `sqlite_master` с name/type/sql, без платформенных служебных таблиц. Обязательны users, wallet_ledger, operations, tarot_requests, forecast_daily, forecast_unlocks и все astra_* таблицы, перечисленные schema. Ничего из этих персональных JSON не публиковать. Схему сравнивать до миграции с её восстановленной копией, не с уже изменённой схемой 0027.

```sh
node scripts/compare-backup05.mjs <PRIVATE_PATH>/before.json <PRIVATE_PATH>/restored.json
```

Успех — `equal:true`, одинаковые counts/SHA, кошельки сходятся. Даже отличие одного символа оплаченного текста даёт отказ. Разницу нормализации schema при экспорте сначала объясняет оператор, а не отключает проверку. Сам локальный helper **не доказывает**, что экспорт получен с верной D1; оператор фиксирует источник, backup ID, время, копию и фактический результат.

7. До SQL сверить миграции и Worker с `ASTRA_2_4_TASK_05_RELEASE_MANIFEST.json`. Записать оператора, backup ID/UTC, длительность репетиции и критерии отмены. Подготовленный `ASTRA_2_4_MAINTENANCE.js` — только 503/без записей и Bot API, он не является старым рабочим ботом.

## 2. Окно установки: остановить writers и повторить preflight

Только после отдельного разрешения владельца установить maintenance на тестовый Worker. Он возвращает webhook 503 с возможностью повторной доставки и не отправляет сообщения. Настоящие webhook и Cron settings не менять. Остановить остальные writers/admin-операции к базе, учесть другие привязанные Workers и дождаться завершения in-flight по наблюдаемым логам. Telegram retries не бесконечны: окно заранее ограничено, есть план сверки пропущенных сообщений/платежей.

Во время паузы сделать свежий согласованный backup и повторно зафиксировать агрегаты/защищённый снимок. Проверенное восстановление должно относиться к пригодной точке восстановления; старый снимок до новых платежей не годится как автоматический откат.

В D1 Console сначала определить фактическую схему:

```sql
SELECT name,type FROM sqlite_master WHERE name LIKE 'astra_%' OR name LIKE 'idx_%' ORDER BY name;
SELECT count(*) users,coalesce(sum(balance),0) balance_sum FROM astra_users;
SELECT count(*) rows,coalesce(sum(delta),0) delta_sum FROM astra_wallet_ledger;
SELECT count(*) old_paid_tarot FROM astra_operations WHERE reason='tarot';
SELECT count(*) cached_forecasts FROM astra_forecast_daily;
SELECT count(*) paid_forecasts FROM astra_forecast_unlocks;
SELECT count(*) bad_wallet FROM astra_users u WHERE balance<0 OR balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id);
SELECT count(*) bad_created_at FROM astra_users WHERE datetime(created_at) IS NULL;
PRAGMA foreign_key_check;
```

`bad_wallet`, `bad_created_at` — 0, FK ошибок нет. Сохранить индивидуальные данные локально, а не только эти суммы. Таблица кэша — **astra_forecast_daily**, не astra_forecast_cache из прежней инструкции.

Если 0025 уже есть, **до 0026** проверить astra_policy: `enabled=0`, `activated=0`; продажи тоже остановлены. При уже активировавшейся 0025 — STOP, отдельный переход. Не сбрасывать activated/start_day ради обхода CHECK. Если есть 0026, проверить её фактическое состояние; уже прошедший cutover не возвращать вручную в legacy. Не исправлять данные UPDATE balance и не удалять ledger/права/долг.

## 3. SQL0024 → 0025 → 0026 → 0027

Dashboard → D1 → проверенная staging-база → **Console**. Writers остаются остановленными. Применить только отсутствующие полные стадии, каждый файл целиком. Всего при основе 2.3B — **23 Console-файла**; список ниже формируется из фактического каталога миграций.

| № | Стадия | Файл |
|---:|---|---|
| 1 | 0024 | `migrations/0024_steps/01_activity.sql` |
| 2 | 0024 | `migrations/0024_steps/02_history_index.sql` |
| 3 | 0024 | `migrations/0024_steps/03_activity_guard.sql` |
| 4 | 0024 | `migrations/0024_steps/04_activity_erase.sql` |
| 5 | 0025 | `migrations/0025_steps/01_policy.sql` |
| 6 | 0025 | `migrations/0025_steps/02_legacy_snapshot.sql` |
| 7 | 0025 | `migrations/0025_steps/03_rewards.sql` |
| 8 | 0025 | `migrations/0025_steps/04_legacy_cutover.sql` |
| 9 | 0025 | `migrations/0025_steps/05_payment_tables.sql` |
| 10 | 0025 | `migrations/0025_steps/06_payment_credit.sql` |
| 11 | 0025 | `migrations/0025_steps/07_refund_debt.sql` |
| 12 | 0025 | `migrations/0025_steps/08_cleanup_fence.sql` |
| 13 | 0025 | `migrations/0025_steps/09_audit_retention.sql` |
| 14 | 0026 | `migrations/0026_steps/01_policy_fences.sql` |
| 15 | 0026 | `migrations/0026_steps/02_awards.sql` |
| 16 | 0026 | `migrations/0026_steps/03_days_commands.sql` |
| 17 | 0026 | `migrations/0026_steps/04_cutover_legacy.sql` |
| 18 | 0026 | `migrations/0026_steps/05_tarot.sql` |
| 19 | 0026 | `migrations/0026_steps/06_payment_versions.sql` |
| 20 | 0026 | `migrations/0026_steps/07_refunds_cleanup.sql` |
| 21 | 0027 | `migrations/0027_steps/01_queue.sql` |
| 22 | 0027 | `migrations/0027_steps/02_delivery_guards.sql` |
| 23 | 0027 | `migrations/0027_steps/03_cleanup.sql` |

Объединённые `0024_activity_history.sql`, `0025_rewards_stars.sql`, `0026_economy_fence.sql`, `0027_broadcast.sql` — альтернативы тем же шагам, не второй круг установки. Конкатенации проверены тестами. Не делить CREATE TRIGGER по внутренним точкам с запятой, не копировать Markdown в Console. IF NOT EXISTS не исправляет неправильный объект с тем же именем. Много кликов Console не являются одной общей транзакцией.

При ошибке — maintenance, сохранить код/текст ошибки без персональных строк, установить последний завершённый statement, проверить схему. Не продолжать следующую стадию вслепую. После решения причины завершить только нужные полные шаги; не DROP TABLE ради чистоты. В 0025 снимается старый реферальный trigger, 0026 заменяет финансовые writers, 0027 добавляет outbox; старый Worker после этого не является штатным откатом.

**0028 в этой установке нет.** Имеется только предложение в CONSENT_PROPOSAL; оно требует отдельного решения и реализации. Никаких SQL из примеров предложения не выполнять.

## 4. Контроль до открытия ручного доступа

Сравнить защищённые старые строки и агрегаты с точкой паузы: balances/ledger/старые paid Таро/cache/unlocks не меняются от миграций. Новые tables без backfill, по свежей установке enabled/activated=0, start_day=NULL, stars_enabled=0, migration_done=1 у старого/нового policy и broadcast runtime. Если это не свежая установка, нули не выдумывать — проверить фактическую историю.

Выполнить read-only `check_integrity_2_4_task01.sql`, `check_integrity_broadcast03.sql`, `check_integrity_2_4_task05.sql`. Все violations и mismatch — 0; missing_object отсутствуют, FK ошибок нет. Базовый manifest — **126 объектов**, очередь дополнительно **11**. Последний SQL включает preflight flags OFF, его не использовать как универсальную норму после будущей разрешённой активации.

## 5. Один Worker через браузер, без активации

1. Workers & Pages → тестовый Worker → Edit code. Вставить целиком `release/ASTRA_2_4_WORKER.js` как ES module. Не смешивать со старым JS и не вставлять SQL. Дополнительные модули/npm/LLM-ключи в Dashboard не нужны.
2. Проверить `DB → astra-staging-21`, прежний bot token/webhook secret/admin secret по **именам**, BOT_USERNAME и текущую дату запуска 2.3B. Значения ключей остаются только у владельца. Не заходить на `/activate`, не вызывать setWebhook/setMyCommands.
3. `ASTRA_ECONOMY_V2_ENABLED=false`, `STARS_SHOP_ENABLED=false`; соответствующие DB flags тоже OFF. `ASTRA_ECONOMY_V2_START_DAY` и `ASTRA_FORECAST_COMPACT_START_DAY` не задавать автоматически. Существующую ASTRA_FORECAST_START_DAY не переносить. В обычном staging ASTRA_TELEGRAM_TEST_MODE=false; название «тестовый бот» само по себе не делает Stars тестовыми.
4. После отдельного разрешения владельца Deploy **только staging**. Сохранить deployment ID и SHA артефакта; вернуть ручной доступ лишь после проверок ниже. Ничего не включать на основном боте.

### Как читать /health этого RC

Общий статус **503 и ready=false здесь намерен**: согласие на автоматическую рассылку не реализовано. Это не основание возвращать старый Worker.

| Поле | Ожидание / смысл |
|---|---|
| version | ASTRA-2.4-task05-rc |
| schema_ready | true при полной базовой схеме 126 |
| broadcast_schema_ready | true при всех 11 объектах0027 |
| free_content_ready | true при доступной D1 и базовой схеме |
| manual_content_ready | true при технической готовности ручных запросов/конфигурации |
| broadcast_ready / broadcast_delivery_allowed | false всегда в этом RC |
| broadcast_blocker | CONSENT_REGISTRY_NOT_APPROVED |
| broadcast_consent_implemented | false |
| public_ready / ready | false |
| release_scope | STAGING_MANUAL_ONLY |
| broadcast_prerequisite_blocker | Дополнительная старая причина, например неполная0027; не теряется за STOP-SHIP |
| stars_flag | false |
| policy_state | legacy для свежего OFF-кандидата, без запланированного cutover |

При отсутствии HMAC key/утверждённого notice `bonus_fence_ready=false` и соответствующий безопасный blocker. Это отдельно от ручного бесплатного контента. Не добавлять фиктивный ACK ради зелёного health. Публикация /privacy не доказывает правовое основание; admin ACK не является согласием пользователя.

До одобрения notice/key бонусные начисления заблокированы. После отдельной законной настройки даже при новых flags OFF могут действовать прежние защищённые +2/+1/+5; OFF не означает полную остановку всей старой экономики. Настройка key/notice/bootstrap описана в TASK_01_MIGRATION и требует отдельного решения; ключей в этом задании не запрашивали.

## 6. Ручной smoke и реальные измерения

Пройти `ASTRA_2_4_TASK_05_MANUAL_CHECKLIST.md` только своими staging-профилями. Проверить старый баланс/покупки, бесплатный прогноз/число, карту, новый Таро5 и подтверждение, расширенный4 и бесплатные повторы, stale callback3 без скрытого списания, шесть меню, историю/пагинацию, уведомленияOFF, правдивые /privacy/terms/support. Не создавать фиктивные деньги SQL-обновлением; если без approved бонусов тестовому профилю не хватает пыли, проверить недостаток и ранее оплаченные материалы, затем согласовать отдельный способ тестового финансирования.

Настоящая автоматическая доставка **не должна произойти** даже для старых ON или после кнопки подтверждения. Код блокирует её в трёх местах; UI говорит о паузе. При уже существующем Trigger scheduled сохраняет только ограниченную служебную очистку под lease и HMAC-purge, без выборки адресатов/генерации/Telegram HTTP. Новые Trigger, UTC-расписание или webhook здесь не включаются и не меняются.

В Cloudflare Observability/Metrics измерить реальные CPU (10ms Free), subrequests/SQL statements/HTTP, 1102 и другие ошибки; D1 Metrics/Analytics — rows_read/rows_written, storage на одну базу (проектный порог500MB) и суточные квоты. Снять cold/warm p50/p95/max, количество вызовов и baseline до/после изолированной серии, без токенов/ID/текстов. first() может не иметь meta, rows_complete=false не означает нулевые расходы. Node VM timing не равен CPU Cloudflare. Актуальные квоты сверяет владелец по кабинету и [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

На final blocked Cron локально до6 D1 calls/9 statements, 0 HTTP; это **не испытание массовой доставки**. Прежняя рабочая модель очереди давала47/50 statements+HTTP и проверяла8/20/100/403/429/unknown в локальных тестах. После отдельного утверждения0028 нужно заново проверить SQL gate+preflight+race и реальный бюджет, возможно уменьшить партию. Пока этого нет — рассылку не включать.

По завершении smoke повторить integrity, сохранить обезличенный протокол, оставить оба flags OFF и не назначать дату новой редакции.

## 7. Безопасное исправление после сбоя

1. Остановить writers согласованным maintenance, не «чинить» пользователя старым Worker. Зафиксировать deployment/schema/последний успешный SQL и создать дополнительную копию текущего состояния до любых исправлений.
2. После начала0025 и тем более0026/0027 обычный rollback на2.3B/2.4A/старый2.4 запрещён. Не восстанавливать снятые triggers, не убирать CHECK, не удалять ledger/fences/долг и не переписывать cache/paid.
3. Если только часть схемы применена — сравнить конкретные definitions с manifest и причиной ошибки. После ревью завершить недостающие шаги либо подготовить совместимое исправление вперёд; IF NOT EXISTS не ремонтирует неверную definition.
4. Полный restore возможен лишь после отдельного решения, при остановленных writers и сверке **всех** событий после backup. Новые оплаченные материалы, бонусные права/отзывы, платежи/возвраты нельзя потерять откатом. Старый backup не должен незаметно восстановить удалённых пользователей или позволить повторить уже выплаченное.
5. Подтверждённая оплата с временно пустой D1: штатный retry/проверенная transaction reconciliation, не второй счёт. Внешний refund с незаписанной компенсацией: сохранить неопределённость, сверить Telegram/notice, провести её единожды, не повторять API refund только из-за отсутствия ответа D1. Входящие законные proof/refund обрабатываются и при закрытом магазине; закрытие продаж не отменяет обязательства.
6. Восстановление HMAC требует подходящих текущих/предыдущих keys, очистки по сегодняшнему UTC без продления expiry и сверки поздних начислений. Утраченную историю нельзя объявить восстановленной; не обходить safety hold.
7. После исправления — полный integrity, прежние тексты и баланс, закрытый магазин, заблокированная рассылка, ручной smoke и реальный бюджет. Только владелец решает о снятии maintenance. До0025, если несовместимые SQL ещё не начинались, план отмены рассматривается отдельно по фактической уже применённой0024.

Production, реальные Stars, новая экономика, окончательный opt-in/Cron и merge требуют отдельных решений после выполненных staging gates. Этот документ их не разрешает.
