(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 建筑地基基础设计规范",
            formulaSource: "8.1.1",
            limitations: "刚性基础，台阶宽高比/刚性角控制",
            unit: "b:mm, H:mm, pk:kPa",
            version: "1.0.0"
        },
        title: '无筋扩展条形基础',
        sub: '刚性基础宽度与高度 · 台阶宽高比 · GB 50007-2011 第 8.1 条',
        render: function () {
            return '<div class="panel"><div class="panel-title">墙体与地基参数</div>' +
                '<form id="f-rf"><div class="grid2">' +
                numField('rf_bw', '墙厚 b<sub>w</sub>', 'mm', 240) +
                numField('rf_Fk', '上部荷载 F<sub>k</sub>（每延米）', 'kN/m', 180, '每延米线荷载标准组合值') +
                numField('rf_d', '基础埋深 d', 'm', 1.5) +
                numField('rf_fak', '地基承载力特征值 f<sub>ak</sub>', 'kPa', 160) +
                numField('rf_etaD', '深度修正系数 η<sub>d</sub>', '', 1.6) +
                numField('rf_gammaM', '基础以上土加权平均重度 γ<sub>m</sub>', 'kN/m³', 19.0) +
                numField('rf_gammaG', '基础及填土平均重度', 'kN/m³', 20, '一般取 20 kN/m³') +
                selField('rf_mat', '基础材料', opts([
                    { v: 'brick', t: '砖基础（M5 砂浆）' },
                    { v: 'stone', t: '毛石基础（M5 砂浆）' },
                    { v: 'concrete', t: '素混凝土基础' },
                    { v: 'lime', t: '灰土基础（3:7）' },
                    { v: 'trifly', t: '三合土基础' }
                ], 'brick')) +
                selField('rf_quality', '质量等级 / 基底压力', opts([
                    { v: 'low', t: 'pₖ ≤ 100 kPa' },
                    { v: 'mid', t: '100 < pₖ ≤ 200 kPa' },
                    { v: 'high', t: '200 < pₖ ≤ 300 kPa' }
                ], 'mid')) +
                numField('rf_stepH', '每步台阶高度 h₀', 'mm', 120, '砖基础每皮高度约 60~120mm；混凝土台阶不小于 200mm') +
                '</div><div class="hint">宽高比允许值按 GB 50007-2011 表 8.1.1：无筋扩展基础台阶宽高比的允许值。基础高度应满足 b₂/H₀ ≤ tanα（允许宽高比）。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="rf_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="rf_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="rf_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="rf_proc"></div></div></div></div>';
        },
        bind: function () {
            // 表 8.1.1 台阶宽高比允许值 (b2/H0) 列：p≤100, 100<p≤200, 200<p≤300
            var ALLOW_RATIO = {
                'brick':    { 'low': '1:1.50', 'mid': '1:1.50', 'high': '1:1.25', vals: [1/1.50, 1/1.50, 1/1.25] },
                'stone':    { 'low': '1:1.25', 'mid': '1:1.25', 'high': '1:1.00', vals: [1/1.25, 1/1.25, 1/1.00] },
                'concrete': { 'low': '1:1.00', 'mid': '1:1.00', 'high': '1:1.00', vals: [1/1.00, 1/1.00, 1/1.00] },
                'lime':     { 'low': '1:1.25', 'mid': '1:1.25', 'high': '—', vals: [1/1.25, 1/1.25, 0] },
                'trifly':   { 'low': '1:1.50', 'mid': '1:1.50', 'high': '—', vals: [1/1.50, 1/1.50, 0] }
            };

            function calc() {
                var out = document.getElementById('rf_result'), proc = document.getElementById('rf_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var bw = parseFloat(document.getElementById('rf_bw').value); // mm
                var Fk = parseFloat(document.getElementById('rf_Fk').value); // kN/m
                var d = parseFloat(document.getElementById('rf_d').value); // m
                var fak = parseFloat(document.getElementById('rf_fak').value);
                var etaD = parseFloat(document.getElementById('rf_etaD').value);
                var gammaM = parseFloat(document.getElementById('rf_gammaM').value);
                var gammaG = parseFloat(document.getElementById('rf_gammaG').value);
                var matV = document.getElementById('rf_mat').value;
                var qualV = document.getElementById('rf_quality').value;
                var stepH = parseFloat(document.getElementById('rf_stepH').value); // mm
                if (!(bw > 0)) return err('墙厚必须为正数。');
                if (!(Fk > 0)) return err('荷载必须为正数。');
                if (!(fak > 0)) return err('承载力必须为正数。');
                if (!(stepH > 0)) return err('台阶高度必须为正数。');
                var st = [];

                // 修正地基承载力（仅深度修正，因 b<3m 宽度修正为 0）
                var fa = fak + etaD * gammaM * (d - 0.5);
                st.push('<div class="step"><b>① 地基承载力修正（5.2.4）</b>　条形基础 b＜3 m，仅做深度修正。' +
                    'f<sub>a</sub> = f<sub>ak</sub> + η<sub>d</sub>γ<sub>m</sub>(d−0.5) = ' + fak + ' + ' + etaD + '×' + gammaM + '×(' + fmt(d,2) + '−0.5) = <b>' + fmt(fa, 1) + ' kPa</b></div>');

                // 确定基础宽度 b (每延米)
                // p_k = (F_k + G_k) / b <= f_a
                // G_k = gammaG * d * b * 1  (每延米)
                // p_k = F_k/b + gammaG * d <= f_a
                // b >= F_k / (f_a - gammaG * d)
                var bReq = Fk / (fa - gammaG * d); // m
                var bDesign = Math.ceil(bReq * 100) / 100; // 向上取整到 cm
                // 取 100mm 模数
                bDesign = Math.ceil(bDesign * 10) / 10; // 到 10cm 模数
                if (bDesign < 0.6) bDesign = 0.6; // 最小宽度
                st.push('<div class="step"><b>② 基础底宽确定</b>　b ≥ F<sub>k</sub>/(f<sub>a</sub>−γ<sub>G</sub>d) = ' + fmt(Fk,0) + '/(' + fmt(fa,1) + '−' + gammaG + '×' + fmt(d,2) + ') = ' + fmt(bReq, 3) + ' m</div>');
                st.push('<div class="step">　　<b>设计取值 b = ' + fmt(bDesign, 1) + ' m</b>（按 100 mm 模数向上取整）</div>');

                // 基底压力验算
                var Gk = gammaG * d * bDesign * 1; // kN/m
                var pk = (Fk + Gk) / bDesign; // kPa
                var pkOk = pk <= fa;
                st.push('<div class="step"><b>③ 基底压力验算</b>　p<sub>k</sub> = (F<sub>k</sub>+G<sub>k</sub>)/b = (' + fmt(Fk,0) + '+' + fmt(Gk,1) + ')/' + fmt(bDesign,1) + ' = <b>' + fmt(pk, 1) + ' kPa</b> ≤ f<sub>a</sub> = ' + fmt(fa,1) + ' kPa ⇒ ' +
                    (pkOk ? '满足' + tag('ok','pk≤fa') : '不满足' + tag('err','pk>fa')) + '</div>');

                // 确定台阶宽高比允许值
                var ratioInfo = ALLOW_RATIO[matV];
                var qualIdx = { 'low': 0, 'mid': 1, 'high': 2 }[qualV];
                var allowRatio = ratioInfo.vals[qualIdx]; // b2/H0 比值
                var allowStr = ratioInfo[qualV];
                if (allowRatio <= 0) { return err('所选材料在该压力等级下无适用宽高比（如灰土/三合土不宜用于 p_k>200 kPa 情况）。'); }
                st.push('<div class="step"><b>④ 台阶宽高比允许值（表 8.1.1）</b>　材料：' +
                    document.querySelector('#rf_mat option[value="' + matV + '"]').textContent +
                    '；压力等级：' + document.querySelector('#rf_quality option[value="' + qualV + '"]').textContent +
                    ' ⇒ 允许宽高比 b₂/H₀ = <b>' + allowStr + '</b></div>');

                // 每侧挑出长度 b2
                var b2_total = (bDesign * 1000 - bw) / 2; // mm，每侧总挑出
                // 所需总高度 H0 >= b2 / tanα = b2 * (宽高比分母/分子) = b2 / allowRatio
                var H0_req = b2_total / allowRatio; // mm
                // 按台阶数 n = ceil(H0_req / stepH)
                var nStep = Math.ceil(H0_req / stepH);
                if (nStep < 1) nStep = 1;
                if (nStep > 8) nStep = 8; // 上限
                var H0_actual = nStep * stepH;
                var actualRatio = b2_total / H0_actual;
                var ratioOk = actualRatio <= allowRatio + 0.001;
                st.push('<div class="step"><b>⑤ 基础高度 H₀ 计算</b>　每侧挑出 b₂ = (b−b<sub>w</sub>)/2 = (' + fmt(bDesign*1000,0) + '−' + fmt(bw,0) + ')/2 = ' + fmt(b2_total, 0) + ' mm</div>');
                st.push('<div class="step">　　所需高度 H₀ ≥ b₂/(b₂/H₀)<sub>允</sub> = ' + fmt(b2_total,0) + ' / ' + allowStr.split(':')[1] + '（每单位挑出需' + allowStr.split(':')[1] + '高） = <b>' + fmt(H0_req, 0) + ' mm</b></div>');
                st.push('<div class="step">　　台阶高度 h₀ = ' + fmt(stepH,0) + ' mm；台阶数 n = ⌈H₀/h₀⌉ = ' + nStep + ' 步 ⇒ 实际 H₀ = <b>' + fmt(H0_actual, 0) + ' mm</b></div>');
                st.push('<div class="step">　　实际宽高比 b₂/H₀ = ' + fmt(b2_total,0) + '/' + fmt(H0_actual,0) + ' = 1 : ' + fmt(H0_actual/b2_total, 2) + '，允许 ' + allowStr + ' ⇒ ' +
                    (ratioOk ? '满足' + tag('ok','宽高比满足') : '不满足' + tag('err','宽高比超限')) + '</div>');

                // 每步挑出量（均匀分步）
                var eachStepOut = b2_total / nStep; // mm/步
                var stepOutRatio = eachStepOut / stepH; // 每步的 b2/h0
                st.push('<div class="step"><b>⑥ 每步台阶挑出</b>　均匀分步：每步挑出 = b₂/n = ' + fmt(b2_total,0) + '/' + nStep + ' = ' + fmt(eachStepOut, 1) + ' mm；' +
                    '每步 b₂/h₀ = ' + fmt(stepOutRatio, 3) + ' ≤ ' + fmt(allowRatio, 3) + ' ⇒ ' +
                    (stepOutRatio <= allowRatio + 0.001 ? '满足' + tag('ok','每步满足') : '每步超' + tag('err','每步超限')) + '</div>');

                var allOk = pkOk && ratioOk;
                var html = resultRow('修正后承载力 f<sub>a</sub>', fmt(fa, 1) + ' kPa');
                html += resultRow('基底设计宽度 b', fmt(bDesign, 1) + ' m');
                html += resultRow('基底平均压力 p<sub>k</sub>', fmt(pk, 1) + ' kPa ' + (pkOk ? tag('ok','≤ fa') : tag('err','> fa')));
                html += resultRow('允许宽高比 b₂/H₀', allowStr);
                html += resultRow('基础总高度 H₀', '<span class="highlight">' + fmt(H0_actual, 0) + ' mm</span>（' + nStep + ' 步 × ' + fmt(stepH,0) + ' mm）');
                html += resultRow('每步挑出', fmt(eachStepOut, 1) + ' mm');
                html += resultRow('判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '刚性基础宽高比与承载力均满足' : '不满足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._RF_RESULT = { fa: fa, bDesign: bDesign, pk: pk, H0: H0_actual, nStep: nStep, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['rf_bw','rf_Fk','rf_d','rf_fak','rf_etaD','rf_gammaM','rf_gammaG','rf_stepH'].forEach(function (id) {
                    var defs = { rf_bw:240, rf_Fk:180, rf_d:1.5, rf_fak:160, rf_etaD:1.6, rf_gammaM:19.0, rf_gammaG:20, rf_stepH:120 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('rf_mat').value = 'brick';
                document.getElementById('rf_quality').value = 'mid';
                calc();
            }
            document.getElementById('rf_calc').addEventListener('click', calc);
            document.getElementById('rf_reset').addEventListener('click', reset);
            document.getElementById('f-rf').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            // 监听 select 变化自动更新
            document.getElementById('rf_mat').addEventListener('change', calc);
            document.getElementById('rf_quality').addEventListener('change', calc);
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['rigid-found'] = tool;
})();
