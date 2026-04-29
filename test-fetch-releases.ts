import admin from 'firebase-admin';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  const token = await admin.credential.cert(serviceAccount).getAccessToken();
  const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${serviceAccount.project_id}/releases`, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const data = await res.json();
  console.log("Releases:", JSON.stringify(data, null, 2));
}
run();
