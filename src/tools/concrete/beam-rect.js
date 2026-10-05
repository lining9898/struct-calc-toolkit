(function () {
    var tool = {
        title: '矩形梁正截面承载力',
        sub: '单筋 / 双筋矩形截面受弯 · GB/T 50010-2010（2024年版） 第 6.2.10 条',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '6.2.10',
            limitations: '矩形截面受弯构件，单筋/双筋，适筋梁',
            unit: 'M:kN·m, As:mm², b,h:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="grid2">' +
                // 输入面板
                '<div class="panel"><div class="panel-title">基本参数</div>' +
                '<form id="f-rect"><div class="grid2">' +
                numField('r_b', '截面宽度 b', 'mm', 300, '矩形截面宽度') +
                numField('r_h', '截面高度 h', 'mm', 600) +
                selField('r_con', '混凝土强度等级', conOpts('C30')) +
                selField('r_reb', '钢筋级别', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('r_As', '受拉钢筋面积 A<sub>s</sub>', 'mm²', 1473, '受拉纵筋总面积，可按直径根数换算') +
                numField('r_AsP', '受压钢筋面积 A<sub>s</sub>′', 'mm²', 0, '双筋时填写，单筋填 0') +
                numField('r_as', '受拉筋 a<sub>s</sub>', 'mm', 40, '受拉钢筋合力点到受拉边缘的距离') +
                numField('r_as2', '受压筋 a<sub>s</sub>′', 'mm', 40, '受压钢筋合力点到受压边缘的距离') +
                '</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="r_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="r_reset">重置</button>' +
                '</div></form></div>' +
                // 结果 + SVG 面板
                '<div class="panel"><div class="panel-title">截面预览 & 结果摘要</div>' +
                '<div id="r_svg" style="display:flex;justify-content:center;padding:8px 0 4px"></div>' +
                '<div id="r_result"></div></div></div>' +
                // 统一计算书区域
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算书</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="r_proc"></div></div></div></div>';
        },
        bind: function () {
            function svgPreview(b, h, asV, as2V, isD) {
                var W = 200, H = 240, top = 14;
                var maxD = Math.max(b, h), s = Math.min(160 / maxD, 2.5);
                var dw = Math.max(b * s, 28), dh = h * s;
                var x0 = 16 + (W - 32 - dw) / 2, y0 = top, yt = y0 + dh - asV * s, yc = y0 + as2V * s;
                var o = '';
                o += '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;">';
                o += '<rect x="' + fmt(x0,1) + '" y="' + y0 + '" width="' + fmt(dw,1) + '" height="' + fmt(dh,1) + '" fill="#eef2f7" stroke="#94a3b8" stroke-width="1.2"/>';
                o += '<rect x="' + fmt(x0+dw*0.15,1) + '" y="' + fmt(yt-3.5,1) + '" width="' + fmt(dw*0.7,1) + '" height="7" rx="3.5" fill="#2563eb"/>';
                o += '<text x="' + fmt(x0+dw/2,1) + '" y="' + fmt(yt+14,1) + '" text-anchor="middle" font-size="11" fill="#1e293b">As</text>';
                if (isD) {
                    o += '<rect x="' + fmt(x0+dw*0.15,1) + '" y="' + fmt(yc-3.5,1) + '" width="' + fmt(dw*0.7,1) + '" height="7" rx="3.5" fill="#9CA3AF"/>';
                    o += '<text x="' + fmt(x0+dw/2,1) + '" y="' + fmt(yc-8,1) + '" text-anchor="middle" font-size="11" fill="#6B7280">As\u2032</text>';
                }
                o += '<line x1="' + fmt(x0+dw+4,1) + '" y1="' + fmt(yt,1) + '" x2="' + fmt(x0+dw+4,1) + '" y2="' + fmt(y0+dh,1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(x0+dw+7,1) + '" y="' + fmt((yt+y0+dh)/2+3,1) + '" font-size="10" fill="#64748b">as</text>';
                o += '<line x1="' + fmt(x0+dw+13,1) + '" y1="' + y0 + '" x2="' + fmt(x0+dw+13,1) + '" y2="' + fmt(yt,1) + '" stroke="#2563eb" stroke-width="1"/>';
                o += '<text x="' + fmt(x0+dw+16,1) + '" y="' + fmt((y0+yt)/2+3,1) + '" font-size="10" fill="#2563eb">h0</text>';
                o += '<line x1="' + fmt(x0-4,1) + '" y1="' + y0 + '" x2="' + fmt(x0-4,1) + '" y2="' + fmt(y0+dh,1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(x0-8,1) + '" y="' + fmt((y0+y0+dh)/2+3,1) + '" text-anchor="end" font-size="10" fill="#64748b">h</text>';
                o += '<line x1="' + fmt(x0,1) + '" y1="' + fmt(y0+dh+4,1) + '" x2="' + fmt(x0+dw,1) + '" y2="' + fmt(y0+dh+4,1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(x0+dw/2,1) + '" y="' + fmt(y0+dh+17,1) + '" text-anchor="middle" font-size="10" fill="#64748b">b</text>';
                o += '</svg>'; return o;
            }
            function calc() {
                var out = document.getElementById('r_result'), proc = document.getElementById('r_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; document.getElementById('r_svg').innerHTML = ''; return; }
                var b = parseFloat(document.getElementById('r_b').value);
                var h = parseFloat(document.getElementById('r_h').value);
                var con = CONCRETE[document.getElementById('r_con').value];
                var reb = REBAR_FLEX[document.getElementById('r_reb').value];
                var As = parseFloat(document.getElementById('r_As').value);
                var AsP = parseFloat(document.getElementById('r_AsP').value) || 0;
                var asV = parseFloat(document.getElementById('r_as').value);
                var as2V = parseFloat(document.getElementById('r_as2').value) || asV;
                if (!(b > 0 && h > 0)) return err('截面宽度 b 与高度 h 必须为正数。');
                if (!(As > 0)) return err('受拉钢筋面积 A<sub>s</sub> 必须大于 0。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应介于 0 与 h 之间。');
                if (AsP > 0 && !(as2V > 0 && as2V < h)) return err('a<sub>s</sub>\u2032 应介于 0 与 h 之间。');
                var h0 = h - asV, fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var fy = reb.fy, fyp = reb.fyp, es = reb.es;
                var xi_b = b1 / (1 + fy / (es * ecu));
                var isD = AsP > 0, x, sigmaSp = 0, branch = '';
                var st = [];
                st.push('<div class="step"><b>① 截面与材料</b>　h<sub>0</sub> = ' + fmt(h) + ' − ' + fmt(asV) + ' = <b>' + fmt(h0) + ' mm</b>；f<sub>c</sub>=' + fc + '，f<sub>t</sub>=' + ft + '，α<sub>1</sub>=' + a1 + '，β<sub>1</sub>=' + b1 + '，f<sub>y</sub>=' + fy + '，f<sub>y</sub>\u2032=' + fyp + ' N/mm²。</div>');
                st.push('<div class="step"><b>② 界限相对受压区高度</b>　ξ<sub>b</sub> = β<sub>1</sub>/(1+f<sub>y</sub>/(E<sub>s</sub>ε<sub>cu</sub>)) = <b>' + fmt(xi_b, 4) + '</b></div>');
                if (!isD) {
                    x = fy * As / (a1 * fc * b); branch = 'single';
                    st.push('<div class="step"><b>③ 受压区高度（单筋）</b>　x = f<sub>y</sub>A<sub>s</sub>/(α<sub>1</sub>f<sub>c</sub>b) = ' + fy + '×' + As + '/(1.0×' + fc + '×' + b + ') = <b>' + fmt(x, 1) + ' mm</b></div>');
                } else {
                    var xY = (fy * As - fyp * AsP) / (a1 * fc * b);
                    if (xY <= 0) return err('受压钢筋相对过多（f<sub>y</sub>A<sub>s</sub> − f<sub>y</sub>\u2032A<sub>s</sub>\u2032 ≤ 0），截面无法平衡。');
                    if (xY >= 2 * as2V) {
                        x = xY; sigmaSp = fyp; branch = 'dy';
                        st.push('<div class="step"><b>③ 受压区高度（双筋）</b>　x = (f<sub>y</sub>A<sub>s</sub>−f<sub>y</sub>\u2032A<sub>s</sub>\u2032)/(α<sub>1</sub>f<sub>c</sub>b) = <b>' + fmt(x, 1) + ' mm</b> ≥ 2a<sub>s</sub>\u2032 = ' + fmt(2*as2V,0) + '，受压钢筋屈服' + tag('ok','受压筋屈服') + '</div>');
                    } else {
                        var A = a1 * fc * b, B = es * ecu * AsP - fy * As, C = -es * ecu * AsP * as2V;
                        var disc = B * B - 4 * A * C;
                        if (disc < 0) return err('计算出现负判别式，请检查参数。');
                        x = (-B + Math.sqrt(disc)) / (2 * A);
                        sigmaSp = es * ecu * (x - as2V) / x;
                        if (sigmaSp >= fyp) { x = xY; sigmaSp = fyp; branch = 'dy'; }
                        else branch = 'ds';
                        if (branch === 'ds') {
                            st.push('<div class="step"><b>③ 受压区高度（双筋，受压钢筋未屈服）</b>　应变协调求解 A=' + fmt(A,1) + '，B=' + fmt(B,1) + '，C=' + fmt(C,1) + ' ⇒ <b>x = ' + fmt(x,1) + ' mm</b> &lt; 2a<sub>s</sub>\u2032=' + fmt(2*as2V,0) + '；σ<sub>s</sub>\u2032 = E<sub>s</sub>ε<sub>cu</sub>(x−a<sub>s</sub>\u2032)/x = <b>' + fmt(sigmaSp,1) + ' N/mm²</b> &lt; f<sub>y</sub>\u2032' + tag('warn','按应变协调') + '</div>');
                        } else {
                            st.push('<div class="step"><b>③ 受压区高度（双筋）</b>　x = <b>' + fmt(x,1) + ' mm</b>，受压钢筋屈服。</div>');
                        }
                    }
                }
                var xi = x / h0, over = xi > xi_b, Mu, xDisp = x;
                if (over) {
                    var xb = xi_b * h0, Mc = a1 * fc * b * xb * (h0 - xb / 2), Ms = isD ? fyp * AsP * (h0 - as2V) : 0;
                    Mu = (Mc + Ms) / 1e6; xDisp = xb;
                    st.push('<div class="step"><b>④ 破坏形态</b>　ξ = ' + fmt(xi,4) + ' &gt; ξ<sub>b</sub> = ' + fmt(xi_b,4) + '，超筋' + tag('err','超筋') + '</div>');
                    st.push('<div class="step"><b>⑤ 承载力（界限估算）</b>　M<sub>u</sub> = α<sub>1</sub>f<sub>c</sub>b x<sub>b</sub>(h<sub>0</sub>−x<sub>b</sub>/2)' + (isD ? ' + f<sub>y</sub>\u2032A<sub>s</sub>\u2032(h<sub>0</sub>−a<sub>s</sub>\u2032)' : '') + ' = <b>' + fmt(Mu,2) + ' kN·m</b></div>');
                } else {
                    st.push('<div class="step"><b>④ 破坏形态</b>　ξ = ' + fmt(xi,4) + ' ≤ ξ<sub>b</sub> = ' + fmt(xi_b,4) + '，适筋' + tag('ok','适筋') + '</div>');
                    if (branch === 'single') { Mu = fy * As * (h0 - x / 2) / 1e6; st.push('<div class="step"><b>⑤ 承载力</b>　M<sub>u</sub> = f<sub>y</sub>A<sub>s</sub>(h<sub>0</sub>−x/2) = <b>' + fmt(Mu,2) + ' kN·m</b></div>'); }
                    else { var Mc2 = a1*fc*b*x*(h0-x/2), Ms2 = sigmaSp*AsP*(h0-as2V); Mu = (Mc2+Ms2)/1e6;
                        st.push('<div class="step"><b>⑤ 承载力</b>　M<sub>u</sub> = α<sub>1</sub>f<sub>c</sub>b x(h<sub>0</sub>−x/2) + σ<sub>s</sub>\u2032A<sub>s</sub>\u2032(h<sub>0</sub>−a<sub>s</sub>\u2032) = ' + fmt(Mc2/1e6,2) + ' + ' + fmt(Ms2/1e6,2) + ' = <b>' + fmt(Mu,2) + ' kN·m</b></div>'); }
                }
                var rho_min = rhoMinFlex(ft, fy).rho;
                var AsMin = rho_min * b * h, rho = As / (b * h0), rhoFull = As / (b * h);
                var isUnder = As >= AsMin;
                st.push('<div class="step"><b>⑥ 最小配筋率（GB 55008-2021 第 4.4.6 条，按全截面 b·h）</b>　ρ<sub>min</sub> = max(0.2%, 0.45f<sub>t</sub>/f<sub>y</sub>) = ' + fmt(rho_min*100,2) + '%；A<sub>s,min</sub> = ' + fmt(AsMin,0) + ' mm²；A<sub>s</sub>=' + As + ' mm² ⇒ ' + (isUnder ? '满足' : '不满足') + (isUnder ? tag('ok','满足') : tag('err','少筋')) + '</div>');
                var stMsg, stCls;
                if (over) { stMsg = '超筋（ξ &gt; ξ<sub>b</sub>），按界限承载力估算'; stCls = 'badge-err'; }
                else if (!isUnder) { stMsg = '少筋：A<sub>s</sub> &lt; ρ<sub>min</sub>·b·h，不满足 GB 55008-2021 第 4.4.6 条'; stCls = 'badge-warn'; }
                else { stMsg = '适筋截面，满足要求'; stCls = 'badge-ok'; }
                var html = resultRow('相对受压区高度 ξ', fmt(xi,4) + (over ? '（&gt;ξ<sub>b</sub>）' : ''));
                html += resultRow('界限受压区高度 ξ<sub>b</sub>', fmt(xi_b,4));
                html += resultRow('受压区高度 x', fmt(xDisp,1) + ' mm' + (over ? '（界限 x<sub>b</sub>）' : ''));
                if (isD && !over) html += resultRow('受压钢筋应力 σ<sub>s</sub>\u2032', branch === 'dy' ? fmt(fyp,0) + ' N/mm²（屈服）' : fmt(sigmaSp,1) + ' N/mm²（未屈服）');
                html += resultRow('抗弯承载力 M<sub>u</sub>', '<span class="highlight">' + fmt(Mu,2) + ' kN·m</span>');
                html += resultRow('配筋率 ρ（b·h<sub>0</sub>）', fmt(rho*100,2) + '%');
                html += resultRow('最小配筋率 / A<sub>s,min</sub>', fmt(rho_min*100,2) + '% / ' + fmt(AsMin,0) + ' mm²');
                html += resultRow('判定', badge(stCls, stMsg));
                 out.innerHTML = html;
                 proc.innerHTML = st.join('');
                 var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                 document.getElementById('r_svg').innerHTML = svgPreview(b, h, asV, isD ? as2V : asV, isD);
                 window._BR_RESULT = {
                     b: b, h: h, asV: asV, as2V: as2V, isD: isD, As: As, AsP: AsP,
                     conGrade: document.getElementById('r_con').value,
                     rebGrade: document.getElementById('r_reb').value,
                     fc: fc, ft: ft, fy: fy, fyp: fyp, alpha1: a1, beta1: b1, ecu: ecu, es: es,
                     xi_b: xi_b, xi: xi, x: xDisp, h0: h0,
                     Mu: Mu, over: over, branch: branch, sigmaSp: sigmaSp,
                     rho_min: rho_min, AsMin: AsMin, rho: rho, rhoFull: rhoFull,
                     isUnder: isUnder, stMsg: stMsg, stCls: stCls, steps: st.join(''),
                     alpha_s: typeof alpha_s !== 'undefined' ? alpha_s : 0,
                     gamma_s: typeof gamma_s !== 'undefined' ? gamma_s : 0
                 };

                 // ===== 统一计算书 =====
                 var book = buildBeamRectBook({
                     b: b, h: h, asV: asV, as2V: as2V, isD: isD, As: As, AsP: AsP,
                     conGrade: document.getElementById('r_con').value,
                     rebGrade: document.getElementById('r_reb').value,
                     fc: fc, ft: ft, fy: fy, fyp: fyp, alpha1: a1, beta1: b1, ecu: ecu, es: es,
                     xi_b: xi_b, xi: xi, x: xDisp, h0: h0,
                     Mu: Mu, over: over, branch: branch, sigmaSp: sigmaSp,
                     rho_min: rho_min, AsMin: AsMin, rho: rho, rhoFull: rhoFull,
                     isUnder: isUnder, stMsg: stMsg, stCls: stCls
                 });
                 window.currentCalcBook = book;
                 tyaiRenderCalcBook('#r_proc', book);
             }
            function reset() {
                ['r_b','r_h','r_As','r_AsP','r_as','r_as2'].forEach(function (id) { document.getElementById(id).value = { r_b:300, r_h:600, r_As:1473, r_AsP:0, r_as:40, r_as2:40 }[id]; });
                document.getElementById('r_con').value = 'C30'; document.getElementById('r_reb').value = 'HRB400';
                calc();
            }
            document.getElementById('r_calc').addEventListener('click', calc);
            document.getElementById('r_reset').addEventListener('click', reset);
            document.getElementById('f-rect').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS = window.TOOLS || {};
    window.TOOLS['beam-rect'] = tool;
})();
