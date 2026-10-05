/* pile-horizontal 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '桩基水平承载力',
        sub: '单桩水平承载力特征值 · m 法 · 位移控制 · JGJ 94-2008 第 5.7 条',
        meta: {"standard": "JGJ 94-2008 建筑桩基技术规范", "formulaSource": "5.7", "limitations": "m法，单桩水平承载力特征值", "unit": "Rh:kN, α:1/m, EI:N·mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">桩身与土层参数</div>' +
                '<form id="f-ph"><div class="grid2">' +
                numField('ph_d', '桩径 d', 'mm', 600) +
                numField('ph_L', '桩长 L', 'm', 18) +
                selField('ph_pileType', '桩型', opts([
                    { v: 'bored', t: '灌注桩（钢筋混凝土）' },
                    { v: 'precast', t: '预制桩' },
                    { v: 'pipe', t: '预应力管桩' }
                ], 'bored')) +
                selField('ph_con', '混凝土等级', conOpts('C30')) +
                numField('ph_As', '桩身配筋面积 A<sub>s</sub>', 'mm²', 1131, '沿周边均匀配筋，如 6φ16 = 1206 mm²') +
                selField('ph_reb', '钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                numField('ph_m', '水平抗力系数 m', 'MN/m⁴', 20, '地基土水平抗力系数的比例系数 m，按表 5.7.5 取值，单位 MN/m⁴ = 10³ kN/m⁴') +
                numField('ph_Hk', '桩顶水平力 H<sub>k</sub>', 'kN', 40, '荷载效应标准组合下的桩顶水平力') +
                numField('ph_xAllow', '桩顶允许水平位移 [x₀]', 'mm', 10, '按表 5.7.2-1，建筑桩基水平位移允许值一般 10 mm') +
                selField('ph_pileTop', '桩顶约束', opts([
                    { v: 'free', t: '桩顶自由' },
                    { v: 'hinged', t: '桩顶铰接（承台/梁约束水平）' },
                    { v: 'fixed', t: '桩顶嵌固（刚性承台固结）' }
                ], 'hinged'), '影响水平位移系数 ν_x') +
                '</div><div class="hint">说明：按 m 法计算单桩水平承载力特征值。对钢筋混凝土桩，当桩顶水平位移 ≤ [x₀] 且桩身强度足够时，水平承载力由位移或桩身强度控制。本工具按位移控制法计算 R<sub>ha</sub>，并验算桩身弯曲应力。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ph_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ph_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ph_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ph_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('ph_result'), proc = document.getElementById('ph_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var d = parseFloat(document.getElementById('ph_d').value); // mm
                var L = parseFloat(document.getElementById('ph_L').value); // m
                var conV = document.getElementById('ph_con').value;
                var As = parseFloat(document.getElementById('ph_As').value); // mm²
                var rebV = document.getElementById('ph_reb').value;
                var m_val = parseFloat(document.getElementById('ph_m').value); // MN/m⁴
                var Hk = parseFloat(document.getElementById('ph_Hk').value); // kN
                var xAllow = parseFloat(document.getElementById('ph_xAllow').value); // mm
                var topV = document.getElementById('ph_pileTop').value;
                if (!(d > 0)) return err('桩径必须为正数。');
                if (!(L > 0)) return err('桩长必须为正数。');
                if (!(m_val > 0)) return err('m 系数必须为正数。');
                if (!(Hk > 0)) return err('水平力必须为正数。');
                var con = CONCRETE[conV];
                var Ec = 3.0e4; // MPa, C30 弹性模量近似 (3.0×10^4 MPa = 3.0×10^7 kN/m²)
                if (conV === 'C25') Ec = 2.8e4;
                if (conV === 'C30') Ec = 3.0e4;
                if (conV === 'C35') Ec = 3.15e4;
                if (conV === 'C40') Ec = 3.25e4;
                if (conV === 'C45') Ec = 3.35e4;
                if (conV === 'C50') Ec = 3.45e4;
                var fy = (rebV === 'HRB500') ? 435 : 360; // MPa
                var Es = 2.0e5; // MPa
                var st = [];

                // 桩身抗弯刚度 EI
                // 钢筋混凝土桩 EI ≈ 0.85 E_c I_0 (考虑开裂，取折减系数 0.85, 规范5.7.2)
                var I0 = Math.PI * Math.pow(d, 4) / 64; // mm⁴ 圆截面惯性矩
                var EI = 0.85 * Ec * I0; // N·mm² = MPa·mm⁴ = N/mm²·mm⁴ = N·mm²
                // 换算单位：EI (kN·m²) = EI (N·mm²) / 1e6 / 1e3? 验证:
                // 1 N·mm² = 1e-3 N·m² = 1e-6 kN·m²
                var EI_kNm2 = EI / 1e6 / 1e3 * 1; // 再推导: EI(N·mm²) * (1N = 1e-3 kN) * (1mm² = 1e-6 m²) => kN·m²
                EI_kNm2 = EI * 1e-3 * 1e-6; // 不对: N -> kN 是 /1000, mm² -> m² 是 /1e6, 总共 /1e9
                EI_kNm2 = EI / 1e9; // kN·m²
                st.push('<div class="step"><b>① 桩身抗弯刚度 EI</b>　E<sub>c</sub> = ' + fmt(Ec/1e4,2) + '×10⁴ MPa；I₀ = πd⁴/64 = ' + fmt(I0, 0) + ' mm⁴</div>');
                st.push('<div class="step">　　EI = 0.85·E<sub>c</sub>·I₀ = <b>' + fmt(EI_kNm2, 1) + ' kN·m²</b>（折减系数 0.85，按 5.7.6）</div>');

                // 水平变形系数 α (m^-1)
                // α = (m·b_0 / EI)^(1/5)
                // b0 - 桩的计算宽度 (m)
                var b0; // m
                if (d / 1000 <= 1) b0 = 0.9 * (1.5 * d / 1000 + 0.5); // d ≤ 1m 时: b0 = 0.9*(1.5d + 0.5)
                else b0 = 0.9 * (d / 1000 + 1);
                // m 的单位 MN/m⁴ = 10³ kN/m⁴ = 10^6 N/m⁴
                // α (m^-1) = (m·b0 / EI)^(1/5) 其中 m 单位 N/m⁴, b0 m, EI N·m²
                var m_N = m_val * 1e9; // MN/m⁴ -> N/m⁴? 不对: 1 MN = 1e6 N, 所以 1 MN/m⁴ = 1e6 N/m⁴
                m_N = m_val * 1e6; // N/m⁴
                var alpha = Math.pow(m_N * b0 / (EI_kNm2 * 1000), 1/5); // m⁻¹? 单位: m_N (N/m⁴) * b0 (m) / EI (N·m²) = 1/m³? 不对
                // 正确：α = (m·b_0 / EI)^(1/5)
                // m: N/m⁴, b0: m, EI: N·m²
                // m·b0/EI = (N/m⁴·m) / (N·m²) = 1/m⁵ => α = (1/m⁵)^(1/5) = 1/m ✓
                var EI_Nm2 = EI_kNm2 * 1000; // N·m²
                alpha = Math.pow(m_N * b0 / EI_Nm2, 1 / 5); // m⁻¹
                st.push('<div class="step"><b>② 桩计算宽度 b₀ 与水平变形系数 α（5.7.5）</b>　b₀ = ' + fmt(b0, 3) + ' m；m = ' + m_val + ' MN/m⁴ = ' + fmt(m_val*1e3,0) + ' kN/m⁴</div>');
                st.push('<div class="step">　　α = (m·b₀/EI)^(1/5) = <b>' + fmt(alpha, 4) + ' m⁻¹</b>；换算深度 αh = α·L = ' + fmt(alpha * L, 3) +
                    (alpha * L >= 4.0 ? '（≥4.0，弹性长桩）' : '（< 4.0，有限长桩）') + '</div>');

                // 桩顶水平位移 x0
                // 对铰接桩顶（允许转动无水平位移约束? 题目是承台，桩顶铰接，水平力 H 作用下位移：
                // x_0 = H / (α³ EI) * ν_x
                // ν_x 是桩顶水平位移系数，根据桩顶约束和 αh 查表或公式
                // 近似：铰接桩顶 ν_x ≈ 2.441 (αh=4), 自由桩顶 ν_x ≈ 2.441 (其实类似，因都是剪力静定)
                // 对嵌固桩顶（不能转动），ν_x 更小，约 0.94 (αh=4)
                // 按规范附录 C 表 C.0.2 单桩水平位移系数 ν_x
                var nux;
                var ah = alpha * L;
                if (ah < 2.0) ah = 2.0; // 太短了给个下限
                if (topV === 'free' || topV === 'hinged') {
                    // 桩顶自由/铰接，位移系数 ν_x (H0 作用，自由桩顶)
                    // 规范表 C.0.2: αh=2.4 ν_x=6.962; αh=3.0 ν_x=3.191; αh=4.0 ν_x=2.441
                    // 用近似公式拟合
                    if (ah <= 2.4) nux = 6.962 - (ah - 2.4) / 0.6 * (6.962 - 3.191); // 外插
                    else if (ah <= 3.0) nux = 6.962 - (ah - 2.4) / 0.6 * (6.962 - 3.191);
                    else if (ah <= 4.0) nux = 3.191 - (ah - 3.0) / 1.0 * (3.191 - 2.441);
                    else nux = 2.441 - (ah - 4.0) / 1.0 * (2.441 - 2.4); // 趋于2.4左右
                    if (nux < 2.0) nux = 2.0;
                } else {
                    // 固定桩顶位移系数（限制转动）
                    // αh=4.0 时 ν_x ≈ 0.94
                    if (ah <= 3.0) nux = 1.8;
                    else if (ah <= 4.0) nux = 1.8 - (ah - 3.0) * (1.8 - 0.94);
                    else nux = 0.94;
                    if (nux < 0.5) nux = 0.5;
                }
                var x0_mm = Hk / (Math.pow(alpha, 3) * EI_kNm2) * 1000 * nux; // mm
                // Hk (kN), alpha (m^-1), EI (kN·m²)
                // H / (α³ EI) 单位: kN / (1/m³ · kN·m²) = m
                // * 1000 => mm
                st.push('<div class="step"><b>③ 桩顶水平位移 x₀（m 法）</b>　桩顶约束：' +
                    (topV==='free'?'自由':topV==='hinged'?'铰接':'嵌固') +
                    '；位移系数 ν<sub>x</sub> ≈ ' + fmt(nux, 3) + '（按 αh = ' + fmt(alpha*L,2) + ' 查表近似）</div>');
                st.push('<div class="step">　　x₀ = (H₀ / α³EI) · ν<sub>x</sub> = ' + fmt(Hk,0) + ' / (' + fmt(alpha,4) + '³×' + fmt(EI_kNm2,1) + ') × ' + fmt(nux,3) + ' × 1000 = <b>' + fmt(x0_mm, 2) + ' mm</b></div>');
                var dispOk = x0_mm <= xAllow;
                st.push('<div class="step">　　允许水平位移 [x₀] = ' + xAllow + ' mm ⇒ ' +
                    (dispOk ? '满足' + tag('ok','位移满足') : '不满足' + tag('err','位移超限')) + '</div>');

                // 单桩水平承载力特征值 R_ha (按位移控制)
                // x0 = R_ha / (α³ EI) * ν_x = [x0] => R_ha = α³ EI [x0] / ν_x
                var R_ha = Math.pow(alpha, 3) * EI_kNm2 * (xAllow / 1000) / nux; // kN
                st.push('<div class="step"><b>④ 单桩水平承载力特征值 R<sub>ha</sub>（位移控制）</b>　R<sub>ha</sub> = α³·EI·[x₀] / ν<sub>x</sub> = <b>' + fmt(R_ha, 1) + ' kN</b></div>');

                // 桩身强度验算（最大弯矩 M_max 简化）
                // 最大弯矩 M_max = H / α * ν_M
                // ν_M 为最大弯矩系数。铰接桩顶 ν_M ≈ 0.676（αh=4 时近似）
                var nuM;
                if (topV === 'fixed') nuM = 0.5; // 嵌固
                else nuM = 0.77; // 铰接/自由，最大弯矩在地面以下
                var Mmax = Hk / alpha * nuM; // kN·m
                // 桩身正截面抗弯承载力（简化：按圆形截面均匀配筋估算）
                // 近似：Mu ≈ 0.9 * fy * As * r * sin(π/2)? 太粗略
                // 用简单的方法：用 W 估算 σ_max
                var r = d / 2; // mm
                var W = Math.PI * d * d * d / 32; // mm³, 圆截面截面模量 (受拉边缘)
                // 换算：Mmax (kN·m) = Mmax * 1e6 N·mm
                // σ = M_max / W (MPa), 但需要考虑配筋
                // 简化：按全截面弹性 + 钢筋换算截面估算受拉边缘应力
                // 用更简化的方法：计算钢筋应力 σ_s ≈ M * r / (0.8 * I_0 + α_E * A_s * r² / 2) （粗估）
                var alphaE = Es / Ec;
                var I_trans = I0 * 0.85 + alphaE * As * r * r / 2; // 粗略换算惯性矩
                var sigmaS = Mmax * 1e6 * r / I_trans; // MPa  (M N·mm, r mm, I mm⁴)
                var stressOk = sigmaS <= fy * 0.8; // 特征值工况取 0.8 倍强度近似
                st.push('<div class="step"><b>⑤ 桩身最大弯矩与钢筋应力</b>　M<sub>max</sub> = H₀/α · ν<sub>M</sub> ≈ ' + fmt(Mmax, 2) + ' kN·m</div>');
                st.push('<div class="step">　　钢筋应力 σ<sub>s</sub> ≈ M·r / I<sub>换算</sub> = ' + fmt(sigmaS, 1) + ' MPa（特征值组合下粗估）；f<sub>y</sub> = ' + fy + ' MPa ⇒ ' +
                    (stressOk ? '满足' + tag('ok','强度满足') : '接近/超过' + tag('warn','需复核')) + '</div>');

                var allOk = dispOk && stressOk;
                var html = resultRow('桩身抗弯刚度 EI', fmt(EI_kNm2, 0) + ' kN·m²');
                html += resultRow('水平变形系数 α', fmt(alpha, 4) + ' m⁻¹（αh = ' + fmt(alpha*L, 2) + '）');
                html += resultRow('桩顶水平位移 x₀', fmt(x0_mm, 2) + ' mm / 允许 ' + xAllow + ' mm ' + (dispOk ? tag('ok','满足') : tag('err','超限')));
                html += resultRow('水平承载力特征值 R<sub>ha</sub>', '<span class="highlight">' + fmt(R_ha, 1) + ' kN</span>');
                html += resultRow('作用水平力 H<sub>k</sub>', fmt(Hk, 1) + ' kN ' + (Hk <= R_ha ? tag('ok','≤ R_ha') : tag('err','> R_ha')));
                html += resultRow('判定', badge(allOk && Hk <= R_ha ? 'badge-ok' : 'badge-err', (allOk && Hk <= R_ha) ? '单桩水平承载力满足要求' : '单桩水平承载力不足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._PH_RESULT = { EI: EI_kNm2, alpha: alpha, x0: x0_mm, R_ha: R_ha, Mmax: Mmax, steps: st.join('') };
            }
            function reset() {
                ['ph_d','ph_L','ph_As','ph_m','ph_Hk','ph_xAllow'].forEach(function (id) {
                    var defs = { ph_d:600, ph_L:18, ph_As:1131, ph_m:20, ph_Hk:40, ph_xAllow:10 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('ph_pileType').value = 'bored';
                document.getElementById('ph_con').value = 'C30';
                document.getElementById('ph_reb').value = 'HRB400';
                document.getElementById('ph_pileTop').value = 'hinged';
                calc();
            }
            document.getElementById('ph_calc').addEventListener('click', calc);
            document.getElementById('ph_reset').addEventListener('click', reset);
            document.getElementById('f-ph').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pile-horizontal'] = tool;
})();
