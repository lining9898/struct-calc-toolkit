/* lintel 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '过梁与圈梁计算',
        sub: '砖砌平拱 / 钢筋砖过梁 / 钢筋混凝土过梁 · 圈梁构造验算 · GB 50003-2011 第 7.1、7.2 条',
        meta: {"standard": "GB 50003-2011 砌体结构设计规范", "formulaSource": "7.1, 7.2", "limitations": "砖砌平拱/钢筋砖/钢筋混凝土过梁", "unit": "M:kN·m, V:kN, As:mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">过梁基本参数</div>' +
                '<form id="f-li"><div class="grid2">' +
                selField('li_kind', '过梁类型', opts([
                    { v: 'rc', t: '钢筋混凝土过梁' },
                    { v: 'brick', t: '钢筋砖过梁' },
                    { v: 'arch', t: '砖砌平拱过梁' }
                ], 'rc')) +
                numField('li_Ln', '洞口净跨 L<sub>n</sub>', 'mm', 1800, '过梁净跨度；钢筋砖过梁净跨宜≤1.5m，砖砌平拱宜≤1.2m') +
                numField('li_hw', '墙体高度 h<sub>w</sub>', 'mm', 1200, '过梁以上墙体高度') +
                numField('li_hb', '过梁截面高度 h<sub>b</sub>', 'mm', 180, '钢筋混凝土过梁填梁高；钢筋砖过梁/平拱填考虑高度') +
                selField('li_type', '砌体类型', opts([
                    { v: 'clay', t: '烧结普通砖 / 多孔砖' },
                    { v: 'block', t: '混凝土小型空心砌块' },
                    { v: 'lime', t: '蒸压灰砂 / 粉煤灰砖' }
                ], 'clay')) +
                selField('li_mu', '砌块强度等级', opts(MASONRY_TYPES['clay'].unitLabels.map(function (u) { return { v: u, t: u }; }), 'MU15')) +
                selField('li_mortar', '砂浆强度等级', opts(MASONRY_TYPES['clay'].morLabels.map(function (m) { return { v: m, t: m }; }), 'M5')) +
                selField('li_con', '过梁混凝土等级', conOpts('C25')) +
                selField('li_reb', '钢筋级别', opts([{v:'HPB300',t:'HPB300'},{v:'HRB400',t:'HRB400'}], 'HRB400')) +
                numField('li_qload', '均布楼面荷载 q', 'kN/m', 0, '过梁上方楼盖传来的均布荷载设计值；无则填 0') +
                numField('li_bw', '墙厚 b', 'mm', 240) +
                numField('li_brick', '砖砌体自重', 'kN/m³', 19, '烧结普通砖砌体约 18~19 kN/m³') +
                selField('li_haveroof', '上方是否有梁板', opts([{v:'yes',t:'有楼盖/屋盖（梁板荷载需考虑）'},{v:'no',t:'无楼盖（仅墙体）'}], 'no')) +
                '</div><div class="hint">提示：过梁荷载取法（7.2.2）：h<sub>w</sub>＜l<sub>n</sub>/3 时按全部墙体自重计，否则按 l<sub>n</sub>/3 高墙体计；有梁板且 h<sub>w</sub>＜l<sub>n</sub> 时计入梁板荷载。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="li_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="li_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">过梁计算结果</div><div id="li_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="li_proc"></div></div></div></div>' +
                '<div class="panel"><div class="panel-title">圈梁构造验算（7.1.5 ~ 7.1.7）</div>' +
                '<div class="grid2">' +
                numField('ql_b', '圈梁宽度 b（同墙厚）', 'mm', 240) +
                numField('ql_h', '圈梁高度 h', 'mm', 180) +
                numField('ql_As', '纵筋总面积 A<sub>s</sub>', 'mm²', 226, '例如 4φ12 = 452 mm²（上下各 2φ12）') +
                selField('ql_stirrup', '箍筋直径 / 间距', opts([
                    { v: '6@250', t: 'φ6 @ 250' },
                    { v: '6@200', t: 'φ6 @ 200' },
                    { v: '8@200', t: 'φ8 @ 200' },
                    { v: '8@150', t: 'φ8 @ 150' }
                ], '6@250')) +
                '</div><div id="ql_result"></div></div>';
        },
        bind: function () {
            document.getElementById('li_type').addEventListener('change', function () {
                var t = this.value, meta = MASONRY_TYPES[t];
                var muSel = document.getElementById('li_mu');
                muSel.innerHTML = meta.unitLabels.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
                muSel.value = meta.unitLabels[2] || meta.unitLabels[0];
                var morSel = document.getElementById('li_mortar');
                morSel.innerHTML = meta.morLabels.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
                morSel.value = meta.morLabels[2] || meta.morLabels[0];
                calcAll();
            });

            function calcLintel() {
                var out = document.getElementById('li_result'), proc = document.getElementById('li_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var kindV = document.getElementById('li_kind').value;
                var Ln = parseFloat(document.getElementById('li_Ln').value);
                var hw = parseFloat(document.getElementById('li_hw').value);
                var hb = parseFloat(document.getElementById('li_hb').value);
                var typeV = document.getElementById('li_type').value;
                var muV = document.getElementById('li_mu').value;
                var morV = document.getElementById('li_mortar').value;
                var conV = document.getElementById('li_con').value;
                var rebV = document.getElementById('li_reb').value;
                var qLoad = parseFloat(document.getElementById('li_qload').value) || 0;
                var bw = parseFloat(document.getElementById('li_bw').value);
                var brickG = parseFloat(document.getElementById('li_brick').value);
                var haveRoof = document.getElementById('li_haveroof').value === 'yes';
                if (!(Ln > 0)) return err('过梁净跨必须为正数。');
                if (!(bw > 0)) return err('墙厚必须为正数。');
                var meta = MASONRY_TYPES[typeV];
                var f = meta.table[muV] ? meta.table[muV][morV] : undefined;
                if (!f) return err('所选砌块与砂浆组合无对应强度值。');
                // 弯曲抗拉、抗剪（仅粘土砖简化使用）
                var ftm = MAS_FT_M_CLAY[morV] || 0.12;
                var fv = MAS_FV_CLAY[morV] || 0.09;
                var fy = (rebV === 'HRB400') ? 360 : 270;
                var con = CONCRETE[conV];

                // 净跨限制提示
                var spanWarn = '';
                if (kindV === 'brick' && Ln > 1500) spanWarn = '钢筋砖过梁净跨不宜超过 1.5 m（7.2.1）';
                if (kindV === 'arch' && Ln > 1200) spanWarn = '砖砌平拱过梁净跨不宜超过 1.2 m（7.2.1）';

                // 过梁计算跨度 L0
                var L0 = Ln + hb; // 支座支承长度近似取 hb/2 两侧 => L0 = Ln + hb（简化）
                if (L0 > 1.1 * Ln) L0 = 1.1 * Ln; // 近似控制
                L0 = Math.max(Ln, L0);

                var st = [];
                st.push('<div class="step"><b>① 过梁类型与跨度</b>　类型：' +
                    (kindV==='rc'?'钢筋混凝土过梁':kindV==='brick'?'钢筋砖过梁':'砖砌平拱过梁') +
                    '；净跨 L<sub>n</sub> = ' + fmt(Ln,0) + ' mm；计算跨度 L₀ ≈ ' + fmt(L0,0) + ' mm' +
                    (spanWarn ? '。<span style="color:var(--warn)">' + spanWarn + '</span>' : '') + '</div>');

                // 墙体荷载（7.2.2）
                var hwForLoad = hw;
                if (hw >= Ln / 3) hwForLoad = Ln / 3; // h_w >= ln/3 时，只计入 ln/3 高度墙体
                var qWall = brickG * bw / 1000 * hwForLoad / 1000; // kN/m （砌体自重 * 墙厚 * 墙高）
                st.push('<div class="step"><b>② 墙体荷载（7.2.2 条）</b>　h<sub>w</sub> = ' + fmt(hw,0) + ' mm，l<sub>n</sub>/3 = ' + fmt(Ln/3,0) + ' mm；' +
                    (hw >= Ln/3 ? 'h<sub>w</sub> ≥ l<sub>n</sub>/3，按 l<sub>n</sub>/3 高度墙体计算。' : '按全部墙体高度计算。') +
                    ' 墙体均布荷载 q<sub>墙</sub> = γ·b·h = ' + fmt(qWall, 3) + ' kN/m</div>');

                // 梁板荷载
                var qBeam = 0;
                if (haveRoof && hw < Ln) {
                    qBeam = qLoad;
                    st.push('<div class="step"><b>③ 梁板荷载（7.2.2）</b>　h<sub>w</sub> = ' + fmt(hw,0) + ' mm ＜ l<sub>n</sub> = ' + fmt(Ln,0) + ' mm，计入梁板荷载 q<sub>梁</sub> = ' + fmt(qLoad, 2) + ' kN/m</div>');
                } else if (haveRoof) {
                    st.push('<div class="step"><b>③ 梁板荷载（7.2.2）</b>　h<sub>w</sub> ≥ l<sub>n</sub>，梁板荷载可不计入（内拱卸荷作用）</div>');
                } else {
                    st.push('<div class="step"><b>③ 梁板荷载</b>　无楼盖，仅墙体荷载</div>');
                }

                // 过梁自重（钢筋混凝土过梁）
                var qSelf = 0;
                if (kindV === 'rc') {
                    qSelf = 25 * bw / 1000 * hb / 1000; // kN/m (钢筋混凝土自重 25kN/m³)
                    st.push('<div class="step"><b>④ 过梁自重</b>　q<sub>自重</sub> = 25×b×h = 25×' + fmt(bw,0) + '×' + fmt(hb,0) + '/10⁶ = ' + fmt(qSelf, 3) + ' kN/m</div>');
                }

                // 总荷载设计值
                var qTotal = qWall + qBeam + qSelf;
                var M = qTotal * L0 * L0 / 8 / 1000; // kN·m （L0 mm => m 换算已并入）
                // 修正：L0 单位 mm，qTotal 单位 kN/m。M = qTotal * (L0/1000)^2 / 8
                var L0m = L0 / 1000;
                M = qTotal * L0m * L0m / 8; // kN·m
                var V = qTotal * Ln / 2 / 1000; // kN （V = q*ln/2）
                st.push('<div class="step"><b>⑤ 总荷载与内力</b>　q<sub>总</sub> = ' + fmt(qTotal, 3) + ' kN/m；' +
                    '跨中弯矩 M = qL₀²/8 = <b>' + fmt(M, 2) + ' kN·m</b>；' +
                    '支座剪力 V = ql<sub>n</sub>/2 = <b>' + fmt(V, 2) + ' kN</b></div>');

                var html, ok = false;
                if (kindV === 'rc') {
                    // 钢筋混凝土过梁：按钢筋混凝土受弯构件计算
                    var h0 = hb - 35; // as 近似 35mm
                    var fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                    var es = 200000;
                    var xib = b1 / (1 + fy / (es * ecu));
                    // 求 As
                    // M = a1*fc*b*x*(h0 - x/2), 用公式 αs = M/(a1*fc*b*h0^2)
                    var alphaS = M * 1e6 / (a1 * fc * bw * h0 * h0);
                    var gammaS = (1 + Math.sqrt(1 - 2 * alphaS)) / 2;
                    var AsReq = M * 1e6 / (fy * gammaS * h0); // mm²
                    var x = 2 * (h0 - gammaS * h0);
                    var xi = x / h0;
                    var bendOk = xi <= xib;
                    // 斜截面受剪：V ≤ 0.7 ft b h0
                    var VuShear = 0.7 * ft * bw * h0 / 1000; // kN
                    var shearOk = V <= VuShear;
                    ok = bendOk && shearOk;
                    st.push('<div class="step"><b>⑥ 正截面配筋（6.2.10）</b>　h₀ = ' + fmt(h0,0) + ' mm；' +
                        'α₁f<sub>c</sub>bh₀² = ' + fmt(a1*fc*bw*h0*h0/1e6, 3) + ' kN·m；' +
                        'α<sub>s</sub> = M/α₁f<sub>c</sub>bh₀² = ' + fmt(alphaS, 4) + '；' +
                        'γ<sub>s</sub> = ' + fmt(gammaS, 4) + '；' +
                        'A<sub>s</sub> = M/(γ<sub>s</sub>f<sub>y</sub>h₀) = <b>' + fmt(AsReq, 0) + ' mm²</b>' +
                        (bendOk ? tag('ok','适筋') : tag('err','超筋')) + '</div>');
                    st.push('<div class="step"><b>⑦ 斜截面受剪（6.3.1）</b>　V<sub>c</sub> = 0.7f<sub>t</sub>bh₀ = 0.7×' + ft + '×' + fmt(bw,0) + '×' + fmt(h0,0) + '/1000 = ' + fmt(VuShear, 2) + ' kN；' +
                        'V = ' + fmt(V, 2) + ' kN ⇒ ' + (shearOk ? '满足' + tag('ok','V≤Vc') : '不满足' + tag('err','V>Vc')) + '</div>');
                    html = resultRow('过梁类型', '钢筋混凝土过梁');
                    html += resultRow('计算跨度 L₀', fmt(L0, 0) + ' mm');
                    html += resultRow('总均布荷载 q', fmt(qTotal, 3) + ' kN/m');
                    html += resultRow('跨中弯矩 M', fmt(M, 2) + ' kN·m');
                    html += resultRow('支座剪力 V', fmt(V, 2) + ' kN');
                    html += resultRow('所需受拉钢筋 A<sub>s</sub>', '<span class="highlight">' + fmt(AsReq, 0) + ' mm²</span>');
                    html += resultRow('受剪承载力 0.7f<sub>t</sub>bh₀', fmt(VuShear, 2) + ' kN ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                } else if (kindV === 'brick') {
                    // 钢筋砖过梁：M 由底部钢筋承担，V 由砌体承担（7.2.3）
                    var h02 = hb - 15; // 钢筋重心到受拉边缘 15mm
                    var AsReq2 = M * 1e6 / (0.85 * fy * h02); // mm²  近似 M = 0.85 h0 * fy * As
                    var Vbrick = fv * bw * (hw > hb ? hb : hw) / 1000; // 按受剪面
                    // 规范：受剪承载力 V ≤ fv*b*z，z = 2h/3，h 取过梁截面有效高度
                    var z = 2 * hb / 3;
                    var Vbrick2 = fv * bw * z / 1000;
                    var vOkB = V <= Vbrick2;
                    ok = vOkB;
                    st.push('<div class="step"><b>⑥ 钢筋砖过梁受弯配筋（7.2.3）</b>　' +
                        'h₀ = ' + fmt(h02,0) + ' mm；A<sub>s</sub> = M / (0.85 h₀ f<sub>y</sub>) = ' + fmt(M,2) + '×10⁶ / (0.85×' + fmt(h02,0) + '×' + fy + ') = <b>' + fmt(AsReq2, 0) + ' mm²</b></div>');
                    st.push('<div class="step"><b>⑦ 受剪承载力（5.4.2）</b>　' +
                        'V = ' + fmt(V,2) + ' kN；f<sub>v</sub>b·z = ' + fv + '×' + fmt(bw,0) + '×' + fmt(z,0) + '/1000 = ' + fmt(Vbrick2,2) + ' kN ⇒ ' +
                        (vOkB ? '满足' + tag('ok','满足') : '不满足' + tag('err','不满足')) + '</div>');
                    html = resultRow('过梁类型', '钢筋砖过梁');
                    html += resultRow('计算跨度 L₀', fmt(L0, 0) + ' mm');
                    html += resultRow('总均布荷载 q', fmt(qTotal, 3) + ' kN/m');
                    html += resultRow('跨中弯矩 M', fmt(M, 2) + ' kN·m');
                    html += resultRow('所需受拉钢筋 A<sub>s</sub>', '<span class="highlight">' + fmt(AsReq2, 0) + ' mm²</span>');
                    html += resultRow('受剪承载力 f<sub>v</sub>b·z', fmt(Vbrick2, 2) + ' kN ' + (vOkB ? tag('ok','满足') : tag('err','不足')));
                } else {
                    // 砖砌平拱过梁：按砌体受弯构件 M ≤ ftm*W, V ≤ fv*b*z
                    var Warch = bw * hb * hb / 6; // 截面抵抗矩 mm³
                    var Mum = ftm * Warch / 1e6; // kN·m
                    var zArch = 2 * hb / 3;
                    var Vum = fv * bw * zArch / 1000; // kN
                    var mOkA = M <= Mum, vOkA = V <= Vum;
                    ok = mOkA && vOkA;
                    st.push('<div class="step"><b>⑥ 砖砌平拱受弯承载力（5.4.1）</b>　' +
                        'W = bh²/6 = ' + fmt(bw,0) + '×' + fmt(hb,0) + '²/6 = ' + fmt(Warch,0) + ' mm³；' +
                        'M<sub>u</sub> = f<sub>tm</sub>·W = ' + ftm + '×' + fmt(Warch,0) + '/10⁶ = <b>' + fmt(Mum, 2) + ' kN·m</b> ⇒ ' +
                        (mOkA ? '满足' + tag('ok','M≤Mu') : '不满足' + tag('err','M>Mu')) + '</div>');
                    st.push('<div class="step"><b>⑦ 砖砌平拱受剪承载力（5.4.2）</b>　' +
                        'V<sub>u</sub> = f<sub>v</sub>·b·z = ' + fv + '×' + fmt(bw,0) + '×' + fmt(zArch,0) + '/1000 = <b>' + fmt(Vum, 2) + ' kN</b> ⇒ ' +
                        (vOkA ? '满足' + tag('ok','V≤Vu') : '不满足' + tag('err','V>Vu')) + '</div>');
                    html = resultRow('过梁类型', '砖砌平拱过梁');
                    html += resultRow('计算跨度 L₀', fmt(L0, 0) + ' mm');
                    html += resultRow('总均布荷载 q', fmt(qTotal, 3) + ' kN/m');
                    html += resultRow('跨中弯矩 M', fmt(M, 2) + ' kN·m / M<sub>u</sub> = ' + fmt(Mum, 2) + ' kN·m ' + (mOkA ? tag('ok','满足') : tag('err','不足')));
                    html += resultRow('支座剪力 V', fmt(V, 2) + ' kN / V<sub>u</sub> = ' + fmt(Vum, 2) + ' kN ' + (vOkA ? tag('ok','满足') : tag('err','不足')));
                }
                html += resultRow('过梁判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '过梁验算满足' : '过梁承载力不足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._LI_RESULT = { kind: kindV, L0: L0, qTotal: qTotal, M: M, V: V, ok: ok, steps: st.join('') };
            }

            function calcQuanLiang() {
                var ql_b = parseFloat(document.getElementById('ql_b').value) || 240;
                var ql_h = parseFloat(document.getElementById('ql_h').value) || 180;
                var ql_As = parseFloat(document.getElementById('ql_As').value) || 226;
                var ql_st = document.getElementById('ql_stirrup').value;
                var rebV = document.getElementById('li_reb').value;
                var fyQl = (rebV === 'HRB400') ? 360 : 270;
                // 圈梁最小配筋：纵筋≥4φ10，箍筋≥φ6@250
                var AsMin = 4 * Math.PI * 10 * 10 / 4; // 4φ10 = 314 mm²  (注意：7.1.6 纵筋不应少于 4φ10)
                var asOk = ql_As >= AsMin;
                // 箍筋构造：直径≥6，间距≤250（7.1.7）
                var stirrupDiam = parseInt(ql_st.split('@')[0]);
                var stirrupSpace = parseInt(ql_st.split('@')[1]);
                var stirOk = stirrupDiam >= 6 && stirrupSpace <= 250;
                var qlOk = asOk && stirOk;
                var html = resultRow('圈梁截面 b×h', fmt(ql_b,0) + ' × ' + fmt(ql_h,0) + ' mm');
                html += resultRow('纵筋总面积 A<sub>s</sub>', fmt(ql_As,0) + ' mm² / 最小 4φ10 = ' + fmt(AsMin,0) + ' mm² ' + (asOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('箍筋', 'φ' + stirrupDiam + ' @ ' + stirrupSpace + ' ' + (stirOk ? tag('ok','满足构造') : tag('err','不满足')));
                html += resultRow('圈梁构造判定', badge(qlOk ? 'badge-ok' : 'badge-err', qlOk ? '圈梁构造满足 7.1.5~7.1.7' : '圈梁构造不满足'));
                document.getElementById('ql_result').innerHTML = html;
            }

            function calcAll() { calcLintel(); calcQuanLiang(); }

            function reset() {
                ['li_Ln','li_hw','li_hb','li_qload','li_bw','li_brick','ql_b','ql_h','ql_As'].forEach(function (id) {
                    var defs = { li_Ln:1800, li_hw:1200, li_hb:180, li_qload:0, li_bw:240, li_brick:19, ql_b:240, ql_h:180, ql_As:226 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('li_kind').value = 'rc';
                document.getElementById('li_type').value = 'clay';
                document.getElementById('li_mu').innerHTML = MASONRY_TYPES['clay'].unitLabels.map(function(u){return'<option value="'+u+'">'+u+'</option>'}).join('');
                document.getElementById('li_mu').value = 'MU15';
                document.getElementById('li_mortar').innerHTML = MASONRY_TYPES['clay'].morLabels.map(function(m){return'<option value="'+m+'">'+m+'</option>'}).join('');
                document.getElementById('li_mortar').value = 'M5';
                document.getElementById('li_con').value = 'C25';
                document.getElementById('li_reb').value = 'HRB400';
                document.getElementById('li_haveroof').value = 'no';
                document.getElementById('ql_stirrup').value = '6@250';
                calcAll();
            }
            document.getElementById('li_calc').addEventListener('click', calcAll);
            document.getElementById('li_reset').addEventListener('click', reset);
            document.getElementById('f-li').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calcAll(); } });
            calcAll();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['lintel'] = tool;
})();
