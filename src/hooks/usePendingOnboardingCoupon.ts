import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { usePathname } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAddCoupon } from "@/hooks/useCoupons";
import { clearCouponDraft, clearOnboardingCouponDrafts, loadCouponDraft, loadOnboardingCouponDrafts } from "@/lib/couponDraft";
import { notify } from "@/lib/notify";

export function usePendingOnboardingCoupon() {
  const { user } = useAuth();
  const { mutateAsync: addCoupon } = useAddCoupon();
  const router = useRouter();
  const pathname = usePathname();
  const claimingRef = useRef(false);

  useEffect(() => {
    if (!user || claimingRef.current) return;
    claimingRef.current = true;

    void loadCouponDraft()
      .then(async (legacyDraft) => {
        const onboardingDrafts = await loadOnboardingCouponDrafts();
        const drafts = onboardingDrafts.length
          ? onboardingDrafts
          : legacyDraft?.origin === "onboarding" ? [legacyDraft] : [];
        if (!drafts.length) return;

        let created: unknown;
        for (const draft of drafts) {
          created = await addCoupon({
            company: draft.company.trim(), code: draft.code.trim(), value: Number(draft.value) || 0,
            cost: Number(draft.cost) || 0, expiration: draft.expiration.trim() || null,
            description: draft.description.trim() || null,
            cvv: draft.includeCardInfo ? draft.cvv.trim() || null : null,
            card_exp: draft.includeCardInfo ? draft.cardExp.trim() || null : null,
            buyme_coupon_url: draft.redemptionUrl.trim() || null, used_value: 0, status: "פעיל",
          });
        }

        await clearCouponDraft();
        await clearOnboardingCouponDrafts();
        notify.success(drafts.length > 1 ? `${drafts.length} קופונים נשמרו בארנק` : "הקופון הראשון נשמר בארנק");
        const couponPublicId = (created as { public_id?: string })?.public_id;
        router.replace(couponPublicId ? `/coupons/${couponPublicId}` : "/(tabs)");
      })
      .catch((error) => {
        console.error("Pending onboarding coupon claim failed:", error);
        notify.error("לא הצלחנו לשמור את הקופון", "הטיוטה נשמרה. ננסה שוב בכניסה הבאה.");
      })
      .finally(() => {
        claimingRef.current = false;
      });
  }, [addCoupon, pathname, router, user]);
}
