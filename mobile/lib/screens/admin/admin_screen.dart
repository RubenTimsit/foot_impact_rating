import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/group_provider.dart';
import '../../widgets/app_loading.dart';
import 'tabs/pending_tab.dart';
import 'tabs/members_tab.dart';
import 'tabs/match_tab.dart';
import 'tabs/settings_tab.dart';

class AdminGroupScreen extends ConsumerWidget {
  const AdminGroupScreen({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupAsync = ref.watch(groupProvider(groupId));
    final user = ref.watch(authStateProvider).valueOrNull;
    final isSuperAdmin = ref.watch(isSuperAdminProvider).valueOrNull ?? false;

    return groupAsync.when(
      loading: () => const Scaffold(body: AppLoading()),
      error: (e, _) => Scaffold(body: Center(child: Text('Erreur: $e'))),
      data: (group) {
        if (group == null) {
          return const Scaffold(body: Center(child: Text('Groupe introuvable')));
        }

        // Access control
        if (user == null || (user.uid != group.adminId && !isSuperAdmin)) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) context.go('/group/$groupId');
          });
          return const Scaffold(body: AppLoading());
        }

        final pendingAsync = ref.watch(pendingPlayersProvider(groupId));
        final pendingCount = pendingAsync.valueOrNull?.length ?? 0;

        return DefaultTabController(
          length: 4,
          child: Scaffold(
            appBar: AppBar(
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(group.nom, style: Theme.of(context).textTheme.titleMedium),
                  Row(
                    children: [
                      const Text('Code : ', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      Text(
                        group.code,
                        style: const TextStyle(
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy, size: 14),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: group.code));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Code copié'), duration: Duration(seconds: 1)),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.go('/group/$groupId'),
              ),
              bottom: TabBar(
                tabs: [
                  Tab(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('En attente'),
                        if (pendingCount > 0) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.warning,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '$pendingCount',
                              style: const TextStyle(fontSize: 10, color: Colors.black),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Tab(text: 'Membres'),
                  const Tab(text: '⚽ Match'),
                  const Tab(text: 'Paramètres'),
                ],
                isScrollable: true,
                tabAlignment: TabAlignment.start,
              ),
            ),
            body: TabBarView(
              children: [
                PendingTab(groupId: groupId),
                MembersTab(groupId: groupId),
                MatchTab(groupId: groupId),
                SettingsTab(groupId: groupId),
              ],
            ),
          ),
        );
      },
    );
  }
}
