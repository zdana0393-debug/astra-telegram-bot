-- READ ONLY; run only after future installation, with no real SQL executed by Codex.
WITH expected(name) AS(VALUES
 ('astra_broadcast_runtime03'),('astra_broadcast_outbox03'),('idx_broadcast_outbox03_due'),
 ('idx_broadcast_jobs_day03'),('astra_broadcast_guard03'),('astra_broadcast_legacy_guard03'),
 ('astra_broadcast_marker03'),('astra_broadcast_update_guard03'),('astra_broadcast_sync03'),
 ('astra_broadcast_purge03'),('astra_broadcast_erase03'))
SELECT e.name AS missing_object FROM expected e LEFT JOIN sqlite_master s USING(name) WHERE s.name IS NULL;
SELECT count(*) AS runtime_not_complete FROM astra_broadcast_runtime03 WHERE migration_done<>1;
SELECT count(*) AS outbox_mirror_mismatch FROM astra_broadcast_outbox03 q
LEFT JOIN astra_broadcast_jobs b USING(telegram_id,day)
WHERE b.telegram_id IS NULL OR b.delivery<>CASE WHEN q.state IN('blocked','failed') THEN 'rejected' ELSE q.state END;
SELECT count(*) AS invalid_attempts FROM astra_broadcast_outbox03 WHERE attempts NOT BETWEEN 1 AND 3;
SELECT count(*) AS orphaned_outbox FROM astra_broadcast_outbox03 q LEFT JOIN astra_users u USING(telegram_id) WHERE u.telegram_id IS NULL;
SELECT count(*) AS missing_sent_marker FROM astra_broadcast_outbox03 q
JOIN astra_users u USING(telegram_id) JOIN astra_user_policy p USING(telegram_id)
WHERE q.state='sent' AND p.generation=q.generation AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<q.day);
PRAGMA foreign_key_check;
