import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import catalog from '../data/forecast/catalog.v1.json' with {type:'json'};
import {createForecastGenerator,ENGINE_VERSION,SECTIONS} from '../src/forecast/engine.mjs';
const baselineCommit='e9cff2b6d8cf5bfee9c35375e392f04804eca18c';
const legacySource=fs.readFileSync(new URL('../release/ASTRA_2_3_EDITORIAL_WORKER.js',import.meta.url),'utf8');
const legacyHashReference=vm.runInNewContext(legacySource.replace('export default {','globalThis.worker = {')+'\n;hash;');
if(!process.argv[2])throw Error('Pass baseline JS: git show '+baselineCommit+':release/ASTRA_2_3B_WORKER.js > /tmp/astra-baseline.js; node scripts/audit-forecast.mjs /tmp/astra-baseline.js');
const baselineSource=fs.readFileSync(process.argv[2],'utf8');
const baseline=vm.runInNewContext(baselineSource.replace('export default {','globalThis.worker = {')+'\n;({generate:createForecastGenerator(catalog),catalog});',{structuredClone});
const generate=createForecastGenerator(catalog);
const normalize=s=>s.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^а-я0-9]+/gu,' ').trim();
const paragraphs=f=>{const p=f.free_text.split('\n\n');return [p[1],p[2],p[3],p[4],p[5],p[7]].map(s=>s.split('\n').slice(1).join('\n'));};
const slots=()=>Object.fromEntries(SECTIONS.map(s=>[s,0]));
function audit(g,c){
  const bodies=new Map(),full=new Set(),used=new Set(),lenses=new Set(),modal=new Set(),runes=new Set(),advice=new Set();
  const perSection=Object.fromEntries(SECTIONS.map(s=>[s,new Set()])),last=new Map(),previous=new Map();
  const allUnits=new Map([...c.units,...(c.sign_lenses||[]),...(c.modality_lenses||[])].map(u=>[u.id,u]));
  const windows=Object.fromEntries([30,90].map(w=>[w,{paragraphs_reused:slots(),core_fragments_reused:slots(),core_and_sign_facet_reused:slots(),forecasts_with_reused_paragraph:0,eligible_forecasts:0}]));
  let total=0,minWords=Infinity,maxWords=0,maxChars=0,maxExtendedChars=0,maxFreeBytes=0,maxExtendedBytes=0,bytes=0,extendedBytes=0;
  let adjacentBodies=0,adjacentParagraphs=0,adjacentSentences=0,adjacentSentenceDenominator=0,violations=0;
  const crossSign=slots(),crossSignPairs=slots();let fullBodyFailures=0;
  const nearSample=new Map();const covered=new Map();
  for(let d=new Date('2026-01-01T12:00:00Z'),ordinal=0;d<new Date('2031-01-01T12:00:00Z');d.setUTCDate(d.getUTCDate()+1),ordinal++){
    const day=d.toISOString().slice(0,10),sameDay=Object.fromEntries(SECTIONS.map(s=>[s,[]])),dayBodies=new Set();
    for(const sign of c.signs){
      const f=g(sign.sign_id,day);assert.equal(f.number,legacyHashReference(sign.sign_id+day)%9+1);total++;
      assert.ok(f.words>=160&&f.words<=260);assert.ok(f.free_text.length<=4096&&f.extended_text.length<=4096);
      const repeated=g(sign.sign_id,day);assert.equal(f.free_text,repeated.free_text);assert.equal(f.extended_text,repeated.extended_text);
      for(const heading of ['Тема ·','Отношения и общение','Работа, учёба и дела','Финансы и ресурсы','Эмоциональный ритм','🔢 Число дня:','Практический итог'])assert.ok(f.free_text.includes(heading));
      full.add(f.free_text);const body=f.free_text.replace(/\d{4}-\d{2}-\d{2}/g,'<date>');bodies.set(body,(bodies.get(body)||0)+1);
      dayBodies.add(f.free_text.split('\n\n').slice(1).join('\n\n'));
      const pp=paragraphs(f).map(normalize),sentences=paragraphs(f).flatMap(s=>s.split(/[.!?]/u).map(normalize).filter(Boolean));
      const prev=previous.get(sign.sign_id);
      if(prev){if(prev.body===body)adjacentBodies++;adjacentParagraphs+=pp.filter((p,i)=>p===prev.pp[i]).length;adjacentSentences+=sentences.filter(s=>prev.sentences.has(s)).length;adjacentSentenceDenominator+=sentences.length;}
      previous.set(sign.sign_id,{body,pp,sentences:new Set(sentences)});
      const state=last.get(sign.sign_id)||{paragraphs:SECTIONS.map(()=>new Map()),cores:SECTIONS.map(()=>new Map()),facets:SECTIONS.map(()=>new Map())};
      const reused={30:false,90:false};
      for(let i=0;i<6;i++){
        const section=SECTIONS[i],core=f.trace.units[i],facet=(f.trace.sign_lenses||[])[i]||'fixed-profile';
        const signature=core+'|'+facet;
        perSection[section].add(pp[i]);sameDay[section].push(pp[i]);
        for(const w of [30,90])if(ordinal>=w){
          if(ordinal-(state.paragraphs[i].get(pp[i])??-Infinity)<=w){windows[w].paragraphs_reused[section]++;reused[w]=true;}
          if(ordinal-(state.cores[i].get(core)??-Infinity)<=w)windows[w].core_fragments_reused[section]++;
          if(ordinal-(state.facets[i].get(signature)??-Infinity)<=w)windows[w].core_and_sign_facet_reused[section]++;
        }
        state.paragraphs[i].set(pp[i],ordinal);state.cores[i].set(core,ordinal);state.facets[i].set(signature,ordinal);
      }
      for(const w of [30,90])if(ordinal>=w){windows[w].eligible_forecasts++;if(reused[w])windows[w].forecasts_with_reused_paragraph++;}
      last.set(sign.sign_id,state);
      minWords=Math.min(minWords,f.words);maxWords=Math.max(maxWords,f.words);maxChars=Math.max(maxChars,f.free_text.length);maxExtendedChars=Math.max(maxExtendedChars,f.extended_text.length);
      maxFreeBytes=Math.max(maxFreeBytes,Buffer.byteLength(f.free_text));maxExtendedBytes=Math.max(maxExtendedBytes,Buffer.byteLength(f.extended_text));
      extendedBytes+=Buffer.byteLength(f.extended_text)+Buffer.byteLength(f.source_tags);bytes+=Buffer.byteLength(f.free_text)+Buffer.byteLength(f.extended_text)+Buffer.byteLength(f.source_tags);
      for(const id of f.trace.units){used.add(id);assert.equal(allUnits.get(id).theme,f.trace.theme);assert.ok(!f.extended_text.includes(allUnits.get(id).body),'Paid copies free core');}
      for(const id of f.trace.sign_lenses||[])lenses.add(id);for(const id of f.trace.modality_lenses||[])modal.add(id);
      for(const id of [...(f.trace.sign_lenses||[]),...(f.trace.modality_lenses||[])])assert.ok(!f.extended_text.includes(allUnits.get(id).body),'Paid copies free reading');
      for(const [group,id] of [[c.runes,f.trace.rune],[c.symbols,f.trace.symbol],[c.advice,f.trace.advice]])assert.ok(group.find(r=>r.id===id).allowed_themes.includes(f.trace.theme));
      runes.add(f.trace.rune);advice.add(f.trace.advice);
      const forbidden=/сегодня\s+(?:Марс|Венера|Меркурий|Сатурн).{0,30}(?:квадратур|соединени|транзит)|Луна перешла|ретроградный Меркурий влияет|неизбежн.{0,15}(?:смерть|болезнь)|гарантированн.{0,15}(?:прибыль|доход)|избегайте любого общения/iu;
      if(forbidden.test(f.free_text+'\n'+f.extended_text))violations++;
      if(day>='2026-11-01'&&day<='2027-01-29'){
        const rows=nearSample.get(sign.sign_id)||[];rows.push({pp,day});nearSample.set(sign.sign_id,rows);
      }
      if(c.sign_lenses){
        const rows=[...f.trace.units,...f.trace.sign_lenses,...f.trace.modality_lenses].map(id=>allUnits.get(id));
        for(const exclusion of c.editorial_exclusions||[])assert.ok(!(rows.some(u=>u.id===exclusion.a)&&rows.some(u=>u.id===exclusion.b)));
        for(const row of rows)for(const [axis,value] of Object.entries(row.directives||{}))assert.equal(value,f.trace.directives[axis]);
        const cells=covered.get(sign.sign_id)||new Set();for(const section of SECTIONS)cells.add(section);covered.set(sign.sign_id,cells);
      }
    }
    if(dayBodies.size!==12)fullBodyFailures++;
    for(const section of SECTIONS){const p=sameDay[section];crossSign[section]+=12-new Set(p).size;for(let i=0;i<12;i++)for(let j=0;j<i;j++)if(p[i]===p[j])crossSignPairs[section]++;}
  }
  assert.equal(violations,0);assert.equal(fullBodyFailures,0);assert.equal(used.size,c.units.length);assert.equal(runes.size,24);assert.equal(advice.size,24);
  if(c.sign_lenses){assert.equal(lenses.size,c.sign_lenses.length);assert.equal(modal.size,c.modality_lenses.length);assert.ok(Object.values(crossSign).every(n=>n===0));}
  const shingle=s=>{const w=s.split(' '),set=new Set();for(let i=0;i<w.length-2;i++)set.add(w.slice(i,i+3).join(' '));return set;};
  const similarity=(a,b)=>{let intersection=0;for(const x of a)if(b.has(x))intersection++;return intersection/(a.size+b.size-intersection||1);};
  const near={range:['2026-11-01','2027-01-29'],days_per_sign:90,signs:12,method:'Normalized exact word trigrams; Jaccard >= 0.45. No stemming or semantic model.'};
  for(const window of [1,30,90]){
    let comparisons=0,hits=0,max=0,sum=0;const bySection=slots();
    for(const rows of nearSample.values()){
      const prepared=rows.map(r=>r.pp.map(shingle));
      for(let i=1;i<rows.length;i++)for(let j=Math.max(0,i-window);j<i;j++)for(let s=0;s<6;s++){
        const score=similarity(prepared[i][s],prepared[j][s]);comparisons++;sum+=score;max=Math.max(max,score);if(score>=0.45){hits++;bySection[SECTIONS[s]]++;}
      }
    }
    near[window]={paragraph_pair_comparisons:comparisons,jaccard_at_least_045:hits,by_section:bySection,mean_jaccard:Number((sum/comparisons).toFixed(4)),max_jaccard:Number(max.toFixed(4))};
  }
  const sameDateNear={paragraph_pair_comparisons:0,jaccard_at_least_045:0,by_section:slots(),max_jaccard:0};
  const daily=[...nearSample.values()].map(rows=>rows.map(r=>r.pp.map(shingle)));
  for(let day=0;day<90;day++)for(let i=0;i<12;i++)for(let j=0;j<i;j++)for(let section=0;section<6;section++){
    const score=similarity(daily[i][day][section],daily[j][day][section]);sameDateNear.paragraph_pair_comparisons++;sameDateNear.max_jaccard=Math.max(sameDateNear.max_jaccard,score);
    if(score>=0.45){sameDateNear.jaccard_at_least_045++;sameDateNear.by_section[SECTIONS[section]]++;}
  }
  sameDateNear.max_jaccard=Number(sameDateNear.max_jaccard.toFixed(4));near.cross_sign_same_date=sameDateNear;
  const rhetorical={};
  for(const [key,pattern] of Object.entries({contrast_or_distinction:/различ|отлич|отдел|не .{0,100}(?: а | но | равно|означает|требует)/iu,explicit_question:/\?/u,resource_or_boundary:/опор|берег|границ|ресурс|запас/iu}))rhetorical[key]=c.units.filter(u=>pattern.test(u.body)).length;
  return {cases:total,dates:total/12,whole_text_duplicates:total-full.size,content_duplicates_ignoring_date:total-bodies.size,max_identical_body_occurrences:Math.max(...bodies.values()),min_russian_words:minWords,max_russian_words:maxWords,max_free_utf16:maxChars,max_extended_utf16:maxExtendedChars,max_free_utf8_bytes:maxFreeBytes,max_extended_utf8_bytes:maxExtendedBytes,average_cache_payload_bytes:Math.round(bytes/total),average_paid_payload_bytes:Math.round(extendedBytes/total),
    paragraphs:{occurrences_per_section:total,unique_by_section:Object.fromEntries(SECTIONS.map(s=>[s,perSection[s].size])),same_date_cross_sign_duplicate_occurrences:crossSign,same_date_cross_sign_identical_pairs:crossSignPairs,adjacent_same_sign_identical_paragraphs:adjacentParagraphs,adjacent_same_sign_identical_bodies:adjacentBodies,adjacent_reused_sentences:adjacentSentences,adjacent_sentence_occurrences:adjacentSentenceDenominator,windows},
    lexical_similarity:near,catalog_rhetorical_constructions:{base_units:c.units.length,counts:rhetorical,overlap_allowed:true},selected_units_covered:used.size,selected_sign_readings_covered:lenses.size,selected_modality_readings_covered:modal.size,forbidden_pattern_hits:violations,cross_sign_body_failures:fullBodyFailures};
}
const old=audit(baseline.generate,baseline.catalog),current=audit(generate,catalog);
// Diagnostic only: local Node timing is not Cloudflare isolate CPU or D1 work.
const cold=[],warm=[];for(let i=0;i<30;i++){let t=performance.now();const g=createForecastGenerator(catalog);g('aries','2026-11-07');cold.push(performance.now()-t);}
for(let i=0;i<500;i++){let t=performance.now();generate('aries','2026-11-07');warm.push(performance.now()-t);}
const timing=a=>{a.sort((x,y)=>x-y);return {samples:a.length,median_ms:Number(a[Math.floor(a.length/2)].toFixed(3)),p95_ms:Number(a[Math.floor(a.length*.95)].toFixed(3)),max_ms:Number(a.at(-1).toFixed(3))};};
const metrics={engine_version:ENGINE_VERSION,content_version:catalog.content_version,range:['2026-01-01','2030-12-31'],baseline_commit:baselineCommit,
  corpus:{element_theme_units:catalog.units.length,sign_readings:catalog.sign_lenses.length,modality_readings:catalog.modality_lenses.length,total_context_readings:catalog.units.length+catalog.sign_lenses.length+catalog.modality_lenses.length,expanded_sign_profiles:24,number_pairs:9,runes:24,symbols:12,advice:24},baseline:old,current,
  local_node_diagnostic:{runtime:process.version,cold_generator_and_first_forecast:timing(cold),warm_generation:timing(warm),worker_utf8_bytes:fs.statSync(new URL('../release/ASTRA_2_3B_WORKER.js',import.meta.url)).size,warning:'Node wall-clock only; not Workers CPU, startup, Cron, D1 metadata or errors 1102.'},
  limits:'Exact paragraphs, lexical trigrams, source-fragment/facet recurrence and rhetorical pattern counts are proxies. They cannot prove absence of semantic repetition, literary quality or real D1/Telegram behavior. A finite symbolic library repeats motifs; no unique transit-based daily forecast is claimed.'};
fs.writeFileSync(new URL('../docs/ASTRA_2_3B_METRICS.json',import.meta.url),JSON.stringify(metrics,null,2)+'\n');
let samples='# Astra 2.3B: реальные образцы для редакционного ревью\n\nСгенерированы тем же чистым движком, который встроен в Worker, без ручной подмены и онлайн-LLM. Это массовая символическая интерпретация, не рассчитанные транзиты. Все даты — Europe/Moscow.\n\n';
for(const s of catalog.signs){const f=generate(s.sign_id,'2026-11-07');samples+=`## ${s.label} · 2026-11-07\n\n${f.free_text}\n\n*${f.words} русских слов; тема ${f.trace.theme}; ${f.engine_version}; ${f.content_version}.*\n\n`;}
samples+='## Четыре последовательные даты: Дева\n\n';
for(const date of ['2026-11-07','2026-11-08','2026-11-09','2026-11-10']){const f=generate('virgo',date);samples+=`### ${date}\n\n${f.free_text}\n\n*${f.words} русских слов; тема ${f.trace.theme}.*\n\n`;}
for(const [sign,date] of [['scorpio','2026-11-07'],['libra','2026-11-08']]){const f=generate(sign,date);samples+=`## Расширенный пример: ${sign} · ${date}\n\n${f.extended_text}\n\n*Связан с темой ${f.trace.theme}; то же бесплатное число ${f.number}. Символ ${f.trace.symbol}, руна ${f.trace.rune}, совет ${f.trace.advice}. Ни один выбранный бесплатный блок не включён повторно в расширенный текст.*\n\n`;}
samples+='## Границы автоматической и ручной оценки\n\nДлина, обязательные разделы, стабильность, совместимость независимых директив и число дня проверены по 21 912 сочетаниям. Дополнительно сравниваются отдельные абзацы 12 знаков на каждой дате, соседние дни и скользящие окна 30/90 дней; лексическая близость — на отдельной 90-дневной выборке. Возвращение исходного фрагмента и архетипического ракурса учитывается отдельно от совпадения всего сообщения. Содержательная связность и тон требуют редакционного чтения: особенно перехода от общей доминанты к профилю знака, уместности афоризма и реальной ценности расширения. Метрики повторов без даты опубликованы отдельно; повторение смысловых единиц в ограниченном каталоге не скрывается. Эти образцы не являются независимым одобрением владельца.\n';
fs.writeFileSync(new URL('../docs/ASTRA_2_3B_EDITORIAL_SAMPLES.md',import.meta.url),samples);
console.log(JSON.stringify({cases:current.cases,words:[current.min_russian_words,current.max_russian_words],paragraphs:current.paragraphs,local:metrics.local_node_diagnostic}));
