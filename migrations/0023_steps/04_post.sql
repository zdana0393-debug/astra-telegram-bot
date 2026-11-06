CREATE TRIGGER IF NOT EXISTS astra_forecast_post AFTER INSERT ON astra_forecast_unlocks BEGIN
 UPDATE astra_users SET balance=balance-4 WHERE telegram_id=NEW.telegram_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,operation_id,telegram_id,delta,reason)
  VALUES('forecast:extended:'||NEW.telegram_id||':'||NEW.day,NULL,NEW.telegram_id,-4,'forecast:extended');
END;
