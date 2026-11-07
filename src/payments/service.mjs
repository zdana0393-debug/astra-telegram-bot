import {decodeHistoryCursor,encodeHistoryCursor} from '../economy/history.mjs';
import {STAR_PACKAGES,paymentScope,paymentEnvironment,starsApi,chargeHash} from './transport.mjs';
export const readPaymentOrder=(env,payload)=>env.DB.prepare('SELECT * FROM astra_payment_orders WHERE payload=?').bind(payload).first();
export async function createStarOrder(env,owner,pack,requestKey,termsVersion){
  const p=await paymentEnvironment(env,{shop:true,probe:true}),price=STAR_PACKAGES[pack];
  if(!price||termsVersion!==p.terms_version||!Number.isSafeInteger(owner)||owner<=0||typeof requestKey!=='string'||requestKey.length>100)throw Error('Invalid purchase consent');
  const order=crypto.randomUUID(),payload='a24:'+order;
  await env.DB.prepare(`INSERT INTO astra_payment_orders(order_id,payload,owner_id,payer_id,request_key,package,xtr,dust,price_version,scope,terms_version,retention_days,created_at)
    SELECT ?,?,?,?,?,?,?,?,'stars-pack-v1',?,?,?,? WHERE EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=?)
    ON CONFLICT(payer_id,request_key) DO NOTHING`).bind(order,payload,owner,owner,requestKey,Number(pack),price.xtr,price.dust,paymentScope(env),p.terms_version,p.retention_days,new Date().toISOString().slice(0,19).replace('T',' '),owner).run();
  const saved=await env.DB.prepare('SELECT * FROM astra_payment_orders WHERE payer_id=? AND request_key=?').bind(owner,requestKey).first();
  if(!saved)throw Error('A registered profile is required');if(saved.package!==Number(pack)||saved.terms_version!==termsVersion||saved.scope!==paymentScope(env))throw Error('Purchase request snapshot conflict');return saved;
}
export async function sendStarInvoice(env,order){
  await paymentEnvironment(env,{shop:true,probe:true});
  if(order.scope!==paymentScope(env))throw Error('Wrong payment environment');
  const lease=crypto.randomUUID(),r=await env.DB.prepare(`UPDATE astra_payment_orders SET delivery='sending',invoice_lease=?,updated_at=CURRENT_TIMESTAMP
    WHERE order_id=? AND payer_id=? AND status='created' AND delivery='pending'`).bind(lease,order.order_id,order.payer_id).run();
  if(!r.meta.changes)return {sent:false,status:order.status};
  try{
    await starsApi(env,'sendInvoice',{chat_id:order.payer_id,title:'Звёздная пыль Астры',description:`${order.dust} ✨. Условия: ${order.terms_version}.`,payload:order.payload,currency:'XTR',prices:[{label:`${order.dust} ✨`,amount:order.xtr}],provider_token:'',start_parameter:'stars'});
    await env.DB.prepare(`UPDATE astra_payment_orders SET status=CASE WHEN status='created' THEN 'invoiced' ELSE status END,delivery='sent',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND invoice_lease=?`).bind(order.order_id,lease).run();
    return {sent:true};
  }catch(e){await env.DB.prepare("UPDATE astra_payment_orders SET delivery=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND invoice_lease=?").bind(e.telegramCode?'failed':'unknown',order.order_id,lease).run();throw e;}
}
export async function reservePrecheckout(env,q,{deadline=Infinity}={}){
  await paymentEnvironment(env,{shop:true});
  if(performance.now()>=deadline)return false;
  const o=await readPaymentOrder(env,q.invoice_payload);
  if(performance.now()>=deadline||!o||Date.now()-Date.parse(o.created_at.replace(' ','T')+'Z')>86400000||o.payer_id!==q.from?.id||o.owner_id!==q.from.id||o.scope!==paymentScope(env)||q.currency!=='XTR'||q.total_amount!==o.xtr||!['created','invoiced','confirmed'].includes(o.status))return false;
  const r=await env.DB.prepare(`UPDATE astra_payment_orders SET precheckout_id=?,status='confirmed',updated_at=CURRENT_TIMESTAMP
    WHERE order_id=? AND payer_id=? AND status IN ('created','invoiced','confirmed') AND (precheckout_id IS NULL OR precheckout_id=?)`).bind(q.id,o.order_id,q.from.id,q.id).run();
  return Boolean(r.meta.changes);
}
export async function answerStarPrecheckout(env,q,{ready=async()=>true,startedAt=performance.now()}={}){
  let timer,ok=false;const deadline=startedAt+6000;
  const validate=async()=>await ready()&&performance.now()<deadline?reservePrecheckout(env,q,{deadline}):false;
  try{ok=await Promise.race([validate(),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),Math.max(0,deadline-performance.now()));})]);}catch{ok=false;}finally{clearTimeout(timer);}
  await starsApi(env,'answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(ok?{}:{error_message:'Предложение недоступно. Откройте магазин заново или обратитесь в /paysupport.'})},2500);
  return ok;
}
export function validStarProof(proof){return proof&&proof.currency==='XTR'&&Number.isSafeInteger(proof.total_amount)&&proof.total_amount>0&&typeof proof.invoice_payload==='string'&&new TextEncoder().encode(proof.invoice_payload).length<=128&&typeof proof.telegram_payment_charge_id==='string'&&proof.telegram_payment_charge_id.length>0&&proof.telegram_payment_charge_id.length<=512;}
export async function savePaymentAnomaly(env,owner,proof,hash,reason){
  await env.DB.prepare(`INSERT INTO astra_payment_anomalies(charge_hash,charge_id,payer_id,payload,currency,xtr,scope,reason)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(charge_hash) DO NOTHING`).bind(hash,proof.telegram_payment_charge_id,owner,String(proof.invoice_payload||'').slice(0,128),String(proof.currency||'').slice(0,8),Number.isSafeInteger(proof.total_amount)?proof.total_amount:0,paymentScope(env),reason).run();
}
export async function receiveStarPayment(env,owner,proof){
  if(!Number.isSafeInteger(owner)||owner<=0||!validStarProof(proof))throw Error('Malformed successful payment');
  const hash=await chargeHash(proof.telegram_payment_charge_id),o=await readPaymentOrder(env,proof.invoice_payload);
  const old=await env.DB.prepare('SELECT * FROM astra_payment_receipts WHERE charge_hash=? OR charge_id=?').bind(hash,proof.telegram_payment_charge_id).first();
  if(old){if(old.payer_id!==owner||old.order_id!==o?.order_id||old.xtr!==proof.total_amount||old.currency!==proof.currency){await savePaymentAnomaly(env,owner,proof,hash,'charge_identity_conflict');return {status:'needs_review',hash};}return {status:'recorded',receipt:old,hash};}
  if(await env.DB.prepare('SELECT charge_hash FROM astra_payment_tombstones WHERE charge_hash=?').bind(hash).first())return {status:'archived',hash};
  if(!o||o.payer_id!==owner||o.scope!==paymentScope(env)||o.xtr!==proof.total_amount||proof.currency!=='XTR'){
    await savePaymentAnomaly(env,owner,proof,hash,'order_snapshot_mismatch');return {status:'needs_review',hash};
  }
  if(await env.DB.prepare('SELECT charge_id FROM astra_payment_receipts WHERE order_id=?').bind(o.order_id).first()){
    await savePaymentAnomaly(env,owner,proof,hash,'second_charge_for_order');return {status:'needs_review',hash};
  }
  await env.DB.prepare(`INSERT INTO astra_payment_receipts(charge_id,charge_hash,order_id,payer_id,currency,xtr,dust,kind,credited_dust)
    SELECT ?,?,?,?,'XTR',o.xtr,o.dust,'paid',CASE WHEN o.owner_id=? AND EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=?) AND NOT EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=?) THEN o.dust ELSE 0 END
    FROM astra_payment_orders o WHERE o.order_id=? ON CONFLICT DO NOTHING`).bind(proof.telegram_payment_charge_id,hash,o.order_id,owner,owner,owner,hash,o.order_id).run();
  const receipt=await env.DB.prepare('SELECT * FROM astra_payment_receipts WHERE charge_hash=?').bind(hash).first();
  if(!receipt){await savePaymentAnomaly(env,owner,proof,hash,'concurrent_order_conflict');return {status:'needs_review',hash};}
  return {status:receipt.credited_dust>0?'credited':'needs_review',receipt,hash};
}
export async function receiveStarRefund(env,owner,proof,source='message'){
  if(!Number.isSafeInteger(owner)||owner<=0||!validStarProof(proof))throw Error('Malformed refund');
  const hash=await chargeHash(proof.telegram_payment_charge_id),o=await readPaymentOrder(env,proof.invoice_payload);
  const receipt=await env.DB.prepare('SELECT * FROM astra_payment_receipts WHERE charge_hash=?').bind(hash).first();
  if(receipt&&(receipt.payer_id!==owner||receipt.order_id!==o?.order_id||receipt.xtr!==proof.total_amount))throw Error('Refund identity mismatch');
  const tomb=await env.DB.prepare('SELECT * FROM astra_payment_tombstones WHERE charge_hash=?').bind(hash).first();
  if(o&&o.scope!==paymentScope(env))throw Error('Refund environment mismatch');
  if(tomb&&(tomb.scope!==paymentScope(env)||tomb.xtr!==proof.total_amount))throw Error('Archived refund snapshot mismatch');
  if(tomb?.refunded&&!receipt)return {payer_id:owner,removed:0,debt_added:0,archived:true};
  if(!receipt&&!tomb&&(!o||o.payer_id!==owner||o.xtr!==proof.total_amount||o.scope!==paymentScope(env)))await savePaymentAnomaly(env,owner,proof,hash,'unmatched_refund');
  await env.DB.prepare(`INSERT INTO astra_external_refunds(charge_hash,charge_id,order_id,payer_id,currency,xtr,source) VALUES(?,?,?,?,?,?,?) ON CONFLICT(charge_hash) DO NOTHING`).bind(hash,proof.telegram_payment_charge_id,o?.payer_id===owner&&o.xtr===proof.total_amount?o.order_id:null,owner,proof.currency,proof.total_amount,source).run();
  const settlement=await env.DB.prepare('SELECT * FROM astra_refund_settlements WHERE charge_hash=?').bind(hash).first();
  if(settlement&&settlement.payer_id!==owner)throw Error('Refund owner mismatch');
  return settlement||{payer_id:owner,removed:0,debt_added:0,archived:true};
}
export async function requestStarRefund(env,chargeId){
  await paymentEnvironment(env,{probe:true});
  const hash=await chargeHash(chargeId);
  let proof=await env.DB.prepare(`SELECT r.*,o.payload AS invoice_payload,o.scope FROM astra_payment_receipts r JOIN astra_payment_orders o ON o.order_id=r.order_id WHERE r.charge_hash=?`).bind(hash).first();
  if(!proof){const a=await env.DB.prepare('SELECT * FROM astra_payment_anomalies WHERE charge_hash=? AND reason<>?').bind(hash,'unmatched_refund').first();if(a)proof={...a,invoice_payload:a.payload};}
  const archived=await env.DB.prepare('SELECT * FROM astra_payment_tombstones WHERE charge_hash=?').bind(hash).first();
  if(archived&&proof&&(archived.xtr!==proof.xtr||archived.scope!==proof.scope))throw Error('Archived payment snapshot mismatch');
  if(!proof||proof.scope!==paymentScope(env)||proof.currency!=='XTR'||proof.xtr<=0)throw Error('Known charge proof required');
  if(await env.DB.prepare('SELECT charge_hash FROM astra_external_refunds WHERE charge_hash=?').bind(hash).first())return {status:'refunded'};
  await env.DB.prepare('INSERT INTO astra_refund_requests(charge_hash) VALUES(?) ON CONFLICT(charge_hash) DO NOTHING').bind(hash).run();
  const lease=crypto.randomUUID(),now=Date.now();
  const claim=await env.DB.prepare(`UPDATE astra_refund_requests SET status='in_progress',lease=?,lease_until=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE charge_hash=? AND status='requested' AND lease_until<=?`).bind(lease,now+60000,hash,now).run();
  if(!claim.meta.changes)return {status:(await env.DB.prepare('SELECT status FROM astra_refund_requests WHERE charge_hash=?').bind(hash).first()).status};
  await env.DB.prepare("UPDATE astra_payment_orders SET status='refund_in_progress',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status<>'refunded'").bind(proof.order_id||'').run();
  try{
    const ok=await starsApi(env,'refundStarPayment',{user_id:proof.payer_id,telegram_payment_charge_id:chargeId});
    if(ok!==true)throw Error('Refund outcome unknown');
    const settlement=await receiveStarRefund(env,proof.payer_id,{currency:proof.currency,total_amount:proof.xtr,invoice_payload:proof.invoice_payload,telegram_payment_charge_id:chargeId},'api');
    return {status:'refunded',settlement};
  }catch(e){
    const safeRetry=e.telegramCode===429;
    await env.DB.prepare(`UPDATE astra_refund_requests SET status=?,last_error=?,lease_until=?,updated_at=CURRENT_TIMESTAMP WHERE charge_hash=? AND lease=? AND status<>'refunded'`).bind(safeRetry?'requested':'needs_review',safeRetry?'rate_limited':'reconcile_before_retry',safeRetry?Date.now()+Math.max(1,e.retryAfter||60)*1000:0,hash,lease).run();
    return {status:safeRetry?'requested':'needs_review'};
  }
}
export async function reconcileStarPage(env,offset=0,recoverArchived=false){
  await paymentEnvironment(env,{probe:true});if(!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid offset');
  const page=await starsApi(env,'getStarTransactions',{offset,limit:5});
  if(!Array.isArray(page?.transactions))throw Error('Unknown Telegram transaction schema');
  // Bound D1/API work per HTTP request; caller advances manually with overlap.
  const transactions=page.transactions.slice(0,5);
  const result={scanned:transactions.length,credited_or_recorded:0,refunds:0,needs_review:0,next_offset:offset+transactions.length};
  for(const t of transactions){
    if(typeof t.id!=='string'||!Number.isSafeInteger(t.amount))continue;
    const incoming=t.source?.type==='user'&&t.source.transaction_type==='invoice_payment';
    const outgoing=t.receiver?.type==='user'&&t.receiver.transaction_type==='invoice_payment';
    const partner=incoming?t.source:outgoing?t.receiver:null;if(!partner||!Number.isSafeInteger(partner.user?.id))continue;
    if(t.amount<=0||(t.nanostar_amount!=null&&t.nanostar_amount!==0)){await savePaymentAnomaly(env,partner.user.id,{telegram_payment_charge_id:t.id,currency:'XTR',total_amount:0,invoice_payload:partner.invoice_payload||''},await chargeHash(t.id),'unsupported_transaction_amount');result.needs_review++;continue;}
    let payload=partner.invoice_payload;
    if(!payload){const r=await env.DB.prepare('SELECT o.payload FROM astra_payment_receipts r JOIN astra_payment_orders o ON o.order_id=r.order_id WHERE r.charge_id=? AND r.payer_id=?').bind(t.id,partner.user.id).first();payload=r?.payload;}
    if(!payload&&outgoing&&await env.DB.prepare('SELECT charge_hash FROM astra_payment_tombstones WHERE charge_hash=?').bind(await chargeHash(t.id)).first())payload='';
    if(payload==null){await savePaymentAnomaly(env,partner.user.id,{telegram_payment_charge_id:t.id,currency:'XTR',total_amount:Math.abs(t.amount),invoice_payload:''},await chargeHash(t.id),'transaction_payload_missing');result.needs_review++;continue;}
    const proof={currency:'XTR',total_amount:Math.abs(t.amount),invoice_payload:payload,telegram_payment_charge_id:t.id};
    if(incoming){const saved=await receiveStarPayment(env,partner.user.id,proof);if(saved.status==='archived'&&recoverArchived)await savePaymentAnomaly(env,partner.user.id,proof,saved.hash,'archived_recovery_verified');saved.status==='needs_review'?result.needs_review++:result.credited_or_recorded++;}
    else{await receiveStarRefund(env,partner.user.id,proof,'reconcile');result.refunds++;}
  }return result;
}
export async function readStarHistory(env,owner,cursor=null){
  if(!Number.isSafeInteger(owner)||owner<=0)throw Error('Invalid payment history owner');
  let snapshot,boundary=null,direction='o';
  if(cursor){const c=decodeHistoryCursor(cursor);if(!c)return {expired:true};({snapshot,direction}=c);
    const r=await env.DB.prepare('SELECT rowid AS mark,created_at,order_id FROM astra_payment_orders WHERE payer_id=? AND rowid IN (?,?)').bind(owner,snapshot,c.anchor).all();
    boundary=r.results.find(r=>r.mark===c.anchor);if(!boundary||!r.results.some(r=>r.mark===snapshot))return {expired:true};
  }else snapshot=(await env.DB.prepare('SELECT rowid AS mark FROM astra_payment_orders WHERE payer_id=? ORDER BY rowid DESC LIMIT 1').bind(owner).first())?.mark;
  if(!snapshot)return {rows:[],older:null,newer:null};const newer=direction==='n',clause=boundary?` AND (created_at,order_id) ${newer?'>':'<'} (?,?)`:'';
  const r=await env.DB.prepare(`SELECT rowid AS mark,order_id,xtr,dust,status,created_at FROM astra_payment_orders WHERE payer_id=? AND rowid<=?${clause} ORDER BY created_at ${newer?'ASC':'DESC'},order_id ${newer?'ASC':'DESC'} LIMIT 13`).bind(owner,snapshot,...(boundary?[boundary.created_at,boundary.order_id]:[])).all();
  let rows=r.results.slice(0,12);if(newer)rows.reverse();if(!rows.length)return {expired:true};
  return {rows,older:(!newer?r.results.length>12:Boolean(boundary))?encodeHistoryCursor('o',snapshot,rows.at(-1).mark):null,newer:(newer?r.results.length>12:Boolean(boundary))?encodeHistoryCursor('n',snapshot,rows[0].mark):null};
}
