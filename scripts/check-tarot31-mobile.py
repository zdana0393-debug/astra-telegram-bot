#!/usr/bin/env python3
"""Local HTML preview of real fake-API screen text; explicitly not Telegram client testing."""
import html,json,pathlib
from playwright.sync_api import sync_playwright
repo=pathlib.Path(__file__).resolve().parent.parent
m=json.loads((repo/'data/astra25-task07-mobile.json').read_text())
body=''.join('<article><pre>'+html.escape(s['text'])+'</pre>'+''.join('<div class=buttons>'+''.join('<span>'+html.escape(label)+'</span>'for label in row)+'</div>'for row in s['button_rows'])+'</article>'for s in m.get('screens',[{'text':t,'button_rows':[]}for t in m['texts']]))
page='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Astra TASK07 — локальный макет</title><style>body{margin:0;background:#101526;color:#e8e5f2;font:15px/1.45 sans-serif}header{padding:12px}main{max-width:360px;margin:auto}article{padding:12px;margin:10px 8px;border:1px solid #50566c;border-radius:12px;background:#192033}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.buttons{display:flex;gap:6px;margin-top:6px}.buttons span{flex:1;min-width:0;padding:7px;background:#354360;border-radius:5px;text-align:center;font-size:13px;overflow-wrap:anywhere}</style><header>Локальный макет сообщений. Это не тест настоящего Telegram.</header><main>'+body+'</main></html>'
file=repo/'docs/ASTRA_2_5_TASK_07_MOBILE_PREVIEW.html';file.write_text(page)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 results=[]
 for width in [320,360]:
  tab=browser.new_page(viewport={'width':width,'height':780});tab.route('http**',lambda route:route.abort());tab.set_content(page);size=tab.evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})')
  assert size['scroll']<=size['client'],size
  results.append(dict(viewport_width=width,horizontal_overflow=False,screen_texts=len(m['texts']),engine='local Chromium',real_telegram=False));tab.close()
 browser.close()
(repo/'data/astra25-task07-mobile-browser.json').write_text(json.dumps(dict(local_preview_only=True,results=results),indent=2)+'\n')
print(json.dumps(results))
