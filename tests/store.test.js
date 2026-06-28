'use strict';

/**
 * store.test.js — Tests du gestionnaire d'état global (js/store.js)
 *
 * Le store est implémenté en ES module. Ce fichier recrée la même logique
 * en CJS pour tester les comportements sans infrastructure Firebase.
 *
 * Scénarios couverts :
 *  ✅  get / set valeurs simples
 *  ✅  Les valeurs par défaut sont présentes à l'initialisation
 *  ✅  subscribe : le callback est appelé quand la valeur change
 *  ✅  subscribe : le callback N'est PAS appelé si la valeur est identique
 *  ✅  subscribeAny : notifié pour tout changement
 *  ✅  unsubscribe fonctionne (callback plus appelé)
 *  ✅  getAll retourne l'état complet
 *  ✅  set retourne la nouvelle valeur
 *  ✅  invalidate vide les clés spécifiées (null)
 *  ✅  reset remet tout à null / défaut
 *  ✅  setGroupeActif met à jour groupeActif + invalide le cache groupe
 *  ✅  plusieurs listeners sur la même clé sont tous notifiés
 *  ✅  plusieurs clés indépendantes (listener sur A pas notifié si B change)
 */

// ── Implémentation CJS du store (miroir de js/store.js) ──────────────────────

function createStore(initialState) {
  const _state = { ...initialState };
  const _listeners = new Map();
  const _anyListeners = new Set();

  const store = {
    get(key) { return _state[key] ?? null; },

    getAll() { return { ..._state }; },

    set(key, value) {
      if (_state[key] === value) return value;
      _state[key] = value;
      if (_listeners.has(key)) {
        _listeners.get(key).forEach(cb => cb(value));
      }
      _anyListeners.forEach(cb => cb(key, value));
      return value;
    },

    subscribe(key, callback) {
      if (!_listeners.has(key)) _listeners.set(key, new Set());
      _listeners.get(key).add(callback);
      return () => _listeners.get(key)?.delete(callback);
    },

    subscribeAny(callback) {
      _anyListeners.add(callback);
      return () => _anyListeners.delete(callback);
    },

    invalidate(...keys) {
      keys.forEach(k => store.set(k, null));
    },

    reset() {
      Object.keys(_state).forEach(k => { _state[k] = null; });
      _anyListeners.forEach(cb => cb('__reset__', null));
    },

    setGroupeActif(groupeId) {
      _state.groupeActif = groupeId;
      // Invalide les données dépendantes du groupe
      ['joueurs', 'matchSemaine', 'inscriptions', 'synergies', 'historique'].forEach(k => {
        _state[k] = null;
      });
      if (_listeners.has('groupeActif')) {
        _listeners.get('groupeActif').forEach(cb => cb(groupeId));
      }
      _anyListeners.forEach(cb => cb('groupeActif', groupeId));
    },
  };

  return store;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — get / set basiques
// ─────────────────────────────────────────────────────────────────────────────

describe('Store — get / set', () => {
  let store;

  beforeEach(() => {
    store = createStore({ user: null, groupeActif: null, joueurs: null });
  });

  test('get retourne null par défaut', () => {
    expect(store.get('user')).toBeNull();
  });

  test('set stocke la valeur, get la retourne', () => {
    store.set('user', { uid: 'abc', displayName: 'Alice' });
    expect(store.get('user')).toEqual({ uid: 'abc', displayName: 'Alice' });
  });

  test('set retourne la valeur écrite', () => {
    const returned = store.set('user', 'bob');
    expect(returned).toBe('bob');
  });

  test('get d\'une clé inconnue retourne null', () => {
    expect(store.get('cle_inexistante')).toBeNull();
  });

  test('getAll retourne une copie du state complet', () => {
    store.set('user', 'alice');
    const all = store.getAll();
    expect(all.user).toBe('alice');
    // Ne doit pas être une référence directe (mutation safe)
    all.user = 'autre';
    expect(store.get('user')).toBe('alice');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — subscribe / unsubscribe
// ─────────────────────────────────────────────────────────────────────────────

describe('Store — subscribe', () => {
  let store;

  beforeEach(() => {
    store = createStore({ counter: 0, name: null });
  });

  test('le callback est appelé avec la nouvelle valeur quand elle change', () => {
    const spy = jest.fn();
    store.subscribe('counter', spy);
    store.set('counter', 42);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(42);
  });

  test('le callback N\'est pas appelé si la valeur est identique', () => {
    store.set('counter', 5);
    const spy = jest.fn();
    store.subscribe('counter', spy);
    store.set('counter', 5); // même valeur
    expect(spy).not.toHaveBeenCalled();
  });

  test('unsubscribe : le callback n\'est plus appelé', () => {
    const spy = jest.fn();
    const unsub = store.subscribe('counter', spy);
    store.set('counter', 1);
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
    store.set('counter', 2);
    expect(spy).toHaveBeenCalledTimes(1); // toujours 1
  });

  test('plusieurs listeners sur la même clé sont tous notifiés', () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    store.subscribe('counter', spy1);
    store.subscribe('counter', spy2);
    store.set('counter', 99);
    expect(spy1).toHaveBeenCalledWith(99);
    expect(spy2).toHaveBeenCalledWith(99);
  });

  test('listener sur clé A n\'est pas notifié si clé B change', () => {
    const spyA = jest.fn();
    store.subscribe('counter', spyA);
    store.set('name', 'bob'); // change une autre clé
    expect(spyA).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — subscribeAny
// ─────────────────────────────────────────────────────────────────────────────

describe('Store — subscribeAny', () => {
  let store;

  beforeEach(() => {
    store = createStore({ a: null, b: null });
  });

  test('subscribeAny est notifié pour tout changement de clé', () => {
    const spy = jest.fn();
    store.subscribeAny(spy);
    store.set('a', 1);
    store.set('b', 2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'a', 1);
    expect(spy).toHaveBeenNthCalledWith(2, 'b', 2);
  });

  test('unsubscribeAny stoppe les notifications', () => {
    const spy = jest.fn();
    const unsub = store.subscribeAny(spy);
    unsub();
    store.set('a', 10);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — invalidate + reset
// ─────────────────────────────────────────────────────────────────────────────

describe('Store — invalidate / reset', () => {
  let store;

  beforeEach(() => {
    store = createStore({ user: null, joueurs: null, synergies: null });
    store.set('user', 'alice');
    store.set('joueurs', [1,2,3]);
    store.set('synergies', { 'a-b': { valeur: 2 } });
  });

  test('invalidate remet à null les clés spécifiées', () => {
    store.invalidate('joueurs', 'synergies');
    expect(store.get('joueurs')).toBeNull();
    expect(store.get('synergies')).toBeNull();
    expect(store.get('user')).toBe('alice'); // inchangé
  });

  test('reset vide toutes les clés', () => {
    store.reset();
    expect(store.get('user')).toBeNull();
    expect(store.get('joueurs')).toBeNull();
    expect(store.get('synergies')).toBeNull();
  });

  test('reset notifie les listeners subscribeAny', () => {
    const spy = jest.fn();
    store.subscribeAny(spy);
    store.reset();
    expect(spy).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — setGroupeActif
// ─────────────────────────────────────────────────────────────────────────────

describe('Store — setGroupeActif', () => {
  let store;

  beforeEach(() => {
    store = createStore({
      groupeActif: null, joueurs: ['a','b'], matchSemaine: {},
      inscriptions: [], synergies: {}, historique: [],
    });
    // Pré-remplir des données de cache
    store.set('joueurs', ['alice','bob']);
    store.set('matchSemaine', { id: 'match1' });
  });

  test('setGroupeActif met à jour groupeActif', () => {
    store.setGroupeActif('groupe-abc');
    expect(store.get('groupeActif')).toBe('groupe-abc');
  });

  test('setGroupeActif invalide le cache joueurs / match / inscriptions / synergies / historique', () => {
    store.setGroupeActif('nouveau-groupe');
    expect(store.get('joueurs')).toBeNull();
    expect(store.get('matchSemaine')).toBeNull();
    expect(store.get('inscriptions')).toBeNull();
    expect(store.get('synergies')).toBeNull();
    expect(store.get('historique')).toBeNull();
  });

  test('le listener sur groupeActif est notifié', () => {
    const spy = jest.fn();
    store.subscribe('groupeActif', spy);
    store.setGroupeActif('groupe-xyz');
    expect(spy).toHaveBeenCalledWith('groupe-xyz');
  });

  test('changer de groupe invalide bien le cache précédent', () => {
    store.setGroupeActif('groupe1');
    store.set('joueurs', ['x','y']); // on charge des données pour groupe1
    store.setGroupeActif('groupe2');  // on change de groupe
    expect(store.get('joueurs')).toBeNull(); // cache groupe1 invalidé
  });
});
