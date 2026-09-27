/* Atelier Treillis — solveur linéaire 2D (méthode des déplacements)
   Éléments « bar » (treillis articulé, effort normal seul) et « beam » (poutre d'Euler-Bernoulli).
   Unités cohérentes : kN, m. Effort normal N > 0 = traction. */
(function (G) {
  'use strict';
  const PS = G.PS = G.PS || {};

  /**
   * model = { nodes:[{x,y}], elems:[{i,j,type:'bar'|'beam',E,A,I}], supports:[{n,ux,uy,rz}] }
   * cases = { name: Float64Array(3*nNodes) [fx,fy,mz par nœud] }
   * → { ok, error?, disp:{name:Float64Array(3n)}, N:{name:Float64Array(ne)}, M1/M2:{name:Float64Array(ne)} (moments d'extrémité, repère local) }
   */
  function solve(model, cases) {
    const { nodes, elems, supports } = model;
    const nn = nodes.length, ne = elems.length;
    const hasRot = new Uint8Array(nn);
    for (const e of elems) if (e.type === 'beam') { hasRot[e.i] = 1; hasRot[e.j] = 1; }

    const dof = new Int32Array(3 * nn).fill(-1);
    let nd = 0;
    for (let k = 0; k < nn; k++) {
      dof[3 * k] = nd++; dof[3 * k + 1] = nd++;
      if (hasRot[k]) dof[3 * k + 2] = nd++;
    }
    const fixed = new Uint8Array(nd);
    for (const s of supports) {
      if (s.ux) fixed[dof[3 * s.n]] = 1;
      if (s.uy) fixed[dof[3 * s.n + 1]] = 1;
      if (s.rz && dof[3 * s.n + 2] >= 0) fixed[dof[3 * s.n + 2]] = 1;
    }
    const map = new Int32Array(nd).fill(-1);
    let nf = 0;
    for (let d = 0; d < nd; d++) if (!fixed[d]) map[d] = nf++;

    const K = new Float64Array(nf * nf);
    const geo = new Array(ne);

    for (let q = 0; q < ne; q++) {
      const e = elems[q];
      const n1 = nodes[e.i], n2 = nodes[e.j];
      const dx = n2.x - n1.x, dy = n2.y - n1.y;
      const L = Math.hypot(dx, dy), c = dx / L, s = dy / L;
      let ids, ke, m;
      if (e.type === 'bar') {
        ids = [dof[3 * e.i], dof[3 * e.i + 1], dof[3 * e.j], dof[3 * e.j + 1]];
        const k = e.E * e.A / L, cc = c * c * k, ss = s * s * k, cs = c * s * k;
        ke = [cc, cs, -cc, -cs, cs, ss, -cs, -ss, -cc, -cs, cc, cs, -cs, -ss, cs, ss];
        m = 4;
      } else {
        ids = [dof[3 * e.i], dof[3 * e.i + 1], dof[3 * e.i + 2], dof[3 * e.j], dof[3 * e.j + 1], dof[3 * e.j + 2]];
        const kl = beamLocal(e.E, e.A, e.I, L);
        const T = rot6(c, s);
        ke = mulTtKT(T, kl);
        m = 6;
      }
      geo[q] = { ids, L, c, s };
      for (let a = 0; a < m; a++) {
        const ga = map[ids[a]];
        if (ga < 0) continue;
        for (let b = 0; b < m; b++) {
          const gb = map[ids[b]];
          if (gb < 0) continue;
          K[ga * nf + gb] += ke[a * m + b];
        }
      }
    }

    // Factorisation de Cholesky (K symétrique définie positive si la structure est stable)
    let dmax = 0;
    for (let i = 0; i < nf; i++) dmax = Math.max(dmax, K[i * nf + i]);
    const tol = 1e-11 * dmax;
    for (let j = 0; j < nf; j++) {
      let sum = K[j * nf + j];
      const rj = j * nf;
      for (let k = 0; k < j; k++) sum -= K[rj + k] * K[rj + k];
      if (!(sum > tol)) return { ok: false, error: 'mécanisme : la structure n\'est pas stable' };
      const Ljj = Math.sqrt(sum);
      K[rj + j] = Ljj;
      for (let i = j + 1; i < nf; i++) {
        const ri = i * nf;
        let v = K[ri + j];
        for (let k = 0; k < j; k++) v -= K[ri + k] * K[rj + k];
        K[ri + j] = v / Ljj;
      }
    }

    const out = { ok: true, disp: {}, N: {}, M1: {}, M2: {} };
    const y = new Float64Array(nf);
    for (const name in cases) {
      const F = cases[name];
      const b = new Float64Array(nf);
      for (let k = 0; k < nn; k++) {
        for (let r = 0; r < 3; r++) {
          const d = dof[3 * k + r];
          if (d >= 0 && map[d] >= 0) b[map[d]] += F[3 * k + r];
        }
      }
      // descente / remontée
      for (let i = 0; i < nf; i++) {
        let v = b[i];
        const ri = i * nf;
        for (let k = 0; k < i; k++) v -= K[ri + k] * y[k];
        y[i] = v / K[ri + i];
      }
      const x = new Float64Array(nf);
      for (let i = nf - 1; i >= 0; i--) {
        let v = y[i];
        for (let k = i + 1; k < nf; k++) v -= K[k * nf + i] * x[k];
        x[i] = v / K[i * nf + i];
      }
      const U = new Float64Array(3 * nn);
      const full = new Float64Array(nd);
      for (let d = 0; d < nd; d++) full[d] = map[d] >= 0 ? x[map[d]] : 0;
      for (let k = 0; k < nn; k++) for (let r = 0; r < 3; r++) { const d = dof[3 * k + r]; U[3 * k + r] = d >= 0 ? full[d] : 0; }
      out.disp[name] = U;

      const Nn = new Float64Array(ne), M1 = new Float64Array(ne), M2 = new Float64Array(ne);
      for (let q = 0; q < ne; q++) {
        const e = elems[q], g = geo[q];
        if (e.type === 'bar') {
          const du = (full[g.ids[2]] - full[g.ids[0]]) * g.c + (full[g.ids[3]] - full[g.ids[1]]) * g.s;
          Nn[q] = e.E * e.A / g.L * du;
        } else {
          const ug = g.ids.map((d) => full[d]);
          const ul = [
            g.c * ug[0] + g.s * ug[1], -g.s * ug[0] + g.c * ug[1], ug[2],
            g.c * ug[3] + g.s * ug[4], -g.s * ug[3] + g.c * ug[4], ug[5],
          ];
          const kl = beamLocal(e.E, e.A, e.I, g.L);
          const f = new Array(6).fill(0);
          for (let a = 0; a < 6; a++) for (let bb = 0; bb < 6; bb++) f[a] += kl[a * 6 + bb] * ul[bb];
          Nn[q] = -f[0];
          M1[q] = f[2];
          M2[q] = f[5];
        }
      }
      out.N[name] = Nn;
      out.M1[name] = M1;
      out.M2[name] = M2;
    }
    return out;
  }

  function beamLocal(E, A, I, L) {
    const a = E * A / L, b = 12 * E * I / L ** 3, c = 6 * E * I / L ** 2, d = 4 * E * I / L, h = 2 * E * I / L;
    return [
      a, 0, 0, -a, 0, 0,
      0, b, c, 0, -b, c,
      0, c, d, 0, -c, h,
      -a, 0, 0, a, 0, 0,
      0, -b, -c, 0, b, -c,
      0, c, h, 0, -c, d,
    ];
  }
  function rot6(c, s) {
    const T = new Array(36).fill(0);
    for (const o of [0, 3]) {
      T[(o) * 6 + o] = c; T[(o) * 6 + o + 1] = s;
      T[(o + 1) * 6 + o] = -s; T[(o + 1) * 6 + o + 1] = c;
      T[(o + 2) * 6 + o + 2] = 1;
    }
    return T;
  }
  function mulTtKT(T, K) {
    const KT = new Array(36).fill(0), R = new Array(36).fill(0);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let v = 0; for (let k = 0; k < 6; k++) v += K[i * 6 + k] * T[k * 6 + j]; KT[i * 6 + j] = v; }
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let v = 0; for (let k = 0; k < 6; k++) v += T[k * 6 + i] * KT[k * 6 + j]; R[i * 6 + j] = v; }
    return R;
  }

  PS.fem = { solve };
})(typeof window !== 'undefined' ? window : globalThis);
