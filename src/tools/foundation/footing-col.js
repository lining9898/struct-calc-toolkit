(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 建筑地基基础设计规范 + GB/T 50010-2010（2024年版）",
            formulaSource: "5.2, 8.2, 6.2.10",
            limitations: "轴心/偏心受压，柱下独立扩展基础",
            unit: "N:kN, M:kN·m, b,h:mm, fak:kPa",
            version: "1.0.0"
        },
        title: '柱下独立基础计算',
        sub: '轴心/偏心受压 · 地基承载力 + 冲切 + 底板配筋 · GB 50007-2011',
        render: function () {
            return '<div class="panel"><div class="panel-title">上部结构与柱截面</div>' +
                '<form id="f-fc"><div class="grid2">' +
                numField('fc_bc', '柱截面宽度 b<sub>c</sub>', 'mm', 400) +
                numField('fc_hc', '柱截面高度 h<sub>c</sub>', 'mm', 400) +
                numField('fc_Nk', '轴力标准值 N<sub>k</sub>', 'kN', 1200, '上部结构传来的竖向力标准值') +
                numField('fc_N', '轴力设计值 N', 'kN', 1600, '基本组合的竖向力设计值') +
                numField('fc_Mk', '弯矩标准值 M<sub>k</sub>', 'kN·m', 80, '作用在基础顶面的弯矩标准值（0 为轴心受压）') +
                numField('fc_M', '弯矩设计值 M', 'kN·m', 100, '基本组合弯矩设计值（0 为轴心受压）') +
                numField('fc_d', '基础埋深 d', 'm', 1.8, '从室外地面到基础底面的距离') +
                numField('fc_fa', '修正后地基承载力 f<sub>a</sub>', 'kPa', 180, '已深度和宽度修正后的地基承载力特征值') +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">基础与材料</div><div class="grid2">' +
                selField('fc_shape', '基础底面形状', opts([{v:'square',t:'方形（阶梯形/锥形）'},{v:'rect',t:'矩形（长边方向有弯矩）'}], 'square')) +
                numField('fc_B', '基础底面短边 b（平行弯矩方向为长边时取 b）', 'm', 2.4, '方形基础边长；矩形基础短边宽度') +
                numField('fc_L', '基础底面长边 L', 'm', 2.4, '方形基础同 b；矩形基础长边长度（弯矩作用方向）') +
                numField('fc_h', '基础高度 h', 'mm', 600, '锥形基础取边缘高度+坡高，阶梯形取总高') +
                numField('fc_h0', '基础有效高度 h<sub>0</sub>', 'mm', 560, '基础底板有效高度，有垫层取 h−40，无垫层取 h−70') +
                numField('fc_gammaG', '基础及覆土平均重度 γ<sub>G</sub>', 'kN/m³', 20, '基础自重 + 上覆土的加权平均重度，地下水位以下取浮重度') +
                selField('fc_con', '基础混凝土等级', conOpts('C30')) +
                selField('fc_reb', '底板钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="fc_calc">计算独立基础</button>' +
                '<button type="button" class="btn btn-secondary" id="fc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">地基承载力验算</div><div id="fc_soil"></div></div>' +
                '<div class="panel"><div class="panel-title">柱下冲切验算</div><div id="fc_punch"></div></div>' +
                '<div class="panel"><div class="panel-title">底板配筋（两方向）</div><div id="fc_rebar"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="fc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var outSoil = document.getElementById('fc_soil');
                var outPunch = document.getElementById('fc_punch');
                var outRebar = document.getElementById('fc_rebar');
                var proc = document.getElementById('fc_proc');
                function err(m) { outSoil.innerHTML = '<div class="error-box">' + m + '</div>'; outPunch.innerHTML = ''; outRebar.innerHTML = ''; proc.innerHTML = ''; return; }

                var bc = parseFloat(document.getElementById('fc_bc').value);
                var hc = parseFloat(document.getElementById('fc_hc').value);
                var Nk = parseFloat(document.getElementById('fc_Nk').value);
                var N = parseFloat(document.getElementById('fc_N').value);
                var Mk = parseFloat(document.getElementById('fc_Mk').value);
                var M = parseFloat(document.getElementById('fc_M').value);
                var d = parseFloat(document.getElementById('fc_d').value);
                var fa = parseFloat(document.getElementById('fc_fa').value);
                var shape = document.getElementById('fc_shape').value;
                var B = parseFloat(document.getElementById('fc_B').value);
                var L = parseFloat(document.getElementById('fc_L').value);
                var h = parseFloat(document.getElementById('fc_h').value);
                var h0 = parseFloat(document.getElementById('fc_h0').value);
                var gammaG = parseFloat(document.getElementById('fc_gammaG').value);
                var con = CONCRETE[document.getElementById('fc_con').value];
                var reb = REBAR_FLEX[document.getElementById('fc_reb').value];

                if (!(bc > 0 && hc > 0)) return err('柱截面尺寸必须为正数。');
                if (!(Nk > 0 && N > 0)) return err('轴力必须为正数。');
                if (!(d > 0 && fa > 0)) return err('埋深与地基承载力必须为正数。');
                if (!(B > 0 && L > 0 && h > 0 && h0 > 0)) return err('基础尺寸必须为正数。');
                if (h0 >= h) return err('有效高度 h<sub>0</sub> 应小于基础高度 h。');
                if (B > L) return err('短边 b 不应大于长边 L。');

                var ft = con.ft; // 混凝土轴心抗拉强度设计值（冲切用）
                var fc = con.fc;
                var fy = reb.fy;
                var rho_min = Math.max(0.0015, 0.45 * ft / fy); // 基础底板受拉最小配筋率 0.15% —— 与一般受弯构件的 0.20% 不同，此处另有专门规定；
        // 该依据（地基基础类条文）正文尚未取得，2026-09-23 未核对，沿用既有口径，请勿自行替换为 GB 55008 第 4.4.6 条第 2 款。

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　柱截面 b<sub>c</sub>×h<sub>c</sub> = ' + bc + '×' + hc + ' mm；基础底面 b×L = ' + B + '×' + L + ' m；基础高度 h = ' + h + ' mm，h<sub>0</sub> = ' + h0 + ' mm；f<sub>a</sub> = ' + fa + ' kPa；f<sub>t</sub> = ' + ft + ' N/mm²。</div>');

                // ===== 地基承载力验算 =====
                var A = B * L; // 基底面积 m²
                var Gk = gammaG * d * A; // 基础及覆土自重标准值 kN
                var pk = (Nk + Gk) / A; // 基底平均压力标准值 kPa
                var pkmax, pkmin, e;
                var W = B * L * L / 6; // 抗弯截面模量（沿长边 L 方向）m³
                if (Math.abs(Mk) < 0.001) {
                    pkmax = pk; pkmin = pk; e = 0;
                } else {
                    var totalM = Mk + Nk * 0; // 假设弯矩作用在基础顶面，基础自重对基底无偏心
                    e = totalM / (Nk + Gk); // 偏心距 m
                    if (e <= L / 6) {
                        pkmax = pk + totalM / W;
                        pkmin = pk - totalM / W;
                    } else {
                        // 大偏心，基底三角形分布
                        var a = L / 2 - e;
                        pkmax = 2 * (Nk + Gk) / (3 * a * B);
                        pkmin = 0;
                    }
                }

                var soilOk = pk <= fa && pkmax <= 1.2 * fa;
                st.push('<div class="step"><b>② 地基承载力验算</b>　A = b×L = ' + fmt(A,3) + ' m²；G<sub>k</sub> = γ<sub>G</sub>·d·A = ' + fmt(gammaG,1) + '×' + d + '×' + fmt(A,3) + ' = ' + fmt(Gk,1) + ' kN；p<sub>k</sub> = (N<sub>k</sub>+G<sub>k</sub>)/A = ' + fmt(pk,2) + ' kPa' + (soilOk ? tag('ok','满足') : tag('err','不满足')) + '</div>');
                if (Math.abs(Mk) > 0.001) {
                    st.push('<div class="step"><b>　偏心距</b>　e = M<sub>k</sub>/(N<sub>k</sub>+G<sub>k</sub>) = ' + fmt(e,4) + ' m = ' + fmt(e/L*100,2) + '%·L' + (e <= L/6 ? '（小偏心，e ≤ L/6）' : '（大偏心，e > L/6，基底零应力区）') + '；p<sub>kmax</sub> = ' + fmt(pkmax,2) + ' kPa，p<sub>kmin</sub> = ' + fmt(pkmin,2) + ' kPa。</div>');
                    st.push('<div class="step"><b>　承载力要求</b>　p<sub>k</sub> ≤ f<sub>a</sub>（' + (pk <= fa ? '满足' : '不满足') + '）；p<sub>kmax</sub> ≤ 1.2f<sub>a</sub> = ' + fmt(1.2*fa,1) + ' kPa（' + (pkmax <= 1.2*fa ? '满足' : '不满足') + '）。</div>');
                }

                // ===== 柱下冲切验算 =====
                // 按 GB 50007-2011 第 8.2.8 条，柱对基础的冲切
                // 冲切破坏锥体：从柱周边 45° 扩散到基础底
                // F_l ≤ 0.7·β_hp·f_t·a_m·h_0
                // a_m = (a_t + a_b) / 2，a_t = 柱宽 bc（冲切破坏锥体顶面宽度）
                // 沿两个方向分别验算：短边方向和长边方向（弯矩作用方向更危险）
                // 取最不利方向（短边 bc = 冲切柱宽，b_b = bc + 2*h0，若 b_b > B 则取 B）
                var beta_hp = h <= 800 ? 1.0 : (h >= 2000 ? 0.9 : 1.0 - (h - 800) / 1200 * 0.1);
                // 简化：h 在 800~2000 之间线性插值
                if (h > 800 && h < 2000) beta_hp = 1.0 - (h - 800) / 1200 * 0.1;

                var bcm = bc / 1000, hcm = hc / 1000; // m

                // 【净反力：偏心取基础边缘最大净反力（8.2.8 条文 pj 定义）】
                var pj_avg = N / A;                             // 平均净反力，kPa = kN/m²（N 单位 kN，A 单位 m²）
                var pj = pj_avg;
                var e_design = N > 0 ? Math.abs(M) / N : 0;     // 设计值偏心距，m
                var W_base = B * L * L / 6;                     // 基底抵抗矩，m³
                var pjNote = '中心受压，均匀分布';
                if (Math.abs(M) > 0.001) {
                    if (e_design <= L / 6) {
                        pj = pj_avg + Math.abs(M) / W_base;     // 小偏心：线性分布最大净反力
                        pjNote = '小偏心（e=' + fmt(e_design,4) + 'm ≤ L/6），线性分布取最大净反力';
                    } else {
                        var a_base = L / 2 - e_design;          // 大偏心：受压区宽度 a = L/2 - e
                        pj = a_base > 0.001 ? 2 * N / (3 * a_base * B) : pj_avg;  // 大偏心：三角形分布最大净反力
                        pjNote = '大偏心（e=' + fmt(e_design,4) + 'm > L/6），三角形分布取最大净反力';
                    }
                }

                // 【双方向冲切验算（8.2.8-1~3：Fl = pj·Al，Al 取冲切锥体最不利一侧部分基底面积；
                //   at 取柱宽、ab = at + 2h0 ≤ 基础边长）】
                // 方向1：冲切面垂直于 L 方向（柱边 hc）——冲切破坏锥体沿 L 向扩展
                var at1 = hc;                                     // mm
                var ab1 = Math.min(hc + 2 * h0, L * 1000);        // mm
                var am1 = (at1 + ab1) / 2;                        // mm
                var Al1 = Math.max((L - hc / 1000) / 2 - h0 / 1000, 0) * B;  // m²
                var Fl1 = pj * Al1;                               // kN
                var Vup1 = 0.7 * beta_hp * ft * am1 * h0 / 1000;  // kN
                var ok1 = Fl1 <= Vup1;

                // 方向2：冲切面垂直于 B 方向（柱边 bc）——冲切破坏锥体沿 B 向扩展
                var at2 = bc;                                     // mm
                var ab2 = Math.min(bc + 2 * h0, B * 1000);        // mm
                var am2 = (at2 + ab2) / 2;                        // mm
                var Al2 = Math.max((B - bc / 1000) / 2 - h0 / 1000, 0) * L;  // m²
                var Fl2 = pj * Al2;                               // kN
                var Vup2 = 0.7 * beta_hp * ft * am2 * h0 / 1000;  // kN
                var ok2 = Fl2 <= Vup2;

                // 【判定：两方向均须满足。沿用原变量名保持界面与返回对象兼容】
                var Fl_safe = Math.max(Fl1, Fl2);
                var Vup_short = Math.min(Vup1, Vup2);
                var a_m_short = Math.min(am1, am2);
                var punchOk = ok1 && ok2;

                st.push('<div class="step"><b>③ 柱下冲切验算（GB 50007-2011 8.2.8 条）</b>　β<sub>hp</sub> = ' + fmt(beta_hp, 3) + '（h = ' + h + ' mm，' + (h <= 800 ? '≤800mm 取 1.0' : h >= 2000 ? '≥2000mm 取 0.9' : '线性插值') + '）；基底最大净反力 p<sub>j</sub> = <b>' + fmt(pj,1) + ' kPa</b>（' + pjNote + '）。</div>');
                st.push('<div class="step"><b>　方向1（冲切面⊥L，柱边 h<sub>c</sub>=' + hc + 'mm）</b>　a<sub>t</sub>=' + fmt(at1,0) + ' mm，a<sub>b</sub>=' + fmt(ab1,0) + ' mm，a<sub>m</sub>=' + fmt(am1,0) + ' mm；冲切面积 A<sub>l</sub>=' + fmt(Al1,4) + ' m²；F<sub>l</sub>=' + fmt(Fl1,1) + ' kN；F<sub>l,u</sub>=' + fmt(Vup1,1) + ' kN ' + (ok1 ? tag('ok','满足') : tag('err','不满足')) + '。</div>');
                st.push('<div class="step"><b>　方向2（冲切面⊥B，柱边 b<sub>c</sub>=' + bc + 'mm）</b>　a<sub>t</sub>=' + fmt(at2,0) + ' mm，a<sub>b</sub>=' + fmt(ab2,0) + ' mm，a<sub>m</sub>=' + fmt(am2,0) + ' mm；冲切面积 A<sub>l</sub>=' + fmt(Al2,4) + ' m²；F<sub>l</sub>=' + fmt(Fl2,1) + ' kN；F<sub>l,u</sub>=' + fmt(Vup2,1) + ' kN ' + (ok2 ? tag('ok','满足') : tag('err','不满足')) + '。</div>');
                st.push('<div class="step"><b>　综合判定</b>　两方向均须满足：F<sub>l,max</sub>=' + fmt(Fl_safe,1) + ' kN ≤ F<sub>l,u,min</sub>=' + fmt(Vup_short,1) + ' kN ' + (punchOk ? tag('ok','冲切满足') : tag('err','冲切不满足')) + '。</div>');

                // ===== 底板配筋 =====
                // 沿长边 L 方向（x 向）：弯矩在柱边处 M = (1/24) * p_n * (B - bc)^2 * (2L + hc)
                // 这是轴心受压基础，沿短边方向的柱边弯矩公式
                // 对于有弯矩的偏心基础，净反力是梯形分布，此处用最大值近似
                // 简化：用净反力最大值（偏安全）
                var pn_max = N / A; // 平均净反力 kN/m²（设计值），偏心时应取最大净反力
                if (Math.abs(M) > 0.001) {
                    // 净反力最大值（偏心）：p_nmax = N/A + M/W
                    var W_net = B * L * L / 6; // m³
                    pn_max = N / A + Math.abs(M) / W_net;
                }

                // 沿 L 方向（长边方向）的钢筋，配置在底板底部（短跨方向在下）
                // 弯矩公式（轴心）：柱边弯矩 M_I = (p_n / 24) * (L - hc)^2 * (2B + bc)
                // 这是 GB 50007 第 8.2.11 条公式
                var M_L = (pn_max / 24) * (L - hcm) * (L - hcm) * (2 * B + bcm); // kN·m（沿 B 方向的总弯矩，全长）
                var M_B = (pn_max / 24) * (B - bcm) * (B - bcm) * (2 * L + hcm); // kN·m（沿 L 方向的总弯矩）

                st.push('<div class="step"><b>④ 底板弯矩（柱边）</b>　净反力 p<sub>n</sub> = ' + fmt(pn_max,2) + ' kN/m²（设计值）；</div>');
                st.push('<div class="step"><b>　沿长边方向（B 向钢筋）</b>　M<sub>I</sub> = p<sub>n</sub>·(B−b<sub>c</sub>)²·(2L+h<sub>c</sub>)/24 = ' + fmt(M_B,2) + ' kN·m（全宽）；</div>');
                st.push('<div class="step"><b>　沿短边方向（L 向钢筋）</b>　M<sub>II</sub> = p<sub>n</sub>·(L−h<sub>c</sub>)²·(2B+b<sub>c</sub>)/24 = ' + fmt(M_L,2) + ' kN·m（全长）。</div>');

                // 配筋计算
                function calcAs(MkNm, bW, h0v) {
                    var Mabs = MkNm * 1e6; // N·mm
                    var alpha_s = Mabs / (a1 * fc * bW * h0v * h0v);
                    if (alpha_s > 1) return { As: Infinity, over: true, alpha_s: alpha_s, gamma_s: 0 };
                    var gamma_s = 0.5 * (1 + Math.sqrt(1 - 2 * alpha_s));
                    var As = Mabs / (gamma_s * fy * h0v);
                    var xi = 2 * (1 - gamma_s);
                    var over = xi > xi_b;
                    if (over) As = a1 * fc * bW * xi_b * h0v / fy;
                    return { As: As, over: over, alpha_s: alpha_s, gamma_s: gamma_s, xi: xi };
                }

                var a1 = con.alpha1; var b1 = con.beta1; var ecu = con.ecu; var es = reb.es;
                var xi_b = b1 / (1 + fy / (es * ecu));

                var B_mm = B * 1000; // 基础宽度 mm
                var L_mm = L * 1000;
                // 沿 L 方向的钢筋（沿长跨），计算截面宽度 = B（基础全宽），h0 为下层钢筋 h0
                var r_L = calcAs(M_L, B_mm, h0); // As 为全部钢筋总面积 mm²
                // 沿 B 方向的钢筋（沿短跨），h0 = h0 - 10（上层钢筋）
                var h0_short = h0 - 10;
                var r_B = calcAs(M_B, L_mm, h0_short); // 沿 B 向的钢筋总面积

                var AsMin_L = rho_min * B_mm * h; // 沿 L 方向的最小配筋（全截面 b*h, b = B_mm）
                var AsMin_B = rho_min * L_mm * h;

                // 每米配筋面积
                var AsPerM_L = r_L.As / B; // mm²/m（沿 L 方向的钢筋摊到每米 B 上）
                var AsPerM_B = r_B.As / L; // mm²/m
                var perMin_L = AsMin_L / B;
                var perMin_B = AsMin_B / L;

                st.push('<div class="step"><b>⑤ 底板配筋</b>　最小配筋率 ρ<sub>min</sub> = max(0.15%, 0.45f<sub>t</sub>/f<sub>y</sub>) = ' + fmt(rho_min*100,3) + '%；每延米最小配筋 ' + fmt(perMin_L, 0) + ' mm²/m（L 向） / ' + fmt(perMin_B, 0) + ' mm²/m（B 向）。</div>');

                // ===== 结果展示 =====
                var sHtml = resultRow('基底面积 A', fmt(A, 3) + ' m²');
                sHtml += resultRow('基础自重及覆土 G<sub>k</sub>', fmt(Gk, 1) + ' kN');
                sHtml += resultRow('基底平均压力 p<sub>k</sub>', fmt(pk, 2) + ' kPa');
                if (Math.abs(Mk) > 0.001) {
                    sHtml += resultRow('基底最大压力 p<sub>kmax</sub>', fmt(pkmax, 2) + ' kPa');
                    sHtml += resultRow('基底最小压力 p<sub>kmin</sub>', fmt(pkmin, 2) + ' kPa');
                    sHtml += resultRow('偏心距 e / (L/6)', fmt(e, 4) + ' m / ' + fmt(L/6, 4) + ' m');
                }
                sHtml += resultRow('承载力 f<sub>a</sub> / 1.2f<sub>a</sub>', fa + ' / ' + fmt(1.2*fa, 1) + ' kPa');
                sHtml += resultRow('判定', badge(soilOk ? 'badge-ok' : 'badge-err', soilOk ? '地基承载力满足' : '地基承载力不满足'));
                outSoil.innerHTML = sHtml;

                var pHtml = resultRow('基础有效高度 h<sub>0</sub>', h0 + ' mm');
                pHtml += resultRow('冲切高度影响系数 β<sub>hp</sub>', fmt(beta_hp, 3));
                pHtml += resultRow('基底最大净反力 p<sub>j</sub>', fmt(pj, 1) + ' kPa');
                pHtml += resultRow('方向1（⊥L） F<sub>l</sub> / F<sub>l,u</sub>', fmt(Fl1, 1) + ' / ' + fmt(Vup1, 1) + ' kN ' + badge(ok1 ? 'badge-ok' : 'badge-err', ok1 ? '满足' : '不满足'));
                pHtml += resultRow('方向2（⊥B） F<sub>l</sub> / F<sub>l,u</sub>', fmt(Fl2, 1) + ' / ' + fmt(Vup2, 1) + ' kN ' + badge(ok2 ? 'badge-ok' : 'badge-err', ok2 ? '满足' : '不满足'));
                pHtml += resultRow('判定', badge(punchOk ? 'badge-ok' : 'badge-err', punchOk ? '双方向冲切均满足' : '冲切不满足（建议加高基础）'));
                outPunch.innerHTML = pHtml;

                function recSpacingPerM(AsPerM) {
                    var ds = [10, 12, 14, 16, 18, 20, 22, 25];
                    var best = null;
                    for (var i = 0; i < ds.length; i++) {
                        var d = ds[i];
                        var a1 = Math.PI * d * d / 4;
                        var s = a1 / AsPerM * 1000;
                        if (s >= 100 && s <= 250) {
                            if (!best || s < best.s) best = { d: d, s: s, a: a1 };
                        }
                    }
                    if (!best) return '—';
                    return 'φ' + best.d + '@' + Math.round(best.s) + ' = ' + fmt(1000/best.s * best.a, 0) + ' mm²/m';
                }
                function row2(loc, M, AsTotal, AsPerM, minPerM, over) {
                    var ok = over ? 'err' : (AsPerM >= minPerM ? 'ok' : 'warn');
                    var txt = over ? '超筋' : (AsPerM >= minPerM ? '满足' : '配筋不足');
                    var cls = ok === 'ok' ? 'badge-ok' : ok === 'err' ? 'badge-err' : 'badge-warn';
                    return '<tr><td>' + loc + '</td><td>' + fmt(M, 2) + '</td>' +
                        '<td>' + (over ? '超筋' : fmt(AsTotal, 0)) + '</td>' +
                        '<td style="font-weight:600;color:#2563eb;">' + (over ? '超筋' : fmt(AsPerM, 0)) + '</td>' +
                        '<td>' + fmt(minPerM, 0) + '</td>' +
                        '<td>' + badge(cls, txt) + '</td>' +
                        '<td>' + (over ? '—' : recSpacingPerM(AsPerM)) + '</td></tr>';
                }
                var rHtml = '<div style="overflow-x:auto;"><table class="mini"><tr><th>方向</th><th>柱边弯矩 M (kN·m)</th><th>总面积 A<sub>s</sub> (mm²)</th><th>每延米 A<sub>s</sub> (mm²/m)</th><th>最小 A<sub>s,min</sub> (mm²/m)</th><th>判定</th><th>推荐配筋</th></tr>';
                rHtml += row2('沿短边（B 向，下层）', M_B, r_B.As, AsPerM_B, perMin_B, r_B.over);
                rHtml += row2('沿长边（L 向，上层）', M_L, r_L.As, AsPerM_L, perMin_L, r_L.over);
                rHtml += '</table></div>';
                rHtml += '<div style="margin-top:8px;font-size:12.5px;color:#64748b;">沿短边方向（弯矩较大方向）的钢筋放在下层，h<sub>0</sub> 较大；沿长边方向的钢筋放在上层，h<sub>0</sub> 小 10mm（近似一个钢筋直径）。</div>';
                outRebar.innerHTML = rHtml;

                proc.innerHTML = st.join('');
                var _pp = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_pp) _pp.classList.add('open');

                window._FC_RESULT = {
                    bc: bc, hc: hc, Nk: Nk, N: N, Mk: Mk, M: M,
                    d: d, fa: fa, shape: shape, B: B, L: L, h: h, h0: h0,
                    gammaG: gammaG, A: A, Gk: Gk, pk: pk, pkmax: pkmax, pkmin: pkmin, e: e,
                    soilOk: soilOk, beta_hp: beta_hp, Vup_short: Vup_short, Fl_safe: Fl_safe,
                    punchOk: punchOk, pn_max: pn_max, M_L: M_L, M_B: M_B,
                    r_L: r_L, r_B: r_B, AsPerM_L: AsPerM_L, AsPerM_B: AsPerM_B,
                    rho_min: rho_min,
                    conGrade: document.getElementById('fc_con').value,
                    rebGrade: document.getElementById('fc_reb').value
                };
            }

            document.getElementById('fc_calc').addEventListener('click', calc);
            document.getElementById('fc_reset').addEventListener('click', function () {
                var f = document.getElementById('f-fc'); f.reset();
                document.getElementById('fc_bc').value = 400;
                document.getElementById('fc_hc').value = 400;
                document.getElementById('fc_Nk').value = 1200;
                document.getElementById('fc_N').value = 1600;
                document.getElementById('fc_Mk').value = 80;
                document.getElementById('fc_M').value = 100;
                document.getElementById('fc_d').value = 1.8;
                document.getElementById('fc_fa').value = 180;
                document.getElementById('fc_B').value = 2.4;
                document.getElementById('fc_L').value = 2.4;
                document.getElementById('fc_h').value = 600;
                document.getElementById('fc_h0').value = 560;
                calc();
            });
            document.getElementById('f-fc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['footing-col'] = tool;
})();
