"""Local restore and0032 rehearsal only. No Cloudflare, Telegram or credentials."""
import json,os,secrets,shutil,subprocess
from pathlib import Path
from private_tools import ROOT,private_path,need

def verify_file(source):
    source=private_path(source);parent=source.parent.parent
    folder=parent/('build-astra251-restore-'+secrets.token_hex(8));folder.mkdir(mode=0o700)
    if os.name=='nt':
        r=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/tarot-bulk-loader/protect_private_folder.ps1'),'-Path',str(folder),'-NewEmptyBuild','-ExpectedParent',str(parent)],capture_output=True,timeout=30);need(r.returncode==0,'PRIVATE_RESTORE_DACL_FAILED')
    private_path(folder);node=shutil.which('node');need(node is not None,'NODE_REQUIRED')
    r=subprocess.run([node,'--experimental-sqlite',str(ROOT/'scripts/rehearse-astra251-export.mjs'),str(source),str(folder)],capture_output=True,timeout=120)
    try:report=json.loads(r.stdout)
    except (ValueError,TypeError):raise RuntimeError('LOCAL_RESTORE_TOOL_FAILED')from None
    if r.returncode!=0:
        step=report.get('step','UNKNOWN');code=report.get('code','UNKNOWN');check=report.get('check')
        if isinstance(check,str)and check.replace('/','_').replace('_','').isalnum():code+='_CHECK_'+check.replace('/','_').upper()
        need(False,'LOCAL_'+step+'_'+code if all(isinstance(v,str)and v.replace('_','').isalnum()for v in(step,code))else'LOCAL_RESTORE_TOOL_FAILED')
    need(report.get('status')=='LOCAL_RESTORE_AND_0032_PASS','LOCAL_RESTORE_NOT_CONFIRMED')
    return folder,report
if __name__=='__main__':
    try:
        import tkinter as tk
        from tkinter import filedialog,messagebox
        root=tk.Tk();root.withdraw();root.attributes('-topmost',True)
        print('Проверка резервной копии. Только локально. Выберите SQL-файл.',flush=True)
        f=filedialog.askopenfilename(parent=root,title='Выберите ASTRA251_BACKUP_BEFORE_0032.sql',filetypes=[('SQL','*.sql')])
        if f:
            print('Проверяю порядок SQL, восстановление и миграцию0032. До двух минут…',flush=True)
            folder,r=verify_file(f);messagebox.showinfo('Проверка пройдена',f"Локальное восстановление и0032: PASS\nОбъекты:286 →323\nПользователей:{r['users']}; пыли:{r['total_dust']}\nСтарые таблицы сохранены.\nРезультат:{folder}\n\nРабочая база и бот не изменены.",parent=root)
    except Exception as e:
        code=str(e)if isinstance(e,RuntimeError)and str(e).replace('_','').isalnum()else'LOCAL_VERIFICATION_FAILED'
        print('STOP:',code,flush=True);input('Enter — закрыть окно…')
