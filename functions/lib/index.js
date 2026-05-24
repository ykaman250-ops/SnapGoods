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
exports.dailyAssetChecks = exports.api = void 0;
// @ts-ignore
const logger = __importStar(require("firebase-functions/logger"));
// @ts-ignore
const https_1 = require("firebase-functions/v2/https");
// @ts-ignore
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const express_1 = __importDefault(require("express"));
// @ts-ignore
const cors_1 = __importDefault(require("cors"));
const genai_1 = require("@google/genai");
// Initialize Firebase Admin (Uses default credentials in Cloud Functions environment)
admin.initializeApp();
// Load the DB ID (Defaulting to snapgoods-prod as specified in your setup)
const databaseId = "snapgoods-prod";
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
        if (decodedToken.email !== 'adminrajpura@nvgroup.co.in' && decodedToken.email !== 'ykaman250@gmail.com' && decodedToken.email !== 'amammehra121@gmail.com' && decodedToken.email !== 'nvrajpura@nvgroup.co.in') {
            const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
            const userDoc = await db.collection('users').doc(decodedToken.uid).get();
            const userData = userDoc.data();
            const activeOrgId = userData?.activeOrgId;
            let role = activeOrgId && userData?.orgRoles ? userData.orgRoles[activeOrgId] : null;
            // Fallback: If activeOrgId is not set, but user has an owner/admin role somewhere, use that
            if (!role && userData?.orgRoles) {
                const roles = Object.values(userData.orgRoles);
                if (roles.includes('owner'))
                    role = 'owner';
                else if (roles.includes('admin'))
                    role = 'admin';
            }
            if (!userDoc.exists || (role !== 'admin' && role !== 'owner' && role !== 'superadmin')) {
                res.status(403).json({ error: `Forbidden. Admin access required. (Found role: ${role})` });
                return;
            }
            decodedToken.activeOrgId = activeOrgId || (userData?.orgRoles ? Object.keys(userData.orgRoles)[0] : null);
            decodedToken.role = role;
        }
        else {
            decodedToken.role = 'superadmin';
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
// Limit in memory requests for simple rate limiting if deployed on a single instance (better to use Firestore or a cache in prod)
const rateLimits = new Map();
app.post("/api/create-organization", async (req, res) => {
    try {
        const { email, password, orgName, adminName, industry, country, currency, designation } = req.body;
        if (!email || !password || !orgName || !adminName || !industry || !country) {
            res.status(400).json({ error: 'Missing required fields.' });
            return;
        }
        const generateHumanId = (path) => {
            const prefixMap = {
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
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
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
    }
    catch (error) {
        console.error('Error creating organization:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
// Create Invite Route (Admin/Owner only)
app.post("/api/admin/invites", verifyAdmin, async (req, res) => {
    try {
        const { email, role } = req.body;
        const adminToken = req.user;
        if (!email || !role) {
            res.status(400).json({ error: 'Missing email or role' });
            return;
        }
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
        const adminOrgId = adminToken.activeOrgId || adminToken.orgId;
        if (!adminOrgId && adminToken.role !== 'superadmin') {
            res.status(403).json({ error: 'Admin does not belong to any organization.' });
            return;
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
    }
    catch (error) {
        console.error('Error creating invite:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
// Accept Invite Route
app.post("/api/accept-invite", async (req, res) => {
    try {
        const { token, password, name } = req.body;
        if (!token || !password || !name) {
            res.status(400).json({ error: 'Missing required fields.' });
            return;
        }
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
        const inviteDoc = await db.collection('invites').doc(token).get();
        if (!inviteDoc.exists || inviteDoc.data()?.status !== 'pending') {
            res.status(400).json({ error: 'Invalid or expired invite token.' });
            return;
        }
        const inviteData = inviteDoc.data();
        const email = inviteData.email;
        const generateHumanId = (path) => {
            const prefixMap = { users: 'usr' };
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
    }
    catch (error) {
        console.error('Error accepting invite:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
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
        const ai = new genai_1.GoogleGenAI({ apiKey });
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
                    type: genai_1.Type.OBJECT,
                    properties: {
                        assets: {
                            type: genai_1.Type.ARRAY,
                            items: {
                                type: genai_1.Type.OBJECT,
                                properties: {
                                    name: { type: genai_1.Type.STRING },
                                    category: { type: genai_1.Type.STRING },
                                    quantity: { type: genai_1.Type.NUMBER },
                                    assignedTo: {
                                        type: genai_1.Type.ARRAY,
                                        items: { type: genai_1.Type.STRING }
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
        if (!rawText)
            throw new Error("No text returned from Gemini");
        let parsed;
        try {
            parsed = JSON.parse(rawText);
        }
        catch (e) {
            console.error("Gemini returned invalid json:", rawText);
            res.status(500).json({ error: "AI returned invalid format." });
            return;
        }
        res.json(parsed);
    }
    catch (e) {
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
        const adminToken = req.user;
        const adminRole = adminToken.role;
        const newRole = role || 'viewer';
        if (adminRole === 'admin' && (newRole === 'owner' || newRole === 'admin')) {
            res.status(403).json({ error: 'Admins cannot create owners or admins.' });
            return;
        }
        const finalName = name || displayName || email.split('@')[0];
        // Get the admin's true orgId
        const targetOrgId = adminToken.activeOrgId || req.body.orgId; // Fallback if superadmin creates
        if (!targetOrgId && adminToken.role !== 'superadmin') {
            res.status(403).json({ error: 'Admin does not belong to any organization.' });
            return;
        }
        // 1. Create the user in Firebase Auth
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: finalName,
            });
        }
        catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
                userRecord = await admin.auth().getUserByEmail(email);
            }
            else {
                throw authError; // Re-throw if it's a different error
            }
        }
        // 2. Insert the user record into the custom Firestore database instance
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
        if (!targetOrgId) {
            res.status(400).json({ error: 'Target organization ID is required.' });
            return;
        }
        const userProfileRef = db.collection('users').doc(userRecord.uid);
        const userProfileSnap = await userProfileRef.get();
        let mergedOrgRoles = { [targetOrgId]: newRole };
        if (userProfileSnap.exists) {
            const existingRoles = userProfileSnap.data()?.orgRoles || {};
            mergedOrgRoles = { ...existingRoles, [targetOrgId]: newRole };
        }
        await userProfileRef.set({
            email: userRecord.email,
            name: finalName,
            status: 'active',
            activeOrgId: targetOrgId,
            orgRoles: mergedOrgRoles,
            createdAt: new Date().toISOString()
        }, { merge: true });
        // Set Custom Claims
        const currentClaims = userRecord.customClaims || {};
        const newOrgRoles = currentClaims.orgRoles || {};
        newOrgRoles[targetOrgId] = newRole;
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            ...currentClaims,
            role: newRole, // legacy backward compatibility
            activeOrgId: targetOrgId,
            orgRoles: newOrgRoles
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
        if (!uid) {
            res.status(400).json({ error: 'Missing required user ID.' });
            return;
        }
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
        const adminToken = req.user;
        const adminRole = adminToken.role;
        // Prevent self-deletion
        if (uid === adminToken.uid) {
            res.status(400).json({ error: 'You cannot delete your own account.' });
            return;
        }
        let adminOrgId = adminToken.activeOrgId;
        if (!adminOrgId && adminRole !== 'superadmin') {
            res.status(403).json({ error: 'Admin does not belong to any organization.' });
            return;
        }
        // Prevent deleting superadmin
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data()?.email === 'adminrajpura@nvgroup.co.in') {
            res.status(403).json({ error: 'Superadmin cannot be deleted.' });
            return;
        }
        const targetOrgId = req.query.orgId || adminOrgId;
        if (!targetOrgId) {
            res.status(400).json({ error: 'Target organization ID is required.' });
            return;
        }
        const targetOrgRole = userDoc.data()?.orgRoles?.[targetOrgId];
        if (adminRole !== 'superadmin' && adminOrgId !== targetOrgId) {
            res.status(403).json({ error: 'Cannot remove users in other organizations.' });
            return;
        }
        if (!targetOrgRole) {
            res.status(404).json({ error: 'User is not in the specified organization.' });
            return;
        }
        // Prevent deleting if target is owner and admin is not superadmin
        if (adminRole === 'admin' && targetOrgRole === 'owner') {
            res.status(403).json({ error: 'Admins cannot remove owners.' });
            return;
        }
        // Prevent removing last owner
        if (targetOrgRole === 'owner') {
            const orgDoc = await db.collection('organizations').doc(targetOrgId).get();
            const ownerIds = orgDoc.data()?.ownerIds || [];
            if (ownerIds.length <= 1 && ownerIds.includes(uid)) {
                res.status(400).json({ error: 'Cannot remove the last owner of the organization.' });
                return;
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
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
app.put("/api/admin/users/:uid/role", verifyAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        const { role } = req.body;
        const adminToken = req.user;
        if (uid === adminToken.uid) {
            res.status(400).json({ error: 'You cannot change your own role.' });
            return;
        }
        if (!uid || !role) {
            res.status(400).json({ error: 'Missing required fields.' });
            return;
        }
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
        const adminOrgId = adminToken.activeOrgId;
        const adminRole = adminToken.role;
        if (!adminOrgId && adminRole !== 'superadmin') {
            res.status(403).json({ error: 'Admin does not belong to any organization.' });
            return;
        }
        // Get target user
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            res.status(404).json({ error: 'User not found.' });
            return;
        }
        const userData = userDoc.data();
        // Use req.body.orgId if provided, otherwise fallback to admin's active root org (or user's for superadmin)
        const targetOrgId = req.body.orgId || (adminRole === 'superadmin' ? (userData.activeOrgId || adminOrgId) : adminOrgId);
        if (!targetOrgId) {
            res.status(400).json({ error: 'Target organization ID is required.' });
            return;
        }
        const targetOrgRole = userData.orgRoles?.[targetOrgId];
        if (adminRole !== 'superadmin' && adminOrgId !== targetOrgId) {
            res.status(403).json({ error: 'Cannot modify users in other organizations.' });
            return;
        }
        // Permissions check
        if (adminRole === 'admin' && (targetOrgRole === 'owner' || role === 'owner')) {
            res.status(403).json({ error: 'Admins cannot modify owners or grant owner role.' });
            return;
        }
        // Last owner check
        if (targetOrgRole === 'owner' && role !== 'owner') {
            const orgDoc = await db.collection('organizations').doc(targetOrgId).get();
            const ownerIds = orgDoc.data()?.ownerIds || [];
            if (ownerIds.length <= 1 && ownerIds.includes(uid)) {
                res.status(400).json({ error: 'Cannot demote the last owner of the organization.' });
                return;
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
        }
        else if (targetOrgRole === 'owner' && role !== 'owner') {
            await db.collection('organizations').doc(targetOrgId).update({
                ownerIds: admin.firestore.FieldValue.arrayRemove(uid)
            });
        }
        res.status(200).json({ message: 'User role updated successfully' });
    }
    catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
app.delete("/api/admin/organizations/:orgId", verifyAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const adminToken = req.user;
        const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (!orgDoc.exists) {
            res.status(404).json({ error: 'Organization not found.' });
            return;
        }
        // Permissions check: Superadmin or Owner of the org
        if (adminToken.role !== 'superadmin' && !(adminToken.role === 'owner' && adminToken.activeOrgId === orgId)) {
            res.status(403).json({ error: 'Only owners or superadmins can delete organizations.' });
            return;
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
                    }
                    catch (e) {
                        console.error("Failed to delete user", userDoc.id, e);
                    }
                }
                else {
                    // Has other orgs, just remove from this one
                    const updates = {
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
    }
    catch (error) {
        console.error('Error deleting organization:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
// Export the express app as a Firebase HTTP variable named 'api'
exports.api = (0, https_1.onRequest)({ cors: true, invoker: 'public' }, app);
exports.dailyAssetChecks = (0, scheduler_1.onSchedule)({ schedule: "every day 00:00", timeoutSeconds: 300, memory: '256MiB' }, async (event) => {
    const db = (0, firestore_1.getFirestore)(admin.app(), databaseId);
    const now = new Date();
    try {
        // 1. Process all assets to check for lifecycle/warranty/maintenance
        const assetsSnapshot = await db.collection('assets').get();
        const batch = db.batch();
        let updates = 0;
        for (const doc of assetsSnapshot.docs) {
            const asset = doc.data();
            const orgId = asset.orgId;
            if (!orgId)
                continue;
            let needsUpdate = false;
            const updatesToAsset = {};
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
    }
    catch (error) {
        logger.error('Failed to run daily asset checks', error);
    }
});
//# sourceMappingURL=index.js.map