(function () {
    var tool = {
        title: '梁斜截面受剪承载力',
        sub: '仅配箍筋 · GB/T 50010-2010（2024年版） 第 6.3.1、6.3.4 条',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '6.3.1, 6.3.4',
            limitations: '矩形/T形/工形截面，仅配箍筋，hw/b≤6',
            unit: 'V:kN, Asv:mm², s:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">截面、荷载与配箍</div>' +
                '<form id="f-shear"><div class="grid2">' +
                numField('s_b', '截面宽度 b', 'mm', 250) +
                numField('s_h', '截面高度 h', 'mm', 600) +
                numField('s_as', '纵向筋合力点距离 a<sub>s</sub>', 'mm', 40) +
                numField('s_V', '剪力设计值 V', 'kN', 250) +
                selField('s_con', '混凝土强度等级', conOpts('C30')) +
                selField('s_load', '荷载类型', opts([{v:'uniform',t:'均布荷载为主（一般受弯构件）'},{v:'concentrated',t:'集中荷载为主（独立梁，按剪跨比）'}], 'uniform')) +
                numField('s_lambda', '剪跨比 λ = a/h<sub>0</sub>', '—', 2.0, '集中荷载为主时启用，取 1.5 ≤ λ ≤ 3.0') +
                selField('s_stir', '箍筋级别 f<sub>yv</sub>', opts([{v:'HPB300',t:'HPB300 (270)'},{v:'HRB400',t:'HRB400 (360)'},{v:'HRB500',t:'HRB500（抗剪取 360）'}], 'HRB400')) +
                numField('s_Asv', '同一截面箍筋各肢总面积 A<sub>sv</sub>', 'mm²（n·A<sub>sv1</sub>）', 101, '例如 φ8 双肢 = 2×50.3 ≈ 101 mm²') +
                numField('s_s', '箍筋间距 s', 'mm', 150) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="s_calc">计算受剪承载力</button>' +
                '<button type="button" class="btn btn-secondary" id="s_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="s_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="s_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('s_result'), proc = document.getElementById('s_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var b = parseFloat(document.getElementById('s_b').value);
                var h = parseFloat(document.getElementById('s_h').value);
                var asV = parseFloat(document.getElementById('s_as').value);
                var V = parseFloat(document.getElementById('s_V').value);
                var con = CONCRETE[document.getElementById('s_con').value];
                var loadType = document.getElementById('s_load').value;
                var lambda = parseFloat(document.getElementById('s_lambda').value);
                var stir = REBAR_STIRRUP[document.getElementById('s_stir').value];
                var Asv = parseFloat(document.getElementById('s_Asv').value);
                var s = parseFloat(document.getElementById('s_s').value);
                if (!(b > 0 && h > 0)) return err('截面宽度与高度必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应介于 0 与 h 之间。');
                if (!(V >= 0)) return err('剪力设计值不能为负。');
                if (!(Asv >= 0 && s > 0)) return err('箍筋面积与间距输入无效。');
                var h0 = h - asV, fc = con.fc, ft = con.ft, fyv = stir.fy, bc = 1.0;
                var hw = h, hwb = hw / b;
                var st = [];
                st.push('<div class="step"><b>① 截面参数</b>　h<sub>0</sub> = h − a<sub>s</sub> = <b>' + fmt(h0) + ' mm</b>；h<sub>w</sub>/b = ' + fmt(hwb,2) + '；f<sub>c</sub>=' + fc + '，f<sub>t</sub>=' + ft + '，f<sub>yv</sub>=' + fyv + ' N/mm²。</div>');
                // 截面限制（6.3.1）
                var Vmax;
                if (hwb <= 4) Vmax = 0.25 * bc * fc * b * h0;
                else if (hwb >= 6) Vmax = 0.2 * bc * fc * b * h0;
                else Vmax = (0.25 - 0.05 * (hwb - 4) / 2) * bc * fc * b * h0;
                Vmax /= 1000;
                var secOk = V <= Vmax;
                st.push('<div class="step"><b>② 截面限制条件（6.3.1）</b>　h<sub>w</sub>/b=' + fmt(hwb,2) + (hwb<=4?' ≤ 4，V<sub>max</sub>=0.25β<sub>c</sub>f<sub>c</sub>bh<sub>0</sub>':hwb>=6?' ≥ 6，V<sub>max</sub>=0.2β<sub>c</sub>f<sub>c</sub>bh<sub>0</sub>':' 介于 4~6，线性内插') + ' = <b>' + fmt(Vmax,1) + ' kN</b>；V = ' + fmt(V,1) + ' kN ⇒ ' + (secOk ? '截面满足' : '截面不足') + (secOk ? tag('ok','满足') : tag('err','需加大截面')) + '</div>');
                if (!secOk) {
                    var html0 = resultRow('截面限制 V<sub>max</sub>（6.3.1）', fmt(Vmax,1) + ' kN');
                    html0 += resultRow('判定', badge('badge-err', '截面不足：V &gt; V<sub>max</sub>，应加大截面或提高混凝土等级'));
                    out.innerHTML = html0; proc.innerHTML = st.join('');
                    var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                    var _p0 = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p0) _p0.classList.add('open'); return;
                }
                var isConc = loadType === 'concentrated';
                var lam = Math.min(3, Math.max(1.5, lambda));
                var acv = isConc ? 1.75 / (lam + 1) : null;
                var Vc = isConc ? acv * ft * b * h0 / 1000 : 0.7 * ft * b * h0 / 1000;
                var coeff = isConc ? 1.0 : 1.25;
                st.push('<div class="step"><b>③ 混凝土项 V<sub>c</sub></b>　' + (isConc ? 'α<sub>cv</sub>=1.75/(λ+1)=' + fmt(acv,3) + '，V<sub>c</sub>=α<sub>cv</sub>f<sub>t</sub>bh<sub>0</sub>' : 'V<sub>c</sub>=0.7f<sub>t</sub>bh<sub>0</sub>') + ' = <b>' + fmt(Vc,1) + ' kN</b></div>');
                var needCalc = V > Vc;
                if (!needCalc) {
                    st.push('<div class="step"><b>④ 配箍判定</b>　V = ' + fmt(V,1) + ' kN ≤ V<sub>c</sub> = ' + fmt(Vc,1) + ' kN，无需计算配箍，按 9.2.9 构造配箍' + tag('ok','按构造配箍') + '</div>');
                    var rsvMin = 0.24 * ft / fyv, rsv = Asv / (b * s);
                    st.push('<div class="step"><b>⑤ 构造配箍率验算（9.2.9）</b>　ρ<sub>sv,min</sub> = 0.24f<sub>t</sub>/f<sub>yv</sub> = ' + fmt(rsvMin*100,3) + '%；实际 ρ<sub>sv</sub> = A<sub>sv</sub>/(bs) = ' + fmt(rsv*100,3) + '% ⇒ ' + (rsv >= rsvMin ? '满足' : '不满足') + '</div>');
                    var h1 = resultRow('剪力设计值 V', fmt(V,1) + ' kN');
                    h1 += resultRow('混凝土项 V<sub>c</sub>', fmt(Vc,1) + ' kN');
                    h1 += resultRow('最小配箍率 ρ<sub>sv,min</sub>', fmt(rsvMin*100,3) + '%');
                    h1 += resultRow('实际配箍率 ρ<sub>sv</sub>', fmt(rsv*100,3) + '%');
                    h1 += resultRow('判定', rsv >= rsvMin ? badge('badge-ok','满足：无需计算配箍，按构造配箍即可') : badge('badge-warn','构造配箍率不足'));
                    out.innerHTML = h1; proc.innerHTML = st.join('');
                    var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                    var _p1 = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p1) _p1.classList.add('open'); return;
                }
                var Vs = coeff * fyv * (Asv / s) * h0 / 1000;
                var Vu = Vc + Vs;
                st.push('<div class="step"><b>④ 箍筋项 V<sub>s</sub></b>　V<sub>s</sub> = ' + (isConc ? '' : '1.25') + 'f<sub>yv</sub>(A<sub>sv</sub>/s)h<sub>0</sub> = ' + fyv + '×(' + Asv + '/' + s + ')×' + fmt(h0,0) + ' = <b>' + fmt(Vs,1) + ' kN</b></div>');
                st.push('<div class="step"><b>⑤ 受剪承载力</b>　V<sub>u</sub> = V<sub>c</sub> + V<sub>s</sub> = ' + fmt(Vc,1) + ' + ' + fmt(Vs,1) + ' = <b>' + fmt(Vu,1) + ' kN</b>；V = ' + fmt(V,1) + ' kN ⇒ ' + (V <= Vu ? '满足' : '不满足') + (V <= Vu ? tag('ok','满足') : tag('err','不满足')) + '</div>');
                var need = (V - Vc) / (coeff * fyv * h0) * 1000; // Asv/s in mm²/mm
                var needAsv = need * s;
                st.push('<div class="step"><b>⑥ 所需配箍</b>　所需 A<sub>sv</sub>/s = (V − V<sub>c</sub>)/(k f<sub>yv</sub>h<sub>0</sub>) = <b>' + fmt(need,3) + ' mm²/mm</b>（' + (isConc ? 'k=1.0' : 'k=1.25') + '），即 s=' + fmt(s,0) + ' mm 时需 A<sub>sv</sub> ≥ <b>' + fmt(needAsv,0) + ' mm²</b>。</div>');
                var rsvMin2 = 0.24 * ft / fyv, rsv2 = Asv / (b * s);
                var ok = V <= Vu;
                var stMsg, stCls;
                if (ok && rsv2 >= rsvMin2) { stMsg = '满足：V ≤ V<sub>u</sub> 且配箍率满足'; stCls = 'badge-ok'; }
                else if (ok && rsv2 < rsvMin2) { stMsg = '承载力满足，但配箍率不足构造要求'; stCls = 'badge-warn'; }
                else { stMsg = '不满足：V &gt; V<sub>u</sub>，需增大配箍或截面'; stCls = 'badge-err'; }
                var html = resultRow('剪力设计值 V', fmt(V,1) + ' kN');
                html += resultRow('混凝土项 V<sub>c</sub>', fmt(Vc,1) + ' kN');
                html += resultRow('箍筋项 V<sub>s</sub>', fmt(Vs,1) + ' kN');
                html += resultRow('受剪承载力 V<sub>u</sub>', '<span class="highlight">' + fmt(Vu,1) + ' kN</span>');
                html += resultRow('所需 A<sub>sv</sub>/s', fmt(need,3) + ' mm²/mm（s=' + fmt(s,0) + ' 时 ≥ ' + fmt(needAsv,0) + ' mm²）');
                html += resultRow('配箍率 ρ<sub>sv</sub> / ρ<sub>sv,min</sub>', fmt(rsv2*100,3) + '% / ' + fmt(rsvMin2*100,3) + '%');
                html += resultRow('判定', badge(stCls, stMsg));
                out.innerHTML = html; proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function syncLoad() {
                var isConc = document.getElementById('s_load').value === 'concentrated';
                var lamWrap = document.getElementById('s_lambda').parentElement;
                lamWrap.style.display = isConc ? '' : 'none';
            }
            function reset() {
                ['s_b','s_h','s_as','s_V','s_lambda','s_Asv','s_s'].forEach(function (id) { document.getElementById(id).value = { s_b:250, s_h:600, s_as:40, s_V:250, s_lambda:2.0, s_Asv:101, s_s:150 }[id]; });
                document.getElementById('s_con').value = 'C30'; document.getElementById('s_load').value = 'uniform'; document.getElementById('s_stir').value = 'HRB400';
                syncLoad(); calc();
            }
            document.getElementById('s_calc').addEventListener('click', calc);
            document.getElementById('s_reset').addEventListener('click', reset);
            document.getElementById('s_load').addEventListener('change', function () { syncLoad(); calc(); });
            document.getElementById('f-shear').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            syncLoad(); calc();
        }
    };
    window.TOOLS = window.TOOLS || {};
    window.TOOLS['beam-shear'] = tool;
})();
