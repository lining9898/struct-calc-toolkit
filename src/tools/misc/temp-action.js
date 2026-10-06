/* temp-action 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '温度作用计算',
        sub: '均匀温度作用ΔTk · 基本气温 · 线膨胀系数 · 温升/温降工况 · GB 50009 §9',
        meta: {"standard": "GB 50009-2012 建筑结构荷载规范", "formulaSource": "9", "limitations": "均匀温度作用ΔTk，温升/温降", "unit": "ΔTk:℃, α:/℃", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">材料参数</div>' +
                '<form id="f-ta"><div class="grid2">' +
                selField('ta_material', '结构材料', opts([
                    { v: 'concrete', t: '混凝土结构（αT=10×10⁻⁶/°C）' },
                    { v: 'steel', t: '钢结构（αT=12×10⁻⁶/°C）' },
                    { v: 'lightweight', t: '轻骨料混凝土（αT=7×10⁻⁶/°C）' },
                    { v: 'masonry', t: '砌体结构（αT=6~10×10⁻⁶/°C）' },
                    { v: 'aluminum', t: '铝合金结构（αT=24×10⁻⁶/°C）' }
                ], 'concrete')) +
                '</div><div class="panel-title" style="margin-top:14px;">温度参数</div><div class="grid2">' +
                numField('ta_Tsmax', '结构最高平均温度 T<sub>s,max</sub>', '°C', 40, '夏季结构最高平均温度') +
                numField('ta_Tsmin', '结构最低平均温度 T<sub>s,min</sub>', '°C', -5, '冬季结构最低平均温度') +
                numField('ta_T0max', '结构最高初始平均温度 T<sub>0,max</sub>', '°C', 25, '合拢时最高初始温度') +
                numField('ta_T0min', '结构最低初始平均温度 T<sub>0,min</sub>', '°C', 10, '合拢时最低初始温度') +
                numField('ta_L', '结构计算长度 L', 'm', 60, '温度作用方向的结构长度') +
                '</div><div class="hint">说明：依据 GB 50009-2012 §9.3 计算均匀温度作用标准值。温升工况：ΔTk=Ts,max-T0,min；温降工况：ΔTk=Ts,min-T0,max。温度作用组合值系数=0.6，频遇值系数=0.5，准永久值系数=0.4。基本气温采用50年重现期的月平均最高/最低气温。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ta_calc">计算温度作用</button>' +
                '<button type="button" class="btn btn-secondary" id="ta_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ta_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ta_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ta_result');
                var proc = document.getElementById('ta_proc');
                var mat = document.getElementById('ta_material').value;
                var Tsmax = parseFloat(document.getElementById('ta_Tsmax').value);
                var Tsmin = parseFloat(document.getElementById('ta_Tsmin').value);
                var T0max = parseFloat(document.getElementById('ta_T0max').value);
                var T0min = parseFloat(document.getElementById('ta_T0min').value);
                var L = parseFloat(document.getElementById('ta_L').value);
                var st = [];

                // 线膨胀系数（表9.1.2）
                var alphaT_map = {
                    'concrete': 10, 'steel': 12, 'lightweight': 7,
                    'masonry': 8, 'aluminum': 24
                };
                var alphaT = alphaT_map[mat]; // ×10⁻⁶/°C

                st.push('<div class="step"><b>① 材料线膨胀系数 α<sub>T</sub>（表9.1.2）</b></div>');
                st.push('<div class="step">　　材料：' + document.getElementById('ta_material').selectedOptions[0].text + '</div>');
                st.push('<div class="step">　　α<sub>T</sub> = <b>' + alphaT + '×10⁻⁶/°C</b></div>');

                // ② 温升工况（式9.3.1-1）
                var dTk_rise = Tsmax - T0min;
                st.push('<div class="step"><b>② 温升工况 ΔT<sub>k</sub>（式9.3.1-1）</b></div>');
                st.push('<div class="step">　　ΔT<sub>k</sub> = T<sub>s,max</sub> - T<sub>0,min</sub> = ' + Tsmax + ' - ' + T0min + ' = <b>' + dTk_rise + ' °C</b></div>');
                var delta_rise = alphaT * 1e-6 * dTk_rise * L * 1000; // mm
                st.push('<div class="step">　　温升变形 ΔL = α<sub>T</sub>·ΔT<sub>k</sub>·L = ' + alphaT + '×10⁻⁶×' + dTk_rise + '×' + L + '×1000 = <b>' + delta_rise.toFixed(2) + ' mm</b></div>');

                // ③ 温降工况（式9.3.1-2）
                var dTk_drop = Tsmin - T0max;
                st.push('<div class="step"><b>③ 温降工况 ΔT<sub>k</sub>（式9.3.1-2）</b></div>');
                st.push('<div class="step">　　ΔT<sub>k</sub> = T<sub>s,min</sub> - T<sub>0,max</sub> = ' + Tsmin + ' - ' + T0max + ' = <b>' + dTk_drop + ' °C</b></div>');
                var delta_drop = alphaT * 1e-6 * Math.abs(dTk_drop) * L * 1000;
                st.push('<div class="step">　　温降变形 ΔL = α<sub>T</sub>·|ΔT<sub>k</sub>|·L = ' + alphaT + '×10⁻⁶×' + Math.abs(dTk_drop) + '×' + L + '×1000 = <b>' + delta_drop.toFixed(2) + ' mm</b></div>');

                // ④ 组合系数
                st.push('<div class="step"><b>④ 温度作用组合系数（§9.1.3）</b></div>');
                st.push('<div class="step">　　组合值系数 ψ<sub>c</sub> = 0.6</div>');
                st.push('<div class="step">　　频遇值系数 ψ<sub>f</sub> = 0.5</div>');
                st.push('<div class="step">　　准永久值系数 ψ<sub>q</sub> = 0.4</div>');

                // ⑤ 设计值
                var dTk_design = Math.max(Math.abs(dTk_rise), Math.abs(dTk_drop)) * 1.5 * 0.6;
                st.push('<div class="step"><b>⑤ 温度作为伴随作用的折算幅值</b></div>');
                st.push('<div class="step">　　取温升/温降中绝对值较大者</div>');
                var dTk_control = Math.max(Math.abs(dTk_rise), Math.abs(dTk_drop));
                st.push('<div class="step">　　控制温度变化 |ΔT<sub>k</sub>| = ' + dTk_control + ' °C</div>');
                st.push('<div class="step">　　线性分析下伴随温度作用的折算幅值（GB 55001 第3.1.13条；温度为主导时不乘ψc）= ΔT<sub>k</sub>×ψ<sub>c</sub>×γ<sub>Q</sub> = ' + dTk_control + '×0.6×1.5 = ' + (dTk_control * 0.6 * 1.5).toFixed(1) + ' °C</div>');

                var html = resultRow('线膨胀系数 α<sub>T</sub>', alphaT + '×10⁻⁶/°C');
                html += resultRow('温升 ΔT<sub>k</sub>', dTk_rise + ' °C');
                html += resultRow('温升变形 ΔL', delta_rise.toFixed(2) + ' mm');
                html += resultRow('温降 ΔT<sub>k</sub>', dTk_drop + ' °C');
                html += resultRow('温降变形 ΔL', delta_drop.toFixed(2) + ' mm');
                html += resultRow('控制温度变化', dTk_control + ' °C');
                html += resultRow('说明', badge('badge-ok', '按GB 50009 §9计算'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('ta_material').value = 'concrete';
                document.getElementById('ta_Tsmax').value = 40;
                document.getElementById('ta_Tsmin').value = -5;
                document.getElementById('ta_T0max').value = 25;
                document.getElementById('ta_T0min').value = 10;
                document.getElementById('ta_L').value = 60;
                calc();
            }
            document.getElementById('ta_calc').addEventListener('click', calc);
            document.getElementById('ta_reset').addEventListener('click', reset);
            document.getElementById('f-ta').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['temp-action'] = tool;
})();
