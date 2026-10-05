/* aac-wall 工具模块（含前置数据/函数依赖）
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var AAC_DATA = {
        /* JGJ/T 17-2020 材料指标（表 3.2.2-1/3.2.2-2，配筋板材取括号值；表 3.2.3 弹性模量） */
        jgj: {
            'A2.5': { fc: 1.30, ftk: 0.36, ft: 0.26, Ec: 1700, rho: 425 },
            'A3.5': { fc: 2.02, ftk: 0.45, ft: 0.32, Ec: 1900, rho: 525 },
            'A5.0': { fc: 2.89, ftk: 0.49, ft: 0.35, Ec: 2300, rho: 625 },
            'A7.5': { fc: 3.91, ftk: 0.55, ft: 0.39, Ec: 2300, rho: 725 }
        },
        /* T/CECS 553-2018 材料指标（表 3.2.1-1/2, 3.2.2, 3.2.3） */
        cecs: {
            'A3.5': { fc: 2.01, ftk: 0.45, ft: 0.32, Ec: 1900, rho: 525 },
            'A5.0': { fc: 2.89, ftk: 0.48, ft: 0.34, Ec: 2300, rho: 625 }
        },
        rebar: {
            'HPB300': { fy: 270, Es: 210000 },
            'CRB600H': { fy: 430, Es: 200000 },
            'HRB400': { fy: 360, Es: 200000 }
        }
    };
    var tool = {
        title: '蒸压加气混凝土外墙板',
        sub: '配筋 AAC 外墙板正截面受弯、受剪、抗裂、挠度与连接节点复核 · JGJ/T 17-2020 / T/CECS 553-2018 / 19CJ85-1',
        meta: {"standard": "JGJ/T 17-2020 + T/CECS 553-2018", "formulaSource": "—", "limitations": "竖向外墙板，风荷载面外受弯/受剪/抗裂/挠度/地震/节点", "unit": "M:kN·m/m, w:mm, σ:N/mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">设计依据与板材参数</div>' +
                '<div class="hint">设计依据：JGJ/T 17-2020《蒸压加气混凝土制品应用技术标准》；T/CECS 553-2018《蒸压加气混凝土墙板应用技术规程》；GB 50009-2012《建筑结构荷载规范》（风荷载）；GB/T 50011-2010（2024年版）《建筑抗震设计规范》（地震作用）；19CJ85-1《装配式建筑蒸压加气混凝土板围护系统》（连接节点）。</div>' +
                '<form id="f-aw"><div class="grid2">' +
                selField('aw_std', '计算依据标准', opts([
                    { v: 'jgj', t: 'JGJ/T 17-2020 蒸压加气混凝土制品应用技术标准' },
                    { v: 'cecs', t: 'T/CECS 553-2018 蒸压加气混凝土墙板应用技术规程' }
                ], 'jgj'), '选择主计算依据标准，材料指标和计算公式自动切换') +
                numField('aw_L', '板计算跨度 L', 'm', 3.0, '墙板水平方向支承跨度，通常等于层高或柱距') +
                numField('aw_b', '板宽 b', 'mm', 600, '标准板宽 600mm，可按实际取用') +
                numField('aw_h', '板厚 h', 'mm', 200, '外墙板常用 150/175/200/250/300mm') +
                selField('aw_grade', 'AAC 强度等级', opts([
                    { v: 'A2.5', t: 'A2.5（隔墙板）' },
                    { v: 'A3.5', t: 'A3.5（屋面板）' },
                    { v: 'A5.0', t: 'A5.0（外墙板 / 楼板）' },
                    { v: 'A7.5', t: 'A7.5（外墙板 / 楼板）' }
                ], 'A5.0'), '外墙板应≥A5.0；T/CECS 553-2018 仅含 A3.5/A5.0') +
                selField('aw_reb', '钢筋级别', opts([
                    { v: 'HPB300', t: 'HPB300（fy=270）' },
                    { v: 'CRB600H', t: 'CRB600H（fy=430，推荐）' },
                    { v: 'HRB400', t: 'HRB400（fy=360）' }
                ], 'CRB600H'), 'T/CECS 553-2018 3.2.9：宜采用 CRB600H 高延性冷轧带肋钢筋，纵筋直径≥5mm') +
                numField('aw_d', '受拉钢筋直径 d', 'mm', 8, '单根纵筋直径，范围 5~10mm') +
                numField('aw_n', '受拉钢筋根数 n', '根', 4, '板宽方向底部受拉钢筋总根数') +
                numField('aw_as', '受拉钢筋合力点至截面边缘 a<sub>s</sub>', 'mm', 35, '保护层厚度 + 钢筋半径，AAC 板保护层一般≥25mm') +
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
                numField('aw_mus', '体型系数 μ<sub>s</sub>', '—', 1.2, '风压取0.8，墙面风吸取-0.7~-1.0，墙角/檐口取-1.4~-2.0，此处取控制值（绝对值）') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">荷载分项系数</div>' +
                '<form id="f-aw2b"><div class="grid2">' +
                numField('aw_gamm0', '结构重要性系数 γ<sub>0</sub>', '—', 1.0, '安全等级一级=1.1，二级=1.0，三级=0.9') +
                numField('aw_gammaG', '永久荷载分项系数 γ<sub>G</sub>', '—', 1.3, 'T/CECS 553-2018 5.2.1 取 1.3') +
                numField('aw_gammaW', '风荷载分项系数 γ<sub>W</sub>', '—', 1.5, 'T/CECS 553-2018 5.2.1 取 1.5') +
                numField('aw_psiW', '风荷载组合值系数 ψ<sub>W</sub>', '—', 0.6, '持久状况取 0.6，地震状况取 0.2') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">地震作用参数</div>' +
                '<div class="hint">地震作用验算依据 T/CECS 553-2018 第5.2.3-5.2.4 条。JGJ/T 17-2020 无墙板平面外地震作用专门计算条文，选用 JGJ/T 17-2020 时同样参照 T/CECS 553-2018 计算。</div>' +
                '<form id="f-aw3"><div class="grid2">' +
                selField('aw_seis', '是否验算地震作用', opts([{ v: 'n', t: '不验算' }, { v: 'y', t: '验算' }], 'n'), 'T/CECS 553-2018 5.2.3 平面外水平地震作用') +
                numField('aw_amax', '地震影响系数最大值 α<sub>max</sub>', '—', 0.08, '多遇地震，按 GB 50011 取值（6度=0.04, 7度=0.08, 8度=0.16）') +
                numField('aw_eta', '功能系数 η', '—', 1.0, '乙类取 1.4，丙类取 1.0') +
                numField('aw_xi', '位置系数 ξ', '—', 1.5, '顶点取 2.0，底部取 1.0，沿高度线性分布') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">连接节点参数（19CJ85-1 B1）</div>' +
                '<div class="hint">19CJ85-1 第6.6条：连接件承载力设计的安全等级应提高一级。连接节点及预埋件的承载力设计值不应小于2倍风荷载设计值。</div>' +
                '<form id="f-aw4"><div class="grid2">' +
                numField('aw_nj', '每块板连接件数量 n<sub>j</sub>', '个', 4, '每块板连接件总数（上下支座各 n<sub>j</sub>/2）') +
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
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var std = document.getElementById('aw_std').value;
                var isCECS = std === 'cecs';
                var stdName = isCECS ? 'T/CECS 553-2018' : 'JGJ/T 17-2020';
                var L = parseFloat(document.getElementById('aw_L').value);
                var b = parseFloat(document.getElementById('aw_b').value);
                var h = parseFloat(document.getElementById('aw_h').value);
                var grade = document.getElementById('aw_grade').value;
                var rebGrade = document.getElementById('aw_reb').value;
                var d = parseFloat(document.getElementById('aw_d').value);
                var n = parseFloat(document.getElementById('aw_n').value);
                var asV = parseFloat(document.getElementById('aw_as').value);
                /* ===== 风荷载标准值计算（GB 50009-2012 围护结构） ===== */
                var w0 = parseFloat(document.getElementById('aw_w0').value);
                var terrain = document.getElementById('aw_terrain').value;
                var zH = parseFloat(document.getElementById('aw_z').value);
                var mus = parseFloat(document.getElementById('aw_mus').value);
                /* 风压高度变化系数 μ_z（GB 50009-2012 表8.2.1） */
                var muzTable = {
                    A: [[5,1.09],[10,1.28],[15,1.42],[20,1.52],[30,1.67],[40,1.79],[50,1.89],[60,1.97],[70,2.05],[80,2.12],[90,2.18],[100,2.23],[150,2.46],[200,2.64],[250,2.78],[300,2.91],[350,3.02],[400,3.12],[450,3.21],[500,3.30]],
                    B: [[5,1.00],[10,1.00],[15,1.13],[20,1.23],[30,1.39],[40,1.52],[50,1.62],[60,1.71],[70,1.79],[80,1.87],[90,1.93],[100,2.00],[150,2.25],[200,2.46],[250,2.63],[300,2.77],[350,2.91],[400,3.03],[450,3.14],[500,3.24]],
                    C: [[5,0.65],[10,0.65],[15,0.65],[20,0.74],[30,0.88],[40,1.00],[50,1.10],[60,1.20],[70,1.28],[80,1.36],[90,1.43],[100,1.50],[150,1.79],[200,2.03],[250,2.24],[300,2.43],[350,2.60],[400,2.76],[450,2.91],[500,3.05]],
                    D: [[5,0.51],[10,0.51],[15,0.51],[20,0.51],[30,0.51],[40,0.60],[50,0.69],[60,0.77],[70,0.84],[80,0.91],[90,0.98],[100,1.04],[150,1.33],[200,1.58],[250,1.81],[300,2.02],[350,2.22],[400,2.40],[450,2.58],[500,2.74]]
                };
                function interp1d(tbl, x) {
                    if (x <= tbl[0][0]) return tbl[0][1];
                    if (x >= tbl[tbl.length-1][0]) return tbl[tbl.length-1][1];
                    for (var i = 0; i < tbl.length - 1; i++) {
                        if (x >= tbl[i][0] && x <= tbl[i+1][0]) {
                            var t = (x - tbl[i][0]) / (tbl[i+1][0] - tbl[i][0]);
                            return tbl[i][1] + t * (tbl[i+1][1] - tbl[i][1]);
                        }
                    }
                    return tbl[tbl.length-1][1];
                }
                var muz = interp1d(muzTable[terrain], Math.max(zH, 5));
                /* 阵风系数 β_gz（GB 50009-2012 表8.6.1，围护结构） */
                var bgzTable = {
                    A: [[5,1.65],[10,1.60],[15,1.57],[20,1.55],[30,1.53],[40,1.51],[50,1.49],[60,1.48],[70,1.48],[80,1.47],[90,1.46],[100,1.46],[150,1.43],[200,1.42],[250,1.41],[300,1.40],[350,1.40],[400,1.40],[450,1.40],[500,1.40]],
                    B: [[5,1.70],[10,1.70],[15,1.66],[20,1.63],[30,1.59],[40,1.57],[50,1.55],[60,1.54],[70,1.52],[80,1.51],[90,1.50],[100,1.50],[150,1.47],[200,1.45],[250,1.43],[300,1.42],[350,1.41],[400,1.41],[450,1.41],[500,1.41]],
                    C: [[5,2.05],[10,2.05],[15,2.05],[20,1.99],[30,1.90],[40,1.85],[50,1.81],[60,1.78],[70,1.75],[80,1.73],[90,1.71],[100,1.69],[150,1.63],[200,1.59],[250,1.57],[300,1.54],[350,1.53],[400,1.51],[450,1.50],[500,1.50]],
                    D: [[5,2.40],[10,2.40],[15,2.40],[20,2.40],[30,2.40],[40,2.29],[50,2.20],[60,2.14],[70,2.09],[80,2.04],[90,2.01],[100,1.98],[150,1.87],[200,1.79],[250,1.74],[300,1.70],[350,1.67],[400,1.64],[450,1.62],[500,1.60]]
                };
                var bgz = interp1d(bgzTable[terrain], Math.max(zH, 5));
                /* 围护结构风荷载标准值：w_k = β_gz · μ_s · μ_z · w_0
                   单一体型系数μ_s取控制值（绝对值），风压和风吸均按此计算 */
                var wk = bgz * Math.abs(mus) * muz * w0;
                var gamma0 = parseFloat(document.getElementById('aw_gamm0').value);
                var gammaG = parseFloat(document.getElementById('aw_gammaG').value);
                var gammaW = parseFloat(document.getElementById('aw_gammaW').value);
                var psiW = parseFloat(document.getElementById('aw_psiW').value);
                var seisOn = document.getElementById('aw_seis').value === 'y';
                var amax = parseFloat(document.getElementById('aw_amax').value);
                var etaFun = parseFloat(document.getElementById('aw_eta').value);
                var xiPos = parseFloat(document.getElementById('aw_xi').value);
                var nj = parseInt(document.getElementById('aw_nj').value);
                var gamma0j = parseFloat(document.getElementById('aw_gamma0j').value);
                if (!(L > 0 && b > 0 && h > 0)) return err('尺寸参数必须为正数。');
                if (!(d > 0 && n > 0)) return err('钢筋直径和根数必须为正数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应满足 0 < a<sub>s</sub> < h。');
                /* 根据标准选择材料库 */
                var gradeLib = isCECS ? AAC_DATA.cecs : AAC_DATA.jgj;
                if (!gradeLib[grade]) return err(stdName + ' 不含强度等级 ' + grade + '，请选择 ' + (isCECS ? 'A3.5 或 A5.0' : '其他等级') + '。');
                var g = gradeLib[grade];
                var rb = AAC_DATA.rebar[rebGrade];
                var fc = g.fc, ftk = g.ftk, ft = g.ft, Ec = g.Ec, rho0 = g.rho;
                var fy = rb.fy, Es = rb.Es;
                var As = Math.PI * d * d / 4 * n;
                var h0 = h - asV;
                if (h0 <= 0) return err('截面有效高度 h<sub>0</sub> = h − a<sub>s</sub> 必须大于 0。');
                /* CECS 对称配筋：受压钢筋面积 = 受拉钢筋面积 */
                var AsPrime = isCECS ? As : 0;
                /* 自重：干密度×1.4（JGJ/T 17-2020 3.3.1 / CECS 553-2018 3.2.4） */
                var rhoSelf = rho0 * 1.4;
                var qgk = rhoSelf * b / 1000 * h / 1000 * 9.8 / 1000;
                var qg = gammaG * qgk;
                /* 竖向外墙板：自重沿板面方向，不产生面外弯曲；
                   面外荷载仅由风荷载产生。风荷载是第一可变作用，
                   基本组合：S = γ_W · S_Wk（风为第一可变，自重为永久荷载但沿板面方向）
                   保守考虑时可将自重作为有利项（抗风吸），但面外受弯的荷载主要是风。
                   按规范5.2.1式5.2.1-1：S = γ_G·S_Gk + γ_W·S_Wk
                   对于竖向墙板，自重是面内荷载，S_Gk（面外）= 0，
                   所以面外设计弯矩仅由风荷载产生。 */
                var qWind_k = wk * b / 1000;  /* 风荷载标准线荷载 kN/m */
                var qWind_d = gammaW * qWind_k;  /* 风荷载设计线荷载 */
                /* 持久设计状况基本组合（风为第一可变作用）：
                   式5.2.1-1：S = γ_G·S_Gk + γ_W·S_Wk
                   竖向墙板自重为面内荷载，S_Gk（面外）≈ 0，
                   故面外设计弯矩 M = γ_W · M_Wk */
                var Mwk = qWind_k * L * L / 8;
                var Md = gammaW * Mwk;  /* 风荷载设计弯矩 */
                var M = Md;
                var Mwk_ctrl = Mwk;
                var st = [];
                /* 步骤编号计数器：前6步（①-⑥）固定硬编码，后续步骤动态编号 */
                var stepIdx = 6;
                function stepNo() { stepIdx++; return ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯'][stepIdx-1] || ('' + stepIdx); }
                var ftName = '劈拉强度'; /* JGJ/T 17-2020 表3.2.2-2 / 5.4.2：f_t 为劈拉强度设计值；T/CECS 553-2018 同 */
                var ftkName = isCECS ? 'f<span style="font-size:0.75em;vertical-align:sub;">tk</span>\'' : 'f<sub>tk</sub>';
                st.push('<div class="step"><b>① 材料指标（' + stdName + '）</b>　AAC 强度等级 ' + grade + '：f<sub>c</sub> = ' + fmt(fc, 2) + ' N/mm²，' + ftkName + ' = ' + fmt(ftk, 2) + ' N/mm²，f<sub>t</sub>（' + ftName + '设计值） = ' + fmt(ft, 2) + ' N/mm²，E<sub>c</sub> = ' + fmt(Ec, 0) + ' N/mm²；干密度 ρ<sub>0</sub> = ' + fmt(rho0, 0) + ' kg/m³。钢筋 ' + rebGrade + '：f<sub>y</sub> = ' + fmt(fy, 0) + ' N/mm²，E<sub>s</sub> = ' + fmt(Es, 0) + ' N/mm²。</div>');
                st.push('<div class="step"><b>② 截面与配筋</b>　b = ' + fmt(b, 0) + ' mm，h = ' + fmt(h, 0) + ' mm，h<sub>0</sub> = h − a<sub>s</sub> = ' + fmt(h, 0) + ' − ' + fmt(asV, 0) + ' = ' + fmt(h0, 0) + ' mm。φ' + fmt(d, 0) + ' × ' + fmt(n, 0) + ' 根：A<sub>s</sub> = π·d²/4×n = <b>' + fmt(As, 1) + ' mm²</b>。配筋率 ρ = A<sub>s</sub>/(b·h<sub>0</sub>) = <b>' + fmt(As / (b * h0) * 100, 3) + '%</b>' + (isCECS ? '（对称配筋，A<sub>s</sub>\' = A<sub>s</sub>）' : '') + '</div>');
                st.push('<div class="step"><b>③ 自重计算（' + stdName + ' 3.2.4）</b>　板材自重按干密度的 1.4 倍：ρ<sub>self</sub> = 1.4×ρ<sub>0</sub> = ' + fmt(rhoSelf, 0) + ' kg/m³。线自重 q<sub>gk</sub> = ρ<sub>self</sub>·g·b·h/10⁶ = <b>' + fmt(qgk, 3) + ' kN/m</b>。<br>　　<b>注：竖向外墙板自重沿板面方向（面内），不产生面外弯曲。</b></div>');
                st.push('<div class="step"><b>④ 风荷载标准值与荷载组合</b>　' +
                    '<b>4.1 风荷载标准值（GB 50009-2012 第8章 围护结构）</b><br>' +
                    '　　基本风压 w<sub>0</sub> = ' + fmt(w0, 3) + ' kN/m²；地面粗糙度：' + terrain + '类；计算高度 z = ' + fmt(zH, 1) + ' m<br>' +
                    '　　风压高度变化系数 μ<sub>z</sub> = <b>' + fmt(muz, 3) + '</b>（表8.2.1，z=' + fmt(zH, 1) + 'm，插值）<br>' +
                    '　　阵风系数 β<sub>gz</sub> = <b>' + fmt(bgz, 3) + '</b>（表8.6.1，围护结构）<br>' +
                    '　　体型系数：μ<sub>s</sub> = ' + fmt(mus, 2) + '（控制值，取绝对值）<br>' +
                    '　　围护结构公式：w<sub>k</sub> = β<sub>gz</sub>·|μ<sub>s</sub>|·μ<sub>z</sub>·w<sub>0</sub><br>' +
                    '　　w<sub>k</sub> = ' + fmt(bgz, 3) + '×' + fmt(Math.abs(mus), 2) + '×' + fmt(muz, 3) + '×' + fmt(w0, 3) + ' = <b>' + fmt(wk, 3) + ' kN/m²</b><br>' +
                    '　　<b>4.2 荷载组合（' + (isCECS ? stdName + ' 5.2.1' : 'GB 50009-2012') + '）</b>　竖向外墙板面外荷载仅为风荷载（自重沿面内方向）。<br>');
                if (isCECS) {
                    st.push('　　持久设计状况基本组合（式5.2.1-1）：S = γ<sub>G</sub>·S<sub>Gk</sub> + γ<sub>W</sub>·S<sub>Wk</sub> = γ<sub>W</sub>·S<sub>Wk</sub>（自重面外分量为0）<br>');
                    st.push('　　γ<sub>G</sub> = ' + fmt(gammaG, 1) + '，γ<sub>W</sub> = ' + fmt(gammaW, 1) + '，ψ<sub>W</sub> = ' + fmt(psiW, 1) + '<br>');
                }
                st.push('　　风荷载标准值：w<sub>k</sub> = ' + fmt(wk, 2) + ' kN/m² → 线荷载 q<sub>wk</sub> = w<sub>k</sub>·b = ' + fmt(qWind_k, 3) + ' kN/m → M<sub>wk</sub> = q·L²/8 = ' + fmt(Mwk, 2) + ' kN·m<br>');
                st.push('　　设计弯矩：M = γ<sub>W</sub>·M<sub>wk</sub> = ' + fmt(gammaW, 1) + '×' + fmt(Mwk, 2) + ' = ' + fmt(Md, 2) + ' kN·m；γ<sub>0</sub>·M = ' + fmt(gamma0, 1) + '×' + fmt(M, 2) + ' = <b>' + fmt(gamma0 * M, 2) + ' kN·m</b></div>');
                var Mu, capOk, x, xMax, overRein, rhoMax;
                if (isCECS) {
                    /* CECS 553-2018 5.2.5: 对称配筋正截面受弯承载力 */
                    /* M ≤ 0.75·fy·As·(h0 - 2a_s')，其中 a_s' = a_s（对称配筋） */
                    var lever = h0 - 2 * asV; /* h0 - 2a_s' = (h - a_s) - 2a_s = h - 3a_s */
                    if (lever <= 0) return err('有效内力臂 h₀ − 2a_s\' ≤ 0，请检查 a_s 取值。');
                    Mu = 0.75 * fy * As * lever / 1e6;
                    capOk = gamma0 * M <= Mu;
                    rhoMax = 2.0; /* CECS 无显式最大配筋率限制，取构造上限 */
                    st.push('<div class="step"><b>⑤ 正截面受弯承载力（' + stdName + ' 5.2.5，对称配筋）</b>　配筋墙板应采用对称配筋，正截面承载力按下式计算：<br>');
                    st.push('　　内力臂 z = h<sub>0</sub> − 2a<sub>s</sub>\' = ' + fmt(h0, 0) + ' − 2×' + fmt(asV, 0) + ' = ' + fmt(lever, 0) + ' mm（对称配筋 a<sub>s</sub>\' = a<sub>s</sub>）。<br>');
                    st.push('　　M<sub>u</sub> = 0.75·f<sub>y</sub>·A<sub>s</sub>·z = 0.75×' + fmt(fy, 0) + '×' + fmt(As, 1) + '×' + fmt(lever, 0) + '/10⁶ = <b>' + fmt(Mu, 2) + ' kN·m</b>。<br>');
                    st.push('　　γ<sub>0</sub>·M = ' + fmt(gamma0 * M, 2) + ' ' + (capOk ? '≤' : '&gt;') + ' M<sub>u</sub> = ' + fmt(Mu, 2) + ' ⇒ ' + (capOk ? '满足' : '不满足，需增加配筋或加大截面') + '</div>');
                } else {
                    /* JGJ/T 17-2020 5.4.1: 受压区高度计算 */
                    x = fy * As / (fc * b);
                    xMax = 0.5 * h0;
                    overRein = x > xMax;
                    var xUse = overRein ? xMax : x;
                    Mu = 0.75 * fc * b * xUse * (h0 - xUse / 2) / 1e6;
                    rhoMax = 0.5 * fc / fy * 100;
                    capOk = gamma0 * M <= Mu;
                    st.push('<div class="step"><b>⑤ 正截面受弯承载力（JGJ/T 17-2020 5.4.1）</b>　受压区高度 x = f<sub>y</sub>·A<sub>s</sub>/(f<sub>c</sub>·b) = ' + fmt(fy, 0) + '×' + fmt(As, 1) + '/(' + fmt(fc, 2) + '×' + fmt(b, 0) + ') = <b>' + fmt(x, 1) + ' mm</b>。限值 x ≤ 0.5h<sub>0</sub> = ' + fmt(xMax, 1) + ' mm' + (overRein ? '（超筋，按界限取值）' : '（适筋）') + '。最大配筋率 ρ<sub>max</sub> = 0.5·f<sub>c</sub>/f<sub>y</sub> = <b>' + fmt(rhoMax, 2) + '%</b>。<br>　　M<sub>u</sub> = 0.75·f<sub>c</sub>·b·x·(h<sub>0</sub>−x/2) = <b>' + fmt(Mu, 2) + ' kN·m</b>。γ<sub>0</sub>·M = ' + fmt(gamma0 * M, 2) + ' ' + (capOk ? '≤' : '&gt;') + ' M<sub>u</sub> = ' + fmt(Mu, 2) + ' ⇒ ' + (capOk ? '满足' : '不满足') + '</div>');
                }
                /* 受剪验算 */
                var Vmax = qWind_d * L / 2;
                var tau, tauOk, shearRef;
                if (isCECS) {
                    /* CECS 553-2018 5.2.6: V ≤ 0.45·ft·b·h0 */
                    var Vu = 0.45 * ft * b * h0 / 1000;
                    tau = Vmax * 1000 / (b * h0);
                    tauOk = Vmax <= Vu;
                    shearRef = stdName + ' 5.2.6';
                    st.push('<div class="step"><b>⑥ 受剪验算（' + shearRef + '）</b>　最大剪力 V = γ<sub>W</sub>·q<sub>wk</sub>·L/2 = <b>' + fmt(Vmax, 2) + ' kN</b>（风荷载控制，自重面内不计）。<br>　　V<sub>u</sub> = 0.45·f<sub>t</sub>·b·h<sub>0</sub> = 0.45×' + fmt(ft, 2) + '×' + fmt(b, 0) + '×' + fmt(h0, 0) + '/10³ = <b>' + fmt(Vu, 2) + ' kN</b>。<br>　　V = ' + fmt(Vmax, 2) + ' ' + (tauOk ? '≤' : '&gt;') + ' V<sub>u</sub> = ' + fmt(Vu, 2) + ' ⇒ ' + (tauOk ? '满足' : '不满足') + '</div>');
                } else {
                    /* JGJ/T 17-2020 5.4.2: V ≤ 0.45·ft·b·h0 */
                    var Vu = 0.45 * ft * b * h0 / 1000;
                    tau = Vmax * 1000 / (b * h0);
                    tauOk = Vmax <= Vu;
                    shearRef = 'JGJ/T 17-2020 5.4.2';
                    st.push('<div class="step"><b>⑥ 受剪验算（' + shearRef + '）</b>　最大剪力 V = q·L/2 = <b>' + fmt(Vmax, 2) + ' kN</b>（风荷载控制，自重面内不计）。<br>　　V<sub>u</sub> = 0.45·f<sub>t</sub>·b·h<sub>0</sub> = 0.45×' + fmt(ft, 2) + '×' + fmt(b, 0) + '×' + fmt(h0, 0) + '/10³ = <b>' + fmt(Vu, 2) + ' kN</b>。<br>　　V = ' + fmt(Vmax, 2) + ' ' + (tauOk ? '≤' : '&gt;') + ' V<sub>u</sub> = ' + fmt(Vu, 2) + ' ⇒ ' + (tauOk ? '满足' : '不满足') + '</div>');
                }
                /* 地震作用验算 */
                var FEk = 0, Fe = 0, seisOk = true, Mseis = 0, Mcomb = 0;
                if (seisOn) {
                    /* 地震作用验算按 T/CECS 553-2018 5.2.3-5.2.4 计算
                       （JGJ/T 17-2020 无墙板平面外地震作用专门计算条文，参照 T/CECS 553-2018 计算） */
                    var seisRef = isCECS ? stdName + ' 5.2.3-5.2.4' : '参照 T/CECS 553-2018 5.2.3-5.2.4';
                    /* CECS 553-2018 5.2.3: F_Ehk = γ·η·α_max·ζ·ξ·G */
                    /* γ: 非结构构件功能系数（η字段输入），η: 非结构构件类别系数（墙板取0.9） */
                    var etaCat = 0.9; /* 非结构构件类别系数，对墙板取0.9 */
                    var gammaFun = etaFun; /* 非结构构件功能系数（用户输入的η字段，丙类1.0，乙类1.4） */
                    var zeta = 1.2; /* 状态系数，柔性连接自承重墙板取 1.2 */
                    var Gk = qgk * L; /* 墙板重力荷载标准值 (kN) */
                    FEk = gammaFun * etaCat * amax * zeta * xiPos * Gk;
                    /* 5.2.4: Fe = γE·FEk, γE=1.3 */
                    var gammaE = 1.3;
                    Fe = gammaE * FEk;
                    /* 平面外地震弯矩：水平地震作用施加于重心处，等效为均布荷载的弯矩
                       M_E = F_E · L / 4（集中力在跨中）或等效均布
                       按规范5.2.3施加于重心处，简化为跨中集中力产生的弯矩 M = F·L/4 */
                    Mseis = Fe * L / 4;
                    /* 地震设计状况组合弯矩（式5.2.1-2）：
                       S_Eh = γ_G·S_Gk + γ_Eh·S_Ehk + ψ_W·γ_W·S_Wk
                       自重面外S_Gk = 0，S_Wk为风荷载标准组合（取较大者）*/
                    var psiW_seis = 0.2;
                    Mcomb = gammaG * 0 + gammaE * (FEk * L / 4) + gammaW * psiW_seis * Mwk;
                    /* 更准确地：Mcomb = γE·M_E + ψ_W·γ_W·M_wk，其中 M_E = FEk·L/4 */
                    var M_Ek = FEk * L / 4;  /* 地震作用标准弯矩 */
                    Mcomb = gammaG * 0 + gammaE * M_Ek + gammaW * psiW_seis * Mwk;
                    seisOk = Mcomb <= Mu;
                    st.push('<div class="step"><b>' + stepNo() + ' 地震作用验算（' + seisRef + '）</b>　G<sub>k</sub> = q<sub>gk</sub>·L = ' + fmt(qgk, 3) + '×' + fmt(L, 2) + ' = ' + fmt(Gk, 2) + ' kN。<br>');
                    st.push('　　F<sub>Ehk</sub> = γ·η·α<sub>max</sub>·ζ·ξ·G<sub>k</sub><br>');
                    st.push('　　γ = ' + fmt(gammaFun, 1) + '（功能系数，丙类1.0 / 乙类1.4）；η = ' + fmt(etaCat, 1) + '（类别系数，墙板取0.9）；α<sub>max</sub> = ' + fmt(amax, 2) + '；ζ = ' + fmt(zeta, 1) + '（状态系数）；ξ = ' + fmt(xiPos, 1) + '（位置系数）<br>');
                    st.push('　　F<sub>Ehk</sub> = ' + fmt(gammaFun, 1) + '×' + fmt(etaCat, 1) + '×' + fmt(amax, 2) + '×' + fmt(zeta, 1) + '×' + fmt(xiPos, 1) + '×' + fmt(Gk, 2) + ' = <b>' + fmt(FEk, 2) + ' kN</b>。<br>');
                    st.push('　　F<sub>Eh</sub> = γ<sub>E</sub>·F<sub>Ehk</sub> = 1.3×' + fmt(FEk, 2) + ' = <b>' + fmt(Fe, 2) + ' kN</b>（γ<sub>E</sub>=1.3）。<br>');
                    st.push('　　地震设计状况组合（式5.2.1-2）：S = γ<sub>E</sub>·M<sub>Ek</sub> + ψ<sub>W</sub>·γ<sub>W</sub>·M<sub>Wk</sub>（自重面外分量为0）<br>');
                    st.push('　　M<sub>Ek</sub> = F<sub>Ehk</sub>·L/4 = ' + fmt(FEk, 2) + '×' + fmt(L, 2) + '/4 = ' + fmt(M_Ek, 2) + ' kN·m<br>');
                    st.push('　　M = 1.3×' + fmt(M_Ek, 2) + ' + ' + fmt(psiW_seis, 1) + '×' + fmt(gammaW, 1) + '×' + fmt(Mwk, 2) + ' = ' + fmt(gammaE * M_Ek, 2) + ' + ' + fmt(gammaW * psiW_seis * Mwk, 2) + ' = <b>' + fmt(Mcomb, 2) + ' kN·m</b>。<br>');
                    st.push('　　M<sub>u</sub> = ' + fmt(Mu, 2) + ' kN·m ⇒ ' + (seisOk ? '满足' : '不满足') + '</div>');
                }
                /* 抗裂验算（JGJ/T 17-2020 5.4.3 / CECS 553-2018 5.3.3） */
                var crackOk = true, sigmaCk = 0;
                var crack1Ok = true, crack2Ok = true, sigmaP = 0;
                var W = b * h * h / 6;
                var Mk_crack = Mwk_ctrl;  /* 风荷载标准组合弯矩（自重沿面内，面外仅风荷载标准值） */
                sigmaCk = Mk_crack * 1e6 / W;
                crack1Ok = sigmaCk <= ftk;  /* σ_ck ≤ f_tk（劈拉强度标准值） */
                if (isCECS) {
                    /* CECS 553-2018 5.3.3：σ_ck ≤ f'_tk 且 σ_ck ≤ σ_p（钢筋自应力） */
                    var sigmaPTable = { 'HPB300': 83, 'HRB400': 79, 'CRB600H': 75 };
                    sigmaP = sigmaPTable[rebGrade] || 75;
                    crack2Ok = sigmaCk <= sigmaP;
                    crackOk = crack1Ok && crack2Ok;
                    st.push('<div class="step"><b>' + stepNo() + ' 抗裂验算（' + stdName + ' 5.3.3）</b>　风荷载标准组合弯矩 M<sub>k</sub> = ' + fmt(Mk_crack, 2) + ' kN·m（仅风荷载标准值，自重沿面内）。<br>');
                    st.push('　　W = b·h²/6 = ' + fmt(W, 0) + ' mm³；σ<sub>ck</sub> = M<sub>k</sub>/W = ' + fmt(Mk_crack, 2) + '×10⁶/' + fmt(W, 0) + ' = <b>' + fmt(sigmaCk, 2) + ' N/mm²</b>。<br>');
                    st.push('　　① σ<sub>ck</sub> ≤ f\'<sub>tk</sub> = ' + fmt(ftk, 2) + ' N/mm² ⇒ ' + (crack1Ok ? '满足' : '不满足') + '（劈拉强度标准值控制）<br>');
                    st.push('　　② σ<sub>ck</sub> ≤ σ<sub>p</sub> = ' + fmt(sigmaP, 0) + ' N/mm² ⇒ ' + (crack2Ok ? '满足' : '不满足') + '（钢筋自应力控制，' + rebGrade + '）</div>');
                } else {
                    /* JGJ/T 17-2020 5.4.3：截面边缘拉应力 ≤ 劈拉强度标准值 */
                    crackOk = crack1Ok;
                    st.push('<div class="step"><b>' + stepNo() + ' 抗裂验算（JGJ/T 17-2020 5.4.3）</b>　按荷载效应标准组合计算，构件截面边缘的拉应力不应大于蒸压加气混凝土劈拉强度标准值。<br>');
                    st.push('　　W = b·h²/6 = ' + fmt(W, 0) + ' mm³；M<sub>k</sub> = ' + fmt(Mk_crack, 2) + ' kN·m（仅风荷载标准值，自重沿面内）<br>');
                    st.push('　　σ<sub>ck</sub> = M<sub>k</sub>/W = ' + fmt(Mk_crack, 2) + '×10⁶/' + fmt(W, 0) + ' = <b>' + fmt(sigmaCk, 2) + ' N/mm²</b> ≤ f<sub>tk</sub> = ' + fmt(ftk, 2) + ' N/mm² ⇒ ' + (crack1Ok ? '满足' : '不满足') + '</div>');
                }
                /* 挠度验算（JGJ/T 17-2020 5.4.4/5.4.5） */
                /* 短期刚度 B_s = 0.85·E_c·I₀；I₀ 为换算截面惯性矩（考虑钢筋贡献） */
                var alphaE = Es / Ec;                    /* 钢筋弹性模量比 */
                var I0 = b * h * h * h / 12 + (alphaE - 1) * As * (h / 2 - asV) * (h / 2 - asV);
                var Bs = 0.85 * Ec * I0;                 /* 短期刚度 N·mm² */
                var theta = 2.0;                         /* 长期作用影响系数，取2.0（5.4.5-2） */
                var Ml = 0;                              /* 准永久组合弯矩：风荷载为短时荷载，准永久值取0 */
                var B = Mk_crack * 1e6 / (Ml * 1e6 * (theta - 1) + Mk_crack * 1e6) * Bs;
                var qk = wk * 0.001 * b;                 /* 标准线荷载 N/mm */
                var Lmm = L * 1000;
                var defl = 5 * qk * Math.pow(Lmm, 4) / (384 * B);
                var deflLim = Lmm / 200;                 /* 5.4.4：≤ l₀/200 */
                var deflOk = defl <= deflLim;
                st.push('<div class="step"><b>' + stepNo() + ' 挠度验算（JGJ/T 17-2020 5.4.4/5.4.5）</b>　按荷载效应标准组合并考虑荷载长期作用影响，计算值不应超过 l<sub>0</sub>/200。<br>');
                st.push('　　换算截面惯性矩 I<sub>0</sub> = b·h³/12 + (α<sub>E</sub>−1)·A<sub>s</sub>·(h/2−a<sub>s</sub>)² = ' + fmt(b, 0) + '×' + fmt(h, 0) + '³/12 + (' + fmt(alphaE, 0) + '−1)×' + fmt(As, 1) + '×' + fmt(h / 2 - asV, 1) + '² = <b>' + fmt(I0, 0) + ' mm⁴</b>（α<sub>E</sub> = E<sub>s</sub>/E<sub>c</sub> = ' + fmt(Es, 0) + '/' + fmt(Ec, 0) + ' = ' + fmt(alphaE, 1) + '）<br>');
                st.push('　　短期刚度 B<sub>s</sub> = 0.85·E<sub>c</sub>·I<sub>0</sub> = 0.85×' + fmt(Ec, 0) + '×' + fmt(I0, 0) + ' = <b>' + fmt(Bs, 0) + ' N·mm²</b>。<br>');
                st.push('　　长期刚度 B = M<sub>k</sub>/(M<sub>l</sub>(θ−1)+M<sub>k</sub>)·B<sub>s</sub>，θ = ' + fmt(theta, 1) + '；风荷载无准永久组合（M<sub>l</sub> = 0）⇒ B = B<sub>s</sub> = <b>' + fmt(B, 0) + ' N·mm²</b>。<br>');
                st.push('　　标准线荷载 q<sub>k</sub> = w<sub>k</sub>·b = ' + fmt(qk, 3) + ' N/mm；挠度 f = 5·q·L⁴/(384·B) = <b>' + fmt(defl, 1) + ' mm</b>，限值 l<sub>0</sub>/200 = ' + fmt(Lmm, 0) + '/200 = ' + fmt(deflLim, 1) + ' mm ⇒ ' + (deflOk ? '满足' : '不满足') + '</div>');
                /* 连接节点支座反力复核（19CJ85-1 B1 结构说明） */
                if (!(nj > 0)) return err('连接件数量 n<sub>j</sub> 必须为正整数。');
                var Apanel = qWind_k * L;  /* 风荷载总力标准值 kN */
                /* 风荷载工况支座反力（面外） */
                var Nw_total = gamma0j * gammaW * Apanel;
                var Nwj = Nw_total / nj;
                /* 地震作用工况支座反力（面外） */
                var Ve_total = seisOn ? (gamma0j * 1.3 * FEk) : 0;
                var Vsj = Ve_total / nj;
                /* 19CJ85-1 B1：节点承载力设计值 ≥ 2倍风荷载设计值 */
                var Rd_node = 2 * Nwj;
                var nodeSeisOk = seisOn ? (Vsj <= Rd_node) : true;
                var nodeOk = nodeSeisOk;
                st.push('<div class="step"><b>' + stepNo() + ' 连接节点支座反力复核（19CJ85-1 B1 结构说明）</b>　每块板连接件 n<sub>j</sub> = ' + fmt(nj, 0) + ' 个，连接件重要性系数 γ<sub>0j</sub> = ' + fmt(gamma0j, 2) + '（安全等级提高一级，19CJ85-1 第6.6条）。<br>');
                st.push('　　每块板受风面积 A = L×b = ' + fmt(L, 2) + '×' + fmt(b / 1000, 2) + ' = ' + fmt(L * b / 1000, 3) + ' m²；风荷载总力标准值 W<sub>k</sub> = w<sub>k</sub>×A = ' + fmt(wk, 3) + '×' + fmt(L * b / 1000, 3) + ' = <b>' + fmt(Apanel, 2) + ' kN</b>。<br>');
                st.push('　　<b>风荷载工况</b>：支座反力设计值 N<sub>w</sub> = γ<sub>0j</sub>·γ<sub>W</sub>·W<sub>k</sub> = ' + fmt(gamma0j, 2) + '×' + fmt(gammaW, 1) + '×' + fmt(Apanel, 2) + ' = ' + fmt(Nw_total, 2) + ' kN → 单个连接件 N<sub>wj</sub> = N<sub>w</sub>/n<sub>j</sub> = <b>' + fmt(Nwj, 2) + ' kN</b>。<br>');
                if (seisOn) {
                    st.push('　　<b>地震作用工况</b>：支座反力设计值 V<sub>e</sub> = γ<sub>0j</sub>·γ<sub>E</sub>·F<sub>Ehk</sub> = ' + fmt(gamma0j, 2) + '×1.3×' + fmt(FEk, 2) + ' = ' + fmt(Ve_total, 2) + ' kN → 单个连接件 V<sub>sj</sub> = <b>' + fmt(Vsj, 2) + ' kN</b>。<br>');
                } else {
                    st.push('　　（未验算地震作用，地震工况不计）<br>');
                }
                st.push('　　19CJ85-1 B1要求：节点承载力设计值 R<sub>d</sub> ≥ 2×N<sub>wj</sub> = 2×' + fmt(Nwj, 2) + ' = <b>' + fmt(Rd_node, 2) + ' kN</b>。<br>');
                if (seisOn) {
                    st.push('　　地震工况复核：V<sub>sj</sub> = ' + fmt(Vsj, 2) + ' kN ' + (nodeSeisOk ? '≤' : '&gt;') + ' R<sub>d</sub> = ' + fmt(Rd_node, 2) + ' kN ⇒ ' + (nodeSeisOk ? '满足（风荷载控制节点设计）' : '不满足（地震作用控制，需按地震工况设计节点承载力）') + '<br>');
                }
                st.push('　　<b>结论</b>：' + (nodeOk ? '连接节点支座反力满足 19CJ85-1 B1 要求' + (seisOn ? '，节点承载力按2倍风荷载设计值控制' : '') + '。' : '地震工况支座反力超过2倍风荷载设计值，需按地震作用控制节点设计，增加连接件数量或提高节点承载力。') + '</div>');
                /* 构造要求 */
                if (isCECS) {
                    var minThkOk = h >= 150;
                    var spanOk = L * 1000 <= 35 * h;
                    var minBarsOk = n >= 3;
                    st.push('<div class="step"><b>' + stepNo() + ' 构造要求（' + stdName + ' 5.4）</b>　①外墙板最小厚度 ≥ 150mm（5.4.4）：h=' + fmt(h, 0) + 'mm ' + (minThkOk ? '✓' : '✗') + '；②两支点间距 ≤ 35h（5.4.5）：L/h = ' + fmt(L * 1000 / h, 1) + ' ' + (spanOk ? '✓' : '✗') + '；③焊接网双排配筋，纵筋≥3根（5.4.2）：n=' + fmt(n, 0) + '根 ' + (minBarsOk ? '✓' : '✗') + '；④横向间距 ≤ 1000mm（5.4.2）；⑤纵筋直径 ≥ 5mm（3.2.10）：d=' + fmt(d, 0) + 'mm ✓；⑥连接件防腐处理（5.4.3）；⑦柔性连接（5.4.8）；⑧层间变位角 ≥ 1/200（5.1.2）。</div>');
                } else {
                    st.push('<div class="step"><b>' + stepNo() + ' 构造要求</b>　外墙板强度等级应≥A5.0；钢筋宜采用 CRB600H（d=5~10mm）；防锈钢筋与 AAC 间粘结强度≥1.0MPa；板拼缝封堵材料应符合 GB 23864 和 GB/T 24267；金属连接件防腐等级应高于被连接构件。</div>');
                }
                window._AW_RESULT = {
                    std: std, stdName: stdName, isCECS: isCECS,
                    grade: grade, rebGrade: rebGrade, L: L, b: b, h: h, h0: h0, asV: asV,
                    fc: fc, ftk: ftk, ft: ft, Ec: Ec, rho0: rho0, fy: fy, Es: Es,
                    d: d, n: n, As: As, rho: As / (b * h0) * 100, rhoMax: rhoMax,
                    rhoSelf: rhoSelf, qgk: qgk, qg: qg, qWind_k: qWind_k, qWind_d: qWind_d,
                    w0: w0, terrain: terrain, zH: zH, mus: mus, muz: muz, bgz: bgz,
                    wk: wk, gamma0: gamma0, gammaG: gammaG, gammaW: gammaW, psiW: psiW,
                    Mwk: Mwk, Md: Md, M: M, Mwk_ctrl: Mwk_ctrl,
                    x: x || 0, xMax: xMax || 0, overRein: overRein || false, Mu: Mu, capOk: capOk,
                    Vmax: Vmax, tau: tau, tauOk: tauOk,
                    seisOn: seisOn, FEk: FEk, Fe: Fe, Mseis: Mseis, seisOk: seisOk, Mcomb: Mcomb,
                    sigmaCk: sigmaCk, crackOk: crackOk,
                    crack1Ok: crack1Ok, crack2Ok: crack2Ok, sigmaP: sigmaP,
                    I0: I0, Bs: Bs, B: B, defl: defl, deflLim: deflLim, deflOk: deflOk,
                    nj: nj, gamma0j: gamma0j, Apanel: Apanel,
                    Nw_total: Nw_total, Nwj: Nwj,
                    Ve_total: Ve_total, Vsj: Vsj, Rd_node: Rd_node, nodeOk: nodeOk,
                    steps: st.join('')
                };
                var html = '';
                html += resultRow('设计标准', stdName);
                html += resultRow('材料 f<sub>c</sub> / f\'<sub>tk</sub> / f<sub>t</sub>', fmt(fc, 2) + ' / ' + fmt(ftk, 2) + ' / ' + fmt(ft, 2) + ' N/mm²');
                html += resultRow('有效截面 b×h<sub>0</sub>', fmt(b, 0) + '×' + fmt(h0, 0) + ' mm');
                html += resultRow('配筋 A<sub>s</sub> / ρ', fmt(As, 1) + ' mm² / ' + fmt(As / (b * h0) * 100, 3) + '%');
                if (!isCECS) html += resultRow('最大配筋率 ρ<sub>max</sub>', fmt(rhoMax, 2) + '%');
                html += resultRow('自重线荷载 q<sub>gk</sub>', fmt(qgk, 3) + ' kN/m');
                html += resultRow('设计弯矩 γ<sub>0</sub>·M', '<span class="highlight">' + fmt(gamma0 * M, 2) + ' kN·m</span>');
                if (!isCECS) html += resultRow('受压区高度 x', fmt(x, 1) + ' mm ' + (overRein ? tag('err', '超筋') : tag('ok', '适筋')));
                html += resultRow('受弯承载力 M<sub>u</sub>', fmt(Mu, 2) + ' kN·m ' + (capOk ? tag('ok', '满足') : tag('err', '不满足')));
                html += resultRow('受剪 V ≤ 0.45·f<sub>t</sub>·b·h<sub>0</sub>', fmt(Vmax, 2) + ' ≤ ' + fmt(0.45 * ft * b * h0 / 1000, 2) + ' kN ' + (tauOk ? tag('ok', '满足') : tag('err', '不满足')));
                if (seisOn) {
                    html += resultRow('地震组合弯矩', fmt(Mcomb, 2) + ' kN·m ' + (seisOk ? tag('ok', '满足') : tag('err', '不满足')));
                }
                html += resultRow('抗裂 σ<sub>ck</sub> ≤ f<sub>tk</sub>', fmt(sigmaCk, 2) + ' ≤ ' + fmt(ftk, 2) + ' N/mm² ' + (crack1Ok ? tag('ok', '满足') : tag('err', '不满足')));
                if (isCECS) {
                    html += resultRow('抗裂 σ<sub>ck</sub> ≤ σ<sub>p</sub>', fmt(sigmaCk, 2) + ' ≤ ' + fmt(sigmaP, 0) + ' N/mm² ' + (crack2Ok ? tag('ok', '满足') : tag('err', '不满足')));
                }
                html += resultRow('挠度 f ≤ l<sub>0</sub>/200', fmt(defl, 1) + ' ≤ ' + fmt(deflLim, 1) + ' mm ' + (deflOk ? tag('ok', '满足') : tag('err', '不满足')));
                html += resultRow('节点风荷载 N<sub>wj</sub>', fmt(Nwj, 2) + ' kN');
                if (seisOn) {
                    html += resultRow('节点地震 V<sub>sj</sub> ≤ 2×N<sub>wj</sub>', fmt(Vsj, 2) + ' ≤ ' + fmt(Rd_node, 2) + ' kN ' + (nodeOk ? tag('ok', '满足') : tag('err', '不满足')));
                }
                var allOk = capOk && tauOk && nodeOk && crackOk && deflOk && (!seisOn || seisOk);
                html += resultRow('综合判定', allOk ? badge('badge-ok', '满足：承载力 / 受剪 / 抗裂 / 挠度 / 连接节点' + (seisOn ? ' / 地震' : '') + ' 均满足') : badge('badge-err', '存在不满足项，请调整截面、配筋、连接件或板厚'));
                out.innerHTML = html; proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                ['aw_L','aw_b','aw_h','aw_d','aw_n','aw_as','aw_w0','aw_z','aw_mus','aw_gamm0','aw_gammaG','aw_gammaW','aw_psiW','aw_kd','aw_kl','aw_a','aw_amax','aw_eta','aw_xi','aw_nj','aw_gamma0j'].forEach(function (id) {
                    document.getElementById(id).value = { aw_L:3.0, aw_b:600, aw_h:200, aw_d:8, aw_n:4, aw_as:35, aw_w0:0.45, aw_z:10.0, aw_mus:1.2, aw_gamm0:1.0, aw_gammaG:1.3, aw_gammaW:1.5, aw_psiW:0.6, aw_kd:1.2, aw_kl:1.5, aw_a:0.6, aw_amax:0.08, aw_eta:1.0, aw_xi:1.5, aw_nj:4, aw_gamma0j:1.1 }[id];
                });
                document.getElementById('aw_std').value = 'jgj';
                document.getElementById('aw_terrain').value = 'B';
                document.getElementById('aw_grade').value = 'A5.0';
                document.getElementById('aw_reb').value = 'CRB600H';
                document.getElementById('aw_seis').value = 'n';
                document.getElementById('aw_lift').value = 'y';
                calc();
            }
            document.getElementById('aw_calc').addEventListener('click', calc);
            document.getElementById('aw_reset').addEventListener('click', reset);
            document.getElementById('f-aw').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            document.getElementById('f-aw2').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            document.getElementById('f-aw2b').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            document.getElementById('f-aw3').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            document.getElementById('aw_std').addEventListener('change', function () {
                var std = this.value;
                /* 切换标准时自动调整荷载分项系数 */
                if (std === 'cecs') {
                    document.getElementById('aw_gammaG').value = 1.3;
                    document.getElementById('aw_gammaW').value = 1.5;
                    var g = document.getElementById('aw_grade').value;
                    if (g === 'A2.5' || g === 'A7.5') document.getElementById('aw_grade').value = 'A5.0';
                } else {
                    document.getElementById('aw_gammaG').value = 1.2;
                    document.getElementById('aw_gammaW').value = 1.4;
                }
                calc();
            });
            document.getElementById('aw_grade').addEventListener('change', calc);
            document.getElementById('aw_reb').addEventListener('change', calc);
            document.getElementById('aw_d').addEventListener('change', calc);
            document.getElementById('aw_n').addEventListener('change', calc);
            /* 风荷载参数实时联动：w0/terrain/z/mus变化时自动重算wk并刷新结果 */
            ['aw_w0','aw_z','aw_mus'].forEach(function (id) {
                document.getElementById(id).addEventListener('input', calc);
                document.getElementById(id).addEventListener('change', calc);
            });
            document.getElementById('aw_terrain').addEventListener('change', calc);
            document.getElementById('aw_seis').addEventListener('change', function () { calc(); });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['aac-wall'] = tool;
})();
