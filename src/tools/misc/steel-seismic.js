/* steel-seismic 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '钢结构房屋抗震参数',
        sub: '最大高度 · 高宽比 · 抗震等级 · 板件宽厚比 · 柱长细比 · GB 50011 §8',
        meta: {"standard": "GB/T 50011-2010（2024年版）建筑抗震设计标准", "formulaSource": "8", "limitations": "最大高度/高宽比/抗震等级/长细比/宽厚比/连接系数", "unit": "λ:—, h/tw:—, ηj:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">基本参数</div>' +
                '<form id="f-ss"><div class="grid2">' +
                selField('ss_intensity', '抗震设防烈度', opts([
                    { v: 6, t: '6 度（0.05g）' },
                    { v: 7, t: '7 度（0.10g）' },
                    { v: '7.5', t: '7 度（0.15g）' },
                    { v: 8, t: '8 度（0.20g）' },
                    { v: '8.5', t: '8 度（0.30g）' },
                    { v: 9, t: '9 度（0.40g）' }
                ], 8)) +
                selField('ss_type', '结构类型', opts([
                    { v: 'frame', t: '钢框架' },
                    { v: 'cb', t: '框架-中心支撑' },
                    { v: 'eb', t: '框架-偏心支撑（延性墙板）' },
                    { v: 'tube', t: '筒体（框筒/筒中筒/桁架筒/束筒/巨型框架）' }
                ], 'frame')) +
                numField('ss_H', '房屋高度 H', 'm', 80) +
                selField('ss_grade', '抗震等级', opts([
                    { v: '1', t: '一级' }, { v: '2', t: '二级' }, { v: '3', t: '三级' }, { v: '4', t: '四级' }
                ], '2')) +
                selField('ss_steel', '钢材牌号', opts([
                    { v: 'Q235', t: 'Q235' }, { v: 'Q345', t: 'Q345' }, { v: 'Q345GJ', t: 'Q345GJ' }
                ], 'Q345')) +
                '</div><div class="hint">说明：依据 GB/T 50011-2010（2024年版） 第8章查表确定钢结构房屋最大高度、高宽比、抗震等级、板件宽厚比和柱长细比限值。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ss_calc">查表计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ss_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">查表结果</div><div id="ss_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细说明</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ss_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ss_result');
                var proc = document.getElementById('ss_proc');
                var intensity = document.getElementById('ss_intensity').value;
                var type = document.getElementById('ss_type').value;
                var H = parseFloat(document.getElementById('ss_H').value);
                var grade = document.getElementById('ss_grade').value;
                var steel = document.getElementById('ss_steel').value;
                var st = [];

                // ① 最大高度（表8.1.1）
                var Hmax_table = {
                    'frame': { '6': 110, '7': 90, '7.5': 90, '8': 90, '8.5': 70, '9': 50 },
                    'cb': { '6': 220, '7': 200, '7.5': 180, '8': 180, '8.5': 150, '9': 120 },
                    'eb': { '6': 240, '7': 220, '7.5': 200, '8': 200, '8.5': 180, '9': 160 },
                    'tube': { '6': 300, '7': 280, '7.5': 260, '8': 260, '8.5': 240, '9': 180 }
                };
                var Hmax = Hmax_table[type][intensity];
                var typeNames = { 'frame': '钢框架', 'cb': '框架-中心支撑', 'eb': '框架-偏心支撑', 'tube': '筒体' };

                st.push('<div class="step"><b>① 适用最大高度（表8.1.1）</b></div>');
                st.push('<div class="step">　　结构类型：' + typeNames[type] + '；烈度：' + intensity + '度</div>');
                st.push('<div class="step">　　最大高度限值 = <b>' + Hmax + ' m</b></div>');
                st.push('<div class="step">　　实际高度 ' + H + ' m ' + (H <= Hmax ? '✓ 满足' : '✗ 超限') + '</div>');

                // ② 最大高宽比（表8.1.2）
                var hbr_table = { '6': 6.5, '7': 6.5, '7.5': 6.5, '8': 6.0, '8.5': 6.0, '9': 5.5 };
                var hbr = hbr_table[intensity];
                st.push('<div class="step"><b>② 最大高宽比（表8.1.2）</b></div>');
                st.push('<div class="step">　　最大高宽比限值 = ' + hbr + '</div>');

                // ③ 抗震等级（表8.1.3）
                var gradeTable = {
                    '6': { '<=50': '四级', '>50': '三级' },
                    '7': { '<=50': '四级', '>50': '三级' },
                    '7.5': { '<=50': '四级', '>50': '三级' },
                    '8': { '<=50': '三级', '>50': '二级' },
                    '8.5': { '<=50': '三级', '>50': '二级' },
                    '9': { '<=50': '二级', '>50': '一级' }
                };
                var autoGrade = H <= 50 ? gradeTable[intensity]['<=50'] : gradeTable[intensity]['>50'];
                st.push('<div class="step"><b>③ 抗震等级（表8.1.3）</b></div>');
                st.push('<div class="step">　　高度' + H + 'm → 抗震等级 = ' + autoGrade + '</div>');
                st.push('<div class="step">　　用户选择等级：' + grade + '级</div>');

                // ④ 柱长细比限值（§8.3.1）
                var fy_factor = steel === 'Q235' ? 235 : steel === 'Q345' ? 345 : 345;
                var sqrt_fy = Math.sqrt(fy_factor);
                var lamLimit;
                if (grade === '1') lamLimit = 60 / Math.sqrt(fy_factor / 235);
                else if (grade === '2') lamLimit = 80 / Math.sqrt(fy_factor / 235);
                else if (grade === '3') lamLimit = 100 / Math.sqrt(fy_factor / 235);
                else lamLimit = 120 / Math.sqrt(fy_factor / 235);

                st.push('<div class="step"><b>④ 框架柱长细比限值（§8.3.1）</b></div>');
                st.push('<div class="step">　　' + grade + '级：λ ≤ ' + (grade === '1' ? '60' : grade === '2' ? '80' : grade === '3' ? '100' : '120') + '√(235/f<sub>y</sub>)</div>');
                st.push('<div class="step">　　f<sub>y</sub> = ' + fy_factor + ' MPa → √(235/' + fy_factor + ') = ' + Math.sqrt(235 / fy_factor).toFixed(4) + '</div>');
                st.push('<div class="step">　　<b>长细比限值 λ ≤ ' + lamLimit.toFixed(1) + '</b></div>');

                // ⑤ 板件宽厚比（表8.3.2）
                st.push('<div class="step"><b>⑤ 框架梁柱板件宽厚比限值（表8.3.2）</b></div>');
                var bwt = steel === 'Q235' ? 1.0 : Math.sqrt(235 / fy_factor);
                st.push('<div class="step">　　钢号修正系数 √(235/f<sub>y</sub>) = ' + bwt.toFixed(4) + '</div>');
                if (grade === '1') {
                    st.push('<div class="step">　　<b>柱</b>：工字翼缘外伸≤10, 工字腹板≤43, 箱形壁板≤33（乘' + bwt.toFixed(3) + '）</div>');
                    st.push('<div class="step">　　<b>梁</b>：工字翼缘外伸≤9, 箱形翼缘两腹板间≤30, 腹板≤72-120N/(Af)</div>');
                } else if (grade === '2') {
                    st.push('<div class="step">　　<b>柱</b>：工字翼缘外伸≤11, 工字腹板≤45, 箱形壁板≤36</div>');
                    st.push('<div class="step">　　<b>梁</b>：工字翼缘外伸≤9, 箱形翼缘≤30, 腹板≤72-100N/(Af)</div>');
                } else if (grade === '3') {
                    st.push('<div class="step">　　<b>柱</b>：工字翼缘外伸≤12, 工字腹板≤48, 箱形壁板≤38</div>');
                    st.push('<div class="step">　　<b>梁</b>：工字翼缘外伸≤10, 箱形翼缘≤32, 腹板≤80-110N/(Af)</div>');
                } else {
                    st.push('<div class="step">　　<b>柱</b>：工字翼缘外伸≤13, 工字腹板≤52, 箱形壁板≤40</div>');
                    st.push('<div class="step">　　<b>梁</b>：工字翼缘外伸≤11, 箱形翼缘≤36, 腹板≤85-120N/(Af)</div>');
                }

                // ⑥ 连接系数（表8.2.8）
                st.push('<div class="step"><b>⑥ 连接系数ηj（表8.2.8）</b></div>');
                if (steel === 'Q235') {
                    st.push('<div class="step">　　焊接梁柱: 1.40 | 螺栓梁柱: 1.45 | 焊接拼接: 1.25 | 螺栓拼接: 1.30</div>');
                    st.push('<div class="step">　　柱脚: 埋入式1.2, 外包式1.2, 外露式1.1</div>');
                } else if (steel === 'Q345') {
                    st.push('<div class="step">　　焊接梁柱: 1.30 | 螺栓梁柱: 1.35 | 焊接拼接: 1.20 | 螺栓拼接: 1.25</div>');
                    st.push('<div class="step">　　柱脚: 埋入式1.2, 外包式1.2, 外露式1.1</div>');
                } else {
                    st.push('<div class="step">　　焊接梁柱: 1.25 | 螺栓梁柱: 1.30 | 焊接拼接: 1.15 | 螺栓拼接: 1.20</div>');
                    st.push('<div class="step">　　柱脚: 埋入式1.2, 外包式1.2, 外露式1.1</div>');
                }

                var html = resultRow('最大高度限值', Hmax + ' m ' + (H <= Hmax ? '✓' : '✗超限'));
                html += resultRow('最大高宽比', hbr.toString());
                html += resultRow('抗震等级', autoGrade + '（按高度自动判定）');
                html += resultRow('柱长细比限值', 'λ ≤ ' + lamLimit.toFixed(1));
                html += resultRow('钢材修正系数', '√(235/f<sub>y</sub>) = ' + bwt.toFixed(4));
                html += resultRow('防震缝宽度', '≥ 相应RC结构1.5倍（§8.1.4）');
                html += resultRow('说明', badge('badge-ok', '按GB 50011 §8查表'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('ss_intensity').value = 8;
                document.getElementById('ss_type').value = 'frame';
                document.getElementById('ss_H').value = 80;
                document.getElementById('ss_grade').value = '2';
                document.getElementById('ss_steel').value = 'Q345';
                calc();
            }
            document.getElementById('ss_calc').addEventListener('click', calc);
            document.getElementById('ss_reset').addEventListener('click', reset);
            document.getElementById('f-ss').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['steel-seismic'] = tool;
})();
