import fs from 'node:fs';import manifest from '../data/tarot25-schema31.json' with{type:'json'};import {readOnlyStatements} from './lib/migrate-tarot29-local.mjs';import {chunks30,splitSQL30} from './lib/sql30-bounds.mjs';
import{fragments31,tuple31,violations31}from'./lib/sql31-schema.mjs';
const q=s=>"'"+s.replaceAll("'","''")+"'",tuple=o=>'('+[o.name,o.type,o.sql].map(q).join(',')+')';let schema='';
for(const [i,group]of chunks30(fragments31(manifest),tuple31,20000).entries())schema+=`SELECT 'schema31/${i}' check_name,${violations31(group)} violations;\n`;
const old=readOnlyStatements(fs.readFileSync('scripts/check_integrity_tarot25_29.sql','utf8')),sql=schema+old.slice(1).join(';\n')+';\n';if(splitSQL30(sql).some(s=>Buffer.byteLength(s)>50000))throw Error('AUDIT31_STATEMENT_BUDGET');fs.writeFileSync('scripts/check_integrity_tarot25_31.sql',sql);
