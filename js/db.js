// ============================================================
// DB — Toutes les requêtes Firestore centralisées
// ============================================================
// Règle : aucune vue ne fait de requête Firestore directement.
// Tout passe par ce module.
// ============================================================

import {
  db, COLLECTIONS,
  collection, getDocs, getDocsFromServer, getDoc, addDoc, updateDoc, setDoc, doc,
  query, where, orderBy, limit, startAfter, deleteDoc, serverTimestamp, increment,
  runTransaction, deleteField, onSnapshot, writeBatch,
} from './firebase-config.js';

import { calculerChangementsMatch, calculerChangementsSoiree } from './rating-system.js';
import { mettreAJourSynergiesEquipe } from './synergy-system.js';

// ── Helpers internes ──────────────────────────────────────────

const C = COLLECTIONS;

function groupeRef(groupeId)           { return doc(db, C.GROUPES, groupeId); }
function joueurRef(groupeId, uid)      { return doc(db, C.GROUPES, groupeId, C.JOUEURS, uid); }
function matchSemaineRef(gId, mId)     { return doc(db, C.GROUPES, gId, C.MATCHS_SEMAINE, mId); }
function inscriptionRef(gId, mId, uid) { return doc(db, C.GROUPES, gId, C.MATCHS_SEMAINE, mId, C.INSCRIPTIONS, uid); }
function matchRef(gId, mId)            { return doc(db, C.GROUPES, gId, C.MATCHS, mId); }
function voteRef(gId, mId, uid)        { return doc(db, C.GROUPES, gId, C.MATCHS, mId, C.VOTES, uid); }
function synergieRef(gId, uid1, uid2) {
  const [a, b] = [uid1, uid2].sort();
  return doc(db, C.GROUPES, gId, C.SYNERGIES, `${a}-${b}`);
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();          // Firestore Timestamp
  if (ts.seconds) return ts.seconds * 1000;       // Firestore Timestamp serialisé
  const n = typeof ts === 'string' ? new Date(ts).getTime() : Number(ts);
  return isNaN(n) ? 0 : n;
}

// ── Auth / Profil ─────────────────────────────────────────────

export async function getMonProfil(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateMonProfil(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
  // Si position, profilMilieu ou displayName change, répercuter dans tous les groupes du joueur
  if (data.position !== undefined || data.profilMilieu !== undefined || data.displayName !== undefined) {
    await syncPositionToGroups(uid, data.position, data.profilMilieu ?? null, data.displayName ?? null);
  }
}

/** Met à jour displayName, position et profilMilieu dans tous les groupes où le joueur est membre. */
async function syncPositionToGroups(uid, position, profilMilieu, displayName) {
  if (!position) return;
  const groupesSnap = await getDocs(collection(db, C.GROUPES));
  if (groupesSnap.empty) return;

  const batch = writeBatch(db);
  let count = 0;

  await Promise.all(groupesSnap.docs.map(async (gDoc) => {
    const jSnap = await getDoc(doc(db, C.GROUPES, gDoc.id, C.JOUEURS, uid));
    if (!jSnap.exists()) return;
    const update = { position, profilMilieu: profilMilieu || null };
    if (displayName) update.displayName = displayName;
    batch.update(doc(db, C.GROUPES, gDoc.id, C.JOUEURS, uid), update);
    count++;
  }));

  if (count > 0) await batch.commit();
}

export async function checkIsSuperAdmin(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists() && snap.data()?.superAdmin === true;
}

// ── Groupes ───────────────────────────────────────────────────

/**
 * Anti-N+1 : récupère les groupes de l'user en 2 requêtes max.
 * Retourne un tableau de groupes enrichi du statut et rating du joueur.
 */
export async function getMesGroupes(uid) {
  // 1. Trouver tous les joueurs{uid} dans tous les groupes
  const joueurQuery = query(
    collection(db, C.GROUPES, '__placeholder__', C.JOUEURS),
    where('userId', '==', uid)
  );

  // collectionGroup n'est pas disponible dans notre import CDN actuel
  // On utilise la méthode fiable : getDocs sur groupes puis filtre sur joueurs
  // Mais pour éviter le vrai N+1, on fetch tous les groupes puis
  // on ne fait UN getDoc par groupe seulement pour ceux où l'user est membre.
  // La vraie solution nécessite collectionGroup — on l'approxime ici
  // en utilisant un champ de membership indexé sur le document groupe.

  // Approche : getDocs sur TOUS les groupes actifs (nb groupes < 100 en pratique)
  // puis filter côté client. C'est acceptable pour cette app.
  const groupesSnap = await getDocs(collection(db, C.GROUPES));
  if (groupesSnap.empty) return [];

  // Pour chaque groupe, vérifier le joueur en parallèle (Promise.all)
  const results = await Promise.all(
    groupesSnap.docs.map(async (gDoc) => {
      const jSnap = await getDoc(doc(db, C.GROUPES, gDoc.id, C.JOUEURS, uid));
      if (!jSnap.exists()) return null;
      const joueur = jSnap.data();
      const groupe = { id: gDoc.id, ...gDoc.data() };

      // Charger le prochain match réel (ouvert ou programmé) de ce groupe
      const mSnap = await getDocs(collection(db, C.GROUPES, gDoc.id, C.MATCHS_SEMAINE));
      const now   = Date.now();

      const nombreSousGroupes = groupe.nombreSousGroupes || 1;
      const joueurSousGroupe  = nombreSousGroupes > 1 ? (joueur.sousGroupe ?? null) : undefined;

      const prochainMatch = mSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => {
          if (m.statut !== 'ouvert' && m.statut !== 'programmé') return false;
          if (tsToMs(m.dateMatch) <= now - 2 * 60 * 60 * 1000) return false; // 2h de grâce
          if (joueurSousGroupe === undefined) return true;  // pas de divisions
          if (joueurSousGroupe === null) return false;       // joueur non assigné
          const cibles = m.sousGroupesCibles;
          return !cibles || cibles.includes(joueurSousGroupe);
        })
        .sort((a, b) => tsToMs(a.dateMatch) - tsToMs(b.dateMatch))[0] || null;

      return {
        ...groupe,
        _monStatut:     joueur.statut   || 'pending',
        _monRating:     joueur.rating   || 1000,
        _monTrophees:   joueur.trophees || {},
        _joueurData:    joueur,
        _prochainMatch: prochainMatch,   // ← vrai match Firestore ou null
      };
    })
  );

  return results.filter(Boolean);
}

export async function getGroupe(groupeId) {
  const snap = await getDoc(groupeRef(groupeId));
  if (!snap.exists()) throw new Error('Groupe introuvable');
  return { id: snap.id, ...snap.data() };
}

export async function creerGroupe(uid, { nom, maxJoueursMatch, displayName, nombreSousGroupes = 1, nomsSousGroupes = [] }) {
  const code = _genererCode();
  const groupeRef2 = await addDoc(collection(db, C.GROUPES), {
    nom,
    code,
    adminId: uid,
    maxJoueursMatch:   Number(maxJoueursMatch) || 10,
    nombreSousGroupes: Number(nombreSousGroupes) || 1,
    nomsSousGroupes:   nomsSousGroupes || [],
    actif: true,
    configHebdos: {},
    configHebdoActif: false,
    dateCreation: serverTimestamp(),
  });
  // L'admin est directement membre actif
  await setDoc(doc(db, C.GROUPES, groupeRef2.id, C.JOUEURS, uid), {
    userId: uid,
    displayName: displayName || 'Admin',
    statut: 'active',
    rating: 1000,
    matchsJoues: 0,
    victoires: 0,
    nuls: 0,
    defaites: 0,
    trophees: {},
    votesParticipes: 0,
    sousGroupe: null,
    dateInscription: serverTimestamp(),
  });
  return groupeRef2.id;
}

export async function rejoindreGroupe(uid, code, profil) {
  // Chercher le groupe par code
  const q = query(collection(db, C.GROUPES), where('code', '==', code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Code invalide');
  const groupeDoc = snap.docs[0];
  const groupeId  = groupeDoc.id;

  // Vérifier si déjà membre
  const existing = await getDoc(doc(db, C.GROUPES, groupeId, C.JOUEURS, uid));
  if (existing.exists()) throw new Error('Tu es déjà dans ce groupe');

  // Créer la demande
  await setDoc(doc(db, C.GROUPES, groupeId, C.JOUEURS, uid), {
    userId: uid,
    displayName: profil.displayName || 'Joueur',
    position: profil.position || 'Milieu',
    profilMilieu: profil.profilMilieu || null,
    statut: 'pending',
    rating: 1000,
    matchsJoues: 0,
    victoires: 0,
    nuls: 0,
    defaites: 0,
    trophees: {},
    votesParticipes: 0,
    sousGroupe: null,
    dateInscription: serverTimestamp(),
  });

  return groupeId;
}

function _genererCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Joueurs ───────────────────────────────────────────────────

export async function getJoueurs(groupeId) {
  const snap = await getDocs(collection(db, C.GROUPES, groupeId, C.JOUEURS));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(j => j.statut === 'active');
}

export async function getJoueursPending(groupeId) {
  const snap = await getDocs(collection(db, C.GROUPES, groupeId, C.JOUEURS));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(j => j.statut === 'pending');
}

export async function getTousJoueurs(groupeId) {
  const snap = await getDocs(collection(db, C.GROUPES, groupeId, C.JOUEURS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function validerJoueur(groupeId, userId) {
  await updateDoc(doc(db, C.GROUPES, groupeId, C.JOUEURS, userId), { statut: 'active' });
}

export async function refuserJoueur(groupeId, userId) {
  await deleteDoc(doc(db, C.GROUPES, groupeId, C.JOUEURS, userId));
}

export async function expulserJoueur(groupeId, userId) {
  await deleteDoc(doc(db, C.GROUPES, groupeId, C.JOUEURS, userId));
}

/** onSnapshot sur joueurs pending (temps réel pour badge admin) */
export function watchJoueursPending(groupeId, callback) {
  const q = query(
    collection(db, C.GROUPES, groupeId, C.JOUEURS),
    where('statut', '==', 'pending')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Match de la semaine ───────────────────────────────────────

/**
 * @param {string} groupeId
 * @param {number|null|undefined} sousGroupe
 *   undefined = pas de divisions actives → retourne tout
 *   null      = joueur non assigné → retourne rien
 *   1-4       = filtre sur les matchs ciblant cette division
 */
export async function getProchainMatch(groupeId, sousGroupe = undefined) {
  const all = await getProchainMatchs(groupeId, sousGroupe);
  return all[0] ?? null;
}

/**
 * Retourne TOUS les créneaux ouverts/programmés visibles par ce joueur,
 * triés par date croissante.
 */
export async function getProchainMatchs(groupeId, sousGroupe = undefined) {
  const snap = await getDocs(collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE));
  const now  = Date.now();

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => {
      if (m.statut !== 'ouvert' && m.statut !== 'programmé') return false;
      const matchTs = tsToMs(m.dateMatch);
      if (matchTs && matchTs < now - 4 * 60 * 60 * 1000) return false;
      if (sousGroupe === undefined) return true;
      if (sousGroupe === null) return false;
      const cibles = m.sousGroupesCibles;
      return !cibles || cibles.includes(sousGroupe);
    })
    .sort((a, b) => tsToMs(a.dateMatch) - tsToMs(b.dateMatch));
}

/**
 * Pour l'admin uniquement : retourne TOUS les créneaux non encore validés,
 * y compris les 'fermé' récents (match passé mais pas encore validé)
 * et les 'programmé' (inscrip pas encore ouvertes).
 */
export async function getMatchesPourAdmin(groupeId) {
  // getDocsFromServer bypasse le cache local — indispensable après une écriture
  // quand le listener QUIC a pu tomber et que le cache est stale.
  const snap = await getDocsFromServer(collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE));
  const now  = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => {
      if (m.statut === 'ouvert' || m.statut === 'programmé') return true;
      // Garder les 'fermé' récents (moins de 7j) sans matchValideId
      if (m.statut === 'fermé' && !m.matchValideId) {
        return tsToMs(m.dateMatch) >= sevenDaysAgo;
      }
      return false;
    })
    .sort((a, b) => tsToMs(a.dateMatch) - tsToMs(b.dateMatch));
}

export async function annulerCreneau(groupeId, matchId) {
  await updateDoc(matchSemaineRef(groupeId, matchId), { statut: 'annulé' });
}

export async function getMonInscription(groupeId, matchId, uid) {
  const snap = await getDoc(inscriptionRef(groupeId, matchId, uid));
  if (!snap.exists()) return null;
  return snap.data().statut; // 'confirmé' | 'attente'
}

export async function getInscriptions(groupeId, matchId) {
  const snap = await getDocs(
    collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE, matchId, C.INSCRIPTIONS)
  );
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return {
    confirmes: all.filter(i => i.statut === 'confirmé').sort((a,b) => tsToMs(a.dateInscription) - tsToMs(b.dateInscription)),
    attente:   all.filter(i => i.statut === 'attente').sort((a,b) => tsToMs(a.dateInscription) - tsToMs(b.dateInscription)),
  };
}

/** onSnapshot inscriptions (temps réel) */
export function watchInscriptions(groupeId, matchId, callback) {
  const ref = collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE, matchId, C.INSCRIPTIONS);
  return onSnapshot(ref, snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback({
      confirmes: all.filter(i => i.statut === 'confirmé').sort((a,b) => tsToMs(a.dateInscription) - tsToMs(b.dateInscription)),
      attente:   all.filter(i => i.statut === 'attente').sort((a,b) => tsToMs(a.dateInscription) - tsToMs(b.dateInscription)),
    });
  });
}

export async function sInscrire(groupeId, matchId, uid, displayName) {
  const mRef  = matchSemaineRef(groupeId, matchId);
  const iRef  = inscriptionRef(groupeId, matchId, uid);

  await runTransaction(db, async tx => {
    const matchSnap = await tx.get(mRef);
    if (!matchSnap.exists()) throw new Error('Match introuvable');
    const matchData = matchSnap.data();

    // Accepter aussi 'programmé' si dateOuvertureInscription est déjà passée (fallback client)
    const isEffectivelyOpen = matchData.statut === 'ouvert' ||
      (matchData.statut === 'programmé' && matchData.dateOuvertureInscription &&
       new Date() >= new Date(matchData.dateOuvertureInscription));
    if (!isEffectivelyOpen) throw new Error('Les inscriptions sont fermées');

    const confirmes = matchData.confirmedCount || 0;
    const max       = matchData.maxJoueurs || 10;
    const statut    = confirmes < max ? 'confirmé' : 'attente';

    tx.set(iRef, {
      userId: uid,
      displayName,
      statut,
      dateInscription: serverTimestamp(),
    });

    if (statut === 'confirmé') {
      tx.update(mRef, { confirmedCount: increment(1) });
    }
  });
}

export async function seDesinscrire(groupeId, matchId, uid) {
  const iRef = inscriptionRef(groupeId, matchId, uid);
  const mRef = matchSemaineRef(groupeId, matchId);

  await runTransaction(db, async tx => {
    const iSnap = await tx.get(iRef);
    if (!iSnap.exists()) return;
    const wasConfirme = iSnap.data().statut === 'confirmé';
    tx.delete(iRef);
    if (wasConfirme) {
      tx.update(mRef, { confirmedCount: increment(-1) });
    }
  });
}

export async function creerCreneauManuel(groupeId, { dateMatch, heureMatch, heureOuverture, dateOuvertureInscription, maxJoueurs, displayName, sousGroupesCibles = null }) {
  console.log('[creerCreneauManuel] ▶ début', { groupeId, dateMatch, heureMatch, heureOuverture, dateOuvertureInscription, maxJoueurs, displayName });

  if (!groupeId) {
    console.error('[creerCreneauManuel] ❌ groupeId manquant !');
    throw new Error('Groupe non sélectionné. Recharge la page.');
  }

  // Combiner date ("2026-06-03") + heure ("20:30") en ISO string complet pour le tri
  const [hm = 18, mm = 0] = (heureMatch || '18:00').split(':').map(Number);
  const [y, mo, d]        = (dateMatch || '').split('-').map(Number);
  const dateMatchISO      = (y && mo && d)
    ? new Date(y, mo - 1, d, hm, mm, 0).toISOString()
    : dateMatch;

  // Si l'ouverture est dans le futur → statut 'programmé', sinon 'ouvert' immédiatement
  const ouvertureDate = dateOuvertureInscription ? new Date(dateOuvertureInscription) : null;
  const statut = (ouvertureDate && ouvertureDate > new Date()) ? 'programmé' : 'ouvert';

  const payload = {
    dateMatch:                dateMatchISO,
    heureMatch:               heureMatch               || null,
    heureOuverture:           heureOuverture           || null,
    dateOuvertureInscription: dateOuvertureInscription || null,
    maxJoueurs:       Number(maxJoueurs) || 10,
    statut,
    confirmedCount:   0,
    sousGroupesCibles: sousGroupesCibles && sousGroupesCibles.length ? sousGroupesCibles : null,
    dateCreation:     serverTimestamp(),
    creerPar:         displayName,
  };

  console.log('[creerCreneauManuel] 📝 payload à écrire :', { ...payload, dateCreation: '<serverTimestamp>' });
  console.log('[creerCreneauManuel] 📂 chemin Firestore :', `groupes/${groupeId}/matchs_semaine/{newId}`);

  try {
    const ref = await addDoc(collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE), payload);
    console.log('[creerCreneauManuel] ✅ document créé avec succès, id =', ref.id);
  } catch (err) {
    console.error('[creerCreneauManuel] ❌ addDoc a échoué :', err.code, err.message, err);
    throw err;
  }
}

// ── Historique des matchs ──────────────────────────────────────

/**
 * Pagination curseur : retourne { matchs, lastDoc, hasMore }.
 * - limitN  : taille de page (défaut 20)
 * - cursorDoc : dernier document Firestore de la page précédente (null = première page)
 *
 * Astuce du +1 : on en récupère un de plus que demandé ; si on l'obtient
 * c'est qu'il en reste d'autres → hasMore = true, mais on ne le retourne pas.
 */
export async function getHistorique(groupeId, limitN = 20, cursorDoc = null) {
  const constraints = [
    where('statut', '==', 'joue'),
    orderBy('dateCreation', 'desc'),
    limit(limitN + 1),
  ];
  if (cursorDoc) constraints.push(startAfter(cursorDoc));

  const snap = await getDocs(
    query(collection(db, C.GROUPES, groupeId, C.MATCHS), ...constraints)
  );

  const hasMore  = snap.docs.length > limitN;
  const pageDocs = snap.docs.slice(0, limitN);
  return {
    matchs:  pageDocs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: pageDocs.at(-1) ?? null,
    hasMore,
  };
}

export async function getMonVote(groupeId, matchId, uid) {
  const snap = await getDoc(voteRef(groupeId, matchId, uid));
  return snap.exists() ? snap.data() : null;
}

export async function soumettreVote(groupeId, matchId, uid, { top1, top2, top3 }) {
  const mRef = matchRef(groupeId, matchId);
  const vRef = voteRef(groupeId, matchId, uid);

  await runTransaction(db, async tx => {
    const [matchSnap, voteSnap] = await Promise.all([tx.get(mRef), tx.get(vRef)]);
    if (!matchSnap.exists()) throw new Error('Match introuvable');
    if (matchSnap.data().voteClos) throw new Error('Le vote est terminé');
    if (voteSnap.exists()) throw new Error('Tu as déjà voté pour ce match.');

    tx.set(vRef, { userId: uid, top1, top2, top3, dateVote: serverTimestamp() });
    tx.update(mRef, { nbVotes: increment(1) });
    tx.update(joueurRef(groupeId, uid), { votesParticipes: increment(1) });
  });
}

// ── Synergies ─────────────────────────────────────────────────

export async function getSynergies(groupeId) {
  const snap = await getDocs(collection(db, C.GROUPES, groupeId, C.SYNERGIES));
  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        // Normaliser les champs (anciens docs utilisent "valeur", nouveaux aussi)
        score:             data.valeur              ?? data.score              ?? 0,
        victoiresEnsemble: data.victoires            ?? data.victoiresEnsemble ?? 0,
        defaitesEnsemble:  data.defaites             ?? data.defaitesEnsemble  ?? 0,
        // Remonter les IDs depuis la clé si absent du document
        joueur1: data.joueur1 ?? d.id.split('-')[0],
        joueur2: data.joueur2 ?? d.id.split('-')[1],
      };
    })
    .filter(s => (s.matchsEnsemble || 0) >= 2);
}

// ── Validation match (admin) ───────────────────────────────────

/**
 * Transaction complète :
 * 1. Calcul ELO via rating-system.js
 * 2. Écriture match joué
 * 3. Mise à jour stats tous les joueurs
 * 4. Mise à jour synergies via synergy-system.js
 * 5. Fermeture du créneau
 */
export async function validerMatch(groupeId, {
  matchSemaineId,
  equipeA,        // [{ id, rating, matchsJoues, ... }]  — match simple
  equipeB,
  scoreA,
  scoreB,
  // Soirée 2 sous-matchs (optionnel)
  sousMatchs,     // [{equipeA, equipeB, scoreA, scoreB}, ...]
  split,          // [poids1, poids2]  ex: [0.5, 0.5]
}) {
  const estSoiree = Array.isArray(sousMatchs) && sousMatchs.length > 1;

  // 1. Calcul ELO
  let changements, matchsJouesParJoueur, tousLesJoueurs, participants;

  if (estSoiree) {
    const res = calculerChangementsSoiree(sousMatchs, split);
    changements          = res.changements;
    matchsJouesParJoueur = res.matchsJouesParJoueur;
    // Union de tous les joueurs de tous les sous-matchs
    const idsSet = new Set();
    sousMatchs.forEach(sm => [...sm.equipeA, ...sm.equipeB].forEach(j => idsSet.add(j.id)));
    participants = [...idsSet];
    tousLesJoueurs = sousMatchs.flatMap(sm => [...sm.equipeA, ...sm.equipeB])
      .filter((j, i, arr) => arr.findIndex(x => x.id === j.id) === i); // dédupliqué
  } else {
    changements          = calculerChangementsMatch(equipeA, equipeB, scoreA, scoreB);
    matchsJouesParJoueur = null;
    tousLesJoueurs       = [...equipeA, ...equipeB];
    participants         = tousLesJoueurs.map(j => j.id);
  }

  const maintenant = new Date();
  const dateVoteFermeture = new Date(maintenant.getTime() + 24 * 60 * 60 * 1000);

  // Lire sousGroupesCibles avant la transaction (nécessaire pour matchsPotentiels hors-tx)
  let sousGroupesCibles = null;
  if (matchSemaineId) {
    const mSemSnap = await getDoc(matchSemaineRef(groupeId, matchSemaineId));
    if (mSemSnap.exists() && mSemSnap.data().matchValideId) {
      throw new Error('Ce match a déjà été validé');
    }
    sousGroupesCibles = mSemSnap.data()?.sousGroupesCibles || null;
  }

  // 2. Transaction Firestore
  const newMatchRef = doc(collection(db, C.GROUPES, groupeId, C.MATCHS));

  await runTransaction(db, async tx => {
    // Re-vérifier idempotence dans la transaction (sécurité)
    if (matchSemaineId) {
      const mSemSnap = await tx.get(matchSemaineRef(groupeId, matchSemaineId));
      if (mSemSnap.exists() && mSemSnap.data().matchValideId) {
        throw new Error('Ce match a déjà été validé');
      }
    }

    // sousGroupesCibles déjà lu avant la transaction
    // Écrire le document match
    const matchDoc = estSoiree
      ? {
          type:             'soiree',
          sousMatchs:       sousMatchs.map((sm, i) => ({
            equipeA:  (sm.equipeA || []).map(j => j.id),
            equipeB:  (sm.equipeB || []).map(j => j.id),
            scoreA:   Number(sm.scoreA),
            scoreB:   Number(sm.scoreB),
            poids:    split[i] ?? 0.5,
          })),
          split,
          // Participants = union pour le vote MOM (compat ancienne lecture equipeA/B)
          equipeA:          participants,
          equipeB:          [],
          changements,
          statut:           'joue',
          nbVotes:          0,
          voteClos:         false,
          presentsCount:    participants.length,
          sousGroupesCibles,
          dateVoteFermeture,
          dateCreation:     serverTimestamp(),
        }
      : {
          equipeA:          equipeA.map(j => j.id),
          equipeB:          equipeB.map(j => j.id),
          scoreA:           Number(scoreA),
          scoreB:           Number(scoreB),
          scoreEquipeA:     Number(scoreA),
          scoreEquipeB:     Number(scoreB),
          changements,
          statut:           'joue',
          nbVotes:          0,
          voteClos:         false,
          presentsCount:    equipeA.length + equipeB.length,
          sousGroupesCibles,
          dateVoteFermeture,
          dateCreation:     serverTimestamp(),
        };

    tx.set(newMatchRef, matchDoc);

    // Mettre à jour stats de chaque joueur
    for (const joueur of tousLesJoueurs) {
      const ch = changements[joueur.id];
      if (!ch) continue;

      const resultat = ch.resultat;
      const delta    = ch.changement;

      tx.update(joueurRef(groupeId, joueur.id), {
        rating:       increment(delta),
        matchsJoues:  increment(1),   // 1 soirée = 1 match, quel que soit le nb de sous-matchs
        victoires:    increment(resultat === 'victoire' ? 1 : 0),
        nuls:         increment(resultat === 'nul'      ? 1 : 0),
        defaites:     increment(resultat === 'defaite'  ? 1 : 0),
      });
    }

    // Fermer le créneau
    if (matchSemaineId) {
      tx.update(matchSemaineRef(groupeId, matchSemaineId), {
        statut: 'fermé',
        matchValideId: newMatchRef.id,
      });
    }
  });

  // 3. Incrémenter matchsPotentiels pour tous les joueurs éligibles à ce créneau
  //    (hors transaction — batch séparé)
  await _incrementMatchsPotentiels(groupeId, sousGroupesCibles);

  // 4. Mise à jour synergies (hors transaction, données volumineuses)
  if (estSoiree) {
    for (const sm of sousMatchs) {
      await _updateSynergies(groupeId, sm.equipeA, sm.equipeB, sm.scoreA, sm.scoreB, sm.poids ?? 1);
    }
  } else {
    await _updateSynergies(groupeId, equipeA, equipeB, scoreA, scoreB, 1);
  }

  return newMatchRef.id;
}

/**
 * Incrémente matchsPotentiels de 1 pour tous les joueurs actifs éligibles.
 * Un joueur est éligible si :
 *  - sousGroupesCibles est null/vide (match ouvert à tous), OU
 *  - son sousGroupe est dans sousGroupesCibles
 */
async function _incrementMatchsPotentiels(groupeId, sousGroupesCibles) {
  const snap = await getDocs(collection(db, C.GROUPES, groupeId, C.JOUEURS));
  const joueurs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(j => j.statut === 'active');

  const cibles = sousGroupesCibles && sousGroupesCibles.length ? sousGroupesCibles : null;

  const eligibles = joueurs.filter(j => {
    if (!cibles) return true;                        // match ouvert à tous
    return cibles.includes(j.sousGroupe);            // division ciblée
  });

  if (!eligibles.length) return;

  const batch = writeBatch(db);
  for (const j of eligibles) {
    batch.update(joueurRef(groupeId, j.id), { matchsPotentiels: increment(1) });
  }
  await batch.commit();
}

async function _updateSynergies(groupeId, equipeA, equipeB, scoreA, scoreB, poids = 1) {
  // Charger synergies actuelles
  const snap = await getDocs(collection(db, C.GROUPES, groupeId, C.SYNERGIES));
  const synMap = {};
  snap.docs.forEach(d => { synMap[d.id] = d.data(); });

  const diff = Math.abs(scoreA - scoreB);
  // Accepte indifféremment des strings (UIDs) ou des objets joueur {id, ...}
  const toId = j => (typeof j === 'string' ? j : j?.id);
  const idsA = (equipeA || []).map(toId).filter(Boolean);
  const idsB = (equipeB || []).map(toId).filter(Boolean);

  const resultatA = scoreA > scoreB ? 'victoire' : scoreB > scoreA ? 'defaite' : 'nul';
  const resultatB = scoreB > scoreA ? 'victoire' : scoreA > scoreB ? 'defaite' : 'nul';

  // Synergies intra-équipe (pondérées par le poids du sous-match)
  mettreAJourSynergiesEquipe(synMap, idsA, resultatA, diff, poids);
  mettreAJourSynergiesEquipe(synMap, idsB, resultatB, diff, poids);

  // Écrire les synergies modifiées (batch)
  const batch = writeBatch(db);
  for (const [pairKey, data] of Object.entries(synMap)) {
    const sRef = doc(db, C.GROUPES, groupeId, C.SYNERGIES, pairKey);
    batch.set(sRef, data);
  }
  await batch.commit();
}

// ── Config hebdo (admin) ───────────────────────────────────────

const JOURS_JS = { Lundi:1, Mardi:2, Mercredi:3, Jeudi:4, Vendredi:5, Samedi:6, Dimanche:0 };

/**
 * Prochain jour+heure d'ouverture (>= maintenant).
 */
function _nextOuvertureDateISO(jourOuverture, heureOuverture) {
  const targetDay = JOURS_JS[jourOuverture] ?? 1;
  const [h, m]   = (heureOuverture || '12:00').split(':').map(Number);
  const now       = new Date();
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  const diff = (targetDay - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + (diff === 0 && candidate <= now ? 7 : diff));
  return candidate.toISOString();
}

/**
 * Date du match (jourMatch à heureMatch) suivant immédiatement une date d'ouverture.
 * Ex : ouverture Vendredi → match Mercredi suivant.
 */
function _matchDateAfterOuverture(ouvertureISO, jourMatch, heureMatch) {
  const targetDay = JOURS_JS[jourMatch] ?? 1;
  const [h, m]   = (heureMatch || '18:00').split(':').map(Number);
  const d        = new Date(ouvertureISO);
  d.setHours(h, m, 0, 0);
  let daysToAdd = (targetDay - d.getDay() + 7) % 7;
  if (daysToAdd === 0) daysToAdd = 7; // au minimum le prochain (pas le même jour)
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString();
}

export async function addHebdoConfig(groupeId, { jour, heure, jourOuverture, heureOuverture, maxJoueurs, sousGroupesCibles = null }) {
  const id                   = `hebdo_${Date.now()}`;
  const premiereOuverture    = _nextOuvertureDateISO(jourOuverture, heureOuverture);
  const ouvertureEnsuite     = new Date(new Date(premiereOuverture).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const cibles               = sousGroupesCibles && sousGroupesCibles.length ? sousGroupesCibles : null;

  // Sauvegarder la config — nextOuvertureDate pointe sur la 2ème semaine
  // car la 1ère est créée immédiatement ci-dessous.
  await updateDoc(groupeRef(groupeId), {
    [`configHebdos.${id}`]: {
      id,
      actif:             true,
      jour,
      heure,
      jourOuverture,
      heureOuverture,
      maxJoueurs:        Number(maxJoueurs) || 10,
      sousGroupesCibles: cibles,
      nextOuvertureDate: ouvertureEnsuite,   // la CF gérera à partir de la semaine suivante
    },
    configHebdoActif: true,
  });

  // Créer immédiatement le premier matchs_semaine pour la première ouverture.
  const dateMatchISO  = _matchDateAfterOuverture(premiereOuverture, jour, heure);
  const ouvertureDate = new Date(premiereOuverture);
  const statut        = ouvertureDate > new Date() ? 'programmé' : 'ouvert';

  await addDoc(collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE), {
    dateMatch:                dateMatchISO,
    dateOuvertureInscription: premiereOuverture,
    heureMatch:               heure,
    heureOuverture,
    maxJoueurs:               Number(maxJoueurs) || 10,
    statut,
    confirmedCount:           0,
    sousGroupesCibles:        cibles,
    sourceHebdo:              id,
    dateCreation:             serverTimestamp(),
  });
}

export async function toggleHebdoConfig(groupeId, configId, actif) {
  await updateDoc(groupeRef(groupeId), {
    [`configHebdos.${configId}.actif`]: actif,
  });
}

export async function deleteHebdoConfig(groupeId, configId) {
  await updateDoc(groupeRef(groupeId), {
    [`configHebdos.${configId}`]: deleteField(),
  });
}

export async function updateGroupeSettings(groupeId, { nom, maxJoueursMatch }) {
  const data = {};
  if (nom)             data.nom             = nom;
  if (maxJoueursMatch) data.maxJoueursMatch = Number(maxJoueursMatch);
  await updateDoc(groupeRef(groupeId), data);
}

// ── Créneau hebdo → créer le prochain doc matchs_semaine ───────

export async function createCreneauFromHebdo(groupeId, hebdo) {
  // Calculer la prochaine date
  const nextDate = _calcNextDate(hebdo);
  if (!nextDate) return;

  // Éviter les doublons : supprimer les éventuels "programmés" sur même date
  const existing = await getDocs(
    query(
      collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE),
      where('statut', '==', 'programmé')
    )
  );
  for (const d of existing.docs) {
    const data = d.data();
    if (data.dateMatch === nextDate) await deleteDoc(d.ref);
  }

  await addDoc(collection(db, C.GROUPES, groupeId, C.MATCHS_SEMAINE), {
    dateMatch: nextDate,
    heureOuverture: hebdo.heureOuverture,
    maxJoueurs: hebdo.maxJoueurs || 10,
    statut: 'programmé',
    confirmedCount: 0,
    dateCreation: serverTimestamp(),
    hebdoId: hebdo.id,
  });
}

function _calcNextDate(hebdo) {
  const jourMap = { Lundi:1, Mardi:2, Mercredi:3, Jeudi:4, Vendredi:5, Samedi:6, Dimanche:0 };
  const jourCible = jourMap[hebdo.jour];
  if (jourCible === undefined) return null;

  const now = new Date();
  const diff = (jourCible - now.getDay() + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);

  const yyyy = next.getFullYear();
  const mm   = String(next.getMonth() + 1).padStart(2, '0');
  const dd   = String(next.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Lit le sousGroupe du joueur directement depuis Firestore (pas de cache store).
 * Retourne le numéro (1-4) ou null si non assigné.
 */
export async function getMonSousGroupe(groupeId, uid) {
  const snap = await getDoc(joueurRef(groupeId, uid));
  if (!snap.exists()) return null;
  return snap.data().sousGroupe ?? null;
}

/** Assigne (ou retire) un sous-groupe à un joueur. sousGroupe = 1-4 ou null. */
export async function assignerSousGroupe(groupeId, uid, sousGroupe) {
  await updateDoc(joueurRef(groupeId, uid), { sousGroupe: sousGroupe ?? null });
}

/**
 * Étend les divisions ciblées d'un créneau existant.
 * divisions = tableau de numéros (ex: [1, 2]) ou null pour supprimer la restriction.
 */
export async function ouvrirMatchADivisions(groupeId, matchId, divisions) {
  const val = divisions && divisions.length ? divisions : null;
  await updateDoc(matchSemaineRef(groupeId, matchId), { sousGroupesCibles: val });
}

// Ré-exporter onSnapshot pour les vues qui en ont besoin
export { onSnapshot };
