import 'package:cloud_firestore/cloud_firestore.dart';

class TropheeCount {
  final int or;
  final int argent;
  final int bronze;

  const TropheeCount({this.or = 0, this.argent = 0, this.bronze = 0});

  factory TropheeCount.fromMap(Map<String, dynamic>? d) {
    if (d == null) return const TropheeCount();
    return TropheeCount(
      or: (d['or'] as num?)?.toInt() ?? 0,
      argent: (d['argent'] as num?)?.toInt() ?? 0,
      bronze: (d['bronze'] as num?)?.toInt() ?? 0,
    );
  }

  int get total => or + argent + bronze;
}

class PlayerModel {
  final String id; // == uid
  final String displayName;
  final String? position;
  final String? profilMilieu;
  final String statut; // 'pending' | 'active'
  final int impactRating;
  final int matchsJoues;
  final int victoires;
  final int nuls;
  final int defaites;
  final int votesParticipes;
  final TropheeCount trophees;
  final DateTime dateAjout;

  const PlayerModel({
    required this.id,
    required this.displayName,
    this.position,
    this.profilMilieu,
    required this.statut,
    required this.impactRating,
    required this.matchsJoues,
    required this.victoires,
    required this.nuls,
    required this.defaites,
    required this.votesParticipes,
    required this.trophees,
    required this.dateAjout,
  });

  factory PlayerModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return PlayerModel(
      id: doc.id,
      displayName: d['displayName'] as String? ?? '',
      position: d['position'] as String?,
      profilMilieu: d['profilMilieu'] as String?,
      statut: d['statut'] as String? ?? 'pending',
      impactRating: (d['impactRating'] as num?)?.toInt() ?? 1000,
      matchsJoues: (d['matchsJoues'] as num?)?.toInt() ?? 0,
      victoires: (d['victoires'] as num?)?.toInt() ?? 0,
      nuls: (d['nuls'] as num?)?.toInt() ?? 0,
      defaites: (d['defaites'] as num?)?.toInt() ?? 0,
      votesParticipes: (d['votesParticipes'] as num?)?.toInt() ?? 0,
      trophees: TropheeCount.fromMap(d['trophees'] as Map<String, dynamic>?),
      dateAjout: d['dateAjout'] != null
          ? DateTime.parse(d['dateAjout'] as String)
          : DateTime.now(),
    );
  }

  // Convenience getters
  double get presenceRate => matchsJoues > 0
      ? ((victoires + nuls + defaites) / matchsJoues).clamp(0.0, 1.0)
      : 0.0;

  String get ratingDisplay => impactRating.toString();

  // For rating system — position principal used in calculations
  String get positionPrincipale => position ?? 'Milieu';

  bool get isActive => statut == 'active';
}
