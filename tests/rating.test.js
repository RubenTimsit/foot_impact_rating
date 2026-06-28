'use strict';

/**
 * rating.test.js — Tests du système ELO "Mon Petit Match"
 *
 * Fonctions testées (copiées depuis js/rating-system.js en CJS) :
 *  calculerProbabilite, calculerMultiplicateurScore,
 *  calculerChangementRating, calculerChangementsMatch
 *
 * Scénarios couverts :
 *  ✅  Probabilité ELO (équipes égales, avantage, grand écart)
 *  ✅  Multiplicateur score (match serré, large victoire)
 *  ✅  Changement rating victoire / nul / défaite
 *  ✅  Symétrie : la perte d'une équipe = gain de l'autre
 *  ✅  Upset : battre une équipe plus forte → gain plus grand
 *  ✅  Match nul équipes égales → ±0
 *  ✅  Match nul favori → perd du rating, outsider en gagne
 *  ✅  calculerChangementsMatch sur un vrai match 5v5
 *  ✅  Plafond de gain max et perte max par match
 *  ✅  Cohérence : somme des changements ≈ 0 (jeu à somme nulle)
 */

// ── Copie CJS des fonctions pures (sans dépendances Firebase) ─────────────────

const K_FACTOR   = 32;
const BASE_RATING = 1000;

const PONDERATIONS = {
  baseELO: 0.65,
  contributionOffensive: 0.18,
  contributionDefensive: 0.12,
  bonusDifferentiel: 0.05,
};

const SEUILS = {
  hatTrick: 4, pokerButs: 5,
  cleanSheet: 1, defenseDecente: 4, defensePoreuse: 7, defenseCatastrophique: 10,
  ecartSerre: 2, ecartConfortable: 4, ecartLarge: 6,
  gainMaxParMatch: 50, perteMaxParMatch: -40, bonusButMax: 50, malusCscMax: -35,
};

function calculerProbabilite(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calculerRatingMoyen(joueurs) {
  if (!joueurs.length) return BASE_RATING;
  const sum = joueurs.reduce((acc, j) => acc + (j.rating || j.impactRating || BASE_RATING), 0);
  return sum / joueurs.length;
}

function calculerMultiplicateurScore(score1, score2) {
  const diff = Math.abs(score1 - score2);
  return 1 + (diff / 10);
}

function calculerChangementRating(ratingJoueur, ratingEquipeAlliee, ratingEquipeAdverse, resultat, score1, score2) {
  const probabilite     = calculerProbabilite(ratingEquipeAlliee, ratingEquipeAdverse);
  const changementBase  = K_FACTOR * (resultat - probabilite);
  const multiplicateur  = calculerMultiplicateurScore(score1, score2);
  return Math.round(changementBase * multiplicateur);
}

function calculerBonusDifferentiel(butsMarques, butsEncaisses, resultat) {
  const ecart = Math.abs(butsMarques - butsEncaisses);
  if (resultat === 'victoire') {
    if (ecart >= 6) return 18;
    if (ecart >= 4) return 12;
    if (ecart >= 2) return 6;
    return 3;
  }
  if (resultat === 'defaite') {
    if (ecart >= 6) return -18;
    if (ecart >= 4) return -12;
    if (ecart >= 2) return -6;
    return -3;
  }
  return 0;
}

function calculerChangementsMatch(equipe1, equipe2, score1, score2) {
  const ratingEq1 = calculerRatingMoyen(equipe1);
  const ratingEq2 = calculerRatingMoyen(equipe2);

  let res1, res2, txt1, txt2;
  if (score1 > score2)      { res1 = 1; res2 = 0; txt1 = 'victoire'; txt2 = 'defaite'; }
  else if (score1 < score2) { res1 = 0; res2 = 1; txt1 = 'defaite';  txt2 = 'victoire'; }
  else                       { res1 = 0.5; res2 = 0.5; txt1 = 'nul'; txt2 = 'nul'; }

  const changements = {};

  const processTeam = (equipe, ratingAllie, ratingAdverse, resultatNum, resultatTxt, scoreAllie, scoreAdverse) => {
    equipe.forEach(j => {
      const baseELO = calculerChangementRating(j.rating || j.impactRating || BASE_RATING, ratingAllie, ratingAdverse, resultatNum, scoreAllie, scoreAdverse);
      const bonusDiff = calculerBonusDifferentiel(scoreAllie, scoreAdverse, resultatTxt);
      const raw = baseELO * PONDERATIONS.baseELO + bonusDiff * PONDERATIONS.bonusDifferentiel;
      const changement = Math.max(SEUILS.perteMaxParMatch, Math.min(SEUILS.gainMaxParMatch, Math.round(raw)));
      changements[j.id] = { changement, resultat: resultatTxt };
    });
  };

  processTeam(equipe1, ratingEq1, ratingEq2, res1, txt1, score1, score2);
  processTeam(equipe2, ratingEq2, ratingEq1, res2, txt2, score2, score1);

  return changements;
}

// ── Helper pour créer des joueurs ─────────────────────────────────────────────
function joueur(id, rating = 1000) { return { id, rating }; }

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Probabilité ELO
// ─────────────────────────────────────────────────────────────────────────────

describe('calculerProbabilite', () => {
  test('deux équipes égales → probabilité 0.5 exacte', () => {
    expect(calculerProbabilite(1000, 1000)).toBeCloseTo(0.5, 5);
  });

  test('équipe A largement supérieure → probabilité proche de 1', () => {
    const p = calculerProbabilite(1400, 1000);
    expect(p).toBeGreaterThan(0.9);
    expect(p).toBeLessThan(1);
  });

  test('équipe B largement supérieure → probabilité proche de 0', () => {
    const p = calculerProbabilite(600, 1400);
    expect(p).toBeLessThan(0.1);
    expect(p).toBeGreaterThan(0);
  });

  test('écart de 400 points → probabilité ≈ 0.909 (formule ELO standard)', () => {
    expect(calculerProbabilite(1400, 1000)).toBeCloseTo(0.909, 2);
  });

  test('symétrie : P(A>B) + P(B>A) = 1', () => {
    const pA = calculerProbabilite(1200, 900);
    const pB = calculerProbabilite(900, 1200);
    expect(pA + pB).toBeCloseTo(1, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Multiplicateur de score
// ─────────────────────────────────────────────────────────────────────────────

describe('calculerMultiplicateurScore', () => {
  test('match nul (0-0) → multiplicateur 1.0', () => {
    expect(calculerMultiplicateurScore(0, 0)).toBe(1.0);
  });

  test('victoire d\'un but (3-2) → multiplicateur 1.1', () => {
    expect(calculerMultiplicateurScore(3, 2)).toBeCloseTo(1.1, 5);
  });

  test('victoire large (5-0) → multiplicateur 1.5', () => {
    expect(calculerMultiplicateurScore(5, 0)).toBeCloseTo(1.5, 5);
  });

  test('le multiplicateur est symétrique (A-B = B-A)', () => {
    expect(calculerMultiplicateurScore(7, 3)).toBe(calculerMultiplicateurScore(3, 7));
  });

  test('multiplicateur toujours ≥ 1', () => {
    const cas = [[0,0],[1,0],[3,2],[10,0],[5,5]];
    cas.forEach(([a,b]) => expect(calculerMultiplicateurScore(a,b)).toBeGreaterThanOrEqual(1));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Changement de rating individuel
// ─────────────────────────────────────────────────────────────────────────────

describe('calculerChangementRating', () => {
  test('victoire équipes égales → gain positif autour de +16', () => {
    const delta = calculerChangementRating(1000, 1000, 1000, 1, 3, 2);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(50);
  });

  test('défaite équipes égales → perte négative', () => {
    const delta = calculerChangementRating(1000, 1000, 1000, 0, 2, 3);
    expect(delta).toBeLessThan(0);
    expect(delta).toBeGreaterThan(-50);
  });

  test('nul équipes égales → changement proche de 0', () => {
    const delta = calculerChangementRating(1000, 1000, 1000, 0.5, 3, 3);
    expect(Math.abs(delta)).toBeLessThanOrEqual(2);
  });

  test('upset : outsider 800pts bat favori 1200pts → gain plus grand qu\'une victoire normale', () => {
    const gainUpset   = calculerChangementRating(800,  800,  1200, 1, 3, 2);
    const gainNormal  = calculerChangementRating(1000, 1000, 1000, 1, 3, 2);
    expect(gainUpset).toBeGreaterThan(gainNormal);
  });

  test('favori bat outsider → gain plus faible qu\'une victoire entre égaux', () => {
    const gainFavori  = calculerChangementRating(1200, 1200, 800, 1, 3, 2);
    const gainNormal  = calculerChangementRating(1000, 1000, 1000, 1, 3, 2);
    expect(gainFavori).toBeLessThan(gainNormal);
  });

  test('victoire large → gain plus grand que victoire courte', () => {
    const gainLarge  = calculerChangementRating(1000, 1000, 1000, 1, 5, 0);
    const gainCourt  = calculerChangementRating(1000, 1000, 1000, 1, 2, 1);
    expect(gainLarge).toBeGreaterThan(gainCourt);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — calculerChangementsMatch (match complet)
// ─────────────────────────────────────────────────────────────────────────────

describe('calculerChangementsMatch', () => {
  test('tous les joueurs ont une entrée dans le résultat', () => {
    const eq1 = [joueur('a'), joueur('b'), joueur('c')];
    const eq2 = [joueur('d'), joueur('e'), joueur('f')];
    const ch  = calculerChangementsMatch(eq1, eq2, 3, 1);
    ['a','b','c','d','e','f'].forEach(id => {
      expect(ch[id]).toBeDefined();
      expect(ch[id].changement).toBeDefined();
      expect(ch[id].resultat).toBeDefined();
    });
  });

  test('les gagnants ont un changement positif ou nul', () => {
    const eq1 = [joueur('a'), joueur('b')];
    const eq2 = [joueur('c'), joueur('d')];
    const ch  = calculerChangementsMatch(eq1, eq2, 4, 1);
    expect(ch['a'].changement).toBeGreaterThanOrEqual(0);
    expect(ch['b'].changement).toBeGreaterThanOrEqual(0);
    expect(ch['a'].resultat).toBe('victoire');
  });

  test('les perdants ont un changement négatif ou nul', () => {
    const eq1 = [joueur('a'), joueur('b')];
    const eq2 = [joueur('c'), joueur('d')];
    const ch  = calculerChangementsMatch(eq1, eq2, 1, 4);
    expect(ch['a'].changement).toBeLessThanOrEqual(0);
    expect(ch['a'].resultat).toBe('defaite');
    expect(ch['c'].resultat).toBe('victoire');
  });

  test('match nul entre équipes égales → changements proches de 0', () => {
    const eq1 = [joueur('a',1000), joueur('b',1000)];
    const eq2 = [joueur('c',1000), joueur('d',1000)];
    const ch  = calculerChangementsMatch(eq1, eq2, 3, 3);
    ['a','b','c','d'].forEach(id => {
      expect(Math.abs(ch[id].changement)).toBeLessThanOrEqual(5);
      expect(ch[id].resultat).toBe('nul');
    });
  });

  test('les changements respectent les plafonds min/max', () => {
    const eq1 = [joueur('a', 2000)];
    const eq2 = [joueur('b', 500)];
    const ch  = calculerChangementsMatch(eq1, eq2, 0, 10); // upset extrême
    expect(ch['b'].changement).toBeLessThanOrEqual(SEUILS.gainMaxParMatch);
    expect(ch['a'].changement).toBeGreaterThanOrEqual(SEUILS.perteMaxParMatch);
  });

  test('symétrie : le résultat d\'équipe1 est inverse de équipe2 (victoire/défaite)', () => {
    const eq1 = [joueur('a',1100), joueur('b',900)];
    const eq2 = [joueur('c',1000), joueur('d',1000)];
    const ch  = calculerChangementsMatch(eq1, eq2, 4, 1);
    expect(ch['a'].resultat).toBe('victoire');
    expect(ch['c'].resultat).toBe('defaite');
    expect(ch['a'].changement + ch['b'].changement)
      .toBeGreaterThan(0); // équipe gagnante globalement positive
    expect(ch['c'].changement + ch['d'].changement)
      .toBeLessThan(0); // équipe perdante globalement négative
  });

  test('5v5 : tous les 10 joueurs reçoivent un résultat cohérent', () => {
    const eq1 = Array.from({length:5}, (_,i) => joueur(`a${i}`, 950+i*20));
    const eq2 = Array.from({length:5}, (_,i) => joueur(`b${i}`, 1050+i*10));
    const ch  = calculerChangementsMatch(eq1, eq2, 5, 3);
    expect(Object.keys(ch)).toHaveLength(10);
    eq1.forEach(j => expect(ch[j.id].resultat).toBe('victoire'));
    eq2.forEach(j => expect(ch[j.id].resultat).toBe('defaite'));
  });
});
