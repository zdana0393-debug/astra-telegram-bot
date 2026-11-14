-- MANUAL REAL-SALES ACTIVATION. Never run automatically or as a schema migration.
-- Owner must separately publish matching Worker approval variables and gate.
-- Without BOTH gates + policy/scope/bot checks + Worker approvals, no invoice opens.
-- Execute the WHOLE file via Wrangler D1 --file (atomic native import).
-- Do not split statements. After an unknown result, check the gate before retrying.
SELECT json_extract(CASE WHEN EXISTS(
 SELECT 1 FROM astra_policy p JOIN astra_owner251 c ON c.singleton=p.singleton
 JOIN astra_users u ON u.telegram_id=c.owner_id
 JOIN astra_user_policy g ON g.telegram_id=u.telegram_id AND g.generation=c.owner_generation
 WHERE p.singleton=1 AND p.migration_done=1 AND p.stars_enabled=0
 AND p.payment_scope='production'AND p.support='https://t.me/BAL1k_67'
 AND p.terms_version='astra-stars-2026-11-v1'AND p.retention_days=365
 AND c.state='enrolled'AND c.proof_mac IS NOT NULL AND p.verified_bot_id=c.bot_id
)THEN '{"ok":1}'ELSE 'STARS_ACTIVATION_NOT_READY'END,'$.ok');
UPDATE astra_policy SET stars_enabled=1 WHERE singleton=1 AND stars_enabled=0;
SELECT json_extract(CASE WHEN EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND stars_enabled=1)
 THEN '{"ok":1}'ELSE 'STARS_ACTIVATION_UNCONFIRMED'END,'$.ok');
INSERT INTO astra_payment_audit(audit_id,kind)VALUES(lower(hex(randomblob(16))),'owner_stars_shop_enabled');
SELECT stars_enabled FROM astra_policy WHERE singleton=1;
