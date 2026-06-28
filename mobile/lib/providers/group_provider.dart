import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/group_model.dart';
import '../models/match_model.dart';
import '../models/player_model.dart';
import '../models/synergy_model.dart';
import '../models/weekly_match_model.dart';
import '../services/group_service.dart';
import '../services/match_service.dart';
import 'auth_provider.dart';

// ──────────────────────────────────────────────────────────────
// Group
// ──────────────────────────────────────────────────────────────

final groupProvider = StreamProvider.family<GroupModel?, String>((ref, groupId) {
  return GroupService.instance.watchGroup(groupId);
});

final allGroupsProvider = FutureProvider<List<GroupModel>>((ref) {
  return GroupService.instance.getAllGroups();
});

// ──────────────────────────────────────────────────────────────
// Players
// ──────────────────────────────────────────────────────────────

final activePlayersProvider = StreamProvider.family<List<PlayerModel>, String>((ref, groupId) {
  return GroupService.instance.watchActivePlayers(groupId);
});

final pendingPlayersProvider = StreamProvider.family<List<PlayerModel>, String>((ref, groupId) {
  return GroupService.instance.watchPendingPlayers(groupId);
});

// Current user's player doc in a group
final myPlayerProvider = StreamProvider.family<PlayerModel?, String>((ref, groupId) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return const Stream.empty();
  return GroupService.instance.watchActivePlayers(groupId).map(
    (players) => players.cast<PlayerModel?>().firstWhere(
          (p) => p?.id == user.uid,
          orElse: () => null,
        ),
  );
});

// ──────────────────────────────────────────────────────────────
// Synergies
// ──────────────────────────────────────────────────────────────

final synergiesProvider = StreamProvider.family<List<SynergyModel>, String>((ref, groupId) {
  return GroupService.instance.watchSynergies(groupId);
});

// ──────────────────────────────────────────────────────────────
// Matches
// ──────────────────────────────────────────────────────────────

final matchesProvider = StreamProvider.family<List<MatchModel>, String>((ref, groupId) {
  return MatchService.instance.watchMatches(groupId);
});

// ──────────────────────────────────────────────────────────────
// Weekly match
// ──────────────────────────────────────────────────────────────

final nextMatchProvider = StreamProvider.family<WeeklyMatchModel?, String>((ref, groupId) {
  return MatchService.instance.watchNextMatch(groupId);
});

final inscriptionsProvider =
    StreamProvider.family<List<InscriptionModel>, ({String groupId, String matchId})>(
  (ref, args) => MatchService.instance.watchInscriptions(args.groupId, args.matchId),
);

// ──────────────────────────────────────────────────────────────
// User's groups (home screen)
// ──────────────────────────────────────────────────────────────

final userGroupsProvider =
    StreamProvider.family<List<Map<String, dynamic>>, String>((ref, uid) {
  return GroupService.instance.watchUserGroups(uid);
});
