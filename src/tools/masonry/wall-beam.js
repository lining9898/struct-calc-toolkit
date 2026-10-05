/* wall-beam 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '墙梁计算',
        sub: '简支墙梁托梁弯矩剪力 · 墙体受剪 · GB 50003-2011 第 7.3 条',
        meta: {"standard": "GB 50003-2011 砌体结构设计规范", "formulaSource": "7.3", "limitations": "简支墙梁，托梁弯矩/剪力系数+墙体受剪", "unit": "M:kN·m, V:kN, αM,βV:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">墙梁几何参数</div>' +
                '<form id="f-wb"><div class="grid2">' +
                numField('wb_L0', '墙梁计算跨度 L₀', 'mm', 6000, '简支墙梁取 1.05L<sub>n</sub> 或 L<sub>c</sub> 较小值') +
                numField('wb_hw', '墙体计算高度 h<sub>w</sub>', 'mm', 3000, '托梁顶面上一层墙体高度') +
                numField('bw', '墙厚 b', 'mm', 240) +
                numField('wb_hb', '托梁截面高度 h<sub>b</sub>', 'mm', 600) +
                numField('wb_bb', '托梁宽度 b<sub>b</sub>', 'mm', 240) +
                selField('wb_type', '砌体类型', opts([
                    { v: 'clay', t: '烧结普通砖 / 多孔砖' },
                    { v: 'block', t: '混凝土小型空心砌块' },
                    { v: 'lime', t: '蒸压灰砂 / 粉煤灰砖' }
                ], 'clay')) +
                selField('wb_mu', '砌块强度等级', opts(MASONRY_TYPES['clay'].unitLabels.map(function (u) { return { v: u, t: u }; }), 'MU20')) +
                selField('wb_mortar', '砂浆强度等级', opts(MASONRY_TYPES['clay'].morLabels.map(function (m) { return { v: m, t: m }; }), 'M7.5')) +
                selField('wb_con', '托梁混凝土等级', conOpts('C30')) +
                selField('wb_reb', '托梁钢筋级别', opts([{v:'HPB300',t:'HPB300'},{v:'HRB400',t:'HRB400'}], 'HRB400')) +
                numField('wb_q1', '托梁顶面荷载 Q1', 'kN/m', 25, '使用阶段托梁顶面以上的荷载设计值（托梁自重 + 本层楼盖）') +
                numField('wb_q2', '墙梁顶面荷载 Q2', 'kN/m', 120, '使用阶段墙梁顶面以上荷载设计值（墙自重 + 以上各层楼盖）') +
                selField('wb_hole', '洞口情况', opts([
                    { v: 'none', t: '无洞口' },
                    { v: 'one', t: '有一个洞口' }
                ], 'none')) +
                '</div><div class="hint">说明：本工具按简支墙梁（有洞口/无洞口）使用阶段正截面和斜截面承载力及墙体受剪承载力验算。弯矩系数 α<sub>M</sub>、剪力系数 β<sub>V</sub> 按 7.3.6 条查表 7.3.6 近似取值。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="wb_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="wb_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="wb_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="wb_proc"></div></div></div></div>';
        },
        bind: function () {
            document.getElementById('wb_type').addEventListener('change', function () {
                var t = this.value, meta = MASONRY_TYPES[t];
                var muSel = document.getElementById('wb_mu');
                muSel.innerHTML = meta.unitLabels.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
                muSel.value = meta.unitLabels[2] || meta.unitLabels[0];
                var morSel = document.getElementById('wb_mortar');
                morSel.innerHTML = meta.morLabels.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
                morSel.value = meta.morLabels[2] || meta.morLabels[0];
                calc();
            });

            function calc() {
                var out = document.getElementById('wb_result'), proc = document.getElementById('wb_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var L0 = parseFloat(document.getElementById('wb_L0').value) / 1000; // m
                var hw = parseFloat(document.getElementById('wb_hw').value) / 1000; // m
                var bw = parseFloat(document.getElementById('bw').value) / 1000; // m
                var hb = parseFloat(document.getElementById('wb_hb').value); // mm
                var bb = parseFloat(document.getElementById('wb_bb').value); // mm
                var typeV = document.getElementById('wb_type').value;
                var muV = document.getElementById('wb_mu').value;
                var morV = document.getElementById('wb_mortar').value;
                var conV = document.getElementById('wb_con').value;
                var rebV = document.getElementById('wb_reb').value;
                var Q1 = parseFloat(document.getElementById('wb_q1').value);
                var Q2 = parseFloat(document.getElementById('wb_q2').value);
                var holeV = document.getElementById('wb_hole').value;
                if (!(L0 > 0 && hw > 0)) return err('跨度和墙高必须为正数。');
                if (!(hb > 0 && bb > 0)) return err('托梁截面尺寸必须为正数。');
                var meta = MASONRY_TYPES[typeV];
                var f = meta.table[muV] ? meta.table[muV][morV] : undefined;
                if (!f) return err('所选砌块与砂浆组合无对应强度值。');
                var con = CONCRETE[conV];
                var fy = (rebV === 'HRB400') ? 360 : 270;
                var fv = MAS_FV_CLAY[morV] || 0.11;
                var st = [];

                // 基本参数
                var h0b = hb - 40; // 托梁有效高度 mm
                var H0 = hw + hb / 1000; // 墙梁计算高度 m (墙高 + 托梁高度的近似)
                st.push('<div class="step"><b>① 基本参数</b>　L₀ = ' + fmt(L0,2) + ' m；h<sub>w</sub> = ' + fmt(hw,2) + ' m；h<sub>b</sub> = ' + fmt(hb,0) + ' mm；' +
                    'h<sub>w</sub>/L₀ = ' + fmt(hw/L0,3) + '（限值 1/2.5 = 0.4，' + (hw/L0 <= 0.4 ? '满足' : '偏大') + '）</div>');

                // 托梁跨中弯矩系数 α_M (表 7.3.6)
                // 无洞口简支墙梁：α_M = ψ_M * (1.7 * hb / L0 - 0.03) ? 不对，正确的表格公式是：
                // 无洞口简支墙梁：
                // α_M = ψ_M (2.7 hb / L0 - 0.08)  对于第 i 跨
                // 这里用简化经验公式：当 h_w/L0 <= 1 时 
                // 弯矩系数 α_M 可近似按表 7.3.6 插值
                // 简化：无洞口时 α_M ≈ 0.25 ~ 0.45
                // 按表 7.3.6 公式：简支墙梁跨中 α_M = ψ_M (1.7 h_b / L_0 - 0.03), ψ_M = 4.5 - 10 a / L_0 (无洞取1.0)
                // 实际 GB 50003-2011 表 7.3.6：
                // 无洞口简支墙梁，第 i 跨 α_Mi = ψ_M (2.7 h_b / L_0i - 0.08), ψ_M = 1.0 (无洞)
                var psi_M = 1.0;
                var alpha_M = psi_M * (2.7 * (hb/1000) / L0 - 0.08);
                if (alpha_M < 0.1) alpha_M = 0.1;
                if (alpha_M > 0.6) alpha_M = 0.6;
                if (holeV === 'one') { alpha_M *= 1.3; } // 有洞口时增大（保守简化）

                // 托梁剪力系数 β_V
                // 无洞口简支墙梁支座 β_V = 0.5 + 12.5 * h_b / L_0 (简化)
                var beta_V = 0.5 + 12.5 * (hb/1000) / L0; // 近似
                if (beta_V < 0.6) beta_V = 0.6;
                if (beta_V > 0.9) beta_V = 0.9;
                if (holeV === 'one') beta_V *= 1.1;

                st.push('<div class="step"><b>② 内力系数（7.3.6 条近似）</b>　' +
                    'α<sub>M</sub> = ' + fmt(alpha_M, 4) + '；β<sub>V</sub> = ' + fmt(beta_V, 4) +
                    (holeV === 'one' ? '（有洞口修正）' : '（无洞口）') + '</div>');

                // 托梁跨中弯矩 M_b = M_1 + α_M * M_2
                var M1 = Q1 * L0 * L0 / 8; // kN·m  托梁荷载产生的跨中弯矩
                var M2 = Q2 * L0 * L0 / 8; // kN·m  墙梁顶面荷载产生的跨中弯矩
                var Mb = M1 + alpha_M * M2;
                st.push('<div class="step"><b>③ 托梁跨中弯矩 M<sub>b</sub>（7.3.6-1）</b>　' +
                    'M₁ = Q₁L₀²/8 = ' + fmt(M1,2) + ' kN·m；' +
                    'M₂ = Q₂L₀²/8 = ' + fmt(M2,2) + ' kN·m；' +
                    'M<sub>b</sub> = M₁ + α<sub>M</sub>·M₂ = ' + fmt(M1,2) + ' + ' + fmt(alpha_M,4) + '×' + fmt(M2,2) + ' = <b>' + fmt(Mb, 2) + ' kN·m</b></div>');

                // 托梁支座剪力 V_b = V_1 + β_V * V_2
                var V1 = Q1 * L0 / 2;
                var V2 = Q2 * L0 / 2;
                var Vb = V1 + beta_V * V2;
                st.push('<div class="step"><b>④ 托梁支座剪力 V<sub>b</sub>（7.3.6-3）</b>　' +
                    'V₁ = Q₁L₀/2 = ' + fmt(V1,2) + ' kN；' +
                    'V₂ = Q₂L₀/2 = ' + fmt(V2,2) + ' kN；' +
                    'V<sub>b</sub> = V₁ + β<sub>V</sub>·V₂ = <b>' + fmt(Vb, 2) + ' kN</b></div>');

                // 托梁正截面配筋
                var fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var es = 200000;
                var xib = b1 / (1 + fy / (es * ecu));
                var alphaS = Mb * 1e6 / (a1 * fc * bb * h0b * h0b);
                if (alphaS > 0.5) alphaS = 0.5;
                var gammaS = (1 + Math.sqrt(1 - 2 * alphaS)) / 2;
                var AsReq = Mb * 1e6 / (fy * gammaS * h0b);
                var xi = 2 * (1 - gammaS);
                var bendOk = xi <= xib;
                // 最小配筋率
                var rhoMin = rhoMinFlex(ft, fy).rho;
                var AsMin = rhoMin * bb * hb;
                var minOk = AsReq >= AsMin;
                st.push('<div class="step"><b>⑤ 托梁正截面配筋</b>　h₀ = ' + fmt(h0b,0) + ' mm；' +
                    'α<sub>s</sub> = ' + fmt(alphaS,4) + '；γ<sub>s</sub> = ' + fmt(gammaS,4) + '；' +
                    'A<sub>s</sub> = M<sub>b</sub>/(γ<sub>s</sub>f<sub>y</sub>h₀) = <b>' + fmt(AsReq, 0) + ' mm²</b> ' +
                    (bendOk ? tag('ok','适筋') : tag('err','超筋')) +
                    '；A<sub>s,min</sub> = ' + fmt(AsMin,0) + ' mm² ' + (minOk ? tag('ok','满足') : tag('err','不足')) + '</div>');

                // 托梁斜截面受剪
                var Vu_beam = 0.7 * ft * bb * h0b / 1000; // kN
                var shearOk = Vb <= Vu_beam;
                st.push('<div class="step"><b>⑥ 托梁斜截面受剪</b>　V<sub>b</sub> = ' + fmt(Vb,2) + ' kN；' +
                    'V<sub>c</sub> = 0.7f<sub>t</sub>bh₀ = ' + fmt(Vu_beam,2) + ' kN ⇒ ' +
                    (shearOk ? '满足' + tag('ok','V≤Vc') : '不满足' + tag('err','V>Vc，需配箍筋')) + '</div>');

                // 墙体受剪承载力（7.3.9）：V_2 <= ξ_1 * ξ_2 * (0.2 + h_b / L_0) * f * h * h_w
                var xi1 = 1.0; // 洞口影响，无洞取 1.0，有洞取 0.9 （简化）
                if (holeV === 'one') xi1 = 0.9;
                var xi2 = 1.0; // 墙厚方向
                // V_wall = ξ1·ξ2·(0.2 + h_b/L_0)·f·h·h_w  (h 为墙厚, h_w 为墙高; 单位统一为 mm => N)
                var Vw_max = xi1 * xi2 * (0.2 + hb/1000/L0) * f * (bw*1000) * (hw*1000) / 1000; // kN
                // 墙梁顶面荷载剪力 V2 = Q2 * L0 / 2
                var V2wall = Q2 * L0 / 2; // kN (墙梁顶面荷载在支座产生的剪力)
                var wallShearOk = V2wall <= Vw_max;
                st.push('<div class="step"><b>⑦ 墙体受剪承载力（7.3.9）</b>　' +
                    'V₂ = Q₂L₀/2 = ' + fmt(V2wall,2) + ' kN；' +
                    'V<sub>u,wall</sub> = ξ₁ξ₂(0.2+h<sub>b</sub>/L₀)f·b·h<sub>w</sub> = ' +
                    xi1 + '×' + xi2 + '×(0.2+' + fmt(hb/1000/L0,4) + ')×' + f + '×' + fmt(bw*1000,0) + '×' + fmt(hw*1000,0) + '/1000 = <b>' + fmt(Vw_max, 2) + ' kN</b> ⇒ ' +
                    (wallShearOk ? '满足' + tag('ok','墙体受剪满足') : '不满足' + tag('err','墙体受剪不足')) + '</div>');

                var allOk = bendOk && minOk && shearOk && wallShearOk;
                var html = resultRow('托梁跨中弯矩 M<sub>b</sub>', fmt(Mb, 2) + ' kN·m');
                html += resultRow('托梁支座剪力 V<sub>b</sub>', fmt(Vb, 2) + ' kN');
                html += resultRow('托梁配筋 A<sub>s</sub>', '<span class="highlight">' + fmt(AsReq, 0) + ' mm²</span>');
                html += resultRow('最小配筋 A<sub>s,min</sub>', fmt(AsMin, 0) + ' mm² ' + (minOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('托梁受剪 V / V<sub>c</sub>', fmt(Vb,2) + ' / ' + fmt(Vu_beam,2) + ' kN ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('墙体受剪 V₂ / V<sub>u</sub>', fmt(V2wall,2) + ' / ' + fmt(Vw_max,2) + ' kN ' + (wallShearOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '墙梁各项验算均满足' : '墙梁验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._WB_RESULT = { Mb: Mb, Vb: Vb, AsReq: AsReq, AsMin: AsMin, Vu_beam: Vu_beam, Vw_max: Vw_max, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['wb_L0','wb_hw','bw','wb_hb','wb_bb','wb_q1','wb_q2'].forEach(function (id) {
                    var defs = { wb_L0:6000, wb_hw:3000, bw:240, wb_hb:600, wb_bb:240, wb_q1:25, wb_q2:120 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('wb_type').value = 'clay';
                document.getElementById('wb_mu').innerHTML = MASONRY_TYPES['clay'].unitLabels.map(function(u){return'<option value="'+u+'">'+u+'</option>'}).join('');
                document.getElementById('wb_mu').value = 'MU20';
                document.getElementById('wb_mortar').innerHTML = MASONRY_TYPES['clay'].morLabels.map(function(m){return'<option value="'+m+'">'+m+'</option>'}).join('');
                document.getElementById('wb_mortar').value = 'M7.5';
                document.getElementById('wb_con').value = 'C30';
                document.getElementById('wb_reb').value = 'HRB400';
                document.getElementById('wb_hole').value = 'none';
                calc();
            }
            document.getElementById('wb_calc').addEventListener('click', calc);
            document.getElementById('wb_reset').addEventListener('click', reset);
            document.getElementById('f-wb').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['wall-beam'] = tool;
})();
