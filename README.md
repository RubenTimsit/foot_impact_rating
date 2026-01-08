# ⚽ Impact Rating - Système de gestion d'équipes de foot

Un système intelligent pour créer des équipes équilibrées et suivre la performance des joueurs.

## 📚 Documentation

- ⚡ **[Démarrage Rapide](QUICKSTART.md)** - Setup en 5 minutes ! 🚀
- 🔥 **[Configuration Firebase](FIREBASE_SETUP.md)** - Guide détaillé pour configurer Firebase
- 🔄 **[Migration Nouvelle Structure](MIGRATION_NOUVELLE_STRUCTURE.md)** - Structure hiérarchique avec sous-collections
- 🚀 **[Déploiement GitHub Pages](DEPLOIEMENT_GITHUB_PAGES.md)** - Héberger ton site gratuitement
- 🔐 **[firestore.rules](firestore.rules)** - Règles de sécurité Firestore à copier-coller

## 🌟 Fonctionnalités

- **Impact Rating** : Système ELO pour évaluer chaque joueur
- **Synergies** : Détection automatique des meilleures combinaisons de joueurs
- **Trios & Groupes** : Identifie les groupes de joueurs qui jouent bien ensemble
- **Équilibrage intelligent** : Algorithme pour créer des équipes équilibrées
- **Historique** : Suivi de tous les matchs avec changements de rating
- **Transparence** : Explication détaillée des algorithmes

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre-username/foot-rating.git
cd foot-rating
```

### 2. Configuration Firebase

#### Étape 1 : Créer un projet Firebase

1. Va sur [Firebase Console](https://console.firebase.google.com/)
2. Clique sur "Ajouter un projet"
3. Nomme ton projet (par exemple "Impact Rating")
4. Désactive Google Analytics (optionnel pour ce projet)
5. Clique sur "Créer le projet"

#### Étape 2 : Créer une application Web

1. Dans ton projet Firebase, clique sur l'icône **</>** (Web)
2. Donne un nom à ton app (par exemple "Impact Rating Web")
3. NE coche PAS "Firebase Hosting" pour l'instant
4. Clique sur "Enregistrer l'application"
5. **Copie les informations de configuration** qui s'affichent

#### Étape 3 : Configurer Firestore

1. Dans le menu de gauche, clique sur "Firestore Database"
2. Clique sur "Créer une base de données"
3. Choisis **"Démarrer en mode test"** (pour commencer)
4. Choisis la région la plus proche (par exemple "europe-west")
5. Clique sur "Activer"

⚠️ **Important : Règles de sécurité Firestore**

Par défaut, le mode test expire après 30 jours. Pour une utilisation à long terme, va dans l'onglet "Règles" et remplace par :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lecture publique, écriture réservée (tu gères l'auth côté client)
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null || true; // À sécuriser plus tard
    }
  }
}
```

#### Étape 4 : Mettre à jour la configuration

Ouvre le fichier `js/firebase-config.js` et remplace les valeurs par celles de ton projet Firebase :

```javascript
const firebaseConfig = {
    apiKey: "TA_CLÉ_API",
    authDomain: "TON_PROJECT_ID.firebaseapp.com",
    projectId: "TON_PROJECT_ID",
    storageBucket: "TON_PROJECT_ID.appspot.com",
    messagingSenderId: "TON_SENDER_ID",
    appId: "TON_APP_ID"
};
```

### 3. Déploiement sur GitHub Pages

#### Option A : Déploiement simple

1. Crée un repository sur GitHub
2. Pousse ton code :

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/TON_REPO.git
git push -u origin main
```

3. Va dans les **Settings** de ton repo → **Pages**
4. Source : Sélectionne la branche `main` et le dossier `/root`
5. Clique sur **Save**
6. Ton site sera accessible à : `https://TON_USERNAME.github.io/TON_REPO/`

#### Option B : Déploiement sur Firebase Hosting (Recommandé)

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter
firebase login

# Initialiser Firebase
firebase init

# Sélectionner :
# - Hosting
# - Utiliser le projet existant
# - Public directory: . (dossier actuel)
# - Single-page app: No
# - Ne pas écraser les fichiers existants

# Déployer
firebase deploy
```

Ton site sera accessible sur : `https://TON_PROJECT_ID.firebaseapp.com`

## 🔐 Configuration Admin

Le code admin par défaut est : **`foot2026`**

⚠️ **Important** : Change ce code dans le fichier `js/admin.js` ligne 8 :

```javascript
const ADMIN_CODE = "ton_code_securise_ici";
```

## 📱 Utilisation

### Pour les Nouveaux Joueurs

1. **S'inscrire** : Va sur la page "S'inscrire" et remplis le formulaire
2. Tu commences avec un rating de 1000 points
3. L'admin t'ajoutera aux prochains matchs

### Pour Tous les Joueurs

1. **Dashboard** : Voir le classement et les stats de tous
2. **Synergies** : Découvrir les meilleures combinaisons
3. **Historique** : Revoir tous les matchs passés
4. **Algorithme** : Comprendre comment fonctionne le système

### Pour l'Admin (Ruben)

1. Va sur la page **Admin**
2. Entre ton code admin
3. **Nouveau Match** : Enregistre les résultats après chaque match
4. **Créer Équipes** : Génère des équipes équilibrées avant un match
5. **Gérer Joueurs** : Supprime des joueurs si besoin (l'ajout se fait via la page publique)

## 🎯 Comment ça marche ?

### Impact Rating

Chaque joueur commence à **1000 points**. Après chaque match :

- **Victoire** : +8 à +25 points (selon la force de l'adversaire)
- **Match nul** : -5 à +5 points
- **Défaite** : -25 à -8 points

Plus tu gagnes contre des équipes fortes, plus tu gagnes de points !

### Synergies

Pour chaque paire de joueurs dans la même équipe :
- Victoire : +1 de synergie
- Défaite : -1 de synergie

Après plusieurs matchs, on détecte les meilleures combinaisons !

### Algorithme d'Équilibrage

L'algorithme teste des milliers de combinaisons et trouve celles qui :
1. Ont des ratings moyens similaires
2. Ont des synergies équilibrées
3. Ont une bonne répartition des positions

## 🚀 Déploiement sur GitHub Pages

### Méthode Rapide

1. **Crée un repo GitHub** et pousse ton code :
   ```bash
   git init
   git add .
   git commit -m "🚀 Initial commit"
   git remote add origin https://github.com/TON_USERNAME/foot-impact-rating.git
   git push -u origin main
   ```

2. **Active GitHub Pages** :
   - Va dans Settings → Pages
   - Branch: `main`, Folder: `/ (root)`
   - Save

3. **Configure Firebase** :
   - Ajoute ton domaine GitHub Pages dans Firebase Authentication
   - Copie les règles de sécurité depuis `firestore.rules`

4. **Déploiements futurs** :
   ```bash
   # Sur Windows
   deploy.bat
   
   # Sur Mac/Linux
   ./deploy.sh
   ```

📖 **Guide complet** : [DEPLOIEMENT_GITHUB_PAGES.md](DEPLOIEMENT_GITHUB_PAGES.md)

## 🛠️ Technologies utilisées

- **Frontend** : HTML5, CSS3, JavaScript (Vanilla ES6+)
- **Base de données** : Firebase Firestore (structure hiérarchique)
- **Hébergement** : GitHub Pages (gratuit et illimité)
- **Design** : CSS moderne avec variables, animations, responsive

## 📊 Structure des données

### Structure Firestore Hiérarchique

```
groupes/ (collection)
  └── {groupeId}/ (document)
      ├── code: "ROSLAN"
      ├── nomGroupe: "Roslan FC"
      ├── dateCreation: timestamp
      ├── actif: true
      │
      ├── joueurs/ (sous-collection)
      │   └── {joueurId}/ (document)
      │       ├── nom: string
      │       ├── impactRating: number
      │       ├── positionPrincipale: string
      │       ├── matchsJoues: number
      │       ├── victoires: number
      │       ├── nuls: number
      │       └── defaites: number
      │
      ├── matchs/ (sous-collection)
      │   └── {matchId}/ (document)
      │       ├── date: string
      │       ├── equipe1: object
      │       ├── equipe2: object
      │       └── ratingChanges: object
      │
      └── synergies/ (sous-collection)
          └── {synergieId}/ (document)
              ├── joueur1: string
              ├── joueur2: string
              ├── valeur: number
              └── matchsEnsemble: number
```

> 📖 Voir **[MIGRATION_NOUVELLE_STRUCTURE.md](MIGRATION_NOUVELLE_STRUCTURE.md)** pour plus de détails

## 🎨 Personnalisation

### Couleurs

Modifie les variables CSS dans `css/style.css` :

```css
:root {
    --primary-color: #2ecc71;  /* Vert principal */
    --secondary-color: #34495e; /* Bleu foncé */
    --accent-color: #3498db;    /* Bleu accent */
}
```

### Constantes du système

Modifie `js/rating-system.js` :

```javascript
const K_FACTOR = 32;        // Vitesse d'évolution du rating
const BASE_RATING = 1000;   // Rating de départ
```

## 🐛 Résolution de problèmes

### "Firebase is not defined"

→ Vérifie que tu as bien configuré `js/firebase-config.js` avec tes clés

### "Permission denied" sur Firestore

→ Va dans les règles Firestore et assure-toi que les lectures/écritures sont autorisées

### Les joueurs ne s'affichent pas

→ Ouvre la console (F12) et vérifie s'il y a des erreurs. Si Firebase n'est pas configuré, le mode démo s'active automatiquement.

### Le site ne charge pas après déploiement

→ Vérifie que tous les chemins dans les imports JavaScript sont corrects (relatifs)

## 📝 TODO / Améliorations futures

- [ ] Ajouter des stats individuelles (buts, passes, etc.)
- [ ] Graphiques d'évolution du rating
- [ ] Export des données en CSV
- [ ] Système de notifications par email
- [ ] Mode tournoi
- [ ] Intégration d'une API météo

## 👤 Auteur

**Ruben** - Créé avec ⚽ en 2026

## 📄 Licence

Ce projet est libre d'utilisation pour un usage personnel.

---

## 🚀 Quick Start (Résumé)

```bash
# 1. Configure Firebase dans js/firebase-config.js

# 2. Teste en local (avec Live Server ou Python)
python -m http.server 8000
# ou
npx live-server

# 3. Ouvre http://localhost:8000

# 4. Va dans Admin, entre le code "foot2026"

# 5. Ajoute tes joueurs

# 6. Enregistre tes matchs

# 7. Enjoy ! ⚽
```

---

**Besoin d'aide ?** Ouvre une issue sur GitHub ou contacte Ruben directement.

