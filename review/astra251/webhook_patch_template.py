"""Offline private patch only. No HTTP, credentials, SQL or Cloudflare calls."""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, stat, subprocess, sys
from pathlib import Path

PATCH=json.loads(__PUBLIC_PATCH_LITERAL__)
WORKER='ASTRA_2_5_1_WORKER.js'
OUTPUT='ASTRA_2_5_1_WORKER_WEBHOOK.js'
RECEIPT='ASTRA251_WEBHOOK_PATCH_RECEIPT_PRIVATE.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
canonical=lambda x:json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
def need(ok,code):
    if not ok:raise RuntimeError(code)

# Check only DACL/owner; never request SACL, change ownership or require elevation.
DACL_CHECK=r"""
$ErrorActionPreference='Stop'
try {
 $p=[Console]::In.ReadToEnd(); $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $a=Get-Acl -LiteralPath $p; $allow=@($me,'S-1-5-18','S-1-5-32-544'); $seen=@{}
 if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $me){throw 'owner'}
 $dir=Test-Path -LiteralPath $p -PathType Container
 if($dir -and !$a.AreAccessRulesProtected){throw 'inheritance'}
 foreach($r in $a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
  $id=$r.IdentityReference.Value
  if($r.AccessControlType -ne 'Allow' -or $allow -notcontains $id){throw 'principal'}
  if(($r.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'rights'}
  if($dir -and (($r.InheritanceFlags -band 3) -ne 3 -or $r.PropagationFlags -ne 0)){throw 'children'}
  $seen[$id]=$true
 }
 foreach($id in $allow){if(!$seen[$id]){throw 'missing'}}
}catch{exit 1}
"""
def windows_acl(path):
    if os.name!='nt':return
    # Read the path over stdin, not as executable PowerShell text.
    command="[Console]::InputEncoding=New-Object System.Text.UTF8Encoding;"+DACL_CHECK
    p=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],input=str(path).encode('utf-8'),capture_output=True,timeout=20)
    need(p.returncode==0,'PRIVATE_DACL_CHECK_FAILED')
def private(path):
    p=Path(path).absolute()
    need(os.path.normcase(str(p.resolve()))==os.path.normcase(str(p)),'PRIVATE_LINK')
    for ancestor in (p,*p.parents):
        g=ancestor/'.git'
        need(not g.is_file() and not (g/'HEAD').is_file(),'PRIVATE_OUTSIDE_GIT_REQUIRED')
    st=p.lstat();need(not stat.S_ISLNK(st.st_mode) and not getattr(st,'st_file_attributes',0)&0x400,'PRIVATE_LINK')
    if p.is_file():need(st.st_nlink==1,'PRIVATE_HARDLINK')
    if os.name!='nt':need(st.st_mode&0o077==0,'PRIVATE_MODE_REQUIRED')
    windows_acl(p);return p
def literal(code):
    start='const privateTarotArtRegistry=';end=';\nconst privateTarotArt='
    need(code.count(start)==1,'PRIVATE_REGISTRY_ANCHOR');a=code.index(start)+len(start);b=code.find(end,a)
    need(b>a,'PRIVATE_REGISTRY_ANCHOR');return a,b,code[a:b]
def normalized(code):
    a,b,_=literal(code);return code[:a]+'__PRIVATE_REGISTRY_UNCHANGED__'+code[b:]
def apply_patch(old):
    body=dict(PATCH);digest=body.pop('package_sha256')
    need(sha(canonical(body))==digest,'PUBLIC_PATCH_DIGEST')
    text=old.decode('utf-8');reg=literal(text)[2]
    need(sha(normalized(text).encode())==PATCH['normalized_parent_sha256'],'PRIVATE_PARENT_TEMPLATE_MISMATCH')
    for r in PATCH['replacements']:
        need(set(r)=={'before','after'} and text.count(r['before'])==1,'PRIVATE_PATCH_ANCHOR')
        text=text.replace(r['before'],r['after'],1)
    need(literal(text)[2]==reg and sha(normalized(text).encode())==PATCH['normalized_output_sha256'],'PRIVATE_PATCH_OUTPUT_MISMATCH')
    return text.encode('utf-8')
def save_new(path,body):
    private(path.parent)
    if path.exists():
        need(private(path).read_bytes()==body,'PRIVATE_OUTPUT_EXISTS');return
    with os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb')as f:f.write(body)
    private(path)
def copy_worker(path):
    if os.name!='nt':return
    # Single-quoted PowerShell literal, never JSON/shell interpolation of private JS.
    quoted=str(path).replace("'","''")
    command="$ErrorActionPreference='Stop'; Set-Clipboard -Value (Get-Content -LiteralPath '"+quoted+"' -Raw -Encoding UTF8)"
    r=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],capture_output=True,timeout=20)
    need(r.returncode==0,'CLIPBOARD_FAILED_PRIVATE_OUTPUT_SAVED')
def prepare(folder,clipboard=True):
    home=private(folder);need(home.is_dir(),'PRIVATE_FOLDER_REQUIRED')
    original=private(home/WORKER).read_bytes();r=json.loads(private(home/'ASTRA25_1_SAFE_RECEIPT.json').read_text(encoding='utf-8-sig'))
    need(r.get('version')=='astra251-private-prepared-v2' and r.get('worker_sha256')==sha(original) and r.get('worker_bytes')==len(original) and r.get('package_sha256')==PATCH['base_package_sha256'],'PRIVATE_BASE_RECEIPT_MISMATCH')
    reg=literal(original.decode())[2]
    need(r.get('registry_literal_sha256')==sha(reg.encode()),'PRIVATE_REGISTRY_DIGEST')
    need(json.loads(private(home/'telegram-registry.json').read_text(encoding='utf-8-sig'))==json.loads(reg),'PRIVATE_REGISTRY_MISMATCH')
    new=apply_patch(original)
    node=shutil.which('node');need(node is not None,'NODE_REQUIRED')
    checked=subprocess.run([node,'--input-type=module','--check'],input=new,capture_output=True,timeout=30)
    need(checked.returncode==0,'PRIVATE_WORKER_SYNTAX')
    out=home/OUTPUT;save_new(out,new)
    receipt={'version':'astra251-private-webhook-repair-v1','parent_worker_sha256':sha(original),'worker_sha256':sha(new),'registry_literal_sha256':sha(reg.encode()),'owner_authority_sha256':r['worker_sha256'],'public_patch_sha256':PATCH['package_sha256'],'syntax':'PASS','network_used':False,'sql_executed':False,'deployed':False}
    save_new(home/RECEIPT,(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n').encode())
    need(private(home/WORKER).read_bytes()==original,'PRIVATE_PARENT_CHANGED')
    if clipboard:copy_worker(out)
    return out,receipt
def main():
    import tkinter as tk
    from tkinter import filedialog,messagebox
    parser=argparse.ArgumentParser();parser.add_argument('--folder');args=parser.parse_args()
    root=tk.Tk();root.withdraw()
    try:
        folder=args.folder or filedialog.askdirectory(title='Выберите существующую папку build-astra251-* с ASTRA_2_5_1_WORKER.js')
        if not folder:return
        print('Проверяю приватную сборку и сохраняю исправленный Worker. Только локально.',flush=True)
        out,_=prepare(folder)
        messagebox.showinfo('Исправление подготовлено','Новый Worker сохранён:\n'+str(out)+'\n\nКод скопирован в буфер обмена. Исходный Worker и колода сохранены. Облако и бот ещё не изменены. Не меняйте существующие Secrets и Variables.');print('LOCAL_PATCH_PASS',flush=True)
    except Exception as e:
        code=str(e) if isinstance(e,RuntimeError) and str(e).replace('_','').isalnum() else 'PRIVATE_PATCH_FAILED'
        print('STOP: '+code,flush=True);messagebox.showerror('Сборка остановлена',code+'\nНе присылайте приватные файлы или секреты в чат.')
        sys.exit(1)
if __name__=='__main__':main()
