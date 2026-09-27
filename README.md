# Atelier Treillis

Application web pédagogique de conception de fermes paramétriques (acier ou bois) : géométrie adaptative,
prédimensionnement Eurocodes simplifié, carte des limites de constructibilité, maquette 3D avec profilés réels,
nomenclature et masse.

## Utiliser

- **Sans rien installer** : ouvrir `dist/atelier-treillis-autonome.html` dans un navigateur (connexion internet
  nécessaire pour three.js et les polices).
- **En développement** : `node tools/serve.js` puis http://localhost:8765 (les modules `js/` sont chargés séparément).

## Organisation

| Fichier | Rôle |
| --- | --- |
| `index.html` | interface et styles |
| `js/catalogue.js` | sections : IPE, HEA, tubes carrés et ronds, tirants, bois C24 / GL24h / GL28h |
| `js/fem.js` | solveur 2D (méthode des déplacements), barres articulées et poutres |
| `js/model.js` | géométrie paramétrique, découpage automatique, trame, contreventements, neige et vent |
| `js/design.js` | combinaisons, vérifications EC3 / EC5, choix des profils, diagnostic, maquette et nomenclature |
| `js/view3d.js` | maquette three.js (r147) : profilés extrudés, goussets, couverture, socle, personnages, cotes, export OBJ |
| `js/ui.js` | paramètres, onglets, carte des limites, comparaison acier / bois, exports |
| `tests/run.js` | vérifications du solveur et des sections, calculs de référence (`node tests/run.js`) |
| `tools/build.js` | assemble la version en un seul fichier dans `dist/` (`node tools/build.js`) |
| `docs/diagnostic.html` | diagnostic de faisabilité |

Outil de prédimensionnement : ordres de grandeur pour comprendre et comparer, pas une note de calcul.
