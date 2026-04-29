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
  role: 'owner' | 'admin' | 'manager' | 'viewer' | 'superadmin';
  name: string;
  status: 'active' | 'inactive' | 'frozen';
  orgId?: string;
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
      
      if (docSnap.exists()) {
        const userData = { ...docSnap.data(), uid: docSnap.id } as UserProfile;
        console.log("Found user profile:", userData);
        setProfile(userData);
        
        if (userData.orgId) {
          setApiOrgId(userData.orgId);
          const orgRef = doc(db, 'organizations', userData.orgId);
          const orgSnap = await getDoc(orgRef);
          if (orgSnap.exists()) {
            const orgData = { id: orgSnap.id, ...orgSnap.data() } as Organization;
            console.log("Found organization:", orgData);
            setOrganization(orgData);
          }
        } else if (currentUser.email === 'adminrajpura@nvgroup.co.in' || currentUser.email === 'ykaman250@gmail.com' || currentUser.email === 'amammehra121@gmail.com' || currentUser.email === 'nvrajpura@nvgroup.co.in') {
          console.log("Super admin detected, checking for organizations...");
          // If superadmin has no orgId, try to find one
          const orgsSnap = await getDocs(query(collection(db, 'organizations'), limit(1)));
          if (!orgsSnap.empty) {
            const firstOrg = orgsSnap.docs[0];
            const orgId = firstOrg.id;
            console.log("Found organization for super admin:", orgId);
            setApiOrgId(orgId);
            setOrganization({ id: orgId, ...firstOrg.data() } as Organization);
            
            // Ensure user document exists with orgId and superadmin role
            await setDoc(doc(db, 'users', currentUser.uid), { 
              email: currentUser.email,
              name: currentUser.displayName || 'Super Admin',
              role: 'superadmin',
              status: 'active',
              orgId,
              updatedAt: serverTimestamp()
            }, { merge: true });
            
            setProfile({ 
              uid: currentUser.uid,
              email: currentUser.email!,
              name: currentUser.displayName || 'Super Admin',
              role: 'superadmin',
              status: 'active',
              orgId 
            });
          } else {
            console.log("No organizations found, creating default for super admin...");
            // Create a default organization if none exist
            const orgId = generateHumanId('organizations');
            const newOrgRef = doc(db, 'organizations', orgId);
            await setDoc(newOrgRef, {
              name: 'Main Organization',
              currency: 'INR',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            setApiOrgId(orgId);
            setOrganization({ id: orgId, name: 'Main Organization', currency: 'INR' } as Organization);
            
            await setDoc(doc(db, 'users', currentUser.uid), { 
              email: currentUser.email,
              name: currentUser.displayName || 'Super Admin',
              role: 'superadmin',
              status: 'active',
              orgId,
              updatedAt: serverTimestamp()
            }, { merge: true });
            
            setProfile({ 
              uid: currentUser.uid,
              email: currentUser.email!,
              name: currentUser.displayName || 'Super Admin',
              role: 'superadmin',
              status: 'active',
              orgId 
            });
          }
        } else {
          setApiOrgId(null);
        }
      } else {
        // Required for backwards compatibility / local testing if user is new
        if (currentUser.email === 'adminrajpura@nvgroup.co.in' || currentUser.email === 'ykaman250@gmail.com' || currentUser.email === 'amammehra121@gmail.com' || currentUser.email === 'nvrajpura@nvgroup.co.in') {
           const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            role: 'superadmin',
            name: currentUser.displayName || 'Super Admin',
            status: 'active',
          };
          setProfile(newProfile);
          await setDoc(docRef, newProfile);
          setApiOrgId(null);
        } else {
           console.error("User authenticated but no profile found in database.");
           await signOut(auth);
           setUser(null);
           setProfile(null);
           setOrganization(null);
           setApiOrgId(null);
        }
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
    
    // Safety check
    if (profile.email === 'adminrajpura@nvgroup.co.in' && Object.keys(data).includes('role')) {
      if (data.role !== 'owner') throw new Error("Cannot modify super admin role.");
    }
    
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

  return (
    <AuthContext.Provider value={{ user, profile, organization, loading, logout, updateProfile: updateProfileObj, refreshContext }}>
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
