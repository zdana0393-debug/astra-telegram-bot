CREATE TRIGGER IF NOT EXISTS astra_shell_reward_post AFTER INSERT ON astra_shell_rewards BEGIN
  UPDATE astra_users SET balance=balance+5 WHERE telegram_id=NEW.telegram_id;
  INSERT INTO astra_wallet_ledger(idempotency_key,operation_id,telegram_id,delta,reason)
    VALUES('easter:'||NEW.code||':'||NEW.telegram_id,NULL,NEW.telegram_id,5,'easter:'||NEW.code);
END;
