/**
 * DEVELOPMENT SERVER ONLY
 * =======================
 * This file is required for the local development environment and the AI Studio live preview.
 * It serves the Vite React application and runs the local Express API endpoints.
 * 
 * FOR FIREBASE DEPLOYMENT (Method 2):
 * This file is IGNORBED natively during 'firebase deploy'. 
 * Instead, Firebase uses the Express application successfully refactored 
 * independently inside the `functions/src/index.ts` directory.
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Attempt to load firebase config to get database ID natively
let databaseId = "ai-studio-e446eeb6-e4d6-4eed-885c-d2bc134e5cbd";
let projectId = "gen-lang-client-0772958946";
try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
    if (config.projectId) projectId = config.projectId;
  }
} catch (e) {
  console.log("Could not load config, using default.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
try {
  const keyPath = path.join(process.cwd(), 'key.json');
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId
    });
    console.log("Firebase Admin Initialized Successfully from ENV");
  } else if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId
    });
    console.log("Firebase Admin Initialized Successfully from key.json");
  } else {
    // Attempt default initialization if running on Google Cloud / AI Studio managed environment
    admin.initializeApp({
      projectId: projectId
    });
    console.log("Firebase Admin Initialized with Default Credentials and Explicit Project ID");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Verify User Middleware
  const verifyUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized. Missing Bearer token.' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const db = getFirestore(admin.app(), databaseId);
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      let activeOrgId = userDoc.data()?.activeOrgId;
      let role = activeOrgId && userDoc.data()?.orgRoles ? userDoc.data().orgRoles[activeOrgId] : 'viewer';

      if (!userDoc.exists) {
        // Fallback for hardcoded superadmins
        const email = decodedToken.email;
        if (email === 'adminrajpura@nvgroup.co.in' || email === 'ykaman250@gmail.com' || email === 'amammehra121@gmail.com' || email === 'nvrajpura@nvgroup.co.in') {
           role = 'superadmin';
           // Give superadmin a recognizable 'all' or specific orgId if needed, but normally they query without orgId limitation if they want all.
        } else {
           return res.status(403).json({ error: 'User profile not found.' });
        }
      }
      
      (decodedToken as any).activeOrgId = activeOrgId;
      (decodedToken as any).role = role;
      (req as any).user = decodedToken;
      next();
    } catch (error: any) {
      console.error('User Token verification failed:', error);
      return res.status(401).json({ error: `Unauthorized. Invalid token. Internal Error: ${error.message || error}` });
    }
  };

  app.get("/api/notifications", verifyUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const db = getFirestore(admin.app(), databaseId);
      
      let q: admin.firestore.Query = db.collection('notifications');
      if (user.orgId) {
         q = q.where('orgId', '==', user.orgId);
      } else if (user.role !== 'superadmin') {
         return res.json([]);
      }
      const snapshot = await q.get();
      
      const notifs: any[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.userId && d.userId !== user.uid) return;
        
        let createdAt = d.createdAt;
        if (createdAt && typeof createdAt.toDate === 'function') {
          createdAt = createdAt.toDate().toISOString();
        }
        notifs.push({ ...d, id: doc.id, createdAt });
      });
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(notifs.slice(0, 50));
    } catch(e: any) {
      console.error("Fetch notifications error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/notifications/:id/read", verifyUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const notifId = req.params.id;
      const db = getFirestore(admin.app(), databaseId);
      const docRef = db.collection('notifications').doc(notifId);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists) return res.status(404).json({ error: 'Not found' });
      const data = docSnap.data()!;
      if (data.orgId !== user.orgId && user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      if (data.userId && data.userId !== user.uid) return res.status(403).json({ error: 'Forbidden' });
      
      await docRef.update({
        read: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch(e: any) {
      console.error("Update notification error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Verify Admin Middleware
  const verifyAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log("verifyAdmin called!");
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized. Missing Bearer token.' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      console.log("Verifying token with admin SDK...");
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log("Token verified successfully for:", decodedToken.email);
      
      // Specifically check for our fixed superadmin, or fetch firestore user role
      if (decodedToken.email !== 'adminrajpura@nvgroup.co.in' && decodedToken.email !== 'ykaman250@gmail.com' && decodedToken.email !== 'amammehra121@gmail.com' && decodedToken.email !== 'nvrajpura@nvgroup.co.in') {
        const db = getFirestore(admin.app(), databaseId);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const activeOrgId = userDoc.data()?.activeOrgId;
        const role = activeOrgId && userDoc.data()?.orgRoles ? userDoc.data().orgRoles[activeOrgId] : null;
        
        if (!userDoc.exists || (role !== 'admin' && role !== 'owner')) {
          return res.status(403).json({ error: 'Forbidden. Admin access required.' });
        }
        (decodedToken as any).activeOrgId = activeOrgId;
        (decodedToken as any).role = role;
      } else {
        (decodedToken as any).role = 'superadmin';
      }

      (req as any).user = decodedToken;
      next();
    } catch (error: any) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: `Unauthorized. Invalid token. Internal Error: ${error.message || error}` });
    }
  };

  // API routes
  app.get("/api/test-key", (req, res) => {
    res.json({ key: process.env.GEMINI_API_KEY?.substring(0, 5) });
  });

// Limit in memory requests
const rateLimits = new Map<string, { count: number, resetTime: number }>();

app.post("/api/extract-assets", async (req, res) => {
  // Simple IP/User string based rate limiting
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let limit = rateLimits.get(ip);
  if (!limit || now > limit.resetTime) {
    limit = { count: 0, resetTime: now + 60000 }; // 1 minute
  }
  if (limit.count >= 5) { // Max 5 per minute
    return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
  }
  limit.count++;
  rateLimits.set(ip, limit);

  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: "Missing or invalid 'text' payload." });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Input text exceeds maximum length of 2000 characters." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API integration isn't configured on the server." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract assets from this text: "${text}"`,
      config: {
        systemInstruction: `You are an expert asset extractor. 
Return ONLY a JSON object with an array named 'assets'. No markdown blocks, no explanation.
Fields required: name, category, quantity (number), and assignedTo (Array of strings).
Normalize asset names gracefully. Do not include any text outside the JSON structure.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  assignedTo: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["name", "category", "quantity", "assignedTo"]
              }
            }
          },
          required: ["assets"]
        }
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("No text returned from Gemini");

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch(e) {
       console.error("Gemini returned invalid json:", rawText);
       return res.status(500).json({ error: "AI returned invalid format." });
    }

    res.json(parsed);
  } catch(e: any) {
    console.error("Extraction error:", e);
    // Determine if it's an API Key issue
    if (e.message?.includes("API key not valid") || e.status === 400 || String(e).includes("API_KEY_INVALID")) {
      return res.status(500).json({ 
        error: "AI extraction is currently under maintenance. Please try again later." 
      });
    }
    res.status(500).json({ error: "Internal server error during extraction.", details: String(e) });
  }
});

app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      adminInitialized: admin.apps.length > 0,
      envKeyPresent: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      projectId: admin.apps.length > 0 ? admin.app().options.projectId : null
    });
  });

  // Organization Creation Route
  app.post("/api/create-organization", async (req, res) => {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && admin.apps.length === 0) {
        return res.status(500).json({ error: 'System Configuration Error: Firebase Service Account Key is missing.' });
      }

      const { email, password, orgName, adminName, industry, country, currency, designation } = req.body;

      if (!email || !password || !orgName || !adminName || !industry || !country) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const generateHumanId = (path: string): string => {
        const prefixMap: Record<string, string> = {
          organizations: 'org',
          users: 'usr',
        };
        const prefix = prefixMap[path] || 'doc';
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 7; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const timePart = Date.now().toString(36).toUpperCase().slice(-4);
        return `${prefix}_${timePart}${result}`;
      };

      const customUid = generateHumanId('users');

      // 1. Create User in Firebase Auth
      const userRecord = await admin.auth().createUser({
        uid: customUid,
        email,
        password,
        displayName: adminName,
        emailVerified: true
      });

      const db = getFirestore(admin.app(), databaseId);
      
      // 2. Create Organization Document
      const customOrgId = generateHumanId('organizations');
      const orgRef = db.collection('organizations').doc(customOrgId);
      await orgRef.set({
        name: orgName,
        industry,
        country,
        currency: currency || 'USD',
        createdBy: userRecord.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        plan: 'free',
        ownerIds: [userRecord.uid],
        userCount: 1
      });

      // 3. Create User Profile
      await db.collection('users').doc(userRecord.uid).set({
        email,
        name: adminName,
        designation: designation || 'Owner',
        status: 'active',
        activeOrgId: orgRef.id,
        orgRoles: { [orgRef.id]: 'owner' },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Set Custom Claims
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        orgId: orgRef.id,
        role: 'owner'
      });

      res.status(201).json({ message: 'Organization created successfully', uid: userRecord.uid, orgId: orgRef.id });
    } catch (error: any) {
      console.error('Error creating organization:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

    // Create Invite Route (Admin/Owner only)
  app.post("/api/admin/invites", verifyAdmin, async (req, res) => {
    try {
      const { email, role } = req.body;
      const adminToken = (req as any).user;
      
      if (!email || !role) return res.status(400).json({ error: 'Missing email or role' });

      const db = getFirestore(admin.app(), databaseId);
      
      const adminOrgId = adminToken.orgId;
      if (!adminOrgId && adminToken.role !== 'superadmin') {
         return res.status(403).json({ error: 'Admin does not belong to any organization.' });
      }

      // Generate secure random token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      await db.collection('invites').doc(token).set({
        email,
        role,
        orgId: adminOrgId || req.body.orgId,
        createdBy: adminToken.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });

      res.status(201).json({ message: 'Invite created', token });
    } catch (error: any) {
      console.error('Error creating invite:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Accept Invite Route
  app.post("/api/accept-invite", async (req, res) => {
    try {
      const { token, password, name } = req.body;
      
      if (!token || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const db = getFirestore(admin.app(), databaseId);
      const inviteDoc = await db.collection('invites').doc(token).get();

      if (!inviteDoc.exists || inviteDoc.data()?.status !== 'pending') {
        return res.status(400).json({ error: 'Invalid or expired invite token.' });
      }

      const inviteData = inviteDoc.data()!;
      const email = inviteData.email;

      const generateHumanId = (path: string): string => {
        const prefixMap: Record<string, string> = { users: 'usr' };
        const prefix = prefixMap[path] || 'doc';
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 7; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const timePart = Date.now().toString(36).toUpperCase().slice(-4);
        return `${prefix}_${timePart}${result}`;
      };

      const customUid = generateHumanId('users');

      // Create user
      const userRecord = await admin.auth().createUser({
        uid: customUid,
        email,
        password,
        displayName: name,
        emailVerified: true
      });

      // Create profile
      await db.collection('users').doc(userRecord.uid).set({
        email,
        name,
        status: 'active',
        activeOrgId: inviteData.orgId,
        orgRoles: { [inviteData.orgId]: inviteData.role },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await admin.auth().setCustomUserClaims(userRecord.uid, {
        orgId: inviteData.orgId,
        role: inviteData.role
      });
      
      if (inviteData.role === 'owner') {
        await db.collection('organizations').doc(inviteData.orgId).update({
          ownerIds: admin.firestore.FieldValue.arrayUnion(userRecord.uid)
        });
      }

      // Mark invite used
      await db.collection('invites').doc(token).update({ status: 'accepted', usedBy: userRecord.uid });

      res.status(200).json({ message: 'Invite accepted safely' });
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Secure Admin User Creation Route
  app.post("/api/admin/create-user", verifyAdmin, async (req, res) => {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        return res.status(500).json({ error: 'System Configuration Error: Firebase Service Account Key is missing. Please add FIREBASE_SERVICE_ACCOUNT_KEY to your environment variables to enable user management.' });
      }

      const { email, password, name, role } = req.body;
      const adminToken = (req as any).user;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const db = getFirestore(admin.app(), databaseId);
      
      // Get the admin's true orgId
      let adminOrgId = adminToken.activeOrgId;
      if (!adminOrgId) {
        const adminDoc = await db.collection('users').doc(adminToken.uid).get();
        if (adminDoc.exists) {
           adminOrgId = adminDoc.data()?.activeOrgId;
        }
      }

      if (!adminOrgId && adminToken.role !== 'superadmin') {
         return res.status(403).json({ error: 'Admin does not belong to any organization.' });
      }

      // Try to create user in Firebase Auth, or fetch if exists
      let userRecord;
      try {
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: true, // We auto-verify since the admin made it, or leave false to force them to verify.
          password,
          displayName: name
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          userRecord = await admin.auth().getUserByEmail(email);
        } else {
          throw authError; // Re-throw if it's a different error
        }
      }

      // Add or update matching Firestore profile
      const newRole = role || 'viewer';
      const targetOrgId = adminOrgId || req.body.orgId; // Fallback if superadmin creates
      
      if (!targetOrgId) {
        return res.status(400).json({ error: 'Target organization ID is required.' });
      }

      await db.collection('users').doc(userRecord.uid).set({
        email,
        name,
        status: 'active',
        activeOrgId: targetOrgId,
        orgRoles: { [targetOrgId]: newRole },
      }, { merge: true });

      // Set Custom Claims
      const currentClaims = userRecord.customClaims || {};
      const newOrgRoles = currentClaims.orgRoles || {};
      newOrgRoles[targetOrgId] = newRole;

      await admin.auth().setCustomUserClaims(userRecord.uid, {
        ...currentClaims,
        orgRoles: newOrgRoles,
        orgId: targetOrgId,
        role: currentClaims.role || newRole
      });

      res.status(201).json({ message: 'User created or updated successfully', uid: userRecord.uid });
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Secure Admin User Deletion Route
  app.delete("/api/admin/users/:uid", verifyAdmin, async (req, res) => {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        return res.status(500).json({ error: 'System Configuration Error: Firebase Service Account Key is missing. Please add FIREBASE_SERVICE_ACCOUNT_KEY to your environment variables to enable user management.' });
      }

      const { uid } = req.params;

      if (!uid) {
        return res.status(400).json({ error: 'Missing required user ID.' });
      }

      const db = getFirestore(admin.app(), databaseId);
      
      const adminToken = (req as any).user;
      const adminRole = adminToken.role;

      // Prevent self-deletion
      if (uid === adminToken.uid) {
        return res.status(400).json({ error: 'You cannot delete your own account.' });
      }

      let adminOrgId = adminToken.activeOrgId;

      if (!adminOrgId && adminRole !== 'superadmin') {
         return res.status(403).json({ error: 'Admin does not belong to any organization.' });
      }

      // Prevent deleting superadmin
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data()?.email === 'adminrajpura@nvgroup.co.in') {
         return res.status(403).json({ error: 'Superadmin cannot be deleted.' });
      }

      const targetOrgId = req.query.orgId as string || adminOrgId;
      if (!targetOrgId) {
        return res.status(400).json({ error: 'Target organization ID is required.' });
      }

      const targetOrgRole = userDoc.data()?.orgRoles?.[targetOrgId];
      if (adminRole !== 'superadmin' && adminOrgId !== targetOrgId) {
         return res.status(403).json({ error: 'Cannot remove users in other organizations.' });
      }
      if (!targetOrgRole) {
         return res.status(404).json({ error: 'User is not in the specified organization.' });
      }
      
      // Prevent deleting if target is owner and admin is not superadmin
      if (adminRole === 'admin' && targetOrgRole === 'owner') {
         return res.status(403).json({ error: 'Admins cannot remove owners.' });
      }

      // Prevent removing last owner
      if (targetOrgRole === 'owner') {
        const orgDoc = await db.collection('organizations').doc(targetOrgId).get();
        const ownerIds = orgDoc.data()?.ownerIds || [];
        if (ownerIds.length <= 1 && ownerIds.includes(uid)) {
          return res.status(400).json({ error: 'Cannot remove the last owner of the organization.' });
        }
      }

      // Remove the orgRole from custom claims and Firestore profile.
      await db.collection('users').doc(uid).update({
        [`orgRoles.${targetOrgId}`]: admin.firestore.FieldValue.delete()
      });

      const authUser = await admin.auth().getUser(uid);
      const currentClaims = authUser.customClaims || {};
      const newOrgRoles = currentClaims.orgRoles || {};
      delete newOrgRoles[targetOrgId];

      let newActiveOrgId = currentClaims.orgId;
      if (currentClaims.orgId === targetOrgId) {
          newActiveOrgId = Object.keys(newOrgRoles).length > 0 ? Object.keys(newOrgRoles)[0] : null;
      }

      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        orgRoles: newOrgRoles,
        orgId: newActiveOrgId
      });

      if (userDoc.data()?.activeOrgId === targetOrgId) {
          await db.collection('users').doc(uid).update({
            activeOrgId: newActiveOrgId
          });
      }

      // If user was an owner, make sure to remove them from org ownerIds
      if (targetOrgRole === 'owner') {
         await db.collection('organizations').doc(targetOrgId).update({
           ownerIds: admin.firestore.FieldValue.arrayRemove(uid)
         });
      }

      res.status(200).json({ message: 'User removed from organization successfully' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Secure Role Update Route
  app.put("/api/admin/users/:uid/role", verifyAdmin, async (req, res) => {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        return res.status(500).json({ error: 'System Configuration Error: Firebase Service Account Key is missing.' });
      }

      const { uid } = req.params;
      const { role } = req.body;
      const adminToken = (req as any).user;

      if (uid === adminToken.uid) {
        return res.status(400).json({ error: 'You cannot change your own role.' });
      }

      if (!uid || !role) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const db = getFirestore(admin.app(), databaseId);
      
      const adminOrgId = adminToken.activeOrgId;
      const adminRole = adminToken.role;

      if (!adminOrgId && adminRole !== 'superadmin') {
         return res.status(403).json({ error: 'Admin does not belong to any organization.' });
      }

      // Get target user
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
         return res.status(404).json({ error: 'User not found.' });
      }

      const userData = userDoc.data()!;
      // Use req.body.orgId if provided, otherwise fallback to admin's active root org (or user's for superadmin)
      const targetOrgId = req.body.orgId || (adminRole === 'superadmin' ? (userData.activeOrgId || adminOrgId) : adminOrgId);
      
      if (!targetOrgId) {
        return res.status(400).json({ error: 'Target organization ID is required.' });
      }
      
      const targetOrgRole = userData.orgRoles?.[targetOrgId];

      if (adminRole !== 'superadmin' && adminOrgId !== targetOrgId) {
         return res.status(403).json({ error: 'Cannot modify users in other organizations.' });
      }

      // Permissions check
      if (adminRole === 'admin' && (targetOrgRole === 'owner' || role === 'owner')) {
         return res.status(403).json({ error: 'Admins cannot modify owners or grant owner role.' });
      }

      // Last owner check
      if (targetOrgRole === 'owner' && role !== 'owner') {
        const orgDoc = await db.collection('organizations').doc(targetOrgId).get();
        const ownerIds = orgDoc.data()?.ownerIds || [];
        if (ownerIds.length <= 1 && ownerIds.includes(uid)) {
          return res.status(400).json({ error: 'Cannot demote the last owner of the organization.' });
        }
      }

      // Update Firestore profile
      await db.collection('users').doc(uid).update({ 
        [`orgRoles.${targetOrgId}`]: role 
      });

      // Update Claims
      const authUser = await admin.auth().getUser(uid);
      const currentClaims = authUser.customClaims || {};
      const newOrgRoles = currentClaims.orgRoles || {};
      newOrgRoles[targetOrgId] = role;

      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        orgRoles: newOrgRoles,
        orgId: targetOrgId,
        role: currentClaims.role || role // fallback
      });

      // Update Org Owners Array
      if (role === 'owner' && targetOrgRole !== 'owner') {
        await db.collection('organizations').doc(targetOrgId).update({
          ownerIds: admin.firestore.FieldValue.arrayUnion(uid)
        });
      } else if (targetOrgRole === 'owner' && role !== 'owner') {
        await db.collection('organizations').doc(targetOrgId).update({
          ownerIds: admin.firestore.FieldValue.arrayRemove(uid)
        });
      }

      res.status(200).json({ message: 'User role updated successfully' });
    } catch (error: any) {
      console.error('Error updating user role:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Secure Admin Organization Deletion Route
  app.delete("/api/admin/organizations/:orgId", verifyAdmin, async (req, res) => {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && admin.apps.length === 0) {
        return res.status(500).json({ error: 'System Configuration Error: Firebase Service Account Key is missing.' });
      }

      const { orgId } = req.params;
      const adminToken = (req as any).user;
      
      const db = getFirestore(admin.app(), databaseId);
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      
      if (!orgDoc.exists) {
        return res.status(404).json({ error: 'Organization not found.' });
      }
      
      // Permissions check: Superadmin or Owner of the org
      if (adminToken.role !== 'superadmin' && !(adminToken.role === 'owner' && adminToken.activeOrgId === orgId)) {
         return res.status(403).json({ error: 'Only owners or superadmins can delete organizations.' });
      }

      // Cleanup Users
      const usersSnapshot = await db.collection('users').get();
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.orgRoles && userData.orgRoles[orgId]) {
          const orgRolesCount = Object.keys(userData.orgRoles).length;
          if (orgRolesCount <= 1) {
            // Only member of this org, delete the whole auth user and profile
            try {
              if (userDoc.id !== adminToken.uid) { // Avoid deleting the admin during the loop, we'll do it last or rely on them signing out
                await admin.auth().deleteUser(userDoc.id).catch((e) => console.error("Firebase auth delete error for user", userDoc.id, e));
              }
              await db.collection('users').doc(userDoc.id).delete();
            } catch (e) {
               console.error("Failed to delete user", userDoc.id, e);
            }
          } else {
            // Has other orgs, just remove from this one
            const updates: any = {
              [`orgRoles.${orgId}`]: admin.firestore.FieldValue.delete()
            };
            if (userData.activeOrgId === orgId) {
              const remainingOrgs = Object.keys(userData.orgRoles).filter(id => id !== orgId);
              updates.activeOrgId = remainingOrgs.length > 0 ? remainingOrgs[0] : null;
            }
            await db.collection('users').doc(userDoc.id).update(updates);
          }
        }
      }
      
      // Note: We leave deleting the subcollections to a script or just let them be orphaned
      // as Firestore doesn't have recursive delete without tools. Or we can manually clean them up.
      
      const collectionsToWipe = ['assets', 'employees', 'assignments', 'audit_logs', 'asset_history', 'asset_categories', 'maintenance_logs', 'locations', 'vendors', 'custom_reports', 'inventory_items', 'inventory_transactions'];
      
      for (const collName of collectionsToWipe) {
        const snapshot = await db.collection(collName).where('orgId', '==', orgId).get();
        if (!snapshot.empty) {
          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += 500) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + 500);
            chunk.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
        }
      }

      // Delete organization doc itself
      await db.collection('organizations').doc(orgId).delete();
      
      // Finally delete the admin auth user if it was their only org
      const adminUserDocRaw = await db.collection('users').doc(adminToken.uid).get();
      if (!adminUserDocRaw.exists) {
         await admin.auth().deleteUser(adminToken.uid).catch((e) => console.error("Firebase auth delete error for admin", adminToken.uid, e));
      }

      res.status(200).json({ message: 'Organization deleted.' });
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
