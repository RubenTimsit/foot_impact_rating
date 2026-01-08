// ==================== PAGE SYNERGIES ====================

import { db, collection, getDocs, query, where, COLLECTIONS } from './firebase-config.js';
import { detecterTrios, detecterQuartets, getTopSynergies, genererMatriceSynergies } from './synergy-system.js';
import { checkAndShowModal, showCodeModal } from './code-modal.js';
import { clearCodeGroupe } from './groupe-manager.js';
import { showConfirmModal } from './confirm-modal.js';

let joueurs = [];
let synergies = {};
let groupeActuel = null;

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🤝 Page synergies chargée');
    
    // Vérifier le code de groupe et afficher le modal si nécessaire
    groupeActuel = await checkAndShowModal(async (groupe) => {
        groupeActuel = groupe;
        displayGroupeName();
        await loadData();
        displayGroupes();
        displayMatrix();
        displayTopSynergies();
    });
    
    // Si le groupe existe déjà
    if (groupeActuel) {
        displayGroupeName();
        await loadData();
        displayGroupes();
        displayMatrix();
        displayTopSynergies();
    }
    
    // Bouton changer de groupe
    const changeGroupeBtn = document.getElementById('change-groupe-btn');
    if (changeGroupeBtn) {
        changeGroupeBtn.addEventListener('click', handleChangeGroupe);
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
        
        // Charger les joueurs depuis la sous-collection du groupe
        const joueursCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.JOUEURS}`;
        const joueursSnapshot = await getDocs(collection(db, joueursCollectionPath));
        joueurs = joueursSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Charger les synergies depuis la sous-collection du groupe
        const synergiesCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.SYNERGIES}`;
        const synergiesSnapshot = await getDocs(collection(db, synergiesCollectionPath));
        synergies = {};
        synergiesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            synergies[doc.id] = data;
        });
        
        console.log(`✅ ${joueurs.length} joueurs et ${Object.keys(synergies).length} synergies chargés`);
        
    } catch (error) {
        console.error('Erreur chargement:', error);
        // Mode démo
        loadDemoData();
    }
}

function loadDemoData() {
    // Base vide - pas de données fictives
    joueurs = [];
    synergies = {};
    console.log('📝 Aucune donnée dans Firebase, démarrage avec une base vide');
}

// ==================== AFFICHAGE DU NOM DU GROUPE ====================
function displayGroupeName() {
    const groupeBadge = document.getElementById('groupe-badge');
    const groupeName = document.getElementById('groupe-name');
    
    if (groupeActuel && groupeBadge && groupeName) {
        groupeName.textContent = groupeActuel.nomGroupe;
        groupeBadge.style.display = 'inline-flex';
    }
}

// ==================== CHANGEMENT DE GROUPE ====================
async function handleChangeGroupe() {
    const confirmChange = await showConfirmModal(
        'Voulez-vous changer de groupe ?',
        'Vous allez être déconnecté du groupe actuel et vous devrez entrer un nouveau code.'
    );
    
    if (!confirmChange) return;
    
    clearCodeGroupe();
    console.log('🔄 Changement de groupe - localStorage effacé');
    
    joueurs = [];
    synergies = {};
    groupeActuel = null;
    
    const groupeBadge = document.getElementById('groupe-badge');
    if (groupeBadge) groupeBadge.style.display = 'none';
    
    groupeActuel = await showCodeModal(async (groupe) => {
        console.log('✅ Nouveau groupe sélectionné:', groupe);
        groupeActuel = groupe;
        displayGroupeName();
        await loadData();
        displayGroupes();
        displayMatrix();
        displayTopSynergies();
    });
}

// ==================== AFFICHAGE DES GROUPES ====================
function displayGroupes() {
    const container = document.getElementById('groupes-container');
    
    if (joueurs.length < 3) {
        container.innerHTML = '<p class="text-center" style="color: var(--text-light); padding: 2rem;">Pas assez de joueurs pour détecter des groupes</p>';
        return;
    }
    
    // Détecter les trios et quartets
    const trios = detecterTrios(synergies, joueurs, 2.5);
    const quartets = detecterQuartets(synergies, joueurs, 2);
    
    const groupes = [...quartets, ...trios].slice(0, 6); // Top 6 groupes
    
    if (groupes.length === 0) {
        container.innerHTML = '<p class="text-center" style="color: var(--text-light); padding: 2rem;">Aucun groupe détecté (besoin de plus de matchs)</p>';
        return;
    }
    
    container.innerHTML = groupes.map(groupe => `
        <div class="groupe-card">
            <div class="groupe-header">
                <span class="groupe-type">${groupe.type === 'trio' ? '🔥 Trio' : '⭐ Quartet'}</span>
                <span class="groupe-score">+${groupe.synergieGlobale}</span>
            </div>
            <div class="groupe-joueurs">
                <h4>Joueurs</h4>
                <div class="joueurs-names">
                    ${groupe.joueurs.map(j => `<span class="joueur-tag">${j.nom}</span>`).join('')}
                </div>
            </div>
            ${groupe.type === 'trio' ? `
                <div class="groupe-stats">
                    <div class="groupe-stat">
                        <span class="groupe-stat-value">${Object.values(groupe.synergies)[0]}</span>
                        <span class="groupe-stat-label">Syn 1-2</span>
                    </div>
                    <div class="groupe-stat">
                        <span class="groupe-stat-value">${Object.values(groupe.synergies)[1]}</span>
                        <span class="groupe-stat-label">Syn 1-3</span>
                    </div>
                    <div class="groupe-stat">
                        <span class="groupe-stat-value">${Object.values(groupe.synergies)[2]}</span>
                        <span class="groupe-stat-label">Syn 2-3</span>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// ==================== AFFICHAGE DE LA MATRICE ====================
function displayMatrix() {
    const container = document.getElementById('synergies-matrix');
    
    if (joueurs.length < 2) {
        container.innerHTML = '<p class="text-center" style="padding: 2rem;">Pas assez de joueurs</p>';
        return;
    }
    
    const matrice = genererMatriceSynergies(synergies, joueurs);
    
    let html = '<div class="matrix-row">';
    html += '<div class="matrix-cell header"></div>'; // Coin supérieur gauche
    
    // En-têtes colonnes
    joueurs.forEach(j => {
        html += `<div class="matrix-cell header">${j.nom}</div>`;
    });
    html += '</div>';
    
    // Lignes
    joueurs.forEach((joueur, i) => {
        html += '<div class="matrix-row">';
        html += `<div class="matrix-cell header">${joueur.nom}</div>`;
        
        matrice[i].forEach(cell => {
            if (cell.type === 'diagonal') {
                html += `<div class="matrix-cell diagonal">${cell.value}</div>`;
            } else {
                const displayValue = cell.value === 0 ? '0' : (cell.value > 0 ? `+${cell.value}` : cell.value);
                html += `
                    <div class="matrix-cell ${cell.type}">
                        ${displayValue}
                        <div class="matrix-tooltip">
                            ${cell.joueur1} ↔ ${cell.joueur2}<br>
                            Synergie: ${displayValue}
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

// ==================== AFFICHAGE TOP SYNERGIES ====================
function displayTopSynergies() {
    const container = document.getElementById('top-synergies-list');
    
    const topSyn = getTopSynergies(synergies, joueurs, 10);
    
    if (topSyn.length === 0) {
        container.innerHTML = '<p class="text-center" style="color: var(--text-light); padding: 2rem;">Aucune synergie détectée (besoin de plus de matchs)</p>';
        return;
    }
    
    container.innerHTML = topSyn.map((syn, index) => {
        const winRate = syn.matchsEnsemble > 0 
            ? Math.round((syn.victoires / syn.matchsEnsemble) * 100) 
            : 0;
        
        return `
            <div class="synergie-item">
                <div class="synergie-rank">${index + 1}</div>
                <div class="synergie-joueurs">
                    <strong>${syn.nomJoueur1} ↔ ${syn.nomJoueur2}</strong>
                    <div class="synergie-details">
                        ${syn.matchsEnsemble} matchs - ${syn.victoires}V ${syn.nuls}N ${syn.defaites}D (${winRate}%)
                    </div>
                </div>
                <div class="synergie-score">
                    <span class="synergie-value">+${syn.valeur}</span>
                    <span class="synergie-label">synergie</span>
                </div>
            </div>
        `;
    }).join('');
}

