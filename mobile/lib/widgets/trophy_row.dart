import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/player_model.dart';

class TrophyRow extends StatelessWidget {
  const TrophyRow({super.key, required this.trophees, this.compact = false});

  final TropheeCount trophees;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (trophees.total == 0 && compact) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (trophees.or > 0) _Trophy('🥇', trophees.or, AppColors.gold),
        if (trophees.argent > 0) _Trophy('🥈', trophees.argent, AppColors.silver),
        if (trophees.bronze > 0) _Trophy('🥉', trophees.bronze, AppColors.bronze),
        if (trophees.total == 0)
          Text(
            '—',
            style: TextStyle(color: AppColors.textDisabled, fontSize: compact ? 11 : 13),
          ),
      ],
    );
  }
}

class _Trophy extends StatelessWidget {
  const _Trophy(this.emoji, this.count, this.color);
  final String emoji;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 2),
          Text(
            '$count',
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
