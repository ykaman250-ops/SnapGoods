import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

let databaseId = "ai-studio-e446eeb6-e4d6-4eed-885c-d2bc134e5cbd";
let projectId = "gen-lang-client-0772958946";
try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
    if (config.projectId) projectId = config.projectId;
  }
} catch (e) {}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || projectId
});

const db = getFirestore(admin.app(), databaseId);

async function run() {
  const ids = ['TeSyxI8tBF6Trbc2JZfc', 'yaHQWBBaIQRIBKKJOBUr', 'CGg6ZlPGsZRRTlDR7H8b', '12358'];
  for (const id of ids) {
    const d1 = await db.collection('assets').doc(id).get();
    console.log(`Asset ${id} exists?`, d1.exists);
    const d2 = await db.collection('employees').doc(id).get();
    console.log(`Employee ${id} exists?`, d2.exists);
  }
  process.exit(0);
}
run();
