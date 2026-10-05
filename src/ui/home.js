/* ============================================================
 *  ui/home.js — 首页与首页增强
 * ------------------------------------------------------------
 *  renderHome()：首页 Hero、分组工具卡片、统计数字；
 *  首页增强：移动端顶栏、工具快速查找、常用入口、卡片键盘可达性。
 * ============================================================ */
function renderHome() {
    var html = '';

    // 动态统计工具数量
    var totalToolIds = Object.keys(window.TOOLS || {}).length;
    var hasCalcAssistant = window.TOOLS && window.TOOLS['calc-assistant'];
    var hasLocalQA = window.TOOLS && window.TOOLS['local-qa'];
    var nonCalcCount = (hasCalcAssistant ? 1 : 0) + (hasLocalQA ? 1 : 0);
    var calcToolCount = totalToolIds - nonCalcCount;
    var aiCount = nonCalcCount;

    // 分组数据：按结构设计流程排序
    var groups = [
        {
            key: 'bending', name: '受弯构件', desc: '梁、板等受弯构件正截面与斜截面承载力计算',
            icon: 'beam',
            tools: [
                { id: 'beam-rect', t: '矩形梁正截面承载力', d: '单筋 / 双筋矩形截面受弯承载力复核，含界限受压区高度与最小配筋率验算。', code: 'GB 6.2.10' },
                { id: 'beam-t', t: 'T形梁正截面承载力', d: '第一类 / 第二类 T 形截面判别与受弯承载力计算，适配装配式双T板等常见截面。', code: 'GB 6.2.11' },
                { id: 'beam-shear', t: '梁斜截面受剪承载力', d: '仅配箍筋受剪承载力复核与所需配箍面积计算，含截面限制条件验算。', code: 'GB 6.3.1 / 6.3.4' },
                { id: 'beam-cont', t: '连续梁计算（三弯矩方程）', d: '2~10 跨等截面连续梁内力分析（三弯矩方程），含支座与跨中弯矩、剪力、正截面配筋与斜截面配箍。', code: '结构力学 / GB 6.2.10' },
                { id: 'addl-trans', t: '附加横向钢筋', d: '梁中集中荷载作用处附加横向钢筋（附加箍筋 / 吊筋 / 两者组合）面积计算与配筋建议。', code: 'GB/T 50010-2010（2024年版） 第 9.2.11 条' }
            ]
        },
        {
            key: 'slab', name: '板与楼梯', desc: '单向板、双向板、板式楼梯等水平构件计算',
            icon: 'slab',
            tools: [
                { id: 'slab-rect', t: '单块矩形板计算', d: '四边支承矩形板，按长短边比判别单向/双向板，弹性理论查表法计算跨中与支座弯矩并配筋。', code: '弹性薄板理论 / GB 6.2.10' },
                { id: 'stair-slab', t: '板式楼梯计算', d: '梯段斜板 + 平台板内力与配筋计算，含恒载、活载组合，梯梁简化验算提示。', code: 'GB 50009 / GB 6.2.10' }
            ]
        },
        {
            key: 'column', name: '受压构件', desc: '轴心、偏心受压柱承载力与稳定验算',
            icon: 'column',
            tools: [
                { id: 'column-axial', t: '轴心受压柱承载力', d: '普通箍筋柱承载力复核与纵筋面积计算，自动按长细比取稳定系数 φ。', code: 'GB 6.2.15' }
            ]
        },
        {
            key: 'check', name: '构件验算', desc: '裂缝宽度、挠度、冲切、局部受压等专项验算',
            icon: 'check',
            tools: [
                { id: 'crack-width', t: '裂缝宽度计算', d: '受弯构件最大裂缝宽度 w_max 计算，含有效受拉配筋率、钢筋应力、应变不均匀系数及与限值比较。', code: 'GB/T 50010-2010（2024年版） 第 7.1 章' },
                { id: 'deflection', t: '挠度验算', d: '受弯构件短期刚度 B_s、长期刚度 B 及挠度 f 计算，与规范挠度限值比较判定。', code: 'GB/T 50010-2010（2024年版） 第 7.2 章' },
                { id: 'punching', t: '受冲切承载力验算', d: '不配置箍筋/弯起钢筋板受冲切承载力验算，含 η 系数计算。', code: 'GB/T 50010-2010（2024年版） 第 6.5 章' },
                { id: 'bearing-local', t: '混凝土局部受压', d: '局部受压承载力验算，含局部受压面积、计算底面积、配间接钢筋提高验算。', code: 'GB/T 50010-2010（2024年版） 第 6.6 章' },
                { id: 'corbel', t: '牛腿设计', d: '钢筋混凝土短牛腿截面尺寸验算、纵向受力钢筋、箍筋及弯起钢筋配置。', code: 'GB/T 50010-2010（2024年版） 第 9.3 章' },
                { id: 'deep-beam', t: '深受弯构件（深梁）', d: '跨高比 l0/h ≤ 5 的深受弯构件正截面与斜截面受剪承载力，按附录 G 公式。', code: 'GB/T 50010-2010（2024年版） 附录 G' }
            ]
        },
        {
            key: 'precast', name: '装配式', desc: '叠合构件、外墙板与锚固件设计验算',
            icon: 'precast',
            tools: [
                { id: 'stage-check', t: '叠合构件两阶段验算', d: '叠合板 / 叠合梁施工阶段第一阶段承载力、受拉钢筋应力与叠合面受剪验算。', code: 'GB/T 50010-2010（2024年版） 附录 H' },
                { id: 'l22zg401', t: '预应力钢管桁架叠合板', d: 'L22ZG401 预应力混凝土钢管桁架叠合板：底板选用查询、荷载等级计算、施工阶段验算。', code: 'L22ZG401 鲁2022' },
                { id: 'aac-wall', t: '蒸压加气混凝土外墙板', d: '竖向外墙板风荷载面外受弯、受剪、抗裂、挠度、地震作用与连接节点验算，T/CECS 553 对称配筋公式。', code: 'JGJ/T 17-2020 / T/CECS 553-2018' },
                { id: 'anchor', t: '保温外墙锚固件设计', d: '预制反打保温外墙锚固件的反向拉拔、局部承压、混凝土抗拔、尾盘抗拉承载力验算，风荷载 / 地震作用组合与构造要求。', code: '《外墙保温一体化系统应用技术标准（预制混凝土反打保温外墙）》5.5' },
                { id: 'td-slab', t: '钢筋桁架楼板选型', d: '钢筋桁架楼承板选型与验算，含施工阶段挠度、受弯承载力及使用阶段叠合面受剪验算。', code: '22G522-1 / GB 55001-2021' }
            ]
        },
        {
            key: 'foundation', name: '地基基础', desc: '独立基础、条形基础、地基承载力与沉降',
            icon: 'footing',
            tools: [
                { id: 'footing-col', t: '柱下独立基础计算', d: '轴心/偏心受压独立基础：基底面积确定、地基承载力验算、冲切验算、底板双向配筋。', code: 'GB 50007-2011 / GB 6.2.10' },
                { id: 'footing-wall', t: '墙下条形基础计算', d: '扩展式条形基础：基础宽度确定、高度验算、底板横向受力筋与纵向分布筋。', code: 'GB 50007-2011 / GB 6.2.10' },
                { id: 'bearing-cap', t: '地基承载力验算', d: '独基 / 条基地基承载力特征值修正、基底压力与偏心距控制。', code: 'GB 50007-2011 第 5.2 条' },
                { id: 'settlement', t: '地基沉降计算', d: '分层总和法计算地基最终沉降量，含附加应力系数、各层沉降量与总沉降。', code: 'GB 50007-2011 第 5.3 条' },
                { id: 'bearing-theory', t: '承载力理论公式法', d: '按土的抗剪强度指标（c、φ）确定地基承载力特征值，含承载力系数Mb/Md/Mc查表。', code: 'GB 50007-2011 §5.2.5' },
                { id: 'soft-underlayer', t: '软弱下卧层验算', d: '附加应力扩散计算、压力扩散角查表、软弱下卧层顶面承载力验算。', code: 'GB 50007-2011 §5.2.7' },
                { id: 'anti-uplift', t: '抗浮稳定性验算', d: '水池/建筑抗浮验算，含行车荷载、浮托力折减系数ηfw、GB 50069水池抗浮，整体/局部抗浮，不满足时给出措施建议。', code: 'GB 50007 §5.4.3 / JGJ 476 / GB 50069 §5.2.4 / GB 55003 §6.1.3' },
                { id: 'rigid-found', t: '无筋扩展条形基础', d: '刚性基础底宽确定与高度验算，满足台阶宽高比与刚性角要求。', code: 'GB 50007-2011 第 8.1 条' }
            ]
        },
        {
            key: 'pile', name: '桩基', desc: '单桩承载力、桩承台、桩基沉降与水平力',
            icon: 'pile',
            tools: [
                { id: 'pile-cap', t: '独立桩承台计算', d: '柱下独立桩承台：各桩反力分配、柱下与角桩冲切、承台受弯配筋、斜截面受剪。', code: 'JGJ 94-2008 第 5.9 条' },
                { id: 'pile-single', t: '单桩竖向承载力', d: '按土的物理指标经验参数法：侧阻 + 端阻计算 Ra = upΣqsikli + qpkAp。', code: 'JGJ 94-2008 第 5.3 条' },
                { id: 'pile-bearing', t: '桩基竖向承载力验算', d: '群桩基础 Nk ≤ Ra、Nkmax ≤ 1.2Ra 验算，含承台效应与偏心反力分配。', code: 'JGJ 94-2008 第 5.1 / 5.2 条' },
                { id: 'pile-horizontal', t: '桩基水平承载力', d: '单桩水平承载力特征值计算（m 法），含桩身抗弯刚度、水平变形系数 α。', code: 'JGJ 94-2008 第 5.7 条' },
                { id: 'pile-settle', t: '桩基沉降计算', d: '等效作用分层总和法，等效作用面位于桩端平面，含附加应力系数与总沉降。', code: 'JGJ 94-2008 第 5.5 条' },
                { id: 'pile-bearing-55003', t: '桩基验算(GB55003)', d: '按GB 55003-2021验算桩基竖向承载力：标准/地震/偏心4种工况，Ra=Quk/K。', code: 'GB 55003-2021 §5.2' }
            ]
        },
        {
            key: 'masonry', name: '砌体结构', desc: '砌体受压、局部受压、过梁、挑梁、墙梁',
            icon: 'masonry',
            tools: [
                { id: 'mas-comp', t: '砌体受压承载力与高厚比', d: '砌体墙 / 柱受压承载力 φfA 验算与高厚比 β ≤ μ1μ2[β] 验算。', code: 'GB 50003-2011 第 5.1、6.1 条' },
                { id: 'mas-local', t: '砌体局部受压验算', d: '梁端支承处、垫块下砌体局部受压承载力验算，含局部抗压强度提高系数 γ。', code: 'GB 50003-2011 第 5.2 条' },
                { id: 'lintel', t: '过梁与圈梁计算', d: '砖砌平拱 / 钢筋砖 / 钢筋混凝土过梁的荷载、跨中弯矩与配筋。', code: 'GB 50003-2011 第 7.1、7.2 条' },
                { id: 'cantilever', t: '挑梁计算', d: '砌体中挑梁抗倾覆验算、挑梁下砌体局部受压、挑梁正截面与斜截面承载力。', code: 'GB 50003-2011 第 7.4 条' },
                { id: 'balcony', t: '阳台雨篷挑檐计算', d: '悬挑板弯矩剪力、抗倾覆验算与钢筋混凝土配筋，含施工检修荷载。', code: 'GB 50009 / GB 50010 / GB 50003' },
                { id: 'wall-beam', t: '墙梁计算', d: '简支墙梁托梁弯矩系数、剪力系数、正截面配筋与斜截面受剪，墙体受剪承载力验算。', code: 'GB 50003-2011 第 7.3 条' }
            ]
        },
        {
            key: 'steel', name: '钢结构', desc: '钢柱、钢梁、螺栓、焊缝、锚栓',
            icon: 'steel',
            tools: [
                { id: 'steel-column', t: '钢柱受压承载力', d: '实腹式钢柱轴心受压整体稳定验算，含长细比、稳定系数 φ、毛截面面积 A。', code: 'GB 50017-2017 第 7.2 节' },
                { id: 'steel-beam', t: '钢梁受弯承载力', d: '工字形 / H 型钢梁抗弯强度、抗剪强度、整体稳定与局部受压验算。', code: 'GB 50017-2017 第 6 章' },
                { id: 'bolt', t: '螺栓连接计算', d: '普通螺栓 / 高强度螺栓受剪、受拉及拉剪共同作用承载力计算，含孔壁承压。', code: 'GB 50017-2017 第 11 章' },
                { id: 'weld', t: '焊缝连接计算', d: '直角角焊缝、斜角角焊缝、部分焊透对接焊缝强度验算，含角焊缝有效厚度。', code: 'GB 50017-2017 第 11.2 节' },
                { id: 'anchor-bolt', t: '柱脚锚栓计算', d: '刚接柱脚锚栓受拉承载力与直径验算，含拉力由柱底弯矩及轴力共同作用。', code: 'GB 50017-2017 第 12 章' }
            ]
        },
        {
            key: 'misc', name: '综合计算', desc: '荷载组合、地震、水池、挡土墙、吊车等',
            icon: 'misc',
            tools: [
                { id: 'load-combo', t: '荷载组合计算', d: '基本组合 / 标准组合 / 准永久组合 / 地震组合，含可变荷载组合值系数。', code: 'GB 50009-2012 / GB/T 50011-2010（2024年版）' },
                { id: 'seismic', t: '地震作用计算', d: '底部剪力法计算水平地震作用，含等效总重力荷载、特征周期、水平影响系数 α。', code: 'GB/T 50011-2010（2024年版） 第 5 章' },
                { id: 'seismic-perf', t: '抗震性能化设计', d: '按性能目标 1~4 / 性能水准 1~4 验算构件承载力与变形，给出性能评价。', code: 'GB/T 50011-2010（2024年版） 第 3.10 节 / MCMO-01' },
                { id: 'wind-snow', t: '风荷载与雪荷载', d: '基本风压 / 基本雪压与各系数计算，含风压高度变化、体型系数、风振系数。', code: 'GB 50009-2012 第 7、8 章' },
                { id: 'rebar-area', t: '钢筋面积查表', d: '单根钢筋面积、间距配筋面积速查与根数反算，含常用直径 6~40。', code: 'GB/T 50010-2010（2024年版） 附表' },
                { id: 'rebar-pick', t: '配筋选筋助手', d: '由需求钢筋面积反查可行配筋：梁柱按直径×根数、板墙按直径×间距，含超配率与最小根数。', code: 'GB/T 50010-2010（2024年版） 第 9 章 / GB 1499.2' },
                { id: 'rho-min', t: '最小配筋率验算', d: '按构件类型、受力钢筋、混凝土强度等级验算最小配筋率是否满足。', code: 'GB/T 50010-2010（2024年版） 第 8.5 条' },
                { id: 'pool-rect', t: '矩形水池计算', d: '矩形水池池壁水平/竖向弯矩与配筋，含静水压力、土压力、地下水浮力。', code: 'GB 50069-2002 / 结构力学' },
                { id: 'pool-circ', t: '圆形水池计算', d: '圆形水池池壁环向/竖向弯矩与配筋，含静水压力、土压力、地下水浮力。', code: 'GB 50069-2002 / 结构力学' },
                { id: 'retain-cant', t: '悬臂式挡土墙', d: '重力式 / 悬臂式挡土墙抗滑、抗倾覆、地基承载力验算与墙身配筋建议。', code: 'GB 50007-2011 第 6 章' },
                { id: 'retain-butt', t: '扶壁式挡土墙', d: '扶壁式挡土墙整体稳定验算与立板、底板、扶壁配筋计算。', code: 'GB 50007-2011 第 6 章' },
                { id: 'basement-wall', t: '地下室外墙计算', d: '地下室外墙承受土压力、水压力、地面堆载，按竖向单向板计算配筋。', code: 'GB 50010 / GB 50007' },
                { id: 'floor-live', t: '楼屋面活荷载', d: '常用建筑活荷载标准值查询与折减系数计算，含楼面活荷载折减。', code: 'GB 50009-2012 表 5.1.1' },
                { id: 'crane-load', t: '吊车荷载计算', d: '桥式吊车竖向 / 水平荷载标准值计算，含动力系数与多台折减。', code: 'GB 50009-2012 第 6 章' },
                { id: 'temp-action', t: '温度作用计算', d: '混凝土结构温度伸缩缝间距与温度应力估算，含徐变折减。', code: 'GB 50009-2012 第 9 章 / GB 50010' },
                { id: 'joint-core', t: '梁柱节点核心区', d: '框架梁柱节点核心区受剪承载力验算，含约束影响系数 η_j、正交梁约束。', code: 'GB/T 50011-2010（2024年版） 附录 D' },
                { id: 'col-tie', t: '柱箍筋加密区', d: '框架柱箍筋加密区长度、最大间距、最小直径与体积配箍率验算。', code: 'GB/T 50011-2010（2024年版） 第 6.3 节' },
                { id: 'steel-seismic', t: '钢结构抗震验算', d: '钢框架梁柱节点抗震验算，含强柱弱梁、强节点弱构件系数与板件宽厚比。', code: 'GB/T 50011-2010（2024年版） 第 8 章' },
                { id: 'masonry-seismic', t: '砌体抗震验算', d: '多层砌体房屋抗震承载力验算，含楼层剪力分配、墙段抗剪承载力与构造措施。', code: 'GB/T 50011-2010（2024年版） 第 7 章' },
                { id: 'shear-wall', t: '剪力墙截面验算', d: '剪力墙正截面偏心受压、斜截面受剪、截面尺寸限制与分布筋配筋率验算。', code: 'GB/T 50011-2010（2024年版） 第 6.2 / 6.3 节' },
                { id: 'embed-plate', t: '预埋件设计', d: '受剪、受拉、拉剪共同作用预埋件锚筋面积计算与构造要求。', code: 'GB/T 50010-2010（2024年版） 第 9.7 条' },
                { id: 'isolation', t: '隔震设计计算', d: '基础隔震层水平等效刚度、等效阻尼比、隔震后水平地震作用与位移验算。', code: 'GB/T 50011-2010（2024年版） 第 12 章' },
                { id: 'calc-assistant', t: '智能计算助手', d: '基于 AI 的结构计算助手：输入参数自动生成计算书、规范条文查询、结果解释。', code: 'AI 驱动' },
                { id: 'local-qa', t: '规范条文问答（本地）', d: '本地规范知识库问答、当前结果解读与整改建议、一组弯矩批量配筋对比，无需 API Key。', code: '本地知识库' }
            ]
        }
    ];

    // Hero 区
    html += '<div class="home-hero">' +
        '<div class="hero-mesh"><svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
                '<radialGradient id="g1" cx="15%" cy="60%" r="45%"><stop offset="0%" stop-color="#f96bee" stop-opacity="0.55"/><stop offset="100%" stop-color="#f96bee" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g2" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="#533afd" stop-opacity="0.50"/><stop offset="100%" stop-color="#533afd" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g3" cx="85%" cy="55%" r="40%"><stop offset="0%" stop-color="#ea2261" stop-opacity="0.45"/><stop offset="100%" stop-color="#ea2261" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g4" cx="30%" cy="20%" r="35%"><stop offset="0%" stop-color="#f5e9d4" stop-opacity="0.70"/><stop offset="100%" stop-color="#f5e9d4" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g5" cx="70%" cy="80%" r="45%"><stop offset="0%" stop-color="#b9b9f9" stop-opacity="0.50"/><stop offset="100%" stop-color="#b9b9f9" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g6" cx="95%" cy="25%" r="30%"><stop offset="0%" stop-color="#f5e9d4" stop-opacity="0.40"/><stop offset="100%" stop-color="#f5e9d4" stop-opacity="0"/></radialGradient>' +
            '</defs>' +
            '<rect width="1200" height="220" fill="#f6f9fc"/>' +
            '<ellipse cx="180" cy="132" rx="280" ry="120" fill="url(#g1)"/>' +
            '<ellipse cx="600" cy="88" rx="420" ry="110" fill="url(#g2)"/>' +
            '<ellipse cx="1020" cy="121" rx="320" ry="130" fill="url(#g3)"/>' +
            '<ellipse cx="360" cy="44" rx="240" ry="80" fill="url(#g4)"/>' +
            '<ellipse cx="840" cy="176" rx="380" ry="90" fill="url(#g5)"/>' +
            '<ellipse cx="1140" cy="55" rx="200" ry="70" fill="url(#g6)"/>' +
        '</svg></div>' +
        '<div class="hero-content">' +
        '<span class="eyebrow">Structural Toolkit</span>' +
        '<h1>计算工具箱</h1>' +
        '<p class="subtitle">基于现行国家规范的结构工程常用计算工具，涵盖混凝土受弯受压、砌体结构、地基基础、桩基、钢结构、装配式等 ' + calcToolCount + ' 个计算模块，所有结果均提供可追溯的详细计算过程。</p>' +
        '<div class="home-stats">' +
            '<div class="stat"><span class="num">' + calcToolCount + '</span><span class="lbl">个专业计算工具</span></div>' +
            '<div class="stat"><span class="num">' + groups.length + '</span><span class="lbl">专业分组</span></div>' +
            (aiCount > 0 ? '<div class="stat"><span class="num">' + aiCount + '</span><span class="lbl">个 AI 助手</span></div>' : '') +
            '<div class="stat"><span class="num">10+</span><span class="lbl">规范依据</span></div>' +
            '<div class="stat"><span class="num">Word</span><span class="lbl">计算书导出</span></div>' +
        '</div>' +
        '<div class="quick-entry">' +
            '<a href="#/calc-assistant" style="background:linear-gradient(135deg,#533afd,#ea2261);color:#fff;border:none">' + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> 智能计算助手</a>' +
            '<a href="#/beam-cont">' + iconFor('beam', 16) + ' 连续梁计算</a>' +
            '<a href="#/footing-col" class="secondary">' + iconFor('footing', 16) + ' 柱下独立基础</a>' +
            '<a href="#/stage-check" class="secondary">' + iconFor('precast', 16) + ' 叠合构件验算</a>' +
        '</div>' +
        '</div>' +
    '</div>';



    // 渲染分组
    groups.forEach(function (g) {
        html += '<div class="tool-section sec-' + g.key + '">' +
            '<div class="tool-section-head">' +
                '<div class="sec-title">' +
                    '<span class="sec-icon">' + iconFor(g.icon, 18) + '</span>' +
                    g.name +
                '</div>' +
                '<span class="sec-count">' + g.tools.length + ' 个工具</span>' +
                '<span class="sec-desc">' + g.desc + '</span>' +
            '</div>' +
            '<div class="section-grid">';
        g.tools.forEach(function (t) {
            html += '<a class="section-card" href="#/' + t.id + '">' +
                '<div class="card-top">' +
                    '<div class="card-icon">' + iconFor(g.icon, 18) + '</div>' +
                    '<h3>' + t.t + '</h3>' +
                '</div>' +
                '<p>' + t.d + '</p>' +
                '<div class="card-foot">' +
                    '<span class="code-tag">' + t.code + '</span>' +
                    '<span class="go-arrow">打开 →</span>' +
                '</div>' +
            '</a>';
        });
        html += '</div></div>';
    });

    // 底部说明 — 暖奶油色带
    html += '<div class="home-footer cream-band">' +
        '<h4>规范依据</h4>' +
        '<div>本工具箱计算均依据现行国家规范与行业标准，所有结果均附带详细计算过程，便于校核与追溯。</div>' +
        '<div class="norms">' +
            '<span>GB/T 50010-2010（2024年版）混凝土结构设计标准</span>' +
            '<span>GB 50003-2011 砌体结构设计规范</span>' +
            '<span>GB 50007-2011 建筑地基基础设计规范</span>' +
            '<span>GB 50009-2012 建筑结构荷载规范</span>' +
            '<span>GB/T 50011-2010（2024年版）建筑抗震设计标准</span>' +
            '<span>GB 50017-2017 钢结构设计标准</span>' +
            '<span>JGJ 94-2008 建筑桩基技术规范</span>' +
            '<span>JGJ 1-2014 装配式混凝土结构技术规程</span>' +
            '<span>JGJ/T 17-2020 蒸压加气混凝土制品应用技术标准</span>' +
            '<span>GB 50666-2011 混凝土结构工程施工规范</span>' +
            '<span>GB 50069-2002 给水排水工程构筑物结构设计规范</span>' +
        '</div>' +
        '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">' +
            '<b style="color:#0f172a;">免责声明：</b>本工具箱用于学习与设计初算验证。实际工程应结合抗震要求、构造规定、钢筋实配直径与保护层等综合设计，重要构件请以专业计算软件或设计院复核为准。' +
        '</div>' +
    '</div>';

    view.innerHTML = html;
    navActive('home');
    closeSidebar();
    // 交互增强层：最近使用 / 我的收藏 快捷块（ui/ux.js）
    if (window.UX && window.UX.onHomeRendered) window.UX.onHomeRendered();
}


/* ===== TYAI 增强：搜索、快捷入口、移动端优化 ===== */
(function () {
    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }
    ready(function () {
        enhanceMobileNav();
        enhanceHomeSearch();
        enhanceCards();
    });
    function enhanceMobileNav() {
        if (!document.querySelector('.topbar')) {
            var topbar = document.createElement('div');
            topbar.className = 'topbar';
            topbar.innerHTML = `
                <button class="menu-btn" type="button" aria-label="打开导航">☰</button>
                <div class="mobile-brand">计算工具箱</div>
                <span style="width:36px"></span>
            `;
            document.body.insertBefore(topbar, document.body.firstChild);
        }
        if (!document.querySelector('.mask')) {
            var mask = document.createElement('div');
            mask.className = 'mask';
            document.body.appendChild(mask);
        }
        var menuBtn = document.querySelector('.menu-btn');
        var maskEl = document.querySelector('.mask');
        if (menuBtn) {
            menuBtn.addEventListener('click', function () {
                document.body.classList.add('sidebar-open');
            });
        }
        if (maskEl) {
            maskEl.addEventListener('click', function () {
                document.body.classList.remove('sidebar-open');
            });
        }
        document.querySelectorAll('.sidebar a').forEach(function (a) {
            a.addEventListener('click', function () {
                document.body.classList.remove('sidebar-open');
            });
        });
    }
    function enhanceHomeSearch() {
        var firstSection = document.querySelector('.tool-section');
        var hero = document.querySelector('.home-hero');
        if (!firstSection || document.querySelector('.tyai-home-tools')) return;
        var toolsPanel = document.createElement('div');
        toolsPanel.className = 'tyai-home-tools';
        toolsPanel.innerHTML = `
            <div class="tyai-search-panel">
                <div class="tyai-search-title">快速查找工具</div>
                <div class="tyai-search-box">
                    <input id="tyaiToolSearch" type="search" placeholder="输入关键词，例如：连续梁、裂缝、柱下独立基础、钢筋桁架楼板">
                    <span class="tyai-search-icon">⌕</span>
                </div>
                <div class="tyai-search-hint">支持按工具名称、说明文字、规范编号进行筛选。快捷键：按 / 聚焦搜索。</div>
            </div>
            <div class="tyai-fav-panel">
                <div class="tyai-fav-title">常用入口</div>
                <div class="tyai-fav-list" id="tyaiFavList"></div>
            </div>
        `;
        if (hero && hero.parentNode) {
            hero.parentNode.insertBefore(toolsPanel, hero.nextSibling);
        } else {
            firstSection.parentNode.insertBefore(toolsPanel, firstSection);
        }
        var noResult = document.createElement('div');
        noResult.className = 'tyai-no-result';
        noResult.textContent = '未找到匹配工具，请尝试更换关键词。';
        firstSection.parentNode.insertBefore(noResult, firstSection);
        buildFavList();
        bindSearch(noResult);
    }
    function buildFavList() {
        var favList = document.getElementById('tyaiFavList');
        if (!favList) return;
        var preferred = ['连续梁计算', '柱下独立基础', '叠合构件验算', '矩形梁正截面', '裂缝宽度'];
        var cards = Array.from(document.querySelectorAll('.section-card'));
        var picked = [];
        preferred.forEach(function (name) {
            var card = cards.find(function (c) {
                return c.textContent.indexOf(name) > -1;
            });
            if (card && picked.indexOf(card) === -1) picked.push(card);
        });
        if (!picked.length) picked = cards.slice(0, 5);
        picked.slice(0, 5).forEach(function (card) {
            var title = card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : card.textContent.trim().slice(0, 12);
            var a = document.createElement('a');
            a.href = 'javascript:void(0)';
            a.innerHTML = '<span>↗</span>' + title;
            a.addEventListener('click', function () {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(function () { card.click(); }, 260);
            });
            favList.appendChild(a);
        });
    }
    function bindSearch(noResult) {
        var input = document.getElementById('tyaiToolSearch');
        if (!input) return;
        var cards = Array.from(document.querySelectorAll('.section-card'));
        var sections = Array.from(document.querySelectorAll('.tool-section'));
        input.addEventListener('input', function () {
            var keyword = input.value.trim().toLowerCase();
            var visibleCount = 0;
            cards.forEach(function (card) {
                restoreMark(card);
                var text = card.textContent.toLowerCase();
                var match = !keyword || text.indexOf(keyword) > -1;
                card.style.display = match ? '' : 'none';
                if (match) {
                    visibleCount++;
                    if (keyword) highlightTitle(card, keyword);
                }
            });
            sections.forEach(function (section) {
                var visibleCards = section.querySelectorAll('.section-card:not([style*="display: none"])');
                section.style.display = visibleCards.length ? '' : 'none';
            });
            if (noResult) {
                noResult.classList.toggle('show', keyword && visibleCount === 0);
            }
        });
            // 快捷键「/」统一由 ui/ux.js 的全局命令面板接管（Ctrl/⌘+K 亦可）
        }
    function restoreMark(card) {
        card.querySelectorAll('mark').forEach(function (mark) {
            mark.replaceWith(document.createTextNode(mark.textContent));
        });
    }
    function highlightTitle(card, keyword) {
        var title = card.querySelector('h3');
        if (!title || !keyword) return;
        var raw = title.textContent;
        var idx = raw.toLowerCase().indexOf(keyword);
        if (idx === -1) return;
        title.innerHTML =
            raw.slice(0, idx) +
            '<mark>' + raw.slice(idx, idx + keyword.length) + '</mark>' +
            raw.slice(idx + keyword.length);
    }
    function enhanceCards() {
        document.querySelectorAll('.section-card').forEach(function (card) {
            if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
    }
})();

console.log('[UI] home.js loaded. 首页就绪。');
