import {readPolicy,armPolicy} from '../rewards/policy.mjs';
import {paymentScope,starsApi,supportValid,paymentEnvironment} from './transport.mjs';
import {requestStarRefund,reconcileStarPage} from './service.mjs';
export async function paymentAudit(env,kind,hash=null){
  await env.DB.prepare('INSERT INTO astra_payment_audit(audit_id,kind,charge_hash) VALUES(?,?,?)').bind(crypto.randomUUID(),kind,hash).run();
}
export async function configurePayments(env,b){
  if(!supportValid(b.support)||typeof b.terms_version!=='string'||!/^[-A-Za-z0-9_.]{1,60}$/.test(b.terms_version)||!Number.isSafeInteger(b.retention_days)||b.retention_days<180||b.retention_days>3650||!Number.isSafeInteger(b.bot_id)||b.bot_id<=0)throw Error('Approve support, Terms, retention and expected bot ID');
  if(paymentScope(env)==='test'&&env.ASTRA_PAYMENT_ENVIRONMENT_ACK!=='DEDICATED_TELEGRAM_TEST_ENVIRONMENT_CONFIRMED')throw Error('Test environment acknowledgement missing');
  if(paymentScope(env)==='production'&&/(?:example|\.test|invalid|localhost)/i.test(b.support))throw Error('A real production support contact is required');
  const me=await starsApi(env,'getMe',{},3500);if(me.id!==b.bot_id)throw Error('Wrong bot identity');
  await env.DB.prepare(`UPDATE astra_policy SET payment_scope=?,support=?,terms_version=?,retention_days=?,verified_bot_id=?,stars_enabled=0 WHERE singleton=1`).bind(paymentScope(env),b.support,b.terms_version,b.retention_days,b.bot_id).run();
  await paymentAudit(env,'payment_environment_verified');return {configured:true,shop_enabled:false};
}
export async function purgePaymentData(env,dryRun=true){
  const p=await readPolicy(env);if(!p.retention_days)throw Error('Retention not approved');
  const rows=await env.DB.prepare(`SELECT o.payer_id FROM astra_payment_orders o GROUP BY o.payer_id HAVING
    sum(CASE WHEN o.status NOT IN ('credited','refunded') OR o.updated_at>=datetime('now','-'||o.retention_days||' days') THEN 1 ELSE 0 END)=0
    AND NOT EXISTS(SELECT 1 FROM astra_refund_accounts a WHERE a.payer_id=o.payer_id AND (a.debt>0 OR a.updated_at>=datetime('now','-'||o.retention_days||' days')))
    AND NOT EXISTS(SELECT 1 FROM astra_payment_anomalies a WHERE a.payer_id=o.payer_id AND a.status='needs_review')
    AND NOT EXISTS(SELECT 1 FROM astra_refund_requests q JOIN astra_payment_receipts r ON r.charge_hash=q.charge_hash WHERE r.payer_id=o.payer_id AND q.status<>'refunded') LIMIT 10`).all();
  const closed=await env.DB.prepare(`SELECT a.payer_id FROM astra_refund_accounts a WHERE a.debt=0 AND a.updated_at<datetime('now','-'||?||' days') AND NOT EXISTS(SELECT 1 FROM astra_payment_orders o WHERE o.payer_id=a.payer_id) AND NOT EXISTS(SELECT 1 FROM astra_payment_anomalies x WHERE x.payer_id=a.payer_id AND x.status='needs_review') LIMIT 10`).bind(p.retention_days).all();
  if(dryRun)return {dry_run:true,eligible:rows.results.length+closed.results.length};
  // Each deletion is a single statement with explicit FK-OFF cleanup trigger.
  for(const o of rows.results)await env.DB.prepare('DELETE FROM astra_payment_orders WHERE payer_id=?').bind(o.payer_id).run();
  for(const a of closed.results)await env.DB.prepare('DELETE FROM astra_refund_accounts WHERE payer_id=?').bind(a.payer_id).run();
  await paymentAudit(env,'retention_purge');return {dry_run:false,deleted_payer_archives:rows.results.length,deleted_closed_accounts:closed.results.length};
}
export async function paymentsAdmin(request,env){
  const url=new URL(request.url);if(!url.pathname.startsWith('/internal/payments/')&&url.pathname!=='/internal/economy/policy')return null;
  if(request.method!=='POST'||!env.ASTRA_ADMIN_KEY||request.headers.get('Authorization')!==`Bearer ${env.ASTRA_ADMIN_KEY}`)return new Response('Forbidden',{status:403});
  const b=await request.json();
  if(url.pathname==='/internal/economy/policy'){
    if(b.action==='arm'){const p=await armPolicy(env,b.start_day);await paymentAudit(env,'policy_armed');return Response.json({start_day:p.start_day,enabled:Boolean(p.enabled)});}
    if(b.action==='stop'||b.action==='resume'){if(b.action==='resume'&&!(await readPolicy(env)).start_day)throw Error('Arm a future cutover first');await env.DB.prepare('UPDATE astra_policy SET enabled=? WHERE singleton=1').bind(b.action==='resume'?1:0).run();await paymentAudit(env,'policy_'+b.action);return Response.json({ok:true});}
  }
  if(url.pathname==='/internal/payments/configure')return Response.json(await configurePayments(env,b));
  if(url.pathname==='/internal/payments/shop'){
    if(b.enabled)await paymentEnvironment(env);await env.DB.prepare('UPDATE astra_policy SET stars_enabled=? WHERE singleton=1').bind(b.enabled===true?1:0).run();await paymentAudit(env,b.enabled?'shop_enabled':'shop_disabled');return Response.json({enabled:b.enabled===true});
  }
  if(url.pathname==='/internal/payments/status'){
    if(b.order_id){const row=await env.DB.prepare('SELECT o.order_id,o.payer_id,o.xtr,o.dust,o.status,r.charge_id,r.charge_hash,r.credited_dust FROM astra_payment_orders o LEFT JOIN astra_payment_receipts r ON r.order_id=o.order_id WHERE o.order_id=?').bind(b.order_id).first();return Response.json({order:row},{headers:{'Cache-Control':'no-store'}});}
    if(typeof b.charge_prefix!=='string'||!/^[a-f0-9]{12,64}$/.test(b.charge_prefix))throw Error('Order or support reference required');const rows=await env.DB.prepare('SELECT * FROM astra_payment_anomalies WHERE charge_hash>=? AND charge_hash<? LIMIT 5').bind(b.charge_prefix,b.charge_prefix+'g').all();return Response.json({cases:rows.results},{headers:{'Cache-Control':'no-store'}});
  }
  if(url.pathname==='/internal/payments/refund'){await paymentAudit(env,'operator_refund_requested');return Response.json(await requestStarRefund(env,b.charge_id));}
  if(url.pathname==='/internal/payments/reconcile'){const r=await reconcileStarPage(env,b.offset||0,b.recover_archived===true);await paymentAudit(env,'operator_reconciliation');return Response.json(r);}
  if(url.pathname==='/internal/payments/purge')return Response.json(await purgePaymentData(env,b.dry_run!==false));
  if(url.pathname==='/internal/payments/retry-refund'){
    if(b.acknowledgement!=='CONFIRMED_NOT_REFUNDED_AFTER_TELEGRAM_RECONCILIATION')throw Error('Reconcile Telegram before an explicit retry');
    await paymentEnvironment(env);await env.DB.prepare("UPDATE astra_refund_requests SET status='requested',lease_until=0,last_error='operator_confirmed_not_refunded' WHERE charge_hash=? AND status IN ('needs_review','in_progress') AND NOT EXISTS(SELECT 1 FROM astra_external_refunds WHERE charge_hash=?)").bind(b.charge_hash,b.charge_hash).run();await paymentAudit(env,'operator_authorized_retry',b.charge_hash);return Response.json({ok:true});
  }
  return new Response('Not found',{status:404});
}
