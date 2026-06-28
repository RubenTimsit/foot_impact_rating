// ==================== SYSTÈME DE CALCUL DE RATING ====================

const K_FACTOR    = 64;
const BASE_RATING = 1000;
const GAIN_MAX    = 150;
const PERTE_MAX   = -150;

/**
 * Probabilité de victoire de l'équipe A selon la formule ELO standard.
 */
function calculerProbabilite(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Rating moyen d'une équipe. Lit le champ `rating` (fallback sur `impactRating` pour données legacy).
 */
function calculerRatingMoyen(joueurs) {
    if (joueurs.length === 0) return BASE_RATING;
    const sum = joueurs.reduce((acc, j) => acc + (j.rating ?? j.impactRating ?? BASE_RATING), 0);
    return sum / joueurs.length;
}

/**
 * Multiplicateur basé sur l'écart de score (victoire large → changement plus grand).
 */
function calculerMultiplicateurScore(score1, score2) {
    return 1 + Math.abs(score1 - score2) / 6;
}

/**
 * Changement ELO pour un joueur.
 * @param {number} ratingJoueur       - Rating du joueur (paramètre conservé pour compatibilité)
 * @param {number} ratingEquipeAlliee - Rating moyen de son équipe
 * @param {number} ratingEquipeAdverse - Rating moyen de l'équipe adverse
 * @param {number} resultat           - 1 victoire · 0.5 nul · 0 défaite
 * @param {number} score1             - Score de son équipe
 * @param {number} score2             - Score de l'équipe adverse
 */
export function calculerChangementRating(ratingJoueur, ratingEquipeAlliee, ratingEquipeAdverse, resultat, score1, score2) {
    const probabilite    = calculerProbabilite(ratingEquipeAlliee, ratingEquipeAdverse);
    const changementBase = K_FACTOR * (resultat - probabilite);
    const multiplicateur = calculerMultiplicateurScore(score1, score2);
    return Math.round(changementBase * multiplicateur);
}

/**
 * Calcule les changements de rating ELO pour tous les joueurs d'un match.
 * Formule : ELO pur avec multiplicateur de score (victoire large → plus grand écart).
 *
 * @param {Array}  equipe1  - Joueurs équipe 1 avec { id, rating }
 * @param {Array}  equipe2  - Joueurs équipe 2 avec { id, rating }
 * @param {number} score1   - Score équipe 1
 * @param {number} score2   - Score équipe 2
 * @returns {Object} { [uid]: { ancien, changement, nouveau, resultat } }
 */
export function calculerChangementsMatch(equipe1, equipe2, score1, score2) {
    const ratingEquipe1 = calculerRatingMoyen(equipe1);
    const ratingEquipe2 = calculerRatingMoyen(equipe2);

    let res1, res2, txt1, txt2;
    if (score1 > score2) {
        res1 = 1;   res2 = 0;   txt1 = 'victoire'; txt2 = 'defaite';
    } else if (score1 < score2) {
        res1 = 0;   res2 = 1;   txt1 = 'defaite';  txt2 = 'victoire';
    } else {
        res1 = 0.5; res2 = 0.5; txt1 = 'nul';      txt2 = 'nul';
    }

    const changements = {};

    const processEquipe = (equipe, ratingAllie, ratingAdverse, resNum, resTxt, sAllie, sAdverse) => {
        equipe.forEach(joueur => {
            const ancien     = joueur.rating ?? joueur.impactRating ?? BASE_RATING;
            const delta      = calculerChangementRating(ancien, ratingAllie, ratingAdverse, resNum, sAllie, sAdverse);
            const changement = Math.max(PERTE_MAX, Math.min(GAIN_MAX, delta));
            changements[joueur.id] = {
                ancien,
                changement,
                nouveau:   ancien + changement,
                resultat:  resTxt,
            };
        });
    };

    processEquipe(equipe1, ratingEquipe1, ratingEquipe2, res1, txt1, score1, score2);
    processEquipe(equipe2, ratingEquipe2, ratingEquipe1, res2, txt2, score2, score1);

    return changements;
}

/**
 * Calcule les changements ELO d'une soirée avec 2 sous-matchs.
 *
 * Algorithme séquentiel + K pondéré :
 *  - Sous-match 1 : K × poids[0], ratings originaux
 *  - Sous-match 2 : K × poids[1], ratings post-sous-match-1
 *
 * @param {Array} sousMatchs  [{equipeA, equipeB, scoreA, scoreB}, ...]
 * @param {Array} split       [poids1, poids2]  ex: [0.5, 0.5] | [1/3, 2/3] | [0.25, 0.75]
 * @returns {{ changements, matchsJouesParJoueur }}
 *   changements = { uid: { ancien, changement, nouveau, resultats: ['victoire',...] } }
 *   matchsJouesParJoueur = { uid: 1|2 }
 */
export function calculerChangementsSoiree(sousMatchs, split = [0.5, 0.5]) {
    // Ratings courants (mis à jour après chaque sous-match)
    const ratingsCourants = {};

    // Initialiaser avec les ratings d'origine (premier sous-match)
    const tousLesJoueurs = new Set();
    sousMatchs.forEach(sm => {
        [...sm.equipeA, ...sm.equipeB].forEach(j => {
            tousLesJoueurs.add(j.id);
            if (ratingsCourants[j.id] === undefined) {
                ratingsCourants[j.id] = j.rating ?? j.impactRating ?? BASE_RATING;
            }
        });
    });

    const deltasParJoueur   = {};  // uid → somme des deltas
    const resultatsParJoueur = {}; // uid → ['victoire', 'defaite', ...]
    const matchsJouesParJoueur = {};

    for (let idx = 0; idx < sousMatchs.length; idx++) {
        const sm      = sousMatchs[idx] || {};
        const equipeA = Array.isArray(sm.equipeA) ? sm.equipeA : [];
        const equipeB = Array.isArray(sm.equipeB) ? sm.equipeB : [];
        const scoreA  = sm.scoreA ?? 0;
        const scoreB  = sm.scoreB ?? 0;
        const poids = split[idx] ?? (1 / sousMatchs.length);
        const kPondere = K_FACTOR * poids;

        // Construire équipes avec ratings courants
        const eq1 = equipeA.map(j => ({ ...j, rating: ratingsCourants[j.id] ?? j.rating ?? BASE_RATING }));
        const eq2 = equipeB.map(j => ({ ...j, rating: ratingsCourants[j.id] ?? j.rating ?? BASE_RATING }));

        const ratingEq1 = calculerRatingMoyen(eq1);
        const ratingEq2 = calculerRatingMoyen(eq2);

        let res1, res2, txt1, txt2;
        if (scoreA > scoreB)      { res1 = 1;   res2 = 0;   txt1 = 'victoire'; txt2 = 'defaite'; }
        else if (scoreA < scoreB) { res1 = 0;   res2 = 1;   txt1 = 'defaite';  txt2 = 'victoire'; }
        else                      { res1 = 0.5; res2 = 0.5; txt1 = 'nul';      txt2 = 'nul'; }

        const appliquer = (equipe, ratingAllie, ratingAdverse, resNum, resTxt, sAllie, sAdverse) => {
            equipe.forEach(joueur => {
                const uid  = joueur.id;
                const rCourant = ratingsCourants[uid];
                const prob = calculerProbabilite(ratingAllie, ratingAdverse);
                const mult = calculerMultiplicateurScore(sAllie, sAdverse);
                const delta = Math.round(kPondere * (resNum - prob) * mult);
                const deltaClamped = Math.max(PERTE_MAX * poids * 2, Math.min(GAIN_MAX * poids * 2, delta));

                deltasParJoueur[uid]     = (deltasParJoueur[uid] || 0) + deltaClamped;
                resultatsParJoueur[uid]  = [...(resultatsParJoueur[uid] || []), resTxt];
                matchsJouesParJoueur[uid] = (matchsJouesParJoueur[uid] || 0) + 1;

                // Mettre à jour rating courant pour le prochain sous-match
                ratingsCourants[uid] = rCourant + deltaClamped;
            });
        };

        appliquer(eq1, ratingEq1, ratingEq2, res1, txt1, scoreA, scoreB);
        appliquer(eq2, ratingEq2, ratingEq1, res2, txt2, scoreB, scoreA);
    }

    // Construire l'objet changements final
    const changements = {};
    tousLesJoueurs.forEach(uid => {
        const premierSousMatch = sousMatchs.find(sm =>
            [...sm.equipeA, ...sm.equipeB].some(j => j.id === uid)
        );
        const joueur = [...(premierSousMatch?.equipeA || []), ...(premierSousMatch?.equipeB || [])]
            .find(j => j.id === uid);
        const ancien     = joueur?.rating ?? joueur?.impactRating ?? BASE_RATING;
        const changement = deltasParJoueur[uid] || 0;
        changements[uid] = {
            ancien,
            changement,
            nouveau:   ancien + changement,
            resultats: resultatsParJoueur[uid] || [],
            // Résultat synthétique pour la compatibilité : basé sur le sous-match le plus pesant
            resultat: _resultatSynthetique(resultatsParJoueur[uid] || [], split, sousMatchs, uid),
        };
    });

    return { changements, matchsJouesParJoueur };
}

/** Résultat synthétique pondéré pour les stats V/N/D (1 match = 1 résultat dominant) */
function _resultatSynthetique(resultats, split, sousMatchs, uid) {
    if (resultats.length === 1) return resultats[0];
    // Calculer le score pondéré : victoire=1, nul=0.5, défaite=0
    let scoreTotal = 0;
    resultats.forEach((r, i) => {
        const poids = split[i] ?? 0.5;
        const val   = r === 'victoire' ? 1 : r === 'nul' ? 0.5 : 0;
        scoreTotal += val * poids;
    });
    if (scoreTotal > 0.6) return 'victoire';
    if (scoreTotal < 0.4) return 'defaite';
    return 'nul';
}

/**
 * Crée un objet joueur avec ses valeurs initiales.
 */
export function creerNouveauJoueur(nom, position, profilMilieu = null) {
    return {
        nom,
        positionPrincipale: position,
        profilMilieu,
        rating:      BASE_RATING,
        matchsJoues: 0,
        victoires:   0,
        nuls:        0,
        defaites:    0,
        dateCreation: new Date().toISOString(),
    };
}

/**
 * Met à jour les stats d'un joueur en mémoire après un match.
 */
export function mettreAJourStatsJoueur(joueur, changementRating, resultat) {
    joueur.rating = (joueur.rating ?? joueur.impactRating ?? BASE_RATING) + changementRating;
    joueur.matchsJoues += 1;
    if (resultat === 'victoire')     joueur.victoires += 1;
    else if (resultat === 'nul')     joueur.nuls      += 1;
    else if (resultat === 'defaite') joueur.defaites  += 1;
    return joueur;
}

/**
 * Niveau de confiance statistique d'un rating (entre 0 et 1).
 */
export function calculerConfiance(matchsJoues) {
    return Math.min(1, matchsJoues / 10);
}

export const CONSTANTS = {
    K_FACTOR,
    BASE_RATING,
    GAIN_MAX,
    PERTE_MAX,
};

