// ============================================================
// VUE CLASSEMENT — Tableau des ratings du groupe actif
// ============================================================

import { store } from '../store.js';
import { getJoueurs } from '../db.js';
import { esc, formatRating, posBadge, avatarHtml, skeletonCards } from '../utils.js';

// ── Tri ───────────────────────────────────────────────────────
function sortJoueurs(joueurs, mode) {
  const j = [...joueurs];
  switch (mode) {
    case 'rating':  return j.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'matchs':  return j.sort((a, b) => (b.matchsJoues || 0) - (a.matchsJoues || 0));
    case 'victoires': return j.sort((a, b) => (b.victoires || 0) - (a.victoires || 0));
    case 'ratio': {
      const ratio = j => j.matchsJoues > 0 ? (j.victoires / j.matchsJoues) : 0;
      return j.sort((a, b) => ratio(b) - ratio(a));
    }
    default: return j.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
}

// ── Stat principale selon le mode de tri ──────────────────────
function mainStat(j, sortMode) {
  const ratio = j.matchsJoues > 0 ? Math.round((j.victoires / j.matchsJoues) * 100) : 0;
  switch (sortMode) {
    case 'rating':    return formatRating(j.rating);
    case 'victoires': return `${j.victoires || 0}V`;
    case 'ratio':     return `${ratio}%`;
    case 'matchs':    return `${j.matchsJoues || 0} matchs`;
    default:          return formatRating(j.rating);
  }
}

// ── Render leaderboard (remplace le tableau) ────────────────────
function renderLeaderboard(joueurs, uid, sortMode) {
  if (!joueurs.length) {
    return `<div class="empty-state">
      <div class="empty-icon">🏆</div>
      <h3>Aucun joueur</h3>
      <p>Le classement apparaîtra ici dès que des membres rejoignent le groupe.</p>
    </div>`;
  }

  const sorted = sortJoueurs(joueurs, sortMode);
  const isMe   = id => id === uid;

  const rows = sorted.map((j, idx) => {
    const rank        = idx + 1;
    const rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const potentiel   = j.matchsPotentiels || 0;
    const presence    = potentiel > 0 ? Math.round(((j.matchsJoues || 0) / potentiel) * 100) : 0;
    const t           = j.trophees || {};

    const chips = [
      `<span class="lb-chip">${j.victoires||0}V ${j.nuls||0}N ${j.defaites||0}D</span>`,
      `<span class="lb-chip">${presence}%</span>`,
      `<span class="lb-chip lb-chip-trophy"><span class="trophy-or">🥇${t.or||0}</span> <span class="trophy-argent">🥈${t.argent||0}</span> <span class="trophy-bronze">🥉${t.bronze||0}</span></span>`,
    ].join('');

    return `
      <div class="lb-row${isMe(j.id) ? ' row-me' : ''}">
        <div class="lb-left">
          <span class="lb-rank">${rankDisplay}</span>
          <div class="lb-info">
            <div class="lb-name">${esc(j.displayName)}</div>
            ${j.position ? `<div class="lb-pos">${posBadge(j.position, j.profilMilieu)}</div>` : ''}
          </div>
        </div>
        <div class="lb-right">
          <div class="lb-stat-main">${mainStat(j, sortMode)}</div>
          <div class="lb-chips">${chips}</div>
        </div>
      </div>`;
  }).join('');

  return `<div class="lb-container">${rows}</div>`;
}

// ── Render top 3 cards (podium) ────────────────────────────────
function renderPodium(joueurs, uid) {
  const top3 = sortJoueurs(joueurs, 'rating').slice(0, 3);
  if (!top3.length) return '';

  const colors = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];
  const emojis = ['🥇', '🥈', '🥉'];

  return `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.65rem;margin-bottom:1.5rem;">
      ${top3.map((j, i) => `
        <div class="card" style="text-align:center;padding:1rem 0.65rem;border-color:${colors[i]}20;min-width:0;overflow:hidden;">
          <div style="font-size:1.6rem;margin-bottom:0.4rem;">${emojis[i]}</div>
          ${avatarHtml(j.photoURL || null, j.displayName, 'sm')}
          <div style="font-size:0.8rem;font-weight:700;margin-top:0.35rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;">${esc(j.displayName)}</div>
          <div style="color:${colors[i]};font-size:0.95rem;font-weight:800;margin-top:0.2rem;">${formatRating(j.rating)}</div>
        </div>
      `).join('')}
    </div>`;
}

// ── Helpers divisions ─────────────────────────────────────────
function divLabel(idx, nomsSousGroupes) {
  return (nomsSousGroupes && nomsSousGroupes[idx - 1]) || `Division ${idx}`;
}

// ── Render principal ──────────────────────────────────────────
export async function render(container) {
  const groupeId = store.get('groupeActifId');
  const groupe   = store.get('groupeActif');
  const uid      = store.get('firebaseUser')?.uid;

  if (!groupeId || !groupe) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Pas de groupe actif</h3>
        <p>Rejoins ou crée un groupe depuis l'accueil.</p>
        <a href="#/" class="btn btn-primary mt-md">Accueil</a>
      </div>`;
    return;
  }

  const nombreSousGroupes = groupe.nombreSousGroupes || 1;
  const nomsSousGroupes   = groupe.nomsSousGroupes || [];
  let sortMode   = 'rating';
  let divFilter  = 0; // 0 = tous

  // Construire les onglets de division (si activées)
  const divTabsHtml = nombreSousGroupes > 1 ? `
    <div class="div-filter-tabs" id="div-tabs">
      <button class="div-filter-tab active" data-div="0">Tout</button>
      ${Array.from({ length: nombreSousGroupes }, (_, i) => `
        <button class="div-filter-tab div-badge-${i+1}" data-div="${i+1}">${esc(divLabel(i+1, nomsSousGroupes))}</button>
      `).join('')}
    </div>` : '';

  // Squelette
  container.innerHTML = `
    <div style="margin-bottom:1.25rem;">
      <h1 class="page-title">${esc(groupe.nom)}</h1>
      <p class="page-sub">Classement ELO</p>
    </div>
    ${divTabsHtml}
    <div class="sub-tabs" id="sort-tabs">
      <button class="sub-tab active" data-sort="rating">⭐ Rating</button>
      <button class="sub-tab" data-sort="victoires">🏆 Victoires</button>
      <button class="sub-tab" data-sort="ratio">📊 Win rate</button>
      <button class="sub-tab" data-sort="matchs">⚽ Matchs</button>
    </div>
    <div id="podium-zone"></div>
    <div id="table-zone">${skeletonCards(4)}</div>`;

  let joueurs = store.get('joueurs');

  async function charger() {
    try {
      joueurs = await getJoueurs(groupeId);
      store.set('joueurs', joueurs);
      refresh();
    } catch (err) {
      container.querySelector('#table-zone').innerHTML =
        `<div class="empty-state"><p class="text-muted">Erreur de chargement.</p></div>`;
    }
  }

  function _joueursFiltered() {
    if (!joueurs) return [];
    if (divFilter === 0 || nombreSousGroupes <= 1) return joueurs;
    return joueurs.filter(j => j.sousGroupe === divFilter);
  }

  function refresh() {
    const podiumEl = container.querySelector('#podium-zone');
    const tableEl  = container.querySelector('#table-zone');
    if (!podiumEl || !tableEl) return;
    const filtered = _joueursFiltered();
    podiumEl.innerHTML = renderPodium(filtered, uid);
    tableEl.innerHTML  = renderLeaderboard(filtered, uid, sortMode);
  }

  // Onglets de division
  if (nombreSousGroupes > 1) {
    container.querySelector('#div-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.div-filter-tab');
      if (!tab) return;
      container.querySelectorAll('.div-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      divFilter = parseInt(tab.dataset.div) || 0;
      refresh();
    });
  }

  // Onglets de tri
  container.querySelector('#sort-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.sub-tab');
    if (!tab) return;
    container.querySelectorAll('#sort-tabs .sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    sortMode = tab.dataset.sort;
    refresh();
  });

  // Charger si pas en cache
  if (joueurs) {
    refresh();
    charger(); // rafraîchir en arrière-plan
  } else {
    charger();
  }
}
