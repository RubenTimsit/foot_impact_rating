'use strict';

/**
 * broadcast-notif.js — Envoie une notification push à tous les utilisateurs
 *
 * Usage :
 *   1. Télécharge la clé de service Firebase si ce n'est pas déjà fait :
 *      Console Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée
 *      Enregistre le fichier sous : tests/serviceAccountKey.json
 *
 *   2. Personnalise le titre et le message ci-dessous (TITLE / BODY).
 *
 *   3. Lance le script :
 *      cd tests
 *      node broadcast-notif.js
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Config ────────────────────────────────────────────────────
const PROJECT_ID = 'foot-4f0c2';
const APP_URL    = 'https://foot-4f0c2.web.app/app';

const TITLE = '🎉 Bienvenue sur notre nouvelle app !';
const BODY  = 'Les notifications push sont maintenant disponibles. Tu seras alerté pour les matchs, la liste d\'attente et les résultats MOM.';
const URL   = APP_URL;
// ─────────────────────────────────────────────────────────────

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
    console.error('\n❌  Clé de service introuvable : tests/serviceAccountKey.json');
    console.error('   Génère-la depuis : Console Firebase → Paramètres du projet → Comptes de service\n');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
    projectId: PROJECT_ID,
});

const db        = admin.firestore();
const messaging = admin.messaging();

async function run() {
    console.log('\n📡  Récupération des tokens FCM...');
    const usersSnap = await db.collection('users').get();

    const tokenMap = {};
    usersSnap.docs.forEach(doc => {
        const tokens = doc.data().fcmTokens || [];
        tokens.forEach(token => { tokenMap[token] = doc.id; });
    });

    const tokens = Object.keys(tokenMap);
    const userCount = new Set(Object.values(tokenMap)).size;

    if (tokens.length === 0) {
        console.log('⚠️  Aucun token FCM trouvé. Personne n\'a encore activé les notifications.');
        process.exit(0);
    }

    console.log(`✅  ${tokens.length} token(s) pour ${userCount} utilisateur(s)\n`);
    console.log(`📨  Titre  : ${TITLE}`);
    console.log(`    Corps  : ${BODY}`);
    console.log(`    Lien   : ${URL}\n`);

    let totalSuccess = 0;
    let totalFail    = 0;
    const invalidTokens = [];

    // FCM limite à 500 tokens par appel
    for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const response = await messaging.sendEachForMulticast({
            tokens: batch,
            data: { title: TITLE, body: BODY, url: URL },
            webpush: { headers: { Urgency: 'high', TTL: '86400' } },
            android: { priority: 'high' },
        });

        totalSuccess += response.successCount;
        totalFail    += response.failureCount;

        response.responses.forEach((r, idx) => {
            if (!r.success) {
                const code = r.error?.code || '';
                if (
                    code === 'messaging/invalid-registration-token' ||
                    code === 'messaging/registration-token-not-registered'
                ) {
                    invalidTokens.push({ token: batch[idx], uid: tokenMap[batch[idx]] });
                }
            }
        });
    }

    console.log(`✅  ${totalSuccess} notification(s) envoyée(s)`);
    if (totalFail > 0) console.log(`⚠️  ${totalFail} échec(s)`);

    // Nettoyer les tokens invalides de Firestore
    if (invalidTokens.length > 0) {
        console.log(`\n🧹  Suppression de ${invalidTokens.length} token(s) invalide(s)...`);
        const batche = db.batch();
        invalidTokens.forEach(({ token, uid }) => {
            batche.update(db.collection('users').doc(uid), {
                fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
            });
        });
        await batche.commit();
        console.log('   ✓ Tokens nettoyés.');
    }

    console.log('\n🏁  Terminé.\n');
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌  Erreur :', err.message);
    process.exit(1);
});
