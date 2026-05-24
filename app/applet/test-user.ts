import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize without options relies on FIREBASE_SERVICE_ACCOUNT_KEY env var
initializeApp();
const db = getFirestore();

async function run() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', 'jitenderkumar@nvgroup.co.in').get();
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }  
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}
run();
