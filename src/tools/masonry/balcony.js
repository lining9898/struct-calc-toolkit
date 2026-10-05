/* balcony 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '阳台雨篷挑檐计算',
        sub: '悬挑板弯矩剪力 · 抗倾覆验算 · 配筋计算 · GB 50009 / GB 50010 / GB 50003',
        meta: {"standard": "GB 50009-2012 + GB/T 50010-2010（2024年版） + GB 50003-2011", "formulaSource": "—", "limitations": "悬挑板弯矩剪力+抗倾覆+配筋，含施工检修荷载", "unit": "M:kN·m/m, As:mm²/m, L:m", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">悬挑板几何与荷载</div>' +
                '<form id="f-ba"><div class="grid2">' +
                selField('ba_kind', '构件类型', opts([
                    { v: 'canopy', t: '雨篷 / 挑檐（板挑出）' },
                    { v: 'balcony', t: '阳台板（较大挑出）' }
                ], 'canopy')) +
                numField('ba_L', '挑出长度 L', 'mm', 1000) +
                numField('ba_B', '挑板跨度（沿墙）B', 'mm', 2400, '雨篷板沿墙方向的计算单元宽度，如 1m 或开间宽度') +
                numField('ba_h', '板厚 h', 'mm', 100) +
                selField('ba_con', '混凝土等级', conOpts('C30')) +
                selField('ba_reb', '钢筋级别', opts([{v:'HPB300',t:'HPB300'},{v:'HRB400',t:'HRB400'}], 'HRB400')) +
                numField('ba_gk', '永久荷载标准值 g<sub>k</sub>', 'kN/m²', 3.0, '含板自重、粉刷、吊顶等面荷载标准值') +
                numField('ba_qk', '可变荷载标准值 q<sub>k</sub>', 'kN/m²', 2.0, '阳台 2.5，不上人屋面 0.5，上人屋面 2.0') +
                numField('ba_qcon', '施工检修集中荷载', 'kN', 1.0, '雨篷施工或检修集中荷载（GB 50009）') +
                numField('ba_l1', '抗倾覆埋入长度 l₁', 'mm', 1500, '雨篷梁或悬挑板在墙内的锚固长度，用于抗倾覆') +
                numField('ba_bw', '墙厚 b', 'mm', 240) +
                numField('ba_hw', '墙高（抗倾覆用）h<sub>w</sub>', 'mm', 2800, '雨篷梁上方墙体高度，用于抗倾覆荷载计算') +
                numField('ba_brick', '砌体自重', 'kN/m³', 19) +
                numField('ba_floor', '上方楼盖荷载（有利）', 'kN/m²', 3.5, '楼层恒载标准值，抗倾覆有利组合计入') +
                '</div><div class="hint">提示：雨篷施工检修集中荷载沿板宽每隔 2.5~3m 取一个 1.0 kN，验算时与均布活荷载不同时考虑（取不利）。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ba_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ba_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ba_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ba_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ba_result'), proc = document.getElementById('ba_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var kindV = document.getElementById('ba_kind').value;
                var L = parseFloat(document.getElementById('ba_L').value) / 1000; // m
                var B = parseFloat(document.getElementById('ba_B').value) / 1000; // m
                var h = parseFloat(document.getElementById('ba_h').value); // mm
                var conV = document.getElementById('ba_con').value;
                var rebV = document.getElementById('ba_reb').value;
                var gk = parseFloat(document.getElementById('ba_gk').value);
                var qk = parseFloat(document.getElementById('ba_qk').value);
                var qCon = parseFloat(document.getElementById('ba_qcon').value);
                var l1 = parseFloat(document.getElementById('ba_l1').value) / 1000; // m
                var bw = parseFloat(document.getElementById('ba_bw').value) / 1000; // m
                var hw = parseFloat(document.getElementById('ba_hw').value) / 1000; // m
                var brickG = parseFloat(document.getElementById('ba_brick').value);
                var floorLoad = parseFloat(document.getElementById('ba_floor').value);
                if (!(L > 0 && B > 0 && h > 0)) return err('挑出长度、跨度、板厚必须为正数。');
                var con = CONCRETE[conV];
                var fy = (rebV === 'HRB400') ? 360 : 270;
                var st = [];

                // 基本组合：1.2恒 + 1.4活（简化，这里采用基本组合的包络设计值）
                var q1 = 1.2 * gk + 1.4 * qk; // 均布组合 kN/m²
                // 施工检修集中荷载情况：沿挑板跨度每米宽 1 kN（等效均布）
                // 即 qCon 集中荷载作用在板端，弯矩 = P*L
                // 两种组合取不利
                var M1 = 0.5 * q1 * L * L * B; // 均布荷载下总弯矩 kN·m (整个板宽 B)
                var M2 = 1.2 * gk * 0.5 * L * L * B + 1.4 * qCon * L; // 恒载均布 + 施工集中荷载
                var M_design = Math.max(M1, M2);
                var V1 = q1 * L * B; // 均布荷载剪力（支座） kN
                var V2 = 1.2 * gk * L * B + 1.4 * qCon; // 恒载 + 集中荷载 支座剪力
                var V_design = Math.max(V1, V2);
                // 以 1m 宽板带为单位计算配筋
                var qPerM = M_design / B; // kN·m/m
                var VperM = V_design / B; // kN/m

                st.push('<div class="step"><b>① 荷载基本组合与内力</b></div>');
                st.push('<div class="step">　　组合一（均布恒+活）：q = 1.2g + 1.4q = 1.2×' + gk + ' + 1.4×' + qk + ' = ' + fmt(q1,3) + ' kN/m²</div>');
                st.push('<div class="step">　　M₁ = 0.5 qL²·B = 0.5×' + fmt(q1,3) + '×' + fmt(L,2) + '²×' + fmt(B,2) + ' = ' + fmt(M1,2) + ' kN·m</div>');
                st.push('<div class="step">　　组合二（恒+施工检修）：M₂ = 1.2·g·0.5L²·B + 1.4·P·L = ' + fmt(M2,2) + ' kN·m</div>');
                st.push('<div class="step">　　设计弯矩 M = max(M₁, M₂) = <b>' + fmt(M_design, 2) + ' kN·m</b>（沿板宽 B=' + fmt(B,2) + 'm 总弯矩）</div>');
                st.push('<div class="step">　　单位宽度弯矩 m = M/B = <b>' + fmt(qPerM, 2) + ' kN·m/m</b></div>');

                // 配筋计算（单筋矩形截面）
                var h0 = h - 20; // 板 as 约 20mm
                var fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var es = 200000;
                var xib = b1 / (1 + fy / (es * ecu));
                var alphaS = qPerM * 1e6 / (a1 * fc * 1000 * h0 * h0); // 按 1000mm 宽板带
                if (alphaS > 0.5) alphaS = 0.5;
                var gammaS = (1 + Math.sqrt(1 - 2 * alphaS)) / 2;
                var AsPerM = qPerM * 1e6 / (fy * gammaS * h0); // mm²/m
                var xi = 2 * (1 - gammaS);
                var bendOk = xi <= xib;
                // 最小配筋率（受弯，按全截面 bh，0.2% 和 0.45ft/fy 较大者）
                var rhoMin = rhoMinFlex(ft, fy).rho;
                var AsMin = rhoMin * 1000 * h;
                var minOk = AsPerM >= AsMin;
                st.push('<div class="step"><b>② 正截面配筋（单位 1m 板带）</b>　h₀ = ' + fmt(h0,0) + ' mm；' +
                    'α<sub>s</sub> = ' + fmt(alphaS,4) + '；γ<sub>s</sub> = ' + fmt(gammaS,4) + '；' +
                    'A<sub>s</sub> = m/(γ<sub>s</sub>f<sub>y</sub>h₀) = <b>' + fmt(AsPerM, 0) + ' mm²/m</b> ' +
                    (bendOk ? tag('ok','适筋') : tag('err','超筋')) + '</div>');
                st.push('<div class="step">　　最小配筋率 ρ<sub>min</sub> = max(0.2%, 0.45f<sub>t</sub>/f<sub>y</sub>) = ' + fmt(rhoMin*100,3) + '%；' +
                    'A<sub>s,min</sub> = ρ<sub>min</sub>·b·h = ' + fmt(AsMin,0) + ' mm²/m ⇒ ' +
                    (minOk ? '满足' + tag('ok','满足最小配筋') : '不满足' + tag('err','少于最小配筋')) + '</div>');

                // 斜截面受剪（板通常由截面高度控制，一般配箍筋外更常用冲切）
                var Vu_slab = 0.7 * ft * 1000 * h0 / 1000; // kN/m
                var shearOk = VperM <= Vu_slab;
                st.push('<div class="step"><b>③ 斜截面受剪（板）</b>　单位宽度剪力 v = ' + fmt(VperM,2) + ' kN/m；' +
                    'V<sub>c</sub> = 0.7f<sub>t</sub>bh₀ = ' + fmt(Vu_slab,2) + ' kN/m ⇒ ' +
                    (shearOk ? '满足' + tag('ok','V≤Vc') : '不满足' + tag('err','V>Vc，需增大板厚')) + '</div>');

                // 抗倾覆验算
                // 倾覆点：雨篷按墙内边缘算起 x0（简化）
                var x0 = 0.03; // m，简化取 30mm（类似挑梁 0.3hb，板取小值）
                // 倾覆力矩
                var M_ov = M_design / 1.0; // 已为设计值；这里转为标准值组合抗倾覆
                // 抗倾覆用标准组合：Mov_std = gk*0.5*L^2*B + qk*0.5*L^2*B
                var M_ov_std = (gk + qk) * 0.5 * L * L * B; // 标准组合倾覆力矩
                // 抗倾覆荷载：墙重 + 楼盖 + 埋入段板自重
                var gWall = brickG * bw * hw * B; // kN  墙体总重
                var gFloor = floorLoad * bw * B; // kN/m 楼盖荷载（线荷载）* 宽度 = 力？
                gFloor = floorLoad * bw * l1 * B; // kN  楼盖总有利荷载
                var gSlab_in = 25 * h/1000 * bw * B; // kN  埋入段板自重
                // 抗倾覆力臂：合力点距倾覆点（墙内边缘 x0 处）
                var arm = l1 / 2 + bw/2 - x0; // 墙厚中心 + 墙外延伸的一半 - 倾覆点偏移
                if (arm <= 0) arm = 0.01;
                var R_total = 0.8 * (gWall + gFloor + gSlab_in); // 0.8 有利荷载分项系数
                var Mr = R_total * arm;
                var overturnOk = Mr >= M_ov_std;
                st.push('<div class="step"><b>④ 抗倾覆验算（标准组合）</b></div>');
                st.push('<div class="step">　　倾覆力矩（标准组合）M<sub>ov</sub> = ' + fmt(M_ov_std, 2) + ' kN·m</div>');
                st.push('<div class="step">　　抗倾覆荷载 G<sub>r</sub> = 0.8(G<sub>墙</sub>+G<sub>楼</sub>+G<sub>板</sub>) = 0.8×(' +
                    fmt(gWall,1) + ' + ' + fmt(gFloor,1) + ' + ' + fmt(gSlab_in,1) + ') = ' + fmt(R_total, 1) + ' kN</div>');
                st.push('<div class="step">　　力臂 ≈ l₁/2 + b/2 − x₀ = ' + fmt(arm,3) + ' m</div>');
                st.push('<div class="step">　　M<sub>r</sub> = G<sub>r</sub> × 力臂 = <b>' + fmt(Mr, 2) + ' kN·m</b> ⇒ ' +
                    (overturnOk ? '满足' + tag('ok','抗倾覆满足') : '不满足' + tag('err','抗倾覆不足')) + '</div>');

                var allOk = bendOk && minOk && shearOk && overturnOk;
                var html = resultRow('设计弯矩 M（总宽）', fmt(M_design, 2) + ' kN·m');
                html += resultRow('单位宽度弯矩 m', fmt(qPerM, 2) + ' kN·m/m');
                html += resultRow('受力钢筋 A<sub>s</sub>', '<span class="highlight">' + fmt(AsPerM, 0) + ' mm²/m</span>');
                html += resultRow('最小配筋 A<sub>s,min</sub>', fmt(AsMin, 0) + ' mm²/m ' + (minOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('板受剪 V / V<sub>c</sub>', fmt(VperM,2) + ' / ' + fmt(Vu_slab,2) + ' kN/m ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('抗倾覆 M<sub>r</sub>/M<sub>ov</sub>', fmt(Mr,2) + ' / ' + fmt(M_ov_std,2) + ' kN·m ' + (overturnOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '各项验算均满足' : '存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._BA_RESULT = { M: M_design, AsPerM: AsPerM, AsMin: AsMin, V: V_design, Vu: Vu_slab, Mr: Mr, Mov: M_ov_std, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['ba_L','ba_B','ba_h','ba_gk','ba_qk','ba_qcon','ba_l1','ba_bw','ba_hw','ba_brick','ba_floor'].forEach(function (id) {
                    var defs = { ba_L:1000, ba_B:2400, ba_h:100, ba_gk:3.0, ba_qk:2.0, ba_qcon:1.0, ba_l1:1500, ba_bw:240, ba_hw:2800, ba_brick:19, ba_floor:3.5 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('ba_kind').value = 'canopy';
                document.getElementById('ba_con').value = 'C30';
                document.getElementById('ba_reb').value = 'HRB400';
                calc();
            }
            document.getElementById('ba_calc').addEventListener('click', calc);
            document.getElementById('ba_reset').addEventListener('click', reset);
            document.getElementById('f-ba').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['balcony'] = tool;
})();
