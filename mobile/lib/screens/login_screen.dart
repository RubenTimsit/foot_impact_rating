import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme.dart';
import '../services/auth_service.dart';

enum _LoginMode { login, register, forgotPassword }

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  _LoginMode _mode = _LoginMode.login;
  bool _loading = false;
  String? _error;
  String? _success;

  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  bool _showPass = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging) {
        setState(() {
          _mode = _tabs.index == 0 ? _LoginMode.login : _LoginMode.register;
          _error = null;
          _success = null;
        });
      }
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _nameCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _signInWithGoogle() async {
    setState(() { _loading = true; _error = null; });
    try {
      await AuthService.instance.signInWithGoogle();
      // Router redirect handles navigation
    } catch (e) {
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _submitEmail() async {
    final email = _emailCtrl.text.trim();
    final pass = _passCtrl.text;

    if (email.isEmpty || pass.isEmpty) {
      setState(() { _error = 'Remplis tous les champs'; });
      return;
    }

    if (_mode == _LoginMode.register) {
      final name = _nameCtrl.text.trim();
      final confirm = _confirmPassCtrl.text;
      if (name.isEmpty) { setState(() { _error = 'Entrez votre prénom'; }); return; }
      if (pass != confirm) { setState(() { _error = 'Les mots de passe ne correspondent pas'; }); return; }
      if (pass.length < 6) { setState(() { _error = 'Mot de passe trop court (min 6 caractères)'; }); return; }
    }

    setState(() { _loading = true; _error = null; });
    try {
      if (_mode == _LoginMode.login) {
        await AuthService.instance.signInWithEmail(email, pass);
      } else {
        await AuthService.instance.registerWithEmail(email, pass, _nameCtrl.text.trim());
      }
    } catch (e) {
      setState(() { _error = _friendlyError(e.toString()); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _resetPassword() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() { _error = 'Entrez votre email'; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await AuthService.instance.sendPasswordReset(email);
      setState(() { _success = 'Email de réinitialisation envoyé !'; _mode = _LoginMode.login; });
    } catch (e) {
      setState(() { _error = _friendlyError(e.toString()); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  String _friendlyError(String raw) {
    if (raw.contains('user-not-found') || raw.contains('wrong-password') || raw.contains('invalid-credential')) {
      return 'Email ou mot de passe incorrect';
    }
    if (raw.contains('email-already-in-use')) return 'Cet email est déjà utilisé';
    if (raw.contains('invalid-email')) return 'Email invalide';
    if (raw.contains('network-request-failed')) return 'Pas de connexion internet';
    return 'Une erreur est survenue. Réessaie.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              // Logo
              Center(
                child: Column(
                  children: [
                    Text('⚽', style: const TextStyle(fontSize: 52)),
                    const SizedBox(height: 12),
                    Text('Impact Rating',
                        style: Theme.of(context).textTheme.displayMedium),
                    const SizedBox(height: 4),
                    Text('Football entre amis',
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
              const SizedBox(height: 40),

              // Tabs
              if (_mode != _LoginMode.forgotPassword)
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TabBar(
                    controller: _tabs,
                    indicator: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    indicatorPadding: const EdgeInsets.all(4),
                    dividerColor: Colors.transparent,
                    labelColor: Colors.white,
                    unselectedLabelColor: AppColors.textSecondary,
                    tabs: const [
                      Tab(text: 'Connexion'),
                      Tab(text: 'Inscription'),
                    ],
                  ),
                ),

              if (_mode == _LoginMode.forgotPassword)
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back),
                      onPressed: () => setState(() { _mode = _LoginMode.login; _error = null; }),
                    ),
                    Text('Réinitialiser le mot de passe',
                        style: Theme.of(context).textTheme.titleMedium),
                  ],
                ),

              const SizedBox(height: 28),

              // Error / Success
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.error.withOpacity(0.3)),
                  ),
                  child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
                ),

              if (_success != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(_success!, style: const TextStyle(color: AppColors.success, fontSize: 13)),
                ),

              // Form
              if (_mode == _LoginMode.register) ...[
                TextFormField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Prénom',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textCapitalization: TextCapitalization.words,
                ),
                const SizedBox(height: 14),
              ],

              TextFormField(
                controller: _emailCtrl,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
              ),

              if (_mode != _LoginMode.forgotPassword) ...[
                const SizedBox(height: 14),
                TextFormField(
                  controller: _passCtrl,
                  obscureText: !_showPass,
                  decoration: InputDecoration(
                    labelText: 'Mot de passe',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_showPass ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() { _showPass = !_showPass; }),
                    ),
                  ),
                ),
              ],

              if (_mode == _LoginMode.register) ...[
                const SizedBox(height: 14),
                TextFormField(
                  controller: _confirmPassCtrl,
                  obscureText: !_showPass,
                  decoration: const InputDecoration(
                    labelText: 'Confirmer le mot de passe',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                ),
              ],

              if (_mode == _LoginMode.login) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => setState(() { _mode = _LoginMode.forgotPassword; _error = null; }),
                    child: const Text('Mot de passe oublié ?'),
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // Submit
              ElevatedButton(
                onPressed: _loading
                    ? null
                    : (_mode == _LoginMode.forgotPassword ? _resetPassword : _submitEmail),
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(_mode == _LoginMode.forgotPassword
                        ? 'Envoyer le lien'
                        : _mode == _LoginMode.register
                            ? 'Créer mon compte'
                            : 'Se connecter'),
              ),

              if (_mode != _LoginMode.forgotPassword) ...[
                const SizedBox(height: 20),
                Row(
                  children: [
                    const Expanded(child: Divider()),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('ou', style: Theme.of(context).textTheme.bodySmall),
                    ),
                    const Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 16),

                // Google sign-in
                OutlinedButton.icon(
                  onPressed: _loading ? null : _signInWithGoogle,
                  icon: const Text('G', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
                  label: const Text('Continuer avec Google'),
                ),
              ],

              const SizedBox(height: 32),
              Center(
                child: TextButton(
                  onPressed: () {},
                  child: const Text('Politique de confidentialité',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
