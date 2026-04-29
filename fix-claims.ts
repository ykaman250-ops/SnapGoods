import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
dotenv.config();

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const databaseId = config.firestoreDatabaseId;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = getFirestore(admin.app(), databaseId);

async function fixClaims() {
  const users = await db.collection('users').get();
  for (const doc of users.docs) {
    const data = doc.data();
    try {
      const userRecord = await admin.auth().getUser(doc.id);
      if (data.orgId) {
        if (!userRecord.customClaims || userRecord.customClaims.orgId !== data.orgId || userRecord.customClaims.role !== data.role) {
           console.log(`Fixing claims for ${data.email}...`);
           await admin.auth().setCustomUserClaims(doc.id, {
             orgId: data.orgId,
             role: data.role
           });
           console.log(`Fixed claims for ${data.email}`);
        }
      }
    } catch(e) {
      console.log(`Error updating ${doc.id}:`, e);
    }
  }
}

fixClaims().then(() => process.exit(0));
