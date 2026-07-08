import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearLegacyUser, getStoredLegacyUser, LegacyUser } from '@/lib/legacyAuth';

type AuthContextType = {
  session: LegacyUser | null;
  user: LegacyUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  setLegacySession: (user: LegacyUser) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LegacyUser | null>(null);
  const [user, setUser] = useState<LegacyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const storedUser = getStoredLegacyUser();
    if (storedUser) {
      setSession(storedUser);
      setUser(storedUser);
      setIsAdmin(Boolean(storedUser.is_admin));
    }
    setIsLoading(false);
  }, []);

  const setLegacySession = (legacyUser: LegacyUser) => {
    setSession(legacyUser);
    setUser(legacyUser);
    setIsAdmin(Boolean(legacyUser.is_admin));
  };

  const signOut = async () => {
    clearLegacyUser();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, signOut, isAdmin, setLegacySession }}>
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
