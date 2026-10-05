/* pile-bearing-55003 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '桩基承载力验算（GB55003）',
        sub: 'Ra=Quk/K · Nk≤R · 地震工况 · 偏心验算 · GB 55003-2021 §5.2',
        meta: {"standard": "GB 55003-2021 建筑与市政地基基础通用规范", "formulaSource": "5.2", "limitations": "标准/地震/偏心4种工况，Ra=Quk/K", "unit": "Nk:kN, Ra:kN, Quk:kN", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">桩基参数</div>' +
                '<form id="f-pb5"><div class="grid2">' +
                numField('pb5_n', '桩数 n', '根', 4) +
                numField('pb5_Ra', '单桩竖向承载力特征值 R<sub>a</sub>', 'kN', 1500, '按§5.2.4: Ra=Quk/K') +
                numField('pb5_K', '安全系数 K', '', 2, '一般取2') +
                '</div><div class="panel-title" style="margin-top:14px;">荷载参数</div><div class="grid2">' +
                numField('pb5_Fk', '承台顶面竖向力 F<sub>k</sub>', 'kN', 4000, '标准组合下') +
                numField('pb5_Gk', '承台及土重 G<sub>k</sub>', 'kN', 800, '承台自重+覆土') +
                numField('pb5_Mk', '弯矩 M<sub>k</sub>', 'kN·m', 300, '标准组合下通过桩群形心') +
                numField('pb5_xmax', '最远桩距形心 x<sub>max</sub>', 'm', 1.5, '最远桩到桩群形心的距离') +
                numField('pb5_Sigma_x2', 'Σx<sub>i</sub>²', 'm²', 9.0, '各桩到形心距离平方和') +
                '</div><div class="panel-title" style="margin-top:14px;">地震工况参数</div><div class="grid2">' +
                numField('pb5_FEk', '地震竖向力 F<sub>Ek</sub>', 'kN', 0, '地震作用效应组合下竖向力（无地震填0）') +
                numField('pb5_MEk', '地震弯矩 M<sub>Ek</sub>', 'kN·m', 0, '地震作用效应组合下弯矩') +
                '</div><div class="hint">说明：依据 GB 55003-2021 §5.2，桩基竖向承载力验算：①标准组合 N<sub>k</sub>≤R；②地震组合 N<sub>Ek</sub>≤1.25R；③偏心标准组合 N<sub>kmax</sub>≤1.2R；④偏心地震组合 N<sub>Ekmax</sub>≤1.5R。单桩承载力特征值 R<sub>a</sub>=Q<sub>uk</sub>/K，K为安全系数。本工具同时验算4种工况。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="pb5_calc">验算承载力</button>' +
                '<button type="button" class="btn btn-secondary" id="pb5_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">验算结果</div><div id="pb5_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="pb5_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('pb5_result');
                var proc = document.getElementById('pb5_proc');
                var n = parseFloat(document.getElementById('pb5_n').value);
                var Ra = parseFloat(document.getElementById('pb5_Ra').value);
                var K = parseFloat(document.getElementById('pb5_K').value);
                var Fk = parseFloat(document.getElementById('pb5_Fk').value);
                var Gk = parseFloat(document.getElementById('pb5_Gk').value);
                var Mk = parseFloat(document.getElementById('pb5_Mk').value);
                var xmax = parseFloat(document.getElementById('pb5_xmax').value);
                var SigmaX2 = parseFloat(document.getElementById('pb5_Sigma_x2').value);
                var FEk = parseFloat(document.getElementById('pb5_FEk').value);
                var MEk = parseFloat(document.getElementById('pb5_MEk').value);
                var st = [];
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.remove('open'); return; }

                // 输入校验
                if (isNaN(n) || n <= 0 || !isFinite(n)) return err('桩数 n 必须大于 0。');
                if (isNaN(Ra) || Ra <= 0 || !isFinite(Ra)) return err('单桩竖向承载力特征值 Ra 必须大于 0。');
                if (isNaN(K) || K <= 0 || !isFinite(K)) return err('安全系数 K 必须大于 0。');
                if (isNaN(Fk) || Fk < 0 || !isFinite(Fk)) return err('竖向力 Fk 不能为负值。');
                if (isNaN(Gk) || Gk < 0 || !isFinite(Gk)) return err('承台及土重 Gk 不能为负值。');
                if (isNaN(Mk) || !isFinite(Mk)) return err('弯矩 Mk 输入无效。');
                if (isNaN(xmax) || xmax < 0 || !isFinite(xmax)) return err('最远桩距形心 xmax 不能为负值。');
                if (isNaN(SigmaX2) || SigmaX2 <= 0 || !isFinite(SigmaX2)) return err('Σx_i² 必须大于 0（防止除零）。');
                if (isNaN(FEk) || !isFinite(FEk)) return err('地震竖向力 FEk 输入无效。');
                if (isNaN(MEk) || !isFinite(MEk)) return err('地震弯矩 MEk 输入无效。');

                // ① 单桩承载力特征值
                var Quk = Ra * K;
                st.push('<div class="step"><b>① 单桩竖向承载力特征值 R<sub>a</sub>（§5.2.4）</b></div>');
                st.push('<div class="step">　　R<sub>a</sub> = Q<sub>uk</sub> / K = ' + fmt(Quk,0) + ' / ' + K + ' = <b>' + fmt(Ra,0) + ' kN</b></div>');

                // ② 工况1：标准组合轴心（式5.2.1-1）
                var Nk = (Fk + Gk) / n;
                var R = Ra; // 群桩中基桩竖向承载力特征值
                var ok1 = Nk <= R;
                st.push('<div class="step"><b>② 工况1：标准组合轴心（式5.2.1-1）</b></div>');
                st.push('<div class="step">　　N<sub>k</sub> = (F<sub>k</sub>+G<sub>k</sub>)/n = (' + Fk + '+' + Gk + ')/' + n + ' = <b>' + fmt(Nk,1) + ' kN</b></div>');
                st.push('<div class="step">　　R = ' + fmt(R,0) + ' kN → N<sub>k</sub> ' + (ok1?'≤':'>') + ' R ' + tag(ok1?'ok':'err', ok1?'满足':'不满足') + '</div>');

                // ③ 工况2：地震组合轴心（式5.2.1-2）
                var NEk = (FEk + Gk) / n;
                var R_earthq = 1.25 * R;
                var ok2 = NEk <= R_earthq;
                st.push('<div class="step"><b>③ 工况2：地震组合轴心（式5.2.1-2）</b></div>');
                st.push('<div class="step">　　N<sub>Ek</sub> = (F<sub>Ek</sub>+G<sub>k</sub>)/n = (' + FEk + '+' + Gk + ')/' + n + ' = <b>' + fmt(NEk,1) + ' kN</b></div>');
                st.push('<div class="step">　　1.25R = 1.25×' + fmt(R,0) + ' = <b>' + fmt(R_earthq,0) + ' kN</b> → ' + tag(ok2?'ok':'err', ok2?'满足':'不满足') + '</div>');

                // ④ 工况3：偏心标准组合（式5.2.2-1）
                var Nkmax = Nk + Mk * xmax / SigmaX2;
                var R_ecc = 1.2 * R;
                var ok3 = Nkmax <= R_ecc;
                st.push('<div class="step"><b>④ 工况3：偏心标准组合（式5.2.2-1）</b></div>');
                st.push('<div class="step">　　N<sub>k,max</sub> = N<sub>k</sub> + M<sub>k</sub>·x<sub>max</sub>/Σx<sub>i</sub>²</div>');
                st.push('<div class="step">　　= ' + fmt(Nk,1) + ' + ' + Mk + '×' + xmax + '/' + SigmaX2 + ' = <b>' + fmt(Nkmax,1) + ' kN</b></div>');
                st.push('<div class="step">　　1.2R = 1.2×' + fmt(R,0) + ' = <b>' + fmt(R_ecc,0) + ' kN</b> → ' + tag(ok3?'ok':'err', ok3?'满足':'不满足') + '</div>');

                // ⑤ 工况4：偏心地震组合（式5.2.2-2）
                var NEkmax = NEk + MEk * xmax / SigmaX2;
                var R_ecc_eq = 1.5 * R;
                var ok4 = NEkmax <= R_ecc_eq;
                st.push('<div class="step"><b>⑤ 工况4：偏心地震组合（式5.2.2-2）</b></div>');
                st.push('<div class="step">　　N<sub>Ek,max</sub> = N<sub>Ek</sub> + M<sub>Ek</sub>·x<sub>max</sub>/Σx<sub>i</sub>²</div>');
                st.push('<div class="step">　　= ' + fmt(NEk,1) + ' + ' + MEk + '×' + xmax + '/' + SigmaX2 + ' = <b>' + fmt(NEkmax,1) + ' kN</b></div>');
                st.push('<div class="step">　　1.5R = 1.5×' + fmt(R,0) + ' = <b>' + fmt(R_ecc_eq,0) + ' kN</b> → ' + tag(ok4?'ok':'err', ok4?'满足':'不满足') + '</div>');

                var allOk = ok1 && ok2 && ok3 && ok4;
                var html = resultRow('单桩极限承载力 Q<sub>uk</sub>', fmt(Quk,0) + ' kN');
                html += resultRow('单桩特征值 R<sub>a</sub>', fmt(Ra,0) + ' kN');
                html += resultRow('标准轴心 N<sub>k</sub>/R', fmt(Nk,1) + '/' + fmt(R,0) + ' ' + badge(ok1?'badge-ok':'badge-err', ok1?'✓' : '✗'));
                html += resultRow('地震轴心 N<sub>Ek</sub>/1.25R', fmt(NEk,1) + '/' + fmt(R_earthq,0) + ' ' + badge(ok2?'badge-ok':'badge-err', ok2?'✓' : '✗'));
                html += resultRow('偏心标准 N<sub>kmax</sub>/1.2R', fmt(Nkmax,1) + '/' + fmt(R_ecc,0) + ' ' + badge(ok3?'badge-ok':'badge-err', ok3?'✓' : '✗'));
                html += resultRow('偏心地震 N<sub>Ekmax</sub>/1.5R', fmt(NEkmax,1) + '/' + fmt(R_ecc_eq,0) + ' ' + badge(ok4?'badge-ok':'badge-err', ok4?'✓' : '✗'));
                html += resultRow('综合判定', badge(allOk?'badge-ok':'badge-err', allOk?'桩基承载力满足' : '桩基承载力不满足'));
                html += resultRow('依据', badge('badge-ok', 'GB 55003-2021 §5.2'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('pb5_n').value = 4;
                document.getElementById('pb5_Ra').value = 1500;
                document.getElementById('pb5_K').value = 2;
                document.getElementById('pb5_Fk').value = 4000;
                document.getElementById('pb5_Gk').value = 800;
                document.getElementById('pb5_Mk').value = 300;
                document.getElementById('pb5_xmax').value = 1.5;
                document.getElementById('pb5_Sigma_x2').value = 9.0;
                document.getElementById('pb5_FEk').value = 0;
                document.getElementById('pb5_MEk').value = 0;
                calc();
            }
            document.getElementById('pb5_calc').addEventListener('click', calc);
            document.getElementById('pb5_reset').addEventListener('click', reset);
            document.getElementById('f-pb5').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pile-bearing-55003'] = tool;
})();
