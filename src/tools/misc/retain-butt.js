/* retain-butt 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '扶壁式挡土墙',
        sub: '整体稳定 + 立壁/趾板/踵板配筋 · GB 50007 / SL 379',
        meta: {"standard": "GB 50007-2011 + SL 379", "formulaSource": "6.6, 6.7", "limitations": "整体稳定+地基验算，立壁/趾板/踵板配筋", "unit": "Ea:kN/m, M:kN·m/m, As:mm²/m", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">挡土墙尺寸</div>' +
                '<form id="f-rb"><div class="grid2">' +
                numField('rb_H', '墙高 H', 'm', 7.0) +
                numField('rb_hw', '立壁厚度 h<sub>w</sub>', 'mm', 300) +
                numField('rb_B', '底板总宽 B', 'm', 4.5) +
                numField('rb_toe', '趾板长 B<sub>1</sub>', 'm', 1.2) +
                numField('rb_hf', '底板厚度 h<sub>f</sub>', 'mm', 500) +
                numField('rb_base', '基础埋深 d', 'm', 1.2) +
                numField('rb_L', '扶壁间距 L', 'm', 3.5, '两道扶壁中到中距离') +
                numField('rb_bt', '扶壁厚度 b<sub>t</sub>', 'mm', 400) +
                numField('rb_top', '墙顶荷载 q', 'kPa', 10) +
                '</div><div class="panel-title" style="margin-top:14px;">土性与地基</div><div class="grid2">' +
                numField('rb_gamma', '填土重度 γ', 'kN/m³', 18.5) +
                numField('rb_phi', '内摩擦角 φ', '°', 32) +
                numField('rb_c', '黏聚力 c', 'kPa', 2) +
                numField('rb_delta', '墙背摩擦角 δ', '°', 15) +
                numField('rb_fa', '地基承载力 f<sub>a</sub>', 'kPa', 220) +
                numField('rb_fmu', '基底摩擦系数 μ', '', 0.4) +
                selField('rb_con', '混凝土等级', conOpts('C30')) +
                selField('rb_steel', '钢筋等级', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('rb_as', '受拉钢筋 a<sub>s</sub>', 'mm', 50) +
                '</div><div class="hint">说明：扶壁式挡土墙整体稳定（抗滑、抗倾覆、地基偏心）与悬臂式相同；立壁按扶壁间双向板/单向板计算；底板按悬臂板或倒 T 形梁验算配筋。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="rb_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="rb_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="rb_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="rb_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('rb_result'), proc = document.getElementById('rb_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var H = parseFloat(document.getElementById('rb_H').value);
                var hw = parseFloat(document.getElementById('rb_hw').value) / 1000; // m
                var B = parseFloat(document.getElementById('rb_B').value);
                var B1 = parseFloat(document.getElementById('rb_toe').value);
                var hf = parseFloat(document.getElementById('rb_hf').value) / 1000;
                var d = parseFloat(document.getElementById('rb_base').value);
                var Lb = parseFloat(document.getElementById('rb_L').value); // 扶壁间距 m
                var bt = parseFloat(document.getElementById('rb_bt').value) / 1000; // m
                var q = parseFloat(document.getElementById('rb_top').value);
                var gamma = parseFloat(document.getElementById('rb_gamma').value);
                var phiDeg = parseFloat(document.getElementById('rb_phi').value);
                var c = parseFloat(document.getElementById('rb_c').value);
                var fa = parseFloat(document.getElementById('rb_fa').value);
                var fmu = parseFloat(document.getElementById('rb_fmu').value);
                var conV = document.getElementById('rb_con').value;
                var steelV = document.getElementById('rb_steel').value;
                var as = parseFloat(document.getElementById('rb_as').value);
                if (!(H > 0 && B > 0)) return err('尺寸必须为正数。');
                var con = CONCRETE[conV];
                var fc = con.fc, ft = con.ft;
                var fy = (steelV === 'HRB400') ? 360 : 435;
                var alpha1 = con.alpha1;
                var st = [];

                var phi = phiDeg * Math.PI / 180;
                var Ka = Math.pow(Math.tan(Math.PI / 4 - phi / 2), 2);
                var B3 = B - B1 - hw; // 踵板长度 m
                if (B3 < 0) B3 = 0;
                var H_total = H + d;

                st.push('<div class="step"><b>① 基本尺寸</b>　墙高 H = ' + H + ' m，埋深 d = ' + d + ' m，总高 = ' + fmt(H_total,2) + ' m</div>');
                st.push('<div class="step">　　底板 B = ' + B + ' m（趾板 ' + B1 + ' m + 立壁 ' + hw + ' m + 踵板 ' + fmt(B3,2) + ' m）；底板厚 h<sub>f</sub> = ' + hf + ' m</div>');
                st.push('<div class="step">　　扶壁间距 L = ' + Lb + ' m；扶壁厚 b<sub>t</sub> = ' + bt + ' m；立壁厚 h<sub>w</sub> = ' + hw + ' m</div>');

                // 每延米土压力（按单位宽度）
                var Ea = 0.5 * gamma * H_total * H_total * Ka + q * H_total * Ka; // kN/m
                var Ea_tri = 0.5 * gamma * H_total * H_total * Ka;
                var Ea_rect = q * H_total * Ka;
                var y_a = (Ea_tri * H_total / 3 + Ea_rect * H_total / 2) / Ea;

                st.push('<div class="step"><b>② 主动土压力</b>　K<sub>a</sub> = tan²(45°−φ/2) = ' + fmt(Ka, 4) + '；E<sub>a</sub> = ' + fmt(Ea,2) + ' kN/m；y<sub>a</sub> = ' + fmt(y_a,3) + ' m（距基底）</div>');

                // 自重（每延米）
                var G_wall = 24 * hw * H; // 立壁自重
                var G_base = 24 * B * hf; // 底板
                var G_butt = 24 * bt * H / 2 / Lb; // 扶壁自重摊到每延米（近似三角形截面）
                var G_soil = gamma * B * d; // 底板上填土（简化）
                var G_total = G_wall + G_base + G_butt + G_soil;

                // 形心距墙趾（近似）
                var x_wall = B1 + hw / 2;
                var x_base = B / 2;
                var x_butt = B1 + hw + bt / 2; // 扶壁靠立壁内侧（踵板侧）
                var x_soil = B / 2;
                var G_x = (G_wall * x_wall + G_base * x_base + G_butt * x_butt + G_soil * x_soil) / G_total;

                st.push('<div class="step"><b>③ 自重与形心</b>　G<sub>total</sub> ≈ ' + fmt(G_total,1) + ' kN/m；形心距墙趾 ≈ ' + fmt(G_x,2) + ' m</div>');

                // 抗滑移
                var Ks = fmu * G_total / Ea;
                var slipOk = Ks >= 1.3;
                st.push('<div class="step"><b>④ 抗滑移验算</b>　K<sub>s</sub> = μG/E<sub>a</sub> = ' + fmt(Ks,2) + ' ≥ 1.3 ⇒ ' + (slipOk ? '满足' + tag('ok','抗滑满足') : '不满足' + tag('err','抗滑不足')) + '</div>');

                // 抗倾覆
                var M_anti = G_total * G_x;
                var M_over = Ea * y_a;
                var Kt = M_anti / M_over;
                var overOk = Kt >= 1.6;
                st.push('<div class="step"><b>⑤ 抗倾覆验算</b>　K<sub>t</sub> = ' + fmt(Kt,2) + ' ≥ 1.6 ⇒ ' + (overOk ? '满足' + tag('ok','抗倾满足') : '不满足' + tag('err','抗倾不足')) + '</div>');

                // 地基
                var M_net = Math.abs(M_over - G_total * (G_x - B / 2));
                var e0 = M_net / G_total;
                var p_max = G_total / B * (1 + 6 * e0 / B);
                var p_min = G_total / B * (1 - 6 * e0 / B);
                var baseOk = p_max <= 1.2 * fa && p_min >= 0;
                if (e0 > B / 6) baseOk = false;
                st.push('<div class="step"><b>⑥ 地基承载力</b>　e = ' + fmt(e0,3) + ' m（B/6 = ' + fmt(B/6,3) + '）；p<sub>max</sub> = ' + fmt(p_max,1) + ' / 1.2f<sub>a</sub> = ' + fmt(1.2*fa,1) + ' kPa ⇒ ' + (baseOk ? '满足' + tag('ok','地基满足') : '不满足' + tag('err','地基不足')) + '</div>');

                // 立壁配筋（按水平方向，扶壁间单向板，上下端支承于扶壁）
                // 取最不利处（墙底）：水/土压力 p_max = γH·Ka，作为均布荷载近似（偏保守）
                var p_max_loc = gamma * H * Ka + q * Ka; // kPa, 墙底处侧压力
                // 扶壁间板，两边支承于扶壁，Lb 为跨度，hw 为板厚
                // 单向板跨中弯矩 M = p * Lb² / 8 （简支）
                var M_vert = p_max_loc * Lb * Lb / 8; // kN·m/m (每米高度)
                var b_w = 1000; // mm (每米高度)
                var h_w = hw * 1000; // mm (板厚 = 截面高度)
                var h0w = h_w - as;
                var a1fc = alpha1 * fc;
                var a_s_val = M_vert * 1e6 / (a1fc * b_w * h0w * h0w);
                var ksi_w = 1 - Math.sqrt(1 - 2 * a_s_val);
                if (a_s_val > 0.5) ksi_w = NaN;
                var As_w = a1fc * b_w * ksi_w * h0w / fy;
                if (isNaN(As_w)) As_w = 99999;
                var rho_w_min = rhoMinFlex(ft, fy).rho;
                var As_w_min = rho_w_min * b_w * h_w;
                var use_w = Math.max(As_w, As_w_min);
                st.push('<div class="step"><b>⑦ 立壁水平配筋（扶壁间单向板）</b>　墙底 p<sub>max</sub> = ' + fmt(p_max_loc,2) + ' kPa；跨度 L = ' + Lb + ' m</div>');
                st.push('<div class="step">　　跨中弯矩 M = pL²/8 = ' + fmt(M_vert,2) + ' kN·m/m（每延米高度）</div>');
                st.push('<div class="step">　　所需 A<sub>s</sub> = ' + fmt(As_w,0) + ' mm²/m；最小 ' + fmt(As_w_min,0) + ' mm²/m；选用 <b>' + fmt(use_w,0) + ' mm²/m</b></div>');

                // 趾板配筋（悬臂板，地基反力 p_max 作为荷载）
                var M_toe = p_max * B1 * B1 / 2; // kN·m/m, 悬臂固端弯矩
                var h_toe = hf * 1000; // mm
                var h0t = h_toe - as;
                var a_st = M_toe * 1e6 / (a1fc * b_w * h0t * h0t);
                var ksi_t = 1 - Math.sqrt(1 - 2 * a_st);
                if (a_st > 0.5) ksi_t = NaN;
                var As_t = a1fc * b_w * ksi_t * h0t / fy;
                if (isNaN(As_t)) As_t = 99999;
                var use_t = Math.max(As_t, rho_w_min * b_w * h_toe);
                st.push('<div class="step"><b>⑧ 趾板配筋（悬臂板）</b>　悬臂长 B<sub>1</sub> = ' + B1 + ' m；板厚 h = ' + h_toe + ' mm</div>');
                st.push('<div class="step">　　固端弯矩 M = p<sub>max</sub>·B<sub>1</sub>²/2 = ' + fmt(M_toe,2) + ' kN·m/m</div>');
                st.push('<div class="step">　　所需 A<sub>s</sub> = ' + fmt(As_t,0) + ' mm²/m；选用 <b>' + fmt(use_t,0) + ' mm²/m</b></div>');

                // 踵板配筋（悬臂+上部土重+水重，底部受拉）
                var q_heel = gamma * H + 24 * hf; // 踵板上总竖向荷载（土重+底板自重） kPa
                var M_heel = q_heel * B3 * B3 / 2 - p_min * B3 * B3 / 2; // 净弯矩（上部荷载 - 地基反力）
                if (M_heel < 0) M_heel = Math.abs(M_heel); // 取绝对值，表示上部荷载控制还是地基反力控制
                // 简化：取上部荷载产生的正弯矩（上部受拉/下部受拉由荷载方向决定）
                var a_sh = M_heel * 1e6 / (a1fc * b_w * h0t * h0t);
                var ksi_h = 1 - Math.sqrt(1 - 2 * a_sh);
                if (a_sh > 0.5) ksi_h = NaN;
                var As_h = a1fc * b_w * ksi_h * h0t / fy;
                if (isNaN(As_h)) As_h = 99999;
                var use_h = Math.max(As_h, rho_w_min * b_w * h_toe);
                st.push('<div class="step"><b>⑨ 踵板配筋</b>　踵板长 B<sub>3</sub> = ' + fmt(B3,2) + ' m；上部均布荷载 ≈ ' + fmt(q_heel,1) + ' kPa</div>');
                st.push('<div class="step">　　固端弯矩 M ≈ ' + fmt(M_heel,2) + ' kN·m/m；所需 A<sub>s</sub> = ' + fmt(As_h,0) + ' mm²/m；选用 <b>' + fmt(use_h,0) + ' mm²/m</b></div>');

                var allOk = slipOk && overOk && baseOk;
                var html = resultRow('墙高 / 埋深 / 扶壁间距', H + ' / ' + d + ' / ' + Lb + ' m');
                html += resultRow('主动土压力 E<sub>a</sub>', fmt(Ea,2) + ' kN/m（K<sub>a</sub> = ' + fmt(Ka,4) + '）');
                html += resultRow('抗滑移 / 抗倾覆', fmt(Ks,2) + ' / 1.3' + (slipOk?tag('ok',''):tag('err','')) + ' 　' + fmt(Kt,2) + ' / 1.6' + (overOk?tag('ok',''):tag('err','')));
                html += resultRow('地基 p<sub>max</sub> / 1.2f<sub>a</sub>', fmt(p_max,1) + ' / ' + fmt(1.2*fa,1) + ' kPa ' + (baseOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('立壁水平筋', fmt(use_w,0) + ' mm²/m（扶壁间板）');
                html += resultRow('趾板 / 踵板配筋', fmt(use_t,0) + ' / ' + fmt(use_h,0) + ' mm²/m');
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '扶壁式挡土墙整体满足' : '挡土墙验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._RB_RESULT = { Ea: Ea, Ks: Ks, Kt: Kt, p_max: p_max, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['rb_H','rb_hw','rb_B','rb_toe','rb_hf','rb_base','rb_L','rb_bt','rb_top','rb_gamma','rb_phi','rb_c','rb_delta','rb_fa','rb_fmu','rb_as'].forEach(function (id) {
                    var defs = { rb_H:7.0, rb_hw:300, rb_B:4.5, rb_toe:1.2, rb_hf:500, rb_base:1.2, rb_L:3.5, rb_bt:400, rb_top:10, rb_gamma:18.5, rb_phi:32, rb_c:2, rb_delta:15, rb_fa:220, rb_fmu:0.4, rb_as:50 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('rb_con').value = 'C30';
                document.getElementById('rb_steel').value = 'HRB400';
                calc();
            }
            document.getElementById('rb_calc').addEventListener('click', calc);
            document.getElementById('rb_reset').addEventListener('click', reset);
            document.getElementById('f-rb').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['retain-butt'] = tool;
})();
