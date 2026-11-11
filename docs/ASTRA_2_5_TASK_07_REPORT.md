# ASTRA2.5 / TASK07 — итог локальной разработки

11.11.2026. Ветка `astra-2.5-tarot`, исходный HEAD `78bf3eecc0fe1da07ce52d3294ba5376d8105537`. **Локальные критерии выполнены. Публичный STOP-SHIP сохраняется.** Никакого deploy, remote SQL, настоящих Telegram-операций/платежей, смены webhook/Cron/секретов, доступа к сломанной staging, production, main, PR или merge не было. TASK08 не начат.

## Реализовано

1. **Самостоятельные вопросы.** Пять тем, выбор глубины, необязательный согласованный вопрос, цена/баланс до подтверждения, выдача/история и новый независимый вопрос. «Текущий заказ» и «Новый вопрос» разделены. Идентичный request/update повторяет заказ; совпадение темы и формата не сливает разные намерения. Старый запрос после purge не создаёт новую покупку.
2. **Компактный заказ до оплаты.** Закрытые256-битный seed и настройки вместо полного текста/карт. При подтверждении — lease, детерминированное создание sealed, затем прежний единичный INSERT покупки с атомарными debit+ledger. Нет списания до долговечного результата. Сбой после lease/seal/debit не меняет cards/text и не создаёт вторую оплату. Генерация после предварительного списания с последующей компенсацией не вводилась.
3. **Лимиты.** Убраны3/7 новых предложений за сутки и переиспользование всех заказов одной темы. Default5 одновременно открытых unpaid,20 неоплаченных созданий в минутном окне, общий softcap350000000 байт и bounded GC≤20. Оплата освобождает burst-единицу; отмена не освобождает её. Проверены16 покупок за одну дату и массовые1000 unpaid попыток. Новые settings — технические defaults закрытого кандидата, не опубликованная политика.
4. **Конфиденциальность.** Optional question defaultOFF, отдельный env+SQL gate и явная кнопка согласия. Сохраняются версия/время/update/message подтверждения; после оплаты proof в snapshot. До500 знаков, нормализация/контрольные символы/простые sensitive-фильтры, параметризованный SQL, plain Telegram text. Команды/меню/GPT6, включая пробелы вокруг команды, не собираются. Отзыв отменяет unpaid и удаляет его вопрос; /delete удаляет профильные seed/receipts/questions. Старые платёжные исключения и бонусный HMAC30 дней не изменены. Фильтр не является полноценной DLP; сроки/SLA требуют решения владельца.
5. **РедакцияV2.** Реальный MASTER найден и использован: RWS78, VIII/XI, масти/стихии, отдельная reversed логика, роль/тема/соседи. Позиции self/environment/past/tendency/outcome получили явные ракурсы. Практический ориентир связан с выбранной картой/ориентацией/контекстом. Исправлена существенная слабость Кельтского креста: позиция10 больше не подменяет отсутствующий «Совет», используется собственное участие позиции7. В кредитном примере устранён неуместный вывод о праздновании из карты исхода. Улучшена грамматика подстановок. Текстовые версии отделены от deck/art; старыйV1 reader и все старые paid bytes сохраняются.
6. **Авторская колода.** Manifest78 ID/названий/asset_id, separate art version, rotation180 для reversed, проверка SHA/путей/полноты, новые приватные Telegram-производные из тех же оригиналов. Missing assets дают текстовый fallback. Реальных изображений0/78; генерация/загрузка не запускались. Фото-транспорт ещё не подключён: подготовлены интерфейс/инструменты, не обещана готовая визуальная выдача без assets/прав.
7. **Один переход2.0→2.5.** Новая0031, точные bounded manifests/audit, matching single-file Worker, read-only preflight, copy-to-copy runner21…31 сcompat перед25, backup+отдельный restore, возобновление после crash, verified compact copy и bounded SQL package. Старый Worker после0031 не является обычным rollback.

## Финансовые и пользовательские гарантии

Цены существующих3/5 и forecast4, бонусы, рефералы, Stars-код/пакеты, HMAC30, бесплатные карта/гороскоп/число дня, consent28, webhook/Cron и купленные результаты не переписаны. Новые проектные5/8/8/8/14/21/32 остаются прежними и закрытыми. Четыре быстрые самостоятельные покупки с реальным согласованным текстом — доход, расходы, связьA, связьB — дали4 paid snapshots и4 ledger debits, баланс100→74 при5+5+8+8; повтор каждой не списывает снова. Несогласованные/отключённые gates закрывают запись, paid читается независимо от них.

Сравнение с базой подтвердило побайтную неизменность72 защищённых файлов: старые миграции/steps/compat, исторические releases, исходная2.0, каталог/engine/readerV1/spreads/combinations и bonus/payment sources. Новые файлы добавлены отдельно. В0031 forward-only меняются только3 старых DDL definitions: version whitelist offer_guard29, admission30 и post30. Старые purchase guard/post/debit/ledger не заменены; новые metadata guards дополняют их. Удаление paid через unpaid GC запрещено и при FK OFF.

До оплаты не выдаются full text, cards, reversed, private seed или snapshot: DTO, owned/history, callbacks, чужой actor/generation, неизвестные HTTP routes и ошибки проверены. Прямой административный доступ к D1 остаётся доступом к серверным данным; это не криптографическое сокрытие от владельца базы.

## Доказанные исправления интеграции

- Старое слияние по spread/theme и дневная квота не соответствовали независимым вопросам; заменены явной identity и техническими admission-проверками SQL.
- Первоначальный UI-путь свежей покупки попадал в ручной5s cooldown; новая первая доставка использует прежний retryDelivery lease-адаптер. Async ошибки callback ожидаются через await и дают управляемый ответ, а не скрытый HTTP500 после успешной записи. Unknown не повторяется автоматически.
- Completion checks0031 не размножают гигантские вложенные DDL literals без контроля: каждое определение сравнивается целиком через Unicode-фрагменты.133 административных statements, максимум20429 UTF8 байт, проектный ceiling50000, reference D1 limit100000. Повтор файла также проверяет final DDL/OFF gates, не полагается только на migration_done.
- Оба cleanup gates проверяются **до первой фазы DELETE**. Неизвестный исход каждой из двух фаз восстанавливается тем же token; политика retention/revision не подменяется между фазами. Завершённый token читается при OFF без нового удаления. Это две отдельные атомарные SQL-фазы, не одна транзакция всего JS workflow.
- Логический restore создаёт триггеры после загрузки исходных данных, не переисполняя финансовые post-triggers. FK остаются ON/deferred. Типизированные fingerprints дополнительно проверяют сырые TEXT/BLOB bytes, rowid/sequence; согласованный read snapshot и data_version обнаруживают WAL-writer. Подтверждение остановки writers оператором всё равно обязательно.

## Регрессия: что реально запускалось

**2569 выполнений node:test:2214 исторических TASK01–06 +355 на TASK07,0 failed/skipped/cancelled в итоговых логах.** Промежуточные неуспехи до исправлений не включены в PASS. Историческая часть выполнялась через git archive78bf3ee в изолированном `/tmp`, поскольку старые tests пересобирают releases и временно переименовывают0028. Текущие файлы от этого не менялись.

|Текущая suite|Выполнено|
|---|---:|
|Независимые вопросы/идемпотентность/consent/GC faults|34|
|SQL safety/immutable fields/cap/owned/proof|19|
|Upgrade/recovery/compact/WAL/непустой consent28|22|
|Все78×2, пять контекстов, роли, reader/art/Celtic|170|
|Native WAL2/20/100 create/confirm, FK ON/OFF|12|
|Raw Worker UI/leaks/errors/callbacks/budget/mobile fixtures|18|
|58k archive/HMAC/partial/пагинация и budget|9|
|Настоящий SIGKILL lease/seal/debit и0031 boundaries|5|
|Pillow производные без изменения оригинала|1|
|Перенос прежних финансов/покупок, menus, refunds/GPT6/forecast|39|
|Compatibility/recovery/orphans/referrals|21|
|Pinned Wrangler compiled bundle|5|
|**Итого новых**|**355**|

Из355 **52 кейса вызывают raw TASK07 Worker**:302 fetch и1 scheduled; остальные не выдаются за end-to-end Worker. Compiled bundle проверен5 кейсами:4 default export и1 named cleanup. Он получен локальным Wrangler4.45.0 `--dry-run`, с фиктивным DB binding и всеми flags false. Ни deploy, ни облачного startup/CPU теста не было.

Дополнительно отдельно от355:4 реальных CLI сценария;2 replay именно выданных SQL packages в отдельные SQLite, включая сохранённый paid3 с NUL/combining Unicode;2 Chromium viewports320/360;1000 интерпретаций для редакционного аудита; stock10000 и500 cleanup runs. Пять SIGKILL уже входят в355, повторно не прибавляются. Старые standalone assertions исторической регрессии не суммируются с node:test executions.

Проверены все7 цен/форматов, старые3/5 и forecast4 дословно, бесплатная карта, шесть разделов, GPT6, старые ON без inferred consent, настоящий синтетический grant28 с последующим28→31, /stop и stale challenge, /delete/новая generation, synthetic Stars refund после расходования/долг/следующее пополнение. Реальных invoices или Telegram callbacks не было.

Новые тесты используют native SQLite/WAL и независимые соединения без JS mutex; Telegram — строго fake transport. Mobile preview содержит реальные тексты/кнопки fake API, Chromium проверяет отсутствие горизонтального overflow. Это не native Android/iOS и не настоящий Telegram.

## Репетиции данных и хранения

- Чистая2.0:20 профилей, каждый баланс сохранён, сумма444→444. Созданы opening ledger entries по правилу0021, не выдуманы прежние транзакции2.0. Source неизменен; backup отдельно восстановлен.
- Исторические состояния всех этапов распознаются; compatibility исправляет только orphan referrer links, не награды. Partial/foreign/schema drift и неоднозначный outcome вызывают STOP. Повтор завершённого runner read-only.
- Старые paid3/5/forecast и исторические rows проверены буквально; непустой добровольный consent28, его поколение и все source tables сохранены после31. Исходная2.0 не хранила paid тексты — отсутствующее не восстановлено магически.
- Stock fixture:10000 unpaid+1 RWS paid, плюс прежняя история; сумма505→505. Старый большой payload специально повторён для storage, это не редакционный тест разнообразия. После0031 и500 bounded runs удалены ровно10000 unpaid; paid/26 ledger rows и10001 компактных receipts сохранены.
- DELETE оставил файл664072192 байта. Verified compact restore дал4870144 байта, сохранив типы/байты/rowid/sequence/деньги. SQL package21578 statements, максимум28398 байт. Это отдельный локальный compact proof, не D1 quota/reclaim и не разрешение чистить живую базу.
- NUL/Unicode paid3 отдельно прошёл полный CLI upgrade и буквальный SQL replay, сумма441 сохранилась. Большие ячейки экспортируются bounded chunks с unhex; реальная D1 совместимость ещё не подтверждена.

## Редакционная приёмка

MASTER действительно найден. Девять полных результатов с вопросами/картами/источниками и индивидуальным разбором слабостей — `ASTRA_2_5_TASK_07_SAMPLES.md`. Для1000 раскладов:4852 карты,1000 разных полных текстов,2076–6502 codepoints,3204 разных позиционных абзаца;1648 повторных вхождений позиционного текста,3708 повторных абзацев всех типов,0 точных повторов абзаца внутри одного расклада. Fallback complement1495/3852 связей, same-movement1093. Именованные пары редки при свободном draw. Семантическая уникальность не доказана; общие правила/значения закономерно повторяются, искусственные синонимы не добавлялись.

Примеры не являются доказательством предсказаний. Слабости названы явно: словарный focus не понимает биографию; общие связи иногда слишком широки; reversed Семёрка Мечей может звучать предполагающей скрытность;10-карточные/финансовые тексты требуют экспертного чтения владельцем. Это ограничения закрытого кандидата, а не обещание безошибочного персонального анализа.

## Ресурсы и оставшиеся блокеры

Максимум текущей консервативной матрицы **47 SQL+HTTP≤48**, запас3 до50. Cold реальное подтверждение Celtic10:26 SQL+5 HTTP=31; повтор оплаченного15+3=18. Триггерные rows/индексы отдельно, не равны сетевым subrequests. Текущая официальная D1 документация считает batch одним query; наша сумма statements+HTTP строже. Node CPU proxy не равен Workers isolate CPU и включает локальный SQLite; реальных CPU/1102/startup/rows_read/rows_written/size_after нет.

Официальные docs прочитаны из Cloudflare GitHub production ref081afc3 после403 основного сайта. Free:10ms CPU,1s startup,50 subrequests/D1 queries,500MB одна D1,5GB/account,5M read/100K written/day,7 дней Time Travel. Нужно отдельно доказать lossless получение локального source из настоящего D1 export (включая существенные rowid/служебные объекты), проверить точные SQL/PRAGMA/unhex, атомарность administrative import, restore, actual metrics и Telegram test environment. Отсутствие поддержки PRAGMA должно закрыть admission, не обходить финансовые/softcap guards.

Для владельца: утвердить цены новых услуг, max_open/burst/retention/cap/GC SLA, правовые условия optional questions/платёжных записей, поддержку/Terms/privacy, редакционные образцы и права на78 assets. Затем отдельное разрешение на совершенно новую синтетическую D1/бота и измерения. Не подключать настоящие Telegram-профили к функциональному тестовому боту. Paid/receipts растут со сроком жизни профиля; сама очистка unpaid не гарантирует вечно бесплатное хранение.

**Локальный кандидат подготовлен. Публичные продажи/cutover/production пока NO-GO.** Возможность безопасной реальной установки доказывается будущей изолированной платформенной приёмкой с gatesOFF, backup+restore и writer fence, не этим локальным PASS.

## Где смотреть и как повторить

- UX/хранение/A–B: `ASTRA_2_5_TASK_07_TAROT_UX.md`.
- Методика и реальные примеры: `ASTRA_2_5_TASK_07_EDITORIAL_AUDIT.md`, `ASTRA_2_5_TASK_07_SAMPLES.md`.
- Изображения: `ASTRA_2_5_TASK_07_DECK_INTEGRATION.md`.
- Пошаговый единый перенос: `ASTRA_2_5_TASK_07_UPGRADE_20_TO_25.md`.
- Платформенные probes, ручной checklist и решения: `ASTRA_2_5_TASK_07_GO_NO_GO.md`.
- Машинные proofs: `data/astra25-task07-{verification,protected,budget,budget-stress,editorial,mobile,mobile-browser,official-docs,runtime,storage,cli}.json`.
- Код: `src/tarot25/*31.mjs`, `engine-v2.mjs`, `reader-v2.mjs`, `ui07.mjs`, `compat-ui07.mjs`, `art07.mjs`; SQL0031, schema31/plan/bounds manifests, local runner/compact/build/audit/tools и tests.

Текущие suites: `ASTRA25_TASK07_WRANGLER_BUNDLE=/absolute/tmp/astra25-task07-dryrun-.../bundle/ASTRA_2_5_TASK07_CANDIDATE.js sh scripts/test-astra25-task07-current.sh`. Предварительно только локальный dry-run через `scripts/check-astra25-task07-wrangler.sh` с pinned tool-root. Standalone: `sh scripts/test-astra25-task07-cli.sh`; `node --experimental-sqlite scripts/audit-tarot31-storage.mjs --local-only 10000`; `python3 scripts/check-tarot31-mobile.py`. В среде Chromium потребовался разрешённый локальный запуск вне sandbox; file:// заблокирован политикой, поэтому HTML загружается через set_content с блокировкой сети.

Historical2214 воспроизведены на архиве78bf3ee через TASK06 wrapper и три прежних offline bundles. Воспроизводить исторические скрипты в отдельной копии с корректным GIT_WORK_TREE; не давать им менять текущие releases/0028. SHA всех итоговых логов/артефактов и точный состав suites записаны в verification JSON; локальные логи были в `/tmp/astra25-task07-final-review`, исторический wrapper-log `/tmp/astra25-task07-history.log`. Последние дополнительные тесты существующих suites заменили их итоговый лог/trace, не удваивая счётчик.

Итоговый Worker SHA256 `018d2eda3fc13a7a0f85fffcc6e1c866a9901bfb2e8dcce5e1bd6d184d6f8bda`, 2019722 байт /gzip9 340386; compiled `74ad11ccb7d4bdd43bbee6d0eca994b50a9dfd8627a4d24aafb64bf3857a42ac`, 2896093 байт /gzip9 349409. Миграция0031 SHA256 `f69aa193302d5332994c3a37184a558ffcce599ccef7f18fd3199545b1652afb`; plan `83f75d7cfd00b27876f7fba2c6c3519233be4f2edd676f58757d696a079faa3a`. Commit SHA публикации указывается в сообщении о завершении, чтобы не создавать самоссылочный hash.
