import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../core/constants.dart';
import '../models/match_model.dart';
import '../models/player_model.dart';
import '../models/weekly_match_model.dart';
import '../utils/rating_system.dart';
import 'group_service.dart';

class MatchService {
  MatchService._();
  static final MatchService instance = MatchService._();

  final _db = FirebaseFirestore.instance;

  // ──────────────────────────────────────────────────────────────
  // Matches
  // ──────────────────────────────────────────────────────────────

  Stream<List<MatchModel>> watchMatches(String groupId) {
    return _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchs)
        .orderBy('dateCreation', descending: true)
        .limit(30)
        .snapshots()
        .map((s) => s.docs.map((d) => MatchModel.fromFirestore(d)).toList());
  }

  Future<List<MatchModel>> getMatches(String groupId, {int limit = 30}) async {
    final snap = await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchs)
        .orderBy('dateCreation', descending: true)
        .limit(limit)
        .get();
    return snap.docs.map((d) => MatchModel.fromFirestore(d)).toList();
  }

  /// Records a match: calculates ratings, writes match doc, updates player stats, synergies.
  Future<Map<String, RatingResult>> recordMatch({
    required String groupId,
    required List<PlayerModel> equipeA,
    required List<PlayerModel> equipeB,
    required int scoreA,
    required int scoreB,
    String? matchSemaineId,
  }) async {
    final changements = calculerChangementsMatch(equipeA, equipeB, scoreA, scoreB);

    final now = DateTime.now();
    final allPresents = [...equipeA, ...equipeB];
    final voteDeadline = now.add(const Duration(hours: 24));

    final matchId = matchSemaineId != null
        ? 'match_${matchSemaineId}'
        : 'match_${now.millisecondsSinceEpoch}';

    final matchRef = _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchs)
        .doc(matchId);

    // Prevent duplicate (idempotent)
    final existing = await matchRef.get();
    if (existing.exists) throw Exception('Ce match a déjà été enregistré');

    // Build Firestore changements map
    final changementsMap = changements.map((uid, r) => MapEntry(uid, {
          'ancien': r.ancien,
          'changement': r.changement,
          'nouveau': r.nouveau,
        }));

    // Write match doc
    await matchRef.set({
      'equipeA': equipeA.map((p) => p.id).toList(),
      'equipeB': equipeB.map((p) => p.id).toList(),
      'scoreA': scoreA,
      'scoreB': scoreB,
      'statut': 'joue',
      'changements': changementsMap,
      'dateCreation': now.toIso8601String(),
      'presentsCount': allPresents.length,
      'nbVotes': 0,
      'voteClos': false,
      'dateVoteFermeture': voteDeadline.toIso8601String(),
      'topJoueurs': [],
      if (matchSemaineId != null) 'matchSemaineId': matchSemaineId,
    });

    // Update player stats in batch
    final batch = _db.batch();
    final joueurRef = _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.joueurs);

    String resultatA = scoreA > scoreB ? 'victoire' : scoreA < scoreB ? 'defaite' : 'nul';
    String resultatB = scoreB > scoreA ? 'victoire' : scoreB < scoreA ? 'defaite' : 'nul';

    for (final joueur in equipeA) {
      final r = changements[joueur.id]!;
      batch.update(joueurRef.doc(joueur.id), {
        'impactRating': r.nouveau,
        'matchsJoues': FieldValue.increment(1),
        if (resultatA == 'victoire') 'victoires': FieldValue.increment(1),
        if (resultatA == 'nul') 'nuls': FieldValue.increment(1),
        if (resultatA == 'defaite') 'defaites': FieldValue.increment(1),
      });
    }
    for (final joueur in equipeB) {
      final r = changements[joueur.id]!;
      batch.update(joueurRef.doc(joueur.id), {
        'impactRating': r.nouveau,
        'matchsJoues': FieldValue.increment(1),
        if (resultatB == 'victoire') 'victoires': FieldValue.increment(1),
        if (resultatB == 'nul') 'nuls': FieldValue.increment(1),
        if (resultatB == 'defaite') 'defaites': FieldValue.increment(1),
      });
    }

    // Close weekly slot if linked
    if (matchSemaineId != null) {
      batch.update(
        _db.collection(Collections.groupes).doc(groupId).collection(Collections.matchsSemaine).doc(matchSemaineId),
        {'statut': MatchStatus.ferme},
      );
    }

    await batch.commit();

    // Update synergies (separate to avoid batch size issues)
    await GroupService.instance.updateSynergies(
      groupId,
      equipeA.map((p) => p.id).toList(),
      equipeB.map((p) => p.id).toList(),
      scoreA,
      scoreB,
    );

    return changements;
  }

  // ──────────────────────────────────────────────────────────────
  // Voting
  // ──────────────────────────────────────────────────────────────

  Future<bool> hasVoted(String groupId, String matchId, String uid) async {
    final snap = await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchs)
        .doc(matchId)
        .collection(Collections.votes)
        .doc(uid)
        .get();
    return snap.exists;
  }

  Future<void> submitVote({
    required String groupId,
    required String matchId,
    required String votantId,
    required String top1,
    required String top2,
    required String top3,
  }) async {
    final voteRef = _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchs)
        .doc(matchId)
        .collection(Collections.votes)
        .doc(votantId);

    final existing = await voteRef.get();
    if (existing.exists) throw Exception('Tu as déjà voté pour ce match');

    // Transaction: create vote + increment nbVotes
    await _db.runTransaction((tx) async {
      final matchRef = _db
          .collection(Collections.groupes)
          .doc(groupId)
          .collection(Collections.matchs)
          .doc(matchId);
      final matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists || (matchSnap.data()!['voteClos'] as bool? ?? true)) {
        throw Exception('Le vote est fermé');
      }

      tx.set(voteRef, {
        'top1': top1,
        'top2': top2,
        'top3': top3,
        'dateVote': DateTime.now().toIso8601String(),
      });
      tx.update(matchRef, {'nbVotes': FieldValue.increment(1)});
      tx.update(
        _db.collection(Collections.groupes).doc(groupId).collection(Collections.joueurs).doc(votantId),
        {'votesParticipes': FieldValue.increment(1)},
      );
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Weekly matches
  // ──────────────────────────────────────────────────────────────

  Stream<WeeklyMatchModel?> watchNextMatch(String groupId) {
    final now = DateTime.now();
    return _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchsSemaine)
        .where('statut', whereIn: [MatchStatus.programme, MatchStatus.ouvert])
        .orderBy('dateMatch')
        .limit(1)
        .snapshots()
        .map((s) => s.docs.isNotEmpty ? WeeklyMatchModel.fromFirestore(s.docs.first) : null);
  }

  Stream<List<InscriptionModel>> watchInscriptions(String groupId, String matchId) {
    return _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchsSemaine)
        .doc(matchId)
        .collection(Collections.inscriptions)
        .orderBy('dateInscription')
        .snapshots()
        .map((s) => s.docs.map((d) => InscriptionModel.fromFirestore(d)).toList());
  }

  Future<void> createManualSlot({
    required String groupId,
    required DateTime dateMatch,
    required int maxJoueurs,
  }) async {
    await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchsSemaine)
        .add({
      'dateMatch': dateMatch.toIso8601String(),
      'dateOuvertureInscription': DateTime.now().toIso8601String(),
      'maxJoueurs': maxJoueurs,
      'statut': MatchStatus.ouvert,
      'confirmedCount': 0,
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  Future<void> signUp({
    required String groupId,
    required String matchId,
    required String uid,
    required String displayName,
    required String? position,
    required int maxJoueurs,
    required int confirmedCount,
  }) async {
    final inscriptionRef = _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchsSemaine)
        .doc(matchId)
        .collection(Collections.inscriptions)
        .doc(uid);

    final matchRef = _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchsSemaine)
        .doc(matchId);

    await _db.runTransaction((tx) async {
      final matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists) throw Exception('Créneau introuvable');
      if (matchSnap.data()!['statut'] != MatchStatus.ouvert) {
        throw Exception('Les inscriptions ne sont pas ouvertes');
      }

      final inscSnap = await tx.get(inscriptionRef);
      if (inscSnap.exists) throw Exception('Tu es déjà inscrit');

      final confirmed = (matchSnap.data()!['confirmedCount'] as num?)?.toInt() ?? 0;
      final max = (matchSnap.data()!['maxJoueurs'] as num?)?.toInt() ?? 10;
      final statut = confirmed < max ? InscriptionStatus.confirme : InscriptionStatus.attente;

      tx.set(inscriptionRef, {
        'uid': uid,
        'displayName': displayName,
        'position': position,
        'statut': statut,
        'dateInscription': DateTime.now().toIso8601String(),
      });

      if (statut == InscriptionStatus.confirme) {
        tx.update(matchRef, {'confirmedCount': FieldValue.increment(1)});
      }
    });
  }

  Future<void> cancelSignUp({
    required String groupId,
    required String matchId,
    required String uid,
  }) async {
    final inscriptionRef = _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchsSemaine)
        .doc(matchId)
        .collection(Collections.inscriptions)
        .doc(uid);

    // Deleting triggers Cloud Function onInscriptionDeleted → promotes waitlist
    await inscriptionRef.delete();
  }

  Future<List<InscriptionModel>> getInscriptions(String groupId, String matchId) async {
    final snap = await _db
        .collection(Collections.groupes)
        .doc(groupId)
        .collection(Collections.matchsSemaine)
        .doc(matchId)
        .collection(Collections.inscriptions)
        .orderBy('dateInscription')
        .get();
    return snap.docs.map((d) => InscriptionModel.fromFirestore(d)).toList();
  }
}
