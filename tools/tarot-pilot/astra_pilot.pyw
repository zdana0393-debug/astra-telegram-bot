"""Windows GUI. Opening the program makes NO network requests."""
import os
from pathlib import Path
import threading
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import unicodedata
from pilot_core import BOT, Stop, Telegram, Journal, load_card, load_owner_archive, owner_id, run_two


def label(value):
    return ''.join(c for c in str(value) if not unicodedata.category(c).startswith('C'))[:120]


class App:
    def __init__(self, window):
        self.window = window
        window.title('Астра — только два сообщения'); window.geometry('650x560')
        frame = ttk.Frame(window, padding=20); frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='Пилот THE FOOL: загрузка + повтор по file_id', font=('', 14)).pack(anchor='w')
        ttk.Label(frame, text='Только ваш личный чат. Worker, D1, webhook и деньги не меняются.\nОткрытие программы ничего не отправляет.', wraplength=600).pack(anchor='w', pady=12)
        self.id = tk.StringVar(); self.token = tk.StringVar(); self.own = tk.BooleanVar()
        ttk.Label(frame, text='Ваш личный числовой Telegram ID:').pack(anchor='w')
        self.id_entry = ttk.Entry(frame, textvariable=self.id, width=45); self.id_entry.pack(anchor='w', pady=5)
        ttk.Button(frame, text='Где посмотреть мой ID?', command=self.help_id).pack(anchor='w')
        self.check = ttk.Checkbutton(frame, text='Я сам проверил этот ID: это мой личный аккаунт', variable=self.own)
        self.check.pack(anchor='w', pady=10)
        ttk.Label(frame, text='Действующий токен существующего бота (ввод скрыт):').pack(anchor='w')
        self.token_entry = ttk.Entry(frame, textvariable=self.token, show='*', width=58); self.token_entry.pack(anchor='w', pady=5)
        ttk.Label(frame, text='Вместо ввода можно использовать ASTRA_PILOT_BOT_TOKEN.\nНе перевыпускайте токен и не отправляйте его в ChatGPT.\nЕсли действующего токена нет — остановитесь.', wraplength=600).pack(anchor='w', pady=6)
        self.button = ttk.Button(frame, text='Проверить бота и адресата — без сообщений', command=self.check_identity)
        self.button.pack(anchor='w', pady=10)
        self.status = tk.StringVar(value='Сначала проверка getMe/getChat. Затем отдельное подтверждение двух сообщений.')
        ttk.Label(frame, textvariable=self.status, wraplength=600).pack(anchor='w', pady=10)
        self.folder = (Path(os.environ['LOCALAPPDATA']) / 'Astra25Pilot') if os.name == 'nt' else Path.home() / '.local/share/astra25-pilot'
        ttk.Label(frame, text='Приватный журнал: ' + str(self.folder / 'pilot.json'), wraplength=600).pack(anchor='w')
        self.busy = False
        window.protocol('WM_DELETE_WINDOW', self.close)

    def close(self):
        if self.busy:
            messagebox.showinfo('Дождитесь результата', 'Запрос выполняется. Не закрывайте программу: исход отправки может стать неизвестным.')
        else: self.window.destroy()

    def help_id(self):
        messagebox.showinfo('Ваш ID', 'Telegram Desktop на компьютере → Настройки → Продвинутые настройки → Экспорт данных из Telegram.\n\nВыберите только информацию об аккаунте и JSON. В result.json найдите personal_information → user_id. Введите здесь только это число.\n\nНе загружайте экспорт/телефон в программу или ChatGPT. Тип private сам по себе не доказывает, что аккаунт ваш.')

    def lock(self):
        self.busy = True
        for widget in (self.button, self.id_entry, self.token_entry, self.check): widget.configure(state='disabled')

    def check_identity(self):
        try:
            target = owner_id(self.id.get())
            if not self.own.get(): raise Stop('Сначала подтвердите, что ID принадлежит вам.')
            folder = Path(__file__).resolve().parent
            if (folder / 'pilot-card.json').is_file():
                card, image = load_card(folder)
            else:
                manifest = filedialog.askopenfilename(title='Выберите ваш исходный manifest.json колоды', filetypes=[('Manifest JSON','*.json')])
                if not manifest: return
                archive = filedialog.askopenfilename(title='Выберите Astra_Tarot_78_Codex_Part_01_of_02.zip', filetypes=[('ZIP','*.zip')])
                if not archive: return
                card, image = load_owner_archive(manifest, archive)
            journal = Journal(self.folder)
            token = self.token.get().strip() or os.environ.get('ASTRA_PILOT_BOT_TOKEN', '').strip()
            client = Telegram(token, target)
        except Stop as exc:
            messagebox.showerror('STOP', str(exc)); return
        except Exception:
            messagebox.showerror('STOP', 'Пакет повреждён или приватный журнал недоступен. Ничего не отправлено.'); return
        self.token.set(''); self.lock(); self.status.set('Проверяем getMe/getChat. Фото ещё не отправляются…')
        def work():
            try:
                me, chat = client.verify()
                self.window.after(0, lambda: self.confirm(client, me, chat, card, image, journal))
            except Exception:
                self.window.after(0, lambda: self.fail('Проверка бота/адресата не пройдена. Фото не отправлялись. Проверьте ID, токен и сеть; журнал не удаляйте.'))
        threading.Thread(target=work, daemon=True).start()

    def fail(self, text):
        self.busy = False; self.status.set(text); messagebox.showerror('STOP — без автоматического повтора', text)

    def confirm(self, client, me, chat, card, image, journal):
        name = ' '.join(label(chat.get(k, '')) for k in ('first_name', 'last_name')).strip()
        username = '@' + label(chat['username']) if chat.get('username') else 'не указан'
        text = (f'Бот: @{BOT}\nbot_id: {me["id"]}\n\nАдресат: {name}\nusername: {username}\n'
                f'Ваш подтверждённый chat_id: {client.target}\nТип: private\n\n'
                'Разрешить ровно ДВА сообщения этому аккаунту?\n'
                '1. Загрузить прямую карту THE FOOL.\n2. Отправить её же по полученному file_id.\n\n'
                'Нет массовой загрузки, оплаты или изменения настроек бота.\n'
                'Если имя/ID не ваши — нажмите «Нет».')
        if not messagebox.askyesno('Окончательное разрешение на два сообщения', text, default='no'):
            self.busy = False; self.status.set('Отменено. Сообщения не отправлялись.'); return
        self.status.set('Пилот выполняется: максимум два сообщения, без повторов…')
        def work():
            try:
                result = run_two(client, card, image, journal, approved=True)
                def done():
                    self.busy = False
                    ids = ', '.join(str(a['message_id']) for a in result['acks'])
                    self.status.set('Пилот завершён. Проверены оба ACK, отправитель и адресат. message_id: ' + ids)
                    messagebox.showinfo('Готово', 'Два сообщения подтверждены. Настоящий file_id сохранён в приватном pilot.json.\n\nДальнейших загрузок нет. Токен в журнал не записан.')
                self.window.after(0, done)
            except Exception:
                self.window.after(0, lambda: self.fail('Пилот остановлен. Telegram мог уже принять сообщение. Проверьте личный чат и pilot.json. Не удаляйте журнал и не повторяйте пилот вслепую.'))
        threading.Thread(target=work, daemon=True).start()


if __name__ == '__main__':
    root = tk.Tk(); App(root); root.mainloop()
