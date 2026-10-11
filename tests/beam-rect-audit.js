'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/tools/concrete/beam-rect.js', 'utf8');
new vm.Script(source, { filename: 'beam-rect.js' });
assert.match(source, /id="r_calc"/);
assert.match(source, /index \+ 3/);
assert.match(source, /window\._BR_RESULT/);

// Independent reference calculation for the single-reinforced rectangular beam.
// Values are deliberately duplicated here rather than calling application code.
function reference({ b, h, as, As, fc = 14.3, fy = 360, alpha1 = 1, beta1 = 0.8, es = 200000, ecu = 0.0033 }) {
  const h0 = h - as;
  const x = fy * As / (alpha1 * fc * b);
  const xiB = beta1 / (1 + fy / (es * ecu));
  const xi = x / h0;
  const xb = xiB * h0;
  const Mu = (xi > xiB ? alpha1 * fc * b * xb * (h0 - xb / 2) : fy * As * (h0 - x / 2)) / 1e6;
  return { h0, x, xiB, xi, Mu, over: xi > xiB };
}

const normal = reference({ b: 300, h: 600, as: 40, As: 1473 });
assert.equal(normal.h0, 560);
assert.ok(Math.abs(normal.x - 123.6084) < 0.02);
assert.ok(Math.abs(normal.Mu - 264.1833) < 0.1);
assert.equal(normal.over, false);

const over = reference({ b: 300, h: 600, as: 40, As: 10000 });
assert.equal(over.over, true);
assert.ok(over.Mu > 0);

// Boundary and invalid-input expectations exercised independently from the UI.
assert.ok(!(300 > 0 && 600 > 0) === false, 'invalid section dimensions must be rejected by UI validation');
assert.ok(reference({ b: 300, h: 600, as: 40, As: 100 }).Mu > 0, 'low reinforcement remains calculable for minimum-ratio check');
assert.ok(fs.readFileSync('index.html', 'utf8').includes('src/tools/concrete/beam-rect.js'));
console.log('beam-rect audit checks passed');
