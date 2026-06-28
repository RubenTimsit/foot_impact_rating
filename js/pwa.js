// ==================== PWA — Enregistrement Service Worker ====================

// Enregistrer le service worker
if ('serviceWorker' in navigator) {
    let _refreshing = false;

    // Quand un nouveau SW prend le contrôle, recharger la page en court-circuitant
    // le cache HTTP (hash conservé pour rester sur la bonne vue)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (_refreshing) return;
        _refreshing = true;
        const base = location.href.split('?')[0];
        const hash = location.hash || '';
        location.replace(base + '?_sw=' + Date.now() + hash);
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((reg) => {
                // Forcer la vérification d'une mise à jour à chaque ouverture
                reg.update().catch(() => {});

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            _showUpdateBanner();
                        }
                    });
                });
            })
            .catch((err) => console.warn('[PWA] SW registration failed:', err));
    });
}

// Bannière "Mise à jour disponible"
function _showUpdateBanner() {
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
        <span>🔄 Nouvelle version disponible</span>
        <button onclick="window.location.reload()">Mettre à jour</button>
    `;
    banner.style.cssText = `
        position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
        background:#1C1C2A; border:1px solid #2ECC71; border-radius:12px;
        padding:12px 16px; display:flex; align-items:center; gap:12px;
        z-index:9999; font-family:Inter,sans-serif; font-size:13px;
        color:#F0F0FA; box-shadow:0 4px 20px rgba(0,0,0,0.5);
        white-space:nowrap;
    `;
    banner.querySelector('button').style.cssText = `
        background:#2ECC71; color:#000; border:none; padding:6px 12px;
        border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 10000);
}

// ── Prompt d'installation Android ────────────────────────────────────────────
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _showInstallButton();
});

function _showInstallButton() {
    // Ne pas afficher si déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const existing = document.getElementById('pwa-install-btn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.innerHTML = '📲 Installer l\'app';
    btn.style.cssText = `
        position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
        background:#2ECC71; color:#000; border:none; padding:12px 24px;
        border-radius:50px; cursor:pointer; font-weight:700; font-size:14px;
        font-family:Inter,sans-serif; z-index:9999;
        box-shadow:0 4px 20px rgba(46,204,113,0.4);
        white-space:nowrap;
    `;
    btn.addEventListener('click', async () => {
        if (!_deferredPrompt) return;
        _deferredPrompt.prompt();
        const { outcome } = await _deferredPrompt.userChoice;
        _deferredPrompt = null;
        btn.remove();
    });

    document.body.appendChild(btn);

    // Disparaît après 15s
    setTimeout(() => btn.remove(), 15000);
}

window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.remove();
});
