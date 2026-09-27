// Vérifications en ligne de commande : node tests/run.js
const path = require('path');
for (const f of ['catalogue', 'fem', 'model', 'design']) require(path.join(__dirname, '..', 'js', f + '.js'));
const PS = globalThis.PS;
let fails = 0;
const near = (a, b, tol, msg) => { const ok = Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)); console.log((ok ? 'OK  ' : 'FAIL') + ' ' + msg + ` : ${a.toFixed(5)} (attendu ${b.toFixed(5)})`); if (!ok) fails++; };

// 1. Poutre sur deux appuis, charge centrée : flèche PL³/48EI
{
  const E = 210e6, I = 1e-5, A = 1e-2, L = 4, P = 10;
  const nodes = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }];
  const elems = [{ i: 0, j: 1, type: 'beam', E, A, I }, { i: 1, j: 2, type: 'beam', E, A, I }];
  const supports = [{ n: 0, ux: 1, uy: 1 }, { n: 2, uy: 1 }];
  const F = new Float64Array(9); F[4] = -P;
  const r = PS.fem.solve({ nodes, elems, supports }, { P: F });
  near(-r.disp.P[4], P * L ** 3 / (48 * E * I), 1e-9, 'flèche poutre');
  near(Math.abs(r.M2.P[0]), P * L / 4, 1e-9, 'moment à mi-portée');
}
// 2. Console encastrée : flèche PL³/3EI
{
  const E = 210e6, I = 2e-5, A = 1e-2, L = 5, P = 7;
  const nodes = [{ x: 0, y: 0 }, { x: 0, y: L }];
  const r = PS.fem.solve({ nodes, elems: [{ i: 0, j: 1, type: 'beam', E, A, I }], supports: [{ n: 0, ux: 1, uy: 1, rz: 1 }] }, { P: Float64Array.from([0, 0, 0, P, 0, 0]) });
  near(r.disp.P[3], P * L ** 3 / (3 * E * I), 1e-9, 'flèche console');
}
// 3. Triangle articulé : efforts par équilibre des nœuds
{
  const E = 210e6, A = 1e-3;
  const nodes = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1.5 }];
  const elems = [{ i: 0, j: 1, type: 'bar', E, A }, { i: 0, j: 2, type: 'bar', E, A }, { i: 1, j: 2, type: 'bar', E, A }];
  const F = new Float64Array(9); F[7] = -10;
  const r = PS.fem.solve({ nodes, elems, supports: [{ n: 0, ux: 1, uy: 1 }, { n: 1, uy: 1 }] }, { P: F });
  // arbalétrier : N = -R/sin(a), R = 5, sin a = 1.5/2.5 → -8.333 ; entrait : +R/tan a = 6.667
  near(r.N.P[1], -5 / 0.6, 1e-9, 'arbalétrier comprimé');
  near(r.N.P[0], 5 / 0.75, 1e-9, 'entrait tendu');
}
// 4. Mécanisme détecté
{
  const r = PS.fem.solve({ nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], elems: [{ i: 0, j: 1, type: 'bar', E: 1, A: 1 }, { i: 1, j: 2, type: 'bar', E: 1, A: 1 }], supports: [{ n: 0, ux: 1, uy: 1 }, { n: 2, ux: 1, uy: 1 }] }, { P: new Float64Array(9) });
  console.log((r.ok ? 'FAIL' : 'OK  ') + ' mécanisme détecté : ' + r.error); if (r.ok) fails++;
}
// 5. Propriétés de sections vs tables
{
  const ipe200 = PS.cat.steel.IPE.find((s) => s.key === 'IPE 200');
  near(ipe200.A / 100, 28.48, 0.01, 'IPE 200 A (cm²)');
  near(ipe200.Iy / 1e4, 1943, 0.01, 'IPE 200 Iy (cm⁴)');
  near(ipe200.Wply / 1e3, 220.6, 0.01, 'IPE 200 Wpl,y (cm³)');
  near(ipe200.It / 1e4, 6.98, 0.04, 'IPE 200 It (cm⁴)');
  const hea200 = PS.cat.steel.HEA.find((s) => s.key === 'HEA 200');
  near(hea200.A / 100, 53.83, 0.01, 'HEA 200 A (cm²)');
  near(hea200.Iy / 1e4, 3692, 0.01, 'HEA 200 Iy (cm⁴)');
  const shs = PS.cat.steel.SHS.find((s) => s.key === 'SHS 100×5');
  near(shs.A / 100, 18.7, 0.01, 'SHS 100×5 A (cm²)');
  near(shs.Iy / 1e4, 279, 0.01, 'SHS 100×5 I (cm⁴)');
  near(shs.mass, 14.7, 0.01, 'SHS 100×5 masse (kg/m)');
}
// 6. Calcul complet
function show(label, P) {
  const t0 = performance.now();
  const R = PS.compute(P);
  const t1 = performance.now();
  const s = R.secs;
  console.log(`\n== ${label} (${(t1 - t0).toFixed(1)} ms) ==`);
  if (R.error) { console.log('ERREUR', R.error); return R; }
  console.log(`n=${R.geo.n} panneaux, dx=${R.geo.truss.dx.toFixed(2)} m, travées ${R.geo.nBays}×${R.geo.e.toFixed(2)} m, pente ${(R.geo.shape.slope * 100).toFixed(1)} %`);
  console.log(`sk=${R.lp.sk.toFixed(2)} s=${R.lp.s.toFixed(2)} qp=${R.lp.qp.toFixed(3)} kN/m²`);
  for (const g of ['top', 'bot', 'vert', 'diag']) if (R.sizing[g]) console.log(`  ${g.padEnd(5)} ${s[g].label.padEnd(18)} u=${(R.sizing[g].worst.u * 100).toFixed(0)}% ${R.sizing[g].worst.crit} ${R.sizing[g].ok ? '' : 'ÉCHEC'}`);
  console.log(`  col   ${s.col.label.padEnd(18)} u=${(R.sizing.col.u * 100).toFixed(0)}% ${R.sizing.col.crit}`);
  console.log(`  panne ${R.purl.sec.label.padEnd(18)} u=${(R.purl.umax * 100).toFixed(0)}% (${R.purl.crit})`);
  const env = R.members.reduce((a, m) => ({ t: Math.max(a.t, m.env.Nt), c: Math.max(a.c, m.env.Nc) }), { t: 0, c: 0 });
  console.log(`  Nmax traction ${env.t.toFixed(1)} kN, compression ${env.c.toFixed(1)} kN`);
  console.log(`  flèche ${(R.sls.defl * 1000).toFixed(1)} / ${(R.sls.deflLim * 1000).toFixed(0)} mm, tête ${(R.sls.drift * 1000).toFixed(1)} / ${(R.sls.driftLim * 1000).toFixed(0)} mm`);
  console.log(`  stabilité : toiture ${R.stab.rodRoof.sec.label}, palée ${R.stab.rodWall.sec.label}, buton ${R.stab.strut.sec.label}, filant ${R.stab.tie.sec.label}`);
  console.log(`  masse estimée ${(R.qty.total / 1000).toFixed(2)} t = ${R.qty.perM2.toFixed(1)} kg/m²` + (R.bom ? ` | nomenclature ${(R.bom.total / 1000).toFixed(2)} t, ${R.bom.pieces} pièces, ${R.bom.marks} repères` : ''));
  console.log(`  verdict ${R.diag.verdict} : ` + R.diag.items.filter((d) => d.status !== 'ok').map((d) => d.id + '=' + d.status).join(', '));
  return R;
}
show('défaut', {});
show('bois GL24h', { material: 'timber' });
show('verre', { roofing: 'glass' });
show('monopente', { typo: 'mono', aboutH: 0.6, trussH: 2.4 });
show('plate sans pente', { typo: 'flat', flatSlope: 0, trussH: 1.4 });
show('plate 5 %', { typo: 'flat', flatSlope: 5, trussH: 1.4 });
show('Howe 24 m', { pattern: 'howe', span: 24, trussH: 4 });
show('Warren 30 m CHS', { pattern: 'warren', span: 30, trussH: 5, trussFamily: 'CHS' });
show('trop plat 30 m h=1', { span: 30, trussH: 1 });
show('grande portée 60 m', { span: 60, trussH: 8 });
show('montagne E 1000 m', { snowRegion: 'E', altitude: 1000 });
show('about 1 m', { aboutH: 1.0, trussH: 3.5 });
// timing carte
{
  const t0 = performance.now(); let k = 0;
  for (let l = 6; l <= 60; l += 2) for (let h = 0.5; h <= 8; h += 0.3) { PS.compute({ span: l, trussH: h }, { light: true }); k++; }
  console.log(`\ncarte : ${k} cellules en ${(performance.now() - t0).toFixed(0)} ms`);
}
console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent');
