/* joint-core 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '框架节点核芯区验算',
        sub: '核芯区剪力设计值 · 截面验算 · 受剪承载力 · GB 50011 附录D',
        meta: {"standard": "GB/T 50011-2010（2024年版） 附录D", "formulaSource": "D.1", "limitations": "核芯区剪力设计值+截面限制+受剪承载力", "unit": "Vj:kN, ηj:—, fyv:N/mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">节点参数</div>' +
                '<form id="f-jc"><div class="grid2">' +
                selField('jc_grade', '框架抗震等级', opts([
                    { v: '1', t: '一级（框架结构）' },
                    { v: '2', t: '二级（框架结构）' },
                    { v: '3', t: '三级（框架结构）' },
                    { v: '1o', t: '一级（其他结构中框架）' },
                    { v: '2o', t: '二级（其他结构中框架）' },
                    { v: '3o', t: '三级（其他结构中框架）' }
                ], '2')) +
                selField('jc_shape', '柱截面形状', opts([
                    { v: 'rect', t: '矩形柱' },
                    { v: 'circle', t: '圆柱' }
                ], 'rect')) +
                numField('jc_bb', '梁截面宽度 b<sub>b</sub>', 'mm', 300) +
                numField('jc_hb', '梁截面高度 h<sub>b</sub>', 'mm', 600) +
                numField('jc_bc', '柱截面宽度 b<sub>c</sub>', 'mm', 500) +
                numField('jc_hc', '柱截面高度 h<sub>c</sub>', 'mm', 500) +
                numField('jc_Hc', '柱计算高度 H<sub>c</sub>（反弯点间距）', 'mm', 3000) +
                '</div><div class="panel-title" style="margin-top:14px;">内力参数</div><div class="grid2">' +
                numField('jc_Mb', '节点左右梁端组合弯矩设计值之和 ΣM<sub>b</sub>', 'kN·m', 200) +
                numField('jc_N', '上柱组合轴向压力 N', 'kN', 1000, '取较小值，不大于0.5fcAc') +
                numField('jc_concrete', '混凝土抗拉强度 f<sub>t</sub>', 'MPa', 1.43, 'C30取1.43') +
                numField('jc_fyv', '箍筋抗拉强度 f<sub>yv</sub>', 'MPa', 270, 'HPB300取270') +
                numField('jc_Asvj', '核芯区箍筋总面积 A<sub>svj</sub>', 'mm²', 157, '如4肢φ8@100: 4×50.3=201') +
                numField('jc_s', '箍筋间距 s', 'mm', 100) +
                selField('jc_ortho', '正交梁约束', opts([
                    { v: 'yes', t: '有正交梁约束（四侧均有梁，ηj=1.5）' },
                    { v: 'no', t: '无正交梁约束（ηj=1.0）' }
                ], 'yes')) +
                '</div><div class="hint">说明：依据 GB/T 50011-2010（2024年版） 附录D计算框架梁柱节点核芯区剪力设计值和受剪承载力。强节点系数ηcj：框架结构一/二/三级=1.5/1.35/1.2；其他结构中框架=1.35/1.2/1.1。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="jc_calc">计算节点核芯区</button>' +
                '<button type="button" class="btn btn-secondary" id="jc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="jc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="jc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('jc_result');
                var proc = document.getElementById('jc_proc');
                var grade = document.getElementById('jc_grade').value;
                var shape = document.getElementById('jc_shape').value;
                var bb = parseFloat(document.getElementById('jc_bb').value);
                var hb = parseFloat(document.getElementById('jc_hb').value);
                var bc = parseFloat(document.getElementById('jc_bc').value);
                var hc = parseFloat(document.getElementById('jc_hc').value);
                var Hc = parseFloat(document.getElementById('jc_Hc').value);
                var Mb = parseFloat(document.getElementById('jc_Mb').value) * 1e6; // kN·m → N·mm
                var N = parseFloat(document.getElementById('jc_N').value) * 1000; // kN → N
                var ft = parseFloat(document.getElementById('jc_concrete').value);
                var fyv = parseFloat(document.getElementById('jc_fyv').value);
                var Asvj = parseFloat(document.getElementById('jc_Asvj').value);
                var s = parseFloat(document.getElementById('jc_s').value);
                var ortho = document.getElementById('jc_ortho').value;
                var st = [];

                // 强节点系数 ηcj
                var eta_cj;
                if (grade === '1') eta_cj = 1.5;
                else if (grade === '2') eta_cj = 1.35;
                else if (grade === '3') eta_cj = 1.2;
                else if (grade === '1o') eta_cj = 1.35;
                else if (grade === '2o') eta_cj = 1.2;
                else eta_cj = 1.1;

                var gammaRE = 0.85;
                var eta_j = ortho === 'yes' ? 1.5 : 1.0;

                // 有效验算宽度 bj
                var bj;
                if (bb >= bc / 2) {
                    bj = bc;
                } else {
                    bj = Math.min(bb + 0.5 * hc, bc);
                }

                // 核芯区截面高度 hj
                var hj = hc;

                // 有效截面面积 Aj
                var Aj = shape === 'rect' ? bj * hj : 0.8 * bc * bc; // 圆柱简化

                // 梁有效高度
                var hw = hb - 60; // 假定as=60mm
                var as_prime = 35;

                // ① 核芯区剪力设计值 Vj（式D.1.1-1）
                var Vj = eta_cj * Mb * (1 - (hb - as_prime) / (Hc - hb)) / (hw - as_prime);

                st.push('<div class="step"><b>① 核芯区剪力设计值 V<sub>j</sub>（式D.1.1-1）</b></div>');
                st.push('<div class="step">　　V<sub>j</sub> = η<sub>cj</sub> · ΣM<sub>b</sub> · [1 - (h<sub>b</sub>-a\'<sub>s</sub>)/(H<sub>c</sub>-h<sub>b</sub>)] / (h<sub>w</sub>-a\'<sub>s</sub>)</div>');
                st.push('<div class="step">　　η<sub>cj</sub> = ' + eta_cj + '（强节点系数）</div>');
                st.push('<div class="step">　　ΣM<sub>b</sub> = ' + (Mb / 1e6) + ' kN·m = ' + Mb + ' N·mm</div>');
                st.push('<div class="step">　　h<sub>w</sub> = ' + hb + ' - 60 = ' + hw + ' mm</div>');
                st.push('<div class="step">　　[1 - (h<sub>b</sub>-a\'<sub>s</sub>)/(H<sub>c</sub>-h<sub>b</sub>)] = 1 - (' + hb + '-' + as_prime + ')/(' + Hc + '-' + hb + ') = ' + (1 - (hb - as_prime) / (Hc - hb)).toFixed(6) + '</div>');
                st.push('<div class="step">　　V<sub>j</sub> = ' + eta_cj + ' × ' + Mb + ' × ' + (1 - (hb - as_prime) / (Hc - hb)).toFixed(6) + ' / ' + (hw - as_prime) + '</div>');
                st.push('<div class="step">　　<b>V<sub>j</sub> = ' + Vj.toFixed(0) + ' N = ' + (Vj / 1000).toFixed(2) + ' kN</b></div>');

                // ② 截面验算限值（式D.1.3）
                var Vj_limit = (1 / gammaRE) * 0.30 * eta_j * ft * bj * hj;
                st.push('<div class="step"><b>② 核芯区剪力限值（式D.1.3）</b></div>');
                st.push('<div class="step">　　V<sub>j</sub> ≤ (1/γ<sub>RE</sub>) · 0.30·η<sub>j</sub>·f<sub>t</sub>·b<sub>j</sub>·h<sub>j</sub></div>');
                st.push('<div class="step">　　b<sub>j</sub> = ' + bj + ' mm, h<sub>j</sub> = ' + hj + ' mm, η<sub>j</sub> = ' + eta_j + '</div>');
                st.push('<div class="step">　　限值 = (1/' + gammaRE + ') × 0.30 × ' + eta_j + ' × ' + ft + ' × ' + bj + ' × ' + hj + '</div>');
                st.push('<div class="step">　　<b>限值 = ' + (Vj_limit / 1000).toFixed(2) + ' kN</b></div>');
                st.push('<div class="step">　　' + (Vj <= Vj_limit ? '✓ 满足截面要求' : '✗ 不满足截面要求，需增大截面') + '</div>');

                // ③ 受剪承载力（式D.1.4-1）
                var N_use = Math.min(N, 0.5 * ft * bc * hc * 1e-3 * 1e3 / ft * ft); // 简化: N ≤ 0.5fcAc
                N_use = Math.max(N, 0); // 拉力取0
                var Vj_R = (1 / gammaRE) * (1.1 * eta_j * ft * bj * hj + 0.05 * N_use * bj / bc + fyv * Asvj * (bj - 60) / s);

                st.push('<div class="step"><b>③ 核芯区受剪承载力（式D.1.4-1）</b></div>');
                st.push('<div class="step">　　V<sub>j</sub> ≤ (1/γ<sub>RE</sub>) · [1.1·η<sub>j</sub>·f<sub>t</sub>·b<sub>j</sub>·h<sub>j</sub> + 0.05·N·b<sub>j</sub>/b<sub>c</sub> + f<sub>yv</sub>·A<sub>svj</sub>·(b<sub>j</sub>-60)/s]</div>');
                var term1 = 1.1 * eta_j * ft * bj * hj;
                var term2 = 0.05 * N_use * bj / bc;
                var term3 = fyv * Asvj * (bj - 60) / s;
                st.push('<div class="step">　　混凝土项 = 1.1 × ' + eta_j + ' × ' + ft + ' × ' + bj + ' × ' + hj + ' = ' + term1.toFixed(0) + ' N</div>');
                st.push('<div class="step">　　轴力项 = 0.05 × ' + (N_use / 1000).toFixed(0) + ' × ' + bj + '/' + bc + ' = ' + term2.toFixed(0) + ' N</div>');
                st.push('<div class="step">　　箍筋项 = ' + fyv + ' × ' + Asvj + ' × (' + bj + '-60)/' + s + ' = ' + term3.toFixed(0) + ' N</div>');
                st.push('<div class="step">　　V<sub>R</sub> = (1/' + gammaRE + ') × (' + term1.toFixed(0) + ' + ' + term2.toFixed(0) + ' + ' + term3.toFixed(0) + ')</div>');
                st.push('<div class="step">　　<b>V<sub>R</sub> = ' + (Vj_R / 1000).toFixed(2) + ' kN</b></div>');
                st.push('<div class="step">　　' + (Vj <= Vj_R ? '✓ 满足受剪承载力要求' : '✗ 不满足，需增加箍筋或增大截面') + '</div>');

                var html = resultRow('核芯区剪力设计值 V<sub>j</sub>', (Vj / 1000).toFixed(2) + ' kN');
                html += resultRow('截面验算限值', (Vj_limit / 1000).toFixed(2) + ' kN ' + (Vj <= Vj_limit ? '✓' : '✗'));
                html += resultRow('受剪承载力 V<sub>R</sub>', (Vj_R / 1000).toFixed(2) + ' kN ' + (Vj <= Vj_R ? '✓' : '✗'));
                html += resultRow('强节点系数 η<sub>cj</sub>', eta_cj.toString());
                html += resultRow('有效验算宽度 b<sub>j</sub>', bj + ' mm');
                html += resultRow('γ<sub>RE</sub>', '0.85');
                html += resultRow('说明', badge('badge-ok', '按GB 50011 附录D计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('jc_grade').value = '2';
                document.getElementById('jc_shape').value = 'rect';
                document.getElementById('jc_bb').value = 300;
                document.getElementById('jc_hb').value = 600;
                document.getElementById('jc_bc').value = 500;
                document.getElementById('jc_hc').value = 500;
                document.getElementById('jc_Hc').value = 3000;
                document.getElementById('jc_Mb').value = 200;
                document.getElementById('jc_N').value = 1000;
                document.getElementById('jc_concrete').value = 1.43;
                document.getElementById('jc_fyv').value = 270;
                document.getElementById('jc_Asvj').value = 157;
                document.getElementById('jc_s').value = 100;
                document.getElementById('jc_ortho').value = 'yes';
                calc();
            }
            document.getElementById('jc_calc').addEventListener('click', calc);
            document.getElementById('jc_reset').addEventListener('click', reset);
            document.getElementById('f-jc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['joint-core'] = tool;
})();
