# Fiche prompt — Atelier Treillis

| | |
| --- | --- |
| **Objet** | Prompt détaillé permettant de reconstruire l'application web « Atelier Treillis » |
| **Version décrite** | v1 du 27 septembre 2026 |
| **Application** | https://claude.ai/artifact/EwaiU9CaVSe7wgYZgG7btv |
| **Diagnostic de faisabilité** | https://claude.ai/artifact/UwpG4nnb2y8ybY3vo6ppRe |
| **Sources de la logique géométrique** | Tutoriels Grasshopper Keris Studio : [partie 1](https://www.keris-studio.fr/blog/?p=11665), [partie 2](https://www.keris-studio.fr/blog/?p=11711) |
| **Code de référence** | `M:\RHINO-GRASSHOPPER\PARA-STRUCTURE` |

**Mode d'emploi.** Tout ce qui se trouve entre « Début du prompt » et « Fin du prompt » peut être donné tel quel à un assistant de programmation. Le prompt est volontairement très précis : il fixe les valeurs numériques, les formules et les règles de décision de la v1 pour que le résultat soit reproductible. Pour faire évoluer l'outil, modifier la section concernée plutôt que d'ajouter des consignes en fin de texte.

---

## Début du prompt

### 1. Mission

Réalise une application web **pédagogique** de conception de **fermes de toiture paramétriques**, destinée à des étudiants en architecture. L'utilisateur fait varier la portée, la longueur, les hauteurs et la trame ; la structure se recompose automatiquement de façon constructivement cohérente, est prédimensionnée selon les Eurocodes (version simplifiée), et l'application dit si la proposition est constructible, pourquoi, et où se situent les limites. La structure est montrée en 3D avec ses vrais composants (profilés réels, goussets, platines, couverture), sur un socle de maquette avec des personnages à l'échelle. L'application estime le nombre de pièces et la masse.

L'outil fait du **prédimensionnement** : des ordres de grandeur fiables pour comprendre et comparer. Il ne remplace pas une note de calcul, et doit le dire.

Langue de l'interface : **français** (virgule décimale, espaces fines pour les milliers, unités SI).

### 2. Contraintes techniques

- Application **100 % côté navigateur**, sans serveur ni étape de compilation : HTML + CSS + JavaScript « classique » (pas de modules ES, pour pouvoir ouvrir le fichier assemblé directement).
- 3D : **three.js r147 en build UMD** depuis jsDelivr (dernière version qui fournit encore `examples/js`) :
  - `https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js`
  - `https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js`
  - `https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/renderers/CSS2DRenderer.js`
- Polices Google Fonts uniquement, avec pile de secours : **Archivo** (axes `wdth` 62–125 et `wght` 400–800) pour l'interface, **IBM Plex Mono** (400, 500, 600) pour les nombres.
- Aucune autre ressource externe. Aucune dépendance npm à l'exécution.
- Code organisé en modules qui partagent un espace de noms global `PS`, chaque fichier étant une IIFE `(function (G) { … })(typeof window !== 'undefined' ? window : globalThis)`, pour que le calcul puisse aussi tourner sous Node pour les tests.
- Le calcul complet d'une configuration doit prendre **moins de 30 ms** ; une configuration « légère » (sans maquette ni nomenclature) environ 5 ms.

Arborescence attendue :

| Fichier | Rôle |
| --- | --- |
| `index.html` | interface, styles, chargement des scripts |
| `js/catalogue.js` | catalogues de sections acier et bois |
| `js/fem.js` | solveur 2D par la méthode des déplacements |
| `js/model.js` | paramètres, géométrie, trame, contreventements, charges climatiques |
| `js/design.js` | combinaisons, vérifications, choix des profils, diagnostic, maquette 3D (données), nomenclature |
| `js/view3d.js` | rendu three.js, infobulles, export OBJ |
| `js/ui.js` | panneau de paramètres, onglets, carte des limites, comparaison, exports |
| `tests/run.js` | tests Node |
| `tools/serve.js` | petit serveur statique de développement (port 8765) |
| `tools/build.js` | assemblage en un seul fichier HTML dans `dist/` |
| `README.md` | mode d'emploi |

### 3. Paramètres

| Clé | Libellé | Défaut | Plage / valeurs |
| --- | --- | --- | --- |
| `typo` | Forme de la ferme | `duo` | `duo` (deux pans), `mono` (monopente), `flat` (poutre plate) |
| `pattern` | Treillis | `pratt` | `pratt`, `howe`, `warren` |
| `span` | Portée (largeur) | 16 m | 6 à 60, pas 0,5 |
| `length` | Longueur du bâtiment | 36 m | 6 à 120, pas 0,5 |
| `colH` | Hauteur des poteaux | 5 m | 2,5 à 15, pas 0,1 |
| `trussH` | Hauteur de ferme (au faîtage / côté haut / de la poutre selon `typo`) | 3,2 m | 0,4 à 12, pas 0,05 |
| `aboutH` | Hauteur à l'about (duo) ou côté bas (mono) ; masqué pour `flat` | 0 | 0 à min(4, `trussH` − 0,1), pas 0,05 |
| `flatSlope` | Pente de forme de la poutre plate (%) ; visible pour `flat` | 5 | 0 à 15, pas 0,5 |
| `bayTarget` | Entraxe visé des fermes | 6 m | 2 à 12, pas 0,25 |
| `panelsAuto` | Découpage automatique | vrai | booléen |
| `panels` | Nombre de panneaux (si manuel) | 8 | 2 à 40 |
| `tieSpacing` | Filants de membrure inférieure tous les | 4 m | 1,5 à 12, pas 0,5 |
| `material` | Structure | `steel` | `steel`, `timber` |
| `steelGrade` | Nuance | `S355` | S235, S275, S355 |
| `trussFamily` | Barres de ferme (acier) | `SHS` | `SHS` (tubes carrés), `CHS` (tubes ronds) |
| `colFamily` | Poteaux (acier) | `HEA` | `HEA`, `IPE` |
| `timberGrade` | Classe de bois | `GL24h` | `GL24h`, `GL28h`, `C24` |
| `roofing` | Couverture | `zinc` | `zinc`, `glass` |
| `snowRegion` | Région de neige | `A2` | A1, A2, B1, B2, C1, C2, D, E |
| `altitude` | Altitude | 200 m | 0 à 1 000, pas 50 |
| `windRegion` | Région de vent | 2 | 1 à 4 |
| `terrain` | Rugosité | `IIIa` | `0`, `II`, `IIIa`, `IIIb`, `IV` |

Préréglages lors d'un changement :
- `typo` → `duo` : `trussH` = l/5, `aboutH` = 0 ; `mono` : `trussH` = l/6,5, `aboutH` = 0,4 ; `flat` : `trussH` = max(0,6, l/12) et `flatSlope` = pente minimale de la couverture.
- `roofing` en `flat` : relever `flatSlope` à la pente minimale de la nouvelle couverture si elle est inférieure.
- `trussH` : ramener `aboutH` à `trussH` − 0,1 si nécessaire.
- Passage en découpage manuel : `panels` prend la valeur automatique courante.

Couvertures :

| | Zinc à joint debout | Verrière |
| --- | --- | --- |
| Composition | zinc 0,65 mm sur voligeage bois 27 mm, pare-vapeur | double vitrage feuilleté 8/16/44.2 sur serreurs aluminium |
| Poids g | 0,30 kN/m² de rampant | 0,50 kN/m² |
| Pente minimale (indicative) | 5 % | 10 % |
| Écartement maximal des pannes | 2,5 m | 1,8 m |
| Flèche admissible (fermes et pannes) | portée / 200 | portée / 300 |

### 4. Géométrie paramétrique (`model.js`)

Repère 2D de la ferme : x le long de la portée (0 → l), y vertical, y = 0 en sous-face de membrure inférieure, qui est aussi la tête des poteaux. Repère 3D : x transversal centré, y vertical (sol = 0), z longitudinal centré.

**Forme de toiture.**
- `duo` : hr = `trussH`, ha = min(`aboutH`, hr − 0,05), y(x) = ha + (hr − ha)(1 − |2x/l − 1|), deux versants.
- `mono` : y(x) = ha + (hr − ha)·x/l, un versant.
- `flat` : s = `flatSlope`/100, ha = `trussH`, hr = `trussH` + s·l/2 ; deux versants si s > 0, sinon plate.
- Pente = (hr − ha)/(l/2) pour deux versants, (hr − ha)/l en monopente, 0 si plate.

**Nœuds et barres pour n panneaux** (dx = l/n). Nœuds bas B_i (x_i = i·dx, y = 0) et hauts T_i (x_i, y(x_i)) ; si y(x_i) < 1e-6, T_i est confondu avec B_i (talon de ferme triangulaire). Barres, sans doublon (clé de paire non ordonnée) :
- membrure inférieure B_i–B_i+1, membrure supérieure T_i–T_i+1 ;
- montants B_i–T_i pour tout i où T_i ≠ B_i (montants d'about compris) ;
- une diagonale par panneau : « descendante » T_k–B_k+1 ou « montante » B_k–T_k+1. Une diagonale qui coïncide avec une membrure est ignorée.

**Orientation des diagonales — définition mécanique.** « Pratt » signifie *diagonales tendues* sous la charge de toiture, « Howe » *diagonales comprimées*, quelle que soit la forme. Pour chaque panneau k, avec des charges nodales uniformes P_i = dx (dx/2 aux extrémités) et la réaction R = l/2, écrire l'équilibre des moments du tronçon gauche (méthode de Ritter) autour du point de concours O des deux membrures du panneau :
- si la membrure supérieure du panneau est horizontale : la diagonale descendante est tendue si l'effort tranchant R − ΣP_i (i ≤ k) est positif ;
- sinon x_O = x_k − y_k·dx/Δy, M = −x_O·R − Σ(x_i − x_O)·P_i (i ≤ k). Le moment d'une traction unitaire vaut −y_k(x_k+1 − x_O) pour la descendante et y_k+1(x_k − x_O) pour la montante ; retenir celle dont le moment est de signe opposé à M.

Pratt prend l'orientation tendue, Howe l'autre. Warren : diagonales alternées, symétriques par rapport au milieu (demi-portée gauche : k impair → descendante ; droite : indice miroir m = n − 1 − k, m pair → descendante), avec montants à tous les nœuds.

Ce choix est un point pédagogique à expliquer dans l'interface : dans une ferme triangulaire, la membrure inclinée reprend déjà l'effort tranchant, et les diagonales tendues « montent » vers le faîtage, à l'inverse d'une poutre à membrures parallèles.

**Découpage automatique.** Tester n de 4 à 40 par pas de 2 (deux versants) ou de 2 à 40 par pas de 1, et retenir le coût minimal :

coût = 0,35·n + [si panneau de rampant le plus long > écartement maxi des pannes : 60 + 200·(dépassement)] + Σ diagonales [0,02·(angle − 60)² si angle > 60°, 0,01·(30 − angle)² si angle < 30°]

Pour deux versants, n est pair et ≥ 4.

**Pannes.** Une panne à chaque nœud de membrure supérieure. Si un panneau dépasse l'écartement maximal (découpage manuel), ajouter ceil(longueur/écart maxi) − 1 pannes intermédiaires : elles font fléchir la membrure. Largeur tributaire = demi-distances aux pannes voisines le long du rampant ; normale de panne = moyenne des normales des panneaux adjacents.

**Filants de membrure inférieure.** kb = max(1, round(`tieSpacing`/dx)) ; filants aux nœuds bas d'indices kb, 2kb… et n − kb, n − 2kb… (ensemble symétrique, hors appuis). Maintiens = [0, filants, n].

**Trame** (logique du tutoriel). nTravées = max(1, round(L/`bayTarget`)), entraxe réel e = L/nTravées, nFermes = nTravées + 1.

**Contreventements.**
- Travées contreventées : première et dernière, plus la travée centrale si L > 60 m et nTravées ≥ 5.
- Poutre au vent : par versant (plages [0, n/2] et [n/2, n] ou [0, n]), g = max(1, min(nb panneaux, round(longueur du versant / e))) groupes de panneaux, une croix de tirants par groupe dans chaque travée contreventée.
- Palées de stabilité en long-pans : max(1, round(colH/e)) niveaux de croix, butons aux niveaux intermédiaires.
- Butons de tête le long des deux long-pans sur toute la longueur, sauf côté talon triangulaire, où la panne sablière joue ce rôle.

### 5. Charges (NF EN 1991, annexes nationales françaises, simplifiées)

**Neige.** s_k à 200 m : A1 = A2 = 0,45 ; B1 = B2 = 0,55 ; C1 = C2 = 0,65 ; D = 0,90 ; E = 1,40 kN/m². Au-dessus de 200 m, ajouter :
- régions A à D : A/1000 − 0,20 (200–500 m) ; 1,5A/1000 − 0,45 (500–1 000 m) ; 3,5A/1000 − 2,45 au-delà ;
- région E : 1,5A/1000 − 0,30 ; 3,5A/1000 − 1,30 ; 7A/1000 − 4,80.

μ1 = 0,8 si α ≤ 30°, 0,8(60 − α)/30 jusqu'à 60°, 0 au-delà ; s = μ1·s_k par m² de projection horizontale. Cas dissymétrique (deux versants) : 0,5·s sur le versant gauche.

**Vent.** v_b,0 = 22 / 24 / 26 / 28 m/s pour les régions 1 à 4. Rugosités (z0 ; zmin) : `0` (0,005 ; 1), `II` (0,05 ; 2), `IIIa` (0,2 ; 5), `IIIb` (0,5 ; 9), `IV` (1,0 ; 15). À la hauteur z = max(colH + h_max, zmin) :

k_r = 0,19·(z0/0,05)^0,07 ; v_m = k_r·ln(z/z0)·v_b ; k_l = 1 − 2·10⁻⁴·(log10 z0 + 3)⁶ ; I_v = k_l/ln(z/z0) ; q_p = (1 + 7·I_v)·½·1,225·v_m² (N/m², à convertir en kN/m²).

Coefficients :
- Parois : D (au vent) interpolé de +0,7 (h/d ≤ 0,25) à +0,8 (h/d ≥ 1) ; E (sous le vent) de −0,3 à −0,5 ; h = colH + h_max, d = l.
- Pression intérieure : c_pi = +0,2 pour le cas « soulèvement », −0,3 pour le cas « pression ».
- Toiture, pente α < 5° : demi-toiture au vent −0,7, sous le vent −0,2 (soulèvement) ou +0,2 (pression).
- Deux versants, versant au vent, zone H, interpolation linéaire en α : soulèvement (5° : −0,6 ; 15° : −0,3 ; 30° : −0,2 ; 45° : 0 ; 60° : +0,7 ; 75° : +0,8) ; pression (5° : 0 ; 15° : +0,2 ; 30° : +0,4 ; 45° : +0,6 ; 60° : +0,7 ; 75° : +0,8).
- Versant sous le vent, zone I : 5° : −0,6 ; 15° : −0,4 ; 30° : −0,4 ; 45° : −0,2 ; 60° : −0,2 ; 75° : −0,2.
- Monopente (toiture montant vers x = l) : vent de gauche (égout bas) → tables H ci-dessus ; vent de droite (égout haut) → 5° : −0,8 ; 15° : −0,9 ; 30° : −0,8 ; 45° : −0,7 ; 60° : −0,5 ; 75° : −0,5.

Pression nette p = q_p(c_pe − c_pi), positive vers la paroi. Cas élémentaires : `G`, `S`, `Sa` (deux versants), `W1L` / `W1R` (soulèvement, vent de gauche / droite), `W2L` / `W2R` (pression).

**Combinaisons ELU** (EC0 6.10 ; k_mod bois entre parenthèses) :

| Id | Combinaison | k_mod |
| --- | --- | --- |
| ELU1 | 1,35 G + 1,5 S | 0,9 |
| ELU2 | 1,35 G + 1,5 S dissymétrique (deux versants) | 0,9 |
| ELU3g / d | G + 1,5 W soulèvement | 0,9 |
| ELU4g / d | 1,35 G + 1,5 W pression + 0,75 S | 0,9 |
| ELU5g / d | 1,35 G + 1,5 S + 0,9 W pression | 0,9 |
| ELU0 | 1,35 G | 0,6 |

ELS : G + S pour la flèche (bois : G·(1 + k_def) + S), G + W pour le déplacement en tête.

### 6. Modèle de calcul (`fem.js`, `design.js`)

**Solveur.** Méthode des déplacements 2D en kN et m. Éléments « bar » (barre articulée, EA/L) et « beam » (poutre d'Euler-Bernoulli 6×6 avec rotation). Un nœud ne reçoit de degré de rotation que si une poutre y aboutit. Factorisation de Cholesky de la matrice réduite ; pivot ≤ 10⁻¹¹ × diagonale maximale → « mécanisme : la structure n'est pas stable ». Résolution de plusieurs cas sur la même factorisation. Sorties : déplacements, N (traction > 0) pour les barres, N et moments d'extrémité signés pour les poutres.

**File courante.** Barres de ferme articulées ; deux poteaux en 4 éléments poutre chacun, **encastrés en pied** ; la membrure inférieure est articulée en tête de poteau (système hyperstatique du tutoriel). Rigidités : acier E = 210 000 MPa ; bois E_0,mean. Inertie des poteaux dans le plan : axe fort.

**Charges nodales** (tributaire e) :
- poids propre des barres × 1,10 (assemblages), réparti à moitié sur chaque nœud ; poids propre des poteaux ;
- pannes : masse × e au nœud (panne intermédiaire répartie linéairement sur les deux nœuds) ;
- couverture : g × longueur du panneau × e ;
- neige : s × dx × e ;
- vent de toiture : force −n·p·L_panneau·e, n étant la normale extérieure (−Δy, Δx)/L ;
- vent sur parois : p·e par mètre de hauteur, vers l'intérieur, sur les nœuds des poteaux, plus le tronçon d'about B0–T0 s'il existe.

**Longueurs de flambement.**
- Membrure supérieure : dans le plan, la longueur de barre ; hors plan, la distance entre pannes.
- Membrure inférieure : dans le plan, la longueur de barre ; hors plan, l'intervalle entre maintiens (filants).
- Montants et diagonales : leur longueur.
- Poteaux : 2H dans le plan, H hors plan.

### 7. Vérifications et choix des profils

**Acier (EC3).**
- N_t,Rd = A·f_y ; N_b,Rd = χ·A·f_y, avec γM0 = γM1 = 1,0.
- Courbes de flambement : α = 0,13 (a0), 0,21 (a), 0,34 (b), 0,49 (c), 0,76 (d) ; λ1 = π√(E/f_y) ; Φ = 0,5[1 + α(λ̄ − 0,2) + λ̄²].
- Élancement limite 200 en compression, 300 en traction.
- Membrure supérieure avec pannes intermédiaires : moment local M = F·L_p·c, où c = m/8 si m est pair et (m² − 1)/(8m) sinon (m sous-panneaux), avec F issu de 1,35(g + pannes) + 1,5·s·cos α. Interaction N/N_b,Rd + M/(W_pl·f_y) ≤ 1.
- Poteaux : N/(χ_min·N_Rd) + M/(χ_LT·M_Rd) ≤ 1 et λ ≤ 200. Déversement : M_cr avec C1 = 1,77, L = H, G = 81 000 MPa ; α_LT = 0,21 si h/b ≤ 2, sinon 0,34.

**Bois (EC5).**
- f_d = k_mod·f_k/γM (γM = 1,25 lamellé-collé, 1,3 massif).
- Traction sur **section nette de 80 %** (assemblages).
- Flambement : λ_rel = (λ/π)√(f_c,0,k/E_0,05), k = 0,5[1 + β_c(λ_rel − 0,3) + λ_rel²], k_c = 1/(k + √(k² − λ_rel²)), β_c = 0,1 (lamellé-collé) ou 0,2 (massif).
- Élancement limite 150 en compression, 250 en traction.
- Poteaux : σ_c/(k_c,y·f_c,d) + σ_m/f_m,d et σ_c/(k_c,z·f_c,d) + 0,7·σ_m/f_m,d.
- Enveloppes d'efforts divisées par le k_mod de chaque combinaison ; k_def = 0,6 (classe de service 1).

**Pannes.** Isostatiques sur un entraxe e, composantes normales au rampant (cos α ; cos² α pour la neige), largeur tributaire maximale.
- Cas : 1,35G + 1,5S ; 1,35G + 1,5 p_max·a + 0,75S ; 1,35G + 1,5S + 0,9 p_max·a ; G + 1,5 p_min·a (soulèvement) ; 1,35G (k_mod 0,6).
- M = q·e²/8, flèche 5·q·e⁴/(384·E·I) ≤ e/200 (zinc) ou e/300 (verre).
- Déversement négligé : la couverture est supposée maintenir la panne (hypothèse à afficher).
- Acier : IPE ; bois : sections rectangulaires.

**Choix automatique** (au plus 40 itérations) :
1. Analyser, puis, pour chaque groupe (membrure supérieure, membrure inférieure, montants, diagonales, poteaux), retenir le profil **le plus léger** du catalogue (trié par masse) qui passe pour toutes les barres du groupe et toutes les combinaisons.
2. Recommencer tant que le choix change. À partir de la 4e itération, les sections ne peuvent plus diminuer (planchers A_min, I_min) : cela garantit la convergence, car le poids propre et l'hyperstaticité poteaux / ferme font sinon osciller le choix.
3. Une fois stable, contrôler les ELS. Si la flèche est dépassée, passer les deux membrures à la première section d'aire ≥ 1,15 fois l'aire actuelle. Si le déplacement en tête est dépassé, passer le poteau à la première section d'inertie ≥ 1,2 fois l'inertie actuelle. Puis reboucler.
4. Si aucun profil ne convient, garder le plus favorable, afficher son taux (> 100 %) et arrêter de renforcer.

**Stabilité d'ensemble.**
- Poutre au vent : w = q_p·(c_pe,D + 0,3)·H_g/2, où H_g = colH + hauteur moyenne du pignon. Effort V = 1,5·w·l/2.
- Tirants de toiture : N = V·L_diag/e. Palées : même formule avec la diagonale d'un niveau.
- Tirants en ronds filetés S235 : N_Rd = min(A·235 ; 0,9·A_s·360/1,25), avec A_s (mm²) = 84,3 / 157 / 245 / 353 / 459 / 561 / 817 / 1 120 pour M12 à M42.
- Butons en tubes ronds S235 : N = V, longueur e.
- Filants en tubes ronds : N = max(1 ; 0,025 × max(compression, 0,5 × traction) de la membrure inférieure), longueur e.
- Contreventements, butons et filants restent en acier même pour une structure bois.

### 8. Catalogues (`catalogue.js`)

- **IPE** 80 à 600 et **HEA** 100 à 600 : dimensions normalisées (h, b, t_w, t_f, r). A, I_y, I_z et W_pl calculés avec les congés (aire (1 − π/4)r², bras de levier h/2 − t_f − 0,2234r). I_t par la formule des profils laminés avec correction des congés ; I_w = I_z(h − t_f)²/4. Courbes : h/b > 1,2 → a / b (y / z), sinon b / c.
- **Tubes carrés finis à chaud** (EN 10210) de 40×3 à 400×16, avec rayons r_o = 1,5t et r_i = t pris en compte dans A, I et W_pl ; courbe a.
- **Tubes ronds** de 33,7×3,2 à 508×12,5 ; courbe a.
- **Ronds pleins** Ø12, 16, 20, 24, 27, 30, 36, 42.
- **Bois** :

  | Classe | f_m,k | f_t,0,k | f_c,0,k | E_0,mean | E_0,05 | ρ_mean |
  | --- | --- | --- | --- | --- | --- | --- |
  | C24 | 24 | 14,5 | 21 | 11 000 | 7 400 | 420 |
  | GL24h | 24 | 19,2 | 24 | 11 500 | 9 600 | 420 |
  | GL28h | 28 | 22,3 | 28 | 12 600 | 10 500 | 460 |

  Unités : MPa et kg/m³. Sections rectangulaires : largeurs 90 à 300 et hauteurs par lamelles de 40 mm (lamellé-collé) ; sections commerciales de 63 à 200 × 75 à 300 (massif).
  - Barres de ferme : h/b ≤ 2 et largeur ≥ 115 mm (lamellé-collé) ou ≥ 75 mm (massif), pour loger les assemblages.
  - Poteaux : h/b ≤ 4.
  - Pannes : h/b ≤ 5.
- Exclure les sections de **classe 4** en compression (ε = √(235/f_y)) : tube carré (b − 3t)/t ≤ 42ε ; tube rond D/t ≤ 90ε² ; profilé en I, semelle ≤ 14ε et âme ≤ 42ε.
- Désignations affichées : « □ 100×5 », « ○ 88,9×4 », « HEA 200 », « IPE 160 », « Ø 20 (M20) », « GL24h 140×240 ».

### 9. Diagnostic de constructibilité

Douze critères, chacun avec un statut (`ok` / `warn` / `bad`), une valeur chiffrée et une explication pédagogique en une ou deux phrases.

| Critère | OK | À surveiller | Hors limite |
| --- | --- | --- | --- |
| Pente de couverture | ≥ pente minimale | — | < minimum (message spécifique pour la poutre plate sans pente) |
| Portée / hauteur | ≤ 8 (≤ 15 pour une poutre plate) | ≤ 16 (≤ 25) | au-delà |
| Inclinaison des diagonales | toutes entre 20° et 65° | sinon | — |
| Pannes posées aux nœuds | panneau ≤ écartement maxi | pannes intermédiaires | — |
| Résistance des barres | tous les groupes passent (taux maxi et critère déterminant) | — | un groupe sans profil |
| Flèche de la ferme | ≤ l/200 ou l/300 | — | dépassée malgré les renforts |
| Déplacement en tête | ≤ H/150 | — | dépassé |
| Portée des pannes | panne trouvée, e ≤ 8 m (acier) ou 6,5 m (bois) | e plus grand | aucune panne |
| Contreventement | tirants et butons trouvés | sinon | — |
| Transport et montage | hauteur de ferme + membrure ≤ 4,0 m | au-delà (convoi exceptionnel) | — |
| Domaine d'emploi | portée ≤ 40 m (acier) ou 30 m (bois) | au-delà | — |
| Dilatation (acier) | L ≤ 60 m | au-delà | — |
| Économie de matière | ≤ 35 kg/m² | ≤ 70 kg/m² | > 70 kg/m² |

Pour le transport, indiquer aussi le nombre de tronçons (barres ≤ 12 m). Verdict global = pire statut : « Constructible », « Constructible, avec réserves », « Hors limites ».

### 10. Maquette et nomenclature (données, `design.js`)

- Barres 3D de chaque ferme (a, b, vecteur « haut » dans le plan de la ferme, section, taux, efforts). Montants et diagonales raccourcis de (demi-hauteur de membrure)/|sin θ| à chaque extrémité, au plus 35 % de leur longueur.
- Poteaux : âme dans le plan du portique ; ils s'arrêtent sous la membrure inférieure.
- Pannes posées sur la membrure (décalage le long de la normale = demi-hauteur de membrure + demi-hauteur de panne), âme perpendiculaire au rampant ; tirants, butons et filants.
- **Goussets.** Enveloppe convexe, dans le plan de la ferme, de points pris sur chaque barre arrivant au nœud. Longueur : 1,6·h + 0,08 m + recoupe pour les barres de treillis, 0,9·h + 0,05 m pour les membrures. Demi-largeur : h/2 + 0,015 m (bois : − 0,01 m). Épaisseur selon l'effort maximal : 8 / 10 / 12 / 15 / 20 mm pour moins de 150 / 300 / 500 / 800 kN et au-delà ; bois : plats de 8 mm en âme.
- Boulons M16 8.8 : max(2, ⌈N/60⌉) par extrémité de barre. Bois : broches Ø12, max(4, ⌈N/14⌉).
- Platines de pied : (h + 150) × (b + 150) mm, épaisseur 20 / 25 / 30 mm (15 en bois), 4 tiges M20 (M24 au-delà de h = 240).
- Plans de couverture posés sur les pannes.
- **Nomenclature**, par catégories (Fermes, Poteaux, Couverture, Stabilité, Assemblages) : désignation, profil, quantité, longueur unitaire, longueur totale, kg/m, masse.
  - Membrures en pièces continues de 12 m au plus, par versant, fusionnées si les longueurs sont identiques. Éclisses de chantier : 2 plats de 250×300×10 et 8 boulons.
  - Montants et diagonales avec la plage de longueurs.
  - Totaux : masse, kg/m² d'emprise, pièces, repères distincts (profil + longueur au cm), surface à peindre (Σ périmètre × longueur) ou volume de bois et part d'acier, masse d'une ferme assemblée, boulons, éclisses.
- **Mode léger** (carte des limites, comparaison) : ni maquette, ni goussets, ni nomenclature ; masse estimée avec +10 % d'assemblages.

### 11. Vue 3D (`view3d.js`)

- **Rendu.** Renderer transparent (le dégradé de fond est en CSS), ombres PCF douces, lumière hémisphérique 0,62, directionnelle 0,78 (carte d'ombre 2 048), ambiante 0,12. Caméra perspective de 30° et OrbitControls amortis (angle polaire maxi 0,495π). Rendu uniquement quand la vue change.
- **Profilés.** Un `ExtrudeGeometry` de profondeur 1 par section (I, tube carré à coins arrondis, tube rond, rond plein, rectangle), mis en cache. Un `InstancedMesh` par section, avec matrice d'instance = base (e_x = e_y × e_z, e_y = « haut » projeté, e_z·L) + translation. **Mettre `frustumCulled = false`** : sinon r147 masque à tort des instances.
- **Modes.** Rendu « Profilés » ou « Filaire » (LineSegments aux couleurs par sommet).
- **Couleurs** :
  - Matière : acier #7F8E96, bois #C99258, tirants #3E474C.
  - Rôle : membrure supérieure #2B7A73, inférieure #2F64B0, montants #7A5BB0, diagonales #D08A2E, poteaux #56656B, pannes #A07A38, contreventements #C0402E, butons et filants #6E8B3D.
  - Efforts : bleu (traction) ou rouge (compression), intensité en racine du rapport à l'effort maximal.
  - Taux : dégradé vert → jaune (60 %) → orange (85 %) → rouge (100 %) → bordeaux (130 %).
- **Assemblages** (option) : goussets extrudés et instanciés sur toutes les fermes, platines.
- **Couverture** (Sans / Partielle / Complète) : partielle = de −L/2 + 0,42L jusqu'à L/2, pour laisser la structure visible côté caméra.
  - Zinc : métallique gris, joints debout tous les 0,53 m (0,035 × 0,012 m).
  - Verre : transparent (opacité 0,24, sans écriture de profondeur), serreurs aluminium tous les 1,2 m.
- **Socle de maquette.** Marge max(4,5 ; min(12 ; 0,16 × max(l, L))), épaisseur max(0,5 ; min(1,4 ; 0,03 × max(l, L))), face supérieure à −0,15 m, dessus clair et flancs plus sombres. Dallage béton de (l + 1,2) × 0,15 × (L + 1,2).
- **Personnages simplifiés** façon maquette (blancs mats, portant des ombres), capsules pour jambes, tronc et bras, sphère pour la tête, pivots aux hanches et aux épaules, taille 1,75 m.
  - Poses : debout, marchant (balancement ± 0,32 rad), montrant la ferme du doigt.
  - Cinq personnages : deux devant le pignon (1,78 m et un enfant de 1,22 m), un sous la première ferme qui la montre, un qui marche à l'intérieur, un qui marche le long du long-pan.
- **Cotes** (CSS2DRenderer, lignes et étiquettes en police mono) : portée devant le pignon, longueur avec graduation des travées sur le long-pan proche, hauteur de poteau, hauteur de ferme.
- **Vues** : Perspective (direction (−1 ; 0,62 ; −1,3)), Pignon, Long-pan, Dessus, **Détail d'un nœud** (nœud d'about de la deuxième ferme, vu de l'intérieur et d'en dessous). Recadrage automatique si l'encombrement varie de plus de 25 %.
- **Infobulle au survol** (raycast des instances ou des lignes) : rôle, profil, longueur, traction et compression maximales, taux et critère déterminant.
- **Export OBJ** en mètres, Y vertical : un groupe par rôle, plus un groupe des axes de barres en polylignes.

### 12. Interface (`index.html`, `ui.js`)

**Disposition.**
- Barre supérieure : logo (petite ferme en trait), nom « Atelier Treillis », sous-titre, pastille de verdict cliquable (couleur, libellé, nombre de points bloquants ou à surveiller), qui ouvre l'onglet Diagnostic.
- Colonne gauche de 330 px : paramètres par sections (Typologie, Dimensions, Trame, Matériau, Couverture, Site). Commandes :
  - curseurs doublés d'un champ numérique éditable (virgule acceptée) ;
  - boutons segmentés, avec pictogrammes SVG pour les formes et les treillis ;
  - listes déroulantes et interrupteurs.
- Notes dynamiques sous les commandes : nature de la couverture ; comportement des diagonales calculé sur le cas ELU1 (« Ici, sous la neige : diagonales tendues, montants comprimés ») ; bloc de valeurs dérivées (panneaux, fermes, entraxe réel, pente, files de pannes) ; bouton « Revenir aux valeurs de départ ».
- Zone centrale : la vue 3D (au moins 320 px) au-dessus d'un dock d'onglets (environ 42 % de la hauteur).
- Surimpressions sur la vue 3D :
  - en haut à gauche, les chiffres clés : masse (t), ratio (kg/m²), pièces, puis fermes ou volume de bois ;
  - en haut à droite, les vues ;
  - en bas à gauche, les réglages d'affichage : rendu, couleurs, couverture, et bascules Assemblages / Socle / Personnages / Cotes ;
  - en bas à droite, la légende du mode de couleur.

**Onglets.**
1. **Diagnostic** : phrase de verdict, liste des critères (pastille, titre, valeur, explication) ; tableau des profils retenus (groupe, profil, taux en % avec barre colorée, critère déterminant, pannes et stabilité comprises).
2. **Ferme type** : élévation SVG à l'échelle, avec :
   - le sol hachuré, les poteaux et les pannes en section ;
   - l'épaisseur des traits égale à la hauteur réelle des profils, la couleur au signe de l'effort et l'opacité à son intensité ;
   - les valeurs en kN et les flèches de charge du cas affiché (options) ;
   - les cotes ; un sélecteur « Enveloppe » ou combinaison ;
   - une infobulle avec les longueurs de flambement.
3. **Limites** : carte portée × hauteur.
   - Grille : portées de 6 à 60 m par pas de 2 ; hauteurs de 0,5 à 8 m par pas de 0,3 (poutre plate : 0,4 à 4 m par pas de 0,15).
   - Chaque case est un calcul léger avec les autres paramètres courants ; case sans objet si h ≤ `aboutH` + 0,1.
   - Calcul par tranches de 14 ms (sans bloquer l'interface), une case sur deux d'abord, barre de progression.
   - Recalcul uniquement si un paramètre autre que la portée ou la hauteur change.
   - Modes Verdict et Masse (rampe de 10 à 60 kg/m²), marqueur du projet courant, infobulle avec les raisons, clic pour appliquer la case.
4. **Acier / bois** : le même projet calculé dans les deux matériaux, en mode léger. Colonnes : verdict, masse, ratio, volume de matière, profils de chaque groupe, flèche, masse d'une ferme. Barres comparatives des kg/m² et paragraphe explicatif (rapports de densité et de raideur calculés, rôle des assemblages et du fluage).
5. **Nomenclature** : 8 tuiles (4 colonnes), tableau par catégories, boutons « Télécharger le tableau (CSV) », « Exporter la maquette pour Rhino (OBJ) », « Copier le tableau ».
6. **Hypothèses** : avertissement de prédimensionnement en tête ; valeurs courantes du modèle, de la neige, du vent, des charges permanentes, des combinaisons, du matériau et des limites ; liens vers les tutoriels Keris Studio.

**Exports.**
- CSV séparé par `;`, avec BOM UTF-8, décimales à virgule et une ligne de description du projet.
- Si la page s'exécute dans une visionneuse d'artefacts (`window.claude.use` existe), utiliser la capacité `downloads`. Le format `.obj` n'y est pas autorisé : l'OBJ est alors livré dans un **ZIP non compressé** (écrit à la main, avec CRC32). Hors visionneuse, lien de téléchargement classique.

**Persistance.** Paramètres, affichage et onglet dans `localStorage` (`atelier-treillis-v1`), chaque accès entouré de try/catch.

**Adaptation mobile.**
- Jusqu'à 900 px : une seule colonne (vue 3D à 64 vh, puis paramètres, puis onglets), réglages d'affichage repliés derrière un bouton « Affichage », vues en bas à droite, légende masquée.
- Jusqu'à 480 px : seulement trois chiffres clés, sous-titre masqué.

**Identité visuelle.**
- Univers « calque de dessinateur et patine du zinc », en évitant les poncifs (crème et terracotta, dégradés violets, emojis).
- Jetons clairs :
  - fond #E7ECEA, panneaux #F7F9F8, encre #152024 / #4F5F64 / #75868A, filets #C8D2CF ;
  - accent vert-de-gris #2B6B66 ;
  - traction #2C62AE, compression #BD3F2D ;
  - statuts #2A7A4B / #936012 / #B0302A.
- Jetons sombres : fond #0F1517, panneaux #161F22, encre #E2EAE8, accent #6CB6AC. Le socle et les personnages restent clairs, comme une maquette posée sur fond sombre.
- Thème clair / sombre en trois états (`prefers-color-scheme` et `data-theme`).
- Libellés en petites capitales d'Archivo condensée (`wdth` 80), nombres en Plex Mono tabulaire, focus clavier visible, `[hidden] { display: none !important; }`, `prefers-reduced-motion` respecté.

### 13. Tests (`tests/run.js`, sous Node)

| Test | Valeur attendue |
| --- | --- |
| Poutre sur deux appuis, charge centrée | flèche PL³/48EI et moment PL/4 exacts |
| Console encastrée | flèche PL³/3EI |
| Triangle articulé (4 m, flèche 1,5 m, 10 kN au sommet) | arbalétriers −8,333 kN, entrait +6,667 kN |
| Trois nœuds alignés | mécanisme détecté |
| IPE 200 | A = 28,48 cm², I_y = 1 943 cm⁴, W_pl,y = 220,6 cm³, I_t ≈ 6,98 cm⁴ |
| HEA 200 | A = 53,83 cm², I_y = 3 692 cm⁴ |
| Tube carré 100×5 | A = 18,7 cm², I = 279 cm⁴, 14,7 kg/m |
| Orientation des diagonales | sous ELU1, Pratt → diagonales tendues et Howe → comprimées, en deux pans, trapèze, poutre plate et monopente |
| Projet par défaut | 8 panneaux de 2 m, 7 fermes ; membrure supérieure □ 60×4, poteaux HEA 220, pannes IPE 140 ; environ 12,2 t et 21 kg/m² ; 354 pièces ; verdict « Constructible » |
| Carte des limites | 728 cellules en quelques secondes |

Afficher aussi une série de cas (bois, verre, monopente, plate sans et avec pente, Howe 24 m, Warren 30 m en tubes ronds, ferme trop plate, 60 m, région E à 1 000 m, about de 1 m), avec profils, taux, flèche, déplacement en tête, masse et verdict.

### 14. Pièges connus

- Les dispositions de treillis définies par leur géométrie de poutre à membrures parallèles inversent le signe des efforts dans une ferme triangulaire : toujours orienter les diagonales par la mécanique (section 4).
- Sans plancher monotone après quelques itérations, le choix des profils peut osciller indéfiniment.
- `display: grid` ou `flex` sur un élément annule l'attribut `hidden` : ajouter la règle globale `[hidden]`.
- Instances masquées par l'élimination hors champ de three.js r147 : `frustumCulled = false`.
- Un aperçu ouvert en `file://` peut ne pas charger les scripts `js/` : servir le dossier (`node tools/serve.js`) ou utiliser la version assemblée.
- Un critère de transport trop sévère (3,5 m) colore de réserves toute la moitié haute de la carte : le seuil pertinent est le convoi exceptionnel (4 m).

### 15. Livrables et critères d'acceptation

- `index.html` et les modules `js/` fonctionnent via `node tools/serve.js`.
- `node tools/build.js` produit :
  - `dist/atelier-treillis-autonome.html`, fichier unique à ouvrir directement ;
  - `dist/atelier-treillis.html`, sans l'enveloppe `<!doctype>`, `<html>`, `<head>`, `<body>` ni les balises meta charset / viewport, pour une publication comme page hébergée qui ajoute sa propre enveloppe.
- Tous les tests passent. Aucune erreur console. Temps de mise à jour imperceptible au curseur.
- Au premier chargement, le projet par défaut s'affiche avec le verdict « Constructible », la maquette couverte partiellement, le socle, les personnages et les cotes.
- Chaque critère du diagnostic explique *pourquoi* et *comment corriger*, dans un langage accessible à un étudiant.

## Fin du prompt

---

*Fiche établie d'après le code de la v1. Pistes d'évolution notées au diagnostic : bilan carbone acier / bois sourcé, fermes Polonceau et en W, arcs treillis, nœuds détaillés, échange JSON avec Grasshopper, mode exercice.*
