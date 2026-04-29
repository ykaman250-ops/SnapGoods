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
  const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${serviceAccount.project_id}/rulesets`, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const data = await res.json();
  const latest = data.rulesets[0];
  console.log("Latest Ruleset:", latest.name);
  
  const rulesRes = await fetch(`https://firebaserules.googleapis.com/v1/${latest.name}`, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const rulesData = await rulesRes.json();
  console.log(rulesData.source.files[0].content);
}
run();
