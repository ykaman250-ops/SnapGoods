import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
config();

// Initialize without options relies on FIREBASE_SERVICE_ACCOUNT_KEY env var
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = undefined; // Ensure we use the string
}
initializeApp();
const db = getFirestore();

async function run() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', 'jitenderkumar@nvgroup.co.in').get();
  if (snapshot.empty) {
    console.log('No matching documents for jitenderkumar.');
  } else {
    snapshot.forEach(doc => {
      console.dir(doc.data(), { depth: null });
    });
  }

  const ykSnapshot = await usersRef.where('email', '==', 'ykaman250@gmail.com').get();
  if (ykSnapshot.empty) {
    console.log('No matching documents for ykaman.');
  } else {
    ykSnapshot.forEach(doc => {
      console.dir(doc.data(), { depth: null });
    });
  }

  console.log("Done.");
}
run();
