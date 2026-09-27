/* Atelier Treillis — catalogues de sections
   Acier : IPE / HEA (EN 10365), tubes carrés SHS et ronds CHS finis à chaud (EN 10210), ronds pleins filetés.
   Bois  : C24 (EN 338), GL24h / GL28h (EN 14080).
   Unités internes : mm, mm², mm⁴, mm³, kg/m. */
(function (G) {
  'use strict';
  const PS = G.PS = G.PS || {};
  const PI = Math.PI;

  const STEEL = { E: 210000, G: 81000, rho: 7850 };
  const GRADES = {
    S235: { key: 'S235', fy: 235, fu: 360 },
    S275: { key: 'S275', fy: 275, fu: 430 },
    S355: { key: 'S355', fy: 355, fu: 490 },
  };
  const TIMBER = {
    C24:   { key: 'C24',   label: 'C24 — bois massif',      fmk: 24, ft0k: 14.5, fc0k: 21, E0mean: 11000, E005: 7400,  rhok: 350, rhomean: 420, gM: 1.30, betac: 0.2, kdef: 0.6 },
    GL24h: { key: 'GL24h', label: 'GL24h — lamellé-collé',  fmk: 24, ft0k: 19.2, fc0k: 24, E0mean: 11500, E005: 9600,  rhok: 385, rhomean: 420, gM: 1.25, betac: 0.1, kdef: 0.6 },
    GL28h: { key: 'GL28h', label: 'GL28h — lamellé-collé',  fmk: 28, ft0k: 22.3, fc0k: 28, E0mean: 12600, E005: 10500, rhok: 425, rhomean: 460, gM: 1.25, betac: 0.1, kdef: 0.6 },
  };

  const num = (v) => String(v).replace('.', ',');

  /* ---------- Tubes carrés finis à chaud (rayons EN 10210 : ro = 1,5 t, ri = t) ---------- */
  function shs(b, t) {
    const ro = 1.5 * t, ri = t, bi = b - 2 * t, k = 4 - PI;
    const dO = b / 2 - 0.2234 * ro, dI = b / 2 - t - 0.2234 * ri;
    const A = b * b - bi * bi - k * (ro * ro - ri * ri);
    const I = (b ** 4 - bi ** 4) / 12 - k * (ro * ro * dO * dO - ri * ri * dI * dI);
    const Wpl = (b ** 3 - bi ** 3) / 4 - k * (ro * ro * dO - ri * ri * dI);
    const i = Math.sqrt(I / A);
    return {
      key: `SHS ${b}×${num(t)}`, label: `□ ${b}×${num(t)}`, fam: 'SHS', mat: 'steel',
      shape: { type: 'SHS', b, t, ro, ri }, h: b, b, t,
      A, Iy: I, Iz: I, iy: i, iz: i, Wely: I / (b / 2), Wply: Wpl, Wplz: Wpl,
      mass: A * 1e-6 * STEEL.rho, perim: (4 * b - (8 - 2 * PI) * ro) / 1000,
      curve: { y: 'a', z: 'a' }, slim: (b - 3 * t) / t, slimType: 'box',
    };
  }

  /* ---------- Tubes ronds ---------- */
  function chs(D, t) {
    const d = D - 2 * t;
    const A = PI / 4 * (D * D - d * d);
    const I = PI / 64 * (D ** 4 - d ** 4);
    const i = Math.sqrt(I / A);
    return {
      key: `CHS ${num(D)}×${num(t)}`, label: `○ ${num(D)}×${num(t)}`, fam: 'CHS', mat: 'steel',
      shape: { type: 'CHS', D, t }, h: D, b: D, t,
      A, Iy: I, Iz: I, iy: i, iz: i, Wely: I / (D / 2), Wply: (D ** 3 - d ** 3) / 6, Wplz: (D ** 3 - d ** 3) / 6,
      mass: A * 1e-6 * STEEL.rho, perim: PI * D / 1000,
      curve: { y: 'a', z: 'a' }, slim: D / t, slimType: 'tube',
    };
  }

  /* ---------- Profilés en I laminés (congés inclus) ---------- */
  function ish(fam, name, h, b, tw, tf, r) {
    const af = (1 - PI / 4) * r * r;            // aire d'un congé
    const dy = h / 2 - tf - 0.2234 * r;         // bras de levier d'un congé (axe fort)
    const dz = tw / 2 + 0.2234 * r;             // bras de levier d'un congé (axe faible)
    const hw = h - 2 * tf;
    const A = 2 * b * tf + hw * tw + 4 * af;
    const Iy = (b * h ** 3 - (b - tw) * hw ** 3) / 12 + 4 * af * dy * dy;
    const Iz = (2 * tf * b ** 3 + hw * tw ** 3) / 12 + 4 * af * dz * dz;
    const Wply = b * tf * (h - tf) + tw * hw * hw / 4 + 4 * af * dy;
    const Wplz = tf * b * b / 2 + hw * tw * tw / 4 + 4 * af * dz;
    // Inertie de torsion avec correction des congés (formule usuelle des profils laminés)
    const al = -0.042 + 0.2204 * tw / tf + 0.1355 * r / tf - 0.0865 * r * tw / (tf * tf) - 0.0725 * tw * tw / (tf * tf);
    const D = ((tf + r) ** 2 + tw * (r + tw / 4)) / (2 * r + tf);
    const It = 2 / 3 * b * tf ** 3 + 1 / 3 * hw * tw ** 3 + 2 * al * D ** 4 - 0.63 * tf ** 4;
    const Iw = Iz * (h - tf) ** 2 / 4;
    const rolledH = h / b > 1.2;
    return {
      key: `${fam} ${name}`, label: `${fam} ${name}`, fam, mat: 'steel',
      shape: { type: 'I', h, b, tw, tf, r }, h, b, tw, tf, r,
      A, Iy, Iz, iy: Math.sqrt(Iy / A), iz: Math.sqrt(Iz / A), Wely: Iy / (h / 2), Wply, Wplz, It, Iw,
      mass: A * 1e-6 * STEEL.rho, perim: (2 * h + 4 * b - 2 * tw) / 1000,
      curve: rolledH ? { y: 'a', z: 'b' } : { y: 'b', z: 'c' },
      flangeSlim: (b - tw - 2 * r) / 2 / tf, webSlim: (h - 2 * tf - 2 * r) / tw, slimType: 'I',
    };
  }

  /* ---------- Ronds pleins filetés (tirants de contreventement) ---------- */
  const AS = { 12: 84.3, 16: 157, 20: 245, 24: 353, 27: 459, 30: 561, 36: 817, 42: 1120 };
  function rod(d) {
    const A = PI * d * d / 4, I = PI * d ** 4 / 64;
    return {
      key: `Ø${d}`, label: `Ø ${d} (M${d})`, fam: 'ROD', mat: 'steel',
      shape: { type: 'ROD', d }, h: d, b: d, A, As: AS[d], Iy: I, Iz: I, iy: d / 4, iz: d / 4,
      Wely: PI * d ** 3 / 32, Wply: d ** 3 / 6, mass: A * 1e-6 * STEEL.rho, perim: PI * d / 1000,
      curve: { y: 'c', z: 'c' }, slimType: 'rod',
    };
  }

  const SHS_DATA = [
    [40, 3], [40, 4], [50, 3], [50, 4], [50, 5], [60, 3], [60, 4], [60, 5], [70, 4], [70, 5],
    [80, 4], [80, 5], [80, 6.3], [90, 5], [90, 6.3], [100, 4], [100, 5], [100, 6.3], [100, 8],
    [120, 5], [120, 6.3], [120, 8], [120, 10], [140, 5], [140, 6.3], [140, 8], [140, 10],
    [150, 6.3], [150, 8], [150, 10], [160, 6.3], [160, 8], [160, 10], [180, 8], [180, 10], [180, 12.5],
    [200, 8], [200, 10], [200, 12.5], [220, 10], [220, 12.5], [250, 10], [250, 12.5], [260, 10],
    [260, 12.5], [300, 10], [300, 12.5], [300, 16], [350, 12.5], [350, 16], [400, 12.5], [400, 16],
  ];
  const CHS_DATA = [
    [33.7, 3.2], [42.4, 3.2], [48.3, 3.2], [48.3, 4], [60.3, 3.2], [60.3, 4], [76.1, 3.2], [76.1, 4],
    [76.1, 5], [88.9, 3.2], [88.9, 4], [88.9, 5], [88.9, 6.3], [101.6, 4], [101.6, 5], [101.6, 6.3],
    [114.3, 4], [114.3, 5], [114.3, 6.3], [139.7, 5], [139.7, 6.3], [139.7, 8], [168.3, 5], [168.3, 6.3],
    [168.3, 8], [168.3, 10], [193.7, 6.3], [193.7, 8], [193.7, 10], [219.1, 6.3], [219.1, 8], [219.1, 10],
    [219.1, 12.5], [244.5, 8], [244.5, 10], [273, 8], [273, 10], [273, 12.5], [323.9, 10], [323.9, 12.5],
    [355.6, 10], [355.6, 12.5], [406.4, 10], [406.4, 12.5], [457, 12.5], [508, 12.5],
  ];
  const IPE_DATA = [
    ['80', 80, 46, 3.8, 5.2, 5], ['100', 100, 55, 4.1, 5.7, 7], ['120', 120, 64, 4.4, 6.3, 7],
    ['140', 140, 73, 4.7, 6.9, 7], ['160', 160, 82, 5.0, 7.4, 9], ['180', 180, 91, 5.3, 8.0, 9],
    ['200', 200, 100, 5.6, 8.5, 12], ['220', 220, 110, 5.9, 9.2, 12], ['240', 240, 120, 6.2, 9.8, 15],
    ['270', 270, 135, 6.6, 10.2, 15], ['300', 300, 150, 7.1, 10.7, 15], ['330', 330, 160, 7.5, 11.5, 18],
    ['360', 360, 170, 8.0, 12.7, 18], ['400', 400, 180, 8.6, 13.5, 21], ['450', 450, 190, 9.4, 14.6, 21],
    ['500', 500, 200, 10.2, 16.0, 21], ['550', 550, 210, 11.1, 17.2, 24], ['600', 600, 220, 12.0, 19.0, 24],
  ];
  const HEA_DATA = [
    ['100', 96, 100, 5, 8, 12], ['120', 114, 120, 5, 8, 12], ['140', 133, 140, 5.5, 8.5, 12],
    ['160', 152, 160, 6, 9, 15], ['180', 171, 180, 6, 9.5, 15], ['200', 190, 200, 6.5, 10, 18],
    ['220', 210, 220, 7, 11, 18], ['240', 230, 240, 7.5, 12, 21], ['260', 250, 260, 7.5, 12.5, 24],
    ['280', 270, 280, 8, 13, 24], ['300', 290, 300, 8.5, 14, 27], ['320', 310, 300, 9, 15.5, 27],
    ['340', 330, 300, 9.5, 16.5, 27], ['360', 350, 300, 10, 17.5, 27], ['400', 390, 300, 11, 19, 27],
    ['450', 440, 300, 11.5, 21, 27], ['500', 490, 300, 12, 23, 27], ['550', 540, 300, 12.5, 24, 27],
    ['600', 590, 300, 13, 25, 27],
  ];

  const byMass = (a, b) => a.mass - b.mass;
  const steel = {
    SHS: SHS_DATA.map(([b, t]) => shs(b, t)).sort(byMass),
    CHS: CHS_DATA.map(([D, t]) => chs(D, t)).sort(byMass),
    IPE: IPE_DATA.map((d) => ish('IPE', ...d)),
    HEA: HEA_DATA.map((d) => ish('HEA', ...d)),
    ROD: [12, 16, 20, 24, 27, 30, 36, 42].map(rod),
  };

  /* Classe de section ≤ 3 en compression pure (EC3 tableau 5.2) */
  function compOK(s, fy) {
    const eps = Math.sqrt(235 / fy);
    if (s.slimType === 'box') return s.slim <= 42 * eps;
    if (s.slimType === 'tube') return s.slim <= 90 * eps * eps;
    if (s.slimType === 'I') return s.flangeSlim <= 14 * eps && s.webSlim <= 42 * eps;
    return true;
  }

  /* ---------- Bois : sections rectangulaires ---------- */
  const timberCache = {};
  function timberLists(key) {
    if (timberCache[key]) return timberCache[key];
    const tg = TIMBER[key];
    const glulam = key.startsWith('GL');
    const make = (b, h) => {
      const A = b * h;
      return {
        key: `${tg.key} ${b}×${h}`, label: `${tg.key} ${b}×${h}`, fam: glulam ? 'GL' : 'BM', mat: 'timber',
        shape: { type: 'RECT', b, h }, b, h, A,
        Iy: b * h ** 3 / 12, Iz: h * b ** 3 / 12, iy: h / Math.sqrt(12), iz: b / Math.sqrt(12),
        Wely: b * h * h / 6, Welz: h * b * b / 6, mass: A * 1e-6 * tg.rhomean, perim: 2 * (b + h) / 1000,
      };
    };
    const widths = glulam ? [90, 115, 140, 160, 185, 210, 240, 265, 300] : [63, 75, 100, 120, 150, 175, 200];
    const heights = glulam ? Array.from({ length: 38 }, (_, i) => 120 + 40 * i) : [75, 100, 120, 150, 175, 200, 225, 250, 275, 300];
    const all = [];
    for (const b of widths) {
      if (glulam || true) all.push(make(b, b));
      for (const h of heights) if (h > b) all.push(make(b, h));
    }
    const pick = (fn) => all.filter(fn).sort(byMass);
    // barres de ferme : largeur minimale pour loger les assemblages (plats en âme + broches)
    const out = {
      truss: pick((s) => s.h / s.b <= 2.01 && s.b >= (glulam ? 115 : 75)),
      column: pick((s) => s.h / s.b <= 4.01 && s.b >= (glulam ? 115 : 100)),
      purlin: pick((s) => s.h / s.b <= 5.01 && s.h >= s.b),
    };
    timberCache[key] = out;
    return out;
  }

  PS.cat = { STEEL, GRADES, TIMBER, steel, compOK, timberLists };
})(typeof window !== 'undefined' ? window : globalThis);
