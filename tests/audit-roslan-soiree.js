'use strict';
/**
 * audit-roslan-soiree.js
 *
 * Récupère le dernier match soirée (2 sous-matchs) de ROSLAN FC sur Firestore
 * et recalcule manuellement les ELO attendus pour chaque joueur.
 * Compare avec ce qui a été enregistré.
 *
 * Usage : cd tests && node audit-roslan-soiree.js
 */

const admin = require('firebase-admin');
const path  = require('path');

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, 'serviceAccountKey.json'))),
});
const db = admin.firestore();

// ── Constantes ELO (mêmes que rating-system.js) ───────────────
const K_FACTOR = 64;
const BASE_RATING = 1000;
const GAIN_MAX =  150;
const PERTE_MAX = -150;

function probVictoire(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}
function multScore(s1, s2) {
  return 1 + Math.abs(s1 - s2) / 6;
}
function calculerDelta(ratingAllie, ratingAdverse, resultat, sAllie, sAdverse, poids) {
  const kP   = K_FACTOR * poids;
  const prob = probVictoire(ratingAllie, ratingAdverse);
  const mult = multScore(sAllie, sAdverse);
  return Math.round(kP * (resultat - prob) * mult);
}
function clamp(v, poids) {
  return Math.max(PERTE_MAX * poids * 2, Math.min(GAIN_MAX * poids * 2, v));
}

function moy(joueurs) {
  if (!joueurs.length) return BASE_RATING;
  return joueurs.reduce((s, j) => s + j.r, 0) / joueurs.length;
}

function resultatSynthetique(resultats, split) {
  if (resultats.length === 1) return resultats[0];
  let score = 0;
  resultats.forEach((r, i) => {
    const p = split[i] ?? 0.5;
    score += (r === 'victoire' ? 1 : r === 'nul' ? 0.5 : 0) * p;
  });
  if (score > 0.6) return 'victoire';
  if (score < 0.4) return 'defaite';
  return 'nul';
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  // 1. Trouver ROSLAN FC
  const gSnap = await db.collection('groupes').where('nom', '==', 'ROSLAN FC').get();
  if (gSnap.empty) { console.error('❌ Groupe ROSLAN FC introuvable'); process.exit(1); }
  const groupeId = gSnap.docs[0].id;
  console.log(`✅ Groupe : ROSLAN FC (${groupeId})\n`);

  // 2. Charger les joueurs actuels pour avoir les displayNames
  const joueursSnap = await db.collection('groupes').doc(groupeId).collection('joueurs').get();
  const nomParId = {};
  joueursSnap.docs.forEach(d => {
    nomParId[d.id] = d.data().displayName || d.data().nom || d.id;
  });

  // 3. Récupérer tous les matchs et filtrer les soirées côté client
  const matchsSnap = await db
    .collection('groupes').doc(groupeId)
    .collection('matchs')
    .orderBy('dateCreation', 'desc')
    .limit(50)
    .get();

  const soireeDocs = matchsSnap.docs.filter(d => d.data().type === 'soiree');

  if (soireeDocs.length === 0) {
    console.error('❌ Aucun match soirée trouvé pour ROSLAN FC');
    process.exit(1);
  }

  console.log(`📋 ${soireeDocs.length} match(s) soirée trouvé(s). Analyse du plus récent :\n`);

  const matchDoc = soireeDocs[0];
  const m = matchDoc.data();

  const dateStr = m.dateCreation?.toDate
    ? m.dateCreation.toDate().toLocaleString('fr-FR')
    : '(date inconnue)';
  console.log(`🗓  Match ID : ${matchDoc.id}  |  Date : ${dateStr}`);
  console.log(`   Split    : ${JSON.stringify(m.split)}`);
  console.log(`   Sous-matchs : ${m.sousMatchs?.length ?? '?'}\n`);

  const split   = m.split || [0.5, 0.5];
  const sousMs  = m.sousMatchs || [];
  const chEnreg = m.changements || {};

  // 4. Récupérer les ratings AVANT le match depuis chEnreg.ancien
  const ratingAvant = {};
  Object.entries(chEnreg).forEach(([uid, ch]) => {
    ratingAvant[uid] = ch.ancien ?? BASE_RATING;
  });

  // 5. Recalcul séquentiel (même algo que calculerChangementsSoiree)
  const ratingsCourants = { ...ratingAvant };
  const deltasCalc      = {};
  const resultatsCalc   = {};

  for (let idx = 0; idx < sousMs.length; idx++) {
    const sm    = sousMs[idx];
    const poids = split[idx] ?? (1 / sousMs.length);
    const idsA  = sm.equipeA || [];
    const idsB  = sm.equipeB || [];
    const sA    = sm.scoreA ?? 0;
    const sB    = sm.scoreB ?? 0;

    const eqA = idsA.map(id => ({ id, r: ratingsCourants[id] ?? BASE_RATING }));
    const eqB = idsB.map(id => ({ id, r: ratingsCourants[id] ?? BASE_RATING }));
    const rA  = moy(eqA);
    const rB  = moy(eqB);

    let res1, res2, txt1, txt2;
    if (sA > sB)      { res1=1;   res2=0;   txt1='victoire'; txt2='defaite'; }
    else if (sA < sB) { res1=0;   res2=1;   txt1='defaite';  txt2='victoire'; }
    else              { res1=0.5; res2=0.5; txt1='nul';      txt2='nul'; }

    console.log(`── Sous-match ${idx+1} (poids ${poids}) ──────────────────────────────`);
    console.log(`   Équipe A : ${idsA.map(id => `${nomParId[id]||id}(${Math.round(ratingsCourants[id]??BASE_RATING)})`).join(', ')}`);
    console.log(`   Équipe B : ${idsB.map(id => `${nomParId[id]||id}(${Math.round(ratingsCourants[id]??BASE_RATING)})`).join(', ')}`);
    console.log(`   Score    : ${sA} - ${sB}  →  A=${txt1}, B=${txt2}`);
    console.log(`   Rating moyen A=${Math.round(rA)}  B=${Math.round(rB)}\n`);

    const appliquer = (equipe, rAllie, rAdverse, resNum, resTxt) => {
      equipe.forEach(({ id, r }) => {
        const delta = calculerDelta(rAllie, rAdverse, resNum, sA, sB, poids);
        // le score "sAllie/sAdverse" dépend du camp — on recalcule proprement
        // (équipe A : sAllie=sA sAdverse=sB ; équipe B : sAllie=sB sAdverse=sA)
        const deltaFinal = clamp(delta, poids);
        deltasCalc[id]    = (deltasCalc[id]    || 0) + deltaFinal;
        resultatsCalc[id] = [...(resultatsCalc[id] || []), resTxt];
        ratingsCourants[id] = (ratingsCourants[id] ?? BASE_RATING) + deltaFinal;
      });
    };

    // Recalcul avec sAllie/sAdverse correct par camp
    eqA.forEach(({ id, r: rj }) => {
      const delta  = Math.round(K_FACTOR * poids * (res1 - probVictoire(rA, rB)) * multScore(sA, sB));
      const deltaC = clamp(delta, poids);
      deltasCalc[id]    = (deltasCalc[id]    || 0) + deltaC;
      resultatsCalc[id] = [...(resultatsCalc[id] || []), txt1];
      ratingsCourants[id] = (ratingsCourants[id] ?? BASE_RATING) + deltaC;
    });
    eqB.forEach(({ id, r: rj }) => {
      const delta  = Math.round(K_FACTOR * poids * (res2 - probVictoire(rB, rA)) * multScore(sB, sA));
      const deltaC = clamp(delta, poids);
      deltasCalc[id]    = (deltasCalc[id]    || 0) + deltaC;
      resultatsCalc[id] = [...(resultatsCalc[id] || []), txt2];
      ratingsCourants[id] = (ratingsCourants[id] ?? BASE_RATING) + deltaC;
    });
  }

  // 6. Tableau comparatif
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' COMPARAISON  enregistré vs recalculé');
  console.log('══════════════════════════════════════════════════════════════════');

  const allUids = new Set([...Object.keys(chEnreg), ...Object.keys(deltasCalc)]);
  let ok = 0, diff = 0;

  // En-tête
  const col = (s, n) => String(s).padStart(n);
  console.log(
    col('Joueur', 22) +
    col('Avant', 7) +
    col('ΔEnreg', 8) +
    col('ΔCalc', 8) +
    col('Écart', 7) +
    col('Résultat enr.', 16) +
    col('Résultat calc.', 16)
  );
  console.log('─'.repeat(84));

  for (const uid of allUids) {
    const enreg   = chEnreg[uid]  || {};
    const avant   = enreg.ancien  ?? ratingAvant[uid] ?? '?';
    const dEnreg  = enreg.changement ?? '?';
    const dCalc   = deltasCalc[uid]  ?? '?';
    const ecart   = (typeof dEnreg === 'number' && typeof dCalc === 'number')
      ? dEnreg - dCalc : '?';
    const resEnreg = enreg.resultat ?? '?';
    const resCalc  = resultatsCalc[uid]
      ? resultatSynthetique(resultatsCalc[uid], split)
      : '?';

    const flag = ecart === 0 ? '✓' : ecart === '?' ? '?' : `⚠️  DIFF ${ecart > 0 ? '+' : ''}${ecart}`;
    if (ecart === 0) ok++; else diff++;

    const nom = (nomParId[uid] || uid).slice(0, 20);
    console.log(
      col(nom, 22) +
      col(avant, 7) +
      col(dEnreg, 8) +
      col(dCalc, 8) +
      col(typeof ecart === 'number' ? (ecart >= 0 ? '+'+ecart : ecart) : ecart, 7) +
      col(resEnreg, 16) +
      col(resCalc, 16) +
      '  ' + flag
    );
  }

  console.log('─'.repeat(84));
  console.log(`\n✅ Identiques : ${ok}  |  ⚠️  Différents : ${diff}\n`);

  // 7. Détail des résultats par sous-match
  console.log('── Résultats par sous-match ──────────────────────────────────────');
  for (const uid of allUids) {
    const nom = (nomParId[uid] || uid).slice(0, 20);
    const r = resultatsCalc[uid] || [];
    const synth = resultatsCalc[uid] ? resultatSynthetique(r, split) : '?';
    console.log(`  ${nom.padEnd(22)} ${r.join(' + ')} → ${synth}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
