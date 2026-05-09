// @ts-ignore
import * as logger from "firebase-functions/logger";
// @ts-ignore
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import express from 'express';
// @ts-ignore
import cors from 'cors';

import { GoogleGenAI, Type } from "@google/genai";

// Initialize Firebase Admin (Uses default credentials in Cloud Functions environment)
admin.initializeApp();

// Load the DB ID (Defaulting to snapgoods-prod as specified in your setup)
const databaseId = "snapgoods-prod";

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

// Limit in memory requests for simple rate limiting if deployed on a single instance (better to use Firestore or a cache in prod)
const rateLimits = new Map<string, { count: number, resetTime: number }>();

app.post("/api/extract-assets", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let limit = rateLimits.get(ip);
  if (!limit || now > limit.resetTime) {
    limit = { count: 0, resetTime: now + 60000 }; // 1 minute
  }
  if (limit.count >= 5) { // Max 5 per minute
    res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
    return;
  }
  limit.count++;
  rateLimits.set(ip, limit);

  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: "Missing or invalid 'text' payload." });
    return;
  }
  if (text.length > 2000) {
    res.status(400).json({ error: "Input text exceeds maximum length of 2000 characters." });
    return;
  }

  // Uses Firebase environment variable for the secret if set or process.env directly.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Gemini API integration isn't configured on the server." });
    return;
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
       res.status(500).json({ error: "AI returned invalid format." });
       return;
    }

    res.json(parsed);
  } catch(e: any) {
    console.error("Extraction error:", e);
    if (e.message?.includes("API key not valid") || e.status === 400 || String(e).includes("API_KEY_INVALID")) {
      res.status(500).json({ 
        error: "AI extraction is currently under maintenance. Please try again later." 
      });
      return;
    }
    res.status(500).json({ error: "Internal server error during extraction.", details: String(e) });
  }
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

export const dailyAssetChecks = onSchedule({ schedule: "every day 00:00", timeoutSeconds: 300, memory: '256MiB' }, async (event) => {
  const db = getFirestore(admin.app(), databaseId);
  const now = new Date();
  
  try {
    // 1. Process all assets to check for lifecycle/warranty/maintenance
    const assetsSnapshot = await db.collection('assets').get();
    
    const batch = db.batch();
    let updates = 0;
    
    for (const doc of assetsSnapshot.docs) {
      const asset = doc.data();
      const orgId = asset.orgId;
      if (!orgId) continue;
      
      let needsUpdate = false;
      const updatesToAsset: any = {};
      
      // A. WARRANTY ALERTS (Within next 7 days)
      if (asset.warrantyExpiry) {
        const warrantyDate = new Date(asset.warrantyExpiry);
        const diffDays = Math.ceil((warrantyDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays >= 0 && diffDays <= 7 && !asset.lastWarrantyAlertSentAt) {
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            orgId,
            userId: null,
            type: 'warranty',
            message: `Warranty for ${asset.name} (${asset.assetCode}) is expiring in ${diffDays} days.`,
            relatedEntityId: doc.id,
            read: false,
            createdAt: now.toISOString()
          });
          updatesToAsset.lastWarrantyAlertSentAt = now.toISOString();
          needsUpdate = true;
          updates++;
        }
      }
      
      // B. MAINTENANCE ALERTS (Due or overdue)
      if (asset.nextServiceDate) {
        const serviceDate = new Date(asset.nextServiceDate);
        const diffDays = Math.ceil((serviceDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays <= 0 && !asset.lastMaintenanceAlertSentAt) {
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            orgId,
            userId: null,
            type: 'maintenance',
            message: `Maintenance for ${asset.name} (${asset.assetCode}) is due.`,
            relatedEntityId: doc.id,
            read: false,
            createdAt: now.toISOString()
          });
          updatesToAsset.lastMaintenanceAlertSentAt = now.toISOString();
          needsUpdate = true;
          updates++;
        }
      }
      
      // C. LIFECYCLE ALERTS
      if (asset.purchaseDate && asset.usefulLifeYears) {
        const purchaseDate = new Date(asset.purchaseDate);
        const endOfLifeDate = new Date(purchaseDate.getTime());
        endOfLifeDate.setFullYear(endOfLifeDate.getFullYear() + asset.usefulLifeYears);
        
        const diffDays = Math.ceil((endOfLifeDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays <= 30 && !asset.lastLifecycleAlertSentAt) {
          const notifRef = db.collection('notifications').doc();
          const isExpired = diffDays <= 0;
          batch.set(notifRef, {
            orgId,
            userId: null,
            type: 'lifecycle',
            message: isExpired ? `Asset ${asset.name} (${asset.assetCode}) has reached its end of useful life.` : `Asset ${asset.name} (${asset.assetCode}) is nearing its end of useful life (in ${Math.max(0, diffDays)} days).`,
            relatedEntityId: doc.id,
            read: false,
            createdAt: now.toISOString()
          });
          updatesToAsset.lastLifecycleAlertSentAt = now.toISOString();
          needsUpdate = true;
          updates++;
        }
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, updatesToAsset);
        // Commit batches of 500
        if (updates >= 400) {
          await batch.commit();
          updates = 0;
        }
      }
    }
    
    if (updates > 0) {
      await batch.commit();
    }
    
    logger.info(`Daily asset checks completed successfully. Processed batches.`);
  } catch (error) {
    logger.error('Failed to run daily asset checks', error);
  }
});
