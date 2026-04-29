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

  const rulesetName = 'projects/nv-it-assets-rpj/rulesets/c23358e5-e592-476a-83c3-d765f291e23c';

  // 2. Update the release for nv-rpj-db
  const releaseName = `projects/${serviceAccount.project_id}/releases/cloud.firestore/nv-rpj-db`;
  console.log("Updating release:", releaseName);
  
  const updateRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      release: {
        name: releaseName,
        rulesetName: rulesetName
      }
    })
  });

  const updateData = await updateRes.json();
  console.log("Response:", updateData);
}
run();
