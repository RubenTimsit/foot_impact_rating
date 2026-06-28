import 'dart:math' as math;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../core/constants.dart';
import '../models/group_model.dart';
import '../models/player_model.dart';
import '../models/synergy_model.dart';
import '../utils/synergy_system.dart' as synergySystem;

class GroupService {
  GroupService._();
  static final GroupService instance = GroupService._();

  final _db = FirebaseFirestore.instance;

  // ──────────────────────────────────────────────────────────────
  // Groups
  // ──────────────────────────────────────────────────────────────

  Stream<GroupModel?> watchGroup(String groupId) {
    return _db
        .collection(Collections.groupes)
        .doc(groupId)
        .snapshots()
        .map((s) => s.exists ? GroupModel.fromFirestore(s) : null);
  }

  Future<GroupModel?> getGroup(String groupId) async {
    final snap = await _db.collection(Collections.groupes).doc(groupId).get();
    return snap.exists ? GroupModel.fromFirestore(snap) : null;
  }

  Future<List<GroupModel>> getAllGroups() async {
    final snap = await _db.collection(Collections.groupes).get();
    return snap.docs.map((d) => GroupModel.fromFirestore(d)).toList();
  }

  /// All groups where the current user has an active member doc
  Stream<List<Map<String, dynamic>>> watchUserGroups(String uid) {
    return _db
        .collectionGroup(Collections.joueurs)
        .where('userId', isEqualTo: uid)
        .snapshots()
        .asyncMap((snap) async {
      final results = <Map<String, dynamic>>[];
      for (final joueurDoc in snap.docs) {
        final groupId = joueurDoc.reference.parent.parent!.id;
        final groupDoc = await _db.collection(Collections.groupes).doc(groupId).get();
        if (groupDoc.exists) {
          results.add({
            'group': GroupModel.fromFirestore(groupDoc),
            'player': PlayerModel.fromFirestore(joueurDoc),
          });
        }
      }
      return results;
    });
  }

  Future<String> createGroup(String nom, int maxJoueurs, String adminId, String displayName, String? position) async {
    final code = _generateCode();
    final ref = await _db.collection(Collections.groupes).add({
      'nom': nom,
      'code': code,
      'adminId': adminId,
      'maxJoueursMatch': maxJoueurs,
      'actif': true,
      'configHebdoActif': false,
      'configHebdos': {},
      'dateCreation': DateTime.now().toIso8601String(),
    });

    // Add admin as active player
    await ref.collection(Collections.joueurs).doc(adminId).set({
      'userId': adminId,
      'displayName': displayName,
      'position': position,
      'profilMilieu': null,
      'statut': MemberStatus.active,
      'impactRating': 1000,
      'matchsJoues': 0,
      'victoires': 0,
      'nuls': 0,
      'defaites': 0,
      'votesParticipes': 0,
      'trophees': {'or': 0, 'argent': 0, 'bronze': 0},
      'dateAjout': DateTime.now().toIso8601String(),
    });

    return ref.id;
  }

  Future<void> joinGroup(String code, String uid, String displayName, String? position) async {
    final snap = await _db
        .collection(Collections.groupes)
        .where('code', isEqualTo: code.toUpperCase())
        .limit(1)
        .get();

    if (snap.empty) throw Exception('Code invalide');

    final groupDoc = snap.docs.first;
    final joueurRef = groupDoc.reference.collection(Collections.joueurs).doc(uid);
    final joueurSnap = await joueurRef.get();

    if (joueurSnap.exists) {
      throw Exception('Tu es déjà membre de ce groupe');
    }

    await joueurRef.set({
      'userId': uid,
      'displayName': displayName,
      'position': position,
      'profilMilieu': null,
      'statut': MemberStatus.pending,
      'impactRating': 1000,
      'matchsJoues': 0,
      'victoires': 0,
      'nuls': 0,
      'defaites': 0,
      'votesParticipes': 0,
      'trophees': {'or': 0, 'argent': 0, 'bronze': 0},
      'dateAjout': DateTime.now().toIso8601String(),
    });
  }

  Future<void> updateGroup(String groupId, Map<String, dynamic> data) async {
    await _db.collection(Collections.groupes).doc(groupId).update(data);
  }

  String _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rand = math.Random.secure();
    return List.generate(6, (_) => chars[rand.nextInt(chars.length)]).join();
  }

  // ──────────────────────────────────────────────────────────────
  // Players
  // ──────────────────────────────────────────────────────────────

  Stream<List<PlayerModel>> watchActivePlayers(String groupId) {
    return _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs)
        .where('statut', isEqualTo: MemberStatus.active)
        .snapshots()
        .map((s) => s.docs.map((d) => PlayerModel.fromFirestore(d)).toList());
  }

  Stream<List<PlayerModel>> watchPendingPlayers(String groupId) {
    return _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs)
        .where('statut', isEqualTo: MemberStatus.pending)
        .snapshots()
        .map((s) => s.docs.map((d) => PlayerModel.fromFirestore(d)).toList());
  }

  Future<List<PlayerModel>> getActivePlayers(String groupId) async {
    final snap = await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs)
        .where('statut', isEqualTo: MemberStatus.active)
        .get();
    return snap.docs.map((d) => PlayerModel.fromFirestore(d)).toList();
  }

  Future<PlayerModel?> getPlayer(String groupId, String uid) async {
    final snap = await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs)
        .doc(uid)
        .get();
    return snap.exists ? PlayerModel.fromFirestore(snap) : null;
  }

  Future<void> approvePlayer(String groupId, String uid) async {
    await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs)
        .doc(uid)
        .update({'statut': MemberStatus.active});
  }

  Future<void> rejectPlayer(String groupId, String uid) async {
    await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs)
        .doc(uid)
        .delete();
  }

  Future<void> expelPlayer(String groupId, String uid) async {
    await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs)
        .doc(uid)
        .delete();
  }

  // ──────────────────────────────────────────────────────────────
  // Synergies
  // ──────────────────────────────────────────────────────────────

  Stream<List<SynergyModel>> watchSynergies(String groupId) {
    return _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.synergies)
        .snapshots()
        .map((s) => s.docs.map((d) => SynergyModel.fromFirestore(d)).toList());
  }

  /// Called after a match is recorded — updates all pairwise synergies in a batch.
  Future<void> updateSynergies(
    String groupId,
    List<String> equipeA,
    List<String> equipeB,
    int scoreA,
    int scoreB,
  ) async {
    final scoreDiff = (scoreA - scoreB).abs();

    // Read existing synergies for involved pairs
    final allIds = [...equipeA, ...equipeB];
    final Map<String, Map<String, dynamic>> synMap = {};

    // Fetch existing docs
    final synSnap = await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.synergies)
        .get();

    for (final doc in synSnap.docs) {
      synMap[doc.id] = Map<String, dynamic>.from(doc.data());
    }

    String resultatA, resultatB;
    if (scoreA > scoreB) {
      resultatA = 'victoire'; resultatB = 'defaite';
    } else if (scoreA < scoreB) {
      resultatA = 'defaite'; resultatB = 'victoire';
    } else {
      resultatA = resultatB = 'nul';
    }

    synergySystem.mettreAJourSynergiesEquipe(synMap, equipeA, resultatA, scoreA > scoreB ? scoreDiff : -scoreDiff);
    synergySystem.mettreAJourSynergiesEquipe(synMap, equipeB, resultatB, scoreB > scoreA ? scoreDiff : -scoreDiff);

    // Write updated synergies in batch
    final batch = _db.batch();
    final synRef = _db.collection(Collections.groupes).doc(groupId).collection(Collections.synergies);

    for (final entry in synMap.entries) {
      batch.set(synRef.doc(entry.key), entry.value, SetOptions(merge: true));
    }
    await batch.commit();
  }

  // ──────────────────────────────────────────────────────────────
  // Weekly config management
  // ──────────────────────────────────────────────────────────────

  Future<void> addWeeklyConfig(String groupId, Map<String, dynamic> config) async {
    final ref = _db.collection(Collections.groupes).doc(groupId);
    final snap = await ref.get();
    final data = snap.data()!;
    final configs = Map<String, dynamic>.from(data['configHebdos'] as Map? ?? {});
    final newId = DateTime.now().millisecondsSinceEpoch.toString();
    configs[newId] = config;
    await ref.update({
      'configHebdos': configs,
      'configHebdoActif': true,
    });
  }

  Future<void> updateWeeklyConfig(String groupId, String configId, Map<String, dynamic> data) async {
    await _db.collection(Collections.groupes).doc(groupId).update({
      'configHebdos.$configId': data,
    });
  }

  Future<void> toggleWeeklyConfig(String groupId, String configId, bool actif) async {
    await _db.collection(Collections.groupes).doc(groupId).update({
      'configHebdos.$configId.actif': actif,
    });
    // Update global flag
    final snap = await _db.collection(Collections.groupes).doc(groupId).get();
    final configs = snap.data()?['configHebdos'] as Map<String, dynamic>? ?? {};
    final anyActive = configs.values.any((c) => (c as Map)['actif'] == true);
    await _db.collection(Collections.groupes).doc(groupId).update({'configHebdoActif': anyActive});
  }
}
