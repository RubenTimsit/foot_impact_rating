'use strict';

/**
 * vote-status-roslan-sg1.js
 *
 * Affiche l'état des votes MOM pour le DERNIER match joué du sous-groupe 1
 * de ROSLAN FC, sans avoir à saisir d'ID manuellement.
 *
 * Usage :
 *   cd tests && node vote-status-roslan-sg1.js
 *   cd tests && node vote-status-roslan-sg1.js --all   (tous les matchs SG1)
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');
const { spawnSync } = require('child_process');

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

const db  = admin.firestore();
const ALL = process.argv.includes('--all');

async function main() {
  // 1. Trouver ROSLAN FC
  const gSnap = await db.collection('groupes').where('nom', '==', 'ROSLAN FC').get();
  if (gSnap.empty) {
    console.error('❌  Groupe ROSLAN FC introuvable dans Firestore.');
    process.exit(1);
  }
  const groupeId = gSnap.docs[0].id;
  console.log(`✅  Groupe : ROSLAN FC  (${groupeId})`);

  // 2. Récupérer les matchs joués du sous-groupe 1
  //    Un match appartient au SG1 si sousGroupesCibles contient 1 OU est null/vide (ouvert à tous).
  const matchsSnap = await db
    .collection('groupes').doc(groupeId)
    .collection('matchs')
    .where('statut', '==', 'joue')
    .orderBy('dateMatch', 'desc')
    .get();

  const sg1 = matchsSnap.docs.filter(d => {
    const cibles = d.data().sousGroupesCibles;
    return !cibles || cibles.length === 0 || cibles.includes(1);
  });

  if (sg1.length === 0) {
    console.error('❌  Aucun match joué trouvé pour le sous-groupe 1.');
    process.exit(1);
  }

  // En mode normal : uniquement le dernier match SG1
  // En mode --all  : tous les matchs SG1
  const cibles = ALL ? sg1 : [sg1[0]];
  const matchIds = cibles.map(d => d.id);

  const dateStr = cibles[0].data().dateMatch || cibles[0].data().dateCreation || '';
  const label   = dateStr ? `  (${new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })})` : '';
  console.log(`🎯  ${ALL ? `${matchIds.length} match(s)` : 'Dernier match'} SG1${label}  →  ID : ${matchIds[0]}${matchIds.length > 1 ? ` … +${matchIds.length - 1}` : ''}\n`);

  // 3. Déléguer l'affichage à vote-status.js en passant les IDs via env
  const args = [
    path.join(__dirname, 'vote-status.js'),
    `--groupeId=${groupeId}`,
    `--matchIds=${matchIds.join(',')}`,
  ];
  if (ALL) args.push('--all');

  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 0);
}

main().catch(err => { console.error(err); process.exit(1); });
