"""Offline assembly from an owner's private registry. Never calls an account/API."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import secrets
from datetime import datetime, timezone, timedelta
from bulk_core import ROOT, Stop, need, private_folder, save_json


def clean_env():
    return {k:v for k,v in os.environ.items() if not k.startswith('ASTRA_') and k not in ('NODE_OPTIONS','NODE_PATH')}


def node_path():
    choices=[shutil.which('node')]
    if os.name=='nt':
        choices += [str(Path(os.environ.get('ProgramFiles','C:/Program Files'))/'nodejs/node.exe')]
    for candidate in choices:
        if candidate and Path(candidate).is_file():
            try:result=subprocess.run([candidate,'--version'],capture_output=True,env=clean_env(),timeout=10)
            except (OSError,subprocess.TimeoutExpired):continue
            match=re.fullmatch(rb'v([0-9]+)\.[0-9]+\.[0-9]+\s*',result.stdout)
            if result.returncode==0 and match and int(match[1])>=22:return candidate
    raise Stop('Для сборки нужен Node.js22 или новее. Установите LTS с nodejs.org и снова откройте программу. Команды вводить не нужно.')


def inspect_registry(path):
    path=Path(path).absolute()
    need(path.is_file() and not path.is_symlink() and path.stat().st_nlink==1 and path.stat().st_size<=256*1024,'Выберите обычный telegram-registry.json, не ссылку.')
    for parent in path.parents:
        marker=parent/'.git'
        need(not marker.is_file() and not (marker/'HEAD').exists(),'Выберите приватный реестр вне Git.')
    def pairs(items):
        data={}
        for key,value in items:
            need(key not in data,'Повторные ключи JSON не допускаются.');data[key]=value
        return data
    registry=json.loads(path.read_text(encoding='utf-8'),object_pairs_hook=pairs)
    need(set(registry)=={'version','deck_version','art_version','source_manifest_sha256','bot_id','realm','cards'},'Нужен итоговый реестр загрузчика, без токена и лишних данных.')
    need(registry['version']=='astra-telegram-art-v1' and registry['deck_version']=='rws78-v1' and registry['realm']=='production','Неверная версия или окружение реестра.')
    need(type(registry['bot_id']) is int and 0<registry['bot_id']<2**52,'Нет корректного bot_id.')
    need(isinstance(registry['art_version'],str) and re.fullmatch('[A-Za-z0-9._-]{1,80}',registry['art_version']),'Неверная версия изображений.')
    need(isinstance(registry['source_manifest_sha256'],str) and re.fullmatch('[a-f0-9]{64}',registry['source_manifest_sha256']),'Нет SHA manifest.')
    known={c['card_id'] for c in json.loads((ROOT/'data/tarot25-art-contract07.json').read_text(encoding='utf-8'))}
    cards=registry['cards'];need(isinstance(cards,list) and len(cards)==78,'Реестр должен содержать78 карт.')
    seen=set();ids=set()
    for card in cards:
        need(isinstance(card,dict) and set(card)=={'card_id','upright','reversed'} and card['card_id'] in known and card['card_id'] not in seen,'Неверные или повторные card_id.')
        seen.add(card['card_id'])
        for mode in ('upright','reversed'):
            photo=card[mode];need(isinstance(photo,dict) and set(photo)=={'file_id'},'Нужен итоговый реестр, без дополнительных личных данных.')
            value=photo['file_id'];need(isinstance(value,str) and re.fullmatch('[A-Za-z0-9_-]{8,512}',value) and value not in ids,'Неверный или повторный file_id.')
            ids.add(value)
    return registry


ACL_REASONS={
    'PRIVATE_PATH_LINK':'папка или файл является ссылкой',
    'PRIVATE_OWNER_MISMATCH':'владелец отличается от текущего пользователя',
    'DIRECTORY_REQUIRED':'ожидалась новая папка',
    'PRIVATE_NEW_BUILD_REQUIRED':'изменять права разрешено только новой папке build-*',
    'PRIVATE_PARENT_MISMATCH':'папка находится не в ожидаемом каталоге сборки',
    'PRIVATE_BUILD_NOT_EMPTY':'папка уже содержит файлы; её права не изменялись',
    'ICACLS_REQUIRED':'штатная программа icacls недоступна',
    'PRIVATE_DACL_WRITE_FAILED':'Windows отказала в изменении DACL',
    'PRIVATE_DACL_COMPLEX':'обнаружено слишком много дополнительных разрешений',
    'PRIVATE_DACL_INHERITANCE':'не удалось отключить наследование папки',
    'PRIVATE_ACL_DENY':'в DACL остался запрет доступа',
    'PRIVATE_ACL_TOO_BROAD':'в DACL осталось разрешение посторонней стороне',
    'PRIVATE_ACL_INCOMPLETE':'не подтверждён полный доступ разрешённой стороне',
    'PRIVATE_ACL_PROPAGATION':'неподходящие правила распространения прав',
    'PRIVATE_ACL_CHILDREN':'защита не распространяется правильно на дочерние файлы',
    'PRIVATE_ACL_PRINCIPAL_MISSING':'нет доступа пользователя, SYSTEM или Administrators',
    'PRIVATE_DACL_UNEXPECTED':'не удалось прочитать или проверить DACL',
}


def safe_dacl_failure(result):
    # Never relay raw PowerShell/Node stderr: it may contain paths or private data.
    def text(value):return value.decode('ascii',errors='ignore') if isinstance(value,bytes) else str(value or '')
    output=(text(result.stdout)+'\n'+text(result.stderr)).replace('\r\n','\n')
    codes=re.findall(r'(?:ASTRA_DACL_ERROR:|STOP_WINDOWS_PRIVATE_ACL:)([A-Z_]+)\b',output)
    code=next((value for value in reversed(codes) if value in ACL_REASONS),'PRIVATE_DACL_UNEXPECTED')
    detail=''
    pattern=r'^ASTRA_DACL_DIAG explicit_allow=(\d{1,5}) explicit_deny=(\d{1,5}) inherited_extra=(\d{1,5}) everyone=(\d{1,5}) authenticated_users=(\d{1,5}) users=(\d{1,5}) other=(\d{1,5})$'
    match=re.search(pattern,output,re.MULTILINE)
    if match:
        a,d,i,e,auth,u,other=map(int,match.groups())
        detail=f' Дополнительные ACE до изменения: явные Allow={a}, Deny={d}, наследуемые={i}; Everyone={e}, Authenticated Users={auth}, Users={u}, прочие={other}.'
    return f'{code}: {ACL_REASONS[code]}.{detail} Приватные данные в диагностике не выводятся.'


def protect_release_folder(folder):
    if os.name!='nt':return
    try:
        result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/tarot-bulk-loader/protect_private_folder.ps1'),'-Path',str(folder),'-NewEmptyBuild','-ExpectedParent',str(Path(folder).parent)],capture_output=True,env=clean_env(),timeout=60,creationflags=subprocess.CREATE_NO_WINDOW)
    except subprocess.TimeoutExpired:
        raise Stop('PRIVATE_DACL_TIMEOUT: Windows не завершила проверку прав за 60 секунд. Реестр не копировался.') from None
    except OSError:
        raise Stop('PRIVATE_DACL_LAUNCH_FAILED: не удалось запустить локальный PowerShell. Реестр не копировался.') from None
    if result.returncode!=0:raise Stop('Сборка остановлена до копирования реестра. '+safe_dacl_failure(result))
    need(b'ASTRA_DACL_OK' in result.stdout.splitlines(),'DACL не подтверждена: нет завершающего ответа ASTRA_DACL_OK. Реестр не копировался.')


def build_private_release(registry_path, destination, node=None, release=False):
    registry=inspect_registry(registry_path)
    node=node or node_path()
    folder=Path(tempfile.mkdtemp(prefix='build-',dir=private_folder(destination)))
    worker=folder/'ASTRA_2_5_WORKER.js'
    env=clean_env()
    options={'capture_output':True,'env':env,'timeout':60}
    if os.name=='nt':options['creationflags']=subprocess.CREATE_NO_WINDOW
    try:
        protect_release_folder(folder)
        copied=folder/'telegram-registry.json'
        # This copy inherits the restricted Windows ACL, or0600 on POSIX.
        save_json(copied,registry)
        command=[node,str(ROOT/'scripts/build-tarot-art-private.mjs'),'--local-only','--registry',str(copied),'--output',str(worker)]
        if release:command+=['--release25']
        result=subprocess.run(command,**options)
        if result.returncode!=0:
            if b'STOP_WINDOWS_PRIVATE_ACL:' in result.stderr:raise Stop(safe_dacl_failure(result))
            raise Stop('Приватный сборщик остановился на проверке версии, путей или прав доступа. Ничего не устанавливалось.')
        metadata=json.loads(result.stdout)
        data=worker.read_bytes();sha=hashlib.sha256(data).hexdigest()
        need(metadata.get('sha256')==sha and metadata.get('deployed') is False,'Хеш сборки не подтверждён.')
        syntax=subprocess.run([node,'--input-type=module','--check'],input=data,**options)
        need(syntax.returncode==0,'Синтаксис Worker не прошёл проверку. Сборка остановлена.')
        if release:
            # New bonus privacy key, NOT a bot token. Local preparation only.
            # Keep this key + its matching SQL from the SAME build together.
            key=secrets.token_urlsafe(48)
            check=hmac.new(key.encode(),b'astra:bonus-fence:v1:check:configuration',hashlib.sha256).hexdigest()
            day=datetime.now(timezone(timedelta(hours=3))).date().isoformat()
            settings='PRIVATE — не отправлять в ChatGPT/GitHub. Не применять до финального разрешения.\n'
            settings+='Токен бота и существующие секреты не менять.\nНовый Secret:\nASTRA_BONUS_FENCE_KEY = '+key+'\n\nОбычные Variables:\n'
            values={'ASTRA_BONUS_FENCE_KEY_ID':'v1','ASTRA_BONUS_FENCE_NOTICE_ACK':'APPROVED_BONUS_FENCE_30_DAYS',
                    'ASTRA_FORECAST_START_DAY':day,'ASTRA_FORECAST_COMPACT_START_DAY':day,
                    'ASTRA_TAROT25_ENABLED':'true','ASTRA_TAROT25_STORAGE_TEST_MODE':'true','ASTRA_TAROT25_INDEPENDENT_TEST_MODE':'true',
                    'ASTRA_TAROT_ART_ENABLED':'true','ASTRA_TAROT25_QUESTIONS_TEST_MODE':'false','STARS_SHOP_ENABLED':'false',
                    'ASTRA_DAILY_DELIVERY_ENABLED':'false','ASTRA_ECONOMY_V2_ENABLED':'false','ASTRA_TELEGRAM_TEST_MODE':'false'}
            settings+='\n'.join(k+' = '+v for k,v in values.items())+'\n'
            settings+='\nD1: только новая astra25-release. Использовать ключ и SETUP_NEW_D1.sql из одной папки.\nВсе значения выше — подготовка для проверки/разрешения, не автоматическое включение.\n'
            setup=("-- PRIVATE. Only NEW astra25-release, after CLEAN_SCHEMA, with zero profiles.\n"
                   "-- Matches the bonus privacy secret from THIS build. No bot token or balance writes.\n"
                   "INSERT INTO astra_bonus_keys26(key_id,check_hmac,added_at)\n"
                   "SELECT 'v1',CASE WHEN NOT EXISTS(SELECT 1 FROM astra_users) AND NOT EXISTS(SELECT 1 FROM astra_bonus_keys26) AND EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1 AND activated=0 AND enabled=0) THEN '"+check+"' ELSE '' END,unixepoch()\n"
                   "WHERE NOT EXISTS(SELECT 1 FROM astra_bonus_keys26 WHERE key_id='v1' AND check_hmac='"+check+"');\n"
                   "UPDATE astra_patch26 SET active_key_id='v1',notice_approved=1 WHERE singleton=1 AND activated=0 AND enabled=0 AND NOT EXISTS(SELECT 1 FROM astra_users) AND EXISTS(SELECT 1 FROM astra_bonus_keys26 WHERE key_id='v1' AND check_hmac='"+check+"');\n"
                   "-- Tarot activation still requires a separate controlled approval.\n")
            for name,content in [('CLOUDFLARE_SETTINGS_PRIVATE.txt',settings),('SETUP_NEW_D1.sql',setup)]:
                fd=os.open(folder/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
                with os.fdopen(fd,'w',encoding='utf-8') as stream:stream.write(content)
        receipt={'version':'astra25-private-release-receipt-v1','cards':78,'images':156,
                 'worker_sha256':sha,'worker_bytes':len(data),'syntax':'PASS',
                 'release_profile':metadata.get('release_profile','local-candidate'),
                 'deployed':False,'art_default':'OFF','public_ready':False,
                 'cloudflare_acceptance':'NOT_TESTED','production_inventory':'NOT_TESTED',
                 'contains_no_file_ids_tokens_or_user_ids':True}
        save_json(folder/'safe-build-receipt.json',receipt)
        return folder,receipt
    except Exception:
        # Do not leave an unverified Worker looking like an installable result.
        if worker.exists():worker.unlink()
        raise
