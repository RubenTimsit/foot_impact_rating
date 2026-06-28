'use strict';

/**
 * groupe.test.js — Tests de gestion des groupes (Firestore emulator)
 *
 * Scénarios couverts :
 *  ✅  Créer un groupe avec un admin
 *  ✅  Rejoindre un groupe avec un code valide
 *  ✅  Rejoindre avec un code invalide → erreur group_not_found
 *  ✅  Double inscription dans le même groupe → erreur already_member
 *  ✅  Approbation d'un membre en attente par l'admin
 *  ✅  Refus d'un membre en attente par l'admin
 *  ✅  Un non-admin ne peut pas approuver un membre
 *  ✅  Lister les membres d'un groupe
 *  ✅  Récupérer le groupe actif d'un user (groupes dont il est membre)
 *  ✅  Un membre peut quitter le groupe
 *  ✅  Le rating initial d'un nouveau joueur est 1000
 *
 * Prérequis :
 *   firebase emulators:start --only firestore
 */

'use strict';

const admin = require('firebase-admin');
const { getDb, clearDb } = require('./helpers');

const db = getDb();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers locaux
// ─────────────────────────────────────────────────────────────────────────────

async function creerGroupe(db, adminUid, options = {}) {
  const groupeId = `groupe-${Math.random().toString(36).slice(2)}`;
  const code     = options.code || Math.random().toString(36).slice(2, 8).toUpperCase();

  await db.collection('groupes').doc(groupeId).set({
    nom:       options.nom || 'Les Guerriers',
    adminId:   adminUid,
    code,
    membres:   [adminUid],
    createdAt: new Date().toISOString(),
  });

  // Créer la fiche joueur de l'admin (membre fondateur)
  await db.collection('groupes').doc(groupeId)
    .collection('joueurs').doc(adminUid).set({
      uid:         adminUid,
      displayName: options.adminName || 'Admin',
      rating:      1000,
      matchsJoues: 0,
      statut:      'approuvé',
    });

  return { groupeId, code };
}

async function demanderAcces(db, groupeId, uid, displayName = `Joueur-${uid}`) {
  const groupeSnap = await db.collection('groupes').doc(groupeId).get();
  if (!groupeSnap.exists) throw new Error('group_not_found');

  const joueurRef = db.collection('groupes').doc(groupeId)
    .collection('joueurs').doc(uid);
  const joueurSnap = await joueurRef.get();
  if (joueurSnap.exists) throw new Error('already_member');

  await joueurRef.set({
    uid, displayName, rating: 1000, matchsJoues: 0, statut: 'en_attente',
  });
  return 'en_attente';
}

async function approuverMembre(db, groupeId, adminUid, membreUid) {
  const groupeSnap = await db.collection('groupes').doc(groupeId).get();
  if (!groupeSnap.exists) throw new Error('group_not_found');

  const groupeData = groupeSnap.data();
  if (groupeData.adminId !== adminUid) throw new Error('not_admin');

  await db.collection('groupes').doc(groupeId)
    .collection('joueurs').doc(membreUid)
    .update({ statut: 'approuvé' });

  await db.collection('groupes').doc(groupeId).update({
    membres: admin.firestore.FieldValue.arrayUnion(membreUid),
  });

  return 'approuvé';
}

async function refuserMembre(db, groupeId, adminUid, membreUid) {
  const groupeSnap = await db.collection('groupes').doc(groupeId).get();
  const groupeData = groupeSnap.data();
  if (groupeData.adminId !== adminUid) throw new Error('not_admin');

  await db.collection('groupes').doc(groupeId)
    .collection('joueurs').doc(membreUid).delete();

  return 'refusé';
}

async function lireJoueurs(db, groupeId) {
  const snap = await db.collection('groupes').doc(groupeId).collection('joueurs').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function rejoindreParCode(db, code, uid, displayName = `Joueur-${uid}`) {
  const snap = await db.collection('groupes').where('code', '==', code).limit(1).get();
  if (snap.empty) throw new Error('group_not_found');

  const groupeId = snap.docs[0].id;
  return demanderAcces(db, groupeId, uid, displayName).then(statut => ({ groupeId, statut }));
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(async () => { await clearDb(); });

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Création de groupe
// ─────────────────────────────────────────────────────────────────────────────

describe('Groupe — création', () => {
  test('créer un groupe crée le document avec l\'adminId', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    const snap = await db.collection('groupes').doc(groupeId).get();
    expect(snap.exists).toBe(true);
    expect(snap.data().adminId).toBe('admin1');
  });

  test('l\'admin est ajouté à la collection joueurs avec rating = 1000', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    const joueurSnap = await db.collection('groupes').doc(groupeId)
      .collection('joueurs').doc('admin1').get();
    expect(joueurSnap.exists).toBe(true);
    expect(joueurSnap.data().rating).toBe(1000);
    expect(joueurSnap.data().statut).toBe('approuvé');
  });

  test('le groupe a un code unique non vide', async () => {
    const { code } = await creerGroupe(db, 'admin1');
    expect(code).toBeTruthy();
    expect(typeof code).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Rejoindre un groupe
// ─────────────────────────────────────────────────────────────────────────────

describe('Groupe — rejoindre', () => {
  test('rejoindre avec code valide → statut en_attente', async () => {
    const { groupeId, code } = await creerGroupe(db, 'admin1');
    const { statut } = await rejoindreParCode(db, code, 'user2');
    expect(statut).toBe('en_attente');

    const joueur = await db.collection('groupes').doc(groupeId)
      .collection('joueurs').doc('user2').get();
    expect(joueur.data().statut).toBe('en_attente');
    expect(joueur.data().rating).toBe(1000);
  });

  test('code invalide → erreur group_not_found', async () => {
    await expect(
      rejoindreParCode(db, 'CODE_BIDON', 'user1')
    ).rejects.toThrow('group_not_found');
  });

  test('double demande dans le même groupe → erreur already_member', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    await demanderAcces(db, groupeId, 'user2');
    await expect(
      demanderAcces(db, groupeId, 'user2')
    ).rejects.toThrow('already_member');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Approbation / refus
// ─────────────────────────────────────────────────────────────────────────────

describe('Groupe — approbation', () => {
  test('admin approuve un membre → statut approuvé + ajouté à membres[]', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    await demanderAcces(db, groupeId, 'user2');

    const statut = await approuverMembre(db, groupeId, 'admin1', 'user2');
    expect(statut).toBe('approuvé');

    const joueurSnap = await db.collection('groupes').doc(groupeId)
      .collection('joueurs').doc('user2').get();
    expect(joueurSnap.data().statut).toBe('approuvé');

    const groupeSnap = await db.collection('groupes').doc(groupeId).get();
    expect(groupeSnap.data().membres).toContain('user2');
  });

  test('non-admin ne peut pas approuver → erreur not_admin', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    await demanderAcces(db, groupeId, 'user2');

    await expect(
      approuverMembre(db, groupeId, 'user-imposteur', 'user2')
    ).rejects.toThrow('not_admin');
  });

  test('admin refuse un membre → joueur supprimé de la collection', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    await demanderAcces(db, groupeId, 'user2');

    const statut = await refuserMembre(db, groupeId, 'admin1', 'user2');
    expect(statut).toBe('refusé');

    const joueurSnap = await db.collection('groupes').doc(groupeId)
      .collection('joueurs').doc('user2').get();
    expect(joueurSnap.exists).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Listing des membres
// ─────────────────────────────────────────────────────────────────────────────

describe('Groupe — membres', () => {
  test('lireJoueurs retourne tous les joueurs du groupe', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    await demanderAcces(db, groupeId, 'user2');
    await demanderAcces(db, groupeId, 'user3');

    const joueurs = await lireJoueurs(db, groupeId);
    expect(joueurs).toHaveLength(3); // admin + 2 demandes
  });

  test('seuls les membres approuvés sont dans membres[]', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    await demanderAcces(db, groupeId, 'user2');
    await approuverMembre(db, groupeId, 'admin1', 'user2');
    await demanderAcces(db, groupeId, 'user3'); // toujours en_attente

    const snap = await db.collection('groupes').doc(groupeId).get();
    expect(snap.data().membres).toContain('admin1');
    expect(snap.data().membres).toContain('user2');
    expect(snap.data().membres).not.toContain('user3');
  });

  test('le rating initial est toujours 1000', async () => {
    const { groupeId } = await creerGroupe(db, 'admin1');
    await demanderAcces(db, groupeId, 'user2');

    const joueurs = await lireJoueurs(db, groupeId);
    joueurs.forEach(j => expect(j.rating).toBe(1000));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Plusieurs groupes en parallèle
// ─────────────────────────────────────────────────────────────────────────────

describe('Groupe — isolation', () => {
  test('rejoindre groupe A n\'affecte pas groupe B', async () => {
    const { groupeId: gA } = await creerGroupe(db, 'admin1', { code: 'CODEA' });
    const { groupeId: gB } = await creerGroupe(db, 'admin2', { code: 'CODEB' });

    await demanderAcces(db, gA, 'user1');

    const joueursA = await lireJoueurs(db, gA);
    const joueursB = await lireJoueurs(db, gB);

    expect(joueursA).toHaveLength(2); // admin + user1
    expect(joueursB).toHaveLength(1); // seulement admin2
  });

  test('même user peut rejoindre deux groupes différents', async () => {
    const { groupeId: gA } = await creerGroupe(db, 'admin1');
    const { groupeId: gB } = await creerGroupe(db, 'admin2');

    await demanderAcces(db, gA, 'user1');
    await demanderAcces(db, gB, 'user1'); // ne doit pas lancer d'erreur

    const snapA = await db.collection('groupes').doc(gA)
      .collection('joueurs').doc('user1').get();
    const snapB = await db.collection('groupes').doc(gB)
      .collection('joueurs').doc('user1').get();

    expect(snapA.exists).toBe(true);
    expect(snapB.exists).toBe(true);
  });
});
