/* ============================================================
 *  tools/misc/local-qa.js — 规范条文问答与批量计算（本地运行）
 * ------------------------------------------------------------
 *  与「智能计算助手」互补：本模块不调用任何外部 API、不需要 API Key，
 *  全部在本机浏览器内完成，适合内网或无密钥环境使用。
 *    1. 规范问答：本地知识库检索（支持条号如 8.5.1、规范号如 GB 50010），
 *       带多轮上下文，可追问「还有吗」「这条对应哪个工具」；
 *    2. 结果解读：读取当前工具页的计算结果，给出通俗解释与不满足项的整改建议；
 *    3. 批量配筋：同一截面多组弯矩一次算出配筋并汇总对比。
 *  知识库为本地条文摘编，条号与取值仍需与规范正文核对。
 * ============================================================ */
(function () {
    var advice = [
        { k: ['超筋', 'ξ > ξb', 'ξ&gt;ξ'], a: '超筋（受拉钢筋过多 / 受压区过高）：优先加大截面高度 h，其次提高混凝土强度等级、加宽截面，或改为双筋截面由受压钢筋分担；单纯增加受拉钢筋无效且不经济。' },
        { k: ['少筋', '小于最小配筋', 'ρmin'], a: '少筋：按最小配筋率控制配筋量，A_s,min = ρmin·b·h（ρmin 取 0.2% 与 0.45ft/fy 的较大值），不要以计算值直接配筋。' },
        { k: ['裂缝', 'wmax', 'w<sub>max</sub>'], a: '裂缝宽度超限：减小钢筋直径、加密间距（更小直径多根比大直径少根有效）、适当增加配筋面积降低钢筋应力、加大保护层厚度；必要时复核是否应按更严格的裂缝控制等级设计。' },
        { k: ['挠度', '变形'], a: '挠度超限：加大截面高度最有效，其次增加受拉配筋、提高混凝土等级、减小计算跨度；对预制构件可在制作时预起拱。' },
        { k: ['冲切'], a: '冲切不足：加厚板（最有效，h0 对冲切承载力影响显著）、设置柱帽或托板、配置抗冲切箍筋或栓钉。' },
        { k: ['局部受压', '局部承压'], a: '局部受压不足：加设钢垫板或垫块扩大局部受压面积、提高混凝土强度等级、设置间接钢筋（方格网/螺旋筋）。' },
        { k: ['抗浮', '浮托'], a: '抗浮不足：增加结构自重或覆土压重、设置抗拔桩或抗拔锚杆、采取排水减压措施（需有可靠的长期排水保证）。' },
        { k: ['抗滑', '抗倾覆'], a: '稳定不足：加大墙趾宽度、设置墙踵压重、基底设抗滑键、加大埋置深度；地下水位以下应水土分算并考虑排水措施。' },
        { k: ['地基承载力', '基底压力'], a: '地基承载力不足：加大基础底面尺寸、加深埋置深度（需复核深度修正的适用性）、进行地基处理或改用桩基。' },
        { k: ['沉降'], a: '沉降超限：减小基底附加压力、加大基础刚度、调整基础形式（筏板/桩基）、预压或地基处理、设置后浇带并控制施工加载速率。' },
        { k: ['稳定'], a: '稳定不足：减小构件计算长度、加大截面（优先加大回转半径方向）、加强侧向支撑或设置支撑体系。' },
        { k: ['构造', '不满足构造'], a: '构造要求不满足：构造要求同属强制性要求，应按规范第 8、9 章（混凝土）或相应章节调整钢筋直径、间距、锚固与搭接长度。' }
    ];

    var ctxState = { history: [], lastSources: [], lastToolIds: [] };

    function textOf(html) {
        return String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function refPronoun(q) {
        return /^(那|这|它|其|还有|继续|再|上面|刚才|前面|别的|其他)/.test(String(q).trim()) || String(q).trim().length <= 4;
    }

    var tool = {
        title: '规范条文问答（本地）',
        sub: '本地知识库检索 · 结果解读 · 批量配筋 · 无需 API Key，全部在本机运行',
        meta: {
            standard: 'GB 50010 / GB 50007 / GB 50011 / GB 50017 / GB 50003 / GB 50009 / JGJ 94 / JGJ 1 等',
            formulaSource: '本地条文摘编（60 条）',
            limitations: '本地知识库为条文摘编，条号与取值需与规范正文核对；不替代专业人员判断',
            unit: '—',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">① 规范条文问答（本地知识库，支持条号检索）</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
                '<input id="lq_q" type="text" placeholder="例如：最小配筋率怎么取 / 8.5.1 是什么 / 冲切不足怎么办 / 风荷载怎么算" style="flex:1;min-width:240px;padding:9px 11px;border:1.5px solid var(--hairline-input);border-radius:6px;font-size:13.5px;font-family:inherit">' +
                '<button type="button" class="btn btn-primary" id="lq_ask">提问</button>' +
                '<button type="button" class="btn btn-secondary" id="lq_clear">清空对话</button>' +
                '</div>' +
                '<div style="font-size:12px;color:var(--ink-faint);line-height:1.9">' +
                '示例：<a href="javascript:void(0)" class="lq-eg">最小配筋率怎么取</a> · ' +
                '<a href="javascript:void(0)" class="lq-eg">8.5.1 是什么</a> · ' +
                '<a href="javascript:void(0)" class="lq-eg">附加横向钢筋怎么算</a> · ' +
                '<a href="javascript:void(0)" class="lq-eg">抗震等级怎么确定</a> · ' +
                '<a href="javascript:void(0)" class="lq-eg">抗浮不满足怎么办</a> · ' +
                '<a href="javascript:void(0)" class="lq-eg">钢梁整体稳定验算</a>' +
                '</div>' +
                '<div id="lq_log" style="margin-top:12px"></div></div>' +

                '<div class="panel"><div class="panel-title">② 解读当前计算结果</div>' +
                '<div style="font-size:12.5px;color:var(--ink-mute);line-height:1.8;margin-bottom:8px">' +
                '先在左侧打开任意计算模块并完成计算，再点下面的按钮，这里会给出通俗解释与不满足项的整改建议。</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<button type="button" class="btn btn-primary" id="lq_explain">解读当前结果</button>' +
                '<button type="button" class="btn btn-secondary" id="lq_export">导出当前计算书（Word）</button>' +
                '</div><div id="lq_exp_out" style="margin-top:12px"></div></div>' +

                '<div class="panel"><div class="panel-title">③ 批量配筋设计（同一截面，多组弯矩）</div>' +
                '<form id="f-lq"><div class="grid2">' +
                numField('lq_b', '截面宽度 b', 'mm', 250) +
                numField('lq_h', '截面高度 h', 'mm', 600) +
                numField('lq_as', '受拉筋合力点 a<sub>s</sub>', 'mm', 40) +
                selField('lq_con', '混凝土强度等级', conOpts('C30')) +
                selField('lq_reb', '钢筋级别', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                '</div>' +
                '<div class="field" style="margin-top:8px"><label>弯矩列表 M（kN·m，每行一个，或用逗号 / 空格分隔）<span>(kN·m)</span></label>' +
                '<textarea id="lq_Ms" rows="5" style="width:100%;padding:9px 11px;border:1.5px solid var(--hairline-input);border-radius:6px;font-size:13px;font-family:ui-monospace,Consolas,monospace">120\n180\n240\n300</textarea></div>' +
                '<div class="btn-group"><button type="button" class="btn btn-primary" id="lq_batch">批量计算</button></div>' +
                '</form><div id="lq_batch_out" style="margin-top:10px"></div></div>' +

                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>检索与计算说明</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="lq_proc"></div></div></div></div>';
        },
        bind: function () {
            var qInput = document.getElementById('lq_q');
            var log = document.getElementById('lq_log');

            function push(role, html) {
                var cls = role === 'user' ? 'badge-info' : '';
                var wrap = document.createElement('div');
                wrap.style.cssText = 'margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.85;' +
                    (role === 'user'
                        ? 'background:var(--primary-bg-subdued);border:1px solid var(--primary-line);color:var(--primary-deep)'
                        : 'background:var(--canvas-soft);border:1px solid var(--hairline);color:var(--ink-secondary)');
                wrap.innerHTML = (role === 'user' ? '<b>问：</b>' : '<b>答：</b>') + html;
                log.appendChild(wrap);
                log.scrollTop = log.scrollHeight;
                return wrap;
            }

            function ask(question) {
                question = String(question || '').trim();
                if (!question) { alert('请输入要查询的内容。'); return; }
                push('user', question.replace(/</g, '&lt;'));
                ctxState.history.push(question);

                // 多轮上下文：指代性追问时把上一次问题一并检索
                var searchQ = question;
                if (refPronoun(question) && ctxState.history.length > 1) {
                    searchQ = ctxState.history[ctxState.history.length - 2] + ' ' + question;
                }

                if (!window.KNOWLEDGE_BASE) {
                    push('assistant', '本地知识库模块未加载，请刷新页面后重试。');
                    return;
                }
                push('assistant', '正在检索本地知识库……');
                var tip = log.lastChild;

                window.KNOWLEDGE_BASE.searchStandard(searchQ, { limit: 4 }, function (list) {
                    if (!list || !list.length) {
                        var idx = (window.UX && window.UX.search) ? window.UX.search(question) : [];
                        var tipHtml = '本地知识库没有直接命中该问题。<br>建议换用规范术语，例如「最小配筋率」「受冲切」「高厚比」「整体稳定」等；也可以直接给条号（如 6.2.10）。';
                        if (idx.length) {
                            tipHtml += '<br><br>与问题相关的计算工具：' + idx.slice(0, 5).map(function (t) {
                                return '<a class="ux-chip" href="#/' + t.id + '">' + t.title + '</a>';
                            }).join(' ');
                        }
                        tip.innerHTML = '<b>答：</b>' + tipHtml;
                        return;
                    }
                    ctxState.lastSources = list;
                    var html = '命中 ' + list.length + ' 条本地条文（按相关度排序）：';
                    list.forEach(function (a, i) {
                        var tools = (a.related_tools || []).filter(function (id) {
                            return window.TOOLS && window.TOOLS[id];
                        });
                        html += '<div style="margin-top:10px;padding:10px 12px;background:#fff;border:1px solid var(--hairline);border-left:3px solid var(--primary);border-radius:6px">' +
                            '<div style="font-size:13px;font-weight:600;color:var(--ink)">' + (i + 1) + '. ' + a.standard_name + ' ' + (a.article || '') + '　' + (a.title || '') + '</div>' +
                            '<div style="font-size:12px;color:var(--ink-faint);margin:3px 0 6px">' + (a.chapter || '') + '　版本 ' + (a.version || '-') + '　状态：' + (a.status || '-') + '</div>' +
                            '<div style="font-size:12.8px;line-height:1.85"><b>条文要点：</b>' + (a.content || '') + '</div>' +
                            (a.explanation ? '<div style="font-size:12.8px;line-height:1.85;margin-top:4px"><b>理解与做法：</b>' + a.explanation + '</div>' : '') +
                            (a.keywords && a.keywords.length ? '<div style="font-size:12px;color:var(--ink-faint);margin-top:5px">关键词：' + a.keywords.join('、') + '</div>' : '') +
                            (tools.length ? '<div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap">相关工具：' + tools.map(function (id) {
                                return '<a class="ux-chip" href="#/' + id + '">' + window.TOOLS[id].title + '</a>';
                            }).join('') + '</div>' : '') +
                            '</div>';
                    });
                    html += '<div style="margin-top:8px;font-size:12px;color:var(--ink-faint)">提示：本地知识库为条文摘编，正式设计前请与规范正文核对条号与取值。</div>';
                    tip.innerHTML = '<b>答：</b>' + html;
                });
            }

            var askBtn = document.getElementById('lq_ask');
            if (askBtn) askBtn.addEventListener('click', function () { ask(qInput.value); qInput.value = ''; });
            if (qInput) qInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); ask(qInput.value); qInput.value = ''; }
            });
            var clr = document.getElementById('lq_clear');
            if (clr) clr.addEventListener('click', function () {
                log.innerHTML = '';
                ctxState.history = [];
                ctxState.lastSources = [];
            });
            Array.prototype.forEach.call(document.querySelectorAll('.lq-eg'), function (a) {
                a.addEventListener('click', function () { ask(a.textContent.trim()); });
            });

            /* ---- ② 结果解读 ---- */
            var expBtn = document.getElementById('lq_explain');
            if (expBtn) expBtn.addEventListener('click', function () {
                var out = document.getElementById('lq_exp_out');
                var view = document.getElementById('view');
                var tid = window.CUR_TOOL;
                var t = tid && window.TOOLS ? window.TOOLS[tid] : null;
                if (!t) { out.innerHTML = '<div class="error-box">当前不在任何计算模块页面。请先从左侧打开一个计算模块并完成计算。</div>'; return; }

                var items = view.querySelectorAll('.result-item');
                var rows = [];
                for (var i = 0; i < items.length; i++) {
                    var l = items[i].querySelector('.label'), v = items[i].querySelector('.value');
                    if (l && v) rows.push({ label: l.textContent.trim(), val: v.textContent.replace(/\s+/g, ' ').trim() });
                }
                var steps = view.querySelectorAll('.proc-body .step');
                var stepText = [];
                for (var j = 0; j < steps.length; j++) stepText.push(textOf(steps[j].innerHTML));

                if (!rows.length && !stepText.length) {
                    out.innerHTML = '<div class="error-box">当前模块还没有计算结果。请先点击「开始计算」，再回来解读。</div>';
                    return;
                }

                var all = rows.map(function (r) { return r.label + ' ' + r.val; }).join(' | ') + ' ' + stepText.join(' ');
                var bad = [], good = [];
                ['不满足', '超筋', '少筋', '不通过', '无法判定', '超出限值', '不适用', '不满足要求'].forEach(function (kw) {
                    if (all.indexOf(kw) > -1) bad.push(kw);
                });
                ['满足', '适筋', '通过', '符合'].forEach(function (kw) {
                    if (all.indexOf(kw) > -1) good.push(kw);
                });

                var html = '<div style="padding:12px 14px;border:1px solid var(--hairline);border-radius:8px;background:#fff">';
                html += '<div style="font-weight:600;font-size:13.5px;margin-bottom:6px">' + t.title + '　计算结果解读</div>';
                html += '<div style="font-size:12.8px;line-height:1.9"><b>判定结果：</b>' +
                    (bad.length
                        ? '<span style="color:var(--err)">存在需关注项（' + bad.join('、') + '）</span>'
                        : (good.length ? '<span style="color:var(--ok)">未发现不满足项（出现的关键词：' + good.join('、') + '）</span>'
                            : '结果中未出现明确的满足/不满足判定词，请结合下方结果逐项核对。')) + '</div>';

                if (rows.length) {
                    html += '<div style="margin-top:8px;font-size:12.8px"><b>关键结果：</b><ul style="margin:6px 0 0 18px;line-height:1.9">' +
                        rows.slice(0, 14).map(function (r) { return '<li>' + r.label + '：' + r.val + '</li>'; }).join('') + '</ul></div>';
                }

                if (bad.length) {
                    var hits = advice.filter(function (a) {
                        return a.k.some(function (k) { return all.indexOf(k.replace(/&[a-z]+;/g, '')) > -1 || bad.indexOf(k) > -1; });
                    });
                    html += '<div style="margin-top:10px;font-size:12.8px;line-height:1.9"><b>整改建议：</b><ul style="margin:6px 0 0 18px">' +
                        (hits.length ? hits.map(function (h) { return '<li>' + h.a + '</li>'; }).join('')
                            : '<li>结果中存在不满足项，建议逐项核对输入参数是否正确、单位是否一致，并结合规范构造要求调整截面或配筋后重新计算。</li>') +
                        '</ul></div>';
                }

                var related = (t.meta && t.meta.standard) ? t.meta.standard : '';
                if (related) {
                    html += '<div style="margin-top:10px;font-size:12px;color:var(--ink-faint)">本模块规范依据：' + related +
                        (t.meta.formulaSource ? '（' + t.meta.formulaSource + '）' : '') + '　可在上方①中用条号检索对应条文要点。</div>';
                }
                html += '<div style="margin-top:8px;font-size:12px;color:var(--ink-faint)">说明：本解读基于结果文本的关键词判定，仅作辅助理解，最终结论以专业复核为准。</div>';
                html += '</div>';
                out.innerHTML = html;
            });

            var expBtn2 = document.getElementById('lq_export');
            if (expBtn2) expBtn2.addEventListener('click', function () {
                if (typeof window.exportBook === 'function') window.exportBook();
                else alert('导出功能不可用。');
            });

            /* ---- ③ 批量配筋 ---- */
            var batchBtn = document.getElementById('lq_batch');
            if (batchBtn) batchBtn.addEventListener('click', function () {
                var out = document.getElementById('lq_batch_out');
                var proc = document.getElementById('lq_proc');
                var raw = document.getElementById('lq_Ms').value || '';
                var Ms = (raw.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(function (v) { return v > 0; });
                if (!Ms.length) { out.innerHTML = '<div class="error-box">请至少输入一个弯矩值。</div>'; return; }

                var base = {
                    b: parseFloat(document.getElementById('lq_b').value),
                    h: parseFloat(document.getElementById('lq_h').value),
                    as: parseFloat(document.getElementById('lq_as').value),
                    con: document.getElementById('lq_con').value,
                    reb: document.getElementById('lq_reb').value
                };

                var rows = '', okCount = 0, errCount = 0, st = [];
                st.push('<div class="step"><b>① 批量条件</b>　截面 b×h = ' + base.b + '×' + base.h + ' mm，a<sub>s</sub> = ' + base.as +
                    ' mm，' + base.con + ' / ' + base.reb + '；弯矩数量 ' + Ms.length + ' 组。</div>');

                Ms.forEach(function (M, i) {
                    var r = designBeamRectSection({ b: base.b, h: base.h, as: base.as, con: base.con, reb: base.reb, M: M });
                    if (!r.ok) {
                        errCount++;
                        rows += '<tr><td>' + M.toFixed(1) + '</td><td colspan="5" style="color:var(--err)">' + r.error + '</td></tr>';
                        return;
                    }
                    okCount++;
                    var pick = pickRebar(r.As, { dias: [14, 16, 18, 20, 22, 25, 28, 32], maxN: 6 })[0];
                    st.push('<div class="step"><b>' + M.toFixed(1) + ' kN·m</b>　' +
                        (r.isDouble ? '双筋' : '单筋') + '：x = ' + fmt(r.x, 1) + ' mm，ξ = ' + fmt(r.xi, 4) + ' ≤ ξ<sub>b</sub> = ' + fmt(r.xi_b, 4) +
                        '，A<sub>s</sub> = ' + fmt(r.As, 0) + ' mm²' + (r.byMin ? '（按构造控制）' : '') +
                        (r.isDouble ? '，A<sub>s</sub>′ = ' + fmt(r.AsP, 0) + ' mm²' : '') +
                        '；推荐 ' + (pick ? pick.n + 'Φ' + pick.d : '—') + '。</div>');
                    rows += '<tr>' +
                        '<td>' + M.toFixed(1) + '</td>' +
                        '<td>' + (r.isDouble ? '双筋' : '单筋') + '</td>' +
                        '<td>' + fmt(r.x, 1) + '</td>' +
                        '<td>' + fmt(r.As, 0) + (r.byMin ? ' *' : '') + '</td>' +
                        '<td>' + (r.isDouble ? fmt(r.AsP, 0) : '—') + '</td>' +
                        '<td><b>' + (pick ? pick.n + 'Φ' + pick.d : '—') + '</b>' + (pick ? '（' + fmt(pick.A, 0) + '）' : '') + '</td>' +
                        '</tr>';
                });

                out.innerHTML = '<div style="font-size:12.5px;color:var(--ink-mute);margin-bottom:6px">共 ' + Ms.length +
                    ' 组：成功 ' + okCount + ' 组，失败 ' + errCount + ' 组；带 * 表示按最小配筋率构造控制。</div>' +
                    '<table style="width:100%;border-collapse:collapse;font-size:12.5px">' +
                    '<tr><th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">M (kN·m)</th>' +
                    '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">形式</th>' +
                    '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">x (mm)</th>' +
                    '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">A<sub>s</sub> (mm²)</th>' +
                    '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">A<sub>s</sub>′ (mm²)</th>' +
                    '<th style="text-align:left;border-bottom:1px solid var(--hairline);padding:5px 4px">推荐配筋</th></tr>' +
                    rows + '</table>' +
                    '<div style="margin-top:8px;font-size:12px;color:var(--ink-faint)">说明：与「矩形梁正截面配筋设计」共用同一套公式（core/calculator.js 的 designBeamRectSection），结果一致。</div>';

                st.push('<div class="step"><b>② 计算说明</b>　逐组按正截面受弯设计：单筋时由 α<sub>1</sub>f<sub>c</sub>bx(h<sub>0</sub>−x/2) = M 解 x，' +
                    'A<sub>s</sub> = α<sub>1</sub>f<sub>c</sub>bx/f<sub>y</sub>；超过单筋界限（x &gt; ξ<sub>b</sub>h<sub>0</sub>）时按双筋设计，受压钢筋承担超出部分。<br>' +
                    'A<sub>s</sub> 小于 ρ<sub>min</sub>bh 时按构造配筋取值并标注 *。选筋组合按超配面积最小原则给出。</div>');
                proc.innerHTML = st.join('');
                var wrap = proc.closest ? proc.closest('.proc-wrap') : null;
                if (wrap) wrap.classList.add('open');
                window._LQ_BATCH = { base: base, Ms: Ms };
            });
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['local-qa'] = tool;
    console.log('[Tool] local-qa registered（本地规范问答 / 结果解读 / 批量配筋）。');
})();
