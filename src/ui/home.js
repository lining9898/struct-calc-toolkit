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
    var hasLocalQA = window.TOOLS && window.TOOLS['local-qa'];
    var nonCalcCount = hasLocalQA ? 1 : 0;
    var calcToolCount = totalToolIds - nonCalcCount;

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

    // Tabler 工作区首页：简洁页头 + 独立统计卡片。
    html += '<div class="home-hero"><div class="hero-content">' +
        '<span class="eyebrow">STRUCTURAL ENGINEERING</span>' +
        '<h1>结构计算工作台</h1>' +
        '<p class="subtitle">选择构件，填写参数，查看结果与完整计算过程。</p>' +
        '</div></div>' +
        '<div class="home-stats">' +
            '<div class="stat card"><span class="lbl">计算工具</span><span class="num">' + calcToolCount + '<small> 项</small></span></div>' +
            '<div class="stat card"><span class="lbl">专业分类</span><span class="num">' + groups.length + '<small> 类</small></span></div>' +
            '<div class="stat card"><span class="lbl">计算过程</span><span class="num stat-text">完整可追溯</span></div>' +
            '<div class="stat card"><span class="lbl">计算书</span><span class="num stat-text">Word 导出</span></div>' +
        '</div>';

    // 渲染分组
    groups.forEach(function (g, index) {
        html += '<details class="tool-section card sec-' + g.key + '">' +
            '<summary class="tool-section-head">' +
                '<span class="sec-title">' +
                    '<span class="sec-icon">' + iconFor(g.icon, 18) + '</span>' +
                    g.name +
                '</span>' +
                '<span class="sec-count">' + g.tools.length + ' 个工具</span>' +
                '</summary>' +
            '<div class="section-grid">';
        g.tools.forEach(function (t) {
            html += '<a class="section-card card" href="#/' + t.id + '">' +
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
    window.scrollTo(0, 0);
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
        var hero = document.querySelector('.home-stats');
        if (!firstSection || document.querySelector('.tyai-home-tools')) return;
        var toolsPanel = document.createElement('div');
        toolsPanel.className = 'tyai-home-tools';
        toolsPanel.innerHTML = `
            <div class="tyai-search-panel card">
                <div class="tyai-search-title">快速查找工具</div>
                <div class="tyai-search-box">
                    <label class="visually-hidden" for="tyaiToolSearch">查找计算工具</label>
                    <input class="form-control" id="tyaiToolSearch" type="search" placeholder="搜索工具名称、构件或规范编号…">
                    <span class="tyai-search-icon">⌕</span>
                </div>
                <div class="workspace-quick"><span>常用工具</span><a href="#/beam-cont">连续梁</a><a href="#/footing-col">独立基础</a><a href="#/steel-beam">钢梁</a></div>
                <div class="tyai-search-hint">按名称或规范编号筛选。按 / 或 Ctrl/⌘+K 打开全局检索。</div>
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
        bindSearch(noResult);
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
