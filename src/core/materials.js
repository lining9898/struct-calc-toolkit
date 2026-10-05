/* ============================================================
 *  core/materials.js — 材料与截面数据库
 * ------------------------------------------------------------
 *  混凝土 / 钢筋 / 砌体 / 钢材 / 螺栓 / 焊缝等材料强度取值，
 *  型钢截面特性表（H 型钢、工字钢）与查表辅助函数。
 *
 *  【依据与核对状态】(2026-09-23 依据规范正文逐值核对)
 *  · 混凝土 fc / ft / ftk：GB/T 50010-2010（2024年版）《混凝土结构设计标准》
 *    表 4.1.4-1 / 表 4.1.4-2（强度设计值）与表 4.1.3-1（强度标准值）——已逐值核对一致。
 *  · 钢筋 fy / fyp：GB/T 50010-2010（2024年版）表 4.2.3-1——已核对。
 *    其中 HRB500 的 fy = 435 N/mm²（= f_yk 500 / 1.15），注意这是设计值不是标准值。
 *  · 受压构件最小配筋率 COLUMN_RHOMIN：GB 55008-2021 表 4.4.6——已核对。
 *
 *  【已知边界 —— 请勿擅自扩展】
 *  1. 本表只提供 C20 ~ C50。未提供 C55 及以上，原因是第 6.2 节中
 *     α₁ / β₁ / ε_cu 随强度等级的折减规则尚未与正文核对；在 C50 及以下
 *     现行取值 α₁ = 1.0、β₁ = 0.80、ε_cu = 0.0033 与现行规范一致。
 *     补充高强等级前必须先核对第 6.2 节，否则不得写入新的 alpha1/beta1/ecu。
 *  2. C20 不出现在 conOpts 下拉中：第 4.1.2 条规定钢筋混凝土结构的
 *     混凝土强度等级不应低于 C25（见 calculator.js）。本表保留 C20 数据
 *     仅为兼容旧既有代码取值，界面已不可选。
 * ============================================================ */
/* ===================== 共享材料数据（GB/T 50010-2010（2024年版）） ===================== */
var CONCRETE = {
    'C20': { fc: 9.6,  ft: 1.10, ftk: 1.54, alpha1: 1.0, beta1: 0.80, ecu: 0.0033 },
    'C25': { fc: 11.9, ft: 1.27, ftk: 1.78, alpha1: 1.0, beta1: 0.80, ecu: 0.0033 },
    'C30': { fc: 14.3, ft: 1.43, ftk: 2.01, alpha1: 1.0, beta1: 0.80, ecu: 0.0033 },
    'C35': { fc: 16.7, ft: 1.57, ftk: 2.20, alpha1: 1.0, beta1: 0.80, ecu: 0.0033 },
    'C40': { fc: 19.1, ft: 1.71, ftk: 2.39, alpha1: 1.0, beta1: 0.80, ecu: 0.0033 },
    'C45': { fc: 21.2, ft: 1.80, ftk: 2.51, alpha1: 1.0, beta1: 0.80, ecu: 0.0033 },
    'C50': { fc: 23.1, ft: 1.89, ftk: 2.64, alpha1: 1.0, beta1: 0.80, ecu: 0.0033 }
};
var REBAR_FLEX = { 'HRB400': { fy: 360, fyp: 360, es: 200000 }, 'HRB500': { fy: 435, fyp: 410, es: 200000 } };
var REBAR_STIRRUP = { 'HPB300': { fy: 270 }, 'HRB400': { fy: 360 }, 'HRB500': { fy: 435 } };
var COLUMN_RHOMIN = { 'HRB400': 0.0055, 'HRB500': 0.0050 };
// 轴压柱稳定系数 φ（GB/T 50010-2010（2024年版）表 6.2.15，按 l0/b）
var PHI_L = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50];
var PHI_V = [1.00, 0.98, 0.95, 0.92, 0.87, 0.81, 0.75, 0.70, 0.65, 0.60, 0.56, 0.52, 0.48, 0.44, 0.40, 0.36, 0.32, 0.29, 0.26, 0.23, 0.21, 0.19];

/* ===================== 砌体材料强度（GB 50003-2011 表 3.2.1） ===================== */
/* 烧结普通砖 / 烧结多孔砖砌体的抗压强度设计值 f (MPa) */
var MAS_F_CLAY = {
    // 砌体强度等级: { 砂浆强度等级: f }
    'MU30': { 'M15': 3.94, 'M10': 3.27, 'M7.5': 2.93, 'M5': 2.59, 'M2.5': 2.26, 'M0': 1.15 },
    'MU25': { 'M15': 3.60, 'M10': 2.98, 'M7.5': 2.67, 'M5': 2.37, 'M2.5': 2.06, 'M0': 1.05 },
    'MU20': { 'M15': 3.22, 'M10': 2.67, 'M7.5': 2.39, 'M5': 2.12, 'M2.5': 1.84, 'M0': 0.94 },
    'MU15': { 'M10': 2.31, 'M7.5': 2.07, 'M5': 1.83, 'M2.5': 1.60, 'M0': 0.82 },
    'MU10': { 'M10': 1.89, 'M7.5': 1.69, 'M5': 1.50, 'M2.5': 1.30, 'M0': 0.67 }
};
/* 混凝土小型空心砌块砌体的抗压强度设计值 f (MPa) */
var MAS_F_BLOCK = {
    'MU20': { 'Mb15': 5.68, 'Mb10': 4.95, 'Mb7.5': 4.44, 'Mb5': 3.94, 'M0': 2.33 },
    'MU15': { 'Mb15': 4.61, 'Mb10': 4.02, 'Mb7.5': 3.61, 'Mb5': 3.20, 'M0': 1.89 },
    'MU10': { 'Mb10': 2.79, 'Mb7.5': 2.50, 'Mb5': 2.22, 'M0': 1.40 },
    'MU7.5': { 'Mb7.5': 1.93, 'Mb5': 1.71, 'M0': 1.08 }
};
/* 蒸压灰砂砖 / 蒸压粉煤灰砖砌体的抗压强度设计值 f (MPa) */
var MAS_F_LIME = {
    'MU25': { 'M15': 3.60, 'M10': 2.98, 'M7.5': 2.68, 'M5': 2.37, 'M0': 1.05 },
    'MU20': { 'M15': 3.20, 'M10': 2.65, 'M7.5': 2.39, 'M5': 2.12, 'M0': 0.94 },
    'MU15': { 'M10': 2.31, 'M7.5': 2.07, 'M5': 1.83, 'M0': 0.82 },
    'MU10': { 'M10': 1.89, 'M7.5': 1.69, 'M5': 1.50, 'M0': 0.67 }
};
/* 毛石砌体抗压强度设计值 f (MPa) — 用于过梁/圈梁/挑梁中部分材料 */
var MAS_F_STONE = {
    'MU100': { 'M10': 1.27, 'M7.5': 1.12, 'M5': 0.98, 'M2.5': 0.82 },
    'MU80':  { 'M10': 1.13, 'M7.5': 1.00, 'M5': 0.86, 'M2.5': 0.73 },
    'MU60':  { 'M10': 0.96, 'M7.5': 0.85, 'M5': 0.73, 'M2.5': 0.61 }
};
/* 砌体类型元数据 */
var MASONRY_TYPES = {
    'clay':  { name: '烧结普通砖/多孔砖', table: MAS_F_CLAY,  morLabels: ['M15','M10','M7.5','M5','M2.5'], unitLabels: ['MU30','MU25','MU20','MU15','MU10'] },
    'block': { name: '混凝土小型空心砌块', table: MAS_F_BLOCK, morLabels: ['Mb15','Mb10','Mb7.5','Mb5'], unitLabels: ['MU20','MU15','MU10','MU7.5'] },
    'lime':  { name: '蒸压灰砂/粉煤灰砖', table: MAS_F_LIME, morLabels: ['M15','M10','M7.5','M5'], unitLabels: ['MU25','MU20','MU15','MU10'] }
};
/* 砌体弯曲抗拉/抗剪强度设计值（烧结普通砖/多孔砖，表 3.2.2，沿齿缝） */
var MAS_FT_M_CLAY = { 'M10': 0.19, 'M7.5': 0.16, 'M5': 0.13, 'M2.5': 0.09 };
var MAS_FV_CLAY   = { 'M10': 0.17, 'M7.5': 0.14, 'M5': 0.11, 'M2.5': 0.08 };

/* ===================== 钢结构材料数据（GB 50017-2017） ===================== */
// 钢材强度设计值（厚度≤16mm）：f 抗拉/压/弯，fv 抗剪，fce 端面承压
var STEEL = {
    'Q235': { f: 215, fv: 125, fce: 325, E: 206000, fy: 235, fu: 370 },
    'Q355': { f: 305, fv: 175, fce: 400, E: 206000, fy: 355, fu: 470 },
    'Q390': { f: 350, fv: 200, fce: 450, E: 206000, fy: 390, fu: 490 },
    'Q420': { f: 380, fv: 220, fce: 480, E: 206000, fy: 420, fu: 520 }
};
// 角焊缝强度设计值 (MPa) — 按焊条与母材匹配
var WELD_F = {
    'Q235_E43': { ff: 160, ft: 185, fv: 125 },     // E43 型焊条 / Q235
    'Q355_E50': { ff: 200, ft: 205, fv: 145 },     // E50 型焊条 / Q355
    'Q390_E50': { ff: 200, ft: 210, fv: 155 },     // E50 型焊条 / Q390
    'Q420_E55': { ff: 220, ft: 230, fv: 165 }      // E55 型焊条 / Q420
};
// 普通螺栓强度设计值 fvb 抗剪, ftb 抗拉, fcb 承压 (MPa)
var BOLT_F = {
    'C_4.6': { fvb: 140, ftb: 170, fcb: 305, desc: 'C级 4.6级' },
    'C_4.8': { fvb: 140, ftb: 170, fcb: 305, desc: 'C级 4.8级' },
    'A_B_5.6': { fvb: 190, ftb: 210, fcb: 405, desc: 'A/B级 5.6级' },
    'A_B_8.8': { fvb: 320, ftb: 400, fcb: 510, desc: 'A/B级 8.8级' }
};
// 高强度螺栓预拉力 P (kN) — GB 50017-2017 表 11.4.2-1
var BOLT_P = {
    '8.8': { M16: 80, M20: 125, M22: 150, M24: 175, M27: 230, M30: 280 },
    '10.9': { M16: 100, M20: 155, M22: 190, M24: 225, M27: 290, M30: 355 },
    '10.9S': { M16: 100, M20: 155, M22: 190, M24: 225, M27: 290, M30: 355 }
};
// 摩擦面抗滑移系数 μ 参考值
var MU_REF = {
    '喷砂_除锈': { 'Q235': 0.45, 'Q355': 0.50, 'Q390': 0.50, 'Q420': 0.50 },
    '喷砂后涂无机富锌': { 'Q235': 0.35, 'Q355': 0.40, 'Q390': 0.40, 'Q420': 0.40 },
    '钢丝刷除锈': { 'Q235': 0.30, 'Q355': 0.35, 'Q390': 0.35, 'Q420': 0.35 }
};
// 热轧H型钢截面参数（常用规格）：h 高度, b 翼缘宽, tw 腹板厚, tf 翼缘厚
//   A 截面面积(cm²), Ix/Wx/Iy/Wy (cm⁴/cm³), 自重(kg/m)
var H_SECTIONS = [
    { name: 'HW100×100', h: 100, b: 100, tw: 6, tf: 8, A: 21.90, Ix: 383, Wx: 76.5, Iy: 134, Wy: 26.7, w: 17.2 },
    { name: 'HW150×150', h: 150, b: 150, tw: 7, tf: 10, A: 40.55, Ix: 1660, Wx: 221, Iy: 564, Wy: 75.2, w: 31.9 },
    { name: 'HW200×200', h: 200, b: 200, tw: 8, tf: 12, A: 64.28, Ix: 4770, Wx: 477, Iy: 1600, Wy: 160, w: 50.5 },
    { name: 'HW250×250', h: 250, b: 250, tw: 9, tf: 14, A: 92.18, Ix: 10800, Wx: 867, Iy: 3650, Wy: 292, w: 72.4 },
    { name: 'HW300×300', h: 300, b: 300, tw: 10, tf: 15, A: 120.4, Ix: 20500, Wx: 1370, Iy: 6760, Wy: 451, w: 94.5 },
    { name: 'HM300×200', h: 294, b: 200, tw: 8, tf: 12, A: 73.03, Ix: 11400, Wx: 779, Iy: 1600, Wy: 160, w: 57.3 },
    { name: 'HM350×250', h: 340, b: 250, tw: 9, tf: 14, A: 101.5, Ix: 21700, Wx: 1280, Iy: 3650, Wy: 292, w: 79.7 },
    { name: 'HM400×300', h: 390, b: 300, tw: 10, tf: 16, A: 136.7, Ix: 38900, Wx: 2000, Iy: 7210, Wy: 481, w: 107 },
    { name: 'HN300×150', h: 300, b: 150, tw: 6.5, tf: 9, A: 47.53, Ix: 7350, Wx: 490, Iy: 508, Wy: 67.7, w: 37.3 },
    { name: 'HN350×175', h: 350, b: 175, tw: 7, tf: 11, A: 63.66, Ix: 13700, Wx: 782, Iy: 985, Wy: 113, w: 50.0 },
    { name: 'HN400×200', h: 400, b: 200, tw: 8, tf: 13, A: 84.12, Ix: 23700, Wx: 1190, Iy: 1740, Wy: 174, w: 66.0 },
    { name: 'HN450×200', h: 450, b: 200, tw: 9, tf: 14, A: 97.41, Ix: 33700, Wx: 1500, Iy: 1870, Wy: 187, w: 76.5 },
    { name: 'HN500×200', h: 500, b: 200, tw: 10, tf: 16, A: 114.2, Ix: 47800, Wx: 1910, Iy: 2140, Wy: 214, w: 89.6 },
    { name: 'HN600×200', h: 596, b: 199, tw: 10, tf: 15, A: 121.2, Ix: 69300, Wx: 2330, Iy: 1980, Wy: 199, w: 95.1 },
    { name: 'HN700×300', h: 700, b: 300, tw: 13, tf: 24, A: 235.5, Ix: 204000, Wx: 5830, Iy: 10800, Wy: 720, w: 185 }
];
// 热轧工字钢截面参数
var I_SECTIONS = [
    { name: 'I20a', h: 200, b: 100, tw: 7, tf: 11.4, A: 35.578, Ix: 2370, Wx: 237, Iy: 158, Wy: 31.5, w: 27.929 },
    { name: 'I22a', h: 220, b: 110, tw: 7.5, tf: 12.3, A: 42.128, Ix: 3400, Wx: 309, Iy: 225, Wy: 40.9, w: 33.070 },
    { name: 'I25a', h: 250, b: 116, tw: 8, tf: 13, A: 48.541, Ix: 5020, Wx: 402, Iy: 280, Wy: 48.3, w: 38.105 },
    { name: 'I28a', h: 280, b: 122, tw: 8.5, tf: 13.7, A: 55.404, Ix: 7110, Wx: 508, Iy: 344, Wy: 56.4, w: 43.492 },
    { name: 'I32a', h: 320, b: 130, tw: 9.5, tf: 15, A: 67.156, Ix: 11100, Wx: 692, Iy: 460, Wy: 70.8, w: 52.717 },
    { name: 'I36a', h: 360, b: 136, tw: 10, tf: 15.8, A: 76.48, Ix: 15800, Wx: 875, Iy: 552, Wy: 81.2, w: 60.037 },
    { name: 'I40a', h: 400, b: 142, tw: 10.5, tf: 16.5, A: 86.112, Ix: 21700, Wx: 1090, Iy: 660, Wy: 93.2, w: 67.598 },
    { name: 'I45a', h: 450, b: 150, tw: 11.5, tf: 18, A: 102.488, Ix: 32200, Wx: 1430, Iy: 855, Wy: 114, w: 80.420 },
    { name: 'I50a', h: 500, b: 132, tw: 12, tf: 20.2, A: 119.254, Ix: 46500, Wx: 1860, Iy: 1120, Wy: 170, w: 93.654 }
];

function steelOpts() {
    return Object.keys(STEEL).map(function (k) { return { v: k, t: k }; });
}
function hSectionOpts(def) {
    return opts(H_SECTIONS.map(function (s) { return { v: s.name, t: s.name + ' (' + fmt(s.h,0) + '×' + fmt(s.b,0) + ')' }; }), def);
}
function iSectionOpts(def) {
    return opts(I_SECTIONS.map(function (s) { return { v: s.name, t: s.name + ' (' + fmt(s.h,0) + '×' + fmt(s.b,0) + ')' }; }), def);
}
function getHSection(name) {
    for (var i = 0; i < H_SECTIONS.length; i++) if (H_SECTIONS[i].name === name) return H_SECTIONS[i];
    return null;
}
function getISection(name) {
    for (var i = 0; i < I_SECTIONS.length; i++) if (I_SECTIONS[i].name === name) return I_SECTIONS[i];
    return null;
}
// 轴压稳定系数 φ — 按 a/b/c/d 类截面，GB 50017-2017 附录 D
// 这里提供 b 类截面 φ 值表（按 λ 长细比，fy=235）

/* ============================================================
 *  抗震设防参数速查表 — GB/T 50011-2010（2024年版）(2016) 附录A 摘录
 *  ------------------------------------------------------------
 *  字段：name 城镇名 / intensity 抗震设防烈度（度，含 7.5、8.5 表示
 *  7 度 0.15g、8 度 0.30g）/ accel 设计基本地震加速度(g) /
 *  group 设计地震分组（1、2、3）。
 *  取值口径：附录A 各城镇「中心地区」的取值；同一城市分区取值不同时，
 *  按市中心所在市辖区取值（如宁波取海曙区 6 度 0.05g 第一组）。
 *  本表为常用城镇摘录，工程使用前请核对附录A 原文与地方抗震设防要求。
 * ============================================================ */
var CITY_SEISMIC = [
    /* ——— 首都与直辖市 ——— */
    { name: '北京', intensity: '8', accel: 0.20, group: 1 },
    { name: '天津', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '上海', intensity: '7', accel: 0.10, group: 1 },
    { name: '重庆', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 河北 ——— */
    { name: '石家庄', intensity: '7', accel: 0.10, group: 2 },
    { name: '唐山', intensity: '8', accel: 0.20, group: 1 },
    { name: '保定', intensity: '7', accel: 0.10, group: 2 },
    { name: '邯郸', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '廊坊', intensity: '8', accel: 0.20, group: 2 },
    { name: '秦皇岛', intensity: '7', accel: 0.10, group: 3 },
    { name: '张家口', intensity: '7', accel: 0.10, group: 1 },
    { name: '沧州', intensity: '7', accel: 0.10, group: 2 },
    { name: '邢台', intensity: '7', accel: 0.10, group: 2 },
    { name: '衡水', intensity: '7', accel: 0.10, group: 2 },
    /* ——— 山西 ——— */
    { name: '太原', intensity: '8', accel: 0.20, group: 1 },
    { name: '大同', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '临汾', intensity: '8', accel: 0.20, group: 1 },
    { name: '长治', intensity: '7', accel: 0.10, group: 2 },
    { name: '阳泉', intensity: '7', accel: 0.10, group: 2 },
    { name: '晋中', intensity: '8', accel: 0.20, group: 1 },
    /* ——— 内蒙古 ——— */
    { name: '呼和浩特', intensity: '8', accel: 0.20, group: 1 },
    { name: '包头', intensity: '8', accel: 0.20, group: 1 },
    { name: '乌海', intensity: '8', accel: 0.20, group: 1 },
    { name: '赤峰', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '通辽', intensity: '7', accel: 0.10, group: 1 },
    { name: '鄂尔多斯', intensity: '7', accel: 0.10, group: 3 },
    /* ——— 辽宁 ——— */
    { name: '沈阳', intensity: '7', accel: 0.10, group: 1 },
    { name: '大连', intensity: '7', accel: 0.10, group: 2 },
    { name: '鞍山', intensity: '7', accel: 0.10, group: 1 },
    { name: '营口', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '丹东', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '抚顺', intensity: '7', accel: 0.10, group: 1 },
    { name: '锦州', intensity: '6', accel: 0.05, group: 2 },
    { name: '本溪', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 吉林 ——— */
    { name: '长春', intensity: '7', accel: 0.10, group: 1 },
    { name: '吉林', intensity: '7', accel: 0.10, group: 1 },
    { name: '松原', intensity: '8', accel: 0.20, group: 1 },
    { name: '四平', intensity: '6', accel: 0.05, group: 1 },
    { name: '白城', intensity: '7', accel: 0.10, group: 1 },
    /* ——— 黑龙江 ——— */
    { name: '哈尔滨', intensity: '6', accel: 0.05, group: 1 },
    { name: '齐齐哈尔', intensity: '6', accel: 0.05, group: 1 },
    { name: '大庆', intensity: '6', accel: 0.05, group: 1 },
    { name: '牡丹江', intensity: '6', accel: 0.05, group: 1 },
    { name: '绥化', intensity: '7', accel: 0.10, group: 1 },
    { name: '佳木斯', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 江苏 ——— */
    { name: '南京', intensity: '7', accel: 0.10, group: 1 },
    { name: '苏州', intensity: '6', accel: 0.05, group: 1 },
    { name: '无锡', intensity: '6', accel: 0.05, group: 1 },
    { name: '常州', intensity: '7', accel: 0.10, group: 1 },
    { name: '徐州', intensity: '7', accel: 0.10, group: 2 },
    { name: '扬州', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '镇江', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '南通', intensity: '6', accel: 0.05, group: 2 },
    { name: '连云港', intensity: '7', accel: 0.10, group: 3 },
    { name: '宿迁', intensity: '8.5', accel: 0.30, group: 1 },
    { name: '盐城', intensity: '7', accel: 0.10, group: 2 },
    { name: '淮安', intensity: '7', accel: 0.10, group: 2 },
    { name: '泰州', intensity: '7', accel: 0.10, group: 1 },
    /* ——— 浙江 ——— */
    { name: '杭州', intensity: '6', accel: 0.05, group: 1 },
    { name: '宁波', intensity: '6', accel: 0.05, group: 1 },
    { name: '温州', intensity: '6', accel: 0.05, group: 1 },
    { name: '绍兴', intensity: '6', accel: 0.05, group: 1 },
    { name: '嘉兴', intensity: '6', accel: 0.05, group: 1 },
    { name: '湖州', intensity: '6', accel: 0.05, group: 1 },
    { name: '舟山', intensity: '7', accel: 0.10, group: 1 },
    { name: '金华', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 安徽 ——— */
    { name: '合肥', intensity: '7', accel: 0.10, group: 1 },
    { name: '蚌埠', intensity: '7', accel: 0.10, group: 1 },
    { name: '阜阳', intensity: '7', accel: 0.10, group: 1 },
    { name: '淮南', intensity: '7', accel: 0.10, group: 1 },
    { name: '安庆', intensity: '7', accel: 0.10, group: 1 },
    { name: '六安', intensity: '7', accel: 0.10, group: 1 },
    { name: '芜湖', intensity: '6', accel: 0.05, group: 1 },
    { name: '马鞍山', intensity: '6', accel: 0.05, group: 1 },
    { name: '淮北', intensity: '6', accel: 0.05, group: 3 },
    { name: '宿州', intensity: '6', accel: 0.05, group: 3 },
    { name: '铜陵', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 福建 ——— */
    { name: '福州', intensity: '7', accel: 0.10, group: 2 },
    { name: '厦门', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '泉州', intensity: '7.5', accel: 0.15, group: 3 },
    { name: '漳州', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '莆田', intensity: '7', accel: 0.10, group: 3 },
    { name: '龙岩', intensity: '6', accel: 0.05, group: 1 },
    { name: '三明', intensity: '6', accel: 0.05, group: 1 },
    { name: '宁德', intensity: '6', accel: 0.05, group: 1 },
    { name: '南平', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 江西 ——— */
    { name: '南昌', intensity: '6', accel: 0.05, group: 1 },
    { name: '九江', intensity: '6', accel: 0.05, group: 1 },
    { name: '赣州', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 山东 ——— */
    { name: '济南', intensity: '6', accel: 0.05, group: 3 },
    { name: '青岛', intensity: '6', accel: 0.05, group: 3 },
    { name: '烟台', intensity: '7', accel: 0.10, group: 1 },
    { name: '威海', intensity: '7', accel: 0.10, group: 1 },
    { name: '临沂', intensity: '8', accel: 0.20, group: 1 },
    { name: '潍坊', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '淄博', intensity: '7', accel: 0.10, group: 2 },
    { name: '泰安', intensity: '6', accel: 0.05, group: 3 },
    { name: '济宁', intensity: '6', accel: 0.05, group: 3 },
    { name: '枣庄', intensity: '7', accel: 0.10, group: 2 },
    { name: '东营', intensity: '7', accel: 0.10, group: 3 },
    { name: '日照', intensity: '7', accel: 0.10, group: 3 },
    { name: '德州', intensity: '6', accel: 0.05, group: 2 },
    { name: '聊城', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '菏泽', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '滨州', intensity: '7', accel: 0.10, group: 3 },
    /* ——— 河南 ——— */
    { name: '郑州', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '洛阳', intensity: '7', accel: 0.10, group: 2 },
    { name: '开封', intensity: '7', accel: 0.10, group: 2 },
    { name: '新乡', intensity: '8', accel: 0.20, group: 1 },
    { name: '安阳', intensity: '8', accel: 0.20, group: 1 },
    { name: '焦作', intensity: '7', accel: 0.10, group: 2 },
    { name: '南阳', intensity: '7', accel: 0.10, group: 1 },
    { name: '许昌', intensity: '7', accel: 0.10, group: 1 },
    { name: '平顶山', intensity: '6', accel: 0.05, group: 1 },
    { name: '信阳', intensity: '6', accel: 0.05, group: 1 },
    { name: '商丘', intensity: '6', accel: 0.05, group: 2 },
    { name: '濮阳', intensity: '7.5', accel: 0.15, group: 2 },
    /* ——— 湖北 ——— */
    { name: '武汉', intensity: '6', accel: 0.05, group: 1 },
    { name: '宜昌', intensity: '6', accel: 0.05, group: 1 },
    { name: '襄阳', intensity: '6', accel: 0.05, group: 1 },
    { name: '荆州', intensity: '6', accel: 0.05, group: 1 },
    { name: '十堰', intensity: '6', accel: 0.05, group: 1 },
    { name: '黄石', intensity: '6', accel: 0.05, group: 1 },
    { name: '荆门', intensity: '6', accel: 0.05, group: 1 },
    { name: '恩施', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 湖南 ——— */
    { name: '长沙', intensity: '6', accel: 0.05, group: 1 },
    { name: '常德', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '岳阳', intensity: '7', accel: 0.10, group: 1 },
    { name: '益阳', intensity: '6', accel: 0.05, group: 1 },
    { name: '郴州', intensity: '6', accel: 0.05, group: 1 },
    { name: '邵阳', intensity: '6', accel: 0.05, group: 1 },
    { name: '张家界', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 广东 ——— */
    { name: '广州', intensity: '7', accel: 0.10, group: 1 },
    { name: '深圳', intensity: '7', accel: 0.10, group: 1 },
    { name: '珠海', intensity: '7', accel: 0.10, group: 1 },
    { name: '汕头', intensity: '8', accel: 0.20, group: 1 },
    { name: '潮州', intensity: '8', accel: 0.20, group: 1 },
    { name: '佛山', intensity: '7', accel: 0.10, group: 1 },
    { name: '江门', intensity: '7', accel: 0.10, group: 1 },
    { name: '湛江', intensity: '7', accel: 0.10, group: 1 },
    { name: '中山', intensity: '7', accel: 0.10, group: 1 },
    { name: '揭阳', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '汕尾', intensity: '7', accel: 0.10, group: 1 },
    { name: '茂名', intensity: '7', accel: 0.10, group: 1 },
    { name: '阳江', intensity: '7', accel: 0.10, group: 1 },
    { name: '东莞', intensity: '6', accel: 0.05, group: 1 },
    { name: '惠州', intensity: '6', accel: 0.05, group: 1 },
    { name: '韶关', intensity: '6', accel: 0.05, group: 1 },
    { name: '肇庆', intensity: '6', accel: 0.05, group: 1 },
    { name: '梅州', intensity: '6', accel: 0.05, group: 1 },
    { name: '清远', intensity: '6', accel: 0.05, group: 1 },
    /* ——— 广西 ——— */
    { name: '南宁', intensity: '6', accel: 0.05, group: 1 },
    { name: '桂林', intensity: '6', accel: 0.05, group: 1 },
    { name: '柳州', intensity: '6', accel: 0.05, group: 1 },
    { name: '梧州', intensity: '6', accel: 0.05, group: 1 },
    { name: '北海', intensity: '6', accel: 0.05, group: 1 },
    { name: '玉林', intensity: '7', accel: 0.10, group: 1 },
    { name: '百色', intensity: '7', accel: 0.10, group: 1 },
    /* ——— 海南 ——— */
    { name: '海口', intensity: '8.5', accel: 0.30, group: 1 },
    { name: '三亚', intensity: '6', accel: 0.05, group: 1 },
    { name: '文昌', intensity: '8', accel: 0.20, group: 1 },
    { name: '儋州', intensity: '7', accel: 0.10, group: 1 },
    { name: '琼海', intensity: '7', accel: 0.10, group: 1 },
    /* ——— 四川 ——— */
    { name: '成都', intensity: '7', accel: 0.10, group: 3 },
    { name: '绵阳', intensity: '7', accel: 0.10, group: 2 },
    { name: '德阳', intensity: '7', accel: 0.10, group: 2 },
    { name: '雅安', intensity: '7', accel: 0.10, group: 2 },
    { name: '宜宾', intensity: '7', accel: 0.10, group: 2 },
    { name: '自贡', intensity: '7', accel: 0.10, group: 1 },
    { name: '攀枝花', intensity: '7', accel: 0.10, group: 3 },
    { name: '乐山', intensity: '7', accel: 0.10, group: 2 },
    { name: '泸州', intensity: '6', accel: 0.05, group: 1 },
    { name: '内江', intensity: '6', accel: 0.05, group: 1 },
    { name: '广元', intensity: '7', accel: 0.10, group: 2 },
    { name: '康定', intensity: '9', accel: 0.40, group: 2 },
    { name: '西昌', intensity: '9', accel: 0.40, group: 2 },
    /* ——— 贵州 ——— */
    { name: '贵阳', intensity: '6', accel: 0.05, group: 1 },
    { name: '六盘水', intensity: '6', accel: 0.05, group: 2 },
    /* ——— 云南 ——— */
    { name: '昆明', intensity: '8', accel: 0.20, group: 3 },
    { name: '大理', intensity: '8', accel: 0.20, group: 2 },
    { name: '丽江', intensity: '8.5', accel: 0.30, group: 2 },
    { name: '玉溪', intensity: '8', accel: 0.20, group: 2 },
    { name: '保山', intensity: '8', accel: 0.20, group: 3 },
    { name: '普洱', intensity: '8', accel: 0.20, group: 3 },
    { name: '曲靖', intensity: '7.5', accel: 0.15, group: 3 },
    { name: '昭通', intensity: '7', accel: 0.10, group: 3 },
    { name: '楚雄', intensity: '7.5', accel: 0.15, group: 3 },
    /* ——— 西藏 ——— */
    { name: '拉萨', intensity: '8', accel: 0.20, group: 3 },
    { name: '日喀则', intensity: '7.5', accel: 0.15, group: 3 },
    { name: '昌都', intensity: '7', accel: 0.10, group: 3 },
    { name: '林芝', intensity: '8', accel: 0.20, group: 3 },
    /* ——— 陕西 ——— */
    { name: '西安', intensity: '8', accel: 0.20, group: 1 },
    { name: '宝鸡', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '咸阳', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '渭南', intensity: '8', accel: 0.20, group: 1 },
    { name: '汉中', intensity: '7', accel: 0.10, group: 2 },
    { name: '安康', intensity: '7', accel: 0.10, group: 1 },
    { name: '延安', intensity: '6', accel: 0.05, group: 1 },
    { name: '铜川', intensity: '7', accel: 0.10, group: 3 },
    /* ——— 甘肃 ——— */
    { name: '兰州', intensity: '8', accel: 0.20, group: 3 },
    { name: '天水', intensity: '8.5', accel: 0.30, group: 2 },
    { name: '白银', intensity: '7.5', accel: 0.15, group: 3 },
    { name: '嘉峪关', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '酒泉', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '张掖', intensity: '7', accel: 0.10, group: 2 },
    { name: '武威', intensity: '8', accel: 0.20, group: 3 },
    { name: '平凉', intensity: '7.5', accel: 0.15, group: 3 },
    { name: '庆阳', intensity: '6', accel: 0.05, group: 3 },
    { name: '敦煌', intensity: '7', accel: 0.10, group: 3 },
    /* ——— 青海 ——— */
    { name: '西宁', intensity: '7', accel: 0.10, group: 3 },
    { name: '格尔木', intensity: '7', accel: 0.10, group: 3 },
    /* ——— 宁夏 ——— */
    { name: '银川', intensity: '8', accel: 0.20, group: 2 },
    { name: '石嘴山', intensity: '8', accel: 0.20, group: 1 },
    { name: '吴忠', intensity: '8', accel: 0.20, group: 2 },
    { name: '固原', intensity: '8', accel: 0.20, group: 2 },
    { name: '中卫', intensity: '8', accel: 0.20, group: 3 },
    /* ——— 新疆 ——— */
    { name: '乌鲁木齐', intensity: '8', accel: 0.20, group: 2 },
    { name: '克拉玛依', intensity: '7', accel: 0.10, group: 3 },
    { name: '喀什', intensity: '8.5', accel: 0.30, group: 3 },
    { name: '库尔勒', intensity: '7.5', accel: 0.15, group: 2 },
    { name: '伊宁', intensity: '7.5', accel: 0.15, group: 3 },
    { name: '吐鲁番', intensity: '7', accel: 0.10, group: 2 },
    { name: '哈密', intensity: '7', accel: 0.10, group: 2 },
    { name: '石河子', intensity: '8', accel: 0.20, group: 3 },
    /* ——— 中国香港 / 中国澳门 ——— */
    { name: '中国香港', intensity: '7.5', accel: 0.15, group: 1 },
    { name: '中国澳门', intensity: '7', accel: 0.10, group: 1 }
];

console.log('[Core] materials.js loaded. 材料与截面数据就绪。');
