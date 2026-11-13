-- Read-only checks ONLY for the owner's NEW astra25-release. No personal rows.
SELECT type,count(*) AS objects FROM sqlite_master
WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name<>'_cf_KV'
GROUP BY type ORDER BY type;

SELECT (SELECT count(*) FROM astra_users) AS users,
       (SELECT coalesce(sum(balance),0) FROM astra_users) AS total_dust,
       (SELECT count(*) FROM astra_processed_updates) AS processed_updates,
       (SELECT count(*) FROM astra_wallet_ledger) AS ledger_entries,
       (SELECT count(*) FROM astra_tarot25_purchases29) AS paid_tarot,
       (SELECT count(*) FROM astra_forecast_unlocks) AS paid_forecasts;

SELECT p.migration_done AS economy_done,p.enabled AS economy_enabled,
       p.stars_enabled,c.delivery_quarantined,
       r.migration_done AS tarot_done,r.enabled AS tarot_enabled,
       s.migration_done AS storage_done,s.write_enabled,s.cleanup_enabled,
       i.migration_done AS intents_done,i.enabled AS independent_enabled,
       i.questions_enabled,i.cleanup_enabled AS intent_cleanup
FROM astra_policy p JOIN astra_consent_runtime28 c USING(singleton)
JOIN astra_tarot25_runtime29 r USING(singleton)
JOIN astra_tarot30_policy s USING(singleton)
JOIN astra_tarot31_policy i USING(singleton);

PRAGMA foreign_key_check;
