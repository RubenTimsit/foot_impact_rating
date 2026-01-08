// ==================== IMPORTS ====================
import { db, collection, getDocs, addDoc, query, orderBy, where, COLLECTIONS } from './firebase-config.js';
import { checkAndShowModal, showCodeModal } from './code-modal.js';
import { creerNouveauJoueur } from './rating-system.js';

// ==================== VARIABLES GLOBALES ====================
let joueurs = [];
let matchs = [];
let currentFilter = 'all';
let groupeActuel = null;

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Application démarrée');
    console.log('📍 Début de la vérification du code de groupe...');
    
    try {
        // Vérifier le code de groupe et afficher le modal si nécessaire
        groupeActuel = await checkAndShowModal(async (groupe) => {
            console.log('✅ Code validé, groupe:', groupe);
            groupeActuel = groupe;
            
            // Afficher le nom du groupe
            displayGroupeName();
            
            await loadData();
            updateStats();
            displayPlayers();
            setupFilters();
        });
        
        // Si le groupe existe déjà (code stocké valide)
        if (groupeActuel) {
            console.log('✅ Groupe déjà stocké:', groupeActuel);
            
            // Afficher le nom du groupe
            displayGroupeName();
            
            await loadData();
            
            // Afficher les stats
            updateStats();
            
            // Afficher les joueurs
            displayPlayers();
            
            // Setup des filtres
            setupFilters();
        } else {
            console.log('⏳ En attente du code utilisateur (modal affiché)...');
        }
    } catch (error) {
        console.error('❌ Erreur dans l\'initialisation:', error);
    }
});

// ==================== CHARGEMENT DES DONNÉES ====================
async function loadData() {
    try {
        console.log('📡 Chargement des données...');
        
        if (!groupeActuel || !groupeActuel.id) {
            console.error('❌ Aucun groupe actuel défini');
            loadDemoData();
            return;
        }
        
        // Charger les joueurs depuis la sous-collection du groupe
        const joueursCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.JOUEURS}`;
        const joueursQuery = query(
            collection(db, joueursCollectionPath),
            orderBy('impactRating', 'desc')
        );
        const joueursSnapshot = await getDocs(joueursQuery);
        joueurs = joueursSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Charger les matchs depuis la sous-collection du groupe
        const matchsCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.MATCHS}`;
        const matchsQuery = query(
            collection(db, matchsCollectionPath),
            orderBy('date', 'desc')
        );
        const matchsSnapshot = await getDocs(matchsQuery);
        matchs = matchsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`✅ ${joueurs.length} joueurs chargés pour le groupe ${groupeActuel.nomGroupe}`);
        console.log(`✅ ${matchs.length} matchs chargés`);
        
    } catch (error) {
        console.error('❌ Erreur lors du chargement:', error);
        
        // Mode démo si Firebase n'est pas configuré
        console.log('📝 Mode démo activé - Firebase non configuré ou erreur de chargement');
        loadDemoData();
    }
}

// ==================== DONNÉES DE DÉMONSTRATION ====================
function loadDemoData() {
    // Base vide - pas de données fictives
    joueurs = [];
    matchs = [];
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

// ==================== MISE À JOUR DES STATISTIQUES ====================
function updateStats() {
    document.getElementById('total-joueurs').textContent = joueurs.length;
    document.getElementById('total-matchs').textContent = matchs.length;
    
    // Calculer le total de buts
    const totalButs = matchs.reduce((sum, match) => {
        return sum + (match.equipe1Score || 0) + (match.equipe2Score || 0);
    }, 0);
    document.getElementById('total-buts').textContent = totalButs;
}

// ==================== AFFICHAGE DES JOUEURS ====================
function displayPlayers() {
    const tbody = document.getElementById('players-tbody');
    
    // Filtrer les joueurs
    const filteredJoueurs = currentFilter === 'all' 
        ? joueurs 
        : joueurs.filter(j => j.positionPrincipale === currentFilter);
    
    if (filteredJoueurs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <p style="padding: 2rem; color: var(--text-light);">
                        ${joueurs.length === 0 
                            ? '⚠️ Aucun joueur enregistré. Configure Firebase ou ajoute des joueurs depuis la page Admin.' 
                            : 'Aucun joueur dans cette catégorie.'}
                    </p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredJoueurs.map((joueur, index) => `
        <tr>
            <td><strong>${index + 1}</strong></td>
            <td><strong>${joueur.nom}</strong></td>
            <td>
                <span class="position-badge ${joueur.positionPrincipale.toLowerCase()}">
                    ${joueur.positionPrincipale}
                </span>
            </td>
            <td>
                <span class="rating-value">${joueur.impactRating}</span>
            </td>
            <td>${joueur.matchsJoues}</td>
            <td>
                <span style="color: var(--primary-color);">${joueur.victoires}</span> - 
                <span style="color: var(--text-light);">${joueur.nuls || 0}</span> - 
                <span style="color: var(--danger-color);">${joueur.defaites}</span>
            </td>
            <td>
                <div class="presence-bar">
                    <div class="presence-fill" style="width: ${joueur.tauxPresence * 100}%"></div>
                </div>
                <span>${Math.round(joueur.tauxPresence * 100)}%</span>
            </td>
        </tr>
    `).join('');
}

// ==================== SETUP DES FILTRES ====================
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Retirer la classe active de tous les boutons
            filterButtons.forEach(b => b.classList.remove('active'));
            
            // Ajouter la classe active au bouton cliqué
            btn.classList.add('active');
            
            // Mettre à jour le filtre
            currentFilter = btn.dataset.filter;
            
            // Réafficher les joueurs
            displayPlayers();
        });
    });
    
    // Bouton ajouter un joueur
    const addPlayerBtn = document.getElementById('add-player-btn');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', showAddPlayerModal);
    }
}

// ==================== MODAL AJOUT JOUEUR ====================
function showAddPlayerModal() {
    if (!groupeActuel) {
        alert('⚠️ Erreur : Aucun groupe actuel');
        return;
    }
    
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'add-player-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-icon">⚽</div>
                <h2>Ajouter un joueur</h2>
                <p>Au groupe ${groupeActuel.nomGroupe}</p>
            </div>
            
            <form class="add-player-form" id="add-player-form">
                <div class="form-group">
                    <label for="player-nom">Prénom / Nom *</label>
                    <input 
                        type="text" 
                        id="player-nom" 
                        placeholder="Ex: Ruben"
                        required
                        autocomplete="off"
                    >
                    <small>Le nom qui sera affiché</small>
                </div>
                
                <div class="form-group">
                    <label for="player-position">Position *</label>
                    <select id="player-position" required>
                        <option value="">-- Choisis une position --</option>
                        <option value="Défenseur">🛡️ Défenseur</option>
                        <option value="Milieu">⚙️ Milieu</option>
                        <option value="Attaquant">⚡ Attaquant</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="player-email">Email (optionnel)</label>
                    <input 
                        type="email" 
                        id="player-email" 
                        placeholder="email@example.com"
                        autocomplete="email"
                    >
                    <small>Pour contacter le joueur si besoin</small>
                </div>
                
                <button type="submit" class="modal-submit-btn">
                    ➕ Ajouter le joueur
                </button>
                
                <button type="button" class="modal-submit-btn" style="background: var(--secondary-color); margin-top: 0.5rem;" onclick="document.getElementById('add-player-modal').remove(); document.body.style.overflow = '';">
                    Annuler
                </button>
                
                <div id="add-player-message" class="modal-message hidden"></div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Focus sur le premier input
    setTimeout(() => {
        document.getElementById('player-nom').focus();
    }, 300);
    
    // Setup du formulaire
    document.getElementById('add-player-form').addEventListener('submit', handleAddPlayer);
}

async function handleAddPlayer(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById('add-player-message');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="modal-loading"></span> Ajout en cours...';
    messageDiv.classList.add('hidden');
    
    try {
        const nom = document.getElementById('player-nom').value.trim();
        const position = document.getElementById('player-position').value;
        const email = document.getElementById('player-email').value.trim();
        
        if (!nom || nom.length < 2) {
            throw new Error('Le nom doit contenir au moins 2 caractères');
        }
        
        if (!position) {
            throw new Error('Choisis une position');
        }
        
        // Vérifier que le nom n'existe pas déjà dans ce groupe
        const nomNormalized = nom.toLowerCase();
        const exists = joueurs.some(j => j.nom.toLowerCase() === nomNormalized);
        
        if (exists) {
            throw new Error('Ce nom existe déjà. Choisis un nom différent ou ajoute un nom de famille.');
        }
        
        // Créer le joueur
        const nouveauJoueur = creerNouveauJoueur(nom, position);
        
        // Ajouter les infos supplémentaires
        if (email) {
            nouveauJoueur.email = email;
        }
        nouveauJoueur.dateInscription = new Date().toISOString();
        
        // Sauvegarder dans la sous-collection du groupe
        const joueursCollectionPath = `${COLLECTIONS.GROUPES}/${groupeActuel.id}/${COLLECTIONS.JOUEURS}`;
        const docRef = await addDoc(collection(db, joueursCollectionPath), nouveauJoueur);
        
        // Ajouter à la liste locale
        joueurs.push({ id: docRef.id, ...nouveauJoueur });
        
        // Afficher le succès
        messageDiv.innerHTML = `✅ ${nom} ajouté avec succès !`;
        messageDiv.className = 'modal-message success';
        messageDiv.classList.remove('hidden');
        
        // Rafraîchir l'affichage
        updateStats();
        displayPlayers();
        
        // Fermer le modal après 1.5 secondes
        setTimeout(() => {
            document.getElementById('add-player-modal').remove();
            document.body.style.overflow = '';
        }, 1500);
        
    } catch (error) {
        console.error('Erreur ajout joueur:', error);
        messageDiv.textContent = `❌ ${error.message}`;
        messageDiv.className = 'modal-message error';
        messageDiv.classList.remove('hidden');
        
        submitBtn.disabled = false;
        submitBtn.textContent = '➕ Ajouter le joueur';
    }
}

// ==================== EXPORT ====================
export { joueurs, matchs };

