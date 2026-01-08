// ==================== PAGE HISTORIQUE ====================

import { db, collection, getDocs, query, orderBy, where, COLLECTIONS } from './firebase-config.js';
import { checkAndShowModal } from './code-modal.js';

let matchs = [];
let joueurs = [];
let groupeActuel = null;

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📜 Page historique chargée');
    
    // Vérifier le code de groupe et afficher le modal si nécessaire
    groupeActuel = await checkAndShowModal(async (groupe) => {
        groupeActuel = groupe;
        await loadData();
        displayMatchs();
    });
    
    // Si le groupe existe déjà
    if (groupeActuel) {
        await loadData();
        displayMatchs();
    }
});

// ==================== CHARGEMENT DES DONNÉES ====================
async function loadData() {
    try {
        if (!groupeActuel || !groupeActuel.id) {
            console.error('❌ Aucun groupe actuel défini');
            loadDemoData();
            return;
        }
        
        // Charger les matchs depuis la sous-collection du groupe
        const matchsCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.MATCHS}`;
        const matchsQuery = query(
            collection(db, matchsCollectionPath),
            orderBy('date', 'desc')
        );
        const matchsSnapshot = await getDocs(matchsQuery);
        matchs = matchsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Charger les joueurs depuis la sous-collection du groupe pour avoir les noms
        const joueursCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.JOUEURS}`;
        const joueursSnapshot = await getDocs(collection(db, joueursCollectionPath));
        joueurs = joueursSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`✅ ${matchs.length} matchs chargés`);
        
    } catch (error) {
        console.error('Erreur chargement:', error);
        loadDemoData();
    }
}

function loadDemoData() {
    // Base vide - pas de données fictives
    joueurs = [];
    matchs = [];
    console.log('📝 Aucune donnée dans Firebase, démarrage avec une base vide');
}

// ==================== AFFICHAGE DES MATCHS ====================
function displayMatchs() {
    const container = document.getElementById('matchs-list');
    
    if (matchs.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow);">
                <p style="color: var(--text-light); font-size: 1.2rem;">
                    ⚽ Aucun match enregistré pour le moment
                </p>
                <p style="color: var(--text-light); margin-top: 1rem;">
                    Rendez-vous dans la section Admin pour ajouter des matchs !
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = matchs.map(match => {
        const date = new Date(match.date);
        const dateFormatted = date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Récupérer les noms des joueurs
        const equipe1Noms = match.equipe1.joueurs
            .map(id => {
                const j = joueurs.find(joueur => joueur.id === id);
                return j ? j.nom : 'Inconnu';
            });
        
        const equipe2Noms = match.equipe2.joueurs
            .map(id => {
                const j = joueurs.find(joueur => joueur.id === id);
                return j ? j.nom : 'Inconnu';
            });
        
        // Déterminer le gagnant
        const score1 = match.equipe1.score;
        const score2 = match.equipe2.score;
        let resultClass1 = 'draw';
        let resultClass2 = 'draw';
        
        if (score1 > score2) {
            resultClass1 = 'winner';
            resultClass2 = 'loser';
        } else if (score2 > score1) {
            resultClass1 = 'loser';
            resultClass2 = 'winner';
        }
        
        return `
            <div class="match-card">
                <div class="match-header">
                    <h3>📅 ${dateFormatted}</h3>
                </div>
                
                <div class="match-content">
                    <div class="equipe-box ${resultClass1}">
                        <h4>Équipe 1</h4>
                        <div class="match-score">${score1}</div>
                        <div class="joueurs-list">
                            ${equipe1Noms.map(nom => `<span class="joueur-badge">${nom}</span>`).join('')}
                        </div>
                    </div>
                    
                    <div class="match-separator">VS</div>
                    
                    <div class="equipe-box ${resultClass2}">
                        <h4>Équipe 2</h4>
                        <div class="match-score">${score2}</div>
                        <div class="joueurs-list">
                            ${equipe2Noms.map(nom => `<span class="joueur-badge">${nom}</span>`).join('')}
                        </div>
                    </div>
                </div>
                
                ${match.ratingChanges ? displayRatingChanges(match.ratingChanges) : ''}
            </div>
        `;
    }).join('');
}

function displayRatingChanges(changes) {
    const changesArray = Object.entries(changes).map(([id, change]) => {
        const joueur = joueurs.find(j => j.id === id);
        const nom = joueur ? joueur.nom : 'Inconnu';
        const changeValue = change.changement;
        const changeClass = changeValue > 0 ? 'positive' : (changeValue < 0 ? 'negative' : 'neutral');
        const changeSign = changeValue > 0 ? '+' : '';
        
        return { nom, changeValue, changeClass, changeSign };
    });
    
    return `
        <div class="rating-changes">
            <h5>📊 Changements de rating</h5>
            <div class="changes-grid">
                ${changesArray.map(c => `
                    <div class="change-item ${c.changeClass}">
                        <span class="change-name">${c.nom}</span>
                        <span class="change-value">${c.changeSign}${c.changeValue}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ==================== STYLES ADDITIONNELS (inline pour cette page) ====================
const styles = document.createElement('style');
styles.textContent = `
    .match-card {
        background: var(--card-bg);
        border-radius: 12px;
        box-shadow: var(--shadow);
        padding: 2rem;
        margin-bottom: 2rem;
        transition: var(--transition);
    }
    
    .match-card:hover {
        box-shadow: var(--shadow-hover);
        transform: translateY(-2px);
    }
    
    .match-header h3 {
        color: var(--text-dark);
        margin-bottom: 1.5rem;
        text-transform: capitalize;
    }
    
    .match-content {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 2rem;
        align-items: center;
    }
    
    .equipe-box {
        text-align: center;
        padding: 1.5rem;
        background: var(--bg-color);
        border-radius: 8px;
        border: 3px solid transparent;
    }
    
    .equipe-box.winner {
        border-color: var(--primary-color);
        background: rgba(46, 204, 113, 0.05);
    }
    
    .equipe-box.loser {
        border-color: var(--danger-color);
        background: rgba(231, 76, 60, 0.05);
    }
    
    .equipe-box h4 {
        color: var(--secondary-color);
        margin-bottom: 1rem;
    }
    
    .match-score {
        font-size: 3rem;
        font-weight: 700;
        color: var(--text-dark);
        margin: 1rem 0;
    }
    
    .winner .match-score {
        color: var(--primary-color);
    }
    
    .loser .match-score {
        color: var(--text-light);
    }
    
    .match-separator {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-light);
    }
    
    .joueurs-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        margin-top: 1rem;
    }
    
    .joueur-badge {
        background: var(--card-bg);
        padding: 0.4rem 0.8rem;
        border-radius: 20px;
        font-size: 0.9rem;
        color: var(--text-dark);
    }
    
    .rating-changes {
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 1px solid var(--border-color);
    }
    
    .rating-changes h5 {
        color: var(--secondary-color);
        margin-bottom: 1rem;
    }
    
    .changes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.75rem;
    }
    
    .change-item {
        display: flex;
        justify-content: space-between;
        padding: 0.75rem;
        background: var(--bg-color);
        border-radius: 8px;
        border-left: 3px solid var(--border-color);
    }
    
    .change-item.positive {
        border-left-color: var(--primary-color);
        background: rgba(46, 204, 113, 0.05);
    }
    
    .change-item.negative {
        border-left-color: var(--danger-color);
        background: rgba(231, 76, 60, 0.05);
    }
    
    .change-name {
        font-weight: 500;
        color: var(--text-dark);
    }
    
    .change-value {
        font-weight: 700;
    }
    
    .change-item.positive .change-value {
        color: var(--primary-color);
    }
    
    .change-item.negative .change-value {
        color: var(--danger-color);
    }
    
    @media (max-width: 768px) {
        .match-content {
            grid-template-columns: 1fr;
            gap: 1rem;
        }
        
        .match-separator {
            transform: rotate(90deg);
        }
        
        .changes-grid {
            grid-template-columns: 1fr;
        }
    }
`;
document.head.appendChild(styles);

