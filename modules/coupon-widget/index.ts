import { requireOptionalNativeModule } from "expo";

/** One coupon card rendered inside the widget. */
export type WidgetCouponPayload = {
  id: number;
  publicId: string;
  company: string;
  /** Already decrypted — the widget never sees ciphertext. */
  code: string;
  remainingValue: number;
  /** ISO date (yyyy-MM-dd) or null. */
  expiration: string | null;
  /**
   * Absolute path to a logo file in shared storage, or null to fall back to
   * initials. A path rather than a URL: the widget cannot reach Metro-bundled
   * assets, so the app copies the file across. See src/lib/widgetLogos.ts.
   */
  logoFile: string | null;
  /** Optional prepaid card details */
  cardExp?: string | null;
  cvv?: string | null;
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
  getSharedDirectory(): string | null;
  peekSharedImport(): string | null;
  completeSharedImport(): void;
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

/** Directory readable by both the app and the widget, or null off-device. */
export function getSharedDirectory(): string | null {
  return native?.getSharedDirectory() ?? null;
}

/**
 * A screenshot the user shared into the app from another app's share sheet,
 * as base64 JPEG, or null when nothing is waiting. Reading it clears it, so a
 * second call returns null until the next share.
 */
export type SharedUsageImport = {
  id: string;
  createdAt: string;
  state: "pending";
  imageBase64: string;
};

export function peekSharedImport(): SharedUsageImport | null {
  const json = native?.peekSharedImport?.();
  if (!json) return null;
  try { return JSON.parse(json) as SharedUsageImport; } catch { return null; }
}

export function completeSharedImport(): void {
  native?.completeSharedImport?.();
}
