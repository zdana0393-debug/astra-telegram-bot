import fs from 'node:fs';import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),plain=s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
export function patchTask06(source){
 const base=createHash('sha256').update(source).digest('hex'),changes=[];
 const swap=(from,to)=>{if(source.split(from).length!==2)throw Error('TASK06 anchor mismatch '+from.slice(0,100));changes.push({from,to});source=source.replace(from,to);};
 swap("'ASTRA-2.4-task05-rc'","'ASTRA-2.4-task06-rc'");
 for(const name of ['shellPage','incoming','health','broadcast'])swap('async function '+name+'(','async function pre28_'+name+'(');
 swap('const recognized=',"const recognized=/^consent28:(?:stop|(?:grant|cancel):[a-f0-9]{32})$/.test(page||'')||");
 swap("'\\n\\nПлатёжные записи, включая ID плательщика,", "'\\n\\nДля добровольной утренней подписки отдельно сохраняются версия условий, время подтверждения, номера подтверждающего обновления и сообщения, статус отзыва. Это персональные данные, не бонусные HMAC. Отзыв — /stop; при /delete доказательство и временное подтверждение удаляются вместе с профилем. Временная кнопка действует 15 минут.\\n\\nПлатёжные записи, включая ID плательщика,");
 swap('return send(env,id,DELETE_NOTICE04,','return send(env,id,DELETE_NOTICE04+\' Доказательство утренней подписки и временные подтверждения удалены.\',');
 const extra='\n// TASK06 consent28; no automatic backfill, default delivery OFF.\nconst manifest28='+read('data/consent28-schema.json')+';\n'+['src/consent28/service.mjs','src/consent28/queue.mjs','src/consent28/ui.js'].map(p=>plain(read(p))).join('\n')+'\n';
 const at=source.indexOf('const astraWorker = {');source=source.slice(0,at)+extra+source.slice(at);
 fs.writeFileSync(new URL('../data/task06-patch-proof.json',import.meta.url),JSON.stringify({base_worker_sha256:base,changes},null,2)+'\n');return source;
}
