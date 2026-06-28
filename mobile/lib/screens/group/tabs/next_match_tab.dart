import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants.dart';
import '../../../core/theme.dart';
import '../../../models/weekly_match_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/group_provider.dart';
import '../../../services/match_service.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/confirm_dialog.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/position_chip.dart';

class NextMatchTab extends ConsumerWidget {
  const NextMatchTab({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nextMatchAsync = ref.watch(nextMatchProvider(groupId));

    return nextMatchAsync.when(
      loading: () => const AppLoading(),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (match) {
        if (match == null || match.isClosed) {
          return const EmptyState(
            icon: Icons.event_outlined,
            title: 'Aucun créneau disponible',
            subtitle: 'L\'admin créera le prochain créneau',
          );
        }
        return _MatchSlotView(match: match, groupId: groupId);
      },
    );
  }
}

class _MatchSlotView extends ConsumerStatefulWidget {
  const _MatchSlotView({required this.match, required this.groupId});
  final WeeklyMatchModel match;
  final String groupId;

  @override
  ConsumerState<_MatchSlotView> createState() => _MatchSlotViewState();
}

class _MatchSlotViewState extends ConsumerState<_MatchSlotView> {
  bool _loading = false;
  Timer? _timer;
  Duration _timeRemaining = Duration.zero;

  @override
  void initState() {
    super.initState();
    _updateTimer();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _updateTimer());
  }

  void _updateTimer() {
    if (!mounted) return;
    final target = widget.match.isOpen
        ? widget.match.dateMatch
        : widget.match.dateOuvertureInscription;
    final remaining = target.difference(DateTime.now());
    setState(() => _timeRemaining = remaining.isNegative ? Duration.zero : remaining);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _toggleSignUp(bool isRegistered, String uid, String displayName, String? position) async {
    setState(() => _loading = true);
    try {
      if (isRegistered) {
        final ok = await showConfirmDialog(
          context,
          title: 'Se désinscrire',
          message: 'Confirmer la désinscription ?',
          confirmLabel: 'Désinscrire',
          destructive: true,
        );
        if (!ok) { setState(() => _loading = false); return; }
        await MatchService.instance.cancelSignUp(
          groupId: widget.groupId,
          matchId: widget.match.id,
          uid: uid,
        );
        if (mounted) showSnackBar(context, 'Désinscription effectuée');
      } else {
        await MatchService.instance.signUp(
          groupId: widget.groupId,
          matchId: widget.match.id,
          uid: uid,
          displayName: displayName,
          position: position,
          maxJoueurs: widget.match.maxJoueurs,
          confirmedCount: widget.match.confirmedCount,
        );
        if (mounted) showSnackBar(context, widget.match.isFull
            ? 'Inscrit sur liste d\'attente'
            : 'Inscrit !');
      }
    } catch (e) {
      if (mounted) showSnackBar(context, e.toString().replaceFirst('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatDuration(Duration d) {
    if (d.inDays > 0) return '${d.inDays}j ${d.inHours.remainder(24)}h';
    if (d.inHours > 0) return '${d.inHours}h ${d.inMinutes.remainder(60)}min';
    return '${d.inMinutes}min ${d.inSeconds.remainder(60)}s';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).valueOrNull;
    final profile = ref.watch(userProfileProvider).valueOrNull;
    final inscriptionsAsync = user == null
        ? null
        : ref.watch(inscriptionsProvider((groupId: widget.groupId, matchId: widget.match.id)));

    final inscriptions = inscriptionsAsync?.valueOrNull ?? [];
    final confirmed = inscriptions.where((i) => i.isConfirmed).toList();
    final waitlist = inscriptions.where((i) => !i.isConfirmed).toList();

    final myInscription = user != null
        ? inscriptions.cast<InscriptionModel?>().firstWhere(
              (i) => i?.uid == user.uid,
              orElse: () => null,
            )
        : null;

    final isRegistered = myInscription != null;
    final isOnWaitlist = myInscription?.statut == InscriptionStatus.attente;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Match info card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.divider),
            ),
            child: Column(
              children: [
                Text(
                  DateFormat('EEEE d MMMM', 'fr_FR').format(widget.match.dateMatch),
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  DateFormat('HH:mm').format(widget.match.dateMatch),
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 32,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _InfoChip(
                      icon: Icons.people_outline,
                      label: '${widget.match.confirmedCount}/${widget.match.maxJoueurs}',
                    ),
                    const SizedBox(width: 12),
                    _InfoChip(
                      icon: widget.match.isOpen ? Icons.lock_open : Icons.lock,
                      label: widget.match.isOpen ? 'Inscriptions ouvertes' : 'Pas encore ouvert',
                      color: widget.match.isOpen ? AppColors.success : AppColors.textSecondary,
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Countdown
          if (!widget.match.isOpen && _timeRemaining > Duration.zero)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.timer_outlined, color: AppColors.primary, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Inscriptions dans : ${_formatDuration(_timeRemaining)}',
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),

          // CTA button
          if (widget.match.isOpen && user != null) ...[
            const SizedBox(height: 16),
            if (isRegistered)
              OutlinedButton(
                onPressed: _loading
                    ? null
                    : () => _toggleSignUp(true, user.uid, '', null),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.error),
                ),
                child: Text(isOnWaitlist ? 'Quitter la liste d\'attente' : 'Se désinscrire'),
              )
            else
              ElevatedButton(
                onPressed: _loading
                    ? null
                    : () => _toggleSignUp(
                          false,
                          user.uid,
                          profile?.displayName ?? '',
                          profile?.position,
                        ),
                child: _loading
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(widget.match.isFull
                        ? 'Rejoindre la liste d\'attente'
                        : 'S\'inscrire'),
              ),

            // Status badge
            if (isRegistered) ...[
              const SizedBox(height: 8),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isOnWaitlist
                        ? AppColors.warning.withOpacity(0.12)
                        : AppColors.success.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isOnWaitlist ? '⏳ Liste d\'attente' : '✅ Tu es inscrit',
                    style: TextStyle(
                      color: isOnWaitlist ? AppColors.warning : AppColors.success,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ],

          const SizedBox(height: 24),

          // Confirmed list
          if (confirmed.isNotEmpty) ...[
            Text(
              'Inscrits confirmés (${confirmed.length}/${widget.match.maxJoueurs})',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            ...confirmed.asMap().entries.map((e) => _InscriptionTile(
                  inscription: e.value,
                  rank: e.key + 1,
                )),
          ],

          // Waitlist
          if (waitlist.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'Liste d\'attente (${waitlist.length})',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            ...waitlist.asMap().entries.map((e) => _InscriptionTile(
                  inscription: e.value,
                  rank: e.key + 1,
                  isWaitlist: true,
                )),
          ],
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label, this.color});
  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textSecondary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: c),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: c, fontSize: 13, fontWeight: FontWeight.w500)),
      ],
    );
  }
}

class _InscriptionTile extends StatelessWidget {
  const _InscriptionTile({required this.inscription, required this.rank, this.isWaitlist = false});
  final InscriptionModel inscription;
  final int rank;
  final bool isWaitlist;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            child: Text(
              isWaitlist ? '${rank}.' : '$rank.',
              style: TextStyle(
                color: isWaitlist ? AppColors.textDisabled : AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              inscription.displayName,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: isWaitlist ? AppColors.textSecondary : AppColors.textPrimary,
                  ),
            ),
          ),
          PositionChip(position: inscription.position, small: true),
          if (isWaitlist) ...[
            const SizedBox(width: 6),
            const Icon(Icons.hourglass_empty, size: 14, color: AppColors.warning),
          ],
        ],
      ),
    );
  }
}
