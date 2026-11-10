-- Read-only, all violations must be zero. Fence time uses current UTC seconds, not the Moscow calendar day.
SELECT 'wallet_sum' AS check_name,count(*) AS violations FROM astra_users u WHERE balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)
UNION ALL SELECT 'negative_balance',count(*) FROM astra_users WHERE balance<0
UNION ALL SELECT 'award_ledger',count(*) FROM astra_bonus_awards26 a WHERE NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key=a.award_id AND l.telegram_id=a.telegram_id AND l.delta=a.amount AND l.reason='reward:v3:'||a.kind)
UNION ALL SELECT 'award_profile',count(*) FROM astra_bonus_awards26 a WHERE NOT EXISTS(SELECT 1 FROM astra_user_policy p WHERE p.telegram_id=a.telegram_id AND p.generation=a.generation)
UNION ALL SELECT 'fence_ttl_shape',count(*) FROM astra_bonus_fences26 WHERE expires_at<>awarded_at+2592000 OR length(subject_hash)<>64
UNION ALL SELECT 'paid_referral_pair',count(*) FROM astra_bonus_referrals26 c WHERE c.mode='new' AND c.status='paid' AND c.inviter IS NOT NULL AND (SELECT count(*) FROM astra_bonus_awards26 a WHERE a.reference=c.invitee_generation AND a.kind IN('referrer','invitee'))<>2
UNION ALL SELECT 'tarot5_ledger',count(*) FROM astra_tarot_purchases26 p WHERE p.price<>5 OR NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='tarot26:'||p.offer_id AND l.telegram_id=p.telegram_id AND l.delta=-5 AND l.reason='tarot:v2')
UNION ALL SELECT 'legacy_tarot3',count(*) FROM astra_operations WHERE reason='tarot' AND(delta<>-3 OR result IS NULL)
UNION ALL SELECT 'charge_duplicates',count(*) FROM(SELECT charge_hash FROM astra_all_receipts26 GROUP BY charge_hash HAVING count(*)>1)
UNION ALL SELECT 'receipt_tombstone',count(*) FROM astra_all_receipts26 r WHERE NOT EXISTS(SELECT 1 FROM astra_payment_tombstones t WHERE t.charge_hash=r.charge_hash AND t.xtr=r.xtr AND t.credited_dust=r.credited_dust)
UNION ALL SELECT 'payment_ledger_live',count(*) FROM astra_all_receipts26 r JOIN astra_all_orders26 o USING(order_id) WHERE o.owner_id IS NOT NULL AND r.credited_dust>0 AND NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='stars:'||r.charge_hash AND l.telegram_id=o.owner_id AND l.delta=r.credited_dust)
UNION ALL SELECT 'refund_debt',count(*) FROM astra_refund_accounts a WHERE a.debt<>(SELECT coalesce(sum(debt_added),0) FROM astra_refund_settlements s WHERE s.payer_id=a.payer_id)-(SELECT coalesce(sum(amount),0) FROM astra_debt_repayments d WHERE d.payer_id=a.payer_id)
UNION ALL SELECT 'order_index_orphan',count(*) FROM astra_payment_order_index26 i WHERE NOT EXISTS(SELECT 1 FROM astra_all_orders26 o WHERE o.order_id=i.order_id)
UNION ALL SELECT 'profile_missing',count(*) FROM astra_users u WHERE NOT EXISTS(SELECT 1 FROM astra_bonus_profiles26 p WHERE p.telegram_id=u.telegram_id)
UNION ALL SELECT 'nontransient_commands',count(*) FROM astra_bonus_commands26;
PRAGMA foreign_key_check;
