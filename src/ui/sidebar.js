/* ============================================================
 *  统一专业目录：混凝土、地基、桩基、钢结构、砌体、装配式、
 *  荷载抗震、水池挡土墙、配筋规范速查。
 *  首页和侧栏共用此数据；工具 ID、路由及计算模块保持不变。
 * ============================================================ */
(function () {
    'use strict';

    // 统一的 9 类工具目录
    // 每个分组: { id, title, icon, children: [{id, title}, ...] 或 子分组数组 }
    var NAV_GROUPS = [
        {
            id: 'concrete', title: '混凝土结构', icon: 'beam-rect',
            subgroups: [
                { id: 'concrete-beams', title: '梁', tools: [
                    { id: 'beam-rect', title: '矩形梁正截面承载力' },
                    { id: 'beam-rect-design', title: '矩形梁正截面配筋设计' },
                    { id: 'beam-t', title: 'T形梁正截面承载力' },
                    { id: 'beam-shear', title: '梁斜截面受剪' },
                    { id: 'beam-cont', title: '连续梁计算' },
                    { id: 'addl-trans', title: '附加横向钢筋' },
                    { id: 'deep-beam', title: '深受弯构件' }
                ] },
                { id: 'concrete-slabs', title: '板与楼梯', tools: [
                    { id: 'slab-rect', title: '单块矩形板计算' },
                    { id: 'stair-slab', title: '板式楼梯计算' }
                ] },
                { id: 'concrete-columns-walls', title: '柱与墙', tools: [
                    { id: 'column-axial', title: '轴心受压柱' },
                    { id: 'basement-wall', title: '地下室外墙' },
                    { id: 'shear-wall', title: '剪力墙稳定' }
                ] },
                { id: 'concrete-checks', title: '构件验算', tools: [
                    { id: 'crack-width', title: '裂缝宽度计算' },
                    { id: 'deflection', title: '挠度验算' },
                    { id: 'punching', title: '受冲切承载力' },
                    { id: 'bearing-local', title: '混凝土局部受压' }
                ] },
                { id: 'concrete-details', title: '构造与连接', tools: [
                    { id: 'col-tie', title: '柱箍筋加密区' },
                    { id: 'corbel', title: '牛腿设计' },
                    { id: 'embed-plate', title: '预埋件计算' }
                ] }
            ]
        },
        {
            id: 'foundation', title: '地基基础', icon: 'footing-col',
            tools: [
                { id: 'footing-col', title: '柱下独立基础' },
                { id: 'footing-wall', title: '墙下条形基础' },
                { id: 'bearing-cap', title: '地基承载力验算' },
                { id: 'settlement', title: '地基沉降计算' },
                { id: 'bearing-theory', title: '承载力理论公式法' },
                { id: 'soft-underlayer', title: '软弱下卧层验算' },
                { id: 'anti-uplift', title: '抗浮稳定性验算' },
                { id: 'rigid-found', title: '无筋扩展条形基础' }
            ]
        },
        {
            id: 'pile', title: '桩基础', icon: 'pile-cap',
            tools: [
                { id: 'pile-cap', title: '桩承台计算' },
                { id: 'pile-single', title: '单桩竖向承载力' },
                { id: 'pile-bearing', title: '桩基竖向承载力验算' },
                { id: 'pile-horizontal', title: '桩基水平承载力' },
                { id: 'pile-settle', title: '桩基沉降计算' },
                { id: 'pile-bearing-55003', title: '桩基验算(GB55003)' }
            ]
        },
        {
            id: 'steel', title: '钢结构', icon: 'steel-beam',
            tools: [
                { id: 'steel-column', title: '钢压弯构件' },
                { id: 'steel-beam', title: '钢连续梁' },
                { id: 'weld', title: '焊缝连接' },
                { id: 'bolt', title: '螺栓连接' },
                { id: 'anchor-bolt', title: '柱脚锚栓' }
            ]
        },
        {
            id: 'masonry', title: '砌体结构', icon: 'mas-comp',
            tools: [
                { id: 'mas-comp', title: '砌体受压与高厚比' },
                { id: 'mas-local', title: '砌体局部受压' },
                { id: 'lintel', title: '过梁与圈梁' },
                { id: 'cantilever', title: '挑梁计算' },
                { id: 'balcony', title: '阳台雨篷挑檐' },
                { id: 'wall-beam', title: '墙梁计算' }
            ]
        },
        {
            id: 'prefab', title: '装配式结构', icon: 'slab-rect',
            tools: [
                { id: 'stage-check', title: '叠合构件两阶段验算' },
                { id: 'td-slab', title: '钢筋桁架楼板' },
                { id: 'l22zg401', title: '预应力钢管桁架叠合板' },
                { id: 'aac-wall', title: '蒸压加气混凝土外墙板' },
                { id: 'anchor', title: '保温外墙锚固件设计' }
            ]
        },
        {
            id: 'load-seismic', title: '荷载与抗震', icon: 'load-combo',
            tools: [
                { id: 'load-combo', title: '荷载组合计算' },
                { id: 'floor-live', title: '楼面活荷载查表' },
                { id: 'wind-snow', title: '风荷载与雪荷载' },
                { id: 'crane-load', title: '吊车荷载计算' },
                { id: 'temp-action', title: '温度作用计算' },
                { id: 'seismic', title: '抗震设防参数' },
                { id: 'seismic-perf', title: '抗震性能化设计' },
                { id: 'joint-core', title: '框架节点核芯区' },
                { id: 'steel-seismic', title: '钢结构抗震参数' },
                { id: 'masonry-seismic', title: '砌体房屋抗震验算' },
                { id: 'isolation', title: '隔震设计简化计算' }
            ]
        },
        {
            id: 'special-structures', title: '水池与挡土墙', icon: 'pool-rect',
            tools: [
                { id: 'pool-rect', title: '矩形水池' },
                { id: 'pool-circ', title: '圆形水池' },
                { id: 'retain-cant', title: '悬臂式挡土墙' },
                { id: 'retain-butt', title: '扶壁式挡土墙' }
            ]
        },
        {
            id: 'quick-reference', title: '配筋与规范速查', icon: 'ref',
            tools: [
                { id: 'rebar-area', title: '钢筋面积速查' },
                { id: 'rebar-pick', title: '配筋选筋助手' },
                { id: 'local-qa', title: '规范条文问答（本地）' },
                { id: 'rho-min', title: '最小配筋率速查' }
            ]
        }
    ];
    /* ============================================================
     *  图标：优先复用工具页头部图标（router.js 的 iconFor），
     *  保证左侧导航与右侧工具页图标完全一致；缺失的补在 EXTRA_ICONS。
     * ============================================================ */
    var EXTRA_ICONS = {
        'beam-rect-design': '<rect x="2" y="7" width="20" height="10" rx="1.5"/><circle cx="7" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="17" cy="12" r="1.4"/>',
        'bearing-theory': '<path d="M3 20h18"/><path d="M7 20V8l5-4 5 4v12"/><path d="M7 8h10"/>',
        'soft-underlayer': '<path d="M3 8h18M3 14h18"/><path d="M8 11h8" stroke-dasharray="2 2"/><path d="M10 4l-2 2M14 4l2 2"/>',
        'anti-uplift': '<path d="M12 3v9"/><path d="M8 7l4-4 4 4"/><path d="M5 14h14l-2 6H7z"/>',
        'pile-bearing-55003': '<rect x="3" y="5" width="18" height="4" rx="1"/><path d="M6 9v9M12 9v9M18 9v9"/><path d="M4 18h16" stroke-dasharray="2 2"/><path d="M9 2v2M15 2v2"/>',
        'stage-check': '<path d="M3 4h18v7H3z"/><path d="M3 14h18v6H3z"/><path d="M7 7h4M7 17h6"/>',
        'td-slab': '<path d="M3 12h18M3 8h18M3 16h18"/><path d="M6 4v4M10 4v4M14 4v4M18 4v4"/>',
        'l22zg401': '<path d="M3 8h18M3 12h18M3 16h18"/><path d="M5 4v4M9 4v4M13 4v4M17 4v4"/><circle cx="12" cy="20" r="1.5"/>',
        'rebar-pick': '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><path d="M17 14.5v5M14.5 17h5"/>',
        'local-qa': '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 8h6M8 12h4"/>',
        'seismic-perf': '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
        'joint-core': '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="3.5" stroke-dasharray="2 2"/>',
        'steel-seismic': '<path d="M4 4h16v2H4z"/><path d="M4 18h16v2H4z"/><path d="M10 6v12M14 6v12"/>',
        'masonry-seismic': '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6M15 3v6"/>',
        'isolation': '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M6 8v3M12 8v3M18 8v3"/><rect x="3" y="16" width="18" height="5" rx="1"/>'
    };

    function navIcon(id) {
        var inner = EXTRA_ICONS[id] || '';
        if (!inner && typeof iconFor === 'function') {
            var svg = '';
            try { svg = iconFor(id, 15) || ''; } catch (e) { svg = ''; }
            var m = String(svg).match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
            if (m && m[1]) inner = m[1];
        }
        if (!inner) inner = '<circle cx="12" cy="12" r="3.2"/>';
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
    }

    var CHEV = '<svg class="group-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
    var CHEV_SUB = '<svg class="sub-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

    function countTools(group) {
        var n = 0, i;
        if (group.subgroups) {
            for (i = 0; i < group.subgroups.length; i++) n += (group.subgroups[i].tools || []).length;
        } else if (group.tools) {
            n = group.tools.length;
        }
        return n;
    }

    function navItem(tool, gid, sid) {
        return '<a href="#/' + tool.id + '" class="nav" data-nav="' + tool.id + '"' +
            (gid ? ' data-group="' + gid + '"' : '') +
            (sid ? ' data-subgroup="' + sid + '"' : '') +
            '>' + navIcon(tool.id) + '<span class="nav-text">' + ((window.TOOLS && window.TOOLS[tool.id] && window.TOOLS[tool.id].title) || tool.title) + '</span></a>';
    }

    function buildNavHtml() {
        var html = '';
        html += '<div class="sidebar-head">';
        html += '<span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/></svg></span>';
        html += '<span><span class="app-name">结构计算工具箱</span><span class="app-sub">结构工程计算与验算</span></span>';
        html += '</div>';
        html += '<nav>';

        for (var g = 0; g < NAV_GROUPS.length; g++) {
            var group = NAV_GROUPS[g];

            if (group.isPrimary) {
                html += '<div class="nav-group primary">';
                for (var p = 0; p < group.tools.length; p++) {
                    var pt = group.tools[p];
                    html += '<a href="#/' + pt.id + '" class="nav nav-primary" data-nav="' + pt.id +
                        '" data-group="' + group.id + '">' + navIcon(pt.id) +
                        '<span class="nav-text">' + pt.title + '</span></a>';
                }
                html += '</div>';
                continue;
            }

            html += '<div class="nav-group" data-group="' + group.id + '">';
            html += '<div class="group-title" role="button" tabindex="0" aria-expanded="false" data-toggle="' + group.id + '">' + CHEV +
                '<span class="group-name">' + group.title + '</span>' +
                '<span class="group-count">' + countTools(group) + '</span></div>';
            html += '<div class="group-body" data-body="' + group.id + '">';

            if (group.subgroups) {
                for (var s = 0; s < group.subgroups.length; s++) {
                    var sub = group.subgroups[s];
                    html += '<div class="nav-subgroup" data-subgroup="' + sub.id + '">';
                    html += '<div class="subgroup-title" role="button" tabindex="0" aria-expanded="false" data-subtoggle="' + sub.id + '">' + CHEV_SUB +
                        '<span class="sub-name">' + sub.title + '</span>' +
                        '<span class="group-count">' + (sub.tools || []).length + '</span></div>';
                    html += '<div class="subgroup-body" data-subbody="' + sub.id + '">';
                    for (var st = 0; st < sub.tools.length; st++) {
                        html += navItem(sub.tools[st], group.id, sub.id);
                    }
                    html += '</div></div>';
                }
            } else {
                for (var t = 0; t < group.tools.length; t++) {
                    html += navItem(group.tools[t], group.id, '');
                }
            }

            html += '</div></div>';
        }

        html += '</nav>';
        html += '<div class="sidebar-foot">';
        html += '<div class="foot-note">';
        html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>';
        html += '<span>计算结果需经专业复核后使用</span></div>';
        html += '</div>';

        return html;
    }

    // 展开当前工具所在的分组 / 子分组，并把条目滚动到可见区
    function expandFor(id) {
        if (!id) return;
        var link = document.querySelector('.sidebar a.nav[data-nav="' + id + '"]');
        if (!link) return;
        var sub = link.closest ? link.closest('.nav-subgroup') : null;
        var group = link.closest ? link.closest('.nav-group') : null;
        if (sub) { sub.classList.add('open'); var subHeading = sub.querySelector('.subgroup-title'); if (subHeading) subHeading.setAttribute('aria-expanded', 'true'); }
        if (group) { group.classList.add('open'); var heading = group.querySelector('.group-title'); if (heading) heading.setAttribute('aria-expanded', 'true'); }
        try {
            if (link.scrollIntoView) link.scrollIntoView({ block: 'nearest' });
        } catch (e) { /* 非浏览器环境忽略 */ }
    }

    function initNewSidebar() {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // 样式统一放在 index.html 的设计系统里（与右侧共用同一套字号/字重/色阶），
        // 这里不再注入私有样式，避免左右排版漂移。
        sidebar.innerHTML = buildNavHtml();

        // 分组折叠 / 展开
        var groupTitles = sidebar.querySelectorAll('.group-title');
        for (var i = 0; i < groupTitles.length; i++) {
            groupTitles[i].addEventListener('click', function () {
                var group = this.closest('.nav-group');
                if (group) { group.classList.toggle('open'); this.setAttribute('aria-expanded', String(group.classList.contains('open'))); }
            });
        }

        for (var k = 0; k < groupTitles.length; k++) {
            groupTitles[k].addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
            });
        }

        // 子分组折叠 / 展开
        var subTitles = sidebar.querySelectorAll('.subgroup-title');
        for (var j = 0; j < subTitles.length; j++) {
            subTitles[j].addEventListener('click', function (e) {
                e.stopPropagation();
                var sub = this.closest('.nav-subgroup');
                if (sub) { sub.classList.toggle('open'); this.setAttribute('aria-expanded', String(sub.classList.contains('open'))); }
            });
        }

        for (var n = 0; n < subTitles.length; n++) {
            subTitles[n].addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
            });
        }

        // 导航高亮增强：高亮同时自动展开所在分组
        var baseNavActive = window.navActive;
        window.navActive = function (id) {
            if (typeof baseNavActive === 'function') baseNavActive(id);
            expandFor(id);
        };

        // 重建后恢复当前工具的高亮（侧栏 DOM 被替换，原高亮会丢失）
        var cur = window.CUR_TOOL || (typeof parseHash === 'function' ? parseHash() : '');
        if (cur && window.navActive) window.navActive(cur);

        console.log('[UI] sidebar 初始化完成：' + NAV_GROUPS.length + ' 个专业分组。');
    }

    window.initNewSidebar = initNewSidebar;
    window.NAV_GROUPS = NAV_GROUPS;

})();
