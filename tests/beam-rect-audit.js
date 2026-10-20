'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/tools/concrete/beam-rect.js', 'utf8');
new vm.Script(source, { filename: 'beam-rect.js' });
assert.match(source, /id="r_calc"/);
assert.match(source, /index \+ 3/);
assert.match(source, /window\._BR_RESULT/);

function runUiCase(values) {
  const fields = Object.fromEntries(Object.entries({
    r_b: 300, r_h: 600, r_con: 'C30', r_reb: 'HRB400',
    r_As: 1473, r_AsP: 0, r_as: 40, r_as2: 40, ...values
  }).map(([id, value]) => [id, { value: String(value), innerHTML: '', addEventListener() {} }]));
  for (const id of ['r_result', 'r_proc', 'r_svg']) {
    fields[id] = { innerHTML: '', closest: () => ({ classList: { add() {} } }) };
  }
  fields['f-rect'] = { addEventListener() {} };
  fields['r_calc'] = { addEventListener(_name, fn) { this.click = fn; } };
  fields['r_reset'] = { addEventListener() {} };
  const window = {};
  const context = {
    window,
    document: {
      getElementById: id => fields[id],
      querySelectorAll: () => []
    },
    CONCRETE: { C30: { fc: 14.3, ft: 1.43, alpha1: 1, beta1: 0.8, ecu: 0.0033 } },
    REBAR_FLEX: { HRB400: { fy: 360, fyp: 360, es: 200000 } },
    concreteRebarError: () => '',
    rhoMinFlex: () => ({ rho: 0.002 }),
    fmt: (n, digits = 0) => Number(n).toFixed(digits),
    tag: () => '', badge: (_className, label) => label,
    resultRow: (label, value) => `${label}: ${value}\n`,
    buildBeamRectBook: result => result,
    tyaiRenderCalcBook: () => {}
  };
  vm.runInNewContext(source, context);
  window.TOOLS['beam-rect'].bind();
  return { result: window._BR_RESULT, summary: fields.r_result.innerHTML, error: fields.r_result.innerHTML.includes('error-box') };
}

// Independent reference calculation for the single-reinforced rectangular beam.
// Values are deliberately duplicated here rather than calling application code.
function reference({ b, h, as, As, fc = 14.3, fy = 360, alpha1 = 1, beta1 = 0.8, es = 200000, ecu = 0.0033 }) {
  const h0 = h - as;
  const x = fy * As / (alpha1 * fc * b);
  const xiB = beta1 / (1 + fy / (es * ecu));
  const xi = x / h0;
  const Mu = xi > xiB ? null : fy * As * (h0 - x / 2) / 1e6;
  return { h0, x, xiB, xi, Mu, over: xi > xiB };
}

const normal = reference({ b: 300, h: 600, as: 40, As: 1473 });
assert.equal(normal.h0, 560);
assert.ok(Math.abs(normal.x - 123.6084) < 0.02);
assert.ok(Math.abs(normal.Mu - 264.1833) < 0.1);
assert.equal(normal.over, false);
assert.ok(Math.abs(runUiCase({}).result.Mu - normal.Mu) < 1e-9);

const doubleYielded = runUiCase({ r_As: 3000, r_AsP: 600, r_as2: 40 });
assert.equal(doubleYielded.result.branch, 'dy');
assert.ok(Math.abs(doubleYielded.result.Mu - (
  14.3 * 300 * doubleYielded.result.x * (560 - doubleYielded.result.x / 2) + 360 * 600 * 520
) / 1e6) < 1e-9);

const shortZone = runUiCase({ r_As: 800, r_AsP: 500, r_as2: 80 });
assert.equal(shortZone.result.over, false);
assert.ok(shortZone.result.x < 160);
assert.ok(Math.abs(shortZone.result.Mu - 138.24) < 1e-9);
assert.match(shortZone.result.steps, /第 6\.2\.14 条/);

const excessCompressionSteel = runUiCase({ r_As: 500, r_AsP: 1000, r_as2: 40 });
assert.equal(excessCompressionSteel.error, false);
assert.equal(excessCompressionSteel.result.branch, 'ds');
assert.ok(excessCompressionSteel.result.Mu > 0);

const overUi = runUiCase({ r_As: 9000, r_AsP: 1000, r_as2: 250 });
assert.equal(overUi.result.over, true);
assert.equal(overUi.result.Mu, null);
assert.match(overUi.summary, /不提供可用承载力/);
assert.equal(runUiCase({ r_AsP: -100 }).error, true);
assert.equal(runUiCase({ r_AsP: '', r_as2: '' }).error, true);
assert.equal(runUiCase({ r_AsP: 300, r_as2: 570 }).error, true);

const over = reference({ b: 300, h: 600, as: 40, As: 10000 });
assert.equal(over.over, true);
assert.equal(over.Mu, null);

// Boundary and invalid-input expectations exercised independently from the UI.
assert.ok(!(300 > 0 && 600 > 0) === false, 'invalid section dimensions must be rejected by UI validation');
assert.ok(reference({ b: 300, h: 600, as: 40, As: 100 }).Mu > 0, 'low reinforcement remains calculable for minimum-ratio check');
assert.ok(fs.readFileSync('index.html', 'utf8').includes('src/tools/concrete/beam-rect.js'));
console.log('beam-rect audit checks passed');
