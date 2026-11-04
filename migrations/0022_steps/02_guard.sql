CREATE TRIGGER IF NOT EXISTS astra_shell_reward_guard BEFORE INSERT ON astra_shell_rewards BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id)
    THEN RAISE(ABORT,'Reward requires a profile') END;
END;
