/* pool-circ 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '圆形水池计算',
        sub: '池壁环向拉力 · 竖向弯矩 · 配筋与裂缝 · GB 50069-2002',
        meta: {"standard": "GB 50069-2002 + CECS 138", "formulaSource": "—", "limitations": "圆形池壁，环向拉力+竖向弯矩+抗裂", "unit": "N:kN/m, M:kN·m/m, As:mm²/m", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">水池尺寸与参数</div>' +
                '<form id="f-pc"><div class="grid2">' +
                numField('pc_D', '水池内径 D', 'm', 8.0) +
                numField('pc_H', '池壁高度 H', 'm', 4.0) +
                numField('pc_h', '池壁厚度 h', 'mm', 250) +
                numField('pc_hw', '设计水深 h<sub>w</sub>', 'm', 3.8) +
                selField('pc_bot', '底部约束', opts([
                    { v: 'fix', t: '与底板整浇（嵌固）' },
                    { v: 'hinge', t: '铰接' }
                ], 'fix')) +
                selField('pc_top', '顶部约束', opts([
                    { v: 'free', t: '自由（敞口）' },
                    { v: 'ring', t: '有顶环梁（弹性约束）' }
                ], 'free')) +
                numField('pc_gammaW', '水重度 γ<sub>w</sub>', 'kN/m³', 10) +
                selField('pc_con', '混凝土等级', conOpts('C30')) +
                selField('pc_steel', '钢筋等级', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('pc_as_h', '环向钢筋 a<sub>s</sub>', 'mm', 35, '内侧受拉钢筋合力点距离') +
                numField('pc_as_v', '竖向钢筋 a<sub>s</sub>', 'mm', 40) +
                '</div><div class="hint">说明：圆形水池池壁按轴对称水压力（径向向内）作用，用圆柱壳薄膜理论计算环向拉力；竖向弯矩按支承条件用梁模型近似。底部最大弯矩出现在嵌固端处。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="pc_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="pc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="pc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="pc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('pc_result'), proc = document.getElementById('pc_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var D = parseFloat(document.getElementById('pc_D').value); // m, 内径
                var H = parseFloat(document.getElementById('pc_H').value); // m
                var h = parseFloat(document.getElementById('pc_h').value); // mm
                var hw = parseFloat(document.getElementById('pc_hw').value); // m
                var botV = document.getElementById('pc_bot').value;
                var topV = document.getElementById('pc_top').value;
                var gammaW = parseFloat(document.getElementById('pc_gammaW').value);
                var conV = document.getElementById('pc_con').value;
                var steelV = document.getElementById('pc_steel').value;
                var asH = parseFloat(document.getElementById('pc_as_h').value); // 环向
                var asV = parseFloat(document.getElementById('pc_as_v').value); // 竖向
                if (!(D > 0 && H > 0 && h > 0)) return err('尺寸必须为正数。');
                if (hw > H) hw = H;
                var con = CONCRETE[conV];
                var fc = con.fc, ft = con.ft, ftk = con.ftk;
                var fy = (steelV === 'HRB400') ? 360 : 435;
                var alpha1 = con.alpha1;
                var Es = 200000;
                var st = [];
                var R = D / 2; // m, 内半径

                st.push('<div class="step"><b>① 基本参数</b>　内径 D = ' + D + ' m（R = ' + R + ' m）；池高 H = ' + H + ' m；壁厚 h = ' + h + ' mm；水深 h<sub>w</sub> = ' + hw + ' m</div>');
                st.push('<div class="step">　　混凝土 ' + conV + '；钢筋 ' + steelV + '；底部 ' + (botV==='fix'?'嵌固':'铰接') + '，顶部 ' + (topV==='free'?'自由':'弹性约束') + '</div>');

                // 环向拉力（薄膜理论）
                // 在深度 z 处（z=0 为水面），水压 p(z) = γw * z
                // 单位高度环拉力 N_θ = p(z) * R (kN/m)
                // 这是薄壁圆筒的薄膜解，适用于两端自由或约束很弱的情况
                // 实际上端部有弯矩会影响环拉力，但工程上常用此近似
                // 最大环向拉力在底部 z = hw 处：N_θ_max = γw * hw * R
                var N_theta_max = gammaW * hw * R; // kN/m (每米高度)
                // 验算：若底部嵌固，环拉力最大值可能略有降低（因底部径向位移受约束）
                // 但工程上一般按薄膜理论设计，是保守的做法
                st.push('<div class="step"><b>② 环向拉力（薄膜理论近似）</b>　p(z) = γ<sub>w</sub>·z · N<sub>θ</sub> = p·R</div>');
                st.push('<div class="step">　　底部最大 N<sub>θ,max</sub> = γ<sub>w</sub>·h<sub>w</sub>·R = ' + gammaW + ' × ' + hw + ' × ' + R + ' = <b>' + fmt(N_theta_max, 2) + ' kN/m</b>（内壁受拉）</div>');

                // 环向配筋（受拉，近似按轴心受拉构件）
                // As_req = N_theta / fy (mm²/m), 注意是双侧（内外各一层）? 不对，只有内侧受拉
                var As_h_req = N_theta_max * 1000 / fy; // mm²/m
                var rho_h_min = rhoMinFlex(ft, fy).rho; // 环向最小配筋率（内外侧合计）
                var As_h_min = rho_h_min * h * 1000; // 全截面（内外两侧）
                var useAs_h = Math.max(As_h_req, As_h_min);
                st.push('<div class="step"><b>③ 环向受拉钢筋（内侧受拉为主）</b></div>');
                st.push('<div class="step">　　A<sub>s,req</sub> = N<sub>θ,max</sub>/f<sub>y</sub> = ' + fmt(N_theta_max,2) + '×10³/' + fy + ' = <b>' + fmt(As_h_req, 0) + ' mm²/m</b>（受拉侧）</div>');
                st.push('<div class="step">　　构造最小（双侧）ρ<sub>min</sub> = ' + fmt(rho_h_min*100, 3) + '% ⇒ ' + fmt(As_h_min, 0) + ' mm²/m；内侧取 ' + fmt(Math.max(As_h_req, As_h_min/2), 0) + ' mm²/m 受拉侧</div>');

                // 竖向弯矩：按上端自由、下端嵌固的悬臂梁，受三角形分布的径向荷载？
                // 不对，环向是受拉为主，竖向弯矩主要由底部约束引起
                // 水压力是径向的，会产生环向拉力和竖向弯矩的耦合
                // 简化：按梁模型估算竖向弯矩（偏保守，实际圆柱壳弯矩比梁小）
                var Mv_bot = 0, Mv_mid = 0;
                if (botV === 'fix' && topV === 'free') {
                    // 悬臂梁受三角形分布荷载，固端弯矩 M = q_max * H² / 6
                    // 但这里 q 是水压力，单位 kN/m²，每延米池壁
                    var p_max = gammaW * hw; // kPa = kN/m²
                    Mv_bot = p_max * hw * hw / 6; // 底部弯矩 kN·m/m
                    // 最大值位置在底部，然后向上减小
                    Mv_mid = p_max * hw * hw / 16; // 中点近似
                    st.push('<div class="step"><b>④ 竖向弯矩（按悬臂梁近似，偏安全）</b></div>');
                    st.push('<div class="step">　　底部固端弯矩 M<sub>bot</sub> = p<sub>max</sub>·h<sub>w</sub>²/6 = ' + p_max + ' × ' + hw + '² / 6 = <b>' + fmt(Mv_bot, 2) + ' kN·m/m</b>（外侧受拉）</div>');
                } else {
                    var p_max2 = gammaW * hw;
                    Mv_bot = p_max2 * hw * hw / 15; // 两端约束近似
                    st.push('<div class="step"><b>④ 竖向弯矩（近似）</b>　底部弯矩 ≈ ' + fmt(Mv_bot, 2) + ' kN·m/m</div>');
                }

                // 竖向受弯配筋
                var b = 1000; // mm
                var h0_v = h - asV;
                var a1fc = alpha1 * fc;
                var alpha_sv = Mv_bot * 1e6 / (a1fc * b * h0_v * h0_v);
                var ksiv = 1 - Math.sqrt(1 - 2 * alpha_sv);
                var xv = ksiv * h0_v;
                var As_v_req = a1fc * b * xv / fy;
                if (isNaN(As_v_req)) As_v_req = 0;
                var rho_v_min = Math.max(0.0015, 0.45 * ft / fy); // 竖向最小配筋率 0.15%（另有专门规定，依据正文未取得，2026-09-23 未核对）
                var As_v_min = rho_v_min * h * 1000; // 双侧
                var useAs_v = Math.max(As_v_req, As_v_min / 2); // 外侧受拉侧
                st.push('<div class="step"><b>⑤ 竖向受弯钢筋（底部外侧受拉）</b></div>');
                st.push('<div class="step">　　h<sub>0</sub> = ' + h0_v + ' mm；α<sub>s</sub> = ' + fmt(alpha_sv, 4) + '；ξ = ' + fmt(ksiv, 4) + '</div>');
                st.push('<div class="step">　　A<sub>s,req</sub> = <b>' + fmt(As_v_req, 0) + ' mm²/m</b>；最小 ' + fmt(As_v_min/2, 0) + ' mm²/m（外侧）</div>');
                st.push('<div class="step">　　选用 A<sub>s,vert</sub> = ' + fmt(useAs_v, 0) + ' mm²/m</div>');

                // 裂缝宽度验算（按环向受拉控制）
                // 轴心受拉构件裂缝宽度：w_max = 1.9·ψ·σ_s/Es·(1.9c_s + 0.08d_eq/ρ_te)
                // σ_s = N_q / A_s (N_q 准永久组合下的拉力)
                var N_q = N_theta_max * 0.7; // 水荷载分项系数近似 1.27, 准永久系数取 0.8, N_q ≈ N_k * ψ_q = N_d/1.27 * 0.8 ≈ 0.63 N_d. 取 0.7
                var As_use_h = Math.max(As_h_req, As_h_min / 2); // 受拉侧钢筋面积
                var sigma_s_h = N_q * 1000 / As_use_h; // MPa
                var d_eq_h = 14; // 假设钢筋直径
                var cs_h = asH - d_eq_h / 2;
                var rho_te_h = As_use_h / (h * 1000 * 0.5); // 有效受拉面积按 0.5·h·1000
                if (rho_te_h < 0.01) rho_te_h = 0.01;
                var psi_h = 1.1 - 0.65 * ftk / (rho_te_h * sigma_s_h);
                if (psi_h > 1.0) psi_h = 1.0; if (psi_h < 0.2) psi_h = 0.2;
                var w_max_h = 1.9 * psi_h * sigma_s_h / Es * (1.9 * cs_h + 0.08 * d_eq_h / rho_te_h);
                var w_lim = 0.2;
                var crackOk = w_max_h <= w_lim;
                st.push('<div class="step"><b>⑥ 环向裂缝宽度验算（受拉控制）</b></div>');
                st.push('<div class="step">　　N<sub>q</sub> ≈ ' + fmt(N_q,2) + ' kN/m；σ<sub>s</sub> = ' + fmt(sigma_s_h,1) + ' MPa；ψ = ' + fmt(psi_h,3) + '；ρ<sub>te</sub> = ' + fmt(rho_te_h,4) + '</div>');
                st.push('<div class="step">　　w<sub>max</sub> = <b>' + fmt(w_max_h, 3) + ' mm</b> ≤ ' + w_lim + ' mm ⇒ ' + (crackOk ? '满足' + tag('ok','裂缝满足') : '不满足' + tag('err','裂缝超限')) + '</div>');

                // 池壁类型判别
                var Dh = D * 1000 / h; // 径厚比
                var isThin = Dh > 20; // 薄壳/厚壁分界约 20
                var html = resultRow('内径 / 池高 / 壁厚', D + ' m / ' + H + ' m / ' + h + ' mm（径厚比 D/h = ' + fmt(Dh,1) + '）');
                html += resultRow('底部最大环拉力 N<sub>θ,max</sub>', fmt(N_theta_max, 2) + ' kN/m');
                html += resultRow('环向受拉钢筋（内侧）', fmt(As_use_h, 0) + ' mm²/m（ρ = ' + fmt(As_use_h/(h*1000)*100, 3) + '%）');
                html += resultRow('底部竖向弯矩', fmt(Mv_bot, 2) + ' kN·m/m');
                html += resultRow('竖向受弯钢筋（外侧）', fmt(useAs_v, 0) + ' mm²/m');
                html += resultRow('环向裂缝宽度 w<sub>max</sub>', fmt(w_max_h, 3) + ' / ' + w_lim + ' mm ' + (crackOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('综合判定', badge(crackOk ? 'badge-ok' : 'badge-err', crackOk ? '圆形水池配筋与裂缝均满足' : '水池验算不满足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._PC_RESULT = { N_theta_max: N_theta_max, Mv_bot: Mv_bot, As_h: As_use_h, As_v: useAs_v, w_max: w_max_h, steps: st.join('') };
            }
            function reset() {
                ['pc_D','pc_H','pc_h','pc_hw','pc_gammaW','pc_as_h','pc_as_v'].forEach(function (id) {
                    var defs = { pc_D:8.0, pc_H:4.0, pc_h:250, pc_hw:3.8, pc_gammaW:10, pc_as_h:35, pc_as_v:40 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('pc_bot').value = 'fix';
                document.getElementById('pc_top').value = 'free';
                document.getElementById('pc_con').value = 'C30';
                document.getElementById('pc_steel').value = 'HRB400';
                calc();
            }
            document.getElementById('pc_calc').addEventListener('click', calc);
            document.getElementById('pc_reset').addEventListener('click', reset);
            document.getElementById('f-pc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pool-circ'] = tool;
})();
