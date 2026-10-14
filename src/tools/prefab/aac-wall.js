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
        rebar: {
            'HPB300': { fy: 270, Es: 210000 },
            'CRB600H': { fy: 430, Es: 200000 },
            'HRB400': { fy: 360, Es: 200000 }
        }
    };
    var tool = {
        title: '蒸压加气混凝土外墙板',
        sub: '配筋 AAC 外墙板正截面受弯、受剪、抗裂、挠度与连接节点复核 · JGJ/T 17-2020 / 19CJ85 B1',
        meta: {"standard": "JGJ/T 17-2020；抗震补充计算采用 T/CECS 553-2018 5.2.3～5.2.4", "formulaSource": "—", "limitations": "竖向外墙板，风荷载面外受弯/受剪/抗裂/挠度/地震/节点", "unit": "M:kN·m/m, w:mm, σ:N/mm²", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">设计依据与板材参数</div>' +
                '<div class="hint">设计依据：<a href="https://gf.cabr-fire.com/m/article-64855.htm" target="_blank" rel="noopener">JGJ/T 17-2020 第3.2节（材料性能）</a>；<a href="https://gf.cabr-fire.com/m/article-64856.htm" target="_blank" rel="noopener">第3.3节（自重）</a>；<a href="https://gf.cabr-fire.com/m/article-64862.htm" target="_blank" rel="noopener">第5.1节（设计原则）</a>；<a href="https://gf.cabr-fire.com/m/article-64865.htm" target="_blank" rel="noopener">第5.4节（板材设计计算）</a>；GB 50009-2012《建筑结构荷载规范》；GB/T 50011-2010（2024年版）《建筑抗震设计规范》；19CJ85 B1《装配式建筑蒸压加气混凝土板围护系统》（连接节点）。</div>' +
                '<form id="f-aw"><div class="grid2">' +
                numField('aw_L', '板计算跨度 L', 'm', 3.0, '墙板水平方向支承跨度，通常等于层高或柱距') +
                numField('aw_b', '板宽 b', 'mm', 600, '标准板宽 600mm，可按实际取用') +
                numField('aw_h', '板厚 h', 'mm', 200, '外墙板常用 150/175/200/250/300mm') +
                selField('aw_grade', 'AAC 强度等级', opts([
                    { v: 'A2.5', t: 'A2.5（隔墙板）' },
                    { v: 'A3.5', t: 'A3.5（屋面板）' },
                    { v: 'A5.0', t: 'A5.0（外墙板 / 楼板）' },
                    { v: 'A7.5', t: 'A7.5（外墙板 / 楼板）' }
                ], 'A5.0'), '外墙板应≥A5.0') +
                selField('aw_reb', '钢筋级别', opts([
                    { v: 'HPB300', t: 'HPB300（fy=270）' },
                    { v: 'CRB600H', t: 'CRB600H（fy=430，推荐）' },
                    { v: 'HRB400', t: 'HRB400（fy=360）' }
                ], 'CRB600H'), 'JGJ/T 17-2020：宜采用 CRB600H 高延性冷轧带肋钢筋，纵筋直径≥5mm') +
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
                numField('aw_gammaG', '永久荷载分项系数 γ<sub>G</sub>', '—', 1.3, '取值应按项目适用荷载规范核定') +
                numField('aw_gammaW', '风荷载分项系数 γ<sub>W</sub>', '—', 1.5, '取值应按项目适用荷载规范核定') +
                numField('aw_psiW', '风荷载组合值系数 ψ<sub>W</sub>', '—', 0.6, '持久状况取 0.6，地震状况取 0.2') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">地震作用参数</div>' +
                '<div class="hint">JGJ/T 17-2020 第5.4.6条要求外墙板进行抗震承载力验算；本模块抗震作用补充采用 <a href="https://www.gongbiaoku.com/read/3ak19982kpm" target="_blank" rel="noopener">T/CECS 553-2018 第5.2.3～5.2.4条</a>。参数应按项目抗震设防条件核定。</div>' +
                '<form id="f-aw3"><div class="grid2">' +
                selField('aw_seis', '是否验算地震作用', opts([{ v: 'n', t: '不验算' }, { v: 'y', t: '验算' }], 'n'), '地震作用（T/CECS 553-2018 5.2.3～5.2.4）') +
                numField('aw_amax', '地震影响系数最大值 α<sub>max</sub>', '—', 0.08, '多遇地震，按 GB 50011 取值（6度=0.04, 7度=0.08, 8度=0.16）') +
                numField('aw_eta', '功能系数 η', '—', 1.0, '乙类取 1.4，丙类取 1.0') +
                numField('aw_xi', '位置系数 ξ', '—', 1.5, '顶点取 2.0，底部取 1.0，沿高度线性分布') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">连接节点参数（19CJ85 B1）</div>' +
                '<div class="hint">JGJ/T 17-2020 第5.4.7条要求连接件承载力设计安全等级提高一级；连接节点采用19CJ85 B1。此处仅计算作用需求，实际节点抗力及节点构造适用条件需另行核验。</div>' +
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
                var std = 'jgj';
                var isCECS = false;
                var stdName = 'JGJ/T 17-2020';
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
                var nj = Number(document.getElementById('aw_nj').value);
                var gamma0j = parseFloat(document.getElementById('aw_gamma0j').value);
                if (!(L > 0 && b > 0 && h > 0)) return err('尺寸参数必须为正数。');
                if (!(d > 0 && Number.isInteger(n) && n > 0)) return err('钢筋直径必须为正数，根数必须为正整数。');
                if (!(asV > 0 && asV < h)) return err('a<sub>s</sub> 应满足 0 < a<sub>s</sub> < h。');
                /* 根据标准选择材料库 */
                var gradeLib = AAC_DATA.jgj;
                if (!gradeLib[grade]) return err(stdName + ' 不含强度等级，请检查输入。');
                var g = gradeLib[grade];
                var rb = AAC_DATA.rebar[rebGrade];
                var fc = g.fc, ftk = g.ftk, ft = g.ft, Ec = g.Ec, rho0 = g.rho;
                var fy = rb.fy, Es = rb.Es;
                var As = Math.PI * d * d / 4 * n;
                var h0 = h - asV;
                if (h0 <= 0) return err('截面有效高度 h<sub>0</sub> = h − a<sub>s</sub> 必须大于 0。');
                /* JGJ/T 17-2020 配筋计算 */
                var AsPrime = 0;
                /* 自重：干密度×1.4（JGJ/T 17-2020 3.3.1） */
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
                var ftName = '劈拉强度'; /* JGJ/T 17-2020 表3.2.2-2 / 5.4.2：f_t 为劈拉强度设计值 */
                var ftkName = 'f<sub>tk</sub>';
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
                    /* JGJ/T 17-2020 5.2.5: 对称配筋正截面受弯承载力 */
                    /* M ≤ 0.75·fy·As·(h0 - 2a_s')，其中 a_s' = a_s（对称配筋） */
                    var lever = h0 - 2 * asV; /* h0 - 2a_s' = (h - a_s) - 2a_s = h - 3a_s */
                    if (lever <= 0) return err('有效内力臂 h₀ − 2a_s\' ≤ 0，请检查 a_s 取值。');
                    Mu = 0.75 * fy * As * lever / 1e6;
                    capOk = !overRein && gamma0 * M <= Mu;
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
                    /* JGJ/T 17-2020 5.2.6: V ≤ 0.45·ft·b·h0 */
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
                    /* 地震作用验算 */
                    var seisRef = 'T/CECS 553-2018 5.2.3～5.2.4';
                    /* JGJ/T 17-2020 5.2.3: F_Ehk = γ·η·α_max·ζ·ξ·G */
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
                    seisOk = !overRein && Number.isFinite(Mcomb) && Number.isFinite(Mu) && Mcomb <= Mu;
                    st.push('<div class="step"><b>' + stepNo() + ' 地震作用验算（' + seisRef + '）</b>　G<sub>k</sub> = q<sub>gk</sub>·L = ' + fmt(qgk, 3) + '×' + fmt(L, 2) + ' = ' + fmt(Gk, 2) + ' kN。<br>');
                    st.push('　　F<sub>Ehk</sub> = γ·η·α<sub>max</sub>·ζ·ξ·G<sub>k</sub><br>');
                    st.push('　　γ = ' + fmt(gammaFun, 1) + '（功能系数，丙类1.0 / 乙类1.4）；η = ' + fmt(etaCat, 1) + '（类别系数，墙板取0.9）；α<sub>max</sub> = ' + fmt(amax, 2) + '；ζ = ' + fmt(zeta, 1) + '（状态系数）；ξ = ' + fmt(xiPos, 1) + '（位置系数）<br>');
                    st.push('　　F<sub>Ehk</sub> = ' + fmt(gammaFun, 1) + '×' + fmt(etaCat, 1) + '×' + fmt(amax, 2) + '×' + fmt(zeta, 1) + '×' + fmt(xiPos, 1) + '×' + fmt(Gk, 2) + ' = <b>' + fmt(FEk, 2) + ' kN</b>。<br>');
                    st.push('　　F<sub>Eh</sub> = γ<sub>E</sub>·F<sub>Ehk</sub> = 1.3×' + fmt(FEk, 2) + ' = <b>' + fmt(Fe, 2) + ' kN</b>（γ<sub>E</sub>=1.3）。<br>');
                    st.push('　　地震设计状况组合（式5.2.1-2）：S = γ<sub>E</sub>·M<sub>Ek</sub> + ψ<sub>W</sub>·γ<sub>W</sub>·M<sub>Wk</sub>（自重面外分量为0）<br>');
                    st.push('　　M<sub>Ek</sub> = F<sub>Ehk</sub>·L/4 = ' + fmt(FEk, 2) + '×' + fmt(L, 2) + '/4 = ' + fmt(M_Ek, 2) + ' kN·m<br>');
                    st.push('　　M = 1.3×' + fmt(M_Ek, 2) + ' + ' + fmt(psiW_seis, 1) + '×' + fmt(gammaW, 1) + '×' + fmt(Mwk, 2) + ' = ' + fmt(gammaE * M_Ek, 2) + ' + ' + fmt(gammaW * psiW_seis * Mwk, 2) + ' = <b>' + fmt(Mcomb, 2) + ' kN·m</b>。<br>');
                    st.push('　　M<sub>u</sub> = ' + fmt(Mu, 2) + ' kN·m ⇒ ' + (seisOk ? '满足（现有模型数值比较，依据及项目参数待核验）' : '不满足（现有模型数值比较）') + '</div>');
                }
                /* 抗裂验算（JGJ/T 17-2020 5.4.3 / JGJ/T 17-2020 5.3.3） */
                var crackOk = true, sigmaCk = 0;
                var crack1Ok = true, crack2Ok = true, sigmaP = 0;
                var W = b * h * h / 6;
                var Mk_crack = Mwk_ctrl;  /* 风荷载标准组合弯矩（自重沿面内，面外仅风荷载标准值） */
                sigmaCk = Mk_crack * 1e6 / W;
                crack1Ok = sigmaCk <= ftk;  /* σ_ck ≤ f_tk（劈拉强度标准值） */
                if (isCECS) {
                    /* JGJ/T 17-2020 5.3.3：σ_ck ≤ f'_tk 且 σ_ck ≤ σ_p（钢筋自应力） */
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
                var B = Ml === 0 ? Bs : Mk_crack * 1e6 / (Ml * 1e6 * (theta - 1) + Mk_crack * 1e6) * Bs;
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
                /* 连接节点支座反力复核（19CJ85 B1 结构说明） */
                if (!(Number.isInteger(nj) && nj > 0)) return err('连接件数量 n<sub>j</sub> 必须为正整数。');
                var Apanel = qWind_k * L;  /* 风荷载总力标准值 kN */
                /* 风荷载工况支座反力（面外） */
                var Nw_total = gamma0j * gammaW * Apanel;
                var Nwj = Nw_total / nj;
                /* 地震作用工况支座反力（面外） */
                var Ve_total = seisOn ? (gamma0j * 1.3 * FEk) : 0;
                var Vsj = Ve_total / nj;
                /* 19CJ85 B1：节点承载力设计值与风、震控制作用比较 */
                /* 19CJ85-1 B1：节点面外承载力设计值（kN），不计板材竖向自重 */
                var b1SwingRd = h <= 150 ? 12 : h <= 200 ? 12 + (h-150)*3/50 : h <= 250 ? 15 + (h-200)*3/50 : h <= 300 ? 18 + (h-250)*2/50 : 20;
                var b1PipeRd = h <= 150 ? 5 : h <= 200 ? 5 + (h-150)*2/50 : h <= 250 ? 7 + (h-200)/50 : h <= 300 ? 8 + (h-250)*2/50 : 10;
                var b1PlateRd = h <= 150 ? 8 : h <= 200 ? 8 + (h-150)*2/50 : h <= 250 ? 10 + (h-200)*3/50 : h <= 300 ? 13 + (h-250)*3/50 : 16;
                                var b1SeisSwingOk = !seisOn || Vsj <= b1SwingRd, b1SeisPipeOk = !seisOn || Vsj <= b1PipeRd, b1SeisPlateOk = !seisOn || Vsj <= b1PlateRd;
                var Rd_node = 2 * Nwj;
                var nodeDemand = seisOn ? Math.max(Rd_node, Vsj) : Rd_node;
                var b1WindSwingOk = nodeDemand <= b1SwingRd, b1WindPipeOk = nodeDemand <= b1PipeRd, b1WindPlateOk = nodeDemand <= b1PlateRd;
                var b1NodeOk = b1WindSwingOk && b1WindPipeOk && b1WindPlateOk;
                var nodeSeisOk = seisOn ? (Vsj <= Rd_node) : true;
                var nodeOk = b1NodeOk;
                st.push('<div class="step"><b>' + stepNo() + ' 连接节点支座反力复核（19CJ85 B1 B1 结构说明）</b>　每块板连接件 n<sub>j</sub> = ' + fmt(nj, 0) + ' 个，连接件重要性系数 γ<sub>0j</sub> = ' + fmt(gamma0j, 2) + '（安全等级提高一级，JGJ/T 17-2020 第5.4.7条）。<br>');
                st.push('　　每块板受风面积 A = L×b = ' + fmt(L, 2) + '×' + fmt(b / 1000, 2) + ' = ' + fmt(L * b / 1000, 3) + ' m²；风荷载总力标准值 W<sub>k</sub> = w<sub>k</sub>×A = ' + fmt(wk, 3) + '×' + fmt(L * b / 1000, 3) + ' = <b>' + fmt(Apanel, 2) + ' kN</b>。<br>');
                st.push('　　<b>风荷载工况</b>：支座反力设计值 N<sub>w</sub> = γ<sub>0j</sub>·γ<sub>W</sub>·W<sub>k</sub> = ' + fmt(gamma0j, 2) + '×' + fmt(gammaW, 1) + '×' + fmt(Apanel, 2) + ' = ' + fmt(Nw_total, 2) + ' kN → 单个连接件 N<sub>wj</sub> = N<sub>w</sub>/n<sub>j</sub> = <b>' + fmt(Nwj, 2) + ' kN</b>。<br>');
                if (seisOn) {
                    st.push('　　<b>地震作用工况</b>：支座反力设计值 V<sub>e</sub> = γ<sub>0j</sub>·γ<sub>E</sub>·F<sub>Ehk</sub> = ' + fmt(gamma0j, 2) + '×1.3×' + fmt(FEk, 2) + ' = ' + fmt(Ve_total, 2) + ' kN → 单个连接件 V<sub>sj</sub> = <b>' + fmt(Vsj, 2) + ' kN</b>。<br>');
                } else {
                    st.push('　　（未验算地震作用，地震工况不计）<br>');
                }
                st.push('　　参考需求（图集适用条件待核验）：2×N<sub>wj</sub> = 2×' + fmt(Nwj, 2) + ' = <b>' + fmt(Rd_node, 2) + ' kN</b>。<br>');
                if (seisOn) {
                    st.push('　　参考作用比较（非节点抗力验算）：V<sub>sj</sub> = ' + fmt(Vsj, 2) + ' kN ' + (nodeSeisOk ? '≤' : '&gt;') + ' 两倍风荷载需求 = ' + fmt(Rd_node, 2) + ' kN ⇒ ' + (nodeSeisOk ? '参考地震作用未超过两倍风作用' : '参考地震作用超过两倍风作用') + '<br>');
                }
                st.push('　　板材竖向自重由托件或主体结构承担，本节点面外验算不计自重。19CJ85-1 B1表承载力：预埋件摇摆 ' + fmt(b1SwingRd, 2) + ' kN、钢管锚 ' + fmt(b1PipeRd, 2) + ' kN、平板螺栓 ' + fmt(b1PlateRd, 2) + ' kN。<br>　　<b>结论</b>：风荷载作用下三种节点分别' + (b1WindSwingOk ? '满足' : '不满足') + '、' + (b1WindPipeOk ? '满足' : '不满足') + '、' + (b1WindPlateOk ? '满足' : '不满足') + '；抗震开启时另按水平地震作用比较。两种工况取大值控制。</div>');
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
                    seisOn: seisOn, FEk: FEk, Fe: Fe, Mseis: Mseis, seisOk: seisOn ? seisOk : null, seismicReferenceOk: seisOk, Mcomb: Mcomb,
                    sigmaCk: sigmaCk, crackOk: crackOk,
                    crack1Ok: crack1Ok, crack2Ok: crack2Ok, sigmaP: sigmaP,
                    I0: I0, Bs: Bs, B: B, defl: defl, deflLim: deflLim, deflOk: deflOk,
                    nj: nj, gamma0j: gamma0j, Apanel: Apanel,
                    Nw_total: Nw_total, Nwj: Nwj,
                    Ve_total: Ve_total, Vsj: Vsj, Rd_node: Rd_node, nodeOk: nodeOk, reviewRequired: true,
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
                    html += resultRow('地震组合弯矩', fmt(Mcomb, 2) + ' kN·m ' + (seisOk ? tag('ok', '满足（现有模型数值比较）') : tag('err', '不满足（现有模型数值比较）')));
                }
                html += resultRow('抗裂 σ<sub>ck</sub> ≤ f<sub>tk</sub>', fmt(sigmaCk, 2) + ' ≤ ' + fmt(ftk, 2) + ' N/mm² ' + (crack1Ok ? tag('ok', '满足') : tag('err', '不满足')));
                if (isCECS) {
                    html += resultRow('抗裂 σ<sub>ck</sub> ≤ σ<sub>p</sub>', fmt(sigmaCk, 2) + ' ≤ ' + fmt(sigmaP, 0) + ' N/mm² ' + (crack2Ok ? tag('ok', '满足') : tag('err', '不满足')));
                }
                html += resultRow('挠度 f ≤ l<sub>0</sub>/200', fmt(defl, 1) + ' ≤ ' + fmt(deflLim, 1) + ' mm ' + (deflOk ? tag('ok', '满足') : tag('err', '不满足')));
                html += resultRow('节点风荷载 N<sub>wj</sub>', fmt(Nwj, 2) + ' kN');
                if (seisOn) {
                    html += resultRow('19CJ85-1 B1节点（不计竖向自重）', '预埋件摇摆 ' + fmt(b1SwingRd, 2) + ' kN：' + (b1WindSwingOk ? '满足' : '不满足') + '；钢管锚 ' + fmt(b1PipeRd, 2) + ' kN：' + (b1WindPipeOk ? '满足' : '不满足') + '；平板螺栓 ' + fmt(b1PlateRd, 2) + ' kN：' + (b1WindPlateOk ? '满足' : '不满足'));
                }
                var knownFailure = !capOk || !tauOk || !crackOk || !deflOk || !b1NodeOk || (seisOn && !seisOk);
                                html += resultRow('节点控制作用', fmt(nodeDemand, 2) + ' kN/个（风荷载需求与水平地震作用取大值）');
                html += resultRow('综合判定', knownFailure ? badge('badge-err', '存在不满足项；其余项目待核验，不能判定整体满足') : badge('badge-warn', '已计算项目均满足；未纳入本模块的项目待核验'));
                out.innerHTML = html; proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                ['aw_L','aw_b','aw_h','aw_d','aw_n','aw_as','aw_w0','aw_z','aw_mus','aw_gamm0','aw_gammaG','aw_gammaW','aw_psiW','aw_amax','aw_eta','aw_xi','aw_nj','aw_gamma0j'].forEach(function (id) {
                    document.getElementById(id).value = { aw_L:3.0, aw_b:600, aw_h:200, aw_d:8, aw_n:4, aw_as:35, aw_w0:0.45, aw_z:10.0, aw_mus:1.2, aw_gamm0:1.0, aw_gammaG:1.3, aw_gammaW:1.5, aw_psiW:0.6, aw_amax:0.08, aw_eta:1.0, aw_xi:1.5, aw_nj:4, aw_gamma0j:1.1 }[id];
                });
                document.getElementById('aw_terrain').value = 'B';
                document.getElementById('aw_grade').value = 'A5.0';
                document.getElementById('aw_reb').value = 'CRB600H';
                document.getElementById('aw_seis').value = 'n';
                
                calc();
            }
            document.getElementById('aw_calc').addEventListener('click', calc);
            document.getElementById('aw_reset').addEventListener('click', reset);
            document.getElementById('f-aw').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            document.getElementById('f-aw2').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            document.getElementById('f-aw2b').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            document.getElementById('f-aw3').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
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

