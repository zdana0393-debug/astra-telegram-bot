# TASK08 — протокол изолированной платформенной приёмки

**Статус: PREPARATION_ONLY. Все платформенные cases ниже NOT_TESTED.** Нет разрешений A/B, ресурсов, assigned IDs, облачных измерений или Telegram API calls. Локальный PASS TASK07 не превращается в платформенный PASS. После разрешения заполнять строку только по сохранённому evidence; неполный кейс остаётся NOT_TESTED, доказанное нарушение — FAIL/STOP.

## Разделение сред и артефактов

Lab: только синтетические профили/вопросы, D1 probes и matching закрытый harness без Telegram token. Functional: другая D1, новые test-realm аккаунты, вымышленное содержание и пыль. Нет production dump/profiles и повреждённой staging. Все UUID и account_id берутся из нового одобренного реестра; сверка фактического отсутствия production bindings сейчас NOT_TESTED. Probe/relay code до развёртывания требует локального review и SHA; на фазе1 он не реализован. Временное включение test RWS/questions/GC требует B; Stars/новая экономика/рассылка/Cron остаются OFF.

Зафиксированный объект проверки: TASK07 Worker SHA256 `018d2eda3fc13a7a0f85fffcc6e1c866a9901bfb2e8dcce5e1bd6d184d6f8bda`,0031 SHA256 `f69aa193302d5332994c3a37184a558ffcce599ccef7f18fd3199545b1652afb`, plan `83f75d7cfd00b27876f7fba2c6c3519233be4f2edd676f58757d696a079faa3a`. Любое исправление создаёт новый проверяемый кандидат; прежние results к нему автоматически не переносятся.

## Последовательность после A/B

1. Проверить реестр/квоты; выполнить SQL capability probes на пустой lab. Создавать только временные probe-объекты с зарегистрированными именами; после удалить только их. Служебные объекты D1 не удалять. Не путать оставленную probe-таблицу с несовместимостью чистой миграции.
2. После разрешённых test/getMe/getUpdates зафиксировать allowlisted test-realm IDs; подготовить полностью вымышленный dataset с ними. Никаких production профилей и назначений на случайные ID1…20. На lab пройти настоящие0021→0022→0023→0024→compat-referrers.v1→0025→0026→0027→0028→0029→0030→0031 на этой synthetic2.0. Сохранить boundary/meta каждого административного этапа. Проверить повтор/ошибку/unknown import; не смешивать raw SQL с произвольным d1_migrations backfill.
3. На lab выполнить согласованные финансовые и recovery cases без Telegram token. Удалить только временные probe-объекты, закрыть gates, остановить lab writers. Выгрузить/проверить synthetic backup; отдельно восстановить в **ещё пустую functional** и сверить данные/типы/rowid/sequence/ledger/paid bytes. Лабораторные initial balances и already-paid материалы для UI явно записать в expected dataset. Реальные test-realm IDs служат только адресатами, сами профили вымышленные. Нельзя очищать финансовые таблицы занятой functional для повторного import.
4. Только после успешного restore настроить test secrets кандидата, BOT_USERNAME и realm; проверить ingress allowlist. Затем измерить exact candidate через relay на реальных Workers Free/D1. Лабораторные метрики probe отделить от candidate metrics. Это ровно две D1: lab — источник, functional — независимый restore target и дальнейшая функциональная среда.
5. Выполнять матрицу от дешёвых smoke к гонкам/long/error/GC, проверять бюджет после каждого этапа. Не запускать массовые10000 stock и не расходовать квоту до отказа. После теста — gatesOFF, остановка relay, фиксация непроверенного и возврат к владельцу.

Если нужна вторая аварийная restore-репетиция после начала функциональных записей, занятый target не перезаписывать: запросить дополнительную новую DB или разрешённое пересоздание lab с новым UUID/реестром. В начальное разрешение это не входит. Любая несовместимость, обнаруженная на шаге1/2, останавливает последующие шаги.

## Матрица и критерии

|ID|Действие/ожидаемый результат|Evidence|Статус|
|---|---|---|---|
|ISO-01|Account/DB/Worker IDs только нового реестра; production и повреждённая staging исключены|Одобренный реестр/сверка bindings без secrets|NOT_TESTED|
|ISO-02|Test/getMe совпадает с test bot, BOT_USERNAME задан; relay отклоняет неизвестных адресатов|Sanitized identity/allowlist negative cases|NOT_TESTED|
|D1-01|JSON, RETURNING, unixepoch/strftime, unhex, FK/deferred FK, triggers/RAISE, table-valued PRAGMA работают как требуется|SQL/version/meta и точные результаты|NOT_TESTED|
|D1-02|Полная цепочка21…31;133 statements0031,≤20429 bytes; точные286 project objects, все gatesOFF|Project DDL/hash, список отдельных D1 service objects|NOT_TESTED|
|D1-03|Один paid INSERT фиксирует snapshot/debit/ledger; недостаток средств и конкуренция не создают минус/вторую оплату|До/после balances, ledger keys, snapshot hashes|NOT_TESTED|
|D1-04|Synthetic export/restore сохраняет opaque paid bytes, rowid/sequence и все права|Независимые типизированные hashes, restore receipt|NOT_TESTED|
|D1-05|Прерванный import/unknown commit обнаружим, повтор не переисполняет миграцию или debit|Состояния boundary/повторные IDs; no unsafe retry|NOT_TESTED|
|W-01|CPU cold/warm HTTP на Free не вызывает1102 в матрице; Cron не включается|Cloudflare CPU/outcome samples с n/временем/version ID|NOT_TESTED|
|W-02|Startup соответствует1s; memory/bundle проверены доступным платформенным способом|Platform startup evidence; недоступное поле не выдумывать|NOT_TESTED|
|W-03|D1 queries/HTTP subrequests в лимитах; строки/размер учтены|Binding diagnostics + D1 meta/metrics, отдельно rows и calls|NOT_TESTED|
|T-01|Все7 форматов:3basic5;3relations/work/choice8;5/7/10=14/21/32 ✨, цена до confirm|Sanitized screen/result hashes и ledger|NOT_TESTED|
|T-02|Доход/расходы/отношенияA/отношенияB:4 IDs,4 paid,4 debit; повторы бесплатны|100→74 для5+5+8+8; отсутствие дубликатов|NOT_TESTED|
|T-03|Без consent текст не собирается; после consent один вопрос; отзыв и /delete; stale callback не оживляет|Proof/version/state и отсутствие лишнего текста|NOT_TESTED|
|T-04|Unpaid/чужие cards/orientations/result скрыты; поддельные/старые/forwarded кнопки не оплачивают|Negative calls и прежний ledger|NOT_TESTED|
|T-05|Long messages укладываются4096, callbacks64bytes; unknown/partial/429 не дают redraw/debit; история бесплатна|Порядок частей, paid text hash, delivery state|NOT_TESTED|
|T-06|12 знаков/число дня, бесплатная карта, основные6 разделов, старые paid3/5/forecast4 доступны дословно|Synthetic fixtures и реальные test screens|NOT_TESTED|
|E-01|Обычные и незавершённые legacy referrals, GPT6/HMAC30/баланс/ledger сохраняют правила; rewards только ожидаемые|Synthetic financial invariants без реальных Stars|NOT_TESTED|
|GC-01|Естественный expiry и retention, обе cleanup gates,≤20/run, same-token recovery; paid/ledger сохраняются|SQL times/counts/hashes, physical metrics отдельно|NOT_TESTED|

Нельзя снимать schema/ledger/consent guards ради PASS. Если D1 содержит дополнительные служебные объекты, не подгонять count286 и не удалять их: зафиксировать несовместимость, воспроизводимый минимальный пример и безопасное предложение. То же для неподдерживаемых PRAGMA/unhex или неатомарного import. Код/SQL не менять наугад.

Для доказательства rollback после финансового post-trigger нужна управляемая ошибка **в lab**. Не отключать trigger проверки кандидата. Допустим согласованный harness с точным production purchase SQL и последующим CHECK-failure в D1 `DB.batch()` на отдельном lab probe object; проверить rollback purchase+balance+ledger целиком и удалить только probe object. Успех scratch-only модели не считать доказательством финансового пути. CLI/REST multi-statements не приравнивать к Worker-binding batch без проверки реальных транзакционных границ.

403/429/partial/unknown не вызывать флудом Telegram: использовать контролируемый test-only transport fault в reviewed harness. Такой кейс честно помечается «real D1 + injected transport», а не «Telegram реально вернул429». Настоящие ACK/длинные сообщения и отображение отдельно проверяются реальным test API/клиентом. Тайм-аут не доказывает отсутствие server-side COMMIT.

## Метрики

На каждом case записать: аккаунт-псевдоним и test resource IDs в частном реестре; candidate/harness SHA и deployment version; время UTC и Москва; dataset/case ID; n; CPU samples, wall latency отдельно; outcome/1102; D1 query count, batch count и statement count; HTTP/service subrequests; rows_read/written, meta.duration/size_after; billed/physical size доступным способом. Не писать вопросы, seeds, tokens или payment IDs в публичные логи.

**Worker → Metrics → CPU Time / Errors / Invocation Statuses** и согласованные Workers logs/traces; **D1 → нужная новая DB → Metrics → Row Metrics** плюс `meta.rows_read/rows_written/duration/size_after`. Пустые/недоступные метрики не равны нулю. Cold isolate доказать доступным платформенным свидетельством; «первый после паузы» — лишь first-call sample. Deployment startup validation, isolate startup и HTTP wall latency — разные измерения. Если startup или memory недоступны на Free, поле NOT_TESTED и отдельное решение, не Node proxy вместо него. p50/p95/p99 сопровождать n; маленькая выборка не доказывает SLA.

Reference Free:10ms CPU/HTTP,1s startup,50/query и subrequests,500MB/D1. Текущая документация D1 считает batch одним query, но statements/trigger rows и HTTP считать отдельно. Локальный TASK07 max47 не является результатом облачной матрицы. Проверять actual current limits перед тестами. Накладные запросы harness/relay учитывать, не вычитать их ради прохождения50.

## Время GC и редакций

Default intent expiry900с плюс retention86400с: для естественного GC требуется минимум24ч15м после SQL created_at, с запасом. Не подделывать unixepoch/created_at и не UPDATE immutable timestamps. Можно отдельно согласовать test-only retention3600с при закрытых gates/revision, тогда ожидание минимум1ч15м, но это не проверка default24ч. До фактического ожидания GC-01 не PASS. Заранее состаренная fixture — отдельный технический случай, не естественное истечение.

Компактная редакция гороскопов зависит от `ASTRA_FORECAST_COMPACT_START_DAY`, forecast engine — от `ASTRA_FORECAST_START_DAY`. Их отсутствие означает, что новый слой может не проверяться живым меню. Test-only дату и reset синтетического cache согласовать отдельно до B; не менять production date и не переписывать существующие оплаченные cache/snapshots. Без такой проверки соответствующая часть T-06 остаётся NOT_TESTED.

## Решение по итогам

PASS возможен только для конкретного case/SHA по сохранённому evidence. Непроверенные registered webhook, actual Telegram429, Stars, Cron и production migration не включать в общий PASS. Публичный выпуск требует закрытия критических блокеров и нового решения владельца. Сейчас итог: **NOT_TESTED / STOP-SHIP**, readiness cutover не установлена.
