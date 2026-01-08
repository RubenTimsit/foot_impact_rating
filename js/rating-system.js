// ==================== SYSTÈME DE CALCUL DE RATING ====================

/**
 * Constantes du système ELO
 */
const K_FACTOR = 32; // Facteur de changement
const BASE_RATING = 1000; // Rating de départ

/**
 * Pondérations pour matchs à haut score (5-10 buts par équipe)
 */
const PONDERATIONS = {
    baseELO: 0.65,              // 65% - Base résultat collectif
    contributionOffensive: 0.18, // 18% - Buts et actions offensives
    contributionDefensive: 0.12, // 12% - Clean sheet et défense
    bonusDifferentiel: 0.05     // 5% - Contexte du match
};

/**
 * Seuils ajustés pour matchs à haut score
 */
const SEUILS = {
    // Buts individuels (ajusté pour matchs 5-10 buts/équipe)
    hatTrick: 4,                // 4+ buts = exceptionnel
    pokerButs: 5,               // 5+ buts = performance historique
    
    // Défense (ajusté pour matchs avec beaucoup de buts)
    cleanSheet: 1,              // 0-1 but encaissé = excellent
    defenseDecente: 4,          // 2-4 buts = normal
    defensePoreuse: 7,          // 7+ buts = problème défensif
    defenseCatastrophique: 10,  // 10+ buts = désastre
    
    // Différentiel de score
    ecartSerre: 2,              // Différence 1-2 buts = match serré
    ecartConfortable: 4,        // Différence 3-4 buts = domination
    ecartLarge: 6,              // Différence 5+ buts = écrasement
    
    // Plafonds de sécurité
    gainMaxParMatch: 50,
    perteMaxParMatch: -40,
    bonusButMax: 50,
    malusCscMax: -35
};

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
 * Calcule la contribution offensive d'un joueur (buts marqués)
 * RELATIF au contexte du match (3/4 buts > 3/10 buts)
 * @param {Object} joueur - Joueur avec position
 * @param {Object} buteurData - {buts, csc} données du buteur
 * @param {number} butsEquipe - Total buts de l'équipe
 * @param {string} resultat - 'victoire', 'nul', 'defaite'
 * @returns {number} Points de contribution offensive
 */
function calculerContributionOffensive(joueur, buteurData, butsEquipe, resultat) {
    if (!buteurData || buteurData.buts === 0 || buteurData.csc || butsEquipe === 0) {
        return 0;
    }
    
    // ===== CONTRIBUTION RELATIVE (% des buts de l'équipe) =====
    const pourcentageContribution = buteurData.buts / butsEquipe;
    
    // Valorisation selon le pourcentage de contribution
    let pointsBase = 0;
    if (pourcentageContribution >= 0.6) {
        // 60%+ des buts = performance héroïque (ex: 3/5, 4/6)
        pointsBase = 45;
    } else if (pourcentageContribution >= 0.4) {
        // 40-60% des buts = performance exceptionnelle (ex: 3/7, 4/9)
        pointsBase = 35;
    } else if (pourcentageContribution >= 0.25) {
        // 25-40% des buts = très bonne performance (ex: 2/7, 3/10)
        pointsBase = 25;
    } else if (pourcentageContribution >= 0.15) {
        // 15-25% des buts = bonne contribution (ex: 1/6, 2/10)
        pointsBase = 15;
    } else {
        // <15% des buts = contribution modeste (ex: 1/10)
        pointsBase = 8;
    }
    
    // ===== MULTIPLICATEUR SELON POSITION =====
    // Un but de défenseur vaut plus qu'un but d'attaquant
    const multiplicateurPosition = {
        'Attaquant': 1.0,    // Normal (c'est son rôle)
        'Milieu': 1.15,      // Légèrement valorisé
        'Défenseur': 1.4     // Fortement valorisé (rare)
    };
    
    const multPos = multiplicateurPosition[joueur.positionPrincipale] || 1.0;
    pointsBase *= multPos;
    
    // ===== AJUSTEMENT SELON RÉSULTAT =====
    const multiplicateurResultat = {
        'victoire': 1.3,  // Les buts ont aidé à gagner
        'nul': 1.0,       // Buts neutres
        'defaite': 0.7    // Buts insuffisants pour gagner
    };
    
    pointsBase *= multiplicateurResultat[resultat] || 1.0;
    
    // ===== BONUS VOLUME (si beaucoup de buts en absolu) =====
    // Même si c'est relatif, marquer 5+ buts mérite un bonus
    if (buteurData.buts >= 5) {
        pointsBase *= 1.25;  // Bonus poker/5+ buts
    } else if (buteurData.buts >= 4) {
        pointsBase *= 1.15;  // Bonus 4 buts
    }
    
    // Plafonnement
    return Math.min(pointsBase, SEUILS.bonusButMax);
}

/**
 * Calcule la contribution défensive d'un joueur
 * RELATIF au contexte du match (3 buts encaissés dans 10-3 ≠ 2-3)
 * @param {Object} joueur - Joueur avec position
 * @param {number} butsEncaisses - Nombre de buts encaissés par l'équipe
 * @param {number} butsMarques - Nombre de buts marqués par l'équipe
 * @param {Object} buteurData - Données buteur (pour CSC)
 * @param {string} resultat - 'victoire', 'nul', 'defaite'
 * @returns {number} Points de contribution défensive
 */
function calculerContributionDefensive(joueur, butsEncaisses, butsMarques, buteurData, resultat) {
    let pointsDefense = 0;
    
    // ===== MALUS CSC (Contre Son Camp) =====
    if (buteurData && buteurData.csc && buteurData.buts > 0) {
        return -30 * buteurData.buts; // -30 points par CSC (constant, c'est grave)
    }
    
    // ===== COEFFICIENT SELON POSITION =====
    const coeffPosition = {
        'Défenseur': 1.0,    // Pleinement responsable
        'Milieu': 0.55,      // Partiellement responsable
        'Attaquant': 0.25    // Peu responsable
    };
    
    const coeff = coeffPosition[joueur.positionPrincipale] || 0.5;
    
    // ===== RATIO OFFENSIF/DÉFENSIF (contextuel) =====
    // Si ton équipe marque 10 et encaisse 3 → défense ok malgré 3 buts
    // Si ton équipe marque 2 et encaisse 3 → défense problématique
    const ratioOffenseDefense = butsMarques > 0 ? butsMarques / Math.max(butsEncaisses, 1) : 0;
    
    // ===== ÉVALUATION DÉFENSIVE RELATIVE =====
    let evaluationDefense = 0;
    
    if (butsEncaisses === 0) {
        // Clean sheet absolu = excellent
        evaluationDefense = 30;
    } else if (butsEncaisses === 1) {
        // 1 seul but encaissé = très bon
        evaluationDefense = 20;
    } else if (ratioOffenseDefense >= 2.5) {
        // Ratio 2.5+ (ex: 10-3, 8-3) = défense correcte malgré buts
        evaluationDefense = 10;
    } else if (ratioOffenseDefense >= 1.5) {
        // Ratio 1.5+ (ex: 6-3, 9-5) = défense passable
        evaluationDefense = 5;
    } else if (ratioOffenseDefense >= 1.0) {
        // Ratio ~1 (ex: 5-5, 6-6) = défense neutre
        evaluationDefense = 0;
    } else if (ratioOffenseDefense >= 0.5) {
        // Ratio 0.5-1 (ex: 3-5, 4-7) = défense fragile
        evaluationDefense = -12;
    } else {
        // Ratio <0.5 (ex: 2-8, 3-10) = défense catastrophique
        evaluationDefense = -25;
    }
    
    // Appliquer le coefficient de position
    pointsDefense = evaluationDefense * coeff;
    
    // ===== AJUSTEMENT SELON RÉSULTAT =====
    // Si tu gagnes malgré une défense faible, c'est moins grave
    if (resultat === 'victoire' && pointsDefense < 0) {
        pointsDefense *= 0.5; // Réduit le malus de moitié si victoire
    }
    // Si tu perds avec une bonne défense (ex: 0-1), atténue le coup
    else if (resultat === 'defaite' && pointsDefense > 0) {
        pointsDefense *= 0.7; // Réduit le bonus si défaite quand même
    }
    
    return pointsDefense;
}

/**
 * Calcule le bonus lié au différentiel de score
 * @param {number} butsMarques - Buts marqués
 * @param {number} butsEncaisses - Buts encaissés
 * @param {string} resultat - 'victoire', 'nul', 'defaite'
 * @returns {number} Points bonus différentiel
 */
function calculerBonusDifferentiel(butsMarques, butsEncaisses, resultat) {
    const differentiel = butsMarques - butsEncaisses;
    const ecart = Math.abs(differentiel);
    
    if (resultat === 'victoire') {
        if (ecart >= SEUILS.ecartLarge) return 18;      // Victoire large (5+ buts)
        if (ecart >= SEUILS.ecartConfortable) return 12; // Victoire confortable (3-4)
        if (ecart >= SEUILS.ecartSerre) return 6;        // Victoire normale (1-2)
        return 3;                                         // Victoire courte
    } else if (resultat === 'defaite') {
        if (ecart >= SEUILS.ecartLarge) return -18;      // Défaite lourde
        if (ecart >= SEUILS.ecartConfortable) return -12; // Défaite nette
        if (ecart >= SEUILS.ecartSerre) return -6;        // Défaite normale
        return -3;                                        // Défaite courte
    }
    
    return 0; // Match nul
}

/**
 * Calcule l'impact total d'un joueur avec toutes les contributions
 * @param {Object} joueur - Joueur avec rating et position
 * @param {number} changementBaseELO - Changement ELO de base
 * @param {Object} equipeData - {butsMarques, butsEncaisses, buteurs, resultat}
 * @returns {number} Changement total de rating
 */
function calculerImpactTotal(joueur, changementBaseELO, equipeData) {
    let impactTotal = 0;
    
    // 1️⃣ Base ELO (65%)
    impactTotal += changementBaseELO * PONDERATIONS.baseELO;
    
    // 2️⃣ Contribution Offensive (18%) - RELATIF au match
    const buteurData = equipeData.buteurs?.find(b => b.joueurId === joueur.id);
    const contribOffensive = calculerContributionOffensive(
        joueur,
        buteurData,
        equipeData.butsMarques,  // 🆕 Total buts équipe (pour calcul relatif)
        equipeData.resultat
    );
    impactTotal += contribOffensive * PONDERATIONS.contributionOffensive;
    
    // 3️⃣ Contribution Défensive (12%) - RELATIF au match
    const contribDefensive = calculerContributionDefensive(
        joueur,
        equipeData.butsEncaisses,
        equipeData.butsMarques,  // 🆕 Buts marqués (pour ratio défense/attaque)
        buteurData,
        equipeData.resultat
    );
    impactTotal += contribDefensive * PONDERATIONS.contributionDefensive;
    
    // 4️⃣ Bonus Différentiel (5%)
    const bonusDiff = calculerBonusDifferentiel(
        equipeData.butsMarques,
        equipeData.butsEncaisses,
        equipeData.resultat
    );
    impactTotal += bonusDiff * PONDERATIONS.bonusDifferentiel;
    
    // Plafonnement final
    const changementFinal = Math.round(impactTotal);
    return Math.max(
        SEUILS.perteMaxParMatch,
        Math.min(SEUILS.gainMaxParMatch, changementFinal)
    );
}

/**
 * Met à jour les ratings après un match (avec données de buts)
 * @param {Array} equipe1 - Joueurs de l'équipe 1 avec leur rating
 * @param {Array} equipe2 - Joueurs de l'équipe 2 avec leur rating
 * @param {number} score1 - Score de l'équipe 1
 * @param {number} score2 - Score de l'équipe 2
 * @param {Array} buteurs1 - Buteurs équipe 1: [{joueurId, buts, csc}]
 * @param {Array} buteurs2 - Buteurs équipe 2: [{joueurId, buts, csc}]
 * @returns {Object} Changements de rating pour chaque joueur
 */
export function calculerChangementsMatch(equipe1, equipe2, score1, score2, buteurs1 = [], buteurs2 = []) {
    const ratingEquipe1 = calculerRatingMoyen(equipe1);
    const ratingEquipe2 = calculerRatingMoyen(equipe2);
    
    // Déterminer le résultat
    let resultatEquipe1, resultatEquipe2;
    let resultatTexte1, resultatTexte2;
    
    if (score1 > score2) {
        resultatEquipe1 = 1;
        resultatEquipe2 = 0;
        resultatTexte1 = 'victoire';
        resultatTexte2 = 'defaite';
    } else if (score1 < score2) {
        resultatEquipe1 = 0;
        resultatEquipe2 = 1;
        resultatTexte1 = 'defaite';
        resultatTexte2 = 'victoire';
    } else {
        resultatEquipe1 = 0.5;
        resultatEquipe2 = 0.5;
        resultatTexte1 = 'nul';
        resultatTexte2 = 'nul';
    }
    
    const changements = {};
    
    // Données équipe 1
    const equipe1Data = {
        butsMarques: score1,
        butsEncaisses: score2,
        buteurs: buteurs1,
        resultat: resultatTexte1
    };
    
    // Données équipe 2
    const equipe2Data = {
        butsMarques: score2,
        butsEncaisses: score1,
        buteurs: buteurs2,
        resultat: resultatTexte2
    };
    
    // Calculer pour l'équipe 1
    equipe1.forEach(joueur => {
        const changementBaseELO = calculerChangementRating(
            joueur.impactRating,
            ratingEquipe1,
            ratingEquipe2,
            resultatEquipe1,
            score1,
            score2
        );
        
        const changementTotal = calculerImpactTotal(
            joueur,
            changementBaseELO,
            equipe1Data
        );
        
        changements[joueur.id] = {
            ancien: joueur.impactRating,
            changement: changementTotal,
            nouveau: joueur.impactRating + changementTotal
        };
    });
    
    // Calculer pour l'équipe 2
    equipe2.forEach(joueur => {
        const changementBaseELO = calculerChangementRating(
            joueur.impactRating,
            ratingEquipe2,
            ratingEquipe1,
            resultatEquipe2,
            score2,
            score1
        );
        
        const changementTotal = calculerImpactTotal(
            joueur,
            changementBaseELO,
            equipe2Data
        );
        
        changements[joueur.id] = {
            ancien: joueur.impactRating,
            changement: changementTotal,
            nouveau: joueur.impactRating + changementTotal
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
        // Nouvelles stats offensives
        butsMarques: 0,
        butsContresonCamp: 0,
        // Stats défensives
        cleanSheets: 0,
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
    BASE_RATING,
    PONDERATIONS,
    SEUILS
};

