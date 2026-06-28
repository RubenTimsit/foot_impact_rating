// Port Dart du système ELO de js/rating-system.js — logique identique.
import 'dart:math' as math;
import '../models/player_model.dart';

const double _kFactor = 64;
const int baseRating = 1000;
const int _gainMax = 150;
const int _perteMax = -150;

class RatingResult {
  final int ancien;
  final int changement;
  final int nouveau;
  final String resultat;

  const RatingResult({
    required this.ancien,
    required this.changement,
    required this.nouveau,
    required this.resultat,
  });
}

double _probabilite(double ratingA, double ratingB) {
  return 1.0 / (1.0 + math.pow(10, (ratingB - ratingA) / 400.0));
}

double _ratingMoyen(List<PlayerModel> joueurs) {
  if (joueurs.isEmpty) return baseRating.toDouble();
  return joueurs.fold<double>(0, (acc, j) => acc + j.impactRating) / joueurs.length;
}

double _multiplicateurScore(int s1, int s2) => 1.0 + ((s1 - s2).abs() / 6.0);

int _calculerChangement(
  double ratingEquipeAlliee,
  double ratingEquipeAdverse,
  double resultat,
  int s1,
  int s2,
) {
  final prob = _probabilite(ratingEquipeAlliee, ratingEquipeAdverse);
  final changementBase = _kFactor * (resultat - prob);
  final delta = (changementBase * _multiplicateurScore(s1, s2)).round();
  return delta.clamp(_perteMax, _gainMax);
}

/// Calcule les changements de rating ELO pour tous les joueurs d'un match.
/// Équivalent exact de calculerChangementsMatch() JS.
Map<String, RatingResult> calculerChangementsMatch(
  List<PlayerModel> equipe1,
  List<PlayerModel> equipe2,
  int score1,
  int score2,
) {
  final r1 = _ratingMoyen(equipe1);
  final r2 = _ratingMoyen(equipe2);

  double res1, res2;
  String txt1, txt2;
  if (score1 > score2) {
    res1 = 1; res2 = 0; txt1 = 'victoire'; txt2 = 'defaite';
  } else if (score1 < score2) {
    res1 = 0; res2 = 1; txt1 = 'defaite'; txt2 = 'victoire';
  } else {
    res1 = 0.5; res2 = 0.5; txt1 = 'nul'; txt2 = 'nul';
  }

  final changements = <String, RatingResult>{};

  for (final j in equipe1) {
    final changement = _calculerChangement(r1, r2, res1, score1, score2);
    changements[j.id] = RatingResult(
      ancien: j.impactRating,
      changement: changement,
      nouveau: j.impactRating + changement,
      resultat: txt1,
    );
  }
  for (final j in equipe2) {
    final changement = _calculerChangement(r2, r1, res2, score2, score1);
    changements[j.id] = RatingResult(
      ancien: j.impactRating,
      changement: changement,
      nouveau: j.impactRating + changement,
      resultat: txt2,
    );
  }

  return changements;
}

/// Niveau de confiance statistique d'un rating (entre 0 et 1).
double calculerConfiance(int matchsJoues) {
  return (matchsJoues / 10.0).clamp(0.0, 1.0);
}
