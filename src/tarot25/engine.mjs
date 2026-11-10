import {validateSnapshot as readV1,serializeSnapshot as serializeV1,parseSnapshot as parseV1,renderSnapshot as renderV1} from './reader-v1.mjs';
import {findCombination} from './combinations.mjs';
import {CARDS,DECK_VERSION,getCard} from './catalog.mjs';
import {getSpread,SPREAD_VERSION,THEMES} from './spreads.mjs';
export const ENGINE_VERSION='tarot25-v1';
export const SNAPSHOT_VERSION='tarot25-snapshot-v1';
export const MAX_TEXT=60000,MAX_QUESTION=500;
const UINT32=0x100000000;
const ROMAN=['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
const RANKS={ace:'Туз',page:'Паж',knight:'Рыцарь',queen:'Королева',king:'Король'};
const SUITS={wands:'Жезлы',cups:'Кубки',swords:'Мечи',pentacles:'Пентакли'};
const NAMES={general:'Общий вопрос',relations:'Отношения',work:'Дела и обучение',choice:'Выбор',resources:'Ресурсы',self:'Самонаблюдение'};
const MOVEMENTS=new Set(['act','pause','release','discern','connect','explore','restore','build','bind']);
const requireThat=(value,message)=>{if(!value)throw new TypeError(message);};
function unicodeOK(s){return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s);}
function textOK(s,max){return typeof s==='string'&&s.length>0&&s.length<=max&&unicodeOK(s)&&!/[\x00-\x08\x0B-\x1F\x7F\u202A-\u202E\u2066-\u2069]/u.test(s);}
export function cryptoUint32(){return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];}
// Test/review only. SFC32 is reproducible, NOT a substitute for production Web Crypto.
export function seededRng(seed){
 requireThat(typeof seed==='string'&&seed.length>0&&seed.length<=1024,'Invalid test seed');
 let a=0x9e3779b9,b=0x243f6a88,c=0xb7e15162,d=0xdeadbeef;
 for(const x of new TextEncoder().encode(seed)){a=Math.imul(a^x,2654435761)>>>0;b=Math.imul(b+x,1597334677)>>>0;c^=a;d^=b;}
 return()=>{a>>>=0;b>>>=0;c>>>=0;d>>>=0;const t=((a+b)|0)+d|0;d=d+1|0;a=b^(b>>>9);b=c+(c<<3)|0;c=(c<<21)|(c>>>11);c=c+t|0;return t>>>0;};
}
export function uniformIndex(bound,rng=cryptoUint32){
 requireThat(Number.isSafeInteger(bound)&&bound>0&&bound<=UINT32,'Invalid RNG bound');
 const limit=UINT32-UINT32%bound;
 for(let attempt=0;attempt<1024;attempt++){
  const n=rng();requireThat(Number.isInteger(n)&&n>=0&&n<UINT32,'RNG must return uint32');
  if(n<limit)return n%bound;
 }
 throw new Error('RNG rejection limit reached');
}
export function drawCards(spreadId,{rng=cryptoUint32}={}){
 const spread=getSpread(spreadId);requireThat(spread,'Unknown spread');requireThat(typeof rng==='function','Invalid RNG');
 const pool=CARDS.map(c=>c.id),ids=[];
 // Partial Fisher–Yates; orientation consumes its own independent sample AFTER card selection.
 for(let i=0;i<spread.size;i++){const j=i+uniformIndex(pool.length-i,rng);[pool[i],pool[j]]=[pool[j],pool[i]];ids.push(pool[i]);}
 return ids.map((card_id,i)=>({card_id,reversed:uniformIndex(2,rng)===1,position_id:spread.positions[i].id}));
}
export function validateDraw(draw,spreadId){
 const spread=getSpread(spreadId);requireThat(spread,'Unknown spread');requireThat(Array.isArray(draw)&&draw.length===spread.size,'Wrong draw size');
 const seen=new Set();for(let i=0;i<draw.length;i++){
  const d=draw[i];requireThat(d&&typeof d==='object'&&getCard(d.card_id),'Unknown card');requireThat(!seen.has(d.card_id),'Repeated card');seen.add(d.card_id);
  requireThat(typeof d.reversed==='boolean','Invalid orientation');requireThat(d.position_id===spread.positions[i].id,'Invalid position order');
 }
 return true;
}
export function validateCatalog(){
 requireThat(CARDS.length===78&&new Set(CARDS.map(c=>c.id)).size===78,'Invalid deck');
 const values=new Set();for(const c of CARDS){
  requireThat(c.deck_version===DECK_VERSION&&c.rws_order>=0,'Invalid card version');
  for(const key of ['upright','reversed','light','shadow']){requireThat(textOK(c[key],3000),'Invalid card text');requireThat(!values.has(c[key]),'Duplicated editorial block');values.add(c[key]);}
  for(const mode of ['upright','reversed']){requireThat(textOK(c.advice[mode],1000),'Invalid advice');requireThat(MOVEMENTS.has(c.movement[mode]),'Invalid movement');}
  for(const theme of THEMES.filter(t=>t!=='general'))requireThat(textOK(c.contexts[theme],1000),'Invalid context');
 }
 return true;
}
const orientation=d=>d.reversed?'reversed':'upright';
const label=d=>getCard(d.card_id).name_ru+(d.reversed?' (перевёрнутая)':' (прямая)');
function positionText(d,p,theme){
 const c=getCard(d.card_id),mode=orientation(d),context=theme==='general'?null:c.contexts[theme];
 const lens={present:null,obstacle:`В этой позиции проверьте теневой полюс: ${c.shadow}.`,resource:`Возможная опора здесь — ${c.light}. Её доступность стоит соотнести с описанным состоянием карты.`,advice:c.advice[mode],self:null,environment:null,past:null,tendency:null,outcome:null}[p.role];
 return [c[mode],context,lens].filter(Boolean).join(' ');
}
const PAIR_RULES=[
 {id:'pace',matches:(a,b)=>[a,b].some(x=>x==='act')&&[a,b].some(x=>['pause','restore'].includes(x)),text:'Напор и восстановление здесь нельзя требовать одновременно: сначала определите достаточную опору, затем меру действия.'},
 {id:'attachment-release',matches:(a,b)=>[a,b].some(x=>['connect','bind'].includes(x))&&[a,b].includes('release'),text:'Связь и отпускание образуют разные задачи: можно сохранить ценное, перестав удерживать исчерпанную форму.'},
 {id:'possibility-form',matches:(a,b)=>[a,b].includes('explore')&&[a,b].includes('build'),text:'Открытость нуждается в форме, а форма — в возможности измениться. Небольшая проверка связывает эти требования без преждевременного окончательного выбора.'},
 {id:'discern-contact',matches:(a,b)=>[a,b].includes('discern')&&[a,b].includes('connect'),text:'Точность и близость не исключают друг друга: проясняйте условие так, чтобы ответ другого оставался свободным.'},
 {id:'pause-release',matches:(a,b)=>[a,b].includes('pause')&&[a,b].includes('release'),text:'Остановка позволяет различить, что действительно завершено, а что лишь временно требует покоя. Эти решения не стоит подменять друг другом.'},
 {id:'same-movement',matches:(a,b)=>a===b,text:'Сходство направлений усиливает одну линию чтения, но не делает её универсальным ответом: проверьте разницу между описанием трудности и доступным действием.'},
 {id:'complement',matches:()=>true,text:'Одна карта задаёт условие, другая проверяет способ участия. Их не нужно сводить к одинаковому выводу: различие показывает, какую часть вопроса ещё предстоит согласовать.'}
];
function pairLink(draw,spread,a,b){
 const x=draw[a],y=draw[b],ca=getCard(x.card_id),cb=getCard(y.card_id),specific=findCombination(x,y);
 const rule=specific??PAIR_RULES.find(r=>r.matches(ca.movement[orientation(x)],cb.movement[orientation(y)]));
 const binding=`${spread.positions[a].name} / ${spread.positions[b].name}: ${label(x)} и ${label(y)}.`+
  (specific?'':` Здесь встречаются «${ca.keywords[0]}» и «${cb.keywords[0]}»; проверьте, как «${ca.light}» соотносится с риском «${cb.shadow}».`);
 return {rule_id:rule.id,specific:Boolean(specific),position_ids:[x.position_id,y.position_id],card_ids:[x.card_id,y.card_id],movements:[ca.movement[orientation(x)],cb.movement[orientation(y)]],rule_text:rule.text,binding_text:binding,text:binding+' '+rule.text};
}
function synthesis(draw,spread,theme){
 // Deterministic maximum spanning tree: every selected position participates.
 // Named interactions outrank movement rules; role tensions then resolve ties.
 const edges=[];for(let a=0;a<draw.length;a++)for(let b=a+1;b<draw.length;b++){
  const link=pairLink(draw,spread,a,b),roles=[spread.positions[a].role,spread.positions[b].role];
  const weight=(link.specific?100:link.rule_id==='complement'?0:10)+(roles.includes('obstacle')&&(roles.includes('advice')||roles.includes('resource'))?3:0)+(b===a+1?1:0);
  edges.push({a,b,link,weight});
 }
 edges.sort((a,b)=>b.weight-a.weight||a.a-b.a||a.b-b.b);
 const parent=draw.map((_,i)=>i),root=i=>{while(parent[i]!==i)i=parent[i];return i;},links=[];
 for(const edge of edges){const a=root(edge.a),b=root(edge.b);if(a!==b){parent[a]=b;links.push(edge.link);}if(links.length===draw.length-1)break;}
 const counts=Object.fromEntries(['major',...Object.keys(SUITS)].map(k=>[k,0]));for(const d of draw){const c=getCard(d.card_id);counts[c.suit??'major']++;}
 const dominant=Object.entries(counts).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
 const leaders=dominant.filter(([,n])=>n===dominant[0][1]).map(([k])=>k);
 const lenses={major:'Старшие арканы выделяют смысловые рамки и переходы; они не отменяют практических условий.',wands:'Жезлы ставят вопрос о желании, инициативе и цене поддержания огня.',cups:'Кубки связывают вопрос с качеством отклика, близости и эмоциональных границ.',swords:'Мечи требуют различать факт, объяснение и способ обращения со своей правотой.',pentacles:'Пентакли возвращают чтение к средствам, телесным пределам, навыку и устойчивости.'};
 const obstacle=spread.positions.findIndex(p=>p.role==='obstacle'),advice=spread.positions.findIndex(p=>p.role==='advice');
 const focus=advice>=0?advice:draw.length-1,anchor=draw[focus],card=getCard(anchor.card_id);
 // Triple uses three distinct actual positions, with auditable source IDs and role order.
 const tripleIndices=[0,obstacle>0?obstacle:1,focus];if(new Set(tripleIndices).size<3)tripleIndices[2]=draw.length-1;
 const triple=tripleIndices.map(i=>draw[i]);
 const arc=tripleIndices.map(i=>`${spread.positions[i].name.toLowerCase()} — ${label(draw[i])}`).join('; ');
 const tripleText=`Линия трёх позиций: ${arc}. Начальная карта не предписывает исход; средняя выделяет условие, которое нельзя пропустить; последняя предлагает ракурс ответа. Поэтому «${getCard(triple[1].card_id).shadow}» следует проверить до попытки опереться на «${getCard(triple[2].card_id).light}».`;
 const adviceRows=[{card_id:anchor.card_id,position_id:anchor.position_id,orientation:orientation(anchor),source:'advice.'+orientation(anchor),text:card.advice[orientation(anchor)]}];
 const movementText={act:'решительное действие',pause:'осмысленная пауза',release:'освобождение от исчерпанного',discern:'уточнение различий',connect:'восстановление взаимного контакта',explore:'исследование возможности',restore:'бережное восстановление',build:'создание устойчивой формы',bind:'признание силы привязанности'};
 const first=draw[0],firstCard=getCard(first.card_id),firstMove=firstCard.movement[orientation(first)],lastMove=card.movement[orientation(anchor)];
 const closing=pairLink(draw,spread,0,focus);
 const summary=`В теме «${NAMES[theme]}» ${label(first)} задаёт исходную линию: ${movementText[firstMove]}. ${label(anchor)} в позиции «${spread.positions[focus].name}» ${firstMove===lastMove?'проверяет применимость той же линии':'переводит внимание к другой задаче'}: ${movementText[lastMove]}. ${closing.rule_text}`;

 return{links,triple:{rule_id:'position-triple',card_ids:triple.map(d=>d.card_id),position_ids:triple.map(d=>d.position_id),text:tripleText},distribution:counts,dominant:leaders,dominant_text:leaders.map(k=>lenses[k]).join(' '),summary,advice:adviceRows};
}
function renderLinks(links){
 const groups=new Map();for(const link of links){if(!groups.has(link.rule_id))groups.set(link.rule_id,[]);groups.get(link.rule_id).push(link);}
 // Repeat a rule's explanation once, not a synonym bank to disguise repetition.
 return [...groups.values()].map(group=>group[0].rule_text+'\n'+group.map(l=>l.binding_text).join('\n')).join('\n\n');
}
export function interpretDraw(draw,spreadId,{theme}={}){
 validateDraw(draw,spreadId);const spread=getSpread(spreadId);theme??=spread.theme;requireThat(THEMES.includes(theme),'Invalid theme');requireThat(spread.theme==='general'||spread.theme===theme,'Thematic spread mismatch');
 const positions=draw.map((d,i)=>({position_id:d.position_id,card_id:d.card_id,reversed:d.reversed,title:spread.positions[i].name,question:spread.positions[i].prompt,text:positionText(d,spread.positions[i],theme)}));
 const combined=synthesis(draw,spread,theme);
 const text=[`${spread.name} · ${NAMES[theme]}`,'Символическое чтение выбранных карт; не гарантия событий.',...positions.map((p,i)=>{const d=draw[i],c=getCard(d.card_id);return `${i+1}. ${p.title}\n${c.name_ru} · ${c.name_en}\n${c.arcana==='major'?'Старший аркан '+ROMAN[c.number]:'Младший аркан · '+SUITS[c.suit]+' · '+(RANKS[c.rank]??c.number)} · ${d.reversed?'перевёрнутое':'прямое'} положение\n${p.question}\n${p.text}`;}),'Связи карт\n'+renderLinks(combined.links),combined.triple.text,combined.dominant_text,'Общий синтез\n'+combined.summary,'Мягкие ориентиры\n'+combined.advice.map((a,i)=>`${i+1}. ${a.text}`).join('\n')].join('\n\n');
 requireThat(textOK(text,MAX_TEXT),'Reading text exceeds safe bounds');return {theme,positions,...combined,text};
}
export function createReading({spread_id,theme,question,question_consent=false,draw,rng=cryptoUint32,created_at=new Date().toISOString()}={}){
 if(question!==undefined){requireThat(question_consent===true,'Explicit question storage consent required');requireThat(textOK(question,MAX_QUESTION)&&question.trim().length>0&&!/[\r\n\t]/.test(question),'Invalid question');}
 requireThat(typeof created_at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(created_at)&&new Date(created_at).toISOString()===created_at,'Invalid UTC date');
 requireThat(draw!==null,'Invalid null draw');
 const selected=draw??drawCards(spread_id,{rng}),reading=interpretDraw(selected,spread_id,{theme});
 return{snapshot_version:SNAPSHOT_VERSION,deck_version:DECK_VERSION,engine_version:ENGINE_VERSION,spread_version:SPREAD_VERSION,spread_id,theme:reading.theme,created_at,question:question??null,question_consent:question!==undefined,cards:selected.map(d=>({card_id:d.card_id,reversed:d.reversed,position_id:d.position_id})),interpretation:reading,text:(question!==undefined?'Вопрос: '+question+'\n\n':'')+reading.text};
}
// Compatibility exports use the immutable structural v1 reader.
export const validateSnapshot=readV1,serializeSnapshot=serializeV1,parseSnapshot=parseV1,renderSnapshot=renderV1;
export {splitTelegram} from './text29.mjs';
