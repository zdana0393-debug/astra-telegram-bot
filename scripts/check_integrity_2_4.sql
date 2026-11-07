-- Read-only; each violation count must be zero. Run with writers paused for a stable snapshot.
SELECT 'wallet_sum' AS check_name,count(*) AS violations FROM astra_users u WHERE u.balance<>(SELECT coalesce(sum(l.delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)
UNION ALL SELECT 'negative_balance',count(*) FROM astra_users WHERE balance<0
UNION ALL SELECT 'reward_ledger',count(*) FROM astra_reward_claims c WHERE NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key=c.claim_id AND l.telegram_id=c.telegram_id AND l.delta=c.amount AND l.reason='reward:v2:'||c.kind)
UNION ALL SELECT 'daily_claim',count(*) FROM astra_policy_days d WHERE NOT EXISTS(SELECT 1 FROM astra_reward_claims c WHERE c.telegram_id=d.telegram_id AND c.kind='daily' AND c.day=d.day AND c.amount=3)
UNION ALL SELECT 'referral_pair',count(*) FROM astra_referral_contracts c WHERE c.mode='v2' AND c.status='paid' AND c.referrer IS NOT NULL AND ((SELECT count(*) FROM astra_reward_claims r WHERE r.kind IN ('invitee','referrer') AND r.reference=c.generation)<>2)
UNION ALL SELECT 'live_payment_ledger',count(*) FROM astra_payment_receipts r JOIN astra_payment_orders o USING(order_id) WHERE o.owner_id IS NOT NULL AND r.credited_dust>0 AND NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='stars:'||r.charge_hash AND l.telegram_id=o.owner_id AND l.delta=r.credited_dust)
UNION ALL SELECT 'payment_tombstone',count(*) FROM astra_payment_receipts r WHERE NOT EXISTS(SELECT 1 FROM astra_payment_tombstones t WHERE t.charge_hash=r.charge_hash AND t.xtr=r.xtr AND t.credited_dust=r.credited_dust)
UNION ALL SELECT 'refund_arithmetic',count(*) FROM astra_refund_settlements WHERE removed+debt_added<>reversed_dust
UNION ALL SELECT 'refund_debt',count(*) FROM astra_refund_accounts a WHERE a.debt<>(SELECT coalesce(sum(s.debt_added),0) FROM astra_refund_settlements s WHERE s.payer_id=a.payer_id)-(SELECT coalesce(sum(r.amount),0) FROM astra_debt_repayments r WHERE r.payer_id=a.payer_id)
UNION ALL SELECT 'refund_without_settlement',count(*) FROM astra_external_refunds n WHERE NOT EXISTS(SELECT 1 FROM astra_refund_settlements s WHERE s.charge_hash=n.charge_hash)
UNION ALL SELECT 'settlement_tombstone',count(*) FROM astra_refund_settlements s WHERE NOT EXISTS(SELECT 1 FROM astra_payment_tombstones t WHERE t.charge_hash=s.charge_hash AND t.refunded=1)
UNION ALL SELECT 'repayment_without_account',count(*) FROM astra_debt_repayments r WHERE NOT EXISTS(SELECT 1 FROM astra_refund_accounts a WHERE a.payer_id=r.payer_id)
UNION ALL SELECT 'old_referral_trigger',count(*) FROM sqlite_master WHERE type='trigger' AND name='astra_referral'
UNION ALL SELECT 'policy_snapshot_missing',count(*) FROM astra_users u WHERE NOT EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=u.telegram_id);
PRAGMA foreign_key_check;
