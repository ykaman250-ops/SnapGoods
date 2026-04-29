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

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || projectId
  });
} else {
  admin.initializeApp({ projectId });
}

const db = getFirestore(admin.app(), databaseId);

const ORG_ID = 'M5k0faBm8sR6iey1ioqW';

async function migrateCollection(collectionName: string) {
  console.log(`Migrating ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  const batch = db.batch();
  let count = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.orgId) {
      batch.update(doc.ref, { orgId: ORG_ID });
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Updated ${count} documents in ${collectionName}.`);
  } else {
    console.log(`No documents needed update in ${collectionName}.`);
  }
}

async function run() {
  try {
    await migrateCollection('assets');
    await migrateCollection('employees');
    await migrateCollection('assignments');
    await migrateCollection('maintenance');
    await migrateCollection('audit_logs');
    
    console.log("Migration complete.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
