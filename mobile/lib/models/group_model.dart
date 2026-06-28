import 'package:cloud_firestore/cloud_firestore.dart';

class WeeklyConfig {
  final String id;
  final bool actif;
  final int matchJour; // 0=Dim, 1=Lun, ..., 6=Sam
  final String matchHeure; // "HH:mm"
  final int inscriptionJour;
  final String inscriptionHeure;
  final int maxJoueurs;
  final String? nextOuvertureDate;

  const WeeklyConfig({
    required this.id,
    required this.actif,
    required this.matchJour,
    required this.matchHeure,
    required this.inscriptionJour,
    required this.inscriptionHeure,
    required this.maxJoueurs,
    this.nextOuvertureDate,
  });

  factory WeeklyConfig.fromMap(String id, Map<String, dynamic> d) =>
      WeeklyConfig(
        id: id,
        actif: d['actif'] as bool? ?? false,
        matchJour: d['matchJour'] as int? ?? 5,
        matchHeure: d['matchHeure'] as String? ?? '20:00',
        inscriptionJour: d['inscriptionJour'] as int? ?? 1,
        inscriptionHeure: d['inscriptionHeure'] as String? ?? '08:00',
        maxJoueurs: d['maxJoueurs'] as int? ?? 10,
        nextOuvertureDate: d['nextOuvertureDate'] as String?,
      );

  Map<String, dynamic> toMap() => {
        'actif': actif,
        'matchJour': matchJour,
        'matchHeure': matchHeure,
        'inscriptionJour': inscriptionJour,
        'inscriptionHeure': inscriptionHeure,
        'maxJoueurs': maxJoueurs,
        'nextOuvertureDate': nextOuvertureDate,
      };
}

class GroupModel {
  final String id;
  final String nom;
  final String code;
  final String adminId;
  final int maxJoueursMatch;
  final bool actif;
  final bool configHebdoActif;
  final Map<String, WeeklyConfig> configHebdos;
  final DateTime dateCreation;

  const GroupModel({
    required this.id,
    required this.nom,
    required this.code,
    required this.adminId,
    required this.maxJoueursMatch,
    required this.actif,
    required this.configHebdoActif,
    required this.configHebdos,
    required this.dateCreation,
  });

  factory GroupModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    final configsRaw = d['configHebdos'] as Map<String, dynamic>? ?? {};
    final configs = configsRaw.map(
      (k, v) => MapEntry(k, WeeklyConfig.fromMap(k, v as Map<String, dynamic>)),
    );
    return GroupModel(
      id: doc.id,
      nom: d['nom'] as String? ?? '',
      code: d['code'] as String? ?? '',
      adminId: d['adminId'] as String? ?? '',
      maxJoueursMatch: d['maxJoueursMatch'] as int? ?? 10,
      actif: d['actif'] as bool? ?? true,
      configHebdoActif: d['configHebdoActif'] as bool? ?? false,
      configHebdos: configs,
      dateCreation: d['dateCreation'] != null
          ? DateTime.parse(d['dateCreation'] as String)
          : DateTime.now(),
    );
  }

  bool get hasActiveWeeklyConfig =>
      configHebdoActif &&
      configHebdos.values.any((c) => c.actif);
}
