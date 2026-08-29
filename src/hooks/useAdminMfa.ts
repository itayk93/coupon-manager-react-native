import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * TOTP second factor for the admin panel only.
 *
 * The regular coupon app stays password/biometrics-only on purpose: the second
 * factor guards the admin panel, which is the one place where a stolen phone
 * could touch other people's data. Supabase raises the whole session to `aal2`
 * once a code is verified, so this asks for a code the first time the panel is
 * opened in a session and stays quiet afterwards.
 */
export type AdminMfaStatus = "loading" | "enroll" | "challenge" | "verified";

export type EnrollingFactor = {
  id: string;
  uri: string;
  secret: string;
};

export function useAdminMfa() {
  const [status, setStatus] = useState<AdminMfaStatus>("loading");
  const [enrolling, setEnrolling] = useState<EnrollingFactor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Assurance level and factor list are read separately: a failed lookup must
    // never be read as "no factor needed", which is the one wrong direction.
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const hasVerified = (factors?.totp ?? []).some((f) => f.status === "verified");

    if (!hasVerified) {
      setStatus("enroll");
      return;
    }

    setStatus(assurance?.currentLevel === "aal2" ? "verified" : "challenge");
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refresh();
      } catch (e: any) {
        if (mounted) {
          setError(e?.message ?? "שגיאה בבדיקת האימות הדו-שלבי");
          setStatus("challenge");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  /**
   * Supabase refuses a second enrollment while an unverified factor is pending,
   * which is easy to hit by starting setup and leaving the screen. Clearing the
   * leftovers keeps setup from getting permanently stuck.
   */
  const clearUnverifiedFactors = async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;

    const pending = (data?.all ?? []).filter(
      (f) => f.factor_type === "totp" && f.status !== "verified",
    );

    for (const factor of pending) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (unenrollError) throw unenrollError;
    }
  };

  const startEnrollment = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await clearUnverifiedFactors();

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Coupon Master Admin ${Date.now()}`,
      });
      if (enrollError) throw enrollError;

      setEnrolling({
        id: data.id,
        uri: data.totp.uri,
        secret: data.totp.secret,
      });
    } catch (e: any) {
      setError(e?.message ?? "לא ניתן להתחיל את ההגדרה");
    } finally {
      setBusy(false);
    }
  }, []);

  const cancelEnrollment = useCallback(() => {
    setEnrolling(null);
    setError(null);
  }, []);

  /**
   * One call covers both flows: verifying the freshly enrolled factor and
   * answering the per-session challenge. Both end with the session at `aal2`.
   */
  const verifyCode = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      try {
        let factorId = enrolling?.id;

        if (!factorId) {
          const { data, error: listError } = await supabase.auth.mfa.listFactors();
          if (listError) throw listError;
          factorId = (data?.totp ?? []).find((f) => f.status === "verified")?.id;
          if (!factorId) throw new Error("לא נמצא אמצעי אימות רשום");
        }

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: code.trim(),
        });
        if (verifyError) throw verifyError;

        setEnrolling(null);
        await refresh();
        return true;
      } catch (e: any) {
        setError(e?.message ?? "הקוד שגוי או שפג תוקפו");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [enrolling, refresh],
  );

  return {
    status,
    enrolling,
    busy,
    error,
    startEnrollment,
    cancelEnrollment,
    verifyCode,
    refresh,
  };
}
