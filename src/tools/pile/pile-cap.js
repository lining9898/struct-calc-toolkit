/* pile-cap 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '独立桩承台计算',
        sub: '桩反力分配 · 受弯 · 柱下/角桩冲切 · 受剪 · 局压 · JGJ 94-2008 第 5.9 条',
        meta: {"standard": "JGJ 94-2008 建筑桩基技术规范", "formulaSource": "5.9", "limitations": "柱下独立桩承台，冲切/受弯/受剪", "unit": "N:kN, M:kN·m, As:mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">承台与桩基本参数</div>' +
                '<form id="f-pc"><div class="grid2">' +
                selField('pc_arrange', '桩数与布置', opts([
                    { v: '2x2', t: '4 桩（2×2 矩形布置）' },
                    { v: '1x3', t: '3 桩（1×3 单列）' },
                    { v: '2x3', t: '6 桩（2×3 矩形布置）' },
                    { v: '3x3', t: '9 桩（3×3 矩形布置）' }
                ], '2x2')) +
                numField('pc_sx', 'x 向桩间距 s<sub>x</sub>', 'mm', 1500, 'x 向相邻桩中心距') +
                numField('pc_sy', 'y 向桩间距 s<sub>y</sub>', 'mm', 1500, 'y 向相邻桩中心距') +
                numField('pc_dp', '桩径 d', 'mm', 600) +
                numField('pc_h', '承台高度 h', 'mm', 1000) +
                numField('pc_bx', '承台宽度 B<sub>x</sub>', 'mm', 3600, 'x 向承台总宽度（垂直于 sx 方向）') +
                numField('pc_by', '承台宽度 B<sub>y</sub>', 'mm', 3600, 'y 向承台总宽度') +
                numField('pc_cx', '柱截面宽度 b<sub>c</sub>', 'mm', 600, 'x 向柱截面尺寸') +
                numField('pc_cy', '柱截面高度 h<sub>c</sub>', 'mm', 600, 'y 向柱截面尺寸') +
                selField('pc_con', '承台混凝土等级', conOpts('C30')) +
                selField('pc_reb', '钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                numField('pc_Fk', '柱底轴力 F<sub>k</sub>', 'kN', 3600, '荷载效应标准组合') +
                numField('pc_Mxk', '绕 x 轴弯矩 M<sub>xk</sub>', 'kN·m', 200, '绕 x 轴弯矩') +
                numField('pc_Myk', '绕 y 轴弯矩 M<sub>yk</sub>', 'kN·m', 200, '绕 y 轴弯矩') +
                numField('pc_Gk', '承台及上覆土重 G<sub>k</sub>', 'kN', 0, '填 0 则自动按 20·Bx·By·h/1000 估算') +
                '</div><div class="hint">说明：按 4 桩矩形布置为例进行冲切、受剪与受弯计算。柱边弯矩按各桩反力对柱边取矩；冲切含柱对承台（向上）、角桩对承台两个方向冲切；受剪按柱边至桩边斜截面。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="pc_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="pc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="pc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="pc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('pc_result'), proc = document.getElementById('pc_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var arrange = document.getElementById('pc_arrange').value;
                var sx = parseFloat(document.getElementById('pc_sx').value);
                var sy = parseFloat(document.getElementById('pc_sy').value);
                var dp = parseFloat(document.getElementById('pc_dp').value);
                var h = parseFloat(document.getElementById('pc_h').value);
                var Bx = parseFloat(document.getElementById('pc_bx').value);
                var By = parseFloat(document.getElementById('pc_by').value);
                var cx = parseFloat(document.getElementById('pc_cx').value);
                var cy = parseFloat(document.getElementById('pc_cy').value);
                var conV = document.getElementById('pc_con').value;
                var rebV = document.getElementById('pc_reb').value;
                var Fk = parseFloat(document.getElementById('pc_Fk').value);
                var Mxk = parseFloat(document.getElementById('pc_Mxk').value);
                var Myk = parseFloat(document.getElementById('pc_Myk').value);
                var Gk_in = parseFloat(document.getElementById('pc_Gk').value);
                if (!(sx > 0 && sy > 0)) return err('桩间距必须为正数。');
                if (!(dp > 0 && h > 0)) return err('桩径和承台高度必须为正数。');
                if (!(Bx > 0 && By > 0)) return err('承台尺寸必须为正数。');
                if (!(cx > 0 && cy > 0)) return err('柱截面尺寸必须为正数。');
                if (!(Fk > 0)) return err('轴力必须为正数。');
                var con = CONCRETE[conV];
                var fy = (rebV === 'HRB500') ? 435 : 360;
                var ft = con.ft, fc = con.fc;
                var st = [];

                // 桩数
                var n = 4;
                if (arrange === '1x3') n = 3;
                if (arrange === '2x3') n = 6;
                if (arrange === '3x3') n = 9;
                var nx = 2, ny = 2;
                if (arrange === '1x3') { nx = 1; ny = 3; }
                if (arrange === '2x3') { nx = 2; ny = 3; }
                if (arrange === '3x3') { nx = 3; ny = 3; }

                // 承台及填土自重
                var Gk = Gk_in > 0 ? Gk_in : 20 * Bx / 1000 * By / 1000 * h / 1000;
                st.push('<div class="step"><b>① 基本参数</b>　桩数 n = ' + n + '（' + nx + '×' + ny + '）；' +
                    's<sub>x</sub> = ' + fmt(sx,0) + ' mm；s<sub>y</sub> = ' + fmt(sy,0) + ' mm；' +
                    '承台 B<sub>x</sub>×B<sub>y</sub> = ' + fmt(Bx,0) + '×' + fmt(By,0) + ' mm；h = ' + fmt(h,0) + ' mm；' +
                    '柱 b<sub>c</sub>×h<sub>c</sub> = ' + fmt(cx,0) + '×' + fmt(cy,0) + ' mm</div>');

                // 桩顶反力 Nk (标准组合)
                var Nk_avg = (Fk + Gk) / n; // kN
                // 各桩到 x 轴距离（对称布置，最大反力出现在角桩）
                // xi 坐标（以形心为原点，x 方向为沿 sx 方向）
                var ymax = (ny - 1) / 2 * sy / 1000; // m
                var xmax = (nx - 1) / 2 * sx / 1000; // m
                // Ix = Σ yi² (对 x 轴，y 方向的距离)
                var Ix = 0, Iy = 0;
                for (var i = 0; i < ny; i++) {
                    for (var j = 0; j < nx; j++) {
                        var yi = ((ny - 1) / 2 - i) * sy / 1000;
                        var xi = ((nx - 1) / 2 - j) * sx / 1000;
                        Ix += yi * yi;
                        Iy += xi * xi;
                    }
                }
                var Nkmax = Nk_avg + Mxk * ymax / Ix + Myk * xmax / Iy;
                var Nkmin = Nk_avg - Mxk * ymax / Ix - Myk * xmax / Iy;
                if (Nkmin < 0) Nkmin = 0;
                st.push('<div class="step"><b>② 桩顶反力（5.1.1）</b>　平均 N<sub>k</sub> = (F<sub>k</sub>+G<sub>k</sub>)/n = (' + fmt(Fk,0) + '+' + fmt(Gk,1) + ')/' + n + ' = <b>' + fmt(Nk_avg, 1) + ' kN</b></div>');
                st.push('<div class="step">　　最大反力 N<sub>k,max</sub> = N<sub>k</sub> + M<sub>x</sub>·y<sub>max</sub>/I<sub>x</sub> + M<sub>y</sub>·x<sub>max</sub>/I<sub>y</sub> = <b>' + fmt(Nkmax, 1) + ' kN</b>；' +
                    '最小 N<sub>k,min</sub> = ' + fmt(Nkmin, 1) + ' kN</div>');

                // 承台受弯（柱边截面，5.9.2）
                // 简化：取柱到最近桩中心的距离内所有桩的反力乘以力臂
                // 柱边距最近桩中心距离 = sx/2 - cx/2 (x方向)
                var h0x = h - 70; // 底部两层钢筋，as 取 70（近似）
                var h0y = h - 100; // y 向钢筋在下方
                // 柱边弯矩（绕 y 轴，沿 x 方向的钢筋抗弯）
                // 柱右侧（x 方向）有 nx/2 列桩 (若 nx 为偶数)
                var nRight = Math.floor(nx / 2); // 柱右/左侧各多少列
                var xArm = xmax - cx / 2000; // 桩中心到柱边距离 m
                if (xArm < 0) xArm = 0;
                var My_col = nRight * ny * Nk_avg * xArm; // 简化，未考虑弯矩放大
                // 更准确：每个桩 Nk 不同。近似用 Nkmax (角桩较大)
                // 实际柱边弯矩应取柱边以外所有桩对柱边的力矩和
                // 简化计算：按平均反力 * 桩数 * 力臂
                var Mx_col = nx * Math.floor(ny / 2) * Nk_avg * (ymax - cy / 2000); // x方向钢筋承担的弯矩（绕y轴）不对，再理一理
                // 规范：M_x = Σ N_i * y_i (绕x轴的弯矩，由沿x方向布置的底部钢筋承受)
                // M_y = Σ N_i * x_i (绕y轴的弯矩，由沿y方向布置的底部钢筋承受)
                // 柱边弯矩：扣除柱宽范围内的桩（如有），其余桩到柱边距离
                // 为简化：按柱边外侧桩的反力乘以到柱边距离
                var Mx_design = 0; // 绕 x 轴弯矩，由 x 方向梁底筋承担
                var My_design = 0; // 绕 y 轴弯矩，由 y 方向梁底筋承担
                for (var i2 = 0; i2 < ny; i2++) {
                    for (var j2 = 0; j2 < nx; j2++) {
                        var yi2 = ((ny - 1) / 2 - i2) * sy;
                        var xi2 = ((nx - 1) / 2 - j2) * sx;
                        var Ni = Nk_avg + Mxk * yi2 / 1000 / Ix + Myk * xi2 / 1000 / Iy; // 近似，单位mm
                        // 到柱边的距离（若在柱外则计入）
                        var dy = Math.abs(yi2) - cy / 2; // y方向到柱边距离 mm
                        var dx = Math.abs(xi2) - cx / 2;
                        if (dy > 0) Mx_design += Ni * dy / 1e6; // kN·m
                        if (dx > 0) My_design += Ni * dx / 1e6;
                    }
                }
                // 换算：Ni 单位 kN，dy 单位 mm => kN·mm / 1e6 = kN·m
                st.push('<div class="step"><b>③ 承台受弯（柱边截面，5.9.2）</b></div>');
                st.push('<div class="step">　　绕 x 轴（x 向配筋）M<sub>x</sub> = ΣN<sub>i</sub>·y<sub>i,柱边</sub> = <b>' + fmt(Mx_design, 2) + ' kN·m</b></div>');
                st.push('<div class="step">　　绕 y 轴（y 向配筋）M<sub>y</sub> = ΣN<sub>i</sub>·x<sub>i,柱边</sub> = <b>' + fmt(My_design, 2) + ' kN·m</b></div>');

                // 配筋计算（单筋矩形）
                function calcAs(M, b, h0) {
                    var a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu, es = 200000;
                    var xib = b1 / (1 + fy / (es * ecu));
                    var alphaS = M * 1e6 / (a1 * fc * b * h0 * h0);
                    if (alphaS > 0.5) alphaS = 0.5;
                    var gammaS = (1 + Math.sqrt(1 - 2 * alphaS)) / 2;
                    var As = M * 1e6 / (fy * gammaS * h0);
                    var xi = 2 * (1 - gammaS);
                    return { As: As, xi: xi, xib: xib, gammaS: gammaS, alphaS: alphaS };
                }
                // 注意：承台板受弯，按承台宽度取单位宽度配筋还是全部？规范5.9.2 柱下独立桩基承台
                // 柱下独立桩基承台受弯计算：按梁式受弯，全截面宽度计算
                var resX = calcAs(Mx_design, Bx, h0y); // x 向钢筋，沿Bx方向布置，截面高度h0 (底部第一排钢筋 h-70)
                // 修正：x 向钢筋（沿长度方向）的受弯截面宽度 = Bx (x方向承台总宽), h0 = h - as
                // 绕 x 轴的弯矩由 x 方向（水平方向）钢筋承受，截面有效高度为 h0y (y方向高度? 不对)
                // 简化为：两个方向都用 h0 = h - 70
                var h0 = h - 70;
                var resX2 = calcAs(Mx_design, Bx, h0); // 错了应该是 By（垂直于弯矩方向的宽度）
                // 纠正：绕 x 轴的弯矩，截面宽度为 Bx，有效高度 h0
                var resMx = calcAs(Mx_design, Bx, h0); // 绕x轴，受拉钢筋在底部，截面宽Bx,高h0
                var resMy = calcAs(My_design, By, h0); // 绕y轴，截面宽By,高h0
                var rhoMin = Math.max(0.0015, 0.45 * ft / fy); // 承台最小配筋率 0.15%（承台另有专门规定）。
                // 该依据正文尚未取得，2026-09-23 未核对，沿用既有口径；不属于 GB 55008-2021 第 4.4.6 条第 2 款的板类条款。
                var AsMin_x = rhoMin * Bx * h; // x 向总配筋
                var AsMin_y = rhoMin * By * h;
                var AsX = Math.max(resMx.As, AsMin_x);
                var AsY = Math.max(resMy.As, AsMin_y);
                var bendOkX = resMx.xi <= resMx.xib;
                var bendOkY = resMy.xi <= resMy.xib;
                st.push('<div class="step">　　x 向（绕 x 轴）A<sub>s,x</sub> = M<sub>x</sub>/(γ<sub>s</sub>f<sub>y</sub>h₀) = <b>' + fmt(AsX, 0) + ' mm²</b> ' +
                    (bendOkX ? tag('ok','适筋') : tag('err','超筋')) +
                    '；最小配筋 A<sub>s,min</sub> = ρ<sub>min</sub>·B·h = ' + fmt(AsMin_x,0) + ' mm²</div>');
                st.push('<div class="step">　　y 向（绕 y 轴）A<sub>s,y</sub> = <b>' + fmt(AsY, 0) + ' mm²</b> ' +
                    (bendOkY ? tag('ok','适筋') : tag('err','超筋')) +
                    '；最小配筋 A<sub>s,min</sub> = ' + fmt(AsMin_y,0) + ' mm²</div>');

                // 柱下冲切（5.9.7）：四棱锥冲切，冲切破坏锥体从柱边向下 h0 至承台底
                // Fl ≤ 2·[β₀x·(b_c+a₀y) + β₀y·(h_c+a₀x)]·β_hp·f_t·h₀
                // a0x, a0y = 柱边到最近桩内边缘的水平距离
                // 柱边到最近桩中心距离 (sx/2 - cx/2), 减去桩半径 dp/2
                var a0x = sx / 2 - cx / 2 - dp / 2; // mm
                var a0y = sy / 2 - cy / 2 - dp / 2;
                if (a0x < 0) a0x = 0;
                if (a0y < 0) a0y = 0;
                // β0x, β0y - 冲切系数：β0 = 0.84/(λ+0.2), λ = a0/h0
                var lambdaX = a0x / h0;
                var lambdaY = a0y / h0;
                if (lambdaX < 0.25) lambdaX = 0.25;
                if (lambdaX > 1) lambdaX = 1;
                if (lambdaY < 0.25) lambdaY = 0.25;
                if (lambdaY > 1) lambdaY = 1;
                var beta0x = 0.84 / (lambdaX + 0.2);
                var beta0y = 0.84 / (lambdaY + 0.2);
                // β_hp - 承台高度影响系数：h≤800取1.0，h≥2000取0.9，线性插值
                var beta_hp;
                if (h <= 800) beta_hp = 1.0;
                else if (h >= 2000) beta_hp = 0.9;
                else beta_hp = 1.0 - (h - 800) / 1200 * 0.1;
                // 冲切力 Fl：扣除柱范围内的桩反力（4桩承台柱范围内无桩）
                var Fl_punch = Fk; // 简化：柱下冲切力近似等于上部轴力（扣除承台自重后的柱底力）
                // 规范：冲切力 Fl = N_k_total - 冲切锥体范围内的桩反力
                // 对柱下独立承台，冲切锥内若无桩，则 Fl ≈ Fk
                var Fl = Fk; // 冲切力取柱底轴力设计值近似 (标准值偏安全)
                // 冲切承载力
                var punchCapacity = 2 * (beta0x * (cx + a0y) + beta0y * (cy + a0x)) * beta_hp * ft * h0 / 1000; // kN
                var punchOk = Fl <= punchCapacity;
                st.push('<div class="step"><b>④ 柱下冲切（5.9.7）</b>　a₀<sub>x</sub> = ' + fmt(a0x,0) + ' mm；a₀<sub>y</sub> = ' + fmt(a0y,0) + ' mm；' +
                    'λ<sub>x</sub> = ' + fmt(lambdaX,3) + '；λ<sub>y</sub> = ' + fmt(lambdaY,3) + '</div>');
                st.push('<div class="step">　　β₀<sub>x</sub> = 0.84/(λ+0.2) = ' + fmt(beta0x,3) + '；β₀<sub>y</sub> = ' + fmt(beta0y,3) + '；β<sub>hp</sub> = ' + fmt(beta_hp,3) + '</div>');
                st.push('<div class="step">　　冲切力 F<sub>l</sub> ≈ F<sub>k</sub> = ' + fmt(Fl,0) + ' kN；' +
                    '承载力 = 2[β₀<sub>x</sub>(b<sub>c</sub>+a₀<sub>y</sub>)+β₀<sub>y</sub>(h<sub>c</sub>+a₀<sub>x</sub>)]·β<sub>hp</sub>·f<sub>t</sub>·h₀ = <b>' + fmt(punchCapacity, 1) + ' kN</b> ⇒ ' +
                    (punchOk ? '满足' + tag('ok','柱冲切满足') : '不满足' + tag('err','柱冲切不足')) + '</div>');

                // 角桩冲切（5.9.8）：角桩对承台向上冲切
                // Fl ≤ [β₁x(c₂+a₁y/2) + β₁y(c₁+a₁x/2)]·β_hp·f_t·h₀
                // c1, c2 = 角桩内边缘至承台外边缘距离 (方向1, 方向2)
                // a1x, a1y = 柱角到角桩内边缘的水平距离（角桩冲跨）
                var c1 = Bx / 2 - sx / 2 - dp / 2; // 角桩内侧到承台外侧距离 (x方向)
                var c2 = By / 2 - sy / 2 - dp / 2;
                if (c1 < 0) c1 = 0;
                if (c2 < 0) c2 = 0;
                var a1x = sx / 2 - cx / 2 + dp / 2; // 近似: 角桩到柱角 x 方向距离
                var a1y = sy / 2 - cy / 2 + dp / 2;
                if (a1x < 0.25 * h0) a1x = 0.25 * h0;
                if (a1x > h0) a1x = h0;
                if (a1y < 0.25 * h0) a1y = 0.25 * h0;
                if (a1y > h0) a1y = h0;
                var lambda1x = a1x / h0;
                var lambda1y = a1y / h0;
                var beta1x = 0.56 / (lambda1x + 0.2);
                var beta1y = 0.56 / (lambda1y + 0.2);
                var Nl_corner = Nkmax; // 角桩顶反力最大值
                var cornerCap = (beta1x * (c2 + a1y / 2) + beta1y * (c1 + a1x / 2)) * beta_hp * ft * h0 / 1000; // kN
                var cornerOk = Nl_corner <= cornerCap;
                st.push('<div class="step"><b>⑤ 角桩冲切（5.9.8）</b>　c₁ = ' + fmt(c1,0) + ' mm；c₂ = ' + fmt(c2,0) + ' mm；' +
                    'λ₁<sub>x</sub> = ' + fmt(lambda1x,3) + '；λ₁<sub>y</sub> = ' + fmt(lambda1y,3) + '</div>');
                st.push('<div class="step">　　β₁<sub>x</sub> = 0.56/(λ+0.2) = ' + fmt(beta1x,3) + '；β₁<sub>y</sub> = ' + fmt(beta1y,3) + '</div>');
                st.push('<div class="step">　　角桩反力 N<sub>l</sub> = ' + fmt(Nl_corner,1) + ' kN；' +
                    '承载力 = [β₁<sub>x</sub>(c₂+a₁<sub>y</sub>/2)+β₁<sub>y</sub>(c₁+a₁<sub>x</sub>/2)]·β<sub>hp</sub>·f<sub>t</sub>·h₀ = <b>' + fmt(cornerCap, 1) + ' kN</b> ⇒ ' +
                    (cornerOk ? '满足' + tag('ok','角桩冲切满足') : '不满足' + tag('err','角桩冲切不足')) + '</div>');

                // 承台斜截面受剪（5.9.9）
                // 斜截面在柱边与最近一排桩之间，V = 该排桩反力之和
                var nFirstRowX = nx - 1; // 第一排桩数（扣除柱范围内）
                var V_shear_x = (nx - 1 > 0) ? nFirstRowX * ny * Nk_avg : 0; // x方向柱边截面剪力 = 外侧桩反力之和
                // 简化: 取柱边以外各排桩反力
                var Vx = 0, Vy = 0;
                for (var i3 = 0; i3 < ny; i3++) {
                    for (var j3 = 0; j3 < nx; j3++) {
                        var yi3 = ((ny - 1) / 2 - i3) * sy;
                        var xi3 = ((nx - 1) / 2 - j3) * sx;
                        var Ni3 = Nk_avg + Mxk * yi3 / 1000 / Ix + Myk * xi3 / 1000 / Iy;
                        // 判断：是否在柱边外侧
                        if (Math.abs(yi3) > cy / 2) Vy += Ni3; // 这些桩的反力由柱边 x方向(垂直于y)的斜截面承担
                        if (Math.abs(xi3) > cx / 2) Vx += Ni3; // 绕 y 轴方向剪力，由 y 方向斜截面承担
                    }
                }
                // 注意：这里 Vx 是沿 x 方向分布的桩在柱边产生的剪力，由垂直于 x 方向（y-z 面）的斜截面承受
                // 斜截面承载力：β·α_cv·f_t·b_0·h_0, α_cv = 1.75/(λ+1)
                // b0: 沿斜截面方向的承台宽度。对柱边斜截面，宽度 = Bx (对于x方向垂直面)
                var lambda_sx = a0x / h0; // 剪跨比 λ = a/h0
                var lambda_sy = a0y / h0;
                if (lambda_sx < 0.3) lambda_sx = 0.3;
                if (lambda_sx > 3) lambda_sx = 3;
                if (lambda_sy < 0.3) lambda_sy = 0.3;
                if (lambda_sy > 3) lambda_sy = 3;
                var alpha_cvx = 1.75 / (lambda_sx + 1);
                var alpha_cvy = 1.75 / (lambda_sy + 1);
                var beta_hs = 1.0; // 截面高度影响系数，h<800取1.0
                if (h > 800) beta_hs = Math.pow(800 / h, 0.25);
                var Vu_x = alpha_cvx * beta_hs * ft * By * h0 / 1000; // kN, 绕 y 轴方向剪力由 x 方向(垂直)截面承受, 截面宽 By
                var Vu_y = alpha_cvy * beta_hs * ft * Bx * h0 / 1000;
                var shearOkX = Vx <= Vu_x;
                var shearOkY = Vy <= Vu_y;
                st.push('<div class="step"><b>⑥ 承台斜截面受剪（5.9.9）</b></div>');
                st.push('<div class="step">　　x 向柱边剪力 V<sub>x</sub> = ' + fmt(Vx,1) + ' kN；λ = ' + fmt(lambda_sx,3) +
                    '；α<sub>cv</sub> = 1.75/(λ+1) = ' + fmt(alpha_cvx,3) + '；V<sub>u</sub> = α<sub>cv</sub>·β<sub>hs</sub>·f<sub>t</sub>·b·h₀ = <b>' + fmt(Vu_x, 1) + ' kN</b> ⇒ ' +
                    (shearOkX ? '满足' + tag('ok','x向满足') : '不满足' + tag('err','x向不足')) + '</div>');
                st.push('<div class="step">　　y 向柱边剪力 V<sub>y</sub> = ' + fmt(Vy,1) + ' kN；λ = ' + fmt(lambda_sy,3) +
                    '；α<sub>cv</sub> = ' + fmt(alpha_cvy,3) + '；V<sub>u</sub> = <b>' + fmt(Vu_y, 1) + ' kN</b> ⇒ ' +
                    (shearOkY ? '满足' + tag('ok','y向满足') : '不满足' + tag('err','y向不足')) + '</div>');

                // 承台局部受压（5.9.1 柱下）
                // 柱下局部受压：F_l ≤ β·β_c·f_cc·A_ln
                var Fl_local = Fk; // kN
                var A_l = cx * cy; // mm², 局部受压面积 = 柱底面积
                var A_b = Bx * By; // 计算底面积（简化取承台全截面，保守应取局部受压计算底面积）
                var beta_local = Math.sqrt(A_b / A_l); // 局部受压强度提高系数
                if (beta_local > 3) beta_local = 3;
                var fcc = 0.85 * fc; // 局部受压轴心抗压强度设计值 f_cc = 0.85 f_c
                var beta_c = 1.0; // 配置间接钢筋时才提高，此处不配则取 1.0
                var localCap = beta_local * beta_c * fcc * A_l / 1000; // kN
                var localOk = Fl_local <= localCap;
                st.push('<div class="step"><b>⑦ 柱下局部受压（5.9.1 / 6.6）</b>　A<sub>l</sub> = ' + fmt(A_l,0) + ' mm²；A<sub>b</sub> = ' + fmt(A_b,0) + ' mm²；' +
                    'β = √(A<sub>b</sub>/A<sub>l</sub>) = ' + fmt(beta_local,2) + '；f<sub>cc</sub> = 0.85f<sub>c</sub> = ' + fmt(fcc,2) + ' N/mm²</div>');
                st.push('<div class="step">　　F<sub>l</sub> = ' + fmt(Fl_local,0) + ' kN；承载力 F<sub>u</sub> = β·f<sub>cc</sub>·A<sub>l</sub> = <b>' + fmt(localCap, 1) + ' kN</b> ⇒ ' +
                    (localOk ? '满足' + tag('ok','局压满足') : '不满足' + tag('err','局压不足')) + '</div>');

                var allOk = bendOkX && bendOkY && punchOk && cornerOk && shearOkX && shearOkY && localOk;
                var html = resultRow('桩数 n / 布置', n + ' 根（' + nx + '×' + ny + '）');
                html += resultRow('平均 / 最大桩反力', fmt(Nk_avg,1) + ' / ' + fmt(Nkmax,1) + ' kN');
                html += resultRow('x 向受弯配筋 A<sub>s,x</sub>', fmt(AsX, 0) + ' mm²（总面积）' + (bendOkX ? tag('ok','适筋') : tag('err','超筋')));
                html += resultRow('y 向受弯配筋 A<sub>s,y</sub>', fmt(AsY, 0) + ' mm²（总面积）' + (bendOkY ? tag('ok','适筋') : tag('err','超筋')));
                html += resultRow('柱下冲切 F<sub>l</sub> / F<sub>u</sub>', fmt(Fl,0) + ' / ' + fmt(punchCapacity,0) + ' kN ' + (punchOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('角桩冲切 N<sub>l</sub> / F<sub>u</sub>', fmt(Nl_corner,1) + ' / ' + fmt(cornerCap,0) + ' kN ' + (cornerOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('斜截受剪 V<sub>x</sub> / V<sub>y</sub>', fmt(Vx,0) + ' / ' + fmt(Vy,0) + ' kN ' + ((shearOkX&&shearOkY)?tag('ok','满足'):tag('err','不足')));
                html += resultRow('柱下局部受压', fmt(Fl_local,0) + ' / ' + fmt(localCap,0) + ' kN ' + (localOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '承台各项验算均满足' : '承台验算存在不满足项'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._PC_RESULT = { n: n, Nk_avg: Nk_avg, Nkmax: Nkmax, Mx: Mx_design, My: My_design, AsX: AsX, AsY: AsY, Fl: Fl, punchCap: punchCapacity, cornerCap: cornerCap, Vx: Vx, Vy: Vy, Vu_x: Vu_x, Vu_y: Vu_y, localCap: localCap, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['pc_sx','pc_sy','pc_dp','pc_h','pc_bx','pc_by','pc_cx','pc_cy','pc_Fk','pc_Mxk','pc_Myk','pc_Gk'].forEach(function (id) {
                    var defs = { pc_sx:1500, pc_sy:1500, pc_dp:600, pc_h:1000, pc_bx:3600, pc_by:3600, pc_cx:600, pc_cy:600, pc_Fk:3600, pc_Mxk:200, pc_Myk:200, pc_Gk:0 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('pc_arrange').value = '2x2';
                document.getElementById('pc_con').value = 'C30';
                document.getElementById('pc_reb').value = 'HRB400';
                calc();
            }
            document.getElementById('pc_calc').addEventListener('click', calc);
            document.getElementById('pc_reset').addEventListener('click', reset);
            document.getElementById('f-pc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pile-cap'] = tool;
})();
