// ============================================================
// UTILS — Helpers partagés entre toutes les vues
// ============================================================

// ── Escape HTML ───────────────────────────────────────────────
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Format date ───────────────────────────────────────────────
export function formatDate(ts, opts = {}) {
  if (!ts) return '—';
  let date;
  if (ts?.toDate)    date = ts.toDate();
  else if (ts?.seconds) date = new Date(ts.seconds * 1000);
  else if (ts instanceof Date) date = ts;
  else date = new Date(ts);

  const options = {
    day: 'numeric', month: 'long', year: 'numeric',
    ...opts,
  };
  return date.toLocaleDateString('fr-FR', options);
}

export function formatDateShort(ts) {
  return formatDate(ts, { day: 'numeric', month: 'short', year: undefined });
}

export function formatDateInput(dateStr) {
  // Accepte "2024-01-15" ET "2024-01-15T17:30:00.000Z"
  if (!dateStr) return '—';
  const datePart = String(dateStr).split('T')[0]; // extrait "2024-01-15"
  const [y, m, d] = datePart.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Format rating ─────────────────────────────────────────────
export function formatRating(n) {
  const val = Math.round(Number(n) || 0);
  return val.toLocaleString('fr-FR');
}

// ── Delta rating HTML ─────────────────────────────────────────
export function deltaBadge(delta) {
  const n = Math.round(Number(delta) || 0);
  if (n > 0) return `<span class="delta-pos">+${n}</span>`;
  if (n < 0) return `<span class="delta-neg">${n}</span>`;
  return `<span class="delta-zero">±0</span>`;
}

export function rcBadge(delta) {
  const n = Math.round(Number(delta) || 0);
  const cls = n > 0 ? 'pos' : n < 0 ? 'neg' : 'zer';
  const txt = n > 0 ? `+${n}` : n < 0 ? `${n}` : '±0';
  return `<span class="rc-badge ${cls}">${txt}</span>`;
}

// ── Initiales ────────────────────────────────────────────────
export function initiales(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

// ── Avatar HTML ───────────────────────────────────────────────
export function avatarHtml(photoURL, displayName, size = 'md') {
  if (photoURL) {
    return `<div class="avatar avatar-${size}"><img src="${esc(photoURL)}" alt="${esc(displayName)}" loading="lazy"></div>`;
  }
  return `<div class="avatar avatar-${size}">${esc(initiales(displayName))}</div>`;
}

// ── Position badge ────────────────────────────────────────────
export function posBadge(position, profilMilieu) {
  const pos = position || 'Milieu';
  const cls = pos.toLowerCase().replace('é', 'e').replace('è', 'e');
  const label = pos;
  return `<span class="badge pos-${cls}">${esc(label)}</span>`;
}

// ── Trophées HTML ─────────────────────────────────────────────
export function tropheesHtml(trophees = {}) {
  const { or = 0, argent = 0, bronze = 0 } = trophees;
  const parts = [];
  if (or)     parts.push(`<span class="badge trophy-or">🥇×${or}</span>`);
  if (argent) parts.push(`<span class="badge trophy-argent">🥈×${argent}</span>`);
  if (bronze) parts.push(`<span class="badge trophy-bronze">🥉×${bronze}</span>`);
  return parts.join('');
}

// ── Présence bar HTML ─────────────────────────────────────────
export function presenceBar(matchsJoues, totalMatchs) {
  const pct = totalMatchs > 0 ? Math.round((matchsJoues / totalMatchs) * 100) : 0;
  return `
    <div class="presence-wrap">
      <div class="presence-bar"><div class="presence-fill" style="width:${pct}%"></div></div>
      <span class="text-muted text-sm">${pct}%</span>
    </div>`;
}

// ── Toast notification ────────────────────────────────────────
let _toastContainer = null;

function _getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

export function showToast(message, type = 'info', duration = 3000) {
  const container = _getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ── Confirmation modal ────────────────────────────────────────
export function showConfirm({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay center';
    overlay.innerHTML = `
      <div class="modal-sheet modal-sheet-centered">
        <p class="modal-title">${esc(title)}</p>
        <p class="modal-sub">${esc(message)}</p>
        <div class="modal-btns">
          <button class="btn btn-ghost" id="confirm-cancel">Annuler</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-ok').addEventListener('click', () => {
      overlay.remove(); resolve(true);
    });
    overlay.querySelector('#confirm-cancel').addEventListener('click', () => {
      overlay.remove(); resolve(false);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

// ── Rank emoji ────────────────────────────────────────────────
export function rankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

// ── Countdown (objet gérable) ─────────────────────────────────
export function createCountdown(targetMs, onTick, onEnd) {
  function tick() {
    const remaining = targetMs - Date.now();
    if (remaining <= 0) { onEnd?.(); return; }
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    const j = Math.floor(remaining / 86400000);
    onTick({ remaining, jours: j, heures: h % 24, minutes: m, secondes: s });
  }
  tick();
  const id = setInterval(tick, 1000);
  return { stop: () => clearInterval(id) };
}

// ── Skeleton helpers ──────────────────────────────────────────
export function skeletonLines(count = 3, widths = []) {
  return Array.from({ length: count }, (_, i) => {
    const w = widths[i] || (i === 0 ? '70%' : i % 2 === 0 ? '50%' : '85%');
    return `<div class="skeleton sk-line" style="width:${w}"></div>`;
  }).join('');
}

export function skeletonCards(count = 3) {
  return Array.from({ length: count }, () =>
    `<div class="skeleton sk-card"></div>`
  ).join('');
}

// ── Jour de la semaine ────────────────────────────────────────
export const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

export function jourLabel(dateStr) {
  if (!dateStr) return '';
  const datePart = String(dateStr).split('T')[0]; // accepte ISO complet
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return '';
  return JOURS[date.getDay()];
}
