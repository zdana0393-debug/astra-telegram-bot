"""Local durable 156-photo loader. No Worker/D1/payments, no automatic UNKNOWN retry."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/tarot-pilot'))
from pilot_core import BOT, Stop, Telegram, positive, photo_ack

MODES = ('upright', 'reversed')
FILE_ID = re.compile(r'[A-Za-z0-9_-]{8,512}')


def need(ok, message):
    if not ok: raise Stop(message)


def digest(file): return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def private_folder(folder):
    folder = Path(folder).absolute()
    need(folder.resolve() == folder, 'Приватная папка не должна быть ссылкой.')
    for parent in [folder, *folder.parents]:
        marker = parent / '.git'
        need(not marker.is_file() and not (marker / 'HEAD').exists(), 'Личные данные нельзя хранить в Git.')
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    return folder


def save_json(path, data):
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix='.astra-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.flush(); os.fsync(stream.fileno())
        if os.name == 'nt':
            import ctypes
            move=ctypes.WinDLL('kernel32',use_last_error=True).MoveFileExW
            move.argtypes=[ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_uint]
            move.restype=ctypes.c_int
            # Atomic replacement with a write-through request to Windows.
            if not move(str(temporary),str(path),0x1|0x8):raise ctypes.WinError(ctypes.get_last_error())
        else:
            os.replace(temporary, path)
            directory=os.open(path.parent,os.O_RDONLY)
            try:os.fsync(directory)
            finally:os.close(directory)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


@contextmanager
def exclusive(folder):
    """OS lock releases on process death, including Windows. Never delete stale locks."""
    path = private_folder(folder) / 'bulk.lock'
    need(not path.is_symlink(), 'Небезопасный lock-файл.')
    with open(path, 'a+b') as stream:
        if stream.tell() == 0: stream.write(b'0'); stream.flush()
        stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise Stop('Загрузчик уже работает в другом окне. Закройте предыдущее окно.') from None
        try: yield
        finally:
            if os.name == 'nt':
                import msvcrt
                stream.seek(0); msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def prepare_assets(manifest, parts, folder):
    """Reuse admitted cache; importer already implements SHA/ZIP/rotation rules."""
    try:
        from PIL import Image
    except ImportError:
        raise Stop('Нажмите «Установить поддержку изображений», затем подготовьте колоду.') from None
    need(Image.__version__ == '13.0.0', 'Нужен Pillow13.0.0. Нажмите кнопку установки поддержки изображений.')
    manifest = Path(manifest)
    need(manifest.stat().st_size <= 1024 * 1024, 'Manifest слишком велик.')
    key = digest(manifest)
    cache = private_folder(folder) / 'assets'
    cache.mkdir(exist_ok=True, mode=0o700)
    output = cache / key
    if not output.exists():
        need(len(parts) == 2 and all(Path(p).is_file() for p in parts), 'Выберите оба ZIP колоды.')
        command = [sys.executable, str(ROOT / 'scripts/import-tarot-art-private.py'), '--local-only',
                   '--manifest', str(manifest.absolute()), '--output', str(output)]
        for part in parts: command += ['--archive', str(Path(part).absolute())]
        env = {k:v for k,v in os.environ.items() if k not in ('ASTRA_PILOT_BOT_TOKEN','ASTRA_DECK_BOT_TOKEN')}
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        need(result.returncode == 0, 'Подготовка карт не прошла. Проверьте исходные manifest и два ZIP; файлы не перезаписывались.')
    private = json.loads((output / 'manifest.json').read_text(encoding='utf-8'))
    need(private.get('source_manifest_sha256') == key and private.get('deck_version') == 'rws78-v1', 'Кэш другой колоды.')
    return output, private


def items_from_manifest(assets, manifest):
    names = json.loads((ROOT / 'data/tarot25-art-contract07.json').read_text(encoding='utf-8'))
    known = {c['card_id'] for c in names}
    cards = manifest.get('cards', [])
    need(len(cards) == 78 and {c['card_id'] for c in cards} == known, 'Нужны точные78 уникальных card_id.')
    rows = []
    for card in cards:
        for mode in MODES:
            filename = card['card_id'] + '-' + mode + '.jpg'
            need(card.get('telegram_' + mode) == filename and re.fullmatch('[a-f0-9]{64}',card.get('sha256_' + mode,'')), 'Неверная производная карты.')
            rows.append({'key':card['card_id'] + '/' + mode,'card_id':card['card_id'],'orientation':mode,
                         'sha256':card['sha256_' + mode],'path':str(Path(assets) / 'derivatives' / filename)})
    need(len({r['sha256'] for r in rows}) == 156, 'Обнаружены одинаковые изображения разных карт/ориентаций.')
    return rows


def valid_ack(ack):
    return (isinstance(ack,dict) and positive(ack.get('message_id')) and
            isinstance(ack.get('file_id'),str) and FILE_ID.fullmatch(ack['file_id']) and
            isinstance(ack.get('file_unique_id'),str) and re.fullmatch('[A-Za-z0-9_-]{4,512}',ack['file_unique_id']) and
            positive(ack.get('width')) and positive(ack.get('height')))


class Batch:
    """Caller holds exclusive() across loading state and network execution."""
    def __init__(self, folder, manifest, rows, client, pilot=None):
        self.folder = private_folder(folder); self.file = self.folder / 'bulk-state.json'
        self.rows = rows; self.client = client
        need(client.verified == (client.bot_id,client.target), 'Сначала подтвердите бота и личный чат.')
        if self.file.exists():
            need(not self.file.is_symlink(), 'Небезопасный журнал.')
            self.state = json.loads(self.file.read_text(encoding='utf-8'))
            self.validate(manifest)
            for entry in self.state['entries']:
                if entry['status'] == 'uploading':
                    entry['status'] = 'unknown'; entry['last_error'] = 'interrupted_after_send_started'
            fool=next(e for e in self.state['entries'] if e['key']=='major-00/upright')
            if pilot and fool['status']=='pending' and not fool.get('attempts'):
                self.import_pilot(pilot)
            self.validate(manifest)
            self.save()
        else:
            self.state = {'version':'astra-deck-batch-v1','bot_id':client.bot_id,'chat_id':client.target,
                          'bot_username':BOT,'realm':'production','art_version':manifest['art_version'],
                          'source_manifest_sha256':manifest['source_manifest_sha256'],
                          'entries':[{'key':r['key'],'sha256':r['sha256'],'status':'pending','attempts':[]} for r in rows]}
            if pilot: self.import_pilot(pilot)
            self.validate(manifest); self.save()

    def validate(self, manifest):
        s = self.state
        need(s.get('version') == 'astra-deck-batch-v1' and s.get('bot_id') == self.client.bot_id
             and s.get('chat_id') == self.client.target and s.get('realm') == 'production'
             and s.get('source_manifest_sha256') == manifest['source_manifest_sha256']
             and s.get('art_version') == manifest['art_version'], 'Журнал принадлежит другому боту, получателю или колоде.')
        need(len(s.get('entries',[])) == len(self.rows) == 156, 'Неполный журнал.')
        ids = set(); unique = set()
        for entry, row in zip(s['entries'],self.rows):
            need(entry.get('key') == row['key'] and entry.get('sha256') == row['sha256'] and
                 entry.get('status') in ('pending','uploading','acknowledged','unknown','rate_limited'), 'Повреждён журнал загрузки.')
            if entry['status'] == 'acknowledged':
                ack = entry.get('ack')
                need(valid_ack(ack) and ack['file_id'] not in ids and ack['file_unique_id'] not in unique, 'Некорректный или повторный file_id в журнале.')
                ids.add(ack['file_id']); unique.add(ack['file_unique_id'])

    def import_pilot(self, path):
        p = json.loads(Path(path).read_text(encoding='utf-8')); acks = p.get('acks',[])
        need(p.get('version') == 'astra-tarot-pilot-v1' and p.get('phase') == 'completed'
             and p.get('bot_id') == self.client.bot_id and p.get('chat_id') == self.client.target
             and p.get('card_id') == 'major-00' and p.get('orientation') == 'upright'
             and p.get('art_version') == self.state['art_version'] and len(acks) == 2
             and all(valid_ack(a) for a in acks) and acks[0]['message_id'] != acks[1]['message_id']
             and acks[0]['file_unique_id'] == acks[1]['file_unique_id']
             and (acks[0]['width'],acks[0]['height']) == (acks[1]['width'],acks[1]['height']), 'pilot.json не подтверждает этот бот/чат/Шута. Уберите файл пилота или выберите правильный.')
        entry = next(e for e in self.state['entries'] if e['key'] == 'major-00/upright')
        need(p.get('sha256') == entry['sha256'], 'Изображение Шута отличается от успешного пилота.')
        entry.update(status='acknowledged',ack=acks[-1],source='successful_pilot')

    def save(self): save_json(self.file,self.state)
    def counts(self):
        entries = self.state['entries']
        return {'done':sum(e['status']=='acknowledged' for e in entries),
                'unknown':sum(e['status']=='unknown' for e in entries),
                'remaining':sum(e['status']!='acknowledged' for e in entries)}

    def authorize_retry(self, key, approved=False):
        need(approved is True, 'Нет разрешения на дополнительную отправку.')
        entry = next((e for e in self.state['entries'] if e['key'] == key),None)
        need(entry and entry['status'] == 'unknown', 'Нет неизвестной отправки для разбора.')
        entry.setdefault('resolutions',[]).append({'at':time.time(),'decision':'owner_checked_chat_explicit_retry_duplicate_possible'})
        entry['status'] = 'pending'; self.save()

    def run(self, approved, stop, progress, now=time.time, wait=None):
        need(approved is True, 'Нет окончательного разрешения на объём загрузки.')
        need(self.counts()['unknown'] == 0, 'Сначала разберите неизвестную отправку; автоматический повтор запрещён.')
        wait = wait or (lambda seconds: stop.wait(seconds))
        last_attempt = None; rate_errors = 0
        for row, entry in zip(self.rows,self.state['entries']):
            if entry['status'] == 'acknowledged': continue
            while True:
                if stop.is_set(): return 'paused'
                deadline = max(entry.get('not_before',0), self.state.get('next_send_at',0), (last_attempt+2 if last_attempt is not None else 0))
                while now() < deadline:
                    progress('waiting',self.counts(),row['key'])
                    if wait(min(1,deadline-now())) or stop.is_set(): return 'paused'
                if stop.is_set(): return 'paused'
                path = Path(row['path'])
                need(path.is_file() and not path.is_symlink() and path.stat().st_size < 10*1024*1024, 'Файл карты недоступен.')
                image = path.read_bytes(); need(hashlib.sha256(image).hexdigest() == row['sha256'],'Карта изменилась. STOP.')
                entry['status']='uploading'; entry.setdefault('attempts',[]).append({'at':now(),'status':'sending'})
                self.state['next_send_at']=now()+2
                self.save()  # Durable before HTTP; failure here sends nothing.
                self.client._photo_allowance=1; last_attempt=now()
                try:
                    result=self.client.call('sendPhoto',{'chat_id':self.client.target,
                        'caption':'Астра · '+row['card_id']+' · '+row['orientation'],'protect_content':True},image=image,
                        image_filename=row['card_id']+'-'+row['orientation']+'.jpg')
                    ack=photo_ack(result,self.client.target,self.client.bot_id)
                    existing=[e['ack'] for e in self.state['entries'] if e['status']=='acknowledged']
                    need(all(a['file_id']!=ack['file_id'] and a['file_unique_id']!=ack['file_unique_id'] for a in existing),'Telegram вернул повторный ID для другой карты.')
                    entry.update(status='acknowledged',ack=ack,source='uploaded')
                    self.state['next_send_at']=now()+2
                    entry['attempts'][-1]['status']='acknowledged'; self.save()
                    progress('accepted',self.counts(),row['key']); break
                except Exception as exc:
                    if isinstance(exc,Stop) and exc.code==429:
                        seconds=getattr(exc,'retry_after',60)
                        seconds=seconds if type(seconds) is int and 0 < seconds <=86400 else 60
                        entry.update(status='rate_limited',not_before=now()+seconds+1)
                        entry['attempts'][-1]['status']='rejected_429'; rate_errors+=1; self.save()
                        if rate_errors>=3: raise Stop('Три ответа429: загрузка приостановлена до указанного времени.') from None
                        continue
                    entry['status']='unknown'; entry['attempts'][-1]['status']='unknown'; self.save()
                    raise Stop('Неизвестный результат '+row['key']+'. Загрузка остановлена. Проверьте личный чат, затем используйте кнопку разбора.') from None
        registry=self.registry(); save_json(self.folder/'telegram-registry.json',registry)
        return 'completed'

    def registry(self):
        need(self.counts()['done']==156,'Реестр ещё не полон.')
        cards=[]
        for i in range(0,156,2):
            card={'card_id':self.rows[i]['card_id']}
            for mode, entry in zip(MODES,self.state['entries'][i:i+2]): card[mode]={'file_id':entry['ack']['file_id']}
            cards.append(card)
        registry={'version':'astra-telegram-art-v1','deck_version':'rws78-v1','art_version':self.state['art_version'],
                  'source_manifest_sha256':self.state['source_manifest_sha256'],'bot_id':self.client.bot_id,
                  'realm':'production','cards':cards}
        ids=[c[m]['file_id'] for c in cards for m in MODES]
        need(len(cards)==78 and len(set(ids))==156 and all(FILE_ID.fullmatch(x) for x in ids),'Неверный итоговый реестр.')
        return registry
