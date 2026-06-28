# Guide complet — Publier Impact Rating sur Play Store & App Store

> **Technologie choisie : Capacitor (Ionic)**
> Capacitor emballe ton app web dans une coque native Android/iOS.
> Pas de réécriture. Le backend Firebase existant reste intact.
>
> **Ce que tu peux faire maintenant (sans Mac)**
> Étapes 1 à 8 → entièrement faisables sur Windows.
> Android (Play Store) → faisable sur Windows.
>
> **Ce qui nécessite un Mac**
> Étape 9 et suivantes → Xcode est obligatoire pour compiler iOS.

---

## Comptes à créer / à avoir

| Compte | Coût | Lien | Pour quoi |
|--------|------|------|-----------|
| Google Play Developer | 25 $ (une fois) | play.google.com/console | Publier sur Android |
| Apple Developer Program | 99 $/an | developer.apple.com | Publier sur iOS |
| Node.js installé | Gratuit | nodejs.org (v20 LTS) | Build tools |

---

## Vue d'ensemble des étapes

```
Étape 1  — Nettoyer le code mort
Étape 2  — Migrer Firebase SDK : CDN → npm + Vite
Étape 3  — Remplacer Google Sign-In popup
Étape 4  — Installer et configurer Capacitor
Étape 5  — Ajouter les configs Firebase natives
Étape 6  — Corriger le CSS mobile
Étape 7  — Créer les assets (icône, splash)
Étape 8  — Ajouter une page Privacy Policy
Étape 9  — Notifications push (FCM) [optionnel mais recommandé]
Étape 10 — Build et test Android (émulateur)
Étape 11 — Soumettre sur le Play Store
Étape 12 — (Sur Mac) Build iOS
Étape 13 — Soumettre sur l'App Store
```

---

## ÉTAPE 1 — Nettoyer le code mort

Ces fichiers ne sont plus utilisés par aucune page déployée. Les garder dans le bundle Vite alourdit l'app inutilement.

### Fichiers JS à supprimer

```
js/app.js
js/admin.js
js/historique.js
js/synergies.js
js/inscription.js
js/algorithm.js
js/groupe-manager.js
js/code-modal.js
js/confirm-modal.js
js/team-balancer.js        ← non connecté à l'UI admin actuelle
```

### Fichiers CSS à supprimer

```
css/algorithm.css
css/synergies.css
css/admin.css
css/inscription.css
css/modal.css
css/style.css              ← uniquement utilisé par setup-groupes.html (dev tool)
```

### Vérification avant suppression
Faire un `Ctrl+Shift+F` dans VS Code sur le nom de chaque fichier pour s'assurer qu'aucune page HTML active ne l'importe encore.

---

## ÉTAPE 2 — Migrer Firebase SDK : CDN → npm + Vite

### Pourquoi
Capacitor a besoin que tous les fichiers soient locaux (pas de CDN). Vite est le bundler le plus simple pour ce projet.

### 2.1 — Créer un package.json à la racine

```bash
npm init -y
```

### 2.2 — Installer les dépendances

```bash
npm install firebase
npm install --save-dev vite
```

### 2.3 — Créer vite.config.js à la racine

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'www',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index:       'index.html',
        login:       'login.html',
        profil:      'profil.html',
        groupe:      'groupe.html',
        adminGroupe: 'admin-groupe.html',
        superAdmin:  'super-admin.html',
      }
    }
  },
  server: {
    port: 3000
  }
});
```

### 2.4 — Modifier js/firebase-config.js

Remplacer les imports CDN :

```js
// AVANT (CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, ... } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, ... } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// APRÈS (npm)
import { initializeApp } from 'firebase/app';
import { getFirestore, ... } from 'firebase/firestore';
import { getAuth, ... } from 'firebase/auth';
```

### 2.5 — Modifier tous les fichiers HTML

Chaque `<script type="module">` dans les HTML importe `firebase-config.js`.
Les imports internes `./js/firebase-config.js` restent inchangés — Vite les résoudra.

### 2.6 — Ajouter les scripts dans package.json

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

### 2.7 — Tester que ça marche

```bash
npm run dev
```

Ouvrir `http://localhost:3000` et vérifier que toutes les pages fonctionnent.

### 2.8 — Mettre à jour firebase.json

Le dossier `public` doit pointer vers le build Vite :

```json
{
  "hosting": {
    "public": "www",
    ...
  }
}
```

---

## ÉTAPE 3 — Remplacer Google Sign-In popup

### Pourquoi c'est critique
`signInWithPopup` ne fonctionne **pas** dans les WebViews Android et iOS. Google bloque explicitement les flux OAuth dans les WebViews non autorisés.

### Solution recommandée : plugin Capacitor Google Auth

```bash
npm install @codetrix-studio/capacitor-google-auth
```

### 3.1 — Récupérer le Web Client ID

Dans la **Firebase Console** :
`Authentication > Sign-in method > Google > Web SDK configuration > Web client ID`

Format : `285043352720-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`

### 3.2 — Modifier js/auth.js et login.html

Remplacer la logique `signInWithPopup` par le plugin Capacitor :

```js
// AVANT
import { GoogleAuthProvider, signInWithPopup } from './firebase-config.js';
const provider = new GoogleAuthProvider();
const result = await signInWithPopup(auth, provider);

// APRÈS (avec le plugin Capacitor)
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

await GoogleAuth.initialize({
  clientId: 'TON_WEB_CLIENT_ID.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
});

const googleUser = await GoogleAuth.signIn();
const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
const result = await signInWithCredential(auth, credential);
```

### 3.3 — Sur le web (développement)

En mode web classique, `GoogleAuth.signIn()` redirige vers le flux OAuth standard.
Sur mobile, il utilise le flux natif. Le même code fonctionne partout.

### 3.4 — Enregistrer les origines dans Firebase Console

Après avoir créé les apps Android et iOS dans Firebase (étape 5), retourner dans :
`Firebase Console > Authentication > Sign-in method > Google`
et vérifier que les **Client IDs Android et iOS** sont bien listés.

---

## ÉTAPE 4 — Installer et configurer Capacitor

### 4.1 — Installer Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
```

### 4.2 — Initialiser Capacitor

```bash
npx cap init
```

Répondre aux questions :
- **App name** : `Impact Rating`
- **App ID** : `com.impactrating.app` (ou ton propre domaine inversé)
- **Web asset directory** : `www`

Cela crée `capacitor.config.ts` (ou `.json`) à la racine.

### 4.3 — Vérifier capacitor.config.ts

```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.impactrating.app',
  appName: 'Impact Rating',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'TON_WEB_CLIENT_ID.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    }
  }
};

export default config;
```

### 4.4 — Ajouter les plateformes

```bash
npx cap add android
npx cap add ios          ← à faire sur Mac uniquement
```

### 4.5 — Workflow de build (à répéter à chaque modification)

```bash
npm run build            # Vite → génère www/
npx cap sync             # Copie www/ vers android/app/src/main/assets/public
                         # et met à jour les plugins natifs
```

### 4.6 — Ouvrir dans Android Studio

```bash
npx cap open android
```

Première fois : Android Studio télécharge les Gradle dependencies (peut prendre 5-10 min).

---

## ÉTAPE 5 — Configurer Firebase pour les apps natives

### 5.1 — Créer les apps dans la Firebase Console

Aller sur [console.firebase.google.com](https://console.firebase.google.com) → projet `foot-4f0c2`

#### App Android
1. Cliquer **"Ajouter une application" > Android**
2. **Package name** : `com.impactrating.app` (doit correspondre exactement à l'App ID Capacitor)
3. **Pseudonyme** : `Impact Rating Android`
4. SHA-1 de debug (pour Google Sign-In) :
   ```bash
   cd android
   ./gradlew signingReport
   ```
   Copier le SHA-1 affiché sous `Variant: debug`
5. Télécharger `google-services.json`
6. Placer le fichier ici : `android/app/google-services.json`

#### App iOS (sur Mac plus tard)
1. Cliquer **"Ajouter une application" > iOS**
2. **Bundle ID** : `com.impactrating.app`
3. Télécharger `GoogleService-Info.plist`
4. Placer le fichier ici : `ios/App/App/GoogleService-Info.plist`

### 5.2 — SHA-1 de production (avant publication Play Store)

Quand tu crées ta clé de signature de release :
```bash
keytool -list -v -keystore release.keystore -alias impactrating
```
Ajouter le SHA-1 de release dans Firebase Console > App Android > Ajouter empreinte.

---

## ÉTAPE 6 — Corriger le CSS mobile

### 6.1 — Safe areas iOS (encoche, Dynamic Island, barre de navigation)

Dans chaque fichier CSS utilisé, ajouter au niveau des éléments conteneurs principaux :

```css
/* Dans css/groupe.css, css/profil.css, css/auth.css, etc. */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

Pour que `env()` fonctionne sur iOS, ajouter dans **chaque HTML** :

```html
<!-- Remplacer -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- Par -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

### 6.2 — Corriger le tableau de classement coupé sur mobile (ISSUES.md P2-14)

Dans `css/groupe.css`, s'assurer que le tableau classement est scrollable horizontalement :

```css
.classement-table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

### 6.3 — Empêcher le zoom au tap sur les inputs (iOS)

```css
input, select, textarea {
  font-size: 16px; /* iOS ne zoome pas si font-size >= 16px */
}
```

### 6.4 — Désactiver le overscroll bounce (optionnel, plus natif)

```css
html, body {
  overscroll-behavior: none;
}
```

---

## ÉTAPE 7 — Créer les assets (icône et splash screen)

### 7.1 — Installer le générateur d'assets Capacitor

```bash
npm install --save-dev @capacitor/assets
```

### 7.2 — Créer les fichiers source

Créer un dossier `assets/` à la racine et y placer :

| Fichier | Dimensions | Format | Contenu |
|---------|-----------|--------|---------|
| `assets/icon.png` | 1024×1024 px | PNG sans transparence | Logo de l'app |
| `assets/icon-foreground.png` | 1024×1024 px | PNG avec transparence | Icône Android adaptive (foreground) |
| `assets/icon-background.png` | 1024×1024 px | PNG | Fond de l'icône Android adaptive |
| `assets/splash.png` | 2732×2732 px | PNG | Écran de démarrage |
| `assets/splash-dark.png` | 2732×2732 px | PNG | Splash mode sombre (optionnel) |

### 7.3 — Générer tous les assets automatiquement

```bash
npx capacitor-assets generate
```

Cette commande génère automatiquement toutes les tailles requises pour Android et iOS.

### 7.4 — Tailles d'icônes Play Store

En plus des assets générés par Capacitor, le Play Store demande :
- Icône haute résolution : **512×512 PNG** (pour la fiche store)
- Feature graphic : **1024×500 PNG** (bandeau en haut de la fiche)

---

## ÉTAPE 8 — Créer une page Privacy Policy

Les deux stores **refusent les apps sans lien vers une politique de confidentialité**. C'est obligatoire.

### 8.1 — Contenu minimum requis (adapté à l'app)

La politique doit mentionner :
- Les données collectées : nom, email, photo (via Google Auth), position sur le terrain
- Pourquoi : fonctionnement de l'app, classements, votes
- Où elles sont stockées : Firebase / Google Cloud (Europe west1)
- Durée de conservation
- Droits de l'utilisateur : suppression du compte
- Contact email

### 8.2 — Créer privacy.html

Créer une page `privacy.html` à la racine du projet avec le contenu de la politique.
La déployer sur Firebase Hosting → accessible à `https://foot-4f0c2.web.app/privacy`

### 8.3 — Liens depuis l'app

Ajouter un lien vers `/privacy` dans :
- `login.html` (pied de page du formulaire d'inscription)
- `index.html` (footer)

---

## ÉTAPE 9 — Notifications push (recommandé)

Sans notifications, les joueurs doivent ouvrir l'app pour savoir si les inscriptions sont ouvertes.

### 9.1 — Installer le plugin

```bash
npm install @capacitor/push-notifications
```

### 9.2 — Activer FCM dans Firebase Console

`Firebase Console > Messaging > Commencer`

### 9.3 — Collecter et stocker les tokens

Dans le JS de l'app (à déclencher après connexion) :

```js
import { PushNotifications } from '@capacitor/push-notifications';

// Demander la permission
await PushNotifications.requestPermissions();
await PushNotifications.register();

// Récupérer le token FCM
PushNotifications.addListener('registration', async (token) => {
  // Sauvegarder dans Firestore users/{uid}
  await updateDoc(doc(db, 'users', uid), {
    fcmToken: token.value,
    fcmPlatform: Capacitor.getPlatform() // 'android' | 'ios'
  });
});
```

### 9.4 — Envoyer les notifications depuis les Cloud Functions

Dans `functions/index.js`, à chaque événement clé :
- Ouverture des inscriptions (`programmé → ouvert`)
- Promotion de la liste d'attente
- Fermeture des votes

```js
const { getMessaging } = require('firebase-admin/messaging');
const messaging = getMessaging();

// Exemple : notifier un joueur promu de la liste d'attente
await messaging.send({
  token: joueurFcmToken,
  notification: {
    title: 'Tu es inscrit ! ⚽',
    body: `Tu passes de la liste d'attente à confirmé pour le match de ${dateMatch}`
  },
  android: { priority: 'high' },
  apns: { payload: { aps: { sound: 'default' } } }
});
```

### 9.5 — Firestore rules

Ajouter le champ `fcmToken` aux champs autorisés en écriture dans `firestore.rules` :

```
// Dans les règles de users/{userId} :
allow write: if request.auth.uid == userId
  && request.resource.data.keys().hasOnly(['fcmToken', 'fcmPlatform', ...autresChamps]);
```

---

## ÉTAPE 10 — Build et test Android

### 10.1 — Installer Android Studio

Télécharger sur [developer.android.com/studio](https://developer.android.com/studio)
Lors de l'installation, accepter les SDK Android (API 34+ recommandé).

### 10.2 — Build complet

```bash
npm run build       # Vite build → www/
npx cap sync        # Sync vers android/
npx cap open android
```

### 10.3 — Tester sur émulateur

Dans Android Studio :
1. `Tools > Device Manager > Create Device`
2. Choisir un Pixel récent, API 34
3. Cliquer Run (triangle vert)

### 10.4 — Tester sur appareil réel

1. Sur ton Android : `Paramètres > Options développeur > Débogage USB` → activer
2. Brancher en USB
3. Dans Android Studio, sélectionner le device dans la liste déroulante et Run

### 10.5 — Vérifier ces points sur mobile

- [ ] Connexion Google fonctionne (test avec vrai compte)
- [ ] Connexion email/password fonctionne
- [ ] Navigation entre pages fonctionne
- [ ] Bouton retour Android se comporte correctement
- [ ] Les safe areas iOS ne cassent rien sur Android (elles sont ignorées)
- [ ] Le tableau classement est scrollable
- [ ] Les modals s'affichent correctement
- [ ] Le keyboard ne cache pas les inputs

---

## ÉTAPE 11 — Soumettre sur le Play Store

### 11.1 — Créer la clé de signature release

```bash
keytool -genkey -v -keystore impactrating-release.keystore \
  -alias impactrating -keyalg RSA -keysize 2048 -validity 10000
```

**⚠️ Garder ce fichier en lieu sûr. Si perdu, impossible de mettre à jour l'app.**

### 11.2 — Configurer la signature dans Android Studio

Dans `android/app/build.gradle`, ajouter :

```gradle
android {
  ...
  signingConfigs {
    release {
      storeFile file('../impactrating-release.keystore')
      storePassword 'TON_MOT_DE_PASSE'
      keyAlias 'impactrating'
      keyPassword 'TON_MOT_DE_PASSE'
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled false
    }
  }
}
```

### 11.3 — Générer l'APK / AAB release

Dans Android Studio : `Build > Generate Signed Bundle/APK`
Choisir **Android App Bundle (.aab)** (recommandé par Google).

### 11.4 — Créer la fiche Play Store

Sur [play.google.com/console](https://play.google.com/console) :

1. **Créer une application**
2. Remplir les métadonnées :
   - Titre : `Impact Rating - Football`
   - Description courte (80 chars)
   - Description longue (4000 chars)
   - Catégorie : `Sports`
   - Email de contact
   - URL politique de confidentialité : `https://foot-4f0c2.web.app/privacy`
3. Ajouter les **captures d'écran** :
   - Téléphone : minimum 2, format 16:9 ou 9:16
   - Taille min 320px, max 3840px
4. Ajouter l'**icône** 512×512 PNG
5. Ajouter le **feature graphic** 1024×500

### 11.5 — Uploader l'AAB et soumettre

1. `Production > Créer une version`
2. Uploader le fichier `.aab`
3. Ajouter les notes de version
4. `Enregistrer > Vérifier la version > Commencer le déploiement`

Délai de review : **3 à 7 jours** pour la première soumission.

---

## ÉTAPE 12 — (Sur Mac) Installer les outils iOS

### 12.1 — Prérequis Mac

- macOS Ventura 13+ recommandé
- Xcode 15+ (App Store gratuit, ~15 Go)
- Xcode Command Line Tools :
  ```bash
  xcode-select --install
  ```
- CocoaPods :
  ```bash
  sudo gem install cocoapods
  ```

### 12.2 — Transférer le projet sur le Mac

Soit :
- Via Git : `git clone` depuis ton repo GitHub
- Via clé USB / AirDrop

### 12.3 — Installer les dépendances et ajouter iOS

```bash
npm install
npx cap add ios
npm run build
npx cap sync
```

### 12.4 — Placer GoogleService-Info.plist

1. Télécharger depuis Firebase Console (App iOS créée à l'étape 5)
2. Placer dans : `ios/App/App/GoogleService-Info.plist`
3. Dans Xcode, vérifier qu'il est dans le target `App`

### 12.5 — Configurer le Bundle ID dans Xcode

```bash
npx cap open ios
```

Dans Xcode :
1. Sélectionner le projet `App` dans le navigator
2. `Signing & Capabilities` > Team : sélectionner ton compte Apple Developer
3. Bundle Identifier : `com.impactrating.app`

### 12.6 — Tester sur simulateur iOS

Dans Xcode, sélectionner un simulateur (ex: iPhone 15) et cliquer Run.

### 12.7 — Tester sur appareil réel

1. Brancher l'iPhone en USB
2. Sur l'iPhone : faire confiance à l'ordinateur
3. Dans Xcode, sélectionner le device et Run
4. Aller dans `Réglages > Général > VPN et gestion de l'appareil` → faire confiance au profil de développeur

---

## ÉTAPE 13 — Soumettre sur l'App Store

### 13.1 — Créer l'app dans App Store Connect

Aller sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com) :
1. `Mes apps > + > Nouvelle app`
2. Plateforme : iOS
3. Nom : `Impact Rating`
4. Bundle ID : `com.impactrating.app`
5. SKU : `impactrating001`
6. Accès : `Accès complet`

### 13.2 — Remplir les métadonnées

- Description (4000 chars)
- Mots-clés (100 chars max, séparés par virgules)
- Catégorie principale : `Sports`
- Catégorie secondaire : `Social`
- URL de confidentialité : `https://foot-4f0c2.web.app/privacy`
- Email de support
- **Classement d'âge** : remplir le questionnaire (probablement 4+)

### 13.3 — Captures d'écran requises

| Device | Taille |
|--------|--------|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320×2868 px |
| iPhone 6.5" (iPhone 11 Pro Max) | 1242×2688 px |
| iPad Pro 12.9" (si tu supportes iPad) | 2048×2732 px |

Générer via le simulateur Xcode : `File > Export Screenshot`

### 13.4 — Créer l'archive et uploader

Dans Xcode :
1. `Product > Archive`
2. Une fois l'archive créée, `Distribute App`
3. Choisir `App Store Connect`
4. Suivre l'assistant → Upload

### 13.5 — Soumettre pour review

Dans App Store Connect :
1. Sélectionner le build uploadé
2. Remplir les informations de review (compte de démo si besoin)
3. `Ajouter à la review` → `Soumettre pour review`

Délai de review Apple : **1 à 14 jours**, généralement 24-48h.

### 13.6 — Points que Apple vérifie spécifiquement

- La politique de confidentialité doit être accessible **sans être connecté**
- Tous les liens dans l'app qui ouvrent un navigateur externe doivent utiliser `SFSafariViewController` (plugin `@capacitor/browser`) — pas de `window.open()` brut
- L'app doit fonctionner même sans connexion Internet (au moins afficher un message d'erreur propre)
- Le flux Google Sign-In doit utiliser le système natif (étape 3 obligatoire)

---

## Récapitulatif des fichiers modifiés / créés

| Fichier | Action | Étape |
|---------|--------|-------|
| `js/firebase-config.js` | Imports CDN → npm | 2.4 |
| `js/auth.js` | `signInWithPopup` → `signInWithCredential` | 3.2 |
| `login.html` | Même remplacement + lien privacy | 3.2 / 8.3 |
| `index.html` | Lien privacy + viewport-fit | 6.1 / 8.3 |
| `profil.html` | viewport-fit | 6.1 |
| `groupe.html` | viewport-fit | 6.1 |
| `admin-groupe.html` | viewport-fit | 6.1 |
| `css/groupe.css` | Safe areas + table scroll | 6.1 / 6.2 |
| `css/profil.css` | Safe areas | 6.1 |
| `css/auth.css` | Safe areas + font-size 16px | 6.1 / 6.3 |
| `css/landing.css` | Safe areas | 6.1 |
| `firebase.json` | `public: "www"` | 2.8 |
| `functions/index.js` | Ajout envoi notifications FCM | 9.4 |
| `firestore.rules` | Autoriser champ fcmToken | 9.5 |
| `vite.config.js` | **Nouveau** | 2.3 |
| `capacitor.config.ts` | **Nouveau** | 4.3 |
| `privacy.html` | **Nouveau** | 8.2 |
| `assets/icon.png` | **Nouveau** (1024×1024) | 7.2 |
| `assets/splash.png` | **Nouveau** (2732×2732) | 7.2 |
| `android/` | **Nouveau** (généré Capacitor) | 4.4 |
| `ios/` | **Nouveau** (généré Capacitor, sur Mac) | 12.3 |
| `android/app/google-services.json` | **Nouveau** (depuis Firebase) | 5.1 |
| `ios/App/App/GoogleService-Info.plist` | **Nouveau** (depuis Firebase, sur Mac) | 5.1 |
| `package.json` | **Nouveau** | 2.1 |
| Fichiers orphelins JS/CSS | **Supprimer** | 1 |

---

## Commandes de référence rapide

```bash
# Dev web
npm run dev

# Build
npm run build
npx cap sync

# Android
npx cap open android

# iOS (Mac uniquement)
npx cap open ios

# Générer les icônes/splash
npx capacitor-assets generate

# Déployer Firebase Hosting
firebase deploy --only hosting

# Déployer les Functions
firebase deploy --only functions
```

---

## Checklist finale avant soumission

### Les deux stores
- [ ] Étape 1 : code mort supprimé
- [ ] Étape 2 : Vite fonctionne, `npm run build` produit un `www/` correct
- [ ] Étape 3 : Google Sign-In fonctionne dans l'app native (test réel)
- [ ] Étape 4 : Capacitor configuré, `npx cap sync` sans erreur
- [ ] Étape 5 : `google-services.json` présent dans `android/app/`
- [ ] Étape 6 : Safe areas ajoutées, tableau classement scrollable
- [ ] Étape 7 : Icône 1024×1024 et splash 2732×2732 créés et générés
- [ ] Étape 8 : Page `/privacy` accessible en ligne sans être connecté
- [ ] Étape 9 : Notifications push testées (facultatif pour première soumission)

### Play Store uniquement
- [ ] Clé de signature release créée et sauvegardée
- [ ] SHA-1 release ajouté dans Firebase Console
- [ ] AAB signé généré
- [ ] Captures d'écran (min 2, format correct)
- [ ] Icône 512×512 et feature graphic 1024×500
- [ ] Description en français (et anglais si voulu)

### App Store uniquement (sur Mac)
- [ ] `GoogleService-Info.plist` présent dans `ios/App/App/`
- [ ] Bundle ID identique dans Xcode et Firebase Console
- [ ] Compte Apple Developer actif et payé
- [ ] Captures d'écran iPhone 6.9" et 6.5"
- [ ] Classement d'âge rempli
- [ ] Tous les liens externes via `@capacitor/browser`
