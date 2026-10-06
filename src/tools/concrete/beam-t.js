(function () {
    var tool = {
        title: 'T形梁正截面承载力',
        sub: '第一类 / 第二类 T 形截面受弯 · GB/T 50010-2010（2024年版） 第 6.2.11 条',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '6.2.11',
            limitations: 'T形/I形截面受弯构件，第一类/第二类判别',
            unit: 'M:kN·m, As:mm², b,h,bf:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">截面与材料</div>' +
                '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">' +
                '<div style="flex:1 1 340px;min-width:0;"><form id="f-t"><div class="grid2">' +
                numField('t_b', '腹板宽度 b', 'mm', 250) +
                numField('t_h', '截面高度 h', 'mm', 600) +
                numField('t_bf', '翼缘计算宽度 b<sub>f</sub>\u2032', 'mm', 500, '整体肋形梁：min(b+12h<sub>f</sub>\u2032, b+S<sub>n</sub>, l<sub>0</sub>/3)；独立梁：min(b+12h<sub>f</sub>\u2032, l<sub>0</sub>/3)') +
                numField('t_hf', '翼缘厚度 h<sub>f</sub>\u2032', 'mm', 100) +
                selField('t_con', '混凝土强度等级', conOpts('C30')) +
                selField('t_reb', '钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                numField('t_As', '受拉钢筋面积 A<sub>s</sub>', 'mm²', 1963) +
                numField('t_as', '受拉筋合力点距离 a<sub>s</sub>', 'mm', 40) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="t_calc">计算承载力</button>' +
                '<button type="button" class="btn btn-secondary" id="t_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="side-col" style="flex:0 1 220px;min-width:180px;"><div class="preview"><div id="t_svg"></div><div class="cap">T形截面示意</div><div class="note">示意</div></div></div>' +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="t_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="t_proc"></div></div></div></div>';
        },
        bind: function () {
            function svgT(b, h, bf, hf) {
                var W = 200, H = 220, s = Math.min(150 / Math.max(h, 400), 1.2), x0 = 16, y0 = 14;
                var db = Math.max(b * s, 30), dh = h * s, dbf = Math.max(bf * s, db + 20);
                var o = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;">';
                var cx = (W - dbf) / 2;
                o += '<path d="M' + cx + ' ' + y0 + ' h' + dbf + ' v' + (hf*s) + ' h' + (-(dbf-db)/2) + ' v' + (dh-hf*s) + ' h' + (-db) + ' v' + (-(dh-hf*s)) + ' Z" fill="#eef2f7" stroke="#94a3b8" stroke-width="1.2"/>';
                o += '<rect x="' + fmt(cx+ (dbf-db)/2 + db*0.15,1) + '" y="' + fmt(y0+dh-3.5,1) + '" width="' + fmt(db*0.7,1) + '" height="7" rx="3.5" fill="#2563eb"/>';
                o += '<text x="' + fmt(cx+ (dbf-db)/2 + db/2,1) + '" y="' + fmt(y0+dh+14,1) + '" text-anchor="middle" font-size="11" fill="#1e293b">As</text>';
                o += '<line x1="' + fmt(cx-4,1) + '" y1="' + y0 + '" x2="' + fmt(cx-4,1) + '" y2="' + fmt(y0+dh,1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(cx-8,1) + '" y="' + fmt(y0+dh/2+3,1) + '" text-anchor="end" font-size="10" fill="#64748b">h</text>';
                o += '<line x1="' + cx + '" y1="' + fmt(y0+dh+4,1) + '" x2="' + fmt(cx+dbf,1) + '" y2="' + fmt(y0+dh+4,1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(cx+dbf/2,1) + '" y="' + fmt(y0+dh+17,1) + '" text-anchor="middle" font-size="10" fill="#64748b">bf\u2032</text>';
                o += '<line x1="' + fmt(cx+ (dbf-db)/2 + db + 4,1) + '" y1="' + fmt(y0+hf*s,1) + '" x2="' + fmt(cx+ (dbf-db)/2 + db + 4,1) + '" y2="' + fmt(y0+dh,1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(cx+ (dbf-db)/2 + db + 7,1) + '" y="' + fmt(y0+(hf*s+dh)/2+3,1) + '" font-size="10" fill="#64748b">b</text>';
                o += '</svg>';
                return o;
            }
            function calc() {
                var out = document.getElementById('t_result'), proc = document.getElementById('t_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var b = parseFloat(document.getElementById('t_b').value);
                var h = parseFloat(document.getElementById('t_h').value);
                var bf = parseFloat(document.getElementById('t_bf').value);
                var hf = parseFloat(document.getElementById('t_hf').value);
                var con = CONCRETE[document.getElementById('t_con').value];
                var reb = REBAR_FLEX[document.getElementById('t_reb').value];
                var materialError = concreteRebarError(con, reb);
                if (materialError) return err(materialError);
                var As = parseFloat(document.getElementById('t_As').value);
                var asV = parseFloat(document.getElementById('t_as').value);
                if (!(b > 0 && h > 0 && bf > b && hf > 0)) return err('请输入有效截面：腹板 b &gt; 0，翼缘计算宽度 b<sub>f</sub>\u2032 &gt; b。');
                if (!(As > 0)) return err('受拉钢筋面积 A<sub>s</sub> 必须大于 0。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应介于 0 与 h 之间。');
                var h0 = h - asV, fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var fy = reb.fy, es = reb.es;
                var xi_b = b1 / (1 + fy / (es * ecu));
                var st = [];
                st.push('<div class="step"><b>① 截面与材料</b>　h<sub>0</sub> = <b>' + fmt(h0) + ' mm</b>；b=' + b + '，b<sub>f</sub>\u2032=' + bf + '，h<sub>f</sub>\u2032=' + hf + '；f<sub>c</sub>=' + fc + '，f<sub>y</sub>=' + fy + ' N/mm²。</div>');
                st.push('<div class="step"><b>② 界限高度</b>　ξ<sub>b</sub> = <b>' + fmt(xi_b,4) + '</b></div>');
                var x1 = fy * As / (a1 * fc * bf), isFirst = x1 <= hf, x, Mu, over = false, xi;
                if (isFirst) {
                    x = x1;
                    st.push('<div class="step"><b>③ 类型判别</b>　x = f<sub>y</sub>A<sub>s</sub>/(α<sub>1</sub>f<sub>c</sub>b<sub>f</sub>\u2032) = <b>' + fmt(x,1) + ' mm</b> ≤ h<sub>f</sub>\u2032 = ' + fmt(hf,0) + ' ⇒ <b>第一类 T 形截面</b>（按宽度 b<sub>f</sub>\u2032 的矩形计算）' + tag('ok','第一类') + '</div>');
                    var xi = x / h0;
                    if (xi > xi_b) { over = true; x = xi_b * h0; Mu = a1 * fc * bf * x * (h0 - x / 2) / 1e6;
                        st.push('<div class="step"><b>④ 破坏形态</b>　ξ = ' + fmt(xi,4) + ' &gt; ξ<sub>b</sub>，超筋' + tag('err','超筋') + '</div>');
                        st.push('<div class="step"><b>⑤ 承载力（界限估算）</b>　M<sub>u</sub> = <b>' + fmt(Mu,2) + ' kN·m</b></div>');
                    } else {
                        Mu = fy * As * (h0 - x / 2) / 1e6;
                        st.push('<div class="step"><b>④ 破坏形态</b>　ξ = ' + fmt(xi,4) + ' ≤ ξ<sub>b</sub>，适筋' + tag('ok','适筋') + '</div>');
                        st.push('<div class="step"><b>⑤ 承载力</b>　M<sub>u</sub> = f<sub>y</sub>A<sub>s</sub>(h<sub>0</sub>−x/2) = <b>' + fmt(Mu,2) + ' kN·m</b></div>');
                    }
                } else {
                    var numer = fy * As - a1 * fc * (bf - b) * hf;
                    x = numer / (a1 * fc * b);
                    var xi2 = x / h0;
                    xi = xi2;
                    st.push('<div class="step"><b>③ 类型判别</b>　x = ' + fmt(x1,1) + ' mm &gt; h<sub>f</sub>\u2032 = ' + fmt(hf,0) + ' ⇒ <b>第二类 T 形截面</b>' + tag('warn','第二类') + '</div>');
                    st.push('<div class="step"><b>④ 受压区高度</b>　x = [f<sub>y</sub>A<sub>s</sub> − α<sub>1</sub>f<sub>c</sub>(b<sub>f</sub>\u2032−b)h<sub>f</sub>\u2032]/(α<sub>1</sub>f<sub>c</sub>b) = <b>' + fmt(x,1) + ' mm</b></div>');
                    if (xi2 > xi_b) { over = true; x = xi_b * h0; }
                    var Mc = a1 * fc * b * x * (h0 - x / 2);
                    var Mf = a1 * fc * (bf - b) * hf * (h0 - hf / 2);
                    Mu = (Mc + Mf) / 1e6;
                    if (over) { st.push('<div class="step"><b>⑤ 破坏形态</b>　ξ = ' + fmt(xi2,4) + ' &gt; ξ<sub>b</sub>，超筋，按界限 x<sub>b</sub>=' + fmt(x,1) + ' 估算' + tag('err','超筋') + '</div>'); }
                    else { st.push('<div class="step"><b>⑤ 破坏形态</b>　ξ = ' + fmt(xi2,4) + ' ≤ ξ<sub>b</sub>，适筋' + tag('ok','适筋') + '</div>'); }
                    st.push('<div class="step"><b>⑥ 承载力</b>　M<sub>u</sub> = α<sub>1</sub>f<sub>c</sub>b x(h<sub>0</sub>−x/2) + α<sub>1</sub>f<sub>c</sub>(b<sub>f</sub>\u2032−b)h<sub>f</sub>\u2032(h<sub>0</sub>−h<sub>f</sub>\u2032/2) = ' + fmt(Mc/1e6,2) + ' + ' + fmt(Mf/1e6,2) + ' = <b>' + fmt(Mu,2) + ' kN·m</b></div>');
                }
                var rho_min = rhoMinFlex(ft, fy).rho;
                var AsMin = rho_min * b * h, rho = As / (b * h0);
                var isUnder = As >= AsMin;
                st.push('<div class="step"><b>⑦ 最小配筋率（按腹板 b·h）</b>　ρ<sub>min</sub> = ' + fmt(rho_min*100,2) + '%；A<sub>s,min</sub> = ' + fmt(AsMin,0) + ' mm²；A<sub>s</sub>=' + As + ' ⇒ ' + (isUnder ? '满足' : '不满足') + (isUnder ? tag('ok','满足') : tag('err','少筋')) + '</div>');
                var stMsg, stCls;
                if (over) { stMsg = '超筋，按界限承载力估算'; stCls = 'badge-err'; }
                else if (!isUnder) { stMsg = '少筋，不满足 GB 55008-2021 第 4.4.6 条'; stCls = 'badge-warn'; }
                else { stMsg = '适筋截面，满足要求（' + (isFirst ? '第一类' : '第二类') + '）'; stCls = 'badge-ok'; }
                var html = resultRow('截面类型', isFirst ? '第一类 T 形（x ≤ h<sub>f</sub>\u2032）' : '第二类 T 形（x &gt; h<sub>f</sub>\u2032）');
                html += resultRow('受压区高度 x', fmt(x,1) + ' mm' + (over ? '（界限）' : ''));
                html += resultRow('相对受压区高度 ξ / ξ<sub>b</sub>', fmt(x/h0,4) + ' / ' + fmt(xi_b,4));
                html += resultRow('抗弯承载力 M<sub>u</sub>', '<span class="highlight">' + fmt(Mu,2) + ' kN·m</span>');
                html += resultRow('配筋率 ρ（b·h<sub>0</sub>）', fmt(rho*100,2) + '%');
                html += resultRow('最小配筋率 / A<sub>s,min</sub>', fmt(rho_min*100,2) + '% / ' + fmt(AsMin,0) + ' mm²');
                html += resultRow('判定', badge(stCls, stMsg));
                 out.innerHTML = html;
                 proc.innerHTML = st.join('');
                 var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                 document.getElementById('t_svg').innerHTML = svgT(b, h, bf, hf);
                 window._BT_RESULT = {
                     b: b, h: h, bf: bf, hf: hf, asV: asV, As: As,
                     conGrade: document.getElementById('t_con').value,
                     rebGrade: document.getElementById('t_reb').value,
                     fc: fc, ft: ft, fy: fy, alpha1: a1, beta1: b1, ecu: ecu, es: es,
                     type: isFirst ? '第一类' : '第二类', h0: h0, x: x, xi: xi, xi_b: xi_b,
                     Mu: Mu, over: over, rho_min: rho_min, AsMin: AsMin,
                     rho: rho, isUnder: isUnder, stMsg: stMsg, stCls: stCls,
                     steps: st.join('')
                 };
             }
            function reset() {
                ['t_b','t_h','t_bf','t_hf','t_As','t_as'].forEach(function (id) { document.getElementById(id).value = { t_b:250, t_h:600, t_bf:500, t_hf:100, t_As:1963, t_as:40 }[id]; });
                document.getElementById('t_con').value = 'C30'; document.getElementById('t_reb').value = 'HRB400';
                calc();
            }
            document.getElementById('t_calc').addEventListener('click', calc);
            document.getElementById('t_reset').addEventListener('click', reset);
            document.getElementById('f-t').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS = window.TOOLS || {};
    window.TOOLS['beam-t'] = tool;
})();
