"""Windows GUI: local files, explicit recipient/volume consent, durable continuation."""
import importlib.util
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import unicodedata
from bulk_core import ROOT, BOT, Stop, Telegram, Batch, exclusive, prepare_assets, items_from_manifest
from pilot_core import owner_id


def safe(value): return ''.join(c for c in str(value) if not unicodedata.category(c).startswith('C'))[:120]


class App:
    def __init__(self, window):
        self.window=window;window.title('Астра · загрузка78 карт');window.geometry('850x700')
        canvas=tk.Canvas(window,highlightthickness=0)
        scroll=ttk.Scrollbar(window,orient='vertical',command=canvas.yview)
        scroll.pack(side='right',fill='y');canvas.pack(side='left',fill='both',expand=True)
        canvas.configure(yscrollcommand=scroll.set)
        frame=ttk.Frame(canvas,padding=16);body=canvas.create_window((0,0),window=frame,anchor='nw')
        frame.bind('<Configure>',lambda event:canvas.configure(scrollregion=canvas.bbox('all')))
        canvas.bind('<Configure>',lambda event:canvas.itemconfigure(body,width=event.width))
        ttk.Label(frame,text='78 карт · 156 изображений · только ваш личный чат',font=('',14)).pack(anchor='w')
        ttk.Label(frame,text='Worker/D1/webhook и балансы не меняются. Токен не сохраняется.',wraplength=800).pack(anchor='w',pady=8)
        self.events=queue.Queue();self.busy=False;self.stop=threading.Event();self.assets=None;self.manifest=None
        self.root=(Path(os.environ['LOCALAPPDATA'])/'Astra25DeckLoader') if os.name=='nt' else Path.home()/'.local/share/astra25-deck-loader'
        self.files={};self.buttons=[]
        for key,title,kind in [('manifest','Manifest JSON','*.json'),('part1','ZIP Part_01','*.zip'),('part2','ZIP Part_02','*.zip'),('pilot','pilot.json (необязательно)','*.json')]:
            row=ttk.Frame(frame);row.pack(fill='x',pady=3)
            var=tk.StringVar();self.files[key]=var
            button=ttk.Button(row,text=title,width=29,command=lambda k=key,p=kind:self.choose(k,p));button.pack(side='left');self.buttons.append(button)
            ttk.Entry(row,textvariable=var,state='readonly').pack(side='left',fill='x',expand=True,padx=8)
        pilot=(Path(os.environ['LOCALAPPDATA'])/'Astra25Pilot/pilot.json') if os.name=='nt' else Path.home()/'.local/share/astra25-pilot/pilot.json'
        if pilot.is_file():self.files['pilot'].set(str(pilot))
        self.clear=ttk.Button(frame,text='Не использовать pilot.json',command=lambda:self.files['pilot'].set(''));self.clear.pack(anchor='w',pady=4)
        self.id=tk.StringVar();self.token=tk.StringVar();self.mine=tk.BooleanVar()
        row=ttk.Frame(frame);row.pack(fill='x',pady=4)
        ttk.Label(row,text='Ваш личный Telegram ID:').pack(side='left');self.id_entry=ttk.Entry(row,textvariable=self.id,width=25);self.id_entry.pack(side='left',padx=8)
        self.check=ttk.Checkbutton(frame,text='Я проверил: этот ID принадлежит моему личному аккаунту',variable=self.mine);self.check.pack(anchor='w')
        self.autofill()
        row=ttk.Frame(frame);row.pack(fill='x',pady=8)
        ttk.Label(row,text='Действующий токен:').pack(side='left');self.token_entry=ttk.Entry(row,textvariable=self.token,show='*',width=65);self.token_entry.pack(side='left',padx=8)
        ttk.Label(frame,text='Только сохранённый токен; не перевыпускайте его. Не присылайте токен в чат.',wraplength=800).pack(anchor='w')
        row=ttk.Frame(frame);row.pack(fill='x',pady=10)
        self.install=ttk.Button(row,text='Установить поддержку изображений',command=self.install_pillow);self.install.pack(side='left')
        self.prepare=ttk.Button(row,text='Подготовить колоду локально',command=self.prepare_clicked);self.prepare.pack(side='left',padx=8)
        row=ttk.Frame(frame);row.pack(fill='x',pady=3)
        self.start=ttk.Button(row,text='Проверить адресата / продолжить',command=self.start_clicked);self.start.pack(side='left')
        self.pause=ttk.Button(row,text='Остановить после текущего запроса',command=self.stop.set);self.pause.pack(side='left',padx=8)
        self.retry=ttk.Button(frame,text='Разобрать неизвестную отправку',command=lambda:self.start_clicked(resolve=True));self.retry.pack(anchor='w',pady=8)
        self.bar=ttk.Progressbar(frame,maximum=156);self.bar.pack(fill='x',pady=8)
        self.status=tk.StringVar(value='Выберите manifest и два ZIP. Сначала только локальная подготовка.')
        ttk.Label(frame,textvariable=self.status,wraplength=800).pack(anchor='w',pady=8)
        ttk.Label(frame,text='Приватные результаты: '+str(self.root),wraplength=800).pack(anchor='w')
        self.lockables=self.buttons+[self.clear,self.id_entry,self.token_entry,self.check,self.install,self.prepare,self.start,self.retry]
        window.protocol('WM_DELETE_WINDOW',self.close);window.after(100,self.poll)

    def autofill(self):
        try:
            p=Path(self.files['pilot'].get())
            if p.is_file():
                data=json.loads(p.read_text(encoding='utf-8'))
                if data.get('phase')=='completed' and type(data.get('chat_id')) is int and data['chat_id']>0:self.id.set(str(data['chat_id']))
        except Exception:pass

    def choose(self,key,kind):
        file=filedialog.askopenfilename(title='Выберите '+key,filetypes=[('Файл',kind)])
        if file:
            self.files[key].set(file)
            if key=='pilot':self.autofill()
            elif key=='manifest':self.assets=None;self.manifest=None

    def set_busy(self,value):
        self.busy=value
        for b in self.lockables:b.configure(state='disabled' if value else 'normal')
        self.pause.configure(state='normal' if value else 'disabled')

    def close(self):
        if self.busy:
            self.stop.set();messagebox.showinfo('Остановка','Запрошена остановка. Дождитесь текущего запроса и сохранения результата, затем закройте окно.')
        else:self.window.destroy()

    def poll(self):
        try:
            while True:
                kind,data=self.events.get_nowait()
                if kind=='status':self.status.set(data)
                elif kind=='progress':
                    state,counts,key=data;self.bar['value']=counts['done']
                    self.status.set(f"Подтверждено {counts['done']}/156 · {key} · "+('пауза по лимиту Telegram' if state=='waiting' else 'сохранено'))
                elif kind=='done':
                    self.set_busy(False);self.status.set(data);messagebox.showinfo('Астра',data)
                elif kind=='error':
                    self.set_busy(False);self.status.set(data);messagebox.showerror('STOP без слепых повторов',data)
                elif kind=='confirm':
                    prompt,reply=data;reply['answer']=messagebox.askyesno('Явное разрешение',prompt,default='no');reply['event'].set()
        except queue.Empty:pass
        self.window.after(100,self.poll)

    def confirm(self,text):
        reply={'event':threading.Event(),'answer':False};self.events.put(('confirm',(text,reply)))
        reply['event'].wait();return reply['answer']

    def background(self,fn):
        self.stop.clear();self.set_busy(True)
        def work():
            try:fn()
            except Stop as e:self.events.put(('error',str(e)))
            except Exception:self.events.put(('error','Операция остановлена. Приватные результаты сохранены; проверьте файлы, сеть и журнал. Токен не выводится.'))
        threading.Thread(target=work,daemon=True).start()

    def install_pillow(self):
        if not messagebox.askyesno('Установка зависимости','Установить Pillow13.0.0 с официального PyPI в ваш Python? Это не обращается к Telegram.',default='no'):return
        def work():
            env={k:v for k,v in os.environ.items() if not k.startswith('ASTRA_') and k not in ('PIP_EXTRA_INDEX_URL','PIP_INDEX_URL')}
            env['PIP_CONFIG_FILE']=os.devnull
            result=subprocess.run([sys.executable,'-m','pip','install','--user','--disable-pip-version-check','--index-url','https://pypi.org/simple','Pillow==13.0.0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            if result.returncode:raise Stop('Pillow не установлен. Проверьте наличие интернета и Python с pip; загрузка фото не запускалась.')
            self.events.put(('done','Поддержка изображений установлена. Закройте и заново откройте загрузчик, затем подготовьте колоду локально.'))
        self.background(work)

    def prepare_clicked(self):
        manifest=self.files['manifest'].get();parts=[self.files[k].get() for k in ('part1','part2')]
        if not manifest or not all(parts):messagebox.showerror('Файлы','Выберите manifest и оба ZIP.');return
        def work():
            self.events.put(('status','Локальная подготовка156 вариантов; Telegram не вызывается…'))
            with exclusive(self.root):
                assets,manifest_data=prepare_assets(manifest,parts,self.root)
                items_from_manifest(assets,manifest_data)
                self.assets,self.manifest=assets,manifest_data
            self.events.put(('done','Колода готова локально. Теперь можно проверить адресата; до отдельного подтверждения фото не отправляются.'))
        self.background(work)

    def start_clicked(self,resolve=False):
        try:
            if self.assets is None:raise Stop('Сначала нажмите «Подготовить колоду локально».')
            if not self.mine.get():raise Stop('Подтвердите, что ID принадлежит вам.')
            target=owner_id(self.id.get());token=self.token.get().strip() or os.environ.get('ASTRA_DECK_BOT_TOKEN','').strip() or os.environ.get('ASTRA_PILOT_BOT_TOKEN','').strip()
            client=Telegram(token,target);pilot=self.files['pilot'].get() or None
        except Stop as e:messagebox.showerror('STOP',str(e));return
        self.token.set('')
        def work():
            with exclusive(self.root):
                self.events.put(('status','Проверяем существующего бота и личный чат. Фото ещё не отправляются…'))
                me,chat=client.verify();rows=items_from_manifest(self.assets,self.manifest)
                batch=Batch(self.root,self.manifest,rows,client,pilot=pilot)
                counts=batch.counts();self.events.put(('progress',('accepted',counts,'проверка журнала')))
                recipient=f"Бот @{BOT} (id {me['id']})\nЛичный чат: {safe(chat.get('first_name',''))} {safe(chat.get('last_name',''))}\nchat_id: {target}\n"
                if resolve:
                    unknown=next((e for e in batch.state['entries'] if e['status']=='unknown'),None)
                    if not unknown:raise Stop('Нет неизвестных отправок. Подтверждённые карты повторно не загружаются.')
                    prompt=recipient+'\nНеизвестная отправка: '+unknown['key']+'\nПроверьте её подпись в личном чате.\nВы лично проверили чат и разрешаете ещё ОДНО сообщение этой карты? Возможен дубликат.\nЭто только разрешит повтор; запуск — кнопкой продолжения.'
                    if self.confirm(prompt):batch.authorize_retry(unknown['key'],approved=True)
                    self.events.put(('done','Разбор завершён. Для загрузки нажмите продолжение и подтвердите её объём.'));return
                if counts['unknown']:raise Stop('Есть неизвестная отправка. Сначала нажмите «Разобрать неизвестную отправку».')
                if counts['remaining']==0:
                    from bulk_core import save_json
                    save_json(self.root/'telegram-registry.json',batch.registry())
                    self.events.put(('done','Все156 file_id уже сохранены. Новых сообщений нет. Итоговый файл: telegram-registry.json'));return
                prompt=recipient+f"\nУже подтверждено: {counts['done']}/156.\nРазрешить {counts['remaining']} новых фотографий (прямые/перевёрнутые)?\nИнтервал не меньше2сек; остановка при неизвестном исходе.\nНет платежей и изменений Worker/D1/webhook."
                if not self.confirm(prompt):self.events.put(('done','Отменено. Фотографии не отправлялись.'));return
                result=batch.run(True,self.stop,lambda *data:self.events.put(('progress',data)))
                text='Готово:78 карт,156 file_id проверены и сохранены в telegram-registry.json.' if result=='completed' else 'Остановлено после текущего запроса. Подтверждённое сохранено; продолжение не загрузит его заново.'
                self.events.put(('done',text))
        self.background(work)


if __name__=='__main__':
    window=tk.Tk();App(window);window.mainloop()
