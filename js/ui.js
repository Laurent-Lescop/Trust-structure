/* Atelier Treillis — interface : paramètres, onglets d'analyse, carte des limites, exports. */
(function (G) {
  'use strict';
  const PS = G.PS;
  const $ = (s, el) => (el || document).querySelector(s);
  const nf = (v, d = 2) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STATUS = { ok: 'OK', warn: 'À surveiller', bad: 'Hors limite' };
  const VERDICT = { ok: 'Constructible', warn: 'Constructible, avec réserves', bad: 'Hors limites' };

  /* ---------------- État ---------------- */
  const STORE = 'atelier-treillis-v1';
  const DDEF = { mode: 'solid', color: 'material', cover: 'partial', details: true, socle: true, people: true, dims: true };
  let P = Object.assign({}, PS.DEFAULTS), D = Object.assign({}, DDEF), tab = 'diag';
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s) { Object.assign(P, s.P || {}); Object.assign(D, s.D || {}); tab = s.tab || tab; }
  } catch (e) { /* stockage indisponible */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ P, D, tab })); } catch (e) { /* ignoré */ } };
  let R = null;
  const dirty = new Set();

  /* ---------------- Pictogrammes ---------------- */
  const ic = (d) => `<svg width="30" height="16" viewBox="0 0 30 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON = {
    duo: ic('M1 14 L15 2 L29 14 Z M8 14 V8 M15 14 V2 M22 14 V8'),
    mono: ic('M1 14 L29 2 V14 Z M10 14 V10 M19 14 V6'),
    flat: ic('M1 4 H29 V13 H1 Z M8 4 V13 M15 4 V13 M22 4 V13'),
    pratt: ic('M1 3 H29 M1 13 H29 M1 3 V13 M8 3 V13 M15 3 V13 M22 3 V13 M29 3 V13 M1 3 L8 13 M8 3 L15 13 M15 13 L22 3 M22 13 L29 3'),
    howe: ic('M1 3 H29 M1 13 H29 M1 3 V13 M8 3 V13 M15 3 V13 M22 3 V13 M29 3 V13 M1 13 L8 3 M8 13 L15 3 M15 3 L22 13 M22 3 L29 13'),
    warren: ic('M1 3 H29 M1 13 H29 M1 3 V13 M8 3 V13 M15 3 V13 M22 3 V13 M29 3 V13 M1 13 L8 3 L15 13 L22 3 L29 13'),
  };

  /* ---------------- Définition des commandes ---------------- */
  const SECTIONS = [
    { title: 'Typologie', items: [
      { id: 'typo', type: 'seg', label: 'Forme de la ferme', opts: [['duo', 'Deux pans', ICON.duo], ['mono', 'Monopente', ICON.mono], ['flat', 'Poutre plate', ICON.flat]] },
      { id: 'pattern', type: 'seg', label: 'Treillis', opts: [['pratt', 'Pratt', ICON.pratt], ['howe', 'Howe', ICON.howe], ['warren', 'Warren', ICON.warren]],
        note: (p) => patternNote(p) },
    ] },
    { title: 'Dimensions', items: [
      { id: 'span', type: 'range', label: 'Portée (largeur)', min: 6, max: 60, step: 0.5, unit: 'm' },
      { id: 'length', type: 'range', label: 'Longueur du bâtiment', min: 6, max: 120, step: 0.5, unit: 'm' },
      { id: 'colH', type: 'range', label: 'Hauteur des poteaux', min: 2.5, max: 15, step: 0.1, unit: 'm' },
      { id: 'trussH', type: 'range', label: (p) => ({ duo: 'Hauteur de ferme au faîtage', mono: 'Hauteur côté haut', flat: 'Hauteur de la poutre' })[p.typo], min: 0.4, max: 12, step: 0.05, unit: 'm' },
      { id: 'aboutH', type: 'range', label: (p) => p.typo === 'mono' ? 'Hauteur côté bas' : 'Hauteur à l’about (rive)', min: 0, max: 4, step: 0.05, unit: 'm', show: (p) => p.typo !== 'flat',
        note: (p) => p.typo === 'duo' && p.aboutH < 0.01 ? 'À zéro : ferme triangulaire, comme dans le tutoriel Grasshopper.' : '' },
      { id: 'flatSlope', type: 'range', label: 'Pente de forme', min: 0, max: 15, step: 0.5, unit: '%', show: (p) => p.typo === 'flat',
        note: () => 'La membrure supérieure se casse en deux pans pour évacuer l’eau.' },
    ] },
    { title: 'Trame', items: [
      { id: 'bayTarget', type: 'range', label: 'Entraxe visé des fermes', min: 2, max: 12, step: 0.25, unit: 'm' },
      { id: 'panelsAuto', type: 'switch', label: 'Découpage automatique', note: (p) => p.panelsAuto ? 'Pannes posées aux nœuds, diagonales proches de 45°, le moins de barres possible.' : 'Nombre de panneaux imposé.' },
      { id: 'panels', type: 'range', label: 'Nombre de panneaux', min: 2, max: 40, step: 1, unit: '', show: (p) => !p.panelsAuto },
      { id: 'tieSpacing', type: 'range', label: 'Filants de membrure inférieure tous les', min: 1.5, max: 12, step: 0.5, unit: 'm',
        note: () => 'Ils tiennent la membrure inférieure, comprimée quand le vent soulève la toiture.' },
      { type: 'derived' },
    ] },
    { title: 'Matériau', items: [
      { id: 'material', type: 'seg', label: 'Structure', opts: [['steel', 'Acier'], ['timber', 'Bois']] },
      { id: 'steelGrade', type: 'select', label: 'Nuance d’acier', opts: [['S235', 'S235'], ['S275', 'S275'], ['S355', 'S355']], show: (p) => p.material === 'steel' },
      { id: 'trussFamily', type: 'seg', label: 'Barres de ferme', opts: [['SHS', 'Tubes carrés'], ['CHS', 'Tubes ronds']], show: (p) => p.material === 'steel' },
      { id: 'colFamily', type: 'seg', label: 'Poteaux', opts: [['HEA', 'HEA'], ['IPE', 'IPE']], show: (p) => p.material === 'steel' },
      { id: 'timberGrade', type: 'select', label: 'Classe de résistance', opts: [['GL24h', 'GL24h — lamellé-collé'], ['GL28h', 'GL28h — lamellé-collé'], ['C24', 'C24 — bois massif']], show: (p) => p.material === 'timber',
        note: () => 'Contreventements, butons et filants restent en acier.' },
    ] },
    { title: 'Couverture', items: [
      { id: 'roofing', type: 'seg', label: 'Matériau de couverture', opts: [['zinc', 'Zinc'], ['glass', 'Verre']],
        note: (p) => { const r = PS.ROOFING[p.roofing]; return `${r.desc}. ${nf(r.g, 2)} kN/m², pente mini ${nf(r.minSlope * 100, 0)} %, pannes tous les ${nf(r.purlinMax, 1)} m au plus, flèche ≤ l/${r.deflRatio}.`; } },
    ] },
    { title: 'Site — Eurocodes, France', items: [
      { id: 'snowRegion', type: 'select', label: 'Région de neige', opts: Object.keys(PS.SNOW).map((k) => [k, `${k} — sk = ${nf(PS.SNOW[k], 2)} kN/m²`]) },
      { id: 'altitude', type: 'range', label: 'Altitude', min: 0, max: 1000, step: 50, unit: 'm' },
      { id: 'windRegion', type: 'select', label: 'Région de vent', opts: [1, 2, 3, 4].map((k) => [String(k), `Région ${k} — vb,0 = ${PS.WIND_VB[k]} m/s`]) },
      { id: 'terrain', type: 'select', label: 'Rugosité du terrain', opts: Object.keys(PS.TERRAIN).map((k) => [k, PS.TERRAIN[k].label]) },
    ] },
  ];

  function patternNote(p) {
    const base = {
      pratt: 'Diagonales orientées pour être tendues sous la charge de toiture : elles ne flambent pas, le choix naturel en acier.',
      howe: 'Diagonales orientées pour être comprimées, montants tendus : le schéma historique du bois, montants remplacés par des tirants métalliques.',
      warren: 'Diagonales alternées : leur effort change de signe d’un panneau à l’autre.',
    }[p.pattern];
    if (!R || !R.an) return base;
    const N = R.an.Ncombo[0], sgn = { diag: [0, 0], vert: [0, 0] };
    R.geo.truss.members.forEach((m, q) => { if (sgn[m.g] && Math.abs(N[q]) > 0.5) sgn[m.g][N[q] > 0 ? 0 : 1]++; });
    const word = ([t, c], fem) => t && c ? 'tantôt tendu' + (fem ? 'es' : 's') + ', tantôt comprimé' + (fem ? 'es' : 's')
      : t ? 'tendu' + (fem ? 'es' : 's') : c ? 'comprimé' + (fem ? 'es' : 's') : 'peu sollicité' + (fem ? 'es' : 's');
    let s = `${base} Ici, sous la neige : diagonales ${word(sgn.diag, true)}, montants ${word(sgn.vert, false)}.`;
    if (p.typo !== 'flat' && p.pattern !== 'warren') s += ' Dans une ferme triangulaire, ce comportement impose des diagonales inversées par rapport à une poutre à membrures parallèles : la membrure inclinée reprend déjà l’effort tranchant.';
    return s;
  }

  /* ---------------- Construction du panneau ---------------- */
  const ctlRefs = [];
  function buildParams() {
    const root = $('#params');
    root.innerHTML = '';
    for (const sec of SECTIONS) {
      const s = document.createElement('section');
      s.className = 'psec';
      s.innerHTML = `<h3>${esc(sec.title)}</h3>`;
      for (const it of sec.items) {
        const c = document.createElement('div');
        c.className = 'ctl';
        const ref = { it, el: c };
        if (it.type === 'derived') {
          c.innerHTML = '<div class="derived" id="derived"></div>';
        } else if (it.type === 'range') {
          c.innerHTML = `<div class="ctl-head"><label for="in-${it.id}"></label><span class="valbox"><input id="num-${it.id}" type="text" inputmode="decimal" aria-label="valeur"><span class="u">${esc(it.unit)}</span></span></div>
            <input type="range" id="in-${it.id}" min="${it.min}" max="${it.max}" step="${it.step}"><div class="note"></div>`;
          const rg = $('input[type=range]', c), num = $('#num-' + it.id, c);
          rg.addEventListener('input', () => { set(it.id, parseFloat(rg.value)); });
          const commit = () => {
            let v = parseFloat(String(num.value).replace(',', '.'));
            if (!isFinite(v)) v = P[it.id];
            v = Math.min(it.max, Math.max(it.min, v));
            set(it.id, v);
          };
          num.addEventListener('change', commit);
          num.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commit(); num.blur(); } });
          ref.rg = rg; ref.num = num;
        } else if (it.type === 'seg') {
          c.innerHTML = `<div class="ctl-head"><label></label></div><div class="seg" role="group"></div><div class="note"></div>`;
          const g = $('.seg', c);
          for (const [v, lab, icon] of it.opts) {
            const b = document.createElement('button');
            b.type = 'button'; b.dataset.v = v;
            b.innerHTML = (icon || '') + `<span>${esc(lab)}</span>`;
            b.id = `seg-${it.id}-${v}`;
            b.addEventListener('click', () => set(it.id, v));
            g.appendChild(b);
          }
          ref.seg = g;
        } else if (it.type === 'select') {
          c.innerHTML = `<div class="ctl-head"><label for="sel-${it.id}"></label></div><select class="sel" id="sel-${it.id}">${it.opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select><div class="note"></div>`;
          const sel = $('select', c);
          sel.addEventListener('change', () => set(it.id, it.id === 'windRegion' ? parseInt(sel.value, 10) : sel.value));
          ref.sel = sel;
        } else if (it.type === 'switch') {
          c.innerHTML = `<label class="switch" for="sw-${it.id}"><span></span><input type="checkbox" id="sw-${it.id}"></label><div class="note"></div>`;
          const cb = $('input', c);
          cb.addEventListener('change', () => set(it.id, cb.checked));
          ref.cb = cb;
        }
        s.appendChild(c);
        ctlRefs.push(ref);
      }
      root.appendChild(s);
    }
    const foot = document.createElement('div');
    foot.className = 'psec';
    foot.innerHTML = '<button class="btn" type="button" id="reset">Revenir aux valeurs de départ</button>';
    root.appendChild(foot);
    $('#reset').addEventListener('click', () => { P = Object.assign({}, PS.DEFAULTS); syncControls(); schedule(); toast('Paramètres réinitialisés'); });
  }

  function syncControls() {
    for (const r of ctlRefs) {
      const it = r.it;
      if (it.type === 'derived') continue;
      const visible = !it.show || it.show(P);
      r.el.hidden = !visible;
      const lab = typeof it.label === 'function' ? it.label(P) : it.label;
      const labEl = $('label', r.el);
      if (labEl) { if (it.type === 'switch') $('span', labEl).textContent = lab; else labEl.textContent = lab; }
      const note = $('.note', r.el);
      if (note) { const t = it.note ? it.note(P) : ''; note.textContent = t || ''; note.hidden = !t; }
      if (it.type === 'range') {
        let max = it.max;
        if (it.id === 'aboutH') max = Math.max(0.05, Math.min(4, P.trussH - 0.1));
        r.rg.max = max;
        r.rg.value = P[it.id];
        if (document.activeElement !== r.num) r.num.value = nf(P[it.id], it.step < 0.1 ? 2 : it.step < 1 ? 1 : 0);
      } else if (it.type === 'seg') {
        for (const b of r.seg.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(P[it.id])));
      } else if (it.type === 'select') {
        r.sel.value = String(P[it.id]);
      } else if (it.type === 'switch') {
        r.cb.checked = !!P[it.id];
      }
    }
  }

  function set(id, v) {
    if (P[id] === v) return;
    const prev = P[id];
    P[id] = v;
    // Préréglages cohérents lors d'un changement de typologie ou de couverture
    if (id === 'typo') {
      const l = P.span;
      if (v === 'duo') { P.trussH = +(l / 5).toFixed(2); P.aboutH = 0; }
      if (v === 'mono') { P.trussH = +(l / 6.5).toFixed(2); P.aboutH = 0.4; }
      if (v === 'flat') { P.trussH = +(Math.max(0.6, l / 12)).toFixed(2); P.flatSlope = PS.ROOFING[P.roofing].minSlope * 100; }
    }
    if (id === 'roofing' && P.typo === 'flat' && P.flatSlope < PS.ROOFING[v].minSlope * 100) P.flatSlope = PS.ROOFING[v].minSlope * 100;
    if (id === 'trussH' && P.aboutH > v - 0.1) P.aboutH = Math.max(0, +(v - 0.1).toFixed(2));
    if (id === 'panelsAuto' && v === false && R) P.panels = R.geo.n;
    void prev;
    syncControls();
    schedule();
  }

  /* ---------------- Calcul et rendu ---------------- */
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; run(); });
  }

  function run() {
    try { R = PS.compute(P); } catch (err) { console.error(err); toast('Erreur de calcul : ' + err.message); return; }
    save();
    syncControls();
    renderVerdict();
    renderHUD();
    renderDerived();
    if (PS.view3d && viewOK) { try { PS.view3d.update(R, D); } catch (err) { console.error(err); } }
    renderLegend();
    ['diag', 'truss', 'map', 'compare', 'bom', 'hyp'].forEach((t) => dirty.add(t));
    renderPane();
  }

  function renderVerdict() {
    const v = R.diag.verdict, items = R.diag.items.filter((d) => d.status !== 'ok');
    const b = $('#verdict');
    b.dataset.s = v;
    $('#verdict-txt').textContent = VERDICT[v];
    $('#verdict-sub').textContent = items.length ? `${items.length} point${items.length > 1 ? 's' : ''} ${v === 'bad' ? 'bloquant' + (items.filter((d) => d.status === 'bad').length > 1 ? 's' : '') : 'à surveiller'}` : 'tous les critères passent';
  }

  function renderHUD() {
    const q = R.bom, timber = R.material.kind === 'timber';
    const kf = (lab, val, unit) => `<div class="kf"><span>${lab}</span><b>${val}${unit ? `<small>${unit}</small>` : ''}</b></div>`;
    if (!q) { $('#hud').innerHTML = kf('Structure', R.error ? 'instable' : '—', ''); return; }
    $('#hud').innerHTML =
      kf('Masse', nf(q.total / 1000, 2), 't') +
      kf('Ratio', nf(q.perM2, 1), 'kg/m²') +
      kf('Pièces', nf(q.pieces, 0), '') +
      (timber ? kf('Bois', nf(q.timberVol, 1), 'm³') : kf('Fermes', `${R.geo.nFrames}`, `× ${nf(R.P.span, 1)} m`));
  }

  function renderDerived() {
    const el = $('#derived'); if (!el) return;
    const g = R.geo;
    el.innerHTML = [
      ['Panneaux', `${g.n} × ${nf(g.truss.dx, 2)} m`],
      ['Fermes', `${g.nFrames} (${g.nBays} travées)`],
      ['Entraxe réel', `${nf(g.e, 2)} m`],
      ['Pente', `${nf(g.shape.slope * 100, 1)} % · ${nf(g.shape.alpha * 180 / Math.PI, 1)}°`],
      ['Files de pannes', `${g.purlins.length}`],
    ].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
  }

  /* ---------------- Vue 3D : commandes ---------------- */
  let viewOK = false;
  function buildViewControls() {
    const views = [['persp', 'Perspective'], ['face', 'Pignon'], ['side', 'Long-pan'], ['top', 'Dessus'], ['detail', 'Détail d’un nœud']];
    $('#views').innerHTML = `<div class="chipbar" role="group" aria-label="Points de vue">${views.map(([v, l]) => `<button type="button" data-view="${v}">${l}</button>`).join('')}</div>`;
    $('#views').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]'); if (!b || !PS.view3d) return;
      PS.view3d.setView(b.dataset.view);
    });
    const rows = [
      ['Rendu', 'mode', [['solid', 'Profilés'], ['wire', 'Filaire']]],
      ['Couleurs', 'color', [['material', 'Matière'], ['role', 'Rôle'], ['force', 'Efforts'], ['util', 'Taux']]],
      ['Couverture', 'cover', [['none', 'Sans'], ['partial', 'Partielle'], ['full', 'Complète']]],
    ];
    const toggles = [['details', 'Assemblages'], ['socle', 'Socle'], ['people', 'Personnages'], ['dims', 'Cotes']];
    $('#display').innerHTML = '<button type="button" class="btn disp-toggle" id="disp-toggle" aria-expanded="false">Affichage</button>' + rows.map(([lab, key, opts]) => `<div class="chipbar" role="group" aria-label="${lab}"><span class="lbl">${lab}</span>${opts.map(([v, l]) => `<button type="button" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`).join('') +
      `<div class="chipbar" role="group" aria-label="Éléments affichés">${toggles.map(([k, l]) => `<button type="button" data-t="${k}">${l}</button>`).join('')}</div>`;
    $('#display').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'disp-toggle') {
        const open = $('#display').classList.toggle('open');
        b.setAttribute('aria-expanded', String(open));
        return;
      }
      if (b.dataset.k) D[b.dataset.k] = b.dataset.v;
      if (b.dataset.t) D[b.dataset.t] = !D[b.dataset.t];
      syncDisplay(); save();
      if (R && PS.view3d && viewOK) PS.view3d.update(R, D);
      renderLegend();
    });
    syncDisplay();
  }
  function syncDisplay() {
    document.querySelectorAll('#display button').forEach((b) => {
      if (b.dataset.k) b.setAttribute('aria-pressed', String(D[b.dataset.k] === b.dataset.v));
      if (b.dataset.t) b.setAttribute('aria-pressed', String(!!D[b.dataset.t]));
    });
  }
  const ROLE_SW = [['top', 'Membrure sup.', '#2B7A73'], ['bot', 'Membrure inf.', '#2F64B0'], ['vert', 'Montants', '#7A5BB0'], ['diag', 'Diagonales', '#D08A2E'], ['col', 'Poteaux', '#56656B'], ['purlin', 'Pannes', '#A07A38'], ['rod', 'Contreventements', '#C0402E'], ['strut', 'Butons, filants', '#6E8B3D']];
  function renderLegend() {
    const el = $('#legend');
    if (D.color === 'role') el.innerHTML = `<div class="legend">${ROLE_SW.map(([, l, c]) => `<div class="row"><i style="background:${c}"></i>${l}</div>`).join('')}</div>`;
    else if (D.color === 'force') el.innerHTML = `<div class="legend"><div class="row"><i style="background:#2F64B0"></i>Traction</div><div class="row"><i style="background:#C0402E"></i>Compression</div><div class="small">Intensité : effort maximal toutes combinaisons confondues</div></div>`;
    else if (D.color === 'util') el.innerHTML = `<div class="legend"><span>Taux de travail</span><div class="grad"></div><div class="scale"><span>0</span><span>60 %</span><span>100 %</span></div></div>`;
    else el.innerHTML = '';
  }

  /* ---------------- Infobulles ---------------- */
  PS.ui = {
    memberTip(m, RR) {
      const lab = PS.ROLE_LABEL[m.role] || m.role;
      const lines = [`<strong>${esc(lab)}</strong> · ${esc(m.sec.label)}`];
      if (m.L) lines.push(`<span class="k">Longueur</span> ${nf(m.L, 2)} m`);
      if (m.N) {
        const parts = [];
        if (m.N.Nt > 0.05) parts.push(`<span class="t">traction ${nf(m.N.Nt, 1)} kN</span>`);
        if (m.N.Nc > 0.05) parts.push(`<span class="c">compression ${nf(m.N.Nc, 1)} kN</span>`);
        if (parts.length) lines.push(parts.join(' · '));
      }
      if (m.u != null) lines.push(`<span class="k">Taux de travail</span> ${nf(m.u * 100, 0)} %${m.crit ? ` — ${esc(m.crit)}` : ''}`);
      return lines.join('<br>');
    },
  };

  /* ---------------- Onglets ---------------- */
  const TABS = [['diag', 'Diagnostic'], ['truss', 'Ferme type'], ['map', 'Limites'], ['compare', 'Acier / bois'], ['bom', 'Nomenclature'], ['hyp', 'Hypothèses']];
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="pane" data-tab="${k}">${l}</button>`).join('');
    $('#panes').innerHTML = '<div class="pane" id="pane" role="tabpanel"></div>';
    $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) selectTab(b.dataset.tab); });
    $('#verdict').addEventListener('click', () => { selectTab('diag'); $('.dock').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  function selectTab(t) {
    tab = t; save();
    dirty.add(t);
    renderPane();
  }
  function renderPane() {
    document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (!R || !dirty.has(tab)) return;
    dirty.delete(tab);
    const el = $('#pane');
    const fn = { diag: paneDiag, truss: paneTruss, map: paneMap, compare: paneCompare, bom: paneBom, hyp: paneHyp }[tab];
    fn(el);
  }

  const uColor = (u) => u > 1 ? 'var(--bad)' : u > 0.85 ? 'var(--warn)' : 'var(--ok)';
  const ubar = (u) => `<div class="bar-u"><i style="width:${Math.min(100, u * 100).toFixed(0)}%;background:${uColor(u)}"></i></div>`;

  /* ----- Diagnostic ----- */
  function paneDiag(el) {
    const d = R.diag;
    const lead = {
      ok: 'Toutes les vérifications passent : la ferme est cohérente avec ses proportions, ses charges et sa couverture.',
      warn: 'La structure tient, mais certains choix s’écartent des usages. Les points signalés expliquent pourquoi et comment corriger.',
      bad: 'Au moins un critère n’est pas respecté : en l’état, la proposition n’est pas constructible. Les points rouges indiquent quoi modifier.',
    }[d.verdict];
    const checks = d.items.map((it) => `<div class="check"><span class="pill ${it.status}">${STATUS[it.status]}</span><div><div class="ttl">${esc(it.title)}</div><div class="val">${esc(it.value)}</div><div class="exp">${esc(it.explain)}</div></div></div>`).join('');
    let secRows = '';
    if (R.sizing && !R.error) {
      const row = (lab, sec, u, crit, ok) => `<tr><td>${lab}</td><td class="mono">${esc(sec.label)}${ok === false ? ' <span class="pill bad">insuffisant</span>' : ''}</td><td class="n">${nf(u * 100, 0)} %${ubar(u)}</td><td class="small">${esc(crit || '')}</td></tr>`;
      for (const g of ['top', 'bot', 'vert', 'diag']) if (R.sizing[g]) secRows += row(PS.GROUP_LABEL[g], R.secs[g], R.sizing[g].worst.u, R.sizing[g].worst.crit, R.sizing[g].ok);
      secRows += row('Poteaux', R.secs.col, R.sizing.col.u, R.sizing.col.crit, R.sizing.col.ok);
      secRows += row('Pannes', R.purl.sec, R.purl.umax, R.purl.crit, R.purl.ok);
      if (R.stab) {
        secRows += row('Croix de toiture', R.stab.rodRoof.sec, R.stab.rodRoof.u, 'traction', R.stab.rodRoof.ok);
        secRows += row('Palées de stabilité', R.stab.rodWall.sec, R.stab.rodWall.u, 'traction', R.stab.rodWall.ok);
        secRows += row('Butons', R.stab.strut.sec, R.stab.strut.u, R.stab.strut.crit, R.stab.strut.ok);
        secRows += row('Filants', R.stab.tie.sec, R.stab.tie.u, R.stab.tie.crit, R.stab.tie.ok);
      }
    }
    el.innerHTML = `<div class="cols"><div><h4>Diagnostic de constructibilité</h4><p class="lead">${lead}</p><div class="checks">${checks}</div></div>
      <div><h4>Profils retenus automatiquement</h4><p class="lead">Pour chaque famille de barres, le profil le plus léger du catalogue qui passe toutes les combinaisons de charges.</p>
      <div class="scroll-x"><table class="t"><thead><tr><th>Élément</th><th>Profil</th><th class="n">Taux</th><th>Critère déterminant</th></tr></thead><tbody>${secRows}</tbody></table></div></div></div>`;
  }

  /* ----- Ferme type (élévation SVG) ----- */
  let trussSel = 'env', showN = true, showLoads = true;
  function paneTruss(el) {
    if (R.error) { el.innerHTML = `<p class="lead">${esc(R.error)}</p>`; return; }
    const opts = [['env', 'Enveloppe : effort maximal de chaque barre']].concat(R.combos.map((c, i) => [String(i), `${c.id} — ${c.label}`]));
    el.innerHTML = `<div class="toolbar"><label for="combo">Cas affiché</label><select class="sel" id="combo" style="width:auto">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
      <label><input type="checkbox" id="chkN"> Valeurs (kN)</label><label><input type="checkbox" id="chkL"> Charges</label></div>
      <div class="svgwrap" id="trusswrap"></div>
      <p class="small" style="margin-top:8px">Épaisseur des traits = hauteur réelle des profils. <span style="color:var(--tension)">Bleu : traction</span>, <span style="color:var(--compression)">rouge : compression</span>, intensité proportionnelle à l’effort. Survolez une barre pour son détail.</p>`;
    const sel = $('#combo', el); sel.value = trussSel;
    $('#chkN', el).checked = showN; $('#chkL', el).checked = showLoads;
    sel.addEventListener('change', () => { trussSel = sel.value; drawTruss(); });
    $('#chkN', el).addEventListener('change', (e) => { showN = e.target.checked; drawTruss(); });
    $('#chkL', el).addEventListener('change', (e) => { showLoads = e.target.checked; drawTruss(); });
    drawTruss();
  }
  function drawTruss() {
    const wrap = $('#trusswrap'); if (!wrap) return;
    const { P: p, geo } = R, t = geo.truss, l = p.span, H = p.colH, hm = geo.shape.hmax;
    const pad = Math.max(1.4, l * 0.07);
    const x0 = -pad * 1.1, x1 = l + pad * 0.7, yTop = hm + pad * 1.1, yBot = -H - pad * 0.35;
    const W = x1 - x0, HH = yTop - yBot;
    const fs = Math.max(W / 62, HH / 30);
    const N = R.members.map((m, q) => {
      if (trussSel === 'env') return m.env.Nt >= m.env.Nc ? m.env.Nt : -m.env.Nc;
      return R.an.Ncombo[+trussSel][q];
    });
    const nmax = Math.max(1e-6, ...N.map(Math.abs));
    const nd = t.nodes;
    let s = `<svg viewBox="${x0} ${-yTop} ${W} ${HH}" role="img" aria-label="Élévation de la ferme type avec ses efforts">`;
    // sol
    s += `<line x1="${x0}" y1="${H}" x2="${x1}" y2="${H}" style="stroke:var(--ink-3);stroke-width:${fs * 0.08}"/>`;
    for (let x = x0; x < x1; x += fs * 0.9) s += `<line x1="${x}" y1="${H + fs * 0.6}" x2="${x + fs * 0.6}" y2="${H}" style="stroke:var(--line);stroke-width:${fs * 0.05}"/>`;
    // poteaux
    const ch = R.secs.col.h / 1000;
    for (const x of [0, l]) s += `<rect x="${x - ch / 2}" y="0" width="${ch}" height="${H}" style="fill:var(--inset);stroke:var(--ink-3);stroke-width:${fs * 0.05}"/>`;
    // pannes (en section)
    const ph = R.purl.sec.h / 1000, pb = R.purl.sec.b / 1000, off = R.secs.top.h / 2000 + ph / 2;
    for (const pu of geo.purlins) {
      const ang = Math.atan2(pu.nx, pu.ny) * 180 / Math.PI;
      s += `<rect x="${-pb / 2}" y="${-ph / 2}" width="${pb}" height="${ph}" transform="translate(${pu.x + pu.nx * off} ${-(pu.y + pu.ny * off)}) rotate(${ang})" style="fill:var(--ink-3)"/>`;
    }
    // barres
    R.members.forEach((m, q) => {
      const a = nd[m.a], b = nd[m.b], v = N[q], k = Math.abs(v) / nmax;
      const col = Math.abs(v) < nmax * 0.005 ? 'var(--ink-3)' : v > 0 ? 'var(--tension)' : 'var(--compression)';
      const w = Math.max(fs * 0.12, m.sec.h / 1000);
      s += `<line data-q="${q}" x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" style="stroke:${col};stroke-opacity:${(0.35 + 0.65 * Math.sqrt(k)).toFixed(2)};stroke-width:${w}" />`;
    });
    // nœuds
    for (const n of nd) s += `<circle cx="${n.x}" cy="${-n.y}" r="${fs * 0.13}" style="fill:var(--raised);stroke:var(--ink-2);stroke-width:${fs * 0.05}"/>`;
    // valeurs
    if (showN) {
      R.members.forEach((m, q) => {
        const a = nd[m.a], b = nd[m.b], v = N[q];
        if (Math.abs(v) < 0.5) return;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = (b.x - a.x) / m.L, dy = (b.y - a.y) / m.L;
        const o = m.g === 'bot' ? -fs * 0.75 : m.g === 'top' ? fs * 0.75 : 0;
        s += `<text x="${mx - dy * o}" y="${-(my + dx * o) + fs * 0.25}" font-size="${fs * 0.62}" text-anchor="middle" style="fill:${v > 0 ? 'var(--tension)' : 'var(--compression)'};font-family:var(--font-mono);paint-order:stroke;stroke:var(--raised);stroke-width:${fs * 0.22}">${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}</text>`;
      });
    }
    // charges du cas affiché
    if (showLoads && trussSel !== 'env') {
      const c = R.combos[+trussSel], F = new Float64Array(3 * R.an.fe.nodes.length);
      for (const k in c.f) { const v = R.an.cases[k]; if (v) for (let i = 0; i < F.length; i++) F[i] += c.f[k] * v[i]; }
      let fmax = 0;
      const fe = R.an.fe;
      for (let i = 0; i < fe.nodes.length; i++) fmax = Math.max(fmax, Math.hypot(F[3 * i], F[3 * i + 1]));
      const Lm = pad * 0.75;
      for (let i = 0; i < fe.nodes.length; i++) {
        const fx = F[3 * i], fy = F[3 * i + 1], f = Math.hypot(fx, fy);
        if (f < fmax * 0.03) continue;
        const n = fe.nodes[i], len = Lm * (0.25 + 0.75 * f / fmax), ux = fx / f, uy = fy / f;
        const sx = n.x - ux * len, sy = n.y - uy * len;
        const hx = n.x - ux * fs * 0.1, hy = n.y - uy * fs * 0.1;
        const ah = fs * 0.35;
        s += `<line x1="${sx}" y1="${-sy}" x2="${hx}" y2="${-hy}" style="stroke:var(--accent);stroke-width:${fs * 0.07}"/>`;
        s += `<path d="M${hx} ${-hy} L${hx - ux * ah - uy * ah * 0.5} ${-(hy - uy * ah + ux * ah * 0.5)} L${hx - ux * ah + uy * ah * 0.5} ${-(hy - uy * ah - ux * ah * 0.5)} Z" style="fill:var(--accent)"/>`;
      }
    }
    // cotes
    const dimH = (xa, xb, y, txt) => `<line x1="${xa}" y1="${-y}" x2="${xb}" y2="${-y}" style="stroke:var(--ink-3);stroke-width:${fs * 0.05}"/><line x1="${xa}" y1="${-y - fs * 0.3}" x2="${xa}" y2="${-y + fs * 0.3}" style="stroke:var(--ink-3);stroke-width:${fs * 0.05}"/><line x1="${xb}" y1="${-y - fs * 0.3}" x2="${xb}" y2="${-y + fs * 0.3}" style="stroke:var(--ink-3);stroke-width:${fs * 0.05}"/><text x="${(xa + xb) / 2}" y="${-y - fs * 0.35}" font-size="${fs * 0.7}" text-anchor="middle" class="ink2" style="font-family:var(--font-mono)">${txt}</text>`;
    const dimV = (x, ya, yb, txt) => `<line x1="${x}" y1="${-ya}" x2="${x}" y2="${-yb}" style="stroke:var(--ink-3);stroke-width:${fs * 0.05}"/><line x1="${x - fs * 0.3}" y1="${-ya}" x2="${x + fs * 0.3}" y2="${-ya}" style="stroke:var(--ink-3);stroke-width:${fs * 0.05}"/><line x1="${x - fs * 0.3}" y1="${-yb}" x2="${x + fs * 0.3}" y2="${-yb}" style="stroke:var(--ink-3);stroke-width:${fs * 0.05}"/><text transform="translate(${x - fs * 0.45} ${-(ya + yb) / 2}) rotate(-90)" font-size="${fs * 0.7}" text-anchor="middle" class="ink2" style="font-family:var(--font-mono)">${txt}</text>`;
    s += dimH(0, l, hm + pad * 0.55, `${nf(l, 2)} m — ${geo.n} panneaux de ${nf(t.dx, 2)} m`);
    s += dimV(-pad * 0.55, 0, hm, `${nf(hm, 2)} m`);
    s += dimV(-pad * 0.55, -H, 0, `${nf(H, 2)} m`);
    s += '</svg>';
    wrap.innerHTML = s;
    wrap.onmousemove = (e) => {
      const q = e.target.getAttribute && e.target.getAttribute('data-q');
      if (q == null) { hideFloat(); return; }
      const m = R.members[+q];
      const html = PS.ui.memberTip({ role: m.g, sec: m.sec, L: m.L, N: m.env, u: m.u, crit: m.crit }, R) +
        (trussSel !== 'env' ? `<br><span class="k">Dans ce cas</span> ${N[+q] >= 0 ? '+' : '−'}${nf(Math.abs(N[+q]), 1)} kN` : '') +
        `<br><span class="k">Longueurs de flambement</span> ${nf(m.Lin, 2)} m (plan) · ${nf(m.Lout, 2)} m (hors plan)`;
      showFloat(html, e.clientX, e.clientY);
    };
    wrap.onmouseleave = hideFloat;
  }

  /* ----- Infobulle flottante (onglets) ----- */
  let floatTip = null;
  function showFloat(html, x, y) {
    if (!floatTip) { floatTip = document.createElement('div'); floatTip.className = 'tip'; floatTip.style.position = 'fixed'; document.body.appendChild(floatTip); }
    floatTip.innerHTML = html; floatTip.hidden = false;
    const w = floatTip.offsetWidth, h = floatTip.offsetHeight;
    floatTip.style.left = Math.min(innerWidth - w - 8, x + 14) + 'px';
    floatTip.style.top = Math.max(8, y - h - 12) + 'px';
  }
  function hideFloat() { if (floatTip) floatTip.hidden = true; }

  /* ----- Carte des limites ----- */
  let mapMode = 'verdict', mapKey = '', mapGen = 0, mapData = null;
  function mapGrid() {
    const flat = P.typo === 'flat';
    const xs = []; for (let x = 6; x <= 60 + 1e-9; x += 2) xs.push(x);
    const ys = []; const y0 = flat ? 0.4 : 0.5, y1 = flat ? 4.0 : 8.0, st = flat ? 0.15 : 0.3;
    for (let y = y0; y <= y1 + 1e-9; y += st) ys.push(+y.toFixed(2));
    return { xs, ys };
  }
  function paneMap(el) {
    el.innerHTML = `<p class="lead">Chaque case est un calcul complet — géométrie, efforts, choix des profils, vérifications — pour une portée et une hauteur de ferme, tous les autres paramètres restant ceux du panneau de gauche. Le point marque votre projet ; cliquez une case pour l’essayer.</p>
      <div class="toolbar"><div class="seg" style="width:auto" role="group" aria-label="Affichage de la carte"><button type="button" data-m="verdict">Verdict</button><button type="button" data-m="mass">Masse (kg/m²)</button></div><span class="small" id="mapstat"></span></div>
      <div class="progress"><i id="mapprog"></i></div>
      <div class="svgwrap mapwrap" id="mapwrap"></div>
      <div class="toolbar" style="margin-top:10px" id="maplegend"></div>`;
    el.querySelectorAll('[data-m]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.m === mapMode));
      b.addEventListener('click', () => { mapMode = b.dataset.m; el.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === mapMode))); paintMap(); });
    });
    const key = JSON.stringify(Object.assign({}, P, { span: 0, trussH: 0, panels: P.panelsAuto ? 0 : P.panels }));
    if (key !== mapKey || !mapData) computeMap(key); else { drawMapFrame(); paintMap(); }
  }
  function computeMap(key) {
    mapKey = key;
    const gen = ++mapGen;
    const { xs, ys } = mapGrid();
    mapData = { xs, ys, cells: new Array(xs.length * ys.length).fill(null), done: 0 };
    drawMapFrame();
    const order = [];
    // ordre entrelacé : une case sur deux d'abord, pour voir vite la forme du domaine
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) if (((i + j) & 1) === pass) order.push([i, j]);
    let k = 0;
    const step = () => {
      if (gen !== mapGen) return;
      const t0 = performance.now();
      while (k < order.length && performance.now() - t0 < 14) {
        const [i, j] = order[k++];
        const Pc = Object.assign({}, P, { span: xs[i], trussH: ys[j] });
        let cell;
        if (P.typo !== 'flat' && ys[j] <= P.aboutH + 0.1) cell = { na: true };
        else {
          try {
            const r = PS.compute(Pc, { light: true });
            cell = { v: r.diag.verdict, m: r.qty ? r.qty.perM2 : null, why: r.diag.items.filter((d) => d.status !== 'ok').map((d) => ({ s: d.status, t: d.title })) };
          } catch (err) { cell = { na: true }; }
        }
        mapData.cells[j * xs.length + i] = cell;
        mapData.done++;
        paintCell(i, j);
      }
      const pr = $('#mapprog'); if (pr) pr.style.width = (100 * mapData.done / order.length).toFixed(1) + '%';
      const stt = $('#mapstat'); if (stt) stt.textContent = k < order.length ? `calcul… ${Math.round(100 * k / order.length)} %` : `${order.length} configurations calculées`;
      if (k < order.length) setTimeout(step, 0);
      else renderMapLegend();
    };
    setTimeout(step, 0);
  }
  let mapGeom = null;
  function drawMapFrame() {
    const wrap = $('#mapwrap'); if (!wrap || !mapData) return;
    const { xs, ys } = mapData;
    const cw = 22, chh = 14, ml = 46, mb = 34, mt = 10, mr = 12;
    const W = ml + xs.length * cw + mr, H = mt + ys.length * chh + mb;
    mapGeom = { cw, chh, ml, mb, mt, W, H };
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte de constructibilité portée × hauteur">`;
    for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
      s += `<rect id="mc-${i}-${j}" data-i="${i}" data-j="${j}" x="${ml + i * cw + 0.5}" y="${mt + (ys.length - 1 - j) * chh + 0.5}" width="${cw - 1}" height="${chh - 1}" rx="1.5" style="fill:var(--inset)"/>`;
    }
    for (let i = 0; i < xs.length; i++) if (xs[i] % 6 === 0) s += `<text x="${ml + i * cw + cw / 2}" y="${mt + ys.length * chh + 14}" font-size="10" text-anchor="middle" class="ink3" style="font-family:var(--font-mono)">${xs[i]}</text>`;
    const yt = P.typo === 'flat' ? 0.5 : 1;
    for (let j = 0; j < ys.length; j++) if (Math.abs(ys[j] / yt - Math.round(ys[j] / yt)) < 1e-6) s += `<text x="${ml - 6}" y="${mt + (ys.length - 1 - j) * chh + chh / 2 + 3.5}" font-size="10" text-anchor="end" class="ink3" style="font-family:var(--font-mono)">${nf(ys[j], ys[j] % 1 ? 1 : 0)}</text>`;
    s += `<text x="${ml + xs.length * cw / 2}" y="${H - 4}" font-size="11" text-anchor="middle" class="ink2">Portée (m)</text>`;
    s += `<text transform="translate(12 ${mt + ys.length * chh / 2}) rotate(-90)" font-size="11" text-anchor="middle" class="ink2">${P.typo === 'flat' ? 'Hauteur de poutre (m)' : 'Hauteur de ferme (m)'}</text>`;
    s += `<g id="mapmark"></g></svg>`;
    wrap.innerHTML = s;
    wrap.onmousemove = (e) => {
      const r = e.target.closest && e.target.closest('rect[data-i]');
      if (!r) { hideFloat(); return; }
      const i = +r.dataset.i, j = +r.dataset.j, c = mapData.cells[j * xs.length + i];
      let html = `<strong>Portée ${nf(xs[i], 0)} m · hauteur ${nf(ys[j], 2)} m</strong><br>`;
      if (!c) html += 'calcul en cours…';
      else if (c.na) html += 'hauteur inférieure à la hauteur d’about';
      else {
        html += `${VERDICT[c.v]}${c.m ? ` · ${nf(c.m, 1)} kg/m²` : ''}`;
        if (c.why.length) html += '<br>' + c.why.map((w) => `<span style="color:var(--${w.s})">●</span> ${esc(w.t)}`).join('<br>');
      }
      showFloat(html, e.clientX, e.clientY);
    };
    wrap.onmouseleave = hideFloat;
    wrap.onclick = (e) => {
      const r = e.target.closest && e.target.closest('rect[data-i]'); if (!r) return;
      const i = +r.dataset.i, j = +r.dataset.j, c = mapData.cells[j * xs.length + i];
      if (!c || c.na) return;
      P.span = xs[i]; P.trussH = ys[j];
      if (P.aboutH > P.trussH - 0.1) P.aboutH = Math.max(0, P.trussH - 0.1);
      syncControls(); schedule();
    };
    for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) paintCell(i, j);
    drawMark();
  }
  const hex = (h) => { h = h.trim().replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((k) => parseInt(h.substr(k, 2), 16)); };
  const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function ramp(t) {
    const dark = cssv('--bg').toLowerCase() < '#5';
    const a = hex(dark ? '#1C3431' : '#E4F1EC'), b = hex(dark ? '#8FDCCF' : '#1E5C56');
    t = Math.max(0, Math.min(1, t));
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`;
  }
  function paintCell(i, j) {
    const r = document.getElementById(`mc-${i}-${j}`); if (!r || !mapData) return;
    const c = mapData.cells[j * mapData.xs.length + i];
    let fill = 'var(--inset)';
    if (c) {
      if (c.na) fill = 'var(--cell-na)';
      else if (mapMode === 'verdict') fill = `var(--cell-${c.v})`;
      else fill = c.v === 'bad' ? 'var(--cell-na)' : ramp(((c.m || 0) - 10) / 50);
    }
    r.style.fill = fill;
  }
  function paintMap() { if (!mapData) return; for (let j = 0; j < mapData.ys.length; j++) for (let i = 0; i < mapData.xs.length; i++) paintCell(i, j); renderMapLegend(); }
  function drawMark() {
    const g = document.getElementById('mapmark'); if (!g || !mapGeom) return;
    const { xs, ys } = mapData, { cw, chh, ml, mt } = mapGeom;
    const fx = (P.span - xs[0]) / (xs[xs.length - 1] - xs[0]), fy = (P.trussH - ys[0]) / (ys[ys.length - 1] - ys[0]);
    if (fx < -0.02 || fx > 1.02 || fy < -0.02 || fy > 1.02) { g.innerHTML = ''; return; }
    const x = ml + cw / 2 + fx * (xs.length - 1) * cw, y = mt + chh / 2 + (1 - fy) * (ys.length - 1) * chh;
    g.innerHTML = `<circle cx="${x}" cy="${y}" r="6.5" style="fill:none;stroke:var(--ink);stroke-width:2"/><circle cx="${x}" cy="${y}" r="2" style="fill:var(--ink)"/>`;
  }
  function renderMapLegend() {
    const el = $('#maplegend'); if (!el) return;
    if (mapMode === 'verdict') el.innerHTML = ['ok', 'warn', 'bad'].map((s) => `<span class="small" style="display:inline-flex;gap:6px;align-items:center"><i style="width:14px;height:10px;border-radius:2px;background:var(--cell-${s});display:inline-block"></i>${VERDICT[s]}</span>`).join('') + '<span class="small">Réserves : proportions, angles, transport, économie. Hors limites : aucun profil ne passe, flèche excessive, pente insuffisante ou masse démesurée. Survolez une case pour le détail.</span>';
    else el.innerHTML = `<span class="small" style="display:inline-flex;gap:8px;align-items:center">10 kg/m² <i style="width:120px;height:10px;border-radius:2px;display:inline-block;background:linear-gradient(90deg, ${ramp(0)}, ${ramp(0.5)}, ${ramp(1)})"></i> 60 kg/m² et plus</span><span class="small" style="display:inline-flex;gap:6px;align-items:center"><i style="width:14px;height:10px;border-radius:2px;background:var(--cell-na);display:inline-block"></i>hors limites</span>`;
  }

  /* ----- Acier / bois ----- */
  let cmpKey = '', cmpData = null;
  function paneCompare(el) {
    const key = JSON.stringify(Object.assign({}, P, { material: '' }));
    if (key !== cmpKey || !cmpData) {
      cmpKey = key;
      cmpData = { steel: PS.compute(Object.assign({}, P, { material: 'steel' }), { light: true }), timber: PS.compute(Object.assign({}, P, { material: 'timber' }), { light: true }) };
    }
    const S = cmpData.steel, T = cmpData.timber;
    const cur = P.material;
    const vol = (r) => {
      if (!r.qty) return null;
      const t = r.geo.truss;
      if (r.material.kind === 'steel') return r.qty.total / 7850;
      let v = 0;
      for (const m of t.members) v += r.secs[m.g].A * 1e-6 * m.L;
      v *= r.geo.nFrames;
      v += 2 * r.geo.nFrames * r.P.colH * r.secs.col.A * 1e-6;
      v += r.geo.purlins.length * r.P.length * r.purl.sec.A * 1e-6;
      return v;
    };
    const cell = (r, fn) => { try { return fn(r); } catch (e) { return '—'; } };
    const rows = [
      ['Verdict', (r) => `<span class="pill ${r.diag.verdict}">${VERDICT[r.diag.verdict]}</span>`],
      ['Masse de la structure', (r) => `${nf(r.qty.total / 1000, 2)} t`],
      ['Ratio', (r) => `${nf(r.qty.perM2, 1)} kg/m²`],
      ['Volume de matière', (r) => `${nf(vol(r), 2)} m³`],
      ['Membrure supérieure', (r) => r.secs.top.label],
      ['Membrure inférieure', (r) => r.secs.bot.label],
      ['Montants', (r) => r.secs.vert.label],
      ['Diagonales', (r) => r.secs.diag.label],
      ['Poteaux', (r) => r.secs.col.label],
      ['Pannes', (r) => r.purl.sec.label],
      ['Flèche de la ferme', (r) => `${nf(r.sls.defl * 1000, 0)} mm / ${nf(r.sls.deflLim * 1000, 0)} mm`],
      ['Masse d’une ferme', (r) => `${nf(r.qty.trussUnit, 0)} kg`],
    ];
    const hd = `<div class="h">Critère</div><div class="h${cur === 'steel' ? ' cur' : ''}">Acier ${esc(P.steelGrade)}</div><div class="h${cur === 'timber' ? ' cur' : ''}">Bois ${esc(P.timberGrade)}</div>`;
    const body = rows.map(([k, fn]) => `<div class="k">${k}</div><div class="v${cur === 'steel' ? ' cur' : ''}">${cell(S, fn)}</div><div class="v${cur === 'timber' ? ' cur' : ''}">${cell(T, fn)}</div>`).join('');
    const ms = S.qty ? S.qty.perM2 : 0, mt = T.qty ? T.qty.perM2 : 0, mm = Math.max(ms, mt, 1);
    const vs = vol(S) || 0, vt = vol(T) || 0;
    const bars = `<div style="display:grid;gap:8px;margin-top:4px">
      <div><div class="small">Acier — ${nf(ms, 1)} kg/m²</div><div class="bar-u" style="height:10px"><i style="width:${(100 * ms / mm).toFixed(0)}%;background:var(--steel-bar, #6E7E87)"></i></div></div>
      <div><div class="small">Bois — ${nf(mt, 1)} kg/m²</div><div class="bar-u" style="height:10px"><i style="width:${(100 * mt / mm).toFixed(0)}%;background:#C08C55"></i></div></div></div>`;
    el.innerHTML = `<div class="cols"><div><h4>Même projet, deux matériaux</h4><p class="lead">Le calcul est refait avec la même géométrie, les mêmes charges et la même couverture ; seuls les matériaux et leurs règles (Eurocode 3 pour l’acier, Eurocode 5 pour le bois) changent.</p>
      <div class="scroll-x"><div class="cmp">${hd}${body}</div></div></div>
      <div><h4>Ce qu’il faut retenir</h4>${bars}
      <p class="lead" style="margin-top:14px">Le bois est environ ${nf(7850 / (PS.cat.TIMBER[P.timberGrade] || PS.cat.TIMBER.GL24h).rhomean, 0)} fois moins dense que l’acier, mais environ ${nf(210000 / (PS.cat.TIMBER[P.timberGrade] || PS.cat.TIMBER.GL24h).E0mean, 0)} fois moins raide et nettement moins résistant : ses sections sont bien plus grosses${vs && vt ? ` (ici ${nf(vt / vs, 0)} fois plus de volume)` : ''}, la structure reste pourtant plus légère.</p>
      <p class="lead">En bois, ce sont souvent les assemblages qui dimensionnent : la section nette autour des broches (80 % de la section ici) et la place nécessaire pour les loger. Le fluage augmente aussi la flèche à long terme (k<sub>def</sub> = 0,6).</p></div></div>`;
  }

  /* ----- Nomenclature ----- */
  function paneBom(el) {
    if (!R.bom) { el.innerHTML = `<p class="lead">${esc(R.error || 'Pas de nomenclature.')}</p>`; return; }
    const b = R.bom, timber = R.material.kind === 'timber';
    const tile = (k, v, u) => `<div class="tile"><span>${k}</span><b>${v}${u ? ` <small>${u}</small>` : ''}</b></div>`;
    const tiles = tile('Masse totale', nf(b.total / 1000, 2), 't') + tile('Ratio', nf(b.perM2, 1), 'kg/m²') + tile('Pièces', nf(b.pieces, 0), '') +
      tile('Repères distincts', nf(b.marks, 0), '') +
      (timber ? tile('Volume de bois', nf(b.timberVol, 2), 'm³') + tile('Dont acier', nf(b.steelMass / 1000, 2), 't')
        : tile('Surface à peindre', nf(b.paint, 0), 'm²') + tile('Éclisses de chantier', nf(b.splices * R.geo.nFrames, 0), '')) +
      tile('Ferme assemblée', nf(b.heaviest, 0), 'kg') + tile(timber ? 'Broches' : 'Boulons', nf(b.bolts, 0), '');
    let cat = '', rows = '';
    for (const r of b.rows) {
      if (r.cat !== cat) { cat = r.cat; rows += `<tr class="cat"><td colspan="7">${esc(cat)}</td></tr>`; }
      rows += `<tr><td>${esc(r.item)}${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}</td><td class="mono">${esc(r.profile)}</td><td class="n">${nf(r.qty, 0)}</td><td class="n">${r.unitLen != null ? nf(r.unitLen, 2) : '—'}</td><td class="n">${r.totalLen != null ? nf(r.totalLen, 1) : '—'}</td><td class="n">${r.unitMass != null ? nf(r.unitMass, 1) : '—'}</td><td class="n">${nf(r.mass, 0)}</td></tr>`;
    }
    el.innerHTML = `<div class="tiles">${tiles}</div>
      <div class="toolbar"><button class="btn primary" type="button" id="csv">Télécharger le tableau (CSV)</button><button class="btn" type="button" id="obj">Exporter la maquette pour Rhino (OBJ)</button><button class="btn" type="button" id="copy">Copier le tableau</button></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Désignation</th><th>Profil</th><th class="n">Qté</th><th class="n">L. unit. (m)</th><th class="n">L. totale (m)</th><th class="n">kg/m</th><th class="n">Masse (kg)</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td colspan="6">Total</td><td class="n">${nf(b.total, 0)}</td></tr></tfoot></table></div>
      <p class="small" style="margin-top:8px">Goussets, platines et boulonnerie sont estimés d’après les efforts ; les longueurs sont celles des axes, sans chutes ni coupes d’onglet. Export OBJ en mètres, Y vertical, un groupe par type de pièce plus les axes des barres.</p>`;
    $('#csv', el).addEventListener('click', () => saveFile('atelier-treillis-nomenclature.csv', '﻿' + bomCSV(), 'text/csv'));
    $('#copy', el).addEventListener('click', () => {
      const txt = bomCSV().replace(/;/g, '\t');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Tableau copié'), () => toast('Copie refusée par le navigateur'));
      else toast('Copie indisponible');
    });
    $('#obj', el).addEventListener('click', exportOBJ);
  }
  function bomCSV() {
    const b = R.bom, n = (v, d) => v == null ? '' : nf(v, d).replace(/ | /g, '');
    const lines = [['Catégorie', 'Désignation', 'Profil', 'Quantité', 'Longueur unitaire (m)', 'Longueur totale (m)', 'Masse linéique (kg/m)', 'Masse (kg)', 'Remarque'].join(';')];
    for (const r of b.rows) lines.push([r.cat, r.item, r.profile, r.qty, n(r.unitLen, 3), n(r.totalLen, 2), n(r.unitMass, 2), n(r.mass, 1), r.note].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';'));
    lines.push(['', 'Total', '', '', '', '', '', n(b.total, 1), ''].join(';'));
    lines.push('');
    lines.push(`"Projet";"${P.typo} ${P.pattern}, portée ${P.span} m, longueur ${P.length} m, poteaux ${P.colH} m, ferme ${P.trussH} m, ${P.material === 'steel' ? 'acier ' + P.steelGrade : 'bois ' + P.timberGrade}, couverture ${P.roofing}"`);
    return lines.join('\r\n');
  }
  async function exportOBJ() {
    if (!PS.view3d || !viewOK) { toast('La vue 3D est nécessaire pour l’export'); return; }
    const obj = PS.view3d.exportOBJ(R);
    const inArtifact = !!(G.claude && G.claude.use);
    if (inArtifact) await saveFile('atelier-treillis.zip', zipStore('atelier-treillis.obj', new TextEncoder().encode(obj)), 'application/zip');
    else await saveFile('atelier-treillis.obj', obj, 'text/plain');
  }
  async function saveFile(name, data, mime) {
    if (G.claude && G.claude.use) {
      try {
        const dl = await G.claude.use('downloads');
        if (dl) { await dl.save({ filename: name, data: typeof data === 'string' ? data : new Blob([data], { type: mime }) }); toast('Fichier enregistré'); return; }
      } catch (err) {
        if (err && err.code === 'declined') { toast('Téléchargement annulé'); return; }
        if (err && err.code === 'rejected_extension') { toast('Format refusé par cette vue'); return; }
      }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Fichier enregistré');
  }
  // ZIP minimal sans compression (le format .obj n'est pas proposé directement par la visionneuse d'artefacts)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function zipStore(name, bytes) {
    let crc = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8); crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const nb = new TextEncoder().encode(name), size = bytes.length;
    const lh = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, size, 4], [22, size, 4], [26, nb.length, 2], [28, 0, 2]].forEach(([o, v, s]) => s === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true));
    const cd = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, size, 4], [24, size, 4], [28, nb.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, 0, 4]].forEach(([o, v, s]) => s === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true));
    const cdOff = 30 + nb.length + size, cdSize = 46 + nb.length;
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, 1, 2], [10, 1, 2], [12, cdSize, 4], [16, cdOff, 4], [20, 0, 2]].forEach(([o, v, s]) => s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
    return new Blob([lh, nb, bytes, cd, nb, end], { type: 'application/zip' });
  }

  /* ----- Hypothèses ----- */
  function paneHyp(el) {
    const lp = R.lp, g = R.geo, m = R.material, timber = m.kind === 'timber';
    const dl = (rows) => `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    el.innerHTML = `<div class="warnbox"><strong>Outil pédagogique de prédimensionnement.</strong> Les résultats donnent des ordres de grandeur pour comprendre et comparer des partis structurels. Ils ne remplacent pas la note de calcul d’un bureau d’études (assemblages, fondations, neige accidentelle, sismique, incendie, vérifications locales).</div>
    <div class="hyp">
      <section><h4>Modèle</h4><p>Une file courante est calculée en 2D : ferme en treillis articulé, posée en tête de poteaux encastrés en pied (système hyperstatique, comme dans le tutoriel). Méthode des déplacements, élasticité linéaire. Toutes les fermes reçoivent le profil de la file courante.</p>
      ${dl([['Panneaux', `${g.n} × ${nf(g.truss.dx, 2)} m`], ['Barres de la ferme', g.truss.members.length], ['Entraxe', `${nf(g.e, 2)} m`], ['Filants (maintien hors plan)', `tous les ${g.kb} nœuds`], ['Poids propre des assemblages', '+10 %']])}</section>
      <section><h4>Neige — NF EN 1991-1-3</h4>${dl([['Région', `${esc(P.snowRegion)}, altitude ${P.altitude} m`], ['s<sub>k</sub>', `${nf(lp.sk, 2)} kN/m²`], ['Pente', `${nf(lp.alphaDeg, 1)}°`], ['μ<sub>1</sub>', nf(lp.mu1, 2)], ['s = μ<sub>1</sub> s<sub>k</sub>', `${nf(lp.s, 2)} kN/m²`], ['Cas dissymétrique', g.shape.twoSided ? '0,5 μ₁ sur un versant' : '—']])}</section>
      <section><h4>Vent — NF EN 1991-1-4</h4>${dl([['Région', `${P.windRegion} (v<sub>b,0</sub> = ${lp.wind.vb} m/s)`], ['Rugosité', esc(PS.TERRAIN[P.terrain].label)], ['Hauteur de référence', `${nf(lp.wind.z, 1)} m`], ['q<sub>p</sub>(z)', `${nf(lp.qp, 3)} kN/m²`], ['c<sub>pe</sub> parois D / E', `${nf(lp.cpeD, 2)} / ${nf(lp.cpeE, 2)}`], ['c<sub>pi</sub>', '+0,2 / −0,3'], ['Toiture', 'zones H et I, c<sub>pe,10</sub>']])}</section>
      <section><h4>Charges permanentes</h4>${dl([['Couverture', `${esc(g.roofing.label)} — ${nf(g.roofing.g, 2)} kN/m²`], ['Pannes', `${esc(R.purl.sec.label)} tous les ${nf(Math.max(...g.purlins.map((p) => p.trib)), 2)} m max`], ['Ferme et poteaux', 'poids propre des profils']])}</section>
      <section><h4>Combinaisons (EC0, 6.10)</h4><p>${R.combos.map((c) => `${c.id} : ${esc(c.label)}`).join('<br>')}</p><p>ELS : G + S pour la flèche, G + W pour le déplacement en tête.</p></section>
      <section><h4>Matériau</h4>${timber ? dl([['Classe', esc(m.tg.label)], ['f<sub>t,0,k</sub> / f<sub>c,0,k</sub> / f<sub>m,k</sub>', `${m.tg.ft0k} / ${m.tg.fc0k} / ${m.tg.fmk} MPa`], ['E<sub>0,mean</sub> / E<sub>0,05</sub>', `${m.tg.E0mean} / ${m.tg.E005} MPa`], ['γ<sub>M</sub>', nf(m.tg.gM, 2)], ['k<sub>mod</sub>', '0,6 (permanent) / 0,9 (neige, vent)'], ['k<sub>def</sub> (classe de service 1)', nf(m.tg.kdef, 1)], ['Section nette en traction', '80 %']])
        : dl([['Nuance', `${m.grade.key}, f<sub>y</sub> = ${m.fy} MPa`], ['E', '210 000 MPa'], ['γ<sub>M0</sub> = γ<sub>M1</sub>', '1,00'], ['Flambement', 'courbes EC3 (tubes finis à chaud : a)'], ['Classe de section', '≤ 3 (sections élancées exclues)'], ['Tirants', 'S235, section résistante filetée']])}</section>
      <section><h4>Limites retenues</h4>${dl([['Flèche de ferme', `l / ${g.roofing.deflRatio}`], ['Flèche de panne', `e / ${g.roofing.deflRatio}`], ['Déplacement en tête', 'H / 150'], ['Élancement barre comprimée', timber ? '150' : '200'], ['Élancement barre tendue', timber ? '250' : '300'], ['Pente minimale', `${nf(g.roofing.minSlope * 100, 0)} % (valeur indicative)`], ['Longueur de barre', '12 m (éclisse au-delà)']])}</section>
      <section><h4>D’où vient la géométrie</h4><p>La logique de construction reprend les tutoriels Grasshopper de Keris Studio : division de la portée, décalage de liste pour les diagonales, symétrie, nombre de fermes arrondi puis entraxe recalculé, contreventement des travées d’extrémité.</p><p><a href="https://www.keris-studio.fr/blog/?p=11665" target="_blank" rel="noopener">Ferme paramétrique, partie 1</a> · <a href="https://www.keris-studio.fr/blog/?p=11711" target="_blank" rel="noopener">partie 2 : trame et contreventements</a></p></section>
    </div>`;
  }

  /* ---------------- Divers ---------------- */
  let toastT = null;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function onTheme() {
    if (PS.view3d && viewOK) PS.view3d.applyTheme();
    if (tab === 'map') paintMap();
  }

  /* ---------------- Démarrage ---------------- */
  function start() {
    buildParams();
    buildTabs();
    buildViewControls();
    syncControls();
    try {
      if (!PS.view3d || !G.THREE || !G.THREE.OrbitControls) throw new Error('three.js indisponible');
      PS.view3d.init($('#viewport'), $('#tip'));
      viewOK = true;
    } catch (err) {
      console.error(err);
      $('#gl-error').hidden = false;
    }
    run();
    const mq = G.matchMedia && G.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) mq.addEventListener('change', onTheme);
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
