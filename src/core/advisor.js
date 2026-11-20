/* 结果解读沿用当前模块的结果行与判定标记。 */
(function () {
    'use strict';

    function escapeText(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function analyze(view, toolId) {
        view = view || document.getElementById('view');
        var rows = [];
        var hasFailure = false;
        var summaryRow = null;
        var summary = '';
        var error = '';
        var hasResult = false;
        if (view) {
            view.querySelectorAll('.result-item, .result-table tr, .mini tr, .result-big, .error-box').forEach(function (el) {
                if (el.closest('#rsAdvisor, .proc-body, form, [hidden], [style*="display:none"], [style*="display: none"]')) return;
                if (el.matches('.error-box')) { error = el.textContent.trim(); return; }
                if (el.matches('.result-big')) {
                    summary = el.innerText.trim();
                    if (el.classList.contains('fail')) hasFailure = true;
                    return;
                }
                var label, value;
                if (el.cells) {
                    if (el.cells.length < 2 || el.cells[0].tagName === 'TH') return;
                    label = el.cells[0].textContent.trim();
                    if (el.cells.length === 2) value = el.cells[1].textContent.trim();
                    else {
                        var mark = el.querySelector('.badge, .tag, .tag-err, .tag-ok');
                        if (!mark) return;
                        value = mark.textContent.trim();
                    }
                } else {
                    var key = el.querySelector('.label'), val = el.querySelector('.value');
                    if (!key || !val) return;
                    label = key.textContent.trim(); value = val.textContent.trim();
                }
                if (!label || !value) return;
                // Some modules also use a red tag for pending product data.
                var failed = Array.from(el.querySelectorAll('.badge-err, .badge.err, .badge.bad, .tag.err, .tag-err')).some(function(mark) {
                    var text = mark.textContent.trim();
                    return !!text && !/^(?:待核验|未验算|无法判定|尚未)/.test(text);
                });
                if (!failed && el.querySelector('.badge-warn') && /^(?:不满足最小配筋率|配筋不足)/.test(value)) failed = true;
                var row = { label: label, val: value, failed: failed };
                rows.push(row);
                if (failed) hasFailure = true;
                if (/^(?:综合判定|总体判定|最终判定|判定)$|计算结论$/.test(label)) summaryRow = row;
            });
            hasResult = !!(rows.length || summary || view.querySelector('.proc-body .step'));
        }
        return { toolId: toolId || window.CUR_TOOL || '', rows: rows, summaryRow: summaryRow, summary: summaryRow ? summaryRow.val : summary, error: error,
            verdict: error ? 'invalid' : hasFailure ? 'fail' : hasResult ? 'result' : 'empty' };
    }

    function renderPanel(res) {
        if (res.error) return '<div class="rs-note">' + escapeText(res.error) + '</div>';
        if (res.verdict === 'empty') return '<div class="rs-note">请先完成计算。</div>';
        var html = [];
        if (res.summary) html.push('<div class="rs-verdict"><b>' + escapeText(res.summaryRow ? res.summaryRow.label : '计算结果') +
            '</b><div>' + escapeText(res.summary) + '</div></div>');
        var rows = res.rows.filter(function(row) { return row !== res.summaryRow; });
        if (rows.length) {
            html.push('<div class="rs-sec"><div class="rs-sec-title">计算结果</div><div class="rs-rows">');
            rows.forEach(function(row) {
                html.push('<div class="rs-row' + (row.failed ? ' bad' : '') + '"><span class="rs-k">' +
                    escapeText(row.label) + '</span><span class="rs-v">' + escapeText(row.val) + '</span></div>');
            });
            html.push('</div></div>');
        }
        if (!html.length) html.push('<div class="rs-note">本次计算结果见上方输出，推导见详细计算过程。</div>');
        return html.join('');
    }

    /* 关联条文（异步，从本地知识库） */
    function renderClauses(host, toolId) {
        if (!window.KNOWLEDGE_BASE || !window.KNOWLEDGE_BASE.getStandardsForTool) return;
        if (!host) return;
        window.KNOWLEDGE_BASE.getStandardsForTool(toolId, function (list) {
            if (!host.isConnected || window.CUR_TOOL !== toolId) return;
            var old = host.querySelector('.rs-extra');
            if (old) old.remove();
            var box = document.createElement('div');
            box.className = 'rs-sec rs-extra';
            var articles = (list || []).map(function (article) {
                var page = article.source_print_page ? '印刷第 ' + article.source_print_page + ' 页' : '印刷页码待核对';
                var type = article.content_type || '本地摘编 · 待校核';
                return '<div class="rs-clause"><b>' + escapeText(article.standard_name) + '　' +
                    escapeText(article.article) + '　' + escapeText(article.title) + '</b>' +
                    '<p>' + escapeText(article.content || '本条暂未收录正文。') + '</p><div class="rs-more">' +
                    escapeText(type) + '　' + escapeText(page) + '</div></div>';
            });
            box.innerHTML = '<div class="rs-sec-title">相关规范条文</div>' +
                (articles.length ? '<div class="rs-clauses">' +
                    articles.join('') + '</div>' : '<div class="rs-note">本地资料暂未收录本模块的关联条文。</div>');
            host.appendChild(box);
        });
    }

    /* ===================== 6. 样式 ===================== */
    function ensureStyle() {
        if (document.getElementById('rs-advisor-style')) return;
        var css = document.createElement('style');
        css.id = 'rs-advisor-style';
        css.textContent = [
            '.rs-advisor{margin:16px 0;border:1px solid var(--hairline);border-radius:10px;background:var(--canvas);overflow:hidden}',
            '.rs-advisor-head{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--canvas-soft);border-bottom:1px solid var(--hairline);cursor:pointer;user-select:none}',
            '.rs-advisor-head .rs-t{font-size:13.5px;font-weight:600;color:var(--ink)}',
            '.rs-advisor-head .rs-tog{margin-left:auto;font-size:12px;color:var(--ink-mute)}',
            '.rs-advisor-body{padding:14px;display:none}',
            '.rs-advisor.open .rs-advisor-body{display:block}',
            '.rs-verdict{padding:10px 13px;border-radius:8px;margin-bottom:14px;font-size:13px;line-height:1.7}',
            '.rs-sec{margin-bottom:16px}',
            '.rs-sec:last-child{margin-bottom:0}',
            '.rs-sec-title{font-size:13px;font-weight:600;color:var(--ink);margin-bottom:8px;padding-left:8px;border-left:3px solid var(--primary)}',
            '.rs-rows{display:flex;flex-direction:column;gap:1px;background:var(--hairline);border:1px solid var(--hairline);border-radius:8px;overflow:hidden}',
            '.rs-row{display:flex;gap:12px;padding:7px 11px;background:#fff;font-size:12.8px;line-height:1.65}',
            '.rs-row.bad{background:#fdf3f3}',
            '.rs-k{flex:0 0 44%;color:var(--ink-mute)}',
            '.rs-v{flex:1;color:var(--ink);font-weight:500}',
            '.rs-row.bad .rs-v{color:#a32626}',
            '.rs-more{font-size:11.5px;color:var(--ink-faint);margin-top:6px}',
            '.rs-note{font-size:12.8px;color:var(--ink-mute);line-height:1.85}',
            '.rs-clause p{margin:5px 0 0;color:var(--ink);white-space:pre-line;line-height:1.75}',
            '.rs-clauses{display:flex;flex-direction:column;gap:5px}',
            '.rs-clause{font-size:12.5px;color:var(--primary-deep);text-decoration:none;padding:6px 10px;border:1px solid var(--primary-line);background:var(--primary-bg-subdued);border-radius:6px;line-height:1.6}',
            '@media (max-width:640px){.rs-k{flex:0 0 100%}.rs-row{flex-direction:column;gap:2px}}'
        ].join('\n');
        document.head.appendChild(css);
    }

    /* ===================== 7. 挂载到工具页 ===================== */
    var lastSig = '';
    var bodyEl = null, togEl = null;

    /* 只有真正的工具页才挂载解读面板（首页 / 未知路由不挂） */
    function isToolView(view) {
        if (!view || !view.querySelector) return false;
        if (!(window.CUR_TOOL && window.TOOLS && window.TOOLS[window.CUR_TOOL])) return false;
        return !!view.querySelector('.tool-head');
    }

    function signatureOf(res) {
        return JSON.stringify(res);
    }

    function mount(view, toolId, force) {
        if (!view || !view.appendChild) return;
        ensureStyle();

        if (!isToolView(view)) {
            var stale = document.getElementById('rsAdvisor');
            if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
            lastSig = '';
            return;
        }

        var res = analyze(view, toolId);
        var sig = signatureOf(res);

        // 还没算过 → 不主动占位（用户点「结果解读」时再强制显示）
        if (!force && res.verdict === 'empty') {
            var idle = document.getElementById('rsAdvisor');
            if (idle && idle.parentNode) idle.parentNode.removeChild(idle);
            lastSig = '';
            return;
        }

        var panel = document.getElementById('rsAdvisor');
        // 内容未变化且面板已在位 → 直接返回，避免 MutationObserver 自激循环
        if (panel && panel.parentNode === view && sig === lastSig && !force) return;

        if (!panel) {
            /* 面板骨架用 createElement 逐层搭建，而不是先写 innerHTML 再 getElementById
               —— 这样在无 HTML 解析器的环境下（自动化测试）也能正常工作 */
            panel = document.createElement('div');
            panel.id = 'rsAdvisor';
            panel.className = 'rs-advisor';

            var headEl = document.createElement('div');
            headEl.className = 'rs-advisor-head';
            headEl.id = 'rsAdvisorHead';

            var tEl = document.createElement('span');
            tEl.className = 'rs-t';
            tEl.innerHTML = '结果解读';
            togEl = document.createElement('span');
            togEl.className = 'rs-tog';
            togEl.id = 'rsAdvisorTog';
            togEl.innerHTML = '展开 ▾';

            headEl.appendChild(tEl);
            headEl.appendChild(togEl);

            bodyEl = document.createElement('div');
            bodyEl.className = 'rs-advisor-body';
            bodyEl.id = 'rsAdvisorBody';

            panel.appendChild(headEl);
            panel.appendChild(bodyEl);

            // 优先放在「详细计算过程」面板之前，没有则追加到末尾
            var proc = view.querySelector ? view.querySelector('.proc-wrap') : null;
            if (proc && proc.parentNode === view) view.insertBefore(panel, proc);
            else view.appendChild(panel);

            headEl.addEventListener('click', function () {
                panel.classList.toggle('open');
                if (togEl) togEl.innerHTML = panel.classList.contains('open') ? '收起 ▴' : '展开 ▾';
            });
        } else if (panel.parentNode !== view) {
            view.appendChild(panel);
        }

        if (!bodyEl || bodyEl.parentNode !== panel) {
            // 面板已存在但引用丢失（例如被外部重建）→ 重新取一次
            bodyEl = document.getElementById('rsAdvisorBody');
            togEl = document.getElementById('rsAdvisorTog');
        }
        if (!bodyEl) return;
        bodyEl.innerHTML = renderPanel(res);

        // 关联本地条文（body 已被整体替换，此处重新异步追加）
        if (res.toolId) renderClauses(bodyEl, res.toolId);

        // 判定为「不满足」时自动展开，省一次点击
        if (res.verdict === 'fail') {
            panel.classList.add('open');
            if (togEl) togEl.innerHTML = '收起 ▴';
        }
        lastSig = signatureOf(res);
    }

    /* 结果区变化后自动刷新（防抖） */
    var timer = null;
    function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
            timer = null;
            mount(document.getElementById('view'), window.CUR_TOOL);
        }, 350);
    }

    function startObserve() {
        ensureStyle();
        if (!window.MutationObserver) return;
        var view = document.getElementById('view');
        if (!view) {
            setTimeout(startObserve, 500);
            return;
        }
        var mo = new MutationObserver(function () {
            // 自身面板变化不触发刷新，避免死循环
            schedule();
        });
        mo.observe(view, { childList: true, subtree: true, characterData: true });
    }

    /* 供 ux.js 动作条调用：强制展开 */
    function openForCurrent() {
        mount(document.getElementById('view'), window.CUR_TOOL, true);
        var panel = document.getElementById('rsAdvisor');
        if (panel) {
            panel.classList.add('open');
            var tog = document.getElementById('rsAdvisorTog');
            if (tog) tog.textContent = '收起 ▴';
            if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    window.RESULT_ADVISOR = {
        analyze: analyze,
        mount: mount,
        openForCurrent: openForCurrent,
        renderPanel: renderPanel
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserve);
    else startObserve();

    console.log('[Advisor] advisor.js loaded. 结果解读 / 关联条文就绪（纯本地）。');
})();
