/* crane-load 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '吊车荷载计算',
        sub: '纵向/横向水平荷载 · 多台组合折减 · 动力系数 · 组合值系数 · GB 50009 §6',
        meta: {"standard": "GB 50009-2012 建筑结构荷载规范", "formulaSource": "6", "limitations": "纵向/横向水平荷载，多台吊车组合折减", "unit": "Tk:kN, Pmax:kN, μ:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">吊车参数</div>' +
                '<form id="f-cl"><div class="grid2">' +
                selField('cl_type', '吊车类型', opts([
                    { v: 'soft', t: '软钩吊车' },
                    { v: 'hard', t: '硬钩吊车' }
                ], 'soft')) +
                selField('cl_grade', '工作级别', opts([
                    { v: 'A1-A3', t: 'A1~A3（轻级）' },
                    { v: 'A4-A5', t: 'A4~A5（中级）' },
                    { v: 'A6-A7', t: 'A6~A7（重级）' },
                    { v: 'A8', t: 'A8（特重级，软钩）' }
                ], 'A4-A5')) +
                numField('cl_Q', '额定起重量', 't', 10, '吊车额定起重量') +
                numField('cl_m', '横行小车重量', 't', 3, '小车自重（含吊具）') +
                numField('cl_Pmax', '最大轮压 P<sub>max</sub>', 'kN', 120, '一侧车轮最大轮压标准值') +
                numField('cl_Pmin', '最小轮压 P<sub>min</sub>', 'kN', 40, '一侧车轮最小轮压标准值') +
                numField('cl_nw', '一侧刹车轮数', '个', 1, '一侧轨道上刹车轮数量') +
                '</div><div class="panel-title" style="margin-top:14px;">多台吊车组合参数</div><div class="grid2">' +
                selField('cl_ncrane', '参与组合吊车台数', opts([
                    { v: 1, t: '1台' },
                    { v: 2, t: '2台' },
                    { v: 3, t: '3台' },
                    { v: 4, t: '4台' }
                ], 2)) +
                selField('cl_calctype', '计算对象', opts([
                    { v: 'beam', t: '吊车梁（承载力）' },
                    { v: 'frame', t: '排架柱' },
                    { v: 'normal', t: '正常使用极限状态' }
                ], 'frame')) +
                '</div><div class="hint">说明：依据 GB 50009-2012 §6.1~6.4 计算吊车纵向/横向水平荷载、多台吊车折减系数和动力系数。纵向水平力=刹车轮最大轮压之和×10%。横向水平力百分数：软钩≤10t取12%，16~50t取10%，≥75t取8%；硬钩取20%。多台吊车折减系数：2台A1~A5取0.90，A6~A8取0.95。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="cl_calc">计算吊车荷载</button>' +
                '<button type="button" class="btn btn-secondary" id="cl_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="cl_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="cl_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('cl_result');
                var proc = document.getElementById('cl_proc');
                var type = document.getElementById('cl_type').value;
                var grade = document.getElementById('cl_grade').value;
                var Q = parseFloat(document.getElementById('cl_Q').value);
                var m = parseFloat(document.getElementById('cl_m').value);
                var Pmax = parseFloat(document.getElementById('cl_Pmax').value);
                var Pmin = parseFloat(document.getElementById('cl_Pmin').value);
                var nw = parseFloat(document.getElementById('cl_nw').value);
                var ncrane = parseInt(document.getElementById('cl_ncrane').value);
                var calctype = document.getElementById('cl_calctype').value;
                var st = [];

                // ① 横向水平荷载百分数（表6.1.2）
                var pct;
                if (type === 'hard') {
                    pct = 20;
                } else {
                    if (Q <= 10) pct = 12;
                    else if (Q <= 50) pct = 10;
                    else if (Q >= 75) pct = 8;
                    else pct = 10; // 中间插值
                }
                var T_h = (m + Q) * pct / 100 * 9.81; // kN (g=9.81m/s²)
                var T_per_wheel = T_h / 2; // 等分于桥架两端

                st.push('<div class="step"><b>① 吊车横向水平荷载标准值 T（§6.1.2）</b></div>');
                st.push('<div class="step">　　百分数（表6.1.2）：' + type + '，起重量' + Q + 't → <b>' + pct + '%</b></div>');
                st.push('<div class="step">　　T = (m+Q)×' + pct + '%×g = (' + m + '+' + Q + ')×0.' + pct + '×9.81</div>');
                st.push('<div class="step">　　<b>T = ' + T_h.toFixed(2) + ' kN</b>（总横向水平力）</div>');
                st.push('<div class="step">　　每端车轮平均分配：T/2 = <b>' + T_per_wheel.toFixed(2) + ' kN</b></div>');

                // ② 纵向水平荷载（§6.1.2-1）
                var T_long = nw * Pmax * 0.10;
                st.push('<div class="step"><b>② 吊车纵向水平荷载标准值 T<sub>L</sub>（§6.1.2-1）</b></div>');
                st.push('<div class="step">　　T<sub>L</sub> = 刹车轮最大轮压之和×10%</div>');
                st.push('<div class="step">　　T<sub>L</sub> = ' + nw + '×' + Pmax + '×0.10 = <b>' + T_long.toFixed(2) + ' kN</b></div>');

                // ③ 多台吊车折减系数（表6.2.2）
                var reduction;
                var isHeavy = (grade === 'A6-A7' || grade === 'A8');
                if (ncrane === 1) reduction = 1.0;
                else if (ncrane === 2) reduction = isHeavy ? 0.95 : 0.90;
                else if (ncrane === 3) reduction = isHeavy ? 0.90 : 0.85;
                else reduction = isHeavy ? 0.85 : 0.80;

                st.push('<div class="step"><b>③ 多台吊车折减系数（表6.2.2）</b></div>');
                st.push('<div class="step">　　' + ncrane + '台，工作级别' + grade + ' → 折减系数 = <b>' + reduction + '</b></div>');

                // ④ 动力系数（§6.3.1）
                var dyn;
                if (type === 'soft' && (grade === 'A1-A3' || grade === 'A4-A5')) {
                    dyn = 1.05;
                } else {
                    dyn = 1.10;
                }
                st.push('<div class="step"><b>④ 动力系数（§6.3.1）</b></div>');
                if (calctype === 'beam') {
                    st.push('<div class="step">　　' + type + '，工作级别' + grade + ' → 动力系数 = <b>' + dyn + '</b>（仅吊车梁承载力计算）</div>');
                } else {
                    st.push('<div class="step">　　排架柱/正常使用时动力系数 = 1.0（不乘动力系数）</div>');
                    dyn = 1.0;
                }

                // ⑤ 组合值/频遇值/准永久值系数（表6.4.1）
                var psi_c, psi_f, psi_q;
                if (type === 'hard' || grade === 'A8') {
                    psi_c = 0.95; psi_f = 0.95; psi_q = 0.95;
                } else if (grade === 'A1-A3') {
                    psi_c = 0.70; psi_f = 0.60; psi_q = 0.50;
                } else if (grade === 'A4-A5') {
                    psi_c = 0.70; psi_f = 0.70; psi_q = 0.60;
                } else {
                    psi_c = 0.70; psi_f = 0.70; psi_q = 0.70;
                }
                st.push('<div class="step"><b>⑤ 组合值/频遇值/准永久值系数（表6.4.1）</b></div>');
                st.push('<div class="step">　　ψ<sub>c</sub> = ' + psi_c + ', ψ<sub>f</sub> = ' + psi_f + ', ψ<sub>q</sub> = ' + psi_q + '</div>');
                if (calctype === 'normal') {
                    st.push('<div class="step">　　注：排架设计准永久组合中可不考虑吊车荷载（§6.4.2）</div>');
                }

                // ⑥ 综合结果
                var Pmax_design = Pmax * dyn * reduction;
                var Pmin_design = Pmin * reduction;
                var T_h_design = T_per_wheel * reduction;

                st.push('<div class="step"><b>⑥ 设计值汇总</b></div>');
                st.push('<div class="step">　　竖向荷载（最大轮压，设计值）= P<sub>max</sub>×动力系数×折减 = ' + Pmax + '×' + dyn + '×' + reduction + ' = <b>' + Pmax_design.toFixed(2) + ' kN</b></div>');
                st.push('<div class="step">　　竖向荷载（最小轮压，标准值×折减）= ' + Pmin + '×' + reduction + ' = <b>' + Pmin_design.toFixed(2) + ' kN</b></div>');
                st.push('<div class="step">　　横向水平（每端，标准值×折减）= ' + T_per_wheel.toFixed(2) + '×' + reduction + ' = <b>' + T_h_design.toFixed(2) + ' kN</b></div>');
                st.push('<div class="step">　　纵向水平（标准值×折减）= ' + T_long.toFixed(2) + '×' + reduction + ' = <b>' + (T_long * reduction).toFixed(2) + ' kN</b></div>');

                var html = resultRow('横向水平荷载 T', T_h.toFixed(2) + ' kN（总力）');
                html += resultRow('每端横向力 T/2', T_per_wheel.toFixed(2) + ' kN');
                html += resultRow('纵向水平荷载 T<sub>L</sub>', T_long.toFixed(2) + ' kN');
                html += resultRow('折减系数', reduction.toString());
                html += resultRow('动力系数', dyn.toString());
                html += resultRow('ψ<sub>c</sub>/ψ<sub>f</sub>/ψ<sub>q</sub>', psi_c + '/' + psi_f + '/' + psi_q);
                html += resultRow('说明', badge('badge-ok', '按GB 50009 §6计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('cl_type').value = 'soft';
                document.getElementById('cl_grade').value = 'A4-A5';
                document.getElementById('cl_Q').value = 10;
                document.getElementById('cl_m').value = 3;
                document.getElementById('cl_Pmax').value = 120;
                document.getElementById('cl_Pmin').value = 40;
                document.getElementById('cl_nw').value = 1;
                document.getElementById('cl_ncrane').value = 2;
                document.getElementById('cl_calctype').value = 'frame';
                calc();
            }
            document.getElementById('cl_calc').addEventListener('click', calc);
            document.getElementById('cl_reset').addEventListener('click', reset);
            document.getElementById('f-cl').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['crane-load'] = tool;
})();
