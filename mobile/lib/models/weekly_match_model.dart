import 'package:cloud_firestore/cloud_firestore.dart';

class InscriptionModel {
  final String uid;
  final String displayName;
  final String? position;
  final String statut; // 'confirmé' | 'attente'
  final DateTime dateInscription;

  const InscriptionModel({
    required this.uid,
    required this.displayName,
    this.position,
    required this.statut,
    required this.dateInscription,
  });

  factory InscriptionModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return InscriptionModel(
      uid: doc.id,
      displayName: d['displayName'] as String? ?? '',
      position: d['position'] as String?,
      statut: d['statut'] as String? ?? 'attente',
      dateInscription: d['dateInscription'] != null
          ? DateTime.parse(d['dateInscription'] as String)
          : DateTime.now(),
    );
  }

  bool get isConfirmed => statut == 'confirmé';
}

class WeeklyMatchModel {
  final String id;
  final DateTime dateMatch;
  final DateTime dateOuvertureInscription;
  final int maxJoueurs;
  final int confirmedCount;
  final String statut; // 'programmé' | 'ouvert' | 'fermé'
  final DateTime createdAt;

  const WeeklyMatchModel({
    required this.id,
    required this.dateMatch,
    required this.dateOuvertureInscription,
    required this.maxJoueurs,
    required this.confirmedCount,
    required this.statut,
    required this.createdAt,
  });

  factory WeeklyMatchModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return WeeklyMatchModel(
      id: doc.id,
      dateMatch: DateTime.parse(d['dateMatch'] as String),
      dateOuvertureInscription:
          DateTime.parse(d['dateOuvertureInscription'] as String),
      maxJoueurs: (d['maxJoueurs'] as num?)?.toInt() ?? 10,
      confirmedCount: (d['confirmedCount'] as num?)?.toInt() ?? 0,
      statut: d['statut'] as String? ?? 'programmé',
      createdAt: d['createdAt'] != null
          ? DateTime.parse(d['createdAt'] as String)
          : DateTime.now(),
    );
  }

  bool get isOpen => statut == 'ouvert';
  bool get isClosed => statut == 'fermé';
  bool get isProgrammed => statut == 'programmé';

  bool get isFull => confirmedCount >= maxJoueurs;

  Duration get timeUntilOpen => dateOuvertureInscription.difference(DateTime.now());
  Duration get timeUntilMatch => dateMatch.difference(DateTime.now());
}
