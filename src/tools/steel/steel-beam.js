/* steel-beam 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '钢连续梁（钢梁）设计',
        sub: '2~6 跨连续梁内力 · 抗弯/抗剪/整体稳定/挠度 · GB 50017-2017 第 6 章',
        meta: {"standard": "GB 50017-2017 钢结构设计标准", "formulaSource": "第6章", "limitations": "2~6跨连续梁，抗弯/抗剪/整体稳定/局部压应力/挠度", "unit": "M:kN·m, V:kN, f:mm, σ:N/mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">截面与材料参数</div>' +
                '<form id="f-sb"><div class="grid2">' +
                selField('sb_secType', '截面类型', opts([
                    { v: 'H', t: '热轧 H 型钢' },
                    { v: 'I', t: '热轧工字钢' },
                    { v: 'custom', t: '自定义工字形' }
                ], 'H')) +
                selField('sb_hSection', 'H 型钢规格', hSectionOpts('HN450×200')) +
                selField('sb_iSection', '工字钢规格', iSectionOpts('I40a')) +
                numField('sb_h', '截面高度 h', 'mm', 450) +
                numField('sb_b', '翼缘宽度 b', 'mm', 200) +
                numField('sb_tw', '腹板厚度 t<sub>w</sub>', 'mm', 9) +
                numField('sb_tf', '翼缘厚度 t<sub>f</sub>', 'mm', 14) +
                selField('sb_steel', '钢材牌号', opts(steelOpts(), 'Q355')) +
                selField('sb_gamma', '塑性发展系数 γ<sub>x</sub>', opts([
                    { v: '1.05', t: 'γ_x = 1.05（工字形受压翼缘自由外伸比 ≤ 13√235/f_y）' },
                    { v: '1.0', t: 'γ_x = 1.0（不考虑塑性发展，直接承受动力荷载 / 腹板高厚比较大）' }
                ], '1.05')) +
                numField('sb_Lb', '受压翼缘自由长度 l<sub>1</sub>', 'm', 4.0, '用于整体稳定验算；侧向支撑间距；0 表示不验算整体稳定') +
                numField('sb_conc', '楼板约束', '0=无/1=有', 0, '有现浇楼板时受压翼缘扭转受约束，φ_b = 1.0') +
                '</div><div class="panel-title" style="margin-top:14px;">连续梁跨度与荷载</div><div id="sb_spans"></div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="sb_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="sb_reset">重置</button>' +
                '<button type="button" class="btn btn-secondary" id="sb_add">+ 加一跨</button>' +
                '<button type="button" class="btn btn-secondary" id="sb_rm">− 减一跨</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="sb_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="sb_proc"></div></div></div></div>';
        },
        bind: function () {
            var defaultSpans = [
                { L: 6.0, q: 20, P: 0 },
                { L: 6.0, q: 20, P: 0 },
                { L: 6.0, q: 20, P: 0 }
            ];
            var spans = JSON.parse(JSON.stringify(defaultSpans));
            function renderSpans() {
                var html = '';
                for (var i = 0; i < spans.length; i++) {
                    html += '<div style="display:grid;grid-template-columns: 1fr 1fr 1fr;gap:10px;margin-bottom:10px;align-items:end;">' +
                        '<div class="field"><label>第 ' + (i+1) + ' 跨跨度 L (m)</label><input type="number" step="0.1" value="' + spans[i].L + '" data-span="' + i + '" data-key="L"></div>' +
                        '<div class="field"><label>均布荷载 q (kN/m)</label><input type="number" step="1" value="' + spans[i].q + '" data-span="' + i + '" data-key="q"></div>' +
                        '<div class="field"><label>跨中集中力 P (kN)</label><input type="number" step="1" value="' + spans[i].P + '" data-span="' + i + '" data-key="P"></div>' +
                        '</div>';
                }
                document.getElementById('sb_spans').innerHTML = html;
                var inputs = document.querySelectorAll('#sb_spans input');
                for (var j = 0; j < inputs.length; j++) {
                    inputs[j].addEventListener('change', function () {
                        var si = parseInt(this.getAttribute('data-span'));
                        var k = this.getAttribute('data-key');
                        spans[si][k] = parseFloat(this.value) || 0;
                        calc();
                    });
                }
            }

            // 三弯矩方程求解连续梁（等刚度）
            function threeMoment(spansInput) {
                var n = spansInput.length;
                if (n < 2) return null;
                // 支座编号 0 (左) ~ n (右), 共 n+1 个支座
                // 未知弯矩 M_1 ~ M_{n-1}, 共 n-1 个
                // 两端为铰支：M_0 = 0, M_n = 0
                var m = n - 1; // 未知量数
                // 矩阵 A·x = B, x = [M_1, ..., M_{n-1}]
                var A = [];
                var B = [];
                for (var i = 0; i < m; i++) {
                    A[i] = new Array(m).fill(0);
                    B[i] = 0;
                }
                for (var k = 0; k < m; k++) {
                    // 第 k 个方程对应支座 k+1
                    var left = spansInput[k];
                    var right = spansInput[k+1];
                    var L1 = left.L, L2 = right.L;
                    // 左端固端弯矩 (下侧受拉为正)
                    // 均布荷载: FEM = qL²/12, 左端下侧受拉为正 (顺时针为正)
                    var FEM_left_end = left.q * L1 * L1 / 12; // 右端（下侧受拉为正，固端梁右端弯矩为正 = qL²/12）
                    var FEM_right_start = -right.q * L2 * L2 / 12; // 左端弯矩（下侧受拉为正，固端梁左端弯矩 = -qL²/12? 不对，下侧受拉为正的话左端是 -qL²/12，右端是 +qL²/12）
                    // 集中力跨中: FEM = PL/8, 右端 = PL/8
                    FEM_left_end += left.P * L1 / 8;
                    FEM_right_start -= right.P * L2 / 8;
                    // 三弯矩方程: M_k*L1/6EI + 2M_{k+1}(L1+L2)/6EI + M_{k+2}*L2/6EI = -(B_left + B_right)/EI
                    // B_φ = qL³/24 + PL²/16 (右端转角，逆时针为正，乘EI)
                    // 更简洁：用标准三弯矩方程形式
                    // 2(L1+L2)·M_{k+1} + L1·M_k + L2·M_{k+2} = -6*(A_left/L1 + A_right/L2)
                    // 其中 A 为简支梁弯矩图面积。对均布荷载：A = 2/3 * (qL²/8) * L = qL³/12
                    var A_left = left.q * Math.pow(L1, 3) / 12 + left.P * L1 * L1 / 8; // 简支梁弯矩图面积
                    var A_right = right.q * Math.pow(L2, 3) / 12 + right.P * L2 * L2 / 8;
                    // 右端项：-6(A_left/L1 + A_right/L2)
                    B[k] = -6 * (A_left / L1 + A_right / L2);
                    // 系数矩阵
                    if (k > 0) A[k][k-1] = L1;
                    A[k][k] = 2 * (L1 + L2);
                    if (k < m - 1) A[k][k+1] = L2;
                }
                // 高斯消元解三对角矩阵
                var x = new Array(m).fill(0);
                // 追赶法
                var a = new Array(m), b = new Array(m), c = new Array(m), d = new Array(m);
                for (var ii = 0; ii < m; ii++) {
                    a[ii] = (ii > 0) ? A[ii][ii-1] : 0;
                    b[ii] = A[ii][ii];
                    c[ii] = (ii < m-1) ? A[ii][ii+1] : 0;
                    d[ii] = B[ii];
                }
                // 消去
                for (var i2 = 1; i2 < m; i2++) {
                    var m2 = a[i2] / b[i2-1];
                    b[i2] = b[i2] - m2 * c[i2-1];
                    d[i2] = d[i2] - m2 * d[i2-1];
                }
                x[m-1] = d[m-1] / b[m-1];
                for (var i3 = m-2; i3 >= 0; i3--) {
                    x[i3] = (d[i3] - c[i3] * x[i3+1]) / b[i3];
                }
                // 支座弯矩数组（两端为0）
                var Msup = [0];
                for (var i4 = 0; i4 < m; i4++) Msup.push(x[i4]);
                Msup.push(0);
                // 计算各跨跨中最大正弯矩（近似：取简支梁抛物线中点 - 支座弯矩平均）
                var Mmid = [];
                var Vmax_pos = [], Vmax_neg = [];
                for (var i5 = 0; i5 < n; i5++) {
                    var L = spansInput[i5].L;
                    var q = spansInput[i5].q;
                    var P = spansInput[i5].P;
                    var M_left = Msup[i5];
                    var M_right = Msup[i5+1];
                    // 剪力：左端 V_L = qL/2 + P/2 + (M_left - M_right)/L
                    var V_L = q * L / 2 + P / 2 + (M_left - M_right) / L;
                    var V_R = -q * L / 2 - P / 2 + (M_left - M_right) / L; // 右端剪力（向上为正）
                    Vmax_pos.push(Math.max(V_L, -V_R));
                    Vmax_neg.push(Math.max(-V_L, V_R));
                    // 跨中弯矩（近似跨中位置 L/2）
                    var M_mid = M_left + V_L * L / 2 - q * L * L / 8 - P * L / 4;
                    // 最大正弯矩位置在 V=0 处：x = V_L / q (仅均布荷载时)
                    var x_zero = V_L / q; // 从左端到剪力零点距离
                    if (x_zero > 0 && x_zero < L) {
                        var M_max_pos = M_left + V_L * x_zero - q * x_zero * x_zero / 2 - (P > 0 && x_zero >= L/2 ? P * (x_zero - L/2) : 0);
                        Mmid.push(M_max_pos);
                    } else {
                        Mmid.push(M_mid);
                    }
                }
                return { Msup: Msup, Mmid: Mmid, Vmax_pos: Vmax_pos, Vmax_neg: Vmax_neg };
            }

            function calc() {
                var out = document.getElementById('sb_result'), proc = document.getElementById('sb_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var secType = document.getElementById('sb_secType').value;
                var steel = document.getElementById('sb_steel').value;
                var gammaX = parseFloat(document.getElementById('sb_gamma').value);
                var Lb = parseFloat(document.getElementById('sb_Lb').value);
                var conc = parseFloat(document.getElementById('sb_conc').value);
                if (spans.length < 2) return err('连续梁至少 2 跨。');

                // 截面参数
                var sec;
                if (secType === 'H') {
                    var s1 = getHSection(document.getElementById('sb_hSection').value);
                    if (s1) sec = { h: s1.h, b: s1.b, tw: s1.tw, tf: s1.tf, A: s1.A*100, Ix: s1.Ix*1e4, Wx: s1.Wx*1e3, Iy: s1.Iy*1e4, Wy: s1.Wy*1e3, name: s1.name };
                } else if (secType === 'I') {
                    var s2 = getISection(document.getElementById('sb_iSection').value);
                    if (s2) sec = { h: s2.h, b: s2.b, tw: s2.tw, tf: s2.tf, A: s2.A*100, Ix: s2.Ix*1e4, Wx: s2.Wx*1e3, Iy: s2.Iy*1e4, Wy: s2.Wy*1e3, name: s2.name };
                } else {
                    var h = parseFloat(document.getElementById('sb_h').value);
                    var b = parseFloat(document.getElementById('sb_b').value);
                    var tw = parseFloat(document.getElementById('sb_tw').value);
                    var tf = parseFloat(document.getElementById('sb_tf').value);
                    var A2 = b*tf*2 + (h-2*tf)*tw;
                    var Ix2 = (b*Math.pow(h,3) - (b-tw)*Math.pow(h-2*tf,3)) / 12;
                    var Iy2 = 2*(tf*Math.pow(b,3)/12) + (h-2*tf)*Math.pow(tw,3)/12;
                    sec = { h:h, b:b, tw:tw, tf:tf, A:A2, Ix:Ix2, Wx:Ix2/(h/2), Iy:Iy2, Wy:Iy2/(b/2), name: '自定义 ' + h + '×' + b };
                }
                if (!sec) return err('截面参数错误。');
                var f = STEEL[steel].f; // MPa
                var fv = STEEL[steel].fv;
                var fy = STEEL[steel].fy;
                var E = STEEL[steel].E;
                var st = [];

                st.push('<div class="step"><b>① 截面参数</b>　' + sec.name + ' / ' + steel + '；f = ' + f + ' MPa；f<sub>v</sub> = ' + fv + ' MPa</div>');
                st.push('<div class="step">　　A = ' + fmt(sec.A,0) + ' mm²；I<sub>x</sub> = ' + fmt(sec.Ix,0) + ' mm⁴；W<sub>x</sub> = ' + fmt(sec.Wx,0) + ' mm³；i<sub>y</sub> = ' + fmt(Math.sqrt(sec.Iy/sec.A),2) + ' mm</div>');

                // 内力分析
                var res = threeMoment(spans);
                if (!res) return err('三弯矩方程求解失败。');
                var n = spans.length;
                st.push('<div class="step"><b>② 内力分析（三弯矩方程，均布+跨中集中）</b>　共 ' + n + ' 跨</div>');
                var html_tab = '<div class="table-wrap"><table class="mini"><thead><tr><th>跨号</th><th>跨度 (m)</th><th>左支弯矩 (kN·m)</th><th>右支弯矩 (kN·m)</th><th>跨中最大正弯矩 (kN·m)</th><th>最大剪力 (kN)</th></tr></thead><tbody>';
                var Mmax_abs = 0, Vmax_abs = 0;
                for (var i = 0; i < n; i++) {
                    var M_left = res.Msup[i];
                    var M_right = res.Msup[i+1];
                    var Mmid_val = res.Mmid[i];
                    var V_val = Math.max(res.Vmax_pos[i], res.Vmax_neg[i]);
                    Mmax_abs = Math.max(Mmax_abs, Math.abs(M_left), Math.abs(M_right), Math.abs(Mmid_val));
                    Vmax_abs = Math.max(Vmax_abs, V_val);
                    html_tab += '<tr><td>' + (i+1) + '</td><td>' + fmt(spans[i].L,1) + '</td><td>' + fmt(M_left,1) + '</td><td>' + fmt(M_right,1) + '</td><td>' + fmt(Mmid_val,1) + '</td><td>' + fmt(V_val,1) + '</td></tr>';
                }
                html_tab += '</tbody></table></div>';
                st.push(html_tab);
                st.push('<div class="step">　　最大弯矩（绝对值）|M|<sub>max</sub> = <b>' + fmt(Mmax_abs, 1) + ' kN·m</b>；最大剪力 V<sub>max</sub> = <b>' + fmt(Vmax_abs, 1) + ' kN</b></div>');

                // 抗弯强度（6.1.1）
                var sigma_bend = Mmax_abs * 1e6 / (gammaX * sec.Wx); // MPa
                var bendOk = sigma_bend <= f;
                st.push('<div class="step"><b>③ 抗弯强度（6.1.1）</b>　σ = M<sub>max</sub>/(γ<sub>x</sub>·W<sub>nx</sub>) = ' + fmt(Mmax_abs,1) + '×10⁶/(' + gammaX + '×' + fmt(sec.Wx,0) + ') = <b>' + fmt(sigma_bend, 1) + ' MPa</b> ≤ f = ' + f + ' MPa ⇒ ' +
                    (bendOk ? '满足' + tag('ok','抗弯满足') : '不满足' + tag('err','抗弯不足')) + '</div>');

                // 抗剪强度（6.1.2）
                var Sw = (sec.b * sec.tf * (sec.h/2 - sec.tf/2)) + ((sec.h/2 - sec.tf) * sec.tw * (sec.h/2 - sec.tf)/2);
                var tau = Vmax_abs * 1000 * Sw / (sec.Ix * sec.tw); // MPa
                var shearOk = tau <= fv;
                st.push('<div class="step"><b>④ 抗剪强度（6.1.2）</b>　τ = VS/(I·t<sub>w</sub>) = ' + fmt(tau, 1) + ' MPa ≤ f<sub>v</sub> = ' + fv + ' MPa ⇒ ' +
                    (shearOk ? '满足' + tag('ok','抗剪满足') : '不满足' + tag('err','抗剪不足')) + '</div>');

                // 整体稳定（6.2.2）
                var phiB = 1.0;
                var stabOk = true;
                var needStab = (conc < 1 && Lb > 0); // 无楼板约束且有自由长度
                if (needStab) {
                    // 整体稳定系数 φ_b 近似公式（均布荷载，简支，受压翼缘自由扭转）
                    var lambda_y = Lb * 1000 / Math.sqrt(sec.Iy / sec.A);
                    var lambdaY_e = lambda_y * Math.sqrt(fy / 235);
                    // 附录 B 工字形截面简支梁 φ_b 公式近似
                    // β_b = 1.13（均布荷载作用在形心轴，焊接/轧制近似）
                    var betaB = 1.15; // 均布荷载，轧制H型钢，荷载在上翼缘近似
                    if (conc >= 1) phiB = 1.0; // 有楼板约束
                    else {
                        // 简化公式（B.1-1）φ_b = β_b · 4320 / λ_y² · (Ah/Wx) · √(1 + (λ_y t1/4.4h)²) · fy/235? 太繁
                        // 采用近似换算：当 λ_y > 120√(235/fy) 时用 φ_b ≈ 1.07 - 44000/λ_y²
                        if (lambdaY_e <= 120) {
                            // 用近似: φ_b = 1.07 - λ_y² * fy / 44000 / 235 * 235? 不统一
                            // 简化：按 φ_b ≈ 1.1 - λ_y/200 (经验近似, 仅供估算)
                            phiB = 1.1 - lambdaY_e / 300;
                            if (phiB > 1.0) phiB = 1.0;
                            if (phiB < 0.4) phiB = 0.4;
                        } else {
                            phiB = 1.07 - 44000 / (lambdaY_e * lambdaY_e);
                            if (phiB < 0.3) phiB = 0.3;
                            if (phiB > 1.0) phiB = 1.0;
                        }
                    }
                    var sigma_stab = Mmax_abs * 1e6 / (phiB * sec.Wx);
                    stabOk = sigma_stab <= f;
                    st.push('<div class="step"><b>⑤ 整体稳定（6.2.2，近似估算）</b>　受压翼缘自由长度 l<sub>1</sub> = ' + Lb + ' m；λ<sub>y</sub> = ' + fmt(lambda_y,1) + '；φ<sub>b</sub> ≈ ' + fmt(phiB,3) + '</div>');
                    st.push('<div class="step">　　σ = M<sub>max</sub>/(φ<sub>b</sub>·W<sub>x</sub>) = ' + fmt(sigma_stab,1) + ' MPa ≤ f = ' + f + ' MPa ⇒ ' +
                        (stabOk ? '满足' + tag('ok','整体稳定') : '不满足' + tag('err','整体失稳')) + '</div>');
                    st.push('<div class="step">　　<span style="font-size:12px;color:var(--muted);">注：φ<sub>b</sub> 为简化估算值，精确值请根据荷载类型、截面类型、侧向支承条件按规范附录 B 计算。</span></div>');
                } else {
                    st.push('<div class="step"><b>⑤ 整体稳定</b>　有现浇楼板约束受压翼缘 / 未输入自由长度 ⇒ 不需要验算整体稳定（φ<sub>b</sub> = 1.0）' + tag('ok','无需验算') + '</div>');
                }

                // 局部承压（有集中荷载处）
                // 局部压应力 σ_c = ψF / (t_w * l_z) (6.1.3-1), l_z = a + 5h_y + 2h_R
                // 简化：若有集中力 P，验算 ψ=1.0 时的 σ_c
                var Pmax = 0;
                for (var j = 0; j < spans.length; j++) Pmax = Math.max(Pmax, spans[j].P);
                if (Pmax > 0) {
                    var lz = 50 + 5 * sec.tf; // mm, a=50mm, h_y = t_f (翼缘), h_R=0 简化
                    var sigma_c = 1.0 * Pmax * 1000 / (sec.tw * lz);
                    var localOk = sigma_c <= f;
                    st.push('<div class="step"><b>⑥ 局部承压（6.1.3，集中荷载处）</b>　P = ' + Pmax + ' kN；l<sub>z</sub> = a + 5t<sub>f</sub> ≈ ' + fmt(lz,0) + ' mm</div>');
                    st.push('<div class="step">　　σ<sub>c</sub> = ψF/(t<sub>w</sub>·l<sub>z</sub>) = ' + fmt(sigma_c,1) + ' MPa ≤ f = ' + f + ' MPa ⇒ ' +
                        (localOk ? '满足' + tag('ok','局压满足') : '不满足' + tag('err','局压不足')) + '</div>');
                } else {
                    st.push('<div class="step"><b>⑥ 局部承压</b>　无集中荷载，无需验算局部承压</div>');
                }

                // 挠度（均布荷载，简支近似）
                // 连续梁挠度近似：取最大跨简支挠度 × 0.8 (连续梁挠度系数约为简支的 0.7~0.8)
                var Lmax = 0;
                for (var k = 0; k < spans.length; k++) Lmax = Math.max(Lmax, spans[k].L);
                var q_max = 0;
                for (var kk = 0; kk < spans.length; kk++) q_max = Math.max(q_max, spans[kk].q);
                var defl_mm = 0.8 * 5 * q_max * Math.pow(Lmax * 1000, 4) / (384 * E * sec.Ix); // mm
                var lim1 = Lmax * 1000 / 250; // 限值 l/250 (主梁/吊车梁等不同)
                var lim2 = Lmax * 1000 / 400; // 次梁 l/400
                var deflOk = defl_mm <= lim1;
                st.push('<div class="step"><b>⑦ 挠度验算（均布荷载近似）</b>　按最大跨 L = ' + Lmax + ' m，q = ' + q_max + ' kN/m 估算</div>');
                st.push('<div class="step">　　f ≈ 0.8 × 5qL⁴/(384EI) = <b>' + fmt(defl_mm, 2) + ' mm</b>（连续梁折减系数 0.8）</div>');
                st.push('<div class="step">　　限值 l/250 = ' + fmt(lim1,2) + ' mm；l/400 = ' + fmt(lim2,2) + ' mm ⇒ ' + (deflOk ? '满足（按 l/250）' + tag('ok','挠度满足') : '不满足' + tag('err','挠度过大')) + '</div>');

                var allOk = bendOk && shearOk && stabOk && deflOk;
                if (Pmax > 0) allOk = allOk && localOk;
                var html = resultRow('截面 / 钢材', sec.name + ' / ' + steel);
                html += resultRow('跨数 / 最大跨度', n + ' 跨 / ' + Lmax + ' m');
                html += resultRow('最大弯矩 |M|<sub>max</sub>', fmt(Mmax_abs, 1) + ' kN·m');
                html += resultRow('最大剪力 V<sub>max</sub>', fmt(Vmax_abs, 1) + ' kN');
                html += resultRow('抗弯强度 σ / f', fmt(sigma_bend,1) + ' / ' + f + ' MPa ' + (bendOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('抗剪强度 τ / f<sub>v</sub>', fmt(tau,1) + ' / ' + fv + ' MPa ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('整体稳定 φ<sub>b</sub>', needStab ? (fmt(phiB,3) + ' ' + (stabOk ? tag('ok','满足') : tag('err','不足'))) : tag('ok','无需验算'));
                if (Pmax > 0) html += resultRow('局部承压', (localOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('挠度 f / [v]', fmt(defl_mm,2) + ' / ' + fmt(lim1,2) + ' mm（l/250）' + (deflOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '钢梁各项验算均满足' : '钢梁验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._SB_RESULT = { sec: sec, Mmax: Mmax_abs, Vmax: Vmax_abs, sigma_bend: sigma_bend, tau: tau, defl: defl_mm, allOk: allOk, steps: st.join('') };
            }

            function toggleCustom() {
                var t = document.getElementById('sb_secType').value;
                var hs = document.getElementById('sb_hSection').parentElement.parentElement;
                var iss = document.getElementById('sb_iSection').parentElement.parentElement;
                hs.style.display = (t === 'H') ? '' : 'none';
                iss.style.display = (t === 'I') ? '' : 'none';
                var fields = ['sb_h','sb_b','sb_tw','sb_tf'];
                for (var i = 0; i < fields.length; i++) {
                    var el = document.getElementById(fields[i]).parentElement.parentElement;
                    el.style.display = (t === 'custom') ? '' : 'none';
                }
                calc();
            }
            function reset() {
                document.getElementById('sb_secType').value = 'H';
                document.getElementById('sb_hSection').value = 'HN450×200';
                document.getElementById('sb_iSection').value = 'I40a';
                ['sb_h','sb_b','sb_tw','sb_tf','sb_Lb','sb_conc'].forEach(function (id) {
                    var defs = { sb_h:450, sb_b:200, sb_tw:9, sb_tf:14, sb_Lb:4.0, sb_conc:0 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('sb_steel').value = 'Q355';
                document.getElementById('sb_gamma').value = '1.05';
                spans = JSON.parse(JSON.stringify(defaultSpans));
                renderSpans();
                toggleCustom();
                calc();
            }
            document.getElementById('sb_calc').addEventListener('click', calc);
            document.getElementById('sb_reset').addEventListener('click', reset);
            document.getElementById('sb_add').addEventListener('click', function () {
                if (spans.length >= 6) return;
                spans.push({ L: 6.0, q: 20, P: 0 });
                renderSpans();
                calc();
            });
            document.getElementById('sb_rm').addEventListener('click', function () {
                if (spans.length <= 2) return;
                spans.pop();
                renderSpans();
                calc();
            });
            document.getElementById('sb_secType').addEventListener('change', toggleCustom);
            document.getElementById('f-sb').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            renderSpans();
            toggleCustom();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['steel-beam'] = tool;
})();
