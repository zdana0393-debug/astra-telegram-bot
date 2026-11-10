# ASTRA 2.5 — TASK02: SQL0029 и атомарные покупки

10 ноября 2026, Москва. **CODE_READY_FOR_LOCAL_REVIEW. Новый платный каталог OFF; реального запуска нет.** Подготовлены D1 adapter и локальная модель, а не установленный Worker2.5. TASK03 не начат. PR/merge не выполнялись.

Работа только в `astra-2.5-tarot`. Реализованный TASK01 — `bb07381424300a75f06de6147ea22aabd5401600`; fetch/pull --ff-only получили новый документ владельца `9a2e5783b1ea940980dab103a2979a542fac07c4`. Дерево до работы чистое. SHA итогового коммита сообщается после commit/push; отчёт входит в него.

## Аудит и реализация

Полная карта старых путей/checks — **ASTRA_2_5_TASK_02_FINANCIAL_AUDIT.md**: legacy3 в astra_operations с CHECK(delta=-3), Таро5 в offers/purchases26 с CHECK(price=5) и balance-5, forecast4/unlock, update jobs/processed updates, ledger/history2.4A, HMAC/reward26, Stars/receipts/tombstones, refund/debt/repayment, consent28/Cron.

Новый путь не расширяет CHECK astra_operations и не переписывает таблицы26. **0029 только аддитивная:** 4 таблицы runtime/prices/offers/purchases, 2 индекса, 19 триггеров —25 объектов. 158 фактических базовых DDL и25 новых сверяются adapter/аудитом; это шире старого health-предиката126. Создаются только пустые пользовательские таблицы, конфигурацияOFF и7 канонических проектных тарифов. Backfill, переоценки и списаний при установке нет.

`prepareOffer` проверяет feature gates, живого owner+generation, stable request_key/update_id, допустимые поля/тему/consent. Полностью готовит и сохраняет immutable draw/text/versions **до debit**. Ответ quote DTO не раскрывает неоплаченный материал. Одновременные prepare могут вычислить проигравшие кандидаты, но UNIQUE сохраняет только одного победителя; проигравший не становится покупкой. Повтор исходной пары запроса возвращает тот же quote, а подмена параметров отклоняется.

`confirmPurchase` не вызывает карточный RNG. Один **INSERT SELECT** копирует sealed snapshot из предложения; SQL guard проверяет owner/current generation, price snapshot/версию/ревизию, TTL900s, open, gates и доступный баланс. AFTER trigger меняет balance и вставляет ровно одну запись ledger: operation_id=NULL, reason=tarot:v25, idempotency_key=tarot25:offer_id. Любая ошибка trigger/ledger откатывает paid-строку и debit вместе. Повторный confirm читает существующую покупку, в том числе при OFF продаж. Потерянный ACK после commit не создаёт другую покупку.

Реестр тарифов неизменяем; client price/owner/snapshot не принимаются. Offers/paid fields защищены SQL, включая NULL-safe сравнения и попытки OR REPLACE. Раздельные guards закрывают прямую подмену/удаление новой ledger-записи при живом профиле. Право на новую продажу требует **ASTRA_TAROT25_ENABLED=true и runtime29.enabled=1**, по умолчанию оба закрыты. Смена enabled/price_version увеличивает revision и инвалидирует старый неоплаченный quote; первая миграция не может завершиться с включённой продажей.

Цены **только локальная предварительная схема**, не одобренный запуск новых услуг:

| Формат | Цена ✨ | Пример баланса до→после | При недостатке |
|---|---:|---|---|
|basic3 RWS78|5|100→95|4 остаётся4, покупки/дебета нет|
|themed3 relations/work/choice|8|100→92|7 остаётся7|
|depth5|14|100→86|13 остаётся13|
|depth7|21|100→79|20 остаётся20|
|Celtic10|32|100→68|31 остаётся31|

Новый basic3=5 не повышает цену существующего basic3. Старый22-card dayCard, старые3/5 купленные тексты и forecast4 сохранены. Stars не используется для покупки расклада: это списание пыли из существующего кошелька. Нового pre_checkout потока нет; прежние Stars/pre_checkout/refund handlers и данные не менялись.

## Replay, права и доставка

Замечание ревью TASK01 устранено: отдельный **reader-v1.mjs** использует замороженный `tarot25-reader-v1.json` с ID/структурой позиций и версиями, без импорта текущих catalog/spreads/engine. `text29.mjs` также не зависит от текущего генератора. Старые exports engine сохранены как фасад; сам генерационный engine по-прежнему импортирует текущий каталог для новых результатов. Поэтому независимость архивного пути относится к reader/service, а не к любому возможному cold import всего генератора.

Тест подменяет будущий engine файлом, который бросает ошибку при импорте: paid load и выдача сохранённых частей продолжают работать дословно. Архивный v1 fixture TASK01 также проходит. Новые версии в будущем требуют отдельных readers и сохранения v1, а не тихой правки его контракта. Структурная валидация не является подписью или доказательством оплаты; loadOwned проверяет SQL purchase JOIN живого профиля/current generation.

Legacy3/5 читаются напрямую из исходных таблиц с namespace ключами, без конвертации в RWS78. `history` объединяет3 источника и использует owner-bound keyset cursor. `/delete` очищает новые offers/paid/question/ledger при FKON/OFF; после re-register новое поколение не получает старые права. Старые допустимые Stars/refund records остаются по прежней политике. Legacy3 не хранит generation исторически: безопасное чтение предполагает полную неизменённую схему удаления, которую adapter проверяет; повреждённый/чужой backup нельзя объявлять валидным переходом.

`retryDelivery` принимает только injected transport, никакого Bot API клиента в новом модуле нет. Claim/lease защищает от параллельной автоматической отправки; непосредственно перед каждой частью повторяется SQL owner/generation/token проверка. Transport должен явно вернуть true/{accepted:true}; resolved false/undefined — unknown. Сеть/timeout/5xx — unknown, определённые4xx — rejected,429 до принятой части — bounded retry после полного retry_after, после части — unknown. Истёкший sending превращается в unknown. Без explicit+ack_unknown он не повторяется. Helper ограничен3claims; loadOwned остаётся доступен после лимита, полноценный ручной read UX/rate-limit — TASK03.

**Найденная и исправленная гонка:** старый JS-read pending мог пережить чужой commit sent/unknown, а слишком широкий SQL claim снова захватывал строку. Allowed states перенесены в условие самого UPDATE: implicit допускает только pending/retry, sent/rejected — явный режим, unknown — только явный ACK. После исправления20 параллельных claims дают одну автоматическую отправку. Между внешним транспортом и D1 нет общей транзакции; exactly-once Telegram не обещается. Ошибка записи sent оставляет sending→unknown и тот же оплаченный текст.

## Проверки

Node **24.22.1**, каноническая команда:

```sh
sh scripts/test-2.5-task02.sh
```

Завершённый итоговый прогон: **1535 выполнений node:test +210 legacy assertions**, без failures/skipped. Это не1535 новых уникальных тестов.

| Группа | Количество | Доказательство |
|---|---:|---|
| Новые уникальные TASK02 |63|40adapter/finance,10SQL/migration/reader,13independent WAL|
| Повтор TASK01 и предыдущих стадий |1472+210assertions|Прежние ожидания не ослаблялись; повторные группы не считаются новыми|
| Новые Worker2.5 API tests |0|Новых Worker routes нет: проверяется D1 adapter с реальными SQLite triggers|

Отладочные прогоны не суммируются в unique count. Предшественник внутри скриптов пересобирает исторические артефакты; внешний wrapper восстанавливает docs/data/release, а SHA всех прежних tracked файлов проверяется отдельно. Единственное изменённое прежнее source — engine facade replay/split exports. Содержание78 карт/расклады/сочетания неизменно.

Проверены:

- все7 схем и5 стоимостей, достаток/недостаток, правильный остаток, один ledger на покупку и balance=SUM(delta), неизменный sealed JSON при повторе;
- **2/20/100 конкурентных подтверждений**;100callbacks распределены по20 независимым SQLite WAL connections. Барьер перед INSERT гарантирует, что соединения дошли до конкурирующей записи; он не сериализует их JS-мьютексом. В сценарии32✨ всегда одна покупка, один ledger−32, баланс100→68;
-20independent prepares, два разных параллельных заказа с достатком/без него, confirm/delete, prepare/delete, cancel/confirm, FKON/OFF, параллельные delivery claims/unknown;
-покупка против прежнего Stars refund: сериализация даёт либо покупку32 с долгом32 после возврата, либо отказ покупки после возврата. Следующий тестовый credit40 погашает долг прежним trigger; кошелёк и receipts/settlements сходятся;
-чужие order/cursor, stale generation, cancel/expiry/pause/version, отсутствие consent/подмена вопроса, цены/версий/draw/позиций/snapshot, counterfeit ledger и OR REPLACE;
-ledger failure с полным rollback, lost ACK после commit с чтением той же покупки, неизвестный/неподтверждённый transport, timeout/403/429/500, ошибка finalize, offline/pre-send D1, corrupt paid body без регенерации/повторной оплаты;
-точная цепочка **полной2.3B→0024→25→26→27→28→29**, отдельно готовая чистая локальная копия, повтор всей0029, interruption/resume и foreign/partial schema/price data, отказ завершить миграцию сON, непустая paid-база с audit violations0;
-старые literal3/5 с Unicode, сохранённые прогнозы/карта дня/12×90 гороскопов/бонусы/HMAC/Stars/refunds/debt/consent28/Cron через неизменённую прежнюю регрессию; отдельная VACUUM backup-копия и FKcheck;
-render/split длинных3/5/7/10 результатов в<=4096UTF-16 без потери текста; Unicode и архивные snapshots также повторены из TASK01.

Эти тесты не являются проверкой настоящего Telegram, production2.0 или D1 remote. Все деньги/профили/proofs синтетические. Новые модули не содержат сетевого клиента; WAL worker запрещает fetch, а прежние fixtures перехватывают FAKE Bot API.

## Бюджет и артефакт

Подробные измерения — **ASTRA_2_5_TASK_02_METRICS.json**. Считаются каждый SQLstatement и инъецированный транспортный вызов. Нормальные локальные API:

| API | SQLstatements | Транспорт | Логические SQLite изменения |
|---|---:|---:|---:|
|prepareOffer|7|0|1offer|
|confirmPurchase|7|0|3:purchase+balance+ledger|
|повтор confirm/loadOwned|3|0|0|
|history без cursor|4|0|0|
|delivery1/2 части|7/8|1/2|2claim/finalize|

Наблюдаемый максимум —10SQL+transport; условный резерв2 для будущей оболочки даёт12. **Это не доказанный бюджет будущего Worker:** UX, update jobs, activity/reward и все внешние проверки ещё должны быть измерены вместе в TASK03. Схемный запрос читает183DDL-описания; returned_rows и SQLite total_changes не являются D1 rows_read/rows_written. Полная DDL-сверка и JSON-парсинг имеют CPU/rows-цену.

Первые измеренные prepare/доставка могут занимать около13ms Nodeelapsed; статический импорт adapter произошёл до начала этих измерений. Это не полный cold start. это не Cloudflare CPU10ms и не опровержение/подтверждение платформенного лимита. CPU, rows_*, storage/сутки, реальные subrequests, репликация/сессии и D1 write/read semantics не измерены. Новый модуль не включён в текущий bundle. До их проверки активация запрещена.

Выбран допустимый артефакт TASK02 — **отдельный test adapter**, не новый deployment Worker. SHA финального2.4Worker остаётся:

```text
5f34b44948e4bb6be643d586e712554d41f9b9bf7f2ee7175c4bf5e6d77786f4
```

## Файлы, установка и открытые решения

Новые SQL: `migrations/0029_tarot.sql`, четыре `0029_steps`, `scripts/check_integrity_tarot25_29.sql`. Новый local-only runner читает целые файлы, проверяет preflight и транзакции по файлу; повтор разрешён только на совместимой локальной копии с новой продажейOFF. `ASTRA_2_5_TASK_02_INSTALL_PROPOSAL.md` не содержит разрешения/инструкции применить SQL удалённо. Это не универсальный мигратор из фактической2.0 — такой переход остаётся TASK04.

Новые модули: `purchases29.mjs`, `legacy29.mjs`, `reader-v1.mjs`, `text29.mjs`; замороженные JSON reader/prices/base-schema/schema29 и protected hashes; новые finance/SQL/WAL tests, генератор manifests, review и regression scripts. API и trust boundary — **ASTRA_2_5_TASK_02_API.md**. Все старые файлы, кроме объявленной делегации engine, побайтно сохранены; миграции0021–0028 и Worker не редактировались.

До активации владелец отдельно решает цены/версию политики, реальный consent+retention вопроса и backup, семантику ручного перечитывания после helper-limit, поддержку/сроки хранения, свежую изолированную D1 и реальную приёмку платформы. Вопрос в этой проектной схеме хранится с добровольным API-consent до /delete;900 секунд TTL не означает физическое стирание личного текста через15 минут. Отдельный boolean API не заменяет будущий пользовательский notice.

**Остаточные риски:**нет общей D1/Telegram транзакции; неизвестный исход может означать недоставку или уже принятое сообщение. SQL/read permissions действуют в проверяемый момент, уже полученный материал/начатый HTTP не отозвать. Устаревший backup может воскресить удалённые данные/платежное состояние; restore требует остановки writers, сверки поздних событий и сохранённых результатов. ВалидацияJSON не защищает от администратора, способного менять DDL/данные; во время миграции writers обязаны быть остановлены. Нельзя удалять ledger/snapshot и перегенерировать платный результат как «починку».

TASK03 предстоит построить закрытый UX поверх этих API, price confirmation/actor derivation/update-idempotency, общий history/read/delivery, consent/retention и friendly ошибки, не меняя старые материалы. TASK04 — проверенный2.0→цель, отдельное восстановление, новая изолированная база и реальные измерения только после разрешения. Сейчас их прохождение не заявляется.

Итог: **TASK02 реализован и готов к локальному ревью; public/new-sales OFF.** Cloudflare/сломанная старая stagingD1/основной бот/секреты/вебхук/Cron/реальные платежи/PR/merge не затрагивались. После commit и обычного push только вastra-2.5-tarot — остановка передTASK03.
