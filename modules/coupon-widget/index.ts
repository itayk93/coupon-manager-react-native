import { requireOptionalNativeModule } from "expo";

/** One coupon card rendered inside the widget. */
export type WidgetCouponPayload = {
  id: number;
  company: string;
  /** Already decrypted — the widget never sees ciphertext. */
  code: string;
  remainingValue: number;
  /** ISO date (yyyy-MM-dd) or null. */
  expiration: string | null;
  /** Absolute URL of the company logo, or null to fall back to initials. */
  logoUrl: string | null;
};

/**
 * Everything the widget renders. The app precomputes it so the native side is
 * pure presentation — no network, no crypto, no business rules.
 */
export type WidgetPayload = {
  updatedAt: string;
  activeCouponsCount: number;
  oneTimeCouponsCount: number;
  totalRemainingValue: number;
  coupons: WidgetCouponPayload[];
};

export const EMPTY_WIDGET_PAYLOAD: WidgetPayload = {
  updatedAt: new Date(0).toISOString(),
  activeCouponsCount: 0,
  oneTimeCouponsCount: 0,
  totalRemainingValue: 0,
  coupons: [],
};

type CouponWidgetNativeModule = {
  setWidgetData(json: string): void;
  getWidgetData(): string | null;
  reloadWidgets(): void;
};

// Optional so the app still runs on web and in Expo Go.
const native = requireOptionalNativeModule<CouponWidgetNativeModule>("CouponWidget");

export const isWidgetSupported = native != null;

/** Writes the payload to shared storage and asks the OS to redraw the widget. */
export function setWidgetData(payload: WidgetPayload): void {
  if (!native) return;
  native.setWidgetData(JSON.stringify(payload));
  native.reloadWidgets();
}

export function getWidgetData(): WidgetPayload | null {
  if (!native) return null;
  const json = native.getWidgetData();
  if (!json) return null;
  try {
    return JSON.parse(json) as WidgetPayload;
  } catch {
    return null;
  }
}

/** Clears the widget (e.g. on sign-out) so no coupon data lingers on the home screen. */
export function clearWidgetData(): void {
  setWidgetData(EMPTY_WIDGET_PAYLOAD);
}

export function reloadWidgets(): void {
  native?.reloadWidgets();
}
