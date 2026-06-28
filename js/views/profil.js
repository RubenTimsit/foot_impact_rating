// ============================================================
// VUE PROFIL — Stats perso + paramètres
// ============================================================

import { store } from '../store.js';
import { updateMonProfil } from '../db.js';
import { esc, formatRating, posBadge, tropheesHtml, avatarHtml, showToast, skeletonLines } from '../utils.js';
import { demanderPermissionNotifications } from '../notifications.js';

const POSITIONS = ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'];
const PROFILS_MILIEU = ['Défensif', 'Offensif', null];

// ── Stats globales sur tous les groupes ───────────────────────
function calcStatsGlobales(groupes) {
  let matchs = 0, victoires = 0, nuls = 0, defaites = 0;
  groupes.forEach(g => {
    const j = g._joueurData;
    if (!j || g._monStatut !== 'active') return;
    matchs    += j.matchsJoues  || 0;
    victoires += j.victoires    || 0;
    nuls      += j.nuls         || 0;
    defaites  += j.defaites     || 0;
  });
  const ratio = matchs > 0 ? Math.round((victoires / matchs) * 100) : 0;
  return { matchs, victoires, nuls, defaites, ratio };
}

function calcTropheesTotaux(groupes) {
  const totaux = { or: 0, argent: 0, bronze: 0 };
  groupes.forEach(g => {
    const t = g._monTrophees || {};
    totaux.or     += t.or     || 0;
    totaux.argent += t.argent || 0;
    totaux.bronze += t.bronze || 0;
  });
  return totaux;
}

// ── Formulaire édition profil ─────────────────────────────────
function renderEditModal(profil, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <p class="modal-title">Modifier le profil</p>
      <div class="form-group">
        <label class="form-label">Prénom / pseudo</label>
        <input id="ed-name" class="form-input" type="text" value="${esc(profil.displayName || '')}" maxlength="30" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Poste préféré</label>
        <select id="ed-pos" class="form-input">
          ${POSITIONS.map(p => `<option value="${p}" ${profil.position === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div id="ed-milieu-group" class="form-group" style="${profil.position === 'Milieu' ? '' : 'display:none'}">
        <label class="form-label">Profil milieu</label>
        <select id="ed-milieu" class="form-input">
          ${PROFILS_MILIEU.map(m => `<option value="${m || ''}" ${profil.profilMilieu === m ? 'selected' : ''}>${m || '— Général —'}</option>`).join('')}
        </select>
      </div>
      <div id="ed-msg"></div>
      <div class="modal-btns">
        <button class="btn btn-ghost" id="ed-cancel">Annuler</button>
        <button class="btn btn-primary" id="ed-save">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const posSelect = overlay.querySelector('#ed-pos');
  const milieuGrp = overlay.querySelector('#ed-milieu-group');

  posSelect.addEventListener('change', () => {
    milieuGrp.style.display = posSelect.value === 'Milieu' ? '' : 'none';
  });

  overlay.querySelector('#ed-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#ed-save').addEventListener('click', async () => {
    const name   = overlay.querySelector('#ed-name').value.trim();
    const pos    = overlay.querySelector('#ed-pos').value;
    const milieu = pos === 'Milieu' ? (overlay.querySelector('#ed-milieu').value || null) : null;

    if (!name) {
      overlay.querySelector('#ed-msg').innerHTML = '<div class="form-msg error">Saisis ton prénom.</div>';
      return;
    }

    const btn = overlay.querySelector('#ed-save');
    btn.disabled = true;
    btn.innerHTML = '<div class="btn-loader"></div>';

    try {
      await onSave({ displayName: name, position: pos, profilMilieu: milieu });
      overlay.remove();
      showToast('Profil mis à jour !', 'success');
    } catch (err) {
      overlay.querySelector('#ed-msg').innerHTML = `<div class="form-msg error">${esc(err.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    }
  });
}

// ── Section notifications ─────────────────────────────────────
function _notifSectionHtml() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return '';

  const perm = Notification.permission;
  const isOn = perm === 'granted';
  const isDenied = perm === 'denied';

  return `
    <div class="view-section">
      <p class="section-title">Préférences</p>
      <div class="card">
        <div style="display:flex;align-items:center;gap:0.85rem;">
          <span style="font-size:1.3rem;">🔔</span>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:0.95rem;">Notifications push</div>
            <div class="text-muted text-sm" id="notif-status-label">
              ${isDenied
                ? 'Bloquées — autorise-les dans les paramètres du navigateur'
                : isOn ? 'Activées' : 'Désactivées'}
            </div>
          </div>
          ${isDenied ? '' : `
          <label for="notif-toggle" style="display:flex;align-items:center;cursor:pointer;flex-shrink:0;">
            <input type="checkbox" id="notif-toggle" class="toggle-cb" ${isOn ? 'checked' : ''}>
            <span class="toggle-switch"></span>
          </label>`}
        </div>
      </div>
    </div>`;
}

// ── Render principal ──────────────────────────────────────────
export async function render(container) {
  const user   = store.get('firebaseUser');
  const profil = store.get('profil') || {};
  const groupes = store.get('mesGroupes') || [];

  const stats   = calcStatsGlobales(groupes);
  const trophees = calcTropheesTotaux(groupes);

  const groupeActif = store.get('groupeActif');
  const joueurActif = groupeActif
    ? (groupes.find(g => g.id === groupeActif.id)?._joueurData || null)
    : null;

  container.innerHTML = `
    <!-- En-tête profil -->
    <div class="profil-header">
      ${avatarHtml(user?.photoURL, profil.displayName || user?.email, 'lg')}
      <div class="profil-info" style="flex:1;min-width:0;">
        <h2>${esc(profil.displayName || user?.email || 'Joueur')}</h2>
        <div class="profil-email">${esc(user?.email || '')}</div>
        ${profil.position ? `<div style="margin-top:0.4rem;">${posBadge(profil.position, profil.profilMilieu)}</div>` : ''}
        ${trophees.or || trophees.argent || trophees.bronze
          ? `<div class="profil-trophees">${tropheesHtml(trophees)}</div>` : ''}
      </div>
      <button class="btn-icon" id="btn-edit-profil" title="Modifier le profil">✏️</button>
    </div>

    <!-- Stats globales -->
    <div class="view-section">
      <p class="section-title">Stats globales</p>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">⚽</div>
          <div class="stat-num">${stats.matchs}</div>
          <div class="stat-label">Matchs joués</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏆</div>
          <div class="stat-num">${stats.victoires}</div>
          <div class="stat-label">Victoires</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🤝</div>
          <div class="stat-num">${stats.nuls}</div>
          <div class="stat-label">Nuls</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-num">${stats.ratio}%</div>
          <div class="stat-label">Win rate</div>
        </div>
      </div>
    </div>

    <!-- Stats groupe actif -->
    ${groupeActif && joueurActif ? `
    <div class="view-section">
      <p class="section-title">Dans "${esc(groupeActif.nom)}"</p>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
          <span class="text-muted text-sm">Rating actuel</span>
          <span style="font-size:1.4rem;font-weight:800;color:var(--green);">${formatRating(joueurActif.rating)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;text-align:center;">
          <div>
            <div style="font-size:1.2rem;font-weight:700;color:var(--green);">${joueurActif.victoires || 0}</div>
            <div class="text-muted" style="font-size:0.78rem;">V</div>
          </div>
          <div>
            <div style="font-size:1.2rem;font-weight:700;">${joueurActif.nuls || 0}</div>
            <div class="text-muted" style="font-size:0.78rem;">N</div>
          </div>
          <div>
            <div style="font-size:1.2rem;font-weight:700;color:var(--danger);">${joueurActif.defaites || 0}</div>
            <div class="text-muted" style="font-size:0.78rem;">D</div>
          </div>
        </div>
        ${joueurActif.votesParticipes > 0 ? `
        <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <span class="text-muted text-sm">Votes soumis</span>
          <span class="badge badge-blue">${joueurActif.votesParticipes} vote${joueurActif.votesParticipes > 1 ? 's' : ''}</span>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- Mes groupes résumé -->
    ${groupes.filter(g => g._monStatut === 'active').length > 0 ? `
    <div class="view-section">
      <p class="section-title">Mes groupes</p>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        ${groupes.filter(g => g._monStatut === 'active').map(g => `
          <div class="card card-row" style="padding:0.85rem 1.1rem;cursor:pointer;" data-gid="${esc(g.id)}">
            <div>
              <div style="font-weight:700;">${esc(g.nom)}</div>
              <div class="text-muted text-sm">${formatRating(g._monRating)} pts</div>
            </div>
            <span class="badge ${g.id === store.get('groupeActifId') ? 'badge-green' : 'badge-muted'}">
              ${g.id === store.get('groupeActifId') ? '✓ Actif' : 'Voir'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- Préférences -->
    ${_notifSectionHtml()}

    <!-- Déconnexion -->
    <div class="view-section" style="padding-bottom:0.5rem;">
      <button class="btn btn-ghost btn-full" id="btn-disconnect" style="color:var(--danger);border-color:rgba(248,81,73,0.2);">
        ⎋ Se déconnecter
      </button>
    </div>`;

  // Bouton édition
  container.querySelector('#btn-edit-profil')?.addEventListener('click', () => {
    renderEditModal(profil, async (data) => {
      await updateMonProfil(user.uid, data);
      store.set('profil', { ...profil, ...data });
      render(container); // re-render
    });
  });

  // Toggle notifications
  const notifToggle = container.querySelector('#notif-toggle');
  if (notifToggle) {
    notifToggle.addEventListener('change', async () => {
      if (notifToggle.checked) {
        notifToggle.checked = false; // on attend la confirmation du navigateur
        const granted = await demanderPermissionNotifications(user.uid);
        notifToggle.checked = granted;
        const label = container.querySelector('#notif-status-label');
        if (label) label.textContent = granted ? 'Activées' : 'Désactivées';
        if (granted) showToast('Notifications activées !', 'success');
        else showToast('Permission refusée.', 'error');
      }
      // Désactiver depuis le navigateur n'est pas possible via JS — on informe l'user
      else {
        notifToggle.checked = true;
        showToast('Pour désactiver, va dans les paramètres de ton navigateur.', 'info', 5000);
      }
    });
  }

  // Déconnexion
  container.querySelector('#btn-disconnect')?.addEventListener('click', async () => {
    const { auth, signOut } = await import('../firebase-config.js');
    await signOut(auth);
    window.location.href = 'login.html';
  });

  // Clic sur groupe → activer
  container.querySelectorAll('[data-gid]').forEach(el => {
    el.addEventListener('click', () => {
      const gid = el.dataset.gid;
      if (gid !== store.get('groupeActifId')) {
        store.setGroupeActif(gid);
        window.location.hash = '#/classement';
      }
    });
  });
}
