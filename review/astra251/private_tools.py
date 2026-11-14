"""Offline only. Private artifacts stay outside every Git checkout. No HTTP client."""
from __future__ import annotations
import base64, hashlib, hmac, json, os, re, secrets, shutil, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PARENT_SHA='3ee56aefdebb7dc4b3cacfc74b2da24e002e6f150f7b45167c1f472719303561'
WORKER='ASTRA_2_5_1_WORKER.js'
RECEIPT='ASTRA25_1_SAFE_RECEIPT.json'
PROOF='ASTRA25_1_OWNER_PROOF_PRIVATE.json'
DB_ID='1a5b3f2f-e668-4b74-90fb-3781cb2c79ea'
sha=lambda x:hashlib.sha256(x).hexdigest()
canonical=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')
def need(ok,code):
    if not ok:raise RuntimeError(code)
def data(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def private_path(p,exists=True):
    p=Path(p).absolute()
    need(p.resolve()==p,'PRIVATE_PATH_LINK')
    for parent in (p,*p.parents):
        marker=parent/'.git';need(not marker.is_file() and not (marker/'HEAD').is_file(),'PRIVATE_OUTSIDE_GIT_REQUIRED')
    if exists:
        need(p.exists() and not p.is_symlink(),'PRIVATE_FILE_REQUIRED')
        if p.is_file():need(p.stat().st_nlink==1,'PRIVATE_HARDLINK')
        if os.name=='nt':
            result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/tarot-bulk-loader/protect_private_folder.ps1'),'-Path',str(p),'-CheckOnly'],capture_output=True,timeout=30)
            need(result.returncode==0,'PRIVATE_DACL_CHECK_FAILED')
        else:need(p.stat().st_mode&0o077==0,'PRIVATE_MODE_REQUIRED')
    return p

def save(p,body):
    p=Path(p);private_path(p.parent);need(not p.exists() and not p.is_symlink(),'PRIVATE_OUTPUT_EXISTS')
    with os.fdopen(os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb')as f:f.write(body if isinstance(body,bytes)else body.encode('utf-8'))
    if os.name!='nt':p.chmod(0o600)
    private_path(p)
def save_json(p,x):save(p,json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def registry_literal(code):
    start='const privateTarotArtRegistry=';end=';\nconst privateTarotArt='
    need(code.count(start)==1,'REGISTRY_ANCHOR');a=code.index(start)+len(start);b=code.find(end,a);need(b>a,'REGISTRY_ANCHOR');return a,b,code[a:b]
def normalized(code):
    a,b,_=registry_literal(code);return code[:a]+'__PRIVATE_REGISTRY_UNCHANGED__'+code[b:]
def patch(old,delta,expected_sha=PARENT_SHA):
    need(sha(old)==expected_sha==delta.get('parent_sha256'),'PRIVATE_PARENT_SHA_MISMATCH')
    body=dict(delta);package=body.pop('package_sha256',None);need(sha(canonical(body))==package,'PUBLIC_DELTA_DIGEST')
    text=old.decode('utf-8');reg=registry_literal(text)[2]
    need(sha(normalized(text).encode())==delta['normalized_parent_sha256'],'PRIVATE_PARENT_TEMPLATE_MISMATCH')
    for r in delta['replacements']:
        need(set(r)=={'before','after'} and text.count(r['before'])==1,'PRIVATE_PATCH_ANCHOR')
        text=text.replace(r['before'],r['after'],1)
    need(registry_literal(text)[2]==reg and sha(normalized(text).encode())==delta['normalized_output_sha256'],'PRIVATE_OUTPUT_MISMATCH')
    return text.encode()
def validate_registry(r,embedded):
    need(r==json.loads(embedded),'REGISTRY_EMBEDDED_MISMATCH')
    need(r.get('version')=='astra-telegram-art-v1' and r.get('deck_version')=='rws78-v1','REGISTRY_VERSION')
    need(type(r.get('bot_id'))is int and 0<r['bot_id']<2**52 and r.get('realm')=='production','REGISTRY_SCOPE')
    expected={x['card_id']for x in data(ROOT/'data/tarot25-art-contract07.json')};cards=r.get('cards',[])
    need(len(cards)==78 and {c['card_id']for c in cards}==expected,'REGISTRY_CARDS')
    ids=[c[o]['file_id']for c in cards for o in('upright','reversed')]
    need(len(set(ids))==156 and all(isinstance(x,str)and re.fullmatch(r'[A-Za-z0-9_-]{8,512}',x)for x in ids),'REGISTRY_MEDIA')
def secret(home):
    values={}
    for line in private_path(home/'CLOUDFLARE_SETTINGS_PRIVATE.txt').read_text(encoding='utf-8-sig').splitlines():
        m=re.fullmatch(r'\s*([A-Z][A-Z0-9_]*)\s*=\s*(\S.*?)\s*',line)
        if m:need(m[1]not in values,'PRIVATE_DUPLICATE_SETTING');values[m[1]]=m[2]
    key=values.get('ASTRA_BONUS_FENCE_KEY','');need(len(key.encode())>=32,'PRIVATE_FENCE_KEY_REQUIRED')
    check=hmac.new(key.encode(),b'astra:bonus-fence:v1:check:configuration',hashlib.sha256).hexdigest()
    need(check in private_path(home/'SETUP_NEW_D1.sql').read_text(encoding='utf-8-sig'),'PRIVATE_FENCE_KEY_MISMATCH')
    return key

def prepared(home):
    home=private_path(home);receipt=data(private_path(home/RECEIPT));worker=private_path(home/WORKER).read_bytes()
    need(receipt.get('version')=='astra251-private-prepared-v2' and receipt.get('worker_sha256')==sha(worker) and receipt.get('worker_bytes')==len(worker) and receipt.get('parent_sha256')==PARENT_SHA,'PRIVATE_RECEIPT_MISMATCH')
    delta=data(ROOT/'release/ASTRA_2_5_1_PATCH.json');body=dict(delta);digest=body.pop('package_sha256')
    need(digest==sha(canonical(body))==receipt['package_sha256'] and sha(normalized(worker.decode()).encode())==delta['normalized_output_sha256'],'PRIVATE_PUBLIC_TEMPLATE_MISMATCH')
    need(sha(private_path(home/'0032_astra251.sql').read_bytes())==delta['migration_sha256'],'PRIVATE_SQL_MISMATCH')
    reg=data(private_path(home/'telegram-registry.json'));literal=registry_literal(worker.decode())[2];validate_registry(reg,literal)
    need(receipt.get('bot_id')==reg['bot_id'] and receipt.get('registry_literal_sha256')==sha(literal.encode()),'PRIVATE_REGISTRY_RECEIPT_MISMATCH');secret(home)
    return receipt,worker

def prepare(source):
    source=private_path(source);old=private_path(source/'ASTRA_2_5_WORKER.js').read_bytes();receipt=data(private_path(source/'safe-build-receipt.json'))
    need(receipt.get('worker_sha256')==sha(old)==PARENT_SHA and receipt.get('worker_bytes')==len(old),'PRIVATE_ORIGINAL_RECEIPT_MISMATCH')
    regfile=private_path(source/'telegram-registry.json');reg=data(regfile);validate_registry(reg,registry_literal(old.decode())[2]);secret(source)
    delta=data(ROOT/'release/ASTRA_2_5_1_PATCH.json');new=patch(old,delta)
    sql=(ROOT/'migrations/0032_astra251.sql').read_bytes();need(sha(sql)==delta['migration_sha256'],'PUBLIC_SQL_DIGEST')
    node=shutil.which('node');need(node is not None,'NODE_REQUIRED')
    checked=subprocess.run([node,'--input-type=module','--check'],input=new,capture_output=True,timeout=30);need(checked.returncode==0,'PRIVATE_WORKER_SYNTAX')
    # Create a sibling, not a Git subfolder or an overwrite of the original build.
    out=source.parent/('build-astra251-'+secrets.token_hex(8));out.mkdir(mode=0o700)
    if os.name=='nt':
        result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/tarot-bulk-loader/protect_private_folder.ps1'),'-Path',str(out),'-NewEmptyBuild','-ExpectedParent',str(source.parent)],capture_output=True,timeout=30)
        need(result.returncode==0,'PRIVATE_NEW_DACL_FAILED')
    private_path(out)
    token=secrets.token_urlsafe(32);challenge=sha(token.encode());digest=sha(new)
    claim_sql=f"""-- PRIVATE one-time owner challenge. Apply only with separate DB authorization.
-- Apply after 0032 under writer freeze. No numeric user ID is trusted here.
UPDATE astra_owner251 SET state='pending',bot_id={reg['bot_id']},build_sha256='{digest}',parent_sha256='{PARENT_SHA}',challenge_hash='{challenge}',expires_at=unixepoch()+900 WHERE singleton=1 AND state IN('unconfigured','revoked','pending');
SELECT state,expires_at FROM astra_owner251 WHERE singleton=1;
"""
    for name,content in[(WORKER,new),('telegram-registry.json',regfile.read_bytes()),('CLOUDFLARE_SETTINGS_PRIVATE.txt',(source/'CLOUDFLARE_SETTINGS_PRIVATE.txt').read_bytes()),('SETUP_NEW_D1.sql',(source/'SETUP_NEW_D1.sql').read_bytes()),('0032_astra251.sql',sql),('OWNER_CHALLENGE_PRIVATE.sql',claim_sql),('OWNER_CLAIM_PRIVATE.txt','/owner_claim '+token+'\n')]:save(out/name,content)
    save_json(out/RECEIPT,{'version':'astra251-private-prepared-v2','parent_sha256':PARENT_SHA,'worker_sha256':digest,'worker_bytes':len(new),'package_sha256':delta['package_sha256'],'registry_literal_sha256':sha(registry_literal(new.decode())[2].encode()),'bot_id':reg['bot_id'],'challenge_hash':challenge,'syntax':'PASS','owner_attested':False,'stars_off':True,'network_used':False})
    return out

def verify_proof(text,key,receipt):
    need(len(text)<4096,'OWNER_PROOF_SIZE');m=re.fullmatch(r'([A-Za-z0-9_-]+)\.([a-f0-9]{64})',text.strip());need(m is not None,'OWNER_PROOF_FORMAT')
    raw=base64.urlsafe_b64decode(m[1]+'='*(-len(m[1])%4));payload=json.loads(raw)
    need(isinstance(payload,list)and len(payload)==10 and payload[0]=='astra251-owner-v1','OWNER_PROOF_VERSION')
    need(raw==json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode(),'OWNER_PROOF_ENCODING')
    need(hmac.compare_digest(hmac.new(key.encode(),raw,hashlib.sha256).hexdigest(),m[2]),'OWNER_PROOF_SIGNATURE')
    need(payload[1]==receipt['bot_id']and payload[4]==receipt['worker_sha256']and payload[5]==PARENT_SHA and payload[6]==receipt['challenge_hash'],'OWNER_PROOF_BUILD_SCOPE')
    need(type(payload[2])is int and 0<payload[2]<2**52 and isinstance(payload[3],str)and 1<=len(payload[3])<=128 and all(type(payload[n])is int and payload[n]>=0 for n in(7,8,9))and payload[8]>0 and payload[9]>0,'OWNER_PROOF_ACTOR')
    return payload

def confirm(home,text):
    home=private_path(home);receipt,_=prepared(home);payload=verify_proof(text,secret(home),receipt)
    save_json(home/PROOF,{'proof':text.strip(),'worker_sha256':receipt['worker_sha256']})
    # A new immutable receipt binds the verified private interaction, not typed ID.
    save_json(home/'ASTRA25_1_ATTESTED_RECEIPT_PRIVATE.json',{'prepared_receipt_sha256':sha((home/RECEIPT).read_bytes()),'owner_proof_sha256':sha(text.strip().encode()),'owner_id':payload[2],'worker_sha256':receipt['worker_sha256']})
    return True

def stage_plan(home,snapshot,bootstrap=False):
    """Plan only. Never uploads, calls Cloudflare, executes SQL or changes secrets.
    Input: owner's CURRENT, complete Wrangler configuration exported/reviewed locally.
    Extra/platform fields are preserved wholesale; absence/ambiguity blocks this tool.
    """
    home=private_path(home);receipt,worker=prepared(home);snapshot=private_path(snapshot);s=data(snapshot)
    need(set(s)=={'active_version_id','configuration','captured_at','reviewed_complete_current_config'},'PLATFORM_SNAPSHOT_SHAPE')
    need(s['reviewed_complete_current_config']is True and re.fullmatch(r'[a-f0-9-]{36}',s['active_version_id']or'')and isinstance(s['captured_at'],str)and s['captured_at'],'PLATFORM_SNAPSHOT_UNVERIFIED')
    cfg=s['configuration'];need(isinstance(cfg,dict)and cfg.get('name')=='opel-astra-bot','PLATFORM_WORKER_MISMATCH')
    need(cfg.get('compatibility_date')=='2026-11-03'and cfg.get('triggers',{}).get('crons')==['* 6-7 * * *']and isinstance(cfg.get('observability'),dict),'PLATFORM_RUNTIME_MISMATCH')
    bindings=cfg.get('d1_databases',[]);need(len(bindings)==1 and bindings[0].get('binding')=='DB'and bindings[0].get('database_id')==DB_ID and bindings[0].get('database_name')=='astra25-release','PLATFORM_DB_MISMATCH')
    vars_=cfg.get('vars');need(isinstance(vars_,dict)and isinstance(vars_.get('CHANNEL_USERNAME'),str)and vars_['CHANNEL_USERNAME'],'PLATFORM_VARS_MISSING')
    need(not any(re.search(r'TOKEN|SECRET|PASSWORD|CREDENTIAL|_KEY$',k,re.I)for k in vars_),'PLAIN_SECRET_FORBIDDEN')
    for key in['STARS_SHOP_ENABLED','ASTRA_DAILY_DELIVERY_ENABLED','ASTRA_ECONOMY_V2_ENABLED','ASTRA_TAROT25_QUESTIONS_TEST_MODE','ASTRA_TELEGRAM_TEST_MODE']:need(vars_.get(key)in(False,'false'),'UNAPPROVED_FEATURE_ENABLED')
    need('ASTRA_STARS_LIVE_APPROVED'not in vars_ and 'ASTRA_PAYMENT_POLICY_ACCEPTED'not in vars_,'UNAPPROVED_COMMERCE_APPROVAL')
    vars_['ASTRA_ADMIN_BUILD_SHA256']=receipt['worker_sha256']
    if bootstrap:
        need('ASTRA_OWNER_TELEGRAM_ID'not in vars_,'BOOTSTRAP_OWNER_MUST_BE_ABSENT')
    else:
        proof=data(private_path(home/PROOF));att=data(private_path(home/'ASTRA25_1_ATTESTED_RECEIPT_PRIVATE.json'))
        payload=verify_proof(proof['proof'],secret(home),receipt)
        need(att.get('owner_proof_sha256')==sha(proof['proof'].encode())and att.get('prepared_receipt_sha256')==sha((home/RECEIPT).read_bytes())and att.get('owner_id')==payload[2]and att.get('worker_sha256')==receipt['worker_sha256'],'OWNER_ATTESTED_RECEIPT_MISMATCH')
        need(vars_.get('ASTRA_OWNER_TELEGRAM_ID',str(payload[2]))in(str(payload[2]),payload[2]),'OWNER_CURRENT_CONFIG_MISMATCH')
        vars_['ASTRA_OWNER_TELEGRAM_ID']=str(payload[2])
    # No guessing of logs, channel, other bindings/variables; retain entire config.
    need(not any(re.search(r'TOKEN|SECRET|PASSWORD|CREDENTIAL|_KEY$',k,re.I)for k in cfg),'ROOT_SECRET_FORBIDDEN')
    forbidden={'assets','site','build','rules','find_additional_modules','upload_source_maps','legacy_assets','unsafe','env','migrations','durable_objects','queues','containers','workflows'}
    need(not forbidden.intersection(cfg),'UNSUPPORTED_PLATFORM_CONFIG_STOP')
    cfg['main']='./'+WORKER
    plan={'version':'astra251-stage-plan-v2','mode':'bootstrap-admin-off'if bootstrap else'owner-attested-stars-off','baseline_active_version_id':s['active_version_id'],'worker_sha256':sha(worker),'cloudflare_called':False,'traffic_changed':False,'sql_executed':False,'secrets_uploaded':False,'requires_current_snapshot_recheck':True,'command':['npx.cmd','--yes','wrangler@4.162.0','versions','upload','--config',('wrangler-astra251-bootstrap-private.json'if bootstrap else'wrangler-astra251-owner-private.json'),'--name','opel-astra-bot','--no-bundle','--keep-vars','--tag','astra251-closed-shop'],'cutover_permitted':False}
    # No automatic execution. Public sources never contain these private outputs.
    save_json(home/('wrangler-astra251-bootstrap-private.json'if bootstrap else'wrangler-astra251-owner-private.json'),cfg);save_json(home/('ASTRA25_1_BOOTSTRAP_STAGE_PLAN_PRIVATE.json'if bootstrap else'ASTRA25_1_OWNER_STAGE_PLAN_PRIVATE.json'),plan)
    return plan
