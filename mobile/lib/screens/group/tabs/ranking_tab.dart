import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../models/player_model.dart';
import '../../../providers/group_provider.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/player_avatar.dart';
import '../../../widgets/position_chip.dart';
import '../../../widgets/trophy_row.dart';

class RankingTab extends ConsumerStatefulWidget {
  const RankingTab({super.key, required this.groupId});
  final String groupId;

  @override
  ConsumerState<RankingTab> createState() => _RankingTabState();
}

class _RankingTabState extends ConsumerState<RankingTab> {
  String? _positionFilter;

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(activePlayersProvider(widget.groupId));

    return playersAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (players) {
        if (players.isEmpty) {
          return const EmptyState(
            icon: Icons.leaderboard_outlined,
            title: 'Aucun joueur actif',
            subtitle: 'Les joueurs approuvés apparaîtront ici',
          );
        }

        // Sort by rating descending
        final sorted = [...players]..sort((a, b) => b.impactRating.compareTo(a.impactRating));

        // Filter
        final filtered = _positionFilter == null
            ? sorted
            : sorted.where((p) => p.position == _positionFilter).toList();

        return Column(
          children: [
            // Position filter chips
            _FilterBar(
              selected: _positionFilter,
              onSelect: (pos) => setState(() => _positionFilter = pos),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (ctx, i) {
                  final player = filtered[i];
                  // Get rank in overall sorted list
                  final overallRank = sorted.indexOf(player) + 1;
                  return _PlayerRankCard(
                    player: player,
                    rank: overallRank,
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.selected, required this.onSelect});
  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final positions = [null, 'Gardien', 'Défenseur', 'Milieu', 'Attaquant'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: positions.map((pos) {
          final isSelected = selected == pos;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onSelect(pos),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? AppColors.primary : AppColors.divider,
                  ),
                ),
                child: Text(
                  pos ?? 'Tous',
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _PlayerRankCard extends StatelessWidget {
  const _PlayerRankCard({required this.player, required this.rank});
  final PlayerModel player;
  final int rank;

  @override
  Widget build(BuildContext context) {
    final rankEmoji = rank == 1 ? '🥇' : rank == 2 ? '🥈' : rank == 3 ? '🥉' : null;

    return Container(
      decoration: BoxDecoration(
        color: rank <= 3 ? AppColors.surfaceVariant : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: rank == 1
              ? AppColors.gold.withOpacity(0.3)
              : rank == 2
                  ? AppColors.silver.withOpacity(0.3)
                  : rank == 3
                      ? AppColors.bronze.withOpacity(0.3)
                      : AppColors.divider,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            // Rank
            SizedBox(
              width: 32,
              child: rankEmoji != null
                  ? Text(rankEmoji, style: const TextStyle(fontSize: 20))
                  : Text(
                      '#$rank',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
            ),
            const SizedBox(width: 8),
            PlayerAvatar(name: player.displayName, radius: 18),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          player.displayName,
                          style: Theme.of(context).textTheme.labelLarge,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      PositionChip(position: player.position, small: true),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '${player.victoires}V ${player.nuls}N ${player.defaites}D',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(width: 10),
                      TrophyRow(trophees: player.trophees, compact: true),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  player.impactRating.toString(),
                  style: TextStyle(
                    color: rank <= 3 ? AppColors.primary : AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                  ),
                ),
                Text('IR', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
