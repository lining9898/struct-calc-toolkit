/* ==========================================================
 *  AI 对话与编排逻辑 —— AI_CHAT
 *  处理多轮对话、AI意图识别、参数提取、工具调用、结果解释
 *  依赖: AI_TASK, AI_TOOL_REGISTRY, currentAI() / callAI()
 * （currentAI 和 callAI 在 index.html 里已有定义，直接用）
 * ========================================================== */
(function () {
    'use strict';

    // 对话历史
    var messages = [];
    var listeners = [];

    function notify() {
        listeners.forEach(function (fn) {
            try { fn(messages); } catch (e) { console.error('[AI_CHAT] listener error:', e); }
        });
    }

    function subscribe(fn) {
        listeners.push(fn);
        return function () {
            var idx = listeners.indexOf(fn);
            if (idx >= 0) listeners.splice(idx, 1);
        };
    }

    function getMessages() {
        return messages.slice();
    }

    function addMessage(role, content, meta) {
        var msg = {
            id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            role: role, // 'user' | 'assistant' | 'system' | 'status'
            content: content,
            meta: meta || {},
            timestamp: Date.now()
        };
        messages.push(msg);
        notify();
        return msg;
    }

    function updateMessage(id, updates) {
        for (var i = 0; i < messages.length; i++) {
            if (messages[i].id === id) {
                Object.assign(messages[i], updates);
                notify();
                return messages[i];
            }
        }
        return null;
    }

    function clearMessages() {
        messages = [];
        window.AI_TASK && window.AI_TASK.clearTask();
        notify();
    }

    /* ==========================================================
     *  步骤状态指示（AI工作进度）
     * ========================================================== */
    var stepStatus = {
        understanding: 'pending',   // pending / running / done / error
        tool_matching: 'pending',
        param_extracting: 'pending',
        param_checking: 'pending',
        calculating: 'pending',
        explaining: 'pending'
    };
    var stepListeners = [];

    function notifyStep() {
        stepListeners.forEach(function (fn) {
            try { fn(stepStatus); } catch (e) {}
        });
    }

    function subscribeSteps(fn) {
        stepListeners.push(fn);
        return function () {
            var i = stepListeners.indexOf(fn);
            if (i >= 0) stepListeners.splice(i, 1);
        };
    }

    function setStep(name, status) {
        if (stepStatus[name] !== undefined) {
            stepStatus[name] = status;
            notifyStep();
        }
    }

    function resetSteps() {
        Object.keys(stepStatus).forEach(function (k) { stepStatus[k] = 'pending'; });
        notifyStep();
    }

    /* ==========================================================
     *  chat 路径 trace 探针：定位 bridge 之前卡在哪一步
     *  全部 push 到 window.AI_DEBUG_TRACE，复用右上角面板
     * ========================================================== */
    function _chatTracePush(record) {
        try {
            if (!window.AI_DEBUG_TRACE) window.AI_DEBUG_TRACE = [];
            record._t = Date.now();
            record.from = 'chat';
            window.AI_DEBUG_TRACE.push(record);
            // 复用 ai-tool-registry 的面板更新（如果它已加载）
            if (typeof window._aiBridgeTraceUpdate === 'function') {
                window._aiBridgeTraceUpdate(record);
            }
        } catch (e) {}
    }

    /* ==========================================================
     *  构建工具列表描述（用于AI prompt）
     * ========================================================== */
    function buildToolListForPrompt() {
        var tools = window.AI_TOOL_REGISTRY ? window.AI_TOOL_REGISTRY.list : [];
        if (!tools || tools.length === 0) return '';
        var lines = [];
        tools.forEach(function (t, i) {
            var params = (t.required_parameters || []).map(function (p) {
                return p.name + '(' + p.label + ', ' + (p.unit || '无单位') + ')';
            }).join('、');
            lines.push((i+1) + '. tool_id: ' + t.tool_id);
            lines.push('   名称: ' + t.tool_name);
            lines.push('   简介: ' + t.description);
            lines.push('   主要参数: ' + params);
            lines.push('');
        });
        return lines.join('\n');
    }

    /* ==========================================================
     *  阶段1：理解 + 工具匹配
     * ========================================================== */
    function understandAndMatch(userInput, callback) {
        setStep('understanding', 'running');

        var toolList = buildToolListForPrompt();
        var prompt =
            '你是一位结构工程计算助手。请从用户输入中识别计算意图，匹配最合适的计算工具。\n\n' +
            '【可用工具列表】\n' + toolList + '\n' +
            '【用户输入】\n' + userInput + '\n\n' +
            '请以JSON格式回答，字段如下：\n' +
            '{\n' +
            '  "tool_id": "匹配的工具tool_id，必须是上面列表中存在的id",\n' +
            '  "tool_name": "工具名称",\n' +
            '  "confidence": 0到1的置信度数值,\n' +
            '  "reason": "判断理由，简短说明",\n' +
            '  "candidates": [\n' +
            '    {"tool_id": "...", "tool_name": "...", "score": 0.8}\n' +
            '  ]\n' +
            '}\n' +
            '如果有多个可能的工具，请在candidates中列出前3个。只返回JSON，不要有其他文字。';

        callAI_Internal(prompt, '', function (resp) {
            setStep('understanding', 'done');
            var result = parseJSON(resp);
            if (result && result.tool_id) {
                // ===== T形截面冲突检测 =====
                // 如果AI选了beam-rect，但文本里有T形梁特征 → 切到beam-t
                var featDetect = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.detectTBeamFeatures
                    ? window.AI_TOOL_REGISTRY.detectTBeamFeatures(userInput)
                    : null;
                if (result.tool_id === 'beam-rect' && featDetect && featDetect.hasTFeature) {
                    result.tool_id = 'beam-t';
                    result.tool_name = 'T形梁正截面承载力';
                    result.reason = (result.reason || '') +
                        '（检测到T形截面特征：' + featDetect.features.join('、') + '，已切换T形梁工具）';
                }
                setStep('tool_matching', 'done');
                callback({ success: true, match: result });
            } else {
                setStep('tool_matching', 'error');
                // 尝试关键词匹配作为fallback
                var kwResults = window.AI_TOOL_REGISTRY.searchByKeyword(userInput);
                if (kwResults && kwResults.length > 0) {
                    callback({
                        success: true,
                        match: {
                            tool_id: kwResults[0].tool.tool_id,
                            tool_name: kwResults[0].tool.tool_name,
                            confidence: 0.5,
                            reason: '（关键词匹配 fallback）'
                        },
                        fallback: true
                    });
                } else {
                    callback({ success: false, error: '未能识别计算类型' });
                }
            }
        });
    }

    /* ==========================================================
     *  阶段2：从用户输入提取参数
     * ========================================================== */
    function extractParameters(userInput, tool_id, isDebug, callback) {
        // isDebug 参数兼容旧调用（传2个参数时callback是第3个）
        if (typeof isDebug === 'function') {
            callback = isDebug;
            isDebug = false;
        }
        setStep('param_extracting', 'running');
        var tool = window.AI_TOOL_REGISTRY.get(tool_id);
        if (!tool) {
            setStep('param_extracting', 'error');
            callback({ success: false, error: '工具不存在' });
            return;
        }

        // Debug 模式：直接走本地正则解析，不调用 LLM
        if (isDebug && window.AI_LOCAL_PARSER) {
            var localResult = window.AI_LOCAL_PARSER.parseForTool(userInput, tool_id);
            if (localResult && localResult.extracted && localResult.extracted.length > 0) {
                setStep('param_extracting', 'done');
                callback({
                    success: true,
                    data: {
                        parameters: localResult.parameters,
                        extracted: localResult.extracted,
                        modified: localResult.extracted,
                        user_intent: '（本地解析模式）',
                        source: 'local_parser'
                    }
                });
            } else {
                setStep('param_extracting', 'error');
                callback({ success: false, error: '本地解析器未能提取任何参数' });
            }
            return;
        }

        var allParams = (tool.required_parameters || []).concat(tool.optional_parameters || []);
        var paramDescs = allParams.map(function (p) {
            var optsStr = p.options ? '，可选值: [' + p.options.join(', ') + ']' : '';
            var typeStr = p.type || 'string';
            return '- ' + p.name + '（' + p.label + '，类型: ' + typeStr + '，单位: ' + (p.unit || '无') + optsStr + '）' +
                (p.required ? ' [必填]' : ' [可选]') +
                (p.default !== undefined ? ' 默认值: ' + p.default : '');
        }).join('\n');

        var task = window.AI_TASK.getCurrent();
        var existingParams = task ? task.parameters : {};
        var existingStr = Object.keys(existingParams).length > 0
            ? JSON.stringify(existingParams, null, 2)
            : '（暂无已填参数）';

        var prompt =
            '你是结构工程计算助手。请从用户最新输入中提取计算参数，并与已有参数合并。\n\n' +
            '【当前工具】' + tool.tool_name + '（' + tool_id + '）\n\n' +
            '【参数清单】\n' + paramDescs + '\n\n' +
            '【已有参数】\n' + existingStr + '\n\n' +
            '【用户最新输入】\n' + userInput + '\n\n' +
            '请做以下事情：\n' +
            '1. 从用户输入中提取所有能识别的参数值\n' +
            '2. 与已有参数合并（新提取的覆盖旧的，旧的保留不变）\n' +
            '3. 如果用户提到的尺寸/参数不明确对应哪个字段，做合理推断\n' +
            '4. 如果用户要求修改某个参数，只改那个参数，其他保持不变\n\n' +
            '请以JSON格式回答：\n' +
            '{\n' +
            '  "parameters": { "参数名": 值, ... },\n' +
            '  "extracted": ["提取到的参数名列表"],\n' +
            '  "modified": ["被修改的参数名列表"],\n' +
            '  "user_intent": "用户意图简述（1句话）",\n' +
            '  "missing_hint": "必填参数中还缺哪些，简短说明"\n' +
            '}\n' +
            '【重要】parameters 的 key 必须严格使用上面【参数清单】中给出的英文标识符（如 b、h、As、a_s、concrete 等），不要用中文名称（如"梁宽"、"截面高度"），也不要自行改名（如 width、height、rebar_area）。大小写也要完全一致，例如 As 不能写成 as 或 AS。\n' +
            '注意：值的类型要正确（数字就是数字，字符串就是字符串）。枚举类型的值必须是可选值之一。只返回JSON，不要有额外的解释文字。';

        callAI_Internal(prompt, '', function (resp) {
            setStep('param_extracting', 'done');
            var result = parseJSON(resp);
            if (result && result.parameters) {
                callback({ success: true, data: result });
            } else {
                callback({ success: false, error: '参数提取失败' });
            }
        });
    }

    /* ==========================================================
     *  阶段3：生成AI回复（自然语言对结果的解释 / 追问缺失参数）
     * ========================================================== */
    function generateReply(context, callback) {
        setStep('explaining', 'running');
        var task = window.AI_TASK.getCurrent();
        var tool = task ? window.AI_TOOL_REGISTRY.get(task.tool_id) : null;

        var prompt = '';
        if (!task || !tool) {
            // 没有当前任务，引导用户
            prompt =
                '你是结构工程计算助手，请用专业、亲切的语气回应用户。\n' +
                '用户输入：' + context.userInput + '\n' +
                '目前还没有确定具体的计算任务。请引导用户描述要计算的内容，' +
                '比如"帮我验算一块叠合板"、"300x600 C30梁正截面"等。\n' +
                '回复控制在2-3句话。';
        } else if (task.status === window.AI_TASK.STATUS.COMPLETED && task.result) {
            // 计算完成，生成工程化解释
            var result = task.result;
            var resultStr = JSON.stringify(result, null, 2);
            var paramSummary = window.AI_TASK.getParamSummary();
            prompt =
                '你是资深结构工程师。基于真实计算结果，用专业、清晰的语言给用户一份计算结论说明。\n\n' +
                '【工具】' + tool.tool_name + '\n' +
                '【输入参数】\n' + paramSummary + '\n\n' +
                '【计算结果（结构化）】\n' + resultStr + '\n\n' +
                '请按以下结构组织回复：\n' +
                '1. 总体结论（一句话，是否满足要求）\n' +
                '2. 关键验算项摘要（列出主要的几个验算项和结果）\n' +
                '3. 注意事项或建议（1-2条，基于计算结果）\n\n' +
                '要求：\n' +
                '- 用工程语言，专业但不晦涩\n' +
                '- 数值要引用真实计算结果，不要自己编造\n' +
                '- 所有结论必须基于上面的计算结果\n' +
                '- 用HTML格式，使用<b>加粗关键数字</b>，用<ul>/<li>列要点\n' +
                '- 不要编造计算过程，只总结结果';
        } else {
            // 收集参数阶段，追问缺失参数
            var missing = task.missing_parameters || [];
            var paramSummary = window.AI_TASK.getParamSummary();
            var missingDetails = missing.map(function (name) {
                var meta = window.AI_TASK.getParamMeta(task.tool_id, name);
                return meta ? (meta.label + '（' + name + '，' + (meta.unit || '无单位') + '）') : name;
            }).join('、');

            prompt =
                '你是结构工程计算助手。当前正在进行【' + tool.tool_name + '】计算。\n\n' +
                '【已填参数】\n' + paramSummary + '\n\n' +
                '【还缺少的必填参数】' + (missingDetails || '无') + '\n\n' +
                '【用户最新输入】' + context.userInput + '\n\n' +
                '请用自然、专业的语气回复用户：\n' +
                '- 如果缺少必填参数，一次性告诉用户还需要哪些参数（不要逐个问）\n' +
                '- 如果参数已经齐全，告诉用户可以开始计算了\n' +
                '- 如果用户刚刚修改了某个参数，先确认收到修改，再说明还缺什么\n' +
                '- 回复控制在2-4句话\n' +
                '- 用HTML格式，适当加粗重要信息';
        }

        callAI_Internal(prompt, '', function (resp) {
            setStep('explaining', 'done');
            callback({ success: true, reply: resp || '（AI未返回内容）' });
        });
    }

    /* ==========================================================
     *  主流程：处理用户一条消息
     * ========================================================== */
    function handleUserMessage(userInput) {
        addMessage('user', userInput);
        resetSteps();

        // 检测 debug 模式（#debug 前缀 → 走本地正则解析，不依赖 LLM）
        var debugInfo = window.AI_LOCAL_PARSER && window.AI_LOCAL_PARSER.checkDebugMode(userInput);
        var isDebug = debugInfo && debugInfo.isDebug;
        var cleanInput = isDebug ? debugInfo.cleanText : userInput;

        // ===== 规范意图优先分流（standard intent detection） =====
        // 顺序：规范判断 → 是则走 RAG；否则才走原有计算工具流程。
        // 打断/挂起当前 calculation task：不创建新 task、不进参数收集、不追问缺失参数。
        // 旧 task 状态保持不变，用户后续说"继续算"可恢复。
        if (_isStandardQuery(cleanInput) && window.KNOWLEDGE_BASE) {
            // trace: 识别到规范意图
            _chatTracePush({
                step: 'standard_intent_detected',
                input: cleanInput.substring(0, 80),
                standard_route: true,
                calculation_route: false,
                interrupted_task: window.AI_TASK && window.AI_TASK.getCurrent()
                    ? window.AI_TASK.getCurrent().tool_id
                    : null
            });

            setStep('understanding', 'done');
            setStep('tool_matching', 'done');
            setStep('param_extracting', 'done');
            setStep('param_checking', 'done');
            setStep('calculating', 'running');

            var searchingMsg = addMessage('assistant', '<div class="ai-reply">🔍 正在检索规范知识库...</div>');

            // trace: 进入规范路由
            _chatTracePush({ step: 'standard_route', query: cleanInput.substring(0, 80) });

            // 调用项目现有 searchStandard（retrieval.js 唯一入口）
            _chatTracePush({ step: 'standard_retrieval', query: cleanInput.substring(0, 80) });
            window.KNOWLEDGE_BASE.searchStandard(cleanInput, { limit: 5 }, function (results) {
                if (!results || results.length === 0) {
                    // 未命中：固定兜底，不回退到计算工具、不创建 task、不提示补参数
                    setStep('calculating', 'error');
                    _chatTracePush({ step: 'standard_retrieval_no_hit', query: cleanInput.substring(0, 80) });
                    updateMessage(searchingMsg.id, {
                        content:
                            '<div class="ai-reply ai-reply-warn">' +
                            '当前知识库未找到对应条文，请人工核对正式规范。' +
                            '</div>'
                    });
                    return;
                }
                // 命中：渲染规范引用卡
                setStep('calculating', 'done');
                _chatTracePush({
                    step: 'standard_result',
                    hit_count: results.length,
                    top_hits: results.slice(0, 3).map(function (r) { return r.id; })
                });
                var html = _renderStandardCards(results, cleanInput);
                updateMessage(searchingMsg.id, { content: html });
                _chatTracePush({ step: 'standard_citation_rendered', hit_count: results.length });
            });
            return;
        }

        if (isDebug) {
            console.log('[AI_TOOL] Debug模式：使用本地正则解析器');
            addMessage('assistant', '<div class="ai-reply ai-reply-warn">🔍 <b>本地解析模式</b>（不调用LLM，用正则提取参数）<br>正在识别计算类型...</div>');
        }

        var task = window.AI_TASK.getCurrent();

        // 步骤1: 理解与工具匹配（无任务时必须做，有任务时可选做意图切换判断）
        if (!task) {
            if (isDebug) {
                // Debug 模式：工具匹配直接走关键词搜索，不调用 LLM
                var kwResults = window.AI_TOOL_REGISTRY.searchByKeyword(cleanInput);
                if (kwResults && kwResults.length > 0) {
                    var topMatch = {
                        tool_id: kwResults[0].tool.tool_id,
                        tool_name: kwResults[0].tool.tool_name,
                        confidence: 0.9,
                        reason: '（debug模式-关键词匹配）',
                        candidates: kwResults.slice(0, 3).map(function (r) {
                            return { tool_id: r.tool.tool_id, tool_name: r.tool.tool_name, score: r.score };
                        })
                    };
                    console.log('[AI_TOOL] Debug模式 关键词匹配: ' + topMatch.tool_id);
                    // 路由 trace
                    if (window.AI_DEBUG_TRACE && typeof window.AI_DEBUG_TRACE.push === 'function') {
                        window.AI_DEBUG_TRACE.push({
                            step: 'route_selected',
                            mode: 'debug_kw',
                            input: cleanInput.substring(0, 40),
                            candidates: kwResults.slice(0, 3).map(function(r){return r.tool.tool_id;}),
                            selected: topMatch.tool_id,
                            reason: topMatch.reason,
                            _t: Date.now()
                        });
                    }
                    setStep('understanding', 'done');
                    setStep('tool_matching', 'done');
                    // Debug 模式跳过意图确认，直接建任务
                    createTaskFromMatch(topMatch, cleanInput, isDebug);
                } else {
                    addMessage('assistant',
                        '<div class="ai-reply ai-reply-warn">[Debug模式] 未能通过关键词识别计算类型。请包含"矩形梁"、"叠合板"等关键词。</div>');
                }
                return;
            }
            // 新建任务流程
            understandAndMatch(cleanInput, function (matchRes) {
                if (!matchRes.success) {
                    addMessage('assistant',
                        '<div class="ai-reply ai-reply-warn">抱歉，我没能识别你要做哪种计算。' +
                        '请尝试更明确的描述，比如"叠合板验算"、"梁正截面承载力"、"柱下独立基础"等。</div>');
                    return;
                }
                var match = matchRes.match;
                console.log('[AI_TOOL] 识别工具: ' + match.tool_id + ' (' + match.tool_name + '), 置信度: ' + match.confidence);
                // 路由 trace
                if (window.AI_DEBUG_TRACE && typeof window.AI_DEBUG_TRACE.push === 'function') {
                    window.AI_DEBUG_TRACE.push({
                        step: 'route_selected',
                        mode: matchRes.fallback ? 'kw_fallback' : 'llm',
                        input: cleanInput.substring(0, 40),
                        candidates: (match.candidates || []).slice(0, 3).map(function(c){return c.tool_id;}),
                        selected: match.tool_id,
                        reason: (match.reason || '').substring(0, 60),
                        _t: Date.now()
                    });
                }
                // 低置信度时给出候选让用户确认
                if (match.confidence < 0.6 && match.candidates && match.candidates.length > 1) {
                    var candHtml = '<div class="ai-reply">我可能理解的意思，请确认：<ul>';
                    match.candidates.forEach(function (c) {
                        candHtml += '<li style="cursor:pointer;color:#2563eb;text-decoration:underline;" ' +
                            'onclick="window.AI_CHAT.confirmTool(\'' + c.tool_id + '\')">' +
                            c.tool_name + '（置信度 ' + Math.round(c.score * 100) + '%）</li>';
                    });
                    candHtml += '</ul></div>';
                    addMessage('assistant', candHtml, { type: 'candidate_list' });
                    return;
                }
                 // 设计意图提示：检查用户意图与工具 limitations 是否冲突
                 // （例如用户想"设计配筋"，但 beam-rect 只支持复核）
                 var intentCheck = checkIntentVsLimitations(cleanInput, match.tool_id);
                 if (intentCheck.needs_confirmation) {
                     addMessage('assistant', intentCheck.message, { type: 'intent_confirmation' });
                     return;
                 }
                 // 高置信度，直接建任务
                 createTaskFromMatch(match, cleanInput, isDebug);
             });
         } else {
            // 有当前任务：先判断用户是不是在切换工具
            // 简化处理：直接提取参数并合并
            processExistingTask(cleanInput, isDebug);
        }
    }

    /* ==========================================================
     *  设计意图 vs 工具能力边界 检查
     *  用户输入如果是"求配筋/配多少/算面积/设计"等设计类意图，
     *  而匹配到的工具只支持复核，就先提示边界，让用户确认后再继续。
     * ========================================================== */
    var DESIGN_INTENT_PATTERNS = [
        /配(多少|筋|几)/,
        /需要(多少|配|钢筋|面积)/,
        /求(配筋|钢筋|面积|As)/,
        /(怎么|如何)配/,/设计(配筋|截面)?$/,
        /算(配筋|需要多少钢筋)/,
        /要配多(大|少)/,
        /(选|选筋|选钢筋)/
    ];

    function checkIntentVsLimitations(userInput, tool_id) {
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(tool_id);
        if (!tool) return { needs_confirmation: false };

        var limitations = tool.limitations || [];
        var hasDesignLimit = limitations.some(function (l) {
            return l.indexOf('设计') >= 0 && (l.indexOf('不支持') >= 0 || l.indexOf('不做') >= 0);
        });
        if (!hasDesignLimit) return { needs_confirmation: false };

        // 检查用户输入是否含设计意图
        var hasDesignIntent = DESIGN_INTENT_PATTERNS.some(function (re) {
            return re.test(userInput);
        });
        // 也检查：用户提到了"弯矩"但没提到"配筋面积/As"，可能是想给定弯矩算配筋
        var hasMomentNoAs = /弯矩|M\s*[=＝]/.test(userInput) && !/(As|配筋面积|钢筋面积|配了|实配)/.test(userInput);

        if (!hasDesignIntent && !hasMomentNoAs) return { needs_confirmation: false };

        var msg = '<div class="ai-reply ai-reply-warn">' +
            '当前【' + tool.tool_name + '】工具支持：已知配筋面积后验算承载力。' +
            '<br>它<b>不支持</b>根据目标弯矩自动反算需要多少钢筋。' +
            '<br><br>你是想：' +
            '<br>① <b>已有配筋，做承载力复核</b>（继续用本工具）' +
            '<br>② 需要按弯矩估算配筋（本工具暂不支持）' +
            '<br><br>' +
            '<button class="btn btn-primary" onclick="window.AI_CHAT.confirmContinueWithTool(\'' + tool_id + '\')" style="margin-right:8px">继续 · 我要做复核</button>' +
            '<button class="btn btn-secondary" onclick="window.AI_CHAT.dismissIntentHint()">先取消</button>' +
            '</div>';

        return { needs_confirmation: true, message: msg, tool_id: tool_id };
    }

    function createTaskFromMatch(match, userInput, isDebug) {
        var tool_id = match.tool_id;
        window.AI_TASK.newTask(tool_id);
        setStep('tool_matching', 'done');
        console.log('[AI_TOOL] 已创建任务: ' + tool_id);

        // chat 路径 trace：建任务完成
        _chatTracePush({
            step: 'chat_task_created',
            tool: tool_id,
            is_debug: !!isDebug,
            match_reason: (match.reason || '').substring(0, 60)
        });

        // 提取参数
        extractParameters(userInput, tool_id, isDebug, function (extRes) {
            handleExtractResult(extRes, userInput, isDebug);
        });
    }

    function processExistingTask(userInput, isDebug) {
        var task = window.AI_TASK.getCurrent();
        console.log('[AI_TOOL] 已有任务，继续提取参数: ' + task.tool_id);
        // 提取参数（可能有新的或修改的）
        extractParameters(userInput, task.tool_id, isDebug, function (extRes) {
            handleExtractResult(extRes, userInput, isDebug);
        });
    }

    /**
     * 统一处理参数提取结果：合并 + 检查 + 流转
     */
    function handleExtractResult(extRes, userInput, isDebug) {
        var task = window.AI_TASK.getCurrent();
        if (!task) return;

        // chat 路径 trace：参数提取结果
        _chatTracePush({
            step: 'chat_extract_result',
            tool: task.tool_id,
            success: !!(extRes && extRes.success),
            param_keys: (extRes && extRes.data && extRes.data.parameters) ? Object.keys(extRes.data.parameters) : [],
            error: (extRes && extRes.error) || null
        });

        if (extRes.success && extRes.data && extRes.data.parameters) {
            window.AI_TASK.mergeParameters(extRes.data.parameters);
            setStep('param_checking', 'done');
            // Debug模式：在对话中显示解析结果，便于排查
            if (isDebug) {
                var paramsHtml = '<b>[DEBUG解析] 已识别参数</b><br>';
                var keys = Object.keys(extRes.data.parameters);
                if (keys.length === 0) {
                    paramsHtml += '<span style="color:#dc2626">⚠ 未识别到任何参数</span>';
                } else {
                    keys.forEach(function (k) {
                        paramsHtml += '&nbsp;&nbsp;' + k + ' = <b>' + extRes.data.parameters[k] + '</b><br>';
                    });
                }
                addMessage('assistant', '<div class="ai-reply ai-reply-warn">' + paramsHtml + '</div>');
            }
        } else {
            // 参数提取失败（LLM不可用或返回格式错误）
            setStep('param_extracting', 'error');
            setStep('param_checking', 'error');
            window.AI_TASK.setError('参数提取失败: ' + (extRes.error || '未知原因'));
            var tool = window.AI_TOOL_REGISTRY.get(task.tool_id);
            var requiredNames = (tool && tool.required_parameters || [])
                .map(function (p) { return p.label + '(' + p.name + ')'; }).join('、');
            addMessage('assistant',
                '<div class="ai-reply ai-reply-error">' +
                '<b>⚠ 未能从您的描述中识别出有效计算参数。</b><br><br>' +
                '请补充并明确以下参数：' + requiredNames + '<br><br>' +
                '<span style="font-size:12px;color:#94a3b8">提示：您也可以尝试更规范的描述，例如"梁宽250mm 梁高500mm C30 HRB400 受拉钢筋面积1520 保护层40mm"</span>' +
                '</div>');
            return; // 不进入 checkAndProceed，阻断计算
        }

        // 检查参数完整性，决定是追问还是直接计算
        checkAndProceed(userInput, isDebug);
    }

    function checkAndProceed(userInput, isDebug) {
        var task = window.AI_TASK.getCurrent();
        if (!task) return;

        var tool = window.AI_TOOL_REGISTRY.get(task.tool_id);

        // 【参数安全门】检查必填项是否都是用户明确提供的（不是系统默认值）
        var gateResult = window.AI_TASK.validateForBridge();
        console.log('[AI_VALIDATE] checkAndProceed 安全门: pass=' + gateResult.pass +
            ', 缺少用户提供的必填项: ' + (gateResult.missing_provided || []).join(', '));

        // chat 路径 trace：安全门结果（用来判断是否被安全门拦截）
        _chatTracePush({
            step: 'chat_gate_result',
            tool: task.tool_id,
            pass: gateResult.pass,
            missing_provided: gateResult.missing_provided || [],
            received_keys: Object.keys(gateResult.received || {})
        });

        if (!gateResult.pass) {
            // 必填参数没有全部由用户提供 → 不自动计算，转为追问
            var missingList = gateResult.missing_provided || [];
            var missingLabels = missingList.map(function (name) {
                var meta = window.AI_TASK.getParamMeta(task.tool_id, name);
                return meta ? (meta.label + '（' + name + '）') : name;
            }).join('、');

            // Debug模式：直接列出缺项，不调LLM生成追问
            if (isDebug) {
                addMessage('assistant',
                    '<div class="ai-reply ai-reply-error">' +
                    '<b>⚠ 参数不完整，禁止使用默认值计算。</b><br><br>' +
                    '已提供：' + (Object.keys(gateResult.received || {}).join('、') || '（无）') + '<br>' +
                    '缺少：<b>' + missingLabels + '</b><br><br>' +
                    '<span style="font-size:12px;color:#94a3b8">' +
                    '请在对话中补充以上参数后再计算。工程计算不允许使用推测或默认值。' +
                    '</span>' +
                    '</div>');
                return;
            }

            // Debug模式：直接列出缺项，不调LLM生成追问
            if (isDebug) {
                addMessage('assistant',
                    '<div class="ai-reply ai-reply-error">' +
                    '<b>⚠ 参数不完整，禁止使用默认值计算。</b><br><br>' +
                    '已提供：' + (Object.keys(gateResult.received || {}).join('、') || '（无）') + '<br>' +
                    '缺少：<b>' + missingLabels + '</b><br><br>' +
                    '<span style="font-size:12px;color:#94a3b8">' +
                    '请在对话中补充以上参数后再计算。工程计算不允许使用推测或默认值。' +
                    '</span>' +
                    '</div>');
                return;
            }

            // 生成追问回复
            generateReply({ userInput: userInput, missing_hint: missingLabels }, function (replyRes) {
                addMessage('assistant', replyRes.reply ||
                    '<div class="ai-reply">还缺少以下参数：' + missingLabels + '，请补充后再计算。</div>');
            });
            return;
        }

        // 全部必填参数均为用户提供 → 可以自动计算（只在工具已有adapter时）
        if (tool.bridge) {
            setStep('calculating', 'running');
            // chat 路径 trace：即将进入 bridge
            _chatTracePush({
                step: 'chat_bridge_about_to_run',
                tool: task.tool_id,
                has_bridge: !!tool.bridge,
                cur_tool: window.CUR_TOOL || null
            });
            // 先给一个"准备计算"的回复
            var prepMsg = addMessage('assistant', '<div class="ai-reply">参数已收集完整，正在调用计算程序...</div>');

            // 需要先确保工具页面已渲染
            ensureToolRendered(task.tool_id, function () {
                _chatTracePush({
                    step: 'chat_tool_rendered',
                    tool: task.tool_id,
                    cur_tool: window.CUR_TOOL || null,
                    dom_t_b: (document.getElementById && document.getElementById('t_b')) ? document.getElementById('t_b').value : 'N/A'
                });
                window.AI_TASK.runCalculation(function (calcRes) {
                    setStep('calculating', calcRes.success ? 'done' : 'error');
                    if (calcRes.success) {
                        // 生成解释
                        generateReply({ userInput: userInput }, function (replyRes) {
                            var finalHtml = replyRes.reply || '<div class="ai-reply">计算完成。</div>';
                            // 追加相关规范行（草案版）
                            if (window.KNOWLEDGE_BASE && task && task.tool_id) {
                                var toolDef = window.AI_TOOL_REGISTRY.get(task.tool_id);
                                if (toolDef && toolDef.related_standards && toolDef.related_standards.length > 0) {
                                    var stdLine = '<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--hairline);font-size:12.5px;color:#94a3b8;">';
                                    stdLine += '相关规范（' + toolDef.related_standards.map(function (s) {
                                        return s.standard + ' ' + (s.articles || []).join('/');
                                    }).join('、') + ' · <span style="color:#f59e0b;">草案待校核</span>）';
                                    stdLine += '</div>';
                                    finalHtml += stdLine;
                                }
                            }
                            updateMessage(prepMsg.id, {
                                content: finalHtml,
                                meta: { type: 'result_explanation' }
                            });
                        });
                    } else {
                        updateMessage(prepMsg.id, {
                            content: '<div class="ai-reply ai-reply-error">计算失败：' + (calcRes.error || '未知错误') + '</div>'
                        });
                    }
                });
            });
        } else {
            // 参数不全，生成追问回复
            generateReply({ userInput: userInput }, function (replyRes) {
                addMessage('assistant', replyRes.reply || '<div class="ai-reply">请补充参数。</div>');
            });
        }
    }

    /* ==========================================================
     *  确保工具页面已渲染（桥接函数需要DOM存在）
     * ========================================================== */
    function ensureToolRendered(tool_id, callback) {
        _chatTracePush({
            step: 'chat_ensure_enter',
            tool: tool_id,
            cur_tool: window.CUR_TOOL || null,
            has_render_tool: typeof window.renderTool === 'function'
        });
        // 如果当前视图就是这个工具，直接回调
        if (window.CUR_TOOL === tool_id) {
            _chatTracePush({
                step: 'chat_ensure_already_there',
                tool: tool_id,
                delay_ms: 50
            });
            setTimeout(function () {
                _chatTracePush({ step: 'chat_ensure_cb_fired', tool: tool_id, path: 'already_there' });
                callback();
            }, 50);
            return;
        }
        // 否则通过 renderTool 渲染（已暴露到 window）
        if (typeof window.renderTool === 'function') {
            try {
                window.renderTool(tool_id);
                _chatTracePush({
                    step: 'chat_ensure_rendered_ok',
                    tool: tool_id,
                    cur_tool_after: window.CUR_TOOL || null,
                    delay_ms: 150
                });
                // 等待DOM就绪 + 事件绑定
                setTimeout(function () {
                    _chatTracePush({ step: 'chat_ensure_cb_fired', tool: tool_id, path: 'after_render' });
                    callback();
                }, 150);
            } catch (e) {
                _chatTracePush({
                    step: 'chat_ensure_render_error',
                    tool: tool_id,
                    error: String(e && e.message ? e.message : e)
                });
                callback();
            }
        } else {
            _chatTracePush({ step: 'chat_ensure_no_render_fn', tool: tool_id });
            callback();
        }
    }

    /* ==========================================================
     *  用户确认工具（低置信度候选列表点击）
     * ========================================================== */
    function confirmTool(tool_id) {
        var tool = window.AI_TOOL_REGISTRY.get(tool_id);
        if (!tool) return;
        addMessage('user', '我要算：' + tool.tool_name, { type: 'tool_confirmed' });
        resetSteps();
        setStep('understanding', 'done');
        setStep('tool_matching', 'done');
        window.AI_TASK.newTask(tool_id);
        generateReply({ userInput: '我要算' + tool.tool_name }, function (replyRes) {
            addMessage('assistant', replyRes.reply);
        });
    }

    /* ==========================================================
     *  设计意图提示的确认/取消回调
     * ========================================================== */
    var pendingToolMatch = null;

    function confirmContinueWithTool(tool_id) {
        // 用户确认继续，就按复核模式建任务
        var tool = window.AI_TOOL_REGISTRY.get(tool_id);
        if (!tool) return;
        addMessage('user', '我要做：' + tool.tool_name + '（复核模式）', { type: 'tool_confirmed' });
        resetSteps();
        setStep('understanding', 'done');
        setStep('tool_matching', 'done');
        window.AI_TASK.newTask(tool_id);
        generateReply({ userInput: '做' + tool.tool_name }, function (replyRes) {
            addMessage('assistant', replyRes.reply);
        });
    }

    function dismissIntentHint() {
        addMessage('assistant', '<div class="ai-reply">好的，如果你需要做承载力复核，随时告诉我截面尺寸、材料和配筋面积就行。</div>');
    }

    /* ==========================================================
     *  用户解决参数冲突（点击冲突选项中的某一项）
     * ========================================================== */
    function resolveConflict(rawKey, canonicalName) {
        var task = window.AI_TASK.getCurrent();
        if (!task) return;
        var conflicts = task.pending_conflicts || {};
        if (!conflicts[rawKey]) {
            console.warn('[AI_CHAT] resolveConflict: 没有找到冲突项', rawKey);
            return;
        }
        // 取出原冲突值，按用户选择的规范名写入
        var conflictValue = null;
        // 从原始输入文本中找回该key对应的值 —— 存放在 conflict_values 里
        if (task.conflict_values && task.conflict_values[rawKey] !== undefined) {
            conflictValue = task.conflict_values[rawKey];
        }
        if (conflictValue === null || conflictValue === undefined) {
            console.warn('[AI_CHAT] resolveConflict: 找不到冲突值', rawKey);
            return;
        }

        var meta = window.AI_TASK.getParamMeta(task.tool_id, canonicalName);
        var label = meta ? meta.label : canonicalName;

        // 写入参数（单个key-value的merge）
        var patch = {};
        patch[canonicalName] = conflictValue;
        window.AI_TASK.mergeParameters(patch);

        // 从 pending_conflicts 中移除已解决的项
        delete task.pending_conflicts[rawKey];
        if (task.conflict_values) delete task.conflict_values[rawKey];
        var remainingKeys = Object.keys(task.pending_conflicts);
        if (remainingKeys.length === 0) {
            task.pending_conflicts = null;
        }

        // UI 通知
        addMessage('user',
            '<div class="ai-reply ai-reply-conflict-resolve">' +
            '✅ 已确认 <code>' + rawKey + '</code> → <b>' + label + '</b> = ' + conflictValue +
            (meta && meta.unit ? ' ' + meta.unit : '') +
            '</div>');

        console.log('[AI_PARAM] 冲突已解决: ' + rawKey + ' → ' + canonicalName + ' = ' + conflictValue);

        // 所有冲突都解决了 → 尝试继续计算
        if (!task.pending_conflicts) {
            var gate = window.AI_TASK.validateForBridge();
            if (gate.pass) {
                task.status = 'ready_to_calculate';
                window.AI_TASK.setStatus('ready_to_calculate');
                checkAndProceed();
            } else {
                // 还有缺失的，让用户继续补
                addMessage('assistant',
                    '<div class="ai-reply">冲突已解决。还需要补充以下参数才能计算：<br>' +
                    gate.missing_provided.map(function(n){
                        var m = window.AI_TASK.getParamMeta(task.tool_id, n);
                        return '• ' + (m ? m.label : n);
                    }).join('<br>') +
                    '</div>');
            }
        }
        if (window.AI_TASK.notify) window.AI_TASK.notify();
    }

    /* ==========================================================
     *  手动触发计算（用户点击"立即计算"按钮）
     * ========================================================== */
    function manualCalculate() {
        var task = window.AI_TASK.getCurrent();
        if (!task) return;
        var tool = window.AI_TOOL_REGISTRY.get(task.tool_id);
        if (!tool || !tool.bridge) {
            addMessage('assistant', '<div class="ai-reply">该工具暂未接入AI计算，你可以在左侧导航手动打开计算。</div>');
            return;
        }
        // 【参数安全门】手动点击计算也必须过安全门
        var gateResult = window.AI_TASK.validateForBridge();
        if (!gateResult.pass) {
            var missingList = gateResult.missing_provided || [];
            var missingLabels = missingList.map(function (name) {
                var meta = window.AI_TASK.getParamMeta(task.tool_id, name);
                return meta ? (meta.label + '（' + name + '）') : name;
            }).join('、');
            addMessage('assistant',
                '<div class="ai-reply ai-reply-error">' +
                '<b>⚠ 无法计算：以下必填参数尚未明确提供（不能使用默认值）</b><br><br>' +
                '缺少：' + missingLabels + '<br><br>' +
                '<span style="font-size:12px;color:#94a3b8">请在对话中补充这些参数后再计算。工程计算不允许使用推测或默认值。</span>' +
                '</div>');
            return;
        }
        setStep('calculating', 'running');
        var prepMsg = addMessage('assistant', '<div class="ai-reply">正在计算...</div>');
        console.log('[AI_BRIDGE] 手动触发计算, tool=' + task.tool_id +
            ', params=' + JSON.stringify(task.provided_parameters));
        ensureToolRendered(task.tool_id, function () {
            window.AI_TASK.runCalculation(function (calcRes) {
                setStep('calculating', calcRes.success ? 'done' : 'error');
                console.log('[AI_RESULT] 计算完成, success=' + calcRes.success +
                    ', error=' + (calcRes.error || 'none'));
                if (calcRes.success) {
                    generateReply({ userInput: '计算结果是什么' }, function (replyRes) {
                        updateMessage(prepMsg.id, {
                            content: replyRes.reply,
                            meta: { type: 'result_explanation' }
                        });
                    });
                } else {
                    updateMessage(prepMsg.id, {
                        content: '<div class="ai-reply ai-reply-error">计算失败：' + (calcRes.error || '未知错误') + '</div>'
                    });
                }
            });
        });
    }

    /* ==========================================================
     *  内部辅助：调用AI（复用页面已有 callAI 函数）
     * ========================================================== */
    function callAI_Internal(prompt, userInput, callback) {
        // 调用 index.html 中已有的 callAI 函数
        // 优先用暴露在 window 上的 _aiCallAI（calc-assistant bind 内部的）
        var fn = window._aiCallAI || window.callAI;
        if (typeof fn === 'function') {
            fn(prompt, userInput,
                function (resp) { callback(resp); },
                function (err) { callback(null, err); }
            );
        } else {
            // 降级：模拟响应（用于无API配置时的演示）
            setTimeout(function () {
                callback('{"error": "AI 接口未配置，请先在「AI API 配置」中设置"}');
            }, 300);
        }
    }

    function parseJSON(text) {
        if (!text) return null;
        try { return JSON.parse(text); } catch (e) {
            // 尝试提取第一个JSON对象
            var m = text.match(/\{[\s\S]*\}/);
            if (m) {
                try { return JSON.parse(m[0]); } catch (e2) { return null; }
            }
            return null;
        }
    }

    /* ==========================================================
     *  规范查询辅助函数
     * ========================================================== */
    // 判断是否为规范查询意图（关键词 + 句式 + 是否含可计算参数 综合判定）
    // 命中规范意图 → 走 RAG（searchStandard），不创建 calculation task、不进参数收集。
    function _isStandardQuery(text) {
        if (!text || !text.trim()) return false;
        var t = text.trim();

        // 排除 debug 模式
        if (t.indexOf('#debug') === 0) return false;

        // —— 第一类：强规范意图触发词（出现任一即视为有规范意图倾向）——
        // 1) 名词类：规范/条文/条款/规定/要求/构造
        // 2) 问答句式：…是多少？/…有什么要求？/…怎么规定？/…的限值/…的最小值/…的最大值
        // 3) 构造/构造措施/抗震要求/承载力要求/验算要求/设计要求
        var strongTerms = [
            '规范', '条文', '条款', '规定', '条例', '构造要求', '构造措施',
            '抗震要求', '抗震构造', '抗震等级', '承载力要求', '验算要求', '计算规定', '设计要求',
            '最小配筋率', '最大配筋率', '配筋率是多少',
            '搭接长度', '锚固长度', '保护层厚度',
            '支座长度', '支承长度', '搁置长度',
            '允许值', '限值', '最小值', '最大值',
            '间距要求', '钢筋间距', '箍筋间距',
            '地基承载力', '冲切', '底板配筋'
        ];
        var hasStrongTerm = false;
        for (var i = 0; i < strongTerms.length; i++) {
            if (t.indexOf(strongTerms[i]) >= 0) { hasStrongTerm = true; break; }
        }

        // 弱触发词：只含"要求/规定/依据"但没有上下文时，容易误判，需要结合其他信号
        var weakTerms = ['要求', '规定', '依据'];
        var hasWeakOnly = !hasStrongTerm && (function() {
            for (var w = 0; w < weakTerms.length; w++) {
                if (t.indexOf(weakTerms[w]) >= 0) return true;
            }
            return false;
        })();

        if (!hasStrongTerm && !hasWeakOnly) return false;

        // —— 反例排除：含明确计算意图且带具体可计算参数 → 仍是 calculation ——
        // 1) 动作词：算/验算/复核/帮我算/算一下/算一算/帮算/求…承载力/求…面积/设计
        var calcActions = ['验算', '帮我算', '算一下', '算一算', '帮算', '计算一下'];
        var hasCalcAction = false;
        for (var a = 0; a < calcActions.length; a++) {
            if (t.indexOf(calcActions[a]) >= 0) { hasCalcAction = true; break; }
        }
        // "计算"单独比较模糊（"怎么计算的"也可能问规范），只有配合具体参数才算计算意图

        // 2) 带具体参数特征：如"250×500"/"C30"/"HRB400"/"N=2000"/"M=100"/"As=1520"/"b=250"/"h=500"等
        var hasNumericParams = _hasCalculationParams(t);

        // 有计算动作 + 有具体参数 → 明确是计算请求，不走规范 RAG
        if (hasCalcAction && hasNumericParams) return false;
        // "计算" + 具体参数 也判为计算
        if (t.indexOf('计算') >= 0 && hasNumericParams && t.indexOf('计算规定') < 0 && t.indexOf('计算要求') < 0) return false;

        // 3) 典型计算开头句式
        var calcPatterns = [
            /^算(一个|一下|一算)?[^，。？]{0,10}[\d×x*]/i,
            /^柱[\d×x*]/,
            /^梁[\d×x*]/,
            /^基础[^的]{0,5}[\d.]/, /^独立基础[^的]{0,5}[\d.]/
        ];
        for (var p = 0; p < calcPatterns.length; p++) {
            if (calcPatterns[p].test(t)) return false;
        }

        // 有强规范意图词 → 判为 standard query
        if (hasStrongTerm) return true;
        // 只有弱触发词（要求/规定/依据）且没有计算参数 → 偏规范查询
        if (hasWeakOnly && !hasNumericParams) return true;

        return false;
    }

    // 检测文本是否含可计算参数特征（尺寸/材料/荷载/面积等具体数值）
    function _hasCalculationParams(text) {
        var patterns = [
            /[\d.]+\s*[×x*X]\s*[\d.]+/,  // 250×500 / 2.5x2.5 等截面尺寸
            /[Ccb][二三]?\d{2,3}/i,         // C30 / C25 / HRB400 等材料牌号
            /HRB\s*\d{3,4}/i,
            /[Hh][Pp]\s*\d{3,4}/,
            /[NnMmVvFfAsas]\s*[=＝]\s*[\d.]+/,  // N=2000 / M=100 / As=1520
            /[\d.]+\s*(kN|KN|kN·m|kN\.m|kpa|KPa|MPa|mpa|mm|cm|m\b)/,
            /配(筋)?[\d.]+\s*(mm²|mm2|根|φ|直径)?/,
            /层[高厚]?[\d.]+\s*m/,
            /[\d.]+\s*级(抗震|设防)?/,
            /抗震等级[一二三四]级/
        ];
        for (var i = 0; i < patterns.length; i++) {
            if (patterns[i].test(text)) return true;
        }
        return false;
    }

    // 渲染规范条文卡片列表
    function _renderStandardCards(results, query) {
        if (!results || results.length === 0) return '';
        var html = '<div class="ai-reply">';

        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
        html += '<span style="display:inline-block;padding:2px 10px;border-radius:6px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;">规范依据</span>';
        html += '<span style="font-weight:600;">检索到 ' + results.length + ' 条相关条文</span>';
        html += '</div>';

        // 全局 draft 提示（只要有任一条是 draft 就显示）
        var hasDraft = results.some(function (r) {
            return r.status && r.status.indexOf('draft') >= 0;
        });
        if (hasDraft) {
            html += '<div style="margin:8px 0 12px;padding:8px 12px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:12.5px;color:#92400e;">';
            html += '<b>来源状态：待校核</b> —— 当前知识库条文正在校核，所有内容仅供初步参考，请以正式规范原文为准。';
            html += '</div>';
        }

        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            var isDraft = r.status && r.status.indexOf('draft') >= 0;

            html += '<div style="margin-bottom:12px;padding:12px 14px;border:1px solid var(--hairline);border-radius:10px;background:var(--canvas-soft);">';

            // 头部：规范名 + 章节 + 条文号
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">';
            html += '<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#e0e7ff;color:#4338ca;font-size:12px;font-weight:600;">' + (r.standard || '') + '</span>';
            html += '<span style="font-size:12.5px;color:#64748b;">' + (r.chapter || '') + (r.article ? ' · ' + r.article : '') + '</span>';
            if (isDraft) {
                html += '<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:500;">待校核</span>';
            }
            html += '</div>';

            // 标题
            html += '<div style="font-weight:600;margin-bottom:8px;">' + (r.title || '') + '</div>';

            // 条文内容
            if (r.content) {
                html += '<div style="font-size:13.5px;line-height:1.6;color:#334155;margin-bottom:6px;">';
                html += '<b>条文内容：</b>' + r.content;
                html += '</div>';
            }

            // 解释
            if (r.explanation) {
                html += '<div style="font-size:13px;line-height:1.6;color:#475569;">';
                html += '<b>工程解释：</b>' + r.explanation;
                html += '</div>';
            }

            // 关联工具（tool_link，可点击跳转）
            if (r.related_tools && r.related_tools.length > 0) {
                html += '<div style="margin-top:8px;font-size:12px;color:#64748b;">';
                html += '<b>关联工具：</b>';
                var toolLinks = r.related_tools.map(function (tid) {
                    var toolName = tid;
                    var toolDef = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get && window.AI_TOOL_REGISTRY.get(tid);
                    if (toolDef && toolDef.tool_name) toolName = toolDef.tool_name;
                    return '<span class="tool-link" data-tool="' + tid + '" ' +
                        'onclick="window.AI_CHAT.jumpToTool(\'' + tid + '\')" ' +
                        'style="display:inline-block;padding:2px 8px;margin-right:6px;margin-bottom:4px;border-radius:6px;background:#f1f5f9;color:#2563eb;font-size:12px;cursor:pointer;text-decoration:underline;">' +
                        toolName + '</span>';
                });
                html += toolLinks.join('');
                html += '</div>';
            }

            html += '</div>';
        }

        html += '<div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">';
        html += '本规范库为种子草案版，仅收录核心原则方向。涉及精确数值、表格、构造细节请查阅正式规范出版物。';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // 从对话跳转到指定计算工具页面（tool_link 点击回调）
    function jumpToTool(tool_id) {
        if (!tool_id) return;
        // 通过 hash 路由跳转
        if (typeof window.location !== 'undefined') {
            window.location.hash = '#/' + tool_id;
        }
    }

    // 导出到全局
    window.AI_CHAT = {
        subscribe: subscribe,
        getMessages: getMessages,
        addMessage: addMessage,
        updateMessage: updateMessage,
        clearMessages: clearMessages,
        handleUserMessage: handleUserMessage,
        confirmTool: confirmTool,
        confirmContinueWithTool: confirmContinueWithTool,
        dismissIntentHint: dismissIntentHint,
        manualCalculate: manualCalculate,
        resolveConflict: resolveConflict,
        subscribeSteps: subscribeSteps,
        stepStatus: stepStatus,
        buildToolListForPrompt: buildToolListForPrompt,
        jumpToTool: jumpToTool,
        _isStandardQuery: _isStandardQuery
    };

    console.log('[AI Chat] 模块已加载');
})();
