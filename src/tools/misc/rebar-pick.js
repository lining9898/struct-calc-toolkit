/* ============================================================
 *  tools/misc/rebar-pick.js — 配筋选筋助手
 * ------------------------------------------------------------
 *  把「需要的钢筋面积」快速落成可施工的配筋表达：
 *    · 梁柱类：直径 × 根数组合，按超配面积排序，并给出各直径最小根数；
 *    · 板墙类：直径 × 间距组合（单位宽度 1000 mm），给出满足需求的最大间距；
 *    · 单根钢筋公称面积与常见配筋面积速查。
 *  面积取值参照 GB 1499.2 公称截面积；构造要求按 GB/T 50010-2010（2024年版） 第 9 章。
 * ============================================================ */
(function () {
    var DIAS_ALL = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
    var SPACINGS = [80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250, 300];

    function tbl(title, head, rows) {
        return '<div style="margin-top:10px;font-size:12.5px;color:var(--ink-mute)">' + title + '</div>' +
            '<table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12.5px">' +
            '<tr>' + head.map(function (h) {
                return '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">' + h + '</th>';
            }).join('') + '</tr>' + rows + '</table>';
    }

    var tool = {
        title: '配筋选筋助手',
        sub: '由需求钢筋面积反查可行配筋 · 梁柱按根数 / 板墙按间距 · 含超配率与最小根数',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）(2024年版) 混凝土结构设计标准 / GB 1499.2-2024',
            formulaSource: '9.2 构造规定 · 附录 A 钢筋公称截面积',
            limitations: '仅完成面积匹配，不替代最小配筋率、间距与净距等构造验算',
            unit: 'A:mm², A/m:mm²/m, d:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="grid2">' +
                '<div class="panel"><div class="panel-title">选筋条件</div>' +
                '<form id="f-rp"><div class="grid2">' +
                selField('rp_mode', '构件类型（决定配筋表达方式）', opts([
                    { v: 'beam', t: '梁 / 柱 — 按直径 × 根数' },
                    { v: 'slab', t: '板 / 墙 — 按直径 × 间距（每米）' }
                ], 'beam')) +
                numField('rp_As', '需要的钢筋面积 A<sub>s</sub>', 'mm²', 1473, '梁柱填总面积；板墙填每米宽度面积（mm²/m）') +
                selField('rp_dmin', '最小直径', opts(DIAS_ALL.map(function (d) { return { v: d, t: 'Φ' + d }; }), 12)) +
                selField('rp_dmax', '最大直径', opts(DIAS_ALL.map(function (d) { return { v: d, t: 'Φ' + d }; }), 32)) +
                numField('rp_maxN', '最多根数（梁柱）', '根', 6, '受截面宽度与净距限制') +
                '</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="rp_calc">开始选筋</button>' +
                '<button type="button" class="btn btn-secondary" id="rp_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">推荐结果</div><div id="rp_result"></div></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算书</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="rp_proc"></div></div></div></div>' +
                '<div class="panel"><div class="panel-title">钢筋公称面积速查（GB 1499.2-2024）</div>' + areaSheet() + '</div>';
        },
        bind: function () {
            var btn = document.getElementById('rp_calc');
            if (btn) btn.addEventListener('click', calc);
            var rs = document.getElementById('rp_reset');
            if (rs) rs.addEventListener('click', function () {
                var f = document.getElementById('f-rp');
                if (f) f.reset();
                document.getElementById('rp_result').innerHTML = '';
                document.getElementById('rp_proc').innerHTML = '';
            });

            function err(m) {
                document.getElementById('rp_result').innerHTML = '<div class="error-box">' + m + '</div>';
                document.getElementById('rp_proc').innerHTML = '';
            }

            function calc() {
                var out = document.getElementById('rp_result'), proc = document.getElementById('rp_proc');
                var mode = document.getElementById('rp_mode').value;
                var As = parseFloat(document.getElementById('rp_As').value);
                var dmin = parseFloat(document.getElementById('rp_dmin').value);
                var dmax = parseFloat(document.getElementById('rp_dmax').value);
                var maxN = parseInt(document.getElementById('rp_maxN').value, 10) || 6;
                if (!(As > 0)) return err('需要的钢筋面积必须大于 0。');
                if (dmax < dmin) return err('最大直径不应小于最小直径。');

                var dias = DIAS_ALL.filter(function (d) { return d >= dmin && d <= dmax; });
                var st = [];
                st.push('<div class="step"><b>① 选筋条件</b>　配筋表达方式：' + (mode === 'beam' ? '梁柱类（直径 × 根数）' : '板墙类（直径 × 间距，按 1 m 宽）') +
                    '；需求面积 A<sub>s</sub> = <b>' + fmt(As, 0) + (mode === 'beam' ? ' mm²' : ' mm²/m') + '</b>；可选直径 Φ' + dmin + '~Φ' + dmax + '。</div>');

                if (mode === 'beam') {
                    var byNum = pickRebar(As, { dias: dias, minN: 2, maxN: maxN, maxRatio: 1.6 });
                    var byDia = pickRebarByDia(As, { dias: dias, minN: 2, maxN: maxN });
                    if (!byNum.length) {
                        out.innerHTML = '<div class="error-box">在给定直径范围与最多 ' + maxN + ' 根限制内无法满足需求面积，请放宽根数或加大直径。</div>';
                        proc.innerHTML = '';
                        return;
                    }
                    var best = byNum[0];
                    out.innerHTML =
                        resultRow('需求面积 A<sub>s</sub>', fmt(As, 0) + ' mm²') +
                        resultRow('推荐配筋', '<b>' + best.n + 'Φ' + best.d + '</b>') +
                        resultRow('实配面积', fmt(best.A, 0) + ' mm²') +
                        resultRow('超配率', fmt((best.ratio - 1) * 100, 1) + '%') +
                        resultRow('单根面积', 'Φ' + best.d + ' = ' + fmt(best.perBar, 0) + ' mm²') +
                        tbl('可选组合（按超配面积由小到大，最多 10 组）',
                            ['配筋', '实配面积 (mm²)', '超配率'],
                            byNum.slice(0, 10).map(function (r) {
                                return '<tr><td>' + r.n + 'Φ' + r.d + '</td><td>' + fmt(r.A, 0) + '</td><td>' + fmt((r.ratio - 1) * 100, 1) + '%</td></tr>';
                            }).join('')) +
                        tbl('按直径的最小根数（权衡小直径多根 / 大直径少根）',
                            ['直径', '最少根数', '实配面积 (mm²)', '超配率'],
                            byDia.map(function (r) {
                                return '<tr><td>Φ' + r.d + '</td><td>' + r.n + ' 根</td><td>' + fmt(r.A, 0) + '</td><td>' + fmt((r.ratio - 1) * 100, 1) + '%</td></tr>';
                            }).join(''));

                    st.push('<div class="step"><b>② 面积匹配</b>　按 A<sub>s</sub> = ' + fmt(As, 0) + ' mm²，在各直径下求最少根数 n = ⌈A<sub>s</sub>/a<sub>1</sub>⌉（a<sub>1</sub> 为单根公称面积），' +
                        '得到可行组合 ' + byNum.length + ' 组；其中超配面积最小的组合为 <b>' + best.n + 'Φ' + best.d + '</b>（实配 ' + fmt(best.A, 0) + ' mm²，超配 ' + fmt((best.ratio - 1) * 100, 1) + '%）。</div>');
                    st.push('<div class="step"><b>③ 选用建议</b>　梁类宜优先选用较小直径多根，使裂缝分布均匀、锚固与净距更易满足；' +
                        '当梁宽受限时（如 b ≤ 200 mm）应控制单排根数，必要时采用双排并复核 a<sub>s</sub> 取值。布置时钢筋净距不应小于 max(25 mm, d)，' +
                        '梁下部纵筋水平净距不小于 max(25 mm, d)，上部不小于 max(30 mm, 1.5d)（GB 50010 第 9.2 节）。</div>');
                } else {
                    var combos = [];
                    dias.forEach(function (d) {
                        var a1 = rebarArea(d);
                        SPACINGS.forEach(function (s) {
                            var A = a1 * 1000 / s;
                            if (A < As - 1e-6) return;
                            var ratio = A / As;
                            if (ratio > 1.6) return;
                            combos.push({ d: d, s: s, A: A, ratio: ratio, over: A - As });
                        });
                    });
                    combos.sort(function (a, b) { return a.over - b.over; });
                    if (!combos.length) {
                        out.innerHTML = '<div class="error-box">在给定直径与常用间距范围内无法满足需求面积，请加大直径或改用双层配筋。</div>';
                        proc.innerHTML = '';
                        return;
                    }
                    var b0 = combos[0];
                    var rowsByDia = dias.map(function (d) {
                        var s = spacingForArea(d, As);
                        if (!s) return null;
                        var A = rebarArea(d) * 1000 / s;
                        return '<tr><td>Φ' + d + '</td><td>' + s + ' mm</td><td>' + fmt(A, 0) + '</td><td>' + fmt((A / As - 1) * 100, 1) + '%</td></tr>';
                    }).filter(Boolean).join('');

                    out.innerHTML =
                        resultRow('需求面积 A<sub>s</sub>', fmt(As, 0) + ' mm²/m') +
                        resultRow('推荐配筋', '<b>Φ' + b0.d + '@' + b0.s + '</b>') +
                        resultRow('实配面积', fmt(b0.A, 0) + ' mm²/m') +
                        resultRow('超配率', fmt((b0.ratio - 1) * 100, 1) + '%') +
                        resultRow('允许的最大间距', fmt(rebarArea(b0.d) * 1000 / As, 0) + ' mm（按 Φ' + b0.d + '）') +
                        tbl('各直径可用的最大常用间距', ['直径', '最大间距', '实配面积 (mm²/m)', '超配率'], rowsByDia) +
                        tbl('可选组合（按超配面积由小到大，最多 10 组）', ['配筋', '实配面积 (mm²/m)', '超配率'],
                            combos.slice(0, 10).map(function (r) {
                                return '<tr><td>Φ' + r.d + '@' + r.s + '</td><td>' + fmt(r.A, 0) + '</td><td>' + fmt((r.ratio - 1) * 100, 1) + '%</td></tr>';
                            }).join(''));

                    st.push('<div class="step"><b>② 面积匹配</b>　按 1 m 宽板带计算：A = a<sub>1</sub>×1000/s（a<sub>1</sub> 为单根公称面积，s 为间距）。' +
                        '满足 A ≥ ' + fmt(As, 0) + ' mm²/m 的组合共 ' + combos.length + ' 种，其中超配最小的为 <b>Φ' + b0.d + '@' + b0.s + '</b>（' + fmt(b0.A, 0) + ' mm²/m）。</div>');
                    st.push('<div class="step"><b>③ 选用建议</b>　板类受力筋常用 Φ8~Φ12，间距宜取 100~200 mm 且不宜大于 200 mm（板厚 h ≤ 150 mm 时）' +
                        '或 1.5h；分布筋直径不宜小于 Φ6、间距不宜大于 250 mm（GB 50010 第 9.1 节）。' +
                        '支座负筋伸出长度、温度收缩筋配置要求需另行核对。</div>');
                }

                proc.innerHTML = st.join('');
                var wrap = proc.closest ? proc.closest('.proc-wrap') : null;
                if (wrap) wrap.classList.add('open');
                window._RP_RESULT = { mode: mode, As: As, dias: dias };
            }
        }
    };

    function areaSheet() {
        var rows = DIAS_ALL.map(function (d) {
            return '<tr><td>Φ' + d + '</td><td>' + fmt(rebarArea(d), 1) + '</td><td>' + fmt(rebarArea(d) * 2, 1) + '</td><td>' +
                fmt(rebarArea(d) * 3, 1) + '</td><td>' + fmt(rebarArea(d) * 4, 1) + '</td><td>' + fmt(rebarArea(d) * 5, 1) + '</td><td>' +
                fmt(rebarArea(d) * 6, 1) + '</td></tr>';
        }).join('');
        return tbl('单位：mm²；列为首数为 1~6 根时的合计面积',
            ['直径', '1 根', '2 根', '3 根', '4 根', '5 根', '6 根'], rows);
    }

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['rebar-pick'] = tool;
    console.log('[Tool] rebar-pick registered.');
})();
