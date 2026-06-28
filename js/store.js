// ============================================================
// STORE — État global réactif de la SPA
// ============================================================
// Usage :
//   import { store } from './store.js';
//   store.set('profil', data);
//   store.get('profil');
//   store.subscribe('joueurs', (val) => render(val));
//   store.subscribeAny((key, val) => console.log(key, val));
// ============================================================

const _state = {
  // ── Auth
  firebaseUser:  null,   // firebase.User | null
  profil:        null,   // { displayName, email, photoURL, position, profilMilieu, profilComplet, ... }

  // ── Mes groupes
  mesGroupes:    null,   // [] | null (null = pas chargé)

  // ── Groupe actif
  groupeActifId: null,   // string | null
  groupeActif:   null,   // { id, nom, code, adminId, maxJoueursMatch, configHebdos, ... }
  isAdmin:       false,  // l'user courant est adminId du groupe actif

  // ── Cache données du groupe actif (null = pas encore chargé)
  joueurs:       null,   // []
  matchSemaine:  null,   // {} | false (false = aucun match cette semaine)
  monInscription:null,   // 'confirmé' | 'attente' | null
  inscriptions:  null,   // { confirmes: [], attente: [] }
  historique:    null,   // []
  synergies:     null,   // []

  // ── Super admin
  isSuperAdmin:  false,

  // ── UI
  loading:       false,
  currentRoute:  '/',
};

// Map : key → Set de callbacks
const _listeners  = new Map();
// Set de callbacks "any" (appelés à chaque set)
const _anyListeners = new Set();

// ── Subscriptions ─────────────────────────────────────────────
function _notify(key, value) {
  if (_listeners.has(key)) {
    _listeners.get(key).forEach(cb => { try { cb(value, key); } catch(e) { console.error('[store]', e); } });
  }
  _anyListeners.forEach(cb => { try { cb(key, value); } catch(e) { console.error('[store]', e); } });
}

// ── API publique ───────────────────────────────────────────────
export const store = {

  get(key) {
    return _state[key];
  },

  getAll() {
    return { ..._state };
  },

  set(key, value) {
    _state[key] = value;
    _notify(key, value);
  },

  // Écouter une clé spécifique
  subscribe(key, callback) {
    if (!_listeners.has(key)) _listeners.set(key, new Set());
    _listeners.get(key).add(callback);
    // Retourne une fonction de nettoyage
    return () => _listeners.get(key)?.delete(callback);
  },

  // Écouter n'importe quel changement
  subscribeAny(callback) {
    _anyListeners.add(callback);
    return () => _anyListeners.delete(callback);
  },

  // ── Changer le groupe actif
  setGroupeActif(groupeId) {
    if (_state.groupeActifId === groupeId) return;
    _state.groupeActifId = groupeId;
    _notify('groupeActifId', groupeId);
    // Invalider tout le cache groupe
    this.invalidateGroupeCache();
    // Persister le choix
    if (groupeId) {
      try { localStorage.setItem('mpm_groupe_actif', groupeId); } catch(_) {}
    }
  },

  // ── Invalider le cache du groupe actif
  invalidateGroupeCache() {
    const keys = ['groupeActif', 'isAdmin', 'joueurs', 'matchSemaine',
                  'monInscription', 'inscriptions', 'historique', 'synergies'];
    keys.forEach(k => {
      _state[k] = k === 'isAdmin' ? false : null;
      _notify(k, _state[k]);
    });
  },

  // ── Invalider seulement certaines clés
  invalidate(...keys) {
    keys.forEach(k => {
      const reset = k === 'isAdmin' ? false : null;
      _state[k] = reset;
      _notify(k, reset);
    });
  },

  // ── Reset complet (logout)
  reset() {
    const defaults = {
      firebaseUser: null, profil: null, mesGroupes: null,
      groupeActifId: null, groupeActif: null, isAdmin: false,
      joueurs: null, matchSemaine: null, monInscription: null,
      inscriptions: null, historique: null, synergies: null,
      isSuperAdmin: false, loading: false, currentRoute: '/',
    };
    Object.entries(defaults).forEach(([k, v]) => {
      _state[k] = v;
      _notify(k, v);
    });
    try { localStorage.removeItem('mpm_groupe_actif'); } catch(_) {}
  },

  // ── Restaurer le groupe actif depuis localStorage
  restoreGroupeActif() {
    try {
      const saved = localStorage.getItem('mpm_groupe_actif');
      if (saved) _state.groupeActifId = saved;
    } catch(_) {}
  },
};

// Restaurer au démarrage
store.restoreGroupeActif();
