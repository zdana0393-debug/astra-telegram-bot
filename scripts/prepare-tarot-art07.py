#!/usr/bin/env python3
"""Read-only originals; new private derivatives only. No network, uploads or AI generation."""
import argparse, hashlib, json, os, pathlib, stat
from PIL import Image, ImageOps
p=argparse.ArgumentParser();p.add_argument('--local-only',action='store_true',required=True);p.add_argument('--manifest',required=True);p.add_argument('--originals',required=True);p.add_argument('--output',required=True);a=p.parse_args()
root=pathlib.Path(a.originals);out=pathlib.Path(a.output);m=json.loads(pathlib.Path(a.manifest).read_text())
if not root.is_absolute() or root.resolve()!=root or not root.is_dir() or out.exists() or not out.is_absolute() or out.parent.resolve()!=out.parent or root==out or root in out.parents:raise SystemExit('STOP: explicit private roots; output must be new and outside originals')
repo=pathlib.Path(__file__).resolve().parent.parent
if out==repo or repo in out.parents:raise SystemExit('STOP: private derivatives must be outside repository')
contract=json.loads((repo/'data/tarot25-art-contract07.json').read_text());known={c['card_id']:c['name_ru'] for c in contract}
if m['deck_version']!='rws78-v1' or {c['card_id'] for c in m['cards']}!=set(known) or any(c['name_ru']!=known[c['card_id']] or c['asset_id']!='rws78-v1/'+c['card_id'] or c['upright_rotation']!=0 or c['reversed_rotation']!=180 for c in m['cards']):raise SystemExit('STOP: canonical card/title/orientation mismatch')
if len(m['cards'])!=78 or len({c['card_id'] for c in m['cards']})!=78:raise SystemExit('STOP: 78 unique cards required')
out.mkdir(mode=0o700);ready=0
for c in m['cards']:
 if c['original'] is None:continue
 rel=pathlib.PurePosixPath(c['original']);f=root.joinpath(*rel.parts)
 if rel.is_absolute() or '..' in rel.parts or f.resolve()!=f or not f.is_file() or f.stat().st_nlink!=1:raise SystemExit('STOP: unsafe original path')
 for parent in f.parents:
  if parent==root:break
  if parent.is_symlink():raise SystemExit('STOP: symlink')
 raw=f.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=c['sha256']:raise SystemExit('STOP: original hash mismatch')
 with Image.open(f) as original:
  if original.format not in ('PNG','JPEG','WEBP') or original.width*original.height>40000000:raise SystemExit('STOP: unsupported original')
  image=ImageOps.exif_transpose(original).convert('RGB');image.thumbnail((1024,1536))
  for reversed_,suffix in [(False,'upright'),(True,'reversed')]:
   name=c['card_id']+'-'+suffix+'.jpg';target=out/name
   (image.transpose(Image.Transpose.ROTATE_180) if reversed_ else image).save(target,quality=90)
   os.chmod(target,0o600);c['telegram_'+suffix]=name
 ready+=1
(out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));os.chmod(out/'manifest.json',0o600)
print(json.dumps({'local_only':True,'originals_changed':False,'cards':ready,'missing':78-ready,'text_fallback':ready<78,'uploads':0}))
