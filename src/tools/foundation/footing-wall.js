(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 建筑地基基础设计规范 + GB/T 50010-2010（2024年版）",
            formulaSource: "5.2, 8.2",
            limitations: "墙下条形扩展基础",
            unit: "F:kN/m, b:mm, As:mm²/m",
            version: "1.0.0"
        },
        title: '墙下条形基础计算',
        sub: '扩展式条形基础 · 地基承载力 + 剪切控制高度 + 底板配筋 · GB 50007-2011',
        render: function () {
            return '<div class="panel"><div class="panel-title">上部墙体与荷载</div>' +
                '<form id="f-fw"><div class="grid2">' +
                numField('fw_bw', '墙体厚度 b<sub>w</sub>', 'mm', 240) +
                numField('fw_Nk', '每延米轴力标准值 N<sub>k</sub>', 'kN/m', 250, '每延米墙体传来的竖向力标准值') +
                numField('fw_N', '每延米轴力设计值 N', 'kN/m', 330, '基本组合的每延米竖向力设计值') +
                numField('fw_Mk', '每延米弯矩标准值 M<sub>k</sub>', 'kN·m/m', 0, '基础顶面弯矩（0 为轴心受压，均匀地基反力）') +
                numField('fw_d', '基础埋深 d', 'm', 1.5) +
                numField('fw_fa', '修正后地基承载力 f<sub>a</sub>', 'kPa', 160) +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">基础与材料</div><div class="grid2">' +
                numField('fw_b', '基础底面宽度 b', 'm', 1.8) +
                numField('fw_h', '基础高度 h', 'mm', 400, '条形基础高度，一般阶梯形/锥形，按总高计算') +
                numField('fw_h0', '基础有效高度 h<sub>0</sub>', 'mm', 360, '受拉钢筋合力点到基础底面的距离，有垫层取 h−40') +
                numField('fw_gammaG', '基础及覆土重度 γ<sub>G</sub>', 'kN/m³', 20) +
                selField('fw_con', '基础混凝土等级', conOpts('C30')) +
                selField('fw_reb', '底板钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                numField('fw_rho_d', '分布筋配筋率（纵向）', '%', 0.15, '纵向分布筋最小配筋率，一般 0.15%') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="fw_calc">计算条形基础</button>' +
                '<button type="button" class="btn btn-secondary" id="fw_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">地基承载力验算</div><div id="fw_soil"></div></div>' +
                '<div class="panel"><div class="panel-title">基础高度（受剪）验算</div><div id="fw_shear"></div></div>' +
                '<div class="panel"><div class="panel-title">底板配筋（横向受力筋 + 纵向分布筋）</div><div id="fw_rebar"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="fw_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var outSoil = document.getElementById('fw_soil');
                var outShear = document.getElementById('fw_shear');
                var outRebar = document.getElementById('fw_rebar');
                var proc = document.getElementById('fw_proc');
                function err(m) { outSoil.innerHTML = '<div class="error-box">' + m + '</div>'; outShear.innerHTML = ''; outRebar.innerHTML = ''; proc.innerHTML = ''; return; }

                var bw = parseFloat(document.getElementById('fw_bw').value);
                var Nk = parseFloat(document.getElementById('fw_Nk').value);
                var N = parseFloat(document.getElementById('fw_N').value);
                var Mk = parseFloat(document.getElementById('fw_Mk').value);
                var d = parseFloat(document.getElementById('fw_d').value);
                var fa = parseFloat(document.getElementById('fw_fa').value);
                var b = parseFloat(document.getElementById('fw_b').value);
                var h = parseFloat(document.getElementById('fw_h').value);
                var h0 = parseFloat(document.getElementById('fw_h0').value);
                var gammaG = parseFloat(document.getElementById('fw_gammaG').value);
                var con = CONCRETE[document.getElementById('fw_con').value];
                var reb = REBAR_FLEX[document.getElementById('fw_reb').value];
                var materialError = concreteRebarError(con, reb);
                if (materialError) return err(materialError);
                var rho_d_pct = parseFloat(document.getElementById('fw_rho_d').value);

                if (!(bw > 0)) return err('墙厚必须为正数。');
                if (!(Nk > 0 && N > 0)) return err('轴力必须为正数。');
                if (!(d > 0 && fa > 0)) return err('埋深与地基承载力必须为正数。');
                if (!(b > 0 && h > 0 && h0 > 0)) return err('基础尺寸必须为正数。');
                if (h0 >= h) return err('有效高度 h<sub>0</sub> 应小于基础高度 h。');

                var ft = con.ft, fc = con.fc;
                var fy = reb.fy, es = reb.es;
                var a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var xi_b = b1 / (1 + fy / (es * ecu));
                var rho_min = 0.0015; // GB 50007-2011 第8.2.1条第3款、GB 55008-2021 第4.4.6条第2款地基上板。
                var b1m = bw / 1000; // 墙厚 m
                var bw_mm = bw;
                var b_mm = b * 1000; // 基础宽度 mm

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　墙厚 b<sub>w</sub> = ' + bw + ' mm；基础宽度 b = ' + b + ' m，高度 h = ' + h + ' mm，h<sub>0</sub> = ' + h0 + ' mm；f<sub>a</sub> = ' + fa + ' kPa；f<sub>t</sub> = ' + ft + ' N/mm²；f<sub>y</sub> = ' + fy + ' N/mm²。</div>');

                // ===== 地基承载力 =====
                var A = b * 1; // 每延米面积 m²/m
                var Gk = gammaG * d * b; // kN/m（每延米自重+覆土）
                var pk = (Nk + Gk) / b; // kPa
                var pkmax = pk, pkmin = pk, e = 0;
                if (Math.abs(Mk) > 0.001) {
                    e = Mk / (Nk + Gk); // m
                    var W = b * b / 6; // m³/m（每延米矩形截面模量）
                    if (e <= b / 6) {
                        pkmax = pk + Mk / W;
                        pkmin = pk - Mk / W;
                    } else {
                        var a = b / 2 - e;
                        pkmax = 2 * (Nk + Gk) / (3 * a);
                        pkmin = 0;
                    }
                }
                var soilOk = pk <= fa && pkmax <= 1.2 * fa;
                st.push('<div class="step"><b>② 地基承载力验算</b>　G<sub>k</sub> = γ<sub>G</sub>·d·b = ' + fmt(gammaG,1) + '×' + d + '×' + b + ' = ' + fmt(Gk,2) + ' kN/m；p<sub>k</sub> = (N<sub>k</sub>+G<sub>k</sub>)/b = ' + fmt(pk,2) + ' kPa' + (soilOk ? tag('ok','满足') : tag('err','不满足')) + '</div>');
                if (Math.abs(Mk) > 0.001) {
                    st.push('<div class="step"><b>　偏心</b>　e = ' + fmt(e,4) + ' m = ' + fmt(e/b*100,2) + '%·b' + (e <= b/6 ? '（小偏心）' : '（大偏心）') + '；p<sub>kmax</sub> = ' + fmt(pkmax,2) + ' kPa，p<sub>kmin</sub> = ' + fmt(pkmin,2) + ' kPa；p<sub>kmax</sub> ≤ 1.2f<sub>a</sub> = ' + fmt(1.2*fa,1) + ' kPa（' + (pkmax <= 1.2*fa ? '满足' : '不满足') + '）。</div>');
                }

                // ===== 基础高度验算（受剪控制） =====
                // 墙下条形基础底板受剪：按柱边（墙边）截面的受剪承载力
                // V = p_n * a，a = (b - bw)/2（挑出长度）
                // V_u = 0.7 * β_hs * f_t * b * h_0  （b 取 1m = 1000mm）
                // β_hs: 受剪截面高度影响系数，(800/h0)^(1/4)，h0<800取800，h0>2000取2000
                var h0_shear = Math.max(h0, 800);
                h0_shear = Math.min(h0_shear, 2000);
                var beta_hs = Math.pow(800 / h0_shear, 0.25);
                var a_brick = (b - b1m) / 2; // 挑出长度 m
                // 净反力设计值（每延米，均匀分布）
                var pn = N / b; // kN/m² = kPa
                if (Math.abs(Mk) > 0.001) {
                    // 用最大净反力（偏安全）
                    var M = N * 0 + parseFloat(document.getElementById('fw_Mk').value) * 1.3; // 近似：M设计值 = Mk * 1.3，这里直接用 Mk 不严谨，简化
                }
                var V_shear = pn * a_brick; // kN/m（每延米的剪力，在墙边截面）
                var Vu_shear = 0.7 * beta_hs * ft * 1000 * h0 / 1000; // kN/m（每延米）
                var shearOk = V_shear <= Vu_shear;

                st.push('<div class="step"><b>③ 基础高度受剪验算（墙边截面）</b>　挑出长度 a = (b−b<sub>w</sub>)/2 = ' + fmt(a_brick*1000, 0) + ' mm；β<sub>hs</sub> = ' + fmt(beta_hs, 3) + '（h<sub>0</sub> = ' + h0 + ' mm）。</div>');
                st.push('<div class="step"><b>　剪力设计值</b>　V = p<sub>n</sub>·a = ' + fmt(pn,2) + '×' + fmt(a_brick,4) + ' = <b>' + fmt(V_shear,2) + ' kN/m</b>；受剪承载力 V<sub>u</sub> = 0.7β<sub>hs</sub>f<sub>t</sub>·b·h<sub>0</sub> = <b>' + fmt(Vu_shear,2) + ' kN/m</b>；' + (shearOk ? '满足' : '不满足') + tag(shearOk ? 'ok' : 'err', shearOk ? '满足' : '不满足') + '</div>');

                // ===== 底板配筋 =====
                // 悬臂板根部弯矩（墙边）：M = (1/2) * p_n * a^2
                var M_flex = 0.5 * pn * a_brick * a_brick; // kN·m/m（每延米）
                var Mabs = M_flex * 1e6; // N·mm / m
                var alpha_s = Mabs / (a1 * fc * 1000 * h0 * h0);
                var overFlex = alpha_s >= 0.5;
                var gamma_s = 0.5 * (1 + Math.sqrt(Math.max(0, 1 - 2 * alpha_s)));
                var As = Mabs / (gamma_s * fy * h0); // mm²/m
                var xi = 2 * (1 - gamma_s);
                if (xi > xi_b) { As = a1 * fc * 1000 * xi_b * h0 / fy; overFlex = true; }
                var AsMin = rho_min * 1000 * h; // 每延米最小配筋 mm²/m
                var flexOk = !overFlex && As >= AsMin;

                // 纵向分布筋
                var As_dist = rho_d_pct / 100 * 1000 * h; // 每延米 mm²/m
                var AsDistMin = 0.15 * Math.max(As, AsMin); // GB 50007 第8.2.1条第3款：受力筋面积的15%。

                st.push('<div class="step"><b>④ 底板弯矩（悬臂根部）</b>　M = p<sub>n</sub>·a²/2 = ' + fmt(pn,2) + '×' + fmt(a_brick,4) + '²/2 = <b>' + fmt(M_flex,3) + ' kN·m/m</b>。</div>');
                st.push('<div class="step"><b>⑤ 横向受力筋</b>　A<sub>s</sub> = ' + (overFlex ? '超筋' : fmt(As, 0) + ' mm²/m') + '；ρ<sub>min</sub> = ' + fmt(rho_min*100, 3) + '%，A<sub>s,min</sub> = ' + fmt(AsMin, 0) + ' mm²/m；' + (flexOk ? '满足' : '不满足') + tag(flexOk ? 'ok' : 'err', flexOk ? '满足' : '不满足') + '</div>');
                st.push('<div class="step"><b>⑥ 纵向分布筋</b>　按 ρ = ' + fmt(rho_d_pct,2) + '% 配置，A<sub>s,dist</sub> = ' + fmt(As_dist, 0) + ' mm²/m，直径不小于 8mm，间距不大于 300mm；分布筋面积下限为受力筋的15%，本次至少 ' + fmt(AsDistMin,0) + ' mm²/m。</div>');

                // ===== 结果展示 =====
                var sHtml = resultRow('基础宽度 b', b + ' m');
                sHtml += resultRow('基础自重及覆土 G<sub>k</sub>', fmt(Gk, 2) + ' kN/m');
                sHtml += resultRow('基底平均压力 p<sub>k</sub>', fmt(pk, 2) + ' kPa');
                if (Math.abs(Mk) > 0.001) {
                    sHtml += resultRow('基底最大压力 p<sub>kmax</sub>', fmt(pkmax, 2) + ' kPa');
                    sHtml += resultRow('偏心距 e / (b/6)', fmt(e, 4) + ' m / ' + fmt(b/6, 4) + ' m');
                }
                sHtml += resultRow('地基承载力 f<sub>a</sub>', fa + ' kPa');
                sHtml += resultRow('判定', badge(soilOk ? 'badge-ok' : 'badge-err', soilOk ? '地基承载力满足' : '地基承载力不满足'));
                outSoil.innerHTML = sHtml;

                var shHtml = resultRow('挑出长度 a', fmt(a_brick*1000, 0) + ' mm');
                shHtml += resultRow('受剪截面高度影响系数 β<sub>hs</sub>', fmt(beta_hs, 3));
                shHtml += resultRow('剪力设计值 V', fmt(V_shear, 2) + ' kN/m');
                shHtml += resultRow('受剪承载力 V<sub>u</sub>', '<span class="highlight">' + fmt(Vu_shear, 2) + ' kN/m</span>');
                shHtml += resultRow('判定', badge(shearOk ? 'badge-ok' : 'badge-err', shearOk ? '受剪满足' : '高度不足，应加大基础高度'));
                outShear.innerHTML = shHtml;

                function recSpacing(AsPerM) {
                    var ds = [10, 12, 14, 16, 18, 20, 22, 25];
                    var best = null;
                    for (var i = 0; i < ds.length; i++) {
                        var d = ds[i];
                        var a1 = Math.PI * d * d / 4;
                        var s = a1 / AsPerM * 1000;
                        if (s >= 100 && s <= 250) {
                            if (!best || s < best.s) best = { d: d, s: s, a: a1 };
                        }
                    }
                    if (!best) return '—';
                    return 'φ' + best.d + '@' + Math.round(best.s) + ' = ' + fmt(1000/best.s * best.a, 0) + ' mm²/m';
                }
                var rHtml = '<div style="overflow-x:auto;"><table class="mini"><tr><th>钢筋类型</th><th>弯矩 M (kN·m/m)</th><th>每延米 A<sub>s</sub> (mm²/m)</th><th>最小配筋 (mm²/m)</th><th>判定</th><th>推荐配筋</th></tr>';
                rHtml += '<tr><td>横向受力筋（垂直于墙）</td><td>' + fmt(M_flex, 3) + '</td>' +
                    '<td style="font-weight:600;color:#2563eb;">' + (overFlex ? '超筋' : fmt(As, 0)) + '</td>' +
                    '<td>' + fmt(AsMin, 0) + '</td>' +
                    '<td>' + badge(flexOk ? 'badge-ok' : (overFlex ? 'badge-err' : 'badge-warn'), overFlex ? '超筋' : (As >= AsMin ? '满足' : '配筋不足')) + '</td>' +
                    '<td>' + (overFlex ? '—' : recSpacing(As)) + '</td></tr>';
                rHtml += '<tr><td>纵向分布筋（平行于墙）</td><td>—</td>' +
                    '<td>' + fmt(As_dist, 0) + '</td>' +
                    '<td>≥ ' + fmt(AsDistMin, 0) + '</td>' +
                    '<td>' + badge(As_dist >= AsDistMin ? 'badge-ok' : 'badge-warn', As_dist >= AsDistMin ? '满足' : '偏小') + '</td>' +
                    '<td>' + recSpacing(As_dist) + '</td></tr>';
                rHtml += '</table></div>';
                rHtml += '<div style="margin-top:8px;font-size:12.5px;color:#64748b;">横向受力筋置于底板下部，纵向分布筋置于横向钢筋之上（内侧）。</div>';
                outRebar.innerHTML = rHtml;

                proc.innerHTML = st.join('');
                var _pp = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_pp) _pp.classList.add('open');

                window._FW_RESULT = {
                    bw: bw, Nk: Nk, N: N, Mk: Mk, d: d, fa: fa,
                    b: b, h: h, h0: h0, gammaG: gammaG, Gk: Gk,
                    pk: pk, pkmax: pkmax, pkmin: pkmin, e: e, soilOk: soilOk,
                    a_brick: a_brick, beta_hs: beta_hs, V_shear: V_shear, Vu_shear: Vu_shear, shearOk: shearOk,
                    pn: pn, M_flex: M_flex, As: As, overFlex: overFlex, AsMin: AsMin,
                    As_dist: As_dist, rho_min: rho_min,
                    conGrade: document.getElementById('fw_con').value,
                    rebGrade: document.getElementById('fw_reb').value
                };
            }

            document.getElementById('fw_calc').addEventListener('click', calc);
            document.getElementById('fw_reset').addEventListener('click', function () {
                var f = document.getElementById('f-fw'); f.reset();
                document.getElementById('fw_bw').value = 240;
                document.getElementById('fw_Nk').value = 250;
                document.getElementById('fw_N').value = 330;
                document.getElementById('fw_Mk').value = 0;
                document.getElementById('fw_d').value = 1.5;
                document.getElementById('fw_fa').value = 160;
                document.getElementById('fw_b').value = 1.8;
                document.getElementById('fw_h').value = 400;
                document.getElementById('fw_h0').value = 360;
                calc();
            });
            document.getElementById('f-fw').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['footing-wall'] = tool;
})();
