"""Offline assembly from an owner's private registry. Never calls an account/API."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
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


def protect_release_folder(folder):
    if os.name!='nt':return
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/tarot-bulk-loader/protect_private_folder.ps1'),'-Path',str(folder)],capture_output=True,env=clean_env(),timeout=60,creationflags=subprocess.CREATE_NO_WINDOW)
    need(result.returncode==0,'Не удалось защитить локальную папку Windows DACL. Сборка остановлена до копирования реестра. Запуск от администратора не требуется.')


def build_private_release(registry_path, destination, node=None):
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
        result=subprocess.run([node,str(ROOT/'scripts/build-tarot-art-private.mjs'),'--local-only','--registry',str(copied),'--output',str(worker)],**options)
        need(result.returncode==0,'Приватный сборщик остановился на проверке версии, путей или прав доступа. Ничего не устанавливалось.')
        metadata=json.loads(result.stdout)
        data=worker.read_bytes();sha=hashlib.sha256(data).hexdigest()
        need(metadata.get('sha256')==sha and metadata.get('deployed') is False,'Хеш сборки не подтверждён.')
        syntax=subprocess.run([node,'--input-type=module','--check'],input=data,**options)
        need(syntax.returncode==0,'Синтаксис Worker не прошёл проверку. Сборка остановлена.')
        receipt={'version':'astra25-private-release-receipt-v1','cards':78,'images':156,
                 'worker_sha256':sha,'worker_bytes':len(data),'syntax':'PASS',
                 'deployed':False,'art_default':'OFF','public_ready':False,
                 'cloudflare_acceptance':'NOT_TESTED','production_inventory':'NOT_TESTED',
                 'contains_no_file_ids_tokens_or_user_ids':True}
        save_json(folder/'safe-build-receipt.json',receipt)
        return folder,receipt
    except Exception:
        # Do not leave an unverified Worker looking like an installable result.
        if worker.exists():worker.unlink()
        raise
