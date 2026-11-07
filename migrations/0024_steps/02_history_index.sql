CREATE INDEX IF NOT EXISTS idx_astra_ledger_history
 ON astra_wallet_ledger(telegram_id,created_at DESC,idempotency_key DESC);
