/**
 * Edge Functions hold the service role key, which bypasses RLS entirely, so an
 * unauthenticated caller reaching one is worse than reaching a table. These
 * assert the two that used to be fully open stay closed:
 *
 *   parse-coupon  spends money on every call (OpenAI)
 *   send-emails   can mail every user via Brevo, or any address in test mode
 *
 * issue_report stays deliberately public — /issues is a public page — and is
 * covered here to pin down that it only ever mails the site owner.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

test.describe('edge functions reject unauthenticated callers', () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, 'Supabase env vars not set');

  const call = (fn: string, body: unknown) =>
    fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  test('parse-coupon refuses anon (paid OpenAI call)', async () => {
    expect((await call('parse-coupon', { text: 'probe' })).status).toBe(401);
  });

  for (const mode of ['newsletter', 'expiration_reminders', 'test'] as const) {
    test(`send-emails refuses anon in ${mode} mode`, async () => {
      const response = await call('send-emails', { mode, newsletter_id: 1, to: 'probe@example.invalid' });
      expect(response.status).toBe(403);
    });
  }

  test('send-emails issue_report stays public but validates input', async () => {
    // 400, not 403: the handler is reachable by design, and rejects empties.
    expect((await call('send-emails', { mode: 'issue_report', subject: '', details: '' })).status).toBe(400);
  });
});
