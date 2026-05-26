const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
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

    const groupesSnap = await db.collection('groupes')
        .where('configHebdo.actif', '==', true)
        .where('configHebdo.recurring', '==', true)
        .get();

    for (const groupeDoc of groupesSnap.docs) {
        const config = groupeDoc.data().configHebdo;

        // 1. Fermer les matchs dont l'heure est passée
        const ouvertsSnap = await db.collection('groupes').doc(groupeDoc.id)
            .collection('matchs_semaine').where('statut', '==', 'ouvert').get();
        for (const matchDoc of ouvertsSnap.docs) {
            if (now >= new Date(matchDoc.data().dateMatch)) {
                await matchDoc.ref.update({ statut: 'fermé' });
            }
        }

        // 2. Flip 'programmé' → 'ouvert' (fallback si le client n'a pas encore ouvert)
        //    + pré-créer le créneau suivant
        const programmeSnap = await db.collection('groupes').doc(groupeDoc.id)
            .collection('matchs_semaine').where('statut', '==', 'programmé').get();

        for (const matchDoc of programmeSnap.docs) {
            const data = matchDoc.data();
            if (!data.dateOuvertureInscription) continue;
            const ouvertureDate = new Date(data.dateOuvertureInscription);

            if (now >= ouvertureDate) {
                // Flip ce doc à 'ouvert'
                await matchDoc.ref.update({ statut: 'ouvert' });

                // Prochaine ouverture = ouvertureDate + 7 jours
                const nextOuverture = new Date(ouvertureDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                await groupeDoc.ref.update({ 'configHebdo.nextOuvertureDate': nextOuverture.toISOString() });

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

        // 3. Si aucun doc à venir (programmé ou ouvert) n'existe → en créer un (rattrapage)
        const upcomingSnap = await db.collection('groupes').doc(groupeDoc.id)
            .collection('matchs_semaine')
            .where('statut', 'in', ['programmé', 'ouvert'])
            .get();

        if (upcomingSnap.empty && config.nextOuvertureDate) {
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
        const batch = db.batch();
        batch.update(waitlistSnap.docs[0].ref, { statut: 'confirmé' });
        batch.update(matchRef, { confirmedCount: admin.firestore.FieldValue.increment(1) });
        await batch.commit();
    }
});
