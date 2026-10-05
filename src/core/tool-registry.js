/* ============================================================
 *  core/tool-registry.js — 工具注册中心
 * ------------------------------------------------------------
 *  现状说明：
 *  本轮重构采用渐进式策略，核心基础代码集中在 app-base.js 中
 *  （从原 index.html 内联 JS 整体提取，确保计算逻辑零改动）。
 *  本文件为架构占位。TOOLS 对象在 app-base.js 中声明，
 *  各工具文件通过 window.TOOLS['tool-id'] = tool 方式注册。
 *  下一步可在此文件中封装 registerTool() 注册函数、
 *  工具分类索引、工具发现等能力。
 * ============================================================ */
(function () {
    'use strict';

    // 确保 TOOLS 存在
    window.TOOLS = window.TOOLS || {};

    /**
     * 注册工具（兼容封装）
     * @param {string} id 工具唯一标识
     * @param {Object} tool 工具定义对象
     */
    function registerTool(id, tool) {
        if (!id || !tool) return false;
        window.TOOLS[id] = tool;
        return true;
    }

    /**
     * 获取所有已注册工具的 ID 列表
     */
    function listTools() {
        return Object.keys(window.TOOLS || {});
    }

    /**
     * 获取指定工具
     */
    function getTool(id) {
        return window.TOOLS ? window.TOOLS[id] : null;
    }

    window.registerTool = registerTool;
    window.listTools = listTools;
    window.getTool = getTool;

    console.log('[Core] tool-registry.js loaded. TOOLS registry ready.');
})();
