import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/group_provider.dart';
import '../../widgets/app_loading.dart';
import 'tabs/ranking_tab.dart';
import 'tabs/history_tab.dart';
import 'tabs/synergies_tab.dart';
import 'tabs/next_match_tab.dart';

class GroupScreen extends ConsumerWidget {
  const GroupScreen({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupAsync = ref.watch(groupProvider(groupId));
    final user = ref.watch(authStateProvider).valueOrNull;

    return groupAsync.when(
      loading: () => const Scaffold(body: AppLoading(message: 'Chargement du groupe…')),
      error: (e, _) => Scaffold(body: Center(child: Text('Erreur: $e'))),
      data: (group) {
        if (group == null) {
          return Scaffold(body: Center(child: Text('Groupe introuvable')));
        }

        final isAdmin = user?.uid == group.adminId;

        return DefaultTabController(
          length: 4,
          child: Scaffold(
            appBar: AppBar(
              title: Text(group.nom),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.go('/home'),
              ),
              actions: [
                // Copy invite code
                IconButton(
                  icon: const Icon(Icons.share_outlined),
                  tooltip: 'Code: ${group.code}',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: group.code));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Code ${group.code} copié !'),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                ),
                if (isAdmin)
                  IconButton(
                    icon: const Icon(Icons.settings_outlined),
                    tooltip: 'Admin',
                    onPressed: () => context.push('/group/$groupId/admin'),
                  ),
              ],
              bottom: const TabBar(
                tabs: [
                  Tab(text: 'Classement'),
                  Tab(text: 'Historique'),
                  Tab(text: 'Synergies'),
                  Tab(text: 'Prochain match'),
                ],
                isScrollable: true,
                tabAlignment: TabAlignment.start,
              ),
            ),
            body: TabBarView(
              children: [
                RankingTab(groupId: groupId),
                HistoryTab(groupId: groupId),
                SynergiesTab(groupId: groupId),
                NextMatchTab(groupId: groupId),
              ],
            ),
          ),
        );
      },
    );
  }
}
