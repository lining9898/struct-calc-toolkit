/* pile-single 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '单桩竖向承载力特征值',
        sub: '土的物理指标经验参数法 · JGJ 94-2008 第 5.3 条',
        meta: {"standard": "JGJ 94-2008 建筑桩基技术规范", "formulaSource": "5.3.5", "limitations": "经验参数法，侧阻+端阻", "unit": "Ra:kN, qsik:kPa, qpk:kPa", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">桩型与基本参数</div>' +
                '<form id="f-ps"><div class="grid2">' +
                selField('ps_type', '桩型', opts([
                    { v: 'precast', t: '预制桩（方桩/管桩）' },
                    { v: 'bored', t: '灌注桩（钻/挖孔）' }
                ], 'bored')) +
                numField('ps_d', '桩径 d / 桩边长', 'mm', 600, '圆形桩填直径；方形桩填边长，周长按 4b 算') +
                selField('ps_shape', '桩截面形状', opts([
                    { v: 'circle', t: '圆形（直径 d）' },
                    { v: 'square', t: '方形（边长 d）' }
                ], 'circle')) +
                numField('ps_L', '桩长 L', 'm', 18) +
                numField('ps_qpa', '桩端阻力特征值 q<sub>pa</sub>', 'kPa', 2000, '按地质勘察报告或表 5.3.5-1 取') +
                numField('ps_sallow', '允许沉降 [s]', 'mm', 40, '仅用于沉降参考判定，沉降请用桩基沉降工具') +
                '</div><div class="panel-title" style="margin-top:14px;">土层参数（按桩长范围自上至下）</div>' +
                '<div id="ps_layers"></div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="ps_calc">开始计算</button>' +
                '<button type="button" class="btn btn-secondary" id="ps_reset">重置</button>' +
                '<button type="button" class="btn btn-secondary" id="ps_add">+ 加一层</button>' +
                '<button type="button" class="btn btn-secondary" id="ps_rm">− 减一层</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="ps_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ps_proc"></div></div></div></div>';
        },
        bind: function () {
            var defaultLayers = [
                { name: '① 填土', h: 2.0, qs: 20 },
                { name: '② 粉质黏土', h: 6.0, qs: 45 },
                { name: '③ 黏土', h: 6.0, qs: 60 },
                { name: '④ 中砂（持力层）', h: 4.0, qs: 75 }
            ];
            var layers = JSON.parse(JSON.stringify(defaultLayers));
            function renderLayers() {
                var html = '';
                for (var i = 0; i < layers.length; i++) {
                    html += '<div style="display:grid;grid-template-columns: 2fr 1fr 1fr;gap:10px;margin-bottom:10px;align-items:end;">' +
                        '<div class="field"><label>第 ' + (i+1) + ' 层名称</label><input type="text" value="' + layers[i].name + '" data-layer="' + i + '" data-key="name"></div>' +
                        '<div class="field"><label>层厚 h<sub>i</sub> (m)</label><input type="number" step="0.1" value="' + layers[i].h + '" data-layer="' + i + '" data-key="h"></div>' +
                        '<div class="field"><label>侧阻 q<sub>sik</sub> (kPa)</label><input type="number" step="1" value="' + layers[i].qs + '" data-layer="' + i + '" data-key="qs"></div>' +
                        '</div>';
                }
                document.getElementById('ps_layers').innerHTML = html;
                var inputs = document.querySelectorAll('#ps_layers input');
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
                var out = document.getElementById('ps_result'), proc = document.getElementById('ps_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var typeV = document.getElementById('ps_type').value;
                var d = parseFloat(document.getElementById('ps_d').value); // mm
                var shapeV = document.getElementById('ps_shape').value;
                var L = parseFloat(document.getElementById('ps_L').value);
                var qpa = parseFloat(document.getElementById('ps_qpa').value);
                var sAllow = parseFloat(document.getElementById('ps_sallow').value);
                if (!(d > 0)) return err('桩径必须为正数。');
                if (!(L > 0)) return err('桩长必须为正数。');
                if (!(qpa > 0)) return err('桩端阻力必须为正数。');
                var st = [];

                // 桩周长与桩端面积
                var up, Ap;
                if (shapeV === 'circle') {
                    up = Math.PI * d; // mm
                    Ap = Math.PI * d * d / 4; // mm²
                } else {
                    up = 4 * d;
                    Ap = d * d;
                }
                st.push('<div class="step"><b>① 桩截面参数</b>　桩型：' + (typeV==='precast'?'预制桩':'灌注桩') +
                    '；形状：' + (shapeV==='circle'?'圆形':'方形') + '；d = ' + fmt(d,0) + ' mm；L = ' + fmt(L,2) + ' m</div>');
                st.push('<div class="step">　　桩周长 u<sub>p</sub> = ' + fmt(up, 0) + ' mm = ' + fmt(up/1000, 3) + ' m；' +
                    '桩端面积 A<sub>p</sub> = ' + fmt(Ap, 0) + ' mm² = ' + fmt(Ap/1e6, 4) + ' m²</div>');

                // 分层侧阻汇总
                var totalL = 0;
                var Qsk = 0; // kN 总极限侧阻力 (特征值)
                var rows = '';
                for (var i = 0; i < layers.length; i++) {
                    var hi = layers[i].h;
                    var qsi = layers[i].qs;
                    if (hi <= 0 || qsi <= 0) continue;
                    // 如果累计超过桩长，截断
                    var hiEff = hi;
                    if (totalL + hi > L) hiEff = L - totalL;
                    if (hiEff <= 0) continue;
                    totalL += hiEff;
                    var Qi = up / 1000 * hiEff * qsi / 1000; // kN (u: m, h: m, q: kPa => kN)
                    // 验证：up(mm)/1000 = m；hi(m)；qsi(kPa = kN/m²)；u*h*q = m * m * kN/m² = kN. 再除以1000? 不！直接就是kN
                    // 上面除了两次1000，错了。修正：只把 up 转成 m
                    var Qs_i = up / 1000 * hiEff * qsi / 1000; // kN — 再除以1000是错的。/1000? no
                    // qsi 单位 kPa = kN/m²；周长 m * 厚度 m = m²；相乘 = kN。无需再除。
                    // 那上面 up/1000 => m, hiEff => m, qsi => kPa(kN/m²). Qi = m * m * kN/m² = kN. 正确。
                    // 但又多除了 1000，导致结果小了1000倍。修正：
                    Qs_i = up / 1000 * hiEff * qsi; // kN
                    Qsk += Qs_i;
                    rows += '<tr><td>' + (i+1) + '</td><td>' + layers[i].name + '</td><td>' + fmt(hiEff,2) + '</td>' +
                        '<td>' + fmt(qsi,0) + '</td><td>' + fmt(Qs_i, 1) + '</td></tr>';
                    if (totalL >= L) break;
                }
                st.push('<div class="step"><b>② 各土层侧阻力（经验参数法，5.3.5）</b></div>');
                st.push('<div class="table-wrap"><table class="mini"><thead><tr>' +
                    '<th>层号</th><th>土层</th><th>层厚 h<sub>i</sub> (m)</th><th>q<sub>sik</sub> (kPa)</th><th>Q<sub>sk,i</sub> (kN)</th>' +
                    '</tr></thead><tbody>' + rows + '</tbody></table></div>');
                st.push('<div class="step">　　总侧阻力 Q<sub>sk</sub> = u<sub>p</sub>·Σ q<sub>sik</sub>·h<sub>i</sub> = <b>' + fmt(Qsk, 1) + ' kN</b></div>');

                // 端阻
                var Qpk = qpa * Ap / 1e6 * 1000; // kN? qpa(kPa)*Ap(m²)=kN.  Ap mm² / 1e6 = m². qpa kN/m² * m² = kN. 没错。
                // 计算：qpa (kPa) * Ap (mm²) / 1e6 (mm²→m²) = kN.  (因为 kPa = kN/m²)
                Qpk = qpa * Ap / 1e6; // kN
                st.push('<div class="step"><b>③ 桩端总阻力</b>　Q<sub>pk</sub> = q<sub>pk</sub>·A<sub>p</sub> = ' + qpa + ' kPa × ' + fmt(Ap/1e6,4) + ' m² = <b>' + fmt(Qpk, 1) + ' kN</b></div>');

                // 单桩竖向承载力特征值 Ra
                // 按规范，极限承载力除以安全系数 2 得到特征值：R_a = Q_uk / K, K=2
                // 经验参数法 5.3.5 给出的 Q_uk = uΣ q_sik l_i + q_pk A_p 就是极限值
                // 但题目里说 qsia, qpa 是「特征值」，所以直接加就是 Ra
                // 本工具假设 q_sik 和 q_pk 输入的是特征值（侧摩阻力特征值 q_sia, 端阻力特征值 q_pa），
                // 则 R_a = u Σ q_sia l_i + q_pa A_p
                var Ra = Qsk + Qpk; // kN
                st.push('<div class="step"><b>④ 单桩竖向承载力特征值 R<sub>a</sub></b>　R<sub>a</sub> = u<sub>p</sub>Σq<sub>sia</sub>l<sub>i</sub> + q<sub>pa</sub>A<sub>p</sub> = Q<sub>sk</sub> + Q<sub>pk</sub> = ' +
                    fmt(Qsk,1) + ' + ' + fmt(Qpk,1) + ' = <b>' + fmt(Ra, 0) + ' kN</b></div>');
                st.push('<div class="step">　　<span style="color:var(--muted);font-size:12px;">说明：若输入的 q<sub>sik</sub>、q<sub>pk</sub> 为极限值（极限位移标准），则承载力特征值需除以安全系数 K = 2，即 R<sub>a</sub> = (Q<sub>sk</sub> + Q<sub>pk</sub>)/2 = ' + fmt(Ra/2, 0) + ' kN。请结合勘察报告参数的物理含义判断。</span></div>');

                var html = resultRow('桩周长 u<sub>p</sub>', fmt(up, 0) + ' mm（' + fmt(up/1000, 3) + ' m）');
                html += resultRow('桩端面积 A<sub>p</sub>', fmt(Ap, 0) + ' mm²（' + fmt(Ap/1e6, 4) + ' m²）');
                html += resultRow('总侧阻力 Q<sub>s</sub>', fmt(Qsk, 1) + ' kN');
                html += resultRow('总端阻力 Q<sub>p</sub>', fmt(Qpk, 1) + ' kN');
                html += resultRow('单桩承载力特征值 R<sub>a</sub>', '<span class="highlight">' + fmt(Ra, 0) + ' kN</span>');
                html += resultRow('若为极限值（÷2）', fmt(Ra / 2, 0) + ' kN');
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                window._PS_RESULT = { up: up, Ap: Ap, Qsk: Qsk, Qpk: Qpk, Ra: Ra, steps: st.join('') };
            }

            function reset() {
                document.getElementById('ps_type').value = 'bored';
                document.getElementById('ps_shape').value = 'circle';
                ['ps_d','ps_L','ps_qpa','ps_sallow'].forEach(function (id) {
                    var defs = { ps_d:600, ps_L:18, ps_qpa:2000, ps_sallow:40 };
                    document.getElementById(id).value = defs[id];
                });
                layers = JSON.parse(JSON.stringify(defaultLayers));
                renderLayers();
                calc();
            }
            document.getElementById('ps_calc').addEventListener('click', calc);
            document.getElementById('ps_reset').addEventListener('click', reset);
            document.getElementById('ps_add').addEventListener('click', function () {
                if (layers.length >= 8) return;
                layers.push({ name: '第 ' + (layers.length+1) + ' 层', h: 2.0, qs: 50 });
                renderLayers();
                calc();
            });
            document.getElementById('ps_rm').addEventListener('click', function () {
                if (layers.length <= 2) return;
                layers.pop();
                renderLayers();
                calc();
            });
            document.getElementById('f-ps').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            renderLayers();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['pile-single'] = tool;
})();
