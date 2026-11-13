"""Two-message, owner-confirmed pilot. Standard library only; no background retries."""
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
import tempfile
import time
import urllib.error
import urllib.request
import uuid

BOT = 'LaDa_Iskra_Opel_Astrabot'
LIMIT = 512 * 1024


class Stop(Exception):
    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


def need(ok, message):
    if not ok:
        raise Stop(message)


def positive(value):
    return type(value) is int and 0 < value < 2**52


def owner_id(text):
    need(bool(re.fullmatch(r'[1-9][0-9]{0,15}', text.strip())), 'Нужен ваш положительный числовой Telegram ID.')
    value = int(text.strip())
    need(positive(value), 'Telegram ID вне допустимого диапазона.')
    return value


def load_card(folder):
    folder = Path(folder)
    meta = json.loads((folder / 'pilot-card.json').read_text(encoding='utf-8'))
    need(meta.get('card_id') == 'major-00' and meta.get('orientation') == 'upright'
         and meta.get('deck_version') == 'rws78-v1', 'Неверная карта в пакете.')
    path = folder / 'major-00-upright.jpg'
    need(path.is_file() and not path.is_symlink() and path.stat().st_size < 10 * 1024 * 1024, 'Файл карты недоступен.')
    data = path.read_bytes()
    need(data.startswith(b'\xff\xd8\xff') and hashlib.sha256(data).hexdigest() == meta.get('sha256'), 'SHA256 карты не совпал. STOP.')
    return meta, data


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Telegram:
    def __init__(self, token, target, exchange=None):
        need(bool(re.fullmatch(r'[1-9][0-9]{4,15}:[A-Za-z0-9_-]{20,200}', token)), 'Неверный формат токена. Не перевыпускайте действующий токен.')
        need(positive(target), 'Неверный личный chat_id.')
        self._token, self.target = token, target
        self.bot_id = int(token.split(':')[0])
        self._exchange = exchange or self._https
        self.verified = None
        self._photo_allowance = 0

    def _https(self, method, content, content_type):
        # No system proxies, redirects, custom hosts, logging, or retry handlers.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
                                            urllib.request.HTTPSHandler(context=ssl.create_default_context()))
        request = urllib.request.Request('https://api.telegram.org/bot' + self._token + '/' + method,
                                         data=content, headers={'Content-Type': content_type}, method='POST')
        try:
            with opener.open(request, timeout=30) as response:
                need(response.status == 200, 'Telegram не подтвердил запрос.')
                data = response.read(LIMIT + 1)
                need(len(data) <= LIMIT, 'Ответ Telegram слишком велик.')
                return json.loads(data)
        except urllib.error.HTTPError as exc:
            # Never expose exception URL/body: the URL contains the token.
            raise Stop('Telegram отклонил запрос. Автоматического повтора нет.', int(exc.code)) from None
        except Stop:
            raise
        except Exception:
            raise Stop('Ответ сети неизвестен. Не повторяйте отправку: проверьте личный чат.') from None

    def call(self, method, body, image=None):
        need(method in ('getMe', 'getChat', 'sendPhoto'), 'Запрещённый метод API.')
        if method != 'getMe':
            need(type(body.get('chat_id')) is int and body['chat_id'] == self.target, 'Запрос другому получателю запрещён.')
        if method == 'sendPhoto':
            need(self.verified == (self.bot_id, self.target) and self._photo_allowance > 0, 'Отправка не разрешена или лимит двух сообщений исчерпан.')
            self._photo_allowance -= 1  # An uncertain attempt consumes its allowance too.
        if image is None:
            content = json.dumps(body).encode('utf-8'); kind = 'application/json'
        else:
            need(method == 'sendPhoto' and type(image) is bytes, 'Недопустимая загрузка.')
            boundary = 'astra' + uuid.uuid4().hex
            parts = []
            for key, value in body.items():
                text = str(value).lower() if isinstance(value, bool) else str(value)
                parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{text}\r\n').encode())
            parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="major-00-upright.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode() + image + b'\r\n')
            content = b''.join(parts) + f'--{boundary}--\r\n'.encode()
            kind = 'multipart/form-data; boundary=' + boundary
        result = self._exchange(method, content, kind)
        need(isinstance(result, dict) and result.get('ok') is True, 'Telegram не подтвердил запрос.')
        return result.get('result')

    def verify(self):
        self.verified = None
        me = self.call('getMe', {})
        need(isinstance(me, dict) and me.get('is_bot') is True and positive(me.get('id')) and me.get('id') == self.bot_id
             and str(me.get('username', '')).lower() == BOT.lower(), 'Токен принадлежит другому боту. STOP.')
        chat = self.call('getChat', {'chat_id': self.target})
        need(isinstance(chat, dict) and positive(chat.get('id')) and chat.get('id') == self.target and chat.get('type') == 'private', 'Адресат не совпал или это не личный чат. STOP.')
        self.verified = (self.bot_id, self.target)
        return me, chat


def photo_ack(message, target, bot_id):
    need(isinstance(message, dict) and positive(message.get('message_id')), 'Нет подтверждённого message_id.')
    need(positive(message.get('chat', {}).get('id')) and message['chat']['id'] == target and message['chat'].get('type') == 'private', 'Неверный получатель в ответе Telegram.')
    need(message.get('from', {}).get('id') == bot_id and message['from'].get('is_bot') is True, 'Неверный отправитель в ответе Telegram.')
    photos = message.get('photo')
    need(isinstance(photos, list) and bool(photos), 'Нет подтверждения фотографии.')
    for p in photos:
        need(isinstance(p, dict) and positive(p.get('width')) and positive(p.get('height'))
             and isinstance(p.get('file_id'), str) and re.fullmatch(r'[A-Za-z0-9_-]{8,512}', p['file_id'])
             and isinstance(p.get('file_unique_id'), str) and re.fullmatch(r'[A-Za-z0-9_-]{4,512}', p['file_unique_id']), 'Неполный ответ фотографии.')
    best = max(photos, key=lambda p: p['width'] * p['height'])
    return {'message_id': message['message_id'], **{k: best[k] for k in ('file_id', 'file_unique_id', 'width', 'height')}}


class Journal:
    def __init__(self, folder):
        self.folder = Path(folder).absolute()
        need(self.folder.resolve() == self.folder, 'Приватная папка не должна быть ссылкой.')
        for p in [self.folder, *self.folder.parents]:
            g = p / '.git'
            need(not g.is_file() and not (g / 'HEAD').exists(), 'Реестр нельзя сохранять внутри Git.')
        self.folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.file = self.folder / 'pilot.json'
        need(not self.file.exists() and not self.file.is_symlink(), 'Пилот уже запускался. Повтор запрещён; проверьте приватный журнал и чат.')

    def begin(self, data):
        # Exclusive creation also blocks two simultaneous applications.
        fd = os.open(self.file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            json.dump(data, out, ensure_ascii=False, indent=2); out.flush(); os.fsync(out.fileno())

    def save(self, data):
        fd, name = tempfile.mkstemp(prefix='.pilot-', dir=self.folder)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as out:
                json.dump(data, out, ensure_ascii=False, indent=2); out.flush(); os.fsync(out.fileno())
            os.replace(name, self.file)
        finally:
            if os.path.exists(name): os.unlink(name)


def run_two(client, card, image, journal, *, approved=False, pause=time.sleep):
    need(approved is True, 'Нет явного разрешения на два сообщения.')
    need(client.verified == (client.bot_id, client.target), 'Бот и адресат не подтверждены.')
    # Recheck local bytes after user confirmation, before any send.
    need(hashlib.sha256(image).hexdigest() == card['sha256'], 'Изображение изменилось.')
    state = {'version': 'astra-tarot-pilot-v1', 'bot_id': client.bot_id, 'bot_username': BOT,
             'chat_id': client.target, 'card_id': 'major-00', 'orientation': 'upright',
             'art_version': card['art_version'], 'sha256': card['sha256'], 'phase': 'upload_sending', 'acks': []}
    journal.begin(state)  # Fail closed if it cannot be durably written.
    client._photo_allowance = 2
    try:
        first = client.call('sendPhoto', {'chat_id': client.target, 'caption': 'Астра · THE FOOL · пилот 1/2', 'protect_content': True}, image=image)
        ack = photo_ack(first, client.target, client.bot_id)
        state['acks'].append(ack); state['phase'] = 'upload_accepted'; journal.save(state)
        pause(2)
        state['phase'] = 'reuse_sending'; journal.save(state)
        second = client.call('sendPhoto', {'chat_id': client.target, 'photo': ack['file_id'],
                             'caption': 'Астра · THE FOOL · повтор по file_id 2/2', 'protect_content': True})
        reused = photo_ack(second, client.target, client.bot_id)
        need(reused['message_id'] != ack['message_id'] and reused['file_unique_id'] == ack['file_unique_id']
             and (reused['width'], reused['height']) == (ack['width'], ack['height']), 'Повтор не подтвердил ту же фотографию.')
        state['acks'].append(reused); state['phase'] = 'completed'; journal.save(state)
        return state
    except Exception:
        # An ACK or the last disk write may have been lost. Never guess/retry.
        state['phase'] = 'stopped_unknown'
        try: journal.save(state)
        except Exception: pass
        raise Stop('Пилот остановлен без повторов. Telegram мог принять сообщение. Проверьте личный чат и приватный журнал.') from None
