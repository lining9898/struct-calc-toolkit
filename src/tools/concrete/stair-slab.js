(function () {
    var tool = {
        title: '板式楼梯计算',
        sub: '梯段斜板 + 平台板 · 内力与配筋 · GB 50009 / GB 50010',
        meta: {
            standard: 'GB 50009-2012 + GB/T 50010-2010（2024年版）',
            formulaSource: '6.2.10',
            limitations: '板式楼梯，梯段斜板+平台板，简支假定',
            unit: 'M:kN·m/m, As:mm²/m',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">几何尺寸</div>' +
                '<form id="f-stair"><div class="grid2">' +
                numField('st_Ln', '梯段水平投影跨度 L<sub>n</sub>', 'm', 3.6) +
                numField('st_b', '楼梯板宽度 b', 'mm', 1200) +
                numField('st_t', '踏步宽度 b<sub>s</sub>', 'mm', 280) +
                numField('st_r', '踏步高度 h<sub>s</sub>', 'mm', 160) +
                numField('st_d', '梯板厚度 δ', 'mm', 120, '板式楼梯梯板厚度一般取 L<sub>n</sub>/25 ~ L<sub>n</sub>/30') +
                numField('st_as', '受拉筋合力点距离 a<sub>s</sub>', 'mm', 20) +
                numField('st_pL', '平台板跨度 L<sub>p</sub>', 'm', 1.2, '平台板简支在平台梁和梯段板之间的水平跨度') +
                numField('st_ph', '平台板厚度 h<sub>p</sub>', 'mm', 100) +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">荷载与材料</div><div class="grid2">' +
                numField('st_gk_floor', '楼面面层自重 g<sub>k1</sub>', 'kN/m²', 0.5, '地砖+水泥砂浆等，按水平投影面计') +
                numField('st_gk_step', '踏步及抹灰自重 g<sub>k2</sub>', 'kN/m²', 3.0, '梯段踏步+底板抹灰，按水平投影面计') +
                numField('st_gk_slab', '梯板自重 g<sub>k3</sub>', 'kN/m²', 2.5, '斜板自重按水平投影：γ·δ·√(1+(r/b)²)') +
                numField('st_qk', '活荷载 q<sub>k</sub>', 'kN/m²', 3.5, '住宅 2.0；公共建筑 3.5；消防疏散 3.5') +
                numField('st_gG', '恒载分项系数 γ<sub>G</sub>', '—', 1.3) +
                numField('st_gQ', '活载分项系数 γ<sub>Q</sub>', '—', 1.5) +
                selField('st_con', '混凝土强度等级', conOpts('C30')) +
                selField('st_reb', '钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="st_calc">计算楼梯配筋</button>' +
                '<button type="button" class="btn btn-secondary" id="st_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">梯段斜板（控制截面）</div><div id="st_slope"></div></div>' +
                '<div class="panel"><div class="panel-title">平台板</div><div id="st_plat"></div></div>' +
                '<div class="panel"><div class="panel-title">梯梁验算提示</div><div id="st_beam"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="st_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var outS = document.getElementById('st_slope');
                var outP = document.getElementById('st_plat');
                var outB = document.getElementById('st_beam');
                var proc = document.getElementById('st_proc');
                function err(m) { outS.innerHTML = '<div class="error-box">' + m + '</div>'; outP.innerHTML = ''; outB.innerHTML = ''; proc.innerHTML = ''; return; }

                var Ln = parseFloat(document.getElementById('st_Ln').value);
                var bW = parseFloat(document.getElementById('st_b').value);
                var bs = parseFloat(document.getElementById('st_t').value);
                var hs = parseFloat(document.getElementById('st_r').value);
                var delta = parseFloat(document.getElementById('st_d').value);
                var asV = parseFloat(document.getElementById('st_as').value);
                var Lp = parseFloat(document.getElementById('st_pL').value);
                var hp = parseFloat(document.getElementById('st_ph').value);
                var gk1 = parseFloat(document.getElementById('st_gk_floor').value);
                var gk2 = parseFloat(document.getElementById('st_gk_step').value);
                var gk3 = parseFloat(document.getElementById('st_gk_slab').value);
                var qk = parseFloat(document.getElementById('st_qk').value);
                var gG = parseFloat(document.getElementById('st_gG').value);
                var gQ = parseFloat(document.getElementById('st_gQ').value);
                var con = CONCRETE[document.getElementById('st_con').value];
                var reb = REBAR_FLEX[document.getElementById('st_reb').value];
                var materialError = concreteRebarError(con, reb);
                if (materialError) return err(materialError);

                if (!(Ln > 0 && bW > 0 && bs > 0 && hs > 0 && delta > 0)) return err('几何尺寸必须为正数。');
                if (!(asV > 0 && asV < delta)) return err('a<sub>s</sub> 应小于梯板厚度。');
                if (!(Lp > 0 && hp > 0)) return err('平台板尺寸必须为正数。');

                var fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var fy = reb.fy, es = reb.es;
                var xi_b = b1 / (1 + fy / (es * ecu));
                var rho_min = rhoMinFlex(ft, fy).rho;
                var b = 1000; // 每延米板带

                // 梯段斜板：斜长系数
                var cosA = bs / Math.sqrt(bs * bs + hs * hs);
                var slantFactor = 1 / cosA; // 斜长 / 水平投影
                var h0 = delta - asV; // 垂直于板面的有效高度
                var AsMin = rho_min * b * delta;

                var st = [];
                st.push('<div class="step"><b>① 几何参数</b>　踏步 b<sub>s</sub>×h<sub>s</sub> = ' + bs + '×' + hs + ' mm；cosα = ' + fmt(cosA,4) + '，斜长系数 = ' + fmt(slantFactor,4) + '；梯板厚 δ = ' + delta + ' mm，h<sub>0</sub> = ' + fmt(h0,0) + ' mm（垂直于板面）。</div>');

                // 荷载（按水平投影面）
                var gk = gk1 + gk2 + gk3; // 恒载标准值 kN/m²（水平投影）
                var qDesign = gG * gk + gQ * qk; // 设计值
                var lineQ = qDesign * (bW / 1000); // 每延米楼梯宽度的线荷载 kN/m
                // 简化：按 1m 宽板带计算
                var qPerM = qDesign; // kN/m² × 1m = kN/m（水平投影方向）

                st.push('<div class="step"><b>② 荷载标准值（水平投影）</b>　g<sub>k</sub> = 面层 + 踏步 + 梯板 = ' + gk1 + ' + ' + gk2 + ' + ' + gk3 + ' = <b>' + fmt(gk,2) + ' kN/m²</b>；q<sub>k</sub> = ' + qk + ' kN/m²；设计值 q = ' + fmt(qDesign,2) + ' kN/m²（基本组合）。</div>');

                // 梯段斜板跨中弯矩：按简支在两端平台梁上，跨中 M = qL²/8
                // 注意：均布荷载按水平投影计，跨度也按水平投影计，直接算
                var M_slope = qDesign * Ln * Ln / 8; // kN·m/m （每延米板带，水平投影跨度）
                // 但实际弯矩作用在与板垂直的截面，h0 是垂直于板的
                // 因为均布荷载按水平投影，需要转换：沿斜向的线荷载 = q / cosα × cosα = q（因为自重沿斜长，已经等效到水平投影了）
                // 简化处理：工程上常直接按水平投影的 q 和 Ln 算 M，h0 用板的有效高度（垂直板面），足够精确

                st.push('<div class="step"><b>③ 梯段斜板跨中弯矩</b>　按两端简支的斜板：M<sub>max</sub> = q·L<sub>n</sub>²/8 = ' + fmt(qDesign,2) + '×' + fmt(Ln,2) + '²/8 = <b>' + fmt(M_slope,3) + ' kN·m/m</b>（每延米板带）。</div>');

                // 配筋
                function calcAs(M, h0v) {
                    var Mabs = Math.abs(M) * 1e6;
                    var alpha_s = Mabs / (a1 * fc * b * h0v * h0v);
                    if (alpha_s >= 0.5) return { As: Infinity, over: true, alpha_s: alpha_s, gamma_s: 0 };
                    var gamma_s = 0.5 * (1 + Math.sqrt(1 - 2 * alpha_s));
                    var As = Mabs / (gamma_s * fy * h0v);
                    var xi = 2 * (1 - gamma_s);
                    var over = xi > xi_b;
                    if (over) As = a1 * fc * b * xi_b * h0v / fy;
                    return { As: As, over: over, alpha_s: alpha_s, gamma_s: gamma_s, xi: xi };
                }

                var r_slope = calcAs(M_slope, h0);

                // 平台板：简支在平台梁和梯段上
                var hp0 = hp - asV;
                var pk_g = gk1 + 25 * hp / 1000; // 平台板自重+面层（近似，25kN/m³）
                var pk_q = qk;
                var pqDesign = gG * pk_g + gQ * pk_q;
                var M_plat = pqDesign * Lp * Lp / 8; // kN·m/m
                var r_plat = calcAs(M_plat, hp0);

                st.push('<div class="step"><b>④ 平台板跨中弯矩</b>　平台板自重+面层 ≈ ' + fmt(pk_g,2) + ' kN/m²；设计值 ' + fmt(pqDesign,2) + ' kN/m²；M<sub>max</sub> = ' + fmt(M_plat,3) + ' kN·m/m。</div>');

                st.push('<div class="step"><b>⑤ 配筋计算</b>　A<sub>s</sub> = M / (γ<sub>s</sub>·f<sub>y</sub>·h<sub>0</sub>)；ρ<sub>min</sub> = max(0.2%, 0.45f<sub>t</sub>/f<sub>y</sub>) = ' + fmt(rho_min*100,3) + '%。</div>');

                // 梯梁简化验算提示
                // 梯梁承受梯段板传来的荷载（一半宽度）+ 梯梁自重
                var beamLoad = qDesign * (bW / 1000) / 2; // 近似：每侧梯梁承受一半宽度的荷载（kN/m）

                // ===== 结果展示 =====
                function recSpacing(As) {
                    var ds = [6, 8, 10, 12, 14, 16];
                    var best = null;
                    for (var i = 0; i < ds.length; i++) {
                        var d = ds[i];
                        var a1 = Math.PI * d * d / 4;
                        var s = a1 / As * 1000;
                        if (s >= 50 && s <= 250) {
                            if (!best || s < best.s) best = { d: d, s: s, a: a1 };
                        }
                    }
                    if (!best) return '—';
                    return 'φ' + best.d + '@' + Math.round(best.s) + ' (' + fmt(1000/best.s * best.a, 0) + ' mm²/m)';
                }
                function row(loc, M, h0v, r) {
                    var rhoPct = (r.As / (b * (loc.indexOf('平台') >= 0 ? hp : delta))) * 100;
                    var ok = r.over ? 'err' : (r.As >= AsMin ? 'ok' : 'warn');
                    var txt = r.over ? '超筋' : (r.As >= AsMin ? '满足' : '配筋不足');
                    var cls = ok === 'ok' ? 'badge-ok' : ok === 'err' ? 'badge-err' : 'badge-warn';
                    return '<tr><td>' + loc + '</td><td>' + fmt(M, 3) + '</td><td>' + fmt(h0v, 0) + '</td>' +
                        '<td style="font-weight:600;color:#2563eb;">' + (r.over ? '超筋' : fmt(r.As, 0)) + '</td>' +
                        '<td>' + fmt(rhoPct, 3) + '%</td><td>' + fmt(rho_min*100, 3) + '%</td>' +
                        '<td>' + badge(cls, txt) + '</td>' +
                        '<td>' + (r.over ? '—' : recSpacing(r.As)) + '</td></tr>';
                }

                var sHtml = '<div style="overflow-x:auto;"><table class="mini"><tr><th>位置</th><th>M (kN·m/m)</th><th>h<sub>0</sub> (mm)</th><th>所需 A<sub>s</sub> (mm²/m)</th><th>配筋率 ρ</th><th>ρ<sub>min</sub></th><th>判定</th><th>推荐配筋</th></tr>';
                sHtml += row('梯段跨中（底部受拉）', M_slope, h0, r_slope);
                sHtml += '</table></div>';
                sHtml += '<div style="margin-top:8px;font-size:12.5px;color:#64748b;">分布筋：φ6@250 或 φ6@200，垂直于受力筋方向；踏步内建议配置 φ6@300 构造筋。</div>';
                outS.innerHTML = sHtml;

                var pHtml = '<div style="overflow-x:auto;"><table class="mini"><tr><th>位置</th><th>M (kN·m/m)</th><th>h<sub>0</sub> (mm)</th><th>所需 A<sub>s</sub> (mm²/m)</th><th>配筋率 ρ</th><th>ρ<sub>min</sub></th><th>判定</th><th>推荐配筋</th></tr>';
                pHtml += row('平台板跨中', M_plat, hp0, r_plat);
                pHtml += '</table></div>';
                pHtml += '<div style="margin-top:8px;font-size:12.5px;color:#64748b;">平台板按简支在两端平台梁上计算；与梯段板连接处应配置适量负弯矩钢筋。</div>';
                outP.innerHTML = pHtml;

                var bHtml = '<div style="font-size:13.5px;color:#334155;line-height:1.8;">';
                bHtml += '<p><b>梯梁简化估算：</b></p>';
                bHtml += '<p>• 梯段板传至一侧梯梁的线荷载（设计值）：约 <b>' + fmt(beamLoad, 2) + ' kN/m</b>（梯宽 ' + bW + ' mm，按一半宽度导荷）</p>';
                bHtml += '<p>• 梯梁截面建议：200×350~250×400 mm，按简支梁计算（跨度等于楼梯间宽度）</p>';
                bHtml += '<p>• 需考虑梯梁自重、平台板传来荷载及抹灰，精确计算建议使用「矩形梁正截面」工具</p>';
                bHtml += '<p style="color:#64748b;font-size:12.5px;margin-top:8px;">提示：本工具给出的梯梁验算为简化估算，正式设计请按实际梯梁跨度、截面与荷载详细计算。</p>';
                bHtml += '</div>';
                outB.innerHTML = bHtml;

                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._ST_RESULT = {
                    Ln: Ln, bW: bW, bs: bs, hs: hs, delta: delta, asV: asV,
                    Lp: Lp, hp: hp, cosA: cosA, slantFactor: slantFactor,
                    gk: gk, qk: qk, gG: gG, gQ: gQ, qDesign: qDesign,
                    M_slope: M_slope, r_slope: r_slope,
                    M_plat: M_plat, r_plat: r_plat,
                    h0: h0, hp0: hp0, AsMin: AsMin, rho_min: rho_min,
                    beamLoad: beamLoad,
                    conGrade: document.getElementById('st_con').value,
                    rebGrade: document.getElementById('st_reb').value
                };
            }

            document.getElementById('st_calc').addEventListener('click', calc);
            document.getElementById('st_reset').addEventListener('click', function () {
                var f = document.getElementById('f-stair'); f.reset();
                calc();
            });
            document.getElementById('f-stair').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['stair-slab'] = tool;
})();
