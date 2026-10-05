/* mas-local 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '砌体局部受压承载力验算',
        sub: '梁端支承处 / 垫块下局压 · GB 50003-2011 第 5.2 条',
        meta: {"standard": "GB 50003-2011 砌体结构设计规范", "formulaSource": "5.2", "limitations": "梁端支承处/垫块下局部受压，γ 系数", "unit": "Nl:kN, γ:—, Al,Ab:mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">基本参数与材料</div>' +
                '<form id="f-ml"><div class="grid2">' +
                selField('ml_type', '砌体类型', opts([
                    { v: 'clay', t: '烧结普通砖 / 多孔砖' },
                    { v: 'block', t: '混凝土小型空心砌块' },
                    { v: 'lime', t: '蒸压灰砂 / 粉煤灰砖' }
                ], 'clay')) +
                selField('ml_mu', '砌块强度等级', opts(MASONRY_TYPES['clay'].unitLabels.map(function (u) { return { v: u, t: u }; }), 'MU20')) +
                selField('ml_mortar', '砂浆强度等级', opts(MASONRY_TYPES['clay'].morLabels.map(function (m) { return { v: m, t: m }; }), 'M7.5')) +
                selField('ml_kind', '验算类型', opts([
                    { v: 'beam', t: '梁端支承处局部受压（无垫块）' },
                    { v: 'pad', t: '梁端下设有垫块（刚性垫块）' }
                ], 'beam')) +
                numField('ml_a0', '梁端有效支承长度 a₀', 'mm', 190, '可按 5.2.4-5 a₀ = 10√(h_c/f) 近似估算，h_c 为梁高') +
                numField('ml_bc', '梁宽 b<sub>c</sub> / 垫块宽 b<sub>b</sub>', 'mm', 250, '无垫块时填梁宽；有垫块时填垫块宽度') +
                numField('ml_Nl', '局部压力设计值 N<sub>l</sub>', 'kN', 80, '梁端支承压力设计值') +
                numField('ml_sigma0', '上部平均压应力 σ₀', 'N/mm²', 0.5, '上部荷载在局部受压面积内产生的平均压应力，无上部荷载填 0') +
                numField('ml_h', '墙厚（构件截面高度）h', 'mm', 370, '局部受压所在方向墙体厚度') +
                numField('ml_s', '计算底面积宽度方向 s', 'mm', 740, '影响砌体局部抗压强度的计算底面积的边长（沿墙厚方向取 2h）') +
                '</div><div class="hint">提示：A₀ 按 5.2.2 规定由 A<sub>l</sub> 外扩一层墙厚确定。本工具默认沿墙厚方向取 2h 为计算底面积。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ml_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ml_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ml_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ml_proc"></div></div></div></div>';
        },
        bind: function () {
            document.getElementById('ml_type').addEventListener('change', function () {
                var t = this.value, meta = MASONRY_TYPES[t];
                var muSel = document.getElementById('ml_mu');
                muSel.innerHTML = meta.unitLabels.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
                muSel.value = meta.unitLabels[2] || meta.unitLabels[0];
                var morSel = document.getElementById('ml_mortar');
                morSel.innerHTML = meta.morLabels.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
                morSel.value = meta.morLabels[2] || meta.morLabels[0];
                calc();
            });
            function calc() {
                var out = document.getElementById('ml_result'), proc = document.getElementById('ml_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var typeV = document.getElementById('ml_type').value;
                var muV = document.getElementById('ml_mu').value;
                var morV = document.getElementById('ml_mortar').value;
                var kindV = document.getElementById('ml_kind').value;
                var a0 = parseFloat(document.getElementById('ml_a0').value);
                var bc = parseFloat(document.getElementById('ml_bc').value);
                var Nl = parseFloat(document.getElementById('ml_Nl').value);
                var sigma0 = parseFloat(document.getElementById('ml_sigma0').value);
                var h = parseFloat(document.getElementById('ml_h').value);
                var s = parseFloat(document.getElementById('ml_s').value);
                if (!(a0 > 0 && bc > 0)) return err('a₀ 与梁宽/垫块宽必须为正数。');
                if (!(Nl > 0)) return err('局部压力 N<sub>l</sub> 必须大于 0。');
                if (!(h > 0 && s > 0)) return err('墙厚 h 与计算底宽 s 必须为正数。');
                var meta = MASONRY_TYPES[typeV];
                var f = meta.table[muV] ? meta.table[muV][morV] : undefined;
                if (!f) return err('所选砌块与砂浆组合无对应强度值。');
                var st = [];
                st.push('<div class="step"><b>① 砌体抗压强度设计值</b>　' + meta.name + '，' + muV + ' + ' + morV + ' ⇒ <b>f = ' + f + ' N/mm²</b></div>');

                // 局部受压面积 Al
                var Al = a0 * bc; // mm²
                st.push('<div class="step"><b>② 局部受压面积 A<sub>l</sub></b>　A<sub>l</sub> = a₀·b = ' + fmt(a0,0) + '×' + fmt(bc,0) + ' = <b>' + fmt(Al,0) + ' mm²</b></div>');

                // 计算底面积 A0（沿墙厚方向取 2h，沿梁宽方向取 b+2h 并以 s 为上限）
                var b0 = Math.min(bc + 2 * h, s);
                var A0 = b0 * h; // 简化：A0 = b0 * h（墙厚方向）
                // 更精确：A0 = (a0 + h) * (bc + 2h) 但不超过墙截面范围。此处采用保守简化：A0 = (bc + 2h) * h
                st.push('<div class="step"><b>③ 计算底面积 A₀</b>　A₀ = (b+2h)·h = (' + fmt(bc,0) + '+2×' + fmt(h,0) + ')×' + fmt(h,0) + ' = <b>' + fmt(A0,0) + ' mm²</b>（5.2.2）</div>');

                // 局部抗压强度提高系数 γ
                var ratio = A0 / Al;
                var gamma;
                // 5.2.3 γ 限值：多孔砖/砌块≤1.5，普通砖≤2.0（墙中），端部≤1.25
                var gammaLim = (typeV === 'clay') ? 2.0 : 1.5;
                gamma = 1 + 0.35 * Math.sqrt(ratio - 1);
                if (gamma > gammaLim) gamma = gammaLim;
                if (gamma < 1) gamma = 1;
                st.push('<div class="step"><b>④ 局部抗压强度提高系数 γ（5.2.3）</b>　A₀/A<sub>l</sub> = ' + fmt(ratio,2) +
                    '；γ = 1 + 0.35√(A₀/A<sub>l</sub>−1) = ' + fmt(1 + 0.35 * Math.sqrt(ratio - 1), 3) +
                    '，限值 γ ≤ ' + gammaLim + ' ⇒ <b>γ = ' + fmt(gamma, 3) + '</b></div>');

                // 上部荷载折减系数 ψ（5.2.4 条）
                var psi;
                if (sigma0 <= 0) { psi = 0; }
                else {
                    if (ratio >= 3) psi = 0;
                    else psi = 1.5 - 0.5 * ratio;
                }
                if (psi < 0) psi = 0;
                st.push('<div class="step"><b>⑤ 上部荷载折减系数 ψ（5.2.4）</b>　A₀/A<sub>l</sub> = ' + fmt(ratio,2) +
                    '；σ₀ = ' + fmt(sigma0,3) + ' N/mm² ⇒ ψ = ' + fmt(psi, 3) +
                    (ratio >= 3 ? '（≥3，不考虑上部荷载内拱卸荷）' : '') + '</div>');

                if (kindV === 'beam') {
                    // 梁端支承处局部受压 ψN₀ + Nₗ ≤ ηγfAₗ （η = 0.7 对梁端）
                    var N0 = sigma0 * Al / 1000; // kN
                    var left = psi * N0 + Nl; // kN
                    var eta = 0.7; // 梁端局压 η = 0.7 (5.2.4)
                    var right = eta * gamma * f * Al / 1000; // kN
                    var ok = left <= right;
                    st.push('<div class="step"><b>⑥ 梁端支承处局压承载力（5.2.4-1）</b>　ψN₀ + N<sub>l</sub> ≤ ηγfA<sub>l</sub></div>');
                    st.push('<div class="step">　　左边：ψN₀ + N<sub>l</sub> = ' + fmt(psi,3) + '×' + fmt(N0,2) + ' + ' + fmt(Nl,2) + ' = <b>' + fmt(left,2) + ' kN</b></div>');
                    st.push('<div class="step">　　右边：ηγfA<sub>l</sub> = 0.7×' + fmt(gamma,3) + '×' + f + '×' + fmt(Al,0) + '/1000 = <b>' + fmt(right,2) + ' kN</b></div>');
                    st.push('<div class="step">　　判定：' + fmt(left,2) + (ok ? ' ≤ ' : ' > ') + fmt(right,2) + ' kN ⇒ ' + (ok ? '满足' + tag('ok','满足') : '不满足' + tag('err','不满足')) + '</div>');

                    var html = resultRow('局部受压面积 A<sub>l</sub>', fmt(Al,0) + ' mm²');
                    html += resultRow('计算底面积 A₀', fmt(A0,0) + ' mm²');
                    html += resultRow('γ 系数', fmt(gamma, 3));
                    html += resultRow('上部折减系数 ψ', fmt(psi, 3));
                    html += resultRow('作用效应（ψN₀+N<sub>l</sub>）', fmt(left, 2) + ' kN');
                    html += resultRow('局压承载力 ηγfA<sub>l</sub>', '<span class="highlight">' + fmt(right, 2) + ' kN</span>');
                    html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '局部受压承载力满足' : '局部受压不足'));
                    out.innerHTML = html;
                    proc.innerHTML = st.join('');
                    var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                    window._ML_RESULT = { Al: Al, A0: A0, gamma: gamma, psi: psi, left: left, right: right, ok: ok, f: f, steps: st.join('') };
                } else {
                    // 垫块下局部受压：N₀+Nₗ ≤ φαγ₁fA<sub>b</sub>（5.2.5）
                    var Ab = a0 * bc; // 垫块面积 A_b（假定垫块尺寸 a0×bc，这里简化）
                    var N0b = sigma0 * Ab / 1000; // kN
                    var leftB = N0b + Nl; // kN
                    // 垫块外砌体面积的有利影响系数 γ₁ = 0.8γ
                    var gamma1 = 0.8 * gamma;
                    if (gamma1 < 1) gamma1 = 1;
                    // 影响系数 φ 按垫块面积计算，取 β ≤ 3，φ 按 e/A_b 计算
                    var ePad = Nl * (a0 / 2 - 0.4 * a0) / (N0b + Nl); // 简化偏心距估算
                    var ePadAbs = Math.abs(ePad);
                    // α=0.0015 (M5以上), β按3.0考虑偏安全
                    var phiPad = 1 / (1 + 12 * Math.pow(ePadAbs / a0 + Math.sqrt((1/0.9 - 1)/12), 2));
                    if (phiPad > 1) phiPad = 1;
                    var rightB = phiPad * gamma1 * f * Ab / 1000; // kN
                    var okB = leftB <= rightB;
                    st.push('<div class="step"><b>⑥ 刚性垫块下局压（5.2.5-1）</b>　N₀ + N<sub>l</sub> ≤ φγ₁fA<sub>b</sub></div>');
                    st.push('<div class="step">　　垫块面积 A<sub>b</sub> = a₀·b<sub>b</sub> = ' + fmt(a0,0) + '×' + fmt(bc,0) + ' = ' + fmt(Ab,0) + ' mm²</div>');
                    st.push('<div class="step">　　有利影响系数 γ₁ = 0.8γ = 0.8×' + fmt(gamma,3) + ' = ' + fmt(gamma1,3) + '</div>');
                    st.push('<div class="step">　　左边：N₀ + N<sub>l</sub> = ' + fmt(N0b,2) + ' + ' + fmt(Nl,2) + ' = <b>' + fmt(leftB,2) + ' kN</b></div>');
                    st.push('<div class="step">　　右边：φγ₁fA<sub>b</sub> = ' + fmt(phiPad,3) + '×' + fmt(gamma1,3) + '×' + f + '×' + fmt(Ab,0) + '/1000 = <b>' + fmt(rightB,2) + ' kN</b></div>');
                    st.push('<div class="step">　　判定：' + fmt(leftB,2) + (okB ? ' ≤ ' : ' > ') + fmt(rightB,2) + ' kN ⇒ ' + (okB ? '满足' + tag('ok','满足') : '不满足' + tag('err','不满足')) + '</div>');
                    var html = resultRow('垫块面积 A<sub>b</sub>', fmt(Ab,0) + ' mm²');
                    html += resultRow('计算底面积 A₀', fmt(A0,0) + ' mm²');
                    html += resultRow('γ / γ₁', fmt(gamma, 3) + ' / ' + fmt(gamma1, 3));
                    html += resultRow('作用效应（N₀+N<sub>l</sub>）', fmt(leftB, 2) + ' kN');
                    html += resultRow('局压承载力 φγ₁fA<sub>b</sub>', '<span class="highlight">' + fmt(rightB, 2) + ' kN</span>');
                    html += resultRow('判定', badge(okB ? 'badge-ok' : 'badge-err', okB ? '垫块下局压满足' : '垫块下局压不足'));
                    out.innerHTML = html;
                    proc.innerHTML = st.join('');
                    var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                    window._ML_RESULT = { Al: Ab, A0: A0, gamma: gamma, gamma1: gamma1, left: leftB, right: rightB, ok: okB, f: f, steps: st.join('') };
                }
            }
            function reset() {
                ['ml_a0','ml_bc','ml_Nl','ml_sigma0','ml_h','ml_s'].forEach(function (id) {
                    document.getElementById(id).value = { ml_a0:190, ml_bc:250, ml_Nl:80, ml_sigma0:0.5, ml_h:370, ml_s:740 }[id];
                });
                document.getElementById('ml_type').value = 'clay';
                document.getElementById('ml_mu').innerHTML = MASONRY_TYPES['clay'].unitLabels.map(function(u){return'<option value="'+u+'">'+u+'</option>'}).join('');
                document.getElementById('ml_mu').value = 'MU20';
                document.getElementById('ml_mortar').innerHTML = MASONRY_TYPES['clay'].morLabels.map(function(m){return'<option value="'+m+'">'+m+'</option>'}).join('');
                document.getElementById('ml_mortar').value = 'M7.5';
                document.getElementById('ml_kind').value = 'beam';
                calc();
            }
            document.getElementById('ml_calc').addEventListener('click', calc);
            document.getElementById('ml_reset').addEventListener('click', reset);
            document.getElementById('f-ml').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['mas-local'] = tool;
})();
