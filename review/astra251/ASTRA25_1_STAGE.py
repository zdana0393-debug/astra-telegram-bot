"""Stage owner-prepared Astra 2.5.1 at 0% traffic. No activation, no SQL writes."""
from __future__ import annotations
import hashlib, hmac, json, os, re, shutil, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path

DB_ID='1a5b3f2f-e668-4b74-90fb-3781cb2c79ea'
OLD_SHA='3ee56aefdebb7dc4b3cacfc74b2da24e002e6f150f7b45167c1f472719303561'
BASENAME='ASTRA_2_5_1_WORKER.js'
KEYFILE='CLOUDFLARE_SETTINGS_PRIVATE.txt'
MARKER='ASTRA25_1_STAGE_ATTEMPT.txt'
OWNER_ID='ASTRA25_1_OWNER_ID_PRIVATE.txt'
RECEIPT='ASTRA25_1_SAFE_RECEIPT.json'
SUPPORTED_VARS=['ASTRA_BONUS_FENCE_KEY_ID','ASTRA_BONUS_FENCE_NOTICE_ACK','ASTRA_FORECAST_START_DAY','ASTRA_FORECAST_COMPACT_START_DAY','ASTRA_TAROT25_ENABLED','ASTRA_TAROT25_STORAGE_TEST_MODE','ASTRA_TAROT25_INDEPENDENT_TEST_MODE','ASTRA_TAROT_ART_ENABLED','ASTRA_TAROT25_QUESTIONS_TEST_MODE','STARS_SHOP_ENABLED','ASTRA_DAILY_DELIVERY_ENABLED','ASTRA_ECONOMY_V2_ENABLED','ASTRA_TELEGRAM_TEST_MODE']

def stop(msg):raise RuntimeError(msg)

def load_values(p):
    result={}
    for s in p.read_text(encoding='utf-8').splitlines():
        m=re.fullmatch(r'\s*([A-Z][A-Z0-9_]*)\s*=\s*(\S.*?)\s*',s)
        if m:result[m[1]]=m[2]
    if set(result)!=(set(SUPPORTED_VARS)|{'ASTRA_BONUS_FENCE_KEY'}):stop('Неожиданный набор переменных приватного релиза.')
    key=result.pop('ASTRA_BONUS_FENCE_KEY')
    if len(key)<40:stop('HMAC-секрет слишком короткий.')
    return key,result

def main():
    if os.name!='nt':stop('Программа для Windows владельца.')
    home=Path(__file__).resolve().parent
    if not home.name.startswith('build-') or home.parent.resolve()!=Path(os.environ['LOCALAPPDATA']).resolve()/'Astra25Release':
        stop('Скопируйте инструмент в исходную папку build-* вашего релиза.')
    if (home/MARKER).exists():stop('Попытка загрузки уже была. Повторное выполнение запрещено, сначала проверьте Cloudflare.')
    for p in (home/BASENAME,home/OWNER_ID,home/RECEIPT,home/KEYFILE,home/'SETUP_NEW_D1.sql'):
        if not p.is_file() or p.is_symlink():stop('Нет файла из проверенной подготовки: '+p.name)
    receipt=json.loads((home/RECEIPT).read_text(encoding='utf-8'))
    data=(home/BASENAME).read_bytes()
    hash_=hashlib.sha256(data).hexdigest()
    if receipt.get('worker_sha256')!=hash_ or receipt.get('parent_sha256')!=OLD_SHA or receipt.get('syntax')!='PASS':
        stop('Патч Astra 2.5.1 не совпадает с локальным receipt.')
    owner=(home/OWNER_ID).read_text(encoding='utf-8').strip()
    if not re.fullmatch(r'[1-9][0-9]{4,15}',owner):stop('Telegram owner ID некорректен.')
    key,vars_=load_values(home/KEYFILE)
    if hmac.new(key.encode(),b'astra:bonus-fence:v1:check:configuration',hashlib.sha256).hexdigest() not in (home/'SETUP_NEW_D1.sql').read_text(encoding='utf8'):
        stop('HMAC-ключ не совпадает с уже подготовленной D1.')
    if vars_['ASTRA_TELEGRAM_TEST_MODE']!='false' or vars_['ASTRA_TAROT25_QUESTIONS_TEST_MODE']!='false' or vars_['ASTRA_DAILY_DELIVERY_ENABLED']!='false' or vars_['ASTRA_ECONOMY_V2_ENABLED']!='false':
        stop('Непроверенные дополнительные функции должны оставаться OFF.')
    if not shutil.which('npx.cmd'):stop('Не установлен Node.js/npx.')
    vars_['STARS_SHOP_ENABLED']='true'
    vars_['ASTRA_OWNER_TELEGRAM_ID']=owner
    vars_['ASTRA_STARS_LIVE_APPROVED']='YES_I_AUTHORIZE_REAL_STARS'
    vars_['ASTRA_PAYMENT_POLICY_ACCEPTED']='APPROVED_SUPPORT_TERMS_RETENTION'
    cfg={'name':'opel-astra-bot','main':'./'+BASENAME,'compatibility_date':'2026-11-03','preview_urls':False,
         'triggers':{'crons':['* 6-7 * * *']},'observability':{'logs':{'enabled':True}},
         'vars':{'CHANNEL_USERNAME':'@BolsheNeSigma',**vars_},
         'd1_databases':[{'binding':'DB','database_name':'astra25-release','database_id':DB_ID}]}
    print('Astra 2.5.1 — загрузка НЕАКТИВНОЙ версии')
    print('Worker: opel-astra-bot | DB: astra25-release')
    print('SHA256:',hash_)
    print('Токен существующего бота, Cron, логи, webhook и приватные file_id сохраняются.')
    print('У владельца будут команды /admin и /grant; проверка прав — по Telegram user ID.')
    print('ВЕРСИЯ С МАГАЗИНОМ НЕ СТАНЕТ ПУБЛИЧНОЙ ДО ОТДЕЛЬНОГО ДЕПЛОЯ.')
    print('Сейчас новые данные D1 не меняются. Загружаем только код + его конфигурацию.')
    print('Если Wrangler предложит загрузить .txt, .sql или изменить Cron/даты/логи — ОТМЕНА N.')
    if input('\nВведите ЗАГРУЗИТЬ: ').strip()!='ЗАГРУЗИТЬ':print('Отменено');return
    with (home/MARKER).open('x',encoding='utf-8') as f:
        f.write('began='+datetime.now(timezone.utc).isoformat()+'\nsha256='+hash_+'\nno_public_traffic=yes\n')
    secretfile=None
    try:
        with tempfile.TemporaryDirectory(prefix='.astra251-stage-',dir=home) as temp:
            root=Path(temp)
            (root/BASENAME).write_bytes(data)
            (root/'wrangler.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            if {p.name for p in root.iterdir()}!={BASENAME,'wrangler.json'}:stop('В загрузке появились посторонние файлы.')
            fd,fn=tempfile.mkstemp(prefix='.astra251-hmac-',suffix='.json',dir=home)
            secretfile=Path(fn)
            with os.fdopen(fd,'w',encoding='utf-8') as f:json.dump({'ASTRA_BONUS_FENCE_KEY':key},f)
            key=''
            cmd=['npx.cmd','--yes','wrangler@4.162.0','versions','upload','--config',str(root/'wrangler.json'),
                 '--name','opel-astra-bot','--no-bundle','--keep-vars','--strict','--secrets-file',str(secretfile),
                 '--tag','astra25.1-stars-admin-tarotfix']
            rc=subprocess.run(cmd,cwd=root,check=False).returncode
            if rc:stop('Wrangler вернул '+str(rc)+'; не повторяйте загрузку автоматически.')
            print('\nУСПЕХ: версия Astra 2.5.1 загружена, но остаётся неактивной. Сохраните Version ID из вывода.')
    finally:
        if secretfile is not None:
            try:secretfile.unlink(missing_ok=True)
            except OSError:print('ВНИМАНИЕ! Не удалось удалить временный .astra251-hmac-*.json, удалите его вручную.')

if __name__=='__main__':
    try:main()
    except Exception as e:print('\nSTOP:',e)
    finally:
        try:input('\nEnter — закрыть окно...')
        except (EOFError,KeyboardInterrupt):pass
