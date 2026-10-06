/* rebar-area 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var BAR_D = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40];
    var BAR_AREA = BAR_D.map(function (d) { return Math.PI * d * d / 4; });
    var tool = {
        title: '钢筋面积速查',
        sub: '直径 × 根数 / 间距换算与常用配筋速查',
        meta: {"standard": "—", "formulaSource": "—", "limitations": "钢筋截面积计算与查表，As=πd²/4", "unit": "As:mm², d:mm, s:mm", "version": "1.0.0"},
        render: function () {
            var html = '<div class="panel"><div class="panel-title">面积换算</div><form id="f-ra"><div class="grid2">' +
                numField('ra_d', '钢筋直径 d', 'mm', 20) +
                numField('ra_n', '根数 n', '根', 4) +
                '</div><div class="btn-group"><button type="button" class="btn btn-primary" id="ra_calc">计算面积</button></div></form></div>';
            html += '<div class="panel"><div class="panel-title">按配筋间距换算（每米板宽）</div>' +
                '<p class="hint" style="margin-bottom:10px;">输入配筋形式（如 C8@200 表示直径 8、间距 200mm），换算每延米板宽钢筋截面积：A<sub>s</sub> = πd²/4 ÷ s × 1000（mm²/m）。板类分布筋、受力筋常用。</p>' +
                '<form id="f-rs"><div class="grid2">' +
                selField('rs_d', '钢筋直径 d', opts([
                    { v: 6, t: 'C6' }, { v: 8, t: 'C8' }, { v: 10, t: 'C10' }, { v: 12, t: 'C12' },
                    { v: 14, t: 'C14' }, { v: 16, t: 'C16' }, { v: 18, t: 'C18' }, { v: 20, t: 'C20' }
                ], '8')) +
                numField('rs_s', '钢筋间距 s', 'mm', 200, '常用：100 / 125 / 150 / 175 / 200 / 250 / 300') +
                '</div><div class="btn-group"><button type="button" class="btn btn-primary" id="rs_calc">计算每延米面积</button></div></form>' +
                '<div id="rs_out" style="margin-top:12px;"></div>' +
                '<div style="margin-top:16px;font-weight:600;color:#334155;">常用间距配筋速查表（每延米 A<sub>s</sub>，mm²/m）</div>' +
                '<div class="table-wrap"><table class="mini" id="rs_table"></table></div></div>';
            html += '<div class="panel"><div class="panel-title">配筋组合推荐</div><form id="f-rr"><div class="grid2">' +
                numField('rr_req', '所需钢筋面积 A<sub>s,req</sub>', 'mm²', 1500) +
                '</div><div class="btn-group"><button type="button" class="btn btn-primary" id="rr_calc">推荐组合</button></div></form>' +
                '<div id="rr_result" style="margin-top:6px;"></div></div>';
            html += '<div class="panel"><div class="panel-title">常用钢筋截面积表（mm²）</div>' +
                '<div class="table-wrap"><table class="mini" id="ra_table"></table></div></div>';
            return html;
        },
        bind: function () {
            function renderTable() {
                var t = '<tr><th>直径\\根数</th>';
                for (var n = 1; n <= 8; n++) t += '<th>' + n + '</th>';
                t += '</tr>';
                BAR_D.forEach(function (d, i) {
                    t += '<tr><th>φ' + d + '</th>';
                    for (var n = 1; n <= 8; n++) t += '<td>' + fmt(BAR_AREA[i] * n, 0) + '</td>';
                    t += '</tr>';
                });
                document.getElementById('ra_table').innerHTML = t;
            }
            function calcArea() {
                var d = parseFloat(document.getElementById('ra_d').value);
                var n = parseFloat(document.getElementById('ra_n').value);
                var out = document.getElementById('ra_area_out');
                if (!out) {
                    out = document.createElement('div');
                    out.id = 'ra_area_out';
                    out.innerHTML = '';
                    document.getElementById('f-ra').parentElement.appendChild(out);
                }
                if (!(d > 0 && n > 0 && Number.isInteger(n))) { out.innerHTML = '<div class="error-box">直径必须为正数，根数必须为正整数。</div>'; return; }
                var a = Math.PI * d * d / 4 * n;
                out.innerHTML = '<div class="result-area show" style="margin-top:12px;">' +
                    resultRow('单根面积（φ' + d + '）', fmt(Math.PI*d*d/4, 1) + ' mm²') +
                    resultRow('总截面积 A<sub>s</sub>（' + n + 'φ' + d + '）', '<span class="highlight">' + fmt(a, 1) + ' mm²</span>') + '</div>';
            }
            function recCombos() {
                var req = parseFloat(document.getElementById('rr_req').value);
                var out = document.getElementById('rr_result');
                if (!(req > 0)) { out.innerHTML = '<div class="error-box">请输入所需面积。</div>'; return; }
                var combos = [];
                for (var di = 0; di < BAR_D.length; di++) {
                    var d = BAR_D[di], a1 = BAR_AREA[di];
                    for (var n = 2; n <= 10; n++) {
                        var area = a1 * n;
                        if (area >= req) combos.push({ d: d, n: n, area: area });
                    }
                }
                combos.sort(function (x, y) { return (x.n - y.n) || (x.area - y.area); });
                combos = combos.slice(0, 6);
                if (!combos.length) { out.innerHTML = '<div class="error-box">所需面积过大，未找到推荐组合，请考虑增大直径或分排布置。</div>'; return; }
                var h = '<div class="result-area show">';
                h += resultRow('所需面积', fmt(req,0) + ' mm²');
                combos.forEach(function (c) {
                    h += resultRow(c.n + 'φ' + c.d, fmt(c.area,0) + ' mm²（富余 ' + fmt((c.area-req)/req*100,0) + '%）');
                });
                h += '</div>';
                out.innerHTML = h;
            }
            document.getElementById('ra_calc').addEventListener('click', calcArea);
            document.getElementById('rr_calc').addEventListener('click', recCombos);
            document.getElementById('f-ra').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calcArea(); } });
            document.getElementById('f-rr').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); recCombos(); } });
            /* 按配筋间距换算（每米板宽） */
            function renderSpacingTable() {
                var ds = [6, 8, 10, 12, 14, 16, 18, 20];
                var ss = [100, 125, 150, 175, 200, 250, 300];
                var t = '<tr><th>直径\\间距</th>';
                ss.forEach(function (s) { t += '<th>@' + s + '</th>'; });
                t += '</tr>';
                ds.forEach(function (d) {
                    t += '<tr><th>C' + d + '</th>';
                    ss.forEach(function (s) { t += '<td>' + fmt(Math.PI * d * d / 4 * 1000 / s, 1) + '</td>'; });
                    t += '</tr>';
                });
                var el = document.getElementById('rs_table');
                if (el) el.innerHTML = t;
            }
            function calcSpacing() {
                var d = parseFloat(document.getElementById('rs_d').value);
                var s = parseFloat(document.getElementById('rs_s').value);
                var out = document.getElementById('rs_out');
                if (!(d > 0 && s > 0)) { out.innerHTML = '<div class="error-box">请输入有效直径与间距。</div>'; return; }
                var a1 = Math.PI * d * d / 4;
                var nPerM = 1000 / s;
                var As = a1 * nPerM;
                out.innerHTML = '<div class="result-area show">' +
                    resultRow('单根面积（C' + d + '）', fmt(a1, 1) + ' mm²') +
                    resultRow('每延米根数（@' + s + '）', fmt(nPerM, 2) + ' 根/m') +
                    resultRow('每延米钢筋面积 A<sub>s</sub>', '<span class="highlight">' + fmt(As, 1) + ' mm²/m</span>') +
                    resultRow('换算说明', 'C' + d + '@' + s + ' = ' + fmt(a1, 1) + ' ÷ ' + s + ' × 1000') + '</div>';
                var rows = document.querySelectorAll('#rs_table tr');
                for (var i = 0; i < rows.length; i++) {
                    var th = rows[i].querySelector('th');
                    var isHl = th && th.textContent === 'C' + d;
                    if (isHl) rows[i].classList.add('hl'); else rows[i].classList.remove('hl');
                }
            }
            document.getElementById('rs_calc').addEventListener('click', calcSpacing);
            document.getElementById('f-rs').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calcSpacing(); } });
            renderTable(); calcArea(); recCombos(); renderSpacingTable(); calcSpacing();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['rebar-area'] = tool;
})();
