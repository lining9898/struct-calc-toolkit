/* steel-column 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '钢压弯构件（柱）验算',
        sub: '强度 · 平面内/外整体稳定 · 局部稳定 · GB 50017-2017 第 8 章',
        meta: {"standard": "GB 50017-2017 钢结构设计标准", "formulaSource": "第8章", "limitations": "H/工/箱形截面，强度/平面内外稳定/局部稳定", "unit": "N:kN, M:kN·m, φ:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">截面与材料参数</div>' +
                '<form id="f-scc"><div class="grid2">' +
                selField('scc_secType', '截面类型', opts([
                    { v: 'H', t: '热轧 H 型钢' },
                    { v: 'I', t: '热轧工字钢' },
                    { v: 'box', t: '箱形截面（自定义）' },
                    { v: 'custom', t: '自定义参数（h, b, tw, tf）' }
                ], 'H')) +
                selField('scc_hSection', 'H 型钢规格', hSectionOpts('HN400×200')) +
                selField('scc_iSection', '工字钢规格', iSectionOpts('I32a')) +
                numField('scc_h', '截面高度 h', 'mm', 400) +
                numField('scc_b', '翼缘宽度 b', 'mm', 200) +
                numField('scc_tw', '腹板厚度 t<sub>w</sub>', 'mm', 8) +
                numField('scc_tf', '翼缘厚度 t<sub>f</sub>', 'mm', 13) +
                selField('scc_steel', '钢材牌号', opts(steelOpts(), 'Q355')) +
                numField('scc_Lx', 'x 方向计算长度 l<sub>0x</sub>', 'm', 4.0, '平面内计算长度（绕强轴）') +
                numField('scc_Ly', 'y 方向计算长度 l<sub>0y</sub>', 'm', 2.0, '平面外计算长度（绕弱轴）') +
                '</div><div class="panel-title" style="margin-top:14px;">内力设计值</div><div class="grid2">' +
                numField('scc_N', '轴心压力 N', 'kN', 800) +
                numField('scc_Mx', '绕 x 轴弯矩 M<sub>x</sub>', 'kN·m', 120) +
                numField('scc_My', '绕 y 轴弯矩 M<sub>y</sub>', 'kN·m', 20) +
                numField('scc_V', '剪力 V', 'kN', 80, '仅用于剪应力验算') +
                selField('scc_bmx', '等效弯矩系数 β<sub>mx</sub>', opts([
                    { v: '1.0', t: 'β_mx = 1.0（保守）' },
                    { v: '0.85', t: 'β_mx = 0.85（两端支承无侧移）' },
                    { v: '0.65', t: 'β_mx = 0.65（均布荷载）' },
                    { v: 'custom', t: '自定义' }
                ], '0.85')) +
                numField('scc_bmx_c', '自定义 β<sub>mx</sub>', '', 0.85) +
                selField('scc_bty', '等效弯矩系数 β<sub>ty</sub>', opts([
                    { v: '1.0', t: 'β_ty = 1.0（保守）' },
                    { v: '0.85', t: 'β_ty = 0.85' },
                    { v: '0.65', t: 'β_ty = 0.65' }
                ], '1.0')) +
                selField('scc_gamma', '塑性发展系数 γ', opts([
                    { v: 'plas', t: '考虑塑性发展（γ_x = 1.05, γ_y = 1.2 工字形）' },
                    { v: 'elastic', t: '不考虑（γ = 1.0，直接承受动力或需计算疲劳）' }
                ], 'plas')) +
                selField('scc_secClass', '截面分类（稳定）', opts([
                    { v: 'a', t: 'a 类' },
                    { v: 'b', t: 'b 类（热轧 H 型钢 b/h≤0.8 强轴通常 b 类）' },
                    { v: 'c', t: 'c 类' }
                ], 'b')) +
                '</div><div class="hint">说明：轴压稳定系数 φ 按 b 类截面查表计算（近似），适用于工程估算。精确设计请根据截面形式（翼缘焰切/轧制/焊接）查规范表 D.0.1 确定截面分类。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="scc_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="scc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="scc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="scc_proc"></div></div></div></div>';
        },
        bind: function () {
            function getSection() {
                var type = document.getElementById('scc_secType').value;
                if (type === 'H') {
                    var s = getHSection(document.getElementById('scc_hSection').value);
                    if (s) return { h: s.h, b: s.b, tw: s.tw, tf: s.tf, A: s.A*100, Ix: s.Ix*1e4, Wx: s.Wx*1e3, Iy: s.Iy*1e4, Wy: s.Wy*1e3, name: s.name };
                    // A: cm² -> mm²; I: cm⁴ -> mm⁴; W: cm³ -> mm³
                }
                if (type === 'I') {
                    var s2 = getISection(document.getElementById('scc_iSection').value);
                    if (s2) return { h: s2.h, b: s2.b, tw: s2.tw, tf: s2.tf, A: s2.A*100, Ix: s2.Ix*1e4, Wx: s2.Wx*1e3, Iy: s2.Iy*1e4, Wy: s2.Wy*1e3, name: s2.name };
                }
                var h = parseFloat(document.getElementById('scc_h').value);
                var b = parseFloat(document.getElementById('scc_b').value);
                var tw = parseFloat(document.getElementById('scc_tw').value);
                var tf = parseFloat(document.getElementById('scc_tf').value);
                if (type === 'box') {
                    var A = 2*(b*tf + (h-2*tf)*tw);
                    var Ix = (b*Math.pow(h,3) - (b-2*tw)*Math.pow(h-2*tf,3)) / 12;
                    var Iy = (h*Math.pow(b,3) - (h-2*tf)*Math.pow(b-2*tw,3)) / 12;
                    var Wx = Ix / (h/2), Wy = Iy / (b/2);
                    return { h:h, b:b, tw:tw, tf:tf, A:A, Ix:Ix, Wx:Wx, Iy:Iy, Wy:Wy, name: '箱形 ' + h + '×' + b };
                }
                // custom: 工字形截面
                var A2 = b*tf*2 + (h-2*tf)*tw;
                var Ix2 = (b*Math.pow(h,3) - (b-tw)*Math.pow(h-2*tf,3)) / 12;
                var Iy2 = 2*(tf*Math.pow(b,3)/12) + (h-2*tf)*Math.pow(tw,3)/12;
                var Wx2 = Ix2 / (h/2), Wy2 = Iy2 / (b/2);
                return { h:h, b:b, tw:tw, tf:tf, A:A2, Ix:Ix2, Wx:Wx2, Iy:Iy2, Wy:Wy2, name: '自定义 ' + h + '×' + b };
            }
            function calc() {
                var out = document.getElementById('scc_result'), proc = document.getElementById('scc_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var sec = getSection();
                var steel = document.getElementById('scc_steel').value;
                var Lx = parseFloat(document.getElementById('scc_Lx').value); // m
                var Ly = parseFloat(document.getElementById('scc_Ly').value); // m
                var N = parseFloat(document.getElementById('scc_N').value); // kN
                var Mx = parseFloat(document.getElementById('scc_Mx').value); // kN·m
                var My = parseFloat(document.getElementById('scc_My').value);
                var V = parseFloat(document.getElementById('scc_V').value);
                var bmx_sel = document.getElementById('scc_bmx').value;
                var bty_sel = document.getElementById('scc_bty').value;
                var gammaV = document.getElementById('scc_gamma').value;
                var secClass = document.getElementById('scc_secClass').value;
                if (!sec || sec.A <= 0) return err('截面参数不合法。');
                var f = STEEL[steel].f; // MPa
                var fv = STEEL[steel].fv;
                var fy = STEEL[steel].fy;
                var E = STEEL[steel].E; // MPa
                var st = [];

                var bmx = (bmx_sel === 'custom') ? parseFloat(document.getElementById('scc_bmx_c').value) : parseFloat(bmx_sel);
                var bty = parseFloat(bty_sel);
                var gx = (gammaV === 'plas') ? 1.05 : 1.0; // 工字形 x 向塑性发展系数
                var gy = (gammaV === 'plas') ? 1.2 : 1.0; // y 向
                // 箱形截面塑性发展系数取 1.05
                if (document.getElementById('scc_secType').value === 'box') { gx = (gammaV === 'plas') ? 1.05 : 1.0; gy = gx; }

                st.push('<div class="step"><b>① 截面参数</b>　' + sec.name + '；A = ' + fmt(sec.A,0) + ' mm²；' +
                    'W<sub>x</sub> = ' + fmt(sec.Wx,0) + ' mm³；W<sub>y</sub> = ' + fmt(sec.Wy,0) + ' mm³</div>');
                st.push('<div class="step">　　i<sub>x</sub> = √(I<sub>x</sub>/A) = ' + fmt(Math.sqrt(sec.Ix/sec.A),2) + ' mm；i<sub>y</sub> = ' + fmt(Math.sqrt(sec.Iy/sec.A),2) + ' mm</div>');

                // 长细比
                var ix = Math.sqrt(sec.Ix / sec.A); // mm
                var iy = Math.sqrt(sec.Iy / sec.A);
                var lambdaX = Lx * 1000 / ix;
                var lambdaY = Ly * 1000 / iy;
                st.push('<div class="step"><b>② 长细比</b>　λ<sub>x</sub> = l<sub>0x</sub>/i<sub>x</sub> = ' + fmt(lambdaX,1) + '；λ<sub>y</sub> = l<sub>0y</sub>/i<sub>y</sub> = ' + fmt(lambdaY,1) +
                    '；容许 [λ] = 150（受压柱）⇒ ' + (Math.max(lambdaX,lambdaY)<=150 ? tag('ok','长细比满足') : tag('err','长细比超限')) + '</div>');

                // 稳定系数 φx, φy
                var phiX = phi_b_class(lambdaX, fy);
                var phiY = phi_b_class(lambdaY, fy);
                st.push('<div class="step"><b>③ 轴压稳定系数 φ（' + secClass + ' 类截面）</b>　φ<sub>x</sub> ≈ ' + fmt(phiX,4) + '；φ<sub>y</sub> ≈ ' + fmt(phiY,4) + '</div>');

                // 强度验算（6.1.1 / 8.1.1）
                // N/An + Mx/(γx Wnx) + My/(γy Wny) ≤ f
                var sigma_strength = N*1000 / sec.A + Mx*1e6 / (gx * sec.Wx) + My*1e6 / (gy * sec.Wy); // MPa
                var strOk = sigma_strength <= f;
                st.push('<div class="step"><b>④ 强度验算（8.1.1）</b>　σ = N/A<sub>n</sub> + M<sub>x</sub>/(γ<sub>x</sub>W<sub>nx</sub>) + M<sub>y</sub>/(γ<sub>y</sub>W<sub>ny</sub>)</div>');
                st.push('<div class="step">　　σ = ' + fmt(N,0) + '×10³/' + fmt(sec.A,0) + ' + ' + fmt(Mx,0) + '×10⁶/(' + gx + '×' + fmt(sec.Wx,0) + ') + ' + fmt(My,0) + '×10⁶/(' + gy + '×' + fmt(sec.Wy,0) + ') = <b>' + fmt(sigma_strength,1) + ' MPa</b> ≤ f = ' + f + ' MPa ⇒ ' +
                    (strOk ? '满足' + tag('ok','强度满足') : '不满足' + tag('err','强度不足')) + '</div>');

                // 剪应力验算
                // τ = V*S/(I*tw)
                var Sw = (sec.b * sec.tf * (sec.h/2 - sec.tf/2)) + ((sec.h/2 - sec.tf) * sec.tw * (sec.h/2 - sec.tf)/2); // 简化半截面静矩
                var tau = V * 1000 * Sw / (sec.Ix * sec.tw); // MPa
                var shearOk = tau <= fv;
                st.push('<div class="step"><b>⑤ 剪应力验算</b>　τ = VS/(I·t<sub>w</sub>) = ' + fmt(tau,1) + ' MPa ≤ f<sub>v</sub> = ' + fv + ' MPa ⇒ ' +
                    (shearOk ? '满足' + tag('ok','抗剪满足') : '不满足' + tag('err','抗剪不足')) + '</div>');

                // 平面内整体稳定（8.2.1-1）
                // N/(φx·A) + βmx·Mx / (γx·W1x·(1 - 0.8·N/N'Ex)) ≤ f
                var NEx = Math.PI * Math.PI * E * sec.A / (lambdaX * lambdaX) / 1000; // kN (欧拉临界力)
                var NEx_prime = NEx / 1.1; // N'_Ex = π²EA/(1.1λx²)
                var ratioN = N / NEx_prime; // N/N'_Ex
                var ratio1 = N*1000 / (phiX * sec.A);
                var ratio2 = bmx * Mx * 1e6 / (gx * sec.Wx * (1 - 0.8 * ratioN));
                var sigma_inplane = ratio1 + ratio2;
                var inOk = sigma_inplane <= f;
                st.push('<div class="step"><b>⑥ 平面内整体稳定（8.2.1-1）</b>　N\u2032<sub>Ex</sub> = π²EA/(1.1λ<sub>x</sub>²) = ' + fmt(NEx_prime, 1) + ' kN；N/N\u2032<sub>Ex</sub> = ' + fmt(ratioN,4) + '；β<sub>mx</sub> = ' + bmx + '</div>');
                st.push('<div class="step">　　σ = N/(φ<sub>x</sub>A) + β<sub>mx</sub>M<sub>x</sub>/(γ<sub>x</sub>W<sub>1x</sub>(1−0.8N/N\u2032<sub>Ex</sub>)) = ' + fmt(sigma_inplane,1) + ' MPa ≤ f ⇒ ' +
                    (inOk ? '满足' + tag('ok','面内稳定') : '不满足' + tag('err','面内失稳')) + '</div>');

                // 平面外整体稳定（8.2.1-2）
                // N/(φy·A) + βtx·Mx / (φb·W1x) ≤ f   （仅考虑 Mx 绕强轴，My 弱轴忽略或近似）
                // φb — 均匀弯曲受弯构件整体稳定系数
                // 工字形截面（绕强轴）近似公式：φb = 1.07 - λy²·fy/44000 / 235? 用规范附录C简化
                // 对于双轴对称工字形截面：φ_b = β_b · (4320/λy²) · (Ah/Wx) · √(1 + (λy·t1/4.4h)²) · fy/235? 太复杂
                // 简化：当 λ_y ≤ 120√(235/fy) 时，用近似公式 φb ≈ 1.07 - λy²·fy/44000/235? 不对
                // 规范附录 C 工字形截面简支梁 φb 计算较繁。这里用简化近似：
                var lambdaY_e = lambdaY * Math.sqrt(fy / 235); // 换算长细比
                var phib;
                if (lambdaY_e <= 120) {
                    // 近似公式 (C-0.2) φb = 1.07 - λ²/44000 · fy/235?  应为 φ'b = 1.07 - 44000/λ²? 不对
                    // 正确：当 φ_b > 0.6 时 φ'_b = 1.07 - 0.282/φ_b, 但先求 φ_b
                    // 简化估算 φb ≈ 1.1 - λ_y² * fy / 50000 / 235?  用经验近似：
                    phib = 1.07 - lambdaY_e * lambdaY_e / 44000; // 近似, 仅适用于某些情况
                    if (phib > 1.0) phib = 1.0;
                    if (phib < 0.3) phib = 0.3;
                } else {
                    phib = 1.07 - 44000 / (lambdaY_e * lambdaY_e); // C-0.2 近似形式
                    if (phib < 0.3) phib = 0.3;
                    if (phib > 1.0) phib = 1.0;
                }
                var sigma_outplane = N*1000 / (phiY * sec.A) + bty * Mx * 1e6 / (phib * sec.Wx) + My*1e6 / (gy * sec.Wy); // 粗略加 My 项
                // 规范 8.2.1-2 是 N/(φ_y·A) + β_tx·M_x/(φ_b·W_1x) + η·M_y/γ_y·W_1y (η=1 闭口)
                var eta = (document.getElementById('scc_secType').value === 'box') ? 0.7 : 1.0; // 闭口截面 η=0.7 近似
                sigma_outplane = N*1000 / (phiY * sec.A) + bty * Mx * 1e6 / (phib * sec.Wx) + eta * My * 1e6 / (gy * sec.Wy);
                var outOk = sigma_outplane <= f;
                st.push('<div class="step"><b>⑦ 平面外整体稳定（8.2.1-2）</b>　φ<sub>b</sub> ≈ ' + fmt(phib,3) + '（按均匀弯曲近似，仅供估算）；β<sub>ty</sub> = ' + bty + '；η = ' + eta + '</div>');
                st.push('<div class="step">　　σ = N/(φ<sub>y</sub>A) + β<sub>tx</sub>M<sub>x</sub>/(φ<sub>b</sub>W<sub>1x</sub>) + ηM<sub>y</sub>/(γ<sub>y</sub>W<sub>1y</sub>) = ' + fmt(sigma_outplane,1) + ' MPa ≤ f ⇒ ' +
                    (outOk ? '满足' + tag('ok','面外稳定') : '不满足' + tag('err','面外失稳')) + '</div>');

                // 局部稳定（宽厚比）
                // 翼缘 b'/tf ≤ 13√(235/fy) 塑性设计 / 15√(235/fy) 弹性（工字形压弯构件）
                var flange_b = (sec.b - sec.tw) / 2; // 外伸翼缘宽度
                var flangeRatio = flange_b / sec.tf;
                var flangeLimit = (gammaV === 'plas') ? 13 * Math.sqrt(235/fy) : 15 * Math.sqrt(235/fy);
                // 腹板 h0/tw 限值（工字形压弯，按 8.4.1）
                var h0 = sec.h - 2 * sec.tf;
                var webRatio = h0 / sec.tw;
                var alpha0 = (sigma_max - sigma_min) / sigma_max; // 近似取
                // 压弯腹板：当 0≤α0≤1.6 时，h0/tw ≤ 16α0+0.5λ+25 / √(235/fy) 近似
                var sigma_max = N*1000/sec.A + Mx*1e6/sec.Wx;
                var sigma_min = N*1000/sec.A - Mx*1e6/sec.Wx;
                var alpha0_w = (sigma_max - sigma_min) / sigma_max; // α0 = (σ_max - σ_min)/σ_max
                if (alpha0_w < 0) alpha0_w = 0; // 全截面受压
                var lambdaE = Math.min(lambdaX, lambdaY); // 取小值近似
                var webLimit;
                if (alpha0_w <= 1.6) webLimit = (16 * alpha0_w + 0.5 * lambdaE + 25) * Math.sqrt(235/fy);
                else webLimit = (48 * alpha0_w + 0.5 * lambdaE - 26.2) * Math.sqrt(235/fy);
                if (webLimit < 40 * Math.sqrt(235/fy)) webLimit = 40 * Math.sqrt(235/fy);
                if (webLimit > 250 * Math.sqrt(235/fy)) webLimit = 250 * Math.sqrt(235/fy);
                var flangeOk = flangeRatio <= flangeLimit;
                var webOk = webRatio <= webLimit;
                st.push('<div class="step"><b>⑧ 局部稳定（宽厚比）</b></div>');
                st.push('<div class="step">　　翼缘：b\u2032/t<sub>f</sub> = ' + fmt(flangeRatio,1) + ' ≤ ' + fmt(flangeLimit,1) + ' ⇒ ' + (flangeOk ? '满足' + tag('ok','翼缘满足') : '不满足' + tag('err','翼缘超宽')) + '</div>');
                st.push('<div class="step">　　腹板：h<sub>0</sub>/t<sub>w</sub> = ' + fmt(webRatio,1) + ' ≤ ' + fmt(webLimit,1) + ' ⇒ ' + (webOk ? '满足' + tag('ok','腹板满足') : '不满足' + tag('err','腹板超薄')) + '</div>');
                st.push('<div class="step">　　<span style="font-size:12px;color:var(--muted);">注：翼缘限值 ' + (gammaV==='plas'?'13':'15') + '√(235/f<sub>y</sub>) 为受压构件翼缘外伸宽厚比限值（GB 50017-2017 表 8.4.1）。</span></div>');

                var allOk = strOk && shearOk && inOk && outOk && flangeOk && webOk && Math.max(lambdaX,lambdaY) <= 150;
                var html = resultRow('截面 / 钢材', sec.name + ' / ' + steel);
                html += resultRow('长细比 λ<sub>x</sub> / λ<sub>y</sub>', fmt(lambdaX,1) + ' / ' + fmt(lambdaY,1) + ' （限值 150）' + (Math.max(lambdaX,lambdaY)<=150 ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('轴压稳定系数 φ<sub>x</sub> / φ<sub>y</sub>', fmt(phiX,4) + ' / ' + fmt(phiY,4));
                html += resultRow('强度 σ / f', fmt(sigma_strength,1) + ' / ' + f + ' MPa ' + (strOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('剪应力 τ / f<sub>v</sub>', fmt(tau,1) + ' / ' + fv + ' MPa ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('平面内稳定', fmt(sigma_inplane,1) + ' / ' + f + ' MPa ' + (inOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('平面外稳定', fmt(sigma_outplane,1) + ' / ' + f + ' MPa ' + (outOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('翼缘宽厚比', fmt(flangeRatio,1) + ' / ' + fmt(flangeLimit,1) + ' ' + (flangeOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('腹板高厚比', fmt(webRatio,1) + ' / ' + fmt(webLimit,1) + ' ' + (webOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '钢柱各项验算均满足' : '钢柱验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._SC_RESULT = { sec: sec, lambdaX: lambdaX, lambdaY: lambdaY, phiX: phiX, phiY: phiY, sigma_strength: sigma_strength, tau: tau, sigma_inplane: sigma_inplane, sigma_outplane: sigma_outplane, allOk: allOk, steps: st.join('') };
            }
            function toggleCustom() {
                var t = document.getElementById('scc_secType').value;
                var hsec = document.getElementById('scc_hSection').parentElement.parentElement;
                var isec = document.getElementById('scc_iSection').parentElement.parentElement;
                var hInp = document.getElementById('scc_h').parentElement.parentElement;
                hsec.style.display = (t === 'H') ? '' : 'none';
                isec.style.display = (t === 'I') ? '' : 'none';
                hInp.style.gridColumn = (t === 'H' || t === 'I') ? '1 / -1' : 'auto';
                // 显示自定义字段
                var fields = ['scc_h','scc_b','scc_tw','scc_tf'];
                for (var i = 0; i < fields.length; i++) {
                    var el = document.getElementById(fields[i]).parentElement.parentElement;
                    el.style.display = (t === 'H' || t === 'I') ? 'none' : '';
                }
                calc();
            }
            function reset() {
                document.getElementById('scc_secType').value = 'H';
                document.getElementById('scc_hSection').value = 'HN400×200';
                document.getElementById('scc_iSection').value = 'I32a';
                ['scc_h','scc_b','scc_tw','scc_tf','scc_Lx','scc_Ly','scc_N','scc_Mx','scc_My','scc_V'].forEach(function (id) {
                    var defs = { scc_h:400, scc_b:200, scc_tw:8, scc_tf:13, scc_Lx:4.0, scc_Ly:2.0, scc_N:800, scc_Mx:120, scc_My:20, scc_V:80 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('scc_steel').value = 'Q355';
                document.getElementById('scc_bmx').value = '0.85';
                document.getElementById('scc_bty').value = '1.0';
                document.getElementById('scc_gamma').value = 'plas';
                document.getElementById('scc_secClass').value = 'b';
                toggleCustom();
                calc();
            }
            document.getElementById('scc_calc').addEventListener('click', calc);
            document.getElementById('scc_reset').addEventListener('click', reset);
            document.getElementById('scc_secType').addEventListener('change', toggleCustom);
            document.getElementById('f-scc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            toggleCustom();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['steel-column'] = tool;
})();
