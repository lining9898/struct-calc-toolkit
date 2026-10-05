/* ============================================================
 *  core/router.js — 路由与工具渲染
 * ------------------------------------------------------------
 *  hash 路由解析（parseHash / route / goTool）、导航高亮、
 *  工具页渲染（renderTool / toolHeader / iconFor）、
 *  侧栏开合与详细过程面板折叠。
 *  不依赖任何工程公式，仅负责视图切换。
 * ============================================================ */
/* ===================== 路由 ===================== */
var view = document.getElementById('view');
var sidebar = document.getElementById('sidebar');
var mask = document.getElementById('mask');
var burgerBtn = document.getElementById('burgerBtn');
function closeSidebar() { sidebar.classList.remove('open'); mask.classList.remove('show'); }
burgerBtn.addEventListener('click', function () { sidebar.classList.add('open'); mask.classList.add('show'); });
mask.addEventListener('click', closeSidebar);

function parseHash() {
    var h = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
    return h;
}
function navActive(id) {
    var links = document.querySelectorAll('.sidebar a.nav');
    for (var i = 0; i < links.length; i++) {
        links[i].classList.toggle('active', links[i].getAttribute('data-nav') === id);
    }
}
function iconFor(id, s) {
     var svgs = {
         'beam-rect': '<rect x="2" y="6" width="20" height="12" rx="1.5"/><path d="M6 12h3M11 12h3M16 12h2"/>',
         'beam-t': '<path d="M2 4h20v5H2z"/><path d="M7 9v11h10V9"/>',
         'beam-shear': '<path d="M3 7h18M3 17h18M6 4l-3 3 3 3M18 14l3 3-3 3"/>',
         'beam-cont': '<path d="M3 16h18M3 12h18M5 16v-4M9 16v-4M13 16v-4M17 16v-4M21 16v-4"/>',
         'column-axial': '<path d="M9 2h6M8 2v20M6 22h12M16 2v20"/><path d="M10 6h4M10 18h4"/>',
         'rebar-area': '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>',
         'rho-min': '<path d="M7 2v7a4 4 0 0 0 8 0V2M11 13v9M6 22h10"/><circle cx="18" cy="18" r="3" fill="none"/>',
         'aac-wall': '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v6M15 3v6M9 15v6M15 15v6"/>',
         'anchor': '<circle cx="12" cy="5" r="2"/><path d="M12 7v12M5 12H3a9 9 0 0 0 18 0h-2"/>',
         'slab-rect': '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9h18M3 15h18M9 5v14M15 5v14"/>',
         'stair-slab': '<path d="M4 20V6l8-3v14"/><path d="M12 17h8v3"/><path d="M12 11h5v3"/><path d="M12 5h2v3"/>',
         'footing-col': '<rect x="8" y="3" width="8" height="8" rx="1"/><path d="M4 20h16v-3H4z"/><path d="M8 11v6M16 11v6"/>',
         'footing-wall': '<rect x="9" y="3" width="6" height="10"/><path d="M4 20h16v-3H4z"/><path d="M9 13v4M15 13v4"/>',
         'crack-width': '<path d="M12 2v4M12 10v3M12 17v5"/><path d="M8 6l8 2M8 14l8-2" stroke-dasharray="2 3"/>',
         'deflection': '<path d="M3 8h18M12 8v10"/><path d="M6 18c2 0 3-4 6-4s4 4 6 4"/>',
         'punching': '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M9 7V4h6v3"/><path d="M9 17v3h6v-3"/>',
         'bearing-local': '<rect x="4" y="6" width="16" height="12" rx="1"/><rect x="8" y="9" width="8" height="6" rx="1"/><path d="M12 3v3M12 18v3"/>',
         'corbel': '<path d="M6 3v18"/><path d="M6 8h8l4 5v5H6z"/><path d="M14 8v3" stroke-dasharray="2 2"/>',
         'deep-beam': '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M8 4v16M16 4v16"/><path d="M3 12h18" stroke-dasharray="2 3"/>',
         'addl-trans': '<path d="M4 18h16M8 18V9M16 18V9"/><path d="M5 9h14"/><path d="M8 5v4M16 5v4"/><circle cx="12" cy="12" r="2"/>',
         'mas-comp': '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 9h16M4 15h16M8 3v6M16 3v6M8 15v6M16 15v6"/>',
         'mas-local': '<rect x="4" y="6" width="16" height="14" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><path d="M4 11h16M4 16h16M8 6v5M16 6v5"/>',
         'lintel': '<rect x="4" y="6" width="16" height="14" rx="1"/><path d="M7 12h10v4H7z"/><path d="M4 9h16M4 16h16M8 6v3M16 6v3"/>',
         'cantilever': '<path d="M3 10h18l-5 8H8z"/><path d="M3 10v11M21 10v11"/><path d="M8 18v3M16 18v3"/>',
         'balcony': '<path d="M2 14h12v6H2z"/><path d="M14 17h6l2-3-2-3h-6"/><path d="M2 18h12"/>',
         'wall-beam': '<rect x="3" y="3" width="18" height="14" rx="1"/><path d="M3 8h18M3 13h18M7 3v5M17 3v5"/><rect x="2" y="17" width="20" height="4" rx="1"/>',
         'bearing-cap': '<rect x="5" y="14" width="14" height="6" rx="1"/><path d="M3 14h18M8 8h8v6H8z"/><path d="M12 2v6"/>',
         'settlement': '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 10h16M4 16h16M8 4v6M16 4v6"/><path d="M12 16v4" stroke-dasharray="2 2"/><path d="M10 20h4"/>',
         'rigid-found': '<path d="M3 20h18l-4-6H7z"/><rect x="9" y="8" width="6" height="6"/><path d="M12 3v5"/>',
         'pile-cap': '<rect x="3" y="5" width="18" height="4" rx="1"/><path d="M7 9v10M12 9v10M17 9v10"/><path d="M5 19h14" stroke-dasharray="2 2"/>',
         'pile-single': '<circle cx="12" cy="4" r="2"/><path d="M10 6v12l-2-2"/><path d="M14 6v12l2-2"/><path d="M12 18v4"/>',
         'pile-bearing': '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M6 8v9M12 8v9M18 8v9"/><path d="M4 17h16" stroke-dasharray="2 2"/>',
         'pile-horizontal': '<circle cx="12" cy="4" r="2"/><path d="M12 6v14"/><path d="M12 9L6 9" stroke-dasharray="2 2"/><path d="M12 13L4 13" stroke-dasharray="2 2"/><path d="M12 17L3 17" stroke-dasharray="2 2"/>',
         'pile-settle': '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M7 8v6M17 8v6"/><path d="M5 14h14"/><path d="M12 14v6" stroke-dasharray="2 2"/><path d="M10 20h4"/>',
         'steel-column': '<path d="M4 4h16v2H4z"/><path d="M4 18h16v2H4z"/><path d="M10 6v12M14 6v12"/>',
         'weld': '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M12 4v16"/><path d="M4 8l8 4 8-4"/>',
         'bolt': '<circle cx="12" cy="6" r="3"/><path d="M10 9v8l-2 1"/><path d="M14 9v8l2 1"/><path d="M8 18h8"/>',
         'anchor-bolt': '<rect x="3" y="5" width="18" height="4" rx="1"/><path d="M7 9v9M12 9v9M17 9v9"/><path d="M5 18h14" stroke-dasharray="2 2"/><path d="M9 3v2M15 3v2"/>',
         'steel-beam': '<path d="M3 7h18v2H3z"/><path d="M3 15h18v2H3z"/><path d="M11 7v8M13 7v8"/><path d="M5 11h14" stroke-dasharray="2 2"/>',
         'basement-wall': '<path d="M4 20V6h16v14"/><path d="M4 20h16"/><path d="M7 8v8M11 8v8M15 8v8M19 8v8"/>',
         'shear-wall': '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="16" y="3" width="5" height="18" rx="1"/><path d="M8 7h8M8 12h8M8 17h8"/>',
         'pool-rect': '<rect x="4" y="8" width="16" height="12" rx="1"/><path d="M4 12h16" stroke-dasharray="2 2"/><path d="M7 10v4M12 10v4M17 10v4"/>',
         'pool-circ': '<ellipse cx="12" cy="17" rx="8" ry="4"/><path d="M4 17V9a8 4 0 0 1 16 0v8"/><path d="M4 13a8 4 0 0 1 16 0" stroke-dasharray="2 2"/>',
         'retain-cant': '<path d="M5 18V6l5 2v10z"/><path d="M3 18h18v3H3z"/>',
         'retain-butt': '<path d="M4 20v-8h5l-2 8z"/><path d="M15 20V4h6v16z"/><path d="M2 20h20v3H2z"/>',
         'embed-plate': '<rect x="4" y="6" width="16" height="12" rx="1"/><line x1="8" y1="9" x2="8" y2="15"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="16" y1="9" x2="16" y2="15"/><path d="M6 18v2M12 18v2M18 18v2"/>',
         'col-tie': '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M5 8h14M5 14h14M5 20h14"/>',
         'seismic': '<circle cx="12" cy="12" r="9" stroke-dasharray="2 4"/><path d="M12 3v4M12 10v3M12 16v5"/>',
         'wind-snow': '<path d="M3 9h10a3 3 0 1 0-3-3"/><path d="M3 14h14a3 3 0 1 1-3 3"/>',
         'ref': '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
         'load-combo': '<path d="M3 4h7v7H3zM14 4h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/><path d="M10 7.5h4M7.5 10v4"/>',
         'crane-load': '<path d="M3 6h18M6 6v12M18 6v12M9 18h6M12 6v6"/><circle cx="12" cy="9" r="1.5"/>',
         'temp-action': '<path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z"/><path d="M14 13.5a4 4 0 1 0-4 0"/>',
         'floor-live': '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M3 9h18M3 14h18M9 4v14M15 4v14"/>'
      };
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (svgs[id] || '') + '</svg>';
}

function toolHeader(t, sub) {
    return '<div class="tool-mesh"></div><div class="tool-head"><a class="back" href="#/" aria-label="返回首页"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></a><div><h2>' + t + '</h2><div class="sub">' + sub + '</div></div>' +
        '<button type="button" class="btn-export" id="btn-export">导出计算书（Word）</button></div>';
}

function renderTool(id) {
    CUR_TOOL = id;
    window.CUR_TOOL = id;
    var t = TOOLS[id];
    var metaHtml = '';
    if (t.meta) {
        var m = t.meta;
        metaHtml = '<div class="tool-meta-bar" style="margin:24px 0 0;padding:14px 18px;background:var(--canvas-soft);border-radius:8px;border:1px solid var(--border);font-size:12.5px;color:var(--ink-soft);line-height:1.8;">';
        metaHtml += '<div style="font-weight:600;color:var(--ink);margin-bottom:6px;font-size:13px;">📋 工具审核信息</div>';
        if (m.standard) metaHtml += '<div><b>规范依据：</b>' + m.standard + (m.formulaSource ? '（第 ' + m.formulaSource + ' 条）' : '') + '</div>';
        if (m.limitations) metaHtml += '<div><b>适用范围：</b>' + m.limitations + '</div>';
        if (m.unit) metaHtml += '<div><b>关键单位：</b>' + m.unit + '</div>';
        if (m.version) metaHtml += '<div><b>工具版本：</b>v' + m.version + '</div>';
        metaHtml += '</div>';
    }
    view.innerHTML = toolHeader(t.title, t.sub) + t.render() + metaHtml;
    if (t.bind) t.bind();
    else if (t.onReady) t.onReady();
    navActive(id);
    closeSidebar();
    var be = document.getElementById('btn-export');
    if (be) be.addEventListener('click', exportBook);
    // 交互增强层：收藏 / 参数方案 / 最近使用（ui/ux.js）
    if (window.UX && window.UX.onToolRendered) window.UX.onToolRendered(id);
}
// 暴露到全局，供 AI 助手等外部模块调用
window.renderTool = renderTool;

    // 折叠面板切换（兼容移动端，替代 details/summary）
function toggleProc(wrap) {
    if (!wrap) return;
    wrap.classList.toggle('open');
}
// 全局事件委托：点击 .proc-head 切换面板
document.addEventListener('click', function (e) {
    if (e.target.closest('button, a, input, select, textarea')) return;
    var head = e.target.closest('.proc-head');
    if (head) {
        var wrap = head.closest('.proc-wrap');
        toggleProc(wrap);
        e.preventDefault();
    }
});
// 同样支持 touchend，避免移动端 click 延迟
document.addEventListener('touchend', function (e) {
    if (e.target.closest('button, a, input, select, textarea')) return;
    var head = e.target.closest('.proc-head');
    if (head) {
        var wrap = head.closest('.proc-wrap');
        toggleProc(wrap);
        e.preventDefault();
    }
}, { passive: false });

 function route() {
    var id = parseHash();
    if (!id) { renderHome(); return; }
    if (TOOLS[id]) { renderTool(id); return; }
    // 工具可能在稍后加载的外部脚本中注册（如 l22zg401），最多等待 2 秒
    var waited = 0;
    var timer = setInterval(function () {
        if (TOOLS[id]) {
            clearInterval(timer);
            renderTool(id);
        } else if (waited >= 2000) {
            clearInterval(timer);
            renderHome();
        }
        waited += 100;
    }, 100);
}
window.addEventListener('hashchange', route);
/* 点击兜底：部分预览 iframe 会拦截 <a href="#/..."> 的默认 hash 跳转，
   此处用事件委托在点击导航 / 首页卡片时直接渲染，不依赖 hashchange 事件 */
function goTool(id) {
    try { if (location.hash !== '#/' + id) location.hash = '#/' + id; } catch (e) {}
    if (!id) { renderHome(); return; }
    if (TOOLS[id]) { renderTool(id); return; }
    // 工具可能在稍后加载的外部脚本中注册，最多等待 2 秒
    var waited = 0;
    var timer = setInterval(function () {
        if (TOOLS[id]) {
            clearInterval(timer);
            renderTool(id);
        } else if (waited >= 2000) {
            clearInterval(timer);
            renderHome();
        }
        waited += 100;
    }, 100);
}
document.addEventListener('click', function (e) {
    var el = e.target;
    var card = el && el.closest ? el.closest('.nav, .tool-card') : null;
    if (!card) return;
    var href = card.getAttribute('href') || '';
    var id = href.replace(/^#\/?/, '').replace(/\/+$/, '');
    e.preventDefault();
    goTool(id);
});

var CUR_TOOL = null;
window.CUR_TOOL = null; // 暴露到全局，供 AI 助手读取

console.log('[Core] router.js loaded. 路由就绪。');
