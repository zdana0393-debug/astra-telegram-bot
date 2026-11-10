# ASTRA 2.5 — TASK 02: аддитивная 0029 + атомарные покупки новых раскладов
**Подготовлено:** 2026-11-10, после ревью TASK01 (`bb07381424300a75f06de6147ea22aabd5401600`).
**Режим:** разработка, локальные тесты, отчёт, commit+push `astra-2.5-tarot`. Никаких действий в Cloudflare, настоящем Telegram, D1 remote, Stars, Cron, production; никакого PR/merge. TASK03 — Telegram UX; TASK04 — проверенный переход реальной 2.0 и изолированная облачная приёмка.

## Прежде чем писать код
1. Прочитать `docs/ASTRA_2_5_TAROT_ROADMAP.md`, `docs/ASTRA_2_5_TASK_01_REPORT.md`, `docs/ASTRA_2_5_TASK_01_API.md`, `docs/ASTRA_2_4_TASK_06_REPORT.md`, `docs/ASTRA_2_4_TASK_06_STAGING_ADDENDUM.md`, `docs/ASTRA_3_0_SPEC_v0_2.md` (раздел5), плюс реальные `migrations/0026_steps/05_tarot.sql`, `src/tarot25/`, `release/ASTRA_2_4_WORKER.js`, базовые `migrations/0024–0028`, существующие скрипты проверки целостности.
2. Создать карту всех текущих путей оплаты/баланса/ledger/идемпотентности/доставки (2.1, 2.4A, 0026, update jobs, legacy3, forecast4, Stars, refund/debt, consent28). Задокументировать **реальные SQL ограничения** перед предложением 0029.
3. Принять следующие неизменяемые правила: basic3 ныне5✨; старая 3✨ и новая 5✨ покупки в существующей базе остаются навсегда доступны дословно без доплаты; старая 22-card бесплатная карта дня и прогноз4 не меняются; `astra_tarot_offers26` и `astra_tarot_purchases26` содержат `CHECK(price=5)` и триггер `balance-5`. **Не трогать их, не снимать CHECK и не менять 0021–0028.**
4. Важное ревью TASK01: `validateSnapshot` вызывает текущие `getCard/getSpread`; поэтому утверждение о независимости replay от каталога надо ограничить. В TASK02 обеспечьте явный неизменяемый контракт reader v1 для будущих записей (старый текст не пересоздавать), тесты совместимости при будущей смене контента/версий и корректную проверку покупательского/пользовательского права на чтение. Не объявлять структурную проверку подписанным доказательством оплаты.

## Объём TASK02
**A. Миграция0029 (только аддитивная)**:
- Предложить и реализовать отдельные `astra_tarot25_*29` (имена выбрать после аудита), позволяющие хранить: owner TelegramID + generation, stable request key/update ID, immutable offer_id, spread_id/theme/positions count, **price snapshot** на момент создания, explicit price_version, версии deck/engine/spread/snapshot, однократно выбранный draw и готовый text/snapshot, delivery status + retry/lease/unknown/cancel, created UTC, optional question with documented consent/retention.
- Прайс в TASK02 только *предварительно согласованная схема для локальной разработки*: basic3=5✨, themed3=8✨, depth5=14✨, depth7=21✨, celtic10=32✨. Не активировать продажи на staging/production; владелец ещё отдельно утверждает новые цены.
- Все ограничения/триггеры (CHECK/UNIQUE/FK), delete/erasure, immutable paid snapshot, state transitions, ledger-idempotency, price authority защищены в D1 SQL. Нельзя принимать цену или owner из callback клиента, нельзя давать заменить существующее платное чтение по offer ID.
- Миграция **не backfill** старых оплат/раскладов, старый snapshot-баланс не меняет, ни одного списания при установке. Нужны SQL read-only integrity и drift audit, включая существование определения DDL, контроль flags OFF, FK и финансовые инварианты. Если нужна концепция `0029_steps`, предоставить в дополнение к объединённому SQL, с точным file runner и границами шагов; избегать ручной вставки trigger через Cloudflare Console.

**B. Атомарная бизнес-логика**:
- Собрать pure/D1 adapter API для `prepareOffer`, `confirmPurchase`, `loadOwned`, `retryDelivery`, `history` в отдельном модуле под `src/tarot25/` (или явно документированном модуле). Сначала локально проверить связь с реальными схемами.
- Payment/ledger/созданный immutable snapshot должны быть атомарны либо fail-closed; **никаких draw после успешного debit**. Если Telegram send не подтвердил доставку, сохранять *тот же* текст/состояние; неизвестный исход не выдавать за новый заказ, не создавать второй счёт, избегать неограниченных ретраев.
- Одновременные callbacks/pre_checkout не дают двойных списаний; concurrency на независимых SQLite WAL соединениях; user ownership + generation во всех read/write; запрет получить чужой paid snapshot.
- По возможности keep preview draft immutable until confirmed, но не хранить чувствительный вопрос до явно полученного consent. Race между prepare/confirm/delete/re-register, policy cutover и old offer должен быть закрыт; orphan foreign keys, repair retries и timeout явно рассматриваются.
- Не превращать пыль в Stars: покупка нового расклада использует существующий ledger, Stars остаются отдельным магазином. Не пересчитывать существующие платёжные receipts, долги или HMAC.

**C. Финансовые ворота/интеграционный артефакт**:
- Новый платный каталог OFF по умолчанию отдельным feature gate. Не менять уже установленный `release/ASTRA_2_4_WORKER.js` или его зафиксированные SHA. Если нужна сборка для проверки, создать **отдельный** `release/ASTRA_2_5_*_CANDIDATE.js` или test adapter, не готовить публичный deploy; UI пойдёт TASK03.
- Локальные тесты выполняют реальные D1 SQL-модели на SQLite, включая цепочку 0024→0025→0026→0027→0028→0029 с **полноценной 2.3B-основы** и прямую установку на чистую копию; точное воспроизведение production2.0→цель остаётся приоритетом TASK04, без гадания о живом состоянии.
- Учитывать, что предыдущий ручной upgrade 0026 остановился из-за SQL Console, а backup не был сделан; новый **deterministic migration runner** для целых файлов и гарантированных preflight нужен на следующем этапе. Не советовать владельцу выполнять 0029 SQL удалённо.
- Использовать только SQLite/D1-модель и её реальные ограничения; не переносить платежную логику на другую СУБД ради прохождения тестов.

## Минимальные матрицы тестов
1. **Finance**: для 5/8/14/21/32 доступный баланс и недостаток, атомарный ledger, отрицательный баланс запрещён, exactly-once при2/20/100 конкурентных callbacks, случайные повторные update, новый заказ после старого, два разных параллельных заказов одного пользователя, рецидив при 429/unknown/transport failure.
2. **Privacy/ownership**: повторный /start, /delete, user ID + new generation, чужие order_id/callback, stale confirm, подмена цены/темы/snapshot/версии, вопрос без consent, FK on/off, durable erase + отдельно допустимые необходимые платёжные записи.
3. **Backward compatibility**: старые 3✨/5✨ расклады и их literal text, 4✨ расширенные прогнозы, бесплатная карта дня и12×90 гороскопов, ledger/HMAC rewards, платежи/refunds/debt, consent28 и очередь — неизменны; сравнить валидные snapshots byte-for-byte с архивным fixture 2.5.
4. **D1 & Worker Free**: нагрузка записей, число SQL statements+HTTP по API/доставке, rows_read/rows_written оценить локально без притворства CPU Cloudflare; ошибки Д1, partial statements/trigger rollback; read-only audit=0 при полной схеме. Тестовый runtime Node не равен Cloudflare.
5. **Content delivery**: рендер 3/5/7/10 длиной ~3–9k, разбиение на <=4096 UTF16 без разрыва emoji, ответственность за Telegram sendMessage/send chunks будет проверена при TASK03; никакие большие результаты не теряются на repeat.

## Отчёт и выход
- Commit + push только в `astra-2.5-tarot` поверх `bb07381424300a75f06de6147ea22aabd5401600`.
- `docs/ASTRA_2_5_TASK_02_REPORT.md`, migration/install proposal and `scripts/check_integrity_tarot25_29.sql`, новые SQL/модули/тесты; if SQL safety cannot be proved, **не имитировать успех**, ограничиться design+tests и сообщить блокер.
- Указывать реально завершённые unique tests отдельно от 1472 исторических executions +210 assertions; не считать replayed groups новыми тестами.
- После push итог: SHA, changed paths, exact tests, стоимости, баланс до/после, кейсы гонок/ошибок, причины каких-либо ограничений, план TASK03, остающиеся риски. Остановиться. Не открывать PR и не начинать TASK03 самовольно.

## Контроль качества
Любой путь, который способен дважды списать пыль, изменить уже оплаченную строку, восстановить чужое право после /delete, скрыть partial-migration либо обойти флаг OFF, считается STOP-SHIP для TASK02, даже при формальном прохождении остальной регрессии.