import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme.dart';
import '../../../models/match_model.dart';
import '../../../models/player_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/group_provider.dart';
import '../../../services/match_service.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/confirm_dialog.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/rating_change_badge.dart';

class HistoryTab extends ConsumerWidget {
  const HistoryTab({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchesAsync = ref.watch(matchesProvider(groupId));
    final playersAsync = ref.watch(activePlayersProvider(groupId));

    return matchesAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (matches) {
        if (matches.isEmpty) {
          return const EmptyState(
            icon: Icons.sports_soccer,
            title: 'Aucun match joué',
            subtitle: 'Les matchs enregistrés apparaîtront ici',
          );
        }

        final playerMap = {
          for (final p in (playersAsync.valueOrNull ?? <PlayerModel>[])) p.id: p
        };

        return ListView.separated(
          padding: const EdgeInsets.all(12),
          itemCount: matches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (ctx, i) => _MatchCard(
            match: matches[i],
            groupId: groupId,
            playerMap: playerMap,
          ),
        );
      },
    );
  }
}

class _MatchCard extends ConsumerStatefulWidget {
  const _MatchCard({
    required this.match,
    required this.groupId,
    required this.playerMap,
  });

  final MatchModel match;
  final String groupId;
  final Map<String, PlayerModel> playerMap;

  @override
  ConsumerState<_MatchCard> createState() => _MatchCardState();
}

class _MatchCardState extends ConsumerState<_MatchCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final m = widget.match;
    final user = ref.watch(authStateProvider).valueOrNull;
    final wasPresent = user != null && m.wasPresent(user.uid);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        children: [
          // Header: teams + score
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(child: _TeamNames(m.equipeA, widget.playerMap, AppColors.teamA)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Column(
                      children: [
                        Text(
                          m.scoreDisplay,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 18,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          DateFormat('dd/MM/yy').format(m.dateCreation),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _TeamNames(m.equipeB, widget.playerMap, AppColors.teamB, rightAlign: true),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: AppColors.textDisabled,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),

          // Expanded: rating changes + vote
          if (_expanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Changements de rating',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 13),
                  ),
                  const SizedBox(height: 10),
                  ...m.changements.entries.map((e) {
                    final player = widget.playerMap[e.key];
                    if (player == null) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Expanded(child: Text(player.displayName, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontSize: 13))),
                          Text('${e.value.ancien}', style: Theme.of(context).textTheme.bodySmall),
                          const SizedBox(width: 6),
                          RatingChangeBadge(change: e.value.changement),
                          const SizedBox(width: 6),
                          Text('${e.value.nouveau}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        ],
                      ),
                    );
                  }),

                  // Vote section
                  if (!m.voteClos && m.voteEnCours && wasPresent) ...[
                    const Divider(height: 20),
                    _VoteSection(match: m, groupId: widget.groupId, playerMap: widget.playerMap),
                  ],

                  // Podium if vote closed
                  if (m.voteClos && m.topJoueurs.isNotEmpty) ...[
                    const Divider(height: 20),
                    _Podium(topJoueurs: m.topJoueurs, playerMap: widget.playerMap),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TeamNames extends StatelessWidget {
  const _TeamNames(this.uids, this.playerMap, this.color, {this.rightAlign = false});
  final List<String> uids;
  final Map<String, PlayerModel> playerMap;
  final Color color;
  final bool rightAlign;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: rightAlign ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: uids.map((uid) {
        final name = playerMap[uid]?.displayName ?? uid.substring(0, 6);
        return Text(
          name,
          style: TextStyle(fontSize: 12, color: color),
          overflow: TextOverflow.ellipsis,
        );
      }).toList(),
    );
  }
}

class _VoteSection extends ConsumerStatefulWidget {
  const _VoteSection({
    required this.match,
    required this.groupId,
    required this.playerMap,
  });

  final MatchModel match;
  final String groupId;
  final Map<String, PlayerModel> playerMap;

  @override
  ConsumerState<_VoteSection> createState() => _VoteSectionState();
}

class _VoteSectionState extends ConsumerState<_VoteSection> {
  String? _top1, _top2, _top3;
  bool _loading = false;
  bool _voted = false;

  @override
  void initState() {
    super.initState();
    _checkAlreadyVoted();
  }

  Future<void> _checkAlreadyVoted() async {
    final user = ref.read(authStateProvider).valueOrNull;
    if (user == null) return;
    final voted = await MatchService.instance.hasVoted(widget.groupId, widget.match.id, user.uid);
    if (mounted) setState(() => _voted = voted);
  }

  Future<void> _submitVote() async {
    if (_top1 == null || _top2 == null || _top3 == null) {
      showSnackBar(context, 'Choisis 3 joueurs différents');
      return;
    }
    final user = ref.read(authStateProvider).valueOrNull;
    if (user == null) return;

    setState(() => _loading = true);
    try {
      await MatchService.instance.submitVote(
        groupId: widget.groupId,
        matchId: widget.match.id,
        votantId: user.uid,
        top1: _top1!,
        top2: _top2!,
        top3: _top3!,
      );
      if (mounted) setState(() => _voted = true);
      if (mounted) showSnackBar(context, 'Vote enregistré !');
    } catch (e) {
      if (mounted) showSnackBar(context, e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_voted) {
      return const Center(
        child: Text('✅ Tu as déjà voté', style: TextStyle(color: AppColors.success)),
      );
    }

    final votableUids = [...widget.match.equipeA, ...widget.match.equipeB];
    final user = ref.watch(authStateProvider).valueOrNull;
    // Can vote for anyone who was present, including yourself
    final candidates = votableUids
        .where((uid) => widget.playerMap.containsKey(uid))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('🗳️ Vote Man of the Match',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 14)),
        const SizedBox(height: 4),
        Text(
          'Choisis tes 3 meilleurs joueurs du match (3/2/1 pts)',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 12),
        _VoteDropdown('🥇 Top 1 (3 pts)', _top1, candidates, widget.playerMap,
            [_top2, _top3], (v) => setState(() => _top1 = v)),
        const SizedBox(height: 8),
        _VoteDropdown('🥈 Top 2 (2 pts)', _top2, candidates, widget.playerMap,
            [_top1, _top3], (v) => setState(() => _top2 = v)),
        const SizedBox(height: 8),
        _VoteDropdown('🥉 Top 3 (1 pt)', _top3, candidates, widget.playerMap,
            [_top1, _top2], (v) => setState(() => _top3 = v)),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _loading ? null : _submitVote,
          child: _loading
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Valider mon vote'),
        ),
      ],
    );
  }
}

class _VoteDropdown extends StatelessWidget {
  const _VoteDropdown(this.label, this.value, this.candidates, this.playerMap,
      this.excluded, this.onChanged);

  final String label;
  final String? value;
  final List<String> candidates;
  final Map<String, PlayerModel> playerMap;
  final List<String?> excluded;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final available = candidates.where((uid) => !excluded.contains(uid)).toList();
    return DropdownButtonFormField<String>(
      value: available.contains(value) ? value : null,
      decoration: InputDecoration(labelText: label),
      items: [
        const DropdownMenuItem(value: null, child: Text('— Choisir —')),
        ...available.map((uid) => DropdownMenuItem(
              value: uid,
              child: Text(playerMap[uid]?.displayName ?? uid),
            )),
      ],
      onChanged: onChanged,
    );
  }
}

class _Podium extends StatelessWidget {
  const _Podium({required this.topJoueurs, required this.playerMap});
  final List<TopJoueur> topJoueurs;
  final Map<String, PlayerModel> playerMap;

  @override
  Widget build(BuildContext context) {
    final emojis = ['🥇', '🥈', '🥉'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('🏆 Podium du match',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 14)),
        const SizedBox(height: 8),
        ...topJoueurs.map((t) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Text(emojis[t.rang - 1], style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      playerMap[t.uid]?.displayName ?? t.uid,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                  Text('${t.points} pts',
                      style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w700)),
                ],
              ),
            )),
      ],
    );
  }
}
