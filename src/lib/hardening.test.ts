/**
 * Constant-time comparison guard for HMAC-token validation.
 *
 * This test pins the public surface: the unsubscribe verifier must not fall
 * back to `===`/`!==` on the signature. It also locks the server-side helper
 * files so a later edit cannot reintroduce the timing leak silently.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

test('manage-unsubscribe verifies HMAC without === or !==', () => {
  const path = resolve('supabase/functions/manage-unsubscribe/index.ts');
  const src = readFileSync(path, 'utf8');
  expect(src).toContain('timingSafeEqual(expectedSignature, signaturePart)');
  expect(src).not.toMatch(/expectedSignature\s*!==\s*signaturePart/);
});

test('legacy-login uses constant-time comparison for hashes', () => {
  const path = resolve('supabase/functions/legacy-login/index.ts');
  const src = readFileSync(path, 'utf8');
  expect(src).toContain('timingSafeEqual');
  expect(src).toContain('timingSafeEqual(toHex(derived), expectedHash)');
});
