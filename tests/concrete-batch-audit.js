'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['src/tools/concrete/beam-shear.js', 'src/tools/concrete/beam-t.js']) {
  const source = fs.readFileSync(file, 'utf8');
  new vm.Script(source, { filename: file });
  assert.match(source, /id="[st]_(calc|result)"/);
  assert.match(source, /第一步：设计依据/);
  assert.match(source, /第二步：输入条件/);
  assert.match(source, /规范依据|待核验/);
}

// Independent reference for beam shear, uniform-load branch (N and mm -> kN).
function shear({ b, h, as, V, Asv, s, fc = 14.3, ft = 1.43, fyv = 360 }) {
  const h0 = h - as;
  const vmax = 0.25 * fc * b * h0 / 1000;
  const vc = 0.7 * ft * b * h0 / 1000;
  const vs = 1.25 * fyv * Asv / s * h0 / 1000;
  return { h0, vmax, vc, vs, vu: vc + vs, sectionOk: V <= vmax, ok: V <= vc + vs };
}
const normal = shear({ b: 250, h: 600, as: 40, V: 250, Asv: 101, s: 150 });
assert.equal(normal.h0, 560);
assert.ok(Math.abs(normal.vmax - 500.5) < 1);
assert.ok(Math.abs(normal.vu - 309.82) < 0.2);
assert.equal(normal.ok, true);
const insufficient = shear({ b: 250, h: 600, as: 40, V: 700, Asv: 20, s: 200 });
assert.equal(insufficient.ok, false);
const sectionFail = shear({ b: 250, h: 600, as: 40, V: 2100, Asv: 101, s: 150 });
assert.equal(sectionFail.sectionOk, false);
console.log('beam shear and T-beam audit checks passed');
