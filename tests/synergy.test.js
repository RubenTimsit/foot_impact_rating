'use strict';

/**
 * synergy.test.js — Tests du système de synergies
 *
 * Fonctions testées (copiées depuis js/synergy-system.js en CJS) :
 *  mettreAJourSynergie, mettreAJourSynergiesEquipe,
 *  obtenirSynergie, calculerSynergieEquipe, detecterTrios
 *
 * Scénarios couverts :
 *  ✅  Création d'une nouvelle synergie entre deux joueurs
 *  ✅  Clé canonique : {A,B} = {B,A} (ordre alphabétique trié)
 *  ✅  Victoire augmente la valeur + bonus différentiel
 *  ✅  Nul → valeur inchangée
 *  ✅  Défaite → valeur diminuée
 *  ✅  Accumulation sur plusieurs matchs
 *  ✅  mettreAJourSynergiesEquipe : toutes les paires d'une équipe
 *  ✅  obtenirSynergie : retourne 0 si aucune données
 *  ✅  calculerSynergieEquipe : moyenne des paires
 *  ✅  detecterTrios : détecte correctement les trios au-dessus du seuil
 *  ✅  detecterTrios : ne retourne rien si les synergies sont insuffisantes
 */

// ── Copie CJS des fonctions pures ─────────────────────────────────────────────

function mettreAJourSynergie(synergiesExistantes, joueurId1, joueurId2, resultat, scoreDiff = 0) {
  const cle = [joueurId1, joueurId2].sort().join('-');

  if (!synergiesExistantes[cle]) {
    synergiesExistantes[cle] = {
      joueur1: joueurId1, joueur2: joueurId2,
      valeur: 0, matchsEnsemble: 0, victoires: 0, nuls: 0, defaites: 0,
    };
  }

  const s = synergiesExistantes[cle];
  s.matchsEnsemble += 1;

  if (resultat === 'victoire') {
    s.victoires += 1;
    s.valeur += 1 + (scoreDiff / 20);
  } else if (resultat === 'nul') {
    s.nuls += 1;
  } else if (resultat === 'defaite') {
    s.defaites += 1;
    s.valeur -= 1;
  }

  s.valeur = Math.round(s.valeur * 10) / 10;
  return synergiesExistantes;
}

function mettreAJourSynergiesEquipe(synergiesExistantes, equipe, resultat, scoreDiff = 0) {
  for (let i = 0; i < equipe.length; i++) {
    for (let j = i + 1; j < equipe.length; j++) {
      mettreAJourSynergie(synergiesExistantes, equipe[i], equipe[j], resultat, scoreDiff);
    }
  }
  return synergiesExistantes;
}

function obtenirSynergie(synergies, joueurId1, joueurId2) {
  const cle = [joueurId1, joueurId2].sort().join('-');
  return synergies[cle] ? synergies[cle].valeur : 0;
}

function calculerSynergieEquipe(synergies, equipe) {
  let total = 0, count = 0;
  for (let i = 0; i < equipe.length; i++) {
    for (let j = i + 1; j < equipe.length; j++) {
      total += obtenirSynergie(synergies, equipe[i], equipe[j]);
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

function detecterTrios(synergies, joueurs, seuilMin = 3) {
  const trios = [];
  const ids = joueurs.map(j => j.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let k = j + 1; k < ids.length; k++) {
        const trio = [ids[i], ids[j], ids[k]];
        const synMoy = calculerSynergieEquipe(synergies, trio);
        if (synMoy >= seuilMin) {
          trios.push({ joueurs: trio, synMoyenne: synMoy });
        }
      }
    }
  }
  return trios.sort((a, b) => b.synMoyenne - a.synMoyenne);
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Création et clé canonique
// ─────────────────────────────────────────────────────────────────────────────

describe('mettreAJourSynergie — création et clé', () => {
  test('crée une nouvelle entrée si la paire n\'existe pas', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'alice', 'bob', 'victoire');
    expect(syn['alice-bob']).toBeDefined();
  });

  test('clé canonique : {A,B} et {B,A} donnent la même entrée', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'zoe', 'alice', 'victoire');
    // La clé triée doit être 'alice-zoe'
    expect(syn['alice-zoe']).toBeDefined();
    expect(Object.keys(syn)).toHaveLength(1);
  });

  test('victoire → matchsEnsemble +1, victoires +1, valeur > 0', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'a', 'b', 'victoire', 0);
    const s = syn['a-b'];
    expect(s.matchsEnsemble).toBe(1);
    expect(s.victoires).toBe(1);
    expect(s.valeur).toBeGreaterThan(0);
  });

  test('nul → matchsEnsemble +1, nuls +1, valeur reste 0', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'a', 'b', 'nul');
    const s = syn['a-b'];
    expect(s.matchsEnsemble).toBe(1);
    expect(s.nuls).toBe(1);
    expect(s.valeur).toBe(0);
  });

  test('défaite → matchsEnsemble +1, defaites +1, valeur < 0', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'a', 'b', 'defaite');
    const s = syn['a-b'];
    expect(s.matchsEnsemble).toBe(1);
    expect(s.defaites).toBe(1);
    expect(s.valeur).toBe(-1);
  });

  test('victoire large (diff élevé) → valeur plus grande qu\'une victoire courte', () => {
    const synCourte = {};
    const synLarge  = {};
    mettreAJourSynergie(synCourte, 'a', 'b', 'victoire', 0);
    mettreAJourSynergie(synLarge,  'a', 'b', 'victoire', 10);
    expect(synLarge['a-b'].valeur).toBeGreaterThan(synCourte['a-b'].valeur);
  });

  test('accumulation : 3 victoires → valeur ≈ 3', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'a', 'b', 'victoire', 0);
    mettreAJourSynergie(syn, 'a', 'b', 'victoire', 0);
    mettreAJourSynergie(syn, 'a', 'b', 'victoire', 0);
    expect(syn['a-b'].valeur).toBeCloseTo(3, 1);
    expect(syn['a-b'].matchsEnsemble).toBe(3);
  });

  test('2 victoires + 2 défaites → valeur ≈ 0', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'a', 'b', 'victoire');
    mettreAJourSynergie(syn, 'a', 'b', 'victoire');
    mettreAJourSynergie(syn, 'a', 'b', 'defaite');
    mettreAJourSynergie(syn, 'a', 'b', 'defaite');
    expect(syn['a-b'].valeur).toBeCloseTo(0, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — mettreAJourSynergiesEquipe
// ─────────────────────────────────────────────────────────────────────────────

describe('mettreAJourSynergiesEquipe', () => {
  test('équipe de 3 → 3 paires créées (C(3,2) = 3)', () => {
    const syn = {};
    mettreAJourSynergiesEquipe(syn, ['a', 'b', 'c'], 'victoire');
    expect(Object.keys(syn)).toHaveLength(3);
  });

  test('équipe de 5 → 10 paires (C(5,2) = 10)', () => {
    const syn = {};
    mettreAJourSynergiesEquipe(syn, ['a','b','c','d','e'], 'victoire');
    expect(Object.keys(syn)).toHaveLength(10);
  });

  test('équipe de 1 → aucune paire', () => {
    const syn = {};
    mettreAJourSynergiesEquipe(syn, ['a'], 'victoire');
    expect(Object.keys(syn)).toHaveLength(0);
  });

  test('chaque paire a bien matchsEnsemble = 1 après un appel', () => {
    const syn = {};
    mettreAJourSynergiesEquipe(syn, ['x', 'y', 'z'], 'nul');
    Object.values(syn).forEach(s => expect(s.matchsEnsemble).toBe(1));
  });

  test('appels successifs accumulent les matchs correctement', () => {
    const syn = {};
    mettreAJourSynergiesEquipe(syn, ['a','b'], 'victoire');
    mettreAJourSynergiesEquipe(syn, ['a','b'], 'defaite');
    expect(syn['a-b'].matchsEnsemble).toBe(2);
    expect(syn['a-b'].victoires).toBe(1);
    expect(syn['a-b'].defaites).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — obtenirSynergie
// ─────────────────────────────────────────────────────────────────────────────

describe('obtenirSynergie', () => {
  test('paire inconnue → retourne 0', () => {
    expect(obtenirSynergie({}, 'a', 'b')).toBe(0);
  });

  test('retourne la bonne valeur après une victoire', () => {
    const syn = {};
    mettreAJourSynergie(syn, 'alice', 'bob', 'victoire');
    expect(obtenirSynergie(syn, 'alice', 'bob')).toBeGreaterThan(0);
    expect(obtenirSynergie(syn, 'bob', 'alice')).toBeGreaterThan(0); // ordre inversé = même résultat
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — calculerSynergieEquipe
// ─────────────────────────────────────────────────────────────────────────────

describe('calculerSynergieEquipe', () => {
  test('équipe sans aucune synergie → score 0', () => {
    expect(calculerSynergieEquipe({}, ['a','b','c'])).toBe(0);
  });

  test('équipe de 1 → score 0', () => {
    expect(calculerSynergieEquipe({}, ['solo'])).toBe(0);
  });

  test('retourne la moyenne des valeurs de paires', () => {
    const syn = {};
    // a-b = 2, a-c = 4 → moyenne = 3
    syn['a-b'] = { valeur: 2 };
    syn['a-c'] = { valeur: 4 };
    syn['b-c'] = { valeur: 3 };
    const score = calculerSynergieEquipe(syn, ['a','b','c']);
    expect(score).toBeCloseTo(3, 5);
  });

  test('une équipe avec bonnes synergies > équipe avec mauvaises', () => {
    const syn = {};
    mettreAJourSynergiesEquipe(syn, ['a','b'], 'victoire');
    mettreAJourSynergiesEquipe(syn, ['a','b'], 'victoire');
    mettreAJourSynergiesEquipe(syn, ['c','d'], 'defaite');
    mettreAJourSynergiesEquipe(syn, ['c','d'], 'defaite');
    expect(calculerSynergieEquipe(syn, ['a','b']))
      .toBeGreaterThan(calculerSynergieEquipe(syn, ['c','d']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — detecterTrios
// ─────────────────────────────────────────────────────────────────────────────

describe('detecterTrios', () => {
  const joueurs = [
    { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' },
  ];

  test('aucune synergie → aucun trio détecté', () => {
    expect(detecterTrios({}, joueurs)).toHaveLength(0);
  });

  test('faibles synergies → aucun trio au-dessus du seuil', () => {
    const syn = {};
    mettreAJourSynergiesEquipe(syn, ['a','b','c'], 'victoire'); // valeur ~1 par paire
    // Seuil par défaut = 3, on est à ~1 → pas de trio
    expect(detecterTrios(syn, joueurs, 3)).toHaveLength(0);
  });

  test('bonnes synergies → trio détecté au-dessus du seuil', () => {
    const syn = {};
    // 5 victoires ensemble
    for (let i = 0; i < 5; i++) {
      mettreAJourSynergiesEquipe(syn, ['a','b','c'], 'victoire');
    }
    const trios = detecterTrios(syn, joueurs, 3);
    expect(trios.length).toBeGreaterThan(0);
    expect(trios[0].joueurs).toEqual(expect.arrayContaining(['a','b','c']));
  });

  test('les trios sont triés par synMoyenne décroissante', () => {
    const syn = {};
    // a-b-c : 5 victoires ensemble
    for (let i = 0; i < 5; i++) mettreAJourSynergiesEquipe(syn, ['a','b','c'], 'victoire');
    // a-b-d : 10 victoires ensemble (meilleure synergie)
    for (let i = 0; i < 10; i++) mettreAJourSynergiesEquipe(syn, ['a','b','d'], 'victoire');

    const trios = detecterTrios(syn, joueurs, 1);
    for (let i = 1; i < trios.length; i++) {
      expect(trios[i-1].synMoyenne).toBeGreaterThanOrEqual(trios[i].synMoyenne);
    }
  });
});
