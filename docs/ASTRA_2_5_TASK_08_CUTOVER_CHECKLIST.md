# TASK08 — будущий переход рабочего бота2.0 →2.5

**Это план, не разрешение. Перенос production в TASK08 не выполняется.** На11.11.2026 все production-пункты ниже NOT_TESTED/NOT_AUTHORIZED. Фактических результатов Cloudflare/Telegram пока нет; готовность cutover не установлена.

## До запроса разрешения на production-инвентаризацию

- [ ] Получены реальные evidence из `TASK_08_PLATFORM_ACCEPTANCE`: D1 compatibility, migration/import/restore, финансовая атомарность, CPU/1102/startup/rows, все7 Таро и основные функции.
- [ ] Непроверенное перечислено отдельно: Cron/Stars/registered webhook и неизвестные метрики не скрыты за общим PASS.
- [ ] Утверждены reviewed Worker/SQL/manifest hashes, цены/retention/consent/GC/SLA/support/Terms и остаточные редакционные ограничения. Новые продажи/Stars/рассылка автоматически не включаются.
- [ ] Получено **отдельное разрешение только на read-only инвентаризацию production** с точными IDs, временем и списком запросов. Результаты synthetic2.0 не доказывают совместимость реальной живой2.0.

## Read-only инвентаризация — только после того отдельного разрешения

Зафиксировать фактический Worker source/version SHA, bindings/DB/account ID и схема/служебные объекты/SQL functions; текущие webhook/allowed_updates/Cron; число профилей и каждый баланс; значения/байты/типы важных строк, rowid/sqlite_sequence; processed updates и pending jobs; paid3/5/RWS/forecast при наличии; ledger/idempotency; referral связи и paid/pending права; generations и notification consent; бонусные fence/долги/refunds/payment reconciliation. Секреты не выгружать в чат/Git. Не менять настройку для удобства диагностики.

Оригинальная2.0 из репозитория не сохраняла paid-тексты: нельзя обещать восстановление отсутствующего. Если реальный source отличается от известных стадий, STOP и отдельный согласованный адаптер; нельзя удалить служебные D1-объекты или переписать транзакции ради local preflight.

## Перед окном обслуживания

- [ ] Новый отдельный план cutover утверждён владельцем, отдельно от TASK08 и read-only разрешения.
- [ ] Выбрана **совершенно новая production-target D1**, а не test functional/lab/старая повреждённая staging. Её создание/наполнение потребует будущего отдельного разрешения.
- [ ] Функциональный test bot никогда не получает реальные production профили. Data migration rehearsal на частной реальной копии выполняется отдельно, без Bot API token/доставки.
- [ ] Проверены lossless export и локальное восстановление: существенные rowid/sequence и opaque paid bytes не потеряны SQL dump. Совпадение только сумм недостаточно.
- [ ] Утверждены окно остановки, уведомление пользователей, сбор поздних updates/платежей/возвратов и RPO/RTO. Zero downtime не обещается. Telegram не хранит pending updates бесконечно.

## Обязательная остановка writers и backup

- [ ] Остановлены ВСЕ production writers: webhook-handler/старые Worker версии, Cron/очереди, административные операции, reconciliation/refund jobs и любые другие writers.
- [ ] Есть техническое свидетельство остановки; `--writers-paused` — лишь подтверждение оператора.
- [ ] Сделан согласованный backup/export/bookmark с временем/хешем; отдельно восстановлен и сверены все финансовые/пользовательские данные.
- [ ] Уточнена поддержка Time Travel конкретной D1; Free reference7 дней, не Paid30. Backup не считается проверенным без restore.
- [ ] Секреты/платёжные идентификаторы/личные вопросы хранятся частно; нет их в публичном отчёте.

## Один пакет, один итоговый Worker

Использовать проверенный TASK07 local runner только на новой частной копии, не против live DB:

`2.0 →0021 →0022 →0023 →0024 →compat-referrers.v1 →0025 →0026 →0027 →0028 →0029 →0030 →0031`.

Compat перед0025 исправляет только dangling referrer_id; не возвращает наград и не переписывает paid/pending признаки. Любая иная коррекция — отдельное решение. Local preflight должен распознать фактический source; manifest/source SHA и reviewed target Worker проверяются до SQL.

Владелец использует один локальный `scripts/astra25-prepare07-local.mjs` с новыми output/compact/sql paths, backup/restore и журналом `.task07`; подробная команда — в `ASTRA_2_5_TASK_07_UPGRADE_20_TO_25.md`. Затем один итоговый SQL package в новую D1 и один matching Worker. Не нужно вручную устанавливать промежуточные Workers. Не накатывать21…31 второй раз поверх импортированной готовой0031. Административные SQL133 statements не исполняются через обычный Worker invocation.

- [ ] Платформенно подтверждены границы administrative import/ошибок, deferred FK/unhex/PRAGMA, exact schema guards и restored flags.
- [ ] Новая DB после import сверена со source по каждому балансу, ledger, paid bytes, update_id, referrals, generations, consent и строковым/бинарным типам.
- [ ] Matching Worker связан только с новым target. Все новые gates OFF, дата редакции не назначена автоматически.
- [ ] `/health` кандидата503/public_ready=false не объявлен доказательством готовности; проверены отдельные schema/sales поля и реальный протокол. Изменение readiness требует reviewed релиза.
- [ ] Старые writers ещё остановлены. Сверены и идемпотентно обработаны события между backup и cutover; /delete и отзыв consent не теряются.
- [ ] Владелец отдельно разрешил переключение именно этой пары Worker+DB, с конкретными версиями и наблюдением.

## Восстановление и дальнейший запуск

До cutover source не меняется: ошибка подготовки ведёт к STOP и новой копии из проверенного backup. После cutover новые покупки делают обычный возврат к2.0/2.4/TASK06 опасным. **Старый Worker не является штатным rollback после0031.**

При сбое: остановить новые writers, сохранить новое состояние/поздние события, предпочесть matching forward-fix. Если требуется restore, отдельно доказать восстановление и reconciliation после bookmark: платежи/возвраты, ledger, paid результаты, processed updates, удалённые профили и consent. Не откатывать балансы вручную, не перегенерировать paid и не включать прежний writer против новой схемы. Уничтожение source/новой DB не входит в план восстановления по умолчанию.

Активация RWS, экономики, Stars, рассылки и реального GC — отдельные решения после наблюдения, не следствие deploy. TASK09 и production перенос не начинаются автоматически после TASK08.
