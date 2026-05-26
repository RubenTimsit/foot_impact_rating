// ==================== CONFIGURATION FIREBASE ====================
// IMPORTANT: Remplace ces valeurs par tes propres clés Firebase
// Tu les trouveras dans la console Firebase après avoir créé ton projet

const firebaseConfig = {
    apiKey: "AIzaSyAQtM3hdFqgyRW8uhq5Vhs_yis3UyD3VE4",
    authDomain: "foot-4f0c2.firebaseapp.com",
    projectId: "foot-4f0c2",
    storageBucket: "foot-4f0c2.firebasestorage.app",
    messagingSenderId: "285043352720",
    appId: "1:285043352720:web:b583cf40d418d3f4ffe415"
};

// ==================== INITIALISATION ====================
// Import des modules Firebase nécessaires
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, setDoc, doc, query, where, orderBy, deleteDoc, serverTimestamp, writeBatch, increment, runTransaction, deleteField } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==================== EXPORT ====================
export { 
    db, 
    auth,
    collection, 
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    setDoc,
    doc, 
    query,
    where,
    orderBy,
    deleteDoc,
    serverTimestamp,
    writeBatch,
    increment,
    runTransaction,
    deleteField,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
};

// ==================== COLLECTIONS ====================
export const COLLECTIONS = {
    GROUPES: 'groupes',
    JOUEURS: 'joueurs',
    MATCHS: 'matchs',
    SYNERGIES: 'synergies',
    MATCHS_SEMAINE: 'matchs_semaine',
    INSCRIPTIONS: 'inscriptions'
};

