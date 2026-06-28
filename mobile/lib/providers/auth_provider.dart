import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user_model.dart';
import '../services/auth_service.dart';

// Raw Firebase auth stream — drives router redirects
final authStateProvider = StreamProvider<User?>((ref) {
  return AuthService.instance.authStateChanges;
});

// Full user Firestore profile
final userProfileProvider = StreamProvider<UserModel?>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return const Stream.empty();
  return AuthService.instance.watchUserProfile(user.uid);
});

// Super admin flag — cached per session
final isSuperAdminProvider = FutureProvider<bool>((ref) async {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return false;
  return AuthService.instance.isSuperAdmin(user.uid);
});

/// A ChangeNotifier that wraps Firebase auth state changes so GoRouter
/// can listen to it via `refreshListenable`.
class AuthChangeNotifier extends ChangeNotifier {
  late final StreamSubscription<User?> _sub;

  AuthChangeNotifier() {
    _sub = FirebaseAuth.instance.authStateChanges().listen((_) {
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

final authChangeNotifierProvider = Provider<AuthChangeNotifier>((ref) {
  final n = AuthChangeNotifier();
  ref.onDispose(n.dispose);
  return n;
});
