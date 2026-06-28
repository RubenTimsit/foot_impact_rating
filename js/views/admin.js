// ============================================================
// VUE ADMIN — Gestion du groupe (admin uniquement)
// ============================================================

import { store } from '../store.js';
import {
  getJoueursPending, getTousJoueurs, getInscriptions,
  validerJoueur, refuserJoueur, expulserJoueur,
  creerCreneauManuel, addHebdoConfig, toggleHebdoConfig,
  deleteHebdoConfig, updateGroupeSettings, validerMatch, getMatchesPourAdmin,
  assignerSousGroupe, ouvrirMatchADivisions, annulerCreneau,
} from '../db.js';
import { esc, formatDateInput, jourLabel, showToast, showConfirm, skeletonCards, avatarHtml } from '../utils.js';

const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ── Helpers divisions ─────────────────────────────────────────
function _divLabel(idx, nomsSousGroupes) {
  return (nomsSousGroupes && nomsSousGroupes[idx - 1]) || `Division ${idx}`;
}

/** Badge HTML coloré pour une division (idx = 1-4, null = non assigné) */
function _divBadge(sousGroupe, nomsSousGroupes) {
  if (sousGroupe == null) return '<span class="badge badge-muted">—</span>';
  return `<span class="div-badge-${sousGroupe}">${esc(_divLabel(sousGroupe, nomsSousGroupes))}</span>`;
}

/** Labels des divisions ciblées d'un créneau */
function _ciblesLabel(sousGroupesCibles, nomsSousGroupes) {
  if (!sousGroupesCibles || !sousGroupesCibles.length) return '';
  return sousGroupesCibles.map(d => `<span class="div-badge-${d}" style="margin-right:0.25rem;">${esc(_divLabel(d, nomsSousGroupes))}</span>`).join('');
}

/** Génère les checkboxes de sélection de divisions pour un formulaire */
function _divisionsCheckboxesHtml(groupe, namePrefix, defaultCheckedAll = true) {
  const n = groupe.nombreSousGroupes || 1;
  if (n <= 1) return '';
  const noms = groupe.nomsSousGroupes || [];
  return `
    <div class="form-group">
      <label class="form-label">Divisions ciblées</label>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.25rem;">
        ${Array.from({ length: n }, (_, i) => `
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
            <input type="checkbox" name="${namePrefix}" value="${i+1}" ${defaultCheckedAll ? 'checked' : ''}>
            <span class="div-badge-${i+1}">${esc(_divLabel(i+1, noms))}</span>
          </label>`).join('')}
      </div>
    </div>`;
}

/** Lit les divisions cochées dans un formulaire. Retourne null si pas de divisions. */
function _getSelectedDivisions(el, namePrefix, groupe) {
  if ((groupe.nombreSousGroupes || 1) <= 1) return null;
  const checked = [...el.querySelectorAll(`input[name="${namePrefix}"]:checked`)].map(cb => Number(cb.value));
  return checked.length ? checked : null;
}

// ── Onglets admin ─────────────────────────────────────────────
const TABS = [
  { id: 'membres',  label: '👥 Membres'       },
  { id: 'match',    label: '⚽ Match ponctuel' },
  { id: 'hebdo',    label: '📅 Récurrents'     },
  { id: 'settings', label: '⚙️ Params'         },
];

// ── TAB MEMBRES ───────────────────────────────────────────────
async function renderTabMembres(el, groupeId, uid) {
  el.innerHTML = skeletonCards(3);
  try {
    const groupe = store.get('groupeActif') || {};
    const n      = groupe.nombreSousGroupes || 1;
    const noms   = groupe.nomsSousGroupes || [];

    const [pending, tous] = await Promise.all([
      getJoueursPending(groupeId),
      getTousJoueurs(groupeId),
    ]);
    const actifs = tous.filter(j => j.statut === 'active');

    // Sélect de division pour les membres actifs (affiché si divisions actives)
    const divSelectHtml = (j) => {
      if (n <= 1) return '';
      const opts = `<option value="">—</option>` +
        Array.from({ length: n }, (_, i) => `<option value="${i+1}" ${j.sousGroupe === i+1 ? 'selected' : ''}>${esc(_divLabel(i+1, noms))}</option>`).join('');
      return `<select class="form-input div-assign-sel" data-uid="${esc(j.id)}" style="max-width:130px;padding:0.25rem 0.5rem;font-size:0.8rem;">${opts}</select>`;
    };

    el.innerHTML = `
      ${pending.length ? `
      <div class="view-section">
        <p class="section-title">En attente (${pending.length})</p>
        <div id="pending-list">
          ${pending.map(j => `
            <div class="pending-card" data-uid="${esc(j.id)}">
              ${avatarHtml(null, j.displayName, 'md')}
              <div class="pending-info">
                <div class="pending-name">${esc(j.displayName)}</div>
                <div class="pending-meta">${esc(j.position || 'Milieu')}</div>
              </div>
              <div class="pending-actions">
                <button class="btn btn-sm btn-danger" data-action="refuser" data-uid="${esc(j.id)}">✕</button>
                <button class="btn btn-sm btn-primary" data-action="valider" data-uid="${esc(j.id)}">✓</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : `
      <div class="form-msg success" style="margin-bottom:1rem;">✓ Pas de demande en attente</div>`}

      <div class="view-section">
        <p class="section-title">Membres actifs (${actifs.length})</p>
        <div>
          ${actifs.map(j => `
            <div class="pending-card">
              ${avatarHtml(null, j.displayName, 'md')}
              <div class="pending-info">
                <div class="pending-name">
                  ${esc(j.displayName)}
                  ${n > 1 ? `&nbsp;${_divBadge(j.sousGroupe, noms)}` : ''}
                </div>
                <div class="pending-meta">${j.matchsJoues || 0} matchs · ${j.rating || 1000} pts</div>
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem;">
                ${divSelectHtml(j)}
                ${j.id !== uid ? `<button class="btn btn-sm btn-danger" data-action="expulser" data-uid="${esc(j.id)}" data-name="${esc(j.displayName)}">Retirer</button>` : '<span class="you-badge">Toi</span>'}
              </div>
            </div>`).join('')}
          ${!actifs.length ? '<p class="text-muted text-sm">Aucun autre membre.</p>' : ''}
        </div>
      </div>`;

    // Changement de division
    el.querySelectorAll('.div-assign-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        const jUid = sel.dataset.uid;
        const val  = sel.value ? Number(sel.value) : null;
        try {
          await assignerSousGroupe(groupeId, jUid, val);
          showToast('Division mise à jour.', 'success');
          store.invalidate('joueurs');
        } catch(err) { showToast(err.message, 'error'); }
      });
    });

    // Events pending / expulser
    el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const jUid   = btn.dataset.uid;
        const name   = btn.dataset.name || '';

        if (action === 'valider') {
          btn.disabled = true;
          try {
            await validerJoueur(groupeId, jUid);
            showToast('Joueur validé !', 'success');
            renderTabMembres(el, groupeId, uid);
          } catch(err) { showToast(err.message, 'error'); btn.disabled = false; }
        }
        if (action === 'refuser') {
          const ok = await showConfirm({ title: 'Refuser', message: 'Cette demande sera supprimée.', confirmLabel: 'Refuser', danger: true });
          if (!ok) return;
          btn.disabled = true;
          try {
            await refuserJoueur(groupeId, jUid);
            showToast('Demande refusée.', 'info');
            renderTabMembres(el, groupeId, uid);
          } catch(err) { showToast(err.message, 'error'); btn.disabled = false; }
        }
        if (action === 'expulser') {
          const ok = await showConfirm({ title: `Retirer ${name}`, message: 'Ce joueur sera retiré du groupe.', confirmLabel: 'Retirer', danger: true });
          if (!ok) return;
          btn.disabled = true;
          try {
            await expulserJoueur(groupeId, jUid);
            showToast(`${name} retiré.`, 'info');
            renderTabMembres(el, groupeId, uid);
          } catch(err) { showToast(err.message, 'error'); btn.disabled = false; }
        }
      });
    });
  } catch(err) {
    el.innerHTML = `<p class="text-muted">Erreur de chargement.</p>`;
  }
}

// ── TAB MATCH ─────────────────────────────────────────────────
async function renderTabMatch(el, groupeId, uid) {
  el.innerHTML = skeletonCards(2);

  try {
    const groupe  = store.get('groupeActif') || {};
    const noms    = groupe.nomsSousGroupes || [];

    const [matchesAdmin, joueurs] = await Promise.all([
      getMatchesPourAdmin(groupeId),
      getTousJoueurs(groupeId),
    ]);
    const actifs    = joueurs.filter(j => j.statut === 'active');
    const joueurMap = {};
    actifs.forEach(j => { joueurMap[j.id] = j; });

    // === Bloc créneaux existants ===
    let creneauxSection = '';
    if (matchesAdmin.length) {
      const items = await Promise.all(matchesAdmin.map(async m => {
        const ouvertureDate = m.dateOuvertureInscription ? new Date(m.dateOuvertureInscription) : null;
        const badgeColor = m.statut === 'ouvert' ? 'badge-green'
          : m.statut === 'programmé' ? 'badge-yellow'
          : 'badge-red';
        const badgeLabel = m.statut === 'ouvert' ? 'Ouvert'
          : m.statut === 'programmé' ? 'Programmé'
          : 'Fermé — à valider';

        const divLabels = _ciblesLabel(m.sousGroupesCibles, noms);

        // Bloc overflow : bouton "Étendre à division X" sur les créneaux ouverts
        let overflowBlock = '';
        if (m.statut === 'ouvert' && (groupe.nombreSousGroupes || 1) > 1) {
          const divisionsActuelles = m.sousGroupesCibles || [];
          const divisionsManquantes = Array.from({ length: groupe.nombreSousGroupes }, (_, i) => i + 1)
            .filter(d => !divisionsActuelles.includes(d));

          if (divisionsActuelles.length && divisionsManquantes.length) {
            overflowBlock = `
              <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
                <p class="text-muted text-sm" style="margin-bottom:0.4rem;">Étendre les inscriptions :</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
                  ${divisionsManquantes.map(d => `
                    <button class="btn btn-sm btn-ghost btn-extend-div"
                            data-mid="${esc(m.id)}"
                            data-add-div="${d}"
                            style="font-size:0.78rem;padding:0.2rem 0.65rem;">
                      + <span class="div-badge-${d}">${esc(_divLabel(d, noms))}</span>
                    </button>`).join('')}
                  ${divisionsActuelles.length ? `
                    <button class="btn btn-sm btn-ghost btn-extend-div"
                            data-mid="${esc(m.id)}"
                            data-add-div="all"
                            style="font-size:0.78rem;padding:0.2rem 0.65rem;">
                      + Toutes les divisions
                    </button>` : ''}
                </div>
              </div>`;
          } else if (!divisionsActuelles.length) {
            // Pas de restriction → pas de bouton overflow nécessaire
          }
        }

        // Inscriptions pour les créneaux ouvert/fermé
        let inscBlock = '';
        if (m.statut === 'ouvert' || m.statut === 'fermé') {
          const inscriptions = await getInscriptions(groupeId, m.id);
          const confirmes    = inscriptions.confirmes;
          if (confirmes.length >= 2) {
            const playerCheckboxes = (pfx, color) =>
              confirmes.map(ins => `
                <label style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.5rem;background:var(--dark-3);border-radius:6px;cursor:pointer;">
                  <input type="checkbox" class="${pfx}-cb-${m.id}" value="${esc(ins.userId)}" style="width:15px;height:15px;accent-color:${color};">
                  <span style="font-size:0.85rem;">${esc(ins.displayName)}</span>
                </label>`).join('');

            const scoreRow = (mid, sfx = '') => `
              <div class="score-inputs" style="margin-bottom:0.75rem;">
                <div class="score-team">
                  <div class="score-team-label label-a">Éq. A</div>
                  <input id="score-a-${sfx}${mid}" type="number" class="score-input" min="0" max="99" value="0">
                </div>
                <span class="score-sep">–</span>
                <div class="score-team">
                  <div class="score-team-label label-b">Éq. B</div>
                  <input id="score-b-${sfx}${mid}" type="number" class="score-input" min="0" max="99" value="0">
                </div>
              </div>`;

            const teamColumns = (mid, sfx = '') => {
              const pfxA = sfx ? `eq-a-${sfx}` : 'eq-a';
              const pfxB = sfx ? `eq-b-${sfx}` : 'eq-b';
              return `
              <div class="form-row-2" style="margin-bottom:0.75rem;">
                <div>
                  <div style="color:#3b82f6;font-size:0.82rem;font-weight:600;margin-bottom:0.4rem;">🔵 Équipe A</div>
                  <div style="display:flex;flex-direction:column;gap:0.25rem;">${playerCheckboxes(pfxA, '#3b82f6')}</div>
                </div>
                <div>
                  <div style="color:#ef4444;font-size:0.82rem;font-weight:600;margin-bottom:0.4rem;">🔴 Équipe B</div>
                  <div style="display:flex;flex-direction:column;gap:0.25rem;">${playerCheckboxes(pfxB, '#ef4444')}</div>
                </div>
              </div>`;
            };

            inscBlock = `
              <div style="margin-top:1rem;">
                <p class="text-muted text-sm" style="margin-bottom:0.75rem;">${confirmes.length} joueur(s) inscrits · Saisis le score et compose les équipes :</p>

                <!-- Toggle soirée -->
                <label style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1rem;cursor:pointer;font-size:0.85rem;">
                  <input type="checkbox" id="toggle-soiree-${m.id}" style="width:16px;height:16px;accent-color:var(--accent);">
                  <span>Mode soirée <span class="text-muted">(2 sous-matchs, rééquilibrage en cours de match)</span></span>
                </label>

                <!-- === Match simple === -->
                <div id="match-simple-${m.id}">
                  ${scoreRow(m.id)}
                  ${teamColumns(m.id)}
                </div>

                <!-- === Soirée (caché par défaut) === -->
                <div id="match-soiree-${m.id}" style="display:none;">
                  <div style="margin-bottom:0.75rem;">
                    <label class="form-label" style="font-size:0.82rem;">⚖️ Poids des sous-matchs</label>
                    <select id="split-${m.id}" class="form-input" style="margin-top:0.3rem;">
                      <option value="0.5,0.5">50 % / 50 % (durée égale)</option>
                      <option value="0.333,0.667">1/3 – 2/3</option>
                      <option value="0.25,0.75">1/4 – 3/4</option>
                      <option value="0.667,0.333">2/3 – 1/3</option>
                      <option value="0.75,0.25">3/4 – 1/4</option>
                    </select>
                  </div>

                  <div style="border:1px solid var(--dark-4);border-radius:10px;padding:0.85rem;margin-bottom:0.75rem;">
                    <p style="font-weight:700;font-size:0.85rem;margin-bottom:0.6rem;">⚽ Sous-match 1</p>
                    ${scoreRow(m.id, 'sm1-')}
                    ${teamColumns(m.id, 'sm1')}
                  </div>

                  <div style="border:1px solid var(--dark-4);border-radius:10px;padding:0.85rem;margin-bottom:0.75rem;">
                    <p style="font-weight:700;font-size:0.85rem;margin-bottom:0.6rem;">⚽ Sous-match 2</p>
                    ${scoreRow(m.id, 'sm2-')}
                    ${teamColumns(m.id, 'sm2')}
                  </div>
                </div>

                <div id="val-msg-${m.id}"></div>
                <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
                  <button class="btn btn-primary btn-valider-match" data-mid="${esc(m.id)}" data-soiree="false" style="flex:1;">✅ Valider ce match</button>
                  <button class="btn btn-ghost btn-annuler-creneau" data-mid="${esc(m.id)}" style="color:var(--danger);border-color:var(--danger);">🗑 Annuler</button>
                </div>
              </div>`;
          } else if (m.statut === 'ouvert') {
            inscBlock = `
              <p class="text-muted text-sm" style="margin-top:0.75rem;">Pas encore assez de joueurs inscrits (${confirmes.length}).</p>
              <button class="btn btn-ghost btn-annuler-creneau btn-full" data-mid="${esc(m.id)}" style="margin-top:0.5rem;color:var(--danger);border-color:var(--danger);">🗑 Annuler ce créneau</button>`;
          } else {
            inscBlock = `
              <p class="text-muted text-sm" style="margin-top:0.75rem;">Aucun inscrit enregistré pour ce créneau.</p>
              <button class="btn btn-ghost btn-annuler-creneau btn-full" data-mid="${esc(m.id)}" style="margin-top:0.5rem;color:var(--danger);border-color:var(--danger);">🗑 Annuler ce créneau</button>`;
          }
        } else if (m.statut === 'programmé') {
          const dtOuv = ouvertureDate ? ouvertureDate.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' }) : '—';
          inscBlock = `<p class="text-muted text-sm" style="margin-top:0.5rem;">🔓 Inscriptions ouvrent le <strong>${dtOuv}</strong></p>`;
        }

        return `
          <div class="card" style="margin-bottom:0.75rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
              <div>
                <span style="font-weight:700;">${esc(jourLabel(m.dateMatch))} ${esc(formatDateInput(m.dateMatch))}</span>
                <span class="text-muted text-sm" style="margin-left:0.5rem;">à ${esc(m.heureMatch || '?')} · max ${m.maxJoueurs || 10}</span>
                ${divLabels ? `<div style="margin-top:0.3rem;">${divLabels}</div>` : ''}
              </div>
              <span class="badge ${badgeColor}">${badgeLabel}</span>
            </div>
            ${overflowBlock}
            ${inscBlock}
          </div>`;
      }));
      creneauxSection = `
        <div class="view-section">
          <p class="section-title">Créneaux en cours</p>
          ${items.join('')}
        </div>`;
    }

    // === Créer un créneau manuel ===
    const creneauSection = `
      <div class="view-section">
        <p class="section-title">Créer un créneau</p>
        <div class="card">
          <p class="text-sm text-muted" style="margin-bottom:1rem;">⚽ Match</p>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Date du match</label>
              <input id="cren-date" type="date" class="form-input" value="${_todayPlus(7)}">
            </div>
            <div class="form-group">
              <label class="form-label">Heure du match</label>
              <select id="cren-heure-match" class="form-input">${_timeOptions('18:00')}</select>
            </div>
          </div>
          <p class="text-sm text-muted" style="margin-bottom:1rem;margin-top:0.75rem;">🔓 Ouverture des inscriptions</p>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Jour d'ouverture</label>
              <input id="cren-date-ouverture" type="date" class="form-input" value="${_todayPlus(3)}">
            </div>
            <div class="form-group">
              <label class="form-label">Heure d'ouverture</label>
              <select id="cren-heure-ouverture" class="form-input">${_timeOptions('09:00')}</select>
            </div>
          </div>
          <p id="cren-ouverture-preview" class="text-sm text-muted" style="margin-bottom:1rem;"></p>
          <div class="form-group">
            <label class="form-label">Joueurs max</label>
            <input id="cren-max" type="number" class="form-input" min="4" max="22" value="${store.get('groupeActif')?.maxJoueursMatch || 10}">
          </div>
          ${_divisionsCheckboxesHtml(groupe, 'cren-div', true)}
          <div id="cren-msg"></div>
          <button class="btn btn-primary btn-full" id="btn-create-creneau">Créer le créneau</button>
        </div>
      </div>`;

    el.innerHTML = creneauxSection + creneauSection;

    // Boutons overflow (étendre à une division)
    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-extend-div');
      if (!btn) return;

      const matchId = btn.dataset.mid;
      const addDiv  = btn.dataset.addDiv;
      const match   = matchesAdmin.find(m => m.id === matchId);
      if (!match) return;

      btn.disabled = true;
      try {
        let newCibles;
        if (addDiv === 'all') {
          newCibles = null; // aucune restriction
        } else {
          const current = match.sousGroupesCibles || [];
          newCibles = [...new Set([...current, Number(addDiv)])].sort();
        }
        await ouvrirMatchADivisions(groupeId, matchId, newCibles);
        showToast('Inscriptions étendues !', 'success');
        store.invalidate('matchSemaine');
        await new Promise(r => setTimeout(r, 400));
        renderTabMatch(el, groupeId, uid);
      } catch(err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    });

    // Aperçu live de la date d'ouverture
    function _updateOuverturePreview() {
      const dateOuv  = el.querySelector('#cren-date-ouverture')?.value;
      const heureOuv = el.querySelector('#cren-heure-ouverture')?.value;
      const preview  = el.querySelector('#cren-ouverture-preview');
      if (!preview) return;
      if (dateOuv && heureOuv) {
        const d = new Date(`${dateOuv}T${heureOuv}`);
        const isPassee = d <= new Date();
        const label = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
        preview.textContent = isPassee
          ? `↳ Inscriptions ouvertes immédiatement (${label} à ${heureOuv})`
          : `↳ Inscriptions s'ouvriront le ${label} à ${heureOuv}`;
        preview.style.color = isPassee ? 'var(--green)' : 'var(--warning)';
      } else {
        preview.textContent = '';
      }
    }
    el.querySelector('#cren-date-ouverture')?.addEventListener('change', _updateOuverturePreview);
    el.querySelector('#cren-heure-ouverture')?.addEventListener('change', _updateOuverturePreview);
    _updateOuverturePreview();

    // Créer créneau
    el.querySelector('#btn-create-creneau')?.addEventListener('click', async (e) => {
      const btn            = e.target;
      const date           = el.querySelector('#cren-date').value;
      const heureMatch     = el.querySelector('#cren-heure-match').value;
      const dateOuverture  = el.querySelector('#cren-date-ouverture').value;
      const heureOuverture = el.querySelector('#cren-heure-ouverture').value;
      const max            = el.querySelector('#cren-max').value;
      const msgEl          = el.querySelector('#cren-msg');
      const sousGroupesCibles = _getSelectedDivisions(el, 'cren-div', groupe);

      if (!date) { if (msgEl) msgEl.innerHTML = '<div class="form-msg error">Choisis une date de match.</div>'; return; }
      if (!dateOuverture) { if (msgEl) msgEl.innerHTML = '<div class="form-msg error">Choisis un jour d\'ouverture des inscriptions.</div>'; return; }

      btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>';
      if (msgEl) msgEl.innerHTML = '';

      const dateOuvertureInscription = `${dateOuverture}T${heureOuverture}:00`;

      try {
        await creerCreneauManuel(groupeId, {
          dateMatch: date,
          heureMatch,
          heureOuverture,
          dateOuvertureInscription,
          maxJoueurs: max,
          displayName: store.get('profil')?.displayName,
          sousGroupesCibles,
        });
        showToast('Créneau créé !', 'success');
        store.invalidate('matchSemaine');
        await new Promise(r => setTimeout(r, 800));
        renderTabMatch(el, groupeId, uid);
      } catch(err) {
        console.error('[admin] ❌ Erreur création créneau :', err.code, err.message, err);
        if (msgEl) msgEl.innerHTML = `<div class="form-msg error">Erreur (${err.code || 'inconnu'}) : ${esc(err.message)}</div>`;
        btn.disabled = false; btn.textContent = 'Créer le créneau';
      }
    });

    // Toggle soirée : afficher/cacher les sections
    el.addEventListener('change', (e) => {
      const toggle = e.target.closest('[id^="toggle-soiree-"]');
      if (!toggle) return;
      const matchId = toggle.id.replace('toggle-soiree-', '');
      const isSoiree = toggle.checked;
      const simpleEl = el.querySelector(`#match-simple-${matchId}`);
      const soireeEl = el.querySelector(`#match-soiree-${matchId}`);
      const btnVal   = el.querySelector(`.btn-valider-match[data-mid="${matchId}"]`);
      if (simpleEl) simpleEl.style.display = isSoiree ? 'none' : '';
      if (soireeEl) soireeEl.style.display = isSoiree ? '' : 'none';
      if (btnVal)   btnVal.dataset.soiree   = isSoiree ? 'true' : 'false';
      if (btnVal)   btnVal.textContent = isSoiree ? '✅ Valider la soirée' : '✅ Valider ce match';
    });

    // Valider match (délégation d'événement)
    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-valider-match');
      if (!btn) return;

      const matchId  = btn.dataset.mid;
      const isSoiree = btn.dataset.soiree === 'true';
      const match    = matchesAdmin.find(m => m.id === matchId);
      if (!match) return;

      const msgEl = el.querySelector(`#val-msg-${matchId}`);
      if (msgEl) msgEl.innerHTML = '';

      const toJoueurs = ids => ids.map(id => ({ id, rating: joueurMap[id]?.rating || 1000, matchsJoues: joueurMap[id]?.matchsJoues || 0 }));

      if (isSoiree) {
        // === Mode soirée ===
        const splitVal = (el.querySelector(`#split-${matchId}`)?.value || '0.5,0.5').split(',').map(Number);

        const sousMatchs = [1, 2].map(n => {
          const sA  = parseInt(el.querySelector(`#score-a-sm${n}-${matchId}`)?.value) || 0;
          const sB  = parseInt(el.querySelector(`#score-b-sm${n}-${matchId}`)?.value) || 0;
          const idsA = [...el.querySelectorAll(`.eq-a-sm${n}-cb-${matchId}:checked`)].map(cb => cb.value);
          const idsB = [...el.querySelectorAll(`.eq-b-sm${n}-cb-${matchId}:checked`)].map(cb => cb.value);
          return { equipeA: toJoueurs(idsA), equipeB: toJoueurs(idsB), scoreA: sA, scoreB: sB };
        });

        for (let i = 0; i < sousMatchs.length; i++) {
          const sm = sousMatchs[i];
          if (sm.equipeA.length < 1 || sm.equipeB.length < 1) {
            if (msgEl) msgEl.innerHTML = `<div class="form-msg error">Sous-match ${i+1} : sélectionne au moins 1 joueur par équipe.</div>`;
            return;
          }
          const doublons = sm.equipeA.filter(j => sm.equipeB.some(k => k.id === j.id));
          if (doublons.length) {
            if (msgEl) msgEl.innerHTML = `<div class="form-msg error">Sous-match ${i+1} : un joueur ne peut pas être dans les deux équipes.</div>`;
            return;
          }
        }

        btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>';
        try {
          await validerMatch(groupeId, { matchSemaineId: matchId, sousMatchs, split: splitVal });
          showToast('Soirée validée ! Ratings mis à jour.', 'success');
          store.invalidate('joueurs', 'matchSemaine', 'historique', 'synergies');
          renderTabMatch(el, groupeId, uid);
        } catch(err) {
          if (msgEl) msgEl.innerHTML = `<div class="form-msg error">${esc(err.message)}</div>`;
          btn.disabled = false; btn.textContent = '✅ Valider la soirée';
        }

      } else {
        // === Mode simple ===
        const scoreA = parseInt(el.querySelector(`#score-a-${matchId}`)?.value) || 0;
        const scoreB = parseInt(el.querySelector(`#score-b-${matchId}`)?.value) || 0;
        const idsA   = [...el.querySelectorAll(`.eq-a-cb-${matchId}:checked`)].map(cb => cb.value);
        const idsB   = [...el.querySelectorAll(`.eq-b-cb-${matchId}:checked`)].map(cb => cb.value);

        if (idsA.length < 1 || idsB.length < 1) {
          if (msgEl) msgEl.innerHTML = '<div class="form-msg error">Sélectionne au moins 1 joueur par équipe.</div>';
          return;
        }
        const doublons = idsA.filter(id => idsB.includes(id));
        if (doublons.length) {
          if (msgEl) msgEl.innerHTML = '<div class="form-msg error">Un joueur ne peut pas être dans les deux équipes.</div>';
          return;
        }

        btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>';
        try {
          const equipeA = toJoueurs(idsA);
          const equipeB = toJoueurs(idsB);
          await validerMatch(groupeId, { matchSemaineId: matchId, equipeA, equipeB, scoreA, scoreB });
          showToast('Match validé ! Ratings mis à jour.', 'success');
          store.invalidate('joueurs', 'matchSemaine', 'historique', 'synergies');
          renderTabMatch(el, groupeId, uid);
        } catch(err) {
          if (msgEl) msgEl.innerHTML = `<div class="form-msg error">${esc(err.message)}</div>`;
          btn.disabled = false; btn.textContent = '✅ Valider ce match';
        }
      }
    });

    // Annuler créneau
    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-annuler-creneau');
      if (!btn) return;
      const matchId = btn.dataset.mid;
      const match   = matchesAdmin.find(m => m.id === matchId);
      if (!match) return;

      const dateLabel = match.dateMatch
        ? new Date(match.dateMatch).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'ce créneau';

      const ok = await showConfirm(`Annuler le match du ${dateLabel} ?`, 'Les joueurs inscrits seront notifiés. Aucun ELO ne sera modifié.');
      if (!ok) return;

      btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>';
      try {
        await annulerCreneau(groupeId, matchId);
        showToast('Créneau annulé.', 'info');
        renderTabMatch(el, groupeId, uid);
      } catch(err) {
        showToast(err.message, 'error');
        btn.disabled = false; btn.textContent = '🗑 Annuler ce créneau';
      }
    });

  } catch(err) {
    el.innerHTML = `<p class="text-muted">Erreur de chargement.</p>`;
    console.error(err);
  }
}

// ── TAB HEBDO ─────────────────────────────────────────────────
async function renderTabHebdo(el, groupeId) {
  const groupe   = store.get('groupeActif') || {};
  const noms     = groupe.nomsSousGroupes || [];
  const configHebdos = groupe.configHebdos || {};
  const hebdos   = Object.entries(configHebdos)
    .map(([key, val]) => ({ id: key, ...val }))
    .sort((a,b) => JOURS_SEMAINE.indexOf(a.jour) - JOURS_SEMAINE.indexOf(b.jour));

  el.innerHTML = `
    <div class="view-section">
      <p class="section-title">Créneaux hebdomadaires</p>
      ${hebdos.length ? `<div id="hebdo-list">
        ${hebdos.map(h => `
          <div class="hebdo-card ${h.actif ? 'active' : 'inactive'}" data-hid="${esc(h.id)}">
            <div class="hebdo-info">
              <div class="hebdo-schedule">
                <span class="hebdo-chip hebdo-chip-day">${esc(h.jour)}</span>
                <span class="hebdo-chip hebdo-chip-time">${esc(h.heure || '18:00')}</span>
                <span class="hebdo-chip hebdo-chip-max">max ${h.maxJoueurs || h.maxJoueursMatch || 10}</span>
              </div>
              ${h.jourOuverture ? `<div class="text-xs text-muted" style="margin-top:4px;">🔓 ${esc(h.jourOuverture)} à ${esc(h.heureOuverture || '12:00')}</div>` : ''}
              ${h.sousGroupesCibles && h.sousGroupesCibles.length ? `<div style="margin-top:4px;">${_ciblesLabel(h.sousGroupesCibles, noms)}</div>` : ''}
            </div>
            <div class="hebdo-controls">
              <label class="toggle-label">
                <input type="checkbox" class="toggle-cb hebdo-toggle" data-hid="${esc(h.id)}" ${h.actif ? 'checked' : ''}>
                <div class="toggle-switch"></div>
              </label>
              <button class="btn-icon" data-action="del-hebdo" data-hid="${esc(h.id)}" title="Supprimer">🗑️</button>
            </div>
          </div>`).join('')}
      </div>` : '<p class="text-muted text-sm">Aucun créneau récurrent configuré.</p>'}
    </div>

    <!-- Ajouter un créneau récurrent -->
    <div class="view-section">
      <p class="section-title">Ajouter un créneau récurrent</p>
      <div class="card">
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">⚽ Jour du match</label>
            <select id="hebdo-jour" class="form-input">
              ${JOURS_SEMAINE.map(j => `<option${j==='Lundi'?' selected':''}>${j}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">⚽ Heure du match</label>
            <select id="hebdo-heure" class="form-input">
              ${_timeOptions('18:00')}
            </select>
          </div>
        </div>
        <p class="text-sm text-muted" style="margin:0.25rem 0 0.75rem;">🔓 Ouverture des inscriptions</p>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Jour d'ouverture</label>
            <select id="hebdo-jour-ouverture" class="form-input">
              ${JOURS_SEMAINE.map(j => `<option${j==='Vendredi'?' selected':''}>${j}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Heure d'ouverture</label>
            <select id="hebdo-heure-ouverture" class="form-input">
              ${_timeOptions('12:00')}
            </select>
          </div>
        </div>
        <p id="hebdo-ouverture-preview" class="text-sm text-muted" style="margin-bottom:1rem;"></p>
        <div class="form-group">
          <label class="form-label">Max joueurs</label>
          <input id="hebdo-max" type="number" class="form-input" min="4" max="22" value="${groupe.maxJoueursMatch || 10}">
        </div>
        ${_divisionsCheckboxesHtml(groupe, 'hebdo-div', true)}
        <div id="hebdo-msg"></div>
        <button class="btn btn-primary btn-full" id="btn-add-hebdo">Ajouter</button>
      </div>
    </div>`;

  // Toggle actif
  el.querySelectorAll('.hebdo-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      try {
        await toggleHebdoConfig(groupeId, cb.dataset.hid, cb.checked);
        showToast(cb.checked ? 'Créneau activé.' : 'Créneau désactivé.', 'info');
        store.invalidate('groupeActif');
        const g = await import('../db.js').then(m => m.getGroupe(groupeId));
        store.set('groupeActif', g);
        renderTabHebdo(el, groupeId);
      } catch(err) { showToast(err.message, 'error'); }
    });
  });

  // Supprimer hebdo
  el.querySelectorAll('[data-action="del-hebdo"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm({ title: 'Supprimer ce créneau ?', message: 'Les prochains créneaux générés par cette configuration ne seront plus créés.', confirmLabel: 'Supprimer', danger: true });
      if (!ok) return;
      try {
        await deleteHebdoConfig(groupeId, btn.dataset.hid);
        showToast('Créneau supprimé.', 'info');
        store.invalidate('groupeActif');
        const g = await import('../db.js').then(m => m.getGroupe(groupeId));
        store.set('groupeActif', g);
        renderTabHebdo(el, groupeId);
      } catch(err) { showToast(err.message, 'error'); }
    });
  });

  // Preview live ouverture hebdo
  function _updateHebdoPreview() {
    const jour         = el.querySelector('#hebdo-jour')?.value;
    const jourOuv      = el.querySelector('#hebdo-jour-ouverture')?.value;
    const heureOuv     = el.querySelector('#hebdo-heure-ouverture')?.value;
    const preview      = el.querySelector('#hebdo-ouverture-preview');
    if (!preview) return;
    if (jour && jourOuv && heureOuv) {
      preview.textContent = `Inscriptions ouvrent le ${jourOuv} à ${heureOuv} · match le ${jour}`;
    }
  }
  el.querySelector('#hebdo-jour')?.addEventListener('change', _updateHebdoPreview);
  el.querySelector('#hebdo-jour-ouverture')?.addEventListener('change', _updateHebdoPreview);
  el.querySelector('#hebdo-heure-ouverture')?.addEventListener('change', _updateHebdoPreview);
  _updateHebdoPreview();

  // Ajouter hebdo
  el.querySelector('#btn-add-hebdo')?.addEventListener('click', async (e) => {
    const btn               = e.target;
    const jour              = el.querySelector('#hebdo-jour').value;
    const heure             = el.querySelector('#hebdo-heure').value;
    const jourOuverture     = el.querySelector('#hebdo-jour-ouverture').value;
    const heureOuverture    = el.querySelector('#hebdo-heure-ouverture').value;
    const max               = el.querySelector('#hebdo-max').value;
    const msgEl             = el.querySelector('#hebdo-msg');
    const sousGroupesCibles = _getSelectedDivisions(el, 'hebdo-div', groupe);

    btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>';
    if (msgEl) msgEl.innerHTML = '';

    try {
      await addHebdoConfig(groupeId, { jour, heure, jourOuverture, heureOuverture, maxJoueurs: Number(max), sousGroupesCibles });
      showToast('Créneau récurrent ajouté !', 'success');
      store.invalidate('groupeActif');
      const g = await import('../db.js').then(m => m.getGroupe(groupeId));
      store.set('groupeActif', g);
      renderTabHebdo(el, groupeId);
    } catch(err) {
      if (msgEl) msgEl.innerHTML = `<div class="form-msg error">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Ajouter';
    }
  });
}

// ── TAB SETTINGS ──────────────────────────────────────────────
async function renderTabSettings(el, groupeId) {
  const groupe = store.get('groupeActif') || {};

  el.innerHTML = `
    <div class="view-section">
      <p class="section-title">Paramètres du groupe</p>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Nom du groupe</label>
          <input id="set-nom" class="form-input" type="text" value="${esc(groupe.nom || '')}" maxlength="40">
        </div>
        <div class="form-group">
          <label class="form-label">Joueurs max par match</label>
          <input id="set-max" class="form-input" type="number" min="4" max="22" value="${groupe.maxJoueursMatch || 10}">
        </div>
        <div class="form-group">
          <label class="form-label">Code d'invitation</label>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <div class="code-display">${esc(groupe.code || '------')}</div>
            <button class="btn-copy-code" id="btn-copy-code" title="Copier">📋</button>
          </div>
        </div>
        <div id="set-msg"></div>
        <button class="btn btn-primary btn-full" id="btn-save-settings">Enregistrer</button>
      </div>
    </div>`;

  el.querySelector('#btn-copy-code')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(groupe.code || '').then(() => showToast('Code copié !', 'success'));
  });

  el.querySelector('#btn-save-settings')?.addEventListener('click', async (e) => {
    const btn   = e.target;
    const nom   = el.querySelector('#set-nom').value.trim();
    const max   = el.querySelector('#set-max').value;
    const msgEl = el.querySelector('#set-msg');

    if (!nom) { if (msgEl) msgEl.innerHTML = '<div class="form-msg error">Le nom est requis.</div>'; return; }

    btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>';
    if (msgEl) msgEl.innerHTML = '';

    try {
      await updateGroupeSettings(groupeId, { nom, maxJoueursMatch: max });
      store.set('groupeActif', { ...groupe, nom, maxJoueursMatch: Number(max) });
      document.getElementById('current-group-name').textContent = nom;
      showToast('Paramètres sauvegardés !', 'success');
      btn.disabled = false; btn.textContent = 'Enregistrer';
      if (msgEl) msgEl.innerHTML = '<div class="form-msg success">Sauvegardé ✓</div>';
    } catch(err) {
      if (msgEl) msgEl.innerHTML = `<div class="form-msg error">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Génère les options d'un select heure par tranche de 15 min (06:00 → 23:45) */
function _timeOptions(defaultVal = '18:00') {
  const opts = [];
  for (let h = 6; h <= 23; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh  = String(h).padStart(2, '0');
      const mm  = String(m).padStart(2, '0');
      const val = `${hh}:${mm}`;
      opts.push(`<option value="${val}" ${val === defaultVal ? 'selected' : ''}>${val}</option>`);
    }
  }
  return opts.join('');
}

// ── Render principal ──────────────────────────────────────────
export async function render(container) {
  const groupeId = store.get('groupeActifId');
  const groupe   = store.get('groupeActif');
  const uid      = store.get('firebaseUser')?.uid;
  const isAdmin  = store.get('isAdmin');
  const isSA     = store.get('isSuperAdmin');

  if (!groupeId || !groupe || (!isAdmin && !isSA)) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h3>Accès restreint</h3>
        <p>Seul l'admin du groupe peut accéder à cette page.</p>
        <a href="#/" class="btn btn-primary mt-md">Retour</a>
      </div>`;
    return;
  }

  let activeTab = 'membres';

  container.innerHTML = `
    <h1 class="page-title">⚙️ Admin</h1>
    <p class="page-sub">${esc(groupe.nom)}</p>
    <div class="sub-tabs" id="admin-tabs">
      ${TABS.map(t => `<button class="sub-tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="admin-tab-content"></div>`;

  const contentEl = container.querySelector('#admin-tab-content');

  async function loadTab(tab) {
    contentEl.innerHTML = skeletonCards(3);
    activeTab = tab;
    container.querySelectorAll('.sub-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    switch (tab) {
      case 'membres':  await renderTabMembres(contentEl, groupeId, uid); break;
      case 'match':    await renderTabMatch(contentEl, groupeId, uid); break;
      case 'hebdo':    await renderTabHebdo(contentEl, groupeId); break;
      case 'settings': await renderTabSettings(contentEl, groupeId); break;
    }
  }

  container.querySelector('#admin-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.sub-tab');
    if (tab) loadTab(tab.dataset.tab);
  });

  loadTab('membres');
}
