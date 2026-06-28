// ============================================================
// ROUTER — Hash-based SPA router
// ============================================================
// Routing via window.location.hash (#/route)
// Transitions : fade out → injecter → fade in
// Guards : auth requis, admin requis pour /admin
// Lazy loading : import() dynamique de chaque vue
// ============================================================

import { store } from './store.js';
import { auth, onAuthStateChanged } from './firebase-config.js';
import { getMonProfil, getMesGroupes, getGroupe, checkIsSuperAdmin, watchJoueursPending } from './db.js';
import { initNotifications } from './notifications.js';

// ── Routes déclarées ──────────────────────────────────────────
const ROUTES = {
  '/':          () => import('./views/home.js'),
  '/classement': () => import('./views/classement.js'),
  '/match':     () => import('./views/match.js'),
  '/synergies': () => import('./views/synergies.js'),
  '/profil':    () => import('./views/profil.js'),
  '/admin':     () => import('./views/admin.js'),
};

// Routes nécessitant un groupe actif
const GROUPE_ROUTES = new Set(['/classement', '/match', '/synergies', '/admin']);
// Route nécessitant isAdmin
const ADMIN_ROUTES  = new Set(['/admin']);

// ── État du routeur ───────────────────────────────────────────
let _currentDestroyFn = null;      // cleanup de la vue active
let _pendingUnwatch   = null;       // unsubscribe pending watcher
let _authReady        = false;
let _pendingNavigation = null;

// ── Éléments DOM ─────────────────────────────────────────────
const $loader    = document.getElementById('app-loader');
const $header    = document.getElementById('app-header');
const $main      = document.getElementById('app-main');
const $nav       = document.getElementById('bottom-nav');
const $container = document.getElementById('view-container');
const $navAdmin  = document.getElementById('nav-admin');
const $groupeSel = document.getElementById('group-selector');
const $groupeName= document.getElementById('current-group-name');

// ── Utilitaire : parse le hash ────────────────────────────────
function parseHash(hash) {
  return hash.replace(/^#/, '') || '/';
}

// ── Navigation principale ─────────────────────────────────────
async function navigate(hash) {
  const route = parseHash(hash);

  if (!_authReady) {
    _pendingNavigation = route;
    return;
  }

  const user = store.get('firebaseUser');
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Guard admin
  if (ADMIN_ROUTES.has(route) && !store.get('isAdmin') && !store.get('isSuperAdmin')) {
    history.replaceState(null, '', '#/classement');
    navigate('#/classement');
    return;
  }

  // Guard groupe : si route nécessite un groupe et aucun groupe actif
  if (GROUPE_ROUTES.has(route)) {
    const groupeId = store.get('groupeActifId');
    if (!groupeId) {
      history.replaceState(null, '', '#/');
      navigate('#/');
      return;
    }
    // Charger le groupe actif si pas encore chargé
    if (!store.get('groupeActif')) {
      await _loadGroupeActif(store.get('groupeActifId'));
    }
  }

  store.set('currentRoute', route);
  _updateBottomNav(route);
  await _renderView(route);
}

// ── Charger les données du groupe actif ───────────────────────
async function _loadGroupeActif(groupeId) {
  try {
    const groupe = await getGroupe(groupeId);
    store.set('groupeActif', groupe);
    const uid = store.get('firebaseUser').uid;
    store.set('isAdmin', groupe.adminId === uid || store.get('isSuperAdmin'));

    // Mettre à jour le header
    if ($groupeName) $groupeName.textContent = groupe.nom;
    // Afficher/masquer tab admin
    if ($navAdmin) $navAdmin.classList.toggle('hidden', !store.get('isAdmin'));

    // Watcher pending (badge admin)
    if (_pendingUnwatch) { _pendingUnwatch(); _pendingUnwatch = null; }
    if (store.get('isAdmin')) {
      _pendingUnwatch = watchJoueursPending(groupeId, (pending) => {
        const badge = $navAdmin?.querySelector('.nav-badge');
        if (!badge) return;
        if (pending.length > 0) {
          badge.textContent = pending.length > 9 ? '9+' : pending.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      });
    }
  } catch (err) {
    console.error('[router] Erreur chargement groupe :', err);
    store.setGroupeActif(null);
    history.replaceState(null, '', '#/');
    navigate('#/');
  }
}

// ── Rendu de la vue ───────────────────────────────────────────
async function _renderView(route) {
  const loader = ROUTES[route] || ROUTES['/'];

  // Cleanup vue précédente
  if (_currentDestroyFn) {
    try { _currentDestroyFn(); } catch(_) {}
    _currentDestroyFn = null;
  }

  // Transition sortie (courte pour ne pas bloquer la perception)
  $container.classList.add('view-exit');
  await _sleep(80);

  // Vider le container
  $container.innerHTML = '';

  try {
    const module  = await loader();
    const renderFn = module.render || module.default;
    if (typeof renderFn === 'function') {
      const result = await renderFn($container);
      if (result && typeof result.destroy === 'function') {
        _currentDestroyFn = result.destroy;
      }
    }
  } catch (err) {
    console.error('[router] Erreur rendu vue :', err);
    $container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Erreur de chargement</h3>
        <p>Impossible de charger cette page.</p>
        <button class="btn btn-primary mt-md" onclick="location.hash='#/'">Retour à l'accueil</button>
      </div>`;
  }

  // Transition entrée
  $container.classList.remove('view-exit');
  $container.classList.add('view-enter');
  // Scroll en haut
  $main.scrollTop = 0;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => $container.classList.remove('view-enter'));
  });
}

// ── Mettre à jour la bottom nav ───────────────────────────────
function _updateBottomNav(route) {
  document.querySelectorAll('.nav-item').forEach(item => {
    const r = item.dataset.route;
    item.classList.toggle('active', r === route);
  });
}

// ── Initialisation auth ───────────────────────────────────────
async function _initAuth() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        store.set('firebaseUser', user);

        // Charger le profil en parallèle
        const [profil, isSA] = await Promise.all([
          getMonProfil(user.uid),
          checkIsSuperAdmin(user.uid),
        ]);

        store.set('profil', profil);
        store.set('isSuperAdmin', isSA);

        // Charger les groupes
        const groupes = await getMesGroupes(user.uid);
        store.set('mesGroupes', groupes);

        // Groupe actif : restauré depuis localStorage ou premier groupe actif
        const savedId = store.get('groupeActifId');
        const actifs  = groupes.filter(g => g._monStatut === 'active');

        const groupeId = (savedId && actifs.find(g => g.id === savedId))
          ? savedId
          : (actifs[0]?.id || null);

        if (groupeId && groupeId !== store.get('groupeActifId')) {
          store.setGroupeActif(groupeId);
        }

        if (groupeId) {
          await _loadGroupeActif(groupeId);
        } else {
          if ($groupeName) $groupeName.textContent = 'Mon Petit Match';
        }

        // Afficher l'app
        $loader?.classList.add('fade-out');
        setTimeout(() => { if ($loader) $loader.style.display = 'none'; }, 350);
        $header?.classList.remove('hidden');
        $main?.classList.remove('hidden');
        $nav?.classList.remove('hidden');

        _authReady = true;
        resolve(user);

        // Activer les notifications si permission déjà accordée (silencieux, sans bloquer)
        initNotifications(user.uid).catch(() => {});

        // Naviguer vers la route en attente
        const target = _pendingNavigation || parseHash(location.hash) || '/';
        _pendingNavigation = null;
        await navigate('#' + target);

      } else {
        // Non connecté
        store.reset();
        window.location.href = 'login.html';
        resolve(null);
      }
    });
  });
}

// ── Groupe picker ─────────────────────────────────────────────
function _initGroupePicker() {
  const modal    = document.getElementById('modal-group-picker');
  const list     = document.getElementById('group-picker-list');

  if (!$groupeSel || !modal) return;

  $groupeSel.addEventListener('click', () => {
    const groupes = store.get('mesGroupes') || [];
    const actifs  = groupes.filter(g => g._monStatut === 'active');

    if (actifs.length <= 1) return;

    $groupeSel.classList.add('open');
    list.innerHTML = actifs.map(g => `
      <button class="groupe-picker-item ${g.id === store.get('groupeActifId') ? 'active' : ''}"
              data-id="${g.id}">
        <span class="gpi-nom">${_esc(g.nom)}</span>
        ${g.id === store.get('groupeActifId') ? '<span class="gpi-check">✓</span>' : ''}
      </button>
    `).join('');

    modal.classList.remove('hidden');

    list.querySelectorAll('.groupe-picker-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        $groupeSel.classList.remove('open');
        modal.classList.add('hidden');
        if (id !== store.get('groupeActifId')) {
          store.setGroupeActif(id);
          await _loadGroupeActif(id);
          // Naviguer vers classement si on est sur une route groupe
          const route = store.get('currentRoute');
          navigate('#' + (GROUPE_ROUTES.has(route) ? route : '/classement'));
        }
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        $groupeSel.classList.remove('open');
        modal.classList.add('hidden');
      }
    }, { once: true });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function _esc(s)    { return String(s || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  _initGroupePicker();

  // Écoute les changements de hash
  window.addEventListener('hashchange', () => navigate(location.hash));

  // Initialiser l'auth
  await _initAuth();
}

boot();

// ── Export pour usage depuis les vues ─────────────────────────
export { navigate };
