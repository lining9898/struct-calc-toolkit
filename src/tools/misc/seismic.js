/* seismic 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '抗震设防参数速查',
        sub: '烈度 · 地震加速度 · 设计分组 · 抗震等级 · 设防地震影响系数 · 近场增大系数 · GB/T 50011-2010（2024年版）(2016) 2024修订',
        meta: {"standard": "GB/T 50011-2010（2024年版）(2016) 2024修订", "formulaSource": "6.1, 表6.1.2", "limitations": "烈度/加速度/分组/场地/结构类型/高度→抗震等级", "unit": "烈度:度, 加速度:g, 等级:—", "version": "1.0.0"},
        render: function () {
            var cityOpts = CITY_SEISMIC.map(function (c) { return { v: c.name, t: c.name }; });
            return '<div class="panel"><div class="panel-title">城市选择或参数手动输入</div>' +
                '<form id="f-sk"><div class="grid2">' +
                selField('sk_city', '所在城市（自动填入）', opts(cityOpts, '北京')) +
                selField('sk_intensity', '抗震设防烈度', opts([
                    { v: 6, t: '6 度（0.05g）' },
                    { v: 7, t: '7 度（0.10g）' },
                    { v: '7.5', t: '7 度（0.15g）' },
                    { v: 8, t: '8 度（0.20g）' },
                    { v: '8.5', t: '8 度（0.30g）' },
                    { v: 9, t: '9 度（0.40g）' }
                ], 8)) +
                numField('sk_accel', '设计基本地震加速度 α<sub>max</sub>', 'g', 0.20, '可手动调整') +
                selField('sk_group', '设计地震分组', opts([
                    { v: 1, t: '第一组' },
                    { v: 2, t: '第二组' },
                    { v: 3, t: '第三组' }
                ], 2)) +
                selField('sk_site', '建筑场地类别', opts([
                    { v: 'I0', t: 'I₀ 类' },
                    { v: 'I1', t: 'I₁ 类' },
                    { v: 'II', t: 'II 类' },
                    { v: 'III', t: 'III 类' },
                    { v: 'IV', t: 'IV 类' }
                ], 'II')) +
                '</div><div class="panel-title" style="margin-top:14px;">结构信息</div><div class="grid2">' +
                selField('sk_struct', '结构类型', opts([
                    { v: 'frame', t: '框架结构' },
                    { v: 'fw', t: '框架-剪力墙 / 框架-核心筒' },
                    { v: 'sw', t: '剪力墙结构' },
                    { v: 'tube', t: '筒体结构（筒中筒）' },
                    { v: 'frame-bent', t: '框支剪力墙' },
                    { v: 'masonry', t: '多层砌体' },
                    { v: 'base', t: '基础（按丙类建筑）' }
                ], 'fw')) +
                numField('sk_height', '房屋高度 H', 'm', 60, '结构总高度') +
                selField('sk_cat', '建筑抗震设防类别', opts([
                    { v: '甲', t: '甲类（特殊设防）' },
                    { v: '乙', t: '乙类（重点设防）' },
                    { v: '丙', t: '丙类（标准设防）' },
                    { v: '丁', t: '丁类（适度设防）' }
                ], '丙')) +
                '</div><div class="panel-title" style="margin-top:14px;">近场影响（2024修订 3.10.3条）</div><div class="grid2">' +
                selField('sk_nearfault', '发震断裂距离', opts([
                    { v: 'none', t: '不在10km以内（不考虑）' },
                    { v: 'inner', t: '≤5km（增大系数1.5）' },
                    { v: 'outer', t: '5~10km（增大系数≥1.25）' }
                ], 'none'), '3.10.3条第③款：处于发震断裂两侧10km以内的建筑，地震动参数应计入近场影响') +
                '</div><div class="hint">说明：根据 GB/T 50011-2010（2024年版）2024年局部修订 与 GB 18306-2015《中国地震动参数区划图》参数，以及建筑高度、结构类型，查表确定抗震等级与构造措施等级。2024年修订涉及9个条文：3.1.3、3.9.2、3.10.1~3.10.5、5.4.1、12.1.6。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="sk_calc">查询 / 计算</button>' +
                '<button type="button" class="btn btn-secondary" id="sk_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">设防参数汇总</div><div id="sk_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细依据与查表过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="sk_proc"></div></div></div></div>';
        },
        bind: function () {
            function fillCity() {
                var name = document.getElementById('sk_city').value;
                var c = CITY_SEISMIC.find(function (x) { return x.name === name; });
                if (!c) return;
                var intens = c.intensity;
                var accel = c.accel;
                if (accel === 0.15) intens = '7.5';
                if (accel === 0.30) intens = '8.5';
                document.getElementById('sk_intensity').value = intens;
                document.getElementById('sk_accel').value = accel;
                document.getElementById('sk_group').value = c.group;
            }
            function calc() {
                var out = document.getElementById('sk_result'), proc = document.getElementById('sk_proc');
                var city = document.getElementById('sk_city').value;
                var intensity = document.getElementById('sk_intensity').value;
                var accel = parseFloat(document.getElementById('sk_accel').value);
                var group = parseInt(document.getElementById('sk_group').value);
                var site = document.getElementById('sk_site').value;
                var structV = document.getElementById('sk_struct').value;
                var H = parseFloat(document.getElementById('sk_height').value);
                var cat = document.getElementById('sk_cat').value;
                var nearFault = document.getElementById('sk_nearfault').value;
                var st = [];

                st.push('<div class="step"><b>① 设防参数</b>　城市：' + city + '</div>');
                st.push('<div class="step">　　设防烈度：' + intensity + ' 度；设计基本地震加速度：' + accel + 'g；设计地震分组：第 ' + group + ' 组</div>');
                st.push('<div class="step">　　场地类别：' + site + ' 类；结构类型：' + structV + '；高度：' + H + ' m；设防类别：' + cat + ' 类</div>');

                // ② 特征周期 Tg
                // GB 50011 表 5.1.4-2
                var Tg_table = {
                    'I0': { 1: 0.20, 2: 0.25, 3: 0.30 },
                    'I1': { 1: 0.25, 2: 0.30, 3: 0.35 },
                    'II': { 1: 0.35, 2: 0.40, 3: 0.45 },
                    'III': { 1: 0.45, 2: 0.55, 3: 0.65 },
                    'IV': { 1: 0.65, 2: 0.75, 3: 0.90 }
                };
                var Tg = Tg_table[site][group];
                st.push('<div class="step"><b>② 特征周期 T<sub>g</sub>（表 5.1.4-2）</b>　T<sub>g</sub> = <b>' + Tg.toFixed(2) + ' s</b></div>');

                // ③ 水平地震影响系数最大值 α_max
                var alpha_table = { '6': 0.04, '7': 0.08, '7.5': 0.12, '8': 0.16, '8.5': 0.24, '9': 0.32 };
                // 多遇地震下 α_max 为上表值（注：表格是多遇地震）
                var alpha_max = alpha_table[intensity] || 0.16;
                st.push('<div class="step"><b>③ 水平地震影响系数最大值 α<sub>max</sub>（表 5.1.4-1，多遇地震）</b>　α<sub>max</sub> = <b>' + alpha_max.toFixed(3) + '</b></div>');

                // ③b 设防地震影响系数最大值（2024修订 3.10.3条）
                var alpha_fortification = { '6': 0.12, '7': 0.23, '7.5': 0.34, '8': 0.45, '8.5': 0.68, '9': 0.90 };
                var alpha_fort = alpha_fortification[intensity] || 0.45;
                // 罕遇地震影响系数最大值（表 5.1.4-1）
                var alpha_rare_table = { '6': 0.28, '7': 0.50, '7.5': 0.72, '8': 0.90, '8.5': 1.20, '9': 1.40 };
                var alpha_rare = alpha_rare_table[intensity] || 0.90;
                st.push('<div class="step"><b>③b 设防地震影响系数最大值（2024修订 3.10.3条第1)款）</b></div>');
                st.push('<div class="step">　　设防地震 α<sub>max</sub>（设防） = <b>' + alpha_fort.toFixed(2) + '</b>（6度=0.12, 7度0.10g=0.23, 7度0.15g=0.34, 8度0.20g=0.45, 8度0.30g=0.68, 9度=0.90）</div>');
                st.push('<div class="step">　　罕遇地震 α<sub>max</sub>（罕遇） = <b>' + alpha_rare.toFixed(2) + '</b></div>');
                st.push('<div class="step">　　<b>三级地震水准</b>：多遇地震（重现期50年）→ 设防地震（475年）→ 罕遇地震（7度约1600年/9度约2400年）</div>');

                // ③c 近场增大系数（2024修订 3.10.3条第③款）
                if (nearFault !== 'none') {
                    var nfCoef = nearFault === 'inner' ? 1.5 : 1.25;
                    var nfDesc = nearFault === 'inner' ? '≤5km，增大系数 = 1.5' : '5~10km，增大系数 ≥ 1.25';
                    st.push('<div class="step"><b>③c 近场影响增大（2024修订 3.10.3条第③款）</b></div>');
                    st.push('<div class="step">　　发震断裂距离：' + nfDesc + '</div>');
                    st.push('<div class="step">　　调整后设防地震 α<sub>max</sub> = ' + alpha_fort.toFixed(2) + ' × ' + nfCoef + ' = <b>' + (alpha_fort * nfCoef).toFixed(3) + '</b></div>');
                    alpha_fort = alpha_fort * nfCoef;
                }

                // ④ 抗震等级（丙类，按烈度+结构+高度）
                // 框架结构（GB 50011 表 6.1.2）
                function frameLevel(intens, H) {
                    // 烈度6: ≤24m=4, >24=3
                    // 烈度7: ≤24=3, >24=2
                    // 烈度8: ≤24=2, >24=1
                    // 烈度9: 1
                    if (intens === 6) return H <= 24 ? 4 : 3;
                    if (intens === 7 || intens === '7.5') return H <= 24 ? 3 : 2;
                    if (intens === 8 || intens === '8.5') return H <= 24 ? 2 : 1;
                    if (intens === 9) return 1;
                    return 3;
                }
                function fwLevel(intens, H) {
                    // 框架-剪力墙（框架部分等级）
                    if (intens === 6) return H <= 60 ? 4 : 3;
                    if (intens === 7 || intens === '7.5') return H <= 60 ? 3 : 2;
                    if (intens === 8 || intens === '8.5') return H <= 60 ? 2 : 1;
                    if (intens === 9) return 1;
                    return 3;
                }
                function swLevel(intens, H) {
                    // 剪力墙
                    if (intens === 6) return H <= 80 ? 4 : 3;
                    if (intens === 7 || intens === '7.5') return H <= 80 ? 3 : 2;
                    if (intens === 8 || intens === '8.5') return H <= 80 ? 2 : 1;
                    if (intens === 9) return H <= 60 ? 1 : 1;
                    return 3;
                }
                function tubeLevel(intens, H) {
                    if (intens === 6) return 3;
                    if (intens === 7 || intens === '7.5') return H <= 150 ? 3 : 2;
                    if (intens === 8 || intens === '8.5') return H <= 100 ? 2 : 1;
                    if (intens === 9) return 1;
                    return 3;
                }
                function masonryLevel(intens) {
                    // 砌体抗震等级表简化
                    if (intens === 6) return 4;
                    if (intens === 7 || intens === '7.5') return 3;
                    if (intens === 8 || intens === '8.5') return 2;
                    if (intens === 9) return 1;
                    return 4;
                }

                var level = 3, levelName = '三级';
                if (structV === 'frame') level = frameLevel(intensity, H);
                else if (structV === 'fw') level = fwLevel(intensity, H);
                else if (structV === 'sw') level = swLevel(intensity, H);
                else if (structV === 'tube' || structV === 'frame-bent') level = tubeLevel(intensity, H);
                else if (structV === 'masonry') level = masonryLevel(intensity);
                else level = 3;
                levelName = ['','一级','二级','三级','四级'][level];

                // 设防类别调整：乙类提高一度（构造措施）
                var constrLevel = level;
                var constrIntensity = intensity;
                if (cat === '乙') {
                    // 构造措施提高一度
                    constrLevel = Math.max(1, level - 1); // 等级数字越小越严
                }
                if (cat === '甲') {
                    constrLevel = Math.max(1, level - 2);
                }
                // 丁类降低一度（但不少于四级）
                if (cat === '丁') {
                    constrLevel = Math.min(4, level + 1);
                }
                var constrName = ['','一级','二级','三级','四级'][constrLevel];

                st.push('<div class="step"><b>④ 抗震等级（GB 50011 表 6.1.2，丙类）</b></div>');
                st.push('<div class="step">　　结构类型：' + structV + '；烈度：' + intensity + ' 度；高度：' + H + ' m ⇒ <b>抗震等级：' + levelName + '</b></div>');
                st.push('<div class="step">　　设防类别 ' + cat + ' 类 ⇒ 构造措施等级：<b>' + constrName + '</b></div>');

                // ⑤ 场地与周期的说明
                st.push('<div class="step"><b>⑤ 设计反应谱说明</b></div>');
                st.push('<div class="step">　　T < 0.1 s 时，α 线性增长；0.1 s ≤ T ≤ T<sub>g</sub> 时，α = α<sub>max</sub>；T > T<sub>g</sub> 时，α = (T<sub>g</sub>/T)<sup>γ</sup>·η₂·α<sub>max</sub></div>');
                st.push('<div class="step">　　阻尼比 0.05 时，γ=0.9，η₂=1.0</div>');

                // ⑥ 材料最低要求（2024修订 3.9.2条）
                st.push('<div class="step"><b>⑥ 材料最低要求（2024修订 3.9.2条）</b></div>');
                st.push('<div class="step">　　<b>混凝土</b>（2024修订提高下限）：</div>');
                st.push('<div class="step">　　　　框支梁、框支柱及抗震等级一、二级框架梁柱节点核芯区：≥ C30</div>');
                st.push('<div class="step">　　　　构造柱、芯柱、圈梁及其他各类构件：≥ <b>C25</b>（2024修订从C20提高）</div>');
                st.push('<div class="step">　　　　混凝土墙体不宜超过 C60；其他构件9度不宜超过C60，8度不宜超过C70</div>');
                st.push('<div class="step">　　<b>钢筋</b>（一、二、三级框架和斜撑含梯段）：</div>');
                st.push('<div class="step">　　　　抗拉强度实测值/屈服强度实测值 ≥ 1.25（强屈比）</div>');
                st.push('<div class="step">　　　　屈服强度实测值/屈服强度标准值 ≤ 1.3（超强比）</div>');
                st.push('<div class="step">　　　　最大拉力下总伸长率 ≥ 9%（带E编号钢筋满足）</div>');
                st.push('<div class="step">　　<b>钢材</b>：屈服强度实测/抗拉强度实测 ≤ 0.85；伸长率 ≥ 20%；有明显屈服台阶</div>');

                var intensName = intensity + ' 度';
                if (intensity === '7.5') intensName = '7 度（0.15g）';
                if (intensity === '8.5') intensName = '8 度（0.30g）';
                var html = resultRow('设防城市', city);
                html += resultRow('抗震设防烈度', intensName);
                html += resultRow('设计基本地震加速度', accel + 'g');
                html += resultRow('设计地震分组', '第 ' + group + ' 组');
                html += resultRow('建筑场地类别', site + ' 类');
                html += resultRow('特征周期 T<sub>g</sub>', Tg.toFixed(2) + ' s');
                html += resultRow('水平地震影响系数 α<sub>max</sub>', alpha_max.toFixed(3) + '（多遇地震）');
                html += resultRow('设防地震 α<sub>max</sub>', alpha_fort.toFixed(2) + '（设防地震，2024修订3.10.3）' + (nearFault !== 'none' ? '（含近场增大）' : ''));
                html += resultRow('罕遇地震 α<sub>max</sub>', alpha_rare.toFixed(2) + '（罕遇地震）');
                html += resultRow('结构类型 / 高度', (function(){var m={frame:'框架结构',fw:'框架-剪力墙',sw:'剪力墙',tube:'筒体', 'frame-bent':'框支剪力墙',masonry:'多层砌体',base:'基础'};return m[structV]||structV;})() + ' / ' + H + ' m');
                html += resultRow('抗震设防类别', cat + ' 类');
                html += resultRow('抗震等级', levelName);
                html += resultRow('构造措施等级', constrName);
                html += resultRow('结果说明', badge('badge-ok', '抗震设防参数已汇总，可用于后续计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._SK_RESULT = { intensity: intensity, accel: accel, Tg: Tg, alpha_max: alpha_max, level: levelName, steps: st.join('') };
            }
            function reset() {
                document.getElementById('sk_city').value = '北京';
                document.getElementById('sk_intensity').value = 8;
                document.getElementById('sk_accel').value = 0.20;
                document.getElementById('sk_group').value = 2;
                document.getElementById('sk_site').value = 'II';
                document.getElementById('sk_struct').value = 'fw';
                document.getElementById('sk_height').value = 60;
                document.getElementById('sk_cat').value = '丙';
                document.getElementById('sk_nearfault').value = 'none';
                fillCity();
                calc();
            }
            document.getElementById('sk_calc').addEventListener('click', calc);
            document.getElementById('sk_reset').addEventListener('click', reset);
            document.getElementById('sk_city').addEventListener('change', function () { fillCity(); calc(); });
            document.getElementById('f-sk').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            fillCity();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['seismic'] = tool;
})();
