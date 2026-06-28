// ==================== FIREBASE MESSAGING (background) ====================
// Doit être en premier pour intercepter les push events avant tout autre handler.
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyAQtM3hdFqgyRW8uhq5Vhs_yis3UyD3VE4',
    authDomain: 'foot-4f0c2.firebaseapp.com',
    projectId: 'foot-4f0c2',
    storageBucket: 'foot-4f0c2.firebasestorage.app',
    messagingSenderId: '285043352720',
    appId: '1:285043352720:web:b583cf40d418d3f4ffe415',
});

const messaging = firebase.messaging();

// Messages reçus quand l'app est en arrière-plan ou fermée.
// Uniquement pour les messages data-only (sans clé "notification" dans le payload FCM).
// Les messages avec "notification" sont affichés automatiquement par Firebase.
messaging.onBackgroundMessage((payload) => {
    const { title = 'Mon Petit Match', body = '', url = '/app' } = payload.data || {};
    return self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        data: { url },
        vibrate: [100, 50, 100],
    });
});

// ==================== SERVICE WORKER — Mon Petit Match ====================
// Stratégie :
//   - Cache-first  : CSS, JS, polices → ultra-rapide après premier chargement
//   - Network-first : pages HTML       → toujours à jour, fallback cache si offline
//   - Bypass        : requêtes Firebase → Firestore gère son propre cache offline

const CACHE_VERSION = 'v39-insc-statut-fix';
const CACHE_STATIC  = `mpm-static-${CACHE_VERSION}`;
const CACHE_PAGES   = `mpm-pages-${CACHE_VERSION}`;

// Fichiers mis en cache au premier lancement (SPA app shell)
const STATIC_ASSETS = [
  '/css/app.css',
  '/css/landing.css',
  '/css/auth.css',
  '/js/firebase-config.js',
  '/js/store.js',
  '/js/db.js',
  '/js/router.js',
  '/js/utils.js',
  '/js/rating-system.js',
  '/js/synergy-system.js',
  '/js/pwa.js',
  '/js/notifications.js',
  '/js/views/match.js',
  '/js/views/admin.js',
  '/js/views/classement.js',
  '/js/views/home.js',
  '/js/views/synergies.js',
  '/js/views/profil.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

const APP_PAGES = [
  '/',
  '/index.html',
  '/app',
  '/app.html',
  '/login',
  '/login.html',
];

// ── Install ──────────────────────────────────────────────────────────────────
// cache:'reload' force le réseau même si le cache HTTP du navigateur a une version périmée
self.addEventListener('install', (event) => {
  const fetchFresh = (urls) => urls.map(url => new Request(url, { cache: 'reload' }));
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then((cache) => cache.addAll(fetchFresh(STATIC_ASSETS)).catch(() => {})),
      caches.open(CACHE_PAGES).then((cache) => cache.addAll(fetchFresh(APP_PAGES)).catch(() => {})),
    ]).then(() => self.skipWaiting())
  );
});

// ── Activate — nettoyer les anciens caches ───────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_PAGES)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass : Firebase, Google APIs, fonts → toujours réseau
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Fichiers statiques (CSS, JS, images) → Cache-first
  const isStaticAsset =
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname === '/manifest.json';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Pages HTML → Network-first, fallback cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_PAGES).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) =>
            cached ||
            caches.match('/app.html') ||
            new Response('Pas de connexion internet. Reconnecte-toi pour utiliser l\'app.', {
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
        )
      )
  );
});

// ── Clic sur une notification → focus ou ouvre l'app ────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});
