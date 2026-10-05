/* pile-settle 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '桩基沉降计算',
        sub: '等效作用分层总和法 · 附加应力 · 总沉降 · JGJ 94-2008 第 5.5 条',
        meta: {"standard": "JGJ 94-2008 建筑桩基技术规范", "formulaSource": "5.5.6, 5.5.11", "limitations": "等效作用分层总和法", "unit": "s:mm, p:kPa, Es:MPa", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">桩基基本参数</div>' +
                '<form id="f-pst"><div class="grid2">' +
                numField('pst_n', '桩数 n', '根', 4) +
                numField('pst_d', '桩径 d', 'mm', 600) +
                numField('pst_L', '桩长 L', 'm', 18) +
                numField('pst_sx', 'x 向桩距 s<sub>x</sub>', 'm', 1.5) +
                numField('pst_sy', 'y 向桩距 s<sub>y</sub>', 'm', 1.5) +
                numField('pst_Bx', '承台宽度 B<sub>x</sub>', 'm', 3.6) +
                numField('pst_By', '承台宽度 B<sub>y</sub>', 'm', 3.6) +
                numField('pst_Fk', '柱底轴力 F<sub>k</sub>', 'kN', 3600) +
                numField('pst_Gk', '承台及覆土重 G<sub>k</sub>', 'kN', 0, '填 0 自动估算') +
                numField('pst_pc', '承台底土自重应力 σ<sub>c</sub>', 'kPa', 36, '承台埋深范围内土自重应力；简化取 γ·d') +
                numField('pst_psi', '沉降计算经验系数 ψ', '', 0.5, '按 5.5.11；群桩沉降经验系数通常 0.3~1.0') +
                numField('pst_sallow', '允许沉降 [s]', 'mm', 50, '按规范表 5.5.4 或设计要求') +
                '</div><div class="panel-title" style="margin-top:14px;">桩端以下土层（自桩端向下）</div>' +
                '<div id="pst_layers"></div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="pst_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="pst_reset">重置</button>' +
                '<button type="button" class="btn btn-secondary" id="pst_add">+ 加一层</button>' +
                '<button type="button" class="btn btn-secondary" id="pst_rm">− 减一层</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="pst_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="pst_proc"></div></div></div></div>';
        },
        bind: function () {
            var defaultLayers = [
                { name: '① 粉质黏土', h: 3.0, Es: 8 },
                { name: '② 黏土', h: 4.0, Es: 12 },
                { name: '③ 中砂', h: 5.0, Es: 25 },
                { name: '④ 卵石', h: 6.0, Es: 50 }
            ];
            var layers = JSON.parse(JSON.stringify(defaultLayers));
            function renderLayers() {
                var html = '';
                for (var i = 0; i < layers.length; i++) {
                    html += '<div style="display:grid;grid-template-columns: 2fr 1fr 1fr;gap:10px;margin-bottom:10px;align-items:end;">' +
                        '<div class="field"><label>第 ' + (i+1) + ' 层名称</label><input type="text" value="' + layers[i].name + '" data-layer="' + i + '" data-key="name"></div>' +
                        '<div class="field"><label>层厚 h<sub>i</sub> (m)</label><input type="number" step="0.1" value="' + layers[i].h + '" data-layer="' + i + '" data-key="h"></div>' +
                        '<div class="field"><label>压缩模量 E<sub>s</sub> (MPa)</label><input type="number" step="0.1" value="' + layers[i].Es + '" data-layer="' + i + '" data-key="Es"></div>' +
                        '</div>';
                }
                document.getElementById('pst_layers').innerHTML = html;
                var inputs = document.querySelectorAll('#pst_layers input');
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
                var out = document.getElementById('pst_result'), proc = document.getElementById('pst_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var n = parseInt(document.getElementById('pst_n').value);
                var d = parseFloat(document.getElementById('pst_d').value);
                var L = parseFloat(document.getElementById('pst_L').value);
                var sx = parseFloat(document.getElementById('pst_sx').value);
                var sy = parseFloat(document.getElementById('pst_sy').value);
                var Bx = parseFloat(document.getElementById('pst_Bx').value);
                var By = parseFloat(document.getElementById('pst_By').value);
                var Fk = parseFloat(document.getElementById('pst_Fk').value);
                var Gk_in = parseFloat(document.getElementById('pst_Gk').value);
                var pc = parseFloat(document.getElementById('pst_pc').value);
                var psi = parseFloat(document.getElementById('pst_psi').value);
                var sAllow = parseFloat(document.getElementById('pst_sallow').value);
                if (!(n > 0)) return err('桩数必须为正数。');
                if (!(L > 0)) return err('桩长必须为正数。');
                if (!(Bx > 0 && By > 0)) return err('承台尺寸必须为正数。');
                if (!(Fk > 0)) return err('轴力必须为正数。');
                if (layers.length === 0) return err('至少有一层土。');
                var st = [];

                // 承台及土重
                var Gk = Gk_in > 0 ? Gk_in : 20 * Bx * By * 1.5; // 简化估算
                // 等效作用附加压力 p0（等效作用面在桩端平面）
                // 简化：p0 = (Fk + Gk - pc*A) / A_eq, A_eq 为等效作用面积
                // 按规范 5.5.6，等效作用附加压力近似取承台底平均附加压力乘以等效系数
                // 简化计算：p0z = (Fk + Gk)/A_eq - σ_cd, σ_cd 为桩端处自重应力
                // 进一步简化：取等效作用面积 = 承台面积 Ac
                var Ac = Bx * By; // m²
                var pk_total = (Fk + Gk) / Ac; // kPa, 承台底总压力
                var p0_bot = pk_total - pc; // 承台底附加压力 kPa
                // 桩端处附加压力：按等效作用分层总和法，桩端平面处附加压力 p0z = η * p0_bot
                // 简化：假定附加应力沿桩长衰减较小，取 η = 0.6 （对于群桩刚性承台近似，实际与桩距、长径比有关）
                var p0_eq = 0.5 * p0_bot; // 等效作用面（桩端）附加压力粗估
                // 规范方法：按 Mindlin 解或等代墩基法。这里用等效作用面积近似法：
                // s = ψ * Σ (p0j * z_i * α_i - p0j * z_{i-1} * α_{i-1}) / E_si
                // 用角点法，等效作用矩形取承台外包尺寸
                st.push('<div class="step"><b>① 等效作用附加压力</b>　承台底 p<sub>k</sub> = (F<sub>k</sub>+G<sub>k</sub>)/A<sub>c</sub> = ' + fmt(pk_total, 1) + ' kPa</div>');
                st.push('<div class="step">　　承台底附加压力 p<sub>0,底</sub> = p<sub>k</sub> − σ<sub>c</sub> = ' + fmt(p0_bot, 1) + ' kPa</div>');
                st.push('<div class="step">　　<span style="font-size:12px;color:var(--muted);">简化：按等效作用分层总和法，等效作用面取桩端平面，p<sub>0,eq</sub> 近似按群桩基础等代实体深基础方法估算。此处用承台底附加压力 × 0.5 作近似等效（实际应按桩端阻力比确定）。</span></div>');

                // 等代墩基法：假想从桩端向下扩展，按等效扩散角扩展到桩端以下
                // 简化：直接用承台面积作为等效作用面（偏保守），以桩端作为计算起点
                // 附加应力系数 α (角点法，矩形均布荷载)
                function alphaRect(z, b, le) {
                    var n = le / b, m = z / b;
                    if (m <= 0) return 0.25;
                    var m2 = m * m, n2 = n * n;
                    var A = m * n * Math.sqrt(m2 + n2 + 1) / (m2 + n2 + m2 * n2 + 1) * (m2 + n2 + 2) / (m2 + n2 + 1);
                    var B = Math.atan(m * n / Math.sqrt(m2 + n2 + 1));
                    return (A + B) / (2 * Math.PI);
                }

                var sTotal = 0; // mm
                var zCum = 0; // 从桩端算起 m
                var rows = '';
                for (var i = 0; i < layers.length; i++) {
                    var hi = layers[i].h; // m
                    var Esi = layers[i].Es; // MPa
                    if (hi <= 0 || Esi <= 0) continue;
                    var zTop = zCum; // m
                    var zBot = zCum + hi; // m
                    // 中心点附加应力系数 = 4 × 角点(b=Bx/2, l=By/2, z)
                    var alphaTop = 4 * alphaRect(zTop, Bx/2, By/2);
                    var alphaBot = 4 * alphaRect(zBot, Bx/2, By/2);
                    var alphaAvg = (alphaTop + alphaBot) / 2; // 平均附加应力系数（简化）
                    // s_i (mm) = p0 (kPa) * hi (m) * alphaAvg / Es (MPa) * 1000 / 1000? 算单位：
                    // p0 kPa = kN/m²; hi m; Es MPa = 1000 kPa = 1000 kN/m²
                    // s_i (m) = p0 * hi * alpha / (Es * 1000)
                    // s_i (mm) = p0 * hi * alpha / (Es * 1000) * 1000 = p0 * hi * alpha / Es
                    var si = p0_eq * hi * alphaAvg / Esi; // mm
                    sTotal += si;
                    zCum = zBot;
                    rows += '<tr><td>' + (i+1) + '</td><td>' + layers[i].name + '</td><td>' + fmt(hi,2) + '</td>' +
                        '<td>' + fmt(Esi,1) + '</td><td>' + fmt(alphaAvg,4) + '</td><td>' + fmt(si,2) + '</td></tr>';
                }
                st.push('<div class="step"><b>② 桩端下各层沉降（分层总和法简化）</b></div>');
                st.push('<div class="table-wrap"><table class="mini"><thead><tr>' +
                    '<th>层号</th><th>土层</th><th>厚度 h<sub>i</sub> (m)</th><th>E<sub>s</sub> (MPa)</th><th>平均 ᾱ</th><th>s<sub>i</sub> (mm)</th>' +
                    '</tr></thead><tbody>' + rows + '</tbody></table></div>');

                // 总沉降
                var sFinal = psi * sTotal;
                var ok = sFinal <= sAllow;
                st.push('<div class="step"><b>③ 总沉降量</b>　理论沉降 Σs<sub>i</sub> = ' + fmt(sTotal, 2) + ' mm；' +
                    '经验系数 ψ = ' + psi + ' ⇒ 最终沉降 s = ψ·Σs<sub>i</sub> = <b>' + fmt(sFinal, 1) + ' mm</b></div>');
                st.push('<div class="step"><b>④ 允许沉降比较</b>　[s] = ' + fmt(sAllow,0) + ' mm；s = ' + fmt(sFinal,1) + ' mm ⇒ ' +
                    (ok ? '满足' + tag('ok','s≤[s]') : '不满足' + tag('err','s>[s]')) + '</div>');

                var html = resultRow('等效附加压力 p<sub>0,eq</sub>', fmt(p0_eq, 1) + ' kPa（简化估算）');
                html += resultRow('计算总沉降 Σs<sub>i</sub>', fmt(sTotal, 2) + ' mm');
                html += resultRow('经验系数 ψ', fmt(psi, 2));
                html += resultRow('最终沉降量 s', '<span class="highlight">' + fmt(sFinal, 1) + ' mm</span>');
                html += resultRow('允许沉降 [s]', fmt(sAllow, 0) + ' mm ' + (ok ? tag('ok','满足') : tag('err','超出')));
                html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '桩基沉降满足要求' : '桩基沉降超出允许值'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._PST_RESULT = { sTotal: sTotal, sFinal: sFinal, ok: ok, steps: st.join('') };
            }

            function reset() {
                ['pst_n','pst_d','pst_L','pst_sx','pst_sy','pst_Bx','pst_By','pst_Fk','pst_Gk','pst_pc','pst_psi','pst_sallow'].forEach(function (id) {
                    var defs = { pst_n:4, pst_d:600, pst_L:18, pst_sx:1.5, pst_sy:1.5, pst_Bx:3.6, pst_By:3.6, pst_Fk:3600, pst_Gk:0, pst_pc:36, pst_psi:0.5, pst_sallow:50 };
                    document.getElementById(id).value = defs[id];
                });
                layers = JSON.parse(JSON.stringify(defaultLayers));
                renderLayers();
                calc();
            }
            document.getElementById('pst_calc').addEventListener('click', calc);
            document.getElementById('pst_reset').addEventListener('click', reset);
            document.getElementById('pst_add').addEventListener('click', function () {
                if (layers.length >= 8) return;
                layers.push({ name: '第 ' + (layers.length+1) + ' 层', h: 3.0, Es: 20 });
                renderLayers();
                calc();
            });
            document.getElementById('pst_rm').addEventListener('click', function () {
                if (layers.length <= 2) return;
                layers.pop();
                renderLayers();
                calc();
            });
            document.getElementById('f-pst').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            renderLayers();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pile-settle'] = tool;
})();
