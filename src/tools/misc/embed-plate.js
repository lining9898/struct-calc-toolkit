/* embed-plate 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '预埋件计算',
        sub: '直锚筋受拉 / 受剪 / 拉剪弯组合 · α_r α_v α_b · GB 50010 第 9.7 节',
        meta: {"standard": "GB/T 50010-2010（2024年版）混凝土结构设计标准", "formulaSource": "9.7", "limitations": "直锚筋受拉/受剪/拉剪弯组合，αr/αv/αb", "unit": "N:kN, V:kN, As:mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">锚板与锚筋参数</div>' +
                '<form id="f-ep"><div class="grid2">' +
                numField('ep_B', '锚板长度 / 宽度 B', 'mm', 200, '锚板沿受力方向的尺寸') +
                numField('ep_t', '锚板厚度 t', 'mm', 12) +
                numField('ep_d', '锚筋直径 d', 'mm', 16) +
                numField('ep_n', '锚筋根数 n', '根', 6) +
                selField('ep_arrange', '锚筋排数与层数', opts([
                    { v: '2x3', t: '2 列 × 3 排（共 6 根）' },
                    { v: '2x2', t: '2 列 × 2 排（共 4 根）' },
                    { v: '3x3', t: '3 列 × 3 排（共 9 根）' },
                    { v: '1x4', t: '单排 4 根' }
                ], '2x3')) +
                numField('ep_s', '锚筋间距 s', 'mm', 80, '锚筋之间的间距') +
                selField('ep_con', '混凝土等级', conOpts('C35')) +
                selField('ep_steel', '锚筋钢材', opts([
                    { v: 'HPB300', t: 'HPB300（光圆，f_y = 270 MPa）' },
                    { v: 'HRB400', t: 'HRB400（带肋，f_y = 360 MPa）' },
                    { v: 'HRB500', t: 'HRB500（带肋，f_y = 435 MPa）' }
                ], 'HRB400')) +
                numField('ep_as', '锚筋至锚板边缘 a', 'mm', 30, '外层锚筋中心到锚板边缘距离') +
                '</div><div class="panel-title" style="margin-top:14px;">外荷载</div><div class="grid2">' +
                numField('ep_N', '轴拉力 N', 'kN', 100, '法向拉力，拉力为正') +
                numField('ep_V', '剪力 V', 'kN', 80, '沿锚板平面的剪力') +
                numField('ep_M', '弯矩 M', 'kN·m', 20, '使部分锚筋受拉增大的弯矩') +
                selField('ep_loadCase', '受力状态', opts([
                    { v: 'tension', t: '轴心受拉（仅 N）' },
                    { v: 'shear', t: '受剪（仅 V）' },
                    { v: 'tenshear', t: '拉剪组合（N + V）' },
                    { v: 'bend', t: '拉弯剪组合（N + M + V）' }
                ], 'bend')) +
                '</div><div class="hint">说明：按 GB 50010 第 9.7.2 条直锚筋预埋件公式：N ≤ 0.8α_b·f_y·A_s（受拉）；V ≤ α_r·α_v·f_y·A_s（受剪）；拉弯剪组合用 N/(0.8α_b f_y A_s) + V/(α_r α_v f_y A_s) + ... 验算。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ep_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ep_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ep_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ep_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ep_result'), proc = document.getElementById('ep_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var Bp = parseFloat(document.getElementById('ep_B').value);
                var tp = parseFloat(document.getElementById('ep_t').value);
                var d = parseFloat(document.getElementById('ep_d').value);
                var n = parseInt(document.getElementById('ep_n').value);
                var arrV = document.getElementById('ep_arrange').value;
                var s = parseFloat(document.getElementById('ep_s').value);
                var conV = document.getElementById('ep_con').value;
                var steelV = document.getElementById('ep_steel').value;
                var a_edge = parseFloat(document.getElementById('ep_as').value);
                var N = parseFloat(document.getElementById('ep_N').value);
                var V = parseFloat(document.getElementById('ep_V').value);
                var M = parseFloat(document.getElementById('ep_M').value);
                var loadV = document.getElementById('ep_loadCase').value;
                if (!(d > 0 && n > 0)) return err('锚筋直径和根数必须为正数。');
                var con = CONCRETE[conV];
                var fc = con.fc, f_c = fc;
                var fy_map = { 'HPB300': 270, 'HRB400': 360, 'HRB500': 435 };
                var fy = fy_map[steelV] || 360;
                var st = [];

                // 单根锚筋面积
                var As1 = Math.PI * d * d / 4; // mm²
                var As_total = n * As1; // 总截面面积
                st.push('<div class="step"><b>① 锚板与锚筋参数</b>　锚板 ' + Bp + '×' + Bp + '×' + tp + ' mm；锚筋 ' + n + 'φ' + d + '；A<sub>s,total</sub> = ' + fmt(As_total, 0) + ' mm²</div>');
                st.push('<div class="step">　　混凝土 ' + conV + '（f<sub>c</sub> = ' + fc + ' MPa）；锚筋 ' + steelV + '（f<sub>y</sub> = ' + fy + ' MPa）</div>');

                // 系数 α_r（锚筋层数影响系数，层数≥4 时取 0.9；否则1.0）
                var n_layers = 0; // 层数（垂直剪力方向的排数）
                if (arrV === '2x3') n_layers = 3; // 3 排
                else if (arrV === '2x2') n_layers = 2;
                else if (arrV === '3x3') n_layers = 3;
                else n_layers = 1; // 1x4 单排
                var alpha_r = (n_layers >= 4) ? 0.85 : (n_layers === 3 ? 0.9 : 1.0);
                // α_v — 受剪承载力系数 α_v = (4.0-0.08d)√(f_c/f_y)  (GB 50010 式9.7.2-2)
                var alpha_v = (4.0 - 0.08 * d) * Math.sqrt(fc / fy);
                if (alpha_v > 0.7) alpha_v = 0.7;
                if (alpha_v < 0.15) alpha_v = 0.15;
                // α_b — 锚板弯曲变形折减系数 α_b = 0.6 + 0.25 t/d
                var alpha_b = 0.6 + 0.25 * tp / d;
                if (alpha_b > 1.0) alpha_b = 1.0;
                st.push('<div class="step"><b>② 系数</b></div>');
                st.push('<div class="step">　　α<sub>r</sub>（锚筋层数影响） = ' + alpha_r + '（层数 = ' + n_layers + '）</div>');
                st.push('<div class="step">　　α<sub>v</sub>（受剪承载力系数） = (4.0−0.08d)√(f<sub>c</sub>/f<sub>y</sub>) = <b>' + fmt(alpha_v, 3) + '</b>（≤ 0.7）</div>');
                st.push('<div class="step">　　α<sub>b</sub>（锚板弯曲折减） = 0.6 + 0.25t/d = <b>' + fmt(alpha_b, 3) + '</b>（≤ 1.0）</div>');

                // 各工况验算
                var tensionOk = true, shearOk = true, combOk = true;
                var N_max = 0.8 * alpha_b * fy * As_total / 1000; // kN
                var V_max = alpha_r * alpha_v * fy * As_total / 1000; // kN

                if (loadV === 'tension') {
                    tensionOk = N <= N_max;
                    st.push('<div class="step"><b>③ 轴心受拉验算（9.7.2-1）</b>　N ≤ 0.8α<sub>b</sub>·f<sub>y</sub>·A<sub>s</sub></div>');
                    st.push('<div class="step">　　N<sub>u</sub> = 0.8 × ' + fmt(alpha_b,3) + ' × ' + fy + ' × ' + fmt(As_total,0) + ' / 1000 = <b>' + fmt(N_max, 1) + ' kN</b></div>');
                    st.push('<div class="step">　　N = ' + N + ' kN ≤ N<sub>u</sub> ⇒ ' + (tensionOk ? '满足' + tag('ok','抗拉满足') : '不满足' + tag('err','抗拉不足')) + '</div>');
                } else if (loadV === 'shear') {
                    shearOk = V <= V_max;
                    st.push('<div class="step"><b>③ 受剪验算（9.7.2-2）</b>　V ≤ α<sub>r</sub>·α<sub>v</sub>·f<sub>y</sub>·A<sub>s</sub></div>');
                    st.push('<div class="step">　　V<sub>u</sub> = ' + alpha_r + ' × ' + fmt(alpha_v,3) + ' × ' + fy + ' × ' + fmt(As_total,0) + ' / 1000 = <b>' + fmt(V_max, 1) + ' kN</b></div>');
                    st.push('<div class="step">　　V = ' + V + ' kN ≤ V<sub>u</sub> ⇒ ' + (shearOk ? '满足' + tag('ok','抗剪满足') : '不满足' + tag('err','抗剪不足')) + '</div>');
                } else if (loadV === 'tenshear') {
                    // 拉剪组合：N/(0.8α_b f_y A_s) + V/(α_r α_v f_y A_s) ≤ 1
                    var ratio_ts = N / N_max + V / V_max;
                    combOk = ratio_ts <= 1;
                    st.push('<div class="step"><b>③ 拉剪组合验算</b>　N/N<sub>u,t</sub> + V/V<sub>u,v</sub> ≤ 1</div>');
                    st.push('<div class="step">　　N<sub>u,t</sub> = ' + fmt(N_max,1) + ' kN；V<sub>u,v</sub> = ' + fmt(V_max,1) + ' kN</div>');
                    st.push('<div class="step">　　' + fmt(N,1) + '/' + fmt(N_max,1) + ' + ' + fmt(V,1) + '/' + fmt(V_max,1) + ' = <b>' + fmt(ratio_ts, 3) + '</b> ≤ 1 ⇒ ' + (combOk ? '满足' + tag('ok','拉剪满足') : '不满足' + tag('err','拉剪不足')) + '</div>');
                } else {
                    // 拉弯剪组合
                    // 最不利锚筋拉力 = N/n + M*y_max / (Σy_i² · n_col? )  简化：弯矩下每根锚筋拉力按线性分布
                    // 假设锚筋布置在高度方向有 z 排，总高度 = (z-1)*s
                    // 最上排（或最下排）锚筋拉力增量 ΔN = M * y_max / Σ y_i²
                    var y_max = (n_layers - 1) / 2 * s;
                    var sumY2 = 0;
                    for (var i = 0; i < n_layers; i++) {
                        var yi = ((n_layers - 1) / 2 - i) * s;
                        sumY2 += (n / n_layers) * yi * yi; // 每层 n/n_layers 根
                    }
                    var delta_N = M * 1e6 * y_max / sumY2 / 1000; // kN (单根)
                    var N1_avg = N / n; // 单根平均拉力 kN
                    var N1_max = N1_avg + delta_N; // 最不利单根拉力 kN
                    if (N1_max < 0) N1_max = 0;
                    // 单根剪力 V1 = V / n
                    var V1 = V / n;
                    // 单根抗拉承载力 N1_max_cap = 0.8 * alpha_b * fy * As1 / 1000
                    var N1_cap = 0.8 * alpha_b * fy * As1 / 1000; // kN
                    var V1_cap = alpha_r * alpha_v * fy * As1 / 1000; // kN
                    // 拉剪弯组合（单根锚筋）：N1/N1_cap + V1/V1_cap ≤ 1?
                    // 规范 9.7.2 有弯矩时用公式：N ≤ 0.8α_b A_s f_y - M / 1.3z  更复杂
                    // 简化：用拉剪比叠加（近似）
                    var ratio_comb = N1_max / N1_cap + V1 / V1_cap;
                    combOk = ratio_comb <= 1;
                    st.push('<div class="step"><b>③ 拉弯剪组合验算（单根最不利锚筋）</b></div>');
                    st.push('<div class="step">　　层数 = ' + n_layers + '，层距 = ' + s + ' mm；y<sub>max</sub> = ' + fmt(y_max,0) + ' mm；Σ(y<sub>i</sub>²·n<sub>i</sub>) = ' + fmt(sumY2,0) + ' mm²</div>');
                    st.push('<div class="step">　　单根平均拉力 N<sub>avg</sub> = ' + fmt(N1_avg,2) + ' kN；弯矩附加 ΔN = ' + fmt(delta_N,2) + ' kN；最不利 N<sub>1,max</sub> = <b>' + fmt(N1_max,2) + ' kN</b></div>');
                    st.push('<div class="step">　　单根抗剪 V<sub>1</sub> = ' + fmt(V1,2) + ' kN；单根抗剪承载 V<sub>1,u</sub> = ' + fmt(V1_cap,2) + ' kN</div>');
                    st.push('<div class="step">　　组合比 = N<sub>1,max</sub>/(0.8α<sub>b</sub>f<sub>y</sub>A<sub>s1</sub>) + V<sub>1</sub>/(α<sub>r</sub>α<sub>v</sub>f<sub>y</sub>A<sub>s1</sub>) = <b>' + fmt(ratio_comb, 3) + '</b> ≤ 1 ⇒ ' + (combOk ? '满足' + tag('ok','组合满足') : '不满足' + tag('err','组合不足')) + '</div>');
                    st.push('<div class="step">　　<span style="font-size:12px;color:var(--muted);">注：简化按单根锚筋最不利叠加法计算，精确设计应按规范 9.7.2 条考虑锚板与锚筋的共同工作。</span></div>');
                }

                // 锚板厚度构造：t ≥ d/2，且 ≥ 8mm
                var t_min = Math.max(d / 2, 8);
                var plateOk = tp >= t_min;
                st.push('<div class="step"><b>④ 锚板厚度构造</b>　t ≥ d/2 且 ≥ 8 mm ⇒ t ≥ ' + fmt(t_min,1) + ' mm；t = ' + tp + ' mm ⇒ ' + (plateOk ? '满足' + tag('ok','板厚满足') : '不满足' + tag('err','板厚不足')) + '</div>');

                // 锚固长度建议
                var la = 0.14 * fy / con.ft * d; // 近似
                if (steelV === 'HPB300') la = 0.16 * fy / con.ft * d; // 光圆 α=0.16
                if (la < 15 * d) la = 15 * d;
                if (la < 200) la = 200;
                st.push('<div class="step"><b>⑤ 锚筋锚固长度建议</b>　l<sub>a</sub> ≈ α·f<sub>y</sub>/f<sub>t</sub>·d ≈ <b>' + fmt(la, 0) + ' mm</b>（约 ' + fmt(la/d,1) + 'd），端部做 180° 弯钩或机械锚固</div>');

                var allOk = tensionOk && shearOk && combOk && plateOk;
                var html = resultRow('锚板 / 锚筋', Bp + '×' + tp + ' mm / ' + n + 'φ' + d);
                html += resultRow('总锚筋面积 A<sub>s</sub>', fmt(As_total,0) + ' mm²');
                html += resultRow('系数 α<sub>b</sub> / α<sub>v</sub> / α<sub>r</sub>', fmt(alpha_b,3) + ' / ' + fmt(alpha_v,3) + ' / ' + alpha_r);
                if (loadV === 'tension') html += resultRow('抗拉 N / N<sub>u</sub>', N + ' / ' + fmt(N_max,1) + ' kN ' + (tensionOk ? tag('ok','满足') : tag('err','不足')));
                if (loadV === 'shear') html += resultRow('抗剪 V / V<sub>u</sub>', V + ' / ' + fmt(V_max,1) + ' kN ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                if (loadV === 'tenshear') html += resultRow('拉剪组合比', (N/N_max + V/V_max).toFixed(3) + ' ≤ 1 ' + (combOk ? tag('ok','满足') : tag('err','不足')));
                if (loadV === 'bend') html += resultRow('拉弯剪组合比', '（单根最不利）≈ ' + (N1_max/N1_cap + V1/V1_cap).toFixed(3) + ' ≤ 1 ' + (combOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('锚板厚度构造', tp + ' / ≥ ' + fmt(t_min,0) + ' mm ' + (plateOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('建议锚固长度', fmt(la, 0) + ' mm ≈ ' + fmt(la/d,1) + 'd');
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '预埋件各项验算均满足' : '预埋件验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._EP_RESULT = { N_max: N_max, V_max: V_max, alpha_b: alpha_b, alpha_v: alpha_v, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['ep_B','ep_t','ep_d','ep_n','ep_s','ep_as','ep_N','ep_V','ep_M'].forEach(function (id) {
                    var defs = { ep_B:200, ep_t:12, ep_d:16, ep_n:6, ep_s:80, ep_as:30, ep_N:100, ep_V:80, ep_M:20 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('ep_arrange').value = '2x3';
                document.getElementById('ep_con').value = 'C35';
                document.getElementById('ep_steel').value = 'HRB400';
                document.getElementById('ep_loadCase').value = 'bend';
                calc();
            }
            document.getElementById('ep_calc').addEventListener('click', calc);
            document.getElementById('ep_reset').addEventListener('click', reset);
            document.getElementById('f-ep').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['embed-plate'] = tool;
})();
