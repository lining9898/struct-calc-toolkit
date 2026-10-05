(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 建筑地基基础设计规范",
            formulaSource: "5.2.4, 5.2.5",
            limitations: "地基承载力特征值修正，基底压力验算",
            unit: "fa:kPa, pk:kPa, b,d:m",
            version: "1.0.0"
        },
        title: '地基承载力验算',
        sub: '特征值修正 · 基底压力 · 偏心距控制 · GB 50007-2011 第 5.2 条',
        render: function () {
            return '<div class="panel"><div class="panel-title">基础与地基参数</div>' +
                '<form id="f-bc"><div class="grid2">' +
                selField('bc_type', '基础类型', opts([
                    { v: 'rect', t: '柱下独立基础（矩形）' },
                    { v: 'strip', t: '墙下条形基础（每延米）' }
                ], 'rect')) +
                numField('bc_b', '基础底面宽度 b', 'm', 2.4, '矩形基础短边 / 条形基础宽度') +
                numField('bc_l', '基础底面长度 l', 'm', 3.6, '矩形基础长边；条形基础不填（填 1）') +
                numField('bc_d', '基础埋置深度 d', 'm', 1.8) +
                numField('bc_fak', '地基承载力特征值 f<sub>ak</sub>', 'kPa', 180) +
                numField('bc_etaB', '宽度修正系数 η<sub>b</sub>', '', 0.3, '按土类查表 5.2.4，如粉土 0.3、粘性土 0.0 ~ 0.3') +
                numField('bc_etaD', '深度修正系数 η<sub>d</sub>', '', 1.6, '按土类查表 5.2.4，如粉土 1.5 ~ 2.0、粘性土 1.0 ~ 1.6') +
                numField('bc_gamma', '基础底面处土重度 γ', 'kN/m³', 18.5, '地下水位以下取浮重度') +
                numField('bc_gammaM', '基础底面以上土加权平均重度 γ<sub>m</sub>', 'kN/m³', 19.0, '埋深范围内加权平均重度') +
                numField('bc_Fk', '上部结构传至基础顶轴力 F<sub>k</sub>', 'kN', 900, '标准组合下的竖向力') +
                numField('bc_Gk', '基础及填土自重 G<sub>k</sub>', 'kN', 0, '可自动计算；填 0 则按 γ<sub>G</sub>·b·l·d 估算') +
                numField('bc_Mk', '作用于基础底面弯矩 M<sub>k</sub>', 'kN·m', 120, '标准组合下的弯矩；沿基础长度方向偏心') +
                numField('bc_Vk', '水平力 V<sub>k</sub>', 'kN', 0, '水平剪力；有弯矩时可填 0') +
                '</div><div class="hint">提示：条形基础每延米计算时，l 取 1m，F<sub>k</sub>、M<sub>k</sub> 均按每延米线荷载/线弯矩填入。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="bc_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="bc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="bc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="bc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('bc_result'), proc = document.getElementById('bc_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var typeV = document.getElementById('bc_type').value;
                var b = parseFloat(document.getElementById('bc_b').value);
                var l = parseFloat(document.getElementById('bc_l').value);
                var d = parseFloat(document.getElementById('bc_d').value);
                var fak = parseFloat(document.getElementById('bc_fak').value);
                var etaB = parseFloat(document.getElementById('bc_etaB').value);
                var etaD = parseFloat(document.getElementById('bc_etaD').value);
                var gamma = parseFloat(document.getElementById('bc_gamma').value);
                var gammaM = parseFloat(document.getElementById('bc_gammaM').value);
                var Fk = parseFloat(document.getElementById('bc_Fk').value);
                var Gk_in = parseFloat(document.getElementById('bc_Gk').value);
                var Mk = parseFloat(document.getElementById('bc_Mk').value);
                var Vk = parseFloat(document.getElementById('bc_Vk').value) || 0;
                if (!(b > 0 && l > 0)) return err('基础尺寸 b、l 必须为正数。');
                if (!(d >= 0)) return err('埋深不能为负。');
                if (!(fak > 0)) return err('地基承载力特征值必须为正数。');
                if (!(Fk > 0)) return err('轴力必须为正数。');
                var st = [];

                // 基础自重及填土 Gk
                var gammaG = 20; // kN/m³ 基础及填土平均重度（简化）
                var Gk = Gk_in > 0 ? Gk_in : gammaG * b * l * d;
                var A = b * l; // m²
                var W = b * l * l / 6; // 沿 l 方向的抵抗矩 m³ (b为短边,l为长边)
                st.push('<div class="step"><b>① 基础参数与自重</b>　A = b·l = ' + fmt(b,2) + '×' + fmt(l,2) + ' = <b>' + fmt(A, 2) + ' m²</b>；' +
                    'W = b·l²/6 = ' + fmt(W, 3) + ' m³；' +
                    'G<sub>k</sub> = γ<sub>G</sub>·A·d = ' + fmt(Gk, 1) + ' kN</div>');

                // 修正后的地基承载力特征值 fa (5.2.4)
                // 注意：b < 3m 取 3m, > 6m 取 6m
                var bFa = b;
                if (bFa < 3) bFa = 3;
                if (bFa > 6) bFa = 6;
                var fa = fak + etaB * gamma * (bFa - 3) + etaD * gammaM * (d - 0.5);
                st.push('<div class="step"><b>② 承载力特征值修正（5.2.4）</b>　f<sub>a</sub> = f<sub>ak</sub> + η<sub>b</sub>γ(b−3) + η<sub>d</sub>γ<sub>m</sub>(d−0.5)</div>');
                st.push('<div class="step">　　宽度修正项：b = ' + fmt(b,2) + ' m' + (b < 3 ? '（< 3 m 取 3 m，不修正）' : (b > 6 ? '（> 6 m 取 6 m）' : '')) + '；η<sub>b</sub>γ(b−3) = ' + fmt(etaB * gamma * (bFa - 3), 2) + ' kPa</div>');
                st.push('<div class="step">　　深度修正项：η<sub>d</sub>γ<sub>m</sub>(d−0.5) = ' + etaD + '×' + gammaM + '×(' + fmt(d,2) + '−0.5) = ' + fmt(etaD * gammaM * (d - 0.5), 2) + ' kPa</div>');
                st.push('<div class="step">　　<b>f<sub>a</sub> = ' + fmt(fa, 1) + ' kPa</b></div>');

                // 基底压力 pk (5.2.2-1) 标准组合
                var pk = (Fk + Gk) / A;
                // 总弯矩 Mk + Vk*d (由水平力产生的附加弯矩, 基础底面处)
                var M_total = Mk + Vk * d;
                // 偏心距 e
                var N_total = Fk + Gk;
                var e = M_total / N_total;
                // 偏心方向基础边长 l
                var eLim = l / 6;
                var zeroTension = e <= eLim;
                st.push('<div class="step"><b>③ 基底平均压力 p<sub>k</sub>（5.2.2-1）</b>　p<sub>k</sub> = (F<sub>k</sub>+G<sub>k</sub>)/A = (' + fmt(Fk,0) + '+' + fmt(Gk,1) + ')/' + fmt(A,2) + ' = <b>' + fmt(pk, 1) + ' kPa</b></div>');
                st.push('<div class="step"><b>④ 偏心距验算</b>　M<sub>总</sub> = M<sub>k</sub>+V<sub>k</sub>·d = ' + fmt(M_total,1) + ' kN·m；' +
                    'N<sub>总</sub> = ' + fmt(N_total,1) + ' kN</div>');
                st.push('<div class="step">　　e = M/N = ' + fmt(e, 3) + ' m；l/6 = ' + fmt(eLim, 3) + ' m ⇒ ' +
                    (zeroTension ? 'e ≤ l/6，基底无零应力区' + tag('ok','无零应力') : 'e > l/6，基底存在零应力区' + tag('warn','有零应力区')) + '</div>');

                // 基底最大压力 pkmax
                var pkmax, pkmin;
                if (zeroTension) {
                    pkmax = pk + M_total / W;
                    pkmin = pk - M_total / W;
                } else {
                    // e > l/6，三角形分布，p_kmax = 2(F_k+G_k)/(3*b*(l/2 - e))
                    var a = l / 2 - e; // 受压区长度一半? 实际 a = 3(l/2 - e) = 3c (c = l/2 - e)
                    pkmax = 2 * N_total / (3 * b * (l / 2 - e));
                    pkmin = 0;
                }
                st.push('<div class="step"><b>⑤ 基底最大 / 最小压力</b>　p<sub>k,max</sub> = <b>' + fmt(pkmax, 1) + ' kPa</b>；p<sub>k,min</sub> = ' + fmt(pkmin, 1) + ' kPa</div>');

                // 承载力验算
                var pkOk = pk <= fa;
                var pkmaxOk = pkmax <= 1.2 * fa;
                st.push('<div class="step"><b>⑥ 地基承载力验算（5.2.1 / 5.2.2）</b></div>');
                st.push('<div class="step">　　p<sub>k</sub> = ' + fmt(pk,1) + ' kPa ≤ f<sub>a</sub> = ' + fmt(fa,1) + ' kPa ⇒ ' + (pkOk ? '满足' + tag('ok','pk≤fa') : '不满足' + tag('err','pk>fa')) + '</div>');
                st.push('<div class="step">　　p<sub>k,max</sub> = ' + fmt(pkmax,1) + ' kPa ≤ 1.2f<sub>a</sub> = ' + fmt(1.2*fa,1) + ' kPa ⇒ ' + (pkmaxOk ? '满足' + tag('ok','pkmax≤1.2fa') : '不满足' + tag('err','pkmax>1.2fa')) + '</div>');

                var allOk = pkOk && pkmaxOk;
                var html = resultRow('基底面积 A', fmt(A, 2) + ' m²');
                html += resultRow('修正后承载力特征值 f<sub>a</sub>', '<span class="highlight">' + fmt(fa, 1) + ' kPa</span>');
                html += resultRow('基底平均压力 p<sub>k</sub>', fmt(pk, 1) + ' kPa ' + (pkOk ? tag('ok','≤ fa') : tag('err','> fa')));
                html += resultRow('偏心距 e', fmt(e*1000, 0) + ' mm / 限值 l/6 = ' + fmt(eLim*1000, 0) + ' mm ' + (zeroTension ? tag('ok','无零应力') : tag('warn','零应力区')));
                html += resultRow('基底最大压力 p<sub>k,max</sub>', fmt(pkmax, 1) + ' kPa ' + (pkmaxOk ? tag('ok','≤ 1.2fa') : tag('err','> 1.2fa')));
                html += resultRow('判定', badge(allOk ? 'badge-ok' : 'badge-err', allOk ? '地基承载力满足要求' : '地基承载力不满足'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._BC_RESULT = { A: A, fa: fa, pk: pk, pkmax: pkmax, e: e, allOk: allOk, steps: st.join('') };
            }
            function reset() {
                ['bc_b','bc_l','bc_d','bc_fak','bc_etaB','bc_etaD','bc_gamma','bc_gammaM','bc_Fk','bc_Gk','bc_Mk','bc_Vk'].forEach(function (id) {
                    var defs = { bc_b:2.4, bc_l:3.6, bc_d:1.8, bc_fak:180, bc_etaB:0.3, bc_etaD:1.6, bc_gamma:18.5, bc_gammaM:19.0, bc_Fk:900, bc_Gk:0, bc_Mk:120, bc_Vk:0 };
                    document.getElementById(id).value = defs[id];
                });
                document.getElementById('bc_type').value = 'rect';
                calc();
            }
            document.getElementById('bc_calc').addEventListener('click', calc);
            document.getElementById('bc_reset').addEventListener('click', reset);
            document.getElementById('f-bc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['bearing-cap'] = tool;
})();
