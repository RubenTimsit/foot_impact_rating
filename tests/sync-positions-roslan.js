'use strict';

/**
 * sync-positions-roslan.js
 *
 * Met à jour displayName, position + profilMilieu de chaque joueur du groupe "ROSLAN FC"
 * en fonction de ce qui est enregistré dans leur profil utilisateur (users/{uid}).
 *
 * Usage :
 *   cd tests
 *   node sync-positions-roslan.js           # applique les changements
 *   node sync-positions-roslan.js --dry-run # simule sans écrire
 *
 * Prérequis : tests/serviceAccountKey.json (clé de service Firebase)
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Init Firebase ─────────────────────────────────────────────
const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(KEY_PATH)) {
  console.error(`
❌  Clé de service manquante !

  1. Va sur https://console.firebase.google.com → Paramètres → Comptes de service
  2. Clique "Générer une nouvelle clé privée"
  3. Enregistre le fichier ici : tests/serviceAccountKey.json
`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});

const db = admin.firestore();

// ── Script principal ──────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('🧪  MODE DRY-RUN — aucune écriture ne sera effectuée\n');
  }

  console.log('🔍  Recherche du groupe "ROSLAN FC"...\n');

  // 1. Trouver le groupe ROSLAN FC
  const groupesSnap = await db.collection('groupes')
    .where('nom', '==', 'ROSLAN FC')
    .get();

  if (groupesSnap.empty) {
    console.error('❌  Groupe "ROSLAN FC" introuvable. Vérifie le nom exact dans Firestore.');
    process.exit(1);
  }

  const groupeDoc = groupesSnap.docs[0];
  const groupeId  = groupeDoc.id;
  console.log(`✅  Groupe trouvé : ${groupeDoc.data().nom} (id: ${groupeId})\n`);

  // 2. Charger tous les joueurs du groupe
  const joueursSnap = await db
    .collection('groupes').doc(groupeId)
    .collection('joueurs').get();

  console.log(`👥  ${joueursSnap.size} joueur(s) dans le groupe\n`);

  let updated = 0;
  let skipped = 0;
  let noProfile = 0;

  const batch = db.batch();

  for (const joueurDoc of joueursSnap.docs) {
    const joueur = joueurDoc.data();
    const uid    = joueurDoc.id;

    // 3. Lire le profil utilisateur
    const profilSnap = await db.collection('users').doc(uid).get();

    if (!profilSnap.exists) {
      console.log(`  ⚠️  ${joueur.displayName || uid} — aucun profil utilisateur trouvé, ignoré`);
      noProfile++;
      continue;
    }

    const profil = profilSnap.data();
    const profilNom         = profil.displayName  || null;
    const profilPosition    = profil.position     || null;
    const profilMilieu      = profil.profilMilieu || null;
    const joueurNom         = joueur.displayName  || null;
    const joueurPosition    = joueur.position     || null;
    const joueurMilieu      = joueur.profilMilieu || null;

    // 4. Comparer et mettre à jour si différent
    const nomChange      = profilNom      && profilNom      !== joueurNom;
    const positionChange = profilPosition && profilPosition !== joueurPosition;
    const milieuChange   = profilMilieu   !== joueurMilieu;

    if (nomChange || positionChange || milieuChange) {
      const updates = {};
      if (nomChange)      updates.displayName  = profilNom;
      if (profilPosition) updates.position     = profilPosition;
      updates.profilMilieu = profilMilieu;

      batch.update(joueurDoc.ref, updates);

      console.log(`  ✏️  ${joueurNom || uid}`);
      if (nomChange)      console.log(`       displayName : "${joueurNom}" → "${profilNom}"`);
      if (positionChange) console.log(`       position    : "${joueurPosition}" → "${profilPosition}"`);
      if (milieuChange)   console.log(`       profilMilieu: "${joueurMilieu}" → "${profilMilieu}"`);
      updated++;
    } else {
      console.log(`  ✓   ${joueurNom || uid} — déjà à jour (${joueurPosition || '—'})`);
      skipped++;
    }
  }

  // 5. Écrire le batch (sauf en dry-run)
  if (updated > 0) {
    if (dryRun) {
      console.log(`\n🧪  Dry-run : ${updated} mise(s) à jour simulée(s), rien n'a été écrit.`);
    } else {
      console.log(`\n⏳  Écriture du batch (${updated} mise(s) à jour)...`);
      await batch.commit();
      console.log('✅  Batch committé avec succès !');
    }
  } else {
    console.log('\n✅  Aucune mise à jour nécessaire, tout est déjà synchronisé.');
  }

  console.log(`
── Résumé ${dryRun ? '(DRY-RUN) ' : ''}──────────────────────
  Mis à jour  : ${updated}${dryRun ? ' (simulé)' : ''}
  Déjà à jour : ${skipped}
  Sans profil : ${noProfile}
───────────────────────────────────`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌  Erreur :', err);
  process.exit(1);
});
