// Supabase Edge Function: update-balance
// Orchestrates auto-updating coupon balances for Multipass / BuyMe coupons.
//
// Architecture note:
//   The heavy scraping (headless browser + captcha solving) is NOT portable to a
//   Deno Edge Function. It runs as an external worker — the original scrape_buyme /
//   scrape_multipass projects deployed as an HTTP microservice. This function is the
//   orchestrator: it selects the user's auto-updatable coupons, calls the scraper
//   service per coupon, applies the returned balance, and records the run in
//   auto_update_runs. If SCRAPER_SERVICE_URL is not configured, coupons are skipped
//   (recorded) rather than silently ignored.
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  - injected automatically
//   SCRAPER_SERVICE_URL  - base URL of the external scraper microservice (optional)
//   SCRAPER_SERVICE_TOKEN - bearer token for the scraper service (optional)
//
// Deploy: supabase functions deploy update-balance

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient, sendPushToRows } from '../_shared/push.ts';
import { requireSameUser, requireUser } from '../_shared/auth.ts';

type Coupon = {
  id: number;
  company: string;
  source: string | null;
  auto_download_details: string | null;
  value: number;
  used_value: number;
  buyme_coupon_url: string | null;
  auto_update: boolean;
  user_id: number;
  last_scraped: string | null;
  last_detail_view: string | null;
  last_company_view: string | null;
  last_code_view: string | null;
};

type UpdatedCouponSummary = {
  company: string;
  oldRemaining: number;
  newRemaining: number;
};

function providerFor(coupon: Coupon): 'multipass' | 'buyme' | null {
  const lookup = [coupon.company, coupon.source, coupon.auto_download_details]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    lookup.includes('multipass') ||
    lookup.includes('מולטיפס') ||
    lookup.includes('xgiftcard') ||
    lookup.includes('x giftcard') ||
    lookup.includes('gift card')
  ) return 'multipass';

  if (lookup.includes('buyme') || coupon.buyme_coupon_url) return 'buyme';
  return null;
}

// Mirror the legacy app: a coupon is eligible only after a new user view.
function shouldUpdateCoupon(coupon: Coupon): boolean {
  if (!coupon.last_scraped) return true;
  const views = [coupon.last_detail_view, coupon.last_company_view, coupon.last_code_view]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value));
  return views.length > 0 && Math.max(...views) > Date.parse(coupon.last_scraped);
}

// Calls the external scraper microservice. Returns the current remaining balance,
// or null if the service is unavailable / could not determine it.
async function fetchRemaining(coupon: Coupon, provider: string): Promise<number | null> {
  const base = Deno.env.get('SCRAPER_SERVICE_URL');
  if (!base) return null;
  try {
    const resp = await fetch(`${base.replace(/\/$/, '')}/scrape/${provider}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(Deno.env.get('SCRAPER_SERVICE_TOKEN')
          ? { authorization: `Bearer ${Deno.env.get('SCRAPER_SERVICE_TOKEN')}` }
          : {}),
      },
      body: JSON.stringify({ coupon_id: coupon.id }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return typeof data.remaining === 'number' ? data.remaining : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user_id, coupon_id } = await req.json();
    if (!user_id) return jsonResponse({ error: 'user_id חסר' }, 400);
    const authenticatedUser = await requireUser(req);
    requireSameUser(user_id, authenticatedUser.id);
    const userId = authenticatedUser.id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const serviceSupabase = createServiceClient();

    // Start a run record
    const { data: run } = await supabase
      .from('auto_update_runs')
      .insert({ user_id, status: 'running', started_at: new Date().toISOString() })
      .select()
      .single();

    let query = supabase
      .from('coupon')
      .select('id, company, source, auto_download_details, value, used_value, buyme_coupon_url, auto_update, user_id, last_scraped, last_detail_view, last_company_view, last_code_view')
      .eq('user_id', userId)
      .eq('auto_update', true)
      .neq('status', 'נוצל');
    if (coupon_id) query = query.eq('id', coupon_id);

    const { data: coupons, error } = await query;
    if (error) throw error;

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const changedCoupons: UpdatedCouponSummary[] = [];
    const multipassCouponsToDispatch: Coupon[] = [];

    for (const coupon of (coupons || []) as Coupon[]) {
      if (!shouldUpdateCoupon(coupon)) {
        skipped++;
        continue;
      }
      const provider = providerFor(coupon);
      if (!provider) {
        skipped++;
        continue;
      }
      if (provider === 'multipass' && !Deno.env.get('SCRAPER_SERVICE_URL')) {
        multipassCouponsToDispatch.push(coupon);
        continue;
      }
      const remaining = await fetchRemaining(coupon, provider);
      if (remaining === null) {
        skipped++;
        continue;
      }
      const newUsed = Math.max(0, Math.min(coupon.value, coupon.value - remaining));
      const oldRemaining = Math.max(0, coupon.value - coupon.used_value);
      const newRemaining = Math.max(0, coupon.value - newUsed);
      const { error: updateErr } = await supabase
        .from('coupon')
        .update({
          used_value: newUsed,
          status: newUsed >= coupon.value ? 'נוצל' : 'פעיל',
          last_scraped: new Date().toISOString(),
        })
        .eq('id', coupon.id);
      if (updateErr) failed++;
      else {
        updated++;
        if (newUsed !== coupon.used_value) {
          changedCoupons.push({
            company: coupon.company,
            oldRemaining,
            newRemaining,
          });
        }
      }
    }

    let dispatchMessage: string | null = null;
    if (multipassCouponsToDispatch.length > 0) {
      const triggerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/trigger-multipass-update`;
      const dispatchResponse = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
        },
        body: JSON.stringify({
          user_id,
          coupon_id: coupon_id ?? null,
        }),
      });
      const dispatchResult = await dispatchResponse.json();

      if (dispatchResponse.ok && dispatchResult?.success) {
        dispatchMessage = dispatchResult.run_url
          ? `Multipass/XGiftCard update dispatched: ${dispatchResult.run_url}`
          : 'Multipass/XGiftCard update dispatched successfully';
      } else {
        failed += multipassCouponsToDispatch.length;
        dispatchMessage = dispatchResult?.error || 'Multipass dispatch failed';
      }

      if (run) {
        await supabase
          .from('auto_update_runs')
          .update({
            job_id: dispatchResponse.ok && dispatchResult?.success ? dispatchResult.run_id : null,
            message: dispatchMessage,
          })
          .eq('id', run.id);
      }
    }

    if (changedCoupons.length > 0) {
      const topChanges = changedCoupons
        .slice(0, 3)
        .map((item) => `${item.company}: ${item.oldRemaining.toFixed(2)}₪ → ${item.newRemaining.toFixed(2)}₪`)
        .join(' | ');

      const extraCount = changedCoupons.length - 3;
      const suffix = extraCount > 0 ? ` ועוד ${extraCount} קופונים` : '';
      const message = `סיימנו לעדכן את הקופונים שלך. ${changedCoupons.length} קופונים השתנו: ${topChanges}${suffix}`;

      await supabase.from('notifications').insert({
        user_id,
        message,
        link: '/notifications',
        shown: false,
        viewed: false,
        hide_from_view: false,
      });

      const { data: subscriptions } = await serviceSupabase
        .from('push_subscriptions')
        .select('endpoint, subscription')
        .eq('user_id', userId);

      await sendPushToRows(
        serviceSupabase,
        (subscriptions || []) as Array<{ endpoint: string; subscription: Record<string, unknown> }>,
        {
          title: 'קופון מאסטר',
          body: message,
          url: '/notifications',
          tag: `coupon-update-${user_id}`,
          renotify: true,
        }
      );
    }

    if (run) {
      await supabase
        .from('auto_update_runs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          status: multipassCouponsToDispatch.length > 0 && !Deno.env.get('SCRAPER_SERVICE_URL') ? 'dispatched' : 'completed',
          updated_count: updated,
          failed_count: failed,
          skipped_count: skipped,
          message: dispatchMessage || (
            Deno.env.get('SCRAPER_SERVICE_URL')
              ? null
              : 'SCRAPER_SERVICE_URL לא מוגדר — קופוני BuyMe דולגו, וקופוני Multipass/XGiftCard נשלחו ל-dispatch אם הוגדר GitHub token'
          ),
        })
        .eq('id', run.id);
    }

    return jsonResponse({ updated, failed, skipped });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
