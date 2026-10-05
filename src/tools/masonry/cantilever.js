/* cantilever 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '挑梁计算',
        sub: '抗倾覆 · 下砌体局压 · 挑梁正斜截面 · GB 50003-2011 第 7.4 条',
        meta: {"standard": "GB 50003-2011 砌体结构设计规范", "formulaSource": "7.4", "limitations": "砌体中挑梁，抗倾覆+局部受压+正斜截面", "unit": "Mov:kN·m, Mmax:kN·m, Nl:kN", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">挑梁几何与材料</div>' +
                '<form id="f-cl"><div class="grid2">' +
                numField('cl_l', '挑出长度 l', 'mm', 1500) +
                numField('cl_l1', '埋入长度 l₁', 'mm', 2000, '挑梁埋入砌体的长度；一般 l₁ ≥ 1.5 l（顶层）或 1.2 l（楼层）') +
                numField('cl_hb', '挑梁高度 h<sub>b</sub>', 'mm', 350) +
                numField('cl_bb', '挑梁宽度 b<sub>b</sub>', 'mm', 240) +
                numField('cl_hw', '挑梁上墙体高度 h<sub>w</sub>', 'mm', 2800, '挑梁埋入段上方墙体总高度，用于计算抗倾覆荷载') +
                numField('cl_bw', '墙厚 b', 'mm', 240) +
                selField('cl_type', '砌体类型', opts([
                    { v: 'clay', t: '烧结普通砖 / 多孔砖' },
                    { v: 'block', t: '混凝土小型空心砌块' },
                    { v: 'lime', t: '蒸压灰砂 / 粉煤灰砖' }
                ], 'clay')) +
                selField('cl_mu', '砌块强度等级', opts(MASONRY_TYPES['clay'].unitLabels.map(function (u) { return { v: u, t: u }; }), 'MU20')) +
                selField('cl_mortar', '砂浆强度等级', opts(MASONRY_TYPES['clay'].morLabels.map(function (m) { return { v: m, t: m }; }), 'M7.5')) +
                selField('cl_con', '挑梁混凝土等级', conOpts('C30')) +
                selField('cl_reb', '挑梁钢筋级别', opts([{v:'HPB300',t:'HPB300'},{v:'HRB400',t:'HRB400'}], 'HRB400')) +
                numField('cl_qload', '挑出段均布荷载 q', 'kN/m', 12, '挑出段上总均布荷载设计值（含自重、楼面、活载等）') +
                numField('cl_pload', '挑出段集中荷载 P', 'kN', 0, '挑梁端部集中荷载；无则填 0') +
                numField('cl_floor', '埋入段上楼层荷载 p', 'kN/m²', 3.5, '埋入段上方楼盖荷载标准值（抗倾覆有利荷载近似）') +
                numField('cl_brick', '砌体自重', 'kN/m³', 19) +
                '</div><div class="hint">说明：抗倾覆验算位置为墙外边缘（x₀ 内移）；本工具按楼层挑梁简化计算，挑梁下砌体局部受压按 7.4.4 条，挑梁本身配筋按混凝土受弯/受剪构件。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="cl_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="cl_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="cl_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="cl_proc"></div></div></div></div>';
        },
        bind: function () {
            document.getElementById('cl_type').addEventListener('change', function () {
                var t = this.value, meta = MASONRY_TYPES[t];
                var muSel = document.getElementById('cl_mu');
                muSel.innerHTML = meta.unitLabels.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
                muSel.value = meta.unitLabels[2] || meta.unitLabels[0];
                var morSel = document.getElementById('cl_mortar');
                morSel.innerHTML = meta.morLabels.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
                morSel.value = meta.morLabels[2] || meta.morLabels[0];
                calc();
            });

            function calc() {
                var out = document.getElementById('cl_result'), proc = document.getElementById('cl_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var l = parseFloat(document.getElementById('cl_l').value) / 1000; // m
                var l1 = parseFloat(document.getElementById('cl_l1').value) / 1000; // m
                var hb = parseFloat(document.getElementById('cl_hb').value);
                var bb = parseFloat(document.getElementById('cl_bb').value);
                var hw = parseFloat(document.getElementById('cl_hw').value) / 1000; // m
                var bw = parseFloat(document.getElementById('cl_bw').value) / 1000; // m
                var typeV = document.getElementById('cl_type').value;
                var muV = document.getElementById('cl_mu').value;
                var morV = document.getElementById('cl_mortar').value;
                var conV = document.getElementById('cl_con').value;
                var rebV = document.getElementById('cl_reb').value;
                var qLoad = parseFloat(document.getElementById('cl_qload').value);
                var pLoad = parseFloat(document.getElementById('cl_pload').value);
                var floorLoad = parseFloat(document.getElementById('cl_floor').value);
                var brickG = parseFloat(document.getElementById('cl_brick').value);
                if (!(l > 0 && l1 > 0)) return err('挑出长度和埋入长度必须为正数。');
                if (!(hb > 0 && bb > 0)) return err('挑梁截面尺寸必须为正数。');
                var meta = MASONRY_TYPES[typeV];
                var f = meta.table[muV] ? meta.table[muV][morV] : undefined;
                if (!f) return err('所选砌块与砂浆组合无对应强度值。');
                var con = CONCRETE[conV];
                var fy = (rebV === 'HRB400') ? 360 : 270;
                var fv = MAS_FV_CLAY[morV] || 0.11;
                var st = [];

                // 倾覆点位置：按 7.4.2 条，挑梁计算倾覆点距墙外边缘 x0
                // x0 = 0.3 hb, 且不大于 0.13 l1
                var x0 = 0.3 * hb / 1000; // m
                var x0Max = 0.13 * l1;
                if (x0 > x0Max) x0 = x0Max;
                if (x0 < 0) x0 = 0;
                st.push('<div class="step"><b>① 倾覆点位置（7.4.2）</b>　x₀ = 0.3h<sub>b</sub> = ' + fmt(0.3*hb,0) + ' mm = ' + fmt(x0,3) + ' m；不大于 0.13l₁ = ' + fmt(x0Max,3) + ' m ⇒ <b>x₀ = ' + fmt(x0,3) + ' m</b></div>');

                // 倾覆力矩 Mov：挑出段荷载对倾覆点的力矩
                // q 均布：Mov = 0.5 * q * (l + x0)^2
                // P 集中：Mov += P * (l + x0)
                var M_overturn = 0.5 * qLoad * (l + x0) * (l + x0) + pLoad * (l + x0); // kN·m
                st.push('<div class="step"><b>② 倾覆力矩 M<sub>ov</sub></b>　q = ' + fmt(qLoad,2) + ' kN/m；P = ' + fmt(pLoad,2) + ' kN；' +
                    'M<sub>ov</sub> = 0.5q(l+x₀)² + P(l+x₀) = <b>' + fmt(M_overturn, 2) + ' kN·m</b></div>');

                // 抗倾覆力矩 Mr：埋入段自重 + 上方墙体 + 楼盖荷载（取有利荷载的 0.8 组合系数近似）
                // 简化：抗倾覆荷载包括挑梁埋入段自重、埋入段上部墙体自重（按 45°扩散范围近似）、楼盖荷载（楼层抗倾覆）
                // 取 l1 范围内墙体自重作为抗倾覆荷载（保守近似，实际应按 7.4.3 条扩散范围）
                var gWall = brickG * bw * hw; // kN/m （墙体自重线荷载）
                var gBeam = 25 * bb / 1000 * hb / 1000; // kN/m  挑梁自重
                var gFloor = floorLoad * bw; // 楼盖荷载（按标准值有利组合取 0.8 系数）
                // 抗倾覆荷载重心距墙外边缘距离 = l1/2（均匀分布在 l1 范围内的合力点）
                // 对倾覆点 x0 的力臂 = l1/2 - x0 (合力点在墙内，到倾覆点距离)
                var gArm = l1 / 2 - x0;
                if (gArm <= 0) { gArm = 0; }
                // 墙体扩散简化：按 45° 扩散，顶部宽度 = l1 + 2*hw(45°)，这里简化用梯形分布
                // 实际规范用墙体等效斜向扩散，此处保守按 l1 范围内矩形墙重计算，不乘扩散扩大系数
                var Mr_wall = 0.8 * gWall * gArm * l1 / l1 * (l1/2 - x0); // 简化：合力 * 力臂
                // 更简洁：
                var R_wall = gWall * l1; // 总墙重 kN
                var Mr_wall2 = 0.8 * R_wall * (l1 / 2 - x0); // kN·m, 0.8 为抗倾覆有利荷载分项系数
                var R_beam = gBeam * l1;
                var Mr_beam = 0.8 * R_beam * (l1 / 2 - x0);
                var R_floor = gFloor * l1;
                var Mr_floor = 0.8 * R_floor * (l1 / 2 - x0);
                var Mr_total = Mr_wall2 + Mr_beam + Mr_floor;
                if (Mr_total < 0) Mr_total = 0;
                st.push('<div class="step"><b>③ 抗倾覆力矩 M<sub>r</sub>（7.4.3，有利荷载乘 0.8）</b></div>');
                st.push('<div class="step">　　墙体自重 G<sub>墙</sub> = γ·b·h·L₁ = ' + brickG + '×' + fmt(bw,3) + '×' + fmt(hw,2) + '×' + fmt(l1,2) + ' = ' + fmt(R_wall, 2) + ' kN</div>');
                st.push('<div class="step">　　挑梁自重 G<sub>梁</sub> = 25·b·h·L₁ = ' + fmt(R_beam, 2) + ' kN</div>');
                st.push('<div class="step">　　楼盖荷载 G<sub>楼</sub> = p·b·L₁ = ' + floorLoad + '×' + fmt(bw,3) + '×' + fmt(l1,2) + ' = ' + fmt(R_floor, 2) + ' kN</div>');
                st.push('<div class="step">　　合力点距倾覆点力臂 = l₁/2 − x₀ = ' + fmt(l1/2,3) + ' − ' + fmt(x0,3) + ' = ' + fmt(l1/2 - x0,3) + ' m</div>');
                st.push('<div class="step">　　M<sub>r</sub> = 0.8·(G<sub>墙</sub>+G<sub>梁</sub>+G<sub>楼</sub>)·(l₁/2−x₀) = <b>' + fmt(Mr_total, 2) + ' kN·m</b></div>');

                var overturnOk = Mr_total >= M_overturn;
                st.push('<div class="step"><b>④ 抗倾覆验算（7.4.1）</b>　M<sub>r</sub> = ' + fmt(Mr_total,2) +
                    ' kN·m ' + (overturnOk ? ' ≥ ' : ' < ') + ' M<sub>ov</sub> = ' + fmt(M_overturn,2) + ' kN·m ⇒ ' +
                    (overturnOk ? '满足' + tag('ok','抗倾覆满足') : '不满足' + tag('err','抗倾覆不足')) + '</div>');

                // 挑梁下砌体局部受压（7.4.4）：Nl ≤ ηγfA_l
                // 挑梁下支承压力 Nl = 2R (R 为挑梁倾覆点处的剪力)，简化用倾覆点反力
                var Nl = (qLoad * (l + x0) + pLoad) * 2; // 近似：挑梁下砌体局部受压的支承压力取 2倍倾覆点反力
                // 更规范：Nl = 2R，R 为挑梁的倾覆荷载设计值产生的倾覆点处支承反力
                var R_ov = qLoad * (l + x0) + pLoad; // 倾覆点处总竖向反力 kN
                Nl = 2 * R_ov; // 7.4.4 条，挑梁下砌体局部受压 Nl = 2R
                // 局部受压面积 Al = 1.2 * bb * hb (挑梁端下设置梁垫时近似)
                // 无梁垫时取 A_l = bb * hb (挑梁端截面), 通常取 1.2 bb * hb 近似
                var Al = 1.2 * bb * hb; // mm²
                // γ 近似取 1.5（按墙中梁下局部受压，简化）
                var gamma = 1.5;
                var eta = 0.7; // 梁端局压 η
                var Nlu = eta * gamma * f * Al / 1000; // kN
                var localOk = Nl <= Nlu;
                st.push('<div class="step"><b>⑤ 挑梁下砌体局部受压（7.4.4）</b>　N<sub>l</sub> = 2R = 2×' + fmt(R_ov,2) + ' = <b>' + fmt(Nl, 2) + ' kN</b></div>');
                st.push('<div class="step">　　A<sub>l</sub> = 1.2·b<sub>b</sub>·h<sub>b</sub> = 1.2×' + fmt(bb,0) + '×' + fmt(hb,0) + ' = ' + fmt(Al,0) + ' mm²</div>');
                st.push('<div class="step">　　局压承载力 N<sub>lu</sub> = ηγfA<sub>l</sub> = 0.7×1.5×' + f + '×' + fmt(Al,0) + '/1000 = <b>' + fmt(Nlu, 2) + ' kN</b> ⇒ ' +
                    (localOk ? '满足' + tag('ok','局压满足') : '不满足' + tag('err','局压不足')) + '</div>');

                // 挑梁正截面配筋（根部截面）
                var h0 = hb - 40; // mm
                var fc = con.fc, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu, ft = con.ft;
                var es = 200000;
                var xib = b1 / (1 + fy / (es * ecu));
                var M_root = M_overturn; // 挑梁根部弯矩 = 倾覆力矩（近似，根部即倾覆点）
                // 实际挑梁根部弯矩为墙内边缘弯矩，略小于倾覆点弯矩。此处用倾覆点弯矩偏保守。
                var alphaS = M_root * 1e6 / (a1 * fc * bb * h0 * h0);
                if (alphaS > 0.5) alphaS = 0.5;
                var gammaS = (1 + Math.sqrt(1 - 2 * alphaS)) / 2;
                var AsReq = M_root * 1e6 / (fy * gammaS * h0);
                var xi = 2 * (1 - gammaS);
                var bendOk = xi <= xib;
                // 斜截面：V_max 为挑梁根部剪力
                var V_root = qLoad * l + pLoad; // kN  (墙边缘剪力)
                var Vu_shear = 0.7 * ft * bb * h0 / 1000; // kN
                var shearOk = V_root <= Vu_shear;
                st.push('<div class="step"><b>⑥ 挑梁正截面配筋（根部）</b>　M<sub>根</sub> ≈ M<sub>ov</sub> = ' + fmt(M_root,2) + ' kN·m；h₀ = ' + fmt(h0,0) + ' mm；' +
                    'α<sub>s</sub> = ' + fmt(alphaS,4) + '；γ<sub>s</sub> = ' + fmt(gammaS,4) + '；' +
                    'A<sub>s</sub> = M/(γ<sub>s</sub>f<sub>y</sub>h₀) = <b>' + fmt(AsReq, 0) + ' mm²</b> ' +
                    (bendOk ? tag('ok','适筋') : tag('err','超筋')) + '</div>');
                st.push('<div class="step"><b>⑦ 挑梁斜截面受剪</b>　V<sub>根</sub> = q·l + P = ' + fmt(V_root,2) + ' kN；' +
                    'V<sub>c</sub> = 0.7f<sub>t</sub>bh₀ = ' + fmt(Vu_shear,2) + ' kN ⇒ ' +
                    (shearOk ? '满足' + tag('ok','V≤Vc') : '不满足' + tag('err','V>Vc')) + '</div>');

                var allOk = overturnOk && localOk && bendOk && shearOk;
                var html = resultRow('倾覆点距墙外 x₀', fmt(x0*1000, 0) + ' mm');
                html += resultRow('倾覆力矩 M<sub>ov</sub>', fmt(M_overturn, 2) + ' kN·m');
                html += resultRow('抗倾覆力矩 M<sub>r</sub>', fmt(Mr_total, 2) + ' kN·m ' + (overturnOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('挑梁下局压 N<sub>l</sub>/N<sub>lu</sub>', fmt(Nl,2) + ' / ' + fmt(Nlu,2) + ' kN ' + (localOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('挑梁配筋 A<sub>s</sub>', '<span class="highlight">' + fmt(AsReq, 0) + ' mm²</span>');
                html += resultRow('挑梁受剪 V / V<sub>c</sub>', fmt(V_root,2) + ' / ' + fmt(Vu_shear,2) + ' kN ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '挑梁各项验算均满足' : '挑梁验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._CL_RESULT = { M_overturn: M_overturn, Mr_total: Mr_total, overturnOk: overturnOk, Nl: Nl, Nlu: Nlu, localOk: localOk, AsReq: AsReq, V_root: V_root, Vu_shear: Vu_shear, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['cl_l','cl_l1','cl_hb','cl_bb','cl_hw','cl_bw','cl_qload','cl_pload','cl_floor','cl_brick'].forEach(function (id) {
                    var defs = { cl_l:1500, cl_l1:2000, cl_hb:350, cl_bb:240, cl_hw:2800, cl_bw:240, cl_qload:12, cl_pload:0, cl_floor:3.5, cl_brick:19 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('cl_type').value = 'clay';
                document.getElementById('cl_mu').innerHTML = MASONRY_TYPES['clay'].unitLabels.map(function(u){return'<option value="'+u+'">'+u+'</option>'}).join('');
                document.getElementById('cl_mu').value = 'MU20';
                document.getElementById('cl_mortar').innerHTML = MASONRY_TYPES['clay'].morLabels.map(function(m){return'<option value="'+m+'">'+m+'</option>'}).join('');
                document.getElementById('cl_mortar').value = 'M7.5';
                document.getElementById('cl_con').value = 'C30';
                document.getElementById('cl_reb').value = 'HRB400';
                calc();
            }
            document.getElementById('cl_calc').addEventListener('click', calc);
            document.getElementById('cl_reset').addEventListener('click', reset);
            document.getElementById('f-cl').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['cantilever'] = tool;
})();
