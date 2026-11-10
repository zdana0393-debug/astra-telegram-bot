-- READ ONLY. For owner inspection of the chosen staging DB after future installation.
-- No Telegram IDs, payloads, free_text or secrets in these aggregate results.
SELECT date('now','+3 hours') AS moscow_day, strftime('%H:%M','now') AS utc_time;
SELECT singleton,migration_done,lease_until,cooldown_until,
 CASE WHEN lease_until>unixepoch() THEN 'leased' ELSE 'available' END AS lease_state,
 CASE WHEN cooldown_until>unixepoch() THEN 'cooldown' ELSE 'available' END AS rate_state
FROM astra_broadcast_runtime03;
SELECT count(*) AS users,
 sum(CASE WHEN notifications_enabled=1 THEN 1 ELSE 0 END) AS notifications_on,
 sum(CASE WHEN notifications_enabled=0 THEN 1 ELSE 0 END) AS notifications_off,
 sum(CASE WHEN notifications_enabled=1 AND zodiac IS NULL THEN 1 ELSE 0 END) AS on_without_sign
FROM astra_users;
SELECT day,state,attempts,last_code,last_reason,count(*) AS recipients
FROM astra_broadcast_outbox03 WHERE day>=date('now','+3 hours','-2 days')
GROUP BY day,state,attempts,last_code,last_reason ORDER BY day,state;
SELECT delivery,count(*) AS legacy_jobs_without_new_outbox
FROM astra_broadcast_jobs b WHERE b.day=date('now','+3 hours')
AND NOT EXISTS(SELECT 1 FROM astra_broadcast_outbox03 q WHERE q.telegram_id=b.telegram_id AND q.day=b.day)
GROUP BY delivery;
SELECT count(*) AS eligible_new_or_due
FROM astra_users u JOIN astra_user_policy p USING(telegram_id)
LEFT JOIN astra_broadcast_jobs b ON b.telegram_id=u.telegram_id AND b.day=date('now','+3 hours')
LEFT JOIN astra_broadcast_outbox03 q ON q.telegram_id=u.telegram_id AND q.day=date('now','+3 hours')
WHERE u.notifications_enabled=1
AND u.zodiac IN('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')
AND(u.last_broadcast_day IS NULL OR u.last_broadcast_day<>date('now','+3 hours'))
AND((b.telegram_id IS NULL AND q.telegram_id IS NULL)
 OR(q.state='retry' AND q.attempts<3 AND q.not_before<=unixepoch() AND q.generation=p.generation AND q.sign=u.zodiac));
