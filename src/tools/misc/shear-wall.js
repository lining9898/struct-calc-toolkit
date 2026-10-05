/* shear-wall 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '剪力墙稳定计算',
        sub: '墙体稳定验算 · 轴压比 · 边缘构件判定 · 墙厚校核 · JGJ 3-2010',
        meta: {"standard": "GB/T 50010-2010（2024年版） + JGJ 3-2010", "formulaSource": "附录D", "limitations": "墙肢平面外稳定+轴压比+受压承载力", "unit": "N:kN, λ:—, φ:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">墙肢与材料参数</div>' +
                '<form id="f-sw"><div class="grid2">' +
                numField('sw_bw', '墙厚 b<sub>w</sub>', 'mm', 250) +
                numField('sw_hw', '墙肢长度 h<sub>w</sub>', 'mm', 3000, '墙肢截面高度（沿水平方向）') +
                numField('sw_he', '层高 H', 'm', 3.6, '墙肢所在楼层的层高') +
                numField('sw_N', '轴向压力设计值 N', 'kN', 2000, '墙顶组合的竖向荷载设计值') +
                numField('sw_Lwall', '墙肢无支长度 l<sub>w</sub>', 'm', 3.6, '墙肢沿墙长方向无支长度（两侧洞口或墙肢交点间距）') +
                selField('sw_con', '混凝土等级', conOpts('C40')) +
                selField('sw_steel', '分布钢筋等级', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('sw_rho', '竖向分布筋配筋率 ρ<sub>w</sub>', '%', 0.5, '墙肢竖向分布钢筋配筋率') +
                selField('sw_seis', '抗震等级', opts([
                    { v: 's9', t: '一级（9度）' },
                    { v: 's1', t: '一级（6、7、8度）' },
                    { v: 's2', t: '二级' },
                    { v: 's3', t: '三级' },
                    { v: 's4', t: '四级' },
                    { v: 's0', t: '非抗震' }
                ], 's2')) +
                selField('sw_pos', '验算部位', opts([
                    { v: 'bottom', t: '底部加强部位' },
                    { v: 'other', t: '其他部位' }
                ], 'bottom')) +
                selField('sw_shape', '墙肢截面形状', opts([
                    { v: 'rect', t: '一字形（矩形）' },
                    { v: 'T', t: 'T形（翼缘+腹板）' },
                    { v: 'L', t: 'L形' },
                    { v: 'channel', t: '槽形/工字形' }
                ], 'rect')) +
                selField('sw_support', '墙肢支承条件', opts([
                    { v: 'two', t: '两边支承（单片独立墙肢）' },
                    { v: 'three_f', t: '三边支承（T/L形翼缘）' },
                    { v: 'three_w', t: '三边支承（T形腹板）' },
                    { v: 'four', t: '四边支承（槽形/工字形腹板）' }
                ], 'two')) +
                numField('sw_bf', '翼缘截面高度 b<sub>f</sub>', 'mm', 800, 'T/L形翼缘截面高度（沿墙长方向伸出长度）') +
                '</div><div class="hint">说明：墙体稳定验算按 JGJ 3-2010 附录D（q ≤ E<sub>c</sub>·t³/(10·l₀²)，l₀ = β·h）；β按D.0.3条：两边支承β=1.0；三边支承翼缘β=1/[1+(h/(2·b<sub>f</sub>))²]≥0.25；T形腹板三边支承β=1/[1+(h/(2·b<sub>w</sub>))²]≥0.25；四边支承腹板β=1/[1+(3h/(2·b<sub>w</sub>))²]≥0.20；轴压比按表7.2.13；墙厚校核按7.2.1条；约束边缘构件判定按7.2.14条；分布钢筋按7.2.17条。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="sw_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="sw_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="sw_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="sw_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('sw_result'), proc = document.getElementById('sw_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var bw = parseFloat(document.getElementById('sw_bw').value);
                var hw = parseFloat(document.getElementById('sw_hw').value);
                var H = parseFloat(document.getElementById('sw_he').value);
                var N = parseFloat(document.getElementById('sw_N').value);
                var conV = document.getElementById('sw_con').value;
                var steelV = document.getElementById('sw_steel').value;
                var rhoW = parseFloat(document.getElementById('sw_rho').value) / 100;
                var seisV = document.getElementById('sw_seis').value;
                var posV = document.getElementById('sw_pos').value;
                var shapeV = document.getElementById('sw_shape').value;
                var supV = document.getElementById('sw_support').value;
                var bf = parseFloat(document.getElementById('sw_bf').value);
                if (!(bw > 0 && hw > 0 && H > 0)) return err('墙厚、墙长和层高必须为正数。');
                var con = CONCRETE[conV];
                var fc = con.fc, Ec = con.Ec;
                var st = [];

                // 墙肢类型判别
                var hw_bw = hw / bw;
                var stType, isShort = false;
                if (hw_bw <= 4) { stType = '柱（异形柱，按柱设计）'; }
                else if (hw_bw <= 8) { stType = '短肢剪力墙'; isShort = true; }
                else { stType = '一般剪力墙'; }

                var A = bw * hw;
                st.push('<div class="step"><b>① 截面参数（' + stType + '）</b>　墙厚 b<sub>w</sub> = ' + bw + ' mm；墙长 h<sub>w</sub> = ' + hw + ' mm；h<sub>w</sub>/b<sub>w</sub> = ' + fmt(hw_bw, 1) + '</div>');
                st.push('<div class="step">　　A = b<sub>w</sub>×h<sub>w</sub> = ' + fmt(A, 0) + ' mm²；E<sub>c</sub> = ' + fmt(Ec/1000, 0) + '×10³ N/mm²</div>');

                // ② 墙厚校核 (7.2.1条)
                var minT, minTDesc;
                if (seisV === 's0') { minT = 160; minTDesc = '非抗震 ≥ 160mm'; }
                else if (seisV === 's4' || seisV === 's3') {
                    minT = 160; minTDesc = (seisV==='s4'?'四级':'三级') + ' ≥ 160mm';
                    if (shapeV === 'rect' && posV === 'bottom') { minT = 180; minTDesc += '；一字形独立底部 ≥ 180mm'; }
                } else {
                    if (posV === 'bottom') {
                        minT = (shapeV === 'rect') ? 220 : 200;
                        minTDesc = '一、二级底部加强部位' + (shapeV === 'rect' ? '一字形独立' : '') + ' ≥ ' + minT + 'mm';
                    } else {
                        minT = (shapeV === 'rect') ? 180 : 160;
                        minTDesc = '一、二级其他部位' + (shapeV === 'rect' ? '一字形独立' : '') + ' ≥ ' + minT + 'mm';
                    }
                }
                if (isShort) {
                    var shortMinT = (posV === 'bottom') ? 200 : 180;
                    if (shortMinT > minT) { minT = shortMinT; minTDesc += '；短肢 ≥ ' + shortMinT + 'mm（7.2.2条）'; }
                }
                // 墙厚与层高/无支长度比值校核 (7.2.1条)
                var Lwall = parseFloat(document.getElementById('sw_Lwall').value);
                var ratioDenom = (seisV === 's9' || seisV === 's1' || seisV === 's2') ? 20 : 25;
                if (posV === 'bottom' && (seisV === 's9' || seisV === 's1' || seisV === 's2')) ratioDenom = 20;
                else if (seisV !== 's0') ratioDenom = 25;
                else ratioDenom = 25;
                var minT_h = h_mm / ratioDenom;
                var minT_lw = Lwall * 1000 / ratioDenom;
                var minT_ratio = Math.max(minT_h, minT_lw);
                if (minT_ratio > minT) {
                    minT = Math.ceil(minT_ratio);
                    minTDesc += '；层高/无支长度比 1/' + ratioDenom + ' ≥ ' + fmt(minT_ratio, 0) + 'mm';
                }
                var thickOk = bw >= minT;
                st.push('<div class="step"><b>② 墙厚校核（7.2.1条' + (isShort ? '+7.2.2条' : '') + '）</b>　' + minTDesc + '　b<sub>w</sub> = ' + bw + ' mm ≥ ' + minT + ' mm ⇒ ' + (thickOk ? tag('ok','满足') : tag('err','不足')) + '</div>');

                // ③ β 和 l₀ (附录D D.0.2/D.0.3条)
                var beta, betaDesc;
                var h_mm = H * 1000; // 层高（mm）
                if (supV === 'two') {
                    beta = 1.0;
                    betaDesc = '两边支承，β = 1.0（D.0.3条第1款）';
                } else if (supV === 'three_f') {
                    // D.0.3-2: T/L形翼缘三边支承 β = 1/[1+(h/(2·bf))²]，≥0.25
                    beta = 1 / (1 + Math.pow(h_mm / (2 * bf), 2));
                    if (beta < 0.25) beta = 0.25;
                    betaDesc = '三边支承（翼缘），β = 1/[1+(h/(2×b<sub>f</sub>))²] = 1/[1+(' + fmt(h_mm,0) + '/(2×' + bf + '))²] = ' + fmt(beta, 4) + '（≥0.25，D.0.3-2式）';
                } else if (supV === 'three_w') {
                    // D.0.3-3: T形腹板三边支承 β = 1/[1+(h/(2·bw))²]，≥0.25（bw代hw）
                    beta = 1 / (1 + Math.pow(h_mm / (2 * hw), 2));
                    if (beta < 0.25) beta = 0.25;
                    betaDesc = '三边支承（腹板），β = 1/[1+(h/(2×b<sub>w</sub>))²] = 1/[1+(' + fmt(h_mm,0) + '/(2×' + hw + '))²] = ' + fmt(beta, 4) + '（≥0.25，D.0.3-3式）';
                } else {
                    // D.0.3-4: 槽形/工字形腹板四边支承 β = 1/[1+(3h/(2·bw))²]，≥0.20
                    beta = 1 / (1 + Math.pow(3 * h_mm / (2 * hw), 2));
                    if (beta < 0.20) beta = 0.20;
                    betaDesc = '四边支承（腹板），β = 1/[1+(3h/(2×b<sub>w</sub>))²] = 1/[1+(3×' + fmt(h_mm,0) + '/(2×' + hw + '))²] = ' + fmt(beta, 4) + '（≥0.20，D.0.3-4式）';
                }
                var l0 = beta * H;
                st.push('<div class="step"><b>③ 计算长度（附录D D.0.2/D.0.3条）</b>　' + betaDesc + '　l<sub>0</sub> = β·h = ' + fmt(beta, 4) + '×' + H + ' = <b>' + fmt(l0, 4) + ' m</b></div>');

                // ④ 墙体稳定验算 (D.0.1条)
                var q = N * 1000 / hw;
                var qCr = Ec * Math.pow(bw, 3) / (10 * Math.pow(l0 * 1000, 2));
                var stableOk = q <= qCr;
                st.push('<div class="step"><b>④ 墙体稳定验算（D.0.1条）</b>　q ≤ E<sub>c</sub>·t³/(10·l<sub>0</sub>²)</div>');
                st.push('<div class="step">　　q = N/h<sub>w</sub> = ' + fmt(N,0) + '×10³/' + hw + ' = ' + fmt(q, 2) + ' N/mm；q<sub>cr</sub> = ' + fmt(Ec/1000,0) + '×10³×' + bw + '³/(10×' + fmt(l0*1000,0) + '²) = <b>' + fmt(qCr, 2) + ' N/mm</b> ⇒ ' + (stableOk ? tag('ok','满足') : tag('err','不满足')) + '</div>');

                // ⑤ 轴压比 (表7.2.13)
                var n_ratio = N * 1000 / (fc * A);
                var nLimit, nLimitDesc;
                if (seisV === 's0') { nLimit = 1.0; nLimitDesc = '非抗震，无限值'; }
                else if (seisV === 's9') { nLimit = 0.4; nLimitDesc = '一级(9度) 0.4'; }
                else if (seisV === 's1') { nLimit = 0.5; nLimitDesc = '一级(6-8度) 0.5'; }
                else if (seisV === 's2') { nLimit = 0.6; nLimitDesc = '二级 0.6'; }
                else if (seisV === 's3') { nLimit = 0.6; nLimitDesc = '三级 0.6'; }
                else { nLimit = 0.7; nLimitDesc = '四级 0.7'; }
                if (isShort && seisV !== 's0') {
                    var sl = { s9:0.45, s1:0.45, s2:0.50, s3:0.55, s4:0.65 }[seisV];
                    if (shapeV === 'rect') sl -= 0.1;
                    nLimit = sl; nLimitDesc += '；短肢' + (shapeV==='rect'?'一字形':'') + ' ' + fmt(sl, 2) + '（7.2.2条）';
                }
                var nOk = n_ratio <= nLimit;
                st.push('<div class="step"><b>⑤ 轴压比（表7.2.13' + (isShort?'+7.2.2条':'') + '）</b>　n = N/(f<sub>c</sub>·A) = ' + fmt(N,0) + '×10³/(' + fc + '×' + fmt(A,0) + ') = <b>' + fmt(n_ratio, 4) + '</b>　限值 ' + fmt(nLimit, 2) + ' ⇒ ' + (nOk ? tag('ok','满足') : tag('err','超限')) + '</div>');

                // ⑥ 边缘构件判定 (7.2.14条)
                var needConstr = false, edgeDesc = '';
                if (seisV !== 's0') {
                    var eLim = { s9:0.15, s1:0.20, s2:0.30, s3:0.30, s4:1.0 }[seisV];
                    needConstr = (posV === 'bottom') && (n_ratio > eLim);
                    if (posV === 'bottom') edgeDesc = '表7.2.14限值 ' + fmt(eLim, 2) + '；n=' + fmt(n_ratio, 4) + (needConstr ? ' > ' + fmt(eLim,2) + ' ⇒ 需约束边缘构件' : ' ≤ ' + fmt(eLim,2) + ' ⇒ 可设构造边缘构件');
                    else edgeDesc = '非底部加强区，按7.2.16条设构造边缘构件';
                } else { edgeDesc = '非抗震，墙端配2φ12纵筋，箍筋φ6@250（7.2.16条第5款）'; }
                st.push('<div class="step"><b>⑥ 边缘构件判定（7.2.14条）</b>　' + edgeDesc + '</div>');

                // ⑦ 分布钢筋 (7.2.17条)
                var rhoMin = (seisV === 's0' || seisV === 's4') ? 0.0020 : 0.0025;
                var rhoOk = rhoW >= rhoMin;
                st.push('<div class="step"><b>⑦ 分布钢筋（7.2.17条）</b>　ρ<sub>w</sub> = ' + fmt(rhoW*100, 2) + '% ≥ ' + fmt(rhoMin*100, 2) + '% ⇒ ' + (rhoOk ? tag('ok','满足') : tag('err','不足')) + '（间距≤300mm，直径≥8mm，7.2.18条）</div>');

                // ⑧ 整体稳定验算提示 (D.0.4条)
                if (shapeV !== 'rect' && supV !== 'two') {
                    var needOverall = (bf < 2 * bw && bf < 800) || (hw < 2 * bw && hw < 800);
                    if (needOverall) {
                        var I_approx = Math.min(bw * Math.pow(hw, 3) / 12, bw * Math.pow(bf + bw, 3) / 12);
                        var N_overall = N * 1000;
                        var NCr_overall = 1.2 * Ec * I_approx / Math.pow(h_mm, 3);
                        var overallOk = N_overall <= NCr_overall;
                        st.push('<div class="step"><b>⑧ 整体稳定验算（D.0.4条）</b>　翼缘或腹板高度小于2倍墙厚且小于800mm，需验算整体稳定</div>');
                        st.push('<div class="step">　　N = ' + fmt(N,0) + '×10³ N；N<sub>cr</sub> = 1.2×E<sub>c</sub>×I/h³ = 1.2×' + fmt(Ec/1000,0) + '×10³×' + fmt(I_approx,0) + '/' + fmt(h_mm,0) + '³ = <b>' + fmt(NCr_overall/1000, 2) + ' kN</b> ⇒ ' + (overallOk ? tag('ok','满足') : tag('err','不满足')) + '</div>');
                    } else {
                        st.push('<div class="step"><b>⑧ 整体稳定验算（D.0.4条）</b>　翼缘/腹板高度 ≥ 2倍墙厚或 ≥ 800mm，无需验算整体稳定</div>');
                    }
                }

                var html = resultRow('墙肢类型', stType + '（h<sub>w</sub>/b<sub>w</sub> = ' + fmt(hw_bw, 1) + '）');
                html += resultRow('墙厚校核', bw + ' mm ≥ ' + minT + ' mm ' + (thickOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('计算长度', 'β = ' + fmt(beta, 4) + '；l<sub>0</sub> = ' + fmt(l0, 3) + ' m');
                html += resultRow('墙体稳定', 'q = ' + fmt(q, 2) + ' ≤ q<sub>cr</sub> = ' + fmt(qCr, 2) + ' N/mm ' + (stableOk ? tag('ok','满足') : tag('err','不满足')));
                html += resultRow('轴压比', fmt(n_ratio, 4) + '（限值 ' + fmt(nLimit, 2) + '） ' + (nOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('边缘构件', needConstr ? '需设约束边缘构件（7.2.15条）' : '可设构造边缘构件（7.2.16条）');
                html += resultRow('分布钢筋', 'ρ = ' + fmt(rhoW*100, 2) + '% ≥ ' + fmt(rhoMin*100, 2) + '% ' + (rhoOk ? tag('ok','满足') : tag('err','不足')));
                var allOk = stableOk && nOk && thickOk && rhoOk;
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '各项验算均满足' : '存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._SW_RESULT = { beta: beta, l0: l0, q: q, qCr: qCr, stableOk: stableOk, n_ratio: n_ratio, nLimit: nLimit, nOk: nOk, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                var defs = { sw_bw:250, sw_hw:3000, sw_he:3.6, sw_N:2000, sw_rho:0.5, sw_bf:800, sw_Lwall:3.6 };
                Object.keys(defs).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = defs[id]; });
                document.getElementById('sw_con').value = 'C40';
                document.getElementById('sw_steel').value = 'HRB400';
                document.getElementById('sw_seis').value = 's2';
                document.getElementById('sw_pos').value = 'bottom';
                document.getElementById('sw_shape').value = 'rect';
                document.getElementById('sw_support').value = 'two';
                calc();
            }
            document.getElementById('sw_calc').addEventListener('click', calc);
            document.getElementById('sw_reset').addEventListener('click', reset);
            document.getElementById('f-sw').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['shear-wall'] = tool;
})();
