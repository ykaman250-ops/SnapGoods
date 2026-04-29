import admin from 'firebase-admin';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const rawConfig = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(rawConfig);

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = initializeApp(firebaseConfig);
const clientAuth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const customToken = await admin.auth().createCustomToken('c1kCEEhzuEgTpcVWool8XrWiO0C2');
    const userCredential = await signInWithCustomToken(clientAuth, customToken);
    
    // Get orgId from user doc
    const docRef = doc(db, 'users', userCredential.user.uid);
    const docSnap = await getDoc(docRef);
    const orgId = docSnap.data()?.orgId;
    console.log("Got orgId:", orgId);

    try {
      const q = query(collection(db, 'assets'), where('orgId', '==', orgId));
      const qSnap = await getDocs(q);
      console.log("Got assets:", qSnap.size);
    } catch(e) {
      console.error("Assets read failed:", e);
    }
    
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
run();
