import 'package:flutter/material.dart';
import '../core/theme.dart';

class RatingChangeBadge extends StatelessWidget {
  const RatingChangeBadge({super.key, required this.change, this.large = false});

  final int change;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final isPositive = change > 0;
    final isNeutral = change == 0;
    final color = isNeutral
        ? AppColors.textSecondary
        : isPositive
            ? AppColors.ratingUp
            : AppColors.ratingDown;
    final sign = isPositive ? '+' : '';
    final size = large ? 14.0 : 12.0;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 10 : 6, vertical: large ? 4 : 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        '$sign$change',
        style: TextStyle(
          color: color,
          fontSize: size,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
