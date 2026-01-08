// ==================== PAGE INSCRIPTION ====================

import { db, collection, getDocs, addDoc, query, where, COLLECTIONS } from './firebase-config.js';
import { creerNouveauJoueur } from './rating-system.js';
import { verifierCode, getCodeGroupeActuel, setCodeGroupeActuel } from './groupe-manager.js';

let joueurs = [];
let groupeActuel = null;

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📝 Page inscription chargée');
    
    // Vérifier si un code de groupe est déjà stocké
    const codeStocké = getCodeGroupeActuel();
    if (codeStocké) {
        const groupe = await verifierCode(codeStocké);
        if (groupe) {
            groupeActuel = groupe;
            showSectionInscription();
            await loadJoueurs();
            displayJoueurs();
        }
    }
    
    setupForm();
});

// ==================== CHARGEMENT DES JOUEURS ====================
async function loadJoueurs() {
    try {
        if (!groupeActuel) {
            joueurs = [];
            return;
        }
        
        // Filtrer par code de groupe
        const q = query(
            collection(db, COLLECTIONS.JOUEURS),
            where('codeGroupe', '==', groupeActuel.code)
        );
        
        const joueursSnapshot = await getDocs(q);
        joueurs = joueursSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`✅ ${joueurs.length} joueurs chargés pour le groupe ${groupeActuel.code}`);
        
    } catch (error) {
        console.error('Erreur chargement:', error);
        joueurs = [];
    }
}

// ==================== AFFICHAGE DES JOUEURS ====================
function displayJoueurs() {
    const container = document.getElementById('liste-joueurs');
    const countElement = document.getElementById('count-joueurs');
    const joueursSection = document.getElementById('joueurs-inscrits-section');
    const groupeInfo = document.getElementById('groupe-info');
    
    // Afficher la section
    joueursSection.style.display = 'block';
    
    // Afficher les infos du groupe
    if (groupeActuel) {
        document.getElementById('nom-groupe-display').textContent = groupeActuel.nomGroupe;
        document.getElementById('code-groupe-display').textContent = groupeActuel.code;
        groupeInfo.style.display = 'block';
    }
    
    countElement.textContent = joueurs.length;
    
    if (joueurs.length === 0) {
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: var(--text-light); padding: 2rem;">Sois le premier à t\'inscrire ! 🎉</p>';
        return;
    }
    
    // Trier par nom
    const joueursTriés = [...joueurs].sort((a, b) => a.nom.localeCompare(b.nom));
    
    container.innerHTML = joueursTriés.map(joueur => {
        // Emoji selon la position
        let emoji = '⚽';
        if (joueur.positionPrincipale === 'Défenseur') emoji = '🛡️';
        else if (joueur.positionPrincipale === 'Milieu') emoji = '⚙️';
        else if (joueur.positionPrincipale === 'Attaquant') emoji = '⚡';
        
        return `
            <div class="joueur-card">
                <div class="joueur-avatar">${emoji}</div>
                <div class="joueur-nom">${joueur.nom}</div>
                <span class="joueur-position ${joueur.positionPrincipale.toLowerCase()}">
                    ${joueur.positionPrincipale}
                </span>
                <div class="joueur-rating">${joueur.impactRating}</div>
            </div>
        `;
    }).join('');
}

// ==================== SETUP DU FORMULAIRE ====================
function setupForm() {
    const verifyCodeBtn = document.getElementById('verify-code-btn');
    const codeInput = document.getElementById('code-groupe-input');
    const checkBtn = document.getElementById('check-btn');
    const checkInput = document.getElementById('check-name');
    const inscriptionForm = document.getElementById('inscription-form');
    
    // Vérifier le code de groupe
    verifyCodeBtn?.addEventListener('click', () => handleVerifyCode());
    
    // Entrée dans le champ code
    codeInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleVerifyCode();
        }
    });
    
    // Vérifier si le nom existe
    checkBtn?.addEventListener('click', () => checkName());
    
    // Appuyer sur Entrée dans le champ de vérification
    checkInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkName();
        }
    });
    
    // Soumission du formulaire
    inscriptionForm?.addEventListener('submit', handleInscription);
    
    // Afficher/masquer le champ de profil selon la position
    const positionSelect = document.getElementById('position');
    const profilGroup = document.getElementById('profil-milieu-group');
    const profilSelect = document.getElementById('profil-milieu');
    
    positionSelect?.addEventListener('change', () => {
        if (positionSelect.value === 'Milieu') {
            profilGroup.style.display = 'block';
            profilSelect.required = true;
        } else {
            profilGroup.style.display = 'none';
            profilSelect.required = false;
            profilSelect.value = '';
        }
    });
}

// ==================== VÉRIFIER LE CODE DE GROUPE ====================
async function handleVerifyCode() {
    const input = document.getElementById('code-groupe-input');
    const resultDiv = document.getElementById('code-result');
    const verifyBtn = document.getElementById('verify-code-btn');
    
    const code = input.value.trim().toUpperCase();
    
    if (!code || code.length !== 6) {
        resultDiv.innerHTML = '⚠️ Le code doit contenir 6 caractères';
        resultDiv.className = 'error-message';
        resultDiv.classList.remove('hidden');
        return;
    }
    
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Vérification...';
    
    try {
        const groupe = await verifierCode(code);
        
        if (!groupe) {
            resultDiv.innerHTML = '❌ Code invalide. Vérifie auprès de l\'organisateur de ton groupe.';
            resultDiv.className = 'error-message';
            resultDiv.classList.remove('hidden');
            return;
        }
        
        // Code valide !
        groupeActuel = groupe;
        setCodeGroupeActuel(code);
        
        resultDiv.innerHTML = `✅ Bienvenue dans le groupe <strong>${groupe.nomGroupe}</strong> !`;
        resultDiv.className = 'success-message';
        resultDiv.classList.remove('hidden');
        
        // Afficher la section d'inscription
        setTimeout(() => {
            showSectionInscription();
        }, 1000);
        
    } catch (error) {
        console.error('Erreur:', error);
        resultDiv.innerHTML = '❌ Erreur de connexion. Réessaye.';
        resultDiv.className = 'error-message';
        resultDiv.classList.remove('hidden');
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Continuer';
    }
}

// ==================== AFFICHER SECTION INSCRIPTION ====================
async function showSectionInscription() {
    document.getElementById('code-section').classList.add('hidden');
    document.getElementById('check-section').classList.remove('hidden');
    
    // Charger et afficher les joueurs du groupe
    await loadJoueurs();
    displayJoueurs();
}

// ==================== VÉRIFIER SI NOM EXISTE ====================
function checkName() {
    const input = document.getElementById('check-name');
    const resultDiv = document.getElementById('check-result');
    const form = document.getElementById('inscription-form');
    const nomInput = document.getElementById('nom');
    
    const nom = input.value.trim();
    
    if (!nom) {
        resultDiv.textContent = '⚠️ Entre ton prénom';
        resultDiv.className = 'already-exists';
        resultDiv.classList.remove('hidden');
        return;
    }
    
    // Normaliser pour la comparaison (insensible à la casse)
    const nomNormalized = nom.toLowerCase();
    const exists = joueurs.some(j => j.nom.toLowerCase() === nomNormalized);
    
    if (exists) {
        resultDiv.innerHTML = `
            <strong>✅ Tu es déjà inscrit !</strong><br>
            Ton nom apparaît dans la liste ci-dessous. Tu peux maintenant participer aux matchs !
        `;
        resultDiv.className = 'already-exists';
        resultDiv.classList.remove('hidden');
        form.classList.add('hidden');
    } else {
        resultDiv.innerHTML = `
            <strong>🎉 Nom disponible !</strong><br>
            Tu peux t'inscrire avec le prénom "${nom}"
        `;
        resultDiv.className = 'available';
        resultDiv.classList.remove('hidden');
        
        // Pré-remplir le formulaire et l'afficher
        nomInput.value = nom;
        form.classList.remove('hidden');
        
        // Scroll vers le formulaire
        setTimeout(() => {
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

// ==================== INSCRIPTION ====================
async function handleInscription(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('form-error');
    const successDiv = document.getElementById('form-success');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Inscription en cours...';
    
    try {
        // Récupérer les valeurs
        const nom = document.getElementById('nom').value.trim();
        const position = document.getElementById('position').value;
        const profilMilieu = document.getElementById('profil-milieu').value || null;
        const email = document.getElementById('email').value.trim();
        const disponible = document.getElementById('disponible').checked;
        
        // Validations
        if (!nom || nom.length < 2) {
            throw new Error('Le prénom doit contenir au moins 2 caractères');
        }
        
        if (!position) {
            throw new Error('Choisis une position');
        }
        
        if (position === 'Milieu' && !profilMilieu) {
            throw new Error('Choisis un profil pour le milieu de terrain');
        }
        
        // Vérifier une dernière fois que le nom n'existe pas
        const nomNormalized = nom.toLowerCase();
        const exists = joueurs.some(j => j.nom.toLowerCase() === nomNormalized);
        
        if (exists) {
            throw new Error('Ce prénom est déjà pris. Choisis-en un autre ou ajoute ton nom de famille.');
        }
        
        // Créer le joueur
        const nouveauJoueur = creerNouveauJoueur(nom, position, profilMilieu);
        
        // Ajouter les infos supplémentaires
        if (email) {
            nouveauJoueur.email = email;
        }
        nouveauJoueur.disponible = disponible;
        nouveauJoueur.dateInscription = new Date().toISOString();
        
        // IMPORTANT : Ajouter le code du groupe
        nouveauJoueur.codeGroupe = groupeActuel.code;
        
        // Sauvegarder dans Firestore
        const docRef = await addDoc(collection(db, COLLECTIONS.JOUEURS), nouveauJoueur);
        
        // Ajouter à la liste locale
        joueurs.push({ id: docRef.id, ...nouveauJoueur });
        
        // Afficher le succès
        successDiv.innerHTML = `
            <strong>🎉 Inscription réussie !</strong><br>
            Bienvenue ${nom} ! Tu commences avec un rating de 1000 points.<br>
            Tu apparais maintenant dans la liste des joueurs. 👇
        `;
        successDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        
        // Rafraîchir l'affichage
        displayJoueurs();
        
        // Réinitialiser le formulaire
        e.target.reset();
        document.getElementById('check-name').value = '';
        
        // Cacher le formulaire après 2 secondes et scroll vers la liste
        setTimeout(() => {
            document.getElementById('inscription-form').classList.add('hidden');
            document.getElementById('check-section').scrollIntoView({ behavior: 'smooth' });
            
            // Réinitialiser le message de vérification
            const resultDiv = document.getElementById('check-result');
            resultDiv.classList.add('hidden');
        }, 3000);
        
        // Highlight le nouveau joueur
        setTimeout(() => {
            const newCard = Array.from(document.querySelectorAll('.joueur-nom'))
                .find(el => el.textContent === nom)
                ?.closest('.joueur-card');
            
            if (newCard) {
                newCard.style.animation = 'highlight 2s ease';
                newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 3500);
        
    } catch (error) {
        console.error('Erreur inscription:', error);
        errorDiv.textContent = `❌ ${error.message}`;
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
    } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.textContent = '⚽ M\'inscrire !';
    }
}

// ==================== ANIMATION ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes highlight {
        0%, 100% { 
            border-color: transparent;
            transform: scale(1);
        }
        50% { 
            border-color: var(--primary-color);
            transform: scale(1.05);
            box-shadow: 0 4px 16px rgba(46, 204, 113, 0.3);
        }
    }
`;
document.head.appendChild(style);

