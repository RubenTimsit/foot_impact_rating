// ==================== ALGORITHME D'ÉQUILIBRAGE DES ÉQUIPES ====================

import { calculerSynergieEquipe } from './synergy-system.js';

/**
 * Calcule le rating moyen d'une équipe
 */
function calculerRatingMoyen(equipe) {
    if (equipe.length === 0) return 0;
    const sum = equipe.reduce((acc, j) => acc + j.impactRating, 0);
    return sum / equipe.length;
}

/**
 * Calcule la répartition des positions dans une équipe
 * @param {Array} equipe - Joueurs de l'équipe
 * @returns {Object} Nombre de joueurs par position
 */
function calculerRepartitionPositions(equipe) {
    const repartition = {
        'Défenseur': 0,
        'Milieu': 0,
        'Attaquant': 0
    };
    
    equipe.forEach(joueur => {
        if (repartition.hasOwnProperty(joueur.positionPrincipale)) {
            repartition[joueur.positionPrincipale]++;
        }
    });
    
    return repartition;
}

/**
 * Évalue la qualité d'une composition (plus le score est bas, mieux c'est)
 * @param {Array} equipe1 - Joueurs équipe 1
 * @param {Array} equipe2 - Joueurs équipe 2
 * @param {Object} synergies - Synergies entre joueurs
 * @returns {Object} Score et détails
 */
function evaluerComposition(equipe1, equipe2, synergies) {
    // Différence de rating
    const rating1 = calculerRatingMoyen(equipe1);
    const rating2 = calculerRatingMoyen(equipe2);
    const diffRating = Math.abs(rating1 - rating2);
    
    // Différence de synergie
    const syn1 = calculerSynergieEquipe(synergies, equipe1.map(j => j.id));
    const syn2 = calculerSynergieEquipe(synergies, equipe2.map(j => j.id));
    const diffSynergie = Math.abs(syn1 - syn2);
    
    // Différence de positions
    const pos1 = calculerRepartitionPositions(equipe1);
    const pos2 = calculerRepartitionPositions(equipe2);
    const diffPositions = Math.abs(pos1.Défenseur - pos2.Défenseur) +
                          Math.abs(pos1.Milieu - pos2.Milieu) +
                          Math.abs(pos1.Attaquant - pos2.Attaquant);
    
    // Score composite (pondéré)
    const score = (diffRating * 2) + (diffSynergie * 10) + (diffPositions * 5);
    
    return {
        score: score,
        rating1: Math.round(rating1),
        rating2: Math.round(rating2),
        diffRating: Math.round(diffRating),
        syn1: Math.round(syn1 * 10) / 10,
        syn2: Math.round(syn2 * 10) / 10,
        diffSynergie: Math.round(diffSynergie * 10) / 10,
        pos1: pos1,
        pos2: pos2,
        diffPositions: diffPositions
    };
}

/**
 * Génère toutes les combinaisons possibles (limité pour performance)
 * @param {Array} joueurs - Tous les joueurs disponibles
 * @param {number} taille - Taille de chaque équipe
 * @param {number} maxCombinations - Nombre max de combinaisons à tester
 * @returns {Array} Combinaisons d'équipes
 */
function genererCombinations(joueurs, taille, maxCombinations = 5000) {
    const combinations = [];
    const n = joueurs.length;
    
    // Fonction récursive pour générer les combinaisons
    function combine(start, combo) {
        if (combo.length === taille) {
            combinations.push([...combo]);
            return;
        }
        
        // Limiter le nombre de combinaisons pour la performance
        if (combinations.length >= maxCombinations) return;
        
        for (let i = start; i < n; i++) {
            combo.push(joueurs[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }
    
    combine(0, []);
    return combinations.slice(0, maxCombinations);
}

/**
 * Algorithme principal d'équilibrage
 * @param {Array} joueursDisponibles - Joueurs présents
 * @param {Object} synergies - Synergies entre joueurs
 * @param {number} tailleEquipe - Taille souhaitée (7 ou 8)
 * @param {number} nbPropositions - Nombre de propositions à retourner
 * @returns {Array} Meilleures compositions
 */
export function equilibrerEquipes(joueursDisponibles, synergies = {}, tailleEquipe = 7, nbPropositions = 3) {
    const nbJoueurs = joueursDisponibles.length;
    
    // Vérifications
    if (nbJoueurs < tailleEquipe * 2) {
        throw new Error(`Pas assez de joueurs (${nbJoueurs}). Il en faut au moins ${tailleEquipe * 2}.`);
    }
    
    if (nbJoueurs > tailleEquipe * 2) {
        throw new Error(`Trop de joueurs (${nbJoueurs}). Maximum ${tailleEquipe * 2} pour ${tailleEquipe}v${tailleEquipe}.`);
    }
    
    console.log(`🎲 Génération des équipes pour ${nbJoueurs} joueurs (${tailleEquipe}v${tailleEquipe})...`);
    
    // Générer toutes les combinaisons possibles pour l'équipe 1
    const combinationsEquipe1 = genererCombinations(joueursDisponibles, tailleEquipe);
    
    console.log(`📊 ${combinationsEquipe1.length} combinaisons à tester...`);
    
    const propositions = [];
    
    // Tester chaque combinaison
    combinationsEquipe1.forEach(equipe1 => {
        // L'équipe 2 est le reste des joueurs
        const equipe1Ids = equipe1.map(j => j.id);
        const equipe2 = joueursDisponibles.filter(j => !equipe1Ids.includes(j.id));
        
        // Évaluer cette composition
        const evaluation = evaluerComposition(equipe1, equipe2, synergies);
        
        propositions.push({
            equipe1: equipe1,
            equipe2: equipe2,
            evaluation: evaluation
        });
    });
    
    // Trier par score (meilleur = plus bas)
    propositions.sort((a, b) => a.evaluation.score - b.evaluation.score);
    
    // Retourner les N meilleures en évitant les doublons
    const meilleures = [];
    const vues = new Set();
    
    for (const prop of propositions) {
        // Créer une clé unique basée sur l'équipe 1 (triée)
        const cle = prop.equipe1.map(j => j.id).sort().join(',');
        
        if (!vues.has(cle)) {
            meilleures.push(prop);
            vues.add(cle);
            
            if (meilleures.length >= nbPropositions) break;
        }
    }
    
    console.log(`✅ ${meilleures.length} meilleures compositions trouvées`);
    
    return meilleures;
}

/**
 * Équilibrage simplifié basé sur un algorithme glouton (plus rapide)
 * Utile si beaucoup de joueurs
 * @param {Array} joueurs - Joueurs disponibles
 * @param {number} tailleEquipe - Taille des équipes
 * @returns {Object} Une composition équilibrée
 */
export function equilibrageRapide(joueurs, tailleEquipe = 7) {
    // Trier les joueurs par rating décroissant
    const joueursTriés = [...joueurs].sort((a, b) => b.impactRating - a.impactRating);
    
    const equipe1 = [];
    const equipe2 = [];
    
    // Algorithme "snake draft" : alterner en donnant le meilleur joueur restant
    joueursTriés.forEach((joueur, index) => {
        if (equipe1.length < tailleEquipe && (index % 2 === 0 || equipe2.length >= tailleEquipe)) {
            equipe1.push(joueur);
        } else if (equipe2.length < tailleEquipe) {
            equipe2.push(joueur);
        }
    });
    
    return {
        equipe1: equipe1,
        equipe2: equipe2,
        evaluation: evaluerComposition(equipe1, equipe2, {})
    };
}

export default {
    equilibrerEquipes,
    equilibrageRapide
};

