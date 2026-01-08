// ==================== MODAL DE CONFIRMATION ====================

/**
 * Affiche un modal de confirmation personnalisé
 * @param {string} title - Titre du modal
 * @param {string} message - Message de confirmation
 * @param {string} icon - Emoji/icon à afficher (défaut: ⚠️)
 * @returns {Promise<boolean>} - true si confirmé, false si annulé
 */
export function showConfirmModal(title, message, icon = '⚠️') {
    return new Promise((resolve) => {
        // Créer le modal
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay confirm-modal';
        
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-icon">${icon}</div>
                    <h2>${title}</h2>
                </div>
                
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                
                <div class="modal-actions">
                    <button class="modal-btn modal-btn-cancel" id="confirm-cancel">
                        Annuler
                    </button>
                    <button class="modal-btn modal-btn-confirm" id="confirm-ok">
                        OK
                    </button>
                </div>
            </div>
        `;
        
        // Ajouter au DOM
        document.body.appendChild(modalOverlay);
        
        // Gestion des boutons
        const btnCancel = modalOverlay.querySelector('#confirm-cancel');
        const btnConfirm = modalOverlay.querySelector('#confirm-ok');
        
        // Fonction pour fermer le modal
        const closeModal = (result) => {
            modalOverlay.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(modalOverlay);
                resolve(result);
            }, 200);
        };
        
        // Event listeners
        btnCancel.addEventListener('click', () => closeModal(false));
        btnConfirm.addEventListener('click', () => closeModal(true));
        
        // Fermer avec Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Fermer en cliquant sur l'overlay
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal(false);
            }
        });
        
        // Focus sur le bouton OK
        setTimeout(() => btnConfirm.focus(), 100);
    });
}

