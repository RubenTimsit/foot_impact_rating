// ==================== ADMIN PANEL ====================

import { db, auth, collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where, deleteDoc, COLLECTIONS } from './firebase-config.js';
import { calculerChangementsMatch, creerNouveauJoueur } from './rating-system.js';
import { mettreAJourSynergiesEquipe } from './synergy-system.js';
import { equilibrerEquipes } from './team-balancer.js';
import { checkAndShowModal } from './code-modal.js';

// Code admin simple (à changer !)
const ADMIN_CODE = "foot2026";

let isAuthenticated = false;
let joueurs = [];
let synergies = {};
let groupeActuel = null;

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const adminSection = document.getElementById('admin-section');
    
    // Vérifier si déjà authentifié (session)
    if (sessionStorage.getItem('adminAuth') === 'true') {
        isAuthenticated = true;
        showAdminPanel();
    }
    
    // Form de connexion
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Déconnexion
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    
    // Tabs
    setupTabs();
    
    // Formulaires
    setupForms();
});

// ==================== AUTHENTIFICATION ====================
function handleLogin(e) {
    e.preventDefault();
    
    const code = document.getElementById('admin-code').value;
    const errorDiv = document.getElementById('login-error');
    
    if (code === ADMIN_CODE) {
        isAuthenticated = true;
        sessionStorage.setItem('adminAuth', 'true');
        errorDiv.classList.add('hidden');
        showAdminPanel();
    } else {
        errorDiv.textContent = '❌ Code incorrect';
        errorDiv.classList.remove('hidden');
    }
}

function handleLogout() {
    isAuthenticated = false;
    sessionStorage.removeItem('adminAuth');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('admin-section').classList.add('hidden');
}

async function showAdminPanel() {
    // Vérifier le code de groupe et afficher le modal si nécessaire
    groupeActuel = await checkAndShowModal(async (groupe) => {
        groupeActuel = groupe;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('admin-section').classList.remove('hidden');
        await loadAllData();
        await initMatchForm();
        await initTeamBalancer();
        await initPlayerManagement();
    });
    
    // Si le groupe existe déjà
    if (groupeActuel) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('admin-section').classList.remove('hidden');
        
        // Charger les données
        await loadAllData();
    
        // Initialiser les différents onglets
        await initMatchForm();
        await initTeamBalancer();
        await initPlayerManagement();
    }
}

// ==================== CHARGEMENT DES DONNÉES ====================
async function loadAllData() {
    try {
        if (!groupeActuel || !groupeActuel.id) {
            console.error('❌ Aucun groupe actuel défini');
            joueurs = [];
            synergies = {};
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
            synergies[doc.id] = doc.data();
        });
        
        console.log(`✅ ${joueurs.length} joueurs et ${Object.keys(synergies).length} synergies chargés`);
    } catch (error) {
        console.error('Erreur chargement:', error);
        // Base vide si erreur
        joueurs = [];
        synergies = {};
        console.log('📝 Aucune donnée trouvée, démarrage avec une base vide');
    }
}

// ==================== TABS ====================
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Désactiver tous les tabs
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activer le tab sélectionné
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// ==================== SETUP DES FORMULAIRES ====================
function setupForms() {
    // Formulaire nouveau match
    document.getElementById('match-form')?.addEventListener('submit', handleMatchSubmit);
    
    // Formulaire ajout joueur (désactivé, on utilise la page d'inscription publique maintenant)
    // document.getElementById('add-player-form')?.addEventListener('submit', handleAddPlayer);
    
    // Générer équipes
    document.getElementById('generate-teams-btn')?.addEventListener('click', handleGenerateTeams);
    
    // Date par défaut = aujourd'hui
    const dateInput = document.getElementById('match-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
}

// ==================== FORMULAIRE NOUVEAU MATCH ====================
async function initMatchForm() {
    const equipe1Container = document.getElementById('equipe1-joueurs');
    const equipe2Container = document.getElementById('equipe2-joueurs');
    
    if (!equipe1Container || !equipe2Container) return;
    
    // Afficher les joueurs avec checkboxes
    const joueursHTML = joueurs.map(joueur => `
        <label class="joueur-checkbox">
            <input type="checkbox" name="joueur" value="${joueur.id}" data-equipe="1">
            <div class="joueur-info">
                <span class="joueur-name">${joueur.nom}</span>
                <span class="joueur-details">${joueur.positionPrincipale} - Rating: ${joueur.impactRating}</span>
            </div>
        </label>
    `).join('');
    
    equipe1Container.innerHTML = joueursHTML;
    equipe2Container.innerHTML = joueursHTML.replace(/data-equipe="1"/g, 'data-equipe="2"');
}

async function handleMatchSubmit(e) {
    e.preventDefault();
    
    const successDiv = document.getElementById('match-success');
    const errorDiv = document.getElementById('match-error');
    
    try {
        // Récupérer les données du formulaire
        const date = document.getElementById('match-date').value;
        const score1 = parseInt(document.getElementById('equipe1-score').value);
        const score2 = parseInt(document.getElementById('equipe2-score').value);
        
        // Récupérer les joueurs sélectionnés
        const equipe1Checks = document.querySelectorAll('#equipe1-joueurs input[type="checkbox"]:checked');
        const equipe2Checks = document.querySelectorAll('#equipe2-joueurs input[type="checkbox"]:checked');
        
        const equipe1Ids = Array.from(equipe1Checks).map(cb => cb.value);
        const equipe2Ids = Array.from(equipe2Checks).map(cb => cb.value);
        
        // Validations
        if (equipe1Ids.length < 6 || equipe1Ids.length > 8) {
            throw new Error('Équipe 1 doit avoir entre 6 et 8 joueurs');
        }
        if (equipe2Ids.length < 6 || equipe2Ids.length > 8) {
            throw new Error('Équipe 2 doit avoir entre 6 et 8 joueurs');
        }
        
        const equipe1 = joueurs.filter(j => equipe1Ids.includes(j.id));
        const equipe2 = joueurs.filter(j => equipe2Ids.includes(j.id));
        
        // Calculer les changements de rating
        const changements = calculerChangementsMatch(equipe1, equipe2, score1, score2);
        
        // Déterminer le résultat
        let resultat1, resultat2;
        if (score1 > score2) {
            resultat1 = 'victoire';
            resultat2 = 'defaite';
        } else if (score1 < score2) {
            resultat1 = 'defaite';
            resultat2 = 'victoire';
        } else {
            resultat1 = 'nul';
            resultat2 = 'nul';
        }
        
        // Mettre à jour les synergies
        const scoreDiff1 = score1 - score2;
        const scoreDiff2 = score2 - score1;
        mettreAJourSynergiesEquipe(synergies, equipe1Ids, resultat1, scoreDiff1);
        mettreAJourSynergiesEquipe(synergies, equipe2Ids, resultat2, scoreDiff2);
        
        // Sauvegarder le match dans la sous-collection Firestore
        const matchData = {
            date: date,
            equipe1: {
                joueurs: equipe1Ids,
                score: score1
            },
            equipe2: {
                joueurs: equipe2Ids,
                score: score2
            },
            ratingChanges: changements,
            timestamp: new Date().toISOString()
        };
        
        const matchsCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.MATCHS}`;
        await addDoc(collection(db, matchsCollectionPath), matchData);
        
        // Mettre à jour les joueurs dans la sous-collection
        const joueursCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.JOUEURS}`;
        for (const joueurId in changements) {
            const joueur = joueurs.find(j => j.id === joueurId);
            if (joueur) {
                const equipe = equipe1Ids.includes(joueurId) ? resultat1 : resultat2;
                joueur.impactRating = changements[joueurId].nouveau;
                joueur.matchsJoues = (joueur.matchsJoues || 0) + 1;
                
                if (equipe === 'victoire') joueur.victoires = (joueur.victoires || 0) + 1;
                else if (equipe === 'nul') joueur.nuls = (joueur.nuls || 0) + 1;
                else joueur.defaites = (joueur.defaites || 0) + 1;
                
                await updateDoc(doc(db, joueursCollectionPath, joueurId), joueur);
            }
        }
        
        // Sauvegarder les synergies dans la sous-collection
        const synergiesCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.SYNERGIES}`;
        for (const [cle, syn] of Object.entries(synergies)) {
            const synDoc = doc(db, synergiesCollectionPath, cle);
            await updateDoc(synDoc, syn).catch(async () => {
                // Si n'existe pas, créer
                await addDoc(collection(db, synergiesCollectionPath), { ...syn, id: cle });
            });
        }
        
        successDiv.textContent = '✅ Match enregistré avec succès !';
        successDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        
        // Réinitialiser le formulaire
        e.target.reset();
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        
    } catch (error) {
        console.error('Erreur:', error);
        errorDiv.textContent = `❌ ${error.message}`;
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
    }
}

// ==================== GÉNÉRER DES ÉQUIPES ====================
async function initTeamBalancer() {
    const container = document.getElementById('joueurs-presents');
    if (!container) return;
    
    container.innerHTML = joueurs.map(joueur => `
        <label class="joueur-checkbox">
            <input type="checkbox" value="${joueur.id}" checked>
            <div class="joueur-info">
                <span class="joueur-name">${joueur.nom}</span>
                <span class="joueur-details">${joueur.positionPrincipale} (${joueur.impactRating})</span>
            </div>
        </label>
    `).join('');
}

async function handleGenerateTeams() {
    const resultDiv = document.getElementById('teams-result');
    
    try {
        // Récupérer les joueurs sélectionnés
        const selected = Array.from(document.querySelectorAll('#joueurs-presents input:checked'))
            .map(cb => joueurs.find(j => j.id === cb.value));
        
        if (selected.length < 14 || selected.length > 16) {
            throw new Error('Sélectionne entre 14 et 16 joueurs');
        }
        
        const tailleEquipe = selected.length / 2;
        
        // Générer les équipes
        const propositions = equilibrerEquipes(selected, synergies, tailleEquipe, 3);
        
        // Afficher les résultats
        resultDiv.innerHTML = propositions.map((prop, index) => `
            <div class="team-proposal">
                <h4>Proposition ${index + 1} - Score d'équilibre: ${Math.round(prop.evaluation.score)}</h4>
                <div class="teams-grid">
                    <div class="team-box">
                        <h5>Équipe 1</h5>
                        <ul>
                            ${prop.equipe1.map(j => `
                                <li><strong>${j.nom}</strong> (${j.positionPrincipale} - ${j.impactRating})</li>
                            `).join('')}
                        </ul>
                        <div class="team-stats">
                            <p><strong>Rating moyen:</strong> ${prop.evaluation.rating1}</p>
                            <p><strong>Synergie:</strong> ${prop.evaluation.syn1}</p>
                            <p><strong>Positions:</strong> ${prop.evaluation.pos1.Défenseur}D, ${prop.evaluation.pos1.Milieu}M, ${prop.evaluation.pos1.Attaquant}A</p>
                        </div>
                    </div>
                    <div class="team-box">
                        <h5>Équipe 2</h5>
                        <ul>
                            ${prop.equipe2.map(j => `
                                <li><strong>${j.nom}</strong> (${j.positionPrincipale} - ${j.impactRating})</li>
                            `).join('')}
                        </ul>
                        <div class="team-stats">
                            <p><strong>Rating moyen:</strong> ${prop.evaluation.rating2}</p>
                            <p><strong>Synergie:</strong> ${prop.evaluation.syn2}</p>
                            <p><strong>Positions:</strong> ${prop.evaluation.pos2.Défenseur}D, ${prop.evaluation.pos2.Milieu}M, ${prop.evaluation.pos2.Attaquant}A</p>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        resultDiv.classList.remove('hidden');
        
    } catch (error) {
        resultDiv.innerHTML = `<p class="error-message">${error.message}</p>`;
        resultDiv.classList.remove('hidden');
    }
}

// ==================== GESTION DES JOUEURS ====================
async function initPlayerManagement() {
    await displayPlayersList();
}

async function displayPlayersList() {
    const container = document.getElementById('admin-players-list');
    if (!container) return;
    
    if (joueurs.length === 0) {
        container.innerHTML = '<p class="text-center" style="color: var(--text-light); padding: 2rem;">Aucun joueur enregistré</p>';
        return;
    }
    
    container.innerHTML = joueurs.map(joueur => `
        <div class="admin-player-item">
            <div class="admin-player-info">
                <strong>${joueur.nom}</strong> - ${joueur.positionPrincipale} 
                <span style="color: var(--primary-color);">(${joueur.impactRating})</span>
                <br>
                <small>${joueur.matchsJoues || 0} matchs - ${joueur.victoires || 0}V ${joueur.nuls || 0}N ${joueur.defaites || 0}D</small>
            </div>
            <div class="admin-player-actions">
                <button class="btn btn-small btn-danger" onclick="deletePlayer('${joueur.id}')">🗑️ Supprimer</button>
            </div>
        </div>
    `).join('');
}

// Fonction désactivée - Les joueurs s'inscrivent via la page publique
// async function handleAddPlayer(e) { ... }

// Fonction globale pour supprimer un joueur
window.deletePlayer = async function(joueurId) {
    if (!confirm('Es-tu sûr de vouloir supprimer ce joueur ?')) return;
    
    try {
        const joueursCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.JOUEURS}`;
        await deleteDoc(doc(db, joueursCollectionPath, joueurId));
        joueurs = joueurs.filter(j => j.id !== joueurId);
        
        await displayPlayersList();
        await initMatchForm();
        await initTeamBalancer();
        
        alert('✅ Joueur supprimé');
    } catch (error) {
        alert(`❌ Erreur: ${error.message}`);
    }
};

