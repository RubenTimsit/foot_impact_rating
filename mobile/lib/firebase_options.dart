// ⚠️  CE FICHIER DOIT ÊTRE REGÉNÉRÉ avec : flutterfire configure
// Voir SETUP_FLUTTER.md étape 4 pour les instructions complètes.
//
// Les valeurs ci-dessous sont les valeurs WEB uniquement.
// Les valeurs Android et iOS seront générées automatiquement par flutterfire.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  // Valeurs web tirées de js/firebase-config.js — OK pour tous les environnements
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAQtM3hdFqgyRW8uhq5Vhs_yis3UyD3VE4',
    appId: '1:285043352720:web:b583cf40d418d3f4ffe415',
    messagingSenderId: '285043352720',
    projectId: 'foot-4f0c2',
    authDomain: 'foot-4f0c2.firebaseapp.com',
    storageBucket: 'foot-4f0c2.firebasestorage.app',
  );

  // ⚠️  REMPLACER par les vraies valeurs générées par : flutterfire configure
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'REMPLACER_APRES_flutterfire_configure',
    appId: 'REMPLACER_APRES_flutterfire_configure',
    messagingSenderId: '285043352720',
    projectId: 'foot-4f0c2',
    storageBucket: 'foot-4f0c2.firebasestorage.app',
  );

  // ⚠️  REMPLACER par les vraies valeurs générées par : flutterfire configure (sur Mac)
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'REMPLACER_APRES_flutterfire_configure',
    appId: 'REMPLACER_APRES_flutterfire_configure',
    messagingSenderId: '285043352720',
    projectId: 'foot-4f0c2',
    storageBucket: 'foot-4f0c2.firebasestorage.app',
    iosBundleId: 'com.impactrating.app',
  );
}
