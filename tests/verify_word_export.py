from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
from docx import Document
import zipfile,json,os
from lxml import etree
root=Path(__file__).resolve().parents[1];out=Path(os.environ.get('WORD_SAMPLES_DIR','/tmp/struct-calc-word-samples'));out.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:(print('DIALOG',d.message,flush=True),d.dismiss()));page.on('console',lambda m:print('CONSOLE',m.text,flush=True) if m.type=='error' else None)
 page.goto('http://127.0.0.1:'+str(server.server_port));page.wait_for_timeout(100)
 ids=page.evaluate('Object.keys(TOOLS)');results=[]
 for id in ids:
  page.evaluate("(id)=>{goTool(id);if(id==='l22zg401')document.getElementById('l22_sel_calc').click()}",id);page.wait_for_timeout(120)
  if id=='beam-rect-design':page.locator('#bd_calc').click()
  if id=='rebar-pick':page.locator('#rp_calc').click()
  page.evaluate('RESULT_ADVISOR.openForCurrent()')
  clauses=page.evaluate('(id)=>new Promise(done=>KNOWLEDGE_BASE.getStandardsForTool(id,done))',id)
  assert clauses and len({a['id'] for a in clauses})==len(clauses),id
  assert page.locator('#rsAdvisor .rs-clause p').all_text_contents()==[a['content'] for a in clauses],id
  advisor=page.locator('#rsAdvisor')
  assert advisor.locator('.rs-t').text_content()=='结果解读',id
  verdict=page.evaluate('RESULT_ADVISOR.analyze().verdict')
  if id in ('anchor','aac-wall','steel-beam','pool-rect','punching','load-combo'):
   assert verdict=='result' and '整改建议' not in advisor.text_content(),id
  if id in ('deep-beam','pool-circ','steel-column'):
   assert verdict=='fail',id
  with page.expect_download(timeout=15000) as dl:page.evaluate('exportBook()')
  file=out/(id+'.docx');dl.value.save_as(file)
  assert dl.value.suggested_filename.endswith('.docx'),id
  d=Document(file);assert len(d.paragraphs)>0,id
  with zipfile.ZipFile(file) as z:
   xml=z.read('word/document.xml').decode();assert 'w:pgSz' in xml and 'w:tblLayout' in xml,id
   assert 'w:footerReference' in xml,id
   assert 'html' not in z.namelist(),id
   ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
   tree=etree.fromstring(xml.encode());styles=etree.fromstring(z.read('word/styles.xml'))
   assert tree.find('.//w:pgSz',ns).get('{'+ns['w']+'}w')=='11906',id
   assert tree.find('.//w:pgSz',ns).get('{'+ns['w']+'}h')=='16838',id
   assert styles.find('.//w:rFonts',ns).get('{'+ns['w']+'}eastAsia')=='宋体',id
   for table in tree.findall('.//w:tbl',ns):
    width=sum(int(c.get('{'+ns['w']+'}w')) for c in table.findall('w:tblGrid/w:gridCol',ns))
    parent=table.getparent()
    if parent.tag=='{'+ns['w']+'}tc':
     props=parent.find('w:tcPr',ns)
     cell_width=int(props.find('w:tcW',ns).get('{'+ns['w']+'}w'))
     padding=sum(int(props.find('w:tcMar/w:'+side,ns).get('{'+ns['w']+'}w')) for side in ('left','right'))
     assert width==cell_width-padding,id
    else:
     assert width==9638,id
  assert 'w:vertAlign' in xml or not page.locator('.proc-body sub').count(),id
  results.append({'tool':id,'paragraphs':len(d.paragraphs),'tables':len(d.tables),'bytes':file.stat().st_size})
  print('PASS',id,flush=True)
 assert not errors,errors
 browser.close()
server.shutdown();(out/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print('ALL',len(results),'native DOCX exports passed')
