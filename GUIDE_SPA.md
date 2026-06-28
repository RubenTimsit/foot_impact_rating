# Guide complet — Réécriture SPA "Mon Petit Match"

> **Règle d'or :** le backend (Firebase, Firestore, Cloud Functions, règles de sécurité) ne change pas.
> On réécrit uniquement le frontend HTML/CSS/JS.

---

## Table des matières

1. [Contexte et décisions d'architecture](#1-contexte-et-décisions-darchitecture)
2. [Structure de fichiers finale](#2-structure-de-fichiers-finale)
3. [Ce qu'on garde tel quel](#3-ce-quon-garde-tel-quel)
4. [Ce qu'on supprime](#4-ce-quon-supprime)
5. [Fichier app.html — structure de base](#5-fichier-apphtml--structure-de-base)
6. [store.js — état global](#6-storejs--état-global)
7. [db.js — toutes les requêtes Firestore](#7-dbjs--toutes-les-requêtes-firestore)
8. [router.js — routeur SPA](#8-routerjs--routeur-spa)
9. [app.css — layout SPA + bottom nav + transitions](#9-appcss--layout-spa--bottom-nav--transitions)
10. [Vue : home.js — Accueil](#10-vue--homejs--accueil)
11. [Vue : classement.js — Classement](#11-vue--classementjs--classement)
12. [Vue : match.js — Prochain match](#12-vue--matchjs--prochain-match)
13. [Vue : synergies.js — Synergies + Historique](#13-vue--synergiesjs--synergies--historique)
14. [Vue : profil.js — Profil personnel](#14-vue--profiljs--profil-personnel)
15. [Vue : admin.js — Administration groupe](#15-vue--adminjs--administration-groupe)
16. [Mises à jour PWA](#16-mises-à-jour-pwa)
17. [firebase.json — ignorer les anciens fichiers](#17-firebasejson--ignorer-les-anciens-fichiers)
18. [Ordre d'exécution précis](#18-ordre-dexécution-précis)
19. [Checklist de tests avant déploiement](#19-checklist-de-tests-avant-déploiement)
20. [Points d'attention performance](#20-points-dattention-performance)

---

## 1. Contexte et décisions d'architecture

### Pourquoi SPA ?
L'app actuelle est un site multi-pages classique (profil.html, groupe.html, admin-groupe.html). Chaque navigation = rechargement complet de page. Sur mobile, c'est lent et peu fluide. Une SPA permet :
- Navigation instantanée entre onglets
- Données gardées en mémoire (pas de rechargement Firestore à chaque clic)
- Bottom navigation persistante
- Comportement identique à une app native

### Pourquoi Vanilla JS et pas React/Vue ?
- Zéro dépendance npm côté frontend
- Bundle final très léger (< 50 KB total)
- Compatible parfaitement avec Firebase CDN
- Déjà maîtrisé dans le code existant
- Pas de compilation nécessaire

### Pourquoi hash routing (`#/route`) et pas History API ?
Firebase Hosting sert des fichiers statiques. Un rafraîchissement sur `/classement` renvoie une 404 sauf à configurer des rewrites complexes. Avec le hash, tout est géré côté client. Zéro config serveur supplémentaire. Parfait pour une PWA.

### Point d'entrée
- `index.html` — landing publique (non connecté) → **inchangée**
- `login.html` — authentification → **inchangée**
- `app.html` — **nouvelle** SPA pour les utilisateurs connectés

### Navigation
```
Bottom nav fixe (5 onglets + 1 conditionnel admin) :
🏠 Accueil   🏆 Classement   📅 Match   ⚡ Synergies   👤 Profil   [⚙️ Admin]
```

L'onglet Admin n'apparaît que si l'utilisateur est `adminId` du groupe actif.

---

## 2. Structure de fichiers finale

```
foot/
│
├── app.html                        ← SPA point d'entrée (NOUVEAU)
├── index.html                      ← Landing publique (inchangée)
├── login.html                      ← Auth (inchangée)
├── manifest.json                   ← Mettre à jour start_url → /app
├── sw.js                           ← Mettre à jour cache liste
├── firebase.json                   ← Mettre à jour ignore list
│
├── css/
│   ├── app.css                     ← Styles SPA (NOUVEAU)
│   ├── landing.css                 ← (inchangé)
│   └── auth.css                    ← (inchangé)
│
├── js/
│   ├── firebase-config.js          ← (inchangé)
│   ├── auth.js                     ← (inchangé)
│   ├── rating-system.js            ← (inchangé)
│   ├── synergy-system.js           ← (inchangé, enfin utilisé correctement)
│   ├── pwa.js                      ← (inchangé)
│   │
│   ├── store.js                    ← État global réactif (NOUVEAU)
│   ├── db.js                       ← Toutes les requêtes Firestore (NOUVEAU)
│   ├── router.js                   ← Hash router + guards auth (NOUVEAU)
│   │
│   └── views/
│       ├── home.js                 ← Onglet Accueil (NOUVEAU)
│       ├── classement.js           ← Onglet Classement (NOUVEAU)
│       ├── match.js                ← Onglet Match + inscription (NOUVEAU)
│       ├── synergies.js            ← Onglet Synergies + Historique (NOUVEAU)
│       ├── profil.js               ← Onglet Profil perso (NOUVEAU)
│       └── admin.js                ← Onglet Admin groupe (NOUVEAU)
│
└── icons/                          ← (inchangé)
```

### Fichiers à conserver mais plus déployés (garder pour référence)
```
profil.html, groupe.html, admin-groupe.html, super-admin.html
css/profil.css, css/groupe.css
```
Ces fichiers restent dans le repo mais sont ajoutés à l'`ignore` de `firebase.json`.

---

## 3. Ce qu'on garde tel quel

| Fichier | Raison |
|---------|--------|
| `js/firebase-config.js` | Config Firebase + exports Firestore/Auth parfaits |
| `js/auth.js` | Toutes les fonctions (`requireAuth`, `getUserProfile`, etc.) réutilisées directement |
| `js/rating-system.js` | Logique ELO complète, aucun bug |
| `js/synergy-system.js` | Logique synergies — enfin importée et utilisée dans `admin.js` |
| `js/pwa.js` | SW registration + bouton install |
| `functions/index.js` | Backend Cloud Functions inchangé |
| `firestore.rules` | Règles de sécurité inchangées |
| `firestore.indexes.json` | Index Firestore inchangés |
| `index.html` | Landing publique |
| `login.html` | Page d'auth |
| `css/landing.css` | Styles landing |
| `css/auth.css` | Styles auth |
| `icons/` | Icônes PWA |
| `manifest.json` | Juste mettre à jour `start_url` |

---

## 4. Ce qu'on supprime (du déploiement, pas du repo)

Ajouter à l'`ignore` de `firebase.json` :
- `profil.html`
- `groupe.html`
- `admin-groupe.html`
- `super-admin.html`
- `setup-groupes.html`
- `css/profil.css`
- `css/groupe.css`
- `js/admin.js` (s'il existe)
- `js/app.js` (s'il existe)
- `js/synergies.js` (s'il existe)
- `js/team-balancer.js` (s'il existe)
- `GUIDE_*.md`
- `generate-icons.html`

---

## 5. Fichier app.html — structure de base

Structure HTML minimale de la SPA :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Mon Petit Match</title>
  <!-- PWA meta tags (identiques aux autres pages) -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0A0A12">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Mon Petit Match">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <link rel="stylesheet" href="/css/app.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>

  <!-- LOADER INITIAL (pendant vérif auth) -->
  <div id="app-loader">
    <div class="loader-spinner"></div>
  </div>

  <!-- HEADER (nom du groupe actif + sélecteur) -->
  <header id="app-header" class="hidden">
    <div class="header-inner">
      <div class="header-group-selector" id="group-selector">
        <span id="current-group-name">Mon Petit Match</span>
        <span class="selector-arrow">▾</span>
      </div>
      <button id="btn-notifications" class="btn-icon" aria-label="Notifications">🔔</button>
    </div>
  </header>

  <!-- CONTENU PRINCIPAL (les vues s'injectent ici) -->
  <main id="app-main" class="hidden">
    <div id="view-container"></div>
  </main>

  <!-- BOTTOM NAVIGATION -->
  <nav id="bottom-nav" class="hidden">
    <a href="#/" class="nav-item" data-route="/">
      <span class="nav-icon">🏠</span>
      <span class="nav-label">Accueil</span>
    </a>
    <a href="#/classement" class="nav-item" data-route="/classement">
      <span class="nav-icon">🏆</span>
      <span class="nav-label">Classement</span>
    </a>
    <a href="#/match" class="nav-item" data-route="/match">
      <span class="nav-icon">📅</span>
      <span class="nav-label">Match</span>
    </a>
    <a href="#/synergies" class="nav-item" data-route="/synergies">
      <span class="nav-icon">⚡</span>
      <span class="nav-label">Synergies</span>
    </a>
    <a href="#/profil" class="nav-item" data-route="/profil">
      <span class="nav-icon">👤</span>
      <span class="nav-label">Profil</span>
    </a>
    <!-- Onglet admin : affiché dynamiquement via JS si isAdmin -->
    <a href="#/admin" class="nav-item hidden" id="nav-admin" data-route="/admin">
      <span class="nav-icon">⚙️</span>
      <span class="nav-label">Admin</span>
    </a>
  </nav>

  <!-- MODAL SÉLECTEUR DE GROUPE (slide depuis le bas) -->
  <div id="modal-group-picker" class="modal-overlay hidden">
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <h3>Changer de groupe</h3>
      <div id="group-picker-list"></div>
    </div>
  </div>

  <!-- Scripts -->
  <script type="module" src="/js/store.js"></script>
  <script type="module" src="/js/db.js"></script>
  <script type="module" src="/js/router.js"></script>
  <script src="/js/pwa.js"></script>
</body>
</html>
```

**Points importants :**
- `#app-loader` visible par défaut → disparaît une fois auth vérifiée
- `#app-header`, `#app-main`, `#bottom-nav` cachés jusqu'à auth OK
- `#view-container` : les vues y injectent leur HTML
- Le modal group picker est un bottom sheet (slide depuis le bas, comme iOS)

---

## 6. store.js — état global

Le store est le **seul endroit** où vit l'état de l'app. Aucune vue ne fait de requête Firestore directement — elles passent toutes par le store ou `db.js`.

### État complet

```javascript
const state = {
  // Auth
  firebaseUser: null,       // firebase.User
  profil: null,             // users/{uid} : displayName, email, position, profilMilieu, profilComplet

  // Groupes
  mesGroupes: [],           // [{id, nom, code, adminId, maxJoueursMatch, monStatut, monRating, trophees, prochainMatch}]
  groupeActifId: null,      // string | null
  groupeActif: null,        // données complètes du groupe (groupes/{id})

  // Données du groupe actif (cache)
  joueurs: null,            // [] | null (null = pas encore chargé)
  matchSemaine: null,       // objet | null
  monInscription: null,     // 'confirmé'|'attente'|null
  historique: null,         // [] | null (lazy)
  synergies: null,          // [] | null (lazy)
  isAdmin: false,           // l'user est adminId du groupe actif

  // UI
  loading: false,
  currentRoute: '/',
};
```

### Méthodes du store

```javascript
store.get(key)                              // lire une valeur
store.set(key, value)                       // écrire + notifier
store.setGroupeActif(groupeId)              // change groupe + invalide cache
store.invalidateGroupeCache()               // joueurs, matchSemaine, historique, synergies → null
store.subscribe(key, callback)              // écouter un changement
store.subscribeAll(callback)                // écouter tous les changements
```

### Règles d'invalidation du cache

| Action | Ce qui est invalidé |
|--------|---------------------|
| Changement de groupe actif | Tout le cache groupe |
| Inscription/désinscription | `matchSemaine`, `monInscription` |
| Validation match (admin) | `joueurs`, `historique`, `matchSemaine` |
| Valider/refuser membre | `joueurs` |
| Modifier paramètres groupe | `groupeActif` |
| Mise à jour profil | `profil` |

---

## 7. db.js — toutes les requêtes Firestore

**Règle :** aucune requête Firestore dans les vues. Tout passe par `db.js`.

### Fonctions à implémenter

#### Auth / Profil
```javascript
db.getMonProfil(uid)
db.updateMonProfil(uid, data)
db.isSuperAdmin(uid)
```

#### Groupes
```javascript
// Anti N+1 : récupère tous les groupes en une query + batch des joueurs
db.getMesGroupes(uid)

db.creerGroupe(uid, { nom, maxJoueursMatch })
db.rejoindreGroupe(uid, code)                   // cherche par code → setDoc joueur pending
db.getGroupe(groupeId)
```

#### Joueurs (groupe actif)
```javascript
db.getJoueurs(groupeId)                          // tous les joueurs actifs
db.getJoueursAvecStats(groupeId)                 // joueurs + calcul présence depuis matchs
db.validerJoueur(groupeId, userId)
db.refuserJoueur(groupeId, userId)               // deleteDoc
db.expulserJoueur(groupeId, userId)              // deleteDoc
```

#### Match de la semaine
```javascript
db.getProchainMatch(groupeId)                    // matchs_semaine statut ouvert/programmé
db.getMonInscription(groupeId, matchId, uid)
db.sInscrire(groupeId, matchId, uid)             // runTransaction
db.seDesinscrire(groupeId, matchId, uid)         // deleteDoc + decrement
db.getInscriptionsAdmin(groupeId, matchId)       // confirmés + liste d'attente
db.creerCreneauManuel(groupeId, data)
db.creerCreneauHebdo(groupeId, hebdoConfig)
```

#### Match (historique + validation)
```javascript
db.getHistorique(groupeId, limit?)               // matchs statut joue, orderBy date desc
db.validerMatch(groupeId, { matchSemaineId, equipeA, equipeB, scoreA, scoreB })
  // → runTransaction : set match joué + update ratings/stats tous joueurs
  // → appelle synergy-system.js pour calc puis write synergies
  // → update matchs_semaine statut fermé
```

#### Synergies
```javascript
db.getSynergies(groupeId)
// updateSynergies est appelé en interne dans validerMatch via synergy-system.js
```

#### Vote
```javascript
db.getMonVote(groupeId, matchId, uid)
db.soumettrVote(groupeId, matchId, uid, { top1, top2, top3 })  // runTransaction
```

#### Config hebdo (admin)
```javascript
db.addHebdoConfig(groupeId, config)
db.toggleHebdoConfig(groupeId, configId, actif)
db.deleteHebdoConfig(groupeId, configId)
db.updateGroupeSettings(groupeId, { nom, maxJoueursMatch })
```

### Fix anti-N+1 pour getMesGroupes

**Problème actuel :** `getDocs(groupes)` retourne tous les groupes → loop N getDoc.

**Solution dans la SPA :**
```javascript
// Utiliser collectionGroup query sur joueurs
// query(collectionGroup(db, 'joueurs'), where('userId', '==', uid), where('statut', 'in', ['active', 'pending']))
// Puis batch getDocs sur les groupes trouvés
```

Cela passe de N+1 requêtes à 2 requêtes quelque soit le nombre de groupes.

---

## 8. router.js — routeur SPA

### Fonctionnement

```javascript
// Écoute hashchange
window.addEventListener('hashchange', () => router.navigate(location.hash));
window.addEventListener('load', () => router.navigate(location.hash));

// Routes déclarées
const routes = {
  '/'           : () => import('./views/home.js').then(m => m.render),
  '/classement' : () => import('./views/classement.js').then(m => m.render),
  '/match'      : () => import('./views/match.js').then(m => m.render),
  '/synergies'  : () => import('./views/synergies.js').then(m => m.render),
  '/profil'     : () => import('./views/profil.js').then(m => m.render),
  '/admin'      : () => import('./views/admin.js').then(m => m.render),
};
```

### Guards

```javascript
// Avant chaque navigation :
// 1. Vérifier auth → si non connecté : location.href = 'login.html'
// 2. Si route '/admin' → vérifier store.get('isAdmin')
//    Si pas admin : navigate('/')
// 3. Si routes groupe (classement/match/synergies/admin) sans groupe actif :
//    navigate('/') avec message "Sélectionne un groupe"
```

### Transitions entre vues

```javascript
// 1. Fade out view actuelle (150ms)
// 2. Injecter nouvelle vue dans #view-container
// 3. Fade in (150ms)
// Utiliser CSS classes 'view-exit' / 'view-enter'
```

### Dynamic imports (lazy loading)

Chaque vue est importée dynamiquement (`import()`) au premier accès. Le JS de chaque vue n'est téléchargé que quand on visite cet onglet. Meilleure performance au premier chargement.

### Mettre à jour la bottom nav

Après chaque navigation, mettre à jour la classe `active` sur le bon `.nav-item`.

---

## 9. app.css — layout SPA + bottom nav + transitions

### Variables (reprendre celles de groupe.css)

```css
:root {
  --green: #2ecc71;
  --green-dark: #27ae60;
  --dark: #0d1117;
  --dark-2: #161b22;
  --dark-3: #21262d;
  --light: #f0f6fc;
  --text-muted: #8b949e;
  --border: rgba(255,255,255,0.1);
  --danger: #f85149;
  --warning: #f0883e;
  --radius: 12px;
  --transition: all 0.2s ease;

  /* Bottom nav height + safe area */
  --bottom-nav-height: 60px;
  --header-height: 52px;
}
```

### Layout

```css
body {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  overflow: hidden; /* pas de scroll body */
}

#app-main {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* Espace pour header en haut et bottom nav en bas */
  padding-top: var(--header-height);
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
}

#view-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 1rem 1rem;
  min-height: 100%;
}
```

### Header

```css
#app-header {
  position: fixed;
  top: 0;
  left: 0; right: 0;
  height: var(--header-height);
  padding-top: env(safe-area-inset-top);
  background: var(--dark-2);
  border-bottom: 1px solid var(--border);
  z-index: 100;
}
```

### Bottom navigation

```css
#bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0; right: 0;
  background: var(--dark-2);
  border-top: 1px solid var(--border);
  display: flex;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
  backdrop-filter: blur(12px);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  gap: 3px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s;
  min-height: var(--bottom-nav-height);
}

.nav-item.active {
  color: var(--green);
}

.nav-icon { font-size: 1.35rem; line-height: 1; }
.nav-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.02em; }

/* Badge count sur onglet Admin */
.nav-item .nav-badge {
  position: absolute;
  top: 6px;
  right: calc(50% - 18px);
  background: var(--warning);
  color: #000;
  border-radius: 50%;
  width: 16px; height: 16px;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
```

### Transitions entre vues

```css
#view-container {
  transition: opacity 0.15s ease;
}

#view-container.view-exit { opacity: 0; }
#view-container.view-enter { opacity: 1; }
```

### Bottom sheet (modal groupe picker)

```css
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 300;
  display: flex; align-items: flex-end;
}

.modal-sheet {
  width: 100%;
  background: var(--dark-2);
  border-radius: 20px 20px 0 0;
  padding: 1rem 1.25rem;
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  max-height: 80dvh;
  overflow-y: auto;
  /* Slide depuis le bas */
  animation: slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.sheet-handle {
  width: 36px; height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin: 0 auto 1rem;
}
```

### Skeleton loader

```css
.skeleton {
  background: linear-gradient(90deg, var(--dark-3) 25%, var(--dark-2) 50%, var(--dark-3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Inputs (anti-zoom iOS)

```css
input, select, textarea {
  font-size: 1rem; /* critique : empêche le zoom auto iOS sur focus */
}
```

---

## 10. Vue : home.js — Accueil

### Responsabilité
Afficher tous les groupes de l'utilisateur avec un aperçu de chaque groupe. C'est la page "hub" depuis laquelle on choisit son groupe actif.

### Ce qu'elle affiche
- Titre "Mes groupes" + bouton "+"
- Pour chaque groupe : card avec nom, code, badge admin, prochain match, statut inscription, rating du joueur
- État "aucun groupe" avec boutons créer/rejoindre
- Bouton flottant "Rejoindre ou créer un groupe"

### Interactions
- Tap sur une card de groupe → `store.setGroupeActif(id)` + navigate `/classement`
- Bouton "Créer un groupe" → bottom sheet formulaire
- Bouton "Rejoindre" → bottom sheet input code

### Données utilisées
```javascript
// store.get('mesGroupes')   → liste groupes (chargé au boot)
// store.get('profil')       → pour savoir si profil complet
```

### Optimisation anti-N+1
Dans `db.getMesGroupes(uid)` utiliser `collectionGroup('joueurs')` pour récupérer tous les groupes de l'user en 2 requêtes au lieu de N+1.

---

## 11. Vue : classement.js — Classement

### Responsabilité
Afficher le classement des joueurs du groupe actif avec filtres par position.

### Ce qu'elle affiche
- Header : nom du groupe + code (copiable)
- Filtres position : Tous / Gardien / Défenseur / Milieu / Attaquant
- Tableau classement : Rang, Joueur (+ trophées), Position, Rating, Matchs, V-N-D, Présence
- Ma ligne en surbrillance (vert)

### Données utilisées
```javascript
// store.get('joueurs')  → cache invalidé si null → appel db.getJoueursAvecStats()
// store.get('profil')   → pour identifier "ma ligne"
```

### Lazy onSnapshot
Ici pas besoin de temps réel — le classement change après validation d'un match (action admin). On recharge les joueurs uniquement à l'invalidation du cache.

---

## 12. Vue : match.js — Prochain match

### Responsabilité
Afficher le prochain match de la semaine et permettre l'inscription/désinscription.

### Ce qu'elle affiche

**Cas 1 : Aucun match programmé**
- Message "Pas de match cette semaine"
- Si admin : bouton "Créer un créneau" (mini-form inline)

**Cas 2 : Match programmé (pas encore ouvert)**
- Compte à rebours jusqu'à l'ouverture
- Date + heure

**Cas 3 : Match ouvert**
- Date / heure / places restantes (barre de progression)
- Bouton "M'inscrire" ou "Me désinscrire" selon état
- Badge statut : ✅ Confirmé / ⏳ Liste d'attente
- Liste des inscrits (anonymisée si pas inscrit ?)

**Cas 4 : Match joué + vote ouvert**
- Résultat du match
- Section vote Man of the Match (si pas encore voté et était présent)

### onSnapshot ici !
Les inscriptions changent en temps réel (plusieurs users simultanément). Utiliser `onSnapshot` sur `matchs_semaine/{id}` pour mettre à jour le compteur de places en direct.

### Données utilisées
```javascript
// store.get('matchSemaine')   → cache
// store.get('monInscription') → 'confirmé' | 'attente' | null
// db.sInscrire() / db.seDesinscrire()
// db.soumettrVote()
```

---

## 13. Vue : synergies.js — Synergies + Historique

### Responsabilité
Deux sous-onglets dans cette vue : Synergies et Historique.

### Synergies
- Top synergies (paires avec le plus de matchs ensemble + meilleur ratio)
- Pires synergies
- Filtres : Meilleures / Pires / Miennes (synergies impliquant l'user connecté)

### Historique
- Liste des matchs joués (scoreA - scoreB, équipes, date)
- Détail dépliable par match : ratings changements, podium vote
- Pagination ou infinite scroll (charger 10 puis "voir plus")

### Données utilisées
```javascript
// store.get('synergies')  → lazy, null si pas encore chargé
// store.get('historique') → lazy, null si pas encore chargé
// db.getSynergies() / db.getHistorique()
```

---

## 14. Vue : profil.js — Profil personnel

### Responsabilité
Toutes les infos personnelles de l'utilisateur, indépendamment d'un groupe.

### Ce qu'elle affiche
- Avatar + nom + email
- Formulaire modification (prénom, position, profil milieu)
- Stats globales toutes groupes confondus (calculées côté client depuis `mesGroupes`)
- Trophées par groupe (listés par groupe)
- Bouton déconnexion

### Données utilisées
```javascript
// store.get('profil')
// store.get('mesGroupes')  → pour les stats + trophées
// db.updateMonProfil()
// auth.deconnecter()
```

---

## 15. Vue : admin.js — Administration groupe

### Responsabilité
Visible uniquement si `store.get('isAdmin') === true`. Reprend toute la logique de `admin-groupe.html`.

### 4 sous-onglets internes (scroll horizontal dans la vue, pas dans la bottom nav)

**Onglet 1 : En attente**
- Liste des joueurs en attente d'approbation
- onSnapshot ici ! Les nouvelles demandes arrivent en temps réel
- Boutons Valider / Refuser
- Badge de compteur dans l'onglet bottom nav Admin si pending > 0

**Onglet 2 : Membres**
- Liste des membres actifs avec rating, position
- Bouton expulser (confirmation bottom sheet)

**Onglet 3 : Match**
- Sous-onglets : Inscriptions / Enregistrer un match
- Inscriptions : liste des confirmés / liste d'attente / bouton générer équipes
- Enregistrer : tableau assignation équipes + scores + bouton valider
- À la validation : appelle `db.validerMatch()` qui utilise `rating-system.js` + `synergy-system.js`

**Onglet 4 : Paramètres**
- Modifier nom du groupe, max joueurs
- Gestion créneaux hebdomadaires (CRUD)
- Code d'invitation (avec bouton copier)

### Correction importante : synergy-system.js
Dans `admin-groupe.html` actuel, la logique synergies est dupliquée inline. Dans la SPA, `admin.js` importe `synergy-system.js` directement et appelle `mettreAJourSynergiesEquipe()`.

### Données utilisées
```javascript
// store.get('joueurs')
// db.validerJoueur() / db.refuserJoueur() / db.expulserJoueur()
// db.getInscriptionsAdmin()
// db.validerMatch()  ← transaction Firestore complète
// db.addHebdoConfig() / db.toggleHebdoConfig() / db.deleteHebdoConfig()
// db.updateGroupeSettings()
// rating-system.js → calculerChangementsMatch()
// synergy-system.js → mettreAJourSynergiesEquipe()
```

---

## 16. Mises à jour PWA

### manifest.json
```json
{
  "start_url": "/app",
  ...
}
```

### sw.js — mettre à jour les fichiers en cache
```javascript
const STATIC_ASSETS = [
  '/css/app.css',
  '/css/landing.css',
  '/css/auth.css',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/rating-system.js',
  '/js/synergy-system.js',
  '/js/store.js',
  '/js/db.js',
  '/js/router.js',
  '/js/pwa.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

const APP_PAGES = [
  '/',
  '/index.html',
  '/login',
  '/login.html',
  '/app',
  '/app.html',
];
```

### Incrémenter CACHE_VERSION
Changer `const CACHE_VERSION = 'v3'` pour invalider l'ancien cache.

---

## 17. firebase.json — ignorer les anciens fichiers

Ajouter à la liste `ignore` :
```json
"profil.html",
"groupe.html",
"admin-groupe.html",
"super-admin.html",
"setup-groupes.html",
"css/profil.css",
"css/groupe.css",
"GUIDE_*.md",
"ISSUES.md",
"generate-icons.html",
"js/admin.js",
"js/app.js",
"mobile/**",
"tests/**"
```

---

## 18. Ordre d'exécution précis

```
Étape 1  → app.css (layout, bottom nav, transitions, skeleton, bottom sheet)
Étape 2  → store.js (état global + subscribe)
Étape 3  → db.js (toutes les requêtes Firestore)
Étape 4  → router.js (hash routing + guards + transitions)
Étape 5  → app.html (structure HTML + intégrer tous les scripts)
Étape 6  → views/home.js (accueil + créer/rejoindre groupe)
Étape 7  → views/profil.js (profil perso + stats + trophées)
Étape 8  → views/classement.js (classement + filtres)
Étape 9  → views/match.js (prochain match + inscription + vote)
Étape 10 → views/synergies.js (synergies + historique)
Étape 11 → views/admin.js (admin complet — 4 sous-onglets)
Étape 12 → manifest.json (start_url → /app)
Étape 13 → sw.js (mise à jour cache + CACHE_VERSION v3)
Étape 14 → firebase.json (ignore list)
Étape 15 → Tests complets (voir checklist ci-dessous)
```

---

## 19. Checklist de tests avant déploiement

### Auth
- [ ] Utilisateur non connecté → redirigé vers `login.html`
- [ ] Connexion Google fonctionne → redirect vers `app.html#/`
- [ ] Connexion email/mdp fonctionne
- [ ] Déconnexion → redirect vers `index.html`
- [ ] Refresh page → auth persistée, pas de flash de redirect

### Navigation
- [ ] Bottom nav active le bon onglet selon la route
- [ ] Transition fade fonctionne entre onglets
- [ ] Bouton retour navigateur fonctionne (hashchange)
- [ ] Deep link (ex: `app.html#/classement`) fonctionne après login
- [ ] Onglet Admin invisible si pas admin
- [ ] Onglet Admin visible si admin du groupe actif

### Accueil
- [ ] Liste des groupes affichée correctement
- [ ] Card groupe avec prochaine info match
- [ ] Créer un groupe fonctionne
- [ ] Rejoindre par code fonctionne (code invalide → erreur claire)
- [ ] Profil incomplet → message pour compléter avant de rejoindre
- [ ] Changement de groupe actif → cache invalidé → classement mis à jour

### Classement
- [ ] Affichage correct du classement
- [ ] Filtres position fonctionnent
- [ ] Ma ligne en surbrillance verte
- [ ] Code groupe copiable (clipboard)

### Match
- [ ] Compte à rebours si match pas encore ouvert
- [ ] Inscription fonctionne (confirmé / liste d'attente)
- [ ] Désinscription fonctionne
- [ ] Liste inscrits visible en temps réel (onSnapshot)
- [ ] Vote Man of the Match (si présent + vote ouvert)
- [ ] Bouton créneau manuel visible uniquement si admin

### Synergies + Historique
- [ ] Synergies affichées (filtres Meilleures/Pires/Miennes)
- [ ] Historique affiché (10 derniers matchs)
- [ ] Chargement lazy (pas rechargé à chaque navigation)

### Profil
- [ ] Infos affichées correctement
- [ ] Modification prénom/position sauvegardée
- [ ] Trophées affichés par groupe
- [ ] Déconnexion fonctionne

### Admin
- [ ] Badge compteur si joueurs en attente
- [ ] onSnapshot sur pending → mise à jour en temps réel
- [ ] Valider / Refuser membre fonctionne
- [ ] Expulsion avec confirmation
- [ ] Génération équipes affichée
- [ ] Validation match : ratings mis à jour dans Firestore
- [ ] Synergies mises à jour après validation match
- [ ] CRUD créneaux hebdomadaires
- [ ] Modifier nom/max joueurs

### PWA
- [ ] `start_url: /app` → s'ouvre sur l'app et pas la landing
- [ ] Service Worker cache `app.html` et `app.css`
- [ ] Mode offline → page app accessible (pas de Firestore mais UI visible)

### Mobile
- [ ] iPhone : pas de contenu sous le notch (safe area top)
- [ ] iPhone : pas de contenu sous le home indicator (safe area bottom)
- [ ] Android : bottom nav au-dessus de la barre de navigation système
- [ ] Inputs : pas de zoom auto iOS au focus
- [ ] Scroll fluide dans les vues
- [ ] Bottom sheet groupe picker fonctionne (swipe to dismiss ?)

---

## 20. Points d'attention performance

| Sujet | Solution |
|-------|----------|
| **Premier chargement** | Dynamic imports des vues (JS chargé seulement au 1er accès) |
| **Firestore reads** | Cache store — données rechargées seulement si `null` ou invalidées |
| **Temps réel ciblé** | `onSnapshot` uniquement sur inscriptions (match.js) et pending (admin.js) |
| **Anti-N+1** | `collectionGroup('joueurs')` pour getMesGroupes |
| **Images** | `loading="lazy"` sur avatars + `object-fit: cover` |
| **Fonts** | `font-display: swap` + preconnect Google Fonts (déjà en place) |
| **Transitions** | CSS opacity uniquement (GPU composited — pas de layout recalcul) |
| **Scroll** | `-webkit-overflow-scrolling: touch` sur `#app-main` |
| **Bundle size** | Zéro framework JS — bundle estimé < 50 KB |
| **Service Worker** | Cache v3 — assets statiques servis offline |
| **100dvh** | Unité correcte pour éviter le bug barre d'adresse mobile |
| **Anti-zoom iOS** | `font-size: 1rem` sur tous les inputs/selects |

---

## Récapitulatif des fichiers touchés

| Fichier | Action |
|---------|--------|
| `app.html` | Créer |
| `css/app.css` | Créer |
| `js/store.js` | Créer |
| `js/db.js` | Créer |
| `js/router.js` | Créer |
| `js/views/home.js` | Créer |
| `js/views/classement.js` | Créer |
| `js/views/match.js` | Créer |
| `js/views/synergies.js` | Créer |
| `js/views/profil.js` | Créer |
| `js/views/admin.js` | Créer |
| `manifest.json` | Modifier (`start_url`) |
| `sw.js` | Modifier (cache list + version) |
| `firebase.json` | Modifier (ignore list) |
| `js/firebase-config.js` | Inchangé |
| `js/auth.js` | Inchangé |
| `js/rating-system.js` | Inchangé |
| `js/synergy-system.js` | Inchangé |
| `js/pwa.js` | Inchangé |
| `index.html` | Inchangé |
| `login.html` | Inchangé |
