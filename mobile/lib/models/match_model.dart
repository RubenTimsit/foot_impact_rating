import 'package:cloud_firestore/cloud_firestore.dart';

class RatingChange {
  final int ancien;
  final int changement;
  final int nouveau;

  const RatingChange({
    required this.ancien,
    required this.changement,
    required this.nouveau,
  });

  factory RatingChange.fromMap(Map<String, dynamic> d) => RatingChange(
        ancien: (d['ancien'] as num?)?.toInt() ?? 0,
        changement: (d['changement'] as num?)?.toInt() ?? 0,
        nouveau: (d['nouveau'] as num?)?.toInt() ?? 0,
      );
}

class TopJoueur {
  final String uid;
  final int points;
  final int rang;

  const TopJoueur({required this.uid, required this.points, required this.rang});

  factory TopJoueur.fromMap(Map<String, dynamic> d) => TopJoueur(
        uid: d['uid'] as String? ?? '',
        points: (d['points'] as num?)?.toInt() ?? 0,
        rang: (d['rang'] as num?)?.toInt() ?? 1,
      );
}

class MatchModel {
  final String id;
  final List<String> equipeA;
  final List<String> equipeB;
  final int scoreA;
  final int scoreB;
  final String statut;
  final Map<String, RatingChange> changements;
  final DateTime dateCreation;
  final bool voteClos;
  final int presentsCount;
  final int nbVotes;
  final DateTime? dateVoteFermeture;
  final List<TopJoueur> topJoueurs;
  final String? matchSemaineId; // link to weekly slot if any

  const MatchModel({
    required this.id,
    required this.equipeA,
    required this.equipeB,
    required this.scoreA,
    required this.scoreB,
    required this.statut,
    required this.changements,
    required this.dateCreation,
    required this.voteClos,
    required this.presentsCount,
    required this.nbVotes,
    this.dateVoteFermeture,
    required this.topJoueurs,
    this.matchSemaineId,
  });

  factory MatchModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;

    final changementsRaw = d['changements'] as Map<String, dynamic>? ?? {};
    final changements = changementsRaw.map(
      (k, v) => MapEntry(k, RatingChange.fromMap(v as Map<String, dynamic>)),
    );

    final topRaw = d['topJoueurs'] as List<dynamic>? ?? [];
    final topJoueurs = topRaw
        .map((e) => TopJoueur.fromMap(e as Map<String, dynamic>))
        .toList();

    return MatchModel(
      id: doc.id,
      equipeA: List<String>.from(d['equipeA'] as List? ?? []),
      equipeB: List<String>.from(d['equipeB'] as List? ?? []),
      scoreA: (d['scoreA'] as num?)?.toInt() ?? 0,
      scoreB: (d['scoreB'] as num?)?.toInt() ?? 0,
      statut: d['statut'] as String? ?? 'joue',
      changements: changements,
      dateCreation: d['dateCreation'] != null
          ? DateTime.parse(d['dateCreation'] as String)
          : DateTime.now(),
      voteClos: d['voteClos'] as bool? ?? true,
      presentsCount: (d['presentsCount'] as num?)?.toInt() ?? 0,
      nbVotes: (d['nbVotes'] as num?)?.toInt() ?? 0,
      dateVoteFermeture: d['dateVoteFermeture'] != null
          ? DateTime.parse(d['dateVoteFermeture'] as String)
          : null,
      topJoueurs: topJoueurs,
      matchSemaineId: d['matchSemaineId'] as String?,
    );
  }

  String get scoreDisplay => '$scoreA — $scoreB';

  bool get voteEnCours =>
      !voteClos &&
      dateVoteFermeture != null &&
      DateTime.now().isBefore(dateVoteFermeture!);

  bool isInTeamA(String uid) => equipeA.contains(uid);
  bool isInTeamB(String uid) => equipeB.contains(uid);
  bool wasPresent(String uid) => equipeA.contains(uid) || equipeB.contains(uid);
}
