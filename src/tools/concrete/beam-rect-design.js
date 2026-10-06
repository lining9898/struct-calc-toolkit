/* ============================================================
 *  tools/concrete/beam-rect-design.js — 矩形梁正截面配筋设计
 * ------------------------------------------------------------
 *  与已有的「矩形梁正截面承载力（复核）」互补：本模块由设计弯矩
 *  M 出发反算所需受拉钢筋面积，单筋优先、超筋自动转双筋，
 *  并按混凝土保护层与最小配筋率要求给出选筋组合（直径×根数）。
 *  规范依据：GB/T 50010-2010（2024年版） 第 6.2.10 条、第 8.5 节。
 * ============================================================ */
(function () {
    var tool = {
        title: '矩形梁正截面配筋设计',
        sub: '由设计弯矩 M 反算配筋 · 单筋优先 / 超筋自动双筋 · GB/T 50010-2010（2024年版） 第 6.2.10 条',
        meta: {
            standard: 'GB/T 50010-2010（2024年版） 混凝土结构设计标准',
            formulaSource: '6.2.10 · GB 55008-2021 第 4.4.6 条',
            limitations: '矩形截面受弯构件，单筋优先；M 超过单筋界限时按双筋设计；不考虑抗震调整',
            unit: 'M:kN·m, b/h/as:mm, As:mm²',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="grid2">' +
                '<div class="panel"><div class="panel-title">设计条件</div>' +
                '<form id="f-bd"><div class="grid2">' +
                numField('bd_b', '截面宽度 b', 'mm', 250, '矩形梁宽度') +
                numField('bd_h', '截面高度 h', 'mm', 600) +
                numField('bd_as', '受拉筋合力点至受拉边缘 a<sub>s</sub>', 'mm', 40, '单排约 35~45，双排约 60~70') +
                numField('bd_as2', '受压筋合力点 a<sub>s</sub>′', 'mm', 40, '双筋设计时使用') +
                selField('bd_con', '混凝土强度等级', conOpts('C30')) +
                selField('bd_reb', '钢筋级别', opts([
                    { v: 'HRB400', t: 'HRB400' },
                    { v: 'HRB500', t: 'HRB500' }
                ], 'HRB400')) +
                numField('bd_M', '设计弯矩 M', 'kN·m', 180, '基本组合下的弯矩设计值') +
                '</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="bd_calc">开始设计</button>' +
                '<button type="button" class="btn btn-secondary" id="bd_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">截面预览与结果摘要</div>' +
                '<div id="bd_svg" style="display:flex;justify-content:center;padding:8px 0 4px"></div>' +
                '<div id="bd_result"></div></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算书</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="bd_proc"></div></div></div></div>';
        },
        bind: function () {
            var btn = document.getElementById('bd_calc');
            if (btn) btn.addEventListener('click', calc);
            var rs = document.getElementById('bd_reset');
            if (rs) rs.addEventListener('click', function () {
                var f = document.getElementById('f-bd');
                if (f) f.reset();
                document.getElementById('bd_result').innerHTML = '';
                document.getElementById('bd_proc').innerHTML = '';
                document.getElementById('bd_svg').innerHTML = '';
            });

            function err(m) {
                document.getElementById('bd_result').innerHTML = '<div class="error-box">' + m + '</div>';
                document.getElementById('bd_proc').innerHTML = '';
                document.getElementById('bd_svg').innerHTML = '';
            }

            function svgPreview(b, h, asV, nMain, nComp) {
                var W = 210, H = 250, top = 16;
                var s = Math.min(170 / Math.max(b, h), 2.5);
                var dw = Math.max(b * s, 30), dh = h * s;
                var x0 = 16 + (W - 32 - dw) / 2, y0 = top;
                var yt = y0 + dh - asV * s, yc = y0 + asV * s;
                var o = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;">';
                o += '<rect x="' + fmt(x0, 1) + '" y="' + y0 + '" width="' + fmt(dw, 1) + '" height="' + fmt(dh, 1) + '" fill="#eef2f7" stroke="#94a3b8" stroke-width="1.2"/>';
                // 受拉钢筋
                var cn = Math.min(nMain || 2, 6);
                for (var i = 0; i < cn; i++) {
                    var t = (i + 1) / (cn + 1);
                    o += '<circle cx="' + fmt(x0 + dw * t, 1) + '" cy="' + fmt(yt, 1) + '" r="4.2" fill="#2563eb"/>';
                }
                o += '<text x="' + fmt(x0 + dw + 6, 1) + '" y="' + fmt(yt + 4, 1) + '" font-size="10.5" fill="#2563eb">As ' + (cn || 2) + '根</text>';
                if (nComp > 0) {
                    var cc = Math.min(nComp, 6);
                    for (var j = 0; j < cc; j++) {
                        var t2 = (j + 1) / (cc + 1);
                        o += '<circle cx="' + fmt(x0 + dw * t2, 1) + '" cy="' + fmt(yc, 1) + '" r="4.2" fill="#9CA3AF"/>';
                    }
                    o += '<text x="' + fmt(x0 + dw + 6, 1) + '" y="' + fmt(yc + 4, 1) + '" font-size="10.5" fill="#6B7280">As′ ' + cc + '根</text>';
                }
                o += '<line x1="' + fmt(x0 - 5, 1) + '" y1="' + y0 + '" x2="' + fmt(x0 - 5, 1) + '" y2="' + fmt(y0 + dh, 1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(x0 - 9, 1) + '" y="' + fmt(y0 + dh / 2 + 3, 1) + '" text-anchor="end" font-size="10" fill="#64748b">h</text>';
                o += '<line x1="' + fmt(x0, 1) + '" y1="' + fmt(y0 + dh + 6, 1) + '" x2="' + fmt(x0 + dw, 1) + '" y2="' + fmt(y0 + dh + 6, 1) + '" stroke="#94a3b8" stroke-width="1"/>';
                o += '<text x="' + fmt(x0 + dw / 2, 1) + '" y="' + fmt(y0 + dh + 20, 1) + '" text-anchor="middle" font-size="10" fill="#64748b">b</text>';
                o += '</svg>';
                return o;
            }

            function rebarText(list, take) {
                if (!list || !list.length) return '—';
                return list.slice(0, take || 3).map(function (r) {
                    return r.n + 'Φ' + r.d + '（' + fmt(r.A, 0) + ' mm²）';
                }).join('　｜　');
            }

            function rebarTable(list, title) {
                if (!list || !list.length) return '';
                var rows = list.slice(0, 8).map(function (r) {
                    return '<tr><td>' + r.n + 'Φ' + r.d + '</td><td>' + fmt(r.A, 0) + '</td>' +
                        '<td>' + fmt((r.ratio - 1) * 100, 1) + '%</td></tr>';
                }).join('');
                return '<div style="margin-top:10px;font-size:12.5px;color:var(--ink-mute)">' + title + '</div>' +
                    '<table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12.5px">' +
                    '<tr><th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">配筋组合</th>' +
                    '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">实配面积 (mm²)</th>' +
                    '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">超配</th></tr>' +
                    rows + '</table>';
            }

            function calc() {
                var out = document.getElementById('bd_result');
                var proc = document.getElementById('bd_proc');
                var b = parseFloat(document.getElementById('bd_b').value);
                var h = parseFloat(document.getElementById('bd_h').value);
                var asV = parseFloat(document.getElementById('bd_as').value);
                var as2V = parseFloat(document.getElementById('bd_as2').value) || asV;
                var conId = document.getElementById('bd_con').value;
                var rebId = document.getElementById('bd_reb').value;
                var M = parseFloat(document.getElementById('bd_M').value);

                if (!(b > 0 && h > 0)) return err('截面宽度 b 与高度 h 必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应介于 0 与 h 之间。');
                if (!(M > 0)) return err('设计弯矩 M 必须大于 0。');
                if (!CONCRETE[conId] || !REBAR_FLEX[rebId]) return err('请选择有效的混凝土与钢筋等级。');
                var materialError = concreteRebarError(CONCRETE[conId], REBAR_FLEX[rebId]);
                if (materialError) return err(materialError);

                // 统一调用 core/calculator.js 的共享实现，避免同一公式两处维护
                var R = designBeamRectSection({
                    b: b, h: h, as: asV, as2: as2V,
                    con: conId, reb: rebId, M: M
                });
                if (!R.ok) return err(R.error);

                var h0 = R.h0, fc = R.fc, ft = R.ft, a1 = R.a1, b1 = R.b1, ecu = R.ecu;
                var fy = R.fy, fyp = R.fyp, es = R.es;
                var xi_b = R.xi_b, xb = R.xb, Mu_single_max = R.Mu_single_max;
                var M_Nmm = M * 1e6;
                var As = R.As, AsCalc = R.AsCalc, AsP = R.AsP, x = R.x, isDouble = R.isDouble, note = '';
                var xi = R.xi, rho_min = R.rho_min, AsMin = R.AsMin, byMin = R.byMin;
                var st = [];

                st.push('<div class="step"><b>① 基本数据</b>　h<sub>0</sub> = h − a<sub>s</sub> = ' + fmt(h) + ' − ' + fmt(asV) + ' = <b>' + fmt(h0) + ' mm</b>；' +
                    'f<sub>c</sub> = ' + fc + ' N/mm²，f<sub>t</sub> = ' + ft + ' N/mm²，α<sub>1</sub> = ' + a1 + '，β<sub>1</sub> = ' + b1 + '；' +
                    'f<sub>y</sub> = f<sub>y</sub>′ = ' + fy + ' / ' + fyp + ' N/mm²，E<sub>s</sub> = ' + es + ' N/mm²，ε<sub>cu</sub> = ' + ecu + '。</div>');
                st.push('<div class="step"><b>② 界限相对受压区高度</b>　ξ<sub>b</sub> = β<sub>1</sub> / (1 + f<sub>y</sub>/(E<sub>s</sub>ε<sub>cu</sub>)) = ' +
                    b1 + ' / (1 + ' + fy + '/(' + es + '×' + ecu + ')) = <b>' + fmt(xi_b, 4) + '</b>（相应 HRB400/HRB500 适筋上限）</div>');

                st.push('<div class="step"><b>③ 单筋截面最大受弯承载力</b>　α<sub>1</sub>f<sub>c</sub>b·x<sub>b</sub>(h<sub>0</sub> − x<sub>b</sub>/2) = ' +
                    '1.0×' + fc + '×' + b + '×' + fmt(xb, 1) + '×(' + fmt(h0) + ' − ' + fmt(xb / 2, 1) + ')/10⁶ = <b>' + fmt(Mu_single_max, 2) + ' kN·m</b>；' +
                    '设计弯矩 M = ' + fmt(M, 2) + ' kN·m ⇒ ' + (M <= Mu_single_max ? '可按单筋设计' + tag('ok', '单筋') : '超过单筋界限，需按双筋设计' + tag('warn', '双筋')) + '</div>');

                if (!isDouble) {
                    st.push('<div class="step"><b>④ 受压区高度（单筋）</b>　由 α<sub>1</sub>f<sub>c</sub>bx(h<sub>0</sub> − x/2) = M 解得<br>' +
                        'x = h<sub>0</sub> − √(h<sub>0</sub>² − 2M/(α<sub>1</sub>f<sub>c</sub>b)) = ' + fmt(h0) + ' − √(' + fmt(h0 * h0, 0) + ' − 2×' +
                        fmt(M_Nmm, 0) + '/(' + a1 + '×' + fc + '×' + b + ')) = <b>' + fmt(x, 1) + ' mm</b></div>');
                    st.push('<div class="step"><b>⑤ 所需受拉钢筋面积</b>　A<sub>s</sub> = α<sub>1</sub>f<sub>c</sub>bx / f<sub>y</sub> = ' +
                        a1 + '×' + fc + '×' + b + '×' + fmt(x, 1) + ' / ' + fy + ' = <b>' + fmt(AsCalc, 0) + ' mm²</b></div>');
                } else {
                    st.push('<div class="step"><b>④ 按双筋设计（取 x = ξ<sub>b</sub>h<sub>0</sub>）</b>　' +
                        'x = ' + fmt(xi_b, 4) + '×' + fmt(h0) + ' = <b>' + fmt(xb, 1) + ' mm</b><br>' +
                        '混凝土承担部分：M<sub>1</sub> = α<sub>1</sub>f<sub>c</sub>bx(h<sub>0</sub> − x/2) = ' + fmt(R.M1 / 1e6, 2) + ' kN·m<br>' +
                        '受压钢筋承担部分：M<sub>2</sub> = M − M<sub>1</sub> = ' + fmt(M, 2) + ' − ' + fmt(R.M1 / 1e6, 2) + ' = <b>' + fmt(R.M2 / 1e6, 2) + ' kN·m</b>' + tag('warn', '双筋') + '</div>');
                    st.push('<div class="step"><b>⑤ 受压钢筋面积</b>　A<sub>s</sub>′ = M<sub>2</sub> / [f<sub>y</sub>′(h<sub>0</sub> − a<sub>s</sub>′)] = ' +
                        fmt(R.M2, 0) + ' / [' + fyp + '×(' + fmt(h0) + ' − ' + fmt(as2V) + ')] = <b>' + fmt(AsP, 0) + ' mm²</b></div>');
                    st.push('<div class="step"><b>⑥ 受拉钢筋面积</b>　A<sub>s</sub> = α<sub>1</sub>f<sub>c</sub>bx/f<sub>y</sub> + f<sub>y</sub>′A<sub>s</sub>′/f<sub>y</sub> = ' +
                        fmt(a1 * fc * b * xb / fy, 0) + ' + ' + fmt(fyp * AsP / fy, 0) + ' = <b>' + fmt(AsCalc, 0) + ' mm²</b></div>');
                }

                if (byMin) {
                    note = '计算所需 A<sub>s</sub> = ' + fmt(AsCalc, 0) + ' mm² 小于最小配筋量 ' + fmt(AsMin, 0) + ' mm²，按构造配筋取 A<sub>s</sub> = ' + fmt(AsMin, 0) + ' mm²。';
                }
                st.push('<div class="step"><b>' + (isDouble ? '⑦' : '⑥') + ' 最小配筋率验算（GB 55008-2021 第 4.4.6 条，按全截面 b·h）</b>　' +
                    'ρ<sub>min</sub> = max(0.2%, 0.45f<sub>t</sub>/f<sub>y</sub>) = max(0.20%, ' + fmt(0.45 * ft / fy * 100, 3) + '%) = <b>' + fmt(rho_min * 100, 3) + '%</b>；' +
                    'A<sub>s,min</sub> = ' + fmt(rho_min, 5) + '×' + b + '×' + h + ' = <b>' + fmt(AsMin, 0) + ' mm²</b> ⇒ ' +
                    (byMin ? '按构造控制' + tag('warn', '构造配筋') : '计算配筋控制' + tag('ok', '计算配筋')) + '</div>');
                st.push('<div class="step"><b>' + (isDouble ? '⑧' : '⑦') + ' 配筋率与破坏形态</b>　' +
                    'ρ = A<sub>s</sub>/(b·h<sub>0</sub>) = ' + fmt(As, 0) + '/(' + b + '×' + fmt(h0) + ') = <b>' + fmt(As / (b * h0) * 100, 3) + '%</b>；' +
                    'ξ = x/h<sub>0</sub> = ' + fmt(xi, 4) + ' ≤ ξ<sub>b</sub> = ' + fmt(xi_b, 4) + '，' + tag('ok', '适筋') + '</div>');

                var picks = pickRebar(As, { dias: [14, 16, 18, 20, 22, 25, 28, 32], maxN: b >= 250 ? 6 : 4 });
                var picksP = isDouble ? pickRebar(AsP, { dias: [12, 14, 16, 18, 20, 22, 25], maxN: 4 }) : [];
                var byDia = pickRebarByDia(As, { dias: [16, 18, 20, 22, 25], maxN: 6 });

                out.innerHTML =
                    resultRow('截面有效高度 h<sub>0</sub>', fmt(h0, 0) + ' mm') +
                    resultRow('界限相对受压区高度 ξ<sub>b</sub>', fmt(xi_b, 4)) +
                    resultRow('单筋界限受弯承载力', fmt(Mu_single_max, 2) + ' kN·m') +
                    resultRow('设计弯矩 M', fmt(M, 2) + ' kN·m') +
                    resultRow('设计方式', isDouble ? badge('badge-warn', '双筋截面') : badge('badge-ok', '单筋截面')) +
                    resultRow('受压区高度 x', fmt(x, 1) + ' mm（ξ = ' + fmt(xi, 4) + '）') +
                    resultRow('所需受拉钢筋 A<sub>s</sub>', '<b>' + fmt(As, 0) + ' mm²</b>' + (byMin ? '（构造控制）' : '')) +
                    (isDouble ? resultRow('所需受压钢筋 A<sub>s</sub>′', '<b>' + fmt(AsP, 0) + ' mm²</b>') : '') +
                    resultRow('最小配筋量 A<sub>s,min</sub>', fmt(AsMin, 0) + ' mm²（ρ<sub>min</sub> = ' + fmt(rho_min * 100, 3) + '%）') +
                    resultRow('实配配筋率 ρ', fmt(As / (b * h0) * 100, 3) + '%') +
                    resultRow('推荐受拉配筋', rebarText(picks, 4)) +
                    (isDouble ? resultRow('推荐受压配筋', rebarText(picksP, 3)) : '') +
                    (note ? '<div class="error-box" style="background:var(--warn-bg);color:var(--warn);border-color:#f0d59a">' + note + '</div>' : '') +
                    rebarTable(picks, '受拉钢筋可选组合（按超配面积由小到大，最多 8 组）') +
                    (isDouble ? rebarTable(picksP, '受压钢筋可选组合（最多 8 组）') : '') +
                    rebarTable(byDia, '按直径的最小根数（用于权衡「小直径多根 / 大直径少根」）');

                document.getElementById('bd_svg').innerHTML =
                    svgPreview(b, h, asV, picks.length ? picks[0].n : 2, isDouble && picksP.length ? picksP[0].n : 0);

                st.push('<div class="step"><b>⑨ 选筋建议</b>　推荐受拉钢筋：' + rebarText(picks, 6) + '；' +
                    '布置时注意钢筋净距不小于 max(25 mm, d) 且不少于一排时的最少根数要求，双排时应复核 a<sub>s</sub> 取值与计算假定一致。</div>');
                st.push('<div class="step"><b>⑩ 后续验算提示</b>　本模块仅完成正截面受弯配筋设计；配套还应完成：斜截面受剪（箍筋）、' +
                    '裂缝宽度（GB 50010 第 7.1 章）、挠度（第 7.2 章）以及抗震工况下的承载力调整。可在左侧「构件验算」分组中逐项复核。</div>');

                proc.innerHTML = st.join('');
                var wrap = proc.closest ? proc.closest('.proc-wrap') : null;
                if (wrap) wrap.classList.add('open');

                window._BD_RESULT = {
                    b: b, h: h, h0: h0, M: M, x: x, xi: xi, xi_b: xi_b, As: As, AsP: AsP,
                    isDouble: isDouble, byMin: byMin, picks: picks, picksP: picksP
                };
            }
        }
    };
    window.TOOLS = window.TOOLS || {};
    window.TOOLS['beam-rect-design'] = tool;
    console.log('[Tool] beam-rect-design registered.');
})();
