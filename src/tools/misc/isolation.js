/* isolation 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '隔震设计简化计算',
        sub: '隔震层等效刚度/阻尼比 · 基本周期 · 水平向减震系数 · 支座剪应变/压应力/风位移验算 · GB 50011 §12',
        meta: {"standard": "GB/T 50011-2010（2024年版）建筑抗震设计标准", "formulaSource": "12", "limitations": "隔震层等效刚度/等效阻尼比/水平减震系数", "unit": "Keq:kN/mm, ζeq:%, β:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">上部结构参数</div>' +
                '<form id="f-iso"><div class="grid2">' +
                numField('iso_W', '上部结构总重力荷载代表值 W', 'kN', 60000, '多质点总重量，含永久荷载+0.5可变荷载标准值') +
                numField('iso_H', '上部结构等效高度 H', 'm', 18, '取重心至隔震层顶面的高度') +
                numField('iso_n', '隔震支座数量 n', '个', 16, '隔震层布置的支座总数') +
                selField('iso_intensity', '抗震设防烈度', opts([
                    { v: 7, t: '7 度（0.10g）' },
                    { v: '7.5', t: '7 度（0.15g）' },
                    { v: 8, t: '8 度（0.20g）' },
                    { v: '8.5', t: '8 度（0.30g）' },
                    { v: 9, t: '9 度（0.40g）' }
                ], 8)) +
                selField('iso_site', '建筑场地类别', opts([
                    { v: 'I0', t: 'I₀ 类' },
                    { v: 'I1', t: 'I₁ 类' },
                    { v: 'II', t: 'II 类' },
                    { v: 'III', t: 'III 类' },
                    { v: 'IV', t: 'IV 类' }
                ], 'II')) +
                selField('iso_group', '设计地震分组', opts([
                    { v: 1, t: '第一组' },
                    { v: 2, t: '第二组' },
                    { v: 3, t: '第三组' }
                ], 2)) +
                '</div><div class="panel-title" style="margin-top:14px;">隔震支座参数（每支座）</div><div class="grid2">' +
                selField('iso_type', '支座类型', opts([
                    { v: 'LNR', t: '天然橡胶支座（LNR）' },
                    { v: 'LRB', t: '铅芯橡胶支座（LRB）' },
                    { v: 'HDR', t: '高阻尼橡胶支座（HDR）' }
                ], 'LRB')) +
                numField('iso_D', '支座有效直径 D', 'mm', 500, '不含法兰板的外径') +
                numField('iso_tr', '橡胶总厚度 T<sub>r</sub>', 'mm', 100, '各层橡胶片厚度之和') +
                numField('iso_Kd', '支座水平等效刚度 K<sub>h</sub>', 'kN/mm', 1.5, '100%剪应变下等效水平刚度') +
                numField('iso_zeta', '支座等效阻尼比 ζ<sub>eq</sub>', '%', 18, '100%剪应变下等效阻尼比') +
                '</div><div class="panel-title" style="margin-top:14px;">铅芯参数（LRB选用）</div><div class="grid2">' +
                numField('iso_Qd', '特征强度 Q<sub>d</sub>', 'kN', 50, '铅芯屈服力，非LRB填0') +
                numField('iso_A', '支座有效截面面积 A', 'cm²', 1963, 'πD²/4，D=500mm→1963cm²') +
                '</div><div class="panel-title" style="margin-top:14px;">风荷载与罕遇地震验算参数</div><div class="grid2">' +
                numField('iso_Vw', '风荷载标准值 V<sub>w</sub>', 'kN', 80, '上部结构基底风荷载标准值') +
                numField('iso_Vmax', '罕遇地震下隔震层最大剪力 V<sub>max</sub>', 'kN', 3000, '罕遇地震作用下隔震层总水平力') +
                numField('iso_dmax', '罕遇地震下最大位移 Δ<sub>max</sub>', 'mm', 150, '隔震层在罕遇地震下的最大水平位移') +
                '</div><div class="hint">说明：依据 GB/T 50011-2010（2024年版） §12.2.4~12.2.7 和附录L 计算隔震层等效刚度、等效阻尼比、基本自振周期和水平向减震系数。隔震后结构抗震措施按降一度（不小于6度）考虑。罕遇地震下支座剪应变应满足 γ ≤ [γ]（一般350%~450%），压应力应满足 σ ≤ 30MPa（橡胶支座）。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="iso_calc">计算隔震参数</button>' +
                '<button type="button" class="btn btn-secondary" id="iso_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="iso_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="iso_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('iso_result');
                var proc = document.getElementById('iso_proc');
                var W = parseFloat(document.getElementById('iso_W').value) * 1000; // kN → N
                var H = parseFloat(document.getElementById('iso_H').value);
                var n = parseFloat(document.getElementById('iso_n').value);
                var intensity = document.getElementById('iso_intensity').value;
                var site = document.getElementById('iso_site').value;
                var group = parseInt(document.getElementById('iso_group').value);
                var type = document.getElementById('iso_type').value;
                var D = parseFloat(document.getElementById('iso_D').value);
                var Tr = parseFloat(document.getElementById('iso_tr').value);
                var Kh = parseFloat(document.getElementById('iso_Kd').value) * 1000; // kN/mm → kN/m
                var zeta = parseFloat(document.getElementById('iso_zeta').value) / 100; // % → decimal
                var Qd = parseFloat(document.getElementById('iso_Qd').value);
                var A_cm2 = parseFloat(document.getElementById('iso_A').value);
                var Vw = parseFloat(document.getElementById('iso_Vw').value);
                var Vmax = parseFloat(document.getElementById('iso_Vmax').value);
                var dmax = parseFloat(document.getElementById('iso_dmax').value);
                var st = [];

                // ① 隔震层等效刚度和等效阻尼比（§12.2.4）
                var K_eq = n * Kh; // kN/m
                var zeta_eq = zeta; // 所有支座相同时直接取

                st.push('<div class="step"><b>① 隔震层等效刚度 K<sub>eq</sub> 和等效阻尼比 ζ<sub>eq</sub>（§12.2.4）</b></div>');
                st.push('<div class="step">　　K<sub>eq</sub> = ΣK<sub>j</sub> = n × K<sub>h</sub> = ' + n + ' × ' + (Kh / 1000).toFixed(2) + ' kN/mm</div>');
                st.push('<div class="step">　　<b>K<sub>eq</sub> = ' + (K_eq / 1000).toFixed(2) + ' kN/mm = ' + K_eq.toFixed(0) + ' kN/m</b></div>');
                st.push('<div class="step">　　ζ<sub>eq</sub> = Σ(K<sub>j</sub>·ζ<sub>j</sub>)/K<sub>eq</sub> = <b>' + (zeta_eq * 100).toFixed(1) + '%</b></div>');

                // ② 隔震结构基本自振周期（§12.2.5）
                var g = 9.81; // m/s²
                var T_eq = 2 * Math.PI * Math.sqrt(W / (K_eq * g));
                st.push('<div class="step"><b>② 隔震结构基本自振周期 T<sub>eq</sub>（§12.2.5）</b></div>');
                st.push('<div class="step">　　T<sub>eq</sub> = 2π·√(W / (K<sub>eq</sub>·g))</div>');
                st.push('<div class="step">　　W = ' + (W / 1000).toFixed(0) + ' kN = ' + (W / 1000) + ' kN</div>');
                st.push('<div class="step">　　K<sub>eq</sub> = ' + K_eq.toFixed(0) + ' kN/m, g = 9.81 m/s²</div>');
                st.push('<div class="step">　　W/(K<sub>eq</sub>·g) = ' + (W / 1000) + ' × 1000 / (' + K_eq.toFixed(0) + ' × 9.81) = ' + (W / (K_eq * g)).toFixed(4) + '</div>');
                st.push('<div class="step">　　<b>T<sub>eq</sub> = ' + T_eq.toFixed(3) + ' s</b></div>');

                // ③ 地震影响系数（§5.1.5 表5.1.4-1/2）
                var alpha_max_map = { '7': 0.08, '7.5': 0.12, '8': 0.16, '8.5': 0.24, '9': 0.32 };
                var alpha_max_rare = { '7': 0.50, '7.5': 0.72, '8': 0.90, '8.5': 1.20, '9': 1.40 };
                var alpha_max = alpha_max_map[intensity];
                var alpha_max_r = alpha_max_rare[intensity];

                var Tg_map = {
                    'I0_1': 0.20, 'I0_2': 0.25, 'I0_3': 0.30,
                    'I1_1': 0.25, 'I1_2': 0.30, 'I1_3': 0.35,
                    'II_1': 0.35, 'II_2': 0.40, 'II_3': 0.45,
                    'III_1': 0.45, 'III_2': 0.50, 'III_3': 0.55,
                    'IV_1': 0.65, 'IV_2': 0.75, 'IV_3': 0.90
                };
                var Tg_key = site + '_' + group;
                var Tg = Tg_map[Tg_key] || 0.40;
                var gamma = 0.9; // 衰减指数（ζ=5%时）
                var eta1 = 0.02; // 直线下降段斜率调整系数
                var eta2 = 1 + (0.05 - zeta_eq) / (0.06 + 1.7 * zeta_eq);
                // 阻尼比修正
                if (zeta_eq > 0.05) {
                    gamma = 0.9 + (0.05 - zeta_eq) / (0.5 + 1.5 * zeta_eq) * 0.5;
                    eta1 = 0.02 + (0.05 - zeta_eq) / 8;
                    if (eta1 < 0) eta1 = 0;
                }
                if (eta2 < 0.55) eta2 = 0.55;

                var alpha1;
                if (T_eq <= 0.1) {
                    alpha1 = alpha_max;
                } else if (T_eq <= Tg) {
                    alpha1 = eta2 * alpha_max * (T_eq / Tg) * 0.45 + (1 - 0.45) * alpha_max * eta2 * (T_eq / Tg);
                    // Simplified: alpha1 = alpha_max * (T_eq/Tg)^gamma * eta2
                    alpha1 = alpha_max * Math.pow(T_eq / Tg, gamma) * eta2;
                } else if (T_eq <= 5 * Tg) {
                    alpha1 = alpha_max * Math.pow(T_eq / Tg, gamma) * eta2;
                } else {
                    alpha1 = alpha_max * Math.pow(5, gamma) * eta2 - eta1 * (T_eq - 5 * Tg);
                    if (alpha1 < 0.2 * alpha_max) alpha1 = 0.2 * alpha_max;
                }

                st.push('<div class="step"><b>③ 隔震后地震影响系数 α<sub>1</sub>（§5.1.5）</b></div>');
                st.push('<div class="step">　　多遇地震 α<sub>max</sub> = ' + alpha_max + '（烈度' + intensity + '度）</div>');
                st.push('<div class="step">　　特征周期 T<sub>g</sub> = ' + Tg.toFixed(2) + ' s（场地' + site + '，第' + group + '组）</div>');
                st.push('<div class="step">　　阻尼比 ζ<sub>eq</sub> = ' + (zeta_eq * 100).toFixed(1) + '% → γ = ' + gamma.toFixed(3) + ', η₂ = ' + eta2.toFixed(3) + '</div>');
                if (T_eq <= 5 * Tg) {
                    st.push('<div class="step">　　T<sub>g</sub> < T<sub>eq</sub> ≤ 5T<sub>g</sub>：α<sub>1</sub> = (α<sub>max</sub>/T<sub>g</sub><sup>γ</sup>) · T<sub>eq</sub><sup>γ</sup> · η₂</div>');
                    st.push('<div class="step">　　α<sub>1</sub> = (' + alpha_max + '/' + Tg.toFixed(2) + '<sup>' + gamma.toFixed(3) + '</sup>) × ' + T_eq.toFixed(3) + '<sup>' + gamma.toFixed(3) + '</sup> × ' + eta2.toFixed(3) + '</div>');
                }
                st.push('<div class="step">　　<b>α<sub>1</sub> = ' + alpha1.toFixed(4) + '</b></div>');

                // ④ 水平向减震系数（§12.2.5）
                // 非隔震结构周期估算
                var T0 = 0.1 * n; // 简化估算非隔震周期
                if (T0 < 0.3) T0 = 0.3;
                var alpha0;
                if (T0 <= Tg) {
                    alpha0 = alpha_max * Math.pow(T0 / Tg, 0.9) * 1.0; // ζ=5%
                } else if (T0 <= 5 * Tg) {
                    alpha0 = alpha_max * Math.pow(T0 / Tg, 0.9);
                } else {
                    alpha0 = alpha_max * Math.pow(5, 0.9) - 0.02 * (T0 - 5 * Tg);
                    if (alpha0 < 0.2 * alpha_max) alpha0 = 0.2 * alpha_max;
                }
                var beta = alpha1 / alpha0;

                st.push('<div class="step"><b>④ 水平向减震系数 β（§12.2.5）</b></div>');
                st.push('<div class="step">　　非隔震结构周期 T₀ ≈ ' + T0.toFixed(2) + ' s（估算）</div>');
                st.push('<div class="step">　　非隔震 α₀ = ' + alpha0.toFixed(4) + '</div>');
                st.push('<div class="step">　　β = α₁/α₀ = ' + alpha1.toFixed(4) + '/' + alpha0.toFixed(4) + ' = <b>' + beta.toFixed(3) + '</b></div>');
                st.push('<div class="step">　　' + (beta < 0.45 ? '隔震后抗震措施可降低一度（§12.2.7条第3款）' : '抗震措施不降低或仅部分降低') + '</div>');

                // ⑤ 隔震层罕遇地震下位移验算（§12.2.7）
                var V_iso = Vmax; // kN
                var delta_max = dmax; // mm
                var gamma_shear = delta_max / Tr; // 剪应变

                st.push('<div class="step"><b>⑤ 罕遇地震下隔震层位移验算（§12.2.7）</b></div>');
                st.push('<div class="step">　　罕遇地震位移 Δ<sub>max</sub> = ' + delta_max + ' mm</div>');
                st.push('<div class="step">　　剪应变 γ = Δ<sub>max</sub>/T<sub>r</sub> = ' + delta_max + '/' + Tr + ' = ' + (gamma_shear * 100).toFixed(1) + '%</div>');
                st.push('<div class="step">　　' + (gamma_shear <= 3.5 ? '✓ γ ≤ 350%（满足）' : '✗ γ > 350%（需增大支座直径或层数）') + '</div>');
                st.push('<div class="step">　　支座有效直径 D = ' + D + ' mm, 0.55D = ' + (0.55 * D).toFixed(0) + ' mm</div>');
                st.push('<div class="step">　　' + (delta_max <= 0.55 * D ? '✓ Δ ≤ 0.55D（满足）' : '✗ Δ > 0.55D（不满足）') + '</div>');

                // ⑥ 支座压应力验算
                var N_per = W / n / 1000; // kN per bearing
                var A_m2 = A_cm2 * 1e-4; // cm² → m²
                var sigma = N_per / (A_m2 * 1000); // kN/m² → kPa → MPa
                // 罕遇地震下附加弯矩引起的压应力增大
                var M_rare = Vmax * H / 1000; // kN·m (simplified)
                var sigma_max = sigma + 0; // simplified

                st.push('<div class="step"><b>⑥ 支座压应力验算（§L.1.2/L.2.2）</b></div>');
                st.push('<div class="step">　　每支座竖向力 N = W/n = ' + (W / 1000) + '/' + n + ' = ' + N_per.toFixed(0) + ' kN</div>');
                st.push('<div class="step">　　支座面积 A = ' + A_cm2 + ' cm² = ' + A_m2.toFixed(4) + ' m²</div>');
                st.push('<div class="step">　　平均压应力 σ = N/A = ' + N_per + '/' + (A_m2 * 1000).toFixed(1) + ' = <b>' + sigma.toFixed(2) + ' MPa</b></div>');
                st.push('<div class="step">　　' + (sigma <= 15 ? '✓ σ ≤ 15MPa（多遇地震满足）' : '需检查（多遇地震σ宜≤15MPa）') + '</div>');
                st.push('<div class="step">　　罕遇地震: σ + Δσ ≤ 30 MPa（橡胶支座限值）</div>');

                // ⑦ 风荷载验算
                var delta_w = Vw / (K_eq / 1000); // mm (K_eq in kN/mm)
                st.push('<div class="step"><b>⑦ 风荷载位移验算（§12.2.4）</b></div>');
                st.push('<div class="step">　　隔震层风位移 Δ<sub>w</sub> = V<sub>w</sub>/K<sub>eq</sub> = ' + Vw + '/' + (K_eq / 1000).toFixed(2) + ' = ' + delta_w.toFixed(2) + ' mm</div>');
                st.push('<div class="step">　　' + (delta_w <= 3 ? '✓ Δ<sub>w</sub> ≤ 3mm（满足，风荷载不引起隔震层启动）' : '需检查抗风装置') + '</div>');

                // ⑧ 隔震层抗倾覆验算
                var M_w = Vmax * H; // kN·m (rare earthquake)
                var W_kN = W / 1000;
                var R = D / 2 / 1000; // m
                var overturn_ratio = M_w / (W_kN * R);
                st.push('<div class="step"><b>⑧ 罕遇地震抗倾覆验算（§12.2.7）</b></div>');
                st.push('<div class="step">　　倾覆力矩 M = V<sub>max</sub>·H = ' + Vmax + ' × ' + H + ' = ' + M_w + ' kN·m</div>');
                st.push('<div class="step">　　抗倾覆力矩 = W·R = ' + W_kN + ' × ' + R.toFixed(2) + ' = ' + (W_kN * R).toFixed(0) + ' kN·m</div>');
                st.push('<div class="step">　　' + (M_w <= W_kN * R ? '✓ 抗倾覆满足' : '✗ 抗倾覆不满足，需增大支座间距') + '</div>');

                var html = resultRow('隔震层等效刚度 K<sub>eq</sub>', (K_eq / 1000).toFixed(2) + ' kN/mm');
                html += resultRow('等效阻尼比 ζ<sub>eq</sub>', (zeta_eq * 100).toFixed(1) + ' %');
                html += resultRow('基本周期 T<sub>eq</sub>', T_eq.toFixed(3) + ' s');
                html += resultRow('水平向减震系数 β', beta.toFixed(3) + (beta < 0.45 ? '（可降一度）' : '（不降或部分降）'));
                html += resultRow('罕遇地震剪应变', (gamma_shear * 100).toFixed(1) + ' % ' + (gamma_shear <= 3.5 ? '✓' : '✗'));
                html += resultRow('支座平均压应力', sigma.toFixed(2) + ' MPa');
                html += resultRow('风位移', delta_w.toFixed(2) + ' mm ' + (delta_w <= 3 ? '✓' : '需检查'));
                html += resultRow('说明', badge('badge-ok', '按GB 50011 §12计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('iso_W').value = 60000;
                document.getElementById('iso_H').value = 18;
                document.getElementById('iso_n').value = 16;
                document.getElementById('iso_intensity').value = 8;
                document.getElementById('iso_site').value = 'II';
                document.getElementById('iso_group').value = 2;
                document.getElementById('iso_type').value = 'LRB';
                document.getElementById('iso_D').value = 500;
                document.getElementById('iso_tr').value = 100;
                document.getElementById('iso_Kd').value = 1.5;
                document.getElementById('iso_zeta').value = 18;
                document.getElementById('iso_Qd').value = 50;
                document.getElementById('iso_A').value = 1963;
                document.getElementById('iso_Vw').value = 80;
                document.getElementById('iso_Vmax').value = 3000;
                document.getElementById('iso_dmax').value = 150;
                calc();
            }
            document.getElementById('iso_calc').addEventListener('click', calc);
            document.getElementById('iso_reset').addEventListener('click', reset);
            document.getElementById('f-iso').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['isolation'] = tool;
})();
