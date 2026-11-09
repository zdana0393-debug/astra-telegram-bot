import fs from 'node:fs';import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
export function patchTask05(source){
 const base=createHash('sha256').update(source).digest('hex'),changes=[];
 const swap=(from,to)=>{if(source.split(from).length!==2)throw Error('TASK05 anchor mismatch: '+from.slice(0,110));changes.push({from,to});source=source.replace(from,to);};
 swap("'ASTRA-2.4-task04'","'ASTRA-2.4-task05-rc'");
 for(const name of ['broadcast','runBroadcast03','broadcastSend03','health'])swap('async function '+name+'(','async function pre05_'+name+'(');
 swap("'Уведомления включены по вашему запросу. Полный прогноз с числом дня будет приходить с 09:00 до 11:00 по Москве. Выключить можно здесь или командой /stop.'","'Ваш выбор сохранён. Автоматическая рассылка пока отключена до завершения проверки согласия. Полный бесплатный прогноз можно открыть вручную. Отменить выбор — здесь или командой /stop.'");
 swap('"Утренние уведомления включены по вашему запросу. Полный прогноз с числом дня приходит с 09:00 до 11:00 по Москве. Выключить — /stop."','"Ваш выбор сохранён. Автоматическая рассылка пока отключена. Полный прогноз доступен вручную; отменить выбор — /stop."');
 swap("if(page==='notifications')return screen(env,id,'Утренний прогноз',", "if(page==='notifications')return screen(env,id,'Утренний прогноз','Автоматическая рассылка пока отключена. Полный прогноз доступен вручную.\\n\\n'+");
 const extra='\n// TASK05 release gates: approved manual-only candidate; broadcast remains STOP-SHIP.\n'+read('src/release05/gates.js')+'\n';
 const at=source.indexOf('const astraWorker = {');if(at<0)throw Error('TASK05 worker anchor');source=source.slice(0,at)+extra+source.slice(at);
 fs.writeFileSync(new URL('../data/task05-patch-proof.json',import.meta.url),JSON.stringify({base_worker_sha256:base,changes},null,2)+'\n');return source;
}
