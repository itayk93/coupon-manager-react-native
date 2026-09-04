import React, { createContext, useContext, useEffect, useState } from "react";
import {
  clearLegacyUser,
  getStoredLegacyUser,
  LegacyUser,
  storeLegacyUser,
} from "@/lib/legacyAuth";
import { supabase } from "@/integrations/supabase/client";
import { flushActivityLog, logActivity } from "@/lib/activityLog";
import { claimPendingReferral, resetReferralClaim } from "@/lib/referralClaim";
import { clearLocalPrivateData } from "@/lib/localPrivateData";
import { clearLocalExpiryAlerts } from "@/lib/localExpiryAlerts";
import { clearOfflineCoupons } from "@/lib/offlineCoupons";

type AuthContextType = {
  session: LegacyUser | null;
  user: LegacyUser | null;
  isLoading: boolean;
  signOut: (options?: { forgetDeviceData?: boolean }) => Promise<void>;
  isAdmin: boolean;
  setLegacySession: (user: LegacyUser) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LegacyUser | null>(null);
  const [user, setUser] = useState<LegacyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadUser = async () => {
    try {
      const storedUser = await getStoredLegacyUser();
      if (storedUser) {
        setSession(storedUser);
        setUser(storedUser);
        setIsAdmin(Boolean(storedUser.is_admin));
      }

      const {
        data: { session: supabaseSession },
      } = await supabase.auth.getSession();

      if (!supabaseSession) {
        if (storedUser) {
          await clearLegacyUser();
        }
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      if (supabaseSession.user?.email) {
        const { data: legacyUser } = await supabase
          .from("users")
          .select("id,public_id,email,first_name,last_name,gender,is_admin,is_confirmed,is_deleted")
          .eq("email", supabaseSession.user.email.toLowerCase())
          .maybeSingle();

        if (legacyUser && !legacyUser.is_deleted) {
          const normalizedUser: LegacyUser = {
            id: legacyUser.id,
            public_id: legacyUser.public_id,
            email: legacyUser.email,
            first_name: legacyUser.first_name,
            last_name: legacyUser.last_name,
            gender: legacyUser.gender,
            is_admin: Boolean(legacyUser.is_admin),
            is_confirmed: Boolean(legacyUser.is_confirmed),
          };
          await storeLegacyUser(normalizedUser);
          setSession(normalizedUser);
          setUser(normalizedUser);
          setIsAdmin(normalizedUser.is_admin);

          // The first moment there is both a session and a row in `users` to
          // attach a referral to. Registration itself is too early: with email
          // verification the row does not exist yet, and Google sign-in never
          // passes through the registration screen at all. Not awaited — a
          // partner's attribution must not hold up the app opening.
          void claimPendingReferral();
        }
      }
    } catch (error) {
      console.error("Auth load error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) {
        loadUser();
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const setLegacySession = (legacyUser: LegacyUser) => {
    setSession(legacyUser);
    setUser(legacyUser);
    setIsAdmin(Boolean(legacyUser.is_admin));
    storeLegacyUser(legacyUser).catch(() => {});
  };

  const signOut = async (options: { forgetDeviceData?: boolean } = {}) => {
    const identity = user?.email || session?.email;
    try {
      // Logged and flushed before the session is torn down: the log endpoint
      // authenticates with the JWT, so anything still queued afterwards has
      // nowhere to go.
      logActivity("logout_success");
      await flushActivityLog();
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("SignOut error:", error);
    } finally {
      // Remote logout can fail after account deletion or while offline. Local
      // coupon codes, drafts, location targets and profile identifiers must
      // still be removed.
      await Promise.allSettled([
        clearLocalExpiryAlerts(),
      ]);
      await Promise.allSettled([
        clearLegacyUser(),
        resetReferralClaim(),
        clearLocalPrivateData(identity, { forgetInstall: options.forgetDeviceData }),
        clearOfflineCoupons(),
      ]);
      setSession(null);
      setUser(null);
      setIsAdmin(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signOut,
        isAdmin,
        setLegacySession,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
