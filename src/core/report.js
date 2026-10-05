/* ============================================================
 *  core/report.js — 计算书生成与导出
 * ------------------------------------------------------------
 *  含：规范依据库（TYAI_CODE_REFS）、统一计算书数据组装、
 *  A4 打印样式（CALC_BOOK_CSS）、封面 / 签署栏 / 页脚组件、
 *  Word(.doc) 导出（buildWordCalcBookHtml / downloadDoc / exportBook）
 *  以及受弯、AAC 外墙板、保温锚固件、预制构件等专用计算书模板。
 * ============================================================ */
/* ===================== TYAI 规范依据库 ===================== */
var TYAI_CODE_REFS = {
    gb50010: {
        name: '《混凝土结构设计规范》GB/T 50010-2010（2024年版）',
        note: '用户已上传，但当前解析为乱码，条文号和页码需用可检索版 PDF 或截图复核',
        refs: {
            materialStrength: { clause: '待核对', page: '待核对', desc: '混凝土、钢筋强度设计值' },
            flexuralCapacity: { clause: '待核对', page: '待核对', desc: '正截面受弯承载力计算' },
            shearCapacity: { clause: '待核对', page: '待核对', desc: '斜截面受剪承载力计算' },
            crackWidth: { clause: '待核对', page: '待核对', desc: '裂缝宽度验算' },
            deflection: { clause: '待核对', page: '待核对', desc: '挠度验算' },
            minRebar: { clause: '待核对', page: '待核对', desc: '最小配筋率及构造要求' },
            anchorage: { clause: '待核对', page: '待核对', desc: '钢筋锚固与搭接' }
        }
    },
    g101_22: {
        name: '《混凝土结构施工图平面整体表示方法制图规则和构造详图》22G101-1',
        refs: {
            compileBasis: { clause: '编制说明第2条', page: '第1页', desc: '图集依据的主要标准规范' },
            generalRule: { clause: '第1.0.1～1.0.8条', page: '第1-1页', desc: '平法制图总则及结构层标高、层高表达' },
            drawingMustNote: { clause: '第1.0.9条', page: '第1-1～1-2页', desc: '施工图必须写明的设计信息' },
            detailSelection: { clause: '第1.0.10条', page: '第1-2页', desc: '标准构造详图有多种做法时应注明选用' },
            anchorageLapGeneral: { clause: '第1.0.12条', page: '第1-2页', desc: '钢筋搭接和锚固长度按标准构造详图执行' },
            columnRule: { clause: '第2.1～2.4节', page: '第1-3～1-6页', desc: '柱平法施工图制图规则' },
            wallRule: { clause: '第3.1～3.2节', page: '第1-9～1-10页', desc: '剪力墙平法施工图制图规则' },
            coverConcrete: { clause: '标准构造详图', page: '第2-1页', desc: '混凝土结构环境类别、保护层最小厚度' },
            basicAnchorage: { clause: '标准构造详图', page: '第2-2页', desc: '受拉钢筋基本锚固长度、抗震基本锚固长度、弯折弯弧内直径' },
            anchorageLength: { clause: '标准构造详图', page: '第2-3页', desc: '受拉钢筋锚固长度、抗震锚固长度' },
            hookMechanical: { clause: '标准构造详图', page: '第2-4页', desc: '纵向钢筋弯钩、机械锚固、搭接区箍筋、钢筋连接' },
            lapLength: { clause: '标准构造详图', page: '第2-5页', desc: '纵向受拉钢筋搭接长度' },
            seismicLapLength: { clause: '标准构造详图', page: '第2-6页', desc: '纵向受拉钢筋抗震搭接长度' },
            stirrupHook: { clause: '标准构造详图', page: '第2-7页', desc: '封闭箍筋、拉筋、螺旋箍筋构造' },
            rebarSpacing: { clause: '标准构造详图', page: '第2-8页', desc: '梁柱纵筋间距、并筋等效直径、净距、保护层厚度表' },
            columnConnection: { clause: '标准构造详图', page: '第2-9～2-18页', desc: '框架柱纵筋连接、箍筋加密区、柱顶纵筋、变截面及箍筋复合方式' },
            wallDetail: { clause: '标准构造详图', page: '第2-19～2-32页', desc: '剪力墙水平/竖向分布钢筋、边缘构件、连梁、洞口补强等构造' },
            beamDetail: { clause: '标准构造详图', page: '第2-33～2-49页', desc: '框架梁、屋面框架梁、非框架梁、悬挑梁、井字梁等构造' },
            slabDetail: { clause: '标准构造详图', page: '第2-50～2-58页', desc: '有梁楼盖、无梁楼盖、板端锚固、板带、柱上板带等构造' },
            postPouringOpening: { clause: '标准构造详图', page: '第2-59～2-67页', desc: '后浇带、板加腋、局部升降板、板开洞、抗冲切构造' },
            mandatorySelection: { clause: '附录C', page: '第2-78页', desc: '设计必须写明的构造做法选用' }
        }
    },
    db37_5216: {
        name: '《混凝土叠合板应用技术标准》DB37/T 5216-2022',
        refs: {
            general: { clause: '第1章', page: '第1页', desc: '总则' },
            terms: { clause: '第2.1节', page: '第2页', desc: '术语' },
            symbols: { clause: '第2.2节', page: '第4页', desc: '符号' },
            basic: { clause: '第3章', page: '第6页', desc: '基本规定' },
            concrete: { clause: '第4.1节', page: '第7页', desc: '混凝土材料' },
            reinforcement: { clause: '第4.2节', page: '第7页', desc: '钢筋和钢材' },
            otherMaterials: { clause: '第4.3节', page: '第8页', desc: '其他材料' },
            trussSlabGeneral: { clause: '第5.1节', page: '第9页', desc: '钢筋桁架混凝土叠合板一般规定' },
            trussSlabTransient: { clause: '第5.2节', page: '第9页', desc: '钢筋桁架混凝土叠合板短暂设计状况' },
            trussSlabPermanent: { clause: '第5.3节', page: '第12页', desc: '钢筋桁架混凝土叠合板持久设计状况' },
            trussSlabBottom: { clause: '第5.4节', page: '第13页', desc: '钢筋桁架混凝土叠合板底板构造' },
            trussSlabJoint: { clause: '第5.5节', page: '第16页', desc: '钢筋桁架混凝土叠合板板缝构造' },
            trussSlabEnd: { clause: '第5.6节', page: '第20页', desc: '钢筋桁架混凝土叠合板板端构造' },
            detachableGeneral: { clause: '第6.1节', page: '第23页', desc: '可拆卸钢管支架混凝土叠合板一般规定' },
            detachableTransient: { clause: '第6.2节', page: '第23页', desc: '可拆卸钢管支架混凝土叠合板短暂设计状况' },
            detachablePermanent: { clause: '第6.3节', page: '第24页', desc: '可拆卸钢管支架混凝土叠合板持久设计状况' },
            detachableBottom: { clause: '第6.4节', page: '第25页', desc: '可拆卸钢管支架混凝土叠合板底板构造' },
            detachableJoint: { clause: '第6.5节', page: '第26页', desc: '可拆卸钢管支架混凝土叠合板板缝构造' },
            detachableEnd: { clause: '第6.6节', page: '第26页', desc: '可拆卸钢管支架混凝土叠合板板端构造' },
            production: { clause: '第10章', page: '第49页', desc: '底板生产与运输' },
            construction: { clause: '第11章', page: '第62页', desc: '施工安装' },
            acceptance: { clause: '第12章', page: '第66页', desc: '质量验收' }
        }
    },
    gb50011: {
        name: '《建筑抗震设计规范》GB/T 50011-2010（2024年版）',
        note: '用户已上传PDF，已提取第7/8/9/12章及附录A/D内容',
        refs: {
            seismicGrade: { clause: '§6.1.2+表6.1.2', page: '第49-52页', desc: '现浇钢筋混凝土房屋抗震等级' },
            masonryShear: { clause: '§7.2.6~7.2.8', page: '第85-88页', desc: '砌体抗震抗剪强度及受剪承载力' },
            masonryHeight: { clause: '表7.1.2', page: '第77页', desc: '砌体房屋层数和总高度限值' },
            steelHeight: { clause: '表8.1.1', page: '第102页', desc: '钢结构房屋最大高度' },
            steelGrade: { clause: '表8.1.3', page: '第103页', desc: '钢结构房屋抗震等级' },
            steelWidthRatio: { clause: '表8.3.2', page: '第108页', desc: '钢框架梁柱板件宽厚比限值' },
            jointCore: { clause: '附录D', page: '第294-297页', desc: '框架梁柱节点核芯区截面抗震验算' },
            isolation: { clause: '§12.2', page: '第155-162页', desc: '隔震房屋设计计算' },
            isolationBearing: { clause: '附录L', page: '第310-320页', desc: '隔震支座性能要求与验算' },
            cityParams: { clause: '附录A', page: '第260-290页', desc: '我国主要城镇抗震设防烈度等参数' }
        }
    }
};

/* ===================== TYAI 统一计算书生成 ===================== */
function tyaiRefText(ref) {
    if (!ref) return '';
    if (typeof ref === 'string') return ref;
    var parts = [];
    if (ref.name) parts.push(ref.name);
    if (ref.clause) parts.push(ref.clause);
    if (ref.page) parts.push(ref.page);
    if (ref.desc) parts.push('——' + ref.desc);
    return parts.join('，');
}
function tyaiStepHtml(step, index) {
    var refs = step.refs || [];
    var refsHtml = '';
    if (refs.length) {
        var items = '';
        for (var i = 0; i < refs.length; i++) {
            items += '<li>' + tyaiRefText(refs[i]) + '</li>';
        }
        refsHtml = '<div class="calc-ref"><b>规范依据：</b><ul>' + items + '</ul></div>';
    } else {
        refsHtml = '<div class="calc-ref warn"><b>规范依据：</b>待补充</div>';
    }
    return '<div class="calc-step">' +
        '<h4>' + (index + 1) + '. ' + (step.title || '计算步骤') + '</h4>' +
        (step.assumption ? '<p><b>计算假定：</b>' + step.assumption + '</p>' : '') +
        (step.formula ? '<p><b>计算公式：</b><code>' + step.formula + '</code></p>' : '') +
        (step.substitution ? '<p><b>代入过程：</b>' + step.substitution + '</p>' : '') +
        (step.middle ? '<p><b>中间结果：</b>' + step.middle + '</p>' : '') +
        (step.result ? '<p><b>计算结果：</b>' + step.result + '</p>' : '') +
        (step.judge ? '<p><b>验算判断：</b>' + step.judge + '</p>' : '') +
        refsHtml +
        '</div>';
}
function tyaiRenderCalcBook(targetSelector, book) {
    var target = document.querySelector(targetSelector);
    if (!target) return;
    var steps = book.steps || [];
    var inputsHtml = '';
    for (var i = 0; i < (book.inputs || []).length; i++) {
        var item = book.inputs[i];
        inputsHtml += '<tr><th>' + item.name + '</th><td>' + item.value + (item.unit || '') + '</td></tr>';
    }
    var stepsHtml = '';
    for (var j = 0; j < steps.length; j++) {
        stepsHtml += tyaiStepHtml(steps[j], j);
    }
    var allRefs = collectRefs(steps);
    var refsHtml = '';
    for (var k = 0; k < allRefs.length; k++) {
        refsHtml += '<li>' + tyaiRefText(allRefs[k]) + '</li>';
    }
    target.innerHTML =
        '<section class="calc-book">' +
        '<h3>' + (book.title || '计算书') + '</h3>' +
        '<div class="calc-meta">' +
        '<p><b>计算工具：</b>' + (book.toolName || '-') + '</p>' +
        '<p><b>计算时间：</b>' + new Date().toLocaleString() + '</p>' +
        '</div>' +
        '<h4>一、输入参数</h4>' +
        '<table class="mini"><tbody>' + inputsHtml + '</tbody></table>' +
        '<h4>二、计算过程</h4>' + stepsHtml +
        '<h4>三、结论</h4><p>' + (book.conclusion || '-') + '</p>' +
        '<h4>四、规范依据汇总</h4><ul>' + refsHtml + '</ul>' +
        '</section>';
}
function collectRefs(steps) {
    var map = {};
    var result = [];
    for (var i = 0; i < steps.length; i++) {
        var refs = steps[i].refs || [];
        for (var j = 0; j < refs.length; j++) {
            var text = tyaiRefText(refs[j]);
            if (text && !map[text]) {
                map[text] = true;
                result.push(refs[j]);
            }
        }
    }
    return result;
}
function tyaiCalcBookText(book) {
    var lines = [];
    lines.push(book.title || '计算书');
    lines.push('');
    lines.push('一、输入参数');
    var inputs = book.inputs || [];
    for (var i = 0; i < inputs.length; i++) {
        lines.push(inputs[i].name + '：' + inputs[i].value + (inputs[i].unit || ''));
    }
    lines.push('');
    lines.push('二、计算过程');
    var steps = book.steps || [];
    for (var j = 0; j < steps.length; j++) {
        var step = steps[j];
        lines.push('');
        lines.push((j + 1) + '. ' + (step.title || '计算步骤'));
        if (step.assumption) lines.push('计算假定：' + step.assumption);
        if (step.formula) lines.push('计算公式：' + step.formula);
        if (step.substitution) lines.push('代入过程：' + step.substitution);
        if (step.middle) lines.push('中间结果：' + step.middle);
        if (step.result) lines.push('计算结果：' + step.result);
        if (step.judge) lines.push('验算判断：' + step.judge);
        if (step.refs && step.refs.length) {
            lines.push('规范依据：');
            for (var k = 0; k < step.refs.length; k++) {
                lines.push('- ' + tyaiRefText(step.refs[k]));
            }
        } else {
            lines.push('规范依据：待补充');
        }
    }
    lines.push('');
    lines.push('三、结论');
    lines.push(book.conclusion || '-');
    lines.push('');
    lines.push('四、规范依据汇总');
    var allRefs = collectRefs(steps);
    for (var m = 0; m < allRefs.length; m++) {
        lines.push('- ' + tyaiRefText(allRefs[m]));
    }
    return lines.join('\n');
}

function buildBeamRectBook(r) {
    var gb = TYAI_CODE_REFS.gb50010;
    var isD = r.isD;
    var inputs = [
        { name: '截面宽度 b', value: fmt(r.b, 0), unit: ' mm' },
        { name: '截面高度 h', value: fmt(r.h, 0), unit: ' mm' },
        { name: '混凝土强度等级', value: r.conGrade },
        { name: '钢筋级别', value: r.rebGrade },
        { name: '受拉钢筋面积 As', value: fmt(r.As, 1), unit: ' mm²' },
        { name: '受压钢筋面积 As′', value: fmt(r.AsP, 1), unit: ' mm²' },
        { name: '受拉筋合力点 as', value: fmt(r.asV, 0), unit: ' mm' },
        { name: '受压筋合力点 as′', value: fmt(r.as2V, 0), unit: ' mm' }
    ];
    var steps = [];
    // 步骤 1：截面有效高度与材料参数
    steps.push({
        title: '截面有效高度与材料参数',
        formula: 'h₀ = h − a<sub>s</sub>',
        substitution: 'h₀ = ' + fmt(r.h, 0) + ' − ' + fmt(r.asV, 0) + ' = ' + fmt(r.h0, 0) + ' mm',
        result: 'f<sub>c</sub> = ' + fmt(r.fc, 2) + ' N/mm²，f<sub>t</sub> = ' + fmt(r.ft, 2) + ' N/mm²，f<sub>y</sub> = ' + fmt(r.fy, 0) + ' N/mm²，α<sub>1</sub> = ' + fmt(r.alpha1, 2) + '，β<sub>1</sub> = ' + fmt(r.beta1, 2),
        refs: [
            { name: gb.name, clause: gb.refs.materialStrength.clause, page: gb.refs.materialStrength.page, desc: gb.refs.materialStrength.desc },
            { name: gb.name, clause: '第 6.2.10 条', page: '待核对', desc: '矩形截面受弯构件正截面承载力计算基本假定' }
        ]
    });
    // 步骤 2：界限受压区高度
    steps.push({
        title: '界限相对受压区高度',
        formula: 'ξ<sub>b</sub> = β<sub>1</sub> / (1 + f<sub>y</sub> / (E<sub>s</sub>·ε<sub>cu</sub>))',
        substitution: 'ξ<sub>b</sub> = ' + fmt(r.beta1, 2) + ' / (1 + ' + fmt(r.fy, 0) + ' / (' + fmt(r.es, 0) + ' × ' + r.ecu + ')) = ' + fmt(r.xi_b, 4),
        result: 'ξ<sub>b</sub> = ' + fmt(r.xi_b, 4),
        refs: [
            { name: gb.name, clause: '第 6.2.6 条', page: '待核对', desc: '相对界限受压区高度计算' }
        ]
    });
    // 步骤 3：受压区高度（分支）
    if (!isD) {
        steps.push({
            title: '受压区高度（单筋矩形截面）',
            formula: 'x = f<sub>y</sub>·A<sub>s</sub> / (α<sub>1</sub>·f<sub>c</sub>·b)',
            substitution: 'x = ' + fmt(r.fy, 0) + ' × ' + fmt(r.As, 1) + ' / (' + fmt(r.alpha1, 1) + ' × ' + fmt(r.fc, 2) + ' × ' + fmt(r.b, 0) + ') = ' + fmt(r.x, 1) + ' mm',
            result: 'x = ' + fmt(r.x, 1) + ' mm，ξ = ' + fmt(r.xi, 4) + (r.over ? ' ＞ ξ<sub>b</sub> = ' + fmt(r.xi_b, 4) + '，超筋' : ' ≤ ξ<sub>b</sub> = ' + fmt(r.xi_b, 4) + '，适筋'),
            judge: r.over ? '超筋，按界限破坏取 x = x<sub>b</sub>' : '适筋截面，受拉钢筋屈服',
            refs: [
                { name: gb.name, clause: '第 6.2.10 条', page: '待核对', desc: '矩形截面受弯承载力计算公式' }
            ]
        });
    } else {
        var branchText = r.branch === 'dy' ? '受压钢筋屈服（x ≥ 2a<sub>s</sub>′）' : '受压钢筋未屈服（x < 2a<sub>s</sub>′，按应变协调）';
        steps.push({
            title: '受压区高度（双筋矩形截面）',
            formula: 'x = (f<sub>y</sub>·A<sub>s</sub> − f<sub>y</sub>′·A<sub>s</sub>′) / (α<sub>1</sub>·f<sub>c</sub>·b)',
            substitution: 'x = (' + fmt(r.fy, 0) + ' × ' + fmt(r.As, 1) + ' − ' + fmt(r.fyp, 0) + ' × ' + fmt(r.AsP, 1) + ') / (' + fmt(r.alpha1, 1) + ' × ' + fmt(r.fc, 2) + ' × ' + fmt(r.b, 0) + ') = ' + fmt(r.x, 1) + ' mm',
            result: 'x = ' + fmt(r.x, 1) + ' mm，2a<sub>s</sub>′ = ' + fmt(2 * r.as2V, 0) + ' mm，ξ = ' + fmt(r.xi, 4),
            judge: branchText + (r.over ? '；ξ ＞ ξ<sub>b</sub>，超筋' : '；ξ ≤ ξ<sub>b</sub>，适筋'),
            refs: [
                { name: gb.name, clause: '第 6.2.10 条', page: '待核对', desc: '双筋矩形截面受弯承载力计算' }
            ]
        });
    }
    // 步骤 4：正截面受弯承载力
    var muFormula = isD ? 'M<sub>u</sub> = α<sub>1</sub>·f<sub>c</sub>·b·x·(h<sub>0</sub> − x/2) + σ<sub>s</sub>′·A<sub>s</sub>′·(h<sub>0</sub> − a<sub>s</sub>′)' : 'M<sub>u</sub> = f<sub>y</sub>·A<sub>s</sub>·(h<sub>0</sub> − x/2)';
    steps.push({
        title: '正截面受弯承载力',
        formula: muFormula,
        result: 'M<sub>u</sub> = <b>' + fmt(r.Mu, 2) + ' kN·m</b>',
        refs: [
            { name: gb.name, clause: '第 6.2.10 条', page: '待核对', desc: '矩形截面正截面受弯承载力' }
        ]
    });
    // 步骤 5：最小配筋率
    steps.push({
        title: '最小配筋率验算',
        formula: 'ρ<sub>min</sub> = max(0.2%, 0.45·f<sub>t</sub>/f<sub>y</sub>)，A<sub>s,min</sub> = ρ<sub>min</sub>·b·h',
        substitution: 'ρ<sub>min</sub> = max(0.2%, 0.45 × ' + fmt(r.ft, 2) + ' / ' + fmt(r.fy, 0) + ') = ' + fmt(r.rho_min * 100, 2) + '%；A<sub>s,min</sub> = ' + fmt(r.rho_min * 100, 2) + '% × ' + fmt(r.b, 0) + ' × ' + fmt(r.h, 0) + ' = ' + fmt(r.AsMin, 0) + ' mm²',
        result: 'A<sub>s</sub> = ' + fmt(r.As, 1) + ' mm² ' + (r.isUnder ? '≥' : '<') + ' A<sub>s,min</sub> = ' + fmt(r.AsMin, 0) + ' mm²',
        judge: r.isUnder ? '满足最小配筋率要求' : '不满足最小配筋率要求（少筋）',
        refs: [
            { name: gb.name, clause: '第 8.5.1 条', page: '待核对', desc: '钢筋混凝土结构构件中纵向受力钢筋的最小配筋率' }
        ]
    });
    // 结论
    var conclusion = '';
    if (r.over) {
        conclusion = '该截面为超筋截面（ξ ＞ ξ<sub>b</sub>），受弯承载力按界限破坏估算为 ' + fmt(r.Mu, 2) + ' kN·m。建议增大截面尺寸或提高混凝土强度等级。';
    } else if (!r.isUnder) {
        conclusion = '该截面为少筋截面（A<sub>s</sub> ＜ ρ<sub>min</sub>·b·h），不满足最小配筋率要求。建议增加受拉钢筋面积。';
    } else {
        conclusion = '该截面为适筋截面，正截面受弯承载力 M<sub>u</sub> = ' + fmt(r.Mu, 2) + ' kN·m，满足 GB/T 50010-2010（2024年版） 第 6.2.10 条和第 8.5.1 条要求。';
    }
    return {
        title: '矩形截面受弯承载力计算书',
        toolName: '矩形梁正截面承载力',
        inputs: inputs,
        steps: steps,
        conclusion: conclusion
    };
}

/* ===== 官方计算书公共排版组件（统一各模块 Word 导出样式） ===== */
var CALC_BOOK_CSS =
    '@page { size: A4; margin: 2.6cm 2.0cm 2.2cm 2.0cm; }' +
    'body { font-family:"宋体","SimSun",serif; font-size:12pt; color:#000; line-height:1.7; }' +
    'p { margin:5px 0; text-align:justify; }' +
    /* ---- 封面 ---- */
    '.cover { text-align:center; }' +
    '.cover .org { font-size:14pt; font-family:"黑体","SimHei",sans-serif; letter-spacing:6px; color:#1f4e79; }' +
    '.cover h1 { font-size:26pt; font-family:"黑体","SimHei",sans-serif; letter-spacing:4px; }' +
    '.cover .calc-name { font-size:15pt; letter-spacing:2px; }' +
    '.cover .cover-table { width:62%; margin:0 auto; border:none; border-collapse:collapse; }' +
    '.cover .cover-table td { border:none; border-bottom:1px solid #444; padding:11px 6px; font-size:12pt; text-align:left; }' +
    '.cover .cover-table td.k { width:28%; text-align:right; color:#333; border-bottom:none; }' +
    '.cover-pagebreak { page-break-after:always; }' +
    /* ---- 正文标题 ---- */
    'h1 { font-size:18pt; font-family:"黑体","SimHei",sans-serif; text-align:center; margin:6px 0 16px; }' +
    'h2 { font-size:14pt; font-family:"黑体","SimHei",sans-serif; margin:24px 0 10px; padding:3px 0 3px 10px; border-left:6px solid #1f4e79; background:#eef3fa; }' +
    'h3 { font-size:12pt; font-family:"黑体","SimHei",sans-serif; margin:16px 0 8px; }' +
    /* ---- 表格 ---- */
    'table { width:100%; border-collapse:collapse; margin:8px 0 14px; }' +
    'th { background:#1f4e79; color:#fff; font-weight:bold; border:1px solid #000; padding:6px 8px; font-size:11pt; text-align:center; }' +
    'td { border:1px solid #000; padding:5px 8px; font-size:11pt; vertical-align:middle; }' +
    '.meta-table th { width:22%; }' +
    '.param-table th:nth-child(1) { width:42%; }' +
    '.param-table th:nth-child(2) { width:34%; }' +
    '.param-table th:nth-child(3) { width:24%; }' +
    /* ---- 计算步骤 ---- */
    '.step { margin:10px 0 14px; page-break-inside:avoid; }' +
    '.step-title { font-weight:bold; font-size:11.5pt; color:#1f4e79; margin-bottom:4px; }' +
    '.formula-box { background:#f5f7fa; border:1px solid #b9c6d9; padding:8px 10px; margin:6px 0; font-family:"Times New Roman",serif; }' +
    '.judge-ok { color:#006100; font-weight:bold; }' +
    '.judge-no { color:#9c0006; font-weight:bold; }' +
    '.ref-box { background:#f5f7fb; border-left:4px solid #1f4e79; padding:7px 10px; margin-top:8px; font-size:10pt; }' +
    '.conclusion { border:1px solid #1f4e79; border-left:8px solid #1f4e79; background:#eef3fa; padding:10px 14px; margin:12px 0; font-weight:bold; }' +
    '.note { font-size:10.5pt; color:#333; margin-top:16px; }' +
    '.sub { text-align:center; font-size:12pt; margin:2px 0; }' +
    '.small { font-size:9pt; color:#475569; }' +
    '.page-break { page-break-after:always; }' +
    /* ---- 签名栏 ---- */
    '.sign { width:100%; border:none; border-collapse:collapse; margin-top:40px; page-break-inside:avoid; }' +
    '.sign td { border:none; text-align:center; padding:8px 4px 4px; font-size:11pt; width:33%; }' +
    '.sign td.lab { font-weight:bold; }' +
    '.sign tr.line td { border-bottom:1px solid #000; padding:22px 4px 2px; }' +
    /* ---- 页脚 ---- */
    '.footer { mso-element:footer; text-align:center; font-size:9pt; color:#666; }';

function calcBookCover(title, calcName, dateStr) {
    return '<div class="cover">' +
        '<div style="height:70px">&nbsp;</div>' +
        '<div class="org">计算工具箱</div>' +
        '<div style="height:130px">&nbsp;</div>' +
        '<h1>' + title + '</h1>' +
        '<div style="height:30px">&nbsp;</div>' +
        '<div class="calc-name">' + (calcName || '') + '</div>' +
        '<div style="height:70px">&nbsp;</div>' +
        '<table class="cover-table">' +
        '<tr><td class="k">工程名称</td><td>＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</td></tr>' +
        '<tr><td class="k">计算内容</td><td>' + (calcName || title) + '</td></tr>' +
        '<tr><td class="k">设计阶段</td><td>施工图设计</td></tr>' +
        '<tr><td class="k">计算日期</td><td>' + dateStr + '</td></tr>' +
        '</table>' +
        calcBookSign() +
        '</div><p style="page-break-after:always">&nbsp;</p>';
}

function calcBookSign() {
    return '<table class="sign" style="page-break-inside:avoid">' +
        '<tr><td class="lab">编制</td><td class="lab">校核</td><td class="lab">审核</td></tr>' +
        '<tr class="line"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>' +
        '<tr><td>年　　月　　日</td><td>年　　月　　日</td><td>年　　月　　日</td></tr>' +
        '</table>';
}

function calcBookFooter() {
    return '<div class="footer"><!--[if mso]><span style="mso-element:field-begin"></span> PAGE <span style="mso-element:field-separator"></span>1<span style="mso-element:field-end"></span><![endif]--></div>';
}

function buildWordCalcBookHtml(book) {
    var title = book.title || '结构计算书';
    var toolName = book.toolName || '-';
    var date = new Date().toLocaleDateString();
    var inputs = book.inputs || [];
    var steps = book.steps || [];
    var refs = typeof collectRefs === 'function' ? collectRefs(steps) : [];
    var refsLi = '';
    for (var i = 0; i < refs.length; i++) {
        refsLi += '<li>' + tyaiRefText(refs[i]) + '</li>';
    }
    if (!refsLi) refsLi = '<li>规范依据待补充</li>';
    var inputsRow = '';
    for (var j = 0; j < inputs.length; j++) {
        inputsRow += '<tr><td>' + (inputs[j].name || '') + '</td><td>' + (inputs[j].value != null ? inputs[j].value : '') + '</td><td>' + (inputs[j].unit || '') + '</td></tr>';
    }
    var stepsHtml = '';
    var resultRows = '';
    for (var k = 0; k < steps.length; k++) {
        var step = steps[k];
        var stepBody = '';
        if (step.assumption) stepBody += '<p><b>计算假定：</b>' + step.assumption + '</p>';
        if (step.formula) stepBody += '<p><b>计算公式：</b></p><div class="formula-box">' + step.formula + '</div>';
        if (step.substitution) stepBody += '<p><b>代入过程：</b>' + step.substitution + '</p>';
        if (step.middle) stepBody += '<p><b>中间结果：</b>' + step.middle + '</p>';
        if (step.result) stepBody += '<p><b>计算结果：</b>' + step.result + '</p>';
        var judgeCls = step.judge && String(step.judge).indexOf('不满足') >= 0 ? 'judge-no' : 'judge-ok';
        if (step.judge) stepBody += '<p><b>验算判断：</b><span class="' + judgeCls + '">' + step.judge + '</span></p>';
        var refHtml = '';
        if (step.refs && step.refs.length) {
            var items = '';
            for (var m = 0; m < step.refs.length; m++) {
                items += '<li>' + tyaiRefText(step.refs[m]) + '</li>';
            }
            refHtml = '<div class="ref-box"><b>规范依据：</b><ul>' + items + '</ul></div>';
        } else {
            refHtml = '<div class="ref-box"><b>规范依据：</b>待补充</div>';
        }
        stepsHtml += '<div class="step"><div class="step-title">5.' + (k + 1) + ' ' + (step.title || '计算步骤') + '</div>' + stepBody + refHtml + '</div>';
        resultRows += '<tr><td>' + (step.title || '-') + '</td><td>' + (step.judge || step.result || '-') + '</td></tr>';
    }
    var refTableRows = '';
    for (var n = 0; n < refs.length; n++) {
        refTableRows += '<tr><td>' + (n + 1) + '</td><td>' + (refs[n].name || '') + '</td><td>' + (refs[n].clause || '待核对') + '</td><td>' + (refs[n].page || '页码待核对') + '</td><td>' + (refs[n].desc || '') + '</td></tr>';
    }
    var html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + title + '</title>' +
        '<style>' + CALC_BOOK_CSS + '</style></head><body>' +
        calcBookCover(title, toolName, date) +
        '<h1>' + title + '</h1>' +
        '<h2>一、工程信息</h2>' +
        '<table class="meta-table"><tr><th>项目</th><th>内容</th></tr>' +
        '<tr><td>工程名称</td><td>' + (book.projectName || '＿＿＿＿＿＿＿＿＿＿＿＿') + '</td></tr>' +
        '<tr><td>计算工具</td><td>' + toolName + '</td></tr>' +
        '<tr><td>计算时间</td><td>' + new Date().toLocaleString() + '</td></tr>' +
        '</table>' +
        '<h2>二、计算依据</h2><ul>' + refsLi + '</ul>' +
        '<h2>三、输入参数</h2>' +
        '<table class="param-table"><tr><th>参数名称</th><th>取值</th><th>单位</th></tr>' + inputsRow + '</table>' +
        '<h2>四、计算假定</h2><p>' + (book.assumption || '按现行国家及地方相关规范进行计算。') + '</p>' +
        '<h2>五、计算过程</h2>' + stepsHtml +
        '<h2>六、验算结果</h2>' +
        '<table><tr><th>验算项目</th><th>验算结论</th></tr>' + resultRows + '</table>' +
        '<h2>七、结论</h2><div class="conclusion">' + (book.conclusion || '计算完成，详见上述计算过程及验算结果。') + '</div>' +
        '<h2>八、规范依据汇总</h2>' +
        '<table><tr><th>序号</th><th>规范 / 图集</th><th>条文或章节</th><th>页码</th><th>说明</th></tr>' + refTableRows + '</table>' +
        '<p class="small">注：本计算书由计算工具箱自动生成。规范页码应以项目采用的正式规范版本、印次或 PDF 版式为准。</p>' +
        calcBookSign() +
        calcBookFooter() +
        '</body></html>';
    return html;
}

function exportCalcBookWord() {
    if (!window.currentCalcBook) {
        alert('请先完成计算，再导出计算书。');
        return;
    }
    var html = buildWordCalcBookHtml(window.currentCalcBook);
    var blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    var a = document.createElement('a');
    var d = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var dateStr = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    var name = window.currentCalcBook.toolName || window.currentCalcBook.title || '计算书';
    a.href = URL.createObjectURL(blob);
    a.download = name + '_计算书_' + dateStr + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}



/* ===== 导出 Word 计算书（浏览器端生成 .doc，Word/WPS 可打开） ===== */
function downloadDoc(name, doc) {
    var blob = new Blob(['\ufeff', doc], { type: 'application/msword' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}
/* 预制构件脱模吊装：对齐单位「板/梁短暂工况验算书」模板格式 */
 // 通用受弯构件计算书模板
function buildFlexBook(r, t, subTitle, fileName, cfg) {
     var now = new Date(); var dateStr = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
     var vw = document.getElementById('view');
     var params = [];
     var fields = vw.querySelectorAll('.field');
     for (var i = 0; i < fields.length; i++) {
         var lab = fields[i].querySelector('label'); var inp = fields[i].querySelector('input, select');
         if (!lab || !inp) continue;
         var unitEl = lab.querySelector('span'); var unit = unitEl ? unitEl.textContent.replace(/[()]/g,'').trim() : '';
         var labelText = lab.textContent.trim();
         if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
         var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
         params.push({ label: labelText, unit: unit, val: val });
     }
     function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
     var pRows = ''; params.forEach(function(p,i){pRows+='<tr><td>'+(i+1)+'</td><td>'+esc(p.label)+'</td><td>'+esc(p.unit)+'</td><td>'+esc(p.val)+'</td></tr>';});
     var calcProc = r.steps ? ('<h2>'+(cfg&&cfg.sec2?cfg.sec2:'二、详细计算过程')+'</h2>' + r.steps) : (
    '<h2>'+(cfg&&cfg.sec2?cfg.sec2:'二、正截面受弯承载力计算')+'</h2>'+
         '<p>截面有效高度 h<sub>0</sub> = h − a<sub>s</sub> = ' + (r.h?r.h:'') + ' − ' + (r.asV?r.asV:'') + ' = <b>' + fmt(r.h0||0,1) + ' mm</b></p>'+
         '<p>混凝土强度等级 ' + (r.conGrade||'') + '：f<sub>c</sub> = ' + fmt(r.fc||0,1) + ' N/mm²，f<sub>t</sub> = ' + fmt(r.ft||0,2) + ' N/mm²</p>'+
         '<p>钢筋级别 ' + (r.rebGrade||'') + '：f<sub>y</sub> = ' + fmt(r.fy||0,0) + ' N/mm²</p>'+
         '<p>界限受压区高度系数 ξ<sub>b</sub> = β<sub>1</sub> / (1 + f<sub>y</sub>/(E<sub>s</sub>ε<sub>cu</sub>)) = <b>' + fmt(r.xi_b||0,4) + '</b></p>'+
         '<p>相对受压区高度 ξ = ' + fmt(r.xi||0,4) + '，' + (r.over?'ξ &gt; ξ<sub>b</sub>，超筋破坏':'ξ ≤ ξ<sub>b</sub>，适筋破坏') + '</p>'+
         '<p>受压区高度 x = <b>' + fmt(r.x||0,1) + ' mm</b></p>'+
         '<p><b>正截面受弯承载力 M<sub>u</sub> = ' + fmt(r.Mu||0,2) + ' kN·m</b></p>'+
         '<h2>'+(cfg&&cfg.sec3?cfg.sec3:'三、最小配筋率验算')+'</h2>'+
         '<p>受拉钢筋最小配筋率 ρ<sub>min</sub> = max(0.2%, 0.45f<sub>t</sub>/f<sub>y</sub>) = <b>' + fmt((r.rho_min||0)*100,2) + '%</b></p>'+
         '<p>最小配筋面积 A<sub>s,min</sub> = ρ<sub>min</sub>·b·h = <b>' + fmt(r.AsMin||0,0) + ' mm²</b></p>'+
         '<p>实际配筋 A<sub>s</sub> = ' + (r.As||0) + ' mm² ⇒ ' + (r.isUnder?'满足':'不满足') + '最小配筋率要求</p>'
);
var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(t.title)+'计算书</title><style>'+
         CALC_BOOK_CSS + '</style></head><body>'+
         calcBookCover(esc(t.title)+'计算书', esc(t.sub), dateStr) +
         '<h1>'+esc(t.title)+'计算书</h1><div class="sub">'+esc(t.sub)+'</div>'+
         '<div class="sub">计算日期：'+dateStr+'</div>'+
         '<h2>'+(cfg&&cfg.sec1?cfg.sec1:'一、基本参数')+'</h2>'+
         (cfg&&cfg.basis?('<p><b>设计依据：</b>'+cfg.basis.map(esc).join('；')+'。</p>'):'')+
         '<table><tr><th style="width:6%;">序号</th><th>参数</th><th style="width:14%;">单位</th><th style="width:18%;">取值</th></tr>'+pRows+'</table>'+
         calcProc +
    '<h2>'+(cfg&&cfg.sec4?cfg.sec4:'四、结论')+'</h2>'+
         '<p>' + (r.stMsg?r.stMsg:'') + '</p>'+
         '<p class="note">本计算书由“计算工具箱”自动生成，依据 GB/T 50010-2010（2024年版） 相关条款。结果仅供参考，需设计人员复核确认。</p>'+
         calcBookSign() +
         calcBookFooter() +
         '</body></html>';
     return doc;
 }

function buildAacWallBook(r, t) {
    var vw = document.getElementById('view');
    var params = [];
    var fields = vw.querySelectorAll('.field');
    for (var i = 0; i < fields.length; i++) {
        var lab = fields[i].querySelector('label');
        var inp = fields[i].querySelector('input, select');
        if (!lab || !inp) continue;
        var fld = inp.closest ? inp.closest('.field') : null;
        if (fld && fld.style.display === 'none') continue;
        var unitEl = lab.querySelector('span');
        var unit = unitEl ? unitEl.textContent.replace(/[()]/g, '').trim() : '';
        var labelText = lab.textContent.trim();
        if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
        var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
        params.push({ label: labelText, unit: unit, val: val });
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    var pRows = params.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.label) + '</td><td>' + esc(p.unit) + '</td><td>' + esc(p.val) + '</td></tr>'; }).join('');
    var resRows = '';
    function rrow(label, val) { return '<tr><td>' + label + '</td><td>' + val + '</td></tr>'; }
    resRows += rrow('材料 f<sub>c</sub> / f\'<sub>tk</sub> / f<sub>t</sub>', fmt(r.fc, 2) + ' / ' + fmt(r.ftk, 2) + ' / ' + fmt(r.ft, 2) + ' N/mm²');
    resRows += rrow('有效截面 b×h<sub>0</sub>', fmt(r.b, 0) + '×' + fmt(r.h0, 0) + ' mm');
    resRows += rrow('配筋 A<sub>s</sub> / ρ', fmt(r.As, 1) + ' mm² / ' + fmt(r.rho, 3) + '%');
    if (!r.isCECS) resRows += rrow('最大配筋率 ρ<sub>max</sub>', fmt(r.rhoMax, 2) + '%');
    resRows += rrow('自重线荷载 q<sub>gk</sub>', fmt(r.qgk, 3) + ' kN/m');
    resRows += rrow('设计弯矩 γ<sub>0</sub>·M', fmt(r.gamma0 * r.M, 2) + ' kN·m');
    resRows += rrow('受弯承载力 M<sub>u</sub>', fmt(r.Mu, 2) + ' kN·m ' + (r.capOk ? '满足' : '不满足'));
    if (r.isCECS) {
        resRows += rrow('受剪 V ≤ 0.45·f<sub>t</sub>·b·h<sub>0</sub>', fmt(r.Vmax, 2) + ' kN ' + (r.tauOk ? '满足' : '不满足'));
    } else {
        resRows += rrow('受剪 τ ≤ 0.45·f<sub>t</sub>', fmt(r.tau, 3) + ' ≤ ' + fmt(0.45 * r.ft, 3) + ' N/mm² ' + (r.tauOk ? '满足' : '不满足'));
    }
    if (r.seisOn) {
        resRows += rrow('地震组合弯矩', fmt(r.Mcomb, 2) + ' kN·m ' + (r.seisOk ? '满足' : '不满足'));
    }
    if (r.isCECS) {
        resRows += rrow('抗裂 σ<sub>ck</sub> ≤ f\'<sub>tk</sub>', fmt(r.sigmaCk, 2) + ' ≤ ' + fmt(r.ftk, 2) + ' N/mm² ' + (r.crack1Ok ? '满足' : '不满足'));
        resRows += rrow('抗裂 σ<sub>ck</sub> ≤ σ<sub>p</sub>', fmt(r.sigmaCk, 2) + ' ≤ ' + fmt(r.sigmaP, 0) + ' N/mm² ' + (r.crack2Ok ? '满足' : '不满足'));
    }
    resRows += rrow('挠度 f ≤ l<sub>0</sub>/200', fmt(r.defl, 1) + ' ≤ ' + fmt(r.deflLim, 1) + ' mm ' + (r.deflOk ? '满足' : '不满足'));
    var allOk = r.capOk && r.tauOk && r.crackOk && r.deflOk && (!r.seisOn || r.seisOk);
    resRows += rrow('综合判定', allOk ? '满足' : '存在不满足项');
    var calcProc = r.steps || '';
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>蒸压加气混凝土外墙板计算书</title><style>' +
        CALC_BOOK_CSS + '</style></head><body>' +
        calcBookCover('蒸压加气混凝土外墙板计算书', '配筋 AAC 外墙板面外受弯、受剪、抗裂、挠度与连接节点验算', dateStr) +
        '<h1>蒸压加气混凝土外墙板计算书</h1>' +
        '<div class="sub">设计标准：' + r.stdName + '　强度等级 ' + r.grade + '　钢筋 ' + r.rebGrade + '　计算日期：' + dateStr + '</div>' +
        '<h2>一、基本参数</h2>' +
        '<table><tr><th>序号</th><th>参数</th><th>单位</th><th>取值</th></tr>' + pRows + '</table>' +
        '<h2>二、材料指标（' + r.stdName + '）</h2>' +
        '<table><tr><th>项目</th><th>取值</th></tr>' +
        '<tr><td>AAC 强度等级</td><td>' + r.grade + '</td></tr>' +
        '<tr><td>抗压强度设计值 f<sub>c</sub></td><td>' + fmt(r.fc, 2) + ' N/mm²</td></tr>' +
        '<tr><td>劈拉强度标准值 f\'<sub>tk</sub></td><td>' + fmt(r.ftk, 2) + ' N/mm²</td></tr>' +
        '<tr><td>劈拉强度设计值 f<sub>t</sub></td><td>' + fmt(r.ft, 2) + ' N/mm²</td></tr>' +
        '<tr><td>弹性模量 E<sub>c</sub></td><td>' + fmt(r.Ec, 0) + ' N/mm²</td></tr>' +
        '<tr><td>干密度 ρ<sub>0</sub></td><td>' + fmt(r.rho0, 0) + ' kg/m³</td></tr>' +
        '<tr><td>钢筋级别</td><td>' + r.rebGrade + '（f<sub>y</sub>=' + fmt(r.fy, 0) + ' N/mm²）</td></tr>' +
        '</table>' +
        '<h2>三、计算过程</h2>' + calcProc +
        '<h2>四、验算结果汇总</h2>' +
        '<table><tr><th>项目</th><th>结果</th></tr>' + resRows + '</table>' +
        '<h2>五、设计依据</h2>' +
        '<p>1. 《蒸压加气混凝土制品应用技术标准》JGJ/T 17-2020</p>' +
        '<p>2. 《蒸压加气混凝土墙板应用技术规程》T/CECS 553-2018</p>' +
        '<p>3. 《建筑结构荷载规范》GB 50009-2012</p>' +
        '<p>4. 《蒸压加气混凝土板》GB/T 15762</p>' +
        '<p>5. 《建筑抗震设计规范》GB 50011</p>' +
        (r.rebGrade === 'CRB600H' ? '<p>6. 《冷轧带肋钢筋混凝土结构技术规范》JGJ 95</p>' : '') +
        '<div class="note">注：本计算书用于设计初算验证。实际工程应结合构造规定、连接节点、拼缝防水等综合设计，重要构件请以专业计算软件或设计院复核为准。</div>' +
        calcBookSign() +
        calcBookFooter() +
        '</body></html>';
    return doc;
}
function buildAnchorBook(r, t) {
    var vw = document.getElementById('view');
    var params = [];
    var fields = vw.querySelectorAll('.field');
    for (var i = 0; i < fields.length; i++) {
        var lab = fields[i].querySelector('label');
        var inp = fields[i].querySelector('input, select');
        if (!lab || !inp) continue;
        var fld = inp.closest ? inp.closest('.field') : null;
        if (fld && fld.style.display === 'none') continue;
        var unitEl = lab.querySelector('span');
        var unit = unitEl ? unitEl.textContent.replace(/[()]/g, '').trim() : '';
        var labelText = lab.textContent.trim();
        if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
        var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
        params.push({ label: labelText, unit: unit, val: val });
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    var pRows = params.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.label) + '</td><td>' + esc(p.unit) + '</td><td>' + esc(p.val) + '</td></tr>'; }).join('');
    var resRows = '';
    function rrow(label, val) { return '<tr><td>' + label + '</td><td>' + val + '</td></tr>'; }
    resRows += rrow('风荷载标准值 w<sub>k</sub>', fmt(r.wk, 3) + ' kN/m²');
    resRows += rrow('重力荷载 G<sub>k</sub>（保温层+抹面层）', fmt(r.Gk, 3) + ' kN/m²');
    resRows += rrow('单个锚固件承担面积 A<sub>1</sub>', fmt(r.A1, 3) + ' m²（单块 ' + fmt(r.Apanel, 3) + 'm² / ' + fmt(r.nPanel, 0) + ' 个；派生密度 ' + fmt(r.n, 2) + ' 个/m²）');
    resRows += rrow('反向拉拔设计值 R<sub>t</sub>', fmt(r.Rt, 2) + ' kN（' + fmt(r.RtTable, 1) + '/2.5）');
    resRows += rrow('局部承压设计值 R<sub>c</sub>', fmt(r.Rc, 2) + ' kN（' + fmt(r.RcTable, 1) + '/3.0）');
    resRows += rrow('混凝土抗拔设计值 R<sub>d</sub>', fmt(r.Rd, 2) + ' kN（' + fmt(r.RdTable, 1) + '/2.5）');
    resRows += rrow('尾盘抗拉设计值 R<sub>p</sub>', fmt(r.Rp, 2) + ' kN（' + fmt(r.RpTable, 1) + '/2.5）');
    resRows += rrow('持久组合·风控 N<sub>1</sub>', fmt(r.N1, 3) + ' kN（5.5.6-1，平面外 γ<sub>G</sub>=0）');
    resRows += rrow('持久组合·含自重 N<sub>2</sub>', fmt(r.N2, 3) + ' kN（5.5.6-2，连接节点 γ<sub>G</sub>=1.3）');
    resRows += rrow('持久组合·控制内力 N', fmt(r.Nd, 3) + ' kN = max(N<sub>1</sub>, N<sub>2</sub>)');
    resRows += rrow('持久·反向拉拔', fmt(r.Nd, 3) + ' ≤ ' + fmt(r.Rt, 2) + ' kN ' + (r.okT ? '满足' : '不满足'));
    resRows += rrow('持久·局部承压', fmt(r.Nd, 3) + ' ≤ ' + fmt(r.Rc, 2) + ' kN ' + (r.okC ? '满足' : '不满足'));
    resRows += rrow('持久·混凝土抗拔', fmt(r.Nd, 3) + ' ≤ ' + fmt(r.Rd, 2) + ' kN ' + (r.okD ? '满足' : '不满足'));
    resRows += rrow('持久·尾盘抗拉', fmt(r.Nd, 3) + ' ≤ ' + fmt(r.Rp, 2) + ' kN ' + (r.okP ? '满足' : '不满足'));
    if (r.seisOn) {
        resRows += rrow('地震·仅水平（1.4/0）', fmt(r.S3a, 3) + ' kN/m² → N = ' + fmt(r.S3a * r.A1, 3) + ' kN');
        resRows += rrow('地震·仅竖向（0/1.4）', fmt(r.S3b, 3) + ' kN/m² → N = ' + fmt(r.S3b * r.A1, 3) + ' kN');
        resRows += rrow('地震·水平为主（1.4/0.5）', fmt(r.S3c, 3) + ' kN/m² → N = ' + fmt(r.S3c * r.A1, 3) + ' kN');
        resRows += rrow('地震·竖向为主（0.5/1.4）', fmt(r.S3d, 3) + ' kN/m² → N = ' + fmt(r.S3d * r.A1, 3) + ' kN');
        resRows += rrow('地震组合·控制内力 N<sub>E</sub>', fmt(r.Ne, 3) + ' kN（四档包络，γ<sub>G</sub>=1.3，5.5.6-2）');
        resRows += rrow('地震·反向拉拔', fmt(r.Ne, 3) + ' ≤ ' + fmt(r.Rt, 2) + ' kN ' + (r.okTe ? '满足' : '不满足'));
        resRows += rrow('地震·局部承压', fmt(r.Ne, 3) + ' ≤ ' + fmt(r.Rc, 2) + ' kN ' + (r.okCe ? '满足' : '不满足'));
        resRows += rrow('地震·混凝土抗拔', fmt(r.Ne, 3) + ' ≤ ' + fmt(r.Rd, 2) + ' kN ' + (r.okDe ? '满足' : '不满足'));
        resRows += rrow('地震·尾盘抗拉', fmt(r.Ne, 3) + ' ≤ ' + fmt(r.Rp, 2) + ' kN ' + (r.okPe ? '满足' : '不满足'));
    }
    resRows += rrow('变形验算限值 L/100', fmt(r.L100, 2) + ' mm（标准组合内力 N<sub>k</sub> = ' + fmt(r.deflN, 3) + ' kN）');
    resRows += rrow('构造检查', '锚杆直径 ' + (r.ckD && r.ckD8 ? '满足' : '不满足') + '；尾盘直径 ' + (r.ckT ? '满足' : '不满足') + '；尾盘厚度 ' + (r.ckTT ? '满足' : '不满足') + '；数量 ' + (r.ckN ? '满足' : '不满足') + '；锚固长度 ' + (r.ckL ? '满足' : '不满足') + '；间距 ' + (r.ckS ? '满足' : '不满足') + '；边距 ' + (r.ckE ? '满足' : '不满足') + '；边缘小板 ' + (r.ckSmall ? '满足' : '不满足') + '；墙边缘板幅 ' + (r.ckEdge ? '满足' : '不满足'));
    resRows += rrow('综合判定', r.allOk ? '满足' : '存在不满足项');
    var calcProc = r.steps || '';
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>保温外墙锚固件设计计算书</title><style>' +
        CALC_BOOK_CSS + '</style></head><body>' +
        calcBookCover('保温外墙锚固件设计计算书', '预制反打保温外墙锚固件反向拉拔 / 局部承压 / 混凝土抗拔 / 尾盘抗拉承载力验算', dateStr) +
        '<h1>保温外墙锚固件设计计算书</h1>' +
        '<div class="sub">设计标准：《外墙保温一体化系统应用技术标准（预制混凝土反打保温外墙）》5.5　锚杆直径 ' + fmt(r.d, 0) + ' mm　尾盘直径 ' + fmt(r.tail, 0) + ' mm　布置方式 ' + (r.layout === 'board' ? '板面布置' : r.layout === 'side' ? '侧立布置' : '板底布置') + '　计算日期：' + dateStr + '</div>' +
        '<h2>一、基本参数</h2>' +
        '<table><tr><th>序号</th><th>参数</th><th>单位</th><th>取值</th></tr>' + pRows + '</table>' +
        '<h2>二、计算过程</h2>' + calcProc +
        '<h2>三、验算结果汇总</h2>' +
        '<table><tr><th>项目</th><th>取值 / 结论</th></tr>' + resRows + '</table>' +
        '<h2>四、主要依据</h2>' +
        '<p>1. 《外墙保温一体化系统应用技术标准（预制混凝土反打保温外墙）》第5.5节（5.5.1~5.5.15）、表4.1.2、表4.2.7-2/3</p>' +
        '<p>2. 《建筑结构荷载规范》GB 50009-2012（风荷载）</p>' +
        '<p>3. 《建筑抗震设计规范》GB/T 50011-2010（2024年版）（地震作用）</p>' +
        '<p>4. 《预制混凝土夹心保温外墙板应用技术标准》DG/TJ 08-2158（材料性能计算）</p>' +
        '<div class="note">注：锚固件挠度（5.5.10，≤L/100）需依据产品刚度试验确定，本计算书输出标准组合控制内力供核对。局部承压检验值按锚杆直径取用（未计套杆直径20mm的5.0kN高值，偏于安全）。本计算书用于设计初算验证，重要工程请以专项试验与设计院复核为准。</div>' +
        calcBookSign() +
        calcBookFooter() +
        '</body></html>';
    return doc;
}
function buildPrecastBook(r, t) {
    var isSlab = r.isSlab !== undefined ? r.isSlab : (r.type === 'slab' || r.type === 'cs-slab');
    var isComp = r.isComposite !== undefined ? r.isComposite : (r.type === 'cs-slab' || r.type === 'cs-beam');
    var titleK = r.type === 'cs-slab' ? '叠合板' : r.type === 'cs-beam' ? '叠合梁' : r.type === 'slab' ? '全预制板' : '全预制梁';
    var kind = r.type === 'cs-slab' ? '叠合板（钢筋桁架）' : r.type === 'cs-beam' ? '叠合梁' : r.type === 'slab' ? '全预制板（实心）' : '全预制梁（实心）';
    var vw = document.getElementById('view');
    var params = [];
    var fields = vw.querySelectorAll('.field');
    for (var i = 0; i < fields.length; i++) {
        var lab = fields[i].querySelector('label');
        var inp = fields[i].querySelector('input, select');
        if (!lab || !inp) continue;
        var fld = inp.closest ? inp.closest('.field') : null;
        if (fld && fld.style.display === 'none') continue;
        var unitEl = lab.querySelector('span');
        var unit = unitEl ? unitEl.textContent.replace(/[()]/g, '').trim() : '';
        var labelText = lab.textContent.trim();
        if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
        var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
        params.push({ label: labelText, unit: unit, val: val });
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    var V = (r.b / 1000) * (r.hp / 1000) * r.L;
    var G = r.Gk;
    var Area = r.L * (r.b / 1000);
    var Qk1 = r.kd * G + r.qad * Area;
    var Qk2 = 1.5 * G;
    var Qk3 = r.kl * G;
    var Qk = Math.max(Qk1, Qk2, Qk3);
    var qline = Qk / r.L;
    var z = r.cosB > 0 ? 1 / r.cosB : 1;
    var FD = G * z / r.n;
    var R0 = (r.type === 'cs-slab') ? ((r.trussMat === 'HPB300' ? 15 : 20) / r.g1) : 0;
    var Rc = (r.type === 'cs-beam') ? (Math.PI * r.dr * r.dr / 4 * 2 * 65 / 1000) : (Math.PI * r.dring * r.dring / 4 * 2 * 65 / 1000);
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    function trow(a, b) { return '<tr><td style="width:20%;">' + a + '</td><td>' + b + '</td></tr>'; }
    var loadRows = trow('自重标准值', 'G = V×γ = ' + fmt(V,4) + '×' + fmt(r.gamma,2) + ' = ' + fmt(G,2) + ' kN') +
        trow('脱模荷载1', 'Qk1 = ' + fmt(r.kd,2) + '×G + ' + fmt(r.qad,2) + '×底面积 = ' + fmt(Qk1,2) + ' kN') +
        trow('脱模荷载2', 'Qk2 = 1.5×G = ' + fmt(Qk2,2) + ' kN') +
        trow('吊装荷载', 'Qk3 = ' + fmt(r.kl,2) + '×G = ' + fmt(Qk3,2) + ' kN') +
        trow('荷载标准值', 'Qk = max(Qk1, Qk2, Qk3) = ' + fmt(Qk,2) + ' kN');
    var pRows = '';
    params.forEach(function (p, i) { pRows += '<tr><td>' + (i + 1) + '</td><td>' + esc(p.label) + '</td><td>' + esc(p.unit) + '</td><td>' + esc(p.val) + '</td></tr>'; });
    var sumRows = '';
    var liftRow = r.type === 'cs-slab'
        ? ['桁架吊点许用承载力', 'R<sub>0</sub> = ' + fmt(R0, 2) + ' kN', 'F<sub>D</sub> = ' + fmt(FD, 2) + ' kN', r.liftOk]
        : r.type === 'cs-beam'
        ? ['埋件拉断破坏验算', 'R<sub>c</sub> = ' + fmt(Rc, 2) + ' kN', 'F<sub>D</sub> = ' + fmt(FD, 2) + ' kN', r.liftOk]
        : ['吊环应力验算', 'σ ≤ 65 N/mm²', 'σ = ' + fmt(r.sigRing, 1) + ' N/mm²', r.liftOk];
    [
        ['容许应力（正截面法向拉应力）', fmt(r.r * 100, 1) + '%×f<sub>tk</sub> = ' + fmt(r.ftkCur, 2) + ' N/mm²', 'σ<sub>ck</sub> = ' + fmt(r.sig, 3) + ' N/mm²', r.crackOk],
        ['正截面承载力', 'M<sub>u</sub> = ' + fmt(r.Mu, 2) + ' kN·m', 'M = ' + fmt(r.M, 2) + ' kN·m', r.capOk],
        liftRow
    ].forEach(function (row, i) {
        sumRows += '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td><td>' + row[2] + '</td><td>' + (row[3] ? '满足' : '不满足') + '</td></tr>';
    });
    var calcProc = r.steps ? '<h2>二、详细计算过程</h2>' + r.steps : (
        '<h2>二、荷载计算</h2>' +
        '<p>根据《装配式混凝土结构技术规程》JGJ 1-2014 第 6.2.2 条、第 6.2.3 条：</p>' +
        '<table><tr><th>荷载项</th><th>计算式与取值</th></tr>' + loadRows + '</table>' +
        '<h2>三、预制构件脱模吊装容许应力验算</h2>' +
        '<p>根据《混凝土结构工程施工规范》GB 50666-2011 第 9.2.3 条：</p>' +
        '<p>计算线荷载：q = Qk/L = ' + fmt(Qk, 3) + '×1000.0/' + fmt(r.L * 1000, 1) + ' = ' + fmt(qline, 4) + ' kN/m</p>' +
        '<p>根据吊点位置及线荷载计算，' + (isSlab ? '板' : '梁') + '脱模/吊装工况产生最大弯矩值：跨中弯矩 M<sub>max中</sub> = ' + fmt(r.Mmid, 2) + ' kN·m；支座弯矩 M<sub>max支</sub> = ' + fmt(r.Msup, 2) + ' kN·m</p>' +
        '<p>截面抵抗矩：W = b×h<sub>p</sub>²/6 = ' + fmt(r.b, 0) + '×' + fmt(r.hp, 0) + '²/6 = ' + fmt(r.W, 0) + ' mm³</p>' +
        '<p>正截面边缘混凝土法向拉应力：σ<sub>ck</sub>（跨中）= M<sub>max中</sub>/W = ' + fmt(r.sigMid, 3) + ' N/mm²；σ<sub>ck</sub>（支座）= M<sub>max支</sub>/W = ' + fmt(r.sigSup, 3) + ' N/mm²；控制 σ<sub>ck</sub> = ' + fmt(r.sig, 3) + ' N/mm²</p>' +
        '<p>脱模时按构件混凝土强度达到抗拉强度标准值的 ' + fmt(r.r * 100, 1) + '%，经验算：</p>' +
        '<p><b>σ<sub>ck</sub> ' + (r.crackOk ? '&lt;' : '&gt;') + ' ' + fmt(r.r * 100, 1) + '%×f<sub>tk</sub> = ' + fmt(r.ftkCur, 2) + ' N/mm²，' + (r.crackOk ? '满足要求！' : '不满足要求！') + '</b></p>' +
        '<h2>四、脱模吊件承载力验算</h2>' +
        '<p><b>（1）单个吊件脱模吊装荷载计算</b></p>' +
        '<p>z = 1/cosβ = ' + fmt(z, 3) + '</p>' +
        '<p>F<sub>D</sub> = G×z/n = ' + fmt(G, 2) + '×' + fmt(z, 3) + '/' + fmt(r.n, 0) + ' = ' + fmt(FD, 3) + ' kN</p>' +
        (r.type === 'cs-slab' ?
        '<p><b>（2）桁架吊点许用承载力验算</b></p>' +
        '<p>桁架吊点许用承载力标准值 R（腹杆材质 ' + r.trussMat + '）= ' + (r.trussMat === 'HPB300' ? '15' : '20') + ' kN；预埋吊件安全系数 γ<sub>1</sub> = ' + fmt(r.g1, 1) + '</p>' +
        '<p>R<sub>0</sub> = R/γ<sub>1</sub> = ' + (r.trussMat === 'HPB300' ? '15' : '20') + '/' + fmt(r.g1, 1) + ' = ' + fmt(R0, 2) + ' kN</p>' +
        '<p><b>F<sub>D</sub> = ' + fmt(FD, 2) + ' kN ' + (r.liftOk ? '&lt;' : '&gt;') + ' R<sub>0</sub> = ' + fmt(R0, 2) + ' kN，' + (r.liftOk ? '满足要求！' : '不满足要求！') + '</b></p>'
        : r.type === 'cs-beam' ?
        '<p><b>（2）埋件拉断破坏验算</b></p>' +
        '<p>吊钩起吊承载力：R<sub>c</sub> = π×d<sub>r</sub>²/4×2×f<sub>y</sub>/1000 = 3.14×' + fmt(r.dr, 1) + '²/4×2×65.0/1000 = ' + fmt(Rc, 2) + ' kN</p>' +
        '<p><b>R<sub>c</sub> = ' + fmt(Rc, 2) + ' kN ' + (r.liftOk ? '&gt;' : '&lt;') + ' F<sub>D</sub> = ' + fmt(FD, 2) + ' kN，' + (r.liftOk ? '满足要求！' : '不满足要求！') + '</b></p>'
        :
        '<p><b>（2）吊环验算（GB/T 50010-2010（2024年版） 9.7.6）</b></p>' +
        '<p>吊环应力：σ = k·G<sub>k</sub>/(n<sub>eff</sub>·cosβ·2·A) = ' + fmt(r.sigRing, 1) + ' N/mm² ≤ 65 N/mm²，' + (r.liftOk ? '满足要求！' : '不满足要求！') + '</p>' +
        '<p><b>建议吊环直径：φ' + fmt(r.needDR, 0) + '（HPB300，应力 ≤65 N/mm²）</b></p>')
    );
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(t.title) + '验算书</title><style>' +
        CALC_BOOK_CSS + '</style></head><body>' +
        calcBookCover(titleK + '短暂工况（脱模吊装）验算书', '构件形式：' + kind, dateStr) +
        '<h1>' + titleK + '短暂工况（脱模吊装）验算书</h1>' +
        '<div class="sub">构件编号：＿＿＿＿＿＿　构件形式：' + kind + '</div>' +
        '<div class="sub">计算日期：' + dateStr + '</div>' +
        '<h2>一、基本参数</h2>' +
        '<p><b>（1）构件信息</b></p>' +
        '<table><tr><th>项目</th><th>取值</th></tr>' +
        '<tr><td>外形尺寸 L×b×h</td><td>' + fmt(r.L, 1) + ' m × ' + fmt(r.b, 0) + ' mm × ' + fmt(r.h, 0) + ' mm</td></tr>' +
        (isComp ? '<tr><td>叠合层厚度 h<sub>c</sub></td><td>' + fmt(r.hc, 0) + ' mm</td></tr>' : '') +
        '<tr><td>计算截面高度 h<sub>p</sub></td><td>' + fmt(r.hp, 0) + ' mm' + (isComp ? '（脱模吊装按预制层）' : '（实心全截面）') + '</td></tr>' +
        '<tr><td>体积 V</td><td>' + fmt(V, 4) + ' m³</td></tr>' +
        '<tr><td>自重标准值 G</td><td>' + fmt(G, 2) + ' kN</td></tr>' +
        '</table>' +
        '<p><b>（2）计算参数</b></p>' +
        '<table><tr><th>序号</th><th>参数</th><th>单位</th><th>取值</th></tr>' + pRows + '</table>' +
        calcProc +
        '<h2>五、验算结果汇总</h2>' +
        '<table><tr><th>验算内容</th><th>验算容许值</th><th>内力</th><th>结果</th></tr>' + sumRows + '</table>' +
        '<p class="note">本验算书由“计算工具箱”自动生成，依据 JGJ 1-2014 6.2.2/6.2.3、GB 50666-2011 9.2.3、GB/T 50010-2010（2024年版） 9.7.6。结果基于输入参数计算，需设计人员复核确认；实际工程还应综合考虑构造、抗震、耐久性等要求，以正式设计文件为准。</p>' +
        calcBookSign() +
        calcBookFooter() +
        '</body></html>';
    return doc;
}
function exportBook() {
    var t = TOOLS[CUR_TOOL];
    if (!t) { alert('请先进入某个计算模块。'); return; }
    if (CUR_TOOL === 'precast-lift' && window._PL_RESULT) {
        var r = window._PL_RESULT;
        var kn = r.type === 'cs-slab' ? '叠合板' : r.type === 'cs-beam' ? '叠合梁' : r.type === 'slab' ? '全预制板' : '全预制梁';
        downloadDoc(kn + '短暂工况验算书.doc', buildPrecastBook(r, t));
        return;
    }
     if (CUR_TOOL === 'stage-check' && window._SC_RESULT) {
         downloadDoc((window._SC_RESULT.kind === 'slab' ? '叠合板' : '叠合梁') + '施工阶段与使用阶段验算书.doc', buildStageBook(window._SC_RESULT, t));
         return;
     }
     if (CUR_TOOL === 'aac-wall' && window._AW_RESULT) {
         downloadDoc('蒸压加气混凝土外墙板计算书.doc', buildAacWallBook(window._AW_RESULT, t));
         return;
     }
     if (CUR_TOOL === 'anchor' && window._AN_RESULT) {
         downloadDoc('保温外墙锚固件设计计算书.doc', buildAnchorBook(window._AN_RESULT, t));
         return;
     }
     if (CUR_TOOL === 'l22zg401' && window._L22_RESULT) {
         downloadDoc('L22ZG401预应力钢管桁架叠合板计算书.doc', buildL22Book(window._L22_RESULT, t));
         return;
     }
     // 矩形梁正截面
     if (CUR_TOOL === 'beam-rect') {
         exportCalcBookWord();
         return;
     }
     // T形梁正截面
     if (CUR_TOOL === 'beam-t' && window._BT_RESULT) {
         var r = window._BT_RESULT;
         var doc = buildFlexBook(r, t, 'T形截面受弯承载力验算', 'T形梁正截面承载力计算书', {
             sec1: '一、基本参数',
             sec2: '二、T形截面类型判别与承载力计算',
             sec3: '三、最小配筋率验算',
             sec4: '四、结论',
             basis: ['《混凝土结构设计规范》GB/T 50010-2010（2024年版） 第 6.2.11 条、第 8.5.1 条']
         });
         downloadDoc('T形梁正截面承载力计算书.doc', doc);
         return;
     }
     // 梁斜截面受剪
     if (CUR_TOOL === 'beam-shear' && window._BS_RESULT) {
         var r = window._BS_RESULT;
         var now = new Date(); var dateStr = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
         var vw = document.getElementById('view');
         var params = [];
         var fields = vw.querySelectorAll('.field');
         for (var i = 0; i < fields.length; i++) {
             var lab = fields[i].querySelector('label'); var inp = fields[i].querySelector('input, select');
             if (!lab || !inp) continue;
             var unitEl = lab.querySelector('span'); var unit = unitEl ? unitEl.textContent.replace(/[()]/g,'').trim() : '';
             var labelText = lab.textContent.trim();
             if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
             var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
             params.push({ label: labelText, unit: unit, val: val });
         }
         function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
         function trow(a,b){return '<tr><td style="width:30%;">'+a+'</td><td>'+b+'</td></tr>';}
         var pRows = ''; params.forEach(function(p,i){pRows+='<tr><td>'+(i+1)+'</td><td>'+esc(p.label)+'</td><td>'+esc(p.unit)+'</td><td>'+esc(p.val)+'</td></tr>';});
         var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(t.title)+'计算书</title><style>'+
             CALC_BOOK_CSS + '</style></head><body>'+
             calcBookCover(esc(t.title)+'计算书', esc(t.sub), dateStr) +
             '<h1>'+esc(t.title)+'计算书</h1><div class="sub">'+esc(t.sub)+'</div>'+
             '<div class="sub">计算日期：'+dateStr+'</div>'+
             '<h2>一、设计依据</h2><p>《混凝土结构设计规范》GB/T 50010-2010（2024年版） 第 6.3.1 条、第 6.3.4 条。</p>'+
             '<h2>二、计算参数</h2>'+
             '<table><tr><th style="width:6%;">序号</th><th>参数</th><th style="width:14%;">单位</th><th style="width:18%;">取值</th></tr>'+pRows+'</table>'+
             (r.steps ? '<h2>三、详细计算过程</h2>' + r.steps : '<h2>三、斜截面受剪承载力计算</h2>'+
             '<p>截面类型：' + (r.rectType === 'rect' ? '矩形截面' : 'T形/工形截面（按腹板宽计算）') + '</p>'+
             '<p>h<sub>w</sub>/b = ' + fmt(r.hwb,2) + '；' + (r.hwb<=4?'矩形/一般梁（hw/b ≤ 4）':r.hwb>=6?'薄腹梁（hw/b ≥ 6）':'过渡段') + '</p>'+
             '<table><tr><th>验算项目</th><th>计算式与取值</th></tr>'+
             trow('截面限制条件 V<sub>max</sub>', '0.25f<sub>c</sub>bh<sub>0</sub> = ' + fmt(r.Vmax,1) + ' kN（' + (r.secOk ? '满足' : '不满足') + '）') +
             trow('混凝土项 V<sub>c</sub>', '0.7f<sub>t</sub>bh<sub>0</sub> = ' + fmt(r.Vc,1) + ' kN') +
             trow('箍筋项 V<sub>sv</sub>', (r.mode==='check'?('1.25f<sub>yv</sub>A<sub>sv</sub>h<sub>0</sub>/s = ' + fmt(r.Vsv,1) + ' kN'):('按 V−V<sub>c</sub> 反推所需 A<sub>sv</sub>/s'))) +
             trow('总受剪承载力 V<sub>u</sub>', fmt(r.Vu,1) + ' kN') +
             trow('剪力设计值 V', fmt(r.V,1) + ' kN（' + (r.ok ? '满足' : '不满足') + '）') +
             '</table>'+
             '<h2>四、配箍率验算</h2>'+
             '<p>配箍率 ρ<sub>sv</sub> = ' + fmt((r.rho||0)*100,3) + '%，最小配箍率 ρ<sub>sv,min</sub> = ' + fmt((r.rsvMin||0)*100,3) + '%（' + (r.svOk?'满足':'不满足') + '）</p>') +
         '<h2>五、结论</h2>'+
             '<p>斜截面受剪承载力 ' + (r.ok?'满足':'不满足') + ' 规范要求。</p>'+
             '<p class="note">本计算书由“计算工具箱”自动生成，依据 GB/T 50010-2010（2024年版） 第 6.3.1、6.3.4 条。结果仅供参考，需设计人员复核确认。</p>'+
             calcBookSign() +
             calcBookFooter() +
             '</body></html>';
         downloadDoc('梁斜截面受剪承载力计算书.doc', doc);
         return;
     }
     // 轴心受压柱
     if (CUR_TOOL === 'column-axial' && window._CA_RESULT) {
         var r = window._CA_RESULT;
         var now = new Date(); var dateStr = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
         var vw = document.getElementById('view');
         var params = [];
         var fields = vw.querySelectorAll('.field');
         for (var i = 0; i < fields.length; i++) {
             var lab = fields[i].querySelector('label'); var inp = fields[i].querySelector('input, select');
             if (!lab || !inp) continue;
             var unitEl = lab.querySelector('span'); var unit = unitEl ? unitEl.textContent.replace(/[()]/g,'').trim() : '';
             var labelText = lab.textContent.trim();
             if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
             var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
             params.push({ label: labelText, unit: unit, val: val });
         }
         function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
         var pRows = ''; params.forEach(function(p,i){pRows+='<tr><td>'+(i+1)+'</td><td>'+esc(p.label)+'</td><td>'+esc(p.unit)+'</td><td>'+esc(p.val)+'</td></tr>';});
         var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(t.title)+'计算书</title><style>'+
             CALC_BOOK_CSS + '</style></head><body>'+
             calcBookCover(esc(t.title)+'计算书', esc(t.sub), dateStr) +
             '<h1>'+esc(t.title)+'计算书</h1><div class="sub">'+esc(t.sub)+'</div>'+
             '<div class="sub">计算日期：'+dateStr+'</div>'+
             '<h2>一、设计依据</h2><p>《混凝土结构设计规范》GB/T 50010-2010（2024年版） 第 6.2.15 条、第 8.5.1 条。</p>'+
             '<h2>二、计算参数</h2>'+
             '<table><tr><th style="width:6%;">序号</th><th>参数</th><th style="width:14%;">单位</th><th style="width:18%;">取值</th></tr>'+pRows+'</table>'+
             (r.steps ? '<h2>三、详细计算过程</h2>' + r.steps : '<h2>三、轴心受压承载力计算</h2>'+
             '<p>计算长度 l<sub>0</sub> = ' + fmt(r.l0/1000,2) + ' m；长细比 λ = l<sub>0</sub>/i = ' + fmt(r.lambda,2) + '；稳定系数 φ = ' + fmt(r.phi,4) + '。</p>'+
             '<p>受压承载力 N<sub>u</sub> = 0.9φ(f<sub>c</sub>A + f<sub>y</sub>′A<sub>s</sub>′) = ' + fmt(r.Nu,1) + ' kN。</p>'+
             '<p>轴力设计值 N = ' + fmt(r.N,1) + ' kN，N ' + (r.ok?'≤':'>') + ' N<sub>u</sub> ⇒ ' + (r.ok?'满足要求':'不满足要求') + '。</p>'+
             '<h2>四、配筋率验算</h2>'+
             '<p>全部纵筋配筋率 ρ = ' + fmt((r.rho||0)*100,2) + '%；'+
             '一侧配筋率 ρ<sub>side</sub> = ' + fmt((r.rhoSide||0)*100,2) + '%；'+
             '最小总配筋率 ρ<sub>min</sub> = ' + fmt((r.rhoMin||0)*100,2) + '%（' + (r.rhoOk?'满足':'不满足') + '）。</p>') +
         '<h2>五、结论</h2>'+
             '<p>轴心受压承载力 ' + (r.ok?'满足':'不满足') + ' 规范要求。</p>'+
             '<p class="note">本计算书由“计算工具箱”自动生成，依据 GB/T 50010-2010（2024年版） 第 6.2.15、8.5.1 条。结果仅供参考，需设计人员复核确认。</p>'+
             '</body></html>';
         downloadDoc('轴心受压柱承载力计算书.doc', doc);
         return;
     }
     // 钢筋面积速查
     if (CUR_TOOL === 'rebar-area') {
         var vw = document.getElementById('view');
         var now = new Date(); var dateStr = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
         function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
         function tblFromDom(id) {
             var el = document.getElementById(id); if (!el) return '';
             var rows = el.querySelectorAll('tr'); if (!rows.length) return '';
             var html = '<table>';
             for (var i = 0; i < rows.length; i++) {
                 var cells = rows[i].querySelectorAll('th,td');
                 html += '<tr>';
                 for (var j = 0; j < cells.length; j++) {
                     var tag = cells[j].tagName.toLowerCase();
                     html += '<' + tag + '>' + cells[j].innerHTML + '</' + tag + '>';
                 }
                 html += '</tr>';
             }
             html += '</table>';
             return html;
         }
         var raResult = document.getElementById('rr_result') ? document.getElementById('rr_result').innerHTML : '';
         var rsResult = document.getElementById('rs_out') ? document.getElementById('rs_out').innerHTML : '';
         var raTable = tblFromDom('ra_table');
         var rsTable = tblFromDom('rs_table');
         var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>钢筋面积速查表</title><style>'+
             CALC_BOOK_CSS + '.mini th,.mini td{font-size:10pt;padding:3px 6px;}</style></head><body>'+
             calcBookCover('钢筋面积速查表', '直径 × 根数 / 间距换算 · 常用配筋速查', dateStr) +
             '<h1>钢筋面积速查表</h1><div class="sub">直径 × 根数 / 间距换算 · 常用配筋速查</div>'+
             '<div class="sub">查询日期：'+dateStr+'</div>'+
             '<h2>一、按配筋间距换算（每延米板宽）</h2>'+
             rsResult +
             rsTable +
             '<h2>二、配筋组合推荐</h2>'+
             raResult +
             '<h2>三、常用钢筋截面积表（单根 / 多根总截面）</h2>'+
             raTable +
             '<p class="note">本表由“计算工具箱”自动生成。钢筋截面积计算公式：A<sub>s</sub> = πd²/4。</p>'+
             calcBookSign() +
             calcBookFooter() +
             '</body></html>';
         downloadDoc('钢筋面积速查表.doc', doc);
         return;
     }
     // 最小配筋率速查
     if (CUR_TOOL === 'rho-min') {
         var vw = document.getElementById('view');
         var now = new Date(); var dateStr = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
         function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
         var params = [];
         var fields = vw.querySelectorAll('.field');
         for (var i = 0; i < fields.length; i++) {
             var lab = fields[i].querySelector('label'); var inp = fields[i].querySelector('input, select');
             if (!lab || !inp) continue;
             var unitEl = lab.querySelector('span'); var unit = unitEl ? unitEl.textContent.replace(/[()]/g,'').trim() : '';
             var labelText = lab.textContent.trim();
             if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
             var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
             params.push({ label: labelText, unit: unit, val: val });
         }
         var pRows = ''; params.forEach(function(p,i){pRows+='<tr><td>'+(i+1)+'</td><td>'+esc(p.label)+'</td><td>'+esc(p.unit)+'</td><td>'+esc(p.val)+'</td></tr>';});
         var resultHtml = document.getElementById('rh_result') ? document.getElementById('rh_result').innerHTML : '';
         var procHtml = document.getElementById('rh_proc') ? document.getElementById('rh_proc').innerHTML : '';
         var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>最小配筋率速查</title><style>'+
             CALC_BOOK_CSS + '</style></head><body>'+
             calcBookCover('最小配筋率速查', '受弯 / 受压构件 · GB/T 50010-2010（2024年版） 第 8.5.1 条', dateStr) +
             '<h1>最小配筋率速查</h1><div class="sub">受弯 / 受压构件 · GB/T 50010-2010（2024年版） 第 8.5.1 条</div>'+
             '<div class="sub">查询日期：'+dateStr+'</div>'+
             '<h2>一、查询参数</h2>'+
             '<table><tr><th style="width:6%;">序号</th><th>参数</th><th style="width:14%;">单位</th><th style="width:18%;">取值</th></tr>'+pRows+'</table>'+
             '<h2>二、最小配筋率结果</h2>'+
             resultHtml +
             '<h2>三、计算依据</h2>'+
             procHtml +
             '<p class="note">依据《混凝土结构设计规范》GB/T 50010-2010（2024年版） 第 8.5.1 条。受拉钢筋最小配筋率按构件全截面面积计算。</p>'+
             calcBookSign() +
             calcBookFooter() +
             '</body></html>';
         downloadDoc('最小配筋率速查表.doc', doc);
         return;
     }
     // 单块矩形板
     if (CUR_TOOL === 'slab-rect' && window._SLAB_RESULT) {
         var r = window._SLAB_RESULT;
         var now = new Date(); var dateStr = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
         var vw = document.getElementById('view');
         var params = [];
         var fields = vw.querySelectorAll('.field');
         for (var i = 0; i < fields.length; i++) {
             var lab = fields[i].querySelector('label'); var inp = fields[i].querySelector('input, select');
             if (!lab || !inp) continue;
             var unitEl = lab.querySelector('span'); var unit = unitEl ? unitEl.textContent.replace(/[()]/g,'').trim() : '';
             var labelText = lab.textContent.trim();
             if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
             var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
             params.push({ label: labelText, unit: unit, val: val });
         }
         function esc2(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
         function trow2(a,b){return '<tr><td style="width:30%;">'+a+'</td><td>'+b+'</td></tr>';}
         var pRows2 = ''; params.forEach(function(p,i){pRows2+='<tr><td>'+(i+1)+'</td><td>'+esc2(p.label)+'</td><td>'+esc2(p.unit)+'</td><td>'+esc2(p.val)+'</td></tr>';});
         var procEl = document.getElementById('sb_proc');
         var stepRows2 = '';
         if (procEl) {
             var sts2 = procEl.querySelectorAll('.step');
             for (var k = 0; k < sts2.length; k++) {
                 stepRows2 += '<tr><td style="width:6%;">' + (k+1) + '</td><td>' + sts2[k].innerHTML + '</td></tr>';
             }
         }
         var keys2 = []; var labels2 = {}; var Ms = {}; var h0s = {}; var rsMap2 = {};
         keys2.push('mx'); labels2.mx = '短跨跨中（x 向）'; Ms.mx = r.mx; h0s.mx = r.h0x; rsMap2.mx = r.rx;
         keys2.push('my'); labels2.my = '长跨跨中（y 向）'; Ms.my = r.my; h0s.my = r.h0y; rsMap2.my = r.ry;
         if (r.rx0) { keys2.push('mx0'); labels2.mx0 = '短跨支座（x 向）'; Ms.mx0 = r.mx0; h0s.mx0 = r.h0x; rsMap2.mx0 = r.rx0; }
         if (r.ry0) { keys2.push('my0'); labels2.my0 = '长跨支座（y 向）'; Ms.my0 = r.my0; h0s.my0 = r.h0y; rsMap2.my0 = r.ry0; }
         var asProvided2 = r.asProvided || {};
         var AsMin = r.AsMin, rho_min = r.rho_min, b = 1000, h = r.h;
         var rebarRows = '';
         for (var k2 = 0; k2 < keys2.length; k2++) {
             var key2 = keys2[k2];
             var rr = rsMap2[key2];
             if (!rr) continue;
             var AsVal = rr.over ? '超筋' : Math.round(rr.As);
             var rhoPct = (rr.As / (b * h)) * 100;
             var asP = asProvided2[key2];
             var asPStr = (asP !== null && asP !== undefined && isFinite(asP) && asP > 0) ? Math.round(asP) : '—';
             var judgeStr = '';
             if (rr.over) { judgeStr = '超筋'; }
             else if (asP !== null && asP !== undefined && isFinite(asP) && asP > 0) {
                 var AsReq = Math.max(rr.As, AsMin);
                 if (asP >= AsReq) judgeStr = '满足';
                 else if (asP < AsMin) judgeStr = '不满足最小配筋率';
                 else judgeStr = '配筋不足';
             } else {
                 judgeStr = rr.As >= AsMin ? '满足' : '配筋不足';
             }
             var recStr = '—';
             if (!rr.over) {
                 var ds2 = [6,8,10,12,14,16]; var best2 = null;
                 for (var di = 0; di < ds2.length; di++) {
                     var d2 = ds2[di];
                     var a12 = Math.PI * d2 * d2 / 4;
                     var s2 = a12 / rr.As * 1000;
                     if (s2 >= 50 && s2 <= 300) { if (!best2 || s2 < best2.s) best2 = {d:d2, s:s2, a:a12}; }
                 }
                 if (best2) recStr = 'φ' + best2.d + '@' + Math.round(best2.s) + ' (' + Math.round(1000/best2.s * best2.a) + ' mm²/m)';
             }
             rebarRows += '<tr><td>' + labels2[key2] + '</td><td>' + Ms[key2].toFixed(3) + '</td><td>' + Math.round(h0s[key2]) + '</td><td>' + AsVal + '</td><td>' + rhoPct.toFixed(3) + '%</td><td>' + (rho_min*100).toFixed(3) + '%</td><td>' + judgeStr + '</td><td>' + recStr + '</td><td>' + asPStr + '</td></tr>';
         }
         var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>矩形板配筋计算书</title><style>'+
             CALC_BOOK_CSS + '</style></head><body>'+
             calcBookCover('矩形板配筋计算书', esc2(t.title) + ' · ' + esc2(t.sub), dateStr) +
             '<h1>矩形板配筋计算书</h1><div class="sub">' + esc2(t.title) + ' · ' + esc2(t.sub) + '</div>'+
             '<div class="sub">计算日期：'+dateStr+'</div>'+
             '<h2>一、设计依据</h2><p>《混凝土结构设计规范》GB/T 50010-2010（2024年版） 第 6.2.10 条、第 8.5.1 条；《建筑结构荷载规范》GB 50009-2012。</p>'+
             '<h2>二、计算参数</h2>'+
             '<table><tr><th style="width:6%;">序号</th><th>参数</th><th style="width:14%;">单位</th><th style="width:18%;">取值</th></tr>'+pRows2+'</table>'+
             '<h2>三、板类判别与弯矩</h2>'+
             '<table>' + trow2('板类判别', r.isOneWay ? '单向板（l<sub>x</sub>/l<sub>y</sub> ≤ 1/3）' : '双向板（弹性理论）') +
             trow2('长短边比 l<sub>x</sub>/l<sub>y</sub>', r.ratio.toFixed(3)) +
             trow2('面荷载设计值 q', r.q.toFixed(2) + ' kN/m²') +
             trow2('短跨跨中弯矩 M<sub>x</sub>', r.mx.toFixed(3) + ' kN·m/m') +
             trow2('长跨跨中弯矩 M<sub>y</sub>', r.my.toFixed(3) + ' kN·m/m') +
             (r.rx0 ? trow2('短跨支座弯矩 M<sub>x0</sub>', r.mx0.toFixed(3) + ' kN·m/m') : '') +
             (r.ry0 ? trow2('长跨支座弯矩 M<sub>y0</sub>', r.my0.toFixed(3) + ' kN·m/m') : '') +
             '</table>'+
             '<h2>四、每延米配筋与实配复核</h2>'+
             '<table><tr><th>位置</th><th>M (kN·m/m)</th><th>h<sub>0</sub> (mm)</th><th>所需 A<sub>s</sub> (mm²/m)</th><th>配筋率 ρ</th><th>ρ<sub>min</sub></th><th>判定</th><th>推荐配筋</th><th>实配面积 (mm²/m)</th></tr>' + rebarRows + '</table>'+
             '<h2>五、详细计算过程</h2>' +
             '<table><tr><th style="width:6%;">步骤</th><th>内容</th></tr>' + stepRows2 + '</table>' +
             '<h2>六、结论</h2><p>按 GB/T 50010-2010（2024年版） 计算，结果详见上表。实配钢筋面积已复核，具体判定见「判定」列。</p>'+
             '<p class="note">本计算书由“计算工具箱”自动生成，依据 GB/T 50010-2010（2024年版） 及 GB 50009-2012。结果仅供参考，需设计人员复核确认。</p>'+
             calcBookSign() +
             calcBookFooter() +
             '</body></html>';
         downloadDoc('矩形板配筋计算书.doc', doc);
         return;
     }
    var vw = document.getElementById('view');
    // ① 计算参数（遍历表单字段，自动提取标签与取值）
    var params = [];
    var fields = vw.querySelectorAll('.field');
    for (var i = 0; i < fields.length; i++) {
        var lab = fields[i].querySelector('label');
        var inp = fields[i].querySelector('input, select');
        if (!lab || !inp) continue;
        var unitEl = lab.querySelector('span');
        var unit = unitEl ? unitEl.textContent.replace(/[()]/g, '').trim() : '';
        var labelText = lab.textContent.trim();
        if (unitEl) labelText = labelText.replace(/\([^)]*\)\s*$/, '').trim();
        var val = (inp.tagName === 'SELECT') ? (inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : inp.value) : inp.value;
        params.push({ label: labelText, unit: unit, val: val });
    }
    // ② 计算结果
    var resItems = [];
    var ris = vw.querySelectorAll('.result-item');
    for (var j = 0; j < ris.length; j++) {
        var l = ris[j].querySelector('.label'), v = ris[j].querySelector('.value');
        if (l && v) resItems.push({ label: l.textContent.trim(), val: v.textContent.replace(/\s+/g, ' ').trim() });
    }
    // ③ 计算过程
    var steps = [];
    var sts = vw.querySelectorAll('.proc-body .step');
    for (var k = 0; k < sts.length; k++) steps.push(sts[k].innerHTML);
    // ④ 设计依据（按模块补充规范全称）
    var isLift = CUR_TOOL === 'precast-lift';
    var basis = [
        '《混凝土结构设计规范》GB/T 50010-2010（2024年版）',
        '《建筑结构荷载规范》GB 50009-2012'
    ];
    if (isLift) basis.push('《装配式混凝土结构技术规程》JGJ 1-2014');
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    // ⑤ 组装文档
    var rows = '';
    params.forEach(function (p, i) {
        rows += '<tr><td>' + (i + 1) + '</td><td>' + esc(p.label) + '</td><td>' + esc(p.unit) + '</td><td>' + esc(p.val) + '</td></tr>';
    });
    var rrows = '';
    resItems.forEach(function (r, i) {
        rrows += '<tr><td>' + (i + 1) + '</td><td>' + esc(r.label) + '</td><td>' + esc(r.val) + '</td></tr>';
    });
    var srows = '';
    steps.forEach(function (s, i) {
        srows += '<tr><td style="width:6%;">' + (i + 1) + '</td><td>' + s + '</td></tr>';
    });
    var bstr = '';
    basis.forEach(function (b, i) {
        bstr += '<p>' + (i + 1) + '. ' + esc(b) + '</p>';
    });
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(t.title) + '计算书</title><style>' +
        CALC_BOOK_CSS +
        '.subtitle{text-align:center;font-size:12pt;margin-bottom:6px;}' +
        '.meta{font-size:11pt;margin-top:24px;}' +
        '</style></head><body>' +
        calcBookCover(esc(t.title) + '计算书', esc(t.sub), dateStr) +
        '<h1>结构计算书</h1>' +
        '<div class="subtitle">' + esc(t.title) + '</div>' +
        '<div class="subtitle">' + esc(t.sub) + '</div>' +
        '<div class="meta">' +
        '<p>工程名称：＿＿＿＿＿＿＿＿＿＿＿＿</p>' +
        '<p>构件名称：＿＿＿＿＿＿＿＿＿＿＿＿</p>' +
        '<p>计算日期：' + dateStr + '</p>' +
        '<p>设计：＿＿＿＿　校核：＿＿＿＿　审核：＿＿＿＿</p>' +
        '</div>' +
        '<h2>一、设计依据</h2>' + bstr +
        '<h2>二、计算参数</h2>' +
        '<table><tr><th style="width:6%;">序号</th><th>参数</th><th style="width:14%;">单位</th><th style="width:18%;">取值</th></tr>' + rows + '</table>' +
        '<h2>三、计算过程</h2>' +
        '<table><tr><th style="width:6%;">步骤</th><th>内容</th></tr>' + srows + '</table>' +
        '<h2>四、计算结果</h2>' +
        '<table><tr><th style="width:6%;">序号</th><th>项目</th><th>数值</th></tr>' + rrows + '</table>' +
        '<h2>五、结论与说明</h2>' +
        '<p>本计算书由“计算工具箱”自动生成，计算依据及过程见上文，供设计参考。</p>' +
        '<p class="note">声明：计算结果基于用户输入参数与规范条文计算，需由设计人员复核确认；实际工程还应综合考虑构造、抗震、耐久性等要求，以正式设计文件为准。</p>' +
        calcBookSign() +
        calcBookFooter() +
        '</body></html>';
    downloadDoc(esc(t.title) + '计算书.doc', doc);
}

console.log('[Core] report.js loaded. 计算书导出就绪。');
