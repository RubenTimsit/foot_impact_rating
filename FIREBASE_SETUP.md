# 🔥 Guide de Configuration Firebase - Étape par Étape

Ce guide détaillé t'aidera à configurer Firebase pour ton application Impact Rating.

## 📋 Prérequis

- Un compte Google
- Un navigateur web
- 15 minutes de ton temps

---

## 🎯 Étape 1 : Créer un projet Firebase

### 1.1 Accéder à Firebase Console

1. Va sur [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Connecte-toi avec ton compte Google

### 1.2 Créer un nouveau projet

1. Clique sur **"Ajouter un projet"** (ou "Create a project")
2. **Nom du projet** : Entre "Impact Rating" (ou le nom de ton choix)
3. Clique sur **"Continuer"**
4. **Google Analytics** : Tu peux désactiver cette option (on n'en a pas besoin)
5. Clique sur **"Créer le projet"**
6. Attends quelques secondes pendant la création
7. Clique sur **"Continuer"** quand c'est prêt

✅ Ton projet Firebase est créé !

---

## 🌐 Étape 2 : Créer une application Web

### 2.1 Ajouter une app Web

1. Sur la page d'accueil du projet, cherche la section "Commencer en ajoutant Firebase à votre application"
2. Clique sur l'icône **</>** (symbole de code, pour "Web")
3. **Surnom de l'application** : Entre "Impact Rating Web"
4. **Firebase Hosting** : NE coche PAS cette option (on utilisera GitHub Pages)
5. Clique sur **"Enregistrer l'application"**

### 2.2 Récupérer les clés de configuration

Tu verras apparaître un code JavaScript qui ressemble à ça :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "impact-rating-xxxxx.firebaseapp.com",
  projectId: "impact-rating-xxxxx",
  storageBucket: "impact-rating-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

**⚠️ IMPORTANT : Copie ces informations dans un fichier texte temporaire !**

Tu en auras besoin dans quelques minutes.

8. Clique sur **"Continuer vers la console"**

---

## 💾 Étape 3 : Configurer Firestore Database

### 3.1 Créer la base de données

1. Dans le menu de gauche, clique sur **"Firestore Database"**
2. Clique sur le bouton **"Créer une base de données"**

### 3.2 Choisir le mode de sécurité

1. **Mode de sécurité** : Sélectionne **"Démarrer en mode test"**
   - Cela permet de lire/écrire librement pendant 30 jours
   - On configurera la sécurité plus tard
2. Clique sur **"Suivant"**

### 3.3 Choisir l'emplacement

1. **Emplacement Cloud Firestore** : Choisis la région la plus proche de toi :
   - Pour l'Europe : **europe-west** (Belgique) ou **europe-west1** (Belgique)
   - Pour la France : **europe-west1**
2. ⚠️ **Attention** : L'emplacement ne peut PAS être changé après !
3. Clique sur **"Activer"**

### 3.4 Créer les collections

Ta base de données est vide. On va créer les 3 collections nécessaires :

#### Collection "joueurs"

1. Clique sur **"Démarrer une collection"**
2. **ID de collection** : Entre `joueurs`
3. Clique sur **"Suivant"**
4. **ID du document** : Laisse en "Automatique"
5. Ajoute ces champs (clique sur "+ Ajouter un champ" pour chaque) :
   - `nom` (string) : "Test"
   - `impactRating` (number) : 1000
   - `positionPrincipale` (string) : "Milieu"
   - `matchsJoues` (number) : 0
   - `victoires` (number) : 0
   - `nuls` (number) : 0
   - `defaites` (number) : 0
   - `tauxPresence` (number) : 0
6. Clique sur **"Enregistrer"**

#### Collection "matchs"

1. Clique sur **"Démarrer une collection"**
2. **ID de collection** : Entre `matchs`
3. Clique sur **"Suivant"**
4. Clique sur **"Annuler"** (on laisse la collection vide pour l'instant)

#### Collection "synergies"

1. Répète pour créer une collection `synergies`
2. Laisse-la vide également

✅ Ta base de données est prête !

---

## 🔐 Étape 4 : Configurer les règles de sécurité (Important !)

### 4.1 Modifier les règles

1. Dans **Firestore Database**, clique sur l'onglet **"Règles"**
2. Tu verras quelque chose comme ça :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2026, 3, 15);
    }
  }
}
```

3. **Remplace tout** par ces règles (plus permissives pour commencer) :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tout le monde peut lire
    match /{document=**} {
      allow read: if true;
    }
    
    // Seuls les utilisateurs identifiés peuvent écrire
    // (Pour l'instant on laisse ouvert, tu pourras sécuriser plus tard)
    match /joueurs/{joueur} {
      allow write: if true;
    }
    
    match /matchs/{match} {
      allow write: if true;
    }
    
    match /synergies/{synergie} {
      allow write: if true;
    }
  }
}
```

4. Clique sur **"Publier"**

⚠️ **Note de sécurité** : Ces règles sont permissives. Pour un usage en production avec du monde, il faudrait ajouter une vraie authentification. Mais pour un groupe d'amis, c'est suffisant.

---

## 💻 Étape 5 : Configurer ton code

### 5.1 Ouvrir le fichier de configuration

1. Ouvre le dossier de ton projet
2. Va dans `js/firebase-config.js`

### 5.2 Remplacer les valeurs

Tu te souviens des clés que tu as copiées à l'étape 2.2 ? C'est le moment de les utiliser !

Remplace cette partie :

```javascript
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJECT_ID.firebaseapp.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT_ID.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID"
};
```

Par tes vraies valeurs :

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyC...",  // Ta clé API
    authDomain: "impact-rating-xxxxx.firebaseapp.com",
    projectId: "impact-rating-xxxxx",
    storageBucket: "impact-rating-xxxxx.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

### 5.3 Sauvegarder

Sauvegarde le fichier (Ctrl+S ou Cmd+S)

---

## 🧪 Étape 6 : Tester localement

### 6.1 Lancer un serveur local

Tu ne peux PAS ouvrir `index.html` directement (à cause des modules ES6). Il te faut un serveur local :

**Option A : Avec Python (si installé)**

```bash
cd chemin/vers/ton/projet
python -m http.server 8000
```

**Option B : Avec Node.js (si installé)**

```bash
npx live-server
```

**Option C : Avec l'extension VSCode**

1. Installe l'extension "Live Server" dans VSCode
2. Clic droit sur `index.html` → "Open with Live Server"

### 6.2 Tester l'application

1. Ouvre ton navigateur sur `http://localhost:8000` (ou le port indiqué)
2. Tu devrais voir la page d'accueil
3. Va dans l'onglet **Admin**
4. Entre le code : `foot2026`
5. Tu devrais voir le panneau admin

### 6.3 Ajouter un vrai joueur

1. Dans l'onglet **"Gérer Joueurs"**
2. Ajoute-toi : ton nom + ta position
3. Va voir dans la console Firebase si le joueur apparaît bien dans la collection "joueurs"

✅ Si tu vois ton joueur dans Firestore, tout fonctionne !

---

## 🚀 Étape 7 : Déployer sur GitHub Pages

### 7.1 Créer un repository GitHub

1. Va sur [github.com](https://github.com)
2. Clique sur le **+** en haut à droite → **New repository**
3. **Repository name** : `foot-rating` (ou ce que tu veux)
4. **Public** ou **Private** : à toi de choisir
5. NE coche PAS "Initialize with README" (tu as déjà un README)
6. Clique sur **Create repository**

### 7.2 Pousser ton code

Dans ton terminal :

```bash
cd chemin/vers/ton/projet

# Initialiser Git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Commit
git commit -m "Initial commit - Impact Rating app"

# Ajouter le remote (remplace par TON URL)
git remote add origin https://github.com/TON_USERNAME/foot-rating.git

# Pousser
git branch -M main
git push -u origin main
```

### 7.3 Activer GitHub Pages

1. Va sur ton repository GitHub
2. Clique sur **Settings**
3. Dans le menu de gauche, clique sur **Pages**
4. **Source** : Sélectionne la branche `main`
5. **Folder** : Laisse `/ (root)`
6. Clique sur **Save**
7. Attends 1-2 minutes

✅ Ton site est en ligne ! L'URL sera affichée en haut : `https://TON_USERNAME.github.io/foot-rating/`

---

## ✅ Checklist finale

Vérifie que tout fonctionne :

- [ ] Je peux voir la page d'accueil en ligne
- [ ] Les joueurs s'affichent dans le Dashboard
- [ ] Je peux me connecter en Admin avec le code
- [ ] Je peux ajouter un joueur
- [ ] Je peux enregistrer un match
- [ ] Les ratings se mettent à jour
- [ ] L'historique affiche les matchs
- [ ] La page synergies fonctionne

---

## 🆘 Problèmes fréquents

### "Firebase is not defined"

**Cause** : Les clés Firebase ne sont pas correctement configurées

**Solution** :
1. Vérifie `js/firebase-config.js`
2. Assure-toi que tu as remplacé TOUTES les valeurs "VOTRE_..."
3. Vérifie qu'il n'y a pas de guillemets manquants

### "Permission denied" dans la console

**Cause** : Les règles Firestore sont trop restrictives

**Solution** :
1. Va dans Firebase Console → Firestore Database → Règles
2. Vérifie que tu as bien les règles de l'étape 4.1
3. Publie les changements

### Le site ne charge pas sur GitHub Pages

**Cause** : Chemins incorrects ou délai de déploiement

**Solution** :
1. Attends 5 minutes (GitHub Pages peut être lent)
2. Vide le cache de ton navigateur (Ctrl+Shift+R)
3. Vérifie dans Settings → Pages que c'est bien activé

### Les données ne se sauvegardent pas

**Cause** : Problème de connexion à Firestore

**Solution** :
1. Ouvre la console (F12)
2. Regarde l'onglet "Network" pour voir si les requêtes Firebase passent
3. Vérifie que tu es connecté à Internet
4. Vérifie les règles Firestore

---

## 🎉 Félicitations !

Ton application Impact Rating est maintenant en ligne et fonctionnelle !

**Prochaines étapes** :
1. Change le code admin dans `js/admin.js`
2. Ajoute tous tes joueurs
3. Entre tes 3 matchs existants
4. Partage le lien avec tes potes !

---

**Besoin d'aide ?** Relis ce guide ou cherche l'erreur dans la console du navigateur (F12).

