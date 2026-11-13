# ASTRA 2.5.1 offline owner tool. No network, no Cloudflare calls.
# Requires owner's approved original PRIVATE 2.5 build. Never uploads/prints any Telegram file_id or secret.
from __future__ import annotations
import hashlib, hmac, json, os, re, subprocess, shutil
from pathlib import Path
from datetime import datetime, timezone

EXPECTED_SHA='3ee56aefdebb7dc4b3cacfc74b2da24e002e6f150f7b45167c1f472719303561'
OLD_VERSION="const VERSION = 'ASTRA-2.5-clean-release';"
NEW_VERSION="const VERSION = 'ASTRA-2.5.1-tarot-stars-admin';"
NEW_JS='ASTRA_2_5_1_WORKER.js'
SETUP_SQL='ASTRA25_1_SETUP_PRIVATE.sql'
ACTIVATE_SQL='ASTRA25_1_ENABLE_STARS_PRIVATE.sql'
RECEIPT='ASTRA25_1_SAFE_RECEIPT.json'
OWNER_FILE='ASTRA25_1_OWNER_ID_PRIVATE.txt'

ADMIN_IMPL=r'''
// Astra 2.5.1 owner-only dust administration. Authentication is a numeric Telegram ID
// from a verified private webhook; usernames are not an authorization mechanism.
async function astraAdmin251(env,m,updateId){
 const t=String(m?.text||'').trim();
 if(!/^\/(?:myid|admin|grant)(?:\s|$)/u.test(t))return false;
 if(m.chat?.type!=='private'||m.chat?.id!==m.from?.id||m.from?.is_bot)return false;
 const actorId=m.from.id;
 if(t==='/myid'){await send(env,actorId,'Ваш Telegram ID: '+actorId);return true;}
 if(!Number.isSafeInteger(actorId)||String(actorId)!==String(env.ASTRA_OWNER_TELEGRAM_ID||''))return false;
 if(t==='/admin'){
  await send(env,actorId,'Астра · Администрирование\n\n/grant ID КОЛИЧЕСТВО — начислить 1–1000 ✨ зарегистрированному пользователю (можно себе).\n/myid — узнать свой Telegram ID.\n\nКаждая операция записывается в журнал и повторно не начисляется. Раздавать настоящие ⭐ Telegram Stars нельзя.');
  return true;
 }
 if(!t.startsWith('/grant'))return false;
 const match=/^\/grant\s+([1-9][0-9]{0,15})\s+([1-9][0-9]{0,3})$/.exec(t);
 if(!match){await send(env,actorId,'Формат: /grant TELEGRAM_ID КОЛИЧЕСТВО\nНапример: /grant 123456789 40\nЛимит одной операции: 1000 ✨.');return true;}
 const target=Number(match[1]),amount=Number(match[2]);
 if(!Number.isSafeInteger(target)||!Number.isInteger(amount)||amount<1||amount>1000||!Number.isSafeInteger(updateId)||updateId<1){
  await send(env,actorId,'Неверный ID, сумма или идентификатор сообщения. Начисления не было.');return true;
 }
 const targetRow=await env.DB.prepare('SELECT telegram_id FROM astra_users WHERE telegram_id=?').bind(target).first();
 if(!targetRow){await send(env,actorId,'Пользователь не найден. Сначала он должен отправить /start и зарегистрироваться в Астре.');return true;}
 // The INSERT + AFTER INSERT trigger atomically update wallet and append one ledger row.
 // Conflicting Telegram update IDs are idempotent; a webhook retry cannot mint again.
 const result=await env.DB.prepare(`INSERT INTO astra_admin_grants25(update_id,operator_id,target_id,amount)
 SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM astra_users WHERE telegram_id=?)
 ON CONFLICT(update_id) DO NOTHING`).bind(updateId,actorId,target,amount,target).run();
 const audit=await env.DB.prepare('SELECT operator_id,target_id,amount FROM astra_admin_grants25 WHERE update_id=?').bind(updateId).first();
 if(!audit||audit.operator_id!==actorId||audit.target_id!==target||audit.amount!==amount)throw Error('ADMIN_CREDIT_UNCONFIRMED');
 const wallet=await env.DB.prepare('SELECT balance FROM astra_users WHERE telegram_id=?').bind(target).first();
 await send(env,actorId,(result.meta?.changes?'Начислено: ':'Уже учтено ранее: ')+amount+' ✨ пользователю '+target+'.\nТекущий баланс: '+wallet.balance+' ✨.');
 return true;
}
'''

HEALTH_STARS=r'''
 if(yes(env.STARS_SHOP_ENABLED)){
  let pay;
  try{pay=await env.DB.prepare('SELECT payment_scope,support,terms_version,retention_days,verified_bot_id,stars_enabled FROM astra_policy WHERE singleton=1').first();}catch{}
  const botId=Number(String(env.ASTRA_BOT_TOKEN||'').split(':')[0]);
  state.stars_ready=Boolean(pay?.stars_enabled===1&&pay.payment_scope==='production'&&pay.support==='https://t.me/BAL1k_67'&&pay.terms_version==='astra-stars-2026-11-v1'&&Number(pay.retention_days)===365&&pay.verified_bot_id===botId&&env.ASTRA_PAYMENT_POLICY_ACCEPTED==='APPROVED_SUPPORT_TERMS_RETENTION'&&env.ASTRA_STARS_LIVE_APPROVED==='YES_I_AUTHORIZE_REAL_STARS'&&!yes(env.ASTRA_TELEGRAM_TEST_MODE));
  require(state.stars_ready,'STARS_CONFIG_INVALID');
 } else state.stars_ready=false;
 let adminSchema=false;
 try{const r=await env.DB.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type IN ('table','trigger') AND name IN ('astra_admin_grants25','astra_admin_grants_post25')").first();adminSchema=r?.n===2;}catch{}
 state.admin_schema_ready=adminSchema;
 require(adminSchema,'ADMIN_SCHEMA_MISSING');
'''

def stop(message):
    raise RuntimeError(message)

def replace_once(src,needle,replacement,label):
    n=src.count(needle)
    if n!=1:stop('Безопасная остановка: неоднозначная точка патча '+label+' ('+str(n)+')')
    return src.replace(needle,replacement,1)

def main():
    if os.name!='nt':stop('Программа предназначена для Windows владельца. Сеть не используется.')
    home=Path(__file__).resolve().parent
    root=Path(os.environ['LOCALAPPDATA']).resolve()/'Astra25Release'
    if not home.name.startswith('build-') or home.parent.resolve()!=root or home.is_symlink():
        stop('Положите файл в оригинальную приватную папку %LOCALAPPDATA%\\Astra25Release\\build-*')
    work=home/'ASTRA_2_5_WORKER.js'
    receipt=home/'safe-build-receipt.json'
    settings=home/'CLOUDFLARE_SETTINGS_PRIVATE.txt'
    registry=home/'telegram-registry.json'
    for p in (work,receipt,settings,registry):
        if not p.is_file() or p.is_symlink():stop('Отсутствует проверенный файл: '+p.name)
    old=work.read_bytes()
    h=hashlib.sha256(old).hexdigest()
    r=json.loads(receipt.read_text(encoding='utf-8'))
    if h!=EXPECTED_SHA or h!=r.get('worker_sha256') or len(old)!=r.get('worker_bytes'):
        stop('Входящий приватный Worker не соответствует проверенному релизу Astra 2.5. STOP.')
    bot=json.loads(registry.read_text(encoding='utf-8')).get('bot_id')
    if type(bot) is not int or bot<=0 or bot>=2**52:stop('Неверный идентификатор Telegram-бота в реестре.')
    values={}
    for line in settings.read_text(encoding='utf-8').splitlines():
        m=re.fullmatch(r'\s*([A-Z_0-9]+)\s*=\s*(\S.*?)\s*',line)
        if m:values[m[1]]=m[2]
    secret=values.get('ASTRA_BONUS_FENCE_KEY')
    if not secret or len(secret)<40:stop('Приватный секрет HMAC отсутствует.')
    setup=home/'SETUP_NEW_D1.sql'
    if not setup.exists() or hmac.new(secret.encode(),b'astra:bonus-fence:v1:check:configuration',hashlib.sha256).hexdigest() not in setup.read_text(encoding='utf-8'):
        stop('HMAC-секрет и SQL базы не совпадают.')
    if (home/NEW_JS).exists() or (home/SETUP_SQL).exists() or (home/ACTIVATE_SQL).exists() or (home/RECEIPT).exists() or (home/OWNER_FILE).exists():
        stop('Релиз 2.5.1 уже подготовлен в этой папке. Повтор не нужен; не перезаписываем файлы.')
    print('Астра 2.5.1 — исправление Таро, магазин Stars и права администратора')
    print('Никаких обращений в Telegram и Cloudflare на этом шаге.')
    print('Контакт платежной поддержки: @BAL1k_67')
    print('Пакеты: 10 ⭐ = 40 ✨; 25 ⭐ = 110 ✨; 50 ⭐ = 240 ✨')
    print('Условия: срок финансовых записей 365 дней после закрытия дела; очистка проводится отдельно.')
    print('Возврат Stars уменьшает доступную пыль; если пыль уже потрачена, возникает долг до погашения будущими начислениями.')
    print('Материалы Таро после возврата не отзываются. Обоснованные споры разбирает поддержка.')
    print('Только внутренняя пыль начисляется /grant; настоящие Telegram Stars нельзя создать админ-командой.')
    owner=input('\nВведите числовой Telegram ID аккаунта @BAL1k_67 (не username): ').strip()
    if not re.fullmatch(r'[1-9][0-9]{4,15}',owner) or int(owner)>=2**52:stop('Нужен числовой Telegram user ID. Уточните его в Telegram (например, через @userinfobot).')
    confirm=input('Подтверждаете цены, поддержку, условия возвратов и 365 дней хранения? Введите УТВЕРЖДАЮ: ').strip()
    if confirm!='УТВЕРЖДАЮ':print('Отменено. Ничего не изменено.');return
    js=old.decode('utf-8')
    js=replace_once(js,OLD_VERSION,NEW_VERSION,'version')
    js=replace_once(js,'const paid=await loadOwned(env,a,id);if(paid)',"const paid=await loadOwned(env,a,'new:'+id);if(paid)",'tarot quote')
    # Add authorization gate inside the final incoming handler; it is invoked after webhook verification.
    js=replace_once(js,'async function incoming(env,m,updateId){','async function incoming(env,m,updateId){if(await astraAdmin251(env,m,updateId))return;','incoming owner gate')
    js=replace_once(js,'const astraWorker = {',ADMIN_IMPL+'\nconst astraWorker = {','owner implementation')
    js=replace_once(js,"require(!yes(env.STARS_SHOP_ENABLED),'STARS_MUST_REMAIN_OFF');",HEALTH_STARS,'Stars readiness')
    js=replace_once(js,"AND name<>'_cf_KV'", "AND name<>'_cf_KV' AND name NOT IN ('astra_admin_grants25','astra_admin_grants_post25')",'schema baseline exclusions')
    node=shutil.which('node')
    if not node:stop('Node.js не найден. Локальная проверка JS невозможна.')
    syntax=subprocess.run([node,'--input-type=module','--check'],input=js.encode('utf-8'),stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=30)
    if syntax.returncode:stop('JS-синтаксис не прошёл Node --check. Ничего не создано.')
    # Public SQL setup deliberately contains no Telegram token or private image ID.
    ddl='''-- ASTRA25.1: NEW astra25-release D1 ONLY. Run exactly once after local owner approval.
-- Grant receipts + atomic balance and ledger effect. Only bot owner can call this via authenticated private webhook.
CREATE TABLE astra_admin_grants25 (
 update_id INTEGER PRIMARY KEY CHECK(update_id>0),
 operator_id INTEGER NOT NULL CHECK(operator_id>0),
 target_id INTEGER NOT NULL REFERENCES astra_users(telegram_id) ON DELETE CASCADE,
 amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER astra_admin_grants_post25 AFTER INSERT ON astra_admin_grants25 BEGIN
 UPDATE astra_users SET balance=balance+NEW.amount WHERE telegram_id=NEW.target_id;
 INSERT INTO astra_wallet_ledger(idempotency_key,telegram_id,delta,reason)
 VALUES('admin:'||NEW.update_id,NEW.target_id,NEW.amount,'admin:grant');
END;
'''
    # Configure commerce but do not activate until after a separate platform /health check.
    ddl+=f"""UPDATE astra_policy SET payment_scope='production',support='https://t.me/BAL1k_67',terms_version='astra-stars-2026-11-v1',retention_days=365,verified_bot_id={bot},stars_enabled=0
 WHERE singleton=1 AND stars_enabled=0 AND NOT EXISTS(SELECT 1 FROM astra_all_receipts26);
INSERT INTO astra_payment_audit(audit_id,kind) VALUES(lower(hex(randomblob(16))),'astra25_1_commerce_prepared');
SELECT (SELECT COUNT(*) FROM astra_admin_grants25) AS admin_grants, (SELECT stars_enabled FROM astra_policy WHERE singleton=1) AS stars_enabled, (SELECT payment_scope FROM astra_policy WHERE singleton=1) AS scope;
"""
    activate='''-- ONLY after staged version is checked and owner explicitly approves LIVE Stars payments.
UPDATE astra_policy SET stars_enabled=1 WHERE singleton=1 AND stars_enabled=0 AND payment_scope='production' AND support='https://t.me/BAL1k_67' AND terms_version='astra-stars-2026-11-v1' AND retention_days=365;
SELECT stars_enabled FROM astra_policy WHERE singleton=1;
'''
    newsha=hashlib.sha256(js.encode('utf-8')).hexdigest()
    for name,body in [(NEW_JS,js),(SETUP_SQL,ddl),(ACTIVATE_SQL,activate)]:
        with (home/name).open('x',encoding='utf-8',newline='\n') as o:o.write(body)
    (home/OWNER_FILE).write_text(owner+'\n', encoding='utf-8')
    (home/RECEIPT).write_text(json.dumps({'version':'astra25.1-private-prepared-v1','parent_sha256':EXPECTED_SHA,'worker_sha256':newsha,'worker_bytes':len(js.encode('utf-8')),'syntax':'PASS','private_worker_not_uploaded':True,'admin_owner_defined_locally':True,'tarot_quote_fix':True,'stars_shop_still_off_in_cloudflare':True,'files':[NEW_JS,SETUP_SQL,ACTIVATE_SQL]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('\nГотово: локальный Astra 2.5.1 Worker, SQL и проверочный receipt созданы.')
    print('SHA256 нового Worker: '+newsha)
    print('Не отправляйте сам Worker, SQL, реестр, приватные настройки или владелец ID в общий доступ.')
    print('Сейчас старый бот НЕ изменён. Далее отдельно установим SQL и загрузим новую неактивную версию.')

if __name__=='__main__':
    try:main()
    except Exception as e:print('\nSTOP:',e)
    finally:
        try:input('\nEnter — закрыть окно...')
        except (KeyboardInterrupt,EOFError):pass
