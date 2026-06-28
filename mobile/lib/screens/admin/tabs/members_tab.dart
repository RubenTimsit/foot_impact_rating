import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../models/player_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/group_provider.dart';
import '../../../services/group_service.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/confirm_dialog.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/player_avatar.dart';
import '../../../widgets/position_chip.dart';
import '../../../widgets/trophy_row.dart';

class MembersTab extends ConsumerWidget {
  const MembersTab({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playersAsync = ref.watch(activePlayersProvider(groupId));
    final user = ref.watch(authStateProvider).valueOrNull;
    final groupAsync = ref.watch(groupProvider(groupId));
    final adminId = groupAsync.valueOrNull?.adminId;

    return playersAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (players) {
        if (players.isEmpty) {
          return const EmptyState(
            icon: Icons.group_outlined,
            title: 'Aucun membre actif',
          );
        }

        final sorted = [...players]..sort((a, b) => b.impactRating.compareTo(a.impactRating));

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: sorted.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (ctx, i) {
            final player = sorted[i];
            final isAdmin = player.id == adminId;
            final isCurrentUser = player.id == user?.uid;
            return _MemberCard(
              player: player,
              rank: i + 1,
              isAdmin: isAdmin,
              canExpel: !isAdmin && !isCurrentUser,
              onExpel: () async {
                final ok = await showConfirmDialog(
                  ctx,
                  title: 'Exclure le joueur',
                  message: 'Exclure ${player.displayName} du groupe ?',
                  confirmLabel: 'Exclure',
                  destructive: true,
                );
                if (ok) {
                  try {
                    await GroupService.instance.expelPlayer(groupId, player.id);
                    if (ctx.mounted) showSnackBar(ctx, '${player.displayName} exclu');
                  } catch (e) {
                    if (ctx.mounted) showSnackBar(ctx, 'Erreur: $e', isError: true);
                  }
                }
              },
            );
          },
        );
      },
    );
  }
}

class _MemberCard extends StatelessWidget {
  const _MemberCard({
    required this.player,
    required this.rank,
    required this.isAdmin,
    required this.canExpel,
    required this.onExpel,
  });

  final PlayerModel player;
  final int rank;
  final bool isAdmin;
  final bool canExpel;
  final VoidCallback onExpel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          Text('#$rank', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          const SizedBox(width: 10),
          PlayerAvatar(name: player.displayName),
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
                    if (isAdmin)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('Admin',
                            style: TextStyle(color: AppColors.primary, fontSize: 10)),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    PositionChip(position: player.position, small: true),
                    const SizedBox(width: 8),
                    Text(
                      '${player.impactRating} IR • ${player.matchsJoues}M',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(width: 6),
                    TrophyRow(trophees: player.trophees, compact: true),
                  ],
                ),
              ],
            ),
          ),
          if (canExpel)
            IconButton(
              icon: const Icon(Icons.person_remove_outlined, color: AppColors.error, size: 20),
              tooltip: 'Exclure',
              onPressed: onExpel,
            ),
        ],
      ),
    );
  }
}
