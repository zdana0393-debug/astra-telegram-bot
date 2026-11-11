// Exact one-line historical TEST fix; no production exception or subprocess.
import fs from 'node:fs';import assert from 'node:assert/strict';
const input=process.argv[2],file='tests/tarot25-ui.test.mjs';if(!/^\/tmp\/astra25-task05-frozen-[-A-Za-z0-9]+$/.test(input||'')||process.argv.length!==3)throw Error('Shell-fetched known historical test required');
const original=fs.readFileSync(input,'utf8'),old="if(mutation==='payload')q.callback_query.data=p.data.replace(/t25:p:./,'t25:p:f');",replacement="if(mutation==='payload'){q.callback_query.data=p.data.replace(/t25:p:(.)/,(_,c)=>'t25:p:'+(c==='f'?'e':'f'));assert.notEqual(q.callback_query.data,p.data);}";
assert.equal(original.split(old).length,2);assert.equal(fs.readFileSync(file,'utf8'),original.replace(old,replacement),'Only the guaranteed payload mutation test fix may differ');
