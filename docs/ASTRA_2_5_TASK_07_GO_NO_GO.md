# TASK07 — решение о готовности и Cloudflare preflight

**GO: локальная разработка и воспроизводимая подготовка кандидата. NO-GO: публичные продажи/production/cutover.** Реальные Cloudflare/D1/Telegram в этом этапе не использовались. Новые gates и автоматические процедуры OFF. Health намеренно503/public_ready=false. Этот документ не разрешает TASK08.

## Подтверждено локально

Независимые намерения по пяти темам, прежние проектные цены, четыре покупки подряд, отсутствие суточного потолка paid, сохранение seed/seal при crash/unknown, атомарный debit+ledger, owned history и версия читателя. Нет выдачи unpaid/чужого snapshot; подписи и поколения проверяются. Нативные WAL-гонки, реальные SIGKILL и неподтверждённые доставки не перерисовывают paid. Old3/5/forecast/GPT6/referral/bonusHMAC/consent/notifications сохраняются. Новая0031 не переписывает21–30 и старые Workers.

Проверены исходные схемы2.0…0031, остановка при foreign/partial/schema drift, backup с отдельным восстановлением, повтор/возобновление, source read-only, типизированный logical restore с rowid/sequence, WAL writer detection. Stock10000 unpaid после очистки/compact restore сохраняет балансы, ledger и paid bytes. Это нативный SQLite, не D1 acceptance.

## Актуальные официальные ограничения

Документы прочитаны11.11.2026 из официального `cloudflare/cloudflare-docs`, production ref `081afc3427e9218fc31ec8e8537cfd70e52a2ad4`; сайт developers.cloudflare.com вернул403. URL, hashes и источник — `data/astra25-task07-official-docs.json`. Это публичные документы, не доступ к аккаунту.

|Показатель|Документация Free|Что измерено здесь|
|---|---|---|
|Requests|100000/day Free|Реальные запросы/квота аккаунта не измерялись|
|HTTP/Cron CPU|10ms|Только Node/nativeSQLite proxy; нельзя приравнивать к isolate CPU|
|Startup|1s|Локальный import/bundle, без startup_time_ms Cloudflare|
|Memory|128MB isolate|Нет настоящего Worker isolate memory profile|
|Bundle|3MB compressed Free|Размеры raw и pinned Wrangler dry-run в runtime.json; не dry-run deploy|
|Subrequests|50/request|Консервативная сумма SQL statements+HTTP:≤47 в стресс-матрице|
|D1 queries/invocation|50 Free|Официальная текущая оговорка: batch считается одним запросом; наш счётчик строже, считает каждый statement|
|Одна D1|500MB|Локальный page/file размер не D1 storage billing|
|Storage аккаунта|5GB|Не измерялся|
|D1 rows/day|5M read,100K written|Нет D1 meta/rows measurements; локальный SQLite их не доказывает|
|SQL statement|100000 bytes|0031≤20429, compact stock package≤28398; ceiling проекта50000|
|Bound params|100/query|Новые операции существенно ниже; schema query без пользовательских списков|
|TEXT/BLOB/row|2MB|Локальные snapshot bounds и chunk import, настоящую D1 проверить|
|Time Travel|7 дней Free /30 Paid|Не запускался; требуется проверенное восстановление|

Официальная FAQ: при исчерпании дневных rows Free запросы отказывают до сброса, storage исчерпание блокирует новые записи/DDL. Counts возвращённых строк не равны rows_read: full scan и триггеры/индексы тоже влияют. Не складывать500MB отдельной базы с5GB аккаунта как одинаковый лимит.

Источники: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [pricing](https://developers.cloudflare.com/d1/platform/pricing/), [migration management](https://developers.cloudflare.com/d1/reference/migrations/), [import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [return meta](https://developers.cloudflare.com/d1/worker-api/return-object/), [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [Worker metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/).

## Обязательные будущие платформенные проверки

Только по отдельному разрешению, на новой синтетической D1 и отдельном боте:

1. Проверить SQL-функции JSON/RETURNING/strftime/unixepoch, recursive triggers/RAISE, отдельные purchase INSERT и rollback по ошибке post-trigger. Проверить точный large-DDL manifest, table-valued `pragma_page_count/pragma_page_size` и `unhex`. Отсутствие PRAGMA должно закрывать admission, не включать fallback с обходом cap. Paid read должен оставаться без этих PRAGMA.
2. Проверить lossless получение исходного локального source из реального D1 export, включая существенные rowid/sequence и служебные объекты. Наши fingerprints относятся к проверенной локальной копии. Затем проверить административный import итогового пакета:133 statements0031, отложенные FK, прерывание до/после commit, пустая новая копия и полный restore. Миграции никогда не исполнять из обычного Worker запроса. `d1_migrations` не угадывать и не добавлять в fingerprint без согласованного адаптера; новый неизвестный служебный объект вызывает STOP до исследования.
3. Worker **Metrics → CPU time / Errors → Invocation statuses**: минимум cold startup, cold quote, cold10-card confirm, warm paid replay, история длинного текста, consent, ошибка доставки, cleanup20. Записать p50/p95/p99 и max/1102 (`exceededCpu`), startup_time_ms через согласованный инструмент. Node proxy включает работу локального SQLite и не доказывает ни превышение, ни соблюдение Cloudflare10ms.
4. Для каждого запроса собрать D1 meta `rows_read`, `rows_written`, `duration`, `size_after` и Worker diagnostics statements/batches/HTTP; **D1 → выбранная база → Metrics → Row Metrics** и GraphQL analytics. Отдельно: пустая/наполненная база, первый quote, seal+pay, duplicate callback, history pagination, refund, GC20, migration/import. Не журналировать личный вопрос, seed или payment identifiers в публичные логи.
5. Прогнать100/1000/10000 attempted unpaid и реальные paid отдельно; metadata/receipts/старые агрегаты тоже растут. Убедиться, что GC token сохранён до запуска, unknown replay продолжает тот же run. Сверить active pages, physical storage и настоящую D1 quota после DELETE/restore; ничего не обещать по локальному freelist.
6. Настоящий dedicated Telegram test environment — отдельный bot/session/base URL `.../bot<test-token>/test/METHOD`, синтетические пользователи и отдельные тестовые credentials у владельца. Проверить официальную [test environment](https://core.telegram.org/bots/webapps#using-bots-in-the-test-environment) перед включением. На этом этапе ни test-, ни production API не вызывались. Новые Stars-инвойсы здесь вообще не требуются.
7. В Android/iOS вручную: тема→формат→необязательный вопрос→цена→confirm; второй самостоятельный вопрос; история3/5/V1/V2; длинные страницы; недостаток пыли; forwarded/old button; связиA/B; /delete и /stop; доставка403/429/unknown; платёжные/возвратные события по отдельному разрешению. Локальный HTML/Chromium320/360px не заменяет этот тест.
8. Сверить backup+restore повторно непосредственно перед cutover. Отдельно остановить старые writers, удержать/reconcile поздние события, проверить совпадение binding ID новой базы. Разрешение на запуск должно явно назвать Worker SHA и SQL/manifest SHA.

## Решения владельца до любых активаций

- Проектные цены5/8/14/21/32 и доступность новых услуг; текущие продажи не включены.
- max_open5, burst20/min с освобождением при оплате; softcap350MB, retention24ч после900с, batch≤20. Это технические defaults кандидата, не молча опубликованная бизнес-политика.
- Optional question: политика согласия/до500 знаков, сроки unpaid/paid, немедленный отзыв неоплаченного заказа, реальный SLA cleanup, support/delete и исключения платёжных записей. Согласие относится к одному следующему вопросу до заполнения/отмены/expiry; /команды и меню не собираются. Нельзя включать сбор до операционного утверждения хранения.
- Долговременный рост paid/receipts и агрегатов; никакой самовольной очистки paid ради Free quota. При нужде — согласованный платный план или другая архитектура.
- Редакционная приёмка девяти образцов и дальнейших редких сочетаний, особенно финансовых/10-карточных. Общие связи остаются ограничением; корректность символики не доказывает истинность предсказаний.
- Авторские78 файлов и права: сейчас0/78, текстовый fallback работает. Фото-транспорт ещё требует отдельной реализации/проверки после получения assets, а не обещания готовой визуальной выдачи.
- Поддержка, Terms/privacy, процедура поздних платежей/возвратов после cutover и recovery forward-fix. Старые Workers после0031 не являются обычным rollback.

**Итог:** можно обсуждать отдельную изолированную техническую приёмку с gatesOFF. Публичный запуск и новые продажи пока NO-GO; фактическая установка здесь не выполнялась и не разрешена этим отчётом.
