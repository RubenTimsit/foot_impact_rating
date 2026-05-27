# ISSUES v2 — Audit QA Impact Rating

Audit complet du 27/05/2026. Cette version **remplace** l'audit précédent du 26/05/2026 (devenu obsolète après corrections).

## Légende

- **Statut**
  - `corrige` : corrigé dans le code actuel (audit v1)
  - `corrige-v2` : corrigé dans la passe de correctifs critiques de cet audit
  - `a-faire` : non corrigé, à traiter
  - `partiel` : partiellement corrigé
- **Priorité** : P0 (critique) / P1 (haut) / P2 (moyen) / P3 (bas)

---

## Recap exécutif

| Priorité | Corrigés (v1) | Corrigés (v2, cette passe) | Restants |
|---|---|---|---|
| P0 | 5 | 9 | 0 |
| P1 | 5 | 0 | 12 |
| P2 | 3 | 0 | 14 |
| P3 | 4 | 0 | 13 |

**À retenir :** toutes les failles critiques de sécurité Firestore + le bug d'idempotence du match + l'XSS sont corrigés. Les chantiers restants sont surtout produit (rating gardien/profils, équipes impaires, ex-aequo podium, vérification email, refactor lecture O(n)).

---

## P0 — Critique (toutes corrigées)

### [P0-1] Vote nbVotes bloqué pour non-admin — `corrige`
Rules `matchs/{matchId}` autorisent désormais l'update du seul champ `nbVotes` aux membres actifs ([`firestore.rules`](firestore.rules) L88-91).

### [P0-2] `tryCloseExpiredVote` plante côté client — `corrige`
La fonction est devenue lecture seule ([`groupe.html`](groupe.html) L728-744). La fermeture serveur est gérée par la Cloud Function `processMatchSemaine`.

### [P0-3] Update joueurs falsifiable — `corrige`
Update restreint à `votesParticipes` pour le propriétaire ([`firestore.rules`](firestore.rules) L73-75).

### [P0-4] Dossier `functions/` exposé publiquement — `corrige`
Ajouté à `ignore` dans [`firebase.json`](firebase.json) L18-19.

### [P0-5] Index Firestore manquant (liste d'attente) — `corrige`
Présent dans [`firestore.indexes.json`](firestore.indexes.json) (composite `inscriptions: statut + dateInscription`).

### [P0-6] XSS via `innerHTML` + données utilisateur — `corrige-v2`
Tous les noms, codes, emails injectés via `innerHTML` étaient interpolés sans échappement. Un joueur nommé `<img src=x onerror="...">` exécutait du JS chez tous les membres voyant sa carte. **Fix :** ajout de `escapeHtml()` dans [`js/firebase-config.js`](js/firebase-config.js), appliqué sur [`profil.html`](profil.html), [`groupe.html`](groupe.html), [`admin-groupe.html`](admin-groupe.html), [`super-admin.html`](super-admin.html).

### [P0-7] `matchs_semaine` modifiable par tout membre — `corrige-v2`
Rule `allow update: if isAdminGroupe || isMembre` sans restriction de champ → sabotage possible (`statut: 'fermé'`, `maxJoueurs: 1`, `dateMatch` modifiée, etc.). **Fix :** restreint à `hasOnly(['confirmedCount'])` pour les non-admins ([`firestore.rules`](firestore.rules)).

### [P0-8] Création joueur permet de falsifier toutes les stats — `corrige-v2`
À la création, seuls `statut` et `impactRating` étaient contraints → un attaquant pouvait écrire `trophees: { or: 50 }`, `matchsJoues: 999`, etc. **Fix :** whitelist stricte (stats à 0, statut ∈ {pending, active}, et `active` uniquement par le créateur du groupe).

### [P0-9] Inscriptions : création sans validation de payload — `corrige-v2`
Permettait à un client modifié d'écrire directement `statut: 'confirmé'` sans incrémenter `confirmedCount` (surbooking logique). **Fix :** whitelist `uid == auth.uid` et `statut ∈ {confirmé, attente}`.

### [P0-10] Votes : aucune validation serveur — `corrige-v2`
Pas de vérification que les `top1/top2/top3` étaient distincts, que le votant était présent au match, ou que le vote n'était pas clos. **Fix :** rule complète avec `get()` du match (vérification présence dans `equipeA`/`equipeB` + `voteClos == false`) + check unicité + interdiction d'auto-vote.

### [P0-11] `impactRating` undefined → propagation de NaN — `corrige-v2`
Un membre sans `impactRating` (data partielle) faisait calculer `NaN` au rating moyen, propagé puis écrit en base (corruption permanente). **Fix :** garde-fou `typeof joueur.impactRating === 'number'` dans [`admin-groupe.html`](admin-groupe.html).

### [P0-12] Double validation de match (pas d'idempotence) — `corrige-v2`
Double-clic ou deux onglets admin → deux `batch.commit()` + deux `addDoc(matchs)` → ratings doublés. **Fix :** quand un créneau hebdo `currentOpenMatch` existe, utilisation de `setDoc` avec ID déterministe + check d'existence dans une transaction. Pour les matchs manuels : disable bouton synchrone existant suffit.

### [P0-13] Vote possible après expiration des 24h — `corrige-v2`
La transaction client ne vérifiait que `voteClos`, pas `dateVoteFermeture` → fenêtre de tir tant que la CF n'avait pas tourné (≤15 min). **Fix :** check `now < dateVoteFermeture` ajouté dans la transaction de vote + message d'erreur.

### [P0-14] `setup-groupes.html` exposé en production — `corrige-v2`
Outil de dev servant à lister/créer des groupes, accessible sans auth. **Fix :** ajouté à `ignore` dans [`firebase.json`](firebase.json), ainsi que `js/admin.js` (qui contenait un `ADMIN_CODE` hardcodé).

---

## P1 — Haut (à traiter rapidement)

### [P1-1] Login email sans `syncUserProfile` — `corrige`
Présent dans [`js/auth.js`](js/auth.js) L26-28.

### [P1-2] `isMembre` accepte les `pending` — `corrige`
Vérifie maintenant `statut == 'active'` ([`firestore.rules`](firestore.rules) L18-20).

### [P1-3] Admin ne voit pas les créneaux `programmé` à ouverture passée — `corrige`
Filtre corrigé dans [`admin-groupe.html`](admin-groupe.html) L763-764.

### [P1-4] Match saisi ne ferme pas le créneau hebdo — `corrige` (cas nominal)
Fermeture déclenchée dans [`admin-groupe.html`](admin-groupe.html) L1092-1098.

### [P1-5] Mot de passe oublié — `corrige`
Implémenté dans [`login.html`](login.html) L93-95, L189+.

### [P1-6] `users/` lisible par tout compte authentifié — `a-faire`
Fuite d'emails de toute la base ([`firestore.rules`](firestore.rules) L40-41). Le panel super-admin lit la collection entière ; restreindre à `isOwner || isSuperAdmin` casse cette UI. **Pistes :** Cloud Function callable pour le super admin, ou ajout d'un champ `searchable` opt-in. À discuter.

### [P1-7] `groupes/` lisible par tout authentifié — `a-faire`
Le client cherche `where('code', '==', X)` pour rejoindre un groupe → la lecture publique est nécessaire à cette UX. Atténuer en interdisant les listages massifs via Firestore (impossible côté rules pures) ou en passant par une Cloud Function callable.

### [P1-8] Bulletins de vote nominatifs lisibles par tout membre — `a-faire`
Pas de scrutin secret ([`firestore.rules`](firestore.rules) L124-126). **Fix proposé :** restreindre `read` au propriétaire du vote ; le serveur (CF) calcule les agrégats publics.

### [P1-9] `nbVotes` et `votesParticipes` : valeur arbitraire — `a-faire`
`hasOnly(['nbVotes'])` contraint la clé, pas la valeur. Un membre peut écrire `votesParticipes: 999999`. **Fix proposé :** déléguer ces incréments à des Cloud Functions (`onVoteCreated` peut déjà incrémenter `nbVotes`).

### [P1-10] Super-admin reconnu — `corrige-v2`
Ajout de `isSuperAdmin()` dans les rules, composé en `isAdminGroupe || isSuperAdmin` partout. Le super admin peut désormais administrer n'importe quel groupe.

### [P1-11] Lien "Voir" du super admin redirige vers `profil.html` — `a-faire`
[`super-admin.html`](super-admin.html) L151 pointe vers `groupe.html` mais le super admin n'est pas membre actif → redirigé. **Fix proposé :** exception `isSuperAdmin` dans [`groupe.html`](groupe.html) L177-180.

### [P1-12] Création de groupe : auto-inscription `active` rejetée par les rules — `corrige-v2`
La règle CR1 autorise désormais `statut: 'active'` à la création si `isAdminGroupe(groupeId)` (le doc groupe est créé juste avant dans la même UI).

### [P1-13] Ex-aequo au podium → double or + saut argent — `a-faire`
[`functions/index.js`](functions/index.js) L191-203 — deux 1ers ex-aequo reçoivent `rang: 1`, le 3e reçoit `rang: 3`, donc personne en argent. **Fix proposé :** règle de départage final (alphabétique du nom, ou rang assigné par index séquentiel sans saut).

### [P1-14] Inscriptions acceptées après coup d'envoi — `a-faire`
Aucun check `now < dateMatch` côté client ni rules. **Fix proposé :** check côté client + rule `request.time < resource.data.dateMatch` (complexité ISO string).

### [P1-15] Créneau pas fermé si admin valide sans avoir ouvert l'onglet "Inscriptions" — `a-faire`
`currentOpenMatch` n'est rempli que par `loadInscriptionsAdmin()`. **Fix proposé :** charger `currentOpenMatch` à l'init de la page admin, indépendamment de l'onglet.

### [P1-16] `profilMilieu` jamais transmis au calcul de rating — `a-faire`
[`admin-groupe.html`](admin-groupe.html) L1018 copie `position` mais pas `profilMilieu`. Milieux profilés Offensif/Défensif traités comme génériques.

### [P1-17] Profil "Box-to-box" non géré — `a-faire`
[`js/rating-system.js`](js/rating-system.js) L145-156 — seules les branches Offensif/Défensif existent.

### [P1-18] Gardien non géré dans le rating — `a-faire`
Aucune branche dédiée dans [`js/rating-system.js`](js/rating-system.js). Traité comme un milieu générique.

### [P1-19] Buteurs et CSC jamais utilisés — `a-faire`
[`admin-groupe.html`](admin-groupe.html) L1039 passe `[], []`. ~35% du système de rating est neutralisé. **Fix proposé :** ajouter une saisie buteurs/CSC dans le formulaire match.

### [P1-20] Effectifs impairs → équipes très déséquilibrées — `a-faire`
Snake draft sur somme de ratings, pas moyenne. **Fix proposé :** scorer sur la moyenne, ou aligner les effectifs.

### [P1-21] `validerJoueur` / `refuserJoueur` / `super-admin loadAll` sans try/catch — `a-faire`
Boutons bloqués sur "..." indéfiniment en cas d'erreur. **Fix proposé :** try/catch + reset bouton + message d'erreur inline.

### [P1-22] Désinscription : `deleteDoc` + `updateDoc(increment(-1))` non atomiques — `a-faire`
[`groupe.html`](groupe.html) L472-476. Race avec la CF `onInscriptionDeleted`. **Fix proposé :** déplacer le decrement dans la CF (suppression de l'update côté client).

### [P1-23] Désinscription au dernier moment → surbooking — `a-faire`
Transaction protège un créneau mais part de `confirmedCount` qui peut déjà être faux.

### [P1-24] Stats committées avant le doc match — `a-faire`
[`admin-groupe.html`](admin-groupe.html) L1072-1090 — si `addDoc` échoue après `batch.commit()`, ratings modifiés sans trace match. **Fix proposé :** créer le doc match d'abord (placeholder), commit stats ensuite ; ou tout en transaction unique.

---

## P2 — Moyen

### [P2-1] Admin peut réassigner `adminId` sans restriction — `a-faire`
Lock-out involontaire ou prise de contrôle possible. **Fix proposé :** rule interdisant `adminId` dans `affectedKeys`.

### [P2-2] `users/` update sans whitelist — `a-faire`
Un user peut ajouter `superAdmin: true` à son doc (inoffensif car lu depuis `admins/`, mais pollution).

### [P2-3] Membres `pending` peuvent lire toutes les données du groupe — `a-faire`
[`firestore.rules`](firestore.rules) L62-63, L82-83, L96-97 utilisent `isAuth()` au lieu de `isMembre()`.

### [P2-4] Pas de quota anti-spam — `a-faire`
Création illimitée de groupes / demandes pending. Mitigé par App Check (à activer).

### [P2-5] `closeVotesAndUpdateTrophies` : trophées en batch après transaction — `a-faire`
Si batch échoue, vote clos sans trophées. **Fix proposé :** tout dans la transaction (lecture votes en amont, écriture trophées en aval, idempotent).

### [P2-6] CF sans try/catch — `a-faire`
`onVoteCreated` et `onInscriptionDeleted` propagent les erreurs → retries silencieux.

### [P2-7] Race condition : 2 docs `programmé` pour la même semaine — `a-faire`
Pas d'idempotence dans `processMatchSemaine`. **Fix proposé :** ID déterministe basé sur `dateOuvertureInscription`.

### [P2-8] Index composite manquant pour groupes legacy — `a-faire`
[`functions/index.js`](functions/index.js) L53-54 `where('configHebdo.actif').where('configHebdo.recurring')` requiert un index composite. CF legacy peut crash.

### [P2-9] Schéma incohérent `nom` vs `nomGroupe` — `a-faire`
[`setup-groupes.html`](setup-groupes.html) L126 écrit `nomGroupe`, l'app actuelle lit `nom`. Hors prod après CR9 mais reste à harmoniser si réactivation.

### [P2-10] Validation match sans confirmation — `a-faire`
Action irréversible. **Fix proposé :** modal confirm "Es-tu sûr ? Cette action est définitive."

### [P2-11] Refus d'adhésion sans confirmation — `a-faire`
Suppression accidentelle d'une demande en un clic.

### [P2-12] Vérification d'email absente — `a-faire`
Aucun appel à `sendEmailVerification`. **Fix proposé :** envoyer la vérif après inscription, bandeau "Vérifie ton email" tant que `user.emailVerified === false`.

### [P2-13] Déconnexion absente sur `groupe.html` et `admin-groupe.html` — `a-faire`
Seuls `profil.html` et `super-admin.html` ont le bouton.

### [P2-14] Tableau classement coupé sur mobile — `a-faire`
[`css/groupe.css`](css/groupe.css) L283 : `overflow: hidden` + 8 colonnes. **Fix proposé :** `overflow-x: auto` sur `.table-container`.

### [P2-15] Onglets et modales sans ARIA / focus trap / Escape — `a-faire`
Accessibilité dégradée. `js/confirm-modal.js` implémente Escape mais n'est importé nulle part.

### [P2-16] `loadGroupes` du profil : O(n) sur tous les groupes — `a-faire`
[`profil.html`](profil.html) L293-302 — coûteux et lent à mesure que la base grossit. **Fix proposé :** maintenir un index `users/{uid}.groupesIds` mis à jour à l'adhésion (via CF).

### [P2-17] Stats `butsMarques`, `cleanSheets`, `butsContresonCamp`, `tauxPresence` jamais mises à jour — `a-faire`
Champs initialisés à 0 mais aucun update. Dead code utile à activer quand les buteurs seront saisis (P1-19).

### [P2-18] CSC zéroïse l'offensive même si autre but normal — `a-faire`
[`js/rating-system.js`](js/rating-system.js) L111-112 : un seul flag `csc: true` annule toute contribution offensive de l'entrée. Modèle à raffiner.

### [P2-19] Pas d'App Check ni rate limiting — `a-faire`

### [P2-20] Plusieurs créneaux actifs simultanés possibles — `a-faire`
Créneau manuel + récurrent peuvent coexister ; seul le 1er est affiché côté joueur.

### [P2-21] Fuseau horaire incohérent créneaux manuels — `a-faire`
[`admin-groupe.html`](admin-groupe.html) L930 : `new Date()` interprété en heure locale navigateur, affiché en Asia/Jerusalem.

### [P2-22] `team-balancer.js` non utilisé par l'admin actuel — `a-faire`
[`admin-groupe.html`](admin-groupe.html) réimplémente un snake draft local. Dette technique.

### [P2-23] UI admin affiche `confirmes.length` ≠ `confirmedCount` — `a-faire`
Deux sources de vérité. **Fix proposé :** n'afficher qu'une des deux.

### [P2-24] Promotion waitlist ne revérifie pas `maxJoueurs` côté CF — `a-faire`

---

## P3 — Bas / Dette technique

### [P3-1] Erreurs silencieuses (catch sans feedback) — `a-faire`
Plusieurs `catch { console.error }` sans message UI.

### [P3-2] Submit profil sans try/catch — `corrige`
Présent désormais dans [`profil.html`](profil.html).

### [P3-3] Fallback clipboard pour code groupe — `corrige`

### [P3-4] Champ `date` redondant avec `dateCreation` sur matchs — `a-faire`

### [P3-5] Imports inutilisés — `a-faire`
- `serverTimestamp` dans [`js/firebase-config.js`](js/firebase-config.js) (réexporté, peu utilisé)
- Quelques imports legacy dans les fichiers JS orphelins

### [P3-6] Fichiers JS/CSS orphelins — `a-faire`
Non chargés par aucun HTML actif :
- JS : `js/inscription.js`, `js/app.js`, `js/admin.js`, `js/historique.js`, `js/synergies.js`, `js/algorithm.js`, `js/code-modal.js`, `js/confirm-modal.js`
- CSS : `css/modal.css`, `css/algorithm.css`, `css/synergies.css`, `css/inscription.css`, `css/admin.css`

### [P3-7] [`js/inscription.js`](js/inscription.js) L5 — imports inexistants — `a-faire`

### [P3-8] Constantes mortes `SEUILS.hatTrick`, etc. — `a-faire`

### [P3-9] `snapTo15Min` jamais appelée — `a-faire`

### [P3-10] Paramètre `ratingJoueur` jamais utilisé dans `calculerChangementRating` — `a-faire`

### [P3-11] Pas de plancher absolu sur `impactRating` — `a-faire`
Après N défaites, peut devenir très bas (voire négatif). **Fix proposé :** plancher à 500 ou similaire.

### [P3-12] Aucun favicon, aucune meta description, titre statique — `a-faire`

### [P3-13] Faute d'orthographe : "Complete ton profil" → "Complète" — `a-faire`
[`profil.html`](profil.html) L42.

### [P3-14] Code groupe : pas de filtre alphanumérique — `a-faire`

### [P3-15] Bouton Google non désactivé pendant chargement — `a-faire`

### [P3-16] Message "Vérifie la console (F12)" exposé à l'utilisateur final — `a-faire`

### [P3-17] Champs `userId` (redondant doc ID), `tauxPresence` (jamais MAJ), `dateAjout` vs `dateCreation` (mixed) — `a-faire`

### [P3-18] Pas de `prefers-reduced-motion` sur animations — `a-faire`

### [P3-19] Labels radios équipes admin vides — `a-faire`

### [P3-20] Avatar avec `alt=""` alors qu'informatif — `a-faire`

### [P3-21] Bouton toggle password sans label accessible — `a-faire`

### [P3-22] Pas de CSP front (defense-in-depth contre XSS) — `a-faire`

---

## Tests recommandés (chantier dédié)

Aucun test automatisé dans le projet actuellement. Par ordre de ROI :

1. **Tests `firestore.rules`** via `@firebase/rules-unit-testing` + émulateur. Couvrir CR1–CR4 + CR10 + le super-admin.
2. **Tests unitaires de `js/rating-system.js`** (Vitest/Jest) — fonctions pures, ROI immédiat.
3. **Tests d'intégration Cloud Functions** via émulateurs (`processMatchSemaine`, `closeVotesAndUpdateTrophies`, `onVoteCreated`, `onInscriptionDeleted`).
4. **Tests E2E Playwright** sur les parcours critiques (inscription, création groupe, vote, validation match).
5. **Property-based** sur la génération d'équipes (`fast-check`).
6. **ESLint** avec configuration stricte + migration progressive vers `// @ts-check` ou TypeScript.

---

## Historique

- **v1 (26/05/2026)** — Premier audit (20 issues).
- **v2 (27/05/2026)** — Audit complet (60+ issues), correction des P0 critiques en une passe (CR1–CR10).
