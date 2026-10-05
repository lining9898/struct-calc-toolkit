(function () {
    var tool = {
        meta: {
            standard: "GB 50007-2011 建筑地基基础设计规范",
            formulaSource: "5.3.5",
            limitations: "分层总和法，最终沉降量计算",
            unit: "s:mm, p:kPa, Es:MPa",
            version: "1.0.0"
        },
        title: '地基沉降计算',
        sub: '分层总和法 · 附加应力系数 · 总沉降 · GB 50007-2011 第 5.3 条',
        render: function () {
            return '<div class="panel"><div class="panel-title">基础与荷载</div>' +
                '<form id="f-st"><div class="grid2">' +
                selField('st_type', '基础类型', opts([
                    { v: 'rect', t: '矩形基础（角点法）' },
                    { v: 'strip', t: '条形基础（线荷载）' }
                ], 'rect')) +
                numField('st_b', '基础宽度 b', 'm', 2.4) +
                numField('st_l', '基础长度 l', 'm', 3.6, '条形基础填 1（每延米）') +
                numField('st_d', '基础埋深 d', 'm', 1.8) +
                numField('st_p0', '基底附加压力 p₀', 'kPa', 140, 'p₀ = pₖ − σ<sub>cd</sub>，即扣除自重应力后的附加压力') +
                numField('st_sallow', '允许沉降值 [s]', 'mm', 200, '按规范表 5.3.4 或设计要求取值') +
                numField('st_psi', '沉降计算经验系数 ψ<sub>s</sub>', '', 1.0, '按 5.3.5 条根据 E_s 取值；1.0~1.4') +
                '</div><div class="panel-title" style="margin-top:14px;">土层参数（每层一行）</div>' +
                '<div id="st_layers"></div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="st_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="st_reset">重置</button>' +
                '<button type="button" class="btn btn-secondary" id="st_add">+ 加一层</button>' +
                '<button type="button" class="btn btn-secondary" id="st_rm">− 减一层</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="st_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="st_proc"></div></div></div></div>';
        },
        bind: function () {
            var defaultLayers = [
                { h: 2.0, Es: 8.0, name: '① 粉质黏土' },
                { h: 3.0, Es: 12.0, name: '② 黏土' },
                { h: 4.0, Es: 20.0, name: '③ 粉砂' }
            ];
            var layers = JSON.parse(JSON.stringify(defaultLayers));

            function renderLayers() {
                var html = '';
                for (var i = 0; i < layers.length; i++) {
                    html += '<div style="display:grid;grid-template-columns: 2fr 1fr 1fr;gap:10px;margin-bottom:10px;align-items:end;">' +
                        '<div class="field"><label>第 ' + (i+1) + ' 层名称</label><input type="text" value="' + layers[i].name + '" data-layer="' + i + '" data-key="name"></div>' +
                        '<div class="field"><label>厚度 h<sub>i</sub> (m)</label><input type="number" step="0.1" value="' + layers[i].h + '" data-layer="' + i + '" data-key="h"></div>' +
                        '<div class="field"><label>压缩模量 E<sub>s</sub> (MPa)</label><input type="number" step="0.1" value="' + layers[i].Es + '" data-layer="' + i + '" data-key="Es"></div>' +
                        '</div>';
                }
                document.getElementById('st_layers').innerHTML = html;
                var inputs = document.querySelectorAll('#st_layers input');
                for (var j = 0; j < inputs.length; j++) {
                    inputs[j].addEventListener('change', function () {
                        var li = parseInt(this.getAttribute('data-layer'));
                        var k = this.getAttribute('data-key');
                        if (k === 'name') layers[li][k] = this.value;
                        else layers[li][k] = parseFloat(this.value) || 0;
                        calc();
                    });
                }
            }

            function calc() {
                var out = document.getElementById('st_result'), proc = document.getElementById('st_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var typeV = document.getElementById('st_type').value;
                var b = parseFloat(document.getElementById('st_b').value);
                var l = parseFloat(document.getElementById('st_l').value);
                var d = parseFloat(document.getElementById('st_d').value);
                var p0 = parseFloat(document.getElementById('st_p0').value);
                var sAllow = parseFloat(document.getElementById('st_sallow').value);
                var psi = parseFloat(document.getElementById('st_psi').value) || 1.0;
                if (!(b > 0)) return err('基础宽度必须为正数。');
                if (!(p0 > 0)) return err('附加压力必须为正数。');
                if (layers.length === 0) return err('至少有一层土。');
                var st = [];
                st.push('<div class="step"><b>① 计算参数</b>　基础类型：' + (typeV==='rect'?'矩形基础':'条形基础') +
                    '；b = ' + fmt(b,2) + ' m；l = ' + fmt(l,2) + ' m；d = ' + fmt(d,2) + ' m；p₀ = ' + fmt(p0,1) + ' kPa；ψ<sub>s</sub> = ' + psi + '</div>');

                // 分层总和法：第 i 层沉降 s_i = (p0 * (α_i * z_i - α_{i-1} * z_{i-1}) * 4) / E_si  (角点法矩形)
                // 简化：采用平均附加应力系数 α，s_i = p0 * Δz_i * α_i_avg / E_si
                // 这里用简化近似：矩形均布荷载下角点附加应力系数 α(z/b, l/b)
                // α 由布辛奈斯克解积分得出；此处用简化公式近似
                function alphaRect(z, b, l) {
                    // 角点法矩形均布荷载角点下附加应力系数 α
                    // 采用近似公式（精度约 2~3%）
                    var n = l / b, m = z / b;
                    if (m <= 0) return 0.25;
                    // 简化近似公式（对于常见 n≥1）
                    var k = n / Math.sqrt(n * n + 1 + m * m);
                    var m2 = m * m, n2 = n * n;
                    // 使用更准确的角点公式: α = 1/(2π) [ (mn√(m²+n²+1)) / (m²+n²+m²n²+1) * (m²+n²+2)/(m²+n²+1) + arctan(mn/√(m²+n²+1)) ]
                    var A = m * n * Math.sqrt(m2 + n2 + 1) / (m2 + n2 + m2 * n2 + 1) * (m2 + n2 + 2) / (m2 + n2 + 1);
                    var B = Math.atan(m * n / Math.sqrt(m2 + n2 + 1));
                    return (A + B) / (2 * Math.PI);
                }
                function alphaStrip(z, b) {
                    // 条形基础（平面应变）均布荷载下角点附加应力系数 α
                    // α = (1/π) * [arctan(1/(z/b)) + (z/b) / (1 + (z/b)^2)]
                    var m = z / b;
                    if (m <= 0) return 0.5;
                    return (Math.atan(1/m) + m / (1 + m*m)) / Math.PI;
                }

                var sTotal = 0; // mm
                var zCum = 0; // 从基底算起的累计深度 m
                var layerRows = '';
                for (var i = 0; i < layers.length; i++) {
                    var hi = layers[i].h;
                    var Esi = layers[i].Es; // MPa
                    if (hi <= 0 || Esi <= 0) continue;
                    var zTop = zCum;
                    var zBot = zCum + hi;
                    var alphaTop, alphaBot;
                    if (typeV === 'rect') {
                        // 角点法，四点叠加 = 4倍角点
                        alphaTop = 4 * alphaRect(zTop, b/2, l/2); // 用 b/2, l/2 表示角点，不对
                        // 正确：角点法把基底分为4个矩形，每个矩形 b=b/2, l=l/2
                        // 中心点的 σ_z = 4 * α(b/2, l/2, z) * p0
                        // 平均附加应力系数ar{α} 用角点法的平均应力系数表
                        // 此处简化：取中点下附加应力系数的平均值代替平均附加应力系数
                        var acTop = alphaRect(zTop, b/2, l/2);
                        var acBot = alphaRect(zBot, b/2, l/2);
                        alphaTop = 4 * acTop; // 中心点
                        alphaBot = 4 * acBot;
                    } else {
                        alphaTop = 2 * alphaStrip(zTop, b/2); // 条形基础中心点 = 2*角点
                        alphaBot = 2 * alphaStrip(zBot, b/2);
                    }
                    var alphaAvg = (alphaTop + alphaBot) / 2; // 层平均附加应力系数（简化）
                    // s_i (mm) = p0 (kPa) * hi (m) * alphaAvg / Es (MPa) * 1000 (m->mm) / 1000 (kPa->MPa? 注意单位)
                    // 单位：p0 kPa = kN/m², Es MPa = N/mm² = 1000 kN/m²
                    // s_i (m) = p0 * hi * alphaAvg / (Es * 1000)   (Es 单位换算：MPa = 1000 kPa)
                    // s_i (mm) = p0 * hi * alphaAvg / (Es * 1000) * 1000 = p0 * hi * alphaAvg / Es
                    var si = p0 * hi * alphaAvg / Esi; // mm
                    // 以上推导：p0(kPa) * hi(m) * α / (Es(MPa)*1000) 得到 m，×1000 得到 mm => p0*hi*α / Es (mm)
                    sTotal += si;
                    zCum = zBot;
                    layerRows += '<tr><td>' + (i+1) + '</td><td>' + layers[i].name + '</td><td>' + fmt(hi,2) + '</td>' +
                        '<td>' + fmt(Esi,1) + '</td><td>' + fmt(alphaAvg,4) + '</td><td>' + fmt(si,2) + '</td></tr>';
                }

                st.push('<div class="step"><b>② 各土层沉降（分层总和法，角点法简化）</b></div>');
                st.push('<div class="table-wrap"><table class="mini"><thead><tr>' +
                    '<th>层号</th><th>土层</th><th>厚度 h<sub>i</sub> (m)</th><th>E<sub>s</sub> (MPa)</th><th>平均附加应力系数 ᾱ</th><th>沉降 s<sub>i</sub> (mm)</th>' +
                    '</tr></thead><tbody>' + layerRows + '</tbody></table></div>');

                // 总沉降（考虑经验系数）
                var sFinal = psi * sTotal;
                var ok = sFinal <= sAllow;
                st.push('<div class="step"><b>③ 总沉降量</b>　理论计算沉降 Σs<sub>i</sub> = ' + fmt(sTotal, 2) + ' mm；' +
                    'ψ<sub>s</sub> = ' + psi + ' ⇒ 最终沉降 s = ψ<sub>s</sub>·Σs<sub>i</sub> = <b>' + fmt(sFinal, 1) + ' mm</b></div>');
                st.push('<div class="step"><b>④ 允许沉降比较</b>　[s] = ' + fmt(sAllow,0) + ' mm；s = ' + fmt(sFinal,1) + ' mm ⇒ ' +
                    (ok ? '满足' + tag('ok','s≤[s]') : '不满足' + tag('err','s>[s]')) + '</div>');

                var html = resultRow('计算总沉降 Σs<sub>i</sub>', fmt(sTotal, 2) + ' mm');
                html += resultRow('经验系数 ψ<sub>s</sub>', fmt(psi, 2));
                html += resultRow('最终沉降量 s', '<span class="highlight">' + fmt(sFinal, 1) + ' mm</span>');
                html += resultRow('允许沉降 [s]', fmt(sAllow, 0) + ' mm ' + (ok ? tag('ok','满足') : tag('err','超出')));
                html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '地基沉降满足要求' : '地基沉降超出允许值'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._ST_RESULT = { sTotal: sTotal, sFinal: sFinal, ok: ok, steps: st.join('') };
            }

            function reset() {
                document.getElementById('st_type').value = 'rect';
                ['st_b','st_l','st_d','st_p0','st_sallow','st_psi'].forEach(function (id) {
                    var defs = { st_b:2.4, st_l:3.6, st_d:1.8, st_p0:140, st_sallow:200, st_psi:1.0 };
                    document.getElementById(id).value = defs[id];
                });
                layers = JSON.parse(JSON.stringify(defaultLayers));
                renderLayers();
                calc();
            }

            document.getElementById('st_calc').addEventListener('click', calc);
            document.getElementById('st_reset').addEventListener('click', reset);
            document.getElementById('st_add').addEventListener('click', function () {
                if (layers.length >= 8) return;
                layers.push({ h: 2.0, Es: 15.0, name: '第 ' + (layers.length+1) + ' 层' });
                renderLayers();
                calc();
            });
            document.getElementById('st_rm').addEventListener('click', function () {
                if (layers.length <= 1) return;
                layers.pop();
                renderLayers();
                calc();
            });
            document.getElementById('f-st').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            renderLayers();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['settlement'] = tool;
})();
