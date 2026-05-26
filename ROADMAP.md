# ROADMAP — Refonte complète du projet foot

## Vision
Application web multi-utilisateurs pour gérer des groupes de foot entre amis.
Chaque joueur a un vrai compte, peut rejoindre/créer des groupes, s'inscrire aux matchs hebdo.

---

## Stack technique
- **Frontend** : HTML / CSS / JS vanilla
- **Backend** : Firebase (Auth + Firestore)
- **Auth** : Google OAuth + email/mot de passe classique
- **Hosting** : Firebase Hosting (migration depuis GitHub Pages)
- **Dépôt** : GitHub privé

---

## Rôles utilisateurs

| Rôle | Détection | Accès |
|------|-----------|-------|
| **Super admin** | UID Google de Ruben stocké en dur dans le code (silencieux) | Tout — redirigé automatiquement vers `super-admin.html` à la connexion |
| **Admin de groupe** | `adminId` dans le doc Firestore du groupe | Gestion du groupe, validation joueurs, création matchs hebdo, génération équipes |
| **Joueur** | Tout compte Firebase Auth | Profil, rejoindre des groupes, s'inscrire aux matchs hebdo |

> Le statut super admin est invisible pour les autres utilisateurs.
> À la connexion, si `user.uid === SUPER_ADMIN_UID` → redirect vers `super-admin.html`.

---

## Structure Firestore

```
users/{userId}
  - displayName       (string)
  - email             (string)
  - photoURL          (string|null)
  - position          (string: 'Gardien'|'Défenseur'|'Milieu'|'Attaquant')
  - profilMilieu      (string|null : 'Défensif'|'Box-to-box'|'Offensif')
  - dateInscription   (timestamp)
  - profilComplet     (boolean)

groupes/{groupeId}
  - nom               (string)
  - code              (string, 6 lettres majuscules, unique)
  - adminId           (string, userId du créateur)
  - maxJoueursMatch   (number)
  - dateCreation      (timestamp)
  - actif             (boolean)

  joueurs/{userId}                  ← sous-collection, membres du groupe
    - userId          (string)
    - displayName     (string, copie depuis users/)
    - position        (string)
    - profilMilieu    (string|null)
    - statut          (string: 'pending'|'active')
    - impactRating    (number, défaut 1000)
    - matchsJoues     (number)
    - victoires       (number)
    - nuls            (number)
    - defaites        (number)
    - dateAjout       (timestamp)

  matchs/{matchId}
    - date            (timestamp)
    - equipeA         (array of userId)
    - equipeB         (array of userId)
    - scoreA          (number)
    - scoreB          (number)
    - statut          (string: 'planifie'|'joue'|'annule')
    - hommeDuMatch    (string|null, userId — Phase 5)
    - dateCreation    (timestamp)

  synergies/{pairId}
    - joueur1Id       (string, userId)
    - joueur2Id       (string, userId)
    - matchsEnsemble  (number)
    - victoires       (number)
    - nuls            (number)
    - defaites        (number)
    - score           (number)

  matchs_semaine/{weekId}           ← inscription hebdo
    - date            (string, ex: '2026-05-02')
    - heure           (string, ex: '19:00')
    - maxJoueurs      (number)
    - statut          (string: 'ouvert'|'ferme'|'annule')
    - dateCreation    (timestamp)
    - inscrits        (array of {userId, displayName, position, dateInscription})
    - listeAttente    (array of {userId, displayName, position, dateInscription})
```

---

## Pages

| Page | Fichier | Statut | Description |
|------|---------|--------|-------------|
| Landing | `index.html` | À créer | Présentation du projet, bouton connexion |
| Login / Register | `login.html` | À créer | Google OAuth + email/mdp via Firebase Auth |
| Profil joueur | `profil.html` | À créer | Compléter son profil, voir ses groupes, rejoindre/créer un groupe |
| Vue groupe | `groupe.html` | Refonte | Classement, historique matchs, synergies, inscription hebdo |
| Admin groupe | `admin-groupe.html` | Refonte | Valider joueurs, créer matchs hebdo, saisir résultats, générer équipes |
| Super admin | `super-admin.html` | À créer | Vue globale tous les groupes, tous les users (accès silencieux) |
| Inscription hebdo | `inscription-hebdo.html` | À créer | Le joueur s'inscrit au prochain match de son groupe |

### Pages à supprimer / archiver
- `admin-login.html` → remplacé par `admin-groupe.html`
- `inscription.html` + `js/inscription.js` → remplacé par le flow d'auth
- `setup-groupes.html` → plus nécessaire
- `algorithm.html` → à conserver ou intégrer dans le profil/groupe

---

## Ce qu'on supprime
- Système de buts (faussait les matchs, tout le monde voulait marquer)
- Mot de passe hardcodé `"foot2026"` pour l'admin
- Accès par code sans authentification (remplacé par Firebase Auth)

---

## Phases de développement

### Phase 1 — Socle Auth ← COMMENCER ICI
- [ ] Landing page (`index.html`) — présentation, bouton "Se connecter"
- [ ] Page login (`login.html`) — Google OAuth + email/mdp
- [ ] Création profil (`profil.html`) — à la première connexion, compléter nom/position
- [ ] Dashboard personnel — liste de ses groupes, boutons rejoindre/créer
- [ ] Détection super admin — si UID === SUPER_ADMIN_UID → redirect `super-admin.html`
- [ ] `js/auth.js` — gestion session Firebase Auth, onAuthStateChanged, guards

### Phase 2 — Groupes
- [ ] Créer un groupe — génère code unique 6 lettres, crée doc Firestore, userId = adminId
- [ ] Rejoindre un groupe — saisir code 6 lettres → statut 'pending' → l'admin valide
- [ ] Notification admin (in-app) — badge "X joueurs en attente de validation"
- [ ] Vue groupe (`groupe.html`) — classement Impact Rating, stats, navigation onglets
- [ ] Page admin groupe (`admin-groupe.html`) — valider joueurs, voir membres

### Phase 3 — Matchs et stats
- [ ] Saisir un match — équipes (liste de userIds), score, date (sans système de buts)
- [ ] Calcul Impact Rating — adapter `rating-system.js` pour utiliser les userIds Firebase
- [ ] Calcul synergies — adapter `synergy-system.js`
- [ ] Historique matchs — cards avec équipes, score, delta rating
- [ ] Classement — Impact Rating, V/N/D, matchs joués

### Phase 4 — Inscription hebdo
- [ ] L'admin crée un créneau (date, heure, maxJoueurs)
- [ ] Les joueurs voient le prochain match et peuvent s'inscrire
- [ ] Logique X premiers inscrits → confirmés, reste → liste d'attente
- [ ] Annulation joueur → premier de la liste d'attente promu automatiquement
- [ ] L'admin voit la liste des inscrits confirmés → génère les équipes
- [ ] Indicateur "tu es inscrit / en attente / pas inscrit" sur le profil

### Phase 5 — Plus tard
- [ ] Vote homme du match — après chaque match, chaque joueur vote (1 vote, pas pour soi)
- [ ] Génération d'équipes via IA (API externe) basée sur Impact Rating + synergies + positions
- [ ] Notifications (email ou push) pour convocation, résultats, liste d'attente promu
- [ ] Stats avancées par joueur — graphe d'évolution du rating, streak, etc.

---

## Décisions techniques importantes

1. **Rejoindre un groupe** : code 6 lettres → statut `pending` → admin valide manuellement
2. **Création de groupe** : tout le monde peut créer un groupe, il en devient l'admin
3. **Inscription hebdo** : X premiers inscrits = confirmés, liste d'attente automatique, annulation = promotion automatique
4. **Génération d'équipes** : depuis la liste des inscrits confirmés (Phase 4), IA en Phase 5
5. **Super admin** : UID hardcodé côté client (valeur à renseigner après 1ère connexion), redirect silencieux
6. **Migration données** : on repart de zéro, les anciennes données Firestore ne sont pas migrées

---

## Notes Firebase

- Activer dans la console Firebase :
  - Authentication → Google provider ✓
  - Authentication → Email/Password provider ✓
  - Firestore Database ✓
- Mettre à jour `firestore.rules` pour les nouveaux rôles
- `firebase-config.js` : ajouter l'UID super admin une fois récupéré après 1ère connexion

---

## Hosting — Firebase Hosting (migration depuis GitHub Pages)

**Pourquoi Firebase Hosting :**
- Déjà dans l'écosystème Firebase (même console, même projet)
- Gratuit (Spark plan) pour notre usage
- CDN mondial, rapide
- Dépôt GitHub peut être privé (le code JS est toujours visible dans le navigateur de toute façon)
- Déploiement : `firebase deploy`

**Mise en place (une seule fois) :**
1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init hosting` (dans le dossier du projet)
4. `firebase deploy`

---

## À faire avant de coder

- [ ] Récupérer l'UID Google de Ruben (se connecter une 1ère fois, le noter, le mettre dans le code)
- [ ] Activer Google Auth dans la console Firebase si pas déjà fait
- [ ] Supprimer les domaines GitHub Pages des Authorized domains Firebase, ajouter le domaine Firebase Hosting
- [ ] Passer le dépôt GitHub en privé
- [ ] Installer Firebase CLI et configurer Firebase Hosting (`firebase init hosting`)
