"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
// @ts-ignore
const logger = __importStar(require("firebase-functions/logger"));
// @ts-ignore
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const express_1 = __importDefault(require("express"));
// @ts-ignore
const cors_1 = __importDefault(require("cors"));
// Initialize Firebase Admin (Uses default credentials in Cloud Functions environment)
admin.initializeApp();
// Load the DB ID (Defaulting to nv-rpj-db as specified in your setup)
const databaseId = "nv-rpj-db";
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Verify Admin Middleware
const verifyAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers['x-firebase-auth'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized. Missing Bearer token.' });
        return;
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        // Hardcoded superadmins or verify from firestore
        if (decodedToken.email !== 'adminrajpura@nvgroup.co.in' && decodedToken.email !== 'ykaman250@gmail.com') {
            const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
            const userDoc = await db.collection('users').doc(decodedToken.uid).get();
            if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
                res.status(403).json({ error: 'Forbidden. Admin access required.' });
                return;
            }
        }
        req.user = decodedToken;
        next();
    }
    catch (error) {
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
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
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
    }
    catch (error) {
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
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
        await db.collection('users').doc(uid).delete();
        logger.info(`Successfully deleted user string: ${uid}`);
        res.status(200).json({ message: "User deleted successfully" });
    }
    catch (error) {
        // If the auth user doesn't exist but we want to delete perfectly gracefully, just proceed to delete FS
        if (error.code === 'auth/user-not-found') {
            try {
                const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
                await db.collection('users').doc(req.params.uid).delete();
                res.status(200).json({ message: "User document cleaned up (auth not found)." });
                return;
            }
            catch (fsError) {
                // Ignored
            }
        }
        logger.error(`Failed to delete user ${req.params.uid}:`, error);
        res.status(500).json({ error: `Failed to delete user: ${error.message || error}` });
    }
});
// Export the express app as a Firebase HTTP variable named 'api'
exports.api = (0, https_1.onRequest)({ cors: true, invoker: 'public' }, app);
//# sourceMappingURL=index.js.map