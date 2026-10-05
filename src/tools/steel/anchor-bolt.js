/* anchor-bolt 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '柱脚锚栓计算',
        sub: '锚栓拉力 · 抗拉承载力 · 锚固长度 · 底板局压 · GB 50017-2017 / GB/T 50010-2010（2024年版）',
        meta: {"standard": "GB 50017-2017 + GB/T 50010-2010（2024年版）", "formulaSource": "12.7", "limitations": "柱脚底板尺寸+锚栓拉力+锚固长度+局部受压", "unit": "T:kN, d:mm, fta:N/mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">柱脚与锚栓参数</div>' +
                '<form id="f-ab"><div class="grid2">' +
                numField('ab_Bx', '底板宽度 B（沿弯矩方向）', 'mm', 500) +
                numField('ab_By', '底板宽度 L（垂直弯矩方向）', 'mm', 300) +
                numField('ab_d', '柱截面高度 h<sub>c</sub>', 'mm', 300, '用于局部受压计算') +
                numField('ab_bc', '柱截面宽度 b<sub>c</sub>', 'mm', 200) +
                numField('ab_dia', '锚栓直径 d', 'mm', 24, '锚栓公称直径，如 M24') +
                numField('ab_n', '锚栓数量 n（受拉侧）', '个', 4, '受拉一侧的锚栓总数；若两侧对称布置，填一侧数量') +
                numField('ab_a', '锚栓到基础边缘距离 a', 'mm', 80, '锚栓中心到底板受拉边缘距离') +
                numField('ab_z', '锚栓间距（沿L方向）', 'mm', 150, '同一侧多个锚栓的间距') +
                selField('ab_anchorSteel', '锚栓钢材', opts([
                    { v: 'Q235', t: 'Q235（f_y = 235, f_t = 140 MPa 锚栓）' },
                    { v: 'Q355', t: 'Q355 / Q345（f_y = 355, f_t = 180 MPa）' },
                    { v: '35号', t: '35号优质碳素钢' },
                    { v: '40Cr', t: '40Cr 合金钢（高强锚栓）' }
                ], 'Q355')) +
                selField('ab_con', '基础混凝土等级', conOpts('C30')) +
                numField('ab_N', '柱脚轴力 N', 'kN', 600) +
                numField('ab_M', '柱脚弯矩 M', 'kN·m', 180) +
                numField('ab_V', '柱脚剪力 V', 'kN', 50, '柱脚剪力由底板与基础间摩擦力或抗剪键承担') +
                numField('ab_fmu', '底板摩擦系数 μ', '', 0.4, '钢-混凝土摩擦系数，通常取 0.4') +
                '</div><div class="hint">说明：按底板受压区 + 锚栓受拉的静力平衡法计算（简化：假定底板与基础间压应力为三角形分布，受拉区锚栓承担拉力）。也可按 GB 50017 规定的锚栓受拉承载力验算。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ab_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ab_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ab_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ab_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ab_result'), proc = document.getElementById('ab_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var B = parseFloat(document.getElementById('ab_Bx').value); // mm, 弯矩方向长度
                var L = parseFloat(document.getElementById('ab_By').value); // mm, 垂直弯矩方向宽度
                var hc = parseFloat(document.getElementById('ab_d').value);
                var bc = parseFloat(document.getElementById('ab_bc').value);
                var dia = parseFloat(document.getElementById('ab_dia').value); // mm
                var n = parseInt(document.getElementById('ab_n').value);
                var aEdge = parseFloat(document.getElementById('ab_a').value); // mm, 锚栓到受拉边缘距离
                var z = parseFloat(document.getElementById('ab_z').value);
                var ancSteel = document.getElementById('ab_anchorSteel').value;
                var conV = document.getElementById('ab_con').value;
                var N = parseFloat(document.getElementById('ab_N').value); // kN
                var M = parseFloat(document.getElementById('ab_M').value); // kN·m
                var V = parseFloat(document.getElementById('ab_V').value);
                var fmu = parseFloat(document.getElementById('ab_fmu').value);
                if (!(B > 0 && L > 0)) return err('底板尺寸必须为正数。');
                if (!(dia > 0 && n > 0)) return err('锚栓直径和数量必须为正数。');
                if (!(N >= 0 && M >= 0)) return err('轴力和弯矩不能为负。');
                var con = CONCRETE[conV];
                var fc = con.fc, ft = con.ft; // MPa
                var st = [];

                // 锚栓抗拉强度设计值 f_ta (MPa)
                var fta;
                if (ancSteel === 'Q235') fta = 140;
                else if (ancSteel === 'Q355') fta = 180;
                else if (ancSteel === '35号') fta = 200;
                else fta = 250; // 40Cr 高强锚栓近似

                // 锚栓有效面积
                var pitchMap = { '16': 2, '20': 2.5, '22': 2.5, '24': 3, '27': 3, '30': 3.5, '36': 4, '42': 4.5, '48': 5 };
                var pitch = pitchMap[String(dia)] || 3;
                var de = dia - 0.9382 * pitch;
                var As_a = Math.PI * de * de / 4; // mm²  单根
                var As_total = n * As_a; // mm²
                st.push('<div class="step"><b>① 锚栓参数</b>　直径 d = ' + dia + ' mm；有效直径 d<sub>e</sub> = ' + fmt(de,2) + ' mm；' +
                    '单根有效面积 A<sub>e</sub> = ' + fmt(As_a, 0) + ' mm²；共 ' + n + ' 根，A<sub>s,total</sub> = ' + fmt(As_total, 0) + ' mm²</div>');
                st.push('<div class="step">　　锚栓钢材：' + ancSteel + '；f<sub>t</sub><sup>a</sup> = ' + fta + ' MPa（抗拉强度设计值）</div>');

                // 底板尺寸：B (沿弯矩方向长度), L (宽度)
                // 轴力 N (压为正), 弯矩 M
                // 偏心距 e0 = M / N (mm)
                var e0 = M * 1e6 / (N * 1000); // mm = kN·m*1e6 / (kN*1000) = mm?  M(kN·m)*10^6 = N·mm; N(kN)*1000 = N; e0 = N·mm/N = mm. 对！
                e0 = M * 1000 / N; // m? 不: M kN·m = M*10^6 N·mm, N kN = N*1000 N; e0 = M*10^6 / (N*1000) = M*1000 / N mm
                // 验证: 180 kN·m / 600 kN = 0.3 m = 300 mm. M*1000/N = 180*1000/600 = 300 mm. ✓
                e0 = M * 1000 / N; // mm
                st.push('<div class="step"><b>② 偏心距</b>　e<sub>0</sub> = M / N = ' + fmt(e0, 0) + ' mm = ' + fmt(e0/1000,3) + ' m；底板长 B = ' + B + ' mm；B/6 = ' + fmt(B/6,1) + ' mm</div>');

                // 判别：e0 <= B/6 全截面受压；否则部分受拉（由锚栓承担拉力）
                var x = 0; // 受压区高度 mm
                var T_bolt = 0; // 锚栓总拉力 kN
                var sigma_cmax = 0; // 基础最大压应力 MPa
                var tensionCase = e0 > B / 6;

                if (!tensionCase) {
                    // 全截面受压，按线性分布
                    var sigma_min = N * 1000 / (B * L) * (1 - 6 * e0 / B); // MPa (N/mm²)
                    sigma_cmax = N * 1000 / (B * L) * (1 + 6 * e0 / B);
                    T_bolt = 0;
                    st.push('<div class="step"><b>③ 全截面受压（e<sub>0</sub> ≤ B/6）</b>　σ<sub>max</sub> = N/A·(1+6e/B) = <b>' + fmt(sigma_cmax, 3) + ' MPa</b>；σ<sub>min</sub> = ' + fmt(sigma_min, 3) + ' MPa</div>');
                    st.push('<div class="step">　　锚栓仅作构造安装，不受力。</div>');
                } else {
                    // 部分受拉：受压区 x，锚栓拉力 T
                    // 简化：三角形压应力分布 + 锚栓受拉集中力
                    // 对受压区合力点取矩：M + N*(B/2 - x/3) = T*(B - a - x/3)? 近似方法
                    // 常用简化方法：假定压应力为三角形分布，合力 C = 0.5·σ_max·x·L
                    // 锚栓拉力 T，平衡：C + T = N (N为压力，正方向压)
                    // 对形心取矩：C*(B/2 - x/3) - T*(B/2 - a) = M
                    // 这里用更简单的方法：假定受压区合力 C = 0.5*σ_max*x*L, 作用点距受压边缘 x/3
                    // 锚栓拉力 T, 作用点距受拉边缘 a
                    // 水平平衡: C = N + T
                    // 对受压边缘取矩: N*B/2 + M = T*(B - a) + C*x/3?  坐标系不对，重新来
                    // 设 x 为受压区高度（从受压边缘到中和轴距离）
                    // C = 0.5 * σ_cmax * x * L  (压应力合力，压为正)
                    // 对受压边缘取矩：
                    // 外力矩: N * B/2 + M  (轴力在形心 B/2 处，弯矩使一侧受拉)
                    // 抵抗力矩: C * x/3 + T * (B - a)
                    // 平衡: C = N + T (C 压，T 拉，N 压，C = N + T)
                    // N*B/2 + M = C*x/3 + T*(B-a)
                    // 代入 C = N + T:
                    // N*B/2 + M = (N+T)*x/3 + T*(B-a) = N*x/3 + T*(x/3 + B - a)
                    // T = (N*B/2 + M - N*x/3) / (x/3 + B - a)  --- (1)
                    // 另外，需要找到 x. 但我们还需要 σ_cmax 与混凝土关系，x 未知。
                    // 简化方法：假设锚栓屈服，T = f_ta * As_total (控制设计)
                    // 更简单的简化：按大偏心受压类似，取 x = 2*(B/2 - e0 + T*?/N)?  太复杂
                    // 实用简化：取 x ≈ B/3 或直接用 "底板压应力三角形 + 锚栓拉力" 的近似
                    // 以下用近似：假定受压区高度 x = B/3（初值），迭代一次
                    x = B / 3; // 初值
                    for (var iter = 0; iter < 10; iter++) {
                        var T_val = (N * 1000 * B / 2 + M * 1e6 - N * 1000 * x / 3) / (x / 3 + B - aEdge);
                        // 单位: N*1000 (N), B (mm), M*1e6 (N·mm), x (mm)
                        // 结果 T_val 单位 N
                        var C_val = N * 1000 + T_val; // N
                        // 由 C = 0.5 * σ_cmax * x * L 求 σ_cmax 没有约束，x 可变。
                        // 实际上 σ_cmax 不应超过 f_c (偏保守，混凝土承压)
                        // 重新求 x：由 C = 0.5*σ_cmax*x*L，若 σ_cmax = 1.5*f_c (局部承压提高)，x 可得
                        // 更准确的方法：设 σ_cmax = f_cc (局部承压强度)，x = 2C / (σ_cmax * L)
                        var fcc = fc; // 简化取 fc，实际应考虑局部承压提高 β_l
                        var x_new = 2 * C_val / (fcc * L); // mm
                        if (Math.abs(x_new - x) < 0.1) break;
                        x = x + (x_new - x) * 0.5; // 松弛迭代
                    }
                    T_bolt = (N * 1000 * B / 2 + M * 1e6 - N * 1000 * x / 3) / (x / 3 + B - aEdge) / 1000; // kN
                    var C_final = N + T_bolt; // kN
                    sigma_cmax = 2 * C_final * 1000 / (x * L); // MPa (N/mm²)

                    st.push('<div class="step"><b>③ 部分受拉（e<sub>0</sub> &gt; B/6，锚栓参与受拉）</b></div>');
                    st.push('<div class="step">　　采用三角形压应力分布 + 锚栓集中受拉的简化模型（迭代法）</div>');
                    st.push('<div class="step">　　受压区高度 x ≈ ' + fmt(x, 0) + ' mm；基础最大压应力 σ<sub>cmax</sub> ≈ <b>' + fmt(sigma_cmax, 2) + ' MPa</b></div>');
                    st.push('<div class="step">　　锚栓总拉力 T = <b>' + fmt(T_bolt, 1) + ' kN</b>（共 ' + n + ' 根，每根 ' + fmt(T_bolt/n, 1) + ' kN）</div>');
                }

                // 锚栓抗拉承载力验算
                var Ntb_bolt = fta * As_total / 1000; // kN
                var tenOk = T_bolt <= Ntb_bolt;
                st.push('<div class="step"><b>④ 锚栓抗拉承载力验算</b>　N<sub>t</sub><sup>a</sup> = f<sub>t</sub><sup>a</sup>·A<sub>s,total</sub> = ' + fta + '×' + fmt(As_total,0) + ' = <b>' + fmt(Ntb_bolt, 1) + ' kN</b></div>');
                st.push('<div class="step">　　T = ' + fmt(T_bolt,1) + ' kN ≤ N<sub>t</sub><sup>a</sup> = ' + fmt(Ntb_bolt,1) + ' kN ⇒ ' +
                    (tenOk ? '满足' + tag('ok','锚栓抗拉满足') : '不满足' + tag('err','锚栓不足')) + '</div>');

                // 锚固长度建议
                // 受拉锚固长度 l_a = α * f_y / f_t * d
                var fy_anchor = (ancSteel === 'Q235') ? 235 : (ancSteel === 'Q355') ? 355 : (ancSteel === '35号') ? 310 : 500;
                var la = 0.14 * fy_anchor / ft * dia; // mm, α 取 0.14 近似（光圆 0.16，带肋 0.14）
                // 锚栓通常是光圆（弯钩/锚板），α 取 0.16
                la = 0.16 * fy_anchor / ft * dia;
                if (la < 15 * dia) la = 15 * dia; // 构造要求至少 15d
                if (la < 200) la = 200; // 至少 200 mm
                st.push('<div class="step"><b>⑤ 锚固长度建议（参考 GB 50010 8.3）</b>　l<sub>a</sub> ≈ α·f<sub>y</sub>/f<sub>t</sub>·d</div>');
                st.push('<div class="step">　　l<sub>a</sub> ≈ 0.16×' + fy_anchor + '/' + ft + '×' + dia + ' = <b>' + fmt(la, 0) + ' mm</b>（建议值，最终按规范及锚板形式确定）</div>');

                // 底板下混凝土局部受压
                // 局部受压面积 A_l = 柱底面积（近似柱截面尺寸），局部受压计算底面积 A_b 按底板面积
                var Al = bc * hc; // mm²
                var Ab = B * L; // mm²
                var beta_l = Math.sqrt(Ab / Al);
                if (beta_l > 3) beta_l = 3;
                var fl = 0.85 * beta_l * fc; // 局部受压承载力（不配间接钢筋时近似）
                var localOk = sigma_cmax <= fl;
                st.push('<div class="step"><b>⑥ 底板下混凝土局部受压（简化）</b>　A<sub>l</sub> = ' + fmt(Al,0) + ' mm²；A<sub>b</sub> = ' + fmt(Ab,0) + ' mm²；β<sub>l</sub> = √(A<sub>b</sub>/A<sub>l</sub>) = ' + fmt(beta_l,2) + '</div>');
                st.push('<div class="step">　　局部抗压强度 0.85β<sub>l</sub>f<sub>c</sub> = 0.85×' + fmt(beta_l,2) + '×' + fc + ' = ' + fmt(fl,2) + ' MPa</div>');
                st.push('<div class="step">　　σ<sub>cmax</sub> = ' + fmt(sigma_cmax,2) + ' MPa ≤ ' + fmt(fl,2) + ' MPa ⇒ ' +
                    (localOk ? '满足' + tag('ok','局压满足') : '不满足' + tag('err','局压不足')) + '</div>');

                // 抗剪（摩擦力）
                var Ff = N * fmu; // kN
                var shearOk = V <= Ff;
                st.push('<div class="step"><b>⑦ 柱脚抗剪（底板摩擦）</b>　F<sub>f</sub> = μ·N = ' + fmu + '×' + N + ' = ' + fmt(Ff, 0) + ' kN；V = ' + V + ' kN ⇒ ' +
                    (shearOk ? '满足' + tag('ok','摩擦抗剪') : '不满足，需设抗剪键' + tag('err','需抗剪键')) + '</div>');

                var allOk = tenOk && localOk && shearOk;
                var html = resultRow('偏心距 e<sub>0</sub> / B/6', fmt(e0,0) + ' / ' + fmt(B/6,1) + ' mm（' + (tensionCase ? '部分受拉' : '全截面受压') + '）');
                html += resultRow('受压区高度 x', (tensionCase ? fmt(x,0) + ' mm' : '全截面受压'));
                html += resultRow('锚栓总拉力 T / N<sub>t</sub><sup>a</sup>', fmt(T_bolt,1) + ' / ' + fmt(Ntb_bolt,1) + ' kN ' + (tenOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('单根锚栓拉力', fmt(T_bolt/n, 1) + ' kN / 根（共 ' + n + ' 根）');
                html += resultRow('基础最大压应力', fmt(sigma_cmax,2) + ' MPa（局部承压 ' + fmt(fl,2) + ' MPa）' + (localOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('建议锚固长度 l<sub>a</sub>', fmt(la, 0) + ' mm（≈ ' + fmt(la/dia,1) + 'd）');
                html += resultRow('抗剪（摩擦）', V + ' / ' + fmt(Ff,0) + ' kN ' + (shearOk ? tag('ok','满足') : tag('err','需抗剪键')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '柱脚锚栓各项验算均满足' : '柱脚验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._AB_RESULT = { T_bolt: T_bolt, Ntb: Ntb_bolt, sigma_cmax: sigma_cmax, la: la, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['ab_Bx','ab_By','ab_d','ab_bc','ab_dia','ab_n','ab_a','ab_z','ab_N','ab_M','ab_V','ab_fmu'].forEach(function (id) {
                    var defs = { ab_Bx:500, ab_By:300, ab_d:300, ab_bc:200, ab_dia:24, ab_n:4, ab_a:80, ab_z:150, ab_N:600, ab_M:180, ab_V:50, ab_fmu:0.4 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('ab_anchorSteel').value = 'Q355';
                document.getElementById('ab_con').value = 'C30';
                calc();
            }
            document.getElementById('ab_calc').addEventListener('click', calc);
            document.getElementById('ab_reset').addEventListener('click', reset);
            document.getElementById('f-ab').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['anchor-bolt'] = tool;
})();
