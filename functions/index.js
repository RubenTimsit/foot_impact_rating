const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentDeleted, onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { DateTime } = require('luxon');

admin.initializeApp();
const db = admin.firestore();

const TIMEZONE = 'Asia/Jerusalem';
const REGION = 'europe-west1';

/**
 * Calcule la date du match à partir de la date d'ouverture des inscriptions.
 * matchJour : 0=Dim, 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam
 */
function getMatchDate(ouvertureDate, matchJour, matchHeure) {
    const [h, m] = matchHeure.split(':').map(Number);
    const luxonJour = matchJour === 0 ? 7 : matchJour; // Luxon : 1=Lun...7=Dim

    const ouvertureDT = DateTime.fromJSDate(ouvertureDate).setZone(TIMEZONE);
    let matchDT = ouvertureDT.set({ weekday: luxonJour, hour: h, minute: m, second: 0, millisecond: 0 });

    if (matchDT <= ouvertureDT) {
        matchDT = matchDT.plus({ weeks: 1 });
    }

    return matchDT.toJSDate();
}

/**
 * Arrondit une date à la prochaine tranche de 15 minutes.
 * Ex: 21:07 → 21:15, 21:00 → 21:00
 */
function snapTo15Min(date) {
    const ms = 15 * 60 * 1000;
    return new Date(Math.ceil(date.getTime() / ms) * ms);
}

// ========== SCHEDULED: toutes les 15 min ==========
// Rôle : fermer les matchs passés + flip 'programmé'→'ouvert' (fallback client)
//         + pré-créer le créneau de la semaine suivante
exports.processMatchSemaine = onSchedule({
    schedule: 'every 15 minutes',
    timeZone: TIMEZONE,
    region: REGION,
}, async () => {
    const now = new Date();

    // Récupérer les groupes avec au moins un créneau actif (nouveau format)
    // + groupes legacy (ancien champ configHebdo)
    const [newSnap, legacySnap] = await Promise.all([
        db.collection('groupes').where('configHebdoActif', '==', true).get(),
        db.collection('groupes').where('configHebdo.actif', '==', true)
            .where('configHebdo.recurring', '==', true).get()
    ]);
    const groupeIds = new Set();
    const groupeDocs = [];
    for (const d of [...newSnap.docs, ...legacySnap.docs]) {
        if (!groupeIds.has(d.id)) { groupeIds.add(d.id); groupeDocs.push(d); }
    }

    for (const groupeDoc of groupeDocs) {
        const data = groupeDoc.data();

        // Récupérer les configs actives (nouveau format configHebdos map + legacy)
        const configs = [];
        if (data.configHebdos) {
            Object.entries(data.configHebdos).forEach(([id, cfg]) => {
                if (cfg.actif) configs.push({ _id: id, ...cfg });
            });
        } else if (data.configHebdo?.actif && data.configHebdo?.recurring) {
            configs.push({ _id: 'legacy', ...data.configHebdo });
        }

    for (const config of configs) {

        // 1. Fermer les matchs dont l'heure est passée
        const ouvertsSnap = await db.collection('groupes').doc(groupeDoc.id)
            .collection('matchs_semaine').where('statut', '==', 'ouvert').get();
        for (const matchDoc of ouvertsSnap.docs) {
            if (now >= new Date(matchDoc.data().dateMatch)) {
                await matchDoc.ref.update({ statut: 'fermé' });
            }
        }

        // 2. Flip 'programmé' → 'ouvert' (fallback) + pré-créer le créneau suivant
        const programmeSnap = await db.collection('groupes').doc(groupeDoc.id)
            .collection('matchs_semaine').where('statut', '==', 'programmé').get();

        for (const matchDoc of programmeSnap.docs) {
            const matchData = matchDoc.data();
            if (!matchData.dateOuvertureInscription) continue;
            const ouvertureDate = new Date(matchData.dateOuvertureInscription);

            if (now >= ouvertureDate) {
                await matchDoc.ref.update({ statut: 'ouvert' });

                const nextOuverture = new Date(ouvertureDate.getTime() + 7 * 24 * 60 * 60 * 1000);

                // Mettre à jour nextOuvertureDate (nouveau format ou legacy)
                if (config._id !== 'legacy') {
                    await groupeDoc.ref.update({ [`configHebdos.${config._id}.nextOuvertureDate`]: nextOuverture.toISOString() });
                } else {
                    await groupeDoc.ref.update({ 'configHebdo.nextOuvertureDate': nextOuverture.toISOString() });
                }

                // Pré-créer le créneau de la semaine suivante
                const nextDateMatch = getMatchDate(nextOuverture, config.matchJour, config.matchHeure);
                await db.collection('groupes').doc(groupeDoc.id).collection('matchs_semaine').add({
                    dateMatch: nextDateMatch.toISOString(),
                    dateOuvertureInscription: nextOuverture.toISOString(),
                    maxJoueurs: config.maxJoueurs || 10,
                    statut: 'programmé',
                    confirmedCount: 0,
                    createdAt: now.toISOString()
                });
            }
        }

        // 3. Rattrapage : si aucun doc à venir pour cette config, en créer un
        if (config.nextOuvertureDate) {
            const upcomingSnap = await db.collection('groupes').doc(groupeDoc.id)
                .collection('matchs_semaine')
                .where('statut', 'in', ['programmé', 'ouvert'])
                .get();

            // Vérifier si un doc correspond à cette config (même dateOuvertureInscription)
            const alreadyExists = upcomingSnap.docs.some(d =>
                d.data().dateOuvertureInscription === config.nextOuvertureDate
            );

            if (!alreadyExists) {
                const nextOuverture = new Date(config.nextOuvertureDate);
                const statut = now >= nextOuverture ? 'ouvert' : 'programmé';
                const dateMatch = getMatchDate(nextOuverture, config.matchJour, config.matchHeure);
                await db.collection('groupes').doc(groupeDoc.id).collection('matchs_semaine').add({
                    dateMatch: dateMatch.toISOString(),
                    dateOuvertureInscription: nextOuverture.toISOString(),
                    maxJoueurs: config.maxJoueurs || 10,
                    statut,
                    confirmedCount: 0,
                    createdAt: now.toISOString()
                });
            }
        }
    } // fin for configs
        // 4. Fermer les votes expirés (24h après le match) pour ce groupe
        const expiredVotesSnap = await db.collection('groupes').doc(groupeDoc.id)
            .collection('matchs')
            .where('voteClos', '==', false)
            .get();

        for (const matchDoc of expiredVotesSnap.docs) {
            const md = matchDoc.data();
            if (md.statut !== 'joue' || !md.dateVoteFermeture) continue;
            if (now >= new Date(md.dateVoteFermeture)) {
                try {
                    await closeVotesAndUpdateTrophies(groupeDoc.id, matchDoc.id, md);
                } catch (e) {
                    console.error(`Erreur fermeture vote ${matchDoc.id}:`, e);
                }
            }
        }

    } // fin for groupeDocs
});

// ========== UTILITAIRE: Calcul et fermeture des votes ==========
async function closeVotesAndUpdateTrophies(groupeId, matchId, matchData) {
    const matchRef = db.collection('groupes').doc(groupeId).collection('matchs').doc(matchId);

    // Lire les votes EN DEHORS de la transaction (pas possible à l'intérieur)
    const votesSnap = await matchRef.collection('votes').get();
    const votes = votesSnap.docs.map(d => d.data());

    // Calcul des points et compteurs de votes par position
    const stats = {};
    votes.forEach(v => {
        if (v.top1) { stats[v.top1] = stats[v.top1] || { points: 0, top1: 0, top2: 0 }; stats[v.top1].points += 3; stats[v.top1].top1++; }
        if (v.top2) { stats[v.top2] = stats[v.top2] || { points: 0, top1: 0, top2: 0 }; stats[v.top2].points += 2; stats[v.top2].top2++; }
        if (v.top3) { stats[v.top3] = stats[v.top3] || { points: 0, top1: 0, top2: 0 }; stats[v.top3].points += 1; }
    });

    // Tri avec départage : points → top1 → top2 → ex-aequo
    const sorted = Object.entries(stats).sort(([, a], [, b]) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.top1 !== a.top1) return b.top1 - a.top1;
        return b.top2 - a.top2;
    });

    // Assigner les rangs en gérant les ex-aequo
    const topJoueurs = [];
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const [, prev] = sorted[i - 1];
            const [, curr] = sorted[i];
            const isAequo = curr.points === prev.points && curr.top1 === prev.top1 && curr.top2 === prev.top2;
            if (!isAequo) currentRank = topJoueurs.length + 1;
        }
        if (currentRank > 3) break;
        topJoueurs.push({ uid: sorted[i][0], points: sorted[i][1].points, rang: currentRank });
    }

    // Transaction atomique : seule l'instance qui bascule voteClos false→true
    // met à jour les trophées. Si une autre CF a déjà fermé, on s'arrête.
    let weClosedIt = false;
    await db.runTransaction(async (transaction) => {
        weClosedIt = false; // reset à chaque retry de la transaction
        const snap = await transaction.get(matchRef);
        if (!snap.exists || snap.data().voteClos) return; // Déjà fermé → rien à faire
        transaction.update(matchRef, { voteClos: true, topJoueurs });
        weClosedIt = true;
    });

    // Incrémenter les trophées UNIQUEMENT si c'est nous qui avons fermé le vote
    if (!weClosedIt) return;

    const batch = db.batch();
    const tropheeKeys = ['or', 'argent', 'bronze'];
    for (const top of topJoueurs) {
        const key = tropheeKeys[top.rang - 1];
        if (key) {
            const joueurRef = db.collection('groupes').doc(groupeId)
                .collection('joueurs').doc(top.uid);
            batch.update(joueurRef, {
                [`trophees.${key}`]: admin.firestore.FieldValue.increment(1)
            });
        }
    }
    await batch.commit();
}

// ========== TRIGGERED: Fermeture automatique quand tous ont voté ==========
exports.onVoteCreated = onDocumentCreated({
    document: 'groupes/{groupeId}/matchs/{matchId}/votes/{votantId}',
    region: REGION,
}, async (event) => {
    const { groupeId, matchId } = event.params;
    const matchRef = db.collection('groupes').doc(groupeId).collection('matchs').doc(matchId);

    const matchSnap = await matchRef.get();
    if (!matchSnap.exists || matchSnap.data().voteClos) return;

    const matchData = matchSnap.data();
    const presentsCount = matchData.presentsCount || 0;
    if (presentsCount === 0) return;

    const votesSnap = await matchRef.collection('votes').get();
    if (votesSnap.size >= presentsCount) {
        await closeVotesAndUpdateTrophies(groupeId, matchId, matchData);
    }
});

// ========== TRIGGERED: Promotion liste d'attente après annulation ==========
exports.onInscriptionDeleted = onDocumentDeleted({
    document: 'groupes/{groupeId}/matchs_semaine/{matchId}/inscriptions/{uid}',
    region: REGION,
}, async (event) => {
    const deleted = event.data.data();
    if (deleted.statut !== 'confirmé') return;

    const { groupeId, matchId } = event.params;
    const matchRef = db.collection('groupes').doc(groupeId)
        .collection('matchs_semaine').doc(matchId);

    const waitlistSnap = await matchRef.collection('inscriptions')
        .where('statut', '==', 'attente')
        .orderBy('dateInscription', 'asc')
        .limit(1)
        .get();

    if (!waitlistSnap.empty) {
        const waiterRef = waitlistSnap.docs[0].ref;
        // Transaction atomique : vérifie que le joueur est ENCORE en attente
        // avant de le promouvoir. Deux CF concurrentes peuvent trouver le même
        // joueur — seule la première transaction réussit, la seconde voit
        // statut='confirmé' et abandonne (pas de double-promotion).
        await db.runTransaction(async (transaction) => {
            const waiterSnap = await transaction.get(waiterRef);
            if (!waiterSnap.exists || waiterSnap.data().statut !== 'attente') return;
            transaction.update(waiterRef, { statut: 'confirmé' });
            transaction.update(matchRef, { confirmedCount: admin.firestore.FieldValue.increment(1) });
        });
    }
});
