// Frozen structural reader v1. No import of current catalog, spreads or generator.
import CONTRACT from '../../data/tarot25-reader-v1.json' with {type:'json'};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};freeze(CONTRACT);
const {snapshot_version:SNAPSHOT_VERSION,deck_version:DECK_VERSION,engine_version:ENGINE_VERSION,spread_version:SPREAD_VERSION}=CONTRACT;
const MAX_TEXT=60000,MAX_QUESTION=500,THEMES=['general','relations','work','choice','resources','self'];
const requireThat=(value,message)=>{if(!value)throw new TypeError(message);};
const orientation=d=>d.reversed?'reversed':'upright';
function unicodeOK(s){return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s);}
function textOK(s,max){return typeof s==='string'&&s.length>0&&s.length<=max&&unicodeOK(s)&&!/[\x00-\x08\x0B-\x1F\x7F\u202A-\u202E\u2066-\u2069]/u.test(s);}

const ids=new Set(CONTRACT.card_ids);
function validateDrawV1(cards,id){
 const spread=CONTRACT.spreads[id];requireThat(spread&&Array.isArray(cards)&&cards.length===spread.positions.length,'Invalid v1 spread');
 const seen=new Set();cards.forEach((d,i)=>{requireThat(d&&ids.has(d.card_id)&&!seen.has(d.card_id)&&typeof d.reversed==='boolean'&&d.position_id===spread.positions[i],'Invalid v1 card/position');seen.add(d.card_id);});
}
export function validateSnapshot(snapshot){
 const s=snapshot;requireThat(s&&typeof s==='object'&&!Array.isArray(s),'Invalid snapshot');
 requireThat(s.snapshot_version===SNAPSHOT_VERSION&&s.deck_version===DECK_VERSION&&s.engine_version===ENGINE_VERSION&&s.spread_version===SPREAD_VERSION,'Unsupported immutable snapshot version');
 validateDrawV1(s.cards,s.spread_id);requireThat(THEMES.includes(s.theme),'Invalid snapshot theme');const spread=CONTRACT.spreads[s.spread_id];requireThat(spread.theme==='general'||s.theme===spread.theme,'Invalid snapshot spread theme');
 requireThat(textOK(s.text,MAX_TEXT),'Invalid snapshot text');
 requireThat(typeof s.created_at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.created_at)&&new Date(s.created_at).toISOString()===s.created_at,'Invalid snapshot date');
 requireThat((s.question===null&&s.question_consent===false)||(s.question_consent===true&&textOK(s.question,MAX_QUESTION)&&s.question.trim().length>0&&!/[\r\n\t]/.test(s.question)),'Invalid snapshot question');
 requireThat(s.interpretation&&textOK(s.interpretation.text,MAX_TEXT)&&s.text===(s.question===null?'':'Вопрос: '+s.question+'\n\n')+s.interpretation.text,'Snapshot text mismatch');
 requireThat(Array.isArray(s.interpretation.positions)&&s.interpretation.positions.length===s.cards.length,'Invalid snapshot positions');
 s.cards.forEach((d,i)=>{const p=s.interpretation.positions[i];requireThat(p.card_id===d.card_id&&p.position_id===d.position_id&&p.reversed===d.reversed&&textOK(p.text,5000),'Snapshot position mismatch');});
 const selected=new Map(s.cards.map(d=>[d.position_id,d]));
 requireThat(s.interpretation.theme===s.theme,'Snapshot interpretation theme mismatch');
 requireThat(Array.isArray(s.interpretation.links)&&s.interpretation.links.length===s.cards.length-1,'Invalid snapshot links');
 for(const link of s.interpretation.links){requireThat(Array.isArray(link.position_ids)&&Array.isArray(link.card_ids)&&link.position_ids.length===2&&link.card_ids.length===2&&link.position_ids[0]!==link.position_ids[1]&&textOK(link.text,5000),'Invalid snapshot link');link.position_ids.forEach((id,i)=>requireThat(selected.get(id)?.card_id===link.card_ids[i],'Forged link source'));}
 requireThat(Array.isArray(s.interpretation.advice)&&s.interpretation.advice.length>=1&&s.interpretation.advice.length<=2,'Invalid snapshot advice');
 for(const a of s.interpretation.advice){const d=selected.get(a.position_id);requireThat(d&&d.card_id===a.card_id&&orientation(d)===a.orientation&&a.source==='advice.'+a.orientation&&textOK(a.text,2000),'Forged advice source');}
 return true;
}
export function serializeSnapshot(s){validateSnapshot(s);const json=JSON.stringify(s);requireThat(json.length<=300000,'Snapshot too large');return json;}
export function parseSnapshot(json){requireThat(typeof json==='string'&&json.length<=300000,'Invalid serialized snapshot');const s=JSON.parse(json);validateSnapshot(s);return s;}
export function renderSnapshot(s){validateSnapshot(s);return s.text;}
