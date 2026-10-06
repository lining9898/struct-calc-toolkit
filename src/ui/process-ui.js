/* 统一计算过程的视图层；保留原始公式、数值、步骤顺序和导出内容。 */
(function () {
    'use strict';
    var root = document.getElementById('view');
    if (!root) return;
    var headingPattern = /^(?:[①-⑳]|\d+[.、．]|[一二三四五六七八九十]+[、．])/;
    function headingOf(step) {
        var first = step.firstElementChild;
        if (!first || !/^(B|STRONG)$/.test(first.tagName)) return null;
        // 仅将编号标题识别为标题，避免把加粗的计算结果误当标题。
        var preceding = '';
        for (var n = step.firstChild; n && n !== first; n = n.nextSibling) preceding += n.textContent;
        return !preceding.trim() && headingPattern.test(first.textContent.trim()) ? first : null;
    }
    function normalize() {
        root.querySelectorAll('.proc-head').forEach(function (head) {
            var label = head.querySelector('span:not(.proc-copy-msg)');
            if (label && label.textContent !== '详细计算过程') label.textContent = '详细计算过程';
        });
        root.querySelectorAll('.proc-body').forEach(function (body) {
            body.classList.add('process-document');
            // 旧模板的多个 .step 行按原编号合并为步骤区块。
            body.querySelectorAll('.step').forEach(function (step) {
                if (step.closest('.calc-book, .process-section')) return;
                var title = headingOf(step);
                if (!title) { step.classList.add('process-line'); if (step.textContent.indexOf('=') !== -1) step.classList.add('process-equation'); return; }
                var section = document.createElement('section');
                section.className = 'process-section';
                step.parentNode.insertBefore(section, step);
                var next = step.nextElementSibling;
                section.appendChild(step);
                title.classList.add('process-step-title');
                var content = document.createElement('div');
                content.className = 'process-step-content';
                while (title.nextSibling) content.appendChild(title.nextSibling);
                if (content.textContent.trim() || content.children.length) {
                    if (content.textContent.indexOf('=') !== -1) content.classList.add('process-equation');
                    step.appendChild(content);
                }
                while (next && next.classList.contains('step') && !headingOf(next)) {
                    var following = next.nextElementSibling;
                    next.classList.add('process-line');
                    if (next.textContent.indexOf('=') !== -1) next.classList.add('process-equation');
                    section.appendChild(next);
                    next = following;
                }
            });
        });
        root.querySelectorAll('.calc-book').forEach(function (book) {
            book.classList.add('process-document');
        });
    }
    var observer = new MutationObserver(function () {
        observer.disconnect();
        normalize();
        observe();
    });
    function observe() { observer.observe(root, { childList: true, subtree: true }); }
    normalize();
    observe();
})();
