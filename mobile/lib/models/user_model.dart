import 'package:cloud_firestore/cloud_firestore.dart';

class UserModel {
  final String id;
  final String displayName;
  final String email;
  final String? photoURL;
  final String? position;
  final String? profilMilieu;
  final bool profilComplet;
  final DateTime dateInscription;

  const UserModel({
    required this.id,
    required this.displayName,
    required this.email,
    this.photoURL,
    this.position,
    this.profilMilieu,
    required this.profilComplet,
    required this.dateInscription,
  });

  factory UserModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return UserModel(
      id: doc.id,
      displayName: d['displayName'] as String? ?? '',
      email: d['email'] as String? ?? '',
      photoURL: d['photoURL'] as String?,
      position: d['position'] as String?,
      profilMilieu: d['profilMilieu'] as String?,
      profilComplet: d['profilComplet'] as bool? ?? false,
      dateInscription: d['dateInscription'] != null
          ? DateTime.parse(d['dateInscription'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'displayName': displayName,
        'email': email,
        'photoURL': photoURL,
        'position': position,
        'profilMilieu': profilMilieu,
        'profilComplet': profilComplet,
        'dateInscription': dateInscription.toIso8601String(),
      };

  UserModel copyWith({
    String? displayName,
    String? photoURL,
    String? position,
    String? profilMilieu,
    bool? profilComplet,
  }) =>
      UserModel(
        id: id,
        displayName: displayName ?? this.displayName,
        email: email,
        photoURL: photoURL ?? this.photoURL,
        position: position ?? this.position,
        profilMilieu: profilMilieu ?? this.profilMilieu,
        profilComplet: profilComplet ?? this.profilComplet,
        dateInscription: dateInscription,
      );
}
