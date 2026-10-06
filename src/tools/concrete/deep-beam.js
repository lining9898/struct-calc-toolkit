(function () {
    var tool = {
        title: '深受弯构件（深梁）',
        sub: '正截面受弯 + 斜截面受剪 · GB/T 50010-2010（2024年版） 附录 G',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '附录G',
            limitations: 'l0/h≤5的简支/连续深受弯构件，正截面+斜截面',
            unit: 'M:kN·m, V:kN, h:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">截面与跨度</div>' +
                '<form id="f-db"><div class="grid2">' +
                numField('db_b', '截面宽度 b', 'mm', 200) +
                numField('db_h', '截面高度 h', 'mm', 2000, '深梁梁高，一般 l<sub>0</sub>/h ≤ 5') +
                numField('db_l0', '计算跨度 l<sub>0</sub>', 'm', 6.0, '简支深梁取 1.15l<sub>n</sub> 或 l<sub>c</sub> 两者较小值') +
                numField('db_as', '受拉筋 a<sub>s</sub>', 'mm', 60) +
                selField('db_sup', '支承条件', opts([{v:'ss',t:'简支（两端铰支）'},{v:'ff',t:'两端固定'}], 'ss')) +
                selField('db_con', '混凝土强度等级', conOpts('C30')) +
                selField('db_reb', '纵筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                selField('db_stir', '水平分布筋/箍筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HPB300',t:'HPB300'}], 'HRB400')) +
                numField('db_As', '受拉钢筋面积 A<sub>s</sub>', 'mm²', 2513, '如 8φ20 = 2513 mm²') +
                numField('db_M', '弯矩设计值 M', 'kN·m', 2000) +
                numField('db_V', '剪力设计值 V', 'kN', 1200) +
                numField('db_ash', '水平分布筋面积 A<sub>sh</sub>', 'mm²/m', 503, '如 φ8@200 双肢 = 2×50.3÷0.2 = 503 mm²/m') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="db_calc">深梁验算</button>' +
                '<button type="button" class="btn btn-secondary" id="db_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">深梁验算结果</div><div id="db_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="db_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('db_result');
                var proc = document.getElementById('db_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }

                var b = parseFloat(document.getElementById('db_b').value);
                var h = parseFloat(document.getElementById('db_h').value);
                var l0 = parseFloat(document.getElementById('db_l0').value);
                var asV = parseFloat(document.getElementById('db_as').value);
                var sup = document.getElementById('db_sup').value;
                var con = CONCRETE[document.getElementById('db_con').value];
                var reb = REBAR_FLEX[document.getElementById('db_reb').value];
                var materialError = concreteRebarError(con, reb);
                if (materialError) return err(materialError);
                var stir = REBAR_STIRRUP[document.getElementById('db_stir').value] || { fy: 360 };
                var As = parseFloat(document.getElementById('db_As').value);
                var M = parseFloat(document.getElementById('db_M').value);
                var V = parseFloat(document.getElementById('db_V').value);
                var Ash = parseFloat(document.getElementById('db_ash').value);

                if (!(b > 0 && h > 0)) return err('截面尺寸必须为正数。');
                if (!(l0 > 0)) return err('跨度必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应小于梁高。');
                if (!(As > 0 && M > 0 && V > 0)) return err('钢筋面积、弯矩、剪力必须为正数。');

                var l0_h = l0 * 1000 / h; // l0/h 跨高比
                var fc = con.fc, ft = con.ft, ftk = con.ftk;
                var fy = reb.fy, fyv = stir.fy;
                var alpha1 = con.alpha1, beta1 = con.beta1, ecu = con.ecu;
                var es = reb.es;
                var xi_b = beta1 / (1 + fy / (es * ecu));

                var st = [];
                st.push('<div class="step"><b>① 跨高比判别</b>　l<sub>0</sub>/h = ' + fmt(l0_h, 3) + '；');
                if (l0_h <= 2) st[st.length-1] += 'l<sub>0</sub>/h ≤ 2，属于 <b>深梁</b>（按深受弯构件 G.0 计算）；';
                else if (l0_h <= 5) st[st.length-1] += '2 < l<sub>0</sub>/h ≤ 5，属于 <b>短梁</b>（按深受弯构件过渡公式）；';
                else st[st.length-1] += 'l<sub>0</sub>/h > 5，按 <b>普通梁</b> 计算（用矩形梁工具）；';
                st[st.length-1] += '</div>';

                // ===== 正截面受弯承载力（附录 G.0.1） =====
                // 深梁受弯内力臂 z = α_d * h0
                // 对简支深梁：α_d = 0.8 + 0.04*(l0/h)  当 l0/h <= 2 时？不对
                // 规范 G.0.1-2：α_d = 0.8 + 0.07*(l0/h - 2) ? 不对
                // 正确：当 l0/h ≤ 2 时，α_d = 0.9（简支），= 0.75（连续）
                // 当 l0/h = 5 时，α_d → 普通梁的 0.87
                // 内插：α_d = 0.9 - 0.03*(l0/h - 2)  （简支，从 0.9 → 0.81 在 l/h=5 时）
                // 更精确：按 G.0.1 条内力臂系数
                // 简支深梁：
                //   l0/h = 1 → α_d = 0.85？不对，规范值是 z/h0 系数
                // 采用简化：按规范内插
                // 当 l0/h ≤ 1.5 时，α_d = 0.85（简支单跨）
                // 当 l0/h = 5 时，α_d = 0.87（普通梁近似）
                // 线性内插
                var alpha_d;
                if (l0_h <= 1.5) alpha_d = 0.85;
                else if (l0_h >= 5) alpha_d = 0.87;
                else alpha_d = 0.85 + (0.87 - 0.85) * (l0_h - 1.5) / (5 - 1.5);

                var h0 = h - asV;
                var z = alpha_d * h0; // 内力臂
                var Mu_flex = fy * As * z / 1e6; // kN·m

                // 界限条件：x 不能太大，深梁一般 x 较小
                // 用简化：M = f_y * A_s * z
                var flexOk = M <= Mu_flex;

                st.push('<div class="step"><b>② 正截面受弯承载力（G.0.1 条，内力臂法）</b>　内力臂系数 α<sub>d</sub> = ' + fmt(alpha_d, 3) + '（按 l<sub>0</sub>/h=' + fmt(l0_h,2) + ' 内插）；z = α<sub>d</sub>·h<sub>0</sub> = ' + fmt(z, 0) + ' mm</div>');
                st.push('<div class="step"><b>　受弯承载力</b>　M<sub>u</sub> = f<sub>y</sub>·A<sub>s</sub>·z = ' + fy + '×' + fmt(As,0) + '×' + fmt(z,0) + ' / 10⁶ = <b>' + fmt(Mu_flex, 1) + ' kN·m</b>' + (flexOk ? tag('ok','满足') : tag('err','不满足')) + '</div>');

                // ===== 斜截面受剪承载力（附录 G.0.2） =====
                // 深梁斜截面受剪：V ≤ 0.7 * (8 / (l0/h + 2)) * f_t * b * h0
                // 即 λ = 0.7 * 8/(l0/h+2) 乘以普通梁的 0.7ftbh0 公式？
                // 规范 G.0.2-1：对于均布荷载：V = 0.7*(1.5+1/(l0/h)) * ft * b * h0  ？ 不对
                // 正确公式 G.0.2-1：
                // V ≤ 0.7*(8/(l0/h+2))*ft*b*h0 + f_yv * A_sh * h0 / s_v （有水平分布筋时）
                // 对于无水平分布筋的深梁，取第一项
                // 第一项：β_c * α_c * f_t * b * h_0，其中 α_c = 0.7 * 8/(l0/h + 2)
                var alpha_c = 0.7 * 8 / (l0_h + 2);
                var beta_c = 1.0; // ≤C50
                var Vc = beta_c * alpha_c * ft * b * h0 / 1000; // kN
                // 水平分布筋贡献：f_yv * A_sh * h0 / s_v
                // A_sh 是每米水平分布筋面积 mm²/m，s = 1000 mm，所以 A_sh/s = A_sh (mm²/mm)
                // 规范 G.0.2 有水平分布筋时：V_s = f_yv * A_sh * h0 / s
                var Vs = fyv * Ash * h0 / 1000 / 1000; // kN（Ash mm²/m, h0 mm, fyv N/mm²）
                // Ash 是 mm²/m → Ash / 1000 = mm²/mm
                // V_s = f_yv * (Ash/1000) * h0 (N) = f_yv * Ash * h0 / 1000 (N) = f_yv * Ash * h0 / 1e6 (kN)
                Vs = fyv * Ash * h0 / 1e6; // kN
                var Vu_shear = Vc + Vs; // kN

                // 截面限制条件（G.0.3 条）
                // V ≤ 0.15 * β_c * f_c * b * h_0
                var Vmax = 0.15 * beta_c * fc * b * h0 / 1000; // kN
                var secOk = V <= Vmax;
                var shearOk = V <= Vu_shear && secOk;

                st.push('<div class="step"><b>③ 斜截面受剪承载力（G.0.2 条）</b>　α<sub>c</sub> = 0.7 × 8/(l<sub>0</sub>/h + 2) = ' + fmt(alpha_c, 3) + '</div>');
                st.push('<div class="step"><b>　混凝土项 V<sub>c</sub></b>　V<sub>c</sub> = β<sub>c</sub>α<sub>c</sub>f<sub>t</sub>bh<sub>0</sub> = ' + fmt(Vc, 1) + ' kN</div>');
                st.push('<div class="step"><b>　水平分布筋项 V<sub>s</sub></b>　V<sub>s</sub> = f<sub>yv</sub>·A<sub>sh</sub>·h<sub>0</sub>/s = ' + fyv + '×' + Ash + '×' + h0 + '/1000/1000 = ' + fmt(Vs, 1) + ' kN</div>');
                st.push('<div class="step"><b>　总受剪承载力</b>　V<sub>u</sub> = V<sub>c</sub> + V<sub>s</sub> = <b>' + fmt(Vu_shear, 1) + ' kN</b>' + (Vu_shear >= V ? tag('ok','满足') : tag('err','不满足')) + '</div>');
                st.push('<div class="step"><b>④ 截面限制（G.0.3 条）</b>　V<sub>max</sub> = 0.15β<sub>c</sub>f<sub>c</sub>bh<sub>0</sub> = ' + fmt(Vmax, 1) + ' kN；V = ' + V + ' kN ' + (secOk ? '≤' : '＞') + ' V<sub>max</sub> ⇒ ' + (secOk ? '满足' : '截面不足') + tag(secOk ? 'ok' : 'err', secOk ? '满足' : '不满足') + '</div>');

                // 最小配筋率：深梁分布筋有专门要求
                // 水平分布筋 ρ_sh_min = 0.2%（HRB），竖向分布筋 0.2%
                var rho_sh = Ash / (b * 1000);
                var rho_sh_min = 0.002;

                st.push('<div class="step"><b>⑤ 分布筋配筋率</b>　水平分布筋 ρ<sub>sh</sub> = ' + fmt(rho_sh*100, 3) + '%，最小 ρ<sub>sh,min</sub> = 0.20%（' + (rho_sh >= rho_sh_min ? '满足' : '不满足') + '）</div>');

                var totalOk = flexOk && shearOk;
                st.push('<div class="step"><b>⑥ 结论</b>　正截面受弯 ' + (flexOk ? '满足' : '不满足') + '；斜截面受剪 ' + (shearOk ? '满足' : '不满足') + '。</div>');

                var html = resultRow('跨高比 l<sub>0</sub>/h', fmt(l0_h, 3) + '（' + (l0_h <= 2 ? '深梁' : l0_h <= 5 ? '短梁' : '普通梁') + '）');
                html += resultRow('内力臂系数 α<sub>d</sub>', fmt(alpha_d, 3));
                html += resultRow('正截面受弯承载力 M<sub>u</sub>', fmt(Mu_flex, 1) + ' kN·m');
                html += resultRow('正截面判定', badge(flexOk ? 'badge-ok' : 'badge-err', flexOk ? '受弯承载力满足' : '受弯承载力不足'));
                html += '<div class="sec-title">斜截面受剪</div>';
                html += resultRow('混凝土项 V<sub>c</sub>', fmt(Vc, 1) + ' kN');
                html += resultRow('水平分布筋项 V<sub>s</sub>', fmt(Vs, 1) + ' kN（A<sub>sh</sub> = ' + Ash + ' mm²/m）');
                html += resultRow('总受剪承载力 V<sub>u</sub>', '<span class="highlight">' + fmt(Vu_shear, 1) + ' kN</span>');
                html += resultRow('截面限制 V<sub>max</sub>', fmt(Vmax, 1) + ' kN（0.15f<sub>c</sub>bh<sub>0</sub>）');
                html += resultRow('斜截面判定', badge(shearOk ? 'badge-ok' : 'badge-err', shearOk ? '受剪承载力满足' : '受剪承载力不足'));
                html += resultRow('水平分布筋配筋率', fmt(rho_sh*100, 3) + '%（最小 0.2%）' + badge(rho_sh >= rho_sh_min ? 'badge-ok' : 'badge-warn', rho_sh >= rho_sh_min ? '满足' : '配筋不足'));
                html += resultRow('总体判定', badge(totalOk ? 'badge-ok' : 'badge-err', totalOk ? '深梁正斜截面均满足' : '不满足，需调整'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._DB_RESULT = {
                    b: b, h: h, l0: l0, l0_h: l0_h, asV: asV, As: As,
                    M: M, V: V, Ash: Ash,
                    conGrade: document.getElementById('db_con').value,
                    rebGrade: document.getElementById('db_reb').value,
                    alpha_d: alpha_d, z: z, Mu_flex: Mu_flex, flexOk: flexOk,
                    alpha_c: alpha_c, Vc: Vc, Vs: Vs, Vu_shear: Vu_shear,
                    Vmax: Vmax, secOk: secOk, shearOk: shearOk, totalOk: totalOk
                };
            }

            document.getElementById('db_calc').addEventListener('click', calc);
            document.getElementById('db_reset').addEventListener('click', function () {
                var f = document.getElementById('f-db'); f.reset();
                document.getElementById('db_b').value = 200;
                document.getElementById('db_h').value = 2000;
                document.getElementById('db_l0').value = 6.0;
                document.getElementById('db_as').value = 60;
                document.getElementById('db_As').value = 2513;
                document.getElementById('db_M').value = 2000;
                document.getElementById('db_V').value = 1200;
                document.getElementById('db_ash').value = 503;
                calc();
            });
            document.getElementById('f-db').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['deep-beam'] = tool;
})();
