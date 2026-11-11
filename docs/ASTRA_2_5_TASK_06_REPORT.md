# Astra 2.5 TASK06 — отчёт о локальной приёмке

11 ноября2026. Ветка `astra-2.5-tarot`, основа `d7aeb27379df723644c56571850f0aa3c39a183f`. **Локальная приёмка выполнена. Публичный STOP-SHIP сохраняется.** Ни deploy, ни remote SQL, ни реальных D1/Telegram/платежей, ни изменения webhook/Cron/секретов/production, ни PR/merge не было. Старую повреждённую staging не использовали. TASK07 не начат.

## Реализация

Добавлены forward-only `0030_tarot_retention.sql`, matching TASK06 Worker, точный DDL/migration manifest и v3 локальный copy-to-copy runner. Старые0021–0029, compatibility v1, финансовые таблицы/триггеры оплаты и существующие release-файлы неизменны. У старого offer DELETE guard меняется только разрешение строго проверенной очистки unpaid; paid/ledger проверяются независимо от FK.

Политика **только для испытаний**: TTL900с прежний; дополнительное хранение86400с;3 новых предложения на профиль/московские сутки; batch20; soft cap350000000 байт. Новые SQL write/cleanup flags0, test-mode envOFF; RWS продажи/Stars/экономика/уведомления OFF. Значения конфигурируемые, изменение требует закрытых storage gates и новой revision. Прежние3/5, forecast4, бесплатные карта/гороскоп/число, GPT6, бонусные права, согласия и оплаченные снимки сохраняются.

Повтор request_key/update_id возвращает прежний snapshot. Новый запрос того же действительного unpaid формата/темы переиспользует его без нового draw и расхода квоты. Для каждого запроса/alias хранится компактное доказательство вместе с профилем; после purge оно запрещает повторно создавать заказ старой кнопкой. Отмена, expiry и cleanup не возвращают дневную квоту.

Счётчик SQL увеличивается атомарно с INSERT предложения. Отдельный дневной HMAC защищает от сброса через /delete; это новый домен на существующем webhook secret, не изменение бонусного HMAC30дней. После удаления профиля receipts/bindings удаляются, дневной счётчик не содержит Telegram ID. Он псевдонимизирован, не обезличен; физически удаляется отдельной процедурой после утраты пригодности. При OFF test-mode прежняя privacy выдача прежняя; в trial каталоге и /privacy добавлено точное объяснение. Для реального сервиса это исключение ещё требует утверждения.

Cleanup — один атомарный SQL INSERT с заранее сохранённым caller token. Внутри выдаются claims только для expired+retention unpaid текущего владельца/generation, повторно проверяются status/даты/политика, paid и ledger. За run удаляется≤20 строк offers+старых quota. Claims не остаются после COMMIT. Повтор того же token возвращает агрегат, не следующую партию. В audit нет ID/вопросов/текстов. Нет HTTP-маршрута, вызова из webhook или scheduled; named exports нужны явному локальному harness.

## Обнаружено и исправлено

1. Загрузка всех payload через `.all()` в прежних fingerprints непригодна для заполненного stock600+МБ. Новый v3 читает по строке, сортирует фиксированные SHA, сохраняет контроль rowid/sequence и точную разрешённую B1-проекцию. Заполненная29→30 прошла при `--max-old-space-size=256`. Старые журналы не подставляются в `.task06`.
2. SQLite TEXT PRIMARY KEY без NOT NULL допускает NULL. Для token/ключей добавлены NOT NULL, для счётчиков/настроек — целочисленные CHECK. Проверены прямой SQL и REPLACE: нельзя оставить незавершённое разрешение или сбросить текущую квоту.
3. Quote после OFF→ON каталога может быть жив по TTL, но устареть по policy revision. Reuse фильтрует актуальную revision/price version; старый unpaid запрос/confirm получает понятное сообщение. Новое меню создаёт свежий quote, paid открывается без повторной оплаты. Тесты также выявили ошибочную ссылку на отсутствующее NEW.policy_revision в receipt guard; она исправлена до итоговой приёмки.
4. Первый монолитный completion-trigger был164877 байт — выше reference D1 statement limit100КБ. Проверки разделены на7 частей, все223 core определения и primary completion продолжают сравниваться точно. Runtime/runner manifest проверяют сами тела всех частей. Максимальный statement28413 байт; SQL-аудит также bounded. В административной миграции61 statement; она не исполняется через Worker invocation с лимитом50. Настоящий D1 административный инструмент и транзакционные границы ещё требуют отдельной проверки.

## Репетиции и финансовая сохранность

- Чистая2.0→21–29 сcompat перед25→30:20 профилей, каждый баланс сохранён, сумма444→444, исходный файл неизменен, backup и отдельный restore проверены. Порядок фактически21/22/23/24/compat/25/26/27/28/29/30.
- Исходная2.0 с удалённым реферером:19 профилей,436→436; только3 отсутствующие ссылки стали NULL, paid/pending признаки и действующие связи сохранены.
- Historical26:537→537; все исходные таблицы, старые3/5, GPT6, forecast4 и Stars proof сохранены побайтовыми fingerprints, не выдумана история2.0.
- Заполненная29 с10000 unpaid и одним paid: все исходные таблицы/балансы/ledger/snapshot сохранены при0030, затем очищены ровно10000 unpaid. Paid остался. Repeat/restore/low-heap доказаны.
- Все7 новых форматов приобретены в отдельном локальном сценарии по прежним проектным5/8/8/8/14/21/32, по3/3/1 предложения в три моделируемые даты. Каждый debit один, суммарно96; баланс100→4. После отключения всех flags каждый snapshot читается бесплатно и дословно.

Первоначальная2.0 вообще не сохраняла paid тексты в D1; отсутствующие материалы не «восстановлены». Fixtures сохранённых результатов вводились только после соответствующих исторических миграций.

## Регрессия

Историческая часть выполнена на git archive базового d7aeb27 в отдельном `/tmp`: старые tests переименовывают0028/пересобирают releases, поэтому их изменения изолированы от текущей рабочей копии. Новые tests отдельно вызывают TASK06 и настоящий native SQLite/WAL, а не заменяют SQL JS mock.

- **1963 исторических node:test executions** TASK01–05; дополнительно210 прежних standalone assertions.
- **251 новый кейс:** upgrade40, recovery62, compatibility21, business39, UI/budget32, payment concurrency6, unit10, SQL safety13, storage concurrency13, Worker integration7, streaming/filled/bounds4, compiled bundle4.
- Всего **2214 node:test executions**,0 failed/skipped/cancelled в итоговых логах. Предыдущие промежуточные неуспехи не засчитывались в приёмку.
-70 кейсов вызывают raw TASK06 fetch/scheduled;4 проверяют compiled bundle (один — named cleanup entry), ещё1 unit-кейс вызывает raw named cleanup/preview. Остальные — native SQL/adapters/migration, не выдаются за end-to-end Worker.
-2/20/100 конкурентных create: разные форматы, один формат, один request. SQL не превышает default3; повтор одного формата даёт единственный sealed winner.2/20/100 конкурентных подтверждений — один debit/результат.
-20 WAL connections одновременно создают, оплачивают и очищают при FK ON/OFF; snapshot оплаченного сохранён, старые expired удалены. Проверены удаление профиля, generation и поздний Telegram update после purge/очистки dedup.
-4 новых настоящих SIGKILL: миграция0030 до/после COMMIT; cleanup до/после COMMIT.3 новых CLI plan/apply/repeat. Они считаются отдельно от2214.
- Ошибки Telegram400/403/429/500, timeout, unknown ACK, частичная доставка58000, D1 до/после записи, FIFO/партии, отмена/expiry, cap, key rotation, NULL/fractional config, stale policy, immutable snapshots и ручное чтение проверены. Все исходные байты архива восстанавливаются за5 ручных страниц без оплаты.

Исторические PASS включают намеренные воспроизведения B1 и старого TASK03 budget49. Это не приёмка прежней ошибки. Новые критерии подтверждаются отдельными TASK06 suites. Воспроизводимый wrapper — `scripts/test-2.5-task06.sh`; в этой сессии его составные команды запускались отдельно, включая изолированный historical archive, current suite с bounded offline bundle, rehearsal, большой storage audit, runtime audit и verifier. Окончательные SHA логов/артефактов — machine verification.

## Хранение: реальные локальные измерения

МБ ниже — десятичные, размер целого SQLite файла. Это **не D1 bytes**.

|Контрольная точка|TASK05: N неоплаченных Celtic10|TASK06: N попыток за одни сутки, default3|TASK06: N реальных Celtic10, по одному в моделируемую дату, cleanup|
|---:|---|---|---|
|100|7.45 МБ; 100 unpaid|1.08 МБ; 3 unpaid|1.67 МБ; 2 unpaid + 3 paid|
|1000|67.53 МБ; 1000 unpaid|1.21 МБ; 3 unpaid|2.32 МБ; 2 unpaid + 3 paid|
|10000|668.54 МБ; 10000 unpaid|2.45 МБ; 3 unpaid|8.94 МБ; 2 unpaid + 3 paid|

Нагрузки различаются намеренно и явно: в rate-mode после10000 попыток существует только3 новых draw, остальные успешные ответы — reuse; это не10000 созданных предложений. Первые3 формата в этом workload — трёхкарточные. В lifecycle-mode действительно созданы10000 десятикарточных draw при default3; первые3 оплачены по32,9995 unpaid удалены,2 ещё находятся внутри retention.7 форматов отдельно проверены интеграцией и rehearsal.

Полезные результаты:

- Без очистки10000 unpaid содержат около655,6МБ payload и занимают около668,5МБ файла.
- После миграции и500 bounded runs unpaid0, paid1 сохранён, receipts10001 остаются компактными. Логически освободились payload/страницы, но файл около673,4МБ; около668,9МБ страниц reusable, active-page оценка около4,46МБ. Это не физическое уменьшение файла и не доказательство освобождения D1 quota.
- В жизненном цикле10000 реальных draw файл около8,94МБ, unpaid payload около132КБ, paid3. Видим оставшийся рост metadata:10000 receipts/bindings/days/runs. Он не замаскирован под нулевое хранение.
- Rollback очистки восстанавливает stock целиком; неизвестный результат COMMIT восстанавливается тем же token. Оплаченные hashes и финансовые fingerprints сохранены во всех режимах.
- Legacy stock выше soft cap безопасно блокирует новые предложения даже после освобождения страниц. Для компактного переноса нужна отдельная проверенная процедура, не произвольный VACUUM/dump на живых данных.

Точные counts, UTF8 payload/column-value bytes, page_count/freelist, file bytes и adapter statements — `data/astra25-task06-storage.json`. Metric SQL и setup отделены от счётчиков adapter calls.

## Бюджет и ограничения платформы

Максимум обычной измеренной стресс-матрицы **47 SQL+HTTP≤48**, включая финализацию update. Резерв до50 —3. Создание настоящего cold Celtic10 в runtime proxy:26 SQL+3 HTTP=29. Cleanup20:5 top-level adapter SQL,0 HTTP,20 удалений. Триггерные инструкции/rows — отдельная нагрузка, не сетевые subrequests.

Node proxy: cold import около71мс CPU, cold Celtic offer около21мс, cleanup20 около4мс. Эти значения включают Node/native SQLite, не равны Workers isolate/D1 server CPU и не доказывают10мс Free. Реальные CPU/1102, rows_read/rows_written, D1 consistency/транзакции/PRAGMA и billing не измерялись. При неподдерживаемом PRAGMA новые записи fail closed; saved read остаётся доступен, это отдельно проверено.

## Артефакты и решения

`release/ASTRA_2_5_TASK06_CANDIDATE.js`,0030, schema/migration/bounds manifests; source modules storage30/purchases30/retention30/ui06; generators, v3 runner, native tests/WAL/crash/CLI, audit/rehearsal/runtime/verifier. Машинные отчёты — `data/astra25-task06-{verification,storage,rehearsal,runtime}.json`. Политика и инструкции — `ASTRA_2_5_TASK_06_RETENTION_POLICY.md`, `ASTRA_2_5_TASK_06_STAGING_NOTES.md`.

**На утверждение владельца:** retention24ч после expiry; default3 либо7/сутки для удобного просмотра семи форматов (рекомендуется обсудить7, но default не изменён); soft cap350000000 байт; batch≤20; privacy notice/SLA физических HMAC deletion, сроки компактных receipts и агрегатов, operational job/token/alerts. Альтернатива7 проверена отдельным тестом, не включена самовольно.

Остаются блокеры реального выпуска: платформенная приёмка на совершенно новой изолированной D1 и dedicated Telegram test environment; поддержка/атомарность административной миграции61 statement; actual CPU/rows/quota; отдельный compact-restore proof для legacy stock выше500МБ; утверждение реальной политики/цен/уведомлений. После0030 прежний TASK05 не является совместимым обычным rollback для RWS: он должен отвергать изменённую схему. Нужен matching forward fix или отдельно испытанный restore с reconciliation поздних событий, /delete и consent.

**Только локальная приёмка TASK06 завершена. Очистка реальных данных и публичный запуск не разрешены. TASK07 не начат.**

Финальные SHA: Worker `b7550dc682c4f0b42ff0c823c2de752a7e76e612af2f6dbe56d1456bf2c4b984`; raw 1585554 байт /gzip9 279620; compiled offline bundle `9028b47dab6924e8a2e0c15eef3d380a2abeb423e8cde66731fe71ba1ae6bc46`, 2440653 байт /gzip9 286571; migration0030 `fe4db93e95f0487e1c64a192e3848da9424e31c55b66e227020237d95c83d227`; plan `8c1f2782c300d9ae620568b6519da872f94fec3a3d0331461fc11dcc34d09982`.
