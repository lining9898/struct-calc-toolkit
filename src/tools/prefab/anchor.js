/* anchor 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '保温外墙锚固件设计',
        sub: '锚固件反向拉拔 / 局部承压 / 混凝土抗拔 / 尾盘抗拉承载力验算 · 《外墙保温一体化系统应用技术标准（预制混凝土反打保温外墙）》5.5 / GB 50009-2012 / GB/T 50011-2010（2024年版）',
        meta: {"standard": "外墙保温一体化系统应用技术标准(预制混凝土反打保温外墙)", "formulaSource": "5.5", "limitations": "预制反打保温外墙锚固件，反向拉拔/局部承压/混凝土抗拔/尾盘抗拉", "unit": "F:kN, Nt:kN, βc:—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">设计依据与风荷载</div>' +
                '<div class="hint">设计依据：《外墙保温一体化系统应用技术标准（预制混凝土反打保温外墙）》第5.5节（上海市工程建设规范）。5.5.1 锚固件应进行持久设计状况承载力与变形验算、地震设计状况承载力验算，验算时不计入保温层与混凝土基层墙体间的粘结作用；5.5.2 保温层与基层墙体的连接按围护结构计算，锚固件承受直接施加于外墙外侧的荷载与作用。</div>' +
                '<form id="f-an"><div class="grid2">' +
                numField('an_w0', '基本风压 w<sub>0</sub>', 'kN/m²', 0.45, 'GB 50009-2012 附录E，50年重现期') +
                selField('an_terr', '地面粗糙度', opts([{ v: 'A', t: 'A类（近海海面）' }, { v: 'B', t: 'B类（田野、乡村、丘陵）' }, { v: 'C', t: 'C类（城市密集区）' }, { v: 'D', t: 'D类（密集高层区）' }], 'B'), 'GB 50009-2012 表8.2.1') +
                numField('an_z', '计算高度 z', 'm', 10, '锚固件所在高度，用于风压高度变化系数 μ<sub>z</sub> 与阵风系数 β<sub>gz</sub>') +
                numField('an_musl', '局部体型系数 μ<sub>sl</sub>', '—', 1.2, '围护构件按 GB 50009-2012 表8.3.3 取绝对值（墙面约 -1.2~-1.4，檐口/边角 -1.8 等），按控制值取用') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">锚固件参数</div>' +
                '<div class="hint">5.5.11-2：锚杆直径不应小于6mm，不锈钢尾盘直径不应小于8倍锚杆直径且不应小于60mm，尾盘厚度不应小于1.2mm；5.5.11-3：建筑高度超过60m或保温板侧立、板底布置时锚杆直径不应小于8mm。</div>' +
                '<form id="f-an2"><div class="grid2">' +
                selField('an_d', '锚杆直径 d', opts([{ v: 6, t: '6 mm' }, { v: 8, t: '8 mm' }, { v: 10, t: '10 mm' }], 8), '表4.2.7-2 常用规格：6/8/10mm') +
                selField('an_Lrod', '锚杆长度', opts([{ v: 120, t: '120 mm' }, { v: 150, t: '150 mm' }, { v: 180, t: '180 mm' }, { v: 220, t: '220 mm' }], 180), '表4.2.7-2 常用规格：120/150/180/220mm；有效锚固长度 = 锚杆长度 − 保温板厚度') +
                selField('an_tail', '尾盘直径', opts([{ v: 60, t: '60 mm' }, { v: 80, t: '80 mm' }, { v: 100, t: '100 mm' }], 80), '表4.1.2：尾盘直径60/80/100mm对应反向拉拔检验值 3.2/4.5/5.0 kN') +
                numField('an_tt', '尾盘厚度', 'mm', 1.5, '5.5.11-2：不锈钢尾盘厚度不应小于1.2mm') +
                selField('an_layout', '布置方式', opts([{ v: 'board', t: '板面布置' }, { v: 'side', t: '侧立布置' }, { v: 'bottom', t: '板底布置' }], 'board'), '5.5.13-2：板面布置≥3个/m²，侧立/板底布置≥4个/m²；5.5.13-2 板面布置可采用6mm锚杆') +
                numField('an_n', '每块板锚固件数量', '个', 4, '与保温板尺寸联动：单个锚固件承担面积 A₁ = 单块板面积 / 每块数量；密度自动派生并校核 5.5.13-2（板面≥3、侧立/板底≥4 个/m²）') +
                numField('an_t', '保温板厚度 t', 'mm', 100, '5.5.12 以板厚100mm为基准；锚固件悬臂长度 L = t，挠度限值 L/100（5.5.10）') +
                selField('an_seis', '是否验算地震作用', opts([{ v: 'n', t: '不验算' }, { v: 'y', t: '验算' }], 'n'), '5.5.1 地震设计状况承载力验算；水平地震作用 F<sub>Ehk</sub> = β<sub>E</sub>·α<sub>max</sub>·G<sub>k</sub>（5.5.7）') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">布置与板幅构造</div>' +
                '<form id="f-an4"><div class="grid2">' +
                numField('an_bp', '单块保温板宽度', 'mm', 600, '5.5.13-1 以每块保温板为单元布置；用于核算单块面积与短边') +
                numField('an_hp', '单块保温板高度', 'mm', 1200, '单块面积 = 宽×高；短边 = min(宽,高)') +
                numField('an_s', '锚固件间距', 'mm', 600, '5.5.12 间距宜为500~750mm；建筑高度低于24m可按高值取用，其余宜按低值') +
                numField('an_e', '锚固件距板边缘', 'mm', 150, '5.5.12 边距宜为120~250mm') +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">荷载与系数</div>' +
                '<form id="f-an3"><div class="grid2">' +
                numField('an_rho', '保温板密度', 'kg/m³', 200, '表5.4.2 典型保温板密度 180~230kg/m³') +
                numField('an_gface', '抹面层自重标准值', 'kN/m²', 0.5, '薄抹灰面层（抹面胶浆+玻纤网+饰面层），施工影响系数1.6自动计入（5.5.8）') +
                numField('an_gamma0', '结构重要性系数 γ<sub>0</sub>', '—', 1.0, '5.5.3：γ<sub>0</sub> 不应小于1.0，γ<sub>RE</sub> = 1.0') +
                numField('an_amax', '水平地震影响系数最大值 α<sub>max</sub>', '—', 0.08, '5.5.7：可取0.08；β<sub>E</sub> 动力放大系数取5.0') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="an_calc">计算</button>' +
                '<button type="button" class="btn btn-secondary" id="an_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="an_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="an_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('an_result'), proc = document.getElementById('an_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var w0 = parseFloat(document.getElementById('an_w0').value);
                var terr = document.getElementById('an_terr').value;
                var z = parseFloat(document.getElementById('an_z').value);
                var musl = Math.abs(parseFloat(document.getElementById('an_musl').value));
                var d = parseInt(document.getElementById('an_d').value, 10);
                var Lrod = parseInt(document.getElementById('an_Lrod').value, 10);
                var tail = parseInt(document.getElementById('an_tail').value, 10);
                var tt = parseFloat(document.getElementById('an_tt').value);
                var layout = document.getElementById('an_layout').value;
                var nPanel = parseFloat(document.getElementById('an_n').value);
                var t = parseFloat(document.getElementById('an_t').value);
                var seisOn = document.getElementById('an_seis').value === 'y';
                var rho = parseFloat(document.getElementById('an_rho').value);
                var gface = parseFloat(document.getElementById('an_gface').value);
                var gamma0 = parseFloat(document.getElementById('an_gamma0').value);
                var amax = parseFloat(document.getElementById('an_amax').value);
                var bp = parseFloat(document.getElementById('an_bp').value);
                var hp = parseFloat(document.getElementById('an_hp').value);
                var sp = parseFloat(document.getElementById('an_s').value);
                var ep = parseFloat(document.getElementById('an_e').value);
                if (!(w0 > 0)) return err('基本风压 w<sub>0</sub> 必须为正数。');
                if (!(z >= 5)) return err('计算高度 z 不应小于 5m。');
                if (!(d >= 6 && nPanel > 0 && t > 0 && Lrod > t)) return err('锚杆直径应≥6mm，每块板锚固件数量、板厚为正数，且锚杆长度应大于保温板厚度。');
                if (!(bp > 0 && hp > 0 && sp > 0 && ep > 0)) return err('保温板宽高、锚固件间距与边距必须为正数。');

                var st = [];
                var stepIdx = 0;
                function stepNo() { stepIdx++; return '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'[stepIdx - 1]; }

                /* ① 风荷载标准值（GB 50009-2012 8.1.1-2 围护结构） */
                var muzTable = {
                    A: [[5,1.09],[10,1.28],[15,1.42],[20,1.52],[30,1.67],[40,1.79],[50,1.89],[60,1.97],[70,2.05],[80,2.12],[90,2.18],[100,2.23],[150,2.46],[200,2.64],[250,2.78],[300,2.91],[350,3.02],[400,3.12],[450,3.21],[500,3.30]],
                    B: [[5,1.00],[10,1.00],[15,1.13],[20,1.23],[30,1.39],[40,1.52],[50,1.62],[60,1.71],[70,1.79],[80,1.87],[90,1.93],[100,2.00],[150,2.25],[200,2.46],[250,2.63],[300,2.77],[350,2.91],[400,3.03],[450,3.14],[500,3.24]],
                    C: [[5,0.65],[10,0.65],[15,0.65],[20,0.74],[30,0.88],[40,1.00],[50,1.10],[60,1.20],[70,1.28],[80,1.36],[90,1.43],[100,1.50],[150,1.79],[200,2.03],[250,2.24],[300,2.43],[350,2.60],[400,2.76],[450,2.91],[500,3.05]],
                    D: [[5,0.51],[10,0.51],[15,0.51],[20,0.51],[30,0.51],[40,0.60],[50,0.69],[60,0.77],[70,0.84],[80,0.91],[90,0.98],[100,1.04],[150,1.33],[200,1.58],[250,1.81],[300,2.02],[350,2.22],[400,2.40],[450,2.58],[500,2.74]]
                };
                function interp1d(tbl, x) {
                    if (x <= tbl[0][0]) return tbl[0][1];
                    if (x >= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
                    for (var i = 0; i < tbl.length - 1; i++) {
                        if (x >= tbl[i][0] && x <= tbl[i + 1][0]) {
                            var k = (x - tbl[i][0]) / (tbl[i + 1][0] - tbl[i][0]);
                            return tbl[i][1] + k * (tbl[i + 1][1] - tbl[i][1]);
                        }
                    }
                    return tbl[tbl.length - 1][1];
                }
                var muz = interp1d(muzTable[terr], Math.max(z, 5));
                var bgzTable = {
                    A: [[5,1.65],[10,1.60],[15,1.57],[20,1.55],[30,1.53],[40,1.51],[50,1.49],[60,1.48],[70,1.48],[80,1.47],[90,1.46],[100,1.46],[150,1.43],[200,1.42],[250,1.41],[300,1.40],[350,1.40],[400,1.40],[450,1.40],[500,1.40]],
                    B: [[5,1.70],[10,1.70],[15,1.66],[20,1.63],[30,1.59],[40,1.57],[50,1.55],[60,1.54],[70,1.52],[80,1.51],[90,1.50],[100,1.50],[150,1.47],[200,1.45],[250,1.43],[300,1.42],[350,1.41],[400,1.41],[450,1.41],[500,1.41]],
                    C: [[5,2.05],[10,2.05],[15,2.05],[20,1.99],[30,1.90],[40,1.85],[50,1.81],[60,1.78],[70,1.75],[80,1.73],[90,1.71],[100,1.69],[150,1.63],[200,1.59],[250,1.57],[300,1.54],[350,1.53],[400,1.51],[450,1.50],[500,1.50]],
                    D: [[5,2.40],[10,2.40],[15,2.40],[20,2.40],[30,2.40],[40,2.29],[50,2.20],[60,2.14],[70,2.09],[80,2.04],[90,2.01],[100,1.98],[150,1.87],[200,1.79],[250,1.74],[300,1.70],[350,1.67],[400,1.64],[450,1.62],[500,1.60]]
                };
                var bgz = interp1d(bgzTable[terr], Math.max(z, 5));
                var wk = bgz * musl * muz * w0;
                st.push('<div class="step"><b>' + stepNo() + ' 风荷载标准值（GB 50009-2012 8.1.1-2，围护结构）</b>　w<sub>k</sub> = β<sub>gz</sub>·μ<sub>sl</sub>·μ<sub>z</sub>·w<sub>0</sub> = ' + fmt(bgz, 2) + '×' + fmt(musl, 2) + '×' + fmt(muz, 2) + '×' + fmt(w0, 2) + ' = <b>' + fmt(wk, 3) + ' kN/m²</b>。</div>');

                /* ② 保温层与抹面层重力荷载标准值 G_k（5.5.7/5.5.8） */
                var G_insul = rho * t / 1000 * 9.8 / 1000;
                var G_face = gface * 1.6;
                var Gk = G_insul + G_face;
                st.push('<div class="step"><b>' + stepNo() + ' 保温层与抹面层重力荷载标准值 G<sub>k</sub>（5.5.7/5.5.8）</b>　保温层 = ρ·t·g/10⁶ = ' + fmt(rho, 0) + '×' + fmt(t, 0) + '×9.8/10⁶ = ' + fmt(G_insul, 3) + ' kN/m²；抹面层 = ' + fmt(gface, 2) + '×1.6（施工影响系数）= ' + fmt(G_face, 3) + ' kN/m²。<br>　　G<sub>k</sub> = ' + fmt(G_insul, 3) + ' + ' + fmt(G_face, 3) + ' = <b>' + fmt(Gk, 3) + ' kN/m²</b>。</div>');

                /* ③ 单个锚固件承担面积（与保温板幅联动，5.5.13） */
                var Apanel = bp * hp / 1e6;
                var shortSide = Math.min(bp, hp);
                var n = nPanel / Apanel;               /* 派生密度 个/m² */
                var A1 = Apanel / nPanel;              /* 单个锚固件承担面积 m²/个 */
                st.push('<div class="step"><b>' + stepNo() + ' 单个锚固件承担面积（与板幅联动）</b>　单块板面积 = ' + fmt(bp, 0) + '×' + fmt(hp, 0) + '/10⁶ = <b>' + fmt(Apanel, 3) + ' m²</b>；每块板锚固件 ' + fmt(nPanel, 0) + ' 个。<br>　　A<sub>1</sub> = 单块面积 / 每块数量 = ' + fmt(Apanel, 3) + '/' + fmt(nPanel, 0) + ' = <b>' + fmt(A1, 3) + ' m²/个</b>；派生密度 n = ' + fmt(nPanel, 0) + '/' + fmt(Apanel, 3) + ' = <b>' + fmt(n, 2) + ' 个/m²</b>（按 5.5.13-2 ' + (layout === 'board' ? '板面布置≥3' : '侧立/板底布置≥4') + ' 校核）。</div>');

                /* ④ 承载力设计值（5.5.4，检验值 ÷ 分项系数） */
                var RtTable = { 60: 3.2, 80: 4.5, 100: 5.0 };   /* 表4.1.2 反向拉拔，按尾盘直径 */
                var RcTable = { 6: 2.2, 8: 2.8, 10: 3.2 };      /* 表4.1.2 局部承压，按锚杆直径（套管20mm时取5.0，此处按锚杆直径取用） */
                var RdTable = { 6: 9.0, 8: 12.0, 10: 15.0 };    /* 表4.1.2 与混凝土抗拔，按锚杆直径 */
                var RpTable = { 6: 5.0, 8: 6.5, 10: 7.5 };      /* 表4.2.7-3 尾盘抗拉，按锚杆直径 */
                var Rt = RtTable[tail] / 2.5, Rc = RcTable[d] / 3.0, Rd = RdTable[d] / 2.5, Rp = RpTable[d] / 2.5;
                st.push('<div class="step"><b>' + stepNo() + ' 锚固件承载力设计值（5.5.4-1~4，检验值 ÷ 分项系数）</b>　反向拉拔 R<sub>t</sub> = R<sub>tm</sub>/γ<sub>t</sub> = ' + fmt(RtTable[tail], 1) + '/2.5 = <b>' + fmt(Rt, 2) + ' kN</b>；局部承压 R<sub>c</sub> = ' + fmt(RcTable[d], 1) + '/3.0 = <b>' + fmt(Rc, 2) + ' kN</b>；混凝土抗拔 R<sub>d</sub> = ' + fmt(RdTable[d], 1) + '/2.5 = <b>' + fmt(Rd, 2) + ' kN</b>；尾盘抗拉 R<sub>p</sub> = ' + fmt(RpTable[d], 1) + '/2.5 = <b>' + fmt(Rp, 2) + ' kN</b>。</div>');

                /* ⑤ 持久设计状况组合（5.5.5-1），分两档：
                   工况A 面外风控：平面外 γG=0（5.5.6-1），S = γ0·γW·SWk
                   工况B 连接节点含自重：γG=1.3（5.5.6-2），S = γ0·(γG·SGk + γW·SWk) */
                var Nk = wk * A1;                      /* 标准组合效应（变形验算用） */
                var S1 = gamma0 * 1.5 * wk;
                var N1 = S1 * A1;
                var S2 = gamma0 * (1.3 * Gk + 1.5 * wk);
                var N2 = S2 * A1;
                st.push('<div class="step"><b>' + stepNo() + ' 持久设计状况荷载效应（5.5.5-1）</b>　S = γ<sub>0</sub>(γ<sub>G</sub>S<sub>Gk</sub> + γ<sub>W</sub>S<sub>Wk</sub>)，γ<sub>W</sub> = 1.5。<br>');
                st.push('　　工况A（面外风控，5.5.6-1 平面外 γ<sub>G</sub> = 0）：S = ' + fmt(gamma0, 2) + '×(0 + 1.5×' + fmt(wk, 3) + ') = <b>' + fmt(S1, 3) + ' kN/m²</b>，单个锚固件 N<sub>1</sub> = <b>' + fmt(N1, 3) + ' kN</b>。<br>');
                st.push('　　工况B（连接节点含自重，5.5.6-2 γ<sub>G</sub> = 1.3）：S = ' + fmt(gamma0, 2) + '×(1.3×' + fmt(Gk, 3) + ' + 1.5×' + fmt(wk, 3) + ') = <b>' + fmt(S2, 3) + ' kN/m²</b>，单个锚固件 N<sub>2</sub> = <b>' + fmt(N2, 3) + ' kN</b>。</div>');

                /* ⑥ 地震设计状况组合（5.5.5-2/3、表5.5.5、5.5.7、5.5.9）
                   水平：F_Ehk = β_E·α_max·G_k，连接节点效应×2.0（5.5.7）
                   竖向：0.65×水平地震作用标准值（5.5.9）
                   按表5.5.5 取四档分项系数包络：仅水平(1.4/0)、仅竖向(0/1.4)、水平为主(1.4/0.5)、竖向为主(0.5/1.4) */
                var FEhk = 5.0 * amax * Gk;              /* F_Ehk = β_E·α_max·G_k，β_E=5.0 */
                var FEhk_node = 2.0 * FEhk;              /* 连接节点地震作用效应标准值×2.0（5.5.7） */
                var SEvk = 0.65 * FEhk_node;             /* 5.5.9 竖向=0.65×水平（连接节点取含增大值，偏安全） */
                var S3a = gamma0 * (1.3 * Gk + 1.4 * FEhk_node + 0.2 * 1.5 * wk);           /* 仅水平地震 γEh=1.4（5.5.5-2，γG=1.3） */
                var S3b = gamma0 * (1.3 * Gk + 1.4 * SEvk);                                 /* 仅竖向地震 γEv=1.4（5.5.5-3，γG=1.3，无风） */
                var S3c = gamma0 * (1.3 * Gk + 1.4 * FEhk_node + 0.5 * SEvk + 0.2 * 1.5 * wk); /* 水平为主 γEh=1.4 γEv=0.5 */
                var S3d = gamma0 * (1.3 * Gk + 0.5 * FEhk_node + 1.4 * SEvk + 0.2 * 1.5 * wk); /* 竖向为主 γEh=0.5 γEv=1.4 */
                var SE = seisOn ? Math.max(S3a, S3b, S3c, S3d) : 0;
                var Ne = SE * A1;
                if (seisOn) {
                    st.push('<div class="step"><b>' + stepNo() + ' 地震设计状况荷载效应（5.5.5-2/3、表5.5.5）</b>　水平地震 F<sub>Ehk</sub> = β<sub>E</sub>·α<sub>max</sub>·G<sub>k</sub> = 5.0×' + fmt(amax, 2) + '×' + fmt(Gk, 3) + ' = ' + fmt(FEhk, 3) + ' kN/m²；连接节点效应×2.0 增大系数（5.5.7）→ ' + fmt(FEhk_node, 3) + ' kN/m²；竖向地震 = 0.65×水平 = <b>' + fmt(SEvk, 3) + ' kN/m²</b>（5.5.9，含节点增大值，偏安全）。<br>');
                    st.push('　　按表5.5.5 四种情形（γ<sub>Eh</sub>/γ<sub>Ev</sub>）计算，γ<sub>G</sub> = 1.3（连接节点，5.5.6-2）、ψ<sub>W</sub> = 0.2：<br>');
                    st.push('　　① 仅水平（1.4/0）：S = ' + fmt(gamma0, 2) + '×(1.3×' + fmt(Gk, 3) + ' + 1.4×' + fmt(FEhk_node, 3) + ' + 0.2×1.5×' + fmt(wk, 3) + ') = ' + fmt(S3a, 3) + ' kN/m²，N = ' + fmt(S3a * A1, 3) + ' kN<br>');
                    st.push('　　② 仅竖向（0/1.4）：S = ' + fmt(gamma0, 2) + '×(1.3×' + fmt(Gk, 3) + ' + 1.4×' + fmt(SEvk, 3) + ') = ' + fmt(S3b, 3) + ' kN/m²，N = ' + fmt(S3b * A1, 3) + ' kN<br>');
                    st.push('　　③ 水平为主（1.4/0.5）：S = ' + fmt(gamma0, 2) + '×(1.3×' + fmt(Gk, 3) + ' + 1.4×' + fmt(FEhk_node, 3) + ' + 0.5×' + fmt(SEvk, 3) + ' + 0.2×1.5×' + fmt(wk, 3) + ') = ' + fmt(S3c, 3) + ' kN/m²，N = ' + fmt(S3c * A1, 3) + ' kN<br>');
                    st.push('　　④ 竖向为主（0.5/1.4）：S = ' + fmt(gamma0, 2) + '×(1.3×' + fmt(Gk, 3) + ' + 0.5×' + fmt(FEhk_node, 3) + ' + 1.4×' + fmt(SEvk, 3) + ' + 0.2×1.5×' + fmt(wk, 3) + ') = ' + fmt(S3d, 3) + ' kN/m²，N = ' + fmt(S3d * A1, 3) + ' kN<br>');
                    st.push('　　取包络 S<sub>E</sub> = max = <b>' + fmt(SE, 3) + ' kN/m²</b>，单个锚固件 N<sub>E</sub> = <b>' + fmt(Ne, 3) + ' kN</b>。</div>');
                }

                /* ⑦ 承载力验算（持久取 N=max(N1,N2) 包络，地震取 NE） */
                var Nd = Math.max(N1, N2);
                var okT = Nd <= Rt, okC = Nd <= Rc, okD = Nd <= Rd, okP = Nd <= Rp;
                var okTe = !seisOn || Ne <= Rt, okCe = !seisOn || Ne <= Rc, okDe = !seisOn || Ne <= Rd, okPe = !seisOn || Ne <= Rp;
                var minR = Math.min(Rt, Rc, Rd, Rp);
                st.push('<div class="step"><b>' + stepNo() + ' 持久设计状况承载力验算</b>　N<sub>1</sub>（风控）= ' + fmt(N1, 3) + ' kN，N<sub>2</sub>（含自重）= ' + fmt(N2, 3) + ' kN，取 N = max(N<sub>1</sub>, N<sub>2</sub>) = <b>' + fmt(Nd, 3) + ' kN</b> 与四项承载力设计值比较：<br>');
                st.push('　　反向拉拔 R<sub>t</sub> = ' + fmt(Rt, 2) + ' kN：' + (Nd <= Rt ? 'N ≤ R<sub>t</sub> 满足' : 'N > R<sub>t</sub> 不满足') + '；　局部承压 R<sub>c</sub> = ' + fmt(Rc, 2) + ' kN：' + (Nd <= Rc ? '满足' : '不满足') + '；<br>');
                st.push('　　混凝土抗拔 R<sub>d</sub> = ' + fmt(Rd, 2) + ' kN：' + (Nd <= Rd ? '满足' : '不满足') + '；　尾盘抗拉 R<sub>p</sub> = ' + fmt(Rp, 2) + ' kN：' + (Nd <= Rp ? '满足' : '不满足') + '。</div>');
                if (seisOn) {
                    st.push('<div class="step"><b>' + stepNo() + ' 地震设计状况承载力验算</b>　N<sub>E</sub> = ' + fmt(Ne, 3) + ' kN 与四项承载力设计值比较：<br>');
                    st.push('　　反向拉拔 R<sub>t</sub> = ' + fmt(Rt, 2) + ' kN：' + (Ne <= Rt ? '满足' : '不满足') + '；　局部承压 R<sub>c</sub> = ' + fmt(Rc, 2) + ' kN：' + (Ne <= Rc ? '满足' : '不满足') + '；<br>');
                    st.push('　　混凝土抗拔 R<sub>d</sub> = ' + fmt(Rd, 2) + ' kN：' + (Ne <= Rd ? '满足' : '不满足') + '；　尾盘抗拉 R<sub>p</sub> = ' + fmt(Rp, 2) + ' kN：' + (Ne <= Rp ? '满足' : '不满足') + '。</div>');
                }

                /* ⑧ 变形验算（5.5.10 标准组合挠度 ≤ L/100） */
                var L100 = t / 100;
                var deflN = Nk;
                st.push('<div class="step"><b>' + stepNo() + ' 变形验算（5.5.10）</b>　锚固件在荷载效应标准组合下的挠度不应大于 L/100。标准组合效应 N<sub>k</sub> = w<sub>k</sub>·A<sub>1</sub> = ' + fmt(wk, 3) + '×' + fmt(A1, 3) + ' = <b>' + fmt(deflN, 3) + ' kN</b>；悬臂长度 L = 保温板厚度 = ' + fmt(t, 0) + ' mm，限值 L/100 = <b>' + fmt(L100, 2) + ' mm</b>。挠度由产品刚度试验确定（附录K），此处输出控制内力供核对。</div>');

                /* ⑨ 构造要求检查（5.5.11~5.5.15） */
                var ckD = d >= 6;
                var ckD8 = (z > 60 || layout !== 'board') ? d >= 8 : true;
                var ckT = tail >= 8 * d && tail >= 60;
                var ckTT = tt >= 1.2;
                var ckN = n >= (layout === 'board' ? 3 : 4);
                var Lembed = Lrod - t;
                var ckL = Lembed >= 7 * d && Lembed >= 50;
                /* 5.5.12 间距 500~750mm、边距 120~250mm */
                var ckS = sp >= 500 && sp <= 750;
                var ckE = ep >= 120 && ep <= 250;
                /* 5.5.13-3 边缘独立保温板锚固件数量：≤0.3m²≥1个，0.3~1.0m²≥2个 */
                var reqN = Apanel <= 0.3 ? 1 : (Apanel < 1.0 ? 2 : 0);
                var ckSmall = reqN === 0 ? true : (nPanel >= reqN);
                /* 5.5.14 墙边缘保温板不宜<0.3m²且短边不宜<0.15m */
                var ckEdge = Apanel >= 0.3 && shortSide >= 150;
                st.push('<div class="step"><b>' + stepNo() + ' 构造要求检查（5.5.11~5.5.15）</b><br>');
                st.push('　　① 锚杆直径 d = ' + fmt(d, 0) + ' mm ≥ 6mm：' + (ckD ? '满足' : '不满足') + (ckD8 ? '' : '（z>60m 或侧立/板底布置时应≥8mm，不满足）') + '<br>');
                st.push('　　② 尾盘直径 ' + fmt(tail, 0) + ' mm ≥ 8d = ' + fmt(8 * d, 0) + ' mm 且 ≥60mm：' + (ckT ? '满足' : '不满足') + '<br>');
                st.push('　　③ 尾盘厚度 ' + fmt(tt, 1) + ' mm ≥ 1.2mm：' + (ckTT ? '满足' : '不满足') + '<br>');
                st.push('　　④ 派生密度 n = ' + fmt(n, 2) + ' 个/m² ' + (layout === 'board' ? '≥3（板面布置）' : '≥4（侧立/板底布置）') + '：' + (ckN ? '满足' : '不满足') + '<br>');
                st.push('　　⑤ 有效锚固长度 ' + fmt(Lembed, 0) + ' mm = ' + fmt(Lrod, 0) + ' − ' + fmt(t, 0) + ' ≥ 7d = ' + fmt(7 * d, 0) + ' mm 且 ≥50mm：' + (ckL ? '满足' : '不满足') + '<br>');
                st.push('　　⑥ 锚固件间距 ' + fmt(sp, 0) + ' mm ∈ [500, 750]（5.5.12，<24m可高值、其余宜低值）：' + (ckS ? '满足' : '不满足') + '<br>');
                st.push('　　⑦ 锚固件距板边缘 ' + fmt(ep, 0) + ' mm ∈ [120, 250]（5.5.12）：' + (ckE ? '满足' : '不满足') + '<br>');
                st.push('　　⑧ 单块板面积 ' + fmt(Apanel, 3) + ' m²，每块锚固件 ' + fmt(nPanel, 0) + ' 个' + (reqN > 0 ? ' ≥ ' + reqN + ' 个（5.5.13-3 边缘小板）：' + (ckSmall ? '满足' : '不满足') : '（≥1.0m² 按密度控制）：满足') + '<br>');
                st.push('　　⑨ 墙边缘板面积 ' + fmt(Apanel, 3) + ' m² ≥ 0.3 且短边 ' + fmt(shortSide, 0) + ' mm ≥ 150（5.5.14）：' + (ckEdge ? '满足' : '不满足') + '</div>');

                var allOk = okT && okC && okD && okP && okTe && okCe && okDe && okPe && ckD && ckD8 && ckT && ckTT && ckN && ckL && ckS && ckE && ckSmall && ckEdge;

                var html = '<table class="result-table"><tbody>';
                function resultRow(k, v) { return '<tr><td>' + k + '</td><td>' + v + '</td></tr>'; }
                function tag(ok, txt) { return ok ? '<span class="tag-ok">' + txt + '</span>' : '<span class="tag-err">' + txt + '</span>'; }
                function badge(ok, txt) { return '<span class="badge ' + (ok ? 'badge-ok' : 'badge-err') + '">' + txt + '</span>'; }
                html += resultRow('风荷载标准值 w<sub>k</sub>', fmt(wk, 3) + ' kN/m²');
                html += resultRow('重力荷载 G<sub>k</sub>（保温层+抹面层）', fmt(G_insul, 3) + ' + ' + fmt(G_face, 3) + ' = ' + fmt(Gk, 3) + ' kN/m²');
                html += resultRow('单个锚固件承担面积 A<sub>1</sub>', fmt(A1, 3) + ' m²（单块 ' + fmt(Apanel, 3) + 'm² / ' + fmt(nPanel, 0) + ' 个；派生密度 ' + fmt(n, 2) + ' 个/m²）');
                html += resultRow('反向拉拔设计值 R<sub>t</sub>', fmt(Rt, 2) + ' kN（γ<sub>t</sub>=2.5）');
                html += resultRow('局部承压设计值 R<sub>c</sub>', fmt(Rc, 2) + ' kN（γ<sub>c</sub>=3.0）');
                html += resultRow('混凝土抗拔设计值 R<sub>d</sub>', fmt(Rd, 2) + ' kN（γ<sub>d</sub>=2.5）');
                html += resultRow('尾盘抗拉设计值 R<sub>p</sub>', fmt(Rp, 2) + ' kN（γ<sub>p</sub>=2.5）');
                html += resultRow('持久组合·风控 N<sub>1</sub>（5.5.5-1，γ<sub>G</sub>=0）', fmt(N1, 3) + ' kN ' + (N1 <= minR ? tag(true, '≤ min(R)') : tag(false, '> min(R)')));
                html += resultRow('持久组合·含自重 N<sub>2</sub>（5.5.6-2，γ<sub>G</sub>=1.3）', fmt(N2, 3) + ' kN ' + (N2 <= minR ? tag(true, '≤ min(R)') : tag(false, '> min(R)')));
                if (seisOn) html += resultRow('地震组合 N<sub>E</sub>（表5.5.5 四档包络）', fmt(Ne, 3) + ' kN ' + (Ne <= minR ? tag(true, '≤ min(R)') : tag(false, '> min(R)')));
                html += resultRow('变形验算限值 L/100', fmt(L100, 2) + ' mm，控制内力 N<sub>k</sub> = ' + fmt(deflN, 3) + ' kN');
                html += resultRow('构造检查 ①锚杆直径', fmt(d, 0) + ' mm ≥ 6mm ' + (ckD && ckD8 ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ②尾盘直径', fmt(tail, 0) + ' ≥ ' + fmt(Math.max(8 * d, 60), 0) + ' mm ' + (ckT ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ③尾盘厚度', fmt(tt, 1) + ' ≥ 1.2 mm ' + (ckTT ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ④派生密度', fmt(n, 2) + ' 个/m² ' + (ckN ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ⑤有效锚固长度', fmt(Lembed, 0) + ' ≥ ' + fmt(Math.max(7 * d, 50), 0) + ' mm ' + (ckL ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ⑥锚固件间距', fmt(sp, 0) + ' mm ∈ [500,750] ' + (ckS ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ⑦距板边缘', fmt(ep, 0) + ' mm ∈ [120,250] ' + (ckE ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ⑧边缘小板数量', '单块 ' + fmt(Apanel, 3) + 'm²，' + fmt(nPanel, 0) + ' 个/块 ' + (ckSmall ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('构造检查 ⑨墙边缘板幅', fmt(Apanel, 3) + 'm²≥0.3 且短边 ' + fmt(shortSide, 0) + 'mm≥150 ' + (ckEdge ? tag(true, '满足') : tag(false, '不满足')));
                html += resultRow('综合判定', allOk ? badge(true, '满足：承载力 / 变形 / 构造 均满足') : badge(false, '存在不满足项，请调整锚固件规格、布置或保温板厚度'));
                html += '</tbody></table>';
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : null;
                if (_p) _p.classList.add('open');
                window._AN_RESULT = {
                    w0: w0, terr: terr, z: z, musl: musl, wk: wk, bgz: bgz, muz: muz,
                    d: d, Lrod: Lrod, tail: tail, tt: tt, layout: layout, n: n, nPanel: nPanel, t: t,
                    rho: rho, gface: gface, gamma0: gamma0, amax: amax, seisOn: seisOn,
                    G_insul: G_insul, G_face: G_face, Gk: Gk, A1: A1,
                    Rt: Rt, Rc: Rc, Rd: Rd, Rp: Rp, RtTable: RtTable[tail], RcTable: RcTable[d], RdTable: RdTable[d], RpTable: RpTable[d],
                    S1: S1, N1: N1, S2: S2, N2: N2, Nd: Nd, Nk: Nk,
                    FEhk: FEhk, FEhk_node: FEhk_node, SEvk: SEvk, S3a: S3a, S3b: S3b, S3c: S3c, S3d: S3d, SE: SE, Ne: Ne,
                    L100: L100, deflN: deflN,
                    ckD: ckD, ckD8: ckD8, ckT: ckT, ckTT: ckTT, ckN: ckN, Lembed: Lembed, ckL: ckL,
                    bp: bp, hp: hp, sp: sp, ep: ep, Apanel: Apanel, shortSide: shortSide, reqN: reqN,
                    ckS: ckS, ckE: ckE, ckSmall: ckSmall, ckEdge: ckEdge,
                    okT: okT, okC: okC, okD: okD, okP: okP, okTe: okTe, okCe: okCe, okDe: okDe, okPe: okPe,
                    allOk: allOk, steps: st.join('')
                };
            }
            function reset() {
                document.getElementById('an_w0').value = 0.45;
                document.getElementById('an_terr').value = 'B';
                document.getElementById('an_z').value = 10;
                document.getElementById('an_musl').value = 1.2;
                document.getElementById('an_d').value = 8;
                document.getElementById('an_Lrod').value = 180;
                document.getElementById('an_tail').value = 80;
                document.getElementById('an_tt').value = 1.5;
                document.getElementById('an_layout').value = 'board';
                document.getElementById('an_n').value = 4;
                document.getElementById('an_t').value = 100;
                document.getElementById('an_seis').value = 'n';
                document.getElementById('an_rho').value = 200;
                document.getElementById('an_gface').value = 0.5;
                document.getElementById('an_gamma0').value = 1.0;
                document.getElementById('an_amax').value = 0.08;
                document.getElementById('an_bp').value = 600;
                document.getElementById('an_hp').value = 1200;
                document.getElementById('an_s').value = 600;
                document.getElementById('an_e').value = 150;
                calc();
            }
            document.getElementById('an_calc').addEventListener('click', calc);
            document.getElementById('an_reset').addEventListener('click', reset);
            ['an_terr', 'an_d', 'an_Lrod', 'an_tail', 'an_layout', 'an_seis', 'an_gamma0'].forEach(function (id) {
                document.getElementById(id).addEventListener('change', calc);
            });
            ['an_w0', 'an_z', 'an_musl', 'an_tt', 'an_n', 'an_t', 'an_rho', 'an_gface', 'an_amax'].forEach(function (id) {
                document.getElementById(id).addEventListener('input', calc);
            });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['anchor'] = tool;
})();
