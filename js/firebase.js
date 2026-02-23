import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, setDoc, query, where
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCaOEjgmmCbtl00fYif89iVCO5CewiSoVQ",
  authDomain: "routiner-db.firebaseapp.com",
  projectId: "routiner-db",
  storageBucket: "routiner-db.firebasestorage.app",
  messagingSenderId: "815158931879",
  appId: "1:815158931879:web:8c5cc7ccfed90210068682",
  measurementId: "G-2S6KXT0K3D"
};

let db;
let syncCallback = null;

export function initFirebase() {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  return db;
}

export function onSyncStatus(callback) {
  syncCallback = callback;
}

function reportSync(status) {
  if (syncCallback) syncCallback(status);
}

// ===== Routines CRUD =====

export function subscribeToRoutines(callback) {
  return onSnapshot(collection(db, 'routines'), (snapshot) => {
    reportSync('synced');
    const routines = [];
    snapshot.forEach((docSnap) => {
      routines.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(routines);
  }, (err) => {
    console.error('Routines subscribe error:', err);
    reportSync('error');
  });
}

export async function createRoutine(data) {
  reportSync('syncing');
  try {
    const docRef = await addDoc(collection(db, 'routines'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    reportSync('synced');
    return docRef.id;
  } catch (err) {
    console.error('createRoutine error:', err);
    reportSync('error');
  }
}

export async function updateRoutine(docId, fields) {
  reportSync('syncing');
  try {
    await updateDoc(doc(db, 'routines', docId), {
      ...fields,
      updatedAt: serverTimestamp()
    });
    reportSync('synced');
  } catch (err) {
    console.error('updateRoutine error:', err);
    reportSync('error');
  }
}

export async function deleteRoutine(docId) {
  reportSync('syncing');
  try {
    await deleteDoc(doc(db, 'routines', docId));
    reportSync('synced');
  } catch (err) {
    console.error('deleteRoutine error:', err);
    reportSync('error');
  }
}

// ===== Completions CRUD =====
// Each completion doc id = "date_routineId" for easy lookup & toggle

function completionDocId(dateStr, routineId) {
  return `${dateStr}_${routineId}`;
}

export function subscribeToCompletions(year, month, callback) {
  const pad = n => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-31`;

  const q = query(
    collection(db, 'completions'),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );

  return onSnapshot(q, (snapshot) => {
    reportSync('synced');
    const completions = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!completions[data.date]) completions[data.date] = {};
      completions[data.date][data.routineId] = data.done;
    });
    callback(completions);
  }, (err) => {
    console.error('Completions subscribe error:', err);
    reportSync('error');
  });
}

export async function toggleCompletion(dateStr, routineId, currentlyDone) {
  reportSync('syncing');
  const docRef = doc(db, 'completions', completionDocId(dateStr, routineId));
  try {
    await setDoc(docRef, {
      date: dateStr,
      routineId,
      done: !currentlyDone,
      updatedAt: serverTimestamp()
    });
    reportSync('synced');
  } catch (err) {
    console.error('toggleCompletion error:', err);
    reportSync('error');
  }
}
