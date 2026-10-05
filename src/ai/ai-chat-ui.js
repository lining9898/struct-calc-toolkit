/* ==========================================================
 *  AI 助手界面 —— AI_CHAT_UI
 *  渲染多轮对话界面 + 右侧参数面板 + 工作状态指示
 *  挂在 window.AI_CHAT_UI 上，供 TOOLS['calc-assistant'] 调用
 * ========================================================== */
(function () {
    'use strict';

    // 示例问题
    var EXAMPLE_QUESTIONS = [
        '帮我验算一块叠合板',
        '300×600 C30梁正截面',
        '柱下独立基础',
        'AAC外墙板'
    ];

    // 步骤定义
    var STEP_DEFS = [
        { key: 'understanding', label: '理解需求' },
        { key: 'tool_matching', label: '匹配工具' },
        { key: 'param_extracting', label: '提取参数' },
        { key: 'param_checking', label: '检查完整性' },
        { key: 'calculating', label: '调用计算' },
        { key: 'explaining', label: '生成结论' }
    ];

    /**
     * 生成主界面HTML（替换原来的单轮AI界面）
     */
    function renderAssistant() {
        return '<div class="ai-assistant-container">' +
            // 左侧对话区
            '<div class="ai-chat-panel">' +
                '<div class="ai-chat-header">' +
                    '<div class="ai-chat-title">🧠 智能计算助手</div>' +
                    '<div class="ai-chat-subtitle">自然语言描述你的计算需求，AI自动匹配工具并完成计算</div>' +
                    '<div style="display:flex;gap:6px;align-items:center">' +
                    '<button class="ai-chat-selftest" onclick="window.AI_CHAT_UI.runSelftest()" title="运行桥接层A/B自检" style="font-size:11px;padding:2px 8px;background:transparent;border:1px solid var(--hairline);border-radius:6px;color:var(--text-muted);cursor:pointer;">自检</button>' +
                    '<button class="ai-chat-clear" onclick="window.AI_CHAT_UI.clearChat()" title="清空对话">清空</button>' +
                    '</div>' +
                '</div>' +
                // 工作状态条
                '<div class="ai-steps-bar" id="ai_steps_bar">' +
                    STEP_DEFS.map(function (s, i) {
                        return '<div class="ai-step" data-step="' + s.key + '">' +
                            '<span class="ai-step-dot"></span>' +
                            '<span class="ai-step-label">' + s.label + '</span>' +
                            (i < STEP_DEFS.length - 1 ? '<span class="ai-step-line"></span>' : '') +
                        '</div>';
                    }).join('') +
                '</div>' +
                // 消息区
                '<div class="ai-messages" id="ai_messages">' +
                    '<div class="ai-msg ai-msg-assistant">' +
                        '<div class="ai-msg-avatar">AI</div>' +
                        '<div class="ai-msg-bubble">' +
                            '你好！我是结构工程计算助手。<br>' +
                            '请用自然语言描述你要计算的内容，我会自动匹配合适的计算工具并完成验算。<br><br>' +
                            '你可以试试下面的示例：' +
                        '</div>' +
                    '</div>' +
                    '<div class="ai-example-chips">' +
                        EXAMPLE_QUESTIONS.map(function (q) {
                            return '<button class="ai-chip" onclick="window.AI_CHAT_UI.sendExample(\'' + q.replace(/'/g, "\\'") + '\')">' + q + '</button>';
                        }).join('') +
                    '</div>' +
                '</div>' +
                // 输入区
                '<div class="ai-input-area">' +
                    '<textarea id="ai_chat_input" placeholder="描述你要计算的内容，例如：叠合板 60厚预制+70厚叠合层 C30 跨度3.6m" ' +
                        'onkeydown="window.AI_CHAT_UI.onKeyDown(event)"></textarea>' +
                    '<button class="ai-send-btn" onclick="window.AI_CHAT_UI.send()">发送</button>' +
                '</div>' +
            '</div>' +
            // 右侧参数面板
            '<div class="ai-param-panel" id="ai_param_panel">' +
                '<div class="ai-param-header">' +
                    '<div class="ai-param-title">当前计算任务</div>' +
                    '<div class="ai-param-status" id="ai_task_status">暂无任务</div>' +
                '</div>' +
                '<div class="ai-param-body" id="ai_param_body">' +
                    '<div class="ai-param-empty">' +
                        '在左侧描述你的计算需求，<br>AI会自动建立计算任务。' +
                    '</div>' +
                '</div>' +
                '<div class="ai-param-footer" id="ai_param_footer" style="display:none">' +
                    '<button class="ai-calc-btn" onclick="window.AI_CHAT_UI.calculateNow()" id="ai_calc_now_btn">' +
                        '立即计算' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    /**
     * 绑定事件 + 订阅状态变化
     */
    function bindAssistant() {
        // 订阅消息变化
        if (window.AI_CHAT) {
            window.AI_CHAT.subscribe(function (msgs) {
                renderMessages(msgs);
            });
            // 订阅步骤变化
            window.AI_CHAT.subscribeSteps(function (steps) {
                renderSteps(steps);
            });
        }
        // 订阅任务变化
        if (window.AI_TASK) {
            window.AI_TASK.subscribe(function (task) {
                renderParamPanel(task);
            });
        }
    }

    /* ==========================================================
     *  消息渲染
     * ========================================================== */
    function renderMessages(msgs) {
        var container = document.getElementById('ai_messages');
        if (!container) return;

        // 保留初始欢迎消息（如果还没有用户消息）
        var html = '';
        if (msgs.length === 0) {
            // 初始状态已由renderAssistant渲染
            return;
        }

        // 重建消息列表
        msgs.forEach(function (msg) {
            if (msg.role === 'user') {
                html += '<div class="ai-msg ai-msg-user">' +
                    '<div class="ai-msg-bubble">' + escapeHtml(msg.content) + '</div>' +
                    '<div class="ai-msg-avatar" style="background:#475569;">我</div>' +
                '</div>';
            } else if (msg.role === 'assistant') {
                html += '<div class="ai-msg ai-msg-assistant">' +
                    '<div class="ai-msg-avatar">AI</div>' +
                    '<div class="ai-msg-bubble">' + msg.content + '</div>' +
                '</div>';
            }
        });

        // 如果是最后一条消息是assistant的且有loading状态
        var lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.meta && lastMsg.meta.loading) {
            html += '<div class="ai-msg ai-msg-assistant">' +
                '<div class="ai-msg-avatar">AI</div>' +
                '<div class="ai-msg-bubble ai-msg-loading"><span class="ai-typing"></span></div>' +
            '</div>';
        }

        container.innerHTML = html;
        // 滚动到底部
        container.scrollTop = container.scrollHeight;
    }

    /* ==========================================================
     *  步骤状态条渲染
     * ========================================================== */
    function renderSteps(steps) {
        var bar = document.getElementById('ai_steps_bar');
        if (!bar) return;
        var dots = bar.querySelectorAll('.ai-step');
        dots.forEach(function (dot) {
            var key = dot.getAttribute('data-step');
            var status = steps[key] || 'pending';
            dot.classList.remove('pending', 'running', 'done', 'error');
            dot.classList.add(status);
        });
    }

    /* ==========================================================
     *  参数面板渲染
     * ========================================================== */
    function renderParamPanel(task) {
        var body = document.getElementById('ai_param_body');
        var statusEl = document.getElementById('ai_task_status');
        var footer = document.getElementById('ai_param_footer');
        var calcBtn = document.getElementById('ai_calc_now_btn');

        if (!body || !statusEl) return;

        if (!task) {
            statusEl.textContent = '暂无任务';
            statusEl.className = 'ai-param-status status-idle';
            body.innerHTML = '<div class="ai-param-empty">在左侧描述你的计算需求，<br>AI会自动建立计算任务。</div>';
            if (footer) footer.style.display = 'none';
            return;
        }

        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(task.tool_id);
        if (!tool) {
            statusEl.textContent = '工具信息缺失';
            body.innerHTML = '<div class="ai-param-empty">工具信息缺失</div>';
            return;
        }

        // 状态标签
        var statusMap = {
            'idle': { text: '空闲', cls: 'status-idle' },
            'understanding': { text: '正在理解...', cls: 'status-running' },
            'tool_selected': { text: '已匹配工具', cls: 'status-info' },
            'collecting_parameters': { text: '正在收集参数', cls: 'status-running' },
            'ready_to_calculate': { text: '✓ 参数完整', cls: 'status-ok' },
            'calculating': { text: '正在计算...', cls: 'status-running' },
            'completed': { text: '✓ 计算完成', cls: 'status-ok' },
            'error': { text: '计算出错', cls: 'status-error' }
        };
        var s = statusMap[task.status] || { text: task.status, cls: 'status-info' };
        statusEl.textContent = s.text;
        statusEl.className = 'ai-param-status ' + s.cls;

        // 参数列表
        var allParams = (tool.required_parameters || []).concat(tool.optional_parameters || []);
        var html = '<div class="ai-param-tool-name">' + tool.tool_name + '</div>';
        html += '<div class="ai-param-tool-desc">' + tool.description + '</div>';

        if (tool.adapter_ready === false && !tool.bridge) {
            html += '<div class="ai-param-warn">⚠ 该工具正在接入AI中，暂不支持自动计算。你可以在左侧导航手动打开该工具进行计算。</div>';
        }

        html += '<div class="ai-param-section-title">输入参数</div>';

        // 【参数冲突警告】有冲突时在参数列表上方展示
        var conflicts = task.pending_conflicts;
        if (conflicts && typeof conflicts === 'object' && Object.keys(conflicts).length > 0) {
            html += '<div class="ai-param-conflict-block">';
            html += '<div class="ai-conflict-title"><span class="ai-conflict-icon">⚠</span> 参数歧义，需要你确认</div>';
            html += '<div class="ai-conflict-desc">AI 识别到以下参数可能对应多个含义，请点击选择正确项：</div>';
            var conflictKeys = Object.keys(conflicts);
            for (var ci = 0; ci < conflictKeys.length; ci++) {
                var rawKey = conflictKeys[ci];
                var candidates = conflicts[rawKey];
                html += '<div class="ai-conflict-row">';
                html += '<div class="ai-conflict-row-key">输入：<code>' + escapeHtml(rawKey) + '</code></div>';
                html += '<div class="ai-conflict-row-options">';
                for (var cj = 0; cj < candidates.length; cj++) {
                    var candName = candidates[cj];
                    // 找参数元信息显示label
                    var candMeta = null;
                    for (var ck = 0; ck < allParams.length; ck++) {
                        if (allParams[ck].name === candName) { candMeta = allParams[ck]; break; }
                    }
                    var candLabel = candMeta ? candMeta.label : candName;
                    var candUnit = candMeta && candMeta.unit ? ' (' + candMeta.unit + ')' : '';
                    html += '<button class=\"ai-conflict-option-btn\" onclick=\"window.AI_CHAT_UI.resolveConflict(\'' + escapeHtml(rawKey).replace(/'/g, "\\'") + '\', \'' + escapeHtml(candName).replace(/'/g, "\\'") + '\')\" data-conflict-key=\"' + escapeHtml(rawKey) + '\" data-param-name=\"' + escapeHtml(candName) + '\">';
                    html += '<span class="ai-conflict-option-title">' + escapeHtml(candLabel) + candUnit + '</span>';
                    html += '<span class="ai-conflict-option-sub">参数名: ' + escapeHtml(candName) + '</span>';
                    html += '</button>';
                }
                html += '</div></div>';
            }
            html += '</div>';
        }

        html += '<div class="ai-param-list">';

        allParams.forEach(function (p) {
            var val = task.parameters[p.name];
            var filled = val !== undefined && val !== null && val !== '';
            var provided = task.provided_parameters && task.provided_parameters[p.name] !== undefined
                && task.provided_parameters[p.name] !== null && task.provided_parameters[p.name] !== '';
            var isMissing = p.required && !provided; // 必填但用户未提供才算缺失

            var rowClass = 'ai-param-row';
            var icon = '';
            var iconClass = '';
            var statusTag = '';

            if (isMissing) {
                rowClass += ' missing';
                icon = '⚠';
                iconClass = 'icon-warn';
                statusTag = '<span class="ai-param-tag tag-missing">未提供</span>';
            } else if (provided) {
                rowClass += ' filled';
                icon = '✓';
                iconClass = 'icon-ok';
                statusTag = '<span class="ai-param-tag tag-provided">已确认</span>';
            } else if (filled) {
                // 有值但是默认值，不是用户提供的
                rowClass += ' default';
                icon = '◐';
                iconClass = 'icon-default';
                statusTag = '<span class="ai-param-tag tag-default">默认值</span>';
            } else {
                rowClass += ' optional';
                icon = '○';
                iconClass = 'icon-opt';
            }

            // 值展示
            var valStr = '';
            if (filled) {
                if (p.type === 'enum' && p.option_labels && p.options) {
                    var idx = p.options.indexOf(val);
                    valStr = (idx >= 0 ? p.option_labels[idx] : val) + (p.unit ? ' ' + p.unit : '');
                } else if (p.type === 'array' && Array.isArray(val)) {
                    valStr = '[' + val.join(', ') + ']' + (p.unit ? ' ' + p.unit : '');
                } else {
                    valStr = val + (p.unit ? ' ' + p.unit : '');
                }
            } else {
                valStr = p.required ? '（未填）' : '（可选，默认: ' + (p.default !== undefined ? p.default : '无') + '）';
            }

            html += '<div class="' + rowClass + '">' +
                '<span class="ai-param-icon ' + iconClass + '">' + icon + '</span>' +
                '<span class="ai-param-label">' + p.label + '</span>' +
                '<span class="ai-param-value">' + valStr + statusTag + '</span>' +
            '</div>';
        });

        html += '</div>';

        // 计算完成后显示结果摘要
        if (task.status === 'completed' && task.result) {
            html += '<div class="ai-param-section-title">计算结果摘要</div>';
            html += '<div class="ai-param-result">';
            var r = task.result;
            html += '<div class="ai-result-overall ' + (r.overall_ok ? 'ok' : 'err') + '">' +
                (r.overall_ok ? '✓ 验算满足' : '✗ 存在不满足项') +
            '</div>';
            if (r.items && r.items.length > 0) {
                html += '<div class="ai-result-items">';
                r.items.forEach(function (item) {
                    html += '<div class="ai-result-item ' + (item.ok ? 'ok' : 'err') + '">' +
                        '<span class="ai-result-item-name">' + item.name + '</span>' +
                        '<span class="ai-result-item-val">' +
                            fmtVal(item.value) + (item.unit ? ' ' + item.unit : '') +
                            (item.capacity !== undefined ? ' / ' + fmtVal(item.capacity) : '') +
                            (item.limit !== undefined ? ' ≤ ' + fmtVal(item.limit) : '') +
                        '</span>' +
                        '<span class="ai-result-item-badge">' + (item.ok ? '满足' : '超限') + '</span>' +
                    '</div>';
                });
                html += '</div>';
            }
            html += '</div>';
        }

        body.innerHTML = html;

        // 底部按钮：只有当所有必填参数都是用户明确提供的，才显示计算按钮
        if (footer) {
            var allRequiredProvided = true;
            var required = tool.required_parameters || [];
            var provided = task.provided_parameters || {};
            for (var i = 0; i < required.length; i++) {
                var pv = provided[required[i].name];
                if (pv === undefined || pv === null || pv === '') {
                    allRequiredProvided = false;
                    break;
                }
            }
            if (tool.bridge && allRequiredProvided && task.status !== 'completed' && task.status !== 'calculating') {
                footer.style.display = 'block';
                if (calcBtn) calcBtn.disabled = false;
            } else if (task.status === 'completed') {
                footer.style.display = 'block';
                if (calcBtn) {
                    calcBtn.textContent = '重新计算';
                    calcBtn.disabled = false;
                }
            } else {
                footer.style.display = 'none';
            }
        }
    }

    function fmtVal(v) {
        if (v === undefined || v === null) return '-';
        if (typeof v === 'number') {
            if (Math.abs(v) >= 1000) return v.toFixed(0);
            if (Math.abs(v) >= 10) return v.toFixed(2);
            return v.toFixed(3);
        }
        return String(v);
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    /* ==========================================================
     *  用户交互方法
     * ========================================================== */
    function send() {
        var input = document.getElementById('ai_chat_input');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        if (window.AI_CHAT) {
            window.AI_CHAT.handleUserMessage(text);
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    function sendExample(text) {
        if (window.AI_CHAT) {
            window.AI_CHAT.handleUserMessage(text);
        }
    }

    function clearChat() {
        if (window.AI_CHAT) {
            window.AI_CHAT.clearMessages();
        }
        // 重置欢迎界面
        var container = document.getElementById('ai_messages');
        if (container) {
            container.innerHTML =
                '<div class="ai-msg ai-msg-assistant">' +
                    '<div class="ai-msg-avatar">AI</div>' +
                    '<div class="ai-msg-bubble">' +
                        '你好！我是结构工程计算助手。<br>' +
                        '请用自然语言描述你要计算的内容，我会自动匹配合适的计算工具并完成验算。<br><br>' +
                        '你可以试试下面的示例：' +
                    '</div>' +
                '</div>' +
                '<div class="ai-example-chips">' +
                    EXAMPLE_QUESTIONS.map(function (q) {
                        return '<button class="ai-chip" onclick="window.AI_CHAT_UI.sendExample(\'' + q.replace(/'/g, "\\'") + '\')">' + q + '</button>';
                    }).join('') +
                '</div>';
        }
    }

    function calculateNow() {
        if (window.AI_CHAT) {
            window.AI_CHAT.manualCalculate();
        }
    }

    /**
     * 用户点击冲突选项：确认某个输入key对应的规范参数名
     * @param {string} rawKey 原始输入key（冲突的key）
     * @param {string} canonicalName 用户选择的规范参数名
     */
    function resolveConflict(rawKey, canonicalName) {
        if (!window.AI_CHAT) {
            console.warn('[AI_UI] resolveConflict: AI_CHAT 不存在');
            return;
        }
        var task = window.AI_TASK && window.AI_TASK.getCurrent();
        if (!task || !task.pending_conflicts || !task.pending_conflicts[rawKey]) {
            console.warn('[AI_UI] resolveConflict: 没有找到冲突项', rawKey);
            return;
        }
        // 用对话方式记录用户选择，让AI_CHAT统一处理
        window.AI_CHAT.resolveConflict(rawKey, canonicalName);
    }

    /* ==========================================================
     *  注入CSS样式
     * ========================================================== */
    function injectStyles() {
        if (document.getElementById('ai-assistant-styles')) return;
        var style = document.createElement('style');
        style.id = 'ai-assistant-styles';
        style.textContent = `
            .ai-assistant-container {
                display: grid;
                grid-template-columns: 1fr 360px;
                gap: 16px;
                height: calc(100vh - 140px);
                min-height: 600px;
            }
            @media (max-width: 900px) {
                .ai-assistant-container {
                    grid-template-columns: 1fr;
                    height: auto;
                }
            }
            /* 对话面板 */
            .ai-chat-panel {
                display: flex;
                flex-direction: column;
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 14px;
                overflow: hidden;
            }
            .ai-chat-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e2e8f0;
                background: linear-gradient(135deg, #f0f9ff 0%, #eff6ff 100%);
                position: relative;
            }
            .ai-chat-title {
                font-size: 17px;
                font-weight: 700;
                color: #0f172a;
            }
            .ai-chat-subtitle {
                font-size: 12.5px;
                color: #64748b;
                margin-top: 3px;
            }
            .ai-chat-clear {
                position: absolute;
                right: 16px;
                top: 50%;
                transform: translateY(-50%);
                background: transparent;
                border: 1px solid #cbd5e1;
                color: #64748b;
                padding: 5px 12px;
                border-radius: 8px;
                font-size: 12px;
                cursor: pointer;
            }
            .ai-chat-clear:hover { background: #f1f5f9; }

            /* 步骤状态条 */
            .ai-steps-bar {
                display: flex;
                align-items: center;
                padding: 10px 20px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                overflow-x: auto;
                gap: 4px;
            }
            .ai-step {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            .ai-step-dot {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #cbd5e1;
                flex-shrink: 0;
                transition: all 0.2s;
                position: relative;
            }
            .ai-step-label {
                font-size: 11.5px;
                color: #94a3b8;
                white-space: nowrap;
                transition: color 0.2s;
            }
            .ai-step-line {
                width: 24px;
                height: 2px;
                background: #e2e8f0;
                margin: 0 2px;
            }
            .ai-step.running .ai-step-dot {
                background: #3b82f6;
                box-shadow: 0 0 0 4px rgba(59,130,246,0.2);
                animation: stepPulse 1.2s infinite;
            }
            .ai-step.running .ai-step-label { color: #2563eb; font-weight: 600; }
            .ai-step.done .ai-step-dot { background: #10b981; }
            .ai-step.done .ai-step-dot::after {
                content: '✓';
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-size: 10px;
                font-weight: 700;
            }
            .ai-step.done .ai-step-label { color: #059669; }
            .ai-step.error .ai-step-dot { background: #ef4444; }
            .ai-step.error .ai-step-label { color: #dc2626; }
            @keyframes stepPulse {
                0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.2); }
                50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.1); }
            }

            /* 消息区 */
            .ai-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                background: #fafbfc;
            }
            .ai-msg {
                display: flex;
                gap: 10px;
                max-width: 85%;
            }
            .ai-msg-user {
                align-self: flex-end;
                flex-direction: row-reverse;
            }
            .ai-msg-assistant {
                align-self: flex-start;
            }
            .ai-msg-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #3b82f6, #6366f1);
                color: #fff;
                font-size: 12px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .ai-msg-bubble {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 12px 16px;
                font-size: 14px;
                line-height: 1.7;
                color: #0f172a;
            }
            .ai-msg-user .ai-msg-bubble {
                background: #eff6ff;
                border-color: #bfdbfe;
                color: #1e40af;
            }
            .ai-msg-bubble ul { margin: 8px 0; padding-left: 20px; }
            .ai-msg-bubble li { margin: 4px 0; }
            .ai-msg-bubble b { font-weight: 600; }
            .ai-reply-warn { color: #92400e; }
            .ai-reply-error { color: #991b1b; }

            /* 示例问题 chip */
            .ai-example-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding-left: 42px;
                margin-top: -8px;
            }
            .ai-chip {
                background: #fff;
                border: 1px solid #e2e8f0;
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 12.5px;
                color: #475569;
                cursor: pointer;
                transition: all 0.15s;
            }
            .ai-chip:hover {
                background: #eff6ff;
                border-color: #93c5fd;
                color: #1d4ed8;
            }

            /* 输入区 */
            .ai-input-area {
                display: flex;
                gap: 10px;
                padding: 14px 16px;
                border-top: 1px solid #e2e8f0;
                background: #fff;
            }
            .ai-input-area textarea {
                flex: 1;
                border: 1px solid #d1d5db;
                border-radius: 10px;
                padding: 10px 14px;
                font-size: 14px;
                resize: none;
                height: 52px;
                font-family: inherit;
                line-height: 1.5;
            }
            .ai-input-area textarea:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
            }
            .ai-send-btn {
                background: #2563eb;
                color: #fff;
                border: none;
                border-radius: 10px;
                padding: 0 24px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                height: 52px;
            }
            .ai-send-btn:hover { background: #1d4ed8; }

            /* 参数面板 */
            .ai-param-panel {
                display: flex;
                flex-direction: column;
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 14px;
                overflow: hidden;
            }
            .ai-param-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #f8fafc;
            }
            .ai-param-title {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
            }
            .ai-param-status {
                font-size: 12px;
                padding: 3px 10px;
                border-radius: 12px;
                font-weight: 600;
            }
            .status-idle { background: #f1f5f9; color: #64748b; }
            .status-running { background: #dbeafe; color: #1d4ed8; }
            .status-ok { background: #dcfce7; color: #16a34a; }
            .status-error { background: #fee2e2; color: #dc2626; }
            .status-info { background: #e0e7ff; color: #4f46e5; }

            .ai-param-body {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            .ai-param-empty {
                text-align: center;
                color: #94a3b8;
                font-size: 13px;
                padding: 60px 20px;
                line-height: 1.8;
            }
            .ai-param-tool-name {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 4px;
            }
            .ai-param-tool-desc {
                font-size: 12px;
                color: #64748b;
                line-height: 1.6;
                margin-bottom: 14px;
            }
            .ai-param-warn {
                background: #fef3c7;
                border: 1px solid #fcd34d;
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 12px;
                color: #92400e;
                margin-bottom: 14px;
                line-height: 1.6;
            }
            .ai-param-section-title {
                font-size: 12px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin: 14px 0 8px;
                padding-bottom: 6px;
                border-bottom: 1px solid #f1f5f9;
            }
            /* 参数冲突警告块 */
            .ai-param-conflict-block {
                background: #fff7ed;
                border: 1px solid #fed7aa;
                border-radius: 10px;
                padding: 12px;
                margin: 8px 0 14px;
            }
            .ai-conflict-title {
                font-size: 13.5px;
                font-weight: 700;
                color: #9a3412;
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 4px;
            }
            .ai-conflict-icon { font-size: 14px; }
            .ai-conflict-desc {
                font-size: 12px;
                color: #7c2d12;
                margin-bottom: 10px;
                line-height: 1.4;
            }
            .ai-conflict-row {
                background: #fff;
                border-radius: 8px;
                padding: 10px;
                margin-top: 8px;
                border: 1px solid #fed7aa;
            }
            .ai-conflict-row-key {
                font-size: 12px;
                color: #7c2d12;
                margin-bottom: 8px;
            }
            .ai-conflict-row-key code {
                background: #ffedd5;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11.5px;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            }
            .ai-conflict-row-options {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .ai-conflict-option-btn {
                text-align: left;
                background: #fff;
                border: 1.5px solid #fdba74;
                border-radius: 8px;
                padding: 8px 10px;
                cursor: pointer;
                transition: all 0.15s ease;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .ai-conflict-option-btn:hover {
                background: #ffedd5;
                border-color: #f97316;
                transform: translateY(-1px);
            }
            .ai-conflict-option-title {
                font-size: 13px;
                font-weight: 600;
                color: #7c2d12;
            }
            .ai-conflict-option-sub {
                font-size: 11px;
                color: #a16207;
                opacity: 0.8;
            }
            .ai-param-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .ai-param-row {
                display: grid;
                grid-template-columns: 18px 1fr auto;
                align-items: center;
                gap: 6px;
                padding: 6px 8px;
                border-radius: 8px;
                font-size: 12.5px;
            }
            .ai-param-row.filled { background: #f0fdf4; }
            .ai-param-row.missing { background: #fef2f2; }
            .ai-param-row.default { background: #fffbeb; }
            .ai-param-icon {
                font-size: 11px;
                text-align: center;
            }
            .icon-ok { color: #16a34a; }
            .icon-warn { color: #dc2626; }
            .icon-default { color: #d97706; }
            .icon-opt { color: #94a3b8; }
            .ai-param-label {
                color: #334155;
            }
            .ai-param-row.missing .ai-param-label { color: #991b1b; }
            .ai-param-value {
                font-weight: 600;
                color: #0f172a;
                font-size: 12px;
            }
            .ai-param-row.optional .ai-param-value { font-weight: 400; color: #94a3b8; }
            .ai-param-row.default .ai-param-value { color: #92400e; font-weight: 500; }
            .ai-param-tag {
                display: inline-block;
                font-size: 10px;
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 500;
                margin-left: 6px;
                vertical-align: middle;
            }
            .tag-provided { background: #dcfce7; color: #166534; }
            .tag-missing { background: #fee2e2; color: #991b1b; }
            .tag-default { background: #fef3c7; color: #92400e; }

            /* 结果区 */
            .ai-result-overall {
                font-size: 15px;
                font-weight: 700;
                padding: 10px 14px;
                border-radius: 10px;
                text-align: center;
                margin-bottom: 10px;
            }
            .ai-result-overall.ok { background: #dcfce7; color: #166534; }
            .ai-result-overall.err { background: #fee2e2; color: #991b1b; }
            .ai-result-items {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .ai-result-item {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 8px;
                align-items: center;
                padding: 6px 8px;
                border-radius: 6px;
                font-size: 12px;
            }
            .ai-result-item.ok { background: #f0fdf4; }
            .ai-result-item.err { background: #fef2f2; }
            .ai-result-item-name { color: #334155; }
            .ai-result-item-val { font-weight: 600; color: #0f172a; font-size: 11.5px; }
            .ai-result-item-badge {
                font-size: 10.5px;
                padding: 2px 8px;
                border-radius: 10px;
                font-weight: 600;
            }
            .ai-result-item.ok .ai-result-item-badge { background: #bbf7d0; color: #166534; }
            .ai-result-item.err .ai-result-item-badge { background: #fecaca; color: #991b1b; }

            .ai-param-footer {
                padding: 14px 16px;
                border-top: 1px solid #e2e8f0;
                background: #f8fafc;
            }
            .ai-calc-btn {
                width: 100%;
                background: #2563eb;
                color: #fff;
                border: none;
                border-radius: 10px;
                padding: 10px 0;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .ai-calc-btn:hover { background: #1d4ed8; }
            .ai-calc-btn:disabled {
                background: #94a3b8;
                cursor: not-allowed;
            }

            /* typing 动画 */
            .ai-msg-loading { padding: 12px 16px; }
            .ai-typing {
                display: inline-block;
                width: 32px;
                height: 8px;
            }
            .ai-typing::before {
                content: '';
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #94a3b8;
                animation: typing 1s infinite;
            }
            .ai-typing::after {
                content: '';
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #94a3b8;
                margin-left: 4px;
                animation: typing 1s infinite 0.33s;
            }
            @keyframes typing {
                0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
                30% { opacity: 1; transform: translateY(-3px); }
            }
        `;
        document.head.appendChild(style);
    }

    /* ==========================================================
     *  初始化
     * ========================================================== */
    function init() {
        injectStyles();
    }

    /* ==========================================================
     *  运行 A/B 自检（在对话中显示结果）
     * ========================================================== */
    function runSelftest() {
        if (!window.AI_SELFTEST || !window.AI_SELFTEST.runBeamRectAB) {
            alert('自检模块未加载');
            return;
        }
        var msg = '正在运行矩形梁正截面桥接层 A/B 自检...（控制台可看详细日志）';
        if (window.AI_CHAT) {
            window.AI_CHAT.addMessage('status', msg);
        }
        window.AI_SELFTEST.runBeamRectAB(function (r) {
            var html = '<div class="ai-reply ' + (r.consistent ? 'ai-reply-ok' : 'ai-reply-error') + '">';
            html += '<b>矩形梁正截面 A/B 自检结果：' + (r.consistent ? '✓ 通过' : '✗ 不一致') + '</b><br>';
            html += '手动路径 Mu = <b>' + (r.manual_Mu != null ? r.manual_Mu.toFixed(2) : 'N/A') + '</b> kN·m<br>';
            html += 'Bridge 路径 Mu = <b>' + (r.bridge_Mu != null ? r.bridge_Mu.toFixed(2) : 'N/A') + '</b> kN·m<br>';
            html += '差值 = ' + (r.diff_Mu != null ? r.diff_Mu.toFixed(6) : 'N/A') + ' kN·m<br>';
            if (!r.consistent) {
                html += '<br>详细差异请查看浏览器控制台。';
            } else {
                html += '<br>两条路径都走原 calc()，数值完全一致，bridge 桥接正常。';
            }
            html += '</div>';
            if (window.AI_CHAT) {
                window.AI_CHAT.addMessage('assistant', html, { type: 'selftest_result' });
            }
        });
    }

    // 导出到全局
    window.AI_CHAT_UI = {
        renderAssistant: renderAssistant,
        bindAssistant: bindAssistant,
        send: send,
        onKeyDown: onKeyDown,
        sendExample: sendExample,
        clearChat: clearChat,
        calculateNow: calculateNow,
        resolveConflict: resolveConflict,
        runSelftest: runSelftest,
        init: init
    };

    // 立即注入样式
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[AI Chat UI] 模块已加载');
})();
