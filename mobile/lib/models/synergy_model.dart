import 'package:cloud_firestore/cloud_firestore.dart';

class SynergyModel {
  final String id; // "{uid1}-{uid2}" sorted
  final String joueur1;
  final String joueur2;
  final double valeur;
  final int matchsEnsemble;
  final int victoires;
  final int nuls;
  final int defaites;

  // Enriched display names (populated client-side from player list)
  final String? nomJoueur1;
  final String? nomJoueur2;

  const SynergyModel({
    required this.id,
    required this.joueur1,
    required this.joueur2,
    required this.valeur,
    required this.matchsEnsemble,
    required this.victoires,
    required this.nuls,
    required this.defaites,
    this.nomJoueur1,
    this.nomJoueur2,
  });

  factory SynergyModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return SynergyModel(
      id: doc.id,
      joueur1: d['joueur1'] as String? ?? '',
      joueur2: d['joueur2'] as String? ?? '',
      valeur: (d['valeur'] as num?)?.toDouble() ?? 0.0,
      matchsEnsemble: (d['matchsEnsemble'] as num?)?.toInt() ?? 0,
      victoires: (d['victoires'] as num?)?.toInt() ?? 0,
      nuls: (d['nuls'] as num?)?.toInt() ?? 0,
      defaites: (d['defaites'] as num?)?.toInt() ?? 0,
    );
  }

  SynergyModel withNames(String nom1, String nom2) => SynergyModel(
        id: id,
        joueur1: joueur1,
        joueur2: joueur2,
        valeur: valeur,
        matchsEnsemble: matchsEnsemble,
        victoires: victoires,
        nuls: nuls,
        defaites: defaites,
        nomJoueur1: nom1,
        nomJoueur2: nom2,
      );

  double get winRate =>
      matchsEnsemble > 0 ? victoires / matchsEnsemble : 0.0;

  bool get isPositive => valeur > 0;
  bool get isNegative => valeur < 0;
}
