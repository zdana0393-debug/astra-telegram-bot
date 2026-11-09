# CODEX TASK 03/05 — Возвращение настоящей ежедневной рассылки
**Строго после TASK_02 и только этот этап.** Ветка \`astra-2.4-prestaging-ux-patch\`. Не менять экономические ставки, платежи, HMAC права и гороскопные семантические правила за пределами минимальных совместимых правок.

## Факт по коду 4eff5df
В \`release/ASTRA_2_4_WORKER.js\` есть \`scheduled()\` и \`broadcast()\`, вызывающий \`sendFreeForecast\`; работает только в UTC 06:00–07:59 (Москва 09:00–10:59), максимум 8 пользователей/запуск, проверяет \`notifications_enabled=1\`, \`last_broadcast_day\`, \`astra_broadcast_jobs\`. Отсутствие фактической доставки владельцу не доказывает отсутствие функции: Cron Trigger может отсутствовать, запускаться в другой момент, /health возвращать 503, webhook/Telegram reject, подписка выключена, или backlog>8. Никаких домыслов о реальных Cloudflare настройках; нужен Dashboard checklist.

## Целевой UX
- \`ON\`: каждое утро добровольно подписавшемуся автоматически отправляется **тот же полный компактный бесплатный гороскоп**, что при ручном \`Прогноз дня → Открыть бесплатно\`. Обязательное число дня и один спокойный CTA «Подробнее — 4 ✨», который ведёт к подтверждению. Если \`extended\` уже куплен на дату — CTA «Открыть купленное» без нового списания.
- \`OFF\`: никаких новых прогнозных сообщений; ручной путь всегда доступен бесплатно, результат той же даты дословно совпадает.
- Не переавторизовывать старую аудиторию массово, не включать рассылку тем, кто ранее её отключил; необходим явный opt-in. Входит лишь дневная выдача, без рекламы сторонних каналов и без «исчезнет через час».
- Cron НЕ считается осмысленным посещением, не вызывает daily/reward claim, нет изменения астрологических расчётов или кэша.
- Идемпотентный delivery для того же id/day; failed 403 — выключить подписку и дать support log, 429 — bounded retry с уважением retry_after; \`unknown\` не делать повторно автоматически без стратегии, исключающей/объясняющей неопределённость после сетевого сбоя. Не объявлять impossible exactly-once delivery. Telegram 4096-character boundaries, не повторять CTA в каждом chunk.

## Доставка аудитории и Free D1 бюджет
На локальном репро тестах 8 разных знаков cold Cron 55→35 D1 calls в предыдущем релизе; теперь >8 subscribers must drain across bounded invocations with durable cursor/status and no starvation, no infinite loops. Не выходить за лимит 50 D1 subrequests/invocation, HTTP/Cron CPU 10ms Free; реальные цифры только после staging. Не делать 100 пользователей в одном Cron event, если риск quota. Проверить schedule recommendation (по UTC, cron repeat window), отдельную уборку старых broadcast_jobs. Сохранить отсутствие дублей при нескольких Cron triggers.
Возможный критерий: staging безопасно обслуживает 8, 20, 100 искусственных подписок последовательными cron invocations с max 8 recipient, progress count and halt. Не увеличивать количество сообщений сверх opt-in.
Никаких setWebhook/cron remote changes в этой стадии.

## Приёмка
- Mock Telegram успешная и ошибочная выдача, кнопки/подпись, same cache day, 23:59/00:00 Europe/Moscow, ON/OFF, late Cron, multiple invocations, 403/429/timeout, no reward from scheduled, 8/20/100 users all completed without duplicate, 50 call cap on a cold run, no change to paid read.
- Диагностическая инструкция для владельца по Dashboard Cron Triggers + logs + notification setting + health + dry-run SQL без изменения production.
- Полная прежняя регрессия не ухудшается, commit + отчёт, остановиться перед TASK_04.
