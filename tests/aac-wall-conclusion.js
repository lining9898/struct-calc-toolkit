'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function run(values = {}) {
    const defaults = { aw_L: 3, aw_b: 600, aw_h: 200, aw_grade: 'A5.0', aw_reb: 'CRB600H',
        aw_d: 8, aw_n: 4, aw_as: 35, aw_w0: 0.45, aw_terrain: 'B', aw_z: 10, aw_mus: 1.2,
        aw_gamm0: 1, aw_gammaG: 1.3, aw_gammaW: 1.5, aw_psiW_seis: 0.2, aw_seis: 'n',
        aw_amax: 0.08, aw_eta: 1, aw_eta_cat: 1, aw_state: 1.2, aw_xi: 1.5, aw_nj: 4, aw_gamma0j: 1.1, ...values };
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
    assert.match(html, /自重（JGJ\/T 17-2020 第3\.3\.1条）/);
    assert.ok(env.element('aw_result').innerHTML.includes(summary));
    assert.ok(env.element('aw_proc').innerHTML.includes(summary));
    assert.ok(html.includes(summary), '页面、过程与计算书必须使用相同结论');
    assert.doesNotMatch(html, /<td>综合判定<\/td><td>满足<\/td>/);
    assert.match(html, /抗裂 σ/);
    assert.match(html, /钢管锚（参考数值比较）/);
    for (const output of [env.element('aw_result').innerHTML, env.element('aw_proc').innerHTML, html]) {
        assert.doesNotMatch(output, /风荷载作用下三种节点|抗震开启时另按/);
        assert.match(output, /两倍风荷载需求（2×N<sub>wj<\/sub>）(?:<[^>]+>|[:\s　])*2 × [\d.]+ = [\d.]+ kN\/个/);
        assert.match(output, /节点作用比较/);
    }
    return summary;
}
function closeTo(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 0.0001, `应为 ${expected}，实为 ${actual}`);
}

let env = run();
closeTo(env.result.wk, 0.918);
closeTo(env.result.Nwj, 0.681615);
closeTo(env.result.Rd_node, 1.36323);
closeTo(env.result.Mu, 9.0824965);
assert.equal(env.result.AsInner, env.result.AsOuter);
closeTo(env.result.centroid, 100);
closeTo(env.result.defl, 0.5441871);
closeTo(env.result.sigmaCk, 0.1134811);

assert.match(checkBook(env), /地震作用未验算/);
assert.match(env.element('aw_result').innerHTML, /仅计算两倍风荷载，需求为 [\d.]+ kN\/个/);
// 模拟页面上打开抗震选项，确认计算与导出都使用更新后的工况。
env.element('aw_seis').value = 'y';
env.element('aw_seis').handlers.change();
env.result = env.context.window._AW_RESULT;
assert.match(checkBook(env), /节点作用比较中，两倍风荷载较大。多遇地震验算采用简化模型/);
assert.doesNotMatch(env.element('aw_proc').innerHTML, /地震作用未验算/);
closeTo(env.result.FEk, 0.444528);
closeTo(env.result.Fe, 0.6223392);
closeTo(env.result.Mcomb, 0.6526494);
closeTo(env.result.directions[0].Vcomb, 0.5590296);
closeTo(env.result.VsjCombo, 0.30746628);
assert.equal(env.result.seisShearOk, true);
assert.match(env.element('aw_result').innerHTML, /多遇地震组合受剪/);
assert.match(env.element('aw_result').innerHTML, /节点作用比较: 两倍风荷载较大，取 [\d.]+ kN\/个/);
assert.match(env.element('aw_result').innerHTML, /两倍风荷载满足。多遇地震组合满足/);

// 有意使用极端作用值来覆盖节点方案在两种工况下判定相反的情况。
env = run({ aw_seis: 'y', aw_w0: 0.01, aw_amax: 5 });
assert.match(checkBook(env), /节点作用比较中，多遇地震组合较大/);
assert.equal(env.result.nodeDemand, env.result.VsjCombo);
assert.equal(env.result.seisShearOk, false);
assert.match(env.element('aw_result').innerHTML, /节点作用比较: 多遇地震组合较大，取 [\d.]+ kN\/个/);
assert.match(env.element('aw_result').innerHTML, /钢管锚（参考数值比较）: [^<]*风荷载满足。多遇地震组合不满足/);
env = run({ aw_seis: 'y', aw_w0: 3 });
checkBook(env);
assert.equal(env.result.nodeDemand, env.result.Rd_node);
assert.match(env.element('aw_result').innerHTML, /钢管锚（参考数值比较）: [^<]*风荷载不满足。多遇地震组合满足/);
// 复现重要性系数遗漏会导致的受剪误判。
env = run({ aw_L: 3.8, aw_h: 150, aw_mus: 2, aw_w0: 1.75, aw_gamm0: 1.1 });
closeTo(env.result.Vmax, 10.1745);
closeTo(env.result.Vdesign, 11.19195);
assert.equal(env.result.tauOk, false);
assert.match(checkBook(env), /风荷载受剪/);

// 相同板材两面的受拉钢筋和风荷载可以不同。
env = run({ aw_n_outer: 1, aw_w0: 1.25, aw_mus_suction: -2.3 });
const [pressure, suction] = env.result.directions;
assert.equal(pressure.capOk, true);
assert.equal(suction.capOk, false);
assert.ok(pressure.Mu > suction.Mu);
assert.ok(suction.wk > pressure.wk);
assert.ok(env.result.centroid > 100);
assert.equal(env.result.capOk, false);

env = run({ aw_seis: 'y', aw_psiW_seis: 0 });
closeTo(env.result.VsjCombo, env.result.Vsj);
closeTo(env.result.directions[0].Vcomb, env.result.Fe / 2);

env = run({ aw_h: 175 });
assert.equal(env.result.nodeChecks.length, 0);
closeTo(env.result.Rd_node, 1.36323);
assert.match(env.element('aw_result').innerHTML, /当前板厚无内置节点参考抗力/);

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
assert.match(summary.text, /中震弹性、大震不屈服和层间位移适应性未验算/);
env.element('aw_n').value = '-1';
env.element('aw_calc').handlers.click();
assert.equal(env.context.window._AW_RESULT, null, '非法输入不得保留旧结论供导出');
let alertText = '';
env.context.CUR_TOOL = 'aac-wall';
env.context.TOOLS = env.context.window.TOOLS;
env.context.alert = message => { alertText = message; };
env.context.downloadDoc = () => assert.fail('无效结果不得导出');
env.context.exportBook();
assert.match(alertText, /有效的外墙板计算/);
console.log('AAC wall calculations, edge cases and report checks passed.');
