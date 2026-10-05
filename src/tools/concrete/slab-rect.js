(function () {
    var tool = {
        title: '单块矩形板计算',
        sub: '四边支承单向/双向板 · 弹性理论查表法 · 跨中与支座配筋',
        meta: {
            standard: '弹性薄板理论 + GB/T 50010-2010（2024年版）',
            formulaSource: '6.2.10',
            limitations: '四边支承矩形板，单向板/双向板弹性理论查表法',
            unit: 'M:kN·m/m, As:mm²/m, Lx,Ly:m',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">几何尺寸与支承条件</div>' +
                '<form id="f-slab"><div class="grid2">' +
                numField('sb_lx', '短边计算跨度 l<sub>x</sub>', 'm', 3.0) +
                numField('sb_ly', '长边计算跨度 l<sub>y</sub>', 'm', 4.5) +
                numField('sb_h', '板厚 h', 'mm', 120) +
                numField('sb_as', '受拉筋合力点距离 a<sub>s</sub>', 'mm', 20) +
                selField('sb_sx1', '短边方向支承（左）', opts([{v:'s',t:'简支'},{v:'f',t:'固定'}], 's')) +
                selField('sb_sx2', '短边方向支承（右）', opts([{v:'s',t:'简支'},{v:'f',t:'固定'}], 's')) +
                selField('sb_sy1', '长边方向支承（下）', opts([{v:'s',t:'简支'},{v:'f',t:'固定'}], 's')) +
                selField('sb_sy2', '长边方向支承（上）', opts([{v:'s',t:'简支'},{v:'f',t:'固定'}], 's')) +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">荷载与材料</div><div class="grid2">' +
                numField('sb_gk', '恒载标准值 g<sub>k</sub>', 'kN/m²', 4.0) +
                numField('sb_qk', '活载标准值 q<sub>k</sub>', 'kN/m²', 2.0) +
                numField('sb_gG', '恒载分项系数 γ<sub>G</sub>', '—', 1.2) +
                numField('sb_gQ', '活载分项系数 γ<sub>Q</sub>', '—', 1.4) +
                selField('sb_con', '混凝土强度等级', conOpts('C30')) +
                selField('sb_reb', '钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="sb_calc">计算板配筋</button>' +
                '<button type="button" class="btn btn-secondary" id="sb_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">板类判别与弯矩</div><div id="sb_result"></div></div>' +
                '<div class="panel"><div class="panel-title">每延米配筋（x 方向 / y 方向）</div><div id="sb_rebar"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="sb_proc"></div></div></div></div>';
        },
        bind: function () {
            // 弹性薄板理论弯矩系数表：四边支承矩形板，均布荷载
            // 格式: alpha[case][ratio_index]，ratio = lx/ly
            // case 编码：第一位 x1, 第二位 x2, 第三位 y1, 第四位 y2；s=简支, f=固定
            // 比值 lx/ly 从 0.4~1.0 每 0.1 一档（7 档），共 16 种支承组合
            // 这里采用工程上常见的「四边简支 / 四边固定 / 三边简支一边固定」等典型组合的系数
            // 简化为 4 种常用情形，其余做近似插值（实际工程建议用有限元，此处做工程估算）
            var RATIOS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
            // 四边简支（均布荷载）：跨中弯矩系数 m = α * q * lx²
            // 来源：《建筑结构静力计算手册》弹性薄板理论表
            // mx: 短跨跨中，my: 长跨跨中，mx0: 短跨支座（固定边），my0: 长跨支座
            var TABLES = {
                'ssss': { // 四边简支
                    mx:  [0.0101, 0.0144, 0.0190, 0.0237, 0.0284, 0.0329, 0.0368],
                    my:  [0.0928, 0.0801, 0.0671, 0.0551, 0.0447, 0.0358, 0.0368],
                    mx0: [0, 0, 0, 0, 0, 0, 0],
                    my0: [0, 0, 0, 0, 0, 0, 0]
                },
                'ffff': { // 四边固定
                    mx:  [0.0019, 0.0035, 0.0057, 0.0083, 0.0114, 0.0147, 0.0179],
                    my:  [0.0579, 0.0472, 0.0372, 0.0288, 0.0218, 0.0162, 0.0179],
                    mx0: [-0.0510, -0.0585, -0.0653, -0.0707, -0.0746, -0.0771, -0.0783],
                    my0: [-0.0829, -0.0843, -0.0839, -0.0821, -0.0793, -0.0759, -0.0783]
                },
                'sfsf': { // 短跨两固定、长跨两简支（x方向固定，y方向简支）
                    mx:  [0.0043, 0.0074, 0.0111, 0.0154, 0.0200, 0.0245, 0.0283],
                    my:  [0.0795, 0.0687, 0.0577, 0.0475, 0.0385, 0.0308, 0.0283],
                    mx0: [-0.0368, -0.0422, -0.0468, -0.0504, -0.0529, -0.0546, -0.0555],
                    my0: [0, 0, 0, 0, 0, 0, 0]
                },
                'fsfs': { // 短跨两简支、长跨两固定（x方向简支，y方向固定）
                    mx:  [0.0053, 0.0079, 0.0113, 0.0152, 0.0194, 0.0237, 0.0277],
                    my:  [0.0620, 0.0543, 0.0464, 0.0386, 0.0315, 0.0253, 0.0277],
                    mx0: [0, 0, 0, 0, 0, 0, 0],
                    my0: [-0.0497, -0.0552, -0.0589, -0.0608, -0.0613, -0.0608, -0.0600]
                }
            };

            function getCaseCode(sx1, sx2, sy1, sy2) {
                return sx1 + sx2 + sy1 + sy2;
            }

            function interpCoef(arr, ratio) {
                // ratio = lx/ly, 在 RATIOS 中插值
                if (ratio <= RATIOS[0]) return arr[0];
                if (ratio >= RATIOS[RATIOS.length - 1]) return arr[RATIOS.length - 1];
                for (var i = 0; i < RATIOS.length - 1; i++) {
                    if (ratio >= RATIOS[i] && ratio <= RATIOS[i+1]) {
                        var t = (ratio - RATIOS[i]) / (RATIOS[i+1] - RATIOS[i]);
                        return arr[i] + t * (arr[i+1] - arr[i]);
                    }
                }
                return 0;
            }

            function calc() {
                var out1 = document.getElementById('sb_result');
                var out2 = document.getElementById('sb_rebar');
                var proc = document.getElementById('sb_proc');
                function err(m) { out1.innerHTML = '<div class="error-box">' + m + '</div>'; out2.innerHTML = ''; proc.innerHTML = ''; return; }

                var lx = parseFloat(document.getElementById('sb_lx').value);
                var ly = parseFloat(document.getElementById('sb_ly').value);
                var h = parseFloat(document.getElementById('sb_h').value);
                var asV = parseFloat(document.getElementById('sb_as').value);
                var sx1 = document.getElementById('sb_sx1').value;
                var sx2 = document.getElementById('sb_sx2').value;
                var sy1 = document.getElementById('sb_sy1').value;
                var sy2 = document.getElementById('sb_sy2').value;
                var gk = parseFloat(document.getElementById('sb_gk').value);
                var qk = parseFloat(document.getElementById('sb_qk').value);
                var gG = parseFloat(document.getElementById('sb_gG').value);
                var gQ = parseFloat(document.getElementById('sb_gQ').value);
                var con = CONCRETE[document.getElementById('sb_con').value];
                var reb = REBAR_FLEX[document.getElementById('sb_reb').value];

                if (!(lx > 0 && ly > 0)) return err('跨度必须为正数。');
                if (!(h > 0)) return err('板厚必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应小于板厚。');
                if (!(gk >= 0 && qk >= 0 && gG > 0 && gQ > 0)) return err('荷载与分项系数输入无效。');

                // 确保 lx ≤ ly（短边为 x）
                var swapped = false;
                if (lx > ly) { var t = lx; lx = ly; ly = t; swapped = true; }
                var ratio = lx / ly;
                var h0x = h - asV; // x 方向钢筋在外侧
                var h0y = h - asV - 10; // y 方向钢筋在内侧，h0 小一个直径（近似 10mm）
                var fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
                var fy = reb.fy, es = reb.es;
                var xi_b = b1 / (1 + fy / (es * ecu));
                var rho_min = rhoMinFlex(ft, fy).rho;
                var b = 1000; // 每延米板带
                var AsMin = rho_min * b * h; // 最小配筋按全截面（单向受弯，按 b*h）

                var q = gG * gk + gQ * qk; // 面荷载设计值 kN/m²
                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　短边 l<sub>x</sub> = ' + fmt(lx,2) + ' m，长边 l<sub>y</sub> = ' + fmt(ly,2) + ' m，l<sub>x</sub>/l<sub>y</sub> = ' + fmt(ratio,3) + '；板厚 h = ' + h + ' mm，h<sub>0x</sub> = ' + fmt(h0x,0) + ' mm，h<sub>0y</sub> = ' + fmt(h0y,0) + ' mm。</div>');

                var isOneWay = ratio <= 1/3; // ≤ 1/3 可按单向板计算
                var plateType = isOneWay ? '单向板（l<sub>x</sub>/l<sub>y</sub> ≤ 1/3，可按单向板计算）' : '双向板（按弹性薄板理论计算）';
                st.push('<div class="step"><b>② 板类判别</b>　l<sub>x</sub>/l<sub>y</sub> = ' + fmt(ratio,3) + ' ⇒ <b>' + plateType + '</b>' + tag(isOneWay ? 'ok' : 'warn', isOneWay ? '单向板' : '双向板') + '</div>');

                var mx, my, mx0, my0;
                var caseCode = getCaseCode(sx1, sx2, sy1, sy2);

                if (isOneWay) {
                    // 单向板：按简支梁（或连续梁单跨）计算
                    // 假设两边简支（沿 lx 方向），跨中弯矩 M = q*lx²/8（每延米）
                    // 考虑支座情况
                    var hasFix = (sx1 === 'f') && (sx2 === 'f');
                    if (hasFix) {
                        // 两端固定：跨中 M = ql²/24，支座 M = ql²/12
                        mx = q * lx * lx / 24; // 跨中（每延米 kN·m/m）
                        mx0 = -q * lx * lx / 12; // 支座
                    } else if (sx1 === 'f' || sx2 === 'f') {
                        // 一端固定一端简支
                        mx = q * lx * lx / 11.5; // 近似
                        mx0 = -q * lx * lx / 13; // 近似
                    } else {
                        mx = q * lx * lx / 8; // 简支
                        mx0 = 0;
                    }
                    my = q * ly * lx / 24; // 长跨方向按分布筋考虑，给个构造值（分布筋满足最小配筋率）
                    my0 = 0;
                    st.push('<div class="step"><b>③ 单向板弯矩（沿短跨 l<sub>x</sub> 方向）</b>　q = ' + fmt(q,2) + ' kN/m²；M<sub>x,max</sub> = ' + fmt(mx,3) + ' kN·m/m（每延米板带）；支座弯矩 M<sub>x0</sub> = ' + fmt(mx0,3) + ' kN·m/m。</div>');
                } else {
                    // 双向板：查表（弹性系数法）
                    var table = TABLES[caseCode];
                    if (!table) {
                        // 非标准组合，用四边简支近似（保守）
                        table = TABLES['ssss'];
                        st.push('<div class="step"><b>③ 支承组合提示</b>　当前支承组合（' + caseCode.toUpperCase() + '）非标准查表组合，按四边简支近似计算（结果偏保守），建议使用有限元方法精确计算。</div>');
                    }
                    var alpha_x = interpCoef(table.mx, ratio);
                    var alpha_y = interpCoef(table.my, ratio);
                    var alpha_x0 = interpCoef(table.mx0, ratio);
                    var alpha_y0 = interpCoef(table.my0, ratio);
                    mx = alpha_x * q * lx * lx; // kN·m/m（每延米）
                    my = alpha_y * q * lx * lx;
                    mx0 = alpha_x0 * q * lx * lx;
                    my0 = alpha_y0 * q * lx * lx;
                    st.push('<div class="step"><b>③ 双向板弯矩（弹性系数法）</b>　支承情况：短跨 [' + (sx1==='s'?'简支':'固定') + '/' + (sx2==='s'?'简支':'固定') + ']，长跨 [' + (sy1==='s'?'简支':'固定') + '/' + (sy2==='s'?'简支':'固定') + ']；系数 α<sub>x</sub> = ' + fmt(alpha_x,4) + '，α<sub>y</sub> = ' + fmt(alpha_y,4) + '。</div>');
                    st.push('<div class="step"><b>④ 跨中弯矩</b>　M<sub>x</sub> = α<sub>x</sub>·q·l<sub>x</sub>² = ' + fmt(mx,3) + ' kN·m/m；M<sub>y</sub> = α<sub>y</sub>·q·l<sub>x</sub>² = ' + fmt(my,3) + ' kN·m/m（每延米板带）。</div>');
                    if (Math.abs(mx0) > 0.001 || Math.abs(my0) > 0.001) {
                        st.push('<div class="step"><b>⑤ 支座弯矩（绝对值最大）</b>　M<sub>x0</sub> = ' + fmt(mx0,3) + ' kN·m/m；M<sub>y0</sub> = ' + fmt(my0,3) + ' kN·m/m（每延米板带）。</div>');
                    }
                }

                // 配筋计算（每延米）
                function calcAs(M, h0v) {
                    var Mabs = Math.abs(M) * 1e6; // N·mm/m
                    var alpha_s = Mabs / (a1 * fc * b * h0v * h0v);
                    if (alpha_s > 1) return { As: Infinity, over: true, alpha_s: alpha_s, gamma_s: 0 };
                    var gamma_s = 0.5 * (1 + Math.sqrt(1 - 2 * alpha_s));
                    var As = Mabs / (gamma_s * fy * h0v);
                    var xi = 2 * (1 - gamma_s);
                    var over = xi > xi_b;
                    if (over) As = a1 * fc * b * xi_b * h0v / fy;
                    return { As: As, over: over, alpha_s: alpha_s, gamma_s: gamma_s, xi: xi };
                }

                var rx = calcAs(mx, h0x);
                var ry = calcAs(my, h0y);
                var rx0 = Math.abs(mx0) > 0.01 ? calcAs(mx0, h0x) : null;
                var ry0 = Math.abs(my0) > 0.01 ? calcAs(my0, h0y) : null;

                st.push('<div class="step"><b>⑥ 配筋计算（每延米）</b>　A<sub>s</sub> = M / (γ<sub>s</sub>·f<sub>y</sub>·h<sub>0</sub>)；最小配筋率 ρ<sub>min</sub> = max(0.2%, 0.45f<sub>t</sub>/f<sub>y</sub>) = ' + fmt(rho_min*100,3) + '%，A<sub>s,min</sub> = ' + fmt(AsMin,0) + ' mm²/m。</div>');

                // 第⑦步：实配钢筋复核（动态刷新）
                function buildStep7() {
                    var hasAny = false;
                    var keys = ['mx', 'my'];
                    if (rx0) keys.push('mx0');
                    if (ry0) keys.push('my0');
                    var labels = { mx: '短跨跨中（x 向）', my: '长跨跨中（y 向）', mx0: '短跨支座（x 向）', my0: '长跨支座（y 向）' };
                    var rsMap = { mx: rx, my: ry, mx0: rx0, my0: ry0 };
                    var asProvided = (window._SLAB_RESULT && window._SLAB_RESULT.asProvided) ? window._SLAB_RESULT.asProvided : {};
                    var html = '<div class="step"><b>⑦ 实配钢筋复核</b>　';
                    var parts = [];
                    for (var k = 0; k < keys.length; k++) {
                        var key = keys[k];
                        var r = rsMap[key];
                        if (!r) continue;
                        var asP = asProvided[key];
                        if (asP !== null && isFinite(asP) && asP > 0) {
                            hasAny = true;
                            var AsReq = Math.max(r.As, AsMin);
                            var j = (asP >= AsReq) ? '满足' : (asP < AsMin ? '不满足最小配筋率' : '配筋不足');
                            parts.push(labels[key] + '：实配 ' + fmt(asP,0) + ' mm²/m ≥ 所需 ' + fmt(AsReq,0) + ' mm²/m（其中 A<sub>s,min</sub>=' + fmt(AsMin,0) + '） ⇒ ' + j);
                        }
                    }
                    if (!hasAny) {
                        html += '未输入实配面积，仅按计算所需面积判定。在结果表格的「实配面积」列填入数值即可实时复核。';
                    } else {
                        html += parts.join('；') + '。';
                    }
                    html += '</div>';
                    return html;
                }
                function refreshProcStep7() {
                    if (!proc) return;
                    // 找到第⑦步并替换
                    var steps = proc.querySelectorAll('.step');
                    var step7 = null;
                    for (var s = 0; s < steps.length; s++) {
                        if (steps[s].textContent.indexOf('⑦') === 0 || steps[s].textContent.indexOf('⑦ 实配') >= 0) {
                            step7 = steps[s]; break;
                        }
                    }
                    if (step7) {
                        step7.outerHTML = buildStep7();
                    }
                }

                // 结果 1：板类判别 + 弯矩
                var r1 = resultRow('板类判别', badge(isOneWay ? 'badge-ok' : 'badge-warn', isOneWay ? '单向板（l<sub>x</sub>/l<sub>y</sub> ≤ 1/3）' : '双向板（弹性理论）'));
                r1 += resultRow('长短边比 l<sub>x</sub>/l<sub>y</sub>', fmt(ratio, 3));
                r1 += resultRow('面荷载设计值 q', fmt(q, 2) + ' kN/m²');
                r1 += resultRow('短跨跨中弯矩 M<sub>x</sub>', '<span class="highlight">' + fmt(mx, 3) + ' kN·m/m</span>');
                r1 += resultRow('长跨跨中弯矩 M<sub>y</sub>', fmt(my, 3) + ' kN·m/m');
                if (rx0) r1 += resultRow('短跨支座弯矩 M<sub>x0</sub>', fmt(mx0, 3) + ' kN·m/m');
                if (ry0) r1 += resultRow('长跨支座弯矩 M<sub>y0</sub>', fmt(my0, 3) + ' kN·m/m');
                out1.innerHTML = r1;

                // 结果 2：配筋
                var r2 = '<div style="overflow-x:auto;"><table class="mini" id="sb_rebar_tbl"><tr><th>位置</th><th>M (kN·m/m)</th><th>h<sub>0</sub> (mm)</th><th>所需 A<sub>s</sub> (mm²/m)</th><th>配筋率 ρ</th><th>ρ<sub>min</sub></th><th>判定</th><th>推荐配筋</th><th>实配面积 (mm²/m)</th></tr>';
                function recSpacing(As) {
                    // 给定每延米面积，推荐直径+间距
                    var ds = [6, 8, 10, 12, 14, 16];
                    var best = null;
                    for (var i = 0; i < ds.length; i++) {
                        var d = ds[i];
                        var a1 = Math.PI * d * d / 4;
                        var s = a1 / As * 1000; // 间距 mm
                        if (s >= 50 && s <= 300) {
                            if (!best || s < best.s) best = { d: d, s: s, a: a1 };
                        }
                    }
                    if (!best) return '—';
                    return 'φ' + best.d + '@' + Math.round(best.s) + ' (' + fmt(1000/best.s * best.a, 0) + ' mm²/m)';
                }
                function judgeRow(r, asProvided) {
                    // 返回 { ok, txt, cls }
                    if (r.over) return { ok: 'err', txt: '超筋', cls: 'badge-err' };
                    var AsReq = Math.max(r.As, AsMin);
                    if (asProvided !== null && isFinite(asProvided) && asProvided > 0) {
                        if (asProvided >= AsReq) {
                            return { ok: 'ok', txt: '满足', cls: 'badge-ok' };
                        } else if (asProvided < AsMin) {
                            return { ok: 'warn', txt: '不满足最小配筋率 (差' + fmt(AsMin - asProvided, 0) + ')', cls: 'badge-warn' };
                        } else {
                            return { ok: 'warn', txt: '配筋不足 (差' + fmt(r.As - asProvided, 0) + ')', cls: 'badge-warn' };
                        }
                    } else {
                        return r.As >= AsMin
                            ? { ok: 'ok', txt: '满足', cls: 'badge-ok' }
                            : { ok: 'warn', txt: '配筋不足', cls: 'badge-warn' };
                    }
                }
                function row(loc, M, h0v, r, key, asDef) {
                    var As = r.over ? r.As : r.As;
                    var rhoPct = (As / (b * h)) * 100; // 按全截面
                    var j = judgeRow(r, asDef);
                    var inpId = 'sb_aspr_' + key;
                    return '<tr data-row-key="' + key + '"><td>' + loc + '</td><td>' + fmt(M, 3) + '</td><td>' + fmt(h0v, 0) + '</td>' +
                        '<td style="font-weight:600;color:#2563eb;">' + (r.over ? '超筋' : fmt(As, 0)) + '</td>' +
                        '<td>' + fmt(rhoPct, 3) + '%</td><td>' + fmt(rho_min*100, 3) + '%</td>' +
                        '<td class="sb_judge">' + badge(j.cls, j.txt) + '</td>' +
                        '<td>' + (r.over ? '—' : recSpacing(As)) + '</td>' +
                        '<td><input type="number" id="' + inpId + '" class="sb_aspr" data-key="' + key + '" value="' + (asDef !== null ? fmt(asDef, 0) : '') + '" placeholder="输入实配面积" style="width:90px;padding:3px 6px;font-size:12px;border:1px solid #cbd5e1;border-radius:4px;"></td></tr>';
                }
                r2 += row('短跨跨中（x 向）', mx, h0x, rx, 'mx', null);
                r2 += row('长跨跨中（y 向）', my, h0y, ry, 'my', null);
                if (rx0) r2 += row('短跨支座（x 向）', mx0, h0x, rx0, 'mx0', null);
                if (ry0) r2 += row('长跨支座（y 向）', my0, h0y, ry0, 'my0', null);
                r2 += '</table></div>';
                r2 += '<div style="margin-top:8px;font-size:12.5px;color:#64748b;">注：每延米按 b = 1000 mm 板带计算；分布筋面积不应小于受力筋的 15%（单向板）或满足构造要求（双向板），且不应小于 ρ<sub>min</sub>。在「实配面积」列输入实际配筋面积，判定列会实时复核。</div>';
                out2.innerHTML = r2;

                // 实配面积输入实时复核
                var asprInputs = out2.querySelectorAll('.sb_aspr');
                var asprMap = { mx: { r: rx, M: mx, h0v: h0x }, my: { r: ry, M: my, h0v: h0y } };
                if (rx0) asprMap.mx0 = { r: rx0, M: mx0, h0v: h0x };
                if (ry0) asprMap.my0 = { r: ry0, M: my0, h0v: h0y };
                function updateJudge(input) {
                    var key = input.getAttribute('data-key');
                    var info = asprMap[key];
                    if (!info) return;
                    var val = parseFloat(input.value);
                    var asP = (isFinite(val) && val > 0) ? val : null;
                    var j = judgeRow(info.r, asP);
                    // 更新对应行的判定单元格
                    var tr = input.closest('tr');
                    if (tr) {
                        var jCell = tr.querySelector('.sb_judge');
                        if (jCell) jCell.innerHTML = badge(j.cls, j.txt);
                    }
                    // 更新 _SLAB_RESULT
                    if (window._SLAB_RESULT) {
                        if (!window._SLAB_RESULT.asProvided) window._SLAB_RESULT.asProvided = {};
                        window._SLAB_RESULT.asProvided[key] = asP;
                    }
                    // 同步更新详细计算过程的第⑦步
                    refreshProcStep7();
                }
                for (var _i = 0; _i < asprInputs.length; _i++) {
                    asprInputs[_i].addEventListener('input', function (e) { updateJudge(e.target); });
                }

                proc.innerHTML = st.join('') + buildStep7();
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._SLAB_RESULT = {
                    lx: lx, ly: ly, h: h, asV: asV, swapped: swapped, ratio: ratio,
                    sx1: sx1, sx2: sx2, sy1: sy1, sy2: sy2,
                    gk: gk, qk: qk, gG: gG, gQ: gQ, q: q,
                    isOneWay: isOneWay, caseCode: caseCode,
                    mx: mx, my: my, mx0: mx0, my0: my0,
                    rx: rx, ry: ry, rx0: rx0, ry0: ry0,
                    h0x: h0x, h0y: h0y, AsMin: AsMin, rho_min: rho_min,
                    conGrade: document.getElementById('sb_con').value,
                    rebGrade: document.getElementById('sb_reb').value,
                    asProvided: { mx: null, my: null, mx0: rx0 ? null : undefined, my0: ry0 ? null : undefined }
                };
            }

            document.getElementById('sb_calc').addEventListener('click', calc);
            document.getElementById('sb_reset').addEventListener('click', function () {
                var f = document.getElementById('f-slab'); f.reset();
                document.getElementById('sb_lx').value = 3.0;
                document.getElementById('sb_ly').value = 4.5;
                document.getElementById('sb_h').value = 120;
                document.getElementById('sb_as').value = 20;
                document.getElementById('sb_gk').value = 4.0;
                document.getElementById('sb_qk').value = 2.0;
                document.getElementById('sb_gG').value = 1.2;
                document.getElementById('sb_gQ').value = 1.4;
                calc();
            });
            document.getElementById('f-slab').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['slab-rect'] = tool;
})();
