/* 竖装蒸压加气混凝土外墙板，两端简支。 */
(function () {
    var AAC_DATA = {
        /* JGJ/T 17-2020 材料指标（表 3.2.2-1/3.2.2-2，配筋板材取括号值；表 3.2.3 弹性模量） */
        jgj: {
            'A2.5': { fc: 1.30, ftk: 0.36, ft: 0.26, Ec: 1700, rho: 425 },
            'A3.5': { fc: 2.02, ftk: 0.45, ft: 0.32, Ec: 1900, rho: 525 },
            'A5.0': { fc: 2.89, ftk: 0.49, ft: 0.35, Ec: 2300, rho: 625 },
            'A7.5': { fc: 3.91, ftk: 0.55, ft: 0.39, Ec: 2300, rho: 725 }
        },
        rebar: {
            'HPB300': { fy: 270, Es: 210000 },
            'CRB600H': { fy: 430, Es: 200000 },
            'HRB400': { fy: 360, Es: 200000 }
        }
    };
    // 图集节点的内置参考值，仅按已有的离散板厚比较。
    var nodeReferences = {
        150: [12, 5, 8],
        200: [15, 7, 10],
        250: [18, 8, 13],
        300: [20, 10, 16]
    };
    var nodeNames = ['预埋件摇摆', '钢管锚', '平板螺栓'];
    var gammaE = 1.4;
    var defaults = {
        aw_L: 3, aw_b: 600, aw_h: 200, aw_grade: 'A5.0', aw_reb: 'CRB600H', aw_d: 8, aw_n: 4, aw_as: 35,
        aw_d_outer: '', aw_n_outer: '', aw_as_outer: '', aw_w0: 0.45, aw_terrain: 'B', aw_z: 10, aw_mus: 1.2,
        aw_mus_suction: '', aw_gamm0: 1, aw_gammaG: 1.3, aw_gammaW: 1.5, aw_seis: 'n',
        aw_amax: 0.08, aw_eta: 1, aw_eta_cat: 1, aw_state: 1.2, aw_xi: 1.5, aw_psiW_seis: 0.2, aw_nj: 4, aw_gamma0j: 1.1
    };
    function interpolate(table, height) {
        if (height <= table[0][0]) return table[0][1];
        for (var i = 1; i < table.length; i++) {
            if (height <= table[i][0]) {
                var low = table[i - 1], high = table[i];
                return low[1] + (high[1] - low[1]) * (height - low[0]) / (high[0] - low[0]);
            }
        }
        return table[table.length - 1][1];
    }
    var tool = {
        title: '蒸压加气混凝土外墙板',
        sub: '配筋 AAC 外墙板正截面受弯、受剪、抗裂、挠度与连接节点复核 · JGJ/T 17-2020 / 19CJ85-1 B1',
        meta: {"standard": "JGJ/T 17-2020；抗震补充计算采用 T/CECS 553-2018 第5.2.3条和 GB 55002-2021 第4.3.2条", "formulaSource": "3.3.1、5.4.1～5.4.8", "limitations": "竖向外墙板，风荷载面外受弯/受剪/抗裂/挠度/地震/节点", "unit": "M:kN·m, w:mm, σ:N/mm²", "version": "1.1.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">设计依据与板材参数</div>' +
                '<div class="hint">设计依据：<a href="https://gf.cabr-fire.com/m/article-64855.htm" target="_blank" rel="noopener">JGJ/T 17-2020 第3.2节（材料性能）</a>；<a href="https://gf.cabr-fire.com/m/article-64856.htm" target="_blank" rel="noopener">第3.3节（自重）</a>；<a href="https://gf.cabr-fire.com/m/article-64862.htm" target="_blank" rel="noopener">第5.1节（设计原则）</a>；<a href="https://gf.cabr-fire.com/m/article-64865.htm" target="_blank" rel="noopener">第5.4节（板材设计计算）</a>；GB 50009-2012《建筑结构荷载规范》；GB/T 50011-2010（2024年版）《建筑抗震设计规范》；19CJ85-1 B1《装配式建筑蒸压加气混凝土板围护系统》（连接节点）。</div>' +
                '<div class="hint">弹性模量采用砂加气制品表值，干密度采用材料库的常用档位。请核对实际板材。</div>' +
                '<form id="f-aw"><div class="grid2">' +
                numField('aw_L', '板计算跨度 L', 'm', 3.0, '竖装墙板上下两端简支的计算跨度') +
                numField('aw_b', '板宽 b', 'mm', 600, '标准板宽 600mm，可按实际取用') +
                numField('aw_h', '板厚 h', 'mm', 200, '外墙板常用 150/175/200/250/300mm') +
                selField('aw_grade', 'AAC 强度等级', opts([
                    { v: 'A3.5', t: 'A3.5' },
                    { v: 'A5.0', t: 'A5.0' },
                    { v: 'A7.5', t: 'A7.5（外墙板 / 楼板）' }
                ], 'A5.0'), '配筋受弯板材不低于 A3.5，实际外墙等级按系统和工程条件核定') +
                selField('aw_reb', '钢筋级别', opts([
                    { v: 'HPB300', t: 'HPB300（fy=270）' },
                    { v: 'CRB600H', t: 'CRB600H（fy=430，推荐）' },
                    { v: 'HRB400', t: 'HRB400（fy=360）' }
                ], 'CRB600H'), 'JGJ/T 17-2020：宜采用 CRB600H 高延性冷轧带肋钢筋，纵筋直径≥5mm') +
                numField('aw_d', '内侧纵筋直径', 'mm', 8, '风压作用下内侧受拉') +
                numField('aw_n', '内侧纵筋根数', '根', 4) +
                numField('aw_as', '内侧纵筋合力点至内表面', 'mm', 35) +
                numField('aw_d_outer', '外侧纵筋直径', 'mm', '', '风吸作用下外侧受拉。留空取内侧对应值') +
                numField('aw_n_outer', '外侧纵筋根数', '根', '', '留空取内侧对应值') +
                numField('aw_as_outer', '外侧纵筋合力点至外表面', 'mm', '', '留空取内侧对应值') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">风荷载计算（GB 50009-2012 围护结构）</div>' +
                '<form id="f-aw2"><div class="grid2">' +
                numField('aw_w0', '基本风压 w<sub>0</sub>', 'kN/m²', 0.45, '按 GB 50009 附录E取值，重现期按规范确定') +
                selField('aw_terrain', '地面粗糙度类别', opts([
                    { v: 'A', t: 'A类（近海、海岸、沙漠）' },
                    { v: 'B', t: 'B类（田野、乡村、丘陵）' },
                    { v: 'C', t: 'C类（密集建筑群的城市）' },
                    { v: 'D', t: 'D类（密集建筑群且房屋较高的城市）' }
                ], 'B'), 'GB 50009-2012 表8.2.1') +
                numField('aw_z', '计算高度 z', 'm', 10.0, '墙板计算位置距地面高度') +
                numField('aw_mus', '风压或控制净局部体型系数', '—', 1.2, '只取最不利方向时，填控制幅值并将下一项留空。系数应计入内外压影响') +
                numField('aw_mus_suction', '风吸净局部体型系数', '—', '', '分方向计算时填写。留空按控制幅值验算两侧') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">荷载分项系数</div>' +
                '<form id="f-aw2b"><div class="grid2">' +
                numField('aw_gamm0', '结构重要性系数 γ<sub>0</sub>', '—', 1.0, '安全等级一级=1.1，二级=1.0，三级=0.9') +
                numField('aw_gammaG', '永久荷载分项系数 γ<sub>G</sub>', '—', 1.3, '自重沿板面方向，本模型的面外组合不计其效应') +
                numField('aw_gammaW', '风荷载分项系数 γ<sub>W</sub>', '—', 1.5, '取值应按项目适用荷载规范核定') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">地震作用参数</div>' +
                '<div class="hint">多遇地震按 <a href="https://www.gongbiaoku.com/book/70n196499lk" target="_blank" rel="noopener">T/CECS 553-2018</a> 第5.2.3条简化计算水平力，分项系数按 <a href="https://gf.cabr-fire.com/article-39113.htm" target="_blank" rel="noopener">GB 55002-2021 第4.3.2条</a> 取 1.4。</div>' +
                '<form id="f-aw3"><div class="grid2">' +
                selField('aw_seis', '是否验算多遇地震作用', opts([{ v: 'n', t: '不验算' }, { v: 'y', t: '验算' }], 'n')) +
                numField('aw_amax', '地震影响系数最大值 α<sub>max</sub>', '—', 0.08, '按工程设防参数取多遇地震值') +
                numField('aw_eta', '非结构构件功能系数 γ', '—', 1.0, '默认按丙类取 1.0，乙类取 1.4') +
                numField('aw_eta_cat', '非结构构件类别系数 η', '—', 1.0, '默认试算值 1.0，按项目采用的条文核定') +
                numField('aw_state', '状态系数 ζ<sub>1</sub>', '—', 1.2, '默认按柔性连接自承重墙板取 1.2') +
                numField('aw_xi', '位置系数 ζ<sub>2</sub>', '—', 1.5, '顶点取 2.0，底部取 1.0，沿高度线性分布') +
                selField('aw_psiW_seis', '地震组合风荷载系数 ψ<sub>W</sub>', opts([{ v: '0', t: '0.0（一般建筑结构）' }, { v: '0.2', t: '0.2（风荷载起控制作用）' }], '0.2'), '默认按风荷载起控制作用的工况试算') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">连接节点参数（19CJ85-1 B1）</div>' +
                '<div class="hint">JGJ/T 17-2020 第5.4.7条要求连接件承载力设计安全等级提高一级。程序计算单个连接件的作用需求，并用内置参考抗力比较三种节点。实际抗力按选用节点的构造和检测报告核实。</div>' +
                '<form id="f-aw4"><div class="grid2">' +
                numField('aw_nj', '每块板连接件数量 n<sub>j</sub>', '个', 4, '每块板上下支座连接件数量相等，每端按均分反力计算') +
                numField('aw_gamma0j', '连接件重要性系数 γ<sub>0j</sub>', '—', 1.1, '安全等级提高一级，二级→一级取1.1') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="aw_calc">计算</button>' +
                '<button type="button" class="btn btn-secondary" id="aw_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="aw_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="aw_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('aw_result'), proc = document.getElementById('aw_proc');
                window._AW_RESULT = null;
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                function val(id) { return document.getElementById(id).value; }
                function num(id, fallback) {
                    var value = val(id);
                    return value.trim() === '' ? (fallback === undefined ? NaN : fallback) : Number(value);
                }
                var L = num('aw_L'), b = num('aw_b'), h = num('aw_h');
                var grade = val('aw_grade'), rebGrade = val('aw_reb');
                var d = num('aw_d'), n = num('aw_n'), asV = num('aw_as');
                var dOuter = num('aw_d_outer', d), nOuter = num('aw_n_outer', n), asOuter = num('aw_as_outer', asV);
                var w0 = num('aw_w0'), terrain = val('aw_terrain'), zH = num('aw_z');
                var mus = Math.abs(num('aw_mus')), musSuction = Math.abs(num('aw_mus_suction', mus));
                var gamma0 = num('aw_gamm0'), gammaG = num('aw_gammaG'), gammaW = num('aw_gammaW');
                var seisOn = val('aw_seis') === 'y';
                var amax = num('aw_amax'), gammaFun = num('aw_eta'), etaCat = num('aw_eta_cat');
                var state = num('aw_state'), xiPos = num('aw_xi'), psiW = num('aw_psiW_seis', 0.2);
                var nj = num('aw_nj'), gamma0j = num('aw_gamma0j');
                function positive(value) { return Number.isFinite(value) && value > 0; }
                if (![L, b, h].every(positive)) return err('尺寸参数必须为正数。');
                if (![d, dOuter].every(positive) || ![n, nOuter].every(function (count) { return Number.isInteger(count) && count > 0; })) {
                    return err('两侧钢筋的直径必须为正数，根数必须为正整数。');
                }
                if (![asV, asOuter].every(positive) || asV + asOuter >= h) {
                    return err('两侧纵筋合力点距离均须大于 0，且两者之和须小于板厚。');
                }
                if (![w0, mus, musSuction].every(function (value) { return Number.isFinite(value) && value >= 0; }) ||
                    !positive(zH) || !['A', 'B', 'C', 'D'].includes(terrain)) return err('请检查基本风压、体型系数、计算高度和粗糙度类别。');
                if (![gamma0, gammaG, gammaW, gamma0j].every(positive)) return err('重要性系数和荷载分项系数必须为正数。');
                if (!Number.isInteger(nj) || nj < 2 || nj % 2 !== 0) return err('按上下支座均分反力时，连接件总数须为不小于 2 的偶数。');
                if (seisOn && (![amax, gammaFun, etaCat, state, xiPos].every(positive) || ![0, 0.2].includes(psiW))) {
                    return err('请核对多遇地震输入和风荷载组合系数。');
                }
                var g = AAC_DATA.jgj[grade], rb = AAC_DATA.rebar[rebGrade];
                if (!g || grade === 'A2.5' || !rb) return err('配筋受弯板材的强度等级至少为 A3.5，请核对材料。');
                /* 风压高度变化系数 μ_z（GB 50009-2012 表8.2.1） */
                var muzTable = {
                    A: [[5,1.09],[10,1.28],[15,1.42],[20,1.52],[30,1.67],[40,1.79],[50,1.89],[60,1.97],[70,2.05],[80,2.12],[90,2.18],[100,2.23],[150,2.46],[200,2.64],[250,2.78],[300,2.91],[350,3.02],[400,3.12],[450,3.21],[500,3.30]],
                    B: [[5,1.00],[10,1.00],[15,1.13],[20,1.23],[30,1.39],[40,1.52],[50,1.62],[60,1.71],[70,1.79],[80,1.87],[90,1.93],[100,2.00],[150,2.25],[200,2.46],[250,2.63],[300,2.77],[350,2.91],[400,3.03],[450,3.14],[500,3.24]],
                    C: [[5,0.65],[10,0.65],[15,0.65],[20,0.74],[30,0.88],[40,1.00],[50,1.10],[60,1.20],[70,1.28],[80,1.36],[90,1.43],[100,1.50],[150,1.79],[200,2.03],[250,2.24],[300,2.43],[350,2.60],[400,2.76],[450,2.91],[500,3.05]],
                    D: [[5,0.51],[10,0.51],[15,0.51],[20,0.51],[30,0.51],[40,0.60],[50,0.69],[60,0.77],[70,0.84],[80,0.91],[90,0.98],[100,1.04],[150,1.33],[200,1.58],[250,1.81],[300,2.02],[350,2.22],[400,2.40],[450,2.58],[500,2.74]]
                };
                /* 阵风系数 β_gz（GB 50009-2012 表8.6.1，围护结构） */
                var bgzTable = {
                    A: [[5,1.65],[10,1.60],[15,1.57],[20,1.55],[30,1.53],[40,1.51],[50,1.49],[60,1.48],[70,1.48],[80,1.47],[90,1.46],[100,1.46],[150,1.43],[200,1.42],[250,1.41],[300,1.40],[350,1.40],[400,1.40],[450,1.40],[500,1.40]],
                    B: [[5,1.70],[10,1.70],[15,1.66],[20,1.63],[30,1.59],[40,1.57],[50,1.55],[60,1.54],[70,1.52],[80,1.51],[90,1.50],[100,1.50],[150,1.47],[200,1.45],[250,1.43],[300,1.42],[350,1.41],[400,1.41],[450,1.41],[500,1.41]],
                    C: [[5,2.05],[10,2.05],[15,2.05],[20,1.99],[30,1.90],[40,1.85],[50,1.81],[60,1.78],[70,1.75],[80,1.73],[90,1.71],[100,1.69],[150,1.63],[200,1.59],[250,1.57],[300,1.54],[350,1.53],[400,1.51],[450,1.50],[500,1.50]],
                    D: [[5,2.40],[10,2.40],[15,2.40],[20,2.40],[30,2.40],[40,2.29],[50,2.20],[60,2.14],[70,2.09],[80,2.04],[90,2.01],[100,1.98],[150,1.87],[200,1.79],[250,1.74],[300,1.70],[350,1.67],[400,1.64],[450,1.62],[500,1.60]]
                };

                var muz = interpolate(muzTable[terrain], zH);
                var bgz = interpolate(bgzTable[terrain], zH);
                var fc = g.fc, ftk = g.ftk, ft = g.ft, Ec = g.Ec, rho0 = g.rho;
                var fy = rb.fy, Es = rb.Es;
                var As = Math.PI * d * d * n / 4;
                var AsOuter = Math.PI * dOuter * dOuter * nOuter / 4;

                // 换算截面：以外表面为坐标原点，计入两侧钢筋并绕换算形心取惯性矩。
                var area = b * h;
                var alphaE = Es / Ec;
                var innerArea = (alphaE - 1) * As, outerArea = (alphaE - 1) * AsOuter;
                var centroid = (area * h / 2 + innerArea * (h - asV) + outerArea * asOuter) /
                    (area + innerArea + outerArea);
                var I0 = b * Math.pow(h, 3) / 12 + area * Math.pow(h / 2 - centroid, 2) +
                    innerArea * Math.pow(h - asV - centroid, 2) + outerArea * Math.pow(asOuter - centroid, 2);
                var Bs = 0.85 * Ec * I0;
                var rhoSelf = rho0 * 1.4;
                var qgk = rhoSelf * b * h * 9.8 / 1e9;
                var Gk = qgk * L;
                var FEk = seisOn ? gammaFun * etaCat * amax * state * xiPos * Gk : 0;
                var Fe = gammaE * FEk;
                var Mseis = Fe * L / 4;
                var Lmm = L * 1000;
                var deflLim = Lmm / 200;
                var rhoMax = 0.5 * fc / fy * 100;

                function checkDirection(name, coefficient, steelArea, edgeDistance, tensionEdge) {
                    var wk = bgz * muz * coefficient * w0;
                    var q = wk * b / 1000;
                    var Mwk = q * L * L / 8;
                    var h0 = h - edgeDistance;
                    var x = fy * steelArea / (fc * b);
                    var xMax = 0.5 * h0;
                    var overRein = x > xMax;
                    var xUse = Math.min(x, xMax);
                    var Mu = 0.75 * fc * b * xUse * (h0 - xUse / 2) / 1e6;
                    var Vu = 0.45 * ft * b * h0 / 1000;
                    var M = gammaW * Mwk;
                    var V = gammaW * q * L / 2;
                    var windM = gamma0 * M, windV = gamma0 * V;
                    var Mcomb = seisOn ? Mseis + psiW * M : 0;
                    var Vcomb = seisOn ? Fe / 2 + psiW * V : 0;
                    var sigma = Mwk * 1e6 * tensionEdge / I0;
                    // 风荷载准永久值为 0，该面外模型中 B = Bs。
                    var defl = 5 * q * Math.pow(Lmm, 4) / (384 * Bs);
                    return { name: name, coefficient: coefficient, wk: wk, q: q, Mwk: Mwk, As: steelArea, h0: h0,
                        x: x, xMax: xMax, overRein: overRein, Mu: Mu, Vu: Vu, M: M, V: V, windM: windM, windV: windV,
                        Mcomb: Mcomb, Vcomb: Vcomb, sigma: sigma, defl: defl,
                        capOk: !overRein && windM <= Mu, tauOk: windV <= Vu,
                        seisFlexOk: !overRein && Mcomb <= Mu, seisShearOk: Vcomb <= Vu,
                        crackOk: sigma <= ftk, deflOk: defl <= deflLim };
                }
                var pressure = checkDirection('风压（内侧受拉）', mus, As, asV, h - centroid);
                var suction = checkDirection('风吸（外侧受拉）', musSuction, AsOuter, asOuter, centroid);
                var directions = [pressure, suction];
                var wind = pressure.wk >= suction.wk ? pressure : suction;
                var flex = pressure;
                if ((pressure.capOk && !suction.capOk) ||
                    (pressure.capOk === suction.capOk && suction.windM / suction.Mu > pressure.windM / pressure.Mu)) {
                    flex = suction;
                }
                var shear = pressure.windV / pressure.Vu >= suction.windV / suction.Vu ? pressure : suction;

                var Nwj = gamma0j * gammaW * wind.q * L / nj;
                var windNodeDemand = 2 * Nwj;
                var Vsj = gamma0j * Fe / nj;
                var VsjCombo = Vsj + (seisOn ? psiW * Nwj : 0);
                var finiteChecks = directions.every(function (c) {
                    return [c.Mu, c.Vu, c.windM, c.windV, c.Mcomb, c.Vcomb, c.sigma, c.defl].every(Number.isFinite);
                });
                if (!finiteChecks || !positive(Bs) || ![windNodeDemand, VsjCombo].every(Number.isFinite)) {
                    return err('计算结果超出可用数值范围，请检查输入。');
                }
                var nodeDemand = Math.max(windNodeDemand, VsjCombo);
                var reference = nodeReferences[h];
                var nodeChecks = reference ? nodeNames.map(function (name, i) {
                    var resistance = reference[i];
                    return { name: name, resistance: resistance, windOk: windNodeDemand <= resistance,
                        seismicOk: seisOn ? VsjCombo <= resistance : null, ok: nodeDemand <= resistance };
                }) : [];
                function both(key) { return pressure[key] && suction[key]; }
                var r = {
                    std: 'jgj', stdName: 'JGJ/T 17-2020', isCECS: false, grade: grade, rebGrade: rebGrade,
                    L: L, b: b, h: h, h0: flex.h0, asV: asV, As: flex.As, AsInner: As, AsOuter: AsOuter,
                    d: d, n: n, fc: fc, ftk: ftk, ft: ft, Ec: Ec, fy: fy, Es: Es, rho0: rho0, rhoSelf: rhoSelf,
                    rho: flex.As / (b * flex.h0) * 100, rhoMax: rhoMax, qgk: qgk, qg: qgk * gammaG,
                    w0: w0, terrain: terrain, zH: zH, mus: mus, musSuction: musSuction, muz: muz, bgz: bgz,
                    wk: wind.wk, qWind_k: wind.q, qWind_d: gammaW * wind.q, Mwk: wind.Mwk, Md: wind.M, Mwk_ctrl: wind.Mwk,
                    gamma0: gamma0, gammaG: gammaG, gammaW: gammaW, psiW: psiW, gammaE: gammaE,
                    directions: directions,
                    equalWindChecks: pressure.wk === suction.wk && pressure.As === suction.As && pressure.h0 === suction.h0,
                    windFlexControl: flex.name, windShearControl: shear.name, M: flex.M, Mu: flex.Mu, x: flex.x, xMax: flex.xMax,
                    overRein: pressure.overRein || suction.overRein, capOk: both('capOk'),
                    Vmax: shear.V, Vdesign: shear.windV, tau: shear.windV * 1000 / (b * shear.h0), tauOk: both('tauOk'),
                    seisOn: seisOn, FEk: FEk, Fe: Fe, Mseis: Mseis, Mcomb: Math.max(pressure.Mcomb, suction.Mcomb),
                    seisFlexOk: seisOn ? both('seisFlexOk') : null, seisShearOk: seisOn ? both('seisShearOk') : null,
                    seisOk: seisOn ? both('seisFlexOk') && both('seisShearOk') : null,
                    sigmaCk: Math.max(pressure.sigma, suction.sigma), crackOk: both('crackOk'), crack1Ok: both('crackOk'),
                    I0: I0, centroid: centroid, Bs: Bs, B: Bs, defl: Math.max(pressure.defl, suction.defl),
                    deflLim: deflLim, deflOk: both('deflOk'), nj: nj, gamma0j: gamma0j,
                    Apanel: wind.q * L, Nw_total: Nwj * nj, Nwj: Nwj, Ve_total: Vsj * nj,
                    Vsj: Vsj, VsjCombo: VsjCombo, Rd_node: windNodeDemand, nodeDemand: nodeDemand,
                    nodeChecks: nodeChecks, nodeOk: reference ? nodeChecks.every(function (node) { return node.ok; }) : null,
                    reviewRequired: true
                };
                var checks = aacWallCheckRows(r);
                var nodeRows = aacWallNodeRows(r);
                var conclusion = aacWallConclusion(r);
                function line(label, value) { return '<div>' + label + '　' + value + '</div>'; }
                function step(title, body) { return '<div class="step"><b>' + title + '</b>' + body + '</div>'; }
                r.steps = step('材料和截面', line('板材与钢筋', grade + '　' + rebGrade + '　f<sub>c</sub> = ' + fmt(fc, 2) +
                    ' N/mm²，E<sub>c</sub> = ' + fmt(Ec, 0) + ' N/mm²，f<sub>y</sub> = ' + fmt(fy, 0) + ' N/mm²，干密度 ' + fmt(rho0, 0) + ' kg/m³。') +
                    line('两侧纵筋', '内侧 ' + n + 'Φ' + d + '，距内表面 ' + asV + ' mm。外侧 ' + nOuter +
                    'Φ' + dOuter + '，距外表面 ' + asOuter + ' mm。') +
                    line('换算截面', '形心距外表面 ' + fmt(centroid, 2) + ' mm，I<sub>0</sub> = ' + fmt(I0, 0) +
                    ' mm⁴，B = B<sub>s</sub> = 0.85E<sub>c</sub>I<sub>0</sub> = ' + fmt(Bs, 0) + ' N·mm²。')) +
                    step('自重与风荷载', line('板材自重（JGJ/T 17-2020 第3.3.1条）', '干密度 × 1.4，线自重 ' +
                    fmt(qgk, 3) + ' kN/m，单块板重 ' + fmt(Gk, 3) + ' kN。自重沿板面作用。') +
                    line('风荷载标准值', 'w<sub>k</sub> = β<sub>gz</sub> μ<sub>z</sub> |μ<sub>sl</sub>| w<sub>0</sub>，β<sub>gz</sub> = ' +
                    fmt(bgz, 3) + '，μ<sub>z</sub> = ' + fmt(muz, 3) + '。') +
                    line('简支板', 'q = w<sub>k</sub>b，M<sub>wk</sub> = qL²/8，V<sub>wk</sub> = qL/2。')) +
                    (seisOn ? step('多遇地震组合', line('水平地震力', 'F<sub>Ehk</sub> = γηα<sub>max</sub>ζ<sub>1</sub>ζ<sub>2</sub>G<sub>k</sub> = ' +
                    fmt(FEk, 3) + ' kN，F<sub>Eh</sub> = 1.4 F<sub>Ehk</sub> = ' + fmt(Fe, 3) + ' kN。') +
                    line('跨中等效集中力', 'M<sub>E</sub> = F<sub>Eh</sub>L/4，V<sub>E</sub> = F<sub>Eh</sub>/2。两方向分别叠加 ψ<sub>W</sub> = ' +
                    fmt(psiW, 1) + ' 的同向设计风荷载效应。抗震抗力暂按 γ<sub>RE</sub> = 1.0 比较。')) : '') +
                    step('板材验算（JGJ/T 17-2020 第5.4节）',
                        line('受弯', 'x = f<sub>y</sub>A<sub>s</sub>/(f<sub>c</sub>b)，x ≤ 0.5h<sub>0</sub>，' +
                        'M<sub>u</sub> = 0.75f<sub>c</sub>bx(h<sub>0</sub> − x/2)。') +
                        line('受剪', '风荷载按 γ<sub>0</sub>V 与 V<sub>u</sub> = 0.45 f<sub>t</sub> b h<sub>0</sub> 比较。') +
                        line('抗裂与挠度', '以换算截面计算当侧受拉边缘应力 M<sub>wk</sub>·c<sub>t</sub>/I<sub>0</sub>，' +
                        '挠度取 5qL⁴/(384B)。') +
                        checks.map(function (row) { return line(row[0], row[1] + (row[2] ? ' 满足' : row[2] === false ? ' 不满足' : '')); }).join('')) +
                    step('连接件面外需求', line('支承假定', '上下端反力各占一半，每端连接件均分反力。' +
                    '竖向自重由托件或主体结构承托。') +
                    line('风荷载', 'N<sub>wj</sub> = γ<sub>0j</sub>γ<sub>W</sub>w<sub>k</sub>bL/n<sub>j</sub>。') +
                    (seisOn ? line('多遇地震组合', 'V<sub>sj</sub> = γ<sub>0j</sub>F<sub>Eh</sub>/n<sub>j</sub>，组合需求 = V<sub>sj</sub> + ψ<sub>W</sub>N<sub>wj</sub>。') : '') +
                    nodeRows.map(function (row) { return line(row[0], row[1]); }).join('')) +
                    step('综合判定', line('', conclusion.text));
                var html = resultRow('自重线荷载', fmt(qgk, 3) + ' kN/m');
                checks.concat(nodeRows).forEach(function (row) {
                    html += resultRow(row[0], row[1] + (row[2] === undefined ? '' : ' ' + tag(row[2] ? 'ok' : 'err', row[2] ? '满足' : '不满足')));
                });
                html += resultRow('综合判定', badge(conclusion.hasFailure ? 'badge-err' : 'badge-warn', conclusion.text));
                window._AW_RESULT = r;
                out.innerHTML = html;
                proc.innerHTML = r.steps;
                var procedure = proc.closest('.proc-wrap');
                if (procedure) procedure.classList.add('open');
            }
            function reset() {
                Object.keys(defaults).forEach(function (id) { document.getElementById(id).value = defaults[id]; });
                calc();
            }
            document.getElementById('aw_calc').addEventListener('click', calc);
            document.getElementById('aw_reset').addEventListener('click', reset);
            ['f-aw', 'f-aw2', 'f-aw2b', 'f-aw3', 'f-aw4'].forEach(function (id) {
                document.getElementById(id).addEventListener('keydown', function (event) {
                    if (event.key === 'Enter') { event.preventDefault(); calc(); }
                });
            });
            Object.keys(defaults).forEach(function (id) { document.getElementById(id).addEventListener('change', calc); });
            ['aw_w0', 'aw_z', 'aw_mus', 'aw_mus_suction'].forEach(function (id) {
                document.getElementById(id).addEventListener('input', calc);
            });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['aac-wall'] = tool;
})();

