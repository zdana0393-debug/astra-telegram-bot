# Astra 2.5 TASK05 — условия будущей изолированной приёмки

**Не выполнять облачные действия по этому документу без отдельного разрешения.** TASK05 разрешает только локальные фиктивные проверки и push. STOP-SHIP; основной бот, прежняя сломанная staging D1, webhook/Cron/секреты не затрагивались.

## Выбор артефактов

Использовать вместе новый `data/astra25-upgrade-plan-task05.json`, compatibility v1, полный неизменённый SQL 0021–0029 и `release/ASTRA_2_5_TASK05_CANDIDATE.js`. Сверить SHA из manifest и `data/astra25-task05-verification.json`. Старые TASK03/TASK04 отчёты — историческое свидетельство, их 49 операций и B1 STOP не являются результатами приёмки нового кандидата. Прежние файлы не перезаписаны.

## Воспроизведение локально

Node22.16+ с native `node:sqlite`/backup; фактически проверено Node24.22.1, Linux. Новая синтетическая исходная база, без персональных данных:

```sh
node --experimental-sqlite scripts/create-astra20-synthetic.mjs \
  --local-only --output /absolute/private/new-origin.sqlite
node --experimental-sqlite scripts/astra25-upgrade-task05-local.mjs \
  --local-only --source /absolute/private/new-origin.sqlite \
  --output /absolute/private/new-target.sqlite --plan
node --experimental-sqlite scripts/astra25-upgrade-task05-local.mjs \
  --local-only --source /absolute/private/new-origin.sqlite \
  --output /absolute/private/new-target.sqlite --writers-paused
```

План read-only, показывает агрегат `compatibility.affected_links`. Применение создаёт новый output и `.task05` с backup, restore proof и журналом0600; каталог0700. Исходная копия readOnly. Абсолютные пути, никаких URI/symlink/hardlink, source≠output, существующий target не перезаписывается. Полные SQL исполняются по файлу в BEGIN IMMEDIATE; ошибка откатывает текущий файл. Не делить SQL по `;` и не смешивать `_steps` с полными файлами.

После прерывания только при прежних source/manifest/backup/output:

```sh
node --experimental-sqlite scripts/astra25-upgrade-task05-local.mjs \
  --local-only --source /absolute/private/new-origin.sqlite \
  --output /absolute/private/new-target.sqlite --writers-paused --resume
```

Живой lock не снимается. Совпадение только before либо подготовленного after доказывает состояние; иное — STOP. Один DDL не доказывает выполнение compat, поскольку он не добавляет объектов. Не назначать его выполненным вручную. Завершённый повтор — read-only audit, не повтор SQL25/26. Новый business после backup не откатывается автоматически.

Полная регрессия с сохранением прежних артефактов. Новый historical driver допускает только гарантированную mutation в одном старом forged-payload тесте (случай f→f исправлен); exact-diff guard проверяет её буквально. Старые SQL/adapters/Workers и остальные исторические тесты должны совпадать. Прямой TASK04 driver имеет прежний freeze и не заменяет эту команду:

```sh
sh scripts/test-2.5-task05.sh
```

Для двух bundle integration suites передать отдельные `ASTRA25_WRANGLER_BUNDLE` (исторический TASK03) и `ASTRA25_TASK05_WRANGLER_BUNDLE` (TASK05). При отсутствии bundle runner явно сообщает, что этот путь не проверен. Для воспроизведения полной приёмки нужны оба. Offline scripts `check-astra25-wrangler.sh` и `check-astra25-task05-wrangler.sh` используют только фиксированный Wrangler4.45.0, фиктивный binding и `--dry-run`; отключены metrics, отсутствуют credential bindings и Cron. Реального режима deploy у скриптов нет. Зависимости/lock — `tools/astra25-wrangler-offline`, установка ignore-scripts в новый локальный каталог. Скомпилированный bundle из `/tmp/astra25-task05-dryrun-*/bundle/` также тестируется с fake API.

Проверки регенерируют historical artifacts и временно перемещают0028, затем восстанавливают файлы. Не запускать другой мигратор, fixtures или commit параллельно полной регрессии. Большой storage audit создаёт 10 000 настоящих sealed draft в одноразовом `/tmp`, удаляет только этот фиктивный каталог после закрытия; production cleanup в нём отсутствует.

## Порядок будущей реальной проверки — отдельное решение владельца

1. Закрыто и read-only проверить фактический исходник2.0: код, полную схему, типы, даты, балансы каждого пользователя, referrer scope, исторические материалы и финансовые факты. Не публиковать Telegram ID, D1 экспорт или секреты. Служебные объекты настоящей D1 требуют проверенной allowlist; локальный строгий SQLite runner не является готовым удалённым мигратором.
2. Утвердить maintenance и физически остановить **всех** writers/in-flight. Аргумент `--writers-paused` — подтверждение оператора, не техническое отключение бота. Старый2.0 умеет менять balance в обход нового ledger. Оригинал сохраняется, никаких экспериментов на нём.
3. Получить новый backup и доказать восстановление в совершенно новую изолированную D1. Сверить балансы по каждому пользователю, paid text/snapshot побайтово, ledger, receipts/refunds/debt, HMAC и consent. Фактическая база и восстановленная копия не должны оказаться привязаны к постороннему тестовому боту: совпадение ID в разных bot/test namespace не подтверждает личность.
4. Согласовать инструмент и транзакционные границы **именно D1**. Новая цепочка перед25 содержит десять шагов: 21/22/23/24/compat-v1/25/26/27/28/29. Служебный migration journal должен однозначно учитывать ненумерованный compat. Проверить backup и агрегат затронутых связей до UPDATE. Удалённые команды TASK05 не предоставляет и не выполняет. Не утверждать, что Console и native SQLite исполняют файлы одинаково.
5. Выполнить отдельно разрешённую репетицию D1 и post-check после каждого файла. Проверить FK, schema fingerprints, completion, wallet=ledger, preservation и закрытые gates. При partial state оставить maintenance; не отключать FK, не править balance/paid flags, не вставлять dummy users, не повторять старые миграции наугад.
6. Функциональный отдельный Telegram test environment получает другую новую D1 с **синтетическими** профилями. Проверить username/deep links/канал и отсутствие маршрутов в основной бот. Webhook, allowed_updates и test environment согласовать отдельно; не использовать старый `/activate` с drop_pending_updates.
7. Все env и SQL gates новых RWS-продаж, экономики, Stars и рассылки OFF. `astra_tarot25_runtime29.enabled=0`, финансовые политики не armed/activated, consent quarantine1. Не задавать новую дату компактной редакции автоматически; используемые fake-даты не являются решением владельца. Старый notifications ON не даёт права доставки.
8. `/health` нового кандидата намеренно HTTP503, `ready=false/public_ready=false`, `release_scope=TASK05_LOCAL_CANDIDATE`. При полной схеме ожидается `tarot25_schema_ready=true`, `tarot25_manual_ready=true`, `tarot25_sales_enabled=false`. Не обходить STOP заменой503 на200.
9. Пройти на настоящем мобильном клиенте: шесть разделов, бесплатную карту/гороскоп/число, forecast4, старые3/5, историю, возврат в меню, /stop/delete, stale callbacks. Новые платные сценарии требуют отдельного локального тестового разрешения gates; семь проектных цен не считаются утверждёнными продажами. Проверить unknown/partial, ручное чтение до3 частей и восстановление после ошибки клавиатуры через меню.
10. Реально измерить Workers CPU cold/warm/p50/p95/max/ошибки1102, D1/HTTP операции, rows_read/rows_written, реальный объём/рост и суточные квоты. Матрица47/48 — локальные SQL statements+fake HTTP, не облачный замер. Нативные триггерные инструкции не считаются отдельными сетевыми запросами. Node CPU/wall не доказывает лимит10мс.
11. Решить retention/rate/storage, support/Terms/privacy/backup и цены. Получить независимое финансовое review и явный go/no-go. До этого публичный запуск запрещён.

## Восстановление после миграции

Подробные исходные меры — `ASTRA_2_5_TASK_04_RUNBOOK_DRAFT.md`; для TASK05 заменяются runner/manifest/candidate и добавляется compat перед25. Старый пишущий Worker после25/26/29 не используется для обычного rollback. Предпочтительно согласованное исправление вперёд с закрытыми gates.

Restore — только в новую копию с решением владельца и сверкой всех событий после backup: оплаченных результатов, ledger, поздних payments/refunds/debt, неизвестных отправок, /delete и отозванных согласий. Restore способен воскресить удалённый профиль или согласие; delivery остаётся в quarantine при недостаточной истории. Нельзя перегенерировать оплаченное, обнулить долг/баланс, удалить processed updates или потерять внешнюю очередь ради чистого запуска.

## Предложение по draft, требующее утверждения

TTL покупки900с не равен retention. Предлагается обсудить: один актуальный неоплаченный quote на пользователя/формат с повторным чтением того же sealed draft; до трёх новых quote на профиль за московские сутки; удаление неоплаченных только через сутки после expiry, небольшими партиями20; глобальный storage soft cap и отказ от новых quote до исчерпания квоты. Числа — предложение, в TASK05 не включены. Нужно заранее определить удобство выбора семи форматов, тексты отказа и нагрузку активных профилей; per-user cap сам по себе не останавливает рост от множества аккаунтов.

Для очистки нужна отдельная forward-only миграция: нынешний SQL29 guard запрещает DELETE при живом профиле. Нельзя просто убрать guard или удалять snapshot_json. Критерий обязан одновременно проверять DB-время expiry+retention и отсутствие purchase внутри атомарной операции, с SQL-защитой paid и сохранением /delete. Гонка: если confirm принят до expiry — появляется purchase и DELETE запрещён; после expiry confirm должен отвергаться, а оплаченный snapshot никогда не попадает в cleanup. Нужны конкурентные тесты, crash/resume, лимит партии, journal агрегатов без ID, сохранение финансовых хешей и проверка отсутствия вопросов. Пока срок не утверждён, никакой разрушительной очистки.

Для обновления machine report после успешного прогона сохранить его лог в `/tmp/astra25-task05-<name>.log` и выполнить `node --experimental-sqlite scripts/verify-astra25-task05.mjs --local-only /tmp/astra25-task05-<name>.log`. Не вызывать verifier после неуспешного runner. В этой сессии дополнительно передан второй лог32 UI-тестов после уточнения fixture до настоящих58000; verifier считает дополнительные executions отдельно и не увеличивает число уникальных кейсов.
