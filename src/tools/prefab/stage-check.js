/* stage-check 工具模块（含前置数据/函数依赖）
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    /* ---------- ⑦ 预制构件脱模吊装 ---------- */
    function plSvg(type, liftMode, a, d, L) {
        var isTruss = (type === 'cs-slab');
        var isHook = (type === 'cs-beam');
        var x0 = 20, x1 = 540, sc = 520 / (L > 0 ? L : 3.4);
        function px(m) { return x0 + m * sc; }
        var pts = [];
        if (liftMode === '2') { pts.push(px(a), px(L - a)); }
        else { pts.push(px(a), px(a + d), px(L - a - d), px(L - a)); }
        var markTxt = isTruss ? '桁架吊点（利用桁架腹杆）' : isHook ? '吊钩（直吊钩）' : '吊环';
        var mark = isTruss
            ? '<path d="M0 0 L6 -8 L-6 -8 Z" fill="#2563eb"/>'
            : isHook
            ? '<path d="M0 0 Q5 -11 5 -3 Q5 1 0 1 Q-4 1 -4 -3" fill="none" stroke="#2563eb" stroke-width="2.2"/>'
            : '<circle cx="0" cy="-5" r="5" fill="none" stroke="#2563eb" stroke-width="2.2"/>';
        var s = '<svg viewBox="0 0 560 202" style="width:100%;max-width:560px;display:block;" xmlns="http://www.w3.org/2000/svg">';
        s += '<text x="280" y="16" font-size="12" fill="#2563eb" text-anchor="middle">' + markTxt + '　' + (liftMode === '2' ? '两点吊' : '四点吊') + '</text>';
        s += '<rect x="' + x0 + '" y="40" width="520" height="18" rx="2" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>';
        if (isTruss) {
            var ty = 58;
            s += '<path d="M' + x0 + ' ' + (ty - 7) + 'H' + x1 + 'M' + x0 + ' ' + (ty + 7) + 'H' + x1 + '" stroke="#64748b" stroke-width="1"/>';
            for (var x = x0; x < x1; x += 26) {
                s += '<path d="M' + x + ' ' + (ty + 7) + ' l13 -14 M' + (x + 13) + ' ' + (ty + 7) + ' l-13 -14" stroke="#94a3b8" stroke-width="1"/>';
            }
            s += '<text x="48" y="24" font-size="11" fill="#64748b" text-anchor="middle">钢筋桁架</text>';
        }
        pts.forEach(function (p) {
            s += '<g transform="translate(' + p + ' 40)">' + mark + '</g>';
        });
        s += '<text x="' + pts[0] + '" y="72" font-size="11" fill="#64748b" text-anchor="middle">a</text>';
        s += '<text x="280" y="72" font-size="11" fill="#64748b" text-anchor="middle">L=' + fmt(L, 1) + ' m</text>';
        s += '<text x="' + pts[pts.length - 1] + '" y="72" font-size="11" fill="#64748b" text-anchor="middle">a</text>';
        s += '<path d="M20 108h520" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 4"/>';
        s += '<path d="M20 108';
        if (liftMode === '2') {
            s += ' Q' + pts[0] + ' 158 ' + pts[0] + ' 158 C' + (pts[0] + 60) + ' 120 ' + (pts[1] - 60) + ' 120 ' + pts[1] + ' 158 Q ' + x1 + ' 158 ' + x1 + ' 108';
        } else {
            s += ' Q' + pts[0] + ' 158 ' + pts[0] + ' 158 C' + (pts[0] + 40) + ' 128 ' + (pts[1] - 30) + ' 118 ' + pts[1] + ' 148 C' + (pts[2] + 30) + ' 178 ' + (pts[3] - 40) + ' 128 ' + pts[3] + ' 158 Q ' + x1 + ' 158 ' + x1 + ' 108';
        }
        s += '" fill="none" stroke="#2563eb" stroke-width="2"/>';
        s += '<text x="64" y="196" font-size="11" fill="#64748b" text-anchor="middle">支座负弯矩</text>';
        s += '<text x="280" y="98" font-size="11" fill="#2563eb" text-anchor="middle">跨中正弯矩</text>';
        s += '</svg>';
        return s;
    }
    /* 施工阶段混凝土强度标准值内插表（GB/T 50010-2010（2024年版） 表 4.1.3-1/-2，GB 50666-2011 9.2.3 按实际立方体强度线性内插） */
    var STAGE_FCK = [[20, 13.4], [25, 16.7], [30, 20.1], [35, 23.4], [40, 26.8], [45, 29.6], [50, 32.4]];
    var STAGE_FTK = [[20, 1.54], [25, 1.78], [30, 2.01], [35, 2.20], [40, 2.39], [45, 2.51], [50, 2.64]];
    function scLinterp(x, tbl) {
        if (x <= tbl[0][0]) return tbl[0][1];
        for (var i = 1; i < tbl.length; i++) {
            if (x <= tbl[i][0]) {
                var x0 = tbl[i - 1][0], x1 = tbl[i][0], y0 = tbl[i - 1][1], y1 = tbl[i][1];
                return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
            }
        }
        return tbl[tbl.length - 1][1];
    }
    var tool = {
        title: '叠合构件两阶段验算',
        sub: '叠合板 / 叠合梁施工阶段与使用阶段两阶段验算 · 支持单向板 / 双向板 · GB/T 50010-2010（2024年版） 附录 H / 第 6.2.10 条 / 静力计算手册',
        meta: {"standard": "GB/T 50010-2010（2024年版） 附录 H", "formulaSource": "H.0.1~H.0.5", "limitations": "叠合板/叠合梁施工阶段+使用阶段，两阶段受力", "unit": "M1,M2:kN·m, σs:N/mm², τ:N/mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">基本信息</div>' +
                '<form id="f-sc"><div class="grid2">' +
                selField('sc_kind', '构件类型', opts([{ v: 'slab', t: '叠合板' }, { v: 'beam', t: '叠合梁' }], 'slab')) +
                selField('sc_slab_mode', '板受力模式', opts([{ v: 'oneway', t: '单向板（梁式）' }, { v: 'twoway', t: '双向板（四边支承）' }], 'oneway'), '单向板按简支梁 M=qL²/8 计算；双向板按弹性理论弯矩系数计算（四边支承）') +
                selField('sc_support', '施工阶段支撑方式', opts([{ v: 'n', t: '无支撑（两阶段受力）' }, { v: 'y', t: '有支撑（按整体构件）' }], 'n'), 'GB/T 50010-2010（2024年版） 9.5.1：施工阶段有可靠支撑时可按整体受弯构件设计计算；无支撑时按两阶段受力验算（附录 H）') +
                // 单向板跨度
                '<div class="field" id="fld_sc_L"><label>计算跨度 L <span>(m)</span></label><input type="number" id="sc_L" value="3.4" step="0.1"><div class="hint">简支梁/单向板跨度</div></div>' +
                // 双向板跨度
                '<div class="field" id="fld_sc_Lx" style="display:none"><label>短跨跨度 L<sub>x</sub> <span>(m)</span></label><input type="number" id="sc_Lx" value="3.0" step="0.1"><div class="hint">双向板短跨方向计算跨度</div></div>' +
                '<div class="field" id="fld_sc_Ly" style="display:none"><label>长跨跨度 L<sub>y</sub> <span>(m)</span></label><input type="number" id="sc_Ly" value="4.2" step="0.1"><div class="hint">双向板长跨方向计算跨度（L<sub>y</sub> ≥ L<sub>x</sub>）</div></div>' +
                '<div class="field" id="fld_sc_edge" style="display:none"><label>四边支承条件</label><select id="sc_edge">' +
                '<option value="ssss" selected>四边简支</option>' +
                '<option value="ffff">四边固定</option>' +
                '<option value="sfsf">两邻边固定、两邻边简支</option>' +
                '<option value="fffs">三边固定、一边简支</option>' +
                '<option value="fsss">一边固定、三边简支</option>' +
                '</select><div class="hint">按弹性理论弯矩系数计算（静力计算手册）</div></div>' +
                '<div class="field" id="fld_sc_joint" style="display:none"><label>拼缝形式</label><select id="sc_joint">' +
                '<option value="integral" selected>整体式拼缝</option>' +
                '<option value="separate">分离式拼缝</option>' +
                '</select><div class="hint">整体式拼缝可按整体双向板计算；分离式拼缝不能有效传递弯矩，宜按单向板计算（JGJ 1-2014）</div></div>' +
                // 叠合板宽度 / 梁宽 / 预制层 / 叠合层
                '<div class="field" id="fld_sc_B"><label>叠合板宽度 B <span>(mm)</span></label><input type="number" id="sc_B" value="1000" step="50"><div class="hint">叠合板计算宽度，按实际板宽输入；范围 300 ~ 3000 mm</div></div>' +
                numField('sc_b', '梁宽 b', 'mm', 200, '叠合梁截面宽度') +
                numField('sc_hp', '预制层厚度 h<sub>p</sub>', 'mm', 60) +
                numField('sc_hc', '叠合层厚度 h<sub>c</sub>', 'mm', 70, '后浇叠合层厚度；全预制无叠合层时填 0') +
                selField('sc_con', '预制构件混凝土等级', conOpts('C30')) +
                selField('sc_reb', '钢筋级别', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                selField('sc_d', '钢筋直径 d', opts([
                    { v: 6, t: 'C6' }, { v: 8, t: 'C8' }, { v: 10, t: 'C10' }, { v: 12, t: 'C12' },
                    { v: 14, t: 'C14' }, { v: 16, t: 'C16' }, { v: 18, t: 'C18' }, { v: 20, t: 'C20' },
                    { v: 22, t: 'C22' }, { v: 25, t: 'C25' }
                ], '8')) +
                numField('sc_s', '配筋间距 s（叠合板）', 'mm', 200, '实配面积 = πd²/4 × B/s，按实际板宽 B 计算总配筋面积') +
                numField('sc_n', '钢筋根数 n（叠合梁）', '根', 4, '梁实配面积 = πd²/4 × n，按底部受拉钢筋根数') +
                '<div class="full" id="sc_AsShow" style="grid-column:1/-1;display:flex;align-items:center;min-height:44px;padding:10px 12px;background:#f8fafc;border:1px solid #e9edf2;border-radius:12px;font-size:14px;color:#0f172a;font-weight:600;"></div>' +
                numField('sc_as', '受拉筋合力点距离 a<sub>s</sub>', 'mm', 20) +
                numField('sc_gamma', '混凝土容重 γ', 'kN/m³', 25) +
'<div class="full" style="grid-column:1/-1;margin-top:8px;margin-bottom:-4px;font-size:13px;font-weight:600;color:#0f172a;letter-spacing:0.3px;">荷载取值</div>' +
                numField('sc_g2k', '面层吊顶自重 g<sub>2k</sub>', 'kN/m²', 1.5, '面层、吊顶、隔墙等附加恒载标准值') +
                numField('sc_q2k', '使用阶段活荷载 q<sub>2k</sub>', 'kN/m²', 2.0, '使用阶段可变荷载标准值') +
                numField('sc_qk', '施工活荷载 q<sub>k</sub>', 'kN/m²', 1.5, '施工人员、设备等均布活荷载，不宜小于 1.5 kN/m²（GB 50666-2011 第 9.2.3 条）') +
                '<div class="field" style="grid-column:1/-1;background:#f0f9ff;border:1px dashed #bae6fd;border-radius:10px;padding:10px 14px;"><label style="color:#0c4a6e;">永久荷载标准值汇总 g<sub>k</sub> <span>(kN/m²)</span></label><div id="sc_gk_sum" style="font-size:16px;font-weight:700;color:#0369a1;">—</div><div class="hint" style="color:#0369a1;">预制板自重 + 叠合层自重 + 面层吊顶自重（由厚度和容重自动计算）</div></div>' +
                numField('sc_gG', '永久荷载分项系数 γ<sub>G</sub>', '—', 1.3, 'GB 50009-2012 基本组合，永久荷载分项系数') +
                numField('sc_gQ', '可变荷载分项系数 γ<sub>Q</sub>', '—', 1.5) +
                selField('sc_ratio', '施工阶段实际强度比例 k', opts([{ v: 100, t: '100%' }, { v: 95, t: '95%' }, { v: 90, t: '90%' }, { v: 85, t: '85%' }, { v: 80, t: '80%' }, { v: 75, t: '75%' }], '100'), 'GB 50666-2011 9.2.3：按各施工环节实际达到的混凝土立方体强度线性内插 f<sub>ck</sub>/f<sub>tk</sub>') +
                '</div>' +
                '<div class="hint" id="sc_model_note" style="margin:6px 0 4px;padding:10px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;font-size:12.5px;color:#0c4a6e;line-height:1.65;display:none;">' +
                '<b>计算模型说明：</b><br>• <b>施工阶段</b>：拼缝未形成整体，预制底板离散，不具备四边支承条件，按单向简支板计算（依据 JGJ 1-2014 及叠合板施工阶段受力特点）；<br>• <b>使用阶段</b>：叠合层形成整体，整体式拼缝有效传力，四边支承成立，按双向板计算（分离式拼缝或 L<sub>y</sub>/L<sub>x</sub>＞3 时仍按单向板）。' +
                '</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="sc_calc">开始验算</button>' +
                '<button type="button" class="btn btn-secondary" id="sc_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel" id="panel_sc2"><div class="panel-title">第二阶段参数（叠合层强度与裂缝验算）</div>' +
                '<form id="f-sc2"><div class="grid2">' +
                selField('sc_con2', '叠合层混凝土等级', conOpts('C30'), '第二阶段正弯矩区段混凝土强度按叠合层取用（附录 H 第 H.0.2 条）') +
                numField('sc_psi2', '使用活载准永久系数 ψ<sub>q</sub>', '—', 0.5, 'GB 50009 准永久值系数，用于应力超前验算（H.0.7 条）') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">验算结果</div><div id="sc_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="sc_proc"></div></div></div></div>';
        },
        bind: function () {
            var out = document.getElementById('sc_result');
            var proc = document.getElementById('sc_proc');
            var f = document.getElementById('f-sc');
            function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; }
            function calc() {
                console.log('[stage-check] calc 开始');
                var kind = document.getElementById('sc_kind').value;
                var slabMode = document.getElementById('sc_slab_mode').value;
                var L = parseFloat(document.getElementById('sc_L').value);
                var Lx = document.getElementById('sc_Lx') ? parseFloat(document.getElementById('sc_Lx').value) : 0;
                var Ly = document.getElementById('sc_Ly') ? parseFloat(document.getElementById('sc_Ly').value) : 0;
                var edge = document.getElementById('sc_edge') ? document.getElementById('sc_edge').value : '1';
                var joint = document.getElementById('sc_joint') ? document.getElementById('sc_joint').value : '0';
                var B = parseFloat(document.getElementById('sc_B').value);
                var b = document.getElementById('sc_b') ? parseFloat(document.getElementById('sc_b').value) : 0;
                var hp = parseFloat(document.getElementById('sc_hp').value);
                var hc = parseFloat(document.getElementById('sc_hc').value);
                var con = document.getElementById('sc_con').value;
                var reb = document.getElementById('sc_reb').value;
                var d = parseFloat(document.getElementById('sc_d').value);
                var sVal = document.getElementById('sc_s') ? parseFloat(document.getElementById('sc_s').value) : 0;
                var nVal = document.getElementById('sc_n') ? parseFloat(document.getElementById('sc_n').value) : 0;
                var a1 = Math.PI * d * d / 4;
                var As = kind === 'slab' ? a1 * B / sVal : a1 * nVal;
                var asV = parseFloat(document.getElementById('sc_as').value);
                var gamma = parseFloat(document.getElementById('sc_gamma').value);
                var qk = parseFloat(document.getElementById('sc_qk').value);
                var gG = parseFloat(document.getElementById('sc_gG').value);
                var gQ = parseFloat(document.getElementById('sc_gQ').value);
                var ratio = parseFloat(document.getElementById('sc_ratio').value) / 100;
                var con2 = document.getElementById('sc_con2').value;
                var g2k = parseFloat(document.getElementById('sc_g2k').value);
                var q2k = parseFloat(document.getElementById('sc_q2k').value);
                var psi2 = parseFloat(document.getElementById('sc_psi2').value);
                var support = document.getElementById('sc_support') ? document.getElementById('sc_support').value : 'n';

                // ===== 参数校验 =====
                if (!(hp > 0)) return err('预制层厚度必须为正数。');
                if (hc < 0) return err('叠合层厚度不能为负。');
                if (!(d > 0)) return err('钢筋直径必须为正数。');
                if (kind === 'slab' && !(sVal > 0)) return err('配筋间距 s 必须为正数。');
                if (kind === 'beam' && !(nVal > 0)) return err('钢筋根数 n 必须为正数。');
                if (!(As > 0)) return err('实配钢筋面积 A<sub>s</sub> 必须大于 0。');
                if (!(asV > 0 && asV < hp)) return err('受拉筋合力点距离 a<sub>s</sub> 应小于预制层厚度 h<sub>p</sub>。');
                if (!(qk >= 0)) return err('施工活荷载不能为负。');
                // 施工活载低于下限警告（GB 50666-2011 第 9.2.3 条第 5 款）
                var qkWarn = qk < 1.5;
                if (!(g2k >= 0)) return err('面层吊顶等自重不能为负。');
                if (!(q2k >= 0)) return err('使用阶段活荷载不能为负。');
                if (!(psi2 >= 0 && psi2 <= 1)) return err('准永久系数 ψ<sub>q</sub> 应在 0~1 之间。');
                var c2 = CONCRETE[con2];
                if (!c2) return err('叠合层混凝土参数缺失。');
                var c = CONCRETE[con], rb = REBAR_FLEX[reb];
                var materialError = concreteRebarError(c, rb);
                if (materialError) return err(materialError);
                if (!c || !rb) return err('材料参数缺失。');
                if (!(ratio > 0 && ratio <= 1)) return err('施工阶段实际强度比例 k 必须在 1%~100% 之间。');

                // 跨度校验（按模式）
                var bEff = b;
                if (kind === 'beam') {
                    if (!(L > 0)) return err('计算跨度必须为正数。');
                    if (!(b > 0)) return err('截面宽度必须为正数。');
                    slabMode = 'oneway'; // 梁强制单向
                } else {
                    // 板：按用户输入的板宽 B 计算
                    if (!(B >= 300 && B <= 3000)) return err('叠合板宽度 B 应在 300 ~ 3000 mm 范围内。');
                    bEff = B;
                    if (slabMode === 'oneway') {
                        if (!(L > 0)) return err('计算跨度 L 必须为正数。');
                    } else {
                        if (!(Lx > 0) || !(Ly > 0)) return err('双向板长短跨跨度必须为正数。');
                        if (Ly < Lx) { var t = Lx; Lx = Ly; Ly = t; } // 自动对齐
                    }
                }

                var h = hp + hc;
                var alpha1 = c.alpha1, beta1 = c.beta1, ecu = c.ecu;
                // 施工阶段混凝土实际强度
                var gradeVal = parseFloat(con.replace('C', ''));
                var fcu = ratio * gradeVal;
                var fck = scLinterp(fcu, STAGE_FCK);
                var ftk = scLinterp(fcu, STAGE_FTK);
                var fc = fck / 1.4, ft = ftk / 1.4;
                var fy = rb.fy, es = rb.es;
                var xi_b = beta1 / (1 + fy / (es * ecu));

                // ===== 梁路径（保留原逻辑） =====
                if (kind === 'beam') {
                    calcBeamOneway({
                        L: L, b: bEff, hp: hp, hc: hc, h: h,
                        con: con, con2: con2, reb: reb, As: As, asV: asV, d: d, sVal: sVal, nVal: nVal,
                        gamma: gamma, qk: qk, gG: gG, gQ: gQ, ratio: ratio,
                        fcu: fcu, fc: fc, ft: ft, fy: fy, es: es, alpha1: alpha1, beta1: beta1, ecu: ecu, xi_b: xi_b,
                        c: c, c2: c2, gradeVal: gradeVal,
                        g2k: g2k, q2k: q2k, psi2: psi2, support: support, qkWarn: qkWarn, qkWarn: qkWarn,
                        kind: kind, a1: a1
                    });
                    return;
                }

                // ===== 板路径 =====
                if (slabMode === 'oneway') {
                    calcSlabOneway({
                        L: L, b: bEff, hp: hp, hc: hc, h: h,
                        con: con, con2: con2, reb: reb, As: As, asV: asV, d: d, sVal: sVal,
                        gamma: gamma, qk: qk, gG: gG, gQ: gQ, ratio: ratio,
                        fcu: fcu, fc: fc, ft: ft, fy: fy, es: es, alpha1: alpha1, beta1: beta1, ecu: ecu, xi_b: xi_b,
                        c: c, c2: c2, gradeVal: gradeVal,
                        g2k: g2k, q2k: q2k, psi2: psi2, support: support,
                        kind: kind, a1: a1
                    });
                } else {
                    calcSlabTwoway({
                        Lx: Lx, Ly: Ly, edge: edge, joint: joint,
                        b: bEff, hp: hp, hc: hc, h: h,
                        con: con, con2: con2, reb: reb, As: As, asV: asV, d: d, sVal: sVal,
                        gamma: gamma, qk: qk, gG: gG, gQ: gQ, ratio: ratio,
                        fcu: fcu, fc: fc, ft: ft, fy: fy, es: es, alpha1: alpha1, beta1: beta1, ecu: ecu, xi_b: xi_b,
                        c: c, c2: c2, gradeVal: gradeVal,
                        g2k: g2k, q2k: q2k, psi2: psi2, support: support, qkWarn: qkWarn,
                        kind: kind, a1: a1
                    });
                }
            }

            // ======== 函数：单向板（原逻辑，完全兼容） ========
            function calcSlabOneway(p) {
                var L = p.L, b = p.b, hp = p.hp, hc = p.hc, h = p.h;
                var fc = p.fc, ft = p.ft, fy = p.fy, es = p.es;
                var alpha1 = p.alpha1, beta1 = p.beta1, xi_b = p.xi_b, ecu = p.ecu;
                var As = p.As, asV = p.asV;
                var gamma = p.gamma, qk = p.qk, gG = p.gG, gQ = p.gQ;
                var fc2 = p.c2.fc, ft2 = p.c2.ft, alpha1_2 = p.c2.alpha1, beta1_2 = p.c2.beta1;
                var g2k = p.g2k, q2k = p.q2k, psi2 = p.psi2, support = p.support;

                var h0 = hp - asV;
                // 第一阶段荷载（kN/m）—— 每延米线荷载
                var qPre = gamma * (hp / 1000) * (b / 1000); // kN/m per m width
                var qHc = gamma * (hc / 1000) * (b / 1000);
                var qGk = qPre + qHc;
                var qQk = qk * (b / 1000);
                var qD = gG * qGk + gQ * qQk;
                // 内力（简支跨中）
                var M1Gk = qGk * L * L / 8, M1Qk = qQk * L * L / 8;
                var M1G = gG * M1Gk, M1Q = gQ * M1Qk;
                var M1 = M1G + M1Q;
                var V1Gk = qGk * L / 2, V1Qk = qQk * L / 2;
                var V1G = gG * V1Gk, V1Q = gQ * V1Qk;
                var V1 = V1G + V1Q;
                // 正截面
                var x = fy * As / (alpha1 * fc * b);
                var xb = xi_b * h0;
                var over = x > xb;
                var Mu1 = over ? alpha1 * fc * b * xb * (h0 - xb / 2) / 1e6 : fy * As * (h0 - x / 2) / 1e6;
                var capOk = M1 <= Mu1;
                // 钢筋应力
                var sig1k = M1Gk * 1e6 / (0.87 * As * h0);
                var sigSq = sig1k;
                var sigLim = 0.9 * fy;
                var sigOk = sigSq <= sigLim;
                // 受剪
                var tau = V1 * 1000 / (b * h0);
                var faceOk = tau <= 0.4;
                var vc = 0.7 * ft * b * h0 / 1000;
                var shearOk = V1 <= vc;

                // ====== 第二阶段 ======
                var h0all = h - asV;
                var q2Gk = g2k * (b / 1000);
                var q2Qk = Math.max(qk, q2k) * (b / 1000);  // 第二阶段可变荷载取施工活载与使用活载较大值（H.0.1条）
                var M2Gk = q2Gk * L * L / 8, M2Qk = q2Qk * L * L / 8;
                var M2G = gG * M2Gk, M2Q = gQ * M2Qk;
                var M2 = M1G + M2G + M2Q;
                var V2G = gG * q2Gk * L / 2, V2Q = gQ * q2Qk * L / 2;
                var V2 = V1G + V2G + V2Q;
                var xi_b2 = beta1_2 / (1 + fy / (es * ecu));
                var x2 = fy * As / (alpha1_2 * fc2 * b);
                var xb2 = xi_b2 * h0all;
                var over2 = x2 > xb2;
                var Mu2 = over2 ? alpha1_2 * fc2 * b * xb2 * (h0all - xb2 / 2) / 1e6 : fy * As * (h0all - x2 / 2) / 1e6;
                var cap2Ok = M2 <= Mu2;
                // 准永久组合：可变荷载仅取使用活载 q2k（施工活载为短期荷载，不计入准永久组合，GB 50009 第 3.1.6 条 + H.0.7 条）
                var M2qk_Qk = q2k * L * L / 8;
                var M2qk = M2Gk + psi2 * M2qk_Qk;
                var beta2 = (M1Gk < 0.35 * Mu1) ? 1.0 : 0.5 * (1 + hp / h);
                var sig2q = beta2 * M2qk * 1e6 / (0.87 * As * h0all);
                var sigSq2 = sig1k + sig2q;
                var sigLim2 = 0.9 * fy;
                var sig2Ok = sigSq2 <= sigLim2;
                var tau2 = V2 * 1000 / (b * h0all);
                var face2Ok = tau2 <= 0.4;
                var ftLow = Math.min(ft, ft2);
                var vc2 = 0.7 * ftLow * b * h0all / 1000;
                var shear2Ok = V2 <= vc2;

                // ====== 有支撑路径 ======
                if (support === 'y') {
                    var h0allS = h - asV;
                    var qsGk = qGk + g2k * (b / 1000);
                    var qsQk = Math.max(qk, q2k) * (b / 1000);  // 第二阶段可变荷载取施工活载与使用活载较大值（H.0.1条）
                    var qs = gG * qsGk + gQ * qsQk;
                    var Ms = qs * L * L / 8;
                    var Vs = qs * L / 2;
                    var MsGk = qsGk * L * L / 8, MsQk = qsQk * L * L / 8;
                    var MsG = gG * MsGk, MsQ = gQ * MsQk;
                    var xi_bS = beta1_2 / (1 + fy / (es * ecu));
                    var xs = fy * As / (alpha1_2 * fc2 * b);
                    var xbs = xi_bS * h0allS;
                    var overS = xs > xbs;
                    var MuS = overS ? alpha1_2 * fc2 * b * xbs * (h0allS - xbs / 2) / 1e6 : fy * As * (h0allS - xs / 2) / 1e6;
                    var capSOk = Ms <= MuS;
                    var MsK = MsGk + MsQk;
                    var sigSk = MsK * 1e6 / (0.87 * As * h0allS);
                    var sigSOk = sigSk <= 0.9 * fy;
                    var tauS = Vs * 1000 / (b * h0allS);
                    var faceSOk = tauS <= 0.4;
                    var ftLowS = Math.min(ft, ft2);
                    var vcS = 0.7 * ftLowS * b * h0allS / 1000;
                    var shearSOk = Vs <= vcS;
                    var allSOk = capSOk && sigSOk && faceSOk && shearSOk;
                    var stS = [];
                    var rs = {
                        mode: 'oneway', kind: p.kind, L: L, B: b, b: b, hp: hp, hc: hc, h: h, h0all: h0allS,
                        steps: stS.join(''),
                        conGrade: p.con, rebGrade: p.reb, As: As, asV: asV,
                        rebarD: p.d, rebarS: p.sVal, rebarExpr: 'C' + p.d + '@' + p.sVal,
                        gamma: gamma, qk: qk, gG: gG, gQ: gQ, ratio: p.ratio, fcu: p.fcu, fck: p.fck, ftk: p.ftk, fc: fc, ft: ft,
                        con2: p.con2, g2k: g2k, q2k: q2k, psi2: psi2,
                        support: support, fy: fy, qsGk: qsGk, qsQk: qsQk, qs: qs, Ms: Ms, Vs: Vs,
                        MsGk: MsGk, MsQk: MsQk, MsG: MsG, MsQ: MsQ, MsK: MsK,
                        fc2: fc2, ft2: ft2, xs: xs, xbs: xbs, overS: overS, MuS: MuS, capSOk: capSOk,
                        sigSk: sigSk, sigSOk: sigSOk, tauS: tauS, faceSOk: faceSOk, ftLowS: ftLowS, vcS: vcS, shearSOk: shearSOk,
                        allSOk: allSOk, qPre: qPre, qHc: qHc, qGk: qGk, qQk: qQk, qD: qD
                    };
                    var asShowS = document.getElementById('sc_AsShow');
                    if (asShowS) asShowS.innerHTML = '实配钢筋面积 A<sub>s</sub> = <span style="color:#2563eb;font-size:15px;">' + fmt(As, 1) + ' mm²/m</span>' +
                        '<span style="font-weight:400;color:#64748b;font-size:12px;margin-left:10px;">' +
                        'C' + p.d + '@' + p.sVal + '：' + fmt(p.a1, 1) + ' × ' + fmt(1000 / p.sVal, 2) + ' 根/m</span>';
                    window._SC_RESULT = rs;
                    var htmlS = '';
                    htmlS += resultRow('叠合板宽度 B', fmt(b, 0) + ' mm');
                    htmlS += '<div class="sec-title">有支撑叠合 · 按整体受弯构件验算（GB/T 50010-2010（2024年版） 9.5.1 条）</div>';
                    htmlS += resultRow('整体荷载 q', fmt(qs, 3) + ' kN/m' + '<span class="hint">（永久 ' + fmt(qsGk, 3) + ' + 可变 ' + fmt(qsQk, 3) + '）</span>');
                    htmlS += resultRow('跨中弯矩 M', fmt(Ms, 3) + ' kN·m' + '<span class="hint">q·L²/8</span>');
                    htmlS += resultRow('整体截面承载力 M<sub>u</sub>', fmt(MuS, 3) + ' kN·m ' + badge(capSOk ? 'ok' : 'err', capSOk ? '满足' : '超限'));
                    htmlS += resultRow('钢筋应力 σ<sub>sk</sub>', fmt(sigSk, 2) + ' N/mm²' + '<span class="hint">≤ 0.9f<sub>y</sub>=' + fmt(0.9 * fy, 2) + '</span>' + badge(sigSOk ? 'ok' : 'err', sigSOk ? '满足' : '超限'));
                    htmlS += resultRow('叠合面剪应力 V/(bh<sub>0</sub>)', fmt(tauS, 3) + ' N/mm²' + '<span class="hint">≤ 0.40</span>' + badge(faceSOk ? 'ok' : 'err', faceSOk ? '满足' : '超限'));
                    htmlS += resultRow('斜截面受剪 V', fmt(Vs, 3) + ' kN' + '<span class="hint">≤ ' + fmt(vcS, 3) + '</span>' + badge(shearSOk ? 'ok' : 'err', shearSOk ? '满足' : '超限'));
                    htmlS += resultRow('综合判定', badge(allSOk ? 'ok' : 'err', allSOk ? '有支撑整体验算满足' : '存在不满足项'));
                    var warnHtmlS = '';
                    if (p.qkWarn) warnHtmlS += '<div class="warn-box">⚠ 施工活荷载标准值 q<sub>k</sub> = ' + fmt(p.qk, 2) + ' kN/m²，低于 GB 50666-2011 第 9.2.3 条第 5 款规定的不宜小于 1.5 kN/m² 的要求。</div>';
                    out.innerHTML = warnHtmlS + htmlS;
                    var stS = [];
                    stS.push('<div class="step"><b>基本参数</b>　叠合板宽度 B = ' + fmt(b, 0) + ' mm（计算截面宽度按实际板宽取用）；计算跨度 L = ' + fmt(L, 2) + ' m；预制层厚度 h<sub>p</sub> = ' + fmt(hp, 0) + ' mm；叠合层厚度 h<sub>c</sub> = ' + fmt(hc, 0) + ' mm；叠合后全高 h = ' + fmt(h, 0) + ' mm。</div>');
                    stS.push('<div class="step"><b>① 支撑方式与计算模型（GB/T 50010-2010（2024年版） 9.5.1 条）</b>　施工阶段设有可靠支撑，叠合受弯构件可按整体受弯构件设计计算；施工阶段（第一阶段）荷载由临时支撑承担，预制构件无需单独验算施工阶段内力与应力超前；斜截面受剪与叠合面受剪仍按附录 H 验算。</div>');
                    stS.push('<div class="step"><b>② 整体荷载与内力（GB/T 50010-2010（2024年版） 第 9.5.1 条 + 附录 H 第 H.0.1 条）</b>　有可靠支撑时叠合构件按整体受弯构件一次加载计算。<br>　　永久荷载标准值 q<sub>Gk</sub> = 预制自重 + 叠合层自重 + 面层吊顶 = ' + fmt(qsGk, 3) + ' kN/m；可变荷载取施工活载与使用活载较大值（H.0.1条第二阶段两种工况取不利）：q<sub>Qk</sub> = max(q<sub>k</sub>, q<sub>2k</sub>) = <b>' + fmt(qsQk, 3) + ' kN/m</b>。<br>　　基本组合设计值 q = γ<sub>G</sub>·q<sub>Gk</sub> + γ<sub>Q</sub>·q<sub>Qk</sub> = ' + fmt(gG, 2) + '×' + fmt(qsGk, 3) + ' + ' + fmt(gQ, 2) + '×' + fmt(qsQk, 3) + ' = ' + fmt(qs, 3) + ' kN/m；M = q·L²/8 = ' + fmt(Ms, 3) + ' kN·m；V = q·L/2 = ' + fmt(Vs, 3) + ' kN。</div>');
                    stS.push('<div class="step"><b>③ 正截面受弯承载力（整体截面，GB/T 50010-2010（2024年版） 第 6.2.10 条 + 第 9.5.1 条）</b>　h<sub>0</sub> = h − a<sub>s</sub> = ' + fmt(h, 0) + ' − ' + fmt(asV, 0) + ' = ' + fmt(h0allS, 0) + ' mm；叠合层 f<sub>c2</sub> = ' + fmt(fc2, 2) + ' N/mm²。<br>　　受压区高度 x = f<sub>y</sub>·A<sub>s</sub> / (α<sub>1</sub>f<sub>c2</sub>b) = ' + fmt(fy, 0) + ' × ' + fmt(As, 1) + ' / (' + fmt(alpha1_2, 2) + ' × ' + fmt(fc2, 2) + ' × ' + fmt(b, 0) + ') = <b>' + fmt(xs, 1) + ' mm</b>' + (overS ? '（x＞x<sub>b</sub> = ' + fmt(xbs, 1) + ' mm，超筋，按界限取值）' : '（x≤x<sub>b</sub> = ' + fmt(xbs, 1) + ' mm，适筋）') + '。<br>　　受弯承载力 M<sub>u</sub> = ' + (overS ? 'α<sub>1</sub>f<sub>c2</sub>b·x<sub>b</sub>·(h<sub>0</sub> − x<sub>b</sub>/2) = ' + fmt(alpha1_2, 2) + ' × ' + fmt(fc2, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(xbs, 1) + ' × (' + fmt(h0allS, 0) + ' − ' + fmt(xbs/2, 1) + ') = ' + fmt(alpha1_2 * fc2 * b * xbs * (h0allS - xbs/2), 0) + ' N·mm = <b>' + fmt(MuS, 3) + ' kN·m</b>' : 'f<sub>y</sub>·A<sub>s</sub>·(h<sub>0</sub> − x/2) = ' + fmt(fy, 0) + ' × ' + fmt(As, 1) + ' × (' + fmt(h0allS, 0) + ' − ' + fmt(xs/2, 1) + ') = ' + fmt(fy * As * (h0allS - xs/2), 0) + ' N·mm = <b>' + fmt(MuS, 3) + ' kN·m</b>') + '；M = ' + fmt(Ms, 3) + ' kN·m ' + (capSOk ? '≤' : '＞') + ' M<sub>u</sub>，' + (capSOk ? '满足。' : '不满足。') + '</div>');
                    stS.push('<div class="step"><b>④ 受拉钢筋应力（GB/T 50010-2010（2024年版） 附录 H 第 H.0.7 条，σsk ≤ 0.9fy；裂缝宽度按第 7.1.2 条）</b>　σ<sub>sk</sub> = M<sub>k</sub>/(0.87A<sub>s</sub>h<sub>0</sub>) = ' + fmt(sigSk, 2) + ' N/mm² ' + (sigSOk ? '≤' : '＞') + ' 0.9f<sub>y</sub> = ' + fmt(0.9 * fy, 2) + ' N/mm²，' + (sigSOk ? '满足。' : '不满足。') + '（裂缝宽度应按 GB/T 50010-2010（2024年版） 第 7.1.2 条另行验算）</div>');
                    stS.push('<div class="step"><b>⑤ 叠合面受剪（H.0.4 条）</b>　τ = V / (b·h<sub>0</sub>) = ' + fmt(Vs, 3) + '×10³ / (' + fmt(b, 0) + ' × ' + fmt(h0allS, 0) + ') = <b>' + fmt(tauS, 3) + ' N/mm²</b> ≤ 0.4 N/mm²，' + (faceSOk ? '满足。' : '不满足。') + '</div>');
                    stS.push('<div class="step"><b>⑥ 斜截面受剪（H.0.3 条）</b>　V<sub>cs</sub> = 0.7·min(f<sub>t</sub>,f<sub>t2</sub>)·b·h<sub>0</sub> = 0.7 × ' + fmt(ftLowS, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h0allS, 0) + ' = ' + fmt(0.7 * ftLowS * b * h0allS, 0) + ' N = <b>' + fmt(vcS, 3) + ' kN</b>；V = ' + fmt(Vs, 3) + ' kN，' + (shearSOk ? '满足。' : '不满足。') + '</div>');
                    stS.push('<div class="step" style="color:#64748b"><b>注</b>　临时支撑体系自身的承载力与稳定性应按《建筑施工临时支撑结构技术规范》GB 50271-2014、《建筑施工模板安全技术规范》JGJ 162-2008 由施工方案验算，本模块不内置。</div>');
                    proc.innerHTML = stS.join('');
                    return;
                }

                // ====== 无支撑两阶段（单向板）主路径 ======
                var st = [];
                var r = {
                    mode: 'oneway', kind: p.kind, L: L, B: b, b: b, hp: hp, hc: hc, h: h, h0: h0, support: support,
                    conGrade: p.con, rebGrade: p.reb, As: As, asV: asV,
                    rebarD: p.d, rebarS: p.sVal, rebarExpr: 'C' + p.d + '@' + p.sVal,
                    gamma: gamma, qk: qk, gG: gG, gQ: gQ, ratio: p.ratio, fcu: p.fcu, fck: p.fck, ftk: p.ftk, fc: fc, ft: ft,
                    con2: p.con2, g2k: g2k, q2k: q2k, psi2: psi2,
                    h0all: h0all, q2Gk: q2Gk, q2Qk: q2Qk, M2Gk: M2Gk, M2Qk: M2Qk,
                    M2G: M2G, M2Q: M2Q, M2: M2, V2G: V2G, V2Q: V2Q, V2: V2,
                    fc2: fc2, ft2: ft2, x2: x2, xb2: xb2, over2: over2, Mu2: Mu2, cap2Ok: cap2Ok,
                    M2qk_Qk: M2qk_Qk, M2qk: M2qk, beta2: beta2, sig2q: sig2q, sigSq2: sigSq2, sigLim2: sigLim2, sig2Ok: sig2Ok,
                    tau2: tau2, face2Ok: face2Ok, ftLow: ftLow, vc2: vc2, shear2Ok: shear2Ok,
                    qPre: qPre, qHc: qHc, qGk: qGk, qQk: qQk, qD: qD,
                    M1Gk: M1Gk, M1Qk: M1Qk, M1G: M1G, M1Q: M1Q, M1: M1,
                    V1Gk: V1Gk, V1Qk: V1Qk, V1: V1,
                    x: x, xb: xb, over: over, Mu1: Mu1, capOk: capOk,
                    sig1k: sig1k, sigSq: sigSq, sigLim: sigLim, sigOk: sigOk,
                    tau: tau, faceOk: faceOk, vc: vc, shearOk: shearOk,
                    allOk: capOk && sigOk && faceOk && shearOk && cap2Ok && sig2Ok && face2Ok && shear2Ok,
                    steps: st.join('')
                };
                var asShow = document.getElementById('sc_AsShow');
                if (asShow) asShow.innerHTML = '实配钢筋面积 A<sub>s</sub> = <span style="color:#2563eb;font-size:15px;">' + fmt(As, 1) + ' mm²/m</span>' +
                    '<span style="font-weight:400;color:#64748b;font-size:12px;margin-left:10px;">' +
                    'C' + p.d + '@' + p.sVal + '：' + fmt(p.a1, 1) + ' × ' + fmt(1000 / p.sVal, 2) + ' 根/m</span>';
                window._SC_RESULT = r;
                var statusCls = r.allOk ? 'ok' : 'err';
                var statusTxt = r.allOk ? '施工阶段验算全部满足' : '存在不满足项';
                var warnHtml = '';
                if (p.qkWarn) warnHtml += '<div class="warn-box">⚠ 施工活荷载标准值 q<sub>k</sub> = ' + fmt(p.qk, 2) + ' kN/m²，低于 GB 50666-2011 第 9.2.3 条第 5 款规定的不宜小于 1.5 kN/m² 的要求。</div>';
                var html = '';
                html += resultRow('叠合板宽度 B', fmt(b, 0) + ' mm');
                html += resultRow('第一阶段荷载 q', fmt(qD, 3) + ' kN/m' + '<span class="hint">（1.3×' + fmt(qGk, 3) + ' + 1.5×' + fmt(qQk, 3) + '）</span>');
                html += resultRow('跨中弯矩设计值 M<sub>1</sub>', fmt(M1, 3) + ' kN·m');
                html += resultRow('预制截面承载力 M<sub>u1</sub>', fmt(Mu1, 3) + ' kN·m ' + badge(capOk ? 'ok' : 'err', capOk ? '满足' : '超限'));
                html += resultRow('受拉钢筋应力 σ<sub>sq</sub>', fmt(sigSq, 2) + ' N/mm²' + ' <span class="hint">σ_sq = σ_s1k（M2q=0）≤ 0.9f<sub>y</sub>=' + fmt(sigLim, 2) + '</span>' + badge(sigOk ? 'ok' : 'err', sigOk ? '满足' : '超限'));
                html += resultRow('叠合面剪应力 V/(bh<sub>0</sub>)', fmt(tau, 3) + ' N/mm²' + ' <span class="hint">≤ 0.40</span>' + badge(faceOk ? 'ok' : 'err', faceOk ? '满足' : '超限'));
                html += resultRow('斜截面受剪 V<sub>1</sub>', fmt(V1, 3) + ' kN' + ' <span class="hint">≤ ' + fmt(vc, 3) + '</span>' + badge(shearOk ? 'ok' : 'err', shearOk ? '满足' : '超限'));
                html += '<div class="sec-title">第二阶段（使用阶段，叠合构件按整体计算）</div>';
                html += resultRow('第二阶段可变荷载标准值', fmt(q2Qk, 3) + ' kN/m' + '<span class="hint">max(施工活载 q<sub>k</sub>, 使用活载 q<sub>2k</sub>)</span>');
                html += resultRow('第二阶段总荷载设计值', fmt(gG*(qGk+q2Gk) + gQ*q2Qk, 3) + ' kN/m' + '<span class="hint">γ<sub>G</sub>·(预制+叠合层+面层) + γ<sub>Q</sub>·max(q<sub>k</sub>,q<sub>2k</sub>)</span>');
                html += resultRow('第二阶段弯矩 M<sub>2</sub>', fmt(M2, 3) + ' kN·m' + ' <span class="hint">=M<sub>1G</sub>+' + fmt(M2G, 3) + '+' + fmt(M2Q, 3) + '</span>');
                html += resultRow('叠合构件承载力 M<sub>u</sub>', fmt(Mu2, 3) + ' kN·m ' + badge(cap2Ok ? 'ok' : 'err', cap2Ok ? '满足' : '超限'));
                html += resultRow('受拉钢筋应力 σ<sub>sq</sub>', fmt(sigSq2, 2) + ' N/mm²' + ' <span class="hint">σ<sub>s1k</sub>+σ<sub>s2q</sub> ≤ 0.9f<sub>y</sub>=' + fmt(sigLim2, 2) + '</span>' + badge(sig2Ok ? 'ok' : 'err', sig2Ok ? '满足' : '超限'));
                html += resultRow('叠合面剪应力 V/(bh<sub>0</sub>)', fmt(tau2, 3) + ' N/mm²' + ' <span class="hint">≤ 0.40</span>' + badge(face2Ok ? 'ok' : 'err', face2Ok ? '满足' : '超限'));
                html += resultRow('斜截面受剪 V<sub>2</sub>', fmt(V2, 3) + ' kN' + ' <span class="hint">≤ ' + fmt(vc2, 3) + '</span>' + badge(shear2Ok ? 'ok' : 'err', shear2Ok ? '满足' : '超限'));
                html += resultRow('综合判定', badge(statusCls, statusTxt));
                out.innerHTML = warnHtml + html;
                var st = [];
                st.push('<div class="step"><b>基本参数</b>　叠合板宽度 B = ' + fmt(b, 0) + ' mm（计算截面宽度按实际板宽取用，线荷载 = 面荷载 × B/1000）；计算跨度 L = ' + fmt(L, 2) + ' m；预制层厚度 h<sub>p</sub> = ' + fmt(hp, 0) + ' mm；叠合层厚度 h<sub>c</sub> = ' + fmt(hc, 0) + ' mm；叠合后全高 h = ' + fmt(h, 0) + ' mm。</div>');
                st.push('<div class="step"><b>① 荷载计算（附录 H 第 H.0.1 条）</b>　施工阶段（后浇叠合层混凝土未达强度设计值）荷载由预制构件承担，按简支构件计算：预制自重 q<sub>预制</sub> = γ·h<sub>p</sub>·b = ' + fmt(qPre, 3) + ' kN/m；叠合层自重 q<sub>叠合层</sub> = γ·h<sub>c</sub>·b = ' + fmt(qHc, 3) + ' kN/m；施工活载 q<sub>Qk</sub> = ' + fmt(qQk, 3) + ' kN/m；基本组合设计值 q = ' + fmt(gG, 2) + '×' + fmt(qGk, 3) + ' + ' + fmt(gQ, 2) + '×' + fmt(qQk, 3) + ' = ' + fmt(qD, 3) + ' kN/m。</div>');
                st.push('<div class="step"><b>② 内力计算（简支跨中）</b><span class="hint">结构力学简支梁公式（M = qL²/8，V = qL/2）</span>　M<sub>1Gk</sub> = q<sub>Gk</sub>·L²/8 = ' + fmt(M1Gk, 3) + ' kN·m；M<sub>1Qk</sub> = ' + fmt(M1Qk, 3) + ' kN·m；M<sub>1</sub> = ' + fmt(gG, 2) + '×' + fmt(M1Gk, 3) + ' + ' + fmt(gQ, 2) + '×' + fmt(M1Qk, 3) + ' = ' + fmt(M1, 3) + ' kN·m；端部剪力 V<sub>1</sub> = q·L/2 = ' + fmt(V1, 3) + ' kN。</div>');
                st.push('<div class="step"><b>③ 正截面受弯承载力（H.0.2 条，预制截面）</b>　施工阶段混凝土按实际强度取值：f<sub>cu</sub> = ' + fmt(p.ratio * 100, 0) + '%×' + fmt(p.gradeVal, 0) + ' = ' + fmt(p.fcu, 1) + ' MPa，线性内插得 f<sub>c</sub> = ' + fmt(fc, 2) + ' N/mm²（GB 50666-2011 9.2.3）。h<sub>01</sub> = h<sub>p</sub> − a<sub>s</sub> = ' + fmt(hp, 0) + ' − ' + fmt(asV, 0) + ' = ' + fmt(h0, 0) + ' mm。<br>　　受压区高度 x = f<sub>y</sub>·A<sub>s</sub> / (α<sub>1</sub>f<sub>c</sub>b) = ' + fmt(fy, 0) + ' × ' + fmt(As, 1) + ' / (' + fmt(alpha1, 2) + ' × ' + fmt(fc, 2) + ' × ' + fmt(b, 0) + ') = <b>' + fmt(x, 1) + ' mm</b>' + (over ? '（x＞x<sub>b</sub> = ξ<sub>b</sub>·h<sub>01</sub> = ' + fmt(xb, 1) + ' mm，超筋，按界限取值）' : '（x≤x<sub>b</sub> = ' + fmt(xb, 1) + ' mm，适筋）') + '。<br>　　受弯承载力 M<sub>u1</sub> = ' + (over ? 'α<sub>1</sub>f<sub>c</sub>b·x<sub>b</sub>·(h<sub>01</sub> − x<sub>b</sub>/2) = ' + fmt(alpha1, 2) + ' × ' + fmt(fc, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(xb, 1) + ' × (' + fmt(h0, 0) + ' − ' + fmt(xb/2, 1) + ') = ' + fmt(alpha1 * fc * b * xb * (h0 - xb/2), 0) + ' N·mm = <b>' + fmt(Mu1, 3) + ' kN·m</b>' : 'f<sub>y</sub>·A<sub>s</sub>·(h<sub>01</sub> − x/2) = ' + fmt(fy, 0) + ' × ' + fmt(As, 1) + ' × (' + fmt(h0, 0) + ' − ' + fmt(x/2, 1) + ') = ' + fmt(fy * As * (h0 - x/2), 0) + ' N·mm = <b>' + fmt(Mu1, 3) + ' kN·m</b>') + '；M<sub>1</sub> = ' + fmt(M1, 3) + ' kN·m ' + (capOk ? '≤' : '＞') + ' M<sub>u1</sub>，' + (capOk ? '满足。' : '不满足。') + '</div>');
                st.push('<div class="step"><b>④ 受拉钢筋应力（H.0.7 条，应力超前）</b>　施工阶段为第一阶段，无第二阶段弯矩（M<sub>2q</sub>=0），σ<sub>sq</sub> = σ<sub>s1k</sub> = M<sub>1Gk</sub>/(0.87A<sub>s</sub>h<sub>01</sub>) = ' + fmt(sig1k, 2) + ' N/mm²（近似式源自 GB/T 50010-2010（2024年版） 第 7.1.4 条）；σ<sub>sq</sub> = ' + fmt(sigSq, 2) + ' N/mm² ' + (sigOk ? '≤' : '＞') + ' 0.9f<sub>y</sub> = ' + fmt(sigLim, 2) + ' N/mm²，' + (sigOk ? '满足。' : '不满足。') + '</div>');
                st.push('<div class="step"><b>⑤ 叠合面受剪（H.0.4 条，不配箍筋板）</b>　τ = V<sub>1</sub> / (b·h<sub>01</sub>) = ' + fmt(V1, 3) + '×10³ / (' + fmt(b, 0) + ' × ' + fmt(h0, 0) + ') = <b>' + fmt(tau, 3) + ' N/mm²</b>，限值 0.4 N/mm²，' + (faceOk ? '满足。' : '不满足。') + '</div>');
                st.push('<div class="step"><b>⑥ 斜截面受剪（H.0.3 条，板不配箍筋）</b>　V<sub>cs</sub> = 0.7·f<sub>t</sub>·b·h<sub>01</sub> = 0.7 × ' + fmt(ft, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h0, 0) + ' = ' + fmt(0.7 * ft * b * h0, 0) + ' N = <b>' + fmt(vc, 3) + ' kN</b>；V<sub>1</sub> = ' + fmt(V1, 3) + ' kN，' + (shearOk ? '满足。' : '不满足。') + '</div>');
                st.push('<div class="step"><b>⑦ 第二阶段荷载与内力组合（GB/T 50010-2010（2024年版） 附录 H 第 H.0.1 条第 2 款 + 第 H.0.2 条）</b>　第二阶段叠合层达强度后，叠合构件按整体结构计算；可变荷载取施工活载与使用活载的较大值（H.0.1 条第 2 款：第二阶段考虑施工阶段和使用阶段两种工况，取不利）。<br>　　面层吊顶等自重 g<sub>2k</sub> = ' + fmt(g2k, 3) + ' kN/m²；施工活载 q<sub>k</sub> = ' + fmt(qk, 3) + ' kN/m²；使用活载 q<sub>2k</sub> = ' + fmt(q2k, 3) + ' kN/m²。<br>　　<b>基本组合可变荷载</b>：q<sub>2Qk</sub> = max(q<sub>k</sub>, q<sub>2k</sub>) = <b>' + fmt(q2Qk, 3) + ' kN/m²</b>。<br>　　正弯矩区段总弯矩设计值（H.0.2 条第 2 款公式）：M = M<sub>1G</sub> + M<sub>2G</sub> + M<sub>2Q</sub> = γ<sub>G</sub>M<sub>1Gk</sub> + γ<sub>G</sub>M<sub>2Gk</sub> + γ<sub>Q</sub>M<sub>2Qk</sub> = ' + fmt(M1G, 3) + ' + ' + fmt(M2G, 3) + ' + ' + fmt(M2Q, 3) + ' = <b>' + fmt(M2, 3) + ' kN·m</b>；端部剪力 V<sub>2</sub> = V<sub>1G</sub> + V<sub>2G</sub> + V<sub>2Q</sub> = ' + fmt(V1G, 3) + ' + ' + fmt(V2G, 3) + ' + ' + fmt(V2Q, 3) + ' = ' + fmt(V2, 3) + ' kN。</div>');
                st.push('<div class="step"><b>⑧ 叠合构件正截面承载力（H.0.2-2 条，混凝土按叠合层取用）</b>　h<sub>0</sub> = h − a<sub>s</sub> = ' + fmt(h, 0) + ' − ' + fmt(asV, 0) + ' = ' + fmt(h0all, 0) + ' mm。叠合层 f<sub>c2</sub> = ' + fmt(fc2, 2) + ' N/mm²。<br>　　受压区高度 x = f<sub>y</sub>·A<sub>s</sub> / (α<sub>1</sub>f<sub>c2</sub>b) = ' + fmt(fy, 0) + ' × ' + fmt(As, 1) + ' / (' + fmt(alpha1_2, 2) + ' × ' + fmt(fc2, 2) + ' × ' + fmt(b, 0) + ') = <b>' + fmt(x2, 1) + ' mm</b>' + (over2 ? '（x＞x<sub>b</sub> = ξ<sub>b</sub>·h<sub>0</sub> = ' + fmt(xb2, 1) + ' mm，超筋，按界限取值）' : '（x≤x<sub>b</sub> = ' + fmt(xb2, 1) + ' mm，适筋）') + '。<br>　　受弯承载力 M<sub>u</sub> = ' + (over2 ? 'α<sub>1</sub>f<sub>c2</sub>b·x<sub>b</sub>·(h<sub>0</sub> − x<sub>b</sub>/2) = ' + fmt(alpha1_2, 2) + ' × ' + fmt(fc2, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(xb2, 1) + ' × (' + fmt(h0all, 0) + ' − ' + fmt(xb2/2, 1) + ') = ' + fmt(alpha1_2 * fc2 * b * xb2 * (h0all - xb2/2), 0) + ' N·mm = <b>' + fmt(Mu2, 3) + ' kN·m</b>' : 'f<sub>y</sub>·A<sub>s</sub>·(h<sub>0</sub> − x/2) = ' + fmt(fy, 0) + ' × ' + fmt(As, 1) + ' × (' + fmt(h0all, 0) + ' − ' + fmt(x2/2, 1) + ') = ' + fmt(fy * As * (h0all - x2/2), 0) + ' N·mm = <b>' + fmt(Mu2, 3) + ' kN·m</b>') + '；M<sub>2</sub> = ' + fmt(M2, 3) + ' kN·m ' + (cap2Ok ? '≤' : '＞') + ' M<sub>u</sub>，' + (cap2Ok ? '满足。' : '不满足。') + '</div>');
                st.push('<div class="step"><b>⑨ 受拉钢筋应力超前验算（附录 H 第 H.0.7 条）</b>　σ<sub>s1k</sub> = M<sub>1Gk</sub>/(0.87A<sub>s</sub>h<sub>01</sub>) = ' + fmt(sig1k, 2) + ' N/mm²（近似式源自 GB/T 50010-2010（2024年版） 第 7.1.4 条）。<br>　　<b>准永久组合弯矩 M<sub>2q</sub>（第二阶段）</b>：可变荷载仅取使用阶段活载（施工活载为短期临时荷载，不计入准永久组合，GB 50009 第 3.1.6 条）。<br>　　M<sub>2q</sub> = M<sub>2Gk</sub> + ψ<sub>q</sub>·M<sub>2q,Qk</sub> = ' + fmt(M2Gk, 3) + ' + ' + fmt(psi2, 2) + ' × ' + fmt(M2qk_Qk, 3) + ' = ' + fmt(M2qk, 3) + ' kN·m。<br>　　β = ' + (beta2 === 1.0 ? '1.0（因 M<sub>1Gk</sub>＜0.35M<sub>u1</sub>，H.0.9 条）' : fmt(beta2, 3)) + '；σ<sub>s2q</sub> = β·M<sub>2q</sub>/(0.87A<sub>s</sub>h<sub>0</sub>) = ' + fmt(sig2q, 2) + ' N/mm²。<br>　　σ<sub>sq</sub> = σ<sub>s1k</sub> + σ<sub>s2q</sub> = ' + fmt(sig1k, 2) + ' + ' + fmt(sig2q, 2) + ' = ' + fmt(sigSq2, 2) + ' N/mm² ' + (sig2Ok ? '≤' : '＞') + ' 0.9f<sub>y</sub> = ' + fmt(sigLim2, 2) + ' N/mm²，' + (sig2Ok ? '满足。' : '不满足。') + '</div>');
                st.push('<div class="step"><b>⑩ 第二阶段受剪（H.0.3 / H.0.4 条）</b>　叠合面剪应力 τ = V<sub>2</sub> / (b·h<sub>0</sub>) = ' + fmt(V2, 3) + '×10³ / (' + fmt(b, 0) + ' × ' + fmt(h0all, 0) + ') = <b>' + fmt(tau2, 3) + ' N/mm²</b> ≤ 0.4 N/mm²，' + (face2Ok ? '满足。' : '不满足。') + '<br>　　斜截面受剪 V<sub>cs</sub> = 0.7·min(f<sub>t</sub>, f<sub>t2</sub>)·b·h<sub>0</sub> = 0.7 × ' + fmt(ftLow, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h0all, 0) + ' = ' + fmt(0.7 * ftLow * b * h0all, 0) + ' N = <b>' + fmt(vc2, 3) + ' kN</b>；V<sub>2</sub> = ' + fmt(V2, 3) + ' kN，' + (shear2Ok ? '满足。' : '不满足。') + '</div>');
                proc.innerHTML = st.join('');
                console.log('[stage-check] 详细过程已填充, 长度:', st.join('').length, 'proc元素:', !!proc);
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }

            // ======== 函数：梁（保留原单向逻辑） ========
            function calcBeamOneway(p) {
                // 实际复用单向板函数，但 b 为梁宽、kind=beam
                calcSlabOneway(p);
                // 调整 AsShow 文案（根数方式）
                var asShow = document.getElementById('sc_AsShow');
                if (asShow && p.kind === 'beam') {
                    asShow.innerHTML = '实配钢筋面积 A<sub>s</sub> = <span style="color:#2563eb;font-size:15px;">' + fmt(p.As, 1) + ' mm²</span>' +
                        '<span style="font-weight:400;color:#64748b;font-size:12px;margin-left:10px;">' +
                        p.nVal + 'C' + p.d + '：' + fmt(p.a1, 1) + ' × ' + p.nVal + ' 根</span>';
                }
            }

            // ======== 函数：双向板（JGJ 1-2014 第 6.6 节 + GB/T 50010-2010（2024年版） 附录 H / 第 9.5.1 条） ========
            function calcSlabTwoway(p) {
                var Lx = p.Lx, Ly = p.Ly, edge = p.edge, joint = p.joint;
                var b = p.b, hp = p.hp, hc = p.hc, h = p.h;
                var fc = p.fc, ft = p.ft, fy = p.fy, es = p.es;
                var alpha1 = p.alpha1, beta1 = p.beta1, xi_b = p.xi_b, ecu = p.ecu;
                var As = p.As, asV = p.asV, d = p.d;
                var gamma = p.gamma, qk = p.qk, gG = p.gG, gQ = p.gQ;
                var fc2 = p.c2.fc, ft2 = p.c2.ft, alpha1_2 = p.c2.alpha1, beta1_2 = p.c2.beta1;
                var g2k = p.g2k, q2k = p.q2k, psi2 = p.psi2, support = p.support;

                var ratioLyLx = Ly / Lx;
                var isOnewayHint = ratioLyLx > 3;
                var sepWarn = (joint === 'separate');
                // 使用阶段是否按双向板：三条件同时满足（JGJ 1-2014 第 6.6.3 条）
                // ① 长宽比 Ly/Lx ≤ 3；② 四边支承（双向板模式默认成立）；③ 整体式接缝或无接缝
                var stage2IsTwoway = ((joint === 'integral') || (joint === 'none')) && !isOnewayHint;

                // 第一阶段（施工阶段）一律按单块预制底板简支单向板计算
                // 取短跨 Lx 为预制板跨度（JGJ 1-2014 第 6.6.3 条条文说明 + GB 50010 附录 H H.0.1 第 1 款）
                var L1 = Lx;
                var h01 = hp - asV;

                // ===== 双向板弹性弯矩系数表（仅使用阶段双向模式使用）=====
                function getTwowayCoefs(edgeType, r) {
                    var table = {
                        ssss: { mx: [[1.0, 0.0480], [1.1, 0.0447], [1.2, 0.0417], [1.3, 0.0390], [1.4, 0.0365], [1.5, 0.0344], [1.6, 0.0325], [1.7, 0.0308], [1.8, 0.0293], [1.9, 0.0280], [2.0, 0.0269]],
                                 my: [[1.0, 0.0480], [1.1, 0.0371], [1.2, 0.0295], [1.3, 0.0241], [1.4, 0.0200], [1.5, 0.0169], [1.6, 0.0145], [1.7, 0.0126], [1.8, 0.0111], [1.9, 0.0099], [2.0, 0.0089]],
                                 mxu: null, myu: null },
                        ffff: { mx: [[1.0, 0.0180], [1.1, 0.0193], [1.2, 0.0202], [1.3, 0.0208], [1.4, 0.0211], [1.5, 0.0213], [1.6, 0.0213], [1.7, 0.0212], [1.8, 0.0210], [1.9, 0.0208], [2.0, 0.0206]],
                                 my: [[1.0, 0.0180], [1.1, 0.0141], [1.2, 0.0111], [1.3, 0.0089], [1.4, 0.0073], [1.5, 0.0061], [1.6, 0.0052], [1.7, 0.0045], [1.8, 0.0039], [1.9, 0.0034], [2.0, 0.0030]],
                                 mxu: [[1.0, 0.0513], [1.1, 0.0546], [1.2, 0.0567], [1.3, 0.0578], [1.4, 0.0584], [1.5, 0.0585], [1.6, 0.0583], [1.7, 0.0579], [1.8, 0.0574], [1.9, 0.0569], [2.0, 0.0564]],
                                 myu: [[1.0, 0.0513], [1.1, 0.0443], [1.2, 0.0385], [1.3, 0.0338], [1.4, 0.0299], [1.5, 0.0267], [1.6, 0.0240], [1.7, 0.0218], [1.8, 0.0199], [1.9, 0.0183], [2.0, 0.0169]] },
                        sfsf: { mx: [[1.0, 0.0254], [1.1, 0.0265], [1.2, 0.0273], [1.3, 0.0278], [1.4, 0.0281], [1.5, 0.0282], [1.6, 0.0281], [1.7, 0.0280], [1.8, 0.0277], [1.9, 0.0274], [2.0, 0.0271]],
                                 my: [[1.0, 0.0254], [1.1, 0.0203], [1.2, 0.0165], [1.3, 0.0136], [1.4, 0.0114], [1.5, 0.0097], [1.6, 0.0084], [1.7, 0.0073], [1.8, 0.0064], [1.9, 0.0057], [2.0, 0.0051]],
                                 mxu: [[1.0, 0.0380], [1.1, 0.0408], [1.2, 0.0429], [1.3, 0.0444], [1.4, 0.0454], [1.5, 0.0460], [1.6, 0.0462], [1.7, 0.0463], [1.8, 0.0462], [1.9, 0.0460], [2.0, 0.0457]],
                                 myu: [[1.0, 0.0380], [1.1, 0.0313], [1.2, 0.0260], [1.3, 0.0220], [1.4, 0.0188], [1.5, 0.0163], [1.6, 0.0143], [1.7, 0.0126], [1.8, 0.0112], [1.9, 0.0100], [2.0, 0.0090]] },
                        fffs: { mx: [[1.0, 0.0209], [1.1, 0.0225], [1.2, 0.0237], [1.3, 0.0246], [1.4, 0.0251], [1.5, 0.0254], [1.6, 0.0255], [1.7, 0.0254], [1.8, 0.0252], [1.9, 0.0249], [2.0, 0.0247]],
                                 my: [[1.0, 0.0209], [1.1, 0.0160], [1.2, 0.0125], [1.3, 0.0099], [1.4, 0.0080], [1.5, 0.0066], [1.6, 0.0055], [1.7, 0.0047], [1.8, 0.0040], [1.9, 0.0035], [2.0, 0.0031]],
                                 mxu: [[1.0, 0.0485], [1.1, 0.0514], [1.2, 0.0534], [1.3, 0.0545], [1.4, 0.0550], [1.5, 0.0551], [1.6, 0.0548], [1.7, 0.0543], [1.8, 0.0537], [1.9, 0.0530], [2.0, 0.0523]],
                                 myu: [[1.0, 0.0293], [1.1, 0.0234], [1.2, 0.0188], [1.3, 0.0153], [1.4, 0.0127], [1.5, 0.0107], [1.6, 0.0091], [1.7, 0.0079], [1.8, 0.0069], [1.9, 0.0061], [2.0, 0.0054]] },
                        fsss: { mx: [[1.0, 0.0303], [1.1, 0.0313], [1.2, 0.0320], [1.3, 0.0325], [1.4, 0.0328], [1.5, 0.0329], [1.6, 0.0329], [1.7, 0.0328], [1.8, 0.0326], [1.9, 0.0324], [2.0, 0.0322]],
                                 my: [[1.0, 0.0303], [1.1, 0.0247], [1.2, 0.0206], [1.3, 0.0174], [1.4, 0.0149], [1.5, 0.0129], [1.6, 0.0113], [1.7, 0.0100], [1.8, 0.0089], [1.9, 0.0080], [2.0, 0.0073]],
                                 mxu: [[1.0, 0.0385], [1.1, 0.0398], [1.2, 0.0407], [1.3, 0.0412], [1.4, 0.0414], [1.5, 0.0415], [1.6, 0.0414], [1.7, 0.0412], [1.8, 0.0409], [1.9, 0.0405], [2.0, 0.0401]],
                                 myu: null }
                    };
                    var t = table[edgeType] || table.ssss;
                    function interp(rr, tbl) {
                        if (!tbl) return 0;
                        if (rr <= tbl[0][0]) return tbl[0][1];
                        if (rr >= tbl[tbl.length-1][0]) return tbl[tbl.length-1][1];
                        for (var i = 1; i < tbl.length; i++) {
                            if (rr <= tbl[i][0]) {
                                var x0 = tbl[i-1][0], x1 = tbl[i][0], y0 = tbl[i-1][1], y1 = tbl[i][1];
                                return y0 + (y1 - y0) * (rr - x0) / (x1 - x0);
                            }
                        }
                        return tbl[tbl.length-1][1];
                    }
                    var ax = interp(r, t.mx);
                    var ay = interp(r, t.my);
                    var axu = interp(r, t.mxu);
                    var ayu = interp(r, t.myu);
                    var ax_v2 = ax + 0.2 * ay;
                    var ay_v2 = ay + 0.2 * ax;
                    return { alpha_x: ax, alpha_y: ay, alpha_x_v2: ax_v2, alpha_y_v2: ay_v2, alpha_xu: axu, alpha_yu: ayu };
                }

                function edgeName(e) {
                    return { ssss:'四边简支', ffff:'四边固定', sfsf:'两邻边固定、两邻边简支', fffs:'三边固定、一边简支', fsss:'一边固定、三边简支' }[e] || e;
                }
                function jointName(j) {
                    return { integral:'整体式拼缝', separate:'分离式拼缝', none:'无接缝（整块预制板）' }[j] || j;
                }

                // ===== 第一阶段施工荷载（无支撑模式使用；有支撑模式施工荷载由临时支撑承担） =====
                var g1k_p = gamma * (hp / 1000);  // 预制自重 kN/m²
                var g1k_hc = gamma * (hc / 1000); // 叠合层自重 kN/m²
                var g1k = g1k_p + g1k_hc;          // 永久荷载标准值
                var q1k = qk;                      // 施工活载标准值
                var q1 = gG * g1k + gQ * q1k;      // 基本组合面荷载 kN/m²
                // 简支单向板内力
                var M1 = q1 * L1 * L1 / 8 * (b / 1000);         // kN·m（按板宽 B 计算）
                var V1 = q1 * L1 / 2 * (b / 1000);              // kN（按板宽 B 计算）
                // 标准值下的永久荷载弯矩（用于应力超前）
                var M1Gk = g1k * L1 * L1 / 8 * (b / 1000);
                var M1Qk = q1k * L1 * L1 / 8 * (b / 1000);

                // 第一阶段正截面承载力（预制截面）
                var x1 = fy * As / (alpha1 * fc * b);
                var xb1 = xi_b * h01;
                var over1 = x1 > xb1;
                var Mu1 = over1 ? alpha1 * fc * b * xb1 * (h01 - xb1/2) / 1e6 : fy * As * (h01 - x1/2) / 1e6;
                var cap1Ok = M1 <= Mu1;
                // 钢筋应力（施工阶段）
                var sig1k = M1Gk * 1e6 / (0.87 * As * h01);
                var sigLim = 0.9 * fy;
                var sigOk = sig1k <= sigLim;
                // 受剪
                var tau = V1 * 1000 / (b * h01);
                var faceOk = tau <= 0.4;
                var vc = 0.7 * ft * b * h01 / 1000;
                var shearOk = V1 <= vc;

                // ===== 第二阶段参数 =====
                var q2kEff = Math.max(q1k, q2k);    // 第二阶段可变荷载取施工活载与使用活载较大值（H.0.1条）
                var g2 = gG * g2k + gQ * q2kEff;
                var q2Total = gG * g1k + gG * g2k + gQ * q2kEff; // 总面荷载（正弯矩区段）
                // 整体截面有效高度
                var h0x_a = h - asV;
                var h0y_a = h - asV - d;
                if (h0y_a < 0) h0y_a = h0x_a;
                var xi_b2 = beta1_2 / (1 + fy / (es * ecu));
                var ftLow = Math.min(ft, ft2);

                // 第二阶段内力结果变量（双向 / 单向分别赋值）
                var M2x = 0, M2y = 0, M2xu = 0, M2yu = 0;
                var Mu2x = 0, Mu2y = 0, Mu2xu = 0, Mu2yu = 0;
                var cap2xOk = true, cap2yOk = true, cap2xuOk = true, cap2yuOk = true;
                var coefs2 = null;
                var M2 = 0, Mu2 = 0, cap2Ok = true; // 单向模式
                var V2 = 0, tau2 = 0, vc2 = 0;
                var face2Ok = true, shear2Ok = true;

                if (stage2IsTwoway) {
                    coefs2 = getTwowayCoefs(edge, ratioLyLx);
                    // 正弯矩区段跨中
                    M2x = coefs2.alpha_x_v2 * q2Total * Lx * Lx;
                    M2y = coefs2.alpha_y_v2 * q2Total * Lx * Lx;
                    // 支座负弯矩（负弯矩区段 M = M2G + M2Q，不含 M1G）
                    var q2stage = gG * g2k + gQ * q2kEff; // 第二阶段新增荷载
                    M2xu = coefs2.alpha_xu * q2stage * Lx * Lx;
                    M2yu = coefs2.alpha_yu * q2stage * Lx * Lx;

                    // 短跨正截面
                    var x2x = fy * As / (alpha1_2 * fc2 * b);
                    var xb2x = xi_b2 * h0x_a;
                    var over2x = x2x > xb2x;
                    Mu2x = over2x ? alpha1_2 * fc2 * b * xb2x * (h0x_a - xb2x/2) / 1e6 : fy * As * (h0x_a - x2x/2) / 1e6;
                    cap2xOk = M2x <= Mu2x;
                    // 长跨正截面
                    var x2y = fy * As / (alpha1_2 * fc2 * b);
                    var xb2y = xi_b2 * h0y_a;
                    var over2y = x2y > xb2y;
                    Mu2y = over2y ? alpha1_2 * fc2 * b * xb2y * (h0y_a - xb2y/2) / 1e6 : fy * As * (h0y_a - x2y/2) / 1e6;
                    cap2yOk = M2y <= Mu2y;
                    // 支座负弯矩（板顶，负弯矩区段受压区在板底，混凝土强度按预制构件？
                    // 规范规定负弯矩区段按受压区实际情况取用；支座负弯矩受压区在顶部（叠合层侧），
                    // 偏安全按叠合层 fc2 计算（保守做法，与正弯矩一致）
                    if (coefs2.alpha_xu > 0) {
                        Mu2xu = x2x > xi_b2 * h0x_a ? alpha1_2 * fc2 * b * (xi_b2 * h0x_a) * (h0x_a - xi_b2 * h0x_a/2) / 1e6 : fy * As * (h0x_a - x2x/2) / 1e6;
                        cap2xuOk = M2xu <= Mu2xu;
                    }
                    if (coefs2.alpha_yu > 0) {
                        Mu2yu = x2y > xi_b2 * h0y_a ? alpha1_2 * fc2 * b * (xi_b2 * h0y_a) * (h0y_a - xi_b2 * h0y_a/2) / 1e6 : fy * As * (h0y_a - x2y/2) / 1e6;
                        cap2yuOk = M2yu <= Mu2yu;
                    }
                    // 剪力：取短跨方向近似
                    V2 = q2Total * Lx / 2;
                    tau2 = V2 * 1000 / (b * h0x_a);
                    face2Ok = tau2 <= 0.4;
                    vc2 = 0.7 * ftLow * b * h0x_a / 1000;
                    shear2Ok = V2 <= vc2;
                } else {
                    // 第二阶段按单向板
                    var L2 = Lx;
                    var h02 = h0x_a;
                    M2 = q2Total * L2 * L2 / 8 * (b / 1000);
                    V2 = q2Total * L2 / 2 * (b / 1000);
                    var x2 = fy * As / (alpha1_2 * fc2 * b);
                    var xb2 = xi_b2 * h02;
                    var over2 = x2 > xb2;
                    Mu2 = over2 ? alpha1_2 * fc2 * b * xb2 * (h02 - xb2/2) / 1e6 : fy * As * (h02 - x2/2) / 1e6;
                    cap2Ok = M2 <= Mu2;
                    tau2 = V2 * 1000 / (b * h02);
                    face2Ok = tau2 <= 0.4;
                    vc2 = 0.7 * ftLow * b * h02 / 1000;
                    shear2Ok = V2 <= vc2;
                }

                var allCap2Ok = stage2IsTwoway ? (cap2xOk && cap2yOk && cap2xuOk && cap2yuOk) : cap2Ok;

                // ===========================================================
                //               有支撑模式 (support === 'y')
                // ===========================================================
                if (support === 'y') {
                    // GB/T 50010-2010（2024年版） 第 9.5.1 条：有可靠支撑按整体受弯构件设计
                    // 不进行第一阶段预制构件承载力验算和应力超前验算
                    // 斜截面受剪与叠合面受剪仍按附录 H 计算
                    var h0all_sup = h0x_a;
                    // 有支撑时，总荷载一次作用在整体截面上（施工荷载由支撑承担，使用阶段一次加载）
                    var qSupGk = g1k + g2k;
                    var qSupQk = Math.max(q1k, q2k);  // 第二阶段可变荷载取施工活载与使用活载较大值（H.0.1条）
                    var qSup = gG * qSupGk + gQ * qSupQk;

                    var M_sup_x = 0, M_sup_y = 0, Mu_sup_x = 0, Mu_sup_y = 0;
                    var cap_sup_x = true, cap_sup_y = true;
                    var V_sup = 0, tau_sup = 0, vc_sup = 0;
                    var face_sup_ok = true, shear_sup_ok = true;
                    var M_sup = 0, Mu_sup = 0, cap_sup = true;

                    if (stage2IsTwoway) {
                        coefs2 = getTwowayCoefs(edge, ratioLyLx);
                        M_sup_x = coefs2.alpha_x_v2 * qSup * Lx * Lx * (b / 1000);
                        M_sup_y = coefs2.alpha_y_v2 * qSup * Lx * Lx * (b / 1000);
                        // 短跨
                        var xsx = fy * As / (alpha1_2 * fc2 * b);
                        var xbsx = xi_b2 * h0x_a;
                        var oversx = xsx > xbsx;
                        Mu_sup_x = oversx ? alpha1_2 * fc2 * b * xbsx * (h0x_a - xbsx/2) / 1e6 : fy * As * (h0x_a - xsx/2) / 1e6;
                        cap_sup_x = M_sup_x <= Mu_sup_x;
                        // 长跨
                        var xsy = fy * As / (alpha1_2 * fc2 * b);
                        var xbsy = xi_b2 * h0y_a;
                        var oversy = xsy > xbsy;
                        Mu_sup_y = oversy ? alpha1_2 * fc2 * b * xbsy * (h0y_a - xbsy/2) / 1e6 : fy * As * (h0y_a - xsy/2) / 1e6;
                        cap_sup_y = M_sup_y <= Mu_sup_y;
                        // 剪力（短跨近似）
                        V_sup = qSup * Lx / 2;
                        tau_sup = V_sup * 1000 / (b * h0x_a);
                        face_sup_ok = tau_sup <= 0.4;
                        vc_sup = 0.7 * ftLow * b * h0x_a / 1000;
                        shear_sup_ok = V_sup <= vc_sup;
                    } else {
                        // 单向
                        M_sup = qSup * Lx * Lx / 8;
                        V_sup = qSup * Lx / 2;
                        var xs1 = fy * As / (alpha1_2 * fc2 * b);
                        var xbs1 = xi_b2 * h0all_sup;
                        var over1s = xs1 > xbs1;
                        Mu_sup = over1s ? alpha1_2 * fc2 * b * xbs1 * (h0all_sup - xbs1/2) / 1e6 : fy * As * (h0all_sup - xs1/2) / 1e6;
                        cap_sup = M_sup <= Mu_sup;
                        tau_sup = V_sup * 1000 / (b * h0all_sup);
                        face_sup_ok = tau_sup <= 0.4;
                        vc_sup = 0.7 * ftLow * b * h0all_sup / 1000;
                        shear_sup_ok = V_sup <= vc_sup;
                    }

                    var allSupOk = stage2IsTwoway ? (cap_sup_x && cap_sup_y && face_sup_ok && shear_sup_ok) : (cap_sup && face_sup_ok && shear_sup_ok);

                    // As 展示
                    var asShow = document.getElementById('sc_AsShow');
                    if (asShow) asShow.innerHTML = '实配钢筋面积 A<sub>s</sub> = <span style="color:#2563eb;font-size:15px;">' + fmt(As, 1) + ' mm²/m' + (stage2IsTwoway ? '（每方向）' : '') + '</span>' +
                        '<span style="font-weight:400;color:#64748b;font-size:12px;margin-left:10px;">' +
                        'C' + p.d + '@' + p.sVal + '：' + fmt(p.a1, 1) + ' × ' + fmt(1000 / p.sVal, 2) + ' 根/m' + (stage2IsTwoway ? ' · 双向配置' : '') + '</span>';

                    var html = '';
                    html += resultRow('叠合板宽度 B', fmt(b, 0) + ' mm');
                    var statusCls = allSupOk ? 'ok' : 'err';
                    var statusTxt = allSupOk ? '整体验算全部满足' : '存在不满足项';
                    html += '<div class="warn-box">ℹ 有可靠支撑，按 GB/T 50010-2010（2024年版） 第 9.5.1 条按整体受弯构件设计；施工阶段荷载由临时支撑承担，不进行第一阶段预制构件承载力验算与钢筋应力超前验算；斜截面受剪与叠合面受剪仍按附录 H 验算。</div>';

                    if (stage2IsTwoway) {
                        html += '<div class="sec-title">使用阶段（整体截面 · 双向板）</div>';
                        html += '<div class="hint" style="padding:0 12px 8px;font-size:12px;color:#64748b;">叠合层达到强度，' + jointName(joint) + '有效传力，四边支承（' + edgeName(edge) + '）成立，按双向板计算（JGJ 1-2014 第 6.6.3 条）。</div>';
                        html += resultRow('可变荷载标准值', fmt(qSupQk, 3) + ' kN/m²' + '<span class="hint">max(施工活载 q<sub>k</sub>, 使用活载 q<sub>2k</sub>)</span>');
                        html += resultRow('总面荷载 q', fmt(qSup, 3) + ' kN/m²' + ' <span class="hint">永久 ' + fmt(qSupGk, 3) + ' + 可变 ' + fmt(qSupQk, 3) + '</span>');
                        html += resultRow('长短跨比 L<sub>y</sub>/L<sub>x</sub>', fmt(ratioLyLx, 3));
                        html += resultRow('短跨跨中弯矩 M<sub>x</sub>', fmt(M_sup_x, 3) + ' kN·m/m');
                        html += resultRow('长跨跨中弯矩 M<sub>y</sub>', fmt(M_sup_y, 3) + ' kN·m/m');
                        html += resultRow('短跨方向承载力 M<sub>ux</sub>', fmt(Mu_sup_x, 3) + ' kN·m/m ' + badge(cap_sup_x ? 'ok' : 'err', cap_sup_x ? '满足' : '超限'));
                        html += resultRow('长跨方向承载力 M<sub>uy</sub>', fmt(Mu_sup_y, 3) + ' kN·m/m ' + badge(cap_sup_y ? 'ok' : 'err', cap_sup_y ? '满足' : '超限'));
                        html += resultRow('叠合面剪应力 τ', fmt(tau_sup, 3) + ' N/mm² <span class="hint">≤ 0.40</span>' + badge(face_sup_ok ? 'ok' : 'err', face_sup_ok ? '满足' : '超限'));
                        html += resultRow('斜截面受剪 V', fmt(V_sup, 3) + ' kN/m <span class="hint">≤ ' + fmt(vc_sup, 3) + '</span>' + badge(shear_sup_ok ? 'ok' : 'err', shear_sup_ok ? '满足' : '超限'));
                    } else {
                        html += '<div class="sec-title">使用阶段（整体截面 · 单向板）</div>';
                        html += '<div class="hint" style="padding:0 12px 8px;font-size:12px;color:#64748b;">' + (sepWarn ? '分离式拼缝不能有效传递弯矩，按单向板设计（JGJ 1-2014 第 6.6.3 条）。' : (isOnewayHint ? 'L<sub>y</sub>/L<sub>x</sub>＞3，宜按单向板设计（GB/T 50010-2010（2024年版） 第 9.1.1 条）。' : '按单向板计算。')) + '</div>';
                        html += resultRow('可变荷载标准值', fmt(qSupQk, 3) + ' kN/m²' + '<span class="hint">max(施工活载 q<sub>k</sub>, 使用活载 q<sub>2k</sub>)</span>');
                        html += resultRow('总面荷载 q', fmt(qSup, 3) + ' kN/m²');
                        html += resultRow('计算跨度 L', fmt(Lx, 2) + ' m');
                        html += resultRow('跨中弯矩 M', fmt(M_sup, 3) + ' kN·m/m <span class="hint">q·L²/8</span>');
                        html += resultRow('整体截面承载力 M<sub>u</sub>', fmt(Mu_sup, 3) + ' kN·m/m ' + badge(cap_sup ? 'ok' : 'err', cap_sup ? '满足' : '超限'));
                        html += resultRow('叠合面剪应力 τ', fmt(tau_sup, 3) + ' N/mm² <span class="hint">≤ 0.40</span>' + badge(face_sup_ok ? 'ok' : 'err', face_sup_ok ? '满足' : '超限'));
                        html += resultRow('斜截面受剪 V', fmt(V_sup, 3) + ' kN/m <span class="hint">≤ ' + fmt(vc_sup, 3) + '</span>' + badge(shear_sup_ok ? 'ok' : 'err', shear_sup_ok ? '满足' : '超限'));
                    }
                    html += resultRow('综合判定', badge(statusCls, statusTxt));
                    var warnHtmlSup = '';
                    if (p.qkWarn) warnHtmlSup += '<div class="warn-box">⚠ 施工活荷载标准值 q<sub>k</sub> = ' + fmt(qk, 2) + ' kN/m²，低于 GB 50666-2011 第 9.2.3 条第 5 款规定的不宜小于 1.5 kN/m² 的要求。</div>';
                    out.innerHTML = warnHtmlSup + html;

                    // 详细计算过程
                    var st = [];
                    st.push('<div class="step"><b>基本参数</b>　叠合板宽度 B = ' + fmt(b, 0) + ' mm（计算截面宽度按实际板宽取用，总弯矩/剪力 = 单位宽度值 × B/1000）；短跨 L<sub>x</sub> = ' + fmt(Lx, 2) + ' m，长跨 L<sub>y</sub> = ' + fmt(Ly, 2) + ' m；预制层厚度 h<sub>p</sub> = ' + fmt(hp, 0) + ' mm；叠合层厚度 h<sub>c</sub> = ' + fmt(hc, 0) + ' mm；叠合后全高 h = ' + fmt(h, 0) + ' mm。</div>');
                    st.push('<div class="step"><b>① 支撑方式与计算模型（GB/T 50010-2010（2024年版） 第 9.5.1 条 + JGJ 1-2014 第 6.6.3 条）</b>　施工阶段设有可靠支撑，叠合受弯构件按整体受弯构件设计计算；施工阶段（第一阶段）荷载由临时支撑承担，预制构件不单独验算施工阶段承载力与钢筋应力超前；斜截面受剪与叠合面受剪仍按 GB 50010 附录 H 验算。<br>　　拼缝形式：' + jointName(joint) + '；长宽比 L<sub>y</sub>/L<sub>x</sub> = ' + fmt(ratioLyLx, 3) + '；' + (stage2IsTwoway ? '满足双向板三条件（整体式/无接缝 + 四边支承 + 长宽比≤3），按双向板计算（JGJ 1-2014 第 6.6.3 条）。' : (sepWarn ? '分离式接缝宜按单向板设计（JGJ 1-2014 第 6.6.3 条）。' : '长宽比＞3，按单向板设计（GB/T 50010-2010（2024年版） 第 9.1.1 条）。')) + '</div>');

                    st.push('<div class="step"><b>② 整体荷载与内力（GB/T 50010-2010（2024年版） 第 9.5.1 条 + 附录 H 第 H.0.1 条）</b>　有可靠支撑时叠合构件按整体受弯构件一次加载计算；可变荷载取施工活载与使用活载较大值（H.0.1条第二阶段两种工况取不利）。<br>　　永久荷载标准值 q<sub>Gk</sub> = 预制自重 + 叠合层自重 + 面层吊顶 = ' + fmt(g1k_p, 3) + ' + ' + fmt(g1k_hc, 3) + ' + ' + fmt(g2k, 3) + ' = ' + fmt(qSupGk, 3) + ' kN/m²。<br>　　可变荷载：施工活载 q<sub>k</sub> = ' + fmt(qk, 3) + ' kN/m²；使用活载 q<sub>2k</sub> = ' + fmt(q2k, 3) + ' kN/m²；取较大值 q<sub>Qk</sub> = max(q<sub>k</sub>, q<sub>2k</sub>) = <b>' + fmt(qSupQk, 3) + ' kN/m²</b>。<br>　　基本组合：q = γ<sub>G</sub>·q<sub>Gk</sub> + γ<sub>Q</sub>·q<sub>Qk</sub> = ' + fmt(gG, 2) + '×' + fmt(qSupGk, 3) + ' + ' + fmt(gQ, 2) + '×' + fmt(qSupQk, 3) + ' = ' + fmt(qSup, 3) + ' kN/m²。</div>');

                    if (stage2IsTwoway) {
                        st.push('<div class="step"><b>③ 双向板内力（弹性理论弯矩系数法，《建筑结构静力计算实用手册》）</b>　支承条件：' + edgeName(edge) + '。跨中弯矩系数 α<sub>x</sub> = ' + fmt(coefs2.alpha_x, 4) + '，α<sub>y</sub> = ' + fmt(coefs2.alpha_y, 4) + '（ν=0）；ν=0.2 修正后 α<sub>x</sub><sup>ν</sup> = α<sub>x</sub> + 0.2α<sub>y</sub> = ' + fmt(coefs2.alpha_x_v2, 4) + '，α<sub>y</sub><sup>ν</sup> = ' + fmt(coefs2.alpha_y_v2, 4) + '。<br>　　短跨跨中 M<sub>x</sub> = α<sub>x</sub><sup>ν</sup>·q·L<sub>x</sub>² = ' + fmt(coefs2.alpha_x_v2, 4) + ' × ' + fmt(qSup, 3) + ' × ' + fmt(Lx, 2) + '² = <b>' + fmt(M_sup_x, 3) + ' kN·m/m</b>；长跨 M<sub>y</sub> = α<sub>y</sub><sup>ν</sup>·q·L<sub>x</sub>² = ' + fmt(coefs2.alpha_y_v2, 4) + ' × ' + fmt(qSup, 3) + ' × ' + fmt(Lx, 2) + '² = <b>' + fmt(M_sup_y, 3) + ' kN·m/m</b>。</div>');
                        st.push('<div class="step"><b>④ 正截面受弯承载力（短跨方向，GB 50010 第 6.2.10 条 + 附录 H H.0.2 条）</b>　整体 h<sub>0x</sub> = h − a<sub>s</sub> = ' + fmt(h, 0) + ' − ' + fmt(asV, 0) + ' = ' + fmt(h0x_a, 0) + ' mm；叠合层 f<sub>c2</sub> = ' + fmt(fc2, 2) + ' N/mm²（正弯矩区段混凝土强度按叠合层取用，H.0.2 条）。<br>　　x = f<sub>y</sub>·A<sub>s</sub>/(α<sub>1</sub>f<sub>c2</sub>b) = ' + fmt(fy, 0) + ' × ' + fmt(As, 1) + ' / (' + fmt(alpha1_2, 2) + ' × ' + fmt(fc2, 2) + ' × ' + fmt(b, 0) + ') = <b>' + fmt(xsx, 1) + ' mm</b>，' + (oversx ? '超筋，按界限' : '适筋') + '。<br>　　M<sub>ux</sub> = f<sub>y</sub>·A<sub>s</sub>·(h<sub>0x</sub> − x/2) = <b>' + fmt(Mu_sup_x, 3) + ' kN·m/m</b>；M<sub>x</sub> = ' + fmt(M_sup_x, 3) + ' ' + (cap_sup_x ? '≤' : '＞') + ' M<sub>ux</sub>，' + (cap_sup_x ? '满足。' : '不满足。') + '</div>');
                        st.push('<div class="step"><b>⑤ 正截面受弯承载力（长跨方向）</b>　h<sub>0y</sub> = h<sub>0x</sub> − d = ' + fmt(h0y_a, 0) + ' mm；M<sub>uy</sub> = <b>' + fmt(Mu_sup_y, 3) + ' kN·m/m</b>；M<sub>y</sub> = ' + fmt(M_sup_y, 3) + ' ' + (cap_sup_y ? '≤' : '＞') + ' M<sub>uy</sub>，' + (cap_sup_y ? '满足。' : '不满足。') + '</div>');
                        st.push('<div class="step"><b>⑥ 叠合面受剪（附录 H 第 H.0.4 条）</b>　取短跨方向剪力 V = q·L<sub>x</sub>/2 = ' + fmt(V_sup, 3) + ' kN/m。τ = V/(b·h<sub>0x</sub>) = ' + fmt(tau_sup, 3) + ' N/mm² ≤ 0.4 N/mm²，' + (face_sup_ok ? '满足。' : '不满足。') + '</div>');
                        st.push('<div class="step"><b>⑦ 斜截面受剪（附录 H 第 H.0.3 条）</b>　V<sub>cs</sub> = 0.7·min(f<sub>t</sub>,f<sub>t2</sub>)·b·h<sub>0</sub> = 0.7 × ' + fmt(ftLow, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h0x_a, 0) + ' = <b>' + fmt(vc_sup, 3) + ' kN/m</b>；V ' + (shear_sup_ok ? '≤' : '＞') + ' V<sub>cs</sub>，' + (shear_sup_ok ? '满足。' : '不满足。') + '</div>');
                    } else {
                        st.push('<div class="step"><b>③ 单向板内力（M = qL²/8）</b>　跨度 L = ' + fmt(Lx, 2) + ' m；M = q·L²/8 = ' + fmt(qSup, 3) + ' × ' + fmt(Lx, 2) + '² / 8 = <b>' + fmt(M_sup, 3) + ' kN·m/m</b>；V = q·L/2 = ' + fmt(V_sup, 3) + ' kN/m。</div>');
                        st.push('<div class="step"><b>④ 正截面受弯承载力（整体截面，第 6.2.10 条 + 附录 H H.0.2 条）</b>　h<sub>0</sub> = h − a<sub>s</sub> = ' + fmt(h, 0) + ' − ' + fmt(asV, 0) + ' = ' + fmt(h0all_sup, 0) + ' mm；叠合层 f<sub>c2</sub> = ' + fmt(fc2, 2) + ' N/mm²。<br>　　x = f<sub>y</sub>·A<sub>s</sub>/(α<sub>1</sub>f<sub>c2</sub>b) = <b>' + fmt(xs1, 1) + ' mm</b>，' + (over1s ? '超筋' : '适筋') + '。<br>　　M<sub>u</sub> = f<sub>y</sub>·A<sub>s</sub>·(h<sub>0</sub> − x/2) = <b>' + fmt(Mu_sup, 3) + ' kN·m/m</b>；M = ' + fmt(M_sup, 3) + ' ' + (cap_sup ? '≤' : '＞') + ' M<sub>u</sub>，' + (cap_sup ? '满足。' : '不满足。') + '</div>');
                        st.push('<div class="step"><b>⑤ 叠合面受剪（附录 H 第 H.0.4 条）</b>　τ = V/(b·h<sub>0</sub>) = ' + fmt(tau_sup, 3) + ' N/mm² ≤ 0.4 N/mm²，' + (face_sup_ok ? '满足。' : '不满足。') + '</div>');
                        st.push('<div class="step"><b>⑥ 斜截面受剪（附录 H 第 H.0.3 条）</b>　V<sub>cs</sub> = 0.7·min(f<sub>t</sub>,f<sub>t2</sub>)·b·h<sub>0</sub> = 0.7 × ' + fmt(ftLow, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h0all_sup, 0) + ' = <b>' + fmt(vc_sup, 3) + ' kN/m</b>；V ' + (shear_sup_ok ? '≤' : '＞') + ' V<sub>cs</sub>，' + (shear_sup_ok ? '满足。' : '不满足。') + '</div>');
                    }
                    st.push('<div class="step" style="color:#64748b"><b>注</b>　① 临时支撑体系自身承载力与稳定性应按 GB 50271-2014、JGJ 162-2008 由施工方案验算。② 裂缝宽度应按 GB/T 50010-2010（2024年版） 第 7.1.2 条另行验算。③ 挠度应按 GB/T 50010-2010（2024年版） 第 7.2 节另行验算。</div>');
                    proc.innerHTML = st.join('');
                console.log('[stage-check] 详细过程已填充, 长度:', st.join('').length, 'proc元素:', !!proc);
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                    window._SC_RESULT = {
                        mode: 'twoway', kind: p.kind, support: 'y',
                        Lx: Lx, Ly: Ly, edge: edge, joint: joint, ratioLyLx: ratioLyLx,
                        B: b, b: b, hp: hp, hc: hc, h: h,
                        stage2IsTwoway: stage2IsTwoway,
                        qSupGk: qSupGk, qSupQk: qSupQk, qSup: qSup,
                        M_sup_x: M_sup_x, M_sup_y: M_sup_y, Mu_sup_x: Mu_sup_x, Mu_sup_y: Mu_sup_y,
                        cap_sup_x: cap_sup_x, cap_sup_y: cap_sup_y,
                        M_sup: M_sup, Mu_sup: Mu_sup, cap_sup: cap_sup,
                        V_sup: V_sup, tau_sup: tau_sup, vc_sup: vc_sup,
                        face_sup_ok: face_sup_ok, shear_sup_ok: shear_sup_ok,
                        allSupOk: allSupOk, coefs2: coefs2,
h0x_a: h0x_a, h0y_a: h0y_a, ftLow: ftLow,
                    steps: st.join('')
                };
                    return;
                }

                // ===========================================================
                //               无支撑模式 (support === 'n')
                // ===========================================================
                var allCap1Ok = cap1Ok && sigOk && faceOk && shearOk;
                var allOk = allCap1Ok && allCap2Ok && face2Ok && shear2Ok;

                // 施工活载警告
                var warnHtml = '';
                if (p.qkWarn) warnHtml += '<div class="warn-box">⚠ 施工活荷载标准值 q<sub>k</sub> = ' + fmt(qk, 2) + ' kN/m²，低于 GB 50666-2011 第 9.2.3 条第 5 款规定的不宜小于 1.5 kN/m² 的要求。</div>';

                // ===== 结果面板 =====
                var asShow = document.getElementById('sc_AsShow');
                if (asShow) asShow.innerHTML = '实配钢筋面积 A<sub>s</sub> = <span style="color:#2563eb;font-size:15px;">' + fmt(As, 1) + ' mm²/m' + (stage2IsTwoway ? '（每方向）' : '') + '</span>' +
                    '<span style="font-weight:400;color:#64748b;font-size:12px;margin-left:10px;">' +
                    'C' + p.d + '@' + p.sVal + '：' + fmt(p.a1, 1) + ' × ' + fmt(1000 / p.sVal, 2) + ' 根/m' + (stage2IsTwoway ? ' · 双向配置' : '') + '</span>';

                var html = '';
                html += resultRow('叠合板宽度 B', fmt(b, 0) + ' mm');
                var statusCls = allOk ? 'ok' : 'err';
                var statusTxt = allOk ? '两阶段验算全部满足' : '存在不满足项';

                // 警告
                if (isOnewayHint) {
                    html += '<div class="warn-box">⚠ L<sub>y</sub>/L<sub>x</sub> = ' + fmt(ratioLyLx, 2) + ' ＞ 3，使用阶段宜按单向板设计（GB/T 50010-2010（2024年版） 第 9.1.1 条）。本工具已自动按单向板处理第二阶段。</div>';
                }
                if (sepWarn && !stage2IsTwoway) {
                    html += '<div class="warn-box">⚠ 分离式接缝宜按单向板设计（JGJ 1-2014 第 6.6.3 条）。已按单向板计算。如需按双向板计算，请选择"整体式拼缝"或"无接缝（整块预制板）"。</div>';
                }

                // 第一阶段
                html += '<div class="sec-title">第一阶段（施工阶段，预制截面 · 单向简支板）</div>';
                html += '<div class="hint" style="padding:0 12px 8px;font-size:12px;color:#64748b;">施工阶段拼缝未形成整体，预制底板离散，不具备四边支承条件，按单块简支单向板计算（JGJ 1-2014 第 6.6.3 条条文说明 + GB/T 50010-2010（2024年版） 附录 H 第 H.0.1 条）。</div>';
                html += resultRow('面荷载设计值 q', fmt(q1, 3) + ' kN/m² <span class="hint">预制自重+叠合层自重+施工活载</span>');
                html += resultRow('计算跨度 L', fmt(L1, 2) + ' m（短跨方向，预制板跨度）');
                html += resultRow('跨中弯矩 M<sub>1</sub>', fmt(M1, 3) + ' kN·m/m <span class="hint">q·L²/8</span>');
                html += resultRow('预制截面承载力 M<sub>u1</sub>', fmt(Mu1, 3) + ' kN·m/m ' + badge(cap1Ok ? 'ok' : 'err', cap1Ok ? '满足' : '超限'));
                html += resultRow('钢筋应力 σ<sub>s1k</sub>', fmt(sig1k, 2) + ' N/mm² <span class="hint">≤ 0.9f<sub>y</sub>=' + fmt(sigLim, 2) + '</span>' + badge(sigOk ? 'ok' : 'err', sigOk ? '满足' : '超限'));
                html += resultRow('叠合面剪应力 τ', fmt(tau, 3) + ' N/mm² <span class="hint">≤ 0.40</span>' + badge(faceOk ? 'ok' : 'err', faceOk ? '满足' : '超限'));
                html += resultRow('斜截面受剪 V', fmt(V1, 3) + ' kN/m <span class="hint">≤ ' + fmt(vc, 3) + '</span>' + badge(shearOk ? 'ok' : 'err', shearOk ? '满足' : '超限'));

                // 第二阶段
                if (stage2IsTwoway) {
                    html += '<div class="sec-title">第二阶段（使用阶段，整体截面 · 双向板）</div>';
                    html += '<div class="hint" style="padding:0 12px 8px;font-size:12px;color:#64748b;">叠合层达到强度，' + jointName(joint) + '有效传力，四边支承（' + edgeName(edge) + '）成立，按双向板计算（JGJ 1-2014 第 6.6.3 条 + 《建筑结构静力计算实用手册》弹性理论）。</div>';
                    html += resultRow('第二阶段可变荷载标准值', fmt(q2kEff, 3) + ' kN/m²' + '<span class="hint">max(施工活载 q<sub>k</sub>, 使用活载 q<sub>2k</sub>)</span>');
                    html += resultRow('总面荷载 q<sub>总</sub>', fmt(q2Total, 3) + ' kN/m²');
                    html += resultRow('长短跨比 L<sub>y</sub>/L<sub>x</sub>', fmt(ratioLyLx, 3));
                    html += resultRow('短跨跨中弯矩 M<sub>2x</sub>', fmt(M2x, 3) + ' kN·m/m');
                    html += resultRow('长跨跨中弯矩 M<sub>2y</sub>', fmt(M2y, 3) + ' kN·m/m');
                    html += resultRow('短跨承载力 M<sub>ux</sub>', fmt(Mu2x, 3) + ' kN·m/m ' + badge(cap2xOk ? 'ok' : 'err', cap2xOk ? '满足' : '超限'));
                    html += resultRow('长跨承载力 M<sub>uy</sub>', fmt(Mu2y, 3) + ' kN·m/m ' + badge(cap2yOk ? 'ok' : 'err', cap2yOk ? '满足' : '超限'));
                    if (M2xu > 0) html += resultRow('x方向支座负弯矩 M<sub>uxu</sub>', fmt(M2xu, 3) + ' kN·m/m ' + badge(cap2xuOk ? 'ok' : 'err', cap2xuOk ? '满足' : '超限'));
                    if (M2yu > 0) html += resultRow('y方向支座负弯矩 M<sub>uyu</sub>', fmt(M2yu, 3) + ' kN·m/m ' + badge(cap2yuOk ? 'ok' : 'err', cap2yuOk ? '满足' : '超限'));
                    html += resultRow('叠合面剪应力 τ', fmt(tau2, 3) + ' N/mm² <span class="hint">≤ 0.40</span>' + badge(face2Ok ? 'ok' : 'err', face2Ok ? '满足' : '超限'));
                    html += resultRow('斜截面受剪 V', fmt(V2, 3) + ' kN/m <span class="hint">≤ ' + fmt(vc2, 3) + '</span>' + badge(shear2Ok ? 'ok' : 'err', shear2Ok ? '满足' : '超限'));
                } else {
                    html += '<div class="sec-title">第二阶段（使用阶段，整体截面 · 单向板）</div>';
                    html += '<div class="hint" style="padding:0 12px 8px;font-size:12px;color:#64748b;">' + (sepWarn ? '分离式接缝宜按单向板设计（JGJ 1-2014 第 6.6.3 条）。' : '') + (isOnewayHint ? 'L<sub>y</sub>/L<sub>x</sub>＞3，宜按单向板设计（GB/T 50010-2010（2024年版） 第 9.1.1 条）。' : '') + '</div>';
                    html += resultRow('总面荷载 q<sub>总</sub>', fmt(q2Total, 3) + ' kN/m²');
                    html += resultRow('计算跨度 L', fmt(Lx, 2) + ' m');
                    html += resultRow('跨中弯矩 M<sub>2</sub>', fmt(M2, 3) + ' kN·m/m <span class="hint">q·L²/8</span>');
                    html += resultRow('整体截面承载力 M<sub>u</sub>', fmt(Mu2, 3) + ' kN·m/m ' + badge(cap2Ok ? 'ok' : 'err', cap2Ok ? '满足' : '超限'));
                    html += resultRow('叠合面剪应力 τ', fmt(tau2, 3) + ' N/mm² <span class="hint">≤ 0.40</span>' + badge(face2Ok ? 'ok' : 'err', face2Ok ? '满足' : '超限'));
                    html += resultRow('斜截面受剪 V', fmt(V2, 3) + ' kN/m <span class="hint">≤ ' + fmt(vc2, 3) + '</span>' + badge(shear2Ok ? 'ok' : 'err', shear2Ok ? '满足' : '超限'));
                }
                html += resultRow('综合判定', badge(statusCls, statusTxt));
                out.innerHTML = warnHtml + html;

                // ===== 详细计算过程 =====
                var st = [];
                st.push('<div class="step"><b>基本参数</b>　叠合板宽度 B = ' + fmt(b, 0) + ' mm（计算截面宽度按实际板宽取用，总弯矩/剪力 = 单位宽度值 × B/1000）；短跨 L<sub>x</sub> = ' + fmt(Lx, 2) + ' m，长跨 L<sub>y</sub> = ' + fmt(Ly, 2) + ' m；预制层厚度 h<sub>p</sub> = ' + fmt(hp, 0) + ' mm；叠合层厚度 h<sub>c</sub> = ' + fmt(hc, 0) + ' mm；叠合后全高 h = ' + fmt(h, 0) + ' mm。</div>');
                st.push('<div class="step"><b>① 计算模型说明（JGJ 1-2014 第 6.6.3 条 + GB 50010 附录 H）</b>　短跨 L<sub>x</sub> = ' + fmt(Lx, 2) + ' m，长跨 L<sub>y</sub> = ' + fmt(Ly, 2) + ' m，L<sub>y</sub>/L<sub>x</sub> = ' + fmt(ratioLyLx, 3) + '。拼缝形式：' + jointName(joint) + '；支承条件：四边支承（' + edgeName(edge) + '）。<br>　　<b>施工阶段</b>：拼缝未形成整体，预制底板离散，不具备四边支承条件，按单块简支单向板计算（JGJ 1-2014 第 6.6.3 条条文说明 + GB 50010 附录 H 第 H.0.1 条），计算跨度取预制板跨度 L<sub>x</sub> = ' + fmt(Lx, 2) + ' m。<br>　　<b>使用阶段</b>：' + (stage2IsTwoway ? '整体式接缝/无接缝 + 长宽比≤3 + 四边支承，三条件同时满足，按双向板设计（JGJ 1-2014 第 6.6.3 条）；采用《建筑结构静力计算实用手册》弹性理论弯矩系数法，ν=0.2 修正跨中弯矩。' : (sepWarn ? '分离式接缝宜按单向板设计（JGJ 1-2014 第 6.6.3 条）。' : 'L<sub>y</sub>/L<sub>x</sub> ＞ 3，宜按单向板设计（GB/T 50010-2010（2024年版） 第 9.1.1 条）。')) + '</div>');

                // 第一阶段荷载
                st.push('<div class="step"><b>② 第一阶段荷载（GB 50010 附录 H 第 H.0.1 条 + GB 50666-2011 第 9.2 节）</b>　预制自重 g<sub>p</sub> = γ·h<sub>p</sub> = ' + fmt(gamma, 0) + ' × ' + fmt(hp/1000, 3) + ' = ' + fmt(g1k_p, 3) + ' kN/m²；叠合层自重 g<sub>c</sub> = γ·h<sub>c</sub> = ' + fmt(g1k_hc, 3) + ' kN/m²；施工活载 q<sub>k</sub> = ' + fmt(qk, 2) + ' kN/m²（GB 50666-2011 第 9.2.3 条第 5 款：不宜小于 1.5 kN/m²）。基本组合面荷载 q = γ<sub>G</sub>·(g<sub>p</sub>+g<sub>c</sub>) + γ<sub>Q</sub>·q<sub>k</sub> = ' + fmt(gG, 2) + '×' + fmt(g1k, 3) + ' + ' + fmt(gQ, 2) + '×' + fmt(qk, 2) + ' = <b>' + fmt(q1, 3) + ' kN/m²</b>。</div>');

                // 第一阶段内力
                st.push('<div class="step"><b>③ 第一阶段内力（简支单向板，M = qL²/8）</b>　跨度 L = ' + fmt(L1, 2) + ' m（单块预制底板跨度，拼缝未形成整体，不按四边支承双向板计算）。<br>　　M<sub>1</sub> = q·L²/8 = ' + fmt(q1, 3) + ' × ' + fmt(L1, 2) + '² / 8 = <b>' + fmt(M1, 3) + ' kN·m/m</b>；V<sub>1</sub> = q·L/2 = ' + fmt(V1, 3) + ' kN/m。</div>');

                // 第一阶段正截面
                st.push('<div class="step"><b>④ 第一阶段正截面受弯（附录 H 第 H.0.2 条第 1 款 + 第 6.2.10 条）</b>　施工阶段混凝土按实际强度取值：f<sub>cu</sub> = k·f<sub>cu,k</sub> = ' + fmt(p.ratio * 100, 0) + '%×' + fmt(p.gradeVal, 0) + ' = ' + fmt(p.fcu, 1) + ' MPa，线性内插得 f<sub>c</sub> = ' + fmt(fc, 2) + ' N/mm²（GB 50666-2011 第 9.2.3 条 + GB 50010 附录 H）。<br>　　h<sub>01</sub> = h<sub>p</sub> − a<sub>s</sub> = ' + fmt(hp, 0) + ' − ' + fmt(asV, 0) + ' = ' + fmt(h01, 0) + ' mm。x = f<sub>y</sub>·A<sub>s</sub> / (α<sub>1</sub>f<sub>c</sub>b) = <b>' + fmt(x1, 1) + ' mm</b>，' + (over1 ? '超筋，按界限取值' : '适筋') + '。<br>　　M<sub>u1</sub> = ' + (over1 ? 'α<sub>1</sub>f<sub>c</sub>b·x<sub>b</sub>·(h<sub>01</sub> − x<sub>b</sub>/2) = <b>' + fmt(Mu1, 3) + ' kN·m/m</b>' : 'f<sub>y</sub>·A<sub>s</sub>·(h<sub>01</sub> − x/2) = <b>' + fmt(Mu1, 3) + ' kN·m/m</b>') + '；M<sub>1</sub> = ' + fmt(M1, 3) + ' kN·m/m ' + (cap1Ok ? '≤' : '＞') + ' M<sub>u1</sub>，' + (cap1Ok ? '满足。' : '不满足。') + '</div>');

                // 钢筋应力
                st.push('<div class="step"><b>⑤ 受拉钢筋应力（附录 H 第 H.0.7 条，应力超前）</b>　σ<sub>s1k</sub> = M<sub>1Gk</sub>/(0.87A<sub>s</sub>h<sub>01</sub>) = ' + fmt(sig1k, 2) + ' N/mm²（近似式源自 GB 50010 第 7.1.4 条）；σ<sub>s1k</sub> ' + (sigOk ? '≤' : '＞') + ' 0.9f<sub>y</sub> = ' + fmt(sigLim, 2) + ' N/mm²，' + (sigOk ? '满足。' : '不满足。') + '</div>');

                // 第一阶段受剪
                st.push('<div class="step"><b>⑥ 第一阶段叠合面受剪与斜截面受剪（附录 H.0.4 / H.0.3 条）</b>　τ = V<sub>1</sub>/(b·h<sub>01</sub>) = ' + fmt(V1, 3) + '×10³ / (' + fmt(b, 0) + ' × ' + fmt(h01, 0) + ') = <b>' + fmt(tau, 3) + ' N/mm²</b> ≤ 0.4 N/mm²，' + (faceOk ? '满足。' : '不满足。') + '<br>　　V<sub>cs</sub> = 0.7·f<sub>t</sub>·b·h<sub>01</sub> = 0.7 × ' + fmt(ft, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h01, 0) + ' = <b>' + fmt(vc, 3) + ' kN/m</b>；V<sub>1</sub> ' + (shearOk ? '≤' : '＞') + ' V<sub>cs</sub>，' + (shearOk ? '满足。' : '不满足。') + '</div>');

                if (stage2IsTwoway) {
                    // 双向板使用阶段
                    st.push('<div class="step"><b>⑦ 第二阶段荷载与内力组合（GB/T 50010-2010（2024年版） 附录 H 第 H.0.1 条第 2 款 + 第 H.0.2 条）</b>　第二阶段叠合层达强度后，叠合构件按整体结构计算；可变荷载取施工活载与使用活载的较大值（H.0.1 条第 2 款：第二阶段考虑施工阶段和使用阶段两种工况，取不利）。<br>　　永久荷载：面层吊顶等自重 g<sub>2k</sub> = ' + fmt(g2k, 3) + ' kN/m²；施工活载 q<sub>k</sub> = ' + fmt(qk, 3) + ' kN/m²；使用活载 q<sub>2k</sub> = ' + fmt(q2k, 3) + ' kN/m²。<br>　　<b>基本组合可变荷载</b>：q<sub>2Qk</sub> = max(q<sub>k</sub>, q<sub>2k</sub>) = <b>' + fmt(q2kEff, 3) + ' kN/m²</b>。<br>　　正弯矩区段总面荷载（基本组合，H.0.2 条第 2 款）：q<sub>总</sub> = γ<sub>G</sub>·g<sub>1k</sub> + γ<sub>G</sub>·g<sub>2k</sub> + γ<sub>Q</sub>·q<sub>2Qk</sub> = ' + fmt(gG, 2) + '×' + fmt(g1k, 3) + ' + ' + fmt(gG, 2) + '×' + fmt(g2k, 3) + ' + ' + fmt(gQ, 2) + '×' + fmt(q2kEff, 3) + ' = ' + fmt(q2Total, 3) + ' kN/m²。<br>　　负弯矩区段（支座）仅含第二阶段新增荷载（M = M<sub>2G</sub> + M<sub>2Q</sub>，不含 M<sub>1G</sub>，H.0.2 条第 3 款）。</div>');

                    st.push('<div class="step"><b>⑧ 第二阶段内力（双向板弹性理论）</b>　支承条件：' + edgeName(edge) + '。跨中弯矩系数 α<sub>x</sub> = ' + fmt(coefs2.alpha_x, 4) + '，α<sub>y</sub> = ' + fmt(coefs2.alpha_y, 4) + '（ν=0）；ν=0.2 修正后 α<sub>x</sub><sup>ν</sup> = ' + fmt(coefs2.alpha_x_v2, 4) + '，α<sub>y</sub><sup>ν</sup> = ' + fmt(coefs2.alpha_y_v2, 4) + '。<br>　　短跨跨中 M<sub>2x</sub> = α<sub>x</sub><sup>ν</sup>·q<sub>总</sub>·L<sub>x</sub>² = <b>' + fmt(M2x, 3) + ' kN·m/m</b>；长跨 M<sub>2y</sub> = α<sub>y</sub><sup>ν</sup>·q<sub>总</sub>·L<sub>x</sub>² = <b>' + fmt(M2y, 3) + ' kN·m/m</b>。' + (M2xu > 0 ? '<br>　　x方向支座 M<sub>2xu</sub> = α<sub>xu</sub>·q<sub>2阶段</sub>·L<sub>x</sub>² = <b>' + fmt(M2xu, 3) + ' kN·m/m</b>' : '') + (M2yu > 0 ? '<br>　　y方向支座 M<sub>2yu</sub> = α<sub>yu</sub>·q<sub>2阶段</sub>·L<sub>x</sub>² = <b>' + fmt(M2yu, 3) + ' kN·m/m</b>' : '') + '</div>');

                    st.push('<div class="step"><b>⑨ 第二阶段正截面受弯（短跨方向，H.0.2 条第 2 款 + 第 6.2.10 条）</b>　叠合层 f<sub>c2</sub> = ' + fmt(fc2, 2) + ' N/mm²（正弯矩区段混凝土强度按叠合层取用，H.0.2 条末尾规定）；整体 h<sub>0x</sub> = ' + fmt(h0x_a, 0) + ' mm。<br>　　x = f<sub>y</sub>·A<sub>s</sub>/(α<sub>1</sub>f<sub>c2</sub>b) = <b>' + fmt(x2x, 1) + ' mm</b>，' + (over2x ? '超筋' : '适筋') + '。M<sub>ux</sub> = <b>' + fmt(Mu2x, 3) + ' kN·m/m</b>；M<sub>2x</sub> = ' + fmt(M2x, 3) + ' ' + (cap2xOk ? '≤' : '＞') + ' M<sub>ux</sub>，' + (cap2xOk ? '满足。' : '不满足。') + '</div>');

                    st.push('<div class="step"><b>⑩ 第二阶段正截面受弯（长跨方向）</b>　h<sub>0y</sub> = ' + fmt(h0y_a, 0) + ' mm；M<sub>uy</sub> = <b>' + fmt(Mu2y, 3) + ' kN·m/m</b>；M<sub>2y</sub> = ' + fmt(M2y, 3) + ' ' + (cap2yOk ? '≤' : '＞') + ' M<sub>uy</sub>，' + (cap2yOk ? '满足。' : '不满足。') + '</div>');

                    if (M2xu > 0 || M2yu > 0) {
                        var s2sup = '<div class="step"><b>⑪ 第二阶段支座负弯矩配筋（负弯矩区段）</b>';
                        if (M2xu > 0) s2sup += '<br>　　x方向支座：M<sub>2xu</sub> = ' + fmt(M2xu, 3) + ' kN·m/m ≤ M<sub>uxu</sub> = ' + fmt(Mu2xu, 3) + ' kN·m/m，' + (cap2xuOk ? '满足。' : '不满足。');
                        if (M2yu > 0) s2sup += '<br>　　y方向支座：M<sub>2yu</sub> = ' + fmt(M2yu, 3) + ' kN·m/m ≤ M<sub>uyu</sub> = ' + fmt(Mu2yu, 3) + ' kN·m/m，' + (cap2yuOk ? '满足。' : '不满足。');
                        s2sup += '</div>';
                        st.push(s2sup);
                    }

                    st.push('<div class="step"><b>⑫ 第二阶段叠合面受剪与斜截面受剪（H.0.4 / H.0.3 条）</b>　取短跨方向剪力 V<sub>2</sub> = q<sub>总</sub>·L<sub>x</sub>/2 = ' + fmt(V2, 3) + ' kN/m。<br>　　τ = V<sub>2</sub>/(b·h<sub>0x</sub>) = ' + fmt(tau2, 3) + ' N/mm² ≤ 0.4 N/mm²，' + (face2Ok ? '满足。' : '不满足。') + '<br>　　V<sub>cs</sub> = 0.7·min(f<sub>t</sub>, f<sub>t2</sub>)·b·h<sub>0x</sub> = 0.7 × ' + fmt(ftLow, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h0x_a, 0) + ' = <b>' + fmt(vc2, 3) + ' kN/m</b>（H.0.3 条：混凝土强度取叠合层与预制构件中的较低值）；V<sub>2</sub> ' + (shear2Ok ? '≤' : '＞') + ' V<sub>cs</sub>，' + (shear2Ok ? '满足。' : '不满足。') + '</div>');

                } else {
                    // 单向板使用阶段
                    st.push('<div class="step"><b>⑦ 第二阶段荷载与内力组合（GB/T 50010-2010（2024年版） 附录 H 第 H.0.1 条第 2 款 + 第 H.0.2 条）</b>　第二阶段叠合层达强度后，叠合构件按整体结构计算；可变荷载取施工活载与使用活载的较大值（H.0.1 条第 2 款：第二阶段考虑施工阶段和使用阶段两种工况，取不利）。<br>　　永久荷载：面层吊顶等自重 g<sub>2k</sub> = ' + fmt(g2k, 3) + ' kN/m²；施工活载 q<sub>k</sub> = ' + fmt(qk, 3) + ' kN/m²；使用活载 q<sub>2k</sub> = ' + fmt(q2k, 3) + ' kN/m²。<br>　　<b>基本组合可变荷载</b>：q<sub>2Qk</sub> = max(q<sub>k</sub>, q<sub>2k</sub>) = <b>' + fmt(q2kEff, 3) + ' kN/m²</b>。<br>　　正弯矩区段总面荷载（基本组合，H.0.2 条第 2 款）：q<sub>总</sub> = γ<sub>G</sub>·g<sub>1k</sub> + γ<sub>G</sub>·g<sub>2k</sub> + γ<sub>Q</sub>·q<sub>2Qk</sub> = ' + fmt(gG, 2) + '×' + fmt(g1k, 3) + ' + ' + fmt(gG, 2) + '×' + fmt(g2k, 3) + ' + ' + fmt(gQ, 2) + '×' + fmt(q2kEff, 3) + ' = ' + fmt(q2Total, 3) + ' kN/m²。</div>');

                    st.push('<div class="step"><b>⑧ 第二阶段内力（单向板，M = qL²/8）</b>　' + (sepWarn ? '分离式接缝宜按单向板设计（JGJ 1-2014 第 6.6.3 条）；' : '') + (isOnewayHint ? 'L<sub>y</sub>/L<sub>x</sub>＞3，宜按单向板设计（GB/T 50010-2010（2024年版） 第 9.1.1 条）；' : '') + '<br>　　M<sub>2</sub> = q<sub>总</sub>·L²/8 = ' + fmt(q2Total, 3) + ' × ' + fmt(Lx, 2) + '² / 8 = <b>' + fmt(M2, 3) + ' kN·m/m</b>；V<sub>2</sub> = q<sub>总</sub>·L/2 = ' + fmt(V2, 3) + ' kN/m。</div>');

                    st.push('<div class="step"><b>⑨ 第二阶段正截面受弯（H.0.2 条第 2 款 + 第 6.2.10 条）</b>　叠合层 f<sub>c2</sub> = ' + fmt(fc2, 2) + ' N/mm²（正弯矩区段混凝土强度按叠合层取用）；h<sub>0</sub> = ' + fmt(h0x_a, 0) + ' mm。<br>　　x = f<sub>y</sub>·A<sub>s</sub>/(α<sub>1</sub>f<sub>c2</sub>b) = <b>' + fmt(x2, 1) + ' mm</b>，' + (over2 ? '超筋' : '适筋') + '。M<sub>u</sub> = <b>' + fmt(Mu2, 3) + ' kN·m/m</b>；M<sub>2</sub> = ' + fmt(M2, 3) + ' ' + (cap2Ok ? '≤' : '＞') + ' M<sub>u</sub>，' + (cap2Ok ? '满足。' : '不满足。') + '</div>');

                    st.push('<div class="step"><b>⑩ 第二阶段叠合面受剪与斜截面受剪（H.0.4 / H.0.3 条）</b>　τ = V<sub>2</sub>/(b·h<sub>0</sub>) = ' + fmt(tau2, 3) + ' N/mm² ≤ 0.4 N/mm²，' + (face2Ok ? '满足。' : '不满足。') + '<br>　　V<sub>cs</sub> = 0.7·min(f<sub>t</sub>, f<sub>t2</sub>)·b·h<sub>0</sub> = 0.7 × ' + fmt(ftLow, 2) + ' × ' + fmt(b, 0) + ' × ' + fmt(h0x_a, 0) + ' = <b>' + fmt(vc2, 3) + ' kN/m</b>（H.0.3 条：混凝土强度取叠合层与预制构件中的较低值）；V<sub>2</sub> ' + (shear2Ok ? '≤' : '＞') + ' V<sub>cs</sub>，' + (shear2Ok ? '满足。' : '不满足。') + '</div>');
                }

                st.push('<div class="step" style="color:#64748b"><b>注</b>　① 施工阶段按单向简支板计算是因为预制板之间的拼缝在叠合层混凝土达到强度之前不能有效传递弯矩和剪力，每块预制底板独立受力。② 使用阶段双向板弯矩系数按弹性理论取值，考虑泊松比 ν=0.2 修正。③ 支座负弯矩需在板顶配置负筋，实际工程应单独配置。④ 裂缝宽度按 GB 50010 第 7.1.2 条、挠度按第 7.2 节另行验算。</div>');
                proc.innerHTML = st.join('');
                console.log('[stage-check] 详细过程已填充, 长度:', st.join('').length, 'proc元素:', !!proc);
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._SC_RESULT = {
                    mode: 'twoway', kind: p.kind, support: 'n',
                    Lx: Lx, Ly: Ly, edge: edge, joint: joint, ratioLyLx: ratioLyLx,
                    B: b, b: b, hp: hp, hc: hc, h: h,
                    stage2IsTwoway: stage2IsTwoway, isOnewayHint: isOnewayHint, sepWarn: sepWarn,
                    q1: q1, M1: M1, V1: V1, h01: h01,
                    x1: x1, xb1: xb1, over1: over1, Mu1: Mu1, cap1Ok: cap1Ok,
                    sig1k: sig1k, sigOk: sigOk, tau: tau, faceOk: faceOk, vc: vc, shearOk: shearOk,
                    q2Total: q2Total,
                    M2x: M2x, M2y: M2y, M2xu: M2xu, M2yu: M2yu,
                    Mu2x: Mu2x, Mu2y: Mu2y, Mu2xu: Mu2xu, Mu2yu: Mu2yu,
                    cap2xOk: cap2xOk, cap2yOk: cap2yOk, cap2xuOk: cap2xuOk, cap2yuOk: cap2yuOk,
                    M2: M2, Mu2: Mu2, cap2Ok: cap2Ok,
                    V2: V2, tau2: tau2, vc2: vc2, face2Ok: face2Ok, shear2Ok: shear2Ok,
                    h0x_a: h0x_a, h0y_a: h0y_a, ftLow: ftLow,
                    coefs2: coefs2, allCap2Ok: allCap2Ok, allOk: allOk,
                    steps: st.join('')
                };
            }
            function syncScUI() {
                var k = document.getElementById('sc_kind').value;
                var slabMode = document.getElementById('sc_slab_mode').value;
                var sup = document.getElementById('sc_support').value;
                
                // 永久荷载标准值汇总（实时显示）
                var gkSumEl = document.getElementById('sc_gk_sum');
                if (gkSumEl) {
                    var hpV = parseFloat(document.getElementById('sc_hp').value) || 0;
                    var hcV = parseFloat(document.getElementById('sc_hc').value) || 0;
                    var gammaV = parseFloat(document.getElementById('sc_gamma').value) || 25;
                    var g2kV = parseFloat(document.getElementById('sc_g2k').value) || 0;
                    var g1k = gammaV * hpV / 1000;   // 预制自重 kN/m²
                    var g2kVal = gammaV * hcV / 1000;  // 叠合层自重 kN/m²
                    var gkTotal = g1k + g2kVal + g2kV;
                    gkSumEl.innerHTML = gkTotal.toFixed(3) + ' <span style="font-size:12px;font-weight:400;color:#0369a1;">（预制 ' + g1k.toFixed(3) + ' + 叠合层 ' + g2kVal.toFixed(3) + ' + 面层 ' + g2kV.toFixed(3) + '）</span>';
                }
// 构件类型显示：板显示板宽B/配筋间距s，梁显示梁宽b/钢筋根数n
                var fldB = document.getElementById('fld_sc_B');
                if (fldB) fldB.style.display = k === 'slab' ? '' : 'none';
                var bF = document.getElementById('sc_b');
                if (bF && bF.parentElement) bF.parentElement.style.display = k === 'beam' ? '' : 'none';
                var sF = document.getElementById('sc_s'), nF = document.getElementById('sc_n');
                if (sF && sF.parentElement) sF.parentElement.style.display = k === 'slab' ? '' : 'none';
                if (nF && nF.parentElement) nF.parentElement.style.display = k === 'beam' ? '' : 'none';
                // 板受力模式显示（仅板显示）
                var modeF = document.getElementById('sc_slab_mode');
                if (modeF && modeF.parentElement) modeF.parentElement.style.display = k === 'slab' ? '' : 'none';
                // 计算模型说明：双向板显示
                var noteF = document.getElementById('sc_model_note');
                if (noteF) noteF.style.display = (k === 'slab' && slabMode === 'twoway') ? '' : 'none';
                // 单向板跨度 L
                var fldL = document.getElementById('fld_sc_L');
                if (fldL) fldL.style.display = (k === 'beam' || (k === 'slab' && slabMode === 'oneway')) ? '' : 'none';
                // 双向板参数（仅板+双向显示）
                var showTwo = (k === 'slab' && slabMode === 'twoway');
                ['fld_sc_Lx', 'fld_sc_Ly', 'fld_sc_edge', 'fld_sc_joint'].forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el) el.style.display = showTwo ? '' : 'none';
                });
                // 拼缝构造提示显示（双向板模式下显示折叠区）
                var detJoint = document.getElementById('sc_det_joint');
                var jointDetail = document.getElementById('sc_joint_detail');
                if (detJoint) detJoint.style.display = showTwo ? '' : 'none';
                if (showTwo && jointDetail) {
                    var joint = document.getElementById('sc_joint').value;
                    var hp = parseFloat(document.getElementById('sc_hp').value) || 0;
                    var hc = parseFloat(document.getElementById('sc_hc').value) || 0;
                    var d = parseFloat(document.getElementById('sc_d').value) || 8;
                    var sVal = parseFloat(document.getElementById('sc_s').value) || 200;
                    var As1 = Math.PI * d * d / 4 * 1000 / sVal;
                    var html = '';
                    html += '<div style="margin-bottom:8px;"><b>通用构造要求（JGJ 1-2014 第 6.6.2 条）：</b></div>';
                    html += '<div style="padding-left:12px;">';
                    html += '• 预制板厚度不宜小于 60 mm' + (hp < 60 ? ' <span style="color:#dc2626;">（当前 ' + hp + ' mm，不满足）</span>' : ' <span style="color:#16a34a;">（当前 ' + hp + ' mm，满足）</span>') + '；<br>';
                    html += '• 后浇叠合层厚度不应小于 60 mm' + (hc < 60 ? ' <span style="color:#dc2626;">（当前 ' + hc + ' mm，不满足）</span>' : ' <span style="color:#16a34a;">（当前 ' + hc + ' mm，满足）</span>') + '；<br>';
                    html += '• 跨度大于 3 m 宜采用桁架钢筋混凝土叠合板；<br>';
                    html += '• 跨度大于 6 m 宜采用预应力混凝土预制板。';
                    html += '</div>';
                    if (joint === 'integral') {
                        html += '<div style="margin-top:10px;margin-bottom:8px;"><b>整体式拼缝构造（JGJ 1-2014 第 6.6.6 条）：</b></div>';
                        html += '<div style="padding-left:12px;">';
                        html += '• 整体式接缝宜设置在叠合板的次要受力方向上，且宜避开最大弯矩截面；<br>';
                        html += '• 后浇带宽度不宜小于 200 mm；<br>';
                        html += '• 后浇带两侧板底纵向受力钢筋可在后浇带中焊接、搭接连接、弯折锚固；<br>';
                        html += '• 当板底受力钢筋采用弯折锚固时，叠合板总厚度不应小于 10d，且不应小于 120 mm。';
                        html += '</div>';
                    } else if (joint === 'separate') {
                        html += '<div style="margin-top:10px;margin-bottom:8px;"><b>分离式拼缝构造（JGJ 1-2014 第 6.6.5 条）：</b></div>';
                        html += '<div style="padding-left:12px;">';
                        html += '• 接缝处紧邻预制板顶面宜设置垂直于板缝的附加钢筋；<br>';
                        html += '• 附加钢筋伸入两侧后浇混凝土叠合层的锚固长度不应小于 15d；<br>';
                        html += '• 附加钢筋截面面积不宜小于预制板中该方向钢筋面积，不宜小于 ' + fmt(As1, 0) + ' mm²/m；<br>';
                        html += '• 附加钢筋直径不宜小于 6 mm、间距不宜大于 250 mm。';
                        html += '</div>';
                    } else if (joint === 'none') {
                        html += '<div style="margin-top:10px;margin-bottom:8px;"><b>无接缝（整块预制板）：</b></div>';
                        html += '<div style="padding-left:12px;">';
                        html += '• 无接缝整块预制板，使用阶段可按双向板设计（JGJ 1-2014 第 6.6.3 条）；<br>';
                        html += '• 注意预制板尺寸受生产、运输和吊装条件限制。';
                        html += '</div>';
                    }
                    jointDetail.innerHTML = html;
                }
                // 截面宽度 b（梁模式显示）
                var bF = document.getElementById('sc_b');
                if (bF && bF.parentElement) bF.parentElement.style.display = k === 'beam' ? '' : 'none';
                // 有支撑隐藏第二阶段表单 & 施工强度比例
                var f2 = document.getElementById('f-sc2');
                if (f2) f2.style.display = sup === 'y' ? 'none' : '';
                var panel2 = document.getElementById('panel_sc2');
                if (panel2) panel2.style.display = sup === 'y' ? 'none' : '';
                var rF = document.getElementById('sc_ratio');
                if (rF && rF.parentElement) rF.parentElement.style.display = sup === 'y' ? 'none' : '';
            }
            document.getElementById('sc_kind').addEventListener('change', function () { syncScUI(); calc(); });
            document.getElementById('sc_slab_mode').addEventListener('change', function () { syncScUI(); calc(); });
            document.getElementById('sc_support').addEventListener('change', function () { syncScUI(); calc(); });
            document.getElementById('sc_edge').addEventListener('change', calc);
            document.getElementById('sc_joint').addEventListener('change', function () { syncScUI(); calc(); });
            ['sc_d', 'sc_s', 'sc_hp', 'sc_hc', 'sc_n', 'sc_ratio', 'sc_gamma', 'sc_qk', 'sc_g2k', 'sc_q2k', 'sc_psi2', 'sc_con2'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.addEventListener('input', function () { syncScUI(); }); if (el) el.addEventListener('change', function () { syncScUI(); calc(); });
            });
            // 按钮绑定
            var btnCalc = document.getElementById('sc_calc');
            if (btnCalc) btnCalc.addEventListener('click', calc);
            var btnReset = document.getElementById('sc_reset');
            if (btnReset) btnReset.addEventListener('click', function () {
                f.reset();
                var f2 = document.getElementById('f-sc2');
                if (f2) f2.reset();
                syncScUI();
                calc();
            });
            syncScUI();
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['stage-check'] = tool;
})();
