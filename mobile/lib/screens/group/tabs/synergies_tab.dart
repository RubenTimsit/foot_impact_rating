import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../models/player_model.dart';
import '../../../models/synergy_model.dart';
import '../../../providers/group_provider.dart';
import '../../../utils/synergy_system.dart' as synergySystem;
import '../../../widgets/app_loading.dart';
import '../../../widgets/empty_state.dart';

class SynergiesTab extends ConsumerWidget {
  const SynergiesTab({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final synergiesAsync = ref.watch(synergiesProvider(groupId));
    final playersAsync = ref.watch(activePlayersProvider(groupId));

    return synergiesAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (synergies) {
        if (synergies.isEmpty) {
          return const EmptyState(
            icon: Icons.hub_outlined,
            title: 'Pas encore de synergies',
            subtitle: 'Les synergies apparaissent après au moins 2 matchs ensemble',
          );
        }

        final players = playersAsync.valueOrNull ?? <PlayerModel>[];
        final top = synergySystem.getTopSynergies(synergies, players, limit: 8);
        final worst = synergySystem.getWorstSynergies(synergies, players, limit: 5);

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SectionHeader(title: '✨ Meilleures synergies', count: top.length),
            const SizedBox(height: 8),
            if (top.isEmpty)
              const _EmptySynergy()
            else
              ...top.map((s) => _SynergyCard(synergy: s, positive: true)),

            const SizedBox(height: 24),
            _SectionHeader(title: '💀 Duos maudits', count: worst.length),
            const SizedBox(height: 8),
            if (worst.isEmpty)
              const _EmptySynergy(message: 'Aucun duo négatif (min. 2 matchs)')
            else
              ...worst.map((s) => _SynergyCard(synergy: s, positive: false)),
          ],
        );
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.count});
  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const Spacer(),
        if (count > 0)
          Text('$count paires', style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _EmptySynergy extends StatelessWidget {
  const _EmptySynergy({this.message = 'Aucune donnée disponible'});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(message, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}

class _SynergyCard extends StatelessWidget {
  const _SynergyCard({required this.synergy, required this.positive});
  final SynergyModel synergy;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    final color = positive ? AppColors.success : AppColors.error;
    final valueStr = synergy.valeur >= 0 ? '+${synergy.valeur}' : '${synergy.valeur}';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          // Player names
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      synergy.nomJoueur1 ?? '?',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Icon(Icons.link, size: 16, color: color),
                    ),
                    Text(
                      synergy.nomJoueur2 ?? '?',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${synergy.matchsEnsemble} matchs • '
                  '${synergy.victoires}V ${synergy.nuls}N ${synergy.defaites}D • '
                  '${(synergy.winRate * 100).round()}% victoires',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          // Synergy value
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              valueStr,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
