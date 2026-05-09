import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, deleteDoc, limit, addDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { setApiOrgId, generateHumanId } from './api';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultPage?: string;
  compactTable?: boolean;
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'frozen';
  activeOrgId?: string;
  orgRoles: Record<string, string>;
  preferences?: UserPreferences;
}

export interface Organization {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date | any;
  plan: string;
  ownerIds: string[];
  userCount: number;
  currency?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  organization: Organization | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshContext: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message.includes('the client is offline')) {
          console.error("Firebase check: Client is offline.");
        } else {
          console.log("Firebase connection status check:", error.message);
        }
      }
    }
    testConnection();
  }, []);

  const fetchUserData = async (currentUser: FirebaseUser) => {
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);
      const isSuperAdminEmail = ['adminrajpura@nvgroup.co.in', 'ykaman250@gmail.com', 'amammehra121@gmail.com', 'nvrajpura@nvgroup.co.in'].includes(currentUser.email || '');
      
      let userData: UserProfile | null = null;

      if (docSnap.exists()) {
        userData = { ...docSnap.data(), uid: docSnap.id } as UserProfile;
        
        // Handle migration from old format
        if ((userData as any).orgId && !(userData as any).orgRoles) {
            userData.orgRoles = { [(userData as any).orgId]: (userData as any).role || 'viewer' };
            userData.activeOrgId = (userData as any).orgId;
            delete (userData as any).orgId;
            delete (userData as any).role;
            await setDoc(docRef, userData);
        }
      } else if (isSuperAdminEmail) {
        // Create super admin profile if it doesn't exist
        const orgsSnap = await getDocs(query(collection(db, 'organizations'), limit(1)));
        let orgId = '';
        if (!orgsSnap.empty) {
          orgId = orgsSnap.docs[0].id;
        } else {
          orgId = generateHumanId('organizations');
          await setDoc(doc(db, 'organizations', orgId), {
            name: 'Main Organization',
            currency: 'INR',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        userData = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          name: currentUser.displayName || 'Super Admin',
          status: 'active',
          orgRoles: { [orgId]: 'superadmin' },
          activeOrgId: orgId
        };
        await setDoc(docRef, userData);
      }

      if (userData) {
        setProfile(userData);
        
        let targetOrgId = userData.activeOrgId;
        // Fallback to first org role if activeOrgId is not set
        if (!targetOrgId && userData.orgRoles && Object.keys(userData.orgRoles).length > 0) {
            targetOrgId = Object.keys(userData.orgRoles)[0];
            await updateProfileObj({ activeOrgId: targetOrgId });
        }

        if (targetOrgId) {
          setApiOrgId(targetOrgId);
          const orgRef = doc(db, 'organizations', targetOrgId);
          const orgSnap = await getDoc(orgRef);
          if (orgSnap.exists()) {
            setOrganization({ id: orgSnap.id, ...orgSnap.data() } as Organization);
          } else {
            console.warn("Active organization not found in DB.");
            setOrganization(null);
          }
        } else {
          setApiOrgId(null);
          setOrganization(null);
        }
      } else {
        console.error("User authenticated but no profile found in database.");
        await signOut(auth);
        setUser(null);
        setProfile(null);
        setOrganization(null);
        setApiOrgId(null);
      }
    } catch(err) {
      console.error("Auth state change error:", err);
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setOrganization(null);
      setApiOrgId(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setLoading(true);
          console.log("Auth state change: User detected", currentUser.email, currentUser.uid);
          setUser(currentUser);
          try {
            await currentUser.getIdToken(true); // Force refresh to get latest claims
          } catch (e) {
             console.log("Token refresh failed, ignoring");
          }
          await fetchUserData(currentUser);
        } else {
          setUser(null);
          setProfile(null);
          setOrganization(null);
          setApiOrgId(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const refreshContext = async () => {
    if (user) {
      setLoading(true);
      await fetchUserData(user);
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateProfileObj = async (data: Partial<UserProfile>) => {
    if (!user || !profile) return;
    
    const updatedProfile = { ...profile, ...data };
    setProfile(updatedProfile);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setProfile(profile);
      throw error;
    }
  };

  const switchOrganization = async (orgId: string) => {
    if (!profile) return;
    if (!profile.orgRoles || !(orgId in profile.orgRoles)) {
        throw new Error("User does not have access to this organization.");
    }

    await updateProfileObj({ activeOrgId: orgId });
    await refreshContext();
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, loading, logout, updateProfile: updateProfileObj, refreshContext, switchOrganization }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
