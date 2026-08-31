import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "coupon_form_draft";
const ONBOARDING_DRAFTS_KEY = "onboarding_coupon_drafts";

export type CouponDraft = {
  company: string;
  code: string;
  value: string;
  cost: string;
  expiration: string;
  isOneTime?: boolean;
  purpose?: string;
  description: string;
  cvv: string;
  cardExp: string;
  redemptionUrl: string;
  includeCardInfo: boolean;
  origin?: "coupon_form" | "onboarding";
  createdAt?: string;
};

export async function saveCouponDraft(draft: CouponDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Best-effort: draft persistence must never break the form.
  }
}

export async function loadCouponDraft(): Promise<CouponDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CouponDraft;
  } catch {
    return null;
  }
}

export async function clearCouponDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Best-effort.
  }
}

export async function saveOnboardingCouponDrafts(drafts: CouponDraft[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Best-effort persistence. The onboarding can still continue.
  }
}

export async function loadOnboardingCouponDrafts(): Promise<CouponDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_DRAFTS_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function clearOnboardingCouponDrafts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_DRAFTS_KEY);
  } catch {
    // Best-effort.
  }
}
