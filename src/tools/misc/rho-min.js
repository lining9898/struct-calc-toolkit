/* rho-min 工具模块
 * 依据：GB 55008-2021《混凝土结构通用规范》第 4.4.6 条及表 4.4.6（全文强制）
 *       GB/T 50010-2010（2024年版）《混凝土结构设计标准》第 4.1.2 条（强度等级下限）
 * 2026-09-23 修订：
 *   ① 依据由 GB/T 50010-2010（2024年版）第 8.5.1 条改为 GB 55008-2021 第 4.4.6 条
 *      （原强条已被通用规范替代废止，数值规定一致但出处必须更新）；
 *   ② 补入此前完全缺失的第 4.4.6 条第 2 款——板类受弯构件采用 500MPa 级
 *      钢筋时下限可取 0.15%（悬臂板、柱支承板除外）；
 *   ③ 补入第 4.1.2 条混凝土强度等级下限校验（500MPa 级钢筋 → 不低于 C30）；
 *   ④ 修复复制粘贴残留导致的 ReferenceError（原 _BS_RESULT 引用了本工具
 *      未定义的 asV / V / Vc 等变量，每次计算必抛异常）。
 */
(function () {
    var tool = {
        title: '最小配筋率速查',
        sub: '受弯 / 受压构件 · GB 55008-2021 第 4.4.6 条及表 4.4.6',
        meta: {
            standard: 'GB 55008-2021 混凝土结构通用规范 / GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: 'GB 55008-2021 第 4.4.6 条（表 4.4.6）',
            limitations: '受弯/受压构件最小配筋率与最小配筋面积；混凝土强度等级上限至 C50',
            unit: 'ρmin:%, As,min:mm²',
            version: '1.1.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">参数</div>' +
                '<form id="f-rh"><div class="grid2">' +
                selField('rh_type', '构件类型', opts([
                    { v: 'flex', t: '受弯构件（一侧受拉钢筋）' },
                    { v: 'slab', t: '板类受弯构件（非悬臂、非柱支承）' },
                    { v: 'col-all', t: '受压构件（全部纵向钢筋）' },
                    { v: 'col-side', t: '受压构件（一侧纵向钢筋）' }
                ], 'flex')) +
                selField('rh_con', '混凝土强度等级', conOpts('C30')) +
                selField('rh_reb', '钢筋级别', opts([{ v: 'HRB400', t: 'HRB400' }, { v: 'HRB500', t: 'HRB500' }], 'HRB400')) +
                numField('rh_b', '截面宽度 b（可选）', 'mm', 300) +
                numField('rh_h', '截面高度 h（可选）', 'mm', 600) +
                '</div><div class="btn-group"><button type="button" class="btn btn-primary" id="rh_calc">查最小配筋率</button></div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="rh_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看计算依据</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="rh_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('rh_result'), proc = document.getElementById('rh_proc');
                var type = document.getElementById('rh_type').value;
                var conKey = document.getElementById('rh_con').value;
                var con = CONCRETE[conKey];
                var reb = document.getElementById('rh_reb').value;
                var b = parseFloat(document.getElementById('rh_b').value);
                var h = parseFloat(document.getElementById('rh_h').value);
                if (!con) return;
                var materialError = concreteRebarError(con, REBAR_FLEX[reb]);
                if (materialError) { out.innerHTML = '<div class="error-box">' + materialError + '</div>'; proc.innerHTML = ''; return; }
                var ft = con.ft, fy = REBAR_FLEX[reb].fy;
                var is500 = is500Steel(reb);
                var rhoMin, note = '', st = [], warn = '';

                st.push('<div class="step"><b>依据</b>　纵向受力普通钢筋最小配筋率按 <b>GB 55008-2021《混凝土结构通用规范》第 4.4.6 条及表 4.4.6</b> 确定（全文强制）。</div>');
                st.push('<div class="step"><b>说明</b>　原 GB 50010-2010（2015年版）第 8.5.1 强制性条文随通用规范实施废止；本工具按现行通用规范计算，现行依据为 GB 55008-2021。</div>');

                if (type === 'flex' || type === 'slab') {
                    var rm = rhoMinFlex(ft, fy, {
                        isSlab: type === 'slab',
                        isCantilever: false,
                        isColumnSupported: false,
                        is500: is500
                    });
                    rhoMin = rm.rho;
                    note = rm.note;
                    if (type === 'slab') {
                        if (is500) {
                            st.push('<div class="step"><b>依据（第 4.4.6 条第 2 款）</b>　板类受弯构件（悬臂板、柱支承板除外）采用 500MPa 级钢筋时，ρ<sub>min</sub> = max(0.15%, 45f<sub>t</sub>/f<sub>y</sub>)。</div>');
                        } else {
                            st.push('<div class="step"><b>注意</b>　所选钢筋为 ' + reb + '（f<sub>yk</sub> = ' + REBAR_FYK[reb] + ' MPa，非 500MPa 级），不享受第 4.4.6 条第 2 款的 0.15% 下限，仍按 0.20% 控制。</div>');
                            warn = '<div class="hint" style="color:#8a6d1a">当前钢筋非 500MPa 级，板类 0.15% 条款不适用，按通用下限 0.20% 取值的依据是第 4.4.6 条第 1 款。</div>';
                        }
                    } else {
                        st.push('<div class="step"><b>依据（第 4.4.6 条第 1 款）</b>　ρ<sub>min</sub> = max(0.20%, 45f<sub>t</sub>/f<sub>y</sub>)。</div>');
                    }
                    st.push('<div class="step"><b>代入</b>　45×' + ft + '/' + fy + ' = ' + fmt(rm.v45 * 100, 3) + '%；下限 ' + fmt(rm.floor * 100, 2) + '% ⇒ 取 <b>ρ<sub>min</sub> = ' + fmt(rhoMin * 100, 2) + '%</b></div>');
                    st.push('<div class="step"><b>说明</b>　对 T 形截面，配筋率按全截面扣除受压翼缘面积（b<sub>f</sub>\u2032−b)h<sub>f</sub>\u2032 计算。</div>');
                } else if (type === 'col-all') {
                    rhoMin = rhoMinColumnAll(reb);
                    note = '按钢筋级别查表';
                    st.push('<div class="step"><b>依据（表 4.4.6）</b>　受压构件全部纵向钢筋：500 级取 0.50%，400 级取 0.55%（C60 以上混凝土另有折减）。</div>');
                    st.push('<div class="step"><b>取值</b>　' + reb + ' ⇒ <b>ρ<sub>min</sub> = ' + fmt(rhoMin * 100, 2) + '%</b></div>');
                } else {
                    rhoMin = 0.002;
                    note = '固定值';
                    st.push('<div class="step"><b>依据（表 4.4.6）</b>　受压构件一侧纵向钢筋最小配筋率为 <b>0.20%</b>。</div>');
                }

                // 第 4.1.2 条：混凝土强度等级下限
                var fl = checkConGradeFloor(conKey, reb);
                if (!fl.ok) {
                    warn += '<div class="hint" style="color:#a12622"><b>不满足第 4.1.2 条</b>：采用 ' + reb + '（500MPa 级）钢筋时，混凝土强度等级不应低于 C' + fl.need + '，当前选用 ' + conKey + '。</div>';
                    st.push('<div class="step" style="color:#a12622"><b>异常提示</b>　混凝土强度等级 ' + conKey + ' 低于第 4.1.2 条规定的下限 C' + fl.need + '。</div>');
                } else {
                    st.push('<div class="step"><b>第 4.1.2 条校核</b>　采用 ' + reb + ' 时混凝土不应低于 C' + fl.need + '，当前 ' + conKey + '，满足。</div>');
                }

                var hasSize = b > 0 && h > 0;
                var AsMin = hasSize ? rhoMin * b * h : null;
                var html = warn;
                html += resultRow('ρ<sub>min</sub>（' + note + '）', '<span class="highlight">' + fmt(rhoMin * 100, 2) + '%</span>');
                if (hasSize) html += resultRow('A<sub>s,min</sub> = ρ<sub>min</sub>·b·h', fmt(AsMin, 0) + ' mm²（b=' + b + ', h=' + h + '）');
                else html += resultRow('最小配筋面积', '输入截面尺寸后可计算');
                if (type === 'flex' || type === 'slab') html += resultRow('45f<sub>t</sub>/f<sub>y</sub>', fmt(0.45 * ft / fy * 100, 3) + '%');
                if (type === 'col-all') html += resultRow('一侧纵筋 ρ<sub>min</sub>', '0.20%');
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap');
                if (_p) _p.classList.add('open');
                window._BS_RESULT = {
                    type: type, conGrade: conKey, steelGrade: reb,
                    ft: ft, fy: fy, is500: is500,
                    rho: rhoMin, AsMin: AsMin,
                    gradeFloorOk: fl.ok, gradeFloorNeed: fl.need,
                    b: b, h: h, steps: st.join('')
                };
            }
            document.getElementById('rh_calc').addEventListener('click', calc);
            document.getElementById('f-rh').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['rho-min'] = tool;
})();
