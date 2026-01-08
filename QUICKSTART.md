# 🚀 Guide de Démarrage Rapide

Pour ceux qui veulent démarrer **immédiatement** ! ⚡

---

## ⚙️ Setup Initial (5 minutes)

### 1️⃣ Firebase
```
1. Va sur https://console.firebase.google.com
2. Crée un projet "Impact Rating"
3. Active Firestore Database (mode test)
4. Copie tes clés Firebase
5. Colle-les dans js/firebase-config.js
```

### 2️⃣ Règles Firestore
```
1. Firestore → Règles
2. Copie le contenu de firestore.rules
3. Publie
```

### 3️⃣ Créer les Groupes
```
1. Ouvre setup-groupes.html dans ton navigateur
2. Clique sur "Générer les 5 codes"
3. Note les codes générés
```

### 4️⃣ Tester
```
1. Ouvre index.html
2. Entre un code (ex: ROSLAN)
3. Ajoute un joueur
4. Actualise → Le joueur est toujours là ✅
```

---

## 🌐 Déploiement (10 minutes)

### Option A : GitHub Pages (Recommandé)

```bash
# 1. Crée un repo sur GitHub

# 2. Dans ton terminal
git init
git add .
git commit -m "🚀 Initial commit"
git remote add origin https://github.com/TON_USERNAME/foot-impact-rating.git
git push -u origin main

# 3. Sur GitHub : Settings → Pages → Branch: main → Save

# 4. Attends 2 minutes, c'est en ligne ! 🎉
```

### Option B : Serveur Local

```bash
# Python 3
python -m http.server 8000

# Ou avec Node.js
npx http-server -p 8000

# Ouvre http://localhost:8000
```

---

## 📱 Utilisation

### Pour les Joueurs

1. **Première visite**
   - Entre ton code de groupe (ex: ROSLAN)
   - Le code est sauvegardé dans ton navigateur

2. **Ajouter un joueur**
   - Dashboard → "➕ Ajouter un joueur"
   - Entre nom, position
   - Valide

3. **Consulter**
   - Dashboard : Classement des joueurs
   - Historique : Tous les matchs
   - Synergies : Meilleures combos

### Pour l'Admin

1. **Se connecter**
   - Va sur admin-login.html
   - Code par défaut : `foot2026` (à changer !)

2. **Enregistrer un match**
   - Onglet "Nouveau Match"
   - Sélectionne la date
   - Coche les joueurs de chaque équipe
   - Entre les scores
   - Valide → Les ratings sont automatiquement mis à jour ! 🎯

3. **Générer des équipes**
   - Onglet "Générer Équipes"
   - Coche les joueurs présents
   - Clique sur "Générer"
   - L'algorithme crée 2 équipes équilibrées

4. **Gérer les joueurs**
   - Onglet "Gestion Joueurs"
   - Liste de tous les joueurs
   - Suppression possible

---

## 🔧 Personnalisation Rapide

### Changer les Couleurs

```css
/* css/style.css */
:root {
    --primary-color: #2ecc71;    /* Vert principal */
    --secondary-color: #34495e;  /* Bleu foncé */
    --accent-color: #3498db;     /* Bleu accent */
}
```

### Changer le Code Admin

```javascript
/* js/admin.js, ligne 10 */
const ADMIN_CODE = "foot2026";  // Change ici
```

### Changer les Noms de Groupes

```javascript
/* setup-groupes.html, lignes 112-118 */
const groupes = [
    { code: 'ROSLAN', nomGroupe: 'Ton Groupe 1' },
    { code: 'ZIDANE', nomGroupe: 'Ton Groupe 2' },
    // etc...
];
```

---

## ❓ FAQ Express

**Q: Le modal de code ne s'affiche plus ?**
```javascript
// Dans la console du navigateur (F12)
localStorage.clear();
// Puis actualise
```

**Q: Comment changer de groupe ?**
```javascript
// Console du navigateur
localStorage.clear();
// Actualise et entre un nouveau code
```

**Q: Les joueurs ne persistent pas ?**
```
1. Vérifie que Firebase est bien configuré
2. Regarde la console (F12) pour les erreurs
3. Vérifie les règles Firestore
```

**Q: Erreur "Permission denied" ?**
```
Firestore → Règles → Copie firestore.rules → Publie
```

**Q: Comment mettre à jour mon site GitHub Pages ?**
```bash
# Sur Windows
deploy.bat

# Sur Mac/Linux
./deploy.sh
```

---

## 🎯 Checklist Finale

Avant de partager à tes amis :

- [ ] Firebase configuré
- [ ] 5 groupes créés
- [ ] Règles Firestore publiées
- [ ] Site déployé (GitHub Pages)
- [ ] Testé : ajout de joueur
- [ ] Testé : enregistrement match
- [ ] Testé : génération d'équipes
- [ ] Code admin changé
- [ ] Codes de groupes notés et partagés

---

## 📚 Besoin de Plus ?

- 🔥 **Configuration détaillée** → [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- 🔄 **Structure des données** → [MIGRATION_NOUVELLE_STRUCTURE.md](MIGRATION_NOUVELLE_STRUCTURE.md)
- 🚀 **Déploiement avancé** → [DEPLOIEMENT_GITHUB_PAGES.md](DEPLOIEMENT_GITHUB_PAGES.md)
- 📖 **Tout le reste** → [README.md](README.md)

---

## 🎉 C'est Prêt !

Ton système Impact Rating est maintenant opérationnel ! 

**Partage l'URL à tes amis** et commence à suivre les performances de ton équipe ! ⚽🔥

Des questions ? Regarde les guides détaillés ou vérifie les logs dans la console (F12).

**Bon match ! 🚀**

