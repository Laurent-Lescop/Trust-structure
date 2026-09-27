/* Atelier Treillis — prédimensionnement : combinaisons, vérifications EC3 / EC5 simplifiées,
   choix automatique des profils, diagnostic de constructibilité, métré.
   Outil pédagogique : ordres de grandeur, ne remplace pas une note de calcul. */
(function (G) {
  'use strict';
  const PS = G.PS = G.PS || {};
  const GRAV = 9.81e-3;                     // kg → kN
  const ALPHA = { a0: 0.13, a: 0.21, b: 0.34, c: 0.49, d: 0.76 };
  const GROUPS = ['top', 'bot', 'vert', 'diag'];

  PS.ROLE_LABEL = {
    top: 'Membrure supérieure', bot: 'Membrure inférieure', vert: 'Montant', diag: 'Diagonale',
    col: 'Poteau', purlin: 'Panne', rodRoof: 'Croix de toiture', rodWall: 'Palée de stabilité',
    strut: 'Buton', tie: 'Filant de membrure inférieure',
  };
  PS.GROUP_LABEL = { top: 'Membrure supérieure', bot: 'Membrure inférieure', vert: 'Montants', diag: 'Diagonales', col: 'Poteaux', purlin: 'Pannes' };

  /* ---------------- Outils de vérification ---------------- */
  function chi(lb, curve) {
    if (lb <= 0.2) return 1;
    const a = ALPHA[curve], ph = 0.5 * (1 + a * (lb - 0.2) + lb * lb);
    return Math.min(1, 1 / (ph + Math.sqrt(ph * ph - lb * lb)));
  }
  function kcT(lam, tg) {
    const lr = lam / Math.PI * Math.sqrt(tg.fc0k / tg.E005);
    if (lr <= 0.3) return 1;
    const k = 0.5 * (1 + tg.betac * (lr - 0.3) + lr * lr);
    return 1 / (k + Math.sqrt(k * k - lr * lr));
  }

  /* Barre de treillis (effort normal + éventuelle flexion locale de membrure). Nt, Nc ≥ 0 en kN ;
     pour le bois, efforts déjà divisés par kmod. */
  function uAxial(ctx, s, Lin, Lout, Nt, Nc, Mloc) {
    const lamIn = Lin * 1000 / s.iy, lamOut = Lout * 1000 / s.iz, lam = Math.max(lamIn, lamOut);
    let u, crit;
    if (ctx.mat.kind === 'steel') {
      const fy = ctx.mat.fy, NRd = s.A * fy / 1000, l1 = Math.PI * Math.sqrt(210000 / fy);
      u = Nt / NRd; crit = 'traction';
      if (Nc > 1e-6) {
        const c = Math.min(chi(lamIn / l1, s.curve.y), chi(lamOut / l1, s.curve.z));
        let uc = Nc / (c * NRd);
        if (Mloc) uc += Mloc * 1e6 / (s.Wply * fy);
        if (uc > u) { u = uc; crit = Mloc ? 'flambement + flexion' : 'flambement'; }
        if (lam / 200 > u) { u = lam / 200; crit = 'élancement (λ > 200)'; }
      } else if (lam / 300 > u) { u = lam / 300; crit = 'élancement (λ > 300)'; }
    } else {
      const tg = ctx.mat.tg, ft = tg.ft0k / tg.gM, fc = tg.fc0k / tg.gM, fm = tg.fmk / tg.gM;
      u = Nt * 1000 / (0.8 * s.A * ft); crit = 'traction (section nette)';
      if (Nc > 1e-6) {
        const kc = Math.min(kcT(lamIn, tg), kcT(lamOut, tg));
        let uc = Nc * 1000 / (s.A * kc * fc);
        if (Mloc) uc += Mloc * 1e6 / (s.Wely * fm);
        if (uc > u) { u = uc; crit = Mloc ? 'flambement + flexion' : 'flambement'; }
        if (lam / 150 > u) { u = lam / 150; crit = 'élancement (λ > 150)'; }
      } else if (lam / 250 > u) { u = lam / 250; crit = 'élancement (λ > 250)'; }
    }
    return { u, crit, lam };
  }

  /* Poteau encastré en pied, articulé en tête (ferme posée) : compression + flexion */
  function uColumn(ctx, s, pairs) {
    const H = ctx.P.colH, Ly = 2 * H, Lz = H;
    const lamY = Ly * 1000 / s.iy, lamZ = Lz * 1000 / s.iz;
    let u = 0, crit = 'compression + flexion';
    if (ctx.mat.kind === 'steel') {
      const fy = ctx.mat.fy, E = 210000, Gm = 81000, l1 = Math.PI * Math.sqrt(E / fy);
      const cmin = Math.min(chi(lamY / l1, s.curve.y), chi(lamZ / l1, s.curve.z));
      const L = H * 1000, C1 = 1.77;
      const Mcr = C1 * Math.PI ** 2 * E * s.Iz / (L * L) * Math.sqrt(s.Iw / s.Iz + L * L * Gm * s.It / (Math.PI ** 2 * E * s.Iz));
      const lb = Math.sqrt(s.Wply * fy / Mcr), aLT = s.h / s.b > 2 ? 0.34 : 0.21;
      const ph = 0.5 * (1 + aLT * (lb - 0.2) + lb * lb);
      const cLT = lb <= 0.2 ? 1 : Math.min(1, 1 / (ph + Math.sqrt(ph * ph - lb * lb)));
      const NRd = s.A * fy / 1000, MRd = s.Wply * fy / 1e6;
      for (const p of pairs) u = Math.max(u, Math.max(0, -p.N) / (cmin * NRd) + Math.abs(p.M) / (cLT * MRd), Math.max(0, p.N) / NRd);
      const lam = Math.max(lamY, lamZ);
      if (lam / 200 > u) { u = lam / 200; crit = 'élancement'; }
    } else {
      const tg = ctx.mat.tg, kcy = kcT(lamY, tg), kcz = kcT(lamZ, tg);
      for (const p of pairs) {
        const fc = p.kmod * tg.fc0k / tg.gM, fm = p.kmod * tg.fmk / tg.gM;
        const sc = Math.max(0, -p.N) * 1000 / s.A, sm = Math.abs(p.M) * 1e6 / s.Wely;
        u = Math.max(u, sc / (kcy * fc) + sm / fm, sc / (kcz * fc) + 0.7 * sm / fm);
      }
      const lam = Math.max(lamY, lamZ);
      if (lam / 150 > u) { u = lam / 150; crit = 'élancement'; }
    }
    return { u, crit };
  }

  /* ---------------- Contexte de calcul ---------------- */
  function combosFor(geo) {
    const C = [{ id: 'ELU1', label: '1,35 G + 1,5 S', f: { G: 1.35, S: 1.5 }, kmod: 0.9, grav: true }];
    if (geo.shape.twoSided) C.push({ id: 'ELU2', label: '1,35 G + 1,5 S dissymétrique', f: { G: 1.35, Sa: 1.5 }, kmod: 0.9, grav: true });
    C.push(
      { id: 'ELU3g', label: 'G + 1,5 W soulèvement, vent de gauche', f: { G: 1, W1L: 1.5 }, kmod: 0.9 },
      { id: 'ELU3d', label: 'G + 1,5 W soulèvement, vent de droite', f: { G: 1, W1R: 1.5 }, kmod: 0.9 },
      { id: 'ELU4g', label: '1,35 G + 1,5 W + 0,75 S, vent de gauche', f: { G: 1.35, W2L: 1.5, S: 0.75 }, kmod: 0.9 },
      { id: 'ELU4d', label: '1,35 G + 1,5 W + 0,75 S, vent de droite', f: { G: 1.35, W2R: 1.5, S: 0.75 }, kmod: 0.9 },
      { id: 'ELU5g', label: '1,35 G + 1,5 S + 0,9 W, vent de gauche', f: { G: 1.35, S: 1.5, W2L: 0.9 }, kmod: 0.9, grav: true },
      { id: 'ELU5d', label: '1,35 G + 1,5 S + 0,9 W, vent de droite', f: { G: 1.35, S: 1.5, W2R: 0.9 }, kmod: 0.9, grav: true },
      { id: 'ELU0', label: '1,35 G (permanentes seules)', f: { G: 1.35 }, kmod: 0.6, grav: true },
    );
    return C;
  }

  function makeCtx(P, geo) {
    const lp = PS.loadParams(P, geo);
    let mat;
    if (P.material === 'timber') {
      const tg = PS.cat.TIMBER[P.timberGrade] || PS.cat.TIMBER.GL24h;
      const L = PS.cat.timberLists(tg.key);
      mat = { kind: 'timber', tg, E: tg.E0mean, truss: L.truss, column: L.column, purlin: L.purlin, label: tg.label, rho: tg.rhomean };
    } else {
      const gr = PS.cat.GRADES[P.steelGrade] || PS.cat.GRADES.S355, fy = gr.fy;
      const fam = PS.cat.steel[P.trussFamily] || PS.cat.steel.SHS;
      const col = PS.cat.steel[P.colFamily] || PS.cat.steel.HEA;
      mat = {
        kind: 'steel', fy, grade: gr, E: 210000, label: 'Acier ' + gr.key, rho: 7850,
        truss: fam.filter((s) => PS.cat.compOK(s, fy)), column: col.filter((s) => PS.cat.compOK(s, fy)), purlin: PS.cat.steel.IPE,
      };
    }
    const struts = PS.cat.steel.CHS.filter((s) => PS.cat.compOK(s, 235));
    return { P, geo, lp, mat, combos: combosFor(geo), struts };
  }

  /* ---------------- Pannes (isostatiques sur un entraxe) ---------------- */
  function roofPressures(ctx) {
    const { P, lp } = ctx;
    let pMax = 0, pMin = 0;
    for (const x of [0.05 * P.span, 0.5 * P.span, 0.95 * P.span]) for (const fl of [true, false]) {
      pMax = Math.max(pMax, lp.qp * (lp.roofCpe(x, fl, 'pre') - lp.cpi.pre));
      pMin = Math.min(pMin, lp.qp * (lp.roofCpe(x, fl, 'suc') - lp.cpi.suc));
    }
    return { pMax, pMin };
  }
  function sizePurlins(ctx) {
    const { geo, lp, mat } = ctx, e = geo.e;
    const a = Math.max(...geo.purlins.map((p) => p.trib));
    const ca = Math.cos(geo.shape.alpha);
    const { pMax, pMin } = roofPressures(ctx);
    const gc = lp.gRoof * a * ca, sN = lp.s * a * ca * ca;
    const Ekn = mat.E * 1e3, wLim = e / geo.roofing.deflRatio;
    let last = null;
    for (const s of mat.purlin) {
      const Gq = gc + s.mass * GRAV * ca;
      const cases = [
        { q: 1.35 * Gq + 1.5 * sN, kmod: 0.9 },
        { q: 1.35 * Gq + 1.5 * pMax * a + 0.75 * sN, kmod: 0.9 },
        { q: 1.35 * Gq + 1.5 * sN + 0.9 * pMax * a, kmod: 0.9 },
        { q: Gq + 1.5 * pMin * a, kmod: 0.9 },
        { q: 1.35 * Gq, kmod: 0.6 },
      ];
      let u = 0;
      for (const c of cases) {
        const M = Math.abs(c.q) * e * e / 8;
        const MRd = mat.kind === 'steel' ? s.Wply * mat.fy / 1e6 : s.Wely * c.kmod * mat.tg.fmk / mat.tg.gM / 1e6;
        u = Math.max(u, M / MRd);
      }
      const wq = mat.kind === 'steel' ? Gq + sN : Gq * (1 + mat.tg.kdef) + sN;
      const w = 5 * wq * e ** 4 / (384 * Ekn * s.Iy * 1e-12);
      last = { sec: s, u, uw: w / wLim, w, wLim, a, crit: u >= w / wLim ? 'flexion' : 'flèche' };
      if (u <= 1 && w <= wLim) return Object.assign(last, { ok: true, umax: Math.max(u, w / wLim) });
    }
    return Object.assign(last, { ok: false, umax: Math.max(last.u, last.uw) });
  }

  /* ---------------- Modèle aux éléments finis de la file courante ---------------- */
  function buildFE(ctx, secs) {
    const { P, geo, mat } = ctx, t = geo.truss, E = mat.E * 1e3;
    const nodes = t.nodes.map((n) => ({ x: n.x, y: n.y }));
    const elems = t.members.map((m) => ({ i: m.a, j: m.b, type: 'bar', E, A: secs[m.g].A * 1e-6 }));
    const nTruss = elems.length, colNodes = [], nc = 4, H = P.colH;
    for (const top of [t.B[0], t.B[t.n]]) {
      const x = nodes[top].x, ids = [];
      for (let k = 0; k < nc; k++) { ids.push(nodes.length); nodes.push({ x, y: -H + k * H / nc }); }
      ids.push(top);
      for (let k = 0; k < nc; k++) elems.push({ i: ids[k], j: ids[k + 1], type: 'beam', E, A: secs.col.A * 1e-6, I: secs.col.Iy * 1e-12 });
      colNodes.push(ids);
    }
    const supports = colNodes.map((ids) => ({ n: ids[0], ux: 1, uy: 1, rz: 1 }));
    return { nodes, elems, supports, nTruss, colNodes };
  }

  function buildLoads(ctx, fe, secs, purl) {
    const { P, geo, lp } = ctx, t = geo.truss, e = geo.e, nn = fe.nodes.length;
    const mk = () => new Float64Array(3 * nn);
    const C = { G: mk(), S: mk(), W1L: mk(), W1R: mk(), W2L: mk(), W2R: mk() };
    if (geo.shape.twoSided) C.Sa = mk();
    const add = (v, n, fx, fy) => { v[3 * n] += fx; v[3 * n + 1] += fy; };
    for (const m of t.members) {
      const w = secs[m.g].mass * GRAV * m.L * 1.10;           // +10 % goussets et boulons
      add(C.G, m.a, 0, -w / 2); add(C.G, m.b, 0, -w / 2);
    }
    for (const ids of fe.colNodes) for (let k = 0; k < ids.length - 1; k++) {
      const w = secs.col.mass * GRAV * (fe.nodes[ids[k + 1]].y - fe.nodes[ids[k]].y);
      add(C.G, ids[k], 0, -w / 2); add(C.G, ids[k + 1], 0, -w / 2);
    }
    const gp = purl.sec.mass * GRAV * e;
    for (const p of geo.purlins) {
      if (p.atNode) { add(C.G, t.T[p.k], 0, -gp); continue; }
      const tt = (p.x - p.k * t.dx) / t.dx;
      add(C.G, t.T[p.k], 0, -gp * (1 - tt)); add(C.G, t.T[p.k + 1], 0, -gp * tt);
    }
    const winds = [['W1L', true, 'suc'], ['W1R', false, 'suc'], ['W2L', true, 'pre'], ['W2R', false, 'pre']];
    for (const pn of t.topPanels) {
      const gv = lp.gRoof * pn.len * e, sv = lp.s * pn.dx * e, xm = (pn.k + 0.5) * t.dx;
      for (const n of [pn.a, pn.b]) {
        add(C.G, n, 0, -gv / 2);
        add(C.S, n, 0, -sv / 2);
        if (C.Sa) add(C.Sa, n, 0, -sv / 2 * (pn.side === 'L' ? 0.5 : 1));
      }
      const nx = -pn.dy / pn.len, ny = pn.dx / pn.len;
      for (const [name, fromLeft, variant] of winds) {
        const F = lp.qp * (lp.roofCpe(xm, fromLeft, variant) - lp.cpi[variant]) * pn.len * e;
        add(C[name], pn.a, -nx * F / 2, -ny * F / 2); add(C[name], pn.b, -nx * F / 2, -ny * F / 2);
      }
    }
    const wall = (v, ids, B0, T0, dir, p) => {
      const w = p * e * dir;
      for (let k = 0; k < ids.length - 1; k++) {
        const h = fe.nodes[ids[k + 1]].y - fe.nodes[ids[k]].y;
        add(v, ids[k], w * h / 2, 0); add(v, ids[k + 1], w * h / 2, 0);
      }
      if (T0 !== B0) { const h = fe.nodes[T0].y - fe.nodes[B0].y; add(v, B0, w * h / 2, 0); add(v, T0, w * h / 2, 0); }
    };
    for (const [name, fromLeft, variant] of winds) {
      const cpi = lp.cpi[variant];
      const pW = lp.qp * (lp.cpeD - cpi), pL = lp.qp * (lp.cpeE - cpi);
      wall(C[name], fe.colNodes[0], t.B[0], t.T[0], +1, fromLeft ? pW : pL);
      wall(C[name], fe.colNodes[1], t.B[t.n], t.T[t.n], -1, fromLeft ? pL : pW);
    }
    return C;
  }

  function analyse(ctx, secs, purl) {
    const fe = buildFE(ctx, secs);
    const cases = buildLoads(ctx, fe, secs, purl);
    const res = PS.fem.solve(fe, cases);
    if (!res.ok) return res;
    const nT = fe.nTruss, combos = ctx.combos, timber = ctx.mat.kind === 'timber';
    const Ncombo = combos.map((c) => {
      const arr = new Float64Array(nT);
      for (const k in c.f) { const N = res.N[k]; if (N) for (let q = 0; q < nT; q++) arr[q] += c.f[k] * N[q]; }
      return arr;
    });
    const env = [];
    for (let q = 0; q < nT; q++) {
      const r = { Nt: 0, Nc: 0, NtK: 0, NcK: 0, ct: -1, cc: -1 };
      combos.forEach((c, ci) => {
        const N = Ncombo[ci][q], km = timber ? c.kmod : 1;
        if (N > r.Nt) { r.Nt = N; r.ct = ci; }
        if (-N > r.Nc) { r.Nc = -N; r.cc = ci; }
        r.NtK = Math.max(r.NtK, N / km); r.NcK = Math.max(r.NcK, -N / km);
      });
      env.push(r);
    }
    const colPairs = [];
    combos.forEach((c, ci) => {
      for (let q = nT; q < fe.elems.length; q++) {
        let N = 0, M1 = 0, M2 = 0;
        for (const k in c.f) { if (!res.N[k]) continue; N += c.f[k] * res.N[k][q]; M1 += c.f[k] * res.M1[k][q]; M2 += c.f[k] * res.M2[k][q]; }
        colPairs.push({ N, M: Math.max(Math.abs(M1), Math.abs(M2)), kmod: timber ? c.kmod : 1, ci });
      }
    });
    return { ok: true, fe, cases, res, Ncombo, env, colPairs };
  }

  /* Longueurs de flambement */
  function lcr(geo, m) {
    if (m.g === 'top') return { Lin: m.L, Lout: m.L / geo.panelSub[m.i] };
    if (m.g === 'bot') {
      const r = geo.restr;
      for (let j = 0; j < r.length - 1; j++) if (m.i >= r[j] && m.i < r[j + 1]) return { Lin: m.L, Lout: (r[j + 1] - r[j]) * geo.truss.dx };
      return { Lin: m.L, Lout: geo.P_span };
    }
    return { Lin: m.L, Lout: m.L };
  }

  /* Flexion locale de membrure supérieure si pannes entre nœuds (charge gravitaire ELU) */
  function topLocalMoment(ctx, m, purl) {
    const sub = ctx.geo.panelSub[m.i];
    if (sub <= 1) return 0;
    const { lp, geo } = ctx, ca = Math.cos(geo.shape.alpha), Lp = m.L, e = geo.e;
    const q = 1.35 * (lp.gRoof + purl.sec.mass * GRAV / purl.a) + 1.5 * lp.s * ca;
    const F = q * (Lp / sub) * e * ca;
    const coef = sub % 2 === 0 ? sub / 8 : (sub * sub - 1) / (8 * sub);
    const M = F * Lp * coef;
    return ctx.mat.kind === 'timber' ? M / 0.9 : M;
  }

  function memberUtil(ctx, s, m, env, purl) {
    const L = lcr(ctx.geo, m);
    const Nt = ctx.mat.kind === 'timber' ? env.NtK : env.Nt;
    const Nc = ctx.mat.kind === 'timber' ? env.NcK : env.Nc;
    const Mloc = m.g === 'top' ? topLocalMoment(ctx, m, purl) : 0;
    return uAxial(ctx, s, L.Lin, L.Lout, Nt, Nc, Mloc);
  }

  function sizeGroup(ctx, members, envs, minA, purl) {
    const list = ctx.mat.truss;
    for (const s of list) {
      if (s.A < minA - 1e-9) continue;
      let ok = true, worst = { u: 0 };
      for (const m of members) {
        const r = memberUtil(ctx, s, m, envs[m.q], purl);
        if (r.u > worst.u) worst = Object.assign(r, { q: m.q });
        if (r.u > 1) { ok = false; break; }
      }
      if (ok) return { sec: s, ok: true, worst };
    }
    // aucun profil du catalogue ne convient : on retient le plus favorable pour afficher le taux
    let best = null;
    for (const s of list) {
      let worst = { u: 0 };
      for (const m of members) { const r = memberUtil(ctx, s, m, envs[m.q], purl); if (r.u > worst.u) worst = Object.assign(r, { q: m.q }); }
      if (!best || worst.u < best.worst.u) best = { sec: s, ok: false, worst };
    }
    return best;
  }

  function sizeColumn(ctx, pairs, minI) {
    let best = null;
    for (const s of ctx.mat.column) {
      if (s.Iy < minI - 1e-9) continue;
      const r = uColumn(ctx, s, pairs);
      if (r.u <= 1) return { sec: s, ok: true, u: r.u, crit: r.crit };
      if (!best || r.u < best.u) best = { sec: s, ok: false, u: r.u, crit: r.crit };
    }
    return best || { sec: ctx.mat.column[ctx.mat.column.length - 1], ok: false, u: 9, crit: 'hors catalogue' };
  }

  function serviceability(ctx, an) {
    const { P, geo, mat } = ctx, t = geo.truss, d = an.res.disp;
    const kdef = mat.kind === 'timber' ? mat.tg.kdef : 0;
    const refG = (d.G[3 * t.B[0] + 1] + d.G[3 * t.B[t.n] + 1]) / 2;
    const refS = (d.S[3 * t.B[0] + 1] + d.S[3 * t.B[t.n] + 1]) / 2;
    let defl = 0;
    for (let k = 0; k < t.nodes.length; k++) {
      const w = -((d.G[3 * k + 1] - refG) * (1 + kdef) + (d.S[3 * k + 1] - refS));
      if (w > defl) defl = w;
    }
    let drift = 0;
    for (const name of ['W2L', 'W2R', 'W1L', 'W1R']) {
      for (const n of [t.B[0], t.B[t.n]]) drift = Math.max(drift, Math.abs(d[name][3 * n] + d.G[3 * n]));
    }
    return { defl, deflLim: P.span / geo.roofing.deflRatio, drift, driftLim: P.colH / 150 };
  }

  /* ---------------- Stabilité d'ensemble : contreventements, butons, filants ---------------- */
  function pickRod(N) {
    let last = null;
    for (const s of PS.cat.steel.ROD) {
      const NRd = Math.min(s.A * 235, 0.9 * s.As * 360 / 1.25) / 1000;
      last = { sec: s, N, NRd, u: N / NRd };
      if (N <= NRd) return Object.assign(last, { ok: true });
    }
    return Object.assign(last, { ok: false });
  }
  function pickStrut(ctx, N, L) {
    const sctx = { mat: { kind: 'steel', fy: 235 } };
    let last = null;
    for (const s of ctx.struts) {
      const r = uAxial(sctx, s, L, L, 0, Math.max(N, 0.01));
      last = { sec: s, N, u: r.u, crit: r.crit };
      if (r.u <= 1) return Object.assign(last, { ok: true });
    }
    return Object.assign(last, { ok: false });
  }
  function gableAvgH(ctx) {
    const { P, geo } = ctx; let s = 0; const k = 40;
    for (let i = 0; i <= k; i++) s += geo.shape.f(P.span * i / k) * (i === 0 || i === k ? 0.5 : 1);
    return s / k;
  }
  function sizeStability(ctx, an) {
    const { P, geo, lp } = ctx, t = geo.truss, e = geo.e;
    const Hg = P.colH + gableAvgH(ctx);
    const w = lp.qp * (lp.cpeD + 0.3) * Hg / 2;          // kN/m sur la poutre au vent (moitié haute du pignon)
    const V = 1.5 * w * P.span / 2;                        // effort tranchant d'appui = réaction transmise à chaque long-pan
    let maxLd = 0;
    for (const [a, b] of geo.roofGroups) {
      const na = t.nodes[t.T[a]], nb = t.nodes[t.T[b]];
      maxLd = Math.max(maxLd, Math.hypot(Math.hypot(nb.x - na.x, nb.y - na.y), e));
    }
    const rodRoof = pickRod(V * maxLd / e);
    const hLev = P.colH / geo.wallLevels, LdW = Math.hypot(hLev, e);
    const rodWall = pickRod(V * LdW / e);
    const strut = pickStrut(ctx, V, e);
    let Nb = 0;
    t.members.forEach((m, q) => { if (m.g === 'bot') Nb = Math.max(Nb, an.env[q].Nc, 0.5 * an.env[q].Nt); });
    const tie = pickStrut(ctx, Math.max(1, 0.025 * Nb), e);
    return { w, V, Hg, rodRoof, rodWall, strut, tie, LdW, maxLd };
  }

  /* ---------------- Métré de base (masse, utilisé aussi pour la carte des limites) ---------------- */
  function quantities(ctx, secs, purl, stab) {
    const { P, geo } = ctx, t = geo.truss, nF = geo.nFrames, e = geo.e;
    let trussMass = 0, trussLen = 0;
    for (const m of t.members) { trussMass += secs[m.g].mass * m.L; trussLen += m.L; }
    const q = {};
    q.truss = trussMass * nF;
    q.connections = 0.10 * q.truss;
    q.cols = 2 * nF * P.colH * secs.col.mass;
    q.purlins = geo.purlins.length * P.length * purl.sec.mass;
    let roofRodLen = 0;
    for (const [a, b] of geo.roofGroups) {
      const na = t.nodes[t.T[a]], nb = t.nodes[t.T[b]];
      roofRodLen += 2 * Math.hypot(Math.hypot(nb.x - na.x, nb.y - na.y), e);
    }
    const nBr = geo.braced.length;
    q.rodRoof = roofRodLen * nBr * stab.rodRoof.sec.mass;
    q.rodWall = 2 * nBr * geo.wallLevels * 2 * stab.LdW * stab.rodWall.sec.mass;
    const eaveStruts = (t.T[0] === t.B[0] ? 0 : 1) + (t.T[t.n] === t.B[t.n] ? 0 : 1);
    q.struts = (eaveStruts * P.length + 2 * nBr * (geo.wallLevels - 1) * e) * stab.strut.sec.mass;
    q.ties = geo.ties.length * P.length * stab.tie.sec.mass;
    q.total = q.truss + q.connections + q.cols + q.purlins + q.rodRoof + q.rodWall + q.struts + q.ties;
    q.area = P.span * P.length;
    q.perM2 = q.total / q.area;
    q.trussUnit = trussMass * 1.10;
    q.trussLen = trussLen;
    return q;
  }

  /* ---------------- Diagnostic ---------------- */
  const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
  function diagnose(ctx, R) {
    const { P, geo, mat } = ctx, out = [];
    const push = (id, status, title, value, explain) => out.push({ id, status, title, value, explain });
    const timber = mat.kind === 'timber';

    // Pente et couverture
    const sl = geo.shape.slope, minS = geo.roofing.minSlope;
    push('pente', sl >= minS - 1e-9 ? 'ok' : 'bad', 'Pente de couverture',
      `${fmt(sl * 100, 1)} % (${fmt(geo.shape.alpha * 180 / Math.PI, 1)}°) — minimum ${geo.roofing.label.toLowerCase()} : ${fmt(minS * 100, 0)} %`,
      sl >= minS - 1e-9
        ? 'La pente suffit pour évacuer l’eau avec cette couverture.'
        : P.typo === 'flat'
          ? 'Une poutre treillis parfaitement plate ne convient ni au zinc ni au verre : l’eau stagne. Donnez une pente de forme à la membrure supérieure.'
          : 'Sous la pente minimale, l’eau stagne et les recouvrements ne sont plus étanches. Augmentez la hauteur de la ferme.');

    // Proportions
    const depth = P.typo === 'flat' ? P.trussH : geo.shape.hmax;
    const ratio = P.span / depth;
    const lim = P.typo === 'flat' ? [15, 25] : [8, 16];
    push('proportion', ratio <= lim[0] ? 'ok' : ratio <= lim[1] ? 'warn' : 'bad', 'Proportion portée / hauteur',
      `l / h = ${fmt(ratio, 1)} (${P.typo === 'flat' ? 'usuel ≤ 15' : 'usuel ≤ 8'})`,
      'Les membrures forment un couple qui équilibre le moment de flexion : l’effort vaut environ M / h. Une ferme deux fois plus basse porte des efforts deux fois plus grands dans ses membrures.');

    // Angles des diagonales
    const ang = geo.truss.diagAngles;
    if (ang.length) {
      const amin = Math.min(...ang), amax = Math.max(...ang);
      push('angles', amin >= 20 && amax <= 65 ? 'ok' : 'warn', 'Inclinaison des diagonales',
        `de ${fmt(amin, 0)}° à ${fmt(amax, 0)}° (idéal 35° à 55°, acceptable 20° à 65°)`,
        'Une diagonale trop couchée transmet l’effort tranchant avec un grand effort normal ; trop redressée, elle devient longue et les nœuds se resserrent. Autour de 45°, le treillis travaille le mieux.');
    }

    // Pannes aux nœuds
    const pm = geo.roofing.purlinMax;
    push('pannes', geo.lpMax <= pm + 1e-9 ? 'ok' : 'warn', 'Pannes posées aux nœuds',
      `panneau de ${fmt(geo.lpMax, 2)} m pour ${fmt(pm, 1)} m admissibles (${geo.roofing.label.toLowerCase()})`,
      geo.lpMax <= pm + 1e-9
        ? 'Chaque panne repose sur un nœud : la membrure supérieure ne travaille qu’en effort normal.'
        : 'Des pannes intermédiaires tombent entre deux nœuds : la membrure supérieure fléchit en plus d’être comprimée, il faut la renforcer. Augmentez le nombre de panneaux.');

    // Résistance des barres
    if (R.error) {
      push('resistance', 'bad', 'Stabilité de la ferme', R.error, 'Le modèle ne trouve pas d’équilibre stable.');
    } else {
      const fails = [];
      let umax = 0, gov = '';
      for (const g of [...GROUPS, 'col']) {
        const s = R.sizing[g]; if (!s) continue;
        const u = g === 'col' ? s.u : s.worst.u;
        if (!s.ok) fails.push(PS.GROUP_LABEL[g]);
        if (u > umax) { umax = u; gov = `${PS.GROUP_LABEL[g].toLowerCase()}, ${g === 'col' ? s.crit : s.worst.crit}`; }
      }
      push('resistance', fails.length ? 'bad' : 'ok', 'Résistance des barres',
        fails.length ? `aucun profil du catalogue ne suffit : ${fails.join(', ').toLowerCase()}` : `taux maximal ${fmt(umax * 100, 0)} % (${gov})`,
        fails.length
          ? 'Les efforts dépassent ce que peut reprendre le plus fort profil du catalogue. Réduisez la portée ou l’entraxe, ou augmentez la hauteur de la ferme.'
          : 'Chaque groupe de barres reçoit le profil le plus léger qui résiste à toutes les combinaisons de charges (traction, flambement, élancement).');
    }

    // Flèche
    if (R.sls) {
      const okD = R.sls.defl <= R.sls.deflLim * 1.0001;
      push('fleche', okD ? 'ok' : 'bad', 'Flèche de la ferme',
        `${fmt(R.sls.defl * 1000, 0)} mm pour l / ${geo.roofing.deflRatio} = ${fmt(R.sls.deflLim * 1000, 0)} mm${timber ? ' (fluage inclus)' : ''}`,
        okD ? `Les membrures ont été renforcées si nécessaire pour limiter la déformation${P.roofing === 'glass' ? ' — le verre exige une structure plus raide' : ''}.`
          : 'Même avec les plus fortes membrures, la ferme se déforme trop. Augmentez sa hauteur.');
      const okH = R.sls.drift <= R.sls.driftLim * 1.0001;
      push('tete', okH ? 'ok' : 'bad', 'Déplacement en tête de poteau',
        `${fmt(R.sls.drift * 1000, 0)} mm sous vent pour H / 150 = ${fmt(R.sls.driftLim * 1000, 0)} mm`,
        'Les poteaux encastrés en pied reprennent seuls le vent transversal (ferme articulée en tête) : leur raideur fixe le déplacement horizontal.');
    }

    // Pannes
    if (R.purl) {
      push('entraxe', !R.purl.ok ? 'bad' : geo.e > (timber ? 6.5 : 8) ? 'warn' : 'ok', 'Portée des pannes',
        `entraxe ${fmt(geo.e, 2)} m → ${R.purl.sec.label}${R.purl.ok ? '' : ' insuffisant'}`,
        'Les pannes franchissent l’entraxe entre fermes. Doubler l’entraxe multiplie leur moment par 4 et leur flèche par 16.');
    }

    // Contreventement
    if (R.stab) {
      const ok = R.stab.rodRoof.ok && R.stab.rodWall.ok && R.stab.strut.ok;
      push('stabilite', ok ? 'ok' : 'warn', 'Contreventement',
        `croix ${R.stab.rodRoof.sec.label} en toiture, ${R.stab.rodWall.sec.label} en long-pan`,
        'Le vent sur les pignons est ramené par la poutre au vent de toiture (travées d’extrémité) vers les palées de stabilité des long-pans, puis aux fondations.');
    }

    // Transport
    const chordH = R.secs ? R.secs.top.h / 1000 : 0.1;
    const Ht = geo.shape.hmax + chordH;
    const pieces = Math.ceil(P.span / 12 - 1e-9);
    push('transport', Ht <= 4.0 ? 'ok' : 'warn', 'Transport et montage',
      `ferme de ${fmt(Ht, 2)} m de haut, ${pieces > 1 ? `livrée en ${pieces} tronçons éclissés (barres ≤ 12 m)` : 'livrée d’une pièce'}`,
      Ht <= 2.55
        ? 'La ferme couchée tient dans le gabarit routier (2,55 m de large).'
        : Ht <= 4.0
          ? 'Trop haute pour voyager à plat (2,55 m) : transport debout sur remorque surbaissée, ou demi-fermes assemblées au sol sur le chantier.'
          : 'Au-delà de 4 m de haut : convoi exceptionnel, ou livraison en éléments assemblés sur chantier avant levage.');

    // Portée typique
    const pr = timber ? [30, 45] : [40, 60];
    push('portee', P.span <= pr[0] ? 'ok' : 'warn', 'Domaine d’emploi',
      `portée ${fmt(P.span, 1)} m (${timber ? 'bois' : 'acier'} : courant jusqu’à ${pr[0]} m)`,
      'Au-delà, on passe à d’autres systèmes : fermes à membrures parallèles de grande hauteur, arcs, structures tendues.');

    // Longueur
    if (!timber) push('dilatation', P.length <= 60 ? 'ok' : 'warn', 'Dilatation thermique',
      `longueur ${fmt(P.length, 1)} m (joint de dilatation au-delà de 50 à 60 m)`,
      'L’acier s’allonge d’environ 0,6 mm par mètre pour 50 °C d’écart : un long bâtiment se fractionne par des joints.');

    // Masse
    if (R.qty) {
      const m2 = R.qty.perM2;
      push('masse', m2 <= 35 ? 'ok' : m2 <= 70 ? 'warn' : 'bad', 'Économie de matière',
        `${fmt(m2, 1)} kg/m² d’emprise (repère : 15 à 35 kg/m²)`,
        m2 > 70
          ? 'La structure pèse plus du double des usages : elle tient, mais au prix de profils démesurés. Ce n’est plus une proposition raisonnable.'
          : timber ? 'Masse du bois et des pièces métalliques rapportée à la surface couverte.' : 'Une charpente métallique légère de hangar se situe entre 15 et 35 kg/m² d’emprise.');
    }

    const rank = { ok: 0, warn: 1, bad: 2 };
    const worst = out.reduce((w, d) => rank[d.status] > rank[w] ? d.status : w, 'ok');
    return { items: out, verdict: worst };
  }

  /* ---------------- Calcul principal ---------------- */
  PS.compute = function (Pin, opts) {
    opts = opts || {};
    const P = Object.assign({}, PS.DEFAULTS, Pin);
    const geo = PS.buildGeometry(P);
    geo.P_span = P.span;
    const ctx = makeCtx(P, geo);
    const t = geo.truss;
    t.members.forEach((m, q) => { m.q = q; });
    const groupMembers = { top: [], bot: [], vert: [], diag: [] };
    for (const m of t.members) groupMembers[m.g].push(m);

    const purl = sizePurlins(ctx);
    const secs = { top: ctx.mat.truss[0], bot: ctx.mat.truss[0], vert: ctx.mat.truss[0], diag: ctx.mat.truss[0], col: ctx.mat.column[0] };
    const minA = { top: 0, bot: 0, vert: 0, diag: 0 };
    let minI = 0, an = null, sizing = {}, sls = null, error = null;

    for (let it = 0; it < 40; it++) {
      an = analyse(ctx, secs, purl);
      if (!an.ok) { error = an.error; break; }
      const next = {};
      sizing = {};
      for (const g of GROUPS) {
        if (!groupMembers[g].length) continue;
        const r = sizeGroup(ctx, groupMembers[g], an.env, minA[g], purl);
        next[g] = r.sec; sizing[g] = r;
      }
      const rc = sizeColumn(ctx, an.colPairs, minI);
      next.col = rc.sec; sizing.col = rc;
      const same = Object.keys(next).every((g) => next[g] === secs[g]);
      Object.assign(secs, next);
      // Après quelques itérations, les sections ne peuvent plus que grossir : convergence garantie
      // (le poids propre et l'hyperstaticité poteaux / ferme peuvent sinon faire osciller le choix).
      if (it >= 3) {
        for (const g of GROUPS) if (secs[g]) minA[g] = Math.max(minA[g], secs[g].A);
        minI = Math.max(minI, secs.col.Iy);
      }
      if (!same) continue;
      sls = serviceability(ctx, an);
      const anyFail = Object.values(sizing).some((s) => !s.ok);
      if (anyFail) break;
      let bumped = false;
      if (sls.defl > sls.deflLim) {
        for (const g of ['top', 'bot']) {
          const cur = secs[g], nx = ctx.mat.truss.find((s) => s.A >= cur.A * 1.15);
          if (nx) { minA[g] = nx.A; bumped = true; }
        }
      }
      if (sls.drift > sls.driftLim) {
        const cur = secs.col, nx = ctx.mat.column.find((s) => s.Iy >= cur.Iy * 1.2);
        if (nx) { minI = nx.Iy; bumped = true; }
      }
      if (!bumped) break;
    }

    const R = { P, geo, ctx, secs, purl, sizing, error, lp: ctx.lp, combos: ctx.combos, material: ctx.mat };
    if (!error && an && an.ok) {
      R.an = an;
      R.sls = sls || serviceability(ctx, an);
      R.stab = sizeStability(ctx, an);
      R.qty = quantities(ctx, secs, purl, R.stab);
      R.members = t.members.map((m) => {
        const r = memberUtil(ctx, secs[m.g], m, an.env[m.q], purl);
        const L = lcr(geo, m);
        return { g: m.g, a: m.a, b: m.b, L: m.L, sec: secs[m.g], env: an.env[m.q], u: r.u, crit: r.crit, lam: r.lam, Lin: L.Lin, Lout: L.Lout };
      });
    }
    R.diag = diagnose(ctx, R);
    if (!opts.light && !error && R.an) PS.detail(R);
    return R;
  };

  /* ---------------- Détail : maquette 3D, assemblages, nomenclature ---------------- */
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  const polyArea = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };

  PS.detail = function (R) {
    const { P, geo, secs, purl, stab, ctx } = R, t = geo.truss, e = geo.e, l = P.span, L = P.length, H = P.colH;
    const timber = ctx.mat.kind === 'timber';
    const nodes = t.nodes;
    const X = (x) => x - l / 2, Z = (k) => k * e - L / 2;
    const members = [];
    const hTop = secs.top.h / 1000, hBot = secs.bot.h / 1000;

    // Directions de membrure supérieure aux nœuds (pour les coupes des barres de treillis)
    const chordDirAt = (nodeIdx) => {
      const nd = nodes[nodeIdx];
      if (nd.kind === 'B' && t.T[nd.i] !== nodeIdx) return [[1, 0], hBot / 2];
      const k = Math.min(t.n - 1, nd.i), p = t.topPanels[k];
      return [[p.dx / p.len, p.dy / p.len], hTop / 2];
    };
    const trimAt = (nodeIdx, dir, len) => {
      const [cd, hh] = chordDirAt(nodeIdx);
      const s = Math.abs(dir[0] * cd[1] - dir[1] * cd[0]);
      return Math.min(0.35 * len, hh / Math.max(0.15, s));
    };

    // Ferme type : barres 2D avec leurs résultats
    const trussBars = R.members.map((mr, q) => {
      const a = nodes[mr.a], b = nodes[mr.b];
      const d = [(b.x - a.x) / mr.L, (b.y - a.y) / mr.L];
      const web = mr.g === 'vert' || mr.g === 'diag';
      return Object.assign({}, mr, { q, d, up: [-d[1], d[0], 0], t0: web ? trimAt(mr.a, d, mr.L) : 0, t1: web ? trimAt(mr.b, [-d[0], -d[1]], mr.L) : 0 });
    });

    for (let f = 0; f < geo.nFrames; f++) {
      const z = Z(f);
      for (const tb of trussBars) {
        const a = nodes[tb.a], b = nodes[tb.b];
        const pa = [X(a.x) + tb.d[0] * tb.t0, H + a.y + tb.d[1] * tb.t0, z];
        const pb = [X(b.x) - tb.d[0] * tb.t1, H + b.y - tb.d[1] * tb.t1, z];
        members.push({ role: tb.g, a: pa, b: pb, up: tb.up, sec: tb.sec, bar: tb.q, frame: f, u: tb.u, N: tb.env, crit: tb.crit, L: tb.L });
      }
      for (const side of [0, 1]) {
        const x = side ? X(l) : X(0);
        members.push({ role: 'col', a: [x, 0, z], b: [x, H - hBot / 2, z], up: [1, 0, 0], sec: secs.col, frame: f, u: R.sizing.col.u, crit: R.sizing.col.crit, L: H });
      }
    }

    // Pannes
    const offP = (hTop / 2 + purl.sec.h / 2000);
    for (const p of geo.purlins) {
      for (let b = 0; b < geo.nBays; b++) {
        members.push({
          role: 'purlin', a: [X(p.x) + p.nx * offP, H + p.y + p.ny * offP, Z(b)], b: [X(p.x) + p.nx * offP, H + p.y + p.ny * offP, Z(b + 1)],
          up: [p.nx, p.ny, 0], sec: purl.sec, u: purl.umax, crit: purl.crit, L: e,
        });
      }
    }

    // Contreventements
    for (const b of geo.braced) {
      for (const [ia, ib] of geo.roofGroups) {
        const na = nodes[t.T[ia]], nb = nodes[t.T[ib]];
        const A0 = [X(na.x), H + na.y, Z(b)], B1 = [X(nb.x), H + nb.y, Z(b + 1)];
        const B0 = [X(nb.x), H + nb.y, Z(b)], A1 = [X(na.x), H + na.y, Z(b + 1)];
        members.push({ role: 'rodRoof', a: A0, b: B1, up: [0, 1, 0], sec: stab.rodRoof.sec, u: stab.rodRoof.u, crit: 'traction', L: Math.hypot(...A0.map((v, i) => v - B1[i])) });
        members.push({ role: 'rodRoof', a: B0, b: A1, up: [0, 1, 0], sec: stab.rodRoof.sec, u: stab.rodRoof.u, crit: 'traction', L: Math.hypot(...B0.map((v, i) => v - A1[i])) });
      }
      for (const x of [X(0), X(l)]) {
        for (let j = 0; j < geo.wallLevels; j++) {
          const y0 = H * j / geo.wallLevels, y1 = H * (j + 1) / geo.wallLevels;
          members.push({ role: 'rodWall', a: [x, y0, Z(b)], b: [x, y1, Z(b + 1)], up: [1, 0, 0], sec: stab.rodWall.sec, u: stab.rodWall.u, crit: 'traction', L: stab.LdW });
          members.push({ role: 'rodWall', a: [x, y1, Z(b)], b: [x, y0, Z(b + 1)], up: [1, 0, 0], sec: stab.rodWall.sec, u: stab.rodWall.u, crit: 'traction', L: stab.LdW });
          if (j > 0) members.push({ role: 'strut', a: [x, y0, Z(b)], b: [x, y0, Z(b + 1)], up: [0, 1, 0], sec: stab.strut.sec, u: stab.strut.u, crit: stab.strut.crit, L: e });
        }
      }
    }
    for (const side of [0, 1]) {
      const i = side ? t.n : 0;
      if (t.T[i] === t.B[i]) continue;             // la panne sablière joue le rôle de buton
      for (let b = 0; b < geo.nBays; b++) members.push({ role: 'strut', a: [X(side ? l : 0), H, Z(b)], b: [X(side ? l : 0), H, Z(b + 1)], up: [0, 1, 0], sec: stab.strut.sec, u: stab.strut.u, crit: stab.strut.crit, L: e });
    }
    for (const i of geo.ties) {
      const nd = nodes[t.B[i]];
      for (let b = 0; b < geo.nBays; b++) members.push({ role: 'tie', a: [X(nd.x), H, Z(b)], b: [X(nd.x), H, Z(b + 1)], up: [0, 1, 0], sec: stab.tie.sec, u: stab.tie.u, crit: stab.tie.crit, L: e });
    }

    // Goussets (acier : plats soudés/boulonnés ; bois : plats métalliques insérés en âme)
    const gussets = [];
    let gussetMass = 0, bolts = 0;
    const adj = nodes.map(() => []);
    trussBars.forEach((tb) => { adj[tb.a].push({ tb, dir: tb.d }); adj[tb.b].push({ tb, dir: [-tb.d[0], -tb.d[1]] }); });
    adj.forEach((list, k) => {
      if (list.length < 2) return;
      const nd = nodes[k];
      const pts = [];
      let Nmax = 0;
      for (const { tb, dir } of list) {
        const hm = tb.sec.h / 1000, web = tb.g === 'vert' || tb.g === 'diag';
        const along = (web ? hm * 1.6 + 0.08 : hm * 0.9 + 0.05) + (web ? (tb.a === k ? tb.t0 : tb.t1) : 0);
        const hw = hm / 2 + (timber ? -0.01 : 0.015);
        const n = [-dir[1], dir[0]];
        for (const sgn of [-1, 1]) pts.push([nd.x + dir[0] * along + n[0] * hw * sgn, nd.y + dir[1] * along + n[1] * hw * sgn]);
        pts.push([nd.x + n[0] * hw, nd.y + n[1] * hw], [nd.x - n[0] * hw, nd.y - n[1] * hw]);
        const Na = Math.max(tb.N ? 0 : 0, tb.env.Nt, tb.env.Nc);
        Nmax = Math.max(Nmax, Na);
        bolts += timber ? Math.max(4, Math.ceil(Na / 14)) : Math.max(2, Math.ceil(Na / 60));
      }
      const poly = hull(pts);
      const th = timber ? 0.008 : Nmax < 150 ? 0.008 : Nmax < 300 ? 0.010 : Nmax < 500 ? 0.012 : Nmax < 800 ? 0.015 : 0.020;
      const area = polyArea(poly);
      gussets.push({ node: k, poly: poly.map(([x, y]) => [X(x), H + y]), t: th, area, Nmax });
      gussetMass += area * th * 7850;
    });
    gussetMass *= geo.nFrames;
    bolts *= geo.nFrames;

    // Platines de pied
    const cs = secs.col;
    const bpT = timber ? 0.015 : cs.h <= 200 ? 0.020 : cs.h <= 300 ? 0.025 : 0.030;
    const bp = { w: (cs.h + 150) / 1000, d: (cs.b + 150) / 1000, t: bpT, anchor: cs.h <= 240 ? 'M20' : 'M24' };
    const basePlates = [];
    for (let f = 0; f < geo.nFrames; f++) for (const side of [0, 1]) basePlates.push({ x: side ? X(l) : X(0), z: Z(f) });
    const bpMass = basePlates.length * bp.w * bp.d * bp.t * 7850;

    // Couverture : plans de toiture
    const offC = hTop / 2 + purl.sec.h / 1000 + 0.02;
    const planes = geo.shape.twoSided ? [[0, t.n / 2], [t.n / 2, t.n]] : [[0, t.n]];
    const roofPlanes = planes.map(([i0, i1]) => {
      const a = nodes[t.T[i0]], b = nodes[t.T[i1]];
      const len = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      return { x0: X(a.x) + nx * offC, y0: H + a.y + ny * offC, x1: X(b.x) + nx * offC, y1: H + b.y + ny * offC, nx, ny, len };
    });

    R.model3d = { members, gussets, basePlates, bp, roofPlanes, trussBars, hTop, hBot };

    // ---------- Nomenclature ----------
    const rows = [];
    const nF = geo.nFrames;
    const addRow = (cat, item, sec, qty, unitLen, note, massOverride) => {
      const mass = massOverride != null ? massOverride : sec.mass * unitLen * qty;
      rows.push({ cat, item, profile: sec ? sec.label : '—', qty, unitLen, totalLen: unitLen != null ? unitLen * qty : null, unitMass: sec ? sec.mass : null, mass, note: note || '' });
    };
    // membrures continues, découpées en tronçons ≤ 12 m
    const planeLens = planes.map(([i0, i1]) => { let s = 0; for (let k = i0; k < i1; k++) s += t.topPanels[k].len; return s; });
    let splices = 0, topPieces = 0;
    const topByLen = new Map();
    for (const Lpl of planeLens) {
      const np = Math.ceil(Lpl / 12 - 1e-9); topPieces += np; splices += np - 1;
      const k = Math.round(Lpl / np * 100);
      const cur = topByLen.get(k) || { qty: 0, len: Lpl / np, split: np > 1 };
      cur.qty += np; topByLen.set(k, cur);
    }
    for (const r of topByLen.values()) addRow('Fermes', 'Membrure supérieure', secs.top, r.qty * nF, r.len, r.split ? 'tronçons éclissés' : planeLens.length > 1 ? 'un arbalétrier par versant' : '');
    const botP = Math.ceil(l / 12 - 1e-9); splices += botP - 1;
    addRow('Fermes', 'Membrure inférieure', secs.bot, botP * nF, l / botP, botP > 1 ? 'tronçons éclissés' : '');
    for (const g of ['vert', 'diag']) {
      const list = trussBars.filter((tb) => tb.g === g);
      if (!list.length) continue;
      const tot = list.reduce((s, tb) => s + tb.L, 0);
      const lens = list.map((tb) => tb.L);
      addRow('Fermes', g === 'vert' ? 'Montants' : 'Diagonales', secs[g], list.length * nF, tot / list.length,
        `longueurs de ${fmt(Math.min(...lens), 2)} à ${fmt(Math.max(...lens), 2)} m`);
    }
    addRow('Fermes', timber ? 'Plaques métalliques en âme' : 'Goussets', null, gussets.length * nF, null, `épaisseur ${[...new Set(gussets.map((g) => g.t * 1000))].sort((a, b) => a - b).join(' / ')} mm`, gussetMass);
    if (splices) addRow('Fermes', 'Éclisses de chantier', null, splices * nF, null, '2 plats + 8 boulons', splices * nF * 2 * 0.25 * 0.3 * 0.01 * 7850);
    addRow('Poteaux', 'Poteaux', secs.col, 2 * nF, H, 'encastrés en pied');
    addRow('Poteaux', 'Platines de pied', null, basePlates.length, null, `${Math.round(bp.w * 1000)}×${Math.round(bp.d * 1000)}×${Math.round(bp.t * 1000)} mm, 4 tiges ${bp.anchor}`, bpMass);
    addRow('Couverture', 'Pannes', purl.sec, geo.purlins.length * geo.nBays, e, `${geo.purlins.length} files, isostatiques`);
    const cnt = (role) => members.filter((m) => m.role === role);
    const sumLen = (list) => list.reduce((s, m) => s + m.L, 0);
    const rr = cnt('rodRoof'), rw = cnt('rodWall'), st = cnt('strut'), ti = cnt('tie');
    if (rr.length) addRow('Stabilité', 'Croix de toiture (poutre au vent)', stab.rodRoof.sec, rr.length, sumLen(rr) / rr.length, 'tirants filetés + tendeurs');
    if (rw.length) addRow('Stabilité', 'Palées de stabilité (long-pans)', stab.rodWall.sec, rw.length, sumLen(rw) / rw.length, 'tirants filetés + tendeurs');
    if (st.length) addRow('Stabilité', 'Butons', stab.strut.sec, st.length, e, '');
    if (ti.length) addRow('Stabilité', 'Filants de membrure inférieure', stab.tie.sec, ti.length, e, '');
    const boltMass = bolts * (timber ? 0.12 : 0.25);
    addRow('Assemblages', timber ? 'Broches Ø12 (estimation)' : 'Boulons M16 classe 8.8 (estimation)', null, bolts, null, 'selon l’effort de chaque barre', boltMass);

    const total = rows.reduce((s, r) => s + r.mass, 0);
    const timberVol = timber ? (rows.filter((r) => r.profile && r.profile.startsWith(ctx.mat.tg.key)).reduce((s, r) => s + r.totalLen * r.unitMass / ctx.mat.tg.rhomean, 0)) : 0;
    const steelMass = timber ? total - rows.filter((r) => r.profile && r.profile.startsWith(ctx.mat.tg.key)).reduce((s, r) => s + r.mass, 0) : total;
    // repères distincts (profil + longueur au cm)
    const marks = new Set();
    const lenOf = (m) => Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1], m.b[2] - m.a[2]);
    for (const m of members) if (m.role !== 'top' && m.role !== 'bot') marks.add(m.sec.key + '|' + Math.round(lenOf(m) * 100));
    marks.add('top'); marks.add('bot');
    const paint = timber ? 0 : members.reduce((s, m) => s + m.sec.perim * lenOf(m), 0);
    const pieces = rows.filter((r) => r.cat !== 'Assemblages').reduce((s, r) => s + r.qty, 0);
    R.bom = {
      rows, total, perM2: total / (l * L), pieces, marks: marks.size, paint, timberVol, steelMass, bolts,
      heaviest: R.qty.trussUnit + gussetMass / nF, splices, topPieces, botPieces: botP,
    };
  };

  PS.fmt = fmt;
})(typeof window !== 'undefined' ? window : globalThis);
