# УТОЧНЕНИЕ ПОСЛЕ TASK 03 — 9 ноября 2026

TASK 03 опубликован: `389350bc120c5104ef1f324e636640b487ff2fc0`. **Обязательная дополнительная нефинансовая миграция — 0027** (`migrations/0027_broadcast.sql`, три Console-шага). Все миграции 0021–0026 остаются неизменными. Финальный staging runbook обязан включать **0024 → 0025 → 0026 → 0027**, с preflight/backup/writer pause/restore rehearsal и проверкой integrity 0027, до совместимого Worker; если часть уже применена, выяснить фактический state и не переигрывать слепо. Старый Worker после 0027 не является безопасным rollback.

**Новая контрольная точка регрессии:** отчёт TASK03 указывает 773 исполнений node:test (включая повторные старые группы) + 210 legacy assertions, из которых 144 проверки относятся к итоговой сборке. На чистом staging обязательно проверить реальные D1/CPU/rows/http: локальный максимальный подсчёт 47/50 почти исчерпывает лимит. Проверить свежие регистрации с notifications OFF и явное согласие всех legacy ON перед реальной отправкой; старый DEFAULT 1 не является доказательством opt-in. Компактная редакция не активирована без будущей даты. TASK04 по-прежнему отвечает за UX и Тext/Terms, TASK05 — за интеграцию. Никаких реальных deploy/SQL без одобрения владельца.

---

# CODEX TASK 05/05 — Сборка, интеграционный аудит, release candidate
Этап выполнять только после удовлетворительного ревью TASK_01..04. Ветка \`astra-2.4-prestaging-ux-patch\`, база \`astra-2.4b-rewards-stars\`. Нет автоматического deploy/remote SQL/setWebhook/Cron/payment/merge. **Не добавлять новых функций и не переизобретать астрологический алгоритм на финальном этапе.**
Прочитать все пять TASK и чеклист 2.4, сравнить итог diff против 4eff5df. Есть ли конфликты предыдущих изменений? Исправить только интеграционные ошибки с тестами.

## Инварианты и regression
- Шесть разделов интерфейса, шаги навигации, юзерские сообщения, /privacy, /delete HMAC exception, история пыли, paid Tarot -5 (только новая покупка), старые -3 operations и owned snapshots, extended -4/date, GPT6 +5, free number, paid text cache, actor user state, referral +10/+3 и friend-channel +5, direct channel +15, old legacy pending +5, HMAC TTL/purge, payment charge/refund support.
- Offline full regression не хуже прежнего \`511 node:test+210 legacy assertions\` по отчёту Codex, дополнительные сценарии новых багов, SQLite multi-client races, 12 zodiac × 90 days meaningful editorial checks, 8/20/100 Cron, 50-call D1 mock cap, fault injection for purchase/refund/tg, platform telemetry PII-free. Снять sha256 output, migration integrity, schema manifest, trigger invariant, old snapshots (byte-by-byte).
- Денежные тесты включая меняющуюся цену: verified old order remains -3, new order -5, stale message must not silently charge -5, old free horoscope remains free, channel/friend reward 15/5 never doubles after /delete→start within TTL, 30-day rights expired/pruned, balanced flows after policy cutover.
- Regression old vs new forecasts: assert *selected theme, sign, element, modality, directives, number identical for same sign/day before and after* where intended, only prose shrinks; no new claims of real astronomical transits. Existing cache/paid snapshots unchanged.
- Cloudflare Workers Free budgets: 50 D1 subrequests each HTTP/Cron, 10ms CPU runtime and 500MB D1 per DB: local simulations not actual Cloudflare. Real test and backup/restore rehearsal still required; do not call production-ready yet.
- Fuzz/malformed callback, XTR, 403/429/timeout, network and D1 failures; charges idempotent/reconciled and staff-only refund remain.

## Deliverables
- Self-contained \`release/ASTRA_2_4_WORKER.js\` assembled from maintained source modules; \`ASTRA_2_4_MAINTENANCE.js\` unchanged unless necessary for new schema.
- New migration 0026 (if required) + numbered Console SQL scripts, no remote apply; 0021–0025 preserved, clear writer pause and no rollback to 2.4A. Schema health=503 if incomplete; staged installation order **0024→0025→0026→0027** after backup and *real restore rehearsal*, on staging only. OFF both policy/shop until separately approved HMAC privacy and Telegram dedicated test environment; old policy may remain active under OFF.
- docs: patch architecture, "before→after" UX with 12 examples, financial tariff matrix, privacy/retention/antiabuse docs, tests results, 7/30/90/365 economic simulations with new actual tariff -5 and chosen payouts, staging 2.4 single deployment checklist, cost/quota assumptions, instructions for owner new effective prices and future-only features.
- Create a DRAFT PR base \`astra-2.4b-rewards-stars\` and head \`astra-2.4-prestaging-ux-patch\` (only now, not earlier); if API Forbidden, return compare URL and SHA.
- Conclude in Russian: what was implemented in each phase with commits, tests counts, real unresolved risks, how to read health/backup/restore, what decisions still require owner (Terms/support/retention and HMAC lawful basis), whether staging installation with both OFF is safe, before production.
- Absolutely NO actual changes to test/live workers, databases, webhooks, cron schedules, secrets, Stars charges, or main branch.
