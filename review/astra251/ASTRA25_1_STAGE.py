"""OFFLINE stage plan only. The previous unsafe auto-upload implementation is removed."""
from private_tools import stage_plan
if __name__=='__main__':
    try:
        import tkinter as tk
        from tkinter import filedialog,messagebox
        root=tk.Tk();root.withdraw()
        folder=filedialog.askdirectory(title='Выберите новую приватную папку Astra 2.5.1')
        if folder:
            snapshot=filedialog.askopenfilename(title='Текущий полный проверенный снимок настроек Cloudflare (PRIVATE JSON)',filetypes=[('JSON','*.json')])
            if snapshot:
                bootstrap=messagebox.askyesno('Режим','Подготовить первый закрытый запуск БЕЗ прав администратора?\nДа: bootstrap. Нет: требуется подписанное подтверждение владельца.')
                stage_plan(folder,snapshot,bootstrap=bootstrap);messagebox.showinfo('Только план','Приватная конфигурация и команда versions upload подготовлены. Ничего не загружено, трафик и секреты не изменены. Перед выполнением требуется отдельное разрешение и повторная проверка снимка.')
    except Exception as e:
        print('STOP:',str(e)if isinstance(e,RuntimeError)and str(e).replace('_','').isalnum()else'STAGE_PLAN_FAILED');input('Enter — закрыть окно...')
