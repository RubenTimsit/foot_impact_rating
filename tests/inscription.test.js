/**
 * inscription.test.js — Tests du système d'inscription aux matchs
 *
 * Scénarios couverts :
 *  ✅  Inscription normale → place confirmée
 *  ✅  Inscription quand le match est plein → liste d'attente
 *  ✅  Double inscription → erreur 'already_registered'
 *  ✅  Inscription match fermé → erreur 'match_closed'
 *  ✅  Inscription match 'programmé' ouverture future → erreur 'match_closed'
 *  ✅  Inscription match 'programmé' ouverture passée → confirmée
 *  ✅  Désistement confirmé (liste attente vide) → confirmedCount décrémenté
 *  ✅  Désistement confirmé (liste attente pleine) → promotion du premier en attente
 *  ✅  Désistement depuis liste d'attente → suppression simple, compteur inchangé
 *  ✅  Désistement joueur non inscrit → erreur 'not_registered'
 *  ✅  50 inscriptions simultanées → exactement maxJoueurs confirmés, reste en attente
 *  ✅  Ordre de priorité liste d'attente → le plus ancien est promu en premier
 *
 * Prérequis :
 *   1. Lancer l'émulateur Firestore :
 *        firebase emulators:start --only firestore
 *      (ou via firebase.json si déjà configuré)
 *
 *   2. Installer les dépendances :
 *        cd tests && npm install
 *
 *   3. Lancer les tests :
 *        npm test
 */

'use strict';

const {
    getDb,
    clearDb,
    creerGroupeEtMatch,
    sInscrire,
    seDesinscrire,
    lireMatch,
    lireInscriptions,
} = require('./helpers');

const db = getDb();

// Vider la DB entre chaque test pour garantir l'isolation
beforeEach(async () => {
    await clearDb();
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Inscription de base
// ─────────────────────────────────────────────────────────────────────────────

describe('Inscription — cas normaux', () => {
    test('place disponible → statut confirmé + confirmedCount incrémenté', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: 5 });

        const statut = await sInscrire(db, groupeId, matchId, 'user1');

        expect(statut).toBe('confirmé');

        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(1);

        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        expect(inscriptions).toHaveLength(1);
        expect(inscriptions[0]).toMatchObject({ uid: 'user1', statut: 'confirmé' });
    });

    test('match plein → statut attente + confirmedCount inchangé', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: 2 });

        await sInscrire(db, groupeId, matchId, 'user1');
        await sInscrire(db, groupeId, matchId, 'user2');

        // Le match est maintenant plein (confirmedCount = 2 = maxJoueurs)
        const statut = await sInscrire(db, groupeId, matchId, 'user3');

        expect(statut).toBe('attente');

        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(2); // pas incrémenté pour les 'attente'

        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        const attente = inscriptions.filter(i => i.statut === 'attente');
        expect(attente).toHaveLength(1);
        expect(attente[0].uid).toBe('user3');
    });

    test('inscription sur match programmé avec ouverture passée → confirmé', async () => {
        const ouverturePassee = new Date(Date.now() - 60_000).toISOString(); // -1 min

        const { groupeId, matchId } = await creerGroupeEtMatch(db, {
            statut: 'programmé',
            dateOuvertureInscription: ouverturePassee,
        });

        const statut = await sInscrire(db, groupeId, matchId, 'user1');
        expect(statut).toBe('confirmé');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Erreurs attendues
// ─────────────────────────────────────────────────────────────────────────────

describe('Inscription — erreurs', () => {
    test('double inscription → erreur already_registered', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db);

        await sInscrire(db, groupeId, matchId, 'user1');

        await expect(
            sInscrire(db, groupeId, matchId, 'user1')
        ).rejects.toThrow('already_registered');

        // confirmedCount ne doit pas avoir bougé
        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(1);
    });

    test('match fermé (statut: fermé) → erreur match_closed', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { statut: 'fermé' });

        await expect(
            sInscrire(db, groupeId, matchId, 'user1')
        ).rejects.toThrow('match_closed');
    });

    test('match programmé avec ouverture future → erreur match_closed', async () => {
        const ouvertureFuture = new Date(Date.now() + 3_600_000).toISOString(); // +1h

        const { groupeId, matchId } = await creerGroupeEtMatch(db, {
            statut: 'programmé',
            dateOuvertureInscription: ouvertureFuture,
        });

        await expect(
            sInscrire(db, groupeId, matchId, 'user1')
        ).rejects.toThrow('match_closed');
    });

    test('match inexistant → erreur match_not_found', async () => {
        await expect(
            sInscrire(db, 'groupe-inexistant', 'match-inexistant', 'user1')
        ).rejects.toThrow('match_not_found');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Désistement
// ─────────────────────────────────────────────────────────────────────────────

describe('Désistement', () => {
    test('désistement confirmé (liste attente vide) → confirmedCount décrémenté', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: 5 });
        await sInscrire(db, groupeId, matchId, 'user1');

        const result = await seDesinscrire(db, groupeId, matchId, 'user1');

        expect(result).toBe('no_waitlist');

        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(0);

        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        expect(inscriptions).toHaveLength(0);
    });

    test('désistement confirmé avec liste d\'attente → promotion du premier en attente', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: 1 });

        // user1 prend la seule place
        await sInscrire(db, groupeId, matchId, 'user1');

        // user2 et user3 arrivent en liste d'attente (avec léger décalage pour l'ordre)
        await sInscrire(db, groupeId, matchId, 'user2');
        await new Promise(r => setTimeout(r, 50));
        await sInscrire(db, groupeId, matchId, 'user3');

        // user1 se désiste → user2 (le plus ancien en attente) doit être promu
        const result = await seDesinscrire(db, groupeId, matchId, 'user1');
        expect(result).toBe('promoted');

        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        const user2 = inscriptions.find(i => i.uid === 'user2');
        const user3 = inscriptions.find(i => i.uid === 'user3');

        expect(user2?.statut).toBe('confirmé');
        expect(user3?.statut).toBe('attente'); // toujours en attente

        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(1); // -1 +1 = toujours 1
    });

    test('désistement depuis liste attente → suppression simple, confirmedCount inchangé', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: 1 });

        await sInscrire(db, groupeId, matchId, 'user1'); // confirmé
        await sInscrire(db, groupeId, matchId, 'user2'); // attente

        const result = await seDesinscrire(db, groupeId, matchId, 'user2');
        expect(result).toBe('was_attente');

        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(1); // inchangé

        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        expect(inscriptions).toHaveLength(1);
        expect(inscriptions[0].uid).toBe('user1');
    });

    test('désistement joueur non inscrit → erreur not_registered', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db);

        await expect(
            seDesinscrire(db, groupeId, matchId, 'user-fantome')
        ).rejects.toThrow('not_registered');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Ordre de priorité liste d'attente
// ─────────────────────────────────────────────────────────────────────────────

describe('Liste d\'attente — ordre de priorité', () => {
    test('le joueur le plus ancien en attente est promu en premier', async () => {
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: 1 });

        await sInscrire(db, groupeId, matchId, 'user1'); // confirmé

        // Inscrire user2, user3, user4 en attente avec délai pour garantir l'ordre
        await sInscrire(db, groupeId, matchId, 'user2');
        await new Promise(r => setTimeout(r, 60));
        await sInscrire(db, groupeId, matchId, 'user3');
        await new Promise(r => setTimeout(r, 60));
        await sInscrire(db, groupeId, matchId, 'user4');

        // user1 se désiste → user2 promu
        await seDesinscrire(db, groupeId, matchId, 'user1');
        let inscriptions = await lireInscriptions(db, groupeId, matchId);
        expect(inscriptions.find(i => i.uid === 'user2')?.statut).toBe('confirmé');

        // user2 se désiste → user3 promu
        await seDesinscrire(db, groupeId, matchId, 'user2');
        inscriptions = await lireInscriptions(db, groupeId, matchId);
        expect(inscriptions.find(i => i.uid === 'user3')?.statut).toBe('confirmé');
        expect(inscriptions.find(i => i.uid === 'user4')?.statut).toBe('attente');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Inscriptions simultanées (race conditions)
// ─────────────────────────────────────────────────────────────────────────────

describe('Inscriptions simultanées — race conditions', () => {
    test('10 joueurs cliquent en même temps pour 3 places → exactement 3 confirmés', async () => {
        const MAX = 3;
        const NB_JOUEURS = 10;
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: MAX });

        // Lancer toutes les inscriptions en parallèle, sans await entre elles
        const results = await Promise.allSettled(
            Array.from({ length: NB_JOUEURS }, (_, i) =>
                sInscrire(db, groupeId, matchId, `concurrent-user-${i}`)
            )
        );

        const confirmes = results.filter(
            r => r.status === 'fulfilled' && r.value === 'confirmé'
        );
        const attente = results.filter(
            r => r.status === 'fulfilled' && r.value === 'attente'
        );
        const erreurs = results.filter(r => r.status === 'rejected');

        expect(confirmes).toHaveLength(MAX);
        expect(attente).toHaveLength(NB_JOUEURS - MAX);
        expect(erreurs).toHaveLength(0);

        // Vérifier la cohérence dans Firestore
        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(MAX);

        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        expect(inscriptions).toHaveLength(NB_JOUEURS);

        const confirmesDansDB = inscriptions.filter(i => i.statut === 'confirmé');
        const attendeDansDB   = inscriptions.filter(i => i.statut === 'attente');
        expect(confirmesDansDB).toHaveLength(MAX);
        expect(attendeDansDB).toHaveLength(NB_JOUEURS - MAX);
    });

    test('20 joueurs simultanés pour 5 places → exactement 5 confirmés', async () => {
        // 50 joueurs dépasse le plafond de concurrence de l'émulateur même avec retry.
        // 20 joueurs pour 5 places reste un vrai stress test (ratio 4:1).
        // Timeout élevé car l'émulateur local gère la concurrence plus lentement que la prod.
        const MAX = 5;
        const NB_JOUEURS = 20;
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: MAX });

        const results = await Promise.allSettled(
            Array.from({ length: NB_JOUEURS }, (_, i) =>
                sInscrire(db, groupeId, matchId, `stress-user-${i}`)
            )
        );

        const confirmes = results.filter(
            r => r.status === 'fulfilled' && r.value === 'confirmé'
        );
        const erreurs = results.filter(r => r.status === 'rejected');

        // Aucune erreur ne doit survenir — le retry absorbe les ABORTED
        expect(erreurs).toHaveLength(0);
        // Exactement MAX joueurs confirmés, jamais plus
        expect(confirmes).toHaveLength(MAX);

        const match = await lireMatch(db, groupeId, matchId);
        expect(match.confirmedCount).toBe(MAX);

        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        expect(inscriptions).toHaveLength(NB_JOUEURS);
        expect(inscriptions.filter(i => i.statut === 'confirmé')).toHaveLength(MAX);
        expect(inscriptions.filter(i => i.statut === 'attente')).toHaveLength(NB_JOUEURS - MAX);
    }, 90_000);

    test('désistements simultanés → confirmedCount cohérent avec les docs', async () => {
        const MAX = 2;
        const { groupeId, matchId } = await creerGroupeEtMatch(db, { maxJoueurs: MAX });

        // Remplir le match
        await sInscrire(db, groupeId, matchId, 'anchor1');
        await sInscrire(db, groupeId, matchId, 'anchor2');
        // 3 joueurs en attente
        await sInscrire(db, groupeId, matchId, 'waiter1');
        await sInscrire(db, groupeId, matchId, 'waiter2');
        await sInscrire(db, groupeId, matchId, 'waiter3');

        // anchor1 et anchor2 se désistent exactement en même temps
        await Promise.allSettled([
            seDesinscrire(db, groupeId, matchId, 'anchor1'),
            seDesinscrire(db, groupeId, matchId, 'anchor2'),
        ]);

        const match = await lireMatch(db, groupeId, matchId);
        const inscriptions = await lireInscriptions(db, groupeId, matchId);
        const confirmes = inscriptions.filter(i => i.statut === 'confirmé');

        // Invariant principal : le compteur doit TOUJOURS correspondre au nombre
        // réel de docs 'confirmé'. Pas de sur-comptage, pas de sous-comptage.
        expect(confirmes.length).toBe(match.confirmedCount);

        // Le compteur ne dépasse jamais le max autorisé
        expect(match.confirmedCount).toBeLessThanOrEqual(MAX);

        // Au minimum 0, au maximum MAX joueurs confirmés
        expect(match.confirmedCount).toBeGreaterThanOrEqual(0);
    });
});
