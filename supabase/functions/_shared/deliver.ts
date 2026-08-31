// One way to say something to a user, used by every sender.
//
// Before this, "send a notification" meant knowing about three channels, two
// push transports, a preferences row, quiet hours, and the notifications table.
// send-expiry-alerts learned all of it; anything else that wanted to reach a
// user would have had to learn it again, and would have got a detail wrong.
//
// Here it is once: decide the channels, say it once per key, write the row,
// buzz the phone, send the mail.

import { safeFetch } from './ssrf.ts';
import { buildUnsubscribeUrl, buildUnsubscribeHeaders } from './unsubscribe.ts';
import { messageEmailHtml } from './emailTemplate.ts';
import { sendPushToRows, type PushSubscriptionRow } from './push.ts';
import { notificationUrl } from './appLinks.ts';
import {
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationTypeId,
} from './notificationTypes.ts';
import { phrase } from './notificationVoice.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_TIMEZONE = 'Asia/Jerusalem';
const DEFAULT_SEND_HOUR = 9;
const RTL_MARK = '\u200F';

export type DeliveryUser = {
  id: number;
  public_id: string;
  email: string | null;
  first_name: string | null;
};

export type DeliveryPrefs = {
  email: boolean;
  push: boolean;
  in_app: boolean;
  quiet_until: string | null;
  timezone: string | null;
  type_channels: Record<string, Partial<Record<NotificationChannel, boolean>>> | null;
};

export type DeliveryResult = {
  skipped?: 'duplicate' | 'quiet-hours' | 'all-channels-off';
  in_app: boolean;
  push: boolean;
  email: boolean;
};

/**
 * Whether this user wants this kind on this channel.
 *
 * Two gates, and both must be open: the master switch for the channel, and the
 * choice for this kind. A kind the user has never seen a switch for falls back
 * to the kind's own default, so a newly added kind reaches people without a
 * backfill — and stays off wherever the default says off.
 */
export function wants(
  prefs: DeliveryPrefs,
  type: NotificationTypeId,
  channel: NotificationChannel,
): boolean {
  if (!prefs[channel]) return false;
  const override = prefs.type_channels?.[type]?.[channel];
  return override ?? NOTIFICATION_TYPES[type].defaults[channel];
}

function localHour(timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: 'numeric', hour12: false,
  }).format(new Date()));
}

/** The earliest local hour this person may be contacted. */
function sendHour(quietUntil: string | null): number {
  if (!quietUntil) return DEFAULT_SEND_HOUR;
  const match = quietUntil.match(/^(\d{1,2}):/);
  return match ? Number(match[1]) : DEFAULT_SEND_HOUR;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    console.error('[deliver] BREVO_API_KEY missing, skipping email');
    return false;
  }
  try {
    const response = await safeFetch(BREVO_API_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: {
          email: Deno.env.get('BREVO_SENDER_EMAIL') || 'no-reply@couponmaster.app',
          name: Deno.env.get('BREVO_SENDER_NAME') || 'קופון מאסטר',
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        headers,
      }),
    });
    if (!response.ok) {
      console.error('[deliver] brevo error:', response.status, await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[deliver] email failed:', err);
    return false;
  }
}

/**
 * Say one thing to one person.
 *
 * `dedupeKey` is what makes a repeatable kind repeat on the right cadence — the
 * month for a summary, the coupon id for a one-off, the threshold for a
 * milestone. The ledger insert is the claim: whoever wins the unique index gets
 * to send, so two overlapping cron runs cannot both deliver.
 *
 * `respectQuietHours` is off for things the user just did — a coupon they
 * finished this second should not arrive tomorrow morning.
 */
export async function deliver(
  supabase: any,
  options: {
    user: DeliveryUser;
    prefs: DeliveryPrefs;
    type: NotificationTypeId;
    payload: Record<string, any>;
    dedupeKey?: string | null;
    subscriptions?: PushSubscriptionRow[];
    respectQuietHours?: boolean;
    /** Big number shown as a pill in the email, when the kind has one. */
    highlight?: string | null;
    ctaLabel?: string | null;
  },
): Promise<DeliveryResult> {
  const {
    user, prefs, type, payload,
    dedupeKey = null, subscriptions = [],
    respectQuietHours = true, highlight = null, ctaLabel = null,
  } = options;

  const result: DeliveryResult = { in_app: false, push: false, email: false };

  const wantsInApp = wants(prefs, type, 'in_app');
  const wantsPush = wants(prefs, type, 'push') && subscriptions.length > 0;
  const wantsEmail = wants(prefs, type, 'email') && Boolean(user.email);
  if (!wantsInApp && !wantsPush && !wantsEmail) {
    return { ...result, skipped: 'all-channels-off' };
  }

  if (respectQuietHours) {
    const zone = prefs.timezone || DEFAULT_TIMEZONE;
    if (localHour(zone) < sendHour(prefs.quiet_until)) {
      return { ...result, skipped: 'quiet-hours' };
    }
  }

  if (dedupeKey) {
    const { error } = await supabase
      .from('notification_events')
      .insert({ user_id: user.id, type, dedupe_key: dedupeKey });
    // 23505 is the unique index doing its job: somebody already said this.
    if (error) {
      if (error.code === '23505') return { ...result, skipped: 'duplicate' };
      console.error('[deliver] ledger insert failed:', error.message);
      return { ...result, skipped: 'duplicate' };
    }
  }

  // Written fresh for this message rather than pulled from a fixed string —
  // and falling back to the fixed string the moment anything is off. See
  // notificationVoice.ts.
  const phrasedCopy = await phrase(type, payload, { supabase, userId: user.id });
  // Push banners do not expose layout control on every OS. A leading RTL mark
  // makes Hebrew win the Unicode bidi decision even when a brand or amount is
  // Latin. Web Push also carries `dir: rtl` in push.ts and the service worker.
  const copy = {
    ...phrasedCopy,
    title: `${RTL_MARK}${phrasedCopy.title}`,
    body: `${RTL_MARK}${phrasedCopy.body}`,
  };
  const appBase = Deno.env.get('APP_BASE_URL') || '';

  if (wantsInApp) {
    const { error } = await supabase.from('notifications').insert({
      user_id: user.id,
      type,
      title: copy.title,
      message: copy.body,
      link: copy.link,
      shown: false,
      viewed: false,
      hide_from_view: false,
    });
    result.in_app = !error;
    if (error) console.error('[deliver] in-app insert failed:', error.message);
  }

  if (wantsPush) {
    const stats = await sendPushToRows(supabase, subscriptions, {
      title: copy.title,
      body: copy.body,
      url: copy.link,
      // One tag per kind per user: a second summary replaces the first in the
      // shade instead of stacking two of the same thing.
      tag: `${type}-${user.id}`,
      renotify: true,
    });
    result.push = stats.sent > 0;
  }

  if (wantsEmail && user.email) {
    result.email = await sendEmail(
      user.email,
      copy.title,
      messageEmailHtml({
        firstName: user.first_name || '',
        title: copy.title,
        body: copy.body,
        highlight,
        ctaLabel,
        appUrl: appBase ? notificationUrl(appBase, copy.link) : null,
        unsubscribeUrl: await buildUnsubscribeUrl(user.public_id, user.email),
      }),
      await buildUnsubscribeHeaders(user.public_id, user.email),
    );
  }

  return result;
}
