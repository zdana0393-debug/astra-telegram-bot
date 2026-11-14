"""Offline private patch only. No HTTP, credentials, SQL or Cloudflare calls."""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, stat, subprocess, sys
from pathlib import Path

PATCH=json.loads("{\"version\":\"astra251-webhook-patch-v1\",\"base_package_sha256\":\"579ec8472ad06bfed86f0acc973585c393262122fa7e2840865a3a76d01ad803\",\"normalized_parent_sha256\":\"af4f2d53c9c94338cdf9600e64462f61ff0e2801b5ec029ca4af4f63aefd61fd\",\"normalized_output_sha256\":\"016d02d5667ebd697cbc6d0ef77a52cdaffc13297416b41b0ef0a0684be3b5e5\",\"replacements\":[{\"before\":\"const astra251=(()=>{const factories={\",\"after\":\"const astra251=(()=>{const factories={\\\"src/astra251/webhook-repair.mjs\\\":(module,require)=>{\\n// Owner-only operational repair. No public HTTP route, invoices or SQL writes.\\nconst {AUTH251,schema251}=require(\\\"src/astra251/schema.mjs\\\");\\nconst {ownerStatus251}=require(\\\"src/astra251/owner.mjs\\\");\\nconst URL251='https://opel-astra-bot.zdana0393.workers.dev/telegram-webhook';\\nconst fail=code=>Object.assign(Error(code),{code});\\nconst yes=x=>x===true||x==='true';\\nfunction personal(m){return m?.chat?.type==='private'&&Number.isSafeInteger(m.from?.id)&&m.from.id>0&&m.chat.id===m.from.id&&m.from.is_bot===false&&!m.sender_chat&&!m.via_bot&&!m.forward_origin&&!m.forward_date&&!m.forward_from&&!m.forward_from_chat&&!m.is_automatic_forward&&Number.isSafeInteger(m.message_id)&&m.message_id>0&&Number.isSafeInteger(m.date);}\\nasync function api(env,method,body={}){\\n try{\\n  const r=await fetch('https://api.telegram.org/bot'+env.ASTRA_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(2500)});\\n  const j=await r.json();if(!r.ok||j?.ok!==true)throw fail('WEBHOOK_API_UNCONFIRMED');return j.result;\\n }catch{throw fail('WEBHOOK_API_UNCONFIRMED');}\\n}\\nfunction info(i){\\n if(i?.url!==URL251||i.has_custom_certificate!==false||!Number.isInteger(i.max_connections)||i.max_connections<1||i.max_connections>100)throw fail('WEBHOOK_CONFIGURATION_UNEXPECTED');\\n if(i.allowed_updates!==undefined&&(!Array.isArray(i.allowed_updates)||i.allowed_updates.some(x=>typeof x!=='string')))throw fail('WEBHOOK_CONFIGURATION_UNEXPECTED');\\n const types=i.allowed_updates??[];\\n return{types,ready:types.length===0||types.includes('pre_checkout_query')};\\n}\\nasync function authority(env,id){\\n const o=await ownerStatus251(env);if(!o.ready||o.config.owner_id!==id)throw fail('WEBHOOK_OWNER_REQUIRED');return o;\\n}\\nasync function webhookMessage251(env,m,uid,{send}){\\n const text=typeof m?.text==='string'?m.text.trim():'';\\n if(!['/stars_webhook_check','/stars_webhook_enable'].includes(text))return false;\\n if(env[AUTH251]!==true||!personal(m)||!Number.isSafeInteger(uid)||uid<0)return true;\\n const reply=t=>send(env,m.from.id,t);\\n try{\\n  if(!await schema251(env))throw fail('WEBHOOK_SCHEMA_NOT_READY');\\n  const o=await authority(env,m.from.id);\\n  if(m.date<o.config.db_now-300||m.date>o.config.db_now+30||m.date<o.config.claimed_at)throw fail('WEBHOOK_MESSAGE_EXPIRED');\\n  if(yes(env.ASTRA_TELEGRAM_TEST_MODE)||!/^[-A-Za-z0-9_]{1,256}$/.test(env.ASTRA_WEBHOOK_SECRET??''))throw fail('WEBHOOK_ENVIRONMENT_UNEXPECTED');\\n  const me=await api(env,'getMe');if(me?.id!==o.config.bot_id||me.is_bot!==true)throw fail('WEBHOOK_BOT_MISMATCH');\\n  const before=await api(env,'getWebhookInfo'),state=info(before);\\n  if(state.ready){await reply('Платёжные события Telegram уже разрешены. Адрес webhook проверен. Откройте магазин заново и создайте новый счёт; старый просроченный счёт не используйте.');return true;}\\n  if(text==='/stars_webhook_check'){await reply('Причина таймаута подтверждена: Telegram не передаёт pre_checkout_query. Для исправления отправьте /stars_webhook_enable. Секрет и адрес webhook сохранятся, ожидающие обновления не удаляются.');return true;}\\n  if(!state.types.includes('message')||!state.types.includes('callback_query'))throw fail('WEBHOOK_CONFIGURATION_UNEXPECTED');\\n  const latest=await authority(env,m.from.id);if(latest.config.owner_generation!==o.config.owner_generation)throw fail('WEBHOOK_OWNER_REQUIRED');\\n  let ack=false;\\n  try{ack=await api(env,'setWebhook',{url:URL251,secret_token:env.ASTRA_WEBHOOK_SECRET,max_connections:before.max_connections,allowed_updates:[...new Set([...state.types,'pre_checkout_query'])],drop_pending_updates:false})===true;}catch{}\\n  // A timeout can follow a successful mutation. Read back once; never auto-repeat it.\\n  const after=await api(env,'getWebhookInfo'),confirmed=info(after);\\n  if(!confirmed.ready||after.max_connections!==before.max_connections||state.types.some(x=>!confirmed.types.includes(x)))throw fail(ack?'WEBHOOK_READBACK_MISMATCH':'WEBHOOK_CHANGE_UNCONFIRMED');\\n  await reply('Платёжное событие pre_checkout_query подключено. Telegram подтвердил настройки. Адрес, существующий защитный секрет и число соединений сохранены; очередь не очищалась. Откройте магазин заново и создайте новый счёт.');\\n }catch(e){\\n  const codes=['WEBHOOK_SCHEMA_NOT_READY','WEBHOOK_OWNER_REQUIRED','WEBHOOK_MESSAGE_EXPIRED','WEBHOOK_ENVIRONMENT_UNEXPECTED','WEBHOOK_BOT_MISMATCH','WEBHOOK_CONFIGURATION_UNEXPECTED','WEBHOOK_API_UNCONFIRMED','WEBHOOK_READBACK_MISMATCH','WEBHOOK_CHANGE_UNCONFIRMED'];\\n  if(!codes.includes(e?.code))throw e; // Let existing delivery recovery handle reply failures.\\n  await reply('Настройка требует проверки. Код: '+e.code+'. Сначала используйте /stars_webhook_check; автоматического повторного изменения нет.');\\n }\\n return true;\\n}\\n\\nmodule.exports={webhookMessage251};\\n},\"},{\"before\":\"const message=adminMessage251;\",\"after\":\"const {webhookMessage251}=require(\\\"src/astra251/webhook-repair.mjs\\\");\\nconst message=async(...args)=>await webhookMessage251(...args)||adminMessage251(...args);\"},{\"before\":\"const VERSION = 'ASTRA-2.5.1-stars-admin';\",\"after\":\"const VERSION = 'ASTRA-2.5.1-stars-admin-webhook';\"}],\"package_sha256\":\"d49e91a18e2dbdeafddc6897ee1a82f99516de00c10cc76e9e218711207e6c01\"}")
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
