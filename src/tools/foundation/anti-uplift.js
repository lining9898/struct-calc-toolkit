(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 / JGJ 476-2019 / GB 50069-2002 / GB 55003-2021",
            formulaSource: "5.4.3, 5.2.4",
            limitations: "建筑/水池抗浮，整体/局部抗浮稳定",
            unit: "Gk:kN, Nw:kN, Kw:—",
            version: "1.0.0"
        },
        title: '抗浮稳定性验算',
        sub: '水池/建筑抗浮 · 行车荷载 · 浮托力折减 · GB 50007 / JGJ 476 / GB 50069 / GB 55003',
        render: function () {
            return '<div class="panel"><div class="panel-title">工程类型与设计等级</div>' +
                '<form id="f-au"><div class="grid2">' +
                selField('au_type', '工程类型', opts([
                    { v: 'building', t: '一般建筑工程' },
                    { v: 'tank', t: '水池构筑物（给排水）' }
                ], 'building')) +
                selField('au_grade', '抗浮工程设计等级', opts([
                    { v: 'A', t: '甲级（重要工程/后果很严重）' },
                    { v: 'B', t: '乙级（一般工程/后果较严重）' },
                    { v: 'C', t: '丙级（次要工程/后果不严重）' }
                ], 'B')) +
                selField('au_stage', '验算阶段', opts([
                    { v: 'use', t: '使用期（正常使用）' },
                    { v: 'cons', t: '施工期（施工阶段）' }
                ], 'use')) +
                selField('au_mode', '验算模式', opts([
                    { v: 'overall', t: '整体抗浮验算' },
                    { v: 'local', t: '局部抗浮验算' }
                ], 'overall')) +
                '</div>' +
                /* --- 一般建筑自重 --- */
                '<div id="au_building_fields" class="grid2">' +
                '<div class="panel-title" style="margin-top:14px;grid-column:1/-1;">结构自重与压重（一般建筑）</div>' +
                numField('au_G1', '结构自重 G<sub>1</sub>', 'kN', 50000, '上部结构+基础自重标准值') +
                numField('au_G2', '附加压重 G<sub>2</sub>', 'kN', 0, '覆土压重、配重等（可填0）') +
                numField('au_Ra', '抗浮构件抗力 R<sub>a</sub>', 'kN', 0, '抗拔桩/锚杆抗拔力特征值总和（可填0）') +
                '</div>' +
                /* --- 水池自重 --- */
                '<div id="au_tank_fields" class="grid2" style="display:none;">' +
                '<div class="panel-title" style="margin-top:14px;grid-column:1/-1;">水池结构自重（GB 50069 §5.2.4）</div>' +
                numField('au_Gr', '盖板自重 G<sub>r</sub>', 'kN', 1200, '水池顶盖自重标准值') +
                numField('au_Gw', '池壁自重 G<sub>w</sub>', 'kN', 1800, '池壁自重标准值') +
                numField('au_Gb', '底板自重 G<sub>b</sub>', 'kN', 2000, '底板自重标准值') +
                numField('au_Gs', '池顶覆土重 G<sub>s</sub>', 'kN', 1500, '池顶覆土标准值（可填0）') +
                numField('au_Ra2', '抗浮构件抗力 R<sub>a</sub>', 'kN', 0, '抗拔桩/锚杆抗拔力总和（可填0）') +
                numField('au_eta', '浮托力折减系数 η<sub>fw</sub>', '', 1.0, 'GB 50069 §4.3.4，一般取1.0') +
                '</div>' +
                /* --- 地面行车荷载 --- */
                '<div class="panel-title" style="margin-top:14px;">地面行车荷载（GB 55001 表4.2.3）</div><div class="grid2">' +
                selField('au_vtype', '地面活荷载类型', opts([
                    { v: 'none', t: '无行车荷载' },
                    { v: 'car', t: '小型客车（4.0 kN/m²）' },
                    { v: 'fire_uni', t: '消防车-单向板（35.0 kN/m²）' },
                    { v: 'fire_bi6', t: '消防车-双向板≥6m（20.0 kN/m²）' },
                    { v: 'custom', t: '自定义均布荷载' }
                ], 'none')) +
                numField('au_q', '地面活荷载标准值 q', 'kN/m²', 0, '按类型自动填入或自定义') +
                numField('au_Aq', '荷载作用面积 A<sub>q</sub>', 'm²', 0, '行车荷载作用的等效面积') +
                selField('au_vcount', '行车荷载是否计入抗浮力', opts([
                    { v: 'no', t: '不计入（临时活荷载，仅参考）' },
                    { v: 'yes', t: '计入（按永久压重考虑）' }
                ], 'no')) +
                '</div>' +
                /* --- 地下水参数 --- */
                '<div class="panel-title" style="margin-top:14px;">地下水参数</div><div class="grid2">' +
                numField('au_hw', '地下水位至基底高度 h<sub>w</sub>', 'm', 3.5, '地下水头高度（取最高水位）') +
                numField('au_A', '基础底面积 A', 'm²', 500, '整体底面积或局部计算区域面积') +
                numField('au_gamma_w', '水的重度 γ<sub>w</sub>', 'kN/m³', 10, '一般取10kN/m³') +
                '</div><div class="hint">说明：依据 GB 50007-2011 §5.4.3，抗浮验算公式 G<sub>k</sub>/N<sub>w,k</sub> ≥ K<sub>w</sub>。JGJ 476-2019按等级区分安全系数。GB 50069-2002 §5.2.4规定水池抗浮抗力系数≥1.05，验算时抵抗力只计永久作用（不含池内盛水），浮托力按 q<sub>fw,k</sub>=γ<sub>w</sub>·h<sub>w</sub>·η<sub>fw</sub> 计算。GB 55003-2021 §6.1.3为强制性条文。行车荷载参考 GB 55001-2021 表4.2.3取值：小型客车4.0kN/m²、消防车单向板35.0kN/m²、消防车双向板≥6m为20.0kN/m²。临时活荷载一般不计入抗浮力；仅当按永久压重考虑时方可计入。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="au_calc">验算抗浮</button>' +
                '<button type="button" class="btn btn-secondary" id="au_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">验算结果</div><div id="au_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="au_proc"></div></div></div></div>';
        },
        bind: function () {
            function toggleTypeFields() {
                var typeV = document.getElementById('au_type').value;
                var bf = document.getElementById('au_building_fields');
                var tf = document.getElementById('au_tank_fields');
                if (typeV === 'tank') { bf.style.display = 'none'; tf.style.display = 'grid'; }
                else { bf.style.display = 'grid'; tf.style.display = 'none'; }
            }
            function onVtypeChange() {
                var vtype = document.getElementById('au_vtype').value;
                var qField = document.getElementById('au_q');
                var qMap = { 'none': 0, 'car': 4.0, 'fire_uni': 35.0, 'fire_bi6': 20.0, 'custom': 0 };
                if (vtype !== 'custom') qField.value = qMap[vtype];
            }
            function calc() {
                var out = document.getElementById('au_result');
                var proc = document.getElementById('au_proc');
                var typeV = document.getElementById('au_type').value;
                var grade = document.getElementById('au_grade').value;
                var stage = document.getElementById('au_stage').value;
                var mode = document.getElementById('au_mode').value;
                var hw = parseFloat(document.getElementById('au_hw').value);
                var A = parseFloat(document.getElementById('au_A').value);
                var gamma_w = parseFloat(document.getElementById('au_gamma_w').value);
                var vtype = document.getElementById('au_vtype').value;
                var q = parseFloat(document.getElementById('au_q').value);
                var Aq = parseFloat(document.getElementById('au_Aq').value);
                var vcount = document.getElementById('au_vcount').value;
                var st = [];

                var isTank = (typeV === 'tank');
                var gradeText = grade === 'A' ? '甲级' : (grade === 'B' ? '乙级' : '丙级');
                var stageText = stage === 'use' ? '使用期' : '施工期';
                var typeText = isTank ? '水池构筑物' : '一般建筑工程';

                // ① 安全系数Kw
                var Kw;
                var KwTable = { 'A': { use: 1.10, cons: 1.05 }, 'B': { use: 1.05, cons: 1.00 }, 'C': { use: 1.00, cons: 0.95 } };
                Kw = KwTable[grade][stage];
                var refStd = isTank ? 'GB 50069-2002 §5.2.4 / JGJ 476-2019' : 'JGJ 476-2019';
                st.push('<div class="step"><b>① 工程类型与安全系数</b></div>');
                st.push('<div class="step">　　工程类型：' + typeText + '；抗浮等级：' + gradeText + '；验算阶段：' + stageText + '</div>');
                if (isTank) {
                    st.push('<div class="step">　　GB 50069-2002 §5.2.4：水池抗浮抗力系数 K<sub>s</sub> ≥ 1.05</div>');
                    st.push('<div class="step">　　JGJ 476-2019 表3.0.3：K<sub>w</sub> = <b>' + Kw.toFixed(2) + '</b></div>');
                    st.push('<div class="step">　　取 K = max(K<sub>s</sub>, K<sub>w</sub>) = max(1.05, ' + Kw.toFixed(2) + ') = <b>' + (Math.max(1.05, Kw)).toFixed(2) + '</b></div>');
                    Kw = Math.max(1.05, Kw);
                } else {
                    st.push('<div class="step">　　JGJ 476-2019 表3.0.3：K<sub>w</sub> = <b>' + Kw.toFixed(2) + '</b></div>');
                }

                // ② 总抗浮力G
                var G, Ra;
                st.push('<div class="step"><b>② 总抗浮力 G</b></div>');
                if (isTank) {
                    var Gr = parseFloat(document.getElementById('au_Gr').value);
                    var Gw = parseFloat(document.getElementById('au_Gw').value);
                    var Gb = parseFloat(document.getElementById('au_Gb').value);
                    var Gs = parseFloat(document.getElementById('au_Gs').value);
                    Ra = parseFloat(document.getElementById('au_Ra2').value);
                    st.push('<div class="step">　　盖板自重 G<sub>r</sub> = ' + fmt(Gr,0) + ' kN</div>');
                    st.push('<div class="step">　　池壁自重 G<sub>w</sub> = ' + fmt(Gw,0) + ' kN</div>');
                    st.push('<div class="step">　　底板自重 G<sub>b</sub> = ' + fmt(Gb,0) + ' kN</div>');
                    st.push('<div class="step">　　池顶覆土 G<sub>s</sub> = ' + fmt(Gs,0) + ' kN</div>');
                    st.push('<div class="step">　　抗浮构件抗力 R<sub>a</sub> = ' + fmt(Ra,0) + ' kN</div>');
                    st.push('<div class="step">　　注：池内盛水不计入抗浮力（GB 50069 §5.2.4）</div>');
                    G = Gr + Gw + Gb + Gs + Ra;
                    st.push('<div class="step">　　小计 G = G<sub>r</sub>+G<sub>w</sub>+G<sub>b</sub>+G<sub>s</sub>+R<sub>a</sub> = <b>' + fmt(G,0) + ' kN</b></div>');
                } else {
                    var G1 = parseFloat(document.getElementById('au_G1').value);
                    var G2 = parseFloat(document.getElementById('au_G2').value);
                    Ra = parseFloat(document.getElementById('au_Ra').value);
                    st.push('<div class="step">　　结构自重 G<sub>1</sub> = ' + fmt(G1,0) + ' kN</div>');
                    st.push('<div class="step">　　附加压重 G<sub>2</sub> = ' + fmt(G2,0) + ' kN</div>');
                    st.push('<div class="step">　　抗浮构件抗力 R<sub>a</sub> = ' + fmt(Ra,0) + ' kN</div>');
                    G = G1 + G2 + Ra;
                    st.push('<div class="step">　　小计 G = G<sub>1</sub>+G<sub>2</sub>+R<sub>a</sub> = <b>' + fmt(G,0) + ' kN</b></div>');
                }

                // ③ 行车荷载
                if (q > 0 && Aq > 0) {
                    var Gv = q * Aq;
                    st.push('<div class="step"><b>③ 地面行车荷载（GB 55001 表4.2.3）</b></div>');
                    st.push('<div class="step">　　活荷载标准值 q = ' + fmt(q,1) + ' kN/m²</div>');
                    st.push('<div class="step">　　荷载作用面积 A<sub>q</sub> = ' + fmt(Aq,1) + ' m²</div>');
                    st.push('<div class="step">　　行车荷载 G<sub>v</sub> = q·A<sub>q</sub> = ' + fmt(q,1) + '×' + fmt(Aq,1) + ' = <b>' + fmt(Gv,0) + ' kN</b></div>');
                    if (vcount === 'yes') {
                        G += Gv;
                        st.push('<div class="step">　　已按永久压重计入抗浮力 → G = ' + fmt(G - Gv, 0) + ' + ' + fmt(Gv, 0) + ' = <b>' + fmt(G, 0) + ' kN</b></div>');
                        st.push('<div class="step">　　注：行车荷载按永久压重计入，应满足长期作用条件</div>');
                    } else {
                        st.push('<div class="step">　　未计入抗浮力（临时活荷载不作为可靠抗浮力）</div>');
                        st.push('<div class="step">　　注：GB 50069 §5.2.4规定抗浮验算只计永久作用，临时活荷载不计入</div>');
                    }
                } else {
                    st.push('<div class="step"><b>③ 地面行车荷载</b></div>');
                    st.push('<div class="step">　　未考虑行车荷载（q=0 或 A<sub>q</sub>=0）</div>');
                }
                st.push('<div class="step">　　总抗浮力 G = <b>' + fmt(G,0) + ' kN</b></div>');

                // ④ 浮力Nw,k
                var Nwk;
                st.push('<div class="step"><b>④ 地下水浮力 N<sub>w,k</sub></b></div>');
                if (isTank) {
                    var eta = parseFloat(document.getElementById('au_eta').value);
                    Nwk = gamma_w * hw * A * eta;
                    st.push('<div class="step">　　GB 50069 §4.3.4：q<sub>fw,k</sub> = γ<sub>w</sub>·h<sub>w</sub>·η<sub>fw</sub></div>');
                    st.push('<div class="step">　　N<sub>w,k</sub> = γ<sub>w</sub>·h<sub>w</sub>·A·η<sub>fw</sub> = ' + gamma_w + '×' + hw + '×' + A + '×' + eta + '</div>');
                    st.push('<div class="step">　　<b>N<sub>w,k</sub> = ' + fmt(Nwk,0) + ' kN</b></div>');
                    st.push('<div class="step">　　η<sub>fw</sub> = ' + eta + '（浮托力折减系数）</div>');
                } else {
                    Nwk = gamma_w * hw * A;
                    st.push('<div class="step">　　阿基米德原理：N<sub>w,k</sub> = γ<sub>w</sub>·h<sub>w</sub>·A</div>');
                    st.push('<div class="step">　　= ' + gamma_w + '×' + hw + '×' + A + ' = <b>' + fmt(Nwk,0) + ' kN</b></div>');
                }

                // ⑤ 抗浮稳定性验算
                var ratio = G / Nwk;
                var ok = ratio >= Kw;
                st.push('<div class="step"><b>⑤ 抗浮稳定性验算</b></div>');
                st.push('<div class="step">　　G / N<sub>w,k</sub> = ' + fmt(G,0) + ' / ' + fmt(Nwk,0) + ' = <b>' + fmt(ratio,3) + '</b></div>');
                st.push('<div class="step">　　K = ' + Kw.toFixed(2) + '</div>');
                st.push('<div class="step">　　' + (ok ? '✓ 满足' : '✗ 不满足') + '：G/N<sub>w,k</sub> ' + (ok ? '≥' : '<') + ' K' + tag(ok?'ok':'err', ok?'满足':'不满足') + '</div>');

                // ⑥ 局部抗浮
                if (mode === 'local') {
                    var localW = Nwk / A;
                    var localG = G / A;
                    st.push('<div class="step"><b>⑥ 局部抗浮验算（JGJ 476-2019 §6.1.2）</b></div>');
                    st.push('<div class="step">　　单位面积浮力 = ' + fmt(localW,1) + ' kN/m²</div>');
                    st.push('<div class="step">　　单位面积抗浮力 = ' + fmt(localG,1) + ' kN/m²</div>');
                    st.push('<div class="step">　　K<sub>f</sub> = ' + fmt(localG,1) + '/' + fmt(localW,1) + ' = <b>' + fmt(localG/localW,3) + '</b></div>');
                }

                // ⑦ 不满足措施
                if (!ok) {
                    var deficit = Kw * Nwk - G;
                    st.push('<div class="step"><b>⑦ 抗浮不足，建议措施</b></div>');
                    st.push('<div class="step">　　抗浮力缺口 = K×N<sub>w,k</sub> − G = ' + fmt(Kw*Nwk,0) + ' − ' + fmt(G,0) + ' = <b>' + fmt(deficit,0) + ' kN</b></div>');
                    st.push('<div class="step">　　① 增加池顶覆土厚度或配重</div>');
                    st.push('<div class="step">　　② 设置抗拔桩或预应力锚杆</div>');
                    st.push('<div class="step">　　③ 增加底板厚度或结构刚度</div>');
                    st.push('<div class="step">　　④ 降低地下水位（施工期）</div>');
                    st.push('<div class="step">　　⑤ 行车荷载按永久压重考虑时需论证长期作用</div>');
                }

                var html = resultRow('工程类型', typeText);
                html += resultRow('抗浮等级/阶段', gradeText + ' / ' + stageText);
                html += resultRow('安全系数 K', '<b>' + Kw.toFixed(2) + '</b>');
                html += resultRow('总抗浮力 G', fmt(G,0) + ' kN');
                if (q > 0 && Aq > 0) {
                    html += resultRow('行车荷载 G<sub>v</sub>', fmt(q*Aq,0) + ' kN' + (vcount === 'yes' ? '（已计入）' : '（未计入）'));
                }
                html += resultRow('浮力 N<sub>w,k</sub>', fmt(Nwk,0) + ' kN');
                html += resultRow('G/N<sub>w,k</sub>', '<b>' + fmt(ratio,3) + '</b>');
                html += resultRow('判定', badge(ok?'badge-ok':'badge-err', ok?'抗浮稳定满足' : '抗浮不足，需采取措施'));
                var refBadge = isTank ? 'GB 50069 §5.2.4 / GB 50007 §5.4.3 / JGJ 476 / GB 55003 §6.1.3' : 'GB 50007 §5.4.3 / JGJ 476 / GB 55003 §6.1.3';
                html += resultRow('依据', badge('badge-ok', refBadge));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('au_type').value = 'building';
                document.getElementById('au_grade').value = 'B';
                document.getElementById('au_stage').value = 'use';
                document.getElementById('au_mode').value = 'overall';
                document.getElementById('au_G1').value = 50000;
                document.getElementById('au_G2').value = 0;
                document.getElementById('au_Ra').value = 0;
                document.getElementById('au_Gr').value = 1200;
                document.getElementById('au_Gw').value = 1800;
                document.getElementById('au_Gb').value = 2000;
                document.getElementById('au_Gs').value = 1500;
                document.getElementById('au_Ra2').value = 0;
                document.getElementById('au_eta').value = 1.0;
                document.getElementById('au_vtype').value = 'none';
                document.getElementById('au_q').value = 0;
                document.getElementById('au_Aq').value = 0;
                document.getElementById('au_vcount').value = 'no';
                document.getElementById('au_hw').value = 3.5;
                document.getElementById('au_A').value = 500;
                document.getElementById('au_gamma_w').value = 10;
                toggleTypeFields();
                onVtypeChange();
                calc();
            }
            document.getElementById('au_calc').addEventListener('click', calc);
            document.getElementById('au_reset').addEventListener('click', reset);
            document.getElementById('au_type').addEventListener('change', function() { toggleTypeFields(); calc(); });
            document.getElementById('au_grade').addEventListener('change', calc);
            document.getElementById('au_stage').addEventListener('change', calc);
            document.getElementById('au_mode').addEventListener('change', calc);
            document.getElementById('au_vtype').addEventListener('change', function() { onVtypeChange(); calc(); });
            document.getElementById('au_vcount').addEventListener('change', calc);
            document.getElementById('f-au').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            toggleTypeFields();
            onVtypeChange();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['anti-uplift'] = tool;
})();
