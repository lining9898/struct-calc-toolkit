/* floor-live 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '楼面活荷载查表',
        sub: '民用建筑楼面/屋面均布活荷载 · 组合值/频遇值/准永久值系数 · 折减系数 · GB 50009 §5',
        meta: {"standard": "GB 50009-2012 建筑结构荷载规范", "formulaSource": "5", "limitations": "民用建筑楼面/屋面均布活荷载+折减系数", "unit": "qk:kN/m², ψc,ψq,ψ:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">荷载类别选择</div>' +
                '<form id="f-fl"><div class="grid2">' +
                selField('fl_cat', '荷载类别', opts([
                    { v: 'residential', t: '住宅/宿舍/旅馆/办公楼/病房（2.0kN/m²）' },
                    { v: 'lab', t: '试验室/阅览室/会议室/门诊室（2.0kN/m²）' },
                    { v: 'classroom', t: '教室/食堂/餐厅（2.5kN/m²）' },
                    { v: 'theater', t: '礼堂/剧场/影院（3.0kN/m²）' },
                    { v: 'shop', t: '商店/展览厅/车站/机场大厅（3.5kN/m²）' },
                    { v: 'gym', t: '健身房/演出舞台（4.0kN/m²）' },
                    { v: 'library', t: '书库/档案库（5.0kN/m²）' },
                    { v: 'dense_lib', t: '密集柜书库（12.0kN/m²）' },
                    { v: 'mech_room', t: '通风机房/电梯机房（7.0kN/m²）' },
                    { v: 'garage_single', t: '车库（单向板，客车4.0/消防35.0kN/m²）' },
                    { v: 'garage_double', t: '车库（双向板，客车2.5/消防20.0kN/m²）' },
                    { v: 'kitchen', t: '厨房（餐厅4.0/其他2.0kN/m²）' },
                    { v: 'bathroom', t: '浴室/卫生间/盥洗室（2.5kN/m²）' },
                    { v: 'corridor_res', t: '走廊（住宅/医院2.0kN/m²）' },
                    { v: 'corridor_off', t: '走廊（办公楼/餐厅2.5kN/m²）' },
                    { v: 'corridor_school', t: '走廊（教学楼3.5kN/m²）' },
                    { v: 'stair_res', t: '楼梯（多层住宅2.0kN/m²）' },
                    { v: 'stair_other', t: '楼梯（其他3.5kN/m²）' },
                    { v: 'balcony_crowd', t: '阳台（可能密集3.5kN/m²）' },
                    { v: 'balcony_other', t: '阳台（其他2.5kN/m²）' },
                    { v: 'roof_noaccess', t: '屋面不上人（0.5kN/m²）' },
                    { v: 'roof_access', t: '屋面上人（2.0kN/m²）' },
                    { v: 'roof_garden', t: '屋顶花园（3.0kN/m²）' },
                    { v: 'roof_sport', t: '屋顶运动场地（3.0kN/m²）' }
                ], 'residential')) +
                numField('fl_A', '楼面梁从属面积 A', 'm²', 30, '用于判断是否折减（>25或>50m²时取0.9）') +
                selField('fl_member', '计算构件', opts([
                    { v: 'slab', t: '楼板/屋面板' },
                    { v: 'beam', t: '楼面梁' },
                    { v: 'column', t: '墙/柱/基础' }
                ], 'column')) +
                numField('fl_floors', '墙柱计算截面以上楼层数', '层', 6, '仅墙柱基础折减用') +
                '</div><div class="hint">说明：依据 GB 50009-2012 表5.1.1和表5.3.1查取活荷载标准值及组合值/频遇值/准永久值系数。设计墙柱基础时按楼层折减（表5.1.2）：1层1.00，2层0.85，3层0.70，4层0.65，5层0.60，≥6层0.55。设计楼面梁从属面积超25m²(住宅类)或50m²(其他)时取0.9。不上人屋面可不与雪荷载和风荷载同时组合。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="fl_calc">查表计算</button>' +
                '<button type="button" class="btn btn-secondary" id="fl_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">查表结果</div><div id="fl_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细说明</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="fl_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('fl_result');
                var proc = document.getElementById('fl_proc');
                var cat = document.getElementById('fl_cat').value;
                var A = parseFloat(document.getElementById('fl_A').value);
                var member = document.getElementById('fl_member').value;
                var floors = parseFloat(document.getElementById('fl_floors').value);
                var st = [];

                // 活荷载数据表（表5.1.1 + 表5.3.1）
                var data = {
                    'residential': { q: 2.0, psi_c: 0.7, psi_f: 0.5, psi_q: 0.4, name: '住宅/宿舍/旅馆/办公楼/病房', cat: '5.1.1-1(1)' },
                    'lab': { q: 2.0, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '试验室/阅览室/会议室/门诊', cat: '5.1.1-1(2)' },
                    'classroom': { q: 2.5, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '教室/食堂/餐厅', cat: '5.1.1-2' },
                    'theater': { q: 3.0, psi_c: 0.7, psi_f: 0.5, psi_q: 0.3, name: '礼堂/剧场/影院', cat: '5.1.1-3(1)' },
                    'shop': { q: 3.5, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '商店/展览厅/车站/机场', cat: '5.1.1-4(1)' },
                    'gym': { q: 4.0, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '健身房/演出舞台', cat: '5.1.1-5(1)' },
                    'library': { q: 5.0, psi_c: 0.9, psi_f: 0.9, psi_q: 0.8, name: '书库/档案库', cat: '5.1.1-6(1)' },
                    'dense_lib': { q: 12.0, psi_c: 0.9, psi_f: 0.9, psi_q: 0.8, name: '密集柜书库', cat: '5.1.1-6(2)' },
                    'mech_room': { q: 7.0, psi_c: 0.9, psi_f: 0.9, psi_q: 0.8, name: '通风机房/电梯机房', cat: '5.1.1-7' },
                    'garage_single': { q: 4.0, psi_c: 0.7, psi_f: 0.7, psi_q: 0.6, name: '车库(单向板,客车)', cat: '5.1.1-8(1)客车' },
                    'garage_double': { q: 2.5, psi_c: 0.7, psi_f: 0.7, psi_q: 0.6, name: '车库(双向板,客车)', cat: '5.1.1-8(2)客车' },
                    'kitchen': { q: 4.0, psi_c: 0.7, psi_f: 0.7, psi_q: 0.7, name: '厨房(餐厅)', cat: '5.1.1-9(1)' },
                    'bathroom': { q: 2.5, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '浴室/卫生间', cat: '5.1.1-10' },
                    'corridor_res': { q: 2.0, psi_c: 0.7, psi_f: 0.5, psi_q: 0.4, name: '走廊(住宅/医院)', cat: '5.1.1-11(1)' },
                    'corridor_off': { q: 2.5, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '走廊(办公楼)', cat: '5.1.1-11(2)' },
                    'corridor_school': { q: 3.5, psi_c: 0.7, psi_f: 0.5, psi_q: 0.3, name: '走廊(教学楼)', cat: '5.1.1-11(3)' },
                    'stair_res': { q: 2.0, psi_c: 0.7, psi_f: 0.5, psi_q: 0.4, name: '楼梯(多层住宅)', cat: '5.1.1-12(1)' },
                    'stair_other': { q: 3.5, psi_c: 0.7, psi_f: 0.5, psi_q: 0.3, name: '楼梯(其他)', cat: '5.1.1-12(2)' },
                    'balcony_crowd': { q: 3.5, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '阳台(可能密集)', cat: '5.1.1-13(1)' },
                    'balcony_other': { q: 2.5, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '阳台(其他)', cat: '5.1.1-13(2)' },
                    'roof_noaccess': { q: 0.5, psi_c: 0.7, psi_f: 0.5, psi_q: 0.0, name: '屋面不上人', cat: '5.3.1-1' },
                    'roof_access': { q: 2.0, psi_c: 0.7, psi_f: 0.5, psi_q: 0.4, name: '屋面上人', cat: '5.3.1-2' },
                    'roof_garden': { q: 3.0, psi_c: 0.7, psi_f: 0.6, psi_q: 0.5, name: '屋顶花园', cat: '5.3.1-3' },
                    'roof_sport': { q: 3.0, psi_c: 0.7, psi_f: 0.6, psi_q: 0.4, name: '屋顶运动场地', cat: '5.3.1-4' }
                };

                var d = data[cat];
                st.push('<div class="step"><b>① 活荷载标准值（表' + d.cat + '）</b></div>');
                st.push('<div class="step">　　类别：' + d.name + '</div>');
                st.push('<div class="step">　　标准值 q<sub>k</sub> = <b>' + d.q + ' kN/m²</b></div>');
                st.push('<div class="step">　　组合值系数 ψ<sub>c</sub> = ' + d.psi_c + '</div>');
                st.push('<div class="step">　　频遇值系数 ψ<sub>f</sub> = ' + d.psi_f + '</div>');
                st.push('<div class="step">　　准永久值系数 ψ<sub>q</sub> = ' + d.psi_q + '</div>');

                // ② 折减系数
                var reduction = 1.0;
                var reduction_reason = '无折减';

                if (member === 'beam') {
                    if (cat === 'residential' && A > 25) {
                        reduction = 0.9;
                        reduction_reason = '住宅类从属面积>25m² → 0.9（§5.1.2-1-1）';
                    } else if (A > 50) {
                        reduction = 0.9;
                        reduction_reason = '从属面积>50m² → 0.9（§5.1.2-1-2）';
                    }
                    if (cat === 'garage_single') {
                        reduction = 0.8;
                        reduction_reason = '单向板楼盖梁 → 0.8（§5.1.2-1-3）';
                    }
                } else if (member === 'column') {
                    if (cat === 'residential') {
                        // 表5.1.2 按楼层折减
                        var floorReduction = [1.0, 0.85, 0.70, 0.65, 0.60, 0.55];
                        var idx = Math.min(Math.floor(floors) - 1, 5);
                        idx = Math.max(idx, 0);
                        reduction = floorReduction[idx];
                        reduction_reason = '住宅类按楼层折减：' + floors + '层 → ' + reduction + '（表5.1.2' + (A > 25 ? '，括号内值' : '') + '）';
                    } else if (cat === 'garage_single') {
                        reduction = 0.5;
                        reduction_reason = '单向板车库墙柱 → 0.5（§5.1.2-2-3）';
                    } else {
                        reduction = 0.9;
                        reduction_reason = '其他类别同楼面梁折减 → 0.9（§5.1.2-2-2）';
                    }
                }

                st.push('<div class="step"><b>② 折减系数</b></div>');
                st.push('<div class="step">　　计算构件：' + (member === 'slab' ? '楼板（不折减）' : member === 'beam' ? '楼面梁' : '墙/柱/基础') + '</div>');
                st.push('<div class="step">　　' + reduction_reason + '</div>');
                st.push('<div class="step">　　折减系数 = <b>' + reduction + '</b></div>');

                // ③ 设计值
                var q_design = d.q * reduction;
                st.push('<div class="step"><b>③ 折减后活荷载标准值</b></div>');
                st.push('<div class="step">　　q<sub>k</sub>×折减 = ' + d.q + '×' + reduction + ' = <b>' + q_design.toFixed(2) + ' kN/m²</b></div>');

                // ④ 荷载组合值
                var combo_val = q_design * d.psi_c;
                st.push('<div class="step"><b>④ 组合值</b></div>');
                st.push('<div class="step">　　q<sub>c</sub> = q<sub>k</sub>×ψ<sub>c</sub> = ' + q_design.toFixed(2) + '×' + d.psi_c + ' = <b>' + combo_val.toFixed(2) + ' kN/m²</b></div>');

                var html = resultRow('活荷载标准值 q<sub>k</sub>', d.q + ' kN/m²');
                html += resultRow('ψ<sub>c</sub> / ψ<sub>f</sub> / ψ<sub>q</sub>', d.psi_c + ' / ' + d.psi_f + ' / ' + d.psi_q);
                html += resultRow('折减系数', reduction.toString());
                html += resultRow('折减后标准值', q_design.toFixed(2) + ' kN/m²');
                html += resultRow('组合值', combo_val.toFixed(2) + ' kN/m²');
                html += resultRow('依据条文', '表' + d.cat);
                html += resultRow('说明', badge('badge-ok', '按GB 50009 §5查表'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('fl_cat').value = 'residential';
                document.getElementById('fl_A').value = 30;
                document.getElementById('fl_member').value = 'column';
                document.getElementById('fl_floors').value = 6;
                calc();
            }
            document.getElementById('fl_calc').addEventListener('click', calc);
            document.getElementById('fl_reset').addEventListener('click', reset);
            document.getElementById('f-fl').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['floor-live'] = tool;
})();
