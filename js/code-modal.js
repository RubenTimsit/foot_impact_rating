// ==================== MODAL CODE GROUPE ====================

import { verifierCode, getGroupeActuel, setGroupeActuel } from './groupe-manager.js';

let modalElement = null;
let onSuccessCallback = null;

/**
 * Crée le modal HTML
 */
function createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'code-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-icon">🔐</div>
                <h2>Entre ton code de groupe</h2>
                <p>Pour accéder à l'application</p>
            </div>
            
            <form class="modal-form" id="modal-code-form">
                <div class="modal-input-group">
                    <label for="modal-code-input">Code de groupe</label>
                    <div class="modal-input-wrapper">
                        <input 
                            type="text" 
                            id="modal-code-input" 
                            class="modal-input"
                            placeholder="Ex: ABCDEF"
                            maxlength="6"
                            autocomplete="off"
                            required
                        >
                    </div>
                </div>
                
                <button type="submit" class="modal-submit-btn" id="modal-submit-btn">
                    Continuer
                </button>
                
                <div id="modal-message" class="modal-message hidden"></div>
            </form>
            
            <div class="modal-info-box">
                <p>Tu n'as pas de code ? Demande-le à l'organisateur de ton groupe.</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modalElement = modal;
    
    // Setup du formulaire
    setupModalForm();
    
    // Focus automatique sur l'input
    setTimeout(() => {
        document.getElementById('modal-code-input').focus();
    }, 300);
    
    return modal;
}

/**
 * Setup du formulaire du modal
 */
function setupModalForm() {
    const form = document.getElementById('modal-code-form');
    const input = document.getElementById('modal-code-input');
    const submitBtn = document.getElementById('modal-submit-btn');
    const messageDiv = document.getElementById('modal-message');
    
    // Auto-uppercase
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Soumission du formulaire
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const code = input.value.trim().toUpperCase();
        
        if (!code || code.length !== 6) {
            showMessage('⚠️ Le code doit contenir 6 caractères', 'error');
            return;
        }
        
        // Désactiver le bouton
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="modal-loading"></span> Vérification...';
        messageDiv.classList.add('hidden');
        
        try {
            // Vérifier le code
            const groupe = await verifierCode(code);
            
            if (!groupe) {
                showMessage('❌ Code invalide. Vérifie auprès de l\'organisateur.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Continuer';
                input.focus();
                return;
            }
            
            // Code valide ! Stocker l'ID du groupe (pas le code)
            setGroupeActuel(groupe.id);
            
            showMessage(`✅ Bienvenue dans le groupe ${groupe.nomGroupe} !`, 'success');
            
            // Attendre un peu puis fermer le modal
            setTimeout(() => {
                closeModal();
                if (onSuccessCallback) {
                    onSuccessCallback(groupe);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('❌ Erreur de connexion. Réessaye.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Continuer';
        }
    });
}

/**
 * Affiche un message dans le modal
 */
function showMessage(text, type) {
    const messageDiv = document.getElementById('modal-message');
    messageDiv.textContent = text;
    messageDiv.className = `modal-message ${type}`;
    messageDiv.classList.remove('hidden');
}

/**
 * Affiche le modal (export pour utilisation externe)
 */
export function showCodeModal(onSuccess) {
    console.log('🔐 Affichage du modal de code...');
    onSuccessCallback = onSuccess;
    
    // Supprimer l'ancien modal s'il existe
    if (modalElement) {
        modalElement.remove();
    }
    
    // Créer et afficher le nouveau modal
    createModal();
    
    // Empêcher le scroll du body
    document.body.style.overflow = 'hidden';
    
    console.log('✅ Modal affiché !');
}

/**
 * Ferme le modal
 */
export function closeModal() {
    if (modalElement) {
        modalElement.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modalElement.remove();
            modalElement = null;
            document.body.style.overflow = '';
        }, 300);
    }
}

/**
 * Vérifie si un groupe existe déjà et affiche le modal si nécessaire
 */
export async function checkAndShowModal(onSuccess) {
    console.log('🔍 Vérification du groupe stocké...');
    
    try {
        const groupe = await getGroupeActuel();
        
        if (!groupe) {
            // Pas de groupe stocké, afficher le modal
            console.log('❌ Aucun groupe stocké, affichage du modal...');
            showCodeModal(onSuccess);
            return null;
        }
        
        // Groupe valide, retourner les infos
        console.log('✅ Groupe valide:', groupe);
        return groupe;
    } catch (error) {
        console.error('❌ Erreur vérification groupe:', error);
        // En cas d'erreur, afficher le modal
        console.log('⚠️ Erreur, affichage du modal par sécurité...');
        showCodeModal(onSuccess);
        return null;
    }
}

// Animation de fermeture
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

