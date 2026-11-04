-- STAGING ONLY: astra-staging-21. Requires the complete 2.1 schema.
CREATE TABLE IF NOT EXISTS astra_shell_rewards (
  telegram_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK(code='gpt6'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id,code)
);
