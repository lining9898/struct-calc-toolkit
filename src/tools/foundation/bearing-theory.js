(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 建筑地基基础设计规范",
            formulaSource: "5.2.5",
            limitations: "按土的抗剪强度指标确定地基承载力特征值",
            unit: "fa:kPa, c:kPa, φ:°",
            version: "1.0.0"
        },
        title: '地基承载力理论公式法',
        sub: '抗剪强度指标 · 承载力系数Mb/Md/Mc · 偏心距控制 · GB 50007-2011 §5.2.5',
        render: function () {
            return '<div class="panel"><div class="panel-title">土的抗剪强度指标</div>' +
                '<form id="f-bt"><div class="grid2">' +
                numField('bt_ck', '黏聚力标准值 c<sub>k</sub>', 'kPa', 20, '基底下一倍短边宽度深度范围内') +
                numField('bt_phik', '内摩擦角标准值 φ<sub>k</sub>', '°', 22, '基底下一倍短边宽度深度范围内') +
                '</div><div class="panel-title" style="margin-top:14px;">基础参数</div><div class="grid2">' +
                numField('bt_b', '基础底面宽度 b', 'm', 2.5, '大于6m取6m，砂土小于3m取3m') +
                numField('bt_d', '基础埋置深度 d', 'm', 1.5) +
                numField('bt_gamma', '基底以下土重度 γ', 'kN/m³', 18.5, '地下水位以下取浮重度') +
                numField('bt_gammaM', '基底以上土加权平均重度 γ<sub>m</sub>', 'kN/m³', 19.0) +
                '</div><div class="panel-title" style="margin-top:14px;">荷载参数</div><div class="grid2">' +
                numField('bt_Fk', '上部结构轴力 F<sub>k</sub>', 'kN', 800) +
                numField('bt_Mk', '基础底面弯矩 M<sub>k</sub>', 'kN·m', 100) +
                numField('bt_l', '基础底面长度 l', 'm', 3.0, '用于计算偏心距') +
                '</div><div class="hint">说明：依据 GB 50007-2011 §5.2.5，当偏心距 e ≤ 0.033b时，可根据土的抗剪强度指标确定地基承载力特征值：f<sub>a</sub> = M<sub>b</sub>γb + M<sub>d</sub>γ<sub>m</sub>d + M<sub>c</sub>c<sub>k</sub>。承载力系数M<sub>b</sub>、M<sub>d</sub>、M<sub>c</sub>按φ<sub>k</sub>查表5.2.5。此法应同时满足变形要求。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="bt_calc">计算承载力</button>' +
                '<button type="button" class="btn btn-secondary" id="bt_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="bt_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="bt_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('bt_result');
                var proc = document.getElementById('bt_proc');
                var ck = parseFloat(document.getElementById('bt_ck').value);
                var phik = parseFloat(document.getElementById('bt_phik').value);
                var b = parseFloat(document.getElementById('bt_b').value);
                var d = parseFloat(document.getElementById('bt_d').value);
                var gamma = parseFloat(document.getElementById('bt_gamma').value);
                var gammaM = parseFloat(document.getElementById('bt_gammaM').value);
                var Fk = parseFloat(document.getElementById('bt_Fk').value);
                var Mk = parseFloat(document.getElementById('bt_Mk').value);
                var l = parseFloat(document.getElementById('bt_l').value);
                var st = [];

                // ① 偏心距验算
                var e = Mk / (Fk + 20 * b * l * d);
                var elim = 0.033 * b;
                var eOk = e <= elim;
                st.push('<div class="step"><b>① 偏心距验算（§5.2.5适用条件）</b></div>');
                st.push('<div class="step">　　偏心距 e = M<sub>k</sub> / (F<sub>k</sub>+G<sub>k</sub>) = ' + Mk + ' / (' + Fk + '+' + fmt(20*b*l*d,0) + ') = <b>' + fmt(e,4) + ' m</b></div>');
                st.push('<div class="step">　　限值 e ≤ 0.033b = 0.033×' + b + ' = <b>' + fmt(elim,4) + ' m</b></div>');
                st.push('<div class="step">　　' + (eOk ? '✓ 满足适用条件' : '✗ 不满足，应使用其他方法') + tag(eOk?'ok':'err', eOk?'满足':'不满足') + '</div>');

                // ② 承载力系数（表5.2.5 查表+插值）
                // 表5.2.5关键数据点：φk: 0,2,4,...,40
                var phiTable = [
                    {phi:0,  Mb:0,    Md:1.00, Mc:3.14},
                    {phi:2,  Mb:0.03, Md:1.12, Mc:3.32},
                    {phi:4,  Mb:0.06, Md:1.25, Mc:3.51},
                    {phi:6,  Mb:0.10, Md:1.39, Mc:3.71},
                    {phi:8,  Mb:0.14, Md:1.55, Mc:3.93},
                    {phi:10, Mb:0.18, Md:1.73, Mc:4.17},
                    {phi:12, Mb:0.23, Md:1.94, Mc:4.42},
                    {phi:14, Mb:0.29, Md:2.17, Mc:4.69},
                    {phi:16, Mb:0.36, Md:2.43, Mc:4.99},
                    {phi:18, Mb:0.43, Md:2.72, Mc:5.31},
                    {phi:20, Mb:0.51, Md:3.06, Mc:5.66},
                    {phi:22, Mb:0.61, Md:3.44, Mc:6.04},
                    {phi:24, Mb:0.72, Md:3.87, Mc:6.45},
                    {phi:26, Mb:0.84, Md:4.37, Mc:6.90},
                    {phi:28, Mb:0.98, Md:4.93, Mc:7.40},
                    {phi:30, Mb:1.14, Md:5.59, Mc:7.95},
                    {phi:32, Mb:1.34, Md:6.35, Mc:8.55},
                    {phi:34, Mb:1.56, Md:7.21, Mc:9.22},
                    {phi:36, Mb:1.81, Md:8.25, Mc:9.97},
                    {phi:38, Mb:2.11, Md:9.44, Mc:10.80},
                    {phi:40, Mb:2.46, Md:10.84,Mc:11.73}
                ];
                // 插值
                var Mb, Md, Mc;
                if (phik <= 0) { Mb = 0; Md = 1.0; Mc = 3.14; }
                else if (phik >= 40) { Mb = 2.46; Md = 10.84; Mc = 11.73; }
                else {
                    var i = 0;
                    while (i < phiTable.length - 1 && phiTable[i + 1].phi < phik) i++;
                    var p1 = phiTable[i], p2 = phiTable[i + 1];
                    var t = (phik - p1.phi) / (p2.phi - p1.phi);
                    Mb = p1.Mb + t * (p2.Mb - p1.Mb);
                    Md = p1.Md + t * (p2.Md - p1.Md);
                    Mc = p1.Mc + t * (p2.Mc - p1.Mc);
                }

                st.push('<div class="step"><b>② 承载力系数 M<sub>b</sub>、M<sub>d</sub>、M<sub>c</sub>（表5.2.5，φ<sub>k</sub>=' + phik + '°）</b></div>');
                st.push('<div class="step">　　M<sub>b</sub> = <b>' + fmt(Mb,2) + '</b>；M<sub>d</sub> = <b>' + fmt(Md,2) + '</b>；M<sub>c</sub> = <b>' + fmt(Mc,2) + '</b></div>');

                // ③ 基础宽度修正
                var bEff = b;
                if (bEff > 6) bEff = 6;
                if (bEff < 3 && phik < 5) bEff = 3; // 砂土<3m取3m（简化）
                st.push('<div class="step">　　基础宽度 b = ' + b + ' m' + (b > 6 ? '（>6m取6m）' : '') + ' → 计算宽度 = ' + fmt(bEff,1) + ' m</div>');

                // ④ 地基承载力特征值（式5.2.5）
                var fa = Mb * gamma * bEff + Md * gammaM * d + Mc * ck;
                st.push('<div class="step"><b>③ 地基承载力特征值 f<sub>a</sub>（式5.2.5）</b></div>');
                st.push('<div class="step">　　f<sub>a</sub> = M<sub>b</sub>·γ·b + M<sub>d</sub>·γ<sub>m</sub>·d + M<sub>c</sub>·c<sub>k</sub></div>');
                st.push('<div class="step">　　= ' + fmt(Mb,2) + '×' + gamma + '×' + fmt(bEff,1) + ' + ' + fmt(Md,2) + '×' + gammaM + '×' + d + ' + ' + fmt(Mc,2) + '×' + ck + '</div>');
                st.push('<div class="step">　　= ' + fmt(Mb*gamma*bEff,1) + ' + ' + fmt(Md*gammaM*d,1) + ' + ' + fmt(Mc*ck,1) + '</div>');
                st.push('<div class="step">　　<b>f<sub>a</sub> = ' + fmt(fa,1) + ' kPa</b></div>');
                st.push('<div class="step">　　注：按§5.2.5条，尚应满足变形要求。</div>');

                // ⑤ 基底压力验算
                var A = b * l;
                var Gk = 20 * A * d;
                var pk = (Fk + Gk) / A;
                var pkOk = pk <= fa;
                st.push('<div class="step"><b>④ 基底压力验算</b></div>');
                st.push('<div class="step">　　A = b×l = ' + b + '×' + l + ' = ' + fmt(A,2) + ' m²</div>');
                st.push('<div class="step">　　G<sub>k</sub> = 20×A×d = ' + fmt(Gk,0) + ' kN</div>');
                st.push('<div class="step">　　p<sub>k</sub> = (F<sub>k</sub>+G<sub>k</sub>)/A = ' + fmt(pk,1) + ' kPa ' + (pkOk?'≤':'>') + ' f<sub>a</sub>=' + fmt(fa,1) + ' kPa ' + tag(pkOk?'ok':'err', pkOk?'满足':'不满足') + '</div>');

                var html = resultRow('偏心距 e', fmt(e,4) + ' m（限值 ' + fmt(elim,4) + ' m）');
                html += resultRow('偏心距判定', badge(eOk?'badge-ok':'badge-err', eOk?'满足e≤0.033b' : '不满足'));
                html += resultRow('M<sub>b</sub> / M<sub>d</sub> / M<sub>c</sub>', fmt(Mb,2) + ' / ' + fmt(Md,2) + ' / ' + fmt(Mc,2));
                html += resultRow('承载力特征值 f<sub>a</sub>', '<b>' + fmt(fa,1) + ' kPa</b>');
                html += resultRow('基底压力 p<sub>k</sub>', fmt(pk,1) + ' kPa');
                html += resultRow('压力验算', badge(pkOk?'badge-ok':'badge-err', pkOk?'满足' : '不满足'));
                html += resultRow('说明', badge('badge-ok', '按GB 50007 §5.2.5计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('bt_ck').value = 20;
                document.getElementById('bt_phik').value = 22;
                document.getElementById('bt_b').value = 2.5;
                document.getElementById('bt_d').value = 1.5;
                document.getElementById('bt_gamma').value = 18.5;
                document.getElementById('bt_gammaM').value = 19.0;
                document.getElementById('bt_Fk').value = 800;
                document.getElementById('bt_Mk').value = 100;
                document.getElementById('bt_l').value = 3.0;
                calc();
            }
            document.getElementById('bt_calc').addEventListener('click', calc);
            document.getElementById('bt_reset').addEventListener('click', reset);
            document.getElementById('f-bt').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['bearing-theory'] = tool;
})();
