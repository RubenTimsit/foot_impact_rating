/**
 * helpers.js — Setup émulateur + logique d'inscription extraite
 *
 * Ces fonctions reproduisent EXACTEMENT la logique de groupe.html (sInscrire,
 * seDesinscrire) et de functions/index.js (onInscriptionDeleted) pour pouvoir
 * les tester sans navigateur.
 */

'use strict';

const admin = require('firebase-admin');

// ─── INIT ÉMULATEUR ───────────────────────────────────────────────────────────

const PROJECT_ID = 'foot-emulator-test';
const EMULATOR_HOST = 'localhost:8080';

let _app = null;

function getDb() {
    if (!_app) {
        process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
        _app = admin.initializeApp({ projectId: PROJECT_ID }, `test-${Date.now()}`);
    }
    return admin.firestore(_app);
}

/**
 * Vide entièrement la base de données de l'émulateur via l'API REST.
 * À appeler dans beforeEach pour garantir un état propre.
 */
async function clearDb() {
    const url = `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
    try {
        const res = await fetch(url, { method: 'DELETE' });
        // 404 = déjà vide, 409 = opération précédente en cours (acceptable)
        if (!res.ok && res.status !== 404 && res.status !== 409) {
            throw new Error(`Clear DB failed: ${res.status}`);
        }
    } catch (err) {
        // fetch peut ne pas être disponible sur Node < 18 — fallback silencieux
        if (err.code !== 'ECONNREFUSED') throw err;
    }
}

// ─── HELPERS DONNÉES ─────────────────────────────────────────────────────────

/**
 * Crée un groupe + un créneau de match dans l'émulateur.
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} matchOptions  Surcharge les valeurs par défaut du match.
 * @returns {{ groupeId, matchId }}
 */
async function creerGroupeEtMatch(db, matchOptions = {}) {
    const groupeId = `groupe-${Math.random().toString(36).slice(2)}`;
    const matchId  = `match-${Math.random().toString(36).slice(2)}`;

    await db
        .collection('groupes').doc(groupeId)
        .collection('matchs_semaine').doc(matchId)
        .set({
            statut: 'ouvert',
            maxJoueurs: 3,
            confirmedCount: 0,
            dateMatch: new Date(Date.now() + 86_400_000).toISOString(),
            ...matchOptions,
        });

    return { groupeId, matchId };
}

// ─── RETRY SUR ABORTED ────────────────────────────────────────────────────────

/**
 * Retente fn() si Firestore répond ABORTED (conflit de transaction).
 * Le SDK Firebase Client fait pareil automatiquement en production.
 * L'émulateur a un plafond de concurrence plus bas → les timeouts sont plus
 * fréquents qu'en prod, d'où le besoin de retry explicite dans les tests.
 */
async function withRetry(fn, maxRetries = 7) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const isAborted =
                err.code === 10 ||
                (err.message && (
                    err.message.includes('ABORTED') ||
                    err.message.includes('Transaction lock timeout') ||
                    err.message.includes('contention')
                ));

            // Ne pas retenter les erreurs métier (already_registered, match_closed…)
            if (!isAborted) throw err;
            if (attempt >= maxRetries) throw err;

            // Backoff exponentiel avec jitter pour éviter la synchronisation des retries
            const delay = Math.min(Math.pow(2, attempt) * 50 + Math.random() * 100, 2000);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ─── LOGIQUE D'INSCRIPTION (miroir de groupe.html → sInscrire) ───────────────

/**
 * Inscrit un joueur à un match via une transaction Firestore.
 * Reproduit EXACTEMENT la transaction de sInscrire() dans groupe.html,
 * avec retry sur ABORTED (comme le fait le SDK Client en production).
 *
 * @returns {Promise<'confirmé'|'attente'>}
 * @throws  {Error} 'already_registered' | 'match_not_found' | 'match_closed'
 */
async function sInscrire(db, groupeId, matchId, uid, displayName = `Joueur-${uid}`) {
    const matchRef       = db.collection('groupes').doc(groupeId)
                             .collection('matchs_semaine').doc(matchId);
    const inscriptionRef = matchRef.collection('inscriptions').doc(uid);

    let statutFinal;

    await withRetry(() => db.runTransaction(async (transaction) => {
        const matchSnap = await transaction.get(matchRef);
        const inscSnap  = await transaction.get(inscriptionRef);

        if (inscSnap.exists)    throw new Error('already_registered');
        if (!matchSnap.exists)  throw new Error('match_not_found');

        const data = matchSnap.data();

        // Même logique que le client : 'ouvert' OU 'programmé' avec ouverture passée
        const isOuvert =
            data.statut === 'ouvert' ||
            (data.statut === 'programmé' &&
             data.dateOuvertureInscription &&
             new Date() >= new Date(data.dateOuvertureInscription));

        if (!isOuvert) throw new Error('match_closed');

        const confirmedCount = data.confirmedCount || 0;
        statutFinal = confirmedCount < data.maxJoueurs ? 'confirmé' : 'attente';

        transaction.set(inscriptionRef, {
            uid,
            displayName,
            position: 'Milieu',
            statut: statutFinal,
            dateInscription: new Date().toISOString(),
        });

        if (statutFinal === 'confirmé') {
            transaction.update(matchRef, {
                confirmedCount: admin.firestore.FieldValue.increment(1),
            });
        }
    }));

    return statutFinal;
}

// ─── DÉSISTEMENT + PROMOTION (miroir de seDesinscrire + onInscriptionDeleted) ─

/**
 * Annule l'inscription d'un joueur.
 * Si le joueur était confirmé : décrémente confirmedCount ET promeut le premier
 * joueur en liste d'attente (simule onInscriptionDeleted Cloud Function).
 *
 * @returns {Promise<'promoted'|'no_waitlist'|'was_attente'>}
 */
async function seDesinscrire(db, groupeId, matchId, uid) {
    const matchRef       = db.collection('groupes').doc(groupeId)
                             .collection('matchs_semaine').doc(matchId);
    const inscriptionRef = matchRef.collection('inscriptions').doc(uid);

    const inscSnap = await inscriptionRef.get();
    if (!inscSnap.exists) throw new Error('not_registered');

    const wasConfirmed = inscSnap.data().statut === 'confirmé';

    // 1. Supprimer l'inscription (comme le client)
    await inscriptionRef.delete();

    if (!wasConfirmed) return 'was_attente';

    // 2. Décrémenter confirmedCount (comme le client)
    await matchRef.update({
        confirmedCount: admin.firestore.FieldValue.increment(-1),
    });

    // 3. Promouvoir le premier de la liste d'attente avec vérification atomique.
    //    Si deux désistements arrivent simultanément, les deux trouvent peut-être
    //    le même waiter. La transaction vérifie que son statut est ENCORE 'attente'
    //    avant de le promouvoir — seul le premier commit réussit, le second voit
    //    'confirmé' et abandonne, évitant la double-promotion.
    const waitlistSnap = await matchRef
        .collection('inscriptions')
        .where('statut', '==', 'attente')
        .orderBy('dateInscription', 'asc')
        .limit(1)
        .get();

    if (waitlistSnap.empty) return 'no_waitlist';

    const waiterRef = waitlistSnap.docs[0].ref;
    let promoted = false;

    await withRetry(() => db.runTransaction(async (transaction) => {
        promoted = false;
        const waiterSnap = await transaction.get(waiterRef);
        // Vérifier que le joueur est ENCORE en attente (pas déjà promu par une CF concurrente)
        if (!waiterSnap.exists || waiterSnap.data().statut !== 'attente') return;
        transaction.update(waiterRef, { statut: 'confirmé' });
        transaction.update(matchRef, { confirmedCount: admin.firestore.FieldValue.increment(1) });
        promoted = true;
    }));

    return promoted ? 'promoted' : 'no_waitlist';
}

// ─── LECTURE D'ÉTAT ───────────────────────────────────────────────────────────

async function lireMatch(db, groupeId, matchId) {
    const snap = await db
        .collection('groupes').doc(groupeId)
        .collection('matchs_semaine').doc(matchId)
        .get();
    return snap.data();
}

async function lireInscriptions(db, groupeId, matchId) {
    const snap = await db
        .collection('groupes').doc(groupeId)
        .collection('matchs_semaine').doc(matchId)
        .collection('inscriptions')
        .get();
    return snap.docs.map(d => d.data());
}

module.exports = {
    getDb,
    clearDb,
    creerGroupeEtMatch,
    sInscrire,
    seDesinscrire,
    lireMatch,
    lireInscriptions,
};
