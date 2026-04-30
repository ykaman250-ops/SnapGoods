import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  limit,
  startAfter,
  increment,
  getCountFromServer,
  DocumentData,
  QueryDocumentSnapshot,
  QueryConstraint
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Audit Log Helper
export async function logAction(action: string, entityType: string, entityId: string, details: any = {}) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action,
      entityType,
      entityId,
      performedBy: auth.currentUser?.email || 'system',
      timestamp: serverTimestamp(),
      details
    });
    triggerAuditLogCleanup();
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}

let cleanupInProgress = false;

async function triggerAuditLogCleanup() {
  if (cleanupInProgress || !currentOrgId) return;
  
  try {
    cleanupInProgress = true;
    
    // Keeping the newest 200 logs per organization
    const q = query(
      collection(db, 'audit_logs'),
      where('orgId', '==', currentOrgId),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.docs.length < 200) {
      cleanupInProgress = false;
      return;
    }
    
    // Find docs older than the 200th doc
    const oldestDocWeKeep = snapshot.docs[snapshot.docs.length - 1];
    
    const docsToDeleteQuery = query(
      collection(db, 'audit_logs'),
      where('orgId', '==', currentOrgId),
      orderBy('timestamp', 'desc'),
      startAfter(oldestDocWeKeep),
      limit(500) // delete up to 500 excess logs at a time
    );
    
    const docsToDeleteSnapshot = await getDocs(docsToDeleteQuery);
    
    if (docsToDeleteSnapshot.empty) {
      cleanupInProgress = false;
      return;
    }
    
    const cleanupBatch = writeBatch(db);
    docsToDeleteSnapshot.docs.forEach(d => {
      cleanupBatch.delete(d.ref);
    });
    
    await cleanupBatch.commit();
    
  } catch (error) {
    // Only log error if it's not a permission error or if we want to see it
    // Often common users won't have permission to delete logs
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('permission-denied') && !msg.includes('Missing or insufficient permissions')) {
      console.error('Audit log cleanup failed:', error);
    }
  } finally {
    cleanupInProgress = false;
  }
}

let currentOrgId: string | null = null;

export function setApiOrgId(orgId: string | null) {
  currentOrgId = orgId;
}

function applyOrgConstraint(path: string, constraints: any[]) {
  // We only isolate the main data collections.
  if (currentOrgId && !['users', 'organizations'].includes(path)) {
    return [where('orgId', '==', currentOrgId), ...constraints];
  }
  return constraints;
}

export function generateHumanId(path: string): string {
  const prefixMap: Record<string, string> = {
    assets: 'ast',
    employees: 'emp',
    assignments: 'asn',
    maintenance_logs: 'mtn',
    locations: 'loc',
    organizations: 'org',
    users: 'usr',
    audit_logs: 'adt'
  };
  const prefix = prefixMap[path] || 'doc';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // add a timestamp component to ensure sorting/uniqueness somewhat
  const timePart = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}_${timePart}${result}`;
}

// Generic CRUD helpers
export const api = {
  async list(path: string, constraints: any[] = []) {
    try {
      const qConstraints = applyOrgConstraint(path, constraints);
      const q = query(collection(db, path), ...qConstraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async listPaginated(path: string, constraints: QueryConstraint[] = [], pageSize: number = 50, lastDoc?: QueryDocumentSnapshot<DocumentData>) {
    try {
      const baseConstraints = applyOrgConstraint(path, constraints);
      const qConstraints = [...baseConstraints, limit(pageSize)];
      if (lastDoc) {
        qConstraints.push(startAfter(lastDoc));
      }
      const q = query(collection(db, path), ...qConstraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return {
        docs,
        lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === pageSize
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return { docs: [], lastDoc: null, hasMore: false };
    }
  },

  subscribe(path: string, constraints: any[], callback: (data: any[]) => void) {
    const qConstraints = applyOrgConstraint(path, constraints);
    const q = query(collection(db, path), ...qConstraints);
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Firestore Subscription Error:', error);
    });
  },

  async get(path: string, id: string) {
    try {
      if (!id || id === 'undefined') return null;
      const docSnap = await getDoc(doc(db, path, id));
      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      // Enforce data isolation on read
      if (currentOrgId && !['users', 'organizations'].includes(path) && data.orgId !== currentOrgId) {
         return null; 
      }
      return { id: docSnap.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
      return null;
    }
  },

  async getDepartmentCounts() {
    try {
      if (!currentOrgId) return [];
      const DEPARTMENTS = ['HR', 'Purchase', 'Accounts', 'Mechanical', 'Bottling', 'Power Plant', 'Production', 'Excise'];
      const counts = await Promise.all(DEPARTMENTS.map(async (dept) => {
        try {
          const q = query(collection(db, 'employees'), where('orgId', '==', currentOrgId), where('department', '==', dept));
          const snapshot = await getCountFromServer(q);
          return { name: dept, value: snapshot.data().count };
        } catch (idxError) {
          const docs = await getDocs(query(collection(db, 'employees'), where('orgId', '==', currentOrgId), where('department', '==', dept), limit(500)));
          return { name: dept, value: docs.size };
        }
      }));
      return counts.filter(c => c.value > 0);
    } catch (error) {
      console.error('Count Error', error);
      return [];
    }
  },

  async getCategoryCounts(status?: string) {
    try {
      if (!currentOrgId) return [];
      const CATEGORIES = ['Laptop', 'Desktop', 'CPU', 'Monitor', 'Printer', 'CCTV Camera', 'Network Device', 'SIM Card'];
      const counts = await Promise.all(CATEGORIES.map(async (cat) => {
        let q;
        if (status) {
           q = query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('category', '==', cat), where('status', '==', status));
        } else {
           q = query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('category', '==', cat));
        }

        try {
          const snapshot = await getCountFromServer(q);
          return { name: cat, value: snapshot.data().count };
        } catch (idxError) {
          const fallbackQ = status 
             ? query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('status', '==', status), limit(500))
             : query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('category', '==', cat), limit(500));
          const docs = await getDocs(fallbackQ);
          if (status) {
            return { name: cat, value: docs.docs.filter(d => d.data().category === cat).length };
          } else {
            return { name: cat, value: docs.size };
          }
        }
      }));
      return counts.filter(c => c.value > 0);
    } catch (error) {
      console.error('Count Error', error);
      return [];
    }
  },
  
  async getStats() {
    try {
      if (!currentOrgId) {
        return { totalAssets: 0, totalAssetsAssigned: 0, totalAssetsAvailable: 0, totalAssetsMaintenance: 0, totalAssetsRepair: 0, totalAssetsDamaged: 0, totalEmployees: 0, totalAssignments: 0 };
      }
      
      const assetsCount = await getCountFromServer(query(collection(db, 'assets'), where('orgId', '==', currentOrgId)));
      const employeesCount = await getCountFromServer(query(collection(db, 'employees'), where('orgId', '==', currentOrgId)));
      const assignmentsCount = await getCountFromServer(query(collection(db, 'assignments'), where('orgId', '==', currentOrgId)));
      
      const assignedAssetsCount = await getCountFromServer(query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('status', '==', 'assigned')));
      const availableAssetsCount = await getCountFromServer(query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('status', '==', 'available')));
      const maintenanceAssetsCount = await getCountFromServer(query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('status', '==', 'maintenance')));
      const inRepairAssetsCount = await getCountFromServer(query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('status', '==', 'in repair')));
      const damagedAssetsCount = await getCountFromServer(query(collection(db, 'assets'), where('orgId', '==', currentOrgId), where('status', '==', 'damaged')));

      return {
        totalAssets: assetsCount.data().count,
        totalAssetsAssigned: assignedAssetsCount.data().count,
        totalAssetsAvailable: availableAssetsCount.data().count,
        totalAssetsMaintenance: maintenanceAssetsCount.data().count,
        totalAssetsRepair: inRepairAssetsCount.data().count,
        totalAssetsDamaged: damagedAssetsCount.data().count,
        totalEmployees: employeesCount.data().count,
        totalAssignments: assignmentsCount.data().count
      };
    } catch (error) {
      console.error('Failed to get stats via getCount:', error);
      return { totalAssets: 0, totalAssetsAssigned: 0, totalAssetsAvailable: 0, totalAssetsMaintenance: 0, totalAssetsRepair: 0, totalAssetsDamaged: 0, totalEmployees: 0,  totalAssignments: 0 };
    }
  },

  async create(path: string, data: any) {
    try {
      const batch = writeBatch(db);
      const docId = generateHumanId(path);
      const docRef = doc(db, path, docId);
      
      // Inject orgId on creation!
      const finalData = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      if (currentOrgId && !['users', 'organizations'].includes(path)) {
        finalData.orgId = currentOrgId;
      }
      
      batch.set(docRef, finalData);
      
      const auditRef = doc(db, 'audit_logs', generateHumanId('audit_logs'));
      const auditData = {
        action: 'CREATE',
        entityType: path,
        entityId: docRef.id,
        performedBy: auth.currentUser?.email || 'system',
        timestamp: serverTimestamp(),
        details: finalData
      };
      if (currentOrgId) {
        (auditData as any).orgId = currentOrgId;
      }
      batch.set(auditRef, auditData);
      
      await batch.commit();
      triggerAuditLogCleanup();
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async set(path: string, id: string, data: any) {
    try {
      const docRef = doc(db, path, id);
      const batch = writeBatch(db);
      
      const finalData = { ...data, createdAt: data.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };
      if (currentOrgId && !['users', 'organizations'].includes(path)) {
        finalData.orgId = currentOrgId;
      }
      
      batch.set(docRef, finalData);
      
      const auditRef = doc(db, 'audit_logs', generateHumanId('audit_logs'));
      const auditData = {
        action: 'CREATE',
        entityType: path,
        entityId: id,
        performedBy: auth.currentUser?.email || 'system',
        timestamp: serverTimestamp(),
        details: finalData
      };
      if (currentOrgId) {
        (auditData as any).orgId = currentOrgId;
      }
      batch.set(auditRef, auditData);
      
      await batch.commit();
      triggerAuditLogCleanup();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${path}/${id}`);
    }
  },

  async setMerge(path: string, id: string, data: any) {
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, path, id);
      
      batch.set(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      const auditRef = doc(db, 'audit_logs', generateHumanId('audit_logs'));
      const auditData = {
        action: 'UPDATE',
        entityType: path,
        entityId: id,
        performedBy: auth.currentUser?.email || 'system',
        timestamp: serverTimestamp(),
        details: data
      };
      if (currentOrgId) {
        (auditData as any).orgId = currentOrgId;
      }
      batch.set(auditRef, auditData);
      
      await batch.commit();
      triggerAuditLogCleanup();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  async update(path: string, id: string, data: any) {
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, path, id);
      
      batch.update(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      const auditRef = doc(db, 'audit_logs', generateHumanId('audit_logs'));
      const auditData = {
        action: 'UPDATE',
        entityType: path,
        entityId: id,
        performedBy: auth.currentUser?.email || 'system',
        timestamp: serverTimestamp(),
        details: data
      };
      if (currentOrgId) {
        (auditData as any).orgId = currentOrgId;
      }
      batch.set(auditRef, auditData);
      
      await batch.commit();
      triggerAuditLogCleanup();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  async delete(path: string, id: string) {
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, path, id);
      
      batch.delete(docRef);
      
      const auditRef = doc(db, 'audit_logs', generateHumanId('audit_logs'));
      const auditData = {
        action: 'DELETE',
        entityType: path,
        entityId: id,
        performedBy: auth.currentUser?.email || 'system',
        timestamp: serverTimestamp(),
        details: {}
      };
      if (currentOrgId) {
        (auditData as any).orgId = currentOrgId;
      }
      batch.set(auditRef, auditData);
      
      await batch.commit();
      triggerAuditLogCleanup();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  }
};
