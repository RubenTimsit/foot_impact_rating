// ==================== SYSTÈME DE SYNERGIES ====================

// Constantes de pondération
const WIN_BONUS    = 2;     // Points gagnés par victoire
const LOSS_PENALTY = 1.5;   // Points perdus par défaite
const DIFF_FACTOR  = 0.1;   // Bonus/malus par but d'écart (÷10)

/**
 * Crée ou met à jour une synergie entre deux joueurs.
 * @param {Object} synergiesExistantes - Synergies existantes
 * @param {string} joueurId1
 * @param {string} joueurId2
 * @param {string} resultat - 'victoire', 'nul', ou 'defaite'
 * @param {number} scoreDiff - Écart de score absolu
 * @param {number} poids - Poids du sous-match (0–1, défaut 1 = match entier)
 */
export function mettreAJourSynergie(synergiesExistantes, joueurId1, joueurId2, resultat, scoreDiff = 0, poids = 1) {
    const cle = [joueurId1, joueurId2].sort().join('-');

    if (!synergiesExistantes[cle]) {
        synergiesExistantes[cle] = {
            joueur1: joueurId1,
            joueur2: joueurId2,
            valeur: 0,
            matchsEnsemble: 0,
            victoires: 0,
            nuls: 0,
            defaites: 0
        };
    }

    const syn = synergiesExistantes[cle];

    // matchsEnsemble pondéré : 1 soirée complète = 1.0 au total
    syn.matchsEnsemble = Math.round((syn.matchsEnsemble + poids) * 100) / 100;

    if (resultat === 'victoire') {
        syn.victoires += 1;
        syn.valeur += (WIN_BONUS + scoreDiff * DIFF_FACTOR) * poids;
    } else if (resultat === 'nul') {
        syn.nuls += 1;
        // Nul ne modifie pas la valeur
    } else if (resultat === 'defaite') {
        syn.defaites += 1;
        syn.valeur -= (LOSS_PENALTY + scoreDiff * DIFF_FACTOR) * poids;
    }

    syn.valeur = Math.round(syn.valeur * 100) / 100;

    return synergiesExistantes;
}

/**
 * Met à jour toutes les synergies pour une équipe après un match
 * @param {Object} synergiesExistantes - Synergies existantes
 * @param {Array} equipe - Tableau des IDs des joueurs de l'équipe
 * @param {string} resultat - 'victoire', 'nul', ou 'defaite'
 * @param {number} scoreDiff - Différence de score
 * @returns {Object} Synergies mises à jour
 */
export function mettreAJourSynergiesEquipe(synergiesExistantes, equipe, resultat, scoreDiff = 0, poids = 1) {
    for (let i = 0; i < equipe.length; i++) {
        for (let j = i + 1; j < equipe.length; j++) {
            mettreAJourSynergie(
                synergiesExistantes,
                equipe[i],
                equipe[j],
                resultat,
                scoreDiff,
                poids
            );
        }
    }
    return synergiesExistantes;
}

/**
 * Obtient la valeur de synergie entre deux joueurs
 * @param {Object} synergies - Toutes les synergies
 * @param {string} joueurId1 - ID du premier joueur
 * @param {string} joueurId2 - ID du deuxième joueur
 * @returns {number} Valeur de synergie (0 si aucune)
 */
export function obtenirSynergie(synergies, joueurId1, joueurId2) {
    const cle = [joueurId1, joueurId2].sort().join('-');
    return synergies[cle] ? synergies[cle].valeur : 0;
}

/**
 * Calcule le score de synergie total d'une équipe
 * @param {Object} synergies - Toutes les synergies
 * @param {Array} equipe - Tableau des IDs des joueurs
 * @returns {number} Score de synergie total de l'équipe
 */
export function calculerSynergieEquipe(synergies, equipe) {
    let total = 0;
    let count = 0;
    
    for (let i = 0; i < equipe.length; i++) {
        for (let j = i + 1; j < equipe.length; j++) {
            total += obtenirSynergie(synergies, equipe[i], equipe[j]);
            count++;
        }
    }
    
    return count > 0 ? total / count : 0;
}

/**
 * Détecte les trios de joueurs ayant une bonne synergie
 * @param {Object} synergies - Toutes les synergies
 * @param {Array} joueurs - Tableau de tous les joueurs
 * @param {number} seuilMin - Seuil minimum de synergie moyenne (défaut: 3)
 * @returns {Array} Tableau de trios détectés
 */
export function detecterTrios(synergies, joueurs, seuilMin = 3) {
    const trios = [];
    const joueursIds = joueurs.map(j => j.id);
    
    // Tester toutes les combinaisons de 3 joueurs
    for (let i = 0; i < joueursIds.length; i++) {
        for (let j = i + 1; j < joueursIds.length; j++) {
            for (let k = j + 1; k < joueursIds.length; k++) {
                const id1 = joueursIds[i];
                const id2 = joueursIds[j];
                const id3 = joueursIds[k];
                
                // Calculer la synergie moyenne du trio
                const syn12 = obtenirSynergie(synergies, id1, id2);
                const syn13 = obtenirSynergie(synergies, id1, id3);
                const syn23 = obtenirSynergie(synergies, id2, id3);
                
                const synMoyenne = (syn12 + syn13 + syn23) / 3;
                
                // Si la synergie moyenne dépasse le seuil
                if (synMoyenne >= seuilMin) {
                    // Vérifier qu'ils ont joué ensemble au moins une fois
                    const cle12 = [id1, id2].sort().join('-');
                    const cle13 = [id1, id3].sort().join('-');
                    const cle23 = [id2, id3].sort().join('-');
                    
                    if (synergies[cle12] && synergies[cle13] && synergies[cle23]) {
                        const matchsMin = Math.min(
                            synergies[cle12].matchsEnsemble,
                            synergies[cle13].matchsEnsemble,
                            synergies[cle23].matchsEnsemble
                        );
                        
                        if (matchsMin >= 2) { // Au moins 2 matchs ensemble
                            trios.push({
                                type: 'trio',
                                joueurs: [
                                    joueurs.find(j => j.id === id1),
                                    joueurs.find(j => j.id === id2),
                                    joueurs.find(j => j.id === id3)
                                ],
                                synergieGlobale: Math.round(synMoyenne * 10) / 10,
                                synergies: {
                                    [id1 + '-' + id2]: syn12,
                                    [id1 + '-' + id3]: syn13,
                                    [id2 + '-' + id3]: syn23
                                }
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Trier par synergie décroissante
    return trios.sort((a, b) => b.synergieGlobale - a.synergieGlobale);
}

/**
 * Détecte les quartets (groupes de 4 joueurs)
 * @param {Object} synergies - Toutes les synergies
 * @param {Array} joueurs - Tableau de tous les joueurs
 * @param {number} seuilMin - Seuil minimum (défaut: 2.5)
 * @returns {Array} Tableau de quartets
 */
export function detecterQuartets(synergies, joueurs, seuilMin = 2.5) {
    const quartets = [];
    const joueursIds = joueurs.map(j => j.id);
    
    // Pour ne pas surcharger, limiter si beaucoup de joueurs
    if (joueursIds.length > 15) return [];
    
    // Tester toutes les combinaisons de 4 joueurs
    for (let i = 0; i < joueursIds.length; i++) {
        for (let j = i + 1; j < joueursIds.length; j++) {
            for (let k = j + 1; k < joueursIds.length; k++) {
                for (let l = k + 1; l < joueursIds.length; l++) {
                    const ids = [joueursIds[i], joueursIds[j], joueursIds[k], joueursIds[l]];
                    
                    // Calculer la synergie moyenne de toutes les paires (6 paires)
                    let synTotal = 0;
                    let count = 0;
                    
                    for (let a = 0; a < 4; a++) {
                        for (let b = a + 1; b < 4; b++) {
                            synTotal += obtenirSynergie(synergies, ids[a], ids[b]);
                            count++;
                        }
                    }
                    
                    const synMoyenne = synTotal / count;
                    
                    if (synMoyenne >= seuilMin) {
                        quartets.push({
                            type: 'quartet',
                            joueurs: ids.map(id => joueurs.find(j => j.id === id)),
                            synergieGlobale: Math.round(synMoyenne * 10) / 10
                        });
                    }
                }
            }
        }
    }
    
    // Trier et limiter aux 5 meilleurs
    return quartets
        .sort((a, b) => b.synergieGlobale - a.synergieGlobale)
        .slice(0, 5);
}

/**
 * Obtient les meilleures synergies (top N)
 * @param {Object} synergies - Toutes les synergies
 * @param {Array} joueurs - Tous les joueurs (pour récupérer les noms)
 * @param {number} limit - Nombre de synergies à retourner (défaut: 10)
 * @returns {Array} Top synergies
 */
export function getTopSynergies(synergies, joueurs, limit = 10) {
    const synergiesArray = Object.values(synergies)
        .filter(s => s.matchsEnsemble >= 2) // Au moins 2 matchs ensemble
        .sort((a, b) => b.valeur - a.valeur)
        .slice(0, limit);
    
    // Enrichir avec les noms des joueurs
    return synergiesArray.map(syn => {
        const j1 = joueurs.find(j => j.id === syn.joueur1);
        const j2 = joueurs.find(j => j.id === syn.joueur2);
        
        return {
            ...syn,
            nomJoueur1: j1 ? j1.nom : 'Inconnu',
            nomJoueur2: j2 ? j2.nom : 'Inconnu'
        };
    });
}

/**
 * Génère une matrice de synergies pour l'affichage
 * @param {Object} synergies - Toutes les synergies
 * @param {Array} joueurs - Tous les joueurs
 * @returns {Array} Matrice 2D
 */
export function genererMatriceSynergies(synergies, joueurs) {
    const n = joueurs.length;
    const matrice = [];
    
    for (let i = 0; i < n; i++) {
        const ligne = [];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                ligne.push({ type: 'diagonal', value: '-' });
            } else {
                const syn = obtenirSynergie(synergies, joueurs[i].id, joueurs[j].id);
                ligne.push({
                    type: syn > 0 ? 'positive' : (syn < 0 ? 'negative' : 'neutral'),
                    value: syn,
                    joueur1: joueurs[i].nom,
                    joueur2: joueurs[j].nom
                });
            }
        }
        matrice.push(ligne);
    }
    
    return matrice;
}

export default {
    mettreAJourSynergie,
    mettreAJourSynergiesEquipe,
    obtenirSynergie,
    calculerSynergieEquipe,
    detecterTrios,
    detecterQuartets,
    getTopSynergies,
    genererMatriceSynergies
};

