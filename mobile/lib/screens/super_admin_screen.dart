import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';
import '../models/group_model.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../providers/group_provider.dart';
import '../services/auth_service.dart';
import '../widgets/app_loading.dart';

class SuperAdminScreen extends ConsumerWidget {
  const SuperAdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isSuperAdmin = ref.watch(isSuperAdminProvider).valueOrNull ?? false;
    if (!isSuperAdmin) {
      return Scaffold(
        body: Center(child: Text('Accès refusé', style: Theme.of(context).textTheme.titleLarge)),
      );
    }

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Super Admin'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.go('/home'),
          ),
          bottom: const TabBar(
            tabs: [Tab(text: 'Groupes'), Tab(text: 'Utilisateurs')],
          ),
        ),
        body: TabBarView(
          children: [
            _GroupsTab(),
            _UsersTab(),
          ],
        ),
      ),
    );
  }
}

class _GroupsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(allGroupsProvider);

    return groupsAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (groups) {
        final sorted = [...groups]..sort((a, b) => a.nom.compareTo(b.nom));
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: sorted.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (ctx, i) => _GroupTile(group: sorted[i]),
        );
      },
    );
  }
}

class _GroupTile extends StatelessWidget {
  const _GroupTile({required this.group});
  final GroupModel group;

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
          const Text('⚽', style: TextStyle(fontSize: 20)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(group.nom, style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 2),
                Text(
                  'Code : ${group.code} • Max : ${group.maxJoueursMatch}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => context.push('/group/${group.id}'),
            child: const Text('Voir'),
          ),
          TextButton(
            onPressed: () => context.push('/group/${group.id}/admin'),
            style: TextButton.styleFrom(foregroundColor: AppColors.warning),
            child: const Text('Admin'),
          ),
        ],
      ),
    );
  }
}

class _UsersTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<UserModel>>(
      future: AuthService.instance.getAllUsers(),
      builder: (ctx, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const AppLoading();
        if (snap.hasError) return Center(child: Text('Erreur: ${snap.error}'));

        final users = snap.data ?? [];
        final sorted = [...users]..sort((a, b) => a.displayName.compareTo(b.displayName));

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '${sorted.length} utilisateurs inscrits',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                itemCount: sorted.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (ctx2, i) => _UserTile(user: sorted[i]),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user});
  final UserModel user;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user.displayName.isEmpty ? '(Sans nom)' : user.displayName,
                    style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 2),
                Text(user.email, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: user.profilComplet
                  ? AppColors.success.withOpacity(0.12)
                  : AppColors.warning.withOpacity(0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              user.profilComplet ? 'Complet' : 'Incomplet',
              style: TextStyle(
                color: user.profilComplet ? AppColors.success : AppColors.warning,
                fontSize: 11,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
