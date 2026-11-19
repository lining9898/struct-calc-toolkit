'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function run(values = {}) {
    const defaults = { aw_L: 3, aw_b: 600, aw_h: 200, aw_grade: 'A5.0', aw_reb: 'CRB600H',
        aw_d: 8, aw_n: 4, aw_as: 35, aw_w0: 0.45, aw_terrain: 'B', aw_z: 10, aw_mus: 1.2,
        aw_gamm0: 1, aw_gammaG: 1.3, aw_gammaW: 1.5, aw_psiW: 0.6, aw_seis: 'n',
        aw_amax: 0.08, aw_eta: 1, aw_xi: 1.5, aw_nj: 4, aw_gamma0j: 1.1, ...values };
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) elements.set(id, { value: String(defaults[id] ?? ''), innerHTML: '', handlers: {},
            addEventListener(type, fn) { this.handlers[type] = fn; },
            closest() { return null; }, querySelectorAll() { return []; } });
        return elements.get(id);
    }
    const context = { window: {}, document: { getElementById: element, querySelector() { return null; } },
        fmt: (n, digits) => Number(n).toFixed(digits),
        resultRow: (label, value) => `<div>${label}: ${value}</div>`,
        tag: (_type, value) => value, badge: (_type, value) => value };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('src/core/report.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('src/tools/prefab/aac-wall.js', 'utf8'), context);
    context.window.TOOLS['aac-wall'].bind();
    return { context, element, result: context.window._AW_RESULT };
}
function checkBook(env) {
    const r = env.result;
    const summary = env.context.aacWallConclusion(r).text;
    const html = env.context.buildAacWallBook(r, { title: '外墙板' });
    assert.ok(env.element('aw_result').innerHTML.includes(summary));
    assert.ok(env.element('aw_proc').innerHTML.includes(summary));
    assert.ok(html.includes(summary), '页面、过程与计算书必须使用相同结论');
    assert.doesNotMatch(html, /<td>综合判定<\/td><td>满足<\/td>/);
    assert.match(html, /抗裂 σ/);
    assert.match(html, /钢管锚（参考数值比较）/);
    for (const output of [env.element('aw_result').innerHTML, env.element('aw_proc').innerHTML, html]) {
        assert.doesNotMatch(output, /风荷载作用下三种节点|抗震开启时另按/);
        assert.match(output, /节点控制作用/);
    }
    return summary;
}
let env = run();
assert.match(checkBook(env), /地震作用未验算/);
assert.match(env.element('aw_result').innerHTML, /风荷载控制（地震作用未验算）/);
// 模拟页面上打开抗震选项，确认计算与导出都使用更新后的工况。
env.element('aw_seis').value = 'y';
env.element('aw_seis').handlers.change();
env.result = env.context.window._AW_RESULT;
assert.match(checkBook(env), /节点参考比较计入了水平地震作用，风荷载控制。地震作用计算依据及项目参数待核验/);
assert.doesNotMatch(env.element('aw_proc').innerHTML, /地震作用未验算/);
assert.match(env.element('aw_result').innerHTML, /节点控制作用: [^<]*风荷载控制/);
assert.match(env.element('aw_result').innerHTML, /风荷载满足，水平地震作用满足/);

// 有意使用极端作用值来覆盖节点方案在两种工况下判定相反的情况。
env = run({ aw_seis: 'y', aw_w0: 0.01, aw_amax: 5 });
assert.match(checkBook(env), /节点参考比较计入了水平地震作用，水平地震作用控制/);
assert.equal(env.result.nodeDemand, env.result.Vsj);
assert.match(env.element('aw_result').innerHTML, /水平地震作用控制/);
assert.match(env.element('aw_result').innerHTML, /钢管锚（参考数值比较）: [^<]*风荷载满足，水平地震作用不满足。控制作用比较不满足/);
env = run({ aw_seis: 'y', aw_w0: 3 });
checkBook(env);
assert.equal(env.result.nodeDemand, env.result.Rd_node);
assert.match(env.element('aw_result').innerHTML, /钢管锚（参考数值比较）: [^<]*风荷载不满足，水平地震作用满足。控制作用比较不满足/);
env = run({ aw_n: 20, aw_w0: 0.01 });
assert.equal(env.result.overRein, true);
assert.equal(env.result.capOk, false, '超筋不能因弯矩数值较小而判受弯满足');
assert.match(checkBook(env), /超筋/);
env = run({ aw_w0: 5 });
assert.match(checkBook(env), /存在不满足项/);

// 三种节点为备选方案：只有一个参考比较失败时，必须指出该方案，不能称整个板材不满足。
const r = { capOk: true, tauOk: true, crackOk: true, deflOk: true, seisOn: false,
    nodeChecks: [{ name: '钢管锚', ok: false }, { name: '预埋件摇摆', ok: true }] };
const summary = env.context.aacWallConclusion(r);
assert.equal(summary.hasFailure, false);
assert.match(summary.text, /节点参考数值比较未满足的方案：钢管锚/);
assert.doesNotMatch(summary.text, /未满足的方案：.*预埋件摇摆/);
assert.match(summary.text, /不能据此判定外墙板及连接系统整体满足设计要求/);
env.element('aw_n').value = '-1';
env.element('aw_calc').handlers.click();
assert.equal(env.context.window._AW_RESULT, null, '非法输入不得保留旧结论供导出');
console.log('AAC wall page, process and report conclusion checks passed.');
