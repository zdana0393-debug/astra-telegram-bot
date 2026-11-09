# Astra 2.4: единый staging-кандидат, автоматическая рассылка STOP-SHIP

Патч объединяет принятые TASK01–04: утверждённую экономику/HMAC, Таро5 и прогноз4, компактные интерпретации с прежним selection/числом, историю/активность, очередь0027 и новый UI. Старые покупки/кэши сохраняются; новые награды и Stars не включаются.

Главный STOP-SHIP закрыт безопасным отказом: у legacy ON нет доказанного согласия, поэтому итоговый Worker запрещает всю автоматическую доставку в трёх точках без env-bypass. Бounded служебная очистка сохраняется. Health503/ready=false честно показывает CONSENT_REGISTRY_NOT_APPROVED и отдельно manual_content_ready. Подготовлена конкретная privacy-preserving0028 с SQL-gate/send-preflight, но **она не одобрена, не реализована и не включена в migrations**. Включать рассылку нельзя.

Отдельным коммитом2c0c341 исправлена грамматика /privacy. Остальные финансовые SQL0021–27, движок, ставки и maintenance не менялись. Новых платных функций нет.

Проверка: `sh scripts/test-2.4-task05.sh` —1182исполнения node:test+210legacy assertions, без провалов.985—предыдущие режимы до STOP-SHIP;197—финальная группа. Счётчик реальных вызовов итогового модуля подтверждает159API-тестов,2291fetch+77scheduled;38отдельных SQL/module/private-probe тестов не выданы за API-тесты. Среди них1080ручных чтений12×90, обе FK-политики, точные23Console-файла и локальный restore. Chromium:320/360/390px,46пар сообщений; настоящая D1/Cloudflare/Telegram не проверялись.

Артефакты: `release/ASTRA_2_4_WORKER.js`, `docs/ASTRA_2_4_TASK_05_REPORT.md`, `..._STAGING_GUIDE.md`, `..._MANUAL_CHECKLIST.md`, `..._DECISIONS.md`, `..._CONSENT_PROPOSAL.md`, `..._RELEASE_MANIFEST.json`, `..._TEST_COUNTS.json`, `..._PLATFORM.json`, `..._SAMPLES.md`.

Единая будущая staging-установка: проверенный backup/restore→writer pause→0024→0025→0026→0027→единый Worker/OFF→manual smoke/реальные замеры. Старый Worker после новых миграций не является откатом. Реальные CPU10ms, D1/HTTP50,rows/storage, legacy consent, правовое основание HMAC/retention и настоящие Terms/support/dedicated test environment остаются gates владельца.

**Draft / review only. NOT SAFE TO ENABLE BROADCAST. NOT PRODUCTION-READY.** Допустима лишь условная ручная staging-установка после реального restore rehearsal и отдельного разрешения. Никакого deploy/remote SQL/webhook/Cron changes/платежей/активации/production/merge разработчик не выполнял. Текущим PR нельзя молчаливо одобрить0028 или рассылку.
