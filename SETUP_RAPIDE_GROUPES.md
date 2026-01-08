# ⚡ Setup Rapide Multi-Groupes

## En 5 minutes chrono ! ⏱️

### 1️⃣ Déploie le code (si pas déjà fait)

```bash
git add .
git commit -m "Ajout système multi-groupes"
git push
```

### 2️⃣ Génère les 5 codes de groupes

1. Va sur **`https://ton-site.com/setup-groupes.html`**
2. Clique sur "Générer les 5 codes"
3. **Note-les** (capture d'écran ou copie-colle)

Codes par défaut :
- `PARIS1` - Paris Sud
- `LYON01` - Lyon Centre
- `MARS01` - Marseille Est
- `LILLE1` - Lille Nord
- `NANTE1` - Nantes Ouest

### 3️⃣ Supprime setup-groupes.html

```bash
git rm setup-groupes.html
git commit -m "Remove setup file"
git push
```

### 4️⃣ Partage ton code au groupe

```
Salut ! Notre code de groupe : PARIS1
Va sur [TON LIEN] et inscris-toi !
```

### 5️⃣ Inscris-toi

1. Va sur ton site
2. Entre le code `PARIS1`
3. Inscris-toi normalement

---

## ✅ C'est tout !

Maintenant :
- ✅ Chaque groupe a son propre code
- ✅ Les données sont isolées par groupe
- ✅ Tout fonctionne comme avant mais par groupe

---

## 🎯 Workflow complet

```
Utilisateur arrive sur le site
    ↓
On lui demande le code de groupe
    ↓
Il entre "PARIS1"
    ↓
Code vérifié dans Firebase
    ↓
Accès à l'inscription
    ↓
Inscription normale
    ↓
Code stocké en localStorage
    ↓
Prochaines visites : accès direct !
```

---

## 🔧 Modifier les codes (avant génération)

Édite `setup-groupes.html` ligne ~100 :

```javascript
const groupes = [
    { code: 'TON1ST', nomGroupe: 'Ton Groupe' },
    { code: 'AUTRE1', nomGroupe: 'Autre Groupe' },
    // ...
];
```

---

## 📊 Vérifier dans Firebase

1. Va dans Firebase Console
2. Collection `codes_activation`
3. Tu dois voir 5 documents avec tes codes

---

## ❓ Questions rapides

**Q : Combien de groupes max ?**  
R : Autant que tu veux ! Modifie juste le fichier setup.

**Q : Comment récupérer un code perdu ?**  
R : Firebase Console → `codes_activation`

**Q : Un joueur peut être dans 2 groupes ?**  
R : Non, il faut s'inscrire 2 fois avec 2 prénoms différents.

**Q : Comment désactiver un groupe ?**  
R : Firebase Console → Change `actif: false`

---

**Besoin de détails ?** → Lis `GUIDE_MULTI_GROUPES.md`

**C'est prêt ! 🚀**

