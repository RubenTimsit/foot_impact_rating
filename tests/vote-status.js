'use strict';

/**
 * vote-status.js — État actuel des votes MOM pour un groupe
 *
 * Affiche pour chaque match en cours de vote :
 *  - Les votants et leurs choix (top1 / top2 / top3)
 *  - Le classement provisoire pondéré (3pts / 2pts / 1pt)
 *  - Les participants qui n'ont pas encore voté
 *
 * Usage :
 *   cd tests
 *   node vote-status.js --groupeId=ID_DU_GROUPE
 *
 *   Pour voir aussi les votes des matchs déjà clôturés :
 *   node vote-status.js --groupeId=ID_DU_GROUPE --all
 * pour roslan : node vote-status.js --groupeId=HGmesKUm9Rf5cz7MB3qY --all 
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
const args      = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const ALL       = 'all' in args;
const LAST_ONLY = 'last' in args;
const MATCH_IDS = args.matchIds ? args.matchIds.split(',').filter(Boolean) : null;

if (!args.groupeId) {
  console.error('Usage: node vote-status.js --groupeId=ID_DU_GROUPE [--last] [--matchIds=ID1,ID2] [--all]');
  process.exit(1);
}
const { groupeId } = args;

// ── Helpers ───────────────────────────────────────────────────
function pad(str, len) {
  return String(str ?? '').padEnd(len);
}

function dateLabel(iso) {
  if (!iso) return '?';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  // Charger les joueurs pour avoir les noms
  const joueursSnap = await db
    .collection('groupes').doc(groupeId)
    .collection('joueurs').get();

  const joueurMap = {};
  joueursSnap.forEach(d => { joueurMap[d.id] = d.data().displayName || d.id; });

  const name = uid => joueurMap[uid] || uid;

  // Charger les matchs joués
  let query = db.collection('groupes').doc(groupeId).collection('matchs')
    .where('statut', '==', 'joue')
    .orderBy('dateCreation', 'desc');

  if (!ALL) {
    query = query.where('voteClos', '==', false);
  }

  const matchsSnap = await query.get();

  let matchDocs = matchsSnap.docs;
  if (MATCH_IDS) {
    matchDocs = matchDocs.filter(d => MATCH_IDS.includes(d.id));
  }
  if (LAST_ONLY) {
    matchDocs = matchDocs.slice(0, 1);
  }

  if (matchDocs.length === 0) {
    console.log(ALL
      ? '  Aucun match joué trouvé.'
      : '  Aucun vote en cours. Utilise --all pour voir tous les matchs.');
    process.exit(0);
  }

  for (const matchDoc of matchDocs) {
    const m = matchDoc.data();

    const dateStr      = dateLabel(m.dateMatch || m.dateCreation);
    const voteClos     = m.voteClos ? '🔒 CLOS' : '🟢 EN COURS';
    const fermeture    = m.dateVoteFermeture ? `  (ferme le ${dateLabel(m.dateVoteFermeture)})` : '';

    console.log('\n' + '═'.repeat(60));
    console.log(`  📅 ${dateStr}   ${voteClos}${fermeture}`);
    console.log(`  ID match : ${matchDoc.id}`);
    console.log('═'.repeat(60));

    // Récupérer tous les participants (equipeA + equipeB ou sousMatchs)
    const toId = j => (typeof j === 'string' ? j : j?.id);
    let participants = [];

    if (m.sousMatchs && m.sousMatchs.length) {
      const seen = new Set();
      for (const sm of m.sousMatchs) {
        for (const j of [...(sm.equipeA || []), ...(sm.equipeB || [])]) {
          const id = toId(j);
          if (id && !seen.has(id)) { seen.add(id); participants.push(id); }
        }
      }
    } else {
      const all = [...(m.equipeA || []), ...(m.equipeB || [])];
      participants = [...new Set(all.map(toId).filter(Boolean))];
    }

    // Récupérer les votes
    const votesSnap = await matchDoc.ref.collection('votes').get();
    const votes = {};
    votesSnap.forEach(d => { votes[d.id] = d.data(); });

    const votants   = Object.keys(votes);
    const nonVotants = participants.filter(uid => !votants.includes(uid));

    // ── Résultats provisoires ─────────────────────────────────
    const scores = {};
    for (const [voteurId, v] of Object.entries(votes)) {
      if (v.top1) scores[v.top1] = (scores[v.top1] || 0) + 3;
      if (v.top2) scores[v.top2] = (scores[v.top2] || 0) + 2;
      if (v.top3) scores[v.top3] = (scores[v.top3] || 0) + 1;
    }

    const podium = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);

    console.log(`\n  🏆 RÉSULTATS PROVISOIRES  (${votants.length}/${participants.length} votes)`);
    if (podium.length === 0) {
      console.log('     Aucun vote pour l\'instant.');
    } else {
      const medalIcon = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      podium.forEach(([uid, pts], i) => {
        console.log(`     ${medalIcon(i)}  ${pad(name(uid), 24)} ${pts} pt${pts > 1 ? 's' : ''}`);
      });
    }

    // ── Détail des votes ──────────────────────────────────────
    console.log(`\n  ✅ ONT VOTÉ (${votants.length})`);
    if (votants.length === 0) {
      console.log('     —');
    } else {
      for (const uid of votants) {
        const v = votes[uid];
        const t1 = v.top1 ? `🥇 ${name(v.top1)}` : '';
        const t2 = v.top2 ? `🥈 ${name(v.top2)}` : '';
        const t3 = v.top3 ? `🥉 ${name(v.top3)}` : '';
        console.log(`     ${pad(name(uid), 22)} →  ${[t1, t2, t3].filter(Boolean).join('  ')}`);
      }
    }

    // ── N'ont pas voté ────────────────────────────────────────
    console.log(`\n  ⏳ N'ONT PAS ENCORE VOTÉ (${nonVotants.length})`);
    if (nonVotants.length === 0) {
      console.log('     Tout le monde a voté !');
    } else {
      nonVotants.forEach(uid => console.log(`     • ${name(uid)}`));
    }
  }

  console.log('\n' + '═'.repeat(60) + '\n');
}

main().catch(err => { console.error(err); process.exit(1); });
