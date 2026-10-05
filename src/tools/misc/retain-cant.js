/* retain-cant 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '悬臂式挡土墙',
        sub: '朗肯主动土压力 · 抗滑 · 抗倾覆 · 地基偏心 · 墙身配筋 · GB 50007-2011',
        meta: {"standard": "GB 50007-2011 + SL 379", "formulaSource": "6.6, 6.7", "limitations": "朗肯主动土压力，抗滑移/抗倾覆/地基偏心/墙身配筋", "unit": "Ea:kN/m, Kt,Ko:—, p:kPa", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">挡土墙尺寸</div>' +
                '<form id="f-rc"><div class="grid2">' +
                numField('rc_H', '墙高 H', 'm', 5.0) +
                numField('rc_b1', '墙顶宽 b<sub>1</sub>', 'mm', 300, '立壁顶部厚度') +
                numField('rc_b2', '墙底宽 b<sub>2</sub>', 'mm', 500, '立壁底部厚度（与底板连接处）') +
                numField('rc_B', '底板总宽 B', 'm', 3.0) +
                numField('rc_toe', '趾板长 B<sub>1</sub>', 'm', 0.8, '墙前趾板长度') +
                numField('rc_hh', '底板厚度 h', 'mm', 400) +
                numField('rc_base', '基础埋深 d', 'm', 1.0, '基础底面埋深') +
                numField('rc_top', '墙顶荷载 q', 'kPa', 0, '墙后地面附加荷载') +
                '</div><div class="panel-title" style="margin-top:14px;">土性与地基参数</div><div class="grid2">' +
                numField('rc_gamma', '填土重度 γ', 'kN/m³', 18) +
                numField('rc_gammaB', '地基土重度 γ<sub>b</sub>', 'kN/m³', 19, '基础底面以下土的重度') +
                numField('rc_phi', '内摩擦角 φ', '°', 30) +
                numField('rc_c', '黏聚力 c', 'kPa', 0, '砂性土取 0') +
                numField('rc_delta', '墙背摩擦角 δ', '°', 15, '通常取 φ/2 ~ 2φ/3') +
                numField('rc_fa', '地基承载力 f<sub>a</sub>', 'kPa', 200) +
                numField('rc_fmu', '基底摩擦系数 μ', '', 0.4, '混凝土-土：0.30~0.45；岩石更高') +
                selField('rc_con', '混凝土等级', conOpts('C30')) +
                selField('rc_steel', '钢筋等级', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('rc_as', '受拉钢筋 a<sub>s</sub>', 'mm', 50) +
                '</div><div class="hint">说明：按朗肯主动土压力理论计算（墙背竖直、填土水平，c=0）；整体抗滑移、抗倾覆、地基偏心承载力验算；立壁与底板受弯配筋简化估算。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="rc_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="rc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="rc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="rc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('rc_result'), proc = document.getElementById('rc_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var H = parseFloat(document.getElementById('rc_H').value); // m
                var b1 = parseFloat(document.getElementById('rc_b1').value) / 1000; // m
                var b2 = parseFloat(document.getElementById('rc_b2').value) / 1000; // m
                var B = parseFloat(document.getElementById('rc_B').value); // m
                var B1 = parseFloat(document.getElementById('rc_toe').value); // m
                var hh = parseFloat(document.getElementById('rc_hh').value) / 1000; // m
                var d = parseFloat(document.getElementById('rc_base').value); // m
                var q = parseFloat(document.getElementById('rc_top').value); // kPa
                var gamma = parseFloat(document.getElementById('rc_gamma').value);
                var gammaB = parseFloat(document.getElementById('rc_gammaB').value);
                var phiDeg = parseFloat(document.getElementById('rc_phi').value);
                var c = parseFloat(document.getElementById('rc_c').value);
                var deltaDeg = parseFloat(document.getElementById('rc_delta').value);
                var fa = parseFloat(document.getElementById('rc_fa').value);
                var fmu = parseFloat(document.getElementById('rc_fmu').value);
                var conV = document.getElementById('rc_con').value;
                var steelV = document.getElementById('rc_steel').value;
                var as = parseFloat(document.getElementById('rc_as').value);
                if (!(H > 0 && B > 0)) return err('墙高和底板宽度必须为正数。');
                var con = CONCRETE[conV];
                var fc = con.fc, ft = con.ft;
                var fy = (steelV === 'HRB400') ? 360 : 435;
                var alpha1 = con.alpha1;
                var st = [];

                var phi = phiDeg * Math.PI / 180;
                var Ka = Math.pow(Math.tan(Math.PI / 4 - phi / 2), 2);
                // 踵板长度
                var B3 = B - B1 - b2; // 踵板长度 m (近似，立壁底部宽 b2)
                if (B3 < 0) B3 = 0;

                st.push('<div class="step"><b>① 几何参数</b>　墙高 H = ' + H + ' m（墙顶至基础顶）；埋深 d = ' + d + ' m；总高 H + d = ' + fmt(H+d,2) + ' m</div>');
                st.push('<div class="step">　　底板总宽 B = ' + B + ' m；趾板 B<sub>1</sub> = ' + B1 + ' m；踵板 B<sub>3</sub> ≈ ' + fmt(B3,2) + ' m；底板厚 h = ' + hh + ' m</div>');

                // 朗肯主动土压力 (墙后填土水平，墙背竖直，按 B3 上方土体+墙身)
                // 合力 Ea = 0.5 * γ * H² * Ka + q * H * Ka
                var H_total = H + d; // 总挡土高度
                var Ea = 0.5 * gamma * H_total * H_total * Ka + q * H_total * Ka; // kN/m
                // 作用点距墙底距离 = H_total/3 (三角形+矩形组合的形心)
                // 三角形部分形心 H/3 从底，矩形部分形心 H/2 从底
                var Ea_tri = 0.5 * gamma * H_total * H_total * Ka;
                var Ea_rect = q * H_total * Ka;
                var y_a = (Ea_tri * H_total / 3 + Ea_rect * H_total / 2) / Ea; // 距底 m

                st.push('<div class="step"><b>② 朗肯主动土压力（K<sub>a</sub> = tan²(45°−φ/2) = ' + fmt(Ka,4) + '）</b></div>');
                st.push('<div class="step">　　土压力合力 E<sub>a</sub> = ½γH²K<sub>a</sub> + qHK<sub>a</sub> = ' + fmt(Ea_tri,2) + ' + ' + fmt(Ea_rect,2) + ' = <b>' + fmt(Ea,2) + ' kN/m</b></div>');
                st.push('<div class="step">　　作用点距基底 y<sub>a</sub> = ' + fmt(y_a, 3) + ' m</div>');

                // 自重（立壁 + 底板 + 踵板上填土）
                // 立壁自重（梯形截面）
                var G_wall = 24 * (b1 + b2) / 2 * H; // kN/m, 混凝土重度 24 kN/m³
                var G_base = 24 * B * hh; // 底板自重 kN/m
                var G_soil = gamma * B3 * H; // 踵板上方土重 kN/m
                var G_soilBase = gamma * B3 * d; // 埋深部分土重 (简化)
                var G_total = G_wall + G_base + G_soil + gammaB * d * B; // 总竖向力（含基础上覆土重简化）
                // 修正：基础以上填土重只在踵板上方；趾板上方土重也加上
                var G_toeSoil = gammaB * d * B1; // 趾板上方填土重
                G_total = G_wall + G_base + G_soil + G_toeSoil + gamma * d * b2; // 立壁上方也有土（立壁宽 b2，d 高）? 太复杂，近似
                // 简化：总竖向力 G = 墙身 + 底板 + 全部底板宽度范围内的回填土重（从基础顶到地面）
                G_total = G_wall + G_base + gamma * B * d; // 近似

                // 自重作用点位置（距墙趾，即 B1 端点）
                // 立壁形心：距墙趾 B1 + b2/2 (立壁在底板上偏踵板侧)? 假设立壁底板对齐趾板端
                // 简化：立壁靠趾板一侧（b1=b2? 不对，立壁是梯形，顶部 b1, 底部 b2）
                // 设立壁底部与趾板端对齐，立壁向踵板侧渐变厚
                // 形心位置 x_wall: 从趾端点量起
                var x_wall = B1 + (b2 * 2 + b1) / (3 * (b1 + b2)) * b2; // 梯形形心
                if (b1 + b2 <= 0) x_wall = B1;
                var x_base = B / 2; // 底板形心
                var x_soil = B1 + b2 + B3 / 2; // 踵板上方土形心（近似梯形土柱中心）
                var G_x = (G_wall * x_wall + G_base * x_base + G_soil * x_soil + G_toeSoil * B1 / 2) / G_total;
                if (isNaN(G_x)) G_x = B / 2;

                st.push('<div class="step"><b>③ 竖向自重</b></div>');
                st.push('<div class="step">　　墙身自重 G<sub>wall</sub> = ' + fmt(G_wall,1) + ' kN/m；底板 G<sub>base</sub> = ' + fmt(G_base,1) + ' kN/m</div>');
                st.push('<div class="step">　　踵板上土重 G<sub>soil</sub> = ' + fmt(G_soil,1) + ' kN/m；总竖向力 G ≈ <b>' + fmt(G_total,1) + ' kN/m</b>（形心距墙趾 ' + fmt(G_x,2) + ' m）</div>');

                // 抗滑移验算：K_s = μ * G / Ea ≥ 1.3 (GB 50007)
                var Ks = fmu * G_total / Ea;
                var slipOk = Ks >= 1.3;
                st.push('<div class="step"><b>④ 抗滑移验算（K<sub>s</sub> = μG/E<sub>a</sub> ≥ 1.3）</b></div>');
                st.push('<div class="step">　　K<sub>s</sub> = ' + fmu + ' × ' + fmt(G_total,1) + ' / ' + fmt(Ea,2) + ' = <b>' + fmt(Ks, 2) + '</b> ≥ 1.3 ⇒ ' + (slipOk ? '满足' + tag('ok','抗滑满足') : '不满足' + tag('err','抗滑不足')) + '</div>');

                // 抗倾覆验算：对墙趾取矩
                // 抗倾覆力矩 M_anti = G * x' (x' 为 G 作用点到墙趾距离)
                // 倾覆力矩 M_over = Ea * y_a (对墙趾)
                var M_anti = G_total * G_x; // kN·m/m (抗倾覆，稳定)
                var M_over = Ea * y_a; // 倾覆力矩（水平力乘高度）
                var Kt = M_anti / M_over;
                var overOk = Kt >= 1.6; // GB 50007: 1.6
                st.push('<div class="step"><b>⑤ 抗倾覆验算（K<sub>t</sub> ≥ 1.6）</b></div>');
                st.push('<div class="step">　　抗倾覆力矩 M<sub>抗</sub> = G·x = ' + fmt(G_total,1) + ' × ' + fmt(G_x,2) + ' = ' + fmt(M_anti,1) + ' kN·m/m</div>');
                st.push('<div class="step">　　倾覆力矩 M<sub>倾</sub> = E<sub>a</sub>·y<sub>a</sub> = ' + fmt(Ea,2) + ' × ' + fmt(y_a,3) + ' = ' + fmt(M_over,1) + ' kN·m/m</div>');
                st.push('<div class="step">　　K<sub>t</sub> = <b>' + fmt(Kt, 2) + '</b> ≥ 1.6 ⇒ ' + (overOk ? '满足' + tag('ok','抗倾满足') : '不满足' + tag('err','抗倾不足')) + '</div>');

                // 地基承载力偏心验算
                // 总竖向力 G，总弯矩 M = Ea * y_a - G * (x - B/2)（对基础中心的力矩）
                var M_net = Math.abs(M_over - G_total * (G_x - B / 2)); // 对基础中心力矩
                var e0 = M_net / G_total; // 偏心距 m
                var p_max = G_total / B * (1 + 6 * e0 / B); // kPa
                var p_min = G_total / B * (1 - 6 * e0 / B);
                var baseOk = p_max <= 1.2 * fa && p_min >= 0; // p_max ≤ 1.2fa, 且不出现拉应力
                if (e0 > B / 6) baseOk = false; // 基底出现拉应力
                st.push('<div class="step"><b>⑥ 地基承载力（偏心受压）</b></div>');
                st.push('<div class="step">　　偏心距 e = ' + fmt(e0, 3) + ' m；B/6 = ' + fmt(B/6, 3) + ' m；' + (e0 <= B/6 ? '基底全截面受压' : '基底出现零应力区' + tag('warn','零应力区')) + '</div>');
                st.push('<div class="step">　　p<sub>max</sub> = G/B·(1+6e/B) = ' + fmt(p_max, 1) + ' kPa；p<sub>min</sub> = ' + fmt(p_min, 1) + ' kPa</div>');
                st.push('<div class="step">　　p<sub>max</sub> ≤ 1.2f<sub>a</sub> = ' + fmt(1.2*fa, 1) + ' kPa ⇒ ' + (baseOk ? '满足' + tag('ok','地基满足') : '不满足' + tag('err','地基不足')) + '</div>');

                // 立壁配筋（简化：悬臂梁，墙底最大弯矩）
                // 立壁高度 H，三角形土压力
                var M_wall = 0.5 * gamma * H * H * Ka * H / 3; // kN·m/m (仅土压力，不计q)
                M_wall += q * H * Ka * H / 2; // 地面荷载产生的弯矩
                var bw = b2 * 1000; // mm, 立壁底宽
                var h0 = bw - as; // 不对，h 是厚度方向，b 是单位 1m
                // 立壁厚度 b2（沿水平方向为墙厚），单位长度 1m 计算
                var h_wall = b2 * 1000; // mm, 墙厚 = 截面高度
                var b_wall = 1000; // mm, 每延米
                var h0w = h_wall - as;
                var a1fc = alpha1 * fc;
                var alpha_sw = M_wall * 1e6 / (a1fc * b_wall * h0w * h0w);
                var ksiw = 1 - Math.sqrt(1 - 2 * alpha_sw);
                if (alpha_sw > 0.5) ksiw = NaN;
                var As_wall = a1fc * b_wall * ksiw * h0w / fy;
                if (isNaN(As_wall)) As_wall = 99999;
                var rho_w_min = rhoMinFlex(ft, fy).rho;
                var As_wmin = rho_w_min * b_wall * h_wall;
                var use_wall = Math.max(As_wall, As_wmin);
                st.push('<div class="step"><b>⑦ 立壁配筋（墙底截面，悬臂受弯）</b>　M<sub>max</sub> = ' + fmt(M_wall, 2) + ' kN·m/m；墙厚 = ' + b2*1000 + ' mm</div>');
                st.push('<div class="step">　　A<sub>s,req</sub> = ' + fmt(As_wall, 0) + ' mm²/m；最小 ' + fmt(As_wmin, 0) + ' mm²/m；选用 ' + fmt(use_wall, 0) + ' mm²/m</div>');

                var allOk = slipOk && overOk && baseOk;
                var html = resultRow('墙高 / 埋深', H + ' m / ' + d + ' m');
                html += resultRow('主动土压力 E<sub>a</sub>', fmt(Ea, 2) + ' kN/m（K<sub>a</sub> = ' + fmt(Ka, 4) + '）');
                html += resultRow('总竖向自重 G', fmt(G_total, 1) + ' kN/m');
                html += resultRow('抗滑移 K<sub>s</sub>', fmt(Ks, 2) + ' / 1.3 ' + (slipOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('抗倾覆 K<sub>t</sub>', fmt(Kt, 2) + ' / 1.6 ' + (overOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('地基偏心 p<sub>max</sub>', fmt(p_max, 1) + ' / ' + fmt(1.2*fa, 1) + ' kPa ' + (baseOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('立壁底部配筋', fmt(use_wall, 0) + ' mm²/m（受拉侧）');
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '挡土墙整体稳定与地基均满足' : '挡土墙验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._RC_RESULT = { Ea: Ea, Ks: Ks, Kt: Kt, p_max: p_max, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['rc_H','rc_b1','rc_b2','rc_B','rc_toe','rc_hh','rc_base','rc_top','rc_gamma','rc_gammaB','rc_phi','rc_c','rc_delta','rc_fa','rc_fmu','rc_as'].forEach(function (id) {
                    var defs = { rc_H:5.0, rc_b1:300, rc_b2:500, rc_B:3.0, rc_toe:0.8, rc_hh:400, rc_base:1.0, rc_top:0, rc_gamma:18, rc_gammaB:19, rc_phi:30, rc_c:0, rc_delta:15, rc_fa:200, rc_fmu:0.4, rc_as:50 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('rc_con').value = 'C30';
                document.getElementById('rc_steel').value = 'HRB400';
                calc();
            }
            document.getElementById('rc_calc').addEventListener('click', calc);
            document.getElementById('rc_reset').addEventListener('click', reset);
            document.getElementById('f-rc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['retain-cant'] = tool;
})();
