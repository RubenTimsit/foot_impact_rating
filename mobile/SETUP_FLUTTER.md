# Setup Flutter — Impact Rating Mobile

## Ce que j'ai fait (code déjà écrit)
- ✅ Toute la structure Flutter (`lib/`)
- ✅ Tous les écrans (login, home, groupe, admin, super-admin)
- ✅ Système ELO porté en Dart (identique au JavaScript)
- ✅ Système de synergies porté en Dart
- ✅ Providers Riverpod (temps réel Firestore)
- ✅ Navigation GoRouter avec auth redirect
- ✅ Thème sombre custom (vert football + or)

## Ce que TU dois faire

---

### ÉTAPE 1 — Installer Flutter SDK

1. Aller sur https://docs.flutter.dev/get-started/install/windows/mobile
2. Télécharger Flutter SDK et extraire dans `C:\src\flutter`
3. Ajouter `C:\src\flutter\bin` au PATH Windows
4. Vérifier : ouvrir un terminal et taper :
   ```
   flutter doctor
   ```
5. Corriger les warnings indiqués (principalement Android SDK et licences)

---

### ÉTAPE 2 — Initialiser le projet Flutter

Ouvrir un terminal dans le dossier `mobile/` :

```bash
cd C:\Users\ruben\Desktop\foot\mobile

# Générer les fichiers Android/iOS de base
# IMPORTANT : cela ne supprime PAS les fichiers lib/ déjà écrits
flutter create . --project-name impact_rating --org com.impactrating

# Installer les dépendances
flutter pub get
```

---

### ÉTAPE 3 — Configurer Firebase pour Android

#### 3.1 — Installer la CLI Firebase et FlutterFire

```bash
# Installer Firebase CLI (si pas déjà fait)
npm install -g firebase-tools
firebase login

# Installer FlutterFire CLI
dart pub global activate flutterfire_cli
```

#### 3.2 — Générer firebase_options.dart

```bash
# Depuis le dossier mobile/
flutterfire configure --project=foot-4f0c2
```

Cette commande va :
- Te demander quelles plateformes configurer (choisir Android + Web, iOS plus tard)
- Créer automatiquement l'app Android dans Firebase Console
- Télécharger `google-services.json` et le placer au bon endroit
- **Réécrire** `lib/firebase_options.dart` avec les vraies valeurs

---

### ÉTAPE 4 — Configurer Google Sign-In pour Android

#### 4.1 — Récupérer le SHA-1 de debug

```bash
cd android
.\gradlew signingReport
```

Copier le SHA-1 affiché sous `Variant: debugAndroidTest`.

#### 4.2 — Ajouter le SHA-1 dans Firebase Console

`Firebase Console → foot-4f0c2 → Paramètres du projet → Ton app Android`
→ Ajouter l'empreinte → Coller le SHA-1 → Enregistrer

#### 4.3 — Retélécharger google-services.json

Après avoir ajouté le SHA-1, retélécharger `google-services.json` et remplacer :
```
android/app/google-services.json
```

#### 4.4 — Activer Google Sign-In dans Firebase Auth

`Firebase Console → Authentication → Sign-in method → Google → Activer`

---

### ÉTAPE 5 — Ajouter l'index Firestore manquant

L'app utilise une Collection Group Query sur `joueurs` pour lister les groupes de l'utilisateur.
Ajouter cet index dans `firestore.indexes.json` et déployer :

```json
{
  "collectionGroup": "joueurs",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" }
  ]
}
```

```bash
firebase deploy --only firestore:indexes
```

---

### ÉTAPE 6 — Lancer sur l'émulateur Android

```bash
# Depuis mobile/
flutter run
```

Android Studio doit avoir un émulateur démarré (API 34+).

Ou via Android Studio :
1. `File → Open → C:\Users\ruben\Desktop\foot\mobile`
2. Attendre que Gradle sync se termine (~5 min la première fois)
3. Sélectionner l'émulateur dans la liste déroulante → Run

---

### ÉTAPE 7 — Activer la localisation française (dates)

Dans `pubspec.yaml`, ajouter sous `flutter:` :

```yaml
flutter:
  generate: true
```

Et créer `l10n.yaml` à la racine de `mobile/` :

```yaml
arb-dir: lib/l10n
template-arb-file: app_fr.arb
output-localization-file: app_localizations.dart
```

Puis dans `main.dart` ajouter les locales Material :
```dart
localizationsDelegates: const [
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
],
supportedLocales: const [Locale('fr', 'FR'), Locale('en', 'US')],
```

Et ajouter `flutter_localizations` dans `pubspec.yaml` :
```yaml
dependencies:
  flutter_localizations:
    sdk: flutter
```

---

### ÉTAPE 8 — Build APK de debug pour test sur vrai téléphone

```bash
flutter build apk --debug
```

Le fichier APK est dans :
```
mobile/build/app/outputs/flutter-apk/app-debug.apk
```

Transfère-le sur ton Android et installe-le.

---

### ÉTAPE 9 — Build release pour le Play Store

#### 9.1 — Créer la clé de signature

```bash
keytool -genkey -v -keystore release.keystore -alias impactrating -keyalg RSA -keysize 2048 -validity 10000
```

Garder ce fichier en lieu sûr (ne pas committer sur Git !).

#### 9.2 — Configurer la signature

Créer `android/key.properties` :
```properties
storePassword=TON_MOT_DE_PASSE
keyPassword=TON_MOT_DE_PASSE
keyAlias=impactrating
storeFile=../../release.keystore
```

Modifier `android/app/build.gradle` :

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### 9.3 — Ajouter le SHA-1 de release dans Firebase

```bash
keytool -list -v -keystore release.keystore -alias impactrating
```

Ajouter ce SHA-1 dans Firebase Console (même endroit que le SHA-1 debug).
Retélécharger `google-services.json`.

#### 9.4 — Générer l'AAB

```bash
flutter build appbundle --release
```

Fichier généré :
```
mobile/build/app/outputs/bundle/release/app-release.aab
```

---

### ÉTAPE 10 — iOS (sur Mac plus tard)

Quand tu as le Mac :

```bash
# Ajouter iOS à la config Firebase
flutterfire configure --project=foot-4f0c2

# Ouvrir dans Xcode
flutter build ios
open ios/Runner.xcworkspace
```

Dans Xcode : `Signing & Capabilities → Team → ton compte Apple Developer`

---

## Ajouter au .gitignore

```
# Flutter secrets — ne JAMAIS committer
mobile/android/key.properties
mobile/release.keystore
mobile/android/app/google-services.json
mobile/ios/Runner/GoogleService-Info.plist
```

---

## Résumé des commandes du quotidien

```bash
# Développement
flutter run

# Hot reload (pendant flutter run)
r    # hot reload
R    # hot restart
q    # quitter

# Build
flutter build apk --debug        # APK debug
flutter build apk --release      # APK release signé
flutter build appbundle --release # AAB pour Play Store

# Dépendances
flutter pub get
flutter pub upgrade

# Analyser le code
flutter analyze
```
