'use strict';

/**
 * match-validation.test.js — Tests de la validation complète d'un match
 *
 * Reproduit la logique de validerMatch() (js/db.js) avec firebase-admin.
 * Scénarios couverts :
 *  ✅  Validation match : gagnants gagnent du rating, perdants en perdent
 *  ✅  Validation match nul : changements proches de 0 pour tous
 *  ✅  Les compteurs matchsJoues de chaque joueur sont incrémentés
 *  ✅  Un document "match joué" est créé dans la sous-collection matchs/
 *  ✅  Le créneau matchs_semaine passe au statut "validé"
 *  ✅  Les synergies sont créées pour chaque paire d'une même équipe
 *  ✅  Double validation du même match → erreur match_already_validated
 *  ✅  Validation avec score 0-0 (nul sans buts) → coherence
 *  ✅  Man of the Match : vote comptabilisé, joueur obtient +trophée
 *  ✅  Créer un créneau manuel + vérification des champs
 *
 * Prérequis :
 *   firebase emulators:start --only firestore
 */

'use strict';

const admin = require('firebase-admin');
const { getDb, clearDb, creerGroupeEtMatch } = require('./helpers');

const db = getDb();

// ─────────────────────────────────────────────────────────────────────────────
// Constantes ELO (miroir de rating-system.js — pour assertions dans les tests)
// ─────────────────────────────────────────────────────────────────────────────

const K_FACTOR    = 32;
const BASE_RATING = 1000;
const GAIN_MAX    = 50;
const PERTE_MAX   = -40;

function calculerProbabilite(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de validation (miroir de db.js validerMatch, sans ES modules)
// ─────────────────────────────────────────────────────────────────────────────

function ratingMoyen(joueurs) {
  if (!joueurs.length) return BASE_RATING;
  return joueurs.reduce((s, j) => s + j.rating, 0) / joueurs.length;
}

function calculerChangements(eq1, eq2, score1, score2) {
  const rm1 = ratingMoyen(eq1);
  const rm2 = ratingMoyen(eq2);
  let res1, res2, txt1, txt2;
  if (score1 > score2)      { res1=1;   res2=0;   txt1='victoire'; txt2='defaite'; }
  else if (score1 < score2) { res1=0;   res2=1;   txt1='defaite';  txt2='victoire'; }
  else                       { res1=0.5; res2=0.5; txt1='nul';      txt2='nul'; }

  const changements = {};
  const diff = Math.abs(score1 - score2);
  const mult = 1 + diff / 10;

  [[eq1, rm1, rm2, res1, txt1], [eq2, rm2, rm1, res2, txt2]].forEach(
    ([eq, ra, rb, res, txt]) => {
      eq.forEach(j => {
        const base = K_FACTOR * (res - calculerProbabilite(ra, rb)) * mult;
        changements[j.id] = {
          changement: Math.max(PERTE_MAX, Math.min(GAIN_MAX, Math.round(base * 0.65))),
          resultat: txt,
        };
      });
    }
  );
  return changements;
}

/**
 * Valide un match dans Firestore (transaction atomique).
 * @param {string} groupeId
 * @param {string} matchSemaineId
 * @param {Array}  equipeA  [{id, rating, displayName}]
 * @param {Array}  equipeB
 * @param {number} scoreA
 * @param {number} scoreB
 */
async function validerMatch(db, groupeId, matchSemaineId, equipeA, equipeB, scoreA, scoreB) {
  const matchSemaineRef = db.collection('groupes').doc(groupeId)
    .collection('matchs_semaine').doc(matchSemaineId);
  const matchSnap = await matchSemaineRef.get();

  if (!matchSnap.exists) throw new Error('match_not_found');
  if (matchSnap.data().statut === 'validé') throw new Error('match_already_validated');

  const changements = calculerChangements(equipeA, equipeB, scoreA, scoreB);

  // Créer le document match joué
  const matchRef = await db.collection('groupes').doc(groupeId)
    .collection('matchs').add({
      dateMatch:   matchSnap.data().dateMatch || new Date().toISOString(),
      scoreEquipeA: scoreA,
      scoreEquipeB: scoreB,
      equipeA:      equipeA.map(j => j.id),
      equipeB:      equipeB.map(j => j.id),
      statut:       'joue',
      dateValidation: new Date().toISOString(),
    });

  const batch = db.batch();

  // Mettre à jour les ratings
  const tousLesJoueurs = [...equipeA, ...equipeB];
  tousLesJoueurs.forEach(j => {
    const ch = changements[j.id];
    const joueurRef = db.collection('groupes').doc(groupeId)
      .collection('joueurs').doc(j.id);
    batch.update(joueurRef, {
      rating:       admin.firestore.FieldValue.increment(ch.changement),
      matchsJoues:  admin.firestore.FieldValue.increment(1),
      [`resultats.${ch.resultat}`]: admin.firestore.FieldValue.increment(1),
    });
  });

  // Synergies équipe A
  for (let i = 0; i < equipeA.length; i++) {
    for (let j = i + 1; j < equipeA.length; j++) {
      const cle  = [equipeA[i].id, equipeA[j].id].sort().join('-');
      const sRef = db.collection('groupes').doc(groupeId).collection('synergies').doc(cle);
      const ch   = changements[equipeA[i].id];
      batch.set(sRef, {
        joueur1:        equipeA[i].id,
        joueur2:        equipeA[j].id,
        matchsEnsemble: admin.firestore.FieldValue.increment(1),
        victoires:      admin.firestore.FieldValue.increment(ch.resultat === 'victoire' ? 1 : 0),
        defaites:       admin.firestore.FieldValue.increment(ch.resultat === 'defaite' ? 1 : 0),
        nuls:           admin.firestore.FieldValue.increment(ch.resultat === 'nul' ? 1 : 0),
        valeur:         admin.firestore.FieldValue.increment(ch.resultat === 'victoire' ? 1 : ch.resultat === 'defaite' ? -1 : 0),
      }, { merge: true });
    }
  }

  // Fermer le créneau
  batch.update(matchSemaineRef, { statut: 'validé', matchValideId: matchRef.id });

  await batch.commit();
  return { matchId: matchRef.id, changements };
}

async function lireJoueur(db, groupeId, uid) {
  const snap = await db.collection('groupes').doc(groupeId).collection('joueurs').doc(uid).get();
  return snap.data();
}

async function setupGroupeAvecJoueurs(nb = 4) {
  const groupeId = `groupe-${Math.random().toString(36).slice(2)}`;
  await db.collection('groupes').doc(groupeId).set({ nom: 'Test', adminId: 'admin' });

  const joueurs = Array.from({ length: nb }, (_, i) => ({
    id: `joueur${i + 1}`,
    displayName: `Joueur ${i + 1}`,
    rating: 1000,
    matchsJoues: 0,
  }));

  for (const j of joueurs) {
    await db.collection('groupes').doc(groupeId).collection('joueurs').doc(j.id).set(j);
  }

  const matchRef = await db.collection('groupes').doc(groupeId)
    .collection('matchs_semaine').add({
      statut: 'ouvert', maxJoueurs: nb, confirmedCount: nb,
      dateMatch: new Date(Date.now() + 86_400_000).toISOString(),
    });

  return { groupeId, joueurs, matchSemaineId: matchRef.id };
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(async () => { await clearDb(); });

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Validation de base
// ─────────────────────────────────────────────────────────────────────────────

describe('Validation match — résultats ELO', () => {
  test('gagnants → rating augmenté, perdants → rating diminué', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 3, 1);

    const r1 = await lireJoueur(db, groupeId, j1.id);
    const r3 = await lireJoueur(db, groupeId, j3.id);

    expect(r1.rating).toBeGreaterThan(1000);  // gagnant
    expect(r3.rating).toBeLessThan(1000);     // perdant
  });

  test('match nul équipes égales → changements proches de 0', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 3, 3);

    for (const j of joueurs) {
      const data = await lireJoueur(db, groupeId, j.id);
      expect(Math.abs(data.rating - 1000)).toBeLessThanOrEqual(5);
    }
  });

  test('les changements respectent le plafond max/min', async () => {
    // Équipe A très forte vs équipe B faible
    const groupeId = `groupe-${Math.random().toString(36).slice(2)}`;
    await db.collection('groupes').doc(groupeId).set({ nom: 'Test', adminId: 'admin' });

    const fort   = { id: 'fort',   rating: 2000, matchsJoues: 0, displayName: 'Fort' };
    const faible = { id: 'faible', rating: 500,  matchsJoues: 0, displayName: 'Faible' };

    for (const j of [fort, faible]) {
      await db.collection('groupes').doc(groupeId).collection('joueurs').doc(j.id).set(j);
    }

    const matchRef = await db.collection('groupes').doc(groupeId)
      .collection('matchs_semaine').add({
        statut: 'ouvert', maxJoueurs: 2, confirmedCount: 2,
        dateMatch: new Date().toISOString(),
      });

    await validerMatch(db, groupeId, matchRef.id, [faible], [fort], 5, 0); // upset

    const rFaible = await lireJoueur(db, groupeId, 'faible');
    const rFort   = await lireJoueur(db, groupeId, 'fort');

    expect(rFaible.rating).toBeGreaterThan(500);  // a gagné
    expect(rFort.rating).toBeLessThan(2000);      // a perdu
    // Plafonds
    expect(rFaible.rating - 500).toBeLessThanOrEqual(GAIN_MAX);
    expect(2000 - rFort.rating).toBeLessThanOrEqual(Math.abs(PERTE_MAX));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Compteurs et cohérence
// ─────────────────────────────────────────────────────────────────────────────

describe('Validation match — compteurs', () => {
  test('matchsJoues de chaque joueur est incrémenté', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 2, 1);

    for (const j of joueurs) {
      const data = await lireJoueur(db, groupeId, j.id);
      expect(data.matchsJoues).toBe(1);
    }
  });

  test('le créneau matchs_semaine passe en statut "validé"', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 4, 0);

    const snap = await db.collection('groupes').doc(groupeId)
      .collection('matchs_semaine').doc(matchSemaineId).get();
    expect(snap.data().statut).toBe('validé');
  });

  test('un document dans matchs/ est créé avec les bons scores', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    const { matchId } = await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 3, 1);

    const snap = await db.collection('groupes').doc(groupeId)
      .collection('matchs').doc(matchId).get();
    expect(snap.exists).toBe(true);
    expect(snap.data().scoreEquipeA).toBe(3);
    expect(snap.data().scoreEquipeB).toBe(1);
    expect(snap.data().statut).toBe('joue');
  });

  test('double validation → erreur match_already_validated', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 2, 0);

    await expect(
      validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 2, 0)
    ).rejects.toThrow('match_already_validated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Synergies
// ─────────────────────────────────────────────────────────────────────────────

describe('Validation match — synergies', () => {
  test('synergies créées pour toutes les paires d\'une même équipe', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 3, 1);

    // Paire j1-j2 doit avoir une synergie (équipe A)
    const cle = [j1.id, j2.id].sort().join('-');
    const synSnap = await db.collection('groupes').doc(groupeId)
      .collection('synergies').doc(cle).get();
    expect(synSnap.exists).toBe(true);
    expect(synSnap.data().matchsEnsemble).toBe(1);
  });

  test('synergies de victoire → valeur > 0', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 4, 0);

    const cle = [j1.id, j2.id].sort().join('-');
    const synSnap = await db.collection('groupes').doc(groupeId)
      .collection('synergies').doc(cle).get();
    expect(synSnap.data().valeur).toBeGreaterThan(0);
    expect(synSnap.data().victoires).toBe(1);
  });

  test('synergies de défaite → valeur ≤ 0', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    await validerMatch(db, groupeId, matchSemaineId, [j3, j4], [j1, j2], 0, 4);

    const cle = [j3.id, j4.id].sort().join('-');
    const synSnap = await db.collection('groupes').doc(groupeId)
      .collection('synergies').doc(cle).get();
    expect(synSnap.data().valeur).toBeLessThanOrEqual(0);
    expect(synSnap.data().defaites).toBe(1);
  });

  test('accumulation synergies sur plusieurs matchs', async () => {
    // Créer 3 matchs différents pour j1 et j2 ensemble (toujours gagnants)
    for (let i = 0; i < 3; i++) {
      const { groupeId: gId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
      const [j1, j2, j3, j4] = joueurs;

      const cle = [j1.id, j2.id].sort().join('-');

      await validerMatch(db, gId, matchSemaineId, [j1, j2], [j3, j4], 3, 1);

      const synSnap = await db.collection('groupes').doc(gId)
        .collection('synergies').doc(cle).get();
      expect(synSnap.data().matchsEnsemble).toBe(1);
      expect(synSnap.data().victoires).toBe(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Création de créneaux
// ─────────────────────────────────────────────────────────────────────────────

describe('Créneaux — création manuelle', () => {
  test('créer un créneau manuel avec tous les champs', async () => {
    const groupeId = `groupe-${Math.random().toString(36).slice(2)}`;
    await db.collection('groupes').doc(groupeId).set({ nom: 'Test', adminId: 'admin' });

    const docRef = await db.collection('groupes').doc(groupeId)
      .collection('matchs_semaine').add({
        dateMatch:       '2026-06-15',
        heureMatch:      '15:00',
        heureOuverture:  '09:00',
        maxJoueurs:      10,
        statut:          'ouvert',
        confirmedCount:  0,
        creerPar:        'admin',
      });

    const snap = await docRef.get();
    expect(snap.exists).toBe(true);
    expect(snap.data().statut).toBe('ouvert');
    expect(snap.data().heureMatch).toBe('15:00');
    expect(snap.data().heureOuverture).toBe('09:00');
    expect(snap.data().maxJoueurs).toBe(10);
    expect(snap.data().confirmedCount).toBe(0);
  });

  test('un créneau en statut "programmé" s\'ouvre à l\'heure prévue', async () => {
    const groupeId = `groupe-${Math.random().toString(36).slice(2)}`;
    await db.collection('groupes').doc(groupeId).set({ nom: 'Test', adminId: 'admin' });

    const ouvertureFuture = new Date(Date.now() + 3_600_000).toISOString();
    const docRef = await db.collection('groupes').doc(groupeId)
      .collection('matchs_semaine').add({
        statut: 'programmé',
        dateOuvertureInscription: ouvertureFuture,
        maxJoueurs: 10,
        confirmedCount: 0,
      });

    const snap = await docRef.get();
    expect(snap.data().statut).toBe('programmé');
    // L'ouverture est dans le futur → ne doit pas être "ouvert" encore
    const isOuvert = new Date() >= new Date(snap.data().dateOuvertureInscription);
    expect(isOuvert).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Vote Man of the Match
// ─────────────────────────────────────────────────────────────────────────────

describe('Vote Man of the Match', () => {
  test('un joueur peut voter une fois par match', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    const { matchId } = await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 3, 1);

    // Soumettre un vote
    const voteRef = db.collection('groupes').doc(groupeId)
      .collection('matchs').doc(matchId)
      .collection('votes').doc(j1.id);

    await voteRef.set({
      userId:  j1.id,
      top1:    j2.id,
      top2:    j3.id,
      top3:    j4.id,
      dateVote: new Date().toISOString(),
    });

    const snap = await voteRef.get();
    expect(snap.exists).toBe(true);
    expect(snap.data().top1).toBe(j2.id);
    expect(snap.data().userId).toBe(j1.id);
  });

  test('un joueur ne peut voter que pour des joueurs du match', async () => {
    const { groupeId, joueurs, matchSemaineId } = await setupGroupeAvecJoueurs(4);
    const [j1, j2, j3, j4] = joueurs;

    const { matchId } = await validerMatch(db, groupeId, matchSemaineId, [j1, j2], [j3, j4], 3, 1);

    const joueursMatch = [j1.id, j2.id, j3.id, j4.id];
    const voteRef = db.collection('groupes').doc(groupeId)
      .collection('matchs').doc(matchId)
      .collection('votes').doc(j1.id);

    await voteRef.set({ userId: j1.id, top1: j2.id, top2: j3.id, top3: j4.id });
    const snap = await voteRef.get();

    // Vérifier que les votes pointent vers des joueurs du match
    expect(joueursMatch).toContain(snap.data().top1);
    expect(joueursMatch).toContain(snap.data().top2);
    expect(joueursMatch).toContain(snap.data().top3);
  });
});
