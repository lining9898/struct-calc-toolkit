/* seismic-perf 工具模块
 * 从 index.html 拆分，计算逻辑保持不变
 */
(function () {
    var tool = {
        title: '抗震性能化设计',
        sub: '性能目标矩阵 · 破坏状态 · 荷载组合 · 截面验算 · GB/T 50011-2010（2024年版）(2016) 2024修订 §3.10 + §5.4.1',
        meta: {"standard": "GB/T 50011-2010（2024年版）建筑抗震设计标准", "formulaSource": "3.10, 5.4.1", "limitations": "4级性能目标×3级地震水准矩阵，5级破坏状态", "unit": "—", "version": "1.0.0"},
        render: function () {
            return '<div class="panel"><div class="panel-title">性能目标选择</div>' +
                '<form id="f-sp"><div class="grid2">' +
                selField('sp_perf', '结构性能目标', opts([
                    { v: '1', t: '性能1（大震下基本完好）' },
                    { v: '2', t: '性能2（中震完好，大震轻微-中等）' },
                    { v: '3', t: '性能3（中震轻微，大震可修）' },
                    { v: '4', t: '性能4（中震轻-中，大震接近严重）' }
                ], '3'), '性能1最高（需隔震/减震或低烈度大风地区）；性能4为一般情况') +
                '</div><div class="panel-title" style="margin-top:14px;">地震作用参数</div><div class="grid2">' +
                selField('sp_intensity', '抗震设防烈度', opts([
                    { v: 6, t: '6 度（0.05g）' },
                    { v: 7, t: '7 度（0.10g）' },
                    { v: '7.5', t: '7 度（0.15g）' },
                    { v: 8, t: '8 度（0.20g）' },
                    { v: '8.5', t: '8 度（0.30g）' },
                    { v: 9, t: '9 度（0.40g）' }
                ], 8)) +
                selField('sp_level', '考虑地震水准', opts([
                    { v: 'frequent', t: '多遇地震（小震）' },
                    { v: 'fortification', t: '设防地震（中震）' },
                    { v: 'rare', t: '罕遇地震（大震）' }
                ], 'fortification')) +
                '</div><div class="panel-title" style="margin-top:14px;">荷载组合参数</div><div class="grid2">' +
                selField('sp_version', '规范版本', opts([
                    { v: '2024', t: 'GB/T 50011-2010（2024年版）(2016) 2024修订' },
                    { v: '2016', t: 'GB/T 50011-2010（2024年版）(2016) 原版' }
                ], '2024'), '2024修订调整表5.4.1：γEh从1.3→1.4') +
                numField('sp_SGE', '重力荷载代表值效应 S<sub>GE</sub>', 'kN·m', 500, '恒载+活载组合代表值产生的内力') +
                numField('sp_SEhk', '水平地震作用效应 S<sub>Ehk</sub>', 'kN·m', 800, '水平地震作用标准值效应') +
                numField('sp_SEvk', '竖向地震作用效应 S<sub>Evk</sub>', 'kN·m', 0, '竖向地震作用标准值效应（大跨/长悬臂时考虑）') +
                numField('sp_Swk', '风荷载效应 S<sub>wk</sub>', 'kN·m', 0, '风荷载标准值效应（一般取0）') +
                selField('sp_seis_dir', '地震作用方向', opts([
                    { v: 'h', t: '仅水平地震' },
                    { v: 'v', t: '仅竖向地震' },
                    { v: 'hv', t: '水平+竖向（水平为主）' },
                    { v: 'vh', t: '水平+竖向（竖向为主）' }
                ], 'h')) +
                selField('sp_wind_ctrl', '风荷载组合值系数 ψ<sub>w</sub>', opts([
                    { v: 0, t: '0.0（一般结构）' },
                    { v: 0.2, t: '0.2（风荷载起控制作用）' }
                ], 0)) +
                '</div><div class="hint">说明：依据 GB/T 50011-2010（2024年版）2024年局部修订 第3.10节（抗震性能化设计）和第5.4.1条（截面抗震验算）计算。性能目标参考附录M，2024修订新增设防地震下需保持正常使用的建筑性能要求。</div>' +
                '<div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="sp_calc">计算性能目标与组合</button>' +
                '<button type="button" class="btn btn-secondary" id="sp_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">性能目标矩阵</div><div id="sp_matrix"></div></div>' +
                '<div class="panel"><div class="panel-title">荷载组合与截面验算</div><div id="sp_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>详细计算过程</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="sp_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('sp_result');
                var proc = document.getElementById('sp_proc');
                var matrixDiv = document.getElementById('sp_matrix');
                var perfV = document.getElementById('sp_perf').value;
                var intensity = document.getElementById('sp_intensity').value;
                var level = document.getElementById('sp_level').value;
                var SGE = parseFloat(document.getElementById('sp_SGE').value);
                var SEhk = parseFloat(document.getElementById('sp_SEhk').value);
                var SEvk = parseFloat(document.getElementById('sp_SEvk').value);
                var Swk = parseFloat(document.getElementById('sp_Swk').value);
                var seisDir = document.getElementById('sp_seis_dir').value;
                var psi_w = parseFloat(document.getElementById('sp_wind_ctrl').value);
                var version = document.getElementById('sp_version').value;
                var st = [];

                // 性能目标矩阵（附录M 表M.1.1-1/2 综合）
                var perfMatrix = {
                    'frequent': { '1': '完好，远小于弹性位移限值', '2': '完好，远小于弹性位移限值', '3': '完好，明显小于弹性位移限值', '4': '完好，小于弹性位移限值' },
                    'fortification': { '1': '完好，小于弹性位移限值（按抗震等级调整）', '2': '基本完好，略大于弹性位移限值（不含抗震等级调整）', '3': '轻微损坏，<2倍弹性位移限值（按标准值复核）', '4': '轻~中等破坏，<3倍弹性位移限值（按极限值复核）' },
                    'rare': { '1': '基本完好，略大于弹性位移限值', '2': '轻微塑性变形，<2倍弹性位移限值', '3': '明显塑性变形，约4倍弹性位移限值（降<5%）', '4': '不严重破坏，≤0.9倍塑性位移限值（降<10%）' }
                };

                var levelNames = { 'frequent': '多遇地震', 'fortification': '设防地震', 'rare': '罕遇地震' };
                var perfNames = { '1': '性能1', '2': '性能2', '3': '性能3', '4': '性能4' };

                // 渲染矩阵
                var mHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
                mHtml += '<tr style="background:var(--canvas-soft);font-weight:600;"><th style="padding:8px;border:1px solid var(--hairline);">地震水准</th><th style="padding:8px;border:1px solid var(--hairline);">性能1</th><th style="padding:8px;border:1px solid var(--hairline);">性能2</th><th style="padding:8px;border:1px solid var(--hairline);">性能3</th><th style="padding:8px;border:1px solid var(--hairline);">性能4</th></tr>';
                ['frequent', 'fortification', 'rare'].forEach(function(lv) {
                    mHtml += '<tr>';
                    mHtml += '<td style="padding:8px;border:1px solid var(--hairline);font-weight:600;background:var(--canvas-soft);">' + levelNames[lv] + '</td>';
                    for (var p = 1; p <= 4; p++) {
                        var isHighlight = (lv === level && String(p) === perfV);
                        var bg = isHighlight ? 'background:#533afd15;color:#533afd;font-weight:600;' : '';
                        mHtml += '<td style="padding:8px;border:1px solid var(--hairline);' + bg + '">' + perfMatrix[lv][String(p)] + '</td>';
                    }
                    mHtml += '</tr>';
                });
                mHtml += '</table>';
                mHtml += '<div class="hint" style="margin-top:8px;">当前选择：<b style="color:var(--primary)">' + perfNames[perfV] + ' + ' + levelNames[level] + '</b> → 目标状态：<b>' + perfMatrix[level][perfV] + '</b></div>';
                matrixDiv.innerHTML = mHtml;

                // 荷载组合（5.4.1式）
                // S = γG·SGE + γEh·SEhk + γEv·SEvk + ψw·γw·Swk
                var gammaG = 1.2; // 重力荷载分项系数
                // 表5.4.1 地震作用分项系数
                // 原版(2016): γEh=1.3, γEv=1.3; 2024修订: γEh=1.4, γEv=1.4
                var ehMain = version === '2024' ? 1.4 : 1.3;
                var evMain = version === '2024' ? 1.4 : 1.3;
                var gammaEh, gammaEv, gammaW = 1.4;
                var versionLabel = version === '2024' ? '2024修订' : '2016原版';

                if (seisDir === 'h') {
                    gammaEh = ehMain; gammaEv = 0.0;
                } else if (seisDir === 'v') {
                    gammaEh = 0.0; gammaEv = evMain;
                } else if (seisDir === 'hv') {
                    gammaEh = ehMain; gammaEv = 0.5;
                } else { // vh
                    gammaEh = 0.5; gammaEv = evMain;
                }

                var S = gammaG * SGE + gammaEh * SEhk + gammaEv * SEvk + psi_w * gammaW * Swk;

                st.push('<div class="step"><b>① 性能目标确定</b></div>');
                st.push('<div class="step">　　选定性能目标：<b>' + perfNames[perfV] + '</b>；考虑地震水准：<b>' + levelNames[level] + '</b></div>');
                st.push('<div class="step">　　对应预期破坏状态：<b>' + perfMatrix[level][perfV] + '</b></div>');
                st.push('<div class="step">　　性能1：大震下仍基本弹性，构造等级=基本抗震构造(降二度，不低于6度)（需隔震/减震或低烈度大风地区）</div>');
                st.push('<div class="step">　　性能2：中震完好，大震可能屈服，构造等级=低延性构造(降一度，不低于6度)</div>');
                st.push('<div class="step">　　性能3：中震轻微塑性变形，大震明显塑性(降<5%)，构造等级=中等延性构造</div>');
                st.push('<div class="step">　　性能4：中震轻~中等损坏，大震不严重破坏(降<10%)，构造等级=高延性构造(按常规设计)</div>');

                st.push('<div class="step"><b>② 地震作用分项系数（表5.4.1，' + versionLabel + '）</b></div>');
                st.push('<div class="step">　　重力荷载分项系数 γ<sub>G</sub> = ' + gammaG + '（不利时取1.2，有利时取1.0）</div>');
                st.push('<div class="step">　　水平地震分项系数 γ<sub>Eh</sub> = ' + gammaEh + '</div>');
                st.push('<div class="step">　　竖向地震分项系数 γ<sub>Ev</sub> = ' + gammaEv + '</div>');
                st.push('<div class="step">　　风荷载分项系数 γ<sub>w</sub> = ' + gammaW + '；组合值系数 ψ<sub>w</sub> = ' + psi_w + '</div>');

                st.push('<div class="step"><b>③ 荷载效应基本组合（5.4.1式）</b></div>');
                st.push('<div class="step">　　S = γ<sub>G</sub>·S<sub>GE</sub> + γ<sub>Eh</sub>·S<sub>Ehk</sub> + γ<sub>Ev</sub>·S<sub>Evk</sub> + ψ<sub>w</sub>·γ<sub>w</sub>·S<sub>wk</sub></div>');
                st.push('<div class="step">　　S = ' + gammaG + '×' + SGE + ' + ' + gammaEh + '×' + SEhk + ' + ' + gammaEv + '×' + SEvk + ' + ' + psi_w + '×' + gammaW + '×' + Swk + '</div>');
                st.push('<div class="step">　　S = ' + (gammaG*SGE).toFixed(2) + ' + ' + (gammaEh*SEhk).toFixed(2) + ' + ' + (gammaEv*SEvk).toFixed(2) + ' + ' + (psi_w*gammaW*Swk).toFixed(2) + '</div>');
                st.push('<div class="step">　　<b>S = ' + S.toFixed(2) + ' kN·m</b></div>');

                // 性能验算
                st.push('<div class="step"><b>④ 性能目标验算</b></div>');
                var perfChecks = {
                    '1': { 'frequent': 'S ≤ R/γRE，层间位移 ≤ [Δue]（所有构件保持弹性）', 'fortification': 'S ≤ R/γRE（构件保持弹性）', 'rare': 'S ≤ R/γRE（基本保持弹性，细部构造仅最低要求）' },
                    '2': { 'frequent': 'S ≤ R/γRE（保持弹性）', 'fortification': 'S ≤ R/γRE（基本完好，不含抗震等级调整系数）', 'rare': '构件可能屈服，需低延性构造' },
                    '3': { 'frequent': 'S ≤ R/γRE（保持弹性）', 'fortification': '轻微塑性变形，不达屈服', 'rare': '明显塑性变形，需中等延性构造' },
                    '4': { 'frequent': 'S ≤ R/γRE（保持弹性）', 'fortification': '轻微至接近中等损坏，变形<3[Δue]', 'rare': '接近严重破坏，需高延性构造' }
                };
                st.push('<div class="step">　　' + perfNames[perfV] + ' + ' + levelNames[level] + ' 验算要求：</div>');
                st.push('<div class="step">　　　　' + perfChecks[perfV][level] + '</div>');

                // 2024修订补充：设防地震下需保持正常使用的建筑
                if (level === 'fortification' && (perfV === '1' || perfV === '2')) {
                    st.push('<div class="step"><b>⑤ 2024修订补充（3.10.3条第2)款）</b></div>');
                    st.push('<div class="step">　　预期地震下需保持正常使用的建筑：</div>');
                    st.push('<div class="step">　　　　竖向抗侧力构件应按不低于性能2规定设计</div>');
                    st.push('<div class="step">　　　　水平构件不宜低于性能3规定</div>');
                    st.push('<div class="step">　　　　尚需满足"强柱弱梁、强竖弱平"概念设计原则</div>');
                }

                // 5级破坏状态参考
                st.push('<div class="step"><b>' + (level === 'fortification' ? '⑤' : level === 'rare' ? '⑤' : '④') + ' 5级破坏状态参考</b></div>');
                st.push('<div class="step">　　基本完好：变形 < [Δue]，一般不需修理</div>');
                st.push('<div class="step">　　轻微损坏：变形 (1.5~2)[Δue]，稍加修理可继续使用</div>');
                st.push('<div class="step">　　中等破坏：变形 (3~4)[Δue]，需一般修理后使用</div>');
                st.push('<div class="step">　　严重破坏：变形 < 0.9[Δup]，应排险大修</div>');
                st.push('<div class="step">　　倒塌：变形 > [Δup]，需拆除</div>');
                st.push('<div class="step">　　注：个别<5%，部分<30%，多数≥50%</div>');

                // ⑥ 承载力抗震调整系数 γRE（表5.4.2）
                st.push('<div class="step"><b>⑥ 承载力抗震调整系数 γ<sub>RE</sub>（表5.4.2）</b></div>');
                st.push('<div class="step">　　<b>钢</b>：强度 0.75；柱、支撑稳定 0.80</div>');
                st.push('<div class="step">　　<b>砌体</b>：两端有构造柱/芯柱抗震墙受剪 0.9；其他抗震墙受剪 1.0</div>');
                st.push('<div class="step">　　<b>混凝土</b>：梁受弯 0.75；轴压比<0.15柱偏压 0.75；轴压比≥0.15柱偏压 0.80；抗震墙偏压 0.85；各类构件受剪/偏拉 0.85</div>');
                st.push('<div class="step">　　注：仅计算竖向地震作用时，各类构件 γ<sub>RE</sub> 均取 1.0（5.4.3条）</div>');
                st.push('<div class="step">　　截面验算公式：<b>S ≤ R/γ<sub>RE</sub></b>（5.4.2式）</div>');

                // ⑦ 弹性/弹塑性层间位移角限值（表5.5.1/5.5.5）
                st.push('<div class="step"><b>⑦ 层间位移角限值</b></div>');
                st.push('<div class="step">　　<b>弹性层间位移角限值 [θ<sub>e</sub>]（表5.5.1，多遇地震）：</b></div>');
                st.push('<div class="step">　　　　RC框架 1/550；框架-抗震墙/板柱-抗震墙/框架-核心筒 1/800</div>');
                st.push('<div class="step">　　　　RC抗震墙/筒中筒 1/1000；RC框支层 1/1000；多高层钢结构 1/250</div>');
                st.push('<div class="step">　　<b>弹塑性层间位移角限值 [θ<sub>p</sub>]（表5.5.5，罕遇地震）：</b></div>');
                st.push('<div class="step">　　　　单层RC柱排架 1/30；RC框架 1/50；底部框架砌体框架抗震墙 1/100</div>');
                st.push('<div class="step">　　　　RC框架-抗震墙/板柱-抗震墙/框架-核心筒 1/100；RC抗震墙/筒中筒 1/120；多高层钢结构 1/50</div>');
                st.push('<div class="step">　　注：RC框架结构轴压比<0.40时[θ<sub>p</sub>]可提高10%；箍筋体积配箍率比6.3.9条大30%时可提高20%，累计≤25%</div>');

                // ⑧ 楼层最小地震剪力系数（表5.2.5）
                st.push('<div class="step"><b>⑧ 楼层最小地震剪力系数 λ（表5.2.5）</b></div>');
                st.push('<div class="step">　　扭转效应明显或T<sub>1</sub>≤3.5s：6度0.008, 7度0.016(0.024), 8度0.032(0.048), 9度0.064</div>');
                st.push('<div class="step">　　T<sub>1</sub>>5.0s：6度0.006, 7度0.012(0.018), 8度0.024(0.036), 9度0.048</div>');
                st.push('<div class="step">　　注：括号内用于0.15g/0.30g地区；3.5s~5.0s之间插值；竖向不规则薄弱层乘1.15</div>');

                // ⑨ 附录M 三表详细
                st.push('<div class="step"><b>⑨ 附录M 性能设计三表（M.1.1-1/2/3）</b></div>');
                st.push('<div class="step">　　<b>表M.1.1-1 承载力参考指标：</b></div>');
                st.push('<div class="step">　　　　性能1：多遇→完好(常规设计)；设防→完好(按抗震等级调整)；罕遇→基本完好(按抗震等级调整)</div>');
                st.push('<div class="step">　　　　性能2：多遇→完好；设防→基本完好(不含抗震等级调整)；罕遇→轻~中等破坏(按极限值复核)</div>');
                st.push('<div class="step">　　　　性能3：多遇→完好；设防→轻微损坏(按标准值复核)；罕遇→中等破坏(达到极限值后降<5%)</div>');
                st.push('<div class="step">　　　　性能4：多遇→完好；设防→轻~中等破坏(按极限值复核)；罕遇→不严重破坏(达到极限值后降<10%)</div>');
                st.push('<div class="step">　　<b>表M.1.1-2 层间位移参考指标：</b></div>');
                st.push('<div class="step">　　　　性能1：多遇→远小于弹性限值；设防→小于弹性限值；罕遇→略大于弹性限值</div>');
                st.push('<div class="step">　　　　性能2：多遇→远小于弹性限值；设防→略大于弹性限值；罕遇→<2倍弹性限值</div>');
                st.push('<div class="step">　　　　性能3：多遇→明显小于弹性限值；设防→<2倍弹性限值；罕遇→约4倍弹性限值</div>');
                st.push('<div class="step">　　　　性能4：多遇→小于弹性限值；设防→<3倍弹性限值；罕遇→≤0.9倍塑性限值</div>');
                st.push('<div class="step">　　<b>表M.1.1-3 构造抗震等级：</b></div>');
                st.push('<div class="step">　　　　性能1：基本抗震构造(降二度，不低于6度，不发生脆性破坏)</div>');
                st.push('<div class="step">　　　　性能2：低延性构造(降一度，承载力高于多遇二度要求时可降二度，不低于6度)</div>');
                st.push('<div class="step">　　　　性能3：中等延性构造(承载力达到多遇一度要求时降一度，否则按常规)</div>');
                st.push('<div class="step">　　　　性能4：高延性构造(仍按常规设计规定采用)</div>');

                var html = resultRow('性能目标', perfNames[perfV]);
                html += resultRow('地震水准', levelNames[level]);
                html += resultRow('预期破坏状态', perfMatrix[level][perfV]);
                html += resultRow('荷载组合设计值 S', S.toFixed(2) + ' kN·m');
                html += resultRow('γ<sub>Eh</sub> / γ<sub>Ev</sub>', gammaEh + ' / ' + gammaEv + '（' + versionLabel + '）');
                html += resultRow('截面验算', 'S ≤ R/γ<sub>RE</sub>（γ<sub>RE</sub>见表5.4.2）');
                html += resultRow('位移限值', level === 'rare' ? '[θ<sub>p</sub>] 弹塑性（表5.5.5）' : '[θ<sub>e</sub>] 弹性（表5.5.1）');
                html += resultRow('最小剪力系数', 'V<sub>eki</sub> ≥ λG<sub>j</sub>（表5.2.5）');
                html += resultRow('验算要求', perfChecks[perfV][level]);
                html += resultRow('说明', badge('badge-ok', '性能化设计结果，需结合附录M详细方法'));
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
            }
            function reset() {
                document.getElementById('sp_perf').value = '3';
                document.getElementById('sp_intensity').value = 8;
                document.getElementById('sp_level').value = 'fortification';
                document.getElementById('sp_SGE').value = 500;
                document.getElementById('sp_SEhk').value = 800;
                document.getElementById('sp_SEvk').value = 0;
                document.getElementById('sp_Swk').value = 0;
                document.getElementById('sp_seis_dir').value = 'h';
                document.getElementById('sp_wind_ctrl').value = 0;
                document.getElementById('sp_version').value = '2024';
                calc();
            }
            document.getElementById('sp_calc').addEventListener('click', calc);
            document.getElementById('sp_reset').addEventListener('click', reset);
            document.getElementById('f-sp').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };

    window.TOOLS = window.TOOLS || {};
    window.TOOLS['seismic-perf'] = tool;
})();
