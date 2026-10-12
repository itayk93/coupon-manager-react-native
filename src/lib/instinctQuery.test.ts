import { describe, expect, it } from 'vitest';
import { parseQuery, hashKey } from '../../supabase/functions/instinct-api/query';
import { instinctGuide } from './instinctGuide';

describe('Instinct request boundary', () => {
  it('supports repeated date filters, Hebrew search, projections and stable ordering', () => {
    expect(parseQuery(new URLSearchParams('apikey=secret&timestamp=gte.2026-01-01&timestamp=lt.2027-01-01&company=ilike.*אוכל*&select=id,company&order=expiration.asc,id.desc&limit=200&offset=200'))).toEqual({
      p_filters: [{ column: 'timestamp', op: 'gte', value: '2026-01-01' }, { column: 'timestamp', op: 'lt', value: '2027-01-01' }, { column: 'company', op: 'ilike', value: '*אוכל*' }],
      p_order: [{ column: 'expiration', direction: 'asc' }, { column: 'id', direction: 'desc' }], p_select: ['id', 'company'], p_limit: 200, p_offset: 200,
    });
  });
  it.each(['limit=0', 'limit=201', 'limit=1e2', 'offset=-1', 'offset=1000001', 'select=', 'order=id.desc.extra', 'order=id.drop'])('rejects malformed controls: %s', query => {
    expect(() => parseQuery(new URLSearchParams(query))).toThrow();
  });
  it('keeps SQL-looking values as data', () => {
    expect(parseQuery(new URLSearchParams({ company: "eq.';drop table users;--" })).p_filters[0].value).toBe("';drop table users;--");
  });
  it('hashes keys deterministically without keeping plaintext', async () => {
    expect(await hashKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('produces a key-free guide with configured endpoint', () => {
    const guide = instinctGuide('https://example.com/functions/v1/instinct-api');
    expect(guide).toContain('https://example.com/functions/v1/instinct-api/schema?apikey=<KEY>');
    expect(guide).toContain('coupon_transaction');
    expect(guide).not.toContain('cm_instinct_');
  });
  it('embeds the literal key when given, with no placeholders left', () => {
    const key = `cm_instinct_${'a'.repeat(64)}`;
    const guide = instinctGuide('https://example.com/functions/v1/instinct-api', key);
    expect(guide).toContain(`/schema?apikey=${key}`);
    expect(guide).not.toContain('<KEY>');
    expect(guide).not.toContain('נמסר בנפרד');
  });
});
