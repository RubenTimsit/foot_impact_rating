import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../screens/splash_screen.dart';
import '../screens/login_screen.dart';
import '../screens/home_screen.dart';
import '../screens/group/group_screen.dart';
import '../screens/admin/admin_screen.dart';
import '../screens/super_admin_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(authChangeNotifierProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = ref.read(authStateProvider);
      final isLoading = authState is AsyncLoading;
      if (isLoading) return null;

      final user = authState.valueOrNull;
      final isLoggedIn = user != null;
      final loc = state.matchedLocation;

      final publicRoutes = ['/login', '/splash'];
      if (!isLoggedIn && !publicRoutes.contains(loc)) return '/login';
      if (isLoggedIn && loc == '/login') return '/home';
      if (isLoggedIn && loc == '/splash') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (ctx, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (ctx, _) => const LoginScreen()),
      GoRoute(path: '/home', builder: (ctx, _) => const HomeScreen()),
      GoRoute(
        path: '/group/:groupId',
        builder: (ctx, state) => GroupScreen(groupId: state.pathParameters['groupId']!),
      ),
      GoRoute(
        path: '/group/:groupId/admin',
        builder: (ctx, state) => AdminGroupScreen(groupId: state.pathParameters['groupId']!),
      ),
      GoRoute(path: '/super-admin', builder: (ctx, _) => const SuperAdminScreen()),
    ],
  );
});
