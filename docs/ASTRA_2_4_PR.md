# Astra 2.4: единый релиз, награды и контур Telegram Stars — всё OFF

Base: `astra-2.4-economy` · Head: `astra-2.4b-rewards-stars`. Draft для ревью; отдельной установки 2.4A не будет. Никаких deploy/remote SQL/invoices/webhook/Cron/секретов/production изменений или merge.

Подготовлены единый `release/ASTRA_2_4_WORKER.js`, 0025 поверх 0024 и девять Console-шагов. Новая политика с будущей московской датой и stop: initial12, день3, первая серия3/+3, каждые7/+5,30разных/+12, рефералы14/4 после двух дат, канал8. Прежние профили и суммы не пересчитываются; legacy-pending сохраняет5, settled не получает14. Старый реферальный триггер заменён; новые суммы идут через атомарные claims/ledger без изменения старого CHECK. Таро−3/extended−4/GPT6+5, бесплатный прогноз/число и snapshots сохранены.

Stars: snapshot/согласие/однократная invoice lease, XTR 10/100,25/270,50/570, pre_checkout, уникальные charge receipts, atomic credit, support/Terms/privacy, refund и явный долг с погашением новыми начислениями, сверка/retention. Нет кредита по кнопке или pre_checkout. Возврат не отнимает материалы; D1 и внешний API не объявлены общей транзакцией. **Награды и магазин по умолчанию OFF**, требуется отдельное принятие владельцем.

Валидация: `sh scripts/test-2.4.sh`, Node24.22.1: **487 node:test +210 legacy assertions**, всё пройдено. Включены старые наборы и повтор hardening/shell/forecast на едином Worker,72новых проверки,8гонок/180независимых SQLite connections,ledger faults/API errors/FK/delete/purge/late refund. Сохранены старые релизы и миграции0021–0024. Прямые экраны/квитанции и симуляции7/30/90 воспроизводятся локально.

Проверить до активации:

- `docs/ASTRA_2_4_TEST_REPORT.md`, `ARCHITECTURE`, `ECONOMY_SIMULATION`, `UI_EXAMPLES`, `PAYMENT_RUNBOOK`, `STAGING_GUIDE` с тем же префиксом.
- Реальные D1/CPU/1102/rows_* не проверены. Официальные BotAPI pages вернули403: нужна внешняя сверка контракта и dedicated Telegram test environment для оплаты/возвратов/recovery; обычный staging способен выставить настоящий XTR-счёт.
- Утвердить ставки, реальный support, Terms/retention и остаточный риск сброса бонусных прав после /delete. Скрытая постоянная база Telegram ID не добавлялась; долг и charge hashes сохраняются открыто.
- После0025 старый JS намеренно получает503. Откат — maintenance/совместимое исправление2.4; не старый Worker/backup поверх новых оплат.
- Будущая установка только вместе: backup/restore → writer pause →0024(если отсутствует)→0025→integrity→одинJS/OFF→smoke→отдельное решение о бонусах→dedicated test Stars→отдельное production решение. Автоматически не объединять.
