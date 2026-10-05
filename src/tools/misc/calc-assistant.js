/* calc-assistant 工具模块（含前置数据/函数依赖）
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '智能计算助手',
        sub: '输入计算问题 · 自动匹配工具 · 提取参数 · 一键计算 · 支持自定义 AI API（OpenAI 兼容）',
        meta: {"standard": "—", "formulaSource": "—", "limitations": "AI/关键词驱动的计算入口，自动匹配工具与参数提取", "unit": "—", "version": "1.0.0"},
        render: function () {
            // 优先检查 AI 对话模块是否加载，如果加载了直接显示对话模式
            var chatModeDefault = (window.AI_CHAT_UI && window.AI_TOOL_REGISTRY) ? 'chat' : 'kw';
            return '<div class="panel"><div class="panel-title">模式选择</div>' +
                '<div style="display:flex;gap:8px;margin-bottom:12px">' +
                '<button type="button" class="btn" id="ai_mode_kw" style="flex:1' + (chatModeDefault==='kw' ? ';background:var(--primary);color:#fff;border-color:var(--primary)' : '') + '">关键词匹配</button>' +
                '<button type="button" class="btn btn-secondary" id="ai_mode_ds" style="flex:1">AI 模式（单轮）</button>' +
                '<button type="button" class="btn" id="ai_mode_chat" style="flex:1' + (chatModeDefault==='chat' ? ';background:var(--primary);color:#fff;border-color:var(--primary)' : ';background:linear-gradient(135deg,#533afd,#ea2261);color:#fff;border-color:transparent') + '">✨ AI 对话助手</button>' +
                '</div>' +
                '<div id="ai_ds_config" style="display:none;margin-bottom:12px;padding:12px;border:1.5px dashed var(--hairline);border-radius:8px;background:var(--canvas-soft)">' +
                '<div style="font-weight:600;margin-bottom:8px;color:var(--primary)">AI API 配置（OpenAI 兼容接口，可添加多家）</div>' +
                '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
                '<select id="ai_provider_sel" style="flex:1;padding:7px 8px;border:1.5px solid var(--hairline);border-radius:6px;font-size:13px"></select>' +
                '<button type="button" class="btn btn-secondary" id="ai_provider_add" style="padding:6px 10px;font-size:13px">＋ 新增</button>' +
                '<button type="button" class="btn btn-secondary" id="ai_provider_del" style="padding:6px 10px;font-size:13px">删除</button>' +
                '</div>' +
                '<input type="text" id="ai_p_name" style="width:100%;padding:8px 10px;border:1.5px solid var(--hairline);border-radius:6px;font-size:13px;margin-bottom:6px" placeholder="API 名称，如：DeepSeek / Kimi / 通义千问 / 自定义" />' +
                '<input type="text" id="ai_p_base" style="width:100%;padding:8px 10px;border:1.5px solid var(--hairline);border-radius:6px;font-size:13px;margin-bottom:6px" placeholder="接口地址 Base URL，如：https://api.deepseek.com 或 https://api.openai.com/v1" />' +
                '<input type="password" id="ai_p_key" style="width:100%;padding:8px 10px;border:1.5px solid var(--hairline);border-radius:6px;font-size:13px;margin-bottom:6px" placeholder="API Key（仅保存在本机浏览器 localStorage）" />' +
                '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
                '<input type="text" id="ai_p_models" style="flex:1;padding:8px 10px;border:1.5px solid var(--hairline);border-radius:6px;font-size:13px" placeholder="模型名，多个用英文逗号分隔，如：deepseek-chat,deepseek-reasoner" />' +
                '<select id="ai_p_model_sel" style="padding:7px 8px;border:1.5px solid var(--hairline);border-radius:6px;font-size:13px"></select>' +
                '</div>' +
                '<button type="button" class="btn btn-secondary" id="ai_p_save" style="padding:6px 14px;font-size:13px">保存配置</button>' +
                '<div class="hint" style="margin-top:6px;font-size:12px">Key 仅存储在浏览器 localStorage，不会上传。接口需支持 OpenAI 兼容的 /chat/completions 格式。常见：DeepSeek <a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--primary)">platform.deepseek.com</a>、Kimi platform.moonshot.cn、通义百炼 dashscope.aliyuncs.com/compatible-mode/v1、OpenAI platform.openai.com。部分接口有浏览器跨域（CORS）限制，可用 Chrome CORS 插件或后端代理。</div>' +
                '</div>' +
                '<div id="ai_ds_hint" style="display:none;margin-bottom:10px;padding:8px 12px;border-radius:8px;background:linear-gradient(135deg,#533afd12,#ea226112);font-size:13px;color:#533afd">✨ AI 模式：AI 会理解您的自然语言问题，自动匹配工具并提取参数，计算仍由工具箱完成（确保规范正确性），结果可由 AI 解释。</div>' +
                '</div>' +
                '<div class="panel"><div class="panel-title">输入您的计算问题</div>' +
                '<div class="hint" style="margin-bottom:10px" id="ai_hint_kw">请描述您要计算的问题，例如："矩形梁 b=300mm h=600mm C30 HRB400 As=1473 求受弯承载力" 或 "独立基础 柱轴力N=1000kN C30 fha=200kPa"。系统会自动识别工具并提取参数。</div>' +
                '<textarea id="ai_input" style="width:100%;min-height:120px;padding:12px 14px;border:1.5px solid var(--hairline);border-radius:10px;font-size:14px;line-height:1.6;resize:vertical;font-family:inherit;background:var(--canvas-soft)" placeholder="在此输入您的计算问题描述...&#10;&#10;示例1：矩形梁 截面300×600 C30 HRB400 配筋3根20 求受弯承载力&#10;示例2：裂缝宽度验算 矩形梁 b=250 h=500 C25 HRB400 As=763 M=80kN·m&#10;示例3：柱下独立基础 N=800kN M=50kN·C30 持力层fak=180kPa&#10;示例4（AI模式）：帮我算一个300×600的C30梁，配了3根20的HRB400钢筋，弯矩是100kN·m，看看够不够"></textarea>' +
                '<div class="btn-group" style="margin-top:12px">' +
                '<button type="button" class="btn btn-primary" id="ai_analyze">分析并匹配</button>' +
                '<button type="button" class="btn btn-secondary" id="ai_clear">清空</button>' +
                '</div></div>' +
                '<div class="panel" id="ai_match_panel" style="display:none"><div class="panel-title">匹配结果</div><div id="ai_match"></div></div>' +
                '<div class="panel" id="ai_params_panel" style="display:none"><div class="panel-title">提取的参数</div><div id="ai_params"></div></div>' +
                '<div class="panel" id="ai_result_panel" style="display:none"><div class="panel-title">计算结果</div><div id="ai_result"></div></div>' +
                '<div class="panel" id="ai_explain_panel" style="display:none"><div class="panel-title">AI 结果解读</div><div id="ai_explain"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="ai_proc"></div></div></div></div>' +
                // AI 对话模式面板（默认显示，如果模块加载了）
                '<div id="ai_chat_panel" style="display:' + (chatModeDefault==='chat' ? 'block' : 'none') + ';margin-top:12px;"></div>';
        },
        bind: function () {
            var aiKeywords = [
                { id: 'beam-rect', name: '矩形梁正截面承载力', keywords: ['矩形梁', '单筋', '双筋', '矩形截面', '正截面', '受弯承载力', '梁受弯'], patterns: { b: [/(?:截面宽|宽度|b\s*[=＝])\s*(\d+)/i, /(\d+)\s*[×x*]\s*\d+.*?梁/], h: [/(?:截面高|高度|h\s*[=＝])\s*(\d+)/i, /\d+\s*[×x*]\s*(\d+).*?梁/], con: [/C(\d{2})/i], reb: [/HRB\s*(\d{3})/i], As: [/(?:As|钢筋面积|配筋面积)\s*[=＝]?\s*(\d+)/i, /(\d+)\s*根\s*(\d+)/] } },
                { id: 'beam-t', name: 'T形梁正截面承载力', keywords: ['T形梁', 'T型梁', 'T梁', 'T形截面', '翼缘'], patterns: {} },
                { id: 'beam-shear', name: '梁斜截面受剪', keywords: ['斜截面', '受剪', '抗剪', '箍筋', '剪力'], patterns: { b: [/(?:截面宽|宽度|b\s*[=＝])\s*(\d+)/i], h: [/(?:截面高|高度|h\s*[=＝])\s*(\d+)/i], con: [/C(\d{2})/i] } },
                { id: 'beam-cont', name: '连续梁计算', keywords: ['连续梁', '多跨梁', '三弯矩'], patterns: {} },
                { id: 'slab-rect', name: '单块矩形板计算', keywords: ['矩形板', '单向板', '双向板', '板计算', '楼板'], patterns: {} },
                { id: 'column-axial', name: '轴心受压柱', keywords: ['轴心受压', '轴压柱', '受压柱', '柱承载力'], patterns: {} },
                { id: 'crack-width', name: '裂缝宽度计算', keywords: ['裂缝', '裂缝宽度', '裂缝验算'], patterns: { b: [/(?:截面宽|宽度|b\s*[=＝])\s*(\d+)/i], h: [/(?:截面高|高度|h\s*[=＝])\s*(\d+)/i], con: [/C(\d{2})/i] } },
                { id: 'deflection', name: '挠度验算', keywords: ['挠度', '变形', '挠度验算'], patterns: {} },
                { id: 'punching', name: '受冲切承载力', keywords: ['冲切', '抗冲切'], patterns: {} },
                { id: 'bearing-local', name: '局部受压', keywords: ['局部受压', '局部承压'], patterns: {} },
                { id: 'corbel', name: '牛腿设计', keywords: ['牛腿'], patterns: {} },
                { id: 'deep-beam', name: '深受弯构件（深梁）', keywords: ['深梁', '深受弯'], patterns: {} },
                { id: 'footing-col', name: '柱下独立基础', keywords: ['独立基础', '柱下基础', '扩展基础'], patterns: {} },
                { id: 'footing-wall', name: '墙下条形基础', keywords: ['条形基础', '墙下基础', '条基'], patterns: {} },
                { id: 'bearing-cap', name: '地基承载力验算', keywords: ['地基承载力', '承载力验算', '基底压力'], patterns: {} },
                { id: 'settlement', name: '地基沉降计算', keywords: ['沉降', '地基沉降'], patterns: {} },
                { id: 'bearing-theory', name: '承载力理论公式法', keywords: ['承载力理论', '抗剪强度', '承载力系数', '理论公式', 'Mb', 'Md', 'Mc'], patterns: {} },
                { id: 'soft-underlayer', name: '软弱下卧层验算', keywords: ['软弱下卧层', '下卧层', '扩散角', '软弱层'], patterns: {} },
                { id: 'anti-uplift', name: '抗浮稳定性验算', keywords: ['抗浮', '浮力', '抗拔', '抗浮稳定', '地下水浮力', '水池抗浮', '行车荷载', '浮托力', '水池', '消防车荷载', '车辆荷载'], patterns: {} },
                { id: 'mas-comp', name: '砌体受压', keywords: ['砌体受压', '砖墙', '砖柱', '高厚比', '砌体'], patterns: {} },
                { id: 'mas-local', name: '砌体局部受压', keywords: ['砌体局部', '梁端砌体'], patterns: {} },
                { id: 'lintel', name: '过梁计算', keywords: ['过梁', '圈梁'], patterns: {} },
                { id: 'cantilever', name: '挑梁计算', keywords: ['挑梁', '悬挑梁'], patterns: {} },
                { id: 'balcony', name: '阳台雨篷', keywords: ['阳台', '雨篷', '雨棚', '挑檐'], patterns: {} },
                { id: 'wall-beam', name: '墙梁计算', keywords: ['墙梁', '托梁'], patterns: {} },
                { id: 'basement-wall', name: '地下室外墙', keywords: ['地下室外墙', '地下室', '挡土墙地下室'], patterns: {} },
                { id: 'shear-wall', name: '剪力墙稳定', keywords: ['剪力墙', '墙体稳定', '墙肢'], patterns: {} },
                { id: 'pool-rect', name: '矩形水池', keywords: ['矩形水池', '水池'], patterns: {} },
                { id: 'pool-circ', name: '圆形水池', keywords: ['圆形水池', '圆柱形水池'], patterns: {} },
                { id: 'retain-cant', name: '悬臂挡土墙', keywords: ['悬臂挡土墙', '挡土墙', '悬臂式挡土'], patterns: {} },
                { id: 'retain-butt', name: '扶壁挡土墙', keywords: ['扶壁挡土墙', '扶壁式挡土'], patterns: {} },
                { id: 'embed-plate', name: '预埋件计算', keywords: ['预埋件', '锚板', '锚筋'], patterns: {} },
                { id: 'pile-cap', name: '桩承台', keywords: ['桩承台', '承台'], patterns: {} },
                { id: 'pile-single', name: '单桩竖向承载力', keywords: ['单桩', '单桩承载力', '桩侧阻'], patterns: {} },
                { id: 'pile-bearing', name: '桩基承载力验算', keywords: ['桩基承载力', '群桩验算'], patterns: {} },
                { id: 'pile-horizontal', name: '桩基水平承载力', keywords: ['水平承载力', '桩水平', 'm法'], patterns: {} },
                { id: 'pile-bearing-55003', name: '桩基验算(GB55003)', keywords: ['GB55003桩基', '桩基验算55003', '桩基承载力55003'], patterns: {} },
                { id: 'steel-column', name: '钢压弯构件', keywords: ['钢柱', '钢压弯', '钢结构柱', 'H型钢柱'], patterns: {} },
                { id: 'steel-beam', name: '钢连续梁', keywords: ['钢梁', '钢连续梁', '型钢梁'], patterns: {} },
                { id: 'weld', name: '焊缝连接', keywords: ['焊缝', '焊接', '角焊缝'], patterns: {} },
                { id: 'bolt', name: '螺栓连接', keywords: ['螺栓', '高强螺栓', '螺栓连接'], patterns: {} },
                { id: 'anchor-bolt', name: '柱脚锚栓', keywords: ['锚栓', '柱脚'], patterns: {} },
                { id: 'stage-check', name: '叠合构件两阶段验算', keywords: ['叠合', '叠合构件', '两阶段', '叠合板', '叠合梁'], patterns: {} },
                { id: 'aac-wall', name: '蒸压加气混凝土外墙板', keywords: ['蒸压加气', 'AAC', '加气混凝土墙板', 'ALC板'], patterns: {} },
                { id: 'anchor', name: '保温外墙锚固件设计', keywords: ['锚固件', '反打保温', '保温外墙', '尾盘', '反向拉拔', '局部承压'], patterns: {} },
                { id: 'td-slab', name: '钢筋桁架楼板', keywords: ['钢筋桁架', '桁架楼板', '楼承板'], patterns: {} },
                { id: 'rebar-area', name: '钢筋面积速查', keywords: ['钢筋面积', '钢筋查表', '钢筋面积速查'], patterns: {} },
                { id: 'rho-min', name: '最小配筋率', keywords: ['最小配筋率', '最小配筋'], patterns: {} },
                { id: 'col-tie', name: '柱箍筋加密区', keywords: ['箍筋加密', '加密区', '体积配箍'], patterns: {} },
                { id: 'seismic', name: '抗震设防参数', keywords: ['抗震设防', '抗震等级', '设防烈度', '抗震参数'], patterns: {} },
                { id: 'seismic-perf', name: '抗震性能化设计', keywords: ['性能化设计', '性能目标', '抗震性能', '设防地震', '多遇地震', '罕遇地震', '荷载组合', '地震作用'], patterns: {} },
                { id: 'masonry-seismic', name: '砌体房屋抗震验算', keywords: ['砌体抗震', '砌体抗剪', '正应力影响', '构造柱', '芯柱', '砌体受剪', 'fve', '砖墙抗震', '砌块抗震'], patterns: {} },
                { id: 'joint-core', name: '框架节点核芯区验算', keywords: ['节点核芯', '核芯区剪力', '节点验算', '强节点', '框架节点', '节点受剪'], patterns: {} },
                { id: 'steel-seismic', name: '钢结构抗震参数', keywords: ['钢结构抗震', '钢框架抗震', '宽厚比', '长细比限值', '连接系数', '钢结构房屋', '抗震等级钢结构'], patterns: {} },
                { id: 'isolation', name: '隔震设计简化计算', keywords: ['隔震', '隔震支座', '减震系数', '等效刚度', '等效阻尼', '隔震层', '橡胶支座', 'LRB', '水平向减震'], patterns: {} },
                { id: 'wind-snow', name: '风荷载与雪荷载', keywords: ['风荷载', '雪荷载', '风压', '基本风压'], patterns: {} },
                { id: 'load-combo', name: '荷载组合计算', keywords: ['荷载组合', '基本组合', '偶然组合', '标准组合', '频遇组合', '准永久组合', '分项系数', '组合值系数', '可变荷载控制', '永久荷载控制', 'γG', 'γQ', 'γL', '设计使用年限调整'], patterns: {} },
                { id: 'crane-load', name: '吊车荷载计算', keywords: ['吊车荷载', '吊车', '纵向水平力', '横向水平力', '吊车轮压', '动力系数', '多台吊车', '折减系数', '软钩', '硬钩', '工作级别', '刹车轮'], patterns: {} },
                { id: 'temp-action', name: '温度作用计算', keywords: ['温度作用', '温度应力', '线膨胀系数', '温升', '温降', '均匀温度', '基本气温', '合拢温度', '温度变形', 'αT'], patterns: {} },
                { id: 'floor-live', name: '楼面活荷载查表', keywords: ['楼面活荷载', '活荷载', '均布活荷载', '楼面荷载', '屋面活荷载', '组合值系数', '频遇值系数', '准永久值系数', '折减系数', '从属面积', '楼面荷载标准值'], patterns: {} },
                { id: 'stair-slab', name: '板式楼梯', keywords: ['板式楼梯', '楼梯', '梯段板'], patterns: {} },
                { id: 'addl-trans', name: '附加横向钢筋', keywords: ['附加横向', '附加箍筋', '吊筋', '附加钢筋'], patterns: {} }
            ];

            var paramExtractors = {
                concrete: function (text) { var m = text.match(/C(\d{2})/i); return m ? 'C' + m[1] : null; },
                steel: function (text) { var m = text.match(/HRB\s*(\d{3})/i); return m ? 'HRB' + m[1] : null; },
                number: function (text, patterns) {
                    for (var i = 0; i < patterns.length; i++) {
                        var m = text.match(patterns[i]);
                        if (m) return parseFloat(m[1] || (m[2] ? m[2] : m[0]));
                    }
                    return null;
                },
                loadN: function (text) { var m = text.match(/(?:N|轴力|轴向力)\s*[=＝]?\s*(\d+(?:\.\d+)?)\s*(?:kN|kN|吨)/i); return m ? parseFloat(m[1]) : null; },
                loadM: function (text) { var m = text.match(/(?:M|弯矩)\s*[=＝]?\s*(\d+(?:\.\d+)?)\s*(?:kN[·•]m|kN\.m|kNm)/i); return m ? parseFloat(m[1]) : null; },
                loadV: function (text) { var m = text.match(/(?:V|剪力)\s*[=＝]?\s*(\d+(?:\.\d+)?)\s*(?:kN)/i); return m ? parseFloat(m[1]) : null; },
                loadq: function (text) { var m = text.match(/(?:q|均布荷载|线荷载)\s*[=＝]?\s*(\d+(?:\.\d+)?)\s*(?:kN[\/÷]m|kN\/m)/i); return m ? parseFloat(m[1]) : null; },
                span: function (text) { var m = text.match(/(?:跨度|净跨|l0|l\s*[=＝])\s*[=＝]?\s*(\d+(?:\.\d+)?)\s*m?/i); if (m) return parseFloat(m[1]); m = text.match(/(\d+(?:\.\d+)?)\s*m\s*(?:跨度|跨|净跨)/i); return m ? parseFloat(m[1]) : null; },
                sectionBH: function (text) {
                    var m = text.match(/(\d+)\s*[×x*]\s*(\d+)/);
                    if (m) return { b: parseFloat(m[1]), h: parseFloat(m[2]) };
                    m = text.match(/(?:截面|宽).{0,6}?(\d+).{0,6}?(?:高).{0,6}?(\d+)/);
                    if (m) return { b: parseFloat(m[1]), h: parseFloat(m[2]) };
                    return null;
                },
                rebarCount: function (text) {
                    var m = text.match(/(\d+)\s*根\s*(\d+)/);
                    if (m) return { count: parseInt(m[1]), dia: parseFloat(m[2]) };
                    m = text.match(/(\d+)[\u22a0\u00d7x]\s*(\d+)/);
                    if (m) return { count: parseInt(m[1]), dia: parseFloat(m[2]) };
                    return null;
                },
                fak: function (text) { var m = text.match(/(?:fa|fak|地基承载力|持力层)\s*[=＝]?\s*(\d+(?:\.\d+)?)\s*(?:kPa|kN\/m\u00b2)/i); return m ? parseFloat(m[1]) : null; },
                // T形梁专用：腹板宽 b（必须带"腹板/肋"上下文，避免跟翼缘宽串扰）
                tbeamB: function (text) {
                    var m = text.match(/腹板[宽度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    m = text.match(/梁肋[宽度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    return null;
                },
                // T形梁专用：翼缘宽 bf
                tbeamBf: function (text) {
                    var m = text.match(/翼缘[计算宽度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    m = text.match(/受压翼缘宽\s*[=＝]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    return null;
                },
                // T形梁专用：翼缘厚 hf
                tbeamHf: function (text) {
                    var m = text.match(/翼缘[厚度高度]*\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    m = text.match(/受压翼缘厚\s*[=＝]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    return null;
                },
                // 通用：受拉钢筋面积 As
                rebarAs: function (text) {
                    var m = text.match(/(?:^|[\s,，；;])As\s*[=＝]\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    m = text.match(/(受拉钢筋面积|受拉面积|配筋面积|钢筋面积)\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[2]);
                    return null;
                },
                // 通用：受拉钢筋合力点到下边缘距离 a_s（保护层近似）
                rebarAsDistance: function (text) {
                    var m = text.match(/(?:^|[\s,，；;])a_s\s*[=＝]\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    m = text.match(/保护层\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i);
                    if (m) return parseFloat(m[1]);
                    return null;
                }
            };

            function analyze() {
                var input = document.getElementById('ai_input').value.trim();
                var matchPanel = document.getElementById('ai_match_panel');
                var paramsPanel = document.getElementById('ai_params_panel');
                var resultPanel = document.getElementById('ai_result_panel');
                var matchDiv = document.getElementById('ai_match');
                var paramsDiv = document.getElementById('ai_params');
                var resultDiv = document.getElementById('ai_result');
                var procDiv = document.getElementById('ai_proc');

                if (!input) { alert('请输入您的计算问题'); return; }

                // 匹配工具
                var scored = [];
                aiKeywords.forEach(function (item) {
                    var score = 0, hits = [];
                    item.keywords.forEach(function (kw) {
                        if (input.indexOf(kw) >= 0) { score += kw.length; hits.push(kw); }
                    });
                    if (score > 0) scored.push({ item: item, score: score, hits: hits });
                });
                scored.sort(function (a, b) { return b.score - a.score; });

                // ===== T形截面特征强制提升 =====
                // 输入含 T形梁/T梁/翼缘/bf/hf 任一 → beam-t 强制为首，压过 beam-rect
                var _tFeat = (function(text) {
                    var pats = [/t[\s-]*形[梁截]/i, /t[\s-]*型[梁截]/i, /t梁/i, /翼缘/,
                                /(?:^|[\s,，；;])bf\s*[=＝]/i, /(?:^|[\s,，；;])hf\s*[=＝]/i];
                    var found = [];
                    pats.forEach(function(re) { if (re.test(text)) found.push(re.toString().replace(/[\\\[\]()?+*^$|.\/]/g,'').substring(0,6)); });
                    return { has: found.length > 0, feats: found };
                })(input);
                if (_tFeat.has) {
                    var rectIdx = -1, tIdx = -1;
                    for (var _i = 0; _i < scored.length; _i++) {
                        if (scored[_i].item.id === 'beam-rect') rectIdx = _i;
                        if (scored[_i].item.id === 'beam-t') tIdx = _i;
                    }
                    if (rectIdx >= 0 && tIdx > rectIdx) {
                        // beam-rect排在beam-t前面 → 交换
                        var _tmp = scored[rectIdx];
                        scored[rectIdx] = scored[tIdx];
                        scored[tIdx] = _tmp;
                    }
                    tracePush({ step: 'route_t_beam_promoted', input: input.substring(0, 40), reason: 'kw-mode features: ' + _tFeat.feats.join('/') });
                }

                if (scored.length === 0) {
                    matchPanel.style.display = 'block';
                    paramsPanel.style.display = 'none';
                    resultPanel.style.display = 'none';
                    matchDiv.innerHTML = '<div class="error-box">未能识别计算类型。请尝试更明确地描述，例如包含"矩形梁"、"裂缝"、"独立基础"等关键词。</div>';
                    procDiv.innerHTML = '';
                    return;
                }

                var best = scored[0];
                var toolId = best.item.id;
                var toolName = best.item.name;
                var suggestions = scored.slice(1, 4).map(function (s) {
                    return '<a href="#/' + s.item.id + '" style="margin-right:8px" class="tag tag-ok">' + s.item.name + '</a>';
                }).join('');

                matchPanel.style.display = 'block';
                matchDiv.innerHTML =
                    '<div class="result-item"><span class="label">识别工具</span><span class="value"><b>' + toolName + '</b> ' + tag('ok', '匹配') + '</span></div>' +
                    '<div class="result-item"><span class="label">命中关键词</span><span class="value">' + best.hits.map(function(k){return tag('ok',k)}).join(' ') + '</span></div>' +
                    (suggestions ? '<div class="result-item"><span class="label">其他可能</span><span class="value">' + suggestions + '</span></div>' : '') +
                    '<div style="margin-top:12px"><button type="button" class="btn btn-primary" id="ai_go">自动填入并计算</button></div>';

                // 提取参数（T形梁走专用提取器，避免 b/bf 串扰）
                var params = {};
                var isTBeam = (toolId === 'beam-t');
                var conV = paramExtractors.concrete(input);
                if (conV) params.concrete = conV;
                var steelV = paramExtractors.steel(input);
                if (steelV) params.steel = steelV;
                if (isTBeam) {
                    // T形梁：腹板宽 → b，翼缘宽 → bf，翼缘厚 → hf
                    var tb = paramExtractors.tbeamB(input);
                    if (tb !== null) params.b = tb;
                    var tbf = paramExtractors.tbeamBf(input);
                    if (tbf !== null) params.bf = tbf;
                    var thf = paramExtractors.tbeamHf(input);
                    if (thf !== null) params.hf = thf;
                    // 梁高：从"梁高XXX"或sectionBH中提取
                    var th = null;
                    var thMatch = input.match(/梁高\s*[=＝是为:]?\s*(\d+(?:\.\d+)?)/i);
                    if (thMatch) th = parseFloat(thMatch[1]);
                    if (th === null) {
                        var secT = paramExtractors.sectionBH(input);
                        if (secT) th = secT.h;
                    }
                    if (th !== null) params.h = th;
                    // As
                    var tAs = paramExtractors.rebarAs(input);
                    if (tAs !== null) params.As = tAs;
                    // a_s / 保护层
                    var tas = paramExtractors.rebarAsDistance(input);
                    if (tas !== null) params.a_s = tas;
                    // rebar 作为 As 的兜底（n根d）
                    var treb = paramExtractors.rebarCount(input);
                    if (treb && tAs === null) params.rebar = treb;
                } else {
                    // 非T梁：沿用原有通用提取
                    var sec = paramExtractors.sectionBH(input);
                    if (sec) { params.b = sec.b; params.h = sec.h; }
                    var rebar = paramExtractors.rebarCount(input);
                    if (rebar) params.rebar = rebar;
                }
                var N = paramExtractors.loadN(input);
                if (N !== null) params.N = N;
                var M = paramExtractors.loadM(input);
                if (M !== null) params.M = M;
                var V = paramExtractors.loadV(input);
                if (V !== null) params.V = V;
                var q = paramExtractors.loadq(input);
                if (q !== null) params.q = q;
                var span = paramExtractors.span(input);
                if (span !== null) params.span = span;
                var fak = paramExtractors.fak(input);
                if (fak !== null) params.fak = fak;

                paramsPanel.style.display = 'block';
                var paramHtml = '';
                if (conV) paramHtml += resultRow('混凝土等级', conV);
                if (steelV) paramHtml += resultRow('钢筋级别', steelV);
                if (isTBeam) {
                    if (params.b !== undefined) paramHtml += resultRow('腹板宽 b', params.b + ' mm');
                    if (params.h !== undefined) paramHtml += resultRow('梁高 h', params.h + ' mm');
                    if (params.bf !== undefined) paramHtml += resultRow('翼缘宽 bf', params.bf + ' mm');
                    if (params.hf !== undefined) paramHtml += resultRow('翼缘厚 hf', params.hf + ' mm');
                    if (params.As !== undefined) paramHtml += resultRow('受拉钢筋面积 As', params.As + ' mm²');
                    if (params.a_s !== undefined) paramHtml += resultRow('保护层 a_s', params.a_s + ' mm');
                    if (params.rebar) paramHtml += resultRow('配筋', params.rebar.count + '根' + params.rebar.dia);
                } else {
                    if (params.b !== undefined && params.h !== undefined) paramHtml += resultRow('截面尺寸', params.b + ' × ' + params.h + ' mm');
                    if (params.rebar) paramHtml += resultRow('配筋', params.rebar.count + '根' + params.rebar.dia);
                }
                if (N !== null) paramHtml += resultRow('轴向力 N', N + ' kN');
                if (M !== null) paramHtml += resultRow('弯矩 M', M + ' kN·m');
                if (V !== null) paramHtml += resultRow('剪力 V', V + ' kN');
                if (q !== null) paramHtml += resultRow('均布荷载 q', q + ' kN/m');
                if (span !== null) paramHtml += resultRow('跨度', span + ' m');
                if (fak !== null) paramHtml += resultRow('地基承载力', fak + ' kPa');
                if (!paramHtml) paramHtml = '<div class="hint">未能从输入中提取到具体参数。<b>请勿用默认值计算</b>，请补充参数后再试。</div>';
                paramsDiv.innerHTML = paramHtml;
                resultPanel.style.display = 'none';
                procDiv.innerHTML = '';

                // 自动填入并计算
                document.getElementById('ai_go').addEventListener('click', function () {
                    tracePush({ step: 'kw_ai_go_click', tool: toolId, params: params });
                    goTool(toolId);
                    setTimeout(function () { autoFillTool(toolId, params); }, 100);
                });
            }

            // ===== 全局 trace 调试系统 =====
            // 所有关键步骤 push 到 window.AI_DEBUG_TRACE，右上角 fixed 面板实时显示最后一条
            window.AI_DEBUG_TRACE = window.AI_DEBUG_TRACE || [];
            function tracePush(record) {
                record._t = Date.now();
                window.AI_DEBUG_TRACE.push(record);
                try { updateTracePanel(record); } catch (e) {}
            }
            function updateTracePanel(latest) {
                var panel = document.getElementById('ai_trace_panel');
                if (!panel) {
                    panel = document.createElement('div');
                    panel.id = 'ai_trace_panel';
                    panel.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;max-width:380px;max-height:60vh;overflow:auto;padding:8px 10px;background:#1e293b;color:#f1f5f9;border-radius:6px;font-size:11px;font-family:ui-monospace,monospace;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3);';
                    var title = document.createElement('div');
                    title.style.cssText = 'font-weight:bold;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;';
                    title.innerHTML = '<span>AI Trace (autoFillTool/bridge)</span><span style="cursor:pointer;color:#94a3b8;" onclick="document.getElementById(\'ai_trace_panel\').remove()">✕</span>';
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
                    if (latest.dom_values) {
                        var dv = latest.dom_values;
                        brief += ' b=' + dv.b + ' h=' + dv.h + ' bf=' + dv.bf + ' hf=' + dv.hf + ' As=' + dv.As + ' as=' + dv.as;
                    }
                    if (latest.error) brief += ' err=' + latest.error;
                    line.innerHTML = brief;
                    body.appendChild(line);
                    panel.scrollTop = panel.scrollHeight;
                }
            }

            function autoFillTool(toolId, params) {
                tracePush({ step: 'autoFillTool_entry', tool: toolId, params_keys: Object.keys(params) });
                // ===== 调试：可见对账日志 =====
                // 用 fixed 浮层挂在 body 上，不随 view 切换消失，能看到跨页面的完整过程
                function dbgLog(html) {
                    try {
                        var box = document.getElementById('ai_dbg_box');
                        if (!box) {
                            box = document.createElement('div');
                            box.id = 'ai_dbg_box';
                            box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;max-width:360px;max-height:50vh;overflow:auto;padding:10px 12px;background:#fff7ed;border:1px solid #fb923c;border-radius:6px;font-size:12px;color:#9a3412;font-family:ui-monospace,monospace;line-height:1.6;box-shadow:0 4px 12px rgba(0,0,0,.15);';
                            box.innerHTML = '<div style="font-weight:bold;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;"><span>[调试] autoFillTool 对账</span><span style="cursor:pointer;color:#dc2626;" onclick="document.getElementById(\'ai_dbg_box\').remove()">关闭</span></div>';
                            document.body.appendChild(box);
                        }
                        var line = document.createElement('div');
                        line.innerHTML = html;
                        box.appendChild(line);
                        box.scrollTop = box.scrollHeight;
                    } catch (e) {}
                }
                dbgLog('toolId = <b>' + toolId + '</b>');
                dbgLog('params = ' + JSON.stringify(params));
                var fillMap = {
                    'beam-rect': function (p) {
                        if (p.b) { var el = document.getElementById('r_b'); if (el) el.value = p.b; }
                        if (p.h) { var el = document.getElementById('r_h'); if (el) el.value = p.h; }
                        if (p.concrete) { var el = document.getElementById('r_con'); if (el) el.value = p.concrete; }
                        if (p.steel) { var el = document.getElementById('r_reb'); if (el) el.value = p.steel; }
                        if (p.rebar) { var As = Math.PI * p.rebar.dia * p.rebar.dia / 4 * p.rebar.count; var el = document.getElementById('r_As'); if (el) el.value = Math.round(As); }
                        var btn = document.getElementById('r_calc'); if (btn) btn.click();
                    },
                    'beam-t': function (p) {
                        tracePush({ step: 'beam_t_branch_entry', params_keys: Object.keys(p) });
                        // 【T形梁安全门】必填参数必须都提取到，否则绝不用默认值计算
                        var requiredT = ['b', 'h', 'bf', 'hf', 'concrete', 'steel', 'As', 'a_s'];
                        var missingT = [];
                        // 先收集值
                        var vals = {};
                        // b: 优先用T梁专用"腹板宽"，其次通用sectionBH
                        if (p.b !== undefined && p.b !== null) vals.b = p.b;
                        if (vals.b === undefined) missingT.push('腹板宽 b');
                        // h: 通用sectionBH
                        if (p.h !== undefined && p.h !== null) vals.h = p.h;
                        if (vals.h === undefined) missingT.push('梁高 h');
                        // bf: T梁专用"翼缘宽"
                        if (p.bf !== undefined && p.bf !== null) vals.bf = p.bf;
                        if (vals.bf === undefined) missingT.push('翼缘宽 bf');
                        // hf: T梁专用"翼缘厚"
                        if (p.hf !== undefined && p.hf !== null) vals.hf = p.hf;
                        if (vals.hf === undefined) missingT.push('翼缘厚 hf');
                        // concrete / steel
                        if (p.concrete) vals.concrete = p.concrete; else missingT.push('混凝土等级');
                        if (p.steel) vals.steel = p.steel; else missingT.push('钢筋级别');
                        // As: 优先As=写法，其次rebarCount折算
                        if (p.As !== undefined && p.As !== null) vals.As = p.As;
                        else if (p.rebar) vals.As = Math.round(Math.PI * p.rebar.dia * p.rebar.dia / 4 * p.rebar.count);
                        if (vals.As === undefined) missingT.push('受拉钢筋面积 As');
                        // a_s
                        if (p.a_s !== undefined && p.a_s !== null) vals.a_s = p.a_s;
                        if (vals.a_s === undefined) missingT.push('保护层 a_s');

                        if (missingT.length > 0) {
                            console.warn('[AI_KW] T形梁参数不完整，禁止使用默认值计算。缺少:', missingT.join(', '));
                            // 把缺项显示到结果区，不让用户看到默认值算出的假结果
                            var resDiv = document.getElementById('ai_result');
                            var resPanel = document.getElementById('ai_result_panel');
                            if (resDiv && resPanel) {
                                resPanel.style.display = 'block';
                                resDiv.innerHTML = '<div class="error-box"><b>⚠ 无法计算：以下必填参数未能从您的输入中识别出来。</b><br><br>' +
                                    '缺少：<b>' + missingT.join('、') + '</b><br><br>' +
                                    '工程计算不允许使用默认值或推测值。请补充后再试。<br><br>' +
                                    '<span style="font-size:12px;color:#94a3b8">提示：可用 "腹板宽300 梁高600 翼缘宽1200 翼缘厚100 C30 HRB400 As=2000 保护层50" 的写法。</span>' +
                                    '</div>';
                            }
                            return; // 绝对不点t_calc
                        }
                        // 全部必填都有 → 等待T梁DOM挂载 → 填值 → 回读校验 → 通过才计算
                        // 说明：goTool() 会触发 hashchange → route() → 二次renderTool，
                        // 如果填值正好撞在二次渲染之前，填的值会被默认值覆盖。
                        // 这里用轮询+回读校验确保写入真正落在最终DOM上，失败就绝不点t_calc。
                        var tFields = [
                            { id: 't_b',    val: vals.b },
                            { id: 't_h',    val: vals.h },
                            { id: 't_bf',   val: vals.bf },
                            { id: 't_hf',   val: vals.hf },
                            { id: 't_con',  val: vals.concrete },
                            { id: 't_reb',  val: vals.steel },
                            { id: 't_As',   val: vals.As },
                            { id: 't_as',   val: vals.a_s }
                        ];
                        function fillAndVerifyT() {
                            // 1. 确认所有元素都存在
                            for (var k = 0; k < tFields.length; k++) {
                                if (!document.getElementById(tFields[k].id)) {
                                    dbgLog('&nbsp;&nbsp;元素不存在: ' + tFields[k].id + ' → 等待重试');
                                    return false;
                                }
                            }
                            var btn = document.getElementById('t_calc');
                            if (!btn) { dbgLog('&nbsp;&nbsp;t_calc 不存在 → 等待重试'); return false; }
                            // 2. 写值 + 3. 回读校验（逐字段对账）
                            var allOk = true;
                            for (var j = 0; j < tFields.length; j++) {
                                var f = tFields[j];
                                var el = document.getElementById(f.id);
                                var before = el.value;
                                el.value = f.val;
                                var after = el.value;
                                var ok;
                                var numVal = parseFloat(f.val);
                                if (!isNaN(numVal) && f.id !== 't_con' && f.id !== 't_reb') {
                                    ok = parseFloat(after) === numVal;
                                } else {
                                    ok = after === f.val;
                                }
                                dbgLog('&nbsp;&nbsp;' + f.id + ': 写前=' + before + ' → 写入=' + f.val + ' → 回读=' + after + ' ' + (ok ? '<span style="color:#16a34a">✓</span>' : '<span style="color:#dc2626">✗</span>'));
                                if (!ok) allOk = false;
                            }
                            if (!allOk) return false;
                            // 4. 全部通过 → 点计算
                            dbgLog('&nbsp;&nbsp;全部字段回读校验通过 → 点击 t_calc');
                            tracePush({
                                step: 't_calc_click',
                                dom_values: {
                                    b: document.getElementById('t_b').value,
                                    h: document.getElementById('t_h').value,
                                    bf: document.getElementById('t_bf').value,
                                    hf: document.getElementById('t_hf').value,
                                    con: document.getElementById('t_con').value,
                                    reb: document.getElementById('t_reb').value,
                                    As: document.getElementById('t_As').value,
                                    as: document.getElementById('t_as').value
                                }
                            });
                            btn.click();
                            return true;
                        }
                        // 尝试10次，每次间隔30ms，最多等300ms
                        var tries = 0;
                        function tryFillT() {
                            if (fillAndVerifyT()) return;
                            tries++;
                            if (tries < 10) {
                                setTimeout(tryFillT, 30);
                            } else {
                                // 超时失败：绝不用默认值算，给用户报错（写到T梁自己的结果区 + 调试浮层）
                                dbgLog('<span style="color:#dc2626"><b>失败：重试' + tries + '次后仍未通过回读校验，拒绝使用默认值计算。</b></span>');
                                console.warn('[AI_KW] T形梁自动填值失败（DOM未就绪或值被覆盖），拒绝使用默认值计算。');
                                var tResult = document.getElementById('t_result');
                                if (tResult) {
                                    tResult.innerHTML = '<div class="error-box"><b>⚠ 自动填入失败</b><br><br>' +
                                        '参数未能写入表单（页面渲染时序问题）。工程计算不允许使用默认值。' +
                                        '<br><br>请手动确认表单参数后，点击「计算承载力」按钮。</div>';
                                }
                            }
                        }
                        tryFillT();
                    },
                    'beam-shear': function (p) {
                        if (p.b) { var el = document.getElementById('s_b'); if (el) el.value = p.b; }
                        if (p.h) { var el = document.getElementById('s_h'); if (el) el.value = p.h; }
                        if (p.concrete) { var el = document.getElementById('s_con'); if (el) el.value = p.concrete; }
                        if (p.steel) { var el = document.getElementById('s_reb'); if (el) el.value = p.steel; }
                        if (p.V) { var el = document.getElementById('s_V'); if (el) el.value = p.V; }
                        var btn = document.getElementById('s_calc'); if (btn) btn.click();
                    },
                    'crack-width': function (p) {
                        if (p.b) { var el = document.getElementById('cw_b'); if (el) el.value = p.b; }
                        if (p.h) { var el = document.getElementById('cw_h'); if (el) el.value = p.h; }
                        if (p.concrete) { var el = document.getElementById('cw_con'); if (el) el.value = p.concrete; }
                        if (p.steel) { var el = document.getElementById('cw_reb'); if (el) el.value = p.steel; }
                        if (p.M) { var el = document.getElementById('cw_M'); if (el) el.value = p.M; }
                        if (p.rebar) { var As = Math.PI * p.rebar.dia * p.rebar.dia / 4 * p.rebar.count; var el = document.getElementById('cw_As'); if (el) el.value = Math.round(As); }
                        var btn = document.getElementById('cw_calc'); if (btn) btn.click();
                    },
                    'deflection': function (p) {
                        if (p.b) { var el = document.getElementById('d_b'); if (el) el.value = p.b; }
                        if (p.h) { var el = document.getElementById('d_h'); if (el) el.value = p.h; }
                        if (p.concrete) { var el = document.getElementById('d_con'); if (el) el.value = p.concrete; }
                        if (p.steel) { var el = document.getElementById('d_reb'); if (el) el.value = p.steel; }
                        if (p.M) { var el = document.getElementById('d_M'); if (el) el.value = p.M; }
                        if (p.rebar) { var As = Math.PI * p.rebar.dia * p.rebar.dia / 4 * p.rebar.count; var el = document.getElementById('d_As'); if (el) el.value = Math.round(As); }
                        var btn = document.getElementById('d_calc'); if (btn) btn.click();
                    },
                    'column-axial': function (p) {
                        if (p.b) { var el = document.getElementById('ca_b'); if (el) el.value = p.b; }
                        if (p.h) { var el = document.getElementById('ca_h'); if (el) el.value = p.h; }
                        if (p.concrete) { var el = document.getElementById('ca_con'); if (el) el.value = p.concrete; }
                        if (p.steel) { var el = document.getElementById('ca_reb'); if (el) el.value = p.steel; }
                        if (p.N) { var el = document.getElementById('ca_N'); if (el) el.value = p.N; }
                        var btn = document.getElementById('ca_calc'); if (btn) btn.click();
                    },
                    'footing-col': function (p) {
                        if (p.N) { var el = document.getElementById('fc_N'); if (el) el.value = p.N; }
                        if (p.M) { var el = document.getElementById('fc_M'); if (el) el.value = p.M; }
                        if (p.concrete) { var el = document.getElementById('fc_con'); if (el) el.value = p.concrete; }
                        if (p.fak) { var el = document.getElementById('fc_fak'); if (el) el.value = p.fak; }
                        var btn = document.getElementById('fc_calc'); if (btn) btn.click();
                    },
                    'footing-wall': function (p) {
                        if (p.N) { var el = document.getElementById('fw_N'); if (el) el.value = p.N; }
                        if (p.concrete) { var el = document.getElementById('fw_con'); if (el) el.value = p.concrete; }
                        if (p.fak) { var el = document.getElementById('fw_fak'); if (el) el.value = p.fak; }
                        var btn = document.getElementById('fw_calc'); if (btn) btn.click();
                    },
                    'bearing-cap': function (p) {
                        if (p.N) { var el = document.getElementById('bc_N'); if (el) el.value = p.N; }
                        if (p.M) { var el = document.getElementById('bc_M'); if (el) el.value = p.M; }
                        if (p.fak) { var el = document.getElementById('bc_fak'); if (el) el.value = p.fak; }
                        var btn = document.getElementById('bc_calc'); if (btn) btn.click();
                    },
                    'punching': function (p) {
                        if (p.concrete) { var el = document.getElementById('pn_con'); if (el) el.value = p.concrete; }
                        var btn = document.getElementById('pn_calc'); if (btn) btn.click();
                    },
                    'shear-wall': function (p) {
                        if (p.b) { var el = document.getElementById('sw_bw'); if (el) el.value = p.b; }
                        if (p.h) { var el = document.getElementById('sw_hw'); if (el) el.value = p.h; }
                        if (p.N) { var el = document.getElementById('sw_N'); if (el) el.value = p.N; }
                        if (p.concrete) { var el = document.getElementById('sw_con'); if (el) el.value = p.concrete; }
                        var btn = document.getElementById('sw_calc'); if (btn) btn.click();
                    },
                    'mas-comp': function (p) {
                        if (p.b) { var el = document.getElementById('mc_b'); if (el) el.value = p.b; }
                        if (p.h) { var el = document.getElementById('mc_h'); if (el) el.value = p.h; }
                        if (p.N) { var el = document.getElementById('mc_N'); if (el) el.value = p.N; }
                        var btn = document.getElementById('mc_calc'); if (btn) btn.click();
                    }
                };

                var filler = fillMap[toolId];
                if (filler) {
                    try { filler(params); } catch (e) { console.warn('Auto-fill error:', e); }
                }
                var calcBtn = document.querySelector('#view .btn-primary');
                if (calcBtn && !filler) calcBtn.click();
            }

            /* ===== 模式切换 & AI 集成（多 API 提供商，OpenAI 兼容） ===== */
            var aiMode = 'kw'; // 'kw' or 'ds'

            /* ---- 提供商数据管理 ---- */
            function loadAIProviders() {
                var arr = [];
                try { arr = JSON.parse(localStorage.getItem('ai_providers') || '[]'); } catch(e) { arr = []; }
                // 兼容旧版 DeepSeek 单 Key 配置
                if (arr.length === 0) {
                    var oldKey = localStorage.getItem('deepseek_api_key') || '';
                    var oldMdl = localStorage.getItem('deepseek_model') || 'deepseek-chat';
                    if (oldKey) {
                        arr.push({ id: 'ds', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: oldKey, model: oldMdl, models: 'deepseek-chat,deepseek-reasoner' });
                        localStorage.setItem('ai_providers', JSON.stringify(arr));
                    }
                }
                return arr;
            }
            var aiProviders = loadAIProviders();
            var aiCurId = localStorage.getItem('ai_provider_cur') || (aiProviders[0] ? aiProviders[0].id : '');
            function currentAI() {
                for (var i = 0; i < aiProviders.length; i++) if (aiProviders[i].id === aiCurId) return aiProviders[i];
                return aiProviders[0] || null;
            }
            function saveAIProviders() {
                localStorage.setItem('ai_providers', JSON.stringify(aiProviders));
                localStorage.setItem('ai_provider_cur', aiCurId);
            }

            // 初始化 UI
            var kwBtn = document.getElementById('ai_mode_kw');
            var dsBtn = document.getElementById('ai_mode_ds');
            var dsConfig = document.getElementById('ai_ds_config');
            var dsHint = document.getElementById('ai_ds_hint');
            var hintKw = document.getElementById('ai_hint_kw');
            var provSel = document.getElementById('ai_provider_sel');
            var provAdd = document.getElementById('ai_provider_add');
            var provDel = document.getElementById('ai_provider_del');
            var pName = document.getElementById('ai_p_name');
            var pBase = document.getElementById('ai_p_base');
            var pKey = document.getElementById('ai_p_key');
            var pModels = document.getElementById('ai_p_models');
            var pModelSel = document.getElementById('ai_p_model_sel');
            var pSave = document.getElementById('ai_p_save');

            function fillProviderList() {
                provSel.innerHTML = '';
                for (var i = 0; i < aiProviders.length; i++) {
                    var o = document.createElement('option');
                    o.value = aiProviders[i].id;
                    o.textContent = aiProviders[i].name + (aiProviders[i].baseUrl ? '（' + aiProviders[i].baseUrl.replace(/^https?:\/\//, '') + '）' : '');
                    provSel.appendChild(o);
                }
                var cur = currentAI();
                if (cur) provSel.value = cur.id;
            }
            function fillProviderForm() {
                var p = currentAI();
                if (!p) { pName.value = ''; pBase.value = ''; pKey.value = ''; pModels.value = ''; pModelSel.innerHTML = ''; return; }
                pName.value = p.name || '';
                pBase.value = p.baseUrl || '';
                pKey.value = p.apiKey || '';
                pModels.value = (p.models || p.model || '');
                var models = String(p.models || p.model || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
                pModelSel.innerHTML = '';
                if (models.length === 0) {
                    var o = document.createElement('option'); o.value = ''; o.textContent = '（请填写模型名）'; pModelSel.appendChild(o);
                } else {
                    for (var i = 0; i < models.length; i++) {
                        var o2 = document.createElement('option');
                        o2.value = models[i];
                        o2.textContent = models[i];
                        pModelSel.appendChild(o2);
                    }
                    if (p.model && models.indexOf(p.model) >= 0) pModelSel.value = p.model;
                    else pModelSel.value = models[0];
                }
            }
            fillProviderList();
            fillProviderForm();

            var chatBtn = document.getElementById('ai_mode_chat');
            var chatPanel = document.getElementById('ai_chat_panel');
            // 获取原有的所有面板（关键词+单轮AI模式的那些面板）
            var origPanels = [
                document.getElementById('ai_match_panel'),
                document.getElementById('ai_params_panel'),
                document.getElementById('ai_result_panel'),
                document.getElementById('ai_explain_panel'),
                document.querySelector('#view .panel:nth-child(2)'), // 输入面板
                document.querySelector('#view .panel:last-child')   // 计算过程面板
            ];

            function switchMode(m) {
                aiMode = m;
                // 重置所有按钮样式
                kwBtn.className = 'btn btn-secondary'; kwBtn.style.cssText = 'flex:1';
                dsBtn.className = 'btn btn-secondary'; dsBtn.style.cssText = 'flex:1';
                if (chatBtn) { chatBtn.className = 'btn btn-secondary'; chatBtn.style.cssText = 'flex:1'; }

                // 隐藏所有面板的内容区（输入/匹配/参数/结果/解读 + 对话面板）
                var inputPanel = document.querySelector('#view .panel:nth-child(2)');
                var procPanel = document.querySelector('#view .panel:last-child');
                var matchPanel = document.getElementById('ai_match_panel');
                var paramsPanel = document.getElementById('ai_params_panel');
                var resultPanel = document.getElementById('ai_result_panel');
                var explainPanel = document.getElementById('ai_explain_panel');
                if (inputPanel) inputPanel.style.display = 'block';
                if (matchPanel) matchPanel.style.display = 'none';
                if (paramsPanel) paramsPanel.style.display = 'none';
                if (resultPanel) resultPanel.style.display = 'none';
                if (explainPanel) explainPanel.style.display = 'none';
                if (procPanel) procPanel.style.display = 'block';
                if (chatPanel) chatPanel.style.display = 'none';
                dsConfig.style.display = 'none';
                dsHint.style.display = 'none';

                if (m === 'kw') {
                    kwBtn.className = 'btn'; kwBtn.style.cssText = 'flex:1;background:var(--primary);color:#fff;border-color:var(--primary)';
                    hintKw.textContent = '请描述您要计算的问题，例如："矩形梁 b=300mm h=600mm C30 HRB400 As=1473 求受弯承载力" 或 "独立基础 柱轴力N=1000kN C30 fha=200kPa"。系统会自动识别工具并提取参数。';
                } else if (m === 'ds') {
                    dsBtn.className = 'btn'; dsBtn.style.cssText = 'flex:1;background:var(--primary);color:#fff;border-color:var(--primary)';
                    dsConfig.style.display = 'block';
                    dsHint.style.display = 'block';
                    hintKw.textContent = 'AI 模式：用自然语言描述计算需求，AI 会理解并匹配工具、提取参数，计算由工具箱完成。';
                } else if (m === 'chat') {
                    if (chatBtn) chatBtn.style.cssText = 'flex:1;background:linear-gradient(135deg,#533afd,#ea2261);color:#fff;border-color:transparent;';
                    // 隐藏原始的输入/匹配/参数/结果/计算过程面板
                    if (inputPanel) inputPanel.style.display = 'none';
                    if (matchPanel) matchPanel.style.display = 'none';
                    if (paramsPanel) paramsPanel.style.display = 'none';
                    if (resultPanel) resultPanel.style.display = 'none';
                    if (explainPanel) explainPanel.style.display = 'none';
                    if (procPanel) procPanel.style.display = 'none';
                    // 显示对话面板
                    if (chatPanel) chatPanel.style.display = 'block';
                    // 初始化对话界面（如果还没初始化）
                    if (window.AI_CHAT_UI && !chatPanel.innerHTML) {
                        chatPanel.innerHTML = window.AI_CHAT_UI.renderAssistant();
                        window.AI_CHAT_UI.bindAssistant();
                    }
                }
            }
            kwBtn.addEventListener('click', function(){ switchMode('kw'); });
            dsBtn.addEventListener('click', function(){ switchMode('ds'); });
            if (chatBtn) chatBtn.addEventListener('click', function(){ switchMode('chat'); });

            provSel.addEventListener('change', function(){
                aiCurId = provSel.value;
                localStorage.setItem('ai_provider_cur', aiCurId);
                fillProviderForm();
            });
            provAdd.addEventListener('click', function(){
                var id = 'p' + Date.now();
                aiProviders.push({ id: id, name: '新 API', baseUrl: 'https://api.example.com/v1', apiKey: '', model: '', models: '' });
                aiCurId = id;
                saveAIProviders();
                fillProviderList();
                fillProviderForm();
                pName.focus();
            });
            provDel.addEventListener('click', function(){
                if (aiProviders.length <= 1) { alert('至少保留一个 API 配置'); return; }
                var p = currentAI();
                if (!p) return;
                if (!confirm('确定删除「' + p.name + '」配置？')) return;
                aiProviders = aiProviders.filter(function(x){ return x.id !== aiCurId; });
                aiCurId = aiProviders[0].id;
                saveAIProviders();
                fillProviderList();
                fillProviderForm();
            });
            pModels.addEventListener('input', function(){
                var models = pModels.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
                pModelSel.innerHTML = '';
                if (models.length === 0) {
                    var o = document.createElement('option'); o.value = ''; o.textContent = '（请填写模型名）'; pModelSel.appendChild(o);
                } else {
                    for (var i = 0; i < models.length; i++) {
                        var o2 = document.createElement('option');
                        o2.value = models[i]; o2.textContent = models[i];
                        pModelSel.appendChild(o2);
                    }
                    pModelSel.value = models[0];
                }
            });
            pSave.addEventListener('click', function(){
                var p = currentAI();
                if (!p) return;
                p.name = pName.value.trim() || '未命名 API';
                p.baseUrl = pBase.value.trim();
                p.apiKey = pKey.value.trim();
                p.models = pModels.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean).join(',');
                p.model = pModelSel.value || (p.models.split(',')[0] || '');
                if (!p.baseUrl) { alert('请填写接口地址 Base URL'); return; }
                if (!/^https?:\/\//.test(p.baseUrl)) { alert('接口地址需以 http:// 或 https:// 开头'); return; }
                if (!p.apiKey) { alert('请填写 API Key'); return; }
                if (!p.model) { alert('请填写至少一个模型名'); return; }
                saveAIProviders();
                fillProviderList();
                fillProviderForm();
                pSave.textContent = '已保存 ✓';
                setTimeout(function(){ pSave.textContent = '保存配置'; }, 2000);
            });

            /* 构建工具列表 system prompt */
            function buildToolListPrompt() {
                var list = aiKeywords.map(function(it){
                    return '- ID: ' + it.id + ' | 名称: ' + it.name + ' | 关键词: ' + it.keywords.join('、');
                }).join('\n');
                return '你是一个结构工程计算助手。根据用户的自然语言描述，选择最匹配的计算工具并提取参数。\n\n' +
                    '可用工具列表：\n' + list + '\n\n' +
                    '请返回JSON格式（不要包含```json标记）：\n' +
                    '{"toolId":"工具ID","toolName":"工具名称","params":{"b":300,"h":600,"concrete":"C30","steel":"HRB400","N":1000,"M":80,"V":200,"q":5,"span":6,"rebar":{"count":3,"dia":20},"fak":180},"reason":"选择该工具的理由","missing":["未提取到的关键参数"]}\n\n' +
                    '参数说明：b=截面宽mm, h=截面高mm, concrete=混凝土等级如C30, steel=钢筋级别如HRB400, N=轴力kN, M=弯矩kN·m, V=剪力kN, q=均布荷载kN/m, span=跨度m, rebar=配筋{count,dia}, fak=地基承载力kPa\n' +
                    '只返回JSON，不要其他文字。';
            }

            /* 调用当前配置的 AI API（OpenAI 兼容格式） */
            function callAI(systemPrompt, userMessage, onOk, onErr) {
                var p = currentAI();
                if (!p) { onErr('请先在「AI API 配置」中新增并保存一个 API'); return; }
                if (!p.apiKey) { onErr('请先在「AI API 配置」中填写并保存 API Key'); return; }
                if (!p.model) { onErr('请先在「AI API 配置」中填写模型名'); return; }
                var base = (p.baseUrl || '').replace(/\/+$/, '');
                var url = /\/chat\/completions$/i.test(base) ? base : base + '/chat/completions';
                if (!/^https?:\/\//.test(url)) { onErr('接口地址无效，需以 http(s):// 开头'); return; }
                var btn = document.getElementById('ai_analyze');
                var oldText = btn.textContent;
                btn.textContent = 'AI 分析中...'; btn.disabled = true;

                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + p.apiKey },
                    body: JSON.stringify({
                        model: p.model,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ],
                        temperature: 0.1,
                        stream: false
                    })
                }).then(function(res){
                    if (!res.ok) {
                        return res.text().then(function(t){
                            var msg = 'API错误 ' + res.status;
                            try { var j = JSON.parse(t); if (j.error) msg += '：' + (j.error.message || j.error.code || ''); }
                            catch(e2) { if (t.length < 300) msg += '：' + t; }
                            if (res.status === 401) msg += '（API Key 无效或已过期）';
                            else if (res.status === 402 || res.status === 429) msg += '（余额不足或被限流）';
                            else if (res.status === 404) msg += '（接口地址或模型名无效，请检查 Base URL 与模型）';
                            onErr(msg);
                        });
                    }
                    return res.json();
                }).then(function(data){
                    btn.textContent = oldText; btn.disabled = false;
                    if (!data || !data.choices || !data.choices[0]) {
                        var detail = data ? JSON.stringify(data).substring(0, 300) : '空响应';
                        onErr('API返回异常：' + detail);
                        return;
                    }
                    onOk(data.choices[0].message.content);
                }).catch(function(e){
                    btn.textContent = oldText; btn.disabled = false;
                    var msg = e.message || '未知';
                    if (msg.indexOf('Failed to fetch') >= 0 || msg.indexOf('NetworkError') >= 0) {
                        onErr('网络/CORS错误：浏览器无法直接访问该 API。建议：1)用 Chrome 安装 CORS 插件；2)或部署后端代理；3)或确认接口地址可公网访问。技术详情：' + msg);
                    } else {
                        onErr('请求失败：' + msg + '（可能是CORS限制，建议使用代理或本地部署）');
                    }
                });
            }

            /* AI 结果解读 */
            function aiExplainResult(toolName, calcResult, procText) {
                var p = currentAI();
                if (!p || !p.apiKey) return;
                var explainPanel = document.getElementById('ai_explain_panel');
                var explainDiv = document.getElementById('ai_explain');
                explainPanel.style.display = 'block';
                explainDiv.innerHTML = '<div class="hint">AI 正在解读计算结果...</div>';

                var prompt = '你是结构工程专家。以下是用"' + toolName + '"工具计算的结果，请用通俗易懂的语言解读计算结果，指出是否满足规范要求，并给出建议。\n\n' +
                    '计算结果摘要：\n' + calcResult + '\n\n详细计算过程：\n' + procText + '\n\n请用简洁的中文解读（200字以内）：';
                callAI('你是结构工程计算专家，擅长解读计算结果。', prompt,
                    function(resp){
                        explainDiv.innerHTML = '<div style="line-height:1.8;font-size:14px">' + resp.replace(/\n/g, '<br>') + '</div>';
                    },
                    function(err){ explainDiv.innerHTML = '<div class="error-box">' + err + '</div>'; }
                );
            }

            /* AI 模式分析 */
            function analyzeWithAI() {
                var input = document.getElementById('ai_input').value.trim();
                if (!input) { alert('请输入您的计算问题'); return; }
                var p = currentAI();
                if (!p || !p.apiKey) { alert('请先在「AI API 配置」中填写并保存 API Key'); return; }

                var matchPanel = document.getElementById('ai_match_panel');
                var paramsPanel = document.getElementById('ai_params_panel');
                var resultPanel = document.getElementById('ai_result_panel');
                var explainPanel = document.getElementById('ai_explain_panel');
                var matchDiv = document.getElementById('ai_match');
                var paramsDiv = document.getElementById('ai_params');
                var procDiv = document.getElementById('ai_proc');

                matchPanel.style.display = 'block';
                matchDiv.innerHTML = '<div class="hint">AI 正在分析...</div>';
                paramsPanel.style.display = 'none';
                resultPanel.style.display = 'none';
                explainPanel.style.display = 'none';
                procDiv.innerHTML = '';

                callAI(buildToolListPrompt(), input,
                    function(resp) {
                        var ai;
                        try { ai = JSON.parse(resp); } catch(e) {
                            // 尝试提取JSON
                            var m = resp.match(/\{[\s\S]*\}/);
                            if (m) { try { ai = JSON.parse(m[0]); } catch(e2) { ai = null; } }
                        }
                        if (!ai || !ai.toolId) {
                            matchDiv.innerHTML = '<div class="error-box">AI 未能识别计算类型，请尝试更明确的描述。</div>';
                            return;
                        }
                        var toolId = ai.toolId;
                        var toolName = ai.toolName || toolId;
                        var params = ai.params || {};
                        var reason = ai.reason || '';
                        var missing = ai.missing || [];

                        matchDiv.innerHTML =
                            '<div class="result-item"><span class="label">识别工具</span><span class="value"><b>' + toolName + '</b> ' + tag('ok','AI匹配') + '</span></div>' +
                            '<div class="result-item"><span class="label">AI 分析</span><span class="value">' + reason + '</span></div>' +
                            (missing.length ? '<div class="result-item"><span class="label">未提取参数</span><span class="value">' + missing.join('、') + '（将用默认值）</span></div>' : '') +
                            '<div style="margin-top:12px"><button type="button" class="btn btn-primary" id="ai_go">自动填入并计算</button></div>';

                        paramsPanel.style.display = 'block';
                        var paramHtml = '';
                        if (params.concrete) paramHtml += resultRow('混凝土等级', params.concrete);
                        if (params.steel) paramHtml += resultRow('钢筋级别', params.steel);
                        if (toolId === 'beam-t') {
                            if (params.b !== undefined) paramHtml += resultRow('腹板宽 b', params.b + ' mm');
                            if (params.h !== undefined) paramHtml += resultRow('梁高 h', params.h + ' mm');
                            if (params.bf !== undefined) paramHtml += resultRow('翼缘宽 bf', params.bf + ' mm');
                            if (params.hf !== undefined) paramHtml += resultRow('翼缘厚 hf', params.hf + ' mm');
                            if (params.As !== undefined) paramHtml += resultRow('受拉钢筋面积 As', params.As + ' mm²');
                            if (params.a_s !== undefined) paramHtml += resultRow('保护层 a_s', params.a_s + ' mm');
                        } else {
                            if (params.b) paramHtml += resultRow('截面宽 b', params.b + ' mm');
                            if (params.h) paramHtml += resultRow('截面高 h', params.h + ' mm');
                            if (params.rebar) paramHtml += resultRow('配筋', params.rebar.count + '根' + params.rebar.dia);
                        }
                        if (params.N !== undefined) paramHtml += resultRow('轴向力 N', params.N + ' kN');
                        if (params.M !== undefined) paramHtml += resultRow('弯矩 M', params.M + ' kN·m');
                        if (params.V !== undefined) paramHtml += resultRow('剪力 V', params.V + ' kN');
                        if (params.q !== undefined) paramHtml += resultRow('均布荷载 q', params.q + ' kN/m');
                        if (params.span) paramHtml += resultRow('跨度', params.span + ' m');
                        if (params.fak !== undefined) paramHtml += resultRow('地基承载力', params.fak + ' kPa');
                        if (!paramHtml) paramHtml = '<div class="hint">未提取到参数，将使用默认值。</div>';
                        paramsDiv.innerHTML = paramHtml;

                        document.getElementById('ai_go').addEventListener('click', function () {
                            tracePush({ step: 'ds_ai_go_click', tool: toolId, params_keys: Object.keys(params) });
                            goTool(toolId);
                            setTimeout(function() {
                                autoFillTool(toolId, params);
                                // 等100ms让计算完成后，读取结果并让AI解读
                                setTimeout(function() {
                                    var calcResult = '';
                                    var procText = '';
                                    var view = document.getElementById('view');
                                    if (view) {
                                        calcResult = view.innerText.substring(0, 2000);
                                        var proc = view.querySelector('.proc-body');
                                        if (proc) procText = proc.innerText.substring(0, 2000);
                                    }
                                    aiExplainResult(toolName, calcResult, procText);
                                }, 500);
                            }, 150);
                        });
                    },
                    function(err) {
                        matchDiv.innerHTML = '<div class="error-box">' + err + '</div>';
                    }
                );
            }

            document.getElementById('ai_analyze').addEventListener('click', function() {
                if (aiMode === 'ds') analyzeWithAI();
                else analyze();
            });
            document.getElementById('ai_clear').addEventListener('click', function () {
                document.getElementById('ai_input').value = '';
                document.getElementById('ai_match_panel').style.display = 'none';
                document.getElementById('ai_params_panel').style.display = 'none';
                document.getElementById('ai_result_panel').style.display = 'none';
                document.getElementById('ai_explain_panel').style.display = 'none';
                document.getElementById('ai_proc').innerHTML = '';
            });
            document.getElementById('ai_input').addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault();
                    if (aiMode === 'ds') analyzeWithAI(); else analyze();
                }
            });

            // ===== 初始模式：如果 AI 对话模块已加载，默认进入对话模式 =====
            // 同时将 AI 调用函数暴露到全局，供 AI 对话模块使用
            window._aiCallAI = callAI;
            window._aiCurrentAI = currentAI;
            if (window.AI_CHAT_UI && window.AI_TOOL_REGISTRY) {
                aiMode = 'chat';
            }
            switchMode(aiMode);
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['calc-assistant'] = tool;
})();
