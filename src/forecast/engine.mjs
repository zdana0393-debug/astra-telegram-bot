// Pure interpretation and presentation. The bundled Worker injects the same catalog.
export const ENGINE_VERSION='forecast-1.0.0';
export const NUMBER_VERSION='legacy-hash-v1';
export const SECTIONS=['theme','relations','work','finance','mood','action'];
export function legacyHash(s) {
  let h=2166136261;
  for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
export function validDay(day) {
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const date=new Date(day+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;
}
export const russianWords=text=>(text.match(/[А-ЯЁа-яё]+(?:[-‑][А-ЯЁа-яё]+)*/gu)||[]).length;
function random(seed){let state=legacyHash(seed);return()=>{state|=0;state=state+0x6D2B79F5|0;let t=Math.imul(state^state>>>15,1|state);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const choose=(rows,rng)=>rows[Math.floor(rng()*rows.length)];
export function validateCatalog(c) {
  if(!c||!c.content_version||c.signs?.length!==12||c.themes?.length!==8||c.numbers?.length!==9||c.runes?.length!==24||c.symbols?.length<12||c.advice?.length<24||c.modalities?.length!==3)throw Error('Incomplete forecast catalog');
  const ids=new Set();
  for(const u of [...c.units,...c.themes,...c.signs,...c.numbers,...c.runes,...c.symbols,...c.advice,...c.modalities]){
    if(!u.id||ids.has(u.id)||!u.body?.trim()||u.version!==c.content_version||!u.section||!u.theme||!u.element||!u.modality||!u.tone||!Array.isArray(u.conditions)||!Array.isArray(u.incompatible_with))throw Error('Invalid forecast unit');ids.add(u.id);
  }
  if(new Set(c.signs.map(s=>s.sign_id)).size!==12||new Set(c.themes.map(s=>s.id)).size!==8||new Set(c.runes.map(r=>r.name)).size!==24||new Set(c.numbers.map(n=>n.value)).size!==9)throw Error('Duplicate reference identity');
  for(const s of c.signs)for(const key of ['relations','work','finance','mood'])if(!s.label||!s.profiles?.[key]||!s.ruler||!s.resource||!s.shadow||!c.element_labels[s.element_id]||!c.modalities.some(m=>m.modality_id===s.modality_id))throw Error('Incomplete sign profile');
  for(const t of c.themes){if(!t.extended||!t.question)throw Error('Missing expanded interpretation');for(const group of [c.runes,c.symbols,c.advice])if(!group.some(u=>u.allowed_themes?.includes(t.id)))throw Error('Missing compatible expanded reference');for(const section of SECTIONS)if(c.units.filter(u=>u.theme===t.id&&u.section===section).length<3)throw Error('Missing theme section');}
  for(const r of c.runes)if(!r.glyph||!r.name||!r.historical||!r.question)throw Error('Missing rune history');
  for(const symbol of c.symbols)if(!symbol.name||!symbol.color||!symbol.question||!symbol.tradition)throw Error('Incomplete symbol palette');
  for(const group of [c.runes,c.symbols,c.advice])for(const u of group)if(!Array.isArray(u.allowed_themes)||u.allowed_themes.length===0)throw Error('Missing reference compatibility');
  for(const n of c.numbers)if(!n.extended||!n.label||!Number.isInteger(n.value)||n.value<1||n.value>9)throw Error('Missing number interpretation');
  return c;
}
export function validateSelection(rows,sign,theme) {
  const tags=new Set(['symbolic-only','theme:'+theme.id,sign.element_id,sign.modality_id]);
  for(const u of rows){
    if(u.theme!==theme.id||!['*',sign.element_id].includes(u.element)||!['*',sign.modality_id].includes(u.modality)||!u.conditions.every(t=>tags.has(t))||u.incompatible_with.some(t=>tags.has(t)))throw Error('Incompatible forecast blocks');
    if(rows.some(other=>u.incompatible_with.includes(other.id)))throw Error('Conflicting interpretation');
  }
  if(new Set(rows.map(u=>u.section)).size!==6)throw Error('Incomplete interpretation');
}
export function createForecastGenerator(input,{engineVersion=ENGINE_VERSION}={}) {
  const c=validateCatalog(structuredClone(input));
  return function generateForecast(signId,day,locale='ru') {
    if(!validDay(day)||locale!=='ru')throw Error('Invalid forecast date or locale');
    const sign=c.signs.find(s=>s.sign_id===signId);if(!sign)throw Error('Unknown sign');
    const rng=random(`${signId}|${day}|${locale}|${engineVersion}`);
    // An editorial rotation avoids repeating a dominant theme within eight days.
    // This is a content schedule, never a claimed astronomical cycle.
    const ordinal=Math.floor(Date.parse(day+'T12:00:00Z')/86400000);
    const phase=legacyHash(`${signId}|${locale}|${engineVersion}`);
    const theme=c.themes[((ordinal+phase)%c.themes.length+c.themes.length)%c.themes.length];
    const selected=SECTIONS.map(section=>choose(c.units.filter(u=>u.theme===theme.id&&u.section===section&&['*',sign.element_id].includes(u.element)&&['*',sign.modality_id].includes(u.modality)),rng));
    if(selected.some(u=>!u))throw Error('No compatible interpretation');validateSelection(selected,sign,theme);
    const block=Object.fromEntries(selected.map(u=>[u.section,u.body]));
    const number=legacyHash(signId+day)%9+1,n=c.numbers.find(n=>n.value===number);
    const compatible=rows=>rows.filter(u=>u.allowed_themes.includes(theme.id)&&!u.incompatible_with.includes('theme:'+theme.id));
    const rune=choose(compatible(c.runes),rng),symbol=choose(compatible(c.symbols),rng),advice=choose(compatible(c.advice),rng),modality=c.modalities.find(m=>m.modality_id===sign.modality_id);
    const mode={cardinal:'кардинальная',fixed:'фиксированная',mutable:'мутабельная'}[sign.modality_id];
    const free_text=`Общий прогноз по выбранному знаку\n${sign.label} · ${day} · Europe/Moscow\nСимволическая основа: ${c.element_labels[sign.element_id]}, ${mode} модальность; традиционный управитель — ${sign.ruler}.\n\n`+
      `Тема · ${theme.label}\n${block.theme}\n\nОтношения и общение\n${block.relations} ${sign.profiles.relations}\n\n`+
      `Работа, учёба и дела\n${block.work} ${sign.profiles.work}\n\nФинансы и ресурсы\n${block.finance}\n\n`+
      `Эмоциональный ритм\n${block.mood}\n\n🔢 Число дня: ${number} · ${n.label}\n${n.body}\n\nПрактический итог\n${block.action}`;
    const extended_text=`Расширенный прогноз · ${day}\n${sign.label} · Europe/Moscow\n\nДоминанта · ${theme.label}\n${sign.body} ${theme.extended}\n${modality.body}\n\n`+
      `Дополнительный ракурс\n${sign.profiles.finance} ${sign.profiles.mood}\nРесурс: ${sign.resource}. Зона внимания: ${sign.shadow}. ${theme.question}\n\n`+
      `Символ и цвет дня\n${symbol.name} · ${symbol.color}. ${symbol.body} ${symbol.question}\nПалитра — авторское соответствие, не астрономический параметр.\n\n`+
      `Дополнение к числу ${number}\n${n.extended}\n\nРуна дня · ${rune.glyph} ${rune.name}\nИсторическое/реконструированное значение имени: ${rune.historical}.\nСовременная символическая трактовка: ${rune.body} ${rune.question}\n\n`+
      `Совет Жирного\n${advice.body}\n\nИтог\nВыберите один из предложенных вопросов и зафиксируйте наблюдение, по которому сможете проверить полезность выбранного решения.`;
    const words=russianWords(free_text);
    if(words<160||words>260||free_text.length>4096||extended_text.length>4096)throw Error(`Forecast length invalid: ${words}/${free_text.length}/${extended_text.length}`);
    return {sign:signId,day,locale,free_text,extended_text,number,engine_version:engineVersion,content_version:c.content_version,number_algorithm_version:NUMBER_VERSION,
      source_tags:JSON.stringify({inputs:['selected-sign','moscow-day','locale','engine-version'],symbolic:true,astronomical_inputs:false,theme:theme.id,element:sign.element_id,modality:sign.modality_id,ruler:sign.ruler,units:selected.map(u=>u.id),references:[sign.id,n.id,rune.id,symbol.id,advice.id,modality.id]}),trace:{theme:theme.id,units:selected.map(u=>u.id),rune:rune.id,symbol:symbol.id,advice:advice.id},words};
  };
}
