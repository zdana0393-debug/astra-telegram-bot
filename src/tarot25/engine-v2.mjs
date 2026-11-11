// Versioned interpretation; draws remain question-independent. No generator is used by readers.
import {createReading,drawCards} from './engine.mjs';
import {getCard} from './catalog.mjs';
import {getSpread} from './spreads.mjs';
export const TEXT_VERSION='rws78-interpretation-v2';
export const ENGINE_VERSION='tarot25-v2';
export const SNAPSHOT_VERSION='tarot25-snapshot-v2';
const topics={relations:'отношения',work:'работа и карьера',resources:'финансы и ресурсы',choice:'выбор и жизненная ситуация',general:'общий вопрос и самонаблюдение',self:'самонаблюдение'};
const FOCUS={
 resources:[['debt',/долг|кредит|займ/iu,'обязательства и предел допустимой нагрузки'],['income',/доход|заработ|оплат|цен[ау]|прибыл/iu,'ценность труда и устойчивость дохода'],['spend',/покуп|трат|расход|бюджет/iu,'потребности, расходы и сохранение запаса']],
 relations:[['repair',/ссор|конфликт|помир|восстанов|после спора/iu,'восстановление контакта без отказа от границ'],['new',/знаком|нов[а-я]* связ|начать|сблиз/iu,'сближение и право обоих выбирать темп'],['boundary',/границ|дистанц|отказ|свобод/iu,'близость, отдельность и добровольное согласие']],
 work:[['change',/смен|нов[а-я]* работ|переход|уволь/iu,'переход между профессиональными ролями'],['skill',/уч[её]б|навык|обуч|мастер/iu,'рост мастерства и пределы ученичества']],
 choice:[['move',/переез|город|переход/iu,'смена опоры и обратимость перехода'],['values',/выбор|выбрать|решени|остать/iu,'соотношение ценностей и цены решения']]
};
export function questionFocus(theme,question){const found=(FOCUS[theme]??[]).find(x=>x[1].test(question??''));return {id:found?.[0]??'context',label:found?.[2]??topics[theme]};}
// Production entropy comes from 256 private random bits stored once per intention.
// HMAC counter expansion is deterministic after a crash and does not use a non-crypto test RNG.
export async function rngFromSeed(seed){
 if(typeof seed!=='string'||!/^[a-f0-9]{64}$/.test(seed))throw Error('INVALID_PRIVATE_SEED');
 const bytes=Uint8Array.from(seed.match(/../g),x=>parseInt(x,16));
 const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const blocks=[];for(let i=0;i<8;i++)blocks.push(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('astra:tarot:draw:v2:'+i))));
 const pool=blocks.flatMap(b=>Array.from({length:8},(_,i)=>new DataView(b.buffer,b.byteOffset).getUint32(i*4,false)));let index=0;
 return()=>{if(index>=pool.length)throw Error('DRAW_ENTROPY_EXHAUSTED');return pool[index++];};
}
export function createReadingV2(options){
 const old=createReading(options),spread=getSpread(old.spread_id),focus=questionFocus(old.theme,old.question);
 const positions=old.cards.map((d,i)=>{
  const c=getCard(d.card_id),p=spread.positions[i],mode=d.reversed?'reversed':'upright';
  const role={present:`В центре вопроса — ${c.keywords.join(', ')}.`,obstacle:`Как препятствие карта выделяет риск: ${c.shadow}. Это условие для проверки, а не обвинение.`,resource:`Ресурс этой позиции — ${c.light}; в ${d.reversed?'перевёрнутом':'прямом'} положении он ${d.reversed?'требует восстановления, а не считается уже доступным':'нуждается в сознательном участии'}.`,advice:c.advice[mode],self:`Здесь речь о вашем способе участия. Опора: ${c.light}. Теневой полюс: ${c.shadow}.`,environment:`Это гипотеза о динамике связи со средой: ${c.keywords.join(', ')}. Чужие намерения остаются неизвестными.`,past:`Это взгляд на уже сложившийся способ: ${c.keywords.join(', ')}. Карта не устанавливает факты биографии.`,tendency:`Если нынешний способ сохраняется, стоит наблюдать за темой «${c.keywords[0]}». Возможность изменить участие остаётся.`,outcome:`Перспектива зависит от того, удастся ли отличить «${c.light}» от «${c.shadow}». Это не обещание исхода.`}[p.role];
  const context=c.contexts[old.theme==='general'?'self':old.theme];
  return {position_id:d.position_id,card_id:d.card_id,reversed:d.reversed,title:p.name,question:p.prompt,text:[c[mode],role,context].join(' '),sources:{meaning:mode,role:p.role,context:'contexts.'+(old.theme==='general'?'self':old.theme)}};
 });
 const adviceIndex=spread.positions.findIndex(p=>p.role==='advice'),ai=adviceIndex<0?Math.max(0,spread.positions.findIndex(p=>p.id==='self')):adviceIndex,anchor=old.cards[ai],ac=getCard(anchor.card_id),first=getCard(old.cards[0].card_id);
 const focusText=`Ракурс вопроса: ${focus.label}. В начале чтения «${first.name_ru}» выделяет мотивы: ${first.keywords.join(', ')}. В позиции «${spread.positions[ai].name}» «${ac.name_ru}» связывает вопрос с конкретным условием: ${ac.contexts[old.theme==='general'?'self':old.theme]} Практический ориентир: ${ac.advice[anchor.reversed?'reversed':'upright']}`;
 const links=old.interpretation.links;
 const unique=new Map();for(const l of links){if(!unique.has(l.rule_id))unique.set(l.rule_id,l);}
 const rendered=[...unique.values()].slice(0,3).map(l=>l.binding_text+' '+l.rule_text).join('\n\n');
 const interpretation={...old.interpretation,advice:[{card_id:anchor.card_id,position_id:anchor.position_id,orientation:anchor.reversed?'reversed':'upright',source:'advice.'+(anchor.reversed?'reversed':'upright'),text:ac.advice[anchor.reversed?'reversed':'upright']}],positions,focus,summary:focusText,text:[`${spread.name} · ${topics[old.theme]}`,'Символическое чтение RWS; карта не устанавливает факты и не решает за вас.',...positions.map((p,i)=>`${i+1}. ${p.title}\n${getCard(p.card_id).name_ru} · ${p.reversed?'перевёрнутая':'прямая'}\n${p.text}`),'Связи и противоречия\n'+rendered,old.interpretation.dominant_text,'Вывод по вопросу\n'+focusText].join('\n\n')};
 return {...old,engine_version:ENGINE_VERSION,snapshot_version:SNAPSHOT_VERSION,text_version:TEXT_VERSION,interpretation,text:(old.question===null?'':'Вопрос: '+old.question+'\n\n')+interpretation.text};
}
export async function readingFromIntent(intent){const rng=await rngFromSeed(intent.seed);return createReadingV2({spread_id:intent.spread_id,theme:intent.theme,question:intent.question??undefined,question_consent:intent.question!==null,created_at:new Date(intent.created_at*1000).toISOString(),draw:drawCards(intent.spread_id,{rng})});}
