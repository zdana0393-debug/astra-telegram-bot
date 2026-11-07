# Astra 2.4: единый кандидат и финальный release-hardening — flags OFF

Draft PR #6 · base `astra-2.4-economy` · head `astra-2.4b-rewards-stars`. Никаких deploy, remote SQL, invoices, webhook/Cron/секретов, production изменений или merge. Новые награды и Stars выключены; ставки, /delete и миграции 0021–0025 в hardening не менялись.

Исправлено превышение D1 Free в холодном Cron восьми знаков: 55→35 вызовов с сохранением восьми адресатов и delivery states. Объединён schemaReady, убрано лишнее чтение после INSERT cache через RETURNING с canonical read при конфликте; Cron-статусы/cleanup используют D1.batch. Убраны лишние наградные roundtrips. Бюджет pre_checkout теперь включает schemaReady от входа HTTP. Добавлены forwarding start_parameter, проверка fraction-only транзакций, hash range вместо LIKE, ограниченный purge и необязательные обезличенные counters. Подготовлен отдельный maintenance503 без DB/API.

Восстановление усилено тестами полного отказа D1 до credit и после refund API true, поздних webhook, повторной регистрации, нескольких charges пересланного счёта и backup/restore. Сохранены Таро−3, extended−4, GPT6+5, бесплатный прогноз/число, cache/версии/оплаченные результаты и история 2.4A.

`sh scripts/test-2.4.sh`, Node24.22.1: **511 node:test +210 legacy assertions**, без падений/пропусков. Включены весь прежний pipeline,24 новых hardening-проверки,180 независимых SQLite connections, кап 50D1calls, год actualWorker, SQL/API faults и local restore. Локальный SQLite/Node не являются реальными D1/CPU/Telegram испытаниями.

Новые материалы для ревью:

- [Отчёт и готовность OFF](docs/ASTRA_2_4_RELEASE_HARDENING_REPORT.md).
- [Единый checklist, backup/restore и исправление после 0025](docs/ASTRA_2_4_RELEASE_CHECKLIST.md).
- [Платформенный бюджет и реальные сценарии измерений](docs/ASTRA_2_4_PLATFORM_BUDGET.md).
- [Проверка официальных контрактов на закреплённых исходниках](docs/ASTRA_2_4_OFFICIAL_CONTRACT_AUDIT.md).
- [Три экономики 7/30/90/365](docs/ASTRA_2_4_ECONOMY_OPTIONS.md) и [регистрационный farming/прозрачные защиты](docs/ASTRA_2_4_REGISTRATION_ABUSE.md).

500MB — лимит одной FreeD1,5GB — аккаунта. Реальные CPU10ms/1102/D1rows_* и dedicated test checkout/refund/recovery пока не проверены. Ставки 1382/536/423 в год — сравнение,не переключение. Farming сохраняется и требует решения владельца до публичных наград; новая скрытая база ID не добавлялась. Terms/support/retention и Stars принимаются отдельно. Для обычного OFF-staging обязательны backup/реальный restore rehearsal и preflight; после 0025 старые Workers запрещены для обычного rollback.

Полный текст review PR#6 недоступен из среды (GitHubAPI Forbidden,web404); выполнены семь явных пунктов запроса владельца,недоступный review не объявляется прочитанным. Требуется сверить дополнительные замечания по копии владельца. PR остаётся Draft; технически подготовлен контролируемый OFF-staging,не production-ready.
