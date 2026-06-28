# 🏆 Nouveau système de classement — Guide joueurs

---

## Pourquoi on change ?

| Problème actuel | Exemple |
|----------------|---------|
| On peut **perdre des points** en perdant | Tu joues, tu perds → tu aurais mieux fait de rester chez toi |
| Un **nouveau** peut arriver et être direct dans le top | 1 match gagné + MOM → rank #2 devant les habitués |

---

## Comment ça marche — les 3 règles

**1. Tu ne perds jamais de points**
Perdre donne moins, mais tu avances toujours. Venir jouer est toujours rentable.

**2. Les victoires rapportent 3× plus que les défaites**
La performance reste le moteur principal du classement (75%).

**3. Le classement récompense aussi la régularité (25%)**
Quelqu'un qui vient toutes les semaines, même avec un winrate moyen, finira devant quelqu'un qui a joué 2 matchs.

---

## La logique ELO — gagner "mérité" rapporte plus

Le système tient compte du niveau des équipes :

- Battre une équipe **plus forte** → **gros gain**
- Battre une équipe **plus faible** → **gain modéré**
- Perdre contre une équipe **bien supérieure** → **perte minime**

### Les incentives sont symétriques

| Équipe | Objectif | Pourquoi |
|--------|----------|----------|
| ✅ Gagnants | Marquer le plus possible | Plus l'écart est grand, plus ils gagnent de points |
| ❌ Perdants | Encaisser le moins possible | Moins l'écart est grand, plus ils gardent de points |

> Personne n'a intérêt à "lâcher" le match — ni les gagnants qui veulent creuser l'écart, ni les perdants qui veulent le limiter.

| Score | Victoire | Défaite |
|-------|---------|---------|
| 1-0 / 0-1 | **+75** | **+27** *(match serré, tu t'es battu)* |
| 2-0 / 0-2 | **+85** | **+24** |
| 3-0 / 0-3 | **+96** | **+21** |
| 5-0 / 0-5 | **+117** | **+18** |
| 8-0 / 0-8 | **+149** | **+14** *(déroute, pénalisé)* |

---

## Le bonus Homme du Match — 3 joueurs sur 16 récompensés

Sur un match à 16 joueurs, **seulement 3** reçoivent un bonus. C'est rare, donc ça mérite d'être valorisé.

Le bonus s'applique sur le gain du match — victoire ou défaite :

| | Victoire 2-0 | Défaite 0-2 |
|-|-------------|------------|
| 🥇 Top 1 (+75%) | **+149** | **+42** |
| 🥈 Top 2 (+40%) | **+119** | **+34** |
| 🥉 Top 3 (+20%) | **+102** | **+29** |
| Joueur normal | +85 | +24 |

> Un MOM 🥇 dans l'équipe perdante repart avec +42 pts, contre +85 pour un joueur normal vainqueur. Il limite nettement la casse et se distingue clairement de ses coéquipiers (+24). Ça récompense la performance individuelle malgré la défaite collective.

---

## Simulations — évolution du score selon le profil

*Score moyen par match : 2-0. Équipes équilibrées.*

| Matchs joués | 100% WR | 70% WR | 50% WR | 30% WR | 0% WR |
|-------------|---------|--------|--------|--------|-------|
| 5 | 425 | 343 | 285 | 227 | 140 |
| 10 | 850 | 686 | 570 | 454 | 280 |
| 20 | 1 700 | 1 372 | 1 140 | 908 | 560 |
| 30 | 2 550 | 2 057 | 1 710 | 1 362 | 840 |
| 50 | 4 250 | 3 430 | 2 850 | 2 270 | 1 400 |

→ La différence entre 70% WR et 30% WR se creuse progressivement sans jamais écraser celui qui joue moins bien.

---

## Newcomer vs habitués

| Joueur | Contexte | Score |
|--------|---------|-------|
| Nouveau — 1 match gagné 2-0 + MOM 🥇 | Meilleur scénario possible | **170** |
| Habitué — 5 matchs, 70% WR | — | **343** |
| Habitué — 10 matchs, 50% WR | — | **570** |
| Présent toutes les semaines, 20 matchs, 30% WR | — | **908** |

**Le classement existant est migré** — personne ne repart de zéro, l'historique est converti dans le nouveau système.

---

## Classement réel simulé (3 soirées)

Ce tableau est le résultat concret du script de recalcul appliqué aux 3 derniers matchs enregistrés dans la base.

| # | Joueur | Score | Matchs | V | N | D | 🥇 | 🥈 | 🥉 |
|---|--------|------:|-------:|---|---|---|----|----|-----|
| 1 | **Avner** | **319** | 3 | 2 | 0 | 1 | 0 | 0 | 1 |
| 2 | Jordan haik | **315** | 2 | 2 | 0 | 0 | 0 | 1 | 0 |
| 3 | Sacha Giuili | **284** | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| 4 | Adamax | **225** | 2 | 2 | 0 | 0 | 1 | 0 | 0 |
| 5 | Noe Sroussi | **208** | 3 | 1 | 0 | 2 | 1 | 0 | 1 |
| 6 | Ruben Sayada (Ruben S) | **199** | 2 | 1 | 0 | 1 | — | | |
| 7 | **Benjamin S** | **194** | 3 | 2 | 0 | 1 | 0 | 0 | 1 |
| 8 | Isaac Leyne | **178** | 2 | 1 | 0 | 1 | — | | |
| 9 | Ilan Teboul | **166** | 2 | 2 | 0 | 0 | — | | |
| 10 | Sambo | **166** | 2 | 2 | 0 | 0 | — | | |
| 11 | greg benkha | **162** | 1 | 1 | 0 | 0 | — | | |
| 12 | ilan souffir | **162** | 1 | 1 | 0 | 0 | — | | |
| 13 | David K | **162** | 1 | 1 | 0 | 0 | — | | |
| 14 | Ruben Timsit | **157** | 2 | 1 | 0 | 1 | 0 | 2 | 0 |
| 15 | Liam | **125** | 2 | 1 | 0 | 1 | — | | |
| 16 | Elie Memmi | **101** | 3 | 1 | 0 | 2 | — | | |
| 17 | Benjamin Amsellem | **78** | 1 | 1 | 0 | 0 | — | | |
| 18 | jeremy Levy - NY | **78** | 1 | 1 | 0 | 0 | — | | |
| 19 | Koubz | **37** | 1 | 0 | 0 | 1 | — | | |
| 20 | Jeremie | **37** | 1 | 0 | 0 | 1 | — | | |
| 21 | Ariel | **37** | 1 | 0 | 0 | 1 | — | | |
| 22 | Ruben SOUSSI | **23** | 2 | 0 | 0 | 2 | — | | |
| 23 | Samuel | **23** | 2 | 0 | 0 | 2 | — | | |
| 24 | David Poignon-Cahen | **13** | 1 | 0 | 0 | 1 | — | | |
| 25 | David Elone Zana | **13** | 1 | 0 | 0 | 1 | — | | |
| 26 | Jeremy Levy | **13** | 1 | 0 | 0 | 1 | — | | |
| 27 | Joshua | **10** | 1 | 0 | 0 | 1 | — | | |
| 28 | Ilan Dahan | **10** | 1 | 0 | 0 | 1 | — | | |
| 29 | Ruben Chetrit | **10** | 1 | 0 | 0 | 1 | — | | |
| 30 | Dylan Sitruk | 0 | 0 | 0 | 0 | 0 | — | | |
| 31 | Charles | 0 | 0 | 0 | 0 | 0 | — | | |
| 32 | Hugo | 0 | 0 | 0 | 0 | 0 | — | | |
| 33 | Ethan | 0 | 0 | 0 | 0 | 0 | — | | |
| 34 | Ruben Fitoussi | 0 | 0 | 0 | 0 | 0 | — | | |
| 35 | David gianni | 0 | 0 | 0 | 0 | 0 | — | | |
| 36 | Simon | 0 | 0 | 0 | 0 | 0 | — | | |

---

## Résumé

> Le classement mesure **qui contribue le plus** semaine après semaine — la présence compte, les victoires comptent encore plus, et être élu MOM parmi 16 joueurs est un vrai privilège qui se voit dans les chiffres.
