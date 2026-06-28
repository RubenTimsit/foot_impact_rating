// ==================== NOTIFICATIONS PUSH ====================
// La VAPID key est une clé PUBLIQUE (standard Web Push) — la committer en clair est normal.
// Elle sert uniquement à identifier le projet côté navigateur, pas à authentifier des requêtes.

import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
import { app, db, doc, updateDoc, arrayUnion } from './firebase-config.js';
import { showToast } from './utils.js';

const VAPID_KEY = 'BBrFIIAfRRmDjpw5E6chmWfBvCZxkYP-3xpy_8V3YPNSBqVRrzJIut2TYF4Sg0qmV7_9wmsLiay3CGNWX2q-vCw';

let _messaging = null;
let _foregroundHandlerBound = false;

/**
 * Appelé au démarrage si la permission est déjà accordée.
 * Enregistre silencieusement le token FCM et active les notifications foreground.
 */
export async function initNotifications(uid) {
    if (!_isSupported() || Notification.permission !== 'granted') return;
    await _registerToken(uid);
}

/**
 * Appelé après une action positive de l'utilisateur (ex : rejoindre un groupe).
 * Demande la permission au navigateur puis enregistre le token.
 * Retourne true si la permission a été accordée.
 */
export async function demanderPermissionNotifications(uid) {
    if (!_isSupported()) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    await _registerToken(uid);
    return true;
}

// ── Privé ─────────────────────────────────────────────────────

async function _registerToken(uid) {
    try {
        _messaging = _messaging || getMessaging(app);
        const swReg = await navigator.serviceWorker.ready;

        const token = await getToken(_messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swReg,
        });

        if (!token) return;

        // Sauvegarder le token dans le profil utilisateur (arrayUnion évite les doublons)
        await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });

        // Une seule fois : écouter les messages quand l'app est au premier plan
        if (!_foregroundHandlerBound) {
            _foregroundHandlerBound = true;
            onMessage(_messaging, (payload) => {
                const { title = '', body = '' } = payload.data || {};
                if (title) showToast(`${title}${body ? ' — ' + body : ''}`, 'info', 6000);
            });
        }
    } catch (err) {
        console.warn('[Notifs] Impossible d\'enregistrer le token :', err.message);
    }
}

function _isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}
