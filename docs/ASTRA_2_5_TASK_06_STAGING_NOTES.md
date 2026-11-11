# TASK06 — локальное воспроизведение и условия будущей приёмки

**Этот документ не разрешает Cloudflare/Telegram действия.** Ничего не деплоить, не применять remote SQL, не менять webhook/Cron/секреты и не использовать прежнюю сломанную staging D1. Новая экономика, Stars, рассылка, RWS продажи и retention gates OFF. TASK07 не начинать автоматически.

## Локальные артефакты

Новый `release/ASTRA_2_5_TASK06_CANDIDATE.js`, `migrations/0030_tarot_retention.sql`, manifest `data/astra25-upgrade-plan-task06.json`, full DDL `data/tarot25-schema30.json`, `scripts/check_integrity_tarot25_30.sql`. Старые SQL/compat v1/Workers и TASK05 артефакты неизменны. Source generator0030 — `scripts/generate-tarot30.mjs` + `scripts/sql/tarot30-body.sql`; не редактировать generated SQL вместо генератора.

Цепочка: 2.0 →0021→0022→0023→0024→**compat referrers v1**→0025→0026→0027→0028→0029→0030. Compat должен предшествовать0025, несмотря на краткую запись последовательности в ТЗ. SQL0030 не меняет финансовые таблицы/тарифы; заменяет только старый offer DELETE guard для строго разрешённой очистки и добавляет storage metadata/guards.

Node22.16+ с native SQLite; проверяется Node24.22.1. Только новые фиктивные файлы:

```sh
node --experimental-sqlite scripts/create-astra20-synthetic.mjs \
  --local-only --output /absolute/private/new-origin.sqlite
node --experimental-sqlite scripts/astra25-upgrade-task06-local.mjs \
  --local-only --source /absolute/private/new-origin.sqlite \
  --output /absolute/private/new-target.sqlite --plan
node --experimental-sqlite scripts/astra25-upgrade-task06-local.mjs \
  --local-only --source /absolute/private/new-origin.sqlite \
  --output /absolute/private/new-target.sqlite --writers-paused
```

Source readOnly; output новый; source≠output; без URI/symlink/hardlink/force. До SQL проверяются точные DDL, деньги, закрытые gates, backup и отдельный restore. Свидетельства `.task06` закрыты0700/0600. Native runner исполняет весь файл в BEGIN IMMEDIATE и останавливается при foreign/partial schema, wallet mismatch или неоднозначном исходе. `--writers-paused` подтверждает действие оператора, физически не отключает старый Worker.

Для того же source/manifest/output после сбоя добавить `--resume`. Живой lock не снимается. Журналv3 различает rollback и полный COMMIT по before/prepared-after; другое состояние — STOP. Fingerprints v3 читают по одной строке и сортируют фиксированные SHA, включая rowid и sqlite_sequence; это позволяет проверять600+МБ без загрузки всех payload в V8. Нельзя подставлять `.task04`/`.task05` журналы: схема fingerprint отличается. Завершённый повтор read-only, миграции не запускаются снова.

## Тесты и измерения

Исторические TASK01–05 запускаются на неизменяемом git archive базового d7aeb27 в отдельном `/tmp`, с GIT_WORK_TREE этой копии. Это предотвращает конфликт с историческими тестами, которые временно переименовывают0028/пересобирают старые releases. Исторический результат не выдаётся за тест нового Worker. Новые suites и compiled-bundle tests отдельно вызывают TASK06.

```sh
sh scripts/test-2.5-task06.sh
```

Отдельно доступны `test-astra25-task06-current.sh`, `audit-tarot30-local.sh --local-only`. Большой аудит создаёт100/1000/10000 настоящих draft, мигрирует заполненную29 при V8 heap limit256МБ, проводит bounded cleanup, rate3 workload и10000 actual draws по моделируемым суткам. Последний режим моделирует долгую жизнь, а не10000 разрешённых предложений одному профилю в сутки. Все базы удаляются только из специально созданных синтетических `/tmp` каталогов. Реальный cleanup этим не разрешён.

Offline Wrangler4.45.0 — только `--dry-run`, фиктивный DB binding, metricsOFF, пустой config home, без credential bindings и Cron. Wrapper `scripts/check-astra25-task06-wrangler.sh` принимает установленный pinned tool-root и новый `/tmp/astra25-task06-dryrun-*`. `ASTRA25_TASK06_WRANGLER_BUNDLE` передаёт полученный локальный файл в отдельные tests. Dry-run проверяет упаковку, не Workers CPU/D1/Telegram. Node wall/CPU не приравниваются10мс Cloudflare.

Проверки могут создавать/изменять только новые TASK06 отчёты; не запускать Git commit во время тестов. SHA и числа — `data/astra25-task06-verification.json` и TASK06_REPORT.

## Процедура очистки для локальных harness

Модули `preview30`/`cleanup30` используют native D1-like adapter; кандидат также экспортирует **не HTTP/Cron** функции `previewRetentionTask06` и `runRetentionTask06` для явного локального harness. Без test-mode/SQL permission удаление запрещено. Публичного маршрута очистки нет. Существующий scheduled не вызывает retention даже при локально включённых storage flags.

Caller задаёт token заранее и сохраняет его до запуска. Один token = одна партия. После неясного ответа читать/повторять тот же token, а не создавать следующий. Максимум20 offers+quota; claims существуют только внутри SQL операции. Проверьте, что после операции claims0 и run.finished_at>0. При меняющейся конфигурации завершённый token остаётся read-only доказательством своего прежнего лимита.

## Будущая Cloudflare/Telegram приёмка — только отдельное разрешение

1. Проверить фактический исходник и bindings read-only, без публикации ID/экспортов. Остановить всех writers/in-flight; создать backup и **доказать** восстановление в совершенно новую изолированную D1. Старую сломанную staging не использовать. Сверить каждый баланс, ledger, снимки/версии/байты, receipts/refunds/debt, HMAC и consent.
2. Реальные восстановленные профили держать отдельно от функционального тестового бота. Совпадение численного ID в другом bot/test namespace не подтверждает личность. Для функциональных тестов нужны новая синтетическая D1 и dedicated Telegram test environment.
3. Утвердить способ D1 миграции/транзакционные границы/журнал ненумерованного compat. Console fragments не равны native BEGIN IMMEDIATE целого файла. Проверить именно поддержку table-valued PRAGMA, triggers/JSON, FK ON/OFF, atomic INSERT procedure и D1 consistency. Не обходить guards при несовпадении.
4. Все flags OFF; storage policy done1/write0/cleanup0; runtime29.enabled0; policy25/patch26 idle; consent quarantine1. Не назначать новую редакционную дату. Worker — только TASK06 matching0030. `/health` намеренно503/public_ready=false, schema/manual true при корректной базе. Это не go-live.
5. По отдельно разрешённому тестовому сценарию измерить CPU cold/warm/p95/max/1102, actual D1/HTTP counts и rows_read/rows_written, размер/суточные квоты. Проверить меню,7 форматов, бесплатное число/карту, forecast4, старые3/5 и29 paid, историю, /stop/delete, expiry/unknown/403/429, price confirmation и recovery. Не считать Node/native SQLite доказательством облачного поведения.
6. Утвердить storage policy, privacy notice/основание/SLA HMAC, operational job tokens, cap/alerts, retention aggregate metadata и проектные цены. Реальное включение очистки/новых продаж/нового Cron не входит в TASK06.

## Совместимость и восстановление

TASK05/TASK03 schema29 validators должны отвергать0030: один guard изменён намеренно. Они могут показывать старые базовые функции, но не являются совместимым rollback для RWS истории. Не возвращать старый пишущий Worker после финансовых миграций и0030. Использовать закрытые gates и исправление вперёд matching-сборкой либо отдельно проверенный restore в новую копию.

При restore сверить поздние покупки, delivery unknown, payments/refunds/debt, /delete и отзыв consent. Backup способен воскресить удалённый профиль/старую квоту/подписку; не возобновлять отправки по старому consent автоматически. Сохранять очередь и dedup, не применять drop_pending_updates. Снимки оплаченного не перегенерировать, balances/ledger не переписывать.

Удаление unpaid освобождает логические данные/страницы, но физический SQLite файл может остаться больше cap. Массив10000 draft уже не помещается в500МБ D1 Free. Очистка такого stock не является автоматическим решением импорта/квоты. Для компактного переноса нужна отдельная репетиция с сохранением rowid/sequence и финансовых hashes; произвольный VACUUM/dump на действующих данных не разрешён этой задачей. Первоначальная2.0 не сохраняла paid тексты в D1, их невозможно восстановить из отсутствующих данных.

**Публичный STOP-SHIP остаётся. TASK07 и реальные облачные испытания требуют отдельного задания.**

Размер SQL также проверяется: первоначальный monolithic completion164877 байт заменён семью небольшими guards с теми же223 core DDL comparisons. Primary completion требует все части; runtime и runner manifest проверяют точный SQL всех частей. Самый длинный statement0030 —28413 байт, аудит также разбит на bounded statements. В миграции61 statement: это административная миграция, не маршрут через Worker с50 запросами. Поддержку транзакции всего файла и лимиты административного D1 инструмента ещё нужно проверить; не импровизировать ручное дробление по `;`.
