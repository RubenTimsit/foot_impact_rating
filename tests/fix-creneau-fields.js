'use strict';

/**
 * fix-creneau-fields.js
 *
 * Corrige les créneaux créés par la Cloud Function avant le fix :
 *  - Ajoute heureMatch, heureOuverture, sourceHebdo si manquants
 *  - Remplace createdAt par dateCreation (timestamp serveur)
 *  - Récupère les bonnes valeurs depuis la config hebdo du groupe
 *
 * Usage :
 *   cd tests
 *   node fix-creneau-fields.js --groupeId=ID_DU_GROUPE
 *   node fix-creneau-fields.js --groupeId=ID_DU_GROUPE --dry-run
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!process.env.FIRESTORE_EMULATOR_HOST && !fs.existsSync(KEY_PATH)) {
  console.error('❌ Clé de service manquante : tests/serviceAccountKey.json');
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST
      ? { projectId: 'foot-4f0c2' }
      : { credential: admin.credential.cert(require(KEY_PATH)) }
  );
}
const db      = admin.firestore;
const dbInst  = admin.firestore();

const args   = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const DRY    = 'dry-run' in args;

if (!args.groupeId) {
  console.error('Usage: node fix-creneau-fields.js --groupeId=ID [--dry-run]');
  process.exit(1);
}
const { groupeId } = args;

async function main() {
  // 1. Lire la config du groupe pour récupérer heureMatch / heureOuverture par sourceHebdo
  const groupeSnap = await dbInst.collection('groupes').doc(groupeId).get();
  if (!groupeSnap.exists) { console.error('❌ Groupe introuvable'); process.exit(1); }
  const groupeData = groupeSnap.data();

  // Construire un map sourceHebdo → config
  const configMap = {};
  if (groupeData.configHebdos) {
    for (const [id, cfg] of Object.entries(groupeData.configHebdos)) {
      configMap[id] = cfg;
    }
  }

  // 2. Chercher les créneaux avec statut programmé ou ouvert qui n'ont pas heureMatch
  const snap = await dbInst
    .collection('groupes').doc(groupeId)
    .collection('matchs_semaine')
    .where('statut', 'in', ['programmé', 'ouvert'])
    .get();

  const toFix = snap.docs.filter(d => {
    const data = d.data();
    return !data.heureMatch; // manque heureMatch
  });

  if (toFix.length === 0) {
    console.log('✅ Aucun créneau à corriger.');
    return;
  }

  console.log(`\n${DRY ? '[DRY-RUN] ' : ''}${toFix.length} créneau(x) à corriger :\n`);

  for (const doc of toFix) {
    const data    = doc.data();
    const docId   = doc.id;
    const hebdoId = data.sourceHebdo;
    const cfg     = hebdoId ? configMap[hebdoId] : null;

    const heureMatch     = cfg?.heure         ?? cfg?.matchHeure    ?? '20:30';
    const heureOuverture = cfg?.heureOuverture ?? '22:00';
    const sourceHebdo    = hebdoId ?? null;

    const patch = {
      heureMatch,
      heureOuverture,
    };

    // Si createdAt existe et dateCreation manque → migrer
    if (data.createdAt && !data.dateCreation) {
      patch.dateCreation = db.FieldValue.serverTimestamp();
    }

    // Si sourceHebdo manque mais qu'on peut le déduire depuis sousGroupesCibles
    if (!data.sourceHebdo) {
      // Essayer de matcher par sousGroupesCibles
      if (data.sousGroupesCibles && data.sousGroupesCibles.length) {
        const cible = data.sousGroupesCibles[0];
        const matchedCfg = Object.entries(configMap).find(([, c]) =>
          c.sousGroupesCibles && c.sousGroupesCibles[0] === cible
        );
        if (matchedCfg) {
          patch.sourceHebdo = matchedCfg[0];
          // Recalculer heureMatch avec la vraie config
          patch.heureMatch     = matchedCfg[1].heure         ?? patch.heureMatch;
          patch.heureOuverture = matchedCfg[1].heureOuverture ?? patch.heureOuverture;
        }
      }
    }

    console.log(`  📄 ${docId}`);
    console.log(`     dateMatch          : ${data.dateMatch}`);
    console.log(`     sousGroupesCibles  : ${JSON.stringify(data.sousGroupesCibles)}`);
    console.log(`     patch              :`, patch);

    if (!DRY) {
      await doc.ref.update(patch);
      console.log(`     ✅ Mis à jour`);
    }
  }

  if (DRY) {
    console.log('\n[DRY-RUN] Aucune écriture. Relance sans --dry-run pour appliquer.');
  } else {
    console.log(`\n✅ ${toFix.length} créneau(x) corrigé(s).`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
