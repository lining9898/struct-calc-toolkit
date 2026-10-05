/* wind-snow 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '风荷载与雪荷载',
        sub: 'w_k = β_z·μ_s·μ_z·w_0 · s_k = μ_r·s_0 · GB 50009-2012',
        meta: {"standard": "GB 50009-2012 建筑结构荷载规范", "formulaSource": "8.1, 7.1", "limitations": "wk=βz·μs·μz·w0，sk=μr·s0", "unit": "wk:kN/m², sk:kN/m², μz,μs:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">风荷载计算</div>' +
                '<form id="f-ws"><div class="grid2">' +
                numField('ws_w0', '基本风压 w<sub>0</sub>', 'kN/m²', 0.55, '按 50 年一遇，全国基本风压分布图') +
                selField('ws_rough', '地面粗糙度类别', opts([
                    { v: 'A', t: 'A 类（近海海面、沙漠）' },
                    { v: 'B', t: 'B 类（田野、乡村、丘陵）' },
                    { v: 'C', t: 'C 类（密集建筑群城镇）' },
                    { v: 'D', t: 'D 类（密集建筑群且房屋较高城市）' }
                ], 'B')) +
                numField('ws_z', '计算高度 z', 'm', 30) +
                numField('ws_mus', '风荷载体型系数 μ<sub>s</sub>', '', 1.3, '整体计算取 1.3，局部风荷载体型按表 8.3.1') +
                numField('ws_beta', '风振系数 β<sub>z</sub>', '', 1.5, '高度 >30m 且高宽比 >1.5 的房屋需考虑；一般 1.2~2.0') +
                selField('ws_calcMz', '是否计算风弯矩', opts([{ v: 'no', t: '仅算风荷载标准值' }, { v: 'yes', t: '同时算底部风弯矩（H 高）' }], 'no')) +
                numField('ws_B', '迎风面宽度 B', 'm', 20, '仅算弯矩时需要') +
                numField('ws_H', '房屋总高度 H', 'm', 30, '仅算弯矩时需要') +
                '</div><div class="panel-title" style="margin-top:14px;">雪荷载计算</div><div class="grid2">' +
                numField('ws_s0', '基本雪压 s<sub>0</sub>', 'kN/m²', 0.40, '按 50 年一遇') +
                selField('ws_roof', '屋面形式', opts([
                    { v: 'flat', t: '平屋面（坡度 ≤ 25°）' },
                    { v: 'slope_30', t: '单坡屋面 30°' },
                    { v: 'slope_45', t: '单坡屋面 45°' },
                    { v: 'gable_low', t: '双坡屋面 α ≤ 25°（均匀分布）' },
                    { v: 'gable_high', t: '双坡屋面 α > 25°（不均匀分布）' },
                    { v: 'arch', t: '拱形屋面' },
                    { v: 'skylight', t: '带天窗屋面' }
                ], 'flat')) +
                numField('ws_mur', '屋面积雪分布系数 μ<sub>r</sub>', '', 1.0, '可根据表 7.2.1 选择，或自动填入') +
                numField('ws_A', '屋面投影面积 A', 'm²', 100, '总雪荷载计算') +
                '</div><div class="hint">说明：按 GB 50009-2012《建筑结构荷载规范》第 8 章（风）和第 7 章（雪）计算标准值。风压高度变化系数 μ<sub>z</sub>按粗糙度类别与高度查表内插。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ws_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ws_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ws_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ws_proc"></div></div></div></div>';
        },
        bind: function () {
            function muzTable(rough, z) {
                // GB 50009-2012 表 8.2.1 风压高度变化系数 μ_z
                // 高度点：5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 350, 400
                var zs = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 350, 400];
                var vals = {
                    'A': [1.09, 1.28, 1.42, 1.52, 1.67, 1.79, 1.89, 1.97, 2.05, 2.12, 2.18, 2.23, 2.46, 2.64, 2.78, 2.91, 3.02, 3.12],
                    'B': [1.00, 1.00, 1.14, 1.25, 1.42, 1.56, 1.67, 1.77, 1.86, 1.95, 2.02, 2.09, 2.38, 2.61, 2.80, 2.97, 3.12, 3.26],
                    'C': [0.65, 0.65, 0.65, 0.74, 0.88, 1.00, 1.10, 1.20, 1.28, 1.36, 1.43, 1.50, 1.79, 2.04, 2.26, 2.46, 2.64, 2.80],
                    'D': [0.51, 0.51, 0.51, 0.51, 0.51, 0.60, 0.69, 0.77, 0.84, 0.91, 0.98, 1.04, 1.33, 1.58, 1.81, 2.02, 2.22, 2.40]
                };
                var arr = vals[rough] || vals['B'];
                if (z <= zs[0]) return arr[0];
                if (z >= zs[zs.length - 1]) return arr[arr.length - 1];
                for (var i = 0; i < zs.length - 1; i++) {
                    if (z >= zs[i] && z <= zs[i + 1]) {
                        return arr[i] + (arr[i + 1] - arr[i]) * (z - zs[i]) / (zs[i + 1] - zs[i]);
                    }
                }
                return 1.0;
            }
            function murFromRoof(roofType) {
                // GB 50009 表 7.2.1 屋面积雪分布系数（代表性取值）
                switch (roofType) {
                    case 'flat': return 1.0;
                    case 'slope_30': return 0.8;
                    case 'slope_45': return 0.4;
                    case 'gable_low': return 1.0; // 均匀
                    case 'gable_high': return 1.5; // 不均匀最不利
                    case 'arch': return 1.2; // 拱形最不利
                    case 'skylight': return 1.1;
                    default: return 1.0;
                }
            }
            function calc() {
                var out = document.getElementById('ws_result'), proc = document.getElementById('ws_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var w0 = parseFloat(document.getElementById('ws_w0').value);
                var rough = document.getElementById('ws_rough').value;
                var z = parseFloat(document.getElementById('ws_z').value);
                var mus = parseFloat(document.getElementById('ws_mus').value);
                var beta = parseFloat(document.getElementById('ws_beta').value);
                var calcM = document.getElementById('ws_calcMz').value === 'yes';
                var B = parseFloat(document.getElementById('ws_B').value);
                var H = parseFloat(document.getElementById('ws_H').value);
                var s0 = parseFloat(document.getElementById('ws_s0').value);
                var roofType = document.getElementById('ws_roof').value;
                var mur = parseFloat(document.getElementById('ws_mur').value);
                var A = parseFloat(document.getElementById('ws_A').value);
                if (!(w0 > 0 && z > 0)) return err('基本风压与计算高度必须为正数。');
                var st = [];

                // 一、风荷载
                var muz = muzTable(rough, z);
                var wk = beta * mus * muz * w0; // kN/m² = kPa
                st.push('<div class="step"><b>一、风荷载标准值 w<sub>k</sub> = β<sub>z</sub>·μ<sub>s</sub>·μ<sub>z</sub>·w<sub>0</sub>（GB 50009 式 8.1.1-1）</b></div>');
                st.push('<div class="step">　　基本风压 w<sub>0</sub> = ' + w0 + ' kN/m²（50 年一遇）</div>');
                st.push('<div class="step">　　地面粗糙度 ' + rough + ' 类，z = ' + z + ' m ⇒ μ<sub>z</sub> ≈ <b>' + fmt(muz, 3) + '</b>（表 8.2.1 内插）</div>');
                st.push('<div class="step">　　体型系数 μ<sub>s</sub> = ' + mus + '；风振系数 β<sub>z</sub> = ' + beta + '</div>');
                st.push('<div class="step">　　w<sub>k</sub> = ' + beta + ' × ' + mus + ' × ' + fmt(muz,3) + ' × ' + w0 + ' = <b>' + fmt(wk, 3) + ' kN/m²</b></div>');

                var M_base = 0, F_total = 0;
                if (calcM) {
                    // 简化：风荷载沿高度呈倒三角形分布（近似），底部弯矩 M = qk * H * H / 3 * B
                    // 更准确：用 μ_z 沿高度分布。此处简化为等效均布（用 z=H/2 处的 μz）
                    var muz_avg = muzTable(rough, H / 2);
                    var qk_avg = beta * mus * muz_avg * w0; // 平均线荷载 kN/m²
                    var q_total = qk_avg * B; // 总线荷载 kN/m（沿高度）
                    M_base = q_total * H * H / 2; // 底部总弯矩 kN·m，均布？倒三角？
                    // 简化：假设倒三角（顶部大，底部为 0）不准确
                    // 实际上风荷载随高度增加，近似用 q_max 取顶部值来算倒三角
                    var q_max = wk * B; // 顶部线荷载 kN/m
                    F_total = 0.5 * q_max * H; // 总剪力 kN（倒三角）
                    M_base = F_total * H * 2 / 3; // 底部弯矩 kN·m（倒三角合力作用点距底 2H/3）
                    st.push('<div class="step">　　<span class="sub-title">底部风荷载效应（简化倒三角分布）：</span></div>');
                    st.push('<div class="step">　　顶部线荷载 q<sub>max</sub> = w<sub>k</sub>·B = ' + fmt(wk,3) + ' × ' + B + ' = ' + fmt(q_max,2) + ' kN/m</div>');
                    st.push('<div class="step">　　总剪力 F<sub>total</sub> = ½·q<sub>max</sub>·H = <b>' + fmt(F_total, 1) + ' kN</b></div>');
                    st.push('<div class="step">　　底部总弯矩 M<sub>base</sub> = ⅔·H·F<sub>total</sub> = <b>' + fmt(M_base, 1) + ' kN·m</b>（合力距底 2H/3）</div>');
                }

                // 二、雪荷载
                if (mur <= 0) mur = murFromRoof(roofType);
                var sk = mur * s0; // kN/m²
                var S_total = sk * A; // kN
                st.push('<div class="step"><b>二、雪荷载标准值 s<sub>k</sub> = μ<sub>r</sub>·s<sub>0</sub>（GB 50009 式 7.1.1）</b></div>');
                st.push('<div class="step">　　基本雪压 s<sub>0</sub> = ' + s0 + ' kN/m²（50 年一遇）</div>');
                st.push('<div class="step">　　屋面形式：' + roofType + '；积雪分布系数 μ<sub>r</sub> = <b>' + fmt(mur, 2) + '</b>（表 7.2.1）</div>');
                st.push('<div class="step">　　s<sub>k</sub> = ' + fmt(mur,2) + ' × ' + s0 + ' = <b>' + fmt(sk, 3) + ' kN/m²</b></div>');
                if (A > 0) {
                    st.push('<div class="step">　　屋面投影面积 A = ' + A + ' m²；总雪荷载 S<sub>k,total</sub> = ' + fmt(S_total, 1) + ' kN</div>');
                }

                var html = resultRow('风荷载标准值 w<sub>k</sub>', fmt(wk, 3) + ' kN/m²（z = ' + z + ' m，' + rough + ' 类）');
                html += resultRow('μ<sub>z</sub> / μ<sub>s</sub> / β<sub>z</sub>', fmt(muz,3) + ' / ' + mus + ' / ' + beta);
                if (calcM) {
                    html += resultRow('总风剪力 F<sub>k</sub>', fmt(F_total, 1) + ' kN（倒三角分布）');
                    html += resultRow('底部风弯矩 M<sub>k</sub>', fmt(M_base, 1) + ' kN·m');
                }
                html += resultRow('雪荷载标准值 s<sub>k</sub>', fmt(sk, 3) + ' kN/m²（μ<sub>r</sub> = ' + fmt(mur,2) + '）');
                if (A > 0) html += resultRow('总雪荷载 S<sub>k,total</sub>', fmt(S_total, 1) + ' kN（A = ' + A + ' m²）');
                html += resultRow('基本风压 / 基本雪压', w0 + ' / ' + s0 + ' kN/m²（50 年一遇）');
                html += resultRow('依据规范', badge('badge-ok', 'GB 50009-2012《建筑结构荷载规范》'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._WS_RESULT = { wk: wk, sk: sk, muz: muz, steps: st.join('') };
            }
            function reset() {
                ['ws_w0','ws_z','ws_mus','ws_beta','ws_B','ws_H','ws_s0','ws_mur','ws_A'].forEach(function (id) {
                    var defs = { ws_w0:0.55, ws_z:30, ws_mus:1.3, ws_beta:1.5, ws_B:20, ws_H:30, ws_s0:0.40, ws_mur:1.0, ws_A:100 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('ws_rough').value = 'B';
                document.getElementById('ws_calcMz').value = 'no';
                document.getElementById('ws_roof').value = 'flat';
                calc();
            }
            document.getElementById('ws_calc').addEventListener('click', calc);
            document.getElementById('ws_reset').addEventListener('click', reset);
            document.getElementById('ws_roof').addEventListener('change', function () {
                var r = document.getElementById('ws_roof').value;
                document.getElementById('ws_mur').value = murFromRoof(r);
            });
            document.getElementById('f-ws').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['wind-snow'] = tool;
})();
