# Astra 2.5.1 · результаты локальной реализации PR №8

Состояние: **локальная реализация завершена; production/staging не изменены; реальные Stars OFF. STOP перед облачной установкой/платежами.** Ветка `review/astra-2.5.1-stars-admin-audit`, исходный HEAD43e3871. Дата владельца:14 ноября2026 (Москва).

## Исправленные замечания

**Таро.** Путь «Новый вопрос → тема → Три карты» воспроизведён на исходном TASK07 Worker с SQLite authorizer, запрещающим `page_count` как опубликованный workerd. BEFORE INSERT `astra_tarot31_intent_insert` обращался к `pragma_page_count`; запрос падал до появления intent/purchase, UI скрывал ошибку общим сообщением. Ещё два live-trigger имели тот же unsupported вызов. `new:` не является исправлением: legacy parser понимает bare32hex и new:32hex одинаково. В0032 эти три проверки заменены на учёт хранимых payload с SQL admission и native D1Result.meta.size_after при записи; отсутствие/устаревание метаданных закрывает новую покупку, а не подставляет0. Исторические миграции не менялись. Без чтения production нельзя утверждать, что получен её stack trace: причина доказана воспроизведением и исходниками платформы.

Источники ограничения: [официальные D1 SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/) и [workerd sqlite allowlist](https://github.com/cloudflare/workerd/blob/main/src/workerd/util/sqlite.c%2B%2B), `ALLOWED_PRAGMAS`/`SQLITE_PRAGMA`; page_count отсутствует. Тест на исходном bundle падает в том же месте, новый Worker проходит с тем же запретом. В публичном delta-компиляторе также проверены/переписаны dynamic imports в существующий module loader — иначе локальный replacement-фабрики не находил text29 при доставке. Это покрыто полным сценарием.

**Авторизация владельца.** Приватный 256-bit challenge → проверенный существующим webhook приватный message → профиль+generation+bot/build scope → HMAC proof → локальная подпись/receipt → env ID, извлечённый только из proof. Набранный ID/username не создаёт права. Missing/wrong header, from≠chat, bots, groups/channels, forwards/via_bot, edited messages, чужой username, HTTP injection, плохая сумма и stale/collision проверены. После удаления владельца SQL отзывает authority, новое поколение не наследует старые права.

**SQL.** Проверяются все323 canonical application DDL, включая новые admin таблицу и все guard/post/immutable/delete-trigger, количество и неожиданные объекты. Единственные системные исключения — sqlite internals и штатная `_cf_KV`, как в исходной D1. Нет исключений для новых admin объектов и name-only проверки. Readiness503 и запрет grant при испорченном core/admin DDL подтверждены. Миграция сначала проверяет все286 старых определений, не переписывает пользовательские/финансовые данные. Баланс, positive ledger и существующий refund-debt repayment выполняются в одной INSERT-транзакции. SQL защищает тип/range, actor/profile generation, owner transition и write-once receipts. D1-admin с возможностью менять произвольный SQL по определению имеет полномочия администратора БД; SQL не подменяет проверку webhook/HMAC в Worker.

**Stars.** Реальные обработчики — уже существующие TASK01 create/sendInvoice/precheckout/success/refund/reconcile, а не устаревший список пакетов transport.v1. Новая проверка стоит и в фактически собранном paymentEnvironment: exact schema, bot/scope, предложенные support/terms/365, оба gate и отдельные approvals. Оба gate OFF допускают core ready200; mismatch/неутверждённые продажи дают503. STAGE больше не включает Stars, не проставляет live/policy approvals и не загружает secrets. Старые order snapshots100dust сохранены; новые при тестовой конфигурации40/110/240. Поздняя квитанция не блокируется выключением магазина.

## Дополнительные исправления

- SQL NULL-fail-open переходы владельца закрыты coalesce; transient FK SET NULL корректно переводится в revoked.
- Удаление storage singleton запрещено, growth вопроса проверяется, stale native measurement не переиспользуется, overflow balance не превращается в REAL.
- Native physical overhead сохраняется high-water вместе с логическим счётчиком. Удаление payload не изображает уменьшение физического файла. Это консервативный admission, **не** доказанная атомарная верхняя граница физического файла при произвольном росте других таблиц; настоящие D1 cap/CPU ещё нужно проверить.
- После /delete raw operator/target ID новой grant-квитанции обнуляются с FK ON и OFF. Номер update, сумма/время, random generation и HMAC запроса остаются для запрета повторного начисления; это прямо раскрыто в /privacy. Платёжная retention/долги остаются прежними, не стираются молча.
- Частичная ошибка ответа/изображения не вызывает повторное списание и автоматическую пересылку неизвестного результата; бесплатная явная история служит восстановлением.
- Windows tools не трогают owner/SACL, используют существующий проверенный ACL helper; приватные вход/выход запрещены внутри Git и на link/hardlink. Исходный Worker и registry не перезаписываются; package/parent/output/SQL/registry SHA обязательны. На Linux модель проверена, Windows GUI и настоящий private parent **NOT_TESTED владельцем**.
- Независимый read-only reviewer нашёл возможность plain ASTRA_ADMIN_KEY в staging vars и конфликт имён bootstrap/owner plan. Оба исправлены и покрыты Python tests. Его итоговое заключение не получено из-за лимита сервиса; это **не security sign-off**. Повторный внешний review запрашивается в PR.

## Выполненные проверки

Node24.22.1 (22+), nativeSQLite; только фиктивные данные и перехваченный HTTP.

- **83/83** новых JS-проверки: 3 core,18 flow/budget/root-reproduction,15 payments,42 security,5 SQL/migration/integrity. Из них SQL/concurrency/build tests не следует выдавать за Telegram E2E; проверки actual patched Worker находятся в core/flow/security/payments.
- **19/19** Python: SHA/template/registry preservation, изменённая подпись/ID/bot/build/challenge, links/Git/ACL failure, closed stage gates, сохранение текущих vars/logs, запрет plain secrets/extra asset upload и обязательная последовательность bootstrap→proof→owner-stage.
- **3/3** дополнительных core-проверки повторены на output локального pinned Wrangler4.45 dry-run. Никакого upload/deploy/cloud вызова не было. Будущая команда owner versions upload4.162 проверена статически, но **не выполнялась**.
- SQL0032: сохранены byte-identical старые paid3/paid5/forecast4/GPT6, payment snapshots/ledger и остальные исходные таблицы; повторное применение останавливается до мутаций; испорченная исходная схема закрыта.
- 20 конкурирующих webhook одного grant и8 независимых SQLite-подключений: один grant, одна ledger-запись, один кредит. Ledger failure откатывает receipt и credit. Ошибка sendMessage не повторяет начисление.
- Платёжные моки: реальный XTR invoice JSON, пустой provider_token, цена до согласия, wrong/forwarded payer precheckout, duplicate/late successful_payment, D1 failure→retry, refund после расходования, debt-first grant, refundStarPayment unknown/reconciliation/getStarTransactions, старый snapshot и удаление.
- Все7 форматов с text+art flow через fake Telegram и последующими HTTP failure checks; оплата один раз, бесплатное чтение, бесплатная карта дня/прогноз/число, сохранённый расширенный4 и Cron quarantine.
- Все72 protected historical файла по TASK07 manifest совпадают. Миграции0021–0031, frozen Workers, каталог/символический forecast/paid reader не переписаны.

Полная регрессия: **2114 тестов:2012 PASS,101 FAIL,1 SKIP**. Все101 FAIL в9 старых suites воспроизводятся с теми же количествами на неизменённом исходном43e3871, проверенном отдельным git archive в /tmp. Не объявляем всю историческую регрессию зелёной. Старые suites включают устаревшие2.4 fixtures против нынешнего Worker, ожидание отсутствия0028 и старые source hashes. Первые ошибки выбора старых Wrangler bundle устранены повтором на правильных pinned dry-run outputs; четыре dedicated legacy bundle-suite проходят. Машинный отчёт содержит file-by-file счётчики и baseline comparison. Не делали новые expected values ради скрытия ошибок. Любой новый finance/auth FAIL был бы BLOCKED; в новых83 таких сбоев нет.

Команды новых проверок указаны в README. Весь исторический набор запускался по файлам `node --experimental-sqlite tests/FILE.test.mjs` в отдельных процессах с двумя параллельными процессами; три старых generate-evidence файла восстановлены побайтово после тестов. Legacy Wrangler suites требуют явные ASTRA25*_WRANGLER_BUNDLE из соответствующих локальных dry-run builds. Полный первый `node --test tests/*.test.mjs` запуск также выявил отсутствующие bundle env; его результаты не подменены PASS без повторной проверки.

## Ресурсы и оставшиеся ограничения

Синтетическая итоговая сборка≈2.83MB raw/451KB gzip; это меньше3MiB gzip Free budget. Подтверждение basic/relations/work/choice —28 SQL+5 HTTP=33;5/7/10cards —29+6=35 консервативных операций. D1 batch посчитан по statements, не как один subrequest. Это меньше50 в измеренных локальных cases; не гарантия всех будущих нагрузок. Native size_after в fixtures задан явно как модель, не измерен в Cloudflare. `data/astra251-verification.json` содержит scope и NOT_TESTED.

**NOT_TESTED:** actual D1 SQL0032/rollback/import-export; Cloudflare CPU10ms/startup/rows/storage/1102; Windows GUI/ACL на реальной машине после этого патча; exact private Worker parent/output на машине владельца; private bot owner claim; Telegram dedicated test payments/refunds; актуальный snapshot runtime. Core health проверяет operational conditions, не сертифицирует реальные измерения платформы. /health200 не заменяет перечисленные проверки.

До установки нужны проверенный backup/restore, freeze и актуальные настройки, разрешения на0032/0%-upload/bootstrap traffic. Старый Worker требует286DDL и не является обычным откатом после0032. После новых финансовых записей запрещён restore старого состояния без сверки. Shop production **BLOCKED** до утверждения цены/условий365 и реального dedicated test environment; публичный запуск не объявлен готовым. Реальные токены/ID/колода не нужны Codex и не запрашиваются.

## Последующая проверка фактического экспорта

Владелец скачал backup из нужного UUID, затем `wrangler d1 execute --local` вернул `no such table: main.astra_users`. Рабочая D1 этим локальным вызовом не менялась. Воспроизведён механизм: interleaved dump делает INSERT в дочернюю таблицу до CREATE родительской. Добавлен маленький локальный reorder/restore/rehearsal-инструмент, сохраняющий все исходные DDL/data statements по hash-multiset, без отключения FK или переписывания сумм. Триггеры возвращаются только после загрузки данных, чтобы не повторять финансовые операции. Полный исходный файл владельца не читался и не запрашивался.

Дополнительно выполнены8/8 тестов: исходный failure, исправленный restore, FK-negative, Unicode/quotes/semicolons, отсутствие replay триггеров, отказ неизвестнымSQL, полный286→323 с синтетическим1/4 и сохранением input/старых таблиц. Повторены19/19 Python regressions. Это дополнение к ранее записанной полной регрессии, не новый запуск всех2114 тестов. Результат на Windows владельца ещё ожидается; cloud/production остаются без изменений.

## Исправление режима проверки активного каталога

Владелец получил `LOCAL_RESTORE_INTEGRITY_TAROT29_AUDIT_FAILED`. Локально воспроизведён дефект старого аудитора: `validateDatabase25(...,{closed:false})` всё равно выполнял безусловный `catalogue_not_off` из исторического import-аудита. На корректной синтетической схеме286 с enabled1 все schema/tariff/wallet/paid проверки были нулевыми, но именно этот gate давал1. Данные владельца в Codex не читались; окончательный результат его backup ожидается после обновления инструмента.

Исправлен только режим read-only проверки уже работающей копии: вместо требования OFF проверяется singleton, допустимый enabled0/1 и migration_done1. Флаги и данные не меняются. Default closed:true по-прежнему требует OFF. Не редактировались исторические SQL-аудиты/миграции, Worker или публичный delta. При других сбоях теперь показывается безопасное имя конкретной проверки (`tariff_data`, `schema31/N` и т.п.), без SQL, ID или текста пользователя.

Проверены положительный active backup и отрицательные случаи испорченной цены, баланса/ledger, DDL, незавершённой миграции и отсутствующего singleton; все по-прежнему STOP. Повторная репетиция286→323 покрывает и OFF, и ON с сохранением4 пыли и всех исходных таблиц. Всего для этой правки фактически выполнены107 JS и20 Python проверок, все PASS (выбранные релевантные suites, не новый полный прогон2114). Команды/счётчики — `data/astra251-active-backup-verification.json`. Все72 protected файлов совпали. Настоящая D1, Telegram, текущие флаги и приватный Worker не изменены.
