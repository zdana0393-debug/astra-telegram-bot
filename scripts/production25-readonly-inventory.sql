-- Подготовлено для отдельного разрешения владельца. Сейчас на production НЕ запускать.
-- Только схема и агрегаты; нет персональных профилей, текстов, token или file_id.
-- Это диагностика исходной Astra2.0; она не выполняет миграцию/backup.
SELECT type,name,tbl_name,sql FROM sqlite_master
WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name;

SELECT cid,name,type,"notnull",dflt_value,pk FROM pragma_table_info('astra_users') ORDER BY cid;
SELECT cid,name,type,"notnull",dflt_value,pk FROM pragma_table_info('astra_processed_updates') ORDER BY cid;

SELECT count(*) AS users,
       coalesce(sum(balance),0) AS total_balance,
       min(balance) AS minimum_balance,max(balance) AS maximum_balance,
       coalesce(sum(CASE WHEN typeof(telegram_id)<>'integer' OR telegram_id<=0 THEN 1 ELSE 0 END),0) AS invalid_ids,
       coalesce(sum(CASE WHEN typeof(balance)<>'integer' OR balance<0 THEN 1 ELSE 0 END),0) AS invalid_balances,
       coalesce(sum(CASE WHEN referrer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM astra_users r WHERE r.telegram_id=u.referrer_id) THEN 1 ELSE 0 END),0) AS orphan_referrers,
       coalesce(sum(CASE WHEN referrer_id=telegram_id THEN 1 ELSE 0 END),0) AS self_referrers,
       coalesce(sum(CASE WHEN date(created_at,'+3 hours') IS NULL THEN 1 ELSE 0 END),0) AS invalid_creation_dates
FROM astra_users u;
SELECT notifications_enabled,count(*) AS users FROM astra_users GROUP BY notifications_enabled;
SELECT count(*) AS processed_updates,min(update_id) AS earliest_update,max(update_id) AS latest_update
FROM astra_processed_updates;
