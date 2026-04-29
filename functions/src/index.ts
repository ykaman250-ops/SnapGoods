// @ts-ignore
import * as logger from "firebase-functions/logger";
// @ts-ignore
import { onRequest } from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import express from 'express';
// @ts-ignore
import cors from 'cors';

// Initialize Firebase Admin (Uses default credentials in Cloud Functions environment)
admin.initializeApp();

// Load the DB ID (Defaulting to nv-rpj-db as specified in your setup)
const databaseId = "nv-rpj-db";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Verify Admin Middleware
const verifyAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization || req.headers['x-firebase-auth'] as string;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized. Missing Bearer token.' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Hardcoded superadmins or verify from firestore
    if (decodedToken.email !== 'adminrajpura@nvgroup.co.in' && decodedToken.email !== 'ykaman250@gmail.com') {
      const db = getFirestore(admin.app(), databaseId);
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden. Admin access required.' });
        return;
      }
    }

    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    logger.error('Token verification failed:', error);
    res.status(401).json({ error: `Unauthorized. Invalid token.` });
    return;
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: 'firebase-functions' });
});

// Admin User Creation Route
app.post("/api/admin/create-user", verifyAdmin, async (req, res) => {
  try {
    const { email, password, name, displayName, role } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const finalName = name || displayName || email.split('@')[0];

    // 1. Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: finalName,
    });

    // 2. Insert the user record into the custom Firestore database instance
    const db = getFirestore(admin.app(), databaseId);
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      name: finalName,
      role: role || 'user',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    logger.info(`Successfully created user: ${email}`);
    res.status(201).json({ 
      message: `User ${email} created successfully`,
      uid: userRecord.uid 
    });
  } catch (error: any) {
    logger.error('Failed to create user:', error);
    res.status(500).json({ error: `Failed to create user: ${error.message || error}` });
  }
});

// Admin User Deletion Route
app.delete("/api/admin/users/:uid", verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    
    // 1. Delete from Firebase Auth
    await admin.auth().deleteUser(uid);
    
    // 2. Delete from Firestore database
    const db = getFirestore(admin.app(), databaseId);
    await db.collection('users').doc(uid).delete();
    
    logger.info(`Successfully deleted user string: ${uid}`);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error: any) {
    // If the auth user doesn't exist but we want to delete perfectly gracefully, just proceed to delete FS
    if (error.code === 'auth/user-not-found') {
      try {
        const db = getFirestore(admin.app(), databaseId);
        await db.collection('users').doc(req.params.uid).delete();
        res.status(200).json({ message: "User document cleaned up (auth not found)." });
        return;
      } catch (fsError) {
        // Ignored
      }
    }
    
    logger.error(`Failed to delete user ${req.params.uid}:`, error);
    res.status(500).json({ error: `Failed to delete user: ${error.message || error}` });
  }
});

// Export the express app as a Firebase HTTP variable named 'api'
export const api = onRequest({ cors: true, invoker: 'public' }, app);
