// Text-only delivery helper: no current deck or generator dependency.
const MAX_TEXT=60000;
const requireThat=(v,m)=>{if(!v)throw new TypeError(m);};
function unicodeOK(s){return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s);}
function textOK(s,max){return typeof s==='string'&&s.length>0&&s.length<=max&&unicodeOK(s)&&!/[\x00-\x08\x0B-\x1F\x7F\u202A-\u202E\u2066-\u2069]/u.test(s);}
export function splitTelegram(text,limit=4096){
 requireThat(textOK(text,MAX_TEXT),'Invalid delivery text');requireThat(Number.isInteger(limit)&&limit>=32&&limit<=4096,'Invalid Telegram limit');
 const segments=Array.from(new Intl.Segmenter('ru',{granularity:'grapheme'}).segment(text),x=>x.segment),chunks=[];
 let from=0;while(from<segments.length){
  let length=0,to=from,newline=-1,space=-1;
  while(to<segments.length&&length+segments[to].length<=limit){
   const part=segments[to];length+=part.length;to++;
   if(length>=limit/2){if(part.endsWith('\n'))newline=to;if(/\s$/u.test(part))space=to;}
  }
  requireThat(to>from,'Grapheme exceeds delivery limit');
  const cut=to===segments.length?to:newline>from?newline:space>from?space:to;
  chunks.push(segments.slice(from,cut).join(''));from=cut;
 }
 return chunks;
}
