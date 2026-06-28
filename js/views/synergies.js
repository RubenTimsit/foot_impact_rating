// ============================================================
// VUE SYNERGIES — Synergies de paires + Historique des matchs
// ============================================================

import { store } from '../store.js';
import { getSynergies, getHistorique, getJoueurs, getMonVote, soumettreVote } from '../db.js';
import { esc, formatDate, formatDateInput, jourLabel, deltaBadge, avatarHtml, skeletonCards, showToast } from '../utils.js';

// ── Synergies ─────────────────────────────────────────────────
function renderSynergies(synergies, joueurs, uid) {
  if (!synergies.length) {
    return `<div class="empty-state">
      <div class="empty-icon">🤝</div>
      <h3>Pas encore de données</h3>
      <p>Les synergies apparaissent après au moins 2 matchs en commun.</p>
    </div>`;
  }

  const joueurMap = {};
  joueurs.forEach(j => { joueurMap[j.id] = j; });

  // Chercher les meilleures synergies de l'user connecté
  const mesSyn = synergies
    .filter(s => s.joueur1 === uid || s.joueur2 === uid)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const topPositif = synergies.filter(s => (s.score || 0) > 0).sort((a,b) => b.score - a.score).slice(0, 6);
  const topNegatif = synergies.filter(s => (s.score || 0) < 0).sort((a,b) => a.score - b.score).slice(0, 6);

  function synCard(s) {
    const j1 = joueurMap[s.joueur1];
    const j2 = joueurMap[s.joueur2];
    if (!j1 || !j2) return '';
    const isPos = (s.score || 0) >= 0;
    const nom1  = j1.displayName;
    const nom2  = j2.displayName;
    const isMe  = s.joueur1 === uid || s.joueur2 === uid;

    return `
      <div class="syn-card ${isPos ? 'syn-pos' : 'syn-neg'} ${isMe ? 'card-green' : ''}">
        <div class="syn-pair">${esc(nom1)} & ${esc(nom2)}</div>
        <div class="syn-score">${isPos ? '+' : ''}${Math.round(s.score || 0)}</div>
        <div class="syn-stats">${s.matchsEnsemble || 0} matchs · ${s.victoiresEnsemble || 0}V ${s.defaitesEnsemble || 0}D</div>
      </div>`;
  }

  return `
    ${mesSyn.length ? `
    <div class="view-section">
      <p class="section-title">Mes synergies</p>
      <div class="syn-grid">${mesSyn.map(synCard).join('')}</div>
    </div>` : ''}

    ${topPositif.length ? `
    <div class="view-section">
      <p class="section-title">💚 Meilleures duos</p>
      <div class="syn-grid">${topPositif.map(synCard).join('')}</div>
    </div>` : ''}

    ${topNegatif.length ? `
    <div class="view-section">
      <p class="section-title">💔 Duos difficiles</p>
      <div class="syn-grid">${topNegatif.map(synCard).join('')}</div>
    </div>` : ''}`;
}

// ── Helpers vote ──────────────────────────────────────────────
function _countdown(dateVoteFermeture) {
  if (!dateVoteFermeture) return '';
  const end  = dateVoteFermeture.toDate ? dateVoteFermeture.toDate() : new Date(dateVoteFermeture.seconds * 1000 || dateVoteFermeture);
  const diff = end - Date.now();
  if (diff <= 0) return 'Ferme bientôt';
  const h = Math.floor(diff / 3600000);
  const mn = Math.floor((diff % 3600000) / 60000);
  if (h >= 1) return `${h}h ${mn}min`;
  if (mn >= 1) return `${mn} min`;
  return '< 1 min';
}

// ── Historique ────────────────────────────────────────────────
function matchCard(m, joueurMap, uid, monVote = undefined) {
  const mid         = esc(m.id);
  const monDelta    = m.changements?.[uid]?.changement;
  const dateLbl     = m.dateCreation ? formatDate(m.dateCreation, { day: 'numeric', month: 'short' }) : '—';
  const medals      = ['🥇', '🥈', '🥉'];
  const topJoueurs  = m.topJoueurs || [];
  const allPart     = (m.equipeA || []).concat(m.equipeB || []);
  const estParticipant = allPart.includes(uid);
  const monNom      = joueurMap[uid]?.displayName;
  const isSoiree    = m.type === 'soiree' && Array.isArray(m.sousMatchs);

  // ── Résultat global & classe de contour ────────────────────
  // Pour soirée : résultat synthétique déjà calculé (tient compte des poids)
  // 50/50 win+loss → 'nul' = orange
  let resultatGlobal = null;   // 'victoire' | 'nul' | 'defaite' | null
  if (estParticipant) {
    if (isSoiree) {
      resultatGlobal = m.changements?.[uid]?.resultat || null;
    } else {
      const sA = m.scoreA ?? m.scoreEquipeA ?? 0;
      const sB = m.scoreB ?? m.scoreEquipeB ?? 0;
      const inA = (m.equipeA || []).includes(uid);
      const inB = (m.equipeB || []).includes(uid);
      if (inA || inB) {
        const gagne = (inA && sA > sB) || (inB && sB > sA);
        resultatGlobal = sA === sB ? 'nul' : gagne ? 'victoire' : 'defaite';
      }
    }
  }
  const resultClass = resultatGlobal === 'victoire' ? 'card-result-win'
                    : resultatGlobal === 'defaite'  ? 'card-result-loss'
                    : resultatGlobal === 'nul'      ? 'card-result-draw'
                    : '';
  const resultBadge = resultatGlobal === 'victoire' ? '<span class="badge badge-green">Victoire</span>'
                    : resultatGlobal === 'defaite'  ? '<span class="badge badge-red">Défaite</span>'
                    : resultatGlobal === 'nul'      ? '<span class="badge badge-muted">Nul</span>'
                    : '';

  // ── Helper : colorie le score d'un duel selon le camp du joueur ──
  // inMon = true si le joueur est dans l'équipe dont le score est 'mon'
  function scoreSpan(val, isMon, monScore, oppScore) {
    if (!isMon) return `<span style="color:var(--muted);">${val}</span>`;
    const col = monScore > oppScore ? 'var(--green)' : monScore < oppScore ? 'var(--danger)' : 'var(--muted)';
    return `<span style="color:${col};font-weight:900;">${val}</span>`;
  }

  // ── Score preview ──────────────────────────────────────────
  let scorePreviewHtml = '';

  const deltaBadgeHtml  = monDelta !== undefined ? deltaBadge(monDelta) : '';
  const resultBadgeHtml = resultBadge;

  if (isSoiree) {
    const scoresHtml = m.sousMatchs.map((sm) => {
      const sA   = sm.scoreA ?? 0;
      const sB   = sm.scoreB ?? 0;
      const inA  = (sm.equipeA || []).includes(uid);
      const inB  = (sm.equipeB || []).includes(uid);
      const spanA = scoreSpan(sA, inA, sA, sB);
      const spanB = scoreSpan(sB, inB, sB, sA);
      return `${spanA}<span class="mhs-sep">–</span>${spanB}`;
    }).join('<span class="mhs-dot"> · </span>');
    scorePreviewHtml = `
      <div class="mhs-center-block">
        <div class="mhs-score">${scoresHtml}</div>
        <div class="mhs-type-badge">Soirée</div>
        ${resultBadgeHtml || deltaBadgeHtml ? `<div class="mhs-result-row">${resultBadgeHtml}${deltaBadgeHtml}</div>` : ''}
      </div>`;
  } else {
    const scoreA = m.scoreA ?? m.scoreEquipeA ?? 0;
    const scoreB = m.scoreB ?? m.scoreEquipeB ?? 0;
    const isInA  = (m.equipeA || []).includes(uid);
    const isInB  = (m.equipeB || []).includes(uid);
    const spanA  = scoreSpan(scoreA, isInA, scoreA, scoreB);
    const spanB  = scoreSpan(scoreB, isInB, scoreB, scoreA);
    scorePreviewHtml = `
      <div class="mhs-center-block">
        <div class="mhs-score">${spanA}<span class="mhs-sep">–</span>${spanB}</div>
        ${resultBadgeHtml || deltaBadgeHtml ? `<div class="mhs-result-row">${resultBadgeHtml}${deltaBadgeHtml}</div>` : ''}
      </div>`;
  }

  // ── MOM visible (hors du détail) ──────────────────────────
  let momVisibleHtml = '';
  if (m.voteClos && topJoueurs.length) {
    const podium = topJoueurs.slice(0, 3).map(t => {
      const nom  = joueurMap[t.uid]?.displayName || t.uid;
      const isMe = t.uid === uid;
      return `<span class="mhs-mom-item${isMe ? ' mhs-mom-me' : ''}">${medals[t.rang - 1]} ${esc(nom)}</span>`;
    }).join('');
    momVisibleHtml = `<div class="mhs-vote mhs-mom-zone">
      ${podium}
    </div>`;
  }

  // ── Vote zone (hors du détail, toujours visible) ───────────
  let voteZoneHtml = '';
  if (m.voteClos === false && allPart.length) {
    const countdown = _countdown(m.dateVoteFermeture);
    if (estParticipant && monVote) {
      const top1 = joueurMap[monVote.top1];
      const top2 = joueurMap[monVote.top2];
      const top3 = joueurMap[monVote.top3];
      const nbVotesDone = m.nbVotes || 0;
      voteZoneHtml = `<div class="mhs-vote mhs-vote-done">
        <span class="mhs-vote-check">✓ Voté ·</span>
        <span class="mhs-vote-podium">🥇 ${esc(top1?.displayName || '?')}</span>
        ${top2 ? `<span class="mhs-vote-podium">🥈 ${esc(top2.displayName)}</span>` : ''}
        ${top3 ? `<span class="mhs-vote-podium">🥉 ${esc(top3.displayName)}</span>` : ''}
        <span class="mhs-vote-countdown">⏱ ${countdown}</span>
        <span class="mhs-vote-count">${nbVotesDone}/${allPart.length}</span>
      </div>`;
    } else if (estParticipant) {
      const options = allPart
        .filter(id => id !== uid)
        .map(id => `<option value="${esc(id)}">${esc(joueurMap[id]?.displayName || id)}</option>`)
        .join('');
      const nbVotes = m.nbVotes || 0;
      voteZoneHtml = `<div class="mhs-vote">
        <div class="mhs-vote-row">
          <button class="btn btn-primary btn-vote-toggle btn-sm" data-mid="${mid}">🗳️ Voter MOM</button>
          <span class="mhs-vote-countdown">⏱ ${countdown}</span>
          <span class="mhs-vote-count">${nbVotes}/${allPart.length}</span>
        </div>
        <div class="vote-form-inline" data-mid="${mid}" style="display:none;padding-top:0.5rem;">
          <div class="vote-selects-grid">
            <div>
              <div class="vote-select-label">🥇 1er</div>
              <select class="form-input vote-top1"><option value="">—</option>${options}</select>
            </div>
            <div>
              <div class="vote-select-label">🥈 2ème</div>
              <select class="form-input vote-top2"><option value="">—</option>${options}</select>
            </div>
            <div>
              <div class="vote-select-label">🥉 3ème</div>
              <select class="form-input vote-top3"><option value="">—</option>${options}</select>
            </div>
          </div>
          <div class="vote-inline-msg" data-mid="${mid}"></div>
          <button class="btn btn-primary btn-full btn-soumettre-vote" data-mid="${mid}" style="margin-top:0.4rem;font-size:0.82rem;">Soumettre</button>
        </div>
      </div>`;
    } else {
      const nbVotesSpec = m.nbVotes || 0;
      voteZoneHtml = `<div class="mhs-vote mhs-vote-spectateur">
        <span>🗳️ Vote en cours</span>
        <span class="mhs-vote-countdown">⏱ ${countdown}</span>
        <span class="mhs-vote-count">${nbVotesSpec}/${allPart.length}</span>
      </div>`;
    }
  }

  // ── Détail (masqué par défaut) ─────────────────────────────
  let detailHtml = '';
  if (isSoiree) {
    detailHtml = m.sousMatchs.map((sm, i) => {
      const eqA = (sm.equipeA || []).map(id => joueurMap[id]?.displayName || id);
      const eqB = (sm.equipeB || []).map(id => joueurMap[id]?.displayName || id);
      const sA  = sm.scoreA ?? 0;
      const sB  = sm.scoreB ?? 0;
      return `<div class="mhd-submatch">
        <div class="mhd-submatch-header">
          <span class="mhd-submatch-label">Sous-match ${i + 1}</span>
          <span class="mhd-submatch-score">
            <span style="color:${sA >= sB ? 'var(--green)' : 'var(--muted)'};font-weight:700;">${sA}</span>
            <span style="color:var(--muted);margin:0 0.3rem;">–</span>
            <span style="color:${sB >= sA ? 'var(--green)' : 'var(--muted)'};font-weight:700;">${sB}</span>
          </span>
        </div>
        <div class="match-teams-grid">
          <div class="match-team-col">
            <div class="mt-label ${sA > sB ? 'mt-winner' : ''}">A${sA > sB ? ' 🏆' : ''}</div>
            ${eqA.map(n => `<div class="mt-player${n === monNom ? ' mt-me' : ''}">${esc(n)}</div>`).join('')}
          </div>
          <div class="match-team-col">
            <div class="mt-label ${sB > sA ? 'mt-winner' : ''}">B${sB > sA ? ' 🏆' : ''}</div>
            ${eqB.map(n => `<div class="mt-player${n === monNom ? ' mt-me' : ''}">${esc(n)}</div>`).join('')}
          </div>
        </div>
      </div>`;
    }).join('');
  } else {
    const scoreA = m.scoreA ?? m.scoreEquipeA ?? 0;
    const scoreB = m.scoreB ?? m.scoreEquipeB ?? 0;
    const equipeA = (m.equipeA || []).map(id => joueurMap[id]?.displayName || id);
    const equipeB = (m.equipeB || []).map(id => joueurMap[id]?.displayName || id);
    detailHtml = `<div class="match-teams-grid">
      <div class="match-team-col">
        <div class="mt-label ${scoreA > scoreB ? 'mt-winner' : ''}">Équipe A${scoreA > scoreB ? ' 🏆' : ''}</div>
        ${equipeA.map(n => `<div class="mt-player${n === monNom ? ' mt-me' : ''}">${esc(n)}</div>`).join('')}
      </div>
      <div class="match-team-col">
        <div class="mt-label ${scoreB > scoreA ? 'mt-winner' : ''}">Équipe B${scoreB > scoreA ? ' 🏆' : ''}</div>
        ${equipeB.map(n => `<div class="mt-player${n === monNom ? ' mt-me' : ''}">${esc(n)}</div>`).join('')}
      </div>
    </div>`;
  }


  return `
    <div class="match-hist-card ${resultClass}" data-mid="${mid}">
      <div class="mhs-summary btn-card-toggle" data-mid="${mid}">
        <div class="mhs-left">
          <div class="mhs-date">${dateLbl}</div>
        </div>
        <div class="mhs-center">
          ${scorePreviewHtml}
        </div>
        <div class="mhs-right">
          <span class="mhs-chevron">▾</span>
        </div>
      </div>
      ${momVisibleHtml}
      ${voteZoneHtml}
      <div class="match-hist-detail" style="display:none;">
        ${detailHtml}
      </div>
    </div>`;
}

function renderHistorique(matchs, joueurs, uid, votesMap = {}, hasMore = false) {
  if (!matchs.length) {
    return `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>Aucun match joué</h3>
      <p>L'historique apparaîtra ici après le premier match validé.</p>
    </div>`;
  }

  const joueurMap = {};
  joueurs.forEach(j => { joueurMap[j.id] = j; });

  const cards = matchs.map(m => matchCard(m, joueurMap, uid, votesMap[m.id])).join('');
  const loadMoreBtn = hasMore
    ? `<div style="padding:1rem 0 0.5rem;text-align:center;">
        <button id="btn-load-more" class="btn btn-ghost btn-full">
          Charger 20 de plus
        </button>
      </div>`
    : `<p class="text-muted text-sm" style="text-align:center;padding:1rem 0 0.5rem;">
        Tout l'historique est affiché (${matchs.length} match${matchs.length > 1 ? 's' : ''})
      </p>`;

  return cards + loadMoreBtn;
}

// ── Render principal ──────────────────────────────────────────
export async function render(container) {
  const groupeId = store.get('groupeActifId');
  const groupe   = store.get('groupeActif');
  const uid      = store.get('firebaseUser')?.uid;

  if (!groupeId || !groupe) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤝</div>
        <h3>Pas de groupe actif</h3>
        <a href="#/" class="btn btn-primary mt-md">Choisir un groupe</a>
      </div>`;
    return;
  }

  let activeTab = 'historique';

  container.innerHTML = `
    <h1 class="page-title">📋 Historique</h1>
    <p class="page-sub">${esc(groupe.nom)}</p>
    <div class="sub-tabs">
      <button class="sub-tab active" data-tab="historique">Historique</button>
      <button class="sub-tab" data-tab="synergies">Synergies</button>
    </div>
    <div id="tab-content">${skeletonCards(3)}</div>`;

  let _synergies   = store.get('synergies');
  let _joueurs     = store.get('joueurs');
  // Pagination historique (pas mis en cache store — toujours rechargé proprement)
  let _historique  = [];
  let _votesMap    = {};   // { matchId: monVote | null }
  let _lastHistDoc = null;
  let _hasMoreHist = false;
  let _loadingMore = false;

  async function _chargerVotes(matchs) {
    const map = {};
    await Promise.all(matchs
      .filter(m => m.voteClos === false && (m.equipeA || []).concat(m.equipeB || []).includes(uid))
      .map(async m => {
        try { map[m.id] = await getMonVote(groupeId, m.id, uid); }
        catch (_) { map[m.id] = null; }
      })
    );
    return map;
  }

  async function charger() {
    try {
      const [syn, histResult, joueurs] = await Promise.all([
        getSynergies(groupeId),
        getHistorique(groupeId, 20),
        getJoueurs(groupeId),
      ]);
      _synergies   = syn;
      _historique  = histResult.matchs;
      _lastHistDoc = histResult.lastDoc;
      _hasMoreHist = histResult.hasMore;
      _joueurs     = joueurs;
      _votesMap    = await _chargerVotes(_historique);
      store.set('synergies', syn);
      store.set('joueurs', joueurs);
      refresh();
    } catch (err) {
      container.querySelector('#tab-content').innerHTML =
        `<div class="empty-state"><p class="text-muted">Erreur de chargement.</p></div>`;
    }
  }

  async function chargerPlusHistorique() {
    if (_loadingMore || !_hasMoreHist) return;
    _loadingMore = true;
    const btn = container.querySelector('#btn-load-more');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>'; }

    try {
      const result   = await getHistorique(groupeId, 20, _lastHistDoc);
      _historique    = [..._historique, ...result.matchs];
      _lastHistDoc   = result.lastDoc;
      _hasMoreHist   = result.hasMore;
      const newVotes = await _chargerVotes(result.matchs);
      _votesMap      = { ..._votesMap, ...newVotes };
      refreshHistorique();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Charger 20 de plus'; }
    } finally {
      _loadingMore = false;
    }
  }

  function refreshHistorique() {
    const el = container.querySelector('#tab-content');
    if (!el) return;
    el.innerHTML = renderHistorique(_historique, _joueurs || [], uid, _votesMap, _hasMoreHist);
    el.querySelector('#btn-load-more')?.addEventListener('click', chargerPlusHistorique);
    _bindVoteButtons(el);
  }

  function _bindVoteButtons(el) {
    // Toggle ouverture/fermeture de la carte
    el.querySelectorAll('.btn-card-toggle').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, select, input')) return;
        const mid    = row.dataset.mid;
        const card   = el.querySelector(`.match-hist-card[data-mid="${mid}"]`);
        if (!card) return;
        const detail  = card.querySelector('.match-hist-detail');
        const chevron = card.querySelector('.mhs-chevron');
        const open    = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : 'block';
        if (chevron) chevron.textContent = open ? '▾' : '▴';
        card.classList.toggle('card-open', !open);
      });
    });

    // Toggle affichage du formulaire de vote
    el.querySelectorAll('.btn-vote-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid     = btn.dataset.mid;
        const form    = el.querySelector(`.vote-form-inline[data-mid="${mid}"]`);
        if (!form) return;
        const visible = form.style.display !== 'none';
        form.style.display = visible ? 'none' : 'block';
        btn.textContent = visible ? '🗳️ Voter MOM' : '✕ Annuler';
      });
    });

    // Soumettre le vote
    el.querySelectorAll('.btn-soumettre-vote').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mid   = btn.dataset.mid;
        const zone  = el.querySelector(`.vote-form-inline[data-mid="${mid}"]`);
        const msgEl = el.querySelector(`.vote-inline-msg[data-mid="${mid}"]`);
        if (!zone) return;

        const top1 = zone.querySelector('.vote-top1')?.value;
        const top2 = zone.querySelector('.vote-top2')?.value;
        const top3 = zone.querySelector('.vote-top3')?.value;

        if (!top1 || !top2 || !top3) {
          if (msgEl) msgEl.innerHTML = '<div class="form-msg error" style="font-size:0.78rem;">Choisis un top 1, 2 et 3.</div>';
          return;
        }
        if (new Set([top1, top2, top3]).size < 3) {
          if (msgEl) msgEl.innerHTML = '<div class="form-msg error" style="font-size:0.78rem;">Les 3 joueurs doivent être différents.</div>';
          return;
        }

        btn.disabled = true; btn.innerHTML = '<div class="btn-loader"></div>';
        if (msgEl) msgEl.innerHTML = '';

        try {
          await soumettreVote(groupeId, mid, uid, { top1, top2, top3 });
          showToast('Vote soumis ! Merci.', 'success');
          // Mise à jour optimiste immédiate → pas de flicker
          _votesMap[mid] = { top1, top2, top3 };
          refreshHistorique();
          // Sync en arrière-plan pour mettre à jour nbVotes
          _chargerVotes(_historique).then(v => { _votesMap = { ..._votesMap, ...v }; refreshHistorique(); });
        } catch (err) {
          if (msgEl) msgEl.innerHTML = `<div class="form-msg error" style="font-size:0.78rem;">${esc(err.message)}</div>`;
          btn.disabled = false; btn.textContent = 'Soumettre';
        }
      });
    });
  }

  function refresh() {
    const el = container.querySelector('#tab-content');
    if (!el) return;
    if (activeTab === 'synergies') {
      el.innerHTML = renderSynergies(_synergies || [], _joueurs || [], uid);
    } else {
      refreshHistorique();
    }
  }

  container.querySelector('.sub-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.sub-tab');
    if (!tab) return;
    container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    refresh();
  });

  charger();
}
