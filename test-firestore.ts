import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
dotenv.config();

let databaseId = "ai-studio-e446eeb6-e4d6-4eed-885c-d2bc134e5cbd";
let projectId = "gen-lang-client-0772958946";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || projectId
});
const db = getFirestore(admin.app(), databaseId);
async function run() {
  const users = await db.collection('users').get();
  users.forEach(u => console.log('User:', u.id, u.data().email, u.data().orgId));
}
run();
