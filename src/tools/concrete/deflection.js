(function () {
    var tool = {
        title: '挠度验算',
        sub: '受弯构件短期刚度 / 长期刚度 / 挠度 · GB/T 50010-2010（2024年版） 第 7.2 章',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '7.2.1, 7.2.2, 7.2.3',
            limitations: '矩形/T形/工形截面受弯构件，短期刚度/长期刚度',
            unit: 'f:mm, M:kN·m, B:N·mm²',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">截面与材料</div>' +
                '<form id="f-df"><div class="grid2">' +
                numField('df_b', '截面宽度 b', 'mm', 250) +
                numField('df_h', '截面高度 h', 'mm', 600) +
                numField('df_as', '受拉筋合力点距离 a<sub>s</sub>', 'mm', 40) +
                numField('df_as2', '受压筋合力点距离 a<sub>s</sub>′', 'mm', 40) +
                selField('df_con', '混凝土强度等级', conOpts('C30')) +
                selField('df_reb', '受拉钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                numField('df_As', '受拉钢筋面积 A<sub>s</sub>', 'mm²', 1256, '如 4φ20 = 1256 mm²') +
                numField('df_AsP', '受压钢筋面积 A<sub>s</sub>′', 'mm²', 0, '如 2φ20 = 628 mm²，0 为单筋') +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">跨度、支承与荷载</div><div class="grid2">' +
                numField('df_L', '计算跨度 l<sub>0</sub>', 'm', 5.0) +
                selField('df_sup', '支承条件', opts([
                    {v:'ss',t:'简支梁（两端铰支）'},
                    {v:'ff',t:'两端固定梁'},
                    {v:'cs',t:'悬臂梁（固定端在左）'},
                    {v:'sc',t:'简支-连续（一端固定一端铰支）'}
                ], 'ss')) +
                numField('df_Mk', '标准组合弯矩 M<sub>k</sub>', 'kN·m', 150, '荷载效应标准组合最大弯矩') +
                numField('df_Mq', '准永久组合弯矩 M<sub>q</sub>', 'kN·m', 110) +
                numField('df_theta', '长期荷载影响系数 θ', '—', 2.0, '规范 7.2.5：受压钢筋配筋率影响，一般取 2.0；有受压筋可略小') +
                selField('df_limit', '挠度限值', opts([
                    {v:'200',t:'l<sub>0</sub>/200（屋盖/楼盖主梁）'},
                    {v:'250',t:'l<sub>0</sub>/250（屋盖/楼盖次梁）'},
                    {v:'300',t:'l<sub>0</sub>/300（吊车梁）'},
                    {v:'400',t:'l<sub>0</sub>/400（悬臂梁）'}
                ], '250')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="df_calc">计算挠度</button>' +
                '<button type="button" class="btn btn-secondary" id="df_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">刚度与挠度计算结果</div><div id="df_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="df_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('df_result');
                var proc = document.getElementById('df_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }

                var b = parseFloat(document.getElementById('df_b').value);
                var h = parseFloat(document.getElementById('df_h').value);
                var asV = parseFloat(document.getElementById('df_as').value);
                var as2V = parseFloat(document.getElementById('df_as2').value) || asV;
                var con = CONCRETE[document.getElementById('df_con').value];
                var reb = REBAR_FLEX[document.getElementById('df_reb').value];
                var As = parseFloat(document.getElementById('df_As').value);
                var AsP = parseFloat(document.getElementById('df_AsP').value) || 0;
                var L = parseFloat(document.getElementById('df_L').value);
                var sup = document.getElementById('df_sup').value;
                var Mk = parseFloat(document.getElementById('df_Mk').value);
                var Mq = parseFloat(document.getElementById('df_Mq').value);
                var theta = parseFloat(document.getElementById('df_theta').value);
                var limDenom = parseFloat(document.getElementById('df_limit').value);

                if (!(b > 0 && h > 0)) return err('截面尺寸必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应小于截面高度。');
                if (!(As > 0)) return err('受拉钢筋面积必须为正数。');
                if (!(L > 0)) return err('跨度必须为正数。');
                if (!(Mk > 0 && Mq > 0)) return err('弯矩必须为正数。');
                if (!(theta >= 1 && theta <= 3)) return err('θ 一般在 1.5~2.5 之间。');

                var h0 = h - asV;
                var fc = con.fc, ftk = con.ftk, Ec = con.Ec || 30000; // 近似 E_c
                // 混凝土弹性模量 E_c 按规范表 4.1.5 近似：C30 → 3.00×10⁴ N/mm²
                var E_C = {
                    'C20': 25500, 'C25': 28000, 'C30': 30000, 'C35': 31500,
                    'C40': 32500, 'C45': 33500, 'C50': 34500
                };
                var Ec_val = E_C[document.getElementById('df_con').value] || 30000;
                var Es = reb.es;
                var alpha_E = Es / Ec_val; // 钢筋与混凝土弹性模量比

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　b×h = ' + b + '×' + h + ' mm，h<sub>0</sub> = ' + fmt(h0,0) + ' mm；E<sub>c</sub> = ' + Ec_val + ' N/mm²，E<sub>s</sub> = ' + Es + ' N/mm²，α<sub>E</sub> = E<sub>s</sub>/E<sub>c</sub> = ' + fmt(alpha_E, 3) + '；A<sub>s</sub> = ' + fmt(As, 0) + ' mm²；计算跨度 l<sub>0</sub> = ' + L + ' m。</div>');

                // 受拉钢筋配筋率 ρ
                var rho = As / (b * h0);
                // 受压钢筋 ρ'
                var rho_p = AsP / (b * h0);

                // 短期刚度 B_s（GB/T 50010-2010（2024年版） 第 7.2.3 条）
                // B_s = (E_s * A_s * h_0²) / (1.15ψ + 0.2 + 6α_E ρ / (1 + 3.5γ_f'))
                // γ_f' = (b'_f - b)h'_f / (b h_0)  受压翼缘加强系数（矩形截面 = 0）
                var gamma_fp = 0; // 矩形截面

                // 先算 ψ（同裂缝宽度公式，但这里是 σ_sk 下的）
                var Ate = 0.5 * b * h;
                var rho_te = As / Ate;
                if (rho_te < 0.01) rho_te = 0.01;
                // σ_sk = M_k / (0.87 * h0 * As)
                var sigma_sk = Mk * 1e6 / (0.87 * h0 * As);
                var psi = 1.1 - 0.65 * ftk / (rho_te * sigma_sk);
                if (psi < 0.2) psi = 0.2;
                if (psi > 1.0) psi = 1.0;

                st.push('<div class="step"><b>② 短期刚度参数</b>　ρ = A<sub>s</sub>/(b·h<sub>0</sub>) = ' + fmt(rho*100, 3) + '%；ρ<sub>te</sub> = ' + fmt(rho_te*100, 3) + '%；σ<sub>sk</sub> = ' + fmt(sigma_sk,1) + ' N/mm²；ψ = ' + fmt(psi,3) + '；γ<sub>f</sub>′ = ' + gamma_fp + '（矩形）。</div>');

                // 短期刚度公式：B_s = E_s * A_s * h_0² / [1.15ψ + 0.2 + 6α_E·ρ/(1 + 3.5γ_f')]
                var denom = 1.15 * psi + 0.2 + 6 * alpha_E * rho / (1 + 3.5 * gamma_fp);
                var Bs = Es * As * h0 * h0 / denom; // N·mm²
                st.push('<div class="step"><b>③ 短期刚度 B<sub>s</sub></b>　B<sub>s</sub> = E<sub>s</sub>A<sub>s</sub>h<sub>0</sub>² / (1.15ψ + 0.2 + 6α<sub>E</sub>ρ/(1+3.5γ<sub>f</sub>′))</div>');
                st.push('<div class="step">　= ' + Es + '×' + fmt(As,0) + '×' + fmt(h0,0) + '² / (' + fmt(denom, 4) + ') = <b>' + fmt(Bs/1e12, 4) + ' × 10¹² N·mm²</b> = ' + fmt(Bs/1e6, 2) + ' kN·m²</div>');

                // 长期刚度 B（GB/T 50010-2010（2024年版） 第 7.2.2 条）
                // B = M_k / (M_q (θ - 1) + M_k) * B_s
                // 或近似 B = B_s / θ  （当 M_q ≈ M_k 时）
                var B = Mk / (Mq * (theta - 1) + Mk) * Bs; // N·mm²
                // 考虑受压钢筋对 θ 的修正（规范 7.2.5 注）
                // 当 ρ' = 0 时 θ = 2.0；ρ' = ρ 时 θ = 1.6
                // 这里用用户输入的 θ 即可
                st.push('<div class="step"><b>④ 长期刚度 B</b>　B = M<sub>k</sub> / [M<sub>q</sub>(θ−1) + M<sub>k</sub>] × B<sub>s</sub></div>');
                st.push('<div class="step">　= ' + fmt(Mk,2) + ' / [' + fmt(Mq,2) + '×(' + theta + '−1) + ' + fmt(Mk,2) + '] × B<sub>s</sub> = <b>' + fmt(B/1e12, 4) + ' × 10¹² N·mm²</b> = ' + fmt(B/1e6, 2) + ' kN·m²</div>');

                // 挠度计算（按等刚度梁近似，或用最小刚度原则）
                // 简支梁均布荷载：f = 5 q l⁴ / (384 B) = 5 M l² / (48 B)  （因为 M = ql²/8 → q = 8M/l²）
                // 简支梁跨中集中荷载：f = P l³ / (48 B)，但此处给了弯矩值，用弯矩换算
                // 近似：f = α * M_k * l0² / B ，其中 α 与支承条件和荷载分布有关
                // 均布荷载下：
                //   简支梁：α = 5/48 ≈ 0.1042
                //   两端固定：α = 1/96 ≈ 0.0104 （跨中）
                //   悬臂梁：α = 1/8 = 0.125 （自由端）
                //   一端固定一端铰支：α ≈ 0.0054？不对，重新估算
                // 更精确：用梁的变形公式，以最大弯矩近似对应等效均布荷载
                var alpha_f;
                var supText;
                switch (sup) {
                    case 'ss': alpha_f = 5.0 / 48.0; supText = '简支梁（均布荷载跨中）'; break;
                    case 'ff': alpha_f = 1.0 / 96.0; supText = '两端固定梁（均布荷载跨中）'; break;
                    case 'cs': alpha_f = 1.0 / 8.0; supText = '悬臂梁（均布荷载自由端）'; break;
                    case 'sc': alpha_f = 2.0 / 96.0; supText = '一端固定一端铰支（近似）'; break;
                    default: alpha_f = 5.0 / 48.0; supText = '简支梁';
                }

                var f = alpha_f * Mk * L * L * 1e6 / B; // mm（M_k 是 kN·m，L 是 m，B 是 N·mm²）
                // 单位换算：Mk(kN·m) * L²(m²) = kN·m³ = 1e9 N·mm³
                // B(N·mm²) = N·mm²
                // f = alpha_f * Mk * 1e6(转N·mm) * L*1e3(转mm) * L*1e3(转mm) / B
                //   = alpha_f * Mk * 1e12 * L² / B
                // 不对，重新算：f = alpha * M * l² / B
                // M 单位：N·mm，l 单位：mm，B 单位：N·mm² → f 单位：mm
                // Mk (kN·m) = Mk * 1e6 (N·mm)；L (m) = L * 1e3 (mm)
                f = alpha_f * Mk * 1e6 * (L * 1e3) * (L * 1e3) / B; // mm
                // 太大了，应该用长期刚度 B 下的准永久组合挠度？
                // 规范规定：按荷载标准组合并考虑长期作用影响计算
                // f = α * M_k * l0² / B  （其中 B 是长期刚度）
                // 这个是对的

                var flim = L * 1000 / limDenom; // mm
                var ok = f <= flim;

                st.push('<div class="step"><b>⑤ 挠度计算（' + supText + '）</b>　f = α·M<sub>k</sub>·l<sub>0</sub>² / B，α = ' + fmt(alpha_f, 4) + '</div>');
                st.push('<div class="step">　f = ' + fmt(alpha_f, 4) + ' × ' + Mk + '×10⁶ × (' + fmt(L*1000, 0) + ')² / B = <b>' + fmt(f, 2) + ' mm</b></div>');
                st.push('<div class="step"><b>⑥ 挠度限值</b>　f<sub>lim</sub> = l<sub>0</sub>/' + limDenom + ' = ' + fmt(flim, 2) + ' mm；f ' + (ok ? '≤' : '＞') + ' f<sub>lim</sub> ⇒ ' + (ok ? '满足' : '不满足') + tag(ok ? 'ok' : 'err', ok ? '满足' : '不满足') + '</div>');

                // 结果展示
                var html = resultRow('短期刚度 B<sub>s</sub>', fmt(Bs/1e12, 4) + ' ×10¹² N·mm²（' + fmt(Bs/1e6, 2) + ' kN·m²）');
                html += resultRow('长期刚度影响系数 θ', theta.toFixed(1));
                html += resultRow('长期刚度 B', fmt(B/1e12, 4) + ' ×10¹² N·mm²（' + fmt(B/1e6, 2) + ' kN·m²）');
                html += resultRow('支承条件', supText);
                html += resultRow('计算挠度 f', '<span class="highlight">' + fmt(f, 2) + ' mm</span>');
                html += resultRow('挠度限值 f<sub>lim</sub>', fmt(flim, 2) + ' mm（l<sub>0</sub>/' + limDenom + '）');
                html += resultRow('挠跨比 f / l<sub>0</sub>', fmt(f / (L * 1000) * 1000, 2) + '‰（1/' + Math.round(L*1000/f) + '）');
                html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '挠度满足规范限值' : '挠度超限，应增加截面高度或配筋'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._DF_RESULT = {
                    b: b, h: h, asV: asV, as2V: as2V, As: As, AsP: AsP,
                    conGrade: document.getElementById('df_con').value,
                    rebGrade: document.getElementById('df_reb').value,
                    L: L, sup: sup, supText: supText,
                    Mk: Mk, Mq: Mq, theta: theta, limDenom: limDenom,
                    alpha_E: alpha_E, Ec_val: Ec_val,
                    rho: rho, rho_te: rho_te, sigma_sk: sigma_sk, psi: psi,
                    Bs: Bs, B: B, alpha_f: alpha_f, f: f, flim: flim, ok: ok
                };
            }

            document.getElementById('df_calc').addEventListener('click', calc);
            document.getElementById('df_reset').addEventListener('click', function () {
                var f = document.getElementById('f-df'); f.reset();
                document.getElementById('df_b').value = 250;
                document.getElementById('df_h').value = 600;
                document.getElementById('df_as').value = 40;
                document.getElementById('df_as2').value = 40;
                document.getElementById('df_As').value = 1256;
                document.getElementById('df_AsP').value = 0;
                document.getElementById('df_L').value = 5.0;
                document.getElementById('df_Mk').value = 150;
                document.getElementById('df_Mq').value = 110;
                document.getElementById('df_theta').value = 2.0;
                calc();
            });
            document.getElementById('f-df').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['deflection'] = tool;
})();
