import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../models/group_model.dart';
import '../../../providers/group_provider.dart';
import '../../../services/group_service.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/confirm_dialog.dart';

class SettingsTab extends ConsumerStatefulWidget {
  const SettingsTab({super.key, required this.groupId});
  final String groupId;

  @override
  ConsumerState<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends ConsumerState<SettingsTab> {
  final _nomCtrl = TextEditingController();
  int _maxJoueurs = 10;
  bool _loading = false;
  bool _initialized = false;

  @override
  void dispose() {
    _nomCtrl.dispose();
    super.dispose();
  }

  void _initFrom(GroupModel group) {
    if (!_initialized) {
      _nomCtrl.text = group.nom;
      _maxJoueurs = group.maxJoueursMatch;
      _initialized = true;
    }
  }

  Future<void> _save(GroupModel group) async {
    final nom = _nomCtrl.text.trim();
    if (nom.isEmpty) {
      showSnackBar(context, 'Le nom ne peut pas être vide', isError: true);
      return;
    }
    setState(() => _loading = true);
    try {
      await GroupService.instance.updateGroup(widget.groupId, {
        'nom': nom,
        'maxJoueursMatch': _maxJoueurs,
      });
      if (mounted) showSnackBar(context, 'Paramètres enregistrés');
    } catch (e) {
      if (mounted) showSnackBar(context, 'Erreur: $e', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final groupAsync = ref.watch(groupProvider(widget.groupId));

    return groupAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (group) {
        if (group == null) return const SizedBox.shrink();
        _initFrom(group);

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Group settings ────────────────────────────────────
              Text('Paramètres du groupe', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 16),

              TextFormField(
                controller: _nomCtrl,
                decoration: const InputDecoration(labelText: 'Nom du groupe'),
                maxLength: 30,
                textCapitalization: TextCapitalization.sentences,
              ),

              const SizedBox(height: 12),

              Row(
                children: [
                  const Text('Max joueurs par match : ', style: TextStyle(color: AppColors.textSecondary)),
                  const SizedBox(width: 8),
                  DropdownButton<int>(
                    value: _maxJoueurs,
                    items: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 30]
                        .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                        .toList(),
                    onChanged: (v) => setState(() => _maxJoueurs = v ?? 10),
                  ),
                ],
              ),

              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _loading ? null : () => _save(group),
                child: _loading
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Enregistrer'),
              ),

              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 16),

              // ── Weekly configs ────────────────────────────────────
              Row(
                children: [
                  Text('Créneaux récurrents', style: Theme.of(context).textTheme.titleMedium),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => _showAddConfigDialog(context),
                    icon: const Icon(Icons.add),
                    label: const Text('Ajouter'),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (group.configHebdos.isEmpty)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Text(
                    'Aucun créneau récurrent. Ajoute-en un pour automatiser les ouvertures d\'inscriptions.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                )
              else
                ...group.configHebdos.entries.map((e) => _WeeklyConfigCard(
                      groupId: widget.groupId,
                      configId: e.key,
                      config: e.value,
                    )),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showAddConfigDialog(BuildContext context) async {
    final jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    int matchJour = 5; // Vendredi
    String matchHeure = '20:00';
    int inscriptionJour = 1; // Lundi
    String inscriptionHeure = '08:00';
    int maxJoueurs = 10;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => AlertDialog(
          title: const Text('Nouveau créneau récurrent'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Jour du match'),
                DropdownButton<int>(
                  value: matchJour,
                  isExpanded: true,
                  items: List.generate(7, (i) => DropdownMenuItem(value: i, child: Text(jours[i]))),
                  onChanged: (v) => setSt(() => matchJour = v ?? 5),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: matchHeure,
                  decoration: const InputDecoration(labelText: 'Heure du match (HH:mm)'),
                  onChanged: (v) => matchHeure = v,
                ),
                const SizedBox(height: 12),
                const Text('Ouverture inscriptions — Jour'),
                DropdownButton<int>(
                  value: inscriptionJour,
                  isExpanded: true,
                  items: List.generate(7, (i) => DropdownMenuItem(value: i, child: Text(jours[i]))),
                  onChanged: (v) => setSt(() => inscriptionJour = v ?? 1),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  initialValue: inscriptionHeure,
                  decoration: const InputDecoration(labelText: 'Heure d\'ouverture (HH:mm)'),
                  onChanged: (v) => inscriptionHeure = v,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text('Max joueurs : '),
                    const SizedBox(width: 8),
                    DropdownButton<int>(
                      value: maxJoueurs,
                      items: [6, 8, 10, 12, 14, 16, 18, 20]
                          .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                          .toList(),
                      onChanged: (v) => setSt(() => maxJoueurs = v ?? 10),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Ajouter')),
          ],
        ),
      ),
    );

    if (ok != true) return;

    try {
      await GroupService.instance.addWeeklyConfig(widget.groupId, {
        'actif': true,
        'matchJour': matchJour,
        'matchHeure': matchHeure,
        'inscriptionJour': inscriptionJour,
        'inscriptionHeure': inscriptionHeure,
        'maxJoueurs': maxJoueurs,
      });
      if (mounted) showSnackBar(context, 'Créneau récurrent ajouté');
    } catch (e) {
      if (mounted) showSnackBar(context, 'Erreur: $e', isError: true);
    }
  }
}

class _WeeklyConfigCard extends StatelessWidget {
  const _WeeklyConfigCard({
    required this.groupId,
    required this.configId,
    required this.config,
  });

  final String groupId;
  final String configId;
  final WeeklyConfig config;

  static const _jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: config.actif ? AppColors.primary.withOpacity(0.3) : AppColors.divider),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_jours[config.matchJour]} ${config.matchHeure}',
                  style: Theme.of(context).textTheme.labelLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  'Inscriptions : ${_jours[config.inscriptionJour]} ${config.inscriptionHeure} • Max ${config.maxJoueurs}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Switch(
            value: config.actif,
            activeColor: AppColors.primary,
            onChanged: (v) => GroupService.instance.toggleWeeklyConfig(groupId, configId, v),
          ),
        ],
      ),
    );
  }
}
