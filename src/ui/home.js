/* ============================================================
 *  ui/home.js — 首页与首页增强
 * ------------------------------------------------------------
 *  renderHome()：首页 Hero、分组工具卡片、统计数字；
 *  首页增强：移动端顶栏、工具快速查找、常用入口、卡片键盘可达性。
 * ============================================================ */
function renderHome() {
    var html = '';

    // 动态统计工具数量
    var totalToolIds = Object.keys(window.TOOLS || {}).length;
    var hasCalcAssistant = window.TOOLS && window.TOOLS['calc-assistant'];
    var hasLocalQA = window.TOOLS && window.TOOLS['local-qa'];
    var nonCalcCount = (hasCalcAssistant ? 1 : 0) + (hasLocalQA ? 1 : 0);
    var calcToolCount = totalToolIds - nonCalcCount;
    var aiCount = nonCalcCount;

    // 首页与侧栏共用一套分类，标题采用工具注册表中的正式名称。
    var groups = (window.NAV_GROUPS || []).map(function (g) {
        return {
            key: g.id, name: g.title, icon: g.icon || 'ref',
            tools: (g.tools || []).filter(function (entry) { return !!window.TOOLS[entry.id]; }).map(function (entry) {
                var tool = window.TOOLS[entry.id];
                return { id: entry.id, t: tool.title || entry.title, d: tool.sub || '',
                    code: tool.meta && tool.meta.formulaSource ? tool.meta.formulaSource : '' };
            })
        };
    }).filter(function (g) { return g.tools.length; });

    // Hero 区
    html += '<div class="home-hero">' +
        '<div class="hero-mesh"><svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
                '<radialGradient id="g1" cx="15%" cy="60%" r="45%"><stop offset="0%" stop-color="#f96bee" stop-opacity="0.55"/><stop offset="100%" stop-color="#f96bee" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g2" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="#533afd" stop-opacity="0.50"/><stop offset="100%" stop-color="#533afd" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g3" cx="85%" cy="55%" r="40%"><stop offset="0%" stop-color="#ea2261" stop-opacity="0.45"/><stop offset="100%" stop-color="#ea2261" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g4" cx="30%" cy="20%" r="35%"><stop offset="0%" stop-color="#f5e9d4" stop-opacity="0.70"/><stop offset="100%" stop-color="#f5e9d4" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g5" cx="70%" cy="80%" r="45%"><stop offset="0%" stop-color="#b9b9f9" stop-opacity="0.50"/><stop offset="100%" stop-color="#b9b9f9" stop-opacity="0"/></radialGradient>' +
                '<radialGradient id="g6" cx="95%" cy="25%" r="30%"><stop offset="0%" stop-color="#f5e9d4" stop-opacity="0.40"/><stop offset="100%" stop-color="#f5e9d4" stop-opacity="0"/></radialGradient>' +
            '</defs>' +
            '<rect width="1200" height="220" fill="#f6f9fc"/>' +
            '<ellipse cx="180" cy="132" rx="280" ry="120" fill="url(#g1)"/>' +
            '<ellipse cx="600" cy="88" rx="420" ry="110" fill="url(#g2)"/>' +
            '<ellipse cx="1020" cy="121" rx="320" ry="130" fill="url(#g3)"/>' +
            '<ellipse cx="360" cy="44" rx="240" ry="80" fill="url(#g4)"/>' +
            '<ellipse cx="840" cy="176" rx="380" ry="90" fill="url(#g5)"/>' +
            '<ellipse cx="1140" cy="55" rx="200" ry="70" fill="url(#g6)"/>' +
        '</svg></div>' +
        '<div class="hero-content">' +
        '<span class="eyebrow">Structural Toolkit</span>' +
        '<h1>计算工具箱</h1>' +
        '<p class="subtitle">结构工程常用计算与验算，覆盖混凝土、地基基础、桩基、钢结构等 ' + calcToolCount + ' 个模块，附完整计算过程与规范依据。</p>' +
        '<div class="home-stats">' +
            '<div class="stat"><span class="num">' + calcToolCount + '</span><span class="lbl">个专业计算工具</span></div>' +
            '<div class="stat"><span class="num">' + groups.length + '</span><span class="lbl">专业分组</span></div>' +
            (aiCount > 0 ? '<div class="stat"><span class="num">' + aiCount + '</span><span class="lbl">个 AI 助手</span></div>' : '') +
            '<div class="stat"><span class="num">10+</span><span class="lbl">规范依据</span></div>' +
            '<div class="stat"><span class="num">Word</span><span class="lbl">计算书导出</span></div>' +
        '</div>' +
        '<div class="quick-entry">' +
            '<a href="#/calc-assistant" class="assistant-entry">' + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> 智能计算助手</a>' +
            '<a href="#/beam-cont">' + iconFor('beam-rect', 16) + ' 连续梁计算</a>' +
            '<a href="#/footing-col" class="secondary">' + iconFor('footing-col', 16) + ' 柱下独立基础</a>' +
            '<a href="#/stage-check" class="secondary">' + iconFor('slab-rect', 16) + ' 叠合构件验算</a>' +
        '</div>' +
        '</div>' +
    '</div>';



    // 渲染分组
    groups.forEach(function (g, index) {
        html += '<details class="tool-section sec-' + g.key + '">' +
            '<summary class="tool-section-head">' +
                '<span class="sec-title">' +
                    '<span class="sec-icon">' + iconFor(g.icon, 18) + '</span>' +
                    g.name +
                '</span>' +
                '<span class="sec-count">' + g.tools.length + ' 个工具</span>' +
                '</summary>' +
            '<div class="section-grid">';
        g.tools.forEach(function (t) {
            html += '<a class="section-card" href="#/' + t.id + '">' +
                '<div class="card-top">' +
                    '<div class="card-icon">' + iconFor(g.icon, 18) + '</div>' +
                    '<h3>' + t.t + '</h3>' +
                '</div>' +
                '<p class="card-description">' + t.d + '</p>' +
                '<div class="card-foot">' +
                    '<span class="code-tag">' + t.code + '</span>' +
                    '<span class="go-arrow">打开工具</span>' +
                '</div>' +
            '</a>';
        });
        html += '</div></details>';
    });

    // 底部说明 — 暖奶油色带
    html += '<div class="home-footer cream-band">' +
        '<h4>规范依据</h4>' +
        '<div>本工具箱计算均依据现行国家规范与行业标准，所有结果均附带详细计算过程，便于校核与追溯。</div>' +
        '<div class="norms">' +
            '<span>GB/T 50010-2010（2024年版）混凝土结构设计标准</span>' +
            '<span>GB 50003-2011 砌体结构设计规范</span>' +
            '<span>GB 50007-2011 建筑地基基础设计规范</span>' +
            '<span>GB 50009-2012 建筑结构荷载规范</span>' +
            '<span>GB/T 50011-2010（2024年版）建筑抗震设计标准</span>' +
            '<span>GB 50017-2017 钢结构设计标准</span>' +
            '<span>JGJ 94-2008 建筑桩基技术规范</span>' +
            '<span>JGJ 1-2014 装配式混凝土结构技术规程</span>' +
            '<span>JGJ/T 17-2020 蒸压加气混凝土制品应用技术标准</span>' +
            '<span>GB 50666-2011 混凝土结构工程施工规范</span>' +
            '<span>GB 50069-2002 给水排水工程构筑物结构设计规范</span>' +
        '</div>' +
        '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">' +
            '<b style="color:#0f172a;">免责声明：</b>本工具箱用于学习与设计初算验证。实际工程应结合抗震要求、构造规定、钢筋实配直径与保护层等综合设计，重要构件请以专业计算软件或设计院复核为准。' +
        '</div>' +
    '</div>';

    view.innerHTML = html;
    navActive('home');
    closeSidebar();
    // 交互增强层：最近使用 / 我的收藏 快捷块（ui/ux.js）
    if (window.UX && window.UX.onHomeRendered) window.UX.onHomeRendered();
    if (window.enhanceHomeUI) window.enhanceHomeUI();
}


/* ===== TYAI 增强：搜索、快捷入口、移动端优化 ===== */
(function () {
    window.enhanceHomeUI = function () {
        enhanceHomeSearch();
        enhanceCards();
    };
    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }
    ready(function () {
        enhanceMobileNav();
        window.enhanceHomeUI();
    });
    function enhanceMobileNav() {
        if (!document.querySelector('.topbar')) {
            var topbar = document.createElement('div');
            topbar.className = 'topbar';
            topbar.innerHTML = `
                <button class="menu-btn" type="button" aria-label="打开导航">☰</button>
                <div class="mobile-brand">计算工具箱</div>
                <span style="width:36px"></span>
            `;
            document.body.insertBefore(topbar, document.body.firstChild);
        }
        if (!document.querySelector('.mask')) {
            var mask = document.createElement('div');
            mask.className = 'mask';
            document.body.appendChild(mask);
        }
        var menuBtn = document.querySelector('.menu-btn');
        var maskEl = document.querySelector('.mask');
        if (menuBtn) {
            menuBtn.addEventListener('click', function () {
                document.body.classList.add('sidebar-open');
            });
        }
        if (maskEl) {
            maskEl.addEventListener('click', function () {
                document.body.classList.remove('sidebar-open');
            });
        }
        document.querySelectorAll('.sidebar a').forEach(function (a) {
            a.addEventListener('click', function () {
                document.body.classList.remove('sidebar-open');
            });
        });
    }
    function enhanceHomeSearch() {
        var firstSection = document.querySelector('.tool-section');
        var hero = document.querySelector('.home-hero');
        if (!firstSection || document.querySelector('.tyai-home-tools')) return;
        var toolsPanel = document.createElement('div');
        toolsPanel.className = 'tyai-home-tools';
        toolsPanel.innerHTML = `
            <div class="tyai-search-panel">
                <div class="tyai-search-title">快速查找工具</div>
                <div class="tyai-search-box">
                    <input id="tyaiToolSearch" type="search" placeholder="输入关键词，例如：连续梁、裂缝、柱下独立基础、钢筋桁架楼板">
                    <span class="tyai-search-icon">⌕</span>
                </div>
                <div class="tyai-search-hint">按名称或规范编号筛选。按 / 或 Ctrl/⌘+K 打开全局检索。</div>
            </div>
            <div class="tyai-fav-panel">
                <div class="tyai-fav-title">常用入口</div>
                <div class="tyai-fav-list" id="tyaiFavList"></div>
            </div>
        `;
        if (hero && hero.parentNode) {
            hero.parentNode.insertBefore(toolsPanel, hero.nextSibling);
        } else {
            firstSection.parentNode.insertBefore(toolsPanel, firstSection);
        }
        var noResult = document.createElement('div');
        noResult.className = 'tyai-no-result';
        noResult.textContent = '未找到匹配工具，请尝试更换关键词。';
        firstSection.parentNode.insertBefore(noResult, firstSection);
        buildFavList();
        bindSearch(noResult);
    }
    function buildFavList() {
        var favList = document.getElementById('tyaiFavList');
        if (!favList) return;
        var preferred = ['beam-cont', 'footing-col', 'stage-check', 'beam-rect', 'crack-width'];
        var cards = Array.from(document.querySelectorAll('.section-card'));
        var picked = preferred.map(function (id) {
            return cards.find(function (card) { return card.getAttribute('href') === '#/' + id; });
        }).filter(Boolean);
        if (!picked.length) picked = cards.slice(0, 5);
        picked.slice(0, 5).forEach(function (card) {
            var title = card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : card.textContent.trim().slice(0, 12);
            var a = document.createElement('a');
            a.href = 'javascript:void(0)';
            a.textContent = title;
            a.addEventListener('click', function () {
                var section = card.closest('details.tool-section');
                if (section) section.open = true;
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(function () { card.click(); }, 260);
            });
            favList.appendChild(a);
        });
    }
    function bindSearch(noResult) {
        var input = document.getElementById('tyaiToolSearch');
        if (!input) return;
        var cards = Array.from(document.querySelectorAll('.section-card'));
        var sections = Array.from(document.querySelectorAll('.tool-section'));
        input.addEventListener('input', function () {
            if (!input.value.trim()) {
                sections.forEach(function (section) {
                    if (section.dataset.searchOpen !== undefined) { section.open = section.dataset.searchOpen === 'true'; delete section.dataset.searchOpen; }
                });
            } else {
                sections.forEach(function (section) {
                    if (section.dataset.searchOpen === undefined) section.dataset.searchOpen = String(section.open);
                });
            }
            var keyword = input.value.trim().toLowerCase();
            var visibleCount = 0;
            cards.forEach(function (card) {
                restoreMark(card);
                var text = card.textContent.toLowerCase();
                var match = !keyword || text.indexOf(keyword) > -1;
                card.style.display = match ? '' : 'none';
                if (match) {
                    visibleCount++;
                    if (keyword) highlightTitle(card, keyword);
                }
            });
            sections.forEach(function (section) {
                var visibleCards = section.querySelectorAll('.section-card:not([style*="display: none"])');
                section.style.display = visibleCards.length ? '' : 'none';
                if (keyword && visibleCards.length) section.open = true;
            });
            if (noResult) {
                noResult.classList.toggle('show', keyword && visibleCount === 0);
            }
        });
            // 快捷键「/」统一由 ui/ux.js 的全局命令面板接管（Ctrl/⌘+K 亦可）
        }
    function restoreMark(card) {
        card.querySelectorAll('mark').forEach(function (mark) {
            mark.replaceWith(document.createTextNode(mark.textContent));
        });
    }
    function highlightTitle(card, keyword) {
        var title = card.querySelector('h3');
        if (!title || !keyword) return;
        var raw = title.textContent;
        var idx = raw.toLowerCase().indexOf(keyword);
        if (idx === -1) return;
        title.innerHTML =
            raw.slice(0, idx) +
            '<mark>' + raw.slice(idx, idx + keyword.length) + '</mark>' +
            raw.slice(idx + keyword.length);
    }
    function enhanceCards() {
        document.querySelectorAll('.section-card').forEach(function (card) {
            if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
    }
})();

console.log('[UI] home.js loaded. 首页就绪。');
