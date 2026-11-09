import {createForecastGenerator,validateSelection,legacyHash,validDay,russianWords,ENGINE_VERSION,NUMBER_VERSION,SECTIONS} from '../engine.mjs';
export const COMPACT_ENGINE_VERSION='forecast-1.0.0+compact.1';
export const COMPACT_PRESENTATION_VERSION='compact-1.0.1';
const sourceGroups=['units','sign_lenses','modality_lenses','themes','signs','numbers','runes','symbols','advice','modalities'];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const labels={theme:'✨ Главное',relations:'💕 Отношения',work:'📚 Дела',finance:'💰 Финансы',mood:'🌿 Настроение',action:'🍀 Совет дня'};
export const sourceFingerprint=row=>legacyHash(JSON.stringify(row)); // Integrity pin, not a cryptographic authentication claim.
function textReady(value){return typeof value==='string'&&value.trim()===value&&value.length>3&&!/[<>\r\n]/.test(value);}
function checkTextIntent(text,directives){
 // Deliberately bounded lexical checks supplement declared semantic directives, never pretend to understand all Russian.
 if(directives.timing==='observe'&&/(действуйте немедленно|решите сейчас|сделайте (?:это )?(?:немедленно|сейчас)|совершите покупку|не откладывайте)/iu.test(text))throw Error('Editorial timing contradiction');
 if(directives.contact==='quiet'&&/(начните разговор|потребуйте ответа|добейтесь ответа|позвоните|напишите (?:ему|ей|собеседнику))/iu.test(text))throw Error('Editorial contact contradiction');
 if(/(гарантированно|точность\s*\d+\s*%|\d+\s*%\s*точност|сегодня\s+(?:луна|меркурий|венера|марс|сатурн|юпитер)\s+(?:входит|образует|переходит)|сегодня\s+(?:полнолуние|новолуние))/iu.test(text))throw Error('Unsupported astronomical or guaranteed claim');
}
export function validateCompactCatalog(base,editorial){
 if(editorial.presentation_version!==COMPACT_PRESENTATION_VERSION||editorial.selection_engine_version!==ENGINE_VERSION||editorial.source_catalog_version!==base.content_version||editorial.content_version!=='2026.11-compact-v2')throw Error('Editorial version mismatch');
 const source=new Map(sourceGroups.flatMap(g=>base[g]).map(row=>[row.id,row]));
 const required=[...base.units,...base.sign_lenses,...base.modality_lenses,...base.numbers];
 if(Object.keys(editorial.entries).length!==required.length)throw Error('Incomplete compact source coverage');
 for(const row of required){const edit=editorial.entries[row.id];if(!edit||!textReady(edit.text)||edit.source_fingerprint!==sourceFingerprint(row)||edit.semantic_key!==(row.semantic_key||row.id)||!equal(edit.directives,row.directives||{}))throw Error('Compact source drift: '+row.id);const question=base.units.includes(row)&&row.section==='action';if(question&&(edit.kind!=='question'||!edit.text.endsWith('?')))throw Error('Missing thematic question');checkTextIntent(edit.text,edit.directives);}
 for(const [group,rows] of [['extended_themes',base.themes],['extended_profiles',base.signs],['extended_runes',base.runes]]){
  if(Object.keys(editorial[group]).length!==rows.length)throw Error('Incomplete expanded source coverage');
  for(const row of rows){const id=group==='extended_profiles'?row.sign_id:row.id,edit=editorial[group][id];if(!edit||edit.source!==row.id||edit.source_fingerprint!==sourceFingerprint(row)||!equal(edit.directives,{}))throw Error('Expanded source drift: '+row.id);
   if(group==='extended_profiles'&&!equal(edit.fields,['profiles.finance','profiles.mood']))throw Error('Unknown profile fields');
   for(const key of group==='extended_themes'?['fork','exercise']:['text'])if(!textReady(edit[key]))throw Error('Empty expanded reading: '+row.id);checkTextIntent(edit.text||edit.exercise,{});
  }
 }
 for(const [key,fusion] of Object.entries({...editorial.fusions,...editorial.action_compositions})){
  if(key!==fusion.sources.join('|')||fusion.sources.length!==2||!textReady(fusion.text)||!equal(fusion.source_fingerprints,fusion.sources.map(id=>sourceFingerprint(source.get(id)))))throw Error('Invalid editorial fusion');
  const [unit,lens]=fusion.sources.map(id=>source.get(id));if(!base.units.includes(unit)||!base.sign_lenses.includes(lens)||unit.section!==lens.section)throw Error('Invalid fused source roles');if(editorial.action_compositions?.[key]&&unit.section!=='action')throw Error('Advice composition requires action sources');checkTextIntent(fusion.text,lens.directives||{});
 }
 for(const row of base.modality_lenses.filter(row=>row.section==='action')){const edit=editorial.entries[row.id],text=edit.advice_qualifier;if(!Array.isArray(edit.advice_echo_with)||edit.advice_echo_with.some(id=>!source.has(id)||source.get(id).section!=='action'))throw Error('Invalid advice echo reference');if(!textReady(text))throw Error('Missing source-bound advice qualifier');checkTextIntent(text,row.directives||{});}
 return source;
}
export function validateEditorialDocument(document,source,sign,theme,context,selectedIds){
 if(!Array.isArray(selectedIds))throw Error('Selected source set required');
 if(!equal(document.sections.map(row=>row.section),SECTIONS))throw Error('Incomplete editorial sections');
 const used=[];for(const row of document.sections){if(!textReady(row.text)||row.sources.length<2)throw Error('Missing editorial meaning');for(const id of row.sources){const origin=source.get(id);if(!origin||origin.section!==row.section||!selectedIds.includes(id))throw Error('Unattributed editorial assertion');used.push(origin);}if(new Set(row.sources).size!==row.sources.length||row.sources.filter(id=>source.get(id).sign_id===sign.sign_id).length!==1||row.sources.filter(id=>source.get(id).theme===theme.id).length!==1)throw Error('Wrong editorial source roles');checkTextIntent(row.text,context);}
 validateSelection(used,sign,theme,context);
 if(new Set(document.sections.map(row=>row.text)).size!==6)throw Error('Duplicated editorial section');
 return document;
}
export function formatFreeForecast(document){
 if(!validDay(document.day)||!Number.isInteger(document.number)||document.number<1||document.number>9||!textReady(document.numberMeaning))throw Error('Invalid free forecast document');
 const [year,month,day]=document.day.split('-');
 const text=`🌙 ГОРОСКОП · ${day}.${month}.${year}\n${document.signLabel}\n\n`+document.sections.map(row=>`${labels[row.section]}: ${row.text}`).join('\n\n')+`\n\n🔢 Число дня: ${document.number} — ${document.numberMeaning}.\n\nСимволическая интерпретация солнечного знака.`;
 if(text.length>4096)throw Error('Compact Telegram length exceeded');return text;
}
const stems=text=>new Set((text.toLowerCase().match(/[а-яё]{4,}/gu)||[]).map(w=>w.slice(0,5)));
function distinctModifier(text,modifier){const a=stems(text),b=stems(modifier);return [...b].filter(x=>a.has(x)).length/Math.max(1,b.size)<.4;}
export function createCompactForecastGenerator(base,editorial,{generate=createForecastGenerator(base)}={}){
 const edits=structuredClone(editorial),source=validateCompactCatalog(base,edits);
 return function generateCompactForecast(signId,day,locale='ru'){
  // The same legacy generator consumes the same seed, ordinal and RNG calls, including expanded references.
  const legacy=generate(signId,day,locale),selection=JSON.parse(legacy.source_tags),sign=source.get('sign:'+signId),theme=source.get(legacy.trace.theme);
  if(legacy.engine_version!==ENGINE_VERSION||legacy.content_version!==edits.source_catalog_version||legacy.number_algorithm_version!==NUMBER_VERSION||legacy.number!==legacyHash(signId+day)%9+1)throw Error('Unexpected selection engine');
  const ids=[...legacy.trace.units,...legacy.trace.sign_lenses,...legacy.trace.modality_lenses];validateSelection(ids.map(id=>{const row=source.get(id);if(!row)throw Error('Unknown selected source');return row;}),sign,theme,legacy.trace.directives);
  const sections=SECTIONS.map((section,index)=>{
   const unit=source.get(legacy.trace.units[index]),lens=source.get(legacy.trace.sign_lenses[index]),modal=legacy.trace.modality_lenses.map(id=>source.get(id)).find(row=>row.section===section);
   const premise=edits.entries[unit.id],facet=edits.entries[lens.id],fusionKey=unit.id+'|'+lens.id,fusion=section==='action'?(edits.action_compositions?.[fusionKey]||edits.fusions?.[fusionKey]):edits.fusions?.[fusionKey];let text=fusion?fusion.text:premise.text+' '+facet.text;
   // A selected action modality qualifies the same decision, never adds another task. Curated/lexical echoes stay constraints.
   const duplicatedDirective=modal&&Object.keys(modal.directives||{}).some(axis=>lens.directives?.[axis]===modal.directives[axis]);
   const modifier=modal&&(section==='action'?edits.entries[modal.id].advice_qualifier:edits.entries[modal.id].text);
   const semanticEcho=Boolean(modal&&section==='action'&&edits.entries[modal.id].advice_echo_with.some(id=>id===unit.id||id===lens.id));
   const emit=Boolean(modal&&!semanticEcho&&(section==='action'||!duplicatedDirective)&&distinctModifier(text,modifier));if(emit)text=section==='action'?text.replace(/[.!?]$/,'')+'; '+modifier+'.':text+' '+modifier;
   return{section,text,fusion:fusion&&edits.fusions?.[fusionKey]?fusionKey:null,advice_composition:section==='action'&&edits.action_compositions?.[fusionKey]?fusionKey:null,sources:[unit.id,lens.id,...(emit?[modal.id]:[])],semantic_keys:[premise.semantic_key,facet.semantic_key,...(emit?[edits.entries[modal.id].semantic_key]:[])],modality:modal?{source:modal.id,role:emit?'emitted':'compatibility-constraint',reason:emit?(section==='action'?'source-bound-step-qualifier':'independent-meaning'):semanticEcho?'source-meaning-already-expressed':duplicatedDirective?'directive-already-expressed':'semantic-echo'}:null};
  });
  const document={signLabel:sign.label,day,number:legacy.number,numberMeaning:edits.entries['number:'+legacy.number].text,sections};validateEditorialDocument(document,source,sign,theme,legacy.trace.directives,ids);
  const free_text=formatFreeForecast(document),fork=edits.extended_themes[theme.id],profile=edits.extended_profiles[signId],rune=source.get(legacy.trace.rune),symbol=source.get(legacy.trace.symbol),advice=source.get(legacy.trace.advice),number=source.get('number:'+legacy.number);
  if(!rune.allowed_themes.includes(theme.id)||!symbol.allowed_themes.includes(theme.id)||!advice.allowed_themes.includes(theme.id))throw Error('Expanded source incompatibility');
  const extended_text=`🌒 РАСШИРЕННЫЙ ПРОГНОЗ · ${day.split('-').reverse().join('.')}\n${sign.label}\n\n`+
   `Развилка · ${theme.label}\n${fork.fork}\n\nКак применить\n${fork.exercise}\n\nВаш акцент\n${profile.text}\n\n`+
   `Символ и цвет\n${symbol.name} · ${symbol.color}. ${symbol.question}\nАвторская палитра для размышления, не небесное соответствие.\n\n`+
   `Руна · ${rune.glyph} ${rune.name}\nИсторическое/реконструированное значение имени: ${rune.historical}.\nСовременное символическое чтение: ${edits.extended_runes[rune.id].text}\n\n`+
   `Глубже о числе ${number.value}\n${number.extended}\n\nСовет Жирного\n${advice.body}`;
  if(extended_text.length>4096)throw Error('Expanded Telegram length exceeded');checkTextIntent(extended_text,legacy.trace.directives);
  const editorialTrace={presentation_version:edits.presentation_version,selection_engine_version:ENGINE_VERSION,source_catalog_version:base.content_version,sections:sections.map(({text,...meta})=>meta),number:{source:number.id},extended:{fork:{source:theme.id,fields:['extended','question']},application:{source:theme.id,fields:['extended','question']},profile:{source:profile.source,fields:profile.fields},symbol:{source:symbol.id,fields:['name','color','question','tradition']},rune:{source:rune.id,fields:['glyph','name','historical','body']},number:{source:number.id,fields:['extended']},advice:{source:advice.id,fields:['body']}}};
  return{...legacy,free_text,extended_text,words:russianWords(free_text),engine_version:COMPACT_ENGINE_VERSION,content_version:edits.content_version,source_tags:JSON.stringify({...selection,editorial:editorialTrace}),trace:{...legacy.trace,editorial:editorialTrace},document};
 };
}
