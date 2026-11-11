// Structural versioned reader: deliberately no current catalog/engine import.
import {validateSnapshot as validateV1} from './reader-v1.mjs';
export function validateSnapshot(s){
 if(s?.engine_version==='tarot25-v1')return validateV1(s);
 if(s?.engine_version!=='tarot25-v2'||s.snapshot_version!=='tarot25-snapshot-v2'||s.text_version!=='rws78-interpretation-v2')throw Error('UNSUPPORTED_SNAPSHOT');
 // V2 preserves the immutable V1 positions/cards/provenance structure, with a new renderer.
 validateV1({...s,engine_version:'tarot25-v1',snapshot_version:'tarot25-snapshot-v1'});
 if(s.question!==null&&(!s.question_proof||s.question_proof.policy_version!=='tarot-question-consent-v1'||!Number.isSafeInteger(s.question_proof.consented_at)||!Number.isSafeInteger(s.question_proof.consent_update)||s.question_proof.consent_update<0||!Number.isSafeInteger(s.question_proof.consent_message)||s.question_proof.consent_message<=0))throw Error('INVALID_QUESTION_PROOF');
 for(const p of s.interpretation.positions)if(!p.sources||p.sources.meaning!==(p.reversed?'reversed':'upright')||!['present','obstacle','resource','advice','self','environment','past','tendency','outcome'].includes(p.sources.role)||!/^contexts\.(relations|work|resources|choice|self)$/.test(p.sources.context))throw Error('INVALID_V2_PROVENANCE');
 return true;
}
export function serializeSnapshot(s){validateSnapshot(s);const j=JSON.stringify(s);if(j.length>300000)throw Error('SNAPSHOT_TOO_LARGE');return j;}
export function parseSnapshot(j){if(typeof j!=='string'||j.length>300000)throw Error('INVALID_SNAPSHOT');const s=JSON.parse(j);validateSnapshot(s);return s;}
export function renderSnapshot(s){validateSnapshot(s);return s.text;}
