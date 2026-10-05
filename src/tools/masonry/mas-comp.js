/* mas-comp 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '砌体受压承载力与高厚比验算',
        sub: '墙 / 柱偏心受压承载力 · 高厚比验算 · GB 50003-2011 第 5.1、6.1 条',
        meta: {"standard": "GB 50003-2011 砌体结构设计规范", "formulaSource": "5.1.1, 6.1.1", "limitations": "墙/柱受压承载力+高厚比验算，φfA", "unit": "N:kN, f:MPa, β:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">截面尺寸与材料</div>' +
                '<form id="f-mc"><div class="grid2">' +
                selField('mc_type', '砌体类型', opts([
                    { v: 'clay', t: '烧结普通砖 / 多孔砖' },
                    { v: 'block', t: '混凝土小型空心砌块' },
                    { v: 'lime', t: '蒸压灰砂 / 粉煤灰砖' }
                ], 'clay')) +
                selField('mc_mu', '砌块强度等级', opts(MASONRY_TYPES['clay'].unitLabels.map(function (u) { return { v: u, t: u }; }), 'MU20')) +
                selField('mc_mortar', '砂浆强度等级', opts(MASONRY_TYPES['clay'].morLabels.map(function (m) { return { v: m, t: m }; }), 'M7.5')) +
                numField('mc_b', '墙厚 / 截面短边 b', 'mm', 240) +
                numField('mc_h', '墙长 / 截面长边 h', 'mm', 1000, '矩形截面墙柱；T形截面可按折算厚度简化') +
                numField('mc_H0', '计算高度 H₀', 'mm', 3600, '按 5.1.3 条根据房屋静力计算方案与支承条件取用') +
                numField('mc_N', '轴向力设计值 N', 'kN', 200) +
                numField('mc_e', '偏心距 e', 'mm', 24, '轴向力作用点至截面重心的距离；e ≤ 0.6y 为规范限值') +
                selField('mc_support', '两端支承', opts([
                    { v: 'both', t: '两端铰接（β=H₀/h）' },
                    { v: 'one', t: '一端固定一端自由（β=2H₀/h）' }
                ], 'both'), '影响高厚比计算的修正系数方式') +
                selField('mc_mu1', '自承重墙修正 μ₁', opts([
                    { v: '1.0', t: '承重墙 μ₁ = 1.0' },
                    { v: '1.2', t: '厚 240 自承重墙 μ₁ = 1.2' },
                    { v: '1.3', t: '厚 90 自承重墙 μ₁ = 1.5 (插值)' },
                    { v: '1.5', t: '厚 ≤ 90 自承重墙 μ₁ = 1.5' }
                ], '1.0')) +
                selField('mc_mu2', '门窗洞口修正 μ₂', opts([
                    { v: '1.0', t: '无洞口 μ₂ = 1.0' },
                    { v: '0.9', t: '洞口宽/墙宽 = 0.2 (μ₂≈0.9)' },
                    { v: '0.8', t: '洞口宽/墙宽 = 0.4 (μ₂≈0.8)' },
                    { v: '0.7', t: '洞口宽/墙宽 = 0.6 (μ₂≈0.7)' }
                ], '1.0')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="mc_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="mc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="mc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="mc_proc"></div></div></div></div>';
        },
        bind: function () {
            var self = this;
            // 砌体类型切换时更新强度等级选项
            document.getElementById('mc_type').addEventListener('change', function () {
                var t = this.value, meta = MASONRY_TYPES[t];
                var muSel = document.getElementById('mc_mu');
                muSel.innerHTML = meta.unitLabels.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
                muSel.value = meta.unitLabels[2] || meta.unitLabels[0];
                var morSel = document.getElementById('mc_mortar');
                morSel.innerHTML = meta.morLabels.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
                morSel.value = meta.morLabels[2] || meta.morLabels[0];
                calc();
            });

            function phiFcn(alpha, beta, e, h) {
                // GB 50003-2011 附录 D：影响系数 φ（β≤3 时按 1.0 简化）
                var rho = e / h; // 相对偏心距
                var phi;
                if (beta <= 3) {
                    phi = 1.0;
                } else {
                    var phi0 = 1 / (1 + alpha * beta * beta / 12); // 轴心受压稳定系数
                    if (rho === 0) { phi = phi0; }
                    else {
                        // 附录 D.0.1-1 公式：φ = 1 / [1 + 12·((e/h) + sqrt((1/φ0 - 1)/12))²]
                        var term = rho + Math.sqrt((1 / phi0 - 1) / 12);
                        phi = 1 / (1 + 12 * term * term);
                    }
                }
                return phi;
            }

            function calc() {
                var out = document.getElementById('mc_result'), proc = document.getElementById('mc_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var typeV = document.getElementById('mc_type').value;
                var muV = document.getElementById('mc_mu').value;
                var morV = document.getElementById('mc_mortar').value;
                var b = parseFloat(document.getElementById('mc_b').value);
                var h = parseFloat(document.getElementById('mc_h').value);
                var H0 = parseFloat(document.getElementById('mc_H0').value);
                var N = parseFloat(document.getElementById('mc_N').value);
                var e = parseFloat(document.getElementById('mc_e').value);
                var supV = document.getElementById('mc_support').value;
                var mu1 = parseFloat(document.getElementById('mc_mu1').value);
                var mu2 = parseFloat(document.getElementById('mc_mu2').value);
                if (!(b > 0 && h > 0)) return err('截面尺寸 b、h 必须为正数。');
                if (!(H0 > 0)) return err('计算高度 H₀ 必须为正数。');
                if (!(N >= 0)) return err('轴向力 N 不能为负。');
                var meta = MASONRY_TYPES[typeV];
                var f = meta.table[muV] ? meta.table[muV][morV] : undefined;
                if (!f) return err('所选砌块强度等级与砂浆强度等级组合无对应强度值。');
                var st = [];
                // 取截面短边为 b'（高厚比方向），这里假定偏心沿 h 方向
                var hBeta = (b <= h) ? b : h; // 短边，用于高厚比（验算方向偏保守）
                var hLoad = h; // 偏心方向的截面高度
                var beta = H0 / hBeta; // 高厚比
                if (supV === 'one') beta = 2 * beta; // 一端固定一端自由，H0 增大一倍（此处假定用户已输入实际H0，仅做提示）
                // α 系数（附录 D 表 D.0.1-1）：砂浆强度≥M5 取 0.0015，M2.5 取 0.002，≤M1 取 0.009
                var mortarFyNum = parseFloat(morV.replace(/[^\d.]/g, ''));
                var alpha;
                if (mortarFyNum >= 5) alpha = 0.0015;
                else if (mortarFyNum >= 2.5) alpha = 0.002;
                else alpha = 0.009;

                st.push('<div class="step"><b>① 砌体抗压强度设计值</b>　' + meta.name + '，' + muV + ' + ' + morV + ' ⇒ <b>f = ' + f + ' N/mm²</b>（GB 50003-2011 表 3.2.1）</div>');
                st.push('<div class="step"><b>② 截面面积与材料调整</b>　A = b·h = ' + fmt(b,0) + '×' + fmt(h,0) + ' = <b>' + fmt(b*h,0) + ' mm²</b>' +
                    (b*h < 300000 ? '；A < 0.3 m²，调整系数 γₐ = 0.7 + A = ' + fmt(0.7 + b*h/1e6,3) + ' ⇒ f = ' + fmt(f*(0.7 + b*h/1e6),3) + ' N/mm²' : '；A ≥ 0.3 m²，不调整') + '</div>');
                var fAdj = f;
                if (b * h < 300000) { var ga = 0.7 + b * h / 1e6; fAdj = f * ga; }

                // 高厚比验算
                // 允许高厚比 [β]（GB 50003-2011 表 6.1.1）
                var betaAllow;
                if (mortarFyNum >= 7.5) betaAllow = 26;
                else if (mortarFyNum >= 5) betaAllow = 24;
                else if (mortarFyNum >= 2.5) betaAllow = 22;
                else betaAllow = 16;
                var betaLimit = mu1 * mu2 * betaAllow;
                var betaOk = beta <= betaLimit;
                st.push('<div class="step"><b>③ 高厚比验算（6.1.1）</b>　β = H₀/h = ' + fmt(H0,0) + '/' + fmt(hBeta,0) + ' = <b>' + fmt(beta,2) + '</b>；' +
                    '[β] = μ₁μ₂[β]表 = ' + mu1 + '×' + mu2 + '×' + betaAllow + ' = <b>' + fmt(betaLimit,2) + '</b> ⇒ ' +
                    (betaOk ? '满足' + tag('ok','β≤[β]') : '不满足' + tag('err','β>[β]')) + '</div>');

                // 影响系数 φ
                var phi = phiFcn(alpha, beta, e, hLoad);
                st.push('<div class="step"><b>④ 承载力影响系数 φ（附录 D）</b>　α = ' + alpha +
                    '；φ₀ = 1/(1+αβ²/12) = ' + fmt(1 / (1 + alpha * beta * beta / 12), 4) +
                    '；e/h = ' + fmt(e / hLoad, 4) +
                    ' ⇒ <b>φ = ' + fmt(phi, 4) + '</b></div>');

                // 偏心距限值 e ≤ 0.6y (5.1.5)
                var y = hLoad / 2;
                var eLim = 0.6 * y;
                var eOk = e <= eLim;
                st.push('<div class="step"><b>⑤ 偏心距限值（5.1.5）</b>　e = ' + fmt(e,1) + ' mm；0.6y = 0.6×' + fmt(y,0) + ' = ' + fmt(eLim,0) + ' mm ⇒ ' +
                    (eOk ? '满足' + tag('ok','e≤0.6y') : '超限' + tag('err','e>0.6y，应采取措施')) + '</div>');

                // 受压承载力 N ≤ φfA
                var A = b * h; // mm²
                var Nu = phi * fAdj * A / 1000; // kN (N = phi*f*A, f N/mm², A mm² => N, /1000 => kN)
                var nOk = N <= Nu && eOk;
                st.push('<div class="step"><b>⑥ 受压承载力 N ≤ φfA（5.1.1）</b>　N<sub>u</sub> = φ·f·A = ' + fmt(phi,4) + '×' + fmt(fAdj,3) + '×' + fmt(A,0) + ' / 1000 = <b>' + fmt(Nu, 2) + ' kN</b>；N = ' + fmt(N,2) + ' kN ⇒ ' +
                    (N <= Nu ? '满足' + tag('ok','N≤N_u') : '不满足' + tag('err','N>N_u')) + '</div>');

                var html = resultRow('砌体抗压强度设计值 f', fmt(fAdj, 3) + ' N/mm²' + (fAdj !== f ? '（已调 γₐ）' : ''));
                html += resultRow('高厚比 β', fmt(beta, 2) + ' / [β] = ' + fmt(betaLimit, 2) + ' ' + (betaOk ? tag('ok', '满足') : tag('err', '不满足')));
                html += resultRow('影响系数 φ', fmt(phi, 4));
                html += resultRow('偏心距 e', fmt(e, 1) + ' mm / 限值 0.6y = ' + fmt(eLim, 0) + ' mm ' + (eOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('受压承载力 N<sub>u</sub>', '<span class="highlight">' + fmt(Nu, 2) + ' kN</span>');
                html += resultRow('轴向力设计值 N', fmt(N, 2) + ' kN');
                var finalOk = nOk && betaOk;
                html += resultRow('综合判定', badge(finalOk ? 'badge-ok' : 'badge-err', finalOk ? '各项验算均满足' : (betaOk ? (eOk ? '受压承载力不足' : '偏心距超限') : '高厚比不满足')));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._MC_RESULT = { b: b, h: h, H0: H0, f: f, fAdj: fAdj, beta: beta, betaLimit: betaLimit, phi: phi, e: e, eLim: eLim, Nu: Nu, N: N, finalOk: finalOk, steps: st.join(''), typeName: meta.name, mu: muV, mortar: morV };
            }
            function reset() {
                ['mc_b','mc_h','mc_H0','mc_N','mc_e'].forEach(function (id) {
                    document.getElementById(id).value = { mc_b:240, mc_h:1000, mc_H0:3600, mc_N:200, mc_e:24 }[id];
                });
                document.getElementById('mc_type').value = 'clay';
                document.getElementById('mc_mu').innerHTML = MASONRY_TYPES['clay'].unitLabels.map(function(u){return'<option value="'+u+'">'+u+'</option>'}).join('');
                document.getElementById('mc_mu').value = 'MU20';
                document.getElementById('mc_mortar').innerHTML = MASONRY_TYPES['clay'].morLabels.map(function(m){return'<option value="'+m+'">'+m+'</option>'}).join('');
                document.getElementById('mc_mortar').value = 'M7.5';
                document.getElementById('mc_support').value = 'both';
                document.getElementById('mc_mu1').value = '1.0';
                document.getElementById('mc_mu2').value = '1.0';
                calc();
            }
            document.getElementById('mc_calc').addEventListener('click', calc);
            document.getElementById('mc_reset').addEventListener('click', reset);
            document.getElementById('f-mc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['mas-comp'] = tool;
})();
