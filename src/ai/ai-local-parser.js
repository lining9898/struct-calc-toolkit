/* ==========================================================
 *  AI 本地参数解析器 —— AI_LOCAL_PARSER
 *  不依赖 LLM，用正则从中文短句直接提取结构化参数
 *  用途：1) LLM不可用时的fallback  2) debug模式验证bridge链路
 *
 *  触发方式：用户输入以 "#debug " 开头时走本地解析
 * ========================================================== */
(function () {
    'use strict';

    // 通用：从输入中按一组正则提取第一个匹配的数字
    // 通用：从输入中按一组正则提取第一个匹配的数字
    // 支持单捕获组（数字本身）或多捕获组（别名组+数字组），始终取最后一个捕获组的值
    function pickNumber(text, patterns) {
        for (var i = 0; i < patterns.length; i++) {
            var m = text.match(patterns[i]);
            if (m && m.length > 1) {
                var last = m[m.length - 1];
                if (last !== undefined && last !== '') {
                    var n = parseFloat(last);
                    if (!isNaN(n)) return n;
                }
            }
        }
        return null;
    }

    // 通用：从输入中按一组正则提取第一个匹配的字符串
    // 同样取最后一个捕获组
    function pickString(text, patterns) {
        for (var i = 0; i < patterns.length; i++) {
            var m = text.match(patterns[i]);
            if (m && m.length > 1) {
                var last = m[m.length - 1];
                if (last !== undefined && last !== '') return last;
            }
        }
        return null;
    }

    // 通用：从输入中按一组带单位的正则提取数字和单位
    // 正则应有两个捕获组：第1个是数字，第2个是单位（可选）
    function pickNumberWithUnit(text, patterns) {
        for (var i = 0; i < patterns.length; i++) {
            var m = text.match(patterns[i]);
            if (m && m[1] !== undefined && m[1] !== '') {
                var n = parseFloat(m[1]);
                if (!isNaN(n)) {
                    return { value: n, unit: m[2] || null };
                }
            }
        }
        return null;
    }

    // 将长度值统一转为 mm
    // unit 识别：mm/毫米 → 直接用；m/米 → ×1000；cm/厘米 → ×10；null/未知 → 按数值判断（>=10当mm，<10当m）
    function convertLengthToMm(val, unit, fieldName) {
        if (unit) {
            var u = unit.toLowerCase().trim();
            if (u === 'mm' || u === '毫米') return val;
            if (u === 'cm' || u === '厘米') return val * 10;
            if (u === 'm' || u === '米') return Math.round(val * 1000 * 100) / 100;
        }
        // 无单位：按数值大小猜
        if (val >= 10) return val; // 像 mm
        return Math.round(val * 1000 * 100) / 100; // 像 m
    }

    // ============ 矩形梁正截面（beam-rect）参数解析 ============
    var BEAM_RECT_PATTERNS = {
        b: [
            /梁宽\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /截面宽\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])(\d+(?:\.\d+)?)\s*(?:宽|mm宽|毫米宽)/i,
            /b\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(\d+(?:\.\d+)?)\s*[×x*X]\s*\d+(?:\.\d+)?/  // 第一个数是宽
        ],
        h: [
            /梁高\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /截面高\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])(\d+(?:\.\d+)?)\s*(?:高|mm高|毫米高)/i,
            /h\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /\d+(?:\.\d+)?\s*[×x*X]\s*(\d+(?:\.\d+)?)/  // 第二个数是高
        ],
        concrete: [
            /(C\d{2,3})/i
        ],
        steel: [
            /(HRB\s*\d{3})/i
        ],
        As: [
            // 区分大小写：As 必须是大写A小写s，后面紧跟 = 或数字或空格
            /(?:^|[\s,，；;])(As)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;])(As)\s+(\d+(?:\.\d+)?)\s*(?:mm²|mm2|平方|面积)?/,
            /(受拉钢筋面积|受拉筋面积|配筋面积|钢筋面积|受拉配筋)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i
        ],
        AsP: [
            // 区分大小写：As' / AsP
            /(?:^|[\s,，；;])(As')\s*[=＝]?\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;])(AsP)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(受压钢筋面积|受压筋面积|受压配筋|受压钢筋)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /双筋.*?(\d+(?:\.\d+)?)/i
        ],
        a_s: [
            // 区分大小写：as / a_s 必须是小写（前面不能有大写A构成As）
            /(?:^|[\s,，；;A-Z])(a_s)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;A-Z])(as)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(保护层|保护层厚度|受拉保护层|受拉钢筋合力点)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i
        ],
        a_s2: [
            // 区分大小写：as' / a_s2 / as2
            /(?:^|[\s,，；;A-Z])(a_s')\s*[=＝]?\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;A-Z])(a_s2)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;A-Z])(as')\s*[=＝]?\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;A-Z])(as2)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(受压保护层|受压钢筋合力点)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i
        ]
    };

    /**
     * 解析 beam-rect 参数
     * @param {string} text 用户输入
     * @returns {Object} { success, parameters:{}, extracted:[], warnings:[] }
     */
    function parseBeamRect(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        var b = pickNumber(text, BEAM_RECT_PATTERNS.b);
        if (b !== null) { params.b = b; extracted.push('b'); }

        var h = pickNumber(text, BEAM_RECT_PATTERNS.h);
        if (h !== null) { params.h = h; extracted.push('h'); }

        var con = pickString(text, BEAM_RECT_PATTERNS.concrete);
        if (con) {
            // 统一大写，去掉可能的空格
            con = con.toUpperCase().replace(/\s+/g, '');
            params.concrete = con;
            extracted.push('concrete');
        }

        var steel = pickString(text, BEAM_RECT_PATTERNS.steel);
        if (steel) {
            steel = steel.toUpperCase().replace(/\s+/g, '');
            params.steel = steel;
            extracted.push('steel');
        }

        var As = pickNumber(text, BEAM_RECT_PATTERNS.As);
        if (As !== null) { params.As = As; extracted.push('As'); }

        var AsP = pickNumber(text, BEAM_RECT_PATTERNS.AsP);
        if (AsP !== null) { params.AsP = AsP; extracted.push('AsP'); }

        var a_s = pickNumber(text, BEAM_RECT_PATTERNS.a_s);
        if (a_s !== null) { params.a_s = a_s; extracted.push('a_s'); }

        var a_s2 = pickNumber(text, BEAM_RECT_PATTERNS.a_s2);
        if (a_s2 !== null) { params.a_s2 = a_s2; extracted.push('a_s2'); }

        // 校验一些基本合理性
        if (params.b && params.b > 5000) warnings.push('b=' + params.b + ' 数值过大，请确认单位是否为mm');
        if (params.h && params.h > 10000) warnings.push('h=' + params.h + ' 数值过大，请确认单位是否为mm');

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser'
        };
    }

    // ============ 梁斜截面受剪（beam-shear）参数解析 ============
    var BEAM_SHEAR_PATTERNS = {
        b: [
            /梁宽\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /截面宽\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])(\d+(?:\.\d+)?)\s*(?:宽|mm宽|毫米宽)/i,
            /(?:^|[\s,，；;])b\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(\d+(?:\.\d+)?)\s*[×x*X]\s*\d+(?:\.\d+)?/
        ],
        h: [
            /梁高\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /截面高\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])(\d+(?:\.\d+)?)\s*(?:高|mm高|毫米高)/i,
            /(?:^|[\s,，；;])h\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /\d+(?:\.\d+)?\s*[×x*X]\s*(\d+(?:\.\d+)?)/
        ],
        concrete: [
            /(C\d{2,3})/i
        ],
        stirrup_steel: [
            /箍筋[级别种牌号]*\s*(HPB\s*300|HRB\s*400|HRB\s*500)/i,
            /(HPB\s*300|HRB\s*400|HRB\s*500)\s*箍筋/i
        ],
        Asv: [
            // 区分大小写：Asv 必须是大写A小写s小写v，紧跟=或数字
            /(?:^|[\s,，；;])(Asv)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;])(Asv)\s+(\d+(?:\.\d+)?)\s*(?:mm²|mm2|平方|面积)?/,
            /(箍筋面积|箍筋总面积|配箍面积)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i
        ],
        s_v: [
            // 箍筋间距 s / s_v：必须有"间距"上下文或s_v/ss明确写法
            /(?:箍筋间距|配箍间距|箍距|s_v|ss)\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /间距\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)/i,
            /@\s*(\d+(?:\.\d+)?)/  // φ8@150 形式
        ],
        V: [
            /剪力\s*[设计值]*\s*[=＝]?\s*(\d+(?:\.\d+)?)\s*(?:kN)?/i,
            /(?:^|[\s,，；;])V\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])(\d+(?:\.\d+)?)\s*kN\s*剪力/i
        ],
        a_s: [
            /(?:^|[\s,，；;A-Z])(a_s)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /保护层\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /纵向筋保护层\s*[=＝]?\s*(\d+(?:\.\d+)?)/i
        ],
        lambda: [
            /剪跨比\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /[λlambda]+\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        load_type_conc: [
            /集中荷载/i,
            /独立梁/i
        ]
    };

    function parseBeamShear(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        var b = pickNumber(text, BEAM_SHEAR_PATTERNS.b);
        if (b !== null) { params.b = b; extracted.push('b'); }

        var h = pickNumber(text, BEAM_SHEAR_PATTERNS.h);
        if (h !== null) { params.h = h; extracted.push('h'); }

        var con = pickString(text, BEAM_SHEAR_PATTERNS.concrete);
        if (con) {
            con = con.toUpperCase().replace(/\s+/g, '');
            params.concrete = con;
            extracted.push('concrete');
        }

        var stir = pickString(text, BEAM_SHEAR_PATTERNS.stirrup_steel);
        if (stir) {
            stir = stir.toUpperCase().replace(/\s+/g, '');
            params.stirrup_steel = stir;
            extracted.push('stirrup_steel');
        }

        var Asv = pickNumber(text, BEAM_SHEAR_PATTERNS.Asv);
        if (Asv !== null) { params.Asv = Asv; extracted.push('Asv'); }

        var s_v = pickNumber(text, BEAM_SHEAR_PATTERNS.s_v);
        if (s_v !== null) { params.s_v = s_v; extracted.push('s_v'); }

        var V = pickNumber(text, BEAM_SHEAR_PATTERNS.V);
        if (V !== null) { params.V = V; extracted.push('V'); }

        var a_s = pickNumber(text, BEAM_SHEAR_PATTERNS.a_s);
        if (a_s !== null) { params.a_s = a_s; extracted.push('a_s'); }

        var lambda = pickNumber(text, BEAM_SHEAR_PATTERNS.lambda);
        if (lambda !== null) {
            params.lambda = lambda;
            extracted.push('lambda');
            params.load_type = 'concentrated';
            extracted.push('load_type');
        } else if (BEAM_SHEAR_PATTERNS.load_type_conc.some(function(p) { return p.test(text); })) {
            params.load_type = 'concentrated';
            extracted.push('load_type');
        }

        // φ8@150 形式：可同时推导单肢面积（如果没有显式Asv）
        var phiMatch = text.match(/[φΦ](\d+(?:\.\d+)?)\s*@\s*(\d+)/i);
        if (phiMatch && params.Asv === undefined) {
            var dPhi = parseFloat(phiMatch[1]);
            // 按双肢默认 — 提示用户，但不自动推断 Asv（因为肢数不确定）
            warnings.push('检测到 φ' + dPhi + '@' + phiMatch[2] + ' 形式，已填入间距；箍筋总面积Asv需明确给出（双肢φ' + dPhi + ' ≈ ' + Math.round(Math.PI * dPhi * dPhi / 4 * 2) + ' mm²）');
        }

        if (params.b && params.b > 5000) warnings.push('b=' + params.b + ' 数值过大，请确认单位是否为mm');
        if (params.h && params.h > 10000) warnings.push('h=' + params.h + ' 数值过大，请确认单位是否为mm');
        if (params.V && params.V > 100000) warnings.push('V=' + params.V + ' 数值过大，请确认单位是否为kN');

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser'
        };
    }

    // ============ T形梁正截面（beam-t）参数解析 ============
    var BEAM_T_PATTERNS = {
        b: [
            // 腹板宽必须带"腹板/肋"上下文，避免跟翼缘宽的数字串扰
            /腹板[宽度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /肋[宽度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /梁肋[宽度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /腹板厚度\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])b\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        h: [
            /梁高\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /总高\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /截面[高度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])h\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        bf: [
            // 翼缘宽必须带"翼缘"上下文，不会跟 b 撞
            /翼缘[计算宽度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /受压翼缘宽\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /翼缘板宽\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])bf\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])b_f\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        hf: [
            /翼缘[厚度高度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /受压翼缘厚\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /翼缘板厚\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])hf\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])h_f\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        concrete: [
            /(C\d{2,3})/i
        ],
        steel: [
            /(?:纵向|受拉|主筋|受拉主)?钢筋[级别种牌号]*\s*(HRB\s*400|HRB\s*500|HPB\s*300)/i,
            /(HRB\s*400|HRB\s*500)\s*(?:纵向|受拉|主筋)?钢筋/i,
            /，(HRB\s*[45]00)，/  // 兜底：在中文逗号之间的独立 HRB400/500（T形梁上下文里的钢筋级别）
        ],
        As: [
            // 精确匹配：大写A小写s + 数字，或 "受拉钢筋面积" 上下文
            /(?:^|[\s,，；;])(As)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;])(As)\s+(\d+(?:\.\d+)?)\s*(?:mm²|mm2|平方|面积)?/,
            /(受拉钢筋面积|受拉面积|配筋面积|钢筋面积)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i
        ],
        a_s: [
            /(?:^|[\s,，；;A-Z])(a_s)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /保护层\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /受拉保护层\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /纵向筋保护层\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /受拉钢筋合力点\s*[=＝]?\s*(\d+(?:\.\d+)?)/i
        ]
    };

    function parseBeamT(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        var b = pickNumber(text, BEAM_T_PATTERNS.b);
        if (b !== null) { params.b = b; extracted.push('b'); }

        var h = pickNumber(text, BEAM_T_PATTERNS.h);
        if (h !== null) { params.h = h; extracted.push('h'); }

        var bf = pickNumber(text, BEAM_T_PATTERNS.bf);
        if (bf !== null) { params.bf = bf; extracted.push('bf'); }

        var hf = pickNumber(text, BEAM_T_PATTERNS.hf);
        if (hf !== null) { params.hf = hf; extracted.push('hf'); }

        var con = pickString(text, BEAM_T_PATTERNS.concrete);
        if (con) {
            con = con.toUpperCase().replace(/\s+/g, '');
            params.concrete = con;
            extracted.push('concrete');
        }

        var steel = pickString(text, BEAM_T_PATTERNS.steel);
        if (steel) {
            steel = steel.toUpperCase().replace(/\s+/g, '');
            params.steel = steel;
            extracted.push('steel');
        }

        var As = pickNumber(text, BEAM_T_PATTERNS.As);
        if (As !== null) { params.As = As; extracted.push('As'); }

        var a_s = pickNumber(text, BEAM_T_PATTERNS.a_s);
        if (a_s !== null) { params.a_s = a_s; extracted.push('a_s'); }

        // 合理性校验
        if (params.b && params.bf && params.b >= params.bf) {
            warnings.push('腹板宽 b=' + params.b + ' ≥ 翼缘宽 bf=' + params.bf + '，数值可能有误，请确认');
        }
        if (params.h && params.hf && params.hf >= params.h) {
            warnings.push('翼缘厚 hf=' + params.hf + ' ≥ 梁高 h=' + params.h + '，数值可能有误，请确认');
        }
        if (params.b && params.b > 2000) warnings.push('b=' + params.b + ' 数值过大，请确认单位是否为mm');
        if (params.h && params.h > 10000) warnings.push('h=' + params.h + ' 数值过大，请确认单位是否为mm');

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser'
        };
    }

    // ============ 轴心受压柱（column-axial）参数解析 ============
    var COLUMN_AXIAL_PATTERNS = {
        b: [
            /截面短边\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /短边\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /柱宽\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])b\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        h: [
            /截面长边\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /长边\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /柱截面高\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])h\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        l0: [
            /计算长度\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /柱长\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])l0\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])l_0\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])lo\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        concrete: [
            /(C\d{2,3})/i
        ],
        steel: [
            /(?:纵向|纵筋|受压|全部纵筋)?钢筋[级别种牌号]*\s*(HRB\s*400|HRB\s*500)/i,
            /(HRB\s*400|HRB\s*500)\s*(?:纵向|纵筋|受压)?钢筋/i,
            /，(HRB\s*[45]00)，/  // 兜底：在中文逗号之间的独立 HRB400/500
        ],
        As: [
            // 精确匹配：全部纵筋/纵筋面积 + 数字，或 "As=xxx"
            /(?:全部纵筋|纵筋面积|纵向钢筋面积|受压钢筋面积)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；;])(As)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /(?:^|[\s,，；;])(As')\s*[=＝]\s*(\d+(?:\.\d+)?)/
        ],
        N: [
            /轴向压力\s*(?:设计值)?\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*kn/i,
            /轴力设计值\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*kn/i,
            /轴压力\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*kn/i,
            /轴力\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*kn/i,
            /(?:^|[\s,，；;])N\s*[=＝]\s*(\d+(?:\.\d+)?)\s*kn/i,
            /(?:轴心压力|轴压)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*kn/i
        ]
    };

    function parseColumnAxial(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        var b = pickNumber(text, COLUMN_AXIAL_PATTERNS.b);
        if (b !== null) { params.b = b; extracted.push('b'); }

        var h = pickNumber(text, COLUMN_AXIAL_PATTERNS.h);
        if (h !== null) { params.h = h; extracted.push('h'); }

        var l0 = pickNumber(text, COLUMN_AXIAL_PATTERNS.l0);
        if (l0 !== null) { params.l0 = l0; extracted.push('l0'); }

        var con = pickString(text, COLUMN_AXIAL_PATTERNS.concrete);
        if (con) {
            con = con.toUpperCase().replace(/\s+/g, '');
            params.concrete = con;
            extracted.push('concrete');
        }

        var steel = pickString(text, COLUMN_AXIAL_PATTERNS.steel);
        if (steel) {
            steel = steel.toUpperCase().replace(/\s+/g, '');
            params.steel = steel;
            extracted.push('steel');
        }

        var As = pickNumber(text, COLUMN_AXIAL_PATTERNS.As);
        if (As !== null) { params.As = As; extracted.push('As'); }

        var N = pickNumber(text, COLUMN_AXIAL_PATTERNS.N);
        if (N !== null) { params.N = N; extracted.push('N'); }

        // 合理性校验
        if (params.b && params.b > 3000) warnings.push('b=' + params.b + ' 数值过大，请确认单位是否为mm');
        if (params.h && params.h > 10000) warnings.push('h=' + params.h + ' 数值过大，请确认单位是否为mm');
        if (params.l0 && params.l0 < 100) warnings.push('l0=' + params.l0 + ' 数值过小，请确认单位是否为mm');

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser'
        };
    }

    // ============ 单块矩形板（slab-rect）参数解析 ============
    var SLAB_RECT_PATTERNS = {
        lx: [
            // 必须带"短跨/短边"语义，避免和 ly、通用"跨度"串扰
            /短[边跨][计算]*跨度\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*m/i,
            /短[边跨]\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*m/i,
            /(?:^|[\s,，；；])lx\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])l_x\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /短跨\s*(\d+(?:\.\d+)?)\s*米/i
        ],
        ly: [
            /长[边跨][计算]*跨度\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*m/i,
            /长[边跨]\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*m/i,
            /(?:^|[\s,，；；])ly\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])l_y\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /长跨\s*(\d+(?:\.\d+)?)\s*米/i
        ],
        h: [
            // 必须带"板厚"上下文，避免和梁高h串扰
            /板厚\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /板厚度\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /楼板厚\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])h\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?\s*板厚/i
        ],
        gk: [
            /恒载[标准]*值*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*(?:kn\/m²|千牛[\/每]平)?/i,
            /永久荷载[标准]*值*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /恒荷载\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])gk\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        qk: [
            /活载[标准]*值*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*(?:kn\/m²|千牛[\/每]平)?/i,
            /可变荷载[标准]*值*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /活荷载\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /楼面活载\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])qk\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        concrete: [
            /(C\d{2,3})/i
        ],
        steel: [
            /(?:受力筋|钢筋)[级别种牌号]*\s*(HRB\s*400|HRB\s*500)/i,
            /(HRB\s*400|HRB\s*500)\s*(?:受力筋|钢筋)/i,
            /C\d{2,3}[，,]\s*(HRB\s*[45]00)/i  // 兜底：混凝土等级后面紧跟的 HRBxxx（板输入常见 "C30，HRB400"）
        ],
        a_s: [
            /(?:^|[\s,，；；A-Z])(a_s)\s*[=＝]\s*(\d+(?:\.\d+)?)/,
            /保护层\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?\s*(?:板|受力筋)?/i,
            /受拉保护层\s*[=＝]?\s*(\d+(?:\.\d+)?)/i,
            /受拉钢筋合力点\s*[=＝]?\s*(\d+(?:\.\d+)?)/i
        ],
        gG: [
            /恒载分项系数\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /永久荷载分项系数\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])γG\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])gG\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        gQ: [
            /活载分项系数\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /可变荷载分项系数\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])γQ\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /(?:^|[\s,，；；])gQ\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        support: [
            /(ssss|ffff|sfsf|fsfs)/i,
            /(四边简支)/i,
            /(四边固定)/i,
            /(短跨固定)/i,
            /(短边固定)/i,
            /(长跨固定)/i,
            /(长边固定)/i
        ]
    };

    function parseSlabRect(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        var lx = pickNumber(text, SLAB_RECT_PATTERNS.lx);
        if (lx !== null) { params.lx = lx; extracted.push('lx'); }

        var ly = pickNumber(text, SLAB_RECT_PATTERNS.ly);
        if (ly !== null) { params.ly = ly; extracted.push('ly'); }

        var h = pickNumber(text, SLAB_RECT_PATTERNS.h);
        if (h !== null) { params.h = h; extracted.push('h'); }

        var gk = pickNumber(text, SLAB_RECT_PATTERNS.gk);
        if (gk !== null) { params.gk = gk; extracted.push('gk'); }

        var qk = pickNumber(text, SLAB_RECT_PATTERNS.qk);
        if (qk !== null) { params.qk = qk; extracted.push('qk'); }

        var con = pickString(text, SLAB_RECT_PATTERNS.concrete);
        if (con) {
            con = con.toUpperCase().replace(/\s+/g, '');
            params.concrete = con;
            extracted.push('concrete');
        }

        var steel = pickString(text, SLAB_RECT_PATTERNS.steel);
        if (steel) {
            steel = steel.toUpperCase().replace(/\s+/g, '');
            params.steel = steel;
            extracted.push('steel');
        }

        var a_s = pickNumber(text, SLAB_RECT_PATTERNS.a_s);
        if (a_s !== null) { params.a_s = a_s; extracted.push('a_s'); }

        var gG = pickNumber(text, SLAB_RECT_PATTERNS.gG);
        if (gG !== null) { params.gG = gG; extracted.push('gG'); }

        var gQ = pickNumber(text, SLAB_RECT_PATTERNS.gQ);
        if (gQ !== null) { params.gQ = gQ; extracted.push('gQ'); }

        // 支承条件：提取语义后转为标准4字符代码
        var supStr = pickString(text, SLAB_RECT_PATTERNS.support);
        if (supStr) {
            var s = supStr.toLowerCase().replace(/\s+/g, '');
            var supCode = null;
            if (/^[sf]{4}$/.test(s)) supCode = s;
            else if (s.indexOf('四边简支') >= 0) supCode = 'ssss';
            else if (s.indexOf('四边固定') >= 0) supCode = 'ffff';
            else if (s.indexOf('短跨固定') >= 0 || s.indexOf('短边固定') >= 0) supCode = 'sfsf';
            else if (s.indexOf('长跨固定') >= 0 || s.indexOf('长边固定') >= 0) supCode = 'fsfs';
            if (supCode) { params.support = supCode; extracted.push('support'); }
        }

        // 合理性校验
        if (params.h && params.h > 1000) warnings.push('h=' + params.h + ' 数值过大，请确认单位是否为mm');
        if (params.lx && params.lx > 100) warnings.push('lx=' + params.lx + ' 数值过大，请确认单位是否为m');
        if (params.ly && params.ly > 100) warnings.push('ly=' + params.ly + ' 数值过大，请确认单位是否为m');
        if (params.lx && params.ly && params.lx > params.ly) {
            warnings.push('lx=' + params.lx + ' > ly=' + params.ly + '，计算时会自动交换以保证短边为x');
        }

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser'
        };
    }

    /* ==========================================================
     *  工具 7：柱下独立基础（footing-col）参数解析
     * ========================================================== */
    var FOOTING_COL_PATTERNS = {
        // B：基底短边。在 footing 解析上下文中，B 即为基底短边
        B: [
            /(?:^|[\s,，；;])B\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基础短边\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基底短边\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /底板短边\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基础宽度\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基底宽\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基础底宽\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /(?:^|[\s,，；;])(\d+(?:\.\d+)?)\s*(?:m|米)?\s*[×x*X]\s*\d+(?:\.\d+)?\s*(?:m|米)?\s*(?:基础|基底|独立基础|柱下基础)/i
        ],
        // L：基底长边。在 footing 解析上下文中，L 即为基底长边
        L: [
            /(?:^|[\s,，；;])L\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基础长边\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基底长边\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /底板长边\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基础长度\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /基底长\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i,
            /\d+(?:\.\d+)?\s*(?:m|米)?\s*[×x*X]\s*(\d+(?:\.\d+)?)\s*(?:m|米)?\s*(?:基础|基底|独立基础|柱下基础)/i
        ],
        // h：基础高度/厚度。在 footing 解析上下文中，h 即为基础高度
        h: [
            /(?:^|[\s,，；;])h\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米|m|米)?/i,
            /基础高\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米|m|米)?/i,
            /基础厚度\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米|m|米)?/i,
            /底板厚\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米|m|米)?/i,
            /基础总高\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米|m|米)?/i
        ],
        // h0：基础有效高度（可选）
        h0: [
            /有效高度\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i,
            /基础有效高\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i,
            /h0\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        // bc + hc：柱截面尺寸。支持"柱500x500"写法
        bc: [
            /柱宽\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米)?/i,
            /柱截面宽\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米)?/i,
            /bc\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /柱\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×x*X]\s*\d+(?:\.\d+)?\s*(?:mm)?/i
        ],
        hc: [
            /柱高\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米)?/i,
            /柱截面高\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米)?/i,
            /hc\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /柱\s*\d+(?:\.\d+)?\s*(?:mm)?\s*[×x*X]\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i
        ],
        // N：轴力设计值（单位kN）
        N: [
            /(?:^|[\s,，；;])N\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(?:kn|千牛)?/i,
            /轴力\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn|千牛)?/i,
            /轴压力\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn|千牛)?/i,
            /竖向力\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn|千牛)?/i
        ],
        // Nk：轴力标准值（可选）
        Nk: [
            /轴力标准值\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn|千牛)?/i,
            /Nk\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(?:kn)?/i,
            /标准轴力\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn|千牛)?/i
        ],
        // M：弯矩设计值（可选，沿L方向）
        M: [
            /(?:^|[\s,，；;])M\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(?:kn[·.\-]?m|千牛[·.\-]?米)?/i,
            /弯矩\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn[·.\-]?m|千牛[·.\-]?米)?/i,
            /柱底弯矩\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn[·.\-]?m|千牛[·.\-]?米)?/i
        ],
        // Mk：弯矩标准值（可选）
        Mk: [
            /弯矩标准值\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kn[·.\-]?m)?/i,
            /Mk\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(?:kn[·.\-]?m)?/i
        ],
        // fa：修正后地基承载力
        fa: [
            /(?:^|[\s,，；;])fa\s*[=＝]\s*(\d+(?:\.\d+)?)\s*(?:kpa)?/i,
            /地基承载力\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kpa)?/i,
            /承载力特征值\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kpa)?/i,
            /持力层承载力\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:kpa)?/i
        ],
        // d：基础埋深（可选，单位m）
        d: [
            /埋深\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(m|米)?/i,
            /基础埋深\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(m|米)?/i,
            /d\s*[=＝]\s*(\d+(?:\.\d+)?)\s*m\s/i
        ],
        // gammaG：基础及覆土重度（可选）
        gammaG: [
            /覆土重度\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /土重度\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
            /γG\s*[=＝]\s*(\d+(?:\.\d+)?)/i,
            /gammaG\s*[=＝]\s*(\d+(?:\.\d+)?)/i
        ],
        // concrete：混凝土等级
        concrete: [
            /(C\d{2,3})\s*(?:混凝土|基础混凝土)?/i,
            /混凝土等级\s*[:：=]?\s*(C\d{2,3})/i,
            /砼等级\s*[:：=]?\s*(C\d{2,3})/i
        ],
        // steel：钢筋级别
        steel: [
            /(HRB\s*\d{3})/i,
            /钢筋等级\s*[:：=]?\s*(HRB\s*\d{3})/i,
            /底板钢筋\s*[:：=]?\s*(HRB\s*\d{3})/i
        ]
    };

    function parseFooting(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        // B：基底短边，智能单位转换（mm→m，m保持）
        var bVal = pickNumberWithUnit(text, FOOTING_COL_PATTERNS.B);
        if (bVal !== null) {
            params.B = convertLengthToMm(bVal.value, bVal.unit, '基础B');
            if (bVal.unit && bVal.unit.toLowerCase().indexOf('m') >= 0 && bVal.unit.toLowerCase().indexOf('mm') < 0) {
                // 用户明确给了 m（非mm），转成 mm 给 bridge（bridge 再 /1000 写 DOM m）
                params.B = Math.round(bVal.value * 1000 * 100) / 100;
            } else if (bVal.value >= 10) {
                // 数值 >= 10 像 mm，直接用
                params.B = bVal.value;
            } else {
                // 数值 < 10 像 m，转 mm
                params.B = Math.round(bVal.value * 1000 * 100) / 100;
                warnings.push('B=' + bVal.value + ' 按 m 单位处理（<10 视为米），已换算为 mm');
            }
            extracted.push('B');
        }

        // L：基底长边，同样智能单位
        var lVal = pickNumberWithUnit(text, FOOTING_COL_PATTERNS.L);
        if (lVal !== null) {
            if (lVal.unit && lVal.unit.toLowerCase().indexOf('m') >= 0 && lVal.unit.toLowerCase().indexOf('mm') < 0) {
                params.L = Math.round(lVal.value * 1000 * 100) / 100;
            } else if (lVal.value >= 10) {
                params.L = lVal.value;
            } else {
                params.L = Math.round(lVal.value * 1000 * 100) / 100;
                warnings.push('L=' + lVal.value + ' 按 m 单位处理（<10 视为米），已换算为 mm');
            }
            extracted.push('L');
        }

        // h：基础高度（mm）
        var hVal = pickNumberWithUnit(text, FOOTING_COL_PATTERNS.h);
        if (hVal !== null) {
            params.h = convertLengthToMm(hVal.value, hVal.unit, '基础h');
            extracted.push('h');
        }

        // h0：有效高度（可选）
        var h0Val = pickNumberWithUnit(text, FOOTING_COL_PATTERNS.h0);
        if (h0Val !== null) {
            params.h0 = convertLengthToMm(h0Val.value, h0Val.unit, 'h0');
            extracted.push('h0');
        }

        // bc / hc：柱截面尺寸（支持 "柱500x500"）
        var bcVal = pickNumberWithUnit(text, FOOTING_COL_PATTERNS.bc);
        if (bcVal !== null) {
            params.bc = convertLengthToMm(bcVal.value, bcVal.unit, '柱宽bc');
            extracted.push('bc');
        }
        var hcVal = pickNumberWithUnit(text, FOOTING_COL_PATTERNS.hc);
        if (hcVal !== null) {
            params.hc = convertLengthToMm(hcVal.value, hcVal.unit, '柱高hc');
            extracted.push('hc');
        }

        // N / Nk：轴力
        var NVal = pickNumber(text, FOOTING_COL_PATTERNS.N);
        if (NVal !== null) { params.N = NVal; extracted.push('N'); }
        var NkVal = pickNumber(text, FOOTING_COL_PATTERNS.Nk);
        if (NkVal !== null) { params.Nk = NkVal; extracted.push('Nk'); }

        // M / Mk：弯矩
        var MVal = pickNumber(text, FOOTING_COL_PATTERNS.M);
        if (MVal !== null) { params.M = MVal; extracted.push('M'); }
        var MkVal = pickNumber(text, FOOTING_COL_PATTERNS.Mk);
        if (MkVal !== null) { params.Mk = MkVal; extracted.push('Mk'); }

        // fa：地基承载力
        var faVal = pickNumber(text, FOOTING_COL_PATTERNS.fa);
        if (faVal !== null) { params.fa = faVal; extracted.push('fa'); }

        // d：埋深（单位 m，可选）
        var dVal = pickNumberWithUnit(text, FOOTING_COL_PATTERNS.d);
        if (dVal !== null) {
            if (dVal.unit && (dVal.unit === 'mm' || dVal.unit === '毫米')) {
                params.d = dVal.value / 1000;
                warnings.push('d=' + dVal.value + 'mm 按 mm 处理，已换算为 m');
            } else {
                params.d = dVal.value;
            }
            extracted.push('d');
        }

        // gammaG：土重度（可选）
        var ggVal = pickNumber(text, FOOTING_COL_PATTERNS.gammaG);
        if (ggVal !== null) { params.gammaG = ggVal; extracted.push('gammaG'); }

        // concrete / steel
        var con = pickString(text, FOOTING_COL_PATTERNS.concrete);
        if (con) {
            con = con.toUpperCase().replace(/\s+/g, '');
            params.concrete = con;
            extracted.push('concrete');
        }
        var steel = pickString(text, FOOTING_COL_PATTERNS.steel);
        if (steel) {
            steel = steel.toUpperCase().replace(/\s+/g, '');
            params.steel = steel;
            extracted.push('steel');
        }

        // 合理性校验
        if (params.B && params.L && params.B > params.L) {
            warnings.push('B > L，已自动调整为 B=短边、L=长边');
            var tmp = params.B;
            params.B = params.L;
            params.L = tmp;
        }
        if (params.h && params.h > 5000) warnings.push('h=' + params.h + ' 数值过大，请确认单位是否为mm');
        if (params.fa && params.fa > 2000) warnings.push('fa=' + params.fa + ' 数值过大，请确认单位是否为kPa');
        if (params.N && params.N > 100000) warnings.push('N=' + params.N + ' 数值过大，请确认单位是否为kN');

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser'
        };
    }

    /**
     * 通用：解析 "4.5/5.0/4.5" 或 "[4.5, 5.0, 4.5]" 形式的数组
     * 返回 number[]，解析失败返回 null
     */
    function parseArrayStr(str) {
        if (!str) return null;
        var s = str.trim();
        // 去掉首尾方括号
        if (s.charAt(0) === '[' && s.charAt(s.length - 1) === ']') {
            s = s.substring(1, s.length - 1).trim();
        }
        if (!s) return [];
        var parts = s.split(/[\/\s,，;；]+/).filter(function (p) { return p !== ''; });
        var arr = [];
        for (var i = 0; i < parts.length; i++) {
            var n = parseFloat(parts[i]);
            if (isNaN(n)) return null;
            arr.push(n);
        }
        return arr;
    }

    /* ============ 连续梁（beam-cont）参数解析 ============ */
    function parseBeamCont(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        // 跨数 n
        var nMatch = text.match(/(?:n|跨数|span[_ ]?count)\s*[=：:]\s*(\d+)/i);
        if (nMatch) {
            params.n = parseInt(nMatch[1]);
            extracted.push('n');
        }

        // 跨度数组：L=4.5/5.0/4.5  或  spans=...  或 跨度=...
        var LMatch = text.match(/(?:L|spans?|跨度|各跨跨度|跨长)\s*[=：:]\s*([\d\.\/\s,，;；\[\]]+)/i);
        if (LMatch) {
            var Larr = parseArrayStr(LMatch[1]);
            if (Larr && Larr.length > 0) {
                params.spans = Larr;
                extracted.push('spans');
            }
        }

        // 恒载数组 gk
        var gkMatch = text.match(/(?:gk|g_k|恒载|恒荷载|恒载标准值|dead[_ ]?load)\s*[=：:]\s*([\d\.\/\s,，;；\[\]]+)/i);
        if (gkMatch) {
            var gkArr = parseArrayStr(gkMatch[1]);
            if (gkArr !== null) {
                params.gk = gkArr;
                extracted.push('gk');
            }
        }

        // 活载数组 qk
        var qkMatch = text.match(/(?:qk|q_k|活载|活荷载|活载标准值|live[_ ]?load)\s*[=：:]\s*([\d\.\/\s,，;；\[\]]+)/i);
        if (qkMatch) {
            var qkArr = parseArrayStr(qkMatch[1]);
            if (qkArr !== null) {
                params.qk = qkArr;
                extracted.push('qk');
            }
        }

        // b 梁宽
        var bMatch = text.match(/(?:^|[\s,，；;])(?:b|梁宽|截面宽)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (!bMatch) bMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×x*X]\s*\d+/);
        if (bMatch) {
            params.b = parseFloat(bMatch[1]);
            extracted.push('b');
        }

        // h 梁高
        var hMatch = text.match(/(?:^|[\s,，；;])(?:h|梁高|截面高)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (!hMatch) hMatch = text.match(/\d+(?:\.\d+)?\s*(?:mm)?\s*[×x*X]\s*(\d+(?:\.\d+)?)/);
        if (hMatch) {
            params.h = parseFloat(hMatch[1]);
            extracted.push('h');
        }

        // a_s
        var asMatch = text.match(/(?:a[_ ]?s|as|保护层a?s|钢筋合力点距)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (asMatch) {
            params.a_s = parseFloat(asMatch[1]);
            extracted.push('a_s');
        }

        // 混凝土等级
        var conMatch = text.match(/(?:C|混凝土|混凝土等级|砼)[\s-]*(\d{2})/i);
        if (conMatch) {
            params.concrete = 'C' + conMatch[1];
            extracted.push('concrete');
        }

        // 纵向钢筋级别（第一个 HRB/HPB 出现的）
        var steelMatches = [];
        var steelRe = /(HRB\s*\d{3,4}|HPB\s*\d{3})/gi;
        var sm;
        while ((sm = steelRe.exec(text)) !== null) {
            steelMatches.push(sm[1].replace(/\s+/g, '').toUpperCase());
        }
        if (steelMatches.length >= 1) {
            params.steel = steelMatches[0];
            extracted.push('steel');
        }
        if (steelMatches.length >= 2) {
            params.stirrup_steel = steelMatches[1];
            extracted.push('stirrup_steel');
        } else if (steelMatches.length === 1) {
            // 只给了一个，默认纵筋箍筋相同
            params.stirrup_steel = steelMatches[0];
            extracted.push('stirrup_steel');
        }

        // γG / γQ
        var gGMatch = text.match(/(?:gamma[_ ]?G|γG|γ[_ ]?G|恒载分项系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gGMatch) {
            params.gammaG = parseFloat(gGMatch[1]);
            extracted.push('gammaG');
        }
        var gQMatch = text.match(/(?:gamma[_ ]?Q|γQ|γ[_ ]?Q|活载分项系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gQMatch) {
            params.gammaQ = parseFloat(gQMatch[1]);
            extracted.push('gammaQ');
        }

        // 推断 n：如果没明确给 n，但给了 spans 数组，按 spans 长度推断
        if (params.n === undefined && params.spans) {
            params.n = params.spans.length;
            extracted.push('n');
            warnings.push('n 未明确给出，按 spans 数组长度 ' + params.n + ' 推断为 ' + params.n + ' 跨');
        }

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser',
            tool_id: 'beam-cont'
        };
    }

    /* ============ 板式楼梯（stair-slab）参数解析 ============ */
    function parseStairSlab(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        // Ln 梯段水平投影跨度
        var LnVal = pickNumberWithUnit(text, [
            /(?:Ln|梯段跨度|梯段长|梯段水平投影|水平投影长度|楼梯跨度|梯段长度)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(m|米|mm|毫米)?/i
        ]);
        if (LnVal) {
            // m / mm 智能转换：值 < 10 当 m，>= 10 当 mm → 统一输出 m
            var lnNum = LnVal.value;
            var lnUnit = LnVal.unit ? LnVal.unit.toLowerCase() : null;
            if (lnUnit === 'mm' || lnUnit === '毫米') {
                params.Ln = Math.round(lnNum / 1000 * 1000) / 1000;
            } else if (lnUnit === 'm' || lnUnit === '米') {
                params.Ln = lnNum;
            } else if (lnNum >= 10) {
                params.Ln = Math.round(lnNum / 1000 * 1000) / 1000;
                warnings.push('Ln=' + lnNum + ' 按 mm 处理（>=10 视为毫米），已换算为 ' + params.Ln + ' m');
            } else {
                params.Ln = lnNum;
            }
            extracted.push('Ln');
        }

        // b 梯宽
        var bVal = pickNumberWithUnit(text, [
            /(?:梯宽|楼梯宽度|楼梯板宽度|梯段宽度)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i
        ]);
        if (bVal) {
            params.b = convertLengthToMm(bVal.value, bVal.unit, '梯宽');
            extracted.push('b');
        }

        // 踏步 280x160 形式
        var stepMatch = text.match(/(?:踏步)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/);
        if (stepMatch) {
            params.step_width = parseFloat(stepMatch[1]);
            params.step_height = parseFloat(stepMatch[2]);
            extracted.push('step_width');
            extracted.push('step_height');
        } else {
            // 踏步宽度单独提取
            var swVal = pickNumberWithUnit(text, [
                /(?:踏步宽|踏步宽度|踏面宽|tread|bs)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i
            ]);
            if (swVal) { params.step_width = swVal.value; extracted.push('step_width'); }
            // 踏步高度单独提取
            var shVal = pickNumberWithUnit(text, [
                /(?:踏步高|踏步高度|踢面高|riser|hs)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i
            ]);
            if (shVal) { params.step_height = shVal.value; extracted.push('step_height'); }
        }

        // 板厚 / 梯板厚
        var dVal = pickNumberWithUnit(text, [
            /(?:板厚|梯板厚|梯板厚度|斜板厚|delta|δ)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i
        ]);
        if (dVal) {
            params.slab_thickness = convertLengthToMm(dVal.value, dVal.unit, '梯板厚');
            extracted.push('slab_thickness');
        }

        // a_s
        var asMatch = text.match(/(?:a[_ ]?s|as|as_value|保护层a?s|钢筋合力点距)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (asMatch) { params.a_s = parseFloat(asMatch[1]); extracted.push('a_s'); }

        // 平台板跨度
        var pLVal = pickNumberWithUnit(text, [
            /(?:平台跨|平台板跨度|平台板宽|平台板水平跨度|平台板长度|Lp)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(m|米|mm|毫米)?/i
        ]);
        if (pLVal) {
            var plNum = pLVal.value;
            var plUnit = pLVal.unit ? pLVal.unit.toLowerCase() : null;
            if (plUnit === 'mm' || plUnit === '毫米') {
                params.platform_L = Math.round(plNum / 1000 * 1000) / 1000;
            } else if (plUnit === 'm' || plUnit === '米') {
                params.platform_L = plNum;
            } else if (plNum >= 10) {
                params.platform_L = Math.round(plNum / 1000 * 1000) / 1000;
            } else {
                params.platform_L = plNum;
            }
            extracted.push('platform_L');
        }

        // 平台板厚度
        var pHVal = pickNumberWithUnit(text, [
            /(?:平台厚|平台板厚|平台板厚度|hp)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i
        ]);
        if (pHVal) {
            params.platform_h = convertLengthToMm(pHVal.value, pHVal.unit, '平台板厚');
            extracted.push('platform_h');
        }

        // gk_floor / gk_step / gk_slab
        var gk1Match = text.match(/(?:gk[_ ]?floor|g[_ ]?k1|gk1|面层自重|楼面面层|面层荷载)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gk1Match) { params.gk_floor = parseFloat(gk1Match[1]); extracted.push('gk_floor'); }
        var gk2Match = text.match(/(?:gk[_ ]?step|g[_ ]?k2|gk2|踏步自重|踏步及抹灰|踏步荷载)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gk2Match) { params.gk_step = parseFloat(gk2Match[1]); extracted.push('gk_step'); }
        var gk3Match = text.match(/(?:gk[_ ]?slab|g[_ ]?k3|gk3|梯板自重|斜板自重|板自重)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gk3Match) { params.gk_slab = parseFloat(gk3Match[1]); extracted.push('gk_slab'); }

        // qk
        var qkMatch = text.match(/(?:qk|q[_ ]?k|活载|活荷载|活载标准值|楼梯活载)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (qkMatch) { params.qk = parseFloat(qkMatch[1]); extracted.push('qk'); }

        // gammaG / gammaQ
        var gGMatch = text.match(/(?:gamma[_ ]?G|γG|γ[_ ]?G|恒载分项系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gGMatch) { params.gammaG = parseFloat(gGMatch[1]); extracted.push('gammaG'); }
        var gQMatch = text.match(/(?:gamma[_ ]?Q|γQ|γ[_ ]?Q|活载分项系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gQMatch) { params.gammaQ = parseFloat(gQMatch[1]); extracted.push('gammaQ'); }

        // 混凝土
        var conMatch = text.match(/(?:C|混凝土|混凝土等级|砼)[\s-]*(\d{2})/i);
        if (conMatch) { params.concrete = 'C' + conMatch[1]; extracted.push('concrete'); }

        // 钢筋级别
        var steelMatch = text.match(/(HRB\s*\d{3,4}|HPB\s*\d{3})/i);
        if (steelMatch) {
            params.steel = steelMatch[1].replace(/\s+/g, '').toUpperCase();
            extracted.push('steel');
        }

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser',
            tool_id: 'stair-slab'
        };
    }

    /* ============ L22ZG401 预应力钢管桁架叠合板 参数解析 ============ */
    function parseL22zg401(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        // 标志跨度 span：优先 标志跨度=xxx/跨度=xxx/板跨=xxx/L=xxx
        // 注意：单独 "L" 字母必须后接数字且后不接字母（避免匹配 L22ZG/L22G 等图集号）
        var spanMatch = text.match(/(?:标志跨度|跨度|板跨)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?/i);
        if (spanMatch) {
            var sv = parseFloat(spanMatch[1]);
            var su = spanMatch[2] ? spanMatch[2].toLowerCase() : null;
            if (su === 'm' || su === '米') {
                params.span = Math.round(sv * 1000);
            } else if (su === 'mm' || su === '毫米') {
                params.span = Math.round(sv);
            } else if (sv >= 100) {
                params.span = Math.round(sv);
            } else {
                params.span = Math.round(sv * 1000);
                warnings.push('跨度 ' + sv + ' 按 m 处理，已换算为 ' + params.span + ' mm');
            }
            extracted.push('span');
        } else {
            // L=xxx / L xxx 形式，确保 L 后面是等号或空白+数字，且数字后不接字母（避免 L22ZG 误匹配）
            var lMatch = text.match(/(?:^|[\s，。；])(?:L|l)\s*[=：:]\s*(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)?(?=$|[\s，。；])/);
            if (lMatch) {
                var lv = parseFloat(lMatch[1]);
                var lu = lMatch[2] ? lMatch[2].toLowerCase() : null;
                if (lu === 'm' || lu === '米') {
                    params.span = Math.round(lv * 1000);
                } else if (lu === 'mm' || lu === '毫米') {
                    params.span = Math.round(lv);
                } else if (lv >= 100) {
                    params.span = Math.round(lv);
                } else {
                    params.span = Math.round(lv * 1000);
                }
                extracted.push('span');
            }
        }

        // 底板宽度 width：板宽=xxx；宽度=xxx；GDB编号第4~5位(dm)×10
        var widthMatch = text.match(/(?:板宽|底板宽度|宽度|W)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i);
        if (widthMatch) {
            var wv = parseFloat(widthMatch[1]);
            var wu = widthMatch[2] ? widthMatch[2].toLowerCase() : null;
            if (wu === 'mm' || wu === '毫米') {
                params.width = Math.round(wv);
            } else if (wv >= 100) {
                params.width = Math.round(wv);
            } else {
                params.width = Math.round(wv * 1000);
            }
            extracted.push('width');
        }

        // GDB 编号解析：GDB + 跨度(dm 两位) + 宽度(dm 两位) + - + 荷载等级
        // 例：GDB2110-6 = 标志跨度2100mm(21dm)、宽度1000mm(10dm)、q=6kN/m²
        var gdbMatch = text.match(/GDB\s*(\d{2})(\d{2})-([6789]|10)\b/i);
        if (gdbMatch) {
            if (params.span === undefined) {
                params.span = parseInt(gdbMatch[1]) * 100; // dm→mm（21dm → 2100mm）
                extracted.push('span');
            }
            if (params.width === undefined) {
                params.width = parseInt(gdbMatch[2]) * 100; // dm→mm（10dm → 1000mm）
                extracted.push('width');
            }
            if (params.q_level === undefined) {
                params.q_level = parseInt(gdbMatch[3]);
                extracted.push('q_level');
            }
        }

        // 允许附加荷载等级 q_level：q=6/q6/q_level=6/允许荷载=6/荷载等级=6
        var qlMatch = text.match(/(?:q[ _-]?level|荷载等级|允许附加荷载|允许荷载|q级|q等级|q\s*=)\s*[=：:]?\s*([6789]|10)\b/i);
        if (qlMatch) {
            params.q_level = parseInt(qlMatch[1]);
            extracted.push('q_level');
        } else {
            // 裸 "q6" "q7" 等，避免和其他 q 参数混淆
            var qBare = text.match(/(?:^|[\s，。；])(q\s*[6789]|q\s*10)(?:$|[\s，。；])/i);
            if (qBare) {
                var num = qBare[1].replace(/q\s*/i, '');
                params.q_level = parseInt(num);
                extracted.push('q_level');
            }
        }

        // 荷载等级计算相关：gk / qk / gamma0 / gammaG / gammaQ
        var gkVal = pickNumberWithUnit(text, [
            /(?:附加恒载|附加永久荷载|恒载|面层荷载|gk|g_k|g2k)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(kN\/m²|千牛)?/i
        ]);
        if (gkVal) { params.gk = gkVal.value; extracted.push('gk'); }

        var qkVal = pickNumberWithUnit(text, [
            /(?:活载|可变荷载|使用荷载|qk|q_k|q2k)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(kN\/m²|千牛)?/i
        ]);
        if (qkVal) { params.qk = qkVal.value; extracted.push('qk'); }

        var g0Match = text.match(/(?:gamma0|γ0|gamma_0|重要性系数|安全等级)\s*[=：:]?\s*(\d+(?:\.\d+)?)/i);
        if (g0Match) { params.gamma0 = parseFloat(g0Match[1]); extracted.push('gamma0'); }
        if (/一级/.test(text) && params.gamma0 === undefined) {
            params.gamma0 = 1.1; extracted.push('gamma0');
        } else if (/二级/.test(text) && params.gamma0 === undefined) {
            params.gamma0 = 1.0; extracted.push('gamma0');
        }

        var gGMatch = text.match(/(?:gammaG|γG|gamma_G|恒载分项系数|永久荷载分项系数)\s*[=：:]?\s*(\d+(?:\.\d+)?)/i);
        if (gGMatch) { params.gammaG = parseFloat(gGMatch[1]); extracted.push('gammaG'); }

        var gQMatch = text.match(/(?:gammaQ|γQ|gamma_Q|活载分项系数|可变荷载分项系数)\s*[=：:]?\s*(\d+(?:\.\d+)?)/i);
        if (gQMatch) { params.gammaQ = parseFloat(gQMatch[1]); extracted.push('gammaQ'); }

        // 验算模块推断
        if ((params.gk !== undefined || params.qk !== undefined) && params.span === undefined) {
            params.stage_mode = 'load';
            if (extracted.indexOf('stage_mode') < 0) extracted.push('stage_mode');
        }

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser',
            tool_id: 'l22zg401'
        };
    }

    /* ============ AAC 外墙板（aac-wall）参数解析 ============ */
    function parseAacWall(text) {
        var params = {};
        var extracted = [];
        var warnings = [];

        // std 标准（已移到 grade 前匹配，见上方）

        // L 板跨度
        var LVal = pickNumberWithUnit(text, [
            /(?:板跨|板跨度|计算跨度|墙板跨度|L=|L )\s*(\d+(?:\.\d+)?)\s*(m|米|mm|毫米)?/i
        ]);
        if (LVal) {
            var lnNum = LVal.value;
            var lnUnit = LVal.unit ? LVal.unit.toLowerCase() : null;
            if (lnUnit === 'mm' || lnUnit === '毫米') {
                params.L = Math.round(lnNum / 1000 * 1000) / 1000;
            } else if (lnUnit === 'm' || lnUnit === '米') {
                params.L = lnNum;
            } else if (lnNum >= 10) {
                params.L = Math.round(lnNum / 1000 * 1000) / 1000;
                warnings.push('L=' + lnNum + ' 按 mm 处理，已换算为 ' + params.L + ' m');
            } else {
                params.L = lnNum;
            }
            extracted.push('L');
        }

        // b 板宽
        var bMatch = text.match(/(?:板宽|宽度|墙板宽度)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i);
        if (bMatch) {
            params.b = parseFloat(bMatch[1]);
            extracted.push('b');
        }

        // h 板厚
        var hMatch = text.match(/(?:板厚|厚度|墙板厚度|墙厚)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i);
        if (hMatch) {
            params.h = parseFloat(hMatch[1]);
            extracted.push('h');
        }

        // gamma0/gammaG/gammaW/psiW（先匹配，避免 gamma0 里的 a0 被 grade 正则截走）
        var g0Match = text.match(/(?:gamma0|γ0|gamma_0|重要性系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (g0Match) { params.gamma0 = parseFloat(g0Match[1]); extracted.push('gamma0'); }
        var gGMatch = text.match(/(?:gammaG|γG|gamma_G|恒载分项系数|永久荷载分项系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gGMatch) { params.gammaG = parseFloat(gGMatch[1]); extracted.push('gammaG'); }
        var gWMatch = text.match(/(?:gammaW|γW|gamma_W|风载分项系数|风荷载分项系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (gWMatch) { params.gammaW = parseFloat(gWMatch[1]); extracted.push('gammaW'); }
        var pWMatch = text.match(/(?:psiW|ψW|psi_w|风载组合值系数|风荷载组合值系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (pWMatch) { params.psiW = parseFloat(pWMatch[1]); extracted.push('psiW'); }

        // std 标准（在 grade 之前，避免 std=jgj 里的字母误识别）
        if (/JGJ|jgj|17-2020/.test(text)) { params.std = 'jgj'; extracted.push('std'); }
        else if (/CECS|cecs|553|553-2018/.test(text)) { params.std = 'cecs'; extracted.push('std'); }
        var stdMatch = text.match(/(?:std|标准|依据|规范|计算标准|计算依据)\s*[=：:]\s*(jgj|cecs)/i);
        if (stdMatch) { params.std = stdMatch[1].toLowerCase(); if (extracted.indexOf('std') < 0) extracted.push('std'); }

        // grade AAC 强度等级：严格匹配已知等级 A2.5/A3.5/A5.0/A7.5
        // 必须是独立 token：前面是空白/起止/等号/中文标点，后面是空白/结束/中文标点/单位
        // 绝对禁止从 gamma0/gamma0j/As 等词中间截取
        var gradeRe = /(?:^|[\s=：:，。；、（(\[])A\s*(2\.5|3\.5|5\.0|7\.5)(?=$|[\s，。；、）)\]mm]|\s*级|\s*（)/i;
        var gradeMatch = text.match(gradeRe);
        if (gradeMatch) {
            params.grade = 'A' + gradeMatch[1];
            extracted.push('grade');
        } else {
            // 兜底：A5 / A3 / A7 整数形式（但必须独立 token，后面是空白或结束或中文）
            var gradeIntRe = /(?:^|[\s=：:，。；、（(\[])A\s*([2357])(?=$|[\s，。；、）)\]级]|\s*级)/i;
            var giMatch = text.match(gradeIntRe);
            if (giMatch) {
                // 整数补 .0（A5 → A5.0），已知合法等级
                var gi = giMatch[1];
                params.grade = 'A' + gi + '.0';
                extracted.push('grade');
            }
        }

        // steel 钢筋级别
        var steelMatch = text.match(/(HRB\s*\d{3,4}|HPB\s*\d{3}|CRB\s*\d{3}[A-Za-z]?)/i);
        if (steelMatch) {
            params.steel = steelMatch[1].replace(/\s+/g, '').toUpperCase();
            extracted.push('steel');
        }

        // bar_diameter 钢筋直径 d=xx
        var dMatch = text.match(/(?:d|直径|钢筋直径)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(mm|毫米)?/i);
        if (dMatch && !/\d+x\d+/.test(text.substring(dMatch.index, dMatch.index + 10))) {
            params.bar_diameter = parseFloat(dMatch[1]);
            extracted.push('bar_diameter');
        }

        // bar_count 钢筋根数 n=xx / xx根
        var nMatch = text.match(/(?:n=|n |根数|钢筋根数)\s*(\d+)\s*根?/i);
        if (nMatch) {
            params.bar_count = parseInt(nMatch[1]);
            extracted.push('bar_count');
        }

        // a_s
        var asMatch = text.match(/(?:a[_ ]?s|as|as_value)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (asMatch) { params.a_s = parseFloat(asMatch[1]); extracted.push('a_s'); }

        // w0 基本风压
        var w0Match = text.match(/(?:w0|基本风压|风压)\s*[=：:]?\s*(\d+(?:\.\d+)?)\s*(kN\/m²|千牛|)?/i);
        if (w0Match) { params.w0 = parseFloat(w0Match[1]); extracted.push('w0'); }

        // terrain 地面粗糙度：匹配 A类/B类/C类/D类 或 terrain=B 等
        var terrainMatch = text.match(/(?:地面粗糙度|粗糙度|地貌类别|地面类别|terrain)\s*[=：:]?\s*([A-Da-d])(?:\s*类)?/i);
        if (terrainMatch) {
            params.terrain = terrainMatch[1].toUpperCase();
            extracted.push('terrain');
        } else {
            // 裸 "B类" 等在风荷载语境下识别（有 w0 或 风载 或 粗糙度 字样 或 风压）
            if (/w0|风压|风荷载|基本风压/.test(text)) {
                var bareMatch = text.match(/(?:^|[\s，。])([A-Da-d])\s*类(?=[\s，。]|$)/);
                if (bareMatch) {
                    params.terrain = bareMatch[1].toUpperCase();
                    extracted.push('terrain');
                }
            }
        }

        // z 计算高度
        var zMatch = text.match(/(?:z=|计算高度|高度|楼层高度|距地面高度)\s*(\d+(?:\.\d+)?)\s*(m|米)/i);
        if (zMatch) { params.z = parseFloat(zMatch[1]); extracted.push('z'); }

        // mu_s 体型系数
        var musMatch = text.match(/(?:mu_s|mus|μs|体型系数)\s*[=：:]?\s*(\d+(?:\.\d+)?)/i);
        if (musMatch) { params.mu_s = parseFloat(musMatch[1]); extracted.push('mu_s'); }

        // gamma0/gammaG/gammaW/psiW（已移到 grade 前匹配，见上方）

        // seis 是否验算地震：支持中文语义 + 符号写法
        var seisMatch = text.match(/(?:seis|地震|抗震|是否验算地震|是否考虑地震)\s*[=：:]?\s*(y|n|yes|no|是|否|验算|不验算|考虑|不考虑)/i);
        if (seisMatch) {
            var sv = seisMatch[1].toLowerCase();
            if (sv === 'y' || sv === 'yes' || sv === '是' || sv === '验算' || sv === '考虑') {
                params.seis = 'y';
            } else {
                params.seis = 'n';
            }
            extracted.push('seis');
        } else if (/验算地震|考虑地震|地震作用|抗震验算/.test(text)) {
            params.seis = 'y'; extracted.push('seis');
        } else if (/不验算地震|不考虑地震|无地震/.test(text)) {
            params.seis = 'n'; extracted.push('seis');
        }

        // 烈度语义换算（6/7/8度 → alpha_max）
        var intenMatch = text.match(/(\d)度(?:设防)?/);
        if (intenMatch && params.seis === 'y') {
            var deg = parseInt(intenMatch[1]);
            var amap = { 6: 0.04, 7: 0.08, 8: 0.16 };
            if (amap[deg] !== undefined) {
                params.alpha_max = amap[deg];
                extracted.push('alpha_max');
                warnings.push('烈度' + deg + '度 自动换算为 α_max = ' + amap[deg]);
            }
        }

        // alpha_max 直接值
        var amMatch = text.match(/(?:alpha_max|amax|αmax|地震影响系数)\s*[=：:]?\s*(\d+(?:\.\d+)?)/i);
        if (amMatch) { params.alpha_max = parseFloat(amMatch[1]); extracted.push('alpha_max'); }

        // eta 功能系数
        var etaMatch = text.match(/(?:^|\s)(?:eta|η|功能系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (etaMatch) { params.eta = parseFloat(etaMatch[1]); extracted.push('eta'); }

        // xi 位置系数
        var xiMatch = text.match(/(?:^|\s)(?:xi|ξ|位置系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (xiMatch) { params.xi = parseFloat(xiMatch[1]); extracted.push('xi'); }

        // nj 连接件数量
        var njMatch = text.match(/(?:nj|连接件|连接件数量|节点数)\s*[=：:]?\s*(\d+)/);
        if (njMatch) { params.nj = parseInt(njMatch[1]); extracted.push('nj'); }

        // gamma0j 连接件重要性系数
        var g0jMatch = text.match(/(?:gamma0j|γ0j|连接件重要性系数|节点重要性系数)\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
        if (g0jMatch) { params.gamma0j = parseFloat(g0jMatch[1]); extracted.push('gamma0j'); }

        return {
            success: extracted.length > 0,
            parameters: params,
            extracted: extracted,
            warnings: warnings,
            source: 'local_parser',
            tool_id: 'aac-wall'
        };
    }

    /**
     * 根据 tool_id 分派到对应解析器
     */
    function parseForTool(text, tool_id) {
        console.log('[AI_PARAM] 本地解析器启动, tool=' + tool_id + ', input=' + text);
        var result = null;

        switch (tool_id) {
            case 'beam-rect':
                result = parseBeamRect(text);
                break;
            case 'beam-shear':
                result = parseBeamShear(text);
                break;
            case 'beam-t':
                result = parseBeamT(text);
                break;
            case 'column-axial':
                result = parseColumnAxial(text);
                break;
            case 'slab-rect':
                result = parseSlabRect(text);
                break;
            case 'footing-col':
                result = parseFooting(text);
                break;
            case 'beam-cont':
                result = parseBeamCont(text);
                break;
            case 'stair-slab':
                result = parseStairSlab(text);
                break;
            case 'aac-wall':
                result = parseAacWall(text);
                break;
            case 'l22zg401':
                result = parseL22zg401(text);
                break;
            default:
                result = {
                    success: false,
                    parameters: {},
                    extracted: [],
                    warnings: ['本地解析器暂不支持工具: ' + tool_id],
                    source: 'local_parser'
                };
        }

        console.log('[AI_PARAM] 本地解析结果:', JSON.stringify(result));
        return result;
    }

    /**
     * 检查输入是否为 debug 模式（以 #debug 开头）
     * 如果是，去掉前缀并返回纯文本
     */
    function checkDebugMode(text) {
        if (!text) return { isDebug: false, cleanText: text };
        var trimmed = text.trim();
        if (trimmed.indexOf('#debug') === 0) {
            var clean = trimmed.replace(/^#debug\s*/, '').trim();
            return { isDebug: true, cleanText: clean };
        }
        return { isDebug: false, cleanText: text };
    }

    // 导出到全局
    window.AI_LOCAL_PARSER = {
        parseForTool: parseForTool,
        parseBeamRect: parseBeamRect,
        parseBeamShear: parseBeamShear,
        parseBeamT: parseBeamT,
        parseColumnAxial: parseColumnAxial,
        parseSlabRect: parseSlabRect,
        parseFooting: parseFooting,
        parseBeamCont: parseBeamCont,
        parseStairSlab: parseStairSlab,
        parseAacWall: parseAacWall,
        parseL22zg401: parseL22zg401,
        parseArrayStr: parseArrayStr,
        checkDebugMode: checkDebugMode
    };

    console.log('[AI Local Parser] 模块已加载。输入以 "#debug " 开头可触发本地解析模式。');
})();
