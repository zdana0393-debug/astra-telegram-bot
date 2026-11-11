-- Compatibility ID: astra25-before-0025-referrers.v1 (not a numeric migration).
-- Apply only after validated0024 and before0025, on a backed-up isolated copy.
-- No audit table, identifiers, awards, balances or paid material are changed.
UPDATE astra_users SET referrer_id=NULL
WHERE referrer_id IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM astra_users referrer WHERE referrer.telegram_id=astra_users.referrer_id);
