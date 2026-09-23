// Which Kuponi face a notification carries.
//
// A web push can name its own icon, so the banner shows Kuponi doing something
// that matches the message instead of the same app face every time. The files
// live in public/notification-icons/ (256px, served with the PWA) and their
// 1024px masters in assets/notification-icons/, for the iOS extension that will
// read the same keys.
//
// Only keys listed in AVAILABLE resolve. A face that has not been drawn yet
// returns undefined, and the push falls back to the app icon — so adding the
// next image is one file plus one line here, and never a half-broken banner.

import type { NotificationTypeId } from './notificationTypes.ts';

export type NotificationIconKey =
  | 'expiry-week'
  | 'expiry-soon'
  | 'expiry-tomorrow'
  | 'expiry-today'
  | 'idle-money'
  | 'share-received'
  | 'balance-updated'
  | 'coupon-finished'
  | 'coupon-milestone'
  | 'monthly-summary'
  | 'expired-unused'
  | 'default';

const AVAILABLE: ReadonlySet<NotificationIconKey> = new Set<NotificationIconKey>([
  'expiry-week',
  'expiry-soon',
]);

// Bump when a drawn face is replaced, so browsers do not keep the old one.
const VERSION = '1';

/**
 * The face for an expiry alert, on the same ladder as the widget's
 * escalation: calm a week out, pressed the day before, alarmed on the day.
 */
export function expiryIconKey(days: number): NotificationIconKey {
  if (days <= 0) return 'expiry-today';
  if (days === 1) return 'expiry-tomorrow';
  if (days <= 3) return 'expiry-soon';
  return 'expiry-week';
}

const BY_TYPE: Record<Exclude<NotificationTypeId, 'expiry'>, NotificationIconKey> = {
  monthly_summary: 'monthly-summary',
  idle_money: 'idle-money',
  share_received: 'share-received',
  balance_updated: 'balance-updated',
  coupon_finished: 'coupon-finished',
  coupon_milestone: 'coupon-milestone',
  expired_unused: 'expired-unused',
};

export function iconKeyFor(type: NotificationTypeId, days?: number): NotificationIconKey {
  if (type === 'expiry') return expiryIconKey(days ?? 7);
  return BY_TYPE[type] ?? 'default';
}

/** The PWA path for a key, or undefined while that face is not drawn yet. */
export function notificationIconUrl(key: NotificationIconKey): string | undefined {
  if (AVAILABLE.has(key)) return `/notification-icons/${key}.png?v=${VERSION}`;
  if (AVAILABLE.has('default')) return `/notification-icons/default.png?v=${VERSION}`;
  return undefined;
}
