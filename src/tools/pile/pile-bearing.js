/* pile-bearing 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '桩基竖向承载力验算',
        sub: '群桩 N_k ≤ R_a / N_kmax ≤ 1.2R_a · 承台效应 · JGJ 94-2008 第 5.1 / 5.2 条',
        meta: {"standard": "JGJ 94-2008 建筑桩基技术规范", "formulaSource": "5.2.1, 5.2.2", "limitations": "群桩基础，Nk≤Ra, Nkmax≤1.2Ra", "unit": "N:kN, Ra:kN", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">基础与荷载参数</div>' +
                '<form id="f-pb"><div class="grid2">' +
                numField('pb_n', '桩数 n', '根', 4) +
                numField('pb_s', '桩间距 s', 'mm', 1500, '桩中心距，用于判断承台效应') +
                numField('pb_d', '桩径 d', 'mm', 600) +
                numField('pb_Bx', '承台宽度 B<sub>x</sub>', 'm', 3.6) +
                numField('pb_By', '承台宽度 B<sub>y</sub>', 'm', 3.6) +
                numField('pb_dc', '承台埋深 d', 'm', 2.0) +
                numField('pb_Ra', '单桩承载力特征值 R<sub>a</sub>', 'kN', 1500, '由单桩承载力计算结果或静载试验确定') +
                numField('pb_Fk', '上部轴力 F<sub>k</sub>', 'kN', 3600, '荷载效应标准组合下柱底轴力') +
                numField('pb_Mk', '弯矩 M<sub>k</sub>', 'kN·m', 200, '标准组合下承台底面弯矩；按单方向偏心率计算最大反力') +
                numField('pb_Gk', '承台及上覆土重 G<sub>k</sub>', 'kN', 0, '填 0 则按 γ_G·B·B·d 估算') +
                selField('pb_comp', '是否考虑承台效应', opts([
                    { v: 'none', t: '不考虑（端承桩 / 软土 / 减沉复合疏桩除外）' },
                    { v: 'yes', t: '考虑承台效应（摩擦型桩）' }
                ], 'none'), '按 5.2.5 条，端承桩不考虑；摩擦桩符合条件时可考虑') +
                numField('pb_fak', '承台下地基承载力 f<sub>ak</sub>', 'kPa', 120, '考虑承台效应时填入承台下土承载力特征值') +
                numField('pb_etaC', '承台效应系数 η<sub>c</sub>', '', 0.12, '按 5.2.5 查表；按 s_a/d = 3、Bc/l = 0.7 取近似值') +
                selField('pb_seismic', '是否地震作用', opts([
                    { v: 'no', t: '非地震作用组合' },
                    { v: 'yes', t: '地震作用效应组合' }
                ], 'no')) +
                '</div><div class="hint">提示：偏心方向假定为沿承台宽度 B 方向（单列或多列桩布置）。N<sub>ik</sub> = (F<sub>k</sub>+G<sub>k</sub>)/n ± M<sub>k</sub>·x<sub>i</sub>/Σx<sub>j</sub>² 。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="pb_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="pb_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="pb_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="pb_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('pb_result'), proc = document.getElementById('pb_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var n = parseInt(document.getElementById('pb_n').value);
                var s = parseFloat(document.getElementById('pb_s').value);
                var d = parseFloat(document.getElementById('pb_d').value);
                var Bx = parseFloat(document.getElementById('pb_Bx').value);
                var By = parseFloat(document.getElementById('pb_By').value);
                var dc = parseFloat(document.getElementById('pb_dc').value);
                var Ra = parseFloat(document.getElementById('pb_Ra').value);
                var Fk = parseFloat(document.getElementById('pb_Fk').value);
                var Mk = parseFloat(document.getElementById('pb_Mk').value);
                var Gk_in = parseFloat(document.getElementById('pb_Gk').value);
                var compV = document.getElementById('pb_comp').value;
                var fak = parseFloat(document.getElementById('pb_fak').value);
                var etaC = parseFloat(document.getElementById('pb_etaC').value);
                var seismicV = document.getElementById('pb_seismic').value;
                if (!(n >= 1)) return err('桩数必须 ≥ 1。');
                if (!(s > 0 && d > 0)) return err('桩间距和桩径必须为正数。');
                if (!(Bx > 0 && By > 0)) return err('承台尺寸必须为正数。');
                if (!(Ra > 0)) return err('单桩承载力必须为正数。');
                if (!(Fk > 0)) return err('轴力必须为正数。');
                var st = [];

                // 承台及土重
                var Gk = Gk_in > 0 ? Gk_in : 20 * Bx * By * dc;
                var Ac = Bx * By; // m²
                st.push('<div class="step"><b>① 基本参数</b>　桩数 n = ' + n + '；承台 B<sub>x</sub>×B<sub>y</sub> = ' + fmt(Bx,2) + '×' + fmt(By,2) + ' m；' +
                    'A<sub>c</sub> = ' + fmt(Ac,2) + ' m²；埋深 d = ' + fmt(dc,2) + ' m；G<sub>k</sub> = ' + fmt(Gk,1) + ' kN</div>');

                // 单桩平均反力
                var Nk_avg = (Fk + Gk) / n; // kN
                // 最大反力（按n根桩沿B方向均匀布置，偏心距最大的桩）
                // 桩布置：设 nx 列 × ny 行 = n 根。简化：假设全部桩沿 x 方向一排（单列）或多排矩形布置未知。
                // 保守估算：假设 n 根桩沿弯矩方向等间距布置，总宽度 = (n-1)*s
                // 最远桩距形心距离 x_max = (n-1)/2 * s  (单列)
                var xmax = (n - 1) / 2 * s / 1000; // m (假定单列布置，偏保守)
                // I = Σx_i² = 2 * Σ (i*s)^2 from i=1 to floor(n/2)
                var Ix = 0;
                for (var i = 0; i < n; i++) {
                    var xi = ((n - 1) / 2 - i) * s / 1000;
                    Ix += xi * xi;
                }
                var Nkmax = Nk_avg + Mk * xmax / Ix;
                var Nkmin = Nk_avg - Mk * xmax / Ix;
                if (Nkmin < 0) Nkmin = 0;
                st.push('<div class="step"><b>② 桩顶反力（5.1.1）</b>　N<sub>k</sub> = (F<sub>k</sub>+G<sub>k</sub>)/n = (' + fmt(Fk,0) + '+' + fmt(Gk,1) + ')/' + n + ' = <b>' + fmt(Nk_avg, 1) + ' kN</b></div>');
                st.push('<div class="step">　　N<sub>k,max</sub> = N<sub>k</sub> + M<sub>k</sub>·x<sub>max</sub>/I = ' + fmt(Nkmax, 1) + ' kN；N<sub>k,min</sub> = ' + fmt(Nkmin, 1) + ' kN</div>');
                st.push('<div class="step">　　<span style="font-size:12px;color:var(--muted);">注：按单列布置（沿弯矩方向 n 根桩等间距）计算最大反力；若为多列布置，实际最大反力会更小。</span></div>');

                // 承载力验算
                var factor_avg = 1.0, factor_max = 1.2;
                if (seismicV === 'yes') { factor_avg = 1.25; factor_max = 1.5; }
                var RAllow_avg = factor_avg * Ra; // kN, 平均反力限值
                var RAllow_max = factor_max * Ra; // kN, 最大反力限值

                // 考虑承台效应时，复合基桩承载力 R = Ra + etaC * fak * Ac / n (5.2.5)
                var Rc = 0, Rc_max = 0;
                if (compV === 'yes') {
                    // R = R_a + η_c * f_ak * A_c / n  (5.2.5-1 复合基桩特征值)
                    // 实际公式：R = R_a + η_c * f_ak * (A_c - n*A_p) / n
                    // 简化：η_c * f_ak * A_c / n (忽略扣除桩面积)
                    var Ap = Math.PI * d * d / 4 / 1e6; // m²
                    var Apc = Ac - n * Ap;
                    if (Apc < 0) Apc = 0;
                    var Rc_avg = Ra + etaC * fak * Apc / n;
                    var Rc_max = factor_max * Ra + etaC * fak * Apc / n * 1.0; // 保守: 承台底反力均布不计偏心放大
                    st.push('<div class="step"><b>③ 承台效应（5.2.5）</b>　η<sub>c</sub> = ' + etaC + '；f<sub>ak</sub> = ' + fak + ' kPa；' +
                        'A<sub>c</sub> − nA<sub>p</sub> = ' + fmt(Apc, 2) + ' m²</div>');
                    st.push('<div class="step">　　复合基桩承载力 R = R<sub>a</sub> + η<sub>c</sub>·f<sub>ak</sub>·A<sub>pc</sub>/n = ' + fmt(Ra,0) + ' + ' + etaC + '×' + fak + '×' + fmt(Apc,2) + '/' + n + ' = <b>' + fmt(Rc_avg, 1) + ' kN</b></div>');
                }

                var avgOk = Nk_avg <= (compV === 'yes' ? Rc_avg : RAllow_avg);
                var maxOk = Nkmax <= (compV === 'yes' ? Rc_max : RAllow_max);
                // 注：规范5.2.1 是 N_k ≤ R, N_kmax ≤ 1.2R (非地震); 地震 5.2.2: N_k ≤ 1.25R, N_kmax ≤ 1.5R
                // 上面 factor_max 对非地震是 1.2。avg 是 1.0。
                // 若考虑承台效应，按5.2.5 说明：竖向承载力验算仍按 5.2.1 条，但 R 改用复合基桩 R
                var avgLim = compV === 'yes' ? (seismicV==='yes' ? 1.25*Ra + etaC*fak*(Ac-n*Math.PI*d*d/4/1e6)/n : Ra + etaC*fak*(Ac-n*Math.PI*d*d/4/1e6)/n) : RAllow_avg;
                var maxLim = compV === 'yes' ? (seismicV==='yes' ? 1.5*Ra + etaC*fak*(Ac-n*Math.PI*d*d/4/1e6)/n : 1.2*Ra + etaC*fak*(Ac-n*Math.PI*d*d/4/1e6)/n) : RAllow_max;
                avgOk = Nk_avg <= avgLim;
                maxOk = Nkmax <= maxLim;

                st.push('<div class="step"><b>④ 竖向承载力验算（5.2.1 / 5.2.2）</b></div>');
                st.push('<div class="step">　　平均反力：N<sub>k</sub> = ' + fmt(Nk_avg,1) + ' kN ≤ ' + fmt(avgLim,1) + ' kN ' +
                    (compV === 'yes' ? '（复合基桩，含承台效应）' : '（R<sub>a</sub> = ' + Ra + ' kN）') +
                    ' ⇒ ' + (avgOk ? '满足' + tag('ok','Nk≤R') : '不满足' + tag('err','Nk>R')) + '</div>');
                st.push('<div class="step">　　最大反力：N<sub>k,max</sub> = ' + fmt(Nkmax,1) + ' kN ≤ ' + fmt(maxLim,1) + ' kN ' +
                    ' ⇒ ' + (maxOk ? '满足' + tag('ok','Nkmax≤1.2R') : '不满足' + tag('err','Nkmax>1.2R')) + '</div>');

                var allOk = avgOk && maxOk;
                var html = resultRow('桩数 n', n + ' 根');
                html += resultRow('单桩承载力特征值 R<sub>a</sub>', fmt(Ra, 0) + ' kN');
                html += resultRow('平均桩反力 N<sub>k</sub>', fmt(Nk_avg, 1) + ' kN / 限值 ' + fmt(avgLim,1) + ' kN ' + (avgOk ? tag('ok','满足') : tag('err','超出')));
                html += resultRow('最大桩反力 N<sub>k,max</sub>', fmt(Nkmax, 1) + ' kN / 限值 ' + fmt(maxLim,1) + ' kN ' + (maxOk ? tag('ok','满足') : tag('err','超出')));
                if (compV === 'yes') html += resultRow('承台效应', 'η<sub>c</sub> = ' + etaC + '，复合基桩 R = ' + fmt(avgLim, 1) + ' kN');
                html += resultRow('验算工况', seismicV === 'yes' ? '地震作用组合（提高系数 1.25 / 1.5）' : '非地震作用（系数 1.0 / 1.2）');
                html += resultRow('判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '桩基竖向承载力满足要求' : '桩基竖向承载力不满足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._PB_RESULT = { n: n, Nk_avg: Nk_avg, Nkmax: Nkmax, Ra: Ra, avgOk: avgOk, maxOk: maxOk, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['pb_n','pb_s','pb_d','pb_Bx','pb_By','pb_dc','pb_Ra','pb_Fk','pb_Mk','pb_Gk','pb_fak','pb_etaC'].forEach(function (id) {
                    var defs = { pb_n:4, pb_s:1500, pb_d:600, pb_Bx:3.6, pb_By:3.6, pb_dc:2.0, pb_Ra:1500, pb_Fk:3600, pb_Mk:200, pb_Gk:0, pb_fak:120, pb_etaC:0.12 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('pb_comp').value = 'none';
                document.getElementById('pb_seismic').value = 'no';
                calc();
            }
            document.getElementById('pb_calc').addEventListener('click', calc);
            document.getElementById('pb_reset').addEventListener('click', reset);
            document.getElementById('f-pb').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pile-bearing'] = tool;
})();
