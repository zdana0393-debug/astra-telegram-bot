// Compare every Unicode codepoint of every exact DDL definition using bounded fragments.
export const quote31=s=>"'"+String(s).replaceAll("'","''")+"'";
export function fragments31(objects){return objects.flatMap(o=>{const chars=Array.from(o.sql.trim()),rows=[];for(let n=0;n<chars.length;n+=4000)rows.push({name:o.name,type:o.type,offset:n+1,total:chars.length,fragment:chars.slice(n,n+4000).join('')});return rows;});}
export const tuple31=r=>'('+[quote31(r.name),quote31(r.type),r.offset,r.total,quote31(r.fragment)].join(',')+')';
export const violations31=rows=>`(WITH expected(name,type,offset,total,fragment)AS(VALUES ${rows.map(tuple31).join(',')})SELECT count(*) FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name AND a.type=e.type AND length(trim(a.sql))=e.total AND substr(trim(a.sql),e.offset,length(e.fragment))=e.fragment WHERE a.name IS NULL)`;
