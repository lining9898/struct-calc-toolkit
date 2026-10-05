/* ============================================================
 *  ui/ux.js — 交互与效率增强层
 * ------------------------------------------------------------
 *  在不改动任何计算模块的前提下，为工具箱补上日常高频操作：
 *    1. 全局命令面板（Ctrl/⌘ + K，或按 / 唤起）——跨全部模块检索，
 *       支持按工具名、说明、规范编号匹配，键盘上下选择、回车直达；
 *    2. 收藏与最近使用——localStorage 持久化，工具页一键收藏，
 *       首页顶部给出「最近使用 / 我的收藏」直达入口；
 *    3. 参数方案——把当前工具的全部输入存为命名方案，随时回填并重算；
 *    4. 打印当前结果（打印样式只保留工具页主体）。
 *  所有状态仅保存在本机浏览器，不上传任何数据。
 * ============================================================ */
(function () {
    'use strict';

    var LS_FAV = 'ux_favs_v1';
    var LS_RECENT = 'ux_recent_v1';
    var LS_PLANS = 'ux_plans_v1';
    var RECENT_MAX = 8;

    function read(k, d) {
        try { var v = JSON.parse(localStorage.getItem(k)); return (v === null || v === undefined) ? d : v; }
        catch (e) { return d; }
    }
    function write(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式下静默降级 */ }
    }
    function esc(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function toolTitle(id) {
        return (window.TOOLS && window.TOOLS[id] && window.TOOLS[id].title) ? window.TOOLS[id].title : id;
    }

    /* ===================== 1. 收藏 / 最近使用 ===================== */
    function favs() { return read(LS_FAV, []).filter(function (id) { return window.TOOLS && !!window.TOOLS[id]; }); }
    function isFav(id) { return favs().indexOf(id) > -1; }
    function toggleFav(id) {
        var a = favs(), i = a.indexOf(id);
        if (i > -1) a.splice(i, 1); else a.unshift(id);
        write(LS_FAV, a);
        return i === -1;
    }
    function recents() { return read(LS_RECENT, []).filter(function (id) { return window.TOOLS && !!window.TOOLS[id]; }); }
    function pushRecent(id) {
        if (!id) return;
        var a = recents().filter(function (x) { return x !== id; });
        a.unshift(id);
        write(LS_RECENT, a.slice(0, RECENT_MAX));
    }

    /* ===================== 2. 检索索引 ===================== */
    /* 从 NAV_GROUPS（九大专业分类）建立「工具 → 分类/子类」映射 */
    function categoryOf(id) {
        var groups = window.NAV_GROUPS || [];
        for (var i = 0; i < groups.length; i++) {
            var g = groups[i];
            if (g.tools) {
                for (var j = 0; j < g.tools.length; j++) if (g.tools[j].id === id) return g.title;
            }
            if (g.subgroups) {
                for (var k = 0; k < g.subgroups.length; k++) {
                    var sg = g.subgroups[k];
                    for (var m = 0; m < (sg.tools || []).length; m++) {
                        if (sg.tools[m].id === id) return g.title + ' / ' + sg.title;
                    }
                }
            }
        }
        // 未列入导航的工具回退到首页卡片文本
        return '';
    }

    var INDEX = null;
    function buildIndex() {
        if (INDEX) return INDEX;
        INDEX = [];
        var T = window.TOOLS || {};
        Object.keys(T).forEach(function (id) {
            var t = T[id] || {};
            var m = t.meta || {};
            INDEX.push({
                id: id,
                title: t.title || id,
                sub: t.sub || '',
                cat: categoryOf(id),
                std: m.standard || '',
                clause: m.formulaSource || '',
                limit: m.limitations || '',
                hay: [
                    t.title, t.sub, categoryOf(id), m.standard, m.formulaSource,
                    m.limitations, m.unit, id
                ].join(' ').toLowerCase()
            });
        });
        INDEX.sort(function (a, b) { return a.title.localeCompare(b.title, 'zh-Hans-CN'); });
        return INDEX;
    }

    function search(q) {
        var idx = buildIndex();
        q = (q || '').trim().toLowerCase();
        if (!q) return idx.filter(function (x) { return isFav(x.id) || recents().indexOf(x.id) > -1; }).slice(0, 12);
        var terms = q.split(/\s+/).filter(Boolean);
        var scored = [];
        idx.forEach(function (x) {
            var score = 0, ok = true;
            terms.forEach(function (tm) {
                var p = x.hay.indexOf(tm);
                if (p === -1) { ok = false; return; }
                score += 100 - Math.min(p, 99);
                if (x.title.toLowerCase().indexOf(tm) > -1) score += 60;
            });
            if (!ok) return;
            if (isFav(x.id)) score += 25;
            scored.push({ x: x, s: score });
        });
        scored.sort(function (a, b) { return b.s - a.s; });
        return scored.map(function (o) { return o.x; }).slice(0, 40);
    }

    /* ===================== 3. 命令面板 ===================== */
    var palEl = null, palInput = null, palList = null, palItems = [], palSel = 0;

    function ensurePalette() {
        if (palEl) return;
        palEl = document.createElement('div');
        palEl.className = 'ux-pal-mask';
        palEl.innerHTML =
            '<div class="ux-pal" role="dialog" aria-label="工具快速检索">' +
            '<div class="ux-pal-head">' +
            '<span class="ux-pal-icon">⌕</span>' +
            '<input type="text" id="uxPalInput" placeholder="搜索工具、构件、规范条文……例如：连续梁、裂缝、GB 50007、桩承台" autocomplete="off">' +
            '<span class="ux-pal-kbd">Esc</span>' +
            '</div>' +
            '<div class="ux-pal-list" id="uxPalList"></div>' +
            '<div class="ux-pal-foot">↑↓ 选择 · Enter 打开 · Ctrl/⌘+K 唤起 · 支持规范编号检索</div>' +
            '</div>';
        document.body.appendChild(palEl);
        palInput = palEl.querySelector('#uxPalInput');
        palList = palEl.querySelector('#uxPalList');

        palEl.addEventListener('mousedown', function (e) { if (e.target === palEl) closePalette(); });
        palInput.addEventListener('input', function () { renderPalette(palInput.value); });
        palInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); var it = palItems[palSel]; if (it) open(it.id); }
            else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
        });
        palList.addEventListener('click', function (e) {
            var row = e.target.closest ? e.target.closest('[data-tool]') : null;
            if (row) open(row.getAttribute('data-tool'));
        });
        palList.addEventListener('mousemove', function (e) {
            var row = e.target.closest ? e.target.closest('[data-tool]') : null;
            if (!row) return;
            var i = palItems.findIndex(function (x) { return x.id === row.getAttribute('data-tool'); });
            if (i > -1 && i !== palSel) { palSel = i; paintSel(); }
        });
    }

    function renderPalette(q) {
        palItems = search(q);
        if (!palItems.length) {
            palList.innerHTML = '<div class="ux-pal-empty">没有匹配的工具。可换用构件名称（如“梁”“基础”）或规范号（如“GB 50010”）检索。</div>';
            palSel = 0;
            return;
        }
        palList.innerHTML = palItems.map(function (x, i) {
            return '<div class="ux-pal-row' + (i === palSel ? ' sel' : '') + '" data-tool="' + esc(x.id) + '">' +
                '<div class="ux-pal-row-main"><span class="ux-pal-row-title">' + esc(x.title) + '</span>' +
                (isFav(x.id) ? '<span class="ux-pal-star">★</span>' : '') + '</div>' +
                '<div class="ux-pal-row-sub">' + esc(x.cat || '') + (x.std ? ' · ' + esc(x.std) : '') + (x.clause ? ' ' + esc(x.clause) : '') + '</div>' +
                '</div>';
        }).join('');
        if (palSel >= palItems.length) palSel = 0;
        paintSel();
    }

    function paintSel() {
        var rows = palList.querySelectorAll('.ux-pal-row');
        for (var i = 0; i < rows.length; i++) {
            var on = i === palSel;
            rows[i].classList.toggle('sel', on);
            if (on && rows[i].scrollIntoView) rows[i].scrollIntoView({ block: 'nearest' });
        }
    }
    function moveSel(d) {
        if (!palItems.length) return;
        palSel = (palSel + d + palItems.length) % palItems.length;
        paintSel();
    }
    function open(id) {
        closePalette();
        if (typeof window.goTool === 'function') window.goTool(id);
        else location.hash = '#/' + id;
    }
    function openPalette() {
        ensurePalette();
        palEl.classList.add('show');
        palSel = 0;
        palInput.value = '';
        renderPalette('');
        setTimeout(function () { palInput.focus(); }, 20);
    }
    function closePalette() { if (palEl) palEl.classList.remove('show'); }
    function paletteOpen() { return !!(palEl && palEl.classList.contains('show')); }

    /* ===================== 4. 参数方案 ===================== */
    function plansOf(id) { var all = read(LS_PLANS, {}); return all[id] || []; }
    function savePlan(id, name) {
        var fields = collectFields();
        if (!fields.length) { alert('当前页面没有可保存的输入项。'); return false; }
        var all = read(LS_PLANS, {});
        var list = all[id] || [];
        var rec = { name: name, at: new Date().toLocaleString(), values: fields };
        var i = list.findIndex(function (p) { return p.name === name; });
        if (i > -1) list[i] = rec; else list.push(rec);
        all[id] = list.slice(-20);
        write(LS_PLANS, all);
        return true;
    }
    function collectFields() {
        var view = document.getElementById('view');
        if (!view) return [];
        var out = [];
        var els = view.querySelectorAll('input[id], select[id], textarea[id]');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.type === 'submit' || el.type === 'button' || el.type === 'file') continue;
            if (el.type === 'checkbox' || el.type === 'radio') out.push({ id: el.id, v: el.checked ? 1 : 0, t: el.type });
            else out.push({ id: el.id, v: el.value, t: el.type || el.tagName.toLowerCase() });
        }
        return out;
    }
    function applyPlan(id, name) {
        var list = plansOf(id);
        var p = list.filter(function (x) { return x.name === name; })[0];
        if (!p) return;
        p.values.forEach(function (f) {
            var el = document.getElementById(f.id);
            if (!el) return;
            if (f.t === 'checkbox' || f.t === 'radio') el.checked = !!Number(f.v);
            else el.value = f.v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        runCalc();
    }
    function runCalc() {
        var view = document.getElementById('view');
        if (!view) return;
        var btns = view.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i], tx = (b.textContent || '').trim();
            if (b.classList.contains('btn-primary') || /^(开始计算|计算|复核|开始核算|生成计算书)$/.test(tx)) {
                b.click();
                return;
            }
        }
    }

    /* ===================== 5. 工具页动作条 ===================== */
    function ensureStyle() {
        if (document.getElementById('ux-style')) return;
        var css = document.createElement('style');
        css.id = 'ux-style';
        css.textContent = [
            /* 命令面板 */
            '.ux-pal-mask{position:fixed;inset:0;background:rgba(16,24,38,.42);backdrop-filter:blur(2px);z-index:9000;display:none;align-items:flex-start;justify-content:center;padding:10vh 16px 16px}',
            '.ux-pal-mask.show{display:flex}',
            '.ux-pal{width:100%;max-width:620px;background:var(--canvas,#fff);border:1px solid var(--hairline,#dfe3e9);border-radius:12px;box-shadow:0 24px 60px rgba(16,24,38,.22);overflow:hidden;display:flex;flex-direction:column;max-height:70vh}',
            '.ux-pal-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--hairline,#dfe3e9)}',
            '.ux-pal-icon{font-size:17px;color:var(--primary,#1e5aa8)}',
            '.ux-pal-head input{flex:1;border:0;outline:0;font-size:15px;background:transparent;color:var(--ink,#1a2230);font-family:inherit}',
            '.ux-pal-kbd{font-size:11px;color:var(--ink-mute,#6b7686);border:1px solid var(--hairline,#dfe3e9);border-radius:4px;padding:2px 6px}',
            '.ux-pal-list{overflow:auto;padding:6px}',
            '.ux-pal-row{padding:9px 12px;border-radius:8px;cursor:pointer}',
            '.ux-pal-row.sel{background:var(--primary-bg-subdued,#e0ecfa)}',
            '.ux-pal-row-main{display:flex;align-items:center;gap:8px}',
            '.ux-pal-row-title{font-size:14px;font-weight:600;color:var(--ink,#1a2230)}',
            '.ux-pal-star{color:#c8912b;font-size:12px}',
            '.ux-pal-row-sub{font-size:11.5px;color:var(--ink-mute,#6b7686);margin-top:3px;line-height:1.5}',
            '.ux-pal-empty{padding:22px 16px;font-size:13px;color:var(--ink-mute,#6b7686);text-align:center;line-height:1.8}',
            '.ux-pal-foot{padding:8px 14px;border-top:1px solid var(--hairline,#dfe3e9);font-size:11.5px;color:var(--ink-faint,#98a2b3);background:var(--canvas-soft,#f4f6f9)}',
            /* 工具页动作条 */
            '.ux-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px;padding:10px 12px;background:var(--canvas-soft,#f4f6f9);border:1px solid var(--hairline,#dfe3e9);border-radius:8px}',
            '.ux-bar-btn{font:inherit;font-size:12.5px;padding:6px 11px;border:1px solid var(--hairline-input,#c5ccd6);background:#fff;color:var(--ink-secondary,#3a4556);border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1.4}',
            '.ux-bar-btn:hover{border-color:var(--primary,#1e5aa8);color:var(--primary,#1e5aa8)}',
            '.ux-bar-btn.on{border-color:#c8912b;color:#8a6412;background:#fdf6e6}',
            '.ux-bar-btn.primary{background:var(--primary,#1e5aa8);border-color:var(--primary,#1e5aa8);color:#fff}',
            '.ux-bar-btn.primary:hover{background:var(--primary-deep,#154a8c);color:#fff}',
            '.ux-bar select{font:inherit;font-size:12.5px;padding:6px 8px;border:1px solid var(--hairline-input,#c5ccd6);border-radius:6px;background:#fff;color:var(--ink-secondary,#3a4556);max-width:220px}',
            '.ux-bar-spacer{flex:1}',
            '.ux-bar-hint{font-size:11.5px;color:var(--ink-faint,#98a2b3)}',
            /* 首页快捷块 */
            '.ux-home{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0 26px}',
            '.ux-home-card{background:var(--canvas,#fff);border:1px solid var(--hairline,#dfe3e9);border-radius:10px;padding:14px 16px}',
            '.ux-home-title{font-size:12.5px;font-weight:600;color:var(--ink-mute,#6b7686);letter-spacing:.4px;margin-bottom:10px;display:flex;align-items:center;gap:6px}',
            '.ux-home-list{display:flex;flex-wrap:wrap;gap:8px}',
            '.ux-chip{font-size:12.5px;padding:6px 11px;border-radius:9999px;border:1px solid var(--primary-line,#b8d0ec);background:var(--primary-bg-subdued,#e0ecfa);color:var(--primary-deep,#154a8c);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px;line-height:1.4}',
            '.ux-chip:hover{background:#d3e4f8}',
            '.ux-chip.fav{border-color:#e6cf9a;background:#fdf6e6;color:#8a6412}',
            '.ux-home-empty{font-size:12.5px;color:var(--ink-faint,#98a2b3);line-height:1.7}',
            /* 顶栏检索入口 */
            '.ux-topsearch{display:inline-flex;align-items:center;gap:6px;margin-left:auto;margin-right:10px;font-size:12.5px;color:var(--ink-mute,#6b7686);border:1px solid var(--hairline,#dfe3e9);background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;font-family:inherit}',
            '.ux-topsearch:hover{border-color:var(--primary,#1e5aa8);color:var(--primary,#1e5aa8)}',
            '@media (max-width:760px){.ux-home{grid-template-columns:1fr}.ux-bar-hint{display:none}}',
            /* 打印：只保留工具页主体 */
            '@media print{.sidebar,.mask,.topbar,.ux-bar,.ux-pal-mask,.tool-head,.tool-meta-bar,.sidebar-footer{display:none!important}.app{display:block}.main{padding:0}.main-inner{max-width:none}}'
        ].join('\n');
        document.head.appendChild(css);
    }

    function ensureTopSearch() {
        var bar = document.querySelector('.topbar');
        if (!bar || bar.querySelector('.ux-topsearch')) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ux-topsearch';
        b.innerHTML = '⌕ 检索工具 <span class="ux-pal-kbd">Ctrl K</span>';
        b.addEventListener('click', openPalette);
        bar.appendChild(b);
    }

    function buildToolBar(id) {
        var head = document.querySelector('#view .tool-head');
        if (!head) return;
        var bar = document.createElement('div');
        bar.className = 'ux-bar';
        bar.innerHTML =
            '<button type="button" class="ux-bar-btn" id="uxFav"></button>' +
            '<button type="button" class="ux-bar-btn primary" id="uxSavePlan">保存参数方案</button>' +
            '<select id="uxPlanSel" title="已保存的参数方案"></select>' +
            '<button type="button" class="ux-bar-btn" id="uxLoadPlan">载入</button>' +
            '<button type="button" class="ux-bar-btn" id="uxDelPlan">删除</button>' +
            '<span class="ux-bar-spacer"></span>' +
            '<button type="button" class="ux-bar-btn" id="uxExplain">结果解读与建议</button>' +
            '<button type="button" class="ux-bar-btn" id="uxWord">生成计算书（Word）</button>' +
            '<button type="button" class="ux-bar-btn" id="uxPrint">打印结果</button>';
        head.parentNode.insertBefore(bar, head.nextSibling);

        var favBtn = bar.querySelector('#uxFav');
        function paintFav() {
            var on = isFav(id);
            favBtn.classList.toggle('on', on);
            favBtn.innerHTML = (on ? '★ 已收藏' : '☆ 收藏此工具');
        }
        favBtn.addEventListener('click', function () { toggleFav(id); paintFav(); paintHomeStrips(); });
        paintFav();

        var sel = bar.querySelector('#uxPlanSel');
        function paintPlans() {
            var list = plansOf(id);
            sel.innerHTML = list.length
                ? '<option value="">选择已存方案（' + list.length + '）</option>' + list.map(function (p) {
                    return '<option value="' + esc(p.name) + '">' + esc(p.name) + '　' + esc(p.at) + '</option>';
                }).join('')
                : '<option value="">（暂无已存方案）</option>';
        }
        paintPlans();

        bar.querySelector('#uxSavePlan').addEventListener('click', function () {
            var d = new Date();
            var def = toolTitle(id) + ' ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
                ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
            var name = prompt('为当前参数方案命名：', def);
            if (name === null) return;
            name = String(name).trim();
            if (!name) { alert('方案名不能为空。'); return; }
            if (savePlan(id, name)) { paintPlans(); sel.value = name; }
        });
        bar.querySelector('#uxLoadPlan').addEventListener('click', function () {
            if (!sel.value) { alert('请先在下拉框中选择一个已保存的方案。'); return; }
            applyPlan(id, sel.value);
        });
        bar.querySelector('#uxDelPlan').addEventListener('click', function () {
            if (!sel.value) { alert('请先在下拉框中选择要删除的方案。'); return; }
            var all = read(LS_PLANS, {});
            all[id] = (all[id] || []).filter(function (p) { return p.name !== sel.value; });
            write(LS_PLANS, all);
            paintPlans();
        });
        bar.querySelector('#uxExplain').addEventListener('click', function () {
            if (window.RESULT_ADVISOR && window.RESULT_ADVISOR.openForCurrent) window.RESULT_ADVISOR.openForCurrent();
            else alert('结果解读模块未加载，请刷新页面后重试。');
        });
        bar.querySelector('#uxWord').addEventListener('click', function () {
            if (typeof window.exportBook === 'function') window.exportBook();
            else alert('计算书导出模块未加载，请刷新页面后重试。');
        });
        bar.querySelector('#uxPrint').addEventListener('click', function () { window.print(); });
    }

    /* ===================== 6. 首页快捷块 ===================== */
    function paintHomeStrips() {
        var host = document.getElementById('uxHomeStrips');
        if (!host) return;
        var rec = recents().filter(function (id) { return window.TOOLS && window.TOOLS[id]; });
        var fv = favs().filter(function (id) { return window.TOOLS && window.TOOLS[id]; });
        function chips(ids, cls, label, empty) {
            if (!ids.length) return '<div class="ux-home-empty">' + empty + '</div>';
            return ids.map(function (id) {
                return '<a class="ux-chip ' + cls + '" href="#/' + esc(id) + '">' + (cls === 'fav' ? '★ ' : '') + esc(toolTitle(id)) + '</a>';
            }).join('');
        }
        host.innerHTML =
            '<div class="ux-home-card"><div class="ux-home-title">◷ 最近使用</div><div class="ux-home-list">' +
            chips(rec, '', '最近', '还没有使用记录，打开任意工具后会出现在这里。') +
            '</div></div>' +
            '<div class="ux-home-card"><div class="ux-home-title">★ 我的收藏</div><div class="ux-home-list">' +
            chips(fv, 'fav', '收藏', '在工具页点击「☆ 收藏此工具」即可加入收藏。') +
            '</div></div>';
    }

    function onHomeRendered() {
        ensureStyle();
        ensureTopSearch();
        var view = document.getElementById('view');
        if (!view || document.getElementById('uxHomeStrips')) { paintHomeStrips(); return; }
        var host = document.createElement('div');
        host.className = 'ux-home';
        host.id = 'uxHomeStrips';
        var hero = view.querySelector('.home-hero');
        var section = view.querySelector('.tool-section');
        var anchor = hero ? hero.nextSibling : (section || null);
        if (anchor && anchor.parentNode === view) view.insertBefore(host, anchor);
        else view.appendChild(host);
        paintHomeStrips();
    }

    function onToolRendered(id) {
        ensureStyle();
        ensureTopSearch();
        pushRecent(id);
        buildToolBar(id);
    }

    /* ===================== 7. 全局快捷键 ===================== */
    document.addEventListener('keydown', function (e) {
        var tag = (e.target && e.target.tagName) || '';
        var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            if (paletteOpen()) closePalette(); else openPalette();
            return;
        }
        if (e.key === '/' && !typing && !paletteOpen()) {
            e.preventDefault();
            openPalette();
            return;
        }
        if (e.key === 'Escape' && paletteOpen()) closePalette();
    });

    window.UX = {
        favs: favs, isFav: isFav, toggleFav: toggleFav,
        recents: recents, pushRecent: pushRecent,
        openPalette: openPalette, closePalette: closePalette,
        search: search, buildIndex: buildIndex,
        plansOf: plansOf, savePlan: savePlan, applyPlan: applyPlan,
        onHomeRendered: onHomeRendered, onToolRendered: onToolRendered,
        runCalc: runCalc
    };

    console.log('[UI] ux.js loaded. 命令面板 / 收藏 / 最近使用 / 参数方案就绪。');
})();
