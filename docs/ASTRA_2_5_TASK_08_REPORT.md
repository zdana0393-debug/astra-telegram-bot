# ASTRA2.5 / TASK08 — подготовка платформенной приёмки

11 ноября 2026, время отчёта — Москва. **Выполнена только фаза1. Фазы3–4 в части реальных испытаний/готовности переноса не выполнены. Остановка на контрольной точке разрешения.** Текущий запрос прямо не разрешает облачные действия. Итог платформенной приёмки: **NOT_TESTED**, публичный STOP-SHIP сохраняется.

## Что проверено в этой подготовке

|Локальная проверка|Результат|
|---|---|
|Ветка `astra-2.5-tarot`, чистое начальное дерево|PASS|
|Исходный HEAD и origin после Git fetch|`1b05664d6fb45d1cc63c8b7bfa2c1df1c0e06ad8`, совпадают|
|72 protected historical files|SHA совпадают с TASK07, исходники не изменены|
|Sources/artifact hashes TASK07 verification|Все совпали|
|Upgrade manifest пересчитан из настоящих SQL в локальном SQLite memory|PASS, тот же plan SHA|
|Schema31 против manifest, точные name/type/raw SQL|286 project objects, PASS|
|SQL0031 statement parser/размер|133 statements, максимум20429 UTF8 байт|
|Синтаксис single-file кандидата|`node --check` PASS|

Worker SHA256: `018d2eda3fc13a7a0f85fffcc6e1c866a9901bfb2e8dcce5e1bd6d184d6f8bda`.
Миграция0031 SHA256: `f69aa193302d5332994c3a37184a558ffcce599ccef7f18fd3199545b1652afb`.
Plan SHA256: `83f75d7cfd00b27876f7fba2c6c3519233be4f2edd676f58757d696a079faa3a`.

2569 выполнений node:test относятся к **завершённому TASK07**, источник `data/astra25-task07-verification.json`. В TASK08 их заново не запускали: изменены документы/реестр подготовки, продуктового исправления нет. Эти2569 не объявляются проверками настоящей D1. Проверка схемы в memory также не является remote SQL.

Изучены четыре итоговых документа TASK07, verification, manifest, существующий single-file Worker и SQL0031/генераторный body. Новые функции, миграции, тарифы, flags и исходный Worker не менялись. Копии production данных и synthetic deployment package для реального Telegram не создавались: его test-realm IDs ещё неизвестны.

## Подготовленные документы

- `ASTRA_2_5_TASK_08_OWNER_GUIDE.md`: понятные шаги Dashboard, точные ресурсы/разрешения A/B/C, секреты только через защищённые настройки, квоты и STOP.
- `ASTRA_2_5_TASK_08_PLATFORM_ACCEPTANCE.md`: порядок миграции/restore,18 платформенных cases, метрики/evidence, правильная интерпретация ошибок/GC/transport.
- `ASTRA_2_5_TASK_08_CUTOVER_CHECKLIST.md`: будущий отдельный переход2.0→2.5 без промежуточных Workers, read-only inventory только по другому разрешению, остановка writers, backup/restore/reconciliation/forward-fix.
- `data/astra25-task08-preparation.json`: машинная сверка локальных артефактов, неизданные разрешения, null resource IDs и все platform cases NOT_TESTED.

Это готовые материалы для решения владельца; сами по себе они не разрешают выполнить ни один облачный шаг.

## Выявленные условия изоляции

1. **Общие квоты аккаунта.** Новые DB/Worker имена не гарантируют отсутствие влияния на availability production: Free quotas внутри аккаунта общие. Для исходного требования абсолютной изоляции следует выбрать отдельный принадлежащий владельцу аккаунт испытаний. Если доступен только общий аккаунт, STOP до отдельного решения о риске; не обещать нулевое влияние.
2. **BOT_USERNAME fallback.** В неизменённом коде при невалидном/пустом `BOT_USERNAME` есть fallback на имя рабочего бота. Поэтому нельзя утверждать, что production identifier отсутствует во всём source. Нужно обязательное test username override до приглашений, `CHANNEL_USERNAME` пусто, test token/realm и отдельные secrets. Никакой production identifier не использовался выполненными действиями; фактическая сверка будущих assigned cloud IDs — NOT_TESTED, поскольку их нет. Production инвентаризация здесь не выполнялась.
3. **Нельзя отправлять на выдуманные IDs.** Для D1-моделей пригодны вымышленные числа; для реальной доставки нужны назначенные IDs отдельного Telegram test realm. Профили/вопросы/балансы при этом вымышленные, не перенесённые из рабочего бота. Итоговый lab dataset для restore в functional должен использовать allowlisted test IDs, а не слепо fixture1…20.
4. **Нельзя включить test RWS для случайных посетителей.** У кандидата нет готового recipient allowlist env. Планируется reviewed локальный allowlist relay с test/getUpdates; неизвестные IDs не пересылаются в candidate. Registered webhook в этом варианте не тестируется и остаётся NOT_TESTED. Никаких setWebhook/deleteWebhook по умолчанию. Relay и закрытый lab harness ещё нужно реализовать/проверить локально до разрешения B; их несуществующий SHA нельзя одобрить заранее.
5. **Время/наблюдаемость.** Default GC проверяется не раньше900+86400 секунд после SQL created_at. Startup/CPU/rows нельзя заменить Node proxy или временем HTTP. Недоступная метрика остаётся NOT_TESTED. Ошибку429 нельзя получать намеренным Telegram-флудом.
6. **Служебная схема D1 и SQL capabilities.** Наличие platform objects, table-valued PRAGMA, unhex и административная атомарность пока неизвестны. Не обходить exact guards/счётчики и не удалять system objects ради PASS; при несовместимости — воспроизведение и отдельное безопасное предложение.

## Планируемые ресурсы и лимиты — пока только предложение

Две новые D1: `astra25-task08-lab`, `astra25-task08-functional`. Два новых Worker: `astra25-task08-probe`, `astra25-task08-candidate`. Затем отдельный owner-created Telegram test bot. На момент отчёта ничего не создано, имён/UUID существующих объектов не подставляли. Никакого старого staging, третьей постоянной D1, test channel, Cron, custom production route или платной услуги в план не включено.

Разрешение A запрашивается только на Cloudflare creation и первичную публикацию двух бездействующих503 stubs, без bindings/secrets/SQL/Telegram. Это явно deploy заглушек, не скрытая «подготовка». Код заглушки целиком приведён в owner guide. B требуется отдельно для reviewed probe/relay, exact TASK07 deploy, remote SQL новых DB, test API/сообщений и ограниченной активации RWS/questions/GC с фиктивной пылью. Stars/новая экономика/рассылка остаются OFF. Production не входит ни в одно из этих разрешений.

Предлагаемые ручные ceilings всего эксперимента:300 invocation двух Worker;250000 read/25000 written rows двух D1;25MB/DB,50MB суммарно; до10 параллельных запросов после ступеней2/5. Это не автоматический лимитер и не гарантия расхода одного import. Нужны реальные метрики/остаток квот, иначе следующий нагрузочный этап не запускать. Reference Free из TASK07:100000 requests/day,10ms CPU,1s startup,50 queries/subrequests,500MB/DB,5GB/account,5M read/100K written/day,10 DB slots. Вновь проверить актуальную официальную документацию до эксперимента; в этой фазе новых Cloudflare API запросов не было.

## Что НЕ проверено

Создание ресурсов — NOT_TESTED. Настоящие D1 migration/atomicity/PRAGMA/unhex/import/export/restore — NOT_TESTED. Workers CPU/startup/memory/1102/D1 meta/subrequests — NOT_TESTED. Seven formats, secret/unpaid protection, independent questions, prices/ledger, delivery/long messages, forged callbacks, forecasts/day number/main functions, referrals/HMAC, natural retention/GC **на настоящей платформе** — NOT_TESTED. Telegram test identity/API/clients — NOT_TESTED. Production inventory/backup/cutover — NOT_TESTED и NOT_AUTHORIZED.

Выполнено0 Cloudflare/Telegram операций. Production Worker/D1/webhook/Cron/secrets/users и повреждённая staging не открывались и не менялись. Настоящих Stars-инвойсов/платежей/возвратов не было. PR/merge/main не затронуты.

## Следующее действие владельца

Выбрать аккаунт испытаний и явно ответить по разрешению A с согласованными именами/квотами. Аккаунт/название можно указать без секретов; значения tokens/passwords в чат не передавать. Пока разрешения нет, остановка после этих документов. Даже последующее A не будет разрешением на SQL/полный deploy/Telegram или production. TASK08 не объявляется завершённой платформенной приёмкой, TASK09 не начинается.
