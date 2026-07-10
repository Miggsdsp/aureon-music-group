'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';

type AdminProfile = {
  uid: string;
  email: string;
  name?: string;
  role: string;
  active: boolean;
};

type AdminAuthContextValue = {
  user: User | null;
  admin: AdminProfile | null;
  loading: boolean;
  authorised: boolean;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setAdmin(null);

      if (!nextUser) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(firestore, 'admins', nextUser.uid));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setAdmin({
            uid: nextUser.uid,
            email: nextUser.email || '',
            name: data.name || '',
            role: data.role || 'viewer',
            active: data.active === true
          });
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    user,
    admin,
    loading,
    authorised: Boolean(user && admin?.active),
    logout: () => signOut(firebaseAuth)
  }), [user, admin, loading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}
