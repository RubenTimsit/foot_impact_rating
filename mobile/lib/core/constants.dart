class Collections {
  static const String groupes = 'groupes';
  static const String joueurs = 'joueurs';
  static const String matchs = 'matchs';
  static const String synergies = 'synergies';
  static const String matchsSemaine = 'matchs_semaine';
  static const String inscriptions = 'inscriptions';
  static const String votes = 'votes';
  static const String users = 'users';
  static const String admins = 'admins';
}

class Positions {
  static const String gardien = 'Gardien';
  static const String defenseur = 'Défenseur';
  static const String milieu = 'Milieu';
  static const String attaquant = 'Attaquant';

  static const List<String> all = [gardien, defenseur, milieu, attaquant];

  static const List<String> profilsMilieu = ['Offensif', 'Défensif'];
}

class MatchStatus {
  static const String programme = 'programmé';
  static const String ouvert = 'ouvert';
  static const String ferme = 'fermé';
  static const String joue = 'joue';
}

class InscriptionStatus {
  static const String confirme = 'confirmé';
  static const String attente = 'attente';
}

class MemberStatus {
  static const String pending = 'pending';
  static const String active = 'active';
}

class AppStrings {
  static const String appName = 'Impact Rating';
  static const String timezone = 'Asia/Jerusalem';
}
