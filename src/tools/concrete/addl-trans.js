(function () {
    var tool = {
        title: '附加横向钢筋',
        sub: '梁中集中荷载处附加箍筋 / 吊筋 · GB/T 50010-2010（2024年版） 第 9.2.11 条',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '9.2.11',
            limitations: '梁中集中荷载作用处，附加箍筋/吊筋/组合',
            unit: 'Asv:mm², F:kN',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">集中荷载与主梁</div>' +
                '<form id="f-at"><div class="grid2">' +
                numField('at_F', '集中荷载设计值 F', 'kN', 200, '次梁传来的集中荷载设计值（包含恒+活）') +
                numField('at_hb', '主梁高度 h<sub>b</sub>', 'mm', 700) +
                numField('at_hs', '次梁高度 h<sub>s</sub>', 'mm', 500) +
                selField('at_type', '附加钢筋形式', opts([{v:'stir',t:'仅附加箍筋'},{v:'hanger',t:'仅吊筋'},{v:'both',t:'箍筋+吊筋组合'}], 'stir')) +
                selField('at_reb', '钢筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HPB300',t:'HPB300'}], 'HRB400')) +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">附加箍筋参数</div><div class="grid2">' +
                numField('at_ds', '箍筋直径 d', 'mm', 8) +
                numField('at_nleg', '箍筋肢数 n', '肢', 2, '双肢箍 = 2，四肢箍 = 4') +
                numField('at_s', '箍筋间距 s', 'mm', 50, '附加箍筋范围内的间距，一般 50mm') +
                numField('at_nset', '箍筋道数（一侧）', '道', 3, '集中荷载每侧附加箍筋道数，一般 2~3 道') +
                '</div></div>' +
                '<div class="panel"><div class="panel-title">吊筋参数</div><div class="grid2">' +
                numField('at_dh', '吊筋直径 d', 'mm', 16) +
                numField('at_nbar', '吊筋根数（一侧）', '根', 2, '每侧 2 根即共 2 根吊筋') +
                numField('at_alpha', '吊筋弯起角度 α', '°', 45, '一般 45°；梁高 > 800mm 用 60°') +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="at_calc">计算附加横向钢筋</button>' +
                '<button type="button" class="btn btn-secondary" id="at_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">附加横向钢筋验算结果</div><div id="at_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="at_proc"></div></div></div></div>';
        },
        bind: function () {
            function calc() {
                var out = document.getElementById('at_result');
                var proc = document.getElementById('at_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }

                var F = parseFloat(document.getElementById('at_F').value);
                var hb = parseFloat(document.getElementById('at_hb').value);
                var hs = parseFloat(document.getElementById('at_hs').value);
                var type = document.getElementById('at_type').value;
                var isHPB = document.getElementById('at_reb').value === 'HPB300';
                var fyv = isHPB ? 270 : (REBAR_FLEX[document.getElementById('at_reb').value].fy);
                var fy = fyv; // 吊筋同级别
                fyv = Math.min(fyv, 360); // 附加箍筋受剪强度按 4.2.3 上限

                var ds = parseFloat(document.getElementById('at_ds').value);
                var nleg = parseFloat(document.getElementById('at_nleg').value);
                var s = parseFloat(document.getElementById('at_s').value);
                var nset = parseFloat(document.getElementById('at_nset').value);

                var dh = parseFloat(document.getElementById('at_dh').value);
                var nbar = parseFloat(document.getElementById('at_nbar').value);
                var alpha_deg = parseFloat(document.getElementById('at_alpha').value);
                var alpha = alpha_deg * Math.PI / 180;

                if (!(F > 0)) return err('集中荷载必须为正数。');
                if (!(hb > 0 && hs > 0)) return err('梁高必须为正数。');
                if (nleg < 1) return err('箍筋肢数至少 1。');

                var st = [];
                st.push('<div class="step"><b>① 基本参数</b>　集中荷载 F = ' + F + ' kN；主梁高 h<sub>b</sub> = ' + hb + ' mm，次梁高 h<sub>s</sub> = ' + hs + ' mm；钢筋级别 f<sub>yv</sub> = f<sub>y</sub> = ' + fy + ' N/mm²。</div>');

                // 附加箍筋承载力
                // 每侧 nset 道 × nleg 肢，两侧共 2*nset 道
                // A_sv_total = 2 * nset * nleg * π d² / 4
                // F_sv = f_yv * A_sv_total
                var Asv_one = Math.PI * ds * ds / 4; // 单肢面积
                var Asv_total = 2 * nset * nleg * Asv_one; // 两侧总面积
                var F_sv = fyv * Asv_total / 1000; // kN

                // 吊筋承载力
                // 吊筋总根数（两侧之和）= 2 * nbar（每侧 nbar 根）
                // 吊筋斜截面受拉：F_hang = 2 * nbar * A_s_hang * fy * sin(α) 
                // （两边各 nbar 根，每根都有两个斜段承担拉力的垂直分量）
                // 公式：F ≤ 2 * A_sb * f_y * sinα（每根吊筋两端斜段）
                // 这里 nbar 是一侧根数，总根数是 2*nbar
                // 实际公式：吊筋承担的集中力 = nbar * 2 * fy * As_hang * sinα
                var Ashang_one = Math.PI * dh * dh / 4;
                var F_hang = 2 * nbar * Ashang_one * fy * Math.sin(alpha) / 1000; // kN （2 = 左右两个弯起段）

                // 附加横向钢筋总承载力
                var F_total = 0;
                if (type === 'stir') F_total = F_sv;
                else if (type === 'hanger') F_total = F_hang;
                else F_total = F_sv + F_hang;

                var ok = F_total >= F;

                st.push('<div class="step"><b>② 附加箍筋承载力</b>　两侧共 ' + (2*nset) + ' 道 × ' + nleg + ' 肢，每肢面积 = πd²/4 = ' + fmt(Asv_one, 1) + ' mm²；总面积 A<sub>sv</sub> = ' + fmt(Asv_total, 0) + ' mm²；F<sub>sv</sub> = f<sub>yv</sub>·A<sub>sv</sub> = <b>' + fmt(F_sv, 1) + ' kN</b></div>');
                if (type !== 'stir') {
                    st.push('<div class="step"><b>③ 吊筋承载力</b>　每侧 ' + nbar + ' 根，共 ' + (2*nbar) + ' 根；每根 A<sub>s</sub> = ' + fmt(Ashang_one, 1) + ' mm²，α = ' + alpha_deg + '°；F<sub>吊</sub> = 2·n·A<sub>s</sub>·f<sub>y</sub>·sinα = 2×' + nbar + '×' + fmt(Ashang_one,1) + '×' + fy + '×sin' + alpha_deg + '° = <b>' + fmt(F_hang, 1) + ' kN</b></div>');
                }
                st.push('<div class="step"><b>④ 总承载力</b>　F<sub>total</sub> = ' + fmt(F_total, 1) + ' kN ≥ F = ' + F + ' kN？' + (ok ? ' 是' : ' 否') + tag(ok ? 'ok' : 'err', ok ? '满足' : '不满足') + '</div>');

                // 配置范围提示
                // 附加横向钢筋应布置在长度 s = 2h1 + 3b 的范围内（9.2.11 条）
                // h1 = 主梁高 - 次梁高（从主梁顶到次梁底的次梁高度... 不对，是主次梁高差）
                var s_range = 2 * (hb - hs) + 3 * 50; // 简化 3b 取近似
                st.push('<div class="step"><b>⑤ 配置范围</b>　附加横向钢筋应布置在 s = 2h<sub>1</sub> + 3b 范围内（9.2.11 条）。h<sub>1</sub> = h<sub>b</sub> − h<sub>s</sub> = ' + (hb-hs) + ' mm；建议布置范围约 ' + (2*(hb-hs) + 150) + ' mm 左右，集中荷载每侧均匀布置。</div>');

                var html = resultRow('附加钢筋形式', type === 'stir' ? '仅附加箍筋' : type === 'hanger' ? '仅吊筋' : '箍筋 + 吊筋组合');
                html += resultRow('附加箍筋总承载力 F<sub>sv</sub>', fmt(F_sv, 1) + ' kN（两侧 ' + (2*nset) + ' 道 ' + nleg + ' 肢 φ' + ds + '）');
                if (type !== 'stir') html += resultRow('吊筋总承载力 F<sub>吊</sub>', fmt(F_hang, 1) + ' kN（每侧 ' + nbar + ' 根 φ' + dh + '，α=' + alpha_deg + '°）');
                html += resultRow('附加横向钢筋总承载力', '<span class="highlight">' + fmt(F_total, 1) + ' kN</span>');
                html += resultRow('集中荷载 F', F + ' kN');
                html += resultRow('判定', badge(ok ? 'badge-ok' : 'badge-err', ok ? '附加横向钢筋满足要求' : '不满足，应增加直径/道数/根数'));
                html += resultRow('建议布置范围', '集中荷载两侧各约 ' + (hb-hs + 75) + ' mm 范围内均匀布置');
                out.innerHTML = html;
                proc.innerHTML = st.join('');
                var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');

                window._AT_RESULT = {
                    F: F, hb: hb, hs: hs, type: type, fy: fy,
                    ds: ds, nleg: nleg, s: s, nset: nset,
                    dh: dh, nbar: nbar, alpha_deg: alpha_deg,
                    Asv_total: Asv_total, F_sv: F_sv,
                    Ashang_one: Ashang_one, F_hang: F_hang,
                    F_total: F_total, ok: ok
                };
            }

            document.getElementById('at_calc').addEventListener('click', calc);
            document.getElementById('at_reset').addEventListener('click', function () {
                var f = document.getElementById('f-at'); f.reset();
                document.getElementById('at_F').value = 200;
                document.getElementById('at_hb').value = 700;
                document.getElementById('at_hs').value = 500;
                document.getElementById('at_ds').value = 8;
                document.getElementById('at_nleg').value = 2;
                document.getElementById('at_s').value = 50;
                document.getElementById('at_nset').value = 3;
                document.getElementById('at_dh').value = 16;
                document.getElementById('at_nbar').value = 2;
                document.getElementById('at_alpha').value = 45;
                calc();
            });
            document.getElementById('f-at').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS = window.TOOLS || {};
    window.TOOLS['addl-trans'] = tool;
})();
