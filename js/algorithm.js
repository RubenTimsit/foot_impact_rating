// ==================== PAGE ALGORITHME ====================

import { checkAndShowModal, showCodeModal } from './code-modal.js';
import { clearCodeGroupe } from './groupe-manager.js';
import { showConfirmModal } from './confirm-modal.js';

let groupeActuel = null;

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🧮 Page algorithme chargée');
    
    // Vérifier le code de groupe et afficher le modal si nécessaire
    groupeActuel = await checkAndShowModal(async (groupe) => {
        groupeActuel = groupe;
        displayGroupeName();
    });
    
    // Si le groupe existe déjà
    if (groupeActuel) {
        displayGroupeName();
    }
    
    // Bouton changer de groupe
    const changeGroupeBtn = document.getElementById('change-groupe-btn');
    if (changeGroupeBtn) {
        changeGroupeBtn.addEventListener('click', handleChangeGroupe);
    }
});

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
    
    groupeActuel = null;
    
    const groupeBadge = document.getElementById('groupe-badge');
    if (groupeBadge) groupeBadge.style.display = 'none';
    
    groupeActuel = await showCodeModal(async (groupe) => {
        console.log('✅ Nouveau groupe sélectionné:', groupe);
        groupeActuel = groupe;
        displayGroupeName();
    });
}

