/* load-combo 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '荷载组合计算',
        sub: '基本组合 · 偶然组合 · 标准/频遇/准永久组合 · 分项系数 · GB 50009 §3.2',
        meta: {"standard": "GB 50009-2012 建筑结构荷载规范", "formulaSource": "3.2", "limitations": "基本组合/偶然组合/标准/频遇/准永久组合", "unit": "S:kN或kN·m, γG,γQ:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">永久荷载参数</div>' +
                '<form id="f-lc"><div class="grid2">' +
                numField('lc_G1k', '永久荷载标准值效应 S<sub>G1k</sub>', 'kN·m/kN', 100, '第一个永久荷载效应（自重等）') +
                numField('lc_G2k', '其他永久荷载标准值效应 S<sub>G2k</sub>', 'kN·m/kN', 20, '附加永久荷载效应（可填0）') +
                '</div><div class="panel-title" style="margin-top:14px;">可变荷载参数</div><div class="grid2">' +
                numField('lc_Q1k', '主导可变荷载标准值效应 S<sub>Q1k</sub>', 'kN·m/kN', 60, '起控制作用的可变荷载效应') +
                numField('lc_Q2k', '其他可变荷载标准值效应 S<sub>Q2k</sub>', 'kN·m/kN', 30, '第二个可变荷载效应（可填0）') +
                selField('lc_psi_c1', '主导可变荷载组合值系数 ψ<sub>c1</sub>', opts([
                    { v: 0.7, t: '0.7（楼面/屋面活荷载）' },
                    { v: 0.6, t: '0.6（风荷载）' },
                    { v: 0.7, t: '0.7（雪荷载）' },
                    { v: 0.6, t: '0.6（温度作用）' },
                    { v: 0.9, t: '0.9（书库/档案库）' }
                ], 0.7)) +
                selField('lc_psi_c2', '其他可变荷载组合值系数 ψ<sub>c2</sub>', opts([
                    { v: 0.7, t: '0.7（楼面/屋面活荷载）' },
                    { v: 0.6, t: '0.6（风荷载）' },
                    { v: 0.7, t: '0.7（雪荷载）' },
                    { v: 0.6, t: '0.6（温度作用）' }
                ], 0.6)) +
                numField('lc_psi_f1', '主导可变荷载频遇值系数 ψ<sub>f1</sub>', '', 0.5, '查表5.1.1或§8.1.4') +
                numField('lc_psi_q1', '主导可变荷载准永久值系数 ψ<sub>q1</sub>', '', 0.4, '查表5.1.1或§8.1.4') +
                '</div><div class="panel-title" style="margin-top:14px;">设计参数</div><div class="grid2">' +
                selField('lc_years', '设计使用年限', opts([
                    { v: 5, t: '5年（临时结构）' },
                    { v: 50, t: '50年（普通结构）' },
                    { v: 100, t: '100年（纪念性/特殊结构）' }
                ], 50)) +
                selField('lc_Q1type', '主导可变荷载类型', opts([
                    { v: 'live', t: '楼面/屋面活荷载' },
                    { v: 'wind', t: '风荷载' },
                    { v: 'snow', t: '雪荷载' },
                    { v: 'temp', t: '温度作用' }
                ], 'live')) +
                selField('lc_Q2type', '其他可变荷载类型', opts([
                    { v: 'live', t: '楼面/屋面活荷载' },
                    { v: 'wind', t: '风荷载' },
                    { v: 'snow', t: '雪荷载' },
                    { v: 'temp', t: '温度作用' }
                ], 'wind')) +
                '</div><div class="hint">说明：依据 GB 50009-2012 §3.2.3~3.2.10 计算承载能力极限状态基本组合（可变/永久控制）和正常使用极限状态标准/频遇/准永久组合。永久荷载分项系数：不利时可变控制取1.2、永久控制取1.35，有利时≤1.0。可变荷载分项系数：一般取1.4（工业楼面>4kN/m²取1.3）。设计使用年限调整系数γL：5年=0.9, 50年=1.0, 100年=1.1。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="lc_calc">计算荷载组合</button>' +
                '<button type="button" class="btn btn-secondary" id="lc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="lc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="lc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('lc_result');
                var proc = document.getElementById('lc_proc');
                var G1k = parseFloat(document.getElementById('lc_G1k').value);
                var G2k = parseFloat(document.getElementById('lc_G2k').value);
                var Q1k = parseFloat(document.getElementById('lc_Q1k').value);
                var Q2k = parseFloat(document.getElementById('lc_Q2k').value);
                var psi_c1 = parseFloat(document.getElementById('lc_psi_c1').value);
                var psi_c2 = parseFloat(document.getElementById('lc_psi_c2').value);
                var psi_f1 = parseFloat(document.getElementById('lc_psi_f1').value);
                var psi_q1 = parseFloat(document.getElementById('lc_psi_q1').value);
                var years = parseInt(document.getElementById('lc_years').value);
                var Q1type = document.getElementById('lc_Q1type').value;
                var Q2type = document.getElementById('lc_Q2type').value;
                var st = [];

                // 设计使用年限调整系数
                var gammaL;
                if (years === 5) gammaL = 0.9;
                else if (years === 100) gammaL = 1.1;
                else gammaL = 1.0;

                var gammaG_var = 1.2; // 可变控制时
                var gammaG_perm = 1.35; // 永久控制时
                var gammaQ = 1.4;
                if (Q1type === 'live') {
                    // 工业楼面>4kN/m²取1.3，这里简化取1.4
                }

                var SGk = G1k + G2k;

                st.push('<div class="step"><b>① 设计使用年限调整系数 γ<sub>L</sub>（表3.2.5）</b></div>');
                st.push('<div class="step">　　设计使用年限 = ' + years + '年 → γ<sub>L</sub> = <b>' + gammaL + '</b></div>');

                // 基本组合1：可变荷载控制（式3.2.3-1）
                var Sd1 = gammaG_var * SGk + gammaQ * gammaL * Q1k + gammaQ * gammaL * psi_c2 * Q2k;
                st.push('<div class="step"><b>② 基本组合（可变荷载控制）式3.2.3-1</b></div>');
                st.push('<div class="step">　　S<sub>d</sub> = γ<sub>G</sub>·ΣS<sub>Gk</sub> + γ<sub>Q1</sub>·γ<sub>L</sub>·S<sub>Q1k</sub> + γ<sub>Q2</sub>·γ<sub>L</sub>·ψ<sub>c2</sub>·S<sub>Q2k</sub></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ' + gammaG_var + '×' + SGk + ' + ' + gammaQ + '×' + gammaL + '×' + Q1k + ' + ' + gammaQ + '×' + gammaL + '×' + psi_c2 + '×' + Q2k + '</div>');
                st.push('<div class="step">　　= ' + (gammaG_var * SGk).toFixed(2) + ' + ' + (gammaQ * gammaL * Q1k).toFixed(2) + ' + ' + (gammaQ * gammaL * psi_c2 * Q2k).toFixed(2) + '</div>');
                st.push('<div class="step">　　<b>S<sub>d</sub> = ' + Sd1.toFixed(2) + '</b></div>');

                // 基本组合2：永久荷载控制（式3.2.3-2）
                var Sd2 = gammaG_perm * SGk + gammaQ * gammaL * psi_c1 * Q1k + gammaQ * gammaL * psi_c2 * Q2k;
                st.push('<div class="step"><b>③ 基本组合（永久荷载控制）式3.2.3-2</b></div>');
                st.push('<div class="step">　　S<sub>d</sub> = γ<sub>G</sub>·ΣS<sub>Gk</sub> + γ<sub>Q1</sub>·γ<sub>L</sub>·ψ<sub>c1</sub>·S<sub>Q1k</sub> + γ<sub>Q2</sub>·γ<sub>L</sub>·ψ<sub>c2</sub>·S<sub>Q2k</sub></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ' + gammaG_perm + '×' + SGk + ' + ' + gammaQ + '×' + gammaL + '×' + psi_c1 + '×' + Q1k + ' + ' + gammaQ + '×' + gammaL + '×' + psi_c2 + '×' + Q2k + '</div>');
                st.push('<div class="step">　　<b>S<sub>d</sub> = ' + Sd2.toFixed(2) + '</b></div>');

                var Sd_basic = Math.max(Sd1, Sd2);
                st.push('<div class="step">　　取较大值：S<sub>d</sub> = max(' + Sd1.toFixed(2) + ', ' + Sd2.toFixed(2) + ') = <b>' + Sd_basic.toFixed(2) + '</b></div>');

                // 标准组合（式3.2.8）
                var Sd_std = SGk + Q1k + psi_c2 * Q2k;
                st.push('<div class="step"><b>④ 标准组合（正常使用极限状态）式3.2.8</b></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ΣS<sub>Gk</sub> + S<sub>Q1k</sub> + ψ<sub>c2</sub>·S<sub>Q2k</sub></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ' + SGk + ' + ' + Q1k + ' + ' + psi_c2 + '×' + Q2k + ' = <b>' + Sd_std.toFixed(2) + '</b></div>');

                // 频遇组合（式3.2.9）
                var Sd_freq = SGk + psi_f1 * Q1k + psi_q1 * Q2k;
                st.push('<div class="step"><b>⑤ 频遇组合（式3.2.9）</b></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ΣS<sub>Gk</sub> + ψ<sub>f1</sub>·S<sub>Q1k</sub> + ψ<sub>q2</sub>·S<sub>Q2k</sub></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ' + SGk + ' + ' + psi_f1 + '×' + Q1k + ' + ' + psi_q1 + '×' + Q2k + ' = <b>' + Sd_freq.toFixed(2) + '</b></div>');

                // 准永久组合（式3.2.10）
                var Sd_qp = SGk + psi_q1 * Q1k + psi_q1 * Q2k;
                st.push('<div class="step"><b>⑥ 准永久组合（式3.2.10）</b></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ΣS<sub>Gk</sub> + ψ<sub>q1</sub>·S<sub>Q1k</sub> + ψ<sub>q2</sub>·S<sub>Q2k</sub></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ' + SGk + ' + ' + psi_q1 + '×' + Q1k + ' + ' + psi_q1 + '×' + Q2k + ' = <b>' + Sd_qp.toFixed(2) + '</b></div>');

                // 偶然组合（式3.2.6-1）
                st.push('<div class="step"><b>⑦ 偶然组合（式3.2.6-1）</b></div>');
                st.push('<div class="step">　　S<sub>d</sub> = ΣS<sub>Gk</sub> + S<sub>Ad</sub> + ψ<sub>f</sub>·S<sub>Q1k</sub> + ψ<sub>q</sub>·S<sub>Q2k</sub></div>');
                st.push('<div class="step">　　注：需输入偶然荷载效应S<sub>Ad</sub>后另行计算</div>');

                var html = resultRow('基本组合（可变控制）', Sd1.toFixed(2));
                html += resultRow('基本组合（永久控制）', Sd2.toFixed(2));
                html += resultRow('基本组合（取大值）', '<b>' + Sd_basic.toFixed(2) + '</b>');
                html += resultRow('标准组合', Sd_std.toFixed(2));
                html += resultRow('频遇组合', Sd_freq.toFixed(2));
                html += resultRow('准永久组合', Sd_qp.toFixed(2));
                html += resultRow('γ<sub>L</sub>', gammaL.toString());
                html += resultRow('说明', badge('badge-ok', '按GB 50009 §3.2计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('lc_G1k').value = 100;
                document.getElementById('lc_G2k').value = 20;
                document.getElementById('lc_Q1k').value = 60;
                document.getElementById('lc_Q2k').value = 30;
                document.getElementById('lc_psi_c1').value = 0.7;
                document.getElementById('lc_psi_c2').value = 0.6;
                document.getElementById('lc_psi_f1').value = 0.5;
                document.getElementById('lc_psi_q1').value = 0.4;
                document.getElementById('lc_years').value = 50;
                document.getElementById('lc_Q1type').value = 'live';
                document.getElementById('lc_Q2type').value = 'wind';
                calc();
            }
            document.getElementById('lc_calc').addEventListener('click', calc);
            document.getElementById('lc_reset').addEventListener('click', reset);
            document.getElementById('f-lc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['load-combo'] = tool;
})();
