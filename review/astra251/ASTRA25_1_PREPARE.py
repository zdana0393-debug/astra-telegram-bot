"""Double-click on Windows: select the ORIGINAL private build-* folder. Offline."""
from private_tools import prepare
if __name__=='__main__':
    try:
        import tkinter as tk
        from tkinter import filedialog,messagebox
        root=tk.Tk();root.withdraw()
        source=filedialog.askdirectory(title='Выберите исходную приватную папку build-* Astra 2.5')
        if source:
            folder=prepare(source)
            messagebox.showinfo('Готово локально','Создана новая приватная папка:\n'+str(folder)+'\n\nБот не изменён. Магазин и админские права не включены. Не применяйте SQL и не загружайте Worker без отдельного разрешения.')
    except Exception as e:
        # Only fixed error categories, never a path, file_id, token or payload.
        print('STOP:',str(e) if isinstance(e,RuntimeError)and str(e).replace('_','').isalnum()else'PRIVATE_PREPARATION_FAILED')
        input('Enter — закрыть окно...')
