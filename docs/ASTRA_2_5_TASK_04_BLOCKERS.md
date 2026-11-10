# TASK04 — воспроизводимые STOP-SHIP находки

Локально, синтетические данные. Не инструкция менять production/D1/Worker. Полные результаты — TASK04_REPORT и machine verification. Старые SQL/Worker не исправлялись.

## B1 — старый referrer после /delete

**Исходный факт:** `src/02_SCHEMA.sql` не имеет FK у `astra_users.referrer_id`; `src/01_ASTRA_V2.js` при /delete удаляет только саму строку. Значит, в допустимой2.0 могут оставаться invitee.referrer_id без соответствующего профиля.

Воспроизведение — `tests/astra25-upgrade.test.mjs`, случаи `original2.0 allows delete leaving dangling referrer` и `exact raw25 reproducer`:

```sh
node --experimental-sqlite --test-name-pattern 'dangling|raw25' tests/astra25-upgrade.test.mjs
```

В новой локальной fixture: создать реферера1, приглашённого2 со ссылкой1, удалить1; полные21–24 проходят,25 с FK ON получает `FOREIGN KEY constraint failed`. Откат файла сохраняет24. Новый runner раньше выдаёт `LEGACY_DANGLING_REFERRER_REQUIRES_REVIEW`, без backup/output/нормализации данных. Обычный foreign_key_check самой старой2.0 не показывает эту ссылку.

**Нужно решение владельца:** отдельная read-only проверка фактической2.0. При отсутствии проблемы — чистый маршрут. При наличии — утвердить новый forward-only compatibility этап и явную политику разрешения ссылки на удалённый профиль, затем новый manifest и preservation expectations. Возможное минимальное направление — очистить только недействительные referrer_id с согласованным backup/агрегатным аудитом. Не хранить удалённые ID в новой скрытой бессрочной таблице. Номер/порядок нового этапа здесь не назначается, старые файлы не переписываются. Dummy-профили, FK OFF и silent skip запрещены.

## B2 — повторные ошибки markup оставляют1 операцию запаса

Frozen candidate SHA `d6ae0b3aed3c80bae0da2969042e3e3e6b21d71061fcbea38b329ab6d72cb15f`.

Воспроизведение — последний тест `tests/astra25-cost.test.mjs`:

```sh
node --experimental-sqlite --test-name-pattern 'known d6ae' tests/astra25-cost.test.mjs
```

Только fake API, схема2.0→29, synthetic HMAC, структура допустимого архивного snapshot с58000 единицами текста до оплаты, затем fake400 на editMessageReplyMarkup. Получено **33 SQL +16 HTTP=49**, webhook500, purchase1, ledger−32 один, баланс100→68, delivery unknown. Текст stress fixture не является новой редакцией реального карточного каталога.

Официальный50 **не превышен**, фактических облачных ошибок quota/CPU не измеряли. Но консервативный коридор48 (резерв2) не выдержан. Test PASS означает «находка воспроизведена», не «выпуск принят»: verification.release_acceptance=false.

**Минимальное предложение отдельной правки:** единый budget-aware error reporter, без каскада новых экранов; отдельно обрабатывать ошибку клавиатуры после принятого текста; сохранять резерв на завершение update job. Не менять SQL/тарифы/оплаченный текст/финансовую exactly-once гарантию и не повторять unknown автоматически. В этом TASK04 patch не применён; нужна отдельная постановка/проверка.

## Связанные обязательные ограничения

- Старый2.0 может напрямую изменить balance на новой схеме: отдельный business test показывает wallet mismatch. Остановка всех writers обязательна; не считать новый health или CLI acknowledgement физическим ограждением старого Worker.
- Неоплаченные offers29 сохраняются после TTL; текущий delete guard запрещает их purge при живом профиле. Retention preview read-only, период не одобрен. Перед публичным включением нужны решение по storage/rate/capped retention и отдельная forward-only политика. Paid защищённые материалы не удалять ради квоты.
- Настоящие Cloudflare CPU/D1/Telegram и фактический production source не проверялись. Старый повреждённый staging не исследовался. Публичный запуск запрещён до будущей отдельно разрешённой приёмки.
