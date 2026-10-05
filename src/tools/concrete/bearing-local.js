(function () {
    var tool = {
        title: '混凝土局部受压',
        sub: '局部受压承载力 · 含间接钢筋提高 · GB/T 50010-2010（2024年版） 第 6.6 章',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '6.6.1',
            limitations: '局部均匀受压，可配置间接钢筋提高',
            unit: 'Fl:kN, βc:—, Al,Ab:mm²',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">基本参数</div>' +
                '<form id="f-bl"><div class="grid2">' +
                numField('bl_Al', '局部受压面积 A<sub>l</sub>', 'mm²', 125600, '如直径 400mm 圆形 ≈ 125600 mm²；200×200 方 = 40000 mm²') +
                numField('bl_Ab', '局部受压计算底面积 A<sub>b</sub>', 'mm²', 360000, '按同心对称原则确定，一般 A<sub>b</sub>/A<sub>l</sub> ≥ 3') +
                numField('bl_Aln', '局部受压净面积 A<sub>ln</sub>', 'mm²', 113000, '扣除孔道后的面积，无孔道时等于 A_l') +
                selField('bl_con', '混凝土强度等级', conOpts('C30')) +
                numField('bl_Fl', '局部压力设计值 F<sub>l</sub>', 'kN', 3000) +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">间接钢筋（选填，不配则填 0）</div><div class="grid2">' +
                selField('bl_type', '间接钢筋形式', opts([{v:'none',t:'不配间接钢筋'},{v:'mesh',t:'方格网式'},{v:'spiral',t:'螺旋式'}], 'mesh')) +
                numField('bl_dv', '钢筋直径 d（方格网）', 'mm', 8, '方格网式：单根钢筋截面面积计算用') +
                numField('bl_s1', '钢筋网间距 s<sub>1</sub>', 'mm', 50, '方格网沿一个方向的钢筋间距') +
                numField('bl_s2', '钢筋网间距 s<sub>2</sub>', 'mm', 50, '方格网沿另一个方向的钢筋间距') +
                numField('bl_n1', '一个方向钢筋根数 n<sub>1</sub>', '根', 6, '方格网式：s1 方向钢筋根数') +
                numField('bl_n2', '另一方向钢筋根数 n<sub>2</sub>', '根', 6, '方格网式：s2 方向钢筋根数') +
                numField('bl_cor', '螺旋式核心面积 A<sub>cor</sub>', 'mm²', 0, '螺旋式：核心范围面积；方格网填 0') +
                numField('bl_dsp', '螺旋式钢筋直径 d', 'mm', 0, '螺旋式单根钢筋直径') +
                numField('bl_ssp', '螺旋式间距 s', 'mm', 0, '螺旋式钢筋间距') +
                numField('bl_h', '间接钢筋范围高度 h', 'mm', 200, '间接钢筋布置范围内的高度') +
                selField('bl_reb', '间接钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'},{v:'HPB300',t:'HPB300'}], 'HRB400')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="bl_calc">验算局部受压</button>' +
                '<button type="button" class="btn btn-secondary" id="bl_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">局部受压验算结果</div><div id="bl_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="bl_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('bl_result');
                var proc = document.getElementById('bl_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }

                var Al = parseFloat(document.getElementById('bl_Al').value);
                var Ab = parseFloat(document.getElementById('bl_Ab').value);
                var Aln = parseFloat(document.getElementById('bl_Aln').value) || Al;
                var con = CONCRETE[document.getElementById('bl_con').value];
                var Fl = parseFloat(document.getElementById('bl_Fl').value);
                var type = document.getElementById('bl_type').value;
                var dv = parseFloat(document.getElementById('bl_dv').value) || 0;
                var s1 = parseFloat(document.getElementById('bl_s1').value) || 50;
                var s2 = parseFloat(document.getElementById('bl_s2').value) || 50;
                var n1 = parseFloat(document.getElementById('bl_n1').value) || 0;
                var n2 = parseFloat(document.getElementById('bl_n2').value) || 0;
                var Acor = parseFloat(document.getElementById('bl_cor').value) || 0;
                var dsp = parseFloat(document.getElementById('bl_dsp').value) || 0;
                var ssp = parseFloat(document.getElementById('bl_ssp').value) || 50;
                var hRange = parseFloat(document.getElementById('bl_h').value) || 200;
                var reb = REBAR_FLEX[document.getElementById('bl_reb').value];

                if (!(Al > 0 && Ab > 0)) return err('局部受压面积和底面积必须为正数。');
                if (Ab < Al) return err('计算底面积 A<sub>b</sub> 应不小于局部受压面积 A<sub>l</sub>。');
                if (!(Fl > 0)) return err('局部压力必须为正数。');

                var fc = con.fc;
                var beta_c = 1.0; // ≤C50 取 1.0

                // 混凝土局部受压强度提高系数 β_l
                var beta_l = Math.sqrt(Ab / Al);

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　A<sub>l</sub> = ' + fmt(Al,0) + ' mm²，A<sub>b</sub> = ' + fmt(Ab,0) + ' mm²，A<sub>ln</sub> = ' + fmt(Aln,0) + ' mm²；f<sub>c</sub> = ' + fc + ' N/mm²；β<sub>c</sub> = ' + beta_c + '；F<sub>l</sub> = ' + Fl + ' kN。</div>');
                st.push('<div class="step"><b>② 局部受压强度提高系数 β<sub>l</sub></b>　β<sub>l</sub> = √(A<sub>b</sub>/A<sub>l</sub>) = √(' + fmt(Ab,0) + '/' + fmt(Al,0) + ') = <b>' + fmt(beta_l, 3) + '</b></div>');

                // 不配间接钢筋时：F_l ≤ 0.9 * β_c * β_l * f_c * A_ln
                var Flu_none = 0.9 * beta_c * beta_l * fc * Aln / 1000; // kN
                var ok_none = Fl <= Flu_none;

                st.push('<div class="step"><b>③ 不配筋局部受压承载力</b>　F<sub>l,u</sub> = 0.9β<sub>c</sub>β<sub>l</sub>f<sub>c</sub>A<sub>ln</sub> = 0.9×' + beta_c + '×' + fmt(beta_l,3) + '×' + fc + '×' + fmt(Aln,0) + '/1000 = <b>' + fmt(Flu_none, 1) + ' kN</b>' + (ok_none ? tag('ok','满足') : tag('err','不满足')) + '</div>');

                // 配间接钢筋（6.6.3 条）
                var Flu_reb = 0, ok_reb = false, rho_v = 0, cor_ok = false;
                if (type !== 'none') {
                    var fyv = (reb === REBAR_FLEX['HPB300']) ? 270 : reb.fy; // 间接钢筋抗拉强度设计值
                    // 体积配筋率 ρ_v
                    if (type === 'mesh') {
                        // 方格网：ρ_v = n_1 * A_s1 * l_1 + n_2 * A_s2 * l_2 / (A_cor * s)
                        // 简化：n1 根 d 直径钢筋 + n2 根 d 直径钢筋
                        var As1 = Math.PI * dv * dv / 4;
                        // 核心面积（方格网钢筋围成的面积）：近似取 (n1-1)*s1 × (n2-1)*s2 内的面积
                        // 这里简化用 Ab 范围内，按规范 A_cor ≤ A_b
                        var Acor_mesh = Math.min(Ab, (n1 - 1) * s1 * (n2 - 1) * s2);
                        if (Acor_mesh <= 0) Acor_mesh = Al;
                        var s_mesh = (s1 + s2) / 2; // 近似网片间距
                        // 规范公式：ρ_v = (n_1 A_s1 l_1 + n_2 A_s2 l_2) / (A_cor s)
                        var l1 = (n1 - 1) * s1; // 一个方向的长度
                        var l2 = (n2 - 1) * s2;
                        rho_v = (n1 * As1 * l1 + n2 * As1 * l2) / (Acor_mesh * s_mesh);
                        Acor = Acor_mesh;
                    } else {
                        // 螺旋式：ρ_v = 4 * A_ss1 / (d_cor * s)
                        // d_cor 为核心直径，A_cor = π d_cor² / 4 → d_cor = √(4 A_cor / π)
                        var d_cor = Math.sqrt(4 * Acor / Math.PI);
                        var Ass1 = Math.PI * dsp * dsp / 4;
                        rho_v = 4 * Ass1 / (d_cor * ssp);
                    }
                    // β_cor（核心面积提高系数）
                    var beta_cor = Math.sqrt(Acor / Al);
                    if (beta_cor > beta_l) beta_cor = beta_l; // β_cor 不大于 β_l

                    // 配间接钢筋承载力：F_lu = 0.9 (β_c β_l f_c + 2 α ρ_v β_cor f_yv) A_ln
                    var alpha_val = 1.0; // 方格网和螺旋式均取 1.0（规范 6.6.3）
                    var fyv_val = (document.getElementById('bl_reb').value === 'HPB300') ? 270 : fyv;
                    Flu_reb = 0.9 * (beta_c * beta_l * fc + 2 * alpha_val * rho_v * beta_cor * fyv_val) * Aln / 1000; // kN
                    ok_reb = Fl <= Flu_reb;
                    // 局部受压区截面尺寸要求（6.6.1 条）：F_l ≤ 1.35 β_c β_l f_c A_ln
                    var Flu_max = 1.35 * beta_c * beta_l * fc * Aln / 1000;
                    cor_ok = Fl <= Flu_max;

                    st.push('<div class="step"><b>④ 配间接钢筋提高</b>　间接钢筋形式：' + (type === 'mesh' ? '方格网' : '螺旋式') + '；体积配筋率 ρ<sub>v</sub> = <b>' + fmt(rho_v*100, 3) + '%</b>；核心面积 A<sub>cor</sub> = ' + fmt(Acor, 0) + ' mm²；β<sub>cor</sub> = √(A<sub>cor</sub>/A<sub>l</sub>) = ' + fmt(beta_cor, 3) + '。</div>');
                    st.push('<div class="step"><b>　配筋后承载力</b>　F<sub>l,u</sub> = 0.9(β<sub>c</sub>β<sub>l</sub>f<sub>c</sub> + 2αρ<sub>v</sub>β<sub>cor</sub>f<sub>yv</sub>)A<sub>ln</sub> = <b>' + fmt(Flu_reb, 1) + ' kN</b>' + (ok_reb ? tag('ok','满足') : tag('err','不满足')) + '</div>');
                    st.push('<div class="step"><b>　截面尺寸上限</b>　1.35β<sub>c</sub>β<sub>l</sub>f<sub>c</sub>A<sub>ln</sub> = ' + fmt(Flu_max, 1) + ' kN（局部受压区截面限制条件，' + (cor_ok ? '满足' : '不满足') + '）</div>');
                    if (rho_v < 0.005) {
                        st.push('<div class="step" style="color:#854d0e;"><b>　注意</b>　ρ<sub>v</sub> = ' + fmt(rho_v*100,3) + '% < 0.5%，不满足间接钢筋最小体积配筋率要求（6.6.3 条）。</div>');
                    }
                }

                var finalOk = (type === 'none') ? ok_none : ok_reb;
                st.push('<div class="step"><b>⑤ 结论</b>　' + (type === 'none' ? '不配间接钢筋' : '配置间接钢筋') + ' 时，局部受压承载力 ' + (finalOk ? '满足' : '不满足') + ' 要求。</div>');

                var html = resultRow('局部受压强度提高系数 β<sub>l</sub>', fmt(beta_l, 3) + '（A<sub>b</sub>/A<sub>l</sub> = ' + fmt(Ab/Al, 2) + '）');
                html += resultRow('局部压力设计值 F<sub>l</sub>', Fl + ' kN');
                html += resultRow('不配筋承载力 F<sub>l,u</sub>', fmt(Flu_none, 1) + ' kN');
                html += resultRow('不配筋判定', badge(ok_none ? 'badge-ok' : 'badge-warn', ok_none ? '不配筋即满足' : '不配筋不满足，需配间接钢筋'));
                if (type !== 'none') {
                    html += resultRow('体积配筋率 ρ<sub>v</sub>', fmt(rho_v*100, 3) + '%（最小 0.5%）');
                    html += resultRow('配筋后承载力 F<sub>l,u</sub>', '<span class="highlight">' + fmt(Flu_reb, 1) + ' kN</span>');
                    html += resultRow('配筋后判定', badge(ok_reb ? 'badge-ok' : 'badge-err', ok_reb ? '配间接钢筋后满足' : '仍不满足，需加大截面或提高等级'));
                }
                html += resultRow('最终判定', badge(finalOk ? 'badge-ok' : 'badge-err', finalOk ? '局部受压承载力满足' : '局部受压承载力不满足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._BL_RESULT = {
                    Al: Al, Ab: Ab, Aln: Aln, Fl: Fl,
                    conGrade: document.getElementById('bl_con').value,
                    type: type, beta_l: beta_l, beta_c: beta_c,
                    Flu_none: Flu_none, ok_none: ok_none,
                    rho_v: rho_v, Flu_reb: Flu_reb, ok_reb: ok_reb,
                    finalOk: finalOk
                };
            }

            document.getElementById('bl_calc').addEventListener('click', calc);
            document.getElementById('bl_reset').addEventListener('click', function () {
                var f = document.getElementById('f-bl'); f.reset();
                document.getElementById('bl_Al').value = 125600;
                document.getElementById('bl_Ab').value = 360000;
                document.getElementById('bl_Aln').value = 113000;
                document.getElementById('bl_Fl').value = 3000;
                document.getElementById('bl_dv').value = 8;
                document.getElementById('bl_s1').value = 50;
                document.getElementById('bl_s2').value = 50;
                document.getElementById('bl_n1').value = 6;
                document.getElementById('bl_n2').value = 6;
                calc();
            });
            document.getElementById('f-bl').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['bearing-local'] = tool;
})();
