# TASK01 — контракт чистых модулей Таро

Ничего не импортировано в build-2.4/Worker, D1 или Telegram. Платёжных методов и SQL нет. Метаданные proposed_price в spreads — только предложение; текущий basic3=5 остаётся в прежнем Worker.

```js
import {CARDS,getCard} from './src/tarot25/catalog.mjs';
import {createReading,seededRng,serializeSnapshot,parseSnapshot,
        renderSnapshot,splitTelegram} from './src/tarot25/engine.mjs';

const result=createReading({spread_id:'depth-5',theme:'resources'});
const json=serializeSnapshot(result);     // локальная сериализация, НЕ запись в D1
const original=renderSnapshot(parseSnapshot(json)); // исходный text; без RNG/интерпретации
const messages=splitTelegram(original);   // массив строк <=4096 UTF-16 units

// Только воспроизводимый тест; seededRng НЕ криптографический источник.
const test=createReading({spread_id:'relations-3',rng:seededRng('editor-review'),
  created_at:'2026-11-10T09:00:00.000Z'});
```

Продакшн-источник по умолчанию — Web Crypto getRandomValues. Выбор — partial Fisher–Yates, каждый ограниченный индекс получен rejection sampling без modulo-bias; ориентации выбираются отдельными выборками после набора ID. Контракт injected rng: синхронная функция, возвращающая uint32; непригодные значения/1024 подряд отклонённых значений закрывают генерацию ошибкой. Ни seed, ни rng не сохраняются в результате.

`drawCards(spread_id,{rng})`, `validateDraw(draw,spread_id)`, `interpretDraw(draw,spread_id,{theme})` доступны отдельно. draw содержит card_id, reversed:boolean и position_id в фиксированном порядке. Темы: general, relations, work, choice, resources, self. Тематические3 не разрешают подмену своей темы; basic/depth допускают одну из перечисленных.

Необязательный question принимается только с `question_consent:true`, максимум500UTF-16единиц, без управляющих/bidi символов и переносов. Отсутствующий вопрос не сохраняет фиктивное согласие. Отдельного UI согласия/retention в TASK01 нет: будущий вызывающий слой обязан получить действительное согласие, не запрашивать лишние чужие данные и согласовать удаление/срок с владельцем. HTML-подобные символы не исполняются: текст выводится как plain text; будущий транспорт не должен включать parse_mode без отдельного экранирования.

Снимок хранит snapshot_version, deck_version=rws78-v1, engine_version=tarot25-v1, spread_version=tarot25-spreads-v1, spread_id/theme, UTC created_at, необязательный question/consent, выбранные card_id/reversed/position_id, позиционные тексты, связи/правила/советы с источниками и итоговый text. Версии и структура проверяются. renderSnapshot возвращает сохранённый text, не зовёт interpretDraw/RNG/сеть и не обновляет формулировки. В этой фазе поддерживается только архивный контракт v1; неизвестная версия отклоняется. При будущих версиях нужно сохранять v1 reader и структуру его раскладов, а не перезаписывать записи новым генератором.

Валидация — не криптографическая подпись и не авторизация покупки. Целостность/неизменяемость строки, generation owner, цена и атомарная оплата остаются задачами будущей D1-интеграции. Текущий Worker продолжает открывать прежние текстовые покупки своим прежним кодом; новый reader не пытается переинтерпретировать исторические строки2.4.

splitTelegram сохраняет все исходные символы и не разрывает Unicode grapheme (эмодзи/сочетания/диакритику), предпочитает границы строк/пробелов во второй половине допустимого отрезка. Callback_data и клавиатуры вообще не входят в текстовый splitter: их будущий транспорт обязан передавать отдельным объектом, не дробить и проверять64байта. Функция не отправляет сообщения. Intl.Segmenter и бюджет будущего Cloudflare Worker проверяются отдельно при интеграции.

Предельный текст60000символов, JSON300000символов, max10разных карт. После изменения канонического содержания нужны новые версии для новых результатов; уже сохранённый снимок не пересоздаётся. Отображение всех длинных раскладов, order/delivery/idempotency и privacy вопроса в реальном Telegram относятся к TASK02–04.
