from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
import json,math,zipfile
from playwright.sync_api import sync_playwright
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
root=Path(__file__).resolve().parents[1]
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.goto('http://127.0.0.1:'+str(s.server_port));page.wait_for_timeout(200)
 items=page.evaluate('Object.entries(TOOLS).map(([id,t])=>({id,title:t.title,meta:t.meta}))')
 (root/'audit').mkdir(exist_ok=True);(root/'audit/tool-inventory.json').write_text(json.dumps(items,ensure_ascii=False,indent=2))
 assert page.evaluate('REBAR_FLEX.HRB500.fyp')==435
 assert page.evaluate('REBAR_STIRRUP.HRB500.fy')==360
 # Default single-reinforced beam, independent hand equation.
 page.evaluate("goTool('beam-rect')")
 r=page.evaluate('_BR_RESULT');x=360*1473/(14.3*300);mu=360*1473*(560-x/2)/1e6
 assert abs(r['Mu']-mu)<1e-8
 assert abs(r['x']-x)<1e-8
 assert '待核' not in page.locator('#r_proc').inner_text()
 assert '6.2.7' in page.locator('#r_proc').inner_text()
 # Stress-compatible compression reinforcement: solve using neutral-axis bisection, independent of quadratic implementation.
 page.locator('#r_As').fill('1473');page.locator('#r_AsP').fill('1000');page.locator('#r_calc').click()
 r=page.evaluate('_BR_RESULT');assert r['branch']=='ds'
 low,high=1e-4,560
 for _ in range(100):
  c=(low+high)/2;sigma=min(360,660*(1-40/c));force=14.3*300*.8*c+sigma*1000
  if force>360*1473:high=c
  else:low=c
 c=(low+high)/2;x=.8*c;sigma=min(360,660*(1-40/c));mu=(14.3*300*x*(560-x/2)+sigma*1000*(560-40))/1e6
 assert abs(r['xActual']-x)<1e-6 and abs(r['sigmaSp']-sigma)<1e-6 and abs(r['Mu']-mu)<1e-6
 assert 'β1' in page.locator('#r_proc').inner_text()
 book=page.evaluate('buildWordCalcBookHtml(currentCalcBook)');assert '6.2.7' in book and 'β<sub>1</sub>' in book
 # Invalid current-edition material combination.
 page.locator('#r_con').select_option('C25');page.locator('#r_reb').select_option('HRB500');page.locator('#r_calc').click()
 assert '不得低于 C30' in page.locator('#r_result').inner_text();assert page.locator('#r_proc').inner_text()==''
 # Over-reinforced report must show actual equilibrium depth and use a distinct boundary estimate.
 page.locator('#r_reset').click();page.locator('#r_As').fill('9000');page.locator('#r_calc').click();r=page.evaluate('_BR_RESULT')
 assert r['over'] and r['xActual']>r['x']
 assert '界限承载力估算' in page.locator('#r_proc').inner_text()
 # Axial cap and required reinforcement including net-area branch.
 page.evaluate("goTool('column-axial')");page.locator('#c_reb').select_option('HRB500');page.locator('#c_N').fill('4000');page.locator('#c_calc').click()
 r=page.evaluate('_CA_RESULT');assert r['fyp']==400
 demand=4000*1000/(.9*r['phi'])-14.3*160000;req=demand/(400-14.3)
 row=page.locator('.result-item').filter(has_text='所需纵筋面积');assert str(round(req)) in row.inner_text(),(req,row.inner_text())
 page.locator('#c_l0').fill('21000');page.locator('#c_calc').click();assert '超过表' in page.locator('#c_result').inner_text()
 # Rebar geometry and input integrity.
 page.evaluate("goTool('rebar-area')");assert '1256.6' in page.locator('#ra_area_out').inner_text()
 page.locator('#ra_n').fill('2.5');page.locator('#ra_calc').click();assert '正整数' in page.locator('#ra_area_out').inner_text()
 # Current load coefficients, both leading actions and distinct quasi-permanent coefficients.
 page.evaluate("goTool('load-combo')")
 text=page.locator('#lc_result').inner_text()
 for expected in ['273.00','264.00','198.00','150.00','144.00']:assert expected in text,(expected,text)
 page.locator('#lc_years').select_option('100');page.locator('#lc_calc').click()
 assert '282.00' in page.locator('#lc_result').inner_text()
 assert 'γL1=1.1，γL2=1' in page.locator('#lc_proc').inner_text()
 page.locator('#lc_Q2k').fill('1000');page.locator('#lc_calc').click()
 assert '1725.30' in page.locator('#lc_result').inner_text()
 page.locator('#lc_psi_q2').fill('0.9');page.locator('#lc_calc').click()
 assert '0≤ψq≤ψf≤ψc≤1' in page.locator('#lc_result').inner_text()
 assert page.locator('#lc_proc').inner_text()==''
 # Punching per 6.5.1; independent full-perimeter equation and correct circular beta=2.
 page.evaluate("goTool('punching')");r=page.evaluate('_PC_RESULT')
 expected=.7*1.43*min(1,.5+40*560/(4*3840))*3840*560/1000
 assert abs(r['Flu']-expected)<1e-6 and r['beta_s']==2
 page.locator('#pc_shape').select_option('circ');page.locator('#pc_calc').click();r=page.evaluate('_PC_RESULT')
 assert abs(r['um']-math.pi*960)<1e-6 and r['beta_s']==2
 page.locator('#pc_Fl').fill('10000');page.locator('#pc_calc').click()
 assert str(round(1.2*1.43*math.pi*960*560/1000)) in page.locator('#pc_result').inner_text()
 page.locator('#pc_alpha_s').fill('30');page.locator('#pc_calc').click()
 assert '仅支持中柱' in page.locator('#pc_result').inner_text()
 # Foundation minimum and longitudinal distribution threshold.
 page.evaluate("goTool('footing-col')");assert page.evaluate('_FC_RESULT.rho_min')==.0015
 page.evaluate("goTool('footing-wall')");assert page.evaluate('_FW_RESULT.rho_min')==.0015
 # Actual Word exporter must use the corrected book data.
 page.evaluate("goTool('beam-rect')")
 page.locator('#r_AsP').fill('1000');page.locator('#r_calc').click()
 with page.expect_download() as dl:
  page.evaluate("exportBook()")
 with zipfile.ZipFile(dl.value.path()) as z: exported=z.read("word/document.xml").decode()
 assert 'β' in exported and 'w:vertAlign w:val="subscript"' in exported and '6.2.7' in exported
 for item in items:page.evaluate('(id)=>goTool(id)',item['id'])
 assert not errs,errs
 print('PASS: 68 tool render smoke; independent beam/column/punching/load checks; material/input limits; foundation minima; actual Word export. This is not a full normative audit of 68 tools.')
 b.close()
s.shutdown()
