import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import catalog from '../data/forecast/catalog.v1.json' with {type:'json'};
import {createForecastGenerator,ENGINE_VERSION} from '../src/forecast/engine.mjs';
const legacySource=fs.readFileSync(new URL('../release/ASTRA_2_3_EDITORIAL_WORKER.js',import.meta.url),'utf8');
const legacyHashReference=vm.runInNewContext(legacySource.replace('export default {','globalThis.worker = {')+'\n;hash;');
const generate=createForecastGenerator(catalog),counts={},bodies=new Map(),full=new Set(),used=new Set(),runes=new Set(),advice=new Set();
let adjacentRepeatedUnits=0;const previousUnits=new Map();
let maxFreeBytes=0,maxExtendedBytes=0,extendedBytes=0;
let total=0,minWords=Infinity,maxWords=0,maxChars=0,maxExtendedChars=0,bytes=0,adjacentDuplicates=0,violations=0,crossSignFailures=0;
const previous=new Map(),themes={};
for(let d=new Date('2026-01-01T12:00:00Z');d<new Date('2031-01-01T12:00:00Z');d.setUTCDate(d.getUTCDate()+1)){
  const day=d.toISOString().slice(0,10),dayBodies=new Set();
  for(const s of catalog.signs){
    const f=generate(s.sign_id,day);assert.equal(f.number,legacyHashReference(s.sign_id+day)%9+1);total++;full.add(f.free_text);const body=f.free_text.replace(/\d{4}-\d{2}-\d{2}/g,'<date>');
    bodies.set(body,(bodies.get(body)||0)+1);if(previous.get(s.sign_id)===body)adjacentDuplicates++;previous.set(s.sign_id,body);
    dayBodies.add(f.free_text.split('\n\n').slice(1).join('\n\n'));
    minWords=Math.min(minWords,f.words);maxWords=Math.max(maxWords,f.words);maxChars=Math.max(maxChars,f.free_text.length);maxExtendedChars=Math.max(maxExtendedChars,f.extended_text.length);
    maxFreeBytes=Math.max(maxFreeBytes,Buffer.byteLength(f.free_text));maxExtendedBytes=Math.max(maxExtendedBytes,Buffer.byteLength(f.extended_text));extendedBytes+=Buffer.byteLength(f.extended_text)+Buffer.byteLength(f.source_tags);
    if(previousUnits.has(s.sign_id))adjacentRepeatedUnits+=f.trace.units.filter(id=>previousUnits.get(s.sign_id).includes(id)).length;previousUnits.set(s.sign_id,f.trace.units);
    bytes+=Buffer.byteLength(f.free_text)+Buffer.byteLength(f.extended_text)+Buffer.byteLength(f.source_tags);
    for(const id of f.trace.units){used.add(id);assert.equal(catalog.units.find(u=>u.id===id).theme,f.trace.theme);}
    for(const [group,id] of [[catalog.runes,f.trace.rune],[catalog.symbols,f.trace.symbol],[catalog.advice,f.trace.advice]])assert.ok(group.find(r=>r.id===id).allowed_themes.includes(f.trace.theme));
    runes.add(f.trace.rune);advice.add(f.trace.advice);themes[f.trace.theme]=(themes[f.trace.theme]||0)+1;
    for(const section of ['Тема ·','Отношения и общение','Работа, учёба и дела','Финансы и ресурсы','Эмоциональный ритм','🔢 Число дня:','Практический итог'])assert.ok(f.free_text.includes(section));
    assert.equal(f.free_text,generate(s.sign_id,day).free_text);
    for(const u of f.trace.units)assert.ok(!f.extended_text.includes(catalog.units.find(x=>x.id===u).body),'Paid material copies free block');
    const forbidden=/сегодня\s+(?:Марс|Венера|Меркурий|Сатурн).{0,30}(?:квадратур|соединени|транзит)|Луна перешла|ретроградный Меркурий влияет|неизбежн.{0,15}(?:смерть|болезнь)|гарантированн.{0,15}(?:прибыль|доход)|избегайте любого общения/iu;
    if(forbidden.test(f.free_text+'\n'+f.extended_text))violations++;
    const year=day.slice(0,4);counts[year]=(counts[year]||0)+1;
  }if(dayBodies.size!==12)crossSignFailures++;
}
assert.equal(violations,0);assert.equal(crossSignFailures,0);assert.equal(used.size,catalog.units.length);assert.equal(runes.size,24);assert.equal(advice.size,catalog.advice.length);
const metrics={engine_version:ENGINE_VERSION,content_version:catalog.content_version,range:['2026-01-01','2030-12-31'],dates:total/12,signs:12,cases:total,cases_by_year:counts,
  units_by_section:Object.fromEntries(['theme','relations','work','finance','mood','action'].map(s=>[s,catalog.units.filter(u=>u.section===s).length])),
  signs_by_element:Object.fromEntries(['fire','earth','air','water'].map(e=>[e,catalog.signs.filter(s=>s.element_id===e).length])),
  corpus:{thematic_units:catalog.units.length,signs:catalog.signs.length,sign_section_profiles:48,modalities:3,number_pairs:9,runes:24,symbols:12,advice:24},
  min_russian_words:minWords,max_russian_words:maxWords,max_free_utf16:maxChars,max_extended_utf16:maxExtendedChars,max_free_utf8_bytes:maxFreeBytes,max_extended_utf8_bytes:maxExtendedBytes,average_paid_payload_bytes:Math.round(extendedBytes/total),adjacent_repeated_thematic_units:adjacentRepeatedUnits,average_cache_payload_bytes:Math.round(bytes/total),
  whole_text_duplicates:total-full.size,content_duplicates_ignoring_date:total-bodies.size,max_identical_body_occurrences:Math.max(...bodies.values()),adjacent_body_duplicates:adjacentDuplicates,
  cross_sign_body_failures:crossSignFailures,forbidden_pattern_hits:violations,compatibility_failures:0,selected_units_covered:used.size,theme_counts:themes,
  limits:'Automated checks find specified patterns/tag conflicts; they do not prove literary quality or D1/Telegram behavior.'};
fs.writeFileSync(new URL('../docs/ASTRA_2_3B_METRICS.json',import.meta.url),JSON.stringify(metrics,null,2)+'\n');
let samples='# Astra 2.3B: реальные образцы для редакционного ревью\n\nСгенерированы тем же чистым движком, который встроен в Worker, без ручной подмены и онлайн-LLM. Это массовая символическая интерпретация, не рассчитанные транзиты. Все даты — Europe/Moscow.\n\n';
for(const s of catalog.signs){const f=generate(s.sign_id,'2026-11-07');samples+=`## ${s.label} · 2026-11-07\n\n${f.free_text}\n\n*${f.words} русских слов; тема ${f.trace.theme}; ${f.engine_version}; ${f.content_version}.*\n\n`;}
samples+='## Четыре последовательные даты: Дева\n\n';
for(const date of ['2026-11-07','2026-11-08','2026-11-09','2026-11-10']){const f=generate('virgo',date);samples+=`### ${date}\n\n${f.free_text}\n\n*${f.words} русских слов; тема ${f.trace.theme}.*\n\n`;}
for(const [sign,date] of [['scorpio','2026-11-07'],['libra','2026-11-08']]){const f=generate(sign,date);samples+=`## Расширенный пример: ${sign} · ${date}\n\n${f.extended_text}\n\n*Связан с темой ${f.trace.theme}; то же бесплатное число ${f.number}. Символ ${f.trace.symbol}, руна ${f.trace.rune}, совет ${f.trace.advice}. Ни один выбранный бесплатный блок не включён повторно в расширенный текст.*\n\n`;}
samples+='## Границы автоматической и ручной оценки\n\nДлина, обязательные разделы, стабильность и тематические теги проверены автоматически по пятилетней выборке. Содержательная связность и тон требуют редакционного чтения: особенно перехода от общей доминанты к профилю знака, уместности афоризма и реальной ценности расширения. Метрики повторов без даты опубликованы отдельно; повторение смысловых единиц в ограниченном каталоге не скрывается. Эти образцы не являются независимым одобрением владельца.\n';
fs.writeFileSync(new URL('../docs/ASTRA_2_3B_EDITORIAL_SAMPLES.md',import.meta.url),samples);
console.log(JSON.stringify(metrics));
