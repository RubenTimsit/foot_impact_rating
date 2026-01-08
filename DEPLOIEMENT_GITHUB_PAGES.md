# 🚀 Déploiement sur GitHub Pages

Guide complet pour héberger ton application **Impact Rating** sur GitHub Pages.

---

## 📋 Prérequis

- ✅ Un compte GitHub ([créer un compte](https://github.com/signup))
- ✅ Git installé sur ton ordinateur ([télécharger Git](https://git-scm.com/downloads))
- ✅ Ton projet Firebase configuré et fonctionnel

---

## 🎯 Étape 1 : Préparer le Projet

### 1.1 Créer un fichier `.gitignore`

Ce fichier indique à Git quels fichiers **ne pas** sauvegarder (fichiers temporaires, etc.)

```bash
# Dans le dossier de ton projet (C:\Users\ruben\Desktop\foot)
# Crée un fichier nommé .gitignore
```

Contenu du fichier `.gitignore` :
```
# Fichiers système
.DS_Store
Thumbs.db
desktop.ini

# Éditeurs
.vscode/
.idea/
*.swp
*.swo

# Node modules (si tu en as)
node_modules/

# Fichiers temporaires
*.log
*.tmp

# Fichiers de test (optionnel)
test/
```

### 1.2 Vérifier que Firebase est bien configuré

Ton fichier `js/firebase-config.js` doit contenir tes vraies clés Firebase.

⚠️ **Important** : GitHub Pages est un site **public**, donc tes clés Firebase seront visibles. C'est **OK** car :
- Firebase utilise des règles de sécurité côté serveur
- Les clés API Firebase sont conçues pour être publiques
- La vraie sécurité vient des **Firestore Security Rules**

> 🔒 **Questions sur la sécurité ?** Lis le guide complet : **[SECURITE_FIREBASE.md](SECURITE_FIREBASE.md)**
> 
> Ce guide explique en détail :
> - Pourquoi c'est sécurisé d'avoir les clés visibles
> - Comment fonctionne vraiment la sécurité Firebase
> - Les meilleures pratiques de sécurité
> - Documentation officielle Google

---

## 🔐 Étape 2 : Sécuriser Firebase (IMPORTANT)

Avant de déployer, configure les règles de sécurité Firestore !

### 2.1 Règles Firestore de Base

Va dans **Firebase Console** → **Firestore Database** → **Règles** et utilise :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Collection groupes : lecture publique, pas d'écriture
    match /groupes/{groupeId} {
      allow read: if true;
      allow write: if false;
      
      // Sous-collection joueurs : lecture publique, écriture publique
      match /joueurs/{joueurId} {
        allow read: if true;
        allow create: if true;  // Permet l'ajout de joueurs
        allow update, delete: if false;  // Seul l'admin peut modifier/supprimer
      }
      
      // Sous-collection matchs : lecture publique, pas d'écriture directe
      match /matchs/{matchId} {
        allow read: if true;
        allow write: if false;  // Seul l'admin peut écrire
      }
      
      // Sous-collection synergies : lecture publique, pas d'écriture directe
      match /synergies/{synergieId} {
        allow read: if true;
        allow write: if false;  // Seul l'admin peut écrire
      }
    }
  }
}
```

### 2.2 Pour une Sécurité Maximale (avec Auth)

Si tu veux sécuriser davantage l'admin, utilise Firebase Authentication :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Fonction pour vérifier si l'utilisateur est admin
    function isAdmin() {
      return request.auth != null && request.auth.uid == "TON_UID_ADMIN_ICI";
    }
    
    match /groupes/{groupeId} {
      allow read: if true;
      allow write: if isAdmin();
      
      match /joueurs/{joueurId} {
        allow read: if true;
        allow create: if true;
        allow update, delete: if isAdmin();
      }
      
      match /matchs/{matchId} {
        allow read: if true;
        allow write: if isAdmin();
      }
      
      match /synergies/{synergieId} {
        allow read: if true;
        allow write: if isAdmin();
      }
    }
  }
}
```

**📝 Note** : Pour l'instant, garde les règles simples (première version). Tu pourras améliorer plus tard.

---

## 🌐 Étape 3 : Créer un Repository GitHub

### 3.1 Via l'Interface GitHub (Méthode Simple)

1. **Va sur GitHub** : [https://github.com](https://github.com)

2. **Crée un nouveau repository** :
   - Clique sur le **+** en haut à droite → **New repository**
   - **Nom du repo** : `foot-impact-rating` (ou ce que tu veux)
   - **Description** : "Application Impact Rating pour équipes de foot"
   - **Visibilité** : Public (obligatoire pour GitHub Pages gratuit)
   - ❌ **NE COCHE PAS** "Add a README" (tu en as déjà un)
   - Clique sur **Create repository**

3. **Note l'URL de ton repo** : 
   ```
   https://github.com/TON_USERNAME/foot-impact-rating
   ```

---

## 📤 Étape 4 : Pousser ton Code sur GitHub

### 4.1 Ouvrir Git Bash / Terminal

**Sur Windows** :
- Ouvre **Git Bash** (ou **PowerShell** si Git est installé)
- Navigue vers ton projet :
  ```bash
  cd C:/Users/ruben/Desktop/foot
  ```

### 4.2 Initialiser Git

```bash
# Initialiser le repository Git local
git init

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "🚀 Initial commit - Application Impact Rating"
```

### 4.3 Lier à GitHub et Pousser

Remplace `TON_USERNAME` par ton nom d'utilisateur GitHub :

```bash
# Lier au repository distant
git remote add origin https://github.com/TON_USERNAME/foot-impact-rating.git

# Renommer la branche en 'main' (standard GitHub)
git branch -M main

# Pousser le code
git push -u origin main
```

**🔐 Authentification** :
- GitHub va te demander tes identifiants
- Utilise un **Personal Access Token** au lieu de ton mot de passe
- [Créer un token](https://github.com/settings/tokens) : Settings → Developer settings → Personal access tokens → Generate new token (classic)
- Permissions nécessaires : **repo** (cocher toute la section)

---

## 🌍 Étape 5 : Activer GitHub Pages

### 5.1 Dans les Settings du Repository

1. **Va sur ton repo GitHub** dans le navigateur

2. **Clique sur "Settings"** (en haut à droite)

3. **Dans le menu de gauche** → **Pages**

4. **Configure GitHub Pages** :
   - **Source** : Deploy from a branch
   - **Branch** : `main` (ou `master`)
   - **Folder** : `/ (root)`
   - Clique sur **Save**

5. **Attends quelques secondes** 📡

6. **Note l'URL de ton site** :
   ```
   https://TON_USERNAME.github.io/foot-impact-rating/
   ```

### 5.2 Première Visite

- Ouvre l'URL dans ton navigateur
- Le modal de code devrait apparaître
- Entre un code (ex: ROSLAN)
- Teste l'application ! 🎉

---

## ⚙️ Étape 6 : Configurer Firebase pour GitHub Pages

### 6.1 Ajouter le Domaine GitHub Pages

Dans **Firebase Console** :

1. **Authentication** → **Settings** → **Authorized domains**
   - Ajoute : `TON_USERNAME.github.io`
   - Sauvegarde

2. **(Optionnel)** Si tu utilises Firebase Hosting plus tard :
   - Tu peux configurer un domaine personnalisé

---

## 🔄 Étape 7 : Mettre à Jour ton Site

Chaque fois que tu modifies ton code :

```bash
# 1. Ajouter les fichiers modifiés
git add .

# 2. Créer un commit avec un message descriptif
git commit -m "✨ Description de tes modifications"

# 3. Pousser vers GitHub
git push

# GitHub Pages se met à jour automatiquement en 1-2 minutes
```

### Exemples de Messages de Commit

```bash
git commit -m "🐛 Fix: Correction du bug d'affichage des joueurs"
git commit -m "✨ Feature: Ajout du filtre par position"
git commit -m "💄 Style: Amélioration du design du dashboard"
git commit -m "📝 Docs: Mise à jour du README"
```

---

## 🧪 Étape 8 : Tester en Production

### Checklist de Test

- [ ] Le modal de code s'affiche à la première visite
- [ ] Tu peux entrer un code valide (ROSLAN, ZIDANE, etc.)
- [ ] Le nom du groupe s'affiche
- [ ] Tu peux ajouter un joueur
- [ ] Le joueur persiste après actualisation
- [ ] L'admin peut se connecter (Admin panel)
- [ ] L'enregistrement d'un match fonctionne
- [ ] L'historique s'affiche correctement
- [ ] Les synergies sont calculées
- [ ] Le générateur d'équipes fonctionne

---

## 🔧 Dépannage

### Problème : "Page not found" (404)

**Solution** :
- Vérifie que GitHub Pages est activé (Settings → Pages)
- L'URL doit être : `https://TON_USERNAME.github.io/NOM_DU_REPO/`
- Attends 2-3 minutes après l'activation

### Problème : Firebase ne fonctionne pas

**Solution** :
- Vérifie dans la console du navigateur (F12) s'il y a des erreurs
- Vérifie que `firebase-config.js` contient les bonnes clés
- Vérifie que ton domaine GitHub Pages est autorisé dans Firebase

### Problème : "Permission denied" dans Firestore

**Solution** :
- Va dans Firebase Console → Firestore → Règles
- Vérifie que les règles permettent la lecture publique
- Publie les nouvelles règles

### Problème : Les modifications ne s'affichent pas

**Solution** :
1. Vide le cache du navigateur (Ctrl + Shift + R)
2. Attends 1-2 minutes (GitHub Pages prend du temps)
3. Vérifie que tu as bien fait `git push`

---

## 🎨 Étape 9 : Personnalisation (Optionnel)

### Nom de Domaine Personnalisé

Tu peux utiliser ton propre domaine (ex: `impact-rating.com`) :

1. **Achète un domaine** (OVH, Namecheap, Google Domains...)

2. **Configure le DNS** :
   ```
   Type: CNAME
   Host: www
   Value: TON_USERNAME.github.io
   ```

3. **Dans GitHub** : Settings → Pages → Custom domain
   - Entre ton domaine
   - Sauvegarde

4. **Attends 24-48h** pour la propagation DNS

---

## 📊 Étape 10 : Monitoring (Optionnel)

### Google Analytics

Ajoute Google Analytics pour suivre les visites :

1. Crée un compte [Google Analytics](https://analytics.google.com)
2. Obtiens ton ID de mesure (ex: `G-XXXXXXXXXX`)
3. Ajoute dans `index.html` avant `</head>` :

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

## 🎯 Récapitulatif des Commandes Git

```bash
# Cloner ton projet existant (si tu changes d'ordinateur)
git clone https://github.com/TON_USERNAME/foot-impact-rating.git

# Voir l'état des fichiers modifiés
git status

# Ajouter des fichiers spécifiques
git add index.html css/style.css

# Ajouter tous les fichiers modifiés
git add .

# Créer un commit
git commit -m "Message descriptif"

# Pousser vers GitHub
git push

# Récupérer les dernières modifications (si tu travailles en équipe)
git pull

# Voir l'historique des commits
git log --oneline

# Annuler les modifications non commitées
git checkout .
```

---

## 🔗 Liens Utiles

- 📖 [Documentation GitHub Pages](https://docs.github.com/en/pages)
- 🔥 [Documentation Firebase](https://firebase.google.com/docs)
- 🎓 [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- 💬 [Support GitHub](https://support.github.com)

---

## ✅ Checklist Finale

Avant de partager ton site :

- [ ] Le code est poussé sur GitHub
- [ ] GitHub Pages est activé
- [ ] Les règles Firestore sont configurées
- [ ] Les 5 groupes sont créés dans Firebase
- [ ] L'application fonctionne sur l'URL GitHub Pages
- [ ] Tous les codes fonctionnent (ROSLAN, ZIDANE, etc.)
- [ ] Le localStorage fonctionne (persistance)
- [ ] L'ajout de joueurs fonctionne
- [ ] L'admin panel est fonctionnel
- [ ] Le domaine GitHub Pages est autorisé dans Firebase

---

## 🎉 C'est En Ligne !

Ton application est maintenant accessible à **https://TON_USERNAME.github.io/foot-impact-rating/** !

Partage cette URL à tes amis pour qu'ils puissent :
1. Entrer leur code de groupe
2. Ajouter des joueurs
3. Consulter les classements
4. Voir l'historique et les synergies

**Bon match ! ⚽🔥**

