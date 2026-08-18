/**
 * RPC surface hardening: the legacy widget RPCs that accepted a user id must
 * no longer be reachable by the public `anon` key. Migration 0015 revokes them.
 *
 * This is a live check against the deployed PostgREST surface. It requires
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, which are public values.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

test.describe('legacy widget RPCs are closed to anon', () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, 'Supabase env vars not set');

  const call = (fn: string, body: unknown) =>
    fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  for (const fn of ['get_widget_coupons', 'get_widget_statistics', 'get_widget_companies', 'mark_coupon_as_used_rpc', 'trigger_hourly_multipass_update']) {
    test(`anon cannot call ${fn}`, async () => {
      const response = await call(fn, { p_user_id: 1, p_coupon_id: 1 });
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  }
});
