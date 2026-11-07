-- Captured once while writers are paused. No reward/active day is reconstructed.
INSERT OR IGNORE INTO astra_user_policy(telegram_id,generation,mode,registered_day)
 SELECT telegram_id,lower(hex(randomblob(16))),'legacy',date(created_at,'+3 hours') FROM astra_users;
INSERT OR IGNORE INTO astra_referral_contracts(invitee,referrer,generation,mode,status,created_day)
 SELECT u.telegram_id,u.referrer_id,p.generation,'legacy',CASE WHEN u.referral_rewarded=1 THEN 'paid' WHEN u.referrer_id IS NULL THEN 'cancelled' ELSE 'pending' END,p.registered_day
 FROM astra_users u JOIN astra_user_policy p USING(telegram_id) WHERE u.referrer_id IS NOT NULL;
INSERT OR IGNORE INTO astra_policy_events(update_id,telegram_id,day,source,legacy,processed)
 SELECT j.update_id,CASE WHEN EXISTS(SELECT 1 FROM astra_users u WHERE u.telegram_id=j.telegram_id) THEN j.telegram_id END,
 date(j.received_at,'+3 hours'),'legacy',1,1 FROM astra_update_jobs j WHERE (SELECT migration_done FROM astra_policy WHERE singleton=1)=0;
UPDATE astra_policy SET migration_done=1 WHERE singleton=1 AND migration_done=0;
