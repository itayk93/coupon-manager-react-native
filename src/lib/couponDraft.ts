import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "coupon_form_draft";

export type CouponDraft = {
  company: string;
  code: string;
  value: string;
  cost: string;
  expiration: string;
  description: string;
  cvv: string;
  cardExp: string;
  redemptionUrl: string;
  includeCardInfo: boolean;
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
