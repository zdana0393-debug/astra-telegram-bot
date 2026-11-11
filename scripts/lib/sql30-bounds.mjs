// Static SQL audit only; execution still uses the whole file in one transaction.
// Honors quoted literals/comments and BEGIN/CASE/END inside trigger bodies.
export function splitSQL30(sql){const out=[];let start=0,quote=null,line=false,block=false,trigger=false,depth=0,words=[];
 for(let i=0;i<sql.length;i++){const c=sql[i],n=sql[i+1];if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}if(quote){if(c===quote){if(n===quote&&quote!==']')i++;else quote=null;}continue;}
  if(c==='-'&&n==='-'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}if(c==="'"||c==='"'||c==='`'||c==='['){quote=c==='['?']':c;continue;}
  if(/[A-Za-z_]/.test(c)){let j=i+1;while(j<sql.length&&/[A-Za-z0-9_]/.test(sql[j]))j++;const w=sql.slice(i,j).toUpperCase();words.push(w);if(w==='TRIGGER'&&words[0]==='CREATE')trigger=true;if(trigger){if(w==='BEGIN'||w==='CASE')depth++;else if(w==='END')depth--;}i=j-1;continue;}
  if(c===';'&&(!trigger||depth===0)){const part=sql.slice(start,i+1).trim();if(part)out.push(part);start=i+1;trigger=false;depth=0;words=[];}
 }
 if(quote||block||depth!==0)throw Error('INCOMPLETE_SQL_FOR_BOUND_AUDIT');const rest=sql.slice(start).replace(/--[^\n]*/g,'').trim();if(rest)throw Error('UNTERMINATED_SQL_STATEMENT');return out;
}
export function chunks30(list,encode,budget=28000){const chunks=[];let current=[],bytes=0;for(const item of list){const n=Buffer.byteLength(encode(item));if(n>budget)throw Error('ONE_DDL_EXCEEDS_SAFE_SQL_BUDGET');if(current.length&&bytes+n>budget){chunks.push(current);current=[];bytes=0;}current.push(item);bytes+=n+1;}if(current.length)chunks.push(current);return chunks;}
