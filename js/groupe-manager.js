// ==================== GESTION DES GROUPES ====================

import { db, collection, getDocs, query, where, COLLECTIONS } from './firebase-config.js';

const STORAGE_KEY = 'impact_rating_groupe_id';

/**
 * Récupère tous les groupes disponibles
 */
export async function getCodesGroupes() {
    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.GROUPES));
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Erreur chargement groupes:', error);
        return [];
    }
}

/**
 * Vérifie si un code de groupe est valide
 * @param {string} code - Code à vérifier (6 lettres)
 * @returns {Object|null} - Infos du groupe (avec id) ou null
 */
export async function verifierCode(code) {
    try {
        const codeUpper = code.toUpperCase().trim();
        
        const q = query(
            collection(db, COLLECTIONS.GROUPES),
            where('code', '==', codeUpper)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return null;
        }
        
        const doc = snapshot.docs[0];
        return {
            id: doc.id,  // ID du document Firestore (important!)
            ...doc.data()
        };
        
    } catch (error) {
        console.error('Erreur vérification code:', error);
        return null;
    }
}

/**
 * Stocke l'ID du groupe actuel dans le localStorage
 */
export function setGroupeActuel(groupeId) {
    localStorage.setItem(STORAGE_KEY, groupeId);
}

/**
 * Récupère l'ID du groupe actuel depuis le localStorage
 */
export function getGroupeActuelId() {
    return localStorage.getItem(STORAGE_KEY);
}

/**
 * Efface l'ID du groupe (déconnexion)
 */
export function clearCodeGroupe() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Vérifie si un utilisateur est connecté à un groupe
 */
export function isConnecteAUnGroupe() {
    return getGroupeActuelId() !== null;
}

/**
 * Récupère les infos complètes du groupe actuel
 */
export async function getGroupeActuel() {
    const groupeId = getGroupeActuelId();
    if (!groupeId) return null;
    
    try {
        const groupesSnapshot = await getDocs(collection(db, COLLECTIONS.GROUPES));
        const groupe = groupesSnapshot.docs.find(doc => doc.id === groupeId);
        
        if (!groupe) return null;
        
        return {
            id: groupe.id,
            ...groupe.data()
        };
    } catch (error) {
        console.error('Erreur récupération groupe:', error);
        return null;
    }
}

/**
 * Données de démonstration si Firebase n'est pas configuré
 */
export function getCodesDemoData() {
    return [
        {
            code: 'ROSLAN',
            nomGroupe: 'Groupe Roslan',
            dateCreation: '2026-01-01',
            actif: true
        },
        {
            code: 'ZIDANE',
            nomGroupe: 'Groupe Zidane',
            dateCreation: '2026-01-01',
            actif: true
        },
        {
            code: 'NEYMAR',
            nomGroupe: 'Groupe Neymar',
            dateCreation: '2026-01-01',
            actif: true
        },
        {
            code: 'SUAREZ',
            nomGroupe: 'Groupe Suarez',
            dateCreation: '2026-01-01',
            actif: true
        },
        {
            code: 'MODRIC',
            nomGroupe: 'Groupe Modric',
            dateCreation: '2026-01-01',
            actif: true
        }
    ];
}

