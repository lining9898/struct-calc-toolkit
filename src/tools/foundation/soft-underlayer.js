(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 建筑地基基础设计规范",
            formulaSource: "5.2.7",
            limitations: "压力扩散角法，持力层下有软弱土层",
            unit: "pz:pcz:kPa, z:m, Es1/Es2:—",
            version: "1.0.0"
        },
        title: '软弱下卧层验算',
        sub: '附加应力扩散 · 软弱下卧层承载力 · 压力扩散角 · GB 50007-2011 §5.2.7',
        render: function () {
            return '<div class="panel"><div class="panel-title">基础参数</div>' +
                '<form id="f-su"><div class="grid2">' +
                selField('su_type', '基础类型', opts([
                    { v: 'rect', t: '矩形基础' },
                    { v: 'strip', t: '条形基础（每延米）' }
                ], 'rect')) +
                numField('su_b', '基础底面宽度 b', 'm', 2.5) +
                numField('su_l', '基础底面长度 l', 'm', 3.5, '条形基础填1') +
                numField('su_d', '基础埋置深度 d', 'm', 1.5) +
                numField('su_pk', '基底平均压力 p<sub>k</sub>', 'kPa', 180, '标准组合下基底平均压力') +
                '</div><div class="panel-title" style="margin-top:14px;">持力层与下卧层参数</div><div class="grid2">' +
                numField('su_z', '基底至下卧层顶面距离 z', 'm', 2.0, '持力层厚度') +
                numField('su_Es1', '持力层压缩模量 E<sub>s1</sub>', 'MPa', 12, '上层土压缩模量') +
                numField('su_Es2', '下卧层压缩模量 E<sub>s2</sub>', 'MPa', 4, '软弱下卧层压缩模量') +
                numField('su_faz', '下卧层承载力特征值 f<sub>az</sub>', 'kPa', 120, '下卧层顶面经深度修正后的承载力特征值') +
                numField('su_gamma_m', '下卧层顶面以上土加权平均重度 γ<sub>m</sub>', 'kN/m³', 18.5) +
                numField('su_dz', '下卧层顶面埋深 d<sub>z</sub>', 'm', 3.5, '从室外地面至下卧层顶面') +
                '</div><div class="hint">说明：依据 GB 50007-2011 §5.2.7，软弱下卧层验算公式为 p<sub>z</sub> + p<sub>cz</sub> ≤ f<sub>az</sub>。压力扩散角θ按表5.2.7取值：E<sub>s1</sub>/E<sub>s2</sub>=3时z/b=0.25取6°、z/b≥0.5取23°；E<sub>s1</sub>/E<sub>s2</sub>=5时z/b=0.25取10°、z/b≥0.5取25°；E<sub>s1</sub>/E<sub>s2</sub>=10时z/b=0.25取20°、z/b≥0.5取30°。z/b<0.25时取θ=0°。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="su_calc">验算下卧层</button>' +
                '<button type="button" class="btn btn-secondary" id="su_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">验算结果</div><div id="su_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="su_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('su_result');
                var proc = document.getElementById('su_proc');
                var typeV = document.getElementById('su_type').value;
                var b = parseFloat(document.getElementById('su_b').value);
                var l = parseFloat(document.getElementById('su_l').value);
                var d = parseFloat(document.getElementById('su_d').value);
                var pk = parseFloat(document.getElementById('su_pk').value);
                var z = parseFloat(document.getElementById('su_z').value);
                var Es1 = parseFloat(document.getElementById('su_Es1').value);
                var Es2 = parseFloat(document.getElementById('su_Es2').value);
                var faz = parseFloat(document.getElementById('su_faz').value);
                var gamma_m = parseFloat(document.getElementById('su_gamma_m').value);
                var dz = parseFloat(document.getElementById('su_dz').value);
                var st = [];

                // ① 地基压力扩散角θ（表5.2.7）
                var ratio = Es1 / Es2;
                var zb = z / b;
                var theta = 0; // degrees

                st.push('<div class="step"><b>① 持力层与下卧层模量比</b></div>');
                st.push('<div class="step">　　E<sub>s1</sub>/E<sub>s2</sub> = ' + Es1 + '/' + Es2 + ' = <b>' + fmt(ratio, 2) + '</b></div>');
                st.push('<div class="step">　　z/b = ' + z + '/' + b + ' = <b>' + fmt(zb, 3) + '</b></div>');

                if (zb < 0.25) {
                    theta = 0;
                    st.push('<div class="step">　　z/b < 0.25 → θ = <b>0°</b>（不扩散）</div>');
                } else {
                    // 插值确定θ
                    // 表5.2.7: ratio=3时, z/b=0.25→6°, z/b≥0.5→23°
                    //         ratio=5时, z/b=0.25→10°, z/b≥0.5→25°
                    //         ratio=10时, z/b=0.25→20°, z/b≥0.5→30°
                    var theta_025, theta_05;
                    if (ratio <= 3) { theta_025 = 6; theta_05 = 23; }
                    else if (ratio <= 5) {
                        theta_025 = 6 + (ratio - 3) / 2 * (10 - 6);
                        theta_05 = 23 + (ratio - 3) / 2 * (25 - 23);
                    } else if (ratio <= 10) {
                        theta_025 = 10 + (ratio - 5) / 5 * (20 - 10);
                        theta_05 = 25 + (ratio - 5) / 5 * (30 - 25);
                    } else {
                        theta_025 = 20; theta_05 = 30;
                    }
                    if (zb >= 0.5) {
                        theta = theta_05;
                    } else {
                        theta = theta_025 + (zb - 0.25) / 0.25 * (theta_05 - theta_025);
                    }
                    st.push('<div class="step">　　查表5.2.7并插值 → θ = <b>' + fmt(theta, 1) + '°</b></div>');
                    if (zb > 0.5) st.push('<div class="step">　　注：z/b > 0.50，θ值不再增加</div>');
                }

                // ② 基底自重应力 pc
                var pc = gamma_m * d;
                st.push('<div class="step"><b>② 基础底面处土的自重压力 p<sub>c</sub></b></div>');
                st.push('<div class="step">　　p<sub>c</sub> = γ<sub>m</sub>·d = ' + gamma_m + '×' + d + ' = <b>' + fmt(pc, 1) + ' kPa</b></div>');

                // ③ 附加压力 pz（式5.2.7-2 / 5.2.7-3）
                var pz;
                var thetaRad = theta * Math.PI / 180;
                var tanTheta = Math.tan(thetaRad);
                st.push('<div class="step"><b>③ 下卧层顶面附加压力 p<sub>z</sub>（式5.2.7-2/3）</b></div>');
                if (typeV === 'strip') {
                    pz = b * (pk - pc) / (b + 2 * z * tanTheta);
                    st.push('<div class="step">　　条形基础：p<sub>z</sub> = b·(p<sub>k</sub> − p<sub>c</sub>) / (b + 2z·tanθ)</div>');
                    st.push('<div class="step">　　= ' + b + '×(' + pk + '−' + fmt(pc,1) + ') / (' + b + ' + 2×' + z + '×tan' + fmt(theta,1) + '°)</div>');
                    st.push('<div class="step">　　= ' + fmt(b*(pk-pc),1) + ' / ' + fmt(b+2*z*tanTheta,3) + ' = <b>' + fmt(pz,1) + ' kPa</b></div>');
                } else {
                    pz = l * b * (pk - pc) / ((b + 2 * z * tanTheta) * (l + 2 * z * tanTheta));
                    st.push('<div class="step">　　矩形基础：p<sub>z</sub> = l·b·(p<sub>k</sub> − p<sub>c</sub>) / [(b+2z·tanθ)(l+2z·tanθ)]</div>');
                    st.push('<div class="step">　　= ' + l + '×' + b + '×' + fmt(pk-pc,1) + ' / [' + fmt(b+2*z*tanTheta,3) + '×' + fmt(l+2*z*tanTheta,3) + ']</div>');
                    st.push('<div class="step">　　= <b>' + fmt(pz,1) + ' kPa</b></div>');
                }

                // ④ 下卧层顶面自重应力 pcz
                var pcz = gamma_m * dz;
                st.push('<div class="step"><b>④ 下卧层顶面自重压力 p<sub>cz</sub></b></div>');
                st.push('<div class="step">　　p<sub>cz</sub> = γ<sub>m</sub>·d<sub>z</sub> = ' + gamma_m + '×' + dz + ' = <b>' + fmt(pcz,1) + ' kPa</b></div>');

                // ⑤ 验算 pz + pcz ≤ faz
                var total = pz + pcz;
                var ok = total <= faz;
                st.push('<div class="step"><b>⑤ 软弱下卧层承载力验算（式5.2.7-1）</b></div>');
                st.push('<div class="step">　　p<sub>z</sub> + p<sub>cz</sub> = ' + fmt(pz,1) + ' + ' + fmt(pcz,1) + ' = <b>' + fmt(total,1) + ' kPa</b></div>');
                st.push('<div class="step">　　f<sub>az</sub> = <b>' + fmt(faz,1) + ' kPa</b></div>');
                st.push('<div class="step">　　' + (ok ? '✓ 满足' : '✗ 不满足') + '：p<sub>z</sub>+p<sub>cz</sub> ' + (ok ? '≤' : '>') + ' f<sub>az</sub>' + tag(ok?'ok':'err', ok?'满足':'不满足') + '</div>');

                var html = resultRow('压力扩散角 θ', fmt(theta,1) + '°');
                html += resultRow('基底自重 p<sub>c</sub>', fmt(pc,1) + ' kPa');
                html += resultRow('下卧层顶面附加 p<sub>z</sub>', fmt(pz,1) + ' kPa');
                html += resultRow('下卧层顶面自重 p<sub>cz</sub>', fmt(pcz,1) + ' kPa');
                html += resultRow('p<sub>z</sub>+p<sub>cz</sub>', '<b>' + fmt(total,1) + ' kPa</b>');
                html += resultRow('f<sub>az</sub>', fmt(faz,1) + ' kPa');
                html += resultRow('判定', badge(ok?'badge-ok':'badge-err', ok?'软弱下卧层满足' : '不满足，需处理'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('su_type').value = 'rect';
                document.getElementById('su_b').value = 2.5;
                document.getElementById('su_l').value = 3.5;
                document.getElementById('su_d').value = 1.5;
                document.getElementById('su_pk').value = 180;
                document.getElementById('su_z').value = 2.0;
                document.getElementById('su_Es1').value = 12;
                document.getElementById('su_Es2').value = 4;
                document.getElementById('su_faz').value = 120;
                document.getElementById('su_gamma_m').value = 18.5;
                document.getElementById('su_dz').value = 3.5;
                calc();
            }
            document.getElementById('su_calc').addEventListener('click', calc);
            document.getElementById('su_reset').addEventListener('click', reset);
            document.getElementById('f-su').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['soft-underlayer'] = tool;
})();
