// ==================== SYSTÈME DE CALCUL DE RATING ====================

/**
 * Constantes du système ELO
 */
const K_FACTOR = 32; // Facteur de changement
const BASE_RATING = 1000; // Rating de départ

/**
 * Calcule la probabilité de victoire d'une équipe selon la différence de rating
 * @param {number} ratingA - Rating moyen de l'équipe A
 * @param {number} ratingB - Rating moyen de l'équipe B
 * @returns {number} Probabilité de victoire de l'équipe A (entre 0 et 1)
 */
function calculerProbabilite(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calcule le rating moyen d'une équipe
 * @param {Array} joueurs - Tableau de joueurs avec leur rating
 * @returns {number} Rating moyen
 */
function calculerRatingMoyen(joueurs) {
    if (joueurs.length === 0) return BASE_RATING;
    const sum = joueurs.reduce((acc, joueur) => acc + joueur.impactRating, 0);
    return sum / joueurs.length;
}

/**
 * Calcule le multiplicateur basé sur la différence de score
 * @param {number} score1 - Score de l'équipe 1
 * @param {number} score2 - Score de l'équipe 2
 * @returns {number} Multiplicateur (>= 1)
 */
function calculerMultiplicateurScore(score1, score2) {
    const diff = Math.abs(score1 - score2);
    return 1 + (diff / 10);
}

/**
 * Calcule le changement de rating pour un joueur après un match
 * @param {number} ratingJoueur - Rating actuel du joueur
 * @param {number} ratingEquipeAlliee - Rating moyen de son équipe
 * @param {number} ratingEquipeAdverse - Rating moyen de l'équipe adverse
 * @param {number} resultat - 1 (victoire), 0.5 (nul), 0 (défaite)
 * @param {number} score1 - Score de son équipe
 * @param {number} score2 - Score de l'équipe adverse
 * @returns {number} Changement de rating (peut être négatif)
 */
export function calculerChangementRating(ratingJoueur, ratingEquipeAlliee, ratingEquipeAdverse, resultat, score1, score2) {
    // Probabilité de victoire de l'équipe du joueur
    const probabilite = calculerProbabilite(ratingEquipeAlliee, ratingEquipeAdverse);
    
    // Changement de base selon ELO
    const changementBase = K_FACTOR * (resultat - probabilite);
    
    // Multiplicateur selon la différence de score
    const multiplicateur = calculerMultiplicateurScore(score1, score2);
    
    // Changement final arrondi
    return Math.round(changementBase * multiplicateur);
}

/**
 * Met à jour les ratings après un match
 * @param {Array} equipe1 - Joueurs de l'équipe 1 avec leur rating
 * @param {Array} equipe2 - Joueurs de l'équipe 2 avec leur rating
 * @param {number} score1 - Score de l'équipe 1
 * @param {number} score2 - Score de l'équipe 2
 * @returns {Object} Changements de rating pour chaque joueur
 */
export function calculerChangementsMatch(equipe1, equipe2, score1, score2) {
    const ratingEquipe1 = calculerRatingMoyen(equipe1);
    const ratingEquipe2 = calculerRatingMoyen(equipe2);
    
    // Déterminer le résultat
    let resultatEquipe1, resultatEquipe2;
    if (score1 > score2) {
        resultatEquipe1 = 1;
        resultatEquipe2 = 0;
    } else if (score1 < score2) {
        resultatEquipe1 = 0;
        resultatEquipe2 = 1;
    } else {
        resultatEquipe1 = 0.5;
        resultatEquipe2 = 0.5;
    }
    
    const changements = {};
    
    // Calculer pour l'équipe 1
    equipe1.forEach(joueur => {
        const changement = calculerChangementRating(
            joueur.impactRating,
            ratingEquipe1,
            ratingEquipe2,
            resultatEquipe1,
            score1,
            score2
        );
        changements[joueur.id] = {
            ancien: joueur.impactRating,
            changement: changement,
            nouveau: joueur.impactRating + changement
        };
    });
    
    // Calculer pour l'équipe 2
    equipe2.forEach(joueur => {
        const changement = calculerChangementRating(
            joueur.impactRating,
            ratingEquipe2,
            ratingEquipe1,
            resultatEquipe2,
            score2,
            score1
        );
        changements[joueur.id] = {
            ancien: joueur.impactRating,
            changement: changement,
            nouveau: joueur.impactRating + changement
        };
    });
    
    return changements;
}

/**
 * Crée un nouveau joueur avec ses stats initiales
 * @param {string} nom - Nom du joueur
 * @param {string} position - Position (Défenseur, Milieu, Attaquant)
 * @returns {Object} Objet joueur
 */
export function creerNouveauJoueur(nom, position) {
    return {
        nom: nom,
        positionPrincipale: position,
        impactRating: BASE_RATING,
        matchsJoues: 0,
        victoires: 0,
        nuls: 0,
        defaites: 0,
        tauxPresence: 0,
        dateCreation: new Date().toISOString()
    };
}

/**
 * Met à jour les statistiques d'un joueur après un match
 * @param {Object} joueur - Joueur à mettre à jour
 * @param {number} changementRating - Changement de rating
 * @param {string} resultat - 'victoire', 'nul', ou 'defaite'
 * @returns {Object} Joueur mis à jour
 */
export function mettreAJourStatsJoueur(joueur, changementRating, resultat) {
    joueur.impactRating += changementRating;
    joueur.matchsJoues += 1;
    
    if (resultat === 'victoire') {
        joueur.victoires += 1;
    } else if (resultat === 'nul') {
        joueur.nuls += 1;
    } else if (resultat === 'defaite') {
        joueur.defaites += 1;
    }
    
    return joueur;
}

/**
 * Calcule le niveau de confiance statistique d'un rating
 * @param {number} matchsJoues - Nombre de matchs joués
 * @returns {number} Confiance entre 0 et 1
 */
export function calculerConfiance(matchsJoues) {
    return Math.min(1, matchsJoues / 10);
}

/**
 * Exporte les constantes pour utilisation ailleurs
 */
export const CONSTANTS = {
    K_FACTOR,
    BASE_RATING
};

