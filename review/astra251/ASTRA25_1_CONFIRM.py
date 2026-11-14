"""Offline verification of the bot's signed private owner proof. No typed user ID."""
from private_tools import confirm
if __name__=='__main__':
    try:
        import tkinter as tk
        from tkinter import filedialog,simpledialog,messagebox
        root=tk.Tk();root.withdraw()
        folder=filedialog.askdirectory(title='Выберите новую приватную папку Astra 2.5.1')
        if folder:
            proof=simpledialog.askstring('Подтверждение владельца','Вставьте только подписанную строку из личного ответа бота /owner_proof. Не токен.',show='*')
            if proof:
                confirm(folder,proof);messagebox.showinfo('Подтверждено','Подпись и привязка к сборке проверены. Приватное подтверждение сохранено. Cloudflare не изменён.')
    except Exception as e:
        print('STOP:',str(e)if isinstance(e,RuntimeError)and str(e).replace('_','').isalnum()else'OWNER_CONFIRMATION_FAILED');input('Enter — закрыть окно...')
