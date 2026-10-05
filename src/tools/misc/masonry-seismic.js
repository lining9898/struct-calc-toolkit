/* masonry-seismic 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '砌体房屋抗震验算',
        sub: '抗震抗剪强度 · 截面受剪承载力 · 正应力影响系数 · 构造柱/芯柱提高 · GB 50011 §7.2',
        meta: {"standard": "GB/T 50011-2010（2024年版）建筑抗震设计标准", "formulaSource": "7.2", "limitations": "抗震抗剪强度fve，正应力影响系数ζN", "unit": "fve:MPa, ζN:—, V:kN", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">砌体参数</div>' +
                '<form id="f-ms"><div class="grid2">' +
                selField('ms_type', '砌体类型', opts([
                    { v: 'brick', t: '普通砖/多孔砖（240mm）' },
                    { v: 'block', t: '混凝土小型空心砌块（190mm）' }
                ], 'brick')) +
                numField('ms_fv', '非抗震抗剪强度设计值 f<sub>v</sub>', 'MPa', 0.14, '查GB 50003砌体结构设计规范，M10砂浆普通砖0.14') +
                numField('ms_sigma0', '对应重力荷载代表值的平均压应力 σ<sub>0</sub>', 'MPa', 0.4, '墙体截面平均压应力') +
                numField('ms_A', '墙体横截面面积 A', 'mm²', 2400000, '240mm厚×1000mm长=240000mm²') +
                selField('ms_rebar', '是否设置水平钢筋', opts([
                    { v: 'none', t: '无水平钢筋' },
                    { v: 'yes', t: '有水平钢筋（配筋率0.07%~0.17%）' }
                ], 'none')) +
                '</div><div class="panel-title" style="margin-top:14px;">构造柱/芯柱参数</div><div class="grid2">' +
                selField('ms_col', '构造柱/芯柱设置', opts([
                    { v: 'none', t: '无构造柱/芯柱' },
                    { v: 'brick_col', t: '有构造柱（普通砖，间距≤4m）' },
                    { v: 'block_core', t: '有芯柱（小砌块）' }
                ], 'none')) +
                numField('ms_Ac', '构造柱/芯柱总面积 A<sub>c</sub>', 'mm²', 0, '截面不小于240×240mm（无则填0）') +
                numField('ms_ft', '构造柱混凝土抗拉强度 f<sub>t</sub>', 'MPa', 1.1, 'C25取1.27，C30取1.43') +
                numField('ms_Asc', '构造柱纵筋总面积 A<sub>sc</sub>', 'mm²', 0, '配筋率0.6%~1.4%') +
                numField('ms_fyc', '构造柱钢筋抗拉强度 f<sub>yc</sub>', 'MPa', 270, 'HPB300取270，HRB400取360') +
                '</div><div class="panel-title" style="margin-top:14px;">水平钢筋参数（如有）</div><div class="grid2">' +
                numField('ms_Ash', '层间墙体竖向截面水平钢筋总面积 A<sub>sh</sub>', 'mm²', 0, '配筋率0.07%~0.17%') +
                numField('ms_fyh', '水平钢筋抗拉强度 f<sub>yh</sub>', 'MPa', 270, 'HPB300取270') +
                '</div><div class="hint">说明：依据 GB/T 50011-2010（2024年版） §7.2.6~7.2.8 计算砌体沿阶梯形截面破坏的抗震抗剪强度和截面抗震受剪承载力。构造柱参与工作系数ηc：居中1根取0.5，多根取0.4；芯柱填孔率ρ<0.15取0，0.15~0.25取1.0，0.25~0.5取1.10，>0.5取1.15。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ms_calc">计算抗震受剪承载力</button>' +
                '<button type="button" class="btn btn-secondary" id="ms_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ms_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ms_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ms_result');
                var proc = document.getElementById('ms_proc');
                var type = document.getElementById('ms_type').value;
                var fv = parseFloat(document.getElementById('ms_fv').value);
                var sigma0 = parseFloat(document.getElementById('ms_sigma0').value);
                var A = parseFloat(document.getElementById('ms_A').value);
                var rebarV = document.getElementById('ms_rebar').value;
                var colV = document.getElementById('ms_col').value;
                var Ac = parseFloat(document.getElementById('ms_Ac').value);
                var ft = parseFloat(document.getElementById('ms_ft').value);
                var Asc = parseFloat(document.getElementById('ms_Asc').value);
                var fyc = parseFloat(document.getElementById('ms_fyc').value);
                var Ash = parseFloat(document.getElementById('ms_Ash').value);
                var fyh = parseFloat(document.getElementById('ms_fyh').value);
                var st = [];

                // ① 抗震抗剪强度正应力影响系数 ζN（表7.2.6）
                var zetaN;
                var ratio = sigma0 / fv;
                if (type === 'brick') {
                    // 普通砖、多孔砖: ζN = 0.8 + 0.3σ0/fv, ≤1.0时按线性，>1.0按修正
                    // 表7.2.6: σ0/fv=0→0.80, 1.0→1.10, 3.0→1.70, 5.0→2.00, 7.0→2.20
                    if (ratio <= 0) zetaN = 0.80;
                    else if (ratio <= 1.0) zetaN = 0.80 + 0.30 * ratio;
                    else if (ratio <= 3.0) zetaN = 1.10 + 0.30 * (ratio - 1.0) / 2.0;
                    else if (ratio <= 5.0) zetaN = 1.70 + 0.15 * (ratio - 3.0);
                    else if (ratio <= 7.0) zetaN = 2.00 + 0.10 * (ratio - 5.0);
                    else zetaN = 2.20 + 0.05 * (ratio - 7.0);
                } else {
                    // 小砌块: ζN = 1.0 + 0.2σ0/fv (近似)
                    if (ratio <= 0) zetaN = 1.00;
                    else if (ratio <= 1.0) zetaN = 1.00 + 0.15 * ratio;
                    else if (ratio <= 3.0) zetaN = 1.15 + 0.15 * (ratio - 1.0) / 2.0;
                    else if (ratio <= 5.0) zetaN = 1.30 + 0.10 * (ratio - 3.0);
                    else zetaN = 1.50;
                }

                var fvE = zetaN * fv;

                st.push('<div class="step"><b>① 抗震抗剪强度设计值 f<sub>vE</sub>（式7.2.6）</b></div>');
                st.push('<div class="step">　　f<sub>vE</sub> = ζ<sub>N</sub> · f<sub>v</sub></div>');
                st.push('<div class="step">　　σ<sub>0</sub>/f<sub>v</sub> = ' + sigma0 + '/' + fv + ' = ' + ratio.toFixed(3) + '</div>');
                st.push('<div class="step">　　正应力影响系数 ζ<sub>N</sub> = <b>' + zetaN.toFixed(4) + '</b>（查表7.2.6插值）</div>');
                st.push('<div class="step">　　f<sub>vE</sub> = ' + zetaN.toFixed(4) + ' × ' + fv + ' = <b>' + fvE.toFixed(4) + ' MPa</b></div>');

                // ② 承载力抗震调整系数 γRE（表5.4.2）
                var gammaRE = 0.9; // 两端有构造柱/芯柱的抗震墙
                if (colV === 'none') gammaRE = 1.0; // 其他抗震墙
                st.push('<div class="step"><b>② 承载力抗震调整系数 γ<sub>RE</sub>（表5.4.2）</b></div>');
                st.push('<div class="step">　　' + (colV !== 'none' ? '两端有构造柱/芯柱：γ<sub>RE</sub> = 0.9' : '其他抗震墙：γ<sub>RE</sub> = 1.0') + '</div>');

                // ③ 截面抗震受剪承载力
                var Vr;
                if (type === 'brick') {
                    if (colV === 'brick_col' && Ac > 0) {
                        // 式7.2.7-3: 含构造柱
                        var etac = 0.5; // 居中1根
                        var etac_str = '0.5（居中1根）';
                        var eta_c_val = 1.0; // 墙体约束修正系数，一般取1.0
                        Vr = (1 / gammaRE) * (fvE * (A - Ac) + 0.5 * ft * Ac + 0.08 * ft * Ac + etac * ft * Asc * eta_c_val + etac * fyh * Ash);
                        st.push('<div class="step"><b>③ 截面抗震受剪承载力 V（式7.2.7-3，含构造柱）</b></div>');
                        st.push('<div class="step">　　V = (1/γ<sub>RE</sub>) · [f<sub>vE</sub>(A-A<sub>c</sub>) + 0.5f<sub>t</sub>A<sub>c</sub> + 0.08f<sub>t</sub>A<sub>c</sub> + η<sub>c</sub>f<sub>yc</sub>A<sub>sc</sub> + η<sub>c</sub>f<sub>yh</sub>A<sub>sh</sub>]</div>');
                    } else if (rebarV === 'yes' && Ash > 0) {
                        // 式7.2.7-2: 含水平钢筋
                        var eta_s = 1.0; // 钢筋参与工作系数（层高1.2m查表7.2.7）
                        if (true) { // simplified
                            eta_s = 1.0;
                        }
                        Vr = (1 / gammaRE) * (fvE * A + 0.1 * fyh * Ash);
                        st.push('<div class="step"><b>③ 截面抗震受剪承载力 V（式7.2.7-2，含水平钢筋）</b></div>');
                        st.push('<div class="step">　　V = (1/γ<sub>RE</sub>) · [f<sub>vE</sub>·A + 0.1·f<sub>yh</sub>·A<sub>sh</sub>]</div>');
                    } else {
                        // 式7.2.7-1: 一般情况
                        Vr = (1 / gammaRE) * fvE * A;
                        st.push('<div class="step"><b>③ 截面抗震受剪承载力 V（式7.2.7-1，一般情况）</b></div>');
                        st.push('<div class="step">　　V = f<sub>vE</sub>·A / γ<sub>RE</sub></div>');
                    }
                } else {
                    // 小砌块 式7.2.8
                    var eta_c2 = 0.0; // 芯柱参与工作系数
                    if (colV === 'block_core') {
                        // 简化: 按填孔率
                        eta_c2 = 1.0;
                    }
                    Vr = (1 / gammaRE) * (fvE * A + (0.3 * ft * Ac + 0.05 * fyc * Asc) * eta_c2);
                    st.push('<div class="step"><b>③ 截面抗震受剪承载力 V（式7.2.8，小砌块）</b></div>');
                    st.push('<div class="step">　　V = (1/γ<sub>RE</sub>) · [f<sub>vE</sub>·A + (0.3f<sub>t</sub>A<sub>c</sub> + 0.05f<sub>yc</sub>A<sub>sc</sub>)·η<sub>c</sub>]</div>');
                }

                // 计算各项数值
                var fvE_A = fvE * A;
                st.push('<div class="step">　　f<sub>vE</sub>·A = ' + fvE.toFixed(4) + ' × ' + A + ' = ' + fvE_A.toFixed(2) + ' N</div>');
                if (colV === 'brick_col' && Ac > 0) {
                    var term2 = 0.5 * ft * Ac + 0.08 * ft * Ac;
                    st.push('<div class="step">　　0.5f<sub>t</sub>A<sub>c</sub> + 0.08f<sub>t</sub>A<sub>c</sub> = ' + term2.toFixed(2) + ' N</div>');
                }
                if (rebarV === 'yes' && Ash > 0) {
                    var term3 = 0.1 * fyh * Ash;
                    st.push('<div class="step">　　0.1·f<sub>yh</sub>·A<sub>sh</sub> = ' + term3.toFixed(2) + ' N</div>');
                }
                st.push('<div class="step">　　V = ' + Vr.toFixed(2) + ' N = <b>' + (Vr / 1000).toFixed(2) + ' kN</b></div>');

                // ④ 砌体房屋层数和高度限值提示
                st.push('<div class="step"><b>④ 砌体房屋层数和高度限值（表7.1.2）</b></div>');
                if (type === 'brick') {
                    st.push('<div class="step">　　普通砖240mm：6度21m/7层, 7度21m/7层, 8度0.2g 18m/6层, 8度0.3g 15m/5层, 9度12m/4层</div>');
                    st.push('<div class="step">　　最大高宽比：6度2.5, 7度2.5, 8度2.0, 9度1.5</div>');
                    st.push('<div class="step">　　抗震横墙最大间距（现浇楼盖）：6度15m, 7度15m, 8度11m, 9度7m</div>');
                } else {
                    st.push('<div class="step">　　小砌块190mm：6度21m/7层, 7度21m/7层, 8度0.2g 18m/6层, 8度0.3g 15m/5层, 9度9m/3层</div>');
                }

                var html = resultRow('抗震抗剪强度 f<sub>vE</sub>', fvE.toFixed(4) + ' MPa');
                html += resultRow('正应力影响系数 ζ<sub>N</sub>', zetaN.toFixed(4));
                html += resultRow('γ<sub>RE</sub>', gammaRE.toFixed(2));
                html += resultRow('抗震受剪承载力 V', (Vr / 1000).toFixed(2) + ' kN');
                html += resultRow('说明', badge('badge-ok', '按GB 50011 §7.2计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('ms_type').value = 'brick';
                document.getElementById('ms_fv').value = 0.14;
                document.getElementById('ms_sigma0').value = 0.4;
                document.getElementById('ms_A').value = 2400000;
                document.getElementById('ms_rebar').value = 'none';
                document.getElementById('ms_col').value = 'none';
                document.getElementById('ms_Ac').value = 0;
                document.getElementById('ms_ft').value = 1.1;
                document.getElementById('ms_Asc').value = 0;
                document.getElementById('ms_fyc').value = 270;
                document.getElementById('ms_Ash').value = 0;
                document.getElementById('ms_fyh').value = 270;
                calc();
            }
            document.getElementById('ms_calc').addEventListener('click', calc);
            document.getElementById('ms_reset').addEventListener('click', reset);
            document.getElementById('f-ms').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['masonry-seismic'] = tool;
})();
