@echo off
chcp 65001 >nul
setlocal
set PYTHONUTF8=1
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys,tkinter; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
  if not errorlevel 1 (
    py -3 "%~dp0astra_pilot.pyw"
    exit /b
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys,tkinter; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
  if not errorlevel 1 (
    python "%~dp0astra_pilot.pyw"
    exit /b
  )
)
echo Нужен Python 3.10 или новее с tkinter.
echo Установите обычный Python для Windows с https://www.python.org/downloads/windows/
echo В установщике оставьте включённым Tcl/Tk. Затем снова откройте этот файл.
echo Никаких запросов к Telegram не выполнено. Токен здесь не вводите.
pause
