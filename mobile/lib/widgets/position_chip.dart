import 'package:flutter/material.dart';
import '../core/theme.dart';

class PositionChip extends StatelessWidget {
  const PositionChip({super.key, required this.position, this.small = false});

  final String? position;
  final bool small;

  @override
  Widget build(BuildContext context) {
    if (position == null) return const SizedBox.shrink();
    final color = _colorFor(position!);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 6 : 8, vertical: small ? 2 : 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        _labelFor(position!),
        style: TextStyle(
          color: color,
          fontSize: small ? 10 : 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  static Color _colorFor(String pos) {
    switch (pos) {
      case 'Gardien':
        return const Color(0xFFFFB300);
      case 'Défenseur':
        return const Color(0xFF4FC3F7);
      case 'Milieu':
        return const Color(0xFF2ECC71);
      case 'Attaquant':
        return const Color(0xFFFF7043);
      default:
        return AppColors.textSecondary;
    }
  }

  static String _labelFor(String pos) {
    switch (pos) {
      case 'Gardien':
        return 'G';
      case 'Défenseur':
        return 'DEF';
      case 'Milieu':
        return 'MIL';
      case 'Attaquant':
        return 'ATT';
      default:
        return pos.substring(0, 1);
    }
  }
}
