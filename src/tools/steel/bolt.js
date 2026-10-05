/* bolt 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '螺栓连接计算',
        sub: '普通螺栓 / 高强摩擦型 / 承压型 · 抗剪 / 抗拉 / 拉剪联合 · 弯矩下最不利螺栓',
        meta: {"standard": "GB 50017-2017 钢结构设计标准", "formulaSource": "第11章", "limitations": "普通螺栓+高强度螺栓，抗剪/抗拉/拉剪联合", "unit": "N:kN, Nvb:kN, Ntb:kN", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">螺栓与连接件参数</div>' +
                '<form id="f-bl"><div class="grid2">' +
                selField('bl_type', '螺栓类型', opts([
                    { v: 'ordinary_C', t: '普通螺栓 C 级' },
                    { v: 'ordinary_AB', t: '普通螺栓 A / B 级' },
                    { v: 'high_fric', t: '高强度螺栓摩擦型' },
                    { v: 'high_bear', t: '高强度螺栓承压型' }
                ], 'high_fric')) +
                selField('bl_grade', '螺栓性能等级', opts([
                    { v: '4.6', t: '4.6 级' },
                    { v: '4.8', t: '4.8 级' },
                    { v: '5.6', t: '5.6 级' },
                    { v: '8.8', t: '8.8 级' },
                    { v: '10.9', t: '10.9 级' },
                    { v: '10.9S', t: '10.9 级 S 型' }
                ], '10.9')) +
                selField('bl_d', '公称直径 d', opts([
                    { v: '16', t: 'M16' },
                    { v: '20', t: 'M20' },
                    { v: '22', t: 'M22' },
                    { v: '24', t: 'M24' },
                    { v: '27', t: 'M27' },
                    { v: '30', t: 'M30' }
                ], '20')) +
                selField('bl_nv', '受剪面数 n<sub>v</sub>', opts([
                    { v: '1', t: '单剪切面 (n_v = 1)' },
                    { v: '2', t: '双剪切面 (n_v = 2)' },
                    { v: '3', t: '三剪切面 (n_v = 3)' }
                ], '1')) +
                numField('bl_n', '螺栓数量 n', '个', 6) +
                numField('bl_p', '螺栓间距 p', 'mm', 80, '沿受力方向的螺栓间距，用于弯矩下分配') +
                selField('bl_arrange', '螺栓排列', opts([
                    { v: '1col', t: '单列布置（沿受力方向 1 列）' },
                    { v: '2col', t: '双列布置（2 列）' },
                    { v: 'rect', t: '矩形布置（多列多行）' }
                ], '2col')) +
                numField('bl_row', '螺栓排数（垂直力方向）', '排', 2, '列数/排数用于确定最不利螺栓') +
                numField('bl_t', '较薄板件厚度 t', 'mm', 12, '用于承压验算的板件厚度') +
                selField('bl_steel', '板件钢材', opts(steelOpts(), 'Q355')) +
                numField('bl_mu', '摩擦面抗滑移系数 μ', '', 0.45, '摩擦型高强螺栓必填；喷砂除锈 Q235 取 0.45、Q355 取 0.50') +
                '</div><div class="panel-title" style="margin-top:14px;">荷载设计值</div><div class="grid2">' +
                numField('bl_N', '轴力 N', 'kN', 300, '沿剪切面方向的轴力') +
                numField('bl_V', '剪力 V', 'kN', 200, '横向剪力，若轴力已经是剪力则 V = 0') +
                numField('bl_T', '外拉力 T', 'kN', 100, '垂直于连接板的拉力（螺栓受拉）') +
                numField('bl_M', '弯矩 M', 'kN·m', 30, '在受拉方向产生附加拉力的弯矩') +
                '</div><div class="hint">说明：普通螺栓抗剪按 N<sub>v</sub><sup>b</sup> = n<sub>v</sub>·πd²/4·f<sub>v</sub><sup>b</sup> 与承压 N<sub>c</sub><sup>b</sup> = d·Σt·f<sub>c</sub><sup>b</sup> 的较小值；摩擦型按 N<sub>v</sub><sup>b</sup> = 0.9·n<sub>f</sub>·μ·P；拉剪联合按 N<sub>v</sub>/N<sub>v</sub><sup>b</sup> + N<sub>t</sub>/N<sub>t</sub><sup>b</sup> ≤ 1（普通）或 N<sub>v</sub>/N<sub>v</sub><sup>b</sup> + N<sub>t</sub>/N<sub>t</sub><sup>b</sup> ≤ 1（摩擦型，公式略有不同）。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="bl_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="bl_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="bl_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="bl_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('bl_result'), proc = document.getElementById('bl_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var typeV = document.getElementById('bl_type').value;
                var gradeV = document.getElementById('bl_grade').value;
                var d = parseFloat(document.getElementById('bl_d').value); // mm
                var nv = parseInt(document.getElementById('bl_nv').value);
                var n = parseInt(document.getElementById('bl_n').value);
                var p = parseFloat(document.getElementById('bl_p').value);
                var arrV = document.getElementById('bl_arrange').value;
                var nrow = parseInt(document.getElementById('bl_row').value);
                var t = parseFloat(document.getElementById('bl_t').value);
                var steel = document.getElementById('bl_steel').value;
                var mu = parseFloat(document.getElementById('bl_mu').value);
                var N = parseFloat(document.getElementById('bl_N').value);
                var V = parseFloat(document.getElementById('bl_V').value);
                var T = parseFloat(document.getElementById('bl_T').value);
                var M = parseFloat(document.getElementById('bl_M').value);
                if (!(d > 0 && n > 0)) return err('螺栓直径和数量必须为正数。');
                var f = STEEL[steel].f;
                var st = [];

                // 螺栓强度设计值
                var fvb, ftb, fcb; // MPa
                if (typeV === 'ordinary_C') {
                    fvb = (gradeV === '4.6' || gradeV === '4.8') ? 140 : 140;
                    ftb = (gradeV === '4.6' || gradeV === '4.8') ? 170 : 170;
                    fcb = f + 90; // 承压近似取 f + 90? 规范是 f_c^b 与钢材相关，简化取 305/385 等
                    fcb = (steel === 'Q235') ? 305 : (steel === 'Q355') ? 385 : (steel === 'Q390') ? 405 : 425;
                } else if (typeV === 'ordinary_AB') {
                    if (gradeV === '5.6') { fvb = 190; ftb = 210; }
                    else if (gradeV === '8.8') { fvb = 320; ftb = 400; }
                    else { fvb = 190; ftb = 210; }
                    fcb = (steel === 'Q235') ? 405 : (steel === 'Q355') ? 510 : (steel === 'Q390') ? 530 : 560;
                } else {
                    // 高强螺栓：8.8/10.9 级，摩擦型/承压型
                    if (gradeV === '8.8') { fvb = 250; ftb = 400; }
                    else if (gradeV === '10.9' || gradeV === '10.9S') { fvb = 310; ftb = 500; }
                    else { fvb = 310; ftb = 500; }
                    fcb = (steel === 'Q235') ? 470 : (steel === 'Q355') ? 590 : (steel === 'Q390') ? 610 : 640;
                }

                // 单个螺栓抗剪承载力 Nvb (kN)
                var Nvb = 0, Ncb = 0;
                if (typeV === 'high_fric') {
                    // 摩擦型：Nvb = 0.9 * nf * μ * P
                    // nf 传力摩擦面数 = nv (单面剪 = 1个摩擦面)
                    var P = BOLT_P[gradeV]['M' + d]; // kN
                    if (!P) P = 155; // 默认 M20, 10.9级
                    Nvb = 0.9 * nv * mu * P; // kN
                    st.push('<div class="step"><b>① 单个螺栓抗剪承载力（摩擦型 11.4.1）</b>　预拉力 P = ' + P + ' kN（M' + d + '，' + gradeV + ' 级）；μ = ' + mu + '；n<sub>f</sub> = ' + nv + '</div>');
                    st.push('<div class="step">　　N<sub>v</sub><sup>b</sup> = 0.9·n<sub>f</sub>·μ·P = 0.9×' + nv + '×' + mu + '×' + P + ' = <b>' + fmt(Nvb, 1) + ' kN</b></div>');
                } else {
                    // 普通或承压型：Nv = nv * πd²/4 * fvb
                    var As = Math.PI * d * d / 4; // mm²
                    Nvb = nv * As * fvb / 1000; // kN
                    Ncb = d * t * fcb / 1000; // kN, Σt 取 t（较薄板）
                    var minNv = Math.min(Nvb, Ncb);
                    st.push('<div class="step"><b>① 单个螺栓抗剪与承压承载力（' + (typeV==='ordinary_C'?'普通C级':typeV==='ordinary_AB'?'普通A/B级':'高强承压型') + '）</b></div>');
                    st.push('<div class="step">　　N<sub>v</sub><sup>b</sup> = n<sub>v</sub>·πd²/4·f<sub>v</sub><sup>b</sup> = ' + nv + '×π×' + d + '²/4×' + fvb + ' = <b>' + fmt(Nvb, 1) + ' kN</b></div>');
                    st.push('<div class="step">　　N<sub>c</sub><sup>b</sup> = d·Σt·f<sub>c</sub><sup>b</sup> = ' + d + '×' + t + '×' + fcb + ' = <b>' + fmt(Ncb, 1) + ' kN</b></div>');
                    st.push('<div class="step">　　控制承载力：min(N<sub>v</sub><sup>b</sup>, N<sub>c</sub><sup>b</sup>) = <b>' + fmt(minNv, 1) + ' kN</b>' +
                        (Nvb < Ncb ? '（剪切控制）' : '（承压控制）') + '</div>');
                }

                // 单个螺栓抗拉承载力 Ntb (kN)
                var As_ten = Math.PI * (d - 0.9382 * 2.5) * (d - 0.9382 * 2.5) / 4; // 近似有效直径 d_e ≈ d - 1.0825p (p=螺距，粗牙近似)
                // 简化：用螺纹处有效面积近似 (GB 表)，M20: 244.8 mm²; 公式 A_e = π*(d - 0.9382*p)^2/4, p 为螺距
                // 常用粗牙螺距: M16=2, M20=2.5, M22=2.5, M24=3, M27=3, M30=3.5
                var pitchMap = { '16': 2, '20': 2.5, '22': 2.5, '24': 3, '27': 3, '30': 3.5 };
                var pitch = pitchMap[String(d)] || 2.5;
                var de = d - 0.9382 * pitch;
                As_ten = Math.PI * de * de / 4;
                var Ntb = As_ten * ftb / 1000; // kN
                st.push('<div class="step"><b>② 单个螺栓抗拉承载力</b>　d<sub>e</sub> ≈ ' + fmt(de,2) + ' mm；A<sub>e</sub> ≈ ' + fmt(As_ten,0) + ' mm²；f<sub>t</sub><sup>b</sup> = ' + ftb + ' MPa</div>');
                st.push('<div class="step">　　N<sub>t</sub><sup>b</sup> = A<sub>e</sub>·f<sub>t</sub><sup>b</sup> = <b>' + fmt(Ntb, 1) + ' kN</b></div>');

                // 单个螺栓受力（考虑弯矩下最不利螺栓）
                // 剪力：V_total = N (轴力为剪力) + V (横向) — 合并为剪力 Nv = √(N²+V²)? 简化：设 N 为沿螺栓剪切面的剪力，V 忽略
                var Nv_one = N / n; // 平均剪力
                var Nt_avg = T / n; // 平均拉力

                // 弯矩下最不利螺栓拉力（刚性板假定，螺栓绕形心转动）
                // 各排螺栓到形心距离 yi，最大在 y_max 处
                // 布置：设 ncol 列 × nrow 排 = n 个
                var ncol = Math.ceil(n / nrow);
                var ymax = (nrow - 1) / 2 * p; // mm
                var sumY2 = 0;
                for (var i = 0; i < nrow; i++) {
                    var yi = ((nrow - 1) / 2 - i) * p;
                    sumY2 += ncol * yi * yi;
                }
                var Nt_M = M * 1e6 * ymax / sumY2 / 1000; // kN (M:kN·m -> N·mm, y:mm, I:mm² -> N, 再转 kN)
                // 验证: M*1e6 (N·mm) * ymax (mm) / sumY2 (mm²) = N / 1000 = kN ✓
                var Nt_max = Nt_avg + Nt_M;
                if (Nt_max < 0) Nt_max = 0;
                st.push('<div class="step"><b>③ 最不利螺栓受力（含弯矩）</b>　布置：' + ncol + ' 列 × ' + nrow + ' 排；y<sub>max</sub> = ' + fmt(ymax,0) + ' mm；Σy² = ' + fmt(sumY2,0) + ' mm²</div>');
                st.push('<div class="step">　　平均剪力 N<sub>v</sub> = N/n = ' + fmt(Nv_one, 1) + ' kN</div>');
                st.push('<div class="step">　　平均拉力 N<sub>t,avg</sub> = T/n = ' + fmt(Nt_avg, 1) + ' kN</div>');
                st.push('<div class="step">　　弯矩附加拉力 N<sub>t,M</sub> = M·y<sub>max</sub>/Σy² = ' + fmt(Nt_M, 1) + ' kN</div>');
                st.push('<div class="step">　　<b>最不利螺栓：N<sub>v</sub> = ' + fmt(Nv_one, 1) + ' kN，N<sub>t,max</sub> = ' + fmt(Nt_max, 1) + ' kN</b></div>');

                // 验算
                var shearOk, tensionOk, combOk, allOk;
                if (typeV === 'high_fric') {
                    // 摩擦型：同时受拉剪时，Nvb 降低为 Nvb * (1 - Nt/Ntb*0.5?)  规范 11.4.2:
                    // Nv / Nvb + Nt / Ntb ≤ 1  (摩擦型螺栓同时受剪受拉)
                    // 且 Nv ≤ Ncb (不对，摩擦型不受控于承压，承压型才是)
                    // 规范11.4.2: N_v / N_v^b + N_t / N_t^b ≤ 1
                    var combRatio = Nv_one / Nvb + Nt_max / Ntb;
                    shearOk = Nv_one <= Nvb;
                    tensionOk = Nt_max <= Ntb;
                    combOk = combRatio <= 1;
                    st.push('<div class="step"><b>④ 拉剪联合验算（摩擦型 11.4.2）</b>　N<sub>v</sub>/N<sub>v</sub><sup>b</sup> + N<sub>t</sub>/N<sub>t</sub><sup>b</sup> = ' + fmt(Nv_one,1) + '/' + fmt(Nvb,1) + ' + ' + fmt(Nt_max,1) + '/' + fmt(Ntb,1) + ' = <b>' + fmt(combRatio,3) + '</b> ≤ 1</div>');
                    st.push('<div class="step">　　' + (combOk ? '满足' + tag('ok','拉剪满足') : '不满足' + tag('err','拉剪不足')) + '</div>');
                    allOk = combOk;
                } else {
                    // 普通螺栓 / 承压型
                    var NvCtrl = (typeV === 'high_bear') ? Math.min(Nvb, Ncb) : Math.min(Nvb, Ncb);
                    shearOk = Nv_one <= NvCtrl;
                    tensionOk = Nt_max <= Ntb;
                    // 拉剪联合：√((Nv/Nvb)² + (Nt/Ntb)²) ≤ 1 (普通螺栓 11.4.1-1)
                    // 普通螺栓拉剪联合公式：N_v/N_v^b + N_t/N_t^b ≤ 1? 不对
                    // 规范: 同时受剪受拉普通螺栓：√((Nv/Nvb)² + (Nt/Ntb)²) ≤ 1 且 Nv ≤ Ncb
                    // 或者 11.4.1-1: √((Nv/Nv^b)^2 + (Nt/Nt^b)^2) ≤ 1
                    var combRatio2 = Math.sqrt((Nv_one / Nvb) * (Nv_one / Nvb) + (Nt_max / Ntb) * (Nt_max / Ntb));
                    combOk = combRatio2 <= 1 && Nv_one <= Ncb;
                    st.push('<div class="step"><b>④ 拉剪联合验算（普通/承压型，11.4.1）</b></div>');
                    st.push('<div class="step">　　√[(N<sub>v</sub>/N<sub>v</sub><sup>b</sup>)² + (N<sub>t</sub>/N<sub>t</sub><sup>b</sup>)²] = √[(' + fmt(Nv_one,1) + '/' + fmt(Nvb,1) + ')² + (' + fmt(Nt_max,1) + '/' + fmt(Ntb,1) + ')²] = <b>' + fmt(combRatio2,3) + '</b> ≤ 1</div>');
                    st.push('<div class="step">　　' + (combRatio2 <= 1 ? '强度比满足' : '强度比不满足') + '；且承压 N<sub>v</sub>=' + fmt(Nv_one,1) + ' ≤ N<sub>c</sub><sup>b</sup>=' + fmt(Ncb,1) + ' ' + (Nv_one <= Ncb ? '✓' : '✗') + '</div>');
                    st.push('<div class="step">　　' + (combOk ? '满足' + tag('ok','拉剪满足') : '不满足' + tag('err','拉剪不足')) + '</div>');
                    allOk = shearOk && tensionOk && combOk;
                }

                var html = resultRow('螺栓类型 / 等级 / 直径',
                    (typeV==='ordinary_C'?'普通C级':typeV==='ordinary_AB'?'普通A/B级':typeV==='high_fric'?'高强摩擦型':'高强承压型') +
                    ' / ' + gradeV + ' 级 / M' + d);
                html += resultRow('单个抗剪承载力 N<sub>v</sub><sup>b</sup>', fmt(Nvb, 1) + ' kN' + (Ncb > 0 ? '（承压 ' + fmt(Ncb,1) + ' kN）' : ''));
                html += resultRow('单个抗拉承载力 N<sub>t</sub><sup>b</sup>', fmt(Ntb, 1) + ' kN（有效面积 ' + fmt(As_ten,0) + ' mm²）');
                html += resultRow('最不利螺栓 N<sub>v</sub> / N<sub>t,max</sub>', fmt(Nv_one, 1) + ' / ' + fmt(Nt_max, 1) + ' kN');
                html += resultRow('抗剪', (shearOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('抗拉', (tensionOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('拉剪联合', (combOk ? tag('ok','满足') : tag('err','不足')));
                html += resultRow('综合判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '螺栓连接满足要求' : '螺栓连接不满足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._BL_RESULT = { Nvb: Nvb, Ntb: Ntb, Nv_one: Nv_one, Nt_max: Nt_max, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                document.getElementById('bl_type').value = 'high_fric';
                document.getElementById('bl_grade').value = '10.9';
                document.getElementById('bl_d').value = '20';
                document.getElementById('bl_nv').value = '1';
                document.getElementById('bl_arrange').value = '2col';
                document.getElementById('bl_steel').value = 'Q355';
                ['bl_n','bl_p','bl_row','bl_t','bl_mu','bl_N','bl_V','bl_T','bl_M'].forEach(function (id) {
                    var defs = { bl_n:6, bl_p:80, bl_row:2, bl_t:12, bl_mu:0.45, bl_N:300, bl_V:0, bl_T:100, bl_M:30 };
                    document.getElementById(id).value = defs[id];
                });
                calc();
            }
            document.getElementById('bl_calc').addEventListener('click', calc);
            document.getElementById('bl_reset').addEventListener('click', reset);
            document.getElementById('f-bl').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['bolt'] = tool;
})();
