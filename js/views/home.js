// ============================================================
// VUE HOME — Accueil : mes groupes + prochain match
// ============================================================

import { store } from '../store.js';
import { getMesGroupes, rejoindreGroupe } from '../db.js';
import { esc, formatRating, showToast, skeletonCards, avatarHtml, formatDate } from '../utils.js';
import { demanderPermissionNotifications } from '../notifications.js';

const NOTIF_BANNER_KEY = 'mpm_notif_banner_dismissed';

function _shouldShowNotifBanner() {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'default') return false;
  if (localStorage.getItem(NOTIF_BANNER_KEY)) return false;
  return true;
}

function renderNotifBanner(uid) {
  if (!_shouldShowNotifBanner()) return;

  const banner = document.createElement('div');
  banner.id = 'notif-banner';
  banner.innerHTML = `
    <div style="
      background:#1C1C2A; border:1px solid #2ECC71; border-radius:12px;
      padding:12px 14px; display:flex; align-items:center; gap:10px;
      margin-bottom:1rem; font-family:Inter,sans-serif; font-size:13px;
    ">
      <span style="font-size:1.3rem;flex-shrink:0;">🔔</span>
      <div style="flex:1;color:#F0F0FA;line-height:1.4;">
        <strong style="display:block;margin-bottom:2px;">Reste dans la boucle</strong>
        <span style="color:#A0A0B8;">Reçois les alertes matchs, liste d'attente et résultats MOM.</span>
      </div>
      <button id="notif-banner-ok" style="
        background:#2ECC71; color:#000; border:none; padding:7px 13px;
        border-radius:8px; cursor:pointer; font-weight:700; font-size:12px; white-space:nowrap; flex-shrink:0;
      ">Activer</button>
      <button id="notif-banner-dismiss" style="
        background:none; border:none; color:#A0A0B8; cursor:pointer; font-size:1.1rem; padding:4px; flex-shrink:0;
      ">✕</button>
    </div>`;

  banner.querySelector('#notif-banner-ok').addEventListener('click', async () => {
    banner.remove();
    const granted = await demanderPermissionNotifications(uid);
    if (granted) showToast('Notifications activées !', 'success');
    else localStorage.setItem(NOTIF_BANNER_KEY, '1');
  });

  banner.querySelector('#notif-banner-dismiss').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem(NOTIF_BANNER_KEY, '1');
  });

  return banner;
}

// ── Composant groupe card ─────────────────────────────────────
function groupeCardHtml(g, uid) {
  const isAdmin  = g.adminId === uid;
  const isPend   = g._monStatut === 'pending';
  const isCurr   = g.id === store.get('groupeActifId');

  // Utiliser le vrai prochain match Firestore (_prochainMatch) ou null
  const pm = g._prochainMatch;
  const prochainMatchLabel = pm ? _labelMatch(pm) : null;

  return `
    <div class="groupe-card ${isCurr ? 'card-green' : ''}" data-groupe-id="${esc(g.id)}" style="${isPend ? 'opacity:0.6' : ''}">
      <div class="groupe-card-body">
        <div class="gc-header">
          <div>
            <div class="gc-title">${esc(g.nom)}</div>
            <div class="gc-code">Code : ${esc(g.code)}</div>
          </div>
          ${isCurr ? '<span class="badge badge-green">Actif</span>' : ''}
        </div>
        <div class="gc-badges">
          ${isAdmin ? '<span class="badge badge-orange">Admin</span>' : ''}
          ${isPend  ? '<span class="badge badge-muted">En attente</span>' : ''}
          <span class="badge badge-muted">⚽ max ${g.maxJoueursMatch || 10}</span>
        </div>
        ${!isPend ? `
        <div class="gc-rating-bar">
          <div>
            <div class="gc-rating-val">${formatRating(g._monRating)}</div>
            <div class="gc-rating-lbl">Mon rating</div>
          </div>
          ${tropheeMini(g._monTrophees)}
        </div>` : '<div class="gc-meta">Ta demande est en attente de validation.</div>'}
      </div>
      ${prochainMatchLabel && !isPend ? `
      <div class="gc-match-banner">
        <span>📅 Prochain : <strong>${prochainMatchLabel}</strong></span>
        <a href="#/match" class="btn btn-sm btn-primary" style="padding:0.3rem 0.8rem;">S'inscrire</a>
      </div>` : ''}
    </div>`;
}

function tropheeMini(trophees = {}) {
  const { or = 0, argent = 0, bronze = 0 } = trophees;
  if (!or && !argent && !bronze) return '';
  const parts = [];
  if (or)     parts.push(`<span title="${or}× Or">🥇${or > 1 ? '×'+or : ''}</span>`);
  if (argent) parts.push(`<span title="${argent}× Argent">🥈${argent > 1 ? '×'+argent : ''}</span>`);
  if (bronze) parts.push(`<span title="${bronze}× Bronze">🥉${bronze > 1 ? '×'+bronze : ''}</span>`);
  return `<div style="display:flex;gap:0.3rem;font-size:1.1rem;">${parts.join('')}</div>`;
}

function _labelMatch(match) {
  if (!match?.dateMatch) return null;
  try {
    const d = new Date(match.dateMatch);
    const label = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    const heure = match.heureMatch
      || (d.getHours() ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : null);
    return label + (heure ? ` à ${heure}` : '');
  } catch(_) { return null; }
}

// ── Modals ────────────────────────────────────────────────────
function renderModalRejoindre(onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <p class="modal-title">Rejoindre un groupe</p>
      <p class="modal-sub">Entre le code donné par l'admin du groupe.</p>
      <div class="form-group">
        <label class="form-label">Code du groupe</label>
        <input id="rj-code" class="form-input" type="text" placeholder="Ex : A1B2C3" maxlength="6" autocomplete="off" style="text-transform:uppercase;letter-spacing:0.1em;font-size:1.2rem;">
      </div>
      <div id="rj-msg"></div>
      <div class="modal-btns">
        <button class="btn btn-ghost" id="rj-cancel">Annuler</button>
        <button class="btn btn-primary" id="rj-submit">Rejoindre</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input   = overlay.querySelector('#rj-code');
  const msgEl   = overlay.querySelector('#rj-msg');
  const submitBtn = overlay.querySelector('#rj-submit');

  input.focus();
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  overlay.querySelector('#rj-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  submitBtn.addEventListener('click', async () => {
    const code = input.value.trim();
    if (code.length < 4) { msgEl.innerHTML = '<div class="form-msg error">Code trop court.</div>'; return; }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="btn-loader"></div>';
    msgEl.innerHTML = '';

    try {
      const user  = store.get('firebaseUser');
      const profil = store.get('profil') || {};
      await rejoindreGroupe(user.uid, code, profil);
      overlay.remove();
      showToast('Demande envoyée ! En attente de validation.', 'success');
      // Moment idéal pour demander la permission : l'user vient de faire une action positive
      demanderPermissionNotifications(store.get('firebaseUser').uid).catch(() => {});
      onSuccess();
    } catch (err) {
      msgEl.innerHTML = `<div class="form-msg error">${esc(err.message)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Rejoindre';
    }
  });
}

function renderModalCreer(onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <p class="modal-title">Créer un groupe</p>
      <p class="modal-sub">Tu deviendras automatiquement l'admin.</p>
      <div class="form-group">
        <label class="form-label">Nom du groupe</label>
        <input id="cr-nom" class="form-input" type="text" placeholder="Ex : Les Potes du Mardi" maxlength="40" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Joueurs max par match</label>
        <input id="cr-max" class="form-input" type="number" min="4" max="22" value="10">
      </div>
      <div class="form-group">
        <label class="form-label">Nombre de divisions</label>
        <select id="cr-divisions" class="form-input">
          <option value="1" selected>1 — Pas de divisions</option>
          <option value="2">2 divisions</option>
          <option value="3">3 divisions</option>
          <option value="4">4 divisions</option>
        </select>
      </div>
      <div id="cr-div-names" style="display:none;">
        <p class="text-sm text-muted" style="margin-bottom:0.5rem;">Noms des divisions (optionnel)</p>
        <div class="div-names-grid" id="cr-div-names-grid"></div>
      </div>
      <div id="cr-msg"></div>
      <div class="modal-btns">
        <button class="btn btn-ghost" id="cr-cancel">Annuler</button>
        <button class="btn btn-primary" id="cr-submit">Créer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const msgEl    = overlay.querySelector('#cr-msg');
  const submitBtn = overlay.querySelector('#cr-submit');
  const divSel   = overlay.querySelector('#cr-divisions');
  const divNames = overlay.querySelector('#cr-div-names');
  const divGrid  = overlay.querySelector('#cr-div-names-grid');

  function _updateDivNames() {
    const n = parseInt(divSel.value) || 1;
    if (n <= 1) {
      divNames.style.display = 'none';
      return;
    }
    divNames.style.display = '';
    divGrid.innerHTML = Array.from({ length: n }, (_, i) => `
      <input id="cr-div-${i}" class="form-input" type="text"
             placeholder="Division ${i + 1}" maxlength="20" autocomplete="off">`
    ).join('');
  }

  divSel.addEventListener('change', _updateDivNames);
  _updateDivNames();

  overlay.querySelector('#cr-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  submitBtn.addEventListener('click', async () => {
    const nom = overlay.querySelector('#cr-nom').value.trim();
    const max = overlay.querySelector('#cr-max').value;
    const n   = parseInt(divSel.value) || 1;
    if (!nom) { msgEl.innerHTML = '<div class="form-msg error">Saisis un nom de groupe.</div>'; return; }

    const nomsSousGroupes = n > 1
      ? Array.from({ length: n }, (_, i) => overlay.querySelector(`#cr-div-${i}`)?.value.trim() || `Division ${i + 1}`)
      : [];

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="btn-loader"></div>';
    msgEl.innerHTML = '';

    try {
      const user   = store.get('firebaseUser');
      const profil = store.get('profil') || {};
      await creerGroupe(user.uid, {
        nom,
        maxJoueursMatch: max,
        displayName: profil.displayName,
        nombreSousGroupes: n,
        nomsSousGroupes,
      });
      overlay.remove();
      showToast('Groupe créé !', 'success');
      onSuccess();
    } catch (err) {
      msgEl.innerHTML = `<div class="form-msg error">${esc(err.message)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer';
    }
  });
}

// ── Render principal ──────────────────────────────────────────
export async function render(container) {
  const uid = store.get('firebaseUser')?.uid;
  const profil = store.get('profil');

  // Squelette immédiat
  container.innerHTML = `
    <div class="view-section">
      <div class="card-row" style="margin-bottom:1.25rem;">
        <div>
          <h1 class="page-title">Bienvenue${profil?.displayName ? ', ' + esc(profil.displayName.split(' ')[0]) : ''} 👋</h1>
          <p class="page-sub">Tes groupes de foot</p>
        </div>
      </div>
      <div id="notif-banner-slot"></div>
      <div id="groupes-list">${skeletonCards(2)}</div>
      <div style="display:flex;gap:0.6rem;margin-top:1rem;">
        <button class="btn btn-secondary flex-1" id="btn-rejoindre">+ Rejoindre</button>
      </div>
    </div>`;

  function afficherGroupes(groupes) {
    const listEl = container.querySelector('#groupes-list');
    if (!listEl) return;

    if (!groupes.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚽</div>
          <h3>Pas encore de groupe</h3>
          <p>Rejoins un groupe existant ou crée le tien !</p>
        </div>`;
      return;
    }

    // Trier : actif en tête, puis alpha
    const sorted = [...groupes].sort((a, b) => {
      if (a.id === store.get('groupeActifId')) return -1;
      if (b.id === store.get('groupeActifId')) return 1;
      return (a._monStatut === 'active' ? 0 : 1) - (b._monStatut === 'active' ? 0 : 1);
    });

    listEl.innerHTML = sorted.map(g => groupeCardHtml(g, uid)).join('');

    listEl.querySelectorAll('.groupe-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a,button')) return;
        const gId = card.dataset.groupeId;
        const groupe = sorted.find(g => g.id === gId);
        if (!groupe || groupe._monStatut !== 'active') return;
        if (gId !== store.get('groupeActifId')) {
          store.setGroupeActif(gId);
          chargerGroupes(false); // rafraîchir sans skeleton
        }
        window.location.hash = '#/classement';
      });
    });
  }

  async function chargerGroupes(avecSkeleton = false) {
    const listEl = container.querySelector('#groupes-list');
    if (!listEl) return;

    // 1. Afficher le cache immédiatement si disponible
    const cache = store.get('mesGroupes');
    if (cache) {
      afficherGroupes(cache);
    } else if (avecSkeleton) {
      listEl.innerHTML = skeletonCards(2);
    }

    // 2. Rafraîchir depuis Firestore en arrière-plan
    try {
      const groupes = await getMesGroupes(uid);
      store.set('mesGroupes', groupes);
      // Ne mettre à jour que si le container existe encore (vue non détruite)
      if (container.querySelector('#groupes-list')) {
        afficherGroupes(groupes);
      }
    } catch (err) {
      if (!cache && container.querySelector('#groupes-list')) {
        listEl.innerHTML = `<div class="empty-state"><p class="text-muted">Erreur de chargement.</p></div>`;
      }
      console.error(err);
    }
  }

  // Afficher le cache instantanément, puis charger en arrière-plan
  chargerGroupes(!store.get('mesGroupes'));

  // Bannière notifications (uniquement si l'user a un groupe actif)
  const groupes = store.get('mesGroupes') || [];
  const aGroupeActif = groupes.some(g => g._monStatut === 'active');
  if (aGroupeActif) {
    const banner = renderNotifBanner(uid);
    if (banner) container.querySelector('#notif-banner-slot')?.replaceWith(banner);
  }

  // Boutons
  container.querySelector('#btn-rejoindre')?.addEventListener('click', () => {
    renderModalRejoindre(() => chargerGroupes());
  });

  return {
    destroy() {
      // Rien à nettoyer (pas de onSnapshot ici)
    }
  };
}
