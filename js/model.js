/* Atelier Treillis — modèle paramétrique : géométrie de la ferme, trame du bâtiment, charges climatiques.
   Repère 2D de la ferme : x le long de la portée (0 → l), y vers le haut (0 = sous-face de la membrure inférieure
   = tête de poteau). Repère 3D : x transversal, y vertical, z longitudinal. Unités : m, kN. */
(function (G) {
  'use strict';
  const PS = G.PS = G.PS || {};

  PS.DEFAULTS = {
    typo: 'duo', pattern: 'pratt', material: 'steel', roofing: 'zinc',
    span: 16, length: 36, colH: 5, trussH: 3.2, aboutH: 0, flatSlope: 5,
    bayTarget: 6, panelsAuto: true, panels: 8, tieSpacing: 4,
    steelGrade: 'S355', trussFamily: 'SHS', colFamily: 'HEA', timberGrade: 'GL24h',
    snowRegion: 'A2', altitude: 200, windRegion: 2, terrain: 'IIIa',
  };

  PS.ROOFING = {
    zinc: {
      key: 'zinc', label: 'Zinc à joint debout', g: 0.30, minSlope: 0.05, purlinMax: 2.5, deflRatio: 200,
      desc: 'zinc 0,65 mm sur voligeage bois 27 mm, pare-vapeur',
    },
    glass: {
      key: 'glass', label: 'Verrière', g: 0.50, minSlope: 0.10, purlinMax: 1.8, deflRatio: 300,
      desc: 'double vitrage feuilleté 8/16/44.2 sur serreurs aluminium',
    },
  };

  PS.SNOW = { A1: 0.45, A2: 0.45, B1: 0.55, B2: 0.55, C1: 0.65, C2: 0.65, D: 0.90, E: 1.40 };
  PS.WIND_VB = { 1: 22, 2: 24, 3: 26, 4: 28 };
  PS.TERRAIN = {
    '0': { z0: 0.005, zmin: 1, label: '0 — mer, lacs' },
    II: { z0: 0.05, zmin: 2, label: 'II — rase campagne' },
    IIIa: { z0: 0.2, zmin: 5, label: 'IIIa — bocage, habitat dispersé' },
    IIIb: { z0: 0.5, zmin: 9, label: 'IIIb — zones urbanisées, forêts' },
    IV: { z0: 1.0, zmin: 15, label: 'IV — centre-ville dense' },
  };

  /* ---------------- Forme de la toiture ---------------- */
  function roofShape(P) {
    const l = P.span;
    let ha, hr, twoSided;
    if (P.typo === 'duo') { hr = P.trussH; ha = Math.min(Math.max(0, P.aboutH), hr - 0.05); twoSided = true; }
    else if (P.typo === 'mono') { hr = P.trussH; ha = Math.min(Math.max(0, P.aboutH), hr - 0.05); twoSided = false; }
    else { const s = Math.max(0, P.flatSlope) / 100; ha = P.trussH; hr = P.trussH + s * l / 2; twoSided = s > 1e-6; }
    const f = (x) => {
      if (P.typo === 'mono') return ha + (hr - ha) * x / l;
      if (!twoSided) return ha;
      return ha + (hr - ha) * (1 - Math.abs(2 * x / l - 1));
    };
    const slope = P.typo === 'mono' ? (hr - ha) / l : twoSided ? (hr - ha) / (l / 2) : 0;
    return { f, ha, hr, twoSided, slope, alpha: Math.atan(slope), hmax: Math.max(ha, hr) };
  }

  /* ---------------- Ferme 2D pour n panneaux ---------------- */
  function buildTruss(P, shape, n) {
    const l = P.span, dx = l / n;
    const nodes = [], B = [], T = [];
    for (let i = 0; i <= n; i++) { B.push(nodes.length); nodes.push({ x: i * dx, y: 0, kind: 'B', i }); }
    for (let i = 0; i <= n; i++) {
      const y = shape.f(i * dx);
      if (y < 1e-6) T.push(B[i]);
      else { T.push(nodes.length); nodes.push({ x: i * dx, y, kind: 'T', i }); }
    }
    const members = [], seen = new Set();
    const add = (a, b, g, i) => {
      if (a === b) return;
      const key = a < b ? a * 4096 + b : b * 4096 + a;
      if (seen.has(key)) return;
      seen.add(key);
      members.push({ a, b, g, i });
    };
    for (let i = 0; i < n; i++) add(B[i], B[i + 1], 'bot', i);
    for (let i = 0; i < n; i++) add(T[i], T[i + 1], 'top', i);
    for (let i = 0; i <= n; i++) if (T[i] !== B[i]) add(B[i], T[i], 'vert', i);
    // Orientation des diagonales. Pratt : diagonales TENDUES sous charge de toiture uniforme ; Howe : COMPRIMÉES.
    // Le sens géométrique qui donne ce comportement dépend de la forme : on coupe le panneau et on écrit
    // l'équilibre des moments autour du point de concours des deux membrures (méthode de Ritter).
    // Ferme triangulaire : ce point est l'appui, les diagonales « montent » vers le faîtage ;
    // membrures parallèles : il est à l'infini, c'est l'effort tranchant qui décide.
    const yT = (i) => nodes[T[i]].y;
    const Pn = (i) => (i === 0 || i === n ? dx / 2 : dx);
    const R0 = l / 2;
    let sumP = 0, sumPx = 0;
    for (let k = 0; k < n; k++) {
      sumP += Pn(k); sumPx += Pn(k) * k * dx;
      const left = (k + 0.5) * dx < l / 2 - 1e-9;
      const yk = yT(k), yk1 = yT(k + 1), dyk = yk1 - yk, xk = k * dx, xk1 = xk + dx;
      let descTension;
      if (Math.abs(dyk) < 1e-9) descTension = R0 - sumP > 0;
      else {
        const xp = xk - yk * dx / dyk;
        const M = -xp * R0 - (sumPx - xp * sumP);
        const mDesc = -yk * (xk1 - xp), mAsc = yk1 * (xk - xp);
        descTension = Math.abs(M) < 1e-9 ? left : (mDesc !== 0 ? mDesc * -M > 0 : !(mAsc * -M > 0));
      }
      let desc; // true : T_k → B_k+1 (« \ »), false : B_k → T_k+1 (« / »)
      if (P.pattern === 'howe') desc = !descTension;
      else if (P.pattern === 'warren') {
        const m = left ? k : n - 1 - k;
        desc = left ? m % 2 === 1 : m % 2 === 0;
      } else desc = descTension;
      if (desc) add(T[k], B[k + 1], 'diag', k); else add(B[k], T[k + 1], 'diag', k);
    }
    for (const m of members) {
      const a = nodes[m.a], b = nodes[m.b];
      m.L = Math.hypot(b.x - a.x, b.y - a.y);
      m.ang = Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180 / Math.PI;
    }
    const topPanels = [];
    for (let k = 0; k < n; k++) {
      const a = nodes[T[k]], b = nodes[T[k + 1]];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      topPanels.push({ k, a: T[k], b: T[k + 1], len, dx, dy: b.y - a.y, side: shape.twoSided ? ((k + 0.5) * dx < l / 2 ? 'L' : 'R') : 'S' });
    }
    const diagAngles = members.filter((m) => m.g === 'diag').map((m) => m.ang);
    return { n, dx, nodes, members, B, T, topPanels, diagAngles };
  }

  /* Découpage automatique : pannes aux nœuds, diagonales proches de 45°, peu de barres */
  function choosePanels(P, shape) {
    const R = PS.ROOFING[P.roofing];
    const even = shape.twoSided;
    let best = null;
    for (let n = even ? 4 : 2; n <= 40; n += even ? 2 : 1) {
      const t = buildTruss(P, shape, n);
      const lp = Math.max(...t.topPanels.map((p) => p.len));
      let cost = 0.35 * n;
      if (lp > R.purlinMax) cost += 60 + 200 * (lp - R.purlinMax);
      for (const a of t.diagAngles) {
        if (a > 60) cost += 0.02 * (a - 60) ** 2;
        if (a < 30) cost += 0.01 * (30 - a) ** 2;
      }
      if (!best || cost < best.cost) best = { n, cost };
    }
    return best.n;
  }

  /* ---------------- Géométrie complète ---------------- */
  PS.buildGeometry = function (P) {
    const shape = roofShape(P);
    let n = P.panelsAuto ? choosePanels(P, shape) : Math.max(2, Math.round(P.panels));
    if (shape.twoSided && n % 2) n += 1;
    if (shape.twoSided) n = Math.max(4, n);
    const truss = buildTruss(P, shape, n);
    const R = PS.ROOFING[P.roofing];

    // Pannes : à chaque nœud de membrure supérieure (+ pannes intermédiaires si panneau trop long)
    const nodes = truss.nodes;
    const purlins = [];
    const panelSub = truss.topPanels.map((p) => Math.max(1, Math.ceil(p.len / R.purlinMax - 1e-9)));
    for (let k = 0; k <= n; k++) {
      const nd = nodes[truss.T[k]];
      purlins.push({ x: nd.x, y: nd.y, k, atNode: true });
      if (k < n && panelSub[k] > 1) {
        const p = truss.topPanels[k], a = nodes[p.a];
        for (let j = 1; j < panelSub[k]; j++) {
          const t = j / panelSub[k];
          purlins.push({ x: a.x + t * p.dx, y: a.y + t * p.dy, k, atNode: false });
        }
      }
    }
    purlins.sort((a, b) => a.x - b.x);
    // largeur tributaire (le long du rampant) et normale au plan de couverture
    const tp = truss.topPanels;
    const panelAt = (x) => tp[Math.min(n - 1, Math.max(0, Math.floor(x / truss.dx + 1e-9)))];
    for (let j = 0; j < purlins.length; j++) {
      const p = purlins[j];
      const prev = purlins[j - 1], next = purlins[j + 1];
      const d = (q) => q ? Math.hypot(q.x - p.x, q.y - p.y) : 0;
      p.trib = (d(prev) + d(next)) / 2;
      const nrm = (panel) => { const L = panel.len; return [-panel.dy / L, panel.dx / L]; };
      const nL = p.x > 1e-9 ? nrm(panelAt(p.x - 1e-6)) : null;
      const nR = p.x < P.span - 1e-9 ? nrm(panelAt(p.x + 1e-6)) : null;
      let nx = (nL ? nL[0] : 0) + (nR ? nR[0] : 0), ny = (nL ? nL[1] : 0) + (nR ? nR[1] : 0);
      const nl = Math.hypot(nx, ny) || 1; p.nx = nx / nl; p.ny = ny / nl;
    }
    const lpMax = Math.max(...tp.map((p) => p.len));

    // Filants de membrure inférieure (maintiens hors plan)
    const kb = Math.max(1, Math.round(P.tieSpacing / truss.dx));
    const tieSet = new Set();
    for (let i = kb; i < n; i += kb) { tieSet.add(i); tieSet.add(n - i); }
    const ties = [...tieSet].filter((i) => i > 0 && i < n).sort((a, b) => a - b);
    const restr = [0, ...ties, n];

    // Trame longitudinale (logique du tutoriel : arrondi du nombre de travées puis entraxe recalculé)
    const nBays = Math.max(1, Math.round(P.length / P.bayTarget));
    const e = P.length / nBays;
    const braced = new Set([0, nBays - 1]);
    if (P.length > 60 && nBays >= 5) braced.add(Math.floor(nBays / 2));

    // Contreventement de toiture : croix par groupe de panneaux, rampant par rampant
    const planes = shape.twoSided ? [[0, n / 2], [n / 2, n]] : [[0, n]];
    const roofGroups = [];
    for (const [i0, i1] of planes) {
      const len = Math.hypot(nodes[truss.T[i1]].x - nodes[truss.T[i0]].x, nodes[truss.T[i1]].y - nodes[truss.T[i0]].y);
      const g = Math.max(1, Math.min(i1 - i0, Math.round(len / e)));
      let prev = i0;
      for (let j = 1; j <= g; j++) {
        const b = j === g ? i1 : Math.round(i0 + j * (i1 - i0) / g);
        if (b > prev) { roofGroups.push([prev, b]); prev = b; }
      }
    }
    const wallLevels = Math.max(1, Math.round(P.colH / e));

    return {
      shape, truss, n, purlins, panelSub, lpMax, ties, restr, kb,
      nBays, e, nFrames: nBays + 1, braced: [...braced].sort((a, b) => a - b), roofGroups, wallLevels, roofing: R,
    };
  };

  /* ---------------- Charges climatiques (NF EN 1991-1-3 / 1-4, annexes françaises, simplifié) ---------------- */
  function snowSk(region, A) {
    let s = PS.SNOW[region];
    if (A > 200) {
      if (region === 'E') s += A <= 500 ? 1.5 * A / 1000 - 0.30 : A <= 1000 ? 3.5 * A / 1000 - 1.30 : 7 * A / 1000 - 4.80;
      else s += A <= 500 ? A / 1000 - 0.20 : A <= 1000 ? 1.5 * A / 1000 - 0.45 : 3.5 * A / 1000 - 2.45;
    }
    return s;
  }
  function mu1(alphaDeg) {
    if (alphaDeg <= 30) return 0.8;
    if (alphaDeg < 60) return 0.8 * (60 - alphaDeg) / 30;
    return 0;
  }
  function qpeak(region, terrain, z) {
    const vb = PS.WIND_VB[region], T = PS.TERRAIN[terrain];
    const zz = Math.max(z, T.zmin);
    const kr = 0.19 * Math.pow(T.z0 / 0.05, 0.07);
    const lnz = Math.log(zz / T.z0);
    const vm = kr * lnz * vb;
    const kl = 1 - 2e-4 * Math.pow(Math.log10(T.z0) + 3, 6);
    const Iv = kl / lnz;
    return { qp: (1 + 7 * Iv) * 0.5 * 1.225 * vm * vm / 1000, vb, z: zz, Iv, vm };
  }
  const interp = (tab, a) => {
    if (a <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (a <= tab[i][0]) {
      const [a0, v0] = tab[i - 1], [a1, v1] = tab[i];
      return v0 + (v1 - v0) * (a - a0) / (a1 - a0);
    }
    return tab[tab.length - 1][1];
  };
  const CPE = {
    duoH_suc: [[5, -0.6], [15, -0.3], [30, -0.2], [45, 0.0], [60, 0.7], [75, 0.8]],
    duoH_pre: [[5, 0.0], [15, 0.2], [30, 0.4], [45, 0.6], [60, 0.7], [75, 0.8]],
    duoI: [[5, -0.6], [15, -0.4], [30, -0.4], [45, -0.2], [60, -0.2], [75, -0.2]],
    monoH180: [[5, -0.8], [15, -0.9], [30, -0.8], [45, -0.7], [60, -0.5], [75, -0.5]],
  };

  PS.loadParams = function (P, geo) {
    const sk = snowSk(P.snowRegion, P.altitude);
    const aDeg = geo.shape.alpha * 180 / Math.PI;
    const m1 = mu1(aDeg);
    const H = P.colH + geo.shape.hmax;
    const wind = qpeak(P.windRegion, P.terrain, H);
    const hd = H / P.span;
    const t = Math.min(1, Math.max(0, (hd - 0.25) / 0.75));
    const cpeD = 0.7 + 0.1 * t, cpeE = -0.3 - 0.2 * t;
    // cpe de toiture en fonction de la position x, de la direction du vent et de la variante (soulèvement / pression)
    const l = P.span, flatLike = aDeg < 5;
    const roofCpe = (x, fromLeft, variant) => {
      const windward = fromLeft ? x < l / 2 : x > l / 2;
      if (flatLike) return windward ? -0.7 : (variant === 'suc' ? -0.2 : 0.2);
      if (P.typo === 'mono') {
        const fromLow = fromLeft; // la toiture monte vers x = l : vent de gauche = vent sur l'égout bas (θ = 0°)
        if (fromLow) return interp(variant === 'suc' ? CPE.duoH_suc : CPE.duoH_pre, aDeg);
        return interp(CPE.monoH180, aDeg);
      }
      if (windward) return interp(variant === 'suc' ? CPE.duoH_suc : CPE.duoH_pre, aDeg);
      return interp(CPE.duoI, aDeg);
    };
    return {
      sk, mu1: m1, s: m1 * sk, alphaDeg: aDeg, qp: wind.qp, wind, cpeD, cpeE, hd, roofCpe,
      cpi: { suc: 0.2, pre: -0.3 }, gRoof: geo.roofing.g,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
