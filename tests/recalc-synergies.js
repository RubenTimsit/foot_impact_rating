'use strict';

/**
 * recalc-synergies.js — Recalcule toutes les synergies depuis les matchs existants
 *
 * Ce script :
 *  1. Supprime toutes les synergies existantes (y compris les données garbage)
 *  2. Relit tous les matchs validés (statut: 'joue') du groupe
 *  3. Recalcule les synergies pour chaque match/sous-match
 *  4. Écrit les synergies recalculées dans Firestore
 *
 * Usage :
 *   cd tests
 *   node recalc-synergies.js --groupeId=<ID_DU_GROUPE>
 *
 *   Dry-run (affiche sans écrire) :
 *   node recalc-synergies.js --groupeId=<ID_DU_GROUPE> --dry-run
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Init Firebase ─────────────────────────────────────────────
const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

if (!process.env.FIRESTORE_EMULATOR_HOST && !fs.existsSync(KEY_PATH)) {
  console.error(`
❌  Clé de service manquante !
  1. Va sur https://console.firebase.google.com/project/foot-4f0c2/settings/serviceaccounts/adminsdk
  2. Clique "Générer une nouvelle clé privée"
  3. Enregistre le fichier ici : tests/serviceAccountKey.json
`);
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

// ── Args ──────────────────────────────────────────────────────
const args    = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const DRY_RUN = 'dry-run' in args;
const GROUPE_ID = args.groupeId;

if (!GROUPE_ID) {
  console.error('❌  Précise le groupe : node recalc-synergies.js --groupeId=<ID>');
  process.exit(1);
}

// ── Synergie helpers (copie allégée de synergy-system.js) ─────
// Doit rester synchronisé avec js/synergy-system.js
const WIN_BONUS    = 2;
const LOSS_PENALTY = 1.5;
const DIFF_FACTOR  = 0.1;

function toId(j) { return typeof j === 'string' ? j : j?.id; }

function mettreAJourSynergiesEquipe(synMap, equipe, resultat, scoreDiff = 0, poids = 1) {
  const ids = (equipe || []).map(toId).filter(Boolean);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const cle = [ids[i], ids[j]].sort().join('-');
      if (!synMap[cle]) {
        synMap[cle] = {
          joueur1: [ids[i], ids[j]].sort()[0],
          joueur2: [ids[i], ids[j]].sort()[1],
          valeur: 0, matchsEnsemble: 0,
          victoires: 0, nuls: 0, defaites: 0,
        };
      }
      const s = synMap[cle];
      s.matchsEnsemble = Math.round((s.matchsEnsemble + poids) * 100) / 100;
      if (resultat === 'victoire') {
        s.victoires += 1;
        s.valeur += (WIN_BONUS + scoreDiff * DIFF_FACTOR) * poids;
      } else if (resultat === 'nul') {
        s.nuls += 1;
      } else {
        s.defaites += 1;
        s.valeur -= (LOSS_PENALTY + scoreDiff * DIFF_FACTOR) * poids;
      }
      s.valeur = Math.round(s.valeur * 100) / 100;
    }
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔄  Recalcul synergies pour le groupe : ${GROUPE_ID}`);
  if (DRY_RUN) console.log('   (DRY-RUN — aucune écriture)\n');

  // 1. Lire tous les matchs validés
  const matchsSnap = await db
    .collection('groupes').doc(GROUPE_ID)
    .collection('matchs')
    .where('statut', '==', 'joue')
    .orderBy('dateCreation', 'asc')
    .get();

  console.log(`📋  ${matchsSnap.size} match(s) trouvé(s)\n`);

  if (!matchsSnap.size) {
    console.log('Aucun match joué trouvé. Rien à faire.');
    return;
  }

  // 2. Recalculer toutes les synergies depuis zéro
  const synMap = {};

  for (const doc of matchsSnap.docs) {
    const m = doc.data();
    const isSoiree = m.type === 'soiree' && Array.isArray(m.sousMatchs);

    if (isSoiree) {
      console.log(`  ⚽ Soirée  ${doc.id} — ${m.sousMatchs.length} sous-match(s)`);
      for (let i = 0; i < m.sousMatchs.length; i++) {
        const sm   = m.sousMatchs[i];
        const eqA  = (sm.equipeA || []).map(toId).filter(Boolean);
        const eqB  = (sm.equipeB || []).map(toId).filter(Boolean);
        const sA   = sm.scoreA ?? 0;
        const sB   = sm.scoreB ?? 0;
        const diff = Math.abs(sA - sB);
        const poids = sm.poids ?? 1;
        const resA = sA > sB ? 'victoire' : sB > sA ? 'defaite' : 'nul';
        const resB = sB > sA ? 'victoire' : sA > sB ? 'defaite' : 'nul';
        console.log(`     SM${i+1} : A(${eqA.length}) ${sA}–${sB} B(${eqB.length}) poids=${poids}`);
        mettreAJourSynergiesEquipe(synMap, eqA, resA, diff, poids);
        mettreAJourSynergiesEquipe(synMap, eqB, resB, diff, poids);
      }
    } else {
      const eqA  = (m.equipeA || []).map(toId).filter(Boolean);
      const eqB  = (m.equipeB || []).map(toId).filter(Boolean);
      const sA   = m.scoreA ?? m.scoreEquipeA ?? 0;
      const sB   = m.scoreB ?? m.scoreEquipeB ?? 0;
      const diff = Math.abs(sA - sB);
      const resA = sA > sB ? 'victoire' : sB > sA ? 'defaite' : 'nul';
      const resB = sB > sA ? 'victoire' : sA > sB ? 'defaite' : 'nul';
      console.log(`  ⚽ Match   ${doc.id} — A(${eqA.length}) ${sA}–${sB} B(${eqB.length})`);
      mettreAJourSynergiesEquipe(synMap, eqA, resA, diff);
      mettreAJourSynergiesEquipe(synMap, eqB, resB, diff);
    }
  }

  const pairesValides   = Object.keys(synMap);
  const pairesGarbage   = pairesValides.filter(k => k.includes('undefined'));
  const pairesCorrectes = pairesValides.filter(k => !k.includes('undefined'));

  console.log(`\n📊  Résultat :`);
  console.log(`   ${pairesCorrectes.length} paires de synergies valides`);
  if (pairesGarbage.length) console.log(`   ⚠️  ${pairesGarbage.length} paires garbage ignorées`);

  // Aperçu des 5 premières synergies
  console.log('\n🔍  Aperçu (5 premières) :');
  pairesCorrectes.slice(0, 5).forEach(k => {
    const s = synMap[k];
    console.log(`   ${k.slice(0,8)}...–${k.slice(-8)} : valeur=${s.valeur} matchs=${s.matchsEnsemble} (${s.victoires}V ${s.nuls}N ${s.defaites}D)`);
  });

  if (DRY_RUN) {
    console.log('\n✅  Dry-run terminé. Relance sans --dry-run pour appliquer.');
    return;
  }

  // 3. Supprimer toutes les synergies existantes
  console.log('\n🗑️   Suppression des synergies existantes...');
  const existingSnap = await db
    .collection('groupes').doc(GROUPE_ID)
    .collection('synergies').get();

  if (existingSnap.size) {
    const deleteBatch = db.batch();
    existingSnap.docs.forEach(d => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
    console.log(`   ${existingSnap.size} synergies supprimées`);
  } else {
    console.log('   Aucune synergie existante');
  }

  // 4. Écrire les nouvelles synergies (par batch de 500)
  console.log('\n✍️   Écriture des nouvelles synergies...');
  const entries = pairesCorrectes.map(k => [k, synMap[k]]);
  const CHUNK = 500;
  let written = 0;

  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = db.batch();
    entries.slice(i, i + CHUNK).forEach(([key, data]) => {
      const ref = db.collection('groupes').doc(GROUPE_ID)
        .collection('synergies').doc(key);
      batch.set(ref, data);
    });
    await batch.commit();
    written += Math.min(CHUNK, entries.length - i);
  }

  console.log(`   ${written} synergies écrites`);
  console.log('\n✅  Recalcul terminé avec succès !');
}

main().catch(err => {
  console.error('❌  Erreur :', err.message);
  process.exit(1);
});
