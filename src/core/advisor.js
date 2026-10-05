/* ============================================================
 *  core/advisor.js — 结果解读与整改建议（纯本地，不依赖任何 API）
 * ------------------------------------------------------------
 *  设计目标：让 69 个计算模块在「算完」之后都能自动多出一段人话解读，
 *  而不是只给一串数字。为此本模块：
 *    1. 读取当前工具页的结果区与计算过程区（统一的 .result-item /
 *       .proc-body .step 结构），不修改任何计算模块；
 *    2. 判定「满足 / 不满足 / 需注意」，并给出针对性的整改方向
 *       （加大截面？提高强度等级？加抗冲切钢筋？…按规范常见做法给）；
 *    3. 从本地规范知识库按工具 ID 反查关联条文条号，方便回查原文；
 *    4. 提供「生成计算书（Word）」「打印」的一键入口。
 *
 *  说明：本模块给出的是设计思路与整改方向，不代替工程师判断；
 *  条文摘编需与规范正文核对。
 * ============================================================ */
(function () {
    'use strict';

    /* ===================== 1. 判定词表 ===================== */
    var BAD_WORDS = ['不满足', '不通过', '超限', '超出限值', '超筋', '少筋', '不适用',
        '无法判定', '不足', '大于限值', '小于限值', '不满足要求', '需要调整'];
    var GOOD_WORDS = ['满足', '通过', '符合', '适筋', '合格', '安全'];
    var WARN_WORDS = ['构造控制', '按构造配筋', '需注意', '偏小', '接近限值', '临界'];

    /* ===================== 2. 整改建议规则表 ===================== */
    /* k：命中关键词（结果文本中出现任一即命中）；w：为什么会这样；
       a：按「性价比」排序的整改动作，第一条通常是最有效的。 */
    var RULES = [
        {
            k: ['超筋', 'ξ > ξb', 'ξ大于', 'x > ξb', '受压区高度过大'],
            t: '超筋（受拉钢筋过多 / 受压区过高）',
            w: '受压区高度 x 超过界限值 ξb·h₀，钢筋在混凝土压碎前无法屈服，破坏呈脆性，规范不允许。',
            a: ['首选加大截面高度 h（承载力量级提升，最经济）；',
                '其次提高混凝土强度等级（增大 α₁f_c）；',
                '也可加宽截面 b，或改为双筋截面由受压钢筋分担；',
                '单纯增加受拉钢筋对超筋无效，反而更不利。']
        },
        {
            k: ['少筋', '小于最小配筋', '按构造配筋', '构造控制', 'ρmin', 'ρ < ρmin'],
            t: '少筋 / 构造配筋控制',
            w: '计算所需配筋小于最小配筋率要求，说明截面由构造而非受力控制，配筋量必须按 ρmin 抬高。',
            a: ['按 A_s,min = ρmin·b·h 配筋（ρmin 取 0.2% 与 0.45f_t/f_y 的较大值）；',
                '若截面过大导致「构造控制」，可考虑减小截面尺寸以取得经济性；',
                '注意受拉钢筋不宜少于 2Φ12（梁）、板分布筋不宜小于 Φ6@200 等构造要求。']
        },
        {
            k: ['裂缝', 'wmax', 'w <', '裂缝宽度'],
            t: '裂缝宽度超限',
            w: '按荷载准永久组合计算的最大裂缝宽度超过规范限值，耐久性或观感不满足。',
            a: ['减小钢筋直径、加密间距（同面积下「小直径多根」比「大直径少根」更有效）；',
                '增加受拉配筋面积，降低钢筋应力 σ_sk（最直接）；',
                '加大保护层厚度 c 有明显效果，但会增大 a_s，需与承载力一并复核；',
                '对预应力构件可施加预压应力；环境类别提高时（二a、二b）限值更严，需重算。']
        },
        {
            k: ['挠度', '变形超', '挠度超'],
            t: '挠度（变形）超限',
            w: '按荷载准永久组合并考虑长期刚度的挠度超过规范限值。',
            a: ['加大截面高度 h 最有效（挠度与 h³ 近似成反比）；',
                '增加受拉配筋可提高短期刚度 B_s，但影响有限；',
                '提高混凝土强度等级、减小计算跨度；',
                '对预制构件可采取预起拱，减少外观与使用影响。']
        },
        {
            k: ['冲切', '抗冲切'],
            t: '受冲切承载力不足',
            w: '板（或基础）在集中荷载作用处的冲切面承载力不足，可能导致脆性冲切破坏。',
            a: ['加厚板是最有效手段（承载力近似与 h₀ 成正比）；',
                '设置柱帽 / 托板，扩大冲切周长；',
                '配置抗冲切箍筋或栓钉（弯起钢筋），注意配筋范围与构造；',
                '提高混凝土强度等级、加大柱截面尺寸也可提高抗力。']
        },
        {
            k: ['局部受压', '局部承压', '局压'],
            t: '局部受压承载力不足',
            w: '集中力作用面积过小，局部压应力超过混凝土局部受压承载力。',
            a: ['加设钢垫板 / 垫块，扩大局部受压计算面积 A_l；',
                '配置间接钢筋（方格网或螺旋筋）可显著提高局压承载力；',
                '提高混凝土强度等级；',
                '分散传力，避免多点集中。']
        },
        {
            k: ['抗浮', '浮托', '抗拔'],
            t: '抗浮稳定性不足',
            w: '地下水浮力超过结构自重与压重之和，结构可能上浮或底板受弯开裂。',
            a: ['增加结构自重或覆土压重（最直接、最可靠）；',
                '设置抗拔桩 / 抗拔锚杆，抗拔承载力需按抗拔系数折减；',
                '采取排水减压措施，但必须有长期可靠的排水保证，不能单独依赖；',
                '施工期间（未覆土时）是最不利工况，需单独验算并设置临时降水或锚固。']
        },
        {
            k: ['抗滑', '滑移'],
            t: '抗滑移稳定性不足',
            w: '基底摩擦阻力不足以抵抗水平力。',
            a: ['加宽墙踵（增大竖向力对基底的压重）；',
                '基底设置抗滑键（齿坎）；',
                '加大基础埋深，利用被动土压力；',
                '必要时设置倾斜基底或与相邻结构连接。']
        },
        {
            k: ['抗倾覆', '倾覆'],
            t: '抗倾覆稳定性不足',
            w: '倾覆力矩大于稳定力矩，结构可能整体倾覆。',
            a: ['加宽墙趾，增大稳定力臂；',
                '减小上部水平力（改变形式或增加支承）；',
                '加大结构自重或加深基础埋置；',
                '注意活荷载的不利布置，倾覆验算取最不利组合。']
        },
        {
            k: ['地基承载力', '基底压力', 'fak', 'fa <', '承载力不足'],
            t: '地基承载力不足',
            w: '基底压力超过修正后的地基承载力特征值 f_a。',
            a: ['加大基础底面尺寸（最直接）；',
                '加深埋置深度，利用深度修正提高 f_a（须复核修正适用条件）；',
                '改换持力层或进行地基处理（换填、夯实、CFG 桩等）；',
                '改用桩基础；偏心荷载下还应复核基底压力的最大 / 最小值。']
        },
        {
            k: ['沉降', '倾斜', '沉降差'],
            t: '地基沉降（或差异沉降）超限',
            w: '计算沉降量或相邻基础沉降差超过规范允许值，可能引起结构开裂或影响使用。',
            a: ['减小基底附加压力（加大基础尺寸或减轻上部荷载）；',
                '加大基础刚度（筏板、箱基）以匀化沉降；',
                '进行地基处理或改用桩基，控制主要压缩层变形；',
                '设置沉降后浇带、控制施工加载速率；必要时进行沉降观测。']
        },
        {
            k: ['软弱下卧层', '下卧层'],
            t: '软弱下卧层验算不满足',
            w: '持力层以下的软弱土层顶面附加应力超过其承载力。',
            a: ['加大基础底面尺寸，减小附加应力传递到软弱层；',
                '加大基础埋深，使应力扩散更充分；',
                '对软弱下卧层进行加固处理；',
                '扩大基础形式（筏板）或改用桩基穿透软弱层。']
        },
        {
            k: ['稳定', '整体稳定', '稳定不'],
            t: '构件（或结构）稳定承载力不足',
            w: '构件在压力下可能失稳，稳定承载力低于强度承载力。',
            a: ['减小计算长度（增设侧向支撑或加设支撑体系）——影响最大；',
                '加大截面，优先加大弱轴方向的回转半径 i；',
                '选用回转半径更大的截面形式（工字形优于矩形）；',
                '注意计算长度系数 μ 的取值与实际支承条件一致。']
        },
        {
            k: ['长细比', 'λ >', 'λ超'],
            t: '长细比超限',
            w: '构件长细比超过规范限值，稳定与刚度储备不足。',
            a: ['减小计算长度；',
                '加大截面回转半径（加大截面高度方向尺寸）；',
                '改变截面形式或设置中间支撑。']
        },
        {
            k: ['宽厚比'],
            t: '板件宽厚比超限',
            w: '钢构件板件宽厚比过大，局部失稳先于整体失稳发生。',
            a: ['加厚板件或减小外伸宽度；',
                '设置纵向加劲肋；',
                '调整抗震等级对应的宽厚比限值（不同等级限值不同）。']
        },
        {
            k: ['高厚比'],
            t: '墙、柱高厚比超限',
            w: '砌体墙柱高厚比超过允许值，稳定性不足。',
            a: ['增设壁柱、构造柱或圈梁，减小计算高度；',
                '减小墙体高度或加大墙厚；',
                '提高砌体强度等级或采用配筋砌体；',
                '调整支承条件（如增加楼板约束）。']
        },
        {
            k: ['轴压比'],
            t: '柱轴压比超限',
            w: '轴压比超限说明柱受压过大，延性不足，抗震不利。',
            a: ['加大柱截面（最直接）；',
                '提高混凝土强度等级；',
                '设置芯柱或型钢（型钢混凝土柱）；',
                '减小上部荷载或调整传力路径。']
        },
        {
            k: ['剪压比', '截面尺寸'],
            t: '截面尺寸控制条件（剪压比）不满足',
            w: '剪力过大导致截面尺寸不足，即使配筋也无法满足，属强制性上限。',
            a: ['加大截面尺寸（只能是加大截面或提高混凝土强度）；',
                '提高混凝土强度等级；',
                '调整结构布置，增大抗侧力构件数量以分担剪力。']
        },
        {
            k: ['层间位移', '位移角'],
            t: '层间位移角超限',
            w: '结构侧向刚度不足，变形超限，会加重非结构构件破坏。',
            a: ['增加抗侧力构件（剪力墙、支撑）或加大其截面；',
                '加大柱、墙截面尺寸；',
                '提高混凝土强度等级；',
                '调整结构平面布置，减小扭转效应。']
        },
        {
            k: ['桩承载力', '单桩', '桩侧', '桩端'],
            t: '桩基承载力不满足',
            w: '单桩（或群桩）竖向承载力特征值不足。',
            a: ['加大桩径或桩长（提高侧阻与端阻）；',
                '增加桩数、调整桩距；',
                '选择更好的持力层作为桩端持力层；',
                '复核负摩阻、群桩效应与承台效应的影响。']
        },
        {
            k: ['焊缝', '角焊缝'],
            t: '焊缝承载力不足',
            w: '焊缝计算应力超过焊缝强度设计值。',
            a: ['加大焊脚尺寸 h_f（正比提升）；',
                '增加焊缝长度或改为连续焊；',
                '改用高强匹配的焊材或改变连接构造使受力更均匀；',
                '注意角焊缝有效厚度按 0.7h_f 计算。']
        },
        {
            k: ['螺栓', '高强螺栓'],
            t: '螺栓连接受力不足',
            w: '螺栓抗剪或抗拉承载力不足，或孔壁承压不满足。',
            a: ['增加螺栓数量、加大螺栓直径；',
                '改用高强螺栓（摩擦型 / 承压型）；',
                '加大板厚或提高钢材强度以改善孔壁承压；',
                '调整螺栓排列，减小偏心。']
        },
        {
            k: ['锚栓', '柱脚'],
            t: '锚栓受拉不足',
            w: '柱底弯矩作用下锚栓拉力超过其承载力。',
            a: ['加大锚栓直径或增加数量；',
                '加大柱底反力作用的力臂（调整柱脚底板尺寸）；',
                '采用加劲肋 / 靴梁改善传力；',
                '复核锚栓锚固长度与埋深。']
        },
        {
            k: ['保护层', '锚固长度', '搭接'],
            t: '保护层 / 锚固 / 搭接构造不满足',
            w: '构造要求不满足会直接影响耐久性与传力可靠性，属规范强制性要求。',
            a: ['按环境类别确定最小保护层厚度 c（并注意施工偏差要求）；',
                '锚固长度按 l_a = α·(f_y/f_t)·d 计算，必要时乘修正系数；',
                '搭接长度按 l_l = ζ·l_a，同一截面搭接接头面积百分率控制；',
                '锚固长度不足时可采用弯钩、机械锚固或加大锚固区配筋。']
        },
        {
            k: ['叠合', '两阶段'],
            t: '叠合构件两阶段验算不满足',
            w: '叠合构件施工阶段（预制构件单独受力）与使用阶段的受力状态不同，需分别验算。',
            a: ['加大预制底板厚度或配筋，提高施工阶段承载与刚度；',
                '增加临时支撑，减小施工阶段跨度；',
                '调整混凝土强度等级与龄期（施工阶段按实际强度取值）；',
                '复核叠合面抗剪构造。']
        },
        {
            k: ['隔震', '减震系数', '隔震层'],
            t: '隔震设计验算不满足',
            w: '隔震层位移超限或减震系数不满足目标，隔震效果不足。',
            a: ['增加隔震支座数量或调整型号（提高等效刚度 / 阻尼）；',
                '调整隔震层偏心率，控制扭转；',
                '复核罕遇地震下隔震层最大位移与支座变形能力；',
                '设置阻尼器补充耗能；检查隔震缝宽度是否满足位移要求。']
        },
        {
            k: ['荷载组合', '分项系数', '组合值系数'],
            t: '荷载组合取值需注意',
            w: '荷载组合的分项系数、组合值系数取值直接影响结果，取错会导致偏差。',
            a: ['永久荷载对结构有利 / 不利时 γ_G 分别取 1.0 / 1.3（旧规范 1.35）；',
                '可变荷载控制与永久荷载控制两种情形都要算，取最不利；',
                '活荷载标准值 ≥ 4 kN/m² 时 γ_Q 取 1.4，否则一般 1.5；',
                '按 GB 50068-2018 第 8 章与 GB 55001-2021 核对系数取值。']
        }
    ];

    /* 无规则命中时的通用建议 */
    var FALLBACK_ADVICE = [
        '先核验输入参数（截面尺寸、材料等级、荷载与计算长度）是否与设计条件一致——多数「不满足」源于参数取值偏差；',
        '复核所选计算模型与规范的适用条件（如是否为深受弯构件、是否需要考虑二阶效应）；',
        '若截面已接近边界，优先调整截面尺寸或材料强度等级，而不是单纯增加钢筋；',
        '把「计算过程」导出为计算书，逐条核对公式与系数后再做设计决策。'
    ];

    /* ===================== 3. 读取结果区 ===================== */
    function textOf(html) {
        return String(html || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 判断节点是否位于解读面板内部（避免自己写的内容反过来影响判定）
     */
    function insideAdvisor(el) {
        var node = el;
        while (node) {
            if (node.id === 'rsAdvisor') return true;
            node = node.parentNode;
        }
        return false;
    }

    /**
     * 抓取当前工具页的结果与过程文本
     * @param {Element} view #view 容器
     */
    function readView(view) {
        var rows = [], flags = [], steps = [];
        if (!view || !view.querySelectorAll) return { rows: rows, flags: flags, steps: steps };

        var items = view.querySelectorAll('.result-item');
        for (var i = 0; i < items.length; i++) {
            if (insideAdvisor(items[i])) continue;
            var l = items[i].querySelector ? items[i].querySelector('.label') : null;
            var v = items[i].querySelector ? items[i].querySelector('.value') : null;
            if (l && v) rows.push({ label: textOf(l.innerHTML), val: textOf(v.innerHTML) });
        }

        // 徽标 / 结论标签 / 错误框
        ['.badge', '.badge-ok', '.badge-warn', '.badge-info', '.badge-err', '.error-box', '.tag'].forEach(function (sel) {
            var els = view.querySelectorAll(sel);
            for (var j = 0; j < els.length; j++) {
                if (insideAdvisor(els[j])) continue;
                var tx = textOf(els[j].innerHTML);
                if (tx && tx.length <= 60) flags.push(tx);
            }
        });

        var ss = view.querySelectorAll('.proc-body .step');
        for (var k = 0; k < ss.length; k++) {
            if (insideAdvisor(ss[k])) continue;
            steps.push(textOf(ss[k].innerHTML));
        }

        return { rows: rows, flags: flags, steps: steps };
    }

    /* ===================== 4. 生成结论 ===================== */
    function countHits(text, words) {
        var hit = [];
        words.forEach(function (w) { if (text.indexOf(w) > -1) hit.push(w); });
        return hit;
    }

    function analyze(view, toolId) {
        view = view || document.getElementById('view');
        var data = readView(view);

        // 判定结论：结果行 + 结论标签 + 计算过程都要看（结论常写在过程里）
        var all = data.rows.map(function (r) { return r.label + ' ' + r.val; }).join(' | ') + ' || ' +
            data.flags.join(' | ') + ' || ' + data.steps.join(' ');
        // 规则匹配：只看结果行与结论标签。
        // 计算过程里有大量「还应完成裂缝宽度、挠度验算」之类的模板提示，
        // 若一并参与匹配会误报出并不存在的整改项。
        var ruleText = data.rows.length
            ? (data.rows.map(function (r) { return r.label + ' ' + r.val; }).join(' | ') + ' || ' + data.flags.join(' | '))
            : all;

        var bad = countHits(all, BAD_WORDS);
        var good = countHits(all, GOOD_WORDS);
        var warn = countHits(all, WARN_WORDS);
        var badRows = data.rows.filter(function (r) { return countHits(r.val + r.label, BAD_WORDS).length > 0; });

        var advices = [];
        RULES.forEach(function (rule) {
            if (countHits(ruleText, rule.k).length > 0) advices.push(rule);
        });

        var verdict;
        if (!data.rows.length && !data.steps.length) verdict = 'empty';
        else if (bad.length) verdict = 'fail';
        else if (warn.length) verdict = 'warn';
        else verdict = 'pass';

        return {
            toolId: toolId || window.CUR_TOOL || '',
            toolTitle: (window.TOOLS && window.TOOLS[toolId || window.CUR_TOOL] && window.TOOLS[toolId || window.CUR_TOOL].title) || '',
            rows: data.rows, flags: data.flags, steps: data.steps,
            badWords: bad, goodWords: good, warnWords: warn, badRows: badRows,
            advices: advices, verdict: verdict
        };
    }

    /* ===================== 5. 渲染面板 ===================== */
    var VERDICT_STYLE = {
        pass: { bg: '#eef8f1', bd: '#bfe3cb', fg: '#1d6b3f', icon: '✓', label: '各项验算均满足（或未检出不满足项）' },
        warn: { bg: '#fdf6e6', bd: '#e6cf9a', fg: '#8a6412', icon: '!', label: '结果可用，但有按构造控制 / 接近限值的项，需注意' },
        fail: { bg: '#fdeeee', bd: '#f0c2c2', fg: '#a32626', icon: '×', label: '存在不满足项，需调整设计' },
        empty: { bg: '#f4f6f9', bd: '#dfe3e9', fg: '#6b7686', icon: 'i', label: '当前模块还没有计算结果' }
    };

    function renderPanel(res) {
        var s = VERDICT_STYLE[res.verdict] || VERDICT_STYLE.empty;
        var h = [];

        h.push('<div class="rs-verdict" style="background:' + s.bg + ';border:1px solid ' + s.bd + ';color:' + s.fg + '">' +
            '<b style="font-size:15px">' + s.icon + ' ' + s.label + '</b>' +
            (res.toolTitle ? '<span style="opacity:.75;font-size:12px;margin-left:8px">' + res.toolTitle + '</span>' : '') +
            '</div>');

        if (res.verdict === 'empty') {
            h.push('<div class="rs-note">请先在上方完成一次计算，再查看这里的解读与建议。' +
                '本解读完全在本机完成，不联网、不需要 API Key。</div>');
            return h.join('');
        }

        /* ① 结果速读 */
        if (res.rows.length) {
            h.push('<div class="rs-sec"><div class="rs-sec-title">① 结果速读</div><div class="rs-rows">' +
                res.rows.slice(0, 14).map(function (r) {
                    var isBad = countHits(r.val + r.label, BAD_WORDS).length > 0;
                    return '<div class="rs-row' + (isBad ? ' bad' : '') + '"><span class="rs-k">' + r.label + '</span>' +
                        '<span class="rs-v">' + r.val + '</span></div>';
                }).join('') + '</div>' +
                (res.rows.length > 14 ? '<div class="rs-more">（共 ' + res.rows.length + ' 项，此处仅列出前 14 项）</div>' : '') +
                '</div>');
        }

        /* ② 不满足项清单 */
        if (res.verdict === 'fail') {
            var list = [];
            if (res.badRows.length) {
                list = res.badRows.map(function (r) { return r.label + '：' + r.val; });
            } else {
                res.steps.forEach(function (t) {
                    if (countHits(t, BAD_WORDS).length) list.push(t.length > 160 ? t.slice(0, 160) + '……' : t);
                });
            }
            h.push('<div class="rs-sec"><div class="rs-sec-title">② 检出的问题项</div><ul class="rs-ul">' +
                (list.length ? list.slice(0, 8).map(function (t) { return '<li>' + t + '</li>'; }).join('')
                    : '<li>结果文本中出现了「' + res.badWords.slice(0, 4).join('、') + '」等提示，但未定位到具体条目，请展开「计算过程」逐条核对。</li>') +
                '</ul></div>');
        }

        /* ③ 整改建议 / 相关要点 */
        var idx = res.verdict === 'fail' ? '③' : '②';
        if (res.advices.length) {
            // 只有判定为「不满足」时才叫「整改建议」；其余情况是命中规则库的要点提示
            var secTitle = res.verdict === 'fail'
                ? idx + ' 整改建议（按有效程度排序）'
                : idx + ' 相关计算要点（本地规则库命中，供复核参考）';
            h.push('<div class="rs-sec"><div class="rs-sec-title">' + secTitle + '</div>');
            res.advices.slice(0, 4).forEach(function (rule) {
                h.push('<div class="rs-adv">' +
                    '<div class="rs-adv-t">' + rule.t + '</div>' +
                    '<div class="rs-adv-w"><b>原因：</b>' + rule.w + '</div>' +
                    '<ul class="rs-ul">' + rule.a.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ul>' +
                    '</div>');
            });
            h.push('</div>');
        } else if (res.verdict === 'fail') {
            h.push('<div class="rs-sec"><div class="rs-sec-title">' + idx + ' 整改建议</div><ul class="rs-ul">' +
                FALLBACK_ADVICE.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ul></div>');
        } else if (res.verdict === 'warn') {
            h.push('<div class="rs-sec"><div class="rs-sec-title">' + idx + ' 留意事项</div>' +
                '<div class="rs-adv"><div class="rs-adv-t">构造控制 / 接近限值</div>' +
                '<div class="rs-adv-w"><b>原因：</b>结果中出现了「' + res.warnWords.slice(0, 4).join('、') +
                '」，说明控制因素不是受力计算，而是构造要求或限值边界。</div>' +
                '<ul class="rs-ul"><li>按构造要求取最小值配筋时，仍应复核正截面承载力与裂缝宽度；</li>' +
                '<li>若为「接近限值」，建议留出不少于 5% 的富余量，避免施工偏差导致超限；</li>' +
                '<li>把本页参数存为「参数方案」，调整少量参数重算即可看到敏感度。</li></ul></div></div>');
        }
        return h.join('');
    }

    /* 关联条文（异步，从本地知识库） */
    function renderClauses(host, toolId) {
        if (!window.KNOWLEDGE_BASE || !window.KNOWLEDGE_BASE.getStandardsForTool) return;
        if (!host) return;
        window.KNOWLEDGE_BASE.getStandardsForTool(toolId, function (list) {
            if (!list || !list.length) return;
            // 重复回调防护：先清掉已有的条文块
            var olds = host.querySelectorAll ? host.querySelectorAll('.rs-extra') : [];
            for (var i = olds.length - 1; i >= 0; i--) if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);

            var box = document.createElement('div');
            box.className = 'rs-sec rs-extra';
            box.innerHTML = '<div class="rs-sec-title">相关规范条文（本地知识库）</div><div class="rs-clauses">' +
                list.slice(0, 8).map(function (a) {
                    return '<a class="rs-clause" href="#/local-qa" title="在「规范条文问答（本地）」中查看全文">' +
                        '<b>' + a.standard_name + '</b> ' + (a.article || '') + '　' + (a.title || '') + '</a>';
                }).join('') + '</div>' +
                '<div class="rs-more">条文为本地摘编，正式设计前请与规范正文核对条号与取值。</div>';
            host.appendChild(box);
        });
    }

    /* ===================== 6. 样式 ===================== */
    function ensureStyle() {
        if (document.getElementById('rs-advisor-style')) return;
        var css = document.createElement('style');
        css.id = 'rs-advisor-style';
        css.textContent = [
            '.rs-advisor{margin:16px 0;border:1px solid var(--hairline);border-radius:10px;background:var(--canvas);overflow:hidden}',
            '.rs-advisor-head{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--canvas-soft);border-bottom:1px solid var(--hairline);cursor:pointer;user-select:none}',
            '.rs-advisor-head .rs-t{font-size:13.5px;font-weight:600;color:var(--ink)}',
            '.rs-advisor-head .rs-badge{font-size:11px;padding:2px 7px;border-radius:9999px;background:var(--primary-bg-subdued);color:var(--primary-deep);border:1px solid var(--primary-line)}',
            '.rs-advisor-head .rs-tog{margin-left:auto;font-size:12px;color:var(--ink-mute)}',
            '.rs-advisor-body{padding:14px;display:none}',
            '.rs-advisor.open .rs-advisor-body{display:block}',
            '.rs-verdict{padding:10px 13px;border-radius:8px;margin-bottom:14px;font-size:13px;line-height:1.7}',
            '.rs-sec{margin-bottom:16px}',
            '.rs-sec:last-child{margin-bottom:0}',
            '.rs-sec-title{font-size:13px;font-weight:600;color:var(--ink);margin-bottom:8px;padding-left:8px;border-left:3px solid var(--primary)}',
            '.rs-rows{display:flex;flex-direction:column;gap:1px;background:var(--hairline);border:1px solid var(--hairline);border-radius:8px;overflow:hidden}',
            '.rs-row{display:flex;gap:12px;padding:7px 11px;background:#fff;font-size:12.8px;line-height:1.65}',
            '.rs-row.bad{background:#fdf3f3}',
            '.rs-k{flex:0 0 44%;color:var(--ink-mute)}',
            '.rs-v{flex:1;color:var(--ink);font-weight:500}',
            '.rs-row.bad .rs-v{color:#a32626}',
            '.rs-more{font-size:11.5px;color:var(--ink-faint);margin-top:6px}',
            '.rs-note{font-size:12.8px;color:var(--ink-mute);line-height:1.85}',
            '.rs-ul{margin:6px 0 0;padding-left:20px;font-size:12.8px;line-height:1.9;color:var(--ink-secondary)}',
            '.rs-ul li{margin-bottom:2px}',
            '.rs-adv{border:1px solid var(--hairline);border-radius:8px;padding:11px 13px;margin-bottom:10px;background:var(--canvas-soft)}',
            '.rs-adv-t{font-size:13px;font-weight:600;color:var(--primary-deep);margin-bottom:5px}',
            '.rs-adv-w{font-size:12.5px;line-height:1.8;color:var(--ink-secondary)}',
            '.rs-clauses{display:flex;flex-direction:column;gap:5px}',
            '.rs-clause{font-size:12.5px;color:var(--primary-deep);text-decoration:none;padding:6px 10px;border:1px solid var(--primary-line);background:var(--primary-bg-subdued);border-radius:6px;line-height:1.6}',
            '.rs-clause:hover{background:#d3e4f8}',
            '.rs-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
            '@media (max-width:640px){.rs-k{flex:0 0 100%}.rs-row{flex-direction:column;gap:2px}}'
        ].join('\n');
        document.head.appendChild(css);
    }

    /* ===================== 7. 挂载到工具页 ===================== */
    var lastSig = '';
    var bodyEl = null, togEl = null;

    /* 只有真正的工具页才挂载解读面板（首页 / 未知路由不挂） */
    function isToolView(view) {
        if (!view || !view.querySelector) return false;
        if (!(window.CUR_TOOL && window.TOOLS && window.TOOLS[window.CUR_TOOL])) return false;
        return !!view.querySelector('.tool-head');
    }

    function signatureOf(res) {
        return res.verdict + '|' + res.toolId + '|' + res.rows.map(function (r) { return r.val; }).join('~') +
            '|' + res.steps.length;
    }

    function mount(view, toolId, force) {
        if (!view || !view.appendChild) return;
        ensureStyle();

        if (!isToolView(view)) {
            var stale = document.getElementById('rsAdvisor');
            if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
            lastSig = '';
            return;
        }

        var res = analyze(view, toolId);
        var sig = signatureOf(res);

        // 还没算过 → 不主动占位（用户点「结果解读与建议」时再强制显示）
        if (!force && res.verdict === 'empty') {
            var idle = document.getElementById('rsAdvisor');
            if (idle && idle.parentNode) idle.parentNode.removeChild(idle);
            lastSig = '';
            return;
        }

        var panel = document.getElementById('rsAdvisor');
        // 内容未变化且面板已在位 → 直接返回，避免 MutationObserver 自激循环
        if (panel && panel.parentNode === view && sig === lastSig && !force) return;

        if (!panel) {
            /* 面板骨架用 createElement 逐层搭建，而不是先写 innerHTML 再 getElementById
               —— 这样在无 HTML 解析器的环境下（自动化测试）也能正常工作 */
            panel = document.createElement('div');
            panel.id = 'rsAdvisor';
            panel.className = 'rs-advisor';

            var headEl = document.createElement('div');
            headEl.className = 'rs-advisor-head';
            headEl.id = 'rsAdvisorHead';

            var tEl = document.createElement('span');
            tEl.className = 'rs-t';
            tEl.innerHTML = '结果解读与整改建议';
            var bEl = document.createElement('span');
            bEl.className = 'rs-badge';
            bEl.innerHTML = '本地运行 · 无需 API Key';
            togEl = document.createElement('span');
            togEl.className = 'rs-tog';
            togEl.id = 'rsAdvisorTog';
            togEl.innerHTML = '展开 ▾';

            headEl.appendChild(tEl);
            headEl.appendChild(bEl);
            headEl.appendChild(togEl);

            bodyEl = document.createElement('div');
            bodyEl.className = 'rs-advisor-body';
            bodyEl.id = 'rsAdvisorBody';

            panel.appendChild(headEl);
            panel.appendChild(bodyEl);

            // 优先放在「详细计算过程」面板之前，没有则追加到末尾
            var proc = view.querySelector ? view.querySelector('.proc-wrap') : null;
            if (proc && proc.parentNode === view) view.insertBefore(panel, proc);
            else view.appendChild(panel);

            headEl.addEventListener('click', function () {
                panel.classList.toggle('open');
                if (togEl) togEl.innerHTML = panel.classList.contains('open') ? '收起 ▴' : '展开 ▾';
            });
        } else if (panel.parentNode !== view) {
            view.appendChild(panel);
        }

        if (!bodyEl || bodyEl.parentNode !== panel) {
            // 面板已存在但引用丢失（例如被外部重建）→ 重新取一次
            bodyEl = document.getElementById('rsAdvisorBody');
            togEl = document.getElementById('rsAdvisorTog');
        }
        if (!bodyEl) return;
        bodyEl.innerHTML = renderPanel(res);

        // 关联本地条文（body 已被整体替换，此处重新异步追加）
        if (res.toolId && res.verdict !== 'empty') renderClauses(bodyEl, res.toolId);

        // 判定为「不满足」时自动展开，省一次点击
        if (res.verdict === 'fail') {
            panel.classList.add('open');
            if (togEl) togEl.innerHTML = '收起 ▴';
        }
        lastSig = signatureOf(res);
    }

    /* 结果区变化后自动刷新（防抖） */
    var timer = null;
    function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
            timer = null;
            mount(document.getElementById('view'), window.CUR_TOOL);
        }, 350);
    }

    function startObserve() {
        ensureStyle();
        if (!window.MutationObserver) return;
        var view = document.getElementById('view');
        if (!view) {
            setTimeout(startObserve, 500);
            return;
        }
        var mo = new MutationObserver(function () {
            // 自身面板变化不触发刷新，避免死循环
            schedule();
        });
        mo.observe(view, { childList: true, subtree: true, characterData: true });
    }

    /* 供 ux.js 动作条调用：强制展开 */
    function openForCurrent() {
        mount(document.getElementById('view'), window.CUR_TOOL, true);
        var panel = document.getElementById('rsAdvisor');
        if (panel) {
            panel.classList.add('open');
            var tog = document.getElementById('rsAdvisorTog');
            if (tog) tog.textContent = '收起 ▴';
            if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    window.RESULT_ADVISOR = {
        analyze: analyze,
        mount: mount,
        openForCurrent: openForCurrent,
        renderPanel: renderPanel,
        rules: RULES
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserve);
    else startObserve();

    console.log('[Advisor] advisor.js loaded. 结果解读 / 整改建议 / 关联条文就绪（纯本地）。');
})();
