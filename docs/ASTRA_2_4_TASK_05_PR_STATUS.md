# Draft PR: запрос подготовлен, GitHub API отклонил создание

Репозиторий: zdana0393-debug/astra-telegram-bot.
Head: astra-2.4-prestaging-ux-patch.
Base: astra-2.4b-rewards-stars.
Код и полный отчёт кандидата опубликованы коммитом05077e2; исправление грамматики —2c0c341. Последующий документационный коммит фиксирует этот отказ, без изменения Worker.

Обычный git push успешен. Draft PR **не создан**: оба вызова CLI завершились exit1.

Проверка существующего PR:

```text
Post "https://api.github.com/graphql": Forbidden
```

Попытка создать через REST с draft=true, правильными head/base и body из ASTRA_2_4_TASK_05_PR_BODY.md:

```text
Post "https://api.github.com/repos/zdana0393-debug/astra-telegram-bot/pulls": Forbidden
```

Это не автоматический отказ ревью кода и не доказательство отсутствия репозитория. Права API не обходились, секреты не запрашивались; merge не выполнялся.

[Открыть создание PR с нужными head/base](https://github.com/zdana0393-debug/astra-telegram-bot/compare/astra-2.4b-rewards-stars...astra-2.4-prestaging-ux-patch?expand=1)

В браузере выбрать **Create draft pull request**, вставить описание из ASTRA_2_4_TASK_05_PR_BODY.md. База именно astra-2.4b-rewards-stars, не main. Релиз остаётся manual-only/STOP-SHIP для рассылки, никакое создание PR не разрешает деплой или0028.
