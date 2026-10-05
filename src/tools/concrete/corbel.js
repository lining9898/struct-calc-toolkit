(function () {
    var tool = {
        title: '牛腿设计',
        sub: '钢筋混凝土牛腿（a/h<sub>0</sub> ≤ 1 短牛腿） · GB/T 50010-2010（2024年版） 第 9.3 章',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '9.3',
            limitations: 'a/h0≤1的短牛腿，钢筋混凝土',
            unit: 'Fv:kN, As:mm², a,h0:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">牛腿尺寸与柱</div>' +
                '<form id="f-co"><div class="grid2">' +
                numField('co_b', '牛腿宽度 b', 'mm', 400, '牛腿沿柱宽方向的宽度，一般等于柱宽') +
                numField('co_h', '牛腿总高度 h', 'mm', 800, '牛腿根部总高度（从牛腿底面到牛腿顶面）') +
                numField('co_h0', '牛腿有效高度 h<sub>0</sub>', 'mm', 760, '受拉钢筋合力点到受压边缘距离') +
                numField('co_a', '牛腿外伸长度 a', 'mm', 300, '从柱边到牛腿外缘的水平距离') +
                numField('co_c', '牛腿外端高度 c', 'mm', 200, '牛腿外边缘高度，一般不小于 h/3 且 ≥ 200mm') +
                numField('co_bc', '柱截面宽 b<sub>c</sub>', 'mm', 400) +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">荷载与材料</div><div class="grid2">' +
                numField('co_Fv', '竖向力设计值 F<sub>v</sub>', 'kN', 600, '作用在牛腿顶面的竖向力设计值') +
                numField('co_Fh', '水平拉力设计值 F<sub>h</sub>', 'kN', 50, '吊车梁等传来的水平拉力，无则填 0') +
                numField('co_Fvk', '竖向力标准值 F<sub>vk</sub>', 'kN', 450) +
                selField('co_con', '混凝土强度等级', conOpts('C30')) +
                selField('co_reb', '纵筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                selField('co_stir', '箍筋/弯筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HPB300',t:'HPB300'}], 'HRB400')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="co_calc">牛腿设计验算</button>' +
                '<button type="button" class="btn btn-secondary" id="co_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">牛腿设计验算结果</div><div id="co_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="co_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('co_result');
                var proc = document.getElementById('co_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }

                var b = parseFloat(document.getElementById('co_b').value);
                var h = parseFloat(document.getElementById('co_h').value);
                var h0 = parseFloat(document.getElementById('co_h0').value);
                var a = parseFloat(document.getElementById('co_a').value);
                var c = parseFloat(document.getElementById('co_c').value);
                var bc = parseFloat(document.getElementById('co_bc').value);
                var Fv = parseFloat(document.getElementById('co_Fv').value);
                var Fh = parseFloat(document.getElementById('co_Fh').value) || 0;
                var Fvk = parseFloat(document.getElementById('co_Fvk').value) || Fv / 1.3;
                var con = CONCRETE[document.getElementById('co_con').value];
                var reb = REBAR_FLEX[document.getElementById('co_reb').value];
                var stir = REBAR_STIRRUP[document.getElementById('co_stir').value] || { fy: 360 };

                if (!(b > 0 && h > 0 && h0 > 0)) return err('牛腿尺寸必须为正数。');
                if (h0 >= h) return err('有效高度 h<sub>0</sub> 应小于总高度 h。');
                if (!(a > 0)) return err('外伸长度必须为正数。');
                if (!(Fv > 0)) return err('竖向力必须为正数。');

                var ft = con.ft, ftk = con.ftk, fc = con.fc;
                var fy = reb.fy, fyv = stir.fy;
                var a_h0 = a / h0; // a/h0 比值

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　b = ' + b + ' mm，h = ' + h + ' mm，h<sub>0</sub> = ' + h0 + ' mm，a = ' + a + ' mm；a/h<sub>0</sub> = ' + fmt(a_h0, 3) + '（' + (a_h0 <= 1 ? '短牛腿' : '长牛腿，按悬臂梁') + '）；F<sub>v</sub> = ' + Fv + ' kN，F<sub>h</sub> = ' + Fh + ' kN；f<sub>tk</sub> = ' + ftk + ' N/mm²，f<sub>y</sub> = ' + fy + ' N/mm²。</div>');

                // 牛腿截面尺寸验算（9.3.1 条）：裂缝控制条件
                // F_vk / (b * h_0) ≤ β * f_tk / (0.5 + a / h_0)
                // β：承受重级工作制吊车的牛腿取 0.65，其他取 0.8
                var beta = 0.8; // 一般情况
                var ft_limit = beta * ftk / (0.5 + a_h0); // N/mm²
                var sigma_vk = Fvk * 1000 / (b * h0); // N/mm²
                var sizeOk = sigma_vk <= ft_limit;

                st.push('<div class="step"><b>② 牛腿截面尺寸验算（裂缝控制，9.3.1 条）</b>　β = ' + beta + '（一般牛腿）；控制应力 = β·f<sub>tk</sub>/(0.5 + a/h<sub>0</sub>) = ' + beta + '×' + ftk + '/(' + fmt(0.5 + a_h0, 3) + ') = <b>' + fmt(ft_limit, 2) + ' N/mm²</b></div>');
                st.push('<div class="step"><b>　计算值</b>　σ = F<sub>vk</sub>/(b·h<sub>0</sub>) = ' + fmt(sigma_vk, 3) + ' N/mm² ' + (sizeOk ? '≤' : '＞') + ' 限值 ⇒ ' + (sizeOk ? '截面尺寸满足' : '不满足，应加大牛腿高度') + tag(sizeOk ? 'ok' : 'err', sizeOk ? '满足' : '不满足') + '</div>');

                // 纵向受力钢筋（9.3.2 条）
                // 竖向力产生的受拉钢筋：A_s >= F_v * a / (0.85 * f_y * h_0)  （按三角形桁架模型）
                // 水平拉力产生的：A_s1 = F_h / f_y
                // 总纵筋 = 竖向力产生的 + 水平拉力产生的
                // 当 a < 0.3h0 时，取 a = 0.3h0
                var a_eff = Math.max(a, 0.3 * h0);
                var As_v = Fv * 1000 * a_eff / (0.85 * fy * h0); // mm²
                var As_h = Fh * 1000 / fy; // mm²
                var As_total = As_v + As_h; // 总受拉纵筋

                // 最小配筋率：纵筋按 0.2% 和 45ft/fy% 的较大值，按全截面 b*h
                var rho_min = rhoMinFlex(ft, fy).rho;
                var As_min = rho_min * b * h;
                if (As_total < As_min) As_total = As_min;
                var rebarOk = As_total >= As_min;

                st.push('<div class="step"><b>③ 纵向受力钢筋（9.3.2 条）</b>　有效计算高度 a = max(a, 0.3h<sub>0</sub>) = ' + fmt(a_eff, 0) + ' mm</div>');
                st.push('<div class="step"><b>　竖向力产生的纵筋</b>　A<sub>s,v</sub> = F<sub>v</sub>·a / (0.85 f<sub>y</sub> h<sub>0</sub>) = ' + fmt(As_v, 0) + ' mm²</div>');
                if (Fh > 0) st.push('<div class="step"><b>　水平拉力产生的纵筋</b>　A<sub>s,h</sub> = F<sub>h</sub>/f<sub>y</sub> = ' + fmt(As_h, 0) + ' mm²</div>');
                st.push('<div class="step"><b>　总纵筋面积</b>　A<sub>s,total</sub> = A<sub>s,v</sub> + A<sub>s,h</sub> = <b>' + fmt(As_total, 0) + ' mm²</b>（含最小配筋率 ρ<sub>min</sub> = ' + fmt(rho_min*100, 3) + '%，A<sub>s,min</sub> = ' + fmt(As_min, 0) + ' mm²）</div>');

                // 水平箍筋（9.3.7 条）：直径不小于 8mm，间距 100~150mm，上 2/3 高度范围内
                // 面积不少于承受竖向力的纵筋的 1/2
                var stirrup_req = As_v * 0.5; // 箍筋总面积（按牛腿高度范围内水平箍筋总量的近似）
                // 简化：给出建议直径和间距
                var stir_d = 8, stir_s = 100;
                var stir_total = 2 * Math.PI * stir_d * stir_d / 4 * Math.floor(h * 2 / 3 / stir_s); // 近似 2 肢箍

                st.push('<div class="step"><b>④ 水平箍筋（9.3.7 条）</b>　直径 ≥ 8mm，间距 100~150mm，在上部 2h/3 范围内，面积 ≥ 竖向力纵筋的 1/2 = ' + fmt(As_v/2, 0) + ' mm²。建议 φ8@100 双肢箍（上部约 ' + fmt(Math.floor(h*2/3/stir_s)) + ' 道，总面积 ≈ ' + fmt(stir_total, 0) + ' mm²）。</div>');

                // 弯起钢筋（当 a/h0 ≥ 0.3 时宜配置）
                if (a_h0 >= 0.3) {
                    var As_bend = As_v * 0.5; // 弯起钢筋面积一般 ≈ 1/2 As_v
                    st.push('<div class="step"><b>⑤ 弯起钢筋（a/h<sub>0</sub> ≥ 0.3 宜配置）</b>　面积 A<sub>s,bend</sub> ≈ (1/2~2/3)A<sub>s,v</sub> ≈ <b>' + fmt(As_bend, 0) + ' mm²</b>，角度 45°~60°。</div>');
                }

                var totalOk = sizeOk && rebarOk;
                st.push('<div class="step"><b>⑥ 结论</b>　牛腿截面尺寸 ' + (sizeOk ? '满足' : '不满足') + '；纵筋面积 ' + (rebarOk ? '满足' : '不满足') + ' 最小配筋率要求。</div>');

                // 推荐纵筋
                function recBars(As) {
                    var ds = [12, 14, 16, 18, 20, 22, 25, 28];
                    var best = null;
                    for (var i = 0; i < ds.length; i++) {
                        var d = ds[i];
                        var a1 = Math.PI * d * d / 4;
                        for (var n = 2; n <= 8; n++) {
                            if (a1 * n >= As) {
                                if (!best || a1 * n < best.a) best = { d: d, n: n, a: a1 * n };
                                break;
                            }
                        }
                    }
                    return best ? best.n + 'φ' + best.d + ' = ' + fmt(best.a, 0) + ' mm²' : '—';
                }

                var html = resultRow('a / h<sub>0</sub> 比值', fmt(a_h0, 3) + '（' + (a_h0 <= 0.3 ? '小牛腿' : a_h0 <= 1 ? '短牛腿' : '长牛腿') + '）');
                html += resultRow('牛腿截面尺寸验算（裂缝控制）', badge(sizeOk ? 'badge-ok' : 'badge-err', sizeOk ? '满足（σ ≤ βf<sub>tk</sub>/(0.5+a/h₀)）' : '不满足，应增大牛腿高度'));
                html += resultRow('竖向力产生纵筋 A<sub>s,v</sub>', fmt(As_v, 0) + ' mm²');
                if (Fh > 0) html += resultRow('水平拉力产生纵筋 A<sub>s,h</sub>', fmt(As_h, 0) + ' mm²');
                html += resultRow('总受拉纵筋 A<sub>s,total</sub>', '<span class="highlight">' + fmt(As_total, 0) + ' mm²</span>');
                html += resultRow('最小配筋 A<sub>s,min</sub>', fmt(As_min, 0) + ' mm²（ρ<sub>min</sub> = ' + fmt(rho_min*100, 3) + '%）');
                html += resultRow('纵筋推荐', recBars(As_total));
                html += resultRow('水平箍筋建议', 'φ8@100 双肢箍（上部 2h/3 范围）');
                if (a_h0 >= 0.3) html += resultRow('弯起钢筋建议', '约 ' + fmt(As_v*0.5, 0) + ' mm²（45°~60°）');
                html += resultRow('总体判定', badge(totalOk ? 'badge-ok' : 'badge-err', totalOk ? '牛腿设计满足' : '不满足，应调整尺寸或配筋'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._CO_RESULT = {
                    b: b, h: h, h0: h0, a: a, c: c, bc: bc,
                    Fv: Fv, Fh: Fh, Fvk: Fvk, a_h0: a_h0,
                    conGrade: document.getElementById('co_con').value,
                    rebGrade: document.getElementById('co_reb').value,
                    sizeOk: sizeOk, ft_limit: ft_limit, sigma_vk: sigma_vk,
                    As_v: As_v, As_h: As_h, As_total: As_total, As_min: As_min,
                    rho_min: rho_min, rebarOk: rebarOk, totalOk: totalOk
                };
            }

            document.getElementById('co_calc').addEventListener('click', calc);
            document.getElementById('co_reset').addEventListener('click', function () {
                var f = document.getElementById('f-co'); f.reset();
                document.getElementById('co_b').value = 400;
                document.getElementById('co_h').value = 800;
                document.getElementById('co_h0').value = 760;
                document.getElementById('co_a').value = 300;
                document.getElementById('co_c').value = 200;
                document.getElementById('co_bc').value = 400;
                document.getElementById('co_Fv').value = 600;
                document.getElementById('co_Fh').value = 50;
                document.getElementById('co_Fvk').value = 450;
                calc();
            });
            document.getElementById('f-co').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['corbel'] = tool;
})();
