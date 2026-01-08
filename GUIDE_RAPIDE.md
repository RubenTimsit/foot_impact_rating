# 🚀 Guide Rapide - Impact Rating

## 📁 Structure du projet

```
foot/
├── index.html              # Page d'accueil / Dashboard
├── synergies.html          # Page des synergies et trios
├── historique.html         # Historique des matchs
├── algorithm.html          # Explication des algorithmes
├── admin-login.html        # Interface admin
│
├── css/
│   ├── style.css          # Styles principaux
│   ├── admin.css          # Styles admin
│   ├── algorithm.css      # Styles page algorithme
│   └── synergies.css      # Styles page synergies
│
├── js/
│   ├── firebase-config.js    # Configuration Firebase (À CONFIGURER!)
│   ├── app.js                # Logique page d'accueil
│   ├── admin.js              # Logique admin
│   ├── rating-system.js      # Calculs de rating
│   ├── synergy-system.js     # Système de synergies
│   ├── team-balancer.js      # Algorithme d'équilibrage
│   ├── synergies.js          # Logique page synergies
│   └── historique.js         # Logique page historique
│
├── README.md              # Documentation complète
├── FIREBASE_SETUP.md      # Guide Firebase détaillé
├── GUIDE_RAPIDE.md        # Ce fichier
└── .gitignore            # Fichiers à ignorer par Git
```

---

## ⚡ Démarrage en 5 minutes

### 1️⃣ Configure Firebase (5 min)

**Option rapide** : Suis le fichier `FIREBASE_SETUP.md` étape par étape

**Résumé ultra-rapide** :
1. Crée un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Active Firestore Database (mode test)
3. Copie les clés de config dans `js/firebase-config.js`

### 2️⃣ Teste en local (1 min)

```bash
# Avec Python
python -m http.server 8000

# Ou avec Node.js
npx live-server
```

Ouvre `http://localhost:8000`

### 3️⃣ Change le code admin (30 sec)

Ouvre `js/admin.js` et change la ligne 8 :

```javascript
const ADMIN_CODE = "ton_code_perso_ici";  // Au lieu de "foot2026"
```

### 4️⃣ Déploie sur GitHub Pages (2 min)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TON_USER/TON_REPO.git
git push -u origin main
```

Puis dans GitHub : Settings → Pages → Active la branche `main`

---

## 🎮 Utilisation au quotidien

### Pour toi (Admin)

**Avant le match :**
1. Va sur **Admin** → **Créer Équipes**
2. Coche les joueurs présents
3. Clique sur "Générer des équipes équilibrées"
4. Choisis une des propositions

**Après le match :**
1. Va sur **Admin** → **Nouveau Match**
2. Sélectionne la date
3. Entre le score
4. Coche les joueurs de chaque équipe
5. Clique sur "Enregistrer le match"

→ Les ratings se mettent à jour automatiquement !

### Pour tes potes

1. **Dashboard** : Voir leur classement
2. **Synergies** : Découvrir avec qui ils jouent le mieux
3. **Historique** : Revoir les matchs passés

---

## 📊 Comprendre les chiffres

### Impact Rating

- **1000** : Rating de départ
- **1100+** : Très bon joueur
- **900-** : Besoin de progresser

Après chaque match :
- Victoire attendue : +5 à +15 points
- Victoire surprise : +15 à +30 points
- Défaite : -5 à -25 points

### Synergies

- **+5 et plus** : Duo exceptionnel 🔥
- **+3 à +5** : Bonne compatibilité ✅
- **0 à +2** : Neutre
- **Négatif** : À éviter de mettre ensemble

### Confiance statistique

- **0-30%** : Peu de matchs, rating pas encore fiable
- **50-70%** : Rating commence à être représentatif
- **100%** : Rating très fiable (10+ matchs)

---

## 🎯 Cas d'usage

### Scénario 1 : Premier match de la saison

1. Ajoute tous tes joueurs dans **Admin** → **Gérer Joueurs**
2. Ils commencent tous à 1000
3. Le premier équilibrage sera basé uniquement sur les positions
4. Après 3-4 matchs, les ratings commenceront à être pertinents

### Scénario 2 : Milieu de saison

1. Utilise **Créer Équipes** avant chaque match
2. L'algo prend en compte :
   - Les ratings individuels
   - Les synergies des matchs précédents
   - Les positions
3. Tu obtiens 3 propositions équilibrées
4. Choisis celle qui te plaît le mieux

### Scénario 3 : Nouveau joueur arrive

1. Ajoute-le dans **Gérer Joueurs**
2. Il démarre à 1000 (rating moyen)
3. Après 2-3 matchs, son "vrai" rating se stabilisera
4. L'indicateur de confiance sera bas au début (normal)

---

## 🔧 Personnalisation

### Changer les couleurs

`css/style.css` ligne 2-6 :

```css
:root {
    --primary-color: #2ecc71;    /* Vert principal */
    --secondary-color: #34495e;  /* Bleu foncé */
    --accent-color: #3498db;     /* Bleu clair */
}
```

### Ajuster la vitesse d'évolution des ratings

`js/rating-system.js` ligne 6 :

```javascript
const K_FACTOR = 32;  // Plus c'est élevé, plus ça change vite
                      // 16 = lent, 32 = standard, 64 = rapide
```

### Changer le seuil des trios

`js/synergy-system.js` ligne 127 :

```javascript
const trios = detecterTrios(synergies, joueurs, 2.5);
                                                 ^^
                                      Seuil minimum de synergie
```

---

## ❓ FAQ

### Puis-je supprimer un match par erreur ?

Pour l'instant non, mais tu peux :
1. Aller dans Firebase Console
2. Collection "matchs"
3. Supprimer le document concerné
4. Ajuster manuellement les ratings si besoin

### Que faire si un joueur arrête de venir ?

Laisse-le dans la base ! Son `tauxPresence` baissera automatiquement.
Si tu veux vraiment le supprimer : **Admin** → **Gérer Joueurs** → Supprimer

### Comment sauvegarder mes données ?

**Option 1** : Firebase fait des backups automatiques

**Option 2** : Exporte depuis Firebase Console :
- Firestore Database → Import/Export

### Puis-je avoir plusieurs admins ?

Oui ! Donne le code admin à d'autres personnes de confiance.

Plus tard, tu pourras améliorer en ajoutant une vraie authentification Firebase.

### Le site fonctionne hors ligne ?

Non, il faut une connexion Internet pour accéder à Firebase.

---

## 🐛 Debugging rapide

### Problème : Page blanche

1. Ouvre la console (F12)
2. Regarde les erreurs en rouge
3. Si "Firebase is not defined" → vérifie `firebase-config.js`

### Problème : Données ne se sauvegardent pas

1. Console F12 → onglet Network
2. Cherche des requêtes Firebase en rouge
3. Vérifie les règles Firestore (doivent permettre l'écriture)

### Problème : Joueurs ne s'affichent pas

1. Va dans Firebase Console
2. Vérifie que la collection "joueurs" existe et contient des données
3. Vérifie la console pour des erreurs JavaScript

---

## 📈 Prochaines évolutions possibles

Si tu veux améliorer l'app plus tard :

- [ ] **Stats individuelles** : Buts, passes décisives, cartons
- [ ] **Graphiques** : Évolution du rating dans le temps (Chart.js)
- [ ] **Export CSV** : Télécharger toutes les stats
- [ ] **Mode tournoi** : Créer des tournois avec plusieurs phases
- [ ] **Notifications** : Email ou SMS pour les prochains matchs
- [ ] **Photos de joueurs** : Upload dans Firebase Storage
- [ ] **Commentaires** : Ajouter des notes sur les matchs
- [ ] **MVPs** : Élire le meilleur joueur de chaque match

---

## 🎓 Ressources

- **Firebase** : [Documentation officielle](https://firebase.google.com/docs)
- **ELO Rating** : [Wikipédia](https://fr.wikipedia.org/wiki/Classement_Elo)
- **JavaScript** : [MDN Web Docs](https://developer.mozilla.org/fr/)

---

## 💬 Retours et améliorations

Si tu as des idées pour améliorer l'app :
1. Note-les quelque part
2. On pourra les implémenter ensemble plus tard

Bon foot ! ⚽🔥

