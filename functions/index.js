const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentDeleted, onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { DateTime } = require('luxon');

admin.initializeApp();
const db = admin.firestore();

const TIMEZONE = 'Asia/Jerusalem';
const REGION = 'europe-west1';
const APP_URL = 'https://foot-4f0c2.web.app';

// Noms des jours/mois en français pour le formatage des dates dans les notifications
const FR_JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const FR_MOIS  = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDateFR(isoString) {
    const d = DateTime.fromISO(isoString).setZone(TIMEZONE);
    const heure = d.toFormat('HH');
    const min   = d.toFormat('mm');
    const heureLabel = min === '00' ? `${heure}h` : `${heure}h${min}`;
    return `${FR_JOURS[d.weekday]} ${d.day} ${FR_MOIS[d.month]} à ${heureLabel}`;
}

// ── Helpers notifications ──────────────────────────────────────────────────

/**
 * Récupère les uids des membres actifs d'un groupe.
 * Si sousGroupesCibles est fourni, inclut les membres sans sous-groupe
 * ET ceux dont le sous-groupe est dans la liste.
 */
async function getMembresActifs(groupeId, sousGroupesCibles = null) {
    const snap = await db.collection('groupes').doc(groupeId)
        .collection('joueurs').where('statut', '==', 'active').get();
    if (!sousGroupesCibles || sousGroupesCibles.length === 0) {
        return snap.docs.map(d => d.id);
    }
    return snap.docs
        .filter(d => {
            const sg = d.data().sousGroupe;
            return sg == null || sousGroupesCibles.includes(sg);
        })
        .map(d => d.id);
}

/**
 * Envoie une notification push aux utilisateurs dont les uids sont fournis.
 * Les messages sont data-only : le service worker gère l'affichage via onBackgroundMessage.
 * Les messages reçus en foreground sont gérés par onMessage dans notifications.js.
 */
async function sendNotifToUsers(uids, title, body, route) {
    if (!uids || uids.length === 0) return;

    // Récupérer les tokens FCM stockés dans les profils utilisateurs
    const tokenSnaps = await Promise.all(
        uids.map(uid => db.collection('users').doc(uid).get().catch(() => null))
    );
    const tokenMap = {}; // token → uid (pour nettoyer les tokens invalides)
    tokenSnaps.forEach((snap, i) => {
        if (!snap || !snap.exists) return;
        for (const token of (snap.data().fcmTokens || [])) {
            tokenMap[token] = uids[i];
        }
    });
    const tokens = Object.keys(tokenMap);
    if (tokens.length === 0) return;

    try {
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            data: { title, body, url: `${APP_URL}/app${route}` },
            webpush: { headers: { Urgency: 'high', TTL: '86400' } },
            android: { priority: 'high' },
        });

        // Nettoyer les tokens invalides (expirés ou désinscrits)
        const batch = db.batch();
        let hasBatch = false;
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const code = resp.error?.code || '';
                if (
                    code === 'messaging/invalid-registration-token' ||
                    code === 'messaging/registration-token-not-registered'
                ) {
                    const invalidToken = tokens[idx];
                    const uid = tokenMap[invalidToken];
                    if (uid) {
                        batch.update(db.collection('users').doc(uid), {
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(invalidToken),
                        });
                        hasBatch = true;
                    }
                }
            }
        });
        if (hasBatch) await batch.commit();
    } catch (err) {
        console.error('[FCM] Erreur envoi notifications :', err.message);
    }
}

// Correspondance nom français → numéro Luxon (1=Lun, 7=Dim)
const JOUR_LUXON = { Lundi:1, Mardi:2, Mercredi:3, Jeudi:4, Vendredi:5, Samedi:6, Dimanche:7 };

/**
 * Calcule la date du match à partir de la date d'ouverture des inscriptions.
 * matchJour : nom français ("Lundi"…"Dimanche") OU numéro Luxon 1-7 (compat legacy)
 */
function getMatchDate(ouvertureDate, matchJour, matchHeure) {
    const [h, m] = matchHeure.split(':').map(Number);
    // Accepte string "Lundi" ou ancien entier (0=Dim legacy → 7 Luxon)
    let luxonJour;
    if (typeof matchJour === 'string') {
        luxonJour = JOUR_LUXON[matchJour] ?? 1;
    } else {
        luxonJour = matchJour === 0 ? 7 : matchJour;
    }

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

    // ── ÉTAPE 1 : Flip 'programmé' → 'ouvert' pour TOUS les groupes ────────────
    // Cette requête collectionGroup couvre les créneaux manuels ET récurrents,
    // quel que soit le groupe (même sans configHebdoActif).
    const programmeSnap = await db.collectionGroup('matchs_semaine')
        .where('statut', '==', 'programmé')
        .get();

    // Fenêtre "10 min avant ouverture" : ouverture entre now+5min et now+20min
    const ouvertureReminderStart = new Date(now.getTime() +  5 * 60 * 1000);
    const ouvertureReminderEnd   = new Date(now.getTime() + 20 * 60 * 1000);

    for (const matchDoc of programmeSnap.docs) {
        const matchData = matchDoc.data();
        if (!matchData.dateOuvertureInscription) continue;
        const ouvertureTime = new Date(matchData.dateOuvertureInscription);

        if (now >= ouvertureTime) {
            await matchDoc.ref.update({ statut: 'ouvert' });

            // Notifier les membres du groupe que les inscriptions sont ouvertes
            try {
                const gId = matchDoc.ref.parent.parent.id;
                const dateLabel = matchData.dateMatch ? formatDateFR(matchData.dateMatch) : 'prochainement';
                const uids = await getMembresActifs(gId, matchData.sousGroupesCibles || null);
                await sendNotifToUsers(
                    uids,
                    '⚽ Inscriptions ouvertes !',
                    `Le match du ${dateLabel} est ouvert. Inscris-toi !`,
                    '#/match'
                );
            } catch (e) {
                console.error('[FCM] Erreur notif créneau ouvert :', e.message);
            }

        } else if (!matchData.ouvertureReminderSent &&
                   ouvertureTime >= ouvertureReminderStart &&
                   ouvertureTime <= ouvertureReminderEnd) {
            // Rappel ~10 min avant l'ouverture des inscriptions
            try {
                const gId = matchDoc.ref.parent.parent.id;
                const dateLabel = matchData.dateMatch ? formatDateFR(matchData.dateMatch) : 'prochainement';
                const dt = DateTime.fromISO(matchData.dateOuvertureInscription).setZone(TIMEZONE);
                const heureOuv = dt.toFormat('mm') === '00' ? dt.toFormat("HH'h'") : dt.toFormat("HH'h'mm");
                const uids = await getMembresActifs(gId, matchData.sousGroupesCibles || null);
                await sendNotifToUsers(
                    uids,
                    '⏳ Inscriptions bientôt ouvertes !',
                    `Les inscriptions pour le match du ${dateLabel} ouvrent à ${heureOuv}.`,
                    '#/match'
                );
                await matchDoc.ref.update({ ouvertureReminderSent: true });
            } catch (e) {
                console.error('[FCM] Erreur notif rappel ouverture :', e.message);
            }
        }
    }

    // ── ÉTAPE 2 : Fermer les matchs dont l'heure est passée + rappel 1h avant ──
    const ouvertsSnap = await db.collectionGroup('matchs_semaine')
        .where('statut', '==', 'ouvert')
        .get();

    const reminderWindowStart = new Date(now.getTime() + 55 * 60 * 1000);
    const reminderWindowEnd   = new Date(now.getTime() + 65 * 60 * 1000);

    for (const matchDoc of ouvertsSnap.docs) {
        const d = matchDoc.data();
        if (!d.dateMatch) continue;
        const matchTime = new Date(d.dateMatch);

        if (now >= matchTime) {
            await matchDoc.ref.update({ statut: 'fermé' });
        } else if (!d.reminderSent && matchTime >= reminderWindowStart && matchTime <= reminderWindowEnd) {
            // Rappel 1h avant pour les joueurs confirmés
            try {
                const gId = matchDoc.ref.parent.parent.id;
                const confirmedSnap = await matchDoc.ref.collection('inscriptions')
                    .where('statut', '==', 'confirmé').get();
                const uids = confirmedSnap.docs.map(ins => ins.data().userId || ins.id);

                if (uids.length > 0) {
                    const dt = DateTime.fromISO(d.dateMatch).setZone(TIMEZONE);
                    const heureLabel = dt.toFormat('mm') === '00'
                        ? dt.toFormat("HH'h'")
                        : dt.toFormat("HH'h'mm");
                    await sendNotifToUsers(
                        uids,
                        '⏰ Match dans 1 heure !',
                        `Votre match commence à ${heureLabel}. N'oublie pas tes crampons !`,
                        '#/match'
                    );
                }
                await matchDoc.ref.update({ reminderSent: true });
            } catch (e) {
                console.error('[FCM] Erreur notif rappel match :', e.message);
            }
        }
    }

    // ── ÉTAPE 3 : Récurrences hebdo — pré-créer le créneau suivant ─────────────
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

        const configs = [];
        if (data.configHebdos) {
            Object.entries(data.configHebdos).forEach(([id, cfg]) => {
                if (cfg.actif) configs.push({ _id: id, ...cfg });
            });
        } else if (data.configHebdo?.actif && data.configHebdo?.recurring) {
            configs.push({ _id: 'legacy', ...data.configHebdo });
        }

        for (const config of configs) {
            if (!config.nextOuvertureDate) continue;

            const nextOuverture   = new Date(config.nextOuvertureDate);
            const PRE_CREATE_MS   = 3 * 24 * 60 * 60 * 1000; // 3 jours avant l'ouverture

            // Pré-créer le créneau 3 jours avant l'ouverture (ou immédiatement si déjà passé)
            if (now >= nextOuverture.getTime() - PRE_CREATE_MS) {
                const upcomingSnap = await db.collection('groupes').doc(groupeDoc.id)
                    .collection('matchs_semaine')
                    .where('statut', 'in', ['programmé', 'ouvert'])
                    .get();

                const alreadyExists = upcomingSnap.docs.some(d =>
                    d.data().dateOuvertureInscription === config.nextOuvertureDate
                );

                if (!alreadyExists) {
                    const dateMatch = getMatchDate(
                        nextOuverture,
                        config.jour ?? config.matchJour,
                        config.heure ?? config.matchHeure
                    );

                    // Si on est déjà après l'heure d'ouverture (rattrapage) → ouvert directement
                    // Sinon → programmé, l'ÉTAPE 1 le passera à ouvert à l'heure exacte
                    const statut = now >= nextOuverture ? 'ouvert' : 'programmé';

                    const heure         = config.heure         ?? config.matchHeure    ?? '18:00';
                    const heureOuverture = config.heureOuverture ?? '22:00';
                    const slotData = {
                        dateMatch:                dateMatch.toISOString(),
                        heureMatch:               heure,
                        heureOuverture:           heureOuverture,
                        dateOuvertureInscription: nextOuverture.toISOString(),
                        maxJoueurs:               config.maxJoueurs || config.maxJoueursMatch || 10,
                        statut,
                        confirmedCount:           0,
                        sourceHebdo:              config._id,
                        dateCreation:             admin.firestore.FieldValue.serverTimestamp(),
                    };
                    if (config.sousGroupesCibles && config.sousGroupesCibles.length) {
                        slotData.sousGroupesCibles = config.sousGroupesCibles;
                    }
                    await db.collection('groupes').doc(groupeDoc.id).collection('matchs_semaine').add(slotData);

                    // Avancer nextOuvertureDate d'une semaine pour le cycle suivant
                    const nextNextOuverture = new Date(nextOuverture.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const updateKey = config._id !== 'legacy'
                        ? `configHebdos.${config._id}.nextOuvertureDate`
                        : 'configHebdo.nextOuvertureDate';
                    await groupeDoc.ref.update({ [updateKey]: nextNextOuverture.toISOString() });
                }
            }
        }

        // ── ÉTAPE 4 : Fermer les votes expirés (24h après le match) ───────────
        const expiredVotesSnap = await db.collection('groupes').doc(groupeDoc.id)
            .collection('matchs')
            .where('voteClos', '==', false)
            .get();

        for (const matchDoc of expiredVotesSnap.docs) {
            const md = matchDoc.data();
            if (md.statut !== 'joue' || !md.dateVoteFermeture) continue;
            // dateVoteFermeture peut être un Timestamp Firestore ou une string ISO
            const fermetureDate = md.dateVoteFermeture?.toDate
                ? md.dateVoteFermeture.toDate()
                : new Date(md.dateVoteFermeture);
            if (now >= fermetureDate) {
                try {
                    await closeVotesAndUpdateTrophies(groupeDoc.id, matchDoc.id, md);
                } catch (e) {
                    console.error(`Erreur fermeture vote ${matchDoc.id}:`, e);
                }
            }
        }
    }
});

// Bonus ELO appliqué au top 1/2/3 MOM après fermeture du vote.
// Calculé sur la valeur absolue du changement du match (toujours positif).
const MOM_BONUS_PCT = { 1: 0.75, 2: 0.40, 3: 0.20 };

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

    // Calcul des bonus ELO MOM (basé sur le changement du match, toujours positif)
    const changements = matchData.changements || {};
    const momBonuses = {};
    for (const top of topJoueurs) {
        const pct = MOM_BONUS_PCT[top.rang];
        if (!pct) continue;
        const changement = changements[top.uid]?.changement;
        if (changement === undefined) continue;
        const bonus = Math.round(Math.abs(changement) * pct);
        if (bonus > 0) momBonuses[top.uid] = bonus;
    }

    // Transaction atomique : seule l'instance qui bascule voteClos false→true
    // met à jour les trophées. Si une autre CF a déjà fermé, on s'arrête.
    let weClosedIt = false;
    await db.runTransaction(async (transaction) => {
        weClosedIt = false; // reset à chaque retry de la transaction
        const snap = await transaction.get(matchRef);
        if (!snap.exists || snap.data().voteClos) return; // Déjà fermé → rien à faire
        transaction.update(matchRef, { voteClos: true, topJoueurs, momBonuses });
        weClosedIt = true;
    });

    // Incrémenter les trophées ET les bonus ELO UNIQUEMENT si c'est nous qui avons fermé le vote
    if (!weClosedIt) return;

    const batch = db.batch();
    const tropheeKeys = ['or', 'argent', 'bronze'];
    for (const top of topJoueurs) {
        const key = tropheeKeys[top.rang - 1];
        const joueurRef = db.collection('groupes').doc(groupeId)
            .collection('joueurs').doc(top.uid);
        const updates = {};
        if (key) updates[`trophees.${key}`] = admin.firestore.FieldValue.increment(1);
        if (momBonuses[top.uid]) updates.rating = admin.firestore.FieldValue.increment(momBonuses[top.uid]);
        if (Object.keys(updates).length > 0) batch.update(joueurRef, updates);
    }
    await batch.commit();

    // Notifier tous les membres du groupe des résultats MOM
    try {
        const momUid = topJoueurs.find(j => j.rang === 1)?.uid;
        let momName = 'le Man of the Match';
        if (momUid) {
            const joueurSnap = await db.collection('groupes').doc(groupeId)
                .collection('joueurs').doc(momUid).get();
            if (joueurSnap.exists) momName = joueurSnap.data().displayName || momName;
        }
        const membres = await getMembresActifs(groupeId);
        await sendNotifToUsers(
            membres,
            '🥇 Résultats Man of the Match !',
            `${momName} est le Man of the Match !`,
            '#/synergies'
        );
    } catch (e) {
        console.error('[FCM] Erreur notif résultats MOM :', e.message);
    }

    // Notifications personnalisées pour le podium (top 1, 2, 3)
    const PODIUM_NOTIFS = [
        { rang: 1, titre: '🥇 Tu es Man of the Match !',      corps: 'Bravo ! Tu as été élu meilleur joueur du match. 🎉' },
        { rang: 2, titre: '🥈 Tu termines 2ème du vote MOM !', corps: 'Belle performance ! Tu es 2ème du classement MOM. 👏' },
        { rang: 3, titre: '🥉 Tu termines 3ème du vote MOM !', corps: 'Bien joué ! Tu es dans le top 3 du vote MOM.' },
    ];
    for (const { rang, titre, corps } of PODIUM_NOTIFS) {
        const joueur = topJoueurs.find(j => j.rang === rang);
        if (!joueur) continue;
        try {
            await sendNotifToUsers([joueur.uid], titre, corps, '#/synergies');
        } catch (e) {
            console.error(`[FCM] Erreur notif podium rang ${rang} :`, e.message);
        }
    }
}

// ========== TRIGGERED: Match complet (confirmedCount atteint maxJoueurs) ============
exports.onMatchComplet = onDocumentUpdated({
    document: 'groupes/{groupeId}/matchs_semaine/{matchId}',
    region: REGION,
}, async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    const maxJ = after.maxJoueurs || 10;

    // Déclencher uniquement quand on VIENT D'atteindre la limite pour la première fois
    if (
        after.confirmedCount  <  maxJ ||
        before.confirmedCount >= maxJ ||
        after.fullNotifSent
    ) return;

    await event.data.after.ref.update({ fullNotifSent: true });

    const { groupeId, matchId } = event.params;
    try {
        const confirmedSnap = await db
            .collection('groupes').doc(groupeId)
            .collection('matchs_semaine').doc(matchId)
            .collection('inscriptions').where('statut', '==', 'confirmé').get();
        const uids = confirmedSnap.docs.map(d => d.data().userId || d.id);

        const dateLabel = after.dateMatch ? formatDateFR(after.dateMatch) : 'à venir';
        await sendNotifToUsers(
            uids,
            '✅ Match complet !',
            `Le match du ${dateLabel} est complet. Tu es bien inscrit !`,
            '#/match'
        );
    } catch (e) {
        console.error('[FCM] Erreur notif match complet :', e.message);
    }
});

// ========== TRIGGERED: Joueur accepté dans un groupe ================================
exports.onJoueurAccepte = onDocumentUpdated({
    document: 'groupes/{groupeId}/joueurs/{joueurId}',
    region: REGION,
}, async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    if (before.statut !== 'pending' || after.statut !== 'active') return;

    const { groupeId, joueurId } = event.params;
    try {
        const groupeSnap = await db.collection('groupes').doc(groupeId).get();
        const groupeNom  = groupeSnap.exists ? (groupeSnap.data().nom || 'ton groupe') : 'ton groupe';
        await sendNotifToUsers(
            [joueurId],
            '🎉 Demande acceptée !',
            `Tu es maintenant membre de ${groupeNom}. Bienvenue !`,
            '#/'
        );
    } catch (e) {
        console.error('[FCM] Erreur notif joueur accepté :', e.message);
    }
});

// ========== TRIGGERED: Notifier l'admin quand un joueur demande à rejoindre ==========
exports.onJoueurPending = onDocumentCreated({
    document: 'groupes/{groupeId}/joueurs/{joueurId}',
    region: REGION,
}, async (event) => {
    const { groupeId } = event.params;
    const joueurData = event.data.data();

    if (joueurData.statut !== 'pending') return;

    const groupeSnap = await db.collection('groupes').doc(groupeId).get();
    if (!groupeSnap.exists) return;

    const groupeData = groupeSnap.data();
    const adminId    = groupeData.adminId;
    if (!adminId) return;

    const joueurNom  = joueurData.displayName || 'Un joueur';
    const groupeNom  = groupeData.nom || 'ton groupe';

    await sendNotifToUsers(
        [adminId],
        '👋 Nouvelle demande d\'adhésion',
        `${joueurNom} demande à rejoindre ${groupeNom}`,
        '#/admin'
    );
});

// ========== TRIGGERED: Vote MOM ouvert dès qu'un match est validé ==========
exports.onMatchValide = onDocumentCreated({
    document: 'groupes/{groupeId}/matchs/{matchId}',
    region: REGION,
}, async (event) => {
    const { groupeId } = event.params;
    const matchData = event.data.data();

    if (matchData.statut !== 'joue') return;

    const presents = [...(matchData.equipeA || []), ...(matchData.equipeB || [])];
    if (presents.length === 0) return;

    await sendNotifToUsers(
        presents,
        '🏆 Vote Man of the Match ouvert !',
        'Qui a été le meilleur joueur ? Votez maintenant !',
        '#/match'
    );
});

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

// ========== TRIGGERED: Créneau annulé → notifier les inscrits ==========
exports.onCreneauAnnule = onDocumentUpdated({
    document: 'groupes/{groupeId}/matchs_semaine/{matchId}',
    region: REGION,
}, async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    if (before.statut === after.statut) return;         // pas de changement de statut
    if (after.statut !== 'annulé') return;              // pas une annulation

    const { groupeId, matchId } = event.params;

    // Récupérer les inscrits confirmés
    try {
        const inscSnap = await db
            .collection('groupes').doc(groupeId)
            .collection('matchs_semaine').doc(matchId)
            .collection('inscriptions')
            .where('statut', '==', 'confirmé')
            .get();

        const uids = inscSnap.docs.map(d => d.data().userId || d.id);
        if (!uids.length) return;

        const dateLabel = after.dateMatch ? formatDateFR(after.dateMatch) : 'à venir';
        await sendNotifToUsers(
            uids,
            '❌ Match annulé',
            `Le match du ${dateLabel} a été annulé par l'admin.`,
            '#/match'
        );
    } catch (e) {
        console.error('[FCM] Erreur notif annulation créneau :', e.message);
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

    // On récupère plusieurs candidats pour couvrir le cas où deux désistements
    // simultanés font s'exécuter deux CF en parallèle : si CF-A a déjà promu
    // le 1er waiter avant que CF-B n'arrive à sa transaction, CF-B passe au
    // suivant et le promeut à son tour. Sans ce buffer, le 2ème waiter ne
    // serait jamais promu.
    const waitlistSnap = await matchRef.collection('inscriptions')
        .where('statut', '==', 'attente')
        .orderBy('dateInscription', 'asc')
        .limit(5)
        .get();

    for (const waiterDoc of waitlistSnap.docs) {
        const waiterRef = waiterDoc.ref;
        let promoted = false;
        await db.runTransaction(async (transaction) => {
            const waiterSnap = await transaction.get(waiterRef);
            if (!waiterSnap.exists || waiterSnap.data().statut !== 'attente') return;
            transaction.update(waiterRef, { statut: 'confirmé' });
            transaction.update(matchRef, { confirmedCount: admin.firestore.FieldValue.increment(1) });
            promoted = true;
        });
        if (promoted) {
            // Notifier le joueur qu'il est désormais confirmé
            try {
                const promotedUid = waiterDoc.data().userId || waiterDoc.id;
                const matchSnap   = await matchRef.get();
                const matchData   = matchSnap.data();
                const dateLabel   = matchData?.dateMatch ? formatDateFR(matchData.dateMatch) : null;
                const body = dateLabel
                    ? `Tu es inscrit au match du ${dateLabel} !`
                    : 'Une place s\'est libérée, tu es maintenant confirmé !';
                await sendNotifToUsers([promotedUid], '🎉 Tu es inscrit !', body, '#/match');
            } catch (e) {
                console.error('[FCM] Erreur notif promotion liste d\'attente :', e.message);
            }
            break;
        }
    }
});
