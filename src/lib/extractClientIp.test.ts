import { describe, expect, it } from 'vitest';
import { extractClientIp } from '../../supabase/functions/_shared/clientIp';

function req(headers: Record<string, string>): Request {
  return new Request('https://example.test/fn', { headers });
}

describe('extractClientIp', () => {
  it('prefers cf-connecting-ip over a client-supplied x-forwarded-for', () => {
    expect(
      extractClientIp(req({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' })),
    ).toBe('203.0.113.9');
  });

  it('trims cf-connecting-ip', () => {
    expect(extractClientIp(req({ 'cf-connecting-ip': '  203.0.113.9 ' }))).toBe('203.0.113.9');
  });

  it('uses the right-most x-forwarded-for entry (nearest proxy) when no cf header', () => {
    expect(extractClientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('handles a single x-forwarded-for value', () => {
    expect(extractClientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('skips empty x-forwarded-for entries (malformed trailing comma)', () => {
    expect(extractClientIp(req({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9, , ' }))).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip when both proxy headers are missing', () => {
    expect(extractClientIp(req({ 'x-real-ip': ' 203.0.113.9 ' }))).toBe('203.0.113.9');
  });

  it("returns 'unknown' when no headers are present", () => {
    expect(extractClientIp(req({}))).toBe('unknown');
  });

  it('ignores a whitespace-only cf-connecting-ip and keeps falling through', () => {
    expect(
      extractClientIp(req({ 'cf-connecting-ip': '   ', 'x-forwarded-for': '203.0.113.9' })),
    ).toBe('203.0.113.9');
  });

  it('ignores a whitespace-only x-forwarded-for and uses x-real-ip', () => {
    expect(extractClientIp(req({ 'x-forwarded-for': ' ,  ', 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });
});
