import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/theme.dart';

class PlayerAvatar extends StatelessWidget {
  const PlayerAvatar({
    super.key,
    this.photoUrl,
    required this.name,
    this.radius = 20,
  });

  final String? photoUrl;
  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final initials = _getInitials(name);
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.surfaceHigh,
      child: photoUrl != null
          ? ClipOval(
              child: CachedNetworkImage(
                imageUrl: photoUrl!,
                width: radius * 2,
                height: radius * 2,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => _Initials(initials, radius),
              ),
            )
          : _Initials(initials, radius),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}

class _Initials extends StatelessWidget {
  const _Initials(this.text, this.radius);
  final String text;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        color: AppColors.primary,
        fontWeight: FontWeight.w600,
        fontSize: radius * 0.7,
      ),
    );
  }
}
