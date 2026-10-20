'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const map = JSON.parse(fs.readFileSync('audit/lizheng-module-map.json', 'utf8'));
const source = map.modules;
const currentToolIds = new Set([
  'beam-rect', 'beam-rect-design', 'beam-t', 'beam-shear', 'beam-cont',
  'slab-rect', 'stair-slab', 'column-axial', 'crack-width', 'deflection',
  'punching', 'deep-beam', 'corbel', 'bearing-local', 'addl-trans',
  'footing-col', 'footing-wall', 'bearing-cap', 'bearing-theory', 'settlement',
  'soft-underlayer', 'anti-uplift', 'rigid-found', 'pile-cap', 'pile-single',
  'pile-bearing', 'pile-bearing-55003', 'pile-horizontal', 'pile-settle',
  'steel-column', 'steel-beam', 'weld', 'bolt', 'anchor-bolt', 'mas-comp',
  'mas-local', 'lintel', 'cantilever', 'balcony', 'wall-beam', 'stage-check',
  'td-slab', 'aac-wall', 'anchor', 'l22zg401', 'basement-wall', 'shear-wall',
  'pool-rect', 'pool-circ', 'retain-cant', 'retain-butt', 'embed-plate',
  'rebar-area', 'rebar-pick', 'rho-min', 'col-tie', 'seismic', 'seismic-perf',
  'masonry-seismic', 'joint-core', 'steel-seismic', 'isolation', 'load-combo',
  'crane-load', 'temp-action', 'floor-live', 'wind-snow'
]);

assert.equal(new Set(source.map(item => item.tool)).size, source.length);
assert.deepEqual(new Set(source.map(item => item.tool)), currentToolIds);
for (const item of source) {
  assert.match(item.tool, /^[a-z0-9-]+$/);
  assert.match(item.lizheng, /^[A-Z0-9_]+$/);
  assert.ok(['direct', 'partial', 'none'].includes(item.status));
  assert.ok(Array.isArray(item.methods) && item.methods.length > 0);
}

const directOrPartial = source.filter(item => item.status !== 'none').length;
assert.ok(directOrPartial >= 50);
console.log(`理正模块对照台账通过：${source.length} 个当前工具，${directOrPartial} 个存在主题或部分对应`);
