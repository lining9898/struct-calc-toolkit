/* col-tie 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '柱箍筋加密区验算',
        sub: '加密区长度 · 间距限值 · 体积配箍率 · GB/T 50011-2010（2024年版） 第 6.3 节',
        meta: {"standard": "GB/T 50011-2010（2024年版）建筑抗震设计标准", "formulaSource": "6.3", "limitations": "加密区长度/间距/体积配箍率/最小λv", "unit": "ρv:%, λv:—, s:mm", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">柱与箍筋参数</div>' +
                '<form id="f-ct"><div class="grid2">' +
                numField('ct_b', '柱截面宽度 b', 'mm', 600) +
                numField('ct_h', '柱截面高度 h', 'mm', 600) +
                numField('ct_Hn', '柱净高 H<sub>n</sub>', 'm', 3.0, '层高减去梁高，即净高度') +
                selField('ct_shape', '柱截面形状', opts([
                    { v: 'rect', t: '矩形 / 方形' },
                    { v: 'circle', t: '圆形' }
                ], 'rect')) +
                selField('ct_level', '抗震等级', opts([
                    { v: '1', t: '一级' },
                    { v: '2', t: '二级' },
                    { v: '3', t: '三级' },
                    { v: '4', t: '四级' }
                ], '2')) +
                numField('ct_n', '轴压比 n', '', 0.6, '轴压比 N/(f_c·A)') +
                selField('ct_place', '位置', opts([
                    { v: 'bottom', t: '底层柱下端（根）' },
                    { v: 'middle', t: '一般层上下端' },
                    { v: 'top', t: '顶层柱上端' }],
                    'middle')) +
                selField('ct_frameType', '框架类型', opts([
                    { v: 'ordinary', t: '普通框架' },
                    { v: 'short', t: '框支柱 / 短柱' }
                ], 'ordinary')) +
                selField('ct_con', '混凝土等级', conOpts('C40')) +
                selField('cv_tieSteel', '箍筋等级', opts([{ v: 'HPB300', t: 'HPB300' }, { v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('ct_d', '箍筋直径 d', 'mm', 10) +
                numField('ct_legs', '箍筋肢数（b 向）', '肢', 4) +
                numField('ct_legsH', '箍筋肢数（h 向）', '肢', 4) +
                numField('ct_s', '箍筋间距 s', 'mm', 100) +
                '</div><div class="hint">说明：按 GB 50011 第 6.3.7、6.3.9 条验算加密区长度范围、箍筋直径/间距限值、体积配箍率 ρ<sub>v</sub> 与最小配箍特征值 λ<sub>v</sub> 比较（λ<sub>v</sub> 按轴压比插值）。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ct_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ct_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ct_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ct_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ct_result'), proc = document.getElementById('ct_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var b = parseFloat(document.getElementById('ct_b').value);
                var h = parseFloat(document.getElementById('ct_h').value);
                var Hn = parseFloat(document.getElementById('ct_Hn').value) * 1000; // mm
                var level = document.getElementById('ct_level').value;
                var n = parseFloat(document.getElementById('ct_n').value);
                var place = document.getElementById('ct_place').value;
                var frameV = document.getElementById('ct_frameType').value;
                var conV = document.getElementById('ct_con').value;
                var tieSteel = document.getElementById('cv_tieSteel').value;
                var d = parseFloat(document.getElementById('ct_d').value);
                var legsB = parseInt(document.getElementById('ct_legs').value);
                var legsH = parseInt(document.getElementById('ct_legsH').value);
                var s = parseFloat(document.getElementById('ct_s').value);
                if (!(b > 0 && h > 0)) return err('截面尺寸必须为正数。');
                var fc = CONCRETE[conV].fc;
                var fy = { 'HPB300': 270, 'HRB400': 360, 'HRB500': 435 }[tieSteel] || 360;
                var f_yv = fy; // 箍筋抗拉强度
                var st = [];

                // ① 加密区长度
                // 一般：max(长边尺寸, Hn/6, 500mm)
                // 底层柱下端根部位：Hn/3
                // 二级框架角柱、剪跨比不大于2的柱：全高加密
                var Lz = Math.max(Math.max(b, h), Hn / 6, 500);
                var L_bottom = Hn / 3; // 底层下端
                var L_req = (place === 'bottom') ? Math.max(Lz, L_bottom) : Lz;
                if (frameV === 'short') L_req = Hn; // 短柱全高加密
                st.push('<div class="step"><b>① 加密区长度（6.3.7-1）</b></div>');
                st.push('<div class="step">　　一般要求：max(长边=' + Math.max(b,h) + ', H<sub>n</sub>/6=' + fmt(Hn/6,0) + ', 500) = ' + fmt(Lz, 0) + ' mm</div>');
                if (place === 'bottom') st.push('<div class="step">　　底层柱下端：≥ H<sub>n</sub>/3 = ' + fmt(L_bottom,0) + ' mm</div>');
                if (frameV === 'short') st.push('<div class="step">　　短柱 / 剪跨比 ≤ 2：全高加密 = ' + fmt(Hn,0) + ' mm' + tag('warn','全高加密') + '</div>');
                st.push('<div class="step">　　<b>加密区长度要求：≥ ' + fmt(L_req, 0) + ' mm</b></div>');

                // ② 箍筋直径与间距限值（6.3.7-2）
                // 直径：一级 ≥ 10mm，二级 ≥ 8mm，三四级 ≥ 6mm（普通）
                // 间距：一级 ≤ min(6d, 100); 二级 ≤ min(8d, 100); 三级 ≤ min(8d, 150); 四级 ≤ min(8d, 150)
                var d_min_map = { '1': 10, '2': 8, '3': 6, '4': 6 };
                var s_max_map = { '1': Math.min(6*d, 100), '2': Math.min(8*d, 100), '3': Math.min(8*d, 150), '4': Math.min(8*d, 150) };
                var d_min = d_min_map[level] || 8;
                var s_max = s_max_map[level] || 100;
                // 底层柱下端、剪跨比不大于2的柱：间距 ≤ 100mm（更严格）
                if (place === 'bottom' || frameV === 'short') s_max = Math.min(s_max, 100);
                var dOk = d >= d_min;
                var sOk = s <= s_max;
                st.push('<div class="step"><b>② 箍筋直径与间距限值（6.3.7-2）</b></div>');
                st.push('<div class="step">　　抗震等级 ' + level + ' 级：直径 ≥ ' + d_min + ' mm；间距 ≤ ' + fmt(s_max,0) + ' mm</div>');
                st.push('<div class="step">　　实配：d = ' + d + ' mm ' + (dOk ? '✓' : '✗') + '；s = ' + s + ' mm ' + (sOk ? '✓' : '✗') + '</div>');

                // ③ 体积配箍率 ρ_v = Σ(A_si * l_i) / (A_core * s)
                // A_core：核心区面积 = (b - 2c) * (h - 2c)，c 取保护层厚度（一般 20~30mm）
                var c = 20; // 保护层厚度简化 20 mm
                var b_core = b - 2 * c - d; // 核心区宽（箍筋内表面）
                var h_core = h - 2 * c - d;
                var A_core = b_core * h_core; // mm²
                // 单肢箍筋面积
                var A_si = Math.PI * d * d / 4; // mm²
                // 箍筋总长度：b 方向 (legsB 肢) + h 方向 (legsH 肢)
                // 注意：四肢箍 b 方向有 3 段? 不对：n 肢箍 = n 根竖肢 + 2 根横肢，横肢长度为 b_core
                // 简化：总体积 = legsB 个竖向肢 * h_core + legsH 个横向肢 * b_core
                var L_total = legsB * h_core + legsH * b_core;
                var V_s = A_si * L_total; // 一个间距内箍筋体积 mm³
                var V_core = A_core * s; // 核心混凝土体积 mm³
                var rho_v = V_s / V_core; // 体积配箍率
                st.push('<div class="step"><b>③ 体积配箍率 ρ<sub>v</sub> 计算</b></div>');
                st.push('<div class="step">　　核心区：b<sub>cor</sub> = ' + fmt(b_core,0) + ' mm，h<sub>cor</sub> = ' + fmt(h_core,0) + ' mm，A<sub>cor</sub> = ' + fmt(A_core,0) + ' mm²</div>');
                st.push('<div class="step">　　箍筋单肢面积 A<sub>si</sub> = πd²/4 = ' + fmt(A_si,1) + ' mm²；总长度 L<sub>total</sub> = ' + fmt(L_total,0) + ' mm</div>');
                st.push('<div class="step">　　ρ<sub>v</sub> = Σ(A<sub>si</sub>·l<sub>i</sub>) / (A<sub>cor</sub>·s) = ' + fmt(rho_v*100, 3) + '%</div>');

                // ④ 最小配箍特征值 λ_v（表 6.3.9）
                // 普通箍 / 复合箍 / 螺旋箍 不同。这里假设复合箍（矩形+拉筋形式）
                // 轴压比 n 对应的 λ_v 表（复合箍，各级抗震）
                // 表中：轴压比 ≤0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 → 对应 λ_v
                // 一级（普通箍）：0.10, 0.11, 0.13, 0.15, 0.17, 0.19, 0.22, 0.24
                // 二级：0.08, 0.09, 0.11, 0.13, 0.15, 0.17, 0.20, 0.22
                // 三级：0.06, 0.07, 0.09, 0.11, 0.13, 0.15, 0.18, 0.20
                var n_steps = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
                var lambda_table = {
                    '1': [0.10, 0.11, 0.13, 0.15, 0.17, 0.19, 0.22, 0.24],
                    '2': [0.08, 0.09, 0.11, 0.13, 0.15, 0.17, 0.20, 0.22],
                    '3': [0.06, 0.07, 0.09, 0.11, 0.13, 0.15, 0.18, 0.20],
                    '4': [0.05, 0.06, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17]
                };
                var lambda_v_req;
                var lambda_arr = lambda_table[level] || lambda_table['2'];
                if (n <= n_steps[0]) lambda_v_req = lambda_arr[0];
                else if (n >= n_steps[n_steps.length - 1]) lambda_v_req = lambda_arr[lambda_arr.length - 1];
                else {
                    // 插值
                    for (var i = 0; i < n_steps.length - 1; i++) {
                        if (n >= n_steps[i] && n <= n_steps[i+1]) {
                            lambda_v_req = lambda_arr[i] + (lambda_arr[i+1] - lambda_arr[i]) * (n - n_steps[i]) / (n_steps[i+1] - n_steps[i]);
                            break;
                        }
                    }
                }
                // 最小体积配箍率 ρ_v,min = λ_v * f_c / f_yv
                var rho_v_min = lambda_v_req * fc / f_yv;
                // 一级 ≥ 0.8%，二级 ≥ 0.6%，三级 ≥ 0.4%，四级 ≥ 0.4%
                var rho_v_min_pct = { '1': 0.008, '2': 0.006, '3': 0.004, '4': 0.004 }[level] || 0.006;
                if (rho_v_min < rho_v_min_pct) rho_v_min = rho_v_min_pct;
                var rhoOk = rho_v >= rho_v_min;

                st.push('<div class="step"><b>④ 最小配箍特征值 λ<sub>v</sub>（表 6.3.9，复合箍）</b></div>');
                st.push('<div class="step">　　轴压比 n = ' + n + '；抗震等级 ' + level + ' 级 ⇒ λ<sub>v</sub> ≈ <b>' + fmt(lambda_v_req, 3) + '</b></div>');
                st.push('<div class="step">　　ρ<sub>v,min</sub> = λ<sub>v</sub>·f<sub>c</sub>/f<sub>yv</sub> = ' + fmt(lambda_v_req,3) + ' × ' + fc + ' / ' + f_yv + ' = ' + fmt(rho_v_min*100,3) + '%（且 ≥ ' + fmt(rho_v_min_pct*100,1) + '%）</div>');
                st.push('<div class="step">　　实配 ρ<sub>v</sub> = ' + fmt(rho_v*100, 3) + '% ≥ ρ<sub>v,min</sub> = ' + fmt(rho_v_min*100, 3) + '% ⇒ ' + (rhoOk ? '满足' + tag('ok','体积配箍满足') : '不满足' + tag('err','体积配箍不足')) + '</div>');

                var allOk = dOk && sOk && rhoOk;
                var html = resultRow('截面 / 抗震等级 / 轴压比', b + '×' + h + ' mm / ' + level + ' 级 / ' + n);
                html += resultRow('加密区长度要求', '≥ ' + fmt(L_req,0) + ' mm（' + (frameV==='short'?'全高加密':(place==='bottom'?'底层下端':'一般层')) + '）');
                html += resultRow('箍筋直径 / 最小直径', d + ' / ' + d_min + ' mm ' + (dOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('箍筋间距 / 最大间距', s + ' / ' + fmt(s_max,0) + ' mm ' + (sOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('体积配箍率 ρ<sub>v</sub>', fmt(rho_v*100,3) + ' / ' + fmt(rho_v_min*100,3) + '% ' + (rhoOk ? tag('ok','满足') : tag('err','不足')) + '（λ<sub>v</sub>=' + fmt(lambda_v_req,3) + '）');
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '柱箍筋加密区各项均满足' : '柱箍筋加密区验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._CT_RESULT = { rho_v: rho_v, rho_v_min: rho_v_min, L_req: L_req, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['ct_b','ct_h','ct_Hn','ct_n','ct_d','ct_legs','ct_legsH','ct_s'].forEach(function (id) {
                    var defs = { ct_b:600, ct_h:600, ct_Hn:3.0, ct_n:0.6, ct_d:10, ct_legs:4, ct_legsH:4, ct_s:100 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('ct_shape').value = 'rect';
                document.getElementById('ct_level').value = '2';
                document.getElementById('ct_place').value = 'middle';
                document.getElementById('ct_frameType').value = 'ordinary';
                document.getElementById('ct_con').value = 'C40';
                document.getElementById('cv_tieSteel').value = 'HRB400';
                calc();
            }
            document.getElementById('ct_calc').addEventListener('click', calc);
            document.getElementById('ct_reset').addEventListener('click', reset);
            document.getElementById('f-ct').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['col-tie'] = tool;
})();
