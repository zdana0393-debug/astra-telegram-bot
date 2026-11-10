# ASTRA 2.5 TASK04 — локальный переход исходной2.0 → 2.5

10 ноября2026, Москва. Работа в `astra-2.5-tarot`, получен подготовительный HEAD `d8c69239adcc3a2b57ca33d9cc980cce5807a66a`, база TASK03 — `222bc0828501d05fd21df20b41d2b053e404f69c`. SHA реализации — коммит, содержащий этот отчёт; он будет сообщён после обычного push.

## Итог

Созданы local-only мигратор, синтетическая исходная2.0, воспроизводимая репетиция, проверенные отдельные backup/restore, manifest всех этапов, recovery/finance/Worker/cost tests и проект дальнейшего runbook. На допустимом синтетическом исходнике **2.0→0021→…→0029 выполнен полностью**, без изменения профилей, балансов или обработанных update_id и без новых наград. Повтор не переписывает данные.

**Приёмка реального выпуска не пройдена.** Найдены и явно воспроизведены несовместимая ссылка на удалённого реферера в допустимых данных2.0 и путь ошибок с49/50операций. Первый требует решения о совместимости, второй — отдельного UI hardening/решения по запасу. Старая частичная staging0026 не использовалась. Реальное состояние production2.0 неизвестно. Cloudflare, remote D1, Telegram, платежи, секреты, webhook/Cron, main, PR/merge не затрагивались. TASK05 не начинался.

## Что реализовано

- `scripts/astra25-upgrade-local.mjs`: только `--local-only`, явные абсолютные SQLite source/output, `--plan`, `--writers-paused`, проверяемый `--resume`. Source readOnly, output — другая копия, symlink/hardlink/URI/перезапись входа/существующего output/downgrade отвергаются. Нет remote/bindings/авторизации/Cloudflare SDK/произвольного SQL.
- Native SQLite backup и отдельный restore-proof до миграций; integrity/FK/DDL/version/data и SHA проверены. Одного наличия backup недостаточно. Неисправное доказательство останавливает процесс. Частные файлы0600, каталог0700.
- Применение **девяти настоящих полных SQL** через native parser/exec, по одному BEGIN IMMEDIATE/COMMIT. Ни split(';'), ни ручных completion-значений, ни отключения constraints, ни скрытого IF NOT EXISTS repair. Исходная02_SCHEMA выполняется лишь при создании новой фиктивной2.0.
- Журнал записывает before и prepared-after fingerprints до COMMIT. После сбоя либо доказан rollback, либо полностью завершённый шаг, либо STOP при иных данных. PID-lock не снимается с живого процесса. Неоднозначность не лечится restore поверх базы.
- Manifest с SHA источников, порядком, точным и нормализованным DDL, количеством объектов и pinned candidate. Старые completion-флаги дополняются фактическим post-check, а не объявляются доказательством сами по себе.
- Preservation всех ранее существовавших таблиц, rowid и sqlite_sequence, профилей/processed updates, ledger и UTF-8 текста. Финансовые/FK проверки на каждом этапе. Пишущий старый2.0 запрещён политикой инструмента, а реальная остановка writers остаётся обязанностью оператора.
- Только read-only preview предполагаемой retention draft: явный период, ограниченная партия, без текста/идентификаторов. Очистка не включена и не реализована без решения владельца.
- Pinned Wrangler4.45.0 offline `deploy --dry-run`, фиктивный binding/пустой изолированный config home, без credentials/Cron/metrics. Скомпилированный модуль импортируется и исполняет2 дополнительных локальных integration tests.

Финансовые правила, каталог/движок/reader, цены, текущие Workers, миграции0021–0029 и все прежние тесты **побайтно неизменны**. Изменения TASK04 — только новые файлы. Проверено через Git diff относительно TASK03 и SHA. Это не переписывание2.5-кандидата.

## Проверенная последовательность

| Этап | Объектов DDL |
|---|---:|
| Исходная2.0 |3|
| 0021 |17|
| 0022 |21|
| 0023 |30|
| 0024 |34|
| 0025 |82|
| 0026 |131|
| 0027 |142|
| 0028 |158|
| 0029 |183|

Manifest: `data/astra25-upgrade-plan.json`, SHA плана `593200c7d3ccdd9ee140fec081f12376cf7ee167b7a138fe65732d1c9a61ff65`. В нём фактические SQL definitions, а не предположения по именам. `user_version=0` не означает2.0; `migration_done=1` при чужих/отсутствующих объектах не принимается.

25/26 содержат разрешённые автором замены триггеров. Поэтому завершённый runner **не прогоняет файлы повторно**: сравнивает готовое состояние и выполняет read-only audit. Возврат на старого пишущего Worker после финансовых миграций не поддерживается. Никаких новых compatibility SQL без отдельного согласования не добавлялось.

## Репетиция исходной2.0

Источник — реальные `src/02_SCHEMA.sql` и `src/01_ASTRA_V2.js`, а не готовая2.3B fixture.20 фиктивных профилей: все12 знаков и профили без знака, балансы0/2/5/100 и реально полученные7/8, реферал подтверждённый/ожидающий, канал, ON/OFF, разные UTC timestamps. Реально вызвана старая цепочка /start→выбор знака→реферальное начисление, бонус, канал, настройки и платный старый расклад через fake API. Обработанные update_id сохранены;2 синтетических внешних pending payload отдельно от БД.

| Проверка простой миграции | До | После |
|---|---:|---:|
| Профили |20|20|
| Сумма balance |444✨|444✨|
| Изменившиеся пользовательские строки/хэши |—|0|
| Новые ledger opening |нет ledger в2.0|20 строк, сумма444✨|
| Начисления/покупки от самой миграции |—|0|
| Потерянные processed_updates |—|0|
| Согласия28 из старого ON |нет|0|
| Новые продажи/экономика/Stars |нет|OFF|
| Delivery quarantine28 |нет|1|

Проверено не только SUM: сохранены хэши каждой пользовательской строки и данных всех исходных таблиц. Исходный SQLite файл не изменился побайтно. Backup и отдельная восстановленная копия соответствуют исходному snapshot; повтор завершённого запуска не меняет байты output/журнала.

**Важная граница:** оригинальная2.0 не сохраняла оплаченный Таро-текст или ledger. Fake расклад действительно был выдан, его стоимость учтена в исходном балансе, но в D1 нет материала для восстановления. Не выдаём выдуманные исторические результаты за сохранённые данные2.0.

## Отдельные исторические fixtures

Материалы вводились только после соответствующей настоящей схемы: Таро3 после21, GPT6 после22, forecast4 после23, Stars v1 proof после25, Таро5 после26. Это отдельный исторический источник, **не изменённая задним числом исходная2.0**.

Для полного такого набора сумма **537→537✨** при оставшихся миграциях. Все существовавшие до upgrade table/data/rowid/sequence hashes совпали. Literal Таро3/5 с Unicode, переводами строк, combining/emoji и reserved symbols сохранены UTF-8 байт-в-байт; cached/paid forecast, версии, GPT6 right, старые receipt/ledger и их цены сохранены. Новые движки не использовались для пересчёта старых текстов.

Уже после upgrade на другой тестовой копии локально открывались gates и покупались все7 RWS категорий с ценами5/8/8/8/14/21/32. Каждое списание одно, повтор возвращает тот же JSON/text, при закрытых gates чтение остаётся доступным. Финальная базовая репетиция остаётся OFF. Отдельные тесты synthetic Stars refund после расходования создают долг32; следующий credit40 погашает32 и оставляет8. Paid расклад сохраняется, повтор receipt не начисляет снова, invoice/внешний API не вызывались.

Данные и сравнения — `data/astra25-origin20-fixture.json`, `data/astra25-task04-rehearsal.json`. Профили/события полностью фиктивные; пользовательские базы/backup в Git не сохранены.

## Найденные блокеры и границы исправлений

### 1. Допустимый orphan referrer исходной2.0 → FK failure0025

Точный локальный сценарий: исходная схема, referrer1, invitee2.referrer_id=1, удаление1. В старом коде DELETE не чистит входящие ссылки, в старом столбце нет FK. Даже `foreign_key_check` старой базы пуст.

0021–24 на таком состоянии выполняются, **0025 при FK ON получает `FOREIGN KEY constraint failed`** на переносе договора. Native transaction откатывает файл. Новый runner выявляет `LEGACY_DANGLING_REFERRER_REQUIRES_REVIEW` до миграций, не создаёт output и не нормализует записи. Negative/reproducer находятся в `tests/astra25-upgrade.test.mjs`.

Решение владельца: сначала отдельно разрешённый read-only подсчёт в фактическом оригинале. Если таких ссылок нет — применяется проверенный чистый маршрут. Если есть — отдельно согласовать **новый forward-only compatibility этап перед25** и правила прозрачного разрешения ссылки на удалённый профиль. Возможное минимальное направление: согласованное приведение только недействительных referrer_id к NULL с проверенным backup и агрегатным аудитом; баланс/оплаченные тексты/исторические проводки не трогать. Это изменяет сохранённую связь и preservation-политику, поэтому здесь **не выполнено**, новый manifest/миграция не притворяются утверждёнными. Нельзя отключать FK, добавлять dummy людей, менять старый25 или молча пропускать договор.

### 2. Бюджет ошибки клавиатуры:49/50, а не прежний worst47

В frozen candidate `d6ae...` долгий валидный stress snapshot58000, настроенный synthetic HMAC и400 на editMessageReplyMarkup вызывают повторные status/error экраны. Фактически: **33 SQL statements +16 fake HTTP=49**, HTTP webhook500, delivery=unknown, одно списание32 и баланс100→68.

**Официальный50 локально не превышен**, настоящего Cloudflare quota error не наблюдали. Но остаётся1 операция вместо принятого консервативного запаса2, поэтому этот путь отмечен как STOP-SHIP для запаса ресурсов. Это не замаскированный «успех по лимитам». Последний test `astra25-cost.test.mjs` специально воспроизводит находку; machine-readable verification содержит `release_acceptance=false`.

Минимальное предложение следующей отдельно утверждённой правки: единый ограниченный budget-aware error reporter для callback/purchase, отдельная обработка ошибки markup после принятого body, без каскада новых экранов и с резервом на завершение update job. Не менять цены, SQL, snapshot или unknown semantics. Candidate TASK03 в TASK04 не редактировался.

### 3. Draft TTL не является retention

Текущий29 сохраняет sealed draw/text после истечения15мин. Даже удаление просроченного неоплаченного offer при живом профиле блокирует `astra_tarot25_offer_delete29`. Тест подтверждает отказ, неизменность paid/material/balance и невозможность поздней покупки по истёкшему quote. Здесь не ослабляли guard.

Read-only preview с **примером**7дней и партией20 ничего не удаляет;7дней не утверждены владельцем. Для действительной capped retention нужны согласованный период/лимит новых draft и новая forward-only политика только `expired AND unpurchased`, с атомарностью относительно confirm. Paid snapshots не удалять ради квоты. Свободные вопросы UI OFF; неизвестную правовую политику не заменять API boolean.

### 4. Старый Worker2.0 не ограждён одной новой схемой

Локально запущенный старый bonus handler после upgrade действительно прибавляет1 к balance напрямую, не создавая ledger. Новый audit получает `WALLET_MISMATCH`. Это не исправлялось переписыванием старого Worker или финансовых SQL. Инструмент отвергает `--worker-version 2.0`; в настоящей инфраструктуре только реальная остановка всех старых writers исключает риск. После0025/26 обычный rollback старого JS недопустим. Старый `/activate` также способен сбросить Telegram pending updates — его не вызывать.

## Recovery, повреждения и параллелизм

45 независимых случаев: перед BEGIN, после native exec, prepared-before-COMMIT, после COMMIT до финальной записи журнала, после записи — для каждой21…29. Все восстановились только по доказанным fingerprints. При чужих/неполных DDL, invalid completion, changed source/target, невалидном backup/restore, иной source path и активированной25 — STOP без ремонта/отката исходника.

Два отдельных настоящих SIGKILL дочернего процесса на26: до COMMIT SQLite восстановил прежнее состояние; после COMMIT runner признал сохранённый шаг по prepared-after и продолжил. Живой lock не снимается, два invocation не делят output. Дополнительно проверены writer activity по независимому соединению, позднее бизнес-событие после backup, отдельное восстановление в новый файл, immutable preservation и rowid gaps.

2/20/100 подтверждений на базе, прошедшей **полный исходный2.0 upgrade**, выполнялись через2/20/20 независимых SQLite WAL connections. Барьер перед purchase INSERT подтверждает конкуренцию: один paid row, один ledger−32,100→68 и одна начальная отправка текста. Confirm/delete гонки с FK ON/OFF не оставили paid/offer сирот. Это не доказательство репликационных свойств Cloudflare D1.

## Тесты

Канонический расширенный прогон:

```sh
ASTRA25_WRANGLER_BUNDLE=<absolute-pinned-dryrun-bundle> sh scripts/test-2.5-task04.sh
```

**148 новых уникальных node:test +1618 прежних выполнений =1766**,0 неожиданных failures,0skip/cancel. Отдельно210 прежних assertions,2 настоящих SIGKILL cases и3 проверки самого CLI (plan/apply/resume); они не выданы за дополнительные unique node tests. Предыдущие1618 включают повторения между историческими релизами и TASK01–03, это не1618 новых случаев TASK04.

| Новая группа | Тестов |
|---|---:|
| upgrade/CLI/plan/schema/preservation |42|
| recovery/crash/backup/writers |57|
| business/actual Worker/history/payments/privacy/Cron |34|
| cost/retention/известный budget blocker |7|
| независимые WAL/мигратор-lock |6|
| настоящий Wrangler dry-run bundle |2|

32 новых теста вызывают целевой Worker (включая2 Wrangler-bundle), остальные проверяют native миграции/recovery и canonical D1 adapters. Новые tests используют actual candidate/D1-like adapter на локальном SQLite, а не только JS заглушки финансов. Fake Bot API принимает только фиктивный токен/разрешённые методы, внешние адреса отвергаются. Проверены6 меню, free day card через pending fixture, все новые форматы/сохранённый текст, literal old3/5, forecast4, /stop/delete/generation, stale callbacks, duplicate updates/receipt/refund, unknown/403/429/500/network и SQL после commit/ACK в принятой регрессии. СтарыеON не создают consent; scheduled даже с env ON не отправляет без proof/quarantine. Локальные fake clocks не переписывают SQL: они используются для теста TTL, не являются облачным измерением.

**Зелёные assertions включают корректное обнаружение известных STOP-состояний. Они не означают приёмку выпуска.** Количества, сценарии, фактические бюджетные примеры и блокеры — `data/astra25-task04-verification.json`.

## Бюджет Workers/D1 и сборка

| Локальная модель долгого архива | SQL | HTTP | Всего | Запас до50 |
|---|---:|---:|---:|---:|
| Без настроенного HMAC |33|14|47|3|
| Настроенный HMAC |34|14|48|2|
| Первый callback на policy clock cutover |35|13|48|2|
| Повторные markup400 |33|16|49|1 — blocker коридора48|

Включены outer schema/policy/update jobs, spinner ACK, body, markup и ошибки; batch statements считаются консервативно отдельно. SQLite returned rows/total_changes не равны D1 rows_read/rows_written: реальные rows_*, per-requestCPU,1102 и репликация здесь не измерялись.

Frozen single-file: **1379813bytes, gzip9 253315bytes**, SHA **`d6ae0b3aed3c80bae0da2969042e3e3e6b21d71061fcbea38b329ab6d72cb15f`**. Старый2.4 SHA **`5f34b44948e4bb6be643d586e712554d41f9b9bf7f2ee7175c4bf5e6d77786f4`**.

Pinned Wrangler4.45.0 dry-run: upload2174.39KiB, CLI gzip271.26KiB; файл2226575bytes, gzip9 259793bytes. Разница gzip с CLI — уровень сжатия/метрика, обе величины указаны отдельно. Ни исходный Worker, ни release2.4 не переписаны. Bundled ES module импортирован; actual `/health` и legacy purchase/replay на нём проверены. Размер ниже3MiB compressed, но это не проверка10ms CPU. Конфиг/lock/source/bundle hashes — `data/astra25-task04-wrangler.json`.

Пять свежих Node-процессов: source import wall≈28.8–32.9ms/processCPU≈30.4–34.7ms; Wrangler bundle≈33.7–39.9ms/35.2–41.5ms. RSS до≈41.7/50.5MB. **Это не CPU/память Cloudflare**, не p95 реального HTTP и не утверждение о превышении/соблюдении Worker CPU10ms; измеряется Node module import после старта измерителя. Сырые локальные замеры — `data/astra25-task04-cold.ndjson`.

Storage study:100 дополнительных неоплаченных10-карточных draft дали около**6.7MB** SQLite allocation,≈67KB/draft. В одной выборке при консервативной модели500000000bytes осталось около7338 таких draft;100/day дают примерно73дня без другой нагрузки. Это линейная иллюстрация, не D1 quota measurement: не учитывает другие пользователи/paid-дубликаты/forecasts/индексы/fragmentation и реальные суточные rows limits. Paid snapshot и offer хранятся отдельно. TTL не уменьшил их объём. До активации нужна утверждённая storage/rate/retention политика; отсутствие purge не скрыто.

## Готовность и следующий шаг

| Ось | Результат |
|---|---|
| migration_and_integrity |PASS только на распознанном корректном синтетическом источнике; orphan-source STOP|
| business_logic |локально проверена; live доказательства отсутствуют|
| manual_ui |локальные потоки работают; запас error-path требует решения/правки|
| cloud_platform |false|
| Telegram_transport |false|
| privacy_financial_editorial |отдельное решение владельца/независимое review|
| public_ready |false|

Перед дальнейшим внедрением владелец решает compatibility orphan-referrers, минимальный UI budget patch, draft retention/caps, актуальные support/Terms/backup/consent и цены. Реальный restore нельзя подключать к другому боту/test namespace: совпадение численного Telegram ID не доказывает ту же личность; функциональные проверки должны использовать отдельную синтетическую D1. Затем отдельное разрешение на read-only фактическую2.0 и будущую репетицию в совершенно новой D1 с dedicated test bot; реальные CPU/D1/Telegram проверки и go/no-go выполняются только там. **Текущий TASK04 не разрешает установку или публичный запуск.**

Runbook: `ASTRA_2_5_TASK_04_RUNBOOK_DRAFT.md`. Все инструменты/сценарии сохраняются отдельными файлами; исходные SQL и архитектура денег не переписаны. После commit и обычного push в ту же ветку — остановка перед любым TASK05.

## Основные новые файлы для ревью

- CLI/ядро: `scripts/astra25-upgrade-local.mjs`, `scripts/lib/astra25-upgrade.mjs`, `astra25-upgrade-plan.mjs`.
- Фиктивные данные/репетиция/cost: `scripts/create-astra20-synthetic.mjs`, `scripts/rehearse-astra25-local.mjs`, `scripts/lib/astra25-synthetic.mjs`, `astra25-cost.mjs`.
- QA: `scripts/test-2.5-task04.sh`, `test-astra25-crash.sh`, `test-astra25-cli.sh`, `check-astra25-wrangler.sh`, `measure-astra25-cold.mjs`;6 `tests/astra25-*.test.mjs` и3 вспомогательных файла `tests/task04/`.
- Машинные артефакты: `data/astra25-upgrade-plan.json`, `astra25-origin20-fixture.json`, `astra25-task04-rehearsal.json`, `astra25-task04-verification.json`, `astra25-task04-wrangler.json`, `astra25-task04-cold.ndjson`.
- `tools/astra25-wrangler-offline/`: package/lock/config для фиксированного offline dry-run.
- Документы: этотREPORT, `ASTRA_2_5_TASK_04_RUNBOOK_DRAFT.md`, отдельный `ASTRA_2_5_TASK_04_BLOCKERS.md` с точными воспроизведениями и предложениями, а не скрытыми исправлениями.
