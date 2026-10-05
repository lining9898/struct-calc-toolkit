/* ==========================================================
 *  AI 桥接层 A/B 自检 —— AI_SELFTEST
 *  在浏览器控制台运行，对比"手动填值+点按钮"和"bridge调用"两条路径的结果
 *  确保 bridge 完全走原 calc()，数值一致，LLM 不参与任何计算
 *
 *  用法（浏览器控制台）：
 *    AI_SELFTEST.runBeamRectAB()   // 矩形梁正截面自检
 *    AI_SELFTEST.runAll()          // 运行所有已接通工具的自检
 * ========================================================== */
(function () {
    'use strict';

    // 公共辅助：填值到 DOM
    function setVal(id, val) {
        var el = document.getElementById(id);
        if (!el) return false;
        el.value = val;
        try { el.dispatchEvent(new Event('change')); } catch (e) {}
        return true;
    }

    // 公共辅助：点击按钮
    function clickBtn(id) {
        var btn = document.getElementById(id);
        if (btn) btn.click();
    }

    // 确保工具页面已渲染
    function ensureTool(tool_id, callback) {
        if (window.CUR_TOOL === tool_id) {
            setTimeout(callback, 50);
            return;
        }
        if (typeof window.renderTool === 'function') {
            window.renderTool(tool_id);
            setTimeout(callback, 200);
        } else {
            callback();
        }
    }

    // ============ 自检 1：矩形梁正截面 ============
    function runBeamRectAB(callback) {
        console.log('[AI_SELFTEST] 开始矩形梁正截面 A/B 自检...');

        var params = {
            b: 250,
            h: 500,
            concrete: 'C30',
            steel: 'HRB400',
            As: 1520,
            AsP: 0,
            a_s: 40,
            a_s2: 40
        };

        ensureTool('beam-rect', function () {
            // ---- 路径 A：模拟手动（直接写 DOM + 点按钮） ----
            setVal('r_b', params.b);
            setVal('r_h', params.h);
            setVal('r_con', params.concrete);
            setVal('r_reb', params.steel);
            setVal('r_As', params.As);
            setVal('r_AsP', params.AsP);
            setVal('r_as', params.a_s);
            setVal('r_as2', params.a_s2);
            clickBtn('r_calc');

            var manual_Mu = window._BR_RESULT ? window._BR_RESULT.Mu : null;
            var manual_xi = window._BR_RESULT ? window._BR_RESULT.xi : null;
            var manual_x  = window._BR_RESULT ? window._BR_RESULT.x  : null;

            console.log('[AI_SELFTEST] 路径A（手动） Mu =', manual_Mu, 'kN·m');

            // 重置一下，保证 B 路径独立计算
            setVal('r_b', 300);
            setVal('r_h', 600);
            setVal('r_As', 1473);
            clickBtn('r_calc');

            // ---- 路径 B：通过 bridge 调用 ----
            var tool = window.AI_TOOL_REGISTRY && window.AI_TOOL_REGISTRY.get('beam-rect');
            if (!tool || !tool.bridge) {
                var err0 = 'beam-rect bridge 未就绪';
                console.error('[AI_SELFTEST]', err0);
                if (callback) callback({ success: false, error: err0 });
                return;
            }

            // 重新切回 beam-rect（重置时可能没变，但保险起见）
            ensureTool('beam-rect', function () {
                tool.bridge(params, function (res) {
                    if (!res.success) {
                        console.error('[AI_SELFTEST] 路径B失败:', res.error);
                        if (callback) callback({ success: false, error: res.error });
                        return;
                    }

                    var bridge_Mu = res.result.results.capacity.Mu;
                    var bridge_xi = res.result.results.capacity.xi;
                    var bridge_x  = res.result.results.capacity.x;

                    console.log('[AI_SELFTEST] 路径B（bridge） Mu =', bridge_Mu, 'kN·m');

                    // 对比（浮点允许极小误差）
                    var diff_Mu = Math.abs((manual_Mu || 0) - (bridge_Mu || 0));
                    var diff_xi = Math.abs((manual_xi || 0) - (bridge_xi || 0));
                    var diff_x  = Math.abs((manual_x  || 0) - (bridge_x  || 0));
                    var consistent = diff_Mu < 0.001 && diff_xi < 1e-6 && diff_x < 0.001;

                    var result = {
                        tool_id: 'beam-rect',
                        params: params,
                        manual_Mu: manual_Mu,
                        bridge_Mu: bridge_Mu,
                        diff_Mu: diff_Mu,
                        manual_xi: manual_xi,
                        bridge_xi: bridge_xi,
                        manual_x: manual_x,
                        bridge_x: bridge_x,
                        consistent: consistent
                    };

                    console.log('[AI_SELFTEST] 一致性:', consistent ? '✓ 通过' : '✗ 失败');
                    if (!consistent) {
                        console.log('[AI_SELFTEST] 详细差异:', JSON.stringify({
                            diff_Mu: diff_Mu, diff_xi: diff_xi, diff_x: diff_x
                        }));
                    }

                    if (callback) callback(result);
                });
            });
        });
    }

    // 运行全部已接通工具的自检
    function runAll(callback) {
        var results = {};
        var done = 0;
        var total = 1; // 当前只有 beam-rect

        function onDone(toolId, res) {
            results[toolId] = res;
            done++;
            if (done >= total && callback) callback(results);
        }

        runBeamRectAB(function (r) { onDone('beam-rect', r); });
    }

    // 导出到全局
    window.AI_SELFTEST = {
        runBeamRectAB: runBeamRectAB,
        runAll: runAll
    };

    console.log('[AI SelfTest] 模块已加载。控制台运行 AI_SELFTEST.runBeamRectAB() 可触发矩形梁 A/B 自检。');
})();
