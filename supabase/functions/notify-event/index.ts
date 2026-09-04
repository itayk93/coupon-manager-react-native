// Supabase Edge Function: notify-event
//
// The notifications that follow from something a person just did, rather than
// from a nightly sweep of their coupons:
//
//   share_received   someone shared a coupon with you
//   coupon_finished  you spent the last of a coupon
//
// It exists because neither can be written by the client. `share_received`
// lands in *another* user's row, which no client-side policy will ever allow —
// and should not, because a client that can write another person's
// notifications can write anything into them. `coupon_finished` could be
// written by its own owner, but then the text and the rules for it would live
// in the app, get out of step with every other kind, and change only when
// people install an update.
//
// So the client says what happened, and the server decides what to say about
// it — after checking that the caller actually owns what they are describing.
//
// Env vars: as send-engagement-alerts.

import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createServiceClient, type PushSubscriptionRow } from '../_shared/push.ts';
import { deliver, type DeliveryPrefs } from '../_shared/deliver.ts';
import { money } from '../_shared/notificationTypes.ts';

const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

type Body = {
  event?: 'share_received' | 'coupon_finished';
  couponId?: number;
  /** share_received: who it was shared with. */
  recipientEmail?: string;
};

function prefsFor(row: any): DeliveryPrefs {
  return {
    email: row?.email ?? true,
    push: row?.push ?? true,
    in_app: row?.in_app ?? true,
    quiet_until: row?.quiet_until ?? null,
    timezone: row?.timezone || DEFAULT_TIMEZONE,
    type_channels: row?.type_channels ?? null,
  };
}

async function loadRecipient(supabase: any, userId: number) {
  const [{ data: user }, { data: prefs }, { data: subs }] = await Promise.all([
    supabase.from('users').select('id, public_id, email, first_name').eq('id', userId).maybeSingle(),
    supabase.from('notification_preferences')
      .select('email, push, in_app, quiet_until, timezone, type_channels')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('push_subscriptions')
      .select('endpoint, subscription, kind, expo_token')
      .eq('user_id', userId),
  ]);
  return {
    user,
    prefs: prefsFor(prefs),
    subscriptions: (subs || []) as PushSubscriptionRow[],
  };
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const caller = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as Body;
    const supabase = createServiceClient();

    if (!body.event || !body.couponId) {
      return jsonResponse({ error: 'event and couponId are required' }, 400);
    }

    // The caller's claim about the coupon is checked against the coupon, not
    // taken on trust: everything below reads from this row, not from the body.
    const { data: coupon } = await supabase
      .from('coupon')
      .select('id, user_id, company, value, cost, used_value, is_one_time')
      .eq('id', body.couponId)
      .maybeSingle();

    if (!coupon || coupon.user_id !== caller.id) {
      return jsonResponse({ error: 'FORBIDDEN' }, 403);
    }

    if (body.event === 'coupon_finished') {
      const remaining = Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
      // Only a coupon that is actually spent out. A client that asks early gets
      // a quiet no rather than a congratulation for something undone.
      if (remaining > 0.009) return jsonResponse({ skipped: 'not-finished' });

      const saved = Math.max(0, (coupon.value || 0) - (coupon.cost || 0));
      const isOneTime = coupon.is_one_time === true;
      const recipient = await loadRecipient(supabase, caller.id);
      if (!recipient.user) return jsonResponse({ error: 'FORBIDDEN' }, 403);

      const result = await deliver(supabase, {
        user: recipient.user,
        // Share invitations are transactional mail: without the invitation the
        // recipient cannot know there is a decision waiting. Push and in-app
        // still follow their preferences.
        prefs: {
          ...recipient.prefs,
          email: true,
          type_channels: {
            ...(recipient.prefs.type_channels || {}),
            share_received: {
              ...(recipient.prefs.type_channels?.share_received || {}),
              email: true,
            },
          },
        },
        subscriptions: recipient.subscriptions,
        type: 'coupon_finished',
        // A one-time coupon has no meaningful balance: its face value is usually
        // exactly its cost, so "saved" would read as 0. The message for it names
        // the action instead of an amount.
        payload: isOneTime ? { company: coupon.company, isOneTime: true } : { company: coupon.company, saved },
        dedupeKey: String(coupon.id),
        // They are looking at the screen right now. Holding this until nine in
        // the morning would celebrate something they had forgotten about.
        respectQuietHours: false,
        highlight: isOneTime ? null : money(saved),
        ctaLabel: isOneTime ? 'לארנק שלי' : 'לראות כמה חסכתי',
      });
      return jsonResponse({ event: body.event, result });
    }

    if (body.event === 'share_received') {
      const email = body.recipientEmail?.trim().toLowerCase();
      if (!email) return jsonResponse({ error: 'recipientEmail is required' }, 400);

      const { data: recipientRow } = await supabase
        .from('users').select('id').eq('email', email).maybeSingle();
      // Sharing with someone who has no account yet is allowed by the app —
      // there is simply nobody to notify until they register.
      if (!recipientRow) return jsonResponse({ skipped: 'recipient-has-no-account' });
      if (recipientRow.id === caller.id) return jsonResponse({ skipped: 'self-share' });

      const recipient = await loadRecipient(supabase, recipientRow.id);
      if (!recipient.user) return jsonResponse({ skipped: 'recipient-has-no-account' });

      const { data: sender } = await supabase
        .from('users').select('first_name, email').eq('id', caller.id).maybeSingle();
      const fromName = sender?.first_name?.trim()
        || sender?.email?.split('@')[0]
        || 'מישהו';

      const result = await deliver(supabase, {
        user: recipient.user,
        prefs: recipient.prefs,
        subscriptions: recipient.subscriptions,
        type: 'share_received',
        payload: { fromName, company: coupon.company },
        // Per coupon per recipient: re-sharing the same coupon after revoking
        // it should not ring twice.
        dedupeKey: null,
        respectQuietHours: false,
        ctaLabel: 'לראות את הקופון',
      });
      return jsonResponse({ event: body.event, result });
    }

    return jsonResponse({ error: 'unknown event' }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponse({ error: message }, 403);
    console.error('[notify-event] fatal:', err);
    return jsonResponse({ error: 'internal error' }, 500);
  }
});
