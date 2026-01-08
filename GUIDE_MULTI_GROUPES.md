# 🔥 Système Multi-Groupes - Guide Complet

## 🎯 Vue d'ensemble

Ton app Impact Rating supporte maintenant **plusieurs groupes de foot indépendants** !

Chaque groupe a :
- ✅ Son propre code d'activation (6 lettres)
- ✅ Ses propres joueurs
- ✅ Ses propres matchs
- ✅ Ses propres synergies
- ✅ Son propre historique

Les groupes sont **totalement isolés** : un groupe ne voit JAMAIS les données d'un autre groupe.

---

## 🚀 Installation (une seule fois)

### Étape 1 : Déployer le code

Déploie normalement ton app sur GitHub Pages ou Firebase Hosting.

### Étape 2 : Créer les 5 codes de groupes

1. **Va sur** `https://ton-site.com/setup-groupes.html`
2. Clique sur **"Générer les 5 codes de groupes"**
3. **Note les codes quelque part** (ou prends une capture d'écran)

Les 5 codes par défaut :
- `PARIS1` - Paris Sud
- `LYON01` - Lyon Centre
- `MARS01` - Marseille Est
- `LILLE1` - Lille Nord
- `NANTE1` - Nantes Ouest

> 💡 Tu peux les modifier dans `setup-groupes.html` avant de générer

### Étape 3 : Supprimer le fichier setup

Une fois les codes créés, **supprime** `setup-groupes.html` de ton serveur pour que personne ne puisse regénérer les codes.

---

## 👥 Utilisation par groupe

### Pour le créateur du groupe (toi)

1. **Partage le code** à ton groupe :
   ```
   Yo ! Voici notre code pour le système de foot :
   
   Code : PARIS1
   
   Va sur [TON LIEN] et inscris-toi !
   ```

2. **Inscris-toi** toi-même avec le code

3. **Va dans Admin** pour gérer les matchs de TON groupe

### Pour les joueurs du groupe

1. Ils vont sur ton site
2. On leur demande le **code de groupe**
3. Ils entrent `PARIS1` (ou le code que tu leur as donné)
4. Ils s'inscrivent normalement

---

## 🔒 Sécurité et isolation

### Ce qui est séparé par groupe :

✅ **Joueurs** : Chaque joueur appartient à UN seul groupe
✅ **Matchs** : Les matchs sont liés à un groupe spécifique
✅ **Synergies** : Calculées uniquement avec les joueurs du même groupe
✅ **Dashboard** : N'affiche que les données du groupe
✅ **Historique** : Ne montre que les matchs du groupe
✅ **Admin** : L'admin ne gère QUE son groupe

### Comment ça marche techniquement ?

Chaque document dans Firestore a un champ `codeGroupe` :

```javascript
Joueur {
  nom: "Ruben",
  codeGroupe: "PARIS1",  // ← IMPORTANT
  impactRating: 1050,
  ...
}

Match {
  date: "2026-01-10",
  codeGroupe: "PARIS1",  // ← IMPORTANT
  equipe1: {...},
  ...
}
```

Toutes les requêtes filtrent par `codeGroupe` :

```javascript
// Charger uniquement les joueurs de mon groupe
query(
  collection(db, 'joueurs'),
  where('codeGroupe', '==', 'PARIS1')
)
```

---

## 📱 Expérience utilisateur

### Première visite

1. L'utilisateur arrive sur le site
2. **Demande du code** : Il doit entrer son code de groupe
3. Le code est vérifié dans Firebase
4. **Code valide** → Inscription classique
5. **Code stocké** en localStorage (il ne le retape plus)

### Visites suivantes

1. Le code est **automatiquement récupéré** du localStorage
2. L'utilisateur accède directement à son Dashboard
3. Il voit uniquement les données de son groupe

### Changer de groupe

Si un utilisateur veut changer de groupe (rare) :
1. Il doit vider le localStorage du navigateur
2. Ou tu peux ajouter un bouton "Changer de groupe" plus tard

---

## 🎨 Personnalisation des groupes

### Modifier les noms et codes

Avant de générer les codes, édite `setup-groupes.html` :

```javascript
const groupes = [
    { code: 'MON1ST', nomGroupe: 'Mon Super Groupe' },
    { code: 'FRIEND', nomGroupe: 'Amis du Foot' },
    { code: 'ELITE1', nomGroupe: 'Elite Lyon' },
    { code: 'FAMIL1', nomGroupe: 'Famille' },
    { code: 'WORK01', nomGroupe: 'Collègues Travail' }
];
```

**Règles pour les codes :**
- ✅ Exactement **6 caractères**
- ✅ Lettres et chiffres uniquement
- ✅ Majuscules recommandées
- ✅ Faciles à retenir et partager

---

## 🔧 Structure Firebase

### Collection `codes_activation`

```
codes_activation/
  doc1/
    code: "PARIS1"
    nomGroupe: "Paris Sud"
    dateCreation: "2026-01-10T..."
    actif: true
  doc2/
    code: "LYON01"
    nomGroupe: "Lyon Centre"
    ...
```

### Collection `joueurs` (avec groupes)

```
joueurs/
  doc1/
    nom: "Ruben"
    codeGroupe: "PARIS1"  ← Nouveau champ
    impactRating: 1050
    ...
  doc2/
    nom: "Pierre"
    codeGroupe: "PARIS1"  ← Même groupe
    ...
  doc3/
    nom: "Jacques"
    codeGroupe: "LYON01"  ← Autre groupe
    ...
```

### Collection `matchs` (avec groupes)

```
matchs/
  match1/
    date: "2026-01-10"
    codeGroupe: "PARIS1"  ← Nouveau champ
    equipe1: {...}
    equipe2: {...}
```

---

## 💡 Cas d'usage

### Cas 1 : Un seul organisateur, plusieurs terrains

Tu gères 3 groupes différents qui jouent sur 3 terrains :
- Groupe A : `TERR01`
- Groupe B : `TERR02`
- Groupe C : `TERR03`

Chaque groupe est indépendant mais tu peux gérer les 3 en changeant de code.

### Cas 2 : Partager le code source

Tu veux partager ton code avec un ami qui a son propre groupe :
1. Il déploie l'app sur SON Firebase
2. Il génère SES codes
3. Vous avez 2 apps totalement indépendantes

### Cas 3 : Plusieurs villes

Tu as des amis dans plusieurs villes :
- `PARIS1` → Groupe de Paris
- `LYON01` → Groupe de Lyon
- `MARS01` → Groupe de Marseille

Chaque ville a son propre système, mais tu peux participer aux 3 !

---

## ❓ FAQ

### Peut-on avoir plus de 5 groupes ?

Oui ! Modifie `setup-groupes.html` et ajoute autant de groupes que tu veux.

### Un joueur peut-il être dans plusieurs groupes ?

Non, par design. Chaque joueur est lié à UN seul groupe.

Si quelqu'un veut jouer dans 2 groupes, il doit s'inscrire 2 fois (avec 2 prénoms différents ou en ajoutant son nom de famille).

### Peut-on renommer un groupe ?

Oui, dans Firebase Console :
1. Va dans `codes_activation`
2. Modifie le champ `nomGroupe`

### Peut-on désactiver un groupe ?

Oui, dans Firebase Console :
1. Va dans `codes_activation`
2. Change `actif: true` en `actif: false`

Les utilisateurs avec ce code ne pourront plus se connecter.

### Que se passe-t-il si on perd un code ?

Va dans Firebase Console → `codes_activation` et récupère le code.

### Comment supprimer un groupe ?

Dans Firebase Console :
1. Supprime tous les joueurs avec ce `codeGroupe`
2. Supprime tous les matchs avec ce `codeGroupe`
3. Supprime le code dans `codes_activation`

---

## 🎯 Avantages du système multi-groupes

### Pour toi (admin) :
- ✅ Tu peux gérer plusieurs groupes d'amis
- ✅ Pas de mélange entre les groupes
- ✅ Code à partager simple (6 lettres)

### Pour les joueurs :
- ✅ Inscription rapide avec un code
- ✅ Ils voient uniquement leur groupe
- ✅ Pas de confusion avec d'autres groupes

### Pour le système :
- ✅ Évolutif : ajoute autant de groupes que tu veux
- ✅ Sécurisé : isolation complète entre groupes
- ✅ Simple : juste un champ `codeGroupe` partout

---

## 🚀 Checklist de déploiement

- [ ] Déployer le nouveau code
- [ ] Aller sur `setup-groupes.html`
- [ ] Générer les 5 codes
- [ ] Noter les codes quelque part
- [ ] Supprimer `setup-groupes.html` du serveur
- [ ] Partager le code à ton groupe
- [ ] Tester l'inscription avec le code
- [ ] Tester l'admin
- [ ] Enregistrer un match de test
- [ ] Vérifier que le filtrage fonctionne
- [ ] Profit ! 🎉

---

## 🎨 Exemple de message à envoyer

```
🔥 Salut les gars !

On a un système de stats pour nos matchs de foot.

📝 ÉTAPE 1 : Inscris-toi
Va sur : [TON LIEN]

📋 ÉTAPE 2 : Entre notre code de groupe
Code : PARIS1

⚽ ÉTAPE 3 : Remplis le formulaire
Ton prénom, ta position, c'est tout !

✅ C'est fait ! Tu peux maintenant voir ton rating, 
les synergies avec les autres, l'historique des matchs, etc.

À samedi pour le match ! 🚀
```

---

**Bravo, ton système multi-groupes est prêt ! 🎉**

