'use strict';

/**
 * recalc-elo.js — Recalcule tous les ratings ELO depuis l'historique des matchs
 *
 * Nouveau système :
 *   - Départ à 0 pour tous les joueurs
 *   - K=128 · multiplicateur score /6 · GAIN_MAX=150
 *   - Victoire  : delta ELO normal (toujours positif)
 *   - Défaite   : |base_ELO| × LOSS_FACTOR / multiplier (inverse du score → résister = récompensé)
 *   - Bonus MOM : +75% top1 · +40% top2 · +20% top3 (sur le delta réellement appliqué)
 *
 * Les matchs sont rejoués dans l'ordre chronologique.
 * Le champ `changements` de chaque match est mis à jour pour refléter
 * les nouvelles valeurs (affiché dans l'historique).
 *
 * Usage (dry-run par défaut — aucune écriture) :
 *   cd tests
 *   node recalc-elo.js --groupeId=<ID>
 *
 * Appliquer pour de vrai :
 *   node recalc-elo.js --groupeId=<ID> --apply
 *
 * Pour l'émulateur local :
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 node recalc-elo.js --groupeId=<ID>
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Init Firebase ──────────────────────────────────────────────
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

// ── Args ────────────────────────────────────────────────────────
const args      = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const DRY_RUN   = !('apply' in args);
const GROUPE_ID = args.groupeId;

if (!GROUPE_ID) {
  console.error('❌  Usage : node recalc-elo.js --groupeId=<ID> [--apply]');
  process.exit(1);
}

// ── Nouveau système ELO ─────────────────────────────────────────
const K_FACTOR    = 128;
const BASE_RATING = 0;     // tout le monde part de 0
const GAIN_MAX    = 300;   // cap généreux pour les gros upsets + MOM
const LOSS_FACTOR = 1/3;   // les perdants gagnent 1/3 du delta de base

const MOM_BONUS_PCT = { 1: 0.75, 2: 0.40, 3: 0.20 };

function probabilite(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function ratingMoyen(ratings) {
  const vals = Object.values(ratings);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : BASE_RATING;
}

function multiplicateur(score1, score2) {
  return 1 + Math.abs(score1 - score2) / 6;
}

/**
 * Calcule les changements ELO pour un match simple.
 * @param {string[]} equipeA  - UIDs équipe A
 * @param {string[]} equipeB  - UIDs équipe B
 * @param {number}   scoreA
 * @param {number}   scoreB
 * @param {Object}   ratings  - { [uid]: currentRating }
 * @param {number}   [k]      - K factor override (soirée pondérée)
 * @returns {Object} { [uid]: { ancien, changement, nouveau, resultat } }
 */
function calculerChangements(equipeA, equipeB, scoreA, scoreB, ratings, k = K_FACTOR) {
  const ratA = ratingMoyen(Object.fromEntries(equipeA.map(uid => [uid, ratings[uid] ?? BASE_RATING])));
  const ratB = ratingMoyen(Object.fromEntries(equipeB.map(uid => [uid, ratings[uid] ?? BASE_RATING])));

  let resA, resB, txtA, txtB;
  if      (scoreA > scoreB) { resA = 1;   resB = 0;   txtA = 'victoire'; txtB = 'defaite'; }
  else if (scoreA < scoreB) { resA = 0;   resB = 1;   txtA = 'defaite';  txtB = 'victoire'; }
  else                       { resA = 0.5; resB = 0.5; txtA = 'nul';      txtB = 'nul'; }

  const mult = multiplicateur(scoreA, scoreB);
  const out  = {};

  const delta = (prob, res) => {
    const base = k * Math.abs(res - prob); // toujours positif
    if (res > 0.5) {
      // Victoire : plein delta avec multiplicateur score
      return Math.min(GAIN_MAX, Math.round(base * mult));
    } else if (res === 0.5) {
      // Nul : moitié du delta de base, sans multiplicateur
      return Math.min(GAIN_MAX, Math.round(base));
    } else {
      // Défaite : delta inverse (plus l'écart est grand, moins on gagne)
      return Math.round(base * LOSS_FACTOR / mult);
    }
  };

  for (const uid of equipeA) {
    const ancien     = ratings[uid] ?? BASE_RATING;
    const prob       = probabilite(ratA, ratB);
    const changement = delta(prob, resA);
    out[uid] = { ancien, changement, nouveau: ancien + changement, resultat: txtA };
  }
  for (const uid of equipeB) {
    const ancien     = ratings[uid] ?? BASE_RATING;
    const prob       = probabilite(ratB, ratA);
    const changement = delta(prob, resB);
    out[uid] = { ancien, changement, nouveau: ancien + changement, resultat: txtB };
  }

  return out;
}

/**
 * Calcule les bonus MOM à partir du topJoueurs et des changements du match.
 * @param {Array}  topJoueurs - [{ uid, rang }]
 * @param {Object} changements
 * @returns {Object} { [uid]: bonusAmount }
 */
function calculerMomBonuses(topJoueurs, changements) {
  const bonuses = {};
  for (const top of (topJoueurs || [])) {
    const pct = MOM_BONUS_PCT[top.rang];
    if (!pct) continue;
    const ch = changements[top.uid];
    if (!ch) continue;
    const bonus = Math.round(Math.abs(ch.changement) * pct);
    if (bonus > 0) bonuses[top.uid] = bonus;
  }
  return bonuses;
}

// ── Helpers affichage ──────────────────────────────────────────
function pad(str, len) { return String(str ?? '').padEnd(len); }
function sign(n)       { return n > 0 ? `+${n}` : String(n); }
function dateLabel(iso) {
  if (!iso) return '?';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  🔄  Recalcul ELO — groupe : ${GROUPE_ID}`);
  console.log(`  Système : K=${K_FACTOR} · /6 · max=${GAIN_MAX} · MOM 100/50/30%`);
  if (DRY_RUN) {
    console.log('  ⚠️   DRY-RUN — aucune écriture. Ajoute --apply pour appliquer.');
  } else {
    console.log('  🚨  MODE APPLY — les données vont être modifiées !');
  }
  console.log(`${'═'.repeat(62)}\n`);

  // 1. Charger les joueurs
  const joueursSnap = await db
    .collection('groupes').doc(GROUPE_ID)
    .collection('joueurs').get();

  const joueurMap = {};
  joueursSnap.forEach(d => { joueurMap[d.id] = d.data().displayName || d.id; });
  const name = uid => joueurMap[uid] || uid.slice(0, 8);

  console.log(`👥  ${joueursSnap.size} joueurs trouvés\n`);

  // 2. Charger les matchs validés dans l'ordre chronologique
  const matchsSnap = await db
    .collection('groupes').doc(GROUPE_ID)
    .collection('matchs')
    .where('statut', '==', 'joue')
    .orderBy('dateCreation', 'asc')
    .get();

  console.log(`⚽  ${matchsSnap.size} match(s) validé(s) à rejouer\n`);

  if (!matchsSnap.size) {
    console.log('Aucun match joué. Rien à faire.');
    return;
  }

  // 3. Rejouer l'historique depuis BASE_RATING
  const ratings   = {};  // { [uid]: currentRating }
  const stats     = {};  // { [uid]: { matchsJoues, victoires, nuls, defaites, mom1, mom2, mom3 } }

  // Initialiser tous les joueurs connus
  joueursSnap.forEach(d => {
    ratings[d.id] = BASE_RATING;
    stats[d.id]   = { matchsJoues: 0, victoires: 0, nuls: 0, defaites: 0, mom1: 0, mom2: 0, mom3: 0 };
  });

  // { matchId: { changements, momBonuses } } — pour mise à jour des docs matchs
  const matchUpdates = {};

  let totalMomBonuses = 0;

  for (const matchDoc of matchsSnap.docs) {
    const m      = matchDoc.data();
    const toId   = j => (typeof j === 'string' ? j : j?.id);
    const dateLbl = dateLabel(m.dateCreation || m.dateMatch);
    const isSoiree = Array.isArray(m.sousMatchs) && m.sousMatchs.length > 0;

    // changements agrégés sur l'ensemble du doc (soirée = cumul des sous-matchs)
    const changements = {};

    if (isSoiree) {
      // ── Soirée : traiter chaque sous-match indépendamment ─────
      // 1 soirée = 1 match (matchsJoues incrémenté une seule fois après tous les SM)
      console.log(`  🌙 ${pad(dateLbl, 15)} SOIRÉE (${m.sousMatchs.length} sous-matchs)`);

      const soireeParticipants = new Set();
      // { uid: { wPoids, lPoids } } — pour déterminer le résultat global de la soirée
      const soireeResultats = {};

      for (let i = 0; i < m.sousMatchs.length; i++) {
        const sm    = m.sousMatchs[i];
        const eqA   = (sm.equipeA || []).map(toId).filter(Boolean);
        const eqB   = (sm.equipeB || []).map(toId).filter(Boolean);
        const sA    = sm.scoreA ?? 0;
        const sB    = sm.scoreB ?? 0;
        const poids = sm.poids ?? 1;

        for (const uid of [...eqA, ...eqB]) {
          if (!(uid in ratings)) { ratings[uid] = BASE_RATING; stats[uid] = { matchsJoues: 0, victoires: 0, nuls: 0, defaites: 0, mom1: 0, mom2: 0, mom3: 0 }; }
          soireeParticipants.add(uid);
          if (!soireeResultats[uid]) soireeResultats[uid] = { wPoids: 0, lPoids: 0 };
        }

        const resLabel = sA > sB ? 'A gagne' : sB > sA ? 'B gagne' : 'Nul';
        console.log(`     SM${i + 1} : A(${eqA.length}) ${sA}–${sB} B(${eqB.length})${poids !== 1 ? ` poids=${poids}` : ''} — ${resLabel}`);

        const kEffectif = K_FACTOR * poids;
        const ch = calculerChangements(eqA, eqB, sA, sB, ratings, kEffectif);

        const gagnants = sA > sB ? eqA : sB > sA ? eqB : [];
        const perdants  = sA > sB ? eqB : sB > sA ? eqA : [];

        for (const [uid, c] of Object.entries(ch)) {
          if (!changements[uid]) {
            changements[uid] = { ancien: c.ancien, changement: 0, nouveau: c.ancien, resultat: c.resultat };
          }
          changements[uid].changement += c.changement;
          changements[uid].nouveau    += c.changement;
          changements[uid].resultat    = c.resultat;
          ratings[uid] += c.changement;

          // Accumuler poids pour résultat global de la soirée (pas de matchsJoues ici)
          if (gagnants.includes(uid)) soireeResultats[uid].wPoids += poids;
          else if (perdants.includes(uid)) soireeResultats[uid].lPoids += poids;

          process.stdout.write(`       ELO  ${pad(name(uid), 20)} ${sign(c.changement).padStart(5)} → ${ratings[uid]}\n`);
        }
      }

      // Incrémenter matchsJoues UNE SEULE FOIS par soirée
      for (const uid of soireeParticipants) {
        if (!(uid in stats)) stats[uid] = { matchsJoues: 0, victoires: 0, nuls: 0, defaites: 0, mom1: 0, mom2: 0, mom3: 0 };
        stats[uid].matchsJoues++;
        const r = soireeResultats[uid] || { wPoids: 0, lPoids: 0 };
        if      (r.wPoids > r.lPoids) stats[uid].victoires++;
        else if (r.wPoids < r.lPoids) stats[uid].defaites++;
        else                           stats[uid].nuls++;
      }

    } else {
      // ── Match classique ────────────────────────────────────────
      const equipeA = (m.equipeA || []).map(toId).filter(Boolean);
      const equipeB = (m.equipeB || []).map(toId).filter(Boolean);
      const scoreA  = m.scoreA ?? m.scoreEquipeA ?? 0;
      const scoreB  = m.scoreB ?? m.scoreEquipeB ?? 0;

      for (const uid of [...equipeA, ...equipeB]) {
        if (!(uid in ratings)) { ratings[uid] = BASE_RATING; stats[uid] = { matchsJoues: 0, victoires: 0, nuls: 0, defaites: 0 }; }
      }

      const resLabel = scoreA > scoreB ? 'A gagne' : scoreB > scoreA ? 'B gagne' : 'Nul';
      console.log(`  ⚽ ${pad(dateLbl, 15)} ${scoreA}–${scoreB} (${resLabel})`);
      console.log(`     Équipe A : ${equipeA.map(name).join(', ')}`);
      console.log(`     Équipe B : ${equipeB.map(name).join(', ')}`);

      const ch = calculerChangements(equipeA, equipeB, scoreA, scoreB, ratings);
      Object.assign(changements, ch);

      for (const [uid, c] of Object.entries(changements)) {
        ratings[uid] += c.changement;
        if (uid in stats) {
          stats[uid].matchsJoues++;
          if (c.resultat === 'victoire') stats[uid].victoires++;
          else if (c.resultat === 'nul')  stats[uid].nuls++;
          else                            stats[uid].defaites++;
        }
        process.stdout.write(`     ELO  ${pad(name(uid), 20)} ${sign(c.changement).padStart(5)} → ${ratings[uid]}\n`);
      }
    }

    // ── Bonus MOM (niveau match/soirée, vote global) ───────────
    const momBonuses = (m.voteClos && m.topJoueurs?.length)
      ? calculerMomBonuses(m.topJoueurs, changements)
      : {};

    if (Object.keys(momBonuses).length) {
      totalMomBonuses++;
      const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
      const indent = isSoiree ? '     ' : '     ';
      console.log(`${indent}── Bonus MOM ──`);
      for (const top of m.topJoueurs) {
        const bonus = momBonuses[top.uid];
        if (!bonus) continue;
        ratings[top.uid] = (ratings[top.uid] || BASE_RATING) + bonus;
        if (!(top.uid in stats)) stats[top.uid] = { matchsJoues: 0, victoires: 0, nuls: 0, defaites: 0, mom1: 0, mom2: 0, mom3: 0 };
        if (top.rang === 1) stats[top.uid].mom1++;
        if (top.rang === 2) stats[top.uid].mom2++;
        if (top.rang === 3) stats[top.uid].mom3++;
        console.log(`${indent}${medals[top.rang] || '  '} ${pad(name(top.uid), 20)} +${bonus} MOM (rang ${top.rang}) → ${ratings[top.uid]}`);
      }
    }

    console.log('');

    matchUpdates[matchDoc.id] = { changements, momBonuses };
  }

  // 4. Résumé : classement avec stats détaillées
  console.log(`${'─'.repeat(90)}`);
  console.log('📊  CLASSEMENT SIMULÉ\n');
  console.log(`  ${'#'.padEnd(3)} ${'Joueur'.padEnd(24)} ${'Score'.padStart(6)}   ${'Matchs'.padStart(6)}   ${'V'.padStart(3)} ${'N'.padStart(3)} ${'D'.padStart(3)}   ${'🥇'.padStart(3)} ${'🥈'.padStart(3)} ${'🥉'.padStart(3)}`);
  console.log(`  ${''.padEnd(3, '─')} ${''.padEnd(24, '─')} ${''.padEnd(6, '─')}   ${''.padEnd(6, '─')}   ${''.padEnd(3, '─')} ${''.padEnd(3, '─')} ${''.padEnd(3, '─')}   ${''.padEnd(3, '─')} ${''.padEnd(3, '─')} ${''.padEnd(3, '─')}`);

  // Trier par nouveau rating décroissant, exclure ceux qui n'ont pas joué
  const joueurIds = Object.keys(ratings).filter(uid => uid in joueurMap);
  joueurIds.sort((a, b) => ratings[b] - ratings[a]);

  let rank = 1;
  for (const uid of joueurIds) {
    const s       = stats[uid] || { matchsJoues: 0, victoires: 0, nuls: 0, defaites: 0, mom1: 0, mom2: 0, mom3: 0 };
    const nouveau = Math.round(ratings[uid]);
    const momStr  = s.mom1 || s.mom2 || s.mom3
      ? `   ${String(s.mom1).padStart(3)} ${String(s.mom2).padStart(3)} ${String(s.mom3).padStart(3)}`
      : `   ${'—'.padStart(3)} ${''.padStart(3)} ${''.padStart(3)}`;
    console.log(
      `  ${String(rank).padEnd(3)} ${pad(name(uid), 24)} ${String(nouveau).padStart(6)}` +
      `   ${String(s.matchsJoues).padStart(6)}` +
      `   ${String(s.victoires).padStart(3)} ${String(s.nuls).padStart(3)} ${String(s.defaites).padStart(3)}` +
      momStr
    );
    rank++;
  }

  console.log(`\n  Total matchs avec bonus MOM : ${totalMomBonuses}/${matchsSnap.size}`);

  if (DRY_RUN) {
    console.log(`\n${'═'.repeat(62)}`);
    console.log('  ✅  Dry-run terminé. Aucune donnée modifiée.');
    console.log('  👉  Relance avec --apply pour appliquer les changements.');
    console.log(`${'═'.repeat(62)}\n`);
    return;
  }

  // 5. APPLY — écrire dans Firestore
  console.log(`\n${'─'.repeat(62)}`);
  console.log('✍️   Application des changements...\n');

  // 5a. Mettre à jour les ratings des joueurs (par batch de 500)
  console.log('  👥 Mise à jour des joueurs...');
  const joueurEntries = joueurIds.filter(uid => uid in joueurMap);
  const CHUNK = 500;

  for (let i = 0; i < joueurEntries.length; i += CHUNK) {
    const batch = db.batch();
    joueurEntries.slice(i, i + CHUNK).forEach(uid => {
      const ref = db.collection('groupes').doc(GROUPE_ID).collection('joueurs').doc(uid);
      const update = {
        rating:       Math.round(ratings[uid]),
        impactRating: Math.round(ratings[uid]),
      };
      if (uid in stats) {
        update.matchsJoues = stats[uid].matchsJoues;
        update.victoires   = stats[uid].victoires;
        update.nuls        = stats[uid].nuls;
        update.defaites    = stats[uid].defaites;
      }
      batch.update(ref, update);
    });
    await batch.commit();
  }
  console.log(`  ✅  ${joueurEntries.length} joueurs mis à jour`);

  // 5b. Mettre à jour les changements sur chaque match
  console.log('  ⚽ Mise à jour des changements sur les matchs...');
  const matchEntries = Object.entries(matchUpdates);

  for (let i = 0; i < matchEntries.length; i += CHUNK) {
    const batch = db.batch();
    matchEntries.slice(i, i + CHUNK).forEach(([matchId, { changements, momBonuses }]) => {
      const ref = db.collection('groupes').doc(GROUPE_ID).collection('matchs').doc(matchId);
      const update = { changements };
      if (Object.keys(momBonuses).length) update.momBonuses = momBonuses;
      batch.update(ref, update);
    });
    await batch.commit();
  }
  console.log(`  ✅  ${matchEntries.length} matchs mis à jour`);

  console.log(`\n${'═'.repeat(62)}`);
  console.log('  ✅  Recalcul appliqué avec succès !');
  console.log(`${'═'.repeat(62)}\n`);
}

main().catch(err => {
  console.error('❌  Erreur :', err.message);
  process.exit(1);
});
