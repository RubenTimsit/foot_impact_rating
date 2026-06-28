// Port Dart du système de synergies — js/synergy-system.js

import '../models/synergy_model.dart';
import '../models/player_model.dart';

/// Met à jour ou crée une synergie pour une paire de joueurs.
Map<String, Map<String, dynamic>> mettreAJourSynergie(
  Map<String, Map<String, dynamic>> synergies,
  String joueurId1,
  String joueurId2,
  String resultat,
  int scoreDiff,
) {
  final ids = [joueurId1, joueurId2]..sort();
  final cle = ids.join('-');

  synergies.putIfAbsent(cle, () => {
        'joueur1': ids[0],
        'joueur2': ids[1],
        'valeur': 0.0,
        'matchsEnsemble': 0,
        'victoires': 0,
        'nuls': 0,
        'defaites': 0,
      });

  final syn = synergies[cle]!;
  syn['matchsEnsemble'] = (syn['matchsEnsemble'] as int) + 1;

  if (resultat == 'victoire') {
    syn['victoires'] = (syn['victoires'] as int) + 1;
    syn['valeur'] = ((syn['valeur'] as double) + 1 + (scoreDiff / 20.0));
  } else if (resultat == 'nul') {
    syn['nuls'] = (syn['nuls'] as int) + 1;
  } else {
    syn['defaites'] = (syn['defaites'] as int) + 1;
    syn['valeur'] = (syn['valeur'] as double) - 1;
  }

  syn['valeur'] = ((syn['valeur'] as double) * 10).round() / 10.0;
  return synergies;
}

/// Met à jour toutes les synergies pour une équipe.
Map<String, Map<String, dynamic>> mettreAJourSynergiesEquipe(
  Map<String, Map<String, dynamic>> synergies,
  List<String> equipe,
  String resultat,
  int scoreDiff,
) {
  for (var i = 0; i < equipe.length; i++) {
    for (var j = i + 1; j < equipe.length; j++) {
      mettreAJourSynergie(synergies, equipe[i], equipe[j], resultat, scoreDiff);
    }
  }
  return synergies;
}

/// Filtre les synergies ayant au moins minMatchs matchs ensemble, triées par valeur.
List<SynergyModel> getTopSynergies(
  List<SynergyModel> synergies,
  List<PlayerModel> joueurs, {
  int minMatchs = 2,
  int limit = 10,
}) {
  final playerMap = {for (final j in joueurs) j.id: j.displayName};

  return synergies
      .where((s) => s.matchsEnsemble >= minMatchs)
      .map((s) => s.withNames(
            playerMap[s.joueur1] ?? 'Inconnu',
            playerMap[s.joueur2] ?? 'Inconnu',
          ))
      .toList()
    ..sort((a, b) => b.valeur.compareTo(a.valeur))
    ..length > limit ? synergies.sublist(0, limit) : null;
}

List<SynergyModel> getWorstSynergies(
  List<SynergyModel> synergies,
  List<PlayerModel> joueurs, {
  int minMatchs = 2,
  int limit = 5,
}) {
  final playerMap = {for (final j in joueurs) j.id: j.displayName};

  final withNames = synergies
      .where((s) => s.matchsEnsemble >= minMatchs && s.valeur < 0)
      .map((s) => s.withNames(
            playerMap[s.joueur1] ?? 'Inconnu',
            playerMap[s.joueur2] ?? 'Inconnu',
          ))
      .toList();

  withNames.sort((a, b) => a.valeur.compareTo(b.valeur));
  return withNames.take(limit).toList();
}
