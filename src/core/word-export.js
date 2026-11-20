/* Native OOXML export. All existing calculation templates use this shared renderer. */
(function () {
    'use strict';
    var FONT = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体', cs: 'Times New Roman' };
    var HEAD_FONT = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: '黑体', cs: 'Arial' };
    var WIDTH = 9638; // A4 minus 20 mm left/right margins, in twips.
    function build(html, title) {
        var D = window.docx;
        if (!D) throw new Error('Word 导出组件未加载，请刷新页面后重试。');
        var dom = new DOMParser().parseFromString(html, 'text/html');
        var blockTags = /^(DIV|P|H[1-6]|TABLE|UL|OL|LI|SECTION|ARTICLE|DETAILS|SUMMARY|BLOCKQUOTE|PRE)$/;
        function isBlock(n) { return n.nodeType === 1 && blockTags.test(n.tagName); }
        function runs(node, inherited) {
            var result = [], options = Object.assign({}, inherited || {});
            if (node.nodeType === 3) {
                var text = node.nodeValue.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ');
                if (text) result.push(new D.TextRun(Object.assign({}, options, { text: text })));
                return result;
            }
            if (node.nodeType !== 1 || /^(SCRIPT|STYLE|BUTTON|SVG|CANVAS|INPUT|SELECT)$/.test(node.tagName)) return result;
            if (node.tagName === 'BR') return [new D.TextRun({ break: 1 })];
            if (/^(B|STRONG|TH)$/.test(node.tagName)) options.bold = true;
            if (/^(I|EM)$/.test(node.tagName)) options.italics = true;
            if (node.tagName === 'SUB') options.subScript = true;
            if (node.tagName === 'SUP') options.superScript = true;
            var href = node.getAttribute('href');
            if (node.tagName === 'A' && /^https?:\/\//i.test(href || '')) {
                return [new D.ExternalHyperlink({ link: href, children: Array.from(node.childNodes).flatMap(function(n) { return runs(n, Object.assign({}, options, { color: '245A81', underline: {} })); }) })];
            }
            Array.from(node.childNodes).forEach(function(n) { result = result.concat(runs(n, options)); });
            return result;
        }
        var nextPage = false;
        function paragraph(nodes, parent, cellFormat) {
            var tag = parent.tagName || '';
            var cover = !!parent.closest('.cover');
            var title = tag === 'H1';
            var heading = /^H[1-6]$/.test(tag) || parent.matches('.step-title, .calc-step-title');
            var small = !!parent.closest('.ref-box, .note, .small');
            var subtitle = parent.matches('.sub, .subtitle, .calc-name');
            var formula = !!parent.closest('.formula-box');
            var style = title ? 'Title' : tag === 'H2' ? 'Heading1' : heading ? 'Heading2' :
                cellFormat ? 'TableText' : formula ? 'FormulaText' : small ? 'ReferenceText' : 'Normal';
            var sectionLabel = !cellFormat && /[：:]$/.test(parent.textContent.trim()) && parent.children.length === 1;
            var options = cellFormat ? { size: cellFormat.size, bold: cellFormat.header } : {};
            if (heading) options.font = HEAD_FONT;
            if (subtitle || parent.matches('.org')) options.color = '475569';
            var children = nodes.flatMap(function(n) { return runs(n, options); });
            if (!children.length) return null;
            var before = title ? (cover ? 680 : 0) : heading ? 180 : 0;
            var after = title ? 140 : heading ? 70 : cellFormat ? 0 : 60;
            if (parent.matches('.org')) before = 840;
            if (parent.matches('.calc-name')) after = 640;
            return new D.Paragraph({ style: style, children: children,
                alignment: cellFormat ? cellFormat.align : title || subtitle || cover ? D.AlignmentType.CENTER : D.AlignmentType.LEFT,
                pageBreakBefore: nextPage || undefined,
                keepNext: heading || sectionLabel || !!(cellFormat && cellFormat.keepNext),
                keepLines: heading || formula, widowControl: true,
                spacing: { before: before, after: after, line: cellFormat ? 255 : 305 },
                indent: formula || tag === 'LI' ? { left: 240 } : undefined });
        }
        function columnWeights(rows, count, signature) {
            var cells = Array.from(rows[0].cells);
            var labels = cells.map(function(c) { return c.textContent.trim(); });
            if (signature) return Array(count).fill(1);
            if (count === 2) return /^(序号|步骤)$/.test(labels[0]) ? [10,90] : [32,68];
            if (count === 3 && labels[0] === '序号') return [8,46,46];
            if (count === 3 && labels[2] === '单位') return [48,34,18];
            if (count === 4 && labels[0] === '序号') return [8,43,15,34];
            if (count === 5 && labels[0] === '序号' && labels[3] === '页码') return [8,29,20,12,31];
            // Bound long descriptions so one cell cannot squeeze every other column.
            var weights = Array(count).fill(4);
            rows.forEach(function(row) {
                var column = 0;
                Array.from(row.cells).forEach(function(cell) {
                    if (cell.colSpan === 1) {
                        var text = cell.textContent.trim().replace(/[^\x00-\x7F]/g, 'xx');
                        weights[column] = Math.max(weights[column], Math.min(text.length, count > 6 ? 12 : 28));
                    }
                    column += cell.colSpan;
                });
            });
            return weights;
        }
        function table(el, availableWidth) {
            var rows = Array.from(el.rows);
            var count = Math.max(0, ...rows.map(function(r) { return Array.from(r.cells).reduce(function(n,c) { return n + c.colSpan; }, 0); }));
            if (!count) return null;
            var signature = el.classList.contains('sign');
            var plain = signature || el.classList.contains('cover-table');
            var weights = columnWeights(rows, count, signature);
            var total = weights.reduce(function(a,b) { return a+b; },0);
            var widths = weights.map(function(w) { return Math.floor(availableWidth*w/total); });
            widths[widths.length-1] += availableWidth - widths.reduce(function(a,b) { return a+b; },0);
            var border = { style: plain ? D.BorderStyle.NONE : D.BorderStyle.SINGLE, size: 4, color: 'B8C3CE' };
            return new D.Table({ width: { size: availableWidth, type: D.WidthType.DXA }, columnWidths: widths, layout: D.TableLayoutType.FIXED,
                borders: { top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border },
                rows: rows.map(function(row, index) {
                    var header = index === 0 && Array.from(row.cells).some(function(c) { return c.tagName === 'TH'; });
                    var column = 0;
                    return new D.TableRow({ tableHeader: header, cantSplit: row.textContent.length < 700, children: Array.from(row.cells).map(function(cell) {
                        var width = widths.slice(column,column+cell.colSpan).reduce(function(a,b) { return a+b; },0); column += cell.colSpan;
                        var value = cell.textContent.trim();
                        var isLabel = cell.tagName === 'TH' || cell.classList.contains('lab');
                        var numeric = /^[+−–-]?[\d.,]+(?:%|‰)?$/.test(value);
                        var indexColumn = column === 1 && /^(序号|步骤)$/.test(rows[0].cells[0].textContent.trim());
                        var centered = header || signature || indexColumn;
                        var padding = count > 7 ? 45 : 90;
                        var format = { availableWidth: width - 2*padding, size: count > 7 ? 18 : 21, header: isLabel,
                            align: centered ? D.AlignmentType.CENTER : numeric ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT,
                            keepNext: header || (signature && index < rows.length-1) };
                        var children = blocks(cell, format);
                        if (!children.length || !(children[children.length-1] instanceof D.Paragraph)) children.push(new D.Paragraph({ style: 'TableText', keepNext: format.keepNext, spacing:{after:0} }));
                        return new D.TableCell({ children: children, width: { size: width, type: D.WidthType.DXA }, columnSpan: cell.colSpan,
                            borders: plain && row.classList.contains('line') ? { bottom:{style:D.BorderStyle.SINGLE,size:4,color:'707070'} } : undefined,
                            rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined, verticalAlign: D.VerticalAlign.CENTER,
                            shading: header ? { fill: 'EAF0F6' } : undefined, margins: { top:signature ? 110 : 55, bottom:55, left:padding, right:padding } });
                    }) });
                }) });
        }
        function blocks(parent, inTable) {
            var out = [], pending = [];
            function addParagraph(nodes, parent) {
                var p = paragraph(nodes, parent, inTable);
                if (p) { out.push(p); nextPage = false; }
            }
            function flush() { if (pending.some(function(n) { return n.textContent.trim(); })) { addParagraph(pending,parent); } pending=[]; }
            Array.from(parent.childNodes).forEach(function(n) {
                if (n.nodeType === 1 && /^(SCRIPT|STYLE|BUTTON|SVG|CANVAS)$/.test(n.tagName)) return;
                if (n.nodeType === 1 && (n.classList.contains('footer') || n.classList.contains('proc-copy-msg'))) return;
                if (!isBlock(n)) { pending.push(n); return; }
                flush();
                if (n.style.pageBreakAfter === 'always' || n.classList.contains('page-break')) {
                    if (n.textContent.trim() && n.textContent.trim() !== '\u00a0') out=out.concat(blocks(n,inTable));
                    nextPage = true; return;
                }
                if (n.tagName === 'TABLE') {
                    if (out[out.length-1] instanceof D.Table) {
                        out.push(new D.Paragraph({ spacing:{before:0,after:0,line:100,lineRule:D.LineRuleType.EXACT} }));
                    }
                    var t = table(n, inTable ? inTable.availableWidth : WIDTH);
                    if (t) out.push(t);
                    return;
                }
                if (Array.from(n.childNodes).some(isBlock)) out=out.concat(blocks(n,inTable));
                else { if (n.textContent.trim()) addParagraph(Array.from(n.childNodes),n); }
            }); flush(); return out;
        }
        var content = blocks(dom.body, false);
        var footer = new D.Footer({ children: [new D.Paragraph({ alignment:D.AlignmentType.CENTER, children:[
            new D.TextRun({text:'第 ',size:18,font:FONT}), new D.TextRun({children:[D.PageNumber.CURRENT],size:18}),
            new D.TextRun({text:' 页 / 共 ',size:18,font:FONT}),new D.TextRun({children:[D.PageNumber.TOTAL_PAGES],size:18}),new D.TextRun({text:' 页',size:18,font:FONT})
        ]})] });
        return new D.Document({ creator:'结构计算工具箱', title:title || dom.title || '结构计算书',
            styles:{ default:{ document:{run:{font:FONT,size:22},paragraph:{spacing:{after:60,line:305}}} }, paragraphStyles:[
                {id:'Title',name:'计算书标题',basedOn:'Normal',run:{font:HEAD_FONT,size:36,bold:true},paragraph:{keepNext:true}},
                {id:'Heading1',name:'一级标题',basedOn:'Normal',next:'Normal',run:{font:HEAD_FONT,size:28,bold:true},paragraph:{outlineLevel:0,keepNext:true}},
                {id:'Heading2',name:'二级标题',basedOn:'Normal',next:'Normal',run:{font:HEAD_FONT,size:24,bold:true},paragraph:{outlineLevel:1,keepNext:true}},
                {id:'TableText',name:'表格正文',basedOn:'Normal',run:{font:FONT,size:21}},
                {id:'FormulaText',name:'计算公式',basedOn:'Normal',run:{font:FONT,size:22}},
                {id:'ReferenceText',name:'依据说明',basedOn:'Normal',run:{font:FONT,size:20,color:'505B65'}}
            ]}, sections:[{ properties:{ page:{size:{width:11906,height:16838},margin:{top:1361,bottom:1247,left:1134,right:1134,header:600,footer:600}} }, footers:{default:footer},children:content }] });
    }
    window.buildNativeWordDocument = build;
    var busy = false;
    window.downloadNativeWord = async function(name, html) {
        if (busy) return;
        busy = true;
        var buttons = Array.from(document.querySelectorAll('#btn-export, #uxWord'));
        var labels = buttons.map(function(b) { var label=b.textContent;b.disabled=true;b.textContent='正在生成…';return label; });
        try {
            var blob = await window.docx.Packer.toBlob(build(html,name));
            var url=URL.createObjectURL(blob),a=document.createElement('a');
            a.href=url;a.download=String(name).replace(/\.docx?$/i,'')+'.docx';document.body.appendChild(a);a.click();a.remove();
            setTimeout(function(){URL.revokeObjectURL(url);},30000);
        } catch (err) { console.error('Word export failed:',err);alert('Word 导出失败：'+err.message); }
        finally { busy=false;buttons.forEach(function(b,i) { b.disabled=false;b.textContent=labels[i]; }); }
    };
})();
