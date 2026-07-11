'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut,
  type Unsubscribe,
  type User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { isAdminRole, type AdminRole } from '@/lib/admin-permissions';

type AdminProfile = {
  uid: string;
  email: string;
  name?: string;
  role: AdminRole;
  active: boolean;
};

type AdminAuthContextValue = {
  user: User | null;
  admin: AdminProfile | null;
  loading: boolean;
  authorised: boolean;
  accessError: string;
  refreshAdmin: () => Promise<void>;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');

  async function loadAdmin(nextUser: User | null) {
    setUser(nextUser);
    setAdmin(null);
    setAccessError('');

    if (!nextUser) return;

    try {
      let snapshot = await getDoc(doc(firestore, 'admins', nextUser.uid));
      if (!snapshot.exists()) {
        snapshot = await getDoc(doc(firestore, 'admin', nextUser.uid));
      }

      if (!snapshot.exists()) {
        setAccessError('This Firebase account is not registered as an Aureon administrator.');
        return;
      }

      const data = snapshot.data();
      if (data.active !== true) {
        setAccessError('This administrator account has been disabled.');
        return;
      }

      if (!isAdminRole(data.role)) {
        setAccessError('This administrator account has an invalid access role.');
        return;
      }

      setAdmin({
        uid: nextUser.uid,
        email: nextUser.email || String(data.email || ''),
        name: String(data.name || ''),
        role: data.role,
        active: true
      });
    } catch {
      setAccessError('Aureon could not verify administrator access. Check Firestore rules and try again.');
    }
  }

  useEffect(() => {
    let unsubscribe: Unsubscribe = () => {};
    let cancelled = false;

    void setPersistence(firebaseAuth, browserLocalPersistence)
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;

        unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
          setLoading(true);
          await loadAdmin(nextUser);
          setLoading(false);
        });
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    user,
    admin,
    loading,
    accessError,
    authorised: Boolean(user && admin?.active),
    refreshAdmin: async () => {
      setLoading(true);
      await loadAdmin(firebaseAuth.currentUser);
      setLoading(false);
    },
    logout: async () => {
      await signOut(firebaseAuth);
      setUser(null);
      setAdmin(null);
      setAccessError('');
    }
  }), [user, admin, loading, accessError]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}
