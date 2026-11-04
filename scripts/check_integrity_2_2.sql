-- Read-only, STAGING astra-staging-21 only. Run after scripts/check_integrity.sql.
-- Expected reward_mismatches=0, orphan_rewards=0.
SELECT count(*) AS reward_mismatches FROM astra_shell_rewards r WHERE NOT EXISTS (
  SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='easter:'||r.code||':'||r.telegram_id
    AND l.telegram_id=r.telegram_id AND l.operation_id IS NULL AND l.delta=5 AND l.reason='easter:'||r.code
);
SELECT count(*) AS orphan_rewards FROM astra_shell_rewards r WHERE NOT EXISTS (
  SELECT 1 FROM astra_users u WHERE u.telegram_id=r.telegram_id
);
SELECT count(*) AS unclaimed_reward_entries FROM astra_wallet_ledger l WHERE l.reason='easter:gpt6' AND NOT EXISTS (
  SELECT 1 FROM astra_shell_rewards r WHERE r.telegram_id=l.telegram_id AND r.code='gpt6'
);
SELECT code, count(*) AS claimed FROM astra_shell_rewards GROUP BY code;
