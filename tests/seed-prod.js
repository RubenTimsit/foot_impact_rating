'use strict';

/**
 * seed-prod.js — Peuple Firebase avec un groupe de test complet
 *
 * Crée :
 *  - 1 groupe "Test FC" avec 50 joueurs fictifs
 *  - 20 matchs passés validés (ratings + synergies calculés)
 *  - 1 match en cours (ouvert, 8 joueurs inscrits)
 *  - 1 match futur (programmé, ouverture dans 2 jours)
 *  - Des votes Man of the Match sur les matchs récents
 *
 * Usage :
 *   1. Télécharge la clé de service Firebase :
 *      Console Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée
 *      Enregistre le fichier sous : tests/serviceAccountKey.json
 *
 *   2. Lance le script :
 *      cd tests
 *      node seed-prod.js
 *
 *   3. (Optionnel) Pour effacer les données de test avant de regénérer :
 *      node seed-prod.js --clean
 *
 * Pour l'émulateur local :
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 node seed-prod.js
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Init Firebase ─────────────────────────────────────────────
const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

if (!process.env.FIRESTORE_EMULATOR_HOST && !fs.existsSync(KEY_PATH)) {
  console.error(`
❌  Clé de service manquante !

Pour utiliser ce script sur la vraie Firebase :
  1. Va sur https://console.firebase.google.com/project/foot-4f0c2/settings/serviceaccounts/adminsdk
  2. Clique "Générer une nouvelle clé privée"
  3. Enregistre le fichier ici : tests/serviceAccountKey.json

Pour l'émulateur local :
  FIRESTORE_EMULATOR_HOST=localhost:8080 node seed-prod.js
`);
  process.exit(1);
}

let app;
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`🔧 Connexion à l'émulateur : ${process.env.FIRESTORE_EMULATOR_HOST}`);
  app = admin.initializeApp({ projectId: 'foot-4f0c2' });
} else {
  const serviceAccount = require(KEY_PATH);
  app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('🔥 Connexion à Firebase production : foot-4f0c2');
}

const db = admin.firestore(app);

// ── Constantes ELO ─────────────────────────────────────────────
const K_FACTOR    = 32;
const BASE_RATING = 1000;
const GAIN_MAX    = 50;
const PERTE_MAX   = -40;

function calculerProba(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}
function ratingMoyen(joueurs) {
  return joueurs.reduce((s, j) => s + j.rating, 0) / (joueurs.length || 1);
}
function calculerChangements(eq1, eq2, score1, score2) {
  const rm1 = ratingMoyen(eq1), rm2 = ratingMoyen(eq2);
  let res1, res2, txt1, txt2;
  if (score1 > score2)      { res1=1;   res2=0;   txt1='victoire'; txt2='defaite'; }
  else if (score1 < score2) { res1=0;   res2=1;   txt1='defaite';  txt2='victoire'; }
  else                       { res1=0.5; res2=0.5; txt1='nul';      txt2='nul'; }

  const diff = Math.abs(score1 - score2);
  const mult = 1 + diff / 10;
  const out  = {};
  [[eq1, rm1, rm2, res1, txt1], [eq2, rm2, rm1, res2, txt2]].forEach(
    ([eq, ra, rb, res, txt]) => {
      eq.forEach(j => {
        const base = K_FACTOR * (res - calculerProba(ra, rb)) * mult;
        out[j.id] = {
          changement: Math.max(PERTE_MAX, Math.min(GAIN_MAX, Math.round(base * 0.65))),
          resultat: txt,
        };
      });
    }
  );
  return out;
}

// ── Data fictive ───────────────────────────────────────────────
const PRENOMS = ['Ruben','Ilan','Maxime','Dylan','Thomas','Nathan','Julien','Kevin','Pierre',
  'Antoine','Romain','Mehdi','Yoann','Axel','Baptiste','Lucas','Hugo','Théo','Alexis','Florian',
  'Sacha','Léo','Mathieu','Nicolas','Rémi','Valentin','Tristan','Quentin','Bastien','Clément',
  'Arnaud','Sylvain','Guillaume','Ethan','Ryan','Jordan','Moussa','Karim','Yanis','Adam',
  'Luca','Rafael','Aaron','Samy','Elias','Omar','Hamza','Sofiane','Bilal','Noa'];

const POSITIONS = ['Attaquant','Milieu','Défenseur'];
const PROFILS   = { Milieu: ['Offensif','Défensif',''] };

function makeJoueur(i) {
  const prenom = PRENOMS[i] || `Joueur${i}`;
  const pos    = POSITIONS[i % 3];
  const profil = pos === 'Milieu' ? PROFILS.Milieu[i % 3] : '';
  return {
    id:               `test-joueur-${i}`,
    uid:              `test-joueur-${i}`,
    displayName:      prenom,
    positionPrincipale: pos,
    profilMilieu:     profil,
    rating:           BASE_RATING,
    matchsJoues:      0,
    victoires:        0,
    nuls:             0,
    defaites:         0,
    statut:           'active',
    trophees:         { or: 0, argent: 0, bronze: 0 },
    createdAt:        new Date().toISOString(),
  };
}

function randomSample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function randomScore() {
  return [Math.floor(Math.random() * 8) + 1, Math.floor(Math.random() * 8) + 1];
}

// ── Nettoyage ─────────────────────────────────────────────────
async function cleanTestData(groupeId) {
  console.log('🧹 Nettoyage des anciennes données de test...');
  const subColls = ['joueurs','matchs_semaine','matchs','synergies'];
  for (const coll of subColls) {
    const snap = await db.collection('groupes').doc(groupeId).collection(coll).get();
    const chunks = [];
    for (let i = 0; i < snap.docs.length; i += 500) chunks.push(snap.docs.slice(i, i+500));
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await db.collection('groupes').doc(groupeId).delete();
  console.log('   ✅ Données supprimées');
}

// ── Seed principal ────────────────────────────────────────────
async function seed() {
  const clean = process.argv.includes('--clean');
  const GROUPE_ID     = 'test-fc-groupe';
  const ADMIN_UID     = 'test-admin-uid';
  const NB_JOUEURS    = 50;
  const NB_MATCHS_PASSES = 20;

  if (clean) {
    await cleanTestData(GROUPE_ID);
    console.log('✅ Nettoyage terminé.');
    process.exit(0);
  }

  console.log('\n🚀 Démarrage du seed...\n');

  // ── 1. Créer le groupe ───────────────────────────────────────
  console.log('📦 Création du groupe "Test FC"...');
  await db.collection('groupes').doc(GROUPE_ID).set({
    nom:              'Test FC',
    code:             'TESTFC',
    adminId:          ADMIN_UID,
    membres:          [`test-joueur-${0}`, `test-joueur-${1}`],
    maxJoueursMatch:  10,
    configHebdoActif: false,
    configHebdos:     {},
    createdAt:        new Date().toISOString(),
    _isTestData:      true,
  });
  console.log(`   ✅ Groupe créé (ID: ${GROUPE_ID})`);

  // ── 2. Créer 50 joueurs ──────────────────────────────────────
  console.log(`\n👥 Création de ${NB_JOUEURS} joueurs...`);
  const joueurs = Array.from({ length: NB_JOUEURS }, (_, i) => makeJoueur(i));
  // Map mutable pour suivre les ratings évolutifs
  const ratingsActuels = {};
  joueurs.forEach(j => { ratingsActuels[j.id] = BASE_RATING; });

  // Ecrire les joueurs en batches
  for (let i = 0; i < joueurs.length; i += 500) {
    const batch = db.batch();
    joueurs.slice(i, i+500).forEach(j => {
      batch.set(
        db.collection('groupes').doc(GROUPE_ID).collection('joueurs').doc(j.id),
        j
      );
    });
    await batch.commit();
  }
  console.log(`   ✅ ${NB_JOUEURS} joueurs créés`);

  // ── 3. Simuler 20 matchs passés ──────────────────────────────
  console.log(`\n⚽ Simulation de ${NB_MATCHS_PASSES} matchs passés...`);
  const statsJoueurs = {};
  joueurs.forEach(j => {
    statsJoueurs[j.id] = { matchsJoues:0, victoires:0, nuls:0, defaites:0, trophees:{or:0,argent:0,bronze:0} };
  });
  const synergies = {};

  for (let m = 0; m < NB_MATCHS_PASSES; m++) {
    const dateMatch = new Date(Date.now() - (NB_MATCHS_PASSES - m) * 7 * 24 * 60 * 60 * 1000);
    const [scoreA, scoreB] = randomScore();

    // Tirer 20 joueurs au hasard, les répartir en deux équipes de 10
    const participants = randomSample(joueurs, 20);
    const equipeA = participants.slice(0,10).map(j => ({...j, rating: ratingsActuels[j.id]}));
    const equipeB = participants.slice(10,20).map(j => ({...j, rating: ratingsActuels[j.id]}));

    const changements = calculerChangements(equipeA, equipeB, scoreA, scoreB);

    // Mettre à jour ratings locaux
    Object.entries(changements).forEach(([uid, ch]) => {
      ratingsActuels[uid] = Math.max(500, (ratingsActuels[uid] || 1000) + ch.changement);
      const stats = statsJoueurs[uid];
      stats.matchsJoues++;
      if (ch.resultat === 'victoire') stats.victoires++;
      else if (ch.resultat === 'nul')  stats.nuls++;
      else stats.defaites++;
    });

    // Synergies équipe A
    for (let i=0; i<equipeA.length; i++) {
      for (let j=i+1; j<equipeA.length; j++) {
        const cle = [equipeA[i].id, equipeA[j].id].sort().join('-');
        if (!synergies[cle]) synergies[cle] = { j1: equipeA[i].id, j2: equipeA[j].id, matchsEnsemble:0, victoires:0, defaites:0, nuls:0, valeur:0 };
        const res = changements[equipeA[i].id].resultat;
        synergies[cle].matchsEnsemble++;
        if (res === 'victoire') { synergies[cle].victoires++; synergies[cle].valeur += 1; }
        else if (res === 'defaite') { synergies[cle].defaites++; synergies[cle].valeur -= 1; }
        else synergies[cle].nuls++;
      }
    }
    // Synergies équipe B
    for (let i=0; i<equipeB.length; i++) {
      for (let j=i+1; j<equipeB.length; j++) {
        const cle = [equipeB[i].id, equipeB[j].id].sort().join('-');
        if (!synergies[cle]) synergies[cle] = { j1: equipeB[i].id, j2: equipeB[j].id, matchsEnsemble:0, victoires:0, defaites:0, nuls:0, valeur:0 };
        const res = changements[equipeB[i].id].resultat;
        synergies[cle].matchsEnsemble++;
        if (res === 'victoire') { synergies[cle].victoires++; synergies[cle].valeur += 1; }
        else if (res === 'defaite') { synergies[cle].defaites++; synergies[cle].valeur -= 1; }
        else synergies[cle].nuls++;
      }
    }

    // Votes MOM (3 gagnants)
    const topJoueurs = [];
    const gagnants = scoreA > scoreB ? equipeA : scoreB > scoreA ? equipeB : [...equipeA, ...equipeB];
    const topVote = randomSample(gagnants, Math.min(3, gagnants.length));
    topVote.forEach((j, i) => {
      topJoueurs.push({ uid: j.id, rang: i+1, points: 3-i });
      if (i === 0) statsJoueurs[j.id].trophees.or++;
      if (i === 1) statsJoueurs[j.id].trophees.argent++;
      if (i === 2) statsJoueurs[j.id].trophees.bronze++;
    });

    // Écrire le match dans matchs/
    await db.collection('groupes').doc(GROUPE_ID).collection('matchs').add({
      dateMatch:    dateMatch.toISOString(),
      heureMatch:   '18:00',
      scoreEquipeA: scoreA,
      scoreEquipeB: scoreB,
      equipeA:      equipeA.map(j => j.id),
      equipeB:      equipeB.map(j => j.id),
      statut:       'joue',
      voteClos:     true,
      topJoueurs,
      dateValidation: dateMatch.toISOString(),
    });

    process.stdout.write(`   Match ${m+1}/${NB_MATCHS_PASSES} (${scoreA}-${scoreB}) ✓\r`);
  }
  console.log(`\n   ✅ ${NB_MATCHS_PASSES} matchs créés`);

  // ── 4. Mettre à jour les joueurs avec ratings finaux ─────────
  console.log('\n📊 Mise à jour des ratings et stats des joueurs...');
  const topRating = Object.entries(ratingsActuels).sort(([,a],[,b]) => b-a).slice(0,3);
  console.log('   🏆 Top 3 :');
  topRating.forEach(([uid, rating], i) => {
    const j = joueurs.find(j => j.id === uid);
    console.log(`      ${['🥇','🥈','🥉'][i]} ${j?.displayName} — ${Math.round(rating)} pts`);
  });

  for (let i = 0; i < joueurs.length; i += 500) {
    const batch = db.batch();
    joueurs.slice(i, i+500).forEach(j => {
      const ref = db.collection('groupes').doc(GROUPE_ID).collection('joueurs').doc(j.id);
      batch.update(ref, {
        rating:      Math.round(ratingsActuels[j.id]),
        matchsJoues: statsJoueurs[j.id].matchsJoues,
        victoires:   statsJoueurs[j.id].victoires,
        nuls:        statsJoueurs[j.id].nuls,
        defaites:    statsJoueurs[j.id].defaites,
        trophees:    statsJoueurs[j.id].trophees,
      });
    });
    await batch.commit();
  }
  console.log('   ✅ Ratings mis à jour');

  // ── 5. Écrire les synergies ───────────────────────────────────
  console.log('\n🤝 Écriture des synergies...');
  const synEntries = Object.entries(synergies).filter(([,s]) => s.matchsEnsemble >= 2);
  console.log(`   → ${synEntries.length} paires avec ≥ 2 matchs ensemble`);
  for (let i = 0; i < synEntries.length; i += 500) {
    const batch = db.batch();
    synEntries.slice(i, i+500).forEach(([cle, s]) => {
      const ref = db.collection('groupes').doc(GROUPE_ID).collection('synergies').doc(cle);
      batch.set(ref, {
        joueur1:         s.j1,
        joueur2:         s.j2,
        matchsEnsemble:  s.matchsEnsemble,
        victoires:       s.victoires,
        defaites:        s.defaites,
        nuls:            s.nuls,
        valeur:          Math.round(s.valeur * 10) / 10,
      });
    });
    await batch.commit();
  }
  console.log('   ✅ Synergies écrites');

  // ── 6. Match en cours (ouvert, 8 inscrits) ────────────────────
  console.log('\n📅 Création du match en cours...');
  const dateMatchCourant = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // dans 3 jours
  const matchRef = await db.collection('groupes').doc(GROUPE_ID).collection('matchs_semaine').add({
    dateMatch:       dateMatchCourant.toISOString().split('T')[0],
    heureMatch:      '18:00',
    heureOuverture:  '09:00',
    maxJoueurs:      10,
    statut:          'ouvert',
    confirmedCount:  8,
    creerPar:        'Admin Test',
    dateCreation:    new Date().toISOString(),
  });

  // 8 inscriptions confirmées
  const inscrits = randomSample(joueurs, 8);
  for (const j of inscrits) {
    await db.collection('groupes').doc(GROUPE_ID)
      .collection('matchs_semaine').doc(matchRef.id)
      .collection('inscriptions').doc(j.id).set({
        userId:           j.id,
        displayName:      j.displayName,
        position:         j.positionPrincipale,
        statut:           'confirmé',
        dateInscription:  new Date(Date.now() - Math.random() * 3600000).toISOString(),
      });
  }
  // 2 en liste d'attente
  const attente = randomSample(joueurs.filter(j => !inscrits.includes(j)), 2);
  for (const j of attente) {
    await db.collection('groupes').doc(GROUPE_ID)
      .collection('matchs_semaine').doc(matchRef.id)
      .collection('inscriptions').doc(j.id).set({
        userId:           j.id,
        displayName:      j.displayName,
        position:         j.positionPrincipale,
        statut:           'attente',
        dateInscription:  new Date().toISOString(),
      });
  }
  console.log(`   ✅ Match ouvert (ID: ${matchRef.id}) — 8 confirmés + 2 en attente`);

  // ── 7. Match futur (programmé) ────────────────────────────────
  console.log('\n⏰ Création du match futur (programmé)...');
  const dateOuverture = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // dans 2 jours
  const dateMatchFutur = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // dans 10 jours
  const matchFuturRef = await db.collection('groupes').doc(GROUPE_ID).collection('matchs_semaine').add({
    dateMatch:               dateMatchFutur.toISOString().split('T')[0],
    heureMatch:              '18:00',
    heureOuverture:          '09:00',
    dateOuvertureInscription: dateOuverture.toISOString(),
    maxJoueurs:              10,
    statut:                  'programmé',
    confirmedCount:          0,
    creerPar:                'Admin Test',
    dateCreation:            new Date().toISOString(),
  });
  console.log(`   ✅ Match programmé (ID: ${matchFuturRef.id}) — ouverture dans 2 jours`);

  // ── Résumé ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log('✅  SEED TERMINÉ !');
  console.log('═'.repeat(55));
  console.log(`\n  Groupe    : Test FC  (code: TESTFC)`);
  console.log(`  ID Groupe : ${GROUPE_ID}`);
  console.log(`  Joueurs   : ${NB_JOUEURS}`);
  console.log(`  Matchs    : ${NB_MATCHS_PASSES} passés + 1 ouvert + 1 programmé`);
  console.log(`  Synergies : ${synEntries.length} paires`);
  console.log(`\n  ⚠️  Pour rejoindre le groupe dans l'app : code TESTFC`);
  console.log(`      (il faudra valider la demande depuis un compte admin)`);
  console.log('');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Erreur seed :', err);
  process.exit(1);
});
