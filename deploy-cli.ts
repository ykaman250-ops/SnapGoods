import * as fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

fs.writeFileSync('key.json', process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

// write firebase.json manually to point to the named database
fs.writeFileSync('firebase.json', JSON.stringify({
  firestore: {
    rules: "firestore.rules",
    database: "nv-rpj-db"
  }
}));

try {
  const output = execSync('GOOGLE_APPLICATION_CREDENTIALS=key.json npx firebase-tools deploy --only firestore:rules --project nv-it-assets-rpj', { encoding: 'utf8' });
  console.log(output);
} catch (e: any) {
  console.error("Deploy failed:");
  console.error(e.stdout || e.message);
  console.error(e.stderr);
}
