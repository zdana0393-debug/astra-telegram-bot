import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const plain=s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
export function patchTask02(source){
 const version="'ASTRA-2.4-task01'";if(source.split(version).length!==2)throw Error('TASK02 release version anchor mismatch');source=source.replace(version,"'ASTRA-2.4-task02'");
 const anchor="  const f=generate(sign,day,'ru');";
 if(source.split(anchor).length!==2)throw Error('TASK02 cache generation anchor mismatch');
 // Cache read, insert/RETURNING, uniqueness and atomic -4 purchase are byte-preserved.
 source=source.replace(anchor,"  const f=generate===generateForecast?generateForecastForEnv(env,sign,day,'ru'):generate(sign,day,'ru');");
 const extra='\n// TASK02: same symbolic selection, independently versioned editorial presentation.\nconst compactCatalog='+read('data/forecast/editorial.compact.v1.json').trim()+';\n'+['src/forecast/editorial/compact.mjs','src/forecast/editorial/configured.mjs'].map(p=>plain(read(p))).join('\n')+'\n';
 const marker='const astraWorker = {';if(source.split(marker).length!==2)throw Error('TASK02 integration anchor mismatch');return source.replace(marker,extra+marker);
}
