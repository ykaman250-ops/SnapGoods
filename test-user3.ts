import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
config();

initializeApp();
const db = getFirestore();

async function run() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', 'jitenderkumar@nvgroup.co.in').get();
  if (snapshot.empty) {
    console.log('No matching documents for jitender.');
  } else {
    snapshot.forEach(doc => {
      console.dir({ id: doc.id, ...doc.data() }, { depth: null });
    });
  }
}
run();
