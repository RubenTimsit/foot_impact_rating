// ============================================================
// VUE MATCH — Créneaux ouverts + inscription
// ============================================================

import { store } from '../store.js';
import { getProchainMatchs, watchInscriptions,
         sInscrire, seDesinscrire, getMonSousGroupe } from '../db.js';
import { esc, formatDateInput, jourLabel, createCountdown, showToast, skeletonCards, avatarHtml } from '../utils.js';

// ── Countdown vers le match ───────────────────────────────────
function renderCountdown(dateStr, heure, mid) {
  if (!dateStr) return '';
  return `
    <div class="countdown" id="countdown-wrap-${mid}">
      <div class="countdown-label">Temps avant le match</div>
      <div class="countdown-digits">
        <div class="cd-block"><div class="cd-num" id="cd-j-${mid}">--</div><div class="cd-unit">Jours</div></div>
        <span class="cd-sep">:</span>
        <div class="cd-block"><div class="cd-num" id="cd-h-${mid}">--</div><div class="cd-unit">Heures</div></div>
        <span class="cd-sep">:</span>
        <div class="cd-block"><div class="cd-num" id="cd-m-${mid}">--</div><div class="cd-unit">Min</div></div>
        <span class="cd-sep">:</span>
        <div class="cd-block"><div class="cd-num" id="cd-s-${mid}">--</div><div class="cd-unit">Sec</div></div>
      </div>
    </div>`;
}

// ── Countdown vers l'ouverture des inscriptions ───────────────
function renderOpeningCountdown(dateOuverture, mid) {
  if (!dateOuverture) return '';
  const dt  = new Date(dateOuverture);
  const fmt = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hm  = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `
    <div class="countdown countdown-opening" id="countdown-opening-wrap-${mid}">
      <div class="countdown-label">Ouverture des inscriptions</div>
      <div class="countdown-opening-date">${fmt} à ${hm}</div>
      <div class="countdown-digits">
        <div class="cd-block"><div class="cd-num" id="cdo-j-${mid}">--</div><div class="cd-unit">Jours</div></div>
        <span class="cd-sep">:</span>
        <div class="cd-block"><div class="cd-num" id="cdo-h-${mid}">--</div><div class="cd-unit">Heures</div></div>
        <span class="cd-sep">:</span>
        <div class="cd-block"><div class="cd-num" id="cdo-m-${mid}">--</div><div class="cd-unit">Min</div></div>
        <span class="cd-sep">:</span>
        <div class="cd-block"><div class="cd-num" id="cdo-s-${mid}">--</div><div class="cd-unit">Sec</div></div>
      </div>
    </div>`;
}

// ── Inscriptions HTML ─────────────────────────────────────────
function renderInscriptions(inscriptions, monStatut, match, uid) {
  const { confirmes = [], attente = [] } = inscriptions;
  const mid = match.id;
  const max = match?.maxJoueurs || 10;
  const pct = Math.min(100, Math.round((confirmes.length / max) * 100));
  const isOuvertClient = match?.statut === 'ouvert' ||
    (match?.statut === 'programmé' && match?.dateOuvertureInscription &&
     new Date() >= new Date(match.dateOuvertureInscription));
  const isClos = !isOuvertClient;

  return `
    <div class="view-section">
      <div class="card-row" style="margin-bottom:0.75rem;">
        <p class="section-title" style="margin:0;">Joueurs inscrits (${confirmes.length}/${max})</p>
        ${!isClos && !monStatut ? `<button class="btn btn-primary btn-sm" id="btn-inscrire-${mid}">+ M'inscrire</button>` : ''}
        ${!isClos && monStatut  ? `<button class="btn btn-ghost btn-sm" id="btn-desinscrire-${mid}" style="color:var(--danger);">Se désinscrire</button>` : ''}
      </div>

      <div class="places-bar" style="margin-bottom:1rem;">
        <div class="places-track">
          <div class="places-fill" style="width:${pct}%"></div>
        </div>
        <span class="places-count">${confirmes.length}/${max}</span>
      </div>

      <div class="insc-list">
        ${confirmes.map((ins, i) => `
          <div class="insc-row ${ins.userId === uid ? 'row-me' : ''}">
            <span class="insc-num">${i + 1}</span>
            ${avatarHtml(null, ins.displayName, 'sm')}
            <span class="insc-name">${esc(ins.displayName)}${ins.userId === uid ? ' <span class="badge-you">moi</span>' : ''}</span>
            ${monStatut === 'confirmé' && ins.userId === uid ? '<span class="badge badge-green">✓ Confirmé</span>' : ''}
          </div>`).join('')}
        ${!confirmes.length ? '<p class="text-muted text-sm" style="padding:0.4rem 0.85rem;">Aucun inscrit pour l\'instant.</p>' : ''}
      </div>

      ${attente.length > 0 ? `
        <p class="section-title" style="margin-top:1rem;">Liste d'attente (${attente.length})</p>
        <div class="insc-list">
          ${attente.map((ins, i) => `
            <div class="insc-row insc-wait ${ins.userId === uid ? 'row-me' : ''}">
              <span class="insc-num">${i + 1}</span>
              ${avatarHtml(null, ins.displayName, 'sm')}
              <span class="insc-name">${esc(ins.displayName)}${ins.userId === uid ? ' <span class="badge-you">moi</span>' : ''}</span>
              ${monStatut === 'attente' && ins.userId === uid ? '<span class="badge badge-muted">En attente</span>' : ''}
            </div>`).join('')}
        </div>` : ''}

      ${isClos ? '<p class="text-muted text-sm" style="padding:0.5rem 0;">Les inscriptions sont fermées.</p>' : ''}
    </div>`;
}

// ── HTML d'un bloc créneau ────────────────────────────────────
function renderMatchBlock(match, index, total) {
  const mid         = match.id;
  const dateDisplay = formatDateInput(match.dateMatch);
  const jourDisplay = jourLabel(match.dateMatch);
  const heureMatch  = match.heureMatch || '18:00';

  const ouvertureDate      = match.dateOuvertureInscription ? new Date(match.dateOuvertureInscription) : null;
  const inscOuvrentBientot = match.statut === 'programmé' && ouvertureDate && ouvertureDate > new Date();
  const isOuvert           = match.statut === 'ouvert' ||
    (match.statut === 'programmé' && ouvertureDate && new Date() >= ouvertureDate);
  const isClos             = !isOuvert && !inscOuvrentBientot;

  const separateur = index > 0
    ? '<hr style="border:none;border-top:2px solid var(--border);margin:2rem 0;">'
    : '';

  return `
    ${separateur}
    <div class="match-banner">
      <div class="match-banner-label">${total > 1 ? `Créneau ${index + 1} sur ${total}` : 'Prochain match'}</div>
      <div class="match-banner-date">${esc(jourDisplay)} ${esc(dateDisplay)}</div>
      <div class="match-banner-meta">🕐 ${esc(heureMatch)} · max ${match.maxJoueurs || 10} joueurs</div>
      ${isClos            ? '<span class="badge badge-red"    style="margin-top:0.5rem;">Inscriptions fermées</span>'          : ''}
      ${inscOuvrentBientot ? '<span class="badge badge-yellow" style="margin-top:0.5rem;">Inscriptions bientôt ouvertes</span>' : ''}
    </div>

    ${inscOuvrentBientot ? renderOpeningCountdown(match.dateOuvertureInscription, mid) : ''}
    ${isOuvert           ? renderCountdown(match.dateMatch, heureMatch, mid)           : ''}

    <div id="inscriptions-zone-${mid}"></div>`;
}

// ── Render principal ──────────────────────────────────────────
export async function render(container) {
  const groupeId = store.get('groupeActifId');
  const groupe   = store.get('groupeActif');
  const uid      = store.get('firebaseUser')?.uid;
  const profil   = store.get('profil');

  if (!groupeId || !groupe) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Pas de groupe actif</h3>
        <a href="#/" class="btn btn-primary mt-md">Choisir un groupe</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <h1 class="page-title">⚽ Match</h1>
    <p class="page-sub">${esc(groupe.nom)}</p>
    <div id="match-content">${skeletonCards(2)}</div>`;

  let _unwatchers = [];
  let _countdowns = [];

  function _cleanup() {
    _unwatchers.forEach(u => u());
    _unwatchers = [];
    _countdowns.forEach(c => c.stop());
    _countdowns = [];
  }

  async function charger() {
    const contentEl = container.querySelector('#match-content');
    if (!contentEl) return;

    _cleanup();

    try {
      const nombreSousGroupes = groupe?.nombreSousGroupes || 1;
      let sousGroupe = undefined;
      if (nombreSousGroupes > 1) {
        const joueursCaches = store.get('joueurs') || [];
        const moi = joueursCaches.find(j => j.id === uid);
        sousGroupe = moi !== undefined ? (moi.sousGroupe ?? null) : await getMonSousGroupe(groupeId, uid);
      }

      const matches = await getProchainMatchs(groupeId, sousGroupe);
      store.set('matchSemaine', matches[0] || false);

      if (!matches.length) {
        const msg = sousGroupe === null
          ? 'Tu n\'es assigné à aucune division. Contacte l\'admin pour être assigné.'
          : 'L\'admin du groupe n\'a pas encore créé de créneau pour cette semaine.';
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <h3>Aucun match prévu</h3>
            <p>${msg}</p>
          </div>`;
        return;
      }

      contentEl.innerHTML = matches.map((m, i) => renderMatchBlock(m, i, matches.length)).join('');

      for (const match of matches) {
        _setupMatch(match);
      }

    } catch (err) {
      console.error('[match] Erreur :', err);
      const contentEl2 = container.querySelector('#match-content');
      if (contentEl2) contentEl2.innerHTML = `<div class="empty-state"><p class="text-muted">Erreur de chargement.</p></div>`;
    }
  }

  function _setupMatch(match) {
    const mid = match.id;

    // Watcher temps réel — la première callback remplit la zone
    const unwatch = watchInscriptions(groupeId, mid, (inscriptions) => {
      const inscZone = container.querySelector(`#inscriptions-zone-${mid}`);
      if (!inscZone) return;
      const curStatut = inscriptions.confirmes.some(i => i.userId === uid) ? 'confirmé'
        : inscriptions.attente.some(i => i.userId === uid) ? 'attente'
        : null;
      inscZone.innerHTML = renderInscriptions(inscriptions, curStatut, match, uid);
      _bindButtons(match);
    });
    _unwatchers.push(unwatch);

    // Countdowns
    const ouvertureDate      = match.dateOuvertureInscription ? new Date(match.dateOuvertureInscription) : null;
    const inscOuvrentBientot = match.statut === 'programmé' && ouvertureDate && ouvertureDate > new Date();
    const isOuvert           = match.statut === 'ouvert' ||
      (match.statut === 'programmé' && ouvertureDate && new Date() >= ouvertureDate);

    const set = (id, v) => { const el = container.querySelector(id); if (el) el.textContent = String(v).padStart(2, '0'); };

    if (inscOuvrentBientot && ouvertureDate && ouvertureDate.getTime() > Date.now()) {
      const cd = createCountdown(
        ouvertureDate.getTime(),
        ({ jours, heures, minutes, secondes }) => {
          set(`#cdo-j-${mid}`, jours); set(`#cdo-h-${mid}`, heures);
          set(`#cdo-m-${mid}`, minutes); set(`#cdo-s-${mid}`, secondes);
        },
        () => charger()
      );
      _countdowns.push(cd);

    } else if (isOuvert) {
      const [y, mo, d]        = (match.dateMatch || '').split('T')[0].split('-').map(Number);
      const [h = 18, min = 0] = (match.heureMatch || '18:00').split(':').map(Number);
      const targetMs          = new Date(y, mo - 1, d, h, min, 0).getTime();

      if (targetMs > Date.now()) {
        const cd = createCountdown(
          targetMs,
          ({ jours, heures, minutes, secondes }) => {
            set(`#cd-j-${mid}`, jours); set(`#cd-h-${mid}`, heures);
            set(`#cd-m-${mid}`, minutes); set(`#cd-s-${mid}`, secondes);
          },
          () => charger()
        );
        _countdowns.push(cd);
      } else {
        const wrap = container.querySelector(`#countdown-wrap-${mid}`);
        if (wrap) wrap.innerHTML = '<div class="badge badge-yellow" style="font-size:0.85rem;padding:0.4rem 0.85rem;">⚽ Match en cours</div>';
      }
    }
  }

  function _bindButtons(match) {
    const mid = match.id;

    container.querySelector(`#btn-inscrire-${mid}`)?.addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.innerHTML = '<div class="btn-loader"></div>';
      try {
        await sInscrire(groupeId, mid, uid, profil?.displayName || 'Joueur');
        showToast('Inscription enregistrée !', 'success');
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = "+ M'inscrire";
      }
    });

    container.querySelector(`#btn-desinscrire-${mid}`)?.addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      try {
        await seDesinscrire(groupeId, mid, uid);
        showToast('Désinscription effectuée.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  }

  charger();

  return {
    destroy() {
      _cleanup();
    }
  };
}
