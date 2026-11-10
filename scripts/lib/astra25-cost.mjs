// Read-only policy preview. No retention is approved and there is NO DELETE path.
import {identifyStage25} from './astra25-upgrade.mjs';
import {stop25} from './astra25-upgrade-plan.mjs';
export function draftRetentionPreview25(db,{proposed_retention_days,as_of=Math.floor(Date.now()/1000),limit=20}={}){
 if(!Number.isInteger(proposed_retention_days)||proposed_retention_days<1||proposed_retention_days>3650||!Number.isSafeInteger(as_of)||!Number.isInteger(limit)||limit<1||limit>100)stop25('EXPLICIT_RETENTION_PROPOSAL_REQUIRED');
 if(identifyStage25(db)!==9)stop25('RETENTION_SCHEMA_NOT_READY');
 const rows=db.prepare(`SELECT length(CAST(o.snapshot_json AS BLOB))+length(CAST(o.result AS BLOB)) bytes,json_extract(o.snapshot_json,'$.question') IS NOT NULL question_present
 FROM astra_tarot25_offers29 o WHERE o.expires_at<=? AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 p WHERE p.offer_id=o.offer_id)
 ORDER BY o.expires_at,o.offer_id LIMIT ?`).all(as_of-proposed_retention_days*86400,limit);
 return {proposal_only:true,delete_permitted:false,approved_retention_days:null,proposed_retention_days,as_of,limit,candidates:rows.length,candidate_payload_bytes:rows.reduce((n,r)=>n+r.bytes,0),question_bearing_candidates:rows.filter(r=>r.question_present).length,purchases_excluded:true};
}
export function storageSnapshot25(db){
 const page_count=db.prepare('PRAGMA page_count').get().page_count,page_size=db.prepare('PRAGMA page_size').get().page_size;
 const offers=db.prepare('SELECT count(*) count,coalesce(sum(length(CAST(snapshot_json AS BLOB))+length(CAST(result AS BLOB))),0) payload_bytes FROM astra_tarot25_offers29').get(),paid=db.prepare('SELECT count(*) count,coalesce(sum(length(CAST(snapshot_json AS BLOB))+length(CAST(result AS BLOB))),0) payload_bytes FROM astra_tarot25_purchases29').get();
 return {sqlite_allocated_bytes:page_count*page_size,page_size,offers,paid,cloudflare_bytes_measured:false};
}
