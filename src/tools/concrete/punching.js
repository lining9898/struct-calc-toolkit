(function () {
    var tool = {
        title: '受冲切承载力验算',
        sub: '板内柱不配置抗冲切钢筋验算 · GB/T 50010-2010（2024年版） 第 6.5.1 条',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '6.5.1',
            limitations: '非预应力、无孔洞、无不平衡弯矩、柱居中且计算周长完整的板；不含边角柱及基础专用算法',
            unit: 'Fl:kN, η:—, h0:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">冲切条件</div>' +
                '<form id="f-pc"><div class="grid2">' +
                selField('pc_shape', '冲切体形状', opts([{v:'rect',t:'矩形柱冲切（柱下板）'},{v:'circ',t:'圆形柱/集中荷载冲切'}], 'rect')) +
                numField('pc_bc', '柱截面短边 / 荷载宽 b<sub>c</sub>', 'mm', 400, '矩形柱：短边；圆形：直径') +
                numField('pc_hc', '柱截面长边 / 荷载长 h<sub>c</sub>', 'mm', 400, '矩形柱：长边；圆形与 b_c 相同') +
                numField('pc_h', '板厚度 h', 'mm', 600) +
                numField('pc_h0', '有效高度 h<sub>0</sub>', 'mm', 560, '受拉钢筋合力点至受压边缘距离') +
                numField('pc_B', '板短边 b', 'm', 3.0, '板或基础底面短边尺寸') +
                numField('pc_L', '板长边 L', 'm', 3.0, '板或基础底面长边尺寸') +
                selField('pc_con', '混凝土强度等级', conOpts('C30')) +
                numField('pc_Fl', '冲切力设计值 F<sub>l</sub>', 'kN', 800, '冲切破坏锥体以外的地基净反力（或荷载）设计值的合力') +
                numField('pc_aspect', '柱的长边/短边比 β<sub>s</sub>', '—', 1.0, '矩形柱 h<sub>c</sub>/b<sub>c</sub>；圆形计算取2；矩形小于2按2计算，大于4不在本模块范围') +
                numField('pc_alpha_s', '板柱中柱 α<sub>s</sub>', '—', 40, '本模块仅计算中柱40；边角柱需按实际边界取周长') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="pc_calc">验算受冲切</button>' +
                '<button type="button" class="btn btn-secondary" id="pc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">受冲切承载力计算结果</div><div id="pc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="pc_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('pc_result');
                var proc = document.getElementById('pc_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }

                var shape = document.getElementById('pc_shape').value;
                var bc = parseFloat(document.getElementById('pc_bc').value);
                var hc = parseFloat(document.getElementById('pc_hc').value);
                var h = parseFloat(document.getElementById('pc_h').value);
                var h0 = parseFloat(document.getElementById('pc_h0').value);
                var B = parseFloat(document.getElementById('pc_B').value);
                var L = parseFloat(document.getElementById('pc_L').value);
                var con = CONCRETE[document.getElementById('pc_con').value];
                var Fl = parseFloat(document.getElementById('pc_Fl').value);
                var beta_s = parseFloat(document.getElementById('pc_aspect').value);
                var alpha_s = parseFloat(document.getElementById('pc_alpha_s').value);

                if (!(bc > 0 && hc > 0)) return err('柱截面尺寸必须为正数。');
                if (!(h > 0 && h0 > 0)) return err('板厚与有效高度必须为正数。');
                if (h0 >= h) return err('有效高度 h<sub>0</sub> 应小于板厚 h。');
                if (!(B > 0 && L > 0)) return err('基础尺寸必须为正数。');
                if (!(Fl > 0)) return err('冲切力必须为正数。');
                if (con.fc < CONCRETE.C25.fc) return err('钢筋混凝土板强度等级不得低于 C25。');
                if (alpha_s !== 40) return err('本模块仅支持中柱完整计算周长；边柱、角柱须另按板边界确定周长。');
                if (shape === 'rect' && hc < bc) return err('长边 hc 应不小于短边 bc。');
                if (shape === 'rect' && Math.abs(beta_s - hc / bc) > 0.001) return err('输入的长短边比必须与柱截面尺寸一致。');
                if (shape === 'rect' && hc / bc > 4) return err('长短边比超过规范建议范围，需专项分析。');
                if (B * 1000 <= bc + h0 || L * 1000 <= (shape === 'rect' ? hc : bc) + h0) return err('计算周长超出板边界，不能采用完整中柱周长。');
                beta_s = shape === 'rect' ? Math.max(2, hc / bc) : 2;

                var ft = con.ft; // N/mm²
                var beta_c = 1.0; // 混凝土强度影响系数，≤C50 取 1.0
                if (document.getElementById('pc_con').value === 'C50') beta_c = 1.0; // C50 及以下取 1.0，C80 取 0.8

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　柱截面 b<sub>c</sub>×h<sub>c</sub> = ' + bc + '×' + hc + ' mm；板厚 h = ' + h + ' mm，h<sub>0</sub> = ' + h0 + ' mm；f<sub>t</sub> = ' + ft + ' N/mm²；β<sub>c</sub> = ' + beta_c + '（≤C50 取 1.0）；F<sub>l</sub> = ' + Fl + ' kN。</div>');

                // β_hp：受冲切承载力截面高度影响系数
                // h ≤ 800mm → 1.0；h ≥ 2000mm → 0.9；中间线性插值
                var beta_hp;
                if (h <= 800) beta_hp = 1.0;
                else if (h >= 2000) beta_hp = 0.9;
                else beta_hp = 1.0 - (h - 800) / 1200 * 0.1;

                // 冲切破坏锥体周长 u_m：距离柱周边 h0/2 处的周长
                // 矩形柱：u_m = 2×(b_c + h_0) + 2×(h_c + h_0) = 2×(b_c + h_c + 2h_0)
                // 圆形柱：u_m = π×(d + h_0)
                var um, a_t, a_b; // a_t = 柱周长，a_b = 基础处周长
                if (shape === 'rect') {
                    um = 2 * (bc + h0) + 2 * (hc + h0);
                    a_t = 2 * (bc + hc);
                    a_b = um; // 45°锥底周长
                } else {
                    var d = bc;
                    um = Math.PI * (d + h0);
                    a_t = Math.PI * d;
                    a_b = um;
                }
                st.push('<div class="step"><b>② 冲切破坏锥体周长 u<sub>m</sub></b>　距柱边 h<sub>0</sub>/2 处的临界周长：u<sub>m</sub> = ' + fmt(um, 0) + ' mm；β<sub>hp</sub> = ' + fmt(beta_hp, 3) + '（h = ' + h + ' mm）。</div>');

                // 6.5.1：矩形长短边比小于2按2取值，圆形同样取2。
                var eta_1 = 0.4 + 1.2 / beta_s;

                // η_2：临界周长位置影响系数
                // η_2 = 0.5 + α_s * h0 / (4 * u_m)
                // α_s：中柱 40，边柱 30，角柱 20
                var eta_2 = 0.5 + alpha_s * h0 / (4 * um);
                var eta = Math.min(eta_1, eta_2);

                st.push('<div class="step"><b>③ 冲切承载力系数 η</b>　η<sub>1</sub> = 0.4 + 1.2/β<sub>s</sub> = 0.4 + 1.2/' + fmt(beta_s,2) + ' = ' + fmt(eta_1, 3) + '；η<sub>2</sub> = 0.5 + α<sub>s</sub>·h<sub>0</sub>/(4·u<sub>m</sub>) = 0.5 + ' + alpha_s + '×' + h0 + '/(4×' + fmt(um,0) + ') = ' + fmt(eta_2, 3) + '；取 η = min = <b>' + fmt(eta, 3) + '</b></div>');

                // 受冲切承载力 F_lu = 0.7 * β_hp * f_t * η * u_m * h_0
                var Flu = 0.7 * beta_hp * ft * eta * um * h0 / 1000; // kN
                var ok = Fl <= Flu;

                st.push('<div class="step"><b>④ 受冲切承载力</b>　F<sub>l,u</sub> = 0.7·β<sub>hp</sub>·f<sub>t</sub>·η·u<sub>m</sub>·h<sub>0</sub></div>');
                st.push('<div class="step">　= 0.7 × ' + fmt(beta_hp,3) + ' × ' + ft + ' × ' + fmt(eta,3) + ' × ' + fmt(um,0) + ' × ' + h0 + ' / 1000</div>');
                st.push('<div class="step">　= <b>' + fmt(Flu, 1) + ' kN</b></div>');
                st.push('<div class="step"><b>⑤ 判定</b>　F<sub>l</sub> = ' + Fl + ' kN ' + (ok ? '≤' : '＞') + ' F<sub>l,u</sub> = ' + fmt(Flu,1) + ' kN ⇒ ' + (ok ? '受冲切承载力满足' : '不满足，需配置箍筋/弯起钢筋或加厚板') + tag(ok ? 'ok' : 'err', ok ? '满足' : '不满足') + '</div>');

                if (!ok) {
                    // 6.5.3-1仅为截面上限，不是配置钢筋后的实际承载力。
                    // 6.5.3-1：Fl ≤ 1.2 ft um h0，仅为截面上限，不含η。
                    var Flu_stir = 1.2 * ft * um * h0 / 1000; // 配置箍筋/弯起钢筋后最大承载力近似
                    st.push('<div class="step"><b>⑥ 配置箍筋/弯起钢筋后的承载力上限</b>　F<sub>l,u,max</sub> ≈ 1.2f<sub>t</sub>u<sub>m</sub>h<sub>0</sub> = ' + fmt(Flu_stir, 1) + ' kN（不配置预应力时的上限，详见 6.5.3 条）。当 F<sub>l</sub> ≤ ' + fmt(Flu_stir, 0) + ' kN 时仍须按6.5.3-2计算实际钢筋项，并按6.5.4验算配筋区外周长；本模块未完成这些验算。</div>');
                }

                var html = resultRow('受冲切截面高度影响系数 β<sub>hp</sub>', fmt(beta_hp, 3));
                html += resultRow('临界周长 u<sub>m</sub>', fmt(um, 0) + ' mm（距柱边 h<sub>0</sub>/2 处）');
                html += resultRow('η<sub>1</sub> / η<sub>2</sub>', fmt(eta_1, 3) + ' / ' + fmt(eta_2, 3));
                html += resultRow('冲切承载力系数 η（取小值）', fmt(eta, 3));
                html += resultRow('受冲切承载力 F<sub>l,u</sub>', '<span class="highlight">' + fmt(Flu, 1) + ' kN</span>');
                html += resultRow('冲切力设计值 F<sub>l</sub>', Fl + ' kN');
                html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '受冲切承载力满足' : '不满足，建议加厚板或配抗冲切钢筋'));
                if (!ok) html += resultRow('截面上限（非配筋承载力）', fmt(Flu_stir, 0) + ' kN（6.5.3 条限值）');
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._PC_RESULT = {
                    shape: shape, bc: bc, hc: hc, h: h, h0: h0, B: B, L: L,
                    conGrade: document.getElementById('pc_con').value,
                    Fl: Fl, beta_s: beta_s, alpha_s: alpha_s,
                    beta_hp: beta_hp, beta_c: beta_c, um: um,
                    eta_1: eta_1, eta_2: eta_2, eta: eta,
                    Flu: Flu, ok: ok
                };
            }

            document.getElementById('pc_calc').addEventListener('click', calc);
            document.getElementById('pc_reset').addEventListener('click', function () {
                var f = document.getElementById('f-pc'); f.reset();
                document.getElementById('pc_bc').value = 400;
                document.getElementById('pc_hc').value = 400;
                document.getElementById('pc_h').value = 600;
                document.getElementById('pc_h0').value = 560;
                document.getElementById('pc_B').value = 3.0;
                document.getElementById('pc_L').value = 3.0;
                document.getElementById('pc_Fl').value = 800;
                document.getElementById('pc_aspect').value = 1.0;
                document.getElementById('pc_alpha_s').value = 40;
                calc();
            });
            document.getElementById('f-pc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['punching'] = tool;
})();
