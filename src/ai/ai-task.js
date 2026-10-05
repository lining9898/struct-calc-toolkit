/* ==========================================================
 *  AI 计算任务状态管理 —— AI_TASK
 *  维护一个全局 currentTask，支持：
 *   - 新建任务、合并参数
 *   - 参数完整性检查
 *   - 状态流转
 *   - 事件订阅（状态变化时通知UI）
 * ========================================================== */
(function () {
    'use strict';

    var listeners = [];
    var currentTask = null;

    var STATUS = {
        IDLE: 'idle',
        UNDERSTANDING: 'understanding',
        TOOL_SELECTED: 'tool_selected',
        COLLECTING_PARAMS: 'collecting_parameters',
        READY: 'ready_to_calculate',
        CALCULATING: 'calculating',
        COMPLETED: 'completed',
        ERROR: 'error'
    };

    function notify() {
        listeners.forEach(function (fn) {
            try { fn(currentTask); } catch (e) { console.error('[AI_TASK] listener error:', e); }
        });
    }

    function subscribe(fn) {
        listeners.push(fn);
        // 返回取消订阅函数
        return function () {
            var idx = listeners.indexOf(fn);
            if (idx >= 0) listeners.splice(idx, 1);
        };
    }

    function newTask(tool_id) {
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(tool_id);
        if (!tool) {
            console.error('[AI_TASK] 未找到工具:', tool_id);
            return null;
        }
        currentTask = {
            tool_id: tool_id,
            tool_name: tool.tool_name,
            parameters: {},         // 全量参数（默认值 + 用户提供值合并后的视图）
            provided_parameters: {}, // 用户实际提供过的参数（不含默认值），用于安全门判断
            missing_parameters: [],
            status: STATUS.TOOL_SELECTED,
            result: null,
            error: null,
            error_message: null,
            created_at: Date.now(),
            updated_at: Date.now()
        };
        // 填入默认值到 parameters（UI展示用），但 provided_parameters 保持空
        var allParams = (tool.required_parameters || []).concat(tool.optional_parameters || []);
        allParams.forEach(function (p) {
            if (p.default !== undefined) {
                currentTask.parameters[p.name] = p.default;
            }
        });
        checkMissing();
        notify();
        return currentTask;
    }

    function getCurrent() {
        return currentTask;
    }

    function clearTask() {
        currentTask = null;
        notify();
    }

    function setStatus(status) {
        if (!currentTask) return;
        currentTask.status = status;
        currentTask.updated_at = Date.now();
        notify();
    }

    /**
     * 合并参数：只更新传入的字段，其他字段保留
     * @param {Object} params 要更新的参数字典
     */
    function mergeParameters(params) {
        if (!currentTask) return { success: false, message: '无当前任务' };
        if (!params || typeof params !== 'object') return { success: false, message: '参数为空' };

        // 先检测冲突
        var conflicts = detectParamConflicts(params, currentTask.tool_id);
        var conflictKeys = Object.keys(conflicts);

        var mergedCount = 0;
        var skipped = [];
        var self = this;

        Object.keys(params).forEach(function (key) {
            var val = params[key];
            // 不写入 undefined/null/空字符串 的值
            if (val === undefined || val === null || val === '') {
                skipped.push(key + '(空值)');
                return;
            }
            // 冲突 key 跳过，存入 pending_conflicts 等用户确认
            if (conflicts[key]) {
                skipped.push(key + '(冲突→' + conflicts[key].join('/') + ')');
                return;
            }
            var realKey = resolveParamKey(key, currentTask.tool_id);
            if (!realKey) {
                skipped.push(key + '(未识别)');
                return;
            }
            currentTask.parameters[realKey] = val;
            // 标记为用户提供过（即使值和默认值相同，也是用户明确给出的）
            currentTask.provided_parameters[realKey] = val;
            mergedCount++;
        });

        // 把冲突信息挂到 task 上，供UI展示
        if (conflictKeys.length > 0) {
            currentTask.pending_conflicts = conflicts;
            // 同步保存冲突key对应的原始值，供用户确认后写入
            if (!currentTask.conflict_values) currentTask.conflict_values = {};
            conflictKeys.forEach(function (k) {
                currentTask.conflict_values[k] = params[k];
            });
        } else {
            currentTask.pending_conflicts = null;
        }

        console.log('[AI_PARAM] mergeParameters 完成，本次合并 ' + mergedCount + ' 个参数，跳过: [' + skipped.join(', ') + ']，已提供: ' +
            Object.keys(currentTask.provided_parameters).join(', '));
        checkMissing();
        // 状态自动流转
        if (currentTask.status === STATUS.TOOL_SELECTED) {
            currentTask.status = STATUS.COLLECTING_PARAMS;
        }
        if (currentTask.status === STATUS.COLLECTING_PARAMS && currentTask.missing_parameters.length === 0 && conflictKeys.length === 0) {
            currentTask.status = STATUS.READY;
        }
        // 如果用户在计算完成后修改参数，回到收集状态
        if (currentTask.status === STATUS.COMPLETED) {
            currentTask.status = STATUS.COLLECTING_PARAMS;
            currentTask.result = null;
        }
        currentTask.updated_at = Date.now();
        notify();
    }

    /**
     * 检查必填参数是否齐全，更新 missing_parameters
     */
    function checkMissing() {
        if (!currentTask) return;
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(currentTask.tool_id);
        if (!tool) return;
        var missing = [];
        var required = tool.required_parameters || [];
        // 用 parameters（含默认值）检查完整性，仅用于 UI 展示和状态流转
        var params = currentTask.parameters;
        required.forEach(function (p) {
            var val = params[p.name];
            // 空值判定：undefined / null / 空字符串 / 数字0需要看类型
            if (val === undefined || val === null || val === '') {
                missing.push(p.name);
            } else if (p.type === 'number' && isNaN(val)) {
                missing.push(p.name);
            } else if (p.type === 'array' && (!Array.isArray(val) || val.length === 0)) {
                missing.push(p.name);
            }
        });
        currentTask.missing_parameters = missing;
    }

    /**
     * 参数名大小写归一化匹配：给定一个 key，返回工具参数清单中真正的参数名
     * 精确匹配优先，否则大小写不敏感匹配
     */
    /**
     * 参数名解析：将用户输入/LLM返回的参数名，解析为规范名（canonical name）。
     * 匹配优先级：
     *   1. name 精确匹配（区分大小写）
     *   2. aliases 精确匹配（区分大小写）
     *   3. label 精确匹配
     *   4. name/aliases 小写模糊匹配（仅作为兜底，且必须唯一匹配）
     * 若模糊匹配命中多个，返回 null 并填 conflicts —— 由调用方触发冲突确认。
     * @param {string} key 待解析的参数名
     * @param {string} [tool_id]
     * @returns {string|null} 规范名；冲突或未找到返回 null
     */
    function resolveParamKey(key, tool_id) {
        if (!key || typeof key !== 'string') return null;
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(tool_id || (currentTask && currentTask.tool_id));
        if (!tool) return null;
        var all = (tool.required_parameters || []).concat(tool.optional_parameters || []);

        // 1. name 精确匹配
        for (var i = 0; i < all.length; i++) {
            if (all[i].name === key) return all[i].name;
        }

        // 2. aliases 精确匹配
        for (var j = 0; j < all.length; j++) {
            var aliases = all[j].aliases || [];
            for (var k = 0; k < aliases.length; k++) {
                if (aliases[k] === key) return all[j].name;
            }
        }

        // 3. label 精确匹配
        for (var m = 0; m < all.length; m++) {
            if (all[m].label === key) return all[m].name;
        }

        // 4. 小写模糊兜底：name + aliases 全小写后匹配，命中多个视为冲突
        var keyLower = key.toLowerCase().trim();
        if (keyLower === '') return null;
        var hits = [];
        for (var n = 0; n < all.length; n++) {
            var p = all[n];
            var candidates = [p.name].concat(p.aliases || []).concat([p.label]);
            for (var q = 0; q < candidates.length; q++) {
                if (candidates[q] && candidates[q].toLowerCase() === keyLower) {
                    if (hits.indexOf(p.name) === -1) hits.push(p.name);
                    break;
                }
            }
        }
        if (hits.length === 1) return hits[0];
        if (hits.length > 1) {
            // 冲突：返回 null，由调用方拿 conflicts 做确认
            return null;
        }
        return null;
    }

    /**
     * 检测参数冲突：返回所有命中多个规范名的输入key
     * @returns {Object} { key: [canonicalNames...] }
     */
    function detectParamConflicts(params, tool_id) {
        if (!params || typeof params !== 'object') return {};
        var conflicts = {};
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(tool_id || (currentTask && currentTask.tool_id));
        if (!tool) return conflicts;
        var all = (tool.required_parameters || []).concat(tool.optional_parameters || []);

        Object.keys(params).forEach(function (key) {
            // 先精确试一次，命中了就不冲突
            var exactHit = null;
            for (var i = 0; i < all.length; i++) {
                if (all[i].name === key) { exactHit = all[i].name; break; }
                var aliases = all[i].aliases || [];
                for (var k = 0; k < aliases.length; k++) {
                    if (aliases[k] === key) { exactHit = all[i].name; break; }
                }
                if (exactHit) break;
                if (all[i].label === key) { exactHit = all[i].name; break; }
            }
            if (exactHit) return; // 精确命中，无冲突

            // 模糊匹配看是否多命中
            var keyLower = key.toLowerCase().trim();
            var hits = [];
            for (var n = 0; n < all.length; n++) {
                var p = all[n];
                var candidates = [p.name].concat(p.aliases || []).concat([p.label]);
                for (var q = 0; q < candidates.length; q++) {
                    if (candidates[q] && candidates[q].toLowerCase() === keyLower) {
                        if (hits.indexOf(p.name) === -1) hits.push(p.name);
                        break;
                    }
                }
            }
            if (hits.length > 1) {
                conflicts[key] = hits;
            }
        });
        return conflicts;
    }

    /**
     * 【参数安全门】bridge 调用前的最后一道校验
     * 检查所有必填参数是否都是用户明确提供的（不是系统默认值）
     * 返回 { pass:boolean, missing_provided:[], received:{}, message:string }
     */
    function validateForBridge() {
        if (!currentTask) {
            return { pass: false, missing_provided: [], received: {}, message: '没有当前任务' };
        }
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(currentTask.tool_id);
        if (!tool) {
            return { pass: false, missing_provided: [], received: {}, message: '工具未注册' };
        }
        var required = tool.required_parameters || [];
        var provided = currentTask.provided_parameters || {};
        var missingProvided = [];

        required.forEach(function (p) {
            var val = provided[p.name];
            var isProvided = val !== undefined && val !== null && val !== '' && !(p.type === 'number' && isNaN(val));
            if (!isProvided) {
                missingProvided.push(p.name);
            }
        });

        var pass = missingProvided.length === 0;
        var receivedCopy = {};
        Object.keys(provided).forEach(function (k) { receivedCopy[k] = provided[k]; });

        // 工具级自定义安全门校验（可选）
        // 用于校验数组长度、数值范围等组合约束，失败时 pass=false 并追加到 missing_provided
        var toolErrors = [];
        if (pass && typeof tool.validateParams === 'function') {
            var vRes = tool.validateParams(provided);
            if (vRes && vRes.pass === false) {
                pass = false;
                toolErrors = vRes.errors || [];
            }
        }

        console.log('[AI_VALIDATE] 参数安全门结果: pass=' + pass +
            ', 缺失必填(未提供): ' + missingProvided.join(', ') +
            ', 工具级校验错误: ' + toolErrors.join('; ') +
            ', 已提供: ' + Object.keys(provided).join(', '));

        return {
            pass: pass,
            missing_provided: missingProvided.concat(toolErrors),
            received: receivedCopy,
            tool_errors: toolErrors,
            message: pass ? '全部必填参数已由用户提供' : ('缺少用户提供的必填参数: ' + missingProvided.join(', ') +
                (toolErrors.length > 0 ? '；参数不合法: ' + toolErrors.join('；') : ''))
        };
    }

    /**
     * 设置任务错误状态
     */
    function setError(msg) {
        if (!currentTask) return;
        currentTask.status = STATUS.ERROR;
        currentTask.error_message = msg;
        currentTask.updated_at = Date.now();
        notify();
    }

    /**
     * 执行计算（调用桥接函数）
     * @param {Function} callback 结果回调
     */
    function runCalculation(callback) {
        if (!currentTask) {
            if (callback) callback({ success: false, error: '没有当前任务' });
            return;
        }
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(currentTask.tool_id);
        if (!tool) {
            if (callback) callback({ success: false, error: '工具未注册' });
            return;
        }
        if (!tool.bridge) {
            if (callback) callback({ success: false, error: '该工具暂未接入 AI 计算' });
            return;
        }
        // 检查参数
        checkMissing();
        if (currentTask.missing_parameters.length > 0) {
            currentTask.status = STATUS.COLLECTING_PARAMS;
            notify();
            if (callback) callback({ success: false, error: '参数不完整，缺少: ' + currentTask.missing_parameters.join(', ') });
            return;
        }

        // 【参数安全门-最后一道防线】所有必填项必须是用户提供的，绝不能用默认值计算
        var gate = validateForBridge();
        if (!gate.pass) {
            currentTask.status = STATUS.ERROR;
            currentTask.error_message = gate.message;
            notify();
            console.error('[AI_VALIDATE] 安全门拦截！禁止使用默认值计算。缺少: ' + gate.missing_provided.join(', '));
            if (callback) callback({
                success: false,
                error: 'missing_parameters',
                error_detail: gate.message,
                missing: gate.missing_provided,
                received: gate.received
            });
            return;
        }

        console.log('[AI_BRIDGE] 开始调用bridge, tool=' + currentTask.tool_id +
            ', params=' + JSON.stringify(currentTask.provided_parameters));

        currentTask.status = STATUS.CALCULATING;
        currentTask.updated_at = Date.now();
        notify();

        try {
            tool.bridge(currentTask.provided_parameters, function (res) {
                if (!currentTask) return;
                if (res.success) {
                    currentTask.result = res.result;
                    currentTask.raw_result = res.raw;
                    currentTask.status = STATUS.COMPLETED;
                } else {
                    currentTask.error = res.error;
                    currentTask.status = STATUS.ERROR;
                }
                currentTask.updated_at = Date.now();
                notify();
                if (callback) callback(res);
            });
        } catch (e) {
            currentTask.error = e.message || String(e);
            currentTask.status = STATUS.ERROR;
            currentTask.updated_at = Date.now();
            notify();
            if (callback) callback({ success: false, error: e.message || String(e) });
        }
    }

    /**
     * 获取工具的参数元信息（带label和unit）
     */
    function getParamMeta(tool_id, param_name) {
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(tool_id);
        if (!tool) return null;
        var all = (tool.required_parameters || []).concat(tool.optional_parameters || []);
        for (var i = 0; i < all.length; i++) {
            if (all[i].name === param_name) return all[i];
        }
        return null;
    }

    /**
     * 生成参数提示文本（用于AI prompt和UI显示）
     */
    function getParamSummary() {
        if (!currentTask) return '';
        var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get(currentTask.tool_id);
        if (!tool) return '';
        var all = (tool.required_parameters || []).concat(tool.optional_parameters || []);
        var lines = [];
        all.forEach(function (p) {
            var val = currentTask.parameters[p.name];
            var filled = val !== undefined && val !== null && val !== '';
            var mark = p.required ? (filled ? '✓' : '⚠') : '○';
            var valStr = filled ? val + (p.unit ? ' ' + p.unit : '') : '(未填)';
            lines.push(mark + ' ' + p.label + ': ' + valStr);
        });
        return lines.join('\n');
    }

    // 导出到全局
    window.AI_TASK = {
        STATUS: STATUS,
        newTask: newTask,
        getCurrent: getCurrent,
        clearTask: clearTask,
        setStatus: setStatus,
        setError: setError,
        mergeParameters: mergeParameters,
        checkMissing: checkMissing,
        validateForBridge: validateForBridge,
        resolveParamKey: resolveParamKey,
        detectParamConflicts: detectParamConflicts,
        runCalculation: runCalculation,
        getParamMeta: getParamMeta,
        getParamSummary: getParamSummary,
        subscribe: subscribe
    };
})();
