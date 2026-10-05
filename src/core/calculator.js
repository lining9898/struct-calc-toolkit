/* ============================================================
 *  core/calculator.js — 共享计算辅助函数
 * ------------------------------------------------------------
 *  通用数值函数（fmt / interp / phi_b_class）、
 *  表单与结果 UI 构造（numField / selField / resultRow / badge / tag / panelTitle）、
 *  过程面板交互（copyProc）与材料下拉（conOpts）。
 *  被各计算模块与计算书导出模块共同依赖。
 * ============================================================ */
function phi_b_class(lambda, fy) {
    // 简化：用规范近似公式
    var fyi = fy || 235;
    var lamN = lambda * Math.sqrt(fyi / 235); // 正则化长细比 λ_n = λ√(fy/235) / π√(E/fy)?  用 λ_√(fy/235) 近似换算
    // 更准确：λ_n = λ·√(fy/E)/π，但工程上常用换算长细比 λ√(fy/235)
    // 按 b 类截面：
    if (lamN <= 30) return 0.97 + (1.0 - 0.97) * (30 - lamN) / 30;
    if (lamN <= 100) {
        // 查表插值：b类截面
        var lamTable = [30,40,50,60,70,80,90,100];
        var phiTable = [0.936,0.899,0.856,0.807,0.751,0.688,0.621,0.555];
        return interp(lamTable, phiTable, lamN);
    }
    if (lamN <= 200) {
        var lamTable2 = [100,110,120,130,140,150,160,170,180,190,200];
        var phiTable2 = [0.555,0.493,0.437,0.387,0.345,0.308,0.276,0.249,0.225,0.204,0.186];
        return interp(lamTable2, phiTable2, lamN);
    }
    return 275 / (lamN * lamN); // 大长细比近似: φ ≈ π²E/(λ²fy) / fy?  不对，直接按欧拉：φ = π²E/λ² / fy
    // 实际上 λ>100 后按 Perry-Robertson 公式，这里用上面表格已经覆盖到200了
}
function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length-1]) return ys[ys.length-1];
    for (var i = 0; i < xs.length - 1; i++) {
        if (x >= xs[i] && x <= xs[i+1]) {
            return ys[i] + (ys[i+1] - ys[i]) * (x - xs[i]) / (xs[i+1] - xs[i]);
        }
    }
    return ys[ys.length-1];
}

/* ===================== 共享工具函数 ===================== */
function fmt(v, d) { var n = Number(v); if (!isFinite(n)) return '—'; return n.toFixed(d === undefined ? 2 : d); }
function opts(arr, sel) { return arr.map(function (o) { return '<option value="' + o.v + '"' + (String(o.v) === String(sel) ? ' selected' : '') + '>' + o.t + '</option>'; }).join(''); }
// 详细过程面板一键复制
function copyProc(btn, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var wrap = btn.closest('.proc-wrap, details.process');
    if (!wrap) return;
    if (wrap.tagName === 'DETAILS') wrap.open = true;
    else wrap.classList.add('open');
    var body = wrap.querySelector('.proc-body');
    if (!body) return;
    var txt = (body.innerText || body.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    var label = btn._copyLabel || (btn._copyLabel = btn.textContent);
    function status(message) {
        clearTimeout(btn._copyTimer);
        btn.textContent = message;
        btn._copyTimer = setTimeout(function () { btn.textContent = label; }, 2000);
    }
    if (!txt) { status('暂无计算过程'); return; }
    var old = wrap.querySelector('.proc-copy-fallback');
    if (old) old.remove();
    // 同步复制保留本次点击的用户激活，兼容剪贴板权限受限的内嵌页面。
    var active = document.activeElement;
    var selection = window.getSelection();
    var ranges = [];
    if (selection) for (var i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.readOnly = true;
    ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;';
    document.body.appendChild(ta);
    var copied = false;
    try {
        ta.focus({ preventScroll: true });
        ta.select();
        ta.setSelectionRange(0, txt.length);
        copied = document.execCommand('copy');
    } catch (err) { copied = false; }
    finally {
        ta.remove();
        if (active && active.focus) active.focus({ preventScroll: true });
        if (selection) { selection.removeAllRanges(); ranges.forEach(function (r) { selection.addRange(r); }); }
    }
    function manualCopy() {
        status('请手动复制');
        var box = document.createElement('div');
        box.className = 'proc-copy-fallback';
        box.setAttribute('role', 'status');
        var note = document.createElement('p');
        note.textContent = '浏览器限制了自动复制。下面已选中完整计算过程，请按 Ctrl/⌘+C，或长按文字选择复制。';
        var input = document.createElement('textarea');
        input.readOnly = true;
        input.value = txt;
        input.setAttribute('aria-label', '完整计算过程，可手动复制');
        input.style.cssText = 'width:100%;min-height:180px;margin-top:8px;padding:12px;font:inherit;line-height:1.6;';
        box.appendChild(note); box.appendChild(input);
        wrap.appendChild(box);
        input.focus(); input.select(); input.setSelectionRange(0, txt.length);
    }
    if (copied) { status('已复制'); return; }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(function () { status('已复制'); }, manualCopy);
        } else manualCopy();
    } catch (err) { manualCopy(); }
}
/* ===================== 500MPa 级钢筋判定（关键口径，勿用 fy 判断） =====================
 * 必须按「屈服强度标准值 f_yk」判定是否为 500MPa 级钢筋。
 * ⚠ 禁止写成 fy >= 500 之类的判断：HRB500 的强度设计值 fy 只有 435 N/mm²
 *   （= 500 / 1.15），用设计值判断恒为假，会静默跳过两条强制性规定：
 *     ① 第 4.1.2 条 —— 采用 500MPa 级钢筋时混凝土强度等级不应低于 C30；
 *     ② GB 55008-2021 第 4.4.6 条第 2 款 —— 板类构件可采用 0.15% 下限。
 * 依据：GB/T 50010-2010（2024年版）表 4.2.2-1（2026-09-23 已核对）。
 * ==================================================================================== */
var REBAR_FYK = { 'HPB300': 300, 'HRB400': 400, 'HRB500': 500 };

function is500Steel(reb) { return (REBAR_FYK[reb] || 0) >= 500; }

/* 混凝土强度等级数字序号：'C30' -> 30 */
function conGradeIndex(g) { return parseInt(String(g).replace(/^C/, ''), 10); }

/* 第 4.1.2 条：采用 500MPa 级钢筋时不应低于 C30；其余钢筋混凝土不低于 C25 */
function minConGradeFor(reb) { return is500Steel(reb) ? 30 : 25; }

/* 混凝土强度等级下限校验：{ ok, need, used, grade } */
function checkConGradeFloor(grade, reb) {
    var used = conGradeIndex(grade), need = minConGradeFor(reb);
    return { ok: used >= need, need: need, used: used, grade: grade };
}

/* 高于 C50 时，第 6.2 节中 ε_cu 的折减规则尚未与正文核对（见 materials.js 边界说明）。
   本工具不提供 C55 及以上取值，此处仅为向后兼容的显式判断，禁止据此自动折减。 */
function needsHighStrengthEcuCheck(g) { return conGradeIndex(g) > 50; }

/* ===================== 纵向受力普通钢筋最小配筋率 =====================
 * 依据：GB 55008-2021《混凝土结构通用规范》第 4.4.6 条及表 4.4.6
 *       （全文强制；2026-09-23 已与正文逐值核对）
 * 一般构件（受弯/偏心受压一侧）：ρ_min = max(0.20%, 45·f_t/f_y)
 * 板类受弯构件：采用 500MPa 级钢筋、且非悬臂板、非柱支承板时
 *                              ρ_min = max(0.15%, 45·f_t/f_y)
 * 注：原 GB/T 50010-2010（2024年版） 第 8.5.1 条已被替代废止，现行以 GB 55008-2021 为准；
 *     两处数值规定一致（取大值公式未变），但依据必须改用通用规范。
 * @param {number} ft 混凝土轴心抗拉强度设计值 MPa
 * @param {number} fy 钢筋抗拉强度设计值 MPa
 * @param {Object} [o] { isSlab, isCantilever, isColumnSupported, is500 }
 * @returns {Object} { rho, v45, floor, note }
 * ===================================================================== */
function rhoMinFlex(ft, fy, o) {
    o = o || {};
    var v45 = 0.45 * ft / fy;
    var isSlabCase = !!(o.isSlab && !o.isCantilever && !o.isColumnSupported && o.is500);
    var floor = isSlabCase ? 0.0015 : 0.002;
    return {
        rho: Math.max(floor, v45),
        v45: v45,
        floor: floor,
        note: isSlabCase
            ? '板类受弯构件，采用 500MPa 级钢筋：max(0.15%, 45f<sub>t</sub>/f<sub>y</sub>)'
            : 'max(0.20%, 45f<sub>t</sub>/f<sub>y</sub>)'
    };
}

/* 受压构件全部纵向钢筋最小配筋率：GB 55008-2021 表 4.4.6 */
function rhoMinColumnAll(reb) { return COLUMN_RHOMIN[reb] || 0.0055; }

/* 混凝土强度等级下拉。不含 C20：第 4.1.2 条钢筋混凝土不低于 C25。
   不含 C55 及以上：第 6.2 节 α₁/β₁/ε_cu 折减规则尚未核对，不提供未经核对的取值。 */
function conOpts(sel) { return opts(['C25','C30','C35','C40','C45','C50'].map(function (c) { return { v: c, t: c }; }), sel); }
function numField(id, label, unit, value, hint) {
    return '<div class="field"><label>' + label + (unit ? ' <span>(' + unit + ')</span>' : '') + '</label>' +
        '<input type="number" id="' + id + '" value="' + value + '" step="1">' +
        (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
}
function selField(id, label, optionsHtml, hint) {
    return '<div class="field"><label>' + label + '</label><select id="' + id + '">' + optionsHtml + '</select>' +
        (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
}
function resultRow(label, valHtml) { return '<div class="result-item"><span class="label">' + label + '</span><span class="value">' + valHtml + '</span></div>'; }
function badge(cls, text) { return '<span class="badge ' + cls + '">' + text + '</span>'; }
function tag(cls, text) { return '<span class="tag ' + cls + '">' + text + '</span>'; }
function panelTitle(t) { return '<div class="panel-title">' + t + '</div>'; }

/* ===================== 选筋辅助（设计模式共用） ===================== */
/* 单根钢筋公称面积 mm²（GB 1499.2 公称截面积，按 πd²/4 计算） */
function rebarArea(d) { return Math.PI * d * d / 4; }

/* 常用纵筋直径（GB/T 50010-2010（2024年版）第 4.2 章常用规格） */
var REBAR_DIAS = [12, 14, 16, 18, 20, 22, 25, 28, 32];

/**
 * 由需要的钢筋面积反查可选配筋组合。
 * @param {number} AsReq 需要的钢筋面积 mm²
 * @param {Object} [opt] { dias 直径数组, minN 最少根数, maxN 最多根数, maxRatio 允许超配比例 }
 * @returns {Array} [{ d, n, A, over, ratio, perBar }]，按超配面积升序
 */
function pickRebar(AsReq, opt) {
    opt = opt || {};
    var dias = opt.dias || REBAR_DIAS;
    var minN = opt.minN || 2;
    var maxN = opt.maxN || 8;
    var maxRatio = opt.maxRatio || 1.35;
    var out = [];
    dias.forEach(function (d) {
        var a1 = rebarArea(d);
        for (var n = minN; n <= maxN; n++) {
            var A = a1 * n;
            if (A < AsReq - 1e-6) continue;
            var ratio = AsReq > 0 ? A / AsReq : Infinity;
            if (ratio > maxRatio) continue;
            out.push({ d: d, n: n, A: A, over: A - AsReq, ratio: ratio, perBar: a1 });
        }
    });
    out.sort(function (a, b) { return a.over - b.over; });
    return out;
}

/**
 * 每个直径下的最少根数表（用于「优先小直径多根 / 优先大直径少根」权衡）
 * @returns {Array} [{ d, n, A, over, ratio }]
 */
function pickRebarByDia(AsReq, opt) {
    opt = opt || {};
    var dias = opt.dias || REBAR_DIAS;
    var maxN = opt.maxN || 8;
    var out = [];
    dias.forEach(function (d) {
        var a1 = rebarArea(d);
        var n = Math.max(opt.minN || 2, Math.ceil(AsReq / a1));
        if (n > maxN) return;
        var A = a1 * n;
        out.push({ d: d, n: n, A: A, over: A - AsReq, ratio: AsReq > 0 ? A / AsReq : Infinity });
    });
    return out;
}

/* 板类按间距配筋：单位宽度 1000 mm 内，给定间距 s 的钢筋面积 mm²/m */
function areaBySpacing(d, s) { return rebarArea(d) * 1000 / s; }

/* 由需要面积反算间距（板分布筋），返回不大于允许间距的最大常用间距 */
function spacingForArea(d, AsPerM) {
    var spacings = [80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250, 300];
    if (!(AsPerM > 0)) return null;
    var allow = rebarArea(d) * 1000 / AsPerM;
    var best = null;
    for (var i = 0; i < spacings.length; i++) if (spacings[i] <= allow) best = spacings[i];
    return best;
}

/* ===================== 矩形截面受弯配筋设计内核（纯函数） =====================
 * 由设计弯矩反算配筋：单筋优先，超过单筋界限时自动按双筋设计。
 * 「矩形梁正截面配筋设计」工具与「规范问答」中的批量配筋共用本函数，
 * 保证同一套公式只有一处实现。
 * @param {Object} p { b, h, as, as2, con(等级名), reb(级别名), M(kN·m) }
 * @returns {Object} { ok:true, ...中间量与结果 } 或 { ok:false, error }
 * ========================================================================= */
function designBeamRectSection(p) {
    var con = CONCRETE[p.con], reb = REBAR_FLEX[p.reb];
    if (!con || !reb) return { ok: false, error: '混凝土或钢筋强度等级取值缺失。' };
    var b = +p.b, h = +p.h, asV = +p.as, as2V = (+p.as2 || +p.as), M = +p.M;
    if (!(b > 0 && h > 0)) return { ok: false, error: '截面宽度 b 与高度 h 必须为正数。' };
    if (!(asV > 0 && asV < h)) return { ok: false, error: 'a_s 应介于 0 与 h 之间。' };
    if (!(M > 0)) return { ok: false, error: '设计弯矩 M 必须大于 0。' };

    var fc = con.fc, ft = con.ft, a1 = con.alpha1, b1 = con.beta1, ecu = con.ecu;
    var fy = reb.fy, fyp = reb.fyp, es = reb.es;
    var h0 = h - asV;
    var xi_b = b1 / (1 + fy / (es * ecu));
    var xb = xi_b * h0;
    var Mu_single_max = a1 * fc * b * xb * (h0 - xb / 2) / 1e6;
    var M_Nmm = M * 1e6;
    var isDouble = false, x = 0, As = 0, AsP = 0, M1 = 0, M2 = 0;

    // 注意单位：Mu_single_max 为 kN·m，必须与 M(kN·m) 比较；
    // 内部解方程时才用 N·mm（M_Nmm）。
    if (M <= Mu_single_max) {
        var q = h0 * h0 - 2 * M_Nmm / (a1 * fc * b);
        if (q < 0) return { ok: false, error: '计算出现负判别式，请检查参数（M 可能远大于截面能力）。' };
        x = h0 - Math.sqrt(q);
        As = a1 * fc * b * x / fy;
    } else {
        isDouble = true;
        x = xb;
        M1 = a1 * fc * b * xb * (h0 - xb / 2);
        M2 = M_Nmm - M1;
        AsP = M2 / (fyp * (h0 - as2V));
        if (AsP < 0) return { ok: false, error: '受压钢筋面积为负，请检查参数。' };
        As = a1 * fc * b * xb / fy + fyp * AsP / fy;
    }

    var AsCalc = As;                       // ρmin 调整前的计算配筋面积
    // 最小配筋率统一走 GB 55008-2021 第 4.4.6 条（rhоMinFlex），不再在此硬编码，
    // 以免各工具取值口径分散后再度出现依据过期却无人发现的情况。
    var _rm = rhoMinFlex(ft, fy, {
        isSlab: p.isSlab,
        isCantilever: p.isCantilever,
        isColumnSupported: p.isColumnSupported,
        is500: is500Steel(p.reb)
    });
    var rho_min = _rm.rho, rho_min_note = _rm.note;
    var AsMin = rho_min * b * h;
    var byMin = false;
    if (As < AsMin) { byMin = true; As = AsMin; }

    return {
        ok: true, b: b, h: h, h0: h0, as: asV, as2: as2V, M: M,
        fc: fc, ft: ft, a1: a1, b1: b1, ecu: ecu, fy: fy, fyp: fyp, es: es,
        xi_b: xi_b, xb: xb, Mu_single_max: Mu_single_max,
        isDouble: isDouble, x: x, xi: x / h0, M1: M1, M2: M2,
        As: As, AsCalc: AsCalc, AsP: AsP, rho_min: rho_min, rho_min_note: rho_min_note, AsMin: AsMin, byMin: byMin
    };
}

console.log('[Core] calculator.js loaded. 共享辅助函数就绪。');
