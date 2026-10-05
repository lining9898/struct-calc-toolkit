/* ==========================================================
 *  建筑结构规范知识库 —— 纯前端词法检索
 *  不调外部向量接口，不接后端
 *  加载 knowledge/ 下各规范 JSON，按关键词命中+词条计数+工具加权打分
 * ========================================================== */
(function () {
    'use strict';

    // 规范 JSON 文件路径（相对项目根，由 fetch 加载）
    var STANDARD_FILES = [
        'src/knowledge/concrete/GB50010.json',
        'src/knowledge/foundation/GB50007.json',
        'src/knowledge/seismic/GB50011.json',
        'src/knowledge/prefab/JGJ1.json',
        'src/knowledge/construction/GB50204.json',
        // 扩充：跨规范的常用条文摘编（覆盖钢结构、砌体、荷载、桩基、装配式等）
        'src/knowledge/extra/common-clauses.json'
    ];

    var allArticles = [];
    var loaded = false;
    var loadCallbacks = [];

    function loadAll(callback) {
        if (loaded) { callback(allArticles); return; }
        if (callback) loadCallbacks.push(callback);

        var remaining = STANDARD_FILES.length;
        STANDARD_FILES.forEach(function (path) {
            fetch(path)
                .then(function (resp) { return resp.json(); })
                .then(function (data) {
                    var fileStd = data.standard || '';
                    var fileStdName = data.standard_name || fileStd || '';
                    (data.articles || []).forEach(function (art) {
                        // 条文自带 standard 的（如跨规范摘编）优先用它，避免被文件名统一覆盖
                        if (!art.standard && fileStd) art.standard = fileStd;
                        if (!art.standard_name) {
                            art.standard_name = art.standard
                                ? (art.standard + (art.version ? ' ' + art.version : ''))
                                : fileStdName;
                        }
                        if (!art.article && art.clause) art.article = art.clause;
                        if (!art.article && art.no) art.article = art.no;
                        if (!art.status) art.status = 'draft_待校核正式规范';
                        if (!art.source_file) art.source_file = path;
                        allArticles.push(art);
                    });
                })
                .catch(function (err) {
                    console.warn('[KNOWLEDGE] 加载失败:', path, err);
                })
                .finally(function () {
                    remaining--;
                    if (remaining <= 0) {
                        loaded = true;
                        while (loadCallbacks.length > 0) {
                            var cb = loadCallbacks.shift();
                            try { cb(allArticles); } catch (e) { console.error(e); }
                        }
                    }
                });
        });
    }

    // 中文分词：标点切分 + 中文 2~4 字滑窗（弥补中文无空格导致的整句无法命中问题）
    function tokenize(text) {
        if (!text) return [];
        var raw = String(text).toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[０-９ａ-ｚＡ-Ｚ]/g, function (ch) {
                return String.fromCharCode(ch.charCodeAt(0) - 65248); // 全角转半角
            })
            .trim();
        var parts = raw.split(/[\s,，。、；;：:（）()【】\[\]《》""''\-—_/\\？！?！~·|]+/).filter(function (t) {
            return t && t.length > 0;
        });
        var out = [];
        parts.forEach(function (p) {
            if (out.indexOf(p) < 0) out.push(p);
            var segs = p.match(/[\u4e00-\u9fa5]+/g) || [];
            segs.forEach(function (seg) {
                for (var n = 2; n <= 4; n++) {
                    for (var i = 0; i + n <= seg.length; i++) {
                        var g = seg.substr(i, n);
                        if (out.indexOf(g) < 0) out.push(g);
                    }
                }
            });
        });
        return out;
    }

    // 从问题中抽取条文号（如 "8.5.1"、"6.2.10"、"5.2.4"）
    function extractClauses(text) {
        var m = String(text || '').match(/\d+(?:\.\d+){1,3}/g) || [];
        var out = [];
        m.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
        return out;
    }

    // 对一篇文章计算总分
    function scoreArticle(article, queryTokens, options) {
        var score = 0;
        var hitKeywords = [];
        var q = (options && options.rawQuery) ? options.rawQuery.toLowerCase() : '';
        var title = (article.title || '').toLowerCase();
        var content = (article.content || '').toLowerCase();
        var explanation = (article.explanation || '').toLowerCase();
        var keywords = (article.keywords || []).map(function (k) { return k.toLowerCase(); });

        // 1) 标题全匹配（加权最高）
        queryTokens.forEach(function (tok) {
            if (!tok) return;
            if (title.indexOf(tok) >= 0) { score += 10; if (hitKeywords.indexOf(tok) < 0) hitKeywords.push(tok); }
        });

        // 2) keywords 数组精确命中（加权高）
        keywords.forEach(function (kw) {
            queryTokens.forEach(function (tok) {
                if (!tok || tok.length < 2) return;
                if (kw === tok) { score += 8; if (hitKeywords.indexOf(kw) < 0) hitKeywords.push(kw); }
                else if (kw.indexOf(tok) >= 0 || tok.indexOf(kw) >= 0) {
                    score += 4;
                    if (hitKeywords.indexOf(kw) < 0) hitKeywords.push(kw);
                }
            });
        });

        // 3) content 命中
        queryTokens.forEach(function (tok) {
            if (!tok || tok.length < 2) return;
            if (content.indexOf(tok) >= 0) score += 2;
        });

        // 4) explanation 命中
        queryTokens.forEach(function (tok) {
            if (!tok || tok.length < 2) return;
            if (explanation.indexOf(tok) >= 0) score += 1.5;
        });

        // 5) 原文完整短语命中（比拆词更准）
        if (q && q.length >= 3) {
            if (title.indexOf(q) >= 0) score += 5;
            if (content.indexOf(q) >= 0) score += 2;
        }

        // 6) related_tools 加权（如果传入了 toolId 且该条文关联此工具）
        if (options && options.toolId && article.related_tools && article.related_tools.indexOf(options.toolId) >= 0) {
            score += 3;
        }

        // 7) 条文号命中（用户直接问「8.5.1 是什么」时权重最高）
        if (options && options.clauses && options.clauses.length) {
            var artNo = String(article.article || '');
            options.clauses.forEach(function (c) {
                if (artNo.indexOf(c) >= 0) score += 20;
            });
        }

        return { score: score, hitKeywords: hitKeywords };
    }

    /**
     * 检索规范条文
     * @param {string} query 查询词
     * @param {Object} options { toolId: string, limit: number }
     * @param {Function} callback 回调，参数为结果数组（空数组表示无命中）
     */
    function searchStandard(query, options, callback) {
        if (typeof options === 'function') { callback = options; options = {}; }
        if (!options) options = {};
        var limit = options.limit || 5;

        if (!query || !query.trim()) {
            callback([]);
            return;
        }

        loadAll(function () {
            var tokens = tokenize(query);
            var clauses = extractClauses(query);
            var scored = [];
            allArticles.forEach(function (art) {
                var s = scoreArticle(art, tokens, { rawQuery: query, toolId: options.toolId, clauses: clauses });
                if (s.score > 0) {
                    scored.push({
                        article: art,
                        score: s.score,
                        hit_keywords: s.hitKeywords
                    });
                }
            });

            // 按分数降序
            scored.sort(function (a, b) { return b.score - a.score; });

            // 取 top N
            var top = scored.slice(0, limit);

            callback(top.map(function (item) {
                return {
                    id: item.article.id,
                    standard: item.article.standard,
                    standard_name: item.article.standard_name || item.article.standard,
                    version: item.article.version,
                    chapter: item.article.chapter,
                    article: item.article.article,
                    title: item.article.title,
                    keywords: item.article.keywords,
                    content: item.article.content,
                    explanation: item.article.explanation,
                    related_tools: item.article.related_tools || [],
                    status: item.article.status,
                    score: item.score,
                    hit_keywords: item.hit_keywords
                };
            }));
        });
    }

    /**
     * 按 toolId 查找关联的规范条文
     * @param {string} toolId
     * @param {Function} callback
     */
    function getStandardsForTool(toolId, callback) {
        loadAll(function () {
            var found = allArticles.filter(function (art) {
                return art.related_tools && art.related_tools.indexOf(toolId) >= 0;
            });
            callback(found.map(function (art) {
                return {
                    id: art.id,
                    standard: art.standard,
                    standard_name: art.standard_name || art.standard,
                    chapter: art.chapter,
                    article: art.article,
                    title: art.title,
                    status: art.status
                };
            }));
        });
    }

    // 暴露到全局
    window.KNOWLEDGE_BASE = {
        searchStandard: searchStandard,
        getStandardsForTool: getStandardsForTool,
        isLoaded: function () { return loaded; },
        loadAll: loadAll
    };

    console.log('[Knowledge Base] 模块已加载。调用 KNOWLEDGE_BASE.searchStandard(query, opts, cb) 检索规范条文。');
})();
