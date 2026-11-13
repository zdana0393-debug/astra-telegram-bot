# CODEX: IMPLEMENT ASTRA 2.5.1, NOT JUST REVIEW — PR #8

You are the acting lead engineer. The user explicitly asks you to own the implementation, fix the known problems, run tests, commit corrections in THIS DRAFT PR, and request a second review. Do not stop after giving advice or leaving TODOs. Read this task, review/astra251/REVIEW_BRIEF.md, the four existing Codex findings and all relevant sources. Report honest blockers.

## Context, safety and allowed actions

Repository zdana0393-debug/astra-telegram-bot; base astra-2.5-tarot @ e12bc9bb11ec9816fd803f83990b02622e70e9ff. Work only on the PR #8 head review/astra-2.5.1-stars-admin-audit. Do NOT merge, deploy, change production DB, send a real invoice, call Bot API, read/print credentials or modify live settings.

Production today: Cloudflare Worker opel-astra-bot, active version 1292cc45-0f93-4074-8c41-bbcfc06ef625 at 100%, new D1 astra25-release (id 1a5b3f2f-e668-4b74-90fb-3781cb2c79ea), Telegram bot @LaDa_Iskra_Opel_Astrabot. Its /health previously returned ready:true. Do not write to this D1 or the old DB astra-live-v2.

Owner's local PRIVATE Windows build has ASTRA_2_5_WORKER.js SHA-256 3ee56aefdebb7dc4b3cacfc74b2da24e002e6f150f7b45167c1f472719303561, private telegram-registry.json and 156 private Telegram file_ids of all 78 Tarot arts upright/reversed, private safe-build-receipt.json, CLOUDFLARE_SETTINGS_PRIVATE.txt and bonus-fence HMAC key. These are NOT in GitHub and must NEVER be uploaded, printed, committed, replaced or lost. Make a robust hash-verified private local patch system, and build/test public sources without private assets. Keep the user's existing Worker and art intact.

Payment support contact is https://t.me/BAL1k_67, NOT an authentication credential. Proposed shop prices are 10 XTR -> 40 dust, 25 XTR -> 110 dust, 50 XTR -> 240 dust. Proposed retention 365 days after case closure. User has NOT yet explicitly approved final prices/retention/terms and production Stars sales. Implement safe defaults OFF until explicit approval.

The two files in review/astra251/ASTRA25_1_PREPARE.py and ASTRA25_1_STAGE.py are UNTESTED CANDIDATES. Refactor/replace them as necessary; do not rely on their previous alleged correctness. Preserve no-secrets repo policy.

## FIRST: resolve all 4 prior findings, with proof

P1 (owner identity): A locally typed numeric ID can belong to anyone. Authenticate the sole intended owner using a Telegram private interaction verified by the bot (not a username or unauthenticated input); bind the attested numeric ID to the private build receipt and stage configuration. Make enrollment fail closed. An attacker changing display name/handle must not gain authority. If secure enrollment requires owner interaction, provide just one explicit safe step; DO NOT put personal user ID in GitHub.

P1 (schema): Previous /health only checked admin table/trigger names, not their exact DDL. Verify complete canonical table+trigger definitions and expected core schema, including unexpected/modified objects. Exercise a corrupted trigger fixture that must produce /health non-200. Ensure actual atomic balance+wallet ledger+refund debt behavior is proved.

P2 (Tarot): Replacing loadOwned(env,a,id) with loadOwned(env,a,'new:'+id) DOES NOT FIX THE BUG: src/tarot25/legacy29.mjs parseReadingKey accepts both as identical. Reproduce the reported Russian generic failure for paid three-card Tarot (choose theme -> choose format -> quote/confirm), find the REAL thrown code/call and fix it. Write a regression test that fails on the original code and passes after the fix. Never fabricate the root cause; use safe non-PII diagnostic code if private build behavior is required.

P2 (stage): STAGE currently sets STARS_SHOP_ENABLED=true while D1 stars_enabled=0, so preactivation /health fails. Separate configured-but-disabled readiness from live-sales readiness, with both payment gates OFF during testing. An explicit owner-approved activation is a separate final operation, and all old readiness checks remain strict.

## Implement sole-owner admin commands

Provide /myid (informational), /admin (owner-only help), and /grant <telegram_numeric_id> <amount> (owner-only dust grants to an existing registered profile incl. self; cap 1-1000 per operation). Real Telegram Stars can NEVER be created by this command. Authorization requires authenticated Telegram webhook with X-Telegram-Bot-Api-Secret-Token, private message, from.id equals chat.id, no bot sender, exact enrolled immutable numeric ID, and rejects nonowner even when same username. No alternate HTTP/callback/admin route may grant dust or show privileged data.

Enforce idempotent exactly-once credit by Telegram update_id + generation/owner when appropriate; concurrent taps, webhook retries and transient send failure must never duplicate credits. Include audit trail, correct user balance and astra_wallet_ledger accounting, refund-debt priority, safe /delete handling, strict amount and target validation, SQL integrity and immutable/replay-resistant receipts. Defense in depth in SQL; understand that direct D1 superuser has DB-admin power. Tests for forged/group/channel/forwarded/replayed messages, alternate username, missing/mismatched owner config, injected HTTP, wrong user and unauthorized SQL inserts. Do not rely on mutable usernames for access.

## Implement Telegram Stars shop safely

Audit actual wiring in release/ASTRA_2_4_WORKER.js and src/task01/payments.mjs / src/payments/*: UI, real XTR invoices, pre_checkout_query, successful_payment, double-charge handling, receipt journaling, refundStarPayment, refunded_payment, reconciliation, debt payment. Respect both Worker STARS_SHOP_ENABLED and D1 stars_enabled flags, bot-id binding, explicit ASTRA_STARS_LIVE_APPROVED and ASTRA_PAYMENT_POLICY_ACCEPTED, real support/terms/retention. Show prices, purchase confirmation, support, /terms and transparent refund process. Never call a real Telegram Stars API in repository tests. Dedicated Telegram test environment is required for safe manual nonreal payment testing. Do not auto-switch to live shop even after code passes.

Preserve existing free forecast, paid forecast, custom Tarot art, Tarot purchase history and re-reads, all bonus fence checks, current Cron quarantine, horoscope engine, user profile and saved data. Do not change any payment price snapshot for old orders.

## Implementation details

Inspect src/tarot25/ui07.mjs, purchases31.mjs, legacy29.mjs, runtime05.mjs, src/release25/readiness.mjs, scripts/build-astra25-clean.mjs, scripts/build-2.5-task07.mjs, release/ASTRA_2_4_WORKER.js and migration/schema/fixtures. Implement maintainable source fixes, tests, and deterministic local patch/build for private Worker. Validate SHA anchors and output Node syntax, no duplicate modules or ambiguous text substitutions. Never move registry/file IDs into public code.

Retain same Worker name, new D1, secrets, HMAC bonus fence, CURRENT Cron "* 6-7 * * *", observability, CHANNEL_USERNAME, 2026-11-03 compatibility date and other existing runtime flags, with no surprise configuration changes. Do not guess version preview URLs. Produce a staged, no-traffic upload plan with non-secret commands only; no production cutover or D1 modification by Codex.

## Required tests and written evidence

Run real local SQLite/D1-compatible SQL schema and trigger tests for grant money and refund debt, wrong/corrupted schema, duplicate and concurrent updates, /delete; test end-to-end mocked Telegram webhook authentic/forged admin; test 3-card selection/confirmation/one deduction/history and art; test mock sendInvoice/pre_checkout/successful_payment/repeated charge/refund/getStarTransactions and both disabled flags; test startup /health, broadcast quarantine, main forecast regression. Show actual executed test commands, passes/failures, limitations of mocks vs Cloudflare. Treat bot token, numeric owner ID, file_ids and charge IDs as private; never log them.

Update README/runbook with ONE-ACTION-AT-A-TIME short Russian owner steps for isolated testing, explicit approvals of pack prices/retention/support and owner ID attestation, backup, release freeze, staged upload, read-only checks, rollbacks and eventual activation. Label any P1 or finance failure BLOCKED, leave live shop OFF. Clearly separate unit confidence from end-to-end real Telegram payment validation.

## Codex deliverables

Commit all repaired source/scripts/tests/docs to this SAME DRAFT PR, not base branch. In PR comment summarize: actual root cause Tarot, owner-only authorization proof, SQL/ledger evidence, payment gating proof, test outputs, blocked items, remaining owner actions. Request a new independent @codex security review after changes. NEVER merge or deploy. Aim for fully ready nonsecret code, with only necessary real-owner attestation and final live approval left to user.

Do not just write a summary of what a hypothetical engineer should do. Implement and test the changes.