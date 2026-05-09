
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { api } from './api';
import { Asset, AssetHistory } from './types';

import { generateHumanId } from './api';

export const assetService = {
  // Example of strictly enforced "Cross-Tenant Querying Tax"
  async getAssets(activeOrgId: string) {
    if (!activeOrgId) throw new Error("activeOrgId is required for multi-tenant querying");
    
    // Explicitly scope the query to the tenant using activeOrgId
    const q = query(
      collection(db, 'assets'),
      where('orgId', '==', activeOrgId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
  },

  async createAsset(assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'orgId'>, orgId: string, customId?: string) {
    const assetId = customId || generateHumanId('assets');
    const assetRef = doc(db, 'assets', assetId);
    const timestamp = serverTimestamp();
    
    const finalAssetData = {
      ...assetData,
      orgId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const batch = writeBatch(db);
    batch.set(assetRef, finalAssetData);

    const historyId = generateHumanId('asset_history');
    const historyRef = doc(db, 'asset_history', historyId);
    const historyData: Omit<AssetHistory, 'id'> = {
      assetId: assetRef.id,
      orgId,
      action: 'created',
      performedBy: auth.currentUser?.email || 'system',
      timestamp: new Date().toISOString()
    };
    
    batch.set(historyRef, {
      ...historyData,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    return assetRef.id;
  },

  async updateAsset(assetId: string, updates: Partial<Asset>, orgId: string, previousData: Asset) {
    const assetRef = doc(db, 'assets', assetId);
    const batch = writeBatch(db);

    batch.update(assetRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    // Detect specific actions for history
    let action: AssetHistory['action'] = 'updated';
    let from = '';
    let to = '';

    if (updates.assignedTo !== undefined && updates.assignedTo !== previousData.assignedTo) {
      action = 'assigned';
      from = previousData.assignedTo || 'Unassigned';
      to = updates.assignedTo || 'Unassigned';
    } else if (updates.locationId !== undefined && updates.locationId !== previousData.locationId) {
      action = 'moved';
      from = previousData.locationId || 'Unknown';
      to = updates.locationId || 'Unknown';
    } else if (updates.status !== undefined && updates.status !== previousData.status) {
      action = 'status_changed';
      from = previousData.status;
      to = updates.status;
    }

    const historyId = generateHumanId('asset_history');
    const historyRef = doc(db, 'asset_history', historyId);
    batch.set(historyRef, {
      assetId,
      orgId,
      action,
      from,
      to,
      performedBy: auth.currentUser?.email || 'system',
      timestamp: serverTimestamp()
    });

    // Prune history to keep only the latest 10. We are adding 1, so keep 9 existing.
    try {
      const historyQuery = query(
        collection(db, 'asset_history'),
        where('assetId', '==', assetId),
        orderBy('timestamp', 'desc')
      );
      const historyDocs = await getDocs(historyQuery);
      if (historyDocs.docs.length > 9) {
        for (let i = 9; i < historyDocs.docs.length; i++) {
          batch.delete(historyDocs.docs[i].ref);
        }
      }
    } catch (err) {
      console.warn("Failed to prune history:", err);
    }

    await batch.commit();
  },

  async addMaintenanceLog(log: any, orgId: string) {
    return api.create('maintenance_logs', { ...log, orgId });
  }
};
