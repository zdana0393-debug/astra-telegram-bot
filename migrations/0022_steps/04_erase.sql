-- Complements astra_erase, without replacing it; works with foreign_keys=OFF.
CREATE TRIGGER IF NOT EXISTS astra_shell_erase AFTER DELETE ON astra_users BEGIN
  DELETE FROM astra_shell_rewards WHERE telegram_id=OLD.telegram_id;
END;
