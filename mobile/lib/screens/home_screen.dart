import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';
import '../models/group_model.dart';
import '../models/player_model.dart';
import '../providers/auth_provider.dart';
import '../providers/group_provider.dart';
import '../services/auth_service.dart';
import '../services/group_service.dart';
import '../widgets/app_loading.dart';
import '../widgets/empty_state.dart';
import '../widgets/position_chip.dart';
import '../widgets/confirm_dialog.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;
    if (user == null) return const Scaffold();

    final profile = ref.watch(userProfileProvider).valueOrNull;
    final isSuperAdmin = ref.watch(isSuperAdminProvider).valueOrNull ?? false;
    final groupsAsync = ref.watch(userGroupsProvider(user.uid));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Impact Rating'),
        leading: const Padding(
          padding: EdgeInsets.all(12),
          child: Text('⚽', style: TextStyle(fontSize: 22)),
        ),
        actions: [
          if (isSuperAdmin)
            IconButton(
              icon: const Icon(Icons.admin_panel_settings_outlined),
              onPressed: () => context.push('/super-admin'),
              tooltip: 'Super admin',
            ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (v) async {
              if (v == 'logout') {
                final ok = await showConfirmDialog(
                  context,
                  title: 'Se déconnecter',
                  message: 'Confirmer la déconnexion ?',
                  confirmLabel: 'Déconnecter',
                );
                if (ok) await AuthService.instance.signOut();
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'logout', child: Text('Se déconnecter')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Profile header
          if (profile != null && !profile.profilComplet)
            _ProfileBanner(profile.position),

          Expanded(
            child: groupsAsync.when(
              loading: () => const AppLoading(message: 'Chargement de tes groupes…'),
              error: (e, _) => Center(child: Text('Erreur: $e')),
              data: (groups) {
                if (groups.isEmpty) {
                  return EmptyState(
                    icon: Icons.group_outlined,
                    title: 'Aucun groupe',
                    subtitle: 'Rejoins ou crée un groupe pour commencer',
                    action: _JoinCreateButtons(userId: user.uid),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(userGroupsProvider(user.uid)),
                  color: AppColors.primary,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final entry in groups)
                        _GroupCard(
                          group: entry['group'] as GroupModel,
                          player: entry['player'] as PlayerModel,
                        ),
                      const SizedBox(height: 16),
                      _JoinCreateButtons(userId: user.uid),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileBanner extends StatelessWidget {
  const _ProfileBanner(this.position);
  final String? position;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: AppColors.warning.withOpacity(0.1),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 18),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Complète ton profil pour rejoindre des groupes',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          ),
          TextButton(
            onPressed: () {},
            child: const Text('Compléter'),
          ),
        ],
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.player});
  final GroupModel group;
  final PlayerModel player;

  @override
  Widget build(BuildContext context) {
    final isPending = player.statut == 'pending';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: isPending
            ? null
            : () => context.push('/group/${group.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                  child: Text('⚽', style: TextStyle(fontSize: 22)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            group.nom,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        if (isPending)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text('En attente',
                                style: TextStyle(color: AppColors.warning, fontSize: 11)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          '${player.impactRating} IR',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${player.matchsJoues} match${player.matchsJoues != 1 ? 's' : ''}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (!isPending) const Icon(Icons.chevron_right, color: AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}

class _JoinCreateButtons extends ConsumerStatefulWidget {
  const _JoinCreateButtons({required this.userId});
  final String userId;

  @override
  ConsumerState<_JoinCreateButtons> createState() => _JoinCreateButtonsState();
}

class _JoinCreateButtonsState extends ConsumerState<_JoinCreateButtons> {
  bool _loading = false;

  Future<void> _joinGroup() async {
    final profile = ref.read(userProfileProvider).valueOrNull;
    if (profile == null || !profile.profilComplet) {
      showSnackBar(context, 'Complète ton profil avant de rejoindre un groupe', isError: true);
      return;
    }

    final codeCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rejoindre un groupe'),
        content: TextField(
          controller: codeCtrl,
          decoration: const InputDecoration(
            labelText: 'Code d\'invitation (6 lettres)',
            hintText: 'ex: ABC123',
          ),
          textCapitalization: TextCapitalization.characters,
          maxLength: 6,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Rejoindre')),
        ],
      ),
    );

    if (ok != true || codeCtrl.text.isEmpty) return;

    setState(() => _loading = true);
    try {
      await GroupService.instance.joinGroup(
        codeCtrl.text.trim(),
        widget.userId,
        profile.displayName,
        profile.position,
      );
      if (mounted) showSnackBar(context, 'Demande envoyée ! En attente de validation.');
    } catch (e) {
      if (mounted) showSnackBar(context, e.toString().replaceFirst('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createGroup() async {
    final profile = ref.read(userProfileProvider).valueOrNull;
    final user = ref.read(authStateProvider).valueOrNull;
    if (profile == null || user == null) return;

    final nomCtrl = TextEditingController();
    int maxJoueurs = 10;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => AlertDialog(
          title: const Text('Créer un groupe'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nomCtrl,
                decoration: const InputDecoration(labelText: 'Nom du groupe'),
                textCapitalization: TextCapitalization.sentences,
                maxLength: 30,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('Max joueurs : '),
                  const SizedBox(width: 8),
                  DropdownButton<int>(
                    value: maxJoueurs,
                    items: [6, 8, 10, 12, 14, 16, 18, 20, 22]
                        .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                        .toList(),
                    onChanged: (v) => setSt(() => maxJoueurs = v ?? 10),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Créer')),
          ],
        ),
      ),
    );

    if (ok != true || nomCtrl.text.trim().isEmpty) return;

    setState(() => _loading = true);
    try {
      final groupId = await GroupService.instance.createGroup(
        nomCtrl.text.trim(),
        maxJoueurs,
        user.uid,
        profile.displayName,
        profile.position,
      );
      if (mounted) context.push('/group/$groupId/admin');
    } catch (e) {
      if (mounted) showSnackBar(context, 'Erreur: $e', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ElevatedButton.icon(
          onPressed: _loading ? null : _joinGroup,
          icon: const Icon(Icons.login),
          label: const Text('Rejoindre un groupe'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _loading ? null : _createGroup,
          icon: const Icon(Icons.add),
          label: const Text('Créer un groupe'),
        ),
      ],
    );
  }
}
