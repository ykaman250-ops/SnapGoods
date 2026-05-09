import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import fs from "fs";

const key = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = initializeApp(key);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  await signInWithEmailAndPassword(auth, "adminrajpura@nvgroup.co.in", "111111");
  console.log("Logged in");
  
  const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", "adminrajpura@nvgroup.co.in")));
  const orgIdVal = userSnap.docs[0].data().orgId;
  console.log("Org is", orgIdVal);

  try {
    const q1 = query(collection(db, "asset_categories"), where("orgId", "==", orgIdVal));
    await getDocs(q1);
    console.log("asset_categories succeeded");
  } catch (e: any) {
    console.log("asset_categories failed", e.message);
  }

  try {
    const q2 = query(collection(db, "inventory_items"), where("orgId", "==", orgIdVal));
    await getDocs(q2);
    console.log("inventory_items succeeded");
  } catch (e: any) {
    console.log("inventory_items failed", e.message);
  }
}
run().catch(console.error);
