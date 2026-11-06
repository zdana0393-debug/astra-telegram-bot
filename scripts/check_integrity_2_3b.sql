-- READ ONLY: run on staging astra-staging-21 after scripts/check_integrity.sql.
SELECT count(*) AS balance_mismatches FROM astra_users u WHERE balance<>
 (SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id);
SELECT count(*) AS unlocks_without_posting FROM astra_forecast_unlocks u WHERE NOT EXISTS (
 SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='forecast:extended:'||u.telegram_id||':'||u.day
 AND l.telegram_id=u.telegram_id AND l.delta=-4 AND l.operation_id IS NULL AND l.reason='forecast:extended');
SELECT count(*) AS postings_without_unlock FROM astra_wallet_ledger l WHERE l.reason='forecast:extended' AND NOT EXISTS (
 SELECT 1 FROM astra_forecast_unlocks u WHERE u.telegram_id=l.telegram_id AND l.idempotency_key='forecast:extended:'||u.telegram_id||':'||u.day);
SELECT count(*) AS orphan_unlocks FROM astra_forecast_unlocks f WHERE NOT EXISTS (
 SELECT 1 FROM astra_users u WHERE u.telegram_id=f.telegram_id);
SELECT count(*) AS snapshot_mismatches FROM astra_forecast_unlocks u WHERE NOT EXISTS (
 SELECT 1 FROM astra_forecast_daily d WHERE d.sign=u.sign AND d.day=u.day AND d.locale=u.locale
 AND d.extended_text=u.result_text AND d.engine_version=u.engine_version AND d.content_version=u.content_version
 AND d.number_algorithm_version=u.number_algorithm_version);
SELECT day,count(*) AS cached_signs FROM astra_forecast_daily GROUP BY day HAVING count(*)>12;
SELECT count(*) AS paid_rows,sum(price) AS total_paid_dust FROM astra_forecast_unlocks;
SELECT sum(length(CAST(free_text AS BLOB))+length(CAST(extended_text AS BLOB))+length(CAST(source_tags AS BLOB))) AS cache_payload_bytes FROM astra_forecast_daily;
PRAGMA foreign_key_check;
