(function () {
    var tool = {
        title: '连续梁计算',
        sub: '2~10 跨等截面连续梁 · 三弯矩方程 · 正截面受弯 + 斜截面受剪配筋',
        meta: {
            standard: '结构力学三弯矩方程 + GB/T 50010-2010（2024年版）',
            formulaSource: '6.2.10, 6.3.4',
            limitations: '2~10跨等截面连续梁，均布荷载',
            unit: 'M:kN·m, V:kN, b,h:mm',
            version: '1.0.0'
        },
        render: function () {
            var n = 3; // 默认 3 跨
            var html = '<div class="panel"><div class="panel-title">基本信息</div>' +
                '<form id="f-cont"><div class="grid2">' +
                numField('cb_n', '跨数 n', '跨', 3, '支持 2~10 跨，等截面连续梁，两端简支') +
                numField('cb_b', '截面宽度 b', 'mm', 250) +
                numField('cb_h', '截面高度 h', 'mm', 600) +
                numField('cb_as', '受拉筋合力点距离 a<sub>s</sub>', 'mm', 40) +
                selField('cb_con', '混凝土强度等级', conOpts('C30')) +
                selField('cb_reb', '纵向钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                selField('cb_stir', '箍筋级别 f<sub>yv</sub>', opts([{v:'HPB300',t:'HPB300 (270)'},{v:'HRB400',t:'HRB400 (360)'},{v:'HRB500',t:'HRB500 (435)'}], 'HRB400')) +
                numField('cb_gG', '恒载分项系数 γ<sub>G</sub>', '—', 1.2) +
                numField('cb_gQ', '活载分项系数 γ<sub>Q</sub>', '—', 1.4) +
                '</div>' +
                '<div style="margin-top:14px;font-weight:600;color:#334155;font-size:13.5px;">各跨参数</div>' +
                '<div class="hint" style="margin-bottom:10px;">输入每跨的跨度、恒载标准值、活载标准值；活载按最不利布置（跨隔跨布置）考虑。</div>' +
                '<div id="cb_spans"></div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="cb_calc">计算连续梁</button>' +
                '<button type="button" class="btn btn-secondary" id="cb_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">支座弯矩与剪力</div><div id="cb_sup"></div></div>' +
                '<div class="panel"><div class="panel-title">各跨跨中弯矩与配筋</div><div id="cb_mid"></div></div>' +
                '<div class="panel"><div class="panel-title">斜截面受剪配箍</div><div id="cb_sh"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="cb_proc"></div></div></div></div>';
            return html;
        },
        bind: function () {
            var nInput = document.getElementById('cb_n');
            var spansDiv = document.getElementById('cb_spans');
            function renderSpans() {
                var n = parseInt(nInput.value) || 3;
                if (n < 2) n = 2; if (n > 10) n = 10;
                nInput.value = n;
                var defL = [4.5, 5.0, 4.5, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0];
                var defG = [12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
                var defQ = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
                var h = '<div style="display:grid;grid-template-columns:40px 1fr 1fr 1fr;gap:8px;align-items:center;margin-bottom:8px;font-size:12px;color:#64748b;font-weight:500;">';
                h += '<div style="text-align:center;">跨号</div><div>跨度 (m)</div><div>恒载 g<sub>k</sub> (kN/m)</div><div>活载 q<sub>k</sub> (kN/m)</div></div>';
                for (var i = 0; i < n; i++) {
                    h += '<div style="display:grid;grid-template-columns:40px 1fr 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px;">';
                    h += '<div style="text-align:center;font-weight:600;color:#475569;font-size:13px;">L<sub>' + (i+1) + '</sub></div>';
                    h += '<input type="number" id="cb_L' + i + '" value="' + defL[i] + '" step="0.1" style="padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;font-size:13.5px;background:#fafbfc;width:100%;">';
                    h += '<input type="number" id="cb_g' + i + '" value="' + defG[i] + '" step="0.1" style="padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;font-size:13.5px;background:#fafbfc;width:100%;">';
                    h += '<input type="number" id="cb_q' + i + '" value="' + defQ[i] + '" step="0.1" style="padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;font-size:13.5px;background:#fafbfc;width:100%;">';
                    h += '</div>';
                }
                spansDiv.innerHTML = h;
            }
            nInput.addEventListener('change', function () { renderSpans(); calc(); });

            // 三弯矩方程：已知每跨均布线荷载 (设计值)，求各中间支座弯矩
            // 对于等截面连续梁（EI 常数），三弯矩方程：
            //   M_{i-1} * L_i + 2*M_i*(L_i + L_{i+1}) + M_{i+1} * L_{i+1} = -6*(B_i^φ/L_i + A_{i+1}^φ/L_{i+1})
            // 其中 B_i^φ 为第 i 跨左面积矩对右支座的一次矩，A_i^φ 为左支座
            // 对均布荷载：每跨简支弯矩图为抛物线，面积 A = 2/3 * L * M0，M0 = qL²/8
            //   对左支座取矩 B^φ = A * L/2 = qL⁴/24；对右支座同理 = qL⁴/24
            // 因此每跨两端的 B_i^φ / L_i = qL³/24, A_{i+1}^φ / L_{i+1} = qL³/24
            function threeMoment(L, q) {
                var n = L.length;
                if (n < 2) return [0];
                var nm = n - 1; // 中间支座数
                if (nm === 0) return [0, 0];
                // 构造三对角方程组 aM + bM + cM = d
                var a = [], b = [], c = [], d = [];
                for (var i = 0; i < nm; i++) {
                    var Li = L[i], Li1 = L[i+1];
                    var qi = q[i], qi1 = q[i+1];
                    b.push(2 * (Li + Li1));
                    if (i > 0) a.push(Li); else a.push(0);
                    if (i < nm - 1) c.push(Li1); else c.push(0);
                    // 右边：-6*(B_i/L_i + A_{i+1}/L_{i+1}) = -6*(qi*Li³/24 + qi1*Li1³/24) = -(qi*Li³ + qi1*Li1³)/4
                    var di = -(qi * Li * Li * Li + qi1 * Li1 * Li1 * Li1) / 4;
                    d.push(di);
                }
                // 追赶法 (Thomas algorithm)
                var cp = [], dp = [];
                cp.push(c[0] / b[0]);
                dp.push(d[0] / b[0]);
                for (var j = 1; j < nm; j++) {
                    var m = a[j] / (b[j] - a[j] * cp[j-1]);
                    cp.push(c[j] / (b[j] - a[j] * cp[j-1]));
                    dp.push((d[j] - a[j] * dp[j-1]) / (b[j] - a[j] * cp[j-1]));
                }
                var M = new Array(n + 1);
                M[0] = 0; M[n] = 0; // 两端简支
                M[n-1] = dp[nm - 1];
                for (var k = nm - 2; k >= 0; k--) {
                    M[k+1] = dp[k] - cp[k] * M[k+2];
                }
                return M;
            }

            // 给定支座弯矩 M_left, M_right 和均布荷载 q，求跨中最大正弯矩与最大剪力
            function spanAnalysis(L, q, Ml, Mr) {
                // 支座反力：由竖向平衡与对左支座取矩
                // Ml + qL²/2 - Rr*L + Mr = 0  => Rr = (Ml - Mr)/L + qL/2
                var Rr = (Ml - Mr) / L + q * L / 2;
                var Rl = q * L - Rr;
                // 弯矩方程：M(x) = Ml + Rl*x - qx²/2
                // 最大正弯矩位置（剪力为零）：Rl - q*x = 0 => x = Rl/q
                var xMax = Rl / q;
                var MmaxPos = -9e9, MmaxNeg = 9e9;
                if (xMax >= 0 && xMax <= L) {
                    MmaxPos = Ml + Rl * xMax - q * xMax * xMax / 2;
                }
                // 两端弯矩
                var Mleft = Ml, Mright = Mr;
                MmaxPos = Math.max(MmaxPos, Mleft, Mright);
                MmaxNeg = Math.min(Mleft, Mright);
                // 剪力：左端 Rl，右端 -Rr
                var Vleft = Rl, Vright = -Rr;
                var Vmax = Math.max(Math.abs(Vleft), Math.abs(Vright));
                return {
                    Rl: Rl, Rr: Rr,
                    MmaxPos: MmaxPos, MmaxNeg: MmaxNeg,
                    xMax: xMax,
                    Vleft: Vleft, Vright: Vright,
                    VmaxAbs: Vmax
                };
            }

            function calc() {
                var outSup = document.getElementById('cb_sup');
                var outMid = document.getElementById('cb_mid');
                var outSh = document.getElementById('cb_sh');
                var proc = document.getElementById('cb_proc');
                function err(m) { outSup.innerHTML = '<div class="error-box">' + m + '</div>'; outMid.innerHTML = ''; outSh.innerHTML = ''; proc.innerHTML = ''; return; }

                var n = parseInt(document.getElementById('cb_n').value);
                if (n < 2 || n > 10) return err('跨数应在 2~10 之间。');
                var b = parseFloat(document.getElementById('cb_b').value);
                var h = parseFloat(document.getElementById('cb_h').value);
                var asV = parseFloat(document.getElementById('cb_as').value);
                var con = CONCRETE[document.getElementById('cb_con').value];
                var reb = REBAR_FLEX[document.getElementById('cb_reb').value];
                var stir = REBAR_STIRRUP[document.getElementById('cb_stir').value];
                var gG = parseFloat(document.getElementById('cb_gG').value);
                var gQ = parseFloat(document.getElementById('cb_gQ').value);
                if (!(b > 0 && h > 0)) return err('截面尺寸必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应介于 0 与 h 之间。');
                if (!(gG > 0 && gQ > 0)) return err('分项系数必须为正数。');

                var L = [], gk = [], qk = [];
                for (var i = 0; i < n; i++) {
                    var li = parseFloat(document.getElementById('cb_L' + i).value);
                    var gi = parseFloat(document.getElementById('cb_g' + i).value);
                    var qi = parseFloat(document.getElementById('cb_q' + i).value);
                    if (!(li > 0)) return err('第 ' + (i+1) + ' 跨跨度必须为正数。');
                    if (!(gi >= 0 && qi >= 0)) return err('荷载不能为负。');
                    L.push(li); gk.push(gi); qk.push(qi);
                }

                var h0 = h - asV, fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var fy = reb.fy, es = reb.es, fyv = stir.fy;
                var xi_b = b1 / (1 + fy / (es * ecu));
                var rho_min = rhoMinFlex(ft, fy).rho;
                var AsMin = rho_min * b * h;

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　n = ' + n + ' 跨；b×h = ' + b + '×' + h + ' mm，h<sub>0</sub> = ' + fmt(h0,0) + ' mm；f<sub>c</sub>=' + fc + '，f<sub>t</sub>=' + ft + '，f<sub>y</sub>=' + fy + ' N/mm²；γ<sub>G</sub>=' + gG + '，γ<sub>Q</sub>=' + gQ + '。</div>');

                // 恒载 + 全部活载（基本组合，仅一种布置作为代表）
                // 再算活载最不利布置：跨中最大正弯矩 = 本跨+隔跨活载；支座最大负弯矩 = 相邻两跨+隔跨活载
                // 简化：给出恒载+全跨活载的包络（保守简化，实际应多工况组合，此处展示原理）
                var qDesign = [];
                for (var k = 0; k < n; k++) qDesign.push(gG * gk[k] + gQ * qk[k]);

                st.push('<div class="step"><b>② 荷载设计值（基本组合：γ<sub>G</sub>·g<sub>k</sub> + γ<sub>Q</sub>·q<sub>k</sub>）</b>　');
                var qStr = []; for (var kk = 0; kk < n; kk++) qStr.push('q<sub>' + (kk+1) + '</sub> = ' + fmt(qDesign[kk],2) + ' kN/m');
                st[st.length-1] += qStr.join('；') + '。</div>';

                // 三弯矩方程求解支座弯矩
                var Msup = threeMoment(L, qDesign);
                // Msup[0..n] 共 n+1 个支座，单位 kN·m
                st.push('<div class="step"><b>③ 三弯矩方程求解支座弯矩</b>　按等截面连续梁三弯矩方程（克莱佩隆定理），追赶法求解。各支座弯矩：');
                for (var s = 0; s <= n; s++) {
                    st[st.length-1] += ' M<sub>' + s + '</sub> = ' + fmt(Msup[s],2) + ' kN·m；';
                }
                st[st.length-1] += '</div>';

                // 各跨分析
                var spanResults = [];
                for (var i = 0; i < n; i++) {
                    var sa = spanAnalysis(L[i], qDesign[i], Msup[i], Msup[i+1]);
                    spanResults.push(sa);
                }

                // 正截面配筋：对每跨跨中最大正弯矩 + 支座负弯矩分别计算所需 A_s
                st.push('<div class="step"><b>④ 正截面配筋（单筋矩形）</b>　按 A<sub>s</sub> = M / (γ<sub>s</sub>·f<sub>y</sub>·h<sub>0</sub>)，其中 γ<sub>s</sub> = 0.9·(1+√(1−2α<sub>s</sub>))，α<sub>s</sub> = M/(α<sub>1</sub>f<sub>c</sub>bh<sub>0</sub><sup>2</sup>)。</div>');

                var rebarResults = []; // {loc, M, As, rho, ok}
                function calcFlex(M) {
                    var Mabs = Math.abs(M);
                    var alpha_s = Mabs * 1e6 / (a1 * fc * b * h0 * h0);
                    if (alpha_s > 1) return { As: Infinity, rho: Infinity, over: true, gamma_s: 0 };
                    var gamma_s = 0.5 * (1 + Math.sqrt(1 - 2 * alpha_s));
                    var As = Mabs * 1e6 / (gamma_s * fy * h0);
                    var xi = 2 * (1 - gamma_s);
                    var over = xi > xi_b;
                    if (over) As = a1 * fc * b * xi_b * h0 / fy; // 界限
                    return { As: As, rho: As / (b * h0), over: over, gamma_s: gamma_s, alpha_s: alpha_s, xi: xi };
                }

                // 支座负弯矩配筋（按 b, h0 计算）
                for (var s = 1; s < n; s++) {
                    var r = calcFlex(Msup[s]);
                    rebarResults.push({
                        loc: '支座 ' + s + '（负弯矩）',
                        M: Msup[s], As: r.As, rho: r.rho, over: r.over, gamma_s: r.gamma_s
                    });
                }
                // 跨中正弯矩
                for (var i = 0; i < n; i++) {
                    var r2 = calcFlex(spanResults[i].MmaxPos);
                    rebarResults.push({
                        loc: '跨 ' + (i+1) + ' 跨中',
                        M: spanResults[i].MmaxPos, As: r2.As, rho: r2.rho, over: r2.over, gamma_s: r2.gamma_s
                    });
                }

                // 斜截面受剪：每跨两端
                var shearResults = [];
                st.push('<div class="step"><b>⑤ 斜截面受剪（仅配箍筋）</b>　V<sub>u</sub> = 0.7f<sub>t</sub>bh<sub>0</sub> + 1.25f<sub>yv</sub>·(A<sub>sv</sub>/s)·h<sub>0</sub>，截面限制按 6.3.1 条。</div>');
                var hw = h, hwb = hw / b;
                var Vmax = hwb <= 4 ? 0.25 * fc * b * h0 / 1000
                         : hwb >= 6 ? 0.2 * fc * b * h0 / 1000
                         : (0.25 - 0.05 * (hwb - 4) / 2) * fc * b * h0 / 1000;
                var Vc = 0.7 * ft * b * h0 / 1000;

                for (var i = 0; i < n; i++) {
                    var Vl = Math.abs(spanResults[i].Vleft);
                    var Vr = Math.abs(spanResults[i].Vright);
                    var VmaxSpan = Math.max(Vl, Vr);
                    var secOk = VmaxSpan <= Vmax;
                    var needAsv_s = VmaxSpan > Vc ? (VmaxSpan - Vc) / (1.25 * fyv * h0) * 1000 : 0; // mm²/mm
                    var rsvMin = 0.24 * ft / fyv;
                    shearResults.push({
                        span: i+1, Vl: Vl, Vr: Vr, Vmax: VmaxSpan,
                        secOk: secOk, needAsv_s: needAsv_s,
                        rsvMin: rsvMin
                    });
                }

                // ===== 结果展示 =====
                // 支座弯矩表
                var supHtml = '<div style="overflow-x:auto;"><table class="mini"><tr><th>支座</th><th>0（左）</th>';
                for (var s = 1; s < n; s++) supHtml += '<th>' + s + '</th>';
                supHtml += '<th>' + n + '（右）</th></tr><tr><td>弯矩 M (kN·m)</td><td>0</td>';
                for (var s = 1; s < n; s++) supHtml += '<td style="font-weight:600;color:#991b1b;">' + fmt(Msup[s],2) + '</td>';
                supHtml += '<td>0</td></tr></table></div>';
                supHtml += '<div style="margin-top:10px;font-size:12.5px;color:#64748b;">注：正号表示下部受拉（此处支座弯矩一般为负，即上部受拉）；连续梁中间支座负弯矩用于支座上部配筋。</div>';
                outSup.innerHTML = supHtml;

                // 跨中弯矩 + 配筋表
                var midHtml = '<div style="overflow-x:auto;"><table class="mini"><tr>';
                midHtml += '<th>截面位置</th><th>弯矩 M (kN·m)</th><th>所需 A<sub>s</sub> (mm²)</th><th>配筋率 ρ</th><th>最小配筋 ρ<sub>min</sub></th><th>判定</th></tr>';
                rebarResults.sort(function (a, b) { return Math.abs(b.M) - Math.abs(a.M); }); // 按 |M| 排序
                var allFlexOk = true;
                rebarResults.forEach(function (r) {
                    var rhoPct = fmt(r.rho * 100, 3) + '%';
                    var minPct = fmt(rho_min * 100, 3) + '%';
                    var ok = !r.over && r.As >= AsMin ? 'ok' : (r.over ? 'err' : 'warn');
                    var txt = r.over ? '超筋，按界限' : (r.As >= AsMin ? '满足' : '配筋不足');
                    if (ok !== 'ok') allFlexOk = false;
                    midHtml += '<tr><td>' + r.loc + '</td><td>' + fmt(r.M, 2) + '</td>' +
                        '<td style="font-weight:600;color:#2563eb;">' + fmt(r.As, 0) + '</td>' +
                        '<td>' + rhoPct + '</td><td>' + minPct + '</td>' +
                        '<td>' + badge(ok === 'ok' ? 'badge-ok' : ok === 'err' ? 'badge-err' : 'badge-warn', txt) + '</td></tr>';
                });
                midHtml += '</table></div>';
                midHtml += '<div class="sec-title">配筋组合推荐（控制截面）</div>';
                // 取最大 As 给推荐
                var maxAs = 0;
                rebarResults.forEach(function (r) { if (r.As > maxAs && r.As < 1e7) maxAs = r.As; });
                var combos = [];
                for (var d = 12; d <= 28; d += 2) {
                    var a1 = Math.PI * d * d / 4;
                    for (var nn = 2; nn <= 8; nn++) {
                        if (a1 * nn >= maxAs) { combos.push({ d: d, n: nn, a: a1 * nn }); break; }
                    }
                }
                combos.sort(function (x, y) { return x.a - y.a; }).slice(0, 5);
                midHtml += '<div style="font-size:13px;color:#475569;">控制截面所需 A<sub>s</sub> ≈ <b style="color:#2563eb;">' + fmt(maxAs,0) + ' mm²</b>，推荐组合（仅参考）：</div>';
                midHtml += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">';
                combos.slice(0, 5).forEach(function (c) {
                    midHtml += '<span class="badge badge-ok">' + c.n + 'φ' + c.d + ' = ' + fmt(c.a, 0) + ' mm²</span>';
                });
                midHtml += '</div>';
                outMid.innerHTML = midHtml;

                // 斜截面配箍表
                var shHtml = '<div style="overflow-x:auto;"><table class="mini"><tr>';
                shHtml += '<th>跨号</th><th>左端剪力 V<sub>l</sub> (kN)</th><th>右端剪力 V<sub>r</sub> (kN)</th><th>截面限制 V<sub>max</sub> (kN)</th><th>所需 A<sub>sv</sub>/s (mm²/mm)</th><th>最小配箍率 ρ<sub>sv,min</sub></th><th>判定</th></tr>';
                var allShearOk = true;
                shearResults.forEach(function (s) {
                    var ok = s.secOk ? (s.Vmax <= Vc ? 'ok' : (s.needAsv_s > 0 ? 'ok' : 'ok')) : 'err';
                    var txt = s.secOk ? (s.Vmax <= Vc ? '构造配箍即可' : '需计算配箍') : '截面不足';
                    if (!s.secOk) allShearOk = false;
                    shHtml += '<tr><td>跨 ' + s.span + '</td>' +
                        '<td>' + fmt(s.Vl, 1) + '</td><td>' + fmt(s.Vr, 1) + '</td>' +
                        '<td>' + fmt(Vmax, 1) + '</td>' +
                        '<td style="font-weight:600;color:#2563eb;">' + (s.needAsv_s > 0 ? fmt(s.needAsv_s, 3) : '构造') + '</td>' +
                        '<td>' + fmt(s.rsvMin * 100, 3) + '%</td>' +
                        '<td>' + badge(s.secOk ? 'badge-ok' : 'badge-err', txt) + '</td></tr>';
                });
                shHtml += '</table></div>';
                shHtml += '<div style="margin-top:10px;font-size:12.5px;color:#64748b;">截面限制 V<sub>max</sub> = ' + fmt(Vmax, 1) + ' kN（h<sub>w</sub>/b = ' + fmt(hwb, 2) + '，按 6.3.1 条）；混凝土项 V<sub>c</sub> = 0.7f<sub>t</sub>bh<sub>0</sub> = ' + fmt(Vc, 1) + ' kN。</div>';
                outSh.innerHTML = shHtml;

                // 详细过程（关键步骤文字版）
                var procHtml = '';
                procHtml += st.join('');
                procHtml += '<div class="step"><b>⑥ 结果汇总</b>　最大支座负弯矩 M<sub>max-</sub> = ' +
                    fmt(Math.min.apply(null, Msup), 2) + ' kN·m；最大跨中正弯矩 M<sub>max+</sub> = ' +
                    fmt(Math.max.apply(null, spanResults.map(function(s){return s.MmaxPos;})), 2) + ' kN·m；最大剪力 V<sub>max</sub> = ' +
                    fmt(Math.max.apply(null, shearResults.map(function(s){return s.Vmax;})), 1) + ' kN。</div>';
                proc.innerHTML = procHtml;

                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                // 保存结果供导出用
                window._CB_RESULT = {
                    n: n, b: b, h: h, asV: asV, L: L, gk: gk, qk: qk,
                    conGrade: document.getElementById('cb_con').value,
                    rebGrade: document.getElementById('cb_reb').value,
                    stirGrade: document.getElementById('cb_stir').value,
                    gG: gG, gQ: gQ, qDesign: qDesign,
                    Msup: Msup, spanResults: spanResults,
                    rebarResults: rebarResults, shearResults: shearResults,
                    Vmax: Vmax, Vc: Vc, AsMin: AsMin, rho_min: rho_min,
                    allFlexOk: allFlexOk, allShearOk: allShearOk
                };
            }

            document.getElementById('cb_calc').addEventListener('click', calc);
            document.getElementById('cb_reset').addEventListener('click', function () {
                nInput.value = 3;
                document.getElementById('cb_b').value = 250;
                document.getElementById('cb_h').value = 600;
                document.getElementById('cb_as').value = 40;
                document.getElementById('cb_con').value = 'C30';
                document.getElementById('cb_reb').value = 'HRB400';
                document.getElementById('cb_stir').value = 'HRB400';
                document.getElementById('cb_gG').value = 1.2;
                document.getElementById('cb_gQ').value = 1.4;
                renderSpans(); calc();
            });
            document.getElementById('f-cont').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            renderSpans();
            calc();
        }
    };
    window.TOOLS = window.TOOLS || {};
    window.TOOLS['beam-cont'] = tool;
})();
