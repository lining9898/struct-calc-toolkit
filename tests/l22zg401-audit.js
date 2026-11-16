'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
function element(id) {
    if (!elements.has(id)) elements.set(id, {
        value: '', innerHTML: '', handlers: {},
        addEventListener(type, fn) { this.handlers[type] = fn; },
        closest() { return null; }, reset() { this.handlers.reset?.(); }
    });
    return elements.get(id);
}
const context = {
    window: { TOOLS: {} }, document: { getElementById: element },
    fmt: (n, p) => n.toFixed(p), opts: () => '', selField: () => '', numField: () => '',
    calcBookCover: () => '', calcBookSign: () => '', calcBookFooter: () => ''
};
vm.createContext(context);
for (const path of ['src/l22zg401-data.js', 'src/l22zg401.js']) vm.runInContext(fs.readFileSync(path, 'utf8'), context);
const D = context.window.L22ZG401;
const tool = context.window.TOOLS.l22zg401;
tool.bind();
function values(data) { for (const [id, value] of Object.entries(data)) element(id).value = String(value); }
function click(id) { element(id).handlers.click(); return context.window._L22_RESULT; }
function book(r) {
    const html = context.window.buildL22Book(r);
    assert.doesNotMatch(html, /undefined|NaN|Infinity/);
    assert.match(html, /已按用户提供的 L22ZG401 原文核对/);
    return html;
}
for (const [q, expected] of [[0, 0], [6, 0], [6.001, 1], [7, 1], [8, 2], [9, 3], [10, 4], [10.001, -1], [-1, -1], [NaN, -1], [Infinity, -1]]) {
    assert.equal(D.pickQLevel(q), expected);
}
assert.equal(D.findRow(D.TABLES[1000], 2000), null);
assert.equal(D.findRow(D.TABLES[1000], 9601), null);
assert.equal(D.findRow(D.TABLES[1000], 3500).row[0], 3600);
assert.equal(D.findRow(D.TABLES[1000], 3500).snapped, true);
assert.match(tool.render(), /印刷页码/);
assert.equal(D.findRow(D.TABLES[1000], 6300).row[1][0], 23, '原文第16页 q6 为23根');
assert.equal(D.tablePage(1000, 6300), 16);
assert.equal(D.tablePage(1700, 9600), 29);
assert.equal(D.tablePage(2100, 9600), 39);
for (const width of [1000, 1700, 2100]) {
    values({ l22_span: 3600, l22_width: width, l22_qlevel: 6 });
    const r = click('l22_sel_calc');
    assert.equal(r.width, width);
    assert.equal(r.totalH, 110);
    book(r);
}
values({ l22_width: 1100 });
assert.equal(click('l22_sel_calc'), null, '不按宽度比例生成图集板型');
values({ l22_gk: 2, l22_qk: 2, l22_gamma0: 1.1, l22_gammaG: 1.3, l22_gammaQ: 1.5, l22_self: 2.75, l22_extra: 0 });
let r = click('l22_load_calc');
assert.ok(Math.abs(r.qDesign - 6.5175) < 1e-10);
assert.equal(r.level, 1);
assert.match(book(r), /6\.518/);
// 原文第6页两个荷载算例：按例中自重输入，未把表列厚度差混入例中附加荷载。
values({ l22_gk: 1.5, l22_qk: 2.5, l22_gamma0: 1, l22_self: 3 });
r = click('l22_load_calc');
assert.ok(Math.abs(r.qDesign - 5.7) < 1e-10);
assert.equal(r.level, 0);
values({ l22_gamma0: 1.1 });
r = click('l22_load_calc');
assert.ok(Math.abs(r.qDesign - 6.66) < 1e-10); // 原图按1位小数写6.7
assert.equal(r.level, 1);
// 八.8(2)：增加10mm混凝土，新增自重0.25kN/m²；必须另计，不套原例的5.7。
values({ l22_extra: 0.25 });
r = click('l22_load_calc');
assert.ok(Math.abs(r.qDesign - 7.0175) < 1e-10);
assert.equal(r.level, 2);
// 按实际110mm表型计入120mm板厚增量，而非只复现原例的简化口径。
values({ l22_gamma0: 1, l22_self: 2.75 });
r = click('l22_load_calc');
assert.ok(Math.abs(r.qDesign - 6.025) < 1e-10);
assert.equal(r.level, 1);
values({ l22_gamma0: 1.1 });
r = click('l22_load_calc');
assert.ok(Math.abs(r.qDesign - 6.985) < 1e-10);
assert.equal(r.level, 1);
values({ l22_qk: 20 });
r = click('l22_load_calc');
assert.equal(r.outOfRange, true);
assert.match(book(r), /超出内置选用表范围/);
values({ l22_qk: '' });
assert.equal(click('l22_load_calc'), null);
assert.equal(element('l22_proc').innerHTML, '');
values({ l22_st_span: 3600, l22_st_width: 1700, l22_st_hc: 75, l22_st_L2: 3,
    l22_st_qQ1: 1.5, l22_st_gammaG: 1.3, l22_st_gammaQ: 1.5, l22_st_stage: 'st2' });
r = click('l22_st_calc');
// Independent arithmetic: g=25*0.110=2.75, qd=1.3*2.75+1.5*1.5=5.825.
assert.ok(Math.abs(r.M1 - 11.1403125) < 1e-10);
assert.match(book(r), /11\.140/);
assert.doesNotMatch(element('l22_st_result').innerHTML, /result-big pass/);
values({ l22_st_stage: 'st1' });
r = click('l22_st_calc');
book(r);
assert.match(element('l22_st_result').innerHTML, /弯矩标准值/);
element('f-l22-stage').handlers.input();
assert.equal(context.window._L22_RESULT, null);
values({ l22_st_stage: 'st2', l22_st_L2: 5 });
assert.equal(click('l22_st_calc'), null);
values({ l22_st_L2: 3 });
click('l22_st_calc');
click('l22_st_reset');
assert.equal(context.window._L22_RESULT, null);
assert.equal(element('l22_proc').innerHTML, '');
console.log('L22ZG401 calculation, validation and report checks passed (table values not certified).');
