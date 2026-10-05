/* L22ZG401 预应力混凝土钢管桁架叠合板 工具页面
 * 三大模块：底板选用查询 / 荷载等级计算 / 施工阶段验算
 */
(function () {
    var tool = {
        title: '预应力混凝土钢管桁架叠合板',
        sub: 'L22ZG401 · 山东省建筑标准设计图集 · 底板选用 · 荷载等级 · 施工阶段验算',
        meta: {
            standard: 'L22ZG401 预应力混凝土钢管桁架叠合板（鲁2022）',
            formulaSource: '山东省建筑标准设计图集',
            limitations: '叠合板底板选用、荷载等级计算、施工阶段验算',
            unit: '跨度:mm, 荷载:kN/m², M:kN·m/m',
            version: '1.0.0'
        },
        render: function () {
            var spanOpts = [];
            for (var s = 2100; s <= 9600; s += 300) {
                spanOpts.push({ v: s, t: s + ' mm（' + (s/1000).toFixed(1) + 'm）' });
            }
            var widthOpts = [
                { v: 1000, t: '1000 mm（标准宽）' },
                { v: 1700, t: '1700 mm（标准宽）' },
                { v: 2100, t: '2100 mm（标准宽）' },
                { v: 900, t: '900 mm（非标，按1000mm宽折算）' },
                { v: 1100, t: '1100 mm（非标，按1000mm宽折算）' },
                { v: 1200, t: '1200 mm（非标，按1000mm宽折算）' }
            ];
            var qOpts = [
                { v: 6, t: '6 kN/m²（6级）' },
                { v: 7, t: '7 kN/m²（7级）' },
                { v: 8, t: '8 kN/m²（8级）' },
                { v: 9, t: '9 kN/m²（9级）' },
                { v: 10, t: '10 kN/m²（10级）' }
            ];
            var safeOpts = [
                { v: 1.0, t: '二级（γ₀ = 1.0）' },
                { v: 1.1, t: '一级（γ₀ = 1.1）' }
            ];

            return (
                // 模块一：底板选用查询
                '<div class="panel"><div class="panel-title">一、底板选用查询</div>' +
                '<form id="f-l22-select"><div class="grid2">' +
                selField('l22_span', '标志跨度 L', opts(spanOpts, 3600), '2100 ~ 9600mm，每300mm一级；非标准跨度自动向上取整') +
                selField('l22_width', '底板标准宽度', opts(widthOpts, 1000), '标准宽度 1000/1700/2100mm；900/1100/1200mm 按1000mm宽折算') +
                selField('l22_qlevel', '允许附加荷载设计值 q', opts(qOpts, 6), '按图集选用表 q6~q10 五级；不含底板自重与叠合层自重') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="l22_sel_calc">查询底板型号</button>' +
                '<button type="button" class="btn btn-secondary" id="l22_sel_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">选用结果</div><div id="l22_sel_result"></div></div>' +

                // 模块二：荷载等级计算
                '<div class="panel"><div class="panel-title">二、荷载等级计算（选用步骤）</div>' +
                '<form id="f-l22-load"><div class="grid2">' +
                numField('l22_gk', '附加永久荷载标准值 g<sub>k</sub>', 'kN/m²', 2.0, '面层、吊顶、隔墙等自重，不含底板自重与叠合层自重') +
                numField('l22_qk', '可变荷载标准值 q<sub>k</sub>', 'kN/m²', 2.0, '使用阶段活荷载标准值') +
                selField('l22_gamma0', '结构安全等级', opts(safeOpts, 1.0), '一级 γ₀=1.1，二级 γ₀=1.0') +
                numField('l22_gammaG', '永久荷载分项系数 γ<sub>G</sub>', '—', 1.3, 'GB 50009 基本组合') +
                numField('l22_gammaQ', '可变荷载分项系数 γ<sub>Q</sub>', '—', 1.5, '工业房屋楼面 qk>4kN/m² 时可取 1.4') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="l22_load_calc">计算并选等级</button>' +
                '<button type="button" class="btn btn-secondary" id="l22_load_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">荷载等级结果</div><div id="l22_load_result"></div></div>' +

                // 模块三：施工阶段验算
                '<div class="panel"><div class="panel-title">三、施工阶段验算（按图集编制说明七）</div>' +
                '<form id="f-l22-stage"><div class="grid2">' +
                numField('l22_st_span', '底板标志跨度', 'mm', 3600, '用于查底板厚度、自重、混凝土等级') +
                numField('l22_st_width', '底板宽度 B', 'mm', 1000, '底板计算宽度') +
                numField('l22_st_hc', '叠合层厚度 h<sub>c</sub>', 'mm', 75, '后浇叠合层厚度，查选用表取值') +
                numField('l22_st_L2', '施工阶段支撑间距 L<sub>2</sub>', 'm', 3.0, '叠合板施工阶段支撑间最大间距') +
                numField('l22_st_qQ1', '施工活荷载标准值 q<sub>Q1</sub>', 'kN/m²', 1.5, '施工人员及设备均布活荷载') +
                numField('l22_st_gammaG', '永久荷载分项系数 γ<sub>G</sub>', '—', 1.3) +
                numField('l22_st_gammaQ', '可变荷载分项系数 γ<sub>Q</sub>', '—', 1.5) +
                selField('l22_st_stage', '验算阶段', opts([
                    {v:'st1',t:'第一阶段：底板制作（脱模/运输/堆放）'},
                    {v:'st2',t:'第二阶段：叠合板施工阶段（叠合层+施工荷载）'}
                ], 'st2')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="l22_st_calc">验算</button>' +
                '<button type="button" class="btn btn-secondary" id="l22_st_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">施工阶段验算结果</div><div id="l22_st_result"></div></div>' +

                // 计算过程
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="l22_proc"></div></div></div></div>'
            );
        },
        bind: function () {
            var D = window.L22ZG401;

            // ---------- 模块一：底板选用 ----------
            function calcSelect() {
                var out = document.getElementById('l22_sel_result');
                var proc = document.getElementById('l22_proc');
                var span = parseInt(document.getElementById('l22_span').value);
                var width = parseInt(document.getElementById('l22_width').value);
                var qLevelInput = parseInt(document.getElementById('l22_qlevel').value); // 6/7/8/9/10
                var qIdx = qLevelInput - 6; // 0~4

                var st = [];
                st.push('<div class="step"><b>一、底板选用查询</b>（依据 L22ZG401 选用表）</div>');
                st.push('<div class="step">标志跨度：' + span + ' mm</div>');
                st.push('<div class="step">底板宽度：' + width + ' mm</div>');
                st.push('<div class="step">允许附加荷载设计值：' + qLevelInput + ' kN/m²（' + qLevelLabel(qIdx) + '级）</div>');

                // 判断是否标准宽度
                var isStdWidth = (width === 1000 || width === 1700 || width === 2100);
                var baseWidth = isStdWidth ? width : 1000; // 非标准宽以 1000mm 宽底板为基准折算
                var table = D.TABLES[baseWidth];
                if (!table) {
                    out.innerHTML = '<div class="warn-box">宽度 ' + width + 'mm 无对应选用表数据。</div>';
                    proc.innerHTML = st.join('');
                    return;
                }

                var found = D.findRow(table, span);
                if (!found) {
                    out.innerHTML = '<div class="warn-box">标志跨度 ' + span + 'mm 超出图集范围（最大 9600mm）。</div>';
                    proc.innerHTML = st.join('');
                    return;
                }

                var row = found.row;
                var actualSpan = row[0]; // 实际采用的标准跨度
                var snapped = found.snapped;

                var longBarsStd = row[1][qIdx]; // 标准宽纵向筋根数
                var transBars = row[2]; // 横向筋根数
                var hc = row[3]; // 叠合层厚
                var volStd = row[4]; // 标准宽混凝土体积
                var weightStd = row[5]; // 标准宽底板自重

                // 非标准宽度折算纵向筋
                var longBars = longBarsStd;
                var transLen = D.STD_WIDTH_TRANS[baseWidth]; // 横向筋长度
                var vol = volStd;
                var weight = weightStd;
                if (!isStdWidth) {
                    longBars = D.adjustedLongBarCount(longBarsStd, baseWidth, width);
                    // 体积和自重按宽度比例近似
                    vol = +(volStd * width / baseWidth).toFixed(3);
                    weight = Math.round(weightStd * width / baseWidth);
                    transLen = width - 10; // 横向筋长度近似为宽度-10mm
                    st.push('<div class="step">⚠ 非标准宽度 ' + width + 'mm：以 1000mm 宽底板为基准，纵向钢筋根数按宽度比折算并向上取整</div>');
                    st.push('<div class="step">&nbsp;&nbsp;纵向筋根数 n = ⌈' + longBarsStd + ' × ' + width + '/1000⌉ = ' + longBars + ' 根</div>');
                }

                var hb = D.baseThickness(actualSpan);
                var preSpec = D.preBarSpec(actualSpan);
                var preD = D.preBarDiameter(actualSpan);
                var preLen = actualSpan - 30; // 预应力筋长度
                var baseLen = actualSpan - 180; // 底板长度
                var grade = D.concreteGrade(actualSpan);
                var totalH = hb + hc; // 叠合板总厚度

                // 编号
                // 编号规则：GDB + 跨度两位(dm，mm÷100) + 宽度两位(dm，mm÷100) + - + 荷载等级
                // 例：GDB2110-6 → 标志跨度2100mm(21×100)、宽度1000mm(10×100)、q=6kN/m²
                var spanCode = Math.round(actualSpan / 100);
                var widthCode = Math.round(width / 100);
                var modelNo = 'GDB' + pad2(spanCode) + pad2(widthCode) + '-' + qLevelInput;

                st.push('<div class="step"><b>二、查得结果</b>' + (snapped ? '（跨度已向上取整至 ' + actualSpan + 'mm）' : '') + '</div>');
                st.push('<div class="step">底板编号：<b>' + modelNo + '</b></div>');
                st.push('<div class="step">底板长度 = 标志跨度 − 180mm = ' + actualSpan + ' − 180 = <b>' + baseLen + ' mm</b></div>');
                st.push('<div class="step">底板厚度 h<sub>b</sub> = <b>' + hb + ' mm</b>（标志跨度' + (actualSpan < 6600 ? '<6600mm' : '≥6600mm') + '）</div>');
                st.push('<div class="step">叠合层厚度 h<sub>c</sub> = <b>' + hc + ' mm</b></div>');
                st.push('<div class="step">叠合板总厚度 h = h<sub>b</sub> + h<sub>c</sub> = ' + hb + ' + ' + hc + ' = <b>' + totalH + ' mm</b></div>');
                st.push('<div class="step">底板混凝土强度等级：<b>' + grade + '</b>（标志跨度' +
                    (actualSpan <= 5400 ? '≤5.4m → C40' : actualSpan <= 7800 ? '5.4~7.8m → C45' : '>7.8m → C50') + '）</div>');

                st.push('<div class="step"><b>三、配筋</b></div>');
                st.push('<div class="step">① 纵向预应力钢筋：<b>' + preSpec + '</b></div>');
                st.push('<div class="step">&nbsp;&nbsp;规格：Φ' + preD.toFixed(1) + ' &nbsp; 长度：' + actualSpan + ' − 30 = <b>' + preLen + ' mm</b> &nbsp; 根数：<b>' + longBars + ' 根</b></div>');
                st.push('<div class="step">② 横向钢筋（分布筋）：<b>HPB300 Φ5.0</b></div>');
                st.push('<div class="step">&nbsp;&nbsp;长度：<b>' + transLen + ' mm</b> &nbsp; 根数：<b>' + transBars + ' 根</b></div>');

                st.push('<div class="step"><b>四、材料用量</b></div>');
                st.push('<div class="step">底板混凝土体积：<b>' + vol.toFixed(3) + ' m³</b></div>');
                st.push('<div class="step">底板自重：<b>' + weight + ' kg</b></div>');

                // 适用范围提示
                if (totalH === 110 && actualSpan > 3900) {
                    st.push('<div class="step" style="color:var(--danger);">⚠ 叠合板总厚度为 110mm 时标志跨度不宜大于 3.9m（当前 ' + (actualSpan/1000).toFixed(1) + 'm），请复核。</div>');
                }

                // 结果面板
                var html = '';
                html += '<div class="result-big pass">';
                html += '<div class="big-label">底板编号</div>';
                html += '<div class="big-value">' + modelNo + '<span style="font-size:0.45em;font-weight:400;color:var(--ink-mute);margin-left:12px;">总厚 ' + totalH + 'mm · ' + grade + '</span></div>';
                html += '<div class="big-sub">L22ZG401 预应力混凝土钢管桁架叠合板</div>';
                if (snapped) html += '<div style="margin-top:6px;font-size:0.85em;color:var(--lemon);">跨度已向上取整：' + span + ' → ' + actualSpan + 'mm（实际板长可取任意值）</div>';
                html += '</div>';

                html += '<div style="margin-top:16px;"><div style="font-weight:600;margin-bottom:8px;">底板参数</div>';
                html += '<div class="table-wrap"><table class="mini">';
                html += '<tr><th style="width:35%;">项目</th><th>数值</th></tr>';
                html += '<tr><td>底板长度</td><td>' + baseLen + ' mm</td></tr>';
                html += '<tr><td>底板厚度 / 叠合层厚度</td><td>' + hb + ' mm / ' + hc + ' mm</td></tr>';
                html += '<tr><td>叠合板总厚度</td><td>' + totalH + ' mm</td></tr>';
                html += '<tr><td>底板混凝土强度等级</td><td>' + grade + '</td></tr>';
                html += '<tr><td>纵向预应力筋 ①</td><td>' + preSpec + '，' + longBars + ' 根，单根长 ' + preLen + ' mm</td></tr>';
                html += '<tr><td>横向钢筋 ②</td><td>HPB300 Φ5.0，' + transBars + ' 根，单根长 ' + transLen + ' mm</td></tr>';
                html += '<tr><td>底板混凝土体积</td><td>' + vol.toFixed(3) + ' m³</td></tr>';
                html += '<tr><td>底板自重</td><td>' + weight + ' kg</td></tr>';
                html += '</table></div></div>';

                if (totalH === 110 && actualSpan > 3900) {
                    html += '<div class="warn-box" style="margin-top:12px;">叠合板总厚度为 110mm 时，标志跨度不宜大于 3.9m（当前 ' + (actualSpan/1000).toFixed(1) + 'm），建议调整板厚或跨度。</div>';
                }

                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc.closest('.proc-wrap'); if (_p) _p.classList.add('open');

                window._L22_RESULT = {
                    module: 'select',
                    span: span, actualSpan: actualSpan, snapped: snapped,
                    width: width, isStdWidth: isStdWidth, baseWidth: baseWidth,
                    qLevel: qLevelInput, qIdx: qIdx,
                    modelNo: modelNo,
                    baseLen: baseLen, hb: hb, hc: hc, totalH: totalH,
                    concrete: grade,
                    preSpec: preSpec, preD: preD, preLen: preLen, longBars: longBars,
                    transSpec: 'HPB300 Φ5.0', transLen: transLen, transBars: transBars,
                    vol: vol, weight: weight,
                    steps: st.join('')
                };
            }

            document.getElementById('l22_sel_calc').addEventListener('click', calcSelect);
            document.getElementById('l22_sel_reset').addEventListener('click', function () {
                document.getElementById('f-l22-select').reset();
                document.getElementById('l22_sel_result').innerHTML = '';
            });

            // ---------- 模块二：荷载等级 ----------
            function calcLoad() {
                var out = document.getElementById('l22_load_result');
                var proc = document.getElementById('l22_proc');
                var gk = parseFloat(document.getElementById('l22_gk').value);
                var qk = parseFloat(document.getElementById('l22_qk').value);
                var gamma0 = parseFloat(document.getElementById('l22_gamma0').value);
                var gammaG = parseFloat(document.getElementById('l22_gammaG').value);
                var gammaQ = parseFloat(document.getElementById('l22_gammaQ').value);

                var st = [];
                st.push('<div class="step"><b>一、荷载等级计算</b>（依据 L22ZG401 选用步骤）</div>');
                st.push('<div class="step">附加永久荷载标准值 g<sub>k</sub> = ' + fmt(gk,2) + ' kN/m²</div>');
                st.push('<div class="step">可变荷载标准值 q<sub>k</sub> = ' + fmt(qk,2) + ' kN/m²</div>');
                st.push('<div class="step">结构重要性系数 γ<sub>0</sub> = ' + gamma0.toFixed(1) + '</div>');
                st.push('<div class="step">永久荷载分项系数 γ<sub>G</sub> = ' + gammaG.toFixed(2) + '</div>');
                st.push('<div class="step">可变荷载分项系数 γ<sub>Q</sub> = ' + gammaQ.toFixed(2) + '</div>');

                var q = gammaG * gk + gammaQ * qk;
                var qWithGamma0 = gamma0 * q;

                st.push('<div class="step"><b>二、允许附加荷载设计值</b></div>');
                st.push('<div class="step">q = γ<sub>G</sub>g<sub>k</sub> + γ<sub>Q</sub>q<sub>k</sub> = ' + gammaG.toFixed(2) + '×' + fmt(gk,2) + ' + ' + gammaQ.toFixed(2) + '×' + fmt(qk,2) + ' = <b>' + fmt(q,2) + ' kN/m²</b></div>');
                if (gamma0 !== 1.0) {
                    st.push('<div class="step">考虑重要性系数：γ<sub>0</sub>q = ' + gamma0.toFixed(1) + ' × ' + fmt(q,2) + ' = <b>' + fmt(qWithGamma0,2) + ' kN/m²</b></div>');
                }

                var qDesign = gamma0 !== 1.0 ? qWithGamma0 : q;
                var level = D.pickQLevel(qDesign);
                var levelLabel = level >= 0 ? D.qLevelLabel(level) : '';

                st.push('<div class="step"><b>三、等级判定</b></div>');
                if (level < 0) {
                    st.push('<div class="step" style="color:var(--danger);">✗ q = ' + fmt(qDesign,2) + ' kN/m² > 10 kN/m²，超出图集允许附加荷载范围</div>');
                    st.push('<div class="step">建议：加大叠合层厚度、调整板跨布置，或选用更高荷载等级的板型。</div>');
                } else {
                    var lvlNum = level + 6;
                    st.push('<div class="step">✓ q = ' + fmt(qDesign,2) + ' kN/m² ≤ ' + lvlNum + ' kN/m²，选用 <b>' + lvlNum + ' 级</b> 底板（' + levelLabel + '）</div>');
                    st.push('<div class="step">说明：表中允许附加荷载设计值不包括底板自重与叠合层自重。</div>');
                }

                var html = '';
                if (level < 0) {
                    html += '<div class="result-big fail">';
                    html += '<div class="big-label">超出图集范围</div>';
                    html += '<div class="big-value fail-text">q = ' + fmt(qDesign,2) + ' kN/m²</div>';
                    html += '<div class="big-sub">允许附加荷载设计值 > 10 kN/m²，请加大叠合层厚度或调整布置</div>';
                    html += '</div>';
                } else {
                    var lvlNum = level + 6;
                    html += '<div class="result-big pass">';
                    html += '<div class="big-label">推荐荷载等级</div>';
                    html += '<div class="big-value">' + lvlNum + ' 级 <span style="font-size:0.45em;font-weight:400;color:var(--ink-mute);margin-left:12px;">q ≤ ' + lvlNum + ' kN/m²</span></div>';
                    html += '<div class="big-sub">附加荷载设计值 q = ' + fmt(qDesign,2) + ' kN/m²</div>';
                    html += '</div>';

                    html += '<div style="margin-top:16px;"><div style="font-weight:600;margin-bottom:8px;">五级荷载对照表</div>';
                    html += '<div class="table-wrap"><table class="mini">';
                    html += '<tr><th>等级</th><th>q6</th><th>q7</th><th>q8</th><th>q9</th><th>q10</th></tr>';
                    html += '<tr><td>允许附加荷载 (kN/m²)</td>';
                    for (var i = 0; i < 5; i++) {
                        var cls = i === level ? ' style="background:var(--primary-soft);font-weight:600;"' : '';
                        html += '<td' + cls + '>' + (i + 6) + '</td>';
                    }
                    html += '</tr></table></div></div>';
                }

                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc.closest('.proc-wrap'); if (_p) _p.classList.add('open');

                window._L22_RESULT = {
                    module: 'load',
                    gk: gk, qk: qk, gamma0: gamma0, gammaG: gammaG, gammaQ: gammaQ,
                    q: q, qWithGamma0: qWithGamma0, qDesign: qDesign,
                    level: level, levelLabel: levelLabel,
                    outOfRange: level < 0,
                    steps: st.join('')
                };
            }

            document.getElementById('l22_load_calc').addEventListener('click', calcLoad);
            document.getElementById('l22_load_reset').addEventListener('click', function () {
                document.getElementById('f-l22-load').reset();
                document.getElementById('l22_load_result').innerHTML = '';
            });

            // ---------- 模块三：施工阶段验算 ----------
            function calcStage() {
                var out = document.getElementById('l22_st_result');
                var proc = document.getElementById('l22_proc');
                var span = parseFloat(document.getElementById('l22_st_span').value);
                var Bmm = parseFloat(document.getElementById('l22_st_width').value);
                var hc = parseFloat(document.getElementById('l22_st_hc').value);
                var L2 = parseFloat(document.getElementById('l22_st_L2').value);
                var qQ1 = parseFloat(document.getElementById('l22_st_qQ1').value);
                var gammaG = parseFloat(document.getElementById('l22_st_gammaG').value);
                var gammaQ = parseFloat(document.getElementById('l22_st_gammaQ').value);
                var stage = document.getElementById('l22_st_stage').value;

                var st = [];
                var B = Bmm / 1000; // 宽度 m

                var hb = D.baseThickness(span);
                var grade = D.concreteGrade(span);
                // 底板自重 kN/m²
                var gBase = 25 * hb / 1000; // 25kN/m³ × 厚度m
                var gSuper = 25 * hc / 1000; // 叠合层自重

                st.push('<div class="step"><b>施工阶段验算</b>（依据 L22ZG401 编制说明 · 七、设计计算）</div>');
                st.push('<div class="step">底板标志跨度：' + span + ' mm → 底板厚度 h<sub>b</sub> = ' + hb + ' mm（' + grade + '）</div>');
                st.push('<div class="step">底板宽度 B = ' + Bmm + ' mm = ' + fmt(B,3) + ' m</div>');
                st.push('<div class="step">叠合层厚度 h<sub>c</sub> = ' + hc + ' mm</div>');
                st.push('<div class="step">底板自重标准值 g<sub>b</sub> = 25 × ' + (hb/1000) + ' = ' + fmt(gBase,3) + ' kN/m²</div>');
                st.push('<div class="step">叠合层自重标准值 g<sub>c</sub> = 25 × ' + (hc/1000) + ' = ' + fmt(gSuper,3) + ' kN/m²</div>');

                var html = '';

                if (stage === 'st1') {
                    // 第一阶段：底板制作（脱模/运输/堆放）
                    st.push('<div class="step"><b>第一阶段：底板制作阶段</b></div>');
                    // 脱模
                    var qDemold1 = 1.2 * gBase + 1.5; // 1.2×自重 + 吸附力1.5
                    var qDemold2 = 1.5 * gBase; // 不小于1.5×自重
                    var qDemold = Math.max(qDemold1, qDemold2);
                    st.push('<div class="step">脱模验算等效静力荷载标准值：</div>');
                    st.push('<div class="step">&nbsp;&nbsp;q<sub>dem1</sub> = 1.2g<sub>b</sub> + 1.5 = 1.2×' + fmt(gBase,3) + ' + 1.5 = ' + fmt(qDemold1,3) + ' kN/m²</div>');
                    st.push('<div class="step">&nbsp;&nbsp;q<sub>dem2</sub> = 1.5g<sub>b</sub> = 1.5×' + fmt(gBase,3) + ' = ' + fmt(qDemold2,3) + ' kN/m²</div>');
                    st.push('<div class="step">&nbsp;&nbsp;取较大值 q<sub>脱模</sub> = <b>' + fmt(qDemold,3) + ' kN/m²</b></div>');

                    // 运输吊装 动力系数1.5
                    var qTransport = 1.5 * gBase;
                    st.push('<div class="step">运输吊运动力系数 1.5：q<sub>运输</sub> = 1.5 × ' + fmt(gBase,3) + ' = <b>' + fmt(qTransport,3) + ' kN/m²</b></div>');

                    // 堆放安装 动力系数1.2
                    var qStack = 1.2 * gBase;
                    st.push('<div class="step">堆放安装动力系数 1.2：q<sub>堆放</sub> = 1.2 × ' + fmt(gBase,3) + ' = <b>' + fmt(qStack,3) + ' kN/m²</b></div>');

                    // 跨中弯矩（按简支底板，跨度取标志跨度的计算跨度近似）
                    var Lcalc = (span - 180) / 1000; // 底板长度m，按简支取
                    var M_demold = (1/8) * qDemold * B * Lcalc * Lcalc;
                    var M_transport = (1/8) * qTransport * B * Lcalc * Lcalc;
                    var M_stack = (1/8) * qStack * B * Lcalc * Lcalc;

                    st.push('<div class="step"><b>各环节跨中弯矩（按简支、计算跨度≈底板长度 ' + fmt(Lcalc,3) + 'm）</b></div>');
                    st.push('<div class="step">脱模 M = 1/8 × q × B × L² = 1/8 × ' + fmt(qDemold,3) + ' × ' + fmt(B,3) + ' × ' + fmt(Lcalc,3) + '² = <b>' + fmt(M_demold,3) + ' kN·m</b></div>');
                    st.push('<div class="step">运输 M = 1/8 × ' + fmt(qTransport,3) + ' × ' + fmt(B,3) + ' × ' + fmt(Lcalc,3) + '² = <b>' + fmt(M_transport,3) + ' kN·m</b></div>');
                    st.push('<div class="step">堆放 M = 1/8 × ' + fmt(qStack,3) + ' × ' + fmt(B,3) + ' × ' + fmt(Lcalc,3) + '² = <b>' + fmt(M_stack,3) + ' kN·m</b></div>');

                    st.push('<div class="step"><b>材料参数参考</b></div>');
                    st.push('<div class="step">底板混凝土：' + grade + '（f<sub>tk</sub> 参见 GB 50010 表 4.1.3）</div>');
                    st.push('<div class="step">预应力钢筋：' + D.preBarSpec(span) + '，f<sub>ptk</sub> = 1570 N/mm²，f<sub>py</sub> = 1110 N/mm²，E<sub>s</sub> = 2.05×10⁵ N/mm²</div>');
                    st.push('<div class="step">桁架上弦钢管：Q235，壁厚 1mm，f<sub>y</sub> = 235 N/mm²，f = 215 N/mm²，E = 2.06×10⁵ N/mm²</div>');
                    st.push('<div class="step">腹杆：HPB300 Φ4，f<sub>y</sub> = 270 N/mm²</div>');
                    st.push('<div class="step">张拉控制应力：Φ28管 σ<sub>con</sub> = 0.50f<sub>ptk</sub>；Φ20管 σ<sub>con</sub> = 0.40f<sub>ptk</sub></div>');
                    st.push('<div class="step">预应力总损失值小于 100 N/mm² 时取 100 N/mm²</div>');

                    st.push('<div class="step"><b>提示</b>：底板生产过程中正截面边缘混凝土法向拉应力应不大于相应施工环节混凝土抗拉强度标准值 f<sub>tk</sub>。详细截面应力分析需结合有效预应力、预应力筋位置和截面几何特性计算，建议按选用表复核板型。</div>');

                    html += '<div class="result-big pass">';
                    html += '<div class="big-label">第一阶段（底板制作）</div>';
                    html += '<div class="big-value" style="font-size:1.4em;">' + fmt(Math.max(M_demold, M_transport, M_stack),3) + ' <span style="font-size:0.5em;font-weight:400;">kN·m</span></div>';
                    html += '<div class="big-sub">最不利环节跨中弯矩设计值（脱模/运输/堆放）</div>';
                    html += '</div>';

                    html += '<div style="margin-top:16px;"><div style="font-weight:600;margin-bottom:8px;">各环节跨中弯矩</div>';
                    html += '<div class="table-wrap"><table class="mini">';
                    html += '<tr><th>验算环节</th><th>等效荷载 (kN/m²)</th><th>跨中弯矩 (kN·m)</th></tr>';
                    html += '<tr><td>脱模</td><td>' + fmt(qDemold,3) + '</td><td>' + fmt(M_demold,3) + '</td></tr>';
                    html += '<tr><td>运输吊装</td><td>' + fmt(qTransport,3) + '</td><td>' + fmt(M_transport,3) + '</td></tr>';
                    html += '<tr><td>堆放安装</td><td>' + fmt(qStack,3) + '</td><td>' + fmt(M_stack,3) + '</td></tr>';
                    html += '</table></div></div>';

                } else {
                    // 第二阶段：叠合板施工阶段
                    st.push('<div class="step"><b>第二阶段：叠合板施工阶段</b></div>');
                    st.push('<div class="step">荷载由底板承担（底板自重 + 叠合层自重 + 施工活荷载）</div>');

                    var qG1 = gBase + gSuper; // 自重标准值
                    var qQ1_std = qQ1;
                    var q1 = gammaG * qG1 + gammaQ * qQ1_std; // 设计值

                    st.push('<div class="step">自重标准值 q<sub>G1</sub> = ' + fmt(gBase,3) + ' + ' + fmt(gSuper,3) + ' = ' + fmt(qG1,3) + ' kN/m²</div>');
                    st.push('<div class="step">施工活荷载标准值 q<sub>Q1</sub> = ' + fmt(qQ1_std,3) + ' kN/m²</div>');
                    st.push('<div class="step">基本组合 q<sub>1</sub> = γ<sub>G</sub>q<sub>G1</sub> + γ<sub>Q</sub>q<sub>Q1</sub> = ' + gammaG.toFixed(2) + '×' + fmt(qG1,3) + ' + ' + gammaQ.toFixed(2) + '×' + fmt(qQ1_std,3) + ' = <b>' + fmt(q1,3) + ' kN/m²</b></div>');

                    var M1 = (1/8) * q1 * B * L2 * L2;
                    st.push('<div class="step">支撑间距 L<sub>2</sub> = ' + fmt(L2,3) + ' m</div>');
                    st.push('<div class="step">跨中弯矩设计值：</div>');
                    st.push('<div class="step">&nbsp;&nbsp;M<sub>1</sub> = 1/8 × q<sub>1</sub> × B × L<sub>2</sub>² = 1/8 × ' + fmt(q1,3) + ' × ' + fmt(B,3) + ' × ' + fmt(L2,3) + '²</div>');
                    st.push('<div class="step">&nbsp;&nbsp;M<sub>1</sub> = <b>' + fmt(M1,3) + ' kN·m</b></div>');

                    st.push('<div class="step"><b>提示</b>：施工阶段由预制底板承受全部施工荷载。建议按 L22ZG401 选用表中对应板型复核抗弯承载力，或结合第一阶段有效预应力进行截面应力分析。第三阶段（使用阶段）按整体受弯构件设计，斜截面及叠合面受剪按 GB 50010 附录 H 计算。</div>');

                    html += '<div class="result-big pass">';
                    html += '<div class="big-label">第二阶段跨中弯矩</div>';
                    html += '<div class="big-value">' + fmt(M1,3) + ' <span style="font-size:0.5em;font-weight:400;">kN·m</span></div>';
                    html += '<div class="big-sub">施工阶段叠合层自重 + 施工活荷载，q<sub>1</sub> = ' + fmt(q1,3) + ' kN/m²</div>';
                    html += '</div>';

                    html += '<div style="margin-top:16px;"><div style="font-weight:600;margin-bottom:8px;">施工阶段参数</div>';
                    html += '<div class="table-wrap"><table class="mini">';
                    html += '<tr><th style="width:35%;">项目</th><th>数值</th></tr>';
                    html += '<tr><td>荷载设计值 q<sub>1</sub></td><td>' + fmt(q1,3) + ' kN/m²</td></tr>';
                    html += '<tr><td>支撑间距 L<sub>2</sub></td><td>' + fmt(L2,3) + ' m</td></tr>';
                    html += '</table></div></div>';
                }

                // 材料参数速查
                html += '<div style="margin-top:16px;"><div style="font-weight:600;margin-bottom:8px;">材料参数参考</div>';
                html += '<div class="table-wrap"><table class="mini">';
                html += '<tr><th>材料</th><th>规格 / 等级</th><th>强度指标</th><th>弹性模量</th></tr>';
                html += '<tr><td>预应力钢筋</td><td>Φ' + D.preBarDiameter(span).toFixed(1) + ' 消除应力螺旋肋</td><td>f<sub>ptk</sub>=1570, f<sub>py</sub>=1110 N/mm²</td><td>2.05×10⁵ N/mm²</td></tr>';
                html += '<tr><td>横向钢筋</td><td>HPB300 Φ5.0</td><td>f<sub>y</sub>=270 N/mm²</td><td>2.10×10⁵ N/mm²</td></tr>';
                html += '<tr><td>桁架上弦钢管</td><td>Q235 壁厚1mm</td><td>f<sub>y</sub>=235, f=215 N/mm²</td><td>2.06×10⁵ N/mm²</td></tr>';
                html += '<tr><td>腹杆</td><td>HPB300 Φ4</td><td>f<sub>y</sub>=270 N/mm²</td><td>2.10×10⁵ N/mm²</td></tr>';
                html += '<tr><td>底板混凝土</td><td>' + grade + '</td><td colspan="2">按 GB 50010 对应取值</td></tr>';
                html += '<tr><td>叠合层混凝土</td><td>≥C30</td><td colspan="2">按 GB 50010 对应取值</td></tr>';
                html += '</table></div></div>';

                // 适用范围
                html += '<div style="margin-top:16px;"><div style="font-weight:600;margin-bottom:8px;">图集适用范围</div>';
                html += '<div style="color:var(--ink-secondary);font-size:0.9em;line-height:1.7;">';
                html += '· 抗震设防烈度 8 度及以下地区<br>';
                html += '· 环境类别一/二a类民用与工业建筑楼面、屋面<br>';
                html += '· 设计工作年限 50 年<br>';
                html += '· 支座按 200mm 宽混凝土梁考虑；叠合板总厚度为 110mm 时标志跨度不宜大于 3.9m';
                html += '</div></div>';

                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc.closest('.proc-wrap'); if (_p) _p.classList.add('open');

                window._L22_RESULT = {
                    module: 'stage',
                    stage: stage,
                    span: span, width: Bmm, B: B, hc: hc, hb: hb, concrete: grade,
                    gBase: gBase, gSuper: gSuper,
                    gammaG: gammaG, gammaQ: gammaQ,
                    L2: L2, qQ1: qQ1,
                    q1: stage === 'st2' ? (gammaG * (gBase + gSuper) + gammaQ * qQ1) : null,
                    M1: stage === 'st2' ? ((1/8) * (gammaG*(gBase+gSuper)+gammaQ*qQ1) * B * L2 * L2) : null,
                    steps: st.join('')
                };
            }

            document.getElementById('l22_st_calc').addEventListener('click', calcStage);
            document.getElementById('l22_st_reset').addEventListener('click', function () {
                document.getElementById('f-l22-stage').reset();
                document.getElementById('l22_st_result').innerHTML = '';
            });

            // 辅助：pad
            function pad2(n) { return n < 10 ? '0' + n : '' + n; }
            function pad3(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n; }
            function qLevelLabel(idx) { return ['q6','q7','q8','q9','q10'][idx]; }
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['l22zg401'] = tool;

    // ===== 计算书导出 =====
    window.buildL22Book = function (r, t) {
        var now = new Date();
        var dateStr = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
        function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
        var h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>L22ZG401预应力钢管桁架叠合板计算书</title><style>';
        h += window.CALC_BOOK_CSS || '';
        h += '.step{margin:6px 0;padding:6px 8px;border-bottom:1px dashed #ccc;}</style></head><body>';
        h += calcBookCover('L22ZG401 预应力混凝土钢管桁架叠合板计算书', '依据山东省建筑标准设计图集 L22ZG401', dateStr);
        h += '<h1>L22ZG401 预应力混凝土钢管桁架叠合板</h1>';
        h += '<p style="text-align:center;color:#666;">依据山东省建筑标准设计图集《L22ZG401 预应力混凝土钢管桁架叠合板》</p>';
        h += '<p style="text-align:center;color:#666;">计算日期：' + dateStr + '</p>';

        if (r.module === 'select') {
            h += '<h2>一、底板选用查询</h2>';
            h += '<table><tr><th style="width:40%;">参数</th><th>取值</th></tr>';
            h += '<tr><td>标志跨度</td><td>' + r.actualSpan + ' mm（' + (r.actualSpan/1000).toFixed(1) + ' m）' + (r.snapped ? '（已向上取整）' : '') + '</td></tr>';
            h += '<tr><td>底板宽度</td><td>' + r.width + ' mm' + (r.isStdWidth ? '' : '（非标准宽度，按 1000mm 宽底板折算）') + '</td></tr>';
            h += '<tr><td>允许附加荷载设计值</td><td>' + r.qLevel + ' kN/m²（' + (r.qIdx+6) + '级）</td></tr>';
            h += '</table>';

            h += '<h2>二、选用结果</h2>';
            h += '<table><tr><th style="width:40%;">项目</th><th>结果</th></tr>';
            h += '<tr><td>底板编号</td><td><b>' + esc(r.modelNo) + '</b></td></tr>';
            h += '<tr><td>底板长度</td><td>' + r.baseLen + ' mm</td></tr>';
            h += '<tr><td>底板厚度 / 叠合层厚度</td><td>' + r.hb + ' mm / ' + r.hc + ' mm</td></tr>';
            h += '<tr><td>叠合板总厚度</td><td>' + r.totalH + ' mm</td></tr>';
            h += '<tr><td>底板混凝土强度等级</td><td>' + esc(r.concrete) + '</td></tr>';
            h += '<tr><td>① 纵向预应力钢筋</td><td>' + esc(r.preSpec) + '，' + r.longBars + ' 根，单根长 ' + r.preLen + ' mm</td></tr>';
            h += '<tr><td>② 横向钢筋（分布筋）</td><td>' + esc(r.transSpec) + '，' + r.transBars + ' 根，单根长 ' + r.transLen + ' mm</td></tr>';
            h += '<tr><td>底板混凝土体积</td><td>' + r.vol.toFixed(3) + ' m³</td></tr>';
            h += '<tr><td>底板自重</td><td>' + r.weight + ' kg</td></tr>';
            h += '</table>';
        } else if (r.module === 'load') {
            h += '<h2>二、荷载等级计算</h2>';
            h += '<table><tr><th style="width:40%;">参数</th><th>取值</th></tr>';
            h += '<tr><td>附加永久荷载标准值 g<sub>k</sub></td><td>' + r.gk.toFixed(2) + ' kN/m²</td></tr>';
            h += '<tr><td>可变荷载标准值 q<sub>k</sub></td><td>' + r.qk.toFixed(2) + ' kN/m²</td></tr>';
            h += '<tr><td>结构重要性系数 γ<sub>0</sub></td><td>' + r.gamma0.toFixed(1) + '</td></tr>';
            h += '<tr><td>永久荷载分项系数 γ<sub>G</sub></td><td>' + (r.gammaG||1.3).toFixed(2) + '</td></tr>';
            h += '<tr><td>可变荷载分项系数 γ<sub>Q</sub></td><td>' + (r.gammaQ||1.5).toFixed(2) + '</td></tr>';
            h += '</table>';
            h += '<h2>二、计算结果</h2>';
            h += '<p>附加荷载设计值 q = γ<sub>G</sub>g<sub>k</sub> + γ<sub>Q</sub>q<sub>k</sub> = ' + r.q_design.toFixed(2) + ' kN/m²</p>';
            if (r.out_of_range) {
                h += '<p><b>超出图集范围</b>：q > 10 kN/m²，建议加大叠合层厚度或调整板跨布置。</p>';
            } else {
                h += '<p><b>推荐荷载等级：' + (r.level+6) + ' 级</b>（允许附加荷载 ' + (r.level+6) + ' kN/m²）</p>';
            }
        } else if (r.module === 'stage') {
            h += '<h2>三、施工阶段验算</h2>';
            h += '<table><tr><th style="width:40%;">参数</th><th>取值</th></tr>';
            h += '<tr><td>底板标志跨度</td><td>' + r.span_mm + ' mm</td></tr>';
            h += '<tr><td>底板宽度 B</td><td>' + r.width_mm + ' mm</td></tr>';
            h += '<tr><td>底板厚度 / 叠合层厚度</td><td>' + r.hb_mm + ' mm / ' + r.hc_mm + ' mm</td></tr>';
            h += '<tr><td>底板混凝土等级</td><td>' + esc(r.concrete) + '</td></tr>';
            h += '<tr><td>验算阶段</td><td>' + (r.stage === 'st1' ? '第一阶段：底板制作' : '第二阶段：叠合板施工') + '</td></tr>';
            if (r.stage === 'st2') {
                h += '<tr><td>支撑间距 L<sub>2</sub></td><td>' + r.L2_m.toFixed(3) + ' m</td></tr>';
                h += '<tr><td>施工活荷载标准值</td><td>' + r.qQ1.toFixed(2) + ' kN/m²</td></tr>';
                h += '<tr><td>荷载设计值 q<sub>1</sub></td><td>' + r.q1.toFixed(3) + ' kN/m²</td></tr>';
                h += '<tr><td>跨中弯矩设计值 M<sub>1</sub></td><td><b>' + r.M1.toFixed(3) + ' kN·m</b></td></tr>';
            }
            h += '</table>';
        }

        h += '<h2>计算过程</h2>';
        h += '<div class="calc-proc">' + (r.steps || '') + '</div>';

        h += '<h2>编制说明</h2>';
        h += '<p>1. 依据：山东省建筑标准设计图集《L22ZG401 预应力混凝土钢管桁架叠合板》（2022年第3号公告，2022年8月1日施行）。</p>';
        h += '<p>2. 主编单位：山东建筑大学设计集团有限公司、山东万斯达建筑规划设计研究院有限公司。</p>';
        h += '<p>3. 适用范围：抗震设防烈度 8 度及以下、环境类别一/二a类民用与工业建筑楼面、屋面；设计工作年限 50 年。</p>';
        h += '<p>4. 本计算书由"计算工具箱"自动生成，结果基于输入参数得出，需设计人员复核确认。</p>';

        h += calcBookSign();
        h += calcBookFooter();
        h += '</body></html>';
        return h;
    };
})();
