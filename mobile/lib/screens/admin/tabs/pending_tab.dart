import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../providers/group_provider.dart';
import '../../../services/group_service.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/confirm_dialog.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/player_avatar.dart';
import '../../../widgets/position_chip.dart';

class PendingTab extends ConsumerWidget {
  const PendingTab({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pendingAsync = ref.watch(pendingPlayersProvider(groupId));

    return pendingAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (players) {
        if (players.isEmpty) {
          return const EmptyState(
            icon: Icons.how_to_reg_outlined,
            title: 'Aucune demande en attente',
            subtitle: 'Les nouvelles demandes apparaîtront ici',
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: players.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (ctx, i) {
            final player = players[i];
            return Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.divider),
              ),
              child: Row(
                children: [
                  PlayerAvatar(name: player.displayName),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(player.displayName, style: Theme.of(context).textTheme.labelLarge),
                        const SizedBox(height: 4),
                        PositionChip(position: player.position),
                      ],
                    ),
                  ),
                  // Reject
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.error),
                    tooltip: 'Refuser',
                    onPressed: () async {
                      final ok = await showConfirmDialog(
                        ctx,
                        title: 'Refuser la demande',
                        message: 'Refuser ${player.displayName} ?',
                        confirmLabel: 'Refuser',
                        destructive: true,
                      );
                      if (ok) {
                        try {
                          await GroupService.instance.rejectPlayer(groupId, player.id);
                        } catch (e) {
                          if (ctx.mounted) showSnackBar(ctx, 'Erreur: $e', isError: true);
                        }
                      }
                    },
                  ),
                  // Approve
                  ElevatedButton(
                    onPressed: () async {
                      try {
                        await GroupService.instance.approvePlayer(groupId, player.id);
                        if (ctx.mounted) showSnackBar(ctx, '${player.displayName} approuvé !');
                      } catch (e) {
                        if (ctx.mounted) showSnackBar(ctx, 'Erreur: $e', isError: true);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(80, 36),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    child: const Text('Approuver'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
