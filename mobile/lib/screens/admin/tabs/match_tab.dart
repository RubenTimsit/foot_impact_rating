import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme.dart';
import '../../../models/player_model.dart';
import '../../../models/weekly_match_model.dart';
import '../../../providers/group_provider.dart';
import '../../../services/match_service.dart';
import '../../../utils/rating_system.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/confirm_dialog.dart';
import '../../../widgets/position_chip.dart';
import '../../../widgets/rating_change_badge.dart';

enum _TeamAssignment { none, teamA, teamB }

class MatchTab extends ConsumerStatefulWidget {
  const MatchTab({super.key, required this.groupId});
  final String groupId;

  @override
  ConsumerState<MatchTab> createState() => _MatchTabState();
}

class _MatchTabState extends ConsumerState<MatchTab> {
  // Team assignment per player
  final Map<String, _TeamAssignment> _assignments = {};
  int _scoreA = 0;
  int _scoreB = 0;
  bool _loading = false;
  bool _submitted = false;
  Map<String, RatingResult>? _results;

  // Manual slot creation
  DateTime? _slotDate;
  TimeOfDay? _slotTime;
  int _slotMax = 10;
  bool _creatingSlot = false;

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(activePlayersProvider(widget.groupId));
    final nextMatchAsync = ref.watch(nextMatchProvider(widget.groupId));

    if (_submitted && _results != null) {
      return _ResultsView(
        results: _results!,
        scoreA: _scoreA,
        scoreB: _scoreB,
        onReset: () => setState(() {
          _submitted = false;
          _results = null;
          _assignments.clear();
          _scoreA = 0;
          _scoreB = 0;
        }),
        players: (playersAsync.valueOrNull ?? []),
      );
    }

    return playersAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (players) => SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Manual slot creation ──────────────────────────────
            _SlotCard(
              groupId: widget.groupId,
              nextMatch: nextMatchAsync.valueOrNull,
            ),

            const SizedBox(height: 24),

            // ── Active inscriptions (if open slot exists) ────────
            if (nextMatchAsync.valueOrNull?.isOpen ?? false)
              _InscriptionsCard(
                groupId: widget.groupId,
                matchId: nextMatchAsync.value!.id,
                players: players,
                onImport: (selected) {
                  setState(() {
                    _assignments.clear();
                    for (final p in players) {
                      if (selected.contains(p.id)) {
                        _assignments[p.id] = _TeamAssignment.none;
                      }
                    }
                  });
                },
              ),

            const Divider(height: 32),

            // ── Match result form ─────────────────────────────────
            Text('Saisir un résultat', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              'Assigne chaque joueur à une équipe, entre le score, puis valide.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),

            // Player assignment table
            ...players.map((p) => _PlayerAssignRow(
                  player: p,
                  assignment: _assignments[p.id] ?? _TeamAssignment.none,
                  onChanged: (val) => setState(() => _assignments[p.id] = val),
                )),

            const SizedBox(height: 20),

            // Score input
            _ScoreInput(
              scoreA: _scoreA,
              scoreB: _scoreB,
              onChangeA: (v) => setState(() => _scoreA = v),
              onChangeB: (v) => setState(() => _scoreB = v),
            ),

            const SizedBox(height: 20),

            ElevatedButton.icon(
              onPressed: _loading ? null : () => _submitMatch(players, nextMatchAsync.valueOrNull),
              icon: const Icon(Icons.sports_soccer),
              label: _loading
                  ? const SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Valider le match'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submitMatch(List<PlayerModel> players, WeeklyMatchModel? openSlot) async {
    final teamA = players.where((p) => _assignments[p.id] == _TeamAssignment.teamA).toList();
    final teamB = players.where((p) => _assignments[p.id] == _TeamAssignment.teamB).toList();

    if (teamA.isEmpty || teamB.isEmpty) {
      showSnackBar(context, 'Assigne des joueurs aux deux équipes', isError: true);
      return;
    }
    if (teamA.length < 2 || teamB.length < 2) {
      showSnackBar(context, 'Il faut au minimum 2 joueurs par équipe', isError: true);
      return;
    }

    final ok = await showConfirmDialog(
      context,
      title: 'Valider le match',
      message: 'Équipe A $teamA vs Équipe B, ${_scoreA} — ${_scoreB} ?',
      confirmLabel: 'Valider',
    );
    if (!ok) return;

    setState(() => _loading = true);
    try {
      final results = await MatchService.instance.recordMatch(
        groupId: widget.groupId,
        equipeA: teamA,
        equipeB: teamB,
        scoreA: _scoreA,
        scoreB: _scoreB,
        matchSemaineId: openSlot?.id,
      );
      setState(() {
        _results = results;
        _submitted = true;
      });
    } catch (e) {
      if (mounted) showSnackBar(context, e.toString().replaceFirst('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _PlayerAssignRow extends StatelessWidget {
  const _PlayerAssignRow({
    required this.player,
    required this.assignment,
    required this.onChanged,
  });

  final PlayerModel player;
  final _TeamAssignment assignment;
  final ValueChanged<_TeamAssignment> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: assignment == _TeamAssignment.teamA
            ? AppColors.teamAContainer
            : assignment == _TeamAssignment.teamB
                ? AppColors.teamBContainer
                : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                PositionChip(position: player.position, small: true),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    player.displayName,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(fontSize: 14),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          // Team toggle
          _TeamToggle(
            assignment: assignment,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

class _TeamToggle extends StatelessWidget {
  const _TeamToggle({required this.assignment, required this.onChanged});
  final _TeamAssignment assignment;
  final ValueChanged<_TeamAssignment> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ToggleBtn(
          label: 'A',
          color: AppColors.teamA,
          selected: assignment == _TeamAssignment.teamA,
          onTap: () => onChanged(assignment == _TeamAssignment.teamA
              ? _TeamAssignment.none
              : _TeamAssignment.teamA),
        ),
        const SizedBox(width: 4),
        _ToggleBtn(
          label: 'B',
          color: AppColors.teamB,
          selected: assignment == _TeamAssignment.teamB,
          onTap: () => onChanged(assignment == _TeamAssignment.teamB
              ? _TeamAssignment.none
              : _TeamAssignment.teamB),
        ),
      ],
    );
  }
}

class _ToggleBtn extends StatelessWidget {
  const _ToggleBtn({
    required this.label,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: selected ? color : color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : color,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }
}

class _ScoreInput extends StatelessWidget {
  const _ScoreInput({
    required this.scoreA,
    required this.scoreB,
    required this.onChangeA,
    required this.onChangeB,
  });

  final int scoreA;
  final int scoreB;
  final ValueChanged<int> onChangeA;
  final ValueChanged<int> onChangeB;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ScoreCounter(
            label: 'Équipe A',
            value: scoreA,
            color: AppColors.teamA,
            onDecrease: () => onChangeA((scoreA - 1).clamp(0, 99)),
            onIncrease: () => onChangeA((scoreA + 1).clamp(0, 99)),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text('—', style: TextStyle(fontSize: 24, color: AppColors.textSecondary)),
          ),
          _ScoreCounter(
            label: 'Équipe B',
            value: scoreB,
            color: AppColors.teamB,
            onDecrease: () => onChangeB((scoreB - 1).clamp(0, 99)),
            onIncrease: () => onChangeB((scoreB + 1).clamp(0, 99)),
          ),
        ],
      ),
    );
  }
}

class _ScoreCounter extends StatelessWidget {
  const _ScoreCounter({
    required this.label,
    required this.value,
    required this.color,
    required this.onDecrease,
    required this.onIncrease,
  });

  final String label;
  final int value;
  final Color color;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
        const SizedBox(height: 8),
        Row(
          children: [
            _CircleBtn(icon: Icons.remove, onTap: onDecrease),
            const SizedBox(width: 12),
            Text(
              '$value',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 32,
              ),
            ),
            const SizedBox(width: 12),
            _CircleBtn(icon: Icons.add, onTap: onIncrease),
          ],
        ),
      ],
    );
  }
}

class _CircleBtn extends StatelessWidget {
  const _CircleBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.surfaceHigh,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Icon(icon, size: 18, color: AppColors.textPrimary),
      ),
    );
  }
}

class _ResultsView extends StatelessWidget {
  const _ResultsView({
    required this.results,
    required this.scoreA,
    required this.scoreB,
    required this.onReset,
    required this.players,
  });

  final Map<String, RatingResult> results;
  final int scoreA;
  final int scoreB;
  final VoidCallback onReset;
  final List<PlayerModel> players;

  @override
  Widget build(BuildContext context) {
    final playerMap = {for (final p in players) p.id: p};
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.divider),
            ),
            child: Column(
              children: [
                Text('✅ Match enregistré', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  '$scoreA — $scoreB',
                  style: const TextStyle(
                    fontSize: 40,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text('Changements de rating', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...results.entries.map((e) {
            final player = playerMap[e.key];
            if (player == null) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Row(
                  children: [
                    Expanded(child: Text(player.displayName, style: Theme.of(context).textTheme.labelLarge)),
                    Text('${e.value.ancien}', style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(width: 8),
                    RatingChangeBadge(change: e.value.changement, large: true),
                    const SizedBox(width: 8),
                    Text('${e.value.nouveau}',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: onReset,
            icon: const Icon(Icons.arrow_back),
            label: const Text('Saisir un autre match'),
          ),
        ],
      ),
    );
  }
}

// ─── Slot card ───────────────────────────────────────────────────────────────

class _SlotCard extends ConsumerStatefulWidget {
  const _SlotCard({required this.groupId, this.nextMatch});
  final String groupId;
  final WeeklyMatchModel? nextMatch;

  @override
  ConsumerState<_SlotCard> createState() => _SlotCardState();
}

class _SlotCardState extends ConsumerState<_SlotCard> {
  bool _expanded = false;
  DateTime? _date;
  TimeOfDay _time = const TimeOfDay(hour: 20, minute: 0);
  int _max = 10;
  bool _loading = false;

  Future<void> _create() async {
    if (_date == null) {
      showSnackBar(context, 'Choisis une date', isError: true);
      return;
    }
    final dt = DateTime(_date!.year, _date!.month, _date!.day, _time.hour, _time.minute);
    if (dt.isBefore(DateTime.now())) {
      showSnackBar(context, 'La date doit être dans le futur', isError: true);
      return;
    }

    setState(() => _loading = true);
    try {
      await MatchService.instance.createManualSlot(
        groupId: widget.groupId,
        dateMatch: dt,
        maxJoueurs: _max,
      );
      if (mounted) {
        showSnackBar(context, 'Créneau créé, inscriptions ouvertes !');
        setState(() => _expanded = false);
      }
    } catch (e) {
      if (mounted) showSnackBar(context, 'Erreur: $e', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  const Icon(Icons.calendar_month_outlined, color: AppColors.primary),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text('📅 Créer un créneau manuellement',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  Icon(_expanded ? Icons.expand_less : Icons.expand_more,
                      color: AppColors.textSecondary),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Divider(height: 1),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now().add(const Duration(days: 1)),
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 90)),
                              builder: (ctx, child) => Theme(
                                data: Theme.of(ctx).copyWith(
                                  colorScheme: Theme.of(ctx).colorScheme.copyWith(primary: AppColors.primary),
                                ),
                                child: child!,
                              ),
                            );
                            if (picked != null) setState(() => _date = picked);
                          },
                          icon: const Icon(Icons.calendar_today, size: 16),
                          label: Text(_date == null
                              ? 'Date du match'
                              : DateFormat('dd/MM/yyyy').format(_date!)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () async {
                          final picked = await showTimePicker(
                            context: context,
                            initialTime: _time,
                          );
                          if (picked != null) setState(() => _time = picked);
                        },
                        child: Text(_time.format(context)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Text('Max joueurs : ', style: TextStyle(color: AppColors.textSecondary)),
                      const SizedBox(width: 8),
                      DropdownButton<int>(
                        value: _max,
                        items: [6, 8, 10, 12, 14, 16, 18, 20, 22]
                            .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                            .toList(),
                        onChanged: (v) => setState(() => _max = v ?? 10),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _loading ? null : _create,
                    child: _loading
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('🟢 Ouvrir les inscriptions'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _InscriptionsCard extends ConsumerWidget {
  const _InscriptionsCard({
    required this.groupId,
    required this.matchId,
    required this.players,
    required this.onImport,
  });

  final String groupId;
  final String matchId;
  final List<PlayerModel> players;
  final ValueChanged<Set<String>> onImport;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inscriptionsAsync = ref.watch(
        inscriptionsProvider((groupId: groupId, matchId: matchId)));

    return inscriptionsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (inscriptions) {
        final confirmed = inscriptions.where((i) => i.isConfirmed).toList();
        if (confirmed.isEmpty) return const SizedBox.shrink();

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.divider),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.people_outline, color: AppColors.primary, size: 18),
                  const SizedBox(width: 8),
                  Text('Inscrits (${confirmed.length})',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 14)),
                  const Spacer(),
                  TextButton(
                    onPressed: () => onImport({for (final i in confirmed) i.uid}),
                    child: const Text('Importer pour le match'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ...confirmed.map((i) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Expanded(child: Text(i.displayName, style: Theme.of(context).textTheme.bodyMedium)),
                        PositionChip(position: i.position, small: true),
                      ],
                    ),
                  )),
            ],
          ),
        );
      },
    );
  }
}
