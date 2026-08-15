/**
 * The anon key ships inside the JS bundle, so it is public by definition.
 * Anything it can reach, anyone on the internet can reach.
 *
 * This suite asserts that reaching for a table with nothing but the anon key
 * returns no rows and accepts no writes. It is the regression test for the
 * *_anon_ios / simple_ios_access policies, which granted `anon` blanket
 * `using (true)` access and thereby defeated every other policy on the table.
 *
 * A new table with no policy will fail here on its first run, which is the
 * point: RLS is opt-out by accident and this makes it opt-in on purpose.
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (safe to expose in CI —
 * they are public values).
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Every table an unauthenticated caller must not be able to touch. Keep this
 * in sync with the schema — adding a table here is cheaper than discovering
 * it was public.
 */
const PRIVATE_TABLES = [
  'users', 'coupon', 'coupon_tags', 'coupon_transaction', 'coupon_usage',
  'coupon_shares', 'coupon_active_viewers', 'transactions', 'notifications',
  'notification_settings', 'admin_settings', 'admin_messages', 'newsletters',
  'newsletter_sendings', 'telegram_users', 'telegram_users_audit_log',
  'user_activities', 'user_consents', 'user_tour_progress',
  'user_feature_overrides', 'user_ratings', 'user_reviews', 'push_subscriptions',
  'push_system_config', 'gpt_usage', 'opt_outs', 'auto_update_runs',
  'scheduled_tasks', 'task_execution_logs', 'bot_settings', 'companies', 'tag',
  'feature_access', 'daily_email_status',
];

test.describe('anonymous access is locked down', () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, 'Supabase env vars not set');

  const anonFetch = (path: string, init: RequestInit = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: ANON_KEY!, 'Content-Type': 'application/json', ...init.headers },
    });

  for (const table of PRIVATE_TABLES) {
    test(`anon cannot read ${table}`, async () => {
      const response = await anonFetch(`${table}?select=*&limit=1`);

      // Either the request is rejected outright, or RLS filters it to nothing.
      // Both are acceptable; returning a row is not.
      if (response.ok) {
        const rows = await response.json();
        expect(rows, `${table} leaked ${JSON.stringify(rows).slice(0, 120)}`).toEqual([]);
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });
  }

  test('anon cannot read password hashes', async () => {
    const response = await anonFetch('users?select=password&limit=1');
    if (response.ok) {
      expect(await response.json()).toEqual([]);
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });

  test('anon cannot grant itself admin', async () => {
    // Targets no row on purpose — this asserts the request is refused, not
    // that it happened to match nothing.
    const response = await anonFetch('users?id=eq.-1', {
      method: 'PATCH',
      body: JSON.stringify({ is_admin: true }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test('anon cannot insert coupons', async () => {
    const response = await anonFetch('coupon', {
      method: 'POST',
      body: JSON.stringify({ code: 'anon-lockdown-probe', value: 0, cost: 0, company: 'probe', user_id: 1 }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
