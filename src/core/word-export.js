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
            var result = [], options = Object.assign({ font: FONT, size: 24 }, inherited || {});
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
        function paragraph(nodes, parent, inTable) {
            var tag = parent.tagName || '', cls = parent.className || '';
            var heading = /^H[1-6]$/.test(tag) || /step-title|calc-step-title/.test(cls);
            var centered = tag === 'H1' || /^(org|calc-name|sub|subtitle)$/.test(cls) || !!parent.closest('.cover');
            var style = tag === 'H1' ? 'BookTitle' : tag === 'H2' ? 'Heading1' : heading ? 'Heading2' : inTable ? 'TableText' : /ref-box|note|small/.test(cls) ? 'ReferenceText' : 'Normal';
            var small = !!parent.closest('.ref-box, .note, .small');
            var children = nodes.flatMap(function(n) { return runs(n, { size: inTable ? 21 : heading ? tag === 'H1' ? 36 : tag === 'H2' ? 28 : 24 : small ? 20 : 24, font: heading ? HEAD_FONT : FONT, bold: heading }); });
            if (!children.length) return null;
            return new D.Paragraph({ style: style, children: children, alignment: centered ? D.AlignmentType.CENTER : D.AlignmentType.LEFT,
                keepNext: heading, keepLines: heading, widowControl: true,
                spacing: { before: heading ? 200 : 0, after: heading ? 100 : inTable ? 40 : 90, line: 300 },
                indent: tag === 'LI' ? { left: 240 } : undefined });
        }
        function table(el) {
            var rows = Array.from(el.rows);
            var count = Math.max.apply(null, rows.map(function(r) { return Array.from(r.cells).reduce(function(n,c) { return n + c.colSpan; }, 0); }));
            if (!count) return null;
            var weights = count === 2 ? [32,68] : count === 3 ? [45,35,20] : count === 4 ? [8,47,15,30] : count === 5 ? [6,28,23,18,25] : Array(count).fill(100/count);
            var widths = weights.map(function(w) { return Math.floor(WIDTH*w/100); });
            widths[widths.length-1] += WIDTH - widths.reduce(function(a,b) { return a+b; },0);
            var plain = el.classList.contains('sign') || el.classList.contains('cover-table');
            var border = { style: plain ? D.BorderStyle.NONE : D.BorderStyle.SINGLE, size: 4, color: 'B8C3CE' };
            return new D.Table({ width: { size: WIDTH, type: D.WidthType.DXA }, columnWidths: widths, layout: D.TableLayoutType.FIXED,
                borders: { top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border },
                rows: rows.map(function(row, index) {
                    var header = index === 0 && Array.from(row.cells).some(function(c) { return c.tagName === 'TH'; });
                    var column = 0;
                    return new D.TableRow({ tableHeader: header, cantSplit: row.textContent.length < 700, children: Array.from(row.cells).map(function(cell) {
                        var width = widths.slice(column,column+cell.colSpan).reduce(function(a,b) { return a+b; },0); column += cell.colSpan;
                        var children = blocks(cell, true);
                        if (!children.length || !(children[children.length-1] instanceof D.Paragraph)) children.push(new D.Paragraph({ style: 'TableText' }));
                        return new D.TableCell({ children: children, width: { size: width, type: D.WidthType.DXA }, columnSpan: cell.colSpan,
                            borders: plain && row.classList.contains('line') ? { bottom:{style:D.BorderStyle.SINGLE,size:4,color:'707070'} } : undefined,
                            rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined, verticalAlign: D.VerticalAlign.CENTER,
                            shading: header ? { fill: 'EAF0F6' } : undefined, margins: { top:80,bottom:80,left:110,right:110 } });
                    }) });
                }) });
        }
        function blocks(parent, inTable) {
            var out = [], pending = [];
            function flush() { if (pending.some(function(n) { return n.textContent.trim(); })) { var p=paragraph(pending,parent,inTable);if(p)out.push(p); } pending=[]; }
            Array.from(parent.childNodes).forEach(function(n) {
                if (n.nodeType === 1 && /^(SCRIPT|STYLE|BUTTON|SVG|CANVAS)$/.test(n.tagName)) return;
                if (n.nodeType === 1 && (n.classList.contains('footer') || n.classList.contains('proc-copy-msg'))) return;
                if (!isBlock(n)) { pending.push(n); return; }
                flush();
                if (n.style.pageBreakAfter === 'always' || n.classList.contains('page-break')) {
                    if (n.textContent.trim() && n.textContent.trim() !== '\u00a0') out=out.concat(blocks(n,inTable));
                    out.push(new D.Paragraph({ children:[new D.TextRun({ break:1 })], pageBreakBefore:true, spacing:{after:0,before:0} })); return;
                }
                if (n.tagName === 'TABLE') { var t=table(n);if(t)out.push(t);out.push(new D.Paragraph({spacing:{after:80},children:[]}));return; }
                if (Array.from(n.childNodes).some(isBlock)) out=out.concat(blocks(n,inTable));
                else { var p=paragraph(Array.from(n.childNodes),n,inTable);if(p && n.textContent.trim())out.push(p); }
            }); flush(); return out;
        }
        var content = blocks(dom.body, false);
        var footer = new D.Footer({ children: [new D.Paragraph({ alignment:D.AlignmentType.CENTER, children:[
            new D.TextRun({text:'第 ',size:18,font:FONT}), new D.TextRun({children:[D.PageNumber.CURRENT],size:18}),
            new D.TextRun({text:' 页 / 共 ',size:18,font:FONT}),new D.TextRun({children:[D.PageNumber.TOTAL_PAGES],size:18}),new D.TextRun({text:' 页',size:18,font:FONT})
        ]})] });
        return new D.Document({ creator:'结构计算工具箱', title:title || dom.title || '结构计算书',
            styles:{ default:{ document:{run:{font:FONT,size:24},paragraph:{spacing:{after:90,line:300}}} }, paragraphStyles:[
                {id:'BookTitle',name:'计算书标题',basedOn:'Normal',run:{font:HEAD_FONT,size:36,bold:true},paragraph:{keepNext:true}},
                {id:'Heading1',name:'一级标题',basedOn:'Normal',next:'Normal',run:{font:HEAD_FONT,size:28,bold:true},paragraph:{outlineLevel:0,keepNext:true}},
                {id:'Heading2',name:'二级标题',basedOn:'Normal',next:'Normal',run:{font:HEAD_FONT,size:24,bold:true},paragraph:{outlineLevel:1,keepNext:true}},
                {id:'TableText',name:'表格正文',basedOn:'Normal',run:{font:FONT,size:21}},
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
