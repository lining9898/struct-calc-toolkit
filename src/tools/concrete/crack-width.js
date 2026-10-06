(function () {
    var tool = {
        title: '裂缝宽度计算',
        sub: '受弯构件最大裂缝宽度 w<sub>max</sub> · GB/T 50010-2010（2024年版） 第 7.1 章',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '7.1.2, 7.1.4',
            limitations: '矩形/T形/工形截面受弯构件，最大裂缝宽度',
            unit: 'wmax:mm, M:kN·m, As:mm²',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">截面与材料</div>' +
                '<form id="f-cw"><div class="grid2">' +
                selField('cw_type', '构件类型', opts([{v:'rect',t:'矩形截面受弯构件'},{v:'tee',t:'T形/I形受弯构件'}], 'rect')) +
                numField('cw_b', '截面宽度 b（腹板宽）', 'mm', 250) +
                numField('cw_h', '截面高度 h', 'mm', 600) +
                numField('cw_bf', '受拉翼缘宽度 b<sub>f</sub>', 'mm', 0, 'T/I形受拉区翼缘宽，矩形填 0') +
                numField('cw_hf', '受拉翼缘高度 h<sub>f</sub>', 'mm', 0, '受拉区翼缘高度，矩形填 0') +
                numField('cw_as', '受拉筋合力点距离 a<sub>s</sub>', 'mm', 40) +
                numField('cw_c', '保护层厚度 c<sub>s</sub>', 'mm', 25, '最外层纵向受拉钢筋外边缘到受拉区底边距离') +
                selField('cw_con', '混凝土强度等级', conOpts('C30')) +
                selField('cw_reb', '钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                numField('cw_dbar', '受拉钢筋直径 d', 'mm', 20) +
                numField('cw_n', '受拉钢筋根数 n', '根', 4) +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">荷载与限值</div><div class="grid2">' +
                numField('cw_Mk', '弯矩标准值 M<sub>k</sub>', 'kN·m', 150, '荷载效应标准组合的弯矩值') +
                numField('cw_Mq', '准永久组合弯矩 M<sub>q</sub>', 'kN·m', 110, '荷载效应准永久组合的弯矩值') +
                selField('cw_env', '环境类别', opts([{v:'a',t:'一类（室内干燥）'},{v:'b',t:'二 a 类（潮湿/室内潮湿）'},{v:'c',t:'二 b 类（干湿交替）'},{v:'d',t:'三 a 类（严寒/海边）'}], 'a'), '影响 α<sub>cr</sub> 系数与限值') +
                numField('cw_wlim', '裂缝宽度限值 w<sub>lim</sub>', 'mm', 0.3, '一类环境一般 0.3mm；二 a 类 0.2mm；预应力 0.2mm') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="cw_calc">计算裂缝宽度</button>' +
                '<button type="button" class="btn btn-secondary" id="cw_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">裂缝宽度计算结果</div><div id="cw_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="cw_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('cw_result');
                var proc = document.getElementById('cw_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }

                var type = document.getElementById('cw_type').value;
                var b = parseFloat(document.getElementById('cw_b').value);
                var h = parseFloat(document.getElementById('cw_h').value);
                var bf = parseFloat(document.getElementById('cw_bf').value) || 0;
                var hf = parseFloat(document.getElementById('cw_hf').value) || 0;
                var asV = parseFloat(document.getElementById('cw_as').value);
                var cs = parseFloat(document.getElementById('cw_c').value);
                var con = CONCRETE[document.getElementById('cw_con').value];
                var reb = REBAR_FLEX[document.getElementById('cw_reb').value];
                var materialError = concreteRebarError(con, reb);
                if (materialError) return err(materialError);
                var dbar = parseFloat(document.getElementById('cw_dbar').value);
                var n = parseFloat(document.getElementById('cw_n').value);
                var Mk = parseFloat(document.getElementById('cw_Mk').value);
                var Mq = parseFloat(document.getElementById('cw_Mq').value);
                var env = document.getElementById('cw_env').value;
                var wlim = parseFloat(document.getElementById('cw_wlim').value);

                if (!(b > 0 && h > 0)) return err('截面尺寸必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应小于截面高度。');
                if (!(cs > 0)) return err('保护层厚度必须为正数。');
                if (!(dbar > 0 && n > 0)) return err('钢筋直径和根数必须为正数。');
                if (!(Mk > 0 && Mq > 0)) return err('弯矩必须为正数。');
                if (!(wlim > 0)) return err('裂缝宽度限值必须为正数。');

                var ft = con.ft, ftk = con.ftk; // 抗拉强度标准值
                var Es = reb.es; // 钢筋弹性模量 MPa = N/mm²
                var h0 = h - asV;
                var As = Math.PI * dbar * dbar / 4 * n; // 受拉钢筋总面积 mm²

                // α_cr 系数：钢筋混凝土受弯构件 = 1.9（一类/二a类）
                // 规范表 7.1.2-1：受弯、偏心受压 1.9；偏心受拉 2.4；轴心受拉 2.7
                var alpha_cr = 1.9;
                // 环境类别影响（规范隐含在 w_lim 中，此处保留 1.9）

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　b = ' + b + ' mm，h = ' + h + ' mm，h<sub>0</sub> = ' + fmt(h0,0) + ' mm；c<sub>s</sub> = ' + cs + ' mm；钢筋 d = ' + dbar + ' mm，n = ' + n + ' 根，A<sub>s</sub> = ' + fmt(As,0) + ' mm²；f<sub>tk</sub> = ' + ftk + ' N/mm²，E<sub>s</sub> = ' + Es + ' N/mm²；α<sub>cr</sub> = ' + alpha_cr + '（受弯构件）。</div>');

                // 有效受拉混凝土截面面积 A_te
                // 对矩形截面：A_te = 0.5 * b * h
                // 对 T/I 形受拉区带翼缘：A_te = 0.5 * b * h + (bf - b) * hf （当 hf 不太大时）
                var Ate;
                if (type === 'rect') {
                    Ate = 0.5 * b * h;
                    st.push('<div class="step"><b>② 有效受拉混凝土截面面积</b>　A<sub>te</sub> = 0.5·b·h = 0.5×' + b + '×' + h + ' = <b>' + fmt(Ate, 0) + ' mm²</b></div>');
                } else {
                    Ate = 0.5 * b * h + (bf - b) * hf;
                    if (Ate < 0.5 * b * h) Ate = 0.5 * b * h;
                    st.push('<div class="step"><b>② 有效受拉混凝土截面面积</b>　A<sub>te</sub> = 0.5·b·h + (b<sub>f</sub>−b)·h<sub>f</sub> = <b>' + fmt(Ate, 0) + ' mm²</b>（T/I 形，含受拉翼缘）</div>');
                }

                // 按有效受拉混凝土截面面积计算的纵向受拉钢筋配筋率 ρ_te
                var rho_te = As / Ate;
                if (rho_te < 0.01) rho_te = 0.01; // 按规范 ρ_te 小于 0.01 时取 0.01
                st.push('<div class="step"><b>③ 有效配筋率 ρ<sub>te</sub></b>　ρ<sub>te</sub> = A<sub>s</sub>/A<sub>te</sub> = ' + fmt(As/Ate*100, 3) + '%；' + (As/Ate < 0.01 ? '小于 0.01，取 ρ<sub>te</sub> = 0.01' : '大于 0.01，按实取用') + ' ⇒ ρ<sub>te</sub> = <b>' + fmt(rho_te*100, 3) + '%</b></div>');

                // 裂缝截面处纵向受拉钢筋应力 σ_sq（按准永久组合）
                // σ_sq = M_q / (0.87 * h0 * As)  （受弯构件）
                var sigma_sq = Mq * 1e6 / (0.87 * h0 * As); // N/mm²
                st.push('<div class="step"><b>④ 裂缝截面钢筋应力 σ<sub>sq</sub></b>　σ<sub>sq</sub> = M<sub>q</sub>/(0.87h<sub>0</sub>A<sub>s</sub>) = ' + fmt(Mq,2) + '×10⁶ / (0.87×' + fmt(h0,0) + '×' + fmt(As,0) + ') = <b>' + fmt(sigma_sq, 1) + ' N/mm²</b></div>');

                // 应变不均匀系数 ψ
                // ψ = 1.1 - 0.65 * f_tk / (ρ_te * σ_sq)
                // 当 ψ < 0.2 时取 0.2；ψ > 1.0 时取 1.0；对直接承受重复荷载的取 1.0
                var psi = 1.1 - 0.65 * ftk / (rho_te * sigma_sq);
                var psi_raw = psi;
                if (psi < 0.2) psi = 0.2;
                if (psi > 1.0) psi = 1.0;
                st.push('<div class="step"><b>⑤ 应变不均匀系数 ψ</b>　ψ = 1.1 − 0.65f<sub>tk</sub>/(ρ<sub>te</sub>·σ<sub>sq</sub>) = 1.1 − 0.65×' + ftk + '/(' + fmt(rho_te*100,3) + '%×' + fmt(sigma_sq,1) + ') = ' + fmt(psi_raw, 3) + '；取 ψ = <b>' + fmt(psi, 3) + '</b>（限值 0.2 ≤ ψ ≤ 1.0）</div>');

                // 纵向受拉钢筋相对粘结特性系数 ν
                // 带肋钢筋 ν = 1.0；光面钢筋 ν = 0.7
                var nu = 1.0; // HRB 系列均为带肋
                // 等效直径 d_eq = Σ n_i * d_i² / Σ n_i * ν_i * d_i
                // 单一直径时 d_eq = d / ν
                var deq = dbar / nu;
                st.push('<div class="step"><b>⑥ 等效直径 d<sub>eq</sub></b>　ν = ' + nu + '（带肋钢筋）；d<sub>eq</sub> = d/ν = ' + dbar + '/' + nu + ' = <b>' + fmt(deq, 1) + ' mm</b></div>');

                // 最大裂缝宽度 w_max = α_cr * ψ * σ_sq / Es * (1.9 * cs + 0.08 * deq / ρ_te)
                var w_max = alpha_cr * psi * sigma_sq / Es * (1.9 * cs + 0.08 * deq / rho_te); // mm
                st.push('<div class="step"><b>⑦ 最大裂缝宽度 w<sub>max</sub></b>　w<sub>max</sub> = α<sub>cr</sub>·ψ·σ<sub>sq</sub>/E<sub>s</sub>·(1.9c<sub>s</sub> + 0.08d<sub>eq</sub>/ρ<sub>te</sub>)</div>');
                st.push('<div class="step">　= ' + alpha_cr + '×' + fmt(psi,3) + '×' + fmt(sigma_sq,1) + '/' + Es + ' × (1.9×' + cs + ' + 0.08×' + fmt(deq,1) + '/' + fmt(rho_te,4) + ')</div>');
                st.push('<div class="step">　= <b>' + fmt(w_max, 4) + ' mm</b></div>');

                var ok = w_max <= wlim;
                st.push('<div class="step"><b>⑧ 判定</b>　w<sub>max</sub> = ' + fmt(w_max, 4) + ' mm ' + (ok ? '≤' : '＞') + ' w<sub>lim</sub> = ' + wlim + ' mm ⇒ ' + (ok ? '满足裂缝宽度要求' : '不满足，应采取措施（增大配筋、减小直径、增加保护层等）') + tag(ok ? 'ok' : 'err', ok ? '满足' : '不满足') + '</div>');

                // 结果展示
                var html = resultRow('有效受拉面积 A<sub>te</sub>', fmt(Ate, 0) + ' mm²');
                html += resultRow('有效配筋率 ρ<sub>te</sub>', fmt(rho_te * 100, 3) + '%（≥ 0.01 按实取，< 0.01 取 0.01）');
                html += resultRow('裂缝截面钢筋应力 σ<sub>sq</sub>', fmt(sigma_sq, 1) + ' N/mm²');
                html += resultRow('应变不均匀系数 ψ', fmt(psi, 3));
                html += resultRow('等效钢筋直径 d<sub>eq</sub>', fmt(deq, 1) + ' mm');
                html += resultRow('最大裂缝宽度 w<sub>max</sub>', '<span class="highlight">' + fmt(w_max, 4) + ' mm</span>');
                html += resultRow('裂缝宽度限值 w<sub>lim</sub>', wlim + ' mm（' + env + ' 类环境）');
                html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '满足裂缝宽度限值要求' : '不满足裂缝宽度限值'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._CW_RESULT = {
                    type: type, b: b, h: h, bf: bf, hf: hf, asV: asV, cs: cs,
                    conGrade: document.getElementById('cw_con').value,
                    rebGrade: document.getElementById('cw_reb').value,
                    dbar: dbar, n: n, As: As, Mk: Mk, Mq: Mq,
                    env: env, wlim: wlim, alpha_cr: alpha_cr,
                    Ate: Ate, rho_te: rho_te, sigma_sq: sigma_sq,
                    psi: psi, psi_raw: psi_raw, nu: nu, deq: deq,
                    w_max: w_max, ok: ok
                };
            }

            document.getElementById('cw_calc').addEventListener('click', calc);
            document.getElementById('cw_reset').addEventListener('click', function () {
                var f = document.getElementById('f-cw'); f.reset();
                document.getElementById('cw_b').value = 250;
                document.getElementById('cw_h').value = 600;
                document.getElementById('cw_as').value = 40;
                document.getElementById('cw_c').value = 25;
                document.getElementById('cw_dbar').value = 20;
                document.getElementById('cw_n').value = 4;
                document.getElementById('cw_Mk').value = 150;
                document.getElementById('cw_Mq').value = 110;
                document.getElementById('cw_wlim').value = 0.3;
                calc();
            });
            document.getElementById('f-cw').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['crack-width'] = tool;
})();
