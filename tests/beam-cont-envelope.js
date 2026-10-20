'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const values = {
  cb_n: 3, cb_b: 250, cb_h: 600, cb_as: 40,
  cb_con: 'C30', cb_reb: 'HRB400', cb_stir: 'HRB400',
  cb_gG: 1.3, cb_gQ: 1.5
};
for (let i = 0; i < 3; i++) {
  values[`cb_L${i}`] = i === 1 ? 5 : 4.5;
  values[`cb_g${i}`] = 12;
  values[`cb_q${i}`] = 8;
}
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      value: values[id] ?? '', innerHTML: '',
      addEventListener() {}, closest() { return null; }, reset() {}
    });
  }
  return elements.get(id);
}
const context = {
  window: { TOOLS: {} },
  document: { getElementById: element, querySelectorAll() { return []; } },
  CONCRETE: { C30: { fc: 14.3, ft: 1.43, alpha1: 1, beta1: 0.8, ecu: 0.0033 } },
  REBAR_FLEX: { HRB400: { fy: 360, es: 200000 } },
  REBAR_STIRRUP: { HRB400: { fy: 360 } },
  concreteRebarError() { return ''; },
  rhoMinFlex() { return { rho: 0.002 }; },
  fmt(value, digits) { return Number(value).toFixed(digits); },
  badge(_kind, label) { return label; },
  tag(_kind, label) { return label; }
};
vm.runInNewContext(fs.readFileSync('src/tools/concrete/beam-cont.js', 'utf8'), context);
context.window.TOOLS['beam-cont'].bind();

const result = context.window._CB_RESULT;
assert.equal(result.cases.length, 8);
assert.equal(result.supEnvelope[1].minCase.mask, 3);
assert.equal(result.supEnvelope[2].minCase.mask, 6);
assert.equal(result.spanEnvelope[0].posCase.mask, 5);
assert.equal(result.spanEnvelope[1].posCase.mask, 2);
assert.equal(result.shearEnvelope.length, 3);
for (const item of result.shearEnvelope) {
  assert.ok(item.maxCase, '每跨都应有剪力控制工况');
  assert.equal(item.max, Math.max(item.left, item.right));
}
assert.ok(!element('cb_sup').innerHTML.includes('undefined'));
assert.ok(!element('cb_sh').innerHTML.includes('undefined'));
console.log('beam-cont envelope checks passed');
