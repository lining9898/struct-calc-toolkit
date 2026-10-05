/* pool-rect 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '矩形水池计算',
        sub: '池壁水/土压力 · 单向板弯矩 · 配筋与裂缝 · GB 50069-2002',
        meta: {"standard": "GB 50069-2002 + CECS 138", "formulaSource": "—", "limitations": "矩形水池池壁，跨中/支座弯矩+配筋+抗裂", "unit": "M:kN·m/m, As:mm²/m, αct:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">水池尺寸与构造</div>' +
                '<form id="f-pr"><div class="grid2">' +
                numField('pr_L', '水池长度 L', 'm', 6.0, '矩形水池长向尺寸') +
                numField('pr_B', '水池宽度 B', 'm', 4.0, '矩形水池短向尺寸') +
                numField('pr_H', '水池高度 H', 'm', 3.5, '池壁总高度') +
                numField('pr_h', '池壁厚度 h', 'mm', 250) +
                numField('pr_hw', '池内设计水深 h<sub>w</sub>', 'm', 3.2, '通常比池高小 0.2~0.3 m') +
                selField('pr_top', '池壁顶部约束', opts([
                    { v: 'free', t: '自由（敞口水池）' },
                    { v: 'cover', t: '有顶盖（铰接）' }
                ], 'free')) +
                selField('pr_bot', '池壁底部约束', opts([
                    { v: 'fix', t: '与底板整浇（嵌固）' },
                    { v: 'hinge', t: '铰接（柔性连接）' }
                ], 'fix')) +
                selField('pr_dir', '计算方向', opts([
                    { v: 'L', t: '长向池壁（L 面，高度 H × 长度 L）' },
                    { v: 'B', t: '短向池壁（B 面，高度 H × 宽度 B）' }
                ], 'B')) +
                numField('pr_soilTop', '池外填土高度', 'm', 0, '池外侧地下水位以上填土高度；0 表示无外侧土压') +
                numField('pr_gamma', '土重度 γ', 'kN/m³', 18) +
                numField('pr_phi', '内摩擦角 φ', '°', 30) +
                selField('pr_con', '混凝土等级', conOpts('C30')) +
                selField('pr_steel', '钢筋等级', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('pr_as', '受拉钢筋 a<sub>s</sub>', 'mm', 35) +
                '</div><div class="hint">说明：按单位宽度 1 m 池壁条带，计算水压力（三角形分布，底部最大）和土压力作用下的跨中与支座弯矩；按单向板（上下支承）配筋，验算裂缝宽度。双向板效应此处忽略（偏安全）。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="pr_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="pr_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="pr_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="pr_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('pr_result'), proc = document.getElementById('pr_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var L = parseFloat(document.getElementById('pr_L').value);
                var B = parseFloat(document.getElementById('pr_B').value);
                var H = parseFloat(document.getElementById('pr_H').value);
                var h = parseFloat(document.getElementById('pr_h').value);
                var hw = parseFloat(document.getElementById('pr_hw').value);
                var topV = document.getElementById('pr_top').value;
                var botV = document.getElementById('pr_bot').value;
                var dirV = document.getElementById('pr_dir').value;
                var soilH = parseFloat(document.getElementById('pr_soilTop').value);
                var gamma = parseFloat(document.getElementById('pr_gamma').value);
                var phiDeg = parseFloat(document.getElementById('pr_phi').value);
                var conV = document.getElementById('pr_con').value;
                var steelV = document.getElementById('pr_steel').value;
                var as = parseFloat(document.getElementById('pr_as').value);
                if (!(L > 0 && B > 0 && H > 0 && h > 0)) return err('尺寸必须为正数。');
                if (hw > H) hw = H;
                var con = CONCRETE[conV];
                var fc = con.fc, ft = con.ft, ftk = con.ftk;
                var fy = (steelV === 'HRB400') ? 360 : 435;
                var alpha1 = con.alpha1;
                var Es = 200000;
                var st = [];

                // 计算方向的池壁长度（用于判断单向板/双向板，但此处按单向简化）
                var Lwall = (dirV === 'L') ? L : B;
                var gamma_w = 10; // kN/m³
                var phi = phiDeg * Math.PI / 180;
                var Ka = Math.pow(Math.tan(Math.PI / 4 - phi / 2), 2);

                st.push('<div class="step"><b>① 基本参数</b>　水池 ' + L + '×' + B + '×' + H + ' m；池壁厚 ' + h + ' mm；水深 ' + hw + ' m</div>');
                st.push('<div class="step">　　混凝土 ' + conV + '（f<sub>c</sub>=' + fc + ', f<sub>t</sub>=' + ft + ' MPa）；钢筋 ' + steelV + '（f<sub>y</sub>=' + fy + ' MPa）</div>');

                // 水压力分布（三角形，底部最大 γw·hw）
                var p_w_bot = gamma_w * hw; // kPa
                // 土压力分布（如有）：三角形+矩形
                var p_soil_bot = 0;
                var p_soil_top = 0;
                if (soilH > 0) {
                    p_soil_top = 0; // 顶部 0
                    p_soil_bot = gamma * soilH * Ka; // kPa
                }
                st.push('<div class="step"><b>② 侧压力分布</b>　水压力：底部 = γ<sub>w</sub>·h<sub>w</sub> = 10 × ' + hw + ' = <b>' + p_w_bot + ' kPa</b>（三角形分布）</div>');
                if (soilH > 0) {
                    st.push('<div class="step">　　土压力：底部 = γ·H·K<sub>a</sub> = ' + gamma + ' × ' + soilH + ' × ' + fmt(Ka,3) + ' = ' + fmt(p_soil_bot, 2) + ' kPa</div>');
                }

                // 组合侧压力（内侧水压力 + 外侧土压力，两者同时作用时叠加）
                // 简化：以内侧水压力为主（最不利情况：水池满水，外侧无土压力）
                // 另验算外侧有土 + 池内无水的工况（空池 + 回填土）
                var M_inner_max = 0, M_inner_bot = 0, M_inner_top = 0;
                var M_outer_max = 0, M_outer_bot = 0, M_outer_top = 0;

                function calcWall(loadType, topCon, botCon, pTop, pBot) {
                    // 悬臂墙（上自由下固定）或简支墙的内力计算
                    // 返回 { M_top, M_bot, M_max, V_bot }
                    var Hv = H; // m
                    if (topCon === 'free' && botCon === 'fix') {
                        // 悬臂墙，荷载向内侧/外侧
                        // 三角形分布（自由端 0，固定端 pBot）：M_bot = pBot * H³ / 6
                        // 梯形分布（顶部 pTop，底部 pBot）：M_bot = ∫0^H p(z)*(H-z) dz = ∫ (pTop + (pBot-pTop)*z/H) * (H-z) dz
                        var M = pTop * H * H / 2 + (pBot - pTop) * H * H / 6; // kN·m/m
                        return { M_top: 0, M_bot: M, M_max: M, V_bot: (pTop + pBot) / 2 * H };
                    } else if (topCon === 'cover' && botCon === 'fix') {
                        // 上端铰支、下端嵌固（有顶盖水池）
                        // 梯形荷载，简化为均布 + 三角形组合，用近似系数
                        // 均布 q：M_bot = qH²/8, M_mid = 9qH²/128, R_top = 3qH/8
                        // 三角形（上端0下端q）：M_bot ≈ qH²/15, M_mid ≈ 0.03qH²
                        var q0 = pTop;
                        var q1 = pBot - pTop;
                        var M_b = q0 * H * H / 8 + 0.0667 * q1 * H * H;
                        var M_m = 9 * q0 * H * H / 128 + 0.03 * q1 * H * H;
                        return { M_top: 0, M_bot: M_b, M_max: Math.max(M_b, M_m), V_bot: 0 };
                    } else {
                        // 两端铰接：梯形荷载
                        var q0 = pTop, q1 = pBot - pTop;
                        var M_mid = q0 * H * H / 8 + q1 * H * H / 16;
                        return { M_top: 0, M_bot: 0, M_max: M_mid, V_bot: 0 };
                    }
                }

                // 工况一：内水压力（池内侧受荷，壁外侧受拉）
                var r1 = calcWall('water', topV, botV, 0, p_w_bot);
                M_inner_max = r1.M_max;
                M_inner_bot = r1.M_bot;
                M_inner_top = r1.M_top;
                st.push('<div class="step"><b>③ 工况一：内水压力（池内侧受荷）</b>　顶部 = ' + topV + '，底部 = ' + botV + '</div>');
                st.push('<div class="step">　　底部支座弯矩 M<sub>bot</sub> = ' + fmt(M_inner_bot, 2) + ' kN·m/m；最大弯矩 = <b>' + fmt(M_inner_max, 2) + ' kN·m/m</b>（外侧受拉）</div>');

                // 工况二：外侧土压力 + 池内无水（空池）
                if (soilH > 0) {
                    var r2 = calcWall('soil', topV, botV, p_soil_top, p_soil_bot);
                    M_outer_max = r2.M_max;
                    M_outer_bot = r2.M_bot;
                    st.push('<div class="step"><b>④ 工况二：外侧土压力（空池+回填）</b></div>');
                    st.push('<div class="step">　　底部支座弯矩 M<sub>bot</sub> = ' + fmt(M_outer_bot, 2) + ' kN·m/m；最大弯矩 = ' + fmt(M_outer_max, 2) + ' kN·m/m（内侧受拉）</div>');
                }

                // 取控制弯矩（外侧受拉最大）
                var M_ctrl = Math.max(M_inner_max, M_outer_max);
                var b = 1000; // mm
                var h0 = h - as; // mm

                // 受弯配筋（单筋矩形）
                var a1fc = alpha1 * fc;
                var alpha_s = M_ctrl * 1e6 / (a1fc * b * h0 * h0);
                var ksi = 1 - Math.sqrt(1 - 2 * alpha_s);
                var x = ksi * h0;
                var As_req = a1fc * b * x / fy; // mm²/m
                if (isNaN(As_req) || As_req < 0) As_req = 0;
                var rho_min = rhoMinFlex(ft, fy).rho;
                var As_min = rho_min * b * h;
                var useAs = Math.max(As_req, As_min);
                var rho = useAs / (b * h0);

                st.push('<div class="step"><b>⑤ 受弯配筋（控制 M = ' + fmt(M_ctrl,2) + ' kN·m/m）</b></div>');
                st.push('<div class="step">　　h<sub>0</sub> = ' + h0 + ' mm；α<sub>s</sub> = ' + fmt(alpha_s, 4) + '；ξ = ' + fmt(ksi, 4) + '</div>');
                st.push('<div class="step">　　A<sub>s,req</sub> = <b>' + fmt(As_req, 0) + ' mm²/m</b>；最小配筋 A<sub>s,min</sub> = ' + fmt(As_min, 0) + ' mm²/m（ρ<sub>min</sub>=' + fmt(rho_min*100,3) + '%）</div>');
                st.push('<div class="step">　　选用 A<sub>s</sub> = ' + fmt(useAs, 0) + ' mm²/m，配筋率 ρ = ' + fmt(rho*100, 3) + '%</div>');

                // 裂缝宽度
                var M_q = M_ctrl * 0.55; // 准永久组合近似（水荷载为准永久）
                var sigma_sq = M_q * 1e6 / (useAs * (h0 - x / 2));
                var d_eq = 16; // 假设直径
                var cs = as - d_eq / 2;
                var rho_te = useAs / (0.5 * b * h);
                if (rho_te < 0.01) rho_te = 0.01;
                var psi = 1.1 - 0.65 * ftk / (rho_te * sigma_sq);
                if (psi > 1.0) psi = 1.0; if (psi < 0.2) psi = 0.2;
                var w_max = 1.9 * psi * sigma_sq / Es * (1.9 * cs + 0.08 * d_eq / rho_te);
                var w_lim = 0.2; // 水池类 0.2 mm
                var crackOk = w_max <= w_lim;
                st.push('<div class="step"><b>⑥ 裂缝宽度验算</b>　M<sub>q</sub> ≈ ' + fmt(M_q,2) + ' kN·m/m；σ<sub>sq</sub> = ' + fmt(sigma_sq,1) + ' MPa；ψ = ' + fmt(psi,3) + '</div>');
                st.push('<div class="step">　　w<sub>max</sub> = <b>' + fmt(w_max, 3) + ' mm</b> ≤ ' + w_lim + ' mm ⇒ ' + (crackOk ? '满足' + tag('ok','裂缝满足') : '不满足' + tag('err','裂缝超限')) + '</div>');

                var html = resultRow('水池尺寸 / 池壁厚', L + '×' + B + '×' + H + ' m / ' + h + ' mm');
                html += resultRow('控制方向 / 水深', (dirV==='L'?'长向':'短向') + '池壁 / ' + hw + ' m');
                html += resultRow('水压力底部最大值', p_w_bot + ' kPa（三角形分布）');
                html += resultRow('底部支座弯矩 M<sub>bot</sub>', fmt(M_inner_bot, 2) + ' kN·m/m（内水压）' + (soilH>0?' / '+fmt(M_outer_bot,2)+'（土压）':''));
                html += resultRow('最大正弯矩 M<sub>max</sub>', fmt(M_inner_max, 2) + ' kN·m/m');
                html += resultRow('所需受拉钢筋 A<sub>s</sub>', fmt(useAs, 0) + ' mm²/m（ρ = ' + fmt(rho*100, 3) + '%）');
                html += resultRow('裂缝宽度 w<sub>max</sub>', fmt(w_max, 3) + ' / ' + w_lim + ' mm ' + (crackOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('综合判定', badge(crackOk ? 'badge-ok' : 'badge-err', crackOk ? '池壁配筋与裂缝均满足' : '池壁验算不满足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._PR_RESULT = { M_ctrl: M_ctrl, As: useAs, w_max: w_max, steps: st.join('') };
            }
            function reset() {
                ['pr_L','pr_B','pr_H','pr_h','pr_hw','pr_soilTop','pr_gamma','pr_phi','pr_as'].forEach(function (id) {
                    var defs = { pr_L:6.0, pr_B:4.0, pr_H:3.5, pr_h:250, pr_hw:3.2, pr_soilTop:0, pr_gamma:18, pr_phi:30, pr_as:35 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('pr_top').value = 'free';
                document.getElementById('pr_bot').value = 'fix';
                document.getElementById('pr_dir').value = 'B';
                document.getElementById('pr_con').value = 'C30';
                document.getElementById('pr_steel').value = 'HRB400';
                calc();
            }
            document.getElementById('pr_calc').addEventListener('click', calc);
            document.getElementById('pr_reset').addEventListener('click', reset);
            document.getElementById('f-pr').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pool-rect'] = tool;
})();
