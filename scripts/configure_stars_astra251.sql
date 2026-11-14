-- MANUAL OWNER OPERATION ONLY. Not a migration, deploy hook or automatic startup.
-- Real-sales approval is separate; this file keeps the D1 gate OFF.
-- Identity comes from the bot-verified owner record, never a typed numeric ID.
-- Execute the WHOLE file via Wrangler D1 --file (atomic native import).
-- Do not split statements or paste selected statements into D1 Console.
SELECT json_extract(CASE WHEN EXISTS(
 SELECT 1 FROM astra_owner251 c JOIN astra_users u ON u.telegram_id=c.owner_id
 JOIN astra_user_policy g ON g.telegram_id=u.telegram_id AND g.generation=c.owner_generation
 WHERE c.singleton=1 AND c.version='owner251-v1' AND c.state='enrolled'
 AND c.bot_id>0 AND c.proof_mac IS NOT NULL
)THEN '{"ok":1}'ELSE 'STARS_OWNER_NOT_READY'END,'$.ok');
SELECT json_extract(CASE WHEN EXISTS(SELECT 1 FROM astra_policy WHERE singleton=1 AND migration_done=1 AND stars_enabled=0)
 THEN '{"ok":1}'ELSE 'STARS_SHOP_MUST_BE_CLOSED'END,'$.ok');
UPDATE astra_policy SET payment_scope='production',support='https://t.me/BAL1k_67',
 terms_version='astra-stars-2026-11-v1',retention_days=365,
 verified_bot_id=(SELECT bot_id FROM astra_owner251 WHERE singleton=1 AND state='enrolled')
 WHERE singleton=1 AND stars_enabled=0;
SELECT json_extract(CASE WHEN EXISTS(
 SELECT 1 FROM astra_policy p JOIN astra_owner251 c ON c.singleton=p.singleton
 WHERE p.singleton=1 AND p.stars_enabled=0 AND p.payment_scope='production'
 AND p.support='https://t.me/BAL1k_67'AND p.terms_version='astra-stars-2026-11-v1'
 AND p.retention_days=365 AND p.verified_bot_id=c.bot_id AND c.state='enrolled'
)THEN '{"ok":1}'ELSE 'STARS_CONFIGURATION_MISMATCH'END,'$.ok');
INSERT INTO astra_payment_audit(audit_id,kind)VALUES(lower(hex(randomblob(16))),'owner_stars_policy_configured');
SELECT payment_scope,support,terms_version,retention_days,stars_enabled,
 verified_bot_id IS NOT NULL AS bot_bound FROM astra_policy WHERE singleton=1;
