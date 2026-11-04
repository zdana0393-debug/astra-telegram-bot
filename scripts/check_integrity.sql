-- Read-only aggregates. Expected mismatches=0, unposted_operations=0, orphan_entries=0.
SELECT count(*) AS users, coalesce(sum(balance),0) AS total_balance FROM astra_users;
SELECT count(*) AS mismatches FROM astra_users u WHERE balance < 0 OR balance <>
 (SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id);
SELECT count(*) AS unposted_operations FROM astra_operations o WHERE NOT EXISTS
 (SELECT 1 FROM astra_wallet_ledger l WHERE l.operation_id=o.operation_id AND l.telegram_id=o.telegram_id AND l.delta=o.delta AND l.reason=o.reason);
SELECT count(*) AS orphan_entries FROM astra_wallet_ledger l WHERE NOT EXISTS
 (SELECT 1 FROM astra_users u WHERE u.telegram_id=l.telegram_id);
SELECT reason, count(*) AS entries, sum(delta) AS total_delta FROM astra_wallet_ledger GROUP BY reason;
SELECT delivery, count(*) AS operations FROM astra_operations GROUP BY delivery;
SELECT delivery, count(*) AS broadcasts FROM astra_broadcast_jobs GROUP BY delivery;
PRAGMA foreign_key_check;
