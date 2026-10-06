(function () {
    var tool = {
        title: '轴心受压柱承载力',
        sub: '普通箍筋柱 · GB/T 50010-2010（2024年版） 第 6.2.15 条',
        meta: {
            standard: 'GB/T 50010-2010（2024年版）混凝土结构设计标准',
            formulaSource: '6.2.15',
            limitations: '普通箍筋柱，轴心受压，矩形截面；非抗震构件的轴压及全部纵筋下限；一侧纵筋和抗震构造需另验',
            unit: 'N:kN, As:mm², b,h:mm',
            version: '1.0.0'
        },
        render: function () {
            return '<div class="panel"><div class="panel-title">截面、长细比与配筋</div>' +
                '<form id="f-col"><div class="grid2">' +
                numField('c_b', '截面短边尺寸 b', 'mm', 400) +
                numField('c_h', '截面长边尺寸 h', 'mm', 400) +
                numField('c_l0', '构件计算长度 l<sub>0</sub>', 'mm', 4000, '计算长度须按实际结构约束与第 6.2.20 条确定，不能统一按层高倍数取值') +
                selField('c_con', '混凝土强度等级', conOpts('C30')) +
                selField('c_reb', '纵筋级别', opts([{v:'HRB400',t:'HRB400'},{v:'HRB500',t:'HRB500'}], 'HRB400')) +
                numField('c_AsP', '全部纵筋面积 A<sub>s</sub>\u2032', 'mm²', 1256, '全部纵向钢筋总截面积（如 4φ20 = 1256 mm²）') +
                numField('c_N', '轴向压力设计值 N', 'kN', 1500) +
                '</div><div class="btn-group">' +
                '<button type="button" class="btn btn-primary" id="c_calc">计算柱承载力</button>' +
                '<button type="button" class="btn btn-secondary" id="c_reset">重置</button>' +
                '</div></form></div>' +
                '<div class="panel"><div class="panel-title">计算结果</div><div id="c_result"></div></div>' +
                '<div class="panel"><div class="proc-wrap"><div class="proc-head"><span>查看详细计算过程（可追溯）</span><span class="proc-copy-msg" style="display:none"></span><button type="button" class="proc-copy-btn" onclick="copyProc(this);event.stopPropagation();return false;">复制</button></div><div class="proc-body"><div id="c_proc"></div></div></div></div>';
        },
        bind: function () {
            function phiOf(l0b) {
                if (l0b <= PHI_L[0]) return PHI_V[0];
                if (l0b >= PHI_L[PHI_L.length - 1]) return PHI_V[PHI_V.length - 1];
                for (var i = 0; i < PHI_L.length - 1; i++) {
                    if (l0b <= PHI_L[i + 1]) {
                        var t = (l0b - PHI_L[i]) / (PHI_L[i + 1] - PHI_L[i]);
                        return PHI_V[i] + (PHI_V[i + 1] - PHI_V[i]) * t;
                    }
                }
                return 0.19;
            }
            function calc() {
                var out = document.getElementById('c_result'), proc = document.getElementById('c_proc');
                function err(m) { out.innerHTML = '<div class="error-box">' + m + '</div>'; proc.innerHTML = ''; return; }
                var b = parseFloat(document.getElementById('c_b').value);
                var h = parseFloat(document.getElementById('c_h').value);
                var l0 = parseFloat(document.getElementById('c_l0').value);
                var con = CONCRETE[document.getElementById('c_con').value];
                var reb = REBAR_FLEX[document.getElementById('c_reb').value];
                var materialError = concreteRebarError(con, reb);
                if (materialError) return err(materialError);
                var AsP = parseFloat(document.getElementById('c_AsP').value);
                var N = parseFloat(document.getElementById('c_N').value);
                if (!(b > 0 && h > 0)) return err('截面尺寸必须为正数。');
                if (!(l0 > 0)) return err('计算长度 l<sub>0</sub> 必须为正数。');
                if (!(AsP >= 0)) return err('纵筋面积不能为负。');
                if (!(N >= 0)) return err('轴力设计值不能为负。');
                var A = b * h, fc = con.fc, fyp = Math.min(reb.fyp, 400);
                if (!(AsP < A)) return err('纵筋面积必须小于构件全截面面积。');
                var lb = l0 / Math.min(b, h);
                if (lb > 50) return err('长细比超过表 6.2.15 的范围，需专项稳定分析。');
                var phi = phiOf(lb);
                var rhoP = AsP / A;
                var useArea = rhoP > 0.03 ? A - AsP : A;
                var Nu = 0.9 * phi * (fc * useArea + fyp * AsP) / 1000;
                var st = [];
                st.push('<div class="step"><b>① 截面参数</b>　A = b×h = ' + fmt(A,0) + ' mm²；l<sub>0</sub>/b = ' + fmt(lb,2) + '；f<sub>c</sub>=' + fc + '，f<sub>y</sub>\u2032=' + fyp + ' N/mm²。</div>');
                st.push('<div class="step"><b>② 稳定系数</b>　按表 6.2.15 插值，l<sub>0</sub>/b = ' + fmt(lb,1) + ' ⇒ <b>φ = ' + fmt(phi,3) + '</b>' + (rhoP > 0.03 ? '（配筋率 &gt; 3%，A 改用净截面 A−A<sub>s</sub>\u2032）' : '') + '</div>');
                st.push('<div class="step"><b>③ 轴压承载力</b>　N<sub>u</sub> = 0.9φ(f<sub>c</sub>' + (rhoP > 0.03 ? '(A−A<sub>s</sub>\u2032)' : 'A') + ' + f<sub>y</sub>\u2032A<sub>s</sub>\u2032) = 0.9×' + fmt(phi,3) + '×(' + fc + '×' + fmt(useArea,0) + ' + ' + fyp + '×' + AsP + ') = <b>' + fmt(Nu,1) + ' kN</b></div>');
                 var ok = N <= Nu;
                 st.push('<div class="step"><b>④ 承载力验算</b>　N = ' + fmt(N,1) + ' kN ' + (ok ? '≤' : '&gt;') + ' N<sub>u</sub> = ' + fmt(Nu,1) + ' kN ⇒ ' + (ok ? '满足' : '不满足') + (ok ? tag('ok','满足') : tag('err','不满足')) + '</div>');
                 var rhoMinAll = COLUMN_RHOMIN[document.getElementById('c_reb').value] || 0.0055;
                 var AsMinAll = rhoMinAll * A, AsMinSide = 0.002 * A;
                 var rhoOk = AsP >= AsMinAll;
                 st.push('<div class="step"><b>⑤ 最小配筋率（GB 55008-2021 表 4.4.6）</b>　全部纵筋 ρ<sub>min</sub> = ' + fmt(rhoMinAll*100,2) + '% ⇒ A<sub>s,min</sub> = ' + fmt(AsMinAll,0) + ' mm²；一侧 0.2% ⇒ ' + fmt(AsMinSide,0) + ' mm²；A<sub>s</sub>\u2032 = ' + AsP + ' mm²（需按实际布置另验）；全部纵筋 ⇒ ' + (rhoOk ? '满足' : '不满足') + (rhoOk ? tag('ok','满足') : tag('err','配筋不足')) + '</div>');
                 var need = (N * 1000 / (0.9 * phi) - fc * A) / fyp;
                 if (need > 0.03 * A) need = (N * 1000 / (0.9 * phi) - fc * A) / (fyp - fc);
                 if (need < AsMinAll) need = AsMinAll;
                 var html = resultRow('长细比 l<sub>0</sub>/b', fmt(lb,1));
                 html += resultRow('稳定系数 φ（表 6.2.15）', fmt(phi,3));
                 html += resultRow('轴压承载力 N<sub>u</sub>', '<span class="highlight">' + fmt(Nu,1) + ' kN</span>');
                 html += resultRow('纵筋配筋率 ρ\u2032', fmt(rhoP*100,2) + '%（全部纵筋 ρ<sub>min</sub>=' + fmt(rhoMinAll*100,2) + '%）');
                 html += resultRow('所需纵筋面积 A<sub>s</sub>\u2032,req', fmt(Math.max(0, need),0) + ' mm²');
                 html += resultRow('判定', ok && rhoOk ? badge('badge-ok', '本项轴压与全部纵筋下限满足；一侧配筋、抗震及构造另验') : (!ok ? badge('badge-err', '不满足：N &gt; N<sub>u</sub>') : badge('badge-warn', '承载力满足，但配筋率不足')));
                 out.innerHTML = html; proc.innerHTML = st.join('');
                 var _p = proc ? proc.closest('.proc-wrap') : document.querySelector('#view .proc-wrap'); if (_p) _p.classList.add('open');
                 window._CA_RESULT = {
                      b: b, h: h, l0: l0, N: N,
                      conGrade: document.getElementById('c_con').value,
                      rebGrade: document.getElementById('c_reb').value,
                      fc: fc, fyp: fyp, A: A, AsP: AsP, lambda: lb, phi: phi,
                      Nu: Nu, ok: ok, rhoP: rhoP, rhoOk: rhoOk, steps: st.join('')
                  };
             }
            function reset() {
                ['c_b','c_h','c_l0','c_AsP','c_N'].forEach(function (id) { document.getElementById(id).value = { c_b:400, c_h:400, c_l0:4000, c_AsP:1256, c_N:1500 }[id]; });
                document.getElementById('c_con').value = 'C30'; document.getElementById('c_reb').value = 'HRB400';
                calc();
            }
            document.getElementById('c_calc').addEventListener('click', calc);
            document.getElementById('c_reset').addEventListener('click', reset);
            document.getElementById('f-col').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); calc(); } });
            calc();
        }
    };
    window.TOOLS['column-axial'] = tool;
})();
