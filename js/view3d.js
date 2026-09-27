/* Atelier Treillis — maquette 3D (three.js r147, build UMD)
   Profilés réels extrudés et instanciés, goussets, platines, couverture zinc / verre,
   socle de maquette, personnages à l'échelle, cotes. */
(function (G) {
  'use strict';
  const PS = G.PS = G.PS || {};
  const THREE = G.THREE;
  if (!THREE) { PS.view3d = null; return; }
  const V = PS.view3d = {};

  const ROLE_COLORS = {
    top: '#2B7A73', bot: '#2F64B0', vert: '#7A5BB0', diag: '#D08A2E', col: '#56656B',
    purlin: '#A07A38', rodRoof: '#C0402E', rodWall: '#C0402E', strut: '#6E8B3D', tie: '#6E8B3D',
  };
  const MAT_COLORS = { steel: '#7F8E96', timber: '#C99258', rod: '#3E474C', plate: '#4D585E' };

  let renderer, labelRenderer, scene, camera, controls, container, tip;
  let root = null, needs = true, lastRadius = 0, lastR = null, lastD = null;
  let pickables = [];
  const geoCache = new Map();
  const tmp = { m: new THREE.Matrix4(), a: new THREE.Vector3(), b: new THREE.Vector3(), ex: new THREE.Vector3(), ey: new THREE.Vector3(), ez: new THREE.Vector3(), c: new THREE.Color() };
  const mats = {};

  const css = (name, fb) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  };

  /* ---------------- Initialisation ---------------- */
  V.init = function (el, tipEl) {
    container = el; tip = tipEl;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, G.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'gl';
    container.appendChild(renderer.domElement);

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.domElement.className = 'labels';
    container.appendChild(labelRenderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 5000);
    camera.position.set(-30, 18, -40);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.addEventListener('change', () => { needs = true; });

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a918e, 0.62);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.78);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    V._sun = sun;
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    mats.member = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.25 });
    mats.timber = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.0 });
    mats.plate = new THREE.MeshStandardMaterial({ color: MAT_COLORS.plate, roughness: 0.5, metalness: 0.35 });
    mats.socleTop = new THREE.MeshStandardMaterial({ roughness: 0.95 });
    mats.socleSide = new THREE.MeshStandardMaterial({ roughness: 0.95 });
    mats.slab = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    mats.figure = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    mats.zinc = new THREE.MeshStandardMaterial({ color: '#8E989C', roughness: 0.42, metalness: 0.55, side: THREE.DoubleSide });
    mats.seam = new THREE.MeshStandardMaterial({ color: '#737D82', roughness: 0.4, metalness: 0.6 });
    mats.glass = new THREE.MeshStandardMaterial({ color: '#BFE3EA', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
    mats.alu = new THREE.MeshStandardMaterial({ color: '#5B6468', roughness: 0.35, metalness: 0.6 });
    mats.wire = new THREE.LineBasicMaterial({ vertexColors: true });
    mats.dim = new THREE.LineBasicMaterial({ color: 0x000000 });
    V.applyTheme();

    new ResizeObserver(resize).observe(container);
    resize();
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });
    (function loop() {
      requestAnimationFrame(loop);
      const moved = controls.update();
      if (moved || needs) {
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
        needs = false;
      }
    })();
  };

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needs = true;
  }

  V.applyTheme = function () {
    mats.socleTop.color.set(css('--socle-top', '#F1EFEA'));
    mats.socleSide.color.set(css('--socle-side', '#CFCBC2'));
    mats.slab.color.set(css('--slab', '#C3C8C5'));
    mats.figure.color.set(css('--figure', '#FAFAF7'));
    mats.dim.color.set(css('--ink-2', '#54646A'));
    needs = true;
  };

  /* ---------------- Sections ---------------- */
  function roundRect(p, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    p.lineTo(x + r, y + h); p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false);
    return p;
  }
  function sectionGeometry(sec) {
    if (geoCache.has(sec.key)) return geoCache.get(sec.key);
    const s = sec.shape, k = 0.001;
    let sh, seg = 4;
    if (s.type === 'I') {
      const h = s.h * k, b = s.b * k, tw = s.tw * k, tf = s.tf * k;
      sh = new THREE.Shape();
      const pts = [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, -h / 2 + tf], [tw / 2, -h / 2 + tf], [tw / 2, h / 2 - tf], [b / 2, h / 2 - tf], [b / 2, h / 2],
        [-b / 2, h / 2], [-b / 2, h / 2 - tf], [-tw / 2, h / 2 - tf], [-tw / 2, -h / 2 + tf], [-b / 2, -h / 2 + tf]];
      sh.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) sh.lineTo(...pts[i]); sh.closePath();
    } else if (s.type === 'SHS') {
      const b = s.b * k, t = s.t * k;
      sh = roundRect(new THREE.Shape(), -b / 2, -b / 2, b, b, s.ro * k);
      sh.holes.push(roundRect(new THREE.Path(), -b / 2 + t, -b / 2 + t, b - 2 * t, b - 2 * t, s.ri * k));
      seg = 3;
    } else if (s.type === 'CHS') {
      const r = s.D * k / 2;
      sh = new THREE.Shape(); sh.absarc(0, 0, r, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(0, 0, r - s.t * k, 0, Math.PI * 2, true); sh.holes.push(hole);
      seg = 14;
    } else if (s.type === 'ROD') {
      sh = new THREE.Shape(); sh.absarc(0, 0, s.d * k / 2, 0, Math.PI * 2, false); seg = 8;
    } else {
      const b = s.b * k, h = s.h * k;
      sh = new THREE.Shape(); sh.moveTo(-b / 2, -h / 2); sh.lineTo(b / 2, -h / 2); sh.lineTo(b / 2, h / 2); sh.lineTo(-b / 2, h / 2); sh.closePath();
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: seg });
    geoCache.set(sec.key, g);
    return g;
  }

  function setBasis(m4, a, b, up) {
    tmp.a.set(a[0], a[1], a[2]); tmp.b.set(b[0], b[1], b[2]);
    tmp.ez.subVectors(tmp.b, tmp.a);
    const L = tmp.ez.length();
    tmp.ez.divideScalar(L || 1);
    tmp.ey.set(up[0], up[1], up[2]);
    tmp.ey.addScaledVector(tmp.ez, -tmp.ey.dot(tmp.ez));
    if (tmp.ey.lengthSq() < 1e-8) { tmp.ey.set(0, 1, 0).addScaledVector(tmp.ez, -tmp.ez.y); if (tmp.ey.lengthSq() < 1e-8) tmp.ey.set(1, 0, 0); }
    tmp.ey.normalize();
    tmp.ex.crossVectors(tmp.ey, tmp.ez);
    m4.makeBasis(tmp.ex, tmp.ey, tmp.ez.clone().multiplyScalar(L));
    m4.setPosition(tmp.a);
  }

  /* ---------------- Couleurs ---------------- */
  function utilColor(u, c) {
    const stops = [[0, '#3E9A62'], [0.6, '#C9B23A'], [0.85, '#E0892E'], [1.0, '#D0402F'], [1.3, '#7A1F2A']];
    u = Math.max(0, Math.min(1.3, u));
    for (let i = 1; i < stops.length; i++) if (u <= stops[i][0]) {
      const [u0, c0] = stops[i - 1], [u1, c1] = stops[i];
      return c.set(c0).lerp(new THREE.Color(c1), (u - u0) / (u1 - u0));
    }
    return c.set(stops[stops.length - 1][1]);
  }
  function memberColor(m, D, R, c) {
    const timber = R.material.kind === 'timber';
    const woodRole = timber && ['top', 'bot', 'vert', 'diag', 'col', 'purlin'].includes(m.role);
    if (D.color === 'role') return c.set(ROLE_COLORS[m.role] || '#888');
    if (D.color === 'util') return utilColor(m.u || 0, c);
    if (D.color === 'force') {
      if (!m.N) return c.set(css('--neutral-3d', '#A7B0B3'));
      const nmax = R.forceMax || 1;
      const t = m.N.Nt >= m.N.Nc;
      const v = Math.min(1, (t ? m.N.Nt : m.N.Nc) / nmax);
      const base = new THREE.Color('#D9DEDD');
      return c.copy(base).lerp(new THREE.Color(t ? '#2F64B0' : '#C0402E'), 0.25 + 0.75 * Math.sqrt(v));
    }
    if (m.role.startsWith('rod')) return c.set(MAT_COLORS.rod);
    return c.set(woodRole ? MAT_COLORS.timber : MAT_COLORS.steel);
  }

  /* ---------------- Construction de la scène ---------------- */
  function disposeRoot() {
    if (!root) return;
    root.traverse((o) => {
      if (o.isCSS2DObject && o.element && o.element.parentNode) o.element.parentNode.removeChild(o.element);
      if ((o.isMesh || o.isLine || o.isLineSegments || o.isInstancedMesh) && o.geometry && !o.userData.cachedGeo) o.geometry.dispose();
    });
    scene.remove(root);
    root = null;
  }

  V.update = function (R, D) {
    lastR = R; lastD = D;
    disposeRoot();
    root = new THREE.Group();
    scene.add(root);
    pickables = [];
    if (!R || !R.model3d) { needs = true; return; }
    const { P } = R, l = P.span, L = P.length, H = P.colH, M = R.model3d;
    R.forceMax = Math.max(1, ...R.members.map((m) => Math.max(m.env.Nt, m.env.Nc)));
    const timber = R.material.kind === 'timber';

    // ----- barres
    if (D.mode === 'wire') {
      const pos = new Float32Array(M.members.length * 6), col = new Float32Array(M.members.length * 6);
      M.members.forEach((m, i) => {
        pos.set(m.a, i * 6); pos.set(m.b, i * 6 + 3);
        memberColor(m, D, R, tmp.c);
        col.set([tmp.c.r, tmp.c.g, tmp.c.b, tmp.c.r, tmp.c.g, tmp.c.b], i * 6);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const lines = new THREE.LineSegments(g, mats.wire);
      root.add(lines);
      pickables.push({ obj: lines, kind: 'lines', list: M.members });
    } else {
      const groups = new Map();
      for (const m of M.members) {
        const woodRole = timber && ['top', 'bot', 'vert', 'diag', 'col', 'purlin'].includes(m.role);
        const key = m.sec.key + (woodRole ? '|w' : '|s');
        if (!groups.has(key)) groups.set(key, { sec: m.sec, wood: woodRole, list: [] });
        groups.get(key).list.push(m);
      }
      for (const { sec, wood, list } of groups.values()) {
        const mesh = new THREE.InstancedMesh(sectionGeometry(sec), wood ? mats.timber : mats.member, list.length);
        mesh.userData.cachedGeo = true;
        list.forEach((m, i) => {
          setBasis(tmp.m, m.a, m.b, m.up);
          mesh.setMatrixAt(i, tmp.m);
          mesh.setColorAt(i, memberColor(m, D, R, tmp.c));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.computeBoundingSphere && mesh.computeBoundingSphere();
        root.add(mesh);
        pickables.push({ obj: mesh, kind: 'inst', list });
      }
      // goussets
      if (D.details) {
        for (const gs of M.gussets) {
          const sh = new THREE.Shape();
          sh.moveTo(...gs.poly[0]); for (let i = 1; i < gs.poly.length; i++) sh.lineTo(...gs.poly[i]); sh.closePath();
          const g = new THREE.ExtrudeGeometry(sh, { depth: gs.t, bevelEnabled: false });
          const mesh = new THREE.InstancedMesh(g, mats.plate, R.geo.nFrames);
          for (let f = 0; f < R.geo.nFrames; f++) { tmp.m.makeTranslation(0, 0, f * R.geo.e - L / 2 - gs.t / 2); mesh.setMatrixAt(f, tmp.m); }
          mesh.castShadow = true;
          root.add(mesh);
        }
        const bp = M.bp;
        const bpm = new THREE.InstancedMesh(new THREE.BoxGeometry(bp.w, bp.t, bp.d), mats.plate, M.basePlates.length);
        M.basePlates.forEach((p, i) => { tmp.m.makeTranslation(p.x, bp.t / 2, p.z); bpm.setMatrixAt(i, tmp.m); });
        bpm.castShadow = true;
        root.add(bpm);
      }
    }

    // ----- couverture
    if (D.cover !== 'none') buildCover(R, D);

    // ----- socle et dallage
    const big = Math.max(l, L);
    const marg = Math.max(4.5, Math.min(12, 0.16 * big));
    const hs = Math.max(0.5, Math.min(1.4, 0.03 * big));
    if (D.socle) {
      const sg = new THREE.BoxGeometry(l + 2 * marg, hs, L + 2 * marg);
      const socle = new THREE.Mesh(sg, [mats.socleSide, mats.socleSide, mats.socleTop, mats.socleSide, mats.socleSide, mats.socleSide]);
      socle.position.y = -0.15 - hs / 2;
      socle.receiveShadow = true;
      root.add(socle);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(l + 1.2, 0.15, L + 1.2), mats.slab);
      slab.position.y = -0.075;
      slab.receiveShadow = true;
      root.add(slab);
    }

    // ----- personnages
    if (D.people) {
      const e = R.geo.e;
      const spots = [
        { x: -l / 2 - 2.4, z: -L / 2 - 2.6, r: 0.5, h: 1.78, pose: 'stand' },
        { x: -l / 2 - 1.55, z: -L / 2 - 3.2, r: 0.35, h: 1.22, pose: 'stand' },
        { x: l * 0.1, z: -L / 2 + Math.min(e * 0.55, L * 0.3), r: Math.PI * 0.95, h: 1.72, pose: 'point' },
        { x: -l * 0.22, z: L * 0.12, r: 2.2, h: 1.68, pose: 'walk' },
        { x: l / 2 + 2.9, z: L * 0.22, r: -1.3, h: 1.84, pose: 'walk' },
      ];
      for (const s of spots) {
        const f = makeFigure(s.h, s.pose);
        f.position.set(s.x, 0, s.z); f.rotation.y = s.r;
        root.add(f);
      }
    }

    // ----- cotes
    if (D.dims) buildDims(R);

    // r147 : l'élimination hors champ des InstancedMesh se base sur la géométrie d'origine, pas sur les instances
    root.traverse((o) => { if (o.isInstancedMesh) o.frustumCulled = false; });

    // ----- lumière et cadrage
    const radius = 0.5 * Math.hypot(l + 2 * marg, L + 2 * marg, H + R.geo.shape.hmax);
    const sun = V._sun;
    sun.position.set(-0.55 * radius * 2.2, radius * 2.0, -0.35 * radius * 2.2);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera;
    sc.left = -radius * 1.2; sc.right = radius * 1.2; sc.top = radius * 1.2; sc.bottom = -radius * 1.2;
    sc.near = 0.5; sc.far = radius * 6;
    sc.updateProjectionMatrix();
    V._center = new THREE.Vector3(0, (H + R.geo.shape.hmax) * 0.4, 0);
    V._radius = radius;
    // vue de détail : nœud d'about gauche de la deuxième ferme, vu de l'intérieur
    const fd = Math.min(1, R.geo.nFrames - 1), t2 = R.geo.truss;
    const kD = Math.min(2, t2.n);
    const nD = t2.nodes[t2.T[kD]], n0 = t2.nodes[t2.B[0]];
    V._detail = {
      target: new THREE.Vector3(-l / 2 + (n0.x + nD.x) / 2, H + (n0.y + nD.y) / 2, fd * R.geo.e - L / 2),
      dist: Math.max(3.2, 1.6 * Math.hypot(nD.x - n0.x, nD.y - n0.y)),
    };
    if (!lastRadius || Math.abs(radius - lastRadius) / lastRadius > 0.25) { lastRadius = radius; V.setView(V._view || 'persp', true); }
    needs = true;
  };

  function buildCover(R, D) {
    const { P, model3d: M } = R, L = P.length, glass = P.roofing === 'glass';
    const z0 = D.cover === 'full' ? -L / 2 : -L / 2 + L * 0.42, z1 = L / 2;
    const depth = z1 - z0, zc = (z0 + z1) / 2, th = 0.03;
    for (const pl of M.roofPlanes) {
      const ang = Math.atan2(pl.y1 - pl.y0, pl.x1 - pl.x0);
      const len = Math.hypot(pl.x1 - pl.x0, pl.y1 - pl.y0);
      const cx = (pl.x0 + pl.x1) / 2 + pl.nx * th / 2, cy = (pl.y0 + pl.y1) / 2 + pl.ny * th / 2;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(len, th, depth), glass ? mats.glass : mats.zinc);
      panel.position.set(cx, cy, zc); panel.rotation.z = ang;
      panel.castShadow = !glass; panel.receiveShadow = !glass;
      if (glass) panel.renderOrder = 2;
      root.add(panel);
      // joints debout (zinc) ou serreurs (verre), dans le sens de la pente
      const step = glass ? 1.2 : 0.53;
      const n = Math.max(1, Math.floor(depth / step));
      const rib = glass ? new THREE.BoxGeometry(len, 0.06, 0.05) : new THREE.BoxGeometry(len, 0.035, 0.012);
      const ribs = new THREE.InstancedMesh(rib, glass ? mats.alu : mats.seam, n + 1);
      const off = glass ? 0.0 : th / 2 + 0.017;
      for (let i = 0; i <= n; i++) {
        const z = z0 + i * depth / n;
        tmp.m.makeRotationZ(ang);
        tmp.m.setPosition(cx + pl.nx * off, cy + pl.ny * off, z);
        ribs.setMatrixAt(i, tmp.m);
      }
      ribs.castShadow = true;
      root.add(ribs);
    }
  }

  function label(text, pos, cls) {
    const div = document.createElement('div');
    div.className = 'dim-label' + (cls ? ' ' + cls : '');
    div.textContent = text;
    const o = new THREE.CSS2DObject(div);
    o.position.copy(pos);
    return o;
  }
  function buildDims(R) {
    const { P, geo } = R, l = P.span, L = P.length, H = P.colH, f = PS.fmt;
    const pts = [], add = (a, b) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const tk = 0.35;
    const dz = -L / 2 - 1.6, dx = -l / 2 - 1.6;
    add(v(-l / 2, 0.02, dz), v(l / 2, 0.02, dz));
    add(v(-l / 2, 0.02, dz - tk), v(-l / 2, 0.02, dz + tk)); add(v(l / 2, 0.02, dz - tk), v(l / 2, 0.02, dz + tk));
    root.add(label(`portée ${f(l)} m`, v(0, 0.02, dz)));
    add(v(dx, 0.02, -L / 2), v(dx, 0.02, L / 2));
    for (let k = 0; k <= geo.nBays; k++) { const z = -L / 2 + k * geo.e; add(v(dx - tk * (k % geo.nBays ? 0.5 : 1), 0.02, z), v(dx + tk * (k % geo.nBays ? 0.5 : 1), 0.02, z)); }
    root.add(label(`longueur ${f(L)} m — ${geo.nBays} × ${f(geo.e)} m`, v(dx, 0.02, 0)));
    const hx = l / 2 + 1.2, hz = -L / 2;
    add(v(hx, 0, hz), v(hx, H, hz)); add(v(hx - tk, 0, hz), v(hx + tk, 0, hz)); add(v(hx - tk, H, hz), v(hx + tk, H, hz));
    root.add(label(`poteaux ${f(H)} m`, v(hx, H / 2, hz)));
    const t = geo.truss, top = t.nodes.reduce((a, n) => (n.y > a.y ? n : a), t.nodes[0]);
    const rx = top.x - l / 2, hh = geo.shape.hmax, rz = -L / 2 - 0.9;
    add(v(rx, H, rz), v(rx, H + hh, rz)); add(v(rx - tk, H, rz), v(rx + tk, H, rz)); add(v(rx - tk, H + hh, rz), v(rx + tk, H + hh, rz));
    root.add(label(`ferme ${f(hh)} m`, v(rx, H + hh / 2, rz), 'hi'));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    root.add(new THREE.LineSegments(g, mats.dim));
  }

  /* ---------------- Personnages de maquette ---------------- */
  function makeFigure(h, pose) {
    const s = h / 1.75, g = new THREE.Group(), mat = mats.figure;
    const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
    const limb = (geo, px, py, rx, rz, off) => {
      const pivot = new THREE.Group(); pivot.position.set(px, py, 0);
      const m = new THREE.Mesh(geo, mat); m.position.y = -off; m.castShadow = true;
      pivot.add(m); pivot.rotation.x = rx; pivot.rotation.z = rz || 0; g.add(pivot);
    };
    const swing = pose === 'walk' ? 0.32 : 0;
    const legG = cap(0.068 * s, 0.74 * s);
    limb(legG, -0.088 * s, 0.9 * s, swing, 0, 0.44 * s);
    limb(legG, 0.088 * s, 0.9 * s, -swing, 0, 0.44 * s);
    const torso = new THREE.Mesh(cap(0.165 * s, 0.34 * s), mat);
    torso.position.y = 1.17 * s; torso.scale.z = 0.68; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105 * s, 18, 14), mat);
    head.position.y = 1.63 * s; head.castShadow = true; g.add(head);
    const armG = cap(0.048 * s, 0.5 * s);
    limb(armG, -0.225 * s, 1.43 * s, pose === 'walk' ? -swing : 0, -0.06, 0.3 * s);
    limb(armG, 0.225 * s, 1.43 * s, pose === 'point' ? -2.45 : pose === 'walk' ? swing : 0, pose === 'point' ? -0.25 : 0.06, 0.3 * s);
    return g;
  }

  /* ---------------- Vues ---------------- */
  V.setView = function (name, keep) {
    if (!V._center) return;
    V._view = name;
    const dirs = { persp: [-1.0, 0.62, -1.3], face: [0, 0.1, -1], side: [-1, 0.1, 0], top: [0, 1, -0.0001], detail: [0.8, -0.22, -0.55] };
    const d = new THREE.Vector3(...(dirs[name] || dirs.persp)).normalize();
    let dist = V._radius / Math.sin(camera.fov * Math.PI / 360) * (name === 'persp' ? 0.62 : name === 'top' ? 0.7 : 0.6) / Math.min(1, camera.aspect * 0.8);
    let target = V._center;
    if (name === 'detail' && V._detail) { target = V._detail.target; dist = V._detail.dist / Math.min(1, camera.aspect * 0.8); }
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(d, dist);
    camera.near = Math.max(0.05, dist / 500); camera.far = dist * 10;
    camera.updateProjectionMatrix();
    controls.update();
    needs = true;
  };

  /* ---------------- Survol : infobulle ---------------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let moveReq = null;
  function onMove(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    if (moveReq) return;
    moveReq = requestAnimationFrame(() => {
      moveReq = null;
      ptr.set(x / rect.width * 2 - 1, -y / rect.height * 2 + 1);
      ray.setFromCamera(ptr, camera);
      ray.params.Line.threshold = Math.max(0.05, camera.position.distanceTo(controls.target) / 400);
      let best = null;
      for (const p of pickables) {
        const hits = ray.intersectObject(p.obj, false);
        if (!hits.length) continue;
        const h = hits[0];
        const m = p.kind === 'inst' ? p.list[h.instanceId] : p.list[Math.floor(h.index / 2)];
        if (m && (!best || h.distance < best.d)) best = { d: h.distance, m };
      }
      if (!best) { tip.hidden = true; return; }
      tip.innerHTML = PS.ui ? PS.ui.memberTip(best.m, lastR) : best.m.role;
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.min(rect.width - tw - 8, x + 14) + 'px';
      tip.style.top = Math.max(8, y - th - 10) + 'px';
    });
  }

  /* ---------------- Export OBJ (mètres, un groupe par rôle) ---------------- */
  V.exportOBJ = function (R) {
    const M = R.model3d; if (!M) return '';
    const out = ['# Atelier Treillis — export OBJ (unités : mètres, Y vertical)', `# ${R.P.span} m × ${R.P.length} m`];
    let vOff = 1;
    const byRole = new Map();
    for (const m of M.members) { if (!byRole.has(m.role)) byRole.set(m.role, []); byRole.get(m.role).push(m); }
    const v = new THREE.Vector3();
    for (const [role, list] of byRole) {
      out.push(`g ${(PS.ROLE_LABEL[role] || role).replace(/\s+/g, '_')}`);
      for (const m of list) {
        const geo = sectionGeometry(m.sec);
        const pos = geo.attributes.position, idx = geo.index;
        setBasis(tmp.m, m.a, m.b, m.up);
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(tmp.m); out.push(`v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}`); }
        if (idx) for (let i = 0; i < idx.count; i += 3) out.push(`f ${idx.getX(i) + vOff} ${idx.getX(i + 1) + vOff} ${idx.getX(i + 2) + vOff}`);
        else for (let i = 0; i < pos.count; i += 3) out.push(`f ${i + vOff} ${i + 1 + vOff} ${i + 2 + vOff}`);
        vOff += pos.count;
      }
    }
    out.push('g Axes_des_barres');
    for (const m of M.members) {
      out.push(`v ${m.a.map((x) => x.toFixed(4)).join(' ')}`, `v ${m.b.map((x) => x.toFixed(4)).join(' ')}`, `l ${vOff} ${vOff + 1}`);
      vOff += 2;
    }
    return out.join('\n');
  };

  V.snapshot = function () { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); };
  V.redraw = function () { if (lastR) V.update(lastR, lastD); };
})(typeof window !== 'undefined' ? window : globalThis);
