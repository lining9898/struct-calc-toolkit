'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const timers = new Map();
let nextTimer = 0;
const renders = [];
const element = { classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} };
const context = {
    console, location: { hash: '#/' },
    document: { getElementById() { return element; }, querySelectorAll() { return []; }, addEventListener() {} },
    window: { addEventListener() {} },
    TOOLS: { beam: {}, column: {} },
    renderHome() { renders.push('home'); },
    setInterval(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/core/router.js', 'utf8'), context);
context.renderTool = function (id) { context.CUR_TOOL = id; context.window.CUR_TOOL = id; renders.push(id); };
function tick(count = 1) { for (let i = 0; i < count; i++) for (const fn of [...timers.values()]) fn(); }

context.goTool('beam');
context.route(); // 浏览器随后的 hashchange
assert.deepEqual(renders, ['beam'], '一次导航只初始化一次');
context.goTool('late');
assert.equal(timers.size, 1);
context.goTool('column');
context.TOOLS.late = {};
tick(25);
assert.deepEqual(renders, ['beam', 'column'], '旧路由不能覆盖新工具');
assert.equal(timers.size, 0);
context.goTool('');
assert.equal(context.CUR_TOOL, null);
assert.equal(context.window.CUR_TOOL, null);
context.goTool('column');
assert.equal(renders.at(-1), 'column', '从首页重新打开同一工具');
context.goTool('delayed');
tick(5);
context.TOOLS.delayed = {};
tick();
assert.equal(renders.at(-1), 'delayed');
assert.equal(timers.size, 0);
context.goTool('missing');
tick(19);
assert.equal(renders.at(-1), 'delayed');
tick();
assert.equal(renders.at(-1), 'home');
assert.equal(context.CUR_TOOL, null);
assert.equal(timers.size, 0);
console.log('Router regression checks passed.');
