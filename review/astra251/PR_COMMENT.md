Реализованы исправления Astra2.5.1 в этой ветке, без deploy/remoteSQL/BotAPI/реальных счетов.

- Исходный normal3-card flow воспроизводит generic error при запрещённом D1 page_count в astra_tarot31_intent_insert. Добавление new: ничего не меняет.0032 заменяет три unsupported live admission guard на native meta+SQL accounting, с отказом при отсутствии metadata/cap; сохранённые результаты и старые цены неизменны. Новый patched Worker проходит все7 formats с текстом/приватным art adapter; double confirm не списывает повторно.
- Owner: закрытый private capability, authenticated webhook private from=chat, живой профиль/generation, bot/build-scoped HMAC proof; локальное подтверждение подписи и binding ID из proof в receipt/stage. Username/набранный ID/forward/group/callback/поддельный HTTP не авторизуют.
- Полный exact323DDL manifest (не names-only и не admin exclusions), SQL owner/amount/generation/write-once/range defenses, atomic grant+ledger+refund debt.20 concurrent webhook и8 SQLite connections дают один credit. /delete nullifies participant IDs/revokes owner; privacy содержит retained anti-replay receipt disclosure.
- Actual shop wiring защищён schema/policy+Worker/D1 gates, bot/scope/approvals. Closed configured shop health200; gate mismatch503. RealStars OFF. Старый100dust snapshot и поздние payment/refund proofs сохранены. Моки проверяют XTR invoice/precheckout/success/duplicates/refund-after-spend/debt/reconcile/unknown.
- PREPARE/CONFIRM/STAGE переписаны: SHA-verified public delta сохраняет registry literal byte-for-byte; исходный private Worker не запрашивается/не публикуется. STAGE offline plan only, no --secrets-file, no preset approval, no guessed channel/logs/config, no traffic change.

Новые локальные проверки:83 JS +19 Python PASS; ещё3 core cases PASS на output pinned local Wrangler --dry-run. Полная регрессия2114:2012PASS/101FAIL/1SKIP. Все101FAIL в9 старых suites имеют те же counts на unchanged43e3871 (данные и описание сохранены), не новые auth/finance failures.72 protected historicalfiles совпадают. Полная регрессия НЕ объявлена зелёной.

33–35 conservative SQL+HTTP ops для7 formats; ≈451KB gzip синтетический Worker. Реальные D1/Workers CPU/rows/import-restore, private Windows build, owner interaction и dedicated Telegram payment tests NOT_TESTED; текущий runtime snapshot ещё требуется. Настоящие цены/условия/365days/live approval остаются решением владельца. До backup/restore+freeze и отдельных разрешений на0032/stage/bootstrap/activation — STOP. Старый Worker не является обычным rollback после0032.

Источники/команды/ограничения: review/astra251/REPORT.md, README.md; data/astra251-regression.json, data/astra251-verification.json.

Независимый локальный reviewer нашёл два дополнительных operational/security пробела; исправления покрыты тестами. Финальный sign-off не получен из-за лимита сервиса. Нужен повторный независимый обзор итогового diff, особенно owner enrollment, SQL/debt/delete, native metadata accounting, private tools/stage и actual payment gates.

@codex review
