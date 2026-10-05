/* ==========================================================
 *  AI 工具注册表 —— AI_TOOL_REGISTRY
 *  为 AI 可调用的计算工具提供统一入口：参数声明、桥接函数、结果映射
 *  严格不修改原有计算逻辑，仅做"参数适配 → 调用原 calc → 结果提取"
 *
 *  ====== 统一适配器规范 TOOL_ADAPTER_SPEC ======
 *
 *  每个 AI 可调用工具必须实现以下结构，新增工具照此模板即可：
 *
 *  {
 *    // ---- 基本信息 ----
 *    tool_id:             string   唯一标识，与 TOOLS[...] key 一致
 *    tool_name:           string   显示名称
 *    category:            string   分类（受弯构件 / 装配式 / 地基基础 ...）
 *    description:         string   一句话用途
 *    applicable_scenarios:string   适用场景描述（AI 用它判断何时调用）
 *    limitations:         string[] 不支持什么（重要，防止 AI 误导）
 *    keywords:            string[] 关键词（fallback 关键词匹配用）
 *    adapter_ready:       boolean  是否已接通 AI（false 时 UI 显"接入中"）
 *
 *    // ---- 参数声明 ----
 *    required_parameters: [{ name, label, type, unit, required, default, description, options?, option_labels? }]
 *    optional_parameters: [...]
 *
 *    // ---- 参数映射（AI 参数名 → 真实 DOM id） ----
 *    parameter_mapping: {
 *      aiParamName: {
 *        domId: 'r_b',          // 真实输入框 DOM id
 *        unit:  'mm',           // DOM 输入口径的单位
 *        transform: function(v) // 可选：单位换算或格式化函数
 *      }
 *    }
 *
 *    // ---- 桥接函数 ----
 *    // 标准流程：填值 → 点按钮 → 等结果 → 读 window._XXX_RESULT → 映射
 *    bridge: function (params, callback) {
 *      // 1. 按 parameter_mapping 把 params 写入真实 DOM（含单位换算）
 *      // 2. 触发原计算按钮真实 click（与用户手动点同一路径）
 *      // 3. 等原 calc() 执行完成（计算本身是同步的，DOM 更新需一帧）
 *      // 4. 从 window._XXX_RESULT（优先）或结果 DOM 读取原始结果
 *      // 5. 调 result_mapping(raw) 转成结构化结果
 *      // 6. callback({ success, result, raw, error? })
 *    }
 *
 *    // ---- 结果映射 ----
 *    result_mapping: function (raw) => {
 *      success:   boolean  // 本次计算是否成功
 *      tool_id:   string   // 工具 id
 *      inputs:    {}       // 输入参数快照
 *      results:   {}       // 结构化计算结果（各项数值来自原程序）
 *      conclusion:string   // 一句话结论
 *      warnings:  string[] // 警告/不满足项
 *      items:     [{name, value, capacity, limit, unit, ok, note}]  // 验算项列表
 *      overall_ok:boolean  // 总体是否满足
 *    }
 *  }
 *
 *  ====== 新增工具三步法 ======
 *  1. 对照源码填 parameter_mapping（DOM id、单位口径）
 *  2. 写 bridge：填值 → click 按钮 → 读 window._XXX_RESULT
 *  3. 写 result_mapping：把 raw 转成统一结构化结果
 *  不要：改原 calc、改公式、让 LLM 算任何数值。
 * ========================================================== */
(function () {
    'use strict';

    // ========== 工具路由辅助 ==========
    // T形截面特征检测：输入含任一特征 → 应优先匹配 beam-t 而非 beam-rect
    var T_BEAM_FEATURE_PATTERNS = [
        { re: /t[\s-]*形[梁截]/i, label: 'T形梁/截面' },
        { re: /t[\s-]*型[梁截]/i, label: 'T型梁/截面' },
        { re: /t梁/i, label: 'T梁' },
        { re: /翼缘/, label: '翼缘' },
        { re: /(?:^|[\s,，；;])bf\s*[=＝]/i, label: 'bf' },
        { re: /(?:^|[\s,，；;])hf\s*[=＝]/i, label: 'hf' }
    ];

    // 柱特征词（用于轴心受压柱路由提升，且与梁互斥）
    var COLUMN_FEATURE_PATTERNS = [
        { re: /轴心受压[柱]?/, label: '轴心受压柱' },
        { re: /轴压柱/, label: '轴压柱' },
        { re: /受压柱/, label: '受压柱' },
        { re: /柱承载力/, label: '柱承载力' },
        { re: /(?:^|[\s,，；;])l0\s*[=＝]/i, label: 'l0计算长度' },
        { re: /计算长度/, label: '计算长度' },
        { re: /稳定系数/, label: '稳定系数φ' },
        { re: /长细比/, label: '长细比λ' }
    ];
    // 板特征词（用于slab-rect路由提升，且与梁/柱互斥）
    var SLAB_FEATURE_PATTERNS = [
        { re: /矩形板/, label: '矩形板' },
        { re: /单向板/, label: '单向板' },
        { re: /双向板/, label: '双向板' },
        { re: /四边支承/, label: '四边支承' },
        { re: /板配筋/, label: '板配筋' },
        { re: /板厚/, label: '板厚' },
        { re: /恒载.*活载.*板/, label: '恒载+活载+板' },
        { re: /弹性薄板/, label: '弹性薄板' },
        { re: /单块板/, label: '单块板' },
        { re: /楼板计算/, label: '楼板计算' }
    ];
    // 板路由的互斥特征词：出现这些 → 排除板路由（留给梁/柱/基础等）
    var PLATE_EXCLUSIVE_PATTERNS = [
        /t[\s-]*形[梁截]/i,
        /t[\s-]*型[梁截]/i,
        /t梁/i,
        /翼缘/,
        /(?:^|[\s,，；；])bf\s*[=＝]/i,
        /(?:^|[\s,，；；])hf\s*[=＝]/i,
        /正截面受弯/,
        /斜截面受剪/,
        /受弯承载力/,
        /抗剪承载力/,
        /轴心受压[柱]?/,
        /轴压柱/,
        /受压柱/,
        /柱承载力/,
        /(?:^|[\s,，；；])l0\s*[=＝]/i,
        /计算长度/,
        /稳定系数/,
        /长细比/,
        /独立基础/,
        /柱下基础/,
        /条形基础/,
        /桩基础/,
        /地基承载力/,
        /挠度验算/,
        /裂缝宽度/,
        /冲切/,
        /局部受压/,
        /牛腿/,
        /AAC/i,
        /ALC/i,
        /加气混凝土/,
        /蒸压加气/,
        /外墙板/,
        /装配式墙板/,
        /CRB600H/i,
        /连接件/,
        /基本风压/
    ];
    // 基础/地基特征词（用于 footing-col 路由提升，且与梁/柱/板/楼梯等互斥）
    var FOUNDATION_FEATURE_PATTERNS = [
        { re: /独立基础/, label: '独立基础' },
        { re: /柱下独立基础/, label: '柱下独立基础' },
        { re: /柱下基础/, label: '柱下基础' },
        { re: /扩展基础/, label: '扩展基础' },
        { re: /基底面积/, label: '基底面积' },
        { re: /地基承载力/, label: '地基承载力' },
        { re: /柱下冲切/, label: '柱下冲切' },
        { re: /基础配筋/, label: '基础配筋' },
        { re: /基础底板/, label: '基础底板' },
        { re: /基础高度/, label: '基础高度' },
        { re: /基础埋深/, label: '基础埋深' },
        { re: /fa\s*[=＝]\s*\d+/i, label: 'fa' },
        { re: /fak\s*[=＝]\s*\d+/i, label: 'fak' }
    ];
    // 基础路由的互斥特征词：出现这些 → 排除基础路由（留给梁/柱/板/墙等）
    var FOUNDATION_EXCLUSIVE_PATTERNS = [
        /t[\s-]*形[梁截]/i,
        /t[\s-]*型[梁截]/i,
        /t梁/i,
        /翼缘/,
        /正截面受弯/,
        /斜截面受剪/,
        /受弯承载力/,
        /抗剪承载力/,
        /轴心受压[柱]?/,
        /轴压柱/,
        /受压柱/,
        /柱承载力/,
        /(?:^|[\s,，；；])l0\s*[=＝]/i,
        /稳定系数/,
        /长细比/,
        /矩形板/,
        /单向板/,
        /双向板/,
        /板配筋/,
        /四边支承/,
        /弹性薄板/,
        /楼板计算/,
        /楼梯/,
        /板式楼梯/,
        /牛腿/,
        /剪力墙/,
        /砌体墙/,
        /裂缝宽度/,
        /挠度验算/
    ];
    function detectFoundationFeatures(text) {
        var found = [];
        if (!text) return { hasFoundationFeature: false, features: found, hasExclusiveFeature: false };
        FOUNDATION_FEATURE_PATTERNS.forEach(function (p) {
            if (p.re.test(text)) found.push(p.label);
        });
        var hasExclusive = FOUNDATION_EXCLUSIVE_PATTERNS.some(function (re) { return re.test(text); });
        return { hasFoundationFeature: found.length > 0, features: found, hasExclusiveFeature: hasExclusive };
    }

    function detectSlabFeatures(text) {
        var found = [];
        if (!text) return { hasSlabFeature: false, features: found, hasExclusiveFeature: false };
        SLAB_FEATURE_PATTERNS.forEach(function (p) {
            if (p.re.test(text)) found.push(p.label);
        });
        var hasExclusive = PLATE_EXCLUSIVE_PATTERNS.some(function (re) { return re.test(text); });
        return { hasSlabFeature: found.length > 0, features: found, hasExclusiveFeature: hasExclusive };
    }

    // 梁/柱互斥特征词：只要出现下列任一项 → 排除柱路由（留给梁）
    var BEAM_EXCLUSIVE_PATTERNS = [
        /t[\s-]*形[梁截]/i,
        /t[\s-]*型[梁截]/i,
        /t梁/i,
        /翼缘/,
        /(?:^|[\s,，；;])bf\s*[=＝]/i,
        /(?:^|[\s,，；;])hf\s*[=＝]/i,
        /正截面受弯/,
        /斜截面受剪/,
        /受弯承载力/,
        /抗剪承载力/
    ];
    function detectColumnFeatures(text) {
        var found = [];
        if (!text) return { hasColumnFeature: false, features: found, hasBeamFeature: false };
        COLUMN_FEATURE_PATTERNS.forEach(function (p) {
            if (p.re.test(text)) found.push(p.label);
        });
        var hasBeam = BEAM_EXCLUSIVE_PATTERNS.some(function (re) { return re.test(text); });
        return { hasColumnFeature: found.length > 0, features: found, hasBeamFeature: hasBeam };
    }
    // ===== 连续梁特征检测 =====
    function detectContinuousBeamFeatures(text) {
        if (!text) return { hasContinuousBeam: false, features: [] };
        var found = [];
        var patterns = [
            '连续梁', '多跨梁', '三弯矩', '三弯矩方程',
            '连续', '跨连续', '多跨',
            '支座弯矩', '跨中弯矩', '支座负弯矩',
            'n跨', 'n 跨', '各跨',
            'cb_calc' // 调试 id
        ];
        var lower = text.toLowerCase();
        for (var i = 0; i < patterns.length; i++) {
            if (lower.indexOf(patterns[i]) >= 0) {
                found.push(patterns[i]);
            }
        }
        // 排除：明确是单跨梁/简支梁的语境
        var simpleBeam = /简支梁|单跨梁|简支/.test(text);
        return {
            hasContinuousBeam: found.length > 0 && !simpleBeam,
            features: found,
            hasSimpleBeam: simpleBeam
        };
    }

    function detectTBeamFeatures(text) {
        var found = [];
        if (!text) return { hasTFeature: false, features: found };
        T_BEAM_FEATURE_PATTERNS.forEach(function (p) {
            if (p.re.test(text)) found.push(p.label);
        });
        return { hasTFeature: found.length > 0, features: found };
    }

    // ===== 板式楼梯特征检测 =====
    function detectStairFeatures(text) {
        if (!text) return { hasStair: false, features: [] };
        var found = [];
        var patterns = [
            '板式楼梯', '楼梯配筋', '楼梯板', '梯段板', '梯段斜板', '斜板配筋',
            '踏步', '踏面', '踢面', '平台板', '梯梁',
            '楼梯计算', '楼梯设计', '梯板厚',
            'st_calc' // 调试 id
        ];
        var lower = text.toLowerCase();
        for (var i = 0; i < patterns.length; i++) {
            if (lower.indexOf(patterns[i]) >= 0) found.push(patterns[i]);
        }
        // 单独的「楼梯」两个字也命中，但权重低一些，避免误伤
        if (lower.indexOf('楼梯') >= 0 && found.length === 0) found.push('楼梯');
        return {
            hasStair: found.length > 0,
            features: found,
            strongMatch: found.some(function(f) { return f !== '楼梯'; })
        };
    }

    // ===== AAC 外墙板特征检测 =====
    function detectAacWallFeatures(text) {
        if (!text) return { hasAacWall: false, features: [], strongMatch: false, veryStrong: false };
        var found = [];
        var strong = [];
        // 极强特征：直接判定就是 AAC 板（即使说「板厚」等泛词也不冲突）
        var veryStrongPatterns = [
            'AAC墙板', 'AAC板', 'AAC外墙', 'AAC围护',
            'ALC板', 'ALC墙板', 'ALC外墙',
            '蒸压加气混凝土板', '蒸压加气混凝土墙板', '蒸压加气墙板',
            '加气混凝土墙板', '加气混凝土板', '加气墙板', '加气板',
            '外墙板配筋', '外墙板验算',
            'CRB600H', 'aw_calc'
        ];
        var lower = text.toLowerCase();
        for (var i = 0; i < veryStrongPatterns.length; i++) {
            if (lower.indexOf(veryStrongPatterns[i].toLowerCase()) >= 0) {
                found.push(veryStrongPatterns[i]);
                strong.push(veryStrongPatterns[i]);
            }
        }
        // AAC 强度等级（A2.5/A3.5/A5.0/A7.5）单独检测，也是强特征
        var gradeRe = /A\s*(?:2\.5|3\.5|5\.0|7\.5|2,5|3,5|5,0|7,5)/i;
        if (gradeRe.test(text)) {
            found.push('AAC强度等级');
            strong.push('AAC强度等级');
        }
        // 中等特征：需要和板/墙语境组合
        var midPatterns = [
            '外墙板', '装配式墙板', '蒸压加气', '加气混凝土'
        ];
        for (var j = 0; j < midPatterns.length; j++) {
            if (lower.indexOf(midPatterns[j].toLowerCase()) >= 0) found.push(midPatterns[j]);
        }
        // 弱特征：单独 "AAC" 三个字母
        if (/\bAAC\b/i.test(text) && found.length === 0) found.push('AAC');

        var hasVery = strong.length > 0;
        return {
            hasAacWall: found.length > 0,
            features: found,
            strongMatch: found.some(function(f) { return f !== 'AAC'; }),
            veryStrong: hasVery  // 极强特征：直接定 aac-wall，不受其他工具干扰
        };
    }

    // ===== L22ZG401 预应力混凝土钢管桁架叠合板特征检测 =====
    function detectL22zg401Features(text) {
        if (!text) return { hasL22: false, features: [], strongMatch: false };
        var found = [];
        var strong = [];
        // 极强特征：图集号 + 核心术语
        var veryStrong = [
            'L22ZG401', 'l22zg401', 'L22ZG', 'l22zg',
            '预应力混凝土钢管桁架叠合板', '钢管桁架叠合板', '预应力钢管桁架',
            '钢管桁架预应力', '张弦叠合板'
        ];
        var lower = text.toLowerCase();
        for (var i = 0; i < veryStrong.length; i++) {
            if (lower.indexOf(veryStrong[i].toLowerCase()) >= 0) {
                found.push(veryStrong[i]);
                strong.push(veryStrong[i]);
            }
        }
        // 中等特征：GDB 编号（底板型号）
        if (/\bGDB\d+-\d/i.test(text)) {
            found.push('GDB底板编号');
            strong.push('GDB底板编号');
        }
        // 弱特征：单独 "钢管桁架" 需结合叠合板语境
        var steelTube = /钢管桁架/.test(text);
        var compositeSlab = /叠合板/.test(text);
        if (steelTube && compositeSlab && found.length === 0) {
            found.push('钢管桁架叠合板');
            strong.push('钢管桁架叠合板');
        }
        return {
            hasL22: found.length > 0,
            features: found,
            strongMatch: strong.length > 0
        };
    }

    // ========== 公共辅助 ==========
    function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    function vn(id) { var el = document.getElementById(id); return el ? parseFloat(el.value) : 0; }

    // 全局 trace 调试：push 到 window.AI_DEBUG_TRACE 并更新右上角面板
    // 与 index.html 里的 tracePush / updateTracePanel 保持兼容
    function _tracePush(record) {
        try {
            if (!window.AI_DEBUG_TRACE) window.AI_DEBUG_TRACE = [];
            record._t = Date.now();
            window.AI_DEBUG_TRACE.push(record);
            _updateTracePanel(record);
        } catch (e) {}
    }
    function _domVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    function _updateTracePanel(latest) {
        try {
            var panel = document.getElementById('ai_trace_panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'ai_trace_panel';
                panel.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;max-width:380px;max-height:60vh;overflow:auto;padding:8px 10px;background:#1e293b;color:#f1f5f9;border-radius:6px;font-size:11px;font-family:ui-monospace,monospace;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3);';
                var title = document.createElement('div');
                title.style.cssText = 'font-weight:bold;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;';
                title.innerHTML = '<span>AI Trace (bridge)</span><span style="cursor:pointer;color:#94a3b8;" onclick="document.getElementById(\'ai_trace_panel\').remove()">✕</span>';
                panel.appendChild(title);
                var body = document.createElement('div');
                body.id = 'ai_trace_body';
                panel.appendChild(body);
                document.body.appendChild(panel);
            }
            var body = document.getElementById('ai_trace_body');
            if (body) {
                var line = document.createElement('div');
                line.style.cssText = 'border-top:1px solid #334155;padding-top:4px;margin-top:4px;';
                var stepColor = '#38bdf8';
                if (latest.step && latest.step.indexOf('error') >= 0) stepColor = '#f87171';
                if (latest.step && latest.step.indexOf('success') >= 0) stepColor = '#4ade80';
                if (latest.step && latest.step.indexOf('calc_click') >= 0) stepColor = '#4ade80';
                var brief = '<span style="color:' + stepColor + ';font-weight:bold;">' + (latest.step || '?') + '</span>';
                if (latest.tool) brief += ' tool=<b>' + latest.tool + '</b>';
                if (latest.params_keys) brief += ' keys=[' + latest.params_keys.join(',') + ']';
                if (latest.written_keys) brief += ' written=[' + latest.written_keys.join(',') + ']';
                if (latest.dom_values) {
                    var dv = latest.dom_values;
                    brief += ' b=' + dv.b + ' bf=' + dv.bf + ' As=' + dv.As + ' as=' + dv.as;
                }
                if (latest.Mu != null) brief += ' Mu=' + latest.Mu.toFixed(2);
                if (latest.error) brief += ' err=' + String(latest.error).substring(0, 60);
                line.innerHTML = brief;
                body.appendChild(line);
                panel.scrollTop = panel.scrollHeight;
             }
         } catch (e) {}
     }
     // 暴露到全局，供 chat 模块等外部调用者复用同一个 trace 面板
     window._aiBridgeTraceUpdate = _updateTracePanel;

     // ========== 公共辅助 ==========
    function clickBtn(id) {
        var btn = document.getElementById(id);
        if (btn) btn.click();
    }

    // 公共辅助：按 parameter_mapping 把 params 写入 DOM
    // 支持参数名大小写不敏感匹配（如 LLM 返回 as 而注册表是 As）
    // 填值后回读校验，确保值真的写入了 DOM
    // 返回 { success, written:{aiKey:value}, mismatches:[...], missing_params:[...] }
    function applyParamsToDOM(params, mapping) {
        if (!mapping || !params) {
            return { success: false, written: {}, mismatches: ['params或mapping为空'], missing_params: [] };
        }
        // 构建 params 的大小写不敏感查找表
        var paramsLower = {};
        Object.keys(params).forEach(function (k) {
            paramsLower[k.toLowerCase()] = { originalKey: k, value: params[k] };
        });
        var mismatches = [];
        var written = {};
        var missing_params = [];
        Object.keys(mapping).forEach(function (aiKey) {
            var m = mapping[aiKey];
            var el = document.getElementById(m.domId);
            if (!el) {
                mismatches.push(aiKey + ' → DOM#' + m.domId + ' 不存在');
                return;
            }
            // 精确匹配优先，否则尝试大小写不敏感
            var val = params[aiKey];
            var matchedKey = aiKey;
            if (val === undefined || val === null) {
                var lowerEntry = paramsLower[aiKey.toLowerCase()];
                if (lowerEntry && lowerEntry.value !== undefined && lowerEntry.value !== null) {
                    val = lowerEntry.value;
                    matchedKey = lowerEntry.originalKey;
                }
            }
            if (val === undefined || val === null || val === '') {
                missing_params.push(aiKey);
                return;
            }
            var finalVal = m.transform ? m.transform(val) : val;
            el.value = finalVal;
            // 同时触发 input 和 change 事件，确保原页面任何联动都能响应
            try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
            try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            // 回读校验
            var readBack = el.value;
            var numExpected = parseFloat(finalVal);
            var numReadBack = parseFloat(readBack);
            var ok = false;
            if (!isNaN(numExpected) && !isNaN(numReadBack)) {
                ok = Math.abs(numExpected - numReadBack) < 0.001;
            } else {
                ok = String(finalVal) === String(readBack);
            }
            if (ok) {
                written[aiKey] = finalVal;
            } else {
                mismatches.push(aiKey + ': 预期=' + finalVal + ', 实际DOM=' + readBack +
                    ' (params key=' + matchedKey + ', DOM#' + m.domId + ')');
            }
        });
        var success = mismatches.length === 0 && Object.keys(written).length > 0;
        if (mismatches.length > 0) {
            console.warn('[AI_MAP] 映射不一致: ' + mismatches.join('; '));
        }
        console.log('[AI_MAP] 写入DOM: ' + Object.keys(written).length + ' 个 → ' +
            Object.keys(written).map(function(k){ return k + '=' + written[k]; }).join(', '));
        if (missing_params.length > 0) {
            console.log('[AI_MAP] 未提供的参数(跳过): ' + missing_params.join(', '));
        }
        if (Object.keys(written).length === 0 && mismatches.length === 0) {
            console.warn('[AI_MAP] 没有写入任何参数！params keys=' +
                Object.keys(params).join(', ') + '; mapping keys=' + Object.keys(mapping).join(', '));
        }
        return {
            success: success,
            written: written,
            mismatches: mismatches,
            missing_params: missing_params
        };
    }

    // 公共辅助：读结果（统一模式：先看 error-box，再看全局变量）
    function readResult(resultVarName, resultPanelId, mappingFn, callback) {
        setTimeout(function () {
            var raw = window[resultVarName] || null;
            var errEl = document.querySelector('#' + resultPanelId + ' .error-box');
            var errMsg = errEl ? errEl.textContent : '';
            if (errMsg) {
                callback({ success: false, error: errMsg, raw: raw });
            } else if (raw) {
                callback({ success: true, result: mappingFn(raw), raw: raw });
            } else {
                callback({ success: false, error: '计算未返回结果', raw: null });
            }
        }, 50);
    }

    /* ==========================================================
     *  工具 1：叠合构件两阶段验算（stage-check）
     *  原工具位置：src/index.html TOOLS['stage-check']
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=sc_calc
     *  原结果变量：window._SC_RESULT
     *  输入 DOM id 前缀：sc_
     * ========================================================== */
    var TOOL_STAGE_CHECK = {
        tool_id: 'stage-check',
        tool_name: '叠合构件两阶段验算',
        category: '装配式',
        description: '叠合板/叠合梁施工阶段与使用阶段两阶段验算，支持单向板/双向板，依据 GB/T 50010-2010（2024年版） 附录 H。',
        applicable_scenarios: '已知叠合构件截面尺寸、材料、配筋、荷载，进行施工阶段与使用阶段两阶段受弯、受剪、叠合面受剪及应力超前验算。',
        limitations: [
            '仅做承载力复核，不做配筋设计',
            '双向板按弹性理论弯矩系数查表法，不支持塑性内力重分布',
            '不考虑叠合面凹凸构造的具体抗剪贡献，按规范简化公式'
        ],
        keywords: ['叠合板', '叠合梁', '两阶段', '施工阶段', '叠合层', '预制板', 'TD板', '钢筋桁架', '叠合面受剪', '应力超前'],
        related_standards: [
            { standard: 'JGJ 1', articles: ['6.5.1', '6.5.4', '6.6.1'], note: '装配式混凝土结构技术规程·叠合构件' },
            { standard: 'GB 50010', articles: ['附录H'], note: '混凝土结构设计规范·叠合构件' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'kind', label: '构件类型', type: 'enum', options: ['slab', 'beam'], option_labels: ['叠合板', '叠合梁'], required: true, default: 'slab', description: '叠合板或叠合梁' },
            { name: 'hp', label: '预制层厚度 hp', type: 'number', unit: 'mm', required: true, default: 60, description: '预制构件厚度' },
            { name: 'hc', label: '叠合层厚度 hc', type: 'number', unit: 'mm', required: true, default: 70, description: '后浇叠合层厚度' },
            { name: 'con', label: '预制构件混凝土等级', type: 'string', unit: '', required: true, default: 'C30', description: '如 C30、C35、C40' },
            { name: 'reb', label: '钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400', description: 'HRB400 或 HRB500' },
            { name: 'd', label: '钢筋直径 d', type: 'number', unit: 'mm', required: true, default: 8, description: '受拉钢筋直径' },
            { name: 'as', label: '受拉筋合力点距离 as', type: 'number', unit: 'mm', required: true, default: 20, description: '受拉钢筋合力点到受拉边缘距离' }
        ],
        optional_parameters: [
            { name: 'slab_mode', label: '板受力模式', type: 'enum', options: ['oneway', 'twoway'], option_labels: ['单向板', '双向板'], required: false, default: 'oneway', description: '单向板按简支梁计算，双向板按弹性理论弯矩系数计算' },
            { name: 'support', label: '施工阶段支撑方式', type: 'enum', options: ['n', 'y'], option_labels: ['无支撑', '有支撑'], required: false, default: 'n', description: '有支撑按整体构件，无支撑按两阶段受力' },
            { name: 'L', label: '计算跨度 L', type: 'number', unit: 'm', required: false, default: 3.4, description: '单向板/梁跨度' },
            { name: 'Lx', label: '短跨跨度 Lx', type: 'number', unit: 'm', required: false, default: 3.0, description: '双向板短跨' },
            { name: 'Ly', label: '长跨跨度 Ly', type: 'number', unit: 'm', required: false, default: 4.2, description: '双向板长跨' },
            { name: 'edge', label: '四边支承条件', type: 'string', unit: '', required: false, default: 'ssss', description: 'ssss四边简支/ffff四边固定/sfsf两邻边固定/fffs三边固定/fsss一边固定' },
            { name: 'joint', label: '拼缝形式', type: 'string', unit: '', required: false, default: 'integral', description: 'integral整体式/separate分离式' },
            { name: 'B', label: '叠合板宽度 B', type: 'number', unit: 'mm', required: false, default: 1000, description: '叠合板计算宽度 300-3000mm' },
            { name: 'b', label: '梁宽 b', type: 'number', unit: 'mm', required: false, default: 200, description: '叠合梁截面宽度' },
            { name: 's', label: '配筋间距 s', type: 'number', unit: 'mm', required: false, default: 200, description: '叠合板配筋间距' },
            { name: 'n', label: '钢筋根数 n', type: 'number', unit: '根', required: false, default: 4, description: '叠合梁受拉钢筋根数' },
            { name: 'gamma', label: '混凝土容重 γ', type: 'number', unit: 'kN/m³', required: false, default: 25, description: '混凝土自重' },
            { name: 'g2k', label: '面层吊顶自重 g2k', type: 'number', unit: 'kN/m²', required: false, default: 1.5, description: '面层吊顶隔墙等附加恒载' },
            { name: 'q2k', label: '使用阶段活荷载 q2k', type: 'number', unit: 'kN/m²', required: false, default: 2.0, description: '使用阶段可变荷载标准值' },
            { name: 'qk', label: '施工活荷载 qk', type: 'number', unit: 'kN/m²', required: false, default: 1.5, description: '施工人员设备均布活荷载' },
            { name: 'gG', label: '永久荷载分项系数 γG', type: 'number', unit: '', required: false, default: 1.3, description: 'GB 50009 基本组合' },
            { name: 'gQ', label: '可变荷载分项系数 γQ', type: 'number', unit: '', required: false, default: 1.5, description: 'GB 50009 基本组合' },
            { name: 'ratio', label: '施工阶段实际强度比例 k', type: 'number', unit: '%', required: false, default: 100, description: '75-100，施工阶段混凝土实际强度' },
            { name: 'con2', label: '叠合层混凝土等级', type: 'string', unit: '', required: false, default: 'C30', description: '第二阶段叠合层混凝土强度' },
            { name: 'psi2', label: '使用活载准永久系数 ψq', type: 'number', unit: '', required: false, default: 0.5, description: '0-1，用于应力超前验算' }
        ],
        // AI参数名 → 真实DOM id 的映射
        parameter_mapping: {
            kind:       { domId: 'sc_kind',      unit: '' },
            slab_mode:  { domId: 'sc_slab_mode', unit: '' },
            support:    { domId: 'sc_support',   unit: '' },
            L:          { domId: 'sc_L',         unit: 'm' },
            Lx:         { domId: 'sc_Lx',        unit: 'm' },
            Ly:         { domId: 'sc_Ly',        unit: 'm' },
            edge:       { domId: 'sc_edge',      unit: '' },
            joint:      { domId: 'sc_joint',     unit: '' },
            B:          { domId: 'sc_B',         unit: 'mm' },
            b:          { domId: 'sc_b',         unit: 'mm' },
            hp:         { domId: 'sc_hp',        unit: 'mm' },
            hc:         { domId: 'sc_hc',        unit: 'mm' },
            con:        { domId: 'sc_con',       unit: '' },
            reb:        { domId: 'sc_reb',       unit: '' },
            d:          { domId: 'sc_d',         unit: 'mm' },
            s:          { domId: 'sc_s',         unit: 'mm' },
            n:          { domId: 'sc_n',         unit: '根' },
            as:         { domId: 'sc_as',        unit: 'mm' },
            gamma:      { domId: 'sc_gamma',     unit: 'kN/m³' },
            g2k:        { domId: 'sc_g2k',       unit: 'kN/m²' },
            q2k:        { domId: 'sc_q2k',       unit: 'kN/m²' },
            qk:         { domId: 'sc_qk',        unit: 'kN/m²' },
            gG:         { domId: 'sc_gG',        unit: '' },
            gQ:         { domId: 'sc_gQ',        unit: '' },
            ratio:      { domId: 'sc_ratio',     unit: '%' },
            con2:       { domId: 'sc_con2',      unit: '' },
            psi2:       { domId: 'sc_psi2',      unit: '' }
        },
        // 桥接：填值→触发联动→点计算→读结果
        bridge: function (params, callback) {
            var mapResult = applyParamsToDOM(params, this.parameter_mapping);

            // 必填项DOM回读校验
            var required = this.required_parameters || [];
            var missingDom = [];
            required.forEach(function (p) {
                if (mapResult.written[p.name] === undefined) {
                    missingDom.push(p.name);
                }
            });

            if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                var errMsg = '参数映射失败，已中止计算。' +
                    (missingDom.length > 0 ? ' 未写入DOM的必填项: ' + missingDom.join(', ') : '') +
                    (mapResult.mismatches.length > 0 ? ' 映射不一致: ' + mapResult.mismatches.join('; ') : '');
                console.error('[AI_BRIDGE] stage-check: ' + errMsg);
                callback({
                    success: false,
                    error: 'mapping_mismatch',
                    error_detail: errMsg,
                    missing_dom: missingDom,
                    mismatches: mapResult.mismatches,
                    written: mapResult.written
                });
                return;
            }

            // 触发模式切换（确保双向板字段显示/隐藏正确）
            try {
                var modeEl = document.getElementById('sc_slab_mode');
                if (modeEl) modeEl.dispatchEvent(new Event('change'));
                var kindEl = document.getElementById('sc_kind');
                if (kindEl) kindEl.dispatchEvent(new Event('change'));
            } catch (e) {}

            console.log('[AI_BRIDGE] stage-check 参数校验通过，点击计算按钮');
            clickBtn('sc_calc');
            readResult('_SC_RESULT', 'sc_result', mapStageCheckResult, callback);
        },
        // 结果映射
        result_mapping: mapStageCheckResult
    };

    // 叠合板结果映射：从 window._SC_RESULT 提取结构化结果
    function mapStageCheckResult(r) {
        var out = {
            mode: r.mode,
            kind: r.kind,
            support: r.support,
            basic: {
                hp: r.hp, hc: r.hc, h: r.h,
                concrete_precast: r.conGrade,
                rebar_grade: r.rebGrade,
                As: r.As,
                rebar_d: r.rebarD,
                rebar_expr: r.rebarExpr
            },
            overall_ok: r.allOk !== undefined ? r.allOk : (r.allSupOk !== undefined ? r.allSupOk : null),
            items: []
        };

        // 按模式提取关键验算项
        if (r.support === 'y') {
            if (r.mode === 'twoway') {
                out.items.push({ name: '短跨受弯承载力', value: r.M_sup_x, unit: 'kN·m/m', capacity: r.Mu_sup_x, ok: r.cap_sup_x });
                out.items.push({ name: '长跨受弯承载力', value: r.M_sup_y, unit: 'kN·m/m', capacity: r.Mu_sup_y, ok: r.cap_sup_y });
                out.items.push({ name: '叠合面剪应力', value: r.tau_sup, unit: 'N/mm²', limit: 0.4, ok: r.face_sup_ok });
                out.items.push({ name: '斜截面受剪', value: r.V_sup, unit: 'kN/m', capacity: r.vc_sup, ok: r.shear_sup_ok });
            } else {
                out.items.push({ name: '整体截面受弯承载力', value: r.M_sup, unit: 'kN·m/m', capacity: r.Mu_sup, ok: r.cap_sup });
                out.items.push({ name: '叠合面剪应力', value: r.tau_sup, unit: 'N/mm²', limit: 0.4, ok: r.face_sup_ok });
                out.items.push({ name: '斜截面受剪', value: r.V_sup, unit: 'kN/m', capacity: r.vc_sup, ok: r.shear_sup_ok });
            }
        } else {
            out.items.push({ name: '第一阶段预制受弯承载力', value: r.M1, unit: 'kN·m/m', capacity: r.Mu1, ok: r.capOk, stage: 1 });
            out.items.push({ name: '第一阶段钢筋应力', value: r.sigSq, unit: 'N/mm²', limit: r.sigLim, ok: r.sigOk, stage: 1 });
            out.items.push({ name: '第一阶段叠合面剪应力', value: r.tau, unit: 'N/mm²', limit: 0.4, ok: r.faceOk, stage: 1 });
            out.items.push({ name: '第一阶段斜截面受剪', value: r.V1, unit: 'kN/m', capacity: r.vc, ok: r.shearOk, stage: 1 });
            if (r.mode === 'twoway') {
                out.items.push({ name: '第二阶段短跨受弯承载力', value: r.M2x, unit: 'kN·m/m', capacity: r.Mu2x, ok: r.cap2xOk, stage: 2 });
                out.items.push({ name: '第二阶段长跨受弯承载力', value: r.M2y, unit: 'kN·m/m', capacity: r.Mu2y, ok: r.cap2yOk, stage: 2 });
            } else {
                out.items.push({ name: '第二阶段整体受弯承载力', value: r.M2, unit: 'kN·m/m', capacity: r.Mu2, ok: r.cap2Ok, stage: 2 });
            }
            out.items.push({ name: '第二阶段钢筋应力（应力超前）', value: r.sigSq2, unit: 'N/mm²', limit: r.sigLim2, ok: r.sig2Ok, stage: 2 });
            out.items.push({ name: '第二阶段叠合面剪应力', value: r.tau2, unit: 'N/mm²', limit: 0.4, ok: r.face2Ok, stage: 2 });
            out.items.push({ name: '第二阶段斜截面受剪', value: r.V2, unit: 'kN/m', capacity: r.vc2, ok: r.shear2Ok, stage: 2 });
        }

        return out;
    }

    /* ==========================================================
     *  工具 2：矩形梁正截面承载力复核（beam-rect）
     *  原工具位置：src/index.html TOOLS['beam-rect']（第 3838 行起）
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=r_calc
     *  原结果变量：window._BR_RESULT（原 calc 末尾挂出，第 3969 行）
     *  输入 DOM id 前缀：r_
     * ========================================================== */
    var TOOL_BEAM_RECT = {
        tool_id: 'beam-rect',
        tool_name: '矩形梁正截面承载力复核',
        category: '受弯构件',
        description: '单筋/双筋矩形截面受弯承载力复核，含界限受压区高度与最小配筋率验算。依据 GB/T 50010-2010（2024年版） 第 6.2.10 条。',
        applicable_scenarios: '已知截面尺寸、材料等级、受拉钢筋面积，进行正截面受弯承载力复核。',
        limitations: [
            '当前仅支持承载力复核模式（给定 As 求 Mu）',
            '不支持根据目标弯矩自动反算/设计配筋',
            '不支持斜截面、裂缝、挠度等其他验算'
        ],
        keywords: ['矩形梁', '正截面', '受弯承载力', '单筋', '双筋', '配筋', '梁截面', '受弯'],
        related_standards: [
            { standard: 'GB 50010', articles: ['6.2.10', '8.5.1'], note: '正截面受弯承载力·最小配筋率' },
            { standard: 'GB 50011', articles: ['6.3.3'], note: '框架梁抗震构造（抗震设计适用）' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'b', label: '截面宽 b', type: 'number', unit: 'mm', required: true, default: 300,
              aliases: ['b', '梁宽', '截面宽', '宽度', 'breadth'],
              description: '矩形截面宽度' },
            { name: 'h', label: '截面高 h', type: 'number', unit: 'mm', required: true, default: 600,
              aliases: ['h', '梁高', '截面高', '高度', 'height'],
              description: '矩形截面高度' },
            { name: 'concrete', label: '混凝土等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土等级', '砼等级', '强度等级'],
              description: '如 C30、C35、C40' },
            { name: 'steel', label: '钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['steel', 'reb', '钢筋', '钢筋级别', '钢筋等级', '钢种'],
              description: 'HRB400 或 HRB500' },
            { name: 'As', label: '受拉钢筋面积 As', type: 'number', unit: 'mm²', required: true, default: 1473,
              aliases: ['As', '受拉钢筋面积', '配筋面积', '钢筋面积', '受拉筋面积', '受拉配筋', 'reinforcement_area'],
              description: '受拉纵筋总面积，可按直径根数换算' }
        ],
        optional_parameters: [
            { name: 'AsP', label: '受压钢筋面积 As′', type: 'number', unit: 'mm²', required: false, default: 0,
              aliases: ["As'", 'AsP', '受压钢筋面积', '受压筋面积', '受压配筋', '受压钢筋'],
              description: '双筋时填写，单筋填 0' },
            { name: 'a_s', label: '受拉筋合力点距 as', type: 'number', unit: 'mm', required: false, default: 40,
              aliases: ['a_s', 'as', '保护层', '保护层厚度', '受拉保护层', '受拉钢筋合力点', 'as_pull'],
              description: '受拉钢筋合力点到受拉边缘的距离' },
            { name: 'a_s2', label: '受压筋合力点距 as′', type: 'number', unit: 'mm', required: false, default: 40,
              aliases: ["a_s'", 'a_s2', "as'", 'as2', '受压保护层', '受压钢筋合力点', 'as_comp'],
              description: '受压钢筋合力点到受压边缘的距离' }
        ],
        // AI参数名 → 真实DOM id 的映射
        parameter_mapping: {
            b:        { domId: 'r_b',    unit: 'mm' },
            h:        { domId: 'r_h',    unit: 'mm' },
            concrete: { domId: 'r_con',  unit: '' },
            steel:    { domId: 'r_reb',  unit: '' },
            As:       { domId: 'r_As',   unit: 'mm²' },
            AsP:      { domId: 'r_AsP',  unit: 'mm²' },
            a_s:      { domId: 'r_as',   unit: 'mm' },
            a_s2:     { domId: 'r_as2',  unit: 'mm' }
        },
        // 桥接：填值→校验→点计算→读结果
        // 【安全保证】填值后立即回读DOM，必填项任一不一致就中止，绝不点calc
        bridge: function (params, callback) {
            var mapResult = applyParamsToDOM(params, this.parameter_mapping);

            // 必填项DOM回读校验：每个必填参数必须成功写入DOM
            var required = this.required_parameters || [];
            var missingDom = [];
            required.forEach(function (p) {
                if (mapResult.written[p.name] === undefined) {
                    missingDom.push(p.name);
                }
            });

            if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                var errMsg = '参数映射失败，已中止计算。' +
                    (missingDom.length > 0 ? ' 未写入DOM的必填项: ' + missingDom.join(', ') : '') +
                    (mapResult.mismatches.length > 0 ? ' 映射不一致: ' + mapResult.mismatches.join('; ') : '');
                console.error('[AI_BRIDGE] ' + errMsg);
                callback({
                    success: false,
                    error: 'mapping_mismatch',
                    error_detail: errMsg,
                    missing_dom: missingDom,
                    mismatches: mapResult.mismatches,
                    written: mapResult.written
                });
                return;
            }

            console.log('[AI_BRIDGE] 参数校验通过，点击计算按钮');
            clickBtn('r_calc');
            readResult('_BR_RESULT', 'r_result', mapBeamRectResult, function(res) {
                if (res.success) {
                    console.log('[AI_RESULT] Mu=' + (res.result && res.result.results && res.result.results.capacity ? res.result.results.capacity.Mu : 'N/A') + ' kN·m');
                }
                callback(res);
            });
        },
        // 结果映射
        result_mapping: mapBeamRectResult
    };

    // 矩形梁正截面结果映射：从 window._BR_RESULT 提取结构化结果
    function mapBeamRectResult(r) {
        var warnings = [];
        if (r.over) warnings.push('超筋破坏：ξ > ξb，应按界限承载力估算');
        if (!r.isUnder) warnings.push('少筋：As < ρmin·b·h，不满足 GB 50010 第 8.5.1 条');
        if (r.isD && r.branch === 'ds') warnings.push('双筋截面受压钢筋未屈服，按应变协调计算');

        var out = {
            success: true,
            tool_id: 'beam-rect',
            inputs: {
                b: r.b, h: r.h, as: r.asV, as_prime: r.as2V,
                concrete: r.conGrade, steel: r.rebGrade,
                As: r.As, AsP: r.AsP, is_double_rebar: r.isD
            },
            results: {
                basic: {
                    b: r.b, h: r.h, h0: r.h0,
                    as: r.asV, as_prime: r.as2V,
                    concrete: r.conGrade, steel: r.rebGrade,
                    As: r.As, AsP: r.AsP,
                    is_double_rebar: r.isD,
                    branch: r.branch
                },
                material: {
                    fc: r.fc, ft: r.ft, fy: r.fy, fyp: r.fyp,
                    alpha1: r.alpha1, beta1: r.beta1, es: r.es, ecu: r.ecu
                },
                capacity: {
                    Mu: r.Mu,
                    xi: r.xi,
                    xi_b: r.xi_b,
                    x: r.x,
                    over_reinforced: r.over,
                    sigma_sp: r.sigmaSp
                },
                rebar_check: {
                    rho: r.rho,
                    rho_min: r.rho_min,
                    As_min: r.AsMin,
                    meets_min: r.isUnder
                }
            },
            conclusion: r.stMsg,
            warnings: warnings,
            verdict: { status: r.stCls, message: r.stMsg },
            overall_ok: r.stCls === 'badge-ok',
            items: []
        };

        out.items.push({
            name: '正截面受弯承载力',
            capacity: r.Mu,
            unit: 'kN·m',
            ok: !r.over && r.isUnder,
            note: r.over ? '超筋' : (r.isUnder ? '适筋' : '少筋')
        });
        out.items.push({
            name: '相对受压区高度 ξ',
            value: r.xi,
            limit: r.xi_b,
            unit: '',
            ok: !r.over,
            note: r.over ? 'ξ > ξb 超筋' : 'ξ ≤ ξb 适筋'
        });
        out.items.push({
            name: '最小配筋率验算',
            value: r.As,
            limit: r.AsMin,
            unit: 'mm²',
            ok: r.isUnder,
            note: r.isUnder ? 'As ≥ As,min' : 'As < As,min 少筋'
        });

        return out;
    }

    /* ==========================================================
     *  工具 3：梁斜截面受剪承载力（beam-shear）
     *  原工具位置：src/index.html TOOLS['beam-shear']（第 4141 行起）
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=s_calc
     *  原结果变量：window._BS_RESULT
     *  输入 DOM id 前缀：s_
     * ========================================================== */
    var TOOL_BEAM_SHEAR = {
        tool_id: 'beam-shear',
        tool_name: '梁斜截面受剪承载力',
        category: '受弯构件',
        description: '仅配箍筋受剪承载力复核与所需配箍面积计算，含截面限制条件验算。依据 GB/T 50010-2010（2024年版） 第 6.3.1、6.3.4 条。',
        applicable_scenarios: '已知矩形截面尺寸、材料等级、箍筋配置、剪力设计值，进行斜截面受剪承载力复核（V ≤ Vc + Vsv）。',
        limitations: [
            '仅支持仅配箍筋的矩形截面受剪复核，不支持弯起筋、不支持T形/工形截面按翼缘计算',
            '集中荷载按独立梁剪跨比计算，取值范围 1.5 ≤ λ ≤ 3.0',
            '不支持偏心受压/偏心受拉等非受弯构件的斜截面',
            '不支持抗震调整（γRE）'
        ],
        keywords: ['斜截面', '受剪', '抗剪', '箍筋', '剪力', '梁受剪', '斜截面受剪', '配箍', '剪跨比'],
        related_standards: [
            { standard: 'GB 50010', articles: ['6.3.1', '6.3.4'], note: '斜截面受剪承载力' },
            { standard: 'GB 50011', articles: ['5.4.1'], note: '抗震承载力调整系数 γRE（抗震设计适用）' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'b', label: '截面宽 b', type: 'number', unit: 'mm', required: true, default: 250,
              aliases: ['b', '梁宽', '截面宽', '宽度', '腹板宽'],
              description: '矩形截面宽度（腹板宽）' },
            { name: 'h', label: '截面高 h', type: 'number', unit: 'mm', required: true, default: 600,
              aliases: ['h', '梁高', '截面高', '高度'],
              description: '矩形截面总高度' },
            { name: 'concrete', label: '混凝土等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土等级', '砼等级'],
              description: '如 C30、C35、C40' },
            { name: 'stirrup_steel', label: '箍筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['stirrup_steel', 'stir', 'stirrup', '箍筋级别', '箍筋等级', '箍筋钢种', '箍筋牌号'],
              description: 'HPB300 / HRB400 / HRB500' },
            { name: 'Asv', label: '箍筋总面积 Asv', type: 'number', unit: 'mm²', required: true, default: 101,
              aliases: ['Asv', '箍筋面积', '箍筋总面积', '配箍面积', 'stirrup_area'],
              description: '同一截面内箍筋各肢总截面面积，如 φ8 双肢 = 2×50.3 ≈ 101 mm²' },
            { name: 's_v', label: '箍筋间距 s', type: 'number', unit: 'mm', required: true, default: 150,
              aliases: ['s_v', 's', '箍筋间距', '配箍间距', 'stirrup_spacing'],
              description: '沿梁轴方向的箍筋间距' },
            { name: 'V', label: '剪力设计值 V', type: 'number', unit: 'kN', required: true, default: 250,
              aliases: ['V', '剪力', '剪力设计值', '剪力值', 'shear_force'],
              description: '斜截面最大剪力设计值' }
        ],
        optional_parameters: [
            { name: 'a_s', label: '纵向筋合力点距 as', type: 'number', unit: 'mm', required: false, default: 40,
              aliases: ['a_s', 'as', '保护层', '纵向筋保护层', '受拉保护层', '受拉钢筋合力点'],
              description: '纵向受拉钢筋合力点到受拉边缘的距离，用于计算 h0' },
            { name: 'load_type', label: '荷载类型', type: 'enum',
              options: ['uniform', 'concentrated'], option_labels: ['均布荷载为主', '集中荷载为主'],
              required: false, default: 'uniform',
              aliases: ['load_type', 'load', '荷载类型', '荷载形式'],
              description: '均布荷载按 0.7ftbh0，集中荷载按剪跨比 λ 计算 αcv=1.75/(λ+1)' },
            { name: 'lambda', label: '剪跨比 λ', type: 'number', unit: '', required: false, default: 2.0,
              aliases: ['lambda', 'λ', '剪跨比', '剪跨'],
              description: '集中荷载时用，λ=a/h0，取 1.5 ≤ λ ≤ 3.0' }
        ],
        // AI参数名 → 真实DOM id 的映射
        parameter_mapping: {
            b:             { domId: 's_b',     unit: 'mm' },
            h:             { domId: 's_h',     unit: 'mm' },
            a_s:           { domId: 's_as',    unit: 'mm' },
            concrete:      { domId: 's_con',   unit: '' },
            stirrup_steel: { domId: 's_stir',  unit: '' },
            Asv:           { domId: 's_Asv',   unit: 'mm²' },
            s_v:           { domId: 's_s',     unit: 'mm' },
            V:             { domId: 's_V',     unit: 'kN' },
            load_type:     { domId: 's_load',  unit: '' },
            lambda:        { domId: 's_lambda', unit: '' }
        },
        // 桥接：填值→校验→点计算→读结果
        // 【安全保证】填值后立即回读DOM，必填项任一不一致就中止，绝不点calc
        bridge: function (params, callback) {
            var mapResult = applyParamsToDOM(params, this.parameter_mapping);

            // 必填项DOM回读校验：每个必填参数必须成功写入DOM
            var required = this.required_parameters || [];
            var missingDom = [];
            required.forEach(function (p) {
                if (mapResult.written[p.name] === undefined) {
                    missingDom.push(p.name);
                }
            });

            if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                var errMsg = '参数映射失败，已中止计算。' +
                    (missingDom.length > 0 ? ' 缺失DOM: ' + missingDom.join(', ') + '。' : '') +
                    (mapResult.mismatches.length > 0 ? ' 回读不一致: ' + mapResult.mismatches.join('；') + '。' : '');
                console.error('[AI_BRIDGE] beam-shear 映射失败:', errMsg);
                callback({
                    success: false,
                    error: 'mapping_mismatch',
                    error_detail: errMsg,
                    missing_dom: missingDom,
                    mismatches: mapResult.mismatches,
                    written: mapResult.written
                });
                return;
            }

            console.log('[AI_BRIDGE] 参数校验通过，点击计算按钮');
            clickBtn('s_calc');
            readResult('_BS_RESULT', 's_result', mapBeamShearResult, function(res) {
                if (res.success) {
                    console.log('[AI_RESULT] beam-shear Vu=' + (res.result && res.result.results && res.result.results.capacity ? res.result.results.capacity.Vu : 'N/A') + ' kN');
                }
                callback(res);
            });
        },
        // 结果映射
        result_mapping: mapBeamShearResult
    };

    // 梁斜截面受剪结果映射：从 window._BS_RESULT 提取结构化结果
    function mapBeamShearResult(r) {
        var warnings = [];
        if (!r.secOk) warnings.push('截面不满足：V > Vmax，应加大截面或提高混凝土等级（GB 6.3.1）');
        if (r.svOk === false) warnings.push('配箍率不足：ρsv < ρsv,min（GB 9.2.9）');
        // r.ok 是 V <= Vu 的主判定
        if (!r.ok && r.secOk) warnings.push('受剪承载力不足：V > Vu，需增大配箍或加大截面');

        var verdictStatus = 'ok';
        var verdictMsg = '斜截面受剪承载力满足规范要求';
        if (!r.secOk) {
            verdictStatus = 'err';
            verdictMsg = '截面不满足截面限制条件，应加大截面或提高混凝土等级';
        } else if (!r.ok) {
            verdictStatus = 'err';
            verdictMsg = '受剪承载力不满足：V > Vu';
        } else if (r.svOk === false) {
            verdictStatus = 'warn';
            verdictMsg = '承载力满足，但配箍率低于构造要求';
        }

        var out = {
            success: true,
            tool_id: 'beam-shear',
            inputs: {
                b: r.b, h: r.h, as: r.asV || r.as, h0: r.h0,
                concrete: r.conGrade, stirrup_steel: r.stirGrade,
                Asv: r.Asv || null, s_v: r.s || null, V: r.V,
                load_type: r.isConc !== undefined ? (r.isConc ? 'concentrated' : 'uniform') : null,
                lambda: r.lambda || null
            },
            results: {
                basic: {
                    b: r.b, h: r.h, h0: r.h0,
                    as: r.asV || r.as,
                    concrete: r.conGrade,
                    stirrup_steel: r.stirGrade,
                    Asv: r.Asv !== undefined ? r.Asv : null,
                    s: r.s !== undefined ? r.s : null,
                    V: r.V
                },
                material: {
                    fc: r.fc, ft: r.ft, fyv: r.fyv
                },
                capacity: {
                    Vu: r.Vu,
                    Vc: r.Vc,
                    Vsv: r.Vsv !== undefined ? r.Vsv : (r.Vs !== undefined ? r.Vs : null), // 兼容 Vsv/Vs 两种字段
                    Vmax: r.Vmax,
                    hwb: r.hwb,
                    sec_ok: r.secOk,
                    mode: r.mode
                },
                stirrup_check: {
                    rho_sv: r.rho,
                    rho_sv_min: r.rsvMin,
                    meets_min: r.svOk
                }
            },
            conclusion: verdictMsg,
            warnings: warnings,
            verdict: { status: verdictStatus, message: verdictMsg },
            overall_ok: verdictStatus === 'ok',
            items: []
        };

        out.items.push({
            name: '斜截面受剪承载力 Vu',
            capacity: r.Vu,
            value: r.V,
            unit: 'kN',
            ok: r.ok !== undefined ? r.ok : (r.V <= r.Vu),
            note: r.ok ? 'V ≤ Vu 满足' : 'V > Vu 不满足'
        });
        out.items.push({
            name: '截面限制条件 Vmax',
            capacity: r.Vmax,
            value: r.V,
            unit: 'kN',
            ok: r.secOk,
            note: r.secOk ? 'V ≤ Vmax 满足' : 'V > Vmax 截面不足'
        });
        out.items.push({
            name: '混凝土项 Vc',
            value: r.Vc,
            unit: 'kN',
            ok: true,
            note: r.isConc ? '集中荷载 αcv·ft·b·h0' : '均布荷载 0.7·ft·b·h0'
        });
        if (r.Vsv !== undefined || r.Vs !== undefined) {
            out.items.push({
                name: '箍筋项 Vsv',
                value: r.Vsv !== undefined ? r.Vsv : r.Vs,
                unit: 'kN',
                ok: true,
                note: 'fyv·Asv·h0/s'
            });
        }
        out.items.push({
            name: '配箍率 ρsv',
            value: (r.rho || 0) * 100,
            limit: (r.rsvMin || 0) * 100,
            unit: '%',
            ok: r.svOk,
            note: r.svOk ? 'ρsv ≥ ρsv,min 满足' : 'ρsv < ρsv,min 不足'
        });

        return out;
    }

    /* ==========================================================
     *  工具 4：T形梁正截面承载力（beam-t）
     *  原工具位置：src/index.html TOOLS['beam-t']（第 4009 行起）
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=t_calc
     *  原结果变量：window._BT_RESULT
     *  输入 DOM id 前缀：t_
     * ========================================================== */
    var TOOL_BEAM_T = {
        tool_id: 'beam-t',
        tool_name: 'T形梁正截面承载力',
        category: '受弯构件',
        description: '第一类/第二类 T 形截面判别与受弯承载力计算，依据 GB/T 50010-2010（2024年版） 第 6.2.11 条。',
        applicable_scenarios: '已知T形截面尺寸、材料等级、受拉钢筋面积，进行正截面受弯承载力复核。',
        limitations: [
            '仅支持单筋矩形受弯（仅受拉钢筋），不支持双筋、不支持受压钢筋',
            '翼缘计算宽度 bf 需由用户自行取值，工具不做 bf 取值验算',
            '不支持抗震调整（γRE）'
        ],
        keywords: ['T形梁', 'T型梁', 'T梁', 'T形截面', '翼缘', '双T板', '正截面受弯', 'T形正截面'],
        related_standards: [
            { standard: 'GB 50010', articles: ['6.2.11', '8.5.1'], note: 'T形截面正截面受弯·最小配筋率' },
            { standard: 'GB 50011', articles: ['6.3.3'], note: '框架梁抗震构造（抗震设计适用）' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'b', label: '腹板宽 b', type: 'number', unit: 'mm', required: true, default: 250,
              aliases: ['b', '腹板宽', '肋宽', '梁肋宽', '腹板宽度'],
              description: 'T形截面腹板（梁肋）宽度' },
            { name: 'h', label: '截面高 h', type: 'number', unit: 'mm', required: true, default: 600,
              aliases: ['h', '梁高', '总高', '截面高', '截面高度'],
              description: 'T形截面总高度' },
            { name: 'bf', label: '翼缘计算宽度 bf', type: 'number', unit: 'mm', required: true, default: 500,
              aliases: ['bf', '翼缘宽', '翼缘计算宽度', '受压翼缘宽', 'b_f', 'bf_prime', "b'f"],
              description: 'T形截面受压翼缘计算宽度，必须大于腹板宽 b' },
            { name: 'hf', label: '翼缘厚度 hf', type: 'number', unit: 'mm', required: true, default: 100,
              aliases: ['hf', '翼缘厚', '翼缘高度', '翼缘厚度', '受压翼缘厚', 'h_f', 'hf_prime', "h'f"],
              description: 'T形截面受压翼缘厚度' },
            { name: 'concrete', label: '混凝土等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土等级', '砼等级'],
              description: '如 C30、C35、C40' },
            { name: 'steel', label: '钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['steel', 'reb', '钢筋级别', '钢筋等级', '钢筋牌号', '纵向钢筋级别', '受拉钢筋级别'],
              description: 'HRB400 或 HRB500' },
            { name: 'As', label: '受拉钢筋面积 As', type: 'number', unit: 'mm²', required: true, default: 1963,
              aliases: ['As', '受拉钢筋面积', '受拉面积', '配筋面积', '钢筋面积'],
              description: '受拉钢筋总截面面积' },
            { name: 'a_s', label: '受拉筋保护层 as', type: 'number', unit: 'mm', required: true, default: 40,
              aliases: ['a_s', 'as', '保护层', '受拉保护层', '受拉筋保护层', '纵向筋保护层', '受拉钢筋合力点'],
              description: '受拉钢筋合力点到受拉边缘的距离，用于计算 h0' }
        ],
        optional_parameters: [],
        // AI参数名 → 真实DOM id 的映射
        parameter_mapping: {
            b:        { domId: 't_b',    unit: 'mm' },
            h:        { domId: 't_h',    unit: 'mm' },
            bf:       { domId: 't_bf',   unit: 'mm' },
            hf:       { domId: 't_hf',   unit: 'mm' },
            concrete: { domId: 't_con',  unit: '' },
            steel:    { domId: 't_reb',  unit: '' },
            As:       { domId: 't_As',   unit: 'mm²' },
            a_s:      { domId: 't_as',   unit: 'mm' }
        },
        // 桥接：填值→校验→点计算→读结果
        // 【安全保证】填值后立即回读DOM，必填项任一不一致就中止，绝不点calc
        bridge: function (params, callback) {
            _tracePush({ step: 'bridge_entry', tool: 'beam-t', params_keys: Object.keys(params) });
            var mapping = this.parameter_mapping;
            var required = this.required_parameters || [];
            var tries = 0;
            var maxTries = 10;
            var retryInterval = 30;
            var self = this;

            function tryFillAndCalc() {
                var mapResult = applyParamsToDOM(params, mapping);
                _tracePush({
                    step: 'bridge_dom_write_try' + (tries + 1),
                    written_keys: Object.keys(mapResult.written || {}),
                    mismatches: mapResult.mismatches || [],
                    missing_params: mapResult.missing_params || []
                });

                // 必填项DOM回读校验：每个必填参数必须成功写入DOM
                var missingDom = [];
                required.forEach(function (p) {
                    if (mapResult.written[p.name] === undefined) {
                        missingDom.push(p.name);
                    }
                });

                 if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                     tries++;
                     if (tries < maxTries) {
                         setTimeout(tryFillAndCalc, retryInterval);
                         return;
                     }
                     // 重试耗尽，报错
                     var errMsg = '参数映射失败（重试' + tries + '次仍未通过），已中止计算。' +
                         (missingDom.length > 0 ? ' 缺失DOM: ' + missingDom.join(', ') + '。' : '') +
                         (mapResult.mismatches.length > 0 ? ' 回读不一致: ' + mapResult.mismatches.join('；') + '。' : '');
                     console.error('[AI_BRIDGE] beam-t 映射失败:', errMsg);
                     _tracePush({ step: 'bridge_error_mapping', error: errMsg, missing_dom: missingDom, mismatches: mapResult.mismatches, retries: tries });
                     callback({
                         success: false,
                         error: 'mapping_mismatch',
                         error_detail: errMsg,
                         missing_dom: missingDom,
                         mismatches: mapResult.mismatches,
                         written: mapResult.written
                     });
                     return;
                 }

                 // ===== T梁默认值安全门 =====
                 // 写后回读仍停留在默认值且用户预期不同 → DOM写值实际失败（极可能是页面未渲染或DOM id不对），严禁点calc
                 var defaults = { b: 250, h: 600, bf: 500, hf: 100, concrete: 'C30', steel: 'HRB400', As: 1963, a_s: 40 };
                 var stuckDefaults = [];
                 required.forEach(function (p) {
                     var userVal = params[p.name];
                     var domVal = mapResult.written[p.name];
                     if (userVal !== undefined && defaults[p.name] !== undefined) {
                         var userNum = parseFloat(userVal);
                         var defNum = parseFloat(defaults[p.name]);
                         var domNum = parseFloat(domVal);
                         if (!isNaN(userNum) && !isNaN(defNum) && !isNaN(domNum)) {
                             if (Math.abs(userNum - defNum) > 0.001 && Math.abs(domNum - defNum) < 0.001) {
                                 stuckDefaults.push(p.name);
                             }
                         } else if (String(userVal) !== String(defaults[p.name]) && String(domVal) === String(defaults[p.name])) {
                             stuckDefaults.push(p.name);
                         }
                     }
                 });
                 if (stuckDefaults.length > 0) {
                     var defErrMsg = 'T梁bridge写值失败：以下字段回读仍为默认值，疑似DOM未就绪或id不匹配：' + stuckDefaults.join('、') + '。已中止，未点击计算。';
                     console.error('[AI_BRIDGE] ' + defErrMsg);
                     _tracePush({ step: 'bridge_result_error', error: 'default_values_stuck', detail: defErrMsg, stuck_fields: stuckDefaults });
                     callback({
                         success: false,
                         error: 'default_values_stuck',
                         error_detail: defErrMsg,
                         stuck_fields: stuckDefaults,
                         written: mapResult.written
                     });
                     return;
                 }

                console.log('[AI_BRIDGE] 参数校验通过（第' + (tries + 1) + '次尝试），点击计算按钮');
                _tracePush({
                    step: 'bridge_t_calc_click',
                    retries: tries,
                    dom_values: {
                        b: _domVal('t_b'), h: _domVal('t_h'), bf: _domVal('t_bf'),
                        hf: _domVal('t_hf'), con: _domVal('t_con'), reb: _domVal('t_reb'),
                        As: _domVal('t_As'), as: _domVal('t_as')
                    }
                });
                clickBtn('t_calc');
                readResult('_BT_RESULT', 't_result', mapBeamTResult, function(res) {
                    if (res.success) {
                        console.log('[AI_RESULT] beam-t Mu=' + (res.result && res.result.results && res.result.results.capacity ? res.result.results.capacity.Mu : 'N/A') + ' kN·m');
                        _tracePush({ step: 'bridge_result_success', Mu: res.result && res.result.results && res.result.results.capacity ? res.result.results.capacity.Mu : null });
                    } else {
                        _tracePush({ step: 'bridge_result_error', error: res.error || 'unknown' });
                    }
                    callback(res);
                });
            }
            tryFillAndCalc();
        },
        // 结果映射
        result_mapping: mapBeamTResult
    };

    // T形梁正截面结果映射：从 window._BT_RESULT 提取结构化结果
    function mapBeamTResult(r) {
        var warnings = [];
        if (r.over) warnings.push('超筋破坏：ξ > ξb，应按界限承载力估算（GB 6.2.10）');
        if (!r.isUnder) warnings.push('少筋：As < ρmin·b·h，不满足 GB 50010 第 8.5.1 条');

        var out = {
            success: true,
            tool_id: 'beam-t',
            inputs: {
                b: r.b, h: r.h, bf: r.bf, hf: r.hf,
                a_s: r.asV, As: r.As,
                concrete: r.conGrade, steel: r.rebGrade
            },
            results: {
                basic: {
                    b: r.b, h: r.h, h0: r.h0,
                    bf: r.bf, hf: r.hf,
                    a_s: r.asV, As: r.As,
                    concrete: r.conGrade, steel: r.rebGrade,
                    section_type: r.type // '第一类' 或 '第二类'
                },
                material: {
                    fc: r.fc, ft: r.ft, fy: r.fy,
                    alpha1: r.alpha1, beta1: r.beta1, es: r.es, ecu: r.ecu
                },
                capacity: {
                    Mu: r.Mu,
                    x: r.x,
                    xi: r.xi,
                    xi_b: r.xi_b,
                    over_reinforced: r.over,
                    section_type: r.type
                },
                rebar_check: {
                    rho: r.rho,
                    rho_min: r.rho_min,
                    As_min: r.AsMin,
                    meets_min: r.isUnder
                }
            },
            conclusion: r.stMsg,
            warnings: warnings,
            verdict: { status: r.stCls === 'badge-ok' ? 'ok' : (r.stCls === 'badge-warn' ? 'warn' : 'err'), message: r.stMsg },
            overall_ok: r.stCls === 'badge-ok',
            items: []
        };

        out.items.push({
            name: 'T形截面类型',
            value: r.type,
            unit: '',
            ok: true,
            note: r.type === '第一类' ? 'x ≤ hf，按 bf 矩形计算' : 'x > hf，翼缘+腹板两部分计算'
        });
        out.items.push({
            name: '正截面受弯承载力 Mu',
            capacity: r.Mu,
            unit: 'kN·m',
            ok: !r.over,
            note: r.over ? '超筋，按界限估算' : '适筋'
        });
        out.items.push({
            name: '相对受压区高度 ξ',
            value: r.xi,
            limit: r.xi_b,
            unit: '',
            ok: !r.over,
            note: r.over ? 'ξ > ξb 超筋' : 'ξ ≤ ξb 适筋'
        });
        out.items.push({
            name: '受压区高度 x',
            value: r.x,
            unit: 'mm',
            ok: true,
            note: r.type === '第一类' ? '第一类：x ≤ hf' : '第二类：x > hf'
        });
        out.items.push({
            name: '配筋率验算（按腹板 b·h0）',
            value: r.As,
            limit: r.AsMin,
            unit: 'mm²',
            ok: r.isUnder,
            note: r.isUnder ? 'As ≥ As,min 满足' : 'As < As,min 少筋'
        });

        return out;
    }

    /* ==========================================================
     *  工具 5：连续梁计算（三弯矩方程）（beam-cont）
     *  原工具位置：src/index.html TOOLS['beam-cont']
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=cb_calc
     *  原结果变量：window._CB_RESULT
     *  输入 DOM id 前缀：cb_
     *  动态输入：cb_n 控制跨数(2~10)，span 输入框 cb_L{i}/cb_g{i}/cb_q{i} 由 renderSpans() 动态生成
     * ========================================================== */
    var TOOL_BEAM_CONT = {
        tool_id: 'beam-cont',
        tool_name: '连续梁计算（三弯矩方程）',
        category: '受弯构件',
        description: '2~10 跨等截面连续梁内力分析（三弯矩方程），含支座与跨中弯矩、剪力、正截面配筋与斜截面配箍。',
        applicable_scenarios: '等截面多跨连续梁在均布荷载下的内力分析与配筋估算。',
        limitations: [
            '仅支持等截面连续梁（EI 常数），两端简支，中间支座连续',
            '荷载按全跨均布加载（基本组合 γG·gk + γQ·qk），未做活载最不利布置',
            '正截面配筋按单筋矩形截面简化估算，仅供初步方案参考',
            '斜截面仅配箍筋，不考虑弯起钢筋',
            '不考虑抗震调整',
            '不做配筋设计，仅计算所需 As 与配箍率'
        ],
        keywords: ['连续梁', '三弯矩', '多跨梁', '连续梁内力', '支座弯矩', '跨中弯矩', '连续梁配筋', '连续梁剪力'],
        related_standards: [
            { standard: 'GB 50010', articles: ['6.2.10', '8.5.1'], note: '正截面受弯·最小配筋率' }
        ],
        // ===== 工具级安全门：数组长度 + 数值范围校验 =====
        validateParams: function (provided) {
            var errors = [];
            var n = parseInt(provided.n);
            if (isNaN(n) || n < 2 || n > 10) {
                errors.push('跨数 n 必须为 2~10 的整数（当前: ' + provided.n + '）');
                return { pass: false, errors: errors };
            }

            var spans = provided.spans || provided.L || [];
            var gk = provided.gk || [];
            var qk = provided.qk || [];

            // 数组长度必须等于 n
            if (Array.isArray(spans) && spans.length !== n) {
                errors.push('已识别为 ' + n + ' 跨但只提供 ' + spans.length + ' 个跨度，请补充完整跨度值');
            }
            if (Array.isArray(gk) && gk.length !== n) {
                errors.push('已识别为 ' + n + ' 跨但只提供 ' + gk.length + ' 个恒载值，请补充完整恒载值');
            }
            if (Array.isArray(qk) && qk.length !== n) {
                errors.push('已识别为 ' + n + ' 跨但只提供 ' + qk.length + ' 个活载值，请补充完整活载值');
            }
            if (errors.length > 0) return { pass: false, errors: errors };

            // 数值合法性：所有跨度 > 0，gk >= 0，qk >= 0
            if (Array.isArray(spans)) {
                for (var i = 0; i < spans.length; i++) {
                    var v = parseFloat(spans[i]);
                    if (!(v > 0)) { errors.push('第 ' + (i+1) + ' 跨跨度必须为正数'); break; }
                }
            }
            if (Array.isArray(gk)) {
                for (var j = 0; j < gk.length; j++) {
                    var gv = parseFloat(gk[j]);
                    if (isNaN(gv) || gv < 0) { errors.push('第 ' + (j+1) + ' 跨恒载不能为负或非法'); break; }
                }
            }
            if (Array.isArray(qk)) {
                for (var k = 0; k < qk.length; k++) {
                    var qv = parseFloat(qk[k]);
                    if (isNaN(qv) || qv < 0) { errors.push('第 ' + (k+1) + ' 跨活载不能为负或非法'); break; }
                }
            }

            // b / h / a_s 正数校验
            var b = parseFloat(provided.b);
            var h = parseFloat(provided.h);
            var asV = parseFloat(provided.a_s);
            if (!(b > 0)) errors.push('梁宽 b 必须为正数');
            if (!(h > 0)) errors.push('梁高 h 必须为正数');
            if (!(asV > 0)) errors.push('a_s 必须为正数');
            if (b > 0 && h > 0 && asV > 0 && asV >= h) errors.push('a_s 必须小于 h');

            // 分项系数正数校验
            if (!(parseFloat(provided.gammaG) > 0)) errors.push('γG 必须为正数');
            if (!(parseFloat(provided.gammaQ) > 0)) errors.push('γQ 必须为正数');

            return { pass: errors.length === 0, errors: errors };
        },
        adapter_ready: true,
        required_parameters: [
            { name: 'n', label: '跨数 n', type: 'number', unit: '跨', required: true, default: 3,
              aliases: ['n', '跨数', 'span_count', 'spans_count'],
              description: '连续梁跨数，2~10 跨。与 spans/gk/qk 数组长度必须一致。' },
            { name: 'spans', label: '各跨跨度', type: 'array', unit: 'm', required: true, default: [4.5, 5.0, 4.5],
              aliases: ['spans', 'L', '跨度', '各跨跨度', '跨长', 'L数组'],
              description: '每跨跨度数组 L[0..n-1]，单位 m。数组长度必须等于跨数 n。' },
            { name: 'b', label: '梁宽 b', type: 'number', unit: 'mm', required: true, default: 250,
              aliases: ['b', '梁宽', '截面宽', '截面宽度', '梁截面宽'],
              description: '矩形截面宽度，单位 mm。' },
            { name: 'h', label: '梁高 h', type: 'number', unit: 'mm', required: true, default: 600,
              aliases: ['h', '梁高', '截面高', '截面高度', '梁截面高'],
              description: '矩形截面总高度，单位 mm。不是 h0（有效高度）。' },
            { name: 'a_s', label: '受拉钢筋合力点距 a_s', type: 'number', unit: 'mm', required: true, default: 40,
              aliases: ['a_s', 'as', 'as_value', '保护层as', '钢筋合力点距', '受拉筋合力点距'],
              description: '受拉钢筋合力点到受拉边缘的距离，单位 mm。h0 = h − a_s。不要与配筋面积 As 混淆。' },
            { name: 'concrete', label: '混凝土强度等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土等级', '砼等级', '混凝土强度等级'],
              description: 'C20 / C25 / C30 / C35 / C40 / C45 / C50。' },
            { name: 'steel', label: '纵向钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['steel', 'reb', '钢筋', '钢筋级别', '钢筋等级', '纵向钢筋', '主筋', '纵筋'],
              description: 'HRB400 或 HRB500。' },
            { name: 'stirrup_steel', label: '箍筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['stirrup_steel', 'stir', '箍筋', '箍筋级别', '箍筋等级', '箍'],
              description: 'HPB300 / HRB400 / HRB500。' },
            { name: 'gk', label: '各跨恒载标准值 gk', type: 'array', unit: 'kN/m', required: true, default: [12, 12, 12],
              aliases: ['gk', 'g_k', '恒载', '恒荷载', '恒载标准值', '永久荷载', 'dead_load'],
              description: '每跨恒载标准值数组 gk[0..n-1]，单位 kN/m。长度必须等于跨数 n。' },
            { name: 'qk', label: '各跨活载标准值 qk', type: 'array', unit: 'kN/m', required: true, default: [8, 8, 8],
              aliases: ['qk', 'q_k', '活载', '活荷载', '活载标准值', '可变荷载', 'live_load'],
              description: '每跨活载标准值数组 qk[0..n-1]，单位 kN/m。长度必须等于跨数 n。' },
            { name: 'gammaG', label: '恒载分项系数 γG', type: 'number', unit: '', required: true, default: 1.2,
              aliases: ['gammaG', 'γG', 'gamma_g', '恒载分项系数', 'γ_G'],
              description: '永久荷载分项系数，默认 1.2。' },
            { name: 'gammaQ', label: '活载分项系数 γQ', type: 'number', unit: '', required: true, default: 1.4,
              aliases: ['gammaQ', 'γQ', 'gamma_q', '活载分项系数', 'γ_Q'],
              description: '可变荷载分项系数，默认 1.4。' }
        ],
        optional_parameters: [],
        // 静态参数的 DOM 映射（跨参数 cb_L{i}/cb_g{i}/cb_q{i} 由 bridge 动态写入）
        parameter_mapping: {
            n:        { domId: 'cb_n',   unit: '跨' },
            b:        { domId: 'cb_b',   unit: 'mm' },
            h:        { domId: 'cb_h',   unit: 'mm' },
            a_s:      { domId: 'cb_as',  unit: 'mm' },
            concrete: { domId: 'cb_con', unit: '' },
            steel:    { domId: 'cb_reb', unit: '' },
            stirrup_steel: { domId: 'cb_stir', unit: '' },
            gammaG:   { domId: 'cb_gG',  unit: '' },
            gammaQ:   { domId: 'cb_gQ',  unit: '' }
        },
        // ===== bridge：填值 → 触发 span 渲染 → 写跨参数 → DOM verify → 点计算 → 读结果 =====
        bridge: function (params, callback) {
            _tracePush({ step: 'bridge_entry', tool: 'beam-cont', params_keys: Object.keys(params) });

            var self = this;
            var staticMapping = self.parameter_mapping;
            var nVal = parseInt(params.n);
            if (!nVal || nVal < 2 || nVal > 10) {
                var errMsg = '跨数 n=' + params.n + ' 不合法，必须为 2~10 的整数。';
                _tracePush({ step: 'bridge_error_span_count', error: errMsg });
                callback({ success: false, error: 'invalid_span_count', error_detail: errMsg });
                return;
            }

            // ========== 阶段 1：写静态参数（尤其是 cb_n），触发跨数渲染 ==========
            var staticParams = {};
            ['n', 'b', 'h', 'a_s', 'concrete', 'steel', 'stirrup_steel', 'gammaG', 'gammaQ'].forEach(function (k) {
                if (params[k] !== undefined && params[k] !== null && params[k] !== '') staticParams[k] = params[k];
            });
            // 先只写 cb_n 触发 renderSpans（b/h/as/con 等稍后写）
            var nMap = { n: staticMapping.n };
            var nWrite = applyParamsToDOM({ n: nVal }, nMap);
            _tracePush({ step: 'bridge_dom_write', written_keys: ['n'], n_value: nVal });

            if (!nWrite.written || nWrite.written.n === undefined) {
                _tracePush({ step: 'bridge_span_render_failed', error: 'cb_n 写入失败' });
                callback({ success: false, error: 'cb_n_write_failed' });
                return;
            }

            // ========== 阶段 2：等待动态 span 输入框渲染完成 ==========
            _tracePush({ step: 'bridge_span_render_start', n: nVal, waiting_for: 'cb_L' + (nVal - 1) });
            var renderTries = 0;
            var maxRenderTries = 15;
            var renderInterval = 30;

            function waitForSpans() {
                var lastL = document.getElementById('cb_L' + (nVal - 1));
                var lastG = document.getElementById('cb_g' + (nVal - 1));
                var lastQ = document.getElementById('cb_q' + (nVal - 1));
                if (lastL && lastG && lastQ) {
                    _tracePush({ step: 'bridge_span_render_done', n: nVal, tries: renderTries });
                    writeSpanParams();
                    return;
                }
                renderTries++;
                if (renderTries >= maxRenderTries) {
                    var failMsg = '动态跨参数DOM渲染超时（' + renderTries + '次重试），末位元素 cb_L' + (nVal - 1) + ' 未找到。';
                    _tracePush({ step: 'bridge_span_render_failed', error: failMsg, retries: renderTries });
                    callback({ success: false, error: 'span_render_timeout', error_detail: failMsg });
                    return;
                }
                setTimeout(waitForSpans, renderInterval);
            }
            setTimeout(waitForSpans, 20);

            // ========== 阶段 3：写各跨 L/gk/qk + 其余静态参数 ==========
            function writeSpanParams() {
                var Larr = params.spans || params.L || [];
                var gkArr = params.gk || [];
                var qkArr = params.qk || [];

                // 数组长度安全门（前端安全门双保险）
                if (Larr.length !== nVal || gkArr.length !== nVal || qkArr.length !== nVal) {
                    var lenErr = '数组长度不匹配：n=' + nVal +
                        ', spans.length=' + Larr.length +
                        ', gk.length=' + gkArr.length +
                        ', qk.length=' + qkArr.length;
                    _tracePush({ step: 'bridge_array_length_mismatch', error: lenErr });
                    callback({ success: false, error: 'array_length_mismatch', error_detail: lenErr });
                    return;
                }

                // 写各跨参数
                var spanWritten = { L: [], gk: [], qk: [] };
                var spanMismatches = [];
                for (var i = 0; i < nVal; i++) {
                    // L[i]
                    var elL = document.getElementById('cb_L' + i);
                    if (elL) {
                        elL.value = Larr[i];
                        try { elL.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                        try { elL.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                        if (parseFloat(elL.value) === parseFloat(Larr[i])) {
                            spanWritten.L.push(i);
                        } else {
                            spanMismatches.push('L[' + i + ']: expected=' + Larr[i] + ', actual=' + elL.value);
                        }
                    } else {
                        spanMismatches.push('cb_L' + i + ' 不存在');
                    }
                    // gk[i]
                    var elG = document.getElementById('cb_g' + i);
                    if (elG) {
                        elG.value = gkArr[i];
                        try { elG.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                        try { elG.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                        if (parseFloat(elG.value) === parseFloat(gkArr[i])) {
                            spanWritten.gk.push(i);
                        } else {
                            spanMismatches.push('gk[' + i + ']: expected=' + gkArr[i] + ', actual=' + elG.value);
                        }
                    } else {
                        spanMismatches.push('cb_g' + i + ' 不存在');
                    }
                    // qk[i]
                    var elQ = document.getElementById('cb_q' + i);
                    if (elQ) {
                        elQ.value = qkArr[i];
                        try { elQ.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                        try { elQ.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                        if (parseFloat(elQ.value) === parseFloat(qkArr[i])) {
                            spanWritten.qk.push(i);
                        } else {
                            spanMismatches.push('qk[' + i + ']: expected=' + qkArr[i] + ', actual=' + elQ.value);
                        }
                    } else {
                        spanMismatches.push('cb_q' + i + ' 不存在');
                    }
                }

                // 写其余静态参数（b/h/as/con/reb/stir/gG/gQ）
                var otherParams = {};
                ['b', 'h', 'a_s', 'concrete', 'steel', 'stirrup_steel', 'gammaG', 'gammaQ'].forEach(function (k) {
                    if (staticParams[k] !== undefined) otherParams[k] = staticParams[k];
                });
                var otherWrite = applyParamsToDOM(otherParams, staticMapping);

                _tracePush({
                    step: 'bridge_dom_write_done',
                    span_L_count: spanWritten.L.length,
                    span_gk_count: spanWritten.gk.length,
                    span_qk_count: spanWritten.qk.length,
                    other_written: Object.keys(otherWrite.written || {}),
                    span_mismatches: spanMismatches.length
                });

                // ========== 阶段 4：DOM 逐项 verify ==========
                var verifyFailures = [];
                // 静态项回读
                ['n', 'b', 'h', 'a_s', 'concrete', 'steel', 'stirrup_steel', 'gammaG', 'gammaQ'].forEach(function (k) {
                    var domId = staticMapping[k].domId;
                    var el = document.getElementById(domId);
                    if (!el) { verifyFailures.push(k + '(' + domId + '): 元素不存在'); return; }
                    var expected = otherParams.hasOwnProperty(k) ? otherParams[k] : (k === 'n' ? nVal : undefined);
                    if (k === 'n') expected = nVal;
                    if (expected === undefined) return;
                    var actual = el.value;
                    var numExp = parseFloat(expected);
                    var numAct = parseFloat(actual);
                    var ok = false;
                    if (!isNaN(numExp) && !isNaN(numAct)) ok = Math.abs(numExp - numAct) < 0.001;
                    else ok = String(expected) === String(actual);
                    if (!ok) verifyFailures.push(k + ': expected=' + expected + ', actual=' + actual);
                });
                // 跨参数回读
                for (var vi = 0; vi < nVal; vi++) {
                    var elL2 = document.getElementById('cb_L' + vi);
                    var elG2 = document.getElementById('cb_g' + vi);
                    var elQ2 = document.getElementById('cb_q' + vi);
                    if (!elL2 || !elG2 || !elQ2) {
                        verifyFailures.push('span ' + vi + ': DOM 缺失');
                        continue;
                    }
                    if (parseFloat(elL2.value) !== parseFloat(Larr[vi])) verifyFailures.push('L[' + vi + ']=' + elL2.value + '≠' + Larr[vi]);
                    if (parseFloat(elG2.value) !== parseFloat(gkArr[vi])) verifyFailures.push('gk[' + vi + ']=' + elG2.value + '≠' + gkArr[vi]);
                    if (parseFloat(elQ2.value) !== parseFloat(qkArr[vi])) verifyFailures.push('qk[' + vi + ']=' + elQ2.value + '≠' + qkArr[vi]);
                }

                if (spanMismatches.length > 0 || otherWrite.mismatches.length > 0 || verifyFailures.length > 0) {
                    var allFails = spanMismatches.concat(otherWrite.mismatches || []).concat(verifyFailures);
                    _tracePush({
                        step: 'bridge_dom_verify_failed',
                        failures: allFails.slice(0, 10),
                        failure_count: allFails.length
                    });
                    callback({
                        success: false,
                        error: 'dom_verify_failed',
                        error_detail: 'DOM 回读校验失败：' + allFails.slice(0, 5).join('；'),
                        failures: allFails,
                        span_written: spanWritten,
                        other_written: otherWrite.written
                    });
                    return;
                }
                _tracePush({ step: 'bridge_dom_verify_passed', n: nVal });

                // ========== 阶段 5：点击计算 ==========
                var calcBtn = document.getElementById('cb_calc');
                if (!calcBtn) {
                    _tracePush({ step: 'bridge_result_failed', error: 'cb_calc 按钮不存在' });
                    callback({ success: false, error: 'calc_button_not_found' });
                    return;
                }
                _tracePush({ step: 'continuous_beam_calc_click', n: nVal });
                calcBtn.click();

                // ========== 阶段 6：读结果 ==========
                setTimeout(function () {
                    var raw = window._CB_RESULT;
                    var errEl = document.querySelector('#cb_sup .error-box');
                    var errMsg = errEl ? errEl.textContent : '';

                    if (errMsg) {
                        _tracePush({ step: 'bridge_result_failed', error: errMsg.substring(0, 80) });
                        callback({ success: false, error: 'calculation_error', error_detail: errMsg, raw: raw });
                        return;
                    }
                    if (!raw) {
                        _tracePush({ step: 'bridge_result_failed', error: '_CB_RESULT 为空' });
                        callback({ success: false, error: 'result_not_found', error_detail: 'window._CB_RESULT 未生成' });
                        return;
                    }

                    // Infinity/NaN 校验（已知零荷载会除零）
                    var invalidValues = [];
                    function checkFinite(val, name) {
                        if (typeof val === 'number' && (!isFinite(val) || isNaN(val))) {
                            invalidValues.push(name);
                        }
                    }
                    if (raw.Msup && raw.Msup.length) {
                        for (var ii = 0; ii < raw.Msup.length; ii++) checkFinite(raw.Msup[ii], 'Msup[' + ii + ']');
                    }
                    if (raw.spanResults) {
                        raw.spanResults.forEach(function (s, si) {
                            checkFinite(s.MmaxPos, 'spanResults[' + si + '].MmaxPos');
                            checkFinite(s.Vleft, 'spanResults[' + si + '].Vleft');
                            checkFinite(s.Vright, 'spanResults[' + si + '].Vright');
                        });
                    }
                    if (raw.rebarResults) {
                        raw.rebarResults.forEach(function (r, ri) {
                            checkFinite(r.As, 'rebarResults[' + ri + '].As');
                        });
                    }
                    if (invalidValues.length > 0) {
                        _tracePush({
                            step: 'bridge_result_invalid',
                            invalid_fields: invalidValues.slice(0, 10),
                            invalid_count: invalidValues.length
                        });
                        callback({
                            success: false,
                            error: 'calculation_result_invalid',
                            error_detail: '计算结果含 Infinity/NaN（可能由零荷载引起），共 ' + invalidValues.length + ' 处。',
                            invalid_fields: invalidValues,
                            raw: raw
                        });
                        return;
                    }

                    // 结构化返回
                    var result = {
                        // 输入摘要
                        n: raw.n,
                        b: raw.b,
                        h: raw.h,
                        h0: raw.h - raw.asV,
                        asV: raw.asV,
                        concrete: raw.conGrade,
                        steel: raw.rebGrade,
                        stirrup_steel: raw.stirGrade,
                        gammaG: raw.gG,
                        gammaQ: raw.gQ,
                        spans: raw.L,
                        gk: raw.gk,
                        qk: raw.qk,
                        qDesign: raw.qDesign,

                        // 支座弯矩（数组，长度 n+1，两端=0）
                        support_moments: raw.Msup,

                        // 各跨内力
                        span_results: raw.spanResults.map(function (s) {
                            return {
                                Rl: s.Rl, Rr: s.Rr,
                                MmaxPos: s.MmaxPos,
                                MmaxNeg: s.MmaxNeg,
                                xMax: s.xMax,
                                Vleft: s.Vleft,
                                Vright: s.Vright,
                                VmaxAbs: s.VmaxAbs
                            };
                        }),

                        // 正截面配筋（含支座负弯矩 + 跨中正弯矩）
                        rebar_results: raw.rebarResults.map(function (r) {
                            return {
                                location: r.loc,
                                M: r.M,
                                As: r.As,
                                rho: r.rho,
                                over_reinforced: r.over,
                                gamma_s: r.gamma_s
                            };
                        }),

                        // 斜截面配箍
                        shear_results: raw.shearResults.map(function (s) {
                            return {
                                span: s.span,
                                Vl: s.Vl, Vr: s.Vr,
                                Vmax: s.Vmax,
                                section_ok: s.secOk,
                                need_Asv_s: s.needAsv_s,
                                rho_sv_min: s.rsvMin
                            };
                        }),

                        // 整梁指标
                        Vc: raw.Vc,
                        Vmax_section: raw.Vmax,
                        As_min: raw.AsMin,
                        rho_min: raw.rho_min,
                        all_flex_ok: raw.allFlexOk,
                        all_shear_ok: raw.allShearOk,

                        // 极值摘要
                        max_neg_moment: Math.min.apply(null, raw.Msup),
                        max_pos_moment: Math.max.apply(null, raw.spanResults.map(function (s) { return s.MmaxPos; })),
                        max_shear: Math.max.apply(null, raw.shearResults.map(function (s) { return s.Vmax; }))
                    };

                    _tracePush({
                        step: 'result_read_success',
                        n: raw.n,
                        support_count: raw.Msup ? raw.Msup.length : 0,
                        max_neg_moment: result.max_neg_moment,
                        max_pos_moment: result.max_pos_moment,
                        max_shear: result.max_shear,
                        all_flex_ok: raw.allFlexOk,
                        all_shear_ok: raw.allShearOk
                    });
                    _tracePush({ step: 'bridge_result_success', tool: 'beam-cont' });
                    callback({ success: true, result: result, raw: raw });
                }, 60);
            }
        },
        result_mapping: {
            '支座弯矩': 'support_moments',
            '各跨最大正弯矩': 'span_results[*].MmaxPos',
            '各跨剪力': 'span_results[*].Vleft/Vright',
            '正截面配筋': 'rebar_results',
            '斜截面配箍': 'shear_results'
        }
    };

    /* ==========================================================
     *  工具 6：柱下独立基础计算（footing-col）
     *  占位
     * ========================================================== */
    var TOOL_FOOTING_COL = {
        tool_id: 'footing-col',
        tool_name: '柱下独立基础计算',
        category: '地基基础',
        description: '轴心/偏心受压独立基础：基底面积确定、地基承载力验算、冲切验算、底板双向配筋。',
        applicable_scenarios: '柱下扩展基础的地基承载力、冲切、底板配筋验算。',
        limitations: [
            '仅支持单向弯矩（沿长边 L 方向），不支持双向受弯',
            '冲切力采用偏保守的简化估算，仅供初判；精确计算应按 GB 50007-2011 冲切破坏锥体形状详细推导',
            '不考虑抗震调整',
            '不进行基础底面积自动设计，需用户给定 B×L 尺寸'
        ],
        keywords: ['独立基础', '柱下独立基础', '柱下基础', '扩展基础', '地基', '冲切', '基底面积', '基础配筋', '基础底板', '地基承载力'],
        related_standards: [
            { standard: 'GB 50007', articles: ['5.2.1', '5.2.4', '8.2.8', '8.2.11'], note: '地基承载力·冲切·底板配筋' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'B', label: '基础底面短边 B', type: 'number', unit: 'mm', required: true, default: 2400,
              aliases: ['B', '基础宽', '基础宽度', '基底宽', '基底短边', '底面宽', '底板短边', '基础短边'],
              description: '基础底面短边长度（矩形基础短边，方形基础同 L）。单位 mm，bridge 会自动换算为 m 写入 DOM。别名必须带"基础/基底"前缀，避免与梁宽 b 混淆。' },
            { name: 'L', label: '基础底面长边 L', type: 'number', unit: 'mm', required: true, default: 2400,
              aliases: ['L', '基础长', '基础长度', '基底长', '基底长边', '底面长', '底板长边', '基础长边'],
              description: '基础底面长边长度（弯矩作用方向）。单位 mm，bridge 会自动换算为 m 写入 DOM。' },
            { name: 'h', label: '基础高度 h', type: 'number', unit: 'mm', required: true, default: 600,
              aliases: ['h', '基础高', '基础高度', '基础厚', '基础厚度', '底板厚', '底板高度'],
              description: '基础总高度（锥形基础取边缘高度+坡高，阶梯形取总高）。单位 mm。别名必须带"基础/底板"前缀，避免与梁高 h、板厚 h 混淆。' },
            { name: 'bc', label: '柱截面宽度 bc', type: 'number', unit: 'mm', required: true, default: 400,
              aliases: ['bc', '柱宽', '柱截面宽', '柱截面宽度', 'b_c'],
              description: '柱截面短边（或柱宽）尺寸。单位 mm。' },
            { name: 'hc', label: '柱截面高度 hc', type: 'number', unit: 'mm', required: true, default: 400,
              aliases: ['hc', '柱高', '柱截面高', '柱截面高度', 'h_c'],
              description: '柱截面长边（或柱高）尺寸。单位 mm。' },
            { name: 'N', label: '轴力设计值 N', type: 'number', unit: 'kN', required: true, default: 1600,
              aliases: ['N', '轴力', '轴压力', '轴向力', '轴力设计值', '轴向压力设计值', '柱轴力'],
              description: '上部结构传来的基本组合竖向力设计值。单位 kN。' },
            { name: 'fa', label: '修正后地基承载力 fa', type: 'number', unit: 'kPa', required: true, default: 180,
              aliases: ['fa', 'f_a', '地基承载力', '地基承载力特征值', '承载力特征值', '持力层承载力', 'fa修正', '修正后地基承载力'],
              description: '已进行深度和宽度修正后的地基承载力特征值。单位 kPa。' },
            { name: 'concrete', label: '基础混凝土等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土等级', '砼等级', '基础混凝土'],
              description: '如 C30、C35、C40' },
            { name: 'steel', label: '底板钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['steel', 'reb', '钢筋级别', '钢筋等级', '钢筋牌号', '底板钢筋', '基础钢筋'],
              description: 'HRB400 或 HRB500' }
        ],
        optional_parameters: [
            { name: 'M', label: '弯矩设计值 M', type: 'number', unit: 'kN·m', required: false, default: 100,
              aliases: ['M', '弯矩', '弯矩设计值', '柱底弯矩', '基础弯矩'],
              description: '基本组合弯矩设计值（沿长边 L 方向）。0 为轴心受压。单位 kN·m。' },
            { name: 'Nk', label: '轴力标准值 Nk', type: 'number', unit: 'kN', required: false, default: 1200,
              aliases: ['Nk', 'N_k', '轴力标准值', '标准轴力', '竖向力标准值'],
              description: '上部结构传来的竖向力标准值。单位 kN。未指定时采用工具默认值。' },
            { name: 'Mk', label: '弯矩标准值 Mk', type: 'number', unit: 'kN·m', required: false, default: 80,
              aliases: ['Mk', 'M_k', '弯矩标准值', '标准弯矩'],
              description: '作用在基础顶面的弯矩标准值。单位 kN·m。未指定时采用工具默认值。' },
            { name: 'd', label: '基础埋深 d', type: 'number', unit: 'm', required: false, default: 1.8,
              aliases: ['d', '埋深', '基础埋深', 'd_buried', '基础埋置深度'],
              description: '从室外地面到基础底面的距离。单位 m。未指定时采用工具默认值 1.8m。' },
            { name: 'gammaG', label: '基础及覆土重度 γG', type: 'number', unit: 'kN/m³', required: false, default: 20,
              aliases: ['gammaG', 'γG', 'gamma_g', '土重度', '基础及覆土重度', '覆土重度'],
              description: '基础自重与上覆土的加权平均重度。地下水位以下取浮重度。单位 kN/m³。未指定时采用默认值 20。' },
            { name: 'h0', label: '基础有效高度 h0', type: 'number', unit: 'mm', required: false, default: 560,
              aliases: ['h0', 'h_0', '有效高度', '基础有效高度', '底板有效高度'],
              description: '基础底板有效高度。有垫层取 h−40，无垫层取 h−70。单位 mm。未指定时采用工具默认值（h−40）。' }
        ],
        // AI参数名 → 真实DOM id 的映射
        // 注意：B/L 用户输入是 mm，DOM fc_B/fc_L 是 m，需 /1000 换算
        parameter_mapping: {
            B:        { domId: 'fc_B',   unit: 'm',  transform: function (v) { return parseFloat(v) / 1000; } },
            L:        { domId: 'fc_L',   unit: 'm',  transform: function (v) { return parseFloat(v) / 1000; } },
            h:        { domId: 'fc_h',   unit: 'mm' },
            bc:       { domId: 'fc_bc',  unit: 'mm' },
            hc:       { domId: 'fc_hc',  unit: 'mm' },
            N:        { domId: 'fc_N',   unit: 'kN' },
            fa:       { domId: 'fc_fa',  unit: 'kPa' },
            concrete: { domId: 'fc_con', unit: '' },
            steel:    { domId: 'fc_reb', unit: '' },
            M:        { domId: 'fc_M',   unit: 'kN·m' },
            Nk:       { domId: 'fc_Nk',  unit: 'kN' },
            Mk:       { domId: 'fc_Mk',  unit: 'kN·m' },
            d:        { domId: 'fc_d',   unit: 'm' },
            gammaG:   { domId: 'fc_gammaG', unit: 'kN/m³' },
            h0:       { domId: 'fc_h0',  unit: 'mm' }
        },
        // 桥接：填值→校验→点计算→读结果
        bridge: function (params, callback) {
            _tracePush({ step: 'bridge_entry', tool: 'footing-col', params_keys: Object.keys(params) });
            var mapping = this.parameter_mapping;
            var required = this.required_parameters || [];
            var tries = 0;
            var maxTries = 10;
            var retryInterval = 30;

            function tryFillAndCalc() {
                var mapResult = applyParamsToDOM(params, mapping);
                _tracePush({
                    step: 'bridge_dom_write_try' + (tries + 1),
                    written_keys: Object.keys(mapResult.written || {}),
                    mismatches: mapResult.mismatches || [],
                    missing_params: mapResult.missing_params || []
                });

                // 必填项DOM回读校验：每个必填参数必须成功写入DOM
                var missingDom = [];
                required.forEach(function (p) {
                    if (mapResult.written[p.name] === undefined) {
                        missingDom.push(p.name);
                    }
                });

                if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                    tries++;
                    if (tries < maxTries) {
                        setTimeout(tryFillAndCalc, retryInterval);
                        return;
                    }
                    var errMsg = '参数映射失败（重试' + tries + '次仍未通过），已中止计算。' +
                        (missingDom.length > 0 ? ' 缺失DOM: ' + missingDom.join(', ') + '。' : '') +
                        (mapResult.mismatches.length > 0 ? ' 回读不一致: ' + mapResult.mismatches.join('；') + '。' : '');
                    console.error('[AI_BRIDGE] footing-col 映射失败:', errMsg);
                    _tracePush({ step: 'bridge_error_mapping', error: errMsg, missing_dom: missingDom, mismatches: mapResult.mismatches, retries: tries });
                    callback({
                        success: false,
                        error: 'mapping_mismatch',
                        error_detail: errMsg,
                        missing_dom: missingDom,
                        mismatches: mapResult.mismatches,
                        written: mapResult.written
                    });
                    return;
                }

                // ===== 独立基础默认值安全门 =====
                // 必填项用户值与默认值不同，但 DOM 回读仍为默认值 → 写值失败，严禁点calc
                var defaults = { B: 2.4, L: 2.4, h: 600, bc: 400, hc: 400, N: 1600, fa: 180, concrete: 'C30', steel: 'HRB400' };
                var stuckDefaults = [];
                required.forEach(function (p) {
                    var userVal = params[p.name];
                    var domVal = mapResult.written[p.name];
                    if (userVal !== undefined && defaults[p.name] !== undefined) {
                        var userNum = parseFloat(userVal);
                        var defNum = parseFloat(defaults[p.name]);
                        var domNum = parseFloat(domVal);
                        if (!isNaN(userNum) && !isNaN(defNum) && !isNaN(domNum)) {
                            if (Math.abs(userNum - defNum) > 0.001 && Math.abs(domNum - defNum) < 0.001) {
                                stuckDefaults.push(p.name);
                            }
                        } else if (String(userVal) !== String(defaults[p.name]) && String(domVal) === String(defaults[p.name])) {
                            stuckDefaults.push(p.name);
                        }
                    }
                });
                if (stuckDefaults.length > 0) {
                    var defErrMsg = '独立基础bridge写值失败：以下字段回读仍为默认值，疑似DOM未就绪或id不匹配：' + stuckDefaults.join('、') + '。已中止，未点击计算。';
                    console.error('[AI_BRIDGE] ' + defErrMsg);
                    _tracePush({ step: 'bridge_result_error', error: 'default_values_stuck', detail: defErrMsg, stuck_fields: stuckDefaults });
                    callback({
                        success: false,
                        error: 'default_values_stuck',
                        error_detail: defErrMsg,
                        stuck_fields: stuckDefaults,
                        written: mapResult.written
                    });
                    return;
                }

                _tracePush({
                    step: 'bridge_dom_verify',
                    retries: tries,
                    result: 'pass'
                });

                console.log('[AI_BRIDGE] footing-col 参数校验通过（第' + (tries + 1) + '次尝试），点击计算按钮');
                _tracePush({
                    step: 'footing_calc_click',
                    retries: tries,
                    dom_values: {
                        B: _domVal('fc_B'), L: _domVal('fc_L'), h: _domVal('fc_h'),
                        bc: _domVal('fc_bc'), hc: _domVal('fc_hc'),
                        N: _domVal('fc_N'), fa: _domVal('fc_fa'),
                        con: _domVal('fc_con'), reb: _domVal('fc_reb'),
                        M: _domVal('fc_M'), Nk: _domVal('fc_Nk'), Mk: _domVal('fc_Mk'),
                        d: _domVal('fc_d'), gammaG: _domVal('fc_gammaG'), h0: _domVal('fc_h0')
                    }
                });
                clickBtn('fc_calc');
                readFootingResult(function(res) {
                    if (res.success) {
                        console.log('[AI_RESULT] footing-col A=' + (res.result && res.result.results && res.result.results.soil ? res.result.results.soil.A : 'N/A') + ' m²');
                        // 检查用户是否传入了 My（双向弯矩），本工具仅支持单向 M
                        var hasMy = false;
                        var paramKeys = Object.keys(params || {});
                        for (var ki = 0; ki < paramKeys.length; ki++) {
                            if (/^my$/i.test(paramKeys[ki]) && params[paramKeys[ki]] !== undefined && params[paramKeys[ki]] !== null && params[paramKeys[ki]] !== '') {
                                hasMy = true;
                                break;
                            }
                        }
                        if (hasMy) {
                            res.result.warnings = res.result.warnings || [];
                            res.result.warnings.push('当前独立基础工具仅支持单向弯矩（沿长边 L 方向的 M），My 已忽略。如需双向受弯请用其他方法复核。');
                        }
                        _tracePush({
                            step: 'bridge_result_success',
                            A: res.result && res.result.results && res.result.results.soil ? res.result.results.soil.A : null,
                            pk: res.result && res.result.results && res.result.results.soil ? res.result.results.soil.pk : null,
                            soilOk: res.result && res.result.results && res.result.results.soil ? res.result.results.soil.soilOk : null,
                            has_my: hasMy
                        });
                    } else {
                        _tracePush({ step: 'bridge_result_error', error: res.error || 'unknown' });
                    }
                    callback(res);
                });
            }
            tryFillAndCalc();
        },
        result_mapping: null
    };

    // 柱下独立基础结果读取：优先读 window._FC_RESULT；失败 fallback 从 DOM 结果区按 label 提取
    function readFootingResult(callback) {
        setTimeout(function () {
            // 1) 优先读全局结果对象
            var r = window._FC_RESULT;
            if (r && typeof r.A === 'number' && !isNaN(r.A)) {
                _tracePush({
                    step: 'result_read_success',
                    source: '_FC_RESULT',
                    A: r.A, pk: r.pk, pkmax: r.pkmax,
                    soilOk: r.soilOk, punchOk: r.punchOk
                });
                callback({
                    success: true,
                    result: buildFootingResultFromGlobal(r),
                    raw: r
                });
                return;
            }

            // 2) fallback: 从 DOM 结果区按 label 解析
            var errEl = document.querySelector('#fc_soil .error-box');
            if (errEl && errEl.textContent) {
                callback({ success: false, error: errEl.textContent, raw: null });
                return;
            }
            var soilEl = document.getElementById('fc_soil');
            if (!soilEl || !soilEl.innerHTML) {
                callback({ success: false, error: '计算未返回结果', raw: null });
                return;
            }
            var soilParsed = _parseResultItems(soilEl);
            var punchEl = document.getElementById('fc_punch');
            var punchParsed = punchEl ? _parseResultItems(punchEl) : {};
            var rebarEl = document.getElementById('fc_rebar');
            var rebarParsed = rebarEl ? _parseResultItems(rebarEl) : {};

            _tracePush({
                step: 'result_read_success',
                source: 'dom_fallback',
                A: soilParsed.A, pk: soilParsed.pk, pkmax: soilParsed.pkmax
            });

            var soilOk = soilParsed.verdictStatus === 'ok';
            var punchOk = punchParsed.verdictStatus === 'ok';
            var overallOk = soilOk && punchOk;

            var out = {
                success: true,
                tool_id: 'footing-col',
                inputs: {
                    B: _num(_domVal('fc_B')), L: _num(_domVal('fc_L')),
                    h: _num(_domVal('fc_h')), h0: _num(_domVal('fc_h0')),
                    bc: _num(_domVal('fc_bc')), hc: _num(_domVal('fc_hc')),
                    N: _num(_domVal('fc_N')), Nk: _num(_domVal('fc_Nk')),
                    M: _num(_domVal('fc_M')), Mk: _num(_domVal('fc_Mk')),
                    fa: _num(_domVal('fc_fa')), d: _num(_domVal('fc_d')),
                    gammaG: _num(_domVal('fc_gammaG')),
                    concrete: _domVal('fc_con'), steel: _domVal('fc_reb')
                },
                results: {
                    soil: {
                        A: soilParsed.A, Gk: soilParsed.Gk,
                        pk: soilParsed.pk, pkmax: soilParsed.pkmax, pkmin: soilParsed.pkmin,
                        e: soilParsed.e,
                        fa: soilParsed.fa,
                        verdict: soilParsed.verdictText,
                        verdict_status: soilParsed.verdictStatus,
                        soilOk: soilOk
                    },
                    punch: {
                        h0: punchParsed.h0,
                        beta_hp: punchParsed.beta_hp,
                        a_m: punchParsed.a_m,
                        Vup: punchParsed.Fl_u || punchParsed.Vup,
                        Fl: punchParsed.Fl,
                        verdict: punchParsed.verdictText,
                        verdict_status: punchParsed.verdictStatus,
                        punchOk: punchOk
                    },
                    rebar: {
                        AsPerM_B: rebarParsed.AsPerM_B,
                        AsPerM_L: rebarParsed.AsPerM_L,
                        M_B: rebarParsed.M_B,
                        M_L: rebarParsed.M_L
                    }
                },
                conclusion: soilParsed.verdictText || '',
                warnings: [],
                verdict: { status: overallOk ? 'ok' : 'err', message: soilParsed.verdictText || '' },
                overall_ok: overallOk,
                items: []
            };
            out.items.push({ name: '基底面积 A', value: soilParsed.A, unit: 'm²', ok: true });
            out.items.push({ name: '基底平均压力 pk', value: soilParsed.pk, unit: 'kPa', ok: soilOk, note: 'pk ≤ fa 则满足' });
            if (soilParsed.pkmax) out.items.push({ name: '基底最大压力 pkmax', value: soilParsed.pkmax, unit: 'kPa', ok: soilOk, note: 'pkmax ≤ 1.2fa 则满足' });
            out.items.push({ name: '受冲切承载力', value: punchParsed.Fl_u || punchParsed.Vup, unit: 'kN', ok: punchOk, note: 'Fl ≤ 承载力 则满足' });
            callback({ success: true, result: out, raw: { soil: soilParsed, punch: punchParsed, rebar: rebarParsed } });
        }, 80);
    }

    // 从 window._FC_RESULT 构造结构化结果对象（与 DOM fallback 输出结构完全一致）
    function buildFootingResultFromGlobal(r) {
        var soilOk = !!r.soilOk;
        var punchOk = !!r.punchOk;
        var overallOk = soilOk && punchOk;

        var out = {
            success: true,
            tool_id: 'footing-col',
            inputs: {
                B: r.B, L: r.L,
                h: r.h, h0: r.h0,
                bc: r.bc, hc: r.hc,
                N: r.N, Nk: r.Nk,
                M: r.M, Mk: r.Mk,
                fa: r.fa, d: r.d,
                gammaG: r.gammaG,
                concrete: r.conGrade, steel: r.rebGrade
            },
            results: {
                soil: {
                    A: r.A, Gk: r.Gk,
                    pk: r.pk, pkmax: r.pkmax, pkmin: r.pkmin,
                    e: r.e,
                    fa: r.fa,
                    fa_1_2: 1.2 * r.fa,
                    soilOk: soilOk
                },
                punch: {
                    h0: r.h0,
                    beta_hp: r.beta_hp,
                    Vup: r.Vup_short,
                    Fl: r.Fl_safe,
                    punchOk: punchOk
                },
                rebar: {
                    AsPerM_B: r.AsPerM_B,
                    AsPerM_L: r.AsPerM_L,
                    M_B: r.M_B,
                    M_L: r.M_L,
                    rho_min: r.rho_min,
                    r_B_over: r.r_B ? r.r_B.over : false,
                    r_L_over: r.r_L ? r.r_L.over : false
                }
            },
            conclusion: soilOk ? (punchOk ? '地基承载力与冲切均满足' : '地基承载力满足，冲切不满足') : '地基承载力不满足',
            warnings: [],
            verdict: {
                status: overallOk ? 'ok' : 'err',
                message: soilOk ? (punchOk ? '满足' : '冲切不满足') : '地基承载力不满足'
            },
            overall_ok: overallOk,
            items: []
        };

        out.items.push({ name: '基底面积 A', value: r.A, unit: 'm²', ok: true, note: 'A = B × L' });
        out.items.push({ name: '基础自重及覆土 Gk', value: r.Gk, unit: 'kN', ok: true, note: 'Gk = γG·d·A' });
        out.items.push({ name: '基底平均压力 pk', value: r.pk, unit: 'kPa', ok: soilOk, note: 'pk ≤ fa = ' + r.fa + ' kPa' });
        if (r.pkmax !== undefined && r.pkmax !== null) {
            out.items.push({ name: '基底最大压力 pkmax', value: r.pkmax, unit: 'kPa', ok: soilOk, note: 'pkmax ≤ 1.2fa = ' + (1.2 * r.fa).toFixed(1) + ' kPa' });
            out.items.push({ name: '偏心距 e', value: r.e, unit: 'm', ok: true, note: 'e = Mk / (Nk + Gk)' });
        }
        out.items.push({ name: '受冲切承载力 Fl,u', value: r.Vup_short, unit: 'kN', ok: punchOk, note: '0.7·βhp·ft·am·h0' });
        out.items.push({ name: '冲切力 Fl（估算）', value: r.Fl_safe, unit: 'kN', ok: punchOk, note: '偏保守简化估算' });
        out.items.push({ name: '沿短边（B向）每延米配筋', value: r.AsPerM_B, unit: 'mm²/m', ok: !r.r_B.over && r.AsPerM_B >= r.rho_min * r.B * 1000 * r.h / r.B, note: '柱边弯矩 M_B = ' + r.M_B.toFixed(2) + ' kN·m' });
        out.items.push({ name: '沿长边（L向）每延米配筋', value: r.AsPerM_L, unit: 'mm²/m', ok: !r.r_L.over, note: '柱边弯矩 M_L = ' + r.M_L.toFixed(2) + ' kN·m' });

        return out;
    }

    /* ==========================================================
     *  工具 7：轴心受压柱承载力（column-axial）
     *  原工具位置：src/index.html TOOLS['column-axial']（第 7730 行起）
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=c_calc
     *  原结果变量：window._CA_RESULT（⚠️ 原代码存在未定义变量引用导致挂不上，本适配器改从 DOM 结果区读取）
     *  输入 DOM id 前缀：c_
     * ========================================================== */
    var TOOL_COLUMN_AXIAL = {
        tool_id: 'column-axial',
        tool_name: '轴心受压柱承载力',
        category: '受压构件',
        description: '普通箍筋柱承载力复核与纵筋面积计算，自动按长细比取稳定系数 φ。依据 GB/T 50010-2010（2024年版） 第 6.2.15 条。',
        applicable_scenarios: '已知柱截面、材料、配筋，进行轴心受压承载力复核。',
        limitations: [
            '仅支持矩形截面普通箍筋柱，不支持圆形、环形截面',
            '仅做承载力复核，不做配筋设计',
            '不考虑抗震调整（γRE）'
        ],
        keywords: ['轴心受压柱', '轴心受压', '轴压柱', '受压柱', '柱承载力', '稳定系数', '长细比', '普通箍筋柱'],
        related_standards: [
            { standard: 'GB 50010', articles: ['6.2.15', '8.5.1'], note: '轴心受压构件承载力·最小配筋率' },
            { standard: 'GB 50011', articles: ['6.3.8', '5.4.1'], note: '框架柱抗震构造·承载力调整（抗震适用）' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'b', label: '截面短边 b', type: 'number', unit: 'mm', required: true, default: 400,
              aliases: ['b', '截面短边', '短边', '柱宽', '截面宽', '宽度'],
              description: '矩形截面短边尺寸（回转半径按短边 b 计算长细比）' },
            { name: 'h', label: '截面长边 h', type: 'number', unit: 'mm', required: true, default: 400,
              aliases: ['h', '截面长边', '长边', '柱高', '截面高', '高度'],
              description: '矩形截面长边尺寸' },
            { name: 'l0', label: '计算长度 l0', type: 'number', unit: 'mm', required: true, default: 4000,
              aliases: ['l0', 'l_0', '计算长度', 'lo', '柱计算长度'],
              description: '构件计算长度，框架柱按 GB 6.2.20 取值（如底层 1.0H、其余 1.25H）' },
            { name: 'concrete', label: '混凝土等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土等级', '砼等级'],
              description: '如 C30、C35、C40' },
            { name: 'steel', label: '钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['steel', 'reb', '钢筋级别', '钢筋等级', '钢筋牌号', '纵筋级别', '纵向钢筋级别'],
              description: 'HRB400 或 HRB500' },
            { name: 'As', label: '全部纵筋面积 As', type: 'number', unit: 'mm²', required: true, default: 1256,
              aliases: ['As', '纵筋面积', '全部纵筋', '全部纵筋面积', '配筋面积', '纵向钢筋面积', 'As_prime'],
              description: '全部纵向钢筋总截面面积（受压钢筋）' },
            { name: 'N', label: '轴向压力设计值 N', type: 'number', unit: 'kN', required: true, default: 1500,
              aliases: ['N', '轴力', '轴压力', '轴向压力', '轴力设计值', '轴心压力'],
              description: '轴向压力设计值（含 1.3/1.5 分项系数组合）' }
        ],
        optional_parameters: [],
        // AI参数名 → 真实DOM id 的映射（注意：As → c_AsP，a_s 此工具不需要）
        parameter_mapping: {
            b:        { domId: 'c_b',    unit: 'mm' },
            h:        { domId: 'c_h',    unit: 'mm' },
            l0:       { domId: 'c_l0',   unit: 'mm' },
            concrete: { domId: 'c_con',  unit: '' },
            steel:    { domId: 'c_reb',  unit: '' },
            As:       { domId: 'c_AsP',  unit: 'mm²' },
            N:        { domId: 'c_N',    unit: 'kN' }
        },
        // 桥接：填值→校验→点计算→读结果
        bridge: function (params, callback) {
            _tracePush({ step: 'bridge_entry', tool: 'column-axial', params_keys: Object.keys(params) });
            var mapping = this.parameter_mapping;
            var required = this.required_parameters || [];
            var tries = 0;
            var maxTries = 10;
            var retryInterval = 30;

            function tryFillAndCalc() {
                var mapResult = applyParamsToDOM(params, mapping);
                _tracePush({
                    step: 'bridge_dom_write_try' + (tries + 1),
                    written_keys: Object.keys(mapResult.written || {}),
                    mismatches: mapResult.mismatches || [],
                    missing_params: mapResult.missing_params || []
                });

                // 必填项DOM回读校验：每个必填参数必须成功写入DOM
                var missingDom = [];
                required.forEach(function (p) {
                    if (mapResult.written[p.name] === undefined) {
                        missingDom.push(p.name);
                    }
                });

                if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                    tries++;
                    if (tries < maxTries) {
                        setTimeout(tryFillAndCalc, retryInterval);
                        return;
                    }
                    var errMsg = '参数映射失败（重试' + tries + '次仍未通过），已中止计算。' +
                        (missingDom.length > 0 ? ' 缺失DOM: ' + missingDom.join(', ') + '。' : '') +
                        (mapResult.mismatches.length > 0 ? ' 回读不一致: ' + mapResult.mismatches.join('；') + '。' : '');
                    console.error('[AI_BRIDGE] column-axial 映射失败:', errMsg);
                    _tracePush({ step: 'bridge_error_mapping', error: errMsg, missing_dom: missingDom, mismatches: mapResult.mismatches, retries: tries });
                    callback({
                        success: false,
                        error: 'mapping_mismatch',
                        error_detail: errMsg,
                        missing_dom: missingDom,
                        mismatches: mapResult.mismatches,
                        written: mapResult.written
                    });
                    return;
                }

                // ===== 轴心受压柱默认值安全门 =====
                var defaults = { b: 400, h: 400, l0: 4000, concrete: 'C30', steel: 'HRB400', As: 1256, N: 1500 };
                var stuckDefaults = [];
                required.forEach(function (p) {
                    var userVal = params[p.name];
                    var domVal = mapResult.written[p.name];
                    if (userVal !== undefined && defaults[p.name] !== undefined) {
                        var userNum = parseFloat(userVal);
                        var defNum = parseFloat(defaults[p.name]);
                        var domNum = parseFloat(domVal);
                        if (!isNaN(userNum) && !isNaN(defNum) && !isNaN(domNum)) {
                            if (Math.abs(userNum - defNum) > 0.001 && Math.abs(domNum - defNum) < 0.001) {
                                stuckDefaults.push(p.name);
                            }
                        } else if (String(userVal) !== String(defaults[p.name]) && String(domVal) === String(defaults[p.name])) {
                            stuckDefaults.push(p.name);
                        }
                    }
                });
                if (stuckDefaults.length > 0) {
                    var defErrMsg = '轴心受压柱bridge写值失败：以下字段回读仍为默认值，疑似DOM未就绪或id不匹配：' + stuckDefaults.join('、') + '。已中止，未点击计算。';
                    console.error('[AI_BRIDGE] ' + defErrMsg);
                    _tracePush({ step: 'bridge_result_error', error: 'default_values_stuck', detail: defErrMsg, stuck_fields: stuckDefaults });
                    callback({
                        success: false,
                        error: 'default_values_stuck',
                        error_detail: defErrMsg,
                        stuck_fields: stuckDefaults,
                        written: mapResult.written
                    });
                    return;
                }

                console.log('[AI_BRIDGE] 参数校验通过（第' + (tries + 1) + '次尝试），点击计算按钮');
                _tracePush({
                    step: 'column_calc_click',
                    retries: tries,
                    dom_values: {
                        b: _domVal('c_b'), h: _domVal('c_h'), l0: _domVal('c_l0'),
                        con: _domVal('c_con'), reb: _domVal('c_reb'),
                        As: _domVal('c_AsP'), N: _domVal('c_N')
                    }
                });
                clickBtn('c_calc');
                readColumnResult(function(res) {
                    if (res.success) {
                        console.log('[AI_RESULT] column-axial Nu=' + (res.result && res.result.results && res.result.results.capacity ? res.result.results.capacity.Nu : 'N/A') + ' kN');
                        _tracePush({ step: 'bridge_result_success', Nu: res.result && res.result.results && res.result.results.capacity ? res.result.results.capacity.Nu : null });
                    } else {
                        _tracePush({ step: 'bridge_result_error', error: res.error || 'unknown' });
                    }
                    callback(res);
                });
            }
            tryFillAndCalc();
        },
        // 结果映射（由 DOM 解析函数填充，这里保留占位）
        result_mapping: null
    };

    // 轴心受压柱结果读取：优先读 window._CA_RESULT；若仍读不到（兼容旧版），fallback 从 DOM 结果区按 label 提取
    function readColumnResult(callback) {
        setTimeout(function () {
            // 1) 优先读全局结果对象
            var r = window._CA_RESULT;
            if (r && typeof r.Nu === 'number' && !isNaN(r.Nu)) {
                _tracePush({ step: 'result_read_success', source: '_CA_RESULT', Nu: r.Nu, phi: r.phi, lambda: r.lambda });
                callback({
                    success: true,
                    result: buildColumnResultFromGlobal(r),
                    raw: r
                });
                return;
            }

            // 2) fallback: 从 DOM 结果区按 label 解析
            var errEl = document.querySelector('#c_result .error-box');
            if (errEl && errEl.textContent) {
                callback({ success: false, error: errEl.textContent, raw: null });
                return;
            }
            var resultEl = document.getElementById('c_result');
            if (!resultEl || !resultEl.innerHTML) {
                callback({ success: false, error: '计算未返回结果', raw: null });
                return;
            }
            var parsed = _parseResultItems(resultEl);
            if (parsed.Nu === null || parsed.phi === null) {
                callback({ success: false, error: '结果解析失败：未找到Nu或φ', raw: parsed });
                return;
            }
            _tracePush({ step: 'result_read_success', source: 'dom_fallback', Nu: parsed.Nu, phi: parsed.phi, lambda: parsed.lambda });
            var ok = parsed.verdictStatus === 'ok';
            var out = {
                success: true,
                tool_id: 'column-axial',
                inputs: {
                    b: _num(_domVal('c_b')),
                    h: _num(_domVal('c_h')),
                    l0: _num(_domVal('c_l0')),
                    concrete: _domVal('c_con'),
                    steel: _domVal('c_reb'),
                    As: _num(_domVal('c_AsP')),
                    N: _num(_domVal('c_N'))
                },
                results: {
                    capacity: {
                        Nu: parsed.Nu,
                        phi: parsed.phi,
                        lambda: parsed.lambda,
                        rho: parsed.rho,
                        verdict: parsed.verdictText,
                        verdict_status: parsed.verdictStatus
                    }
                },
                conclusion: parsed.verdictText || '',
                warnings: [],
                verdict: { status: parsed.verdictStatus || 'err', message: parsed.verdictText || '' },
                overall_ok: ok,
                items: []
            };
            out.items.push({ name: '长细比 λ = l0/b', value: parsed.lambda, unit: '', ok: true, note: '按短边 b 计算' });
            out.items.push({ name: '稳定系数 φ', value: parsed.phi, unit: '', ok: true, note: '按 GB 表 6.2.15 插值' });
            out.items.push({ name: '轴压承载力 Nu', value: parsed.Nu, unit: 'kN', ok: ok, note: 'N ≤ Nu 则满足' });
            out.items.push({ name: '全部纵筋配筋率 ρ', value: parsed.rho !== null ? (parsed.rho * 100) : null, unit: '%', ok: true, note: '按全部纵筋截面面积 / bh' });
            callback({ success: true, result: out, raw: parsed });
        }, 80);
    }

    // 从 window._CA_RESULT 构造结构化结果对象（与 DOM fallback 输出结构完全一致）
    function buildColumnResultFromGlobal(r) {
        var ok = !!r.ok && !!r.rhoOk;
        var vStatus = r.ok && r.rhoOk ? 'ok' : (!r.ok ? 'err' : 'warn');
        var vText = r.ok && r.rhoOk ? '满足：N ≤ Nu 且配筋满足'
                   : (!r.ok ? '不满足：N > Nu'
                          : '承载力满足，但配筋率不足');
        var out = {
            tool_id: 'column-axial',
            inputs: {
                b: r.b,
                h: r.h,
                l0: r.l0,
                concrete: r.conGrade,
                steel: r.rebGrade,
                As: r.AsP,
                N: r.N
            },
            results: {
                capacity: {
                    Nu: r.Nu,
                    phi: r.phi,
                    lambda: r.lambda,
                    rho: r.rhoP,
                    verdict: vText,
                    verdict_status: vStatus
                }
            },
            conclusion: vText,
            warnings: [],
            verdict: { status: vStatus, message: vText },
            overall_ok: ok,
            items: []
        };
        out.items.push({ name: '长细比 λ = l0/b', value: r.lambda, unit: '', ok: true, note: '按短边 b 计算' });
        out.items.push({ name: '稳定系数 φ', value: r.phi, unit: '', ok: true, note: '按 GB 表 6.2.15 插值' });
        out.items.push({ name: '轴压承载力 Nu', value: r.Nu, unit: 'kN', ok: ok, note: 'N ≤ Nu 则满足' });
        out.items.push({ name: '全部纵筋配筋率 ρ', value: r.rhoP * 100, unit: '%', ok: true, note: '按全部纵筋截面面积 / bh' });
        return out;
    }

    // 辅助：从结果区 .result-item 里按 label 提取数值
    // 结果区结构：<div class="result-item"><span class="label">xxx</span><span class="value">xxx</span></div>
    function _parseResultItems(resultEl) {
        var out = { Nu: null, phi: null, lambda: null, rho: null, verdictText: '', verdictStatus: null };
        var items = resultEl.querySelectorAll('.result-item');
        if (!items || !items.length) return out;
        for (var i = 0; i < items.length; i++) {
            var labelEl = items[i].querySelector('.label');
            var valueEl = items[i].querySelector('.value');
            if (!labelEl || !valueEl) continue;
            var label = (labelEl.textContent || '').replace(/\s+/g, ' ').trim();
            var valueHtml = valueEl.innerHTML || '';
            var valueText = (valueEl.textContent || '').replace(/\s+/g, ' ').trim();
            // 长细比 l0/b
            if (label.indexOf('长细比') >= 0) {
                out.lambda = _extractNum(valueText);
            }
            // 稳定系数 φ
            else if (label.indexOf('稳定系数') >= 0) {
                out.phi = _extractNum(valueText);
            }
            // 轴压承载力 Nu
            else if (label.indexOf('轴压承载力') >= 0) {
                out.Nu = _extractNum(valueText);
            }
            // 纵筋配筋率 ρ（注意避开 "所需纵筋面积"）
            else if (label.indexOf('配筋率') >= 0) {
                out.rho = _extractPercent(valueText);
            }
            // 判定
            else if (label === '判定') {
                out.verdictText = valueText;
                var badgeEl = valueEl.querySelector('.badge');
                if (badgeEl) {
                    var cls = badgeEl.className || '';
                    if (cls.indexOf('badge-ok') >= 0) out.verdictStatus = 'ok';
                    else if (cls.indexOf('badge-warn') >= 0) out.verdictStatus = 'warn';
                    else if (cls.indexOf('badge-err') >= 0) out.verdictStatus = 'err';
                }
            }
        }
        return out;
    }
    function _extractNum(text) {
        if (!text) return null;
        // 去掉所有 HTML 标签后，提取第一个浮点数
        var plain = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
        var m = plain.match(/([0-9]+(?:\.[0-9]+)?)/);
        if (!m) return null;
        var n = parseFloat(m[1]);
        return isNaN(n) ? null : n;
    }
    function _extractPercent(text) {
        if (!text) return null;
        var plain = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
        var m = plain.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
        if (!m) return null;
        var n = parseFloat(m[1]);
        return isNaN(n) ? null : n / 100;
    }
    function _num(v) {
        var n = parseFloat(v);
        return isNaN(n) ? null : n;
    }

    /* ==========================================================
     *  工具 8：单块矩形板计算（slab-rect）
     *  原工具位置：src/index.html TOOLS['slab-rect']  (行 4922~5294)
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=sb_calc
     *  原结果变量：window._SLAB_RESULT（27 字段全部有效，无引用错误）
     *  输入 DOM id 前缀：sb_
     * ========================================================== */
    var TOOL_SLAB_RECT = {
        tool_id: 'slab-rect',
        tool_name: '单块矩形板计算',
        category: '板与楼梯',
        description: '四边支承矩形板，按长短边比判别单向/双向板，弹性理论查表法计算跨中与支座弯矩并配筋。',
        applicable_scenarios: '四边支承矩形楼板的单向/双向板判别、跨中弯矩与配筋计算。',
        limitations: [
            '双向板仅支持四边简支/四边固定/对边固定等4种标准组合的弹性系数查表法',
            '非标准支承组合按四边简支近似（偏保守）',
            '不考虑塑性内力重分布',
            '不做挠度与裂缝验算'
        ],
        keywords: ['矩形板', '单向板', '双向板', '板配筋', '四边支承', '弹性薄板', '楼板', '板厚', '恒载', '活载'],
        related_standards: [
            { standard: 'GB 50010', articles: ['6.2.10', '8.5.1', '8.2.1'], note: '受弯承载力·最小配筋率·保护层' },
            { standard: 'JGJ 1', articles: ['6.6.1'], note: '叠合板设计（叠合板适用）' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'lx', label: '短跨计算跨度 lx', type: 'number', unit: 'm', required: true, default: 3.0,
              aliases: ['lx', 'Lx', '短跨', '短边跨度', '短跨跨度', '短边计算跨度', 'l_x'],
              description: '矩形板短边方向的计算跨度（单位：m）' },
            { name: 'ly', label: '长跨计算跨度 ly', type: 'number', unit: 'm', required: true, default: 4.5,
              aliases: ['ly', 'Ly', '长跨', '长边跨度', '长跨跨度', '长边计算跨度', 'l_y'],
              description: '矩形板长边方向的计算跨度（单位：m）' },
            { name: 'h', label: '板厚 h', type: 'number', unit: 'mm', required: true, default: 120,
              aliases: ['h', '板厚', '板厚度', '楼板厚度'],
              description: '板的截面厚度（单位：mm）' },
            { name: 'gk', label: '恒载标准值 gk', type: 'number', unit: 'kN/m²', required: true, default: 4.0,
              aliases: ['gk', '恒载', '永久荷载', '恒荷载', '恒载标准值', '永久荷载标准值'],
              description: '永久荷载标准值（面荷载）' },
            { name: 'qk', label: '活载标准值 qk', type: 'number', unit: 'kN/m²', required: true, default: 2.0,
              aliases: ['qk', '活载', '可变荷载', '活荷载', '活载标准值', '可变荷载标准值', '楼面活荷载'],
              description: '可变荷载标准值（面荷载）' },
            { name: 'concrete', label: '混凝土强度等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土强度', '混凝土等级', '砼等级', '砼强度'],
              description: '如 C25、C30、C35、C40 等' },
            { name: 'steel', label: '钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['steel', 'reb', '钢筋', '钢筋级别', '钢筋等级', '钢筋牌号', '受力筋级别'],
              description: 'HRB400 或 HRB500' }
        ],
        optional_parameters: [
            { name: 'a_s', label: '受拉筋合力点距 as', type: 'number', unit: 'mm', required: false, default: 20,
              aliases: ['a_s', 'as', '保护层', '钢筋保护层', '受拉保护层', '受拉筋合力点', '受拉钢筋合力点'],
              description: '受拉钢筋合力点至受拉边缘距离（单位：mm），默认20mm' },
            { name: 'gG', label: '恒载分项系数 γG', type: 'number', unit: '', required: false, default: 1.2,
              aliases: ['gG', 'γG', '恒载分项系数', '永久荷载分项系数'],
              description: '永久荷载分项系数，默认1.2' },
            { name: 'gQ', label: '活载分项系数 γQ', type: 'number', unit: '', required: false, default: 1.4,
              aliases: ['gQ', 'γQ', '活载分项系数', '可变荷载分项系数'],
              description: '可变荷载分项系数，默认1.4' },
            { name: 'support', label: '支承条件', type: 'string', unit: '', required: false, default: 'ssss',
              aliases: ['support', '支承', '支承条件', '边界条件', '四边简支', '四边固定', '两端固定'],
              description: '支承条件代码：ssss(四边简支)/ffff(四边固定)/sfsf(短跨两固定)/fsfs(长跨两固定)。如用户说"两边固定"需结合方向语义再拆分到 sx1/sx2/sy1/sy2。' }
        ],
        // AI参数名 → 真实DOM id 的映射
        parameter_mapping: {
            lx:       { domId: 'sb_lx',  unit: 'm' },
            ly:       { domId: 'sb_ly',  unit: 'm' },
            h:        { domId: 'sb_h',   unit: 'mm' },
            a_s:      { domId: 'sb_as',  unit: 'mm' },
            gk:       { domId: 'sb_gk',  unit: 'kN/m²' },
            qk:       { domId: 'sb_qk',  unit: 'kN/m²' },
            gG:       { domId: 'sb_gG',  unit: '' },
            gQ:       { domId: 'sb_gQ',  unit: '' },
            concrete: { domId: 'sb_con', unit: '' },
            steel:    { domId: 'sb_reb', unit: '' }
            // 支承条件四个select (sb_sx1/sb_sx2/sb_sy1/sb_sy2) 不直接映射，
            // 由 bridge 函数根据 support 参数拆解写入（简化版本：只支持 ssss/ffff/sfsf/fsfs）
        },
        // 桥接：填值→校验→点计算→读结果
        bridge: function (params, callback) {
            _tracePush({ step: 'bridge_entry', tool: 'slab-rect', params_keys: Object.keys(params) });
            var mapping = this.parameter_mapping;
            var required = this.required_parameters || [];
            var tries = 0;
            var maxTries = 10;
            var retryInterval = 30;

            // 将 support 参数拆解为四个边的 select 值（s/f）
            // 支持：ssss / ffff / sfsf / fsfs / 用户说"四边固定"等
            function resolveSupportEdges(supStr) {
                if (!supStr || typeof supStr !== 'string') return null;
                var s = supStr.toLowerCase().replace(/\s+/g, '');
                // 标准 4 字符代码
                if (/^[sf]{4}$/.test(s)) {
                    return { sx1: s[0], sx2: s[1], sy1: s[2], sy2: s[3] };
                }
                if (s.indexOf('四边简支') >= 0 || s === '简支' || s === '简支四边') return { sx1: 's', sx2: 's', sy1: 's', sy2: 's' };
                if (s.indexOf('四边固定') >= 0 || s === '固定' || s === '固端') return { sx1: 'f', sx2: 'f', sy1: 'f', sy2: 'f' };
                if (s.indexOf('短跨固定') >= 0 || s.indexOf('短边固定') >= 0) return { sx1: 'f', sx2: 'f', sy1: 's', sy2: 's' };
                if (s.indexOf('长跨固定') >= 0 || s.indexOf('长边固定') >= 0) return { sx1: 's', sx2: 's', sy1: 'f', sy2: 'f' };
                return null;
            }

            function writeSupportToDOM(edges) {
                if (!edges) return false;
                ['sx1', 'sx2', 'sy1', 'sy2'].forEach(function (k) {
                    var el = document.getElementById('sb_' + k);
                    if (el && edges[k]) {
                        el.value = edges[k];
                        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                    }
                });
                // 回读校验
                var vx1 = _domVal('sb_sx1'), vx2 = _domVal('sb_sx2');
                var vy1 = _domVal('sb_sy1'), vy2 = _domVal('sb_sy2');
                return vx1 === edges.sx1 && vx2 === edges.sx2 && vy1 === edges.sy1 && vy2 === edges.sy2;
            }

            function tryFillAndCalc() {
                var mapResult = applyParamsToDOM(params, mapping);
                // 支承条件单独处理
                var supportWritten = false;
                if (params.support) {
                    var edges = resolveSupportEdges(params.support);
                    if (edges) {
                        supportWritten = writeSupportToDOM(edges);
                        mapResult.written.support = params.support;
                        if (!supportWritten) mapResult.mismatches.push('support: 支承条件回读不一致');
                    }
                }
                _tracePush({
                    step: 'bridge_dom_write_try' + (tries + 1),
                    written_keys: Object.keys(mapResult.written || {}),
                    mismatches: mapResult.mismatches || [],
                    missing_params: mapResult.missing_params || []
                });

                // 必填项DOM回读校验：每个必填参数必须成功写入DOM
                var missingDom = [];
                required.forEach(function (p) {
                    if (mapResult.written[p.name] === undefined) {
                        missingDom.push(p.name);
                    }
                });

                if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                    tries++;
                    if (tries < maxTries) {
                        setTimeout(tryFillAndCalc, retryInterval);
                        return;
                    }
                    var errMsg = '参数映射失败（重试' + tries + '次仍未通过），已中止计算。' +
                        (missingDom.length > 0 ? ' 缺失DOM: ' + missingDom.join(', ') + '。' : '') +
                        (mapResult.mismatches.length > 0 ? ' 回读不一致: ' + mapResult.mismatches.join('；') + '。' : '');
                    console.error('[AI_BRIDGE] slab-rect 映射失败:', errMsg);
                    _tracePush({ step: 'bridge_error_mapping', error: errMsg, missing_dom: missingDom, mismatches: mapResult.mismatches, retries: tries });
                    callback({
                        success: false,
                        error: 'mapping_mismatch',
                        error_detail: errMsg,
                        missing_dom: missingDom,
                        mismatches: mapResult.mismatches,
                        written: mapResult.written
                    });
                    return;
                }

                // ===== slab-rect 默认值安全门 =====
                var defaults = { lx: 3.0, ly: 4.5, h: 120, gk: 4.0, qk: 2.0, concrete: 'C30', steel: 'HRB400' };
                var stuckDefaults = [];
                required.forEach(function (p) {
                    var userVal = params[p.name];
                    var domVal = mapResult.written[p.name];
                    if (userVal !== undefined && defaults[p.name] !== undefined) {
                        var userNum = parseFloat(userVal);
                        var defNum = parseFloat(defaults[p.name]);
                        var domNum = parseFloat(domVal);
                        if (!isNaN(userNum) && !isNaN(defNum) && !isNaN(domNum)) {
                            if (Math.abs(userNum - defNum) > 0.001 && Math.abs(domNum - defNum) < 0.001) {
                                stuckDefaults.push(p.name);
                            }
                        } else if (String(userVal) !== String(defaults[p.name]) && String(domVal) === String(defaults[p.name])) {
                            stuckDefaults.push(p.name);
                        }
                    }
                });
                if (stuckDefaults.length > 0) {
                    var defErrMsg = '矩形板bridge写值失败：以下字段回读仍为默认值，疑似DOM未就绪或id不匹配：' + stuckDefaults.join('、') + '。已中止，未点击计算。';
                    console.error('[AI_BRIDGE] ' + defErrMsg);
                    _tracePush({ step: 'bridge_result_error', error: 'default_values_stuck', detail: defErrMsg, stuck_fields: stuckDefaults });
                    callback({
                        success: false,
                        error: 'default_values_stuck',
                        error_detail: defErrMsg,
                        stuck_fields: stuckDefaults,
                        written: mapResult.written
                    });
                    return;
                }

                console.log('[AI_BRIDGE] 参数校验通过（第' + (tries + 1) + '次尝试），点击计算按钮');
                _tracePush({
                    step: 'slab_calc_click',
                    retries: tries,
                    dom_values: {
                        lx: _domVal('sb_lx'), ly: _domVal('sb_ly'), h: _domVal('sb_h'),
                        as: _domVal('sb_as'), gk: _domVal('sb_gk'), qk: _domVal('sb_qk'),
                        gG: _domVal('sb_gG'), gQ: _domVal('sb_gQ'),
                        con: _domVal('sb_con'), reb: _domVal('sb_reb'),
                        sx1: _domVal('sb_sx1'), sx2: _domVal('sb_sx2'),
                        sy1: _domVal('sb_sy1'), sy2: _domVal('sb_sy2')
                    }
                });
                clickBtn('sb_calc');
                readSlabResult(function(res) {
                    if (res.success) {
                        var r = res.result && res.result.results ? res.result.results : {};
                        var mx = r.mx ? r.mx.M : null;
                        var my = r.my ? r.my.M : null;
                        console.log('[AI_RESULT] slab-rect Mx=' + mx + ' kN·m/m, My=' + my + ' kN·m/m');
                        _tracePush({ step: 'bridge_result_success', Mx: mx, My: my, sections: (r ? Object.keys(r) : []) });
                    } else {
                        _tracePush({ step: 'bridge_result_error', error: res.error || 'unknown' });
                    }
                    callback(res);
                });
            }
            tryFillAndCalc();
        },
        // 结果映射
        result_mapping: mapSlabRectResult
    };

    // 单块矩形板结果读取：优先读 window._SLAB_RESULT（源码27字段全有效，已核对），失败 fallback 读 DOM
    function readSlabResult(callback) {
        setTimeout(function () {
            // 1) 优先读全局结果对象
            var r = window._SLAB_RESULT;
            if (r && typeof r.mx === 'number' && !isNaN(r.mx) && r.rx && typeof r.rx.As === 'number') {
                _tracePush({
                    step: 'result_read_success',
                    source: '_SLAB_RESULT',
                    mx: r.mx, my: r.my,
                    Asx: r.rx ? r.rx.As : null,
                    Asy: r.ry ? r.ry.As : null
                });
                callback({
                    success: true,
                    result: mapSlabRectResult(r),
                    raw: r
                });
                return;
            }

            // 2) fallback: 从 DOM 结果区按 label 提取
            var errEl = document.querySelector('#sb_result .error-box');
            if (errEl && errEl.textContent) {
                callback({ success: false, error: errEl.textContent, raw: null });
                return;
            }
            var resultEl = document.getElementById('sb_result');
            if (!resultEl || !resultEl.innerHTML) {
                callback({ success: false, error: '计算未返回结果', raw: null });
                return;
            }
            // 简单 fallback：解析板类判别 + 弯矩基本信息（详细配筋从 #sb_rebar table 解析太复杂，一般用不到）
            var parsed = _parseSlabResultDOM(resultEl);
            _tracePush({ step: 'result_read_success', source: 'dom_fallback', mx: parsed.mx, my: parsed.my });
            callback({ success: true, result: buildSlabResultFromDOM(parsed), raw: parsed });
        }, 80);
    }

    // 从 DOM 解析板结果（fallback 用，结构尽量对齐 mapSlabRectResult）
    function _parseSlabResultDOM(resultEl) {
        var out = { mx: null, my: null, mx0: null, my0: null, ratio: null, isOneWay: null, q: null };
        var items = resultEl.querySelectorAll('.result-item');
        if (!items || !items.length) return out;
        for (var i = 0; i < items.length; i++) {
            var labelEl = items[i].querySelector('.label');
            var valueEl = items[i].querySelector('.value');
            if (!labelEl || !valueEl) continue;
            var label = (labelEl.textContent || '').replace(/\s+/g, ' ').trim();
            var valueText = (valueEl.textContent || '').replace(/\s+/g, ' ').trim();
            if (label.indexOf('长短边比') >= 0) out.ratio = _extractNum(valueText);
            else if (label.indexOf('面荷载设计值') >= 0) out.q = _extractNum(valueText);
            else if (label.indexOf('短跨跨中弯矩') >= 0) out.mx = _extractNum(valueText);
            else if (label.indexOf('长跨跨中弯矩') >= 0) out.my = _extractNum(valueText);
            else if (label.indexOf('短跨支座弯矩') >= 0) out.mx0 = _extractNum(valueText);
            else if (label.indexOf('长跨支座弯矩') >= 0) out.my0 = _extractNum(valueText);
            else if (label.indexOf('板类判别') >= 0) out.isOneWay = valueText.indexOf('单向板') >= 0;
        }
        return out;
    }
    function buildSlabResultFromDOM(p) {
        return {
            tool_id: 'slab-rect',
            inputs: { lx: null, ly: null, h: null, concrete: null, steel: null, gk: null, qk: null },
            results: {
                basic: { ratio: p.ratio, isOneWay: p.isOneWay, q: p.q },
                mx:  { M: p.mx,  h0: null, As: null, rho: null, over: null, As_min: null, meets_min: null, verdict: null },
                my:  { M: p.my,  h0: null, As: null, rho: null, over: null, As_min: null, meets_min: null, verdict: null },
                mx0: p.mx0 != null ? { M: p.mx0, h0: null, As: null, rho: null, over: null, As_min: null, meets_min: null, verdict: null } : null,
                my0: p.my0 != null ? { M: p.my0, h0: null, As: null, rho: null, over: null, As_min: null, meets_min: null, verdict: null } : null
            },
            conclusion: (p.isOneWay ? '单向板' : '双向板') + '，Mx=' + (p.mx||'?') + ' kN·m/m',
            warnings: ['DOM fallback，配筋信息缺失，请使用 _SLAB_RESULT 获取完整结果'],
            verdict: { status: 'warn', message: 'DOM fallback 结果不完整' },
            overall_ok: false,
            items: []
        };
    }

    // 从 window._SLAB_RESULT 构造结构化结果（多截面：mx / my / mx0 / my0）
    function mapSlabRectResult(r) {
        var warnings = [];
        var b = 1000; // 每延米板带
        var AsMin = r.AsMin;

        // 构造单个截面的结果对象
        function buildSection(M, h0v, rx, asP) {
            if (!rx) return null;
            var over = !!rx.over;
            var As = over ? Infinity : rx.As;
            var rho = over ? null : (As / (b * r.h));
            var meetsMin = !over && As >= AsMin;
            // 判定：超筋→err；有实配时按实配；无实配时按计算所需 vs AsMin
            var verdictStatus = 'ok';
            var verdictText = '满足';
            if (over) {
                verdictStatus = 'err'; verdictText = '超筋';
            } else if (asP !== null && asP !== undefined && isFinite(asP) && asP > 0) {
                var AsReq = Math.max(r.As, AsMin);
                if (asP >= AsReq) { verdictStatus = 'ok'; verdictText = '满足（实配≥所需）'; }
                else if (asP < AsMin) { verdictStatus = 'warn'; verdictText = '不满足最小配筋率'; }
                else { verdictStatus = 'warn'; verdictText = '配筋不足'; }
            } else {
                if (As < AsMin) { verdictStatus = 'warn'; verdictText = '配筋不足（<ρmin）'; }
                else { verdictStatus = 'ok'; verdictText = '满足（适筋）'; }
            }
            return {
                M: M,
                h0: h0v,
                As: As,
                rho: rho,
                rho_pct: rho ? rho * 100 : null,
                over: over,
                As_min: AsMin,
                meets_min: meetsMin,
                alpha_s: rx.alpha_s,
                gamma_s: rx.gamma_s,
                xi: rx.xi,
                as_provided: asP || null,
                verdict: verdictText,
                verdict_status: verdictStatus
            };
        }

        var asProv = r.asProvided || {};
        var secMx  = buildSection(r.mx,  r.h0x, r.rx,  asProv.mx);
        var secMy  = buildSection(r.my,  r.h0y, r.ry,  asProv.my);
        var secMx0 = r.rx0 ? buildSection(r.mx0, r.h0x, r.rx0, asProv.mx0) : null;
        var secMy0 = r.ry0 ? buildSection(r.my0, r.h0y, r.ry0, asProv.my0) : null;

        // 总体判定：所有截面都是 ok 才算总体 ok
        var sections = [secMx, secMy];
        if (secMx0) sections.push(secMx0);
        if (secMy0) sections.push(secMy0);
        var overallOk = sections.every(function (s) { return s && s.verdict_status === 'ok'; });
        var anyErr = sections.some(function (s) { return s && s.verdict_status === 'err'; });
        var overallStatus = anyErr ? 'err' : (overallOk ? 'ok' : 'warn');

        var plateType = r.isOneWay ? '单向板（lx/ly ≤ 1/3）' : '双向板（弹性理论）';
        var conclusionText = plateType + '，短跨跨中 Mx=' + r.mx.toFixed(3) + ' kN·m/m，所需 As=' +
            (secMx && secMx.As && isFinite(secMx.As) ? Math.round(secMx.As) : '超筋') + ' mm²/m。';

        var out = {
            success: true,
            tool_id: 'slab-rect',
            inputs: {
                lx: r.lx,
                ly: r.ly,
                h: r.h,
                a_s: r.asV,
                gk: r.gk,
                qk: r.qk,
                gG: r.gG,
                gQ: r.gQ,
                concrete: r.conGrade,
                steel: r.rebGrade,
                support: r.caseCode,
                isOneWay: r.isOneWay
            },
            results: {
                basic: {
                    lx: r.lx, ly: r.ly, h: r.h,
                    ratio: r.ratio,
                    isOneWay: r.isOneWay,
                    plate_type: plateType,
                    case_code: r.caseCode,
                    q: r.q,
                    h0x: r.h0x,
                    h0y: r.h0y
                },
                material: {
                    fc: null, ft: null, fy: null, // _SLAB_RESULT 未直接暴露 fc/ft/fy，留空
                    concrete: r.conGrade,
                    steel: r.rebGrade,
                    rho_min: r.rho_min,
                    As_min: AsMin
                },
                mx:  secMx,   // 短跨跨中（x 向）
                my:  secMy,   // 长跨跨中（y 向）
                mx0: secMx0,  // 短跨支座（x 向），无则 null
                my0: secMy0   // 长跨支座（y 向），无则 null
            },
            conclusion: conclusionText,
            warnings: warnings,
            verdict: { status: overallStatus, message: conclusionText },
            overall_ok: overallOk,
            items: []
        };

        out.items.push({
            name: '板类判别',
            value: plateType,
            unit: '',
            ok: true,
            note: 'lx/ly = ' + r.ratio.toFixed(3)
        });
        out.items.push({
            name: '长短边比 lx/ly',
            value: r.ratio,
            unit: '',
            ok: true,
            note: r.isOneWay ? '≤ 1/3，按单向板计算' : '> 1/3，按双向板计算'
        });
        out.items.push({
            name: '面荷载设计值 q',
            value: r.q,
            unit: 'kN/m²',
            ok: true,
            note: 'q = γG·gk + γQ·qk'
        });
        out.items.push({
            name: '短跨跨中弯矩 Mx',
            value: r.mx,
            unit: 'kN·m/m',
            ok: !r.rx.over,
            note: '每延米板带'
        });
        out.items.push({
            name: '短跨跨中所需 Asx',
            value: secMx && secMx.As && isFinite(secMx.As) ? Math.round(secMx.As) : null,
            unit: 'mm²/m',
            ok: secMx ? secMx.verdict_status === 'ok' : false,
            note: secMx ? secMx.verdict : ''
        });
        out.items.push({
            name: '长跨跨中弯矩 My',
            value: r.my,
            unit: 'kN·m/m',
            ok: !r.ry.over,
            note: '每延米板带'
        });
        out.items.push({
            name: '长跨跨中所需 Asy',
            value: secMy && secMy.As && isFinite(secMy.As) ? Math.round(secMy.As) : null,
            unit: 'mm²/m',
            ok: secMy ? secMy.verdict_status === 'ok' : false,
            note: secMy ? secMy.verdict : ''
        });
        if (secMx0) out.items.push({
            name: '短跨支座弯矩 Mx0',
            value: r.mx0,
            unit: 'kN·m/m',
            ok: !r.rx0.over,
            note: '绝对值'
        });
        if (secMy0) out.items.push({
            name: '长跨支座弯矩 My0',
            value: r.my0,
            unit: 'kN·m/m',
            ok: !r.ry0.over,
            note: '绝对值'
        });

        return out;
    }

    /* ==========================================================
     *  工具 9：板式楼梯计算（stair-slab）
     *  原工具位置：src/index.html TOOLS['stair-slab']
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=st_calc
     *  原结果变量：window._ST_RESULT
     *  输入 DOM id 前缀：st_（16个全静态，无动态DOM）
     * ========================================================== */
    var TOOL_STAIR_SLAB = {
        tool_id: 'stair-slab',
        tool_name: '板式楼梯计算',
        category: '板与楼梯',
        description: '梯段斜板 + 平台板内力与配筋计算，含恒载三项拆分、活载基本组合、梯梁简化验算提示。',
        applicable_scenarios: '板式楼梯梯段斜板及平台板的内力分析与配筋估算（单跑）。',
        limitations: [
            '仅做单跑板式楼梯，不支持多跑、折角、弧形楼梯',
            '梯段斜板按两端简支计算跨中弯矩，未考虑支座嵌固及负弯矩配筋',
            '恒载拆分为面层/踏步/梯板三项，均按水平投影面计；梯梁为简化估算，非正式设计',
            '不计算挠度、裂缝、斜截面抗剪',
            '分布筋与踏步构造筋按经验给出，不做验算',
            '不考虑地震作用与楼梯间整体分析'
        ],
        keywords: ['楼梯', '板式楼梯', '梯段', '梯板', '楼梯配筋', '斜板', '踏步', '楼梯板', '平台板'],
        related_standards: [
            { standard: 'GB 50009', articles: [], note: '建筑结构荷载规范·楼梯活载' },
            { standard: 'GB 50010', articles: ['6.2.10', '8.5.1'], note: '正截面受弯·最小配筋率' }
        ],
        // ===== 工具级安全门：16项全required + 数值约束 =====
        validateParams: function (provided) {
            var errors = [];
            // 正数校验
            var posFields = [
                ['Ln', '梯段水平投影跨度 Ln'],
                ['b', '梯宽 b'],
                ['step_width', '踏步宽度'],
                ['step_height', '踏步高度'],
                ['slab_thickness', '梯板厚度'],
                ['a_s', '受拉筋合力点距 a_s'],
                ['platform_L', '平台板跨度'],
                ['platform_h', '平台板厚度'],
                ['gammaG', '恒载分项系数 γG'],
                ['gammaQ', '活载分项系数 γQ']
            ];
            for (var i = 0; i < posFields.length; i++) {
                var key = posFields[i][0];
                var label = posFields[i][1];
                var v = parseFloat(provided[key]);
                if (!(v > 0)) errors.push(label + ' 必须为正数（当前: ' + provided[key] + '）');
            }
            // a_s < slab_thickness
            var asV = parseFloat(provided.a_s);
            var thk = parseFloat(provided.slab_thickness);
            if (asV > 0 && thk > 0 && asV >= thk) {
                errors.push('a_s 必须小于梯板厚度（as=' + asV + ', 厚=' + thk + '）');
            }
            // gk 各项 >= 0
            var gkFields = [['gk_floor','面层自重'], ['gk_step','踏步自重'], ['gk_slab','梯板自重']];
            for (var j = 0; j < gkFields.length; j++) {
                var gv = parseFloat(provided[gkFields[j][0]]);
                if (isNaN(gv) || gv < 0) errors.push(gkFields[j][1] + ' 不能为负或非法');
            }
            // qk >= 0
            var qv = parseFloat(provided.qk);
            if (isNaN(qv) || qv < 0) errors.push('活载 qk 不能为负或非法');

            return { pass: errors.length === 0, errors: errors };
        },
        adapter_ready: true,
        required_parameters: [
            { name: 'Ln', label: '梯段水平投影跨度 Ln', type: 'number', unit: 'm', required: true, default: 3.6,
              aliases: ['Ln', 'L', '梯段跨度', '梯段长', '梯段水平投影', '水平投影长度', '楼梯跨度'],
              description: '梯段水平投影跨度，单位 m。不是斜长。' },
            { name: 'b', label: '楼梯宽度 b', type: 'number', unit: 'mm', required: true, default: 1200,
              aliases: ['b', '梯宽', '楼梯宽度', '楼梯板宽度', '梯段宽度'],
              description: '楼梯净宽，单位 mm。用于梯梁导荷估算。' },
            { name: 'step_width', label: '踏步宽度', type: 'number', unit: 'mm', required: true, default: 280,
              aliases: ['step_width', 'bs', '踏步宽', '踏步宽度', 'tread', '踏面宽'],
              description: '踏步踏面宽度 b_s，单位 mm。' },
            { name: 'step_height', label: '踏步高度', type: 'number', unit: 'mm', required: true, default: 160,
              aliases: ['step_height', 'hs', '踏步高', '踏步高度', 'riser', '踢面高'],
              description: '踏步踢面高度 h_s，单位 mm。' },
            { name: 'slab_thickness', label: '梯板厚度 δ', type: 'number', unit: 'mm', required: true, default: 120,
              aliases: ['slab_thickness', 'delta', '板厚', '梯板厚', '梯板厚度', '斜板厚', 'δ'],
              description: '梯段斜板厚度 δ，单位 mm。禁止叫 h（避免与梁高 h 混淆）。' },
            { name: 'a_s', label: '受拉筋合力点距 a_s', type: 'number', unit: 'mm', required: true, default: 20,
              aliases: ['a_s', 'as', 'as_value', '保护层as', '钢筋合力点距', '受拉筋合力点距'],
              description: '受拉钢筋合力点到受拉边缘的距离，单位 mm。垂直于板面。' },
            { name: 'platform_L', label: '平台板跨度 Lp', type: 'number', unit: 'm', required: true, default: 1.2,
              aliases: ['platform_L', 'Lp', '平台跨', '平台板跨度', '平台板宽', '平台板水平跨度'],
              description: '平台板水平跨度，单位 m。' },
            { name: 'platform_h', label: '平台板厚度 hp', type: 'number', unit: 'mm', required: true, default: 100,
              aliases: ['platform_h', 'hp', '平台厚', '平台板厚', '平台板厚度'],
              description: '平台板厚度，单位 mm。' },
            { name: 'gk_floor', label: '面层自重 gk1', type: 'number', unit: 'kN/m²', required: true, default: 0.5,
              aliases: ['gk_floor', 'g_k1', 'gk1', '面层自重', '楼面面层', '面层荷载'],
              description: '楼面面层自重（地砖+砂浆等），按水平投影面计，kN/m²。' },
            { name: 'gk_step', label: '踏步及抹灰自重 gk2', type: 'number', unit: 'kN/m²', required: true, default: 3.0,
              aliases: ['gk_step', 'g_k2', 'gk2', '踏步自重', '踏步及抹灰', '踏步荷载'],
              description: '踏步及底板抹灰自重，按水平投影面计，kN/m²。' },
            { name: 'gk_slab', label: '梯板自重 gk3', type: 'number', unit: 'kN/m²', required: true, default: 2.5,
              aliases: ['gk_slab', 'g_k3', 'gk3', '梯板自重', '斜板自重', '板自重'],
              description: '梯板（斜板）自重按水平投影折算值，kN/m²。工具默认值是参考值，用户应按实际板厚复核。' },
            { name: 'qk', label: '活荷载标准值 qk', type: 'number', unit: 'kN/m²', required: true, default: 3.5,
              aliases: ['qk', 'q_k', '活载', '活荷载', '活载标准值', '可变荷载', '楼梯活载', 'live_load'],
              description: '楼梯活荷载标准值，按水平投影面计，kN/m²。住宅 2.0，公共建筑 3.5，消防疏散 3.5。' },
            { name: 'gammaG', label: '恒载分项系数 γG', type: 'number', unit: '', required: true, default: 1.2,
              aliases: ['gammaG', 'γG', 'gamma_g', '恒载分项系数', 'γ_G'],
              description: '永久荷载分项系数，默认 1.2。' },
            { name: 'gammaQ', label: '活载分项系数 γQ', type: 'number', unit: '', required: true, default: 1.4,
              aliases: ['gammaQ', 'γQ', 'gamma_q', '活载分项系数', 'γ_Q'],
              description: '可变荷载分项系数，默认 1.4。' },
            { name: 'concrete', label: '混凝土强度等级', type: 'string', unit: '', required: true, default: 'C30',
              aliases: ['concrete', 'con', '混凝土', '混凝土等级', '砼等级', '混凝土强度等级'],
              description: 'C20 ~ C50。' },
            { name: 'steel', label: '钢筋级别', type: 'string', unit: '', required: true, default: 'HRB400',
              aliases: ['steel', 'reb', '钢筋', '钢筋级别', '钢筋等级', '纵筋', '受力筋', '纵向钢筋'],
              description: 'HRB400 或 HRB500。' }
        ],
        optional_parameters: [],
        // 16 个参数的 DOM 映射（全静态）
        parameter_mapping: {
            Ln:              { domId: 'st_Ln',       unit: 'm' },
            b:               { domId: 'st_b',        unit: 'mm' },
            step_width:      { domId: 'st_t',        unit: 'mm' },
            step_height:     { domId: 'st_r',        unit: 'mm' },
            slab_thickness:  { domId: 'st_d',        unit: 'mm' },
            a_s:             { domId: 'st_as',       unit: 'mm' },
            platform_L:      { domId: 'st_pL',       unit: 'm' },
            platform_h:      { domId: 'st_ph',       unit: 'mm' },
            gk_floor:        { domId: 'st_gk_floor', unit: 'kN/m²' },
            gk_step:         { domId: 'st_gk_step',  unit: 'kN/m²' },
            gk_slab:         { domId: 'st_gk_slab',  unit: 'kN/m²' },
            qk:              { domId: 'st_qk',       unit: 'kN/m²' },
            gammaG:          { domId: 'st_gG',       unit: '' },
            gammaQ:          { domId: 'st_gQ',       unit: '' },
            concrete:        { domId: 'st_con',      unit: '' },
            steel:           { domId: 'st_reb',      unit: '' }
        },
        // ===== bridge：全静态DOM → applyParamsToDOM → verify → 点计算 → 读 _ST_RESULT =====
        bridge: function (params, callback) {
            _tracePush({ step: 'bridge_entry', tool: 'stair-slab', params_keys: Object.keys(params) });
            var self = this;
            var mapping = self.parameter_mapping;

            // 写值
            var mapResult = applyParamsToDOM(params, mapping);
            _tracePush({
                step: 'bridge_dom_write',
                written_keys: Object.keys(mapResult.written || {}),
                mismatches: mapResult.mismatches ? mapResult.mismatches.length : 0
            });

            if (!mapResult.success || mapResult.mismatches.length > 0) {
                _tracePush({
                    step: 'bridge_dom_verify_failed',
                    failures: (mapResult.mismatches || []).slice(0, 10),
                    failure_count: (mapResult.mismatches || []).length,
                    missing_params: mapResult.missing_params || []
                });
                callback({
                    success: false,
                    error: 'dom_verify_failed',
                    error_detail: 'DOM 写入/回读校验失败：' + (mapResult.mismatches || ['未知']).slice(0, 3).join('；'),
                    mismatches: mapResult.mismatches,
                    missing_params: mapResult.missing_params,
                    written: mapResult.written
                });
                return;
            }

            // 二次 verify：确保 16 项回读值都对
            var verifyFails = [];
            var keys = ['Ln','b','step_width','step_height','slab_thickness','a_s','platform_L','platform_h',
                        'gk_floor','gk_step','gk_slab','qk','gammaG','gammaQ','concrete','steel'];
            for (var ki = 0; ki < keys.length; ki++) {
                var k = keys[ki];
                var domId = mapping[k].domId;
                var el = document.getElementById(domId);
                if (!el) { verifyFails.push(k + '(' + domId + '): 元素不存在'); continue; }
                var expected = params[k];
                if (expected === undefined || expected === null || expected === '') {
                    verifyFails.push(k + ': 参数缺失');
                    continue;
                }
                var actual = el.value;
                var numExp = parseFloat(expected);
                var numAct = parseFloat(actual);
                var ok = false;
                if (!isNaN(numExp) && !isNaN(numAct)) ok = Math.abs(numExp - numAct) < 0.001;
                else ok = String(expected) === String(actual);
                if (!ok) verifyFails.push(k + ': expected=' + expected + ', actual=' + actual);
            }
            if (verifyFails.length > 0) {
                _tracePush({
                    step: 'bridge_dom_verify_failed',
                    failures: verifyFails.slice(0, 10),
                    failure_count: verifyFails.length
                });
                callback({
                    success: false,
                    error: 'dom_verify_failed',
                    error_detail: '16项 DOM 回读校验失败：' + verifyFails.slice(0, 3).join('；'),
                    failures: verifyFails
                });
                return;
            }
            _tracePush({ step: 'bridge_dom_verify_passed', total: keys.length });

            // 点计算
            var calcBtn = document.getElementById('st_calc');
            if (!calcBtn) {
                _tracePush({ step: 'bridge_result_failed', error: 'st_calc 按钮不存在' });
                callback({ success: false, error: 'calc_button_not_found' });
                return;
            }
            _tracePush({ step: 'stair_calc_click' });
            calcBtn.click();

            // 读结果
            setTimeout(function () {
                var raw = window._ST_RESULT;
                var errEl = document.querySelector('#st_slope .error-box');
                var errMsg = errEl ? errEl.textContent : '';

                if (errMsg) {
                    _tracePush({ step: 'bridge_result_failed', error: errMsg.substring(0, 80) });
                    callback({ success: false, error: 'calculation_error', error_detail: errMsg, raw: raw });
                    return;
                }
                if (!raw) {
                    _tracePush({ step: 'bridge_result_failed', error: '_ST_RESULT 为空' });
                    callback({ success: false, error: 'result_not_found', error_detail: 'window._ST_RESULT 未生成' });
                    return;
                }

                // Infinity/NaN 检测
                var invalids = [];
                function ck(v, name) {
                    if (typeof v === 'number' && (!isFinite(v) || isNaN(v))) invalids.push(name);
                }
                ck(raw.M_slope, 'M_slope');
                ck(raw.M_plat, 'M_plat');
                if (raw.r_slope) {
                    ck(raw.r_slope.As, 'r_slope.As');
                    ck(raw.r_slope.gamma_s, 'r_slope.gamma_s');
                }
                if (raw.r_plat) {
                    ck(raw.r_plat.As, 'r_plat.As');
                }
                ck(raw.AsMin, 'AsMin');
                ck(raw.beamLoad, 'beamLoad');
                if (invalids.length > 0) {
                    _tracePush({
                        step: 'bridge_result_invalid',
                        invalid_fields: invalids.slice(0, 10),
                        invalid_count: invalids.length
                    });
                    callback({
                        success: false,
                        error: 'calculation_result_invalid',
                        error_detail: '计算结果含 Infinity/NaN，共 ' + invalids.length + ' 处。',
                        invalid_fields: invalids,
                        raw: raw
                    });
                    return;
                }

                // 结构化结果
                var result = {
                    // 几何
                    Ln: raw.Ln,
                    b: raw.bW,
                    step_width: raw.bs,
                    step_height: raw.hs,
                    slab_thickness: raw.delta,
                    a_s: raw.asV,
                    platform_L: raw.Lp,
                    platform_h: raw.hp,
                    cos_alpha: raw.cosA,
                    slant_factor: raw.slantFactor,
                    h0: raw.h0,
                    hp0: raw.hp0,

                    // 荷载
                    gk_total: raw.gk,
                    gk_floor: params.gk_floor,
                    gk_step: params.gk_step,
                    gk_slab: params.gk_slab,
                    qk: raw.qk,
                    gammaG: raw.gG,
                    gammaQ: raw.gQ,
                    q_design: raw.qDesign,

                    // 梯段斜板跨中
                    slope: {
                        M: raw.M_slope,
                        As: raw.r_slope ? raw.r_slope.As : null,
                        over_reinforced: raw.r_slope ? raw.r_slope.over : null,
                        alpha_s: raw.r_slope ? raw.r_slope.alpha_s : null,
                        gamma_s: raw.r_slope ? raw.r_slope.gamma_s : null,
                        xi: raw.r_slope ? raw.r_slope.xi : null
                    },

                    // 平台板跨中
                    platform: {
                        M: raw.M_plat,
                        As: raw.r_plat ? raw.r_plat.As : null,
                        over_reinforced: raw.r_plat ? raw.r_plat.over : null,
                        alpha_s: raw.r_plat ? raw.r_plat.alpha_s : null,
                        gamma_s: raw.r_plat ? raw.r_plat.gamma_s : null,
                        xi: raw.r_plat ? raw.r_plat.xi : null
                    },

                    // 指标
                    As_min: raw.AsMin,
                    rho_min: raw.rho_min,

                    // 梯梁估算
                    beam_load_approx: raw.beamLoad,

                    // 材料
                    concrete: raw.conGrade,
                    steel: raw.rebGrade,

                    // 说明
                    notes: [
                        '不计算挠度、裂缝、斜截面抗剪',
                        '梯段斜板按两端简支计算跨中弯矩，未考虑支座负弯矩配筋',
                        '梯梁线荷载为近似估算，正式设计需按实际梯梁跨度与截面详细计算'
                    ]
                };

                _tracePush({
                    step: 'result_read_success',
                    M_slope: raw.M_slope,
                    As_slope: raw.r_slope ? raw.r_slope.As : null,
                    M_plat: raw.M_plat,
                    As_plat: raw.r_plat ? raw.r_plat.As : null,
                    AsMin: raw.AsMin
                });
                _tracePush({ step: 'bridge_result_success', tool: 'stair-slab' });
                callback({ success: true, result: result, raw: raw });
            }, 60);
        },
        result_mapping: {
            '梯段斜板跨中弯矩 M': 'slope.M',
            '梯段斜板配筋 As': 'slope.As',
            '平台板跨中弯矩 M': 'platform.M',
            '平台板配筋 As': 'platform.As',
            '最小配筋面积 As_min': 'As_min',
            '最小配筋率 rho_min': 'rho_min',
            '梯梁线荷载估算': 'beam_load_approx'
        }
    };

    /* ==========================================================
     *  工具 10：蒸压加气混凝土外墙板（aac-wall）
     *  占位
     * ========================================================== */
    /* ==========================================================
     *  工具 10：蒸压加气混凝土外墙板（aac-wall）
     *  原工具位置：src/index.html TOOLS['aac-wall']
     *  原 calc 入口：bind 内的 calc()（局部），按钮 id=aw_calc
     *  原结果变量：window._AW_RESULT
     *  输入 DOM id 前缀：aw_（23个全静态，无动态DOM）
     *  关键注意：容重/自重不是输入，由 grade 查表得出；标准切换联动会改 gammaG/gammaW/grade
     * ========================================================== */
    var TOOL_AAC_WALL = {
        tool_id: 'aac-wall',
        tool_name: '蒸压加气混凝土外墙板',
        category: '装配式',
        description: '竖向外墙板风荷载面外受弯、受剪、抗裂、挠度、地震作用与连接节点验算，支持 JGJ/T 17-2020 / T/CECS 553-2018 两套公式。',
        applicable_scenarios: 'AAC/ALC 竖向外墙板在风荷载及地震作用下的面外受弯、受剪、抗裂、挠度与连接节点验算。',
        limitations: [
            '仅做竖向外墙单板，按两端简支面外受弯计算，不支持多跨连续、开洞、悬臂板',
            '容重由强度等级查表得出，不支持用户单独指定自重',
            '自重沿板面方向（面内），面外受弯荷载仅考虑风+地震',
            '不做平面内承载力验算、不做起吊运输工况验算',
            '连接节点仅做支座反力复核，不做节点详细设计'
        ],
        keywords: ['AAC', '加气混凝土', '外墙板', 'ALC', '蒸压加气', '装配式墙板', '蒸压加气混凝土', 'AAC板', 'ALC板', '加气板'],
        related_standards: [
            { standard: 'JGJ/T 17-2020', articles: ['5.4.1', '5.4.2', '5.4.3', '5.4.4'], note: '蒸压加气混凝土制品应用技术标准' },
            { standard: 'T/CECS 553-2018', articles: ['5.2.1', '5.2.5', '5.2.6', '5.3.3'], note: '蒸压加气混凝土墙板应用技术规程' },
            { standard: 'GB 50009-2012', articles: ['8.1', '8.2', '8.6'], note: '建筑结构荷载规范·风荷载' },
            { standard: '19CJ85-1', articles: [], note: '装配式建筑蒸压加气混凝土板围护系统' }
        ],
        // ===== 工具级安全门 =====
        validateParams: function (provided) {
            var errors = [];
            var p = provided || {};

            // 正数校验
            var posFields = [
                ['L', '板计算跨度 L'],
                ['b', '板宽 b'],
                ['h', '板厚 h'],
                ['bar_diameter', '钢筋直径 d'],
                ['a_s', '受拉筋合力点距 a_s'],
                ['z', '计算高度 z'],
                ['gamma0', '结构重要性系数 γ0'],
                ['gammaG', '永久荷载分项系数 γG'],
                ['gammaW', '风荷载分项系数 γW']
            ];
            for (var i = 0; i < posFields.length; i++) {
                var v = parseFloat(p[posFields[i][0]]);
                if (!(v > 0)) errors.push(posFields[i][1] + ' 必须为正数（当前: ' + p[posFields[i][0]] + '）');
            }

            // bar_count > 0 整数
            var bc = parseFloat(p.bar_count);
            if (!(bc > 0) || Math.floor(bc) !== bc) {
                errors.push('钢筋根数 bar_count 必须为正整数（当前: ' + p.bar_count + '）');
            }
            // nj > 0 整数
            var njv = parseFloat(p.nj);
            if (!(njv > 0) || Math.floor(njv) !== njv) {
                errors.push('连接件数量 nj 必须为正整数（当前: ' + p.nj + '）');
            }
            // a_s < h
            var asV = parseFloat(p.a_s);
            var hv = parseFloat(p.h);
            if (asV > 0 && hv > 0 && asV >= hv) {
                errors.push('a_s 必须小于板厚（as=' + asV + ', h=' + hv + '）');
            }
            // w0 >= 0, psiW >= 0
            var w0v = parseFloat(p.w0);
            if (isNaN(w0v) || w0v < 0) errors.push('基本风压 w0 不能为负或非法');
            var psiWv = parseFloat(p.psiW);
            if (isNaN(psiWv) || psiWv < 0) errors.push('风荷载组合值系数 psiW 不能为负或非法');
            // z > 0
            var zv = parseFloat(p.z);
            if (!(zv > 0)) errors.push('计算高度 z 必须为正数');

            // CECS 标准下 grade 只能 A3.5/A5.0
            var std = p.std;
            var grd = p.grade;
            if (std === 'cecs' && grd) {
                if (grd !== 'A3.5' && grd !== 'A5.0') {
                    errors.push('T/CECS 553-2018 仅支持 A3.5 和 A5.0，当前: ' + grd);
                }
            }

            // seis=y 时 alpha_max/eta/xi 必填且合法
            if (p.seis === 'y') {
                var am = parseFloat(p.alpha_max);
                if (isNaN(am) || am <= 0) errors.push('验算地震时 alpha_max 必须为正数');
                var eta = parseFloat(p.eta);
                if (isNaN(eta) || eta <= 0) errors.push('验算地震时 eta（功能系数）必须为正数');
                var xi = parseFloat(p.xi);
                if (isNaN(xi) || xi <= 0) errors.push('验算地震时 xi（位置系数）必须为正数');
            }

            return { pass: errors.length === 0, errors: errors };
        },
        adapter_ready: true,
        required_parameters: [
            { name: 'std', label: '计算依据标准', type: 'string', unit: '', required: true, default: 'jgj',
              aliases: ['std', '标准', '依据', '规范', '计算标准', '计算依据'],
              description: 'jgj=JGJ/T 17-2020，cecs=T/CECS 553-2018。默认 jgj。' },
            { name: 'L', label: '板计算跨度 L', type: 'number', unit: 'm', required: true, default: 3.0,
              aliases: ['L', '跨度', '板跨', '计算跨度', '板跨度', '墙板跨度', '层高'],
              description: '墙板水平支承跨度，单位 m。注意：是板的跨度，不是墙高。' },
            { name: 'b', label: '板宽 b', type: 'number', unit: 'mm', required: true, default: 600,
              aliases: ['b', '板宽', '宽度', '墙板宽度', '板宽b'],
              description: '单块板宽度，单位 mm。标准板宽 600mm。注意：b 是板宽，不是梁宽。' },
            { name: 'h', label: '板厚 h', type: 'number', unit: 'mm', required: true, default: 200,
              aliases: ['h', '板厚', '厚度', '墙板厚度', '墙厚', '板厚h'],
              description: '墙板厚度，单位 mm。常用 150/175/200/250/300。注意：h 是板厚，不是梁高。' },
            { name: 'grade', label: 'AAC 强度等级', type: 'string', unit: '', required: true, default: 'A5.0',
              aliases: ['grade', '强度等级', 'AAC等级', '加气强度', '混凝土强度等级'],
              description: 'A2.5/A3.5/A5.0/A7.5。外墙板应≥A5.0。CECS 仅含 A3.5/A5.0。' },
            { name: 'steel', label: '钢筋级别', type: 'string', unit: '', required: true, default: 'CRB600H',
              aliases: ['steel', 'steel_grade', '钢筋', '钢筋级别', '钢筋等级', '纵筋', '受力筋'],
              description: 'HPB300 / CRB600H / HRB400。推荐 CRB600H。' },
            { name: 'bar_diameter', label: '受拉钢筋直径 d', type: 'number', unit: 'mm', required: true, default: 8,
              aliases: ['bar_diameter', 'd', '钢筋直径', '直径', '纵筋直径'],
              description: '单根纵筋直径，单位 mm。范围 5~10mm。' },
            { name: 'bar_count', label: '受拉钢筋根数 n', type: 'number', unit: '根', required: true, default: 4,
              aliases: ['bar_count', 'n', '根数', '钢筋根数', '纵筋根数'],
              description: '板宽方向底部受拉钢筋总根数，正整数。' },
            { name: 'a_s', label: '受拉筋合力点距 a_s', type: 'number', unit: 'mm', required: true, default: 35,
              aliases: ['a_s', 'as', 'as_value', '钢筋合力点距', '受拉筋合力点距', '保护层as'],
              description: '受拉钢筋合力点至受拉边缘距离，单位 mm。AAC 板保护层一般≥25mm。' },
            { name: 'w0', label: '基本风压 w0', type: 'number', unit: 'kN/m²', required: true, default: 0.45,
              aliases: ['w0', '基本风压', '风压', '基本风压w0'],
              description: '基本风压，按 GB 50009 附录 E 取值。' },
            { name: 'terrain', label: '地面粗糙度类别', type: 'string', unit: '', required: true, default: 'B',
              aliases: ['terrain', '地面粗糙度', '粗糙度', '地貌类别', '地面类别'],
              description: 'A/B/C/D 四类。' },
            { name: 'z', label: '计算高度 z', type: 'number', unit: 'm', required: true, default: 10.0,
              aliases: ['z', '高度', '计算高度', '楼层高度', '距地面高度', 'z高度'],
              description: '墙板计算位置距地面高度，单位 m。' },
            { name: 'mu_s', label: '体型系数 μ_s', type: 'number', unit: '', required: true, default: 1.2,
              aliases: ['mu_s', 'mus', 'μs', '体型系数', '风载体型系数'],
              description: '风荷载体型系数，取控制值（绝对值）。' },
            { name: 'gamma0', label: '结构重要性系数 γ0', type: 'number', unit: '', required: true, default: 1.0,
              aliases: ['gamma0', 'γ0', 'gamma_0', '重要性系数', '结构重要性系数'],
              description: '一级=1.1，二级=1.0，三级=0.9。' },
            { name: 'gammaG', label: '永久荷载分项系数 γG', type: 'number', unit: '', required: true, default: 1.3,
              aliases: ['gammaG', 'γG', 'gamma_G', '恒载分项系数', '永久荷载分项系数'],
              description: 'JGJ 默认 1.3，CECS 取 1.3。' },
            { name: 'gammaW', label: '风荷载分项系数 γW', type: 'number', unit: '', required: true, default: 1.5,
              aliases: ['gammaW', 'γW', 'gamma_W', '风载分项系数', '风荷载分项系数'],
              description: 'JGJ 默认 1.4，CECS 取 1.5。' },
            { name: 'psiW', label: '风荷载组合值系数 ψW', type: 'number', unit: '', required: true, default: 0.6,
              aliases: ['psiW', 'ψW', 'psi_w', '风载组合值系数', '风荷载组合值系数'],
              description: '持久状况取 0.6，地震状况取 0.2。' },
            { name: 'seis', label: '是否验算地震', type: 'string', unit: '', required: true, default: 'n',
              aliases: ['seis', '地震', '抗震', '是否验算地震', '是否考虑地震'],
              description: 'y=验算，n=不验算。默认 n。' },
            { name: 'nj', label: '连接件数量 nj', type: 'number', unit: '个', required: true, default: 4,
              aliases: ['nj', '连接件', '连接件数量', '节点数', '连接件个数'],
              description: '每块板连接件总数，正整数。上下各 n/2。' }
        ],
        optional_parameters: [
            { name: 'alpha_max', label: '地震影响系数最大值 αmax', type: 'number', unit: '', required: false, default: 0.08,
              aliases: ['alpha_max', 'amax', 'αmax', '地震影响系数', '地震影响系数最大值'],
              description: '多遇地震：6度=0.04，7度=0.08，8度=0.16。仅 seis=y 时有效。' },
            { name: 'eta', label: '功能系数 η', type: 'number', unit: '', required: false, default: 1.0,
              aliases: ['eta', 'η', '功能系数', '非结构构件功能系数'],
              description: '丙类 1.0，乙类 1.4。仅 seis=y 时有效。' },
            { name: 'xi', label: '位置系数 ξ', type: 'number', unit: '', required: false, default: 1.5,
              aliases: ['xi', 'ξ', '位置系数'],
              description: '顶点 2.0，底部 1.0，沿高度线性分布。仅 seis=y 时有效。' },
            { name: 'gamma0j', label: '连接件重要性系数 γ0j', type: 'number', unit: '', required: false, default: 1.1,
              aliases: ['gamma0j', 'γ0j', '连接件重要性系数', '节点重要性系数'],
              description: '安全等级提高一级，二级→一级取 1.1。' },
            { name: 'seismic_intensity', label: '抗震设防烈度（语义换算用）', type: 'string', unit: '', required: false,
              aliases: ['seismic_intensity', '烈度', '设防烈度', '抗震设防烈度', '抗震烈度'],
              description: '6/7/8 度。给出烈度时自动换算为 alpha_max：6度→0.04，7度→0.08，8度→0.16。仅语义层，不直接写入DOM。' }
        ],
        // 23 项 DOM 映射（全静态）
        parameter_mapping: {
            std:          { domId: 'aw_std',      unit: '' },
            L:            { domId: 'aw_L',        unit: 'm' },
            b:            { domId: 'aw_b',        unit: 'mm' },
            h:            { domId: 'aw_h',        unit: 'mm' },
            grade:        { domId: 'aw_grade',    unit: '' },
            steel:        { domId: 'aw_reb',      unit: '' },
            bar_diameter: { domId: 'aw_d',        unit: 'mm' },
            bar_count:    { domId: 'aw_n',        unit: '' },
            a_s:          { domId: 'aw_as',       unit: 'mm' },
            w0:           { domId: 'aw_w0',       unit: 'kN/m²' },
            terrain:      { domId: 'aw_terrain',  unit: '' },
            z:            { domId: 'aw_z',        unit: 'm' },
            mu_s:         { domId: 'aw_mus',      unit: '' },
            gamma0:       { domId: 'aw_gamm0',    unit: '' },
            gammaG:       { domId: 'aw_gammaG',   unit: '' },
            gammaW:       { domId: 'aw_gammaW',   unit: '' },
            psiW:         { domId: 'aw_psiW',     unit: '' },
            seis:         { domId: 'aw_seis',     unit: '' },
            alpha_max:    { domId: 'aw_amax',     unit: '' },
            eta:          { domId: 'aw_eta',      unit: '' },
            xi:           { domId: 'aw_xi',       unit: '' },
            nj:           { domId: 'aw_nj',       unit: '' },
            gamma0j:      { domId: 'aw_gamma0j',  unit: '' }
        },
        // ===== bridge：按序写入 → 全量 verify → 点计算 → 读 _AW_RESULT =====
        bridge: function (params, callback) {
            _tracePush({ step: 'bridge_entry', tool: 'aac-wall', params_keys: Object.keys(params) });
            var self = this;
            var mapping = self.parameter_mapping;

            // ===== 写入顺序：先 std（触发联动） → 再 grade/gammaG/gammaW 覆盖联动值 → 其余参数 =====
            var writeOrder = [
                'std',                          // 1. 先写标准（change 事件会联动改 gammaG/gammaW/grade）
                'grade', 'gammaG', 'gammaW',    // 2. 立即覆盖 grade 和分项系数（覆盖联动产生的值）
                'L', 'b', 'h',                  // 3. 几何尺寸
                'steel', 'bar_diameter', 'bar_count', 'a_s', // 4. 钢筋参数
                'w0', 'terrain', 'z', 'mu_s',   // 5. 风荷载
                'gamma0', 'psiW',               // 6. 其他系数
                'seis', 'alpha_max', 'eta', 'xi', // 7. 地震
                'nj', 'gamma0j'                 // 8. 节点
            ];

            var written = {};
            for (var wi = 0; wi < writeOrder.length; wi++) {
                var k = writeOrder[wi];
                var v = params[k];
                if (v === undefined || v === null || v === '') continue;
                var domId = mapping[k].domId;
                var el = document.getElementById(domId);
                if (el) {
                    el.value = v;
                    // select 需要触发 change 事件联动（std 要触发）
                    if (k === 'std' && typeof Event !== 'undefined') {
                        try { el.dispatchEvent(new Event('change')); } catch(e) {}
                    }
                    written[k] = String(v);
                }
            }
            _tracePush({
                step: 'bridge_dom_write',
                written_count: Object.keys(written).length,
                written_keys: Object.keys(written)
            });

            // ===== 23 项全量 verify =====
            var allKeys = ['std','L','b','h','grade','steel','bar_diameter','bar_count','a_s',
                           'w0','terrain','z','mu_s','gamma0','gammaG','gammaW','psiW',
                           'seis','alpha_max','eta','xi','nj','gamma0j'];
            var verifyFails = [];
            for (var vi = 0; vi < allKeys.length; vi++) {
                var kk = allKeys[vi];
                var exp = params[kk];
                var did = mapping[kk].domId;
                var el2 = document.getElementById(did);
                if (!el2) { verifyFails.push(kk + '(' + did + '): 元素不存在'); continue; }
                if (exp === undefined || exp === null || exp === '') {
                    // 可选参数未提供：跳过，不算失败
                    continue;
                }
                var act = el2.value;
                var numExp = parseFloat(exp);
                var numAct = parseFloat(act);
                var ok = false;
                if (!isNaN(numExp) && !isNaN(numAct)) ok = Math.abs(numExp - numAct) < 0.0001;
                else ok = String(exp) === String(act);
                if (!ok) verifyFails.push(kk + ': expected=' + exp + ', actual=' + act);
            }
            if (verifyFails.length > 0) {
                _tracePush({
                    step: 'bridge_dom_verify_failed',
                    failures: verifyFails.slice(0, 10),
                    failure_count: verifyFails.length
                });
                callback({
                    success: false,
                    error: 'dom_verify_failed',
                    error_detail: 'DOM 回读校验失败：' + verifyFails.slice(0, 3).join('；'),
                    failures: verifyFails,
                    written: written
                });
                return;
            }
            _tracePush({ step: 'bridge_dom_verify_passed', total: allKeys.length });

            // ===== 点计算 =====
            var calcBtn = document.getElementById('aw_calc');
            if (!calcBtn) {
                _tracePush({ step: 'bridge_result_failed', error: 'aw_calc 按钮不存在' });
                callback({ success: false, error: 'calc_button_not_found' });
                return;
            }
            _tracePush({ step: 'aac_calc_click' });
            calcBtn.click();

            // ===== 读结果 =====
            setTimeout(function () {
                var raw = window._AW_RESULT;
                var errEl = document.querySelector('#aw_result .error-box');
                var errMsg = errEl ? errEl.textContent : '';

                if (errMsg) {
                    _tracePush({ step: 'bridge_result_failed', error: errMsg.substring(0, 80) });
                    callback({ success: false, error: 'calculation_error', error_detail: errMsg, raw: raw });
                    return;
                }
                if (!raw) {
                    _tracePush({ step: 'bridge_result_failed', error: '_AW_RESULT 为空' });
                    callback({ success: false, error: 'result_not_found', error_detail: 'window._AW_RESULT 未生成' });
                    return;
                }

                // Infinity/NaN 检测
                var invalids = [];
                function ck(v, name) {
                    if (typeof v === 'number' && (!isFinite(v) || isNaN(v))) invalids.push(name);
                }
                ck(raw.M, 'M');
                ck(raw.Mu, 'Mu');
                ck(raw.Vmax, 'Vmax');
                ck(raw.sigmaCk, 'sigmaCk');
                ck(raw.defl, 'defl');
                ck(raw.deflLim, 'deflLim');
                ck(raw.Nwj, 'Nwj');
                ck(raw.Rd_node, 'Rd_node');
                if (raw.seisOn) {
                    ck(raw.Mcomb, 'Mcomb');
                    ck(raw.FEk, 'FEk');
                    ck(raw.Vsj, 'Vsj');
                }
                if (invalids.length > 0) {
                    _tracePush({
                        step: 'bridge_result_invalid',
                        invalid_fields: invalids.slice(0, 10),
                        invalid_count: invalids.length
                    });
                    callback({
                        success: false,
                        error: 'calculation_result_invalid',
                        error_detail: '计算结果含 Infinity/NaN，共 ' + invalids.length + ' 处。',
                        invalid_fields: invalids,
                        raw: raw
                    });
                    return;
                }

                // 结构化结果
                var result = {
                    // 基本信息
                    std: raw.std,
                    std_name: raw.stdName,
                    is_cecs: raw.isCECS,
                    grade: raw.grade,
                    steel: raw.rebGrade,

                    // 几何与材料
                    L: raw.L, b: raw.b, h: raw.h, h0: raw.h0,
                    fc: raw.fc, ftk: raw.ftk, ft: raw.ft, Ec: raw.Ec, rho0: raw.rho0,
                    fy: raw.fy, Es: raw.Es,

                    // 配筋
                    bar_diameter: raw.d,
                    bar_count: raw.n,
                    As: raw.As,
                    rho: raw.rho,
                    rho_max: raw.rhoMax,

                    // 自重与风荷载
                    rho_self: raw.rhoSelf,
                    qgk: raw.qgk,
                    w0: raw.w0,
                    terrain: raw.terrain,
                    z: raw.zH,
                    mu_s: raw.mus,
                    muz: raw.muz,
                    bgz: raw.bgz,
                    wk: raw.wk,

                    // 系数
                    gamma0: raw.gamma0,
                    gammaG: raw.gammaG,
                    gammaW: raw.gammaW,
                    psiW: raw.psiW,

                    // 受弯
                    M_design: raw.M,
                    gamma0_M: raw.gamma0 * raw.M,
                    Mu: raw.Mu,
                    cap_ok: raw.capOk,
                    over_reinforced: raw.overRein,
                    x: raw.x,
                    x_max: raw.xMax,

                    // 受剪
                    Vmax: raw.Vmax,
                    tau: raw.tau,
                    tau_ok: raw.tauOk,

                    // 地震（seisOn 时有值）
                    seis_on: raw.seisOn,
                    FEk: raw.FEk,
                    M_earthquake: raw.Mseis,
                    M_comb: raw.Mcomb,
                    seis_ok: raw.seisOk,

                    // 抗裂
                    sigma_ck: raw.sigmaCk,
                    crack_ok: raw.crackOk,
                    crack1_ok: raw.crack1Ok,
                    crack2_ok: raw.crack2Ok,
                    sigma_p: raw.sigmaP,

                    // 挠度
                    I0: raw.I0,
                    Bs: raw.Bs,
                    B: raw.B,
                    defl: raw.defl,
                    defl_lim: raw.deflLim,
                    defl_ok: raw.deflOk,

                    // 连接节点
                    nj: raw.nj,
                    gamma0j: raw.gamma0j,
                    Nwj: raw.Nwj,
                    Rd_node: raw.Rd_node,
                    node_ok: raw.nodeOk,
                    Vsj: raw.Vsj,
                    Ve_total: raw.Ve_total,

                    // 综合判定
                    all_ok: raw.capOk && raw.tauOk && raw.nodeOk && raw.crackOk && raw.deflOk && (!raw.seisOn || raw.seisOk),

                    notes: [
                        '容重/自重由强度等级查表得出，不支持用户单独输入',
                        '竖向外墙板自重沿板面方向（面内），面外受弯荷载仅考虑风+地震',
                        '连接节点为支座反力复核，非正式节点设计'
                    ]
                };

                _tracePush({
                    step: 'result_read_success',
                    Mu: raw.Mu,
                    capOk: raw.capOk,
                    Vmax: raw.Vmax,
                    defl: raw.defl,
                    Nwj: raw.Nwj,
                    all_ok: result.all_ok
                });
                _tracePush({ step: 'bridge_result_success', tool: 'aac-wall' });
                callback({ success: true, result: result, raw: raw });
            }, 80);
        },
        result_mapping: {
            '受弯承载力 Mu': 'Mu',
            '设计弯矩 γ0·M': 'gamma0_M',
            '受弯判定': 'cap_ok',
            '最大剪力 Vmax': 'Vmax',
            '受剪判定': 'tau_ok',
            '抗裂 σ_ck': 'sigma_ck',
            '抗裂判定': 'crack_ok',
            '挠度 f': 'defl',
            '挠度限值': 'defl_lim',
            '挠度判定': 'defl_ok',
            '节点单连接件反力 Nwj': 'Nwj',
            '节点承载力 Rd': 'Rd_node',
            '节点判定': 'node_ok',
            '地震组合弯矩': 'M_comb',
            '地震判定': 'seis_ok'
        }
    };

    /* ==========================================================
     *  工具：预应力混凝土钢管桁架叠合板（l22zg401）
     *  原工具位置：src/l22zg401.js（TOOLS['l22zg401']）
     *  原 calc 入口：模块一 l22_sel_calc 按钮 / 模块二 l22_load_calc / 模块三 l22_st_calc
     *  原结果变量：window._L22_RESULT
     *  输入 DOM id 前缀：l22_
     * ========================================================== */
    var TOOL_L22ZG401 = {
        tool_id: 'l22zg401',
        tool_name: '预应力混凝土钢管桁架叠合板',
        category: '装配式',
        description: '依据 L22ZG401 山东省标图集，进行预应力混凝土钢管桁架叠合板底板选用查询、荷载等级计算、施工阶段验算。',
        applicable_scenarios: 'L22ZG401 预应力混凝土钢管桁架叠合板底板选型、荷载等级判定、施工阶段（脱模/运输/叠合层施工）验算。',
        limitations: [
            '底板选用按图集查表，不做自定义配筋设计',
            '施工阶段验算提供弯矩等中间量，不做截面承载力配筋复核',
            '使用阶段整体受弯、斜截面及叠合面受剪按 GB 50010 附录 H（提示性说明）',
            '仅适用于抗震设防烈度 8 度及以下、环境类别一/二a类' 
        ],
        keywords: ['L22ZG401', '钢管桁架叠合板', '预应力钢管桁架', '预应力混凝土钢管桁架叠合板', 'GDB底板', '山东标叠合板', '张弦叠合板', 'GDB', '底板编号', '叠合板底板'],
        related_standards: [
            { standard: 'L22ZG401', articles: [], note: '山东省建筑标准设计图集·预应力混凝土钢管桁架叠合板' },
            { standard: 'GB/T 50010-2010（2024年版）', articles: ['附录H'], note: '混凝土结构设计规范·叠合构件' }
        ],
        adapter_ready: true,
        required_parameters: [
            { name: 'span', label: '标志跨度', type: 'number', unit: 'mm', required: true, default: 3600, description: '2100 ~ 9600 mm，每300mm一级' },
            { name: 'width', label: '底板宽度', type: 'number', unit: 'mm', required: true, default: 1000, description: '标准宽度 1000/1700/2100 mm；900/1100/1200 非标' },
            { name: 'q_level', label: '允许附加荷载等级', type: 'number', unit: 'kN/m²', required: true, default: 6, description: '6/7/8/9/10 kN/m² 五级' }
        ],
        optional_parameters: [
            { name: 'gk', label: '附加永久荷载标准值 gk', type: 'number', unit: 'kN/m²', required: false, default: 2.0 },
            { name: 'qk', label: '可变荷载标准值 qk', type: 'number', unit: 'kN/m²', required: false, default: 2.0 },
            { name: 'gamma0', label: '结构重要性系数 γ0', type: 'number', unit: '', required: false, default: 1.0 },
            { name: 'gammaG', label: '永久荷载分项系数 γG', type: 'number', unit: '', required: false, default: 1.3 },
            { name: 'gammaQ', label: '可变荷载分项系数 γQ', type: 'number', unit: '', required: false, default: 1.5 },
            { name: 'stage_mode', label: '验算模块', type: 'enum', options: ['select','load','stage'], option_labels: ['底板选用','荷载等级','施工阶段'], required: false, default: 'select' }
        ],
        parameter_mapping: {
            span:       { domId: 'l22_span',       unit: 'mm' },
            width:      { domId: 'l22_width',      unit: 'mm' },
            q_level:    { domId: 'l22_qlevel',     unit: '' },
            gk:         { domId: 'l22_gk',         unit: 'kN/m²' },
            qk:         { domId: 'l22_qk',         unit: 'kN/m²' },
            gamma0:     { domId: 'l22_gamma0',     unit: '' },
            gammaG:     { domId: 'l22_gammaG',     unit: '' },
            gammaQ:     { domId: 'l22_gammaQ',     unit: '' }
        },
        validateParams: function (provided) {
            var errors = [];
            var p = provided || {};
            if (p.span == null) errors.push('缺少标志跨度 span');
            if (p.width == null) errors.push('缺少底板宽度 width');
            if (p.q_level == null) errors.push('缺少允许附加荷载等级 q_level');
            if (p.span != null && (p.span < 2100 || p.span > 9600))
                errors.push('标志跨度超出图集范围（2100~9600mm）');
            return { pass: errors.length === 0, errors: errors };
        },
        bridge: function (params, callback) {
            var mapResult = applyParamsToDOM(params, this.parameter_mapping);
            var required = this.required_parameters || [];
            var missingDom = [];
            required.forEach(function (p) {
                if (mapResult.written[p.name] === undefined) {
                    missingDom.push(p.name);
                }
            });
            if (missingDom.length > 0 || mapResult.mismatches.length > 0) {
                var errMsg = '参数映射失败，已中止计算。' +
                    (missingDom.length > 0 ? ' 未写入DOM的必填项: ' + missingDom.join(', ') : '') +
                    (mapResult.mismatches.length > 0 ? ' 映射不一致: ' + mapResult.mismatches.join('; ') : '');
                callback({
                    success: false,
                    error: 'mapping_mismatch',
                    error_detail: errMsg,
                    missing_dom: missingDom,
                    mismatches: mapResult.mismatches,
                    written: mapResult.written
                });
                return;
            }
            _tracePush({ step: 'bridge_params_ok', tool: 'l22zg401', params_keys: Object.keys(params) });

            // 默认走「底板选用查询」模块
            var mode = params.stage_mode || 'select';
            var btnId = mode === 'load' ? 'l22_load_calc' :
                       mode === 'stage' ? 'l22_st_calc' : 'l22_sel_calc';

            clickBtn(btnId);

            // 读结果
            setTimeout(function () {
                var raw = window._L22_RESULT;
                if (!raw) {
                    callback({ success: false, error: 'no_result', error_detail: '未获取到 _L22_RESULT' });
                    return;
                }
                var result = mapL22Result(raw);
                _tracePush({ step: 'result_read_success', tool: 'l22zg401', module: raw.module });
                _tracePush({ step: 'bridge_result_success', tool: 'l22zg401' });
                callback({ success: true, result: result, raw: raw });
            }, 80);
        },
        result_mapping: {
            '底板编号': 'modelNo',
            '底板长度': 'baseLen_mm',
            '底板厚度': 'hb_mm',
            '叠合层厚度': 'hc_mm',
            '总厚度': 'totalH_mm',
            '混凝土等级': 'concrete',
            '纵向预应力筋根数': 'longBars',
            '纵向预应力筋规格': 'preSpec',
            '横向筋根数': 'transBars',
            '底板自重': 'weight_kg'
        }
    };

    function mapL22Result(raw) {
        var out = { module: raw.module };
        if (raw.module === 'select') {
            out.modelNo = raw.modelNo;
            out.span_mm = raw.actualSpan;
            out.snapped = raw.snapped;
            out.width_mm = raw.width;
            out.baseLen_mm = raw.baseLen;
            out.hb_mm = raw.hb;
            out.hc_mm = raw.hc;
            out.totalH_mm = raw.totalH;
            out.concrete = raw.concrete;
            out.preSpec = raw.preSpec;
            out.preD_mm = raw.preD;
            out.preLen_mm = raw.preLen;
            out.longBars = raw.longBars;
            out.transSpec = raw.transSpec;
            out.transLen_mm = raw.transLen;
            out.transBars = raw.transBars;
            out.vol_m3 = raw.vol;
            out.weight_kg = raw.weight;
            out.q_level = raw.qLevel;
        } else if (raw.module === 'load') {
            out.gk = raw.gk;
            out.qk = raw.qk;
            out.gamma0 = raw.gamma0;
            out.q_design = raw.qDesign;
            out.level = raw.level;
            out.level_label = raw.levelLabel;
            out.out_of_range = raw.outOfRange;
        } else if (raw.module === 'stage') {
            out.stage = raw.stage;
            out.span_mm = raw.span;
            out.width_mm = raw.width;
            out.hc_mm = raw.hc;
            out.hb_mm = raw.hb;
            out.concrete = raw.concrete;
            out.L2_m = raw.L2;
            out.qQ1 = raw.qQ1;
            out.q1 = raw.q1;
            out.M1 = raw.M1;
        }
        return out;
    }

    /* ==========================================================
     *  注册表导出到全局
     * ========================================================== */
    var registry = [
        TOOL_STAGE_CHECK,
        TOOL_BEAM_RECT,
        TOOL_BEAM_SHEAR,
        TOOL_BEAM_T,
        TOOL_BEAM_CONT,
        TOOL_FOOTING_COL,
        TOOL_COLUMN_AXIAL,
        TOOL_SLAB_RECT,
        TOOL_STAIR_SLAB,
        TOOL_AAC_WALL,
        TOOL_L22ZG401
    ];

    var registryMap = {};
    registry.forEach(function (t) { registryMap[t.tool_id] = t; });

    window.AI_TOOL_REGISTRY = {
        list: registry,
        map: registryMap,
        get: function (id) { return registryMap[id]; },
        detectTBeamFeatures: detectTBeamFeatures,
        detectContinuousBeamFeatures: detectContinuousBeamFeatures,
        detectStairFeatures: detectStairFeatures,
        detectAacWallFeatures: detectAacWallFeatures,
        detectL22zg401Features: detectL22zg401Features,
        detectColumnFeatures: detectColumnFeatures,
        detectSlabFeatures: detectSlabFeatures,
        detectFoundationFeatures: detectFoundationFeatures,
        getReadyAdapters: function () {
            return registry.filter(function (t) { return t.bridge !== null && t.bridge !== undefined; });
        },
        // 关键词搜索（用于fallback和辅助匹配）
        searchByKeyword: function (query) {
            var q = query.toLowerCase();
            var results = [];
            registry.forEach(function (t) {
                var score = 0;
                if (t.tool_name.indexOf(query) >= 0) score += 100;
                (t.keywords || []).forEach(function (kw) {
                    if (q.indexOf(kw.toLowerCase()) >= 0) score += 30;
                    if (kw.toLowerCase().indexOf(q) >= 0) score += 15;
                });
                if (t.description.indexOf(query) >= 0) score += 10;
                if (score > 0) results.push({ tool: t, score: score });
            });

            // ===== T形截面特征强制提升 =====
            // 凡输入含 T形梁/T梁/翼缘/bf/hf 任一特征 → beam-t 加 1000 分强制为首，压过 beam-rect
            var feat = detectTBeamFeatures(query);
            if (feat.hasTFeature) {
                for (var i = 0; i < results.length; i++) {
                    if (results[i].tool.tool_id === 'beam-t') {
                        results[i].score += 1000;
                        _tracePush({
                            step: 'route_t_beam_promoted',
                            input: query.substring(0, 40),
                            reason: 'found T-beam features: ' + feat.features.join('/')
                        });
                        break;
                    }
                }
            }

            // ===== 轴心受压柱特征强制提升 =====
             // 凡输入含轴心受压柱/轴压/计算长度/l0 等特征 且 不含梁特征 → column-axial 加 1000 分强制为首
             var colFeat = detectColumnFeatures(query);
             if (colFeat.hasColumnFeature && !colFeat.hasBeamFeature) {
                 for (var ci = 0; ci < results.length; ci++) {
                     if (results[ci].tool.tool_id === 'column-axial') {
                         results[ci].score += 1000;
                         _tracePush({
                             step: 'route_column',
                             input: query.substring(0, 40),
                             reason: 'found column features: ' + colFeat.features.join('/')
                         });
                         break;
                     }
                 }
             }

              // ===== AAC 外墙板特征强制提升（在板之前判定，避免被板厚/板宽泛词拐走） =====
              // 极强特征（AAC/加气/ALC/外墙板/A5.0/CRB600H 等）→ aac-wall 加 2000 分，压过 slab-rect 的 1000 分
              var aacFeat = detectAacWallFeatures(query);
              if (aacFeat.hasAacWall && aacFeat.strongMatch) {
                  var aacBonus = aacFeat.veryStrong ? 2000 : 1100;
                  for (var ai = 0; ai < results.length; ai++) {
                      if (results[ai].tool.tool_id === 'aac-wall') {
                          results[ai].score += aacBonus;
                          _tracePush({
                              step: 'route_aac',
                              input: query.substring(0, 40),
                              reason: 'found AAC wall features: ' + aacFeat.features.join('/') + ' (veryStrong=' + aacFeat.veryStrong + ', bonus=' + aacBonus + ')'
                          });
                   break;
                       }
                   }
               }

               // ===== L22ZG401 预应力钢管桁架叠合板特征强制提升 =====
               var l22Feat = detectL22zg401Features(query);
               if (l22Feat.hasL22 && l22Feat.strongMatch) {
                   for (var li = 0; li < results.length; li++) {
                       if (results[li].tool.tool_id === 'l22zg401') {
                           results[li].score += 2000;
                           _tracePush({
                               step: 'route_l22zg401',
                               input: query.substring(0, 40),
                               reason: 'found L22ZG401 features: ' + l22Feat.features.join('/')
                           });
                           break;
                       }
                   }
               }

              // ===== 单块矩形板特征强制提升 =====
              // 凡输入含板/板厚/单向板/双向板/四边支承 等特征 且 不含梁/柱/基础/AAC等互斥特征 → slab-rect 加 1000 分强制为首
             var slabFeat = detectSlabFeatures(query);
             if (slabFeat.hasSlabFeature && !slabFeat.hasExclusiveFeature) {
                 for (var si = 0; si < results.length; si++) {
                     if (results[si].tool.tool_id === 'slab-rect') {
                         results[si].score += 1000;
                         _tracePush({
                             step: 'route_slab',
                             input: query.substring(0, 40),
                             reason: 'found slab features: ' + slabFeat.features.join('/')
                         });
                         break;
                     }
                 }
             }

             // ===== 柱下独立基础特征强制提升 =====
             // 凡输入含独立基础/柱下基础/地基承载力/基底面积 等特征 且 不含梁/柱/板/楼梯等互斥特征 → footing-col 加 1000 分强制为首
             var foundFeat = detectFoundationFeatures(query);
             if (foundFeat.hasFoundationFeature && !foundFeat.hasExclusiveFeature) {
                 for (var fi = 0; fi < results.length; fi++) {
                     if (results[fi].tool.tool_id === 'footing-col') {
                         results[fi].score += 1000;
                         _tracePush({
                             step: 'route_foundation',
                             input: query.substring(0, 40),
                             reason: 'found foundation features: ' + foundFeat.features.join('/')
                         });
                         break;
                     }
                 }
              }

              // ===== 连续梁特征强制提升 =====
              // 凡输入含 连续梁/三弯矩/多跨/支座弯矩 等特征 → beam-cont 加 1000 分强制为首
              var contFeat = detectContinuousBeamFeatures(query);
              if (contFeat.hasContinuousBeam) {
                  for (var ci = 0; ci < results.length; ci++) {
                      if (results[ci].tool.tool_id === 'beam-cont') {
                          results[ci].score += 1000;
                          _tracePush({
                              step: 'route_continuous_beam',
                              input: query.substring(0, 40),
                              reason: 'found continuous beam features: ' + contFeat.features.join('/')
                          });
                          break;
                      }
                  }
              }

              // ===== 板式楼梯特征强制提升 =====
              // 凡输入含 楼梯/踏步/梯段/平台板 等特征 → stair-slab 加 1000 分强制为首
              var stairFeat = detectStairFeatures(query);
              if (stairFeat.hasStair && stairFeat.strongMatch) {
                  for (var si = 0; si < results.length; si++) {
                      if (results[si].tool.tool_id === 'stair-slab') {
                          results[si].score += 1000;
                          _tracePush({
                              step: 'route_stair',
                              input: query.substring(0, 40),
                              reason: 'found stair features: ' + stairFeat.features.join('/')
                          });
                          break;
                      }
                  }
              }

              // ===== AAC 外墙板特征强制提升 =====
               var aacFeat = detectAacWallFeatures(query);
               if (aacFeat.hasAacWall && aacFeat.strongMatch) {
                   for (var ai = 0; ai < results.length; ai++) {
                       if (results[ai].tool.tool_id === 'aac-wall') {
                           results[ai].score += 1000;
                           _tracePush({
                               step: 'route_aac',
                               input: query.substring(0, 40),
                               reason: 'found AAC wall features: ' + aacFeat.features.join('/')
                           });
                           break;
                       }
                   }
               }

              results.sort(function (a, b) { return b.score - a.score; });
            return results;
        }
    };

    console.log('[AI Tool Registry] 已注册 ' + registry.length + ' 个工具，其中已接adapter: ' +
        registry.filter(function (t) { return t.bridge; }).length + ' 个');
})();
