-- READ ONLY. Only staging after review; no real D1 access by Codex.
-- Also run check_integrity.sql and check_integrity_2_3b.sql.
SELECT count(*) AS balance_mismatches FROM astra_users u WHERE balance<>
 (SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id);
SELECT count(*) AS orphan_activity FROM astra_activity_days a WHERE NOT EXISTS
 (SELECT 1 FROM astra_users u WHERE u.telegram_id=a.telegram_id);
SELECT count(*) AS activity_date_violations FROM astra_activity_days
 WHERE length(day)<>10 OR day NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
 OR date(day,'+0 days') IS NULL OR date(day,'+0 days')<>day;
SELECT count(*) AS activity_source_violations FROM astra_activity_days WHERE source NOT IN ('message','callback');
SELECT count(*) AS activity_duplicate_violations FROM
 (SELECT telegram_id,day FROM astra_activity_days GROUP BY telegram_id,day HAVING count(*)>1);
SELECT count(*) AS activity_rows,count(DISTINCT telegram_id) AS tracked_profiles,
 min(day) AS first_active_date,max(day) AS last_active_date FROM astra_activity_days;
SELECT type,name FROM sqlite_master WHERE name IN
 ('astra_activity_days','idx_astra_ledger_history','astra_activity_guard','astra_activity_erase') ORDER BY name;
PRAGMA foreign_key_check;
