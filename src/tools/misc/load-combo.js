/* load-combo 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '荷载组合计算',
        sub: '基本组合 · 标准/频遇/准永久组合 · GB 55001-2021 第 3.1 条',
        meta: {"standard": "GB 55001-2021 工程结构通用规范；GB 50009-2012 建筑结构荷载规范", "formulaSource": "GB 55001 第 3.1.7、3.1.13、3.1.16 条；GB 50009 第 3.2.8～3.2.10 条", "limitations": "房屋建筑、线性叠加、同向不利荷载效应；不含地震、有利作用及偶然作用计算；风雪输入应已按设计工作年限取标准值", "unit": "S:kN或kN·m, γG,γQ:—", "version": "1.0.0"},
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
                numField('lc_psi_f2', '其他可变荷载频遇值系数 ψ<sub>f2</sub>', '', 0.2, '按该项荷载对应条文取值') +
                numField('lc_psi_q2', '其他可变荷载准永久值系数 ψ<sub>q2</sub>', '', 0, '风荷载取0；其他荷载按对应条文取值') +
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
                '</div><div class="hint">适用：房屋建筑中同向、不利、可线性叠加的荷载效应。基本组合按 GB 55001-2021 第3.1.7、3.1.13条，γG=1.3、γQ=1.5，分别考虑两项可变作用主导。正常使用组合按 GB 50009 第3.2.8～3.2.10条。楼面/屋面活荷载按第3.1.16条考虑工作年限；风、雪输入应已按相同重现期确定。本模块不计算偶然作用、地震及有利作用。工业楼面活荷载大于4kN/m²的1.4特例未单列，仍取1.5。系数须按实际用途核对。</div>' +
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

                var psi_f2 = parseFloat(document.getElementById('lc_psi_f2').value);
                var psi_q2 = parseFloat(document.getElementById('lc_psi_q2').value);
                var values = [G1k, G2k, Q1k, Q2k, psi_c1, psi_c2, psi_f1, psi_f2, psi_q1, psi_q2];
                if (values.some(function(v){return !isFinite(v) || v < 0;}) ||
                    [psi_c1, psi_c2, psi_f1, psi_f2, psi_q1, psi_q2].some(function(v){return v > 1;}) ||
                    psi_q1 > psi_f1 || psi_f1 > psi_c1 || psi_q2 > psi_f2 || psi_f2 > psi_c2) {
                    out.innerHTML = '<div class="error-box">输入须为有限非负值；各项系数须满足 0≤ψq≤ψf≤ψc≤1。本模块仅计算同向不利效应。</div>';
                    proc.innerHTML = ''; return;
                }
                var gammaL = years === 5 ? 0.9 : years === 100 ? 1.1 : 1;
                var L1 = Q1type === 'live' ? gammaL : 1;
                var L2 = Q2type === 'live' ? gammaL : 1;
                var SGk = G1k + G2k;
                var Sd1 = 1.3 * SGk + 1.5 * L1 * Q1k + 1.5 * L2 * psi_c2 * Q2k;
                var Sd2 = 1.3 * SGk + 1.5 * L1 * psi_c1 * Q1k + 1.5 * L2 * Q2k;
                var Sd_basic = Math.max(Sd1, Sd2);
                var std1 = SGk + Q1k + psi_c2 * Q2k;
                var std2 = SGk + psi_c1 * Q1k + Q2k;
                var Sd_std = Math.max(std1, std2);
                var freq1 = SGk + psi_f1 * Q1k + psi_q2 * Q2k;
                var freq2 = SGk + psi_q1 * Q1k + psi_f2 * Q2k;
                var Sd_freq = Math.max(freq1, freq2);
                var Sd_qp = SGk + psi_q1 * Q1k + psi_q2 * Q2k;
                function line(title, formula, value) {
                    st.push('<div class="step"><b>' + title + '</b></div><div class="step">' + formula + ' = <b>' + value.toFixed(2) + '</b></div>');
                }
                st.push('<div class="step"><b>① 依据及参数</b> GB 55001-2021 第3.1.7、3.1.13、3.1.16条；γG=1.3，γQ=1.5；ΣG=' + SGk + '；Q1=' + Q1k + '；Q2=' + Q2k + '；γL1=' + L1 + '，γL2=' + L2 + '。风雪输入按相应重现期取标准值；非楼面/屋面活荷载不套用工作年限表。</div>');
                line('② 基本组合：Q1主导', '1.3×' + SGk + '+1.5×' + L1 + '×' + Q1k + '+1.5×' + L2 + '×' + psi_c2 + '×' + Q2k, Sd1);
                line('③ 基本组合：Q2主导', '1.3×' + SGk + '+1.5×' + L1 + '×' + psi_c1 + '×' + Q1k + '+1.5×' + L2 + '×' + Q2k, Sd2);
                line('④ 标准组合（GB 50009 第3.2.8条）', 'max(' + SGk + '+' + Q1k + '+' + psi_c2 + '×' + Q2k + '；' + SGk + '+' + psi_c1 + '×' + Q1k + '+' + Q2k + ')', Sd_std);
                line('⑤ 频遇组合（GB 50009 第3.2.9条）', 'max(' + SGk + '+' + psi_f1 + '×' + Q1k + '+' + psi_q2 + '×' + Q2k + '；' + SGk + '+' + psi_q1 + '×' + Q1k + '+' + psi_f2 + '×' + Q2k + ')', Sd_freq);
                line('⑥ 准永久组合（GB 50009 第3.2.10条）', SGk + '+' + psi_q1 + '×' + Q1k + '+' + psi_q2 + '×' + Q2k, Sd_qp);
                st.push('<div class="step"><b>⑦ 本次计算范围</b>未计结构重要性系数γ0；用于承载能力验算时应按第3.1.10、3.1.12条另计。不含偶然及地震组合、作用有利部分或非线性响应。来源：<a href="https://gf.cabr-fire.com/m/article-42692.htm" target="_blank" rel="noopener">GB 55001 第3.1节</a>。</div>');
                var html = resultRow('基本组合（Q1主导）', Sd1.toFixed(2));
                html += resultRow('基本组合（Q2主导）', Sd2.toFixed(2));
                html += resultRow('基本组合（取大值）', '<b>' + Sd_basic.toFixed(2) + '</b>');
                html += resultRow('标准组合（取大值）', Sd_std.toFixed(2));
                html += resultRow('频遇组合（取大值）', Sd_freq.toFixed(2));
                html += resultRow('准永久组合', Sd_qp.toFixed(2));
                html += resultRow('γL1 / γL2', L1 + ' / ' + L2);
                html += resultRow('计算范围', '同向不利效应；γ0另计');
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
                document.getElementById('lc_psi_f2').value = 0.2;
                document.getElementById('lc_psi_q2').value = 0;
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
