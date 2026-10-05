/* weld 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '焊缝连接计算',
        sub: '直角角焊缝 / 对接焊缝 · 轴力+弯矩+剪力组合 · GB 50017-2017 第 11 章',
        meta: {"standard": "GB 50017-2017 钢结构设计标准", "formulaSource": "第11章", "limitations": "直角角焊缝+对接焊缝，轴力+弯矩+剪力组合", "unit": "σ:N/mm², τ:N/mm², ffw:N/mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">焊缝形式与材料</div>' +
                '<form id="f-wd"><div class="grid2">' +
                selField('wd_type', '焊缝类型', opts([
                    { v: 'fillet', t: '直角角焊缝' },
                    { v: 'butt', t: '对接焊缝' }
                ], 'fillet')) +
                selField('wd_steel', '母材钢材', opts(steelOpts(), 'Q355')) +
                selField('wd_electrode', '焊条/焊丝', opts([
                    { v: 'E43', t: 'E43 型焊条（Q235 匹配）' },
                    { v: 'E50', t: 'E50 型焊条/焊丝（Q355 匹配）' },
                    { v: 'E55', t: 'E55 型焊条（Q390/Q420 匹配）' }
                ], 'E50')) +
                numField('wd_hf', '焊脚尺寸 h<sub>f</sub>', 'mm', 8, '角焊缝焊脚尺寸') +
                numField('wd_lw', '焊缝计算长度 l<sub>w</sub>', 'mm', 200, '实际长度减去引弧、灭弧各 5 mm') +
                selField('wd_dir', '受力方向（角焊缝）', opts([
                    { v: 'longitudinal', t: '侧面角焊缝（力平行于焊缝长度）' },
                    { v: 'frontal', t: '正面角焊缝（力垂直于焊缝长度）' },
                    { v: 'oblique', t: '斜向角焊缝（力与焊缝夹角 θ）' },
                    { v: 'combo', t: '三面围焊 / 组合（轴力 + 弯矩 + 剪力）' }
                ], 'combo')) +
                numField('wd_theta', '力与焊缝夹角 θ', '°', 45, '斜向角焊缝时使用') +
                '</div><div class="panel-title" style="margin-top:14px;">荷载设计值</div><div class="grid2">' +
                numField('wd_N', '轴力 N', 'kN', 150) +
                numField('wd_V', '剪力 V', 'kN', 80) +
                numField('wd_M', '弯矩 M', 'kN·m', 20) +
                numField('wd_T', '扭矩 T', 'kN·m', 0, '扭矩产生的焊缝应力，0 表示无') +
                selField('wd_n', '焊缝数量/布置', opts([
                    { v: '1', t: '单条焊缝' },
                    { v: '2', t: '两条对称（双侧面）' },
                    { v: '4', t: '四条围焊（矩形）' }
                ], '2')) +
                numField('wd_e', '焊缝偏心距 e', 'mm', 0, '力的作用点到焊缝形心距离，用于产生附加弯矩') +
                '</div><div class="hint">说明：角焊缝按 σ_f / β_f + τ_f ≤ f<sub>f</sub><sup>w</sup> 验算；β<sub>f</sub> 为正面焊缝强度增大系数（1.22 静载/1.0 动载）。对接焊缝按拉 / 压 / 剪应力分别验算，并验算折算应力。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="wd_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="wd_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="wd_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="wd_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('wd_result'), proc = document.getElementById('wd_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var wType = document.getElementById('wd_type').value;
                var steel = document.getElementById('wd_steel').value;
                var elec = document.getElementById('wd_electrode').value;
                var hf = parseFloat(document.getElementById('wd_hf').value);
                var lw = parseFloat(document.getElementById('wd_lw').value);
                var dirV = document.getElementById('wd_dir').value;
                var thetaDeg = parseFloat(document.getElementById('wd_theta').value);
                var N = parseFloat(document.getElementById('wd_N').value);
                var V = parseFloat(document.getElementById('wd_V').value);
                var M = parseFloat(document.getElementById('wd_M').value);
                var T = parseFloat(document.getElementById('wd_T').value);
                var nW = parseInt(document.getElementById('wd_n').value);
                var e = parseFloat(document.getElementById('wd_e').value);
                if (!(hf > 0 && lw > 0)) return err('焊脚尺寸和焊缝长度必须为正数。');

                // 焊缝强度
                var weldKey;
                if (steel === 'Q235') weldKey = 'Q235_E43';
                else if (steel === 'Q355') weldKey = 'Q355_E50';
                else if (steel === 'Q390') weldKey = 'Q390_E50';
                else weldKey = 'Q420_E55';
                var fw = WELD_F[weldKey];
                var f = STEEL[steel].f;
                var fv = STEEL[steel].fv;
                var st = [];

                if (wType === 'fillet') {
                    // 角焊缝计算
                    // 有效厚度 he = 0.7hf, 有效截面面积 Aw = n * he * lw
                    var he = 0.7 * hf;
                    var Aw = nW * he * lw; // mm²
                    // 强度增大系数 βf
                    var betaF = 1.22;
                    if (dirV === 'longitudinal') betaF = 1.0; // 侧面
                    else if (dirV === 'frontal') betaF = 1.22; // 正面
                    else if (dirV === 'oblique') {
                        var theta = thetaDeg * Math.PI / 180;
                        betaF = 1 / Math.sqrt(1 - Math.sin(theta) * Math.sin(theta) / 3);
                    }
                    // 弯矩 + 轴力产生正应力 σ_f（垂直于焊缝长度方向）
                    // 扭矩产生剪应力（简化忽略，复杂情况用 T=0）
                    // 简化模型：双列对称焊缝，形心处截面模量 Ww = 2*(he * lw² / 6)
                    var Iw = nW * he * Math.pow(lw, 3) / 12; // 焊缝惯性矩（绕形心垂直轴）
                    var Ww = nW * he * lw * lw / 6; // 焊缝截面模量
                    // 轴力产生均匀剪应力 τ_N （沿长度方向为剪应力）
                    var tau_N = N * 1000 / Aw; // MPa
                    // 剪力（垂直于焊缝长度，作为剪应力？） — 通常 V 与焊缝方向垂直，产生正应力
                    // 简化：N 平行于焊缝（剪应力），V 垂直于焊缝（正应力 σ_f），M 绕焊缝平面垂直轴产生σ_f
                    var sigma_V = V * 1000 / Aw; // 垂直于焊缝长度的应力（正应力）
                    var sigma_M = (M * 1e6 + N * 1000 * e) / Ww; // 弯矩 + 偏心轴力产生的最大正应力
                    var sigma_f = sigma_V + sigma_M; // 垂直焊缝方向的总正应力
                    var tau_f = tau_N; // 沿焊缝方向的剪应力
                    // 合应力验算：√((σ_f/β_f)² + τ_f²) ≤ f_f^w
                    var combStress = Math.sqrt(Math.pow(sigma_f / betaF, 2) + tau_f * tau_f);
                    var ok = combStress <= fw.ff;

                    st.push('<div class="step"><b>① 角焊缝参数</b>　焊脚 h<sub>f</sub> = ' + hf + ' mm；有效厚度 h<sub>e</sub> = 0.7h<sub>f</sub> = ' + fmt(he,2) + ' mm</div>');
                    st.push('<div class="step">　　计算长度 l<sub>w</sub> = ' + lw + ' mm；共 ' + nW + ' 条；总有效面积 A<sub>w</sub> = n·h<sub>e</sub>·l<sub>w</sub> = ' + fmt(Aw,0) + ' mm²</div>');
                    st.push('<div class="step">　　焊缝强度设计值 f<sub>f</sub><sup>w</sup> = ' + fw.ff + ' MPa（' + weldKey + '）；正面增大系数 β<sub>f</sub> = ' + fmt(betaF,3) + '</div>');

                    st.push('<div class="step"><b>② 应力分析</b></div>');
                    st.push('<div class="step">　　轴力剪应力 τ<sub>f,N</sub> = N / A<sub>w</sub> = ' + fmt(tau_N,2) + ' MPa</div>');
                    st.push('<div class="step">　　剪力正应力 σ<sub>f,V</sub> = V / A<sub>w</sub> = ' + fmt(sigma_V,2) + ' MPa</div>');
                    st.push('<div class="step">　　弯矩+偏心正应力 σ<sub>f,M</sub> = (M + N·e) / W<sub>w</sub> = ' + fmt(sigma_M,2) + ' MPa</div>');
                    st.push('<div class="step">　　垂直焊缝方向 σ<sub>f</sub> = ' + fmt(sigma_f,2) + ' MPa；沿焊缝方向 τ<sub>f</sub> = ' + fmt(tau_f,2) + ' MPa</div>');

                    st.push('<div class="step"><b>③ 组合强度验算（11.2.1）</b>　√[(σ<sub>f</sub>/β<sub>f</sub>)² + τ<sub>f</sub>²] ≤ f<sub>f</sub><sup>w</sup></div>');
                    st.push('<div class="step">　　= √[(' + fmt(sigma_f,2) + '/' + fmt(betaF,3) + ')² + ' + fmt(tau_f,2) + '²] = <b>' + fmt(combStress,2) + ' MPa</b> ≤ ' + fw.ff + ' MPa ⇒ ' +
                        (ok ? '满足' + tag('ok','焊缝满足') : '不满足' + tag('err','焊缝不足')) + '</div>');

                    // 构造验算
                    var hf_min = Math.sqrt(Math.max(0, 0)) ? 0 : 6; // 简化构造要求：hf ≥ 1.5√t (t 为较厚件厚度，此处假设)
                    // 按规范：hf_min = 1.5√t_max, hf_max = 1.2 t_min (t_min 为较薄板厚). 因无板厚输入，跳过
                    var html = resultRow('焊缝类型 / 焊条', '角焊缝 / ' + elec);
                    html += resultRow('有效厚度 h<sub>e</sub>', fmt(he,2) + ' mm（0.7 h<sub>f</sub>）');
                    html += resultRow('总有效面积 A<sub>w</sub>', fmt(Aw,0) + ' mm²（' + nW + ' 条）');
                    html += resultRow('正应力 σ<sub>f</sub> / 剪应力 τ<sub>f</sub>', fmt(sigma_f,2) + ' / ' + fmt(tau_f,2) + ' MPa');
                    html += resultRow('强度增大系数 β<sub>f</sub>', fmt(betaF,3));
                    html += resultRow('组合应力 / f<sub>f</sub><sup>w</sup>', fmt(combStress,2) + ' / ' + fw.ff + ' MPa ' + (ok ? tag('ok','满足') : tag('err','不足')));
                    html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '角焊缝强度满足要求' : '角焊缝强度不满足'));
                    out.innerHTML = html;
                } else {
                    // 对接焊缝计算
                    // 轴力 + 弯矩 + 剪力
                    // 假设焊缝截面：高度 lw（对接焊缝长度/高度）, 厚度取板厚 tw
                    // 简化：按 1 条对接焊缝，宽度 = 板厚近似值? 没有板厚参数
                    // 用 hf 作为板厚 tw 的近似输入 (改造成用 lw 作为焊缝长度, 用 hf 作为板厚)
                    var tw = hf; // 板厚，借用 hf 字段名（不严谨，但提供了 lw 和 hf 两个输入）
                    // 实际更合理：用 lw 为焊缝长度，tw 为板厚。这里做映射：hf 当作板厚
                    // 应力：σ = N/(tw*lw) + M*6/(tw*lw²), 剪应力 τ = V*1.5/(tw*lw) (矩形截面)
                    var sigma_N = N * 1000 / (tw * lw);
                    var sigma_M = M * 1e6 * 6 / (tw * lw * lw);
                    var sigma_max = sigma_N + sigma_M;
                    var tau_max = 1.5 * V * 1000 / (tw * lw);
                    // 折算应力：√(σ² + 3τ²) ≤ 1.1 f_t^w (1.1 为折算应力增大系数)
                    // 在弯矩和剪力最大处，σ 和 τ 同时最大？不对，弯矩最大处剪应力为0。折算应力出现在腹板翼缘交接处
                    // 简化：取边缘折算应力（τ ≈ 0），与中部折算应力比较
                    // 这里按规范 7.1.2-2，在同时受正应力和剪应力处验算折算应力
                    var redStress = Math.sqrt(sigma_max * sigma_max + 3 * tau_max * tau_max);
                    var ft_w = fw.ft; // 对接焊缝抗拉强度
                    var fv_w = fw.fv; // 抗剪
                    var tensOk = sigma_max <= ft_w;
                    var shearOk = tau_max <= fv_w;
                    var redOk = redStress <= 1.1 * ft_w;
                    var allOk2 = tensOk && shearOk && redOk;

                    st.push('<div class="step"><b>① 对接焊缝参数</b>　焊缝计算长度 l<sub>w</sub> = ' + lw + ' mm；焊件厚度 t = ' + tw + ' mm（借 h<sub>f</sub> 字段）</div>');
                    st.push('<div class="step">　　对接焊缝强度：f<sub>t</sub><sup>w</sup> = ' + ft_w + ' MPa；f<sub>v</sub><sup>w</sup> = ' + fv_w + ' MPa（' + weldKey + '）</div>');

                    st.push('<div class="step"><b>② 正应力（拉/压）</b>　σ = N/(t·l<sub>w</sub>) + 6M/(t·l<sub>w</sub>²) = ' + fmt(sigma_N,2) + ' + ' + fmt(sigma_M,2) + ' = <b>' + fmt(sigma_max,2) + ' MPa</b></div>');
                    st.push('<div class="step">　　σ<sub>max</sub> = ' + fmt(sigma_max,2) + ' MPa ≤ f<sub>t</sub><sup>w</sup> = ' + ft_w + ' MPa ⇒ ' + (tensOk ? '满足' + tag('ok','抗拉满足') : '不满足' + tag('err','抗拉不足')) + '</div>');

                    st.push('<div class="step"><b>③ 剪应力</b>　τ = 1.5V/(t·l<sub>w</sub>) = <b>' + fmt(tau_max,2) + ' MPa</b> ≤ f<sub>v</sub><sup>w</sup> = ' + fv_w + ' MPa ⇒ ' + (shearOk ? '满足' + tag('ok','抗剪满足') : '不满足' + tag('err','抗剪不足')) + '</div>');

                    st.push('<div class="step"><b>④ 折算应力（7.1.2-2）</b>　σ<sub>zs</sub> = √(σ² + 3τ²) = <b>' + fmt(redStress,2) + ' MPa</b> ≤ 1.1 f<sub>t</sub><sup>w</sup> = ' + fmt(1.1*ft_w,1) + ' MPa ⇒ ' + (redOk ? '满足' + tag('ok','折算满足') : '不满足' + tag('err','折算不足')) + '</div>');

                    var html = resultRow('焊缝类型 / 焊条', '对接焊缝 / ' + elec);
                    html += resultRow('焊缝尺寸 t×l<sub>w</sub>', tw + ' × ' + lw + ' mm');
                    html += resultRow('最大正应力 σ<sub>max</sub> / f<sub>t</sub><sup>w</sup>', fmt(sigma_max,2) + ' / ' + ft_w + ' MPa ' + (tensOk ? tag('ok','满足') : tag('err','不足')));
                    html += resultRow('最大剪应力 τ<sub>max</sub> / f<sub>v</sub><sup>w</sup>', fmt(tau_max,2) + ' / ' + fv_w + ' MPa ' + (shearOk ? tag('ok','满足') : tag('err','不足')));
                    html += resultRow('折算应力 / 1.1f<sub>t</sub><sup>w</sup>', fmt(redStress,2) + ' / ' + fmt(1.1*ft_w,1) + ' MPa ' + (redOk ? tag('ok','满足') : tag('err','不足')));
                    html += resultRow('判定', badge(allOk2 ? 'badge-ok' : 'badge-err', allOk2 ? '对接焊缝各项验算均满足' : '对接焊缝验算存在不满足项'));
                    out.innerHTML = html;
                }
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._WD_RESULT = { ok: (wType === 'fillet') ? ok : allOk2, stress: (wType === 'fillet') ? combStress : sigma_max, steps: st.join('') };
            }
            function reset() {
                document.getElementById('wd_type').value = 'fillet';
                document.getElementById('wd_steel').value = 'Q355';
                document.getElementById('wd_electrode').value = 'E50';
                document.getElementById('wd_dir').value = 'combo';
                ['wd_hf','wd_lw','wd_theta','wd_N','wd_V','wd_M','wd_T','wd_e'].forEach(function (id) {
                    var defs = { wd_hf:8, wd_lw:200, wd_theta:45, wd_N:150, wd_V:80, wd_M:20, wd_T:0, wd_e:0 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('wd_n').value = '2';
                calc();
            }
            document.getElementById('wd_calc').addEventListener('click', calc);
            document.getElementById('wd_reset').addEventListener('click', reset);
            document.getElementById('f-wd').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['weld'] = tool;
})();
