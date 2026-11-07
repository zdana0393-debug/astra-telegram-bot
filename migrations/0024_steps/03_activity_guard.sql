-- Prevent orphans/non-registered activity even with foreign_keys=OFF.
CREATE TRIGGER IF NOT EXISTS astra_activity_guard BEFORE INSERT ON astra_activity_days BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=NEW.telegram_id
   AND zodiac IN ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'))
 THEN RAISE(IGNORE) END;
END;
