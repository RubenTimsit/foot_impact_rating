'use strict';

/**
 * migrate-matchs-potentiels.js
 *
 * Calcule et écrit le champ matchsPotentiels sur chaque joueur actif,
 * en comptant le nombre de matchs validés auxquels ce joueur était éligible
 * (selon les sousGroupesCibles de chaque match).
 *
 * Usage :
 *   cd tests
 *   node migrate-matchs-potentiels.js --groupeId=ID_DU_GROUPE
 *   node migrate-matchs-potentiels.js --groupeId=ID_DU_GROUPE --dry-run
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
const db = admin.firestore();

const args   = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const DRY    = 'dry-run' in args;

if (!args.groupeId) {
  console.error('Usage: node migrate-matchs-potentiels.js --groupeId=ID [--dry-run]');
  process.exit(1);
}
const { groupeId } = args;

async function main() {
  console.log(`\n🔄  Migration matchsPotentiels — groupe : ${groupeId}`);
  if (DRY) console.log('   (DRY-RUN — aucune écriture)\n');

  // 1. Charger tous les joueurs actifs
  const joueursSnap = await db.collection('groupes').doc(groupeId).collection('joueurs').get();
  const joueurs = joueursSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(j => j.statut === 'active');

  console.log(`👥  ${joueurs.length} joueur(s) actif(s)\n`);

  // Initialiser les compteurs
  const compteurs = {};
  joueurs.forEach(j => { compteurs[j.id] = 0; });

  // 2. Charger tous les matchs validés
  const matchsSnap = await db
    .collection('groupes').doc(groupeId)
    .collection('matchs')
    .where('statut', '==', 'joue')
    .get();

  console.log(`⚽  ${matchsSnap.size} match(s) joué(s) trouvé(s)\n`);

  for (const matchDoc of matchsSnap.docs) {
    const m      = matchDoc.data();
    const cibles = m.sousGroupesCibles && m.sousGroupesCibles.length ? m.sousGroupesCibles : null;

    const eligibles = joueurs.filter(j => {
      if (!cibles) return true;
      return cibles.includes(j.sousGroupe);
    });

    const label = cibles ? `div [${cibles.join(',')}]` : 'tous';
    console.log(`  📄 ${matchDoc.id}  →  ${eligibles.length} éligibles (${label})`);

    eligibles.forEach(j => { compteurs[j.id]++; });
  }

  // 3. Afficher le résultat
  console.log('\n📊  Résultat par joueur :');
  joueurs.forEach(j => {
    const potentiel = compteurs[j.id];
    const joues     = j.matchsJoues || 0;
    const pct       = potentiel > 0 ? Math.round(joues / potentiel * 100) : 0;
    const actuel    = j.matchsPotentiels ?? '—';
    console.log(`   ${(j.displayName || j.id).padEnd(24)}  matchsPotentiels: ${actuel} → ${potentiel}  (${joues}/${potentiel} = ${pct}%)`);
  });

  if (DRY) {
    console.log('\n[DRY-RUN] Aucune écriture. Relance sans --dry-run pour appliquer.\n');
    return;
  }

  // 4. Écrire en batch
  console.log('\n✍️   Écriture...');
  const BATCH_SIZE = 499;
  let batch = db.batch();
  let count = 0;

  for (const j of joueurs) {
    const ref = db.collection('groupes').doc(groupeId).collection('joueurs').doc(j.id);
    batch.update(ref, { matchsPotentiels: compteurs[j.id] });
    count++;
    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % BATCH_SIZE !== 0) await batch.commit();

  console.log(`✅  ${joueurs.length} joueur(s) mis à jour.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
