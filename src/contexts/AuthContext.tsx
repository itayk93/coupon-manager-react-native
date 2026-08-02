import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearLegacyUser, getStoredLegacyUser, LegacyUser } from '@/lib/legacyAuth';
import { supabase } from '@/integrations/supabase/client';

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
    let mounted = true;

    const loadUser = async () => {
      const storedUser = getStoredLegacyUser();
      if (storedUser) {
        setSession(storedUser);
        setUser(storedUser);
        setIsAdmin(Boolean(storedUser.is_admin));
      }

      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (supabaseSession?.user?.email) {
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id,email,first_name,last_name,is_admin,is_confirmed,is_deleted')
          .eq('email', supabaseSession.user.email.toLowerCase())
          .maybeSingle();

        if (mounted && legacyUser && !legacyUser.is_deleted) {
          const normalizedUser = {
            id: legacyUser.id,
            email: legacyUser.email,
            first_name: legacyUser.first_name,
            last_name: legacyUser.last_name,
            is_admin: Boolean(legacyUser.is_admin),
            is_confirmed: Boolean(legacyUser.is_confirmed),
          } satisfies LegacyUser;
          localStorage.setItem('coupon_master_legacy_session', JSON.stringify(normalizedUser));
          setSession(normalizedUser);
          setUser(normalizedUser);
          setIsAdmin(normalizedUser.is_admin);
        }
      }
      if (mounted) setIsLoading(false);
    };

    void loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const setLegacySession = (legacyUser: LegacyUser) => {
    setSession(legacyUser);
    setUser(legacyUser);
    setIsAdmin(Boolean(legacyUser.is_admin));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
