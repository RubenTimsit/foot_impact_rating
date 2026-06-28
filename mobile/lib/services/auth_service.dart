import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../core/constants.dart';
import '../models/user_model.dart';

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  final _auth = FirebaseAuth.instance;
  final _db = FirebaseFirestore.instance;
  final _googleSignIn = GoogleSignIn();

  User? get currentUser => _auth.currentUser;
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  // ──────────────────────────────────────────────────────────────
  // Sign-in
  // ──────────────────────────────────────────────────────────────

  Future<User> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) throw Exception('Connexion Google annulée');

    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    final result = await _auth.signInWithCredential(credential);
    await _syncUserProfile(result.user!);
    return result.user!;
  }

  Future<User> signInWithEmail(String email, String password) async {
    final result = await _auth.signInWithEmailAndPassword(email: email, password: password);
    await _syncUserProfile(result.user!);
    return result.user!;
  }

  Future<User> registerWithEmail(String email, String password, String displayName) async {
    final result = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    await result.user!.updateDisplayName(displayName);
    await _syncUserProfile(result.user!, displayNameOverride: displayName);
    return result.user!;
  }

  Future<void> sendPasswordReset(String email) async {
    await _auth.sendPasswordResetEmail(email: email);
  }

  Future<void> signOut() async {
    await Future.wait([_auth.signOut(), _googleSignIn.signOut()]);
  }

  // ──────────────────────────────────────────────────────────────
  // User profile
  // ──────────────────────────────────────────────────────────────

  Future<void> _syncUserProfile(User user, {String? displayNameOverride}) async {
    final ref = _db.collection(Collections.users).doc(user.uid);
    final snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        'displayName': displayNameOverride ?? user.displayName ?? '',
        'email': user.email ?? '',
        'photoURL': user.photoURL,
        'position': null,
        'profilMilieu': null,
        'dateInscription': DateTime.now().toIso8601String(),
        'profilComplet': false,
      });
    }
  }

  Future<UserModel?> getUserProfile(String uid) async {
    final snap = await _db.collection(Collections.users).doc(uid).get();
    if (!snap.exists) return null;
    return UserModel.fromFirestore(snap);
  }

  Stream<UserModel?> watchUserProfile(String uid) {
    return _db
        .collection(Collections.users)
        .doc(uid)
        .snapshots()
        .map((snap) => snap.exists ? UserModel.fromFirestore(snap) : null);
  }

  Future<void> updateUserProfile(String uid, Map<String, dynamic> data) async {
    await _db.collection(Collections.users).doc(uid).set(data, SetOptions(merge: true));
  }

  Future<bool> isSuperAdmin(String uid) async {
    try {
      final snap = await _db.collection('admins').doc(uid).get();
      return snap.exists && snap.data()?['superAdmin'] == true;
    } catch (_) {
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Super admin — all users
  // ──────────────────────────────────────────────────────────────

  Future<List<UserModel>> getAllUsers() async {
    final snap = await _db.collection(Collections.users).get();
    return snap.docs.map((d) => UserModel.fromFirestore(d)).toList();
  }
}
