// ==================== MODULE AUTH ====================

import {
    auth, db,
    GoogleAuthProvider, signInWithPopup,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged,
    doc, getDoc, setDoc
} from './firebase-config.js';

import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Le statut super admin est stocké dans Firestore (collection 'admins/{uid}')
// Pour l'activer : Firebase Console → Firestore → collection 'admins' → document '{ton_uid}' → champ superAdmin: true

// ==================== CONNEXION ====================

export async function connecterAvecGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    await syncUserProfile(result.user);
    return result.user;
}

export async function connecterAvecEmail(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await syncUserProfile(result.user);
    return result.user;
}

export async function inscrireAvecEmail(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await syncUserProfile(result.user, displayName);
    return result.user;
}

export async function deconnecter() {
    await signOut(auth);
    window.location.href = 'index.html';
}

export async function envoyerReinitialisationMdp(email) {
    await sendPasswordResetEmail(auth, email);
}

// ==================== PROFIL FIRESTORE ====================

export async function syncUserProfile(user, displayNameOverride = null) {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            displayName: displayNameOverride || user.displayName || '',
            email: user.email,
            photoURL: user.photoURL || null,
            position: null,
            profilMilieu: null,
            dateInscription: new Date().toISOString(),
            profilComplet: false
        });
        return { isNew: true };
    }

    return { isNew: false, data: snap.data() };
}

export async function getUserProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

export async function updateUserProfile(uid, data) {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
}

// ==================== UTILITAIRES ====================

export async function isSuperAdmin(uid) {
    try {
        const snap = await getDoc(doc(db, 'admins', uid));
        return snap.exists() && snap.data().superAdmin === true;
    } catch {
        return false;
    }
}

export function getUtilisateurActuel() {
    return auth.currentUser;
}

// ==================== GUARDS ====================

/**
 * Redirige vers login.html si l'utilisateur n'est pas connecté.
 * Résout avec l'utilisateur si connecté.
 */
export function requireAuth(redirectTo = 'login.html') {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (!user) {
                window.location.href = redirectTo;
            } else {
                resolve(user);
            }
        });
    });
}

/**
 * Redirige vers profil.html si l'utilisateur EST déjà connecté (page login/landing).
 * Super admin → super-admin.html
 */
export function requireGuest(redirectTo = 'profil.html') {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (user) {
                if (await isSuperAdmin(user.uid)) {
                    window.location.href = 'super-admin.html';
                } else {
                    window.location.href = redirectTo;
                }
            } else {
                resolve();
            }
        });
    });
}

/**
 * Écoute les changements d'état auth.
 * Callback reçoit l'utilisateur ou null.
 */
export function onAuthReady(callback) {
    return onAuthStateChanged(auth, callback);
}
